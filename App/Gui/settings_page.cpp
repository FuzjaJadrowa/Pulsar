#include "settings_page.h"
#include "components.h"
#include "../Core/config_manager.h"
#include <QApplication>

SettingsPage::SettingsPage(Popup *popup, QWidget *parent)
    : QWidget(parent), popup(popup) {

    setupUi();
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
    auto *scrollContent = new QWidget();
    auto *mainLayout = new QVBoxLayout(scrollContent);
    mainLayout->setAlignment(Qt::AlignTop);
    mainLayout->setContentsMargins(20, 40, 40, 40);
    mainLayout->setSpacing(15);

    auto *titleLayout = new QHBoxLayout();
    auto *iconLabel = new QLabel(this);
    QPixmap icon(":/Resources/Icons/settings.png");
    QPainter p(&icon);
    p.setCompositionMode(QPainter::CompositionMode_SourceIn);
    p.fillRect(icon.rect(), Qt::white);
    p.end();

    iconLabel->setPixmap(icon.scaled(32, 32, Qt::KeepAspectRatio, Qt::SmoothTransformation));
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
    auto *radioHide = new AnimatedRadioButton("Hide", this);
    auto *radioExit = new AnimatedRadioButton("Exit", this);

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

    auto *dlLabel = new QLabel("Download settings", this);
    dlLabel->setObjectName("SectionHeader");
    mainLayout->addWidget(dlLabel);

    auto *cookiesCombo = new QComboBox(this);
    cookiesCombo->addItems({"None", "Brave", "Chrome", "Chromium", "Edge", "Firefox", "Opera", "Safari", "Vivaldi", "Whale"});
    cookiesCombo->setCurrentText(ConfigManager::instance().getCookiesBrowser());
    connect(cookiesCombo, &QComboBox::currentTextChanged, this, &SettingsPage::onCookiesChanged);
    mainLayout->addLayout(createSection("Cookies from browser", cookiesCombo));

    auto *geoBypassCheck = new AnimatedCheckBox("Bypass country restrictions", this);
    geoBypassCheck->setChecked(ConfigManager::instance().getGeoBypass());
    connect(geoBypassCheck, &QCheckBox::toggled, this, &SettingsPage::onGeoBypassToggled);
    mainLayout->addWidget(geoBypassCheck);

    auto *defVideoFmt = new QComboBox(this);
    defVideoFmt->addItems({"mp4", "mkv", "mov", "avi", "flv", "webm"});
    defVideoFmt->setCurrentText(ConfigManager::instance().getVideoFormat());
    connect(defVideoFmt, &QComboBox::currentTextChanged, this, &SettingsPage::onVideoFormatChanged);
    mainLayout->addLayout(createSection("Default Video Format", defVideoFmt));

    auto *defVideoQual = new QComboBox(this);
    defVideoQual->addItems({"2160p", "1440p", "1080p", "720p", "480p", "360p", "240p", "144p"});
    defVideoQual->setCurrentText(ConfigManager::instance().getVideoQuality());
    connect(defVideoQual, &QComboBox::currentTextChanged, this, &SettingsPage::onVideoQualityChanged);
    mainLayout->addLayout(createSection("Default Video Quality", defVideoQual));

    auto *defAudioFmt = new QComboBox(this);
    defAudioFmt->addItems({"mp3", "m4a", "aac", "opus", "wav", "ogg"});
    defAudioFmt->setCurrentText(ConfigManager::instance().getAudioFormat());
    connect(defAudioFmt, &QComboBox::currentTextChanged, this, &SettingsPage::onAudioFormatChanged);
    mainLayout->addLayout(createSection("Default Audio Format", defAudioFmt));

    auto *defAudioQual = new QComboBox(this);
    defAudioQual->addItems({"320kbps", "256kbps", "192kbps", "128kbps"});
    defAudioQual->setCurrentText(ConfigManager::instance().getAudioQuality());
    connect(defAudioQual, &QComboBox::currentTextChanged, this, &SettingsPage::onAudioQualityChanged);
    mainLayout->addLayout(createSection("Default Audio Quality", defAudioQual));

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
void SettingsPage::onGeoBypassToggled(bool checked) { ConfigManager::instance().setGeoBypass(checked); }
void SettingsPage::onVideoFormatChanged(const QString &val) { ConfigManager::instance().setVideoFormat(val); }
void SettingsPage::onVideoQualityChanged(const QString &val) { ConfigManager::instance().setVideoQuality(val); }
void SettingsPage::onAudioFormatChanged(const QString &val) { ConfigManager::instance().setAudioFormat(val); }
void SettingsPage::onAudioQualityChanged(const QString &val) { ConfigManager::instance().setAudioQuality(val); }
void SettingsPage::onSupportClicked() { QDesktopServices::openUrl(QUrl("https://tipply.pl/@fuzjajadrowa")); }