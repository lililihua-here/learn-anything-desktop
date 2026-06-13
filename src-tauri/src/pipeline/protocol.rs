use futures::StreamExt;
use tokio::sync::broadcast;
use tokio_util::sync::CancellationToken;
use super::types::{StreamEvent, StreamEventType};
use super::transport;

pub async fn run(
    api_key: &str,
    model: &str,
    system_prompt: &str,
    messages: &[serde_json::Value],
    tools: &[serde_json::Value],
    session_id: &str,
    concept_slug: &str,
    tx: broadcast::Sender<StreamEvent>,
    cancel_token: CancellationToken,
) -> Result<(), String> {
    let mut stream = transport::start_stream(api_key, model, system_prompt, messages, tools).await?;
    let mut buffer = String::new();

    let sid = session_id.to_string();
    let cs = concept_slug.to_string();

    let mut active_tool_name: Option<String> = None;
    let mut tool_input_buffer: String = String::new();

    loop {
        let chunk = tokio::select! {
            chunk = stream.next() => chunk,
            _ = cancel_token.cancelled() => {
                let _ = tx.send(StreamEvent {
                    event_type: StreamEventType::Done,
                    content: String::new(), tool_name: None, tool_input: None,
                    session_id: sid.clone(), concept_slug: cs.clone(),
                });
                return Ok(());
            }
        };

        let chunk = match chunk {
            Some(Ok(c)) => c,
            Some(Err(e)) => return Err(format!("Stream error: {}", e)),
            None => break,
        };

        let text = String::from_utf8_lossy(&chunk);
        buffer.push_str(&text);

        while let Some(event_end) = buffer.find("\n\n") {
            let event_text = buffer[..event_end].to_string();
            buffer = buffer[event_end + 2..].to_string();

            for line in event_text.lines() {
                if !line.starts_with("data: ") { continue; }
                let data = &line[6..];
                let event: serde_json::Value = match serde_json::from_str(data) {
                    Ok(v) => v,
                    Err(_) => continue,
                };

                let ev_type = event["type"].as_str().unwrap_or("");
                match ev_type {
                    "content_block_start" => {
                        let block = &event["content_block"];
                        if block["type"] == "tool_use" {
                            active_tool_name = Some(block["name"].as_str().unwrap_or("").to_string());
                            tool_input_buffer.clear();
                        }
                    }
                    "content_block_delta" => {
                        let delta = &event["delta"];
                        if let Some(text) = delta["text"].as_str() {
                            let _ = tx.send(StreamEvent {
                                event_type: StreamEventType::TextDelta,
                                content: text.to_string(),
                                tool_name: None, tool_input: None,
                                session_id: sid.clone(), concept_slug: cs.clone(),
                            });
                        }
                        if let Some(json_fragment) = delta["input_json_delta"].as_str() {
                            tool_input_buffer.push_str(json_fragment);
                        }
                    }
                    "content_block_stop" => {
                        if let Some(ref name) = active_tool_name.take() {
                            let tool_input = if tool_input_buffer.is_empty() {
                                None
                            } else {
                                serde_json::from_str(&tool_input_buffer).ok()
                            };
                            let _ = tx.send(StreamEvent {
                                event_type: StreamEventType::ToolUse,
                                content: String::new(),
                                tool_name: Some(name.clone()),
                                tool_input,
                                session_id: sid.clone(),
                                concept_slug: cs.clone(),
                            });
                        }
                        tool_input_buffer.clear();
                    }
                    "message_delta" => {
                        if let Some(reason) = event["delta"]["stop_reason"].as_str() {
                            if reason == "end_turn" || reason == "tool_use" {
                                let _ = tx.send(StreamEvent {
                                    event_type: StreamEventType::Done,
                                    content: String::new(), tool_name: None, tool_input: None,
                                    session_id: sid.clone(), concept_slug: cs.clone(),
                                });
                            }
                        }
                    }
                    "error" => {
                        let _ = tx.send(StreamEvent {
                            event_type: StreamEventType::Error,
                            content: event["error"]["message"].as_str().unwrap_or("Unknown").into(),
                            tool_name: None, tool_input: None,
                            session_id: sid.clone(), concept_slug: cs.clone(),
                        });
                    }
                    _ => {}
                }
            }
        }
    }
    Ok(())
}
