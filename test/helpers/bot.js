"use strict";
/* Bots que juegan SOLO con la vista filtrada de su jugador (como un cliente real) y envían comandos por Game.exec.
   Referencia de comandos legales: scratchpad/work/smart.js y smart_human.js (mismo repertorio, elección aleatoria sesgada). */
const path = require("node:path");
const ENGINE_DIR = process.env.ENGINE_DIR || "/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www";

function mkRng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* Un paso de bot para el jugador pid. send(cmd, args) -> resultado. Devuelve true si hizo algo. */
function botStep(game, pid, rnd, mode, send) {
  const v = game.view(pid), q = v.q, me = v.me, D = game.D;
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  if (v.phase === "council") { send("councilReady", []); return true; }
  if (v.phase === "resolution") {
    if (v.timeAsk) { if (v.players[pid].host) send("vote", [pick([1, 2, "end"])]); else send("vote", [1]); return true; }
    send("continue", []); return true;
  }
  if (v.phase !== "private") return false;
  const pl = v.players[pid];
  if (pl.ready || me.dead) return false;
  const dark = mode === "dark" || (mode === "mixed" && pid === 0);
  if (me.dying || (me.acted && !q.encounter)) {
    /* ya actuó: respuestas pendientes, declaración y entrega */
  }
  if (q.pactOffers && q.pactOffers.length) { send("answerPact", [0, rnd() < 0.6]); return true; }
  if (q.handOffer) { send("answerHand", [rnd() < 0.7]); return true; }
  if (!me.acted && !me.dying) {
    if (q.offer && !q.offer.done) { const r = send("answerOffer", [dark ? true : rnd() < 0.3]); if (!r.ok) send("answerOffer", [false]); return true; }
    /* objetos */
    if (!me.usedItem && me.items.length && rnd() < 0.5) {
      const i = Math.floor(rnd() * me.items.length), it = me.items[i], def = D.ITEMS[it.id];
      if (def && def.kind === "tome" && rnd() < 0.7) {
        const r = send("study", [i]);
        if (r.ok) { send(rnd() < 0.5 ? "learnSpell" : "improveSpell", rnd() < 0.5 ? [0, "estable"] : [(me.spells[0] || {}).id || "x"]); return true; }
      } else {
        const tid = q.itemTargets.length ? pick(q.itemTargets) : null;
        send("useItem", [i, rnd() < 0.5 ? tid : null]); return true;
      }
    }
    /* hechizos */
    const sids = Object.keys(q.spells);
    if (sids.length && rnd() < 0.35) {
      const sid = pick(sids), sp = me.spells.find((s) => s.id === sid);
      const r = send("cast", [sid, sp && sp.target && q.spellTargets.length ? pick(q.spellTargets) : null, pick(["cauto", "normal", "desatado"])]);
      if (r.ok) { if (rnd() < 0.5) send("pushLuck", []); return true; }
    }
    /* acción */
    const ids = q.actions.main.concat(q.actions.more.reduce((a, g) => a.concat(g.acts), []));
    const pref = me.alignment === "asesino" ? ["cazar", "devorar", "alzar", "sombra_hostiga"] : dark ? ["ceder", "apunalar", "envenenar", "robar", "hechizar", "maldecir", "aturdir"] : [];
    const order = pref.filter((x) => ids.indexOf(x) !== -1 && rnd() < 0.7).concat(ids.slice().sort(() => rnd() - 0.5));
    for (const id of order) {
      const a = D.ACTIONS.find((x) => x.id === id);
      if (!a || id === "conjurar") continue;
      let tid = null, st = null;
      if (a.target) { const ts = q.targets[id] || []; if (!ts.length) continue; tid = pick(ts); }
      if (id === "apostar") st = D.STAKES[0].id;
      if (id === "tender") st = rnd() < 0.5 ? "sincera" : "trampa";
      const r = send("act", [id, tid, st]);
      if (r.ok) { if (game.pctx[pid] && rnd() < 0.5) send("pushLuck", []); return true; }
    }
    send("act", ["meditar", null, null]); return true;
  }
  /* ya actuó */
  if (q.encounter) { const o = pick(q.encounter.options); send("encounterAct", [o.id]); return true; }
  if (me.acted && q.declare && rnd() < 0.7) {
    const t = q.declare.targets; if (t.length) {
      const types = ["acusacion", "emboscada", "pacto_no_agresion", "pacto_silencio", "pacto_proteccion", "ninguna"];
      if (q.declare.romper.length) types.push("romper");
      const ty = pick(types);
      send("declare", [ty, ty === "romper" ? pick(q.declare.romper) : pick(t).id]);
    }
    if (rnd() < 0.5) return true;
  }
  send("finishTurn", []);
  return true;
}

/* Juega una partida completa. hooks: { afterCommand(pid, cmd, args, res) } */
function playGame(game, seed, mode, hooks) {
  const rnd = mkRng(seed);
  const n = game.playerCount();
  const sendAs = (pid) => (cmd, args) => {
    if (hooks && hooks.beforeCommand) hooks.beforeCommand(pid, cmd, args);
    const res = game.exec(pid, cmd, args, { isHost: pid === 0 });
    if (hooks && hooks.afterCommand) hooks.afterCommand(pid, cmd, args, res);
    return res;
  };
  let guard = 0, idle = 0;
  while (!game.ended() && guard++ < 20000) {
    if (hooks && hooks.onLoop) hooks.onLoop(game, guard);
    const order = Array.from({ length: n }, (_, i) => i).sort(() => rnd() - 0.5);
    let did = game.runNpcs();
    for (const pid of order) { if (game.ended()) break; if (game.S().players[pid].npc) continue; if (botStep(game, pid, rnd, mode, sendAs(pid))) did = true; }
    if (!did) { if (++idle > 3) { game.forceAdvance(); idle = 0; } } else idle = 0;
  }
  return guard;
}

module.exports = { botStep, playGame, mkRng, ENGINE_DIR };
