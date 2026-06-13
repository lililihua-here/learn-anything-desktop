use crate::db::queries;
use crate::topic::{KnowledgeMapOutput, KnowledgeMapRaw};
use crate::AppState;
use serde_json::Value;
use tauri::{AppHandle, Emitter};

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

    let (max_domains, max_concepts_per_domain): (usize, usize) = match depth.as_str() {
        "overview" => (4, 4),
        "systematic" => (7, 8),
        "deep" => (10, 12),
        _ => return Err(format!("Unknown depth: {}", depth)),
    };

    let topic_type_label = match topic_type.as_str() {
        "programming" => "编程",
        "non_programming" => "非编程",
        _ => "通用",
    };

    let prompt = format!(
        r#"你是一位经验丰富的课程设计师。请为以下学习主题生成一张结构化的知识图谱。

## 学习主题
- 名称：{topic_name}
- 类型：{topic_type_label}
- 深度：{depth}

## 要求
- 生成恰好 {max_domains} 个知识域（domains）
- 每个知识域包含恰好 {max_concepts_per_domain} 个核心概念（concepts）
- 每个概念需要：名称、slug（英文kebab-case）、一句话描述、前置依赖概念列表、难度（beginner/intermediate/advanced）、预估学习时间（分钟）

## 输出格式
请只输出 JSON，不要添加任何解释文字：
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
          "description": "一句话描述",
          "prerequisites": [],
          "difficulty": "beginner",
          "estimated_minutes": 15
        }}
      ]
    }}
  ]
}}
```

重要：请确保 domains 数组恰好包含 {max_domains} 个元素，每个 domain 的 concepts 数组恰好包含 {max_concepts_per_domain} 个元素。
"#,
        topic_name = topic_name,
        topic_type_label = topic_type_label,
        depth = depth,
        max_domains = max_domains,
        max_concepts_per_domain = max_concepts_per_domain,
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .connect_timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let body = serde_json::json!({
        "model": model,
        "max_tokens": 4096,
        "system": "你是一个知识图谱生成专家。只输出合法的 JSON，不要添加任何解释。",
        "messages": [
            {"role": "user", "content": prompt}
        ]
    });

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &api_key)
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

    let resp_body: Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse API response: {}", e))?;

    let content = resp_body["content"]
        .as_array()
        .and_then(|blocks| {
            blocks.iter().find_map(|block| {
                block["type"].as_str().and_then(|t| {
                    if t == "text" {
                        block["text"].as_str().map(|s| s.to_string())
                    } else {
                        None
                    }
                })
            })
        })
        .ok_or_else(|| "No text content in API response".to_string())?;

    // Strip markdown code fences if present
    let json_str = content.trim();
    let json_str = if json_str.starts_with("```json") {
        let inner = &json_str[7..];
        if let Some(end) = inner.rfind("```") {
            inner[..end].trim()
        } else {
            inner.trim()
        }
    } else if json_str.starts_with("```") {
        let inner = &json_str[3..];
        if let Some(end) = inner.rfind("```") {
            inner[..end].trim()
        } else {
            inner.trim()
        }
    } else {
        json_str
    };

    let raw: KnowledgeMapRaw =
        serde_json::from_str(json_str).map_err(|e| format!("Failed to parse knowledge map JSON: {}", e))?;

    let output = KnowledgeMapOutput {
        topic_name: topic_name.clone(),
        topic_slug: topic_slug.clone(),
        topic_type: topic_type.clone(),
        depth: depth.clone(),
        domains: raw.domains,
    };

    // Persist to DB
    {
        let db = state
            .db
            .lock()
            .map_err(|_| "Failed to lock database".to_string())?;
        let conn = &db.query_conn;

        let topic_id = uuid::Uuid::new_v4().to_string();
        queries::upsert_topic(conn, &topic_id, &topic_name, &topic_slug, &topic_type)
            .map_err(|e| format!("DB error (upsert_topic): {}", e))?;

        for (di, domain) in output.domains.iter().enumerate() {
            let domain_id = uuid::Uuid::new_v4().to_string();
            // Delete existing domains for this topic so we do a clean replace
            conn.execute(
                "DELETE FROM domains WHERE topic_id=?1 AND slug=?2",
                rusqlite::params![topic_id, domain.slug],
            )
            .map_err(|e| format!("DB error (delete old domain): {}", e))?;
            queries::insert_domain(
                conn,
                &domain_id,
                &topic_id,
                &domain.name,
                &domain.slug,
                di as i64,
            )
            .map_err(|e| format!("DB error (insert_domain): {}", e))?;

            for (ci, concept) in domain.concepts.iter().enumerate() {
                let concept_id = queries::ensure_concept(conn, &concept.name, &concept.slug)
                    .map_err(|e| format!("DB error (ensure_concept): {}", e))?;

                // Update domain linkage and sort order
                queries::update_concept_domain(conn, &concept.slug, &domain_id)
                    .map_err(|e| format!("DB error (update_concept_domain): {}", e))?;

                conn.execute(
                    "UPDATE concepts SET sort_order=?1 WHERE id=?2",
                    rusqlite::params![ci as i64, concept_id],
                )
                .map_err(|e| format!("DB error (update sort_order): {}", e))?;
            }
        }
    }

    // Emit event
    let _ = app.emit("knowledge-map-updated", &output);

    Ok(output)
}
