#include "installer_window.h"
#include <QVBoxLayout>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QProcess>
#include <QStyleFactory>
#include <QCloseEvent>
#include <QKeyEvent>

InstallerWindow::InstallerWindow(Popup *popup, QWidget *parent)
    : QDialog(parent), m_popup(popup) {
    setWindowTitle("GVD Requirements Installer");
    setFixedSize(450, 150);
    setWindowFlags(Qt::Window | Qt::WindowTitleHint | Qt::CustomizeWindowHint);

    this->setStyleSheet("background-color: #ffffff; color: #000000;");

    auto *layout = new QVBoxLayout(this);
    statusLabel = new QLabel("Initializing...", this);
    statusLabel->setAlignment(Qt::AlignCenter);
    statusLabel->setStyleSheet("color: #000000;");

    progressBar = new QProgressBar(this);
    progressBar->setFixedHeight(22);
    progressBar->setStyle(QStyleFactory::create("windowsvista"));
    progressBar->setStyleSheet("QProgressBar { color: #000000; text-align: center; }");

    layout->addStretch();
    layout->addWidget(statusLabel);
    layout->addWidget(progressBar);
    layout->addStretch();

    netManager = new QNetworkAccessManager(this);
}

void InstallerWindow::closeEvent(QCloseEvent *event) {
    if (m_installing) {
        event->ignore();
    } else {
        event->accept();
    }
}

void InstallerWindow::keyPressEvent(QKeyEvent *event) {
    if (event->key() == Qt::Key_F4 && (event->modifiers() & Qt::AltModifier)) {
        if (!m_installing) {
            reject();
        }
        event->accept();
    } else {
        QDialog::keyPressEvent(event);
    }
}

QString InstallerWindow::getRequirementsPath() {
    QString path = QCoreApplication::applicationDirPath() + "/Data/Requirements";
    QDir().mkpath(path);
    return path;
}

bool InstallerWindow::hasRequirements() {
    QString reqPath = getRequirementsPath();
    return QFile::exists(reqPath + "/yt-dlp.exe") && QFile::exists(reqPath + "/ffmpeg.exe");
}

void InstallerWindow::startMissingFileRepair() {
    m_isRepairMode = true;
    m_isManualCheck = false;
    m_installing = true;
    show();
    processNextRepairStep();
}

void InstallerWindow::checkForUpdates(bool manual) {
    m_isRepairMode = false;
    m_isManualCheck = manual;
    m_installing = false;
    fetchLatestRelease("yt-dlp");
}

void InstallerWindow::startUpdateProcess(const QString &appName) {
    m_isRepairMode = false;
    m_isManualCheck = false;
    m_installing = true;
    m_currentApp = appName;
    statusLabel->setText("Preparing update for " + appName + "...");
    if (!isVisible()) show();
    fetchLatestRelease(appName);
}

void InstallerWindow::processNextRepairStep() {
    QString reqPath = getRequirementsPath();
    if (!QFile::exists(reqPath + "/yt-dlp.exe")) {
        fetchLatestRelease("yt-dlp");
    } else if (!QFile::exists(reqPath + "/ffmpeg.exe")) {
        fetchLatestRelease("ffmpeg");
    } else {
        m_installing = false;
        accept();
    }
}

void InstallerWindow::fetchLatestRelease(const QString &appName) {
    m_currentApp = appName;
    statusLabel->setText("Checking info for " + appName + "...");
    QString repo = (appName == "yt-dlp") ? "yt-dlp/yt-dlp" : "GyanD/codexffmpeg";
    QUrl url(QString("https://api.github.com/repos/%1/releases/latest").arg(repo));
    QNetworkRequest request(url);
    auto *reply = netManager->get(request);
    connect(reply, &QNetworkReply::finished, this, &InstallerWindow::handleReleaseInfo);
}

void InstallerWindow::handleReleaseInfo() {
    auto *reply = qobject_cast<QNetworkReply*>(sender());
    reply->deleteLater();

    if (reply->error() != QNetworkReply::NoError) {
        m_installing = false;
        if (!m_isRepairMode) hide();
        emit networkError();
        return;
    }

    auto json = QJsonDocument::fromJson(reply->readAll()).object();
    QString remoteDate = json["published_at"].toString();
    if (remoteDate.isEmpty()) remoteDate = json["tag_name"].toString();
    QString localDate = getLocalVersion(m_currentApp);
    bool updateNeeded = (localDate != remoteDate);

    if (!m_installing) {
        if (!updateNeeded) {
            if (m_currentApp == "yt-dlp") {
                fetchLatestRelease("ffmpeg");
                return;
            } else {
                if (m_isManualCheck) emit upToDate();
                return;
            }
        } else {
            emit updateAvailable(m_currentApp);
            return;
        }
    }

    QJsonArray assets = json["assets"].toArray();
    QString downloadUrl;
    for (const auto &val : assets) {
        QString name = val.toObject()["name"].toString().toLower();
        if (m_currentApp == "yt-dlp" && name == "yt-dlp.exe") {
            downloadUrl = val.toObject()["browser_download_url"].toString();
            break;
        }
        if (m_currentApp == "ffmpeg" && name.contains("essentials_build") && name.endsWith(".zip")) {
            downloadUrl = val.toObject()["browser_download_url"].toString();
            break;
        }
    }

    if (!downloadUrl.isEmpty()) {
        startDownload(m_currentApp, downloadUrl, remoteDate);
    } else if (m_isRepairMode) {
        processNextRepairStep();
    }
}

