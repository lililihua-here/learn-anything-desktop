use crate::pipeline::{self, bridge, persistence, protocol, types::ChatMessage};
use crate::AppState;
use tauri::AppHandle;
use tokio_util::sync::CancellationToken;

#[tauri::command]
pub async fn start_chat_stream(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    provider: String,
    model: String,
    concept_slug: String,
    concept_name: String,
    messages: Vec<ChatMessage>,
    l1_context: String,
    resume_session_id: Option<String>,
) -> Result<String, String> {
    let state = state.inner();
    let api_key_env = match provider.as_str() {
        "anthropic" => "ANTHROPIC_API_KEY",
        _ => return Err(format!("Unsupported provider: {}", provider)),
    };
    let api_key = std::env::var(api_key_env)
        .map_err(|_| format!("API Key not configured for provider: {}", provider))?;
    let model = if model.trim().is_empty() {
        "claude-sonnet-4-20250514".to_string()
    } else {
        model
    };

    let system_prompt = format!(
        "{}\n\n## Current learning context\n{}\n\n## Current concept\nThe user is learning about \"{}\".",
        crate::ai::SOCRATIC_SYSTEM_PROMPT, l1_context, concept_name
    );

    let msgs: Vec<serde_json::Value> = messages
        .iter()
        .map(|message| serde_json::json!({"role": message.role, "content": message.content}))
        .collect();

    let tools: Vec<serde_json::Value> = crate::ai::SOCRATIC_TOOLS
        .iter()
        .map(|(name, description, schema)| {
            serde_json::json!({
                "name": name,
                "description": description,
                "input_schema": serde_json::from_str::<serde_json::Value>(schema).unwrap()
            })
        })
        .collect();

    let session_id = resume_session_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let persistence_conn = {
        let db = state
            .db
            .lock()
            .map_err(|_| "Failed to lock database".to_string())?;
        let concept_id =
            crate::db::queries::ensure_concept(&db.query_conn, &concept_name, &concept_slug)
                .map_err(|e| format!("DB error: {}", e))?;

        let session_exists: i64 = db
            .query_conn
            .query_row(
                "SELECT COUNT(*) FROM sessions WHERE id=?1",
                rusqlite::params![session_id.as_str()],
                |row| row.get(0),
            )
            .map_err(|e| format!("DB error: {}", e))?;

        if session_exists == 0 {
            db.query_conn
                .execute(
                    "INSERT INTO sessions (id, concept_id, status, started_at) VALUES (?1, ?2, 'active', datetime('now'))",
                    rusqlite::params![session_id.as_str(), concept_id],
                )
                .map_err(|e| format!("DB error: {}", e))?;
        } else {
            db.query_conn
                .execute(
                    "UPDATE sessions SET status='active', ended_at=NULL WHERE id=?1",
                    rusqlite::params![session_id.as_str()],
                )
                .map_err(|e| format!("DB error: {}", e))?;
        }

        db.open_persistence_conn()
            .map_err(|e| format!("Failed to open persistence connection: {}", e))?
    };

    let cancel_token = CancellationToken::new();
    state
        .cancel_tokens
        .lock()
        .map_err(|_| "Failed to lock cancellation state".to_string())?
        .insert(session_id.clone(), cancel_token.clone());

    let (tx, _) = pipeline::create_channel();
    let persistence_rx = tx.subscribe();
    tokio::spawn(async move {
        persistence::run(persistence_rx, persistence_conn).await;
    });

    let bridge_rx = tx.subscribe();
    let app_handle = app.clone();
    tokio::spawn(async move {
        bridge::run(app_handle, bridge_rx).await;
    });

    let sid = session_id.clone();
    let slug = concept_slug.clone();
    let token = cancel_token.clone();
    tokio::spawn(async move {
        if let Err(error) = protocol::run(
            &api_key,
            &model,
            &system_prompt,
            &msgs,
            &tools,
            &sid,
            &slug,
            tx,
            token,
        )
        .await
        {
            eprintln!("Protocol error: {}", error);
        }
    });

    Ok(session_id)
}

