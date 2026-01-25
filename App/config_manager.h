#ifndef CONFIG_MANAGER_H
#define CONFIG_MANAGER_H

#include <QString>
#include <QJsonObject>
#include <QDir>
#include <QVariant>

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

    QString getVideoFormat() const;
    void setVideoFormat(const QString& format);

    QString getVideoQuality() const;
    void setVideoQuality(const QString& quality);

    QString getAudioFormat() const;
    void setAudioFormat(const QString& format);

    QString getAudioQuality() const;
    void setAudioQuality(const QString& quality);

    QString getRequirementsPath() const;

private:
    ConfigManager();
    QJsonObject configData;
    QString configPath;

    void ensureDataDir();
};

#endif