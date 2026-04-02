const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;
const { getCurrentWindow } = window.__TAURI__.window;
const appWindow = getCurrentWindow();

let isAppLoaded = false;
let currentPageIndex = 0;
let currentPageName = null;
let queueVisible = false;
const loadedPages = {};
const pageScrollMemory = {};
let queueOutsideBound = false;
let idleWavesEnterTimer = null;
const themeMedia = window.matchMedia('(prefers-color-scheme: light)');
let currentThemeSetting = 'System';
let themeTransitionTimer = null;
let currentLocale = null;
let bridgePrewarmed = false;

const resolveLocale = (value) => {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'en';
    if (raw === 'en' || raw === 'english' || raw === 'angielski') return 'en';
    if (raw === 'pl' || raw === 'polish' || raw === 'polski') return 'pl';
    return raw;
};

const requestConverterSync = (options = {}) => {
    const opts = { animate: true, ...options };
    let attempts = 0;
    const maxAttempts = 60;
    const trySync = () => {
        const api = window.converterUi;
        if (api && typeof api.syncState === 'function') {
            api.syncState(opts);
            return;
        }
        attempts += 1;
        if (attempts < maxAttempts) {
            setTimeout(trySync, 50);
        }
    };
    trySync();
};

const requestCompressorSync = (options = {}) => {
    const opts = { animate: true, ...options };
    let attempts = 0;
    const maxAttempts = 60;
    const trySync = () => {
        const api = window.compressorUi;
        if (api && typeof api.syncState === 'function') {
            api.syncState(opts);
            return;
        }
        attempts += 1;
        if (attempts < maxAttempts) {
            setTimeout(trySync, 50);
        }
    };
    trySync();
};

async function applyLocale(locale) {
    if (!window.i18n || typeof window.i18n.init !== 'function') return;
    const normalized = resolveLocale(locale);
    if (currentLocale === normalized) return;
    try {
        await window.i18n.init(normalized);
        currentLocale = normalized;
        window.i18n.apply(document);
        if (typeof window.refreshTitleConstructorI18n === 'function') {
            window.refreshTitleConstructorI18n();
        }
        if (typeof window.initCustomSelects === 'function') {
            window.initCustomSelects();
        }
    } catch (error) {
        console.error('Failed to initialize i18n:', error);
        if (normalized !== 'en') {
            try {
                await window.i18n.init('en');
                currentLocale = 'en';
                window.i18n.apply(document);
                if (typeof window.refreshTitleConstructorI18n === 'function') {
                    window.refreshTitleConstructorI18n();
                }
                if (typeof window.initCustomSelects === 'function') {
                    window.initCustomSelects();
                }
            } catch (fallbackError) {
                console.error('Failed to initialize fallback i18n:', fallbackError);
            }
        }
    }
}
const t = (key, fallback = '', params = null) => {
    if (window.i18n && typeof window.i18n.t === 'function') {
        return window.i18n.t(key, fallback, params);
    }
    if (params && typeof fallback === 'string') {
        return fallback.replace(/\{(\w+)\}/g, (_, token) => {
            if (Object.prototype.hasOwnProperty.call(params, token)) return String(params[token]);
            return `{${token}}`;
        });
    }
    return fallback || key;
};

const savePageScroll = (name, view) => {
    if (!name || !view) return;
    const scrollEl = view.querySelector('.page-scroll');
    if (!scrollEl) return;
    pageScrollMemory[name] = scrollEl.scrollTop;
};

const restorePageScroll = (name, view) => {
    if (!name || !view) return;
    const scrollEl = view.querySelector('.page-scroll');
    if (!scrollEl) return;
    const saved = pageScrollMemory[name];
    if (Number.isFinite(saved)) {
        scrollEl.scrollTop = saved;
    }
};

function triggerIdleWavesEnter() {
    const body = document.body;
    if (!body) return;
    if (!body.classList.contains('zen-mode')) return;
    if (!body.classList.contains('idle-anim-enabled')) return;
    if (body.classList.contains('search-mode')) return;

    if (idleWavesEnterTimer) clearTimeout(idleWavesEnterTimer);
    body.classList.remove('idle-waves-enter');
    void body.offsetWidth;
    body.classList.add('idle-waves-enter');
    idleWavesEnterTimer = setTimeout(() => {
        document.body?.classList.remove('idle-waves-enter');
        idleWavesEnterTimer = null;
    }, 360);
}

