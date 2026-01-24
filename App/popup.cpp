#include "popup.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QGraphicsDropShadowEffect>

Popup::Popup(QWidget *parent) : QWidget(parent), isClosing(false) {
    setFixedSize(350, 100);
    setAttribute(Qt::WA_TranslucentBackground);
    hide();

    auto *layout = new QVBoxLayout(this);
    layout->setContentsMargins(5,5,5,5);

    bgWidget = new QWidget(this);
    bgWidget->setObjectName("PopupBg");

    auto *contentLayout = new QVBoxLayout(bgWidget);
    contentLayout->setContentsMargins(15, 10, 15, 10);

    auto *headerLayout = new QHBoxLayout();
    titleLabel = new QLabel(this);
    titleLabel->setFont(QFont("Montserrat ExtraBold", 11, QFont::Bold));
    titleLabel->setStyleSheet("background: transparent; color: white; border: none;");

    dismissBtn = new QPushButton("✕", this);
    dismissBtn->setFixedSize(24, 24);
    dismissBtn->setCursor(Qt::PointingHandCursor);
    dismissBtn->setStyleSheet("QPushButton { background: transparent; color: white; font-weight: bold; border: none; font-size: 14px; } QPushButton:hover { color: #eeeeee; }");
    connect(dismissBtn, &QPushButton::clicked, this, &Popup::animateOut);

    headerLayout->addWidget(titleLabel);
    headerLayout->addStretch();
    headerLayout->addWidget(dismissBtn);

    bodyLabel = new QLabel(this);
    bodyLabel->setWordWrap(true);
    bodyLabel->setFont(QFont("Segoe UI", 10));
    bodyLabel->setStyleSheet("background: transparent; color: white; border: none;");

    contentLayout->addLayout(headerLayout);
    contentLayout->addWidget(bodyLabel);
    contentLayout->addStretch();

    layout->addWidget(bgWidget);

    auto *shadow = new QGraphicsDropShadowEffect(this);
    shadow->setBlurRadius(15);
    shadow->setColor(QColor(0,0,0,100));
    shadow->setOffset(0,4);
    bgWidget->setGraphicsEffect(shadow);

    autoCloseTimer = new QTimer(this);
    autoCloseTimer->setSingleShot(true);
    connect(autoCloseTimer, &QTimer::timeout, this, &Popup::animateOut);

    posAnimation = new QPropertyAnimation(this, "pos");
    posAnimation->setDuration(400);
    posAnimation->setEasingCurve(QEasingCurve::OutCubic);
    connect(posAnimation, &QPropertyAnimation::finished, this, &Popup::onAnimationFinished);
}

void Popup::showMessage(const QString &title, const QString &body, Type type, Mode mode) {
    titleLabel->setText(title);
    bodyLabel->setText(body);
    applyStyle(type);

    dismissBtn->setVisible(mode == Permanent);

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

void Popup::applyStyle(Type type) {
    QString color;
    if (type == Info) color = "#0078D7";
    else if (type == Error) color = "#D13438";
    else color = "#107C10";

    bgWidget->setStyleSheet(QString(
        "#PopupBg { "
        "  background-color: %1; "
        "  border-radius: 10px; "
        "  border: none; "
        "} "
        "QLabel { color: white; background: transparent; }"
    ).arg(color));
}

void Popup::updatePosition() {
    if (isVisible() && !isClosing && parentWidget()) {
        int endX = parentWidget()->width() - width() - 20;
        int endY = parentWidget()->height() - height() - 20;
        move(endX, endY);
    }
}