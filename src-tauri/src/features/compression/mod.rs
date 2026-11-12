mod args;
mod quality;
use self::args::build_ffmpeg_args;
use crate::app::config::ConfigManager;
use crate::features::downloads::BridgeState;
use crate::system::acceleration;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, State};

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CompressOptions {
    #[serde(alias = "input_path")]
    pub input_path: String,
    #[serde(default, alias = "output_dir")]
    pub output_dir: Option<String>,
    #[serde(default, alias = "output_name")]
    pub output_name: Option<String>,
    #[serde(default, alias = "output_format")]
    pub output_format: Option<String>,
    pub category: Option<String>,
    #[serde(default, alias = "compress_mode")]
    pub compress_mode: Option<String>,
    #[serde(default, alias = "target_percent")]
    pub target_percent: Option<f64>,
    #[serde(default, alias = "target_size_bytes")]
    pub target_size_bytes: Option<u64>,
    pub crf: Option<u32>,
    #[serde(default, alias = "video_codec")]
    pub video_codec: Option<String>,
    #[serde(default, alias = "audio_codec")]
    pub audio_codec: Option<String>,
    #[serde(default, alias = "source_duration_seconds")]
    pub source_duration_seconds: Option<f64>,
    #[serde(default, alias = "source_size_bytes")]
    pub source_size_bytes: Option<u64>,
    #[serde(default, alias = "source_format")]
    pub source_format: Option<String>,
    #[serde(default, alias = "client_task_id")]
    pub client_task_id: Option<String>,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BatchCompressOptions {
    #[serde(alias = "client_task_id")]
    pub client_task_id: String,
    pub items: Vec<CompressOptions>,
}

#[derive(Serialize)]
struct CompressBridgePayload {
    input_path: String,
    output_path: String,
    category: String,
    compress_mode: String,
    source_duration_seconds: Option<f64>,
    source_size_bytes: Option<u64>,
    ffmpeg_path: String,
    ffmpeg_args: Vec<String>,
    two_pass: bool,
}

#[derive(Serialize)]
struct CompressBridgeCommand {
    command: String,
    id: String,
    payload: CompressBridgePayload,
}

fn normalize_format(value: &str) -> String {
    let mut normalized = value.trim().to_lowercase();
    while normalized.starts_with('.') {
        normalized.remove(0);
    }
    normalized
}

fn sanitize_output_name(value: &str) -> String {
    value
        .replace('\\', " ")
        .replace('/', " ")
        .trim()
        .to_string()
}

fn resolve_output_dir(input_path: &Path, output_dir: Option<&str>) -> Result<PathBuf, String> {
    if let Some(raw) = output_dir {
        let trimmed = raw.trim();
        if !trimmed.is_empty() {
            return Ok(PathBuf::from(trimmed));
        }
    }
    input_path
        .parent()
        .map(|p| p.to_path_buf())
        .ok_or_else(|| "Unable to resolve output directory.".to_string())
}

fn resolve_output_name(input_path: &Path, output_name: Option<&str>) -> String {
    let base = output_name
        .and_then(|name| {
            let trimmed = name.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(sanitize_output_name(trimmed))
            }
        })
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| {
            input_path
                .file_stem()
                .and_then(|s| s.to_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| "output".to_string())
        });
    Path::new(&base)
        .file_stem()
        .and_then(|s| s.to_str())
        .map(|s| s.to_string())
        .unwrap_or(base)
}

fn resolve_output_format(options: &CompressOptions, input_path: &Path) -> String {
    if let Some(fmt) = options.output_format.as_deref() {
        let normalized = normalize_format(fmt);
        if !normalized.is_empty() {
            return normalized;
        }
    }
    if let Some(fmt) = options.source_format.as_deref() {
        let normalized = normalize_format(fmt);
        if !normalized.is_empty() {
            return normalized;
        }
    }
    input_path
        .extension()
        .and_then(|s| s.to_str())
        .map(normalize_format)
        .unwrap_or_default()
}

fn build_output_path(options: &CompressOptions, output_format: &str) -> Result<String, String> {
    let input_path = Path::new(options.input_path.trim());
    let output_dir = resolve_output_dir(input_path, options.output_dir.as_deref())?;
    let mut name = resolve_output_name(input_path, options.output_name.as_deref());
    if !output_format.is_empty() {
        let suffix = format!(".{}", output_format);
        if name.to_lowercase().ends_with(&suffix) {
            name = name[..name.len() - suffix.len()].to_string();
        }
    }
    if name.trim().is_empty() {
        name = "output".to_string();
    }
    crate::features::conversion::resolve_unique_output_path(
        &output_dir,
        &name,
        output_format,
    )
}

use crate::app::task_id::generate;
use crate::features::downloads::{cancel_download, is_terminal_event, terminal_event_succeeded};
use crate::infrastructure::ffmpeg::paths::get_ffmpeg_path;
use tauri::Emitter;
use tauri::Manager;

