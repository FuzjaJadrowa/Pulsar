use serde::Serialize;
use tauri::{AppHandle, State};

use crate::core::downloader::BridgeState;
use crate::system::config::ConfigManager;

#[derive(Serialize)]
struct BridgeCommand {
    command: String,
    id: String,
    args: Vec<String>,
}

#[tauri::command]
pub fn fetch_metadata(
    app_handle: AppHandle,
    state: State<BridgeState>,
    config_mgr: State<ConfigManager>,
    url: String,
) -> Result<String, String> {
    let trimmed_url = url.trim();
    if trimmed_url.is_empty() {
        return Err("URL cannot be empty".to_string());
    }

    let task_id = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis()
        .to_string();

    let config = config_mgr.config.lock().unwrap();
    let mut args: Vec<String> = Vec::new();

    if config.cookies_browser != "None" {
        args.push("--cookies-from-browser".to_string());
        args.push(config.cookies_browser.to_lowercase());
    }

    args.push(trimmed_url.to_string());

    let cmd = BridgeCommand {
        command: "metadata".to_string(),
        id: task_id.clone(),
        args,
    };

    state.send_raw_command(&app_handle, &cmd)?;

    Ok(task_id)
}