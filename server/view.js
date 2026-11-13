"use strict";
/* VISTA FILTRADA por jugador (F1). Lista blanca: todo lo que no esté aquí es privado.
   - De los demás jugadores solo se publica PUBLIC_PLAYER_KEYS.
   - `me` es el jugador propio (copia JSON) sin los campos que guardan identidades ajenas.
   - `q` son las consultas del motor precalculadas para este jugador (el cliente nunca ejecuta el motor).
   - Nada ajeno (assassinId, pactos, ofertas, manos, glog, epi, shadow...) sale hasta phase === "ending".
   La vista NO muta el estado: las consultas impuras del motor (getOffer, unlockNotices, studyOptions,
   encounterStart) las materializa el servidor en game.js (refresh) y aquí solo se lee su resultado. */

const PUBLIC_PLAYER_KEYS = ["id", "name", "dead", "dying", "exposed", "visibleHealth", "ready", "online", "host", "absent"];
const TOP_KEYS = ["ver", "youId", "serverNow", "phase", "round", "maxRounds", "endAt", "durationMin", "event", "timeAsk", "publicClues", "chronicle", "skipped", "players", "me", "q", "wait", "waitN", "votes", "clock", "timeAdd", "councilResults", "lastResolution", "umbralAbierto", "ending", "reveal", "log", "story", "storyList", "host", "hostNote"];
/* Campos del jugador propio que guardan IDENTIDADES AJENAS (quién me socorrió, quién me alzó, quién me protege). */
const ME_EXCLUDE = ["socBy", "risenBy", "protection", "lastSeen"];
const MODES = ["cauto", "normal", "desatado"];

const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

/* Ejecuta fn con el contexto de turno de pid (las consultas del motor miran state.turn/handoff/pendingPush). */
function asPlayer(game, pid, fn) {
  const S = game.S();
  const sv = { turn: S.turn, handoff: S.handoff, pp: S.pendingPush };
  S.turn = pid; S.handoff = false; S.pendingPush = game.pctx[pid] || null;
  try { return fn(); } finally { S.turn = sv.turn; S.handoff = sv.handoff; S.pendingPush = sv.pp; }
}

function canAct(game, p) { const S = game.S(); return S.phase === "private" && !p.dead && !p.dying && !p.acted; }

/* Objetivos válidos por acción (sustituye a canTarget en el cliente). Solo ids; las acciones sin objetivo no aparecen. */
function targetsFor(game, pid) {
  const S = game.S(), D = game.D, p = S.players[pid], out = {};
  if (!p || !canAct(game, p)) return out;
  const vis = game.U.visibleActions(p);
  const all = vis.main.concat(vis.more.reduce((a, g) => a.concat(g.acts), []));
  all.forEach((a) => {
    if (!a.target) return;
    out[a.id] = S.players.filter((x) => x.id !== p.id && (a.id === "alzar" ? true : !x.dead) && (!a.canTarget || a.canTarget(x, p))).map((x) => x.id);
  });
  return out;
}
function aliveOthers(game, pid) { return game.S().players.filter((x) => x.id !== pid && !x.dead).map((x) => x.id); }

/* Notas del jugador sin las retenidas (provocadas por otros en la fase privada). */
function visibleNotes(game, p) {
  const held = game.held[p.id];
  return held && held.size ? p.notes.filter((_, i) => !held.has(i)) : p.notes.slice();
}
/* Equivale a U.getSince pero ignorando notas retenidas. */
function sinceFor(game, p) {
  if (!p.lastSeen || p.dead) return null;
  const held = game.held[p.id];
  const notes = p.notes.map((t, i) => [t, i]).filter((x) => x[1] >= p.lastSeen.n && !(held && held.has(x[1]))).map((x) => x[0]);
  const from = typeof p.lastSeen.h === "number" ? p.lastSeen.h : p.hp;
  if (!notes.length && p.hp === from) return null;
  return { hpFrom: from, hpNow: p.hp, notes: notes.slice(-5), more: Math.max(0, notes.length - 5) };
}

