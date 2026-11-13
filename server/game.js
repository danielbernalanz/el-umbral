"use strict";
/* Una partida: motor en su contexto vm + capa de comandos por jugador (cambio de contexto de turno),
   barreras de fase, retención de notas/crónica ajenas y vista filtrada. Sin red: lo usa room.js y los tests. */
const { loadEngine } = require("./engine_vm");
const view = require("./view");
const { shielded } = require("./order");

/* Tiempos de la fase simultánea (ms). timeScale solo se usa en pruebas rápidas. */
const T = { warn: 15000, grace: 25000, offline: 10000, cont: 30000, vote: 30000, read: 10000 };
const READ_MSG = "Aún estás leyendo la ronda: espera unos segundos antes de actuar sobre otros.";

const GENERIC_BAD_TARGET = "Objetivo no válido.";
const NOT_NOW = "Ahora no puedes hacer eso.";
const bad = (msg) => ({ ok: false, msg });
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const isStr = (v, max) => typeof v === "string" && v.length > 0 && v.length <= (max || 40);
const isIdOrNull = (v) => v === null || v === undefined || isInt(v, 0, 9);
const isIdStr = (v) => isStr(v, 40) || isInt(v, 0, 1e9);

class Game {
  /* names: nombres de los jugadores (índice = id de jugador). opts: { engineDir, endAt, now, rng } */
  constructor(names, opts) {
    opts = opts || {};
    this.now = opts.now || Date.now;
    const sc = Number(opts.timeScale != null ? opts.timeScale : process.env.UMBRAL_TIME_SCALE);
    this.scale = isFinite(sc) && sc > 0 ? sc : 1;
    const rd = Number(opts.readMs != null ? opts.readMs : process.env.UMBRAL_READ_MS);
    this.readMs = isFinite(rd) && rd >= 0 && (opts.readMs != null || process.env.UMBRAL_READ_MS != null) ? rd : T.read;
    this.offlineSince = {}; this._tw = false;
    this.absent = new Set(); this.offRounds = {}; this._absRound = -1; this.roundStart = this.now();
    this.clock = null;
    const eng = loadEngine({ dir: opts.engineDir, rng: opts.rng, now: this.now });
    this.U = eng.U; this.D = eng.D; this.ctx = eng.ctx;
    const endAt = Number(opts.endAt);
    const minutes = Math.round((endAt - this.now()) / 60000);
    if (!isFinite(endAt) || minutes < 5 || minutes > 120) throw new Error("La hora de fin debe estar entre 5 y 120 minutos desde ahora.");
    if (!Array.isArray(names) || names.length < 3 || names.length > 10) throw new Error("La partida admite de 3 a 10 jugadores.");
    this.U.createGame(names, { minutes, endAt });
    this.presence = { online: {}, host: 0 };
    this.errors = [];
    this.votes = {};
    this.councilResults = null;
    this._endCache = null;
    this.afterRoundStart();
    this.advance();
  }

  S() { return this.U.getState(); }
  get phase() { return this.S().phase; }
  playerCount() { return this.S().players.length; }
  ms(x) { return Math.max(0, Math.round(x * this.scale)); }

