use crate::app::config::ConfigManager;
use crate::infrastructure::platform::get_requirements_path;
use serde::Serialize;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Arc, Condvar, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

pub const BRIDGE_PROTOCOL_VERSION: u64 = 1;

fn runtime_logs_enabled(app_handle: &AppHandle) -> bool {
    app_handle
        .state::<ConfigManager>()
        .config
        .lock()
        .map(|config| config.runtime_logs)
        .unwrap_or(false)
}

#[derive(Serialize)]
pub struct BridgeCommand {
    pub command: String,
    pub id: String,
    pub args: Vec<String>,
}

pub struct BridgeState {
    process: Mutex<Option<Child>>,
    stdin: Mutex<Option<ChildStdin>>,
    ffmpeg_ranges: Arc<Mutex<HashMap<String, FfmpegRange>>>,
    sub_listeners: Arc<Mutex<HashMap<String, std::sync::mpsc::Sender<Value>>>>,
    batch_cancels: Arc<Mutex<HashMap<String, Arc<std::sync::atomic::AtomicBool>>>>,
    output_paths: Arc<Mutex<HashMap<String, PathBuf>>>,
    process_limiter: Arc<ProcessLimiter>,
}

struct ProcessLimiter {
    state: Mutex<ProcessLimitState>,
    changed_sync: Condvar,
    changed_async: tokio::sync::Notify,
}

struct ProcessLimitState {
    limit: usize,
    active: HashSet<String>,
    waiting: HashSet<String>,
    cancelled_pending: HashSet<String>,
}

struct WaitingGuard<'a> {
    limiter: &'a ProcessLimiter,
    id: String,
}

impl Drop for WaitingGuard<'_> {
    fn drop(&mut self) {
        if let Ok(mut state) = self.limiter.state.lock() {
            state.waiting.remove(&self.id);
            state.cancelled_pending.remove(&self.id);
        }
    }
}

impl ProcessLimiter {
    fn new(limit: usize) -> Self {
        Self {
            state: Mutex::new(ProcessLimitState {
                limit: limit.max(1),
                active: HashSet::new(),
                waiting: HashSet::new(),
                cancelled_pending: HashSet::new(),
            }),
            changed_sync: Condvar::new(),
            changed_async: tokio::sync::Notify::new(),
        }
    }

    fn notify_all(&self) {
        self.changed_sync.notify_all();
        self.changed_async.notify_waiters();
    }

    fn register_waiting(&self, id: &str) -> Result<WaitingGuard<'_>, String> {
        let mut state = self
            .state
            .lock()
            .map_err(|_| "Process limit lock is unavailable".to_string())?;
        state.waiting.insert(id.to_string());
        Ok(WaitingGuard {
            limiter: self,
            id: id.to_string(),
        })
    }

    fn set_limit(&self, limit: usize) {
        if let Ok(mut state) = self.state.lock() {
            state.limit = limit.max(1);
        }
        self.notify_all();
    }

    fn cancel_pending(&self, id: &str) {
        let mut should_notify = false;
        if let Ok(mut state) = self.state.lock() {
            if state.waiting.contains(id) {
                state.cancelled_pending.insert(id.to_string());
                should_notify = true;
            }
        }
        if should_notify {
            self.notify_all();
        }
    }

    fn acquire<F>(&self, id: &str, mut is_cancelled: F) -> Result<(), String>
    where
        F: FnMut() -> bool,
    {
        let _waiting_guard = self.register_waiting(id)?;
        let mut state = self
            .state
            .lock()
            .map_err(|_| "Process limit lock is unavailable".to_string())?;
        loop {
            if state.cancelled_pending.remove(id) || is_cancelled() {
                return Err("Batch was cancelled before its process could start.".to_string());
            }
            if state.active.contains(id) {
                return Err(format!("Process ID '{id}' is already active."));
            }
            if state.active.len() < state.limit {
                state.active.insert(id.to_string());
                return Ok(());
            }
            let (next_state, _) = self
                .changed_sync
                .wait_timeout(state, Duration::from_millis(100))
                .map_err(|_| "Process limit lock is unavailable".to_string())?;
            state = next_state;
        }
    }

    async fn acquire_async<F>(&self, id: &str, mut is_cancelled: F) -> Result<(), String>
    where
        F: FnMut() -> bool,
    {
        let _waiting_guard = self.register_waiting(id)?;
        loop {
            let notified = self.changed_async.notified();
            tokio::pin!(notified);
            notified.as_mut().enable();
            {
                let mut state = self
                    .state
                    .lock()
                    .map_err(|_| "Process limit lock is unavailable".to_string())?;
                if state.cancelled_pending.remove(id) || is_cancelled() {
                    return Err("Task was cancelled before its process could start.".to_string());
                }
                if state.active.contains(id) {
                    return Err(format!("Process ID '{id}' is already active."));
                }
                if state.active.len() < state.limit {
                    state.active.insert(id.to_string());
                    return Ok(());
                }
            }
            let _ = tokio::time::timeout(Duration::from_millis(100), notified).await;
        }
    }

    fn release(&self, id: &str) {
        let removed = self
            .state
            .lock()
            .map(|mut state| state.active.remove(id))
            .unwrap_or(false);
        if removed {
            self.notify_all();
        }
    }

    fn take_all(&self) -> Vec<String> {
        let active = self
            .state
            .lock()
            .map(|mut state| state.active.drain().collect::<Vec<String>>())
            .unwrap_or_default();
        self.notify_all();
        active
    }

    fn active_count(&self) -> usize {
        self.state
            .lock()
            .map(|state| state.active.len())
            .unwrap_or(0)
    }
}

