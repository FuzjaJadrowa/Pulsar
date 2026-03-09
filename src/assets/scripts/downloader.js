(function initUi() {
    const { invoke } = window.__TAURI__.core;
    const { listen } = window.__TAURI__.event;

    const videoQualities = ['2160p', '1440p', '1080p', '720p', '480p', '360p', '240p', '144p'];
    const videoFormats = ['MP4', 'MKV', 'WEBM', 'MOV', 'FLV', 'AVI', 'GIF'];
    const audioFormats = ['MP3', 'M4A', 'AAC', 'OPUS', 'WAV', 'FLAC', 'AIFF', 'OGG'];
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
    const KEY_ICON_SVG = '<svg viewBox="0 0 24 24" style="width:100%;height:100%;display:block;fill:currentColor"><path d="m22.7 19-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.3.5-1 .1-1.4"/></svg>';

    const body = document.body;
    const searchSection = document.getElementById('search-section');
    const dashboard = document.getElementById('dashboard-section');
    const urlInput = document.getElementById('url-input');
    const resultsSection = document.getElementById('search-results-section');
    const fetchBtn = document.getElementById('fetch-btn');
    const pasteIcon = document.getElementById('paste-icon');
    const metaAuthor = document.getElementById('meta-author');

    const downloadBtn = document.getElementById('download-btn');
    const queueBtn = document.getElementById('queue-btn');
    const browseBtn = document.getElementById('browse-btn');
    const pathInput = document.getElementById('path-input');
    const presetSection = document.getElementById('preset-section');
    const presetGrid = document.getElementById('preset-grid');

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
    const metadataToggle = document.getElementById('metadata-toggle');
    const muteAudioToggle = document.getElementById('mute-audio-toggle');

    const liveChatRow = document.getElementById('live-chat-row');
    const langWrapper = document.getElementById('lang-wrapper');
    const subsLangInput = document.getElementById('subs-lang');
    const subsLangSuggestions = document.getElementById('subs-lang-suggestions');
    const subsRow = document.querySelector('.subtitles-row');
    const embedSubsRow = document.getElementById('embed-subs-row');
    const embedSubsToggle = document.getElementById('embed-subs-toggle');
    const customArgsInput = document.getElementById('custom-args-input');
    const subtitlesGroup = document.querySelector('.subtitles-group');
    const subsLabel = subtitlesGroup ? subtitlesGroup.querySelector('.option-label') : null;

    const rangeStart = document.getElementById('range-start');
    const rangeEnd = document.getElementById('range-end');
    const rangeFill = document.getElementById('range-fill');
    const timeStartDisplay = document.getElementById('time-start');
    const timeEndDisplay = document.getElementById('time-end');
    const timelineSection = document.querySelector('.timeline-section');

    let state = {
        mode: 'video',
        isAnalyzed: false,
        duration: 0,
        metadataTaskId: null,
        selectedFormat: null,
        selectedQuality: null,
        videoQualityOptions: ['1080p', '720p', '480p', '360p', '240p', '144p'],
        subtitleOptions: [],
        metaSubLangs: [],
        metaAutoLangs: [],
        preferredMode: null,
        lastResolvedMode: null,
        currentSuggestions: [],
        thumbnailAction: 'none',
        currentTitle: null,
        currentThumbnail: null,
        currentUploaderUrl: null,
        advancedMode: false,
        audioOnlySource: false,
        isPlaylist: false,
        presets: [],
        activePresetId: null,
        applyingPreset: false,
        presetOverrides: null
    };

    const openExternalUrl = async (url) => {
        const target = String(url || '').trim();
        if (!target) return;
        try {
            if (window.__TAURI__?.opener?.openUrl) {
                await window.__TAURI__.opener.openUrl(target);
            } else {
                window.open(target, '_blank');
            }
        } catch (error) {
            console.error('Failed to open url:', error);
        }
    };

    if (metaAuthor) {
        metaAuthor.addEventListener('click', () => {
            if (metaAuthor.dataset.url) openExternalUrl(metaAuthor.dataset.url);
        });
        metaAuthor.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                if (metaAuthor.dataset.url) openExternalUrl(metaAuthor.dataset.url);
            }
        });
    }

    function applyAdvancedMode(enabled) {
        state.advancedMode = !!enabled;
        if (document.body) {
            document.body.classList.toggle('advanced-mode', state.advancedMode);
        }
    }

    function applyIdleAnimation(enabled) {
        const body = document.body;
        if (!body) return;
        const wasEnabled = body.classList.contains('idle-anim-enabled');
        body.classList.toggle('idle-anim-enabled', enabled !== false);
        if (!wasEnabled && enabled !== false && typeof window.triggerIdleWavesEnter === 'function') {
            window.triggerIdleWavesEnter();
        }
    }

    function isAudioOnlySourceUrl(rawUrl) {
        const input = String(rawUrl || '').trim();
        if (!input) return false;

        try {
            const url = new URL(input);
            const host = url.hostname.toLowerCase();
            if (host === 'music.youtube.com' || host.endsWith('.music.youtube.com')) return true;
            if (host === 'soundcloud.com' || host.endsWith('.soundcloud.com')) return true;
            if (host === 'soundcloud.app.goo.gl') return true;
            if (host === 'spotify.com' || host.endsWith('.spotify.com')) return true;
            if (host === 'music.apple.com' || host.endsWith('.music.apple.com')) return true;
            if (host === 'itunes.apple.com' || host.endsWith('.itunes.apple.com')) return true;
            if (host === 'apple.co') return true;
            if (host === 'deezer.com' || host.endsWith('.deezer.com')) return true;
            if (host === 'deezer.page.link') return true;
            if (host === 'dzr.page.link') return true;
            if (host === 'link.deezer.com') return true;
            if (host === 'dzr.fm') return true;
            return false;
        } catch (_) {
            const lowered = input.toLowerCase();
            return lowered.includes('music.youtube.com')
                || lowered.includes('soundcloud.com')
                || lowered.includes('soundcloud.app.goo.gl')
                || lowered.includes('spotify.com')
                || lowered.includes('open.spotify')
                || lowered.includes('music.apple.com')
                || lowered.includes('itunes.apple.com')
                || lowered.includes('apple.co/')
                || lowered.includes('deezer.com')
                || lowered.includes('deezer.page.link')
                || lowered.includes('dzr.page.link')
                || lowered.includes('link.deezer.com')
                || lowered.includes('dzr.fm');
        }
    }

    function applySourceConstraints(rawUrl) {
        const audioOnly = isAudioOnlySourceUrl(rawUrl);
        state.audioOnlySource = audioOnly;

        if (body) {
            body.classList.toggle('audio-only-source', audioOnly);
        }
        if (modeVideoBtn) {
            modeVideoBtn.classList.toggle('hidden', audioOnly);
        }
        if (subtitlesGroup) {
            subtitlesGroup.classList.toggle('audio-only', audioOnly);
        }
        if (state.isAnalyzed && state.mode && audioOnly && state.mode === 'video') {
            setMode('audio');
        }
        updateSubtitleInputVisibility();
    }

    function isPlaylistMetadata(data) {
        if (!data || typeof data !== 'object') return false;
        if (Array.isArray(data.entries)) return true;
        if (Array.isArray(data.tracks)) return true;
        const rawType = String(data._type || data.type || '').toLowerCase();
        if (rawType === 'playlist' || rawType === 'multi_video' || rawType === 'album') return true;
        const count = Number(
            data.playlist_count ??
            data.n_entries ??
            data.entry_count ??
            data.track_count ??
            data.n_tracks
        );
        return Number.isFinite(count) && count > 1;
    }

    function isCollectionUrl(rawUrl) {
        const input = String(rawUrl || '').trim().toLowerCase();
        if (!input) return false;
        return input.includes('/playlist') || input.includes('/album') || input.includes('list=');
    }

    function applyPlaylistState(isPlaylist) {
        state.isPlaylist = !!isPlaylist;
        if (timelineSection) {
            timelineSection.classList.toggle('hidden', state.isPlaylist);
        }
        if (state.isPlaylist) {
            if (rangeStart) rangeStart.value = 0;
            if (rangeEnd) rangeEnd.value = 100;
            if (timeStartDisplay) timeStartDisplay.value = '00:00:00';
            if (timeEndDisplay) timeEndDisplay.value = formatTime(state.duration);
            updateSlider();
        }
    }

    function setZenMode(enabled) {
        const body = document.body;
        if (!body) return;
        const wasZen = body.classList.contains('zen-mode');
        body.classList.toggle('zen-mode', !!enabled);
        if (!wasZen && enabled && typeof window.triggerIdleWavesEnter === 'function') {
            window.triggerIdleWavesEnter();
        }
    }

    async function loadAdvancedMode() {
        try {
            const config = await invoke('get_config');
            applyAdvancedMode(config?.advanced_mode);
            applyIdleAnimation(config?.idle_animation);
        } catch (error) {
            console.error('Failed to load advanced mode:', error);
            applyIdleAnimation(true);
        }
    }

    window.addEventListener('pulsar-config-updated', (event) => {
        if (!event?.detail) return;
        if (typeof event.detail.advanced_mode !== 'undefined') {
            applyAdvancedMode(event.detail.advanced_mode);
        }
        if (typeof event.detail.idle_animation !== 'undefined') {
            applyIdleAnimation(event.detail.idle_animation);
        }
    });

    function triggerShakeFeedback(element) {
        if (!element) return;
        element.classList.remove('shake-feedback');
        void element.offsetWidth;
        element.classList.add('shake-feedback');
    }

    function isHttpUrl(value) {
        const trimmed = String(value || '').trim();
        if (!trimmed) return false;
        return /^https?:\/\//i.test(trimmed);
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
            if (!state.applyingPreset) {
                clearActivePreset();
            }

            if (action === 'download') {
                const url = String(state.currentThumbnail || '').trim();
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

    function parseCustomArgs(input) {
        const raw = String(input || '').trim();
        if (!raw) return [];
        const args = [];
        let current = '';
        let quote = null;
        let escape = false;

        for (let i = 0; i < raw.length; i += 1) {
            const ch = raw[i];
            if (escape) {
                current += ch;
                escape = false;
                continue;
            }
            if (ch === '\\') {
                escape = true;
                continue;
            }
            if (quote) {
                if (ch === quote) {
                    quote = null;
                } else {
                    current += ch;
                }
                continue;
            }
            if (ch === '"' || ch === "'") {
                quote = ch;
                continue;
            }
            if (/\s/.test(ch)) {
                if (current.length) {
                    args.push(current);
                    current = '';
                }
                continue;
            }
            current += ch;
        }
        if (current.length) args.push(current);
        return args;
    }

    function trimSummary(value, maxLen = 50) {
        const text = String(value || '').trim();
        if (text.length <= maxLen) return text;
        return `${text.slice(0, Math.max(0, maxLen - 1))}…`;
    }

    function decodeSvgDataUrl(dataUrl) {
        if (!dataUrl || !dataUrl.startsWith('data:image/svg+xml')) return null;
        const parts = dataUrl.split(',');
        if (parts.length < 2) return null;
        const meta = parts[0];
        const data = parts.slice(1).join(',');
        try {
            if (meta.includes(';base64')) {
                return atob(data);
            }
            return decodeURIComponent(data);
        } catch (_) {
            return null;
        }
    }

    function applyPresetIcon(iconEl, iconSource) {
        if (!iconEl) return;
        iconEl.innerHTML = '';
        const source = String(iconSource || '').trim();
        if (!source) {
            iconEl.innerHTML = KEY_ICON_SVG;
            return;
        }
        if (source.startsWith('<svg')) {
            iconEl.innerHTML = source;
            return;
        }
        if (source.startsWith('data:image/svg+xml')) {
            const decoded = decodeSvgDataUrl(source);
            if (decoded) {
                iconEl.innerHTML = decoded;
                return;
            }
        }
        const img = document.createElement('img');
        img.src = source;
        img.alt = 'Preset';
        img.onerror = () => {
            iconEl.innerHTML = KEY_ICON_SVG;
        };
        iconEl.appendChild(img);
    }

    function clearActivePreset() {
        if (!state.activePresetId) {
            state.presetOverrides = null;
            return;
        }
        state.activePresetId = null;
        state.presetOverrides = null;
        if (presetGrid) {
            presetGrid.querySelectorAll('.preset-card.active').forEach((el) => el.classList.remove('active'));
        }
    }

    function setActivePreset(id) {
        state.activePresetId = id;
        if (!presetGrid) return;
        presetGrid.querySelectorAll('.preset-card').forEach((el) => {
            el.classList.toggle('active', el.dataset.presetId === id);
        });
    }

    function selectTileByText(container, value) {
        if (!container || !value) return;
        const target = String(value).trim().toUpperCase();
        const tiles = Array.from(container.querySelectorAll('.tile'));
        const match = tiles.find((tile) => {
            const span = tile.querySelector('span');
            const text = span ? span.textContent : tile.textContent;
            return String(text || '').trim().toUpperCase() === target;
        });
        if (match) match.click();
    }

    function setThumbnailAction(action) {
        const desired = action === 'embed' ? 'embed' : 'none';
        thumbBtns.forEach((b) => {
            if (b.dataset.thumb === 'download') return;
            b.classList.toggle('active', b.dataset.thumb === desired);
        });
        state.thumbnailAction = desired;
    }

    async function applyPreset(preset) {
        if (!preset || !preset.downloader) return;
        state.applyingPreset = true;
        try {
            const d = preset.downloader;
            const override = {
                video_codec: d.video_codec || null,
                audio_codec: d.audio_codec || null,
                video_bitrate: d.video_bitrate || null,
                audio_bitrate: d.audio_bitrate || null,
                video_fps: d.video_fps || null,
                audio_sample_rate: d.audio_sample_rate || null
            };
            state.presetOverrides = Object.values(override).some((value) => value) ? override : null;
            if (d.path && pathInput) {
                pathInput.value = d.path;
            }
            await setMode(d.mode || 'video');
            if (state.mode === 'video') {
                selectTileByText(formatList, d.format || '');
                selectTileByText(qualityList, d.video_quality || '');
            } else {
                selectTileByText(formatList, d.format || '');
                selectTileByText(qualityList, d.audio_quality || '');
            }

            if (geoToggle) geoToggle.checked = !!d.geo_bypass;
            if (metadataToggle) metadataToggle.checked = !!d.embed_metadata;
            if (muteAudioToggle && !muteAudioToggle.disabled) {
                muteAudioToggle.checked = !!d.mute_audio;
            }
            updateMuteAudioState();

            const subsAvailable = !(subsRow && subsRow.classList.contains('hidden')) && subsToggle && !subsToggle.disabled;
            if (subsAvailable) {
                subsToggle.checked = !!d.download_subtitles;
                updateSubtitleInputVisibility();
                if (embedSubsToggle && embedSubsRow && embedSubsRow.classList.contains('visible')) {
                    embedSubsToggle.checked = !!d.embed_subtitles;
                }
                if (subsLangInput && d.subtitles_code) {
                    subsLangInput.value = d.subtitles_code;
                }
            }

            setThumbnailAction(d.embed_thumbnail ? 'embed' : 'none');
            validateReadyState();
        } finally {
            state.applyingPreset = false;
        }
    }

    async function handlePresetClick(preset) {
        if (!preset || !preset.id) return;
        if (state.activePresetId === preset.id) {
            clearActivePreset();
            return;
        }
        try {
            const fullPreset = await invoke('load_preset', { id: preset.id });
            await applyPreset(fullPreset);
            setActivePreset(preset.id);
        } catch (error) {
            console.error('Failed to load preset:', error);
        }
    }

    async function loadPresets() {
        if (!presetGrid || !presetSection) return;
        try {
            const presets = await invoke('list_presets');
            const safePresets = Array.isArray(presets) ? presets : [];
            state.presets = safePresets.filter((preset) => !preset.hidden && preset.preset_type === 'downloader');
        } catch (error) {
            console.warn('Preset list not available:', error);
            state.presets = [];
        }

        presetGrid.innerHTML = '';
        const activeId = state.activePresetId;
        if (!state.presets.length) {
            presetSection.classList.add('hidden');
            clearActivePreset();
            return;
        }
        presetSection.classList.remove('hidden');

        state.presets.forEach((preset) => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'preset-card';
            card.dataset.presetId = preset.id;

            const icon = document.createElement('div');
            icon.className = 'preset-card-icon';
            const iconSource = preset.icon_data_url || preset.icon;
            applyPresetIcon(icon, iconSource);

            const info = document.createElement('div');
            info.className = 'preset-card-info';
            const title = document.createElement('div');
            title.className = 'preset-card-title';
            title.textContent = preset.title || t('settings.presetsManager.untitled', 'Untitled');
            const summary = document.createElement('div');
            summary.className = 'preset-card-summary';
            summary.textContent = trimSummary(preset.summary || t('settings.presetsManager.noSummary', 'No summary'));
            info.appendChild(title);
            info.appendChild(summary);

            card.appendChild(icon);
            card.appendChild(info);
            card.addEventListener('click', () => handlePresetClick(preset));
            presetGrid.appendChild(card);
        });
        if (activeId) {
            const exists = state.presets.some((preset) => preset.id === activeId);
            if (exists) {
                setActivePreset(activeId);
            } else {
                clearActivePreset();
            }
        }
    }

    function detectSourceFromUrl(rawUrl) {
        const input = String(rawUrl || '').trim().toLowerCase();
        if (!input) return null;
        try {
            const url = new URL(input);
            const host = url.hostname.toLowerCase();
            if (host === 'music.youtube.com' || host.endsWith('.music.youtube.com')) return 'ytmusic';
            if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be') return 'youtube';
            if (host === 'soundcloud.com' || host.endsWith('.soundcloud.com') || host === 'soundcloud.app.goo.gl') return 'soundcloud';
            if (host === 'spotify.com' || host.endsWith('.spotify.com')) return 'spotify';
            if (host === 'music.apple.com' || host.endsWith('.music.apple.com') || host === 'itunes.apple.com' || host.endsWith('.itunes.apple.com') || host === 'apple.co') return 'applemusic';
            if (host === 'deezer.com' || host.endsWith('.deezer.com') || host === 'deezer.page.link') return 'deezer';
            if (host === 'dzr.page.link' || host === 'link.deezer.com' || host === 'dzr.fm') return 'deezer';
        } catch (_) {
            if (input.includes('music.youtube.com')) return 'ytmusic';
            if (input.includes('youtube.com') || input.includes('youtu.be')) return 'youtube';
            if (input.includes('soundcloud.com') || input.includes('soundcloud.app.goo.gl')) return 'soundcloud';
            if (input.includes('spotify.com')) return 'spotify';
            if (input.includes('music.apple.com') || input.includes('itunes.apple.com') || input.includes('apple.co/')) return 'applemusic';
            if (input.includes('deezer.com') || input.includes('deezer.page.link') || input.includes('dzr.page.link') || input.includes('link.deezer.com') || input.includes('dzr.fm')) return 'deezer';
        }
        return null;
    }

    function createSourceIcon(source) {
        const icons = {
            youtube: `<svg viewBox="0 0 28.57 20" aria-hidden="true"><path d="M27.9727 3.12324C27.6435 1.89323 26.6768 0.926623 25.4468 0.597366C23.2197 2.24288e-07 14.285 0 14.285 0C14.285 0 5.35042 2.24288e-07 3.12323 0.597366C1.89323 0.926623 0.926623 1.89323 0.597366 3.12324C2.24288e-07 5.35042 0 10 0 10C0 10 2.24288e-07 14.6496 0.597366 16.8768C0.926623 18.1068 1.89323 19.0734 3.12323 19.4026C5.35042 20 14.285 20 14.285 20C14.285 20 23.2197 20 25.4468 19.4026C26.6768 19.0734 27.6435 18.1068 27.9727 16.8768C28.5701 14.6496 28.5701 10 28.5701 10C28.5701 10 28.5677 5.35042 27.9727 3.12324Z"/><path d="M11.4253 14.2854L18.8477 10.0004L11.4253 5.71533V14.2854Z"/></svg>`,
            ytmusic: `<svg viewBox="0 0 176 176" aria-hidden="true"><circle cx="88" cy="88" r="88"/><path d="M88,46c23.1,0,42,18.8,42,42s-18.8,42-42,42s-42-18.8-42-42S64.9,46,88,46 M88,42c-25.4,0-46,20.6-46,46s20.6,46,46,46s46-20.6,46-46S113.4,42,88,42L88,42z"/><polygon points="72,111 111,87 72,65"/></svg>`,
            soundcloud: `<svg viewBox="0 0 2499.998 1386.695" aria-hidden="true"><path d="M0 1137.737c0 31.024 11.247 54.481 33.737 70.382 22.491 15.898 46.533 21.52 72.126 16.868 24.041-4.653 40.91-13.185 50.607-25.593 9.693-12.408 14.542-32.962 14.542-61.657V800.372c0-24.044-8.336-44.403-25.012-61.075-16.672-16.676-37.03-25.012-61.074-25.012-23.267 0-43.237 8.336-59.912 25.012C8.339 755.969 0 776.327 0 800.372zm267.566 144.253c0 22.495 7.95 39.36 23.848 50.608 15.9 11.247 36.26 16.868 61.075 16.868 25.593 0 46.338-5.624 62.238-16.868 15.898-11.245 23.849-28.113 23.849-50.608V495.58c0-23.267-8.34-43.239-25.012-59.912-16.675-16.672-37.033-25.011-61.075-25.011-23.266 0-43.239 8.339-59.911 25.011-16.676 16.676-25.012 36.645-25.012 59.912zm266.403 37.227c0 22.492 8.143 39.36 24.43 50.607 16.286 11.245 37.226 16.869 62.822 16.869 24.816 0 45.174-5.624 61.072-16.869 15.9-11.247 23.851-28.115 23.851-50.607V601.442c0-24.041-8.339-44.595-25.012-61.657-16.675-17.061-36.644-25.59-59.911-25.59-24.044 0-44.595 8.529-61.657 25.59-17.061 17.062-25.593 37.616-25.593 61.657v717.775zm267.566 3.49c0 42.657 28.695 63.986 86.086 63.986 57.39 0 86.084-21.329 86.084-63.986V159.377c0-65.147-19.776-101.985-59.33-110.517-25.593-6.205-50.8 1.163-75.616 22.103-24.818 20.94-37.227 50.41-37.227 88.413v1163.331zm272.222 33.737V90.74c0-40.328 12.02-64.37 36.063-72.127C1161.78 6.205 1213.356 0 1264.543 0c118.657 0 229.176 27.92 331.547 83.76 102.373 55.84 185.165 132.038 248.37 228.594 63.21 96.56 99.854 203.001 109.936 319.337 47.308-20.165 97.717-30.247 151.23-30.247 108.578 0 201.452 38.39 278.618 115.17 77.168 76.782 115.754 169.072 115.754 276.875 0 108.578-38.586 201.256-115.754 278.036-77.166 76.78-169.651 115.17-277.455 115.17l-1012.097-1.163c-6.983-2.327-12.218-6.594-15.708-12.797s-5.227-11.638-5.227-16.291z"/></svg>`,
            spotify: `<svg viewBox="0 0 496 512" aria-hidden="true"><path d="M248 8C111.1 8 0 119.1 0 256s111.1 248 248 248 248-111.1 248-248S384.9 8 248 8Z"/><path d="M406.6 231.1c-5.2 0-8.4-1.3-12.9-3.9-71.2-42.5-198.5-52.7-280.9-29.7-3.6 1-8.1 2.6-12.9 2.6-13.2 0-23.3-10.3-23.3-23.6 0-13.6 8.4-21.3 17.4-23.9 35.2-10.3 74.6-15.2 117.5-15.2 73 0 149.5 15.2 205.4 47.8 7.8 4.5 12.9 10.7 12.9 22.6 0 13.6-11 23.3-23.2 23.3zm-31 76.2c-5.2 0-8.7-2.3-12.3-4.2-62.5-37-155.7-51.9-238.6-29.4-4.8 1.3-7.4 2.6-11.9 2.6-10.7 0-19.4-8.7-19.4-19.4s5.2-17.8 15.5-20.7c27.8-7.8 56.2-13.6 97.8-13.6 64.9 0 127.6 16.1 177 45.5 8.1 4.8 11.3 11 11.3 19.7-.1 10.8-8.5 19.5-19.4 19.5zm-26.9 65.6c-4.2 0-6.8-1.3-10.7-3.6-62.4-37.6-135-39.2-206.7-24.5-3.9 1-9 2.6-11.9 2.6-9.7 0-15.8-7.7-15.8-15.8 0-10.3 6.1-15.2 13.6-16.8 81.9-18.1 165.6-16.5 237 26.2 6.1 3.9 9.7 7.4 9.7 16.5s-7.1 15.4-15.2 15.4z"/></svg>`,
            applemusic: `<svg viewBox="0 0 361 361" aria-hidden="true"><path d="M254.5,55c-0.87,0.08-8.6,1.45-9.53,1.64l-107,21.59l-0.04,0.01c-2.79,0.59-4.98,1.58-6.67,3c-2.04,1.71-3.17,4.13-3.6,6.95c-0.09,0.6-0.24,1.82-0.24,3.62c0,0,0,109.32,0,133.92c0,3.13-0.25,6.17-2.37,8.76c-2.12,2.59-4.74,3.37-7.81,3.99c-2.33,0.47-4.66,0.94-6.99,1.41c-8.84,1.78-14.59,2.99-19.8,5.01c-4.98,1.93-8.71,4.39-11.68,7.51c-5.89,6.17-8.28,14.54-7.46,22.38c0.7,6.69,3.71,13.09,8.88,17.82c3.49,3.2,7.85,5.63,12.99,6.66c5.33,1.07,11.01,0.7,19.31-0.98c4.42-0.89,8.56-2.28,12.5-4.61c3.9-2.3,7.24-5.37,9.85-9.11c2.62-3.75,4.31-7.92,5.24-12.35c0.96-4.57,1.19-8.7,1.19-13.26l0-116.15c0-6.22,1.76-7.86,6.78-9.08c0,0,88.94-17.94,93.09-18.75c5.79-1.11,8.52,0.54,8.52,6.61l0,79.29c0,3.14-0.03,6.32-2.17,8.92c-2.12,2.59-4.74,3.37-7.81,3.99c-2.33,0.47-4.66,0.94-6.99,1.41c-8.84,1.78-14.59,2.99-19.8,5.01c-4.98,1.93-8.71,4.39-11.68,7.51c-5.89,6.17-8.49,14.54-7.67,22.38c0.7,6.69,3.92,13.09,9.09,17.82c3.49,3.2,7.85,5.56,12.99,6.6c5.33,1.07,11.01,0.69,19.31-0.98c4.42-0.89,8.56-2.22,12.5-4.55c3.9-2.3,7.24-5.37,9.85-9.11c2.62-3.75,4.31-7.92,5.24-12.35c0.96-4.57,1-8.7,1-13.26V64.46C263.54,58.3,260.29,54.5,254.5,55z"/></svg>`,
            deezer: `<svg viewBox="-0.02 0 277.13 277.12" aria-hidden="true"><g transform="translate(-13.9)"><path d="M21.9 115.7c4.4 0 8-14.5 8-32.4s-3.6-32.4-8-32.4-8 14.5-8 32.4 3.6 32.4 8 32.4"/><path d="M256.8 18c-4.2 0-7.9 9.3-10.5 24.2C242.1 16.7 235.4 0 227.8 0c-9 0-16.9 23.5-20.6 57.7C203.5 32.9 198 17 191.9 17c-8.6 0-16 31.2-18.7 74.7-5.1-22.3-12.5-36.3-20.7-36.3s-15.6 14-20.7 36.3C129 48.2 121.7 17 113 17c-6.2 0-11.7 15.9-15.3 40.8C94 23.5 86.2 0 77.1 0c-7.6 0-14.4 16.7-18.5 42.3C56 27.4 52.3 18 48.1 18 40.3 18 34 50.5 34 90.5s6.3 72.4 14.1 72.4c3.2 0 6.2-5.5 8.5-14.7 3.7 33.8 11.5 57 20.5 57 7 0 13.2-13.9 17.4-35.9 2.9 41.8 10.1 71.5 18.5 71.5 5.3 0 10.1-11.8 13.7-30.9 4.3 39.5 14.2 67.2 25.8 67.2s21.5-27.7 25.8-67.2c3.6 19.1 8.4 30.9 13.7 30.9 8.4 0 15.6-29.7 18.5-71.5 4.2 22 10.4 35.9 17.4 35.9 9 0 16.8-23.2 20.5-57 2.4 9.2 5.3 14.7 8.5 14.7 7.8 0 14.1-32.4 14.1-72.4-.2-40-6.5-72.5-14.2-72.5"/><path d="M283 115.7c4.4 0 8-14.5 8-32.4s-3.6-32.4-8-32.4-8 14.5-8 32.4 3.6 32.4 8 32.4"/></g></svg>`
        };
        const markup = icons[source];
        if (!markup) return null;
        const span = document.createElement('span');
        span.className = `meta-source-icon ${source}-icon`;
        span.innerHTML = markup;
        return span;
    }

    function buildDownloadPayload() {
        const isTimeRangeActive = !state.isPlaylist && (parseInt(rangeStart.value) > 0 || parseInt(rangeEnd.value) < 100);
        const customArgs = state.advancedMode && customArgsInput ? parseCustomArgs(customArgsInput.value) : [];
        const muteAudio = state.mode === 'video' && muteAudioToggle ? muteAudioToggle.checked : false;

        const payload = {
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
            embed_tags: metadataToggle ? metadataToggle.checked : false,
            embed_thumbnail: state.thumbnailAction === 'embed',
            mute_audio: muteAudio,

            download_subs: subsToggle ? subsToggle.checked : false,
            download_chat: liveChatToggle ? liveChatToggle.checked : false,
            subs_code: subsLangInput.value.trim(),
            embed_subs: embedSubsToggle ? embedSubsToggle.checked : false,
            meta_sub_langs: state.metaSubLangs || [],
            meta_auto_langs: state.metaAutoLangs || []
        };
        if (state.activePresetId && state.presetOverrides) {
            Object.entries(state.presetOverrides).forEach(([key, value]) => {
                if (value !== null && value !== '') {
                    payload[key] = value;
                }
            });
        }
        if (customArgs.length) payload.custom_args = customArgs;
        return payload;
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
                if (typeof invoke === 'function') {
                    text = await invoke('read_clipboard_text');
                } else if (navigator.clipboard && navigator.clipboard.readText) {
                    text = await navigator.clipboard.readText();
                }
                if (text) {
                    urlInput.value = text.trim();
                    urlInput.dispatchEvent(new Event('input', { bubbles: true }));
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

        if (!isHttpUrl(url)) {
            if (window.searchUi && typeof window.searchUi.startSearch === 'function') {
                window.searchUi.startSearch(url);
                return null;
            }
            triggerShakeFeedback(urlInput);
            return null;
        }

        if (!state.isAnalyzed) {
            applySourceConstraints(url);
        }
        setFetchLoading(true);

        try {
            const taskId = await invoke('fetch_metadata', { url });
            state.metadataTaskId = taskId;
            return taskId;
        } catch (error) {
            console.error('Metadata fetch failed:', error);
            setFetchLoading(false);
            return null;
        }
    }

    function showDashboard() {
        searchSection.classList.remove('centered');
        searchSection.classList.add('sticky');
        setZenMode(false);

        setTimeout(() => {
            dashboard.classList.remove('hidden');
            state.isAnalyzed = true;
            state.mode = null;
            const preferredMode = state.preferredMode || state.lastResolvedMode;
            const defaultMode = state.audioOnlySource ? 'audio' : (preferredMode || 'video');
            setMode(defaultMode);
        }, 500);
    }

    function updateMetadataView(data) {
        const inputUrl = urlInput ? urlInput.value.trim() : '';
        const metaUrl = String(data.webpage_url || '').trim();
        const sourceUrl = isAudioOnlySourceUrl(inputUrl) ? inputUrl : (metaUrl || inputUrl);
        applySourceConstraints(sourceUrl);
        state.duration = Number(data.duration) || 0;
        applyPlaylistState(
            isPlaylistMetadata(data)
            || isCollectionUrl(sourceUrl)
            || isCollectionUrl(metaUrl)
            || isCollectionUrl(inputUrl)
        );
        state.videoQualityOptions = parseVideoQuality(data.formats || []);
        state.subtitleOptions = buildSubtitleOptions(data);
        state.metaSubLangs = Array.isArray(data.subtitles_langs)
            ? data.subtitles_langs.map((lang) => String(lang).trim()).filter(Boolean)
            : [];
        state.metaAutoLangs = Array.isArray(data.auto_captions_langs)
            ? data.auto_captions_langs.map((lang) => String(lang).trim()).filter(Boolean)
            : [];
        setSubtitlesAvailability(state.metaSubLangs.length > 0 || state.metaAutoLangs.length > 0);
        if (subsToggle && subsToggle.checked) {
            updateLanguageSuggestions();
        }

        const hasLiveChat = state.subtitleOptions.some((entry) => entry.code.toLowerCase() === 'live_chat');
        if (liveChatRow) {
            liveChatRow.classList.toggle('hidden', !hasLiveChat);
        }
        if (!hasLiveChat && liveChatToggle) {
            liveChatToggle.checked = false;
        }

        const title = data.title || t('common.unknownTitle', 'Unknown title');
        const author = data.channel || data.uploader || t('common.unknownChannel', 'Unknown channel');
        const uploaderUrl = data.uploader_url || data.uploaderUrl || '';
        const duration = data.duration_string || formatTime(state.duration);

        document.getElementById('meta-title').innerText = title;
        if (metaAuthor) {
            metaAuthor.setAttribute('data-i18n-lock', 'true');
            metaAuthor.innerHTML = '';
            const source = detectSourceFromUrl(sourceUrl);
            const sourceIcon = createSourceIcon(source);
            if (sourceIcon) {
                metaAuthor.appendChild(sourceIcon);
            }
            const nameSpan = document.createElement('span');
            nameSpan.className = 'meta-author-name';
            nameSpan.innerText = author;
            metaAuthor.appendChild(nameSpan);

            metaAuthor.dataset.url = uploaderUrl || '';
            metaAuthor.classList.toggle('meta-author-link', !!uploaderUrl);
            if (uploaderUrl) {
                metaAuthor.setAttribute('role', 'button');
                metaAuthor.tabIndex = 0;
            } else {
                metaAuthor.removeAttribute('role');
                metaAuthor.tabIndex = -1;
            }
        }
        document.getElementById('meta-duration').innerText = duration;

        state.currentTitle = title;
        state.currentThumbnail = data.thumbnail || '';
        state.currentUploaderUrl = uploaderUrl || '';

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
            setZenMode(true);
            state.isAnalyzed = false;
            state.metadataTaskId = null;
            state.selectedFormat = null;
            state.selectedQuality = null;
            state.subtitleOptions = [];
            state.metaSubLangs = [];
            state.metaAutoLangs = [];
            state.currentTitle = null;
            state.currentThumbnail = null;
            state.currentUploaderUrl = null;
            state.isPlaylist = false;
            clearActivePreset();
            if (timelineSection) timelineSection.classList.remove('hidden');
            if (metaAuthor) {
                metaAuthor.removeAttribute('data-i18n-lock');
                metaAuthor.innerText = t('downloader.meta.defaultAuthor', 'Channel Name');
                metaAuthor.dataset.url = '';
                metaAuthor.classList.remove('meta-author-link');
                metaAuthor.removeAttribute('role');
                metaAuthor.tabIndex = -1;
            }
            if (muteAudioToggle) {
                muteAudioToggle.checked = false;
            }
            updateMuteAudioState();
            if (customArgsInput) customArgsInput.value = '';
            setSubtitlesAvailability(true);
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
    urlInput.oninput = () => {
        if (urlInput.value.trim() === '') {
            resetToZen();
        }
    };
    urlInput.onblur = () => {
        if (urlInput.value.trim() === '') {
            applySourceConstraints('');
        }
    };

    listen('download-event', (event) => {
        const payload = event.payload;

        if (!payload || !state.metadataTaskId || payload.id !== state.metadataTaskId) return;

        if (payload.type === 'finished' && payload.success === false) {
            state.metadataTaskId = null;
            setFetchLoading(false);
            console.error('Metadata task failed:', payload.error || 'Unknown error');
            if (window.notifier) {
                const errorMessage = payload.error || t('downloader.errors.invalidLink', 'Invalid link.');
                window.notifier.show(
                    t('common.error', 'Error'),
                    errorMessage,
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
        if (state.audioOnlySource && mode === 'video') mode = 'audio';
        if (state.mode === mode) return;
        state.mode = mode;
        state.lastResolvedMode = mode;

        if (optionsWrapper) optionsWrapper.classList.add('fading-out');
        await new Promise(r => setTimeout(r, 200));

        body.classList.remove('mode-video', 'mode-audio');

        if (mode === 'video') {
            body.classList.add('mode-video');
            modeVideoBtn.classList.add('active');
            modeAudioBtn.classList.remove('active');
            renderVideoOptions();
            updateMuteAudioState();
        } else {
            body.classList.add('mode-audio');
            modeAudioBtn.classList.add('active');
            modeVideoBtn.classList.remove('active');
            renderAudioOptions();
            updateMuteAudioState();
        }

        state.selectedFormat = null;
        state.selectedQuality = null;
        validateReadyState();
        updateSlider();
        if (optionsWrapper) optionsWrapper.classList.remove('fading-out');
    }

    modeVideoBtn.onclick = () => {
        if (state.audioOnlySource) {
            triggerShakeFeedback(modeAudioBtn);
            return;
        }
        if (state.mode === 'video') {
            triggerShakeFeedback(modeVideoBtn);
            return;
        }
        if (!state.applyingPreset) clearActivePreset();
        state.preferredMode = 'video';
        setMode('video');
    };
    modeAudioBtn.onclick = () => {
        state.preferredMode = 'audio';
        if (state.mode === 'audio') {
            triggerShakeFeedback(modeAudioBtn);
            return;
        }
        if (!state.applyingPreset) clearActivePreset();
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
            if (!state.applyingPreset) clearActivePreset();
            div.parentElement.querySelectorAll('.tile').forEach(t => t.classList.remove('active'));
            div.classList.add('active');
            if (div.parentElement.id === 'format-list') {
                state.selectedFormat = text;
                updateMuteAudioState();
            }
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
    pathInput.addEventListener('input', () => {
        if (!state.applyingPreset) clearActivePreset();
    });

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
        rangeStart.oninput = () => {
            if (!state.applyingPreset) clearActivePreset();
            updateSlider();
        };
        rangeEnd.oninput = () => {
            if (!state.applyingPreset) clearActivePreset();
            updateSlider();
        };

        timeStartDisplay.onchange = () => {
            if (!state.applyingPreset) clearActivePreset();
            handleManualTimeInput(timeStartDisplay, true);
        };
        timeEndDisplay.onchange = () => {
            if (!state.applyingPreset) clearActivePreset();
            handleManualTimeInput(timeEndDisplay, false);
        };
    }

    function updateSubtitleInputVisibility() {
        if (subsRow && subsRow.classList.contains('hidden')) {
            if (embedSubsRow) embedSubsRow.classList.remove('visible');
            if (langWrapper) langWrapper.classList.remove('visible');
            return;
        }
        const wantsSubs = !!(subsToggle && subsToggle.checked);
        if (embedSubsRow) {
            embedSubsRow.classList.toggle('visible', wantsSubs);
        }
        if (langWrapper) {
            langWrapper.classList.toggle('visible', wantsSubs);
        }
        if (!wantsSubs && embedSubsToggle) {
            embedSubsToggle.checked = false;
        }
        if (!wantsSubs) {
            if (subsLangSuggestions) subsLangSuggestions.classList.add('hidden');
            return;
        }
        updateLanguageSuggestions();
        if (subsLangInput) subsLangInput.focus();
    }

    function updateMuteAudioState() {
        if (!muteAudioToggle) return;
        if (state.mode !== 'video' || state.audioOnlySource) {
            muteAudioToggle.checked = false;
            muteAudioToggle.disabled = true;
            return;
        }
        const isGif = String(state.selectedFormat || '').trim().toUpperCase() === 'GIF';
        if (isGif) {
            muteAudioToggle.checked = true;
            muteAudioToggle.disabled = true;
            return;
        }
        muteAudioToggle.disabled = false;
    }

    function setSubtitlesAvailability(hasSubs) {
        if (subsRow) subsRow.classList.toggle('hidden', !hasSubs);
        if (subsLabel) subsLabel.classList.toggle('hidden', !hasSubs);
        if (subsToggle) {
            subsToggle.disabled = !hasSubs;
            if (!hasSubs) subsToggle.checked = false;
        }
        if (embedSubsToggle && !hasSubs) {
            embedSubsToggle.checked = false;
        }
        if (liveChatToggle && !hasSubs) {
            liveChatToggle.checked = false;
        }
        if (!hasSubs) {
            if (liveChatRow) liveChatRow.classList.add('hidden');
            if (embedSubsRow) embedSubsRow.classList.remove('visible');
            if (langWrapper) langWrapper.classList.remove('visible');
        }
        updateSubtitleInputVisibility();
    }

    if (subsToggle) subsToggle.onchange = updateSubtitleInputVisibility;
    if (embedSubsToggle) embedSubsToggle.onchange = updateSubtitleInputVisibility;
    if (subsToggle) subsToggle.addEventListener('change', () => {
        if (!state.applyingPreset) clearActivePreset();
    });
    if (embedSubsToggle) embedSubsToggle.addEventListener('change', () => {
        if (!state.applyingPreset) clearActivePreset();
    });
    if (liveChatToggle) liveChatToggle.addEventListener('change', () => {
        if (!state.applyingPreset) clearActivePreset();
    });
    if (geoToggle) geoToggle.addEventListener('change', () => {
        if (!state.applyingPreset) clearActivePreset();
    });
    if (metadataToggle) metadataToggle.addEventListener('change', () => {
        if (!state.applyingPreset) clearActivePreset();
    });
    if (muteAudioToggle) muteAudioToggle.addEventListener('change', () => {
        if (!state.applyingPreset) clearActivePreset();
    });
    if (customArgsInput) customArgsInput.addEventListener('input', () => {
        if (!state.applyingPreset) clearActivePreset();
    });

    if (subsLangInput) {
        subsLangInput.addEventListener('input', () => {
            if (!state.applyingPreset) clearActivePreset();
            updateLanguageSuggestions();
        });
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

    updateSubtitleInputVisibility();
    updateSlider();
    setZenMode(true);
    loadAdvancedMode();
    window.addEventListener('pulsar-presets-updated', () => {
        loadPresets();
    });
    loadPresets();
    const syncZenState = () => {
        if (!body || !searchSection || !urlInput) return;
        if (body.classList.contains('search-mode')) {
            setZenMode(false);
            return;
        }
        const centered = searchSection.classList.contains('centered');
        const dashboardHidden = !dashboard || dashboard.classList.contains('hidden');
        const resultsHidden = !resultsSection || resultsSection.classList.contains('hidden');
        const hasUrl = urlInput.value.trim().length > 0;
        if (centered && dashboardHidden && resultsHidden && !hasUrl) {
            setZenMode(true);
        } else {
            setZenMode(false);
        }
    };

    window.downloaderUi = {
        startMetadataForUrl: async (url) => {
            const trimmed = String(url || '').trim();
            if (!trimmed) return null;
            urlInput.value = trimmed;
            if (!state.isAnalyzed) {applySourceConstraints(trimmed);
            }
            return activateDashboard();
        },
        setFetchLoading: (isLoading) => setFetchLoading(!!isLoading),
        hideDashboard: () => {
            if (dashboard) dashboard.classList.add('hidden');
        },
        clearModeClasses: () => {
            if (body) body.classList.remove('mode-video', 'mode-audio');
        },
        triggerShake: (element) => triggerShakeFeedback(element || urlInput),
        syncIdleAnimation: () => {},
        syncZenState
    };
})();