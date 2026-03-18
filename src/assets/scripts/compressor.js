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

    if (dropOverlay && dropOverlay.parentElement !== document.body) {
        document.body.appendChild(dropOverlay);
    }

    let metadataTaskId = null;
    let isLoading = false;
    let lastMetadata = null;
    let currentName = '';
    let isEditingName = false;

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

    const animateReveal = (element) => {
        if (!element) return;
        element.classList.remove('fade-in');
        void element.offsetWidth;
        element.classList.add('fade-in');
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

    const showDashboard = () => {
        if (searchSection) {
            searchSection.classList.remove('centered');
            searchSection.classList.add('sticky');
        }
        if (document.body) {
            document.body.classList.add('compressor-active');
            setZenMode(false);
        }
        if (dashboard) {
            dashboard.classList.remove('hidden');
            const fadeTargets = Array.from(dashboard.querySelectorAll('.fade-in'));
            fadeTargets.forEach((element) => {
                animateReveal(element);
            });
        }
    };

    const resetView = () => {
        lastMetadata = null;
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
            } else if (!hasInput) {
                resetView();
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
            }
            setConfirmLoading(false);
        },
        onDeactivate: () => {
            hideDropOverlay();
        }
    };

    resetView();
    setConfirmLoading(false);
})();