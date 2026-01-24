#ifndef INSTALLER_WINDOW_H
#define INSTALLER_WINDOW_H

#include <QDialog>
#include <QProgressBar>
#include <QLabel>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QTimer>
#include <QFile>
#include <QCloseEvent>

class InstallerWindow : public QDialog {
    Q_OBJECT

public:
    explicit InstallerWindow(QWidget *parent = nullptr);

protected:
    void closeEvent(QCloseEvent *event) override;

private slots:
    void startSequence();
    void handleFinished();

private:
    QLabel *statusLabel;
    QProgressBar *progressBar;
    QNetworkAccessManager *networkManager;
    QNetworkReply *currentReply = nullptr;

    QString targetFilePath;
    bool isDownloadingZip = false;

    void downloadFile(const QUrl &url, const QString &path, bool isZip);
    void downloadYtDlp();
    void downloadFFmpeg();
    void extractFFmpeg();
};

#endif