#include "settings_page.h"
#include "config_manager.h"
#include <QVBoxLayout>
#include <QApplication>
#include <QCoreApplication>

SettingsPage::SettingsPage(Popup *popup, InstallerWindow *installer, QWidget *parent)
    : QWidget(parent), popup(popup), m_installer(installer) {
    setupUi();
}

void SettingsPage::setupUi() {
    auto *mainLayout = new QVBoxLayout(this);
    mainLayout->setAlignment(Qt::AlignTop);
    mainLayout->setContentsMargins(20, 40, 40, 40);
    mainLayout->setSpacing(15);

    auto *titleLayout = new QHBoxLayout();
    auto *iconLabel = new QLabel(this);
    iconLabel->setPixmap(QPixmap(QCoreApplication::applicationDirPath() + "/Resources/Icons/icon.ico").scaled(32, 32, Qt::KeepAspectRatio, Qt::SmoothTransformation));

    auto *titleLabel = new QLabel("Settings", this);
    titleLabel->setObjectName("PageTitle");

    titleLayout->addWidget(iconLabel);
    titleLayout->addWidget(titleLabel);
    titleLayout->addStretch();
    mainLayout->addLayout(titleLayout);

    auto *genLabel = new QLabel("General", this);
    genLabel->setObjectName("SectionHeader");
    mainLayout->addWidget(genLabel);

    auto *themeCombo = new QComboBox(this);
    themeCombo->addItems({"System", "Dark", "Light"});
    themeCombo->setCurrentText(ConfigManager::instance().getTheme());
    connect(themeCombo, &QComboBox::currentTextChanged, this, &SettingsPage::onThemeChanged);
    mainLayout->addLayout(createSection("Theme", themeCombo));

    auto *langCombo = new QComboBox(this);
    langCombo->addItem("English");
    langCombo->setCurrentText(ConfigManager::instance().getLanguage());
    connect(langCombo, &QComboBox::currentTextChanged, this, &SettingsPage::onLangChanged);
    mainLayout->addLayout(createSection("Language", langCombo));

    auto *closeGroup = new QButtonGroup(this);
    auto *radioHide = new QRadioButton("Hide GVD", this);
    auto *radioExit = new QRadioButton("Exit GVD", this);
    closeGroup->addButton(radioHide);
    closeGroup->addButton(radioExit);

    if (ConfigManager::instance().getCloseBehavior() == "Hide") radioHide->setChecked(true);
    else radioExit->setChecked(true);
    connect(closeGroup, &QButtonGroup::buttonClicked, this, &SettingsPage::onCloseBehaviorChanged);

    auto *closeLayout = new QVBoxLayout();
    closeLayout->addWidget(new QLabel("When I close GUI Video Downloader:"));
    closeLayout->addWidget(radioHide);
    closeLayout->addWidget(radioExit);
    mainLayout->addLayout(closeLayout);

    auto *reqLabel = new QLabel("Requirements", this);
    reqLabel->setObjectName("SectionHeader");
    mainLayout->addWidget(reqLabel);

    btnFfmpeg = new QPushButton("Check Update", this);
    btnFfmpeg->setObjectName("actionBtn");
    btnFfmpeg->setCursor(Qt::PointingHandCursor);
    connect(btnFfmpeg, &QPushButton::clicked, this, &SettingsPage::checkFfmpeg);
    mainLayout->addLayout(createReqRow("FFmpeg", btnFfmpeg));

    btnYtdlp = new QPushButton("Check Update", this);
    btnYtdlp->setObjectName("actionBtn");
    btnYtdlp->setCursor(Qt::PointingHandCursor);
    connect(btnYtdlp, &QPushButton::clicked, this, &SettingsPage::checkYtdlp);
    mainLayout->addLayout(createReqRow("yt-dlp", btnYtdlp));

    mainLayout->addStretch();
}

QHBoxLayout* SettingsPage::createSection(const QString &title, QWidget *widget) {
    auto *layout = new QHBoxLayout();
    layout->addWidget(new QLabel(title, this));
    layout->addStretch();
    layout->addWidget(widget);
    return layout;
}

QHBoxLayout* SettingsPage::createReqRow(const QString &name, QPushButton *btn) {
    auto *layout = new QHBoxLayout();
    layout->addWidget(new QLabel(name, this));
    layout->addStretch();
    layout->addWidget(btn);
    return layout;
}

void SettingsPage::onThemeChanged(const QString &theme) {
    ConfigManager::instance().setTheme(theme);
    emit themeChanged();
}

void SettingsPage::onLangChanged(const QString &lang) {
    ConfigManager::instance().setLanguage(lang);
}

void SettingsPage::onCloseBehaviorChanged(QAbstractButton *btn) {
    ConfigManager::instance().setCloseBehavior(btn->text().contains("Hide") ? "Hide" : "Exit");
}

void SettingsPage::checkFfmpeg() {
    m_installer->forceUpdate("ffmpeg");
}

void SettingsPage::checkYtdlp() {
    m_installer->forceUpdate("yt-dlp");
}