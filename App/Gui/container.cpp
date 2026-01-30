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

// --- (NavButton i WindowControlBtn bez zmian - pozostawić jak były) ---
// (Dla czytelności wklejam tylko zmienioną klasę Container i konstruktory przycisków jeśli potrzebne,
// ale zakładam, że NavButton i WindowControlBtn są takie same jak w poprzednim pliku components.cpp/container.cpp)

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

Container::Container(QWidget *parent) : QWidget(parent) {
    // WAŻNE: Ustawiamy tylko flagę Qt::Window. Usuwamy Qt::FramelessWindowHint,
    // aby zachować animacje systemowe. Obsługa nativeEvent oraz DWM usunie ramki wizualnie.
    setWindowFlags(Qt::Window);
    setAttribute(Qt::WA_TranslucentBackground);
    setMouseTracking(true);

    resize(1000, 700);
    setMinimumSize(950, 650);

    initLogic();
    setupUi();
    setupConnections();

    #ifdef Q_OS_WIN
    if (auto *hwnd = reinterpret_cast<HWND>(winId())) {
        // Dodajemy style systemowe potrzebne do animacji
        LONG style = GetWindowLong(hwnd, GWL_STYLE);
        SetWindowLong(hwnd, GWL_STYLE, style | WS_THICKFRAME | WS_CAPTION | WS_MAXIMIZEBOX | WS_MINIMIZEBOX);

        // KLUCZOWA POPRAWKA DLA PRZEZROCZYSTYCH KRAWĘDZI:
        // Rozszerzamy ramkę DWM na cały obszar klienta. Dzięki temu systemowa ramka
        // jest "rysowana" na obszarze, który mamy przezroczysty, co skutkuje brakiem widocznej ramki
        // przy zachowaniu cieni i animacji.
        MARGINS margins = {-1, -1, -1, -1}; // -1 oznacza cały obszar
        DwmExtendFrameIntoClientArea(hwnd, &margins);
    }
    #endif

    m_btnDownloader->click();
}

void Container::initLogic() {
    m_popup = new Popup(this);
    m_installer = new InstallerWindow(m_popup, this);
    m_appUpdater = new AppUpdater(m_popup, this);
}