#[tauri::command]
pub fn start_compress(
    app_handle: AppHandle,
    state: State<BridgeState>,
    config_mgr: State<ConfigManager>,
    options: CompressOptions,
) -> Result<String, String> {
    let input_path = options.input_path.trim();
    if input_path.is_empty() {
        return Err("Input path cannot be empty.".to_string());
    }

    let category = options
        .category
        .as_deref()
        .map(|c| c.trim().to_lowercase())
        .filter(|c| !c.is_empty())
        .unwrap_or_else(|| "video".to_string());
    if category != "video" && category != "audio" && category != "image" {
        return Err("Unsupported compression category.".to_string());
    }

    let input_path_obj = Path::new(input_path);
    let output_format = resolve_output_format(&options, input_path_obj);
    if output_format.is_empty() {
        return Err("Output format cannot be empty.".to_string());
    }
    let output_path = build_output_path(&options, &output_format)?;

    let ffmpeg_path = get_ffmpeg_path();
    {
        let config = config_mgr.config.lock().unwrap();
        if config.ffmpeg_hwaccel != "none"
            && config.ffmpeg_hwaccel != "false"
            && config.ffmpeg_hwaccels.is_empty()
        {
            drop(config);
            let _ = acceleration::refresh_acceleration_info(config_mgr.clone());
        }
    }
    let hwaccel = acceleration::resolve_hwaccel(&config_mgr);
    let ffmpeg_args = build_ffmpeg_args(&options, &output_path, hwaccel).map_err(|error| {
        let _ = std::fs::remove_file(&output_path);
        error
    })?;
    crate::infrastructure::ffmpeg::codecs::validate_ffmpeg_encoders(&ffmpeg_path, &ffmpeg_args)
        .map_err(|error| {
            let _ = std::fs::remove_file(&output_path);
            error
        })?;

    let task_id = options
        .client_task_id
        .as_ref()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(generate);

    let compress_mode = options
        .compress_mode
        .clone()
        .unwrap_or_else(|| "percent".to_string());
    let selected_video_encoder = ffmpeg_args
        .windows(2)
        .find(|pair| pair[0] == "-c:v")
        .map(|pair| pair[1].as_str())
        .unwrap_or("");
    let two_pass = category == "video"
        && !compress_mode.trim().eq_ignore_ascii_case("quality")
        && matches!(
            selected_video_encoder,
            "libx264" | "libvpx" | "libvpx-vp9"
        );

    let output_path_for_cleanup = output_path.clone();
    let payload = CompressBridgePayload {
        input_path: input_path.to_string(),
        output_path,
        category,
        compress_mode,
        source_duration_seconds: options.source_duration_seconds,
        source_size_bytes: options.source_size_bytes,
        ffmpeg_path: ffmpeg_path.to_string_lossy().to_string(),
        ffmpeg_args,
        two_pass,
    };

    let cmd = CompressBridgeCommand {
        command: "compress".to_string(),
        id: task_id.clone(),
        payload,
    };

    state.register_output_path(task_id.clone(), Path::new(&output_path_for_cleanup).to_path_buf());
    if let Err(error) = state.send_raw_command(&app_handle, &cmd) {
        state.unregister_output_path(&task_id);
        let _ = std::fs::remove_file(output_path_for_cleanup);
        return Err(error);
    }

    Ok(task_id)
}

