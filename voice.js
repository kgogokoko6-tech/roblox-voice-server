const socket = io();
let localStream;
let peerConnections = {};
const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

let isMuted = false;
let isDeafened = false;

document.getElementById('connect-btn').onclick = () => {
    const code = document.getElementById('code-input').value.trim();
    if (code.length !== 6) {
        document.getElementById('error-msg').innerText = "الرجاء إدخال الكود بشكل صحيح (6 أرقام).";
        return;
    }

    socket.emit('verify_code', { code, channel: 'default' }, async (response) => {
        if (response.success) {
            document.getElementById('login-section').classList.add('hidden');
            document.getElementById('control-section').classList.remove('hidden');
            document.getElementById('status-user').innerText = `معرف المستخدم: ${response.userId}`;
            
            await initAudioAndKeepAlive();
        } else {
            document.getElementById('error-msg').innerText = response.message;
        }
    });
};

async function initAudioAndKeepAlive() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        
        // --- الحيلة للخلفية (Keep Alive Trick) ---
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(20000, audioCtx.currentTime); // تردد غير مسموع 20kHz
        gainNode.gain.setValueAtTime(0.00001, audioCtx.currentTime); // صوت يكاد يكون معدوماً لتفادي النوم في الخلفية
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();

        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
        }

    } catch (e) {
        alert("يرجى السماح بالوصول للميكروفون لتשغيل المايك.");
    }
}

// التحكم بالميكروفون والسماعة من الموقع
document.getElementById('mic-toggle').onclick = () => {
    isMuted = !isMuted;
    if (localStream) {
        localStream.getAudioTracks().forEach(track => track.enabled = !isMuted);
    }
    document.getElementById('mic-toggle').innerText = isMuted ? "إلغاء كتم الميكروفون ❌" : "كتم الميكروفون 🎤";
};

document.getElementById('speaker-toggle').onclick = () => {
    isDeafened = !isDeafened;
    document.querySelectorAll('audio').forEach(audio => audio.muted = isDeafened);
    document.getElementById('speaker-toggle').innerText = isDeafened ? "إلغاء كتم السماعة ❌" : "كتم السماعة 🔊";
};
