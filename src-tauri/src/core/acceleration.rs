use directories::BaseDirs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::State;
use serde::Serialize;
use crate::system::config::ConfigManager;

#[derive(Debug, Clone, Serialize)]
pub struct AccelerationInfo {
    pub hwaccels: Vec<String>,
    pub preferred: String,
}

fn get_requirements_path() -> PathBuf {
    if let Some(base_dirs) = BaseDirs::new() {
        return base_dirs.data_local_dir().join("Pulsar").join("Requirements");
    }
    PathBuf::from("Requirements")
}

fn get_ffmpeg_path() -> PathBuf {
    let req_path = get_requirements_path();
    let name = if cfg!(target_os = "windows") { "ffmpeg.exe" } else { "ffmpeg" };
    req_path.join(name)
}

fn parse_hwaccels(output: &str) -> Vec<String> {
    let mut lines = output.lines();
    let mut found_header = false;
    let mut accels = Vec::new();
    while let Some(line) = lines.next() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if trimmed.to_lowercase().contains("hardware acceleration methods:") {
            found_header = true;
            continue;
        }
        if !found_header {
            continue;
        }
        let token = trimmed.split_whitespace().next().unwrap_or("").to_string();
        if !token.is_empty() {
            accels.push(token);
        }
    }
    accels
}

fn detect_gpu_vendor() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("wmic")
            .args(["path", "win32_videocontroller", "get", "name"])
            .output()
            .ok()?;
        let stdout = String::from_utf8_lossy(&output.stdout).to_lowercase();
        if stdout.contains("nvidia") { return Some("nvidia".to_string()); }
        if stdout.contains("amd") || stdout.contains("radeon") { return Some("amd".to_string()); }
        if stdout.contains("intel") { return Some("intel".to_string()); }
    }

    #[cfg(target_os = "linux")]
    {
        if let Ok(output) = Command::new("lspci").output() {
            let stdout = String::from_utf8_lossy(&output.stdout).to_lowercase();
            if stdout.contains("nvidia") { return Some("nvidia".to_string()); }
            if stdout.contains("amd") || stdout.contains("radeon") { return Some("amd".to_string()); }
            if stdout.contains("intel") { return Some("intel".to_string()); }
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Ok(output) = Command::new("system_profiler")
            .args(["SPDisplaysDataType"])
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout).to_lowercase();
            if stdout.contains("apple") { return Some("apple".to_string()); }
            if stdout.contains("amd") || stdout.contains("radeon") { return Some("amd".to_string()); }
            if stdout.contains("intel") { return Some("intel".to_string()); }
            if stdout.contains("nvidia") { return Some("nvidia".to_string()); }
        }
    }

    None
}

fn has_accel(accels: &[String], name: &str) -> bool {
    accels.iter().any(|item| item == name)
}

fn choose_preferred(accels: &[String], current: &str) -> String {
    if current != "auto" && accels.iter().any(|a| a == current) {
        return current.to_string();
    }
    let vendor = detect_gpu_vendor();

    #[cfg(target_os = "windows")]
    {
        if let Some(v) = vendor.as_deref() {
            if v == "nvidia" && has_accel(accels, "cuda") { return "cuda".to_string(); }
            if v == "intel" && has_accel(accels, "qsv") { return "qsv".to_string(); }
            if v == "amd" && has_accel(accels, "amf") { return "amf".to_string(); }
        }
        if has_accel(accels, "d3d11va") { return "d3d11va".to_string(); }
        if has_accel(accels, "dxva2") { return "dxva2".to_string(); }
    }

    #[cfg(target_os = "linux")]
    {
        if let Some(v) = vendor.as_deref() {
            if v == "nvidia" && has_accel(accels, "cuda") { return "cuda".to_string(); }
        }
        if has_accel(accels, "vaapi") { return "vaapi".to_string(); }
        if has_accel(accels, "vulkan") { return "vulkan".to_string(); }
    }

    #[cfg(target_os = "macos")]
    {
        if has_accel(accels, "videotoolbox") { return "videotoolbox".to_string(); }
    }

    let fallback = if vendor.as_deref() != Some("amd") {
        accels.iter().find(|item| item.as_str() != "amf").cloned()
    } else {
        accels.first().cloned()
    };
    fallback.unwrap_or_else(|| "auto".to_string())
}

fn detect_hwaccels(ffmpeg_path: &Path) -> Result<Vec<String>, String> {
    if !ffmpeg_path.exists() {
        return Err(format!("FFmpeg not found at {:?}", ffmpeg_path));
    }
    let output = Command::new(ffmpeg_path)
        .args(["-hide_banner", "-hwaccels"])
        .output()
        .map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut accels = parse_hwaccels(&stdout);
    accels.sort();
    accels.dedup();
    Ok(accels)
}

#[tauri::command]
pub fn refresh_acceleration_info(config_mgr: State<ConfigManager>) -> Result<AccelerationInfo, String> {
    let ffmpeg_path = get_ffmpeg_path();
    let accels = detect_hwaccels(&ffmpeg_path).unwrap_or_default();
    let mut config = config_mgr.config.lock().unwrap();
    config.ffmpeg_hwaccels = accels.clone();
    config.ffmpeg_hwaccel_preferred = choose_preferred(&accels, config.ffmpeg_hwaccel_preferred.trim());
    drop(config);
    config_mgr.save();
    Ok(AccelerationInfo {
        hwaccels: accels,
        preferred: config_mgr.config.lock().unwrap().ffmpeg_hwaccel_preferred.clone()
    })
}

pub fn resolve_hwaccel(config_mgr: &ConfigManager) -> Option<String> {
    let config = config_mgr.config.lock().unwrap();
    if !config.ffmpeg_hwaccel {
        return None;
    }
    if config.ffmpeg_hwaccel_preferred != "auto" {
        return Some(config.ffmpeg_hwaccel_preferred.clone());
    }
    config.ffmpeg_hwaccels.first().cloned()
}