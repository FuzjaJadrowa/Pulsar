use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;
use base64::engine::general_purpose::STANDARD as BASE64_ENGINE;
use base64::Engine;

use crate::system::config::ConfigManager;

const PRESET_VERSION: u32 = 1;
const PRESET_EXTENSION: &str = "pulpreset";
const PRESET_FOLDER: &str = "Presets";

const KEY_ICON_SVG: &str = r#"<svg viewBox="0 0 24 24" style="width:100%;height:100%;display:block;fill:#ffffff"><path d="m22.7 19-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.3.5-1 .1-1.4"/></svg>"#;

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
pub struct PulsarPreset {
    pub version: u32,
    pub id: String,
    pub title: String,
    pub summary: String,
    pub preset_type: String,
    pub hidden: bool,
    pub icon: PresetIcon,
    pub downloader: PresetDownloaderOptions,
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
    pub downloader: PresetDownloaderOptions,
}

fn presets_dir(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let base = app_handle
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?;
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

fn icon_key() -> PresetIcon {
    PresetIcon {
        mime: "image/svg+xml".to_string(),
        data: KEY_ICON_SVG.as_bytes().to_vec(),
    }
}

fn default_presets() -> Vec<PulsarPreset> {
    let icon = icon_key();
    vec![
        PulsarPreset {
            version: PRESET_VERSION,
            id: "best-audio".to_string(),
            title: "Best Audio".to_string(),
            summary: "MP3 with max audio bitrate and extras.".to_string(),
            preset_type: "downloader".to_string(),
            hidden: false,
            icon: icon.clone(),
            downloader: PresetDownloaderOptions {
                mode: "audio".to_string(),
                format: "mp3".to_string(),
                path: None,
                video_quality: None,
                audio_quality: None,
                download_subtitles: true,
                embed_subtitles: true,
                subtitles_code: None,
                embed_metadata: true,
                embed_thumbnail: true,
                geo_bypass: false,
                mute_audio: false,
                video_codec: None,
                audio_codec: Some("MP3".to_string()),
                video_bitrate: None,
                audio_bitrate: Some("320kbps".to_string()),
                video_fps: None,
                audio_sample_rate: None,
            },
        },
        PulsarPreset {
            version: PRESET_VERSION,
            id: "best-video".to_string(),
            title: "Best Video".to_string(),
            summary: "MP4, highest quality, H264, 60 FPS.".to_string(),
            preset_type: "downloader".to_string(),
            hidden: false,
            icon: icon.clone(),
            downloader: PresetDownloaderOptions {
                mode: "video".to_string(),
                format: "mp4".to_string(),
                path: None,
                video_quality: Some("best".to_string()),
                audio_quality: None,
                download_subtitles: true,
                embed_subtitles: true,
                subtitles_code: None,
                embed_metadata: true,
                embed_thumbnail: true,
                geo_bypass: false,
                mute_audio: false,
                video_codec: Some("H264".to_string()),
                audio_codec: Some("MP3".to_string()),
                video_bitrate: Some("8000kbps".to_string()),
                audio_bitrate: Some("320kbps".to_string()),
                video_fps: Some("60".to_string()),
                audio_sample_rate: None,
            },
        },
        PulsarPreset {
            version: PRESET_VERSION,
            id: "mp4-hevc".to_string(),
            title: "MP4 HEVC".to_string(),
            summary: "MP4 with H265 (HEVC) codec.".to_string(),
            preset_type: "downloader".to_string(),
            hidden: false,
            icon: icon.clone(),
            downloader: PresetDownloaderOptions {
                mode: "video".to_string(),
                format: "mp4".to_string(),
                path: None,
                video_quality: None,
                audio_quality: None,
                download_subtitles: false,
                embed_subtitles: false,
                subtitles_code: None,
                embed_metadata: false,
                embed_thumbnail: false,
                geo_bypass: false,
                mute_audio: false,
                video_codec: Some("H265".to_string()),
                audio_codec: None,
                video_bitrate: None,
                audio_bitrate: None,
                video_fps: None,
                audio_sample_rate: None,
            },
        },
        PulsarPreset {
            version: PRESET_VERSION,
            id: "ogg".to_string(),
            title: "OGG".to_string(),
            summary: "Ogg audio container.".to_string(),
            preset_type: "downloader".to_string(),
            hidden: false,
            icon: icon.clone(),
            downloader: PresetDownloaderOptions {
                mode: "audio".to_string(),
                format: "ogg".to_string(),
                path: None,
                video_quality: None,
                audio_quality: None,
                download_subtitles: false,
                embed_subtitles: false,
                subtitles_code: None,
                embed_metadata: false,
                embed_thumbnail: false,
                geo_bypass: false,
                mute_audio: false,
                video_codec: None,
                audio_codec: None,
                video_bitrate: None,
                audio_bitrate: None,
                video_fps: None,
                audio_sample_rate: None,
            },
        },
        PulsarPreset {
            version: PRESET_VERSION,
            id: "gif".to_string(),
            title: "GIF".to_string(),
            summary: "Animated GIF export.".to_string(),
            preset_type: "downloader".to_string(),
            hidden: false,
            icon,
            downloader: PresetDownloaderOptions {
                mode: "video".to_string(),
                format: "gif".to_string(),
                path: None,
                video_quality: None,
                audio_quality: None,
                download_subtitles: false,
                embed_subtitles: false,
                subtitles_code: None,
                embed_metadata: false,
                embed_thumbnail: false,
                geo_bypass: false,
                mute_audio: true,
                video_codec: None,
                audio_codec: None,
                video_bitrate: None,
                audio_bitrate: None,
                video_fps: None,
                audio_sample_rate: None,
            },
        },
    ]
}

pub fn ensure_default_presets(app_handle: &AppHandle, config_mgr: &ConfigManager) -> Result<(), String> {
    let already_created = {
        let config = config_mgr.config.lock().unwrap();
        config.default_presets_created
    };
    if already_created {
        return Ok(());
    }

    let dir = presets_dir(app_handle)?;
    for preset in default_presets() {
        let path = preset_path(&dir, &preset.id);
        if !path.exists() {
            write_preset(&path, &preset)?;
        }
    }

    {
        let mut config = config_mgr.config.lock().unwrap();
        config.default_presets_created = true;
    }
    config_mgr.save();
    Ok(())
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
    })
}

#[tauri::command]
pub fn save_preset(app_handle: AppHandle, preset: PresetPayload) -> Result<String, String> {
    if preset.title.trim().is_empty() {
        return Err("Preset title is required.".to_string());
    }
    if preset.downloader.format.trim().is_empty() {
        return Err("Preset format is required.".to_string());
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
        preset_type: preset.preset_type,
        hidden: preset.hidden,
        icon,
        downloader: preset.downloader,
    };
    write_preset(&path, &stored)?;
    Ok(id)
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