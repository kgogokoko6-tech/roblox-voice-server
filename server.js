import { Server } from "npm:socket.io@4.7.2";

const port = parseInt(Deno.env.get("PORT") || "8080");
const io = new Server({
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// تخزين أكواد الربط المؤقتة واللاعبين
const pendingCodes = new Map(); // code -> { userId, username, timestamp }
const activePlayers = new Map(); // socket.id -> { userId, x, y, z, channel }

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // توليد كود ربط جديد من لعبة روبلوكس
  socket.on("generate_code", (data) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    pendingCodes.set(code, {
      userId: data.userId,
      username: data.username,
      timestamp: Date.now()
    });
    
    // تنحذف الكود تلقائياً بعد دقيقتين
    setTimeout(() => pendingCodes.delete(code), 120000);
    socket.emit("code_generated", { code });
  });

  // التحقق من الكود ودخول الموقع
  socket.on("verify_code", (data, callback) => {
    const playerData = pendingCodes.get(data.code);
    if (!playerData) {
      return callback({ success: false, message: "الكود غير صحيح أو انتهى." });
    }

    pendingCodes.delete(data.code);
    activePlayers.set(socket.id, {
      userId: playerData.userId,
      username: playerData.username,
      x: 0, y: 0, z: 0,
      channel: data.channel || "default"
    });

    callback({ success: true, userId: playerData.userId });
    io.emit("peers_update", Array.from(activePlayers.values()));
  });

  // تحديث الموقع الإحداثي (X, Y, Z) من روبلوكس أو الموقع
  socket.on("update_position", (pos) => {
    const player = activePlayers.get(socket.id);
    if (player) {
      player.x = pos.x;
      player.y = pos.y;
      player.z = pos.z;
      socket.broadcast.emit("player_moved", { socketId: socket.id, x: pos.x, y: pos.y, z: pos.z });
    }
  });

  // توجيه إشارات WebRTC (Offer, Answer, ICE Candidates)
  socket.on("rtc_signal", (data) => {
    io.to(data.targetSocketId).emit("rtc_signal", {
      senderSocketId: socket.id,
      signal: data.signal
    });
  });

  socket.on("disconnect", () => {
    activePlayers.delete(socket.id);
    io.emit("peers_update", Array.from(activePlayers.values()));
    console.log(`User disconnected: ${socket.id}`);
  });
});

Deno.serve({ port }, io.handler());
