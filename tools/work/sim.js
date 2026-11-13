const path = "/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/";
require(path + "data.js"); const U = require(path + "engine.js"); const D = globalThis.UMBRAL_DATA;
const N = Number(process.argv[2] || 3000);
const stats = { games: 0, errors: 0, invalidTargetOk: 0, stunnedActed: 0, endings: {}, devours: 0, kills: 0, rounds: [], actionsUsed: {}, badStatus: 0, nanStats: 0, stuck: 0 };
const rnd = (n) => Math.floor(Math.random() * n);
const errs = [];
function check(cond, msg) { if (!cond) { stats.errors++; if (errs.length < 8) errs.push(msg); } }

for (let g = 0; g < N; g++) {
  stats.games++;
  try { U.createGame(["Ana", "Luis", "Marta"]); } catch (e) { check(false, "create " + e.message); continue; }
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
        // try up to several random actions
        let done = false;
        for (let tries = 0; tries < 12 && !done; tries++) {
          const acts = D.ACTIONS.filter((a) => !a.assassinOnly || p.alignment === "asesino");
          const a = acts[rnd(acts.length)];
          let tgt = null;
          if (a.target) {
            const opts = s.players.filter((x) => x.id !== p.id && !x.dead && (!a.canTarget || a.canTarget(x)));
            if (!opts.length) continue;
            tgt = opts[rnd(opts.length)].id;
          }
          const stake = a.gamble ? (rnd(3) === 0 ? 5 : 10) : null;
          const res = U.act(p.id, a.id, tgt, stake);
          if (res.ok) { done = true; stats.actionsUsed[a.id] = (stats.actionsUsed[a.id] || 0) + 1; }
          else if (a.canTarget && res.msg && res.msg.indexOf("devorado") !== -1) stats.invalidTargetOk++;
        }
        if (!done) { // fall back to a safe action
          const r = U.act(p.id, "meditar", null, null);
          check(r.ok, "fallback meditar failed: " + r.msg);
        }
        if (U.getState().pendingPush && rnd(2) === 0) U.pushLuck(p.id);
        const fin = U.finishTurn();
        check(!(fin && fin.ok === false) , "finishTurn err " + (fin && fin.msg));
      } else {
        const r = U.nextTurn();
        if (r === "blocked") { check(false, "blocked nextTurn"); break; }
      }
    } else if (s.phase === "council") {
      const r = U.endCouncil();
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
  stats.rounds.push(U.getState().round);
}
const avgR = stats.rounds.reduce((a, b) => a + b, 0) / stats.rounds.length;
const early = stats.rounds.filter((r) => r <= 2).length / stats.rounds.length;
console.log(JSON.stringify({ games: stats.games, errors: stats.errors, stuck: stats.stuck, badStatus: stats.badStatus, nanStats: stats.nanStats, avgRound: avgR.toFixed(2), pctRound12: (early * 100).toFixed(1), endings: stats.endings, actionsUsed: stats.actionsUsed }, null, 1));
if (errs.length) console.log("first errors:\n" + errs.join("\n"));
