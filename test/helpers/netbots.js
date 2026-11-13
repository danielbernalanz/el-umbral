"use strict";
/* F6: partidas completas por RED REAL (http + SSE) con bots que solo ven la vista de su jugador, reloj acelerado,
   votación de tiempo, desconexiones/reconexiones aleatorias y comprobación de fugas en cada difusión. */
const { createServer } = require("../../server/index");
const { Client } = require("./netclient");
const { loadEngine } = require("../../server/engine_vm");
const L = require("./leakcheck");
const { mkRng, ENGINE_DIR } = require("./bot");

const NAMES = ["Ana", "Luis", "Marta", "Pablo", "Eva", "Iker", "Sara", "Nico", "Lola", "Hugo"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let D = null;

/* Un paso de bot con la vista de red. Devuelve true si envió algo. */
async function step(c, rnd, mode) {
  const v = c.view; if (!v) return false;
  const q = v.q, me = v.me, pid = v.youId;
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const send = (cmd, args) => c.cmd(cmd, args);
  if (v.phase === "council") { if (!v.players[pid].ready) await send("councilReady", []); return true; }
  if (v.phase === "resolution") {
    if (v.timeAsk) { await send("vote", [v.players[pid].host ? pick([1, 2, 2, 2, "end"]) : pick([1, 1, 2, 2, "end"])]); return true; }
    await send("continue", []); return true;
  }
  if (v.phase !== "private") return false;
  if (v.players[pid].ready || me.dead) return false;
  const dark = mode === "dark" || (mode === "mixed" && pid === 0);
  if (q.pactOffers && q.pactOffers.length) { await send("answerPact", [0, rnd() < 0.6]); return true; }
  if (q.handOffer) { await send("answerHand", [rnd() < 0.7]); return true; }
  if (!me.acted && !me.dying) {
    if (q.offer && !q.offer.done) { const r = await send("answerOffer", [dark ? true : rnd() < 0.3]); if (r && !r.ok) await send("answerOffer", [false]); return true; }
    if (!me.usedItem && me.items.length && rnd() < 0.5) {
      const i = Math.floor(rnd() * me.items.length), it = me.items[i], def = D.ITEMS[it.id];
      if (def && def.kind === "tome" && rnd() < 0.7) {
        const r = await send("study", [i]);
        if (r && r.ok) { await send(rnd() < 0.5 ? "learnSpell" : "improveSpell", rnd() < 0.5 ? [0, "estable"] : [(me.spells[0] || {}).id || "x"]); return true; }
      } else { await send("useItem", [i, q.itemTargets.length ? pick(q.itemTargets) : null]); return true; }
    }
    const sids = Object.keys(q.spells);
    if (sids.length && rnd() < 0.35) {
      const sid = pick(sids), sp = me.spells.find((s) => s.id === sid);
      const r = await send("cast", [sid, sp && sp.target && q.spellTargets.length ? pick(q.spellTargets) : null, pick(["cauto", "normal", "desatado"])]);
      if (r && r.ok) { if (rnd() < 0.5) await send("pushLuck", []); return true; }
    }
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
      const r = await send("act", [id, tid, st]);
      if (r && r.ok) { if (rnd() < 0.5) await send("pushLuck", []); return true; }
    }
    await send("act", ["meditar", null, null]); return true;
  }
  if (q.encounter) { await send("encounterAct", [pick(q.encounter.options).id]); return true; }
  if (me.acted && q.declare && rnd() < 0.7) {
    const t = q.declare.targets;
    if (t.length) {
      const types = ["acusacion", "emboscada", "pacto_no_agresion", "pacto_silencio", "pacto_proteccion", "ninguna"];
      if (q.declare.romper.length) types.push("romper");
      const ty = pick(types);
      await send("declare", [ty, ty === "romper" ? pick(q.declare.romper) : pick(t).id]);
    }
    if (rnd() < 0.5) return true;
  }
  await send("finishTurn", []); return true;
}

