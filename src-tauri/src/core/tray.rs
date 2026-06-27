use std::path::PathBuf;

use crate::system::queue::QueueState;
use tauri::image::Image;
use tauri::menu::{Menu, MenuItem};
use tauri::path::BaseDirectory;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Runtime};

pub fn build_tray_icon<R: Runtime>(app: &AppHandle<R>, queue_state: &QueueState) -> tauri::Result<()> {
    let menu = build_tray_menu(app, queue_state);
    let mut builder = TrayIconBuilder::with_id("main").menu(&menu);
    if let Some(icon) = load_tray_icon(app) {
        builder = builder.icon(icon);
    }
    builder
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "tray_clear_queue" => {
                    let _ = app.emit("tray-clear-queue", ());
                }
                "tray_quit" => app.exit(0),
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button, button_state, .. } = event {
                if button == MouseButton::Left && button_state == MouseButtonState::Up {
                    if let Some(window) = tray.app_handle().get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.unminimize();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .build(app)?;
    Ok(())
}

pub fn sync_tray_from_queue<R: Runtime>(app: &AppHandle<R>, queue_state: &QueueState) {
    update_tray_menu(app, queue_state);
}

fn build_tray_menu<R: Runtime>(app: &AppHandle<R>, queue_state: &QueueState) -> Menu<R> {
    let version = app.package_info().version.to_string();
    let total = queue_state.items.len();
    let processing = queue_state
        .items
        .iter()
        .filter(|item| item.status == "downloading")
        .count();

    let title = MenuItem::with_id(app, "tray_title", format!("Pulsar v{}", version), false, None::<&str>)
        .expect("tray title menu item");
    let processing_item = MenuItem::with_id(
        app,
        "tray_processing",
        format!("{} processing", processing),
        false,
        None::<&str>,
    )
    .expect("tray processing menu item");
    let clear_enabled = total > 0;
    let clear_item = MenuItem::with_id(
        app,
        "tray_clear_queue",
        format!("Clear queue ({})", total),
        clear_enabled,
        None::<&str>,
    )
    .expect("tray clear menu item");
    let quit_item = MenuItem::with_id(app, "tray_quit", "Quit", true, None::<&str>)
        .expect("tray quit menu item");

    Menu::with_items(app, &[&title, &processing_item, &clear_item, &quit_item])
        .expect("tray menu")
}

fn update_tray_menu<R: Runtime>(app: &AppHandle<R>, queue_state: &QueueState) {
    if let Some(tray) = app.tray_by_id("main") {
        let menu = build_tray_menu(app, queue_state);
        let _ = tray.set_menu(Some(menu));
    }
}

fn load_tray_icon<R: Runtime>(app: &AppHandle<R>) -> Option<Image<'static>> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(path) = app.path().resolve("icon.png", BaseDirectory::Resource) {
        candidates.push(path);
    }
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("public").join("assets").join("icons").join("icon.png"));
    }

    for path in candidates {
        if path.exists() {
            if let Ok(img) = Image::from_path(path) {
                return Some(img.to_owned());
            }
        }
    }

    // Final fallback
    Image::from_bytes(include_bytes!("../../../public/assets/icons/icon.png"))
        .ok()
        .map(|img| img.to_owned())
}