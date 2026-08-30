use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, State};
use crate::core::acceleration;
use crate::core::downloader::BridgeState;
use crate::system::config::ConfigManager;

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CompressOptions {
    #[serde(alias = "input_path")]
    input_path: String,
    #[serde(default, alias = "output_dir")]
    output_dir: Option<String>,
    #[serde(default, alias = "output_name")]
    output_name: Option<String>,
    #[serde(default, alias = "output_format")]
    output_format: Option<String>,
    category: Option<String>,
    #[serde(default, alias = "compress_mode")]
    compress_mode: Option<String>,
    #[serde(default, alias = "target_percent")]
    target_percent: Option<f64>,
    #[serde(default, alias = "target_size_bytes")]
    target_size_bytes: Option<u64>,
    crf: Option<u32>,
    #[serde(default, alias = "video_codec")]
    video_codec: Option<String>,
    #[serde(default, alias = "audio_codec")]
    audio_codec: Option<String>,
    #[serde(default, alias = "source_duration_seconds")]
    source_duration_seconds: Option<f64>,
    #[serde(default, alias = "source_size_bytes")]
    source_size_bytes: Option<u64>,
    #[serde(default, alias = "source_format")]
    source_format: Option<String>,
    #[serde(default, alias = "client_task_id")]
    client_task_id: Option<String>,
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
    value.replace('\\', " ").replace('/', " ").trim().to_string()
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
    let file_name = if output_format.is_empty() {
        name.clone()
    } else {
        format!("{}.{}", name, output_format)
    };
    let mut output_path = output_dir.join(file_name).to_string_lossy().to_string();
    let input_str = input_path.to_string_lossy().to_string();
    let equal = if cfg!(target_os = "windows") {
        output_path.eq_ignore_ascii_case(&input_str)
    } else {
        output_path == input_str
    };
    if equal {
        // Avoid rewriting the source file when output resolves to the same path.
        let suffix = "-processed";
        let file_name = if output_format.is_empty() {
            format!("{}{}", name, suffix)
        } else {
            format!("{}{}.{output_format}", name, suffix)
        };
        output_path = output_dir.join(file_name).to_string_lossy().to_string();
    }
    Ok(output_path)
}

use crate::core::utils::{get_ffmpeg_path, map_video_codec, map_audio_codec, map_video_codec_hw, clamp_f64, qscale_from_percent, qscale_from_crf};

fn resolve_target_bytes(options: &CompressOptions, mode: &str) -> Option<u64> {
    match mode {
        "size" => options.target_size_bytes,
        "percent" => {
            let percent = options.target_percent.unwrap_or(60.0).clamp(1.0, 100.0);
            options
                .source_size_bytes
                .map(|s| ((s as f64) * (percent / 100.0)).round() as u64)
        }
        _ => None
    }
}

