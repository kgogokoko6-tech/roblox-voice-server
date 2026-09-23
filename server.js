import { Application, Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { Server } from "npm:socket.io@4.7.2";

const PORT = parseInt(Deno.env.get("PORT") || "8080");
const SERVER_KEY = Deno.env.get("ROBLOX_SERVER_KEY") || "NOVA-482";

const app = new Application();
const router = new Router();

const activeLinks = new Map(); // linkCode -> playerData
const socketToLink = new Map(); // socketId -> linkCode

// 1. استقبال الـ Presence من روبلوكس مع طباعة تفصيلية لتشخيص الخطأ
router.post("/api/rooms/roblox-presence", async (ctx) => {
  try {
    const body = await ctx.request.body({ type: "json" }).value;
    console.log("📥 استلام بيانات روبلوكس:", JSON.stringify(body));

    const { gameCode, serverKey, players } = body;

    // التحقق من المفتاح (إذا واجهت خطأ، تأكد أن ROBLOX_SERVER_KEY في Deno Deploy يطابق Config في روبلوكس)
    if (serverKey !== SERVER_KEY) {
      console.warn(`⚠️ مفتاح غير مطابق! القادم: ${serverKey}, المتوقع: ${SERVER_KEY}`);
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

    ctx.response.status = 200;
    ctx.response.body = { success: true };
  } catch (err) {
    console.error("❌ خطأ في معالجة Presence:", err);
    ctx.response.status = 500;
    ctx.response.body = { error: err.message };
  }
});

app.use(router.routes());
app.use(router.allowedMethods());

const io = new Server({
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

Deno.serve({ port: PORT }, async (req) => {
  const url = new URL(req.url);
  
  // توجيه طلبات socket.io بالشكل الصحيح
  if (url.pathname.startsWith("/socket.io/")) {
    return io.engine.handleRequest(req);
  }

  return await app.handle(req) || new Response("Not Found", { status: 404 });
});

console.log(`🚀 السيرفر يعمل على المنفذ ${PORT}`);
