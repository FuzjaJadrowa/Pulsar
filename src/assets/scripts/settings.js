{
    const invoke = window.__TAURI__.core.invoke;
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

    const idMap = {
        'theme': 'theme',
        'language': 'language',
        'system_notifications': 'system_notifications',
        'advanced_mode': 'advanced_mode',
        'idle-anim-toggle': 'idle_animation',
        'update_app': 'update_app',
        'update_app_cooldown_minutes': 'update_app_cooldown_minutes',
        'update_ytdlp': 'update_ytdlp',
        'update_ffmpeg': 'update_ffmpeg',
        'ffmpeg_hwaccel': 'ffmpeg_hwaccel',
        'cookies_browser': 'cookies_browser',
        'maximum_concurrent_processes': 'maximum_concurrent_processes',
        'maximum_search_results': 'maximum_search_results',
        'title_template': 'title_template'
    };

    const versionNoteIds = {
        'pulsar': 'update_app_note',
        'pulsar-bridge': 'update_bridge_note',
        'ffmpeg': 'update_ffmpeg_note'
    };

    const numberConstraints = {
        update_app_cooldown_minutes: { min: 10, max: 500, fallback: 30 },
        maximum_concurrent_processes: { min: 1, max: 10, fallback: 3 },
        maximum_search_results: { min: 1, max: 50, fallback: 10 }
    };

    const clampNumber = (value, min, max, fallback) => {
        if (!Number.isFinite(value)) return fallback;
        if (value < min || value > max) return fallback;
        return value;
    };

    const DEFAULT_TITLE_TEMPLATE = '%(title)s [%(id)s]';
    let titleConstructorReady = false;
    let titleSaveTimer = null;
    let updateAppLockedForDeb = false;

    const scheduleTitleSave = () => {
        if (titleSaveTimer) window.clearTimeout(titleSaveTimer);
        titleSaveTimer = window.setTimeout(() => {
            saveSettings();
        }, 300);
    };

    const initTitleConstructor = (initialTemplate) => {
        if (titleConstructorReady) return;

        const input = document.getElementById('title-template-input');
        const hidden = document.getElementById('title_template');
        const canvas = document.getElementById('title-canvas');
        if (!input || !hidden || !canvas) return;

        const tags = Array.from(canvas.querySelectorAll('.title-tag'));
        if (!tags.length) return;

        const getTagIconMarkup = () => (
            '<svg viewBox="0 0 24 24" aria-hidden="true">' +
            '<path class="tag-outline" d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12.41V2h10.41l8.18 8.18a2 2 0 0 1 0 2.83z"/>' +
            '<circle class="tag-dot" cx="7.5" cy="7.5" r="1.5"/>' +
            '</svg>'
        );

        const tokenMap = new Map();
        tags.forEach((btn) => {
            const token = String(btn.dataset.token || '').trim();
            if (!token) return;
            const label = String(btn.textContent || '').trim();
            tokenMap.set(token, label);
            btn.textContent = '';
            const icon = document.createElement('span');
            icon.className = 'title-tag-icon';
            icon.innerHTML = getTagIconMarkup();
            const text = document.createElement('span');
            text.className = 'title-tag-label';
            text.textContent = label;
            btn.appendChild(icon);
            btn.appendChild(text);
            btn.setAttribute('data-i18n-lock', 'true');
        });

        const refreshTitleConstructorI18n = () => {
            if (!window.i18n || typeof window.i18n.t !== 'function') return;
            tags.forEach((btn) => {
                const token = String(btn.dataset.token || '').trim();
                if (!token) return;
                const labelEl = btn.querySelector('.title-tag-label');
                const fallback = labelEl ? String(labelEl.textContent || '').trim() : token;
                const key = btn.getAttribute('data-i18n');
                const label = key ? window.i18n.t(key, fallback) : fallback;
                tokenMap.set(token, label);
                if (labelEl) labelEl.textContent = label;
            });

            input.querySelectorAll('.title-pill').forEach((pill) => {
                const token = String(pill.dataset.token || '').trim();
                if (!token) return;
                const label = tokenMap.get(token) || token;
                const labelEl = pill.querySelector('.title-pill-label');
                if (labelEl) labelEl.textContent = label;
            });
        };

        window.refreshTitleConstructorI18n = refreshTitleConstructorI18n;

        const markTokenUsed = (token, used) => {
            const btn = tags.find((item) => item.dataset.token === token);
            if (!btn) return;
            const wasUsed = btn.classList.contains('used');
            btn.classList.toggle('used', used);
            btn.setAttribute('aria-disabled', used ? 'true' : 'false');
            btn.disabled = used;
            if (!used && wasUsed) {
                btn.classList.remove('transfer-out');
                btn.classList.remove('transfer-in');
                void btn.offsetWidth;
                btn.classList.add('transfer-in');
            }
        };

        const syncTokenUsage = (token) => {
            const stillUsed = !!input.querySelector(`.title-pill[data-token="${token}"]`);
            markTokenUsed(token, stillUsed);
        };

        const syncAllTokenUsage = () => {
            const usedTokens = new Set();
            input.querySelectorAll('.title-pill').forEach((pill) => {
                const token = String(pill.dataset.token || '').trim();
                if (token) usedTokens.add(token);
            });
            tags.forEach((btn) => {
                const token = String(btn.dataset.token || '').trim();
                if (!token) return;
                markTokenUsed(token, usedTokens.has(token));
            });
        };

        const ZERO_WIDTH = '\u200b';

        const cleanText = (value) => value.replace(/\u200b/g, '');

        const hasContent = () => {
            const rawText = cleanText(input.textContent || '').trim();
            return rawText !== '' || !!input.querySelector('.title-pill');
        };

        const stripZeroWidthSpaces = () => {
            const nodes = Array.from(input.childNodes);
            nodes.forEach((node) => {
                if (node.nodeType !== Node.TEXT_NODE) return;
                const cleaned = cleanText(node.nodeValue || '');
                if (cleaned === '') {
                    node.remove();
                }
            });
        };

        const ensureEmptyAnchor = () => {
            if (hasContent()) return;
            // Keep a caret target when the editable field has no visible content.
            if (
                input.childNodes.length === 1 &&
                input.firstChild &&
                input.firstChild.nodeType === Node.TEXT_NODE &&
                input.firstChild.nodeValue === ZERO_WIDTH
            ) {
                return;
            }
            input.innerHTML = '';
            input.appendChild(document.createTextNode(ZERO_WIDTH));
        };

        const setEmptyState = () => {
            if (hasContent()) {
                input.dataset.empty = 'false';
                stripZeroWidthSpaces();
            } else {
                input.dataset.empty = 'true';
                ensureEmptyAnchor();
            }
        };

        const ensureSelectionOutsidePill = () => {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return;
            const anchor = selection.anchorNode;
            if (!anchor) return;
            const anchorEl = anchor.nodeType === Node.ELEMENT_NODE ? anchor : anchor.parentElement;
            if (!anchorEl) return;
            const pill = anchorEl.closest('.title-pill');
            if (!pill || !input.contains(pill)) return;
            const range = document.createRange();
            range.setStartAfter(pill);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        };

        const createPill = (token) => {
            const pill = document.createElement('span');
            pill.className = 'title-pill pill-in';
            pill.dataset.token = token;
            pill.setAttribute('contenteditable', 'false');
            pill.setAttribute('draggable', 'false');
            const icon = document.createElement('span');
            icon.className = 'title-pill-icon';
            icon.innerHTML = getTagIconMarkup();
            const text = document.createElement('span');
            text.className = 'title-pill-label';
            text.textContent = tokenMap.get(token) || token;
            pill.appendChild(icon);
            pill.appendChild(text);
            pill.addEventListener('click', () => {
                pill.classList.add('pill-out');
                scheduleTitleSave();
                setTimeout(() => {
                    pill.remove();
                    syncTokenUsage(token);
                    setEmptyState();
                    updateHidden();
                }, 160);
            });
            return pill;
        };

        const insertAtCursor = (node) => {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) {
                input.appendChild(node);
                return;
            }
            const range = selection.getRangeAt(0);
            if (!input.contains(range.commonAncestorContainer)) {
                input.appendChild(node);
                return;
            }
            const container = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
                ? range.commonAncestorContainer
                : range.commonAncestorContainer.parentElement;
            if (container && container.classList && container.classList.contains('title-pill')) {
                range.setStartAfter(container);
                range.setEndAfter(container);
            }
            range.deleteContents();
            range.insertNode(node);
            range.setStartAfter(node);
            range.setEndAfter(node);
            selection.removeAllRanges();
            selection.addRange(range);
        };

        const renderFromTemplate = (template) => {
            const value = String(template || '').trim() || DEFAULT_TITLE_TEMPLATE;
            input.innerHTML = '';
            tags.forEach((btn) => markTokenUsed(btn.dataset.token, false));
            const tokenRegex = /%\([a-zA-Z0-9_]+\)s/g;
            let lastIndex = 0;
            let match;
            while ((match = tokenRegex.exec(value)) !== null) {
                const token = match[0];
                if (match.index > lastIndex) {
                    input.appendChild(document.createTextNode(value.slice(lastIndex, match.index)));
                }
                if (tokenMap.has(token)) {
                    const pill = createPill(token);
                    input.appendChild(pill);
                    markTokenUsed(token, true);
                } else {
                    input.appendChild(document.createTextNode(token));
                }
                lastIndex = match.index + token.length;
            }
            if (lastIndex < value.length) {
                input.appendChild(document.createTextNode(value.slice(lastIndex)));
            }
            updateHidden();
            setEmptyState();
        };

        const updateHidden = () => {
            const parts = [];
            input.childNodes.forEach((node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    parts.push(cleanText(node.nodeValue || ''));
                    return;
                }
                if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('title-pill')) {
                    parts.push(node.dataset.token || '');
                }
            });
            const output = parts.join('');
            hidden.value = output;
            hidden.dispatchEvent(new Event('change'));
            syncAllTokenUsage();
        };

        const replaceTypedTokens = () => {
            const walker = document.createTreeWalker(input, NodeFilter.SHOW_TEXT, null);
            const tokenRegex = /%\([a-zA-Z0-9_]+\)s/g;
            const nodes = [];
            while (walker.nextNode()) nodes.push(walker.currentNode);
            nodes.forEach((textNode) => {
                const text = cleanText(textNode.nodeValue || '');
                let match;
                let lastIndex = 0;
                const frag = document.createDocumentFragment();
                let replaced = false;
                tokenRegex.lastIndex = 0;
                while ((match = tokenRegex.exec(text)) !== null) {
                    const token = match[0];
                    // Ignore unknown placeholders and keep them as plain text.
                    if (!tokenMap.has(token)) continue;
                    if (match.index > lastIndex) {
                        frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
                    }
                    if (input.querySelector(`.title-pill[data-token="${token}"]`)) {
                        frag.appendChild(document.createTextNode(token));
                    } else {
                        const pill = createPill(token);
                        frag.appendChild(pill);
                        markTokenUsed(token, true);
                    }
                    lastIndex = match.index + token.length;
                    replaced = true;
                }
                if (replaced) {
                    if (lastIndex < text.length) {
                        frag.appendChild(document.createTextNode(text.slice(lastIndex)));
                    }
                    textNode.parentNode.replaceChild(frag, textNode);
                }
            });
        };

        const replaceTypedTokenAtCursor = () => {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return;
            const range = selection.getRangeAt(0);
            if (!input.contains(range.endContainer)) return;
            if (range.endContainer.nodeType !== Node.TEXT_NODE) return;
            const textNode = range.endContainer;
            const text = cleanText(textNode.nodeValue || '');
            const caretOffset = range.endOffset;
            const tokenRegex = /%\([a-zA-Z0-9_]+\)s/g;
            let match;
            let matchedToken = null;
            let matchedIndex = null;
            while ((match = tokenRegex.exec(text)) !== null) {
                if (match.index + match[0].length === caretOffset) {
                    matchedToken = match[0];
                    matchedIndex = match.index;
                }
            }
            if (!matchedToken || matchedIndex === null) return;
            if (!tokenMap.has(matchedToken)) return;
            if (input.querySelector(`.title-pill[data-token="${matchedToken}"]`)) return;

            const before = text.slice(0, matchedIndex);
            const after = text.slice(matchedIndex + matchedToken.length);
            const frag = document.createDocumentFragment();
            if (before) frag.appendChild(document.createTextNode(before));
            const pill = createPill(matchedToken);
            frag.appendChild(pill);
            if (after) frag.appendChild(document.createTextNode(after));
            textNode.parentNode.replaceChild(frag, textNode);
            markTokenUsed(matchedToken, true);

            const newRange = document.createRange();
            newRange.setStartAfter(pill);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
        };

        tags.forEach((btn) => {
            btn.addEventListener('click', () => {
                const token = btn.dataset.token;
                if (!token || btn.classList.contains('used')) return;
                btn.classList.add('transfer-out');
                const pill = createPill(token);
                insertAtCursor(pill);
                markTokenUsed(token, true);
                setEmptyState();
                updateHidden();
                scheduleTitleSave();
            });
        });

        input.addEventListener('input', () => {
            stripZeroWidthSpaces();
            replaceTypedTokenAtCursor();
            setEmptyState();
            updateHidden();
            scheduleTitleSave();
            ensureSelectionOutsidePill();
        });

        input.addEventListener('mousedown', (event) => {
            if (event.target && event.target.closest && event.target.closest('.title-pill')) {
                event.preventDefault();
            }
        });

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
            }
            if (event.key === 'Backspace') {
                const selection = window.getSelection();
                if (selection && selection.rangeCount) {
                    const isEmpty = cleanText(input.textContent || '').trim() === '' && !input.querySelector('.title-pill');
                    if (isEmpty) {
                        event.preventDefault();
                    }
                }
            }
        });
        input.addEventListener('focus', () => {
            setEmptyState();
            if (!hasContent()) {
                const selection = window.getSelection();
                if (selection) {
                    const range = document.createRange();
                    range.selectNodeContents(input);
                    range.collapse(false);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            }
        });
        input.addEventListener('drop', (event) => {
            event.preventDefault();
        });
        input.addEventListener('beforeinput', (event) => {
            if (event.target && event.target.closest && event.target.closest('.title-pill')) {
                event.preventDefault();
            }
        });
        input.addEventListener('mouseup', () => ensureSelectionOutsidePill());
        input.addEventListener('keyup', () => ensureSelectionOutsidePill());

        input.addEventListener('paste', (event) => {
            event.preventDefault();
            const text = (event.clipboardData || window.clipboardData)?.getData('text') || '';
            if (text) {
                insertAtCursor(document.createTextNode(text));
                stripZeroWidthSpaces();
                replaceTypedTokens();
                setEmptyState();
                updateHidden();
                scheduleTitleSave();
            }
        });

        input.addEventListener('blur', () => {
            const trimmed = cleanText(input.textContent || '').trim();
            if (!trimmed && !input.querySelector('.title-pill')) {
                tags.forEach((btn) => markTokenUsed(btn.dataset.token, false));
                renderFromTemplate(DEFAULT_TITLE_TEMPLATE);
                scheduleTitleSave();
            }
        });

        renderFromTemplate(initialTemplate || hidden.value || DEFAULT_TITLE_TEMPLATE);
        titleConstructorReady = true;
    };

    function refreshCustomSelect(selectId) {
        const selectEl = document.getElementById(selectId);
        if (!selectEl) return;

        const wrapper = selectEl.nextElementSibling;
        if (wrapper && wrapper.classList.contains('select-wrapper')) {
            const head = wrapper.querySelector('.select-head');
            const list = wrapper.querySelector('.select-list');

            if (head && selectEl.selectedIndex >= 0) {
                head.innerText = selectEl.options[selectEl.selectedIndex].text;

                const items = list.querySelectorAll('.select-item');
                items.forEach((item, index) => {
                    if (index === selectEl.selectedIndex) {
                        item.classList.add('selected');
                    } else {
                        item.classList.remove('selected');
                    }
                });
            }
        }
    }

    async function saveSettings() {
        const config = {};

        for (const [id, key] of Object.entries(idMap)) {
            const el = document.getElementById(id);
            if(!el) continue;

            if (el.type === 'checkbox') {
                config[key] = el.checked;
            } else if (el.type === 'number') {
                const parsed = parseInt(el.value, 10);
                const constraints = numberConstraints[key];
                if (constraints) {
                    const clamped = clampNumber(parsed, constraints.min, constraints.max, constraints.fallback);
                    config[key] = clamped;
                    el.value = clamped;
                } else {
                    config[key] = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
                }
            } else {
                config[key] = el.value;
            }
        }

        const radio = document.querySelector('input[name="close_behavior"]:checked');
        config['close_behavior'] = radio ? radio.value : 'hide';
        if (updateAppLockedForDeb) {
            config.update_app = false;
        }

        if (window.applyTheme && config.theme) {
            window.applyTheme(config.theme);
        }

        console.log("Saving config:", config);
        await invoke('save_config', { newConfig: config });
        if (window.queueManager && typeof window.queueManager.refreshConfig === 'function') {
            window.queueManager.refreshConfig();
        }
        window.dispatchEvent(new CustomEvent('pulsar-config-updated', { detail: config }));
    }

    async function applyDistributionLocks() {
        const updateAppInput = document.getElementById('update_app');
        if (!updateAppInput) return false;
        const pulsarUpdateCheckBtn = document.querySelector('.update-check-btn[data-update-check="pulsar"]');

        let channel = 'default';
        try {
            channel = String(await invoke('get_distribution_channel')).trim().toLowerCase() || 'default';
        } catch (_) {
            channel = 'default';
        }

        updateAppLockedForDeb = channel === 'deb';
        const switchLabel = updateAppInput.closest('label.switch');

        if (!updateAppLockedForDeb) {
            updateAppInput.disabled = false;
            if (switchLabel) switchLabel.classList.remove('is-disabled');
            if (pulsarUpdateCheckBtn) pulsarUpdateCheckBtn.disabled = false;
            return false;
        }

        const wasChecked = !!updateAppInput.checked;
        updateAppInput.checked = false;
        updateAppInput.disabled = true;
        if (switchLabel) switchLabel.classList.add('is-disabled');
        if (pulsarUpdateCheckBtn) pulsarUpdateCheckBtn.disabled = true;
        return wasChecked;
    }

    async function loadSettings() {
        try {
            const config = await invoke('get_config');
            console.log("Loaded config from Rust:", config);

            for (const [id, key] of Object.entries(idMap)) {
                const el = document.getElementById(id);
                if (el && config[key] !== undefined) {
                    if (el.type === 'checkbox') {
                        el.checked = config[key];
                    } else {
                        if (el.type === 'number') {
                            const constraints = numberConstraints[key];
                            const parsed = parseInt(config[key], 10);
                            if (constraints) {
                                const clamped = clampNumber(parsed, constraints.min, constraints.max, constraints.fallback);
                                el.value = clamped;
                            } else {
                                el.value = config[key];
                            }
                        } else {
                            el.value = config[key];
                        }
                        if (el.tagName === 'SELECT') {
                            refreshCustomSelect(id);
                        }
                    }
                }
            }

            if (config['close_behavior']) {
                const radio = document.querySelector(`input[name="close_behavior"][value="${config['close_behavior']}"]`);
                if (radio) radio.checked = true;
            }

            if (window.applyTheme && config.theme) {
                window.applyTheme(config.theme, { animate: false });
            }

            initTitleConstructor(config?.title_template);
            const lockChanged = await applyDistributionLocks();
            setupListeners();
            setupUpdateCheckButtons();
            await loadRequirementVersions();
            try {
                await invoke('refresh_acceleration_info');
            } catch (e) {
                console.warn('Acceleration refresh failed:', e);
            }
            if (lockChanged) {
                await saveSettings();
            }

        } catch (e) {
            console.error("Failed to load config:", e);
        }
    }

    function setupUpdateCheckButtons() {
        const buttons = document.querySelectorAll('.update-check-btn');
        buttons.forEach((btn) => {
            btn.onclick = async () => {
                const target = String(btn.dataset.updateCheck || '').trim();
                if (!target || typeof window.runRequirementCheck !== 'function') return;
                if (btn.disabled) return;
                btn.disabled = true;
                try {
                    await window.runRequirementCheck(target);
                    await loadRequirementVersions();
                } finally {
                    btn.disabled = false;
                }
            };
        });
    }

    let latestRequirementVersions = null;

    function updateVersionNote(noteId, version) {
        const el = document.getElementById(noteId);
        if (!el) return;
        const raw = String(version || '').trim();
        const label = raw ? raw : 'unknown';
        el.textContent = t('settings.currentVersion', 'Current version: {version}', { version: label });
    }

    async function loadRequirementVersions() {
        try {
            const versions = await invoke('get_requirements_versions');
            latestRequirementVersions = versions || {};
            updateVersionNote(versionNoteIds['pulsar'], latestRequirementVersions?.['pulsar']);
            updateVersionNote(versionNoteIds['pulsar-bridge'], latestRequirementVersions?.['pulsar-bridge']);
            updateVersionNote(versionNoteIds['ffmpeg'], latestRequirementVersions?.['ffmpeg']);
        } catch (e) {
            console.error('Failed to load requirement versions:', e);
        }
    }

    window.addEventListener('pulsar-config-updated', (event) => {
        if (!event?.detail || typeof event.detail.language === 'undefined') return;
        updateVersionNote(versionNoteIds['pulsar'], latestRequirementVersions?.['pulsar']);
        updateVersionNote(versionNoteIds['pulsar-bridge'], latestRequirementVersions?.['pulsar-bridge']);
        updateVersionNote(versionNoteIds['ffmpeg'], latestRequirementVersions?.['ffmpeg']);
    });

    window.addEventListener('pulsar-locale-updated', (event) => {
        if (!event?.detail || typeof event.detail.language === 'undefined') return;
        updateVersionNote(versionNoteIds['pulsar'], latestRequirementVersions?.['pulsar']);
        updateVersionNote(versionNoteIds['pulsar-bridge'], latestRequirementVersions?.['pulsar-bridge']);
        updateVersionNote(versionNoteIds['ffmpeg'], latestRequirementVersions?.['ffmpeg']);
    });

    function setupListeners() {
        const inputs = document.querySelectorAll('select, input');
        inputs.forEach(input => {
            input.removeEventListener('change', saveSettings);
            input.addEventListener('change', saveSettings);
        });
    }

    if (window.initCustomSelects) {
        window.initCustomSelects();
    }

    loadSettings();

    const supportBtn = document.getElementById('support-btn');
    if (supportBtn) {
        supportBtn.onclick = async () => {
            try {
                await window.__TAURI__.opener.openUrl('https://www.patreon.com/FuzjaJadrowa');
            } catch (error) {
                console.error('Failed to open support link:', error);
            }
        };
    }
}