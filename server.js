// استخدم Deno Native HTTP لتفادي مشاكل Express Middlewares على الـ Edge
Deno.serve(async (req) => {
  const url = new URL(req.url);

  // 1. التعامل مع الـ CORS Preflight (OPTIONS)
  const headers = new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, User-Agent, Accept",
    "Content-Type": "application/json"
  });

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }

  // 2. فحص مسار توليد الكود /generate-code
  if (url.pathname === "/generate-code") {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ status: "Ready for POST" }), { status: 200, headers });
    }

    try {
      const body = await req.json();
      const { userId, username } = body;

      if (!userId || !username) {
        return new Response(JSON.stringify({ error: "Missing userId or username" }), { status: 400, headers });
      }

      // توليد كود التحقق
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      console.log(`[SUCCESS] Code ${code} created for ${username} (${userId})`);

      return new Response(JSON.stringify({ success: true, code }), { status: 200, headers });
    } catch (err) {
      return new Response(JSON.stringify({ error: "Invalid JSON Body", details: String(err) }), { status: 400, headers });
    }
  }

  // 3. الصفحة الرئيسية
  return new Response("<h1>VoiceBlox Native Deno Engine Active</h1>", {
    status: 200,
    headers: { "Content-Type": "text/html" }
  });
});
