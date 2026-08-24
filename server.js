const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());

const activeCodes = new Map();
const connectedUsers = new Map();

// 1. استقبال وتوليد كود التفعيل من روبلوكس
app.post("/generate-code", (req, res) => {
  const { userId, username } = req.body;
  if (!userId || !username) return res.status(400).json({ error: "بيانات ناقصة" });

  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const expiresAt = Date.now() + 10 * 60 * 1000;

  activeCodes.set(code, { userId, username, expiresAt });
  res.json({ success: true, code });
});

// 2. تحديث المواقع من روبلوكس
app.post("/update-positions", (req, res) => {
  const { players } = req.body;
  if (Array.isArray(players)) {
    io.emit("positions-update", players);
  }
  res.json({ status: "ok" });
});

// 3. الصفحة الأساسية برابط الدومين مباشرة
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VoiceBlox</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
    body { background-color: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    
    .container { display: flex; flex-direction: column; align-items: center; }

    .logo-header { display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 700; font-size: 20px; color: #0f172a; margin-bottom: 24px; }
    .logo-icon { display: flex; gap: 3px; align-items: center; height: 18px; }
    .bar { width: 3px; background: #2563eb; border-radius: 2px; }
    .bar:nth-child(1) { height: 10px; }
    .bar:nth-child(2) { height: 18px; }
    .bar:nth-child(3) { height: 8px; }

    .card { background: #ffffff; width: 440px; padding: 40px 36px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03); text-align: left; border: 1px solid #f1f5f9; }
    
    .title { font-size: 24px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
    .subtitle { font-size: 13.5px; color: #64748b; line-height: 1.5; margin-bottom: 24px; }
    
    .btn-roblox { width: 100%; background: #2563eb; color: white; border: none; padding: 12px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; text-align: center; }
    
    .divider { display: flex; align-items: center; text-align: center; color: #94a3b8; font-size: 11px; margin: 20px 0; font-weight: 600; }
    .divider::before, .divider::after { content: ''; flex: 1; border-bottom: 1px solid #e2e8f0; }
    .divider::before { margin-right: 1em; }
    .divider::after { margin-left: 1em; }
    
    .input-label { text-align: left; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 8px; display: block; }
    .code-input { width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; color: #0f172a; outline: none; text-transform: uppercase; }
    .code-input::placeholder { color: #cbd5e1; }
    
    .btn-connect { width: 100%; background: #ffffff; color: #334155; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 12px; text-align: center; }
    
    .footer-note { font-size: 12px; color: #94a3b8; line-height: 1.6; margin-top: 24px; text-align: left; }

    /* Dashboard UI */
    .hidden { display: none !important; }
    .dash-card { background: #ffffff; width: 320px; padding: 24px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04); text-align: center; border: 1px solid #f1f5f9; position: relative; }
    .header-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .status-tag { background: #ecfdf5; color: #10b981; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 5px; }
    .status-dot { width: 6px; height: 6px; background: #10b981; border-radius: 50%; }
    .brand-title { font-weight: 700; font-size: 13px; color: #0f172a; display: flex; align-items: center; gap: 4px; }
    
    .mic-circle { width: 90px; height: 90px; border-radius: 50%; background: #eff6ff; border: 2px solid #bfdbfe; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 0 auto 16px auto; color: #2563eb; }
    .mic-circle svg { width: 24px; height: 24px; fill: currentColor; }
    .mic-circle span { font-size: 11px; font-weight: 600; margin-top: 4px; }

    .btn-group { display: flex; gap: 8px; justify-content: center; margin-bottom: 20px; }
    .btn-action { padding: 6px 14px; border-radius: 6px; font-size: 11px; font-weight: 600; border: none; cursor: pointer; }
    .btn-red { background: #fef2f2; color: #ef4444; }
    .btn-gray { background: #f8fafc; color: #64748b; border: 1px solid #f1f5f9; }

    .nearby-section { text-align: right; }
    .nearby-header { font-size: 11px; font-weight: 600; color: #94a3b8; margin-bottom: 8px; display: flex; align-items: center; gap: 4px; }
    .player-row { display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 8px 12px; border-radius: 6px; margin-bottom: 6px; font-size: 12px; color: #334155; }
    .dots { color: #94a3b8; letter-spacing: 2px; }
  </style>
  <script src="/socket.io/socket.io.js"></script>
</head>
<body>

  <div class="container">
    <!-- Login Screen -->
    <div id="login-screen">
      <div class="logo-header">
        <div class="logo-icon">
          <div class="bar"></div>
          <div class="bar"></div>
          <div class="bar"></div>
        </div>
        <span>VoiceBlox</span>
      </div>

      <div class="card">
        <div class="title">Connect your mic</div>
        <div class="subtitle">Sign in with Roblox, or use the code shown in the game</div>
        
        <button class="btn-roblox">Sign in with Roblox</button>
        
        <div class="divider">OR</div>
        
        <label class="input-label">Code from the game</label>
        <input type="text" id="code-input" class="code-input" placeholder="A1B2C3" maxlength="6">
        
        <button class="btn-connect" onclick="connectWithCode()">Connect with code</button>
        
        <div class="footer-note">
          Codes come from the in-game panel and expire after 10 minutes. Signing in with Roblox stays linked for good — a code only stays trusted for 7 days, after which the game will keep asking you to sign in with Roblox.
        </div>
      </div>
    </div>

    <!-- Voice Dashboard Screen -->
    <div id="voice-screen" class="hidden">
      <div class="dash-card">
        <div class="header-top">
          <div class="status-tag"><div class="status-dot"></div> متصل</div>
          <div class="brand-title">
            <span>VoiceBlox</span>
            <div class="logo-icon" style="height:12px;">
              <div class="bar" style="height:6px;"></div>
              <div class="bar" style="height:12px;"></div>
              <div class="bar" style="height:4px;"></div>
            </div>
          </div>
        </div>

        <div class="mic-circle">
          <svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
          <span>شغال</span>
        </div>

        <div class="btn-group">
          <button class="btn-action btn-red">🎤 المايك مقفل</button>
          <button class="btn-action btn-gray">🎧 السبيكر</button>
        </div>

        <div class="nearby-section">
          <div class="nearby-header">
            <span>ℹ️</span>
            <span>القريبين منك</span>
          </div>
          <div id="players-list">
            <div class="player-row">
              <span class="dots">...</span>
              <span>jmarosro0</span>
            </div>
            <div class="player-row">
              <span class="dots">...</span>
              <span>Ghost</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const socket = io();

    function connectWithCode() {
      const code = document.getElementById("code-input").value.trim().toUpperCase();
      if (!code) return alert("ادخل الكود أولاً");
      socket.emit("verify-code", code);
    }

    socket.on("auth-success", (data) => {
      document.getElementById("login-screen").classList.add("hidden");
      document.getElementById("voice-screen").classList.remove("hidden");
    });

    socket.on("auth-failed", (msg) => alert(msg));
  </script>
</body>
</html>
  `);
});

// 4. ربط السوكت
io.on("connection", (socket) => {
  socket.on("verify-code", (code) => {
    const data = activeCodes.get(code);
    if (data && Date.now() < data.expiresAt) {
      connectedUsers.set(socket.id, data);
      activeCodes.delete(code);
      socket.emit("auth-success", data);
    } else {
      socket.emit("auth-failed", "Code is invalid or expired");
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on port " + PORT));
