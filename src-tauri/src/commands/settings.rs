use tauri::State;
use crate::AppState;

#[tauri::command]
pub async fn store_api_key(
    state: State<'_, AppState>,
    provider: String,
    key: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| format!("Lock error: {}", e))?;
    // Store provider marker in settings table, actual key via env
    crate::db::queries::save_setting(&db.query_conn, &format!("api_key_{}", provider), "configured")
        .map_err(|e| format!("DB error: {}", e))?;

    // Set as env var for the current session (matching existing V1 pattern)
    let env_name = match provider.as_str() {
        "anthropic" => "ANTHROPIC_API_KEY",
        "openai" => "OPENAI_API_KEY",
        "deepseek" => "DEEPSEEK_API_KEY",
        "qwen" => "QWEN_API_KEY",
        "glm" => "GLM_API_KEY",
        _ => return Err(format!("Unknown provider: {}", provider)),
    };
    std::env::set_var(env_name, &key);
    Ok(())
}

#[tauri::command]
pub async fn get_api_keys(
    state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, String> {
    let db = state.db.lock().map_err(|e| format!("Lock error: {}", e))?;
    let providers = ["anthropic", "openai", "deepseek", "qwen", "glm"];
    let mut result = Vec::new();
    for p in &providers {
        let configured = crate::db::queries::get_setting(&db.query_conn, &format!("api_key_{}", p))
            .map(|v| v.is_some())
            .unwrap_or(false);
        result.push(serde_json::json!({"provider": p, "configured": configured}));
    }
    Ok(result)
}

#[tauri::command]
pub async fn delete_api_key(
    state: State<'_, AppState>,
    provider: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| format!("Lock error: {}", e))?;
    crate::db::queries::save_setting(&db.query_conn, &format!("api_key_{}", provider), "")
        .map_err(|e| format!("DB error: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn validate_api_key(
    provider: String,
    key: String,
) -> Result<bool, String> {
    match provider.as_str() {
        "anthropic" => {
            let client = reqwest::Client::new();
            let resp = client.get("https://api.anthropic.com/v1/models")
                .header("x-api-key", &key)
                .header("anthropic-version", "2023-06-01")
                .send().await.map_err(|e| format!("Network error: {}", e))?;
            Ok(resp.status().is_success())
        }
        // OpenAI-compatible providers use the same pattern with Bearer auth
        _ => {
            let client = reqwest::Client::new();
            let resp = client.get("https://api.openai.com/v1/models")
                .header("Authorization", format!("Bearer {}", key))
                .send().await.map_err(|e| format!("Network error: {}", e))?;
            Ok(resp.status().is_success())
        }
    }
}

#[tauri::command]
pub async fn save_settings(
    state: State<'_, AppState>,
    key: String,
    value: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| format!("Lock error: {}", e))?;
    crate::db::queries::save_setting(&db.query_conn, &key, &value)
        .map_err(|e| format!("DB error: {}", e))
}

#[tauri::command]
pub async fn get_settings(
    state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, String> {
    let db = state.db.lock().map_err(|e| format!("Lock error: {}", e))?;
    // Read specific common settings
    let mut result = Vec::new();
    for key in &["model", "theme", "provider"] {
        if let Ok(Some(val)) = crate::db::queries::get_setting(&db.query_conn, key) {
            result.push(serde_json::json!({"key": key, "value": val}));
        }
    }
    Ok(result)
}
