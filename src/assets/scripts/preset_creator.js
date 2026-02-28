(() => {
    if (window.__presetCreatorInitialized && window.presetCreator && typeof window.presetCreator.openNew === 'function') {
        return;
    }
    window.__presetCreatorInitialized = true;
    const KEY_ICON_SVG = '<svg viewBox="0 0 24 24" style="width:100%;height:100%;display:block;fill:currentColor"><path d="m22.7 19-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.3.5-1 .1-1.4"/></svg>';

    const toBase64 = (value) => {
        try {
            return btoa(unescape(encodeURIComponent(value)));
        } catch (error) {
            return btoa(value);
        }
    };

    const DEFAULT_ICON_DATA_URL = `data:image/svg+xml;base64,${toBase64(KEY_ICON_SVG)}`;

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

    const showNotification = (message, type = 'info') => {
        if (window.notifier && typeof window.notifier.show === 'function') {
            window.notifier.show(t('common.info', 'Info'), message, type, false);
        }
    };

    const state = {
        modalReady: false,
        modalPromise: null,
        presetId: null,
        iconDataUrl: DEFAULT_ICON_DATA_URL,
        formatData: [],
        formatMap: new Map()
    };

    const loadFormatData = async () => {
        if (state.formatData.length) return;
        try {
            const response = await fetch('assets/format.json', { cache: 'no-store' });
            if (!response.ok) return;
            const json = await response.json();
            const formats = Array.isArray(json?.formats) ? json.formats : [];
            state.formatData = formats;
            state.formatMap = new Map(formats.map((item) => [String(item.id || '').toLowerCase(), item]));
        } catch (error) {
            console.error('Failed to load format.json:', error);
        }
    };

    const rebuildSelect = (selectEl, options) => {
        if (!selectEl) return;
        selectEl.innerHTML = '';
        options.forEach((opt) => {
            const optionEl = document.createElement('option');
            optionEl.value = opt.value;
            optionEl.textContent = opt.label;
            if (opt.i18n) optionEl.setAttribute('data-i18n', opt.i18n);
            selectEl.appendChild(optionEl);
        });
        const wrapper = selectEl.nextElementSibling;
        if (wrapper && wrapper.classList.contains('select-wrapper')) {
            wrapper.remove();
        }
        if (window.initCustomSelects) {
            window.initCustomSelects();
        }
    };

    const normalizeKbps = (value) => {
        const raw = String(value || '').trim().toLowerCase();
        if (!raw) return '';
        const digits = raw.replace(/[^0-9]/g, '');
        if (!digits) return '';
        return `${digits}kbps`;
    };

    const initModal = async () => {
        if (state.modalReady) return;
        await loadFormatData();

        if (!document.getElementById('preset-modal-overlay')) {
            let html = null;
            try {
                const response = await fetch('app/preset_creator.html', { cache: 'no-store' });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                html = await response.text();
            } catch (error) {
                console.error('Failed to load preset creator HTML:', error);
                showNotification(t('presetCreator.notifications.loadFailed', 'Failed to load preset.'), 'error');
                return;
            }
            const wrapper = document.createElement('div');
            wrapper.innerHTML = html.trim();
            const modal = wrapper.querySelector('#preset-modal-overlay') || wrapper.firstElementChild;
            if (modal) {
                document.body.appendChild(modal);
                const modalNode = document.getElementById('preset-modal-overlay') || modal;
                if (window.i18n && typeof window.i18n.apply === 'function') {
                    window.i18n.apply(modalNode);
                }
                if (window.initCustomSelects) {
                    window.initCustomSelects();
                }
            }
        }

        const overlay = document.getElementById('preset-modal-overlay');
        if (!overlay) return;

        const modalTitle = document.getElementById('preset-modal-title');
        const titleInput = document.getElementById('preset-title');
        const summaryInput = document.getElementById('preset-summary');
        const formatInput = document.getElementById('preset-format');
        const suggestionBox = document.getElementById('preset-format-suggestions');
        const advancedPanel = document.getElementById('preset-advanced');
        const pathInput = document.getElementById('preset-path');
        const browseBtn = document.getElementById('preset-path-browse');
        const iconDrop = document.getElementById('preset-icon-drop');
        const iconPreview = document.getElementById('preset-icon-preview');
        const iconFile = document.getElementById('preset-icon-file');
        const iconBrowseBtn = document.getElementById('preset-icon-browse');
        const saveBtn = document.getElementById('preset-save-btn');
        const exportBtn = document.getElementById('preset-export-btn');
        const downloadSubs = document.getElementById('preset-download-subs');
        const embedSubs = document.getElementById('preset-embed-subs');
        const subsCode = document.getElementById('preset-subs-code');
        const embedSubsRow = document.getElementById('preset-embed-subs-row');
        const subsCodeRow = document.getElementById('preset-subs-code-row');
        const embedMeta = document.getElementById('preset-embed-meta');
        const embedThumb = document.getElementById('preset-embed-thumb');
        const geoBypass = document.getElementById('preset-geo-bypass');
        const muteRow = document.getElementById('preset-mute-row');
        const muteAudio = document.getElementById('preset-mute-audio');
        const videoSection = document.getElementById('preset-video-section');
        const audioSection = document.getElementById('preset-audio-section');
        const videoQuality = document.getElementById('preset-video-quality');
        const videoCodec = document.getElementById('preset-video-codec');
        const videoBitrate = document.getElementById('preset-video-bitrate');
        const videoFps = document.getElementById('preset-video-fps');
        const audioSample = document.getElementById('preset-audio-sample');
        const audioCodec = document.getElementById('preset-audio-codec');
        const audioBitrate = document.getElementById('preset-audio-bitrate');

        if (!titleInput || !formatInput || !suggestionBox || !saveBtn || !exportBtn) return;

        const setIconPreview = (dataUrl, inlineSvg = null) => {
            if (!iconPreview) return;
            iconPreview.innerHTML = '';
            if (inlineSvg) {
                iconPreview.innerHTML = inlineSvg;
                return;
            }
            const img = document.createElement('img');
            img.src = dataUrl;
            img.alt = 'Preset icon';
            img.onerror = () => {
                iconPreview.innerHTML = KEY_ICON_SVG;
            };
            iconPreview.appendChild(img);
        };

        const resetIcon = () => {
            state.iconDataUrl = DEFAULT_ICON_DATA_URL;
            setIconPreview(DEFAULT_ICON_DATA_URL);
        };

        const updateSubtitlesExtras = () => {
            const enabled = !!downloadSubs?.checked;
            embedSubsRow?.classList.toggle('visible', enabled);
            subsCodeRow?.classList.toggle('visible', enabled);
            if (!enabled) {
                if (embedSubs) embedSubs.checked = false;
                if (subsCode) subsCode.value = '';
            }
        };

        const resolveFormatMeta = (value) => {
            const formatValue = String(value || '').trim().toLowerCase();
            const meta = state.formatMap.get(formatValue);
            const isGif = formatValue === 'gif';
            const type = meta?.type || (isGif ? 'video' : 'video');
            return { formatValue, meta, isGif, type };
        };

        const updateFormatUI = () => {
            const { formatValue, meta, isGif, type } = resolveFormatMeta(formatInput.value);
            const hasFormat = formatValue.length > 0;
            advancedPanel?.classList.toggle('expanded', hasFormat);

            const showVideo = type !== 'audio';
            const showAudio = type === 'audio' || (!isGif && !muteAudio?.checked);

            videoSection?.classList.toggle('hidden', !showVideo);
            audioSection?.classList.toggle('hidden', !showAudio);

            if (muteRow) {
                if (type === 'audio' || isGif) {
                    muteRow.classList.add('hidden');
                    if (muteAudio) {
                        muteAudio.checked = isGif ? true : false;
                        muteAudio.disabled = isGif;
                    }
                } else {
                    muteRow.classList.remove('hidden');
                    if (muteAudio) muteAudio.disabled = false;
                }
            }

            const videoCodecOptions = [{ value: '', label: t('presetCreator.select.auto', 'Auto'), i18n: 'presetCreator.select.auto' }];
            if (showVideo && meta?.video_codecs?.length) {
                meta.video_codecs.forEach((codec) => {
                    videoCodecOptions.push({ value: codec, label: codec });
                });
            }
            rebuildSelect(videoCodec, videoCodecOptions);

            const audioCodecOptions = [{ value: '', label: t('presetCreator.select.auto', 'Auto'), i18n: 'presetCreator.select.auto' }];
            if (showAudio && meta?.audio_codecs?.length) {
                meta.audio_codecs.forEach((codec) => {
                    audioCodecOptions.push({ value: codec, label: codec });
                });
            }
            rebuildSelect(audioCodec, audioCodecOptions);

            const disableVideo = !showVideo;
            [videoQuality, videoCodec, videoBitrate, videoFps].forEach((el) => {
                if (!el) return;
                el.disabled = disableVideo;
            });
            const disableAudio = !showAudio;
            [audioSample, audioCodec, audioBitrate].forEach((el) => {
                if (!el) return;
                el.disabled = disableAudio;
            });
        };

        const renderSuggestions = (query) => {
            if (!suggestionBox) return;
            suggestionBox.innerHTML = '';
            const term = String(query || '').trim().toLowerCase();
            if (!term) {
                suggestionBox.classList.remove('visible');
                return;
            }

            const matches = state.formatData.filter((item) => {
                const id = String(item.id || '').toLowerCase();
                return id.includes(term);
            });

            matches.slice(0, 10).forEach((item) => {
                const id = String(item.id || '').toLowerCase();
                const label = t(`formats.${id}.label`, id.toUpperCase());
                const desc = t(`formats.${id}.description`, '');
                const entry = document.createElement('div');
                entry.className = 'preset-format-item';
                entry.innerHTML = `
                    <div class="preset-format-label">${label}</div>
                    <div class="preset-format-desc">${desc}</div>
                `;
                entry.addEventListener('click', () => {
                    formatInput.value = id;
                    suggestionBox.classList.remove('visible');
                    updateFormatUI();
                    validate();
                });
                suggestionBox.appendChild(entry);
            });

            suggestionBox.classList.toggle('visible', matches.length > 0);
        };

        const validate = () => {
            const titleOk = String(titleInput.value || '').trim().length > 0;
            const formatOk = String(formatInput.value || '').trim().length > 0;
            saveBtn.disabled = !(titleOk && formatOk);
            exportBtn.disabled = !(titleOk && formatOk);
        };

        const resetForm = () => {
            state.presetId = null;
            if (modalTitle) modalTitle.textContent = t('presetCreator.title.new', 'Create Preset');
            titleInput.value = '';
            summaryInput.value = '';
            formatInput.value = '';
            pathInput.value = '';
            downloadSubs.checked = false;
            embedSubs.checked = false;
            subsCode.value = '';
            embedMeta.checked = false;
            embedThumb.checked = false;
            geoBypass.checked = false;
            muteAudio.checked = false;
            muteAudio.disabled = false;
            videoQuality.value = '';
            videoFps.value = '';
            videoBitrate.value = '';
            audioSample.value = '';
            audioBitrate.value = '';
            resetIcon();
            updateSubtitlesExtras();
            updateFormatUI();
            validate();
        };

        const applyPreset = (preset) => {
            state.presetId = preset?.id || null;
            if (modalTitle) modalTitle.textContent = t('presetCreator.title.edit', 'Edit Preset');
            titleInput.value = preset?.title || '';
            summaryInput.value = preset?.summary || '';
            formatInput.value = preset?.downloader?.format || '';
            pathInput.value = preset?.downloader?.path || '';
            downloadSubs.checked = !!preset?.downloader?.download_subtitles;
            embedSubs.checked = !!preset?.downloader?.embed_subtitles;
            subsCode.value = preset?.downloader?.subtitles_code || '';
            embedMeta.checked = !!preset?.downloader?.embed_metadata;
            embedThumb.checked = !!preset?.downloader?.embed_thumbnail;
            geoBypass.checked = !!preset?.downloader?.geo_bypass;
            muteAudio.checked = !!preset?.downloader?.mute_audio;

            videoQuality.value = preset?.downloader?.video_quality || '';
            videoFps.value = preset?.downloader?.video_fps || '';
            videoBitrate.value = preset?.downloader?.video_bitrate || '';
            audioSample.value = preset?.downloader?.audio_sample_rate || '';
            audioBitrate.value = preset?.downloader?.audio_bitrate || '';

            state.iconDataUrl = preset?.icon_data_url || DEFAULT_ICON_DATA_URL;
            setIconPreview(state.iconDataUrl);

            updateSubtitlesExtras();
            updateFormatUI();

            if (preset?.downloader?.video_codec) videoCodec.value = preset.downloader.video_codec;
            if (preset?.downloader?.audio_codec) audioCodec.value = preset.downloader.audio_codec;
            if (window.initCustomSelects) window.initCustomSelects();
            validate();
        };

        const openModal = () => {
            overlay.classList.add('visible');
            overlay.setAttribute('aria-hidden', 'false');
        };

        const closeModal = () => {
            overlay.classList.remove('visible');
            overlay.setAttribute('aria-hidden', 'true');
        };

        const savePreset = async () => {
            if (!window.__TAURI__?.core?.invoke) return null;
            const { formatValue, type, isGif } = resolveFormatMeta(formatInput.value);
            const payload = {
                id: state.presetId,
                title: String(titleInput.value || '').trim(),
                summary: String(summaryInput.value || '').trim(),
                preset_type: 'downloader',
                hidden: false,
                icon_data_url: state.iconDataUrl,
                downloader: {
                    mode: type === 'audio' ? 'audio' : 'video',
                    format: formatValue,
                    path: String(pathInput.value || '').trim() || null,
                    video_quality: videoSection?.classList.contains('hidden') ? null : (videoQuality.value || null),
                    audio_quality: null,
                    download_subtitles: !!downloadSubs.checked,
                    embed_subtitles: !!embedSubs.checked,
                    subtitles_code: downloadSubs.checked ? (String(subsCode.value || '').trim() || null) : null,
                    embed_metadata: !!embedMeta.checked,
                    embed_thumbnail: !!embedThumb.checked,
                    geo_bypass: !!geoBypass.checked,
                    mute_audio: isGif ? true : !!muteAudio.checked,
                    video_codec: videoSection?.classList.contains('hidden') ? null : (videoCodec.value || null),
                    audio_codec: audioSection?.classList.contains('hidden') ? null : (audioCodec.value || null),
                    video_bitrate: videoSection?.classList.contains('hidden') ? null : (normalizeKbps(videoBitrate.value) || null),
                    audio_bitrate: audioSection?.classList.contains('hidden') ? null : (normalizeKbps(audioBitrate.value) || null),
                    video_fps: videoSection?.classList.contains('hidden') ? null : (videoFps.value || null),
                    audio_sample_rate: audioSection?.classList.contains('hidden') ? null : (audioSample.value || null)
                }
            };

            if (!payload.title || !payload.downloader.format) {
                showNotification(t('presetCreator.notifications.validation', 'Title and format are required.'), 'error');
                return null;
            }

            try {
                const id = await window.__TAURI__.core.invoke('save_preset', { preset: payload });
                state.presetId = id;
                if (window.presetManager?.refresh) window.presetManager.refresh();
                showNotification(t('presetCreator.notifications.saved', 'Preset saved.'), 'success');
                return id;
            } catch (error) {
                console.error('Failed to save preset:', error);
                showNotification(t('presetCreator.notifications.saveFailed', 'Failed to save preset.'), 'error');
                return null;
            }
        };

        const exportPreset = async () => {
            const id = await savePreset();
            if (!id || !window.__TAURI__?.core?.invoke) return;
            try {
                await window.__TAURI__.core.invoke('export_preset', { id });
            } catch (error) {
                console.error('Failed to export preset:', error);
                showNotification(t('presetCreator.notifications.exportFailed', 'Failed to export preset.'), 'error');
            }
        };

        const handleIconFile = (file) => {
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                showNotification(t('presetCreator.notifications.invalidIcon', 'Invalid icon file.'), 'error');
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                const result = String(reader.result || '');
                if (!result.startsWith('data:') || !result.includes('base64')) {
                    showNotification(t('presetCreator.notifications.invalidIcon', 'Invalid icon file.'), 'error');
                    return;
                }
                state.iconDataUrl = result;
                setIconPreview(result);
            };
            reader.onerror = () => {
                showNotification(t('presetCreator.notifications.invalidIcon', 'Invalid icon file.'), 'error');
            };
            reader.readAsDataURL(file);
        };

        iconDrop?.addEventListener('dragover', (event) => {
            event.preventDefault();
            iconDrop.classList.add('dragover');
        });
        iconDrop?.addEventListener('dragleave', () => iconDrop.classList.remove('dragover'));
        iconDrop?.addEventListener('drop', (event) => {
            event.preventDefault();
            iconDrop.classList.remove('dragover');
            const file = event.dataTransfer?.files?.[0];
            handleIconFile(file);
        });
        iconFile?.addEventListener('change', () => handleIconFile(iconFile.files?.[0]));
        iconBrowseBtn?.addEventListener('click', () => iconFile?.click());

        browseBtn?.addEventListener('click', async () => {
            if (!window.__TAURI__?.core?.invoke) return;
            try {
                const selectedPath = await window.__TAURI__.core.invoke('pick_download_directory');
                if (selectedPath) {
                    pathInput.value = selectedPath;
                }
            } catch (error) {
                console.error('Failed to pick directory:', error);
            }
        });

        formatInput.addEventListener('input', () => {
            renderSuggestions(formatInput.value);
            updateFormatUI();
            validate();
        });
        formatInput.addEventListener('focus', () => renderSuggestions(formatInput.value));

        document.addEventListener('click', (event) => {
            if (!suggestionBox.contains(event.target) && event.target !== formatInput) {
                suggestionBox.classList.remove('visible');
            }
        });

        [videoBitrate, audioBitrate].forEach((input) => {
            if (!input) return;
            input.addEventListener('blur', () => {
                input.value = normalizeKbps(input.value);
            });
        });

        downloadSubs?.addEventListener('change', () => {
            updateSubtitlesExtras();
        });
        muteAudio?.addEventListener('change', () => updateFormatUI());

        [titleInput, summaryInput, formatInput].forEach((el) => {
            el?.addEventListener('input', validate);
        });

        saveBtn.addEventListener('click', async () => {
            await savePreset();
        });
        exportBtn.addEventListener('click', async () => {
            await exportPreset();
        });

        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) closeModal();
        });
        overlay.querySelector('[data-action="close"]')?.addEventListener('click', closeModal);
        window.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && overlay.classList.contains('visible')) {
                closeModal();
            }
        });

        state.modalReady = true;
        resetForm();

        window.__presetCreatorAPI = {
            openNew: () => {
                resetForm();
                openModal();
            },
            openEdit: async (id) => {
                if (!window.__TAURI__?.core?.invoke) return;
                try {
                    const preset = await window.__TAURI__.core.invoke('load_preset', { id });
                    applyPreset(preset);
                    openModal();
                } catch (error) {
                    console.error('Failed to load preset:', error);
                    showNotification(t('presetCreator.notifications.loadFailed', 'Failed to load preset.'), 'error');
                }
            },
            close: closeModal
        };
    };

    const ensureReady = async () => {
        if (state.modalReady) return;
        if (!state.modalPromise) {
            state.modalPromise = initModal().finally(() => {
                state.modalPromise = null;
            });
        }
        await state.modalPromise;
    };

    const fallbackOpen = () => {
        const overlay = document.getElementById('preset-modal-overlay');
        if (!overlay) return;
        overlay.classList.add('visible');
        overlay.setAttribute('aria-hidden', 'false');
    };

    window.presetCreator = {
        openNew: async () => {
            try {
                await ensureReady();
                if (window.__presetCreatorAPI?.openNew) {
                    window.__presetCreatorAPI.openNew();
                } else {
                    fallbackOpen();
                }
            } catch (error) {
                console.error('Preset creator init failed:', error);
                fallbackOpen();
            }
        },
        openEdit: async (id) => {
            try {
                await ensureReady();
                if (window.__presetCreatorAPI?.openEdit) {
                    window.__presetCreatorAPI.openEdit(id);
                } else {
                    fallbackOpen();
                }
            } catch (error) {
                console.error('Preset creator init failed:', error);
                fallbackOpen();
            }
        },
        close: async () => {
            try {
                await ensureReady();
                if (window.__presetCreatorAPI?.close) {
                    window.__presetCreatorAPI.close();
                }
            } catch (error) {
                console.error('Preset creator close failed:', error);
            }
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            ensureReady();
        });
    } else {
        ensureReady();
    }
})();