/* opts: { n, seed, mode, accel (minutos de partida por segundo real), mins, churn (prob. de desconexión por vuelta), maxMs } */
async function playOnline(opts) {
  if (!D) D = loadEngine({ dir: ENGINE_DIR }).D;
  const n = opts.n, rnd = mkRng(opts.seed), accel = opts.accel || 60, mins = opts.mins || 12, churn = opts.churn == null ? 0.01 : opts.churn;
  const t0 = Date.now();
  const now = () => t0 + (Date.now() - t0) * accel;
  const app = createServer({ engineDir: ENGINE_DIR, publicDir: "/nonexistent-public", readMs: 0, now, tickMs: 20, maxRooms: 5, joinPerMin: 1000, cmdPerSec: 1000 });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const port = app.server.address().port;
  const out = { n, seed: opts.seed, ended: false, errors: [], leaks: [], rounds: 0, votes: 0, timeAsks: 0, disc: 0, recon: 0, ms: 0, ending: null };
  const cs = NAMES.slice(0, n).map((nm) => new Client(port, nm));
  let stop = false;
  try {
    await cs[0].create(); for (let i = 1; i < n; i++) await cs[i].join(cs[0].room);
    for (const c of cs) await c.connect();
    const r = await cs[0].start(now() + (mins + 0.4) * 60000);
    if (!r.json || !r.json.ok) throw new Error("start: " + r.text);
    const room = app.rooms.get(cs[0].room); const seenAsk = new Set();
    /* fugas: en cada difusión se valida la vista de cada jugador contra el estado real */
    const origB = room.broadcast.bind(room);
    room.broadcast = function () {
      origB();
      try {
        if (!room.game || room.status === "lobby") return;
        const g = room.game, pre = L.prepare(g);
        if (g.S().timeAsk && !seenAsk.has(g.S().round)) { seenAsk.add(g.S().round); out.timeAsks++; }
        if (g.votes) out.votes = Math.max(out.votes, Object.keys(g.votes).length);
        for (let p = 0; p < n; p++) { const v = JSON.parse(JSON.stringify(g.view(p))); L.checkView(g, p, v, pre).forEach((x) => { if (out.leaks.length < 20) out.leaks.push("R" + g.S().round + " " + g.S().phase + " J" + p + ": " + x); }); }
      } catch (e) { out.errors.push("leakcheck: " + e.message); }
    };
    const loops = cs.map((c, i) => (async () => {
      const lr = mkRng(opts.seed * 100 + i + 1);
      while (!stop) {
        try {
          const v = c.view;
          if (v && v.timeAsk && v.timeAsk.round !== undefined) { /* sin uso */ }
          if (c.offline) { if (Date.now() < c.offUntil) { await sleep(10); continue; } c.offline = false; await c.connect(); out.recon++; continue; }
          if (v && v.phase === "ending") return;
          if (v && churn && i !== 0 && lr() < churn && v.phase === "private") { c.close(); c.offline = true; c.offUntil = Date.now() + 30 + lr() * 400; out.disc++; continue; }
          const did = await step(c, rnd, opts.mode || "mixed");
          await sleep(did ? 2 : 15);
        } catch (e) { if (!stop) { if (/SSE 401|ECONN|socket/.test(e.message)) await sleep(20); else out.errors.push("bot J" + i + ": " + e.message); } }
      }
    })());
    /* observador: cuenta pregunta de tiempo / votos */
    const watch = setInterval(() => { const v = cs[0].view; if (v) out.rounds = Math.max(out.rounds, v.round || 0); }, 10);
    const limit = opts.maxMs || 90000;
    while (Date.now() - t0 < limit) {
      if (room.game && room.game.ended()) break;
      await sleep(25);
    }
    clearInterval(watch);
    out.ended = !!(room.game && room.game.ended());
    if (out.ended) { await sleep(150); }
    stop = true;
    await Promise.race([Promise.all(loops), sleep(1500)]);
    out.ms = Date.now() - t0;
    if (room.game) { out.errors.push(...room.game.errors); const S = room.game.S(); out.rounds = S.round; out.ending = S.ending ? (S.ending.title || S.ending.kind || "ok") : null; out.hasEnding = !!S.ending; }
  } catch (e) { out.errors.push("fatal: " + (e.stack || e)); }
  finally { stop = true; cs.forEach((c) => c.close()); app.rooms.closeAll(); app.server.closeAllConnections && app.server.closeAllConnections(); await new Promise((r) => app.server.close(r)); }
  return out;
}
module.exports = { playOnline };
