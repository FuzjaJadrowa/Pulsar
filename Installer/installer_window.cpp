#include "installer_window.h"
#include <QVBoxLayout>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QProcess>
#include <QStyleFactory>
#include <QCloseEvent>

InstallerWindow::InstallerWindow(Popup *popup, QWidget *parent)
    : QDialog(parent), m_popup(popup) {
    setWindowTitle("GVD Requirements Installer");
    setFixedSize(450, 150);
    setWindowFlags(Qt::Window | Qt::WindowTitleHint | Qt::CustomizeWindowHint);

    auto *layout = new QVBoxLayout(this);
    statusLabel = new QLabel("Initializing...", this);
    statusLabel->setAlignment(Qt::AlignCenter);

    progressBar = new QProgressBar(this);
    progressBar->setFixedHeight(22);
    progressBar->setStyle(QStyleFactory::create("windowsvista"));

    layout->addStretch();
    layout->addWidget(statusLabel);
    layout->addWidget(progressBar);
    layout->addStretch();

    netManager = new QNetworkAccessManager(this);
}

void InstallerWindow::closeEvent(QCloseEvent *event) {
    if (currentReply) event->ignore();
    else event->accept();
}

QString InstallerWindow::getRequirementsPath() {
    QString path = QCoreApplication::applicationDirPath() + "/Data/Requirements";
    QDir().mkpath(path);
    return path;
}

void InstallerWindow::checkUpdatesSilent() {
    m_isSilent = true;
    m_isManual = false;
    processNextStep();
}

void InstallerWindow::forceUpdate(const QString &appName) {
    m_isSilent = false;
    m_isManual = true;
    m_currentApp = appName;
    fetchLatestRelease(appName);
}

void InstallerWindow::processNextStep() {
    QString reqPath = getRequirementsPath();
    if (!QFile::exists(reqPath + "/yt-dlp.exe")) {
        m_isSilent = false;
        fetchLatestRelease("yt-dlp");
    } else if (!QFile::exists(reqPath + "/ffmpeg.exe")) {
        m_isSilent = false;
        fetchLatestRelease("ffmpeg");
    } else if (m_isSilent) {
        fetchLatestRelease("yt-dlp");
        QTimer::singleShot(2000, this, [this](){ fetchLatestRelease("ffmpeg"); });
    } else {
        hide();
        emit installationFinished();
    }
}

void InstallerWindow::fetchLatestRelease(const QString &appName) {
    m_currentApp = appName;
    QString repo = (appName == "yt-dlp") ? "yt-dlp/yt-dlp" : "GyanD/codexffmpeg";
    QUrl url(QString("https://api.github.com/repos/%1/releases/latest").arg(repo));

    QNetworkRequest request(url);
    auto *reply = netManager->get(request);
    connect(reply, &QNetworkReply::finished, this, &InstallerWindow::handleReleaseInfo);
}

void InstallerWindow::handleReleaseInfo() {
    auto *reply = qobject_cast<QNetworkReply*>(sender());
    reply->deleteLater();

    if (reply->error() != QNetworkReply::NoError) return;

    auto json = QJsonDocument::fromJson(reply->readAll()).object();
    QString remoteDate = json["published_at"].toString();
    if (remoteDate.isEmpty()) remoteDate = json["tag_name"].toString();

    QString localDate = getLocalVersion(m_currentApp);

    if (localDate == remoteDate && !m_isManual) {
        if (!m_isSilent) processNextStep();
        return;
    }

    if (m_isSilent && localDate != remoteDate && !localDate.isEmpty()) {
        if (m_popup) m_popup->showMessage("Update Available", "New version of " + m_currentApp + " is available.", Popup::Info, Popup::Permanent);
        return;
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
    }
}

void InstallerWindow::startDownload(const QString &appName, const QString &url, const QString &version) {
    m_remoteVersion = version;
    m_targetPath = getRequirementsPath() + (appName == "ffmpeg" ? "/ffmpeg.zip" : "/yt-dlp.exe");

    statusLabel->setText("Downloading " + appName + "...");
    if (!m_isSilent) show();

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
                processNextStep();
            }
        }
    }
    currentReply->deleteLater();
    currentReply = nullptr;
}

void InstallerWindow::extractFFmpeg(const QString &zipPath) {
    statusLabel->setText("Extracting FFmpeg...");
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
        processNextStep();
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