use crate::db::queries::{self, Achievement, Streak};
use crate::AppState;
use tauri::State;

/// Seed predefined achievements if the table is empty.
fn seed_achievements(conn: &rusqlite::Connection) -> Result<(), String> {
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM achievements", [], |row| row.get(0))
        .map_err(|e| format!("DB error (count achievements): {}", e))?;

    if count > 0 {
        return Ok(());
    }

    let achievements = [
        ("first_learn", "First Steps", "Complete your first day of learning", "🎓", "learning"),
        ("streak_3", "Getting Warm", "Maintain a 3-day learning streak", "🔥", "streak"),
        ("streak_7", "On Fire", "Maintain a 7-day learning streak", "💪", "streak"),
        ("streak_30", "Unstoppable", "Maintain a 30-day learning streak", "🏆", "streak"),
        ("total_10", "Dedicated Learner", "Learn for 10 total days", "📚", "learning"),
        ("total_50", "Knowledge Seeker", "Learn for 50 total days", "🧠", "learning"),
    ];

    for (id, name, description, icon, category) in &achievements {
        conn.execute(
            "INSERT INTO achievements (id, name, description, icon, category) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![id, name, description, icon, category],
        )
        .map_err(|e| format!("DB error (seed achievement): {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn cmd_get_streak(
    state: State<'_, AppState>,
) -> Result<Option<Streak>, String> {
    let db = state
        .db
        .lock()
        .map_err(|_| "Failed to lock database".to_string())?;
    let conn = &db.query_conn;

    // Ensure achievements are seeded on first access
    seed_achievements(conn)?;

    queries::get_streak(conn).map_err(|e| format!("DB error (get_streak): {}", e))
}

#[tauri::command]
pub async fn cmd_record_activity(
    state: State<'_, AppState>,
) -> Result<Streak, String> {
    let db = state
        .db
        .lock()
        .map_err(|_| "Failed to lock database".to_string())?;
    let conn = &db.query_conn;

    // Ensure achievements are seeded
    seed_achievements(conn)?;

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    let existing = queries::get_streak(conn)
        .map_err(|e| format!("DB error (get_streak): {}", e))?;

    match existing {
        Some(mut streak) => {
            let is_new_day = streak.last_activity_date.as_deref() != Some(&today);

            if is_new_day {
                // Check if yesterday was active → continue streak, otherwise reset
                let yesterday = chrono::Local::now()
                    .checked_sub_signed(chrono::Duration::days(1))
                    .map(|d| d.format("%Y-%m-%d").to_string());

                let was_yesterday_active = streak
                    .last_activity_date
                    .as_deref()
                    .and_then(|d| yesterday.as_ref().map(|y| d == y.as_str()))
                    .unwrap_or(false);

                if was_yesterday_active {
                    streak.current_streak += 1;
                } else {
                    streak.current_streak = 1;
                }

                if streak.current_streak > streak.longest_streak {
                    streak.longest_streak = streak.current_streak;
                }

                streak.total_days_learned += 1;
                streak.last_activity_date = Some(today.clone());
            }

            queries::update_streak_full(
                conn,
                streak.current_streak,
                streak.longest_streak,
                streak.total_days_learned,
                &today,
            )
            .map_err(|e| format!("DB error (update_streak): {}", e))?;

            // Re-read to get updated values
            let updated = queries::get_streak(conn)
                .map_err(|e| format!("DB error (re-read streak): {}", e))?
                .unwrap_or(streak);

            Ok(updated)
        }
        None => {
            // First ever activity - create streak record
            let id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO learning_streaks (id, current_streak, longest_streak, last_activity_date, total_days_learned, updated_at) VALUES (?1, 1, 1, ?2, 1, datetime('now'))",
                rusqlite::params![id, today],
            )
            .map_err(|e| format!("DB error (insert streak): {}", e))?;

            let streak = queries::get_streak(conn)
                .map_err(|e| format!("DB error (read new streak): {}", e))?
                .ok_or_else(|| "Failed to read newly created streak".to_string())?;

            Ok(streak)
        }
    }
}

#[tauri::command]
pub async fn cmd_get_achievements(
    state: State<'_, AppState>,
) -> Result<Vec<Achievement>, String> {
    let db = state
        .db
        .lock()
        .map_err(|_| "Failed to lock database".to_string())?;
    let conn = &db.query_conn;

    seed_achievements(conn)?;

    queries::get_achievements(conn)
        .map_err(|e| format!("DB error (get_achievements): {}", e))
}

#[tauri::command]
pub async fn cmd_award_achievement(
    state: State<'_, AppState>,
    achievement_id: String,
) -> Result<(), String> {
    let db = state
        .db
        .lock()
        .map_err(|_| "Failed to lock database".to_string())?;
    let conn = &db.query_conn;

    queries::award_achievement(conn, &achievement_id)
        .map_err(|e| format!("DB error (award_achievement): {}", e))
}
