(function initUi() {
    const { invoke } = window.__TAURI__.core;
    const { listen } = window.__TAURI__.event;

    const videoQualities = ['2160p', '1440p', '1080p', '720p', '480p', '360p', '240p', '144p'];
    const videoFormats = ['MP4', 'MKV', 'WEBM', 'MOV', 'FLV', 'AVI'];
    const audioFormats = ['MP3', 'M4A', 'ACC', 'OPUS', 'WAV', 'OGG'];
    const audioQualities = ['320k', '256k', '192k', '128k', '96k'];

    const body = document.body;
    const searchSection = document.getElementById('search-section');
    const dashboard = document.getElementById('dashboard-section');
    const urlInput = document.getElementById('url-input');
    const fetchBtn = document.getElementById('fetch-btn');

    const downloadBtn = document.getElementById('download-btn');
    const queueBtn = document.getElementById('queue-btn');
    const browseBtn = document.getElementById('browse-btn');
    const pathInput = document.getElementById('path-input');

    if (!searchSection || !urlInput) return;

    const modeVideoBtn = document.getElementById('mode-video');
    const modeAudioBtn = document.getElementById('mode-audio');
    const formatList = document.getElementById('format-list');
    const qualityList = document.getElementById('quality-list');
    const optionsWrapper = document.getElementById('options-wrapper');
    const thumbBtns = document.querySelectorAll('.thumb-actions .icon-btn-small');
    const thumbPreview = document.querySelector('.thumb-preview');

    const subsToggle = document.getElementById('subs-toggle');
    const liveChatToggle = document.getElementById('chat-toggle');
    const liveChatRow = document.getElementById('live-chat-row');
    const langWrapper = document.getElementById('lang-wrapper');
    const subsLangInput = document.getElementById('subs-lang');
    const subsLangSuggestions = document.getElementById('subs-lang-suggestions');

    const rangeStart = document.getElementById('range-start');
    const rangeEnd = document.getElementById('range-end');
    const rangeFill = document.getElementById('range-fill');
    const timeStartDisplay = document.getElementById('time-start');
    const timeEndDisplay = document.getElementById('time-end');

    let state = {
        mode: 'video',
        isAnalyzed: false,
        duration: 0,
        metadataTaskId: null,
        selectedFormat: null,
        selectedQuality: null,
        videoQualityOptions: ['1080p', '720p', '480p', '360p', '240p', '144p'],
        subtitleOptions: [],
        currentSuggestions: []
    };

    function triggerShakeFeedback(element) {
        if (!element) return;
        element.classList.remove('shake-feedback');
        void element.offsetWidth;
        element.classList.add('shake-feedback');
    }

    function parseVideoQuality(formats = []) {
        const found = new Set();

        formats.forEach((format) => {
            const note = String(format.note || '');
            const resolution = String(format.resolution || '');

            const noteMatch = note.match(/(\d{3,4})p/i);
            if (noteMatch && videoQualities.includes(`${noteMatch[1]}p`)) {
                found.add(`${noteMatch[1]}p`);
                return;
            }

            const resolutionMatch = resolution.match(/\d+x(\d{3,4})/i);
            if (resolutionMatch && videoQualities.includes(`${resolutionMatch[1]}p`)) {
                found.add(`${resolutionMatch[1]}p`);
            }
        });

        if (!found.size) return state.videoQualityOptions;

        const highest = videoQualities.find((q) => found.has(q));
        if (!highest) return state.videoQualityOptions;

        return videoQualities.slice(videoQualities.indexOf(highest));
    }

    function languageDisplayParts(code) {
        const cleanCode = String(code || '').trim();
        const normalizedCode = cleanCode.replace('_', '-');
        const parts = normalizedCode.split('-');
        const language = (parts[0] || '').toLowerCase();
        const region = (parts.find((p) => p.length === 2 && /^[a-zA-Z]{2}$/.test(p)) || '').toUpperCase();

        let languageName = language;
        let countryName = region;

        try {
            const langDisplay = new Intl.DisplayNames(['en'], { type: 'language' });
            const langResolved = langDisplay.of(language);
            if (langResolved) languageName = langResolved;
        } catch (_) {}

        if (region) {
            try {
                const regionDisplay = new Intl.DisplayNames(['en'], { type: 'region' });
                const regionResolved = regionDisplay.of(region);
                if (regionResolved) countryName = regionResolved;
            } catch (_) {}
        }

        const flag = region
            ? String.fromCodePoint(...region.split('').map((c) => 127397 + c.charCodeAt(0)))
            : '🌐';

        return {
            code: cleanCode,
            languageName,
            countryName: countryName || 'Global',
            flag
        };
    }

    function buildSubtitleOptions(data) {
        const all = [...(data.subtitles_langs || []), ...(data.auto_captions_langs || [])];
        const unique = [...new Set(all.map((c) => String(c).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        return unique.map(languageDisplayParts);
    }

    function showSuggestions(matches) {
        if (!subsLangSuggestions) return;
        subsLangSuggestions.innerHTML = '';

        if (!matches.length) {
            subsLangSuggestions.classList.add('hidden');
            return;
        }

        matches.slice(0, 8).forEach((entry) => {
            const item = document.createElement('div');
            item.className = 'lang-suggestion-item';
            item.innerText = `${entry.flag} ${entry.countryName} • ${entry.languageName} • ${entry.code}`;
            item.onclick = () => {
                subsLangInput.value = entry.code;
                subsLangSuggestions.classList.add('hidden');
            };
            subsLangSuggestions.appendChild(item);
        });

        subsLangSuggestions.classList.remove('hidden');
    }

    function updateLanguageSuggestions() {
        const query = (subsLangInput.value || '').trim().toLowerCase();
        if (!query) {
            showSuggestions(state.subtitleOptions);
            return;
        }

        const matches = state.subtitleOptions.filter((entry) =>
            entry.code.toLowerCase().includes(query) ||
            entry.languageName.toLowerCase().includes(query) ||
            entry.countryName.toLowerCase().includes(query)
        );
        state.currentSuggestions = matches;
        showSuggestions(matches);
    }

    async function activateDashboard() {
        const url = urlInput.value.trim();
        if (!url) return;

        fetchBtn.setAttribute('disabled', 'true');

        try {
            state.metadataTaskId = await invoke('fetch_metadata', { url });
        } catch (error) {
            console.error('Metadata fetch failed:', error);
            fetchBtn.removeAttribute('disabled');
        }
    }

    function showDashboard() {
        searchSection.classList.remove('centered');
        searchSection.classList.add('sticky');

        setTimeout(() => {
            dashboard.classList.remove('hidden');
            state.isAnalyzed = true;
            state.mode = null;
            setMode('video');
        }, 500);
    }

    function updateMetadataView(data) {
        state.duration = Number(data.duration) || 0;
        state.videoQualityOptions = parseVideoQuality(data.formats || []);
        state.subtitleOptions = buildSubtitleOptions(data);

        const hasLiveChat = state.subtitleOptions.some((entry) => entry.code.toLowerCase() === 'live_chat');
        liveChatRow.classList.toggle('hidden', !hasLiveChat);
        if (!hasLiveChat) {
            liveChatToggle.checked = false;
        }

        const title = data.title || 'Unknown title';
        const author = data.channel || data.uploader || 'Unknown channel';
        const duration = data.duration_string || formatTime(state.duration);

        document.getElementById('meta-title').innerText = title;
        document.getElementById('meta-author').innerText = author;
        document.getElementById('meta-duration').innerText = duration;

        if (data.thumbnail) {
            thumbPreview.innerHTML = `<img src="${data.thumbnail}" alt="Thumbnail">`;
        } else {
            thumbPreview.innerHTML = '<span class="placeholder">NO PREVIEW</span>';
        }

        timeStartDisplay.value = '00:00:00';
        timeEndDisplay.value = duration;
        rangeStart.value = 0;
        rangeEnd.value = 100;
        updateSlider();

        if (state.mode === 'video') {
            renderVideoOptions();
        }

        showDashboard();
    }

    function resetToZen() {
        if (urlInput.value.trim() === '') {
            dashboard.classList.add('hidden');
            searchSection.classList.remove('sticky');
            searchSection.classList.add('centered');
            state.isAnalyzed = false;
            state.metadataTaskId = null;
            state.selectedFormat = null;
            state.selectedQuality = null;
            state.subtitleOptions = [];
            if (subsLangSuggestions) {
                subsLangSuggestions.classList.add('hidden');
                subsLangSuggestions.innerHTML = '';
            }
            validateReadyState();
            body.classList.remove('mode-video', 'mode-audio');
        }
    }

    fetchBtn.onclick = activateDashboard;
    urlInput.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); activateDashboard(); urlInput.blur(); }};
    urlInput.oninput = resetToZen;

    listen('download-event', (event) => {
        const payload = event.payload;

        if (!payload || !state.metadataTaskId || payload.id !== state.metadataTaskId) return;

        if (payload.type === 'finished' && payload.success === false) {
            state.metadataTaskId = null;
            fetchBtn.removeAttribute('disabled');
            console.error('Metadata task failed:', payload.error || 'Unknown error');
            return;
        }

        if (payload.type !== 'metadata') return;

        state.metadataTaskId = null;
        fetchBtn.removeAttribute('disabled');

        if (!payload.success || !payload.data) {
            console.error('Bridge returned invalid metadata payload:', payload);
            return;
        }

        updateMetadataView(payload.data);
    });

    async function setMode(mode) {
        if (state.mode === mode) return;
        state.mode = mode;

        if (optionsWrapper) optionsWrapper.classList.add('fading-out');
        await new Promise(r => setTimeout(r, 200));

        body.classList.remove('mode-video', 'mode-audio');

        if (mode === 'video') {
            body.classList.add('mode-video');
            modeVideoBtn.classList.add('active');
            modeAudioBtn.classList.remove('active');
            renderVideoOptions();
        } else {
            body.classList.add('mode-audio');
            modeAudioBtn.classList.add('active');
            modeVideoBtn.classList.remove('active');
            renderAudioOptions();
        }

        state.selectedFormat = null;
        state.selectedQuality = null;
        validateReadyState();
        updateSlider();
        if (optionsWrapper) optionsWrapper.classList.remove('fading-out');
    }

    modeVideoBtn.onclick = () => {
        if (state.mode === 'video') {
            triggerShakeFeedback(modeVideoBtn);
            return;
        }
        setMode('video');
    };
    modeAudioBtn.onclick = () => {
        if (state.mode === 'audio') {
            triggerShakeFeedback(modeAudioBtn);
            return;
        }
        setMode('audio');
    };

    function createTile(text, subtext = '') {
        const div = document.createElement('div');
        div.className = 'tile';
        div.innerHTML = `<span>${text}</span> ${subtext ? `<small style="font-size:0.7em; opacity:0.7">${subtext}</small>` : ''}`;
        div.onclick = () => {
            if (div.classList.contains('active')) {
                triggerShakeFeedback(div);
                return;
            }
            div.parentElement.querySelectorAll('.tile').forEach(t => t.classList.remove('active'));
            div.classList.add('active');
            if (div.parentElement.id === 'format-list') state.selectedFormat = text;
            if (div.parentElement.id === 'quality-list') state.selectedQuality = text;
            validateReadyState();
        };
        return div;
    }

    function renderVideoOptions() {
        formatList.innerHTML = '';
        qualityList.innerHTML = '';
        videoFormats.forEach(f => formatList.appendChild(createTile(f)));
        state.videoQualityOptions.forEach(q => qualityList.appendChild(createTile(q)));
    }
    function renderAudioOptions() {
        formatList.innerHTML = '';
        qualityList.innerHTML = '';
        audioFormats.forEach(f => formatList.appendChild(createTile(f)));
        audioQualities.forEach(q => qualityList.appendChild(createTile(q)));
    }

    browseBtn.onclick = () => { pathInput.value = 'C:/Downloads/Pulsar'; validateReadyState(); };
    pathInput.oninput = validateReadyState;

    function updateSlider() {
        if (!rangeStart) return;
        let min = parseInt(rangeStart.value, 10);
        let max = parseInt(rangeEnd.value, 10);

        if (min > max) { rangeStart.value = max; min = max; }
        if (max < min) { rangeEnd.value = min; max = min; }

        rangeFill.style.left = `${min}%`;
        rangeFill.style.right = `${100 - max}%`;

        if (document.activeElement !== timeStartDisplay)
            timeStartDisplay.value = formatTime(state.duration * (min / 100));

        if (document.activeElement !== timeEndDisplay)
            timeEndDisplay.value = formatTime(state.duration * (max / 100));
    }

    function formatTime(s) {
        const safe = Number.isFinite(s) ? s : 0;
        const total = Math.max(0, Math.floor(safe));
        const hrs = Math.floor(total / 3600).toString().padStart(2, '0');
        const min = Math.floor((total % 3600) / 60).toString().padStart(2, '0');
        const sec = Math.floor(total % 60).toString().padStart(2, '0');
        return `${hrs}:${min}:${sec}`;
    }

    function parseTimeToSeconds(str) {
        const parts = str.split(':').map(Number);
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        return 0;
    }

    function handleManualTimeInput(input, isStart) {
        if (!state.duration) return;
        const seconds = parseTimeToSeconds(input.value);
        let percent = (seconds / state.duration) * 100;

        if (percent < 0) percent = 0;
        if (percent > 100) percent = 100;

        if (isStart) {
            rangeStart.value = percent;
        } else {
            rangeEnd.value = percent;
        }
        updateSlider();
    }

    if (rangeStart) {
        rangeStart.oninput = updateSlider;
        rangeEnd.oninput = updateSlider;

        timeStartDisplay.onchange = () => handleManualTimeInput(timeStartDisplay, true);
        timeEndDisplay.onchange = () => handleManualTimeInput(timeEndDisplay, false);
    }

    thumbBtns.forEach(btn => {
        btn.onclick = () => {
            if (btn.classList.contains('active')) {
                triggerShakeFeedback(btn);
                return;
            }
            thumbBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
    });

    subsToggle.onchange = () => {
        if (subsToggle.checked) {
            langWrapper.classList.add('visible');
            updateLanguageSuggestions();
            subsLangInput.focus();
        } else {
            langWrapper.classList.remove('visible');
            if (subsLangSuggestions) subsLangSuggestions.classList.add('hidden');
        }
    };

    subsLangInput.addEventListener('input', updateLanguageSuggestions);
    subsLangInput.addEventListener('focus', updateLanguageSuggestions);
    document.addEventListener('click', (event) => {
        if (!langWrapper.contains(event.target)) {
            subsLangSuggestions.classList.add('hidden');
        }
    });

    function validateReadyState() {
        const hasPath = pathInput.value.trim().length > 0;
        const isValid = state.selectedFormat && state.selectedQuality && hasPath;

        if (isValid) {
            downloadBtn.removeAttribute('disabled');
            downloadBtn.classList.add('ready');
            queueBtn.removeAttribute('disabled');
            queueBtn.classList.add('ready');
        } else {
            downloadBtn.setAttribute('disabled', 'true');
            downloadBtn.classList.remove('ready');
            queueBtn.setAttribute('disabled', 'true');
            queueBtn.classList.remove('ready');
        }
    }

    updateSlider();
})();