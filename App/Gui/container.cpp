#include "container.h"
#include "downloader_page.h"
#include "settings_page.h"
#include "console_page.h"
#include "../System/config_manager.h"
#include "../Core/downloader.h"
#include "QSystemTrayIcon"

NavButton::NavButton(const QString &text, const QString &iconPath, bool isExpandable, QWidget *parent)
    : QPushButton(parent), m_isExpandable(isExpandable), m_text(text) {
    m_icon = QPixmap(iconPath);
    setCursor(Qt::PointingHandCursor);
    m_backgroundColor = Qt::transparent;
    m_borderColor = Qt::transparent;
    m_iconColor = Qt::white;
    m_activeColor = QColor(138, 43, 226);
    setFixedWidth(m_isExpandable ? 50 : 110);
    setFixedHeight(40);
}

void NavButton::setExpandedWidth(int width) {
    m_expandedWidth = width;
}

void NavButton::setIconColor(const QColor &color) { m_iconColor = color; update(); }
void NavButton::setActiveColor(const QColor &color) {
    m_activeColor = color;
    if (m_isActive) { setBackgroundColor(m_activeColor); setBorderColor(m_activeColor); }
}
void NavButton::setActive(bool active) {
    m_isActive = active;
    auto *group = new QParallelAnimationGroup(this);
    auto *bgAnim = new QPropertyAnimation(this, "backgroundColor");
    bgAnim->setDuration(200);
    bgAnim->setStartValue(m_backgroundColor);
    bgAnim->setEndValue(active ? m_activeColor : QColor(Qt::transparent));
    auto *borderAnim = new QPropertyAnimation(this, "borderColor");
    borderAnim->setDuration(200);
    borderAnim->setStartValue(m_borderColor);
    borderAnim->setEndValue(active ? m_activeColor : QColor(Qt::transparent));
    group->addAnimation(bgAnim);
    group->addAnimation(borderAnim);
    if (m_isExpandable) {
        auto *widthAnim = new QPropertyAnimation(this, "fixedWidth");
        widthAnim->setDuration(300);
        widthAnim->setEasingCurve(QEasingCurve::OutBack);
        widthAnim->setStartValue(width());
        widthAnim->setEndValue(active ? m_expandedWidth : 50);
        group->addAnimation(widthAnim);
    }
    group->start(QAbstractAnimation::DeleteWhenStopped);
}
void NavButton::enterEvent(QEnterEvent *event) {
    if (m_isActive) return;
    auto *anim = new QPropertyAnimation(this, "borderColor");
    anim->setDuration(200);
    anim->setStartValue(m_borderColor);
    anim->setEndValue(m_activeColor);
    anim->start(QAbstractAnimation::DeleteWhenStopped);
    if (m_isExpandable) {
        auto *widthAnim = new QPropertyAnimation(this, "fixedWidth");
        widthAnim->setDuration(300);
        widthAnim->setEasingCurve(QEasingCurve::OutCubic);
        widthAnim->setStartValue(width());
        widthAnim->setEndValue(m_expandedWidth);
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
    int iconSize = 24; int margin = 13;
    if (!m_icon.isNull()) {
        int iconY = (height() - iconSize) / 2;
        QPixmap tintedIcon = m_icon;
        QPainter iconPainter(&tintedIcon);
        iconPainter.setCompositionMode(QPainter::CompositionMode_SourceIn);
        iconPainter.fillRect(tintedIcon.rect(), m_iconColor);
        iconPainter.end();
        p.drawPixmap(margin, iconY, iconSize, iconSize, tintedIcon);
    }
    if (width() > 60) {
        p.setPen(m_iconColor);
        QFont f = font(); f.setBold(true); f.setPointSize(10); p.setFont(f);
        QRect textRect(margin + iconSize + 10, 0, width() - (margin + iconSize + 10), height());
        p.drawText(textRect, Qt::AlignVCenter | Qt::AlignLeft, m_text);
    }
}

WindowControlBtn::WindowControlBtn(ButtonType type, QWidget *parent)
    : QPushButton(parent), m_type(type) {
    setFixedSize(45, 32);
    setCursor(Qt::PointingHandCursor);
    m_hoverColor = Qt::transparent;
}
void WindowControlBtn::setType(ButtonType type) { m_type = type; update(); }
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
    bool dark = StyleHelper::isDarkMode();
    QColor iconColor = dark ? Qt::white : QColor("#333333");
    p.setPen(QPen(iconColor, 2)); p.setBrush(Qt::NoBrush);
    int w = width(); int h = height(); int cx = w / 2; int cy = h / 2;
    switch (m_type) {
    case Minimize: p.drawLine(cx - 5, cy + 5, cx + 5, cy + 5); break;
    case Maximize: p.drawRect(cx - 5, cy - 5, 10, 10); break;
    case Close: p.drawLine(cx - 5, cy - 5, cx + 5, cy + 5); p.drawLine(cx + 5, cy - 5, cx - 5, cy + 5); break;
    }
}

