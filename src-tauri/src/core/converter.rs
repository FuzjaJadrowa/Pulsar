use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::OnceLock;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;
use crate::core::downloader::BridgeState;
use crate::core::acceleration;
use crate::system::config::ConfigManager;

#[derive(Deserialize, Default)]
pub struct EstimatePayload {
    source_size_bytes: Option<u64>,
    source_duration_seconds: Option<f64>,
    source_width: Option<u32>,
    source_height: Option<u32>,
    source_category: Option<String>,
    category: Option<String>,
    format: Option<String>,
    video_quality: Option<String>,
    video_codec: Option<String>,
    video_bitrate: Option<String>,
    video_fps: Option<String>,
    audio_codec: Option<String>,
    audio_bitrate: Option<String>,
    image_width: Option<u32>,
    image_height: Option<u32>,
    image_quality: Option<u32>,
}

#[derive(Deserialize, Default, Clone)]
struct ESizeDefaults {
    container_overhead: f64,
    video_bitrate_kbps: f64,
    audio_bitrate_kbps: f64,
    video_bitrate_min_kbps: f64,
    video_bitrate_max_kbps: f64,
    audio_bitrate_min_kbps: f64,
    audio_bitrate_max_kbps: f64,
    image_bpp: f64,
    image_quality_min: f64,
}

#[derive(Deserialize, Default, Clone)]
struct ESizeImageFormat {
    bpp: Option<f64>,
    quality_weight: Option<f64>,
}

#[derive(Deserialize, Default, Clone)]
struct ESizeData {
    #[serde(default)]
    defaults: ESizeDefaults,
    #[serde(default)]
    video_quality_kbps: HashMap<String, f64>,
    #[serde(default)]
    fps_multiplier: HashMap<String, f64>,
    #[serde(default)]
    video_codecs: HashMap<String, f64>,
    #[serde(default)]
    audio_codecs: HashMap<String, f64>,
    #[serde(default)]
    image_formats: HashMap<String, ESizeImageFormat>,
    #[serde(default)]
    container_overhead: HashMap<String, f64>,
}

#[derive(Deserialize, Default)]
struct FormatCatalog {
    #[serde(default)]
    esize: ESizeData,
}

static ESIZE_CACHE: OnceLock<ESizeData> = OnceLock::new();

fn load_esize() -> &'static ESizeData {
    ESIZE_CACHE.get_or_init(|| {
        // Cache once per process
        let raw = include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/../public/assets/format.json"));
        serde_json::from_str::<FormatCatalog>(raw)
            .map(|data| data.esize)
            .unwrap_or_default()
    })
}

fn normalize_key(value: &str) -> String {
    value.trim().to_lowercase()
}

fn normalize_format_key(value: &str) -> String {
    let mut key = normalize_key(value);
    while key.starts_with('.') {
        key.remove(0);
    }
    key
}

fn parse_kbps_value(raw: Option<&str>) -> Option<f64> {
    let raw = raw?.trim();
    if raw.is_empty() {
        return None;
    }
    let digits: String = raw.chars().filter(|ch| ch.is_ascii_digit()).collect();
    if digits.is_empty() {
        return None;
    }
    digits.parse::<f64>().ok()
}

fn parse_numeric_value(raw: Option<&str>) -> Option<f64> {
    let raw = raw?.trim();
    if raw.is_empty() {
        return None;
    }
    let mut buf = String::new();
    for ch in raw.chars() {
        if ch.is_ascii_digit() || ch == '.' {
            buf.push(ch);
        }
    }
    if buf.is_empty() {
        None
    } else {
        buf.parse::<f64>().ok()
    }
}

