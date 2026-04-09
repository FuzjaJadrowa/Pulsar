use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};
use directories::BaseDirs;
use tauri_plugin_dialog::DialogExt;
use base64::engine::general_purpose::STANDARD as BASE64_ENGINE;
use base64::Engine;

const PRESET_VERSION: u32 = 1;
const PRESET_EXTENSION: &str = "pulpreset";
const PRESET_FOLDER: &str = "Presets";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PresetIcon {
    pub mime: String,
    pub data: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PresetDownloaderOptions {
    pub mode: String,
    pub format: String,
    pub path: Option<String>,
    pub video_quality: Option<String>,
    pub audio_quality: Option<String>,
    pub download_subtitles: bool,
    pub embed_subtitles: bool,
    pub subtitles_code: Option<String>,
    pub embed_metadata: bool,
    pub embed_thumbnail: bool,
    pub geo_bypass: bool,
    pub mute_audio: bool,
    pub video_codec: Option<String>,
    pub audio_codec: Option<String>,
    pub video_bitrate: Option<String>,
    pub audio_bitrate: Option<String>,
    pub video_fps: Option<String>,
    pub audio_sample_rate: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PresetConverterOptions {
    pub format: String,
    pub path: Option<String>,
    pub video_quality: Option<String>,
    pub video_codec: Option<String>,
    pub video_bitrate: Option<String>,
    pub video_fps: Option<String>,
    pub audio_codec: Option<String>,
    pub audio_bitrate: Option<String>,
    pub audio_sample_rate: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PresetCompressorOptions {
    pub mode: String,
    pub target_percent: Option<u32>,
    pub target_size: Option<String>,
    pub crf: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PulsarPreset {
    pub version: u32,
    pub id: String,
    pub title: String,
    pub summary: String,
    pub preset_type: String,
    pub hidden: bool,
    pub icon: PresetIcon,
    #[serde(default)]
    pub downloader: Option<PresetDownloaderOptions>,
    #[serde(default)]
    pub converter: Option<PresetConverterOptions>,
    #[serde(default)]
    pub compressor: Option<PresetCompressorOptions>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PresetSummary {
    pub id: String,
    pub title: String,
    pub summary: String,
    pub preset_type: String,
    pub hidden: bool,
    pub icon_data_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PresetPayload {
    pub id: Option<String>,
    pub title: String,
    pub summary: String,
    pub preset_type: String,
    pub hidden: bool,
    pub icon_data_url: String,
    #[serde(default)]
    pub downloader: Option<PresetDownloaderOptions>,
    #[serde(default)]
    pub converter: Option<PresetConverterOptions>,
    #[serde(default)]
    pub compressor: Option<PresetCompressorOptions>,
}

fn presets_dir(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let base = if let Some(base_dirs) = BaseDirs::new() {
        base_dirs.data_local_dir().join("Pulsar")
    } else {
        app_handle
            .path()
            .app_local_data_dir()
            .map_err(|e| e.to_string())?
    };
    let dir = base.join(PRESET_FOLDER);
    if let Err(err) = fs::create_dir_all(&dir) {
        return Err(format!("Failed to create presets folder: {}", err));
    }
    Ok(dir)
}

fn preset_path(dir: &Path, id: &str) -> PathBuf {
    dir.join(format!("{}.{}", id, PRESET_EXTENSION))
}

fn encode_icon(icon: &PresetIcon) -> String {
    let encoded = BASE64_ENGINE.encode(&icon.data);
    format!("data:{};base64,{}", icon.mime, encoded)
}

fn decode_icon(data_url: &str) -> Result<PresetIcon, String> {
    let trimmed = data_url.trim();
    if !trimmed.starts_with("data:") {
        return Err("Icon must be a data URL.".to_string());
    }
    let parts: Vec<&str> = trimmed.splitn(2, ',').collect();
    if parts.len() != 2 {
        return Err("Invalid icon data URL.".to_string());
    }
    let header = parts[0];
    let payload = parts[1];
    if !header.contains(";base64") {
        return Err("Icon data URL must be base64 encoded.".to_string());
    }
    let mime = header
        .trim_start_matches("data:")
        .split(';')
        .next()
        .unwrap_or("application/octet-stream")
        .to_string();
    let data = BASE64_ENGINE
        .decode(payload)
        .map_err(|e| format!("Failed to decode icon: {}", e))?;
    Ok(PresetIcon { mime, data })
}

fn read_preset(path: &Path) -> Result<PulsarPreset, String> {
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    rmp_serde::from_slice(&bytes).map_err(|e| e.to_string())
}

fn write_preset(path: &Path, preset: &PulsarPreset) -> Result<(), String> {
    let bytes = rmp_serde::to_vec_named(preset).map_err(|e| e.to_string())?;
    fs::write(path, bytes).map_err(|e| e.to_string())
}

fn slugify_title(title: &str) -> String {
    let mut out = String::new();
    let mut last_dash = false;
    for ch in title.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
            last_dash = false;
        } else if !last_dash {
            out.push('-');
            last_dash = true;
        }
    }
    let trimmed = out.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "preset".to_string()
    } else {
        trimmed
    }
}

fn generate_id(title: &str) -> String {
    let slug = slugify_title(title);
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    format!("{}-{}", slug, timestamp)
}


#[tauri::command]
pub fn list_presets(app_handle: AppHandle) -> Result<Vec<PresetSummary>, String> {
    let dir = presets_dir(&app_handle)?;
    let mut result: Vec<PresetSummary> = Vec::new();

    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = match entry {
            Ok(v) => v,
            Err(_) => continue,
        };
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some(PRESET_EXTENSION) {
            continue;
        }
        let preset = match read_preset(&path) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let file_id = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or(&preset.id)
            .to_string();
        result.push(PresetSummary {
            id: file_id,
            title: preset.title,
            summary: preset.summary,
            preset_type: preset.preset_type,
            hidden: preset.hidden,
            icon_data_url: encode_icon(&preset.icon),
        });
    }

    result.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));
    Ok(result)
}

