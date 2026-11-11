use serde::{Deserialize, Serialize};
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::Path;

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(default)]
pub(super) struct Versions {
    pub(super) app_last_check: u64,
    pub(super) bridge_last_check: u64,
    pub(super) ffmpeg_last_check: u64,
    #[serde(flatten)]
    pub(super) local_versions: std::collections::HashMap<String, String>,
}

impl Default for Versions {
    fn default() -> Self {
        Self {
            app_last_check: 0,
            bridge_last_check: 0,
            ffmpeg_last_check: 0,
            local_versions: std::collections::HashMap::new(),
        }
    }
}

pub(super) fn load_versions(req_path: &Path) -> Versions {
    let path = req_path.join("versions.json");
    if let Ok(file) = File::open(&path) {
        if let Ok(versions) = serde_json::from_reader(file) {
            return versions;
        }
    }

    if let Ok(file) = File::open(&path) {
        if let Ok(value) = serde_json::from_reader::<_, serde_json::Value>(file) {
            if let Some(object) = value.as_object() {
                let mut versions = Versions::default();
                if let Some(value) = object.get("app_last_check").and_then(|v| v.as_u64()) {
                    versions.app_last_check = value;
                }
                if let Some(value) = object.get("bridge_last_check").and_then(|v| v.as_u64()) {
                    versions.bridge_last_check = value;
                }
                if let Some(value) = object.get("ffmpeg_last_check").and_then(|v| v.as_u64()) {
                    versions.ffmpeg_last_check = value;
                }
                for (key, value) in object {
                    if matches!(
                        key.as_str(),
                        "app_last_check"
                            | "req_last_check"
                            | "bridge_last_check"
                            | "ffmpeg_last_check"
                    ) {
                        continue;
                    }
                    if let Some(value) = value.as_str() {
                        versions
                            .local_versions
                            .insert(key.clone(), value.to_string());
                    }
                }
                return versions;
            }
        }
    }
    Versions::default()
}

pub(super) fn save_versions(req_path: &Path, versions: &Versions) {
    let result = (|| -> Result<(), String> {
        fs::create_dir_all(req_path).map_err(|e| e.to_string())?;
        let path = req_path.join("versions.json");
        let temp_path = req_path.join("versions.json.tmp");
        let bytes = serde_json::to_vec(versions).map_err(|e| e.to_string())?;
        let mut file = OpenOptions::new()
            .create(true)
            .truncate(true)
            .write(true)
            .open(&temp_path)
            .map_err(|e| e.to_string())?;
        file.write_all(&bytes).map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
        drop(file);
        replace_file(&temp_path, &path).map_err(|e| e.to_string())
    })();

    if let Err(error) = result {
        eprintln!("Failed to save update versions: {error}");
    }
}

#[cfg(windows)]
fn replace_file(source: &Path, destination: &Path) -> std::io::Result<()> {
    use std::os::windows::ffi::OsStrExt;

    #[link(name = "kernel32")]
    extern "system" {
        fn MoveFileExW(existing_name: *const u16, new_name: *const u16, flags: u32) -> i32;
    }

    const MOVEFILE_REPLACE_EXISTING: u32 = 0x1;
    const MOVEFILE_WRITE_THROUGH: u32 = 0x8;
    let source: Vec<u16> = source.as_os_str().encode_wide().chain(Some(0)).collect();
    let destination: Vec<u16> = destination
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect();

    let succeeded = unsafe {
        MoveFileExW(
            source.as_ptr(),
            destination.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if succeeded == 0 {
        Err(std::io::Error::last_os_error())
    } else {
        Ok(())
    }
}

#[cfg(not(windows))]
fn replace_file(source: &Path, destination: &Path) -> std::io::Result<()> {
    fs::rename(source, destination)
}
