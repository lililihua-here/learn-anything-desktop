pub mod db;
pub mod pipeline;
pub mod ai;
pub mod commands;

use db::Database;
use std::path::PathBuf;
use tauri::Manager;

pub struct AppState {
    pub db: Database,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_dir: PathBuf = app.path().app_data_dir()
                .expect("failed to resolve app data dir");
            match Database::new(app_dir) {
                Ok(database) => {
                    app.manage(AppState { db: database });
                    Ok(())
                }
                Err(e) => {
                    eprintln!("Database initialization failed: {}", e);
                    Err(Box::new(std::io::Error::new(
                        std::io::ErrorKind::Other,
                        format!("Database error: {}", e),
                    )))
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::chat::start_chat_stream,
            commands::chat::stop_chat_stream,
            commands::chat::sync_card_queue,
            commands::chat::submit_quiz_answers,
            commands::chat::complete_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
