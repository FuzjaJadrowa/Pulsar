#ifndef QUEUE_PANEL_H
#define QUEUE_PANEL_H

#include <QWidget>
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QLabel>
#include <QPushButton>
#include <QScrollArea>
#include <QMouseEvent>
#include <QGraphicsBlurEffect>
#include <QPixmap>
#include <QPropertyAnimation>
#include "components.h"
#include "../Core/queue_manager.h"

class QueueControlBtn : public QPushButton {
    Q_OBJECT
public:
    enum Type { Start, Stop, Delete };
    QueueControlBtn(Type type, QWidget *parent = nullptr);
protected:
    void paintEvent(QPaintEvent *e) override;
    void enterEvent(QEnterEvent *e) override { m_hover = true; update(); }
    void leaveEvent(QEvent *e) override { m_hover = false; update(); }
private:
    Type m_type;
    bool m_hover = false;
};

class QueueItemWidget : public QWidget {
    Q_OBJECT
public:
    explicit QueueItemWidget(const QueueItem &item, QWidget *parent = nullptr);
    void updateProgress(double p);
    void updateStatus(const QString &status);
    QString getItemId() const { return m_id; }
    void animateRemoval(std::function<void()> onFinished);

protected:
    void paintEvent(QPaintEvent *e) override;

private:
    QString m_id;
    QLabel *m_title;
    QLabel *m_format;
    QLabel *m_progressLabel;

    QWidget *m_progressBar;
    QWidget *m_progressBg;

    QueueControlBtn *m_actionBtn;
    QueueControlBtn *m_btnDelete;
};

class QueuePanel : public QWidget {
    Q_OBJECT
public:
    explicit QueuePanel(QWidget *parent = nullptr);

    void toggle(const QPoint &targetPos);

    void refresh();
    QueueItemWidget* findWidgetById(const QString &id);
    int calculateContentHeight() const;
    void captureAndBlurBackground();

signals:
    void contentSizeChanged();

protected:
    void paintEvent(QPaintEvent *e) override;
    void mousePressEvent(QMouseEvent *e) override { e->accept(); }

private slots:
    void onStartAll();
    void onStopAll();
    void onClearQueue();
    void nextPage();
    void prevPage();

private:
    void updatePagination();
    void removeWithAnimation(const QString &id);

    QWidget *m_itemsContainer;
    QVBoxLayout *m_itemsLayout;
    QLabel *m_headerLabel;

    AnimatedButton *m_btnStartAll;
    AnimatedButton *m_btnStopAll;
    AnimatedButton *m_btnClear;

    QPushButton *m_btnPrev;
    QPushButton *m_btnNext;
    QLabel *m_pageLabel;

    QPixmap m_blurredBg;
    QPropertyAnimation *m_anim;

    int m_currentPage = 0;
    const int ITEMS_PER_PAGE = 4;
};

#endif