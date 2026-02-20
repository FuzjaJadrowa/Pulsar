pub mod config;
pub mod metadata;
pub mod queue;

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
    sync_tray_from_queue(&app_handle, &queue_state);
    Ok(())
}
