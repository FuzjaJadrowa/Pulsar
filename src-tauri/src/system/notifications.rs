use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};
use tauri::path::BaseDirectory;

#[tauri::command]
pub fn send_system_notification(
    app: AppHandle,
    title: String,
    body: String,
    kind: Option<String>,
) -> Result<(), String> {
    let _ = kind;
    let icon_path = resolve_icon_path(&app);

    #[cfg(windows)]
    {
        use tauri_winrt_notification::{IconCrop, Toast};

        let app_id = app.config().identifier.clone();
        let app_name = app
            .config()
            .product_name
            .clone()
            .unwrap_or_else(|| "Pulsar".to_string());

        if let Some(ref icon) = icon_path {
            let _ = ensure_windows_app_id(&app_id, &app_name, icon);
        }

        let mut toast = Toast::new(&app_id).title(&title).text1(&body);
        if let Some(ref icon) = icon_path {
            toast = toast.icon(icon.as_path(), IconCrop::Circular, "Pulsar");
        }

        // Fallback app ID improves delivery on systems without custom registration.
        if toast.show().is_err() {
            let mut fallback = Toast::new(Toast::POWERSHELL_APP_ID).title(&title).text1(&body);
            if let Some(ref icon) = icon_path {
                fallback = fallback.icon(icon.as_path(), IconCrop::Circular, "Pulsar");
            }
            fallback
                .show()
                .map_err(|error| format!("{error:?}"))?;
        }

        return Ok(());
    }

    #[cfg(not(windows))]
    {
        use tauri_plugin_notification::NotificationExt;

        let mut builder = app.notification().builder().title(title).body(body);
        if let Some(icon) = icon_path {
            builder = builder.icon(icon.to_string_lossy().to_string());
        }
        builder.show().map_err(|error| error.to_string())?;
        return Ok(());
    }
}

#[cfg(windows)]
fn ensure_windows_app_id(app_id: &str, app_name: &str, icon_path: &Path) -> Result<(), String> {
    use windows_registry::CURRENT_USER;

    let key = CURRENT_USER
        .create(format!(r"SOFTWARE\Classes\AppUserModelId\{app_id}"))
        .map_err(|error| format!("{error:?}"))?;
    key.set_string("DisplayName", app_name)
        .map_err(|error| format!("{error:?}"))?;
    key.set_string("IconBackgroundColor", "0")
        .map_err(|error| format!("{error:?}"))?;
    key.set_string("IconUri", &icon_path.display().to_string())
        .map_err(|error| format!("{error:?}"))?;
    Ok(())
}

fn resolve_icon_path(app: &AppHandle) -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(path) = app.path().resolve("icon.png", BaseDirectory::Resource) {
        candidates.push(path);
    }
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("src").join("assets").join("icons").join("icon.png"));
    }

    for path in candidates {
        if path.exists() {
            return Some(path);
        }
    }

    None
}