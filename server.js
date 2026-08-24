const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());

const activeCodes = new Map();
const connectedUsers = new Map();

// 1. توليد كود التفعيل من روبلوكس
app.post("/generate-code", (req, res) => {
  const { userId, username } = req.body;
  if (!userId || !username) return res.status(400).json({ error: "بيانات ناقصة" });

  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const expiresAt = Date.now() + 10 * 60 * 1000;

  activeCodes.set(code, { userId, username, expiresAt });
  res.json({ success: true, code });
});

// 2. عرض صفحة HTML
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// 3. التحقق عبر الـ Sockets
io.on("connection", (socket) => {
  socket.on("verify-code", (code) => {
    const data = activeCodes.get(code);
    if (data && Date.now() < data.expiresAt) {
      connectedUsers.set(socket.id, data);
      activeCodes.delete(code);
      socket.emit("auth-success", data);
    } else {
      socket.emit("auth-failed", "Code is invalid or expired");
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on port " + PORT));
