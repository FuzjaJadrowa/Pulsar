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

#include "App/main_page.h"
#include "App/settings_page.h"
#include "App/console_page.h"
#include "App/popup.h"
#include "App/config_manager.h"
#include "Installer/installer_window.h"

class MainWindow : public QMainWindow {
    Q_OBJECT
public:
    InstallerWindow *installer;
    Popup *popup;

    MainWindow() {
        setWindowTitle("GUI Video Downloader");
        setMinimumSize(950, 650);
        setWindowIcon(QIcon(QCoreApplication::applicationDirPath() + "/Resources/Icons/icon.ico"));
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
        QString qssPath = QCoreApplication::applicationDirPath() + "/Resources/style.qss";
        QFile file(qssPath);
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

        connect(installer, &InstallerWindow::networkError, this, [this](){
             popup->showMessage("Network Error", "No internet connection detected.", Popup::Error, Popup::Permanent);
        });

        connect(installer, &InstallerWindow::updateAvailable, this, [this](const QString &appName){
             popup->showMessage("Update Available", "New version of " + appName + " is available.", Popup::Info, Popup::Permanent, "Update");
             disconnect(popup, &Popup::actionClicked, nullptr, nullptr);
             connect(popup, &Popup::actionClicked, [this, appName](){
                 installer->startUpdateProcess(appName);
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
        QString path = QCoreApplication::applicationDirPath() + "/Resources/Icons/";
        QString suf = isDark ? "_dark.ico" : ".ico";
        btnHome->setIcon(QIcon(path + "home" + suf));
        btnConsole->setIcon(QIcon(path + "console" + suf));
        btnSettings->setIcon(QIcon(path + "settings" + suf));
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
    QString fontPath = QCoreApplication::applicationDirPath() + "/Resources/Fonts/Montserrat-ExtraBold.ttf";
    QFontDatabase::addApplicationFont(fontPath);

    MainWindow w;
    if (!w.installer->hasRequirements()) {
        w.installer->startMissingFileRepair();
        if (w.installer->exec() != QDialog::Accepted) {
            return 0;
        }
    }

    w.show();
    QTimer::singleShot(2000, w.installer, [&w](){
        w.installer->checkForUpdates(false);
    });

    return app.exec();
}
#include "main.moc"