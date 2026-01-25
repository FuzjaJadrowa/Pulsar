#ifndef DOWNLOADER_H
#define DOWNLOADER_H

#include <QObject>
#include <QProcess>

class Downloader : public QObject {
    Q_OBJECT
public:
    explicit Downloader(QObject *parent = nullptr);

    void startDownload(const QString &url, const QString &path,
                       bool audioOnly,
                       const QString &vFormat, const QString &vQuality,
                       const QString &aFormat, const QString &aQuality);

    void stopDownload();

    signals:
        void outputLog(const QString &line);
    void finished(bool success, const QString &message);

private slots:
    void handleOutput();
    void handleFinished(int exitCode, QProcess::ExitStatus exitStatus);

private:
    QProcess *process;
    QString getYtDlpPath() const;
    QString getFfmpegPath() const;
};

#endif