/* Consultas precalculadas para el jugador pid (todas verificadas como puras en test/pure.test.js). */
function queriesFor(game, pid) {
  const S = game.S(), U = game.U, D = game.D, p = S.players[pid];
  const q = {};
  q.maxRounds = U.maxRounds();
  q.turnSeconds = U.turnSeconds();
  q.councilSeconds = U.councilSeconds();
  q.councilPrompt = U.councilPrompt();
  q.behindSchedule = !!U.behindSchedule();
  q.timeWarn = !!U.timeWarn();
  q.timeLeftMs = U.timeLeftMs();
  q.extEnd = S.timeAsk ? { 1: U.extEnd(1), 2: U.extEnd(2) } : null;
  q.health = U.healthInfo(p);
  q.xp = U.xpInfo(p);
  q.dom = U.domInfo(p);
  q.secret = U.secretInfo(pid);
  q.umbral = U.umbralInfo(pid);
  q.pacts = U.activePacts(pid);
  q.risen = (p.risen || []).filter((id) => S.players[id] && S.players[id].risenBy === p.id).map((id) => S.players[id].name);
  q.since = sinceFor(game, p);
  q.offer = canAct(game, p) ? (p.offer || null) : null;          /* materializada por game.refresh */
  q.unlocks = (game.fresh[pid] || []).slice();                    /* idem unlockNotices */
  q.encounter = p.acted && p.action === "explorar" && !game.pctx[pid] ? game.U.encounterStart(pid) : null; /* idempotente: lo materializa game.refresh */
  q.handOffer = asPlayer(game, pid, () => U.getHandOffer(pid));
  q.declare = asPlayer(game, pid, () => U.declareOptions(pid));
  /* propuestas de pacto: idx LOCAL (el índice global delataría cuántas propuestas hay en la mesa) */
  q.pactOffers = asPlayer(game, pid, () => U.getPactOffers(pid)).map((o, i) => ({ idx: i, from: o.from, type: o.type, label: o.label, terms: o.terms }));
  q.unlocked = {}; D.ACTIONS.forEach((a) => { q.unlocked[a.id] = !!U.isUnlocked(p, a) && !(a.assassinOnly && p.alignment !== "asesino"); });
  q.locked = U.lockedList(p);                                     /* acciones cerradas + requisito/progreso (mismas reglas para todos; sin acciones de Asesino) */
  const vis = U.visibleActions(p);
  q.actions = { main: vis.main.map((a) => a.id), more: vis.more.map((g) => ({ id: g.id, label: g.label, acts: g.acts.map((a) => a.id) })), total: vis.total, hidden: vis.hidden };
  q.odds = {};
  vis.main.concat(vis.more.reduce((a, g) => a.concat(g.acts), [])).forEach((a) => { const o = U.actionOdds(pid, a.id); if (o) q.odds[a.id] = o; });
  q.targets = targetsFor(game, pid);
  q.itemTargets = canAct(game, p) ? aliveOthers(game, pid) : [];
  q.spellTargets = q.itemTargets;
  q.spells = {};
  (p.spells || []).forEach((sp) => {
    const e = { progress: U.spellProgress(sp), info: {} };
    const tids = sp.target ? q.spellTargets.slice() : ["-"];
    tids.forEach((tid) => {
      e.info[tid] = {};
      MODES.forEach((m) => {
        /* La vista no debe delatar protecciones ajenas: se calcula como si el objetivo no estuviese protegido. */
        const t = tid === "-" ? null : S.players[tid];
        const keep = t ? t.protection : null; if (t) t.protection = null;
        try { e.info[tid][m] = U.spellInfo(pid, sp.id, tid === "-" ? null : tid, m); } finally { if (t) t.protection = keep; }
      });
    });
    q.spells[sp.id] = e;
  });
  return clone(q);
}

