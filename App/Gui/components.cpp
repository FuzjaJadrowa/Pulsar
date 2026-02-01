#include "components.h"
#include <QPainterPath>
#include <QVariantAnimation>

AnimatedButton::AnimatedButton(const QString &text, QWidget *parent, QColor base, QColor hover)
    : QPushButton(text, parent), m_baseColor(base), m_hoverColor(hover)
{
    m_bgColor = m_baseColor;
    setCursor(Qt::PointingHandCursor);
    setFixedHeight(45);
    setFont(QFont("Roboto", 10, QFont::Bold));
}

// --- NOWE METODY ---
void AnimatedButton::setColors(const QColor &base, const QColor &hover) {
    m_baseColor = base;
    m_hoverColor = hover;
    // Jeśli nie jest najechany, zresetuj tło do bazy
    if (!underMouse()) {
        m_bgColor = m_baseColor;
    }
    update();
}

void AnimatedButton::setTextColor(const QColor &color) {
    m_textColor = color;
    update();
}
// -------------------

void AnimatedButton::enterEvent(QEnterEvent *e) {
    if (!isEnabled()) return;
    auto *anim = new QPropertyAnimation(this, "backgroundColor");
    anim->setDuration(200);
    anim->setStartValue(m_bgColor);
    anim->setEndValue(m_hoverColor);
    anim->start(QAbstractAnimation::DeleteWhenStopped);
    QPushButton::enterEvent(e);
}

void AnimatedButton::leaveEvent(QEvent *e) {
    if (!isEnabled()) return;
    auto *anim = new QPropertyAnimation(this, "backgroundColor");
    anim->setDuration(200);
    anim->setStartValue(m_bgColor);
    anim->setEndValue(m_baseColor);
    anim->start(QAbstractAnimation::DeleteWhenStopped);
    QPushButton::leaveEvent(e);
}

void AnimatedButton::mousePressEvent(QMouseEvent *e) {
    if (!isEnabled()) return;
    auto *anim = new QPropertyAnimation(this, "scaleFactor");
    anim->setDuration(50);
    anim->setStartValue(1.0);
    anim->setEndValue(0.96);
    anim->start(QAbstractAnimation::DeleteWhenStopped);
    QPushButton::mousePressEvent(e);
}

void AnimatedButton::mouseReleaseEvent(QMouseEvent *e) {
    if (!isEnabled()) { QPushButton::mouseReleaseEvent(e); return; }
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
        p.setPen(Qt::NoPen);
    } else {
        p.setBrush(QColor(45, 45, 45));
        p.setPen(QColor(60, 60, 60));
    }
    p.drawRoundedRect(rect(), 8, 8);

    // Używamy m_textColor zamiast Qt::white na sztywno
    p.setPen(isEnabled() ? m_textColor : QColor(100, 100, 100));
    p.setFont(font());
    p.drawText(rect(), Qt::AlignCenter, text());
}

AnimatedCheckBox::AnimatedCheckBox(const QString &text, QWidget *parent)
    : QCheckBox(text, parent)
{
    setCursor(Qt::PointingHandCursor);
    setMinimumHeight(22);
    setSizePolicy(QSizePolicy::Preferred, QSizePolicy::Fixed);

    m_progress = isChecked() ? 1.0 : 0.0;

    connect(this, &QCheckBox::toggled, this, [this](bool checked){
        auto *anim = new QVariantAnimation(this);
        anim->setDuration(180);
        anim->setEasingCurve(QEasingCurve::InOutQuad);
        anim->setStartValue(m_progress);
        anim->setEndValue(checked ? 1.0 : 0.0);

        connect(anim, &QVariantAnimation::valueChanged, this, [this](const QVariant &v){
            m_progress = v.toReal();
            update();
        });

        anim->start(QAbstractAnimation::DeleteWhenStopped);
    });
}

QSize AnimatedCheckBox::sizeHint() const {
    QSize s = QCheckBox::sizeHint();
    QFontMetrics fm(font());
    int textWidth = fm.horizontalAdvance(text());
    return QSize(textWidth + m_boxSize + m_spacing + 5, qMax(s.height(), m_boxSize));
}
QSize AnimatedCheckBox::minimumSizeHint() const { return sizeHint(); }

bool AnimatedCheckBox::hitButton(const QPoint &pos) const {
    return rect().contains(pos);
}

void AnimatedCheckBox::showEvent(QShowEvent *e) {
    m_progress = isChecked() ? 1.0 : 0.0;
    QCheckBox::showEvent(e);
}

void AnimatedCheckBox::checkStateSet() {
    QCheckBox::checkStateSet();

    auto *anim = new QVariantAnimation(this);
    anim->setDuration(200);
    anim->setEasingCurve(QEasingCurve::InOutQuad);
    anim->setStartValue(m_progress);
    anim->setEndValue(isChecked() ? 1.0 : 0.0);

    connect(anim, &QVariantAnimation::valueChanged, this, [this](const QVariant &val){
        m_progress = val.toReal();
        this->repaint();
    });

    anim->start(QAbstractAnimation::DeleteWhenStopped);
}

