use std::fs::File;
use std::io::Write;
use std::path::PathBuf;
use std::process::Command;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub async fn pick_download_directory(app_handle: AppHandle) -> Result<String, String> {
    let file_path = app_handle.dialog().file().blocking_pick_folder();

    match file_path {
        Some(path) => Ok(path.to_string()),
        None => Ok("".to_string()),
    }
}

#[tauri::command]
pub async fn save_thumbnail_to_disk(app_handle: AppHandle, url: String) -> Result<(), String> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return Err("Thumbnail URL cannot be empty".to_string());
    }

    println!("Fetching thumbnail from: {}", trimmed);

    let response = reqwest::get(trimmed).await.map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!(
            "Failed to fetch thumbnail: HTTP {}",
            response.status()
        ));
    }

    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    let bytes = response.bytes().await.map_err(|e| e.to_string())?;

    let ext =
        guess_thumbnail_extension(&content_type, trimmed).unwrap_or_else(|| "jpg".to_string());
    let file_name = format!("thumbnail.{}", ext);

    let file_path = app_handle
        .dialog()
        .file()
        .set_file_name(file_name)
        .add_filter("Image", &["jpg", "jpeg", "png", "webp"])
        .blocking_save_file();

    if let Some(path) = file_path {
        let path_buf = path.into_path().map_err(|e| e.to_string())?;
        let mut file = File::create(path_buf).map_err(|e| e.to_string())?;
        file.write_all(&bytes).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn read_clipboard_text() -> Result<String, String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.get_text().map_err(|e| e.to_string())
}

fn guess_thumbnail_extension(content_type: &str, url: &str) -> Option<String> {
    let ct = content_type.to_lowercase();
    if ct.contains("image/png") {
        return Some("png".to_string());
    }
    if ct.contains("image/webp") {
        return Some("webp".to_string());
    }
    if ct.contains("image/jpeg") || ct.contains("image/jpg") {
        return Some("jpg".to_string());
    }

    let clean = url.split('?').next().unwrap_or(url);
    if let Some(ext) = clean.rsplit('.').next() {
        let ext_lower = ext.to_lowercase();
        if matches!(ext_lower.as_str(), "jpg" | "jpeg" | "png" | "webp") {
            return Some(if ext_lower == "jpeg" {
                "jpg".to_string()
            } else {
                ext_lower
            });
        }
    }
    None
}

#[tauri::command]
pub fn open_in_file_manager(path: String) -> Result<(), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Path cannot be empty.".to_string());
    }

    #[cfg(target_os = "windows")]
    let clean_path_str = trimmed.replace('/', "\\");

    #[cfg(not(target_os = "windows"))]
    let clean_path_str = trimmed.to_string();

    let mut path_buf = PathBuf::from(&clean_path_str);

    if !path_buf.exists() {
        if let Some(existing_ancestor) = path_buf.ancestors().skip(1).find(|p| p.exists()) {
            path_buf = existing_ancestor.to_path_buf();
        } else {
            return Err("Target path and its parent directories do not exist.".to_string());
        }
    }

    #[cfg(target_os = "windows")]
    {
        let mut cmd = Command::new("explorer");
        let win_path = path_buf.to_string_lossy().replace('/', "\\");
        if path_buf.is_file() {
            let arg = format!("/select,{}", win_path);
            cmd.arg(arg);
        } else {
            cmd.arg(win_path);
        }
        cmd.spawn().map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        let mut cmd = Command::new("open");
        if path_buf.is_file() {
            cmd.arg("-R").arg(&path_buf);
        } else {
            cmd.arg(&path_buf);
        }
        cmd.spawn().map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        let mut cmd = Command::new("xdg-open");
        if path_buf.is_file() {
            if let Some(parent) = path_buf.parent() {
                cmd.arg(parent);
            } else {
                cmd.arg(&path_buf);
            }
        } else {
            cmd.arg(&path_buf);
        }
        cmd.spawn().map_err(|e| e.to_string())?;
    }

    Ok(())
}
