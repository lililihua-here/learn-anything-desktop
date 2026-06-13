use super::types::{StreamEvent, StreamEventType};
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tokio::sync::broadcast;

#[derive(Debug, Clone, Serialize)]
pub struct FrontendPayload {
    pub event_type: String,
    pub content: String,
    pub tool_name: Option<String>,
    pub tool_input: Option<serde_json::Value>,
    pub session_id: String,
    pub concept_slug: String,
}

/// Subscribes to StreamEvents and emits them to the Tauri frontend.
/// Runs in its own tokio task, independent from Persistence.
pub async fn run(app: AppHandle, mut rx: broadcast::Receiver<StreamEvent>) {
    while let Ok(event) = rx.recv().await {
        let payload = FrontendPayload {
            event_type: match event.event_type {
                StreamEventType::TextDelta => "text_delta",
                StreamEventType::ToolUse => "tool_use",
                StreamEventType::Done => "done",
                StreamEventType::Error => "error",
            }
            .into(),
            content: event.content,
            tool_name: event.tool_name,
            tool_input: event.tool_input,
            session_id: event.session_id,
            concept_slug: event.concept_slug,
        };
        let _ = app.emit("chat-stream-event", payload);
    }
}
