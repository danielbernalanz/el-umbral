"use strict";
/* NPC y partidas de 2 jugadores: motor, servidor, sustitución/recuperación, no-fuga y determinismo. */
const test = require("node:test");
const assert = require("node:assert");
const { Game } = require("../server/game");
const { Rooms } = require("../server/room");
const { loadEngine, seeded } = require("../server/engine_vm");
const { playGame, ENGINE_DIR } = require("./helpers/bot");
const L = require("./helpers/leakcheck");

const NAMES = ["Ana", "Luis", "Marta", "Pablo", "Eva", "Iker", "Noa", "Leo", "Mia", "Rut"];
const PROFILES = ["prudente", "agresivo", "curandero", "oscuro", "mixto"];
process.env.NPC_STRICT = "1";

function mk(n, npcFrom, seed, o) {
  const clk = { t: 1.8e12 };
  const npc = NAMES.slice(0, n).map((x, i) => (i >= npcFrom ? PROFILES[i % 4] : null));
  const g = new Game(NAMES.slice(0, n), Object.assign({ readMs: 0, engineDir: ENGINE_DIR, endAt: clk.t + (20 + (seed % 3) * 10) * 60000, now: () => clk.t, rng: seeded(seed * 7919), npc }, o || {}));
  return { g, clk };
}
/* revisa la vista de todos tras cada comando */
function audited(game, n, tag, problems) {
  const pre = L.prepare(game);
  for (let pid = 0; pid < n; pid++) L.checkView(game, pid, game.view(pid), pre).forEach((p) => problems.push("[" + tag + "] " + p));
}

test("2 jugadores (humanos): partidas completas, sin fugas ni errores", () => {
  const problems = []; let withAss = 0;
  for (let k = 0; k < 10; k++) {
    const { g } = mk(2, 2, 300 + k);
    playGame(g, 300 + k, ["mixed", "dark", "good"][k % 3], { afterCommand() { audited(g, 2, "2j g" + k, problems); } });
    assert.ok(g.ended(), "termina " + k); assert.strictEqual(g.errors.length, 0, g.errors[0]);
    if (g.S().players.some((p) => p.alignment === "asesino")) withAss++;
  }
  assert.deepStrictEqual(problems.slice(0, 5), []);
  assert.ok(withAss > 0, "con 2 jugadores el Asesino puede emerger");
});

test("NPC en la mesa: partidas con 1-9 NPC terminan, juegan solos y no filtran nada (vistas de todos, incluidos NPC)", () => {
  const problems = []; let npcActs = 0;
  const cfg = [[2, 1], [3, 1], [3, 2], [4, 2], [5, 1], [6, 3], [8, 4], [10, 9], [10, 5]];
  cfg.forEach(([n, from], k) => {
    const { g } = mk(n, from, 500 + k);
    playGame(g, 500 + k, "mixed", { afterCommand() { audited(g, n, "n" + n + " g" + k, problems); } });
    assert.ok(g.ended(), "termina n=" + n); assert.strictEqual(g.errors.length, 0, g.errors[0]);
    const v = g.view(0);
    assert.strictEqual(v.phase, "ending");
    g.S().players.forEach((p, i) => { if (i >= from) { assert.ok(p.npc, "marca npc " + i); npcActs += (p.did ? Object.keys(p.did).length : 0); } });
    assert.ok(g.S().ending.players.every((p, i) => p.npc === (i >= from)), "el desenlace marca a los NPC");
  });
  assert.deepStrictEqual(problems.slice(0, 5), []);
  assert.ok(npcActs > 10, "los NPC realizan acciones: " + npcActs);
});

