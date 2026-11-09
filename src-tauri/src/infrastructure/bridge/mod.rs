use crate::infrastructure::platform::get_requirements_path;
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};

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
        self.batch_cancels
            .lock()
            .unwrap()
            .insert(task_id, flag.clone());
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
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                match line {
                    Ok(l) => {
                        println!("[BRIDGE OUT]: {}", l);
                        if let Ok(mut json_val) = serde_json::from_str::<Value>(&l) {
                            if json_val.get("type").and_then(|v| v.as_str())
                                == Some("progress_ffmpeg")
                            {
                                // Add percent/ETA only when we know the requested trim duration.
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

    pub fn send_raw_command<T: Serialize>(
        &self,
        app_handle: &AppHandle,
        cmd: &T,
    ) -> Result<(), String> {
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
        self.ffmpeg_ranges
            .lock()
            .unwrap()
            .insert(task_id, FfmpegRange { total_seconds });
    }

    pub fn clear_ffmpeg_range(&self, task_id: &str) {
        self.ffmpeg_ranges.lock().unwrap().remove(task_id);
    }
}

struct FfmpegRange {
    total_seconds: f64,
}

pub(crate) fn parse_time_to_seconds(input: &str) -> Option<f64> {
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

pub fn terminal_event_succeeded(payload: &Value) -> bool {
    is_terminal_event(payload) && payload.get("success").and_then(Value::as_bool) == Some(true)
}

#[cfg(test)]
mod tests {
    use super::terminal_event_succeeded;
    use serde_json::json;

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
}
