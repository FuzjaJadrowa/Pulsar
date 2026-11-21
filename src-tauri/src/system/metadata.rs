use serde::Serialize;
use tauri::{AppHandle, Manager};

use crate::app::config::ConfigManager;
use crate::features::downloads::BridgeState;

#[derive(Serialize)]
struct BridgeCommand {
    command: String,
    id: String,
    args: Vec<String>,
}

fn build_task_id() -> Result<String, String> {
    Ok(std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis()
        .to_string())
}

fn resolve_task_id(client_task_id: Option<String>) -> Result<String, String> {
    if let Some(id) = client_task_id {
        let trimmed = id.trim();
        if !trimmed.is_empty() {
            return Ok(trimmed.to_string());
        }
    }
    build_task_id()
}

#[tauri::command]
pub async fn fetch_metadata_downloader(
    app_handle: AppHandle,
    url: String,
    client_task_id: Option<String>,
) -> Result<String, String> {
    let trimmed_url = url.trim().to_string();
    if trimmed_url.is_empty() {
        return Err("URL cannot be empty".to_string());
    }

    let task_id = resolve_task_id(client_task_id)?;

    let mut args: Vec<String> = Vec::new();
    crate::infrastructure::platform::append_js_runtime_args(&mut args);

    {
        let config_mgr = app_handle.state::<ConfigManager>();
        let config = config_mgr.config.lock().unwrap();
        if config.cookies_browser.to_lowercase() != "none"
            && !config.cookies_browser.trim().is_empty()
        {
            args.push("--cookies-from-browser".to_string());
            args.push(config.cookies_browser.to_lowercase());
        }
    }

    args.push(trimmed_url);

    let cmd = BridgeCommand {
        command: "metadata_d".to_string(),
        id: task_id.clone(),
        args,
    };

    tokio::task::spawn_blocking(move || {
        let state = app_handle.state::<BridgeState>();
        state.send_raw_command(&app_handle, &cmd)?;
        Ok(task_id)
    })
    .await
    .map_err(|e| format!("Metadata task failed: {e}"))?
}

#[tauri::command]
pub async fn fetch_metadata_converter(
    app_handle: AppHandle,
    path: String,
    client_task_id: Option<String>,
) -> Result<String, String> {
    let trimmed_path = path.trim().to_string();
    if trimmed_path.is_empty() {
        return Err("Path cannot be empty".to_string());
    }

    let task_id = resolve_task_id(client_task_id)?;

    let cmd = BridgeCommand {
        command: "metadata_c".to_string(),
        id: task_id.clone(),
        args: vec![trimmed_path],
    };

    tokio::task::spawn_blocking(move || {
        let state = app_handle.state::<BridgeState>();
        state.send_raw_command(&app_handle, &cmd)?;
        Ok(task_id)
    })
    .await
    .map_err(|e| format!("Metadata task failed: {e}"))?
}

#[tauri::command]
pub async fn search(
    app_handle: AppHandle,
    query: String,
    prefix: Option<String>,
) -> Result<String, String> {
    let trimmed_query = query.trim().to_string();
    if trimmed_query.is_empty() {
        return Err("Query cannot be empty".to_string());
    }

    let task_id = build_task_id()?;

    let mut args: Vec<String> = Vec::new();
    crate::infrastructure::platform::append_js_runtime_args(&mut args);

    let max_results = {
        let config_mgr = app_handle.state::<ConfigManager>();
        let config = config_mgr.config.lock().unwrap();
        if config.cookies_browser.to_lowercase() != "none"
            && !config.cookies_browser.trim().is_empty()
        {
            args.push("--cookies-from-browser".to_string());
            args.push(config.cookies_browser.to_lowercase());
        }
        config.maximum_search_results.clamp(1, 50)
    };

    let normalized = prefix.unwrap_or_default().to_lowercase();
    // Strip trailing digits so user-provided prefix still respects current max_results.
    let base_prefix = normalized.trim_end_matches(|c: char| c.is_ascii_digit());
    let search_prefix = match base_prefix {
        "ytsearch" => format!("ytsearch{}", max_results),
        "ytmsearch" => format!("ytmsearch{}", max_results),
        "scsearch" => format!("scsearch{}", max_results),
        _ => format!("ytsearch{}", max_results),
    };
    args.push(format!("{}:{}", search_prefix, trimmed_query));

    let cmd = BridgeCommand {
        command: "search".to_string(),
        id: task_id.clone(),
        args,
    };

    tokio::task::spawn_blocking(move || {
        let state = app_handle.state::<BridgeState>();
        state.send_raw_command(&app_handle, &cmd)?;
        Ok(task_id)
    })
    .await
    .map_err(|e| format!("Search task failed: {e}"))?
}
