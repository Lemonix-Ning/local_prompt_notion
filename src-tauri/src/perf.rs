use std::fs;
use std::path::PathBuf;

use serde_json::Value;
use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn save_performance_snapshot(app: AppHandle, snapshot: Value) -> Result<String, String> {
    let dir = app
        .path()
        .app_config_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("performance-snapshot.json");
    let data = serde_json::to_vec_pretty(&snapshot).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}
