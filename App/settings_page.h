#ifndef SETTINGS_PAGE_H
#define SETTINGS_PAGE_H

#include <QWidget>
#include <QLabel>
#include <QPushButton>
#include <QComboBox>
#include <QRadioButton>
#include <QButtonGroup>
#include <QHBoxLayout>
#include "../Resources/popup.h"
#include "dependency_manager.h"

class SettingsPage : public QWidget {
    Q_OBJECT
public:
    explicit SettingsPage(Popup *popup, QWidget *parent = nullptr);
    signals:
        void themeChanged();

private slots:
    void onThemeChanged(const QString &theme);
    void onLangChanged(const QString &lang);
    void onCloseBehaviorChanged(QAbstractButton *btn);
    void checkFfmpeg();
    void checkYtdlp();
    void onDepStatusChanged(const QString &app, const QString &status, bool success);

private:
    Popup *popup;
    DependencyManager *depManager;
    QPushButton *btnFfmpeg;
    QPushButton *btnYtdlp;

    void setupUi();
    QHBoxLayout* createSection(const QString &title, QWidget *widget);
    QHBoxLayout* createReqRow(const QString &name, QPushButton *btn);
};

#endif