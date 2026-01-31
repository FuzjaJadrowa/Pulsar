#include "container.h"
#include "downloader_page.h"
#include "settings_page.h"
#include "console_page.h"
#include "../Core/config_manager.h"
#include "../Core/downloader.h"

#include <QPainter>
#include <QPainterPath>
#include <QApplication>
#include <QTimer>
#include <QWindow>
#include <QSystemTrayIcon>

#ifdef Q_OS_WIN
#include <windows.h>
#include <windowsx.h>
#include <dwmapi.h>
#pragma comment(lib, "dwmapi.lib")
#endif

NavButton::NavButton(const QString &text, const QString &iconPath, bool isExpandable, QWidget *parent)
    : QPushButton(parent), m_isExpandable(isExpandable), m_text(text)
{
    m_icon = QPixmap(iconPath);
    setCursor(Qt::PointingHandCursor);
    m_backgroundColor = Qt::transparent;
    m_borderColor = Qt::transparent;
    setFixedWidth(m_isExpandable ? 50 : 110);
    setFixedHeight(40);
}
void NavButton::setActive(bool active) {
    m_isActive = active;
    auto *group = new QParallelAnimationGroup(this);
    auto *bgAnim = new QPropertyAnimation(this, "backgroundColor");
    bgAnim->setDuration(200);
    bgAnim->setStartValue(m_backgroundColor);
    bgAnim->setEndValue(active ? QColor(138, 43, 226) : QColor(Qt::transparent));
    auto *borderAnim = new QPropertyAnimation(this, "borderColor");
    borderAnim->setDuration(200);
    borderAnim->setStartValue(m_borderColor);
    borderAnim->setEndValue(active ? QColor(138, 43, 226) : QColor(Qt::transparent));
    group->addAnimation(bgAnim);
    group->addAnimation(borderAnim);
    if (m_isExpandable) {
        auto *widthAnim = new QPropertyAnimation(this, "fixedWidth");
        widthAnim->setDuration(300);
        widthAnim->setEasingCurve(QEasingCurve::OutBack);
        widthAnim->setStartValue(width());
        widthAnim->setEndValue(active ? 130 : 50);
        group->addAnimation(widthAnim);
    }
    group->start(QAbstractAnimation::DeleteWhenStopped);
}
void NavButton::enterEvent(QEnterEvent *event) {
    if (m_isActive) return;
    auto *anim = new QPropertyAnimation(this, "borderColor");
    anim->setDuration(200);
    anim->setStartValue(m_borderColor);
    anim->setEndValue(QColor(138, 43, 226));
    anim->start(QAbstractAnimation::DeleteWhenStopped);
    if (m_isExpandable) {
        auto *widthAnim = new QPropertyAnimation(this, "fixedWidth");
        widthAnim->setDuration(300);
        widthAnim->setEasingCurve(QEasingCurve::OutCubic);
        widthAnim->setStartValue(width());
        widthAnim->setEndValue(130);
        widthAnim->start(QAbstractAnimation::DeleteWhenStopped);
    }
    QPushButton::enterEvent(event);
}
void NavButton::leaveEvent(QEvent *event) {
    if (m_isActive) return;
    auto *anim = new QPropertyAnimation(this, "borderColor");
    anim->setDuration(200);
    anim->setStartValue(m_borderColor);
    anim->setEndValue(QColor(Qt::transparent));
    anim->start(QAbstractAnimation::DeleteWhenStopped);
    if (m_isExpandable) {
        auto *widthAnim = new QPropertyAnimation(this, "fixedWidth");
        widthAnim->setDuration(300);
        widthAnim->setEasingCurve(QEasingCurve::OutCubic);
        widthAnim->setStartValue(width());
        widthAnim->setEndValue(50);
        widthAnim->start(QAbstractAnimation::DeleteWhenStopped);
    }
    QPushButton::leaveEvent(event);
}
void NavButton::setBackgroundColor(const QColor &color) { m_backgroundColor = color; update(); }
void NavButton::setBorderColor(const QColor &color) { m_borderColor = color; update(); }
void NavButton::paintEvent(QPaintEvent *event) {
    QPainter p(this);
    p.setRenderHint(QPainter::Antialiasing);
    p.setRenderHint(QPainter::SmoothPixmapTransform);
    if (m_backgroundColor.alpha() > 0) {
        p.setBrush(m_backgroundColor);
        p.setPen(Qt::NoPen);
        p.drawRoundedRect(rect(), 10, 10);
    }
    if (m_borderColor.alpha() > 0) {
        p.setBrush(Qt::NoBrush);
        p.setPen(QPen(m_borderColor, 2));
        p.drawRoundedRect(rect().adjusted(1,1,-1,-1), 10, 10);
    }
    int iconSize = 24;
    int margin = 13;
    if (!m_icon.isNull()) {
        int iconY = (height() - iconSize) / 2;
        QPixmap tintedIcon = m_icon;
        QPainter iconPainter(&tintedIcon);
        iconPainter.setCompositionMode(QPainter::CompositionMode_SourceIn);
        iconPainter.fillRect(tintedIcon.rect(), Qt::white);
        iconPainter.end();
        p.drawPixmap(margin, iconY, iconSize, iconSize, tintedIcon);
    }
    if (width() > 60) {
        p.setPen(Qt::white);
        QFont f = font();
        f.setBold(true);
        f.setPointSize(10);
        p.setFont(f);
        QRect textRect(margin + iconSize + 10, 0, width() - (margin + iconSize + 10), height());
        p.drawText(textRect, Qt::AlignVCenter | Qt::AlignLeft, m_text);
    }
}


