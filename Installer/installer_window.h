#ifndef INSTALLER_WINDOW_H
#define INSTALLER_WINDOW_H

#include <QDialog>
#include <QProgressBar>
#include <QLabel>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QFile>
#include <QDir>
#include <QTimer>
#include <QCoreApplication>
#include <QProcess>
#include <QDateTime>
#include "../App/popup.h"

class InstallerWindow : public QDialog {
    Q_OBJECT

public:
    explicit InstallerWindow(Popup *popup = nullptr, QWidget *parent = nullptr);
    bool hasRequirements();
    void startMissingFileDownload();
    void checkForUpdates(const QString &appName, bool manual);
    void startUpdateProcess(const QString &appName);

    signals:
        void installationFinished();
    void updateAvailable(const QString &appName);
    void upToDate(const QString &appName);
    void networkError(bool isRateLimit);

protected:
    void closeEvent(QCloseEvent *event) override;
    void keyPressEvent(QKeyEvent *event) override;

private slots:
    void handleReleaseInfo();
    void onDownloadProgress(qint64 rx, qint64 total);
    void handleDownloadFinished();

private:
    Popup *m_popup;
    QLabel *statusLabel;
    QProgressBar *progressBar;
    QNetworkAccessManager *netManager;
    QNetworkReply *currentReply = nullptr;

    QString m_currentApp;
    QString m_targetPath;
    QString m_remoteVersion;

    bool m_isManualCheck = false;
    bool m_isRepairMode = false;
    bool m_installing = false;

    QString getRequirementsPath();
    QString getExecutableName(const QString &baseName);
    QString getOsName();

    QString getLocalVersion(const QString &appName);
    qint64 getLastCheckTime(const QString &appName);
    void setLocalVersion(const QString &appName, const QString &version);
    void startDownload(const QString &appName, const QString &url, const QString &version);
    void extractArchive(const QString &archivePath);
    void processNextRepairStep();
    void fetchLatestRelease(const QString &appName);
};

#endif