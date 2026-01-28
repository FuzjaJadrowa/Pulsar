#include "popup.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QGraphicsDropShadowEffect>

Popup::Popup(QWidget *parent) : QWidget(parent), isClosing(false) {
    setFixedSize(350, 130);
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
    titleLabel->setObjectName("PopupTitle");
    titleLabel->setFont(QFont("Montserrat ExtraBold", 11, QFont::Bold));
    titleLabel->setStyleSheet("background: transparent; color: white; border: none; font-weight: bold;");

    dismissBtn = new QPushButton("✕", this);
    dismissBtn->setFixedSize(24, 24);
    dismissBtn->setCursor(Qt::PointingHandCursor);
    dismissBtn->setStyleSheet("QPushButton { background: transparent; color: white; font-weight: bold; border: none; font-size: 14px; } QPushButton:hover { color: #eeeeee; }");
    connect(dismissBtn, &QPushButton::clicked, this, &Popup::animateOut);

    headerLayout->addWidget(titleLabel);
    headerLayout->addStretch();
    headerLayout->addWidget(dismissBtn);
    contentLayout->addLayout(headerLayout);

    bodyLabel = new QLabel(this);
    bodyLabel->setWordWrap(true);
    bodyLabel->setStyleSheet("color: white; font-size: 13px; background: transparent; border: none;");
    contentLayout->addWidget(bodyLabel);
    contentLayout->addStretch();

    actionBtn = new QPushButton(this);
    actionBtn->setCursor(Qt::PointingHandCursor);
    actionBtn->setStyleSheet("background: rgba(255,255,255,0.2); color: white; border: 1px solid white; border-radius: 4px; padding: 4px 10px; font-weight: bold;");
    connect(actionBtn, &QPushButton::clicked, this, [this](){
        emit actionClicked();
        animateOut();
    });
    contentLayout->addWidget(actionBtn, 0, Qt::AlignRight);

    layout->addWidget(bgWidget);

    auto *shadow = new QGraphicsDropShadowEffect(this);
    shadow->setBlurRadius(20);
    shadow->setColor(QColor(0,0,0,100));
    shadow->setOffset(0, 4);
    bgWidget->setGraphicsEffect(shadow);

    posAnimation = new QPropertyAnimation(this, "pos", this);
    posAnimation->setDuration(500);
    posAnimation->setEasingCurve(QEasingCurve::OutCubic);
    connect(posAnimation, &QPropertyAnimation::finished, this, &Popup::onAnimationFinished);

    autoCloseTimer = new QTimer(this);
    autoCloseTimer->setSingleShot(true);
    connect(autoCloseTimer, &QTimer::timeout, this, &Popup::animateOut);
}

void Popup::applyStyle(Type type) {
    QString bgColor;
    if (type == Info) bgColor = "#0078D7";
    else if (type == Error) bgColor = "#DC3545";
    else bgColor = "#28A745";

    bgWidget->setStyleSheet(QString("#PopupBg { background-color: %1; border-radius: 8px; }").arg(bgColor));
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