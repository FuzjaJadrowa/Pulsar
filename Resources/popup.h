#ifndef POPUP_H
#define POPUP_H

#include <QWidget>
#include <QLabel>
#include <QPushButton>
#include <QTimer>
#include <QPropertyAnimation>

class Popup : public QWidget {
    Q_OBJECT
    Q_PROPERTY(QPoint pos READ pos WRITE move)

public:
    enum Type { Info, Error, Success };
    enum Mode { Temporary, Permanent };

    explicit Popup(QWidget *parent = nullptr);
    void showMessage(const QString &title, const QString &body, Type type, Mode mode);

private slots:
    void animateIn();
    void animateOut();
    void onAnimationFinished();

private:
    QWidget *bgWidget;
    QLabel *titleLabel;
    QLabel *bodyLabel;
    QPushButton *dismissBtn;

    QTimer *autoCloseTimer;
    QPropertyAnimation *posAnimation;
    bool isClosing;

    void applyStyle(Type type);
    void updatePosition();
};

#endif