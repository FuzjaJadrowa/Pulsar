#ifndef DEPENDENCY_MANAGER_H
#define DEPENDENCY_MANAGER_H

#include <QObject>
#include <QNetworkAccessManager>
#include <QNetworkReply>

class DependencyManager : public QObject {
    Q_OBJECT
public:
    explicit DependencyManager(QObject *parent = nullptr);

    void checkUpdate(const QString &appName);
    void install(const QString &appName);

    signals:
        void logMessage(const QString &msg);
    void statusChanged(const QString &appName, const QString &status, bool isSuccess);

private slots:
    void onReleaseInfoReceived(const QString &appName, QNetworkReply *reply);
    void onDownloadProgress(qint64 bytesReceived, qint64 bytesTotal);
    void onDownloadFinished(const QString &appName, const QString &filePath, const QString &versionDate, bool isZip);

private:
    QNetworkAccessManager *netManager;
    QString currentDownloadApp;

    QString getLocalVersionDate(const QString &appName);
    void setLocalVersionDate(const QString &appName, const QString &date);
    void extractFFmpeg(const QString &zipPath, const QString &date);
};

#endif