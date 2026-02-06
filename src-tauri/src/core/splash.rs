use tauri::{App, AppHandle, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};

pub fn setup_splash<R: Runtime>(app: &mut App<R>) -> Result<(), Box<dyn std::error::Error>> {
    WebviewWindowBuilder::new(
        app,
        "splash",
        WebviewUrl::App("splash_screen.html".into()),
    )
        .title("Pulsar Loading...")
        .inner_size(400.0, 300.0)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .center()
        .build()?;

    Ok(())
}

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