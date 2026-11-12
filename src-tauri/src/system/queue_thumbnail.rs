use base64::{engine::general_purpose::STANDARD, Engine as _};
use std::path::Path;
use std::process::{Command, Stdio};
use std::time::{SystemTime, UNIX_EPOCH};

#[tauri::command]
pub async fn generate_queue_thumbnail(
    path: String,
    category: String,
    duration_seconds: Option<f64>,
) -> String {
    tokio::task::spawn_blocking(move || {
        generate_thumbnail(&path, &category, duration_seconds)
    })
    .await
    .unwrap_or_default()
}

fn generate_thumbnail(path: &str, category: &str, duration_seconds: Option<f64>) -> String {
    let input_path = path.trim();
    let category = category.trim().to_lowercase();
    if input_path.is_empty()
        || !["video", "audio", "image"].contains(&category.as_str())
        || !Path::new(input_path).is_file()
    {
        return String::new();
    }

    let ffmpeg = crate::infrastructure::ffmpeg::paths::get_ffmpeg_path();
    if !ffmpeg.is_file() {
        return String::new();
    }

    let mut command = Command::new(ffmpeg);
    command
        .arg("-hide_banner")
        .arg("-loglevel")
        .arg("error")
        .arg("-nostdin");

    if category == "video" {
        if let Some(duration) = duration_seconds.filter(|value| value.is_finite() && *value > 1.0) {
            let nanos = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .subsec_nanos() as f64;
            let fraction = (nanos % 10_000.0) / 10_000.0;
            let seek_seconds = duration * (0.2 + fraction * 0.6);
            command.arg("-ss").arg(format!("{seek_seconds:.3}"));
        }
    }

    command
        .arg("-i")
        .arg(input_path)
        .arg("-map")
        .arg("0:v:0")
        .arg("-frames:v")
        .arg("1")
        .arg("-vf")
        .arg("scale=480:270:force_original_aspect_ratio=decrease")
        .arg("-an")
        .arg("-sn")
        .arg("-dn")
        .arg("-f")
        .arg("image2pipe")
        .arg("-c:v")
        .arg("mjpeg")
        .arg("-q:v")
        .arg("5")
        .arg("pipe:1")
        .stdout(Stdio::piped())
        .stderr(Stdio::null());

    let output = match command.output() {
        Ok(output) if output.status.success() && !output.stdout.is_empty() => output,
        _ => return String::new(),
    };

    format!("data:image/jpeg;base64,{}", STANDARD.encode(output.stdout))
}
