#ifndef COMPONENTS_H
#define COMPONENTS_H

#include <QPushButton>
#include <QCheckBox>
#include <QRadioButton>
#include <QPropertyAnimation>
#include <QPainter>
#include <QEvent>
#include <QParallelAnimationGroup>
#include <QApplication>
#include "../Core/config_manager.h"

class StyleHelper {
public:
    static bool isDarkMode() {
        return ConfigManager::instance().getTheme() != "Light";
    }

    static QString getComboBoxStyle(bool dark) {
        QString bg = dark ? "#252525" : "#ffffff";
        QString border = dark ? "#3d3d3d" : "#cccccc";
        QString text = dark ? "#e0e0e0" : "#333333";
        QString hover = dark ? "#2a2a2a" : "#f0f0f0";

        return QString(
            "QComboBox { background-color: %1; border: 1px solid %2; border-radius: 8px; padding: 5px 10px; color: %3; }"
            "QComboBox:hover { background-color: %4; border: 1px solid #999; }"
            "QComboBox::drop-down { border: none; width: 20px; }"
            "QComboBox::down-arrow { image: none; border: none; }"
            "QAbstractItemView { background-color: %1; color: %3; border: 1px solid %2; selection-background-color: #6200ea; outline: none; border-radius: 4px; padding: 4px; }"
        ).arg(bg, border, text, hover);
    }

    static QString getGlobalStyle(bool dark) {
        QString text = dark ? "#e0e0e0" : "#212529";
        QString scrollParams = dark ? "background: #1d1d1d;" : "background: #f0f0f0;";
        QString scrollHandle = dark ? "background: #444;" : "background: #bbb;";
        QString inputBg = dark ? "#252525" : "#ffffff";
        QString inputBorder = dark ? "#3d3d3d" : "#cccccc";
        QString headerColor = dark ? "#bbbbbb" : "#666666";

        return QString(R"(
            QWidget {
                font-family: "Roboto", "Segoe UI", sans-serif;
                color: %1;
                font-size: 14px;
            }
            QScrollBar:vertical { border: none; %2 width: 14px; margin: 0px; border-radius: 0px; }
            QScrollBar::handle:vertical { %3 min-height: 30px; border-radius: 7px; margin: 2px; }
            QScrollBar::handle:vertical:hover { background: #6200ea; }
            QScrollBar::handle:vertical:pressed { background: #7c4dff; }
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical { height: 0px; }
            QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical { background: none; }

            QScrollBar:horizontal { border: none; %2 height: 14px; margin: 0px; border-radius: 0px; }
            QScrollBar::handle:horizontal { %3 min-width: 30px; border-radius: 7px; margin: 2px; }
            QScrollBar::handle:horizontal:hover { background: #6200ea; }
            QScrollBar::handle:horizontal:pressed { background: #7c4dff; }
            QScrollBar::add-line:horizontal, QScrollBar::sub-line:horizontal { width: 0px; }
            QScrollBar::add-page:horizontal, QScrollBar::sub-page:horizontal { background: none; }

            QScrollArea { background: transparent; border: none; }

            QLineEdit {
                background-color: %4;
                border: 1px solid %5;
                border-radius: 8px;
                padding: 8px 12px;
                color: %1;
                selection-background-color: #6200ea;
            }
            QLineEdit:focus { border: 1px solid #6200ea; }

            #PageTitle { font-family: "Montserrat ExtraBold"; font-size: 26px; font-weight: bold; color: %1; }
            #SectionHeader { font-size: 16px; font-weight: bold; color: %6; margin-top: 15px; margin-bottom: 5px; }
        )").arg(text, scrollParams, scrollHandle, inputBg, inputBorder, headerColor);
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

    void setColors(const QColor &base, const QColor &hover);
    void setTextColor(const QColor &color);

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
    QColor m_textColor = Qt::white;
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

class AnimatedSwitch : public QCheckBox {
    Q_OBJECT
    Q_PROPERTY(qreal progress READ progress WRITE setProgress)

public:
    explicit AnimatedSwitch(QWidget *parent = nullptr);

    QSize sizeHint() const override;
    QSize minimumSizeHint() const override;

    qreal progress() const { return m_progress; }
    void setProgress(qreal p) { m_progress = p; update(); }

protected:
    void paintEvent(QPaintEvent *e) override;
    bool hitButton(const QPoint &pos) const override;
    void checkStateSet() override;
    void showEvent(QShowEvent *e) override;
    void enterEvent(QEnterEvent *e) override { m_hover = true; update(); QCheckBox::enterEvent(e); }
    void leaveEvent(QEvent *e) override { m_hover = false; update(); QCheckBox::leaveEvent(e); }

private:
    qreal m_progress = 0.0;
    bool m_hover = false;
    const int m_width = 44;
    const int m_height = 24;
};

#endif