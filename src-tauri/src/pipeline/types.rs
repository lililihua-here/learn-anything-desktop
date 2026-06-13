use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
}

#[derive(Debug, Clone, Serialize)]
pub struct StreamEvent {
    pub event_type: StreamEventType,
    pub content: String,
    pub tool_name: Option<String>,
    pub tool_input: Option<serde_json::Value>,
    pub session_id: String,
    pub concept_slug: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub enum StreamEventType {
    TextDelta,
    ToolUse,
    Done,
    Error,
}
