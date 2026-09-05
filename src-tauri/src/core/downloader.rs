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
    sub_listeners: Arc<Mutex<HashMap<String, std::sync::mpsc::Sender<Value>>>>,
    batch_cancels: Arc<Mutex<HashMap<String, Arc<std::sync::atomic::AtomicBool>>>>,
}

#[tauri::command]
pub fn init_bridge(app_handle: AppHandle, state: State<BridgeState>) -> Result<(), String> {
    state.init(&app_handle)
}

impl BridgeState {
    pub fn new() -> Self {
        Self {
            process: Mutex::new(None),
            stdin: Mutex::new(None),
            ffmpeg_ranges: Arc::new(Mutex::new(HashMap::new())),
            sub_listeners: Arc::new(Mutex::new(HashMap::new())),
            batch_cancels: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn shutdown(&self) {
        if let Some(stdin) = self.stdin.lock().unwrap().as_mut() {
            let _ = stdin.write_all(b"{\"command\":\"exit\"}\n");
            let _ = stdin.flush();
        }
        if let Some(mut child) = self.process.lock().unwrap().take() {
            std::thread::sleep(std::time::Duration::from_millis(200));
            match child.try_wait() {
                Ok(Some(_)) => {}
                _ => {
                    let _ = child.kill();
                    let _ = child.wait();
                }
            }
        }
        *self.stdin.lock().unwrap() = None;
    }

    pub fn register_sub_listener(&self, sub_id: String) -> std::sync::mpsc::Receiver<Value> {
        let (tx, rx) = std::sync::mpsc::channel();
        self.sub_listeners.lock().unwrap().insert(sub_id, tx);
        rx
    }

    pub fn unregister_sub_listener(&self, sub_id: &str) {
        self.sub_listeners.lock().unwrap().remove(sub_id);
    }

    pub fn register_batch_cancel(&self, task_id: String) -> Arc<std::sync::atomic::AtomicBool> {
        let flag = Arc::new(std::sync::atomic::AtomicBool::new(false));
        self.batch_cancels.lock().unwrap().insert(task_id, flag.clone());
        flag
    }

    pub fn cancel_batch(&self, task_id: &str) -> bool {
        let mut guard = self.batch_cancels.lock().unwrap();
        if let Some(flag) = guard.remove(task_id) {
            flag.store(true, std::sync::atomic::Ordering::SeqCst);
            true
        } else {
            false
        }
    }

    pub fn unregister_batch_cancel(&self, task_id: &str) {
        self.batch_cancels.lock().unwrap().remove(task_id);
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
        cmd.stdin(Stdio::piped())
           .stdout(Stdio::piped())
           .stderr(Stdio::piped());

        #[cfg(target_os = "windows")]
        let mut child = {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);

            let spawned = cmd.spawn().map_err(|e| format!("Failed to spawn bridge: {}", e))?;
            crate::core::utils::attach_process_to_job_object(&spawned);
            spawned
        };

        #[cfg(not(target_os = "windows"))]
        let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn bridge: {}", e))?;

        let stdin = child.stdin.take().ok_or("Failed to open stdin")?;
        let stdout = child.stdout.take().ok_or("Failed to open stdout")?;
        let stderr = child.stderr.take().ok_or("Failed to open stderr")?;

        let app_handle_clone = app_handle.clone();
        let ffmpeg_ranges = self.ffmpeg_ranges.clone();
        let sub_listeners = self.sub_listeners.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                match line {
                    Ok(l) => {
                        println!("[BRIDGE OUT]: {}", l);
                        if let Ok(mut json_val) = serde_json::from_str::<Value>(&l) {
                            if json_val.get("type").and_then(|v| v.as_str()) == Some("progress_ffmpeg") {
                                // Add percent/ETA only when we know the requested trim duration.
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
                                {
                                    let listeners_guard = sub_listeners.lock().unwrap();
                                    if let Some(tx) = listeners_guard.get(id) {
                                        let _ = tx.send(json_val.clone());
                                    }
                                }
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
            if let Ok(mut payload) = serde_json::from_str::<Value>(&json) {
                if payload.get("id").is_some() {
                    payload["type"] = Value::from("bridge_command");
                    payload["direction"] = Value::from("RUST -> BRIDGE");
                    payload["raw"] = Value::from(json.clone());
                    let _ = app_handle.emit("download-event", payload);
                }
            }
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
#[serde(rename_all = "camelCase")]
pub struct DownloadOptions {
    url: String,
    path: String,
    mode: String,
    #[serde(alias = "video_format")]
    video_format: Option<String>,
    #[serde(alias = "video_quality")]
    video_quality: Option<String>,
    #[serde(alias = "audio_format")]
    audio_format: Option<String>,
    #[serde(alias = "audio_quality")]
    audio_quality: Option<String>,
    #[serde(default, alias = "is_time_range_active")]
    is_time_range_active: bool,
    #[serde(default, alias = "start_time")]
    start_time: String,
    #[serde(default, alias = "end_time")]
    end_time: String,
    #[serde(default, alias = "geo_bypass")]
    geo_bypass: bool,
    #[serde(default, alias = "embed_tags")]
    embed_tags: bool,
    #[serde(default, alias = "embed_thumbnail")]
    embed_thumbnail: bool,
    #[serde(default, alias = "mute_audio")]
    mute_audio: bool,
    #[serde(default, alias = "download_subs")]
    download_subs: bool,
    #[serde(default, alias = "download_chat")]
    download_chat: bool,
    #[serde(default, alias = "subs_code")]
    subs_code: String,
    #[serde(default, alias = "embed_subs")]
    embed_subs: bool,
    #[serde(default, alias = "meta_sub_langs")]
    meta_sub_langs: Vec<String>,
    #[serde(default, alias = "meta_auto_langs")]
    meta_auto_langs: Vec<String>,
    #[serde(default, alias = "video_codec")]
    video_codec: Option<String>,
    #[serde(default, alias = "audio_codec")]
    audio_codec: Option<String>,
    #[serde(default, alias = "video_bitrate")]
    video_bitrate: Option<String>,
    #[serde(default, alias = "audio_bitrate")]
    audio_bitrate: Option<String>,
    #[serde(default, alias = "video_fps")]
    video_fps: Option<String>,
    #[serde(default, alias = "audio_sample_rate")]
    audio_sample_rate: Option<String>,
    #[serde(default, alias = "custom_args")]
    custom_args: Option<Vec<String>>,
    #[serde(default, alias = "client_task_id")]
    client_task_id: Option<String>,
}

fn push_unique(target: &mut Vec<String>, value: String) {
    if !target.iter().any(|existing| existing == &value) {
        target.push(value);
    }
}

fn ensure_flag(args: &mut Vec<String>, flag: &str) {
    if !args.iter().any(|existing| existing == flag) {
        args.push(flag.to_string());
    }
}

fn find_lang_match<'a>(langs: &'a [String], requested: &str) -> Option<&'a str> {
    let requested_lower = requested.to_lowercase();
    langs.iter().find_map(|lang| {
        let trimmed = lang.trim();
        if trimmed.to_lowercase().starts_with(&requested_lower) {
            Some(trimmed)
        } else {
            None
        }
    })
}

fn parse_kbps_value(value: &Option<String>) -> Option<String> {
    let raw = value.as_ref()?.trim();
    if raw.is_empty() {
        return None;
    }
    let digits: String = raw.chars().filter(|ch| ch.is_ascii_digit()).collect();
    if digits.is_empty() {
        return None;
    }
    Some(digits)
}

fn parse_numeric_value(value: &Option<String>) -> Option<String> {
    let raw = value.as_ref()?.trim();
    if raw.is_empty() {
        return None;
    }
    let mut out = String::new();
    for ch in raw.chars() {
        if ch.is_ascii_digit() || ch == '.' {
            out.push(ch);
        }
    }
    if out.is_empty() {
        None
    } else {
        Some(out)
    }
}

fn quote_filter_value(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    if trimmed.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '.' || c == '-') {
        return trimmed.to_string();
    }
    let escaped = trimmed.replace('\'', "\\'");
    format!("'{}'", escaped)
}

fn build_video_filters(options: &DownloadOptions) -> Vec<String> {
    let mut filters = Vec::new();
    if let Some(codec) = options.video_codec.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
        filters.push(format!("vcodec={}", quote_filter_value(codec)));
    }
    if let Some(vbr) = parse_kbps_value(&options.video_bitrate) {
        filters.push(format!("vbr={}", vbr));
    }
    if let Some(fps) = parse_numeric_value(&options.video_fps) {
        filters.push(format!("fps={}", fps));
    }
    filters
}

fn build_audio_filters(options: &DownloadOptions) -> Vec<String> {
    let mut filters = Vec::new();
    if let Some(codec) = options.audio_codec.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
        filters.push(format!("acodec={}", quote_filter_value(codec)));
    }
    if let Some(abr) = parse_kbps_value(&options.audio_bitrate) {
        filters.push(format!("abr={}", abr));
    }
    if let Some(asr) = parse_numeric_value(&options.audio_sample_rate) {
        filters.push(format!("asr={}", asr));
    }
    filters
}

fn apply_filters(base: &str, filters: &[String]) -> String {
    let mut out = base.to_string();
    for filter in filters {
        if filter.trim().is_empty() {
            continue;
        }
        out.push('[');
        out.push_str(filter);
        out.push(']');
    }
    out
}

fn build_subtitle_args(options: &DownloadOptions) -> Vec<String> {
    let mut args: Vec<String> = Vec::new();
    let mut target_langs: Vec<String> = Vec::new();

    if options.download_chat {
        ensure_flag(&mut args, "--write-subs");
        push_unique(&mut target_langs, "live_chat".to_string());
    }

    if options.download_subs {
        let code_input = options.subs_code.trim();
        if !code_input.is_empty() {
            for raw in code_input.split(',') {
                let lang_req = raw.trim();
                if lang_req.is_empty() {
                    continue;
                }

                if let Some(found) = find_lang_match(&options.meta_sub_langs, lang_req) {
                    push_unique(&mut target_langs, found.to_string());
                    ensure_flag(&mut args, "--write-subs");
                    continue;
                }
                if let Some(found) = find_lang_match(&options.meta_auto_langs, lang_req) {
                    push_unique(&mut target_langs, found.to_string());
                    ensure_flag(&mut args, "--write-auto-subs");
                    continue;
                }

                // Unknown language code: request both manual and auto subtitles.
                push_unique(&mut target_langs, lang_req.to_string());
                ensure_flag(&mut args, "--write-subs");
                ensure_flag(&mut args, "--write-auto-subs");
            }
        } else {
            ensure_flag(&mut args, "--write-subs");
            if !options.meta_auto_langs.is_empty() {
                ensure_flag(&mut args, "--write-auto-subs");
            }
        }
    }

    if !target_langs.is_empty() {
        args.push("--sub-langs".to_string());
        args.push(target_langs.join(","));
    }

    if options.embed_subs && (options.download_subs || options.download_chat) {
        ensure_flag(&mut args, "--embed-subs");
    }

    args
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
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return Err("Thumbnail URL cannot be empty".to_string());
    }

    println!("Fetching thumbnail from: {}", trimmed);

    let response = reqwest::get(trimmed).await.map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("Failed to fetch thumbnail: HTTP {}", response.status()));
    }

    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    let bytes = response.bytes().await.map_err(|e| e.to_string())?;

    let ext = guess_thumbnail_extension(&content_type, trimmed).unwrap_or_else(|| "jpg".to_string());
    let file_name = format!("thumbnail.{}", ext);

    let file_path = app_handle.dialog().file()
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
            return Some(if ext_lower == "jpeg" { "jpg".to_string() } else { ext_lower });
        }
    }
    None
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
    let mut effective_options = options;
    let (eff_vcodec, eff_acodec) = crate::system::formats::resolve_effective_codecs(
        if effective_options.mode == "audio" { effective_options.audio_format.as_deref() } else { effective_options.video_format.as_deref() },
        effective_options.video_codec.as_deref(),
        effective_options.audio_codec.as_deref(),
        Some(&config.default_video_codec),
        Some(&config.default_audio_codec),
    );
    if effective_options.video_codec.is_none() || effective_options.video_codec.as_deref() == Some("") || effective_options.video_codec.as_deref() == Some("auto") {
        effective_options.video_codec = eff_vcodec;
    }
    if effective_options.audio_codec.is_none() || effective_options.audio_codec.as_deref() == Some("") || effective_options.audio_codec.as_deref() == Some("auto") {
        effective_options.audio_codec = eff_acodec;
    }

    let options = effective_options;
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

    args.push("--concurrent-fragments".to_string());
    args.push("3".to_string());

    if config.cookies_browser.to_lowercase() != "none" && !config.cookies_browser.trim().is_empty() {
        args.push("--cookies-from-browser".to_string());
        args.push(config.cookies_browser.to_lowercase());
    }

    if options.mode == "audio" {
        let audio_filters = build_audio_filters(&options);
        let has_audio_filters = !audio_filters.is_empty();
        let selected_audio_format = options.audio_format.as_ref().map(|f| f.to_lowercase());
        let uses_audio_format = matches!(
            selected_audio_format.as_deref(),
            Some("aac" | "alac" | "flac" | "m4a" | "mp3" | "opus" | "vorbis" | "wav")
        );

        let mut audio_selector: Option<String> = None;
        if uses_audio_format {
            args.push("-x".to_string());
            if let Some(fmt_lower) = selected_audio_format {
                args.push("--audio-format".to_string());
                args.push(fmt_lower);
            }
            if let Some(ref quality) = options.audio_quality {
                let q_arg = quality.replace("kbps", "K");
                args.push("--audio-quality".to_string());
                args.push(q_arg);
            }
            if has_audio_filters {
                audio_selector = Some(apply_filters("ba", &audio_filters));
            }
        } else if let Some(fmt_lower) = selected_audio_format {
            let base = apply_filters(&format!("ba[ext={}]", fmt_lower), &audio_filters);
            let fallback = apply_filters("ba", &audio_filters);
            audio_selector = Some(format!("{}/{}", base, fallback));
            if matches!(fmt_lower.as_str(), "aiff" | "ogg") {
                args.push("--remux-video".to_string());
                args.push(fmt_lower);
            }
        }
        if let Some(selector) = audio_selector {
            args.push("-f".to_string());
            args.push(selector);
        }
    } else {
        let video_filters = build_video_filters(&options);
        let audio_filters = build_audio_filters(&options);
        let has_filters = !video_filters.is_empty() || !audio_filters.is_empty();
        let mut format_selector: Option<String> = None;
        let mut remux_format: Option<String> = None;
        let mut merge_output: Option<String> = None;

        if let Some(ref fmt) = options.video_format {
            let fmt_lower = fmt.to_lowercase();
            match fmt_lower.as_str() {
                "gif" => {
                    args.push("--recode-video".to_string());
                    args.push("gif".to_string());
                    if has_filters || options.mute_audio {
                        format_selector = Some(apply_filters("bv", &video_filters));
                    }
                }
                "mp4" | "mkv" | "webm" | "mov" | "flv" | "avi" => {
                    merge_output = Some(fmt_lower);
                    if options.mute_audio {
                        format_selector = Some(apply_filters("bv", &video_filters));
                    } else if has_filters {
                        let video_sel = apply_filters("bv*", &video_filters);
                        let audio_sel = apply_filters("ba", &audio_filters);
                        format_selector = Some(format!(
                            "{}+{}/{}/{}+{}/b",
                            video_sel, audio_sel, video_sel, video_sel, audio_sel
                        ));
                    }
                }
                _ => {
                    let video_ext = apply_filters(&format!("bv*[ext={}]", fmt_lower), &video_filters);
                    let audio_ext = apply_filters(&format!("ba[ext={}]", fmt_lower), &audio_filters);
                    let video_fallback = apply_filters("bv*", &video_filters);
                    let audio_fallback = apply_filters("ba", &audio_filters);
                    if options.mute_audio {
                        format_selector = Some(format!("{}/bv", video_ext));
                    } else {
                        format_selector = Some(format!(
                            "{}+{}/{}/{}+{}/b",
                            video_ext, audio_ext, video_ext, video_fallback, audio_fallback
                        ));
                    }
                    remux_format = Some(fmt_lower);
                }
            }
        } else if options.mute_audio {
            format_selector = Some(apply_filters("bv", &video_filters));
        } else if has_filters {
            let video_sel = apply_filters("bv*", &video_filters);
            let audio_sel = apply_filters("ba", &audio_filters);
            format_selector = Some(format!(
                "{}+{}/{}/{}+{}/b",
                video_sel, audio_sel, video_sel, video_sel, audio_sel
            ));
        }

        if let Some(selector) = format_selector {
            args.push("-f".to_string());
            args.push(selector);
        }
        if let Some(merge) = merge_output {
            args.push("--merge-output-format".to_string());
            args.push(merge);
        }
        if let Some(remux) = remux_format {
            args.push("--remux-video".to_string());
            args.push(remux);
        }
        if let Some(ref quality) = options.video_quality {
            let res = quality.replace("p", "");
            args.push("-S".to_string());
            args.push(format!("res:{}", res));
        }
    }

    if options.is_time_range_active {
        if let (Some(start), Some(end)) = (parse_time_to_seconds(&options.start_time), parse_time_to_seconds(&options.end_time)) {
            let total = (end - start).max(0.0);
            if total > 0.0 {
                // Store expected ffmpeg range so progress events can expose ETA.
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

    if !config.title_template.trim().is_empty() {
        let mut output_template = config.title_template.trim().to_string();
        if !output_template.contains(".%(ext)s") {
            output_template.push_str(".%(ext)s");
        }
        args.push("-o".to_string());
        args.push(output_template);
    }

    let subtitle_args = build_subtitle_args(&options);
    args.extend(subtitle_args);

    if let Some(custom_args) = options.custom_args {
        for arg in custom_args {
            let trimmed = arg.trim();
            if !trimmed.is_empty() {
                args.push(trimmed.to_string());
            }
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
    state.cancel_batch(&trimmed);

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

use crate::core::utils::{get_requirements_path, generate_task_id};

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

pub fn is_terminal_event(payload: &Value) -> bool {
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