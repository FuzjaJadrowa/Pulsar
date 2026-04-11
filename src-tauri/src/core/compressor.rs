use serde::{Deserialize, Serialize};
use directories::BaseDirs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, State};
use crate::core::acceleration;
use crate::core::downloader::BridgeState;
use crate::system::config::ConfigManager;

#[derive(Deserialize, Debug)]
pub struct CompressOptions {
    input_path: String,
    output_dir: Option<String>,
    output_name: Option<String>,
    output_format: Option<String>,
    category: Option<String>,
    compress_mode: Option<String>,
    target_percent: Option<f64>,
    target_size_bytes: Option<u64>,
    crf: Option<u32>,
    video_codec: Option<String>,
    audio_codec: Option<String>,
    source_duration_seconds: Option<f64>,
    source_size_bytes: Option<u64>,
    source_format: Option<String>,
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

fn get_requirements_path() -> PathBuf {
    if cfg!(target_os = "linux") {
        let flatpak_channel = std::env::var("PULSAR_DIST")
            .map(|v| v.trim().eq_ignore_ascii_case("flatpak"))
            .unwrap_or(false);
        let in_flatpak = std::env::var("FLATPAK_ID")
            .map(|v| !v.trim().is_empty())
            .unwrap_or(false);
        if flatpak_channel || in_flatpak {
            if let Ok(dir) = std::env::var("PULSAR_REQUIREMENTS_DIR") {
                let trimmed = dir.trim();
                if !trimmed.is_empty() {
                    return PathBuf::from(trimmed);
                }
            }
            return PathBuf::from("/app/lib/pulsar/requirements");
        }
    }
    if let Some(base_dirs) = BaseDirs::new() {
        return base_dirs.data_local_dir().join("Pulsar").join("Requirements");
    }
    PathBuf::from("Requirements")
}

fn get_ffmpeg_path() -> PathBuf {
    let req_path = get_requirements_path();
    let ffmpeg_name = if cfg!(target_os = "windows") { "ffmpeg.exe" } else { "ffmpeg" };
    req_path.join(ffmpeg_name)
}

fn clamp_f64(value: f64, min: f64, max: f64) -> f64 {
    if !value.is_finite() {
        return min;
    }
    if value < min {
        return min;
    }
    if value > max {
        return max;
    }
    value
}

fn qscale_from_percent(percent: f64) -> u32 {
    let clamped = clamp_f64(percent, 1.0, 100.0);
    let q = 2.0 + (100.0 - clamped) / 100.0 * 29.0;
    clamp_f64(q, 2.0, 31.0).round() as u32
}

fn qscale_from_crf(crf: u32) -> u32 {
    let clamped = (crf.min(51)) as f64;
    let q = 2.0 + (clamped / 51.0) * 29.0;
    clamp_f64(q, 2.0, 31.0).round() as u32
}

fn map_video_codec(value: &str) -> String {
    match value.to_lowercase().as_str() {
        "h264" => "libx264",
        "h265" | "hevc" => "libx265",
        "av1" => "libaom-av1",
        "vp9" => "libvpx-vp9",
        "vp8" => "libvpx",
        "mpeg2" => "mpeg2video",
        "mpeg4" => "mpeg4",
        "h263" => "h263",
        "theora" => "libtheora",
        "wmv" => "wmv2",
        "prores" => "prores_ks",
        "gif" => "gif",
        other => other
    }.to_string()
}

fn map_audio_codec(value: &str) -> String {
    match value.to_lowercase().as_str() {
        "aac" => "aac",
        "mp3" => "libmp3lame",
        "opus" => "libopus",
        "vorbis" => "libvorbis",
        "flac" => "flac",
        "alac" => "alac",
        "wav" => "pcm_s16le",
        "aiff" => "pcm_s16be",
        "ac3" => "ac3",
        "wma" => "wmav2",
        "dts" => "dca",
        "lpcm" => "pcm_s16le",
        "midi" => "copy",
        "amr" => "libopencore_amrnb",
        "amr-wb" => "libopencore_amrwb",
        "he-aac" => "aac",
        other => other
    }.to_string()
}

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
        "-y".to_string()
    ];

    if let Some(accel) = hwaccel {
        args.push("-hwaccel".to_string());
        args.push(accel);
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
            .map(map_video_codec);
        if let Some(codec) = requested_video_codec {
            args.push("-c:v".to_string());
            args.push(codec);
        } else if mode == "quality" {
            args.push("-c:v".to_string());
            args.push("libx264".to_string());
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

fn generate_task_id() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis();
    now.to_string()
}

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
        if config.ffmpeg_hwaccel && config.ffmpeg_hwaccels.is_empty() {
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

// Preparing for refactoring code
/*#[cfg(test)]
mod tests {
    use super::*;

    fn sample_compress_options(input_path: String) -> CompressOptions {
        CompressOptions {
            input_path,
            output_dir: None,
            output_name: None,
            output_format: Some("mp4".to_string()),
            category: Some("video".to_string()),
            compress_mode: Some("percent".to_string()),
            target_percent: Some(50.0),
            target_size_bytes: None,
            crf: Some(24),
            video_codec: Some("h264".to_string()),
            audio_codec: Some("aac".to_string()),
            source_duration_seconds: Some(100.0),
            source_size_bytes: Some(100_000_000),
            source_format: Some("mp4".to_string()),
            client_task_id: None,
        }
    }

    #[test]
    fn normalize_format_strips_dot_and_case() {
        assert_eq!(normalize_format(" .MKV "), "mkv");
    }

    #[test]
    fn qscale_helpers_respect_bounds() {
        assert_eq!(qscale_from_percent(100.0), 2);
        assert_eq!(qscale_from_percent(1.0), 31);
        assert_eq!(qscale_from_crf(0), 2);
        assert_eq!(qscale_from_crf(51), 31);
    }

    #[test]
    fn resolve_target_bytes_percent_mode() {
        let options = sample_compress_options("video.mp4".to_string());
        let target = resolve_target_bytes(&options, "percent");
        assert_eq!(target, Some(50_000_000));
    }

    #[test]
    fn build_output_path_avoids_overwriting_input_file() {
        let input_path = std::env::temp_dir().join("clip.mp4");
        let input_str = input_path.to_string_lossy().to_string();
        let mut options = sample_compress_options(input_str.clone());
        options.output_dir = input_path.parent().map(|p| p.to_string_lossy().to_string());
        options.output_name = Some("clip".to_string());
        options.output_format = Some("mp4".to_string());

        let out = build_output_path(&options, "mp4").expect("output path");

        assert_ne!(out.to_lowercase(), input_str.to_lowercase());
        assert!(out.ends_with("-processed.mp4"));
    }
}*/