#[tauri::command]
pub fn start_batch_compress(
    app_handle: AppHandle,
    state: State<BridgeState>,
    options: BatchCompressOptions,
) -> Result<String, String> {
    let task_id = options.client_task_id.trim().to_string();
    if task_id.is_empty() {
        return Err("Task ID cannot be empty.".to_string());
    }
    if options.items.is_empty() {
        return Err("Batch items list cannot be empty.".to_string());
    }

    let items = options.items;
    let cancel_flag = state.register_batch_cancel(task_id.clone());

    let max_concurrent = app_handle
        .state::<ConfigManager>()
        .config
        .lock()
        .unwrap()
        .maximum_concurrent_processes as usize;

    let app_handle_clone = app_handle.clone();
    let task_id_clone = task_id.clone();

    std::thread::spawn(move || {
        use std::sync::atomic::{AtomicBool, Ordering};
        let failed = std::sync::Arc::new(AtomicBool::new(false));
        let total = items.len();
        let category = items[0]
            .category
            .as_deref()
            .unwrap_or("video")
            .trim()
            .to_lowercase();

        let emit_event = |payload: serde_json::Value| {
            let _ = app_handle_clone.emit("download-event", payload);
        };

        if category == "video" || category == "audio" {
            for (idx, mut item_opts) in items.into_iter().enumerate() {
                if cancel_flag.load(std::sync::atomic::Ordering::SeqCst) {
                    emit_event(serde_json::json!({ "type": "cancelled", "id": task_id_clone }));
                    let bridge_state = app_handle_clone.state::<BridgeState>();
                    bridge_state.unregister_batch_cancel(&task_id_clone);
                    return;
                }

                let sub_id = format!("{}_sub_{}", task_id_clone, idx);
                item_opts.client_task_id = Some(sub_id.clone());

                let bridge_state = app_handle_clone.state::<BridgeState>();
                let config_mgr_state = app_handle_clone.state::<ConfigManager>();
                let sub_rx = bridge_state.register_sub_listener(sub_id.clone());

                let result = start_compress(
                    app_handle_clone.clone(),
                    bridge_state.clone(),
                    config_mgr_state.clone(),
                    item_opts,
                );
                let mut item_succeeded = false;
                match result {
                    Ok(_) => {
                        while let Ok(msg) = sub_rx.recv() {
                            if cancel_flag.load(std::sync::atomic::Ordering::SeqCst) {
                                let _ = cancel_download(
                                    app_handle_clone.clone(),
                                    bridge_state.clone(),
                                    sub_id.clone(),
                                );
                                break;
                            }

                            let sub_pct =
                                msg.get("percent").and_then(|v| v.as_f64()).unwrap_or(0.0);
                            let overall_pct = (((idx as f64) + (sub_pct / 100.0)) / (total as f64)
                                * 100.0)
                                .clamp(0.0, 100.0);
                            emit_event(serde_json::json!({
                                "type": "progress",
                                "id": task_id_clone,
                                "percent": overall_pct,
                                "item_index": idx + 1,
                                "item_count": total
                            }));

                            if is_terminal_event(&msg) {
                                item_succeeded = terminal_event_succeeded(&msg);
                                break;
                            }
                        }
                    }
                    Err(error) => emit_event(serde_json::json!({
                        "type": "item_error", "id": task_id_clone, "item_index": idx + 1, "error": error
                    })),
                }
                if !item_succeeded && !cancel_flag.load(std::sync::atomic::Ordering::SeqCst) {
                    failed.store(true, Ordering::SeqCst);
                }
                bridge_state.unregister_sub_listener(&sub_id);
            }
        } else {
            use std::sync::atomic::{AtomicUsize, Ordering};
            use std::sync::{Arc, Mutex};

            let completed = Arc::new(AtomicUsize::new(0));
            let items_queue = Arc::new(Mutex::new(
                items.into_iter().enumerate().collect::<Vec<_>>(),
            ));

            let mut threads = Vec::new();
            for _ in 0..max_concurrent {
                let queue = items_queue.clone();
                let completed_ref = completed.clone();
                let cancel_ref = cancel_flag.clone();
                let app = app_handle_clone.clone();
                let tid = task_id_clone.clone();
                let failed_ref = failed.clone();

                let handle = std::thread::spawn(move || loop {
                    if cancel_ref.load(Ordering::SeqCst) {
                        break;
                    }
                    let next_item = {
                        let mut q = queue.lock().unwrap();
                        if q.is_empty() {
                            None
                        } else {
                            Some(q.remove(0))
                        }
                    };

                    let (idx, mut item_opts) = match next_item {
                        Some(item) => item,
                        None => break,
                    };

                    let sub_id = format!("{}_sub_{}", tid, idx);
                    item_opts.client_task_id = Some(sub_id.clone());

                    let bridge_state = app.state::<BridgeState>();
                    let config_mgr_state = app.state::<ConfigManager>();
                    let sub_rx = bridge_state.register_sub_listener(sub_id.clone());

                    let result = start_compress(
                        app.clone(),
                        bridge_state.clone(),
                        config_mgr_state.clone(),
                        item_opts,
                    );
                    let mut item_succeeded = false;
                    match result {
                        Ok(_) => {
                            while let Ok(msg) = sub_rx.recv() {
                                if cancel_ref.load(Ordering::SeqCst) {
                                    let _ = cancel_download(
                                        app.clone(),
                                        bridge_state.clone(),
                                        sub_id.clone(),
                                    );
                                    break;
                                }
                                if is_terminal_event(&msg) {
                                    item_succeeded = terminal_event_succeeded(&msg);
                                    break;
                                }
                            }
                        }
                        Err(error) => {
                            failed_ref.store(true, Ordering::SeqCst);
                            let _ = app.emit("download-event", serde_json::json!({
                                "type": "item_error", "id": tid, "item_index": idx + 1, "error": error
                            }));
                        }
                    }
                    if !item_succeeded && !cancel_ref.load(Ordering::SeqCst) {
                        failed_ref.store(true, Ordering::SeqCst);
                    }
                    bridge_state.unregister_sub_listener(&sub_id);

                    let count = completed_ref.fetch_add(1, Ordering::SeqCst) + 1;
                    let pct = ((count as f64) / (total as f64) * 100.0).clamp(0.0, 100.0);
                    let _ = app.emit(
                        "download-event",
                        serde_json::json!({
                            "type": "progress",
                            "id": tid,
                            "percent": pct,
                            "item_index": count,
                            "item_count": total
                        }),
                    );
                });
                threads.push(handle);
            }

            for t in threads {
                let _ = t.join();
            }
        }

        if cancel_flag.load(std::sync::atomic::Ordering::SeqCst) {
            emit_event(serde_json::json!({ "type": "cancelled", "id": task_id_clone }));
        } else {
            emit_event(
                serde_json::json!({ "type": "finished", "id": task_id_clone, "success": !failed.load(std::sync::atomic::Ordering::SeqCst) }),
            );
        }

        let bridge_state = app_handle_clone.state::<BridgeState>();
        bridge_state.unregister_batch_cancel(&task_id_clone);
    });

    Ok(task_id)
}
