const path = "/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/";
require(path + "data.js"); const U = require(path + "engine.js"); const D = globalThis.UMBRAL_DATA;
const N = Number(process.argv[2] || 300); const MIN = Number(process.argv[3] || 20); const PACE = Number(process.argv[4] || 1); // PACE multiplica el tiempo real
const adv = (ms) => { while (ms > 0) { const d = Math.min(ms, 5000); U.tick(d); ms -= d; } };
const durs = [];
const stats = { games: 0, errors: 0, invalidTargetOk: 0, stunnedActed: 0, endings: {}, devours: 0, kills: 0, rounds: [], actionsUsed: {}, badStatus: 0, nanStats: 0, stuck: 0 };
const rnd = (n) => Math.floor(Math.random() * n);
const errs = [];
function check(cond, msg) { if (!cond) { stats.errors++; if (errs.length < 8) errs.push(msg); } }

for (let g = 0; g < N; g++) {
  stats.games++;
  try { U.createGame(["Ana", "Luis", "Marta"], { minutes: MIN }); } catch (e) { check(false, "create " + e.message); continue; }
  let guard = 0;
  while (guard++ < 2000) {
    const s = U.getState();
    if (!s || s.phase === "ending") break;
    if (s.phase === "private") {
      const p = U.currentPlayer();
      if (!p) { check(false, "no current player"); break; }
      if (!s.handoff && (p.dead || p.acted)) { check(false, "current player dead/acted in private: " + p.name + " acted=" + p.acted); break; }
      if (U.hasStatus(p, "aturdido") && !p.acted) check(false, "stunned player got turn");
      if (!s.handoff) {
        const of = U.getOffer(p.id); if (of) { const q = Math.random(); if (q < 0.35) { const r0 = U.answerOffer(p.id, true); check(r0.ok, "accept offer: " + r0.msg); } else if (q < 0.6) { const r1 = U.answerOffer(p.id, false); check(r1.ok, "reject offer: " + r1.msg); } }
        const ho = U.getHandOffer(p.id); if (ho) { const r2 = U.answerHand(p.id, Math.random() < 0.6); check(r2.ok, "hand: " + r2.msg); }
        // try up to several random actions
        let done = false;
        for (let tries = 0; tries < 12 && !done; tries++) {
          const acts = D.ACTIONS.filter((a) => (!a.assassinOnly || p.alignment === "asesino") && U.isUnlocked(p, a));
          const a = acts[rnd(acts.length)];
          let tgt = null;
          if (a.target) {
            const opts = s.players.filter((x) => x.id !== p.id && !x.dead && (!a.canTarget || a.canTarget(x)));
            if (!opts.length) continue;
            tgt = opts[rnd(opts.length)].id;
          }
          const stake = a.mode ? (rnd(2) ? "trampa" : "sincera") : a.gamble ? (rnd(3) === 0 ? 5 : 10) : null;
          const res = U.act(p.id, a.id, tgt, stake);
          if (res.ok) { done = true; stats.actionsUsed[a.id] = (stats.actionsUsed[a.id] || 0) + 1; }
          else if (a.canTarget && res.msg && res.msg.indexOf("devorado") !== -1) stats.invalidTargetOk++;
        }
        if (!done) { // fall back to a safe action
          const r = U.act(p.id, "meditar", null, null);
          check(r.ok, "fallback meditar failed: " + r.msg);
        }
        if (U.getState().pendingPush && rnd(2) === 0) U.pushLuck(p.id);
        adv(35000 * PACE); const fin = U.finishTurn();
        check(!(fin && fin.ok === false) , "finishTurn err " + (fin && fin.msg));
      } else {
        const r = U.nextTurn();
        if (r === "blocked") { check(false, "blocked nextTurn"); break; }
      }
    } else if (s.phase === "council") {
      s.players.forEach((a) => s.players.forEach((b) => { if (a.id !== b.id && !a.dead && !b.dead && Math.random() < 0.3) { const rr = U.registerInteraction(a.id, "romper", b.id, false); if (rr.ok) global.BRK = (global.BRK || 0) + 1; else if (!/no ha recibido|ya ha roto/.test(rr.msg)) check(false, "romper: " + rr.msg); } }));
      adv(Math.min(U.councilSeconds() * 1000 * PACE, 400000)); const r = U.endCouncil();
      if (r === undefined) { check(false, "endCouncil undefined"); break; }
    } else if (s.phase === "resolution") {
      const e = U.nextRound();
      if (e) break;
    } else { check(false, "unknown phase " + s.phase); break; }
    // invariants
    for (const q of U.getState().players) {
      if (q.dead && q.status && q.status.length) { stats.badStatus++; check(false, "dead with status"); }
      if ((q.status || []).some((x) => !(x.left > 0))) { stats.badStatus++; check(false, "status left<=0"); }
      if ([q.stats.cuerpo, q.stats.mente, q.stats.sombra, q.corr, q.virtue].some((v) => !Number.isFinite(v))) { stats.nanStats++; check(false, "NaN stat"); }
      if (q.wounds < 0 || q.wounds > 3) check(false, "wounds range " + q.wounds);
      if (q.dead && q.wounds < 3) check(false, "dead with wounds<3");
    }
  }
  if (guard >= 2000) stats.stuck++;
  const end = U.getEnding && U.getEnding();
  const label = end ? (end.winner || end.title || "?") : "none";
  stats.endings[label] = (stats.endings[label] || 0) + 1;
  global.HS = global.HS || {}; (U.getState().hands || []).forEach((h) => { const k = h.mode + ":" + h.status; HS[k] = (HS[k] || 0) + 1; });
  stats.rounds.push(U.getState().round); const en = U.getEnding && U.getEnding(); if (en) durs.push(en.durationMin);
}
const avgR = stats.rounds.reduce((a, b) => a + b, 0) / stats.rounds.length;
const early = stats.rounds.filter((r) => r <= 2).length / stats.rounds.length;
durs.sort((a,b)=>a-b); console.log("MIN",MIN,"PACE",PACE,"dur p10/med/p90/max:",durs[Math.floor(durs.length*.1)],durs[Math.floor(durs.length/2)],durs[Math.floor(durs.length*.9)],durs[durs.length-1],"avgRound",avgR.toFixed(1)); console.log(JSON.stringify({ games: stats.games, errors: stats.errors, stuck: stats.stuck, badStatus: stats.badStatus, nanStats: stats.nanStats, avgRound: avgR.toFixed(2), pctRound12: (early * 100).toFixed(1), endings: stats.endings, actionsUsed: stats.actionsUsed }, null, 1));
if (errs.length) console.log("first errors:\n" + errs.join("\n"));

console.log("manos:", JSON.stringify(global.HS), "silencios rotos:", global.BRK||0);