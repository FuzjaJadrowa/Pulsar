#ifndef QUEUE_MANAGER_H
#define QUEUE_MANAGER_H

#include <QObject>
#include <QJsonArray>
#include <QJsonObject>
#include <QJsonDocument>
#include <QFile>
#include <QStandardPaths>
#include <QDir>
#include "downloader.h"

struct QueueItem {
    QString id;
    QString title;
    QString url;
    QString path;
    QString formatInfo;

    bool audioOnly;
    QString vFormat, vQuality, aFormat, aQuality;
    bool dlSubs, dlChat;
    QString subLang;
    QString timeStart, timeEnd, customArgs;

    double progress = 0.0;
    QString status;
    bool isRunning = false;
};

class QueueManager : public QObject {
    Q_OBJECT
public:
    static QueueManager& instance();

    void addItem(const QueueItem &item);
    void removeItem(const QString &id);
    void clearQueue();
    void startItem(const QString &id);
    void stopItem(const QString &id);
    void startAll();
    void stopAll();

    QList<QueueItem> getItems() const;
    bool isEmpty() const;
    void fetchAndAdd(const QString &url, const QueueItem &partialItem, bool autoStart = false);

    signals:
        void queueUpdated();
    void itemProgress(const QString &id, double progress);
    void itemStatusChanged(const QString &id, const QString &status);
    void allFinished();
    void itemFinished(const QString &title, bool success);
    void logMessage(const QString &msg);

private:
    QueueManager();
    void loadQueue();
    void saveQueue();
    void processNext();

    QList<QueueItem> m_queue;
    QMap<QString, Downloader*> m_activeDownloaders;
    bool m_isSequentialMode = false;

    QJsonObject itemToJson(const QueueItem &item);
    QueueItem jsonToItem(const QJsonObject &obj);
};

#endif