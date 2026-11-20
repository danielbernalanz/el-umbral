"use strict";
/* Detector de fugas: construye cadenas sensibles ajenas a partir del estado REAL y las busca en la vista serializada. */
const { PUBLIC_PLAYER_KEYS, TOP_KEYS } = require("../../server/view");

const Q_KEYS = ["maxRounds", "turnSeconds", "councilSeconds", "councilPrompt", "behindSchedule", "timeWarn", "timeLeftMs", "extEnd", "health", "treat", "xp", "dom", "secret", "umbral", "lead", "pacts", "risen", "since", "offer", "unlocks", "encounter", "handOffer", "declare", "pactOffers", "unlocked", "locked", "actions", "odds", "targets", "itemTargets", "spellTargets", "spells"];
const ME_FORBIDDEN = ["socBy", "risenBy", "lastSeen", "suspBy"];

function strings(o, out, minLen) {
  if (o === null || o === undefined) return out;
  if (typeof o === "string") { if (o.length >= minLen) out.push(o); return out; }
  if (Array.isArray(o)) { o.forEach((x) => strings(x, out, minLen)); return out; }
  if (typeof o === "object") { Object.keys(o).forEach((k) => strings(o[k], out, minLen)); }
  return out;
}
function leaves(o, path, out) {
  if (o === null || o === undefined) return out;
  if (typeof o === "string") { out.push([path, o]); return out; }
  if (typeof o !== "object") return out;
  Object.keys(o).forEach((k) => leaves(o[k], path ? path + "." + k : k, out));
  return out;
}

/* Tokens sensibles de Q (todos los textos privados) y "núcleo" (secreto, rol, afinidad). */
function tokensOf(S, qid, D) {
  const q = S.players[qid];
  /* Solo texto libre (con espacios): los identificadores cortos (p. ej. «meditar», «poder») son vocabulario común del cliente. */
  const all = strings(JSON.parse(JSON.stringify(q)), [], 5).filter((t) => t !== q.name && /\s/.test(t));
  const core = [q.secret.text, q.role.name, q.role.desc, q.affinity.name, q.affinity.desc].filter((t) => t && t.length >= 5);
  return { all: Array.from(new Set(all)), core: Array.from(new Set(core)) };
}
function globalTokens(S) {
  const t = [];
  (S.glog || []).forEach((e) => { if (e.x && String(e.x).length >= 12) t.push(String(e.x)); });
  (S.pactOffers || []).forEach(() => {});
  return t;
}

/* Tokens de todos los jugadores, una vez por comando. */
function prepare(game) { const S = game.S(), tokens = {}; S.players.forEach((q) => { tokens[q.id] = tokensOf(S, q.id, game.D); }); return { tokens }; }

/* Comprueba la vista de P frente al estado real. Devuelve lista de problemas (vacía = limpio). */
function checkView(game, pid, v, pre) {
  const S = game.S(), D = game.D, probs = [];
  const json = JSON.stringify(v);
  Object.keys(v).forEach((k) => { if (TOP_KEYS.indexOf(k) === -1) probs.push("clave de nivel superior no permitida: " + k); });
  if (v.phase === "private") {
    if ((v.wait || []).length) probs.push("wait nombra jugadores en la fase privada");
    v.players.forEach((p) => { if (p.id !== pid && p.ready !== (!!S.players[p.id].dead || !!S.players[p.id].npc || game.absent.has(p.id))) probs.push("ready ajeno visible en la fase privada: J" + p.id); });
  }
  if (v.phase !== "ending") ["ending", "reveal", "log", "story"].forEach((k) => { if (v[k] !== undefined) probs.push("campo de desenlace antes de tiempo: " + k); });
  if (/npcProfile|"npc":"(prudente|agresivo|curandero|oscuro|mixto)"/.test(json)) probs.push("perfil de NPC expuesto en la vista");
  if (v.me && typeof v.me.npc === "string") probs.push("me.npc no booleano (perfil expuesto)");
  v.players.forEach((p) => { if (p.id !== pid && typeof p.npc !== "boolean") probs.push("npc ajeno no booleano (perfil expuesto?): J" + p.id); });
  v.players.forEach((p) => { if (p.id !== pid) Object.keys(p).forEach((k) => { if (PUBLIC_PLAYER_KEYS.indexOf(k) === -1) probs.push("jugador ajeno con clave " + k); }); });
  if (v.phase !== "ending") {
    Object.keys(v.q).forEach((k) => { if (Q_KEYS.indexOf(k) === -1) probs.push("q con clave desconocida " + k); });
    ME_FORBIDDEN.forEach((k) => { if (v.me[k] !== undefined) probs.push("me con campo prohibido " + k); });
    if (v.me.id !== pid) probs.push("me.id incorrecto");
    if (v.me.protection !== undefined) probs.push("me.protection presente");
    if (v.me.name !== S.players[pid].name) probs.push("me.name");
  }
  if (v.phase === "ending") return probs; /* en el desenlace todo se revela */
  const prep = pre || prepare(game);
  const ownSet = new Set(strings([JSON.parse(JSON.stringify(S.players[pid])), v.q && v.q.encounter], [], 1));
  const pubSet = new Set(strings([v.players, v.event, v.chronicle, v.councilResults, v.lastResolution, v.publicClues], [], 1));
  const leafSet = new Set(strings(v, [], 5));
  S.players.forEach((q) => {
    if (q.id === pid) return;
    const tk = prep.tokens[q.id];
    tk.all.forEach((t) => { if (leafSet.has(t) && !ownSet.has(t) && !pubSet.has(t)) probs.push("fuga de texto de J" + q.id + ": «" + t.slice(0, 60) + "»"); });
    /* el núcleo (secreto, rol, afinidad) se busca también como subcadena */
    tk.core.forEach((t) => { if (!ownSet.has(t) && json.indexOf(JSON.stringify(t).slice(1, -1)) !== -1) probs.push("fuga (subcadena) del núcleo de J" + q.id + ": «" + t.slice(0, 60) + "»"); });
  });
  globalTokens(S).forEach((t) => { if (leafSet.has(t) && !ownSet.has(t) && !pubSet.has(t)) probs.push("fuga de glog: " + t.slice(0, 50)); });
  /* el asesino no se nombra como tal: ninguna cadena "asesino" referida a otro (salvo textos públicos, p.ej. exposed) */
  return probs;
}

