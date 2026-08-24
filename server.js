import express from "npm:express";
import { createServer } from "node:http";
import { Server } from "npm:socket.io";
import cors from "npm:cors";

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const authCodes = new Map();

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// قراءة ملف index.html وإرساله للمتصفح
app.get("/", async (req, res) => {
  try {
    const html = await Deno.readTextFile("./index.html");
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (e) {
    res.status(500).send("ملاحظة: تأكد من رفع ملف index.html على GitHub");
  }
});

// استقبال طلب الكود من روبلوكس
app.post("/api/register-code", (req, res) => {
  const { userId, username } = req.body;
  if (!userId || !username) return res.status(400).json({ error: "بيانات ناقصة" });

  const code = generateCode();
  authCodes.set(code, { userId: String(userId), username, expiresAt: Date.now() + 10 * 60 * 1000 });
  
  console.log(`تم إنشاء كود جديد للاعب ${username}: ${code}`);
  res.json({ success: true, code });
});

// التحقق من الكود
app.post("/api/verify-code", (req, res) => {
  const { code } = req.body;
  const cleanCode = (code || "").trim().toUpperCase();
  const session = authCodes.get(cleanCode);

  if (!session || Date.now() > session.expiresAt) {
    return res.status(400).json({ error: "الكود غير صحيح أو انتهت صلاحيته" });
  }
  res.json({ success: true, user: session });
});

// تحديث إحداثيات اللاعبين
app.post("/api/update-positions", (req, res) => {
  const { positions } = req.body;
  io.emit("positions-updated", positions);
  res.json({ success: true });
});

const PORT = Deno.env.get("PORT") || 8000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
