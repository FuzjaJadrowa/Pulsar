use super::versions::Versions;
use super::{emit_status, shutdown_bridge_once, SplashState, SplashStatusPayload};
use crate::features::downloads::BridgeState;
use futures_util::StreamExt;
use reqwest::Client;
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Window};
use tauri_plugin_updater::UpdaterExt;

const BRIDGE_REPO_URL: &str =
    "https://api.github.com/repos/fuzjajadrowa/Pulsar-Bridge/releases/latest";
const FFMPEG_REPO_URL: &str = "https://api.github.com/repos/fuzjajadrowa/FFbuilder/releases/latest";

pub(super) enum AppUpdateResult {
    Updated(String),
    NotUpdated,
    Cancelled,
}

pub(super) enum ComponentUpdateResult {
    Updated,
    NotUpdated,
}

pub(super) async fn check_app_update(
    app: &AppHandle,
    window: &Window,
    auto_update_enabled: bool,
    splash_state: &SplashState,
    bridge_state: Option<&BridgeState>,
    bridge_shutdown: &mut bool,
) -> Result<AppUpdateResult, String> {
    if splash_state.is_cancelled() {
        return Ok(AppUpdateResult::Cancelled);
    }

    let updater = app
        .updater_builder()
        .timeout(Duration::from_secs(600))
        .build()
        .map_err(|e| e.to_string())?;
    let Some(update) = updater.check().await.map_err(|e| e.to_string())? else {
        return Ok(AppUpdateResult::NotUpdated);
    };

    if splash_state.is_cancelled() {
        return Ok(AppUpdateResult::Cancelled);
    }

    if !auto_update_enabled {
        return Ok(AppUpdateResult::NotUpdated);
    }

    let target_version = update.version.clone();
    if let Some(state) = bridge_state {
        shutdown_bridge_once(state, bridge_shutdown);
    }
    emit_status(
        window,
        &format!("Updating to {}", target_version),
        true,
        false,
    );

    if splash_state.is_cancelled() {
        return Ok(AppUpdateResult::Cancelled);
    }

    let window_clone = window.clone();
    let window_finish = window.clone();
    let progress_version = target_version.clone();
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
                            status: format!("Updating to {}", progress_version),
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

    Ok(AppUpdateResult::Updated(target_version))
}

pub(super) async fn update_component(
    client: &Client,
    window: &Window,
    req_path: &Path,
    name: &str,
    versions: &mut Versions,
    splash_state: &SplashState,
    bridge_state: Option<&BridgeState>,
    bridge_shutdown: &mut bool,
) -> Result<ComponentUpdateResult, String> {
    if splash_state.is_cancelled() {
        return Err("Cancelled".to_string());
    }

    emit_status(window, &format!("Checking {}...", name), false, false);

    let url = if name == "pulsar-bridge" {
        BRIDGE_REPO_URL
    } else {
        FFMPEG_REPO_URL
    };
    if splash_state.is_cancelled() {
        return Err("Cancelled".to_string());
    }
    let resp = tokio::select! {
        response = client.get(url).send() => response.map_err(|e| e.to_string())?,
        _ = wait_for_splash_cancel(splash_state) => return Err("Cancelled".to_string()),
    };

    if !resp.status().is_success() {
        return Err("Network error".to_string());
    }

    if splash_state.is_cancelled() {
        return Err("Cancelled".to_string());
    }

    let json: serde_json::Value = tokio::select! {
        value = resp.json() => value.map_err(|e| e.to_string())?,
        _ = wait_for_splash_cancel(splash_state) => return Err("Cancelled".to_string()),
    };
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
        let dl_link = asset["browser_download_url"]
            .as_str()
            .unwrap_or("")
            .to_string();

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

    if download_url.is_empty() {
        return Ok(ComponentUpdateResult::NotUpdated);
    }

    let mut remote_ver = json["published_at"].as_str().unwrap_or("").to_string();
    if name == "ffmpeg" || name == "pulsar-bridge" {
        let version_hint = build_release_version(release_tag, release_name);
        if !version_hint.is_empty() {
            remote_ver = version_hint;
        } else if name == "ffmpeg" && !selected_asset_name.is_empty() {
            if let Some(checksum) =
                fetch_ffmpeg_checksum(client, assets, &selected_asset_name, splash_state).await
            {
                remote_ver = format!("sha256:{}", checksum);
            }
        }
    }

    let local_ver = versions
        .local_versions
        .get(name)
        .cloned()
        .unwrap_or_default();
    let local_exists = check_file_exists(req_path, name);

    if local_exists && !local_ver.is_empty() && local_ver == remote_ver {
        return Ok(ComponentUpdateResult::NotUpdated);
    }

    if let Some(state) = bridge_state {
        shutdown_bridge_once(state, bridge_shutdown);
    }

    emit_status(
        window,
        &format!("Downloading {}...", name),
        true,
        local_exists,
    );

    let temp_name = if download_url.ends_with(".zip") {
        "temp.zip"
    } else if download_url.ends_with(".tar.xz") {
        "temp.tar.xz"
    } else {
        "temp_bin"
    };
    let target_dl_path = req_path.join(temp_name);

    if splash_state.is_cancelled() {
        return Err("Cancelled".to_string());
    }
    if let Err(e) = download_file(
        client,
        window,
        &download_url,
        &target_dl_path,
        splash_state,
        local_exists,
    )
    .await
    {
        let _ = fs::remove_file(&target_dl_path);
        return Err(e);
    }
    emit_status(window, "Extracting...", false, false);
    if splash_state.is_cancelled() {
        let _ = fs::remove_file(&target_dl_path);
        return Err("Cancelled".to_string());
    }

    if name == "pulsar-bridge" {
        super::installer::validate_bridge_binary(&target_dl_path)?;
        super::installer::set_executable_permissions(&target_dl_path)?;
        let final_name = get_executable_name("pulsar-bridge");
        let dest = req_path.join(&final_name);
        super::installer::replace_file_with_rollback(&target_dl_path, &dest)?;
    } else {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let staging_dir = req_path.join(format!(".{name}-staging-{}-{nonce}", std::process::id()));
        fs::create_dir_all(&staging_dir).map_err(|e| e.to_string())?;
        let stage_result = (|| {
            super::installer::extract_archive(&target_dl_path, &staging_dir, name)?;
            for required in ["ffmpeg", "ffprobe", "deno"] {
                if !check_file_exists(&staging_dir, required) {
                    return Err(format!("Downloaded FFmpeg package is missing {required}."));
                }
            }
            super::installer::install_staged_directory(&staging_dir, req_path)
        })();
        let _ = fs::remove_dir_all(&staging_dir);
        stage_result?;
        let _ = fs::remove_file(&target_dl_path);
    }

    versions.local_versions.insert(name.to_string(), remote_ver);
    Ok(ComponentUpdateResult::Updated)
}

