const NAMES=["Ana","Luis","Marta","Pablo","Eva","Iker","Noa","Leo","Mia","Rut"].slice(0,Number(process.env.NP||3));
const _m={}; globalThis.localStorage={getItem:k=>(k in _m?_m[k]:null),setItem:(k,v)=>{_m[k]=String(v)},removeItem:k=>{delete _m[k]}};
const path = "/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/";
require(path + "data.js"); const U = require(path + "engine.js"); const D = globalThis.UMBRAL_DATA;
const ansT=(U)=>{const st=U.getState(); if(st&&st.timeAsk){const tp=process.env.TP||"1"; const c=tp==="mix"?[1,2,"end"][Math.floor(Math.random()*3)]:tp==="end"?"end":Number(tp); global.ASK=(global.ASK||0)+1; if(c!=="end")global.EXT=(global.EXT||0)+c; else global.TEND=(global.TEND||0)+1; return U.answerTime(c);} return null;};
const N = Number(process.argv[2] || 300); const MIN = Number(process.argv[3] || 20); const PACE = Number(process.argv[4] || 1); // PACE multiplica el tiempo real
const adv = (ms) => { while (ms > 0) { const d = Math.min(ms, 5000); U.tick(d); ms -= d; } };
const durs = [];
const stats = { games: 0, errors: 0, invalidTargetOk: 0, stunnedActed: 0, endings: {}, devours: 0, kills: 0, rounds: [], actionsUsed: {}, badStatus: 0, nanStats: 0, stuck: 0 };
const rnd = (n) => Math.floor(Math.random() * n);
const errs = [];
function check(cond, msg) { if (!cond) { stats.errors++; if (errs.length < 8) errs.push(msg); } }

