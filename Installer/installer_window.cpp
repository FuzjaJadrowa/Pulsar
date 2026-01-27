#include "installer_window.h"
#include <QVBoxLayout>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QProcess>
#include <QStyleFactory>
#include <QCloseEvent>
#include <QKeyEvent>
#include <QStandardPaths>
#include <QSysInfo>

InstallerWindow::InstallerWindow(Popup *popup, QWidget *parent)
    : QDialog(parent), m_popup(popup) {
    setWindowTitle("GVD Requirements Installer");
    setFixedSize(450, 150);
    setModal(true);
    setWindowFlags(Qt::Window | Qt::WindowTitleHint | Qt::CustomizeWindowHint);
    this->setStyleSheet("background-color: #ffffff; color: #000000;");

    auto *layout = new QVBoxLayout(this);
    statusLabel = new QLabel("Initializing...", this);
    statusLabel->setAlignment(Qt::AlignCenter);
    statusLabel->setStyleSheet("color: #000000;");

    progressBar = new QProgressBar(this);
    progressBar->setFixedHeight(25);
    progressBar->setStyle(QStyleFactory::create("windowsvista"));
    progressBar->setAlignment(Qt::AlignCenter);
    progressBar->setTextVisible(false);
    progressBar->setStyleSheet("QProgressBar { border: 1px solid #CCCCCC; background: #E6E6E6; }");

    layout->addStretch();
    layout->addWidget(statusLabel);
    layout->addWidget(progressBar);
    layout->addStretch();

    netManager = new QNetworkAccessManager(this);
}

void InstallerWindow::closeEvent(QCloseEvent *event) {
    if (m_installing) event->ignore();
    else event->accept();
}

void InstallerWindow::keyPressEvent(QKeyEvent *event) {
    if (event->key() == Qt::Key_F4 && (event->modifiers() & Qt::AltModifier)) {
        if (!m_installing) reject();
        event->accept();
    } else {
        QDialog::keyPressEvent(event);
    }
}

QString InstallerWindow::getOsName() {
#ifdef Q_OS_WIN
    return "win";
#elif defined(Q_OS_MACOS)
    return "mac";
#else
    return "linux";
#endif
}

QString InstallerWindow::getExecutableName(const QString &baseName) {
#ifdef Q_OS_WIN
    return baseName + ".exe";
#else
    return baseName;
#endif
}

QString InstallerWindow::getRequirementsPath() {
    QString basePath = QCoreApplication::applicationDirPath();
#ifdef Q_OS_MACOS
    QDir dir(basePath);
    dir.cdUp(); dir.cdUp(); dir.cdUp();
    basePath = dir.absolutePath();
#endif
    QString path = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation) + "/Requirements";
    QDir().mkpath(path);
    return path;
}

bool InstallerWindow::hasRequirements() {
    QString reqPath = getRequirementsPath();
    return QFile::exists(reqPath + "/" + getExecutableName("yt-dlp")) &&
           QFile::exists(reqPath + "/" + getExecutableName("ffmpeg"));
}

void InstallerWindow::startMissingFileDownload() {
    m_isRepairMode = true;
    m_isManualCheck = false;
    m_installing = true;
    show();
    processNextRepairStep();
}

void InstallerWindow::checkForUpdates(const QString &appName, bool manual) {
    m_isRepairMode = false;
    m_isManualCheck = manual;
    m_installing = false;
    fetchLatestRelease(appName);
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
    if (!QFile::exists(reqPath + "/" + getExecutableName("yt-dlp"))) {
        fetchLatestRelease("yt-dlp");
    } else if (!QFile::exists(reqPath + "/" + getExecutableName("ffmpeg"))) {
        fetchLatestRelease("ffmpeg");
    } else {
        m_installing = false;
        accept();
    }
}

void InstallerWindow::fetchLatestRelease(const QString &appName) {
    m_currentApp = appName;

    if (!m_isManualCheck && !m_isRepairMode && !m_installing) {
        qint64 lastCheck = getLastCheckTime(appName);
        qint64 currentTime = QDateTime::currentSecsSinceEpoch();
        if (currentTime - lastCheck < 600) {
            if (appName == "yt-dlp") fetchLatestRelease("ffmpeg");
            return;
        }
    }

    QString repo = (appName == "yt-dlp") ? "yt-dlp/yt-dlp" : "BtbN/FFmpeg-Builds";
    QUrl url(QString("https://api.github.com/repos/%1/releases/latest").arg(repo));
    QNetworkRequest request(url);
    auto *reply = netManager->get(request);
    connect(reply, &QNetworkReply::finished, this, &InstallerWindow::handleReleaseInfo);
}

