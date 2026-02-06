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
                    }
                }
            }

            if (config['close_behavior']) {
                const radio = document.querySelector(`input[name="close_behavior"][value="${config['close_behavior']}"]`);
                if (radio) radio.checked = true;
            }

            if (window.initCustomSelects) {
                window.initCustomSelects();
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

    loadSettings();

    const supportBtn = document.querySelector('button[onclick*="openUrl"]');
    if(supportBtn) {
        supportBtn.onclick = () => {
            window.__TAURI__.opener.openUrl('https://tipply.pl/@fuzjajadrowa');
        };
    }
}