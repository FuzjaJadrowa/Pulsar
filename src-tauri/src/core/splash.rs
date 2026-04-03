use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use directories::BaseDirs;
use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, Window, State};
use tauri_plugin_updater::UpdaterExt;
use crate::system::config::ConfigManager;

const BRIDGE_REPO_URL: &str = "https://api.github.com/repos/fuzjajadrowa/Pulsar-Bridge/releases/latest";
const FFMPEG_REPO_URL: &str = "https://api.github.com/repos/fuzjajadrowa/FFbuilder/releases/latest";

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(default)]
struct Versions {
    app_last_check: u64,
    req_last_check: u64,
    bridge_last_check: u64,
    ffmpeg_last_check: u64,
    #[serde(flatten)]
    local_versions: std::collections::HashMap<String, String>,
}

impl Default for Versions {
    fn default() -> Self {
        Self {
            app_last_check: 0,
            req_last_check: 0,
            bridge_last_check: 0,
            ffmpeg_last_check: 0,
            local_versions: std::collections::HashMap::new(),
        }
    }
}

pub struct SplashState {
    cancel_flag: AtomicBool,
}

impl SplashState {
    pub fn new() -> Self {
        Self { cancel_flag: AtomicBool::new(false) }
    }

    fn reset(&self) {
        self.cancel_flag.store(false, Ordering::Relaxed);
    }

    fn cancel(&self) {
        self.cancel_flag.store(true, Ordering::Relaxed);
    }

    fn is_cancelled(&self) -> bool {
        self.cancel_flag.load(Ordering::Relaxed)
    }
}

#[derive(Clone, Serialize)]
struct SplashStatusPayload {
    status: String,
    progress: Option<String>,
    is_downloading: bool,
    can_skip: bool,
}

enum AppUpdateResult {
    Updated,
    NotUpdated,
    Cancelled,
}

#[tauri::command]
pub fn cancel_splash_checks(state: State<'_, SplashState>) {
    state.cancel();
}

#[tauri::command]
pub fn get_requirements_versions() -> std::collections::HashMap<String, String> {
    let req_path = get_requirements_path();
    let versions = load_versions(&req_path);
    versions.local_versions
}

#[tauri::command]
pub async fn run_splash_checks(app: AppHandle, window: Window, splash_state: State<'_, SplashState>) -> Result<(), String> {
    splash_state.reset();

    let client = Client::builder()
        .user_agent("Pulsar-App")
        .build()
        .map_err(|e| e.to_string())?;

    let app_config = {
        let state = app.state::<ConfigManager>();
        let locked = state
            .config
            .lock()
            .map_err(|_| "Failed to lock config".to_string())?;
        let config = locked.clone();
        config
    };
    let app_update_enabled = app_config.update_app;
    let bridge_update_enabled = app_config.update_ytdlp;
    let ffmpeg_update_enabled = app_config.update_ffmpeg;
    let update_interval_secs = app_config.update_app_cooldown_minutes.max(1) * 60;

    let req_path = get_requirements_path();
    let mut versions = load_versions(&req_path);
    let app_tag = normalize_app_tag(&app.package_info().version.to_string());
    versions.local_versions.insert("pulsar".to_string(), app_tag);
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();

    emit_status(&window, "Checking for updates...", false, false);
    if splash_state.is_cancelled() {
        return Ok(());
    }

    if app_update_enabled && now - versions.app_last_check >= update_interval_secs {
        match check_app_update(&app, &window, app_update_enabled, &splash_state).await {
            Ok(AppUpdateResult::Updated) => {
                versions.app_last_check = now;
                save_versions(&req_path, &versions);
                return Ok(());
            }
            Ok(AppUpdateResult::NotUpdated) => {
                versions.app_last_check = now;
            }
            Ok(AppUpdateResult::Cancelled) => {
                save_versions(&req_path, &versions);
                return Ok(());
            }
            Err(e) => emit_status(&window, &format!("Update check failed: {}", e), false, false),
        }
    }

    if splash_state.is_cancelled() {
        save_versions(&req_path, &versions);
        return Ok(());
    }

    let bridge_exists = check_file_exists(&req_path, "pulsar-bridge");
    let ffmpeg_exists = check_file_exists(&req_path, "ffmpeg");

    let bridge_needs_check = if bridge_update_enabled {
        !bridge_exists || now - versions.bridge_last_check > update_interval_secs
    } else {
        !bridge_exists
    };

    let ffmpeg_needs_check = if ffmpeg_update_enabled {
        !ffmpeg_exists || now - versions.ffmpeg_last_check > update_interval_secs
    } else {
        !ffmpeg_exists
    };

    if bridge_needs_check {
        if splash_state.is_cancelled() {
            save_versions(&req_path, &versions);
            return Ok(());
        }
        match update_component(&client, &window, &req_path, "pulsar-bridge", &mut versions, &splash_state).await {
            Ok(_) => {
                if bridge_update_enabled {
                    versions.bridge_last_check = now;
                }
            }
            Err(e) => {
                if e == "Cancelled" {
                    save_versions(&req_path, &versions);
                    return Ok(());
                }
                emit_status(&window, &format!("Error: {}", e), false, false);
            }
        }
    }

    if ffmpeg_needs_check {
        if splash_state.is_cancelled() {
            save_versions(&req_path, &versions);
            return Ok(());
        }
        match update_component(&client, &window, &req_path, "ffmpeg", &mut versions, &splash_state).await {
            Ok(_) => {
                if ffmpeg_update_enabled {
                    versions.ffmpeg_last_check = now;
                }
            }
            Err(e) => {
                if e == "Cancelled" {
                    save_versions(&req_path, &versions);
                    return Ok(());
                }
                emit_status(&window, &format!("Error: {}", e), false, false);
            }
        }
    }

    save_versions(&req_path, &versions);

    if splash_state.is_cancelled() {
        return Ok(());
    }

    emit_status(&window, "Starting...", false, false);
    tokio::time::sleep(std::time::Duration::from_millis(500)).await;

    let _ = window.emit("splash-finished", ());

    Ok(())
}

