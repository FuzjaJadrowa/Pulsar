#include <QApplication>
#include <QMainWindow>
#include <QStackedWidget>
#include <QHBoxLayout>
#include <QVBoxLayout>
#include <QPushButton>
#include <QFontDatabase>
#include <QFile>
#include <QDir>
#include <QPropertyAnimation>
#include <QStyleHints>
#include <QCloseEvent>
#include <QTimer>
#include <QStyle>

#include "App/main_page.h"
#include "App/settings_page.h"
#include "App/console_page.h"
#include "App/popup.h"
#include "App/config_manager.h"
#include "Installer/installer_window.h"
#include "Installer/app_updater.h"

class MainWindow : public QMainWindow {
    Q_OBJECT
public:
    InstallerWindow *installer;
    AppUpdater *appUpdater;
    Popup *popup;

    MainWindow() {
        setWindowTitle("GUI Video Downloader");
        setMinimumSize(950, 650);
        setWindowIcon(QIcon(":/Resources/Icons/app_icon.png"));
        setupUI();
        applyTheme();
    }

public slots:
    void applyTheme() {
        QString theme = ConfigManager::instance().getTheme();
        if (theme == "System") {
            theme = (QGuiApplication::styleHints()->colorScheme() == Qt::ColorScheme::Dark) ? "Dark" : "Light";
        }
        bool isDark = (theme == "Dark");
        QString themeName = theme.toLower();

        QFile file(":/Resources/style.qss");
        if (file.open(QIODevice::ReadOnly)) {
            QString style = QLatin1String(file.readAll());
            this->setProperty("theme", themeName);
            this->style()->unpolish(this);
            this->style()->polish(this);
            qApp->setStyleSheet("");
            qApp->setStyleSheet(style);
            updateSidebarIcons(isDark);
        }
    }

private:
    QStackedWidget *stackedWidget;
    QPushButton *btnHome, *btnConsole, *btnSettings;

    void setupUI() {
        auto *central = new QWidget(this);
        setCentralWidget(central);
        auto *layout = new QHBoxLayout(central);
        layout->setContentsMargins(0,0,0,0);
        layout->setSpacing(0);

        auto *sidebar = new QWidget(this);
        sidebar->setObjectName("Sidebar");
        sidebar->setFixedWidth(80);
        auto *sideLayout = new QVBoxLayout(sidebar);
        sideLayout->setContentsMargins(10, 20, 10, 20);

        btnHome = createSidebarBtn();
        btnConsole = createSidebarBtn();
        btnSettings = createSidebarBtn();

        sideLayout->addStretch();
        sideLayout->addWidget(btnHome);
        sideLayout->addWidget(btnConsole);
        sideLayout->addWidget(btnSettings);

        stackedWidget = new QStackedWidget(this);
        popup = new Popup(this);
        installer = new InstallerWindow(popup, this);
        appUpdater = new AppUpdater(popup, this);

        auto *pageMain = new MainPage(this);
        auto *pageConsole = new ConsolePage(this);
        auto *pageSettings = new SettingsPage(popup, installer, this);

        stackedWidget->addWidget(pageMain);
        stackedWidget->addWidget(pageConsole);
        stackedWidget->addWidget(pageSettings);

        layout->addWidget(sidebar);
        layout->addWidget(stackedWidget);

        connect(btnHome, &QPushButton::clicked, [this](){ stackedWidget->setCurrentIndex(0); });
        connect(btnConsole, &QPushButton::clicked, [this]() { stackedWidget->setCurrentIndex(1); });
        connect(btnSettings, &QPushButton::clicked, [this](){ stackedWidget->setCurrentIndex(2); });
        connect(pageSettings, &SettingsPage::themeChanged, this, &MainWindow::applyTheme);
        connect(pageSettings, &SettingsPage::themeChanged, pageMain, &MainPage::updateThemeProperty);
        connect(pageMain->getDownloader(), &Downloader::outputLog, pageConsole, &ConsolePage::appendLog);

        connect(installer, &InstallerWindow::upToDate, this, [this](const QString &appName){
            popup->showMessage("Info", appName + " is already up to date.", Popup::Info, Popup::Temporary);
        });

        connect(installer, &InstallerWindow::networkError, this, [this](bool isRateLimit){
             if (isRateLimit) {
                 popup->showMessage("Error", "Too many requests (GitHub API). Try again later.", Popup::Error, Popup::Temporary);
             } else {
                 popup->showMessage("Network Error", "No internet connection detected.", Popup::Error, Popup::Temporary);
             }
        });

        connect(installer, &InstallerWindow::updateAvailable, this, [this](const QString &appName){
             popup->showMessage("Update Available", "New version of " + appName + " is available.", Popup::Info, Popup::Permanent, "Update");
             disconnect(popup, &Popup::actionClicked, nullptr, nullptr);
             connect(popup, &Popup::actionClicked, [this, appName](){
                 installer->startUpdateProcess(appName);
             });
        });

        connect(appUpdater, &AppUpdater::updateAvailable, this, [this](const QString &version){
            popup->showMessage("App Update", "Version " + version + " is available!", Popup::Success, Popup::Permanent, "Update Now");
            disconnect(popup, &Popup::actionClicked, nullptr, nullptr);
            connect(popup, &Popup::actionClicked, [this](){
                appUpdater->startAppUpdate();
            });
        });
    }

    QPushButton* createSidebarBtn() {
        auto *btn = new QPushButton(this);
        btn->setFixedSize(60, 60);
        btn->setIconSize(QSize(32, 32));
        btn->setCursor(Qt::PointingHandCursor);
        return btn;
    }

    void updateSidebarIcons(bool isDark) {
        QString suf = isDark ? "_dark.png" : ".png";
        btnHome->setIcon(QIcon(":/Resources/Icons/home" + suf));
        btnConsole->setIcon(QIcon(":/Resources/Icons/console" + suf));
        btnSettings->setIcon(QIcon(":/Resources/Icons/settings" + suf));
    }

protected:
    void closeEvent(QCloseEvent *event) override {
        if (ConfigManager::instance().getCloseBehavior() == "Hide") {
            event->ignore();
            this->hide();
        } else {
            event->accept();
        }
    }
};

int main(int argc, char *argv[]) {
    QApplication app(argc, argv);
    app.setFont(QFont("Segoe UI", 10));
    QFontDatabase::addApplicationFont(":/Resources/Fonts/Montserrat-ExtraBold.ttf");

    MainWindow w;
    if (!w.installer->hasRequirements()) {
        w.installer->startMissingFileDownload();
        if (w.installer->exec() != QDialog::Accepted) {
            return 0;
        }
    }

    w.show();

    QTimer::singleShot(2000, w.installer, [&w]() {
        w.installer->checkForUpdates("yt-dlp", false);
    });

    QTimer::singleShot(3000, w.appUpdater, [&w]() {
        w.appUpdater->checkForAppUpdates(false);
    });

    return app.exec();
}
#include "main.moc"