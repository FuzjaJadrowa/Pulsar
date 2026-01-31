#include "queue_panel.h"
#include <QPainter>
#include <QPainterPath>
#include <QPropertyAnimation>
#include <QTimer>
#include <QParallelAnimationGroup>

QueueControlBtn::QueueControlBtn(Type type, QWidget *parent)
    : QPushButton(parent), m_type(type)
{
    setFixedSize(30, 30);
    setCursor(Qt::PointingHandCursor);
}

void QueueControlBtn::paintEvent(QPaintEvent *) {
    QPainter p(this);
    p.setRenderHint(QPainter::Antialiasing);

    QColor baseColor;
    QColor iconColor = Qt::white;

    if (m_type == Start) {
        baseColor = m_hover ? QColor("#00e676") : Qt::transparent;
        if (!m_hover) iconColor = QColor("#00e676");
    } else if (m_type == Stop) {
        baseColor = m_hover ? QColor("#d32f2f") : Qt::transparent;
        if (!m_hover) iconColor = QColor("#d32f2f");
    } else {
        baseColor = m_hover ? QColor(255, 255, 255, 40) : Qt::transparent;
        iconColor = m_hover ? QColor("#ff5252") : QColor("#888");
    }

    if (m_hover && m_type != Delete) iconColor = Qt::white;

    if (baseColor != Qt::transparent) {
        p.setBrush(baseColor);
        p.setPen(Qt::NoPen);
        if(m_type == Delete) p.drawRoundedRect(rect(), 4, 4);
        else p.drawEllipse(rect());
    }

    p.setPen(QPen(iconColor, 2));
    if (m_type == Delete) {
        p.drawLine(10, 10, 20, 20);
        p.drawLine(20, 10, 10, 20);
    } else if (m_type == Start) {
        QPainterPath path;
        path.moveTo(11, 8);
        path.lineTo(21, 15);
        path.lineTo(11, 22);
        path.closeSubpath();
        p.setBrush(iconColor);
        p.drawPath(path);
    } else if (m_type == Stop) {
        p.setBrush(iconColor);
        p.drawRect(10, 10, 10, 10);
    }
}

QueueItemWidget::QueueItemWidget(const QueueItem &item, QWidget *parent) : QWidget(parent), m_id(item.id) {
    setFixedSize(320, 90);

    QHBoxLayout *mainLayout = new QHBoxLayout(this);
    mainLayout->setContentsMargins(10, 10, 10, 10);
    mainLayout->setSpacing(10);

    m_actionBtn = new QueueControlBtn(item.isRunning ? QueueControlBtn::Stop : QueueControlBtn::Start, this);
    mainLayout->addWidget(m_actionBtn);

    QVBoxLayout *infoLayout = new QVBoxLayout();
    infoLayout->setSpacing(2);

    m_title = new QLabel(item.title, this);
    m_title->setStyleSheet("font-weight: bold; color: white; background: transparent;");
    QFontMetrics fm(m_title->font());
    QString elided = fm.elidedText(item.title, Qt::ElideRight, 180);
    m_title->setText(elided);
    infoLayout->addWidget(m_title);

    m_format = new QLabel(item.formatInfo, this);
    m_format->setStyleSheet("color: #aaa; font-size: 11px; background: transparent;");
    infoLayout->addWidget(m_format);

    m_progressBg = new QWidget(this);
    m_progressBg->setFixedHeight(4);
    m_progressBg->setStyleSheet("background-color: #444; border-radius: 2px;");

    m_progressBar = new QWidget(m_progressBg);
    m_progressBar->setFixedHeight(4);
    m_progressBar->setStyleSheet("background-color: #00e5ff; border-radius: 2px;");
    m_progressBar->setFixedWidth(0);

    infoLayout->addWidget(m_progressBg);
    infoLayout->addStretch();

    mainLayout->addLayout(infoLayout, 1);

    QVBoxLayout *rightLayout = new QVBoxLayout();
    rightLayout->setAlignment(Qt::AlignCenter);

    m_progressLabel = new QLabel(QString("%1%").arg(item.progress, 0, 'f', 0), this);
    m_progressLabel->setStyleSheet("color: #00e5ff; font-weight: bold; font-size: 12px; background: transparent;");
    m_progressLabel->setAlignment(Qt::AlignCenter);
    rightLayout->addWidget(m_progressLabel);

    m_btnDelete = new QueueControlBtn(QueueControlBtn::Delete, this);
    rightLayout->addWidget(m_btnDelete);

    mainLayout->addLayout(rightLayout);

    QString id = m_id;
    connect(m_actionBtn, &QPushButton::clicked, [this, id](){
        if(QueueManager::instance().getItems().isEmpty()) return;

        bool isRunning = false;
        for(const auto &i : QueueManager::instance().getItems()) {
            if(i.id == id && i.isRunning) isRunning = true;
        }

        if(isRunning) QueueManager::instance().stopItem(id);
        else QueueManager::instance().startItem(id, true);
    });

    connect(m_btnDelete, &QPushButton::clicked, [this, id](){
        animateRemoval([id](){
            QueueManager::instance().removeItem(id);
        });
    });

    updateProgress(item.progress);
    updateStatus(item.status);
}

