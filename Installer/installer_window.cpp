#include "installer_window.h"
#include <QVBoxLayout>
#include <QDir>
#include <QProcess>
#include <QApplication>
#include <QStyleFactory>
#include <filesystem>

namespace fs = std::filesystem;

InstallerWindow::InstallerWindow(QWidget *parent) : QWidget(parent) {setAutoFillBackground(true);
    QPalette pal = palette();
    pal.setColor(QPalette::Window, Qt::white);
    setPalette(pal);

    auto *layout = new QVBoxLayout(this);
    layout->setContentsMargins(30, 30, 30, 30);
    layout->setSpacing(20);

    statusLabel = new QLabel("Checking requirements...", this);
    statusLabel->setAlignment(Qt::AlignCenter);
    QFont labelFont("Segoe UI", 12);
    statusLabel->setFont(labelFont);
    statusLabel->setStyleSheet("background: transparent; color: black;");

    progressBar = new QProgressBar(this);
    progressBar->setTextVisible(false);
    progressBar->setFixedHeight(22);

    progressBar->setStyleSheet("");
    progressBar->setStyle(QStyleFactory::create("windowsvista"));

    layout->addStretch();
    layout->addWidget(statusLabel);
    layout->addWidget(progressBar);
    layout->addStretch();

    networkManager = new QNetworkAccessManager(this);

    if (!fs::exists("requirements")) {
        fs::create_directory("requirements");
    }

    QTimer::singleShot(800, this, &InstallerWindow::startSequence);
}

void InstallerWindow::startSequence() {
    if (!fs::exists("requirements/yt-dlp.exe")) {
        downloadYtDlp();
    } else if (!fs::exists("requirements/ffmpeg.exe")) {
        downloadFFmpeg();
    } else {
        finishInstallation();
    }
}

void InstallerWindow::downloadYtDlp() {
    statusLabel->setText("Downloading yt-dlp...");
    downloadFile(QUrl("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"),
                 "requirements/yt-dlp.exe", false);
}

void InstallerWindow::downloadFFmpeg() {
    statusLabel->setText("Downloading ffmpeg...");
    downloadFile(QUrl("https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"),
                 "requirements/ffmpeg.zip", true);
}

void InstallerWindow::downloadFile(const QUrl &url, const QString &path, bool isZip) {
    targetFilePath = path;
    isDownloadingZip = isZip;
    QNetworkRequest request(url);
    request.setAttribute(QNetworkRequest::RedirectPolicyAttribute, QNetworkRequest::NoLessSafeRedirectPolicy);
    currentReply = networkManager->get(request);

    connect(currentReply, &QNetworkReply::downloadProgress, this, [this](qint64 rx, qint64 total) {
        if (total > 0) progressBar->setValue(static_cast<int>((rx * 100) / total));
    });
    connect(currentReply, &QNetworkReply::finished, this, &InstallerWindow::handleFinished);
}

void InstallerWindow::handleFinished() {
    if (currentReply->error() == QNetworkReply::NoError) {
        QFile file(targetFilePath);
        if (file.open(QIODevice::WriteOnly)) {
            file.write(currentReply->readAll());
            file.close();
            if (isDownloadingZip) {
                statusLabel->setText("Extracting ffmpeg...");
                extractFFmpeg();
            } else {
                progressBar->setValue(0);
                startSequence();
            }
        }
    }
    currentReply->deleteLater();
}

void InstallerWindow::extractFFmpeg() {
    QString zipPath = QDir::current().absoluteFilePath("requirements/ffmpeg.zip");
    QString destDir = QDir::current().absoluteFilePath("requirements/");
    QString script = QString(
        "$ProgressPreference = 'SilentlyContinue'; "
        "Expand-Archive -Path '%1' -DestinationPath '%2/temp' -Force; "
        "Get-ChildItem -Path '%2/temp' -Filter *.exe -Recurse | Move-Item -Destination '%2' -Force; "
        "Remove-Item -Path '%2/temp' -Recurse -Force; "
        "Remove-Item -Path '%1' -Force"
    ).arg(zipPath, destDir);

    auto *process = new QProcess(this);
    connect(process, QOverload<int, QProcess::ExitStatus>::of(&QProcess::finished), this, [this]() {
        startSequence();
    });
    process->start("powershell", {"-Command", script});
}

void InstallerWindow::finishInstallation() {
    progressBar->setValue(100);
    emit installationFinished();
}