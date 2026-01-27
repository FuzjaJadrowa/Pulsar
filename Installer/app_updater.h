#ifndef APP_UPDATER_H
#define APP_UPDATER_H

#include <QObject>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QFile>
#include <QProcess>
#include <QCoreApplication>
#include <QDir>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QDateTime>
#include <QTemporaryDir>
#include "../App/popup.h"

class AppUpdater : public QObject {
    Q_OBJECT
public:
    explicit AppUpdater(Popup *popup, QObject *parent = nullptr);
    const QString CURRENT_VERSION = "v2.0.1";
    const QString REPO_URL = "https://api.github.com/repos/fuzjajadrowa/GUI-Video-Downloader/releases/latest";

    void checkForAppUpdates(bool manual);
    void startAppUpdate();

    signals:
        void updateAvailable(const QString &newVersion);
    void downloadProgress(int percentage);

private slots:
    void onVersionReceived();
    void onDownloadProgress(qint64 rx, qint64 total);
    void onDownloadFinished();

private:
    Popup *m_popup;
    QNetworkAccessManager *m_netManager;
    QNetworkReply *m_reply = nullptr;
    QString m_downloadUrl;
    QString m_newVersion;
    QString m_downloadFileName;
    bool m_isManual = false;

    qint64 getLastAppCheckTime();
    void setLastAppCheckTime();
    void applyUpdate(const QString &archivePath);
    QString getVersionsFilePath();
};

#endif