for (let g = 0; g < N; g++) {
  stats.games++;
  try { U.createGame(NAMES, { minutes: MIN }); } catch (e) { check(false, "create " + e.message); continue; }
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
        U.getPactOffers(p.id).forEach((o) => { const rp = U.answerPact(p.id, o.idx, Math.random() < 0.6); check(rp.ok, "pact: " + rp.msg); });
        const ho = U.getHandOffer(p.id); if (ho) { const r2 = U.answerHand(p.id, Math.random() < 0.6); check(r2.ok, "hand: " + r2.msg); }
        // try up to several random actions
        if (Math.random() < 0.5 && p.items.length && !p.usedItem) {
          const ii = rnd(p.items.length), idf = D.ITEMS[p.items[ii].id];
          if (idf.kind === "tome") { const so = U.studyOptions(p.id, ii); check(so.ok, "study " + so.msg); if (so.ok) { const lr = U.learnSpell(p.id, rnd(3), ["potente", "estable", "sutil"][rnd(3)]); check(lr.ok, "learn " + lr.msg); global.LEARN = (global.LEARN || 0) + 1; } }
          else { const tg = s.players.filter((x) => x.id !== p.id && !x.dead); const ur = U.useItem(p.id, ii, tg.length ? tg[rnd(tg.length)].id : null); if (ur.ok) { global.IT = global.IT || {}; IT[idf.kind] = (IT[idf.kind] || 0) + 1; } }
        }
        let done = false;
        if (p.spells && p.spells.length && Math.random() < 0.6) {
          const sp = p.spells[rnd(p.spells.length)]; const tg = s.players.filter((x) => x.id !== p.id && !x.dead);
          const cr = U.cast(p.id, sp.id, sp.target ? (tg.length ? tg[rnd(tg.length)].id : null) : null);
          if (cr.ok) { done = true; global.CAST = global.CAST || {}; CAST[sp.form] = (CAST[sp.form] || 0) + 1; } else if (!/sangre/.test(cr.msg)) check(false, "cast " + cr.msg);
        }
        for (let tries = 0; tries < 12 && !done; tries++) {
          const acts = D.ACTIONS.filter((a) => (!a.assassinOnly || p.alignment === "asesino") && a.id !== "conjurar" && U.isUnlocked(p, a));
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
          check(r.ok || U.getState().phase === "ending", "fallback meditar failed: " + r.msg);
        }
        if (U.getState().pendingPush && rnd(2) === 0) U.pushLuck(p.id);
        { const cp=U.currentPlayer(); const en=cp&&U.encounterStart(cp.id); if(en){ const o=en.options[Math.floor(Math.random()*en.options.length)]; const r=U.encounterAct(cp.id,o.id); if(!r.ok) throw new Error('enc '+r.msg);} } adv(35000 * PACE); { const cp2=U.currentPlayer(); if(cp2&&cp2.acted&&!cp2.dead){ const ty=["romper","acusacion","emboscada","pacto_no_agresion","pacto_silencio","pacto_proteccion","ninguna"][rnd(7)]; const al=U.getState().players.filter(x=>x.id!==cp2.id&&!x.dead); const dr=U.declare(cp2.id,ty,al.length?al[rnd(al.length)].id:0); if(dr.ok){ global.DECL=global.DECL||{}; DECL[ty]=(DECL[ty]||0)+1; } else if(!/No has recibido|moribundo|Ahora no puedes/.test(dr.msg)) check(false,"declare "+ty+": "+dr.msg); } } const fin = U.finishTurn();
        check(!(fin && fin.ok === false) || U.getState().phase === "ending", "finishTurn err " + (fin && fin.msg));
      } else {
        const r = U.nextTurn();
        if (r === "blocked") { check(false, "blocked nextTurn"); break; }
      }
    } else if (s.phase === "council") {
      { const rs = U.resolveCouncil(); rs.forEach((x) => { global.RES = global.RES || {}; RES[x.type] = (RES[x.type] || 0) + 1; }); }
      adv(Math.min(U.councilSeconds() * 1000 * PACE, 400000)); const r = U.endCouncil();
      if (r === undefined) { check(false, "endCouncil undefined"); break; }
    } else if (s.phase === "resolution") {
      const e = U.nextRound();
      if (e) break;
      ansT(U);
    } else { check(false, "unknown phase " + s.phase); break; }
    { const st = U.getState(); const ct = JSON.stringify(st.chronicle) + JSON.stringify(st.lastResolution || []); if (/undefined|NaN|\[object/.test(ct)) check(false, "texto roto en crónica: " + ct.match(/.{0,50}(undefined|NaN|\[object).{0,20}/)[0]); if (st.players.length !== NAMES.length) check(false, "jugadores"); }
    if (U.getState() && U.getState().phase !== "ending") { const before = JSON.stringify(U.getState()); U.save(); const ld = U.loadGame(); const after = JSON.stringify(U.getState()); if (!ld || before !== after) { check(false, "roundtrip difiere: " + (before.length) + " vs " + (after.length)); } }
    // invariants
    for (const q of U.getState().players) {
      if (q.dead && q.status && q.status.length) { stats.badStatus++; check(false, "dead with status"); }
      if ((q.status || []).some((x) => !(x.left > 0))) { stats.badStatus++; check(false, "status left<=0"); }
      if ([q.stats.cuerpo, q.stats.mente, q.stats.sombra, q.corr, q.virtue].some((v) => !Number.isFinite(v))) { stats.nanStats++; check(false, "NaN stat"); }
      if (q.items.some((i) => !D.ITEMS[i.id])) check(false, "item desconocido");
      if (["cuerpo", "mente", "sombra"].some((k) => q.stats[k] < 0 || q.stats[k] > 6)) check(false, "stat fuera de rango " + JSON.stringify(q.stats));
      if (q.corr < 0 || q.corr > 100 || q.virtue < 0 || q.virtue > 100) check(false, "corr/virtue rango");
      if (q.focus < 0 || q.focus > 9) check(false, "focus " + q.focus);
      if ((q.spells || []).some((sp) => !(sp.uses > 0) || !sp.name || !sp.desc)) check(false, "conjuro invalido");
      if ((q.status || []).some((x) => !D.STATUS[x.id])) check(false, "estado desconocido");
      const txt = q.notes.join("|"); if (/undefined|NaN|\[object/.test(txt)) check(false, "texto roto en notas: " + txt.match(/.{0,40}(undefined|NaN|\[object).{0,20}/)[0]);
      if (q.wounds < 0 || q.wounds > 3) check(false, "wounds range " + q.wounds);
      if (q.dead && q.wounds < 3) check(false, "dead with wounds<3");
      if (q.hp < 0 || q.hp > U.maxHp(q) || !Number.isInteger(q.hp)) check(false, "hp range " + q.hp);
      if (["cabeza","torso","brazos","piernas"].some((z) => !(q.zones[z] >= 0))) check(false, "zones " + JSON.stringify(q.zones));
      if (q.dying && (q.dead || q.hp !== 0)) check(false, "dying incoherente");
      if (q.dying && U.getState().round >= q.dyingRound + 2 && U.getState().phase !== "ending") check(false, "dying sin resolver r" + q.dyingRound + " now " + U.getState().round);
      if (Object.keys(q).includes("wounds")) check(false, "wounds enumerable");
    }
  }
  if (guard >= 2000) stats.stuck++;
  const end = U.getEnding && U.getEnding();
  const label = end ? (end.winner || end.title || "?") : "none";
  stats.endings[label] = (stats.endings[label] || 0) + 1;
  global.HS = global.HS || {}; (U.getState().hands || []).forEach((h) => { const k = h.mode + ":" + h.status; HS[k] = (HS[k] || 0) + 1; });
  stats.rounds.push(U.getState().round); const en = U.getEnding && U.getEnding(); if (en) { durs.push(en.durationMin + (en.timedOut ? 0.01 : 0)); if (en.timedOut) global.TO = (global.TO||0)+1; if (en.durationMin > MIN) global.OVER = (global.OVER||0)+1; }
}
const avgR = stats.rounds.reduce((a, b) => a + b, 0) / stats.rounds.length;
const early = stats.rounds.filter((r) => r <= 2).length / stats.rounds.length;
durs.sort((a,b)=>a-b); console.log("MIN",MIN,"PACE",PACE,"dur p10/med/p90/max:",durs[Math.floor(durs.length*.1)],durs[Math.floor(durs.length/2)],durs[Math.floor(durs.length*.9)],durs[durs.length-1],"avgRound",avgR.toFixed(1)); console.log(JSON.stringify({ games: stats.games, errors: stats.errors, stuck: stats.stuck, badStatus: stats.badStatus, nanStats: stats.nanStats, avgRound: avgR.toFixed(2), pctRound12: (early * 100).toFixed(1), endings: stats.endings, actionsUsed: stats.actionsUsed }, null, 1));
if (errs.length) console.log("first errors:\n" + errs.join("\n"));

console.log("manos:", JSON.stringify(global.HS), "silencios rotos:", global.BRK||0);
console.log("aprendidos:",global.LEARN||0,"lanzados:",JSON.stringify(global.CAST),"objetos:",JSON.stringify(global.IT));
console.log("tiempo agotado:",global.TO||0,"superan la duración:",global.OVER||0);
console.log("preguntas de tiempo:",global.ASK||0,"rondas añadidas:",global.EXT||0,"terminar ahora:",global.TEND||0);