#[tauri::command]
pub async fn run_requirement_check(app: AppHandle, window: Window, component: String, splash_state: State<'_, SplashState>) -> Result<(), String> {
    splash_state.reset();

    let client = Client::builder()
        .user_agent("Pulsar-App")
        .build()
        .map_err(|e| e.to_string())?;

    let app_config = {
        let state = app.state::<ConfigManager>();
        let locked = state
            .config
            .lock()
            .map_err(|_| "Failed to lock config".to_string())?;
        let config = locked.clone();
        config
    };

    let req_path = get_requirements_path();
    let mut versions = load_versions(&req_path);
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();

    let app_tag = normalize_app_tag(&app.package_info().version.to_string());
    versions.local_versions.insert("pulsar".to_string(), app_tag);

    let component_key = match component.trim().to_lowercase().as_str() {
        "pulsar" | "app" => "pulsar",
        "pulsar-bridge" | "bridge" => "pulsar-bridge",
        "ffmpeg" => "ffmpeg",
        _ => return Err("Unknown requirement".to_string()),
    };

    if splash_state.is_cancelled() {
        save_versions(&req_path, &versions);
        return Ok(());
    }

    match component_key {
        "pulsar" => {
            emit_status(&window, "Checking Pulsar...", false, false);
            match check_app_update(&app, &window, app_config.update_app, &splash_state).await {
                Ok(AppUpdateResult::Updated) => {
                    versions.app_last_check = now;
                    save_versions(&req_path, &versions);
                    return Ok(());
                }
                Ok(AppUpdateResult::NotUpdated) => {
                    versions.app_last_check = now;
                }
                Ok(AppUpdateResult::Cancelled) => {
                    save_versions(&req_path, &versions);
                    return Ok(());
                }
                Err(e) => emit_status(&window, &format!("Update check failed: {}", e), false, false),
            }
        }
        "pulsar-bridge" => {
            match update_component(&client, &window, &req_path, "pulsar-bridge", &mut versions, &splash_state).await {
                Ok(_) => {
                    versions.bridge_last_check = now;
                }
                Err(e) => {
                    if e == "Cancelled" {
                        save_versions(&req_path, &versions);
                        return Ok(());
                    }
                    emit_status(&window, &format!("Error: {}", e), false, false);
                }
            }
        }
        "ffmpeg" => {
            match update_component(&client, &window, &req_path, "ffmpeg", &mut versions, &splash_state).await {
                Ok(_) => {
                    versions.ffmpeg_last_check = now;
                }
                Err(e) => {
                    if e == "Cancelled" {
                        save_versions(&req_path, &versions);
                        return Ok(());
                    }
                    emit_status(&window, &format!("Error: {}", e), false, false);
                }
            }
        }
        _ => {}
    }

    save_versions(&req_path, &versions);

    if splash_state.is_cancelled() {
        return Ok(());
    }

    emit_status(&window, "Starting...", false, false);
    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    let _ = window.emit("splash-finished", ());

    Ok(())
}