  /* ---------- hooks de fase ---------- */
  afterRoundStart() {
    const S = this.S();
    this.pctx = {};                       /* pendingPush por jugador (la tirada que se puede empujar) */
    this.ready = new Set();               /* han entregado el turno privado */
    this.councilReady = new Set();
    this.contReady = new Set();
    this.held = {};                       /* notas retenidas por jugador: Set de índices */
    this.fresh = {};                      /* avisos de desbloqueo de la ronda */
    this.votes = {};
    this.councilResults = null;
    this.roundStart = this.now();
    this.chronVisible = S.chronicle.length; /* crónica publicable durante la fase privada */
    if (S.phase === "private") {
      S.players.forEach((p) => { if (p.dead || p.acted) this.ready.add(p.id); });
      S.players.forEach((p) => this.refresh(p.id));
      const t = this.now(), dl = t + this.ms(this.U.turnSeconds() * 1000);
      this.clock = { kind: "turn", start: t, readUntil: t + this.readMs, warnAt: dl - this.ms(T.warn), deadline: dl, autoAt: dl + this.ms(T.grace) };
      this.absentTurns();
    } else { this.onLeavePrivate(); this.clock = null; }
  }
  /* ---------- ausencia (F5) ---------- */
  isAbsent(pid) { return this.absent.has(pid); }
  doneIn(p, set) { return p.dead || set.has(p.id) || (this.absent.has(p.id) && this.S().phase !== "private"); }  /* en la fase privada el ausente medita de verdad (absentTurns) */
  allAbsent() { const al = this.S().players.filter((p) => !p.dead); return al.length > 0 && al.every((p) => this.absent.has(p.id)); }
  /* Al cerrar cada ronda: quien estuvo desconectado TODA la ronda suma 1; con 2 seguidas queda ausente. Quien está conectado
     vuelve (ausente=falso) al empezar la ronda siguiente. Una caída a mitad de ronda no suma ni borra la racha. */
  updateAbsence() {
    const S = this.S();
    if (this._absRound === S.round) return;
    this._absRound = S.round;
    S.players.forEach((p) => {
      if (p.dead) { this.absent.delete(p.id); return; }
      const off = this.offlineSince[p.id];
      if (off == null && this.isOnline(p.id)) { this.offRounds[p.id] = 0; this.absent.delete(p.id); }
      else if (off != null && off <= this.roundStart) { this.offRounds[p.id] = (this.offRounds[p.id] || 0) + 1; if (this.offRounds[p.id] >= 2) this.absent.add(p.id); }
    });
  }
  /* Los ausentes meditan siempre, sin esperar su turno. */
  absentTurns() {
    const S = this.S();
    S.players.forEach((p) => { if (!p.dead && this.absent.has(p.id) && S.phase === "private" && !this.ready.has(p.id)) this.autoComplete(p.id, true); });
  }
  setClock(kind, ms) { const t = this.now(); this.clock = { kind, start: t, deadline: t + ms }; }
  readLocked() { return !!(this.clock && this.clock.kind === "turn" && this.now() < this.clock.readUntil); }
  onLeavePrivate() { this.held = {}; this.chronVisible = Infinity; }

  /* Consultas IMPURAS del motor: se materializan aquí, en momentos conocidos, para que la vista sea pura.
     getOffer (genera la oferta con azar), unlockNotices (marca avisos y añade notas), encounterStart (tira el encuentro). */
  refresh(pid) {
    const S = this.S(), U = this.U, p = S.players[pid];
    if (!p || S.phase !== "private" || p.dead) return;
    view.asPlayer(this, pid, () => {
      if (!p.acted && !p.dying) U.getOffer(pid);
      const f = U.unlockNotices(p);
      if (f.length) this.fresh[pid] = (this.fresh[pid] || []).concat(f);
      if (p.acted && p.action === "explorar" && !this.pctx[pid]) U.encounterStart(pid);
    });
  }

  /* ---------- ejecución de comandos ---------- */
  /* Ejecuta fn como el jugador pid: fija turn/handoff/pendingPush, guarda el contexto y retiene lo que otros reciben. */
  _runAs(pid, fn) {
    const S = this.S(), U = this.U;
    const lens = S.players.map((p) => p.notes.length);
    const wasPrivate = S.phase === "private";
    const sv = { turn: S.turn, handoff: S.handoff };
    S.turn = pid; S.handoff = false; S.pendingPush = this.pctx[pid] || null;
    let res;
    try { res = wasPrivate ? shielded(S, pid, fn) : fn(); }
    catch (e) { this.errors.push(String(e && e.stack || e)); res = bad("Error interno."); }
    this.pctx[pid] = S.pendingPush && S.pendingPush.actorId === pid ? S.pendingPush : null;
    S.pendingPush = null; S.turn = sv.turn; S.handoff = sv.handoff;
    if (wasPrivate && S.phase === "private") {
      S.players.forEach((q, i) => {
        if (q.id === pid) return;
        for (let k = lens[i]; k < q.notes.length; k++) (this.held[q.id] || (this.held[q.id] = new Set())).add(k);
      });
    } else if (S.phase !== "private") this.onLeavePrivate();
    return res === undefined ? { ok: true } : JSON.parse(JSON.stringify(res));
  }

