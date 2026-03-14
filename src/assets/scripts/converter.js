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
    let selectedFormat = '';
    let currentCategory = '';
    let selectedMode = 'video';
    let dashboardRevealTimer = null;
    let dashboardRevealed = false;

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

    const loadFormatData = () => {
        if (formatDataLoaded) return Promise.resolve();
        if (formatDataPromise) return formatDataPromise;
        formatDataPromise = fetch('assets/format.json', { cache: 'no-store' })
            .then((response) => (response.ok ? response.json() : null))
            .then((json) => {
                const formats = Array.isArray(json?.cformats) ? json.cformats : [];
                formatData = formats;
            })
            .catch((error) => {
                console.error('Failed to load format.json:', error);
                formatData = [];
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

    const clearFormatSelection = () => {
        selectedFormat = '';
        updateTileSelection();
        setActionButtonsEnabled(false);
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

    const animatePanelResize = (prevRect) => {
        if (!optionsPanel || !prevRect) return;
        if (optionsPanel.classList.contains('hidden')) return;
        const nextRect = optionsPanel.getBoundingClientRect();
        const delta = Math.abs(nextRect.height - prevRect.height);
        if (!nextRect.height || delta < 2) return;
        optionsPanel.style.height = `${prevRect.height}px`;
        optionsPanel.style.overflow = 'hidden';
        optionsPanel.offsetHeight;
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
        formats.forEach((item) => {
            const id = String(item?.id || '').trim();
            if (!id) return;
            const tile = document.createElement('button');
            tile.type = 'button';
            tile.className = 'tile converter-format-tile';
            tile.textContent = id.toUpperCase();
            tile.setAttribute('title', id);
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
            });
            formatGrid.appendChild(tile);
        });
        updateTileSelection();
        setActionButtonsEnabled(!!selectedFormat);
    };

    const setConvertMode = (mode, afterRender = null) => {
        const prevActionRect = actionFooter ? actionFooter.getBoundingClientRect() : null;
        selectedMode = mode === 'audio' ? 'audio' : 'video';
        updateToggleButtons();
        clearFormatSelection();
        const finalize = () => {
            renderFormats();
            requestAnimationFrame(() => {
                if (prevActionRect) {
                    animateShift(actionFooter, prevActionRect);
                }
                if (typeof afterRender === 'function') {
                    afterRender();
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

    const refreshFormatSection = (category) => {
        const normalized = String(category || '').toLowerCase();
        const nextCategory = supportedCategories.has(normalized) ? normalized : '';
        const prevCategory = currentCategory;
        const shouldAnimatePanel = !!prevCategory && !!nextCategory && prevCategory !== nextCategory;
        const prevPanelRect = optionsPanel ? optionsPanel.getBoundingClientRect() : null;
        const prevActionRect = actionFooter ? actionFooter.getBoundingClientRect() : null;
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
                setConvertMode(selectedMode || 'video', () => {
                    if (shouldAnimatePanel) {
                        animatePanelResize(prevPanelRect);
                    }
                });
            } else {
                selectedMode = currentCategory === 'audio' ? 'audio' : 'video';
                updateToggleButtons();
                clearFormatSelection();
                renderFormats();
                requestAnimationFrame(() => {
                    if (prevActionRect) {
                        animateShift(actionFooter, prevActionRect);
                    }
                    if (shouldAnimatePanel) {
                        animatePanelResize(prevPanelRect);
                    }
                });
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

        if (applyName) {
            currentName = data.name || '';
        }
        if (outputNameText) {
            outputNameText.textContent = currentName || t('converter.output.placeholder', 'Output name');
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

        refreshFormatSection(category);
    };

    const revealDashboard = () => {
        if (dashboard) {
            dashboard.classList.remove('hidden');
        }
        [infoCard, optionsPanel].forEach((element) => {
            if (!element) return;
            element.classList.remove('fade-in');
            void element.offsetWidth;
            element.classList.add('fade-in');
        });
        dashboardRevealed = true;
    };

    const showDashboard = () => {
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
        if (outputNameText) outputNameText.textContent = t('converter.output.placeholder', 'Output name');
        if (outputNameInput) outputNameInput.value = '';
        if (infoCard) infoCard.classList.remove('name-editing');
        isEditingName = false;
        if (root) root.dataset.convertMode = 'video';
        if (formatToggle) formatToggle.classList.add('hidden');
        if (formatGrid) formatGrid.innerHTML = '';
        selectedFormat = '';
        currentCategory = '';
        selectedMode = 'video';
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
        syncState: () => {
            if (!document.body?.classList.contains('page-converter')) return;
            if (metadataTaskId) {
                setConfirmLoading(true);
                return;
            }
            const hasInput = !!pathInput && pathInput.value.trim().length > 0;
            if (lastMetadata) {
                updateDashboard(lastMetadata, { applyName: false });
                showDashboard();
            } else if (!hasInput) {
                resetView();
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
            }
            setConfirmLoading(false);
        }
    };

    resetView();
    updateToggleButtons();
    setConfirmLoading(false);
})();