Container::Container(QWidget *parent) : QWidget(parent), m_animProgress(0.0f) {
    setWindowFlags(Qt::Window | Qt::FramelessWindowHint);
    setAttribute(Qt::WA_TranslucentBackground);
    setMouseTracking(true);
    qApp->installEventFilter(this);

    setWindowOpacity(0.0);

    resize(1000, 700);
    setMinimumSize(950, 650);

    initLogic();
    setupUi();
    setupConnections();

    updateTheme();

    m_btnDownloader->click();
    bool qEmpty = QueueManager::instance().isEmpty();
    m_btnQueue->setVisible(!qEmpty);
    m_btnQueue->setFixedWidth(!qEmpty ? 50 : 0);
}

void Container::showEvent(QShowEvent *event) {
    QWidget::showEvent(event);
    if (windowOpacity() == 0.0) {
        runStartupAnimation();
    }
}

void Container::runStartupAnimation() {
    QRect targetGeo = geometry();
    QRect startGeo = targetGeo.adjusted(10, 10, -10, -10);
    setGeometry(startGeo);

    auto *group = new QParallelAnimationGroup(this);

    auto *opacityAnim = new QPropertyAnimation(this, "windowOpacity");
    opacityAnim->setDuration(250);
    opacityAnim->setStartValue(0.0);
    opacityAnim->setEndValue(1.0);
    opacityAnim->setEasingCurve(QEasingCurve::OutCubic);

    auto *geoAnim = new QPropertyAnimation(this, "geometry");
    geoAnim->setDuration(350);
    geoAnim->setStartValue(startGeo);
    geoAnim->setEndValue(targetGeo);
    geoAnim->setEasingCurve(QEasingCurve::OutBack);

    group->addAnimation(opacityAnim);
    group->addAnimation(geoAnim);
    group->start(QAbstractAnimation::DeleteWhenStopped);
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
    QColor d1(10, 10, 30), d2(30, 5, 40), d3(40, 0, 20);
    QColor l1(240, 248, 255), l2(255, 240, 245), l3(230, 230, 250);
    bool dark = StyleHelper::isDarkMode();
    QColor c1 = dark ? d1 : l1; QColor c2 = dark ? d2 : l2; QColor c3 = dark ? d3 : l3;
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
        int radius = m_isMaximizedCustom ? 0 : 15;
        path.addRoundedRect(m_windowContent->rect(), radius, radius);
        p.setClipPath(path);
        paintBackground(&p, m_windowContent->rect());
        bool dark = StyleHelper::isDarkMode();
        QColor borderColor = dark ? QColor(60, 60, 60) : QColor(200, 200, 200);
        p.setPen(QPen(borderColor, 1)); p.setBrush(Qt::NoBrush);
        p.drawRoundedRect(m_windowContent->rect(), radius, radius);
        return true;
    }
    if (event->type() == QEvent::MouseButtonPress && m_queuePanel->isVisible()) {
        QMouseEvent *mouseEvent = static_cast<QMouseEvent *>(event);
        QPoint localPos = mapFromGlobal(mouseEvent->globalPosition().toPoint());
        if (!m_queuePanel->geometry().contains(localPos) &&
            !m_btnQueue->geometry().contains(m_btnQueue->mapFrom(this, localPos))) {
            toggleQueuePanel();
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
    m_titleBar->setObjectName("TitleBar");

    m_titleLayout = new QHBoxLayout(m_titleBar);
    m_titleLayout->setContentsMargins(20, 10, 20, 10);
    m_titleLayout->setSpacing(15);

    QLabel *logoLabel = new QLabel(this);
    QPixmap logoPix(":/Resources/Icons/icon_full.png");
    logoLabel->setPixmap(logoPix.scaled(200, 50, Qt::KeepAspectRatio, Qt::SmoothTransformation));
    m_titleLayout->addWidget(logoLabel);

    m_btnDownloader = new NavButton("Downloader", ":/Resources/Icons/downloader.png", true);
    m_btnDownloader->setExpandedWidth(140);
    m_titleLayout->addWidget(m_btnDownloader);

    m_titleLayout->addSpacing(10); m_titleLayout->addStretch();

    m_btnConsole = new NavButton("Console", ":/Resources/Icons/console.png", false);
    m_titleLayout->addWidget(m_btnConsole);

    m_btnSettings = new NavButton("Settings", ":/Resources/Icons/settings.png", false);
    m_titleLayout->addWidget(m_btnSettings);

    m_btnQueue = new NavButton("Queue", ":/Resources/Icons/queue.png", true);
    m_btnQueue->setExpandedWidth(105);
    m_btnQueue->setVisible(false);
    m_titleLayout->addWidget(m_btnQueue);

    QWidget *controlsContainer = new QWidget(this);
    controlsContainer->setFixedSize(160, 45);
    controlsContainer->setStyleSheet(
        "background-color: rgba(255, 255, 255, 10); border: 1px solid rgba(255, 255, 255, 20); border-radius: 15px;"
    );
    QHBoxLayout *controlsLayout = new QHBoxLayout(controlsContainer);
    controlsLayout->setContentsMargins(0, 0, 0, 0);
    controlsLayout->setSpacing(5);
    WindowControlBtn *btnMin = new WindowControlBtn(WindowControlBtn::Minimize);
    m_btnMax = new WindowControlBtn(WindowControlBtn::Maximize);
    WindowControlBtn *btnClose = new WindowControlBtn(WindowControlBtn::Close);

    connect(btnMin, &QPushButton::clicked, this, &Container::requestMinimize);
    connect(m_btnMax, &QPushButton::clicked, this, &Container::requestMaximize);
    connect(btnClose, &QPushButton::clicked, this, &Container::requestClose);

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

    connect(pageSettings, &SettingsPage::themeChanged, this, &Container::updateTheme);
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

void Container::updateTheme() {
    bool dark = StyleHelper::isDarkMode();
    qApp->setStyleSheet(StyleHelper::getGlobalStyle(dark));
    QString titleBg = dark ? "rgba(20, 20, 30, 180)" : "rgba(255, 255, 255, 180)";
    QString titleBorder = dark ? "rgba(255, 255, 255, 20)" : "rgba(0, 0, 0, 20)";

    int radius = m_isMaximizedCustom ? 0 : 15;

    m_titleBar->setStyleSheet(QString(
        "#TitleBar {"
        "   background-color: %1;"
        "   border-bottom: 1px solid %2;"
        "   border-top-left-radius: %3px;"
        "   border-top-right-radius: %3px;"
        "}"
        "QPushButton { background: transparent; border: none; border-radius: 0px; }"
        "QLabel { background: transparent; border: none; }"
    ).arg(titleBg, titleBorder).arg(radius));

    QColor iconColor = dark ? Qt::white : QColor("#333333");
    QColor activeColor = dark ? QColor(138, 43, 226) : QColor(179, 157, 219);

    m_btnDownloader->setIconColor(iconColor); m_btnDownloader->setActiveColor(activeColor);
    m_btnSettings->setIconColor(iconColor); m_btnSettings->setActiveColor(activeColor);
    m_btnConsole->setIconColor(iconColor); m_btnConsole->setActiveColor(activeColor);
    m_btnQueue->setIconColor(iconColor); m_btnQueue->setActiveColor(activeColor);

    if (auto *dl = qobject_cast<DownloaderPage *>(m_stackedWidget->widget(0))) dl->refreshStyles();
    if (auto* st = qobject_cast<SettingsPage *>(m_stackedWidget->widget(1))) st->refreshStyles();
    if (auto* co = qobject_cast<ConsolePage*>(m_stackedWidget->widget(2))) co->refreshStyles();
    update();
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
    if (m_queuePanel->isVisible()) {
        auto *animOpacity = new QPropertyAnimation(m_queuePanel, "windowOpacity");
        animOpacity->setDuration(250); animOpacity->setStartValue(1.0); animOpacity->setEndValue(0.0);
        auto *animPos = new QPropertyAnimation(m_queuePanel, "pos");
        animPos->setDuration(250); animPos->setStartValue(m_queuePanel->pos()); animPos->setEndValue(QPoint(x, y - 20));
        group->addAnimation(animOpacity); group->addAnimation(animPos);
        connect(group, &QAbstractAnimation::finished, [this](){ m_queuePanel->hide(); m_queuePanel->setWindowOpacity(1.0); });
        m_btnQueue->setActive(false);
    } else {
        m_queuePanel->captureAndBlurBackground();
        m_queuePanel->setVisible(true); m_queuePanel->raise();
        auto *animOpacity = new QPropertyAnimation(m_queuePanel, "windowOpacity");
        animOpacity->setDuration(250); animOpacity->setStartValue(0.0); animOpacity->setEndValue(1.0);
        auto *animPos = new QPropertyAnimation(m_queuePanel, "pos");
        animPos->setDuration(250); animPos->setStartValue(QPoint(x, y - 20)); animPos->setEndValue(QPoint(x, y));
        animPos->setEasingCurve(QEasingCurve::OutCubic);
        group->addAnimation(animOpacity); group->addAnimation(animPos);
        m_btnQueue->setActive(true);
    }
    group->start(QAbstractAnimation::DeleteWhenStopped);
}

void Container::onDownloadRequested() {
    if (!m_btnQueue->isVisible()) { m_btnQueue->setVisible(true); }
    auto *ball = new QWidget(this);
    ball->setFixedSize(20, 20);
    ball->setStyleSheet("background-color: #00e676; border-radius: 10px;");
    ball->show();
    auto *dlPage = qobject_cast<DownloaderPage*>(m_stackedWidget->widget(0));
    QPoint startGlobal = dlPage ? dlPage->getStartBtnPos() : rect().center();
    QPoint startLocal = mapFromGlobal(startGlobal);
    QPoint endLocal = m_btnQueue->mapTo(this, QPoint(m_btnQueue->width()/2, m_btnQueue->height()/2));
    auto *anim = new QPropertyAnimation(ball, "pos");
    anim->setDuration(600); anim->setStartValue(startLocal); anim->setEndValue(endLocal);
    anim->setEasingCurve(QEasingCurve::InOutQuad);
    connect(anim, &QPropertyAnimation::finished, [ball, this](){
        ball->deleteLater();
        m_btnQueue->setActive(true);
        QTimer::singleShot(800, [this](){ if(!m_queuePanel->isVisible()) m_btnQueue->setActive(false); });
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
        if (empty && m_queuePanel->isVisible()) { toggleQueuePanel(); }
        if (empty) { m_btnQueue->setVisible(false); }
        else {
            if (!m_btnQueue->isVisible()) {
                m_btnQueue->setVisible(true);
                auto *anim = new QPropertyAnimation(m_btnQueue, "windowOpacity");
                anim->setStartValue(0.0); anim->setEndValue(1.0); anim->setDuration(300);
                anim->start(QAbstractAnimation::DeleteWhenStopped);
            }
        }
        if(m_queuePanel->isVisible()) { QResizeEvent re(size(), size()); resizeEvent(&re); }
    });
    connect(&QueueManager::instance(), &QueueManager::itemFinished, this, [this](const QString &title, bool success){
        if (success) m_popup->showMessage("Finished", "Download finished: " + title, Popup::Success, Popup::Temporary);
        else m_popup->showMessage("Error", "Failed to download: " + title, Popup::Error, Popup::Temporary);
    });
}
void Container::switchPage(int index) {
    if (m_queuePanel->isVisible()) toggleQueuePanel();
    m_stackedWidget->setCurrentIndex(index);
    m_btnDownloader->setActive(index == 0);
    m_btnSettings->setActive(index == 1);
    m_btnConsole->setActive(index == 2);
}

void Container::requestClose() {
    close();
}

void Container::closeEvent(QCloseEvent *event) {
    if (m_isClosing) {
        event->accept();
        return;
    }

    auto& config = ConfigManager::instance();
    QString behavior = config.getCloseBehavior();

    if (behavior == "Hide" && QSystemTrayIcon::isSystemTrayAvailable()) {
        event->ignore();

        auto *group = new QParallelAnimationGroup(this);

        auto *opacityAnim = new QPropertyAnimation(this, "windowOpacity");
        opacityAnim->setDuration(200);
        opacityAnim->setStartValue(1.0);
        opacityAnim->setEndValue(0.0);
        opacityAnim->setEasingCurve(QEasingCurve::OutCubic);

        auto *scaleAnim = new QPropertyAnimation(this, "geometry");
        scaleAnim->setDuration(200);
        scaleAnim->setStartValue(geometry());
        scaleAnim->setEndValue(geometry().adjusted(10, 10, -10, -10));
        scaleAnim->setEasingCurve(QEasingCurve::OutCubic);

        group->addAnimation(opacityAnim);
        group->addAnimation(scaleAnim);

        connect(group, &QAbstractAnimation::finished, [this](){
            this->hide();
            this->setGeometry(this->geometry().adjusted(-10, -10, 10, 10));
        });

        group->start(QAbstractAnimation::DeleteWhenStopped);

    } else {
        event->ignore();
        m_isClosing = true;

        auto *group = new QParallelAnimationGroup(this);

        auto *opacityAnim = new QPropertyAnimation(this, "windowOpacity");
        opacityAnim->setDuration(150);
        opacityAnim->setStartValue(1.0);
        opacityAnim->setEndValue(0.0);
        opacityAnim->setEasingCurve(QEasingCurve::InQuad);

        auto *scaleAnim = new QPropertyAnimation(this, "geometry");
        scaleAnim->setDuration(150);
        scaleAnim->setStartValue(geometry());
        scaleAnim->setEndValue(geometry().adjusted(15, 15, -15, -15));
        scaleAnim->setEasingCurve(QEasingCurve::InQuad);

        group->addAnimation(opacityAnim);
        group->addAnimation(scaleAnim);

        connect(group, &QAbstractAnimation::finished, [this](){
            QApplication::quit();
        });
        group->start(QAbstractAnimation::DeleteWhenStopped);
    }
}

void Container::requestMinimize() {
    auto *group = new QParallelAnimationGroup(this);

    auto *opacityAnim = new QPropertyAnimation(this, "windowOpacity");
    opacityAnim->setDuration(200);
    opacityAnim->setStartValue(1.0);
    opacityAnim->setEndValue(0.0);
    opacityAnim->setEasingCurve(QEasingCurve::OutCubic);

    QRect current = geometry();
    auto *geoAnim = new QPropertyAnimation(this, "geometry");
    geoAnim->setDuration(200);
    geoAnim->setStartValue(current);
    geoAnim->setEndValue(current.translated(0, 25));
    geoAnim->setEasingCurve(QEasingCurve::OutCubic);

    group->addAnimation(opacityAnim);
    group->addAnimation(geoAnim);

    connect(group, &QAbstractAnimation::finished, [this](){
        showMinimized();
        setWindowOpacity(1.0);
    });
    group->start(QAbstractAnimation::DeleteWhenStopped);
}

void Container::requestMaximize() {
    if (m_isMaximizedCustom) {
        m_isMaximizedCustom = false;
        m_btnMax->setType(WindowControlBtn::Maximize);
        layout()->setContentsMargins(10, 10, 10, 10);
        updateTheme();
        animateGeometry(geometry(), m_savedGeometry);
    } else {
        m_savedGeometry = geometry();
        m_isMaximizedCustom = true;
        m_btnMax->setType(WindowControlBtn::Maximize);

        QScreen *screen = QGuiApplication::screenAt(mapToGlobal(rect().center()));
        if (!screen) screen = QGuiApplication::primaryScreen();

        QRect targetParams = screen->availableGeometry();

        layout()->setContentsMargins(0, 0, 0, 0);
        updateTheme();

        animateGeometry(geometry(), targetParams);
    }
}

void Container::animateGeometry(const QRect &start, const QRect &end) {
    auto *anim = new QPropertyAnimation(this, "geometry");
    anim->setDuration(280);
    anim->setStartValue(start);
    anim->setEndValue(end);
    anim->setEasingCurve(QEasingCurve::OutExpo);
    anim->start(QAbstractAnimation::DeleteWhenStopped);
}

Qt::Edges Container::getEdges(const QPoint &pos) {
    if (m_isMaximizedCustom) return Qt::Edges();

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
    if (m_isMaximizedCustom) {
        setCursor(Qt::ArrowCursor);
        return;
    }
    Qt::Edges edges = getEdges(pos);
    if (edges == Qt::Edges()) {
        setCursor(Qt::ArrowCursor);
        return;
    }
    if ((edges & Qt::TopEdge) && (edges & Qt::LeftEdge)) setCursor(Qt::SizeFDiagCursor);
    else if ((edges & Qt::BottomEdge) && (edges & Qt::RightEdge)) setCursor(Qt::SizeFDiagCursor);
    else if ((edges & Qt::TopEdge) && (edges & Qt::RightEdge)) setCursor(Qt::SizeBDiagCursor);
    else if ((edges & Qt::BottomEdge) && (edges & Qt::LeftEdge)) setCursor(Qt::SizeBDiagCursor);
    else if ((edges & Qt::TopEdge) || (edges & Qt::BottomEdge)) setCursor(Qt::SizeVerCursor);
    else if ((edges & Qt::LeftEdge) || (edges & Qt::RightEdge)) setCursor(Qt::SizeHorCursor);
}

void Container::mousePressEvent(QMouseEvent *event) {
    if (event->button() == Qt::LeftButton) {
        if (m_isMaximizedCustom) {
            return;
        }

        Qt::Edges edges = getEdges(event->position().toPoint());
        if (edges != Qt::Edges()) {
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
    if (!m_isDragging && !m_isMaximizedCustom) updateCursorShape(event->position().toPoint());
    if (m_isDragging && (event->buttons() & Qt::LeftButton)) {
        move(event->globalPosition().toPoint() - m_dragPosition);
    }
    event->accept();
}

void Container::mouseReleaseEvent(QMouseEvent *event) {
    m_isDragging = false;
    if (!rect().contains(event->position().toPoint())) setCursor(Qt::ArrowCursor);
    QWidget::mouseReleaseEvent(event);
}

void Container::changeEvent(QEvent *event) {
    if (event->type() == QEvent::WindowStateChange) {
        QWindowStateChangeEvent *e = static_cast<QWindowStateChangeEvent*>(event);

        if ((e->oldState() & Qt::WindowMinimized) && !(windowState() & Qt::WindowMinimized)) {
            runRestoreAnimation();
        }
    }
    QWidget::changeEvent(event);
}

void Container::runRestoreAnimation() {
    QRect targetGeo = geometry();

    QRect startGeo = targetGeo.translated(0, 25);

    setWindowOpacity(0.0);
    setGeometry(startGeo);

    auto *group = new QParallelAnimationGroup(this);

    auto *opacityAnim = new QPropertyAnimation(this, "windowOpacity");
    opacityAnim->setDuration(200);
    opacityAnim->setStartValue(0.0);
    opacityAnim->setEndValue(1.0);
    opacityAnim->setEasingCurve(QEasingCurve::OutCubic);

    auto *geoAnim = new QPropertyAnimation(this, "geometry");
    geoAnim->setDuration(250);
    geoAnim->setStartValue(startGeo);
    geoAnim->setEndValue(targetGeo);
    geoAnim->setEasingCurve(QEasingCurve::OutCubic);

    group->addAnimation(opacityAnim);
    group->addAnimation(geoAnim);

    group->start(QAbstractAnimation::DeleteWhenStopped);
}
