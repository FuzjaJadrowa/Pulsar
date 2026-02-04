#ifndef SETTINGS_PAGE_H
#define SETTINGS_PAGE_H

#include <QWidget>
#include <QPushButton>
#include <QComboBox>
#include <QRadioButton>
#include <QButtonGroup>
#include <QCheckBox>
#include <QHBoxLayout>
#include <QVBoxLayout>
#include <QLabel>
#include <QScrollArea>
#include <QStyleOption>
#include <QPainter>
#include <QDesktopServices>
#include <QUrl>
#include "../System/popup.h"

class SettingsPage : public QWidget {
    Q_OBJECT
public:
    explicit SettingsPage(Popup *popup, QWidget *parent = nullptr);
    void refreshStyles();

    signals:
        void themeChanged();

private slots:
    void onThemeChanged(const QString &theme);
    void onLangChanged(const QString &lang);
    void onCloseBehaviorChanged(QAbstractButton *btn);
    void onCookiesChanged(const QString &browser);
    void onGeoBypassToggled(bool checked);
    void onVideoFormatChanged(const QString &val);
    void onVideoQualityChanged(const QString &val);
    void onAudioFormatChanged(const QString &val);
    void onAudioQualityChanged(const QString &val);
    void onSupportClicked();

private:
    Popup *popup;
    void setupUi();
    QHBoxLayout* createSection(const QString &title, QWidget *widget);
    QVBoxLayout* createVerticalCombo(const QString &label, QComboBox *combo);
    QLabel *iconLabel;
};

#endif