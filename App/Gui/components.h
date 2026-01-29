#ifndef COMPONENTS_H
#define COMPONENTS_H

#include <QPushButton>
#include <QCheckBox>
#include <QPropertyAnimation>
#include <QPainter>
#include <QEvent>
#include <QParallelAnimationGroup>

class StyleHelper {
public:
    static QString getGlobalStyle() {
        return R"(
            QWidget {
                font-family: "Segoe UI", "Montserrat", sans-serif;
                color: #e0e0e0;
                font-size: 14px;
            }
            QScrollBar:vertical {
                border: none;
                background: #1d1d1d;
                width: 10px;
                margin: 0px;
            }
            QScrollBar::handle:vertical {
                background: #444;
                min-height: 20px;
                border-radius: 5px;
            }
            QScrollBar::handle:vertical:hover { background: #555; }
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical { height: 0px; }
            QComboBox {
                background-color: #2d2d2d;
                border: 1px solid #3d3d3d;
                border-radius: 8px;
                padding: 5px 10px;
                color: white;
            }
            QComboBox:hover { border: 1px solid #555; }
            QComboBox::drop-down { border: none; }
            QComboBox::down-arrow {
                image: none;
                border-left: 5px solid transparent;
                border-right: 5px solid transparent;
                border-top: 5px solid #888;
                margin-right: 10px;
            }
            QComboBox QAbstractItemView {
                background-color: #252525;
                border: 1px solid #3d3d3d;
                selection-background-color: #6200ea;
                outline: none;
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
            #PageTitle {
                font-family: "Montserrat ExtraBold";
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
    Q_PROPERTY(float progress READ progress WRITE setProgress)

public:
    explicit AnimatedCheckBox(const QString &text, QWidget *parent = nullptr);

    float progress() const { return m_progress; }
    void setProgress(float p) {
        m_progress = p; update(); }

protected:
    void checkStateSet() override;
    void paintEvent(QPaintEvent *e) override;

    void enterEvent(QEnterEvent *e) override {
        m_hover = true;
        update();
        QCheckBox::enterEvent(e);
    }

    void leaveEvent(QEvent *e) override {
        m_hover = false;
        update();
        QCheckBox::leaveEvent(e);
    }

private:
    float m_progress = 0.0f;
    bool m_hover = false;
};

#endif