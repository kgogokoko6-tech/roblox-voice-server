import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// البيانات الخاصة بتطبيقك على روبلوكس
const CLIENT_ID = "5157939756697645911";
const CLIENT_SECRET = "RBX--9nJyrEPykGkms24o0s4poSv9018xR8-ABUnuf60WBz5NNo_d3uQUqSdePCSuEwm";
const REDIRECT_URI = "https://roblox-voice-server.kgogokoko6-tech.deno.net/oauth/callback";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Content-Type": "text/html; charset=utf-8"
};

serve(async (req) => {
  const url = new URL(req.url);

  // 1. تحويل اللاعب لصفحة تسجيل دخول روبلوكس الرسمية
  if (url.pathname === "/login") {
    const robloxAuthUrl = new URL("https://apis.roblox.com/oauth/v1/authorize");
    robloxAuthUrl.searchParams.set("client_id", CLIENT_ID);
    robloxAuthUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    robloxAuthUrl.searchParams.set("scope", "openid profile");
    robloxAuthUrl.searchParams.set("response_type", "code");

    return Response.redirect(robloxAuthUrl.toString(), 302);
  }

  // 2. استقبال النتيجة بعد ما اللاعب يدوس Authorize
  if (url.pathname === "/oauth/callback") {
    const code = url.searchParams.get("code");
    if (!code) {
      return new Response("<h1>Error: Authorization Code Missing</h1>", { status: 400, headers: corsHeaders });
    }

    try {
      // تبادل الـ Code بالـ Token من روبلوكس
      const tokenResponse = await fetch("https://apis.roblox.com/oauth/v1/token", {
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

      const tokenData = await tokenResponse.json();
      if (!tokenData.access_token) {
        return new Response(`<h1>Authentication Failed</h1><pre>${JSON.stringify(tokenData)}</pre>`, { status: 400, headers: corsHeaders });
      }

      // جلب بيانات اللاعب الموثقة من روبلوكس
      const userResponse = await fetch("https://apis.roblox.com/oauth/v1/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });

      const userData = await userResponse.json();

      return new Response(
        `<!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
          <meta charset="UTF-8">
          <title>VoiceBlox Connected</title>
          <style>
            body { background: #0f172a; color: #fff; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .card { background: #1e293b; padding: 35px; border-radius: 12px; text-align: center; border: 1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
            h1 { color: #38bdf8; margin-bottom: 10px; }
            .user { color: #34d399; font-weight: bold; font-size: 20px; }
            .status { background: #065f46; color: #a7f3d0; padding: 10px; border-radius: 6px; margin-top: 15px; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>🟢 تم التوثيق بنجاح!</h1>
            <p>أهلاً بك، <span class="user">${userData.preferred_username || userData.name}</span></p>
            <p>Roblox ID: <code>${userData.sub}</code></p>
            <div class="status">🔊 الشات الصوتي متصل الآن</div>
          </div>
        </body>
        </html>`,
        { status: 200, headers: corsHeaders }
      );
    } catch (err) {
      return new Response(`<h1>Server Error: ${err.message}</h1>`, { status: 500, headers: corsHeaders });
    }
  }

  // 3. الواجهة الرئيسية للموقع
  return new Response(
    `<!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>VoiceBlox Auth</title>
      <style>
        body { background: #0f172a; color: #fff; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .card { background: #1e293b; padding: 40px; border-radius: 12px; text-align: center; border: 1px solid #334155; }
        .btn { background: #0284c7; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block; transition: 0.2s; }
        .btn:hover { background: #0369a1; transform: scale(1.03); }
      </style>
    </head>
    <body>
      <div class="card">
        <h2 style="color:#38bdf8; margin-bottom: 20px;">ربط حساب Roblox بالشات الصوتي</h2>
        <a class="btn" href="/login">تسجيل الدخول عبر Roblox 🚀</a>
      </div>
    </body>
    </html>`,
    { status: 200, headers: corsHeaders }
  );
});
