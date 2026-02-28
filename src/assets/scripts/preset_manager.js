(() => {
    const listEl = document.getElementById('preset-list');
    const emptyEl = document.getElementById('preset-empty');
    const countEl = document.getElementById('preset-count');
    const addBtn = document.getElementById('preset-add-btn');
    const importBtn = document.getElementById('preset-import-btn');

    if (!listEl || !emptyEl || !countEl) {
        return;
    }

    const getKeyIcon = () => (
        '<svg viewBox="0 0 24 24" style="width:100%;height:100%;display:block;fill:currentColor">' +
        '<path d="m22.7 19-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.3.5-1 .1-1.4"/>' +
        '</svg>'
    );

    const state = {
        presets: []
    };

    const t = (key, fallback, params = null) => {
        if (window.i18n && typeof window.i18n.t === 'function') {
            return window.i18n.t(key, fallback || '', params);
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

    const formatCountLabel = (count) => {
        if (count === 1) {
            return t('settings.presetsManager.countSingle', '1 preset');
        }
        return t('settings.presetsManager.count', '{count} presets', { count });
    };

    const renderPresets = (presets) => {
        listEl.innerHTML = '';
        const safePresets = Array.isArray(presets) ? presets : [];

        safePresets.forEach((preset) => {
            const item = document.createElement('div');
            item.className = 'preset-item';
            if (preset.hidden) item.classList.add('is-hidden');

            const icon = document.createElement('div');
            icon.className = 'preset-item-icon';
            const iconSource = preset.icon_data_url || preset.icon;
            if (iconSource) {
                if (iconSource.startsWith('<svg')) {
                    icon.innerHTML = iconSource;
                } else {
                    const img = document.createElement('img');
                    img.src = iconSource;
                    img.alt = preset.title || 'Preset';
                    img.onerror = () => {
                        icon.innerHTML = getKeyIcon();
                    };
                    icon.appendChild(img);
                }
            } else {
                icon.innerHTML = getKeyIcon();
            }

            const info = document.createElement('div');
            info.className = 'preset-item-info';

            const title = document.createElement('div');
            title.className = 'preset-item-title';
            title.textContent = preset.title || t('settings.presetsManager.untitled', 'Untitled');

            const badge = document.createElement('span');
            badge.className = 'preset-badge';
            badge.textContent = t('settings.presetsManager.types.downloader', 'Downloader');
            title.appendChild(badge);

            const summary = document.createElement('div');
            summary.className = 'preset-item-summary';
            summary.textContent = preset.summary || t('settings.presetsManager.noSummary', 'No summary');

            info.appendChild(title);
            info.appendChild(summary);

            const actions = document.createElement('div');
            actions.className = 'preset-item-actions';

            const actionRow = document.createElement('div');
            actionRow.className = 'preset-item-action-row';

            const editBtn = document.createElement('button');
            editBtn.className = 'preset-item-btn';
            editBtn.textContent = t('settings.presetsManager.actions.edit', 'Edit');
            editBtn.addEventListener('click', () => {
                showNotification(t('settings.presetsManager.notifications.unavailable', 'Preset editor is not ready yet.'), 'info');
            });

            const exportBtn = document.createElement('button');
            exportBtn.className = 'preset-item-btn';
            exportBtn.textContent = t('settings.presetsManager.actions.export', 'Export');
            exportBtn.addEventListener('click', async () => {
                if (!window.__TAURI__?.core?.invoke) return;
                try {
                    await window.__TAURI__.core.invoke('export_preset', { id: preset.id });
                } catch (error) {
                    console.error('Preset export failed:', error);
                    showNotification(t('settings.presetsManager.notifications.exportFailed', 'Failed to export preset.'), 'error');
                }
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'preset-item-btn danger';
            deleteBtn.textContent = t('settings.presetsManager.actions.delete', 'Delete');
            deleteBtn.addEventListener('click', async () => {
                if (!window.__TAURI__?.core?.invoke) return;
                try {
                    await window.__TAURI__.core.invoke('delete_preset', { id: preset.id });
                    await refreshFromBackend();
                } catch (error) {
                    console.error('Preset delete failed:', error);
                    showNotification(t('settings.presetsManager.notifications.deleteFailed', 'Failed to delete preset.'), 'error');
                }
            });

            actionRow.appendChild(editBtn);
            actionRow.appendChild(exportBtn);
            actionRow.appendChild(deleteBtn);

            const toggleRow = document.createElement('div');
            toggleRow.className = 'preset-item-toggle';

            const toggleLabel = document.createElement('span');
            toggleLabel.textContent = t('settings.presetsManager.actions.hide', 'Hidden');

            const toggle = document.createElement('label');
            toggle.className = 'switch';
            const toggleInput = document.createElement('input');
            toggleInput.type = 'checkbox';
            toggleInput.checked = !!preset.hidden;
            const toggleSlider = document.createElement('span');
            toggleSlider.className = 'slider';
            toggle.appendChild(toggleInput);
            toggle.appendChild(toggleSlider);

            toggleInput.addEventListener('change', () => {
                preset.hidden = toggleInput.checked;
                item.classList.toggle('is-hidden', preset.hidden);
                showNotification(t('settings.presetsManager.notifications.unavailable', 'Preset visibility update is not ready yet.'), 'info');
            });

            toggleRow.appendChild(toggleLabel);
            toggleRow.appendChild(toggle);

            actions.appendChild(actionRow);
            actions.appendChild(toggleRow);

            item.appendChild(icon);
            item.appendChild(info);
            item.appendChild(actions);

            listEl.appendChild(item);
        });

        emptyEl.classList.toggle('visible', safePresets.length === 0);
        countEl.textContent = formatCountLabel(safePresets.length);
    };

    const setPresets = (presets) => {
        state.presets = Array.isArray(presets) ? presets : [];
        renderPresets(state.presets);
    };

    const refreshFromBackend = async () => {
        if (!window.__TAURI__ || !window.__TAURI__.core || typeof window.__TAURI__.core.invoke !== 'function') {
            renderPresets(state.presets);
            return;
        }
        try {
            const presets = await window.__TAURI__.core.invoke('list_presets');
            setPresets(presets);
        } catch (error) {
            console.warn('Preset list not available yet:', error);
            setPresets([]);
        }
    };

    if (addBtn) {
        addBtn.disabled = true;
        addBtn.addEventListener('click', () => {
            showNotification(t('settings.presetsManager.notifications.unavailable', 'This action is not available yet.'), 'info');
        });
    }

    if (importBtn) {
        importBtn.addEventListener('click', async () => {
            if (!window.__TAURI__?.core?.invoke) return;
            try {
                await window.__TAURI__.core.invoke('import_preset');
                await refreshFromBackend();
            } catch (error) {
                console.error('Preset import failed:', error);
                showNotification(t('settings.presetsManager.notifications.importFailed', 'Failed to import preset.'), 'error');
            }
        });
    }

    window.presetManager = {
        setPresets,
        refresh: refreshFromBackend
    };

    renderPresets(state.presets);
    refreshFromBackend();
})();