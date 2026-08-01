const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// خدمة الملفات من المجلد الحالي
app.use(express.static(__dirname));

const activeCodes = new Map();
const verifiedUsers = new Set();

// 1. تسجيل الرمز القادم من روبلوكس
app.all('/api/register-code', (req, res) => {
    const userId = req.query.userId || req.body?.userId;
    const code = req.query.code || req.body?.code;
    const username = req.query.username || req.body?.username || 'Player';

    if (!userId || !code) {
        return res.status(200).json({ success: false, error: 'بيانات ناقصة' });
    }

    activeCodes.set(String(code).trim(), { userId: String(userId), username });
    console.log(`[Code Registered] Code: ${code} for User: ${username}`);
    return res.status(200).json({ success: true });
});

// 2. فحص روبلوكس لحالة التفعيل
app.all('/api/check-auth', (req, res) => {
    const userId = String(req.query.userId || req.body?.userId || '');
    const isVerified = verifiedUsers.has(userId);
    return res.status(200).json({ verified: isVerified });
});

// 3. تأكيد الرمز من المتصفح عبر GET لمنع خطأ 405 تماماً
app.all('/api/verify-code', (req, res) => {
    const code = String(req.query.code || req.body?.code || '').trim();
    
    if (!code) {
        return res.status(200).json({ success: false, message: 'برجاء كتابة الرمز!' });
    }

    if (activeCodes.has(code)) {
        const userData = activeCodes.get(code);
        verifiedUsers.add(userData.userId);
        activeCodes.delete(code);
        console.log(`[Verified Success] Code ${code} verified for user ${userData.username}`);
        return res.status(200).json({ success: true, user: userData });
    } else {
        return res.status(200).json({ success: false, message: 'الكود غير صحيح أو انتهت صلاحيته!' });
    }
});

// توجيه الصفحة الرئيسية
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
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
