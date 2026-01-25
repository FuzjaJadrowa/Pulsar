#ifndef DOWNLOADER_H
#define DOWNLOADER_H

#include <QObject>
#include <QProcess>
#include <QDir>

class Downloader : public QObject {
    Q_OBJECT
public:
    explicit Downloader(QObject *parent = nullptr);

    void startDownload(const QString &url, const QString &path, bool audioOnly,
                       const QString &vFormat, const QString &vQuality,
                       const QString &aFormat, const QString &aQuality,
                       bool downloadSubs, const QString &subsLang, bool downloadChat,
                       const QString &startTime, const QString &endTime,
                       const QString &customArgs);

    void stopDownload();

    // Funkcja generująca tekst komendy (do podglądu)
    QString generateCommand(const QString &url, const QString &path, bool audioOnly,
                            const QString &vFormat, const QString &vQuality,
                            const QString &aFormat, const QString &aQuality,
                            bool downloadSubs, const QString &subsLang, bool downloadChat,
                            const QString &startTime, const QString &endTime,
                            const QString &customArgs);

    signals:
        void progressUpdated(double percent, const QString &eta);
    void finished(bool ok, const QString &msg);
    void outputLog(const QString &msg);

private slots:
    void onProcessFinished(int exitCode, QProcess::ExitStatus exitStatus);
    void onReadyRead();

private:
    QProcess *process;
    bool isStopped;
};

#endif