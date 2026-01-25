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
#include "popup.h"
#include "../Installer/installer_window.h"

class SettingsPage : public QWidget {
    Q_OBJECT
public:
    explicit SettingsPage(Popup *popup, InstallerWindow *installer, QWidget *parent = nullptr);
    signals:
        void themeChanged();

private slots:
    void onThemeChanged(const QString &theme);
    void onLangChanged(const QString &lang);
    void onCloseBehaviorChanged(QAbstractButton *btn);
    void checkFfmpeg();
    void checkYtdlp();
    void onCookiesChanged(const QString &browser);
    void onIgnoreErrorsToggled(bool checked);
    void onGeoBypassToggled(bool checked);
    void onVideoFormatChanged(const QString &val);
    void onVideoQualityChanged(const QString &val);
    void onAudioFormatChanged(const QString &val);
    void onAudioQualityChanged(const QString &val);

private:
    Popup *popup;
    InstallerWindow *m_installer;
    QPushButton *btnFfmpeg;
    QPushButton *btnYtdlp;

    void setupUi();
    QHBoxLayout* createSection(const QString &title, QWidget *widget);
    QHBoxLayout* createReqRow(const QString &name, QPushButton *btn);
    QVBoxLayout* createVerticalCombo(const QString &label, QComboBox *combo);
};

#endif