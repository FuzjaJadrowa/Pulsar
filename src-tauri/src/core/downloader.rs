use tauri::{AppHandle, State, Emitter};
use tauri_plugin_dialog::DialogExt;
use std::process::{Command, Stdio, Child, ChildStdin};
use std::sync::{Mutex, Arc};
use std::collections::HashMap;
use std::io::{Write, BufReader, BufRead};
use std::path::PathBuf;
use std::thread;
use std::fs::File;
use serde::{Serialize, Deserialize};
use serde_json::Value;
use directories::BaseDirs;
use crate::system::config::ConfigManager;

#[derive(Serialize)]
pub struct BridgeCommand {
    command: String,
    id: String,
    args: Vec<String>,
}

pub struct BridgeState {
    process: Mutex<Option<Child>>,
    stdin: Mutex<Option<ChildStdin>>,
    ffmpeg_ranges: Arc<Mutex<HashMap<String, FfmpegRange>>>,
}

impl BridgeState {
    pub fn new() -> Self {
        Self {
            process: Mutex::new(None),
            stdin: Mutex::new(None),
            ffmpeg_ranges: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn init(&self, app_handle: &AppHandle) -> Result<(), String> {
        let mut process_guard = self.process.lock().unwrap();

        if process_guard.is_some() {
            return Ok(());
        }

        let req_path = get_requirements_path();
        let bridge_name = if cfg!(target_os = "windows") { "pulsar-bridge.exe" } else { "pulsar-bridge" };
        let bridge_path = req_path.join(bridge_name);

        if !bridge_path.exists() {
            return Err(format!("Bridge not found at: {:?}", bridge_path));
        }

        let mut cmd = Command::new(&bridge_path);
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        let mut child = cmd
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn bridge: {}", e))?;

        let stdin = child.stdin.take().ok_or("Failed to open stdin")?;
        let stdout = child.stdout.take().ok_or("Failed to open stdout")?;
        let stderr = child.stderr.take().ok_or("Failed to open stderr")?;

        let app_handle_clone = app_handle.clone();
        let ffmpeg_ranges = self.ffmpeg_ranges.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                match line {
                    Ok(l) => {
                        println!("[BRIDGE OUT]: {}", l);
                        if let Ok(mut json_val) = serde_json::from_str::<Value>(&l) {
                            if json_val.get("type").and_then(|v| v.as_str()) == Some("progress_ffmpeg") {
                                if let Some(id) = json_val.get("id").and_then(|v| v.as_str()) {
                                    if let Some(total) = ffmpeg_ranges.lock().unwrap().get(id).map(|r| r.total_seconds) {
                                        if let Some(elapsed) = extract_ffmpeg_elapsed_seconds(&json_val) {
                                            if total > 0.0 {
                                                let percent = (elapsed / total * 100.0).clamp(0.0, 100.0);
                                                let eta_seconds = (total - elapsed).max(0.0);
                                                json_val["percent"] = Value::from(percent);
                                                json_val["eta_seconds"] = Value::from(eta_seconds);
                                            }
                                        }
                                    }
                                }
                            }
                            if let Some(id) = json_val.get("id").and_then(|v| v.as_str()) {
                                if is_terminal_event(&json_val) {
                                    ffmpeg_ranges.lock().unwrap().remove(id);
                                }
                            }
                            let _ = app_handle_clone.emit("download-event", json_val);
                        }
                    }
                    Err(e) => eprintln!("Error reading bridge stdout: {}", e),
                }
            }
        });

        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(l) = line {
                    eprintln!("[BRIDGE ERR]: {}", l);
                }
            }
        });

        *self.stdin.lock().unwrap() = Some(stdin);
        *process_guard = Some(child);

        println!("Bridge process started successfully.");
        Ok(())
    }

    pub fn send_command(&self, app_handle: &AppHandle, cmd: BridgeCommand) -> Result<(), String> {
        self.send_raw_command(app_handle, &cmd)
    }

    pub fn send_raw_command<T: Serialize>(&self, app_handle: &AppHandle, cmd: &T) -> Result<(), String> {
        self.init(app_handle)?;

        if let Some(stdin) = self.stdin.lock().unwrap().as_mut() {
            let json = serde_json::to_string(cmd).map_err(|e| e.to_string())?;
            writeln!(stdin, "{}", json).map_err(|e| format!("Failed to write to bridge: {}", e))?;
            println!("[RUST -> BRIDGE]: {}", json);
            Ok(())
        } else {
            Err("Bridge stdin not available".to_string())
        }
    }

    pub fn set_ffmpeg_range(&self, task_id: String, total_seconds: f64) {
        if total_seconds <= 0.0 {
            return;
        }
        self.ffmpeg_ranges.lock().unwrap().insert(task_id, FfmpegRange { total_seconds });
    }

    pub fn clear_ffmpeg_range(&self, task_id: &str) {
        self.ffmpeg_ranges.lock().unwrap().remove(task_id);
    }
}

