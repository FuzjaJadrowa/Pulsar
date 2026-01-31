#include "splash_screen.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QStyleOption>
#include <QPainterPath>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QStandardPaths>
#include <QCoreApplication>
#include <QDir>
#include <QProcess>
#include <QDateTime>
#include <QTextStream>
#include <QApplication>

LoadingSpinner::LoadingSpinner(QWidget *parent) : QWidget(parent), m_angle(0) {
    setFixedSize(50, 50);
    m_timer = new QTimer(this);
    connect(m_timer, &QTimer::timeout, this, [this]() {
        m_angle = (m_angle + 10) % 360;
        update();
    });
}

void LoadingSpinner::start() { m_timer->start(30); }
void LoadingSpinner::stop() { m_timer->stop(); }

void LoadingSpinner::paintEvent(QPaintEvent *) {
    QPainter p(this);
    p.setRenderHint(QPainter::Antialiasing);
    int side = qMin(width(), height());
    p.translate(width() / 2, height() / 2);
    p.rotate(m_angle);

    QPen pen;
    pen.setWidth(4);
    pen.setColor(QColor(138, 43, 226));    pen.setCapStyle(Qt::RoundCap);
    p.setPen(pen);

    p.drawArc(-side/2 + 4, -side/2 + 4, side - 8, side - 8, 0, 270 * 16);
}

SplashScreen::SplashScreen(QWidget *parent) : QWidget(parent) {
    setWindowFlags(Qt::Window | Qt::FramelessWindowHint | Qt::WindowStaysOnTopHint);
    setAttribute(Qt::WA_TranslucentBackground);
    setFixedSize(1000, 700); // Rozmiar zgodny z Container

    QVBoxLayout *mainLayout = new QVBoxLayout(this);
    mainLayout->setContentsMargins(20, 20, 20, 20);
    mainLayout->setAlignment(Qt::AlignCenter);

    m_spinner = new LoadingSpinner(this);
    m_spinner->start();

    m_statusLabel = new QLabel("Starting...", this);
    m_statusLabel->setStyleSheet("font-size: 16px; font-weight: bold; color: #ffffff; margin-top: 15px;");
    m_statusLabel->setAlignment(Qt::AlignCenter);

    m_progressLabel = new QLabel("", this);
    m_progressLabel->setStyleSheet("font-size: 12px; color: #aaaaaa; margin-top: 5px;");
    m_progressLabel->setAlignment(Qt::AlignCenter);

    mainLayout->addStretch();
    mainLayout->addWidget(m_spinner, 0, Qt::AlignCenter);
    mainLayout->addWidget(m_statusLabel);
    mainLayout->addWidget(m_progressLabel);
    mainLayout->addStretch();

    m_netManager = new QNetworkAccessManager(this);
}

void SplashScreen::paintEvent(QPaintEvent *event) {
    QPainter p(this);
    p.setRenderHint(QPainter::Antialiasing);

    // Rysowanie tła w stylu głównego okna (#121212) z ramką (#333)
    p.setBrush(QColor("#121212"));
    p.setPen(QPen(QColor("#333333"), 1));
    p.drawRoundedRect(rect().adjusted(1,1,-1,-1), 15, 15);
}

void SplashScreen::startProcess() {
    show();
    checkAppUpdate();
}

void SplashScreen::checkAppUpdate() {
    m_statusLabel->setText("Checking for updates...");

    qint64 lastCheck = getLastCheckTime("app_last_check");
    if (QDateTime::currentSecsSinceEpoch() - lastCheck < 1800) {
        checkRequirements();
        return;
    }

    QNetworkRequest request((QUrl(APP_REPO_URL)));
    m_reply = m_netManager->get(request);
    connect(m_reply, &QNetworkReply::finished, this, &SplashScreen::onAppVersionReceived);
}