impl BridgeState {
    pub fn new() -> Self {
        Self {
            process: Mutex::new(None),
            stdin: Mutex::new(None),
            ffmpeg_ranges: Arc::new(Mutex::new(HashMap::new())),
            sub_listeners: Arc::new(Mutex::new(HashMap::new())),
            batch_cancels: Arc::new(Mutex::new(HashMap::new())),
            output_paths: Arc::new(Mutex::new(HashMap::new())),
            process_limiter: Arc::new(ProcessLimiter::new(3)),
        }
    }

    pub fn set_process_limit(&self, limit: usize) {
        self.process_limiter.set_limit(limit);
    }

    pub fn has_active_work(&self) -> bool {
        let active_batch = self
            .batch_cancels
            .lock()
            .map(|batches| !batches.is_empty())
            .unwrap_or(true);
        active_batch || self.process_limiter.active_count() > 0
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
        self.batch_cancels
            .lock()
            .unwrap()
            .insert(task_id, flag.clone());
        flag
    }

    pub fn cancel_batch(&self, task_id: &str) -> bool {
        let cancelled = {
            let guard = self.batch_cancels.lock().unwrap();
            if let Some(flag) = guard.get(task_id) {
                flag.store(true, std::sync::atomic::Ordering::SeqCst);
                true
            } else {
                false
            }
        };
        if cancelled {
            self.process_limiter.notify_all();
        }
        cancelled
    }

    pub fn cancel_pending_task(&self, task_id: &str) {
        self.process_limiter.cancel_pending(task_id);
    }

    pub fn unregister_batch_cancel(&self, task_id: &str) {
        self.batch_cancels.lock().unwrap().remove(task_id);
    }

    pub fn register_output_path(&self, task_id: String, path: PathBuf) {
        self.output_paths.lock().unwrap().insert(task_id, path);
    }

    pub fn unregister_output_path(&self, task_id: &str) {
        self.output_paths.lock().unwrap().remove(task_id);
    }

    pub fn init(&self, app_handle: &AppHandle) -> Result<(), String> {
        let mut process_guard = self.process.lock().unwrap();

        let existing_status = process_guard.as_mut().map(Child::try_wait);
        match existing_status {
            None | Some(Ok(None)) => {
                if process_guard.is_some() {
                    return Ok(());
                }
            }
            Some(Ok(Some(status))) => {
                if runtime_logs_enabled(app_handle) {
                    eprintln!("Pulsar bridge exited with status {status}; restarting it.");
                }
                process_guard.take();
                *self.stdin.lock().unwrap() = None;
            }
            Some(Err(error)) => {
                if runtime_logs_enabled(app_handle) {
                    eprintln!("Could not check Pulsar bridge status: {error}; restarting it.");
                }
                if let Some(child) = process_guard.as_mut() {
                    let _ = child.kill();
                }
                process_guard.take();
                *self.stdin.lock().unwrap() = None;
            }
        }

        let req_path = get_requirements_path();
        let bridge_name = if cfg!(target_os = "windows") {
            "pulsar-bridge.exe"
        } else {
            "pulsar-bridge"
        };
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

            let spawned = cmd
                .spawn()
                .map_err(|e| format!("Failed to spawn bridge: {}", e))?;
            crate::infrastructure::platform::attach_process_to_job_object(&spawned);
            spawned
        };

        #[cfg(not(target_os = "windows"))]
        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn bridge: {}", e))?;

        let stdin = child.stdin.take().ok_or("Failed to open stdin")?;
        let stdout = child.stdout.take().ok_or("Failed to open stdout")?;
        let stderr = child.stderr.take().ok_or("Failed to open stderr")?;

