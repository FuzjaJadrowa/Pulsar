#include "config_manager.h"
#include <QJsonDocument>
#include <QFile>
#include <QCoreApplication>
#include <QStandardPaths>
#include <QDir>
// TODO: Zmienić to na prostrze config.ini
ConfigManager& ConfigManager::instance() {
    static ConfigManager instance;
    return instance;
}

ConfigManager::ConfigManager() {
    QString dataPath = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
    QDir dir(dataPath);
    if (!dir.exists()) dir.mkpath(".");
    configPath = dir.filePath("config.json");
    load();
}

void ConfigManager::ensureDataDir() {
    QString dataPath = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
    QDir dir(dataPath);
    if (!dir.exists("Requirements")) dir.mkpath("Requirements");
}

void ConfigManager::load() {
    ensureDataDir();
    QFile file(configPath);
    if (file.exists() && file.open(QIODevice::ReadOnly)) {
        QJsonDocument doc = QJsonDocument::fromJson(file.readAll());
        if (!doc.isNull() && doc.isObject()) {
            configData = doc.object();
            return;
        }
    }

    setTheme("System");
    setLanguage("English");
    setCloseBehavior("Exit");
    setCookiesBrowser("None");
    setGeoBypass(true);
    setVideoFormat("mp4");
    setVideoQuality("1080p");
    setAudioFormat("mp3");
    setAudioQuality("128kbps");
    save();
}

void ConfigManager::save() {
    ensureDataDir();
    QFile file(configPath);
    if (file.open(QIODevice::WriteOnly)) {
        file.write(QJsonDocument(configData).toJson());
    }
}

QString ConfigManager::getTheme() const { return configData["theme"].toString("System"); }
void ConfigManager::setTheme(const QString& theme) { configData["theme"] = theme; save(); }

QString ConfigManager::getLanguage() const { return configData["language"].toString("English"); }
void ConfigManager::setLanguage(const QString& lang) { configData["language"] = lang; save(); }

QString ConfigManager::getCloseBehavior() const { return configData["close_behavior"].toString("Exit"); }
void ConfigManager::setCloseBehavior(const QString& behavior) { configData["close_behavior"] = behavior; save(); }

QString ConfigManager::getCookiesBrowser() const { return configData["cookies_browser"].toString("None"); }
void ConfigManager::setCookiesBrowser(const QString& browser) { configData["cookies_browser"] = browser; save(); }

bool ConfigManager::getGeoBypass() const { return configData["geo_bypass"].toBool(true); }
void ConfigManager::setGeoBypass(bool enable) { configData["geo_bypass"] = enable; save(); }

QString ConfigManager::getVideoFormat() const { return configData["v_format"].toString("mp4"); }
void ConfigManager::setVideoFormat(const QString& f) { configData["v_format"] = f; save(); }

QString ConfigManager::getVideoQuality() const { return configData["v_quality"].toString("1080p"); }
void ConfigManager::setVideoQuality(const QString& q) { configData["v_quality"] = q; save(); }

QString ConfigManager::getAudioFormat() const { return configData["a_format"].toString("mp3"); }
void ConfigManager::setAudioFormat(const QString& f) { configData["a_format"] = f; save(); }

QString ConfigManager::getAudioQuality() const { return configData["a_quality"].toString("128kbps"); }
void ConfigManager::setAudioQuality(const QString& q) { configData["a_quality"] = q; save(); }

QString ConfigManager::getRequirementsPath() const {
    QString dataPath = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
    return QDir(dataPath).filePath("Requirements");
}