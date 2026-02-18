pub mod config;
pub mod metadata;
pub mod queue;

use tauri::State;
use self::config::{ConfigManager, AppConfig};
use self::queue::{QueueManager, QueueState};

#[tauri::command]
pub fn get_config(state: State<ConfigManager>) -> AppConfig {
    state.config.lock().unwrap().clone()
}

#[tauri::command]
pub fn save_config(new_config: AppConfig, state: State<ConfigManager>) {
    let mut config = state.config.lock().unwrap();
    *config = new_config;
    drop(config);
    state.save();
}

#[tauri::command]
pub fn get_queue_state(state: State<QueueManager>) -> QueueState {
    state.load()
}

#[tauri::command]
pub fn save_queue_state(state: State<QueueManager>, queue_state: QueueState) -> Result<(), String> {
    state.save(&queue_state)
}