        let app_handle_clone = app_handle.clone();
        let ffmpeg_ranges = self.ffmpeg_ranges.clone();
        let sub_listeners = self.sub_listeners.clone();
        let output_paths = self.output_paths.clone();
        let process_limiter = self.process_limiter.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                match line {
                    Ok(l) => {
                        if runtime_logs_enabled(&app_handle_clone) {
                            println!("[BRIDGE OUT]: {}", l);
                        }
                        if let Ok(mut json_val) = serde_json::from_str::<Value>(&l) {
                            if json_val.get("type").and_then(Value::as_str) == Some("ready") {
                                let remote_version =
                                    json_val.get("protocol_version").and_then(Value::as_u64);
                                if remote_version != Some(BRIDGE_PROTOCOL_VERSION) {
                                    let component = if remote_version
                                        .is_some_and(|v| v > BRIDGE_PROTOCOL_VERSION)
                                    {
                                        "pulsar"
                                    } else {
                                        "bridge"
                                    };
                                    let _ = app_handle_clone.emit(
                                        "bridge-protocol-mismatch",
                                        serde_json::json!({"component": component}),
                                    );
                                }
                                continue;
                            }
                            if json_val.get("type").and_then(Value::as_str)
                                == Some("protocol_mismatch")
                            {
                                continue;
                            }
                            if json_val.get("type").and_then(|v| v.as_str())
                                == Some("progress_ffmpeg")
                            {
                                if let Some(id) = json_val.get("id").and_then(|v| v.as_str()) {
                                    if let Some(total) = ffmpeg_ranges
                                        .lock()
                                        .unwrap()
                                        .get(id)
                                        .map(|r| r.total_seconds)
                                    {
                                        if let Some(elapsed) =
                                            extract_ffmpeg_elapsed_seconds(&json_val)
                                        {
                                            if total > 0.0 {
                                                let percent =
                                                    (elapsed / total * 100.0).clamp(0.0, 100.0);
                                                let remaining = (total - elapsed).max(0.0);
                                                let eta_seconds =
                                                    match parse_ffmpeg_speed(json_val.get("speed"))
                                                    {
                                                        Some(speed) if speed > 0.0 => {
                                                            remaining / speed
                                                        }
                                                        _ => remaining,
                                                    };
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
                                    process_limiter.release(id);
                                    if let Some(path) = output_paths.lock().unwrap().remove(id) {
                                        let event_type =
                                            json_val.get("type").and_then(Value::as_str);
                                        let failed = event_type == Some("finished")
                                            && !terminal_event_succeeded(&json_val);
                                        let empty_cancelled_reservation = event_type
                                            == Some("cancelled")
                                            && std::fs::metadata(&path)
                                                .map(|metadata| metadata.len() == 0)
                                                .unwrap_or(false);
                                        if failed || empty_cancelled_reservation {
                                            let _ = std::fs::remove_file(path);
                                        }
                                    }
                                }
                            }
                            let _ = app_handle_clone.emit("download-event", json_val);
                        }
                    }
                    Err(e) => {
                        if runtime_logs_enabled(&app_handle_clone) {
                            eprintln!("Error reading bridge stdout: {}", e);
                        }
                    }
                }
            }
            for id in process_limiter.take_all() {
                if let Some(path) = output_paths.lock().unwrap().remove(&id) {
                    let _ = std::fs::remove_file(path);
                }
                let failure = serde_json::json!({
                    "type": "finished",
                    "id": id,
                    "success": false,
                    "error": "Pulsar bridge process exited before the task completed."
                });
                if let Some(task_id) = failure.get("id").and_then(Value::as_str) {
                    if let Some(tx) = sub_listeners.lock().unwrap().get(task_id) {
                        let _ = tx.send(failure.clone());
                    }
                }
                let _ = app_handle_clone.emit("download-event", failure);
            }
        });