WindowControlBtn::WindowControlBtn(ButtonType type, QWidget *parent)
    : QPushButton(parent), m_type(type)
{
    setFixedSize(45, 32);
    setCursor(Qt::PointingHandCursor);
    m_hoverColor = Qt::transparent;
}

void WindowControlBtn::setType(ButtonType type) {
    m_type = type;
    update();
}

void WindowControlBtn::enterEvent(QEnterEvent *event) {
    m_isHovered = true;
    auto *anim = new QPropertyAnimation(this, "hoverColor");
    anim->setDuration(150);
    anim->setStartValue(m_hoverColor);

    QColor targetColor = (m_type == Close) ? QColor(232, 17, 35) : QColor(255, 255, 255, 30);
    anim->setEndValue(targetColor);
    anim->start(QAbstractAnimation::DeleteWhenStopped);
    QPushButton::enterEvent(event);
}

void WindowControlBtn::leaveEvent(QEvent *event) {
    m_isHovered = false;
    auto *anim = new QPropertyAnimation(this, "hoverColor");
    anim->setDuration(150);
    anim->setStartValue(m_hoverColor);
    anim->setEndValue(QColor(Qt::transparent));
    anim->start(QAbstractAnimation::DeleteWhenStopped);
    QPushButton::leaveEvent(event);
}

void WindowControlBtn::paintEvent(QPaintEvent *event) {
    QPainter p(this);
    p.setRenderHint(QPainter::Antialiasing);

    if (m_hoverColor.alpha() > 0) {
        p.setBrush(m_hoverColor);
        p.setPen(Qt::NoPen);
        p.drawRoundedRect(rect(), 4, 4);
    }

    p.setPen(QPen(Qt::white, 2));
    p.setBrush(Qt::NoBrush);

    int w = width();
    int h = height();
    int iconSize = 10;

    int cx = w / 2;
    int cy = h / 2;

    switch (m_type) {
    case Minimize:
        p.drawLine(cx - 5, cy + 5, cx + 5, cy + 5);
        break;
    case Maximize:
        p.drawRect(cx - 5, cy - 5, 10, 10);
        break;
    case Close:
        p.drawLine(cx - 5, cy - 5, cx + 5, cy + 5);
        p.drawLine(cx + 5, cy - 5, cx - 5, cy + 5);
        break;
    }
}

Container::Container(QWidget *parent) : QWidget(parent), m_animProgress(0.0f) {
    setWindowFlags(Qt::Window);
    setAttribute(Qt::WA_TranslucentBackground);
    setMouseTracking(true);
    qApp->installEventFilter(this);

    resize(1000, 700);
    setMinimumSize(950, 650);

    initLogic();
    setupUi();
    setupConnections();

    #ifdef Q_OS_WIN
    if (auto *hwnd = reinterpret_cast<HWND>(winId())) {
        LONG style = GetWindowLong(hwnd, GWL_STYLE);
        SetWindowLong(hwnd, GWL_STYLE, style | WS_THICKFRAME | WS_CAPTION | WS_MAXIMIZEBOX | WS_MINIMIZEBOX);
        MARGINS margins = {-1, -1, -1, -1};
        DwmExtendFrameIntoClientArea(hwnd, &margins);
    }
    #endif

    m_btnDownloader->click();

    bool qEmpty = QueueManager::instance().isEmpty();
    m_btnQueue->setVisible(!qEmpty);
    m_btnQueue->setFixedWidth(!qEmpty ? 50 : 0);
}