async fn check_app_update(app: &AppHandle, window: &Window, auto_update_enabled: bool, splash_state: &SplashState) -> Result<AppUpdateResult, String> {
    if splash_state.is_cancelled() {
        return Ok(AppUpdateResult::Cancelled);
    }

    let updater = app.updater().map_err(|e| e.to_string())?;
    let Some(update) = updater.check().await.map_err(|e| e.to_string())? else {
        return Ok(AppUpdateResult::NotUpdated);
    };

    if splash_state.is_cancelled() {
        return Ok(AppUpdateResult::Cancelled);
    }

    if !auto_update_enabled {
        emit_status(window, "Update available (auto-update disabled)", false, false);
        return Ok(AppUpdateResult::NotUpdated);
    }

    let target_version = update.version.clone();
    emit_status(window, &format!("Updating to {}", target_version), true, true);

    if splash_state.is_cancelled() {
        return Ok(AppUpdateResult::Cancelled);
    }

    let window_clone = window.clone();
    let window_finish = window.clone();
    let mut downloaded: u64 = 0;

    update
        .download_and_install(
            move |chunk_len, content_length| {
                downloaded += chunk_len as u64;
                if let Some(total) = content_length {
                    let dl_mb = downloaded as f64 / 1_048_576.0;
                    let total_mb = total as f64 / 1_048_576.0;
                    let progress_txt = format!("{:.2} MB / {:.2} MB", dl_mb, total_mb);
                    let _ = window_clone.emit(
                        "splash-progress",
                        SplashStatusPayload {
                            status: format!("Updating to {}", target_version),
                            progress: Some(progress_txt),
                            is_downloading: true,
                            can_skip: false,
                        },
                    );
                }
            },
            move || {
                let _ = window_finish.emit(
                    "splash-progress",
                    SplashStatusPayload {
                        status: "Update downloaded".to_string(),
                        progress: None,
                        is_downloading: false,
                        can_skip: false,
                    },
                );
            },
        )
        .await
        .map_err(|e| e.to_string())?;

    emit_status(window, "Update installed. Restarting...", false, false);
    Ok(AppUpdateResult::Updated)
}