void Container::setupUi() {
    QVBoxLayout *mainLayout = new QVBoxLayout(this);
    // Marginesy muszą być dopasowane, aby treść nie wchodziła pod systemowe krawędzie
    // przy maksymalizacji, ale nativeEvent zazwyczaj to koryguje.
    mainLayout->setContentsMargins(10, 10, 10, 10);

    QWidget *windowContent = new QWidget(this);
    windowContent->setObjectName("WindowContent");
    windowContent->setStyleSheet(
        "#WindowContent { "
        "   background-color: #121212; "
        "   border-radius: 15px; "
        "   border: 1px solid #333; "
        "}"
        "QLabel { color: white; }"
    );
    windowContent->setMouseTracking(true);

    QVBoxLayout *contentLayout = new QVBoxLayout(windowContent);
    contentLayout->setContentsMargins(0, 0, 0, 0);
    contentLayout->setSpacing(0);

    m_titleBar = new QWidget(this);
    m_titleBar->setFixedHeight(80);
    QHBoxLayout *titleLayout = new QHBoxLayout(m_titleBar);
    titleLayout->setContentsMargins(20, 10, 20, 10);
    titleLayout->setSpacing(15);

    QLabel *logoLabel = new QLabel(this);
    QPixmap logoPix(":/Resources/Icons/icon_full.png");
    logoLabel->setPixmap(logoPix.scaled(200, 50, Qt::KeepAspectRatio, Qt::SmoothTransformation));
    titleLayout->addWidget(logoLabel);

    m_btnDownloader = new NavButton("Downloader", ":/Resources/Icons/downloader.png", true);
    titleLayout->addWidget(m_btnDownloader);

    titleLayout->addStretch();

    m_btnConsole = new NavButton("Console", ":/Resources/Icons/console.png", false);
    m_btnSettings = new NavButton("Settings", ":/Resources/Icons/settings.png", false);

    titleLayout->addWidget(m_btnConsole);
    titleLayout->addWidget(m_btnSettings);

    QWidget *controlsContainer = new QWidget(this);
    controlsContainer->setFixedSize(145, 40);
    controlsContainer->setStyleSheet("background-color: transparent; border-radius: 15px;");

    QHBoxLayout *controlsLayout = new QHBoxLayout(controlsContainer);
    controlsLayout->setContentsMargins(0, 0, 0, 0);
    controlsLayout->setSpacing(5);

    WindowControlBtn *btnMin = new WindowControlBtn(WindowControlBtn::Minimize);
    m_btnMax = new WindowControlBtn(WindowControlBtn::Maximize);
    WindowControlBtn *btnClose = new WindowControlBtn(WindowControlBtn::Close);

    connect(btnMin, &QPushButton::clicked, this, &QWidget::showMinimized);
    connect(m_btnMax, &QPushButton::clicked, this, &Container::toggleMaximize);
    connect(btnClose, &QPushButton::clicked, this, &Container::close); // Używamy close() kontenera

    controlsLayout->addWidget(btnMin);
    controlsLayout->addWidget(m_btnMax);
    controlsLayout->addWidget(btnClose);

    titleLayout->addWidget(controlsContainer);
    contentLayout->addWidget(m_titleBar);

    m_stackedWidget = new QStackedWidget(this);

    auto *pageDownloader = new DownloaderPage(this);
    auto *pageConsole = new ConsolePage(this);
    auto *pageSettings = new SettingsPage(m_popup, m_installer, this);

    m_stackedWidget->addWidget(pageDownloader);
    m_stackedWidget->addWidget(pageSettings);
    m_stackedWidget->addWidget(pageConsole);

    connect(pageDownloader->getDownloader(), &Downloader::outputLog, pageConsole, &ConsolePage::appendLog);

    contentLayout->addWidget(m_stackedWidget);
    mainLayout->addWidget(windowContent);

    QGraphicsDropShadowEffect *shadow = new QGraphicsDropShadowEffect(this);
    shadow->setBlurRadius(20);
    shadow->setColor(QColor(0, 0, 0, 150));
    shadow->setOffset(0, 0);
    windowContent->setGraphicsEffect(shadow);
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

void Container::setupConnections() {
    connect(m_btnDownloader, &QPushButton::clicked, [this](){ switchPage(0); });
    connect(m_btnSettings, &QPushButton::clicked, [this](){ switchPage(1); });
    connect(m_btnConsole, &QPushButton::clicked, [this](){ switchPage(2); });

     connect(m_installer, &InstallerWindow::upToDate, this, [this](const QString &appName){
        m_popup->showMessage("Info", appName + " is already up to date.", Popup::Info, Popup::Temporary);
    });
     connect(m_installer, &InstallerWindow::networkError, this, [this](bool isRateLimit){
         if (isRateLimit) m_popup->showMessage("Error", "Too many requests (GitHub API).", Popup::Error, Popup::Temporary);
         else m_popup->showMessage("Network Error", "No internet connection.", Popup::Error, Popup::Temporary);
    });
     connect(m_installer, &InstallerWindow::updateAvailable, this, [this](const QString &appName){
         m_popup->showMessage("Update Available", "New version of " + appName + " is available.", Popup::Info, Popup::Permanent, "Update");
         disconnect(m_popup, &Popup::actionClicked, nullptr, nullptr);
         connect(m_popup, &Popup::actionClicked, [this, appName](){ m_installer->startUpdateProcess(appName); });
    });
    connect(m_appUpdater, &AppUpdater::updateAvailable, this, [this](const QString &version){
        m_popup->showMessage("App Update", "Version " + version + " is available!", Popup::Success, Popup::Permanent, "Update Now");
        disconnect(m_popup, &Popup::actionClicked, nullptr, nullptr);
        connect(m_popup, &Popup::actionClicked, [this](){ m_appUpdater->startAppUpdate(); });
    });
}

void Container::switchPage(int index) {
    m_stackedWidget->setCurrentIndex(index);
    m_btnDownloader->setActive(index == 0);
    m_btnSettings->setActive(index == 1);
    m_btnConsole->setActive(index == 2);
}

void Container::closeEvent(QCloseEvent *event) {
    auto& config = ConfigManager::instance();
    QString behavior = config.getCloseBehavior();
    if (behavior == "Hide" && QSystemTrayIcon::isSystemTrayAvailable()) {
        this->hide();
        event->ignore();
    } else {
        event->accept();
        QApplication::quit();
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