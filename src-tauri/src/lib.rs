mod app;
mod features;
mod infrastructure;
mod startup;
mod system;

use app::config::ConfigManager;
use app::queue::QueueManager;
use app::tray::build_tray_icon;
use features::downloads::BridgeState;
use startup::SplashState;
use tauri::{Manager, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config_manager = ConfigManager::new();
    let queue_manager = QueueManager::new().expect("Failed to initialize queue database");
    let bridge_state = BridgeState::new();
    let splash_state = SplashState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
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
            let process_limit = app
                .state::<ConfigManager>()
                .config
                .lock()
                .unwrap()
                .maximum_concurrent_processes as usize;
            app.state::<BridgeState>().set_process_limit(process_limit);
            let queue_state = app
                .state::<QueueManager>()
                .load()
                .map_err(std::io::Error::other)?;
            build_tray_icon(app.handle(), &queue_state)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let config_state = window.state::<ConfigManager>();
                let config = config_state.config.lock().unwrap();
                let behavior = config.close_behavior.to_lowercase();
                if behavior == "hide" {
                    api.prevent_close();
                    let _ = window.hide();
                    return;
                }
                let bridge_state = window.state::<BridgeState>();
                bridge_state.shutdown();
            }
        })
        .invoke_handler(tauri::generate_handler![
            system::get_config,
            system::get_distribution_channel,
            system::formats::get_format_catalog,
            system::save_config,
            system::get_queue_state,
            system::save_queue_state,
            system::metadata::fetch_metadata_downloader,
            system::metadata::fetch_metadata_converter,
            system::metadata::search,
            app::notifications::send_system_notification,
            app::presets::list_presets,
            app::presets::load_preset,
            app::presets::save_preset,
            app::presets::set_preset_hidden,
            app::presets::delete_preset,
            app::presets::import_preset,
            app::presets::export_preset,
            system::read_file_base64,
            system::queue_thumbnail::generate_queue_thumbnail,
            startup::get_requirements_versions,
            startup::run_splash_checks,
            startup::cancel_splash_checks,
            startup::run_requirement_check,
            system::acceleration::refresh_acceleration_info,
            features::downloads::start_download,
            features::downloads::cancel_download,
            features::downloads::init_bridge,
            features::downloads::file_ops::pick_download_directory,
            features::conversion::pick_convert_file,
            features::conversion::pick_convert_files,
            features::conversion::estimate_convert_size,
            features::conversion::start_convert,
            features::conversion::batch::start_batch_convert,
            features::compression::start_compress,
            features::compression::start_batch_compress,
            features::downloads::file_ops::save_thumbnail_to_disk,
            features::downloads::file_ops::read_clipboard_text,
            features::downloads::file_ops::open_in_file_manager
        ])
        .run(tauri::generate_context!())
        .expect("Error while running Pulsar");
}
