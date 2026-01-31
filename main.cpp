#include <QApplication>
#include <QFontDatabase>
#include <QTimer>
#include "App/Gui/container.h"
#include "App/Core/splash_screen.h"

int main(int argc, char *argv[]) {
    QApplication app(argc, argv);
    app.setApplicationName("Pulsar");

    QFontDatabase::addApplicationFont(":/Resources/Fonts/Montserrat-ExtraBold.ttf");
    QFontDatabase::addApplicationFont(":/Resources/Fonts/Roboto-Regular.ttf");
    QFontDatabase::addApplicationFont(":/Resources/Fonts/Roboto-Black.ttf");
    app.setFont(QFont("Roboto", 10));

    app.setStyleSheet(StyleHelper::getGlobalStyle());

    SplashScreen *splash = new SplashScreen();

    QObject::connect(splash, &SplashScreen::finished, [splash]() {
        splash->close();
        splash->deleteLater();
        
        Container *w = new Container();
        w->show();
    });

    splash->startProcess();

    return app.exec();
}