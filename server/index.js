"use strict";
/* Servidor HTTP de El Umbral online (sin dependencias): estáticos, /healthz, API de salas, SSE y comandos. */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { Rooms } = require("./room");

const MAX_BODY = 8 * 1024;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json; charset=utf-8", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8" };

/* Límite simple por clave: ventana deslizante de `max` eventos en `ms`. */
function limiter(max, ms, now) {
  const hits = new Map();
  const f = (key) => {
    const t = now(), arr = (hits.get(key) || []).filter((x) => t - x < ms);
    if (arr.length >= max) { hits.set(key, arr); return false; }
    arr.push(t); hits.set(key, arr); return true;
  };
  f.sweep = () => { const t = now(); for (const [k, a] of hits) { const b = a.filter((x) => t - x < ms); if (b.length) hits.set(k, b); else hits.delete(k); } };
  return f;
}

/* opts: { publicDir, engineDir, maxRooms, now, cmdPerSec, joinPerMin, trustProxy } */
function createServer(opts) {
  opts = opts || {};
  const now = opts.now || Date.now;
  const publicDir = opts.publicDir || path.join(__dirname, "..", "public");
  const engineDir = opts.engineDir || process.env.ENGINE_DIR || publicDir;
  ["data.js", "engine.js"].forEach((f) => { if (!fs.existsSync(path.join(engineDir, f))) throw new Error("No se encuentra " + f + " en ENGINE_DIR (" + engineDir + "). Copia el cliente a public/ o define ENGINE_DIR."); });
  const rooms = new Rooms({ engineDir, maxRooms: opts.maxRooms || Number(process.env.MAX_ROOMS) || 50, now, idleMs: opts.idleMs, endedMs: opts.endedMs });
  const joinLimit = limiter(opts.joinPerMin || 20, 60000, now);   /* crear/unirse por IP */
  const cmdLimit = limiter(opts.cmdPerSec || 10, 1000, now);      /* comandos por token */
  const startedAt = now();

  function clientIp(req) {
    if (opts.trustProxy || process.env.TRUST_PROXY) { const f = req.headers["x-forwarded-for"]; if (f) return String(f).split(",")[0].trim(); }
    return req.socket.remoteAddress || "?";
  }
  function cors(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "content-type, x-token");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Max-Age", "600");
  }
  function send(res, code, obj) {
    const body = JSON.stringify(obj);
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Content-Length": Buffer.byteLength(body), "X-Content-Type-Options": "nosniff" });
    res.end(body);
  }
  function readJson(req, res, cb) {
    let size = 0; const chunks = []; let done = false;
    req.on("data", (c) => {
      if (done) return;
      size += c.length;
      if (size > MAX_BODY) { done = true; send(res, 413, { ok: false, msg: "Petición demasiado grande." }); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      if (done) return; done = true;
      let obj = {};
      if (size) { try { obj = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch (e) { return send(res, 400, { ok: false, msg: "JSON no válido." }); } }
      if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return send(res, 400, { ok: false, msg: "JSON no válido." });
      cb(obj);
    });
    req.on("error", () => { done = true; });
  }
  const tokenOf = (req, url) => String(req.headers["x-token"] || url.searchParams.get("t") || "");
  const BAD_TOKEN = { ok: false, msg: "Sesión no válida." };

  function api(req, res, url) {
    const p = url.pathname;
    if (req.method === "GET" && p === "/healthz") return send(res, 200, { ok: true, rooms: rooms.rooms.size, uptimeS: Math.round((now() - startedAt) / 1000) });

    if (req.method === "GET" && p === "/events") {
      const who = rooms.byToken(tokenOf(req, url));
      if (!who) return send(res, 401, BAD_TOKEN);
      who.room.connect(who.player, res);
      return;
    }
    if (req.method !== "POST") return send(res, 404, { ok: false, msg: "No encontrado." });

    if (p === "/api/create" || p === "/api/join") {
      if (!joinLimit(clientIp(req))) return send(res, 429, { ok: false, msg: "Demasiados intentos. Espera un minuto." });
      return readJson(req, res, (b) => {
        if (p === "/api/create") return send(res, 200, rooms.create(b.name));
        const room = rooms.get(b.room);
        if (!room) return send(res, 404, { ok: false, msg: "No existe esa sala." });
        send(res, 200, room.join(b.name));
      });
    }
    if (p === "/cmd" || p === "/api/leave" || p === "/api/start" || p === "/api/ping") {
      const who = rooms.byToken(tokenOf(req, url));
      if (!who) return send(res, 401, BAD_TOKEN);
      if (!cmdLimit(who.player.tokenHash)) return send(res, 429, { ok: false, msg: "Demasiados comandos por segundo." });
      return readJson(req, res, (b) => {
        const { room, player } = who;
        player.lastSeen = now(); room.touch();
        if (p === "/api/ping") return send(res, 200, { ok: true, serverNow: now() });
        if (p === "/api/leave") return send(res, 200, room.leave(player));
        if (p === "/api/start") return send(res, 200, room.start(player, b.endAt));
        if (typeof b.cmd !== "string" || b.cmd.length > 32) return send(res, 400, { ok: false, msg: "Comando no válido." });
        send(res, 200, room.command(player, b.cmd, b.args === undefined ? [] : b.args));
      });
    }
    send(res, 404, { ok: false, msg: "No encontrado." });
  }

  function serveStatic(req, res, url) {
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }
    let rel;
    try { rel = decodeURIComponent(url.pathname); } catch (e) { res.writeHead(400); return res.end(); }
    if (rel.indexOf("\0") !== -1) { res.writeHead(400); return res.end(); }
    if (rel.endsWith("/")) rel += "index.html";
    const file = path.normalize(path.join(publicDir, rel));
    if (file !== publicDir && file.indexOf(publicDir + path.sep) !== 0) { res.writeHead(403); return res.end(); }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("No encontrado"); }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "Content-Length": st.size, "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff" });
      if (req.method === "HEAD") return res.end();
      fs.createReadStream(file).pipe(res);
    });
  }

  const server = http.createServer((req, res) => {
    let url;
    try { url = new URL(req.url, "http://localhost"); } catch (e) { res.writeHead(400); return res.end(); }
    const p = url.pathname;
    const isApi = p === "/healthz" || p === "/events" || p === "/cmd" || p.startsWith("/api/");
    if (isApi) {
      cors(res);
      if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
      try { return api(req, res, url); } catch (e) { try { send(res, 500, { ok: false, msg: "Error interno." }); } catch (e2) { /* idem */ } return; }
    }
    serveStatic(req, res, url);
  });
  server.headersTimeout = 15000; server.requestTimeout = 30000; server.keepAliveTimeout = 65000;

  const timers = [
    setInterval(() => rooms.heartbeat(), 20000),
    setInterval(() => { rooms.sweep(); joinLimit.sweep(); cmdLimit.sweep(); }, 60000)
  ];
  timers.forEach((t) => t.unref && t.unref());
  server.on("close", () => { timers.forEach(clearInterval); rooms.closeAll(); });
  return { server, rooms, engineDir, publicDir };
}

module.exports = { createServer };

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  let app;
  try { app = createServer({}); } catch (e) { console.error(e.message); process.exit(1); }
  app.server.listen(port, () => console.log("El Umbral online escuchando en :" + port + " (motor: " + app.engineDir + ")"));
  const stop = () => { app.server.close(); setTimeout(() => process.exit(0), 500).unref(); };
  process.on("SIGTERM", stop); process.on("SIGINT", stop);
}
