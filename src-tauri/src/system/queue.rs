use directories::BaseDirs;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueItemState {
    pub id: String,
    #[serde(default = "default_item_type")]
    pub item_type: String,
    pub title: String,
    pub thumbnail: String,
    pub status: String,
    pub progress: f64,
    pub eta: String,
    pub added_at: u64,
    pub payload: Value,
    pub path: String,
    pub task_id: Option<String>,
    pub skipped_by_stop: bool,
    pub start_reason: Option<String>,
    pub pending_start_reason: Option<String>,
    pub source: String,
}

fn default_item_type() -> String {
    "download".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueState {
    pub items: Vec<QueueItemState>,
    pub current_item_id: Option<String>,
    #[serde(default)]
    pub active_item_ids: Vec<String>,
    pub priority_queue: Vec<String>,
    pub start_all_active: bool,
    pub start_all_success: bool,
    pub start_all_started: u64,
    pub clear_after_current: bool,
    pub current_page: usize,
}

impl Default for QueueState {
    fn default() -> Self {
        Self {
            items: Vec::new(),
            current_item_id: None,
            active_item_ids: Vec::new(),
            priority_queue: Vec::new(),
            start_all_active: false,
            start_all_success: true,
            start_all_started: 0,
            clear_after_current: false,
            current_page: 1,
        }
    }
}

pub struct QueueManager {
    queue_path: PathBuf,
    write_guard: Mutex<()>,
}

impl QueueManager {
    pub fn new() -> Self {
        let queue_path = Self::get_queue_path();
        if let Some(parent) = queue_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if !queue_path.exists() {
            let _ = fs::write(
                &queue_path,
                serde_json::to_string_pretty(&QueueState::default()).unwrap_or_else(|_| "{}".to_string()),
            );
        }

        Self {
            queue_path,
            write_guard: Mutex::new(()),
        }
    }

    fn get_queue_path() -> PathBuf {
        if let Some(base_dirs) = BaseDirs::new() {
            return base_dirs.data_local_dir().join("Pulsar").join("queue.json");
        }
        PathBuf::from("queue.json")
    }

    pub fn load(&self) -> QueueState {
        if !self.queue_path.exists() {
            return QueueState::default();
        }

        match fs::read_to_string(&self.queue_path) {
            Ok(raw) => serde_json::from_str::<QueueState>(&raw).unwrap_or_default(),
            Err(_) => QueueState::default(),
        }
    }

    pub fn save(&self, queue_state: &QueueState) -> Result<(), String> {
        // Serialize writes to avoid partial/competing queue file updates.
        let _guard = self.write_guard.lock().unwrap();
        let serialized = serde_json::to_string_pretty(queue_state).map_err(|e| e.to_string())?;
        fs::write(&self.queue_path, serialized).map_err(|e| e.to_string())
    }
}