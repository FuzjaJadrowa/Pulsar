(() => {
    const root = document.querySelector('.home-page');
    if (!root) return;

    const buttons = Array.from(root.querySelectorAll('[data-action]'));
    if (!buttons.length) return;

    const actionMap = {
        downloader: { page: 'downloader', index: 1 },
        converter: { page: 'converter', index: 2 },
        compressor: { page: 'compressor', index: 3 },
        settings: { page: 'settings', index: 4 }
    };

    buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const action = btn.getAttribute('data-action');
            const target = actionMap[action];
            if (!target || typeof window.loadPage !== 'function') return;
            window.loadPage(target.page, target.index);
        });
    });
})();