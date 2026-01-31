#include "queue_manager.h"
#include <QDateTime>
#include <QUuid>

QueueManager& QueueManager::instance() {
    static QueueManager inst;
    return inst;
}

QueueManager::QueueManager() {
    loadQueue();
}

void QueueManager::loadQueue() {
    QString path = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation) + "/queue.json";
    QFile file(path);
    if (file.open(QIODevice::ReadOnly)) {
        QJsonDocument doc = QJsonDocument::fromJson(file.readAll());
        QJsonArray arr = doc.array();
        m_queue.clear();
        for (const auto &val : arr) {
            QueueItem item = jsonToItem(val.toObject());
            if(item.status == "Downloading") item.status = "Stopped";
            item.isRunning = false;
            m_queue.append(item);
        }
    }
}

void QueueManager::saveQueue() {
    QString path = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation) + "/queue.json";
    QJsonArray arr;
    for (const auto &item : m_queue) {
        arr.append(itemToJson(item));
    }
    QFile file(path);
    if (file.open(QIODevice::WriteOnly)) {
        file.write(QJsonDocument(arr).toJson());
    }
}

void QueueManager::clearQueue() {
    stopAll();
    m_queue.clear();
    saveQueue();
    emit queueUpdated();
}

void QueueManager::addItem(const QueueItem &item) {
    m_queue.append(item);
    saveQueue();
    emit queueUpdated();
}

void QueueManager::removeItem(const QString &id) {
    stopItem(id);
    for (int i = 0; i < m_queue.size(); ++i) {
        if (m_queue[i].id == id) {
            m_queue.removeAt(i);
            break;
        }
    }
    saveQueue();
    emit queueUpdated();
}

void QueueManager::startItem(const QString &id) {
    QueueItem *target = nullptr;
    for (int i = 0; i < m_queue.size(); ++i) {
        if (m_queue[i].id == id) {
            target = &m_queue[i];
            break;
        }
    }
    if (!target || target->isRunning) return;

    target->isRunning = true;
    target->status = "Downloading";
    emit itemStatusChanged(id, "Downloading");

    Downloader *dl = new Downloader(this);
    m_activeDownloaders[id] = dl;

    connect(dl, &Downloader::outputLog, this, &QueueManager::logMessage);

    connect(dl, &Downloader::progressUpdated, this, [this, id](double p, QString eta){
        for(auto &it : m_queue) {
            if(it.id == id) { it.progress = p; break; }
        }
        emit itemProgress(id, p);
    });

    connect(dl, &Downloader::finished, this, [this, id](bool ok, QString msg){
        QString title;
        if (m_activeDownloaders.contains(id)) {
            m_activeDownloaders[id]->deleteLater();
            m_activeDownloaders.remove(id);
        }
        for(auto &it : m_queue) {
            if(it.id == id) {
                title = it.title;
                it.isRunning = false;
                it.status = ok ? "Finished" : "Error";
                it.progress = ok ? 100.0 : it.progress;
                break;
            }
        }
        emit itemStatusChanged(id, ok ? "Finished" : "Error");

        if(!title.isEmpty()) emit itemFinished(title, ok);

        saveQueue();

        if (m_isSequentialMode) {
            processNext();
        }
    });

    dl->startDownload(target->url, target->path, target->audioOnly,
                      target->vFormat, target->vQuality, target->aFormat, target->aQuality,
                      target->dlSubs, target->subLang, target->dlChat,
                      target->timeStart, target->timeEnd, target->customArgs);
}

void QueueManager::stopItem(const QString &id) {
    if (m_activeDownloaders.contains(id)) {
        m_activeDownloaders[id]->stopDownload();
    }
}

void QueueManager::startAll() {
    m_isSequentialMode = true;
    processNext();
}

void QueueManager::stopAll() {
    m_isSequentialMode = false;
    for (auto key : m_activeDownloaders.keys()) {
        stopItem(key);
    }
}

void QueueManager::processNext() {
    if (!m_isSequentialMode) return;

    for (const auto &item : m_queue) {
        if (item.status == "Downloading") return;
    }

    for (const auto &item : m_queue) {
        if (item.status != "Finished" && item.status != "Downloading") {
            startItem(item.id);
            return;
        }
    }

    m_isSequentialMode = false;
    emit allFinished();
}

void QueueManager::fetchAndAdd(const QString &url, const QueueItem &partial, bool autoStart) {
    Downloader *tempDl = new Downloader(this);
    connect(tempDl, &Downloader::titleFetched, this, [this, tempDl, partial, autoStart](const QString&, const QString &title){
        QueueItem item = partial;
        item.title = title;
        if(item.title.isEmpty()) item.title = item.url;
        item.id = QUuid::createUuid().toString();
        item.status = "Queued";
        addItem(item);
        if(autoStart) {
            startItem(item.id);
        }
        tempDl->deleteLater();
    });
    connect(tempDl, &Downloader::finished, this, [this, tempDl, partial, autoStart](bool ok, QString){
        if(!ok) {
             QueueItem item = partial;
             item.title = item.url;
             item.id = QUuid::createUuid().toString();
             item.status = "Queued";
             addItem(item);
             if(autoStart) {
                 startItem(item.id);
             }
        }
        tempDl->deleteLater();
    });
    
    tempDl->fetchTitle(url);
}

QList<QueueItem> QueueManager::getItems() const { return m_queue; }
bool QueueManager::isEmpty() const { return m_queue.isEmpty(); }

QJsonObject QueueManager::itemToJson(const QueueItem &item) {
    QJsonObject obj;
    obj["id"] = item.id;
    obj["title"] = item.title;
    obj["url"] = item.url;
    obj["path"] = item.path;
    obj["info"] = item.formatInfo;
    obj["status"] = item.status;
    obj["progress"] = item.progress;
    
    obj["audioOnly"] = item.audioOnly;
    obj["vFormat"] = item.vFormat; obj["vQuality"] = item.vQuality;
    obj["aFormat"] = item.aFormat; obj["aQuality"] = item.aQuality;
    obj["dlSubs"] = item.dlSubs; obj["subLang"] = item.subLang;
    obj["dlChat"] = item.dlChat;
    obj["timeStart"] = item.timeStart; obj["timeEnd"] = item.timeEnd;
    obj["customArgs"] = item.customArgs;
    return obj;
}

QueueItem QueueManager::jsonToItem(const QJsonObject &obj) {
    QueueItem item;
    item.id = obj["id"].toString();
    item.title = obj["title"].toString();
    item.url = obj["url"].toString();
    item.path = obj["path"].toString();
    item.formatInfo = obj["info"].toString();
    item.status = obj["status"].toString();
    item.progress = obj["progress"].toDouble();
    
    item.audioOnly = obj["audioOnly"].toBool();
    item.vFormat = obj["vFormat"].toString(); item.vQuality = obj["vQuality"].toString();
    item.aFormat = obj["aFormat"].toString(); item.aQuality = obj["aQuality"].toString();
    item.dlSubs = obj["dlSubs"].toBool(); item.subLang = obj["subLang"].toString();
    item.dlChat = obj["dlChat"].toBool();
    item.timeStart = obj["timeStart"].toString(); item.timeEnd = obj["timeEnd"].toString();
    item.customArgs = obj["customArgs"].toString();
    return item;
}