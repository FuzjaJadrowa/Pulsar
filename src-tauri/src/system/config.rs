use serde::{Deserialize, Serialize};
use ini::Ini;
use std::sync::Mutex;
use std::path::PathBuf;
use directories::ProjectDirs;
use std::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub theme: String,
    pub language: String,
    pub close_behavior: String,

    pub update_app: bool,
    pub update_ytdlp: bool,
    pub update_ffmpeg: bool,

    pub cookies_browser: String,
    pub geo_bypass: bool,
    pub video_format: String,
    pub video_quality: String,
    pub audio_format: String,
    pub audio_quality: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            theme: "System".to_string(),
            language: "English".to_string(),
            close_behavior: "hide".to_string(),
            update_app: true,
            update_ytdlp: true,
            update_ffmpeg: true,
            cookies_browser: "None".to_string(),
            geo_bypass: false,
            video_format: "mp4".to_string(),
            video_quality: "1080p".to_string(),
            audio_format: "mp3".to_string(),
            audio_quality: "128kbps".to_string(),
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
        if let Some(proj_dirs) = ProjectDirs::from("com", "pulsar", "pulsar_app") {
            let config_dir = proj_dirs.config_dir();
            if !config_dir.exists() {
                let _ = fs::create_dir_all(config_dir);
            }
            return config_dir.join("config.ini");
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
                    config.update_ytdlp = section.get("update_ytdlp").map(|v| v == "true").unwrap_or(true);
                    config.update_ffmpeg = section.get("update_ffmpeg").map(|v| v == "true").unwrap_or(true);
                }
                if let Some(section) = ini.section(Some("Download")) {
                    if let Some(v) = section.get("cookies_browser") { config.cookies_browser = v.to_string(); }
                    config.geo_bypass = section.get("geo_bypass").map(|v| v == "true").unwrap_or(false);
                    if let Some(v) = section.get("video_format") { config.video_format = v.to_string(); }
                    if let Some(v) = section.get("video_quality") { config.video_quality = v.to_string(); }
                    if let Some(v) = section.get("audio_format") { config.audio_format = v.to_string(); }
                    if let Some(v) = section.get("audio_quality") { config.audio_quality = v.to_string(); }
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
            .set("update_ytdlp", if config.update_ytdlp { "true" } else { "false" })
            .set("update_ffmpeg", if config.update_ffmpeg { "true" } else { "false" });

        ini.with_section(Some("Download"))
            .set("cookies_browser", &config.cookies_browser)
            .set("geo_bypass", if config.geo_bypass { "true" } else { "false" })
            .set("video_format", &config.video_format)
            .set("video_quality", &config.video_quality)
            .set("audio_format", &config.audio_format)
            .set("audio_quality", &config.audio_quality);

        let _ = ini.write_to_file(path);
    }
}