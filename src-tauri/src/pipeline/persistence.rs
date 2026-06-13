use rusqlite::Connection;
use tokio::sync::broadcast;
use super::types::{StreamEvent, StreamEventType};

/// Runs in its own tokio task. Receives StreamEvents and writes to SQLite in real-time.
pub async fn run(mut rx: broadcast::Receiver<StreamEvent>, conn: Connection) {
    let mut session_created = false;

    while let Ok(event) = rx.recv().await {
        // Lazy session INSERT on first event
        if !session_created {
            let _ = conn.execute(
                "INSERT INTO sessions (id, concept_id, status, started_at) VALUES (?1, ?2, 'active', datetime('now'))",
                rusqlite::params![event.session_id, event.concept_slug],
            );
            session_created = true;
        }

        match event.event_type {
            StreamEventType::TextDelta => {
                let msg_id = uuid::Uuid::new_v4().to_string();
                conn.execute(
                    "INSERT INTO messages (id, session_id, role, content) VALUES (?1, ?2, 'assistant', ?3)",
                    rusqlite::params![msg_id, event.session_id, event.content],
                ).ok();
                conn.execute(
                    "UPDATE concepts SET explain_count=explain_count+1, last_explained=datetime('now') WHERE slug=?1",
                    rusqlite::params![event.concept_slug],
                ).ok();
            }
            StreamEventType::ToolUse => {
                if let Some(ref name) = event.tool_name {
                    match name.as_str() {
                        "present_card" => {
                            if let Some(ref input) = event.tool_input {
                                let slug = input["slug"].as_str().unwrap_or("");
                                let card_name = input["name"].as_str().unwrap_or("");
                                let summary = input["summary"].as_str().unwrap_or("");
                                let concept_id = uuid::Uuid::new_v4().to_string();
                                conn.execute(
                                    "INSERT INTO concepts (id, name, slug, status, confidence) VALUES (?1, ?2, ?3, 'unexplored', 0.0) ON CONFLICT(slug) DO UPDATE SET name=excluded.name",
                                    rusqlite::params![concept_id, card_name, slug],
                                ).ok();
                                let card_id = uuid::Uuid::new_v4().to_string();
                                conn.execute(
                                    "INSERT INTO cards (id, concept_id, session_id, content, status, slug) VALUES (?1, ?2, ?3, ?4, 'active', ?5)",
                                    rusqlite::params![card_id, concept_id, event.session_id, summary, slug],
                                ).ok();
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
                                ).ok();
                            }
                        }
                        _ => {}
                    }
                }
            }
            StreamEventType::Done => {
                let quiz_count: i64 = conn.query_row(
                    "SELECT COUNT(*) FROM quiz_submissions WHERE session_id=?1",
                    rusqlite::params![event.session_id],
                    |row| row.get(0),
                ).unwrap_or(0);

                let remaining: i64 = conn.query_row(
                    "SELECT COUNT(*) FROM card_queue WHERE session_id=?1 AND status NOT IN ('skipped', 'mastered')",
                    rusqlite::params![event.session_id],
                    |row| row.get(0),
                ).unwrap_or(0);

                let status = if quiz_count > 0 && remaining == 0 { "completed" } else { "interrupted" };
                conn.execute(
                    "UPDATE sessions SET status=?1, ended_at=datetime('now') WHERE id=?2",
                    rusqlite::params![status, event.session_id],
                ).ok();
            }
            StreamEventType::Error => { /* forwarded to frontend only */ }
        }
    }
}
