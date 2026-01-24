#include "config_manager.h"
#include <QJsonDocument>
#include <QFile>
#include <QCoreApplication>

ConfigManager& ConfigManager::instance() {
    static ConfigManager instance;
    return instance;
}

ConfigManager::ConfigManager() {
    ensureDataDir();
    configPath = QDir(QCoreApplication::applicationDirPath()).filePath("Data/config.json");
    load();
}

void ConfigManager::ensureDataDir() {
    QDir dir(QCoreApplication::applicationDirPath());
    if (!dir.exists("Data")) dir.mkdir("Data");
    if (!dir.exists("Data/Requirements")) dir.mkpath("Data/Requirements");
}

void ConfigManager::load() {
    QFile file(configPath);
    if (file.open(QIODevice::ReadOnly)) {
        configData = QJsonDocument::fromJson(file.readAll()).object();
    } else {
        // Defaults
        setTheme("System");
        setLanguage("English");
        setCloseBehavior("Exit");
        save();
    }
}

void ConfigManager::save() {
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

QString ConfigManager::getRequirementsPath() const {
    return QDir(QCoreApplication::applicationDirPath()).filePath("Data/Requirements");
}