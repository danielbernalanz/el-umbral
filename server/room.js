"use strict";
/* Salas: lobby, jugadores con token, transporte SSE y difusión de la vista filtrada. Un contexto vm (Game) por sala. */
const crypto = require("node:crypto");
const { Game } = require("./game");

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ"; /* sin I ni O */
const MIN_PLAYERS = 3, MAX_PLAYERS = 10, NAME_MAX = 16;
const MAX_CONN_PER_PLAYER = 3;

const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
const newToken = () => crypto.randomBytes(16).toString("hex"); /* 128 bits */

function cleanName(raw) {
  let s = String(raw == null ? "" : raw).normalize("NFC").replace(/[\p{C}\p{Zl}\p{Zp}]/gu, "").replace(/\s+/g, " ").trim();
  s = Array.from(s).slice(0, NAME_MAX).join("").trim();
  return s;
}

class Room {
  constructor(code, mgr) {
    this.code = code; this.mgr = mgr;
    this.createdAt = mgr.now(); this.lastActivity = this.createdAt; this.endedAt = null;
    this.status = "lobby";            /* lobby | playing | ended */
    this.ver = 0;                     /* contador monotónico de difusiones: el cliente descarta vistas más viejas que la que ya tiene */
    this.players = [];                /* { slot, name, tokenHash, host, conns:Set<res>, lastJson, lastSeen, left } */
    this.game = null;
  }
  touch() { this.lastActivity = this.mgr.now(); }
  hostPlayer() { return this.players.find((p) => p.host) || null; }
  connectedCount() { return this.players.reduce((n, p) => n + p.conns.size, 0); }

  /* ---------- lobby ---------- */
  join(name) {
    if (this.status !== "lobby") return { ok: false, msg: "La partida ya ha empezado." };
    if (this.players.length >= MAX_PLAYERS) return { ok: false, msg: "La sala está llena." };
    const n = cleanName(name);
    if (!n) return { ok: false, msg: "Escribe un nombre (1-16 caracteres)." };
    if (this.players.some((p) => p.name.toLowerCase() === n.toLowerCase())) return { ok: false, msg: "Ese nombre ya está en la sala." };
    const token = newToken();
    const p = { slot: this.players.length, name: n, tokenHash: sha(token), host: this.players.length === 0, conns: new Set(), lastJson: null, lastSeen: this.mgr.now() };
    this.players.push(p);
    this.mgr.indexToken(p.tokenHash, this, p);
    this.touch(); this.broadcast();
    return { ok: true, room: this.code, pid: p.slot, token };
  }
  leave(p) {
    this.touch();
    if (this.status === "lobby") {
      this.mgr.dropToken(p.tokenHash);
      closeAll(p);
      this.players = this.players.filter((x) => x !== p);
      this.players.forEach((x, i) => { x.slot = i; });
      if (!this.players.some((x) => x.host) && this.players[0]) this.players[0].host = true;
      this.broadcast();
      return { ok: true };
    }
    /* en partida no se elimina al jugador: queda desconectado (la ausencia es de F5) */
    closeAll(p); this.syncPresence(); this.broadcast();
    return { ok: true };
  }
  start(p, endAt) {
    if (!p.host) return { ok: false, msg: "Solo el anfitrión puede empezar." };
    if (this.status !== "lobby") return { ok: false, msg: "La partida ya ha empezado." };
    if (this.players.length < MIN_PLAYERS) return { ok: false, msg: "Hacen falta al menos " + MIN_PLAYERS + " jugadores." };
    endAt = Number(endAt);
    const mins = (endAt - this.mgr.now()) / 60000;
    if (!isFinite(mins) || mins < 5 || mins > 120) return { ok: false, msg: "La hora de fin debe estar entre 5 y 120 minutos desde ahora." };
    try {
      this.game = new Game(this.players.map((x) => x.name), { engineDir: this.mgr.engineDir, endAt, now: this.mgr.now });
    } catch (e) { return { ok: false, msg: String(e.message || "No se pudo empezar.") }; }
    this.status = "playing"; this.touch();
    this.syncPresence();
    this.broadcast();
    return { ok: true };
  }

  /* ---------- partida ---------- */
  command(p, cmd, args) {
    if (this.status !== "playing") return { ok: false, msg: "No hay partida en curso." };
    this.touch();
    const res = this.game.exec(p.slot, cmd, args, { isHost: p.host });
    if (this.game.ended() && this.status === "playing") { this.status = "ended"; this.endedAt = this.mgr.now(); }
    this.broadcast();
    /* F3: la respuesta lleva la vista del propio jugador (con `ver`) para que el cliente no dependa del orden entre SSE y POST */
    if (res && typeof res === "object") { try { return Object.assign({}, res, { view: JSON.parse(this.withVer(JSON.stringify(this.viewFor(p)))) }); } catch (e) { return res; } }
    return res;
  }
  withVer(json) { return json.length > 2 ? '{"ver":' + this.ver + "," + json.slice(1) : json; }
  syncPresence() {
    if (!this.game) return;
    const online = {};
    this.players.forEach((p) => { online[p.slot] = p.conns.size > 0; });
    const h = this.hostPlayer();
    this.game.presence = { online, host: h ? h.slot : -1 };
  }