void InstallerWindow::startDownload(const QString &appName, const QString &url, const QString &version) {
    m_remoteVersion = version;
    m_targetPath = getRequirementsPath() + (appName == "ffmpeg" ? "/ffmpeg.zip" : "/yt-dlp.exe");
    m_installing = true;
    statusLabel->setText("Downloading " + appName + "...");
    if (!isVisible()) show();
    QNetworkRequest req((QUrl(url)));
    req.setAttribute(QNetworkRequest::RedirectPolicyAttribute, QNetworkRequest::NoLessSafeRedirectPolicy);
    currentReply = netManager->get(req);
    connect(currentReply, &QNetworkReply::downloadProgress, this, &InstallerWindow::onDownloadProgress);
    connect(currentReply, &QNetworkReply::finished, this, &InstallerWindow::handleDownloadFinished);
}

void InstallerWindow::onDownloadProgress(qint64 rx, qint64 total) {
    if (total > 0) progressBar->setValue(static_cast<int>((rx * 100) / total));
}

void InstallerWindow::handleDownloadFinished() {
    if (currentReply->error() == QNetworkReply::NoError) {
        QFile file(m_targetPath);
        if (file.open(QIODevice::WriteOnly)) {
            file.write(currentReply->readAll());
            file.close();
            if (m_currentApp == "ffmpeg") extractFFmpeg(m_targetPath);
            else {
                setLocalVersion(m_currentApp, m_remoteVersion);
                if (m_isRepairMode) processNextRepairStep();
                else {
                    m_installing = false;
                    if (m_popup) m_popup->showMessage("Success", m_currentApp + " updated successfully!", Popup::Success, Popup::Temporary);
                    accept();
                }
            }
        }
    } else {
        m_installing = false;
        if (m_popup) m_popup->showMessage("Error", "Download failed.", Popup::Error, Popup::Permanent);
    }
    currentReply->deleteLater();
    currentReply = nullptr;
}

void InstallerWindow::extractFFmpeg(const QString &zipPath) {
    statusLabel->setText("Extracting FFmpeg...");
    progressBar->setValue(0);
    QString destDir = getRequirementsPath();
    QString script = QString(
        "$ProgressPreference = 'SilentlyContinue'; "
        "Expand-Archive -Path '%1' -DestinationPath '%2/temp' -Force; "
        "Get-ChildItem -Path '%2/temp' -Filter *.exe -Recurse | Move-Item -Destination '%2' -Force; "
        "Remove-Item -Path '%2/temp' -Recurse -Force; "
        "Remove-Item -Path '%1' -Force"
    ).arg(zipPath, destDir);

    auto *process = new QProcess(this);
    connect(process, QOverload<int, QProcess::ExitStatus>::of(&QProcess::finished), this, [this, process]() {
        process->deleteLater();
        setLocalVersion("ffmpeg", m_remoteVersion);
        if (m_isRepairMode) processNextRepairStep();
        else {
            m_installing = false;
            if (m_popup) m_popup->showMessage("Success", "FFmpeg updated successfully!", Popup::Success, Popup::Temporary);
            accept();
        }
    });
    process->start("powershell", {"-Command", script});
}

QString InstallerWindow::getLocalVersion(const QString &appName) {
    QFile file(getRequirementsPath() + "/versions.json");
    if (file.open(QIODevice::ReadOnly)) {
        return QJsonDocument::fromJson(file.readAll()).object()[appName].toString();
    }
    return "";
}

void InstallerWindow::setLocalVersion(const QString &appName, const QString &version) {
    QString path = getRequirementsPath() + "/versions.json";
    QJsonObject obj;
    QFile fileIn(path);
    if (fileIn.open(QIODevice::ReadOnly)) {
        obj = QJsonDocument::fromJson(fileIn.readAll()).object();
        fileIn.close();
    }
    obj[appName] = version;
    QFile fileOut(path);
    if (fileOut.open(QIODevice::WriteOnly)) fileOut.write(QJsonDocument(obj).toJson());
}