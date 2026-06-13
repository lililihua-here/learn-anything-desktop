use rusqlite::{params, Connection};
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

#[derive(Debug, Serialize, Deserialize)]
pub struct Topic {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub topic_type: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Domain {
    pub id: String,
    pub topic_id: String,
    pub name: String,
    pub slug: String,
    pub sort_order: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Achievement {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    pub category: String,
    pub earned_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Streak {
    pub id: String,
    pub current_streak: i64,
    pub longest_streak: i64,
    pub last_activity_date: Option<String>,
    pub total_days_learned: i64,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TreeNode {
    pub name: String,
    pub slug: String,
    pub status: String,
    pub children: Vec<TreeNode>,
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

pub fn ensure_concept(conn: &Connection, name: &str, slug: &str) -> rusqlite::Result<String> {
    if let Some(concept) = get_concept_by_slug(conn, slug)? {
        if concept.name != name {
            upsert_concept(conn, &concept.id, name, slug)?;
        }
        return Ok(concept.id);
    }

    let concept_id = uuid::Uuid::new_v4().to_string();
    upsert_concept(conn, &concept_id, name, slug)?;
    Ok(concept_id)
}

pub fn get_concept_id_by_slug(conn: &Connection, slug: &str) -> rusqlite::Result<Option<String>> {
    Ok(get_concept_by_slug(conn, slug)?.map(|concept| concept.id))
}

pub fn get_concept_by_slug(conn: &Connection, slug: &str) -> rusqlite::Result<Option<Concept>> {
    let mut stmt = conn.prepare(
        "SELECT id, domain_id, name, slug, status, confidence, practice_count,
                explain_count, last_explained, last_practiced, sort_order, created_at
         FROM concepts WHERE slug = ?1",
    )?;
    let mut rows = stmt.query_map(params![slug], |row| {
        Ok(Concept {
            id: row.get(0)?,
            domain_id: row.get(1)?,
            name: row.get(2)?,
            slug: row.get(3)?,
            status: row.get(4)?,
            confidence: row.get(5)?,
            practice_count: row.get(6)?,
            explain_count: row.get(7)?,
            last_explained: row.get(8)?,
            last_practiced: row.get(9)?,
            sort_order: row.get(10)?,
            created_at: row.get(11)?,
        })
    })?;
    match rows.next() {
        Some(Ok(c)) => Ok(Some(c)),
        _ => Ok(None),
    }
}

pub fn update_concept_status(
    conn: &Connection,
    slug: &str,
    status: &str,
    confidence: f64,
) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE concepts SET status=?1, confidence=?2 WHERE slug=?3",
        params![status, confidence, slug],
    )?;
    Ok(())
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
         FROM concepts ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Concept {
            id: row.get(0)?,
            domain_id: row.get(1)?,
            name: row.get(2)?,
            slug: row.get(3)?,
            status: row.get(4)?,
            confidence: row.get(5)?,
            practice_count: row.get(6)?,
            explain_count: row.get(7)?,
            last_explained: row.get(8)?,
            last_practiced: row.get(9)?,
            sort_order: row.get(10)?,
            created_at: row.get(11)?,
        })
    })?;
    rows.collect()
}

pub fn get_learned_concepts(conn: &Connection) -> rusqlite::Result<Vec<Concept>> {
    let mut stmt = conn.prepare(
        "SELECT id, domain_id, name, slug, status, confidence, practice_count,
                explain_count, last_explained, last_practiced, sort_order, created_at
         FROM concepts WHERE status != 'unexplored' ORDER BY last_explained DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Concept {
            id: row.get(0)?,
            domain_id: row.get(1)?,
            name: row.get(2)?,
            slug: row.get(3)?,
            status: row.get(4)?,
            confidence: row.get(5)?,
            practice_count: row.get(6)?,
            explain_count: row.get(7)?,
            last_explained: row.get(8)?,
            last_practiced: row.get(9)?,
            sort_order: row.get(10)?,
            created_at: row.get(11)?,
        })
    })?;
    rows.collect()
}

