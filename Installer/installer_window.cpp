#include "installer_window.h"
#include <QVBoxLayout>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QProcess>
#include <QStyleFactory>
#include <QCloseEvent>
#include <QKeyEvent>
#include <QSysInfo>

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
    dir.cdUp();
    dir.cdUp();
    dir.cdUp();
    basePath = dir.absolutePath();
#endif

    QString path = basePath + "/Data/Requirements";
    QDir().mkpath(path);
    return path;
}

bool InstallerWindow::hasRequirements() {
    QString reqPath = getRequirementsPath();
    return QFile::exists(reqPath + "/" + getExecutableName("yt-dlp")) &&
           QFile::exists(reqPath + "/" + getExecutableName("ffmpeg"));
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
    statusLabel->setText("Checking info for " + appName + "...");

    QString repo;
    if (appName == "yt-dlp") repo = "yt-dlp/yt-dlp";
    else repo = "BtbN/FFmpeg-Builds";

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
    QString os = getOsName();

    for (const auto &val : assets) {
        QString name = val.toObject()["name"].toString().toLower();

        if (m_currentApp == "yt-dlp") {
            if (os == "win" && name == "yt-dlp.exe") {
                downloadUrl = val.toObject()["browser_download_url"].toString(); break;
            }
            if (os == "mac" && name == "yt-dlp_macos") {
                downloadUrl = val.toObject()["browser_download_url"].toString(); break;
            }
            if (os == "linux" && name == "yt-dlp_linux") {
                downloadUrl = val.toObject()["browser_download_url"].toString(); break;
            }
        }
        else if (m_currentApp == "ffmpeg") {
            if (os == "win" && name.contains("win64-gpl") && name.endsWith(".zip")) {
                downloadUrl = val.toObject()["browser_download_url"].toString(); break;
            }
            if (os == "linux" && name.contains("linux64-gpl") && name.endsWith(".tar.xz")) {
                downloadUrl = val.toObject()["browser_download_url"].toString(); break;
            }
            if (os == "mac" && (name.contains("macos") || name.contains("darwin")) && name.endsWith(".tar.xz")) {
               downloadUrl = val.toObject()["browser_download_url"].toString(); break;
            }
        }
    }

    if (!downloadUrl.isEmpty()) {
        startDownload(m_currentApp, downloadUrl, remoteDate);
    } else {
        m_installing = false;
        if(m_popup) m_popup->showMessage("Error", "No compatible version found for your OS.", Popup::Error, Popup::Permanent);
    }
}

void InstallerWindow::startDownload(const QString &appName, const QString &url, const QString &version) {
    m_remoteVersion = version;
    QString ext;
    if (url.endsWith(".zip")) ext = ".zip";
    else if (url.endsWith(".tar.xz")) ext = ".tar.xz";
    else ext = getExecutableName("");

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

            #ifndef Q_OS_WIN
            file.setPermissions(file.permissions() | QFile::ExeOwner | QFile::ExeUser | QFile::ExeGroup | QFile::ExeOther);
            #endif

            if (m_targetPath.endsWith(".zip") || m_targetPath.endsWith(".tar.xz")) {
                extractArchive(m_targetPath);
            } else {
                QString finalName = getRequirementsPath() + "/" + getExecutableName(m_currentApp);
                QFile::remove(finalName);
                if(file.rename(finalName)) {
                     #ifndef Q_OS_WIN
                         QFile(finalName).setPermissions(QFile::ReadOwner | QFile::WriteOwner | QFile::ExeOwner | QFile::ReadGroup | QFile::ExeGroup);
                     #endif

                     setLocalVersion(m_currentApp, m_remoteVersion);
                    if (m_isRepairMode) processNextRepairStep();
                    else {
                        m_installing = false;
                        if (m_popup) m_popup->showMessage("Success", m_currentApp + " updated successfully!", Popup::Success, Popup::Temporary);
                        accept();
                    }
                } else {
                     m_installing = false;
                     if(m_popup) m_popup->showMessage("Error", "File access error.", Popup::Error, Popup::Temporary);
                }
            }
        }
    } else {
        m_installing = false;
        if (m_popup) m_popup->showMessage("Error", "Download failed.", Popup::Error, Popup::Temporary);
    }
    currentReply->deleteLater();
    currentReply = nullptr;
}

void InstallerWindow::extractArchive(const QString &archivePath) {
    statusLabel->setText("Extracting " + m_currentApp + "...");
    progressBar->setValue(0);
    QString destDir = getRequirementsPath();

    auto *process = new QProcess(this);
    process->start("tar", {"-xf", archivePath, "-C", destDir});

    connect(process, QOverload<int, QProcess::ExitStatus>::of(&QProcess::finished), this, [this, process, archivePath, destDir]() {
        process->deleteLater();
        QFile::remove(archivePath);

        QDir dir(destDir);
        QStringList entries = dir.entryList(QDir::Dirs | QDir::NoDotAndDotDot);

        for(const auto &entry : entries) {
            if(entry.contains("ffmpeg", Qt::CaseInsensitive)) {
                QString sourceBinDir = destDir + "/" + entry + "/bin";

                if(QDir(sourceBinDir).exists()) {
                    QDir binDir(sourceBinDir);
                    QStringList files = binDir.entryList(QDir::Files);

                    for(const QString &fileName : files) {
                        QString srcPath = sourceBinDir + "/" + fileName;
                        QString dstPath = destDir + "/" + fileName;

                        if(QFile::exists(dstPath)) QFile::remove(dstPath);
                        if(QFile::copy(srcPath, dstPath)) {
                            #ifndef Q_OS_WIN
                            QFile(dstPath).setPermissions(QFile::ReadOwner | QFile::WriteOwner | QFile::ExeOwner | QFile::ReadGroup | QFile::ExeGroup);
                            #endif
                        }
                    }
                }
                else {
                    QString fullEntryPath = destDir + "/" + entry;
                    QDir srcDir(fullEntryPath);
                    QStringList files = srcDir.entryList(QDir::Files);
                    for(const QString &fileName : files) {
                        QString dstPath = destDir + "/" + fileName;
                        if(QFile::exists(dstPath)) QFile::remove(dstPath);
                        QFile::rename(fullEntryPath + "/" + fileName, dstPath);
                    }
                }

                QDir(destDir + "/" + entry).removeRecursively();
            }
        }

        setLocalVersion(m_currentApp, m_remoteVersion);
        if (m_isRepairMode) processNextRepairStep();
        else {
            m_installing = false;
            if (m_popup) m_popup->showMessage("Success", m_currentApp + " updated successfully!", Popup::Success, Popup::Temporary);
            accept();
        }
    });
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