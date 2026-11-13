"use strict";
const L = require("./lib.js");
const NAMES = ["Ana", "Luis", "Marta", "Pablo", "Eva", "Iker", "Noa", "Leo", "Mia", "Rut"];

function playGame(E, cfg) {
  const { U, D } = E;
  const rngB = L.mulberry(cfg.seed * 7919 + 13); // bot
  Math.random = L.mulberry(cfg.seed * 104729 + 7); // motor
  L.resetClock(); Object.keys(L.mem).forEach(k => delete L.mem[k]);
  const R = n => Math.floor(rngB() * n), pickB = a => a[R(a.length)];
  const F = []; const seen = new Set(); let calls = 0, steps = 0;
  const ctx = { wasDead: {}, wasAss: {}, allowDeadTurn: cfg.mode === "chaos" };
  const find = (sev, tag, msg) => { const k = tag + "|" + msg.replace(/ \(tras .*$/,"").replace(/\d+/g, "#").slice(0,140); if (seen.has(k)) return; seen.add(k); if (process.env.DUMP && new RegExp(process.env.DUMP).test(msg)) { console.log("DUMP", msg, "\n  " + ring.join("\n  ")); } F.push({ sev, tag, msg, seed: cfg.seed, np: cfg.np, min: cfg.minutes, pace: cfg.pace, mode: cfg.mode, steps, rt: !!cfg.rt }); };
  const ser = () => JSON.stringify(U.getState(), (k, v) => (k === "glog" ? undefined : v));
  const badId = () => pickB([-1, 99, null, undefined, "1", 1.5, NaN, {}, "", true, 10, 1e9]);
  const randId = (n) => (rngB() < 0.8 ? R(n) : badId());
  let lastOp = ""; const ring = []; 
  function call(name, ...args) {
    calls++; lastOp = name + "(" + args.map(a => { try { return JSON.stringify(a); } catch (e) { return "?"; } }).join(",") + ")";
    ring.push(lastOp); if (ring.length > 25) ring.shift();
    let before = null; const s0 = U.getState();
    if (cfg.errcheck && s0) before = ser();
    let res;
    try { res = U[name](...args); } catch (e) { find("ALTA", "EXC", name + ": " + e.message + " @" + (e.stack || "").split("\n")[1].trim() + " args=" + lastOp + " fase=" + (U.getState() && U.getState().phase)); return { ok: false, exc: true }; }
    if (cfg.errcheck && before !== null && res && res.ok === false && !res.ended && U.getState() === s0) { const a = ser(); if (a !== before) find("MEDIA", "ERRMUT", name + " devolvió error pero mutó estado: " + res.msg + " " + lastOp); }
    return res;
  }
  let chIdx = 0;
  function chronCheck() {
    const s = U.getState(); if (!s) return;
    for (; chIdx < s.chronicle.length; chIdx++) {
      const t = s.chronicle[chIdx].text; let m;
      const P = n => s.players.find(p => p.name === n);
      if ((m = t.match(/^✖ (.+) ha caído \((.+)\)\.$/))) { const p = P(m[1]); if (!p || !p.dead) find("ALTA", "VERAC", "crónica 'ha caído' pero vive: " + t); else if (p.cause !== m[2]) find("MEDIA", "VERAC", "causa difiere " + t + " vs " + p.cause); }
      else if ((m = t.match(/^✖ (.+) ha sido devorado\.$/))) { const p = P(m[1]); if (!p || !p.dead || p.cause !== "devorado") find("ALTA", "VERAC", "devorado no coincide: " + t); }
      else if ((m = t.match(/^✖ (.+) se desploma, moribundo\.$/))) { const p = P(m[1]); if (!p || !(p.dying || p.dead)) find("ALTA", "VERAC", "se desploma pero no moribundo/muerto: " + t + " dying=" + (p && p.dying)); }
      else if ((m = t.match(/ha desenmascarado al Asesino: (.+)\.$/))) { const p = P(m[1]); if (!p || p.alignment !== "asesino") find("ALTA", "VERAC", "desenmascarado no es asesino: " + t); }
      else if ((m = t.match(/^✧ El Umbral se ha abierto/))) { if (!s.players.filter(p => !p.dead).every(p => p.corr >= 50)) find("MEDIA", "VERAC", "Umbral abierto sin corr>=50 (puede haber bajado después)"); }
      else if ((m = t.match(/^Alguien ha socorrido a (.+): sigue con vida\.$/))) { const p = P(m[1]); if (!p) find("ALTA", "VERAC", "socorrido desconocido"); }
      else if (/undefined|NaN|\[object|null/.test(t)) find("ALTA", "TEXT", "crónica rota: " + t);
    }
  }
  function checks(tag) {
    chronCheck();
    const out = L.invState(E, ctx); out.forEach(m => find("ALTA", "INV", m + " (tras " + lastOp + ")"));
    if (cfg.deep) deepText();
  }
  function deepText() {
    const s = U.getState(); if (!s) return; const w = [];
    s.players.forEach(p => {
      const g = U.getSince(p.id); if (g) L.walk(g, "since" + p.id, w);
      L.walk(U.healthInfo(p), "hinfo" + p.id, w); const vh = U.visibleHealth(p); if (L.BADRE.test(vh)) w.push("vh " + vh);
      L.walk(U.getPactOffers(p.id), "po", w); L.walk(U.getOffer(p.id), "offer", w); L.walk(U.getHandOffer(p.id), "ho", w);
      L.walk(U.declareOptions(p.id), "dopt", w); L.walk(U.activePacts(p.id), "ap", w);
      if (s.phase === "private" && !p.dead) { const va = U.visibleActions(p); va.main.concat(...va.more.map(m => m.acts)).forEach(a => { L.walk(U.actionOdds(p.id, a.id), "odds" + a.id, w); }); }
      (p.spells || []).forEach(sp => { L.walk(U.spellInfo(p.id, sp.id, (p.id + 1) % s.players.length, "normal"), "spinfo", w); L.walk(U.spellInfo(p.id, sp.id, null, "desatado"), "spinfo2", w); L.walk(U.spellProgress(sp), "spprog", w); });
      L.walk(U.xpInfo(p), "xp", w);
    });
    L.walk(U.buildStory(), "story", w);
    ["exportStory"].forEach(fn => [true, false].forEach(b => { const t = U[fn](b); if (typeof t !== "string" || !t.length || L.BADRE.test(t)) { const m = String(t).match(/.{0,60}(undefined|NaN|\[object|\bnull\b|Infinity|\{\w+\}).{0,30}/); w.push(fn + "(" + b + "): " + (m && m[0])); } }));
    s.players.forEach(p => { L.walk(U.secretInfo(p.id), "secretInfo" + p.id, w); L.walk(U.domInfo(p), "dom", w); L.walk(U.aggrSummary(p), "aggr", w); L.walk(U.unlockNotices(p, true), "unl", w); });
    L.walk(U.councilSeconds(), "cs", w); L.walk(U.councilPrompt(), "cp", w);
    const lg = U.exportLog(); if (L.BADRE.test(lg.split("\n").filter(x=>!/RECHAZADO|ANOMAL/.test(x)).join("\n"))) { const m = lg.match(/.{0,60}(undefined|NaN|\[object|\bnull\b).{0,30}/); w.push("exportLog: " + (m && m[0])); }
    if (/ANOMALÍAS: (?!ninguna)/.test(lg)) find("MEDIA", "ANOM", lg.match(/ANOMALÍAS: .*/)[0].slice(0, 300));
    w.slice(0, 4).forEach(x => find("ALTA", "TEXT", x + " (tras " + lastOp + ")"));
  }
  function roundtrip() {
    const s = U.getState(); if (!s || s.phase === "ending") return;
    U.save(); const before = JSON.stringify(s); const ld = U.loadGame(); calls += 2;
    if (!ld) { find("ALTA", "RT", "loadGame devolvió null tras save (fase " + s.phase + ")"); return; }
    const after = JSON.stringify(U.getState());
    if (before !== after) { let i = 0; while (before[i] === after[i]) i++; find("ALTA", "RT", "save/load difiere en fase " + s.phase + " cerca de: " + before.slice(Math.max(0, i - 60), i + 60) + " || " + after.slice(Math.max(0, i - 60), i + 60)); }
  }
  // ---- crear
  const names = NAMES.slice(0, cfg.np);
  let nPl = cfg.np;
  if (cfg.resume) { L.mem["umbral.v5.save"] = cfg.resume; const st0 = U.loadGame(); if (!st0) { find("ALTA", "COMPAT", "loadGame devolvió null con save antiguo " + (cfg.from || "")); return { F, calls, steps, ended: false }; } nPl = st0.players.length; cfg.np = nPl; checks(); }
  else try { U.createGame(names, { minutes: cfg.minutes }); } catch (e) { find("ALTA", "EXC", "createGame " + e.message); return { F, calls, steps, ended: false }; }
  if (cfg.mutate) {
    const s = U.getState(); const ids = Object.keys(D.ITEMS); const nAss = R(3);
    s.players.forEach((p, i) => {
      if (rngB() < 0.5) U._health.damage(p, 1 + R(U.maxHp(p) + 4), { src: pickB(["gen", "cazar", "magia", "apunalar"]) });
      if (rngB() < 0.15 && !p.dead) U._health.finish(p, pickB(["heridas", "devorado"]));
      p.corr = R(101); p.virtue = R(101); p.focus = R(3);
      for (let k = R(7); k > 0; k--) p.items.push({ id: pickB(ids) });
      if (rngB() < 0.3 && !p.dead && !p.dying) { U._health.initHealth(p); { const sid = pickB(Object.keys(D.STATUS)); if (!p.status.some(x => x.id === sid)) p.status.push({ id: sid, left: 1 + R(3) }); } }
      if (i < nAss && !p.dead) { p.alignment = "asesino"; p.asesinoRound = 1; p.asesinoVia = "ceder"; if (s.assassinId === null) s.assassinId = p.id; if (rngB() < 0.3) { p.exposed = true; s.assassinExposed = true; } }
      p.acted = p.dead || p.dying;
    });
    const al = s.players.filter(x => !x.dead);
    if (al.length < 2) { s.players.forEach(x => { if (x.dead && !x.alignment) { } }); }
    s.turn = s.order.find(id => !s.players[id].dead && !s.players[id].acted); if (s.turn === undefined) s.turn = 0;
    // hand/pact aleatorios
    for (let k = R(3); k > 0; k--) { const a = R(nPl), b = (a + 1 + R(nPl - 1)) % nPl; s.hands.push({ from: a, to: b, mode: pickB(["sincera", "trampa"]), status: pickB(["offered", "active"]), round: 1, since: 1, stacks: 0, age: 0 }); }
    ctx.wasDead = {}; ctx.wasAss = {}; s.players.forEach(p => { if (p.dead) ctx.wasDead[p.id] = true; });
    checks();
  }
  const tm = (ms) => { let n = 0; while (ms > 0 && n++ < 200) { const d = Math.min(ms, 5000); U.tick(d); ms -= d; if (U.timeUp()) break; } };
  const stakes = ["trampa", "sincera", 5, 10, 20, "5", 0, null, undefined, 7, "x"];
  function randAction(p, validOnly) {
    const s = U.getState();
    let a = pickB(D.ACTIONS.concat(D.ACTIONS)).id;
    if (!validOnly && rngB() < 0.1) a = pickB(["xyz", null, undefined, "__proto__", "constructor", 5, "conjurar"]);
    if (validOnly) { const va = U.visibleActions(p); const all = va.main.concat(...va.more.map(m => m.acts)).filter(x => x.id !== "conjurar"); a = pickB(all).id; const fav = all.filter(x => x.id === "alzar" || x.id === "socorrer"); if (fav.length && rngB() < 0.45) a = pickB(fav).id; }
    const def = D.ACTIONS.find(x => x.id === a);
    let t = null, st = null;
    if (!validOnly) { t = randId(nPl); st = pickB(stakes); }
    else {
      if (def.target) { const o = s.players.filter(x => x.id !== p.id && (a === "alzar" || !x.dead) && (!def.canTarget || def.canTarget(x, p))); t = o.length ? pickB(o).id : null; }
      st = def.mode ? pickB(["trampa", "sincera"]) : def.gamble ? pickB([5, 10, 20]) : null;
    }
    return [a, t, st];
  }
  function legalTurn(p) {
    const s = U.getState();
    const of = U.getOffer(p.id); if (of && rngB() < 0.6) call("answerOffer", p.id, rngB() < 0.5);
    U.getPactOffers(p.id).forEach(o => { if (rngB() < 0.8) call("answerPact", p.id, o.idx, rngB() < 0.6); });
    if (U.getHandOffer(p.id) && rngB() < 0.7) call("answerHand", p.id, rngB() < 0.6);
    // objeto
    if (rngB() < 0.5 && p.items.length && !p.usedItem) {
      const ii = R(p.items.length), idf = D.ITEMS[p.items[ii].id];
      if (idf.kind === "tome") { const so = call("studyOptions", p.id, ii); if (so.ok) { if (rngB() < 0.3 && p.spells.length) call("improveSpell", p.id, pickB(p.spells).id); else call("learnSpell", p.id, R(3), pickB(["potente", "estable", "sutil"])); } }
      else { const tg = s.players.filter(x => x.id !== p.id && !x.dead); call("useItem", p.id, ii, tg.length ? pickB(tg).id : null); }
    }
    if (p.acted) return;
    let done = false;
    if (p.spells && p.spells.length && rngB() < 0.5) {
      const sp = pickB(p.spells); const tg = s.players.filter(x => x.id !== p.id && !x.dead);
      const r = call("cast", p.id, sp.id, tg.length ? pickB(tg).id : null, pickB(["normal", "cauto", "desatado", "x", null]));
      if (r.ok) done = true;
    }
    for (let k = 0; k < 6 && !done; k++) { const [a, t, st] = randAction(p, true); const r = call("act", p.id, a, t, st); if (r.ok) done = true; if (r.exc) break; }
    if (!done && !p.acted) { const r = call("act", p.id, "meditar", null, null); if (!r.ok && U.getState().phase !== "ending") find("ALTA", "STUCK", "ni meditar funciona: " + r.msg + " estado: dead=" + p.dead + " dying=" + p.dying + " acted=" + p.acted); }
    if (U.getState().pendingPush && rngB() < 0.5) call("pushLuck", p.id);
    const en = U.encounterStart(p.id); if (en && rngB() < 0.8) call("encounterAct", p.id, pickB(en.options).id);
  }
  function legalFinish(p) {
    if (p.acted && !p.dead && rngB() < 0.6) {
      const al = U.getState().players.filter(x => x.id !== p.id && !x.dead);
      const ty = pickB(["romper", "acusacion", "emboscada", "pacto_no_agresion", "pacto_silencio", "pacto_proteccion", "ninguna"]);
      call("declare", p.id, ty, al.length ? pickB(al).id : 0);
    }
    const fr = call("finishTurn");
  }
  function chaosOp() {
    const s = U.getState(); const n = nPl; const p = s.players[R(n)]; const cur = s.players[s.turn];
    const pid = rngB() < 0.6 ? s.turn : randId(n);
    const k = R(30);
    switch (k) {
      case 0: case 1: case 2: { const [a, t, st] = randAction(cur, false); return call("act", rngB() < 0.8 ? s.turn : randId(n), a, t, st); }
      case 3: return call("cast", pid, rngB() < 0.7 && cur.spells.length ? pickB(cur.spells).id : pickB(["zz", null, undefined]), randId(n), pickB(["normal", "cauto", "desatado", "x", null, 3]));
      case 4: return call("useItem", pid, pickB([R(6), -1, 99, null, "0", 0.5]), randId(n));
      case 5: return call("studyOptions", pid, pickB([R(6), -1, 99, null]));
      case 6: return call("learnSpell", pid, pickB([0, 1, 2, 3, -1, null, "0"]), pickB(["potente", "estable", "sutil", "x", null]));
      case 7: return call("improveSpell", pid, cur.spells.length && rngB() < 0.7 ? pickB(cur.spells).id : "zz");
      case 8: return call("answerOffer", pid, rngB() < 0.5);
      case 9: return call("answerPact", pid, pickB([0, 1, 2, 5, -1, null, 99]), rngB() < 0.5);
      case 10: return call("answerHand", pid, rngB() < 0.5);
      case 11: case 12: return call("declare", pid, pickB(["romper", "acusacion", "emboscada", "pacto_no_agresion", "pacto_silencio", "pacto_proteccion", "ninguna", "xx", null]), randId(n));
      case 13: { const e = call("encounterStart", pid); return call("encounterAct", pid, pickB(["irse", "atacar", "hablar", "xx", null])); }
      case 14: return call("pushLuck", pid);
      case 15: return call("finishTurn");
      case 16: return call("nextTurn");
      case 17: return rngB() < 0.3 ? call("beginCouncil") : call("resolveCouncil");
      case 18: return call("endCouncil");
      case 19: return rngB() < 0.15 ? call("nextRound") : call("endCouncil");
      case 20: case 21: return call("registerInteraction", randId(n), pickB(["acusacion", "emboscada", "romper", "xx"]), randId(n));
      case 22: tm(R(40000)); return;
      case 23: { call("getSince", pid); call("getOffer", pid); call("getPactOffers", pid); call("declareOptions", pid); call("getHandOffer", pid); call("activePacts", pid); call("studyOptions", pid, 0); return; }
      case 24: { call("spellInfo", pid, pickB(["zz", null, (cur.spells[0] || {}).id]), randId(n), pickB(["cauto", "x", null])); return call("actionOdds", pid, pickB(["investigar", "zz", null, "cazar", "conjurar"])); }
      case 25: return rngB() < 0.03 ? call("forceEnd") : call("computeEnding");
      case 26: return call("save");
      case 27: return call("encounterAct", randId(n), "irse");
      default: { const [a, t, st] = randAction(cur, true); return call("act", s.turn, a, t, st); }
    }
  }
  function driver() {
    const s = U.getState();
    if (s.phase === "private") {
      if (s.handoff) { const r = call("nextTurn"); if (r === "blocked") find("ALTA", "STUCK", "nextTurn blocked en flujo legal"); return; }
      const p = s.players[s.turn];
      tm(R(40000) * (cfg.pace || 1));
      if (!p.acted) legalTurn(p); else legalFinish(p);
      if (p.acted && !U.getState().handoff && U.getState().phase === "private") legalFinish(p);
    } else if (s.phase === "council") {
      const n = R(3);
      for (let i = 0; i < n; i++) { const al = s.players.filter(x => !x.dead); const a = pickB(al), b = pickB(al); call("registerInteraction", a.id, pickB(["acusacion", "emboscada", "romper"]), b.id); }
      call("resolveCouncil"); tm(R(120000) * (cfg.pace || 1)); call("endCouncil");
    } else if (s.phase === "resolution") { call("nextRound"); if (U.getState() && U.getState().timeAsk) { global.FZ_ASK = (global.FZ_ASK||0)+1; call("answerTime", pickB([1, 2, "end", 1, "zzz", 3, null])); } else if (rngB() < 0.1) { call("addTime"); } }
  }
  const garbageP = cfg.mode === "chaos" ? 0.55 : cfg.mode === "mixed" ? 0.25 : 0.0;
  const MAXS = 6000;
  while (steps++ < MAXS) {
    const s = U.getState(); if (!s || s.phase === "ending") break;
    if (rngB() < garbageP) chaosOp(); else driver();
    if (cfg.rt && U.getState().phase !== "ending") roundtrip();
    checks();
  }
  const s = U.getState();
  let ended = s && s.phase === "ending";
  if (!ended) { // intento de cierre limpio: avanzar tiempo
    for (let i = 0; i < 4000 && U.getState().phase !== "ending"; i++) { try { driver(); tm(30000); } catch (e) { break; } }
    ended = U.getState().phase === "ending";
    find("ALTA", "NOEND", "la partida no terminó tras " + MAXS + " pasos (fase " + s.phase + ", ronda " + s.round + ")" + (ended ? " pero sí tras avanzar" : " NI avanzando"));
  }
  checks();
  // veracidad final
  const st = U.getState(); const chron = st.chronicle.map(c => c.text);
  st.players.forEach(p => {
    const fell = chron.filter(t => t.startsWith("✖ " + p.name + " ha caído"));
    if (p.dead && fell.length !== 1 && !chron.some(t => t.includes(p.name) && (/devor/i.test(t) || (p.cause === "alzado" && /rematado|levantado/.test(t))))) find("MEDIA", "VERAC", "muerto sin línea de caída única (" + fell.length + ") " + p.name + " causa=" + p.cause);
    if (!p.dead && fell.length) find("ALTA", "VERAC", p.name + " figura caído en crónica pero vive");
  });
  { const e = st.ending; const ass = st.players.filter(p => p.alignment === "asesino"), alive = st.players.filter(p => !p.dead);
    const chk = (c, m) => { if (!c) find("ALTA", "ENDING", m + " :: " + e.title + " win=" + e.winner + " vivos=" + alive.length + " ases=" + ass.length + "/" + ass.filter(p => !p.dead).length); };
    chk(!(e.winner === "asesino") || ass.some(p => !p.dead), "gana asesino sin asesino vivo");
    if (e.title === "La última sombra") chk(alive.every(p => p.alignment === "asesino") && alive.length > 0, "ultima sombra con inocentes vivos");
    if (e.title === "El Umbral ha sido derrotado") chk(ass.length > 0 && ass.every(p => p.dead) && alive.length > 0, "umbral derrotado incoherente");
    if (e.title === "Nunca hubo un Asesino") chk(ass.length === 0, "nunca hubo asesino pero hay");
    if (e.title === "La llama que no se apaga") chk(ass.length === 0 && alive.length > 1, "llama incoherente");
    if (e.title === "El último en pie") chk(ass.length === 0 && alive.length === 1, "ultimo en pie incoherente");
    if (e.title === "Silencio bajo la piedra") chk(alive.length === 0, "silencio con vivos");
    if (e.title === "La noche no pudo devorarlos") chk(ass.some(p => !p.dead) && alive.some(p => p.alignment !== "asesino"), "no pudo devorarlos incoherente");
    if (e.title === "La noche cobró su tributo") { const non = st.players.filter(p => p.alignment !== "asesino"); chk(non.reduce((n, p) => n + (p.dead || p.dying ? 1 : (p.hp <= 0.35 * (7 + p.stats.cuerpo) && st.maxRounds < 10 ? 0.5 : 0)), 0) >= U.assassinGoal(non.length), "tributo sin meta"); }
    e.players.forEach((q, i) => { const p = st.players[i]; if (q.dead !== !!p.dead || q.hp !== p.hp || q.name !== p.name) find("ALTA", "ENDING", "ending.players difiere de estado " + p.name); });
    if (/devorad/i.test(e.text) && e.winner !== "supervivientes" && false) {}
  }
  return { F, calls, steps, ended, state: cfg.keep ? JSON.stringify(st) : null, end: st.ending && st.ending.title, rounds: st.round, winner: st.ending && st.ending.winner };
}
module.exports = { playGame, NAMES };
if (require.main === module) {
  const E = L.loadEngine(process.env.ENGDIR || (process.env.ENG === "092" ? L.W092 : L.W097));
  const [N, mode, rt, errc, deep] = [Number(process.argv[2] || 20), process.argv[3] || "mixed", process.argv[4] === "1", process.argv[5] === "1", process.argv[6] === "1"];
  const base = Number(process.argv[7] || 1);
  const T0 = Number(process.hrtime.bigint()/1000000n); const all = []; let calls = 0, steps = 0, ends = {}, t0 = Date.now(); let bad = 0; 
  for (let g = 0; g < N; g++) {
    const seed = base + g; const rr = L.mulberry(seed * 31);
    const np = process.env.FNP ? Number(process.env.FNP) : 3 + Math.floor(rr() * 8), minutes = (process.env.FMIN ? process.env.FMIN.split(",").map(Number) : [10, 15, 20, 30, 45, 60])[Math.floor(rr() * (process.env.FMIN ? process.env.FMIN.split(",").length : 6))];
    const r = playGame(E, { seed, np, minutes, mode, rt, errcheck: errc, deep, pace: [0.3, 1, 2, 4][Math.floor(rr() * 4)] });
    calls += r.calls; steps += r.steps; all.push(...r.F); ends[r.winner + "/" + r.end] = (ends[r.winner + "/" + r.end] || 0) + 1; if (!r.ended) bad++;
  }
  console.log(JSON.stringify({ N, mode, rt, errc, deep, calls, steps, ms: Number(process.hrtime.bigint()/1000000n) - T0, noend: bad, ends }, null, 0));
  const uniq = {}; all.forEach(f => { const k = f.tag + "|" + f.msg.replace(/\d+/g, "#").slice(0, 120); if (!uniq[k]) uniq[k] = { n: 0, f }; uniq[k].n++; });
  Object.values(uniq).sort((a, b) => (a.f.sev < b.f.sev ? -1 : 1)).forEach(u => console.log(u.f.sev, u.f.tag, "x" + u.n, "seed=" + u.f.seed, "np=" + u.f.np, "min=" + u.f.min, "pace=" + u.f.pace, u.f.mode, "::", u.f.msg.slice(0, 400)));
}
