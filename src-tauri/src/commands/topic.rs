use crate::db::queries;
use crate::db::queries::TreeNode;
use crate::topic::{KnowledgeMapOutput, KnowledgeMapRaw};
use crate::AppState;
use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Serialize, Clone)]
struct KnowledgeMapUpdatedPayload {
    topic_slug: String,
    changed_concept_slug: Option<String>,
    reason: String,
}

async fn send_json_prompt(
    provider: &str,
    api_key: &str,
    model: &str,
    system_prompt: &str,
    prompt: &str,
) -> Result<Value, String> {
    let adapter = crate::providers::create_provider_adapter(provider)?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .connect_timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let payload = adapter.build_non_streaming_request(model, system_prompt, prompt);
    let (auth_name, auth_value) = adapter.auth_header(api_key);

    let mut request = client
        .post(&payload.endpoint)
        .header(auth_name, auth_value)
        .json(&payload.body);

    for (header_name, header_value) in &payload.headers {
        request = request.header(header_name, header_value);
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("API request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("API error {}: {}", status, text));
    }

    response
        .json()
        .await
        .map_err(|e| format!("Failed to parse API response: {}", e))
}

fn extract_text_content(provider: &str, resp_body: &Value) -> Result<String, String> {
    let adapter = crate::providers::create_provider_adapter(provider)?;
    let content = adapter
        .parse_text_response(resp_body)
        .ok_or_else(|| "No text content in API response".to_string())?;

    let json_str = content.trim();
    let json_str = if let Some(inner) = json_str.strip_prefix("```json") {
        inner.strip_suffix("```").unwrap_or(inner).trim()
    } else if let Some(inner) = json_str.strip_prefix("```") {
        inner.strip_suffix("```").unwrap_or(inner).trim()
    } else {
        json_str
    };

    Ok(json_str.to_string())
}

fn persist_knowledge_map_internal(
    conn: &rusqlite::Connection,
    knowledge_map: &KnowledgeMapOutput,
) -> Result<(), String> {
    let topic = queries::get_topic_by_slug(conn, &knowledge_map.topic_slug)
        .map_err(|e| format!("DB error (get_topic_by_slug): {}", e))?;
    let topic_id = topic
        .map(|existing| existing.id)
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    queries::upsert_topic(
        conn,
        &topic_id,
        &knowledge_map.topic_name,
        &knowledge_map.topic_slug,
        &knowledge_map.topic_type,
    )
    .map_err(|e| format!("DB error (upsert_topic): {}", e))?;

    conn.execute(
        "UPDATE concepts SET domain_id=NULL WHERE domain_id IN (SELECT id FROM domains WHERE topic_id=?1)",
        rusqlite::params![topic_id],
    )
    .map_err(|e| format!("DB error (clear previous domain links): {}", e))?;

    conn.execute(
        "DELETE FROM domains WHERE topic_id=?1",
        rusqlite::params![topic_id],
    )
    .map_err(|e| format!("DB error (delete previous domains): {}", e))?;

    for (domain_index, domain) in knowledge_map.domains.iter().enumerate() {
        let domain_id = uuid::Uuid::new_v4().to_string();
        queries::insert_domain(
            conn,
            &domain_id,
            &topic_id,
            &domain.name,
            &domain.slug,
            domain_index as i64,
        )
        .map_err(|e| format!("DB error (insert_domain): {}", e))?;

        for (concept_index, concept) in domain.concepts.iter().enumerate() {
            let concept_id = queries::ensure_concept(conn, &concept.name, &concept.slug)
                .map_err(|e| format!("DB error (ensure_concept): {}", e))?;

            queries::update_concept_domain(conn, &concept.slug, &domain_id)
                .map_err(|e| format!("DB error (update_concept_domain): {}", e))?;

            conn.execute(
                "UPDATE concepts SET sort_order=?1 WHERE id=?2",
                rusqlite::params![concept_index as i64, concept_id],
            )
            .map_err(|e| format!("DB error (update sort_order): {}", e))?;
        }
    }

    Ok(())
}

fn emit_map_updated(app: &AppHandle, topic_slug: &str, reason: &str) {
    let payload = KnowledgeMapUpdatedPayload {
        topic_slug: topic_slug.to_string(),
        changed_concept_slug: None,
        reason: reason.to_string(),
    };
    let _ = app.emit("knowledge-map-updated", payload);
}

fn default_model_for_provider(provider: &str) -> &'static str {
    match provider {
        "openai" => "gpt-4o",
        "deepseek" => "deepseek-chat",
        "qwen" => "qwen-max",
        _ => "claude-sonnet-4-20250514",
    }
}

