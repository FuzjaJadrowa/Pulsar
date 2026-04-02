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
            let titleKey = 'common.info';
            let fallback = 'Info';
            if (type === 'success') {
                titleKey = 'common.success';
                fallback = 'Success';
            } else if (type === 'error') {
                titleKey = 'common.error';
                fallback = 'Error';
            }
            window.notifier.show(t(titleKey, fallback), message, type, false);
        }
    };

    const emitPresetsUpdated = () => {
        window.dispatchEvent(new CustomEvent('pulsar-presets-updated'));
    };

    const state = {
        modalReady: false,
        modalPromise: null,
        presetId: null,
        iconDataUrl: DEFAULT_ICON_DATA_URL,
        presetType: 'downloader',
        compressorMode: 'percent',
        formatsLoaded: false,
        formatData: { downloader: [], converter: [] },
        formatMap: { downloader: new Map(), converter: new Map() },
        hidden: false
    };

    const loadFormatData = async () => {
        if (state.formatsLoaded) return;
        try {
            const response = await fetch('assets/format.json', { cache: 'no-store' });
            if (!response.ok) return;
            const json = await response.json();
            const downloaderFormats = Array.isArray(json?.dformats) ? json.dformats : [];
            const converterFormats = Array.isArray(json?.cformats) ? json.cformats : [];
            state.formatData = { downloader: downloaderFormats, converter: converterFormats };
            state.formatMap = {
                downloader: new Map(downloaderFormats.map((item) => [String(item.id || '').toLowerCase(), item])),
                converter: new Map(converterFormats.map((item) => [String(item.id || '').toLowerCase(), item]))
            };
            state.formatsLoaded = true;
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

    const parseKbpsValue = (value) => {
        const raw = String(value || '');
        const digits = raw.match(/\d+/g);
        if (!digits) return null;
        const parsed = parseInt(digits.join(''), 10);
        return Number.isFinite(parsed) ? parsed : null;
    };

    const bitrateConstraints = {
        video: { min: 500, max: 100000, fallback: 8000 },
        audio: { min: 16, max: 500, fallback: 320 }
    };

    const clampBitrate = (value, constraints, allowEmpty = false) => {
        const raw = String(value || '').trim();
        if (!raw && allowEmpty) return '';
        const parsed = parseKbpsValue(raw);
        const withinRange = Number.isFinite(parsed)
            && parsed >= constraints.min
            && parsed <= constraints.max;
        const finalValue = withinRange ? parsed : constraints.fallback;
        return Number.isFinite(finalValue) ? `${finalValue}kbps` : '';
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

        const modal = overlay.querySelector('.preset-modal');
        const modalTitle = document.getElementById('preset-modal-title');
        const titleInput = document.getElementById('preset-title');
        const summaryInput = document.getElementById('preset-summary');
        const formatInput = document.getElementById('preset-format');
        const suggestionBox = document.getElementById('preset-format-suggestions');
        const advancedPanel = document.getElementById('preset-advanced');
        const pathInput = document.getElementById('preset-path');
        const browseBtn = document.getElementById('preset-path-browse');
        const iconDrop = document.getElementById('preset-icon-drop');
        const iconDropTarget = document.getElementById('preset-icon-preview');
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
        const mediaSection = document.querySelector('.preset-media-section');
        const videoQuality = document.getElementById('preset-video-quality');
        const videoCodec = document.getElementById('preset-video-codec');
        const videoBitrate = document.getElementById('preset-video-bitrate');
        const videoFps = document.getElementById('preset-video-fps');
        const audioSample = document.getElementById('preset-audio-sample');
        const audioCodec = document.getElementById('preset-audio-codec');
        const audioBitrate = document.getElementById('preset-audio-bitrate');
        const typeButtons = Array.from(document.querySelectorAll('.preset-choice'));
        const formatSection = document.querySelector('.preset-format-section');
        const compressorSection = document.getElementById('preset-compressor-section');
        const compressorToggle = document.getElementById('preset-compressor-toggle');
        const compressorButtons = compressorToggle ? Array.from(compressorToggle.querySelectorAll('.preset-compressor-option')) : [];
        const compressorPanelsWrap = document.querySelector('.preset-compressor-panels');
        const compressorPanels = Array.from(document.querySelectorAll('.preset-compressor-panel'));
        const compressorPercentRange = document.getElementById('preset-compress-percent-range');
        const compressorPercentInput = document.getElementById('preset-compress-percent-input');
        const compressorPercentFill = document.getElementById('preset-compress-percent-fill');
        const compressorSizeInput = document.getElementById('preset-compress-size-input');
        const compressorCrfSelect = document.getElementById('preset-compress-crf-select');
        const toggleGrid = document.getElementById('preset-toggle-grid');

        if (!titleInput || !formatInput || !suggestionBox || !saveBtn || !exportBtn) return;

        const normalizePercentValue = (raw) => {
            const parsed = parseInt(String(raw || '').trim(), 10);
            if (!Number.isFinite(parsed)) return null;
            return Math.min(100, Math.max(1, parsed));
        };

        const updateCompressorPercentFill = () => {
            if (!compressorPercentRange || !compressorPercentFill) return;
            const min = Number(compressorPercentRange.min || 1);
            const max = Number(compressorPercentRange.max || 100);
            const value = Number(compressorPercentRange.value || 0);
            const ratio = max > min ? (value - min) / (max - min) : 0;
            compressorPercentFill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
        };

        const commitPercentValue = (raw) => {
            const fallback = 60;
            const clamped = normalizePercentValue(raw);
            const value = Number.isFinite(clamped) ? clamped : fallback;
            if (compressorPercentInput) compressorPercentInput.value = String(value);
            if (compressorPercentRange) compressorPercentRange.value = String(value);
            updateCompressorPercentFill();
            return value;
        };

        const parseSizeInput = (value) => {
            const raw = String(value || '').trim().toLowerCase();
            if (!raw) return null;
            const match = raw.match(/^(\d+(?:[.,]\d+)?)\s*([a-z]*)$/i);
            if (!match) return null;
            const amount = parseFloat(match[1].replace(',', '.'));
            if (!Number.isFinite(amount)) return null;
            if (!match[2]) return null;
            let unit = match[2].toLowerCase();
            if (unit === 'bytes') unit = 'b';
            if (unit === 'k') unit = 'kb';
            if (unit === 'm') unit = 'mb';
            if (unit === 'g') unit = 'gb';
            if (unit === 't') unit = 'tb';
            const multipliers = {
                b: 1,
                kb: 1024,
                kib: 1024,
                mb: 1024 ** 2,
                mib: 1024 ** 2,
                gb: 1024 ** 3,
                gib: 1024 ** 3,
                tb: 1024 ** 4,
                tib: 1024 ** 4
            };
            const mult = multipliers[unit];
            if (!mult) return null;
            return amount * mult;
        };

        const animateModalResize = (prevRect) => {
            if (!modal || !prevRect) return;
            const nextRect = modal.getBoundingClientRect();
            const delta = Math.abs(nextRect.height - prevRect.height);
            if (!nextRect.height || delta < 2) {
                modal.style.height = '';
                modal.style.transition = '';
                modal.style.overflow = '';
                return;
            }
            modal.style.height = `${prevRect.height}px`;
            modal.style.overflow = 'hidden';
            modal.offsetHeight;
            modal.style.transition = 'height 0.35s cubic-bezier(0.22, 1, 0.36, 1)';
            modal.style.height = `${nextRect.height}px`;
            const cleanup = () => {
                modal.style.height = '';
                modal.style.transition = '';
                modal.style.overflow = '';
            };
            modal.addEventListener('transitionend', cleanup, { once: true });
        };

        const runSectionTransition = (elements, applyChange, options = {}) => {
            const targets = (Array.isArray(elements) ? elements : [elements]).filter(Boolean);
            const animate = options.animate !== false;
            const afterChange = typeof options.afterChange === 'function' ? options.afterChange : null;
            if (!animate || !targets.length) {
                applyChange();
                if (afterChange) afterChange();
                return;
            }
            targets.forEach((el) => el.classList.add('fading-out'));
            window.setTimeout(() => {
                applyChange();
                requestAnimationFrame(() => {
                    targets.forEach((el) => el.classList.remove('fading-out'));
                    if (afterChange) afterChange();
                });
            }, 180);
        };

        const setCompressionMode = (mode, options = {}) => {
            const next = mode === 'size' || mode === 'quality' ? mode : 'percent';
            if (next === state.compressorMode && !options.force) return;
            const prevRect = modal ? modal.getBoundingClientRect() : null;
            state.compressorMode = next;
            compressorButtons.forEach((btn) => {
                const btnMode = btn.getAttribute('data-mode');
                const active = btnMode === state.compressorMode;
                btn.classList.toggle('active', active);
                btn.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
            const applyPanels = () => {
                compressorPanels.forEach((panel) => {
                    const panelMode = panel.getAttribute('data-mode');
                    panel.classList.toggle('hidden', panelMode !== state.compressorMode);
                });
            };
            if (options.animate !== false && compressorPanelsWrap) {
                compressorPanelsWrap.classList.add('fading-out');
                window.setTimeout(() => {
                    applyPanels();
                    requestAnimationFrame(() => {
                        compressorPanelsWrap.classList.remove('fading-out');
                        animateModalResize(prevRect);
                    });
                }, 180);
            } else {
                applyPanels();
                if (options.animate !== false) {
                    animateModalResize(prevRect);
                }
            }
        };

        const buildCrfOptions = () => {
            if (!compressorCrfSelect) return;
            const labeled = {
                0: { key: 'compressor.crf.bestQuality', fallback: '0 - Best quality' },
                26: { key: 'compressor.crf.balance', fallback: '26 - Balance' },
                51: { key: 'compressor.crf.bestCompression', fallback: '51 - Best compression' }
            };
            const options = [];
            for (let i = 0; i <= 51; i += 1) {
                const labelInfo = labeled[i];
                if (labelInfo) {
                    options.push({
                        value: String(i),
                        label: t(labelInfo.key, labelInfo.fallback),
                        i18n: labelInfo.key
                    });
                } else {
                    options.push({ value: String(i), label: String(i) });
                }
            }
            rebuildSelect(compressorCrfSelect, options);
            compressorCrfSelect.value = '26';
        };

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
            if (state.presetType !== 'downloader') {
                embedSubsRow?.classList.remove('visible');
                subsCodeRow?.classList.remove('visible');
                return;
            }
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
            const map = state.presetType === 'converter' ? state.formatMap.converter : state.formatMap.downloader;
            const meta = map.get(formatValue);
            const isGif = formatValue === 'gif';
            let type = String(meta?.type || '').toLowerCase();
            if (!type) {
                type = state.presetType === 'downloader' ? (isGif ? 'video' : 'video') : 'video';
            }
            return { formatValue, meta, isGif, type };
        };

        const updateFormatUI = () => {
            if (state.presetType === 'compressor') return;
            const { formatValue, meta, isGif, type } = resolveFormatMeta(formatInput.value);
            const map = state.presetType === 'converter' ? state.formatMap.converter : state.formatMap.downloader;
            const hasFormat = map.has(formatValue) || (state.presetType === 'downloader' && isGif);
            advancedPanel?.classList.toggle('expanded', hasFormat);

            let showVideo = false;
            let showAudio = false;
            if (state.presetType === 'downloader') {
                showVideo = type !== 'audio';
                showAudio = type === 'audio' || (!isGif && !muteAudio?.checked);
            } else {
                showVideo = type === 'video';
                showAudio = type === 'audio' || type === 'video';
            }

            if (showVideo) {
                videoSection?.classList.remove('hidden');
                videoSection?.classList.remove('collapsed');
            } else {
                videoSection?.classList.add('hidden');
                videoSection?.classList.add('collapsed');
            }
            if (showAudio) {
                audioSection?.classList.remove('hidden');
                audioSection?.classList.remove('collapsed');
            } else {
                audioSection?.classList.remove('hidden');
                audioSection?.classList.add('collapsed');
            }
            const audioMuted = state.presetType === 'downloader' && !!muteAudio?.checked && type === 'video' && !isGif;
            mediaSection?.classList.toggle('audio-muted', audioMuted);
            mediaSection?.classList.toggle('audio-only', showAudio && !showVideo);

            if (muteRow) {
                if (state.presetType !== 'downloader') {
                    muteRow.classList.add('hidden');
                } else if (type === 'audio' || isGif) {
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
            if (state.presetType === 'compressor') {
                suggestionBox.classList.remove('visible');
                return;
            }

            const formatData = state.presetType === 'converter'
                ? state.formatData.converter
                : state.formatData.downloader;
            const formatMap = state.presetType === 'converter'
                ? state.formatMap.converter
                : state.formatMap.downloader;

            let matches = formatData.filter((item) => {
                const id = String(item.id || '').toLowerCase();
                return id.includes(term);
            });
            if (formatMap.has(term)) {
                matches = matches.filter((item) => String(item.id || '').toLowerCase() === term);
            }

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

        const setPresetType = (type, options = {}) => {
            const next = type === 'converter' || type === 'compressor' ? type : 'downloader';
            if (state.presetType === next && !options.force) return;
            const prevRect = modal ? modal.getBoundingClientRect() : null;
            state.presetType = next;
            typeButtons.forEach((btn) => {
                const btnType = btn.getAttribute('data-preset-type');
                btn.classList.toggle('active', btnType === state.presetType);
            });
            const isCompressor = state.presetType === 'compressor';
            const applyType = () => {
                formatSection?.classList.toggle('hidden', isCompressor);
                advancedPanel?.classList.toggle('hidden', isCompressor);
                compressorSection?.classList.toggle('hidden', !isCompressor);
                toggleGrid?.classList.toggle('hidden', state.presetType !== 'downloader');
                if (isCompressor && advancedPanel) {
                    advancedPanel.classList.remove('expanded');
                }
                if (isCompressor) {
                    suggestionBox.classList.remove('visible');
                    setCompressionMode(state.compressorMode, { force: true, animate: false });
                }
                updateFormatUI();
                updateSubtitlesExtras();
                validate();
            };
            const afterChange = options.animate === false ? null : () => animateModalResize(prevRect);
            runSectionTransition(
                [formatSection, compressorSection, advancedPanel],
                applyType,
                {
                    animate: options.animate,
                    afterChange
                }
            );
        };

        const validate = () => {
            const titleOk = String(titleInput.value || '').trim().length > 0;
            let detailsOk = false;
            if (state.presetType === 'compressor') {
                if (state.compressorMode === 'size') {
                    detailsOk = Number.isFinite(parseSizeInput(compressorSizeInput?.value || ''));
                } else if (state.compressorMode === 'quality') {
                    detailsOk = Number.isFinite(parseInt(String(compressorCrfSelect?.value || ''), 10));
                } else {
                    detailsOk = Number.isFinite(normalizePercentValue(compressorPercentInput?.value ?? compressorPercentRange?.value));
                }
            } else {
                detailsOk = String(formatInput.value || '').trim().length > 0;
            }
            saveBtn.disabled = !(titleOk && detailsOk);
            exportBtn.disabled = !(titleOk && detailsOk);
        };

        const resetForm = () => {
            state.presetId = null;
            state.hidden = false;
            state.presetType = 'downloader';
            state.compressorMode = 'percent';
            if (modalTitle) modalTitle.textContent = t('presetCreator.title.new', 'Create Preset');
            titleInput.value = '';
            summaryInput.value = '';
            formatInput.value = '';
            suggestionBox.innerHTML = '';
            suggestionBox.classList.remove('visible');
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
            if (compressorPercentInput) compressorPercentInput.value = '60';
            if (compressorPercentRange) compressorPercentRange.value = '60';
            if (compressorPercentFill) updateCompressorPercentFill();
            if (compressorSizeInput) compressorSizeInput.value = '';
            if (compressorCrfSelect && !compressorCrfSelect.options.length) {
                buildCrfOptions();
            }
            if (compressorCrfSelect) compressorCrfSelect.value = '26';
            setCompressionMode('percent', { force: true, animate: false });
            resetIcon();
            updateSubtitlesExtras();
            if (advancedPanel) {
                advancedPanel.classList.add('no-anim');
            }
            setPresetType('downloader', { force: true, animate: false });
            if (advancedPanel) {
                void advancedPanel.offsetHeight;
                advancedPanel.classList.remove('no-anim');
            }
            validate();
        };

        const applyPreset = (preset) => {
            const presetType = String(preset?.preset_type || 'downloader').toLowerCase();
            setPresetType(presetType, { force: true, animate: false });
            state.presetId = preset?.id || null;
            state.hidden = !!preset?.hidden;
            if (modalTitle) modalTitle.textContent = t('presetCreator.title.edit', 'Edit Preset');
            titleInput.value = preset?.title || '';
            summaryInput.value = preset?.summary || '';
            if (presetType === 'compressor') {
                if (compressorCrfSelect && !compressorCrfSelect.options.length) {
                    buildCrfOptions();
                }
                const comp = preset?.compressor || {};
                setCompressionMode(comp.mode || 'percent', { force: true, animate: false });
                if (state.compressorMode === 'percent') {
                    commitPercentValue(comp.target_percent ?? compressorPercentInput?.value ?? 60);
                } else if (state.compressorMode === 'size') {
                    if (compressorSizeInput) {
                        compressorSizeInput.value = comp.target_size || '';
                    }
                } else if (compressorCrfSelect) {
                    compressorCrfSelect.value = String(Number.isFinite(comp.crf) ? comp.crf : 26);
                }
            } else {
                const source = presetType === 'converter' ? preset?.converter : preset?.downloader;
                formatInput.value = source?.format || '';
                pathInput.value = source?.path || '';

                downloadSubs.checked = presetType === 'downloader' ? !!source?.download_subtitles : false;
                embedSubs.checked = presetType === 'downloader' ? !!source?.embed_subtitles : false;
                subsCode.value = presetType === 'downloader' ? (source?.subtitles_code || '') : '';
                embedMeta.checked = presetType === 'downloader' ? !!source?.embed_metadata : false;
                embedThumb.checked = presetType === 'downloader' ? !!source?.embed_thumbnail : false;
                geoBypass.checked = presetType === 'downloader' ? !!source?.geo_bypass : false;
                muteAudio.checked = presetType === 'downloader' ? !!source?.mute_audio : false;

                videoQuality.value = source?.video_quality || '';
                videoFps.value = source?.video_fps || '';
                videoBitrate.value = source?.video_bitrate
                    ? clampBitrate(source.video_bitrate, bitrateConstraints.video, true)
                    : '';
                audioSample.value = source?.audio_sample_rate || '';
                audioBitrate.value = source?.audio_bitrate
                    ? clampBitrate(source.audio_bitrate, bitrateConstraints.audio, true)
                    : '';

                updateSubtitlesExtras();
                updateFormatUI();

                if (source?.video_codec) videoCodec.value = source.video_codec;
                if (source?.audio_codec) audioCodec.value = source.audio_codec;
            }

            state.iconDataUrl = preset?.icon_data_url || DEFAULT_ICON_DATA_URL;
            setIconPreview(state.iconDataUrl);
            if (window.initCustomSelects) window.initCustomSelects();
            validate();
        };

        const openModal = () => {
            overlay.classList.add('visible');
            overlay.setAttribute('aria-hidden', 'false');
            document.body.classList.add('preset-modal-open');
        };

        const closeModal = () => {
            overlay.classList.remove('visible');
            overlay.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('preset-modal-open');
        };

        const savePreset = async ({ closeOnSuccess = true } = {}) => {
            if (!window.__TAURI__?.core?.invoke) return null;
            const payload = {
                id: state.presetId,
                title: String(titleInput.value || '').trim(),
                summary: String(summaryInput.value || '').trim(),
                preset_type: state.presetType,
                hidden: state.hidden,
                icon_data_url: state.iconDataUrl
            };

            if (state.presetType === 'compressor') {
                const mode = state.compressorMode;
                const targetPercent = mode === 'percent'
                    ? commitPercentValue(compressorPercentInput?.value ?? compressorPercentRange?.value)
                    : null;
                const parsedSize = mode === 'size' ? parseSizeInput(compressorSizeInput?.value || '') : null;
                const targetSize = mode === 'size' && Number.isFinite(parsedSize)
                    ? String(compressorSizeInput?.value || '').trim()
                    : null;
                const crfValue = mode === 'quality'
                    ? parseInt(String(compressorCrfSelect?.value || ''), 10)
                    : null;

                payload.compressor = {
                    mode,
                    target_percent: mode === 'percent' && Number.isFinite(targetPercent) ? targetPercent : null,
                    target_size: targetSize,
                    crf: mode === 'quality' && Number.isFinite(crfValue) ? crfValue : null
                };
            } else {
                const { formatValue, type, isGif } = resolveFormatMeta(formatInput.value);
                const isDownloader = state.presetType === 'downloader';
                const showVideo = isDownloader ? type !== 'audio' : type === 'video';
                const showAudio = isDownloader
                    ? type === 'audio' || (!isGif && !muteAudio?.checked)
                    : type === 'audio' || type === 'video';

                const videoBitrateValue = showVideo
                    ? clampBitrate(videoBitrate?.value, bitrateConstraints.video, true)
                    : '';
                const audioBitrateValue = showAudio
                    ? clampBitrate(audioBitrate?.value, bitrateConstraints.audio, true)
                    : '';

                if (videoBitrate && showVideo) {
                    videoBitrate.value = videoBitrateValue;
                }
                if (audioBitrate && showAudio) {
                    audioBitrate.value = audioBitrateValue;
                }

                if (isDownloader) {
                    payload.downloader = {
                        mode: type === 'audio' ? 'audio' : 'video',
                        format: formatValue,
                        path: String(pathInput.value || '').trim() || null,
                        video_quality: showVideo ? (videoQuality.value || null) : null,
                        audio_quality: null,
                        download_subtitles: !!downloadSubs.checked,
                        embed_subtitles: !!embedSubs.checked,
                        subtitles_code: downloadSubs.checked ? (String(subsCode.value || '').trim() || null) : null,
                        embed_metadata: !!embedMeta.checked,
                        embed_thumbnail: !!embedThumb.checked,
                        geo_bypass: !!geoBypass.checked,
                        mute_audio: isGif ? true : !!muteAudio.checked,
                        video_codec: showVideo ? (videoCodec.value || null) : null,
                        audio_codec: showAudio ? (audioCodec.value || null) : null,
                        video_bitrate: videoBitrateValue || null,
                        audio_bitrate: audioBitrateValue || null,
                        video_fps: showVideo ? (videoFps.value || null) : null,
                        audio_sample_rate: showAudio ? (audioSample.value || null) : null
                    };
                } else {
                    payload.converter = {
                        format: formatValue,
                        path: String(pathInput.value || '').trim() || null,
                        video_quality: showVideo ? (videoQuality.value || null) : null,
                        video_codec: showVideo ? (videoCodec.value || null) : null,
                        video_bitrate: videoBitrateValue || null,
                        video_fps: showVideo ? (videoFps.value || null) : null,
                        audio_codec: showAudio ? (audioCodec.value || null) : null,
                        audio_bitrate: audioBitrateValue || null,
                        audio_sample_rate: showAudio ? (audioSample.value || null) : null
                    };
                }
            }

            let valid = !!payload.title;
            if (state.presetType === 'compressor') {
                const comp = payload.compressor || {};
                if (comp.mode === 'size') {
                    valid = valid && !!comp.target_size;
                } else if (comp.mode === 'quality') {
                    valid = valid && Number.isFinite(comp.crf);
                } else {
                    valid = valid && Number.isFinite(comp.target_percent);
                }
            } else if (state.presetType === 'downloader') {
                valid = valid && !!payload.downloader?.format;
            } else {
                valid = valid && !!payload.converter?.format;
            }

            if (!valid) {
                showNotification(t('presetCreator.notifications.validation', 'Title and format are required.'), 'error');
                return null;
            }

            try {
                const id = await window.__TAURI__.core.invoke('save_preset', { preset: payload });
                state.presetId = id;
                if (window.presetManager?.refresh) window.presetManager.refresh();
                emitPresetsUpdated();
                showNotification(t('presetCreator.notifications.saved', 'Preset saved.'), 'success');
                if (closeOnSuccess) closeModal();
                return id;
            } catch (error) {
                console.error('Failed to save preset:', error);
                showNotification(t('presetCreator.notifications.saveFailed', 'Failed to save preset.'), 'error');
                return null;
            }
        };

        const exportPreset = async () => {
            const id = await savePreset({ closeOnSuccess: false });
            if (!id || !window.__TAURI__?.core?.invoke) return;
            try {
                await window.__TAURI__.core.invoke('export_preset', { id });
                closeModal();
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

        const extractDroppedFile = (dataTransfer) => {
            if (!dataTransfer) return null;
            if (dataTransfer.items && dataTransfer.items.length) {
                for (const item of dataTransfer.items) {
                    if (item.kind === 'file') {
                        const file = item.getAsFile();
                        if (file) return file;
                    }
                }
            }
            if (dataTransfer.files && dataTransfer.files.length) {
                return dataTransfer.files[0] || null;
            }
            return null;
        };

        const setDropHover = (enabled) => {
            if (iconDropTarget) iconDropTarget.classList.toggle('dragover', !!enabled);
            if (iconDrop) iconDrop.classList.toggle('dragover', !!enabled);
        };

        let lastMousePoint = null;

        const getPoint = (payload) => {
            if (!payload) return null;
            if (payload.position) return payload.position;
            if (typeof payload.x === 'number' && typeof payload.y === 'number') return payload;
            return null;
        };

        const normalizeDragKind = (value) => {
            if (!value) return null;
            const raw = String(value);
            if (raw === 'tauri://drag-enter') return 'enter';
            if (raw === 'tauri://drag-over') return 'over';
            if (raw === 'tauri://drag-leave') return 'leave';
            if (raw === 'tauri://drag-drop') return 'drop';
            return raw;
        };

        const normalizeDroppedPath = (path) => {
            if (typeof path !== 'string') return null;
            if (path.startsWith('file://')) {
                try {
                    return decodeURIComponent(path.replace('file://', ''));
                } catch (error) {
                    return path.replace('file://', '');
                }
            }
            return path;
        };

        const isPointInsideTarget = (point) => {
            const dropZone = iconDrop || iconDropTarget;
            if (!point || !dropZone) return false;
            const rect = dropZone.getBoundingClientRect();
            const rawX = point.x ?? point.clientX;
            const rawY = point.y ?? point.clientY;
            if (typeof rawX !== 'number' || typeof rawY !== 'number') return false;
            const dpr = window.devicePixelRatio || 1;
            const screenX = window.screenX ?? window.screenLeft ?? 0;
            const screenY = window.screenY ?? window.screenTop ?? 0;
            const chromeY = Math.max(0, (window.outerHeight || 0) - (window.innerHeight || 0));
            const candidates = [
                { x: rawX, y: rawY },
                { x: rawX / dpr, y: rawY / dpr },
                { x: rawX - screenX, y: rawY - screenY },
                { x: rawX / dpr - screenX, y: rawY / dpr - screenY },
                { x: rawX - screenX, y: rawY - screenY - chromeY },
                { x: rawX / dpr - screenX, y: rawY / dpr - screenY - chromeY }
            ];

            const inRect = candidates.some((p) => p.x >= rect.left && p.x <= rect.right && p.y >= rect.top && p.y <= rect.bottom);
            if (inRect) return true;

            const isElementInDropZone = (el) => {
                if (!el) return false;
                return dropZone.contains(el) || el.closest?.('#preset-icon-drop') === dropZone;
            };

            for (const p of candidates) {
                if (p.x < 0 || p.y < 0 || p.x > window.innerWidth || p.y > window.innerHeight) continue;
                const el = document.elementFromPoint(p.x, p.y);
                if (isElementInDropZone(el)) return true;
            }
            return false;
        };

        const guessMimeFromPath = (path) => {
            const lower = String(path || '').toLowerCase();
            if (lower.endsWith('.png')) return 'image/png';
            if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
            if (lower.endsWith('.webp')) return 'image/webp';
            if (lower.endsWith('.gif')) return 'image/gif';
            if (lower.endsWith('.svg')) return 'image/svg+xml';
            return 'application/octet-stream';
        };

        const readPathAsDataUrl = async (path) => {
            if (window.__TAURI__?.fs?.readBinaryFile) {
                try {
                    const data = await window.__TAURI__.fs.readBinaryFile(path);
                    const mime = guessMimeFromPath(path);
                    const blob = new Blob([data], { type: mime });
                    return await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(String(reader.result || ''));
                        reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
                        reader.readAsDataURL(blob);
                    });
                } catch (error) {
                    console.error('Failed to read dropped file:', error);
                }
            }
            if (window.__TAURI__?.core?.invoke) {
                try {
                    const dataUrl = await window.__TAURI__.core.invoke('read_file_base64', { path });
                    if (typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
                        return dataUrl;
                    }
                } catch (error) {
                    console.error('Failed to read dropped file via backend:', error);
                }
            }
            return null;
        };

        const isDragInsidePreview = (event) => {
            const dropZone = iconDrop || iconDropTarget;
            if (!event || !dropZone) return false;
            const rect = dropZone.getBoundingClientRect();
            const x = event.clientX ?? 0;
            const y = event.clientY ?? 0;
            return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
        };

        iconDrop?.addEventListener('dragenter', (event) => {
            event.preventDefault();
            setDropHover(isDragInsidePreview(event));
        });
        iconDrop?.addEventListener('dragover', (event) => {
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
            setDropHover(isDragInsidePreview(event));
        });
        iconDrop?.addEventListener('dragleave', () => setDropHover(false));
        iconDrop?.addEventListener('drop', (event) => {
            event.preventDefault();
            const inside = isDragInsidePreview(event);
            setDropHover(false);
            if (!inside) return;
            const file = extractDroppedFile(event.dataTransfer);
            handleIconFile(file);
        });

        iconDropTarget?.addEventListener('dragenter', (event) => {
            event.preventDefault();
            setDropHover(true);
        });
        iconDropTarget?.addEventListener('dragover', (event) => {
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
            setDropHover(true);
        });
        iconDropTarget?.addEventListener('dragleave', () => setDropHover(false));
        iconDropTarget?.addEventListener('drop', (event) => {
            event.preventDefault();
            setDropHover(false);
            const file = extractDroppedFile(event.dataTransfer);
            handleIconFile(file);
        });
        iconDropTarget?.addEventListener('click', (event) => {
            if (event.target.closest('#preset-icon-browse')) return;
            if (event.target.closest('#preset-icon-file')) return;
            iconFile?.click();
        });
        iconFile?.addEventListener('change', () => handleIconFile(iconFile.files?.[0]));
        iconBrowseBtn?.addEventListener('click', () => iconFile?.click());

        document.addEventListener('mousemove', (event) => {
            if (!overlay.classList.contains('visible')) return;
            lastMousePoint = { x: event.clientX, y: event.clientY };
        });
        document.addEventListener('dragover', (event) => {
            if (!overlay.classList.contains('visible')) return;
            event.preventDefault();
        });
        document.addEventListener('drop', (event) => {
            if (!overlay.classList.contains('visible')) return;
            event.preventDefault();
        });

        if (window.__TAURI__?.event?.listen) {
            let lastHoverPoint = null;
            const attachLegacyListeners = () => {
                window.__TAURI__.event.listen('tauri://file-drop-hover', (event) => {
                if (!overlay.classList.contains('visible')) return;
                const point = getPoint(event.payload);
                lastHoverPoint = point;
                setDropHover(isPointInsideTarget(point));
            });
                window.__TAURI__.event.listen('tauri://file-drop-cancelled', (event) => {
                lastHoverPoint = null;
                setDropHover(false);
            });
                window.__TAURI__.event.listen('tauri://file-drop', async (event) => {
                if (!overlay.classList.contains('visible')) return;
                const paths = event.payload?.paths || event.payload;
                const point = lastHoverPoint || lastMousePoint;
                const allowed = isPointInsideTarget(point) || iconDropTarget?.classList.contains('dragover');
                setDropHover(false);
                lastHoverPoint = null;
                lastMousePoint = null;
                if (!allowed) return;
                const rawPath = Array.isArray(paths) ? paths[0] : (typeof paths === 'string' ? paths : null);
                const path = normalizeDroppedPath(rawPath);
                if (!path) return;
                const mime = guessMimeFromPath(path);
                if (!mime.startsWith('image/')) {
                    showNotification(t('presetCreator.notifications.invalidIcon', 'Invalid icon file.'), 'error');
                    return;
                }
                const dataUrl = await readPathAsDataUrl(path);
                if (!dataUrl) return;
                state.iconDataUrl = dataUrl;
                setIconPreview(dataUrl);
            });
            };

            const win = window.__TAURI__?.window?.getCurrentWindow?.();
            if (win?.onDragDropEvent) {
                win.onDragDropEvent(async (event) => {
                    if (!overlay.classList.contains('visible')) return;
                    const payload = event?.payload || {};
                    const kind = normalizeDragKind(event?.type ?? payload?.type ?? event?.event);
                    const point = getPoint(payload) || lastMousePoint;
                    if (kind === 'enter' || kind === 'over') {
                        setDropHover(isPointInsideTarget(point));
                        return;
                    }
                    if (kind === 'leave') {
                        setDropHover(false);
                        return;
                    }
                    if (kind !== 'drop') return;
                    const paths = payload.paths || payload.path || payload.files || event?.payload;
                    const allowed = isPointInsideTarget(point) || iconDropTarget?.classList.contains('dragover');
                    setDropHover(false);
                    if (!allowed) return;
                    const rawPath = Array.isArray(paths) ? paths[0] : (typeof paths === 'string' ? paths : null);
                    const path = normalizeDroppedPath(rawPath);
                    if (!path) return;
                    const mime = guessMimeFromPath(path);
                    if (!mime.startsWith('image/')) {
                        showNotification(t('presetCreator.notifications.invalidIcon', 'Invalid icon file.'), 'error');
                        return;
                    }
                    const dataUrl = await readPathAsDataUrl(path);
                    if (!dataUrl) return;
                    state.iconDataUrl = dataUrl;
                    setIconPreview(dataUrl);
                });
            } else {
                attachLegacyListeners();
            }
        }

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

        typeButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const type = btn.getAttribute('data-preset-type') || 'downloader';
                setPresetType(type, { animate: true });
            });
        });

        compressorButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const mode = btn.getAttribute('data-mode') || 'percent';
                setCompressionMode(mode, { animate: true });
                validate();
            });
        });

        if (compressorPercentRange) {
            compressorPercentRange.addEventListener('input', () => {
                if (compressorPercentInput) {
                    compressorPercentInput.value = compressorPercentRange.value;
                }
                updateCompressorPercentFill();
                validate();
            });
        }
        if (compressorPercentInput) {
            compressorPercentInput.addEventListener('input', () => {
                const value = normalizePercentValue(compressorPercentInput.value);
                if (Number.isFinite(value) && compressorPercentRange) {
                    compressorPercentRange.value = String(value);
                }
                updateCompressorPercentFill();
                validate();
            });
            compressorPercentInput.addEventListener('blur', () => {
                commitPercentValue(compressorPercentInput.value);
                validate();
            });
        }
        if (compressorSizeInput) {
            compressorSizeInput.addEventListener('input', () => {
                validate();
            });
        }
        if (compressorCrfSelect) {
            compressorCrfSelect.addEventListener('change', () => {
                validate();
            });
        }

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

        if (videoBitrate) {
            videoBitrate.addEventListener('blur', () => {
                videoBitrate.value = clampBitrate(videoBitrate.value, bitrateConstraints.video, true);
            });
        }
        if (audioBitrate) {
            audioBitrate.addEventListener('blur', () => {
                audioBitrate.value = clampBitrate(audioBitrate.value, bitrateConstraints.audio, true);
            });
        }

        downloadSubs?.addEventListener('change', () => {
            updateSubtitlesExtras();
        });
        muteAudio?.addEventListener('change', () => updateFormatUI());

        [titleInput, summaryInput, formatInput].forEach((el) => {
            el?.addEventListener('input', validate);
        });

        saveBtn.addEventListener('click', async () => {
            await savePreset({ closeOnSuccess: true });
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
        document.body.classList.add('preset-modal-open');
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