#ifndef CONFIG_MANAGER_H
#define CONFIG_MANAGER_H

#include <QString>
#include <QJsonObject>
#include <QDir>

class ConfigManager {
public:
    static ConfigManager& instance();

    void load();
    void save();

    QString getTheme() const;
    void setTheme(const QString& theme);

    QString getLanguage() const;
    void setLanguage(const QString& lang);

    QString getCloseBehavior() const;
    void setCloseBehavior(const QString& behavior);

    QString getCookiesBrowser() const;
    void setCookiesBrowser(const QString& browser);

    bool getIgnoreErrors() const;
    void setIgnoreErrors(bool enable);

    bool getGeoBypass() const;
    void setGeoBypass(bool enable);

    QString getRequirementsPath() const;

private:
    ConfigManager();
    QJsonObject configData;
    QString configPath;

    void ensureDataDir();
};

#endif