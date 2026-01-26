#include "app_updater.h"
#include <QStandardPaths>

AppUpdater::AppUpdater(Popup *popup, QObject *parent)
    : QObject(parent), m_popup(popup) {
    m_netManager = new QNetworkAccessManager(this);
}

qint64 AppUpdater::getLastAppCheckTime() {
    QFile file(getVersionsFilePath());
    if (file.open(QIODevice::ReadOnly)) {
        return QJsonDocument::fromJson(file.readAll()).object()["app_last_check"].toVariant().toLongLong();
    }
    return 0;
}

void AppUpdater::setLastAppCheckTime() {
    QString path = getVersionsFilePath();
    QJsonObject obj;
    QFile fileIn(path);
    if (fileIn.open(QIODevice::ReadOnly)) {
        obj = QJsonDocument::fromJson(fileIn.readAll()).object();
        fileIn.close();
    }
    obj["app_last_check"] = QDateTime::currentSecsSinceEpoch();
    QFile fileOut(path);
    if (fileOut.open(QIODevice::WriteOnly)) {
        fileOut.write(QJsonDocument(obj).toJson());
    }
}

QString AppUpdater::getVersionsFilePath() {
    return QStandardPaths::writableLocation(QStandardPaths::AppDataLocation) + "/Requirements/versions.json";
}

void AppUpdater::checkForAppUpdates(bool manual) {
    m_isManual = manual;
    if (!manual) {
        qint64 lastCheck = getLastAppCheckTime();
        if (QDateTime::currentSecsSinceEpoch() - lastCheck < 1800) return;
    }
    setLastAppCheckTime();
    QNetworkRequest request((QUrl(REPO_URL)));
    m_reply = m_netManager->get(request);
    connect(m_reply, &QNetworkReply::finished, this, &AppUpdater::onVersionReceived);
}

void AppUpdater::onVersionReceived() {
    if (m_reply->error() != QNetworkReply::NoError) {
        if (m_isManual) m_popup->showMessage("Error", "Could not check for app updates.", Popup::Error, Popup::Temporary);
        m_reply->deleteLater();
        return;
    }

    QJsonObject json = QJsonDocument::fromJson(m_reply->readAll()).object();
    m_reply->deleteLater();

    m_newVersion = json["tag_name"].toString();
    if (m_newVersion.isEmpty() || m_newVersion == CURRENT_VERSION) {
        if (m_isManual) m_popup->showMessage("Info", "GVD is up to date.", Popup::Info, Popup::Temporary);
        return;
    }

    QJsonArray assets = json["assets"].toArray();
    for (const auto &asset : assets) {
        QString name = asset.toObject()["name"].toString();

#ifdef Q_OS_WIN
        if (name.contains("win64") && name.endsWith(".zip")) {
            m_downloadUrl = asset.toObject()["browser_download_url"].toString();
            m_downloadFileName = "update.zip";
            break;
        }
#elif defined(Q_OS_MAC)
        if (name.contains("Darwin") && name.endsWith(".zip")) {
            m_downloadUrl = asset.toObject()["browser_download_url"].toString();
            m_downloadFileName = "update.zip";
            break;
        }
#elif defined(Q_OS_LINUX)
        if (name.contains("Linux") && (name.endsWith(".tar.gz") || name.endsWith(".tgz"))) {
            m_downloadUrl = asset.toObject()["browser_download_url"].toString();
            m_downloadFileName = "update.tar.gz";
            break;
        }
#endif
    }

    if (!m_downloadUrl.isEmpty()) emit updateAvailable(m_newVersion);
}

void AppUpdater::startAppUpdate() {
    m_popup->showMessage("Updating...", "Downloading update package.", Popup::Info, Popup::Temporary);
    QNetworkRequest request((QUrl(m_downloadUrl)));
    request.setAttribute(QNetworkRequest::RedirectPolicyAttribute, QNetworkRequest::NoLessSafeRedirectPolicy);
    m_reply = m_netManager->get(request);
    connect(m_reply, &QNetworkReply::downloadProgress, this, &AppUpdater::onDownloadProgress);
    connect(m_reply, &QNetworkReply::finished, this, &AppUpdater::onDownloadFinished);
}

void AppUpdater::onDownloadProgress(qint64 rx, qint64 total) {
    if (total > 0) emit downloadProgress(static_cast<int>((rx * 100) / total));
}