async fn update_component(client: &Client, window: &Window, req_path: &Path, name: &str, versions: &mut Versions, splash_state: &SplashState) -> Result<(), String> {
    if splash_state.is_cancelled() {
        return Err("Cancelled".to_string());
    }

    emit_status(window, &format!("Checking {}...", name), false, false);

    let url = if name == "pulsar-bridge" { BRIDGE_REPO_URL } else { FFMPEG_REPO_URL };
    if splash_state.is_cancelled() {
        return Err("Cancelled".to_string());
    }
    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err("Network error".to_string());
    }

    if splash_state.is_cancelled() {
        return Err("Cancelled".to_string());
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let assets = json["assets"].as_array().ok_or("No assets")?;
    let release_tag = json["tag_name"].as_str().unwrap_or("").trim();
    let release_name = json["name"].as_str().unwrap_or("").trim();

    let mut download_url = String::new();
    let mut selected_asset_name = String::new();
    let os = get_os_name();
    let ffmpeg_asset_target = match os {
        "win" => "ffmpeg-windows.zip",
        "mac" => "ffmpeg-macos.tar.xz",
        "linux" => "ffmpeg-linux.tar.xz",
        _ => "",
    };

    for asset in assets {
        let name_raw = asset["name"].as_str().unwrap_or("");
        let asset_name = name_raw.to_lowercase();
        let dl_link = asset["browser_download_url"].as_str().unwrap_or("").to_string();

        if name == "pulsar-bridge" {
            if os == "win" && asset_name == "pulsar-bridge-windows.exe" {
                download_url = dl_link;
                selected_asset_name = name_raw.to_string();
                break;
            } else if os == "mac" && asset_name == "pulsar-bridge-macos" {
                download_url = dl_link;
                selected_asset_name = name_raw.to_string();
                break;
            } else if os == "linux" && asset_name == "pulsar-bridge-linux" {
                download_url = dl_link;
                selected_asset_name = name_raw.to_string();
                break;
            }
        } else if name == "ffmpeg" {
            if !ffmpeg_asset_target.is_empty() && asset_name == ffmpeg_asset_target {
                download_url = dl_link;
                selected_asset_name = name_raw.to_string();
                break;
            }
        }
    }

    if download_url.is_empty() { return Ok(()); }

    let mut remote_ver = json["published_at"].as_str().unwrap_or("").to_string();
    if name == "ffmpeg" || name == "pulsar-bridge" {
        let version_hint = build_release_version(release_tag, release_name);
        if !version_hint.is_empty() {
            remote_ver = version_hint;
        } else if name == "ffmpeg" && !selected_asset_name.is_empty() {
            if let Some(checksum) = fetch_ffmpeg_checksum(client, assets, &selected_asset_name, splash_state).await {
                remote_ver = format!("sha256:{}", checksum);
            }
        }
    }

    let local_ver = versions.local_versions.get(name).cloned().unwrap_or_default();
    let local_exists = check_file_exists(req_path, name);

    if local_exists && !local_ver.is_empty() && local_ver == remote_ver {
        return Ok(());
    }

    emit_status(window, &format!("Downloading {}...", name), true, local_exists);

    let temp_name = if download_url.ends_with(".zip") { "temp.zip" } else if download_url.ends_with(".tar.xz") { "temp.tar.xz" } else { "temp_bin" };
    let target_dl_path = req_path.join(temp_name);

    if splash_state.is_cancelled() {
        return Err("Cancelled".to_string());
    }
    if let Err(e) = download_file(client, window, &download_url, &target_dl_path, splash_state).await {
        let _ = fs::remove_file(&target_dl_path);
        return Err(e);
    }
    emit_status(window, "Extracting...", false, false);
    if splash_state.is_cancelled() {
        let _ = fs::remove_file(&target_dl_path);
        return Err("Cancelled".to_string());
    }

    if name == "pulsar-bridge" {
        let final_name = get_executable_name("pulsar-bridge");
        let dest = req_path.join(&final_name);
        if dest.exists() { let _ = fs::remove_file(&dest); }
        fs::rename(&target_dl_path, &dest).map_err(|e| e.to_string())?;

        #[cfg(target_family = "unix")]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(&dest).unwrap().permissions();
            perms.set_mode(0o755);
            let _ = fs::set_permissions(&dest, perms);
        }
    } else {
        extract_archive(&target_dl_path, req_path, name)?;
        let _ = fs::remove_file(&target_dl_path);
    }

    versions.local_versions.insert(name.to_string(), remote_ver);
    Ok(())
}

async fn download_file(client: &Client, window: &Window, url: &str, dest: &PathBuf, splash_state: &SplashState) -> Result<(), String> {
    let res = client.get(url).send().await.map_err(|e| e.to_string())?;
    let total_size = res.content_length().unwrap_or(0);

    let mut file = File::create(dest).map_err(|e| e.to_string())?;
    let mut downloaded: u64 = 0;
    let mut stream = res.bytes_stream();

    while let Some(item) = stream.next().await {
        if splash_state.is_cancelled() {
            drop(file);
            let _ = fs::remove_file(dest);
            return Err("Cancelled".to_string());
        }

        let chunk = item.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;

        if total_size > 0 {
            let dl_mb = downloaded as f64 / 1_048_576.0;
            let total_mb = total_size as f64 / 1_048_576.0;
            let progress_txt = format!("{:.2} MB / {:.2} MB", dl_mb, total_mb);

            let _ = window.emit("splash-progress", SplashStatusPayload {
                status: "Downloading...".to_string(),
                progress: Some(progress_txt),
                is_downloading: true,
                can_skip: false,
            });
        }
    }
    Ok(())
}

