use std::future::Future;
use std::pin::Pin;

use super::traits::{
    ParseError, ParsedChunk, ParsedEventType, ProviderAdapter, RequestPayload, ToolDef,
};

/// Per-request mutable state for Anthropic SSE parsing.
///
/// Anthropic delivers tool-use across three events:
/// 1. `content_block_start` with `type: "tool_use"` — captures the tool name
/// 2. `content_block_delta` with `input_json_delta` — accumulates JSON fragments
/// 3. `content_block_stop` — finalises the tool call and emits a `ToolUse` chunk
#[derive(Debug, Default)]
struct StreamParseState {
    active_tool_name: Option<String>,
    tool_input_buffer: String,
}

/// Anthropic Messages API adapter.
#[derive(Debug, Default)]
pub struct AnthropicAdapter {
    /// Per-request parse state. Cleared on each new stream.
    parse_state: StreamParseState,
}

impl AnthropicAdapter {
    pub fn new() -> Self {
        Self {
            parse_state: StreamParseState::default(),
        }
    }
}

impl ProviderAdapter for AnthropicAdapter {
    fn provider_name(&self) -> &'static str {
        "anthropic"
    }

    fn chat_endpoint(&self) -> &str {
        "https://api.anthropic.com/v1/messages"
    }

    fn auth_header(&self, api_key: &str) -> (String, String) {
        ("x-api-key".to_string(), api_key.to_string())
    }

    fn build_chat_request(
        &self,
        model: &str,
        system_prompt: &str,
        messages: &[serde_json::Value],
        tools: &[ToolDef],
    ) -> RequestPayload {
        let anthropic_tools: Vec<serde_json::Value> = tools
            .iter()
            .map(|t| {
                serde_json::json!({
                    "name": t.name,
                    "description": t.description,
                    "input_schema": t.input_schema,
                })
            })
            .collect();

        let body = serde_json::json!({
            "model": model,
            "max_tokens": 4096,
            "system": system_prompt,
            "messages": messages,
            "tools": anthropic_tools,
            "stream": true,
        });

        RequestPayload {
            endpoint: self.chat_endpoint().to_string(),
            headers: vec![
                ("anthropic-version".to_string(), "2023-06-01".to_string()),
                ("content-type".to_string(), "application/json".to_string()),
            ],
            body,
        }
    }

    fn build_non_streaming_request(
        &self,
        model: &str,
        system_prompt: &str,
        prompt: &str,
    ) -> RequestPayload {
        let body = serde_json::json!({
            "model": model,
            "max_tokens": 4096,
            "system": system_prompt,
            "messages": [
                {"role": "user", "content": prompt}
            ],
            "stream": false,
        });

        RequestPayload {
            endpoint: self.chat_endpoint().to_string(),
            headers: vec![
                ("anthropic-version".to_string(), "2023-06-01".to_string()),
                ("content-type".to_string(), "application/json".to_string()),
            ],
            body,
        }
    }

    fn parse_stream_chunk(&mut self, data: &str) -> Result<Option<ParsedChunk>, ParseError> {
        // Handle the special "[DONE]" sentinel that some proxies emit
        if data.trim() == "[DONE]" {
            return Ok(Some(ParsedChunk {
                event_type: ParsedEventType::Done,
                content: String::new(),
                tool_name: None,
                tool_input: None,
            }));
        }

        let event: serde_json::Value =
            serde_json::from_str(data).map_err(|e| ParseError(format!("JSON parse: {}", e)))?;

        let ev_type = event["type"].as_str().unwrap_or("");

        match ev_type {
            "content_block_start" => {
                let block = &event["content_block"];
                if block["type"] == "tool_use" {
                    self.parse_state.active_tool_name =
                        Some(block["name"].as_str().unwrap_or("").to_string());
                    self.parse_state.tool_input_buffer.clear();
                }
                Ok(None)
            }

            "content_block_delta" => {
                let delta = &event["delta"];

                // Text delta — emit immediately
                if let Some(text) = delta["text"].as_str() {
                    if !text.is_empty() {
                        return Ok(Some(ParsedChunk {
                            event_type: ParsedEventType::TextDelta,
                            content: text.to_string(),
                            tool_name: None,
                            tool_input: None,
                        }));
                    }
                }

                // Tool input JSON fragment — accumulate, do not emit yet
                if let Some(json_fragment) = delta["input_json_delta"].as_str() {
                    self.parse_state.tool_input_buffer.push_str(json_fragment);
                }

                Ok(None)
            }

            "content_block_stop" => {
                if let Some(ref name) = self.parse_state.active_tool_name.take() {
                    let tool_input = if self.parse_state.tool_input_buffer.is_empty() {
                        None
                    } else {
                        serde_json::from_str(&self.parse_state.tool_input_buffer).ok()
                    };
                    self.parse_state.tool_input_buffer.clear();

                    return Ok(Some(ParsedChunk {
                        event_type: ParsedEventType::ToolUse,
                        content: String::new(),
                        tool_name: Some(name.clone()),
                        tool_input,
                    }));
                }
                self.parse_state.tool_input_buffer.clear();
                Ok(None)
            }

            "message_delta" => {
                if let Some(reason) = event["delta"]["stop_reason"].as_str() {
                    if reason == "end_turn" || reason == "tool_use" {
                        return Ok(Some(ParsedChunk {
                            event_type: ParsedEventType::Done,
                            content: String::new(),
                            tool_name: None,
                            tool_input: None,
                        }));
                    }
                }
                Ok(None)
            }

            "message_stop" => Ok(Some(ParsedChunk {
                event_type: ParsedEventType::Done,
                content: String::new(),
                tool_name: None,
                tool_input: None,
            })),

            "error" => {
                let msg = event["error"]["message"]
                    .as_str()
                    .unwrap_or("Unknown error")
                    .to_string();
                Ok(Some(ParsedChunk {
                    event_type: ParsedEventType::Error,
                    content: msg,
                    tool_name: None,
                    tool_input: None,
                }))
            }

            // ping, message_start, etc. — no user-visible event
            _ => Ok(None),
        }
    }

    fn parse_text_response(&self, body: &serde_json::Value) -> Option<String> {
        body["content"]
            .as_array()
            .and_then(|blocks| blocks.first())
            .and_then(|block| block["text"].as_str())
            .map(|s| s.to_string())
    }

    fn validate_api_key(
        &self,
        key: &str,
    ) -> Pin<Box<dyn Future<Output = Result<bool, String>> + Send + '_>> {
        let key = key.to_string();
        Box::pin(async move {
            let client = reqwest::Client::new();
            let resp = client
                .get("https://api.anthropic.com/v1/models")
                .header("x-api-key", &key)
                .header("anthropic-version", "2023-06-01")
                .send()
                .await
                .map_err(|e| format!("Network error: {}", e))?;
            Ok(resp.status().is_success())
        })
    }
}