#[tauri::command]
pub fn load_preset(app_handle: AppHandle, id: String) -> Result<PresetPayload, String> {
    let dir = presets_dir(&app_handle)?;
    let path = preset_path(&dir, id.trim());
    if !path.exists() {
        return Err("Preset not found.".to_string());
    }
    let preset = read_preset(&path)?;
    Ok(PresetPayload {
        id: Some(preset.id),
        title: preset.title,
        summary: preset.summary,
        preset_type: preset.preset_type,
        hidden: preset.hidden,
        icon_data_url: encode_icon(&preset.icon),
        downloader: preset.downloader,
        converter: preset.converter,
        compressor: preset.compressor,
    })
}

#[tauri::command]
pub fn save_preset(app_handle: AppHandle, preset: PresetPayload) -> Result<String, String> {
    if preset.title.trim().is_empty() {
        return Err("Preset title is required.".to_string());
    }
    let preset_type = preset.preset_type.trim().to_lowercase();
    let preset_type = if preset_type.is_empty() {
        "downloader".to_string()
    } else {
        preset_type
    };
    match preset_type.as_str() {
        "downloader" => {
            let downloader = preset
                .downloader
                .as_ref()
                .ok_or("Downloader options are required.".to_string())?;
            if downloader.format.trim().is_empty() {
                return Err("Preset format is required.".to_string());
            }
        }
        "converter" => {
            let converter = preset
                .converter
                .as_ref()
                .ok_or("Converter options are required.".to_string())?;
            if converter.format.trim().is_empty() {
                return Err("Preset format is required.".to_string());
            }
        }
        "compressor" => {
            let compressor = preset
                .compressor
                .as_ref()
                .ok_or("Compressor options are required.".to_string())?;
            let mode = compressor.mode.trim();
            if mode.is_empty() {
                return Err("Compression mode is required.".to_string());
            }
            match mode {
                "percent" => {
                    let value = compressor.target_percent.unwrap_or(0);
                    if !(1..=100).contains(&value) {
                        return Err("Compression percent is required.".to_string());
                    }
                }
                "size" => {
                    let size = compressor.target_size.as_ref().map(|v| v.trim()).unwrap_or("");
                    if size.is_empty() {
                        return Err("Target size is required.".to_string());
                    }
                }
                "quality" => {
                    if compressor.crf.is_none() {
                        return Err("CRF value is required.".to_string());
                    }
                }
                _ => return Err("Invalid compression mode.".to_string()),
            }
        }
        _ => return Err("Unsupported preset type.".to_string()),
    }

    let dir = presets_dir(&app_handle)?;
    let id = preset.id.unwrap_or_else(|| generate_id(&preset.title));
    let path = preset_path(&dir, &id);

    let icon = decode_icon(&preset.icon_data_url)?;
    let stored = PulsarPreset {
        version: PRESET_VERSION,
        id: id.clone(),
        title: preset.title,
        summary: preset.summary,
        preset_type,
        hidden: preset.hidden,
        icon,
        downloader: preset.downloader,
        converter: preset.converter,
        compressor: preset.compressor,
    };
    write_preset(&path, &stored)?;
    Ok(id)
}