#[tauri::command]
pub async fn generate_knowledge_map(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    provider: String,
    model: String,
    topic_name: String,
    topic_slug: String,
    topic_type: String,
    depth: String,
) -> Result<KnowledgeMapOutput, String> {
    let api_key = crate::commands::settings::get_api_key_for_provider(&provider)?;
    let model = if model.trim().is_empty() {
        default_model_for_provider(&provider).to_string()
    } else {
        model
    };

    let (max_domains, max_concepts_per_domain): (usize, usize) = match depth.as_str() {
        "overview" => (4, 4),
        "systematic" => (7, 8),
        "deep" => (10, 12),
        _ => return Err(format!("Unknown depth: {}", depth)),
    };

    let topic_type_label = match topic_type.as_str() {
        "programming" => "programming",
        "non_programming" => "non-programming",
        _ => "general",
    };

    let system_prompt = "You design structured learning maps. Reply with valid JSON only. No markdown, no prose outside JSON.";
    let prompt = format!(
        r#"Generate a structured knowledge map for the following learning topic.

Topic name: {topic_name}
Topic type: {topic_type_label}
Requested depth: {depth}

Requirements:
- Produce exactly {max_domains} domains.
- Each domain must contain exactly {max_concepts_per_domain} core concepts.
- Each concept must include: name, slug, description, prerequisites, difficulty, estimated_minutes.
- Order the concepts for a true beginner.
- Keep domain and concept names concrete and non-redundant.

Return JSON only in this shape:
{{
  "domains": [
    {{
      "name": "Domain name",
      "slug": "domain-slug",
      "concepts": [
        {{
          "name": "Concept name",
          "slug": "concept-slug",
          "description": "One-sentence explanation",
          "prerequisites": [],
          "difficulty": "beginner",
          "estimated_minutes": 15
        }}
      ]
    }}
  ]
}}"#,
        topic_name = topic_name,
        topic_type_label = topic_type_label,
        depth = depth,
        max_domains = max_domains,
        max_concepts_per_domain = max_concepts_per_domain,
    );

    let response = send_json_prompt(&provider, &api_key, &model, system_prompt, &prompt).await?;
    let raw: KnowledgeMapRaw = serde_json::from_str(&extract_text_content(&provider, &response)?)
        .map_err(|e| format!("Failed to parse knowledge map JSON: {}", e))?;

    let output = KnowledgeMapOutput {
        topic_name: topic_name.clone(),
        topic_slug: topic_slug.clone(),
        topic_type,
        depth,
        domains: raw.domains,
    };

    {
        let db = state
            .db
            .lock()
            .map_err(|_| "Failed to lock database".to_string())?;
        persist_knowledge_map_internal(&db.query_conn, &output)?;
    }

    emit_map_updated(&app, &topic_slug, "route_update");
    Ok(output)
}

#[tauri::command]
pub async fn persist_knowledge_map(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    knowledge_map: KnowledgeMapOutput,
) -> Result<(), String> {
    {
        let db = state
            .db
            .lock()
            .map_err(|_| "Failed to lock database".to_string())?;
        persist_knowledge_map_internal(&db.query_conn, &knowledge_map)?;
    }

    emit_map_updated(&app, &knowledge_map.topic_slug, "route_update");
    Ok(())
}

#[tauri::command]
pub async fn get_concept_tree(
    state: tauri::State<'_, AppState>,
    topic_slug: String,
) -> Result<TreeNode, String> {
    let db = state
        .db
        .lock()
        .map_err(|_| "Failed to lock database".to_string())?;
    let conn = &db.query_conn;
    queries::get_concept_tree(conn, &topic_slug)
        .map_err(|e| format!("DB error (get_concept_tree): {}", e))
}
