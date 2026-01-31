#include "queue_panel.h"
#include <QPainter>
#include <QGraphicsBlurEffect>
#include <QPropertyAnimation>
#include <QTimer>
#include <QParallelAnimationGroup>

QueueItemWidget::QueueItemWidget(const QueueItem &item, QWidget *parent) : QWidget(parent), m_id(item.id) {
    setFixedSize(280, 100);  m_actionBtn = new AnimatedButton(item.isRunning ? "■" : "▶", this,
                                     item.isRunning ? QColor("#d32f2f") : QColor("#00e676"),
                                     item.isRunning ? QColor("#e57373") : QColor("#69f0ae"));
    m_actionBtn->setFixedSize(30, 30);
    m_actionBtn->move(200, 10);    QFont f = m_actionBtn->font();
    f.setPixelSize(14);
    m_actionBtn->setFont(f);

    m_btnDelete = new AnimatedButton("X", this, QColor("#444"), QColor("#666"));
    m_btnDelete->setFixedSize(30, 30);
    m_btnDelete->move(240, 10);
    f.setPixelSize(12);
    m_btnDelete->setFont(f);


    QString id = m_id;
    connect(m_actionBtn, &QPushButton::clicked, [id](){});
    connect(m_actionBtn, &QPushButton::clicked, [this, id](){
        if(m_actionBtn->text() == "■") QueueManager::instance().stopItem(id);
        else QueueManager::instance().startItem(id);
    });

    connect(m_btnDelete, &QPushButton::clicked, [this, id](){
        animateRemoval([id](){
            QueueManager::instance().removeItem(id);
        });
    });

    auto *mainLayout = new QVBoxLayout(this);
    mainLayout->setContentsMargins(15, 10, 80, 10);

    auto *title = new QLabel(item.title, this);
    title->setStyleSheet("font-weight: bold; color: white; background: transparent;");
    QFontMetrics fm(title->font());
    QString elided = fm.elidedText(item.title, Qt::ElideRight, 180);
    title->setText(elided);

    auto *fmt = new QLabel(item.formatInfo, this);
    fmt->setStyleSheet("color: #aaa; font-size: 11px; background: transparent;");

    mainLayout->addWidget(title);
    mainLayout->addWidget(fmt);
    mainLayout->addStretch();

    m_progressLabel = new QLabel(QString("%1%").arg(item.progress, 0, 'f', 1), this);
    m_progressLabel->setStyleSheet("color: #00e5ff; font-weight: bold; font-size: 12px; background: transparent;");
    m_progressLabel->setAlignment(Qt::AlignRight);
    m_progressLabel->setParent(this);
    m_progressLabel->setGeometry(220, 45, 50, 20);

    m_progressBg = new QWidget(this);
    m_progressBg->setFixedHeight(6);
    m_progressBg->setStyleSheet("background-color: #444; border-radius: 3px;");

    QVBoxLayout *pLayout = new QVBoxLayout();
    pLayout->addWidget(m_progressBg);
    mainLayout->addLayout(pLayout);

    m_progressBar = new QWidget(m_progressBg);
    m_progressBar->setFixedHeight(6);
    m_progressBar->setStyleSheet("background-color: #00e5ff; border-radius: 3px;");
    m_progressBar->setFixedWidth(0);

    updateProgress(item.progress);
    updateStatus(item.status);
}

void QueueItemWidget::paintEvent(QPaintEvent *e) {
    QPainter p(this);
    p.setRenderHint(QPainter::Antialiasing);
    p.setBrush(QColor(255, 255, 255, 15));
    p.setPen(Qt::NoPen);
    p.drawRoundedRect(rect(), 12, 12);
}

void QueueItemWidget::updateProgress(double p) {
    m_progressLabel->setText(QString("%1%").arg(p, 0, 'f', 1));
    if (m_progressBg->width() > 0) {
        int w = m_progressBg->width() * (p / 100.0);
        m_progressBar->setFixedWidth(w);
    }
}

void QueueItemWidget::updateStatus(const QString &s) {
    if (s == "Downloading") {
        m_actionBtn->setText("■");
        m_actionBtn->setBackgroundColor(QColor("#d32f2f"));
    } else {
        m_actionBtn->setText("▶");
        m_actionBtn->setBackgroundColor(QColor("#00e676"));
    }

    if (s == "Finished") {
        m_progressLabel->setText("✓");
        m_progressLabel->setStyleSheet("color: #00e676; font-weight: bold; background: transparent;");
        m_progressBar->setStyleSheet("background-color: #00e676; border-radius: 3px;");
        m_btnDelete->hide();
        m_actionBtn->hide();
    }
}

