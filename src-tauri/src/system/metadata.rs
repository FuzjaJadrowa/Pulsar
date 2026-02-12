use serde::Serialize;
use tauri::{AppHandle, State};

use crate::core::downloader::BridgeState;

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
    url: String,
) -> Result<String, String> {
    let trimmed_url = url.trim();
    if trimmed_url.is_empty() {
        return Err("URL cannot be empty".to_string());
    }

    let task_id = format!(
        "task_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_millis()
    );

    let cmd = BridgeCommand {
        command: "metadata".to_string(),
        id: task_id.clone(),
        args: vec![trimmed_url.to_string()],
    };

    state.send_raw_command(&app_handle, &cmd)?;

    Ok(task_id)
}