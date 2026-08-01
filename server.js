const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());

const activeCodes = new Map();
const players = new Map(); // بيانات أماكن اللاعبين

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// إرسال الكود من روبلوكس
app.post('/api/create-code', (req, res) => {
    const { userId, username, code } = req.body;
    activeCodes.set(code, { userId, username });
    res.json({ success: true });
});

// إرسال المكان من روبلوكس
app.post('/api/update-position', (req, res) => {
    const { userId, position } = req.body;
    if (players.has(userId)) {
        players.get(userId).position = position;
    }
    res.sendStatus(200);
});

io.on('connection', (socket) => {
    socket.on('verify_code', (code) => {
        if (activeCodes.has(code)) {
            const data = activeCodes.get(code);
            activeCodes.delete(code);
            
            socket.userId = data.userId;
            socket.username = data.username;

            players.set(data.userId, {
                username: data.username,
                socketId: socket.id,
                position: { x: 0, y: 0, z: 0 }
            });

            socket.emit('verified', { userId: data.userId, username: data.username });
        } else {
            socket.emit('error_msg', 'الكود غير صحيح أو منتهي الصلاحية');
        }
    });

    socket.on('toggle_mute', (isMuted) => {
        socket.broadcast.emit('player_mute_changed', { userId: socket.userId, isMuted });
    });

    socket.on('disconnect', () => {
        if (socket.userId) players.delete(socket.userId);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