void QueueItemWidget::animateRemoval(std::function<void()> onFinished) {
    auto *group = new QParallelAnimationGroup(this);

    auto *animOpacity = new QPropertyAnimation(this, "windowOpacity");
    animOpacity->setDuration(300);
    animOpacity->setStartValue(1.0);
    animOpacity->setEndValue(0.0);

    auto *animHeight = new QPropertyAnimation(this, "minimumHeight");
    animHeight->setDuration(300);
    animHeight->setStartValue(height());
    animHeight->setEndValue(0);

    auto *animMaxHeight = new QPropertyAnimation(this, "maximumHeight");
    animMaxHeight->setDuration(300);
    animMaxHeight->setStartValue(height());
    animMaxHeight->setEndValue(0);

    group->addAnimation(animOpacity);
    group->addAnimation(animHeight);
    group->addAnimation(animMaxHeight);

    connect(group, &QAbstractAnimation::finished, [this, onFinished](){
        this->hide();
        if(onFinished) onFinished();
        this->deleteLater();
    });
    group->start(QAbstractAnimation::DeleteWhenStopped);
}

QueuePanel::QueuePanel(QWidget *parent) : QWidget(parent) {
    setFixedWidth(320);

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

    m_btnClear = new AnimatedButton("Clear Queue", this, QColor("#666"), QColor("#888"));
    m_btnClear->setFixedHeight(30);
    mainLayout->addWidget(m_btnClear);

    connect(m_btnStartAll, &QPushButton::clicked, this, &QueuePanel::onStartAll);
    connect(m_btnStopAll, &QPushButton::clicked, this, &QueuePanel::onStopAll);
    connect(m_btnClear, &QPushButton::clicked, this, &QueuePanel::onClearQueue);

    m_itemsContainer = new QWidget(this);
    m_itemsContainer->setStyleSheet("background: transparent;");
    m_itemsLayout = new QVBoxLayout(m_itemsContainer);
    m_itemsLayout->setContentsMargins(0, 5, 0, 5);
    m_itemsLayout->setSpacing(10);
    m_itemsLayout->setAlignment(Qt::AlignTop);

    mainLayout->addWidget(m_itemsContainer, 1);
    mainLayout->addStretch();

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
    m_btnPrev->setCursor(Qt::PointingHandCursor);
    m_btnNext->setCursor(Qt::PointingHandCursor);

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
    p.setBrush(QColor(30, 30, 30, 245));
    p.setPen(Qt::NoPen);
    p.drawRoundedRect(rect(), 15, 15);
}

void QueuePanel::refresh() {
    QLayoutItem *child;
    while ((child = m_itemsLayout->takeAt(0)) != nullptr) {
        if(child->widget()) delete child->widget();
        delete child;
    }

    auto items = QueueManager::instance().getItems();
    int total = items.size();
    if (total == 0) {
        auto *l = new QLabel("Queue is empty", this);
        l->setStyleSheet("color: #aaa; margin-top: 20px;");
        l->setAlignment(Qt::AlignCenter);
        m_itemsLayout->addWidget(l);
    }

    int totalPages = (total + ITEMS_PER_PAGE - 1) / ITEMS_PER_PAGE;
    if (totalPages == 0) totalPages = 1;
    if (m_currentPage >= totalPages) m_currentPage = totalPages - 1;

    int start = m_currentPage * ITEMS_PER_PAGE;
    int end = qMin(start + ITEMS_PER_PAGE, total);

    for(int i = start; i < end; ++i) {
        auto *w = new QueueItemWidget(items[i], m_itemsContainer);
        m_itemsLayout->addWidget(w);
    }

    m_itemsLayout->addStretch();

    updatePagination();

    bool running = false;
    for(auto i : items) if(i.isRunning) running = true;
    m_btnStopAll->setEnabled(running);
    m_btnStopAll->setBackgroundColor(running ? QColor("#d32f2f") : QColor("#555"));
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

    int count = widgets.size();
    int finished = 0;

    for(auto *w : widgets) {
        w->animateRemoval(nullptr);
    }

    QTimer::singleShot(300, [](){
        QueueManager::instance().clearQueue();
    });
}
void QueuePanel::nextPage() { m_currentPage++; refresh(); }
void QueuePanel::prevPage() { m_currentPage--; refresh(); }