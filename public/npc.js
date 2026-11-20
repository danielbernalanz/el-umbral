/* EL UMBRAL — IA de los NPC (jugadores controlados por la app).
   IIFE sin dependencias. Usa SOLO la API pública del motor a través de un objeto `io` con los mismos nombres que UMBRAL
   (en local es UMBRAL; en el servidor es un adaptador que ejecuta cada orden como ese jugador).
   Decisiones deterministas: el azar sale de un hash de la partida (createdAt), el jugador y la ronda; nunca de Math.random.
   Un NPC no hace trampas: solo mira lo que vería un jugador (sus pistas, la salud visible y el estado público de los demás). */
(function (g) {
  "use strict";

  const D = g.UMBRAL_DATA || (typeof require !== "undefined" ? require("./data.js") : null);

  function h32(s) { let x = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; }
  function mulberry(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Perfiles. hostile = prob. de intentar una acción hostil en su turno; soc = socorrer al moribundo; tempt = aceptar la tentación del Asesino;
     pact/hand/offer = aceptar pactos, manos y tratos; accuse = acusar con indicios suficientes; ambush = emboscar; prop = proponer un pacto. */
  const PROF = {
    prudente:  { hostile: 0.03, soc: 0.75, tempt: 0.05, pact: 0.7,  hand: 0.6, offer: 0.3,  cura: 0.8,  accuse: 0.8,  ambush: 0.02, prop: 0.12, spell: 0.35, rest: 2, explore: 3 },
    agresivo:  { hostile: 0.5,  soc: 0.35, tempt: 0.5,  pact: 0.35, hand: 0.4, offer: 0.35, cura: 0.7,  accuse: 0.55, ambush: 0.4,  prop: 0.04, spell: 0.5,  rest: 1, explore: 2 },
    curandero: { hostile: 0,    soc: 0.97, tempt: 0.02, pact: 0.8,  hand: 0.7, offer: 0.45, cura: 0.95, accuse: 0.7,  ambush: 0,    prop: 0.2,  spell: 0.3,  rest: 3, explore: 2 },
    oscuro:    { hostile: 0.3,  soc: 0.3,  tempt: 0.6,  pact: 0.45, hand: 0.35, offer: 0.5, cura: 0.8,  accuse: 0.5,  ambush: 0.2,  prop: 0.06, spell: 0.55, rest: 1, explore: 3 }
  };
  const DESC = {
    prudente: "Evita el conflicto, investiga y busca pactos de protección.",
    agresivo: "Ataca con facilidad y acepta antes la tentación.",
    curandero: "Socorre, protege y cura; casi nunca hace daño.",
    oscuro: "Juega con la magia prohibida y se deja tentar."
  };
  const HP_RANK = { "Sin heridas visibles": 0, "Magullado": 1, "Herido": 2, "Malherido": 3, "Al borde de caer": 4, "Moribundo": 5 };
  function hpRank(io, x) { const t = String(io.visibleHealth ? io.visibleHealth(x) : "").split(" · ")[0]; return HP_RANK[t] !== undefined ? HP_RANK[t] : 0; }

  /* Siguiente nombre de NPC libre (determinista: primer nombre de la lista no usado, empezando por un desplazamiento fijo). */
  function pickName(used, salt) {
    const names = (D && D.NPC_NAMES) || ["NPC"];
    const u = {}; (used || []).forEach(function (n) { u[String(n).trim().toLowerCase()] = 1; });
    const off = (salt || 0) % names.length;
    for (let i = 0; i < names.length; i++) { const n = names[(off + i) % names.length]; if (!u[n.toLowerCase()]) return n; }
    return "NPC " + ((used || []).length + 1);
  }
  function profileFor(slot, salt) { const ids = Object.keys((D && D.NPC_PROFILES) || { prudente: 1 }); return ids[((salt || 0) + slot) % ids.length]; }

  /* ---------- el turno privado completo de un NPC (termina con finishTurn) ---------- */
  function playTurn(io, pid) {
    const s = io.getState(), p = s && s.players[pid];
    if (!p || p.dead || !p.npc || s.phase !== "private") return null;
    const R = mulberry(h32(s.createdAt + ":" + pid + ":" + s.round + ":" + (p.npcSwaps || 0)));
    let out = null;
    try { out = turn(io, s, p, R); }
    catch (e) {
      if (g.UMBRAL_NPC_STRICT || (typeof process !== "undefined" && process.env && process.env.NPC_STRICT)) throw e;
      try { if (!p.acted) io.act(pid, "meditar", null, null); } catch (e2) { /* nada */ }
    }
    try { if (!p.acted && !p.dead && !p.dying) io.act(pid, "meditar", null, null); } catch (e3) { /* nada */ }
    if (io.getState().phase === "private") io.finishTurn(pid);
    return out;
  }

  function turn(io, s, p, R) {
    const pid = p.id, prof = PROF[p.npc] || PROF.prudente;
    if (p.dying) return { skipped: true };
    const idx = function (n) { return Math.floor(R() * n); };
    const pickOf = function (a) { return a.length ? a[idx(a.length)] : null; };
    const shuffle = function (a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = idx(i + 1); const t = b[i]; b[i] = b[j]; b[j] = t; } return b; };
    const living = function () { return s.players.filter(function (x) { return x.id !== pid && !x.dead; }); };
    const can = function (id) { const a = D.ACTIONS.find(function (x) { return x.id === id; }); return !!a && io.isUnlocked(p, a) && !(a.assassinOnly && p.alignment !== "asesino"); };
    const act = function (id, t, st) { const r = io.act(pid, id, t == null ? null : t, st == null ? null : st); return !!(r && r.ok); };
    const clueScore = function (x) { return (p.clues || []).filter(function (c) { return c.about === x.id; }).reduce(function (a, c) { return a + c.strength; }, 0); };

    /* ya había actuado (jugador sustituido a mitad de turno): solo queda el encuentro y la declaración */
    if (p.acted) return finishWith(io, s, p, R, prof, pickOf, "ya_actuo");

    /* 1) tratos, manos y pactos pendientes */
    const of = io.getOffer(pid);
    if (of) { if (of.id === "asesino") io.answerOffer(pid, R() < prof.tempt); else io.answerOffer(pid, R() < (of.id === "cura" ? prof.cura : prof.offer)); }
    if (io.getHandOffer(pid)) io.answerHand(pid, R() < prof.hand);
    for (let k = 0; k < 6; k++) { const po = io.getPactOffers(pid); if (!po.length) break; io.answerPact(pid, po[0].idx, R() < prof.pact); }

    const al = living();
    const tgt = pickOf(al);
    const asesino = function () { return p.alignment === "asesino"; };

    /* 2) objetos útiles y tomos */
    if (p.items.length && !p.usedItem) {
      const i = p.items.findIndex(function (it) { const kd = D.ITEMS[it.id] && D.ITEMS[it.id].kind; return ["heal", "cleanse", "elixir", "reflect", "ward", "defense", "fog"].indexOf(kd) !== -1 && (p.wounds > 0 || kd !== "heal"); });
      if (i >= 0 && R() < 0.5) io.useItem(pid, i, null);
      const ti = p.items.findIndex(function (it) { return D.ITEMS[it.id] && D.ITEMS[it.id].kind === "tome"; });
      if (ti >= 0) { const so = io.studyOptions(pid, ti); if (so && so.ok) io.learnSpell(pid, idx(3), "estable"); }
    }

    /* 3) socorrer */
    const dy = al.find(function (x) { return x.dying; });
    if (!asesino() && dy && can("socorrer") && R() < prof.soc && act("socorrer", dy.id)) return finishWith(io, s, p, R, prof, pickOf, "socorrer");

    /* 4) el Asesino cuando lo es (con menos puntería que un humano decidido) */
    if (asesino()) {
      if (can("alzar") && R() < 0.35) {
        const c = al.concat(s.players.filter(function (x) { return x.id !== pid && x.dead; })).filter(function (x) { const a = D.ACTIONS.find(function (q) { return q.id === "alzar"; }); return !a.canTarget || a.canTarget(x, p); });
        if (c.length && act("alzar", c[0].id)) return finishWith(io, s, p, R, prof, pickOf, "alzar");
      }
      if (can("sombra_guarda") && R() < 0.08 && act("sombra_guarda")) return finishWith(io, s, p, R, prof, pickOf, "sombra_guarda");
      if (can("sombra_espia") && R() < 0.08 && tgt && act("sombra_espia", tgt.id)) return finishWith(io, s, p, R, prof, pickOf, "sombra_espia");
      const w = al.slice().sort(function (a, b) { return (hpRank(io, b) - hpRank(io, a)) || (a.id - b.id); })[0];
      if (w && can("devorar") && hpRank(io, w) >= 3 && R() < 0.35 && act("devorar", w.id)) return finishWith(io, s, p, R, prof, pickOf, "devorar");
      if (w && R() < 0.65 && act("cazar", w.id)) return finishWith(io, s, p, R, prof, pickOf, "cazar");
    }

    /* 5) conjuros */
    if (p.spells && p.spells.length && R() < prof.spell) {
      const sp = p.spells[idx(p.spells.length)];
      if (sp.kind === "def" || R() < prof.hostile) { const t = sp.target ? tgt : null; if (!sp.target || t) { const r = io.cast(pid, sp.id, t ? t.id : null, "normal"); if (r && r.ok) return finishWith(io, s, p, R, prof, pickOf, "conjuro"); } }
    }

    /* 6) acción hostil */
    if (R() < prof.hostile && tgt) {
      const hs = ["apunalar", "robar", "hechizar", "envenenar", "maldecir", "aturdir", "sombra_hostiga", "trampa", "sabotear"].filter(can);
      for (const id of shuffle(hs)) { if (act(id, tgt.id)) return finishWith(io, s, p, R, prof, pickOf, id); }
    }
    if (p.corr >= 12 && R() < 0.12 && can("sombra_espia") && tgt && act("sombra_espia", tgt.id)) return finishWith(io, s, p, R, prof, pickOf, "sombra_espia");
    if (R() < 0.08 && can("sombra_guarda") && act("sombra_guarda")) return finishWith(io, s, p, R, prof, pickOf, "sombra_guarda");

    /* 7) vida normal */
    const pool = [];
    if (p.wounds > 0 && can("descansar")) { for (let k = 0; k < prof.rest; k++) pool.push("descansar"); }
    if (p.corr >= 20) pool.push("meditar", "meditar");
    if (can("bendecir") && p.corr >= 15) pool.push("bendecir");
    if (can("entrenar")) pool.push("entrenar");
    if (can("tender") && p.npc !== "agresivo") pool.push("tender");
    for (let k = 0; k < 3; k++) pool.push("investigar");
    for (let k = 0; k < prof.explore; k++) pool.push("explorar");
    pool.push("proteger", "meditar");
    if (p.npc === "curandero") pool.push("proteger", "proteger");
    const sus = al.slice().sort(function (a, b) { return (clueScore(b) - clueScore(a)) || (a.id - b.id); })[0];
    for (const id of shuffle(pool)) {
      const a = D.ACTIONS.find(function (x) { return x.id === id; });
      if (!a || !can(id)) continue;
      if (id === "investigar" && sus) { if (act(id, (R() < 0.6 ? sus : tgt || sus).id)) return finishWith(io, s, p, R, prof, pickOf, id); continue; }
      if (a.target) {
        if (!tgt) continue;
        if (id === "tender") { if (act(id, tgt.id, R() < 0.7 ? "sincera" : "trampa")) return finishWith(io, s, p, R, prof, pickOf, id); continue; }
        if (act(id, tgt.id)) return finishWith(io, s, p, R, prof, pickOf, id);
      } else if (act(id)) return finishWith(io, s, p, R, prof, pickOf, id);
    }
    act("meditar");
    return finishWith(io, s, p, R, prof, pickOf, "meditar");
  }

  /* 8) tras actuar: encuentro y declaración secreta para el Consejo */
  function finishWith(io, s, p, R, prof, pickOf, did) {
    const pid = p.id;
    if (p.acted && !p.dying && !p.dead) {
      const en = io.encounterStart(pid);
      if (en && en.options && en.options.length) {
        let opts = en.options;
        if (p.npc !== "agresivo" && p.npc !== "oscuro") opts = opts.filter(function (o) { return !/atacar|matar|atrapar|robar|amenazar/.test(o.id); });
        const o = pickOf(opts) || en.options[en.options.length - 1];
        io.encounterAct(pid, o.id);
      }
    }
    if (p.acted && !p.dying && !p.dead) declareStep(io, s, p, R, prof, pickOf);
    return { did: did };
  }

  function declareStep(io, s, p, R, prof, pickOf) {
    const pid = p.id, op = io.declareOptions(pid);
    if (!op || !op.targets || !op.targets.length) return;
    const score = function (t) { return (p.clues || []).filter(function (c) { return c.about === t.id; }).reduce(function (a, c) { return a + c.strength; }, 0); };
    let best = null, bs = 0;
    op.targets.forEach(function (t) { const sc = score(t); if (sc > bs) { bs = sc; best = t; } });
    if (best && bs >= 3 && R() < prof.accuse) { io.declare(pid, "acusacion", best.id); return; }
    if (op.romper && op.romper.length && R() < 0.05) { io.declare(pid, "romper", op.romper[0]); return; }
    const free = op.targets.filter(function (t) { return !t.dying && (!best || t.id !== best.id || bs < 2); });
    if (free.length && R() < prof.prop) {
      const t = pickOf(free);
      const type = p.npc === "agresivo" ? "pacto_no_agresion" : p.npc === "curandero" ? "pacto_proteccion" : (R() < 0.5 ? "pacto_proteccion" : "pacto_silencio");
      if (io.declare(pid, type, t.id).ok) return;
    }
    if (R() < prof.ambush) io.declare(pid, "emboscada", pickOf(op.targets).id);
  }

  /* Pasa por los NPC que tocan en LOCAL (sin pantalla de traspaso) hasta llegar a un humano, al Consejo o al final.
     U es la API del motor (UMBRAL). Devuelve cuántos turnos de NPC se resolvieron. */
  function localAdvance(U) {
    let n = 0;
    for (let guard = 0; guard < 60; guard++) {
      const s = U.getState();
      if (!s || s.phase !== "private") return n;
      const cur = s.players[s.turn];
      if (s.handoff) {
        /* el turno actual ya se entregó: ¿quién sigue? */
        const o = s.order || s.players.map(function (q) { return q.id; });
        const rest = o.slice(o.indexOf(s.turn) + 1).filter(function (id) { return !s.players[id].dead && !s.players[id].acted; });
        if (!rest.length) return n;
        if (!s.players[rest[0]].npc) return n;
        U.nextTurn(); continue;
      }
      if (!cur || !cur.npc) return n;
      if (cur.dead) { U.nextTurn(); continue; }
      if (!cur.acted) { playTurn(U, cur.id); n++; if (U.getState().phase !== "private") return n; }
      if (!U.getState().handoff) { const r = U.finishTurn(); if (r && r.ok === false) return n; }
    }
    return n;
  }

  const API = { PROFILES: PROF, DESC: DESC, playTurn: playTurn, localAdvance: localAdvance, pickName: pickName, profileFor: profileFor, mulberry: mulberry, h32: h32 };
  g.UMBRAL_NPC = API;
  if (typeof module !== "undefined") module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
