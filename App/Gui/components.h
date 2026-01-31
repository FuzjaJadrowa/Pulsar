#ifndef COMPONENTS_H
#define COMPONENTS_H

#include <QPushButton>
#include <QCheckBox>
#include <QRadioButton>
#include <QPropertyAnimation>
#include <QPainter>
#include <QEvent>
#include <QParallelAnimationGroup>

class StyleHelper {
public:
    static QString getGlobalStyle() {
        return R"(
            QWidget {
                font-family: "Roboto", "Segoe UI", sans-serif;
                color: #e0e0e0;
                font-size: 14px;
            }
            QScrollBar:vertical {
                border: none;
                background: #1d1d1d;
                width: 14px;
                margin: 0px;
                border-radius: 0px;
            }
            QScrollBar::handle:vertical {
                background: #444;
                min-height: 30px;
                border-radius: 7px;
                margin: 2px;
            }
            QScrollBar::handle:vertical:hover { background: #6200ea; }
            QScrollBar::handle:vertical:pressed { background: #7c4dff; }
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical { height: 0px; }
            QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical { background: none; }
            QScrollBar:horizontal {
                border: none;
                background: #1d1d1d;
                height: 14px;
                margin: 0px;
                border-radius: 0px;
            }
            QScrollBar::handle:horizontal {
                background: #444;
                min-width: 30px;
                border-radius: 7px;
                margin: 2px;
            }
            QScrollBar::handle:horizontal:hover { background: #6200ea; }
            QScrollBar::handle:horizontal:pressed { background: #7c4dff; }
            QScrollBar::add-line:horizontal, QScrollBar::sub-line:horizontal { width: 0px; }
            QScrollBar::add-page:horizontal, QScrollBar::sub-page:horizontal { background: none; }
            QScrollArea { background: transparent; border: none; }
            QComboBox {
                background-color: #2d2d2d;
                border: 1px solid #3d3d3d;
                border-radius: 8px;
                padding: 5px 10px;
                color: white;
            }
            QComboBox:hover { border: 1px solid #555; }
            QComboBox:disabled {
                background-color: #1a1a1a;
                color: #555;
                border: 1px solid #252525;
            }
            QComboBox::drop-down { border: none; width: 20px; }
            QComboBox::down-arrow { image: none; border: none; }
            QComboBox QAbstractItemView {
                background-color: #252525;
                border: 1px solid #3d3d3d;
                selection-background-color: #6200ea;
                outline: none;
                border-radius: 4px;
                padding: 4px;
            }
            QLineEdit {
                background-color: #252525;
                border: 1px solid #3d3d3d;
                border-radius: 8px;
                padding: 8px 12px;
                color: white;
                selection-background-color: #6200ea;
            }
            QLineEdit:focus {
                border: 1px solid #6200ea;
                background-color: #2a2a2a;
            }
            QLineEdit:disabled {
                background-color: #1a1a1a;
                color: #555;
                border: 1px solid #252525;
            }
            #PageTitle {
                font-family: "Montserrat ExtraBold", "Roboto", sans-serif;
                font-size: 26px;
                font-weight: bold;
                color: white;
            }
            #SectionHeader {
                font-size: 16px;
                font-weight: bold;
                color: #bbbbbb;
                margin-top: 15px;
                margin-bottom: 5px;
            }
        )";
    }
};

class AnimatedButton : public QPushButton {
    Q_OBJECT
    Q_PROPERTY(QColor backgroundColor READ backgroundColor WRITE setBackgroundColor)
    Q_PROPERTY(qreal scaleFactor READ scaleFactor WRITE setScaleFactor)

public:
    explicit AnimatedButton(const QString &text, QWidget *parent = nullptr, QColor base = QColor("#6200ea"), QColor hover = QColor("#7c4dff"));

    QColor backgroundColor() const { return m_bgColor; }
    void setBackgroundColor(const QColor &c) { m_bgColor = c; update(); }
    qreal scaleFactor() const { return m_scale; }
    void setScaleFactor(qreal s) { m_scale = s; update(); }

protected:
    void enterEvent(QEnterEvent *e) override;
    void leaveEvent(QEvent *e) override;
    void mousePressEvent(QMouseEvent *e) override;
    void mouseReleaseEvent(QMouseEvent *e) override;
    void paintEvent(QPaintEvent *e) override;

private:
    QColor m_bgColor;
    QColor m_baseColor;
    QColor m_hoverColor;
    qreal m_scale = 1.0;
};

class AnimatedCheckBox : public QCheckBox {
    Q_OBJECT
    Q_PROPERTY(qreal progress READ progress WRITE setProgress)

public:
    explicit AnimatedCheckBox(const QString &text, QWidget *parent = nullptr);

    QSize sizeHint() const override;
    QSize minimumSizeHint() const override;

    qreal progress() const { return m_progress; }
    void setProgress(qreal p) { m_progress = p; update(); }

protected:
    void checkStateSet() override;
    void paintEvent(QPaintEvent *e) override;
    bool hitButton(const QPoint &pos) const override;
    void showEvent(QShowEvent *e) override;
    void enterEvent(QEnterEvent *e) override { m_hover = true; update(); QCheckBox::enterEvent(e); }
    void leaveEvent(QEvent *e) override { m_hover = false; update(); QCheckBox::leaveEvent(e); }

private:
    qreal m_progress = 0.0;
    bool m_hover = false;
    const int m_boxSize = 22;
    const int m_spacing = 10;
};

class AnimatedRadioButton : public QRadioButton {
    Q_OBJECT
    Q_PROPERTY(qreal progress READ progress WRITE setProgress)

public:
    explicit AnimatedRadioButton(const QString &text, QWidget *parent = nullptr);
    QSize sizeHint() const override;
    QSize minimumSizeHint() const override;

    qreal progress() const { return m_progress; }
    void setProgress(qreal p) { m_progress = p; update(); }

protected:
    void paintEvent(QPaintEvent *e) override;
    bool hitButton(const QPoint &pos) const override;
    void checkStateSet() override;
    void showEvent(QShowEvent *e) override;

private:
    qreal m_progress = 0.0;
    const int m_circleSize = 20;
    const int m_spacing = 10;
};

#endif