window.triggerIdleWavesEnter = triggerIdleWavesEnter;

function resolveTheme(setting) {
    const normalized = String(setting || 'System').toLowerCase();
    if (normalized === 'light') return 'light';
    if (normalized === 'dark') return 'dark';
    if (normalized === 'system') return themeMedia.matches ? 'light' : 'dark';
    return 'dark';
}

function setThemeClass(resolved) {
    const body = document.body;
    if (!body) return;
    body.classList.toggle('theme-light', resolved === 'light');
    body.classList.toggle('theme-dark', resolved === 'dark');
    body.dataset.theme = resolved;
}

window.applyTheme = function(setting, options = {}) {
    currentThemeSetting = setting || 'System';
    const resolved = resolveTheme(currentThemeSetting);

    if (options.animate !== false) {
        const body = document.body;
        if (body) {
            body.classList.add('theme-transition');
            if (themeTransitionTimer) clearTimeout(themeTransitionTimer);
            themeTransitionTimer = setTimeout(() => {
                body.classList.remove('theme-transition');
            }, 420);
        }
    }

    setThemeClass(resolved);
};

themeMedia.addEventListener('change', () => {
    if (String(currentThemeSetting).toLowerCase() === 'system') {
        window.applyTheme('System');
    }
});

const dataSea = (() => {
    let canvas = null;
    let ctx = null;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let rafId = null;
    let running = false;
    let lastTs = null;
    let waveOffsetBack = 0;
    let waveOffsetFront = 0;
    let bound = false;

    const backSpeed = 0.55;
    const frontSpeed = 0.9;

    const selectCanvas = () => {
        canvas = document.getElementById('data-sea-canvas');
        if (canvas) {
            ctx = canvas.getContext('2d');
        } else {
            ctx = null;
        }
    };

    const isActive = () => {
        const body = document.body;
        if (!body) return false;
        const isDownloader = body.classList.contains('page-downloader');
        const isConverter = body.classList.contains('page-converter');
        const isCompressor = body.classList.contains('page-compressor');
        if (!isDownloader && !isConverter && !isCompressor) return false;
        if (!body.classList.contains('zen-mode')) return false;
        if (!body.classList.contains('idle-anim-enabled')) return false;
        if (body.classList.contains('search-mode')) return false;
        return !!(canvas && ctx);
    };

    const resize = () => {
        if (!canvas || !ctx) return;
        const rect = canvas.getBoundingClientRect();
        width = Math.max(1, rect.width);
        height = Math.max(1, rect.height);
        dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const waveY = (x, base, amplitude, wavelength, offset) => {
        return base
            + Math.sin((x / wavelength) + offset) * amplitude
            + Math.sin((x / (wavelength * 0.55)) + offset * 1.7) * amplitude * 0.35;
    };

    const drawWave = (color, base, amplitude, wavelength, offset) => {
        if (!ctx) return;
        const step = Math.max(10, Math.floor(width / 140));
        ctx.beginPath();
        ctx.moveTo(0, height);
        for (let x = 0; x <= width; x += step) {
            const y = waveY(x, base, amplitude, wavelength, offset);
            ctx.lineTo(x, y);
        }
        const edgeY = waveY(width, base, amplitude, wavelength, offset);
        ctx.lineTo(width, edgeY);
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    };

    const tick = (ts) => {
        if (!running) {
            rafId = null;
            return;
        }
        if (!ctx) return;
        if (lastTs === null) lastTs = ts;
        const dt = Math.min(60, ts - lastTs) / 1000;
        lastTs = ts;

        waveOffsetBack += backSpeed * dt;
        waveOffsetFront += frontSpeed * dt;

        ctx.clearRect(0, 0, width, height);

        const backBase = height * 0.45;
        const frontBase = height * 0.58;
        const backAmp = height * 0.08;
        const frontAmp = height * 0.12;
        const backWavelength = Math.max(180, width * 0.32);
        const frontWavelength = Math.max(160, width * 0.26);

        drawWave('rgba(0, 150, 200, 0.4)', backBase, backAmp, backWavelength, waveOffsetBack);

        drawWave('rgba(0, 120, 180, 1)', frontBase, frontAmp, frontWavelength, waveOffsetFront);

        rafId = window.requestAnimationFrame(tick);
    };

    const start = () => {
        if (running) return;
        running = true;
        lastTs = null;
        if (!rafId) rafId = window.requestAnimationFrame(tick);
    };

    const stop = () => {
        if (!running) return;
        running = false;
        if (rafId) window.cancelAnimationFrame(rafId);
        rafId = null;
        lastTs = null;
    };

    const sync = () => {
        selectCanvas();
        if (!canvas || !ctx) {
            stop();
            return;
        }
        if (isActive()) {
            resize();
            start();
        } else {
            stop();
        }
    };

    const bind = () => {
        selectCanvas();
        if (!bound) {
            bound = true;
            window.addEventListener('resize', () => resize());
            if (document.body && window.MutationObserver) {
                const observer = new MutationObserver(() => sync());
                observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
            }
        }
        sync();
    };

    return { bind, sync };
})();

function setIdleAnimation(enabled) {
    const body = document.body;
    if (!body) return;
    body.classList.toggle('idle-anim-enabled', enabled !== false);
    dataSea.sync();
}

async function initThemeFromConfig(configOverride = null) {
    try {
        const config = configOverride || await invoke('get_config');
        if (!config) return;
        if (config && config.theme) {
            window.applyTheme(config.theme, { animate: false });
        }
        if (config && typeof config.idle_animation !== 'undefined') {
            setIdleAnimation(config.idle_animation);
        } else {
            setIdleAnimation(true);
        }
    } catch (error) {
        console.error('Failed to load theme from config:', error);
    }
}

window.addEventListener('pulsar-config-updated', (event) => {
    if (!event?.detail) return;
    if (typeof event.detail.idle_animation !== 'undefined') {
        setIdleAnimation(event.detail.idle_animation);
    }
    if (typeof event.detail.language !== 'undefined') {
        applyLocale(event.detail.language);
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    let config = null;
    try {
        config = await invoke('get_config');
    } catch (error) {
        console.error('Failed to load config:', error);
    }

    if (window.i18n && typeof window.i18n.init === 'function') {
        await applyLocale(config?.language);
    }

    initThemeFromConfig(config);
    dataSea.bind();

    document.getElementById('minimize-btn')?.addEventListener('click', () => appWindow.minimize());
    document.getElementById('maximize-btn')?.addEventListener('click', () => appWindow.toggleMaximize());
    document.getElementById('close-btn')?.addEventListener('click', () => appWindow.close());

    await setupSplashListeners();
    await setupBridgeListeners();
    checkConnection();

    window.initCustomSelects();
    document.addEventListener('click', window.closeAllSelects);

    invoke('run_splash_checks').catch(err => {
        console.error("Failed to invoke splash checks:", err);
        finishSplash();
    });
});

const splashScreen = document.getElementById('splash-screen');
const appContent = document.getElementById('app-content');
const statusLabel = document.getElementById('splash-status');
const progressLabel = document.getElementById('splash-progress');
const skipBtn = document.getElementById('splash-skip-btn');
const splashExitDuration = 520;

function scheduleBridgePrewarm() {
    if (bridgePrewarmed || !invoke) return;
    bridgePrewarmed = true;
    setTimeout(() => {
        invoke('init_bridge').catch((error) => {
            console.error('Bridge prewarm failed:', error);
        });
    }, splashExitDuration);
}

function translateSplashStatus(value) {
    if (value === null || typeof value === 'undefined') return value;
    const raw = String(value);
    const trimmed = raw.trim();
    if (trimmed === '') return raw;

    if (trimmed === 'Starting...') {
        return t('index.splash.starting', 'Starting...');
    }
    if (trimmed === 'Checking...') {
        return t('index.splash.checking', 'Checking...');
    }
    if (trimmed === 'Checking for updates...') {
        return t('index.splash.checkingForUpdates', 'Checking for updates...');
    }
    if (trimmed === 'Extracting...') {
        return t('index.splash.extracting', 'Extracting...');
    }
    if (trimmed === 'Update installed. Restarting...') {
        return t('index.splash.updateInstalledRestarting', 'Update installed. Restarting...');
    }
    if (trimmed === 'Update available (auto-update disabled)') {
        return t('index.splash.updateAvailableAutoDisabled', 'Update available (auto-update disabled)');
    }

    const updateCheckFailedPrefix = 'Update check failed: ';
    if (trimmed.startsWith(updateCheckFailedPrefix)) {
        const error = trimmed.slice(updateCheckFailedPrefix.length);
        return t('index.splash.updateCheckFailed', 'Update check failed: {error}', { error });
    }

    const errorPrefix = 'Error: ';
    if (trimmed.startsWith(errorPrefix)) {
        const error = trimmed.slice(errorPrefix.length);
        return t('index.splash.errorPrefix', 'Error: {error}', { error });
    }

    const checkingPrefix = 'Checking ';
    if (trimmed.startsWith(checkingPrefix) && trimmed.endsWith('...')) {
        const component = trimmed.slice(checkingPrefix.length, -3);
        return t('index.splash.checkingComponent', 'Checking {component}...', { component });
    }

    const downloadingPrefix = 'Downloading ';
    if (trimmed.startsWith(downloadingPrefix) && trimmed.endsWith('...')) {
        const component = trimmed.slice(downloadingPrefix.length, -3);
        return t('index.splash.downloadingComponent', 'Downloading {component}...', { component });
    }

    const updatingToPrefix = 'Updating to ';
    if (trimmed.startsWith(updatingToPrefix)) {
        const version = trimmed.slice(updatingToPrefix.length);
        return t('index.splash.updatingTo', 'Updating to {version}', { version });
    }

    return raw;
}

function finishSplash() {
    if (isAppLoaded) return;
    isAppLoaded = true;

    if (splashScreen) {
        splashScreen.classList.add('exiting');
        setTimeout(() => {
            splashScreen.classList.add('hidden');
            splashScreen.style.display = 'none';
        }, splashExitDuration);
    }

    if (appContent) {
        appContent.style.opacity = '1';
    }

    loadPage('downloader', 0);
    scheduleBridgePrewarm();
}

function showSplashOverlay() {
    if (!splashScreen) return;
    splashScreen.style.display = 'flex';
    splashScreen.classList.remove('hidden', 'exiting');
    splashScreen.classList.add('entering');
    if (progressLabel) progressLabel.innerText = '';
    if (statusLabel) statusLabel.innerText = t('index.splash.checking', 'Checking...');
    if (skipBtn) skipBtn.style.display = 'none';
    setTimeout(() => {
        if (splashScreen) splashScreen.classList.remove('entering');
    }, splashExitDuration);
}

function hideSplashOverlay() {
    if (!splashScreen) return;
    splashScreen.classList.remove('entering');
    splashScreen.classList.add('exiting');
    setTimeout(() => {
        splashScreen.classList.add('hidden');
        splashScreen.style.display = 'none';
    }, splashExitDuration);
}

window.runRequirementCheck = async function(component) {
    if (!component) return;
    showSplashOverlay();
    try {
        await invoke('run_requirement_check', { component });
    } catch (error) {
        console.error('Failed to run requirement check:', error);
        hideSplashOverlay();
    }
};

if (skipBtn) {
    skipBtn.addEventListener('click', () => {
        invoke('cancel_splash_checks').catch(err => {
            console.error("Failed to cancel splash checks:", err);
        });
        if (isAppLoaded) {
            hideSplashOverlay();
        } else {
            finishSplash();
        }
    });
}

function checkConnection() {
    if (!navigator.onLine) {
        window.notifier.show(
            t('common.error', 'Error'),
            t('connection.noInternet', 'No internet connection. Some app features may be unavailable.'),
            'error',
            true
        );
    }

    window.addEventListener('offline', () => {
        window.notifier.show(
            t('common.error', 'Error'),
            t('connection.lost', 'Internet connection lost.'),
            'error',
            false
        );
    });

    window.addEventListener('online', () => {
        window.notifier.show(
            t('common.success', 'Success'),
            t('connection.restored', 'Internet connection restored.'),
            'success',
            false
        );
    });
}

async function setupSplashListeners() {
    try {
        await listen('splash-status', (event) => {
            const payload = event.payload;
            if (statusLabel) statusLabel.innerText = translateSplashStatus(payload.status);

            if (skipBtn) {
                if (payload.can_skip) {
                    skipBtn.style.display = 'inline-block';
                } else {
                    skipBtn.style.display = 'none';
                }
            }

            if (!payload.is_downloading && progressLabel) {
                progressLabel.innerText = "";
            }
        });

        await listen('splash-progress', (event) => {
            const payload = event.payload;
            if (payload.progress && progressLabel) {
                progressLabel.innerText = translateSplashStatus(payload.progress);
            }
        });

        await listen('splash-finished', () => {
            if (isAppLoaded) {
                hideSplashOverlay();
            } else {
                finishSplash();
            }
            scheduleBridgePrewarm();
        });
    } catch (error) {
        console.error("Splash events error:", error);
        setTimeout(() => {
            if (isAppLoaded) {
                hideSplashOverlay();
            } else {
                finishSplash();
            }
            scheduleBridgePrewarm();
        }, 2000);
    }
}

async function setupBridgeListeners() {
    try {
        await listen('download-event', (event) => {
            console.log("Bridge Event:", event.payload);
        });
    } catch (error) {
        console.error("Bridge listener error:", error);
    }
}

function refreshCustomSelectWrapper(origSelect, wrapper) {
    const head = wrapper.querySelector('.select-head');
    const list = wrapper.querySelector('.select-list');
    if (!head || !list) return;

    const options = Array.from(origSelect.options);
    const selectedIndex = origSelect.selectedIndex >= 0 ? origSelect.selectedIndex : 0;
    head.innerText = options[selectedIndex]?.text || '';

    list.innerHTML = '';
    options.forEach((opt, index) => {
        const item = document.createElement('div');
        item.className = 'select-item';
        if (index === selectedIndex) item.classList.add('selected');
        item.innerText = opt.text;
        item.addEventListener('click', () => {
            head.innerText = opt.text;
            list.querySelectorAll('.select-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            origSelect.value = opt.value;
            origSelect.dispatchEvent(new Event('change'));
            window.closeAllSelects();
        });
        list.appendChild(item);
    });

    if (origSelect.disabled) {
        head.style.opacity = '0.5';
        head.style.pointerEvents = 'none';
    } else {
        head.style.opacity = '1';
        head.style.pointerEvents = 'auto';
    }
}

window.initCustomSelects = function() {
    const selects = document.querySelectorAll('select.custom-select');
    selects.forEach(origSelect => {
        const existingWrapper = origSelect.nextElementSibling;
        if (existingWrapper && existingWrapper.classList.contains('select-wrapper')) {
            refreshCustomSelectWrapper(origSelect, existingWrapper);
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'select-wrapper';
        if (origSelect.style.width) wrapper.style.width = origSelect.style.width;

        const head = document.createElement('div');
        head.className = 'select-head';
        if (origSelect.options.length > 0) {
            head.innerText = origSelect.options[origSelect.selectedIndex].text;
        }

        const list = document.createElement('div');
        list.className = 'select-list';

        Array.from(origSelect.options).forEach(opt => {
            const item = document.createElement('div');
            item.className = 'select-item';
            if(opt.selected) item.classList.add('selected');
            item.innerText = opt.text;
            item.addEventListener('click', () => {
                head.innerText = opt.text;
                list.querySelectorAll('.select-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                origSelect.value = opt.value;
                origSelect.dispatchEvent(new Event('change'));
                window.closeAllSelects();
            });
            list.appendChild(item);
        });

        head.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const wasOpen = head.classList.contains('open');
            window.closeAllSelects();
            if (!wasOpen) {
                const inPresetModal = !!wrapper.closest('.preset-modal');
                let openUp = false;
                const headRect = head.getBoundingClientRect();
                const optionsCount = origSelect.options.length;
                const estimatedHeight = Math.min(optionsCount * 40, 240);
                let spaceAbove = headRect.top;
                let spaceBelow = window.innerHeight - headRect.bottom;
                if (inPresetModal) {
                    const modalBody = wrapper.closest('.preset-modal-body');
                    if (modalBody) {
                        const modalRect = modalBody.getBoundingClientRect();
                        spaceAbove = headRect.top - modalRect.top;
                        spaceBelow = modalRect.bottom - headRect.bottom;
                    }
                }
                openUp = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

                list.classList.toggle('open-up', openUp);
                head.classList.toggle('open-up', openUp);
                head.classList.add('open');
                list.classList.remove('open');

                wrapper.classList.add('select-open');
                const hostCard = wrapper.closest('.settings-section-card');
                if (hostCard) hostCard.classList.add('select-open-card');
                const compressorPanel = wrapper.closest('.compressor-controls-panel, .compressor-options-panel');
                if (compressorPanel) compressorPanel.classList.add('select-open-panel');

                if (list.__closeTimer) {
                    clearTimeout(list.__closeTimer);
                    list.__closeTimer = null;
                }
                if (inPresetModal) {
                    const maxHeight = Math.max(120, Math.min(estimatedHeight, openUp ? spaceAbove : spaceBelow));
                    list.style.setProperty('--select-max-height', `${Math.round(maxHeight)}px`);
                    list.classList.remove('portal');
                    delete list.dataset.portalActive;
                    list.style.position = '';
                    list.style.left = '';
                    list.style.right = '';
                    list.style.top = '';
                    list.style.bottom = '';
                    list.style.minWidth = '';
                    list.style.zIndex = '';
                    requestAnimationFrame(() => list.classList.add('open'));
                } else {
                    list.style.position = '';
                    list.style.left = '';
                    list.style.right = '';
                    list.style.top = '';
                    list.style.bottom = '';
                    list.style.minWidth = '';
                    list.style.removeProperty('--select-max-height');
                    list.style.zIndex = '';
                    list.classList.remove('portal');
                    requestAnimationFrame(() => list.classList.add('open'));
                }
            }
        });

        wrapper.appendChild(head);
        wrapper.appendChild(list);
        origSelect.parentNode.insertBefore(wrapper, origSelect.nextSibling);

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((m) => {
                if (m.attributeName === 'disabled') {
                    if (origSelect.disabled) { head.style.opacity = '0.5'; head.style.pointerEvents = 'none'; }
                    else { head.style.opacity = '1'; head.style.pointerEvents = 'auto'; }
                }
            });
        });
        observer.observe(origSelect, { attributes: true });

        if (origSelect.disabled) { head.style.opacity = '0.5'; head.style.pointerEvents = 'none'; }
    });
};

window.closeAllSelects = function() {
    document.querySelectorAll('.select-head').forEach(h => {
        h.classList.remove('open');
        h.classList.remove('open-up');
    });
    document.querySelectorAll('.select-list').forEach(l => {
        const wasOpenUp = l.classList.contains('open-up');
        l.classList.remove('open');
        if (wasOpenUp) {
            if (l.__closeTimer) clearTimeout(l.__closeTimer);
            l.__closeTimer = setTimeout(() => {
                l.classList.remove('open-up');
                l.__closeTimer = null;
            }, 300);
        } else {
            l.classList.remove('open-up');
        }
        l.classList.remove('portal');
        delete l.dataset.portalActive;
        l.style.position = '';
        l.style.left = '';
        l.style.right = '';
        l.style.top = '';
        l.style.bottom = '';
        l.style.minWidth = '';
        l.style.removeProperty('--select-max-height');
        l.style.zIndex = '';
    });
    document.querySelectorAll('.select-wrapper').forEach(w => w.classList.remove('select-open'));
    document.querySelectorAll('.settings-section-card').forEach(c => c.classList.remove('select-open-card'));
    document.querySelectorAll('.compressor-controls-panel, .compressor-options-panel')
        .forEach(p => p.classList.remove('select-open-panel'));
};

async function loadPage(pageName, pageIndex) {
    if (currentPageName === pageName) return;

    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    const navBtn = document.getElementById(`nav-${pageName}`);
    if (navBtn) navBtn.classList.add('active');

    if (currentPageName === 'converter' && pageName !== 'converter'
        && window.converterUi && typeof window.converterUi.onDeactivate === 'function') {
        window.converterUi.onDeactivate();
    }
    if (currentPageName === 'compressor' && pageName !== 'compressor'
        && window.compressorUi && typeof window.compressorUi.onDeactivate === 'function') {
        window.compressorUi.onDeactivate();
    }

    const contentArea = document.getElementById('content-area');
    const previousView = contentArea ? contentArea.querySelector('.view-container.active-view') : null;
    const previousIndex = currentPageIndex;
    const hasPrevious = !!previousView;
    const direction = hasPrevious
        ? (pageIndex > previousIndex ? 'right' : 'left')
        : 'right';

    savePageScroll(currentPageName, previousView);

    let targetView = document.getElementById(`view-${pageName}`);

    if (loadedPages[pageName]) {
        targetView = document.getElementById(`view-${pageName}`);
    } else {
        try {
            const response = await fetch(`app/${pageName}.html`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const html = await response.text();

            const viewContainer = document.createElement('div');
            viewContainer.id = `view-${pageName}`;
            viewContainer.className = 'view-container';

            viewContainer.innerHTML = html;
            if (window.i18n && typeof window.i18n.apply === 'function') {
                window.i18n.apply(viewContainer);
            }
            contentArea.appendChild(viewContainer);

            const scripts = viewContainer.querySelectorAll("script");
            scripts.forEach(oldScript => {
                const newScript = document.createElement("script");
                Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                newScript.appendChild(document.createTextNode(oldScript.innerHTML));

                oldScript.parentNode.removeChild(oldScript);
                viewContainer.appendChild(newScript);
            });

            loadedPages[pageName] = true;
            targetView = viewContainer;

        } catch (err) {
            console.error('Failed to load page:', err);
            return;
        }
    }

    if (!targetView) return;
    if (window.i18n && typeof window.i18n.apply === 'function') {
        window.i18n.apply(targetView);
    }

    const body = document.body;
    const isWavePage = (name) => name === 'downloader' || name === 'converter' || name === 'compressor';
    const isWaveVisible = () => {
        if (!body) return false;
        if (!body.classList.contains('wave-page')) return false;
        if (!body.classList.contains('zen-mode')) return false;
        if (!body.classList.contains('idle-anim-enabled')) return false;
        if (body.classList.contains('search-mode')) return false;
        return true;
    };
    const currentWaveVisible = isWaveVisible();
    if (body) {
        body.classList.remove('idle-waves-enter');
        if (idleWavesEnterTimer) {
            clearTimeout(idleWavesEnterTimer);
            idleWavesEnterTimer = null;
        }
    }
    const applyPageClass = (name) => {
        if (!body) return;
        body.classList.toggle('page-downloader', name === 'downloader');
        body.classList.toggle('page-settings', name === 'settings');
        body.classList.toggle('page-converter', name === 'converter');
        body.classList.toggle('page-compressor', name === 'compressor');
        body.classList.toggle('wave-page', isWavePage(name));
        if (name === 'converter') {
            const keepZen = !body.classList.contains('converter-active');
            body.classList.toggle('zen-mode', keepZen);
            body.classList.remove('search-mode');
        } else if (name === 'compressor') {
            body.classList.add('zen-mode');
            body.classList.remove('search-mode');
        }
    };

    const updateWaveTransition = () => {
        if (!body) return;
        const nextWaveVisible = isWaveVisible();
        body.classList.toggle('wave-transition', hasPrevious && currentWaveVisible !== nextWaveVisible);
    };

    if (!hasPrevious || previousView === targetView) {
        applyPageClass(pageName);
        if (pageName === 'downloader' && window.downloaderUi && typeof window.downloaderUi.syncZenState === 'function') {
            window.downloaderUi.syncZenState();
        }
        updateWaveTransition();
        if (previousView && previousView !== targetView) {
            previousView.classList.remove('active-view');
        }
        targetView.classList.add('active-view');
        restorePageScroll(pageName, targetView);
        targetView.style.transform = '';
        targetView.style.opacity = '';
        if (pageName === 'converter') {
            requestConverterSync({ animate: true });
        }
        if (pageName === 'compressor') {
            requestCompressorSync({ animate: true });
        }
        setTimeout(() => {
            window.initCustomSelects();
            if (window.i18n && typeof window.i18n.apply === 'function') window.i18n.apply(targetView);
            if (pageName === 'downloader' && window.downloaderUi && typeof window.downloaderUi.syncZenState === 'function') {
                window.downloaderUi.syncZenState();
            }
        }, 50);
    } else {
        if (body) {
            body.classList.add('page-transition');
        }
        applyPageClass(pageName);
        if (pageName === 'downloader' && window.downloaderUi && typeof window.downloaderUi.syncZenState === 'function') {
            window.downloaderUi.syncZenState();
        }
        updateWaveTransition();
        const incomingFrom = direction === 'right' ? '100%' : '-100%';
        const outgoingTo = direction === 'right' ? '-100%' : '100%';

        targetView.classList.add('active-view');
        restorePageScroll(pageName, targetView);
        targetView.style.transform = `translateX(${incomingFrom})`;
        targetView.style.opacity = '0';
        if (pageName === 'converter') {
            requestConverterSync({ animate: true });
        }
        if (pageName === 'compressor') {
            requestCompressorSync({ animate: true });
        }

        const transitionEasing = 'cubic-bezier(0.35, 0.0, 0.15, 1)';

        const outgoingAnim = previousView.animate([
            { transform: 'translateX(0%)', opacity: 1 },
            { transform: `translateX(${outgoingTo})`, opacity: 0 }
        ], { duration: 300, easing: transitionEasing, fill: 'forwards' });

        const incomingAnim = targetView.animate([
            { transform: `translateX(${incomingFrom})`, opacity: 0 },
            { transform: 'translateX(0%)', opacity: 1 }
        ], { duration: 300, easing: transitionEasing, fill: 'forwards' });

        await Promise.allSettled([
            outgoingAnim.finished,
            incomingAnim.finished
        ]);

        previousView.classList.remove('active-view');
        previousView.style.transform = '';
        previousView.style.opacity = '';
        targetView.style.transform = '';
        targetView.style.opacity = '';
        setTimeout(() => {
            if (body) {
                body.classList.remove('page-transition');
                body.classList.remove('wave-transition');
            }
            window.initCustomSelects();
            if (window.i18n && typeof window.i18n.apply === 'function') window.i18n.apply(targetView);
            if (pageName === 'downloader' && window.downloaderUi && typeof window.downloaderUi.syncZenState === 'function') {
                window.downloaderUi.syncZenState();
            }
        }, 50);
    }

    dataSea.bind();

    currentPageIndex = pageIndex;
    currentPageName = pageName;
}

window.toggleQueue = async function() {
    await window.setQueuePanelVisible(!queueVisible);
};

window.setQueuePanelVisible = async function(visible) {
    const panel = document.getElementById('queue-panel');
    const btn = document.getElementById('btn-queue');
    if (!panel || !btn) return;

    if (visible && !queueVisible) {
        if(panel.innerHTML.trim() === "") {
            try {
                const res = await fetch('app/queue.html');
                if(res.ok) {
                    panel.innerHTML = await res.text();
                    if (window.i18n && typeof window.i18n.apply === 'function') {
                        window.i18n.apply(panel);
                    }
                }
            } catch(e) { console.error("Error loading queue:", e); }
        }
        panel.style.display = 'block';
        if (window.queueManager && window.queueManager.bindPanel) {
            window.queueManager.bindPanel(panel);
        }
        panel.animate([{opacity: 0, transform: 'translateY(-20px)'}, {opacity: 1, transform: 'translateY(0)'}], {duration: 250, easing: 'ease-out'});
        btn.classList.add('active');
        queueVisible = true;
    } else if (!visible && queueVisible) {
        const anim = panel.animate([{opacity: 1}, {opacity: 0, transform: 'translateY(-20px)'}], {duration: 200});
        anim.onfinish = () => panel.style.display = 'none';
        btn.classList.remove('active');
        queueVisible = false;
    }

    if (!queueOutsideBound) {
        document.addEventListener('mousedown', (event) => {
            if (!queueVisible) return;
            const queuePanel = document.getElementById('queue-panel');
            const queueBtn = document.getElementById('btn-queue');
            const clickedInsidePanel = queuePanel && queuePanel.contains(event.target);
            const clickedToggleBtn = queueBtn && queueBtn.contains(event.target);
            if (!clickedInsidePanel && !clickedToggleBtn) {
                window.setQueuePanelVisible(false);
            }
        });
        queueOutsideBound = true;
    }
};

/**document.addEventListener('DOMContentLoaded', async () => {
    document.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    });

    document.addEventListener('keydown', (event) => {
    if (
        event.key === 'F12' ||
        (event.ctrlKey && event.shiftKey && event.key === 'I') ||
        (event.ctrlKey && event.shiftKey && event.key === 'R') ||
        (event.ctrlKey && event.key === 'r')
    ) {
    event.preventDefault();
    }
});

    document.getElementById('minimize-btn')?.addEventListener('click', () => appWindow.minimize());

    const disableAutofill = (element) => {
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            element.setAttribute('autocomplete', 'off');
            element.setAttribute('autocorrect', 'off');
            element.setAttribute('autocapitalize', 'off');
            element.setAttribute('spellcheck', 'false');

            if (element.type === 'password') {
            element.setAttribute('autocomplete', 'new-password');
            } else {
            if (element.type !== 'radio' && element.type !== 'checkbox' && !element.hasAttribute('name')) {
                element.setAttribute('name', Math.random().toString(36).substring(7));
            }
            }
        }
    };

    document.querySelectorAll('input, textarea').forEach(disableAutofill);

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                disableAutofill(node);
                if (node.querySelectorAll) {
                    node.querySelectorAll('input, textarea').forEach(disableAutofill);
                }
            });
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
});**/