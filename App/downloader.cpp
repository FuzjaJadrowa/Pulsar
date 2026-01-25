#include "downloader.h"
#include "config_manager.h"
#include <QDir>
#include <QCoreApplication>

Downloader::Downloader(QObject *parent) : QObject(parent) {
    process = new QProcess(this);
    connect(process, &QProcess::readyReadStandardOutput, this, &Downloader::handleOutput);
    connect(process, &QProcess::readyReadStandardError, this, &Downloader::handleOutput);
    connect(process, QOverload<int, QProcess::ExitStatus>::of(&QProcess::finished), this, &Downloader::handleFinished);
}

QString Downloader::getYtDlpPath() const {
    return QDir(ConfigManager::instance().getRequirementsPath()).filePath("yt-dlp.exe");
}

QString Downloader::getFfmpegPath() const {
    return QDir(ConfigManager::instance().getRequirementsPath()).filePath("ffmpeg.exe");
}

void Downloader::startDownload(const QString &url, const QString &path,
                               bool audioOnly,
                               const QString &vFormat, const QString &vQuality,
                               const QString &aFormat, const QString &aQuality) {
    if (process->state() != QProcess::NotRunning) {
        emit finished(false, "Process is already running.");
        return;
    }

    if (url.isEmpty()) {
        emit finished(false, "No link provided.");
        return;
    }

    if (path.isEmpty()) {
        emit finished(false, "No download path provided.");
        return;
    }

    QStringList args;
    args << "--ffmpeg-location" << getFfmpegPath();
    args << "-P" << path;

    QString effVFormat = (vFormat == "Default") ? ConfigManager::instance().getVideoFormat() : vFormat;
    QString effVQuality = (vQuality == "Default") ? ConfigManager::instance().getVideoQuality() : vQuality;
    QString effAFormat = (aFormat == "Default") ? ConfigManager::instance().getAudioFormat() : aFormat;
    QString effAQuality = (aQuality == "Default") ? ConfigManager::instance().getAudioQuality() : aQuality;

    if (audioOnly) {
        args << "-x";
        if (effAFormat.toLower() != "default") {
            args << "--audio-format" << effAFormat.toLower();
        }
        if (effAQuality.toLower() != "default") {
            QString q = effAQuality;
            q.replace("kbps", "K", Qt::CaseInsensitive);
            args << "--audio-quality" << q;
        }
    } else {
        if (effVFormat.toLower() != "default") {
            args << "--merge-output-format" << effVFormat.toLower();
        }
        if (effVQuality.toLower() != "default") {
            QString res = effVQuality;
            res.replace("p", "", Qt::CaseInsensitive);
            args << "-S" << "res:" + res;
        }
    }

    args << url;

    process->setProgram(getYtDlpPath());
    process->setArguments(args);
    process->start();
}

void Downloader::stopDownload() {
    if (process->state() != QProcess::NotRunning) {
        process->kill();
    }
}

void Downloader::handleOutput() {
    QByteArray data = process->readAllStandardOutput();
    QByteArray err = process->readAllStandardError();
    QString output = QString::fromLocal8Bit(data) + QString::fromLocal8Bit(err);
    QStringList lines = output.split('\n', Qt::SkipEmptyParts);
    for (const QString &line : lines) {
        emit outputLog(line.trimmed());
    }
}

void Downloader::handleFinished(int exitCode, QProcess::ExitStatus exitStatus) {
    if (exitStatus == QProcess::NormalExit && exitCode == 0) {
        emit finished(true, "Download completed successfully!");
    } else if (exitStatus == QProcess::CrashExit) {
        emit finished(false, "Download stopped or crashed.");
    } else {
        emit finished(false, "Download failed. Check logs.");
    }
}