use std::fs::{self, File};
use std::io::{self, Cursor, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use std::env;
use std::process::Command;

use tauri::{AppHandle, Emitter, Manager, Window};
use serde::{Deserialize, Serialize};
use serde_json::json;
use directories::BaseDirs;
use reqwest::Client;
use futures_util::StreamExt;

const APP_VERSION: &str = "v1.0.0";
const APP_REPO_URL: &str = "https://api.github.com/repos/fuzjajadrowa/Pulsar/releases/latest";
const BRIDGE_REPO_URL: &str = "https://api.github.com/repos/fuzjajadrowa/Pulsar-Bridge/releases/latest";
const FFMPEG_REPO_URL: &str = "https://api.github.com/repos/BtbN/FFmpeg-Builds/releases/latest";

#[derive(Serialize, Deserialize, Debug, Clone)]
struct Versions {
    app_last_check: u64,
    req_last_check: u64,
    #[serde(flatten)]
    local_versions: std::collections::HashMap<String, String>,
}

impl Default for Versions {
    fn default() -> Self {
        Self {
            app_last_check: 0,
            req_last_check: 0,
            local_versions: std::collections::HashMap::new(),
        }
    }
}

#[derive(Clone, Serialize)]
struct SplashStatusPayload {
    status: String,
    progress: Option<String>,
    is_downloading: bool,
    can_skip: bool,
}

#[tauri::command]
pub async fn run_splash_checks(app: AppHandle, window: Window) -> Result<(), String> {
    let client = Client::builder()
        .user_agent("Pulsar-App")
        .build()
        .map_err(|e| e.to_string())?;

    let req_path = get_requirements_path();
    let mut versions = load_versions(&req_path);
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();

    emit_status(&window, "Checking for updates...", false, false);

    let mut app_checked = false;
    if now - versions.app_last_check >= 1800 {
        match check_app_update(&client, &app, &window).await {
            Ok(updated) => {
                if updated {
                    return Ok(());
                }
                app_checked = true;
            }
            Err(_) => {
                emit_status(&window, "Update check failed (App)", false, false);
            }
        }
    }

    let mut req_checked = false;
    let mut needs_check = false;

    if !check_file_exists(&req_path, "pulsar-bridge") || !check_file_exists(&req_path, "ffmpeg") {
        needs_check = true;
    } else if now - versions.req_last_check > 1800 {
        needs_check = true;
    }

    if needs_check {
        if !check_file_exists(&req_path, "pulsar-bridge") || now - versions.req_last_check > 1800 {
            match update_component(&client, &window, &req_path, "pulsar-bridge", &mut versions).await {
                Ok(_) => req_checked = true,
                Err(e) => emit_status(&window, &format!("Error: {}", e), false, false),
            }
        }

        if !check_file_exists(&req_path, "ffmpeg") || now - versions.req_last_check > 1800 {
            match update_component(&client, &window, &req_path, "ffmpeg", &mut versions).await {
                Ok(_) => req_checked = true,
                Err(e) => emit_status(&window, &format!("Error: {}", e), false, false),
            }
        }
    }

    if app_checked { versions.app_last_check = now; }
    if req_checked { versions.req_last_check = now; }
    save_versions(&req_path, &versions);

    emit_status(&window, "Starting...", false, false);
    tokio::time::sleep(std::time::Duration::from_millis(500)).await;

    let _ = window.emit("splash-finished", ());

    Ok(())
}

async fn check_app_update(client: &Client, app: &AppHandle, window: &Window) -> Result<bool, String> {
    let resp = client.get(APP_REPO_URL).send().await.map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err("Network error".to_string());
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let remote_ver = json["tag_name"].as_str().unwrap_or("").to_string();

    if remote_ver.is_empty() || !is_remote_newer(APP_VERSION, &remote_ver) {
        return Ok(false);
    }

    let assets = json["assets"].as_array().ok_or("No assets")?;
    let mut download_url = String::new();
    let mut file_name = String::new();

    for asset in assets {
        let name = asset["name"].as_str().unwrap_or("");
        let url = asset["browser_download_url"].as_str().unwrap_or("");

        #[cfg(target_os = "windows")]
        if name.contains("win64") && name.ends_with(".zip") {
            download_url = url.to_string();
            file_name = "update.zip".to_string();
            break;
        }
        #[cfg(target_os = "macos")]
        if name.contains("MacOS") && name.ends_with(".zip") {
            download_url = url.to_string();
            file_name = "update.zip".to_string();
            break;
        }
        #[cfg(target_os = "linux")]
        if name.contains("Linux") && (name.ends_with(".tar.gz") || name.ends_with(".tgz")) {
            download_url = url.to_string();
            file_name = "update.tar.gz".to_string();
            break;
        }
    }

    if download_url.is_empty() {
        emit_status(window, "This build is not updatable", false, false);
        tokio::time::sleep(std::time::Duration::from_secs(5)).await;
        return Ok(false);
    }

    emit_status(window, &format!("Updating app to {}", remote_ver), true, true);

    let temp_dir = std::env::temp_dir();
    let download_path = temp_dir.join(&file_name);

    download_file(client, window, &download_url, &download_path).await?;
    apply_app_update(app, window, &download_path)?;

    Ok(true)
}

async fn update_component(client: &Client, window: &Window, req_path: &Path, name: &str, versions: &mut Versions) -> Result<(), String> {
    emit_status(window, &format!("Checking {}...", name), false, false);

    let url = if name == "pulsar-bridge" { BRIDGE_REPO_URL } else { FFMPEG_REPO_URL };
    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err("Network error".to_string());
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let remote_ver = json["published_at"].as_str().unwrap_or("").to_string();
    let assets = json["assets"].as_array().ok_or("No assets")?;

    let local_ver = versions.local_versions.get(name).cloned().unwrap_or_default();
    let local_exists = check_file_exists(req_path, name);

    if local_exists && local_ver == remote_ver {
        return Ok(());
    }

    let mut download_url = String::new();
    let os = get_os_name();

    for asset in assets {
        let asset_name = asset["name"].as_str().unwrap_or("").to_lowercase();
        let dl_link = asset["browser_download_url"].as_str().unwrap_or("").to_string();

        if name == "pulsar-bridge" {
            if os == "win" && asset_name == "pulsar-bridge-windows.exe" {
                download_url = dl_link; break;
            } else if os == "mac" && asset_name == "pulsar-bridge-macos" {
                download_url = dl_link; break;
            } else if os == "linux" && asset_name == "pulsar-bridge-linux" {
                download_url = dl_link; break;
            }
        } else if name == "ffmpeg" {
            #[cfg(target_os = "windows")]
            if asset_name.contains("win64-gpl") && asset_name.ends_with(".zip") { download_url = dl_link; break; }
        }
    }

    if download_url.is_empty() { return Ok(()); }

    emit_status(window, &format!("Downloading {}...", name), true, local_exists);

    let temp_name = if download_url.ends_with(".zip") { "temp.zip" } else if download_url.ends_with(".tar.xz") { "temp.tar.xz" } else { "temp_bin" };
    let target_dl_path = req_path.join(temp_name);

    download_file(client, window, &download_url, &target_dl_path).await?;
    emit_status(window, "Extracting...", false, false);

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

async fn download_file(client: &Client, window: &Window, url: &str, dest: &PathBuf) -> Result<(), String> {
    let res = client.get(url).send().await.map_err(|e| e.to_string())?;
    let total_size = res.content_length().unwrap_or(0);

    let mut file = File::create(dest).map_err(|e| e.to_string())?;
    let mut downloaded: u64 = 0;
    let mut stream = res.bytes_stream();

    while let Some(item) = stream.next().await {
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
        let tar = std::process::Command::new("tar")
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
        for entry in fs::read_dir(dest_dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.is_dir() && entry.file_name().to_string_lossy().to_lowercase().contains("ffmpeg") {
                let bin_dir = path.join("bin");
                if bin_dir.exists() {
                    for bin_file in fs::read_dir(bin_dir).map_err(|e| e.to_string())? {
                        let bin_file = bin_file.map_err(|e| e.to_string())?;
                        let dest_file = dest_dir.join(bin_file.file_name());
                        if dest_file.exists() { let _ = fs::remove_file(&dest_file); }
                        let _ = fs::rename(bin_file.path(), dest_file);
                    }
                }
                let _ = fs::remove_dir_all(path);
            }
        }
    }

    Ok(())
}

fn apply_app_update(app: &AppHandle, window: &Window, archive_path: &Path) -> Result<(), String> {
    emit_status(window, "Applying update...", false, false);

    let _ = window.hide();

    let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let app_dir = current_exe.parent().unwrap();
    let temp_extract_dir = std::env::temp_dir().join("GVD_Update_Extracted");

    #[cfg(target_os = "windows")]
    {
        let updater_path = std::env::temp_dir().join("gvd_updater.bat");
        let script_content = format!(
            "@echo off\r\n\
            chcp 65001 > nul\r\n\
            timeout /t 2 /nobreak > nul\r\n\
            if exist \"{}\" rmdir /s /q \"{}\"\r\n\
            mkdir \"{}\"\r\n\
            powershell -command \"Expand-Archive -Path '{}' -DestinationPath '{}' -Force\"\r\n\
            powershell -command \"$subDir = Get-ChildItem -Path '{}' -Directory | Select-Object -First 1; Get-ChildItem -Path $subDir.FullName | Where-Object {{ $_.Name -ne 'Data' }} | Copy-Item -Destination '{}' -Recurse -Force\"\r\n\
            rmdir /s /q \"{}\"\r\n\
            del /f /q \"{}\"\r\n\
            start \"\" \"{}\\Pulsar.exe\"\r\n\
            del \"%~f0\"\r\n",
            temp_extract_dir.display(), temp_extract_dir.display(),
            temp_extract_dir.display(),
            archive_path.display(), temp_extract_dir.display(),
            temp_extract_dir.display(), app_dir.display(),
            temp_extract_dir.display(),
            archive_path.display(),
            app_dir.display()
        );

        let mut file = File::create(&updater_path).map_err(|e| e.to_string())?;
        file.write_all(script_content.as_bytes()).map_err(|e| e.to_string())?;

        let ps_cmd = format!("Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', '\"{}\"' -Verb RunAs -WindowStyle Hidden", updater_path.display());
        Command::new("powershell")
            .args(&["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &ps_cmd])
            .spawn()
            .map_err(|e| e.to_string())?;

        app.exit(0);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let updater_path = std::env::temp_dir().join("gvd_updater.sh");
        let mut content = format!(
            "#!/bin/bash\n\
            sleep 2\n\
            rm -rf \"{}\"\n\
            mkdir -p \"{}\"\n",
            temp_extract_dir.display(), temp_extract_dir.display()
        );

        #[cfg(target_os = "macos")]
        {
            let bundle_path = app_dir.parent().unwrap().parent().unwrap();
            let bundle_parent = bundle_path.parent().unwrap();

            content.push_str(&format!(
                "unzip -o -q \"{}\" -d \"{}\"\n\
                NEW_APP=$(find \"{}\" -name \"*.app\" -maxdepth 2 | head -n 1)\n\
                rm -rf \"{}\"\n\
                mv \"$NEW_APP\" \"{}/\"\n\
                open -n \"{}\"\n",
                archive_path.display(), temp_extract_dir.display(),
                temp_extract_dir.display(),
                bundle_path.display(),
                bundle_parent.display(),
                bundle_path.display()
            ));
        }

        #[cfg(target_os = "linux")]
        {
            content.push_str(&format!(
                "tar -xf \"{}\" -C \"{}\"\n\
                SUBDIR=$(find \"{}\" -maxdepth 1 -type d ! -path \"{}\" | head -n 1)\n\
                cp -rf \"$SUBDIR\"/* \"{}/\"\n\
                chmod +x \"{}/Pulsar\"\n\
                nohup \"{}/Pulsar\" > /dev/null 2>&1 &\n",
                archive_path.display(), temp_extract_dir.display(),
                temp_extract_dir.display(), temp_extract_dir.display(),
                app_dir.display(),
                app_dir.display(),
                app_dir.display()
            ));
        }

        content.push_str(&format!(
            "rm -rf \"{}\"\n\
            rm \"{}\"\n\
            rm \"$0\"\n",
            temp_extract_dir.display(), archive_path.display()
        ));

        let mut file = File::create(&updater_path).map_err(|e| e.to_string())?;
        file.write_all(content.as_bytes()).map_err(|e| e.to_string())?;

        let _ = window.hide();

        Command::new("chmod").args(&["+x", updater_path.to_str().unwrap()]).output().expect("Failed to chmod");
        Command::new("/bin/bash").arg(updater_path).spawn().expect("Failed to spawn updater");
        app.exit(0);
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

fn is_remote_newer(local: &str, remote: &str) -> bool {
    let l_clean = local.trim_start_matches('v');
    let r_clean = remote.trim_start_matches('v');

    let l_parts: Vec<&str> = l_clean.split('.').collect();
    let r_parts: Vec<&str> = r_clean.split('.').collect();

    let len = std::cmp::max(l_parts.len(), r_parts.len());

    for i in 0..len {
        let l_val = l_parts.get(i).unwrap_or(&"0").parse::<i32>().unwrap_or(0);
        let r_val = r_parts.get(i).unwrap_or(&"0").parse::<i32>().unwrap_or(0);

        if r_val > l_val { return true; }
        if r_val < l_val { return false; }
    }
    false
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