  /* cmd: nombre; args: array. meta: { isHost }. Devuelve {ok,...}. Los errores son genéricos respecto a otros jugadores. */
  exec(pid, cmd, args, meta) {
    const S = this.S();
    if (!S || !isInt(pid, 0, 9) || !S.players[pid]) return bad("Jugador desconocido.");
    const spec = COMMANDS[cmd];
    if (!spec || !Array.isArray(args)) return bad("Comando desconocido.");
    if (Array.isArray(spec.phase) ? spec.phase.indexOf(S.phase) === -1 : spec.phase !== S.phase) return bad(NOT_NOW);
    if (!spec.check(this, pid, args)) return bad("Argumentos no válidos.");
    const res = spec.run(this, pid, args, meta || {});
    this.afterCommand(pid);
    return res;
  }

  afterCommand(pid) {
    const S = this.S();
    if (S.phase === "private") {
      this.invalidateStale(); this.refresh(pid);
      /* quien cae moribundo a mitad de ronda no puede elegir nada: queda listo (cierra el acted=true «sin elegir») */
      S.players.forEach((q) => { if (!q.dead && q.dying && q.acted) this.ready.add(q.id); });
    }
    this.advance();
  }

  /* Las ofertas se materializan al empezar la ronda (el motor las generaba al llegar el turno). Si otro jugador
     acepta la tentación mientras tanto, las ofertas de Asesino ya pendientes dejan de existir: así nadie recibe
     «El Umbral ya tiene un Asesino» (que delataría que alguien lo es). */
  invalidateStale() {
    const S = this.S();
    if (!S.players.some((p) => p.alignment === "asesino")) return;
    S.players.forEach((p) => { if (p.offer && p.offer.id === "asesino" && !p.offer.done) p.offer = false; });
  }

