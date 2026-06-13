use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Concept {
    pub id: String,
    pub domain_id: Option<String>,
    pub name: String,
    pub slug: String,
    pub status: String,
    pub confidence: f64,
    pub practice_count: i64,
    pub explain_count: i64,
    pub last_explained: Option<String>,
    pub last_practiced: Option<String>,
    pub sort_order: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionInfo {
    pub id: String,
    pub concept_id: String,
    pub concept_name: String,
    pub concept_slug: String,
    pub status: String,
    pub started_at: String,
    pub ended_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MessageRow {
    pub id: String,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub created_at: String,
}

pub fn upsert_concept(conn: &Connection, id: &str, name: &str, slug: &str) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO concepts (id, name, slug, status, confidence)
         VALUES (?1, ?2, ?3, 'unexplored', 0.0)
         ON CONFLICT(slug) DO UPDATE SET name=excluded.name",
        params![id, name, slug],
    )?;
    Ok(())
}

pub fn get_concept_by_slug(conn: &Connection, slug: &str) -> rusqlite::Result<Option<Concept>> {
    let mut stmt = conn.prepare(
        "SELECT id, domain_id, name, slug, status, confidence, practice_count,
                explain_count, last_explained, last_practiced, sort_order, created_at
         FROM concepts WHERE slug = ?1"
    )?;
    let mut rows = stmt.query_map(params![slug], |row| {
        Ok(Concept {
            id: row.get(0)?, domain_id: row.get(1)?, name: row.get(2)?,
            slug: row.get(3)?, status: row.get(4)?, confidence: row.get(5)?,
            practice_count: row.get(6)?, explain_count: row.get(7)?,
            last_explained: row.get(8)?, last_practiced: row.get(9)?,
            sort_order: row.get(10)?, created_at: row.get(11)?,
        })
    })?;
    match rows.next() {
        Some(Ok(c)) => Ok(Some(c)),
        _ => Ok(None),
    }
}

pub fn update_concept_status(conn: &Connection, slug: &str, status: &str, confidence: f64) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE concepts SET status=?1, confidence=?2 WHERE slug=?3",
        params![status, confidence, slug],
    )
}

pub fn increment_explain_count(conn: &Connection, slug: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE concepts SET explain_count=explain_count+1, last_explained=datetime('now') WHERE slug=?1",
        params![slug],
    )?;
    Ok(())
}

pub fn increment_practice_count(conn: &Connection, slug: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE concepts SET practice_count=practice_count+1, last_practiced=datetime('now') WHERE slug=?1",
        params![slug],
    )?;
    Ok(())
}

pub fn get_all_concepts(conn: &Connection) -> rusqlite::Result<Vec<Concept>> {
    let mut stmt = conn.prepare(
        "SELECT id, domain_id, name, slug, status, confidence, practice_count,
                explain_count, last_explained, last_practiced, sort_order, created_at
         FROM concepts ORDER BY created_at DESC"
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Concept {
            id: row.get(0)?, domain_id: row.get(1)?, name: row.get(2)?,
            slug: row.get(3)?, status: row.get(4)?, confidence: row.get(5)?,
            practice_count: row.get(6)?, explain_count: row.get(7)?,
            last_explained: row.get(8)?, last_practiced: row.get(9)?,
            sort_order: row.get(10)?, created_at: row.get(11)?,
        })
    })?;
    rows.collect()
}

pub fn get_learned_concepts(conn: &Connection) -> rusqlite::Result<Vec<Concept>> {
    let mut stmt = conn.prepare(
        "SELECT id, domain_id, name, slug, status, confidence, practice_count,
                explain_count, last_explained, last_practiced, sort_order, created_at
         FROM concepts WHERE status != 'unexplored' ORDER BY last_explained DESC"
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Concept {
            id: row.get(0)?, domain_id: row.get(1)?, name: row.get(2)?,
            slug: row.get(3)?, status: row.get(4)?, confidence: row.get(5)?,
            practice_count: row.get(6)?, explain_count: row.get(7)?,
            last_explained: row.get(8)?, last_practiced: row.get(9)?,
            sort_order: row.get(10)?, created_at: row.get(11)?,
        })
    })?;
    rows.collect()
}

pub fn get_resumable_session(conn: &Connection, concept_slug: &str) -> rusqlite::Result<Option<SessionInfo>> {
    let mut stmt = conn.prepare(
        "SELECT s.id, s.concept_id, c.name, c.slug, s.status, s.started_at, s.ended_at
         FROM sessions s JOIN concepts c ON s.concept_id = c.id
         WHERE c.slug = ?1 AND s.status IN ('active', 'interrupted')
         ORDER BY s.started_at DESC LIMIT 1"
    )?;
    let mut rows = stmt.query_map(params![concept_slug], |row| {
        Ok(SessionInfo {
            id: row.get(0)?, concept_id: row.get(1)?, concept_name: row.get(2)?,
            concept_slug: row.get(3)?, status: row.get(4)?,
            started_at: row.get(5)?, ended_at: row.get(6)?,
        })
    })?;
    match rows.next() {
        Some(Ok(s)) => Ok(Some(s)),
        _ => Ok(None),
    }
}

pub fn get_session_messages(conn: &Connection, session_id: &str, limit: usize) -> rusqlite::Result<Vec<MessageRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, session_id, role, content, created_at
         FROM messages WHERE session_id = ?1
         ORDER BY created_at DESC LIMIT ?2"
    )?;
    let rows = stmt.query_map(params![session_id, limit as i64], |row| {
        Ok(MessageRow {
            id: row.get(0)?, session_id: row.get(1)?, role: row.get(2)?,
            content: row.get(3)?, created_at: row.get(4)?,
        })
    })?;
    let mut msgs: Vec<MessageRow> = rows.filter_map(|r| r.ok()).collect();
    msgs.reverse(); // oldest first for chat display
    Ok(msgs)
}

pub fn get_session_history(conn: &Connection, limit: usize) -> rusqlite::Result<Vec<SessionInfo>> {
    let mut stmt = conn.prepare(
        "SELECT s.id, s.concept_id, c.name, c.slug, s.status, s.started_at, s.ended_at
         FROM sessions s JOIN concepts c ON s.concept_id = c.id
         ORDER BY s.started_at DESC LIMIT ?1"
    )?;
    let rows = stmt.query_map(params![limit as i64], |row| {
        Ok(SessionInfo {
            id: row.get(0)?, concept_id: row.get(1)?, concept_name: row.get(2)?,
            concept_slug: row.get(3)?, status: row.get(4)?,
            started_at: row.get(5)?, ended_at: row.get(6)?,
        })
    })?;
    rows.collect()
}

pub fn get_card_queue(conn: &Connection, session_id: &str) -> rusqlite::Result<Vec<(String, String, String, i64, String, i64)>> {
    let mut stmt = conn.prepare(
        "SELECT id, card_id, concept_id, position, status, defer_count
         FROM card_queue WHERE session_id = ?1 ORDER BY position"
    )?;
    let rows = stmt.query_map(params![session_id], |row| {
        Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?))
    })?;
    rows.collect()
}

pub fn get_setting(conn: &Connection, key: &str) -> rusqlite::Result<Option<String>> {
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
    let mut rows = stmt.query_map(params![key], |row| row.get(0))?;
    match rows.next() {
        Some(Ok(v)) => Ok(Some(v)),
        _ => Ok(None),
    }
}

pub fn save_setting(conn: &Connection, key: &str, value: &str) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        params![key, value],
    )?;
    Ok(())
}
