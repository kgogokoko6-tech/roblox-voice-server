const players = new Map();
const sockets = new Set();

const NEARBY_RADIUS = Number(Deno.env.get("NEARBY_RADIUS") ?? "60");
const STALE_AFTER_MS = Number(Deno.env.get("STALE_AFTER_MS") ?? "10000");
const ROBLOX_SHARED_SECRET = Deno.env.get("ROBLOX_SHARED_SECRET") ?? "";

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (url.pathname === "/ws") {
    if (req.headers.get("upgrade") !== "websocket") {
      return json({ ok: false, error: "WebSocket upgrade required" }, 426);
    }

    const { socket, response } = Deno.upgradeWebSocket(req);

    socket.onopen = () => {
      sockets.add(socket);
      socket.send(JSON.stringify(snapshot()));
    };

    socket.onclose = () => sockets.delete(socket);
    socket.onerror = () => sockets.delete(socket);

    return response;
  }

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
        accepted += 1;
        continue;
      }

      const x = Number(item.x ?? item.position?.x);
      const y = Number(item.y ?? item.position?.y);
      const z = Number(item.z ?? item.position?.z);

      if (![x, y, z].every(Number.isFinite)) continue;

      players.set(id, {
        id,
        x,
        y,
        z,
        talking: item.talking === true,
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

  if (url.pathname === "/" || url.pathname === "/index.html") {
    const html = await Deno.readTextFile("./index.html");
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  return json({ ok: false, error: "Not found" }, 404);
});

setInterval(() => {
  const changed = cleanup();
  if (changed) broadcast();
}, 1000);

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
      talking: p.talking,
      nearbyCount: nearbyCounts.get(p.id) ?? 0,
      updatedAt: p.updatedAt,
    })),
    distances: distances.sort((a, b) => a.distance - b.distance),
  };
}

function broadcast() {
  const message = JSON.stringify(snapshot());

  for (const socket of sockets) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(message);
    } else {
      sockets.delete(socket);
    }
  }
}

function cleanup() {
  const cutoff = Date.now() - STALE_AFTER_MS;
  let changed = false;

  for (const [id, player] of players) {
    if (player.updatedAt < cutoff) {
      players.delete(id);
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
