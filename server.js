// VoiceBlox server — Deno Deploy
// يستقبل مواقع اللاعبين من Roblox، يحسب المسافات، ويعمل "signaling" بين متصفحات
// اللاعبين عشان يقدروا يفتحوا اتصال صوت مباشر (WebRTC) بينهم حسب القرب.

const players = new Map();        // id -> { id, x, y, z, lookX, lookZ, talking, updatedAt }
const viewerSockets = new Set();  // سوكيتات الداشبورد (بدون id) - للمراقبة بس
const playerSockets = new Map();  // id -> socket (متصفح اللاعب اللي فاتح رابط الصوت)

const NEARBY_RADIUS = Number(Deno.env.get("NEARBY_RADIUS") ?? "60");
const STALE_AFTER_MS = Number(Deno.env.get("STALE_AFTER_MS") ?? "10000");
const ROBLOX_SHARED_SECRET = Deno.env.get("ROBLOX_SHARED_SECRET") ?? "";

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  // ---------- WebSocket: /ws  و  /ws?id=<playerId> ----------
  if (url.pathname === "/ws") {
    if (req.headers.get("upgrade") !== "websocket") {
      return json({ ok: false, error: "WebSocket upgrade required" }, 426);
    }

    const { socket, response } = Deno.upgradeWebSocket(req);
    const id = url.searchParams.get("id");

    socket.onopen = () => {
      if (id) {
        playerSockets.set(id, socket);
      } else {
        viewerSockets.add(socket);
      }
      socket.send(JSON.stringify(snapshot()));
    };

    socket.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      // اللاعب يبلغ إنه يتكلم أو سكت (يجي من الـ Voice Activity Detection بالمتصفح)
      if (data.type === "talking" && id) {
        const player = players.get(id);
        if (player) {
          player.talking = data.talking === true;
          player.updatedAt = Date.now();
          broadcast();
        }
        return;
      }

      // رسائل WebRTC (offer/answer/ice) بين لاعبين، السيرفر بس يمررها
      if (data.type === "signal" && id && data.to) {
        const target = playerSockets.get(String(data.to));
        if (target && target.readyState === WebSocket.OPEN) {
          target.send(JSON.stringify({ type: "signal", from: id, data: data.data }));
        }
        return;
      }
    };

    const cleanupSocket = () => {
      viewerSockets.delete(socket);
      if (id && playerSockets.get(id) === socket) {
        playerSockets.delete(id);
      }
    };

    socket.onclose = cleanupSocket;
    socket.onerror = cleanupSocket;

    return response;
  }

  // ---------- Roblox يبعت تحديثات المواقع هنا ----------
  if (url.pathname === "/update" && req.method === "POST") {
    if (ROBLOX_SHARED_SECRET && req.headers.get("x-voiceblox-secret") !== ROBLOX_SHARED_SECRET) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "Invalid JSON" }, 400);
    }

    const items = Array.isArray(body.players) ? body.players : [body];
    const now = Date.now();
    let accepted = 0;

    for (const item of items) {
      const id = String(item.id ?? item.userId ?? "").trim();
      if (!id) continue;

      if (item.leaving === true) {
        players.delete(id);
        const socket = playerSockets.get(id);
        if (socket && socket.readyState === WebSocket.OPEN) socket.close();
        playerSockets.delete(id);
        accepted += 1;
        continue;
      }

      const x = Number(item.x ?? item.position?.x);
      const y = Number(item.y ?? item.position?.y);
      const z = Number(item.z ?? item.position?.z);
      if (![x, y, z].every(Number.isFinite)) continue;

      const existing = players.get(id);
      players.set(id, {
        id,
        x,
        y,
        z,
        lookX: Number(item.lookX ?? existing?.lookX ?? 0),
        lookZ: Number(item.lookZ ?? existing?.lookZ ?? 1),
        talking: existing ? existing.talking : false,
        updatedAt: now,
      });

      accepted += 1;
    }

    cleanup();
    broadcast();

    return json({ ok: true, accepted, players: players.size });
  }

  if (url.pathname === "/state" && req.method === "GET") {
    return json(snapshot());
  }

  // ---------- صفحات الويب ----------
  if (url.pathname === "/" || url.pathname === "/index.html") {
    return serveFile("./index.html");
  }

  // أي رابط بمعرّف لاعب (اللي روبلوكس يفتحه، مثال: /123456789) يفتح صفحة الصوت
  const idMatch = url.pathname.match(/^\/([A-Za-z0-9_-]{1,40})$/);
  if (idMatch && req.method === "GET") {
    return serveFile("./voice.html");
  }

  return json({ ok: false, error: "Not found" }, 404);
});

setInterval(() => {
  const changed = cleanup();
  if (changed) broadcast();
}, 1000);

async function serveFile(path) {
  try {
    const html = await Deno.readTextFile(path);
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        ...corsHeaders(),
      },
    });
  } catch {
    return json({ ok: false, error: "Not found" }, 404);
  }
}

function snapshot() {
  cleanup();

  const list = [...players.values()].sort((a, b) => a.id.localeCompare(b.id));
  const distances = [];
  const nearbyCounts = new Map(list.map((p) => [p.id, 0]));

  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i];
      const b = list[j];
      const distance = round(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z), 2);
      const nearby = distance <= NEARBY_RADIUS;

      if (nearby) {
        nearbyCounts.set(a.id, nearbyCounts.get(a.id) + 1);
        nearbyCounts.set(b.id, nearbyCounts.get(b.id) + 1);
      }

      distances.push({ from: a.id, to: b.id, distance, nearby });
    }
  }

  return {
    type: "snapshot",
    serverTime: new Date().toISOString(),
    nearbyRadius: NEARBY_RADIUS,
    players: list.map((p) => ({
      id: p.id,
      x: round(p.x, 2),
      y: round(p.y, 2),
      z: round(p.z, 2),
      lookX: round(p.lookX, 3),
      lookZ: round(p.lookZ, 3),
      talking: p.talking,
      nearbyCount: nearbyCounts.get(p.id) ?? 0,
      updatedAt: p.updatedAt,
    })),
    distances: distances.sort((a, b) => a.distance - b.distance),
  };
}

function broadcast() {
  const message = JSON.stringify(snapshot());

  for (const socket of viewerSockets) {
    if (socket.readyState === WebSocket.OPEN) socket.send(message);
    else viewerSockets.delete(socket);
  }

  for (const [id, socket] of playerSockets) {
    if (socket.readyState === WebSocket.OPEN) socket.send(message);
    else playerSockets.delete(id);
  }
}

function cleanup() {
  const cutoff = Date.now() - STALE_AFTER_MS;
  let changed = false;

  for (const [id, player] of players) {
    if (player.updatedAt < cutoff) {
      players.delete(id);
      const socket = playerSockets.get(id);
      if (socket && socket.readyState === WebSocket.OPEN) socket.close();
      playerSockets.delete(id);
      changed = true;
    }
  }

  return changed;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(),
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, x-voiceblox-secret",
  };
}

function round(value, digits) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}
