"use strict";
/* Salas: lobby, jugadores con token, transporte SSE y difusión de la vista filtrada. Un contexto vm (Game) por sala. */
const crypto = require("node:crypto");
const { Game } = require("./game");
const { makeCodec, SCHEMA } = require("./snapshot");

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ"; /* sin I ni O */
const MIN_PLAYERS = 2, MAX_PLAYERS = 10, NAME_MAX = 16;
const HOST_MS = 30000;
const SNAP_EVERY_MS = 10000;  /* máximo de pérdida si el proceso muere sin avisar (kill -9): cambios menores se instantanean cada 10 s */
const VER_JUMP = 1000000;     /* al restaurar, `ver` salta para que ningún cliente descarte las vistas nuevas por «viejas» */
const HOST_GRACE_MS = 60000;   /* anfitrión sin conexión: tras esto el papel pasa al siguiente conectado */

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
    this.npcs = [];                   /* NPC añadidos en la sala de espera: { name, profile } (ocupan los asientos tras los humanos) */
    this.game = null;
    this.hostOffSince = null; this.hostNote = null; this.noteSeq = 0;
    this.snapSeq = 0; this.lastBlob = null; this.snapKey = null; this.snapDirty = false; this.lastSnapAt = 0;
  }
  /* ---------- instantáneas ---------- */
  snapKeyNow() {
    if (this.status === "lobby") return "L" + this.players.map((p) => p.name + (p.host ? "*" : "")).join("|") + "#" + this.npcs.map((n) => n.name + ":" + n.profile).join("|");
    const S = this.game && this.game.S();
    return S ? [this.status, S.phase, S.round, S.timeAsk ? 1 : 0, S.maxRounds, this.game.clock ? this.game.clock.kind : "-"].join("|") : this.status;
  }
  snapshotPlain() {
    const m = this.mgr;
    return { schema: SCHEMA, engine: m.snap.engine, code: this.code, seq: ++this.snapSeq, savedAt: m.now(),
      room: { status: this.status, createdAt: this.createdAt, ver: this.ver, hostNote: this.hostNote, noteSeq: this.noteSeq,
        npcs: this.npcs.map((n) => ({ name: n.name, profile: n.profile })),
        players: this.players.map((p) => ({ slot: p.slot, name: p.name, tokenHash: p.tokenHash, host: p.host })) },
      game: this.game ? this.game.snapshot() : null };
  }
  /* Genera el blob (cifrado, opaco) y lo envía por SSE a cada jugador conectado. Devuelve el blob o null. */
  takeSnapshot(force) {
    this.snapDirty = false; this.lastSnapAt = this.mgr.now();
    if (!this.mgr.snap.enabled || this.status === "ended" || (this.game && this.game.ended())) return null;
    if (!force && this.connectedCount() === 0) return null;
    let blob = null;
    try { blob = this.mgr.snap.encode(this.snapshotPlain(), this.code); } catch (e) { this.mgr.log("snapshot falló: " + (e && e.message)); return null; }
    if (!blob) return null;
    this.lastBlob = blob;
    this.sendBlob(blob);
    return blob;
  }
  sendBlob(blob, only) {
    const msg = "event: snapshot\ndata: " + blob + "\n\n";
    (only ? [only] : this.players).forEach((p) => p.conns.forEach((r) => { try { r.write(msg); } catch (e) { /* idem */ } }));
  }
  maybeSnapshot() {
    this.snapDirty = true;
    const k = this.snapKeyNow();
    if (k !== this.snapKey && this.takeSnapshot()) this.snapKey = k;
  }
  /* Reconstruye una sala desde una instantánea ya descifrada y validada. Todos los jugadores quedan desconectados. */
  static fromSnapshot(code, mgr, plain) {
    const r = new Room(code, mgr), t = mgr.now(), shift = Math.max(0, t - plain.savedAt);
    const rm = plain.room;
    r.status = rm.status === "playing" ? "playing" : "lobby";
    r.createdAt = t - Math.max(0, plain.savedAt - rm.createdAt); r.lastActivity = t;
    r.ver = (Number(rm.ver) || 0) + VER_JUMP; r.hostNote = rm.hostNote || null; r.noteSeq = rm.noteSeq || 0;
    r.snapSeq = plain.seq;
    r.npcs = Array.isArray(rm.npcs) ? rm.npcs.map((n) => ({ name: String(n.name), profile: String(n.profile) })) : [];
    r.players = rm.players.map((p) => ({ slot: p.slot, name: p.name, tokenHash: p.tokenHash, host: !!p.host, conns: new Set(), lastJson: null, lastSeen: t }));
    if (r.status === "playing") {
      r.game = Game.restore(plain.game, { engineDir: mgr.engineDir, now: mgr.now, readMs: mgr.readMs, timeScale: mgr.timeScale, shift, graceTurnMs: mgr.restoreGraceTurnMs, graceMs: mgr.restoreGraceMs });
      if (r.hostNote) r.game.hostNote = r.hostNote;
    }
    if (!r.players.some((p) => p.host) && r.players[0]) r.players[0].host = true;
    r.hostOffSince = t + Math.round(HOST_GRACE_MS * (mgr.timeScale > 0 ? mgr.timeScale : 1));
    r.snapDirty = true; r.snapKey = null;
    r.syncPresence();   /* todos desconectados */
    return r;
  }
  hostMs() { const sc = this.mgr.timeScale; return Math.round(HOST_MS * (sc > 0 ? sc : 1)); }
  touch() { this.lastActivity = this.mgr.now(); }
  hostPlayer() { return this.players.find((p) => p.host) || null; }
  connectedCount() { return this.players.reduce((n, p) => n + p.conns.size, 0); }

  /* ---------- lobby ---------- */
  join(name) {
    if (this.status !== "lobby") return { ok: false, msg: "La partida ya ha empezado." };
    if (this.players.length + this.npcs.length >= MAX_PLAYERS) return { ok: false, msg: "La sala está llena." };
    const n = cleanName(name);
    if (!n) return { ok: false, msg: "Escribe un nombre (1-16 caracteres)." };
    if (this.players.some((p) => p.name.toLowerCase() === n.toLowerCase()) || this.npcs.some((x) => x.name.toLowerCase() === n.toLowerCase())) return { ok: false, msg: "Ese nombre ya está en la sala." };
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
    /* en partida no se elimina al jugador: queda desconectado (pasará a ausente tras 2 rondas) */
    closeAll(p);
    if (p.host) this.passHost(p);
    this.syncPresence(); this.broadcast();
    return { ok: true };
  }
  /* NPC en la sala de espera: solo el anfitrión añade o quita. op: "add" (profile opcional) | "remove" (index). */
  npcOp(p, b) {
    if (!p.host) return { ok: false, msg: "Solo el anfitrión puede añadir o quitar NPC." };
    if (this.status !== "lobby") return { ok: false, msg: "La partida ya ha empezado." };
    const D = this.mgr.npcData();
    if (b && b.op === "remove") {
      const i = Number(b.index);
      if (!Number.isInteger(i) || i < 0 || i >= this.npcs.length) return { ok: false, msg: "Ese NPC no existe." };
      this.npcs.splice(i, 1);
    } else if (b && b.op === "add") {
      if (this.players.length + this.npcs.length >= MAX_PLAYERS) return { ok: false, msg: "La sala está llena." };
      const ids = Object.keys(D.profiles);
      const profile = ids.indexOf(b.profile) !== -1 ? b.profile : ids[(this.npcs.length + this.players.length) % ids.length];
      const used = this.players.map((x) => x.name).concat(this.npcs.map((x) => x.name));
      let name = null;
      for (let k = 0; k < D.names.length && !name; k++) { const c = D.names[(this.npcs.length * 7 + k) % D.names.length]; if (used.every((u) => u.toLowerCase() !== c.toLowerCase())) name = c; }
      if (!name) name = "NPC " + (this.npcs.length + 1);
      this.npcs.push({ name, profile });
    } else return { ok: false, msg: "Orden de NPC no válida." };
    this.touch(); this.broadcast();
    return { ok: true };
  }
  start(p, endAt) {
    if (!p.host) return { ok: false, msg: "Solo el anfitrión puede empezar." };
    if (this.status !== "lobby") return { ok: false, msg: "La partida ya ha empezado." };
    if (this.players.length + this.npcs.length < MIN_PLAYERS) return { ok: false, msg: "Hacen falta al menos " + MIN_PLAYERS + " jugadores (contando NPC)." };
    endAt = Number(endAt);
    const mins = (endAt - this.mgr.now()) / 60000;
    if (!isFinite(mins) || mins < 5 || mins > 120) return { ok: false, msg: "La hora de fin debe estar entre 5 y 120 minutos desde ahora." };
    try {
      this.game = new Game(this.players.map((x) => x.name).concat(this.npcs.map((x) => x.name)), { engineDir: this.mgr.engineDir, endAt, now: this.mgr.now, readMs: this.mgr.readMs, timeScale: this.mgr.timeScale,
        npc: this.players.map(() => null).concat(this.npcs.map((x) => x.profile)) });
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
    this.game.setPresence(online, h ? h.slot : -1);
  }
  /* Traspaso del anfitrión al siguiente jugador conectado (por orden de asiento). El anterior no lo recupera solo. */
  passHost(from) {
    const n = this.players.length; if (!n) return false;
    for (let k = 1; k <= n; k++) {
      const x = this.players[(from.slot + k) % n];
      if (x !== from && x.conns.size > 0) {
        from.host = false; x.host = true; this.hostOffSince = null;
        this.hostNote = { name: x.name, seq: ++this.noteSeq };
        if (this.game) this.game.hostNote = this.hostNote;
        return true;
      }
    }
    return false;
  }
  checkHost() {
    const h = this.hostPlayer();
    if (!h || h.conns.size > 0) { this.hostOffSince = null; return false; }
    const t = this.mgr.now();
    if (this.hostOffSince == null) { this.hostOffSince = t; return false; }
    if (t - this.hostOffSince < this.hostMs()) return false;
    if (!this.passHost(h)) return false;
    this.syncPresence();
    return true;
  }
  /* Reloj del servidor: autoturno, límites de Consejo/continuar, votación de tiempo. Cada segundo desde Rooms.tick. */
  tick() {
    if (this.status === "ended") return;
    if (this.snapDirty && this.mgr.now() - this.lastSnapAt >= SNAP_EVERY_MS * (this.mgr.timeScale > 0 ? this.mgr.timeScale : 1)) this.takeSnapshot();
    let changed = false;
    if (this.checkHost()) changed = true;
    if (this.status !== "playing" || !this.game) { if (changed) this.broadcast(); return; }
    try { changed = this.game.tick(); } catch (e) { this.game.errors.push(String(e && e.stack || e)); }
    if (this.game.ended() && this.status === "playing") { this.status = "ended"; this.endedAt = this.mgr.now(); changed = true; }
    if (changed) this.broadcast();
  }

  /* ---------- SSE ---------- */
  connect(p, res) {
    res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no", "Access-Control-Allow-Origin": "*" });
    res.write("retry: 2000\n\n");
    /* Una sola conexión por jugador: la nueva (otra pestaña/dispositivo) reemplaza a la anterior y esta recibe «replaced». */
    p.conns.forEach((old) => { p.conns.delete(old); try { old.write("event: replaced\ndata: 1\n\n"); old.end(); } catch (e) { /* ya cerrada */ } });
    p.conns.add(res); p.lastSeen = this.mgr.now(); this.touch();
    res.on("close", () => { p.conns.delete(res); this.touch(); this.onPresenceChange(p); });
    p.lastJson = null; /* fuerza el envío completo al reconectar */
    this.onPresenceChange(p, true);
    this.sendTo(p);
    if (this.mgr.snap.enabled && this.lastBlob && this.status !== "ended") this.sendBlob(this.lastBlob, p);
  }
  onPresenceChange(p, connected) {
    /* La ausencia y la gracia de reconexión viven en Game (offlineSince, 10 s de gracia, 2 rondas). El anfitrión caído
       pasa el papel desde tick() tras 30 s. Volver antes de eso lo conserva. */
    if (p.host && p.conns.size === 0) { if (this.hostOffSince == null) this.hostOffSince = this.mgr.now(); }
    else if (p.host) this.hostOffSince = null;
    this.syncPresence(); this.broadcast();
  }
  lobbyView(p) {
    return { phase: "lobby", hostNote: this.hostNote, code: this.code, serverNow: this.mgr.now(), youId: p.slot, host: p.host, min: MIN_PLAYERS, max: MAX_PLAYERS,
      canStart: p.host && this.players.length + this.npcs.length >= MIN_PLAYERS,
      npcs: this.npcs.map((n, i) => ({ id: i, name: n.name, profile: n.profile })),
      profiles: this.mgr.npcData().profiles,
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
  broadcast() { this.ver++; this.players.forEach((p) => this.sendTo(p)); this.maybeSnapshot(); }
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
    this.readMs = opts.readMs; this.timeScale = opts.timeScale;
    this.maxRooms = opts.maxRooms || 50;
    this.now = opts.now || Date.now;
    this.idleMs = opts.idleMs || 30 * 60000; this.endedMs = opts.endedMs || 15 * 60000; this.maxAgeMs = opts.maxAgeMs || 4 * 3600000;
    this.log = opts.log || ((m) => console.log(m));
    this.snap = makeCodec({ key: opts.snapshotKey, engineDir: opts.engineDir, log: this.log });
    this.restoreWindowMs = opts.restoreWindowMs != null ? opts.restoreWindowMs : 5000;
    this.restoreGraceTurnMs = opts.restoreGraceTurnMs; this.restoreGraceMs = opts.restoreGraceMs;
    this.staged = new Map();  /* code -> { best, waiters, timer }: restauraciones en ventana (gana el mayor seq) */
    this.retired = new Map(); /* code -> seq (Infinity si terminó): salas ya cerradas en este proceso, no se resucitan con blobs viejos */
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
  /* Perfiles y nombres de NPC (de data.js; se leen una vez). */
  npcData() {
    if (!this._npcData) { const { loadEngine } = require("./engine_vm"); const e = loadEngine({ dir: this.engineDir }); this._npcData = { profiles: JSON.parse(JSON.stringify(e.D.NPC_PROFILES)), names: e.D.NPC_NAMES.slice() }; }
    return this._npcData;
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
      if (idle || ended || old) { this.retire(r); r.destroy(); this.rooms.delete(code); n++; }
    }
    return n;
  }
  retire(r) { this.retired.set(r.code, r.status === "ended" ? Infinity : r.snapSeq); if (this.retired.size > 2000) this.retired.delete(this.retired.keys().next().value); }
  /* Restauración desde el blob de un jugador. Devuelve Promise<{status, json}>. El primero abre una ventana (restoreWindowMs):
     gana la instantánea de mayor seq entre las recibidas; la sala se crea al cerrarse y todos los que esperan reciben la respuesta. */
  restore(code, blob, token) {
    const done = (status, json) => Promise.resolve({ status, json });
    code = String(code || "").toUpperCase();
    if (!/^[A-Z]{5}$/.test(code)) return done(400, { ok: false, msg: "Código de sala no válido." });
    const who = this.byToken(token), ex = this.rooms.get(code);
    if (ex) return done(who && who.room === ex ? 200 : 401, who && who.room === ex ? { ok: true, existed: true } : { ok: false, msg: "Sesión no válida." });
    if (!this.snap.enabled) return done(404, { ok: false, msg: "La restauración no está activada en este servidor." });
    if (typeof token !== "string" || !/^[0-9a-f]{32}$/.test(token)) return done(401, { ok: false, msg: "Sesión no válida." });
    const d = this.snap.decode(blob, code);
    if (!d.ok) return done(d.reason === "engine" || d.reason === "schema" ? 409 : 400, { ok: false, reason: d.reason, msg: d.reason === "engine" || d.reason === "schema" ? "El servidor se actualizó y no puede recuperar esta partida." : "Instantánea no válida." });
    const plain = d.plain, th = sha(token);
    if (!Array.isArray(plain.room && plain.room.players) || !plain.room.players.some((p) => p.tokenHash === th)) return done(401, { ok: false, msg: "Sesión no válida." });
    if (!isFinite(plain.savedAt) || this.now() - plain.savedAt > this.maxAgeMs || plain.savedAt > this.now() + 60000) return done(410, { ok: false, msg: "La instantánea ha caducado." });
    if ((this.retired.get(code) || -1) >= plain.seq) return done(410, { ok: false, msg: "Esa sala ya se cerró." });
    if (this.rooms.size + this.staged.size >= this.maxRooms) return done(503, { ok: false, msg: "El servidor está lleno ahora mismo." });
    let st = this.staged.get(code);
    if (!st) {
      st = { best: plain, waiters: [], timer: null };
      this.staged.set(code, st);
      st.timer = setTimeout(() => this.finishStage(code), this.restoreWindowMs);
    } else if (plain.seq > st.best.seq) st.best = plain;
    return new Promise((resolve) => { st.waiters.push(resolve); });
  }
  finishStage(code) {
    const st = this.staged.get(code); if (!st) return;
    this.staged.delete(code); clearTimeout(st.timer);
    let res;
    try {
      if (this.rooms.has(code)) res = { status: 200, json: { ok: true, existed: true } };
      else {
        const room = Room.fromSnapshot(code, this, st.best);
        this.rooms.set(code, room);
        room.players.forEach((p) => this.indexToken(p.tokenHash, room, p));
        this.log("sala " + code + " restaurada (seq " + st.best.seq + ", " + room.players.length + " jugadores, " + room.status + ")");
        res = { status: 200, json: { ok: true, restored: true, seq: st.best.seq } };
      }
    } catch (e) { this.log("restauración de " + code + " falló: " + (e && e.message)); res = { status: 400, json: { ok: false, msg: "No se pudo restaurar la partida." } }; }
    st.waiters.forEach((w) => w(res));
  }
  /* Apagado ordenado: instantánea final de cada sala (con jugadores conectados) ANTES de cerrar los SSE. */
  snapshotAll() { let n = 0; this.rooms.forEach((r) => { try { if (r.takeSnapshot(true)) n++; } catch (e) { /* idem */ } }); return n; }
  heartbeat() { this.rooms.forEach((r) => r.heartbeat()); }
  tick() { this.rooms.forEach((r) => r.tick()); }
  closeAll() { this.staged.forEach((st) => clearTimeout(st.timer)); this.staged.clear(); this.rooms.forEach((r) => r.destroy()); this.rooms.clear(); this.tokens.clear(); }
}

module.exports = { Room, Rooms, cleanName, MIN_PLAYERS, MAX_PLAYERS };
