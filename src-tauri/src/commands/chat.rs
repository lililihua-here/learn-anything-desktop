use crate::pipeline::{self, protocol, persistence, bridge, types::ChatMessage};
use crate::AppState;
use tauri::{AppHandle, Manager};
use tokio::sync::broadcast;
use tokio_util::sync::CancellationToken;
use std::collections::HashMap;
use std::sync::Mutex;

pub struct ChatState {
    pub cancel_tokens: Mutex<HashMap<String, CancellationToken>>,
}

#[tauri::command]
pub async fn start_chat_stream(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    concept_slug: String,
    concept_name: String,
    messages: Vec<ChatMessage>,
    l1_context: String,
) -> Result<String, String> {
    let api_key = std::env::var("ANTHROPIC_API_KEY")
        .map_err(|_| "API Key not configured. Please set ANTHROPIC_API_KEY environment variable.".to_string())?;

    let model = match crate::db::queries::get_setting(&state.db.query_conn, "model") {
        Ok(Some(m)) => m,
        _ => "claude-sonnet-4-20250514".to_string(),
    };

    let system_prompt = format!(
        "{}\n\n## Current learning context\n{}\n\n## Current concept\nThe user is learning about 「{}」.",
        crate::ai::SOCRATIC_SYSTEM_PROMPT, l1_context, concept_name
    );

    let msgs: Vec<serde_json::Value> = messages.iter().map(|m| {
        serde_json::json!({"role": m.role, "content": m.content})
    }).collect();

    let tools: Vec<serde_json::Value> = crate::ai::SOCRATIC_TOOLS.iter().map(|(n, d, s)| {
        serde_json::json!({"name": n, "description": d, "input_schema": serde_json::from_str::<serde_json::Value>(s).unwrap()})
    }).collect();

    let (tx, _) = pipeline::create_channel();
    let session_id = uuid::Uuid::new_v4().to_string();
    let cancel_token = CancellationToken::new();

    // Persistence: open a fresh connection for this streaming task
    let persistence_conn = state.db.open_persistence_conn()
        .map_err(|e| format!("Failed to open persistence connection: {}", e))?;
    let persistence_rx = tx.subscribe();
    tokio::spawn(async move {
        persistence::run(persistence_rx, persistence_conn).await;
    });

    // Event Bridge
    let bridge_rx = tx.subscribe();
    let app_handle = app.clone();
    tokio::spawn(async move {
        bridge::run(app_handle, bridge_rx).await;
    });

    // Protocol (with cancellation)
    let sid = session_id.clone();
    let cs = concept_slug.clone();
    let ct = cancel_token.clone();
    tokio::spawn(async move {
        if let Err(e) = protocol::run(&api_key, &model, &system_prompt, &msgs, &tools, &sid, &cs, tx, ct).await {
            eprintln!("Protocol error: {}", e);
        }
    });

    Ok(session_id)
}

#[tauri::command]
pub async fn stop_chat_stream(
    state: tauri::State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    // In production, ChatState would be stored in AppState
    // For now, cancellation is managed through protocol's tokio::select
    let _ = session_id;
    let _ = state;
    Ok(())
}

#[tauri::command]
pub async fn sync_card_queue(
    state: tauri::State<'_, AppState>,
    session_id: String,
    cards: Vec<serde_json::Value>,
) -> Result<(), String> {
    let conn = &state.db.query_conn;
    conn.execute("DELETE FROM card_queue WHERE session_id=?1", rusqlite::params![session_id])
        .map_err(|e| format!("DB error: {}", e))?;

    for card in &cards {
        let id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO card_queue (id, session_id, card_id, concept_id, position, status, defer_count)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![
                id, session_id,
                card["card_id"].as_str().unwrap_or(""),
                card["concept_id"].as_str().unwrap_or(""),
                card["position"].as_i64().unwrap_or(0),
                card["status"].as_str().unwrap_or("active"),
                card["defer_count"].as_i64().unwrap_or(0),
            ],
        ).map_err(|e| format!("DB error: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn submit_quiz_answers(
    state: tauri::State<'_, AppState>,
    session_id: String,
    concept_slug: String,
    submissions: Vec<serde_json::Value>,
) -> Result<(), String> {
    let conn = &state.db.query_conn;
    for sub in &submissions {
        let id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO quiz_submissions (id, session_id, concept_id, question_index, quiz_json, user_answer, result, score)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                id, session_id, concept_slug,
                sub["question_index"].as_i64().unwrap_or(0),
                sub["quiz_json"].as_str().unwrap_or(""),
                sub["user_answer"].as_str().unwrap_or(""),
                sub["result"].as_str().unwrap_or(""),
                sub["score"].as_f64(),
            ],
        ).map_err(|e| format!("DB error: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn complete_session(
    state: tauri::State<'_, AppState>,
    session_id: String,
    status: String,
) -> Result<(), String> {
    state.db.query_conn.execute(
        "UPDATE sessions SET status=?1, ended_at=datetime('now') WHERE id=?2",
        rusqlite::params![status, session_id],
    ).map_err(|e| format!("DB error: {}", e))?;
    Ok(())
}
