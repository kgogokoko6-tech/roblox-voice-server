const express = require("express");
const app = express();

const CLIENT_ID = "5157939756697645911";
// الـ Secret الجديد اللي انت بعته
const CLIENT_SECRET = "RBX--9nJyrEPykGkms24o0s4plr6m1x6fowkobXf1s8aORc_kKzqM_LqssD-NE0XWNTe";

// رابط Vercel الحقيقي بتاعك
const REDIRECT_URI = "https://roblox-voice-server2.vercel.app/oauth/callback";

app.use(express.json());

// 1. رابط التوجيه لروبلوكس
app.get("/login", (req, res) => {
  const robloxUrl = new URL("https://apis.roblox.com/oauth/v1/authorize");
  robloxUrl.searchParams.set("client_id", CLIENT_ID);
  robloxUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  robloxUrl.searchParams.set("scope", "openid profile");
  robloxUrl.searchParams.set("response_type", "code");

  return res.redirect(robloxUrl.toString());
});

// 2. استقبال النتيجة من روبلوكس
app.get("/oauth/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("Authorization Code Missing");

  try {
    const tokenRes = await fetch("https://apis.roblox.com/oauth/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: REDIRECT_URI
      })
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.status(400).json(tokenData);

    const userRes = await fetch("https://apis.roblox.com/oauth/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    const userData = await userRes.json();

    return res.send(`
      <div style="background:#0f172a;color:#fff;height:100vh;display:flex;justify-content:center;align-items:center;font-family:sans-serif;">
        <div style="background:#1e293b;padding:30px;border-radius:10px;text-align:center;border:1px solid #334155;">
          <h1 style="color:#38bdf8;">🟢 تم التوثيق بنجاح!</h1>
          <p>أهلاً بك، <b>${userData.preferred_username || userData.name}</b></p>
          <p>ID: <code>${userData.sub}</code></p>
        </div>
      </div>
    `);
  } catch (err) {
    return res.status(500).send("Server Error: " + err.message);
  }
});

// 3. الصفحة الرئيسية
app.get("*", (req, res) => {
  res.send(`
    <div style="background:#0f172a;color:#fff;height:100vh;display:flex;justify-content:center;align-items:center;font-family:sans-serif;">
      <div style="background:#1e293b;padding:40px;border-radius:10px;text-align:center;">
        <h2>ربط حساب Roblox بالشات الصوتي</h2>
        <a href="/login" style="background:#0284c7;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;margin-top:15px;">تسجيل الدخول عبر Roblox 🚀</a>
      </div>
    </div>
  `);
});

module.exports = app;