struct FfmpegRange {
    total_seconds: f64,
}

#[derive(Deserialize, Debug)]
pub struct DownloadOptions {
    url: String,
    path: String,
    mode: String,
    video_format: Option<String>,
    video_quality: Option<String>,
    audio_format: Option<String>,
    audio_quality: Option<String>,
    is_time_range_active: bool,
    start_time: String,
    end_time: String,
    geo_bypass: bool,
    embed_tags: bool,
    embed_thumbnail: bool,
    download_subs: bool,
    download_chat: bool,
    subs_code: String,
    client_task_id: Option<String>,
}

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
    let video_id = extract_video_id(&url).ok_or("Could not extract Video ID")?;
    let thumb_url = format!("https://i3.ytimg.com/vi/{}/maxresdefault.jpg", video_id);

    println!("Fetching thumbnail from: {}", thumb_url);

    let response = reqwest::get(&thumb_url).await.map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("Failed to fetch thumbnail: HTTP {}", response.status()));
    }

    let bytes = response.bytes().await.map_err(|e| e.to_string())?;

    let file_path = app_handle.dialog().file()
        .set_file_name(format!("{}_thumbnail.jpg", video_id))
        .add_filter("JPEG Image", &["jpg", "jpeg"])
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

fn extract_video_id(url: &str) -> Option<String> {
    if let Some(index) = url.find("v=") {
        let remainder = &url[index + 2..];
        let end = remainder.find('&').unwrap_or(remainder.len());
        return Some(remainder[0..end].to_string());
    } else if let Some(index) = url.find("youtu.be/") {
        let remainder = &url[index + 9..];
        let end = remainder.find('?').unwrap_or(remainder.len());
        return Some(remainder[0..end].to_string());
    }
    None
}

fn generate_task_id() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis();
    now.to_string()
}

#[tauri::command]
pub fn start_download(
    app_handle: AppHandle,
    state: State<BridgeState>,
    config_mgr: State<ConfigManager>,
    options: DownloadOptions
) -> Result<String, String> {

    println!("Received download request: {:?}", options);

    let task_id = options
        .client_task_id
        .as_ref()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(generate_task_id);
    let config = config_mgr.config.lock().unwrap();

    let mut args: Vec<String> = Vec::new();

    let req_path = get_requirements_path();
    let ffmpeg_name = if cfg!(target_os = "windows") { "ffmpeg.exe" } else { "ffmpeg" };
    let ffmpeg_path = req_path.join(ffmpeg_name);
    args.push("--ffmpeg-location".to_string());
    args.push(ffmpeg_path.to_string_lossy().to_string());

    if !options.path.is_empty() {
        args.push("-P".to_string());
        args.push(options.path.clone());
    }

    if config.cookies_browser != "None" {
        args.push("--cookies-from-browser".to_string());
        args.push(config.cookies_browser.to_lowercase());
    }

    if options.mode == "audio" {
        args.push("-x".to_string());
        if let Some(fmt) = options.audio_format {
            args.push("--audio-format".to_string());
            args.push(fmt.to_lowercase());
        }
        if let Some(quality) = options.audio_quality {
            let q_arg = quality.replace("kbps", "K");
            args.push("--audio-quality".to_string());
            args.push(q_arg);
        }
    } else {
        if let Some(fmt) = options.video_format {
            args.push("--merge-output-format".to_string());
            args.push(fmt.to_lowercase());
        }
        if let Some(quality) = options.video_quality {
            let res = quality.replace("p", "");
            args.push("-S".to_string());
            args.push(format!("res:{}", res));
        }
    }

    if options.is_time_range_active {
        if let (Some(start), Some(end)) = (parse_time_to_seconds(&options.start_time), parse_time_to_seconds(&options.end_time)) {
            let total = (end - start).max(0.0);
            if total > 0.0 {
                state.set_ffmpeg_range(task_id.clone(), total);
            }
        }
        args.push("--download-sections".to_string());
        args.push(format!("*{}-{}", options.start_time, options.end_time));
        args.push("--force-keyframes-at-cuts".to_string());
    }

    if options.embed_thumbnail {
        args.push("--embed-thumbnail".to_string());
    }

    if options.geo_bypass {
        args.push("--geo-bypass".to_string());
    }

    if options.embed_tags {
        args.push("--embed-metadata".to_string());
    }

    let has_subs = options.download_subs;
    let has_chat = options.download_chat;
    let code_input = options.subs_code.trim();

    if has_chat {
        args.push("--write-auto-subs".to_string());
        args.push("--sub-lang".to_string());
        if has_subs {
            if code_input.is_empty() {
                args.push("en,live_chat".to_string());
            } else {
                args.push(format!("{},live_chat", code_input));
            }
        } else {
            args.push("live_chat".to_string());
        }
    } else if has_subs {
        args.push("--write-auto-subs".to_string());
        if !code_input.is_empty() {
            args.push("--sub-lang".to_string());
            args.push(code_input.to_string());
        }
    }

    args.push(options.url.clone());

    let cmd = BridgeCommand {
        command: "download".to_string(),
        id: task_id.clone(),
        args,
    };

    state.send_command(&app_handle, cmd)?;

    Ok(task_id)
}

