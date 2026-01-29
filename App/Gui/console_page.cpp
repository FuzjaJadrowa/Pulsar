#include "console_page.h"
#include "components.h"
#include <QVBoxLayout>

ConsolePage::ConsolePage(QWidget *parent) : QWidget(parent) {
    setStyleSheet(StyleHelper::getGlobalStyle());

    auto *layout = new QVBoxLayout(this);
    layout->setContentsMargins(20, 40, 40, 40);
    layout->setSpacing(15);

    auto *headerLayout = new QHBoxLayout();
    auto *iconLabel = new QLabel(this);
    iconLabel->setPixmap(QPixmap(":/Resources/Icons/console.png").scaled(32, 32, Qt::KeepAspectRatio, Qt::SmoothTransformation));

    auto *titleLabel = new QLabel("Console Output", this);
    titleLabel->setObjectName("PageTitle");

    headerLayout->addWidget(iconLabel);
    headerLayout->addWidget(titleLabel);
    headerLayout->addStretch();

    consoleOutput = new QTextEdit(this);
    consoleOutput->setReadOnly(true);
    // Styl konsolowy
    consoleOutput->setStyleSheet(
        "QTextEdit { "
        "   background-color: #1a1a1a; "
        "   border: 1px solid #333; "
        "   border-radius: 8px; "
        "   color: #cccccc; "
        "   font-family: 'Consolas', 'Courier New', monospace; "
        "   font-size: 13px; "
        "   padding: 10px; "
        "}"
    );

    layout->addLayout(headerLayout);
    layout->addWidget(consoleOutput);
}

void ConsolePage::appendLog(const QString &text) {
    consoleOutput->append(text);
}