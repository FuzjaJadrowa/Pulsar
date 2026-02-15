class NotificationManager {
    constructor() {
        this.container = document.getElementById('notification-container');
    }

    show(title, message, type = 'info', isPermanent = false) {
        if (!this.container) {
            this.container = document.getElementById('notification-container');
            if(!this.container) return;
        }

        const toast = document.createElement('div');
        toast.className = `notification-toast type-${type}`;

        const closeIcon = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
        `;

        toast.innerHTML = `
            <div class="notif-header">
                <span class="notif-title">${title}</span>
                <button class="notif-close">${closeIcon}</button>
            </div>
            <div class="notif-message">${message}</div>
        `;

        const closeBtn = toast.querySelector('.notif-close');

        const removeToast = () => {
            toast.classList.add('hiding');
            toast.addEventListener('animationend', () => {
                if(toast.parentElement) toast.parentElement.removeChild(toast);
            });
        };

        closeBtn.onclick = removeToast;

        this.container.appendChild(toast);

        if (!isPermanent) {
            setTimeout(() => {
                if (toast.parentElement) {
                    removeToast();
                }
            }, 4000);
        }
    }
}

window.notifier = new NotificationManager();