pub fn get_resumable_session(
    conn: &Connection,
    concept_slug: &str,
) -> rusqlite::Result<Option<SessionInfo>> {
    let mut stmt = conn.prepare(
        "SELECT s.id, s.concept_id, c.name, c.slug, s.status, s.started_at, s.ended_at
         FROM sessions s JOIN concepts c ON s.concept_id = c.id
         WHERE c.slug = ?1 AND s.status IN ('active', 'interrupted')
         ORDER BY s.started_at DESC LIMIT 1",
    )?;
    let mut rows = stmt.query_map(params![concept_slug], |row| {
        Ok(SessionInfo {
            id: row.get(0)?,
            concept_id: row.get(1)?,
            concept_name: row.get(2)?,
            concept_slug: row.get(3)?,
            status: row.get(4)?,
            started_at: row.get(5)?,
            ended_at: row.get(6)?,
        })
    })?;
    match rows.next() {
        Some(Ok(s)) => Ok(Some(s)),
        _ => Ok(None),
    }
}

pub fn get_session_messages(
    conn: &Connection,
    session_id: &str,
    limit: usize,
) -> rusqlite::Result<Vec<MessageRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, session_id, role, content, created_at
         FROM messages WHERE session_id = ?1
         ORDER BY created_at DESC LIMIT ?2",
    )?;
    let rows = stmt.query_map(params![session_id, limit as i64], |row| {
        Ok(MessageRow {
            id: row.get(0)?,
            session_id: row.get(1)?,
            role: row.get(2)?,
            content: row.get(3)?,
            created_at: row.get(4)?,
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
         ORDER BY s.started_at DESC LIMIT ?1",
    )?;
    let rows = stmt.query_map(params![limit as i64], |row| {
        Ok(SessionInfo {
            id: row.get(0)?,
            concept_id: row.get(1)?,
            concept_name: row.get(2)?,
            concept_slug: row.get(3)?,
            status: row.get(4)?,
            started_at: row.get(5)?,
            ended_at: row.get(6)?,
        })
    })?;
    rows.collect()
}

pub fn get_card_queue(
    conn: &Connection,
    session_id: &str,
) -> rusqlite::Result<Vec<(String, String, String, i64, String, i64)>> {
    let mut stmt = conn.prepare(
        "SELECT id, card_id, concept_id, position, status, defer_count
         FROM card_queue WHERE session_id = ?1 ORDER BY position",
    )?;
    let rows = stmt.query_map(params![session_id], |row| {
        Ok((
            row.get(0)?,
            row.get(1)?,
            row.get(2)?,
            row.get(3)?,
            row.get(4)?,
            row.get(5)?,
        ))
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

pub fn is_session_complete(conn: &Connection, session_id: &str) -> rusqlite::Result<bool> {
    let quiz_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM quiz_submissions WHERE session_id=?1",
        params![session_id],
        |row| row.get(0),
    )?;

    let remaining: i64 = conn.query_row(
        "SELECT COUNT(*) FROM card_queue WHERE session_id=?1 AND status NOT IN ('skipped', 'mastered')",
        params![session_id],
        |row| row.get(0),
    )?;

    Ok(quiz_count > 0 && remaining == 0)
}

pub fn mark_session_completed_if_ready(
    conn: &Connection,
    session_id: &str,
) -> rusqlite::Result<bool> {
    if !is_session_complete(conn, session_id)? {
        return Ok(false);
    }

    conn.execute(
        "UPDATE sessions SET status='completed', ended_at=datetime('now') WHERE id=?1",
        params![session_id],
    )?;

    Ok(true)
}

// Topic / domain queries
pub fn upsert_topic(conn: &Connection, id: &str, name: &str, slug: &str, topic_type: &str) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO topics (id, name, slug, \"type\") VALUES (?1, ?2, ?3, ?4) ON CONFLICT(slug) DO UPDATE SET name=excluded.name, \"type\"=excluded.\"type\"",
        rusqlite::params![id, name, slug, topic_type],
    )?;
    Ok(())
}

pub fn get_topic_by_slug(conn: &Connection, slug: &str) -> rusqlite::Result<Option<Topic>> {
    let mut stmt = conn.prepare("SELECT id, name, slug, \"type\", created_at FROM topics WHERE slug=?1")?;
    let mut rows = stmt.query_map(params![slug], |row| {
        Ok(Topic { id: row.get(0)?, name: row.get(1)?, slug: row.get(2)?, topic_type: row.get(3)?, created_at: row.get(4)? })
    })?;
    Ok(rows.next().transpose()?)
}

pub fn get_all_topics(conn: &Connection) -> rusqlite::Result<Vec<Topic>> {
    let mut stmt = conn.prepare("SELECT id, name, slug, \"type\", created_at FROM topics ORDER BY created_at DESC")?;
    let rows = stmt.query_map([], |row| {
        Ok(Topic { id: row.get(0)?, name: row.get(1)?, slug: row.get(2)?, topic_type: row.get(3)?, created_at: row.get(4)? })
    })?;
    rows.collect()
}

pub fn insert_domain(conn: &Connection, id: &str, topic_id: &str, name: &str, slug: &str, sort_order: i64) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO domains (id, topic_id, name, slug, sort_order) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, topic_id, name, slug, sort_order],
    )?;
    Ok(())
}

