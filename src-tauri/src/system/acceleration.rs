use crate::app::config::ConfigManager;
use crate::infrastructure::ffmpeg::codecs::{
    binary_fingerprint, ffmpeg_encoder_smoke_test, BinaryFingerprint,
};
use crate::infrastructure::ffmpeg::hwaccel::is_supported_encoding_backend;
use crate::infrastructure::ffmpeg::paths::get_ffmpeg_path;
use serde::Serialize;
use std::path::Path;
use std::sync::{OnceLock, RwLock};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize)]
pub struct AccelerationInfo {
    pub hwaccels: Vec<String>,
    pub preferred: String,
}

static PROBED_ACCEL_CACHE: OnceLock<RwLock<Option<(BinaryFingerprint, Vec<String>)>>> =
    OnceLock::new();

fn probed_accel_cache() -> &'static RwLock<Option<(BinaryFingerprint, Vec<String>)>> {
    PROBED_ACCEL_CACHE.get_or_init(|| RwLock::new(None))
}

fn platform_backend_probes() -> &'static [(&'static str, &'static str)] {
    #[cfg(target_os = "windows")]
    {
        &[
            ("cuda", "h264_nvenc"),
            ("amf", "h264_amf"),
            ("qsv", "h264_qsv"),
        ]
    }
    #[cfg(target_os = "linux")]
    {
        &[
            ("cuda", "h264_nvenc"),
            ("vaapi", "h264_vaapi"),
            ("qsv", "h264_qsv"),
        ]
    }
    #[cfg(target_os = "macos")]
    {
        &[("videotoolbox", "h264_videotoolbox")]
    }
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    {
        &[]
    }
}

fn choose_preferred(accels: &[String], current: &str) -> String {
    let trimmed = current.trim();
    if trimmed != "auto" && !trimmed.is_empty() && accels.iter().any(|a| a == trimmed) {
        return trimmed.to_string();
    }
    accels
        .first()
        .cloned()
        .unwrap_or_else(|| "auto".to_string())
}

fn detect_working_hwaccels(ffmpeg_path: &Path, force: bool) -> Vec<String> {
    if !ffmpeg_path.exists() {
        return Vec::new();
    }
    let fingerprint = binary_fingerprint(ffmpeg_path);
    if !force {
        if let Some(ref fp) = fingerprint {
            if let Ok(cache) = probed_accel_cache().read() {
                if let Some((cached_fp, cached_accels)) = cache.as_ref() {
                    if cached_fp == fp {
                        return cached_accels.clone();
                    }
                }
            }
        }
    }

    let mut working = Vec::new();
    for &(backend, probe_encoder) in platform_backend_probes() {
        if ffmpeg_encoder_smoke_test(ffmpeg_path, probe_encoder) {
            working.push(backend.to_string());
        }
    }

    if let Some(fp) = fingerprint {
        if let Ok(mut cache) = probed_accel_cache().write() {
            *cache = Some((fp, working.clone()));
        }
    }
    working
}

pub fn refresh_acceleration_info_blocking(
    config_mgr: &ConfigManager,
    ffmpeg_path: &Path,
    force: bool,
) -> AccelerationInfo {
    let accels = detect_working_hwaccels(ffmpeg_path, force);
    let mut config = config_mgr.config.lock().unwrap();
    let preferred = choose_preferred(&accels, &config.ffmpeg_hwaccel_preferred);
    let changed = config.ffmpeg_hwaccels != accels || config.ffmpeg_hwaccel_preferred != preferred;
    config.ffmpeg_hwaccels = accels.clone();
    config.ffmpeg_hwaccel_preferred = preferred.clone();
    drop(config);
    if changed {
        config_mgr.save();
    }
    AccelerationInfo {
        hwaccels: accels,
        preferred,
    }
}

#[tauri::command]
pub async fn refresh_acceleration_info(app_handle: AppHandle) -> Result<AccelerationInfo, String> {
    tokio::task::spawn_blocking(move || {
        let ffmpeg_path = get_ffmpeg_path();
        let config_mgr = app_handle.state::<ConfigManager>();
        refresh_acceleration_info_blocking(&config_mgr, &ffmpeg_path, true)
    })
    .await
    .map_err(|error| format!("Hardware acceleration probe failed: {error}"))
}

pub fn ensure_hwaccel_for_task(config_mgr: &ConfigManager, ffmpeg_path: &Path) -> Option<String> {
    {
        let config = config_mgr.config.lock().unwrap();
        if !is_hwaccel_enabled(&config.ffmpeg_hwaccel) {
            return None;
        }
    }
    let _ = refresh_acceleration_info_blocking(config_mgr, ffmpeg_path, false);
    resolve_hwaccel(config_mgr)
}

pub fn is_hwaccel_enabled(setting: &str) -> bool {
    let trimmed = setting.trim();
    !trimmed.is_empty()
        && !trimmed.eq_ignore_ascii_case("none")
        && !trimmed.eq_ignore_ascii_case("false")
}

pub fn resolve_hwaccel(config_mgr: &ConfigManager) -> Option<String> {
    let config = config_mgr.config.lock().unwrap();
    if !is_hwaccel_enabled(&config.ffmpeg_hwaccel) {
        return None;
    }
    let preferred = config.ffmpeg_hwaccel_preferred.trim();
    if preferred != "auto"
        && is_supported_encoding_backend(preferred)
        && config.ffmpeg_hwaccels.iter().any(|item| item == preferred)
    {
        return Some(preferred.to_string());
    }
    config
        .ffmpeg_hwaccels
        .iter()
        .find(|item| is_supported_encoding_backend(item))
        .cloned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn choose_preferred_keeps_valid_user_choice_and_falls_back_to_first() {
        let accels = vec!["cuda".to_string(), "qsv".to_string()];
        assert_eq!(choose_preferred(&accels, "qsv"), "qsv");
        assert_eq!(choose_preferred(&accels, "auto"), "cuda");
        assert_eq!(choose_preferred(&accels, "d3d11va"), "cuda");
        assert_eq!(choose_preferred(&[], "auto"), "auto");
    }

    #[test]
    fn hwaccel_enabled_check_handles_none_false_empty() {
        assert!(!is_hwaccel_enabled("none"));
        assert!(!is_hwaccel_enabled("false"));
        assert!(!is_hwaccel_enabled("   "));
        assert!(is_hwaccel_enabled("auto"));
        assert!(is_hwaccel_enabled("cuda"));
    }
}
