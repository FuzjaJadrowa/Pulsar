#include "main_page.h"
#include <QCoreApplication>

MainPage::MainPage(QWidget *parent) : QWidget(parent) {
    auto *layout = new QVBoxLayout(this);
    layout->setContentsMargins(20, 40, 40, 40);
    layout->setSpacing(15);

    auto *headerLayout = new QHBoxLayout();
    auto *iconLabel = new QLabel(this);
    iconLabel->setPixmap(QPixmap(QCoreApplication::applicationDirPath() + "/Resources/Icons/icon.ico").scaled(32, 32, Qt::KeepAspectRatio, Qt::SmoothTransformation));

    auto *header = new QLabel("GUI Video Downloader", this);
    header->setObjectName("PageTitle");

    headerLayout->addWidget(iconLabel);
    headerLayout->addWidget(header);
    headerLayout->addStretch();

    layout->addLayout(headerLayout);
    layout->addStretch();
}