void QueueItemWidget::paintEvent(QPaintEvent *e) {
    QPainter p(this);
    p.setRenderHint(QPainter::Antialiasing);
    p.setBrush(QColor(255, 255, 255, 10));
    p.setPen(Qt::NoPen);
    p.drawRoundedRect(rect(), 8, 8);
}

void QueueItemWidget::updateProgress(double p) {
    m_progressLabel->setText(QString("%1%").arg(p, 0, 'f', 0));
    if (m_progressBg->width() > 0) {
        int w = m_progressBg->width() * (p / 100.0);
        m_progressBar->setFixedWidth(w);
    }
}

void QueueItemWidget::updateStatus(const QString &s) {
    if (s == "Downloading") {
        delete m_actionBtn;
        m_actionBtn = new QueueControlBtn(QueueControlBtn::Stop, this);
        static_cast<QHBoxLayout*>(layout())->insertWidget(0, m_actionBtn);

        QString id = m_id;
        connect(m_actionBtn, &QPushButton::clicked, [id](){ QueueManager::instance().stopItem(id); });

    } else if (s == "Stopped" || s == "Queued" || s == "Error" || s == "Waiting...") {
        delete m_actionBtn;
        m_actionBtn = new QueueControlBtn(QueueControlBtn::Start, this);
         static_cast<QHBoxLayout*>(layout())->insertWidget(0, m_actionBtn);

         QString id = m_id;
         connect(m_actionBtn, &QPushButton::clicked, [id](){ QueueManager::instance().startItem(id, true); });
    }

    if (s == "Finished") {
        m_progressLabel->setText("✓");
        m_progressLabel->setStyleSheet("color: #00e676; font-weight: bold; background: transparent;");
        m_progressBar->setStyleSheet("background-color: #00e676; border-radius: 2px;");
        m_btnDelete->hide();
        if(m_actionBtn) m_actionBtn->hide();
    }
}

void QueueItemWidget::animateRemoval(std::function<void()> onFinished) {
    auto *group = new QParallelAnimationGroup(this);

    auto *animOpacity = new QPropertyAnimation(this, "windowOpacity");
    animOpacity->setDuration(250);
    animOpacity->setStartValue(1.0);
    animOpacity->setEndValue(0.0);

    auto *animHeight = new QPropertyAnimation(this, "maximumHeight");
    animHeight->setDuration(250);
    animHeight->setStartValue(height());
    animHeight->setEndValue(0);

    group->addAnimation(animOpacity);
    group->addAnimation(animHeight);

    connect(group, &QAbstractAnimation::finished, [this, onFinished](){
        this->hide();
        if(onFinished) onFinished();
    });
    group->start(QAbstractAnimation::DeleteWhenStopped);
}