void AppUpdater::onDownloadFinished() {
    if (m_reply->error() != QNetworkReply::NoError) {
        m_popup->showMessage("Error", "Update download failed.", Popup::Error, Popup::Temporary);
        m_reply->deleteLater();
        return;
    }

    QString tempPath = QStandardPaths::writableLocation(QStandardPaths::TempLocation) + "/" + m_downloadFileName;
    QFile file(tempPath);
    if (file.open(QIODevice::WriteOnly)) {
        file.write(m_reply->readAll());
        file.close();
        m_reply->deleteLater();
        applyUpdate(tempPath);
    } else {
        m_popup->showMessage("Error", "Could not save update file.", Popup::Error, Popup::Temporary);
    }
}

void AppUpdater::applyUpdate(const QString &archivePath) {
    QString currentAppDir = QCoreApplication::applicationDirPath();

#ifdef Q_OS_MACOS
    QDir dir(currentAppDir);
    dir.cdUp(); dir.cdUp(); dir.cdUp();
    currentAppDir = dir.absolutePath();
    #endif

    QString tempExtractDir = QStandardPaths::writableLocation(QStandardPaths::TempLocation) + "/GVD_Update_Extracted";
    QString nativeArchive = QDir::toNativeSeparators(archivePath);
    QString nativeAppDir = QDir::toNativeSeparators(currentAppDir);
    QString nativeTempDir = QDir::toNativeSeparators(tempExtractDir);

#ifdef Q_OS_WIN
    QString updaterPath = QDir::tempPath() + "/gvd_updater.bat";
    QFile script(updaterPath);
    if (script.open(QIODevice::WriteOnly | QIODevice::Text)) {
        QTextStream out(&script);
        out << "@echo off\n"
            << "title Updating GUI Video Downloader...\n"
            << "echo Waiting for application to close...\n"
            << "timeout /t 2 /nobreak > nul\n"

            << "if exist \"" << nativeTempDir << "\" rmdir /s /q \"" << nativeTempDir << "\"\n"
            << "mkdir \"" << nativeTempDir << "\"\n"

            << "echo Extracting update...\n"
            << "powershell -command \"Expand-Archive -Path '" << nativeArchive << "' -DestinationPath '" << nativeTempDir << "' -Force\"\n"

            << "echo Installing files...\n"
            << "powershell -command \"$subDir = Get-ChildItem -Path '" << nativeTempDir << "' -Directory | Select-Object -First 1; Get-ChildItem -Path $subDir.FullName | Where-Object { $_.Name -ne 'Data' } | Copy-Item -Destination '" << nativeAppDir << "' -Recurse -Force\"\n"

            << "del /f /q \"" << nativeArchive << "\"\n"
            << "rmdir /s /q \"" << nativeTempDir << "\"\n"
            << "start \"\" \"" << nativeAppDir << "\\App.exe\"\n"
            << "del \"%~f0\"\n";

        script.close();
        QString psCommand = QString("Start-Process -FilePath \"cmd.exe\" -ArgumentList \"/c\", \"\\\"%1\\\"\" -Verb RunAs").arg(updaterPath);
        QProcess::startDetached("powershell", {"-Command", psCommand});
        QCoreApplication::quit();
    }
#else
    QString updaterPath = QDir::tempPath() + "/gvd_updater.sh";
    QFile script(updaterPath);
    if (script.open(QIODevice::WriteOnly | QIODevice::Text)) {
        QTextStream out(&script);
        out << "#!/bin/bash\n"
            << "sleep 2\n"
            << "rm -rf \"" << nativeTempDir << "\"\n"
            << "mkdir -p \"" << nativeTempDir << "\"\n"

            << "if [[ \"" << m_downloadFileName << "\" == *\".zip\" ]]; then\n"
            << "  unzip -o -q \"" << nativeArchive << "\" -d \"" << nativeTempDir << "\"\n"
            << "else\n"
            << "  tar -xf \"" << nativeArchive << "\" -C \"" << nativeTempDir << "\"\n"
            << "fi\n"

            << "cd \"" << nativeTempDir << "\"/*\n"
            << "for f in *; do\n"
            << "  if [ \"$f\" != \"Data\" ]; then\n"
            << "    cp -rf \"$f\" \"" << nativeAppDir << "/\"\n"
            << "  fi\n"
            << "done\n"

            << "rm \"" << nativeArchive << "\"\n"
            << "rm -rf \"" << nativeTempDir << "\"\n"

            #ifdef Q_OS_MACOS
             << "open \"" << nativeAppDir << "\"\n"
#else
            << "chmod +x \"" << nativeAppDir << "/App\"\n"
            << "\"" << nativeAppDir << "/App\" &\n"
#endif
            << "rm \"$0\"\n";

        script.close();
        QProcess::execute("chmod", {"+x", updaterPath});
        QProcess::startDetached("/bin/bash", {updaterPath});
        QCoreApplication::quit();
    }
#endif
}