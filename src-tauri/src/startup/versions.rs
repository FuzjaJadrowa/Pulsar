use serde::{Deserialize, Serialize};
use std::fs::File;
use std::path::Path;

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(default)]
pub(super) struct Versions {
    pub(super) app_last_check: u64,
    pub(super) req_last_check: u64,
    pub(super) bridge_last_check: u64,
    pub(super) ffmpeg_last_check: u64,
    #[serde(flatten)]
    pub(super) local_versions: std::collections::HashMap<String, String>,
}

impl Default for Versions {
    fn default() -> Self {
        Self {
            app_last_check: 0,
            req_last_check: 0,
            bridge_last_check: 0,
            ffmpeg_last_check: 0,
            local_versions: std::collections::HashMap::new(),
        }
    }
}

pub(super) fn load_versions(req_path: &Path) -> Versions {
    let path = req_path.join("versions.json");
    if path.exists() {
        if let Ok(file) = File::open(&path) {
            if let Ok(v) = serde_json::from_reader(file) {
                return v;
            }
        }
        if let Ok(file) = File::open(&path) {
            if let Ok(value) = serde_json::from_reader::<_, serde_json::Value>(file) {
                if let Some(obj) = value.as_object() {
                    let mut versions = Versions::default();
                    if let Some(v) = obj.get("app_last_check").and_then(|v| v.as_u64()) {
                        versions.app_last_check = v;
                    }
                    if let Some(v) = obj.get("req_last_check").and_then(|v| v.as_u64()) {
                        versions.req_last_check = v;
                    }
                    if let Some(v) = obj.get("bridge_last_check").and_then(|v| v.as_u64()) {
                        versions.bridge_last_check = v;
                    }
                    if let Some(v) = obj.get("ffmpeg_last_check").and_then(|v| v.as_u64()) {
                        versions.ffmpeg_last_check = v;
                    }
                    for (key, val) in obj {
                        if matches!(
                            key.as_str(),
                            "app_last_check"
                                | "req_last_check"
                                | "bridge_last_check"
                                | "ffmpeg_last_check"
                        ) {
                            continue;
                        }
                        if let Some(s) = val.as_str() {
                            versions.local_versions.insert(key.clone(), s.to_string());
                        }
                    }
                    return versions;
                }
            }
        }
    }
    Versions::default()
}

pub(super) fn save_versions(req_path: &Path, versions: &Versions) {
    let path = req_path.join("versions.json");
    let mut merged_value = serde_json::to_value(versions).unwrap_or_else(|_| serde_json::json!({}));
    if let Ok(existing_file) = File::open(&path) {
        if let Ok(existing_value) = serde_json::from_reader::<_, serde_json::Value>(existing_file) {
            if let serde_json::Value::Object(existing_obj) = existing_value {
                if let serde_json::Value::Object(merged_obj) = &mut merged_value {
                    for (key, val) in existing_obj {
                        merged_obj.entry(key).or_insert(val);
                    }
                }
            }
        }
    }
    if let Ok(file) = File::create(path) {
        let _ = serde_json::to_writer(file, &merged_value);
    }
}