void SplashScreen::onAppVersionReceived() {
    setLastCheckTime("app_last_check");

    if (m_reply->error() != QNetworkReply::NoError) {
        m_reply->deleteLater();
        checkRequirements();
        return;
    }

    QJsonObject json = QJsonDocument::fromJson(m_reply->readAll()).object();
    m_reply->deleteLater();

    QString remoteVer = json["tag_name"].toString();
    if (remoteVer.isEmpty() || remoteVer == APP_VERSION) {
        checkRequirements();
        return;
    }

    m_isAppUpdate = true;
    m_newVersion = remoteVer;

    QJsonArray assets = json["assets"].toArray();
    m_downloadUrl = "";

    for (const auto &asset : assets) {
        QString name = asset.toObject()["name"].toString();
#ifdef Q_OS_WIN
        if (name.contains("win64") && name.endsWith(".zip")) {
            m_downloadUrl = asset.toObject()["browser_download_url"].toString();
            m_downloadFileName = "update.zip";
            break;
        }
#elif defined(Q_OS_MAC)
        if (name.contains("MacOS") && name.endsWith(".zip")) {
            m_downloadUrl = asset.toObject()["browser_download_url"].toString();
            m_downloadFileName = "update.zip";
            break;
        }
#else
        if (name.contains("Linux") && (name.endsWith(".tar.gz") || name.endsWith(".tgz"))) {
            m_downloadUrl = asset.toObject()["browser_download_url"].toString();
            m_downloadFileName = "update.tar.gz";
            break;
        }
#endif
    }

    if (!m_downloadUrl.isEmpty()) {
        m_statusLabel->setText("Updating app to " + remoteVer);
        downloadFile(m_downloadUrl, QStandardPaths::writableLocation(QStandardPaths::TempLocation) + "/" + m_downloadFileName);
    } else {
        checkRequirements();
    }
}

void SplashScreen::applyAppUpdate(const QString &archivePath) {
    m_statusLabel->setText("Applying update...");

    QString currentAppDir = QCoreApplication::applicationDirPath();
    QString nativeArchive = QDir::toNativeSeparators(archivePath);
    QString nativeAppDir = QDir::toNativeSeparators(currentAppDir);
    QString tempExtractDir = QDir::toNativeSeparators(QStandardPaths::writableLocation(QStandardPaths::TempLocation) + "/GVD_Update_Extracted");

#ifdef Q_OS_MACOS
    QDir dir(currentAppDir);
    dir.cdUp(); dir.cdUp();
    QString appBundlePath = dir.absolutePath();
    dir.cdUp();
    nativeAppDir = dir.absolutePath();
#endif

#ifdef Q_OS_WIN
    QString updaterPath = QDir::tempPath() + "/gvd_updater.bat";
    QFile script(updaterPath);
    if (script.open(QIODevice::WriteOnly | QIODevice::Text)) {
        QTextStream out(&script);
        out << "@echo off\n"
            << "chcp 65001 > nul\n"
            << "timeout /t 2 /nobreak > nul\n"
            << "if exist \"" << tempExtractDir << "\" rmdir /s /q \"" << tempExtractDir << "\"\n"
            << "mkdir \"" << tempExtractDir << "\"\n"
            << "powershell -command \"Expand-Archive -Path '" << nativeArchive << "' -DestinationPath '" << tempExtractDir << "' -Force\"\n"
            << "powershell -command \"$subDir = Get-ChildItem -Path '" << tempExtractDir << "' -Directory | Select-Object -First 1; Get-ChildItem -Path $subDir.FullName | Where-Object { $_.Name -ne 'Data' } | Copy-Item -Destination '" << nativeAppDir << "' -Recurse -Force\"\n"
            << "rmdir /s /q \"" << tempExtractDir << "\"\n"
            << "del /f /q \"" << nativeArchive << "\"\n"
            << "start \"\" \"" << nativeAppDir << "\\Pulsar.exe\"\n"
            << "del \"%~f0\"\n";
        script.close();

        QString psCommand = QString("Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', '\"%1\"' -Verb RunAs -WindowStyle Hidden").arg(updaterPath);
        QProcess::startDetached("powershell", {"-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", psCommand});
        QCoreApplication::quit();
    }
#else
    QString updaterPath = QDir::tempPath() + "/gvd_updater.sh";
    QFile script(updaterPath);
    if (script.open(QIODevice::WriteOnly | QIODevice::Text)) {
        QTextStream out(&script);
        out << "#!/bin/bash\n"
            << "sleep 2\n"
            << "rm -rf \"" << tempExtractDir << "\"\n"
            << "mkdir -p \"" << tempExtractDir << "\"\n";

#ifdef Q_OS_MACOS
        out << "unzip -o -q \"" << nativeArchive << "\" -d \"" << tempExtractDir << "\"\n"
            << "NEW_APP=$(find \"" << tempExtractDir << "\" -name \"*.app\" -maxdepth 2 | head -n 1)\n"
            << "rm -rf \"" << appBundlePath << "\"\n"
            << "mv \"$NEW_APP\" \"" << nativeAppDir << "/\"\n"
            << "open -n \"" << appBundlePath << "\"\n";
#else
        out << "tar -xf \"" << nativeArchive << "\" -C \"" << tempExtractDir << "\"\n"
            << "SUBDIR=$(find \"" << tempExtractDir << "\" -maxdepth 1 -type d ! -path \"" << tempExtractDir << "\" | head -n 1)\n"
            << "cp -rf \"$SUBDIR\"/* \"" << nativeAppDir << "/\"\n"
            << "chmod +x \"" << nativeAppDir << "/Pulsar\"\n"
            << "nohup \"" << nativeAppDir << "/Pulsar\" > /dev/null 2>&1 &\n";
#endif
        out << "rm -rf \"" << tempExtractDir << "\"\n"
            << "rm \"" << nativeArchive << "\"\n"
            << "rm \"$0\"\n";
        script.close();
        QProcess::execute("chmod", {"+x", updaterPath});
        QProcess::startDetached("/bin/bash", {updaterPath});
        QCoreApplication::quit();
    }
#endif
}