void Container::initLogic() {
    m_popup = new Popup(this);
    m_bgTimer = new QTimer(this);
    connect(m_bgTimer, &QTimer::timeout, this, &Container::updateBackground);
    m_bgTimer->start(16);
}

void Container::updateBackground() {
    m_animProgress += 0.002f;
    if (m_animProgress > 1.0f) m_animProgress = 0.0f;
    if (m_windowContent) m_windowContent->update();
}

void Container::paintBackground(QPainter *painter, const QRect &rect) {
    QColor c1(10, 10, 30);
    QColor c2(30, 5, 40);
    QColor c3(40, 0, 20);

    float p = m_animProgress * 2.0f * M_PI;
    float factor = (qSin(p) + 1.0f) / 2.0f;

    QColor startColor;
    startColor.setRedF(c1.redF() * (1.0f - factor) + c2.redF() * factor);
    startColor.setGreenF(c1.greenF() * (1.0f - factor) + c2.greenF() * factor);
    startColor.setBlueF(c1.blueF() * (1.0f - factor) + c2.blueF() * factor);

    QColor endColor;
    endColor.setRedF(c2.redF() * (1.0f - factor) + c3.redF() * factor);
    endColor.setGreenF(c2.greenF() * (1.0f - factor) + c3.greenF() * factor);
    endColor.setBlueF(c2.blueF() * (1.0f - factor) + c3.blueF() * factor);

    QLinearGradient gradient(rect.topLeft(), rect.bottomRight());
    gradient.setColorAt(0, startColor);
    gradient.setColorAt(1, endColor);

    painter->fillRect(rect, gradient);
}

bool Container::eventFilter(QObject *obj, QEvent *event) {
    if (obj == m_windowContent && event->type() == QEvent::Paint) {
        QPainter p(m_windowContent);
        p.setRenderHint(QPainter::Antialiasing);
        QPainterPath path;
        path.addRoundedRect(m_windowContent->rect(), 15, 15);
        p.setClipPath(path);

        paintBackground(&p, m_windowContent->rect());

        p.setPen(QPen(QColor(60, 60, 60), 1));
        p.setBrush(Qt::NoBrush);
        p.drawRoundedRect(m_windowContent->rect(), 15, 15);

        return true;
    }

    if (event->type() == QEvent::MouseButtonPress) {
        if (m_queuePanel->isVisible()) {
            QMouseEvent *mouseEvent = static_cast<QMouseEvent *>(event);
            QPoint localPos = mapFromGlobal(mouseEvent->globalPosition().toPoint());

            if (!m_queuePanel->geometry().contains(localPos) &&
                !m_btnQueue->geometry().contains(m_btnQueue->mapFrom(this, localPos))) {

                QRect globalPanelRect(m_queuePanel->mapToGlobal(QPoint(0,0)), m_queuePanel->size());
                QRect globalBtnRect(m_btnQueue->mapToGlobal(QPoint(0,0)), m_btnQueue->size());

                if(!globalPanelRect.contains(mouseEvent->globalPosition().toPoint()) &&
                   !globalBtnRect.contains(mouseEvent->globalPosition().toPoint())) {
                       toggleQueuePanel();
                }
            }
        }
    }
    return QWidget::eventFilter(obj, event);
}