fn extract_archive(archive_path: &Path, dest_dir: &Path, component: &str) -> Result<(), String> {
    let file = File::open(archive_path).map_err(|e| e.to_string())?;

    if archive_path.extension().unwrap_or_default() == "zip" {
        let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
        archive.extract(dest_dir).map_err(|e| e.to_string())?;
    } else {
        let mut cmd = std::process::Command::new("tar");
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }
        let tar = cmd
            .arg("-xf")
            .arg(archive_path)
            .arg("-C")
            .arg(dest_dir)
            .output();

        if let Err(_) = tar {
            return Err("Failed to run tar command".to_string());
        }
    }

    if component == "ffmpeg" {
        ensure_ffmpeg_permissions(dest_dir);
    }

    Ok(())
}

fn emit_status(window: &Window, status: &str, is_downloading: bool, can_skip: bool) {
    let _ = window.emit("splash-status", SplashStatusPayload {
        status: status.to_string(),
        progress: if is_downloading { Some("Starting...".into()) } else { None },
        is_downloading,
        can_skip
    });
}

fn get_requirements_path() -> PathBuf {
    if let Some(base_dirs) = BaseDirs::new() {
        let path = base_dirs.data_local_dir().join("Pulsar").join("Requirements");

        if !path.exists() {
            let _ = fs::create_dir_all(&path);
        }
        return path;
    }
    PathBuf::from("Requirements")
}

fn get_executable_name(base: &str) -> String {
    if cfg!(target_os = "windows") {
        format!("{}.exe", base)
    } else {
        base.to_string()
    }
}

fn check_file_exists(dir: &Path, name: &str) -> bool {
    dir.join(get_executable_name(name)).exists()
}

fn get_os_name() -> &'static str {
    if cfg!(target_os = "windows") { "win" }
    else if cfg!(target_os = "macos") { "mac" }
    else { "linux" }
}

fn build_release_version(tag: &str, name: &str) -> String {
    let tag_trimmed = tag.trim();
    let name_trimmed = name.trim();
    if !tag_trimmed.is_empty() {
        tag_trimmed.to_string()
    } else {
        name_trimmed.to_string()
    }
}

fn normalize_app_tag(version: &str) -> String {
    let trimmed = version.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    if trimmed.starts_with('v') || trimmed.starts_with('V') {
        trimmed.to_string()
    } else {
        format!("v{}", trimmed)
    }
}

fn ensure_ffmpeg_permissions(dest_dir: &Path) {
    #[cfg(target_family = "unix")]
    {
        use std::os::unix::fs::PermissionsExt;
        for name in ["ffmpeg", "ffprobe"] {
            let path = dest_dir.join(name);
            if let Ok(metadata) = fs::metadata(&path) {
                let mut perms = metadata.permissions();
                perms.set_mode(0o755);
                let _ = fs::set_permissions(&path, perms);
            }
        }
    }
    #[cfg(not(target_family = "unix"))] // to prevent warning
    {
        let _ = dest_dir;
    }
}

async fn fetch_ffmpeg_checksum(client: &Client, assets: &[serde_json::Value], asset_name: &str, splash_state: &SplashState) -> Option<String> {
    if splash_state.is_cancelled() {
        return None;
    }

    let checksum_asset = assets.iter().find(|asset| {
        asset["name"]
            .as_str()
            .map(|name| name.eq_ignore_ascii_case("checksums.sha256"))
            .unwrap_or(false)
    })?;

    let url = checksum_asset["browser_download_url"].as_str()?;
    let response = client.get(url).send().await.ok()?;
    if !response.status().is_success() {
        return None;
    }

    let text = response.text().await.ok()?;
    for line in text.lines() {
        let mut parts = line.split_whitespace();
        let hash = parts.next()?;
        let file = parts.next()?;
        if file == asset_name {
            return Some(hash.to_string());
        }
    }

    None
}

fn load_versions(req_path: &Path) -> Versions {
    let path = req_path.join("versions.json");
    if path.exists() {
        if let Ok(file) = File::open(path) {
            if let Ok(v) = serde_json::from_reader(file) {
                return v;
            }
        }
    }
    Versions::default()
}

fn save_versions(req_path: &Path, versions: &Versions) {
    let path = req_path.join("versions.json");
    if let Ok(file) = File::create(path) {
        let _ = serde_json::to_writer(file, versions);
    }
}