void SplashScreen::checkRequirements() {
    m_isAppUpdate = false;
    checkNextRequirement();
}

void SplashScreen::checkNextRequirement() {
    QString reqPath = getRequirementsPath();

    if (!QFile::exists(reqPath + "/" + getExecutableName("yt-dlp"))) {
        m_currentAction = "yt-dlp";
        fetchReqInfo("yt-dlp");
    } else if (!QFile::exists(reqPath + "/" + getExecutableName("ffmpeg"))) {
        m_currentAction = "ffmpeg";
        fetchReqInfo("ffmpeg");
    } else {
        qint64 lastCheck = getLastCheckTime("req_last_check");
        if (QDateTime::currentSecsSinceEpoch() - lastCheck > 86400) {
             setLastCheckTime("req_last_check");
        }

        m_statusLabel->setText("Starting...");
        m_spinner->stop();
        emit finished();
    }
}

void SplashScreen::fetchReqInfo(const QString &appName) {
    m_statusLabel->setText("Checking " + appName + "...");

    QString repo = (appName == "yt-dlp") ? "yt-dlp/yt-dlp" : "BtbN/FFmpeg-Builds";
    QUrl url(QString("https://api.github.com/repos/%1/releases/latest").arg(repo));

    m_reply = m_netManager->get(QNetworkRequest(url));
    connect(m_reply, &QNetworkReply::finished, this, &SplashScreen::onReqVersionReceived);
}

void SplashScreen::onReqVersionReceived() {
    if (m_reply->error() != QNetworkReply::NoError) {
        m_reply->deleteLater();
        m_statusLabel->setText("Network Error!");
        return;
    }

    auto json = QJsonDocument::fromJson(m_reply->readAll()).object();
    m_reply->deleteLater();

    m_remoteVersion = json["published_at"].toString();
    QJsonArray assets = json["assets"].toArray();
    QString downloadUrl;
    QString os = getOsName();

    for (const auto &val : assets) {
        QString name = val.toObject()["name"].toString().toLower();
        if (m_currentAction == "yt-dlp") {
            if (os == "win" && name == "yt-dlp.exe") {
                downloadUrl = val.toObject()["browser_download_url"].toString(); break;
            } else if (os == "mac" && name == "yt-dlp_macos") {
                downloadUrl = val.toObject()["browser_download_url"].toString(); break;
            } else if (os == "linux" && name == "yt-dlp") {
                downloadUrl = val.toObject()["browser_download_url"].toString(); break;
            }
        } else if (m_currentAction == "ffmpeg") {
            if (os == "win" && name.contains("win64-gpl") && name.endsWith(".zip")) {
                downloadUrl = val.toObject()["browser_download_url"].toString(); break;
            }
        }
    }

    if (!downloadUrl.isEmpty()) {
        m_statusLabel->setText("Downloading " + m_currentAction + "...");
        QString ext = downloadUrl.endsWith(".zip") ? ".zip" : (downloadUrl.endsWith(".tar.xz") ? ".tar.xz" : "");
        if(ext.isEmpty()) ext = getExecutableName("");

        downloadFile(downloadUrl, getRequirementsPath() + "/" + m_currentAction + "_temp" + ext);
    } else {
        checkNextRequirement();
    }
}

void SplashScreen::downloadFile(const QString &url, const QString &destName) {
    m_targetPath = destName;
    QNetworkRequest req((QUrl(url)));
    req.setAttribute(QNetworkRequest::RedirectPolicyAttribute, QNetworkRequest::NoLessSafeRedirectPolicy);

    m_reply = m_netManager->get(req);
    connect(m_reply, &QNetworkReply::downloadProgress, this, &SplashScreen::onDownloadProgress);
    connect(m_reply, &QNetworkReply::finished, this, &SplashScreen::onDownloadFinished);
}

