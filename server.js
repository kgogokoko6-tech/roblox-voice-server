// server.js - Fully Compatible Deno Deploy Endpoint for Roblox
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const activeCodes = new Map();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Content-Type": "application/json"
};

serve(async (req) => {
  const url = new URL(req.url);

  // 1. معالجة الـ OPTIONS (Preflight)
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // 2. مسار التوليد /generate-code
  if (url.pathname === "/generate-code") {
    if (req.method === "GET") {
      return new Response(JSON.stringify({ status: "OK", message: "Send POST request with JSON" }), {
        status: 200,
        headers: corsHeaders
      });
    }

    if (req.method === "POST") {
      try {
        const bodyText = await req.text();
        if (!bodyText) {
          return new Response(JSON.stringify({ error: "Empty Body" }), { status: 400, headers: corsHeaders });
        }

        const body = JSON.parse(bodyText);
        const { userId, username } = body;

        if (!userId || !username) {
          return new Response(JSON.stringify({ error: "Missing userId or username" }), { status: 400, headers: corsHeaders });
        }

        // إنشاء الكود
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        activeCodes.set(code, { userId, username, expiresAt: Date.now() + 600000 });

        console.log(`[GENERATED] Code: ${code} for User: ${username}`);

        return new Response(JSON.stringify({ success: true, code: code }), {
          status: 200,
          headers: corsHeaders
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Invalid JSON Format", details: String(err) }), {
          status: 400,
          headers: corsHeaders
        });
      }
    }
  }

  // 3. الصفحة الرئيسية عند فتح الروابط من المتصفح
  return new Response("<h1>VoiceBlox Deno Server Active</h1>", {
    status: 200,
    headers: { "Content-Type": "text/html" }
  });
});
