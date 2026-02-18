use serde::{Deserialize, Serialize};
use ini::Ini;
use std::sync::Mutex;
use std::path::PathBuf;
use directories::BaseDirs;
use std::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub theme: String,
    pub language: String,
    pub close_behavior: String,

    pub update_app: bool,
    pub update_app_cooldown_minutes: u64,
    pub update_ytdlp: bool,
    pub update_ffmpeg: bool,

    pub cookies_browser: String
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            theme: "System".to_string(),
            language: "English".to_string(),
            close_behavior: "hide".to_string(),
            update_app: true,
            update_app_cooldown_minutes: 30,
            update_ytdlp: true,
            update_ffmpeg: true,
            cookies_browser: "None".to_string()
        }
    }
}

pub struct ConfigManager {
    pub config: Mutex<AppConfig>,
    config_path: PathBuf,
}

impl ConfigManager {
    pub fn new() -> Self {
        let (config_path, config) = Self::load_from_disk();
        Self {
            config: Mutex::new(config),
            config_path,
        }
    }

    fn get_config_path() -> PathBuf {
        if let Some(base_dirs) = BaseDirs::new() {
            let app_dir = base_dirs.data_local_dir().join("Pulsar");

            if !app_dir.exists() {
                let _ = fs::create_dir_all(&app_dir);
            }
            return app_dir.join("config.ini");
        }
        PathBuf::from("config.ini")
    }

    fn load_from_disk() -> (PathBuf, AppConfig) {
        let path = Self::get_config_path();
        let mut config = AppConfig::default();

        if path.exists() {
            if let Ok(ini) = Ini::load_from_file(&path) {
                if let Some(section) = ini.section(Some("General")) {
                    if let Some(v) = section.get("theme") { config.theme = v.to_string(); }
                    if let Some(v) = section.get("language") { config.language = v.to_string(); }
                    if let Some(v) = section.get("close_behavior") { config.close_behavior = v.to_string(); }
                }
                if let Some(section) = ini.section(Some("Requirements")) {
                    config.update_app = section.get("update_app").map(|v| v == "true").unwrap_or(true);
                    config.update_app_cooldown_minutes = section
                        .get("update_app_cooldown_minutes")
                        .and_then(|v| v.parse::<u64>().ok())
                        .unwrap_or(30);
                    config.update_ytdlp = section.get("update_ytdlp").map(|v| v == "true").unwrap_or(true);
                    config.update_ffmpeg = section.get("update_ffmpeg").map(|v| v == "true").unwrap_or(true);
                }
                if let Some(section) = ini.section(Some("Download")) {
                    if let Some(v) = section.get("cookies_browser") { config.cookies_browser = v.to_string(); }
                }
            }
        } else {
            Self::save_to_disk_internal(&path, &config);
        }

        (path, config)
    }

    pub fn save(&self) {
        let config = self.config.lock().unwrap();
        Self::save_to_disk_internal(&self.config_path, &config);
    }

    fn save_to_disk_internal(path: &PathBuf, config: &AppConfig) {
        let mut ini = Ini::new();

        ini.with_section(Some("General"))
            .set("theme", &config.theme)
            .set("language", &config.language)
            .set("close_behavior", &config.close_behavior);

        ini.with_section(Some("Requirements"))
            .set("update_app", if config.update_app { "true" } else { "false" })
            .set("update_app_cooldown_minutes", config.update_app_cooldown_minutes.to_string())
            .set("update_ytdlp", if config.update_ytdlp { "true" } else { "false" })
            .set("update_ffmpeg", if config.update_ffmpeg { "true" } else { "false" });

        ini.with_section(Some("Download"))
            .set("cookies_browser", &config.cookies_browser);

        let _ = ini.write_to_file(path);
    }
}