fn build_ffmpeg_args(options: &CompressOptions, output_path: &str, hwaccel: Option<String>) -> Result<Vec<String>, String> {
    let mut args = vec![
        "-hide_banner".to_string(),
        "-y".to_string(),
        "-threads".to_string(),
        "0".to_string()
    ];

    if let Some(accel) = hwaccel.clone() {
        args.push("-hwaccel".to_string());
        args.push(accel.clone());
        if accel == "cuda" || accel == "qsv" || accel == "d3d11va" {
            args.push("-hwaccel_output_format".to_string());
            args.push(accel);
        }
    }

    args.push("-i".to_string());
    args.push(options.input_path.clone());

    let category = options
        .category
        .as_deref()
        .unwrap_or("video")
        .trim()
        .to_lowercase();

    if category == "audio" {
        args.push("-map".to_string());
        args.push("0:a?".to_string());
        args.push("-vn".to_string());
    } else if category == "image" {
        args.push("-map".to_string());
        args.push("0:v?".to_string());
        args.push("-frames:v".to_string());
        args.push("1".to_string());
    } else {
        args.push("-map".to_string());
        args.push("0:v?".to_string());
        args.push("-map".to_string());
        args.push("0:a?".to_string());
    }

    let mode = options
        .compress_mode
        .as_deref()
        .unwrap_or("percent")
        .trim()
        .to_lowercase();

    if category == "video" {
        let requested_video_codec = options
            .video_codec
            .as_deref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .map(|c| {
                if let Some(ref accel) = hwaccel {
                    map_video_codec_hw(c, accel)
                } else {
                    map_video_codec(c)
                }
            });
        if let Some(codec) = requested_video_codec {
            args.push("-c:v".to_string());
            args.push(codec.clone());
            if (codec == "libx264" || codec == "libx265") && options.video_codec.as_deref().unwrap_or("").to_lowercase() != "copy" {
                args.push("-preset".to_string());
                args.push("veryfast".to_string());
            }
        } else if mode == "quality" {
            args.push("-c:v".to_string());
            let default_codec = if let Some(ref accel) = hwaccel {
                map_video_codec_hw("h264", accel)
            } else {
                "libx264".to_string()
            };
            args.push(default_codec.clone());
            if default_codec == "libx264" {
                args.push("-preset".to_string());
                args.push("veryfast".to_string());
            }
        }

        let requested_audio_codec = options
            .audio_codec
            .as_deref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .map(map_audio_codec);
        if let Some(codec) = requested_audio_codec {
            args.push("-c:a".to_string());
            args.push(codec);
        }
    } else {
        let requested_audio_codec = options
            .audio_codec
            .as_deref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .map(map_audio_codec);
        if let Some(codec) = requested_audio_codec {
            args.push("-c:a".to_string());
            args.push(codec);
        }
    }

    if category == "image" {
        let mut quality_percent = options.target_percent.unwrap_or(60.0);
        if mode == "size" {
            if let (Some(target), Some(source)) = (options.target_size_bytes, options.source_size_bytes) {
                if source > 0 {
                    quality_percent = (target as f64 / source as f64) * 100.0;
                }
            }
        } else if mode == "quality" {
            let crf = options.crf.unwrap_or(26);
            let qscale = qscale_from_crf(crf);
            args.push("-q:v".to_string());
            args.push(qscale.to_string());
            args.push(output_path.to_string());
            return Ok(args);
        }

        let qscale = qscale_from_percent(quality_percent);
        args.push("-q:v".to_string());
        args.push(qscale.to_string());
        args.push(output_path.to_string());
        return Ok(args);
    }

    let duration = options.source_duration_seconds.unwrap_or(0.0);
    let target_bytes = resolve_target_bytes(options, mode.as_str());
    let total_kbps = if let (Some(bytes), true) = (target_bytes, duration > 0.0) {
        Some((bytes as f64 * 8.0) / (duration * 1000.0))
    } else {
        None
    };

    if mode == "quality" {
        let crf = options.crf.unwrap_or(26).min(51);
        if category == "video" {
            args.push("-crf".to_string());
            args.push(crf.to_string());
            args.push("-b:a".to_string());
            args.push("192k".to_string());
        } else {
            let source_kbps = if duration > 0.0 {
                options
                    .source_size_bytes
                    .map(|s| (s as f64 * 8.0) / (duration * 1000.0))
                    .unwrap_or(192.0)
            } else {
                192.0
            };
            let factor = 1.0 - (crf as f64 / 51.0) * 0.7;
            let target_kbps = clamp_f64(source_kbps * factor, 48.0, 320.0);
            args.push("-b:a".to_string());
            args.push(format!("{}k", target_kbps.round().max(24.0)));
        }
    } else if let Some(kbps) = total_kbps {
        if category == "audio" {
            let target_kbps = clamp_f64(kbps, 32.0, 320.0);
            args.push("-b:a".to_string());
            args.push(format!("{}k", target_kbps.round().max(24.0)));
        } else {
            let mut audio_kbps = clamp_f64(kbps * 0.1, 64.0, 192.0);
            let mut video_kbps = kbps - audio_kbps;
            // Keep a safe floor for video bitrate in constrained-size mode.
            if video_kbps < 200.0 {
                video_kbps = 200.0;
                audio_kbps = (kbps - video_kbps).max(32.0);
            }
            args.push("-b:v".to_string());
            args.push(format!("{}k", video_kbps.round().max(100.0)));
            if audio_kbps > 0.0 {
                args.push("-b:a".to_string());
                args.push(format!("{}k", audio_kbps.round().max(24.0)));
            }
        }
    } else if let Some(bytes) = target_bytes {
        args.push("-fs".to_string());
        args.push(bytes.to_string());
    } else {
        return Err("Target size could not be resolved.".to_string());
    }

    args.push(output_path.to_string());
    Ok(args)
}

use crate::core::utils::generate_task_id;

#[tauri::command]
pub fn start_compress(
    app_handle: AppHandle,
    state: State<BridgeState>,
    config_mgr: State<ConfigManager>,
    options: CompressOptions
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
        if config.ffmpeg_hwaccel != "none" && config.ffmpeg_hwaccel != "false" && config.ffmpeg_hwaccels.is_empty() {
            drop(config);
            let _ = acceleration::refresh_acceleration_info(config_mgr.clone());
        }
    }
    let hwaccel = acceleration::resolve_hwaccel(&config_mgr);
    let ffmpeg_args = build_ffmpeg_args(&options, &output_path, hwaccel)?;

    let task_id = options
        .client_task_id
        .as_ref()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(generate_task_id);

    let compress_mode = options
        .compress_mode
        .clone()
        .unwrap_or_else(|| "percent".to_string());

    let payload = CompressBridgePayload {
        input_path: input_path.to_string(),
        output_path,
        category,
        compress_mode,
        source_duration_seconds: options.source_duration_seconds,
        source_size_bytes: options.source_size_bytes,
        ffmpeg_path: ffmpeg_path.to_string_lossy().to_string(),
        ffmpeg_args,
    };

    let cmd = CompressBridgeCommand {
        command: "compress".to_string(),
        id: task_id.clone(),
        payload,
    };

    state.send_raw_command(&app_handle, &cmd)?;

    Ok(task_id)
}