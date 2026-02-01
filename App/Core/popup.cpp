#include "popup.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QGraphicsDropShadowEffect>
#include <QPainter>
#include <QGraphicsBlurEffect>
#include <QGraphicsScene>
#include <QGraphicsPixmapItem>

Popup::Popup(QWidget *parent) : QWidget(parent), isClosing(false) {
    setFixedSize(350, 130);
    setAttribute(Qt::WA_TranslucentBackground);
    hide();

    auto *layout = new QVBoxLayout(this);
    layout->setContentsMargins(5,5,5,5);

    bgWidget = new QWidget(this);
    bgWidget->setObjectName("PopupBg");
    bgWidget->setStyleSheet("#PopupBg { background: transparent; }");

    auto *contentLayout = new QVBoxLayout(bgWidget);
    contentLayout->setContentsMargins(15, 10, 15, 10);

    auto *headerLayout = new QHBoxLayout();
    titleLabel = new QLabel(this);
    titleLabel->setObjectName("PopupTitle");
    titleLabel->setFont(QFont("Montserrat ExtraBold", 11, QFont::Bold));
    titleLabel->setStyleSheet("background: transparent; color: white; border: none; font-weight: bold;");

    dismissBtn = new QPushButton("✕", this);
    dismissBtn->setFixedSize(24, 24);
    dismissBtn->setCursor(Qt::PointingHandCursor);
    dismissBtn->setStyleSheet("QPushButton { background: transparent; color: rgba(255,255,255,0.8); font-weight: bold; border: none; font-size: 14px; } QPushButton:hover { color: white; }");
    connect(dismissBtn, &QPushButton::clicked, this, &Popup::animateOut);

    headerLayout->addWidget(titleLabel);
    headerLayout->addStretch();
    headerLayout->addWidget(dismissBtn);
    contentLayout->addLayout(headerLayout);

    bodyLabel = new QLabel(this);
    bodyLabel->setWordWrap(true);
    bodyLabel->setStyleSheet("color: rgba(255,255,255,0.9); font-size: 13px; background: transparent; border: none;");
    contentLayout->addWidget(bodyLabel);
    contentLayout->addStretch();

    actionBtn = new QPushButton(this);
    actionBtn->setCursor(Qt::PointingHandCursor);
    actionBtn->setStyleSheet("QPushButton { background-color: rgba(255, 255, 255, 0.15); color: white; border: 1px solid rgba(255,255,255,0.4); border-radius: 4px; padding: 4px 10px; font-weight: bold; } QPushButton:hover { background-color: rgba(255, 255, 255, 0.25); }");
    connect(actionBtn, &QPushButton::clicked, this, [this](){
        emit actionClicked();
        animateOut();
    });
    contentLayout->addWidget(actionBtn, 0, Qt::AlignRight);

    layout->addWidget(bgWidget);

    auto *shadow = new QGraphicsDropShadowEffect(this);
    shadow->setBlurRadius(30);
    shadow->setColor(QColor(0,0,0,90));
    shadow->setOffset(0, 5);
    bgWidget->setGraphicsEffect(shadow);

    posAnimation = new QPropertyAnimation(this, "pos", this);
    posAnimation->setDuration(500);
    posAnimation->setEasingCurve(QEasingCurve::OutCubic);
    connect(posAnimation, &QPropertyAnimation::finished, this, &Popup::onAnimationFinished);

    autoCloseTimer = new QTimer(this);
    autoCloseTimer->setSingleShot(true);
    connect(autoCloseTimer, &QTimer::timeout, this, &Popup::animateOut);
}

void Popup::captureAndBlurBackground() {
    if (!parentWidget()) return;

    QPixmap parentPix(parentWidget()->size());
    parentWidget()->render(&parentPix);

    QGraphicsScene scene;
    QGraphicsPixmapItem item;
    item.setPixmap(parentPix);
    auto *blur = new QGraphicsBlurEffect;
    blur->setBlurRadius(25);
    blur->setBlurHints(QGraphicsBlurEffect::PerformanceHint);
    item.setGraphicsEffect(blur);
    scene.addItem(&item);

    blurredBackground = QPixmap(parentPix.size());
    blurredBackground.fill(Qt::transparent);
    QPainter ptr(&blurredBackground);
    scene.render(&ptr, QRectF(), parentPix.rect());
}

void Popup::paintEvent(QPaintEvent *event) {
    QPainter p(this);
    p.setRenderHint(QPainter::Antialiasing);

    QRect bgRect = rect().adjusted(5, 5, -5, -5);

    QPainterPath path;
    path.addRoundedRect(bgRect, 12, 12);

    p.save();
    p.setClipPath(path);

    if (!blurredBackground.isNull()) {
        p.drawPixmap(0, 0, blurredBackground, x(), y(), width(), height());
    }

    p.setBrush(overlayColor);
    p.setPen(Qt::NoPen);
    p.drawRect(rect());

    p.restore();
}

void Popup::applyStyle(Type type) {
    if (type == Info) {
        overlayColor = QColor(0, 120, 215, 120);
    } else if (type == Error) {
        overlayColor = QColor(220, 53, 69, 120);
    } else {
        overlayColor = QColor(40, 167, 69, 120);
    }
    update();
}

void Popup::showMessage(const QString &title, const QString &body, Type type, Mode mode, const QString &actionText) {
    titleLabel->setText(title);
    bodyLabel->setText(body);
    applyStyle(type);

    dismissBtn->setVisible(mode == Permanent);
    if (!actionText.isEmpty()) {
        actionBtn->setText(actionText);
        actionBtn->show();
    } else {
        actionBtn->hide();
    }

    captureAndBlurBackground();

    posAnimation->stop();
    autoCloseTimer->stop();
    isClosing = false;
    show();
    raise();
    animateIn();
    if (mode == Temporary) {
        autoCloseTimer->start(4000);
    }
}

void Popup::animateIn() {
    if (!parentWidget()) return;
    int endX = parentWidget()->width() - width() - 20;
    int endY = parentWidget()->height() - height() - 20;
    move(parentWidget()->width(), endY);
    posAnimation->setStartValue(QPoint(parentWidget()->width(), endY));
    posAnimation->setEndValue(QPoint(endX, endY));
    posAnimation->start();
}

void Popup::animateOut() {
    if (!parentWidget()) return;
    isClosing = true;
    int currentY = y();
    posAnimation->setStartValue(pos());
    posAnimation->setEndValue(QPoint(parentWidget()->width() + 20, currentY));
    posAnimation->start();
}

void Popup::onAnimationFinished() {
    if (isClosing) hide();
}