const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());

// التخزين المؤقت للأكواد واللاعبين المتصلين
const activeCodes = new Map(); // Code -> { userId, username, expiresAt }
const connectedUsers = new Map(); // socket.id -> { userId, username, position }

// 1. استقبال كود التحقق الصادر من روبلوكس
app.post("/generate-code", (req, res) => {
  const { userId, username } = req.body;
  if (!userId || !username) return res.status(400).json({ error: "بيانات غير مكتملة" });

  // توليد كود عشوائي من 6 أرقام وحروف
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 دقائق

  activeCodes.set(code, { userId, username, expiresAt });
  res.json({ success: true, code });
});

// 2. تحديث مواقع اللاعبين من روبلوكس باستمرار (للحساب القريب)
app.post("/update-positions", (req, res) => {
  const { players } = req.body; // array of { userId, position }
  if (Array.isArray(players)) {
    io.emit("positions-update", players);
  }
  res.json({ status: "ok" });
});

// 3. واجهة الويب (الصفحة التي يفتحها المستخدم)
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>VoiceBlox - Connect Mic</title>
      <style>
        body { font-family: sans-serif; background: #f4f6f8; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .card { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); width: 350px; text-align: center; }
        input { width: 90%; padding: 10px; margin: 10px 0; border: 1px solid #ccc; border-radius: 6px; text-align: center; font-size: 18px; }
        button { width: 95%; padding: 12px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; }
        .hidden { display: none; }
      </style>
      <script src="/socket.io/socket.io.js"></script>
    </head>
    <body>
      <div class="card" id="login-box">
        <h2>VoiceBlox</h2>
        <p>ربط المايك مع اللعبة</p>
        <input type="text" id="code-input" placeholder="A1B2C3" maxlength="6">
        <button onclick="connectWithCode()">ربط بالحساب</button>
      </div>

      <div class="card hidden" id="voice-box">
        <h3 id="user-display">مرحباً</h3>
        <p style="color:green;">🟢 المايك متصل</p>
        <h4>اللاعبون القريبون:</h4>
        <ul id="nearby-list" style="list-style:none; padding:0;"></ul>
      </div>

      <script>
        const socket = io();

        function connectWithCode() {
          const code = document.getElementById("code-input").value.trim().toUpperCase();
          if (!code) return alert("ادخل الكود أولاً");

          socket.emit("verify-code", code);
        }

        socket.on("auth-success", (data) => {
          document.getElementById("login-box").classList.add("hidden");
          document.getElementById("voice-box").classList.remove("hidden");
          document.getElementById("user-display").innerText = "أهلاً " + data.username;
        });

        socket.on("auth-failed", (msg) => alert(msg));

        socket.on("positions-update", (players) => {
          const list = document.getElementById("nearby-list");
          list.innerHTML = "";
          players.forEach(p => {
            const li = document.createElement("li");
            li.innerText = "لاعب: " + p.userId;
            list.appendChild(li);
          });
        });
      </script>
    </body>
    </html>
  `);
});

// الاتصال عبر WebSockets
io.on("connection", (socket) => {
  socket.on("verify-code", (code) => {
    const data = activeCodes.get(code);
    if (data && Date.now() < data.expiresAt) {
      connectedUsers.set(socket.id, data);
      activeCodes.delete(code); // إبطال الكود بعد الاستخدام
      socket.emit("auth-success", data);
    } else {
      socket.emit("auth-failed", "الكود غير صحيح أو انتهت صلاحيته");
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Voice Server is running on port " + PORT));
