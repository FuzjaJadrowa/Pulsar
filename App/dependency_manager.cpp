#include "dependency_manager.h"
#include "config_manager.h"
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QFile>
#include <QDir>
#include <QProcess>
#include <QCoreApplication>

DependencyManager::DependencyManager(QObject *parent) : QObject(parent) {
    netManager = new QNetworkAccessManager(this);
}

void DependencyManager::checkUpdate(const QString &appName) {
    QString repo = (appName == "yt-dlp") ? "yt-dlp/yt-dlp" : "GyanD/codexffmpeg";
    QUrl url(QString("https://api.github.com/repos/%1/releases/latest").arg(repo));
    
    QNetworkRequest request(url);
    auto *reply = netManager->get(request);
    
    connect(reply, &QNetworkReply::finished, [this, appName, reply](){
        onReleaseInfoReceived(appName, reply);
    });
}

void DependencyManager::onReleaseInfoReceived(const QString &appName, QNetworkReply *reply) {
    reply->deleteLater();
    if (reply->error() != QNetworkReply::NoError) {
        emit statusChanged(appName, "Network Error", false);
        return;
    }

    auto json = QJsonDocument::fromJson(reply->readAll()).object();
    QString remoteDate = json["published_at"].toString();    if (remoteDate.isEmpty()) remoteDate = json["tag_name"].toString();

    QString localDate = getLocalVersionDate(appName);

    if (!localDate.isEmpty() && localDate == remoteDate) {
        emit statusChanged(appName, "No updates found", true);
        return;
    }

    emit logMessage(QString("Update found for %1: %2 -> %3").arg(appName, localDate, remoteDate));

    // Znajdź URL do pobrania
    QJsonArray assets = json["assets"].toArray();
    QString downloadUrl;
    QString fileName;
    
    for (const auto &val : assets) {
        QJsonObject asset = val.toObject();
        QString name = asset["name"].toString().toLower();
        
        if (appName == "yt-dlp" && name.contains("yt-dlp.exe")) {
            downloadUrl = asset["browser_download_url"].toString();
            fileName = "yt-dlp.exe";
            break;
        }
        if (appName == "ffmpeg" && name.contains("essentials_build") && name.endsWith(".zip")) {
            downloadUrl = asset["browser_download_url"].toString();
            fileName = "ffmpeg.zip";
            break;
        }
    }

    if (!downloadUrl.isEmpty()) {
        currentDownloadApp = appName;
        emit statusChanged(appName, "Downloading...", true);
        
        QString targetPath = QDir(ConfigManager::instance().getRequirementsPath()).filePath(fileName);
        QNetworkRequest req((QUrl(downloadUrl)));
        req.setAttribute(QNetworkRequest::RedirectPolicyAttribute, QNetworkRequest::NoLessSafeRedirectPolicy);
        
        auto *dlReply = netManager->get(req);
        connect(dlReply, &QNetworkReply::downloadProgress, this, &DependencyManager::onDownloadProgress);
        connect(dlReply, &QNetworkReply::finished, [this, appName, targetPath, remoteDate, dlReply](){
            dlReply->deleteLater();
            if (dlReply->error() == QNetworkReply::NoError) {
                QFile file(targetPath);
                if (file.open(QIODevice::WriteOnly)) {
                    file.write(dlReply->readAll());
                    file.close();
                    onDownloadFinished(appName, targetPath, remoteDate, targetPath.endsWith(".zip"));
                } else {
                    emit statusChanged(appName, "File Error", false);
                }
            } else {
                emit statusChanged(appName, "Download Error", false);
            }
        });
    } else {
        emit statusChanged(appName, "Asset not found", false);
    }
}

void DependencyManager::onDownloadProgress(qint64 bytesReceived, qint64 bytesTotal) {
}

void DependencyManager::onDownloadFinished(const QString &appName, const QString &filePath, const QString &versionDate, bool isZip) {
    if (isZip) {
        emit statusChanged(appName, "Extracting...", true);
        extractFFmpeg(filePath, versionDate);
    } else {
        setLocalVersionDate(appName, versionDate);
        emit statusChanged(appName, "Updated successfully", true);
    }
}

void DependencyManager::extractFFmpeg(const QString &zipPath, const QString &date) {
    QString destDir = ConfigManager::instance().getRequirementsPath();
    QString script = QString(
        "$ProgressPreference = 'SilentlyContinue'; "
        "Expand-Archive -Path '%1' -DestinationPath '%2/temp' -Force; "
        "Get-ChildItem -Path '%2/temp' -Filter *.exe -Recurse | Move-Item -Destination '%2' -Force; "
        "Remove-Item -Path '%2/temp' -Recurse -Force; "
        "Remove-Item -Path '%1' -Force"
    ).arg(zipPath, destDir);

    QProcess *process = new QProcess(this);
    connect(process, QOverload<int, QProcess::ExitStatus>::of(&QProcess::finished), 
            [this, process, date](int exitCode, QProcess::ExitStatus){
        process->deleteLater();
        if (exitCode == 0) {
            setLocalVersionDate("ffmpeg", date);
            emit statusChanged("ffmpeg", "Updated successfully", true);
        } else {
            emit statusChanged("ffmpeg", "Extraction Failed", false);
        }
    });
    
    process->start("powershell", QStringList() << "-Command" << script);
}

QString DependencyManager::getLocalVersionDate(const QString &appName) {
    QString jsonPath = QDir(ConfigManager::instance().getRequirementsPath()).filePath("requirements.json");
    QFile file(jsonPath);
    if (file.open(QIODevice::ReadOnly)) {
        return QJsonDocument::fromJson(file.readAll()).object()[appName].toString();
    }
    return "";
}

void DependencyManager::setLocalVersionDate(const QString &appName, const QString &date) {
    QString jsonPath = QDir(ConfigManager::instance().getRequirementsPath()).filePath("requirements.json");
    QJsonObject obj;
    QFile fileIn(jsonPath);
    if (fileIn.open(QIODevice::ReadOnly)) {
        obj = QJsonDocument::fromJson(fileIn.readAll()).object();
        fileIn.close();
    }
    obj[appName] = date;
    
    QFile fileOut(jsonPath);
    if (fileOut.open(QIODevice::WriteOnly)) {
        fileOut.write(QJsonDocument(obj).toJson());
    }
}