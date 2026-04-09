pub mod config;
pub mod metadata;
pub mod notifications;
pub mod presets;
pub mod queue;

use base64::{engine::general_purpose, Engine as _};
use std::path::Path;
use tauri::{AppHandle, State};
use self::config::{ConfigManager, AppConfig};
use self::queue::{QueueManager, QueueState};
use crate::sync_tray_from_queue;

#[tauri::command]
pub fn get_config(state: State<ConfigManager>) -> AppConfig {
    state.config.lock().unwrap().clone()
}

#[tauri::command]
pub fn save_config(new_config: AppConfig, state: State<ConfigManager>) {
    let mut config = state.config.lock().unwrap();
    *config = new_config;
    config.sanitize();
    drop(config);
    state.save();
}

#[tauri::command]
pub fn get_queue_state(state: State<QueueManager>) -> QueueState {
    state.load()
}

#[tauri::command]
pub fn save_queue_state(app_handle: AppHandle, state: State<QueueManager>, queue_state: QueueState) -> Result<(), String> {
    state.save(&queue_state)?;
    // Keep tray counters in sync with persisted queue state.
    sync_tray_from_queue(&app_handle, &queue_state);
    Ok(())
}

#[tauri::command]
pub fn read_file_base64(path: String) -> Result<String, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let mime = Path::new(&path)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| match ext.to_lowercase().as_str() {
            "png" => "image/png",
            "jpg" | "jpeg" => "image/jpeg",
            "webp" => "image/webp",
            "gif" => "image/gif",
            "svg" => "image/svg+xml",
            _ => "application/octet-stream"
        })
        .unwrap_or("application/octet-stream");
    let encoded = general_purpose::STANDARD.encode(bytes);
    Ok(format!("data:{};base64,{}", mime, encoded))
}