mod installer;
mod updater;
mod versions;
use self::updater::{
    check_app_update, check_file_exists, update_component, AppUpdateResult, ComponentUpdateResult,
};
use self::versions::{load_versions, save_versions, Versions};
use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use crate::app::config::ConfigManager;
use crate::features::downloads::BridgeState;
use crate::infrastructure::platform::get_requirements_path;
use reqwest::Client;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State, Window};

const FLATPAK_FFMPEG_VERSION: &str = "7.1";
const FAILED_UPDATE_RETRY_SECS: u64 = 5 * 60;

pub struct SplashState {
    cancel_flag: AtomicBool,
    running: AtomicBool,
}

impl SplashState {
    pub fn new() -> Self {
        Self {
            cancel_flag: AtomicBool::new(false),
            running: AtomicBool::new(false),
        }
    }

    fn begin(&self) -> Result<(), String> {
        self.running
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .map_err(|_| "An update check is already running.".to_string())?;
        self.cancel_flag.store(false, Ordering::Relaxed);
        Ok(())
    }

    fn finish(&self) {
        self.running.store(false, Ordering::SeqCst);
    }

    fn cancel(&self) {
        self.cancel_flag.store(true, Ordering::Relaxed);
    }

    fn is_cancelled(&self) -> bool {
        self.cancel_flag.load(Ordering::Relaxed)
    }
}

struct SplashRunGuard<'a>(&'a SplashState);

impl Drop for SplashRunGuard<'_> {
    fn drop(&mut self) {
        self.0.finish();
    }
}

#[derive(Clone, Serialize)]
struct SplashStatusPayload {
    status: String,
    progress: Option<String>,
    is_downloading: bool,
    can_skip: bool,
}

#[derive(Clone, Serialize)]
struct SplashFinishedPayload {
    prewarm_bridge: bool,
    bridge_updated: bool,
}

#[tauri::command]
pub fn cancel_splash_checks(state: State<'_, SplashState>) {
    state.cancel();
}

#[tauri::command]
pub fn get_requirements_versions() -> std::collections::HashMap<String, String> {
    let req_path = get_requirements_path();
    let mut versions = load_versions(&req_path);
    if is_flatpak_runtime() {
        let app_tag = normalize_app_tag(env!("CARGO_PKG_VERSION"));
        populate_flatpak_versions(&mut versions, &app_tag, &req_path);
    }
    versions.local_versions
}