        let stderr_app_handle = app_handle.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(l) = line {
                    if runtime_logs_enabled(&stderr_app_handle) {
                        eprintln!("[BRIDGE ERR]: {}", l);
                    }
                }
            }
        });

        *self.stdin.lock().unwrap() = Some(stdin);
        *process_guard = Some(child);

        if runtime_logs_enabled(app_handle) {
            println!("Bridge process started successfully.");
        }
        Ok(())
    }

    pub fn send_command(&self, app_handle: &AppHandle, cmd: BridgeCommand) -> Result<(), String> {
        self.send_raw_command(app_handle, &cmd)
    }

    pub async fn send_command_async(
        &self,
        app_handle: &AppHandle,
        cmd: BridgeCommand,
    ) -> Result<(), String> {
        self.send_raw_command_async(app_handle, &cmd).await
    }

    fn write_json_to_bridge(&self, app_handle: &AppHandle, json: &str) -> Result<(), String> {
        self.init(app_handle)?;
        let mut stdin_guard = self.stdin.lock().unwrap();
        if let Some(stdin) = stdin_guard.as_mut() {
            writeln!(stdin, "{}", json).map_err(|e| format!("Failed to write to bridge: {}", e))?;
            if let Ok(mut payload) = serde_json::from_str::<Value>(json) {
                if payload.get("id").is_some() {
                    payload["type"] = Value::from("bridge_command");
                    payload["direction"] = Value::from("RUST -> BRIDGE");
                    payload["raw"] = Value::from(json.to_string());
                    let _ = app_handle.emit("download-event", payload);
                }
            }
            if runtime_logs_enabled(app_handle) {
                println!("[RUST -> BRIDGE]: {}", json);
            }
            Ok(())
        } else {
            Err("Bridge stdin not available".to_string())
        }
    }

    pub fn send_raw_command<T: Serialize>(
        &self,
        app_handle: &AppHandle,
        cmd: &T,
    ) -> Result<(), String> {
        let json = serde_json::to_string(cmd).map_err(|e| e.to_string())?;
        let process_id = extract_limited_process_id(&json);
        if let Some(id) = process_id.as_deref() {
            self.process_limiter
                .acquire(id, || self.is_batch_cancelled_for_task(id))?;
        }

        let result = self.write_json_to_bridge(app_handle, &json);
        if result.is_err() {
            if let Some(id) = process_id.as_deref() {
                self.process_limiter.release(id);
            }
        }
        result
    }

    pub async fn send_raw_command_async<T: Serialize>(
        &self,
        app_handle: &AppHandle,
        cmd: &T,
    ) -> Result<(), String> {
        let json = serde_json::to_string(cmd).map_err(|e| e.to_string())?;
        let process_id = extract_limited_process_id(&json);
        if let Some(id) = process_id.as_deref() {
            self.process_limiter
                .acquire_async(id, || self.is_batch_cancelled_for_task(id))
                .await?;
        }

        let app_clone = app_handle.clone();
        let json_clone = json.clone();
        let write_result = tokio::task::spawn_blocking(move || {
            let bridge_state = app_clone.state::<BridgeState>();
            bridge_state.write_json_to_bridge(&app_clone, &json_clone)
        })
        .await
        .map_err(|error| format!("Bridge write task failed: {error}"))?;

        if write_result.is_err() {
            if let Some(id) = process_id.as_deref() {
                self.process_limiter.release(id);
            }
        }
        write_result
    }

    fn is_batch_cancelled_for_task(&self, task_id: &str) -> bool {
        let Some((batch_id, _)) = task_id.rsplit_once("_sub_") else {
            return false;
        };
        self.batch_cancels
            .lock()
            .ok()
            .and_then(|guard| guard.get(batch_id).cloned())
            .is_some_and(|flag| flag.load(std::sync::atomic::Ordering::SeqCst))
    }

    pub fn set_ffmpeg_range(&self, task_id: String, total_seconds: f64) {
        if total_seconds <= 0.0 {
            return;
        }
        self.ffmpeg_ranges
            .lock()
            .unwrap()
            .insert(task_id, FfmpegRange { total_seconds });
    }

    pub fn clear_ffmpeg_range(&self, task_id: &str) {
        self.ffmpeg_ranges.lock().unwrap().remove(task_id);
    }
}

fn extract_limited_process_id(json: &str) -> Option<String> {
    serde_json::from_str::<Value>(json).ok().and_then(|value| {
        let command = value.get("command")?.as_str()?;
        matches!(
            command,
            "download" | "download_ffmpeg" | "convert" | "compress"
        )
        .then(|| value.get("id")?.as_str().map(str::to_owned))?
    })
}

struct FfmpegRange {
    total_seconds: f64,
}

