{
    const invoke = window.__TAURI__.core.invoke;

    const idMap = {
        'theme': 'theme',
        'language': 'language',
        'update_app': 'update_app',
        'update_ytdlp': 'update_ytdlp',
        'update_ffmpeg': 'update_ffmpeg',
        'cookies_browser': 'cookies_browser',
        'geo_bypass': 'geo_bypass',
        'video_format': 'video_format',
        'video_quality': 'video_quality',
        'audio_format': 'audio_format',
        'audio_quality': 'audio_quality'
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
            } else {
                config[key] = el.value;
            }
        }

        const radio = document.querySelector('input[name="close_behavior"]:checked');
        config['close_behavior'] = radio ? radio.value : 'hide';

        console.log("Saving config:", config);
        await invoke('save_config', { newConfig: config });
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
                        el.value = config[key];
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

    const supportBtn = document.querySelector('button[onclick*="openUrl"]');
    if(supportBtn) {
        supportBtn.onclick = () => {
            window.__TAURI__.opener.openUrl('https://tipply.pl/@fuzjajadrowa'); //TODO: Naprawa otwierania linku
        };
    }
}