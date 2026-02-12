use tauri::{AppHandle, State, Emitter};
use std::process::{Command, Stdio, Child, ChildStdin};
use std::sync::Mutex;
use std::io::{Write, BufReader, BufRead};
use std::path::PathBuf;
use std::thread;
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
}

impl BridgeState {
    pub fn new() -> Self {
        Self {
            process: Mutex::new(None),
            stdin: Mutex::new(None),
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

        let mut child = Command::new(&bridge_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn bridge: {}", e))?;

        let stdin = child.stdin.take().ok_or("Failed to open stdin")?;
        let stdout = child.stdout.take().ok_or("Failed to open stdout")?;
        let stderr = child.stderr.take().ok_or("Failed to open stderr")?;

        let app_handle_clone = app_handle.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                match line {
                    Ok(l) => {
                        println!("[BRIDGE OUT]: {}", l);
                        if let Ok(json_val) = serde_json::from_str::<Value>(&l) {
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

    fn send_command(&self, app_handle: &AppHandle, cmd: BridgeCommand) -> Result<(), String> {
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
}

#[derive(Deserialize, Debug)]
pub struct DownloadOptions {
    url: String,
    path: String,
    audio_only: bool,
    video_format: String,
    video_quality: String,
    audio_format: String,
    audio_quality: String,
    download_subs: bool,
    subs_lang: String,
    download_chat: bool,
    start_time: String,
    end_time: String,
    custom_args: String,
}

#[tauri::command]
pub fn start_download(
    app_handle: AppHandle,
    state: State<BridgeState>,
    config_mgr: State<ConfigManager>,
    options: DownloadOptions
) -> Result<String, String> {

    println!("Received download request: {:?}", options);

    let task_id = format!("task_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis());

    let config = config_mgr.config.lock().unwrap();

    let mut args: Vec<String> = Vec::new();

    args.push("--newline".to_string());
    args.push("--progress".to_string());
    args.push("--no-colors".to_string());

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

    if config.geo_bypass {
        args.push("--geo-bypass".to_string());
    }

    if options.audio_only {
        args.push("-x".to_string());

        let a_fmt = if options.audio_format == "Default" { &config.audio_format } else { &options.audio_format };
        args.push("--audio-format".to_string());
        args.push(a_fmt.clone());

        let mut a_qual = if options.audio_quality == "Default" { &config.audio_quality } else { &options.audio_quality }.clone();
        if a_qual.contains("kbps") {
            a_qual = a_qual.replace("kbps", "K");
        }
        args.push("--audio-quality".to_string());
        args.push(a_qual);

    } else {
        let v_fmt = if options.video_format == "Default" { &config.video_format } else { &options.video_format };
        args.push("--merge-output-format".to_string());
        args.push(v_fmt.clone());

        let mut v_qual = if options.video_quality == "Default" { &config.video_quality } else { &options.video_quality }.clone();
        v_qual = v_qual.replace("p", "");
        args.push("-S".to_string());
        args.push(format!("res:{}", v_qual));
    }

    if options.download_chat {
        args.push("--write-subs".to_string());
        args.push("--sub-lang".to_string());
        args.push("live_chat".to_string());
    } else if options.download_subs {
        if options.subs_lang.trim().is_empty() {
            args.push("--write-auto-subs".to_string());
        } else {
            args.push("--write-subs".to_string());
            args.push("--sub-lang".to_string());
            args.push(options.subs_lang.trim().to_string());
        }
    }

    if !options.start_time.is_empty() && !options.end_time.is_empty() {
        args.push("--download-sections".to_string());
        args.push(format!("* {}-{}", options.start_time, options.end_time));
        args.push("--force-keyframes-at-cuts".to_string());
    }

    if !options.custom_args.trim().is_empty() {
        for arg in options.custom_args.split_whitespace() {
            args.push(arg.to_string());
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

fn get_requirements_path() -> PathBuf {
    if let Some(base_dirs) = BaseDirs::new() {
        let path = base_dirs.data_local_dir().join("Pulsar").join("Requirements");
        return path;
    }
    PathBuf::from("Requirements")
}