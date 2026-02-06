pub mod config;

use tauri::State;
use self::config::{ConfigManager, AppConfig};

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