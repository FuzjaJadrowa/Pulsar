pub mod batch;
mod estimate;
mod input;
use crate::app::config::ConfigManager;
use crate::features::downloads::BridgeState;
use crate::system::acceleration;
pub use estimate::EstimatePayload;
use serde::{Deserialize, Serialize};
use std::fs::OpenOptions;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub async fn pick_convert_file(app_handle: AppHandle) -> Result<String, String> {
    let file_path = app_handle.dialog().file().blocking_pick_file();

    match file_path {
        Some(path) => Ok(path.to_string()),
        None => Ok(String::new()),
    }
}

#[tauri::command]
pub async fn pick_convert_files(app_handle: AppHandle) -> Result<Vec<String>, String> {
    let file_paths = app_handle.dialog().file().blocking_pick_files();

    match file_paths {
        Some(paths) => Ok(paths.into_iter().map(|p| p.to_string()).collect()),
        None => Ok(Vec::new()),
    }
}

#[tauri::command]
pub fn estimate_convert_size(payload: EstimatePayload) -> Result<Option<u64>, String> {
    estimate::estimate(payload)
}
#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConvertOptions {
    #[serde(alias = "input_path")]
    pub input_path: String,
    #[serde(default, alias = "output_dir")]
    pub output_dir: Option<String>,
    #[serde(default, alias = "output_name")]
    pub output_name: Option<String>,
    #[serde(alias = "output_format")]
    pub output_format: String,
    pub category: Option<String>,
    #[serde(default, alias = "video_quality")]
    pub video_quality: Option<String>,
    #[serde(default, alias = "video_codec")]
    pub video_codec: Option<String>,
    #[serde(default, alias = "video_bitrate")]
    pub video_bitrate: Option<String>,
    #[serde(default, alias = "video_fps")]
    pub video_fps: Option<String>,
    #[serde(default, alias = "audio_codec")]
    pub audio_codec: Option<String>,
    #[serde(default, alias = "audio_bitrate")]
    pub audio_bitrate: Option<String>,
    #[serde(default, alias = "image_width")]
    pub image_width: Option<u32>,
    #[serde(default, alias = "image_height")]
    pub image_height: Option<u32>,
    #[serde(default, alias = "image_quality")]
    pub image_quality: Option<u32>,
    #[serde(default, alias = "source_duration_seconds")]
    pub source_duration_seconds: Option<f64>,
    #[serde(default, alias = "client_task_id")]
    pub client_task_id: Option<String>,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BatchConvertOptions {
    #[serde(alias = "client_task_id")]
    pub client_task_id: String,
    pub items: Vec<ConvertOptions>,
}

#[derive(Serialize)]
struct ConvertBridgePayload {
    input_path: String,
    output_path: String,
    output_format: String,
    category: String,
    image_width: Option<u32>,
    image_height: Option<u32>,
    image_quality: Option<u32>,
    source_duration_seconds: Option<f64>,
    ffmpeg_path: Option<String>,
    ffmpeg_args: Option<Vec<String>>,
}

#[derive(Serialize)]
struct ConvertBridgeCommand {
    command: String,
    id: String,
    payload: ConvertBridgePayload,
}

fn normalize_output_format(value: &str) -> String {
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

pub fn resolve_unique_output_path(
    output_dir: &Path,
    base_name: &str,
    output_format: &str,
) -> Result<String, String> {
    let fmt = output_format.trim().trim_start_matches('.');
    let initial_filename = if fmt.is_empty() {
        base_name.to_string()
    } else {
        format!("{}.{}", base_name, fmt)
    };
    std::fs::create_dir_all(output_dir).map_err(|error| {
        format!("Unable to create output directory '{}': {error}", output_dir.display())
    })?;
    let mut counter = 0;
    loop {
        let candidate_filename = if counter == 0 {
            initial_filename.clone()
        } else if fmt.is_empty() {
            format!("{}_{}", base_name, counter)
        } else {
            format!("{}_{}.{}", base_name, counter, fmt)
        };
        let candidate_path = output_dir.join(&candidate_filename);
        match OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&candidate_path)
        {
            Ok(_) => return Ok(candidate_path.to_string_lossy().to_string()),
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                counter += 1;
            }
            Err(error) => {
                return Err(format!(
                    "Unable to reserve output path '{}': {error}",
                    candidate_path.display()
                ));
            }
        }
    }
}

