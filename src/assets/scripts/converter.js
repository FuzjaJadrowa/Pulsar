(() => {
    const root = document.querySelector('.converter-page');
    if (!root) return;

    const pathInput = root.querySelector('#convert-path-input');
    const browseBtn = root.querySelector('#convert-browse-btn');
    const confirmBtn = root.querySelector('#convert-confirm-btn');
    const fileInput = root.querySelector('#convert-file-input');

    const confirmPath = () => {
        if (!pathInput) return;
        if (pathInput.value.trim() === '') return;
    };

    if (browseBtn && fileInput) {
        const openPicker = () => fileInput.click();
        browseBtn.addEventListener('click', openPicker);
        browseBtn.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openPicker();
            }
        });
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files && event.target.files[0];
            if (file && pathInput) {
                pathInput.value = file.path || file.name || '';
                confirmPath();
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
    }
})();