function mePlayer(game, p) {
  const o = clone(p);
  ME_EXCLUDE.forEach((k) => { delete o[k]; });
  o.notes = visibleNotes(game, p);
  o.wounds = p.wounds;
  o.protected = p.protection !== null && p.protection !== undefined;
  return o;
}

function waitList(game) {
  const S = game.S();
  if (S.phase === "ending") return [];
  const set = S.phase === "private" ? game.ready : S.phase === "council" ? game.councilReady : S.phase === "resolution" ? game.contReady : null;
  if (!set) return [];
  return S.players.filter((p) => !game.doneIn(p, set)).map((p) => p.name);
}

function waitCount(game) {
  const S = game.S();
  const set = S.phase === "private" ? game.ready : S.phase === "council" ? game.councilReady : S.phase === "resolution" ? game.contReady : null;
  return set ? S.players.filter((p) => !game.doneIn(p, set)).length : 0;
}

function buildView(game, pid) {
  const S = game.S(), U = game.U;
  const p = S.players[pid];
  if (!p) return null;
  const ending = S.phase === "ending";
  const pres = game.presence || {};
  const setReady = S.phase === "private" ? game.ready : S.phase === "council" ? game.councilReady : S.phase === "resolution" ? game.contReady : null;
  const v = {
    youId: pid,
    serverNow: game.now(),
    phase: S.phase,
    round: S.round,
    maxRounds: U.maxRounds(),
    endAt: S.endAt || null,
    durationMin: S.durationMin || null,
    event: clone(S.event),
    timeAsk: clone(S.timeAsk) || null,
    publicClues: clone(S.publicClues),
    chronicle: clone(S.phase === "private" ? S.chronicle.slice(0, game.chronVisible) : S.chronicle),
    skipped: clone(S.skipped || []),
    umbralAbierto: !!S.umbralAbierto,
    lastResolution: S.phase === "resolution" || ending ? clone(S.lastResolution) : [],
    councilResults: S.phase === "council" || S.phase === "resolution" ? clone(game.councilResults || []) : [],
    players: S.players.map((x) => ({
      id: x.id, name: x.name, dead: !!x.dead, dying: !!x.dying && !x.dead, exposed: !!x.exposed, visibleHealth: U.visibleHealth(x),
      /* F6: en la fase privada solo se ve el propio «listo» (de los demás, solo muertos/ausentes, que ya son públicos): nadie espera a ser el último */
      ready: setReady ? (S.phase === "private" && x.id !== pid ? (x.dead || game.absent.has(x.id)) : (x.dead || setReady.has(x.id) || game.absent.has(x.id))) : false,
      absent: game.absent.has(x.id) && !x.dead,
      online: pres.online ? pres.online[x.id] !== false : true,
      host: pres.host === x.id
    })),
    me: mePlayer(game, p),
    q: ending ? {} : queriesFor(game, pid),
    wait: S.phase === "private" ? [] : waitList(game),
    waitN: ending ? 0 : waitCount(game),
    clock: ending || !game.clock ? null : clone(game.clock),
    timeAdd: !!S.timeAdd,
    hostNote: game.hostNote || null,
    votes: S.timeAsk ? clone(game.votes || {}) : {}
  };
  if (ending) {
    v.ending = clone(S.ending);
    v.reveal = { assassinId: S.assassinId, shadow: clone(S.shadow || null), players: S.players.map((x) => { const o = clone(x); o.wounds = x.wounds; return o; }) };
    v.log = game.endLog(); v.story = game.endStory(); v.storyList = game.endStoryList();
  }
  return v;
}

module.exports = { buildView, PUBLIC_PLAYER_KEYS, TOP_KEYS, ME_EXCLUDE, targetsFor, aliveOthers, queriesFor, asPlayer, canAct, visibleNotes, sinceFor, clone };
