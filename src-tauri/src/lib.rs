mod core;
mod system;

use core::downloader::BridgeState;
use core::splash::SplashState;
use core::tray::build_tray_icon;
pub use core::tray::sync_tray_from_queue;
use system::config::ConfigManager;
use system::queue::QueueManager;
use tauri::{Manager, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config_manager = ConfigManager::new();
    let queue_manager = QueueManager::new();
    let bridge_state = BridgeState::new();
    let splash_state = SplashState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Re-focus the existing window instead of spawning a second instance.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .manage(config_manager)
        .manage(queue_manager)
        .manage(bridge_state)
        .manage(splash_state)
        .setup(|app| {
            let queue_state = app.state::<QueueManager>().load();
            build_tray_icon(app.handle(), &queue_state)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let config_state = window.state::<ConfigManager>();
                let config = config_state.config.lock().unwrap();
                let behavior = config.close_behavior.to_lowercase();
                if behavior == "hide" {
                    // Keep the app running in tray mode when hide on close is enabled.
                    api.prevent_close();
                    let _ = window.hide();
                    return;
                }
                // Ensure the sidecar process is stopped on real app exit.
                let bridge_state = window.state::<BridgeState>();
                bridge_state.shutdown();
            }
        })
        .invoke_handler(tauri::generate_handler![
            system::get_config,
            system::get_distribution_channel,
            system::save_config,
            system::get_queue_state,
            system::save_queue_state,
            system::metadata::fetch_metadata_downloader,
            system::metadata::fetch_metadata_converter,
            system::metadata::search,
            system::notifications::send_system_notification,
            system::presets::list_presets,
            system::presets::load_preset,
            system::presets::save_preset,
            system::presets::set_preset_hidden,
            system::presets::delete_preset,
            system::presets::import_preset,
            system::presets::export_preset,
            system::read_file_base64,
            core::splash::get_requirements_versions,
            core::splash::run_splash_checks,
            core::splash::cancel_splash_checks,
            core::splash::run_requirement_check,
            core::acceleration::refresh_acceleration_info,
            core::downloader::start_download,
            core::downloader::cancel_download,
            core::downloader::init_bridge,
            core::downloader::pick_download_directory,
            core::converter::pick_convert_file,
            core::converter::estimate_convert_size,
            core::converter::start_convert,
            core::compressor::start_compress,
            core::downloader::save_thumbnail_to_disk,
            core::downloader::read_clipboard_text,
            core::downloader::open_in_file_manager
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}