pub(crate) fn parse_time_to_seconds(input: &str) -> Option<f64> {
    let trimmed = input.trim();
    if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("N/A") {
        return None;
    }
    let parts: Vec<&str> = trimmed.split(':').collect();
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

fn parse_microseconds_value(value: &Value) -> Option<f64> {
    let parsed = if let Some(n) = value.as_f64() {
        Some(n)
    } else if let Some(s) = value.as_str() {
        let trimmed = s.trim();
        if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("N/A") {
            None
        } else {
            trimmed.parse::<f64>().ok()
        }
    } else {
        None
    }?;
    (parsed >= 0.0).then_some(parsed / 1_000_000.0)
}

fn parse_ffmpeg_speed(value: Option<&Value>) -> Option<f64> {
    let value = value?;
    if let Some(n) = value.as_f64() {
        return (n > 0.0).then_some(n);
    }
    let raw = value.as_str()?.trim().trim_end_matches(['x', 'X']).trim();
    if raw.is_empty() || raw.eq_ignore_ascii_case("N/A") {
        return None;
    }
    raw.parse::<f64>().ok().filter(|n| *n > 0.0)
}

fn extract_ffmpeg_elapsed_seconds(payload: &Value) -> Option<f64> {
    if let Some(t) = payload.get("time").and_then(|v| v.as_str()) {
        if let Some(secs) = parse_time_to_seconds(t).filter(|s| *s >= 0.0) {
            return Some(secs);
        }
    }
    if let Some(t) = payload.get("out_time").and_then(|v| v.as_str()) {
        if let Some(secs) = parse_time_to_seconds(t).filter(|s| *s >= 0.0) {
            return Some(secs);
        }
    }
    if let Some(v) = payload.get("out_time_us") {
        if let Some(secs) = parse_microseconds_value(v) {
            return Some(secs);
        }
    }
    if let Some(v) = payload.get("out_time_ms") {
        // FFmpeg emits `out_time_ms` in microseconds despite the field name.
        if let Some(secs) = parse_microseconds_value(v) {
            return Some(secs);
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

pub fn terminal_event_succeeded(payload: &Value) -> bool {
    is_terminal_event(payload) && payload.get("success").and_then(Value::as_bool) == Some(true)
}

#[cfg(test)]
mod tests {
    use super::{
        extract_ffmpeg_elapsed_seconds, parse_ffmpeg_speed, terminal_event_succeeded,
        ProcessLimiter,
    };
    use serde_json::json;
    use std::sync::Arc;
    use std::time::Duration;

    #[test]
    fn terminal_event_outcome_requires_success_true() {
        assert!(terminal_event_succeeded(
            &json!({ "type": "finished", "success": true })
        ));
        assert!(!terminal_event_succeeded(
            &json!({ "type": "finished", "success": false })
        ));
        assert!(!terminal_event_succeeded(&json!({ "type": "progress" })));
    }

    #[test]
    fn extract_ffmpeg_elapsed_treats_out_time_ms_as_microseconds() {
        let elapsed = extract_ffmpeg_elapsed_seconds(&json!({ "out_time_ms": "15000000" }));
        assert_eq!(elapsed, Some(15.0));

        let elapsed_num = extract_ffmpeg_elapsed_seconds(&json!({ "out_time_ms": 2_500_000 }));
        assert_eq!(elapsed_num, Some(2.5));
    }

    #[test]
    fn extract_ffmpeg_elapsed_skips_na_and_negative_values() {
        let elapsed = extract_ffmpeg_elapsed_seconds(&json!({
            "time": "N/A",
            "out_time": "-577014:32:22.775808",
            "out_time_us": "N/A",
            "out_time_ms": "12000000"
        }));
        assert_eq!(elapsed, Some(12.0));
    }

    #[test]
    fn parse_ffmpeg_speed_handles_valid_and_invalid_values() {
        assert_eq!(parse_ffmpeg_speed(Some(&json!("2.5x"))), Some(2.5));
        assert_eq!(parse_ffmpeg_speed(Some(&json!("0x"))), None);
        assert_eq!(parse_ffmpeg_speed(Some(&json!("N/A"))), None);
    }

    #[tokio::test]
    async fn process_limiter_async_wakes_on_release_and_cancel() {
        let limiter = Arc::new(ProcessLimiter::new(1));
        limiter.acquire("slot-1", || false).unwrap();

        let limiter_release = limiter.clone();
        let waiter =
            tokio::spawn(async move { limiter_release.acquire_async("slot-2", || false).await });
        tokio::time::sleep(Duration::from_millis(20)).await;
        limiter.release("slot-1");
        waiter.await.unwrap().unwrap();
        assert_eq!(limiter.active_count(), 1);

        let limiter_cancel = limiter.clone();
        let cancelled_waiter =
            tokio::spawn(async move { limiter_cancel.acquire_async("slot-3", || false).await });
        tokio::time::sleep(Duration::from_millis(20)).await;
        limiter.cancel_pending("slot-3");
        let cancel_result = tokio::time::timeout(Duration::from_secs(1), cancelled_waiter)
            .await
            .expect("cancel_pending should wake acquire_async immediately")
            .unwrap();
        assert!(cancel_result.is_err());
        limiter.release("slot-2");
    }
}
