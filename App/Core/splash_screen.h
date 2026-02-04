#ifndef SPLASH_SCREEN_H
#define SPLASH_SCREEN_H

#include <QWidget>
#include <QLabel>
#include <QProgressBar>
#include <QPushButton>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QFile>
#include <QTimer>
#include <QPropertyAnimation>
#include <QPainter>

class LoadingSpinner : public QWidget {
    Q_OBJECT
public:
    explicit LoadingSpinner(QWidget *parent = nullptr);
    void start();
    void stop();

protected:
    void paintEvent(QPaintEvent *event) override;

private:
    QTimer *m_timer;
    int m_angle;
};

class SplashScreen : public QWidget {
    Q_OBJECT

public:
    explicit SplashScreen(QWidget *parent = nullptr);
    void startProcess();

signals:
    void finished();

protected:
    void paintEvent(QPaintEvent *event) override;

private slots:
    void onAppVersionReceived();
    void onReqVersionReceived();
    void onDownloadProgress(qint64 rx, qint64 total);
    void onDownloadFinished();
    void onSkipClicked();

private:
    LoadingSpinner *m_spinner;
    QLabel *m_statusLabel;
    QLabel *m_progressLabel;
    QPushButton *m_skipButton;

    QNetworkAccessManager *m_netManager;
    QNetworkReply *m_reply = nullptr;

    const QString APP_VERSION = "v2.1.1";
    const QString APP_REPO_URL = "https://api.github.com/repos/fuzjajadrowa/Pulsar/releases/latest";

    QString m_downloadUrl;
    QString m_downloadFileName;
    QString m_targetPath;
    QString m_currentAction;
    QString m_remoteVersion;
    QString m_newVersion;

    bool m_isAppUpdate = false;
    bool m_appChecked = false;
    bool m_reqChecked = false;

    void checkAppUpdate();
    void applyAppUpdate(const QString &archivePath);

    void checkRequirements();
    void checkNextRequirement();
    void fetchReqInfo(const QString &appName);
    void downloadFile(const QString &url, const QString &destName);
    void extractArchive(const QString &archivePath, const QString &destDir);
    void finalize();

    bool isRemoteNewer(const QString &local, const QString &remote);

    QString getRequirementsPath();
    QString getExecutableName(const QString &baseName);
    QString getOsName();

    QString getLocalVersion(const QString &appName);
    void setLocalVersion(const QString &appName, const QString &version);
    qint64 getLastCheckTime(const QString &key);
    void setLastCheckTime(const QString &key);
};

#endif