pub fn get_domains_by_topic(conn: &Connection, topic_id: &str) -> rusqlite::Result<Vec<Domain>> {
    let mut stmt = conn.prepare("SELECT id, topic_id, name, slug, sort_order, created_at FROM domains WHERE topic_id=?1 ORDER BY sort_order")?;
    let rows = stmt.query_map(params![topic_id], |row| {
        Ok(Domain { id: row.get(0)?, topic_id: row.get(1)?, name: row.get(2)?, slug: row.get(3)?, sort_order: row.get(4)?, created_at: row.get(5)? })
    })?;
    rows.collect()
}

pub fn update_concept_domain(conn: &Connection, concept_slug: &str, domain_id: &str) -> rusqlite::Result<()> {
    conn.execute("UPDATE concepts SET domain_id=?1 WHERE slug=?2", params![domain_id, concept_slug])?;
    Ok(())
}

pub fn get_concept_tree(conn: &Connection, topic_slug: &str) -> rusqlite::Result<TreeNode> {
    let topic = get_topic_by_slug(conn, topic_slug)?.ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)?;
    let domains = get_domains_by_topic(conn, &topic.id)?;
    let mut root = TreeNode { name: topic.name, slug: topic.slug, status: "in_progress".into(), children: vec![] };

    for domain in domains {
        let mut stmt = conn.prepare(
            "SELECT c.name, c.slug, c.status FROM concepts c WHERE c.domain_id=?1 ORDER BY c.sort_order"
        )?;
        let concepts: Vec<TreeNode> = stmt.query_map(params![domain.id], |row| {
            Ok(TreeNode { name: row.get(0)?, slug: row.get(1)?, status: row.get(2)?, children: vec![] })
        })?.filter_map(|r| r.ok()).collect();

        root.children.push(TreeNode { name: domain.name, slug: domain.slug, status: "in_progress".into(), children: concepts });
    }
    Ok(root)
}

// Streak queries
pub fn get_streak(conn: &Connection) -> rusqlite::Result<Option<Streak>> {
    let mut stmt = conn.prepare("SELECT id, current_streak, longest_streak, last_activity_date, total_days_learned, updated_at FROM learning_streaks LIMIT 1")?;
    let mut rows = stmt.query_map([], |row| {
        Ok(Streak { id: row.get(0)?, current_streak: row.get(1)?, longest_streak: row.get(2)?, last_activity_date: row.get(3)?, total_days_learned: row.get(4)?, updated_at: row.get(5)? })
    })?;
    Ok(rows.next().transpose()?)
}

pub fn update_streak(conn: &Connection, date: &str) -> rusqlite::Result<()> {
    conn.execute("UPDATE learning_streaks SET last_activity_date=?1, updated_at=datetime('now') WHERE id=(SELECT id FROM learning_streaks LIMIT 1)", params![date])?;
    Ok(())
}

// Achievement queries
pub fn get_achievements(conn: &Connection) -> rusqlite::Result<Vec<Achievement>> {
    let mut stmt = conn.prepare("SELECT id, name, description, icon, category, earned_at, created_at FROM achievements ORDER BY created_at")?;
    let rows = stmt.query_map([], |row| {
        Ok(Achievement { id: row.get(0)?, name: row.get(1)?, description: row.get(2)?, icon: row.get(3)?, category: row.get(4)?, earned_at: row.get(5)?, created_at: row.get(6)? })
    })?;
    rows.collect()
}

pub fn award_achievement(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute("UPDATE achievements SET earned_at=datetime('now') WHERE id=?1", params![id])?;
    Ok(())
}