#[tauri::command]
pub async fn run_splash_checks(
    app: AppHandle,
    window: Window,
    splash_state: State<'_, SplashState>,
) -> Result<(), String> {
    splash_state.begin()?;
    let _run_guard = SplashRunGuard(&splash_state);

    let client = Client::builder()
        .user_agent("Pulsar-App")
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(600))
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
    let is_flatpak = is_flatpak_runtime();
    let app_update_enabled = if is_flatpak {
        false
    } else {
        app_config.update_app
    };
    let bridge_update_enabled = if is_flatpak {
        false
    } else {
        app_config.update_ytdlp
    };
    let ffmpeg_update_enabled = if is_flatpak {
        false
    } else {
        app_config.update_ffmpeg
    };
    let update_interval_secs = app_config.update_app_cooldown_minutes.max(1) * 60;

    let req_path = get_requirements_path();
    let mut versions = load_versions(&req_path);
    let app_tag = normalize_app_tag(&app.package_info().version.to_string());
    versions
        .local_versions
        .insert("pulsar".to_string(), app_tag);
    if is_flatpak {
        let app_ver = versions
            .local_versions
            .get("pulsar")
            .cloned()
            .unwrap_or_default();
        populate_flatpak_versions(&mut versions, &app_ver, &req_path);
    }
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let bridge_state = app.state::<BridgeState>();
    let mut bridge_shutdown = false;
    let mut bridge_updated = false;

    emit_status(&window, "Checking for updates...", false, false);
    if splash_state.is_cancelled() {
        return Ok(());
    }

    if app_update_enabled && now.saturating_sub(versions.app_last_check) >= update_interval_secs {
        match check_app_update(
            &app,
            &window,
            app_update_enabled,
            &splash_state,
            Some(&bridge_state),
            &mut bridge_shutdown,
        )
        .await
        {
            Ok(AppUpdateResult::Updated(version)) => {
                versions
                    .local_versions
                    .insert("pulsar".to_string(), normalize_app_tag(&version));
                versions.app_last_check = now;
                save_versions(&req_path, &versions);
                return Ok(());
            }
            Ok(AppUpdateResult::NotUpdated) => {
                versions.app_last_check = now;
            }
            Ok(AppUpdateResult::Cancelled) => {
                save_versions(&req_path, &versions);
                restart_bridge_if_shutdown(&app, &bridge_state, &mut bridge_shutdown);
                return Ok(());
            }
            Err(e) => {
                versions.app_last_check = now;
                emit_status(
                    &window,
                    &format!("Update check failed: {}", e),
                    false,
                    false,
                );
            }
        }
    }

    if splash_state.is_cancelled() {
        save_versions(&req_path, &versions);
        restart_bridge_if_shutdown(&app, &bridge_state, &mut bridge_shutdown);
        return Ok(());
    }

    let bridge_exists = check_file_exists(&req_path, "pulsar-bridge");
    let ffmpeg_exists =
        check_file_exists(&req_path, "ffmpeg") && check_file_exists(&req_path, "deno");

    let bridge_elapsed = now.saturating_sub(versions.bridge_last_check);
    let bridge_needs_check = !is_flatpak
        && ((bridge_update_enabled && bridge_elapsed > update_interval_secs)
            || (!bridge_exists && bridge_elapsed > FAILED_UPDATE_RETRY_SECS));

    let ffmpeg_elapsed = now.saturating_sub(versions.ffmpeg_last_check);
    let ffmpeg_needs_check = !is_flatpak
        && ((ffmpeg_update_enabled && ffmpeg_elapsed > update_interval_secs)
            || (!ffmpeg_exists && ffmpeg_elapsed > FAILED_UPDATE_RETRY_SECS));

    if bridge_needs_check {
        if splash_state.is_cancelled() {
            save_versions(&req_path, &versions);
            restart_bridge_if_shutdown(&app, &bridge_state, &mut bridge_shutdown);
            return Ok(());
        }
        match update_component(
            &client,
            &window,
            &req_path,
            "pulsar-bridge",
            &mut versions,
            &splash_state,
            Some(&bridge_state),
            &mut bridge_shutdown,
        )
        .await
        {
            Ok(ComponentUpdateResult::Updated) => {
                versions.bridge_last_check = now;
                bridge_updated = true;
            }
            Ok(ComponentUpdateResult::NotUpdated) => {
                versions.bridge_last_check = now;
            }
            Err(e) => {
                if e == "Cancelled" {
                    save_versions(&req_path, &versions);
                    restart_bridge_if_shutdown(&app, &bridge_state, &mut bridge_shutdown);
                    return Ok(());
                }
                versions.bridge_last_check = now;
                emit_status(&window, &format!("Error: {}", e), false, false);
            }
        }
    }

    if ffmpeg_needs_check {
        if splash_state.is_cancelled() {
            save_versions(&req_path, &versions);
            restart_bridge_if_shutdown(&app, &bridge_state, &mut bridge_shutdown);
            return Ok(());
        }
        match update_component(
            &client,
            &window,
            &req_path,
            "ffmpeg",
            &mut versions,
            &splash_state,
            Some(&bridge_state),
            &mut bridge_shutdown,
        )
        .await
        {
            Ok(ComponentUpdateResult::Updated) | Ok(ComponentUpdateResult::NotUpdated) => {
                versions.ffmpeg_last_check = now;
            }
            Err(e) => {
                if e == "Cancelled" {
                    save_versions(&req_path, &versions);
                    restart_bridge_if_shutdown(&app, &bridge_state, &mut bridge_shutdown);
                    return Ok(());
                }
                versions.ffmpeg_last_check = now;
                emit_status(&window, &format!("Error: {}", e), false, false);
            }
        }
    }

    save_versions(&req_path, &versions);

    if splash_state.is_cancelled() {
        restart_bridge_if_shutdown(&app, &bridge_state, &mut bridge_shutdown);
        return Ok(());
    }

    let _ = bridge_state.init(&app);

    let _ = window.emit(
        "splash-finished",
        SplashFinishedPayload {
            prewarm_bridge: true,
            bridge_updated,
        },
    );

    Ok(())
}

