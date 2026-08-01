const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// 1. معالجة الـ CORS بشكل يدوي شامل لمنع أخطاء 405 Method Not Allowed
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    
    // لو الطلب OPTIONS رجّع 200 فوراً
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

// 2. قراءة بيانات الـ JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// خدمة الملفات من المجلد الحالي
app.use(express.static(__dirname));

const activeCodes = new Map();
const verifiedUsers = new Set();

// 3. مسار تسجيل الرمز من روبلوكس (POST)
app.all('/api/register-code', (req, res) => {
    if (req.method !== 'POST') {
        return res.status(200).json({ success: false, message: 'Only POST supported' });
    }
    try {
        const { userId, code, username } = req.body || {};
        if (!userId || !code) {
            return res.status(400).json({ success: false, error: 'بيانات ناقصة' });
        }
        activeCodes.set(String(code).trim(), { userId: String(userId), username });
        console.log(`[Code Registered] Code: ${code} for User: ${username}`);
        return res.status(200).json({ success: true });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// 4. مسار فحص حالة التفعيل في روبلوكس (GET)
app.get('/api/check-auth', (req, res) => {
    const userId = String(req.query.userId || '');
    const isVerified = verifiedUsers.has(userId);
    return res.status(200).json({ verified: isVerified });
});

// 5. مسار تأكيد الرمز من المتصفح (مسموح بـ ALL لمعالجة أي شذوذ في الطلبات)
app.all('/api/verify-code', (req, res) => {
    if (req.method !== 'POST') {
        return res.status(200).json({ success: false, message: 'برجاء استخدام طلب POST' });
    }

    try {
        const code = String(req.body.code || '').trim();
        
        if (!code) {
            return res.status(400).json({ success: false, message: 'برجاء كتابة الرمز!' });
        }

        if (activeCodes.has(code)) {
            const userData = activeCodes.get(code);
            verifiedUsers.add(userData.userId);
            activeCodes.delete(code);
            console.log(`[Verified Success] Code ${code} verified for ${userData.username}`);
            return res.status(200).json({ success: true, user: userData });
        } else {
            return res.status(200).json({ success: false, message: 'الكود غير صحيح أو انتهت صلاحيته!' });
        }
    } catch (err) {
        return res.status(500).json({ success: false, message: 'خطأ داخلي بالسيرفر' });
    }
});

// توجيه الصفحة الرئيسية لملف index.html
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
