const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;
const { getCurrentWindow } = window.__TAURI__.window;
const appWindow = getCurrentWindow();

let isAppLoaded = false;
let currentPageIndex = 0;
let currentPageName = null;
let queueVisible = false;
const loadedPages = {};
let queueOutsideBound = false;

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('minimize-btn')?.addEventListener('click', () => appWindow.minimize());
    document.getElementById('maximize-btn')?.addEventListener('click', () => appWindow.toggleMaximize());
    document.getElementById('close-btn')?.addEventListener('click', () => appWindow.close());

    await setupSplashListeners();
    await setupBridgeListeners();
    checkConnection();

    window.initCustomSelects();
    document.addEventListener('click', window.closeAllSelects);

    invoke('run_splash_checks').catch(err => {
        console.error("Failed to invoke splash checks:", err);
        finishSplash();
    });
});

const splashScreen = document.getElementById('splash-screen');
const appContent = document.getElementById('app-content');
const statusLabel = document.getElementById('splash-status');
const progressLabel = document.getElementById('splash-progress');
const skipBtn = document.getElementById('splash-skip-btn');

function finishSplash() {
    if (isAppLoaded) return;
    isAppLoaded = true;

    if (splashScreen) {
        splashScreen.classList.add('hidden');
        setTimeout(() => {
            splashScreen.style.display = 'none';
        }, 500);
    }

    if (appContent) {
        appContent.style.opacity = '1';
    }

    loadPage('downloader', 0);
}

if (skipBtn) {
    skipBtn.addEventListener('click', () => {
        finishSplash();
    });
}

function checkConnection() {
    if (!navigator.onLine) {
        window.notifier.show("Error", "No internet connection. Some app features may be unavailable.", "error", true);
    }

    window.addEventListener('offline', () => {
        window.notifier.show("Error", "Internet connection lost.", "error", false);
    });

    window.addEventListener('online', () => {
        window.notifier.show("Success", "Internet connection restored.", "success", false);
    });
}

async function setupSplashListeners() {
    try {
        await listen('splash-status', (event) => {
            const payload = event.payload;
            if (statusLabel) statusLabel.innerText = payload.status;

            if (skipBtn) {
                if (payload.can_skip) {
                    skipBtn.style.display = 'inline-block';
                } else {
                    skipBtn.style.display = 'none';
                }
            }

            if (!payload.is_downloading && progressLabel) {
                progressLabel.innerText = "";
            }
        });

        await listen('splash-progress', (event) => {
            const payload = event.payload;
            if (payload.progress && progressLabel) {
                progressLabel.innerText = payload.progress;
            }
        });

        await listen('splash-finished', () => {
            finishSplash();
        });
    } catch (error) {
        console.error("Splash events error:", error);
        setTimeout(finishSplash, 2000);
    }
}

async function setupBridgeListeners() {
    try {
        await listen('download-event', (event) => {
            console.log("Bridge Event:", event.payload);
        });
    } catch (error) {
        console.error("Bridge listener error:", error);
    }
}

window.initCustomSelects = function() {
    const selects = document.querySelectorAll('select.custom-select');
    selects.forEach(origSelect => {
        if (origSelect.nextElementSibling && origSelect.nextElementSibling.classList.contains('select-wrapper')) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'select-wrapper';
        if (origSelect.style.width) wrapper.style.width = origSelect.style.width;

        const head = document.createElement('div');
        head.className = 'select-head';
        if (origSelect.options.length > 0) {
            head.innerText = origSelect.options[origSelect.selectedIndex].text;
        }

        const list = document.createElement('div');
        list.className = 'select-list';

        Array.from(origSelect.options).forEach(opt => {
            const item = document.createElement('div');
            item.className = 'select-item';
            if(opt.selected) item.classList.add('selected');
            item.innerText = opt.text;
            item.addEventListener('click', () => {
                head.innerText = opt.text;
                list.querySelectorAll('.select-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                origSelect.value = opt.value;
                origSelect.dispatchEvent(new Event('change'));
                window.closeAllSelects();
            });
            list.appendChild(item);
        });

        head.addEventListener('click', (e) => {
            e.stopPropagation();
            const wasOpen = head.classList.contains('open');
            window.closeAllSelects();
            if (!wasOpen) {
                const headRect = head.getBoundingClientRect();
                const optionsCount = origSelect.options.length;
                const estimatedHeight = Math.min(optionsCount * 40, 240);
                const spaceBelow = window.innerHeight - headRect.bottom;
                const spaceAbove = headRect.top;
                const openUp = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

                list.classList.toggle('open-up', openUp);
                head.classList.toggle('open-up', openUp);
                head.classList.add('open');
                list.classList.add('open');

                wrapper.classList.add('select-open');
                const hostCard = wrapper.closest('.settings-section-card');
                if (hostCard) hostCard.classList.add('select-open-card');
            }
        });

        wrapper.appendChild(head);
        wrapper.appendChild(list);
        origSelect.parentNode.insertBefore(wrapper, origSelect.nextSibling);

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((m) => {
                if (m.attributeName === 'disabled') {
                    if (origSelect.disabled) { head.style.opacity = '0.5'; head.style.pointerEvents = 'none'; }
                    else { head.style.opacity = '1'; head.style.pointerEvents = 'auto'; }
                }
            });
        });
        observer.observe(origSelect, { attributes: true });

        if (origSelect.disabled) { head.style.opacity = '0.5'; head.style.pointerEvents = 'none'; }
    });
};

