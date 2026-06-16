use super::transport;
use super::types::{StreamEvent, StreamEventType};
use crate::providers;
use crate::providers::traits::{ParsedChunk, ParsedEventType, ToolDef};
use futures::StreamExt;
use tokio::sync::broadcast;
use tokio_util::sync::CancellationToken;

pub async fn run(
    provider: &str,
    api_key: &str,
    model: &str,
    system_prompt: &str,
    messages: &[serde_json::Value],
    tools: &[ToolDef],
    session_id: &str,
    concept_slug: &str,
    tx: broadcast::Sender<StreamEvent>,
    cancel_token: CancellationToken,
) -> Result<(), String> {
    let mut adapter = providers::create_provider_adapter(provider)?;
    let mut stream = transport::start_stream(
        api_key,
        adapter.as_ref(),
        model,
        system_prompt,
        messages,
        tools,
    )
    .await?;
    let mut buffer = String::new();

    let sid = session_id.to_string();
    let cs = concept_slug.to_string();

    loop {
        let chunk = tokio::select! {
            chunk = stream.next() => chunk,
            _ = cancel_token.cancelled() => {
                let _ = tx.send(StreamEvent {
                    event_type: StreamEventType::Done,
                    content: String::new(),
                    tool_name: None,
                    tool_input: None,
                    session_id: sid.clone(),
                    concept_slug: cs.clone(),
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
                if !line.starts_with("data: ") {
                    continue;
                }

                let data = &line[6..];
                let parsed = adapter
                    .parse_stream_chunk(data)
                    .map_err(|e| format!("Provider parse error: {}", e))?;

                if let Some(chunk) = parsed {
                    emit_parsed_chunk(&tx, &sid, &cs, chunk);
                }
            }
        }
    }

    Ok(())
}

fn emit_parsed_chunk(
    tx: &broadcast::Sender<StreamEvent>,
    session_id: &str,
    concept_slug: &str,
    chunk: ParsedChunk,
) {
    let event_type = match chunk.event_type {
        ParsedEventType::TextDelta => StreamEventType::TextDelta,
        ParsedEventType::ToolUse => StreamEventType::ToolUse,
        ParsedEventType::Done => StreamEventType::Done,
        ParsedEventType::Error => StreamEventType::Error,
    };

    let _ = tx.send(StreamEvent {
        event_type,
        content: chunk.content,
        tool_name: chunk.tool_name,
        tool_input: chunk.tool_input,
        session_id: session_id.to_string(),
        concept_slug: concept_slug.to_string(),
    });
}
