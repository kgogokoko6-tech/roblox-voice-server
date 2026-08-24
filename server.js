import express from "npm:express@4";
import { createServer } from "node:http";
import { Server } from "npm:socket.io@4";

const app = express();
const server = createServer(app);

// إعداد السوكت مع دعم كامل للـ CORS
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"]
  }
});

// Middleware للتعامل مع الـ JSON وزيادة حماية الـ CORS
app.use(express.json());

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

// تخزين الأكواد النشطة في الذاكرة
const activeCodes = new Map();
const connectedUsers = new Map();

// منع أخطاء الطلبات التلقائية
app.get("/favicon.ico", (req, res) => res.status(204).end());

// Endpoint استقبال الطلبات من روبلوكس (دعم جميع الوسائل لتفادي خطأ 405)
app.all("/generate-code", (req, res) => {
  if (req.method !== "POST") {
    return res.status(200).json({ status: "Server is ready for POST requests." });
  }

  const { userId, username } = req.body || {};

  if (!userId || !username) {
    return res.status(400).json({ error: "Missing userId or username" });
  }

  // توليد كود عشوائي مكون من 6 خانات
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const expiresAt = Date.now() + 10 * 60 * 1000; // صلاحية 10 دقائق

  activeCodes.set(code, { userId, username, expiresAt });
  console.log(`[AUTH] Code generated: ${code} for user: ${username} (${userId})`);

  return res.status(200).json({ success: true, code });
});

// واجهة الويب للربط والصوت
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VoiceBlox Authentication</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
    body { background-color: #0f172a; display: flex; justify-content: center; align-items: center; min-height: 100vh; color: #f8fafc; }
    .card { background: #1e293b; width: 400px; padding: 32px; border-radius: 12px; border: 1px solid #334155; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
    .title { font-size: 22px; font-weight: 700; margin-bottom: 8px; color: #38bdf8; }
    .subtitle { font-size: 13px; color: #94a3b8; margin-bottom: 24px; }
    .input-group { text-align: left; margin-bottom: 16px; }
    .input-label { font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px; display: block; }
    .code-input { width: 100%; padding: 12px; border: 1px solid #475569; background: #0f172a; border-radius: 6px; font-size: 16px; color: #fff; text-align: center; letter-spacing: 2px; outline: none; text-transform: uppercase; }
    .code-input:focus { border-color: #38bdf8; }
    .btn-submit { width: 100%; background: #0284c7; color: white; border: none; padding: 12px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; transition: 0.2s; }
    .btn-submit:hover { background: #0369a1; }
    .hidden { display: none !important; }
    .status-box { background: #065f46; color: #34d399; padding: 12px; border-radius: 6px; font-size: 14px; font-weight: 600; margin-top: 10px; }
  </style>
  <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
</head>
<body>
  <div class="card">
    <div id="auth-panel">
      <div class="title">VoiceBlox Link</div>
      <div class="subtitle">Enter the 6-character code displayed in Roblox</div>
      <div class="input-group">
        <label class="input-label">Verification Code</label>
        <input type="text" id="code-input" class="code-input" placeholder="X8K9L2" maxlength="6">
      </div>
      <button class="btn-submit" onclick="submitCode()">Connect Voice</button>
    </div>
    <div id="connected-panel" class="hidden">
      <div class="title">Connected Successfully</div>
      <div class="status-box">🟢 Proximity Voice Active</div>
    </div>
  </div>

  <script>
    const socket = io();

    function submitCode() {
      const code = document.getElementById("code-input").value.trim().toUpperCase();
      if (!code || code.length !== 6) return alert("Please enter a valid 6-character code.");
      socket.emit("verify-code", code);
    }

    socket.on("auth-success", (data) => {
      document.getElementById("auth-panel").classList.add("hidden");
      document.getElementById("connected-panel").classList.remove("hidden");
    });

    socket.on("auth-failed", (msg) => {
      alert(msg || "Invalid code. Please try again.");
    });
  </script>
</body>
</html>
  `);
});

// Socket Event Listening
io.on("connection", (socket) => {
  socket.on("verify-code", (code) => {
    const data = activeCodes.get(code);
    if (data && Date.now() < data.expiresAt) {
      connectedUsers.set(socket.id, data);
      activeCodes.delete(code); // استخدام الكود مرة واحدة فقط
      socket.emit("auth-success", data);
    } else {
      socket.emit("auth-failed", "Code is expired or invalid.");
    }
  });
});

const PORT = Deno.env.get("PORT") || 8000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
