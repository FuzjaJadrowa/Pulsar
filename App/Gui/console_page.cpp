#include "console_page.h"
#include "components.h"
#include <QVBoxLayout>
#include <QPainter>

ConsolePage::ConsolePage(QWidget *parent) : QWidget(parent) {
    auto *layout = new QVBoxLayout(this);
    layout->setContentsMargins(20, 40, 40, 40);
    layout->setSpacing(15);

    auto *headerLayout = new QHBoxLayout();
    iconLabel = new QLabel(this);

    auto *titleLabel = new QLabel("Console Output", this);
    titleLabel->setObjectName("PageTitle");

    headerLayout->addWidget(iconLabel);
    headerLayout->addWidget(titleLabel);
    headerLayout->addStretch();

    consoleOutput = new QTextEdit(this);
    consoleOutput->setReadOnly(true);

    layout->addLayout(headerLayout);
    layout->addWidget(consoleOutput);

    refreshStyles();
}

void ConsolePage::appendLog(const QString &text) {
    consoleOutput->append(text);
}

void ConsolePage::refreshStyles() {
    bool dark = StyleHelper::isDarkMode();
    setStyleSheet(StyleHelper::getGlobalStyle(dark));

    QPixmap icon(":/Resources/Icons/console.png");
    QPainter p(&icon);
    p.setCompositionMode(QPainter::CompositionMode_SourceIn);
    p.fillRect(icon.rect(), dark ? Qt::white : Qt::black);
    p.end();
    iconLabel->setPixmap(icon.scaled(32, 32, Qt::KeepAspectRatio, Qt::SmoothTransformation));

    QString bgColor = dark ? "#1a1a1a" : "#f5f5f5";
    QString borderColor = dark ? "#333" : "#ccc";
    QString textColor = dark ? "#cccccc" : "#333333";

    consoleOutput->setStyleSheet(QString(
        "QTextEdit { "
        "   background-color: %1; "
        "   border: 1px solid %2; "
        "   border-radius: 8px; "
        "   color: %3; "
        "   font-family: 'Consolas', 'Courier New', monospace; "
        "   font-size: 13px; "
        "   padding: 10px; "
        "}"
    ).arg(bgColor, borderColor, textColor));
}