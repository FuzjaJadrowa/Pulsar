use tauri::{AppHandle, Manager, WebviewWindowBuilder, WebviewUrl};

#[tauri::command]
pub async fn close_splash(app: AppHandle) {
    if app.get_webview_window("main").is_none() {
        let win = WebviewWindowBuilder::new(
            &app,
            "main",
            WebviewUrl::App("index.html".into())
        )
            .title("Pulsar")
            .inner_size(1000.0, 700.0)
            .min_inner_size(950.0, 650.0)
            .decorations(false)
            .transparent(true)
            .shadow(true)
            .build()
            .unwrap();

        win.show().unwrap();
    }

    if let Some(splash) = app.get_webview_window("splash") {
        splash.close().unwrap();
    }
}