void SplashScreen::onDownloadProgress(qint64 rx, qint64 total) {
    if (total > 0) {
        double downloadedMB = rx / (1024.0 * 1024.0);
        double totalMB = total / (1024.0 * 1024.0);
        m_progressLabel->setText(QString("%1 MB / %2 MB").arg(downloadedMB, 0, 'f', 2).arg(totalMB, 0, 'f', 2));
    }
}

void SplashScreen::onDownloadFinished() {
    m_progressLabel->setText("");
    if (m_reply->error() == QNetworkReply::NoError) {
        QFile file(m_targetPath);
        if (file.open(QIODevice::WriteOnly)) {
            file.write(m_reply->readAll());
            file.close();

            if (m_isAppUpdate) {
                applyAppUpdate(m_targetPath);
            } else {
                if (m_targetPath.endsWith(".zip") || m_targetPath.endsWith(".tar.xz")) {
                    extractArchive(m_targetPath, getRequirementsPath());
                } else {
                    QString finalName = getRequirementsPath() + "/" + getExecutableName(m_currentAction);
                    QFile::remove(finalName);
                    file.rename(finalName);
                    setLocalVersion(m_currentAction, m_remoteVersion);
                    checkNextRequirement();
                }
            }
        }
    }
    m_reply->deleteLater();
    m_reply = nullptr;
}

void SplashScreen::extractArchive(const QString &archivePath, const QString &destDir) {
    m_statusLabel->setText("Extracting...");

    auto *process = new QProcess(this);
#ifdef Q_OS_WIN
     if (archivePath.endsWith(".zip")) {
         QString cmd = QString("Expand-Archive -Path '%1' -DestinationPath '%2' -Force").arg(archivePath, destDir);
         process->start("powershell", {"-command", cmd});
     } else {
         process->start("tar", {"-xf", archivePath, "-C", destDir});
     }
#else
    process->start("tar", {"-xf", archivePath, "-C", destDir});
#endif

    connect(process, QOverload<int, QProcess::ExitStatus>::of(&QProcess::finished), this, [this, process, archivePath, destDir]() {
        process->deleteLater();
        QFile::remove(archivePath);

        if (m_currentAction == "ffmpeg") {
            QDir dir(destDir);
            QStringList entries = dir.entryList(QDir::Dirs | QDir::NoDotAndDotDot);
            for(const auto &entry : entries) {
                if (entry.contains("ffmpeg", Qt::CaseInsensitive)) {
                    QString subDir = destDir + "/" + entry;
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
        }

        setLocalVersion(m_currentAction, m_remoteVersion);
        checkNextRequirement();
    });
}

QString SplashScreen::getRequirementsPath() {
    QString path = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation) + "/Requirements";
    QDir().mkpath(path);
    return path;
}

QString SplashScreen::getExecutableName(const QString &baseName) {
#ifdef Q_OS_WIN
    return baseName.isEmpty() ? ".exe" : baseName + ".exe";
#else
    return baseName;
#endif
}

QString SplashScreen::getOsName() {
#ifdef Q_OS_WIN
    return "win";
#elif defined(Q_OS_MACOS)
    return "mac";
#else
    return "linux";
#endif
}

qint64 SplashScreen::getLastCheckTime(const QString &key) {
    QFile file(getRequirementsPath() + "/versions.json");
    if (file.open(QIODevice::ReadOnly)) {
        return QJsonDocument::fromJson(file.readAll()).object()[key].toVariant().toLongLong();
    }
    return 0;
}

void SplashScreen::setLastCheckTime(const QString &key) {
    QString path = getRequirementsPath() + "/versions.json";
    QJsonObject obj;
    QFile fileIn(path);
    if (fileIn.open(QIODevice::ReadOnly)) { obj = QJsonDocument::fromJson(fileIn.readAll()).object(); fileIn.close(); }

    obj[key] = QDateTime::currentSecsSinceEpoch();

    QFile fileOut(path);
    if (fileOut.open(QIODevice::WriteOnly)) fileOut.write(QJsonDocument(obj).toJson());
}

void SplashScreen::setLocalVersion(const QString &appName, const QString &version) {
    QString path = getRequirementsPath() + "/versions.json";
    QJsonObject obj;
    QFile fileIn(path);
    if (fileIn.open(QIODevice::ReadOnly)) { obj = QJsonDocument::fromJson(fileIn.readAll()).object(); fileIn.close(); }

    obj[appName] = version;

    QFile fileOut(path);
    if (fileOut.open(QIODevice::WriteOnly)) fileOut.write(QJsonDocument(obj).toJson());
}