void Container::setupUi() {
    QVBoxLayout *mainLayout = new QVBoxLayout(this);
    mainLayout->setContentsMargins(10, 10, 10, 10);

    m_windowContent = new QWidget(this);
    m_windowContent->setObjectName("WindowContent");
    m_windowContent->installEventFilter(this);
    m_windowContent->setMouseTracking(true);

    QVBoxLayout *contentLayout = new QVBoxLayout(m_windowContent);
    contentLayout->setContentsMargins(0, 0, 0, 0);
    contentLayout->setSpacing(0);

    m_titleBar = new QWidget(this);
    m_titleBar->setFixedHeight(80);
    m_titleBar->setStyleSheet(
        "QWidget {"
            "background-color: rgba(20, 20, 30, 180);"
            "border-bottom: 1px solid rgba(255, 255, 255, 20);"
            "border-top-left-radius: 15px;"
            "border-top-right-radius: 15px;"
        "}"
        "QPushButton { background: transparent; border: none; border-radius: 0px; }"
        "QLabel { background: transparent; border: none; }"
    );
    m_titleLayout = new QHBoxLayout(m_titleBar);
    m_titleLayout->setContentsMargins(20, 10, 20, 10);
    m_titleLayout->setSpacing(15);

    QLabel *logoLabel = new QLabel(this);
    QPixmap logoPix(":/Resources/Icons/icon_full.png");
    logoLabel->setPixmap(logoPix.scaled(200, 50, Qt::KeepAspectRatio, Qt::SmoothTransformation));
    m_titleLayout->addWidget(logoLabel);

    m_btnDownloader = new NavButton("Downloader", ":/Resources/Icons/downloader.png", true);
    m_titleLayout->addWidget(m_btnDownloader);

    m_titleLayout->addSpacing(10);
    m_titleLayout->addStretch();

    m_btnConsole = new NavButton("Console", ":/Resources/Icons/console.png", false);
    m_titleLayout->addWidget(m_btnConsole);

    m_btnSettings = new NavButton("Settings", ":/Resources/Icons/settings.png", false);
    m_titleLayout->addWidget(m_btnSettings);

    m_btnQueue = new NavButton("Queue", ":/Resources/Icons/queue.png", true);
    m_btnQueue->setVisible(false);
    m_titleLayout->addWidget(m_btnQueue);

    QWidget *controlsContainer = new QWidget(this);
    controlsContainer->setFixedSize(160, 45);
    controlsContainer->setStyleSheet(
        "background-color: rgba(255, 255, 255, 10);"
        "border: 1px solid rgba(255, 255, 255, 20);"
        "border-radius: 15px;"
    );
    QHBoxLayout *controlsLayout = new QHBoxLayout(controlsContainer);
    controlsLayout->setContentsMargins(0, 0, 0, 0);
    controlsLayout->setSpacing(5);
    WindowControlBtn *btnMin = new WindowControlBtn(WindowControlBtn::Minimize);
    m_btnMax = new WindowControlBtn(WindowControlBtn::Maximize);
    WindowControlBtn *btnClose = new WindowControlBtn(WindowControlBtn::Close);
    connect(btnMin, &QPushButton::clicked, this, &QWidget::showMinimized);
    connect(m_btnMax, &QPushButton::clicked, this, &Container::toggleMaximize);
    connect(btnClose, &QPushButton::clicked, this, &Container::close);
    controlsLayout->addWidget(btnMin);
    controlsLayout->addWidget(m_btnMax);
    controlsLayout->addWidget(btnClose);
    m_titleLayout->addWidget(controlsContainer);
    contentLayout->addWidget(m_titleBar);

    m_stackedWidget = new QStackedWidget(this);
    auto *pageDownloader = new DownloaderPage(this);
    auto *pageConsole = new ConsolePage(this);
    auto *pageSettings = new SettingsPage(m_popup, this);

    m_stackedWidget->addWidget(pageDownloader);
    m_stackedWidget->addWidget(pageSettings);
    m_stackedWidget->addWidget(pageConsole);

    connect(pageDownloader->getDownloader(), &Downloader::outputLog, pageConsole, &ConsolePage::appendLog);
    connect(&QueueManager::instance(), &QueueManager::logMessage, pageConsole, &ConsolePage::appendLog);

    connect(pageDownloader, &DownloaderPage::downloadRequested, this, &Container::onDownloadRequested);

    contentLayout->addWidget(m_stackedWidget);
    mainLayout->addWidget(m_windowContent);

    QGraphicsDropShadowEffect *shadow = new QGraphicsDropShadowEffect(this);
    shadow->setBlurRadius(20);
    shadow->setColor(QColor(0, 0, 0, 150));
    shadow->setOffset(0, 0);
    m_windowContent->setGraphicsEffect(shadow);

    m_queuePanel = new QueuePanel(this);
    m_queuePanel->setVisible(false);
}

void Container::resizeEvent(QResizeEvent *event) {
    if (m_queuePanel->isVisible()) {
        int w = m_queuePanel->width();
        int x = width() - w - 20;
        int y = m_titleBar->height() + 10;

        int contentH = m_queuePanel->calculateContentHeight();
        int maxH = height() - y - 20;
        int finalH = qMin(contentH, maxH);

        m_queuePanel->setGeometry(x, y, w, finalH);
    }
    QWidget::resizeEvent(event);
}

