#ifndef CONTAINER_H
#define CONTAINER_H

#include <QWidget>
#include <QStackedWidget>
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QPushButton>
#include <QLabel>
#include <QMouseEvent>
#include <QPropertyAnimation>
#include <QParallelAnimationGroup>
#include <QGraphicsDropShadowEffect>
#include <QWindow>

#include "../Core/popup.h"
#include "../Core/installer_window.h"
#include "../Core/app_updater.h"

class NavButton : public QPushButton {
    Q_OBJECT
    Q_PROPERTY(QColor backgroundColor READ backgroundColor WRITE setBackgroundColor)
    Q_PROPERTY(QColor borderColor READ borderColor WRITE setBorderColor)
    Q_PROPERTY(int fixedWidth READ fixedWidth WRITE setFixedWidth)

public:
    explicit NavButton(const QString &text, const QString &iconPath, bool isExpandable = false, QWidget *parent = nullptr);

    QColor backgroundColor() const { return m_backgroundColor; }
    void setBackgroundColor(const QColor &color);

    QColor borderColor() const { return m_borderColor; }
    void setBorderColor(const QColor &color);

    int fixedWidth() const { return width(); }

    void setActive(bool active);

protected:
    void enterEvent(QEnterEvent *event) override;
    void leaveEvent(QEvent *event) override;
    void paintEvent(QPaintEvent *event) override;

private:
    bool m_isActive = false;
    bool m_isExpandable = false;
    QColor m_backgroundColor;
    QColor m_borderColor;
    QString m_text;
    QPixmap m_icon;
};

class WindowControlBtn : public QPushButton {
    Q_OBJECT
    Q_PROPERTY(QColor hoverColor READ hoverColor WRITE setHoverColor)

public:
    explicit WindowControlBtn(const QString &iconPath, QWidget *parent = nullptr);

    QColor hoverColor() const { return m_hoverColor; }
    void setHoverColor(const QColor &color) { m_hoverColor = color; update(); }

    void setIconPath(const QString &path);

protected:
    void enterEvent(QEnterEvent *event) override;
    void leaveEvent(QEvent *event) override;
    void paintEvent(QPaintEvent *event) override;

private:
    bool m_isHovered = false;
    QColor m_hoverColor;
    QPixmap m_iconPix;
};

class Container : public QWidget {
    Q_OBJECT

public:
    explicit Container(QWidget *parent = nullptr);

    InstallerWindow* installer() const { return m_installer; }
    AppUpdater* appUpdater() const { return m_appUpdater; }

protected:
    void mousePressEvent(QMouseEvent *event) override;
    void mouseMoveEvent(QMouseEvent *event) override;
    void mouseReleaseEvent(QMouseEvent *event) override;

    bool nativeEvent(const QByteArray &eventType, void *message, qintptr *result) override;

private slots:
    void switchPage(int index);
    void toggleMaximize();

private:
    void setupUi();
    void setupConnections();
    void initLogic();

    Qt::Edges getEdges(const QPoint &pos);
    void updateCursorShape(const QPoint &pos);

    Popup *m_popup;
    InstallerWindow *m_installer;
    AppUpdater *m_appUpdater;

    QWidget *m_titleBar;
    QStackedWidget *m_stackedWidget;

    NavButton *m_btnDownloader;
    NavButton *m_btnSettings;
    NavButton *m_btnConsole;

    WindowControlBtn *m_btnMax;

    QPoint m_dragPosition;
    bool m_isDragging = false;
    bool m_isResizing = false;
    int m_borderWidth = 8;
};

#endif