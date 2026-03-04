{
    const invoke = window.__TAURI__.core.invoke;

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
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600.207 600.207" aria-hidden="true">' +
            '<path class="tag-outline" d="M575.63 74.893c-3.354-26.271-24.041-46.96-50.312-50.312L340.285.968A58 58 0 0 0 332.926.5h-.002a57.9 57.9 0 0 0-22.184 4.4 57.9 57.9 0 0 0-18.925 12.629L17.533 291.811C6.551 302.792.503 317.392.503 332.922s6.048 30.13 17.03 41.111l208.644 208.645c10.981 10.981 25.582 17.029 41.111 17.029 15.53 0 30.13-6.048 41.111-17.029l274.281-274.28a58.45 58.45 0 0 0 13.906-22.314 58.5 58.5 0 0 0 2.654-26.157zm-23.242 203.211L278.107 552.386c-2.987 2.987-6.903 4.481-10.819 4.481s-7.831-1.494-10.819-4.481L47.825 343.74c-5.975-5.975-5.975-15.662 0-21.637L322.107 47.822a15.3 15.3 0 0 1 12.756-4.358l185.033 23.612a15.3 15.3 0 0 1 13.24 13.24l23.611 185.033a15.3 15.3 0 0 1-4.359 12.755"/>' +
            '<path class="tag-outline" d="M267.289 600.207c-15.663 0-30.389-6.1-41.465-17.176L17.18 374.387C6.104 363.311.003 348.585.003 332.922s6.1-30.389 17.176-41.464L291.461 17.176a58.4 58.4 0 0 1 19.088-12.738A58.4 58.4 0 0 1 332.923 0c2.471 0 4.969.159 7.425.472l185.033 23.612c26.495 3.381 47.362 24.248 50.745 50.745l23.611 185.033a59 59 0 0 1-2.678 26.382 58.95 0 0 1-14.025 22.506L308.753 583.03c-11.075 11.077-25.801 17.177-41.464 17.177M332.925 1a57.4 57.4 0 0 0-21.995 4.362 57.4 57.4 0 0 0-18.762 12.521L17.886 292.165c-10.887 10.886-16.883 25.36-16.883 40.757S7 362.793 17.887 373.68l208.644 208.645c10.887 10.887 25.362 16.883 40.758 16.883s29.871-5.996 40.758-16.883l274.281-274.28a57.9 57.9 0 0 0 13.786-22.123 58 58 0 0 0 2.632-25.932L575.134 74.957c-3.324-26.046-23.836-46.557-49.88-49.88L340.221 1.464A58 58 0 0 0 332.925 1m-65.636 556.367c-4.22 0-8.188-1.644-11.172-4.628L47.472 344.094c-2.984-2.984-4.627-6.951-4.627-11.172s1.644-8.188 4.627-11.172L321.753 47.468c3.411-3.411 8.361-5.11 13.173-4.5L519.959 66.58a15.8 15.8 0 0 1 13.673 13.672l23.611 185.033c.614 4.816-1.068 9.74-4.502 13.172l-274.28 274.282a15.7 15.7 0 0 1-11.172 4.628m65.636-513.526c-3.896 0-7.71 1.58-10.465 4.334L48.179 322.457c-2.795 2.795-4.334 6.512-4.334 10.465s1.54 7.67 4.334 10.465l208.645 208.646a14.7 14.7 0 0 0 10.465 4.335 14.7 14.7 0 0 0 10.465-4.335l274.281-274.281a14.89 14.89 0 0 0 4.217-12.338L532.64 80.379a14.8 14.8 0 0 0-12.808-12.807L334.799 43.96a15 15 0 0 0-1.874-.119"/>' +
            '<path class="tag-dot" d="M425.609 107.846c-17.83 0-34.594 6.944-47.203 19.551-12.609 12.61-19.551 29.373-19.551 47.204s6.943 34.595 19.551 47.203c12.609 12.608 29.373 19.552 47.203 19.552s34.596-6.944 47.203-19.552c12.609-12.608 19.553-29.373 19.553-47.203s-6.943-34.594-19.553-47.202c-12.607-12.609-29.373-19.553-47.203-19.553m16.912 83.666c-4.67 4.669-10.791 7.004-16.912 7.004s-12.24-2.335-16.91-7.004c-9.34-9.339-9.34-24.481 0-33.821 4.67-4.669 10.789-7.004 16.91-7.004s12.24 2.335 16.912 7.004c9.338 9.339 9.338 24.482 0 33.821"/>' +
            '<path class="tag-dot" d="M425.609 241.856c-17.964 0-34.853-6.996-47.557-19.699-12.702-12.703-19.697-29.592-19.697-47.557s6.995-34.854 19.697-47.557c12.704-12.702 29.594-19.698 47.557-19.698 17.966 0 34.854 6.996 47.557 19.699 12.703 12.702 19.699 29.591 19.699 47.556s-6.996 34.854-19.699 47.557-29.591 19.699-47.557 19.699m0-133.51c-17.696 0-34.334 6.892-46.85 19.405-12.513 12.514-19.404 29.152-19.404 46.85 0 17.697 6.892 34.335 19.404 46.85 12.515 12.514 29.153 19.406 46.85 19.406s34.337-6.892 46.85-19.406c12.515-12.513 19.406-29.151 19.406-46.85 0-17.697-6.892-34.335-19.406-46.849s-29.152-19.406-46.85-19.406m0 90.671c-6.521 0-12.652-2.54-17.264-7.151s-7.151-10.743-7.151-17.264 2.54-12.652 7.151-17.264c4.611-4.611 10.743-7.151 17.264-7.151s12.652 2.54 17.266 7.151c9.518 9.52 9.518 25.009 0 34.528a24.26 24.26 0 0 1-17.266 7.151m0-47.83a23.27 23.27 0 0 0-16.557 6.858c-4.423 4.423-6.858 10.303-6.858 16.557s2.436 12.135 6.858 16.557 10.303 6.858 16.557 6.858a23.27 23.27 0 0 0 16.559-6.858c9.128-9.129 9.128-23.985 0-33.114a23.27 23.27 0 0 0-16.559-6.858"/>' +
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
            text.textContent = label;
            btn.appendChild(icon);
            btn.appendChild(text);
            btn.setAttribute('data-i18n-lock', 'true');
        });

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
            setupListeners();
            await loadRequirementVersions();

        } catch (e) {
            console.error("Failed to load config:", e);
        }
    }

    function updateVersionNote(noteId, version) {
        const el = document.getElementById(noteId);
        if (!el) return;
        const raw = String(version || '').trim();
        const label = raw ? raw : 'unknown';
        el.textContent = `Current version: ${label}`;
    }

    async function loadRequirementVersions() {
        try {
            const versions = await invoke('get_requirements_versions');
            updateVersionNote(versionNoteIds['pulsar'], versions?.['pulsar']);
            updateVersionNote(versionNoteIds['pulsar-bridge'], versions?.['pulsar-bridge']);
            updateVersionNote(versionNoteIds['ffmpeg'], versions?.['ffmpeg']);
        } catch (e) {
            console.error('Failed to load requirement versions:', e);
        }
    }

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