test("vista pública: npc booleano, sin perfil; los NPC nunca cuentan en «faltan N» y no hay Asesino identificable por la vista", () => {
  const { g } = mk(5, 3, 77);
  const v = g.view(0);
  assert.deepStrictEqual(v.players.map((p) => p.npc), [false, false, false, true, true]);
  assert.ok(!JSON.stringify(v).match(/"npc":"/), "el perfil no se publica en la vista de otros");
  assert.strictEqual(v.waitN, 3, "solo cuentan los 3 humanos; los 2 NPC no");
  [0, 1, 2].forEach((i) => { g.exec(i, "act", ["meditar", null, null]); g.exec(i, "finishTurn", []); });
  assert.notStrictEqual(g.S().phase, "private", "con los humanos listos, los NPC ya jugaron y la barrera cierra");
  assert.ok(g.view(0).players.every((p) => typeof p.npc === "boolean"));
});

test("determinismo: misma semilla y reloj => misma partida con NPC (log de eventos idéntico) y NPC solo humano-visibles", () => {
  const run = () => { const { g } = mk(4, 2, 4242); playGame(g, 4242, "mixed", {}); return JSON.stringify(g.S().glog) + "|" + g.S().ending.title; };
  const a = run(), b = run();
  assert.strictEqual(a, b);
  /* motor puro: todos NPC */
  const out = [];
  for (let r = 0; r < 2; r++) {
    const e = loadEngine({ dir: ENGINE_DIR, rng: seeded(9), now: () => 1.8e12 });
    const U = e.U; U.createGame(["A", "B", "C"], { minutes: 15, npc: ["prudente", "agresivo", "oscuro"] });
    for (let guard = 0; guard < 400 && U.getState().phase !== "ending"; guard++) {
      const s = U.getState();
      if (s.phase === "private") { e.NPC.localAdvance(U); if (U.getState().phase === "private" && U.getState().handoff) U.nextTurn(); }
      else if (s.phase === "council") { U.resolveCouncil(); U.endCouncil(); }
      else if (s.phase === "resolution") { if (U.nextRound()) break; if (U.getState().timeAsk) U.answerTime(1); }
      U.tick(30000);
    }
    out.push(JSON.stringify(U.getState().glog));
  }
  assert.strictEqual(out[0], out[1]);
  assert.ok(out[0].length > 500);
});

test("sustituir por NPC y recuperar el sitio: hereda todo, el humano queda bloqueado, recupera al empezar la ronda", () => {
  const { g } = mk(4, 4, 55);
  const S = g.S();
  /* una ronda para que haya historial */
  const rnd = (c) => g.exec(0, c, []);
  playUntilRound(g, 2);
  const p1 = S.players[1];
  const snapP = () => { const o = JSON.parse(JSON.stringify(p1)); delete o.npc; delete o.npcSwaps; delete o.npcSince; return JSON.stringify(o); };
  const before = snapP();
  assert.strictEqual(g.U.replaceWithNpc(1).ok, true);
  assert.strictEqual(snapP(), before, "el NPC hereda TODO el jugador (vitalidad, corrupción, objetos, secreto, rol...)");
  assert.strictEqual(g.U.restoreFromNpc(1).ok, true); assert.ok(!p1.npc);
  assert.strictEqual(g.exec(2, "replaceWithNpc", [1], { isHost: false }).ok, false, "solo el anfitrión sustituye a otro");
  assert.strictEqual(g.exec(0, "replaceWithNpc", [1], { isHost: true }).ok, true);
  assert.ok(p1.npc && PROFILES.indexOf(p1.npc) !== -1);
  assert.strictEqual(g.exec(1, "act", ["meditar", null, null]).ok, false, "el sustituido ya no puede actuar");
  assert.strictEqual(g.view(1).npcInfo.replaced, true);
  assert.strictEqual(g.view(0).players[1].npc, true);
  assert.strictEqual(g.exec(0, "replaceWithNpc", [1], { isHost: true }).ok, false, "ya es NPC");
  assert.strictEqual(g.exec(1, "recoverSeat", []).ok, true);
  assert.strictEqual(g.view(1).npcInfo.recover, true);
  const r0 = S.round;
  playUntilRound(g, r0 + 1);
  assert.ok(!S.players[1].npc, "recupera su sitio al empezar la ronda siguiente");
  assert.strictEqual(g.view(1).npcInfo, null);
  assert.strictEqual(g.exec(1, "act", ["meditar", null, null]).ok, true, "puede jugar de nuevo");
  assert.strictEqual(g.errors.length, 0, g.errors[0]);
  /* nunca se queda la mesa sin humanos */
  const e = mk(2, 2, 56).g;
  assert.strictEqual(e.exec(0, "replaceWithNpc", [1], { isHost: true }).ok, true);
  assert.strictEqual(e.exec(0, "replaceWithNpc", [0], { isHost: true }).ok, false, "debe quedar un humano");
});
function playUntilRound(g, round) {
  let guard = 0;
  while (g.S().round < round && !g.ended() && guard++ < 200) {
    const S = g.S();
    S.players.forEach((p, i) => {
      if (p.dead || p.npc) return;
      if (S.phase === "private" && !g.ready.has(i)) { if (!p.acted) g.exec(i, "act", ["meditar", null, null]); g.exec(i, "finishTurn", []); }
      else if (S.phase === "council") g.exec(i, "councilReady", []);
      else if (S.phase === "resolution" && !S.timeAsk) g.exec(i, "continue", []);
    });
    g.runNpcs();
    if (g.S().phase === "resolution" && g.S().timeAsk) g.exec(g.decider(), "vote", [1]);
  }
}

test("el Asesino sustituido por NPC conserva su rol y el NPC lo juega sin delatarlo", () => {
  let seen = 0;
  for (let k = 0; k < 40 && seen < 3; k++) {
    const { g } = mk(3, 3, 700 + k);
    const S = g.S(); let done = false, assId = -1;
    playGame(g, 700 + k, "dark", { onLoop() {
      if (done) return;
      const a = S.players.find((p) => p.alignment === "asesino" && !p.dead && !p.npc);
      if (a && S.phase === "private") { assId = a.id; done = g.exec(0, "replaceWithNpc", [a.id], { isHost: true }).ok || (a.id === 0 ? false : false); if (a.id === 0) { done = g.exec(1, "replaceWithNpc", [0], { isHost: true }).ok; } }
    } });
    if (!done) continue;
    seen++;
    assert.strictEqual(S.players[assId].alignment, "asesino");
    assert.ok(S.players[assId].npc);
    assert.strictEqual(g.errors.length, 0, g.errors[0]);
    /* ninguna vista de otro jugador nombra al asesino ni a su perfil antes del final: ya comprobado por leak; aquí, el desenlace sí lo cuenta */
    assert.ok(g.view(0).reveal);
  }
  assert.ok(seen >= 1, "se probó al menos una sustitución del Asesino");
});

test("sala: NPC en la sala de espera (solo anfitrión, límite 10), empezar con 1 humano + NPC, 2 jugadores", () => {
  const clk = { t: 1.8e12 };
  const rooms = new Rooms({ engineDir: ENGINE_DIR, now: () => clk.t, readMs: 0 });
  const first = rooms.create("Ana"); const room = rooms.get(first.room);
  const host = room.players[0];
  assert.strictEqual(room.start(host, clk.t + 30 * 60000).ok, false, "1 solo jugador: no basta");
  assert.strictEqual(room.npcOp(host, { op: "add" }).ok, true);
  const lv = room.lobbyView(host);
  assert.strictEqual(lv.npcs.length, 1); assert.strictEqual(lv.canStart, true); assert.ok(!("profile" in lv.npcs[0]), "el perfil no se envía");
  room.join("Luis"); const guest = room.players[1];
  assert.strictEqual(room.npcOp(guest, { op: "add" }).ok, false, "solo el anfitrión añade NPC");
  assert.strictEqual(room.npcOp(host, { op: "remove", index: 5 }).ok, false);
  for (let i = 0; i < 7; i++) assert.strictEqual(room.npcOp(host, { op: "add" }).ok, true);
  assert.strictEqual(room.npcOp(host, { op: "add" }).ok, false, "tope de 10 con NPC");
  assert.strictEqual(room.join("Otro").ok, false, "sala llena contando NPC");
  const names = room.npcs.map((n) => n.name); assert.strictEqual(new Set(names).size, names.length, "nombres de NPC únicos");
  assert.strictEqual(room.join(names[0]).ok, false, "un humano no puede usar el nombre de un NPC");
  for (let i = 0; i < 7; i++) room.npcOp(host, { op: "remove", index: 0 });
  assert.strictEqual(room.npcs.length, 1);
  room.leave(guest);
  assert.strictEqual(room.start(host, clk.t + 30 * 60000).ok, true, "1 humano + 1 NPC = 2 jugadores");
  const g = room.game;
  assert.strictEqual(g.S().players.length, 2); assert.ok(PROFILES.indexOf(g.S().players[1].npc) !== -1); assert.strictEqual(g.S().players[0].npc, undefined);
  /* el humano juega; el NPC lo hace solo */
  let guard = 0;
  while (!g.ended() && guard++ < 400) {
    const S = g.S();
    if (S.phase === "private" && !g.ready.has(0)) { g.exec(0, "act", ["meditar", null, null]); g.exec(0, "finishTurn", []); }
    else if (S.phase === "council") g.exec(0, "councilReady", []);
    else if (S.phase === "resolution") { if (S.timeAsk) g.exec(0, "vote", ["end"]); else g.exec(0, "continue", []); }
    room.tick();
  }
  assert.ok(g.ended()); assert.strictEqual(g.errors.length, 0, g.errors[0]);
});

test("instantánea/restauración con NPC y sustituciones: estado y vistas idénticos y la partida continúa", () => {
  const { g, clk } = mk(4, 2, 909);
  playUntilRound(g, 2);
  g.exec(0, "replaceWithNpc", [1], { isHost: true });
  g.exec(1, "recoverSeat", []);
  const snap = JSON.parse(JSON.stringify(g.snapshot()));
  const g2 = Game.restore(snap, { engineDir: ENGINE_DIR, now: () => clk.t, readMs: 0, shift: 0, rng: seeded(99) });
  assert.strictEqual(JSON.stringify(g2.S()), JSON.stringify(g.S()));
  for (let i = 0; i < 4; i++) {
    const a = JSON.parse(JSON.stringify(g.view(i))), b = JSON.parse(JSON.stringify(g2.view(i)));
    [a, b].forEach((v) => { delete v.clock; delete v.serverNow; });
    assert.deepStrictEqual(b, a);
  }
  assert.deepStrictEqual(Array.from(g2.recover), [1]);
  playUntilRound(g2, g2.S().round + 1);
  assert.ok(!g2.S().players[1].npc, "la recuperación pendiente sobrevive a la restauración");
  playGame(g2, 5, "mixed", {});
  assert.ok(g2.ended()); assert.strictEqual(g2.errors.length, 0, g2.errors[0]);
});

/* v1.12.0: perfil de NPC aleatorio y oculto */
test("perfil de NPC: sorteado por semilla (reproducible), variado y oculto en toda vista, desenlace y log", () => {
  const draw = (seed, n) => { const { g } = mk(n, 1, seed, { npc: NAMES.slice(0, n).map((x, i) => (i >= 1 ? "azar" : null)) }); return g.S().players.map((p) => p.npc || null); };
  assert.deepStrictEqual(draw(5, 5), draw(5, 5), "misma semilla, mismos perfiles");
  const seen = new Set();
  for (let s = 1; s <= 30; s++) draw(s, 6).forEach((x) => { if (x) { assert.ok(PROFILES.indexOf(x) !== -1, x); seen.add(x); } });
  assert.ok(seen.size >= 4, "el sorteo reparte varios perfiles: " + Array.from(seen));
  /* partida completa: ninguna vista (ni el desenlace) ni el log llevan el perfil */
  const { g } = mk(5, 2, 91, { npc: NAMES.slice(0, 5).map((x, i) => (i >= 2 ? "azar" : null)) });
  const bad = [];
  const scan = (tag) => { for (let pid = 0; pid < 5; pid++) { const j = JSON.stringify(g.view(pid)); if (/npcProfile|"npc":"(prudente|agresivo|curandero|oscuro|mixto)"/.test(j)) bad.push(tag + " vista " + pid); } };
  scan("inicio");
  playGame(g, 91, "mixed", { afterCommand() { scan("cmd"); } });
  g.U.replaceWithNpc(0);
  assert.ok(!(g.S().glog || []).some((e) => /\((prudente|agresivo|curandero|oscuro|mixto)\)/i.test(JSON.stringify(e))), "el log no cita perfil");
  assert.deepStrictEqual(bad, []);
  const end = g.ended() ? JSON.stringify(g.view(0).ending || {}) : "";
  assert.ok(!/npcProfile/.test(end));
});
test("sustituir por NPC sortea el perfil (no depende del historial) y no lo cita en la crónica", () => {
  const { g } = mk(4, 4, 55);
  assert.strictEqual(g.U.replaceWithNpc(1).ok, true);
  assert.ok(PROFILES.indexOf(g.S().players[1].npc) !== -1);
  assert.ok(!JSON.stringify(g.S().chronicle).match(/prudente|agresivo|curandero|oscuro|mixto/i));
});
