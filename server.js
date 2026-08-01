// =====================================================
// Roblox Voice Chat Auth Server — Deno Deploy version
// Works with BOTH Deno Deploy and Node.js
// Fixes: 405 Method Not Allowed (accepts GET + POST)
// =====================================================

const activeCodes = new Map();   // code -> { userId, username }
const verifiedUsers = new Set(); // userId (verified)

const API_ROUTES = ["/api/register-code", "/api/verify-code", "/api/check-auth"];

// ---------- Request helpers ----------
async function getParams(req) {
    const url = new URL(req.url);
    const params = {};
    // From query string
    for (const [k, v] of url.searchParams.entries()) params[k] = v;
    // From JSON body (if any)
    try {
        const ct = req.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
            const body = await req.json();
            for (const k in body) params[k] = body[k];
        }
    } catch (e) { /* ignore bad body */ }
    return params;
}

function json(res, obj, status = 200) {
    const body = JSON.stringify(obj);
    return new Response(body, {
        status,
        headers: {
            "content-type": "application/json; charset=utf-8",
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET, POST, OPTIONS",
            "access-control-allow-headers": "Content-Type",
        },
    });
}

// ---------- Handlers ----------
async function registerCode(p) {
    const userId = p.userId;
    const code = p.code;
    const username = p.username || "Player";
    if (!userId || !code) return json(null, { success: false, error: "بيانات ناقصة" });
    activeCodes.set(String(code).trim(), { userId: String(userId), username: String(username) });
    return json(null, { success: true });
}

async function verifyCode(p) {
    const code = String(p.code || "").trim();
    if (!code) return json(null, { success: false, message: "برجاء كتابة الرمز!" });

    if (activeCodes.has(code)) {
        const userData = activeCodes.get(code);
        verifiedUsers.add(userData.userId);
        activeCodes.delete(code);
        return json(null, { success: true, user: userData });
    }
    return json(null, { success: false, message: "الكود غير صحيح أو انتهت صلاحيته!" });
}

async function checkAuth(p) {
    const userId = String(p.userId || "");
    const isVerified = verifiedUsers.has(userId);
    return json(null, { verified: isVerified });
}

// ---------- Server ----------
async function handle(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("", { status: 204, headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET, POST, OPTIONS",
            "access-control-allow-headers": "Content-Type",
        }});
    }

    // API routes (accept any method: GET, POST, PUT...)
    if (API_ROUTES.includes(path)) {
        const p = await getParams(req);
        switch (path) {
            case "/api/register-code": return await registerCode(p);
            case "/api/verify-code":   return await verifyCode(p);
            case "/api/check-auth":    return await checkAuth(p);
        }
    }

    // Serve static files (index.html, etc.)
    let file = "index.html";
    if (path !== "/") file = path.replace(/^\/+/, "");
    try {
        const text = await Deno.readTextFile(file);
        return new Response(text, {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8", "access-control-allow-origin": "*" },
        });
    } catch (e) {
        return json(null, { success: false, error: "not found" }, 404);
    }
}

// Detect environment: Deno Deploy vs Node
if (typeof Deno !== "undefined" && Deno.serve) {
    Deno.serve({ port: 8080 }, handle);
} else {
    // Node.js fallback
    const http = require("http");
    const fs = require("fs");
    const { URL } = require("url");
    const nodeHandle = async (req, res) => {
        const url = new URL(req.url, "http://localhost");
        const path = url.pathname;
        const headers = { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "Content-Type" };
        if (req.method === "OPTIONS") { res.writeHead(204, headers); res.end(); return; }
        if (API_ROUTES.includes(path)) {
            const p = {};
            for (const [k, v] of url.searchParams.entries()) p[k] = v;
            try {
                let body = "";
                for await (const chunk of req) body += chunk;
                if (body) { try { Object.assign(p, JSON.parse(body)); } catch(e){} }
            } catch(e) {}
            let out;
            switch (path) {
                case "/api/register-code": out = await registerCode(p); break;
                case "/api/verify-code":   out = await verifyCode(p); break;
                case "/api/check-auth":    out = await checkAuth(p); break;
            }
            const data = await out.text();
            res.writeHead(200, headers); res.end(data); return;
        }
        let file = "index.html";
        if (path !== "/") file = path.replace(/^\/+/, "");
        try { const t = fs.readFileSync(file); res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(t); }
        catch(e) { res.writeHead(404); res.end("Not found"); }
    };
    http.createServer(nodeHandle).listen(8080, () => console.log("Server on 8080"));
}
// =====================================================
// Roblox Voice Chat Auth Server — Deno Deploy version
// Works with BOTH Deno Deploy and Node.js
// Fixes: 405 Method Not Allowed (accepts GET + POST)
// =====================================================