fn build_output_path(options: &ConvertOptions, output_format: &str) -> Result<String, String> {
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
    resolve_unique_output_path(
        &output_dir,
        &name,
        output_format,
    )
}

use self::input::{parse_kbps, parse_numeric};
use crate::app::task_id::generate;
use crate::features::downloads::{cancel_download, is_terminal_event};
use crate::infrastructure::ffmpeg::codecs::{
    default_audio_codec_for_format, default_video_codec_for_format, extract_file_extension,
    is_audio_copy_compatible, is_video_copy_compatible, map_audio_codec, map_video_codec,
    map_video_codec_hw,
};
use crate::infrastructure::ffmpeg::paths::get_ffmpeg_path;
use tauri::Emitter;
use tauri::Manager;

fn build_ffmpeg_args(
    options: &ConvertOptions,
    output_path: &str,
    hwaccel: Option<String>,
    config: &crate::app::config::AppConfig,
) -> Vec<String> {
    let mut args = vec![
        "-hide_banner".to_string(),
        "-y".to_string(),
        "-threads".to_string(),
        "0".to_string(),
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

    let category = options.category.as_deref().unwrap_or("video");
    let output_format = normalize_output_format(&options.output_format);
    let source_ext = extract_file_extension(&options.input_path);

    let (eff_vcodec, eff_acodec) = crate::system::formats::resolve_effective_convert_codecs(
        Some(&output_format),
        options.video_codec.as_deref(),
        options.audio_codec.as_deref(),
        Some(&config.default_video_codec),
        Some(&config.default_audio_codec),
    );

    if category == "audio" {
        args.push("-map".to_string());
        args.push("0:a?".to_string());
        args.push("-vn".to_string());
    } else if output_format == "gif" {
        // GIF is video-only. Mapping optional audio makes the GIF muxer reject
        // otherwise valid conversions when the source contains an audio stream.
        args.push("-map".to_string());
        args.push("0:v:0".to_string());
        args.push("-an".to_string());
    } else {
        args.push("-map".to_string());
        args.push("0:v?".to_string());
        args.push("-map".to_string());
        args.push("0:a?".to_string());
    }

    if category == "video" {
        let raw_codec = eff_vcodec
            .unwrap_or_else(|| {
                options
                    .video_codec
                    .as_deref()
                    .unwrap_or("")
                    .trim()
                    .to_string()
            })
            .to_lowercase();
        let has_video_mods = parse_kbps(options.video_bitrate.as_deref()).is_some()
            || parse_numeric(options.video_fps.as_deref()).is_some()
            || options
                .video_quality
                .as_deref()
                .map(|q| q.to_lowercase())
                .filter(|q| q.ends_with('p'))
                .is_some();

        let can_copy_video = config.copy_codec_if_possible
            && !has_video_mods
            && is_video_copy_compatible(&source_ext, &output_format);

        if raw_codec == "copy" || (can_copy_video && (raw_codec.is_empty() || raw_codec == "auto"))
        {
            args.push("-c:v".to_string());
            args.push("copy".to_string());
        } else {
            let codec_to_use = if raw_codec.is_empty() || raw_codec == "auto" {
                default_video_codec_for_format(&output_format)
            } else {
                map_video_codec(&raw_codec)
            };

            args.push("-c:v".to_string());
            let mapped_codec = if let Some(ref accel) = hwaccel {
                if raw_codec.is_empty() || raw_codec == "auto" {
                    map_video_codec_hw("h264", accel)
                } else {
                    map_video_codec_hw(&raw_codec, accel)
                }
            } else {
                codec_to_use.clone()
            };
            args.push(mapped_codec.clone());

            if (mapped_codec == "libx264" || mapped_codec == "libx265") && raw_codec != "copy" {
                args.push("-preset".to_string());
                args.push("veryfast".to_string());
            }

            if let Some(br) = parse_kbps(options.video_bitrate.as_deref()) {
                args.push("-b:v".to_string());
                args.push(format!("{}k", br));
            }
            if let Some(fps) = parse_numeric(options.video_fps.as_deref()) {
                args.push("-r".to_string());
                args.push(fps);
            }
            if let Some(quality) = options.video_quality.as_deref() {
                let lowered = quality.to_lowercase();
                if lowered.ends_with('p') {
                    let height = lowered.trim_end_matches('p');
                    if let Ok(_) = height.parse::<u32>() {
                        args.push("-vf".to_string());
                        args.push(format!("scale=-2:{}", height));
                    }
                }
            }
        }
    }

    if output_format == "gif" {
        args.push(output_path.to_string());
        return args;
    }

    let raw_audio_codec = eff_acodec
        .unwrap_or_else(|| {
            options
                .audio_codec
                .as_deref()
                .unwrap_or("")
                .trim()
                .to_string()
        })
        .to_lowercase();
    let has_audio_mods = parse_kbps(options.audio_bitrate.as_deref()).is_some();
    let can_copy_audio = config.copy_codec_if_possible
        && !has_audio_mods
        && is_audio_copy_compatible(&source_ext, &output_format);

    if raw_audio_codec == "copy"
        || (can_copy_audio && (raw_audio_codec.is_empty() || raw_audio_codec == "auto"))
    {
        args.push("-c:a".to_string());
        args.push("copy".to_string());
    } else {
        let codec_to_use = if raw_audio_codec.is_empty() || raw_audio_codec == "auto" {
            default_audio_codec_for_format(&output_format)
        } else {
            map_audio_codec(&raw_audio_codec)
        };
        args.push("-c:a".to_string());
        args.push(codec_to_use);
    }

    if let Some(br) = parse_kbps(options.audio_bitrate.as_deref()) {
        args.push("-b:a".to_string());
        args.push(format!("{}k", br));
    }

    args.push(output_path.to_string());
    args
}

#[tauri::command]
pub fn start_convert(
    app_handle: AppHandle,
    state: State<BridgeState>,
    config_mgr: State<ConfigManager>,
    options: ConvertOptions,
) -> Result<String, String> {
    let input_path = options.input_path.trim();
    if input_path.is_empty() {
        return Err("Input path cannot be empty.".to_string());
    }
    let output_format = normalize_output_format(&options.output_format);
    if output_format.is_empty() {
        return Err("Output format cannot be empty.".to_string());
    }
    let output_path = build_output_path(&options, &output_format)?;
    let category = options
        .category
        .as_deref()
        .map(|c| c.trim().to_lowercase())
        .filter(|c| !c.is_empty())
        .unwrap_or_else(|| "image".to_string());

    let ffmpeg_path = get_ffmpeg_path();
    let hwaccel = acceleration::resolve_hwaccel(&config_mgr);
    let config = config_mgr.config.lock().unwrap();
    crate::system::formats::validate_codec_support(
        &output_format,
        options.video_codec.as_deref(),
        true,
        true,
    )
    .map_err(|error| {
        let _ = std::fs::remove_file(&output_path);
        error
    })?;
    crate::system::formats::validate_codec_support(
        &output_format,
        options.audio_codec.as_deref(),
        false,
        true,
    )
    .map_err(|error| {
        let _ = std::fs::remove_file(&output_path);
        error
    })?;
    let ffmpeg_args = if category == "video" || category == "audio" {
        Some(build_ffmpeg_args(&options, &output_path, hwaccel, &config))
    } else {
        None
    };
    drop(config);
    if let Some(args) = ffmpeg_args.as_deref() {
        crate::infrastructure::ffmpeg::codecs::validate_ffmpeg_encoders(&ffmpeg_path, args)
            .map_err(|error| {
                let _ = std::fs::remove_file(&output_path);
                error
            })?;
    }

    let task_id = options
        .client_task_id
        .as_ref()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(generate);

    let output_path_for_cleanup = output_path.clone();
    let payload = ConvertBridgePayload {
        input_path: input_path.to_string(),
        output_path,
        output_format,
        category,
        image_width: options.image_width,
        image_height: options.image_height,
        image_quality: options.image_quality,
        source_duration_seconds: options.source_duration_seconds,
        ffmpeg_path: if ffmpeg_args.is_some() {
            Some(ffmpeg_path.to_string_lossy().to_string())
        } else {
            None
        },
        ffmpeg_args,
    };

    let cmd = ConvertBridgeCommand {
        command: "convert".to_string(),
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
