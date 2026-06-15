use std::collections::HashMap;
use std::pin::Pin;
use std::future::Future;

use super::traits::{
    ParsedChunk, ParsedEventType, ParseError, ProviderAdapter, RequestPayload, ToolDef,
};

/// Per-request mutable state for OpenAI SSE parsing.
///
/// OpenAI delivers function calls as a `tool_calls` array in the delta.
/// Each element has an `index` and may arrive across multiple chunks:
/// - First chunk: `{index: 0, id: "...", function: {name: "...", arguments: ""}}`
/// - Subsequent chunks: `{index: 0, function: {arguments: "..."}}` (append)
/// State is keyed by tool-call index to support multiple parallel tool calls.
#[derive(Debug, Default)]
struct StreamParseState {
    tool_states: HashMap<i64, ToolCallState>,
    /// Tracks whether we have seen a finish_reason
    finished: bool,
}

#[derive(Debug, Default)]
struct ToolCallState {
    name: String,
    arguments: String,
}

/// OpenAI Chat Completions API adapter.
///
/// Uses the standard `v1/chat/completions` endpoint with `Bearer` auth.
/// Compatible with any OpenAI-compatible provider (DeepSeek, Qwen, GLM, etc.)
/// that follows the same wire protocol.
#[derive(Debug, Default)]
pub struct OpenAIAdapter {
    parse_state: StreamParseState,
}

impl OpenAIAdapter {
    pub fn new() -> Self {
        Self {
            parse_state: StreamParseState::default(),
        }
    }
}

impl ProviderAdapter for OpenAIAdapter {
    fn provider_name(&self) -> &'static str {
        "openai"
    }

    fn chat_endpoint(&self) -> &str {
        "https://api.openai.com/v1/chat/completions"
    }

    fn auth_header(&self, api_key: &str) -> (String, String) {
        ("Authorization".to_string(), format!("Bearer {}", api_key))
    }

    fn build_chat_request(
        &self,
        model: &str,
        system_prompt: &str,
        messages: &[serde_json::Value],
        tools: &[ToolDef],
    ) -> RequestPayload {
        let openai_tools: Vec<serde_json::Value> = tools
            .iter()
            .map(|t| {
                serde_json::json!({
                    "type": "function",
                    "function": {
                        "name": t.name,
                        "description": t.description,
                        "parameters": t.input_schema,
                    }
                })
            })
            .collect();

        let mut msgs: Vec<serde_json::Value> = vec![
            serde_json::json!({"role": "system", "content": system_prompt}),
        ];
        msgs.extend_from_slice(messages);

        let mut body = serde_json::json!({
            "model": model,
            "messages": msgs,
            "stream": true,
            "stream_options": {"include_usage": true},
        });

        if !openai_tools.is_empty() {
            body["tools"] = serde_json::json!(openai_tools);
        }

        RequestPayload {
            endpoint: self.chat_endpoint().to_string(),
            headers: vec![
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
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            "stream": false,
        });

        RequestPayload {
            endpoint: self.chat_endpoint().to_string(),
            headers: vec![
                ("content-type".to_string(), "application/json".to_string()),
            ],
            body,
        }
    }

    fn parse_stream_chunk(
        &mut self,
        data: &str,
    ) -> Result<Option<ParsedChunk>, ParseError> {
        // Handle the "[DONE]" sentinel
        if data.trim() == "[DONE]" {
            // Flush any pending tool calls before emitting Done
            if let Some(chunk) = self.flush_pending_tools() {
                // We cannot return two values, so return the tool call now
                // and the caller will get Done on the next line.
                // Mark finished so the next non-data line triggers Done.
                self.parse_state.finished = true;
                return Ok(Some(chunk));
            }
            self.parse_state.finished = true;
            return Ok(Some(ParsedChunk {
                event_type: ParsedEventType::Done,
                content: String::new(),
                tool_name: None,
                tool_input: None,
            }));
        }

        let event: serde_json::Value =
            serde_json::from_str(data).map_err(|e| ParseError(format!("JSON parse: {}", e)))?;

        let choices = match event["choices"].as_array() {
            Some(c) => c,
            None => return Ok(None),
        };

        for choice in choices {
            let delta = &choice["delta"];

            // Text content delta
            if let Some(text) = delta["content"].as_str() {
                if !text.is_empty() {
                    return Ok(Some(ParsedChunk {
                        event_type: ParsedEventType::TextDelta,
                        content: text.to_string(),
                        tool_name: None,
                        tool_input: None,
                    }));
                }
            }

            // Tool calls delta
            if let Some(tool_calls) = delta["tool_calls"].as_array() {
                for tc in tool_calls {
                    let index = tc["index"].as_i64().unwrap_or(0);

                    let state = self
                        .parse_state
                        .tool_states
                        .entry(index)
                        .or_default();

                    // Capture the function name if provided
                    if let Some(name) = tc["function"]["name"].as_str() {
                        state.name = name.to_string();
                    }

                    // Accumulate arguments JSON fragments
                    if let Some(args) = tc["function"]["arguments"].as_str() {
                        state.arguments.push_str(args);
                    }
                }
            }

            // Finish reason — the stream is ending
            if let Some(reason) = choice["finish_reason"].as_str() {
                if !reason.is_empty() {
                    // Flush pending tool calls
                    if let Some(chunk) = self.flush_pending_tools() {
                        self.parse_state.finished = true;
                        return Ok(Some(chunk));
                    }

                    self.parse_state.finished = true;
                    return Ok(Some(ParsedChunk {
                        event_type: ParsedEventType::Done,
                        content: String::new(),
                        tool_name: None,
                        tool_input: None,
                    }));
                }
            }
        }

        // Check for top-level error
        if let Some(error) = event["error"].as_object() {
            let msg = error["message"]
                .as_str()
                .unwrap_or("Unknown error")
                .to_string();
            return Ok(Some(ParsedChunk {
                event_type: ParsedEventType::Error,
                content: msg,
                tool_name: None,
                tool_input: None,
            }));
        }

        Ok(None)
    }

    fn parse_text_response(&self, body: &serde_json::Value) -> Option<String> {
        body["choices"]
            .as_array()
            .and_then(|choices| choices.first())
            .and_then(|choice| choice["message"]["content"].as_str())
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
                .get("https://api.openai.com/v1/models")
                .header("Authorization", format!("Bearer {}", key))
                .send()
                .await
                .map_err(|e| format!("Network error: {}", e))?;
            Ok(resp.status().is_success())
        })
    }
}

impl OpenAIAdapter {
    /// Flush any fully accumulated tool calls from parse state.
    /// Returns the first one found (OpenAI typically sends one at a time per chunk),
    /// but iterates all indices for correctness.
    fn flush_pending_tools(&mut self) -> Option<ParsedChunk> {
        // Collect indices to avoid borrow issues
        let indices: Vec<i64> = self.parse_state.tool_states.keys().copied().collect();

        for index in indices {
            let state = self.parse_state.tool_states.remove(&index)?;

            if state.name.is_empty() {
                continue;
            }

            let tool_input = if state.arguments.is_empty() {
                None
            } else {
                serde_json::from_str(&state.arguments).ok()
            };

            return Some(ParsedChunk {
                event_type: ParsedEventType::ToolUse,
                content: String::new(),
                tool_name: Some(state.name),
                tool_input,
            });
        }

        None
    }
}