window.closeAllSelects = function() {
    document.querySelectorAll('.select-head').forEach(h => h.classList.remove('open'));
    document.querySelectorAll('.select-list').forEach(l => l.classList.remove('open'));
    document.querySelectorAll('.select-wrapper').forEach(w => w.classList.remove('select-open'));
    document.querySelectorAll('.settings-section-card').forEach(c => c.classList.remove('select-open-card'));
};

async function loadPage(pageName, pageIndex) {
    if (currentPageName === pageName) return;

    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    const navBtn = document.getElementById(`nav-${pageName}`);
    if (navBtn) navBtn.classList.add('active');

    const contentArea = document.getElementById('content-area');
    const previousView = contentArea ? contentArea.querySelector('.view-container.active-view') : null;
    const previousIndex = currentPageIndex;
    const hasPrevious = !!previousView;
    const direction = hasPrevious
        ? (pageIndex > previousIndex ? 'right' : 'left')
        : 'right';

    let targetView = document.getElementById(`view-${pageName}`);

    if (loadedPages[pageName]) {
        targetView = document.getElementById(`view-${pageName}`);
    } else {
        try {
            const response = await fetch(`app/${pageName}.html`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const html = await response.text();

            const viewContainer = document.createElement('div');
            viewContainer.id = `view-${pageName}`;
            viewContainer.className = 'view-container';

            viewContainer.innerHTML = html;
            contentArea.appendChild(viewContainer);

            const scripts = viewContainer.querySelectorAll("script");
            scripts.forEach(oldScript => {
                const newScript = document.createElement("script");
                Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                newScript.appendChild(document.createTextNode(oldScript.innerHTML));

                oldScript.parentNode.removeChild(oldScript);
                viewContainer.appendChild(newScript);
            });

            loadedPages[pageName] = true;
            targetView = viewContainer;

        } catch (err) {
            console.error('Failed to load page:', err);
            return;
        }
    }

    if (!targetView) return;

    if (!hasPrevious || previousView === targetView) {
        if (previousView && previousView !== targetView) {
            previousView.classList.remove('active-view');
        }
        targetView.classList.add('active-view');
        targetView.style.transform = '';
        targetView.style.opacity = '';
        setTimeout(() => window.initCustomSelects(), 50);
    } else {
        const incomingFrom = direction === 'right' ? '100%' : '-100%';
        const outgoingTo = direction === 'right' ? '-100%' : '100%';

        targetView.classList.add('active-view');
        targetView.style.transform = `translateX(${incomingFrom})`;
        targetView.style.opacity = '0';

        const outgoingAnim = previousView.animate([
            { transform: 'translateX(0%)', opacity: 1 },
            { transform: `translateX(${outgoingTo})`, opacity: 0 }
        ], { duration: 360, easing: 'ease-in-out', fill: 'forwards' });

        const incomingAnim = targetView.animate([
            { transform: `translateX(${incomingFrom})`, opacity: 0 },
            { transform: 'translateX(0%)', opacity: 1 }
        ], { duration: 360, easing: 'ease-in-out', fill: 'forwards' });

        await Promise.allSettled([
            outgoingAnim.finished,
            incomingAnim.finished
        ]);

        previousView.classList.remove('active-view');
        previousView.style.transform = '';
        previousView.style.opacity = '';
        targetView.style.transform = '';
        targetView.style.opacity = '';
        setTimeout(() => window.initCustomSelects(), 50);
    }

    currentPageIndex = pageIndex;
    currentPageName = pageName;
}

window.toggleQueue = async function() {
    await window.setQueuePanelVisible(!queueVisible);
};

window.setQueuePanelVisible = async function(visible) {
    const panel = document.getElementById('queue-panel');
    const btn = document.getElementById('btn-queue');
    if (!panel || !btn) return;

    if (visible && !queueVisible) {
        if(panel.innerHTML.trim() === "") {
            try {
                const res = await fetch('app/queue.html');
                if(res.ok) panel.innerHTML = await res.text();
            } catch(e) { console.error("Error loading queue:", e); }
        }
        panel.style.display = 'block';
        if (window.queueManager && window.queueManager.bindPanel) {
            window.queueManager.bindPanel(panel);
        }
        panel.animate([{opacity: 0, transform: 'translateY(-20px)'}, {opacity: 1, transform: 'translateY(0)'}], {duration: 250, easing: 'ease-out'});
        btn.classList.add('active');
        queueVisible = true;
    } else if (!visible && queueVisible) {
        const anim = panel.animate([{opacity: 1}, {opacity: 0, transform: 'translateY(-20px)'}], {duration: 200});
        anim.onfinish = () => panel.style.display = 'none';
        btn.classList.remove('active');
        queueVisible = false;
    }

    if (!queueOutsideBound) {
        document.addEventListener('mousedown', (event) => {
            if (!queueVisible) return;
            const queuePanel = document.getElementById('queue-panel');
            const queueBtn = document.getElementById('btn-queue');
            const clickedInsidePanel = queuePanel && queuePanel.contains(event.target);
            const clickedToggleBtn = queueBtn && queueBtn.contains(event.target);
            if (!clickedInsidePanel && !clickedToggleBtn) {
                window.setQueuePanelVisible(false);
            }
        });
        queueOutsideBound = true;
    }
};