QueuePanel::QueuePanel(QWidget *parent) : QWidget(parent) {
    setFixedWidth(340);
    auto *mainLayout = new QVBoxLayout(this);
    mainLayout->setContentsMargins(15, 15, 15, 15);
    mainLayout->setSpacing(10);

    auto *header = new QLabel("Queue", this);
    header->setAlignment(Qt::AlignCenter);
    header->setStyleSheet("font-size: 20px; font-weight: bold; color: white; font-family: 'Montserrat ExtraBold'; background: transparent;");
    mainLayout->addWidget(header);

    auto *ctrlLayout = new QHBoxLayout();
    m_btnStartAll = new AnimatedButton("Start All", this, QColor("#00e676"), QColor("#69f0ae"));
    m_btnStartAll->setFixedHeight(35);
    m_btnStopAll = new AnimatedButton("Stop All", this, QColor("#d32f2f"), QColor("#e57373"));
    m_btnStopAll->setFixedHeight(35);

    ctrlLayout->addWidget(m_btnStartAll);
    ctrlLayout->addWidget(m_btnStopAll);
    mainLayout->addLayout(ctrlLayout);

    m_btnClear = new AnimatedButton("Clear Queue", this, QColor("#444"), QColor("#666"));
    m_btnClear->setFixedHeight(30);
    mainLayout->addWidget(m_btnClear);

    connect(m_btnStartAll, &QPushButton::clicked, this, &QueuePanel::onStartAll);
    connect(m_btnStopAll, &QPushButton::clicked, this, &QueuePanel::onStopAll);
    connect(m_btnClear, &QPushButton::clicked, this, &QueuePanel::onClearQueue);

    m_itemsContainer = new QWidget(this);
    m_itemsContainer->setStyleSheet("background: transparent;");
    m_itemsLayout = new QVBoxLayout(m_itemsContainer);
    m_itemsLayout->setContentsMargins(0, 5, 0, 5);
    m_itemsLayout->setSpacing(8);
    m_itemsLayout->setAlignment(Qt::AlignTop);

    mainLayout->addWidget(m_itemsContainer, 1);

    auto *pageLayout = new QHBoxLayout();
    m_btnPrev = new QPushButton("<", this);
    m_btnNext = new QPushButton(">", this);
    m_pageLabel = new QLabel("1/1", this);

    QString pageBtnStyle =
        "QPushButton { background: transparent; color: white; font-size: 16px; border: none; font-weight: bold; }"
        "QPushButton:hover { color: #00e676; transform: scale(1.2); }"
        "QPushButton:disabled { color: #444; }";

    m_btnPrev->setStyleSheet(pageBtnStyle);
    m_btnNext->setStyleSheet(pageBtnStyle);
    m_pageLabel->setStyleSheet("color: #aaa; font-size: 12px; background: transparent;");

    connect(m_btnPrev, &QPushButton::clicked, this, &QueuePanel::prevPage);
    connect(m_btnNext, &QPushButton::clicked, this, &QueuePanel::nextPage);

    pageLayout->addStretch();
    pageLayout->addWidget(m_btnPrev);
    pageLayout->addWidget(m_pageLabel);
    pageLayout->addWidget(m_btnNext);
    pageLayout->addStretch();
    mainLayout->addLayout(pageLayout);

    connect(&QueueManager::instance(), &QueueManager::queueUpdated, this, &QueuePanel::refresh);

    connect(&QueueManager::instance(), &QueueManager::itemProgress, this, [this](QString id, double p){
        auto *w = findWidgetById(id);
        if(w) w->updateProgress(p);
    });

    connect(&QueueManager::instance(), &QueueManager::itemStatusChanged, this, [this](QString id, QString s){
        auto *w = findWidgetById(id);
        if(w) {
            w->updateStatus(s);
            if (s == "Finished") {
                QTimer::singleShot(1500, [this, id](){
                    removeWithAnimation(id);
                });
            }
        }
    });

    refresh();
}

QueueItemWidget* QueuePanel::findWidgetById(const QString &id) {
    for(auto *w : m_itemsContainer->findChildren<QueueItemWidget*>()) {
        if(w->getItemId() == id) return w;
    }
    return nullptr;
}

