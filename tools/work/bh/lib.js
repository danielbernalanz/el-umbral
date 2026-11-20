"use strict";
const S = "/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad";
const W097 = S + "/snap097/www/", W092 = S + "/snap092/assets/www/", W095 = S + "/snap095/assets/www/";
const mem = {};
globalThis.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: k2 => { throw 0; }, removeItem: k => { delete mem[k]; } };
globalThis.localStorage.setItem = (k, v) => { mem[k] = String(v); };
globalThis.__mem = mem;
let clock = 1.7e12; Date.now = () => (clock += 1);
function resetClock() { clock = 1.7e12; }
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function loadEngine(dir) {
  for (const k of Object.keys(require.cache)) if (k.startsWith(dir)) delete require.cache[k];
  delete globalThis.UMBRAL_DATA; delete globalThis.UMBRAL;
  require(dir + "data.js"); const U = require(dir + "engine.js"); return { U, D: globalThis.UMBRAL_DATA };
}
const BADRE = /undefined|NaN|\[object|\bnull\b|Infinity|\{\w+\}/;
function walk(o, path, out, skip) {
  if (o === undefined) { if (/\.glog\[/.test(path)) return; out.push("undefined@" + path); return; }
  if (o === null) return;
  const t = typeof o;
  if (t === "number") { if (!Number.isFinite(o)) out.push("nonfinite@" + path); return; }
  if (t === "string") { if (BADRE.test(o)) out.push("badtext@" + path + ": " + o.slice(0, 90)); return; }
  if (t === "function") { out.push("function@" + path); return; }
  if (Array.isArray(o)) { o.forEach((x, i) => walk(x, path + "[" + i + "]", out, skip)); return; }
  if (t === "object") for (const k of Object.keys(o)) { if (skip && skip(path, k)) continue; walk(o[k], path + "." + k, out, skip); }
}
const skipGlog = (path, k) => (path === ".glog[]" || /^\.glog\[\d+\]$/.test(path)) && k === "a";
const PH = ["private", "council", "resolution", "ending"];
function woundsOf(U, p) { if (p.dead || p.dying) return 3; const m = U.maxHp(p); if (p.hp >= m) return 0; return p.hp / m >= 0.6 ? 1 : 2; }
// invariantes de estado; devuelve lista de strings
function invState(E, ctx) {
  const { U, D } = E; const s = U.getState(); const out = []; if (!s) return ["state null"];
  if (!PH.includes(s.phase)) out.push("phase invalida " + s.phase);
  if (!(s.round >= 1) || !Number.isInteger(s.round)) out.push("round " + s.round);
  if (s.round > U.maxRounds() + 0 && s.phase !== "ending") out.push("round>maxRounds " + s.round + ">" + U.maxRounds());
  if (!Number.isInteger(s.turn) || s.turn < 0 || s.turn >= s.players.length) out.push("turn fuera " + s.turn);
  const w = []; walk(s, "", w, skipGlog); w.slice(0, 5).forEach(x => out.push("walk " + x));
  const itemRefs = new Set(); const names = new Set();
  s.players.forEach(p => {
    const m = U.maxHp(p), pre = "P" + p.id + " ";
    if (p.id !== s.players.indexOf(p)) out.push(pre + "id!=idx");
    if (names.has(p.name.toLowerCase())) out.push(pre + "nombre duplicado " + p.name); names.add(p.name.toLowerCase());
    if (p.name.length > 16 || !p.name.trim()) out.push(pre + "nombre largo/vacio '" + p.name + "' len" + p.name.length);
    if (!Number.isInteger(p.hp) || p.hp < 0 || p.hp > m) out.push(pre + "hp fuera " + p.hp + "/" + m);
    if (p.dead && (p.hp !== 0 || p.dying)) out.push(pre + "muerto con hp/dying " + p.hp + p.dying);
    if (p.dead && p.status.length) out.push(pre + "muerto con estados");
    if (p.dying && (p.hp !== 0 || p.dead)) out.push(pre + "dying incoherente hp=" + p.hp);
    if (!p.dead && !p.dying && p.hp <= 0) out.push(pre + "hp0 vivo no moribundo");
    if (p.dying && s.phase === "private" && !p.acted) out.push(pre + "moribundo con turno (acted false)");
    if (p.wounds !== woundsOf(U, p)) out.push(pre + "wounds " + p.wounds + " != " + woundsOf(U, p));
    if (Object.keys(p).includes("wounds")) out.push(pre + "wounds enumerable (se guarda)");
    ["cabeza", "torso", "miembros"].forEach(z => { const zv = p.zones[z] === undefined ? 0 : p.zones[z]; if (!(zv >= 0) || !Number.isInteger(zv)) out.push(pre + "zona " + z + "=" + p.zones[z]); });
    ["cuerpo", "mente", "sombra"].forEach(k => { if (!Number.isFinite(p.stats[k]) || p.stats[k] < 0 || p.stats[k] > 12) out.push(pre + "stat " + k + "=" + p.stats[k]); });
    ["corr", "virtue"].forEach(k => { if (!(p[k] >= 0 && p[k] <= 100)) out.push(pre + k + "=" + p[k]); });
    if (!(p.focus >= 0 && p.focus <= 2)) out.push(pre + "focus " + p.focus);
    (p.status || []).forEach(x => { if (!(x.left > 0) || !D.STATUS[x.id]) out.push(pre + "status raro " + JSON.stringify(x)); });
    const sid = {}; (p.status || []).forEach(x => { if (sid[x.id]) out.push(pre + "status duplicado " + x.id); sid[x.id] = 1; });
    (p.items || []).forEach(i => { if (!i || !D.ITEMS[i.id]) out.push(pre + "item invalido " + JSON.stringify(i)); if (itemRefs.has(i)) out.push(pre + "item objeto compartido " + (i && i.id)); itemRefs.add(i); });
    const sp = {}; (p.spells || []).forEach(x => { if (!(x.uses > 0) || !Number.isInteger(x.uses)) out.push(pre + "conjuro usos " + x.uses + " " + x.name); if (sp[x.id]) out.push(pre + "conjuro id duplicado"); sp[x.id] = 1; if ((x.wins || 0) < 0) out.push(pre + "wins<0"); });
    if ((p.spells || []).length > 4) out.push(pre + ">4 conjuros");
    (p.clues || []).forEach(c => { if (c.about === p.id) out.push(pre + "pista sobre si mismo"); if (!s.players[c.about]) out.push(pre + "pista sobre inexistente"); });
    if (p.betrayals < 0 || p.keptPacts < 0) out.push(pre + "contadores<0");
    if (p.alignment === "asesino" && p.dead === false && s.assassinId === null) out.push(pre + "asesino sin assassinId");
    if (!p.dead && s.phase !== "ending") { const va = U.visibleActions(p); if (!va || !va.main || !va.main.length || !va.total) out.push(pre + "visibleActions vacio"); }
    if (!p.role || !p.affinity || !p.secret) out.push(pre + "sin rol/afinidad/secreto");
    if (ctx && ctx.wasDead && ctx.wasDead[p.id] && !p.dead) out.push(pre + "RESUCITA");
    if (ctx && ctx.wasDead) ctx.wasDead[p.id] = ctx.wasDead[p.id] || p.dead;
    if (ctx && ctx.wasAss && ctx.wasAss[p.id] && p.alignment !== "asesino") out.push(pre + "deja de ser asesino");
    if (ctx && ctx.wasAss) ctx.wasAss[p.id] = ctx.wasAss[p.id] || p.alignment === "asesino";
  });
  if (s.phase === "private") {
    const c = s.players[s.turn];
    if (c && (c.dead || c.dying) && !c.acted) out.push("turno de muerto/moribundo sin actuar P" + c.id);
    if (!s.handoff && c && c.dead && !ctx.allowDeadTurn) out.push("turno actual muerto P" + c.id);
  }
  if (s.phase === "council" && !s.council) out.push("council sin objeto");
  if (s.phase === "ending") {
    const e = s.ending; if (!e) out.push("ending sin objeto"); else {
      if (!["supervivientes", "asesino", "asesinos"].includes(e.winner) && !(e.winner === "draw" && e.title === "Silencio bajo la piedra" && s.players.every(p => p.dead))) out.push("winner raro " + e.winner);
      const w2 = []; walk(e, "ending", w2); w2.slice(0, 4).forEach(x => out.push("endwalk " + x));
      if (!e.title || !e.text) out.push("ending sin titulo/texto");
      if (e.players.length !== s.players.length) out.push("ending jugadores");
      e.players.forEach(q => { if (!q.secret || typeof q.fulfilled !== "boolean" || !q.secretWhy) out.push("ending secreto vacio " + q.name); });
    }
  }
  s.players.forEach(p => {
    if (p.dying && s.phase !== "ending" && !(p.dyingRound >= 0)) out.push("P" + p.id + " dying sin dyingRound");
    if (p.dying && s.phase !== "ending" && s.round >= p.dyingRound + 2) out.push("P" + p.id + " moribundo caducado sin morir (dyingRound " + p.dyingRound + " ronda " + s.round + ")");
    if (p.protection !== null && p.protection !== undefined && !s.players[p.protection]) out.push("P" + p.id + " protection invalida");
    if (p.actionTarget !== null && p.actionTarget !== undefined && !s.players[p.actionTarget]) out.push("P" + p.id + " actionTarget invalido");
  });
  if (s.assassinId !== null && s.assassinId !== undefined && (!s.players[s.assassinId] || s.players[s.assassinId].alignment !== "asesino")) out.push("assassinId no apunta a asesino");
  if (s.pendingPush && (!s.players[s.pendingPush.actorId] || s.phase !== "private")) out.push("pendingPush huerfano");
  (s.hands || []).forEach(h => { if (!["offered", "active", "rejected", "ignored", "ended", "done", "broken"].includes(h.status)) out.push("mano status " + h.status); });
  if (s.assassinExposed && !s.players.some(p => p.exposed)) out.push("assassinExposed sin jugador exposed");
  if (s.players.some(p => p.exposed && p.alignment !== "asesino")) out.push("exposed no asesino");
  (s.pacts || []).forEach((p, i) => {
    if (!s.players[p.a] || !s.players[p.b] || p.a === p.b) out.push("pacto " + i + " ids");
    if (!["pacto_no_agresion", "pacto_silencio", "pacto_proteccion"].includes(p.type)) out.push("pacto tipo " + p.type);
    if (typeof p.done !== "boolean" || !(p.expires >= p.round)) out.push("pacto estado " + JSON.stringify(p));
    if (!p.done && p.expires < s.round && s.phase !== "ending") out.push("pacto vencido sin resolver " + JSON.stringify(p) + " ronda " + s.round);
  });
  (s.pactOffers || []).forEach((o, i) => {
    if (!s.players[o.from] || !s.players[o.to] || o.from === o.to) out.push("oferta pacto ids");
    if (!["offered", "accepted", "rejected"].includes(o.status)) out.push("oferta status " + o.status);
  });
  (s.hands || []).forEach(h => { if (!s.players[h.from] || !s.players[h.to] || h.from === h.to) out.push("mano ids " + JSON.stringify(h)); });
  if (ctx) {
    if (ctx.lastRound && s.round < ctx.lastRound) out.push("ronda retrocede"); ctx.lastRound = s.round;
    if (ctx.lastPhase === "ending" && s.phase !== "ending") out.push("ending no absorbente");
    ctx.lastPhase = s.phase;
    if (ctx.lastPlayed !== undefined && s.playedMs < ctx.lastPlayed) out.push("playedMs retrocede"); ctx.lastPlayed = s.playedMs;
  }
  return out;
}
module.exports = { S, W097, W092, W095, loadEngine, mulberry, resetClock, walk, skipGlog, invState, woundsOf, mem, BADRE };