#[tauri::command]
pub async fn run_requirement_check(
    app: AppHandle,
    window: Window,
    component: String,
    splash_state: State<'_, SplashState>,
) -> Result<(), String> {
    splash_state.begin()?;
    let _run_guard = SplashRunGuard(&splash_state);

    let client = Client::builder()
        .user_agent("Pulsar-App")
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(600))
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
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let app_tag = normalize_app_tag(&app.package_info().version.to_string());
    versions
        .local_versions
        .insert("pulsar".to_string(), app_tag);
    if is_flatpak_runtime() {
        let app_ver = versions
            .local_versions
            .get("pulsar")
            .cloned()
            .unwrap_or_default();
        populate_flatpak_versions(&mut versions, &app_ver, &req_path);
        save_versions(&req_path, &versions);
        emit_status(&window, "Starting...", false, false);
        let _ = window.emit(
            "splash-finished",
            SplashFinishedPayload {
                prewarm_bridge: true,
                bridge_updated: false,
            },
        );
        return Ok(());
    }
    let bridge_state = app.state::<BridgeState>();
    let mut bridge_shutdown = false;
    let mut bridge_updated = false;

    let component_key = match component.trim().to_lowercase().as_str() {
        "pulsar" | "app" => "pulsar",
        "pulsar-bridge" | "bridge" => "pulsar-bridge",
        "ffmpeg" => "ffmpeg",
        _ => return Err("Unknown requirement".to_string()),
    };

    if bridge_state.has_active_work() {
        return Err(
            "Stop active downloads and conversions before updating components.".to_string(),
        );
    }

    if splash_state.is_cancelled() {
        save_versions(&req_path, &versions);
        return Ok(());
    }

    match component_key {
        "pulsar" => {
            emit_status(&window, "Checking Pulsar...", false, false);
            match check_app_update(
                &app,
                &window,
                app_config.update_app,
                &splash_state,
                Some(&bridge_state),
                &mut bridge_shutdown,
            )
            .await
            {
                Ok(AppUpdateResult::Updated(version)) => {
                    versions
                        .local_versions
                        .insert("pulsar".to_string(), normalize_app_tag(&version));
                    versions.app_last_check = now;
                    save_versions(&req_path, &versions);
                    return Ok(());
                }
                Ok(AppUpdateResult::NotUpdated) => {
                    versions.app_last_check = now;
                }
                Ok(AppUpdateResult::Cancelled) => {
                    save_versions(&req_path, &versions);
                    restart_bridge_if_shutdown(&app, &bridge_state, &mut bridge_shutdown);
                    return Ok(());
                }
                Err(e) => {
                    emit_status(
                        &window,
                        &format!("Update check failed: {}", e),
                        false,
                        false,
                    );
                    save_versions(&req_path, &versions);
                    restart_bridge_if_shutdown(&app, &bridge_state, &mut bridge_shutdown);
                    let _ = window.emit(
                        "splash-finished",
                        SplashFinishedPayload {
                            prewarm_bridge: false,
                            bridge_updated: false,
                        },
                    );
                    return Err(e);
                }
            }
        }
        "pulsar-bridge" => {
            match update_component(
                &client,
                &window,
                &req_path,
                "pulsar-bridge",
                &mut versions,
                &splash_state,
                Some(&bridge_state),
                &mut bridge_shutdown,
            )
            .await
            {
                Ok(ComponentUpdateResult::Updated) => {
                    versions.bridge_last_check = now;
                    bridge_updated = true;
                }
                Ok(ComponentUpdateResult::NotUpdated) => {
                    versions.bridge_last_check = now;
                }
                Err(e) => {
                    if e == "Cancelled" {
                        save_versions(&req_path, &versions);
                        restart_bridge_if_shutdown(&app, &bridge_state, &mut bridge_shutdown);
                        return Ok(());
                    }
                    emit_status(&window, &format!("Error: {}", e), false, false);
                    save_versions(&req_path, &versions);
                    restart_bridge_if_shutdown(&app, &bridge_state, &mut bridge_shutdown);
                    let _ = window.emit(
                        "splash-finished",
                        SplashFinishedPayload {
                            prewarm_bridge: false,
                            bridge_updated: false,
                        },
                    );
                    return Err(e);
                }
            }
        }
        "ffmpeg" => {
            match update_component(
                &client,
                &window,
                &req_path,
                "ffmpeg",
                &mut versions,
                &splash_state,
                Some(&bridge_state),
                &mut bridge_shutdown,
            )
            .await
            {
                Ok(ComponentUpdateResult::Updated) | Ok(ComponentUpdateResult::NotUpdated) => {
                    versions.ffmpeg_last_check = now;
                }
                Err(e) => {
                    if e == "Cancelled" {
                        save_versions(&req_path, &versions);
                        restart_bridge_if_shutdown(&app, &bridge_state, &mut bridge_shutdown);
                        return Ok(());
                    }
                    emit_status(&window, &format!("Error: {}", e), false, false);
                    save_versions(&req_path, &versions);
                    restart_bridge_if_shutdown(&app, &bridge_state, &mut bridge_shutdown);
                    let _ = window.emit(
                        "splash-finished",
                        SplashFinishedPayload {
                            prewarm_bridge: false,
                            bridge_updated: false,
                        },
                    );
                    return Err(e);
                }
            }
        }
        _ => {}
    }

    save_versions(&req_path, &versions);

    if splash_state.is_cancelled() {
        restart_bridge_if_shutdown(&app, &bridge_state, &mut bridge_shutdown);
        return Ok(());
    }

    restart_bridge_if_shutdown(&app, &bridge_state, &mut bridge_shutdown);
    emit_status(&window, "Starting...", false, false);
    let _ = window.emit(
        "splash-finished",
        SplashFinishedPayload {
            prewarm_bridge: bridge_updated,
            bridge_updated,
        },
    );

    Ok(())
}

