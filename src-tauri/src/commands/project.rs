use crate::db::queries;
use crate::project::analysis::{self, CodeUnderstandingMap};
use crate::project::scanner::{self, ScanResult};
use crate::AppState;
use std::path::Path;

#[tauri::command]
pub async fn analyze_project(
    state: tauri::State<'_, AppState>,
    path: String,
) -> Result<CodeUnderstandingMap, String> {
    let root = Path::new(&path);

    if !root.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    if !root.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    // Step 1: Scan
    let scan = scanner::scan_project(root);

    // Step 2: Derive project name from directory name
    let project_name = root
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    // Step 3: AI Analysis
    let analysis = analysis::analyze_project(&project_name, &scan).await?;

    // Step 4: Persist to DB
    {
        let analysis_json =
            serde_json::to_string(&analysis).map_err(|e| format!("Serialize error: {}", e))?;

        let coverage_summary = format!(
            "{} files analyzed, {} skipped, {} tokens estimated",
            scan.included_files.len(),
            scan.skipped_files.len(),
            scan.estimated_tokens,
        );

        let skipped_summary = serde_json::to_string(&scan.skipped_files)
            .map_err(|e| format!("Serialize skipped: {}", e))?;

        let db = state
            .db
            .lock()
            .map_err(|_| "Failed to lock database".to_string())?;
        let conn = &db.query_conn;

        queries::upsert_project_analysis(
            conn,
            &project_name,
            "local_directory",
            &path,
            &analysis_json,
            Some(&coverage_summary),
            Some(&skipped_summary),
        )
        .map_err(|e| format!("DB error (upsert_project_analysis): {}", e))?;
    }

    Ok(analysis)
}

#[tauri::command]
pub async fn scan_project_files(path: String) -> Result<ScanResult, String> {
    let root = Path::new(&path);

    if !root.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    if !root.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    let scan = scanner::scan_project(root);
    Ok(scan)
}
