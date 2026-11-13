"use strict";
/* Servidor HTTP de El Umbral online (sin dependencias): estáticos, /healthz, API de salas, SSE y comandos. */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { Rooms } = require("./room");

const MAX_BODY = 8 * 1024;
const MAX_RESTORE_BODY = 1536 * 1024; /* solo /api/restore (blob de instantánea) */
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json; charset=utf-8", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8" };

/* Cabeceras de seguridad para TODAS las respuestas (estáticos, API y SSE). La CSP permite lo que usa el cliente:
   scripts propios (sin inline ni eval), estilos propios + atributos style, sprites inline (SVG en el HTML), imágenes/audio data:/blob:,
   y conexiones a cualquier servidor https/http (el servidor es configurable en el menú «Servidor (avanzado)»). Sin iframes ajenos. */
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https: http:; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
function secure(req, res, trustProxy) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  if (String(req.url || "").split("?")[0].match(/^\/($|index\.html$)/) || /\.(html?)$/.test(String(req.url || "").split("?")[0])) res.setHeader("Content-Security-Policy", CSP);
  if (trustProxy && String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https") res.setHeader("Strict-Transport-Security", "max-age=15552000");
}

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
  const rooms = new Rooms({ engineDir, maxRooms: opts.maxRooms || Number(process.env.MAX_ROOMS) || 50, now, idleMs: opts.idleMs, endedMs: opts.endedMs, readMs: opts.readMs, timeScale: opts.timeScale,
    snapshotKey: opts.snapshotKey !== undefined ? opts.snapshotKey : process.env.SNAPSHOT_KEY, restoreWindowMs: opts.restoreWindowMs, restoreGraceTurnMs: opts.restoreGraceTurnMs, restoreGraceMs: opts.restoreGraceMs, log: opts.log });
  const joinLimit = limiter(opts.joinPerMin || 20, 60000, now);   /* crear/unirse por IP */
  const cmdLimit = limiter(opts.cmdPerSec || 10, 1000, now);      /* comandos por token */
  const restoreLimit = limiter(opts.restorePerMin || 12, 60000, now); /* restauraciones por IP */
  const restoreTokLimit = limiter(6, 60000, now);                  /* y por token */
  const startedAt = now();

  function clientIp(req) {
    if (opts.trustProxy || process.env.TRUST_PROXY) { const f = req.headers["x-forwarded-for"]; if (f) return String(f).split(",")[0].trim(); }
    return req.socket.remoteAddress || "?";
  }
  function cors(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "content-type, x-token, x-room");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Max-Age", "600");
  }
  function send(res, code, obj) {
    const body = JSON.stringify(obj);
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Content-Length": Buffer.byteLength(body), "X-Content-Type-Options": "nosniff" });
    res.end(body);
  }
  function readJson(req, res, cb, maxBody) {
    const lim = maxBody || MAX_BODY;
    let size = 0; const chunks = []; let done = false;
    req.on("data", (c) => {
      if (done) return;
      size += c.length;
      if (size > lim) { done = true; send(res, 413, { ok: false, msg: "Petición demasiado grande." }); req.destroy(); return; }
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
  /* Token desconocido: si el cliente dice a qué sala pertenece y esa sala NO existe (servidor reiniciado), 404 «sala desconocida»
     (el cliente puede restaurarla con su instantánea); en otro caso 401. */
  function unknownToken(req, url, res) {
    const rc = String(req.headers["x-room"] || url.searchParams.get("room") || "").toUpperCase();
    if (/^[A-Z]{5}$/.test(rc) && !rooms.rooms.has(rc)) return send(res, 404, { ok: false, unknownRoom: true, restorable: rooms.snap.enabled, msg: "Sala desconocida." });
    return send(res, 401, BAD_TOKEN);
  }

  function api(req, res, url) {
    const p = url.pathname;
    if (req.method === "GET" && p === "/healthz") return send(res, 200, { ok: true, rooms: rooms.rooms.size, uptimeS: Math.round((now() - startedAt) / 1000) });

    if (req.method === "GET" && p === "/events") {
      const who = rooms.byToken(tokenOf(req, url));
      if (!who) return unknownToken(req, url, res);
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
    if (p === "/api/restore") {
      const tok = tokenOf(req, url);
      if (!restoreLimit(clientIp(req)) || !restoreTokLimit(tok.slice(0, 32))) return send(res, 429, { ok: false, msg: "Demasiados intentos. Espera un minuto." });
      return readJson(req, res, (b) => {
        rooms.restore(b.room, b.blob, tok).then((r) => { try { send(res, r.status, r.json); } catch (e) { /* conexión cerrada */ } });
      }, MAX_RESTORE_BODY);
    }
    if (p === "/cmd" || p === "/api/leave" || p === "/api/start" || p === "/api/ping" || p === "/api/npc") {
      const who = rooms.byToken(tokenOf(req, url));
      if (!who) return unknownToken(req, url, res);
      if (!cmdLimit(who.player.tokenHash)) return send(res, 429, { ok: false, msg: "Demasiados comandos por segundo." });
      return readJson(req, res, (b) => {
        const { room, player } = who;
        player.lastSeen = now(); room.touch();
        if (p === "/api/ping") return send(res, 200, { ok: true, serverNow: now() });
        if (p === "/api/leave") return send(res, 200, room.leave(player));
        if (p === "/api/start") return send(res, 200, room.start(player, b.endAt));
        if (p === "/api/npc") return send(res, 200, room.npcOp(player, b));
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
    const root = path.resolve(publicDir);
    const file = path.normalize(path.join(root, rel));
    if (file !== root && file.indexOf(root + path.sep) !== 0) { res.writeHead(403); return res.end(); }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("No encontrado"); }
      /* Siempre revalidar (sw.js y la app se actualizan al desplegar); ETag por tamaño+mtime para responder 304 sin cuerpo. */
      const etag = 'W/"' + st.size.toString(16) + "-" + Math.round(st.mtimeMs).toString(16) + '"';
      const h = { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-cache", "ETag": etag, "Last-Modified": st.mtime.toUTCString() };
      if (req.headers["if-none-match"] === etag) { res.writeHead(304, h); return res.end(); }
      h["Content-Length"] = st.size;
      res.writeHead(200, h);
      if (req.method === "HEAD") return res.end();
      fs.createReadStream(file).pipe(res);
    });
  }

  const server = http.createServer((req, res) => {
    let url;
    try { url = new URL(req.url, "http://localhost"); } catch (e) { res.writeHead(400); return res.end(); }
    const p = url.pathname;
    secure(req, res, !!(opts.trustProxy || process.env.TRUST_PROXY));
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
    setInterval(() => rooms.tick(), opts.tickMs || 1000),
    setInterval(() => { rooms.sweep(); joinLimit.sweep(); cmdLimit.sweep(); }, 60000)
  ];
  timers.forEach((t) => t.unref && t.unref());
  server.on("close", () => { timers.forEach(clearInterval); rooms.closeAll(); });
  /* Apagado limpio: deja de aceptar conexiones, cierra los SSE (los clientes reintentan solos) y libera los temporizadores. */
  function shutdown(cb) {
    let done = false; const fin = () => { if (!done) { done = true; cb && cb(); } };
    server.close(fin); try { server.closeIdleConnections(); } catch (e) { /* idem */ }
    /* instantánea final de cada sala a sus jugadores conectados, ANTES de cerrar los SSE (se escribe y luego se cierra: el cierre vacía el búfer) */
    try { const n = rooms.snapshotAll(); if (n) rooms.log("apagado: instantánea enviada de " + n + " sala(s)"); } catch (e) { /* idem */ }
    try { rooms.closeAll(); } catch (e) { /* idem */ }
    setTimeout(() => { try { server.closeAllConnections(); } catch (e) { /* idem */ } }, 1500).unref();
    setTimeout(fin, 4000).unref();
  }
  return { server, rooms, engineDir, publicDir, shutdown };
}

module.exports = { createServer };

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  let app;
  try { app = createServer({}); } catch (e) { console.error(e.message); process.exit(1); }
  app.server.on("error", (e) => { console.error("No se pudo escuchar en el puerto " + port + ": " + e.message); process.exit(1); });
  /* 0.0.0.0: obligatorio en Render (el balanceador entra por la interfaz de red, no por localhost). */
  app.server.listen(port, "0.0.0.0", () => console.log("El Umbral online escuchando en 0.0.0.0:" + port + " (motor: " + app.engineDir + ")"));
  let stopping = false;
  const stop = (sig) => { if (stopping) return; stopping = true; console.log(sig + ": apagando…"); app.shutdown(() => process.exit(0)); };
  process.on("SIGTERM", () => stop("SIGTERM")); process.on("SIGINT", () => stop("SIGINT"));
  /* Un fallo suelto no debe tumbar todas las salas: se registra (sin datos de jugadores) y se sigue. */
  process.on("uncaughtException", (e) => console.error("uncaughtException:", e && e.stack || e));
  process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e && e.stack || e));
}