pub(super) fn emit_status(window: &Window, status: &str, is_downloading: bool, can_skip: bool) {
    let _ = window.emit(
        "splash-status",
        SplashStatusPayload {
            status: status.to_string(),
            progress: if is_downloading {
                Some("Starting...".into())
            } else {
                None
            },
            is_downloading,
            can_skip,
        },
    );
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

fn is_flatpak_runtime() -> bool {
    crate::infrastructure::platform::is_flatpak()
}

fn populate_flatpak_versions(versions: &mut Versions, app_version: &str, req_path: &Path) {
    if !app_version.trim().is_empty() {
        versions
            .local_versions
            .insert("pulsar".to_string(), app_version.to_string());
    }
    let bridge_version_path = req_path.join("bridge").join("bridge-version.txt");
    match fs::read_to_string(bridge_version_path) {
        Ok(version) if !version.trim().is_empty() => {
            versions
                .local_versions
                .insert("pulsar-bridge".to_string(), version.trim().to_string());
        }
        _ => {
            versions.local_versions.remove("pulsar-bridge");
        }
    }
    versions
        .local_versions
        .insert("ffmpeg".to_string(), FLATPAK_FFMPEG_VERSION.to_string());
}

pub(super) fn shutdown_bridge_once(bridge_state: &BridgeState, bridge_shutdown: &mut bool) {
    if *bridge_shutdown {
        return;
    }
    bridge_state.shutdown();
    *bridge_shutdown = true;
}

fn restart_bridge_if_shutdown(
    app: &AppHandle,
    bridge_state: &BridgeState,
    bridge_shutdown: &mut bool,
) {
    if *bridge_shutdown {
        if let Err(error) = bridge_state.init(app) {
            eprintln!("Failed to restart Pulsar bridge after update check: {error}");
        }
        *bridge_shutdown = false;
    }
}