void Container::toggleQueuePanel() {
    auto *group = new QParallelAnimationGroup(this);

    int w = m_queuePanel->width();
    int x = width() - w - 20;
    int y = m_titleBar->height() + 10;

    int contentH = m_queuePanel->calculateContentHeight();
    int maxH = height() - y - 20;
    int finalH = qMin(contentH, maxH);

    if (m_queuePanel->isVisible()) {
        auto *animOpacity = new QPropertyAnimation(m_queuePanel, "windowOpacity");
        animOpacity->setDuration(250);
        animOpacity->setStartValue(1.0);
        animOpacity->setEndValue(0.0);

        auto *animPos = new QPropertyAnimation(m_queuePanel, "pos");
        animPos->setDuration(250);
        animPos->setStartValue(m_queuePanel->pos());
        animPos->setEndValue(QPoint(x, y - 20));

        group->addAnimation(animOpacity);
        group->addAnimation(animPos);

        connect(group, &QAbstractAnimation::finished, [this](){
             m_queuePanel->hide();
             m_queuePanel->setWindowOpacity(1.0);
        });

        m_btnQueue->setActive(false);
    } else {
        m_queuePanel->captureAndBlurBackground();

        m_queuePanel->setVisible(true);
        m_queuePanel->raise();

        auto *animOpacity = new QPropertyAnimation(m_queuePanel, "windowOpacity");
        animOpacity->setDuration(250);
        animOpacity->setStartValue(0.0);
        animOpacity->setEndValue(1.0);

        auto *animPos = new QPropertyAnimation(m_queuePanel, "pos");
        animPos->setDuration(250);
        animPos->setStartValue(QPoint(x, y - 20));
        animPos->setEndValue(QPoint(x, y));
        animPos->setEasingCurve(QEasingCurve::OutCubic);

        group->addAnimation(animOpacity);
        group->addAnimation(animPos);

        m_btnQueue->setActive(true);
    }
    group->start(QAbstractAnimation::DeleteWhenStopped);
}

void Container::onDownloadRequested() {
    if (!m_btnQueue->isVisible()) {
        m_btnQueue->setVisible(true);
    }

    auto *ball = new QWidget(this);
    ball->setFixedSize(20, 20);
    ball->setStyleSheet("background-color: #00e676; border-radius: 10px;");
    ball->show();

    auto *dlPage = qobject_cast<DownloaderPage*>(m_stackedWidget->widget(0));
    QPoint startGlobal = dlPage ? dlPage->getStartBtnPos() : rect().center();
    QPoint startLocal = mapFromGlobal(startGlobal);

    QPoint endLocal = m_btnQueue->mapTo(this, QPoint(m_btnQueue->width()/2, m_btnQueue->height()/2));

    auto *anim = new QPropertyAnimation(ball, "pos");
    anim->setDuration(600);
    anim->setStartValue(startLocal);
    anim->setEndValue(endLocal);
    anim->setEasingCurve(QEasingCurve::InOutQuad);

    connect(anim, &QPropertyAnimation::finished, [ball, this](){
        ball->deleteLater();
        m_btnQueue->setActive(true);
        QTimer::singleShot(800, [this](){
            if(!m_queuePanel->isVisible()) m_btnQueue->setActive(false);
        });
    });

    anim->start(QAbstractAnimation::DeleteWhenStopped);
}

void Container::setupConnections() {
    connect(m_btnDownloader, &QPushButton::clicked, [this](){ switchPage(0); });
    connect(m_btnSettings, &QPushButton::clicked, [this](){ switchPage(1); });
    connect(m_btnConsole, &QPushButton::clicked, [this](){ switchPage(2); });
    connect(m_btnQueue, &QPushButton::clicked, this, &Container::toggleQueuePanel);

    connect(&QueueManager::instance(), &QueueManager::queueUpdated, this, [this](){
        bool empty = QueueManager::instance().isEmpty();

        if (empty && m_queuePanel->isVisible()) {
             toggleQueuePanel();
        }

        if (empty) {
            m_btnQueue->setVisible(false);
        } else {
            if (!m_btnQueue->isVisible()) {
                m_btnQueue->setVisible(true);
                auto *anim = new QPropertyAnimation(m_btnQueue, "windowOpacity");
                anim->setStartValue(0.0);
                anim->setEndValue(1.0);
                anim->setDuration(300);
                anim->start(QAbstractAnimation::DeleteWhenStopped);
            }
        }

        if(m_queuePanel->isVisible()) {
             QResizeEvent re(size(), size());
             resizeEvent(&re);
        }
    });

    connect(&QueueManager::instance(), &QueueManager::itemFinished, this, [this](const QString &title, bool success){
        if (success) {
            m_popup->showMessage("Finished", "Download finished: " + title, Popup::Success, Popup::Temporary);
        } else {
            m_popup->showMessage("Error", "Failed to download: " + title, Popup::Error, Popup::Temporary);
        }
    });
}

