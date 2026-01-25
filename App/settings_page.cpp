#include "settings_page.h"
#include "config_manager.h"
#include <QApplication>
#include <QCoreApplication>
#include <QScrollBar>
#include <QStyle>
#include <QGuiApplication>
#include <QStyleHints>

SettingsPage::SettingsPage(Popup *popup, InstallerWindow *installer, QWidget *parent)
    : QWidget(parent), popup(popup), m_installer(installer) {
    setupUi();
    updateThemeProperty();
}

void SettingsPage::paintEvent(QPaintEvent *event) {
    QStyleOption opt;
    opt.initFrom(this);
    QPainter p(this);
    style()->drawPrimitive(QStyle::PE_Widget, &opt, &p, this);
}

void SettingsPage::updateThemeProperty() {
    QString theme = ConfigManager::instance().getTheme();
    if (theme == "System") {
        theme = (QGuiApplication::styleHints()->colorScheme() == Qt::ColorScheme::Dark) ? "Dark" : "Light";
    }
    QString themeName = theme.toLower();

    this->setProperty("theme", themeName);

this->style()->unpolish(this);
    this->style()->polish(this);

    for (auto child : findChildren<QWidget*>()) {
        child->setProperty("theme", themeName);
        child->style()->unpolish(child);
        child->style()->polish(child);
    }
}

void SettingsPage::setupUi() {
    auto *rootLayout = new QVBoxLayout(this);
    rootLayout->setContentsMargins(0, 0, 0, 0);

    auto *scrollArea = new QScrollArea(this);
    scrollArea->setWidgetResizable(true);
    scrollArea->setFrameShape(QFrame::NoFrame);
    scrollArea->setStyleSheet("QScrollArea { background: transparent; }");

    auto *scrollContent = new QWidget();
    scrollContent->setObjectName("SettingsScrollContent");
    auto *mainLayout = new QVBoxLayout(scrollContent);
    mainLayout->setAlignment(Qt::AlignTop);
    mainLayout->setContentsMargins(20, 40, 40, 40);
    mainLayout->setSpacing(15);

    auto *titleLayout = new QHBoxLayout();
    auto *iconLabel = new QLabel(this);
    iconLabel->setPixmap(QPixmap(":/Resources/Icons/icon.png").scaled(32, 32, Qt::KeepAspectRatio, Qt::SmoothTransformation));
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

    auto *dlLabel = new QLabel("Download settings", this);
    dlLabel->setObjectName("SectionHeader");
    mainLayout->addWidget(dlLabel);

    auto *cookiesCombo = new QComboBox(this);
    cookiesCombo->addItems({"None", "Brave", "Chrome", "Chromium", "Edge", "Firefox", "Opera", "Safari", "Vivaldi", "Whale"});
    cookiesCombo->setCurrentText(ConfigManager::instance().getCookiesBrowser());
    connect(cookiesCombo, &QComboBox::currentTextChanged, this, &SettingsPage::onCookiesChanged);
    mainLayout->addLayout(createSection("Cookies from browser", cookiesCombo));

    auto *ignoreErrCheck = new QCheckBox("Ignore errors", this);
    ignoreErrCheck->setChecked(ConfigManager::instance().getIgnoreErrors());
    connect(ignoreErrCheck, &QCheckBox::toggled, this, &SettingsPage::onIgnoreErrorsToggled);
    mainLayout->addWidget(ignoreErrCheck);

    auto *geoBypassCheck = new QCheckBox("Bypass country restrictions", this);
    geoBypassCheck->setChecked(ConfigManager::instance().getGeoBypass());
    connect(geoBypassCheck, &QCheckBox::toggled, this, &SettingsPage::onGeoBypassToggled);
    mainLayout->addWidget(geoBypassCheck);

    auto *videoRow = new QHBoxLayout();
    auto *vFormatCombo = new QComboBox(this);
    vFormatCombo->addItems({"mp4", "mkv", "mov", "avi", "flv", "webm"});
    vFormatCombo->setCurrentText(ConfigManager::instance().getVideoFormat());
    connect(vFormatCombo, &QComboBox::currentTextChanged, this, &SettingsPage::onVideoFormatChanged);
    videoRow->addLayout(createVerticalCombo("Default video format:", vFormatCombo));

    auto *vQualCombo = new QComboBox(this);
    vQualCombo->addItems({"2160p", "1440p", "1080p", "720p", "480p", "360p", "240p", "144p"});
    vQualCombo->setCurrentText(ConfigManager::instance().getVideoQuality());
    connect(vQualCombo, &QComboBox::currentTextChanged, this, &SettingsPage::onVideoQualityChanged);
    videoRow->addLayout(createVerticalCombo("Default video quality:", vQualCombo));
    mainLayout->addLayout(videoRow);

    auto *audioRow = new QHBoxLayout();
    auto *aFormatCombo = new QComboBox(this);
    aFormatCombo->addItems({"mp3", "m4a", "aac", "opus", "wav", "ogg"});
    aFormatCombo->setCurrentText(ConfigManager::instance().getAudioFormat());
    connect(aFormatCombo, &QComboBox::currentTextChanged, this, &SettingsPage::onAudioFormatChanged);
    audioRow->addLayout(createVerticalCombo("Default audio format:", aFormatCombo));

    auto *aQualCombo = new QComboBox(this);
    aQualCombo->addItems({"360kbps", "256kbps", "192kbps", "128kbps"});
    aQualCombo->setCurrentText(ConfigManager::instance().getAudioQuality());
    connect(aQualCombo, &QComboBox::currentTextChanged, this, &SettingsPage::onAudioQualityChanged);
    audioRow->addLayout(createVerticalCombo("Default audio quality:", aQualCombo));
    mainLayout->addLayout(audioRow);

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