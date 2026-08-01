const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// السماح ببيانات JSON و URL Encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// خدمة الملفات المباشرة (مثل index.html)
app.use(express.static(path.join(__dirname, 'public')));

// تخزين الأكواد والمستخدمين
const activeCodes = new Map();
const verifiedUsers = new Set();

// 1. استقبال الرمز من روبلوكس
app.post('/api/register-code', (req, res) => {
    try {
        const { userId, code, username } = req.body;
        if (!userId || !code) {
            return res.status(400).json({ success: false, error: 'بيانات ناقصة' });
        }
        activeCodes.set(String(code).trim(), { userId: String(userId), username });
        console.log(`[Code Registered] Code: ${code} for User: ${username} (${userId})`);
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// 2. فحص روبلوكس لحالة التفعيل
app.get('/api/check-auth', (req, res) => {
    const userId = String(req.query.userId);
    const isVerified = verifiedUsers.has(userId);
    return res.json({ verified: isVerified });
});

// 3. تأكيد الكود من المتصفح
app.post('/api/verify-code', (req, res) => {
    try {
        const code = String(req.body.code || '').trim();
        
        if (!code) {
            return res.status(400).json({ success: false, message: 'برجاء كتابة الرمز!' });
        }

        if (activeCodes.has(code)) {
            const userData = activeCodes.get(code);
            verifiedUsers.add(userData.userId);
            activeCodes.delete(code); // حذف الكود بعد الاستخدام
            console.log(`[Auth Success] User ${userData.username} (${userData.userId}) verified!`);
            return res.json({ success: true, user: userData });
        } else {
            return res.json({ success: false, message: 'الكود غير صحيح أو انتهت صلاحيته!' });
        }
    } catch (err) {
        return res.status(500).json({ success: false, message: 'خطأ داخلي بالسيرفر!' });
    }
});

// المسار الرئيسي لعرض الصفحة في حالة عدم عمل static بشكل آلي
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// WebSockets للصوت
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
