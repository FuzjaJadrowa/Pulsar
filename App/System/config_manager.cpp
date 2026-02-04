#include "config_manager.h"
#include <QCoreApplication>
#include <QStandardPaths>
#include <QDir>

ConfigManager& ConfigManager::instance() {
    static ConfigManager instance;
    return instance;
}

ConfigManager::ConfigManager() {
    ensureDataDir();
    QString dataPath = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
    QDir dir(dataPath);
    QString configPath = dir.filePath("config.ini");

    settings = new QSettings(configPath, QSettings::IniFormat);

    if (settings->allKeys().isEmpty()) {
        load();
    }
}

ConfigManager::~ConfigManager() {
    delete settings;
}

void ConfigManager::ensureDataDir() {
    QString dataPath = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
    QDir dir(dataPath);
    if (!dir.exists()) dir.mkpath(".");
    if (!dir.exists("Requirements")) dir.mkpath("Requirements");
}

void ConfigManager::load() {
    if (!settings->contains("theme")) setTheme("System");
    if (!settings->contains("language")) setLanguage("English");
    if (!settings->contains("close_behavior")) setCloseBehavior("Exit");
    if (!settings->contains("cookies_browser")) setCookiesBrowser("None");
    if (!settings->contains("geo_bypass")) setGeoBypass(true);
    if (!settings->contains("v_format")) setVideoFormat("mp4");
    if (!settings->contains("v_quality")) setVideoQuality("1080p");
    if (!settings->contains("a_format")) setAudioFormat("mp3");
    if (!settings->contains("a_quality")) setAudioQuality("128kbps");
    if (!settings->contains("update_app")) setAppAutoUpdate(true);
    if (!settings->contains("update_ytdlp")) setYtDlpAutoUpdate(true);
    if (!settings->contains("update_ffmpeg")) setFfmpegAutoUpdate(true);
    save();
}

void ConfigManager::save() {
    settings->sync();
}

QString ConfigManager::getTheme() const { return settings->value("theme", "System").toString(); }
void ConfigManager::setTheme(const QString& theme) { settings->setValue("theme", theme); }

QString ConfigManager::getLanguage() const { return settings->value("language", "English").toString(); }
void ConfigManager::setLanguage(const QString& lang) { settings->setValue("language", lang); }

QString ConfigManager::getCloseBehavior() const { return settings->value("close_behavior", "Exit").toString(); }
void ConfigManager::setCloseBehavior(const QString& behavior) { settings->setValue("close_behavior", behavior); }

QString ConfigManager::getCookiesBrowser() const { return settings->value("cookies_browser", "None").toString(); }
void ConfigManager::setCookiesBrowser(const QString& browser) { settings->setValue("cookies_browser", browser); }

bool ConfigManager::getGeoBypass() const { return settings->value("geo_bypass", true).toBool(); }
void ConfigManager::setGeoBypass(bool enable) { settings->setValue("geo_bypass", enable); }

QString ConfigManager::getVideoFormat() const { return settings->value("v_format", "mp4").toString(); }
void ConfigManager::setVideoFormat(const QString& f) { settings->setValue("v_format", f); }

QString ConfigManager::getVideoQuality() const { return settings->value("v_quality", "1080p").toString(); }
void ConfigManager::setVideoQuality(const QString& q) { settings->setValue("v_quality", q); }

QString ConfigManager::getAudioFormat() const { return settings->value("a_format", "mp3").toString(); }
void ConfigManager::setAudioFormat(const QString& f) { settings->setValue("a_format", f); }

QString ConfigManager::getAudioQuality() const { return settings->value("a_quality", "128kbps").toString(); }
void ConfigManager::setAudioQuality(const QString& q) { settings->setValue("a_quality", q); }

bool ConfigManager::getAppAutoUpdate() const { return settings->value("update_app", true).toBool(); }
void ConfigManager::setAppAutoUpdate(bool enable) { settings->setValue("update_app", enable); }

bool ConfigManager::getYtDlpAutoUpdate() const { return settings->value("update_ytdlp", true).toBool(); }
void ConfigManager::setYtDlpAutoUpdate(bool enable) { settings->setValue("update_ytdlp", enable); }

bool ConfigManager::getFfmpegAutoUpdate() const { return settings->value("update_ffmpeg", true).toBool(); }
void ConfigManager::setFfmpegAutoUpdate(bool enable) { settings->setValue("update_ffmpeg", enable); }

QString ConfigManager::getRequirementsPath() const {
    QString dataPath = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
    return QDir(dataPath).filePath("Requirements");
}