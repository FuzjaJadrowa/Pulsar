{
    const audioCheck = document.getElementById('audio-only-check');
    const subsCheck = document.getElementById('subs-check');
    const chatCheck = document.getElementById('chat-check');
    const advBtn = document.getElementById('advanced-toggle-btn');

    const updateAudioState = () => {
        const isAudio = audioCheck.checked;
        document.getElementById('video-fmt').disabled = isAudio;
        document.getElementById('video-qual').disabled = isAudio;
        document.getElementById('audio-fmt').disabled = !isAudio;
        document.getElementById('audio-qual').disabled = !isAudio;
    };

    const updateSubsState = () => {
        const hasSubs = subsCheck.checked;
        document.getElementById('subs-code').disabled = !hasSubs;
        if(hasSubs) chatCheck.checked = false;
    };

    const updateChatState = () => {
        if(chatCheck.checked) {
            subsCheck.checked = false;
            updateSubsState();
        }
    };

    audioCheck.addEventListener('change', updateAudioState);
    subsCheck.addEventListener('change', updateSubsState);
    chatCheck.addEventListener('change', updateChatState);

    advBtn.addEventListener('click', function() {
        const content = document.getElementById('adv-content');
        const isOpen = content.classList.contains('open');
        if (isOpen) {
            content.classList.remove('open');
            this.innerText = "Advanced Settings ▼";
        } else {
            content.classList.add('open');
            this.innerText = "Advanced Settings ▲";
        }
    });

    updateAudioState();
    if (window.initCustomSelects) window.initCustomSelects();
}

function addToQueueSim() {
    const qBtn = document.getElementById('btn-queue');
    if(qBtn) qBtn.style.display = 'flex';
}