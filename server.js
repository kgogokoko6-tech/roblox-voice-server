import { Application, Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { Server } from "npm:socket.io@4.7.2";

const PORT = parseInt(Deno.env.get("PORT") || "8080");
const SERVER_KEY = Deno.env.get("ROBLOX_SERVER_KEY") || "NOVA-482"; // المفتاح المطابق للـ Config في روبلوكس

const app = new Application();
const router = new Router();

// تخزين بيانات اللاعبين القادمين من سيرفر روبلوكس
const activeLinks = new Map(); // linkCode -> playerData
const socketToLink = new Map(); // socketId -> linkCode

// 1. استقبال الـ Presence والبيانات من سيرفر روبلوكس (HTTP POST)
router.post("/api/rooms/roblox-presence", async (ctx) => {
  try {
    const body = await ctx.request.body({ type: "json" }).value;
    const { gameCode, serverKey, players } = body;

    // التحقق من صحة مفتاح السيرفر للأمان
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

    // تحديث بيانات اللاعبين الحاليين
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

    // إزالة الأكواد غير النشطة (التي تجاوزت 15 ثانية بدون تحديث)
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

app.use(router.routes());
app.use(router.allowedMethods());

// إعداد خادم الـ HTTP و Socket.io المتوافق مع Deno
const denoServer = Deno.listen({ port: PORT });
console.log(`Server running on port ${PORT}`);

const io = new Server({
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// التعامل مع اتصالات الموقع عبر الـ WebSocket
io.on("connection", (socket) => {
  console.log(`Web client connected: ${socket.id}`);

  // التحقق من الكود المكون من 10 خانات الذي أدخله المستخدم في الموقع
  socket.on("verify_code", (data, callback) => {
    const code = (data.code || "").trim().toUpperCase();
    const playerData = activeLinks.get(code);

    if (!playerData) {
      return callback({ success: false, message: "الكود غير صحيح أو منتهي الصلاحية. تأكد أنك داخل اللعبة وأن الكود ظاهر على شاشتك." });
    }

    playerData.socketId = socket.id;
    socketToLink.set(socket.id, code);

    callback({ 
      success: true, 
      userId: playerData.playerId,
      displayName: playerData.displayName 
    });

    console.log(`Player ${playerData.playerId} successfully linked with socket ${socket.id}`);
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

// تشغيل السيرفر ليستقبل الطلبات
for await (const conn of denoServer) {
  // معالجة تدفق الاتصالات
  (async () => {
    try {
      const httpConn = Deno.serveHttp(conn);
      for await (const requestEvent of httpConn) {
        await app.handle(requestEvent.request);
      }
    } catch {
      // تجاهل أخطاء الاتصالات العابرة
    }
  })();
}