  /* ---------- SSE ---------- */
  connect(p, res) {
    res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no", "Access-Control-Allow-Origin": "*" });
    res.write("retry: 2000\n\n");
    while (p.conns.size >= MAX_CONN_PER_PLAYER) { const old = p.conns.values().next().value; p.conns.delete(old); try { old.end(); } catch (e) { /* ya cerrada */ } }
    p.conns.add(res); p.lastSeen = this.mgr.now(); this.touch();
    res.on("close", () => { p.conns.delete(res); this.touch(); this.onPresenceChange(p); });
    p.lastJson = null; /* fuerza el envío completo al reconectar */
    this.onPresenceChange(p, true);
    this.sendTo(p);
  }
  onPresenceChange(p, connected) {
    /* F5: aquí irá la ausencia y la gracia de reconexión. Esqueleto: si el anfitrión pierde todas sus conexiones
       en partida, el papel pasa al primer jugador conectado. */
    if (!connected && this.status === "playing" && p.host && p.conns.size === 0) {
      const alt = this.players.find((x) => x.conns.size > 0);
      if (alt) { p.host = false; alt.host = true; }
    }
    this.syncPresence(); this.broadcast();
  }
  lobbyView(p) {
    return { phase: "lobby", code: this.code, serverNow: this.mgr.now(), youId: p.slot, host: p.host, min: MIN_PLAYERS, max: MAX_PLAYERS,
      canStart: p.host && this.players.length >= MIN_PLAYERS,
      players: this.players.map((x) => ({ id: x.slot, name: x.name, host: x.host, online: x.conns.size > 0 })) };
  }
  viewFor(p) { return this.status === "lobby" ? this.lobbyView(p) : this.game.view(p.slot); }
  sendTo(p) {
    if (!p.conns.size) return;
    let json;
    try { json = JSON.stringify(this.viewFor(p)); } catch (e) { json = JSON.stringify({ phase: "error", msg: "Error interno de la sala." }); }
    if (json === p.lastJson) return;
    p.lastJson = json;
    const msg = "event: view\ndata: " + this.withVer(json) + "\n\n";
    p.conns.forEach((r) => { try { r.write(msg); } catch (e) { /* se limpia en close */ } });
  }
  broadcast() { this.ver++; this.players.forEach((p) => this.sendTo(p)); }
  heartbeat() { this.players.forEach((p) => p.conns.forEach((r) => { try { r.write(":hb\n\n"); } catch (e) { /* idem */ } })); }
  destroy() {
    this.players.forEach((p) => { closeAll(p); this.mgr.dropToken(p.tokenHash); });
    this.players = []; this.game = null;
  }
}
function closeAll(p) { p.conns.forEach((r) => { try { r.end(); } catch (e) { /* idem */ } }); p.conns.clear(); }

class Rooms {
  /* opts: { engineDir, maxRooms, now, idleMs, endedMs, maxAgeMs } */
  constructor(opts) {
    this.engineDir = opts.engineDir;
    this.maxRooms = opts.maxRooms || 50;
    this.now = opts.now || Date.now;
    this.idleMs = opts.idleMs || 30 * 60000; this.endedMs = opts.endedMs || 15 * 60000; this.maxAgeMs = opts.maxAgeMs || 4 * 3600000;
    this.rooms = new Map();   /* code -> Room */
    this.tokens = new Map();  /* sha256(token) -> { room, player } */
  }
  indexToken(h, room, player) { this.tokens.set(h, { room, player }); }
  dropToken(h) { this.tokens.delete(h); }
  newCode() {
    for (let i = 0; i < 50; i++) {
      let c = ""; const b = crypto.randomBytes(5);
      for (let k = 0; k < 5; k++) c += CODE_ALPHABET[b[k] % CODE_ALPHABET.length];
      if (!this.rooms.has(c)) return c;
    }
    return null;
  }
  create(name) {
    if (this.rooms.size >= this.maxRooms) return { ok: false, msg: "El servidor está lleno ahora mismo. Prueba en unos minutos." };
    const code = this.newCode();
    if (!code) return { ok: false, msg: "No se pudo crear la sala." };
    const room = new Room(code, this);
    const r = room.join(name);
    if (!r.ok) return r;
    this.rooms.set(code, room);
    return r;
  }
  get(code) { return this.rooms.get(String(code || "").toUpperCase()) || null; }
  byToken(token) {
    if (typeof token !== "string" || token.length !== 32 || !/^[0-9a-f]+$/.test(token)) return null;
    return this.tokens.get(sha(token)) || null;
  }
  /* Limpieza: salas sin conexiones desde hace idleMs, terminadas hace endedMs o con más de maxAgeMs. */
  sweep() {
    const t = this.now(); let n = 0;
    for (const [code, r] of this.rooms) {
      const idle = r.connectedCount() === 0 && t - r.lastActivity > this.idleMs;
      const ended = r.status === "ended" && r.endedAt && t - r.endedAt > this.endedMs;
      const old = t - r.createdAt > this.maxAgeMs;
      if (idle || ended || old) { r.destroy(); this.rooms.delete(code); n++; }
    }
    return n;
  }
  heartbeat() { this.rooms.forEach((r) => r.heartbeat()); }
  closeAll() { this.rooms.forEach((r) => r.destroy()); this.rooms.clear(); this.tokens.clear(); }
}

module.exports = { Room, Rooms, cleanName, MIN_PLAYERS, MAX_PLAYERS };
