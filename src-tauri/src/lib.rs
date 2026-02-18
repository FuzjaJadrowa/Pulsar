mod core;
mod system;

use system::config::ConfigManager;
use system::queue::QueueManager;
use core::downloader::BridgeState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config_manager = ConfigManager::new();
    let queue_manager = QueueManager::new();
    let bridge_state = BridgeState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .manage(config_manager)
        .manage(queue_manager)
        .manage(bridge_state)
        .invoke_handler(tauri::generate_handler![
            system::get_config,
            system::save_config,
            system::get_queue_state,
            system::save_queue_state,
            system::metadata::fetch_metadata,
            core::splash::run_splash_checks,
            core::downloader::start_download,
            core::downloader::cancel_download,
            core::downloader::pick_download_directory,
            core::downloader::save_thumbnail_to_disk
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}