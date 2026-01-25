#include "console_page.h"
#include <QCoreApplication>

ConsolePage::ConsolePage(QWidget *parent) : QWidget(parent) {
    auto *layout = new QVBoxLayout(this);
    layout->setContentsMargins(20, 40, 40, 40);
    layout->setSpacing(15);

    auto *headerLayout = new QHBoxLayout();
    auto *iconLabel = new QLabel(this);
    iconLabel->setPixmap(QPixmap(":/Resources/Icons/icon.png").scaled(32, 32, Qt::KeepAspectRatio, Qt::SmoothTransformation));

    auto *titleLabel = new QLabel("Console Output", this);
    titleLabel->setObjectName("PageTitle");

    headerLayout->addWidget(iconLabel);
    headerLayout->addWidget(titleLabel);
    headerLayout->addStretch();

    consoleOutput = new QTextEdit(this);
    consoleOutput->setReadOnly(true);

    layout->addLayout(headerLayout);
    layout->addWidget(consoleOutput);
}

void ConsolePage::appendLog(const QString &text) {
    consoleOutput->append(text);
}