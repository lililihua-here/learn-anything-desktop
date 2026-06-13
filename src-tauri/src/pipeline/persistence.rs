use super::types::{StreamEvent, StreamEventType};
use rusqlite::Connection;
use tokio::sync::broadcast;

/// Runs in its own tokio task. Receives StreamEvents and writes to SQLite in real-time.
pub async fn run(mut rx: broadcast::Receiver<StreamEvent>, conn: Connection) {
    let mut assistant_turn_has_content = false;

    while let Ok(event) = rx.recv().await {
        match event.event_type {
            StreamEventType::TextDelta => {
                assistant_turn_has_content = true;

                conn.execute(
                    "INSERT INTO messages (id, session_id, role, content) VALUES (?1, ?2, 'assistant', ?3)",
                    rusqlite::params![
                        uuid::Uuid::new_v4().to_string(),
                        event.session_id,
                        event.content,
                    ],
                )
                .ok();
            }
            StreamEventType::ToolUse => {
                if let Some(ref name) = event.tool_name {
                    match name.as_str() {
                        "present_card" => {
                            if let Some(ref input) = event.tool_input {
                                let slug = input["slug"].as_str().unwrap_or("");
                                let card_name = input["name"].as_str().unwrap_or("");
                                let summary = input["summary"].as_str().unwrap_or("");
                                let session_id = event.session_id.as_str();

                                if let Ok(concept_id) =
                                    crate::db::queries::ensure_concept(&conn, card_name, slug)
                                {
                                    let card_id = format!("{}:{}", session_id, slug);
                                    conn.execute(
                                        "INSERT OR IGNORE INTO cards (id, concept_id, session_id, content, status, slug)
                                         VALUES (?1, ?2, ?3, ?4, 'active', ?5)",
                                        rusqlite::params![card_id, concept_id, session_id, summary, slug],
                                    )
                                    .ok();
                                }
                            }
                        }
                        "update_concept_status" => {
                            if let Some(ref input) = event.tool_input {
                                let slug = input["slug"].as_str().unwrap_or("");
                                let status = input["status"].as_str().unwrap_or("in_progress");
                                let confidence = input["confidence"].as_f64().unwrap_or(0.5);
                                conn.execute(
                                    "UPDATE concepts SET status=?1, confidence=?2 WHERE slug=?3",
                                    rusqlite::params![status, confidence, slug],
                                )
                                .ok();
                            }
                        }
                        _ => {}
                    }
                }
            }
            StreamEventType::Done => {
                if assistant_turn_has_content {
                    crate::db::queries::increment_explain_count(&conn, &event.concept_slug).ok();
                    assistant_turn_has_content = false;
                }

                crate::db::queries::mark_session_completed_if_ready(&conn, &event.session_id).ok();
            }
            StreamEventType::Error => {}
        }
    }
}
