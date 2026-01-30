#include "downloader.h"
#include "config_manager.h"
#include <QRegularExpression>
#include <QStandardPaths>

Downloader::Downloader(QObject *parent) : QObject(parent), isStopped(false) {
    process = new QProcess(this);
    connect(process, QOverload<int, QProcess::ExitStatus>::of(&QProcess::finished), this, &Downloader::onProcessFinished);
    connect(process, &QProcess::readyReadStandardOutput, this, &Downloader::onReadyRead);
    connect(process, &QProcess::readyReadStandardError, this, &Downloader::onReadyRead);
}

static QString getBasePath() {
    QString basePath = QCoreApplication::applicationDirPath();
#ifdef Q_OS_MACOS
    QDir dir(basePath);
    dir.cdUp(); dir.cdUp(); dir.cdUp();
    basePath = dir.absolutePath();
#endif
    return basePath;
}

static QStringList buildArgsList(const QString &url, const QString &path, bool audioOnly,
                                 const QString &vFormat, const QString &vQuality,
                                 const QString &aFormat, const QString &aQuality,
                                 bool downloadSubs, const QString &subsLang, bool downloadChat,
                                 const QString &startTime, const QString &endTime,
                                 const QString &customArgs) {
    QStringList args;
    args << "--newline" << "--progress";

    QString requirementsPath = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation) + "/Requirements";
    QString ffmpegPath = requirementsPath + "/ffmpeg";
#ifdef Q_OS_WIN
    ffmpegPath += ".exe";
#endif
    args << "--ffmpeg-location" << ffmpegPath;

    if (!path.isEmpty()) {
        args << "-P" << path;
    }

    ConfigManager &config = ConfigManager::instance();

    if (config.getGeoBypass()) {
        args << "--geo-bypass";
    }

    if (audioOnly) {
        args << "-x";
        QString finalAFormat = (aFormat == "Default") ? config.getAudioFormat() : aFormat;
        args << "--audio-format" << finalAFormat;
        QString finalAQual = (aQuality == "Default") ? config.getAudioQuality() : aQuality;
        finalAQual.replace("kbps", "K", Qt::CaseInsensitive);
        args << "--audio-quality" << finalAQual;
    } else {
        QString finalVFormat = (vFormat == "Default") ? config.getVideoFormat() : vFormat;
        args << "--merge-output-format" << finalVFormat;
        QString finalVQual = (vQuality == "Default") ? config.getVideoQuality() : vQuality;
        finalVQual.replace("p", "", Qt::CaseInsensitive);
        args << "-S" << ("res:" + finalVQual);
    }

    if (downloadChat) {
        args << "--write-subs" << "--sub-lang" << "\"live_chat\"";
    } else if (downloadSubs) {
        if (subsLang.trimmed().isEmpty()) {
            args << "--write-auto-subs";
        } else {
            args << "--write-subs" << "--sub-lang" << ("\"" + subsLang.trimmed() + "\"");
        }
    }

    if (!startTime.isEmpty() && !endTime.isEmpty()) {
        args << "--download-sections" << QString("\"*%1-%2\"").arg(startTime, endTime);
        args << "--force-keyframes-at-cuts";
    }

    if (!customArgs.trimmed().isEmpty()) {
        args << customArgs.trimmed().split(" ", Qt::SkipEmptyParts);
    }

    args << url;
    return args;
}

void Downloader::startDownload(const QString &url, const QString &path, bool audioOnly,
                               const QString &vFormat, const QString &vQuality,
                               const QString &aFormat, const QString &aQuality,
                               bool downloadSubs, const QString &subsLang, bool downloadChat,
                               const QString &startTime, const QString &endTime,
                               const QString &customArgs) {
    if (process->state() != QProcess::NotRunning) return;
    isStopped = false;

    QString requirementsPath = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation) + "/Requirements";
    QString program = requirementsPath + "/yt-dlp";
#ifdef Q_OS_WIN
    program += ".exe";
#endif

    QStringList args = buildArgsList(url, path, audioOnly, vFormat, vQuality, aFormat, aQuality,
                                     downloadSubs, subsLang, downloadChat, startTime, endTime, customArgs);

    process->start(program, args);
    emit outputLog("Executing: " + program + " " + args.join(" "));
}

QString Downloader::generateCommand(const QString &url, const QString &path, bool audioOnly,
                                    const QString &vFormat, const QString &vQuality,
                                    const QString &aFormat, const QString &aQuality,
                                    bool downloadSubs, const QString &subsLang, bool downloadChat,
                                    const QString &startTime, const QString &endTime,
                                    const QString &customArgs) {
    return "yt-dlp " + buildArgsList(url, path, audioOnly, vFormat, vQuality, aFormat, aQuality,
                                     downloadSubs, subsLang, downloadChat, startTime, endTime, customArgs).join(" ");
}

void Downloader::stopDownload() {
    isStopped = true;
    process->kill();
}

void Downloader::onReadyRead() {
    QByteArray data = process->readAllStandardOutput();
    data.append(process->readAllStandardError());
    QString output = QString::fromLocal8Bit(data).trimmed();
    if (output.isEmpty()) return;

    static QRegularExpression re("(\\d+(\\.\\d+)?)%");
    auto match = re.match(output);
    if (match.hasMatch()) {
        double p = match.captured(1).toDouble();
        QString eta = "N/A";
        if (output.contains("ETA")) {
            QStringList parts = output.split("ETA");
            if (parts.length() > 1) {
                eta = parts.last().trimmed().split(" ").first();
            }
        }
        emit progressUpdated(p, eta);
    }
    emit outputLog(output);
}

void Downloader::onProcessFinished(int exitCode, QProcess::ExitStatus exitStatus) {
    if (isStopped) emit finished(false, "Download stopped by user.");
    else if (exitCode == 0) emit finished(true, "Download completed successfully!");
    else emit finished(false, "Error occurred. Check console for details.");
}