#[tauri::command]
pub fn cancel_download(app_handle: AppHandle, state: State<BridgeState>, task_id: String) -> Result<(), String> {
    if task_id.trim().is_empty() {
        return Err("Task ID cannot be empty.".to_string());
    }

    let trimmed = task_id.trim().to_string();
    let cmd = BridgeCommand {
        command: "cancel".to_string(),
        id: trimmed.clone(),
        args: Vec::new(),
    };

    let result = state.send_command(&app_handle, cmd);
    state.clear_ffmpeg_range(trimmed.as_str());
    result
}

#[tauri::command]
pub fn open_in_file_manager(path: String) -> Result<(), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Path cannot be empty.".to_string());
    }

    let path_buf = PathBuf::from(trimmed);

    #[cfg(target_os = "windows")]
    {
        let mut cmd = Command::new("explorer");
        if path_buf.is_file() {
            let arg = format!("/select,{}", path_buf.to_string_lossy());
            cmd.arg(arg);
        } else {
            cmd.arg(path_buf);
        }
        cmd.spawn().map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        let mut cmd = Command::new("open");
        if path_buf.is_file() {
            cmd.arg("-R").arg(path_buf);
        } else {
            cmd.arg(path_buf);
        }
        cmd.spawn().map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        let mut cmd = Command::new("xdg-open");
        cmd.arg(path_buf);
        cmd.spawn().map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn get_requirements_path() -> PathBuf {
    if let Some(base_dirs) = BaseDirs::new() {
        return base_dirs.data_local_dir().join("Pulsar").join("Requirements");
    }
    PathBuf::from("Requirements")
}

fn parse_time_to_seconds(input: &str) -> Option<f64> {
    let parts: Vec<&str> = input.trim().split(':').collect();
    if parts.is_empty() {
        return None;
    }
    let mut total = 0.0;
    for (idx, part) in parts.iter().rev().enumerate() {
        let value = part.parse::<f64>().ok()?;
        let factor = match idx {
            0 => 1.0,
            1 => 60.0,
            2 => 3600.0,
            _ => return None,
        };
        total += value * factor;
    }
    Some(total)
}

fn extract_ffmpeg_elapsed_seconds(payload: &Value) -> Option<f64> {
    if let Some(t) = payload.get("time").and_then(|v| v.as_str()) {
        return parse_time_to_seconds(t);
    }
    if let Some(t) = payload.get("out_time").and_then(|v| v.as_str()) {
        return parse_time_to_seconds(t);
    }
    if let Some(v) = payload.get("out_time_ms") {
        if let Some(n) = v.as_f64() {
            return Some(n / 1000.0);
        }
        if let Some(s) = v.as_str() {
            if let Ok(n) = s.parse::<f64>() {
                return Some(n / 1000.0);
            }
        }
    }
    if let Some(v) = payload.get("out_time_us") {
        if let Some(n) = v.as_f64() {
            return Some(n / 1_000_000.0);
        }
        if let Some(s) = v.as_str() {
            if let Ok(n) = s.parse::<f64>() {
                return Some(n / 1_000_000.0);
            }
        }
    }
    None
}

fn is_terminal_event(payload: &Value) -> bool {
    let type_val = payload.get("type").and_then(|v| v.as_str()).unwrap_or("");
    if matches!(type_val, "finished" | "cancelled") {
        return true;
    }
    let status = payload.get("status").and_then(|v| v.as_str()).unwrap_or("");
    if matches!(status, "finished" | "success" | "error") {
        return true;
    }
    let event = payload.get("event").and_then(|v| v.as_str()).unwrap_or("");
    if matches!(event, "finished" | "success" | "error") {
        return true;
    }
    payload.get("success").and_then(|v| v.as_bool()).is_some()
}