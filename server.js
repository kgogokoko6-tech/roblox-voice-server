import { Application, Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { Server } from "npm:socket.io@4.7.2";

const PORT = parseInt(Deno.env.get("PORT") || "8080");
const SERVER_KEY = Deno.env.get("ROBLOX_SERVER_KEY") || "NOVA-482"; // مفتاح المطابقة مع روبلوكس

const app = new Application();
const router = new Router();

// تخزين بيانات اللاعبين القادمين من روبلوكس
// linkCode -> { playerId, gameCode, position, muted, socketId, lastSeen }
const activeLinks = new Map();
// socketId -> linkCode
const socketToLink = new Map();

// 1. استقبال الـ Presence والبيانات من سيرفر روبلوكس (HTTP POST)
router.post("/api/rooms/roblox-presence", async (ctx) => {
  try {
    const body = await ctx.request.body({ type: "json" }).value;
    const { gameCode, serverKey, players } = body;

    // التحقق من مفتاح السيرفر للأمان
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

    // تحديث بيانات اللاعبين الحاليين في هذه اللعبة
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
          socketId: existing.socketId || null, // الحفاظ على ربط الـ WebSocket إذا كان متصلاً بالموقع
          lastSeen: now
        });
      }
    });

    // تنظيف الأكواد القديمة التي لم ترسل تحديثاً لأكثر من 15 ثانية
    for (const [code, data] of activeLinks.entries()) {
      if (now - data.lastSeen > 15000) {
        activeLinks.delete(code);
      }
    }

    ctx.response.status = 200;
    ctx.response.body = { success: true };
  } catch (err) {
    console.error("Error processing presence:", err);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal Server Error" };
  }
});

app.use(router.routes());
app.use(router.allowedMethods());

// إعداد خادم الـ HTTP و Socket.io المتوافق مع Deno
const denoServer = Deno.listen({ port: PORT });
console.log(`Server running on port ${PORT}`);

// دمج Oak مع Socket.io
const io = new Server({
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// التعامل مع اتصالات الموقع (الويب) عبر Socket.io
io.on("connection", (socket) => {
  console.log(`Web client connected: ${socket.id}`);

  // عندما يقوم المستخدم بكتابة الكود المكون من 10 خانات في الموقع
  socket.on("verify_code", (data, callback) => {
    const code = (data.code || "").trim().toUpperCase();
    const playerData = activeLinks.get(code);

    if (!playerData) {
      return callback({ success: false, message: "الكود غير صحيح، تأكد أنك في الماب وأن الكود ظاهر على الشاشة." });
    }

    // ربط هذا الـ Socket بالكود واللاعب
    playerData.socketId = socket.id;
    socketToLink.set(socket.id, code);

    callback({ 
      success: true, 
      userId: playerData.playerId,
      displayName: playerData.displayName 
    });

    console.log(`Player ${playerData.playerId} linked successfully with socket ${socket.id}`);
  });

  // استقبال تحديث الموقع أو الصوت من المتصفح إذا لزم الأمر
  socket.on("disconnect", () => {
    const code = socketToLink.get(socket.id);
    if (code) {
      const playerData = activeLinks.get(code);
      if (playerData) {
        playerData.socketId = null; // إلغاء ربط الـ socket فقط وابقاء بيانات اللاعب
      }
      socketToLink.delete(socket.id);
    }
    console.log(`Web client disconnected: ${socket.id}`);
  });
});

// تشغيل السيرفر ليستقبل طلبات HTTP و WebSocket معاً
for await (const conn of denoServer) {
  // معالجة الاتصالات عبر Deno HTTP handler و Socket.io
  // (ملاحظة: Deno Deploy يدعم خوادم Oak و Socket.io بالشكل المعتاد)
  handleConn(conn);
}