fn clamp_value(value: f64, min: f64, max: f64) -> f64 {
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

fn lookup_multiplier(map: &HashMap<String, f64>, key: Option<&str>, fallback: f64) -> f64 {
    let Some(raw) = key else { return fallback };
    let normalized = normalize_key(raw);
    map.get(&normalized).copied().unwrap_or(fallback)
}

fn resolve_overhead(esize: &ESizeData, format: Option<&str>) -> f64 {
    let default = if esize.defaults.container_overhead > 0.0 {
        esize.defaults.container_overhead
    } else {
        1.0
    };
    let Some(fmt) = format else { return default };
    let key = normalize_format_key(fmt);
    esize.container_overhead.get(&key).copied().unwrap_or(default)
}

fn resolve_audio_bitrate(payload: &EstimatePayload, esize: &ESizeData, allow_source: bool) -> f64 {
    let defaults = &esize.defaults;
    let mut bitrate = parse_kbps_value(payload.audio_bitrate.as_deref()).or_else(|| {
        if allow_source {
            if let (Some(size), Some(duration)) =
                (payload.source_size_bytes, payload.source_duration_seconds)
            {
                if duration > 0.0 {
                    return Some((size as f64 * 8.0) / (duration * 1000.0));
                }
            }
        }
        None
    }).unwrap_or_else(|| if defaults.audio_bitrate_kbps > 0.0 { defaults.audio_bitrate_kbps } else { 192.0 });

    let min = if defaults.audio_bitrate_min_kbps > 0.0 { defaults.audio_bitrate_min_kbps } else { 32.0 };
    let max = if defaults.audio_bitrate_max_kbps > 0.0 { defaults.audio_bitrate_max_kbps } else { 1000.0 };
    bitrate = clamp_value(bitrate, min, max);

    let codec_multiplier = lookup_multiplier(&esize.audio_codecs, payload.audio_codec.as_deref(), 1.0);
    bitrate *= codec_multiplier;
    clamp_value(bitrate, min, max)
}

fn resolve_video_bitrate(payload: &EstimatePayload, esize: &ESizeData, audio_kbps: f64) -> f64 {
    let defaults = &esize.defaults;
    let source_category = payload
        .source_category
        .as_deref()
        .map(normalize_key)
        .unwrap_or_default();
    let mut bitrate = parse_kbps_value(payload.video_bitrate.as_deref()).or_else(|| {
        let quality = payload.video_quality.as_deref().map(normalize_key);
        if let Some(quality_key) = quality {
            if quality_key == "best" {
                let max_q = esize
                    .video_quality_kbps
                    .values()
                    .copied()
                    .fold(0.0, f64::max);
                if max_q > 0.0 {
                    return Some(max_q * 1.2);
                }
            }
            if let Some(q) = esize.video_quality_kbps.get(&quality_key) {
                return Some(*q);
            }
        }
        if source_category == "video" {
            if let (Some(size), Some(duration)) =
                (payload.source_size_bytes, payload.source_duration_seconds)
            {
                if duration > 0.0 {
                    let total = (size as f64 * 8.0) / (duration * 1000.0);
                    return Some((total - audio_kbps).max(0.0));
                }
            }
        }
        None
    }).unwrap_or_else(|| if defaults.video_bitrate_kbps > 0.0 { defaults.video_bitrate_kbps } else { 8000.0 });

    let min = if defaults.video_bitrate_min_kbps > 0.0 { defaults.video_bitrate_min_kbps } else { 300.0 };
    let max = if defaults.video_bitrate_max_kbps > 0.0 { defaults.video_bitrate_max_kbps } else { 80_000.0 };
    bitrate = clamp_value(bitrate, min, max);

    if let Some(fps) = parse_numeric_value(payload.video_fps.as_deref()) {
        let fps_key = if fps.fract() == 0.0 { fps.round().to_string() } else { fps.to_string() };
        let fps_mult = esize.fps_multiplier.get(&fps_key).copied().unwrap_or(1.0);
        bitrate *= fps_mult;
    }

    let codec_multiplier = lookup_multiplier(&esize.video_codecs, payload.video_codec.as_deref(), 1.0);
    bitrate *= codec_multiplier;
    clamp_value(bitrate, min, max)
}

fn estimate_video(payload: &EstimatePayload, esize: &ESizeData) -> Option<u64> {
    let overhead = resolve_overhead(esize, payload.format.as_deref());
    let duration = payload.source_duration_seconds.unwrap_or(0.0);
    let audio_kbps = resolve_audio_bitrate(payload, esize, false);
    let video_kbps = resolve_video_bitrate(payload, esize, audio_kbps);
    if duration <= 0.0 {
        return payload.source_size_bytes.map(|s| ((s as f64) * overhead).round() as u64);
    }
    let total_kbps = audio_kbps + video_kbps;
    let bytes = total_kbps * duration * 1000.0 / 8.0;
    let final_bytes = (bytes * overhead).round();
    if final_bytes.is_finite() && final_bytes > 0.0 {
        Some(final_bytes as u64)
    } else {
        None
    }
}

fn estimate_audio(payload: &EstimatePayload, esize: &ESizeData) -> Option<u64> {
    let overhead = resolve_overhead(esize, payload.format.as_deref());
    let duration = payload.source_duration_seconds.unwrap_or(0.0);
    let source_category = payload
        .source_category
        .as_deref()
        .map(normalize_key)
        .unwrap_or_default();
    let allow_source = source_category == "audio";
    let audio_kbps = resolve_audio_bitrate(payload, esize, allow_source);
    if duration <= 0.0 {
        return payload.source_size_bytes.map(|s| ((s as f64) * overhead).round() as u64);
    }
    let bytes = audio_kbps * duration * 1000.0 / 8.0;
    let final_bytes = (bytes * overhead).round();
    if final_bytes.is_finite() && final_bytes > 0.0 {
        Some(final_bytes as u64)
    } else {
        None
    }
}

fn estimate_image(payload: &EstimatePayload, esize: &ESizeData) -> Option<u64> {
    let overhead = resolve_overhead(esize, payload.format.as_deref());
    let defaults = &esize.defaults;
    let format_key = payload.format.as_deref().map(normalize_format_key);
    let format_info = format_key
        .as_ref()
        .and_then(|key| esize.image_formats.get(key));
    let bpp = format_info
        .and_then(|info| info.bpp)
        .unwrap_or_else(|| if defaults.image_bpp > 0.0 { defaults.image_bpp } else { 0.75 });
    let quality_weight = format_info
        .and_then(|info| info.quality_weight)
        .unwrap_or(1.0)
        .clamp(0.0, 1.0);

    let quality = payload.image_quality.unwrap_or(100).clamp(1, 100) as f64 / 100.0;
    let min_quality = defaults.image_quality_min.clamp(0.0, 1.0);
    let mut quality_factor = min_quality + (1.0 - min_quality) * quality;
    quality_factor = 1.0 - (1.0 - quality_factor) * quality_weight;

    let width = payload.image_width.or(payload.source_width);
    let height = payload.image_height.or(payload.source_height);
    let bytes = if let (Some(w), Some(h)) = (width, height) {
        (w as f64) * (h as f64) * bpp * quality_factor
    } else if let Some(source_size) = payload.source_size_bytes {
        let base_bpp = if defaults.image_bpp > 0.0 { defaults.image_bpp } else { 0.75 };
        let format_factor = if base_bpp > 0.0 { bpp / base_bpp } else { 1.0 };
        (source_size as f64) * format_factor * quality_factor
    } else {
        return None;
    };

    let final_bytes = (bytes * overhead).round();
    if final_bytes.is_finite() && final_bytes > 0.0 {
        Some(final_bytes as u64)
    } else {
        None
    }
}

fn estimate_other(payload: &EstimatePayload, esize: &ESizeData) -> Option<u64> {
    let overhead = resolve_overhead(esize, payload.format.as_deref());
    payload
        .source_size_bytes
        .map(|s| ((s as f64) * overhead).round() as u64)
}

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
    let category = payload
        .category
        .as_deref()
        .map(normalize_key)
        .unwrap_or_default();
    if category.is_empty() {
        return Ok(None);
    }
    let esize = load_esize();
    // Route estimation by target category to keep each heuristic isolated.
    let estimate = match category.as_str() {
        "video" => estimate_video(&payload, esize),
        "audio" => estimate_audio(&payload, esize),
        "image" => estimate_image(&payload, esize),
        _ => estimate_other(&payload, esize),
    };
    Ok(estimate)
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

pub fn resolve_unique_output_path(output_dir: &Path, base_name: &str, output_format: &str) -> String {
    let fmt = output_format.trim().trim_start_matches('.');
    let initial_filename = if fmt.is_empty() {
        base_name.to_string()
    } else {
        format!("{}.{}", base_name, fmt)
    };
    let initial_path = output_dir.join(&initial_filename);
    if !initial_path.exists() {
        return initial_path.to_string_lossy().to_string();
    }

    let mut counter = 1;
    loop {
        let candidate_filename = if fmt.is_empty() {
            format!("{}_{}", base_name, counter)
        } else {
            format!("{}_{}.{}", base_name, counter, fmt)
        };
        let candidate_path = output_dir.join(&candidate_filename);
        if !candidate_path.exists() {
            return candidate_path.to_string_lossy().to_string();
        }
        counter += 1;
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
    Ok(resolve_unique_output_path(&output_dir, &name, output_format))
}

use crate::core::utils::{
    get_ffmpeg_path, parse_kbps_string, parse_numeric_string, map_video_codec, map_audio_codec,
    map_video_codec_hw, default_video_codec_for_format, default_audio_codec_for_format,
    extract_file_extension, is_audio_copy_compatible, is_video_copy_compatible, generate_task_id
};
use crate::core::downloader::{cancel_download, is_terminal_event};
use tauri::Emitter;
use tauri::Manager;

fn build_ffmpeg_args(options: &ConvertOptions, output_path: &str, hwaccel: Option<String>, config: &crate::system::config::AppConfig) -> Vec<String> {
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

    let category = options.category.as_deref().unwrap_or("video");
    let output_format = normalize_output_format(&options.output_format);
    let source_ext = extract_file_extension(&options.input_path);

    let (eff_vcodec, eff_acodec) = crate::system::formats::resolve_effective_codecs(
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
    } else {
        args.push("-map".to_string());
        args.push("0:v?".to_string());
        args.push("-map".to_string());
        args.push("0:a?".to_string());
    }

    if category == "video" {
        let raw_codec = eff_vcodec.unwrap_or_else(|| options.video_codec.as_deref().unwrap_or("").trim().to_string()).to_lowercase();
        let has_video_mods = parse_kbps_string(options.video_bitrate.as_deref()).is_some()
            || parse_numeric_string(options.video_fps.as_deref()).is_some()
            || options.video_quality.as_deref().map(|q| q.to_lowercase()).filter(|q| q.ends_with('p')).is_some();

        let can_copy_video = config.copy_codec_if_possible && !has_video_mods && is_video_copy_compatible(&source_ext, &output_format);

        if raw_codec == "copy" || (can_copy_video && (raw_codec.is_empty() || raw_codec == "auto")) {
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

            if let Some(br) = parse_kbps_string(options.video_bitrate.as_deref()) {
                args.push("-b:v".to_string());
                args.push(format!("{}k", br));
            }
            if let Some(fps) = parse_numeric_string(options.video_fps.as_deref()) {
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

    let raw_audio_codec = eff_acodec.unwrap_or_else(|| options.audio_codec.as_deref().unwrap_or("").trim().to_string()).to_lowercase();
    let has_audio_mods = parse_kbps_string(options.audio_bitrate.as_deref()).is_some();
    let can_copy_audio = config.copy_codec_if_possible && !has_audio_mods && is_audio_copy_compatible(&source_ext, &output_format);

    if raw_audio_codec == "copy" || (can_copy_audio && (raw_audio_codec.is_empty() || raw_audio_codec == "auto")) {
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

    if let Some(br) = parse_kbps_string(options.audio_bitrate.as_deref()) {
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
    options: ConvertOptions
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
    let ffmpeg_args = if category == "video" || category == "audio" {
        Some(build_ffmpeg_args(&options, &output_path, hwaccel, &config))
    } else {
        None
    };

    let task_id = options
        .client_task_id
        .as_ref()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(generate_task_id);

    let payload = ConvertBridgePayload {
        input_path: input_path.to_string(),
        output_path,
        output_format,
        category,
        image_width: options.image_width,
        image_height: options.image_height,
        image_quality: options.image_quality,
        source_duration_seconds: options.source_duration_seconds,
        ffmpeg_path: if ffmpeg_args.is_some() { Some(ffmpeg_path.to_string_lossy().to_string()) } else { None },
        ffmpeg_args,
    };

    let cmd = ConvertBridgeCommand {
        command: "convert".to_string(),
        id: task_id.clone(),
        payload,
    };

    state.send_raw_command(&app_handle, &cmd)?;

    Ok(task_id)
}

#[tauri::command]
pub fn start_batch_convert(
    app_handle: AppHandle,
    state: State<BridgeState>,
    config_mgr: State<ConfigManager>,
    options: BatchConvertOptions,
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

    let max_concurrent = {
        let config = config_mgr.config.lock().unwrap();
        (config.maximum_concurrent_processes as usize).max(1)
    };

    let app_handle_clone = app_handle.clone();
    let task_id_clone = task_id.clone();

    std::thread::spawn(move || {
        let total = items.len();
        let category = items[0]
            .category
            .as_deref()
            .unwrap_or("image")
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

                if let Ok(_) = start_convert(
                    app_handle_clone.clone(),
                    bridge_state.clone(),
                    config_mgr_state.clone(),
                    item_opts,
                ) {
                    while let Ok(msg) = sub_rx.recv() {
                        if cancel_flag.load(std::sync::atomic::Ordering::SeqCst) {
                            let _ = cancel_download(app_handle_clone.clone(), bridge_state.clone(), sub_id.clone());
                            break;
                        }

                        let sub_pct = msg.get("percent").and_then(|v| v.as_f64()).unwrap_or(0.0);
                        let overall_pct = (((idx as f64) + (sub_pct / 100.0)) / (total as f64) * 100.0).clamp(0.0, 100.0);
                        emit_event(serde_json::json!({
                            "type": "progress",
                            "id": task_id_clone,
                            "percent": overall_pct,
                            "item_index": idx + 1,
                            "item_count": total
                        }));

                        if is_terminal_event(&msg) {
                            break;
                        }
                    }
                }
                bridge_state.unregister_sub_listener(&sub_id);
            }
        } else {
            use std::sync::{Arc, Mutex};
            use std::sync::atomic::{AtomicUsize, Ordering};

            let completed = Arc::new(AtomicUsize::new(0));
            let items_queue = Arc::new(Mutex::new(items.into_iter().enumerate().collect::<Vec<_>>()));

            let mut threads = Vec::new();
            for _ in 0..max_concurrent {
                let queue = items_queue.clone();
                let completed_ref = completed.clone();
                let cancel_ref = cancel_flag.clone();
                let app = app_handle_clone.clone();
                let tid = task_id_clone.clone();

                let handle = std::thread::spawn(move || {
                    loop {
                        if cancel_ref.load(Ordering::SeqCst) {
                            break;
                        }
                        let next_item = {
                            let mut q = queue.lock().unwrap();
                            if q.is_empty() { None } else { Some(q.remove(0)) }
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

                        if let Ok(_) = start_convert(
                            app.clone(),
                            bridge_state.clone(),
                            config_mgr_state.clone(),
                            item_opts,
                        ) {
                            while let Ok(msg) = sub_rx.recv() {
                                if cancel_ref.load(Ordering::SeqCst) {
                                    let _ = cancel_download(app.clone(), bridge_state.clone(), sub_id.clone());
                                    break;
                                }
                                if is_terminal_event(&msg) {
                                    break;
                                }
                            }
                        }
                        bridge_state.unregister_sub_listener(&sub_id);

                        let count = completed_ref.fetch_add(1, Ordering::SeqCst) + 1;
                        let pct = ((count as f64) / (total as f64) * 100.0).clamp(0.0, 100.0);
                        let _ = app.emit("download-event", serde_json::json!({
                            "type": "progress",
                            "id": tid,
                            "percent": pct,
                            "item_index": count,
                            "item_count": total
                        }));
                    }
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
            emit_event(serde_json::json!({ "type": "finished", "id": task_id_clone, "success": true }));
        }

        let bridge_state = app_handle_clone.state::<BridgeState>();
        bridge_state.unregister_batch_cancel(&task_id_clone);
    });

    Ok(task_id)
}