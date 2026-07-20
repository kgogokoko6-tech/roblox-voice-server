const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(express.json());
app.use(express.static('public'));

let playersData = {};

// استقبال المواقع من روبلوكس
app.post('/update-positions', (req, res) => {
    const { userId, position } = req.body;
    if (userId && position) {
        playersData[userId] = position;
        io.emit('positions-updated', playersData);
    }
    res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});