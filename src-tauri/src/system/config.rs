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
    pub advanced_mode: bool,
    pub system_notifications: bool,
    #[serde(default)]
    pub idle_animation: bool,

    pub update_app: bool,
    pub update_app_cooldown_minutes: u64,
    pub update_ytdlp: bool,
    pub update_ffmpeg: bool,
    #[serde(default)]
    pub ffmpeg_hwaccel: bool,
    #[serde(default)]
    pub ffmpeg_hwaccels: Vec<String>,
    #[serde(default)]
    pub ffmpeg_hwaccel_preferred: String,

    pub cookies_browser: String,
    #[serde(default)]
    pub maximum_concurrent_processes: u64,
    #[serde(default)]
    pub maximum_search_results: u64,
    #[serde(default)]
    pub title_template: String
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            theme: "System".to_string(),
            language: "English".to_string(),
            close_behavior: "hide".to_string(),
            advanced_mode: false,
            system_notifications: true,
            idle_animation: true,
            update_app: true,
            update_app_cooldown_minutes: 30,
            update_ytdlp: true,
            update_ffmpeg: true,
            ffmpeg_hwaccel: false,
            ffmpeg_hwaccels: Vec::new(),
            ffmpeg_hwaccel_preferred: "auto".to_string(),
            cookies_browser: "None".to_string(),
            maximum_concurrent_processes: 3,
            maximum_search_results: 10,
            title_template: "%(title)s [%(id)s]".to_string()
        }
    }
}

impl AppConfig {
    pub fn sanitize(&mut self) {
        self.update_app_cooldown_minutes = clamp_range(self.update_app_cooldown_minutes, 10, 500, 30);
        self.maximum_concurrent_processes = clamp_range(self.maximum_concurrent_processes, 1, 10, 3);
        self.maximum_search_results = clamp_range(self.maximum_search_results, 1, 50, 10);
        if self.title_template.trim().is_empty() {
            self.title_template = "%(title)s [%(id)s]".to_string();
        }
        if self.ffmpeg_hwaccel_preferred.trim().is_empty() {
            self.ffmpeg_hwaccel_preferred = "auto".to_string();
        }
        if self.ffmpeg_hwaccel_preferred != "auto"
            && !self.ffmpeg_hwaccels.iter().any(|accel| accel == &self.ffmpeg_hwaccel_preferred) {
            self.ffmpeg_hwaccel_preferred = "auto".to_string();
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
                let mut theme_loaded = false;

                if let Some(section) = ini.section(Some("Appearance")) {
                    if let Some(v) = section.get("theme") {
                        config.theme = v.to_string();
                        theme_loaded = true;
                    }
                    config.idle_animation = section
                        .get("idle_animation")
                        .map(|v| v == "true")
                        .unwrap_or(true);
                }

                if let Some(section) = ini.section(Some("General")) {
                    // Backward compatibility for configs that still keep theme in "General".
                    if !theme_loaded {
                        if let Some(v) = section.get("theme") { config.theme = v.to_string(); }
                    }
                    if let Some(v) = section.get("language") { config.language = v.to_string(); }
                    if let Some(v) = section.get("close_behavior") { config.close_behavior = v.to_string(); }
                    config.advanced_mode = section.get("advanced_mode").map(|v| v == "true").unwrap_or(false);
                    config.system_notifications = section.get("system_notifications").map(|v| v == "true").unwrap_or(true);
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
                if let Some(section) = ini.section(Some("Acceleration")) {
                    config.ffmpeg_hwaccel = section.get("ffmpeg_hwaccel").map(|v| v == "true").unwrap_or(false);
                    if let Some(v) = section.get("ffmpeg_hwaccels") {
                        let parsed = v.split(',')
                            .map(|item| item.trim().to_string())
                            .filter(|item| !item.is_empty())
                            .collect::<Vec<_>>();
                        config.ffmpeg_hwaccels = parsed;
                    }
                    if let Some(v) = section.get("ffmpeg_hwaccel_preferred") {
                        config.ffmpeg_hwaccel_preferred = v.to_string();
                    }
                }
                if let Some(section) = ini.section(Some("Download")) {
                    if let Some(v) = section.get("cookies_browser") { config.cookies_browser = v.to_string(); }
                    config.maximum_concurrent_processes = section
                        .get("maximum_concurrent_processes")
                        .and_then(|v| v.parse::<u64>().ok())
                        .unwrap_or(3);
                    config.maximum_search_results = section
                        .get("maximum_search_results")
                        .and_then(|v| v.parse::<u64>().ok())
                        .unwrap_or(10);
                    if let Some(v) = section.get("title_template") { config.title_template = v.to_string(); }
                }
            }
        } else {
            Self::save_to_disk_internal(&path, &config);
        }

        config.sanitize();
        (path, config)
    }

    pub fn save(&self) {
        let config = self.config.lock().unwrap();
        Self::save_to_disk_internal(&self.config_path, &config);
    }

    fn save_to_disk_internal(path: &PathBuf, config: &AppConfig) {
        let mut ini = Ini::new();

        ini.with_section(Some("General"))
            .set("language", &config.language)
            .set("close_behavior", &config.close_behavior)
            .set("advanced_mode", if config.advanced_mode { "true" } else { "false" })
            .set("system_notifications", if config.system_notifications { "true" } else { "false" });

        ini.with_section(Some("Appearance"))
            .set("theme", &config.theme)
            .set("idle_animation", if config.idle_animation { "true" } else { "false" });

        ini.with_section(Some("Requirements"))
            .set("update_app", if config.update_app { "true" } else { "false" })
            .set("update_app_cooldown_minutes", config.update_app_cooldown_minutes.to_string())
            .set("update_ytdlp", if config.update_ytdlp { "true" } else { "false" })
            .set("update_ffmpeg", if config.update_ffmpeg { "true" } else { "false" });

        ini.with_section(Some("Acceleration"))
            .set("ffmpeg_hwaccel", if config.ffmpeg_hwaccel { "true" } else { "false" });
        if !config.ffmpeg_hwaccels.is_empty() {
            ini.with_section(Some("Acceleration"))
                .set("ffmpeg_hwaccels", config.ffmpeg_hwaccels.join(","));
        } else {
            ini.with_section(Some("Acceleration"))
                .set("ffmpeg_hwaccels", "");
        }
        ini.with_section(Some("Acceleration"))
            .set("ffmpeg_hwaccel_preferred", &config.ffmpeg_hwaccel_preferred);

        ini.with_section(Some("Download"))
            .set("cookies_browser", &config.cookies_browser)
            .set("maximum_concurrent_processes", config.maximum_concurrent_processes.to_string())
            .set("maximum_search_results", config.maximum_search_results.to_string())
            .set("title_template", &config.title_template);

        let _ = ini.write_to_file(path);
    }
}

fn clamp_range(value: u64, min: u64, max: u64, default_value: u64) -> u64 {
    // Invalid persisted values are reset to a safe default.
    if value < min || value > max {
        return default_value;
    }
    value
}