  /* ---------- barreras ---------- */
  advance() {
    const S = this.S(), U = this.U;
    for (let guard = 0; guard < 8; guard++) {
      const ph = S.phase;
      if (ph === "private") {
        if (!S.players.every((p) => this.doneIn(p, this.ready))) return;
        const ord = S.order || S.players.map((p) => p.id);
        S.turn = ord[ord.length - 1]; S.handoff = false; S.pendingPush = null;
        const r = U.nextTurn();
        if (r === "blocked") { this.errors.push("barrera bloqueada"); return; }
        if (S.phase === "private") return;
        this.onLeavePrivate();
        this.councilReady = new Set(S.players.filter((p) => p.dead).map((p) => p.id));
        this.councilResults = null;
        S.turn = 0;
        this.setClock("council", this.ms(this.U.councilSeconds() * 1000));
      } else if (ph === "council") {
        if (!S.players.every((p) => this.doneIn(p, this.councilReady))) return;
        this.closeCouncil();
        this.contReady = new Set(S.players.filter((p) => p.dead).map((p) => p.id));
        this.setClock("cont", this.ms(T.cont));
      } else if (ph === "resolution") {
        if (S.timeAsk) return;
        if (!S.players.every((p) => this.doneIn(p, this.contReady))) return;
        this.nextRound();
      } else return;
    }
  }
  closeCouncil() {
    const U = this.U;
    const list = U.resolveCouncil();
    this.councilResults = JSON.parse(JSON.stringify(list || []));
    U.endCouncil();
    this.chronVisible = Infinity;
  }
  nextRound() {
    const S = this.S(), U = this.U;
    this.updateAbsence();
    const e = U.nextRound();
    if (S.phase === "ending") return e;
    if (S.timeAsk) { this.votes = {}; this.setClock("vote", this.ms(T.vote)); return null; }
    this.afterRoundStart();
    return null;
  }
  /* El anfitrión (o, si cayó, el primer superviviente) decide al votar; sin decisión, a los 30 s gana la mayoría y el empate es +1 ronda. */
  decider() {
    const S = this.S(), h = this.presence && this.presence.host;
    if (Number.isInteger(h) && S.players[h] && !S.players[h].dead && !this.absent.has(h)) return h;
    const f = S.players.find((p) => !p.dead && !this.absent.has(p.id) && this.isOnline(p.id)) || S.players.find((p) => !p.dead && !this.absent.has(p.id));
    return f ? f.id : -1;
  }
  applyTimeAnswer(choice) {
    const r = JSON.parse(JSON.stringify(this.U.answerTime(choice)));
    if (r.ok && !r.ended) this.nextRound();
    return r;
  }
  voteWinner() {
    const S = this.S(), c = { 1: 0, 2: 0, end: 0 };
    Object.keys(this.votes).forEach((id) => { const p = S.players[id]; if (p && !p.dead && !this.absent.has(p.id) && c[this.votes[id]] !== undefined) c[this.votes[id]]++; });
    if (this.allAbsent()) return "end";   /* nadie que decida: la mesa vacía cierra la partida */
    const m = Math.max(c[1], c[2], c.end), top = [1, 2, "end"].filter((k) => c[k] === m);
    return top.length === 1 ? top[0] : 1;
  }
  setPresence(online, host) {
    const t = this.now();
    Object.keys(online).forEach((id) => { if (online[id] === false) { if (this.offlineSince[id] == null) this.offlineSince[id] = t; } else delete this.offlineSince[id]; });
    this.presence = { online, host };
  }
  isOnline(pid) { return !(this.presence && this.presence.online) || this.presence.online[pid] !== false; }

  /* ---------- reloj del servidor (se llama cada segundo; devuelve true si algo cambió) ---------- */
  pendingSet() {
    const S = this.S();
    const set = S.phase === "private" ? this.ready : S.phase === "council" ? this.councilReady : S.phase === "resolution" && !S.timeAsk ? this.contReady : null;
    return set ? S.players.filter((p) => !this.doneIn(p, set)) : [];
  }
  tick() {
    const S = this.S();
    if (!S || S.phase === "ending") return false;
    const t = this.now(), ph = S.phase; let changed = false;
    const tw = !!this.U.timeWarn();
    if (tw !== this._tw) { this._tw = tw; changed = true; }
    if (ph === "resolution" && S.timeAsk) {
      if (this.allAbsent() || (this.clock && t >= this.clock.deadline)) { this.applyTimeAnswer(this.voteWinner()); return true; }
      return changed;
    }
    const ck = this.clock;
    const pend = this.pendingSet();
    /* Desconexión acelerada: si solo faltan jugadores desconectados (y hay alguien conectado), no se espera al límite. */
    let fast = false;
    if (pend.length && pend.every((p) => !this.isOnline(p.id)) && S.players.some((p) => !p.dead && this.isOnline(p.id))) {
      fast = pend.every((p) => this.offlineSince[p.id] != null && t - this.offlineSince[p.id] >= this.ms(T.offline));
    }
    if (ph === "private") {
      if ((ck && t >= ck.autoAt) || (fast && pend.length)) { this.forceAdvance(); changed = true; }
    } else if (ck && (t >= ck.deadline || (fast && pend.length))) { this.forceAdvance(); changed = true; }
    return changed;
  }
  /* Completa lo que falta del turno de pid sin perder lo hecho: meditar si aún no actuó, y entrega (se omite la declaración). */
  autoComplete(pid, absent) {
    const S = this.S(), p = S.players[pid];
    if (!p || p.dead || S.phase !== "private" || this.ready.has(pid)) return;
    if (p.dying) { this.ready.add(pid); return; }
    const did = p.acted;
    if (!did) {
      const r = this.exec(pid, "act", ["meditar", null, null]);
      if (!r || r.ok === false) { this.errors.push("autoturno: no pudo meditar " + pid + " " + (r && r.msg)); return; }
    }
    if (S.phase !== "private") return;
    if (!this.ready.has(pid)) {
      p.notes.push("Ronda " + S.round + (absent ? ": sigues ausente (sin conexión): tu personaje medita hasta que vuelvas." : ": se acabó el tiempo de tu turno" + (did ? ": se omitió lo que faltaba." : ": meditaste (acción segura).")));
      const r = this.exec(pid, "finishTurn", []);
      if (!r || r.ok === false) this.errors.push("autoturno: no pudo entregar " + pid + " " + (r && r.msg));
    }
  }

