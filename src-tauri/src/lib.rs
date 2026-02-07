mod core;
mod system;

use system::config::ConfigManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config_manager = ConfigManager::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(config_manager)
        .invoke_handler(tauri::generate_handler![
            system::get_config,
            system::save_config,
            core::splash::run_splash_checks
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}