pub mod schema;
pub mod queries;

use rusqlite::Connection;
use std::path::PathBuf;

/// Two Connections to the same SQLite file (WAL mode).
/// - query_conn: used synchronously in Tauri commands.
/// - db_path: retained so each streaming task can open its own persistence connection.
pub struct Database {
    pub query_conn: Connection,
    pub db_path: PathBuf,
}

impl Database {
    pub fn new(app_dir: PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&app_dir).map_err(|e| format!("Failed to create app dir: {}", e))?;
        let db_path = app_dir.join("learn-anything.db");

        let query_conn = Connection::open(&db_path)
            .map_err(|e| format!("Failed to open database: {}", e))?;
        query_conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
            .map_err(|e| format!("Failed to configure database: {}", e))?;
        schema::initialize_db(&query_conn)
            .map_err(|e| format!("Failed to initialize schema: {}", e))?;

        Ok(Database { query_conn, db_path })
    }

    /// Open a new persistence connection for a streaming task.
    /// Each call to start_chat_stream opens its own connection.
    pub fn open_persistence_conn(&self) -> Result<Connection, String> {
        let conn = Connection::open(&self.db_path)
            .map_err(|e| format!("Failed to open persistence connection: {}", e))?;
        conn.execute_batch(
            "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;"
        ).map_err(|e| format!("Failed to configure persistence connection: {}", e))?;
        Ok(conn)
    }
}

/// SQLite init failure returns a user-facing error instead of panicking.
pub fn init_database(app_dir: PathBuf) -> Result<Database, String> {
    Database::new(app_dir)
}