async fn download_file(
    client: &Client,
    window: &Window,
    url: &str,
    dest: &PathBuf,
    splash_state: &SplashState,
    can_skip: bool,
) -> Result<(), String> {
    let response = tokio::select! {
        response = client.get(url).send() => response.map_err(|e| e.to_string())?,
        _ = wait_for_splash_cancel(splash_state) => return Err("Cancelled".to_string()),
    };
    let res = response
        .error_for_status()
        .map_err(|e| format!("Download request failed: {e}"))?;
    let total_size = res.content_length().unwrap_or(0);

    let mut file = File::create(dest).map_err(|e| e.to_string())?;
    let mut downloaded: u64 = 0;
    let mut stream = res.bytes_stream();

    loop {
        let item = tokio::select! {
            item = stream.next() => item,
            _ = wait_for_splash_cancel(splash_state) => {
                drop(file);
                let _ = fs::remove_file(dest);
                return Err("Cancelled".to_string());
            }
        };
        let Some(item) = item else { break };
        let chunk = match item {
            Ok(chunk) => chunk,
            Err(error) => {
                drop(file);
                let _ = fs::remove_file(dest);
                return Err(error.to_string());
            }
        };
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;

        if total_size > 0 {
            let dl_mb = downloaded as f64 / 1_048_576.0;
            let total_mb = total_size as f64 / 1_048_576.0;
            let progress_txt = format!("{:.2} MB / {:.2} MB", dl_mb, total_mb);

            let _ = window.emit(
                "splash-progress",
                SplashStatusPayload {
                    status: "Downloading...".to_string(),
                    progress: Some(progress_txt),
                    is_downloading: true,
                    can_skip,
                },
            );
        }
    }
    if downloaded == 0 || (total_size > 0 && downloaded != total_size) {
        drop(file);
        let _ = fs::remove_file(dest);
        return Err(format!(
            "Downloaded file size mismatch: received {downloaded} of {total_size} bytes."
        ));
    }
    file.sync_all().map_err(|e| e.to_string())?;
    Ok(())
}

async fn wait_for_splash_cancel(splash_state: &SplashState) {
    while !splash_state.is_cancelled() {
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
}

pub(super) fn get_executable_name(base: &str) -> String {
    if cfg!(target_os = "windows") {
        format!("{}.exe", base)
    } else {
        base.to_string()
    }
}

pub(super) fn check_file_exists(dir: &Path, name: &str) -> bool {
    dir.join(get_executable_name(name)).is_file()
}

fn get_os_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "win"
    } else if cfg!(target_os = "macos") {
        "mac"
    } else {
        "linux"
    }
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

async fn fetch_ffmpeg_checksum(
    client: &Client,
    assets: &[serde_json::Value],
    asset_name: &str,
    splash_state: &SplashState,
) -> Option<String> {
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
    let response = tokio::select! {
        response = client.get(url).send() => response.ok()?,
        _ = wait_for_splash_cancel(splash_state) => return None,
    };
    if !response.status().is_success() {
        return None;
    }

    let text = tokio::select! {
        text = response.text() => text.ok()?,
        _ = wait_for_splash_cancel(splash_state) => return None,
    };
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
