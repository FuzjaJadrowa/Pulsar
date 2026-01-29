#include "settings_page.h"
#include "components.h"
#include "../Core/config_manager.h"
#include <QApplication>

SettingsPage::SettingsPage(Popup *popup, InstallerWindow *installer, QWidget *parent)
    : QWidget(parent), popup(popup), m_installer(installer) {

    setStyleSheet(StyleHelper::getGlobalStyle());    setupUi();
}

void SettingsPage::paintEvent(QPaintEvent *event) {
    QStyleOption opt;
    opt.initFrom(this);
    QPainter p(this);

    p.fillRect(rect(), QColor("#121212"));
}

void SettingsPage::updateThemeProperty() {}

void SettingsPage::setupUi() {
    auto *rootLayout = new QVBoxLayout(this);
    rootLayout->setContentsMargins(0, 0, 0, 0);

    auto *scrollArea = new QScrollArea(this);
    scrollArea->setWidgetResizable(true);
    scrollArea->setFrameShape(QFrame::NoFrame);
    scrollArea->setStyleSheet("QScrollArea { background: transparent; }");

    auto *scrollContent = new QWidget();
    auto *mainLayout = new QVBoxLayout(scrollContent);
    mainLayout->setAlignment(Qt::AlignTop);
    mainLayout->setContentsMargins(20, 40, 40, 40);
    mainLayout->setSpacing(15);

    auto *titleLayout = new QHBoxLayout();
    auto *iconLabel = new QLabel(this);
    iconLabel->setPixmap(QPixmap(":/Resources/Icons/settings.png").scaled(32, 32, Qt::KeepAspectRatio, Qt::SmoothTransformation));
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
    mainLayout->addLayout(createSection("Language", langCombo));

    auto *closeGroup = new QButtonGroup(this);
    auto *radioHide = new QRadioButton("Hide to Tray", this);
    auto *radioExit = new QRadioButton("Exit Application", this);
    QString radioStyle = "QRadioButton { color: #ccc; spacing: 8px; } QRadioButton::indicator { width: 16px; height: 16px; border-radius: 8px; border: 1px solid #555; background: #222; } QRadioButton::indicator:checked { background: #6200ea; border: 2px solid white; }";
    radioHide->setStyleSheet(radioStyle);
    radioExit->setStyleSheet(radioStyle);

    closeGroup->addButton(radioHide);
    closeGroup->addButton(radioExit);
    if (ConfigManager::instance().getCloseBehavior() == "Hide") radioHide->setChecked(true);
    else radioExit->setChecked(true);
    connect(closeGroup, &QButtonGroup::buttonClicked, this, &SettingsPage::onCloseBehaviorChanged);

    auto *closeLayout = new QVBoxLayout();
    closeLayout->addWidget(new QLabel("When I close Pulsar:"));
    closeLayout->addWidget(radioHide);
    closeLayout->addWidget(radioExit);
    mainLayout->addLayout(closeLayout);

    auto *reqLabel = new QLabel("Requirements", this);
    reqLabel->setObjectName("SectionHeader");
    mainLayout->addWidget(reqLabel);

    btnFfmpeg = new AnimatedButton("Check Update", this, QColor("#2d2d2d"), QColor("#3d3d3d"));
    connect(btnFfmpeg, &QPushButton::clicked, this, &SettingsPage::checkFfmpeg);
    mainLayout->addLayout(createReqRow("FFmpeg", btnFfmpeg));

    btnYtdlp = new AnimatedButton("Check Update", this, QColor("#2d2d2d"), QColor("#3d3d3d"));
    connect(btnYtdlp, &QPushButton::clicked, this, &SettingsPage::checkYtdlp);
    mainLayout->addLayout(createReqRow("yt-dlp", btnYtdlp));

    auto *suppLabel = new QLabel("Support", this);
    suppLabel->setObjectName("SectionHeader");
    mainLayout->addWidget(suppLabel);

    auto *btnSupport = new AnimatedButton("Support Project", this, QColor("#E91E63"), QColor("#F06292"));
    connect(btnSupport, &QPushButton::clicked, this, &SettingsPage::onSupportClicked);
    mainLayout->addLayout(createSection("Show your support!", btnSupport));

    mainLayout->addStretch();
    scrollArea->setWidget(scrollContent);
    rootLayout->addWidget(scrollArea);
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

QVBoxLayout* SettingsPage::createVerticalCombo(const QString &label, QComboBox *combo) {
    auto *layout = new QVBoxLayout();
    layout->addWidget(new QLabel(label, this));
    layout->addWidget(combo);
    return layout;
}

void SettingsPage::onThemeChanged(const QString &theme) {
    ConfigManager::instance().setTheme(theme);
    updateThemeProperty();
    emit themeChanged();
}

void SettingsPage::onLangChanged(const QString &lang) { ConfigManager::instance().setLanguage(lang); }
void SettingsPage::onCloseBehaviorChanged(QAbstractButton *btn) { ConfigManager::instance().setCloseBehavior(btn->text().contains("Hide") ? "Hide" : "Exit"); }
void SettingsPage::onCookiesChanged(const QString &browser) { ConfigManager::instance().setCookiesBrowser(browser); }
void SettingsPage::onIgnoreErrorsToggled(bool checked) { ConfigManager::instance().setIgnoreErrors(checked); }
void SettingsPage::onGeoBypassToggled(bool checked) { ConfigManager::instance().setGeoBypass(checked); }
void SettingsPage::onVideoFormatChanged(const QString &val) { ConfigManager::instance().setVideoFormat(val); }
void SettingsPage::onVideoQualityChanged(const QString &val) { ConfigManager::instance().setVideoQuality(val); }
void SettingsPage::onAudioFormatChanged(const QString &val) { ConfigManager::instance().setAudioFormat(val); }
void SettingsPage::onAudioQualityChanged(const QString &val) { ConfigManager::instance().setAudioQuality(val); }
void SettingsPage::checkFfmpeg() { m_installer->checkForUpdates("ffmpeg", true); }
void SettingsPage::checkYtdlp() { m_installer->checkForUpdates("yt-dlp", true); }
void SettingsPage::onSupportClicked() { QDesktopServices::openUrl(QUrl("https://tipply.pl/@fuzjajadrowa")); }