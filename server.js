const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// خدمة ملفات المجلد العام (الموقع)
app.use(express.static(path.join(__dirname, 'public')));

const activeCodes = new Map();
const verifiedUsers = new Set();

// 1. تسجيل الرمز من روبلوكس
app.post('/api/register-code', (req, res) => {
    const { userId, code, username } = req.body;
    if (!userId || !code) {
        return res.status(400).json({ success: false, error: 'بيانات ناقصة' });
    }
    activeCodes.set(String(code).trim(), { userId: String(userId), username });
    console.log(`[Code Registered] Code: ${code} for User: ${username}`);
    return res.json({ success: true });
});

// 2. فحص حالة تفعيل اللاعب في روبلوكس
app.get('/api/check-auth', (req, res) => {
    const userId = String(req.query.userId || '');
    const isVerified = verifiedUsers.has(userId);
    return res.json({ verified: isVerified });
});

// 3. تأكيد الكود من المتصفح
app.post('/api/verify-code', (req, res) => {
    const code = String(req.body.code || '').trim();
    
    if (!code) {
        return res.status(400).json({ success: false, message: 'برجاء كتابة الرمز!' });
    }

    if (activeCodes.has(code)) {
        const userData = activeCodes.get(code);
        verifiedUsers.add(userData.userId);
        activeCodes.delete(code);
        console.log(`[Verified] User ${userData.username} successfully verified!`);
        return res.json({ success: true, user: userData });
    } else {
        return res.json({ success: false, message: 'الكود غير صحيح أو انتهت صلاحيته!' });
    }
});

// توجيه الصفحة الرئيسية لملف HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// WebSockets
io.on('connection', (socket) => {
    socket.on('join-room', (data) => {
        socket.join(data.room || 'default');
    });

    socket.on('signal', (data) => {
        io.to(data.room).emit('signal', { sender: socket.id, signal: data.signal });
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