/* Un resultado de comando solo debe contener, de otros jugadores, lo que el actor puede saber; nunca el núcleo (secreto/rol/afinidad). */
function checkResult(game, pid, res) {
  const S = game.S(), probs = [], json = JSON.stringify(res), own = JSON.stringify(S.players[pid]);
  S.players.forEach((q) => {
    if (q.id === pid) return;
    tokensOf(S, q.id, game.D).core.forEach((t) => { if (own.indexOf(t) === -1 && json.indexOf(JSON.stringify(t).slice(1, -1)) !== -1) probs.push("resultado filtra núcleo de J" + q.id + ": " + t.slice(0, 40)); });
  });
  return probs;
}

/* Retención: lo que otro jugador provoca no debe cambiar mi crónica/notas en la fase privada, ni nombrar al actor fuera de zonas permitidas. */
/* q.secret.hint es dinámica y cita al socio de un pacto o a quien te propone uno: reflejo de q.pactOffers/q.pacts, que ya son en vivo por diseño. */
const ALLOWED_LIVE = ["q.secret", "players", "wait", "q.pactOffers", "q.handOffer", "q.pacts", "q.targets", "q.declare", "q.itemTargets", "q.spellTargets", "q.spells"];
function checkRetention(actorName, pidActor, before, after) {
  const probs = [];
  after.forEach((va, qid) => {
    if (qid === pidActor) return;
    const vb = before.get(qid);
    if (!vb || vb.phase !== "private" || va.phase !== "private" || vb.round !== va.round) return;
    if (JSON.stringify(vb.me.notes) !== JSON.stringify(va.me.notes)) probs.push("J" + qid + ": sus notas cambiaron por un comando ajeno");
    if (JSON.stringify(vb.chronicle) !== JSON.stringify(va.chronicle)) probs.push("J" + qid + ": la crónica cambió durante la fase privada");
    if (JSON.stringify(vb.publicClues) !== JSON.stringify(va.publicClues)) probs.push("J" + qid + ": publicClues cambió");
    const seen = new Set(leaves(vb, "", []).map((x) => x[0] + "\u0000" + x[1]));
    const re = new RegExp("(^|[^\\p{L}])" + actorName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^\\p{L}]|$)", "u");
    leaves(va, "", []).forEach(([path, s]) => {
      if (seen.has(path + "\u0000" + s)) return;
      if (ALLOWED_LIVE.some((a) => path === a || path.indexOf(a + ".") === 0)) return;
      if (re.test(s)) probs.push("J" + qid + ": texto nuevo nombra al actor en " + path + ": " + s.slice(0, 80));
    });
  });
  return probs;
}

module.exports = { prepare, checkView, checkResult, checkRetention, tokensOf, Q_KEYS, strings };