#[tauri::command]
pub async fn stop_chat_stream(
    state: tauri::State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    let state = state.inner();
    if let Some(token) = state
        .cancel_tokens
        .lock()
        .map_err(|_| "Failed to lock cancellation state".to_string())?
        .remove(&session_id)
    {
        token.cancel();
    }

    Ok(())
}

#[tauri::command]
pub async fn sync_card_queue(
    state: tauri::State<'_, AppState>,
    session_id: String,
    cards: Vec<serde_json::Value>,
) -> Result<(), String> {
    let state = state.inner();
    let db = state
        .db
        .lock()
        .map_err(|_| "Failed to lock database".to_string())?;
    let conn = &db.query_conn;
    conn.execute(
        "DELETE FROM card_queue WHERE session_id=?1",
        rusqlite::params![session_id.as_str()],
    )
    .map_err(|e| format!("DB error: {}", e))?;

    for card in &cards {
        let card_id = card["card_id"].as_str().unwrap_or("");
        let concept_id: String = conn
            .query_row(
                "SELECT concept_id FROM cards WHERE id=?1",
                rusqlite::params![card_id],
                |row| row.get(0),
            )
            .map_err(|e| format!("DB error: {}", e))?;

        conn.execute(
            "INSERT INTO card_queue (id, session_id, card_id, concept_id, position, status, defer_count)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![
                uuid::Uuid::new_v4().to_string(),
                session_id.as_str(),
                card_id,
                concept_id,
                card["position"].as_i64().unwrap_or(0),
                card["status"].as_str().unwrap_or("active"),
                card["defer_count"].as_i64().unwrap_or(0),
            ],
        )
        .map_err(|e| format!("DB error: {}", e))?;
    }

    crate::db::queries::mark_session_completed_if_ready(conn, &session_id)
        .map_err(|e| format!("DB error: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn submit_quiz_answers(
    state: tauri::State<'_, AppState>,
    session_id: String,
    concept_slug: String,
    submissions: Vec<serde_json::Value>,
) -> Result<(), String> {
    let state = state.inner();
    let db = state
        .db
        .lock()
        .map_err(|_| "Failed to lock database".to_string())?;
    let conn = &db.query_conn;
    let concept_id = crate::db::queries::get_concept_id_by_slug(conn, &concept_slug)
        .map_err(|e| format!("DB error: {}", e))?
        .ok_or_else(|| format!("Unknown concept slug: {}", concept_slug))?;

    for sub in &submissions {
        conn.execute(
            "INSERT INTO quiz_submissions (id, session_id, concept_id, question_index, quiz_json, user_answer, result, score)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                uuid::Uuid::new_v4().to_string(),
                session_id.as_str(),
                concept_id.as_str(),
                sub["question_index"].as_i64().unwrap_or(0),
                sub["quiz_json"].as_str().unwrap_or(""),
                sub["user_answer"].as_str().unwrap_or(""),
                sub["result"].as_str().unwrap_or(""),
                sub["score"].as_f64(),
            ],
        )
        .map_err(|e| format!("DB error: {}", e))?;
    }

    crate::db::queries::mark_session_completed_if_ready(conn, &session_id)
        .map_err(|e| format!("DB error: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn complete_session(
    state: tauri::State<'_, AppState>,
    session_id: String,
    status: String,
) -> Result<(), String> {
    let state = state.inner();
    state
        .db
        .lock()
        .map_err(|_| "Failed to lock database".to_string())?
        .query_conn
        .execute(
            "UPDATE sessions SET status=?1, ended_at=datetime('now') WHERE id=?2",
            rusqlite::params![status, session_id.as_str()],
        )
        .map_err(|e| format!("DB error: {}", e))?;

    let _ = state
        .cancel_tokens
        .lock()
        .map_err(|_| "Failed to lock cancellation state".to_string())?
        .remove(&session_id);

    Ok(())
}
