use std::pin::Pin;
use std::future::Future;
use serde::{Deserialize, Serialize};

/// Intermediate parsed chunk from a provider's SSE stream.
/// Contains only event-level data — no session_id or concept_slug.
/// The protocol layer fills in session/concept context.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedChunk {
    pub event_type: ParsedEventType,
    pub content: String,
    pub tool_name: Option<String>,
    pub tool_input: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ParsedEventType {
    TextDelta,
    ToolUse,
    Done,
    Error,
}

/// Error type for parse failures.
#[derive(Debug)]
pub struct ParseError(pub String);

impl std::fmt::Display for ParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::error::Error for ParseError {}

/// Compile-time safe request payload replacing untyped `serde_json::Value`.
#[derive(Debug, Serialize)]
pub struct RequestPayload {
    pub endpoint: String,
    pub headers: Vec<(String, String)>,
    pub body: serde_json::Value,
}

/// Provider-agnostic tool definition.
#[derive(Debug, Serialize, Deserialize)]
pub struct ToolDef {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
}

/// The core abstraction over LLM provider API differences.
///
/// # Design notes
/// - `parse_stream_chunk` takes `&mut self` because OpenAI function calling
///   spans multiple chunks and requires per-request state accumulation.
/// - Adapters registered in `ProviderRegistry` are immutable (definition/factory);
///   a fresh adapter instance is created for each streaming request so that
///   mutable parse state does not leak across requests.
/// - `ParsedChunk` does NOT carry session_id/concept_slug — the protocol layer
///   fills those in when constructing `StreamEvent`.
pub trait ProviderAdapter: Send + Sync {
    /// Unique provider identifier, e.g. "anthropic", "openai".
    fn provider_name(&self) -> &'static str;

    /// Chat completions streaming endpoint URL.
    fn chat_endpoint(&self) -> &str;

    /// The HTTP header name and value for authentication.
    fn auth_header(&self, api_key: &str) -> (String, String);

    /// Build a streaming chat request payload.
    fn build_chat_request(
        &self,
        model: &str,
        system_prompt: &str,
        messages: &[serde_json::Value],
        tools: &[ToolDef],
    ) -> RequestPayload;

    /// Build a non-streaming (one-shot) chat request payload.
    fn build_non_streaming_request(
        &self,
        model: &str,
        system_prompt: &str,
        prompt: &str,
    ) -> RequestPayload;

    /// Parse a single SSE `data:` line into zero or one `ParsedChunk`.
    /// Returns `Ok(None)` when the line does not produce a user-visible event
    /// (e.g. a ping, or the start of a tool-call block that is still accumulating).
    ///
    /// Uses `&mut self` to maintain per-request state (e.g. partial tool-call
    /// accumulation across chunks for OpenAI).
    fn parse_stream_chunk(&mut self, data: &str) -> Result<Option<ParsedChunk>, ParseError>;

    /// Extract the text content from a non-streaming JSON response body.
    fn parse_text_response(&self, body: &serde_json::Value) -> Option<String>;

    /// Validate an API key by calling the provider's models/list endpoint.
    fn validate_api_key(
        &self,
        key: &str,
    ) -> Pin<Box<dyn Future<Output = Result<bool, String>> + Send + '_>>;
}