void AnimatedCheckBox::paintEvent(QPaintEvent *e) {
    QPainter p(this);
    p.setRenderHint(QPainter::Antialiasing);

    int yOffset = (height() - m_boxSize) / 2;
    QRect boxRect(0, yOffset, m_boxSize, m_boxSize);

    // --- LOGIKA KOLORÓW ---
    bool dark = StyleHelper::isDarkMode();

    // Puste tło: ciemne w Dark Mode, jasnoszare w Light Mode
    QColor bgUnchecked = dark ? QColor("#2d2d2d") : QColor("#e0e0e0");

    // Ramka
    QColor borderUnchecked = m_hover ? (dark ? QColor("#888") : QColor("#999"))
                                     : (dark ? QColor("#555") : QColor("#bbb"));

    QColor checkedColor = QColor("#6200ea");
    QColor textColor = dark ? Qt::white : QColor("#333333");

    if (!isEnabled()) {
        borderUnchecked = QColor("#333");
        bgUnchecked = QColor("#1f1f1f");
        checkedColor = QColor("#444");
        textColor = QColor(100, 100, 100);
    }

    if (m_progress < 1.0) {
        p.setPen(Qt::NoPen);
        p.setBrush(bgUnchecked);
        p.drawRoundedRect(boxRect, 6, 6);

        p.setBrush(Qt::NoBrush);
        p.setPen(QPen(borderUnchecked, 2));
        p.drawRoundedRect(boxRect.adjusted(1, 1,-1,-1), 6, 6);
    }

    if (m_progress > 0.0) {
        p.setPen(Qt::NoPen);
        p.setBrush(checkedColor);
        qreal margin = (1.0 - m_progress) * (m_boxSize / 2.0);
        p.drawRoundedRect(QRectF(boxRect).adjusted(margin, margin, -margin, -margin), 6, 6);
    }

    if (m_progress > 0.4) {
        QPainterPath path;
        path.moveTo(boxRect.x() + 5, boxRect.y() + 11);
        path.lineTo(boxRect.x() + 9, boxRect.y() + 15);
        path.lineTo(boxRect.x() + 16, boxRect.y() + 6);

        QPen pen(isEnabled() ? Qt::white : QColor(150, 150, 150), 3.0);
        pen.setCapStyle(Qt::RoundCap);
        pen.setJoinStyle(Qt::RoundJoin);
        p.setPen(pen);
        p.drawPath(path);
    }

    p.setPen(textColor);
    p.setFont(font());
    QRect textRect = rect().adjusted(m_boxSize + m_spacing, 0, 0, 0);
    p.drawText(textRect, Qt::AlignVCenter | Qt::AlignLeft, text());
}

AnimatedRadioButton::AnimatedRadioButton(const QString &text, QWidget *parent)
    : QRadioButton(text, parent)
{
    setCursor(Qt::PointingHandCursor);
    setMinimumHeight(22);
    setSizePolicy(QSizePolicy::Preferred, QSizePolicy::Fixed);

    m_progress = isChecked() ? 1.0 : 0.0;

    connect(this, &QRadioButton::toggled, this, [this](bool checked){
        auto *anim = new QVariantAnimation(this);
        anim->setDuration(180);
        anim->setEasingCurve(QEasingCurve::InOutQuad);
        anim->setStartValue(m_progress);
        anim->setEndValue(checked ? 1.0 : 0.0);

        connect(anim, &QVariantAnimation::valueChanged, this, [this](const QVariant &v){
            m_progress = v.toReal();
            update();
        });

        anim->start(QAbstractAnimation::DeleteWhenStopped);
    });
}

QSize AnimatedRadioButton::sizeHint() const {
    QFontMetrics fm(font());
    int textWidth = fm.horizontalAdvance(text());
    return QSize(textWidth + m_circleSize + m_spacing + 5, qMax(24, m_circleSize));
}
QSize AnimatedRadioButton::minimumSizeHint() const { return sizeHint(); }

bool AnimatedRadioButton::hitButton(const QPoint &pos) const {
    return rect().contains(pos);
}

void AnimatedRadioButton::showEvent(QShowEvent *e) {
    m_progress = isChecked() ? 1.0 : 0.0;
    QRadioButton::showEvent(e);
}

void AnimatedRadioButton::checkStateSet() {
    QRadioButton::checkStateSet();

    auto *anim = new QVariantAnimation(this);
    anim->setDuration(200);
    anim->setEasingCurve(QEasingCurve::OutQuad);
    anim->setStartValue(m_progress);
    anim->setEndValue(isChecked() ? 1.0 : 0.0);

    connect(anim, &QVariantAnimation::valueChanged, this, [this](const QVariant &val){
        m_progress = val.toReal();
        this->repaint();
    });

    anim->start(QAbstractAnimation::DeleteWhenStopped);
}

void AnimatedRadioButton::paintEvent(QPaintEvent *e) {
    QPainter p(this);
    p.setRenderHint(QPainter::Antialiasing);

    int yOffset = (height() - m_circleSize) / 2;
    QRect circleRect(0, yOffset, m_circleSize, m_circleSize);

    QColor borderColor = (isChecked() || isDown()) ? QColor("#6200ea") : QColor("#666");
    if (!isEnabled()) borderColor = QColor("#333");

    QColor textColor = StyleHelper::isDarkMode() ? Qt::white : QColor("#333333");
    if (!isEnabled()) textColor = QColor(100, 100, 100);

    p.setPen(QPen(borderColor, 2));
    p.setBrush(Qt::NoBrush);
    p.drawEllipse(circleRect.adjusted(1,1,-1,-1));

    if (m_progress > 0.01) {
        p.setPen(Qt::NoPen);
        p.setBrush(isEnabled() ? QColor("#6200ea") : QColor("#444"));

        qreal margin = 4.0 + (1.0 - m_progress) * 4.0;

        QRectF innerRect = QRectF(circleRect).adjusted(margin, margin, -margin, -margin);
        if (innerRect.isValid()) {
             p.drawEllipse(innerRect);
        }
    }

    p.setPen(textColor);
    p.setFont(font());
    QRect textRect = rect().adjusted(m_circleSize + m_spacing, 0, 0, 0);
    p.drawText(textRect, Qt::AlignVCenter | Qt::AlignLeft, text());
}