void Container::switchPage(int index) {
    if (m_queuePanel->isVisible()) toggleQueuePanel();
    m_stackedWidget->setCurrentIndex(index);
    m_btnDownloader->setActive(index == 0);
    m_btnSettings->setActive(index == 1);
    m_btnConsole->setActive(index == 2);
}

void Container::closeEvent(QCloseEvent *event) {
    auto& config = ConfigManager::instance();
    QString behavior = config.getCloseBehavior();
    if (behavior == "Minimize" && QSystemTrayIcon::isSystemTrayAvailable()) {
        this->hide();
        event->ignore();
    } else {
        event->accept();
        QApplication::quit();
    }
}
void Container::toggleMaximize() {
    if (isMaximized()) {
        showNormal();
        m_btnMax->setType(WindowControlBtn::Maximize);
    } else {
        showMaximized();
        m_btnMax->setType(WindowControlBtn::Maximize);
    }
}
Qt::Edges Container::getEdges(const QPoint &pos) {
    Qt::Edges edges = Qt::Edges();
    int m = m_borderWidth;
    bool left = pos.x() <= m;
    bool right = pos.x() >= width() - m;
    bool top = pos.y() <= m;
    bool bottom = pos.y() >= height() - m;
    if (top) edges |= Qt::TopEdge;
    if (bottom) edges |= Qt::BottomEdge;
    if (left) edges |= Qt::LeftEdge;
    if (right) edges |= Qt::RightEdge;
    return edges;
}
void Container::updateCursorShape(const QPoint &pos) {
    if (isMaximized()) {
        setCursor(Qt::ArrowCursor);
        return;
    }
    Qt::Edges edges = getEdges(pos);
    bool top = edges & Qt::TopEdge;
    bool bottom = edges & Qt::BottomEdge;
    bool left = edges & Qt::LeftEdge;
    bool right = edges & Qt::RightEdge;
    if (top && left) setCursor(Qt::SizeFDiagCursor);
    else if (bottom && right) setCursor(Qt::SizeFDiagCursor);
    else if (top && right) setCursor(Qt::SizeBDiagCursor);
    else if (bottom && left) setCursor(Qt::SizeBDiagCursor);
    else if (top || bottom) setCursor(Qt::SizeVerCursor);
    else if (left || right) setCursor(Qt::SizeHorCursor);
    else setCursor(Qt::ArrowCursor);
}
void Container::mousePressEvent(QMouseEvent *event) {
    if (event->button() == Qt::LeftButton) {
        Qt::Edges edges = getEdges(event->position().toPoint());
        if (edges != Qt::Edges() && !isMaximized()) {
            if (windowHandle()->startSystemResize(edges)) return;
        }
        if (event->position().y() < 80) {
            if (windowHandle()->startSystemMove()) return;
            m_dragPosition = event->globalPosition().toPoint() - frameGeometry().topLeft();
            m_isDragging = true;
        }
    }
    event->accept();
}
void Container::mouseMoveEvent(QMouseEvent *event) {
    if (!m_isDragging && !isMaximized()) updateCursorShape(event->position().toPoint());
    if (m_isDragging && (event->buttons() & Qt::LeftButton)) move(event->globalPosition().toPoint() - m_dragPosition);
    event->accept();
}
void Container::mouseReleaseEvent(QMouseEvent *event) {
    m_isDragging = false;
    if (!rect().contains(event->position().toPoint())) setCursor(Qt::ArrowCursor);
    QWidget::mouseReleaseEvent(event);
}
bool Container::nativeEvent(const QByteArray &eventType, void *message, qintptr *result) {
#ifdef Q_OS_WIN
    if (eventType == "windows_generic_MSG") {
        MSG* msg = static_cast<MSG*>(message);
        if (msg->message == WM_NCCALCSIZE && msg->wParam == TRUE) {
            *result = 0;
            return true;
        }
    }
#endif
    return QWidget::nativeEvent(eventType, message, result);
}