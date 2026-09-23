import { Application, Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { Server } from "npm:socket.io@4.7.2";

const PORT = parseInt(Deno.env.get("PORT") || "8080");
const SERVER_KEY = Deno.env.get("ROBLOX_SERVER_KEY") || "NOVA-482"; // المفتاح المطابق لروبلوكس

const app = new Application();
const router = new Router();

// تخزين بيانات اللاعبين القادمين من سيرفر روبلوكس
const activeLinks = new Map(); // linkCode -> playerData
const socketToLink = new Map(); // socketId -> linkCode

// 1. استقبال الـ Presence من سيرفر روبلوكس عبر HTTP POST
router.post("/api/rooms/roblox-presence", async (ctx) => {
  try {
    const body = await ctx.request.body({ type: "json" }).value;
    const { gameCode, serverKey, players } = body;

    // التحقق من مفتاح الحماية
    if (serverKey !== SERVER_KEY) {
      ctx.response.status = 403;
      ctx.response.body = { error: "Invalid ServerKey" };
      return;
    }

    if (!players || !Array.isArray(players)) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Invalid players data" };
      return;
    }

    const now = Date.now();

    // تحديث إحداثيات وحالة كل لاعب
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

    // حذف اللاعبين المنقطع إرسالهم (أكثر من 15 ثانية)
    for (const [code, data] of activeLinks.entries()) {
      if (now - data.lastSeen > 15000) {
        activeLinks.delete(code);
      }
    }

    ctx.response.status = 200;
    ctx.response.body = { success: true };
  } catch (err) {
    console.error("Presence Error:", err);
    ctx.response.status = 500;
    ctx.response.body = { error: err.message };
  }
});

// تفعيل المسارات في Oak
app.use(router.routes());
app.use(router.allowedMethods());

// إعداد Socket.io
const io = new Server({
  cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on("connection", (socket) => {
  console.log(`Web client connected: ${socket.id}`);

  // التحقق من الكود المكتوب في الموقع
  socket.on("verify_code", (data, callback) => {
    const code = (data.code || "").trim().toUpperCase();
    const playerData = activeLinks.get(code);

    if (!playerData) {
      return callback({ success: false, message: "الكود غير صحيح أو انتهت صلاحيته." });
    }

    playerData.socketId = socket.id;
    socketToLink.set(socket.id, code);

    callback({ 
      success: true, 
      userId: playerData.playerId,
      displayName: playerData.displayName 
    });

    console.log(`Player ${playerData.playerId} linked with socket ${socket.id}`);
  });

  socket.on("disconnect", () => {
    const code = socketToLink.get(socket.id);
    if (code) {
      const playerData = activeLinks.get(code);
      if (playerData) {
        playerData.socketId = null;
      }
      socketToLink.delete(socket.id);
    }
    console.log(`Web client disconnected: ${socket.id}`);
  });
});

// التشغيل السليم المتوافق مع Deno Deploy (معالجة طلبات HTTP والـ WebSockets معاً)
Deno.serve({ port: PORT }, async (req) => {
  if (req.url.includes("/socket.io/")) {
    return io.engine.handleRequest(req);
  }
  return await app.handle(req) || new Response("Not Found", { status: 404 });
});

console.log(`Server running on port ${PORT}`);
