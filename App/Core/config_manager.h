#ifndef CONFIG_MANAGER_H
#define CONFIG_MANAGER_H

#include <QString>
#include <QDir>
#include <QVariant>
#include <QSettings>

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

    bool getAppAutoUpdate() const;
    void setAppAutoUpdate(bool enable);

    bool getYtDlpAutoUpdate() const;
    void setYtDlpAutoUpdate(bool enable);

    bool getFfmpegAutoUpdate() const;
    void setFfmpegAutoUpdate(bool enable);

    QString getRequirementsPath() const;

private:
    ConfigManager();
    ~ConfigManager();
    QSettings* settings;
    void ensureDataDir();
};

#endif