#[tauri::command]
pub fn set_preset_hidden(app_handle: AppHandle, id: String, hidden: bool) -> Result<(), String> {
    let dir = presets_dir(&app_handle)?;
    let path = preset_path(&dir, id.trim());
    if !path.exists() {
        return Err("Preset not found.".to_string());
    }
    let mut preset = read_preset(&path)?;
    preset.hidden = hidden;
    write_preset(&path, &preset)?;
    Ok(())
}

#[tauri::command]
pub fn delete_preset(app_handle: AppHandle, id: String) -> Result<(), String> {
    let dir = presets_dir(&app_handle)?;
    let path = preset_path(&dir, id.trim());
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn import_preset(app_handle: AppHandle) -> Result<(), String> {
    let picked = app_handle
        .dialog()
        .file()
        .add_filter("Pulsar Preset", &[PRESET_EXTENSION])
        .blocking_pick_file();

    let source = match picked {
        Some(path) => path,
        None => return Ok(()),
    };

    let source_path = source.into_path().map_err(|e| e.to_string())?;
    if source_path.extension().and_then(|s| s.to_str()) != Some(PRESET_EXTENSION) {
        return Err("Invalid preset file.".to_string());
    }

    let dir = presets_dir(&app_handle)?;
    let file_name = source_path
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or("Invalid preset file name.")?
        .to_string();

    let mut target = dir.join(&file_name);
    if target.exists() {
        let stem = source_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("preset");
        let mut idx = 1;
        loop {
            // Preserve existing presets by picking the first free suffixed name.
            let candidate = format!("{}-{}.{}", stem, idx, PRESET_EXTENSION);
            let candidate_path = dir.join(candidate);
            if !candidate_path.exists() {
                target = candidate_path;
                break;
            }
            idx += 1;
        }
    }

    fs::copy(&source_path, &target).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn export_preset(app_handle: AppHandle, id: String) -> Result<(), String> {
    let dir = presets_dir(&app_handle)?;
    let path = preset_path(&dir, id.trim());
    if !path.exists() {
        return Err("Preset not found.".to_string());
    }

    let preset = read_preset(&path)?;
    let default_name = format!("{}.{}", preset.title, PRESET_EXTENSION);

    let target = app_handle
        .dialog()
        .file()
        .set_file_name(default_name)
        .add_filter("Pulsar Preset", &[PRESET_EXTENSION])
        .blocking_save_file();

    if let Some(dest) = target {
        let dest_path = dest.into_path().map_err(|e| e.to_string())?;
        fs::copy(&path, dest_path).map_err(|e| e.to_string())?;
    }

    Ok(())
}