const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// تفعيل CORS للسماح بالطلبات من أي مكان بدون منع المتصفح
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// خدمة الملفات من المجلد الحالي
app.use(express.static(__dirname));

const activeCodes = new Map();
const verifiedUsers = new Set();

// 1. تسجيل الرمز القادم من روبلوكس
app.post('/api/register-code', (req, res) => {
    try {
        const { userId, code, username } = req.body;
        if (!userId || !code) {
            return res.status(400).json({ success: false, error: 'بيانات ناقصة' });
        }
        activeCodes.set(String(code).trim(), { userId: String(userId), username });
        console.log(`[Code Registered] Code: ${code} for User: ${username}`);
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// 2. فحص روبلوكس لحالة التفعيل
app.get('/api/check-auth', (req, res) => {
    const userId = String(req.query.userId || '');
    const isVerified = verifiedUsers.has(userId);
    return res.json({ verified: isVerified });
});

// 3. تأكيد الرمز من المتصفح
app.post('/api/verify-code', (req, res) => {
    try {
        const code = String(req.body.code || '').trim();
        
        if (!code) {
            return res.status(400).json({ success: false, message: 'برجاء كتابة الرمز!' });
        }

        if (activeCodes.has(code)) {
            const userData = activeCodes.get(code);
            verifiedUsers.add(userData.userId);
            activeCodes.delete(code);
            console.log(`[Verified Success] Code ${code} verified for user ${userData.username}`);
            return res.json({ success: true, user: userData });
        } else {
            return res.json({ success: false, message: 'الكود غير صحيح أو انتهت صلاحيته!' });
        }
    } catch (err) {
        return res.status(500).json({ success: false, message: 'خطأ داخلي بالسيرفر' });
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
