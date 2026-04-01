(() => {
    const tauriCore = window.__TAURI__ && window.__TAURI__.core;
    const tauriEvent = window.__TAURI__ && window.__TAURI__.event;
    const invoke = tauriCore && tauriCore.invoke ? tauriCore.invoke : null;
    const listen = tauriEvent && tauriEvent.listen ? tauriEvent.listen : null;
    const root = document.querySelector('.compressor-page');
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
        image: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M15.2 4H8.8c-1.69 0-2.52 0-3.16.33a3.07 3.07 0 0 0-1.31 1.31C4 6.28 4 7.12 4 8.8v6.4c0 1.68 0 2.52.33 3.16a3.07 3.07 0 0 0 1.31 1.31c.64.33 1.48.33 3.16.33h6.4c1.68 0 2.52 0 3.16-.33a3.07 3.07 0 0 0 1.31-1.31c.33-.64.33-1.48.33-3.16V8.8"/><path d="m4 16 4.29-4.29a.996.996 0 0 1 1.41 0L12.99 15m.01 0 2.79-2.79a.996.996 0 0 1 1.41 0L19.99 15M13 15l2.25 2.25M20 8.8c0-1.68 0-2.52-.33-3.16a3.07 3.07 0 0 0-1.31-1.31C17.72 4 16.88 4 15.2 4"/></svg>`
    };
    const KEY_ICON_SVG = '<svg viewBox="0 0 24 24" style="width:100%;height:100%;display:block;fill:currentColor"><path d="m22.7 19-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.3.5-1 .1-1.4"/></svg>';

    const supportedCategories = new Set(['video', 'audio', 'image']);

    const searchSection = root.querySelector('#compress-search-section');
    const dashboard = root.querySelector('#compress-dashboard');
    const infoCard = root.querySelector('.compressor-info-card');
    const pathInput = root.querySelector('#compress-path-input');
    const browseBtn = root.querySelector('#compress-browse-btn');
    const confirmBtn = root.querySelector('#compress-confirm-btn');
    const nameText = root.querySelector('#compress-file-name');
    const nameInput = root.querySelector('#compress-file-name-input');
    const renameBtn = root.querySelector('#compress-rename-btn');
    const categoryIcon = root.querySelector('#compress-category-icon');
    const categoryLabel = root.querySelector('#compress-category-label');
    const locationValue = root.querySelector('#compress-file-location');
    const sizeValue = root.querySelector('#compress-file-size');
    const durationValue = root.querySelector('#compress-file-duration');
    const dropOverlay = root.querySelector('#compress-drop-overlay');
    const modeToggle = root.querySelector('#compress-mode-toggle');
    const modeButtons = modeToggle ? Array.from(modeToggle.querySelectorAll('.switch-option')) : [];
    const modePanels = Array.from(root.querySelectorAll('.compressor-mode-panel'));
    const modePanelsWrap = root.querySelector('.compressor-mode-panels');
    const percentRange = root.querySelector('#compress-percent-range');
    const percentInput = root.querySelector('#compress-percent-input');
    const percentFill = root.querySelector('#compress-percent-fill');
    const sizeInput = root.querySelector('#compress-size-input');
    const crfSelect = root.querySelector('#compress-crf-select');
    const optionsPanel = root.querySelector('.compressor-options-panel');
    const savePathPanel = root.querySelector('#compress-save-path-panel');
    const savePathInput = root.querySelector('#compress-save-path-input');
    const savePathBrowse = root.querySelector('#compress-save-path-browse');
    const specsPanel = root.querySelector('#compress-specs-panel');
    const specsSections = Array.from(root.querySelectorAll('.compressor-specs-section'));
    const estimatedVideoSize = root.querySelector('#compress-estimated-video-size');
    const estimatedAudioSize = root.querySelector('#compress-estimated-audio-size');
    const estimatedImageSize = root.querySelector('#compress-estimated-image-size');
    const estimatedOtherSize = root.querySelector('#compress-estimated-other-size');
    const videoCodecSelect = root.querySelector('#compress-video-codec');
    const videoAudioCodecSelect = root.querySelector('#compress-video-audio-codec');
    const audioCodecSelect = root.querySelector('#compress-audio-codec');
    const compressActionBtn = root.querySelector('#compress-action-btn');
    const queueActionBtn = root.querySelector('#compress-queue-btn');
    const scrollContainer = root.querySelector('.page-scroll');
    const presetSection = root.querySelector('#compress-preset-section');
    const presetGrid = root.querySelector('#compress-preset-grid');

    if (dropOverlay && dropOverlay.parentElement !== document.body) {
        document.body.appendChild(dropOverlay);
    }

    let metadataTaskId = null;
    let isLoading = false;
    let lastMetadata = null;
    let currentName = '';
    let isEditingName = false;
    let selectedMode = 'percent';
    let currentCategory = '';
    let formatDataLoaded = false;
    let formatDataPromise = null;
    let formatMetaMap = new Map();
    let lastScrollTop = 0;
    let pendingScrollRestore = false;
    let dashboardRevealTimer = null;
    let dashboardRevealed = false;
    let modeSwitchTimer = null;
    let presets = [];
    let activePresetId = null;
    let applyingPreset = false;

    const PANEL_IN_MS = 220;
    const PANEL_OUT_MS = 180;

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

    const normalizePercentValue = (raw) => {
        const parsed = parseInteger(raw);
        if (!Number.isFinite(parsed)) return null;
        return clampNumber(parsed, 1, 100);
    };

    const updatePercentFill = () => {
        if (!percentRange || !percentFill) return;
        const min = Number(percentRange.min || 1);
        const max = Number(percentRange.max || 100);
        const value = Number(percentRange.value || 0);
        const ratio = max > min ? (value - min) / (max - min) : 0;
        percentFill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
    };

    const commitPercentValue = (raw) => {
        const fallback = 60;
        const clamped = normalizePercentValue(raw);
        const value = Number.isFinite(clamped) ? clamped : fallback;
        if (percentInput) percentInput.value = String(value);
        if (percentRange) percentRange.value = String(value);
        updatePercentFill();
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
        const bytes = amount * mult;
        return Number.isFinite(bytes) ? Math.round(bytes) : null;
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

    const trimSummary = (value, maxLen = 48) => {
        const text = String(value || '').trim();
        if (text.length <= maxLen) return text;
        return `${text.slice(0, Math.max(0, maxLen - 3))}...`;
    };

    const decodeSvgDataUrl = (dataUrl) => {
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
    };

    const applyPresetIcon = (iconEl, iconSource) => {
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
    };

    const clearActivePreset = () => {
        if (!activePresetId) return;
        activePresetId = null;
        if (presetGrid) {
            presetGrid.querySelectorAll('.preset-card.active').forEach((el) => el.classList.remove('active'));
        }
    };

    const setActivePreset = (id) => {
        activePresetId = id;
        if (!presetGrid) return;
        presetGrid.querySelectorAll('.preset-card').forEach((el) => {
            el.classList.toggle('active', el.dataset.presetId === id);
        });
    };

    const clearActivePresetIfNeeded = () => {
        if (applyingPreset) return;
        clearActivePreset();
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

    const clearEstimatedSizes = () => {
        if (estimatedVideoSize) estimatedVideoSize.textContent = '-';
        if (estimatedAudioSize) estimatedAudioSize.textContent = '-';
        if (estimatedImageSize) estimatedImageSize.textContent = '-';
        if (estimatedOtherSize) estimatedOtherSize.textContent = '-';
    };

    const setEstimatedSize = (category, bytes) => {
        clearEstimatedSizes();
        if (!Number.isFinite(bytes)) return;
        const value = formatBytes(bytes);
        if (category === 'video' && estimatedVideoSize) {
            estimatedVideoSize.textContent = value;
            return;
        }
        if (category === 'audio' && estimatedAudioSize) {
            estimatedAudioSize.textContent = value;
            return;
        }
        if (category === 'image' && estimatedImageSize) {
            estimatedImageSize.textContent = value;
            return;
        }
        if (estimatedOtherSize) {
            estimatedOtherSize.textContent = value;
        }
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
        const targetKey = resolveSpecsCategory(currentCategory);
        setSpecsSectionVisibility(specsSections, targetKey);
    };

    const estimateFromCrf = (sizeBytes, crf) => {
        const numeric = Number.isFinite(crf) ? crf : null;
        if (!Number.isFinite(sizeBytes) || !Number.isFinite(numeric)) return null;
        const ratio = 1 - (numeric / 51) * 0.75;
        const safeRatio = Math.max(0.18, Math.min(1, ratio));
        return Math.round(sizeBytes * safeRatio);
    };

    const updateEstimatedSize = () => {
        if (!lastMetadata || !Number.isFinite(Number(lastMetadata.size_bytes))) {
            clearEstimatedSizes();
            return;
        }
        const baseSize = Number(lastMetadata.size_bytes);
        const category = resolveSpecsCategory(currentCategory);
        if (selectedMode === 'percent') {
            const percentValue = commitPercentValue(percentInput?.value ?? percentRange?.value);
            const estimated = Number.isFinite(percentValue)
                ? Math.round(baseSize * (percentValue / 100))
                : null;
            setEstimatedSize(category, estimated);
            return;
        }
        if (selectedMode === 'size') {
            const targetBytes = parseSizeInput(sizeInput?.value || '');
            setEstimatedSize(category, targetBytes);
            return;
        }
        if (selectedMode === 'quality') {
            const crfValue = parseInteger(crfSelect?.value);
            setEstimatedSize(category, estimateFromCrf(baseSize, crfValue));
            return;
        }
        clearEstimatedSizes();
    };

    const normalizeOutputFormat = (value) => {
        if (!value) return '';
        let raw = String(value || '').trim().toLowerCase();
        while (raw.startsWith('.')) raw = raw.slice(1);
        return raw;
    };

    const buildCompressPayload = () => {
        if (!lastMetadata) return null;
        const category = String(currentCategory || lastMetadata.category || '').toLowerCase();
        if (category !== 'video' && category !== 'audio' && category !== 'image') return null;
        const outputDir = (savePathInput?.value || '').trim() || extractFolderPath(lastMetadata.path);
        const rawName = sanitizeOutputName(currentName || lastMetadata.name || 'output');
        const inputFormat = normalizeOutputFormat(lastMetadata.extension || lastMetadata.format || '');
        let baseName = rawName;
        if (inputFormat) {
            const suffix = `.${inputFormat}`;
            if (baseName.toLowerCase().endsWith(suffix)) {
                baseName = baseName.slice(0, -suffix.length);
            }
        }
        if (!baseName) baseName = 'output';
        let outputName = baseName;
        let outputPath = inputFormat ? joinPath(outputDir, `${outputName}.${inputFormat}`) : joinPath(outputDir, outputName);
        if (outputPath && lastMetadata?.path && String(outputPath).toLowerCase() === String(lastMetadata.path).toLowerCase()) {
            outputName = `${baseName}_compressed`;
            outputPath = inputFormat
                ? joinPath(outputDir, `${outputName}.${inputFormat}`)
                : joinPath(outputDir, outputName);
        }
        const percentValue = selectedMode === 'percent' ? commitPercentValue(percentInput?.value ?? percentRange?.value) : null;
        const targetSize = selectedMode === 'size' ? parseSizeInput(sizeInput?.value || '') : null;
        if (selectedMode === 'size' && !Number.isFinite(targetSize)) {
            return null;
        }
        const crfValue = selectedMode === 'quality' ? parseInteger(crfSelect?.value) : null;
        return {
            input_path: lastMetadata.path,
            output_dir: outputDir,
            output_name: outputName,
            output_format: inputFormat,
            category,
            compress_mode: selectedMode,
            target_percent: Number.isFinite(percentValue) ? percentValue : null,
            target_size_bytes: Number.isFinite(targetSize) ? targetSize : null,
            crf: Number.isFinite(crfValue) ? crfValue : null,
            video_codec: category === 'video' ? (videoCodecSelect?.value || '') : '',
            audio_codec: category === 'audio'
                ? (audioCodecSelect?.value || '')
                : (category === 'video' ? (videoAudioCodecSelect?.value || '') : ''),
            source_duration_seconds: Number.isFinite(Number(lastMetadata.duration_seconds))
                ? Number(lastMetadata.duration_seconds)
                : null,
            source_size_bytes: Number.isFinite(Number(lastMetadata.size_bytes)) ? Number(lastMetadata.size_bytes) : null,
            source_format: String(lastMetadata.extension || ''),
            path: outputPath
        };
    };

    const setActionButtonsEnabled = (enabled) => {
        [compressActionBtn, queueActionBtn].forEach((btn) => {
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

    const updateActionButtonsState = () => {
        const needsSize = selectedMode === 'size';
        const hasValidSize = !!(sizeInput && Number.isFinite(parseSizeInput(sizeInput.value)));
        const enable = !needsSize || hasValidSize;
        setActionButtonsEnabled(enable);
    };

    const setMode = (mode, options = {}) => {
        const next = mode === 'size' || mode === 'quality' ? mode : 'percent';
        if (next === selectedMode && !options.force) return;
        selectedMode = next;
        if (root) root.dataset.compressMode = selectedMode;
        modeButtons.forEach((btn) => {
            const btnMode = btn.getAttribute('data-mode');
            const active = btnMode === selectedMode;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        resetModeTransition();
        const nextPanel = modePanels.find((panel) => panel.getAttribute('data-mode') === selectedMode) || null;
        const prevPanel = modePanels.find((panel) => !panel.classList.contains('hidden')) || null;
        if (options.animate === false || !nextPanel) {
            modePanels.forEach((panel) => {
                const visible = panel === nextPanel;
                panel.classList.toggle('hidden', !visible);
                panel.classList.remove('depth-enter', 'depth-exit');
            });
        } else if (prevPanel && prevPanel !== nextPanel) {
            modePanels.forEach((panel) => {
                if (panel !== prevPanel && panel !== nextPanel) {
                    panel.classList.add('hidden');
                }
                panel.classList.remove('depth-enter', 'depth-exit');
            });
            nextPanel.classList.add('hidden');
            if (modePanelsWrap) {
                const prevRect = prevPanel.getBoundingClientRect();
                modePanelsWrap.style.height = `${prevRect.height}px`;
                modePanelsWrap.classList.add('mode-switching');
            }
            animatePanelDepthOut(prevPanel);
            modeSwitchTimer = window.setTimeout(() => {
                prevPanel.classList.add('hidden');
                prevPanel.classList.remove('depth-exit');
                requestAnimationFrame(() => {
                    nextPanel.classList.remove('hidden');
                    animatePanelDepthIn(nextPanel);
                    modeSwitchTimer = window.setTimeout(() => {
                        nextPanel.classList.remove('depth-enter');
                        if (modePanelsWrap) {
                            modePanelsWrap.style.height = '';
                            modePanelsWrap.classList.remove('mode-switching');
                        }
                        modeSwitchTimer = null;
                    }, PANEL_IN_MS);
                });
            }, PANEL_OUT_MS);
        } else {
            modePanels.forEach((panel) => {
                const visible = panel === nextPanel;
                panel.classList.toggle('hidden', !visible);
                if (!visible) {
                    panel.classList.remove('depth-enter', 'depth-exit');
                }
            });
            animatePanelDepthIn(nextPanel);
            modeSwitchTimer = window.setTimeout(() => {
                if (nextPanel) nextPanel.classList.remove('depth-enter');
                modeSwitchTimer = null;
            }, PANEL_IN_MS);
        }
        updateActionButtonsState();
        updateEstimatedSize();
    };

    const applyPreset = async (preset) => {
        if (!preset || !preset.compressor) return;
        applyingPreset = true;
        try {
            const comp = preset.compressor;
            const mode = comp.mode || 'percent';
            setMode(mode, { force: true, animate: false });
            if (selectedMode === 'percent') {
                commitPercentValue(comp.target_percent ?? percentInput?.value ?? percentRange?.value ?? 60);
            } else if (selectedMode === 'size') {
                if (sizeInput) sizeInput.value = comp.target_size || '';
            } else {
                if (crfSelect && !crfSelect.options.length) {
                    buildCrfOptions();
                }
                if (crfSelect) {
                    crfSelect.value = String(Number.isFinite(comp.crf) ? comp.crf : 26);
                }
            }
            updateActionButtonsState();
            updateEstimatedSize();
        } finally {
            applyingPreset = false;
        }
    };

    const handlePresetClick = async (preset) => {
        if (!preset?.id || !invoke) return;
        if (activePresetId === preset.id) {
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
    };

    const loadPresets = async () => {
        if (!presetGrid || !presetSection || !invoke) return;
        try {
            const list = await invoke('list_presets');
            const safePresets = Array.isArray(list) ? list : [];
            presets = safePresets.filter((preset) => {
                const type = String(preset.preset_type || '').toLowerCase();
                return !preset.hidden && type === 'compressor';
            });
        } catch (error) {
            console.warn('Preset list not available:', error);
            presets = [];
        }

        presetGrid.innerHTML = '';
        const activeId = activePresetId;
        if (!presets.length) {
            presetSection.classList.add('hidden');
            clearActivePreset();
            return;
        }

        presetSection.classList.remove('hidden');
        presets.forEach((preset) => {
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

        const exists = presets.some((preset) => preset.id === activeId);
        if (exists) {
            setActivePreset(activeId);
        } else {
            clearActivePreset();
        }
    };

    const triggerShake = (element) => {
        if (!element) return;
        element.classList.remove('shake-feedback');
        void element.offsetWidth;
        element.classList.add('shake-feedback');
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

    const loadFormatData = () => {
        if (formatDataLoaded) return Promise.resolve();
        if (formatDataPromise) return formatDataPromise;
        formatDataPromise = fetch('assets/format.json', { cache: 'no-store' })
            .then((response) => (response.ok ? response.json() : null))
            .then((json) => {
                const formats = Array.isArray(json?.cformats) ? json.cformats : [];
                formatMetaMap = new Map(
                    formats.map((item) => [String(item?.id || '').toLowerCase(), item])
                );
            })
            .catch((error) => {
                console.error('Failed to load format.json:', error);
                formatMetaMap = new Map();
            })
            .finally(() => {
                formatDataLoaded = true;
                formatDataPromise = null;
            });
        return formatDataPromise;
    };

    const normalizeFormatKey = (value) => {
        if (!value) return '';
        let raw = String(value || '').trim().toLowerCase();
        while (raw.startsWith('.')) raw = raw.slice(1);
        return raw;
    };

    const updateCodecOptions = () => {
        const key = normalizeFormatKey(lastMetadata?.extension || '');
        const meta = formatMetaMap.get(key);
        rebuildSelect(videoCodecSelect, buildCodecOptions(meta?.video_codecs));
        rebuildSelect(videoAudioCodecSelect, buildCodecOptions(meta?.audio_codecs));
        rebuildSelect(audioCodecSelect, buildCodecOptions(meta?.audio_codecs));
    };

    const buildCrfOptions = () => {
        if (!crfSelect) return;
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
        rebuildSelect(crfSelect, options);
        crfSelect.value = '26';
    };

    const extractFolderPath = (value) => {
        if (typeof value !== 'string') return '';
        const trimmed = value.trim();
        if (!trimmed) return '';
        const normalized = trimmed.replace(/\\/g, '/');
        const idx = normalized.lastIndexOf('/');
        if (idx <= 0) return '';
        return normalized.slice(0, idx).replace(/\//g, '\\');
    };

    const extractFileName = (value) => {
        if (typeof value !== 'string') return '';
        const trimmed = value.trim();
        if (!trimmed) return '';
        const normalized = trimmed.replace(/\\/g, '/');
        const idx = normalized.lastIndexOf('/');
        if (idx < 0) return trimmed;
        return normalized.slice(idx + 1);
    };

    const sanitizeOutputName = (value) => {
        const raw = String(value || '').trim();
        if (!raw) return '';
        return raw.replace(/[\\/]+/g, ' ').trim();
    };

    const detectPathSeparator = (value) => (String(value || '').includes('\\') ? '\\' : '/');

    const joinPath = (base, name) => {
        if (!base) return name;
        const sep = detectPathSeparator(base);
        if (base.endsWith('/') || base.endsWith('\\')) {
            return `${base}${name}`;
        }
        return `${base}${sep}${name}`;
    };

    const animateReveal = (element) => {
        if (!element) return;
        element.classList.remove('fade-in');
        void element.offsetWidth;
        element.classList.add('fade-in');
    };

    const animatePanelDepthIn = (panel) => {
        if (!panel) return;
        panel.classList.remove('depth-enter');
        void panel.offsetWidth;
        panel.classList.add('depth-enter');
    };

    const animatePanelDepthOut = (panel) => {
        if (!panel) return;
        panel.classList.remove('depth-exit');
        void panel.offsetWidth;
        panel.classList.add('depth-exit');
    };

    const resetModeTransition = () => {
        if (modeSwitchTimer) {
            clearTimeout(modeSwitchTimer);
            modeSwitchTimer = null;
        }
        if (modePanelsWrap) {
            modePanelsWrap.style.height = '';
            modePanelsWrap.classList.remove('mode-switching');
        }
        modePanels.forEach((panel) => {
            panel.classList.remove('depth-enter', 'depth-exit');
        });
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

    const revealDashboard = () => {
        if (dashboard) {
            dashboard.classList.remove('hidden');
            const fadeTargets = Array.from(dashboard.querySelectorAll('.fade-in'));
            fadeTargets.forEach((element) => {
                animateReveal(element);
            });
        }
        dashboardRevealed = true;
    };

    const showDashboard = () => {
        if (searchSection) {
            searchSection.classList.remove('centered');
            searchSection.classList.add('sticky');
        }
        if (document.body) {
            document.body.classList.add('compressor-active');
            setZenMode(false);
        }
        if (dashboardRevealTimer) {
            clearTimeout(dashboardRevealTimer);
            dashboardRevealTimer = null;
        }
        if (dashboard && dashboard.classList.contains('hidden')) {
            dashboardRevealTimer = window.setTimeout(() => {
                revealDashboard();
                dashboardRevealTimer = null;
            }, 500);
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
            document.body.classList.remove('compressor-active');
            setZenMode(true);
        }
        currentName = '';
        if (nameText) {
            nameText.textContent = t('compressor.output.placeholder', 'File name');
            nameText.removeAttribute('data-i18n-lock');
        }
        if (nameInput) nameInput.value = '';
        if (categoryLabel) categoryLabel.textContent = '';
        if (categoryIcon) categoryIcon.innerHTML = '';
        if (locationValue) {
            locationValue.textContent = '-';
            locationValue.removeAttribute('title');
        }
        if (sizeValue) sizeValue.textContent = '-';
        if (durationValue) durationValue.textContent = '-';
        if (infoCard) infoCard.classList.remove('no-duration', 'name-editing');
        isEditingName = false;
        currentCategory = '';
        commitPercentValue(60);
        if (sizeInput) sizeInput.value = '';
        if (crfSelect) {
            if (!crfSelect.options.length) {
                buildCrfOptions();
            }
            crfSelect.value = '26';
            if (window.initCustomSelects) {
                window.initCustomSelects();
            }
        }
        clearEstimatedSizes();
        setMode('percent', { force: true, animate: false });
        updateSpecsVisibility();
        updateCodecOptions();
        updateActionButtonsState();
        clearActivePreset();
    };

    const resolveErrorMessage = (raw) => {
        const message = String(raw || '').trim();
        if (!message) {
            return t('compressor.errors.metadataFailed', 'Failed to read file.');
        }
        const lower = message.toLowerCase();
        if (lower.includes('unsupported')) {
            return t('compressor.errors.unsupportedFormat', 'Unsupported format.');
        }
        if (lower.includes('file not found')) {
            return t('compressor.errors.fileNotFound', 'File not found.');
        }
        if (lower.includes('no file path')) {
            return t('compressor.errors.noPath', 'No file selected.');
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

    const updateDashboard = (data) => {
        const category = String(data.category || '').toLowerCase();
        const extension = String(data.extension || '').trim();
        currentCategory = category;
        const categoryLabelText = t(
            `compressor.meta.category.${category}`,
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
        const fallbackName = extractFileName(data.path || '');
        currentName = nextName || fallbackName;
        if (nameText) {
            nameText.textContent = currentName || t('compressor.output.placeholder', 'File name');
            if (currentName) {
                nameText.setAttribute('data-i18n-lock', 'true');
            } else {
                nameText.removeAttribute('data-i18n-lock');
            }
        }
        if (nameInput) {
            nameInput.value = currentName;
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
        updateSpecsVisibility();
        updateEstimatedSize();
        updateActionButtonsState();
        loadFormatData().then(() => {
            updateCodecOptions();
        });
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
            console.error('Failed to pick compressor file:', error);
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

    if (savePathBrowse) {
        savePathBrowse.addEventListener('click', async () => {
            if (!invoke || !savePathInput) return;
            try {
                const selectedPath = await invoke('pick_download_directory');
                if (selectedPath) {
                    savePathInput.value = selectedPath;
                    clearActivePresetIfNeeded();
                }
            } catch (error) {
                console.error('Failed to pick directory:', error);
            }
        });
    }
    if (savePathInput) {
        savePathInput.addEventListener('input', () => {
            clearActivePresetIfNeeded();
        });
    }

    if (modeToggle) {
        modeButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const mode = btn.getAttribute('data-mode') || 'percent';
                if (mode === selectedMode) {
                    triggerShake(btn);
                    return;
                }
                clearActivePresetIfNeeded();
                setMode(mode);
            });
        });
    }

    if (percentRange) {
        percentRange.addEventListener('input', () => {
            commitPercentValue(percentRange.value);
            clearActivePresetIfNeeded();
            updateEstimatedSize();
        });
    }

    if (percentInput) {
        percentInput.addEventListener('input', () => {
            const value = normalizePercentValue(percentInput.value);
            if (Number.isFinite(value) && percentRange) {
                percentRange.value = String(value);
                updatePercentFill();
            }
            clearActivePresetIfNeeded();
            updateEstimatedSize();
        });
        percentInput.addEventListener('blur', () => {
            commitPercentValue(percentInput.value);
            clearActivePresetIfNeeded();
            updateEstimatedSize();
        });
    }

    if (sizeInput) {
        sizeInput.addEventListener('input', () => {
            clearActivePresetIfNeeded();
            updateActionButtonsState();
            updateEstimatedSize();
        });
        sizeInput.addEventListener('blur', () => {
            clearActivePresetIfNeeded();
            updateActionButtonsState();
            updateEstimatedSize();
        });
    }

    if (crfSelect) {
        crfSelect.addEventListener('change', () => {
            clearActivePresetIfNeeded();
            updateEstimatedSize();
        });
    }

    [videoCodecSelect, videoAudioCodecSelect, audioCodecSelect].forEach((select) => {
        if (!select) return;
        select.addEventListener('change', () => {
            clearActivePresetIfNeeded();
            updateEstimatedSize();
        });
    });

    const applyNameEditState = (enabled) => {
        isEditingName = enabled;
        if (infoCard) infoCard.classList.toggle('name-editing', enabled);
        if (enabled && nameInput) {
            nameInput.value = currentName;
            nameInput.focus();
            nameInput.select();
        }
    };

    const commitNameEdit = () => {
        if (!nameInput) return;
        const next = nameInput.value.trim();
        if (next) {
            currentName = next;
        }
        if (nameText) {
            nameText.textContent = currentName || t('compressor.output.placeholder', 'File name');
            if (currentName) {
                nameText.setAttribute('data-i18n-lock', 'true');
            } else {
                nameText.removeAttribute('data-i18n-lock');
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

    if (nameInput) {
        nameInput.addEventListener('blur', () => {
            if (isEditingName) {
                commitNameEdit();
            }
        });
        nameInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                commitNameEdit();
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                applyNameEditState(false);
                if (nameText) {
                    nameText.textContent = currentName || t('compressor.output.placeholder', 'File name');
                    if (currentName) {
                        nameText.setAttribute('data-i18n-lock', 'true');
                    } else {
                        nameText.removeAttribute('data-i18n-lock');
                    }
                }
            }
        });
    }

    const currentMetaSnapshot = () => ({
        title: currentName || lastMetadata?.name || t('common.unknownTitle', 'Unknown title'),
        thumbnail: ''
    });

    const animateQueueOrbFrom = (element) => {
        if (window.queueManager && window.queueManager.animateQueueOrb) {
            window.queueManager.animateQueueOrb(element);
        }
    };

    const returnToZenAfterQueueAction = () => {
        window.setTimeout(() => {
            if (pathInput) pathInput.value = '';
            resetView();
        }, 40);
    };

    const startCompressAction = async (autoStart, sourceButton) => {
        if (!lastMetadata) return;
        const payload = buildCompressPayload();
        if (!payload) {
            showError(t('compressor.errors.unsupportedFormat', 'Unsupported format.'));
            return;
        }
        const meta = currentMetaSnapshot();
        try {
            if (window.queueManager && window.queueManager.enqueue) {
                window.queueManager.enqueue(payload, meta, {
                    autoStart: !!autoStart,
                    startReason: autoStart ? 'compress' : null,
                    source: autoStart ? 'compress' : 'queue',
                    itemType: 'compress'
                });
            } else if (autoStart && invoke) {
                await invoke('start_compress', { options: payload });
            } else {
                showError(t('queue.errors.queueUnavailable', 'Queue is unavailable.'));
                return;
            }
            if (sourceButton) animateQueueOrbFrom(sourceButton);
            returnToZenAfterQueueAction();
        } catch (error) {
            console.error('Error starting compress:', error);
            showError(t('compressor.errors.startPrefix', 'Error: {error}', { error: String(error) }));
        }
    };

    if (compressActionBtn) {
        compressActionBtn.addEventListener('click', () => {
            if (compressActionBtn.getAttribute('disabled') === 'true') return;
            startCompressAction(true, compressActionBtn);
        });
    }

    if (queueActionBtn) {
        queueActionBtn.addEventListener('click', () => {
            if (queueActionBtn.getAttribute('disabled') === 'true') return;
            startCompressAction(false, queueActionBtn);
        });
    }

    const isCompressorActive = () => {
        const view = root.closest('.view-container');
        return document.body?.classList.contains('page-compressor') && (!view || view.classList.contains('active-view'));
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
        if (!isCompressorActive() || !hasFileTypes(event)) return;
        dragCounter += 1;
        showDropOverlay();
    };

    const handleDragOver = (event) => {
        if (!isCompressorActive() || !hasFileTypes(event)) return;
        event.preventDefault();
        showDropOverlay();
    };

    const handleDragLeave = (event) => {
        if (!isCompressorActive() || !hasFileTypes(event)) return;
        dragCounter = Math.max(0, dragCounter - 1);
        if (dragCounter === 0) hideDropOverlay();
    };

    const handleDrop = (event) => {
        if (!isCompressorActive() || !hasFileTypes(event)) return;
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
            if (!isCompressorActive()) {
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
                if (!isCompressorActive()) return;
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
                if (!isCompressorActive()) return;
                showDropOverlay();
            });
            window.__TAURI__.event.listen('tauri://file-drop-cancelled', () => {
                hideDropOverlay();
            });
            window.__TAURI__.event.listen('tauri://file-drop', (event) => {
                if (!isCompressorActive()) return;
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

            const category = String(payload.data.category || '').toLowerCase();
            if (!supportedCategories.has(category)) {
                showError(t(
                'compressor.errors.unsupportedFormat',
                    'Unsupported format.'
                ));
                if (pathInput) pathInput.value = '';
                resetView();
                return;
            }

            lastMetadata = payload.data;
            updateDashboard(payload.data);
            showDashboard();
        });
    }

    window.addEventListener('pulsar-presets-updated', () => {
        loadPresets();
    });
    loadPresets();

    window.compressorUi = {
        syncState: () => {
            if (!document.body?.classList.contains('page-compressor')) return;
            if (metadataTaskId) {
                setConfirmLoading(true);
                return;
            }
            const hasInput = !!pathInput && pathInput.value.trim().length > 0;
            if (lastMetadata) {
                updateDashboard(lastMetadata);
                showDashboard();
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
                    document.body.classList.add('compressor-active');
                    setZenMode(false);
                }
                pendingScrollRestore = false;
            }
            setConfirmLoading(false);
        },
        onDeactivate: () => {
            saveScrollPosition();
            pendingScrollRestore = true;
            hideDropOverlay();
            if (dashboardRevealTimer) {
                clearTimeout(dashboardRevealTimer);
                dashboardRevealTimer = null;
            }
            dashboardRevealed = false;
        }
    };

    resetView();
    setConfirmLoading(false);
})();