const activeCodes = new Map();   // code -> { userId, username }
const verifiedUsers = new Set(); // userId (verified)

const API_ROUTES = ["/api/register-code", "/api/verify-code", "/api/check-auth"];

// ---------- Request helpers ----------
async function getParams(req) {
    const url = new URL(req.url);
    const params = {};
    // From query string
    for (const [k, v] of url.searchParams.entries()) params[k] = v;
    // From JSON body (if any)
    try {
        const ct = req.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
            const body = await req.json();
            for (const k in body) params[k] = body[k];
        }
    } catch (e) { /* ignore bad body */ }
    return params;
}

function json(res, obj, status = 200) {
    const body = JSON.stringify(obj);
    return new Response(body, {
        status,
        headers: {
            "content-type": "application/json; charset=utf-8",
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET, POST, OPTIONS",
            "access-control-allow-headers": "Content-Type",
        },
    });
}

// ---------- Handlers ----------
async function registerCode(p) {
    const userId = p.userId;
    const code = p.code;
    const username = p.username || "Player";
    if (!userId || !code) return json(null, { success: false, error: "بيانات ناقصة" });
    activeCodes.set(String(code).trim(), { userId: String(userId), username: String(username) });
    return json(null, { success: true });
}

async function verifyCode(p) {
    const code = String(p.code || "").trim();
    if (!code) return json(null, { success: false, message: "برجاء كتابة الرمز!" });

    if (activeCodes.has(code)) {
        const userData = activeCodes.get(code);
        verifiedUsers.add(userData.userId);
        activeCodes.delete(code);
        return json(null, { success: true, user: userData });
    }
    return json(null, { success: false, message: "الكود غير صحيح أو انتهت صلاحيته!" });
}

async function checkAuth(p) {
    const userId = String(p.userId || "");
    const isVerified = verifiedUsers.has(userId);
    return json(null, { verified: isVerified });
}

// ---------- Server ----------
async function handle(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("", { status: 204, headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET, POST, OPTIONS",
            "access-control-allow-headers": "Content-Type",
        }});
    }

    // API routes (accept any method: GET, POST, PUT...)
    if (API_ROUTES.includes(path)) {
        const p = await getParams(req);
        switch (path) {
            case "/api/register-code": return await registerCode(p);
            case "/api/verify-code":   return await verifyCode(p);
            case "/api/check-auth":    return await checkAuth(p);
        }
    }

    // Serve static files (index.html, etc.)
    let file = "index.html";
    if (path !== "/") file = path.replace(/^\/+/, "");
    try {
        const text = await Deno.readTextFile(file);
        return new Response(text, {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8", "access-control-allow-origin": "*" },
        });
    } catch (e) {
        return json(null, { success: false, error: "not found" }, 404);
    }
}

// Detect environment: Deno Deploy vs Node
if (typeof Deno !== "undefined" && Deno.serve) {
    Deno.serve({ port: 8080 }, handle);
} else {
    // Node.js fallback
    const http = require("http");
    const fs = require("fs");
    const { URL } = require("url");
    const nodeHandle = async (req, res) => {
        const url = new URL(req.url, "http://localhost");
        const path = url.pathname;
        const headers = { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "Content-Type" };
        if (req.method === "OPTIONS") { res.writeHead(204, headers); res.end(); return; }
        if (API_ROUTES.includes(path)) {
            const p = {};
            for (const [k, v] of url.searchParams.entries()) p[k] = v;
            try {
                let body = "";
                for await (const chunk of req) body += chunk;
                if (body) { try { Object.assign(p, JSON.parse(body)); } catch(e){} }
            } catch(e) {}
            let out;
            switch (path) {
                case "/api/register-code": out = await registerCode(p); break;
                case "/api/verify-code":   out = await verifyCode(p); break;
                case "/api/check-auth":    out = await checkAuth(p); break;
            }
            const data = await out.text();
            res.writeHead(200, headers); res.end(data); return;
        }
        let file = "index.html";
        if (path !== "/") file = path.replace(/^\/+/, "");
        try { const t = fs.readFileSync(file); res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(t); }
        catch(e) { res.writeHead(404); res.end("Not found"); }
    };
    http.createServer(nodeHandle).listen(8080, () => console.log("Server on 8080"));
}
