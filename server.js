import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const server = createServer(app);

// قراءة البورت والمفتاح من البيئة
const PORT = process.env.PORT || 3000;
const SERVER_KEY = process.env.ROBLOX_SERVER_KEY || "NOVA-482";

app.use(express.json());

const activeLinks = new Map(); // linkCode -> playerData
const socketToLink = new Map(); // socketId -> linkCode

// 1. استقبال الـ Presence من روبلوكس
app.post("/api/rooms/roblox-presence", (req, res) => {
  try {
    const body = req.body;
    console.log("📥 استلام بيانات روبلوكس:", JSON.stringify(body));

    const { gameCode, serverKey, players } = body;

    if (serverKey !== SERVER_KEY) {
      console.warn(`⚠️ مفتاح غير مطابق! القادم: ${serverKey}, المتوقع: ${SERVER_KEY}`);
      return res.status(403).json({ error: "Invalid ServerKey" });
    }

    if (!players || !Array.isArray(players)) {
      return res.status(400).json({ error: "Invalid players data" });
    }

    const now = Date.now();
    players.forEach((p) => {
      if (p.linkCode) {
        const existing = activeLinks.get(p.linkCode) || {};
        activeLinks.set(p.linkCode, {
          playerId: p.playerId,
          linkCode: p.linkCode,
          displayName: p.displayName || p.playerId,
          position: p.position || { x: 0, y: 0, z: 0 },
          muted: p.muted,
          gameCode: gameCode,
          socketId: existing.socketId || null,
          lastSeen: now
        });
      }
    });

    // تنظيف الأكواد القديمة
    for (const [code, data] of activeLinks.entries()) {
      if (now - data.lastSeen > 20000) {
        activeLinks.delete(code);
      }
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ خطأ في معالجة Presence:", err);
    return res.status(500).json({ error: err.message });
  }
});

// إعداد Socket.io
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on("connection", (socket) => {
  console.log(`🟢 مستخدم ويب متصل: ${socket.id}`);

  socket.on("verify_code", (data, callback) => {
    const code = (data.code || "").trim().toUpperCase();
    const playerData = activeLinks.get(code);

    if (!playerData) {
      return callback({ success: false, message: "الكود غير صحيح أو منتهي الصلاحية." });
    }

    playerData.socketId = socket.id;
    socketToLink.set(socket.id, code);

    callback({ 
      success: true, 
      userId: playerData.playerId,
      displayName: playerData.displayName 
    });

    console.log(`🔗 تم ربط اللاعب ${playerData.playerId} بنجاح.`);
  });

  socket.on("disconnect", () => {
    const code = socketToLink.get(socket.id);
    if (code) {
      const playerData = activeLinks.get(code);
      if (playerData) playerData.socketId = null;
      socketToLink.delete(socket.id);
    }
    console.log(`🔴 انقطع اتصال مستخدم الويب: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 السيرفر يعمل على المنفذ ${PORT}`);
});