void QueuePanel::removeWithAnimation(const QString &id) {
    auto *w = findWidgetById(id);
    if (w) {
        w->animateRemoval([id](){
             QueueManager::instance().removeItem(id);
        });
    } else {
        QueueManager::instance().removeItem(id);
    }
}

void QueuePanel::paintEvent(QPaintEvent *e) {
    QPainter p(this);
    p.setRenderHint(QPainter::Antialiasing);
    p.setBrush(QColor(25, 25, 25, 250));
    p.setPen(Qt::NoPen);
    p.drawRoundedRect(rect(), 15, 15);
}

int QueuePanel::calculateContentHeight() const {
    int base = 160;
    int items = QueueManager::instance().getItems().size();
    if (items == 0) return base + 30;
    int onPage = qMin(items - (m_currentPage * ITEMS_PER_PAGE), ITEMS_PER_PAGE);
    if(onPage < 0) onPage = 0;
    return base + (onPage * 98);
}

void QueuePanel::refresh() {
    QLayoutItem *child;
    while ((child = m_itemsLayout->takeAt(0)) != nullptr) {
        if(child->widget()) {
            child->widget()->hide();
            child->widget()->deleteLater();
        }
        delete child;
    }

    auto items = QueueManager::instance().getItems();
    int total = items.size();

    bool anyRunning = false;
    for(auto i : items) if(i.isRunning) anyRunning = true;

    m_btnStopAll->setEnabled(anyRunning && !items.isEmpty());
    m_btnStopAll->setBackgroundColor(m_btnStopAll->isEnabled() ? QColor("#d32f2f") : QColor("#555"));

    m_btnStartAll->setEnabled(!items.isEmpty());
    m_btnStartAll->setBackgroundColor(!items.isEmpty() ? QColor("#00e676") : QColor("#555"));

    if (total == 0) {
        auto *l = new QLabel("Queue is empty", this);
        l->setStyleSheet("color: #aaa; margin-top: 20px;");
        l->setAlignment(Qt::AlignCenter);
        m_itemsLayout->addWidget(l);
    } else {
        int totalPages = (total + ITEMS_PER_PAGE - 1) / ITEMS_PER_PAGE;
        if (totalPages == 0) totalPages = 1;
        if (m_currentPage >= totalPages) m_currentPage = totalPages - 1;

        int start = m_currentPage * ITEMS_PER_PAGE;
        int end = qMin(start + ITEMS_PER_PAGE, total);

        for(int i = start; i < end; ++i) {
            auto *w = new QueueItemWidget(items[i], m_itemsContainer);
            m_itemsLayout->addWidget(w);
        }
    }

    m_itemsLayout->addStretch();
    updatePagination();
}

void QueuePanel::updatePagination() {
    int total = QueueManager::instance().getItems().size();
    int totalPages = (total + ITEMS_PER_PAGE - 1) / ITEMS_PER_PAGE;
    if(totalPages == 0) totalPages = 1;

    m_pageLabel->setText(QString("%1/%2").arg(m_currentPage + 1).arg(totalPages));
    m_btnPrev->setVisible(totalPages > 1);
    m_btnNext->setVisible(totalPages > 1);
    m_btnPrev->setEnabled(m_currentPage > 0);
    m_btnNext->setEnabled(m_currentPage < totalPages - 1);
    m_pageLabel->setVisible(totalPages > 1);
}

void QueuePanel::onStartAll() { QueueManager::instance().startAll(); refresh(); }
void QueuePanel::onStopAll() { QueueManager::instance().stopAll(); refresh(); }
void QueuePanel::onClearQueue() {
    auto widgets = m_itemsContainer->findChildren<QueueItemWidget*>();
    if (widgets.isEmpty()) {
        QueueManager::instance().clearQueue();
        return;
    }
    for(auto *w : widgets) {
        w->animateRemoval(nullptr);
    }
    QTimer::singleShot(300, [](){
        QueueManager::instance().clearQueue();
    });
}
void QueuePanel::nextPage() { m_currentPage++; refresh(); }
void QueuePanel::prevPage() { m_currentPage--; refresh(); }