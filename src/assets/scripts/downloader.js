(function initUi() {
    const { invoke } = window.__TAURI__.core;
    const { listen } = window.__TAURI__.event;

    const videoQualities = ['2160p', '1440p', '1080p', '720p', '480p', '360p', '240p', '144p'];
    const videoFormats = ['MP4', 'MKV', 'WEBM', 'MOV', 'FLV', 'AVI'];
    const audioFormats = ['MP3', 'M4A', 'ACC', 'OPUS', 'WAV', 'OGG'];
    const audioQualities = ['320kbps', '256kbps', '192kbps', '128kbps', '96kbps'];
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

    const body = document.body;
    const searchSection = document.getElementById('search-section');
    const dashboard = document.getElementById('dashboard-section');
    const urlInput = document.getElementById('url-input');
    const fetchBtn = document.getElementById('fetch-btn');
    const pasteIcon = document.getElementById('paste-icon');

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
    const geoToggle = document.getElementById('geo-toggle');
    const tagsToggle = document.getElementById('tags-toggle');

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
        currentSuggestions: [],
        thumbnailAction: 'none',
        currentTitle: null,
        currentThumbnail: null
    };

    function triggerShakeFeedback(element) {
        if (!element) return;
        element.classList.remove('shake-feedback');
        void element.offsetWidth;
        element.classList.add('shake-feedback');
    }

    function setFetchLoading(isLoading) {
        if (!fetchBtn) return;
        if (isLoading) {
            fetchBtn.setAttribute('disabled', 'true');
            fetchBtn.classList.add('loading');
            fetchBtn.innerHTML = `
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="9" stroke-opacity="0.3"></circle>
                    <path d="M21 12a9 9 0 0 1-9 9"></path>
                </svg>
            `;
            return;
        }

        fetchBtn.removeAttribute('disabled');
        fetchBtn.classList.remove('loading');
        fetchBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
        `;
    }

    browseBtn.onclick = async () => {
        try {
            const selectedPath = await invoke('pick_download_directory');
            if (selectedPath) {
                pathInput.value = selectedPath;
                validateReadyState();
            }
        } catch (error) {
            console.error('Failed to pick directory:', error);
        }
    };

    thumbBtns.forEach(btn => {
        btn.onclick = async () => {
            const action = btn.dataset.thumb;

            if (action === 'download') {
                const url = urlInput.value.trim();
                if (!url) {
                    triggerShakeFeedback(urlInput);
                    return;
                }

                try {
                    await invoke('save_thumbnail_to_disk', { url });
                    btn.style.color = '#4caf50';
                    setTimeout(() => btn.style.color = '', 1000);
                } catch (e) {
                    console.error("Thumbnail save failed:", e);
                    alert(t('downloader.thumbnail.saveFailed', 'Failed to save thumbnail. Check console for details.'));
                }
                return;
            }

            if (btn.classList.contains('active')) {
                triggerShakeFeedback(btn);
                return;
            }

            thumbBtns.forEach(b => {
                if(b.dataset.thumb !== 'download') b.classList.remove('active');
            });

            btn.classList.add('active');
            state.thumbnailAction = action;
        };
    });

    function buildDownloadPayload() {
        const isTimeRangeActive = (parseInt(rangeStart.value) > 0 || parseInt(rangeEnd.value) < 100);

        return {
            url: urlInput.value.trim(),
            path: pathInput.value.trim(),
            mode: state.mode,

            video_format: state.mode === 'video' ? state.selectedFormat : null,
            video_quality: state.mode === 'video' ? state.selectedQuality : null,

            audio_format: state.mode === 'audio' ? state.selectedFormat : null,
            audio_quality: state.mode === 'audio' ? state.selectedQuality : null,

            is_time_range_active: isTimeRangeActive,
            start_time: timeStartDisplay.value,
            end_time: timeEndDisplay.value,

            geo_bypass: geoToggle ? geoToggle.checked : false,
            embed_tags: tagsToggle ? tagsToggle.checked : false,
            embed_thumbnail: state.thumbnailAction === 'embed',

            download_subs: subsToggle ? subsToggle.checked : false,
            download_chat: liveChatToggle ? liveChatToggle.checked : false,
            subs_code: subsLangInput.value.trim()
        };
    }

    function currentMetaSnapshot() {
        const title = state.currentTitle || document.getElementById('meta-title')?.innerText || t('common.unknownTitle', 'Unknown title');
        return {
            title,
            thumbnail: state.currentThumbnail || ''
        };
    }

    function animateQueueOrbFrom(element) {
        if (window.queueManager && window.queueManager.animateQueueOrb) {
            window.queueManager.animateQueueOrb(element);
        }
    }

    function returnToZenAfterQueueAction() {
        setTimeout(() => {
            urlInput.value = '';
            resetToZen();
        }, 40);
    }

    downloadBtn.onclick = async () => {
        if (downloadBtn.getAttribute('disabled') === 'true') return;

        const payload = buildDownloadPayload();
        const meta = currentMetaSnapshot();

        try {
            if (window.queueManager && window.queueManager.enqueue) {
                window.queueManager.enqueue(payload, meta, { autoStart: true, startReason: 'download', source: 'download' });
            } else {
                await invoke('start_download', { options: payload });
            }

            animateQueueOrbFrom(downloadBtn);
            returnToZenAfterQueueAction();

        } catch (error) {
            console.error("Error starting download:", error);
            alert(t('downloader.errors.startPrefix', 'Error: {error}', { error: String(error) }));
        }
    };

    if (pasteIcon) {
        pasteIcon.onclick = async () => {
            try {
                pasteIcon.classList.remove('paste-pop');
                void pasteIcon.offsetWidth;
                pasteIcon.classList.add('paste-pop');
                setTimeout(() => pasteIcon.classList.remove('paste-pop'), 140);
                let text = '';
                if (navigator.clipboard && navigator.clipboard.readText) {
                    text = await navigator.clipboard.readText();
                }
                if (text) {
                    urlInput.value = text.trim();
                    validateReadyState();
                }
            } catch (error) {
                console.error('Clipboard paste failed:', error);
            }
        };
    }

    if (queueBtn) {
        queueBtn.onclick = () => {
            if (queueBtn.getAttribute('disabled') === 'true') return;
            const payload = buildDownloadPayload();
            const meta = currentMetaSnapshot();

            if (window.queueManager && window.queueManager.enqueue) {
                window.queueManager.enqueue(payload, meta, { autoStart: false, source: 'queue' });
            }

            animateQueueOrbFrom(queueBtn);
            returnToZenAfterQueueAction();
        };
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
            const langDisplay = new Intl.DisplayNames([window.i18n?.locale || 'en'], { type: 'language' });
            const langResolved = langDisplay.of(language);
            if (langResolved) languageName = langResolved;
        } catch (_) {}

        if (region) {
            try {
                const regionDisplay = new Intl.DisplayNames([window.i18n?.locale || 'en'], { type: 'region' });
                const regionResolved = regionDisplay.of(region);
                if (regionResolved) countryName = regionResolved;
            } catch (_) {}
        }

        const flag = region
            ? String.fromCodePoint(...region.split('').map((c) => 127397 + c.charCodeAt(0)))
            : 'GLB';

        return {
            code: cleanCode,
            languageName,
            countryName: countryName || t('downloader.languages.global', 'Global'),
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
            item.innerText = `${entry.flag} ${entry.countryName} - ${entry.languageName} - ${entry.code}`;
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

        setFetchLoading(true);

        try {
            state.metadataTaskId = await invoke('fetch_metadata', { url });
        } catch (error) {
            console.error('Metadata fetch failed:', error);
            setFetchLoading(false);
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
        if (liveChatRow) {
            liveChatRow.classList.toggle('hidden', !hasLiveChat);
        }
        if (!hasLiveChat && liveChatToggle) {
            liveChatToggle.checked = false;
        }

        const title = data.title || t('common.unknownTitle', 'Unknown title');
        const author = data.channel || data.uploader || t('common.unknownChannel', 'Unknown channel');
        const duration = data.duration_string || formatTime(state.duration);

        document.getElementById('meta-title').innerText = title;
        document.getElementById('meta-author').innerText = author;
        document.getElementById('meta-duration').innerText = duration;

        state.currentTitle = title;
        state.currentThumbnail = data.thumbnail || '';

        if (data.thumbnail) {
            thumbPreview.innerHTML = `<img src="${data.thumbnail}" alt="${t('downloader.thumbnail.alt', 'Thumbnail')}">`;
        } else {
            thumbPreview.innerHTML = `<span class="placeholder">${t('downloader.thumbnail.noPreview', 'NO PREVIEW')}</span>`;
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
            state.currentTitle = null;
            state.currentThumbnail = null;
            setFetchLoading(false);
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
            setFetchLoading(false);
            console.error('Metadata task failed:', payload.error || 'Unknown error');
            if (window.notifier) {
                window.notifier.show(
                    t('common.error', 'Error'),
                    t('downloader.errors.invalidLink', 'Invalid link.'),
                    'error',
                    false
                );
            }
            return;
        }

        if (payload.type !== 'metadata') return;

        state.metadataTaskId = null;
        setFetchLoading(false);

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

    if (subsToggle) {
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
    }

    if (subsLangInput) {
        subsLangInput.addEventListener('input', updateLanguageSuggestions);
        subsLangInput.addEventListener('focus', updateLanguageSuggestions);
    }

    document.addEventListener('click', (event) => {
        if (langWrapper && !langWrapper.contains(event.target)) {
            if (subsLangSuggestions) subsLangSuggestions.classList.add('hidden');
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