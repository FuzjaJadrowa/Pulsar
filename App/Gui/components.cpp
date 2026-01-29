#include "components.h"
#include <QPainterPath>

AnimatedButton::AnimatedButton(const QString &text, QWidget *parent, QColor base, QColor hover)
    : QPushButton(text, parent), m_baseColor(base), m_hoverColor(hover)
{
    m_bgColor = m_baseColor;
    setCursor(Qt::PointingHandCursor);
    setFixedHeight(45);
    setFont(QFont("Segoe UI", 10, QFont::Bold));
}

void AnimatedButton::enterEvent(QEnterEvent *e) {
    auto *anim = new QPropertyAnimation(this, "backgroundColor");
    anim->setDuration(200);
    anim->setStartValue(m_bgColor);
    anim->setEndValue(m_hoverColor);
    anim->start(QAbstractAnimation::DeleteWhenStopped);
    QPushButton::enterEvent(e);
}

void AnimatedButton::leaveEvent(QEvent *e) {
    auto *anim = new QPropertyAnimation(this, "backgroundColor");
    anim->setDuration(200);
    anim->setStartValue(m_bgColor);
    anim->setEndValue(m_baseColor);
    anim->start(QAbstractAnimation::DeleteWhenStopped);
    QPushButton::leaveEvent(e);
}

void AnimatedButton::mousePressEvent(QMouseEvent *e) {
    auto *anim = new QPropertyAnimation(this, "scaleFactor");
    anim->setDuration(50);
    anim->setStartValue(1.0);
    anim->setEndValue(0.96);
    anim->start(QAbstractAnimation::DeleteWhenStopped);
    QPushButton::mousePressEvent(e);
}

void AnimatedButton::mouseReleaseEvent(QMouseEvent *e) {
    auto *anim = new QPropertyAnimation(this, "scaleFactor");
    anim->setDuration(100);
    anim->setStartValue(m_scale);
    anim->setEndValue(1.0);
    anim->setEasingCurve(QEasingCurve::OutBack);
    anim->start(QAbstractAnimation::DeleteWhenStopped);
    QPushButton::mouseReleaseEvent(e);
}

void AnimatedButton::paintEvent(QPaintEvent *e) {
    QPainter p(this);
    p.setRenderHint(QPainter::Antialiasing);

    p.translate(width() / 2, height() / 2);
    p.scale(m_scale, m_scale);
    p.translate(-width() / 2, -height() / 2);

    if (isEnabled()) {
        p.setBrush(m_bgColor);
    } else {
        p.setBrush(QColor(60, 60, 60));
    }
    p.setPen(Qt::NoPen);
    p.drawRoundedRect(rect(), 8, 8);

    p.setPen(isEnabled() ? Qt::white : QColor(150, 150, 150));
    p.setFont(font());
    p.drawText(rect(), Qt::AlignCenter, text());
}

AnimatedCheckBox::AnimatedCheckBox(const QString &text, QWidget *parent)
    : QCheckBox(text, parent)
{
    setCursor(Qt::PointingHandCursor);
    setStyleSheet("QCheckBox { spacing: 8px; } QCheckBox::indicator { width: 0px; height: 0px; }");
}

void AnimatedCheckBox::checkStateSet() {
    auto *anim = new QPropertyAnimation(this, "progress");
    anim->setDuration(250);
    anim->setEasingCurve(QEasingCurve::InOutQuad);
    anim->setStartValue(m_progress);
    anim->setEndValue(isChecked() ? 1.0f : 0.0f);
    anim->start(QAbstractAnimation::DeleteWhenStopped);
    QCheckBox::checkStateSet();
}

void AnimatedCheckBox::paintEvent(QPaintEvent *e) {
    QPainter p(this);
    p.setRenderHint(QPainter::Antialiasing);

    int boxSize = 20;
    int yOffset = (height() - boxSize) / 2;
    QRect boxRect(0, yOffset, boxSize, boxSize);

    QColor uncheckedColor = m_hover ? QColor("#555") : QColor("#3d3d3d");
    QColor checkedColor = QColor("#6200ea");

    QColor currentColor;
    currentColor.setRed(uncheckedColor.red() + (checkedColor.red() - uncheckedColor.red()) * m_progress);
    currentColor.setGreen(uncheckedColor.green() + (checkedColor.green() - uncheckedColor.green()) * m_progress);
    currentColor.setBlue(uncheckedColor.blue() + (checkedColor.blue() - uncheckedColor.blue()) * m_progress);

    p.setBrush(currentColor);
    p.setPen(Qt::NoPen);
    p.drawRoundedRect(boxRect, 5, 5);

    if (m_progress > 0.1f) {
        QPainterPath path;
        path.moveTo(boxRect.x() + 5, boxRect.y() + 10);
        path.lineTo(boxRect.x() + 9, boxRect.y() + 14);
        path.lineTo(boxRect.x() + 15, boxRect.y() + 6);

        QPen pen(Qt::white, 2.5);
        pen.setCapStyle(Qt::RoundCap);
        pen.setJoinStyle(Qt::RoundJoin);
        p.setPen(pen);

        p.setClipRect(QRect(boxRect.x(), boxRect.y(), boxRect.width() * m_progress, boxRect.height()));
        p.drawPath(path);
    }

    p.setClipping(false);
    p.setPen(Qt::white);
    p.setFont(font());
    QRect textRect = rect().adjusted(boxSize + 10, 0, 0, 0);
    p.drawText(textRect, Qt::AlignVCenter | Qt::AlignLeft, text());
}