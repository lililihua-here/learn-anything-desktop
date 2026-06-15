use std::pin::Pin;
use std::future::Future;

use super::traits::{
    ParsedChunk, ParseError, ProviderAdapter, RequestPayload, ToolDef,
};
use super::openai::{OpenAIAdapter, StreamParseState};

/// Qwen (Tongyi Qianwen) Chat Completions API adapter via Alibaba DashScope.
///
/// Qwen is fully OpenAI-compatible. This adapter delegates all protocol
/// logic to `OpenAIAdapter` and only overrides the endpoint and provider name.
pub struct QwenAdapter {
    inner: OpenAIAdapter,
}

impl QwenAdapter {
    pub fn new() -> Self {
        Self {
            inner: OpenAIAdapter {
                provider_name: "qwen",
                endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
                    .to_string(),
                parse_state: StreamParseState::default(),
            },
        }
    }
}

impl ProviderAdapter for QwenAdapter {
    fn provider_name(&self) -> &'static str {
        self.inner.provider_name
    }

    fn chat_endpoint(&self) -> &str {
        &self.inner.endpoint
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
        self.inner.build_chat_request(model, system_prompt, messages, tools)
    }

    fn build_non_streaming_request(
        &self,
        model: &str,
        system_prompt: &str,
        prompt: &str,
    ) -> RequestPayload {
        self.inner.build_non_streaming_request(model, system_prompt, prompt)
    }

    fn parse_stream_chunk(
        &mut self,
        data: &str,
    ) -> Result<Option<ParsedChunk>, ParseError> {
        self.inner.parse_stream_chunk(data)
    }

    fn parse_text_response(&self, body: &serde_json::Value) -> Option<String> {
        self.inner.parse_text_response(body)
    }

    fn validate_api_key(
        &self,
        key: &str,
    ) -> Pin<Box<dyn Future<Output = Result<bool, String>> + Send + '_>> {
        let key = key.to_string();
        Box::pin(async move {
            let client = reqwest::Client::new();
            let resp = client
                .get("https://dashscope.aliyuncs.com/compatible-mode/v1/models")
                .header("Authorization", format!("Bearer {}", key))
                .send()
                .await
                .map_err(|e| format!("Network error: {}", e))?;
            Ok(resp.status().is_success())
        })
    }
}
