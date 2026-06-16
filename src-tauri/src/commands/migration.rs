use crate::db::queries;
use crate::AppState;
use rusqlite::Connection;
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::io::{Read, Write};
use tauri::State;

// ── helpers: read all rows from a table into Vec<Value> ──────────────────────

fn table_to_json(conn: &Connection, table: &str) -> Result<Vec<Value>, String> {
    let sql = format!("SELECT * FROM {}", table);
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let col_names: Vec<String> = stmt.column_names().iter().map(|c| c.to_string()).collect();

    let rows = stmt
        .query_map([], |row| {
            let mut map = serde_json::Map::new();
            for (i, col) in col_names.iter().enumerate() {
                let val: rusqlite::Result<String> = row.get(i);
                match val {
                    Ok(v) => {
                        map.insert(col.clone(), Value::String(v));
                    }
                    Err(_) => {
                        // Try integer
                        let val_i: rusqlite::Result<i64> = row.get(i);
                        match val_i {
                            Ok(v) => {
                                map.insert(col.clone(), Value::Number(v.into()));
                            }
                            Err(_) => {
                                // Try float
                                let val_f: rusqlite::Result<f64> = row.get(i);
                                match val_f {
                                    Ok(v) => {
                                        if let Some(n) = serde_json::Number::from_f64(v) {
                                            map.insert(col.clone(), Value::Number(n));
                                        } else {
                                            map.insert(col.clone(), Value::Null);
                                        }
                                    }
                                    Err(_) => {
                                        map.insert(col.clone(), Value::Null);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Ok(Value::Object(map))
        })
        .map_err(|e| e.to_string())?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

// ── Build v1-compatible state.json (hierarchical) ────────────────────────────

fn build_v1_state(conn: &Connection) -> Result<Value, String> {
    let topics = queries::get_all_topics(conn).map_err(|e| e.to_string())?;
    let mut state_topics: Vec<Value> = Vec::new();

    for topic in topics {
        let domains = queries::get_domains_by_topic(conn, &topic.id).map_err(|e| e.to_string())?;
        let mut state_domains: Vec<Value> = Vec::new();

        for domain in domains {
            let concepts = get_concepts_by_domain(conn, &domain.id)?;
            state_domains.push(serde_json::json!({
                "name": domain.name,
                "slug": domain.slug,
                "concepts": concepts,
            }));
        }

        state_topics.push(serde_json::json!({
            "name": topic.name,
            "slug": topic.slug,
            "type": topic.topic_type,
            "domains": state_domains,
        }));
    }

    Ok(serde_json::json!({
        "version": 1,
        "topics": state_topics,
    }))
}

fn get_concepts_by_domain(conn: &Connection, domain_id: &str) -> Result<Vec<Value>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT name, slug, status, confidence, practice_count, explain_count,
                    last_explained, last_practiced, sort_order, created_at
             FROM concepts WHERE domain_id=?1 ORDER BY sort_order",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(rusqlite::params![domain_id], |row| {
            Ok(serde_json::json!({
                "name": row.get::<_, String>(0)?,
                "slug": row.get::<_, String>(1)?,
                "status": row.get::<_, String>(2)?,
                "confidence": row.get::<_, f64>(3)?,
                "practice_count": row.get::<_, i64>(4)?,
                "explain_count": row.get::<_, i64>(5)?,
                "last_explained": row.get::<_, Option<String>>(6)?,
                "last_practiced": row.get::<_, Option<String>>(7)?,
                "sort_order": row.get::<_, i64>(8)?,
                "created_at": row.get::<_, String>(9)?,
            }))
        })
        .map_err(|e| e.to_string())?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

// ── Build knowledge-map.md from concept tree ─────────────────────────────────

fn build_knowledge_map_md(conn: &Connection) -> Result<String, String> {
    let topics = queries::get_all_topics(conn).map_err(|e| e.to_string())?;
    let mut md = String::from("# Knowledge Map\n\n");

    for topic in topics {
        md.push_str(&format!("## Topic: {}\n\n", topic.name));
        let domains = queries::get_domains_by_topic(conn, &topic.id).map_err(|e| e.to_string())?;

        for domain in &domains {
            md.push_str(&format!("### {}\n\n", domain.name));
            let concepts = get_concepts_by_domain(conn, &domain.id)?;

            for (i, concept) in concepts.iter().enumerate() {
                let name = concept["name"].as_str().unwrap_or("?");
                let status = concept["status"].as_str().unwrap_or("unexplored");
                let confidence = concept["confidence"].as_f64().unwrap_or(0.0);
                md.push_str(&format!(
                    "{}. **{}** (status: `{}`, confidence: {:.0}%)\n",
                    i + 1,
                    name,
                    status,
                    confidence * 100.0
                ));
            }
            md.push('\n');
        }
        md.push('\n');
    }

    Ok(md)
}

// ── Export ───────────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct Metadata {
    app_version: String,
    exported_at: String,
    table_counts: HashMap<String, usize>,
}

#[tauri::command]
pub async fn export_state(state: State<'_, AppState>, format: String) -> Result<String, String> {
    if format != "zip" {
        return Err(format!("Unsupported export format: {}", format));
    }

    let db = state.db.lock().map_err(|e| format!("Lock error: {}", e))?;
    let conn = &db.query_conn;

    // Tables to export (exclude API-key settings)
    let tables = [
        "topics",
        "domains",
        "concepts",
        "sessions",
        "messages",
        "cards",
        "card_queue",
        "quiz_submissions",
        "achievements",
        "learning_streaks",
        "projects",
        "settings",
    ];

    // Build database_dump.json
    let mut dump = serde_json::Map::new();
    let mut table_counts: HashMap<String, usize> = HashMap::new();

    for table in &tables {
        let rows = table_to_json(conn, table)?;
        table_counts.insert(table.to_string(), rows.len());
        // Filter out API key settings
        if table == &"settings" {
            let filtered: Vec<Value> = rows
                .into_iter()
                .filter(|row| {
                    let key = row["key"].as_str().unwrap_or("");
                    !key.starts_with("api_key_")
                })
                .collect();
            dump.insert(table.to_string(), Value::Array(filtered));
        } else {
            dump.insert(table.to_string(), Value::Array(rows));
        }
    }

    let database_dump_json = serde_json::to_string_pretty(&Value::Object(dump))
        .map_err(|e| format!("JSON error: {}", e))?;

    // Build state.json (v1 compatible)
    let state_json = build_v1_state(conn)?;
    let state_json_str =
        serde_json::to_string_pretty(&state_json).map_err(|e| format!("JSON error: {}", e))?;

    // Build knowledge-map.md
    let km_md = build_knowledge_map_md(conn)?;

    // Build metadata.json
    let metadata = Metadata {
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        exported_at: chrono::Utc::now().to_rfc3339(),
        table_counts,
    };
    let metadata_json =
        serde_json::to_string_pretty(&metadata).map_err(|e| format!("JSON error: {}", e))?;

    // Create zip in memory
    let mut zip_buf = Vec::new();
    {
        let mut zip_writer = zip::ZipWriter::new(std::io::Cursor::new(&mut zip_buf));
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        zip_writer
            .start_file("state.json", options)
            .map_err(|e| e.to_string())?;
        zip_writer
            .write_all(state_json_str.as_bytes())
            .map_err(|e| e.to_string())?;

        zip_writer
            .start_file("database_dump.json", options)
            .map_err(|e| e.to_string())?;
        zip_writer
            .write_all(database_dump_json.as_bytes())
            .map_err(|e| e.to_string())?;

        zip_writer
            .start_file("knowledge-map.md", options)
            .map_err(|e| e.to_string())?;
        zip_writer
            .write_all(km_md.as_bytes())
            .map_err(|e| e.to_string())?;

        zip_writer
            .start_file("metadata.json", options)
            .map_err(|e| e.to_string())?;
        zip_writer
            .write_all(metadata_json.as_bytes())
            .map_err(|e| e.to_string())?;

        zip_writer.finish().map_err(|e| e.to_string())?;
    }

    // Determine downloads directory
    let downloads_dir =
        dirs_next().ok_or_else(|| "Cannot determine downloads directory".to_string())?;

    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
    let filename = format!("learn-anything-backup_{}.zip", timestamp);
    let output_path = downloads_dir.join(&filename);

    std::fs::write(&output_path, &zip_buf).map_err(|e| format!("Failed to write zip: {}", e))?;

    // Store last export timestamp in settings
    let now = chrono::Utc::now().to_rfc3339();
    queries::save_setting(conn, "last_export_at", &now)
        .map_err(|e| format!("DB error (save_setting): {}", e))?;

    Ok(output_path.display().to_string())
}

fn dirs_next() -> Option<std::path::PathBuf> {
    #[cfg(target_os = "windows")]
    {
        std::env::var("USERPROFILE")
            .ok()
            .map(|p| std::path::PathBuf::from(p).join("Downloads"))
    }
    #[cfg(not(target_os = "windows"))]
    {
        dirs::home_dir().map(|p| p.join("Downloads")) // fallback for non-Windows
    }
}

// ── Import ───────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn import_state(state: State<'_, AppState>, path: String) -> Result<String, String> {
    let zip_bytes = std::fs::read(&path).map_err(|e| format!("Failed to read file: {}", e))?;
    import_state_from_bytes(state, zip_bytes)
}

#[tauri::command]
pub async fn import_state_bytes(
    state: State<'_, AppState>,
    bytes: Vec<u8>,
) -> Result<String, String> {
    import_state_from_bytes(state, bytes)
}

fn import_state_from_bytes(
    state: State<'_, AppState>,
    zip_bytes: Vec<u8>,
) -> Result<String, String> {
    let cursor = std::io::Cursor::new(zip_bytes);
    let mut archive = zip::ZipArchive::new(cursor).map_err(|e| format!("Invalid zip: {}", e))?;

    // Extract database_dump.json
    let mut db_dump_str = String::new();
    {
        let mut file = archive
            .by_name("database_dump.json")
            .map_err(|_| "database_dump.json not found in archive".to_string())?;
        file.read_to_string(&mut db_dump_str)
            .map_err(|e| format!("Failed to read database_dump.json: {}", e))?;
    }

    let dump: Value =
        serde_json::from_str(&db_dump_str).map_err(|e| format!("Invalid JSON: {}", e))?;

    let db = state.db.lock().map_err(|e| format!("Lock error: {}", e))?;
    let conn = &db.query_conn;

    // Turn off foreign keys during import
    conn.execute_batch("PRAGMA foreign_keys=OFF;")
        .map_err(|e| format!("DB error: {}", e))?;

    let mut summary_parts: Vec<String> = Vec::new();

    // Import in FK-safe order, merging by business key
    // Each helper returns count of new rows inserted

    // 1. topics (business key: slug)
    let count = import_topics(conn, &dump)?;
    if count > 0 {
        summary_parts.push(format!("{} topics", count));
    }

    // 2. domains (business key: topic_id + slug)
    let count = import_domains(conn, &dump)?;
    if count > 0 {
        summary_parts.push(format!("{} domains", count));
    }

    // 3. concepts (business key: slug)
    let count = import_concepts(conn, &dump)?;
    if count > 0 {
        summary_parts.push(format!("{} concepts", count));
    }

    // 4. sessions (business key: concept_id + started_at)
    let count = import_sessions(conn, &dump)?;
    if count > 0 {
        summary_parts.push(format!("{} sessions", count));
    }

    // 5. messages (business key: session_id + role + content + created_at)
    let count = import_messages(conn, &dump)?;
    if count > 0 {
        summary_parts.push(format!("{} messages", count));
    }

    // 6. cards (business key: concept_id + slug + session_id)
    let count = import_cards(conn, &dump)?;
    if count > 0 {
        summary_parts.push(format!("{} cards", count));
    }

    // 7. card_queue
    let count = import_card_queue(conn, &dump)?;
    if count > 0 {
        summary_parts.push(format!("{} card_queue items", count));
    }

    // 8. quiz_submissions
    let count = import_quiz_submissions(conn, &dump)?;
    if count > 0 {
        summary_parts.push(format!("{} quiz submissions", count));
    }

    // 9. projects (business key: name + source_type + source_ref)
    let count = import_projects(conn, &dump)?;
    if count > 0 {
        summary_parts.push(format!("{} projects", count));
    }

    // 10. achievements (business key: name)
    let count = import_achievements(conn, &dump)?;
    if count > 0 {
        summary_parts.push(format!("{} achievements", count));
    }

    // 11. streaks
    let count = import_streaks(conn, &dump)?;
    if count > 0 {
        summary_parts.push(format!("{} streaks", count));
    }

    // 12. settings (business key: key)
    let count = import_settings(conn, &dump)?;
    if count > 0 {
        summary_parts.push(format!("{} settings", count));
    }

    // Re-enable foreign keys and verify the merged graph is still valid.
    conn.execute_batch("PRAGMA foreign_keys=ON;")
        .map_err(|e| format!("DB error: {}", e))?;
    let violations = conn
        .prepare("PRAGMA foreign_key_check")
        .and_then(|mut stmt| {
            stmt.query_map([], |row| {
                let table: String = row.get(0)?;
                let rowid: i64 = row.get(1)?;
                let parent: String = row.get(2)?;
                Ok(format!("{} row {} -> {}", table, rowid, parent))
            })
            .map(|rows| rows.filter_map(|row| row.ok()).collect::<Vec<String>>())
        })
        .map_err(|e| format!("DB error: {}", e))?;

    if !violations.is_empty() {
        return Err(format!(
            "Import created foreign-key violations: {}",
            violations.join("; ")
        ));
    }

    let summary = if summary_parts.is_empty() {
        "Imported 0 items (all data already exists)".to_string()
    } else {
        format!("Imported {}", summary_parts.join(", "))
    };

    Ok(summary)
}

// ── Per-table import helpers ─────────────────────────────────────────────────

fn get_array(dump: &Value, table: &str) -> Result<Vec<Value>, String> {
    Ok(dump[table].as_array().cloned().unwrap_or_default())
}

fn find_row_by_id<'a>(dump: &'a Value, table: &str, id: &str) -> Option<&'a Value> {
    dump[table]
        .as_array()?
        .iter()
        .find(|row| row["id"].as_str() == Some(id))
}

fn resolve_local_topic_id(
    conn: &Connection,
    dump: &Value,
    imported_topic_id: &str,
) -> Option<String> {
    let slug = find_row_by_id(dump, "topics", imported_topic_id)?["slug"].as_str()?;
    conn.query_row(
        "SELECT id FROM topics WHERE slug=?1",
        rusqlite::params![slug],
        |row| row.get(0),
    )
    .ok()
}

fn resolve_local_domain_id(
    conn: &Connection,
    dump: &Value,
    imported_domain_id: &str,
) -> Option<String> {
    let row = find_row_by_id(dump, "domains", imported_domain_id)?;
    let slug = row["slug"].as_str()?;
    let imported_topic_id = row["topic_id"].as_str()?;
    let local_topic_id = resolve_local_topic_id(conn, dump, imported_topic_id)?;
    conn.query_row(
        "SELECT id FROM domains WHERE topic_id=?1 AND slug=?2",
        rusqlite::params![local_topic_id, slug],
        |db_row| db_row.get(0),
    )
    .ok()
}

fn resolve_local_concept_id(
    conn: &Connection,
    dump: &Value,
    imported_concept_id: &str,
) -> Option<String> {
    let slug = find_row_by_id(dump, "concepts", imported_concept_id)?["slug"].as_str()?;
    conn.query_row(
        "SELECT id FROM concepts WHERE slug=?1",
        rusqlite::params![slug],
        |row| row.get(0),
    )
    .ok()
}

fn resolve_local_session_id(
    conn: &Connection,
    dump: &Value,
    imported_session_id: &str,
) -> Option<String> {
    let row = find_row_by_id(dump, "sessions", imported_session_id)?;
    let imported_concept_id = row["concept_id"].as_str()?;
    let started_at = row["started_at"].as_str()?;
    let local_concept_id = resolve_local_concept_id(conn, dump, imported_concept_id)?;
    conn.query_row(
        "SELECT id FROM sessions WHERE concept_id=?1 AND started_at=?2",
        rusqlite::params![local_concept_id, started_at],
        |db_row| db_row.get(0),
    )
    .ok()
}

fn resolve_local_card_id(
    conn: &Connection,
    dump: &Value,
    imported_card_id: &str,
) -> Option<String> {
    let row = find_row_by_id(dump, "cards", imported_card_id)?;
    let imported_concept_id = row["concept_id"].as_str()?;
    let local_concept_id = resolve_local_concept_id(conn, dump, imported_concept_id)?;
    let slug = row["slug"].as_str().unwrap_or("");
    let imported_session_id = row["session_id"].as_str().unwrap_or("");
    let local_session_id = if imported_session_id.is_empty() {
        None
    } else {
        resolve_local_session_id(conn, dump, imported_session_id)
    };

    match local_session_id {
        Some(session_id) => conn
            .query_row(
                "SELECT id FROM cards WHERE concept_id=?1 AND slug=?2 AND session_id=?3",
                rusqlite::params![local_concept_id, slug, session_id],
                |db_row| db_row.get(0),
            )
            .ok(),
        None => conn
            .query_row(
                "SELECT id FROM cards WHERE concept_id=?1 AND slug=?2 AND session_id IS NULL",
                rusqlite::params![local_concept_id, slug],
                |db_row| db_row.get(0),
            )
            .ok(),
    }
}

fn import_topics(conn: &Connection, dump: &Value) -> Result<usize, String> {
    let rows = get_array(dump, "topics")?;
    let mut count = 0;
    for row in &rows {
        let id = row["id"].as_str().unwrap_or("");
        let name = row["name"].as_str().unwrap_or("");
        let slug = row["slug"].as_str().unwrap_or("");
        let topic_type = row["type"].as_str().unwrap_or("general");
        let created_at = row["created_at"].as_str().unwrap_or("");

        if id.is_empty() || slug.is_empty() {
            continue;
        }

        let existing_id: Option<String> = conn
            .query_row(
                "SELECT id FROM topics WHERE slug=?1",
                rusqlite::params![slug],
                |r| r.get(0),
            )
            .ok();

        if existing_id.is_none() {
            conn.execute(
                "INSERT INTO topics (id, name, slug, \"type\", created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params![id, name, slug, topic_type, created_at],
            )
            .map_err(|e| format!("DB error (topics): {}", e))?;
            count += 1;
        }
    }
    Ok(count)
}

fn import_domains(conn: &Connection, dump: &Value) -> Result<usize, String> {
    let rows = get_array(dump, "domains")?;
    let mut count = 0;
    for row in &rows {
        let id = row["id"].as_str().unwrap_or("");
        let imported_topic_id = row["topic_id"].as_str().unwrap_or("");
        let name = row["name"].as_str().unwrap_or("");
        let slug = row["slug"].as_str().unwrap_or("");
        let sort_order = row["sort_order"].as_i64().unwrap_or(0);
        let created_at = row["created_at"].as_str().unwrap_or("");

        if id.is_empty() || imported_topic_id.is_empty() {
            continue;
        }

        let Some(topic_id) = resolve_local_topic_id(conn, dump, imported_topic_id) else {
            continue;
        };

        let existing_id: Option<String> = conn
            .query_row(
                "SELECT id FROM domains WHERE topic_id=?1 AND slug=?2",
                rusqlite::params![topic_id, slug],
                |r| r.get(0),
            )
            .ok();

        if existing_id.is_none() {
            conn.execute(
                "INSERT INTO domains (id, topic_id, name, slug, sort_order, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params![id, topic_id, name, slug, sort_order, created_at],
            )
            .map_err(|e| format!("DB error (domains): {}", e))?;
            count += 1;
        }
    }
    Ok(count)
}

fn import_concepts(conn: &Connection, dump: &Value) -> Result<usize, String> {
    let rows = get_array(dump, "concepts")?;
    let mut count = 0;
    for row in &rows {
        let id = row["id"].as_str().unwrap_or("");
        let imported_domain_id = row["domain_id"].as_str();
        let name = row["name"].as_str().unwrap_or("");
        let slug = row["slug"].as_str().unwrap_or("");
        let status = row["status"].as_str().unwrap_or("unexplored");
        let confidence = row["confidence"].as_f64().unwrap_or(0.0);
        let practice_count = row["practice_count"].as_i64().unwrap_or(0);
        let explain_count = row["explain_count"].as_i64().unwrap_or(0);
        let last_explained = row["last_explained"].as_str();
        let last_practiced = row["last_practiced"].as_str();
        let sort_order = row["sort_order"].as_i64().unwrap_or(0);
        let created_at = row["created_at"].as_str().unwrap_or("");

        if id.is_empty() || slug.is_empty() {
            continue;
        }

        let existing_id: Option<String> = conn
            .query_row(
                "SELECT id FROM concepts WHERE slug=?1",
                rusqlite::params![slug],
                |r| r.get(0),
            )
            .ok();

        if existing_id.is_none() {
            let domain_id =
                imported_domain_id.and_then(|value| resolve_local_domain_id(conn, dump, value));
            conn.execute(
                "INSERT INTO concepts (id, domain_id, name, slug, status, confidence,
                 practice_count, explain_count, last_explained, last_practiced, sort_order, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                rusqlite::params![
                    id, domain_id, name, slug, status, confidence,
                    practice_count, explain_count, last_explained, last_practiced, sort_order, created_at
                ],
            )
            .map_err(|e| format!("DB error (concepts): {}", e))?;
            count += 1;
        }
    }
    Ok(count)
}

fn import_sessions(conn: &Connection, dump: &Value) -> Result<usize, String> {
    let rows = get_array(dump, "sessions")?;
    let mut count = 0;
    for row in &rows {
        let id = row["id"].as_str().unwrap_or("");
        let imported_concept_id = row["concept_id"].as_str().unwrap_or("");
        let status = row["status"].as_str().unwrap_or("active");
        let started_at = row["started_at"].as_str().unwrap_or("");
        let ended_at = row["ended_at"].as_str();

        if id.is_empty() || imported_concept_id.is_empty() {
            continue;
        }

        let Some(concept_id) = resolve_local_concept_id(conn, dump, imported_concept_id) else {
            continue;
        };

        let existing_id: Option<String> = conn
            .query_row(
                "SELECT id FROM sessions WHERE concept_id=?1 AND started_at=?2",
                rusqlite::params![concept_id, started_at],
                |r| r.get(0),
            )
            .ok();

        if existing_id.is_none() {
            conn.execute(
                "INSERT INTO sessions (id, concept_id, status, started_at, ended_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params![id, concept_id, status, started_at, ended_at],
            )
            .map_err(|e| format!("DB error (sessions): {}", e))?;
            count += 1;
        }
    }
    Ok(count)
}

fn import_messages(conn: &Connection, dump: &Value) -> Result<usize, String> {
    let rows = get_array(dump, "messages")?;
    let mut count = 0;
    for row in &rows {
        let id = row["id"].as_str().unwrap_or("");
        let imported_session_id = row["session_id"].as_str().unwrap_or("");
        let role = row["role"].as_str().unwrap_or("user");
        let content = row["content"].as_str().unwrap_or("");
        let token_count = row["token_count"].as_i64().unwrap_or(0);
        let is_card = row["is_card"].as_i64().unwrap_or(0);
        let created_at = row["created_at"].as_str().unwrap_or("");

        if id.is_empty() || imported_session_id.is_empty() {
            continue;
        }

        let Some(session_id) = resolve_local_session_id(conn, dump, imported_session_id) else {
            continue;
        };

        let existing_id: Option<String> = conn
            .query_row(
                "SELECT id FROM messages WHERE session_id=?1 AND role=?2 AND content=?3 AND created_at=?4",
                rusqlite::params![session_id, role, content, created_at],
                |r| r.get(0),
            )
            .ok();

        if existing_id.is_none() {
            conn.execute(
                "INSERT INTO messages (id, session_id, role, content, token_count, is_card, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                rusqlite::params![id, session_id, role, content, token_count, is_card, created_at],
            )
            .map_err(|e| format!("DB error (messages): {}", e))?;
            count += 1;
        }
    }
    Ok(count)
}

fn import_cards(conn: &Connection, dump: &Value) -> Result<usize, String> {
    let rows = get_array(dump, "cards")?;
    let mut count = 0;
    for row in &rows {
        let id = row["id"].as_str().unwrap_or("");
        let imported_concept_id = row["concept_id"].as_str().unwrap_or("");
        let imported_session_id = row["session_id"].as_str().unwrap_or("");
        let content = row["content"].as_str().unwrap_or("");
        let status = row["status"].as_str().unwrap_or("active");
        let slug = row["slug"].as_str().unwrap_or("");
        let created_at = row["created_at"].as_str().unwrap_or("");

        if id.is_empty() || imported_concept_id.is_empty() {
            continue;
        }

        let Some(concept_id) = resolve_local_concept_id(conn, dump, imported_concept_id) else {
            continue;
        };
        let session_id = if imported_session_id.is_empty() {
            None
        } else {
            resolve_local_session_id(conn, dump, imported_session_id)
        };

        let existing_id: Option<String> = if let Some(session_id_ref) = session_id.as_ref() {
            conn.query_row(
                "SELECT id FROM cards WHERE concept_id=?1 AND slug=?2 AND session_id=?3",
                rusqlite::params![concept_id, slug, session_id_ref],
                |r| r.get(0),
            )
            .ok()
        } else {
            conn.query_row(
                "SELECT id FROM cards WHERE concept_id=?1 AND slug=?2 AND session_id IS NULL",
                rusqlite::params![concept_id, slug],
                |r| r.get(0),
            )
            .ok()
        };

        if existing_id.is_none() {
            conn.execute(
                "INSERT INTO cards (id, concept_id, session_id, content, status, slug, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                rusqlite::params![id, concept_id, session_id, content, status, slug, created_at],
            )
            .map_err(|e| format!("DB error (cards): {}", e))?;
            count += 1;
        }
    }
    Ok(count)
}

fn import_card_queue(conn: &Connection, dump: &Value) -> Result<usize, String> {
    let rows = get_array(dump, "card_queue")?;
    let mut count = 0;
    for row in &rows {
        let id = row["id"].as_str().unwrap_or("");
        let imported_session_id = row["session_id"].as_str().unwrap_or("");
        let imported_card_id = row["card_id"].as_str().unwrap_or("");
        let imported_concept_id = row["concept_id"].as_str().unwrap_or("");
        let position = row["position"].as_i64().unwrap_or(0);
        let status = row["status"].as_str().unwrap_or("active");
        let defer_count = row["defer_count"].as_i64().unwrap_or(0);
        let created_at = row["created_at"].as_str().unwrap_or("");

        if id.is_empty() {
            continue;
        }

        let session_id = if imported_session_id.is_empty() {
            None
        } else {
            resolve_local_session_id(conn, dump, imported_session_id)
        };
        let Some(card_id) = resolve_local_card_id(conn, dump, imported_card_id) else {
            continue;
        };
        let Some(concept_id) = resolve_local_concept_id(conn, dump, imported_concept_id) else {
            continue;
        };

        let existing_id: Option<String> = conn
            .query_row(
                "SELECT id FROM card_queue WHERE card_id=?1 AND position=?2",
                rusqlite::params![card_id, position],
                |r| r.get(0),
            )
            .ok();

        if existing_id.is_none() {
            conn.execute(
                "INSERT INTO card_queue (id, session_id, card_id, concept_id, position, status, defer_count, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                rusqlite::params![id, session_id, card_id, concept_id, position, status, defer_count, created_at],
            )
            .map_err(|e| format!("DB error (card_queue): {}", e))?;
            count += 1;
        }
    }
    Ok(count)
}

fn import_quiz_submissions(conn: &Connection, dump: &Value) -> Result<usize, String> {
    let rows = get_array(dump, "quiz_submissions")?;
    let mut count = 0;
    for row in &rows {
        let id = row["id"].as_str().unwrap_or("");
        let imported_session_id = row["session_id"].as_str().unwrap_or("");
        let imported_concept_id = row["concept_id"].as_str().unwrap_or("");
        let question_index = row["question_index"].as_i64().unwrap_or(0);
        let quiz_json = row["quiz_json"].as_str().unwrap_or("{}");
        let user_answer = row["user_answer"].as_str().unwrap_or("");
        let result = row["result"].as_str().unwrap_or("");
        let score = row["score"].as_f64();
        let created_at = row["created_at"].as_str().unwrap_or("");

        if id.is_empty() {
            continue;
        }

        let Some(session_id) = resolve_local_session_id(conn, dump, imported_session_id) else {
            continue;
        };
        let Some(concept_id) = resolve_local_concept_id(conn, dump, imported_concept_id) else {
            continue;
        };

        let existing_id: Option<String> = conn
            .query_row(
                "SELECT id FROM quiz_submissions WHERE session_id=?1 AND question_index=?2",
                rusqlite::params![session_id, question_index],
                |r| r.get(0),
            )
            .ok();

        if existing_id.is_none() {
            conn.execute(
                "INSERT INTO quiz_submissions (id, session_id, concept_id, question_index, quiz_json, user_answer, result, score, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                rusqlite::params![id, session_id, concept_id, question_index, quiz_json, user_answer, result, score, created_at],
            )
            .map_err(|e| format!("DB error (quiz_submissions): {}", e))?;
            count += 1;
        }
    }
    Ok(count)
}

fn import_projects(conn: &Connection, dump: &Value) -> Result<usize, String> {
    let rows = get_array(dump, "projects")?;
    let mut count = 0;
    for row in &rows {
        let id = row["id"].as_str().unwrap_or("");
        let name = row["name"].as_str().unwrap_or("");
        let source_type = row["source_type"].as_str().unwrap_or("");
        let source_ref = row["source_ref"].as_str().unwrap_or("");
        let analysis_json = row["analysis_json"].as_str().unwrap_or("{}");
        let coverage_summary = row["coverage_summary"].as_str();
        let skipped_summary = row["skipped_summary"].as_str();
        let created_at = row["created_at"].as_str().unwrap_or("");
        let updated_at = row["updated_at"].as_str().unwrap_or("");

        if id.is_empty() {
            continue;
        }

        let existing_id: Option<String> = conn
            .query_row(
                "SELECT id FROM projects WHERE name=?1 AND source_type=?2 AND source_ref=?3",
                rusqlite::params![name, source_type, source_ref],
                |r| r.get(0),
            )
            .ok();

        if existing_id.is_none() {
            conn.execute(
                "INSERT INTO projects (id, name, source_type, source_ref, analysis_json, coverage_summary, skipped_summary, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                rusqlite::params![id, name, source_type, source_ref, analysis_json, coverage_summary, skipped_summary, created_at, updated_at],
            )
            .map_err(|e| format!("DB error (projects): {}", e))?;
            count += 1;
        }
    }
    Ok(count)
}

fn import_achievements(conn: &Connection, dump: &Value) -> Result<usize, String> {
    let rows = get_array(dump, "achievements")?;
    let mut count = 0;
    for row in &rows {
        let id = row["id"].as_str().unwrap_or("");
        let name = row["name"].as_str().unwrap_or("");
        let description = row["description"].as_str().unwrap_or("");
        let icon = row["icon"].as_str().unwrap_or("");
        let category = row["category"].as_str().unwrap_or("learning");
        let earned_at = row["earned_at"].as_str();
        let created_at = row["created_at"].as_str().unwrap_or("");

        if id.is_empty() {
            continue;
        }

        let existing_id: Option<String> = conn
            .query_row(
                "SELECT id FROM achievements WHERE name=?1",
                rusqlite::params![name],
                |r| r.get(0),
            )
            .ok();

        if existing_id.is_none() {
            conn.execute(
                "INSERT INTO achievements (id, name, description, icon, category, earned_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                rusqlite::params![id, name, description, icon, category, earned_at, created_at],
            )
            .map_err(|e| format!("DB error (achievements): {}", e))?;
            count += 1;
        }
    }
    Ok(count)
}

fn import_streaks(conn: &Connection, dump: &Value) -> Result<usize, String> {
    let rows = get_array(dump, "learning_streaks")?;
    let mut count = 0;
    for row in &rows {
        let id = row["id"].as_str().unwrap_or("");
        let current_streak = row["current_streak"].as_i64().unwrap_or(0);
        let longest_streak = row["longest_streak"].as_i64().unwrap_or(0);
        let last_activity_date = row["last_activity_date"].as_str();
        let total_days_learned = row["total_days_learned"].as_i64().unwrap_or(0);
        let updated_at = row["updated_at"].as_str().unwrap_or("");

        if id.is_empty() {
            continue;
        }

        let existing_id: Option<String> = conn
            .query_row(
                "SELECT id FROM learning_streaks WHERE id=?1",
                rusqlite::params![id],
                |r| r.get(0),
            )
            .ok();

        if existing_id.is_none() {
            conn.execute(
                "INSERT INTO learning_streaks (id, current_streak, longest_streak, last_activity_date, total_days_learned, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params![id, current_streak, longest_streak, last_activity_date, total_days_learned, updated_at],
            )
            .map_err(|e| format!("DB error (learning_streaks): {}", e))?;
            count += 1;
        }
    }
    Ok(count)
}

fn import_settings(conn: &Connection, dump: &Value) -> Result<usize, String> {
    let rows = get_array(dump, "settings")?;
    let mut count = 0;
    for row in &rows {
        let key = row["key"].as_str().unwrap_or("");
        let value = row["value"].as_str().unwrap_or("");

        if key.is_empty() {
            continue;
        }

        // Skip API key settings during import
        if key.starts_with("api_key_") {
            continue;
        }

        let existing_val: Option<String> = conn
            .query_row(
                "SELECT value FROM settings WHERE key=?1",
                rusqlite::params![key],
                |r| r.get(0),
            )
            .ok();

        if existing_val.is_none() {
            conn.execute(
                "INSERT INTO settings (key, value) VALUES (?1, ?2)",
                rusqlite::params![key, value],
            )
            .map_err(|e| format!("DB error (settings): {}", e))?;
            count += 1;
        }
    }
    Ok(count)
}
