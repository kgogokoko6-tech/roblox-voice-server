import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

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

// 1. استقبال طلب كود جديد من روبلوكس عند دخول اللاعب
app.post("/api/register-code", (req, res) => {
  const { userId, username } = req.body;
  const code = generateCode();
  authCodes.set(code, { userId: String(userId), username, expiresAt: Date.now() + 10 * 60 * 1000 });
  res.json({ success: true, code });
});

// 2. التحقق من الكود المدخل في الموقع
app.post("/api/verify-code", (req, res) => {
  const { code } = req.body;
  const cleanCode = (code || "").trim().toUpperCase();
  const session = authCodes.get(cleanCode);

  if (!session || Date.now() > session.expiresAt) {
    return res.status(400).json({ error: "الكود غير صحيح أو انتهت صلاحيته (10 دقائق)" });
  }
  res.json({ success: true, user: session });
});

// 3. استقبال أماكن وإحداثيات اللاعبين من الماب
app.post("/api/update-positions", (req, res) => {
  const { positions } = req.body;
  io.emit("positions-updated", positions);
  res.json({ success: true });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