void InstallerWindow::handleReleaseInfo() {
    auto *reply = qobject_cast<QNetworkReply*>(sender());
    if (!reply) return;

    if (reply->error() != QNetworkReply::NoError) {
        int statusCode = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        bool isRateLimit = (statusCode == 403 || statusCode == 429);
        m_installing = false;
        if (!m_isRepairMode) hide();
        reply->deleteLater();
        if (isRateLimit) { if (m_isManualCheck) emit networkError(true); }
        else { emit networkError(false); }
        return;
    }

    auto json = QJsonDocument::fromJson(reply->readAll()).object();
    reply->deleteLater();

    QString remoteDate = json["published_at"].toString();
    if (remoteDate.isEmpty()) remoteDate = json["tag_name"].toString();

    QString localDate = getLocalVersion(m_currentApp);
    bool updateNeeded = (localDate != remoteDate);

    setLocalVersion(m_currentApp, localDate);

    if (!m_installing) {
        if (!updateNeeded) {
            if (m_isManualCheck) emit upToDate(m_currentApp);
            else if (m_currentApp == "yt-dlp") fetchLatestRelease("ffmpeg");
            return;
        } else {
            emit updateAvailable(m_currentApp);
            return;
        }
    }

    QJsonArray assets = json["assets"].toArray();
    QString downloadUrl;
    QString os = getOsName();

    for (const auto &val : assets) {
        QString name = val.toObject()["name"].toString().toLower();
        if (m_currentApp == "yt-dlp") {
            if (os == "win" && name == "yt-dlp.exe") { downloadUrl = val.toObject()["browser_download_url"].toString(); break; }
        } else if (m_currentApp == "ffmpeg") {
            if (os == "win" && name.contains("win64-gpl") && name.endsWith(".zip")) { downloadUrl = val.toObject()["browser_download_url"].toString(); break; }
        }
    }

    if (!downloadUrl.isEmpty()) {
        startDownload(m_currentApp, downloadUrl, remoteDate);
    } else {
        m_installing = false;
        if(m_popup) m_popup->showMessage("Error", "No compatible version found.", Popup::Error, Popup::Permanent);
    }
}

void InstallerWindow::startDownload(const QString &appName, const QString &url, const QString &version) {
    m_remoteVersion = version;
    QString ext = url.endsWith(".zip") ? ".zip" : (url.endsWith(".tar.xz") ? ".tar.xz" : getExecutableName(""));
    m_targetPath = getRequirementsPath() + "/" + appName + "_temp" + ext;
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
            if (m_targetPath.endsWith(".zip") || m_targetPath.endsWith(".tar.xz")) {
                extractArchive(m_targetPath);
            } else {
                QString finalName = getRequirementsPath() + "/" + getExecutableName(m_currentApp);
                QFile::remove(finalName);
                if(file.rename(finalName)) {
                    setLocalVersion(m_currentApp, m_remoteVersion);
                    if (m_isRepairMode) processNextRepairStep();
                    else { m_installing = false; accept(); }
                }
            }
        }
    }
    currentReply->deleteLater();
    currentReply = nullptr;
}

void InstallerWindow::extractArchive(const QString &archivePath) {
    statusLabel->setText("Extracting " + m_currentApp + "...");
    QString destDir = getRequirementsPath();
    auto *process = new QProcess(this);
    process->start("tar", {"-xf", archivePath, "-C", destDir});

    connect(process, QOverload<int, QProcess::ExitStatus>::of(&QProcess::finished), this, [this, process, archivePath, destDir]() {
        process->deleteLater();
        QFile::remove(archivePath);

        QDir dir(destDir);
        QStringList entries = dir.entryList(QDir::Dirs | QDir::NoDotAndDotDot);
        for(const auto &entry : entries) {
            QString subDir = destDir + "/" + entry;
            if (m_currentApp == "ffmpeg" && entry.contains("ffmpeg", Qt::CaseInsensitive)) {
                QDir binDir(subDir + "/bin");
                if (binDir.exists()) {
                    for (const QString &f : binDir.entryList(QDir::Files)) {
                        QFile::remove(destDir + "/" + f);
                        QFile::rename(subDir + "/bin/" + f, destDir + "/" + f);
                    }
                }
                QDir(subDir).removeRecursively();
            }
        }

        setLocalVersion(m_currentApp, m_remoteVersion);
        if (m_isRepairMode) processNextRepairStep();
        else { m_installing = false; accept(); }
    });
}

QString InstallerWindow::getLocalVersion(const QString &appName) {
    QFile file(getRequirementsPath() + "/versions.json");
    if (file.open(QIODevice::ReadOnly)) return QJsonDocument::fromJson(file.readAll()).object()[appName].toString();
    return "";
}

qint64 InstallerWindow::getLastCheckTime(const QString &appName) {
    QFile file(getRequirementsPath() + "/versions.json");
    if (file.open(QIODevice::ReadOnly)) {
        return QJsonDocument::fromJson(file.readAll()).object()[appName + "_last_check"].toVariant().toLongLong();
    }
    return 0;
}

void InstallerWindow::setLocalVersion(const QString &appName, const QString &version) {
    QString path = getRequirementsPath() + "/versions.json";
    QJsonObject obj;
    QFile fileIn(path);
    if (fileIn.open(QIODevice::ReadOnly)) { obj = QJsonDocument::fromJson(fileIn.readAll()).object(); fileIn.close(); }

    if (!version.isEmpty()) obj[appName] = version;
    obj[appName + "_last_check"] = QDateTime::currentSecsSinceEpoch();

    QFile fileOut(path);
    if (fileOut.open(QIODevice::WriteOnly)) fileOut.write(QJsonDocument(obj).toJson());
}