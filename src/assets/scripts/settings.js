{
    const invoke = window.__TAURI__.core.invoke;

    const idMap = {
        'theme': 'theme',
        'language': 'language',
        'advanced_mode': 'advanced_mode',
        'update_app': 'update_app',
        'update_app_cooldown_minutes': 'update_app_cooldown_minutes',
        'update_ytdlp': 'update_ytdlp',
        'update_ffmpeg': 'update_ffmpeg',
        'cookies_browser': 'cookies_browser',
        'maximum_concurrent_processes': 'maximum_concurrent_processes'
    };

    const numberConstraints = {
        update_app_cooldown_minutes: { min: 10, max: 500, fallback: 30 },
        maximum_concurrent_processes: { min: 1, max: 10, fallback: 3 }
    };

    const clampNumber = (value, min, max, fallback) => {
        if (!Number.isFinite(value)) return fallback;
        if (value < min || value > max) return fallback;
        return value;
    };

    function refreshCustomSelect(selectId) {
        const selectEl = document.getElementById(selectId);
        if (!selectEl) return;

        const wrapper = selectEl.nextElementSibling;
        if (wrapper && wrapper.classList.contains('select-wrapper')) {
            const head = wrapper.querySelector('.select-head');
            const list = wrapper.querySelector('.select-list');

            if (head && selectEl.selectedIndex >= 0) {
                head.innerText = selectEl.options[selectEl.selectedIndex].text;

                const items = list.querySelectorAll('.select-item');
                items.forEach((item, index) => {
                    if (index === selectEl.selectedIndex) {
                        item.classList.add('selected');
                    } else {
                        item.classList.remove('selected');
                    }
                });
            }
        }
    }

    async function saveSettings() {
        const config = {};

        for (const [id, key] of Object.entries(idMap)) {
            const el = document.getElementById(id);
            if(!el) continue;

            if (el.type === 'checkbox') {
                config[key] = el.checked;
            } else if (el.type === 'number') {
                const parsed = parseInt(el.value, 10);
                const constraints = numberConstraints[key];
                if (constraints) {
                    const clamped = clampNumber(parsed, constraints.min, constraints.max, constraints.fallback);
                    config[key] = clamped;
                    el.value = clamped;
                } else {
                    config[key] = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
                }
            } else {
                config[key] = el.value;
            }
        }

        const radio = document.querySelector('input[name="close_behavior"]:checked');
        config['close_behavior'] = radio ? radio.value : 'hide';

        if (window.applyTheme && config.theme) {
            window.applyTheme(config.theme);
        }

        console.log("Saving config:", config);
        await invoke('save_config', { newConfig: config });
        if (window.queueManager && typeof window.queueManager.refreshConfig === 'function') {
            window.queueManager.refreshConfig();
        }
        window.dispatchEvent(new CustomEvent('pulsar-config-updated', { detail: config }));
    }

    async function loadSettings() {
        try {
            const config = await invoke('get_config');
            console.log("Loaded config from Rust:", config);

            for (const [id, key] of Object.entries(idMap)) {
                const el = document.getElementById(id);
                if (el && config[key] !== undefined) {
                    if (el.type === 'checkbox') {
                        el.checked = config[key];
                    } else {
                        if (el.type === 'number') {
                            const constraints = numberConstraints[key];
                            const parsed = parseInt(config[key], 10);
                            if (constraints) {
                                const clamped = clampNumber(parsed, constraints.min, constraints.max, constraints.fallback);
                                el.value = clamped;
                            } else {
                                el.value = config[key];
                            }
                        } else {
                            el.value = config[key];
                        }
                        if (el.tagName === 'SELECT') {
                            refreshCustomSelect(id);
                        }
                    }
                }
            }

            if (config['close_behavior']) {
                const radio = document.querySelector(`input[name="close_behavior"][value="${config['close_behavior']}"]`);
                if (radio) radio.checked = true;
            }

            if (window.applyTheme && config.theme) {
                window.applyTheme(config.theme, { animate: false });
            }

            setupListeners();

        } catch (e) {
            console.error("Failed to load config:", e);
        }
    }

    function setupListeners() {
        const inputs = document.querySelectorAll('select, input');
        inputs.forEach(input => {
            input.removeEventListener('change', saveSettings);
            input.addEventListener('change', saveSettings);
        });
    }

    if (window.initCustomSelects) {
        window.initCustomSelects();
    }

    loadSettings();

    const supportBtn = document.getElementById('support-btn');
    if (supportBtn) {
        supportBtn.onclick = async () => {
            try {
                await window.__TAURI__.opener.openUrl('https://tipply.pl/@fuzjajadrowa');
            } catch (error) {
                console.error('Failed to open support link:', error);
            }
        };
    }
}