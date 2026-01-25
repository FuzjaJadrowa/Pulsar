#include "app_updater.h"

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
    return QCoreApplication::applicationDirPath() + "/Data/Requirements/versions.json";
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
        if (name.endsWith(".exe")) {
            m_downloadUrl = asset.toObject()["browser_download_url"].toString();
            break;
        }
    }
    if (!m_downloadUrl.isEmpty()) emit updateAvailable(m_newVersion);
}

void AppUpdater::startAppUpdate() {
    m_popup->showMessage("Updating...", "Downloading new version of GVD.", Popup::Info, Popup::Temporary);
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
        m_popup->showMessage("Error", "App download failed.", Popup::Error, Popup::Temporary);
        m_reply->deleteLater();
        return;
    }
    QString tempPath = QCoreApplication::applicationDirPath() + "/GVD_new.exe";
    QFile file(tempPath);
    if (file.open(QIODevice::WriteOnly)) {
        file.write(m_reply->readAll());
        file.close();
        m_reply->deleteLater();
        applyUpdateWindows(tempPath);
    }
}

void AppUpdater::applyUpdateWindows(const QString &tempPath) {
    QString currentPath = QCoreApplication::applicationFilePath();
    QString updaterPath = QDir::tempPath() + "/gvd_updater.bat";
    QFile script(updaterPath);
    if (script.open(QIODevice::WriteOnly | QIODevice::Text)) {
        QTextStream out(&script);
        out << "@echo off\n"
            << "timeout /t 2 /nobreak > nul\n"
            << "del /f /q \"" << QDir::toNativeSeparators(currentPath) << "\"\n"
            << "move /y \"" << QDir::toNativeSeparators(tempPath) << "\" \"" << QDir::toNativeSeparators(currentPath) << "\"\n"
            << "start \"\" \"" << QDir::toNativeSeparators(currentPath) << "\"\n"
            << "del \"%~f0\"\n";
        script.close();
        QProcess::startDetached("cmd.exe", {"/c", updaterPath});
        QCoreApplication::quit();
    }
}