  /* Cierre forzado por tiempo/anfitrión (los temporizadores de F4 usarán esto). */
  forceAdvance() {
    const S = this.S();
    if (S.phase === "private") { S.players.forEach((p) => { if (!p.dead && !this.ready.has(p.id) && this.S().phase === "private") this.autoComplete(p.id); }); }
    else if (S.phase === "council") S.players.forEach((p) => this.councilReady.add(p.id));
    else if (S.phase === "resolution" && S.timeAsk) { this.applyTimeAnswer(this.voteWinner()); return; }
    else if (S.phase === "resolution") S.players.forEach((p) => this.contReady.add(p.id));
    this.advance();
  }

  /* ---------- salida ---------- */
  view(pid) { return view.buildView(this, pid); }
  ended() { return this.phase === "ending"; }
  endLog() { if (!this._endCache) this._endCache = { log: this.U.exportLog(), story: this.U.exportStory(true) }; return this._endCache.log; }
  endStory() { this.endLog(); return this._endCache.story; }
  endStoryList() { this.endLog(); if (!this._endCache.list) this._endCache.list = JSON.parse(JSON.stringify(this.U.buildStory() || [])); return this._endCache.list; }
}

/* ---------- tabla de comandos: fase, validación de argumentos, ejecución ---------- */
const priv = (check, run) => ({ phase: "private", check, run });
const COMMANDS = {
  act: priv(
    (g, pid, a) => isStr(a[0]) && isIdOrNull(a[1]) && (a[2] == null || isIdStr(a[2])),
    (g, pid, a) => {
      const D = g.D, act = D.ACTIONS.find((x) => x.id === a[0]);
      if (act && act.target) {
        const ok = (view.targetsFor(g, pid)[act.id] || []).indexOf(a[1]) !== -1;
        if (!ok) return bad(GENERIC_BAD_TARGET);
        if (g.readLocked()) return bad(READ_MSG);
      }
      return g._runAs(pid, () => g.U.act(pid, a[0], act && act.target ? a[1] : null, a[2] == null ? null : a[2]));
    }),
  pushLuck: priv((g, pid, a) => a.length === 0, (g, pid) => g._runAs(pid, () => g.U.pushLuck(pid))),
  cast: priv(
    (g, pid, a) => isIdStr(a[0]) && isIdOrNull(a[1]) && (a[2] == null || isStr(a[2], 12)),
    (g, pid, a) => {
      const sp = (g.S().players[pid].spells || []).find((s) => s.id === a[0]);
      if (sp && sp.target && view.aliveOthers(g, pid).indexOf(a[1]) === -1) return bad(GENERIC_BAD_TARGET);
      if (sp && sp.target && g.readLocked()) return bad(READ_MSG);
      return g._runAs(pid, () => g.U.cast(pid, a[0], sp && sp.target ? a[1] : null, a[2] || "normal"));
    }),
  useItem: priv(
    (g, pid, a) => isInt(a[0], 0, 30) && isIdOrNull(a[1]),
    (g, pid, a) => {
      if (a[1] != null && view.aliveOthers(g, pid).indexOf(a[1]) === -1) return bad(GENERIC_BAD_TARGET);
      if (a[1] != null && g.readLocked()) return bad(READ_MSG);
      return g._runAs(pid, () => g.U.useItem(pid, a[0], a[1] == null ? null : a[1]));
    }),
  study: priv((g, pid, a) => isInt(a[0], 0, 30), (g, pid, a) => g._runAs(pid, () => g.U.studyOptions(pid, a[0]))),
  learnSpell: priv((g, pid, a) => isInt(a[0], 0, 5) && isStr(a[1], 12), (g, pid, a) => g._runAs(pid, () => g.U.learnSpell(pid, a[0], a[1]))),
  improveSpell: priv((g, pid, a) => isIdStr(a[0]), (g, pid, a) => g._runAs(pid, () => g.U.improveSpell(pid, a[0]))),
  answerOffer: priv((g, pid, a) => typeof a[0] === "boolean", (g, pid, a) => g._runAs(pid, () => g.U.answerOffer(pid, a[0]))),
  answerHand: priv((g, pid, a) => typeof a[0] === "boolean", (g, pid, a) => g._runAs(pid, () => g.U.answerHand(pid, a[0]))),
  answerPact: priv(
    (g, pid, a) => isInt(a[0], 0, 20) && typeof a[1] === "boolean",
    (g, pid, a) => {
      /* idx local -> índice global del motor */
      const offers = view.asPlayer(g, pid, () => g.U.getPactOffers(pid));
      const o = offers[a[0]];
      if (!o) return bad("Esa propuesta ya no está disponible.");
      const gi = o.idx;
      return g._runAs(pid, () => g.U.answerPact(pid, gi, a[1]));
    }),
  declare: priv(
    (g, pid, a) => isStr(a[0], 24) && isIdOrNull(a[1]),
    (g, pid, a) => {
      if (a[0] !== "ninguna" && view.aliveOthers(g, pid).indexOf(a[1]) === -1) return bad(GENERIC_BAD_TARGET);
      if (a[0] === "romper") { const d = view.asPlayer(g, pid, () => g.U.declareOptions(pid)); if (!d || d.romper.indexOf(a[1]) === -1) return bad(GENERIC_BAD_TARGET); }
      return g._runAs(pid, () => g.U.declare(pid, a[0], a[0] === "ninguna" ? null : a[1]));
    }),
  encounterAct: priv((g, pid, a) => isStr(a[0], 24), (g, pid, a) => g._runAs(pid, () => g.U.encounterAct(pid, a[0]))),
  finishTurn: priv((g, pid, a) => a.length === 0, (g, pid) => {
    const r = g._runAs(pid, () => g.U.finishTurn());
    if (r && r.ok !== false) { g.ready.add(pid); return { ok: true }; }
    return r;
  }),
  councilReady: { phase: "council", check: (g, pid, a) => a.length === 0, run: (g, pid) => { g.councilReady.add(pid); return { ok: true }; } },
  continue: { phase: "resolution", check: (g, pid, a) => a.length === 0, run: (g, pid) => { g.contReady.add(pid); return { ok: true }; } },
  /* Pregunta de tiempo: voto visible; decide el anfitrión al votar; si no, a los 30 s gana la mayoría (empate: +1 ronda). */
  vote: {
    phase: "resolution", check: (g, pid, a) => a[0] === 1 || a[0] === 2 || a[0] === "end",
    run: (g, pid, a) => {
      const S = g.S();
      if (!S.timeAsk || S.players[pid].dead) return bad(NOT_NOW);
      g.votes[pid] = a[0];
      if (g.decider() !== pid) return { ok: true };
      return g.applyTimeAnswer(a[0]);
    }
  },
  /* «Añadir tiempo» del aviso de los 2 min: lo decide el anfitrión (el aviso lo ven todos). */
  addTime: {
    phase: ["private", "council", "resolution"], check: (g, pid, a) => a.length === 0,
    run: (g, pid) => {
      if (g.decider() !== pid) return bad("Solo el anfitrión puede añadir tiempo.");
      return { ok: true, added: !!g.U.addTime() };
    }
  }
};

module.exports = { Game, COMMANDS, GENERIC_BAD_TARGET };
