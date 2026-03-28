(() => {
    const tauriCore = window.__TAURI__ && window.__TAURI__.core;
    const tauriEvent = window.__TAURI__ && window.__TAURI__.event;
    const invoke = tauriCore && tauriCore.invoke ? tauriCore.invoke : null;
    const listen = tauriEvent && tauriEvent.listen ? tauriEvent.listen : null;
    const root = document.querySelector('.converter-page');
    if (!root) return;

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

    const CATEGORY_ICONS = {
        video: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><path d="M7 2v20M17 2v20M2 12h20"/></svg>`,
        audio: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
        image: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M15.2 4H8.8c-1.69 0-2.52 0-3.16.33a3.07 3.07 0 0 0-1.31 1.31C4 6.28 4 7.12 4 8.8v6.4c0 1.68 0 2.52.33 3.16a3.07 3.07 0 0 0 1.31 1.31c.64.33 1.48.33 3.16.33h6.4c1.68 0 2.52 0 3.16-.33a3.07 3.07 0 0 0 1.31-1.31c.33-.64.33-1.48.33-3.16V8.8"/><path d="m4 16 4.29-4.29a.996.996 0 0 1 1.41 0L12.99 15m.01 0 2.79-2.79a.996.996 0 0 1 1.41 0L19.99 15M13 15l2.25 2.25M20 8.8c0-1.68 0-2.52-.33-3.16a3.07 3.07 0 0 0-1.31-1.31C17.72 4 16.88 4 15.2 4"/></svg>`,
        archive: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="m21.706 5.292-2.999-2.999A1 1 0 0 0 18 2H6a1 1 0 0 0-.707.293L2.294 5.292A1 1 0 0 0 2 6v13c0 1.103.897 2 2 2h16c1.103 0 2-.897 2-2V6a1 1 0 0 0-.294-.708M6.414 4h11.172l1 1H5.414zM4 19V7h16l.002 12z"/><path d="M14 9h-4v3H7l5 5 5-5h-3z"/></svg>`,
        font: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M3.226 2 .115 14h2.066l.778-3H6.04l.778 3h2.066L5.774 2zm2.296 7L4.5 5.056 3.477 9zM14 7.337a3.5 3.5 0 1 0 0 6.326V14h2V7h-2zM11 10.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0" fill="#000"/></svg>`
    };

    const searchSection = root.querySelector('#convert-search-section');
    const dashboard = root.querySelector('#convert-dashboard');
    const infoCard = root.querySelector('.converter-info-card');
    const optionsPanel = root.querySelector('.converter-options-panel');
    const pathInput = root.querySelector('#convert-path-input');
    const browseBtn = root.querySelector('#convert-browse-btn');
    const confirmBtn = root.querySelector('#convert-confirm-btn');
    const outputNameText = root.querySelector('#convert-output-name-text');
    const outputNameInput = root.querySelector('#convert-output-name-input');
    const renameBtn = root.querySelector('#convert-rename-btn');
    const categoryIcon = root.querySelector('#convert-category-icon');
    const categoryLabel = root.querySelector('#convert-category-label');
    const locationValue = root.querySelector('#convert-file-location');
    const sizeValue = root.querySelector('#convert-file-size');
    const durationValue = root.querySelector('#convert-file-duration');
    const formatGrid = root.querySelector('#convert-format-grid');
    const formatToggle = root.querySelector('#convert-media-toggle');
    const convertActionBtn = root.querySelector('#convert-action-btn');
    const queueActionBtn = root.querySelector('#convert-queue-btn');
    const actionFooter = root.querySelector('.converter-action-footer');
    const toggleOptions = formatToggle ? Array.from(formatToggle.querySelectorAll('.converter-toggle-option')) : [];
    const dropOverlay = root.querySelector('#convert-drop-overlay');
    const detailsPanel = root.querySelector('#convert-details-panel');
    const savePathPanel = root.querySelector('#convert-save-path-panel');
    const savePathInput = root.querySelector('#convert-save-path-input');
    const savePathBrowse = root.querySelector('#convert-save-path-browse');
    const specsPanel = root.querySelector('#convert-specs-panel');
    const outputSpecsSections = Array.from(
        root.querySelectorAll('.converter-specs-column[data-side="output"] .converter-specs-section')
    );
    const outputVideoQuality = root.querySelector('#convert-output-video-quality');
    const outputVideoCodec = root.querySelector('#convert-output-video-codec');
    const outputVideoBitrate = root.querySelector('#convert-output-video-bitrate');
    const outputVideoFps = root.querySelector('#convert-output-video-fps');
    const outputVideoAudioCodec = root.querySelector('#convert-output-video-audio-codec');
    const outputVideoAudioBitrate = root.querySelector('#convert-output-video-audio-bitrate');
    const outputAudioCodec = root.querySelector('#convert-output-audio-codec');
    const outputAudioBitrate = root.querySelector('#convert-output-audio-bitrate');
    const outputImageWidth = root.querySelector('#convert-output-image-width');
    const outputImageHeight = root.querySelector('#convert-output-image-height');
    const outputImageQuality = root.querySelector('#convert-output-image-quality');
    const outputImageQualityRange = root.querySelector('#convert-output-image-quality-range');
    const scrollContainer = root.querySelector('.page-scroll');

    if (dropOverlay && dropOverlay.parentElement !== document.body) {
        document.body.appendChild(dropOverlay);
    }

    let metadataTaskId = null;
    let isLoading = false;
    let currentName = '';
    let isEditingName = false;
    let lastMetadata = null;
    let formatDataLoaded = false;
    let formatDataPromise = null;
    let formatData = [];
    let formatMetaMap = new Map();
    let outputSelectsInitialized = false;
    let selectedFormat = '';
    let currentCategory = '';
    let selectedMode = 'video';
    let dashboardRevealTimer = null;
    let dashboardRevealed = false;
    let lastScrollTop = 0;
    let pendingScrollRestore = false;

    const spinnerSvg = `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="9" stroke-opacity="0.3"></circle>
            <path d="M21 12a9 9 0 0 1-9 9"></path>
        </svg>
    `;

    const arrowSvg = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
    `;

    const setConfirmLoading = (loading) => {
        if (!confirmBtn) return;
        isLoading = loading;
        if (loading) {
            confirmBtn.setAttribute('disabled', 'true');
            confirmBtn.classList.add('loading');
            confirmBtn.innerHTML = spinnerSvg;
            return;
        }
        confirmBtn.removeAttribute('disabled');
        confirmBtn.classList.remove('loading');
        confirmBtn.innerHTML = arrowSvg;
    };

    const parseInteger = (value) => {
        const parsed = parseInt(String(value || '').trim(), 10);
        return Number.isFinite(parsed) ? parsed : null;
    };

    const clampNumber = (value, min, max) => {
        if (!Number.isFinite(value)) return null;
        return Math.min(max, Math.max(min, value));
    };

    const clampInputValue = (input, min, max, options = {}) => {
        if (!input) return;
        const raw = String(input.value || '').trim();
        const allowEmpty = options.allowEmpty !== false;
        const fallback = Number.isFinite(options.fallback) ? options.fallback : min;
        if (!raw) {
            if (!allowEmpty) input.value = String(fallback);
            return;
        }
        const parsed = parseInteger(raw);
        if (!Number.isFinite(parsed)) {
            input.value = allowEmpty ? '' : String(fallback);
            return;
        }
        const clamped = clampNumber(parsed, min, max);
        input.value = Number.isFinite(clamped) ? String(clamped) : String(fallback);
    };

    const normalizeQualityValue = (raw) => {
        const parsed = parseInteger(raw);
        if (!Number.isFinite(parsed)) return null;
        return clampNumber(parsed, 1, 100);
    };

    const commitQualityValue = (raw) => {
        const fallback = 100;
        const clamped = normalizeQualityValue(raw);
        const value = Number.isFinite(clamped) ? clamped : fallback;
        if (outputImageQuality) outputImageQuality.value = String(value);
        if (outputImageQualityRange) outputImageQualityRange.value = String(value);
    };

    const saveScrollPosition = () => {
        if (!scrollContainer) return;
        lastScrollTop = scrollContainer.scrollTop || 0;
    };

    const scheduleScrollRestore = () => {
        if (!scrollContainer) return;
        const target = Number.isFinite(lastScrollTop) ? lastScrollTop : 0;
        requestAnimationFrame(() => {
            scrollContainer.scrollTop = target;
        });
    };

    const formatBytes = (bytes) => {
        const value = Number(bytes);
        if (!Number.isFinite(value)) return '-';
        if (value < 1024) return `${value} B`;
        const units = ['KB', 'MB', 'GB', 'TB'];
        let idx = -1;
        let size = value;
        while (size >= 1024 && idx < units.length - 1) {
            size /= 1024;
            idx += 1;
        }
        return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[idx]}`;
    };

    const formatDuration = (seconds) => {
        const total = Number(seconds);
        if (!Number.isFinite(total)) return '-';
        const safe = Math.max(0, Math.floor(total));
        const hrs = Math.floor(safe / 3600).toString().padStart(2, '0');
        const mins = Math.floor((safe % 3600) / 60).toString().padStart(2, '0');
        const secs = Math.floor(safe % 60).toString().padStart(2, '0');
        return `${hrs}:${mins}:${secs}`;
    };

    const supportedCategories = new Set(['video', 'audio', 'image', 'archive', 'font']);

    const videoQualityOptions = [
        { value: '', label: t('presetCreator.select.auto', 'Auto'), i18n: 'presetCreator.select.auto' },
        { value: 'best', label: 'Best' },
        { value: '2160p', label: '2160p' },
        { value: '1440p', label: '1440p' },
        { value: '1080p', label: '1080p' },
        { value: '720p', label: '720p' },
        { value: '480p', label: '480p' },
        { value: '360p', label: '360p' },
        { value: '240p', label: '240p' },
        { value: '144p', label: '144p' }
    ];

    const bitrateConstraints = {
        video: { min: 500, max: 100000, fallback: 8000 },
        audio: { min: 16, max: 500, fallback: 320 }
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

    const initOutputSelects = () => {
        if (outputSelectsInitialized) return;
        outputSelectsInitialized = true;
        rebuildSelect(outputVideoQuality, videoQualityOptions);
    };

    const loadFormatData = () => {
        if (formatDataLoaded) return Promise.resolve();
        if (formatDataPromise) return formatDataPromise;
        formatDataPromise = fetch('assets/format.json', { cache: 'no-store' })
            .then((response) => (response.ok ? response.json() : null))
            .then((json) => {
                const formats = Array.isArray(json?.cformats) ? json.cformats : [];
                formatData = formats;
                formatMetaMap = new Map(
                    formats.map((item) => [String(item?.id || '').toLowerCase(), item])
                );
            })
            .catch((error) => {
                console.error('Failed to load format.json:', error);
                formatData = [];
                formatMetaMap = new Map();
            })
            .finally(() => {
                formatDataLoaded = true;
                formatDataPromise = null;
            });
        return formatDataPromise;
    };

    const setActionButtonsEnabled = (enabled) => {
        [convertActionBtn, queueActionBtn].forEach((btn) => {
            if (!btn) return;
            if (enabled) {
                btn.removeAttribute('disabled');
                btn.classList.add('ready');
            } else {
                btn.setAttribute('disabled', 'true');
                btn.classList.remove('ready');
            }
        });
    };

    const updateTileSelection = () => {
        if (!formatGrid) return;
        formatGrid.querySelectorAll('.converter-format-tile').forEach((tile) => {
            const value = tile.getAttribute('data-format');
            const active = value === selectedFormat;
            tile.classList.toggle('active', active);
            tile.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
    };

    const updateToggleButtons = () => {
        if (!formatToggle) return;
        toggleOptions.forEach((btn) => {
            const mode = btn.getAttribute('data-mode');
            const active = mode === selectedMode;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        formatToggle.setAttribute('data-mode', selectedMode);
        if (root) root.dataset.convertMode = selectedMode;
    };

    const resolveSpecsCategory = (value) => {
        const normalized = String(value || '').toLowerCase();
        if (normalized === 'video' || normalized === 'audio' || normalized === 'image') {
            return normalized;
        }
        return 'other';
    };

    const setSpecsSectionVisibility = (sections, activeKey) => {
        if (!sections || !sections.length) return;
        sections.forEach((section) => {
            const key = section?.dataset?.section;
            section.classList.toggle('hidden', key !== activeKey);
        });
    };

    const updateSpecsVisibility = () => {
        const targetKey = resolveSpecsCategory(getTargetCategory());
        setSpecsSectionVisibility(outputSpecsSections, targetKey);
    };

    const animateReveal = (element) => {
        if (!element) return;
        element.classList.remove('fade-in');
        void element.offsetWidth;
        element.classList.add('fade-in');
    };

    const showDetailsPanel = (options = {}) => {
        if (!detailsPanel) return;
        const wasHidden = detailsPanel.classList.contains('hidden');
        detailsPanel.classList.remove('hidden');
        if (options.animate !== false && wasHidden) {
            animateReveal(savePathPanel);
            animateReveal(specsPanel);
        }
    };

    const hideDetailsPanel = () => {
        if (!detailsPanel) return;
        detailsPanel.classList.add('hidden');
    };

    const buildCodecOptions = (codecs) => {
        const options = [
            { value: '', label: t('presetCreator.select.auto', 'Auto'), i18n: 'presetCreator.select.auto' }
        ];
        if (Array.isArray(codecs)) {
            codecs.forEach((codec) => {
                const label = String(codec || '').trim();
                if (!label) return;
                options.push({ value: label, label });
            });
        }
        return options;
    };

    const updateOutputControls = () => {
        if (!selectedFormat) return;
        const meta = formatMetaMap.get(String(selectedFormat).toLowerCase());
        rebuildSelect(outputVideoCodec, buildCodecOptions(meta?.video_codecs));
        rebuildSelect(outputVideoAudioCodec, buildCodecOptions(meta?.audio_codecs));
        rebuildSelect(outputAudioCodec, buildCodecOptions(meta?.audio_codecs));
    };

    const updateDetailsPanel = () => {
        if (!detailsPanel) return;
        const wasHidden = detailsPanel.classList.contains('hidden');
        const prevPanelRect = optionsPanel ? optionsPanel.getBoundingClientRect() : null;
        const prevActionRect = actionFooter ? actionFooter.getBoundingClientRect() : null;
        if (!selectedFormat) {
            if (!wasHidden && prevPanelRect) {
                freezePanelHeight(prevPanelRect);
            }
            hideDetailsPanel();
            if (!wasHidden) {
                requestAnimationFrame(() => {
                    animatePanelResize(prevPanelRect, { freeze: false });
                    if (prevActionRect) {
                        animateShift(actionFooter, prevActionRect);
                    }
                });
            }
            return;
        }
        if (wasHidden && prevPanelRect) {
            freezePanelHeight(prevPanelRect);
        }
        showDetailsPanel({ animate: wasHidden });
        updateSpecsVisibility();
        loadFormatData().then(() => {
            updateOutputControls();
        });
        if (wasHidden) {
            requestAnimationFrame(() => {
                animatePanelResize(prevPanelRect, { freeze: false });
                if (prevActionRect) {
                    animateShift(actionFooter, prevActionRect);
                }
            });
        }
    };

    const bindBitrateClamp = (input, constraints) => {
        if (!input) return;
        input.addEventListener('blur', () => {
            input.value = clampBitrate(input.value, constraints, true);
        });
    };

    const bindResolutionClamp = (input) => {
        if (!input) return;
        input.addEventListener('blur', () => {
            clampInputValue(input, 1, 5000, { allowEmpty: true });
        });
    };

    const clearFormatSelection = () => {
        selectedFormat = '';
        updateTileSelection();
        setActionButtonsEnabled(false);
        hideDetailsPanel();
    };

    const animateShift = (element, prevRect) => {
        if (!element || !prevRect) return;
        const nextRect = element.getBoundingClientRect();
        const dx = prevRect.left - nextRect.left;
        const dy = prevRect.top - nextRect.top;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
        element.animate(
            [
                { transform: `translate(${dx}px, ${dy}px)` },
                { transform: 'translate(0, 0)' }
            ],
            { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
        );
    };

    const freezePanelHeight = (prevRect) => {
        if (!optionsPanel || !prevRect) return;
        optionsPanel.style.height = `${prevRect.height}px`;
        optionsPanel.style.overflow = 'hidden';
        optionsPanel.offsetHeight;
    };

    const animatePanelResize = (prevRect, options = {}) => {
        if (!optionsPanel || !prevRect) return;
        if (optionsPanel.classList.contains('hidden')) return;
        const nextRect = optionsPanel.getBoundingClientRect();
        const delta = Math.abs(nextRect.height - prevRect.height);
        if (!nextRect.height || delta < 2) {
            optionsPanel.style.height = '';
            optionsPanel.style.transition = '';
            optionsPanel.style.overflow = '';
            return;
        }
        if (options.freeze !== false) {
            optionsPanel.style.height = `${prevRect.height}px`;
            optionsPanel.style.overflow = 'hidden';
            optionsPanel.offsetHeight;
        } else {
            optionsPanel.style.overflow = 'hidden';
        }
        optionsPanel.style.transition = 'height 0.35s cubic-bezier(0.22, 1, 0.36, 1)';
        optionsPanel.style.height = `${nextRect.height}px`;
        const cleanup = () => {
            optionsPanel.style.height = '';
            optionsPanel.style.transition = '';
            optionsPanel.style.overflow = '';
        };
        optionsPanel.addEventListener('transitionend', cleanup, { once: true });
    };

    const triggerShake = (element) => {
        if (!element) return;
        element.classList.remove('shake-feedback');
        void element.offsetWidth;
        element.classList.add('shake-feedback');
        element.addEventListener('animationend', () => {
            element.classList.remove('shake-feedback');
        }, { once: true });
    };

    const getTargetCategory = () => {
        if (currentCategory === 'video') return selectedMode;
        return currentCategory;
    };

    const renderFormats = () => {
        if (!formatGrid) return;
        formatGrid.classList.remove('fading-out');
        formatGrid.innerHTML = '';
        const targetCategory = getTargetCategory();
        if (!targetCategory) return;
        const formats = formatData.filter((item) => String(item?.type || '').toLowerCase() === targetCategory);
        const normalizedSelection = String(selectedFormat || '').toLowerCase();
        let selectionExists = false;
        formats.forEach((item) => {
            const id = String(item?.id || '').trim();
            if (!id) return;
            if (normalizedSelection && id.toLowerCase() === normalizedSelection) {
                selectionExists = true;
            }
            const tile = document.createElement('button');
            tile.type = 'button';
            tile.className = 'tile converter-format-tile';
            tile.textContent = id.toUpperCase();
            tile.setAttribute('data-format', id);
            tile.setAttribute('aria-pressed', 'false');
            tile.addEventListener('click', () => {
                if (selectedFormat === id) {
                    triggerShake(tile);
                    return;
                }
                selectedFormat = id;
                updateTileSelection();
                setActionButtonsEnabled(true);
                updateDetailsPanel();
            });
            formatGrid.appendChild(tile);
        });
        if (selectedFormat && !selectionExists) {
            clearFormatSelection();
            return;
        }
        updateTileSelection();
        setActionButtonsEnabled(!!selectedFormat);
    };

    const setConvertMode = (mode, options = {}) => {
        const prevActionRect = actionFooter ? actionFooter.getBoundingClientRect() : null;
        const prevPanelRect = optionsPanel ? optionsPanel.getBoundingClientRect() : null;
        const hadDetails = !!selectedFormat && detailsPanel && !detailsPanel.classList.contains('hidden');
        selectedMode = mode === 'audio' ? 'audio' : 'video';
        updateToggleButtons();
        if (!options.preserveSelection) {
            if (hadDetails && prevPanelRect) {
                freezePanelHeight(prevPanelRect);
            }
            clearFormatSelection();
        }
        const finalize = () => {
            renderFormats();
            requestAnimationFrame(() => {
                const shouldShift = prevActionRect
                    && !options.suppressShift
                    && !(hadDetails && prevPanelRect);
                if (shouldShift) {
                    animateShift(actionFooter, prevActionRect);
                }
                if (hadDetails && prevPanelRect) {
                    animatePanelResize(prevPanelRect, { freeze: false });
                }
                if (typeof options.afterRender === 'function') {
                    options.afterRender();
                }
            });
        };
        if (formatGrid && formatGrid.children.length) {
            formatGrid.classList.add('fading-out');
            window.setTimeout(() => {
                finalize();
                requestAnimationFrame(() => {
                    formatGrid.classList.remove('fading-out');
                });
            }, 180);
            return;
        }
        finalize();
    };

    const refreshFormatSection = (category, options = {}) => {
        const normalized = String(category || '').toLowerCase();
        const nextCategory = supportedCategories.has(normalized) ? normalized : '';
        const prevCategory = currentCategory;
        const shouldAnimatePanel = !!prevCategory && !!nextCategory && prevCategory !== nextCategory;
        const shouldPreserveSelection = !!options.preserveSelection
            && prevCategory === nextCategory
            && !!selectedFormat;
        const suppressShift = !!options.suppressShift;
        const prevPanelRect = optionsPanel ? optionsPanel.getBoundingClientRect() : null;
        const prevActionRect = actionFooter ? actionFooter.getBoundingClientRect() : null;
        if (shouldAnimatePanel && prevPanelRect) {
            freezePanelHeight(prevPanelRect);
        }
        currentCategory = nextCategory;

        loadFormatData().then(() => {
            if (!formatGrid) return;
            const isVideo = currentCategory === 'video';
            if (formatToggle) {
                formatToggle.classList.toggle('hidden', !isVideo);
            }
            if (!currentCategory) {
                formatGrid.innerHTML = '';
                clearFormatSelection();
                return;
            }

            if (isVideo) {
                setConvertMode(selectedMode || 'video', {
                    preserveSelection: shouldPreserveSelection,
                    suppressShift: shouldAnimatePanel || suppressShift,
                    afterRender: () => {
                        if (shouldAnimatePanel) {
                            animatePanelResize(prevPanelRect, { freeze: false });
                        }
                    }
                });
            } else {
                selectedMode = currentCategory === 'audio' ? 'audio' : 'video';
                updateToggleButtons();
                if (!shouldPreserveSelection) {
                    clearFormatSelection();
                }
                const finalize = () => {
                    renderFormats();
                    requestAnimationFrame(() => {
                        if (prevActionRect && !shouldAnimatePanel && !suppressShift) {
                            animateShift(actionFooter, prevActionRect);
                        }
                        if (shouldAnimatePanel) {
                            animatePanelResize(prevPanelRect, { freeze: false });
                        }
                    });
                };
                if (formatGrid.children.length) {
                    formatGrid.classList.add('fading-out');
                    window.setTimeout(() => {
                        finalize();
                        requestAnimationFrame(() => {
                            formatGrid.classList.remove('fading-out');
                        });
                    }, 180);
                } else {
                    finalize();
                }
            }
        });
    };

    const extractFolderPath = (rawPath) => {
        if (typeof rawPath !== 'string') return '';
        const trimmed = rawPath.trim();
        if (!trimmed) return '';
        const lastSlash = trimmed.lastIndexOf('/');
        const lastBackslash = trimmed.lastIndexOf('\\');
        const lastSep = Math.max(lastSlash, lastBackslash);
        if (lastSep <= 0) return trimmed;
        return trimmed.slice(0, lastSep);
    };

    const updateDashboard = (data, options = {}) => {
        const applyName = options.applyName !== false;
        const category = String(data.category || '').toLowerCase();
        const extension = String(data.extension || '').trim();
        const categoryLabelText = t(
            `converter.meta.category.${category}`,
            category ? category.toUpperCase() : 'FILE'
        );
        if (categoryLabel) {
            categoryLabel.textContent = extension ? `${categoryLabelText} (${extension})` : categoryLabelText;
        }
        if (categoryIcon) {
            categoryIcon.innerHTML = CATEGORY_ICONS[category] || '';
            const svg = categoryIcon.querySelector('svg');
            if (svg) {
                svg.querySelectorAll('[stroke]').forEach((node) => node.setAttribute('stroke', 'currentColor'));
                svg.querySelectorAll('[fill]').forEach((node) => {
                    const fill = node.getAttribute('fill');
                    if (fill && fill.toLowerCase() !== 'none') {
                        node.setAttribute('fill', 'currentColor');
                    }
                });
            }
        }

        if (locationValue) {
            const folderPath = extractFolderPath(data.path);
            locationValue.textContent = folderPath || '-';
            if (folderPath) {
                locationValue.setAttribute('title', folderPath);
            } else {
                locationValue.removeAttribute('title');
            }
        }

        const nextName = String(data.name || '').trim();
        if (applyName) {
            currentName = nextName;
        } else if (!currentName && nextName) {
            currentName = nextName;
        }
        if (outputNameText) {
            outputNameText.textContent = currentName || t('converter.output.placeholder', 'Output name');
            if (currentName) {
                outputNameText.setAttribute('data-i18n-lock', 'true');
            } else {
                outputNameText.removeAttribute('data-i18n-lock');
            }
        }
        if (outputNameInput) {
            outputNameInput.value = currentName;
        }
        if (infoCard) infoCard.classList.remove('name-editing');
        isEditingName = false;

        if (sizeValue) {
            sizeValue.textContent = formatBytes(data.size_bytes);
        }

        const hasDuration = category === 'video' || category === 'audio';
        if (infoCard) {
            infoCard.classList.toggle('no-duration', !hasDuration);
        }
        if (durationValue) {
            if (hasDuration) {
                durationValue.textContent = data.duration_string || formatDuration(data.duration_seconds);
            } else {
                durationValue.textContent = '-';
            }
        }

        refreshFormatSection(category, {
            preserveSelection: !!options.preserveSelection,
            suppressShift: !!options.suppressShift
        });
    };

    const revealDashboard = () => {
        if (dashboard) {
            dashboard.classList.remove('hidden');
        }
        if (dashboard) {
            const fadeTargets = Array.from(dashboard.querySelectorAll('.fade-in'));
            fadeTargets.forEach((element) => {
                animateReveal(element);
            });
        }
        dashboardRevealed = true;
    };

    const showDashboard = (options = {}) => {
        if (searchSection) {
            searchSection.classList.remove('centered');
            searchSection.classList.add('sticky');
        }
        if (document.body) {
            document.body.classList.add('converter-active');
            setZenMode(false);
        }
        if (dashboardRevealTimer) {
            clearTimeout(dashboardRevealTimer);
            dashboardRevealTimer = null;
        }
        if (dashboard && dashboard.classList.contains('hidden')) {
            const delay = Number.isFinite(options.delay) ? options.delay : 500;
            dashboardRevealTimer = window.setTimeout(() => {
                revealDashboard();
                dashboardRevealTimer = null;
            }, Math.max(0, delay));
        } else if (options.forceReveal) {
            revealDashboard();
        } else if (!dashboardRevealed) {
            revealDashboard();
        }
    };

    const resetView = () => {
        lastMetadata = null;
        if (dashboardRevealTimer) {
            clearTimeout(dashboardRevealTimer);
            dashboardRevealTimer = null;
        }
        dashboardRevealed = false;
        if (dashboard) {
            dashboard.classList.add('hidden');
        }
        if (searchSection) {
            searchSection.classList.add('centered');
            searchSection.classList.remove('sticky');
        }
        if (document.body) {
            document.body.classList.remove('converter-active');
            setZenMode(true);
        }
        if (categoryLabel) categoryLabel.textContent = '';
        if (categoryIcon) categoryIcon.innerHTML = '';
        if (locationValue) {
            locationValue.textContent = '-';
            locationValue.removeAttribute('title');
        }
        if (sizeValue) sizeValue.textContent = '-';
        if (durationValue) durationValue.textContent = '-';
        currentName = '';
        if (outputNameText) {
            outputNameText.textContent = t('converter.output.placeholder', 'Output name');
            outputNameText.removeAttribute('data-i18n-lock');
        }
        if (outputNameInput) outputNameInput.value = '';
        if (infoCard) infoCard.classList.remove('name-editing');
        isEditingName = false;
        if (root) root.dataset.convertMode = 'video';
        if (formatToggle) formatToggle.classList.add('hidden');
        if (formatGrid) formatGrid.innerHTML = '';
        selectedFormat = '';
        currentCategory = '';
        selectedMode = 'video';
        hideDetailsPanel();
        if (savePathInput) savePathInput.value = '';
        setActionButtonsEnabled(false);
    };

    const setZenMode = (enabled) => {
        const body = document.body;
        if (!body) return;
        const wasZen = body.classList.contains('zen-mode');
        body.classList.toggle('zen-mode', !!enabled);
        if (!wasZen && enabled && typeof window.triggerIdleWavesEnter === 'function') {
            window.triggerIdleWavesEnter();
        }
    };

    const resolveErrorMessage = (raw) => {
        const message = String(raw || '').trim();
        if (!message) {
            return t('converter.errors.metadataFailed', 'Failed to read file.');
        }
        const lower = message.toLowerCase();
        if (lower.includes('unsupported')) {
            return t('converter.errors.unsupportedFormat', 'Unsupported format.');
        }
        if (lower.includes('file not found')) {
            return t('converter.errors.fileNotFound', 'File not found.');
        }
        if (lower.includes('no file path')) {
            return t('converter.errors.noPath', 'No file selected.');
        }
        return message;
    };

    const showError = (message) => {
        if (window.notifier) {
            window.notifier.show(
                t('common.error', 'Error'),
                message,
                'error',
                false
            );
        }
    };

    const confirmPath = async () => {
        if (!pathInput || !invoke || isLoading) return;
        const value = pathInput.value.trim();
        if (!value) return;
        setConfirmLoading(true);
        const clientTaskId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
        metadataTaskId = clientTaskId;
        try {
            await invoke('fetch_metadata_converter', {
                path: value,
                client_task_id: clientTaskId,
                clientTaskId
            });
        } catch (error) {
            metadataTaskId = null;
            setConfirmLoading(false);
            showError(resolveErrorMessage(error && error.message ? error.message : error));
        }
    };

    const openPicker = async () => {
        if (!invoke || !pathInput) return;
        try {
            const selected = await invoke('pick_convert_file');
            if (selected) {
                pathInput.value = selected;
            }
        } catch (error) {
            console.error('Failed to pick converter file:', error);
        }
    };

    if (browseBtn) {
        browseBtn.addEventListener('click', openPicker);
        browseBtn.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openPicker();
            }
        });
    }

    if (savePathBrowse) {
        savePathBrowse.addEventListener('click', async () => {
            if (!invoke || !savePathInput) return;
            try {
                const selectedPath = await invoke('pick_download_directory');
                if (selectedPath) {
                    savePathInput.value = selectedPath;
                }
            } catch (error) {
                console.error('Failed to pick directory:', error);
            }
        });
    }

    if (confirmBtn) {
        confirmBtn.addEventListener('click', confirmPath);
    }

    if (pathInput) {
        pathInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                confirmPath();
            }
        });
        pathInput.addEventListener('input', () => {
            if (pathInput.value.trim() === '') {
                resetView();
            }
        });
    }

    const applyNameEditState = (enabled) => {
        isEditingName = enabled;
        if (infoCard) infoCard.classList.toggle('name-editing', enabled);
        if (enabled && outputNameInput) {
            outputNameInput.value = currentName;
            outputNameInput.focus();
            outputNameInput.select();
        }
    };

    const commitNameEdit = () => {
        if (!outputNameInput) return;
        const next = outputNameInput.value.trim();
        if (next) {
            currentName = next;
        }
        if (outputNameText) {
            outputNameText.textContent = currentName || t('converter.output.placeholder', 'Output name');
            if (currentName) {
                outputNameText.setAttribute('data-i18n-lock', 'true');
            } else {
                outputNameText.removeAttribute('data-i18n-lock');
            }
        }
        applyNameEditState(false);
    };

    if (renameBtn) {
        renameBtn.addEventListener('click', () => {
            if (isEditingName) {
                commitNameEdit();
            } else {
                applyNameEditState(true);
            }
        });
    }

    if (outputNameInput) {
        outputNameInput.addEventListener('blur', () => {
            if (isEditingName) {
                commitNameEdit();
            }
        });
        outputNameInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                commitNameEdit();
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                applyNameEditState(false);
                if (outputNameText) {
                    outputNameText.textContent = currentName || t('converter.output.placeholder', 'Output name');
                }
            }
        });
    }

    initOutputSelects();
    bindBitrateClamp(outputVideoBitrate, bitrateConstraints.video);
    bindBitrateClamp(outputVideoAudioBitrate, bitrateConstraints.audio);
    bindBitrateClamp(outputAudioBitrate, bitrateConstraints.audio);
    bindResolutionClamp(outputImageWidth);
    bindResolutionClamp(outputImageHeight);

    if (outputImageQuality) {
        outputImageQuality.addEventListener('input', () => {
            const value = normalizeQualityValue(outputImageQuality.value);
            if (Number.isFinite(value) && outputImageQualityRange) {
                outputImageQualityRange.value = String(value);
            }
        });
        outputImageQuality.addEventListener('blur', () => {
            commitQualityValue(outputImageQuality.value);
        });
    }

    if (outputImageQualityRange) {
        outputImageQualityRange.addEventListener('input', () => {
            commitQualityValue(outputImageQualityRange.value);
        });
    }

    if (outputImageQuality || outputImageQualityRange) {
        commitQualityValue(outputImageQuality?.value ?? outputImageQualityRange?.value);
    }

    if (formatToggle) {
        toggleOptions.forEach((btn) => {
            btn.addEventListener('click', () => {
                const mode = btn.getAttribute('data-mode') || 'video';
                if (mode === selectedMode) return;
                setConvertMode(mode);
            });
        });
    }

    const isConverterActive = () => {
        const view = root.closest('.view-container');
        return document.body?.classList.contains('page-converter') && (!view || view.classList.contains('active-view'));
    };

    const showDropOverlay = () => {
        if (!dropOverlay) return;
        dropOverlay.classList.add('visible');
        dropOverlay.setAttribute('aria-hidden', 'false');
    };

    const hideDropOverlay = () => {
        if (!dropOverlay) return;
        dropOverlay.classList.remove('visible');
        dropOverlay.setAttribute('aria-hidden', 'true');
    };

    let dragCounter = 0;
    const hasFileTypes = (event) => {
        const types = event?.dataTransfer?.types;
        if (!types) return false;
        return Array.from(types).includes('Files');
    };

    const handleDragEnter = (event) => {
        if (!isConverterActive() || !hasFileTypes(event)) return;
        dragCounter += 1;
        showDropOverlay();
    };

    const handleDragOver = (event) => {
        if (!isConverterActive() || !hasFileTypes(event)) return;
        event.preventDefault();
        showDropOverlay();
    };

    const handleDragLeave = (event) => {
        if (!isConverterActive() || !hasFileTypes(event)) return;
        dragCounter = Math.max(0, dragCounter - 1);
        if (dragCounter === 0) hideDropOverlay();
    };

    const handleDrop = (event) => {
        if (!isConverterActive() || !hasFileTypes(event)) return;
        event.preventDefault();
        dragCounter = 0;
        hideDropOverlay();
        const file = event.dataTransfer?.files?.[0];
        const filePath = file?.path || '';
        if (filePath && pathInput) {
            pathInput.value = filePath;
            confirmPath();
        }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);
    if (window.MutationObserver && document.body) {
        const observer = new MutationObserver(() => {
            if (!isConverterActive()) {
                dragCounter = 0;
                hideDropOverlay();
            }
        });
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

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

    const applyDroppedPath = (rawPath) => {
        const path = normalizeDroppedPath(rawPath);
        if (!path || !pathInput) return;
        pathInput.value = path;
        confirmPath();
    };

    if (window.__TAURI__?.window?.getCurrentWindow) {
        const win = window.__TAURI__.window.getCurrentWindow();
        if (win?.onDragDropEvent) {
            win.onDragDropEvent((event) => {
                if (!isConverterActive()) return;
                const payload = event?.payload || {};
                const kind = normalizeDragKind(event?.type ?? payload?.type ?? event?.event);
                if (kind === 'enter' || kind === 'over') {
                    showDropOverlay();
                    return;
                }
                if (kind === 'leave') {
                    hideDropOverlay();
                    return;
                }
                if (kind !== 'drop') return;
                hideDropOverlay();
                const paths = payload.paths || payload.path || payload.files || event?.payload;
                const rawPath = Array.isArray(paths) ? paths[0] : (typeof paths === 'string' ? paths : null);
                applyDroppedPath(rawPath);
            });
        } else if (window.__TAURI__?.event?.listen) {
            window.__TAURI__.event.listen('tauri://file-drop-hover', () => {
                if (!isConverterActive()) return;
                showDropOverlay();
            });
            window.__TAURI__.event.listen('tauri://file-drop-cancelled', () => {
                hideDropOverlay();
            });
            window.__TAURI__.event.listen('tauri://file-drop', (event) => {
                if (!isConverterActive()) return;
                hideDropOverlay();
                const paths = event.payload?.paths || event.payload;
                const rawPath = Array.isArray(paths) ? paths[0] : (typeof paths === 'string' ? paths : null);
                applyDroppedPath(rawPath);
            });
        }
    }

    if (listen) {
        listen('download-event', (event) => {
            const payload = event.payload;
            if (!payload || !metadataTaskId || payload.id !== metadataTaskId) return;

            if (payload.type === 'finished' && payload.success === false) {
                metadataTaskId = null;
                setConfirmLoading(false);
                showError(resolveErrorMessage(payload.error));
                return;
            }

            if (payload.type !== 'metadata') return;

            metadataTaskId = null;
            setConfirmLoading(false);

            if (!payload.success || !payload.data) {
                showError(resolveErrorMessage(payload.error));
                return;
            }

            lastMetadata = payload.data;
            updateDashboard(payload.data);
            showDashboard();
        });
    }

    window.converterUi = {
        syncState: (options = {}) => {
            if (!document.body?.classList.contains('page-converter')) return;
            if (metadataTaskId) {
                setConfirmLoading(true);
                return;
            }
            const hasInput = !!pathInput && pathInput.value.trim().length > 0;
            if (lastMetadata) {
                updateDashboard(lastMetadata, {
                    applyName: false,
                    preserveSelection: true,
                    suppressShift: true
                });
                const instantReveal = pendingScrollRestore;
                const revealDelay = instantReveal ? 0 : (options.animate ? 100 : 500);
                showDashboard({ forceReveal: instantReveal || !!options.animate, delay: revealDelay });
                if (pendingScrollRestore) {
                    scheduleScrollRestore();
                    pendingScrollRestore = false;
                }
            } else if (!hasInput) {
                resetView();
                pendingScrollRestore = false;
            } else {
                if (searchSection) {
                    searchSection.classList.remove('centered');
                    searchSection.classList.add('sticky');
                }
                if (dashboard) dashboard.classList.add('hidden');
                if (document.body) {
                    document.body.classList.add('converter-active');
                    setZenMode(false);
                }
                pendingScrollRestore = false;
            }
            setConfirmLoading(false);
        },
        onDeactivate: () => {
            saveScrollPosition();
            pendingScrollRestore = true;
            if (dashboardRevealTimer) {
                clearTimeout(dashboardRevealTimer);
                dashboardRevealTimer = null;
            }
            dashboardRevealed = false;
        }
    };

    resetView();
    updateToggleButtons();
    setConfirmLoading(false);
})();