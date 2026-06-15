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

fn resolve_api_key(provider: &str) -> Result<String, String> {
    let api_key_env = match provider {
        "anthropic" => "ANTHROPIC_API_KEY",
        _ => return Err(format!("Unsupported provider: {}", provider)),
    };

    std::env::var(api_key_env)
        .map_err(|_| format!("API Key not configured for provider: {}", provider))
}

async fn send_json_prompt(
    api_key: &str,
    model: &str,
    system_prompt: &str,
    prompt: &str,
) -> Result<Value, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .connect_timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let body = serde_json::json!({
        "model": model,
        "max_tokens": 4096,
        "system": system_prompt,
        "messages": [
            {"role": "user", "content": prompt}
        ]
    });

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
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

fn extract_text_content(resp_body: &Value) -> Result<String, String> {
    let content = resp_body["content"]
        .as_array()
        .and_then(|blocks| {
            blocks.iter().find_map(|block| {
                block["type"].as_str().and_then(|kind| {
                    if kind == "text" {
                        block["text"].as_str().map(|text| text.to_string())
                    } else {
                        None
                    }
                })
            })
        })
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
    let api_key = resolve_api_key(&provider)?;
    let model = if model.trim().is_empty() {
        "claude-sonnet-4-20250514".to_string()
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
        "programming" => "编程类",
        "non_programming" => "非编程类",
        _ => "通用主题",
    };

    let prompt = format!(
        r#"你是一位经验丰富的课程设计师。请为以下学习主题生成结构化知识图谱。

## 学习主题
- 名称：{topic_name}
- 类型：{topic_type_label}
- 深度：{depth}

## 要求
- 生成恰好 {max_domains} 个知识域
- 每个知识域包含恰好 {max_concepts_per_domain} 个核心概念
- 每个概念都需要提供：name、slug、description、prerequisites、difficulty、estimated_minutes
- 概念顺序要符合零基础用户的学习路径

## 输出格式
只输出 JSON，不要输出解释：
```json
{{
  "domains": [
    {{
      "name": "知识域名称",
      "slug": "domain-slug",
      "concepts": [
        {{
          "name": "概念名称",
          "slug": "concept-slug",
          "description": "一句话说明",
          "prerequisites": [],
          "difficulty": "beginner",
          "estimated_minutes": 15
        }}
      ]
    }}
  ]
}}
```"#,
        topic_name = topic_name,
        topic_type_label = topic_type_label,
        depth = depth,
        max_domains = max_domains,
        max_concepts_per_domain = max_concepts_per_domain,
    );

    let response = send_json_prompt(
        &api_key,
        &model,
        "你是知识图谱生成专家。只输出合法 JSON，不要输出额外说明。",
        &prompt,
    )
    .await?;

    let raw: KnowledgeMapRaw = serde_json::from_str(&extract_text_content(&response)?)
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
