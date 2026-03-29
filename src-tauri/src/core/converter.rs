use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::OnceLock;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;
use crate::core::downloader::BridgeState;

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
        let raw = include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/../src/assets/format.json"));
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
    let estimate = match category.as_str() {
        "video" => estimate_video(&payload, esize),
        "audio" => estimate_audio(&payload, esize),
        "image" => estimate_image(&payload, esize),
        _ => estimate_other(&payload, esize),
    };
    Ok(estimate)
}

#[derive(Deserialize, Debug)]
pub struct ConvertOptions {
    input_path: String,
    output_dir: Option<String>,
    output_name: Option<String>,
    output_format: String,
    category: Option<String>,
    image_width: Option<u32>,
    image_height: Option<u32>,
    image_quality: Option<u32>,
    client_task_id: Option<String>,
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

fn build_output_path(options: &ConvertOptions, output_format: &str) -> Result<String, String> {
    let input_path = Path::new(options.input_path.trim());
    let output_dir = resolve_output_dir(input_path, options.output_dir.as_deref())?;
    let name = resolve_output_name(input_path, options.output_name.as_deref());
    let file_name = format!("{}.{}", if name.is_empty() { "output" } else { name.as_str() }, output_format);
    Ok(output_dir.join(file_name).to_string_lossy().to_string())
}

fn generate_task_id() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis();
    now.to_string()
}

#[tauri::command]
pub fn start_convert(
    app_handle: AppHandle,
    state: State<BridgeState>,
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
    };

    let cmd = ConvertBridgeCommand {
        command: "convert".to_string(),
        id: task_id.clone(),
        payload,
    };

    state.send_raw_command(&app_handle, &cmd)?;

    Ok(task_id)
}