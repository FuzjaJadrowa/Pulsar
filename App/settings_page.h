#ifndef SETTINGS_PAGE_H
#define SETTINGS_PAGE_H

#include <QWidget>
#include <QPushButton>
#include <QComboBox>
#include <QRadioButton>
#include <QButtonGroup>
#include <QHBoxLayout>
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

private:
    Popup *popup;
    InstallerWindow *m_installer;
    QPushButton *btnFfmpeg;
    QPushButton *btnYtdlp;

    void setupUi();
    QHBoxLayout* createSection(const QString &title, QWidget *widget);
    QHBoxLayout* createReqRow(const QString &name, QPushButton *btn);
};

#endif