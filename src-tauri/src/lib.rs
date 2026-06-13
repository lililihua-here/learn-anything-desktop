pub mod db;

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
                    // In production, show a Tauri window with the error message
                    // For now, log the error and allow the app to start with limited functionality
                    Err(Box::new(std::io::Error::new(
                        std::io::ErrorKind::Other,
                        format!("Database error: {}", e),
                    )))
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
