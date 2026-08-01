const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static('public')); // ليخدم ملفات الـ HTML والـ JS للموقع

// الخرائط لحفظ الأكواد والمستخدمين الموثقين
const activeCodes = new Map();
const verifiedUsers = new Set();

// 1. API تسجيل الكود القادم من روبلوكس
app.post('/api/register-code', (req, res) => {
    const { userId, code, username } = req.body;
    if (!userId || !code) {
        return res.status(400).json({ error: 'بيانات غير مكتملة' });
    }
    activeCodes.set(code, { userId, username });
    res.json({ success: true });
});

// 2. API فحص روبلوكس هل التفعيل تم أم لا
app.get('/api/check-auth', (req, res) => {
    const userId = req.query.userId;
    const isVerified = verifiedUsers.has(userId);
    res.json({ verified: isVerified });
});

// 3. API كتابة الكود وتأكيده من قِبل اللاعب في المتصفح
app.post('/api/verify-code', (req, res) => {
    const { code } = req.body;
    if (activeCodes.has(code)) {
        const userData = activeCodes.get(code);
        verifiedUsers.add(userData.userId);
        activeCodes.delete(code);
        return res.json({ success: true, user: userData });
    }
    res.json({ success: false, message: 'الكود غير صحيح أو انتهت صلاحيته!' });
});

// إعدادات الـ WebSockets للصوت
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
