"use strict";
/* F5: ausencia (2 rondas), gracia de reconexión, reemplazo de conexión, traspaso del anfitrión, todos ausentes, sin fugas.
   Salas reales (Rooms) con reloj inyectado y respuestas SSE simuladas. */
const test = require("node:test");
const assert = require("node:assert");
const { Rooms } = require("../server/room");
const { seeded } = require("../server/engine_vm");
const { ENGINE_DIR } = require("./helpers/bot");
const L = require("./helpers/leakcheck");

function fakeRes() {
  const r = { writes: [], closed: false, h: {}, writeHead() {}, write(m) { if (r.closed) throw new Error("cerrada"); r.writes.push(String(m)); return true; },
    on(ev, fn) { (r.h[ev] = r.h[ev] || []).push(fn); },
    end() { if (!r.closed) { r.closed = true; (r.h.close || []).forEach((f) => f()); } },
    drop() { r.end(); }, replaced() { return r.writes.some((w) => /event: replaced/.test(w)); } };
  return r;
}
function setup(n, opts) {
  opts = opts || {};
  const clk = { t: 1.8e12 };
  const rooms = new Rooms({ engineDir: ENGINE_DIR, now: () => clk.t, readMs: 0, timeScale: opts.timeScale });
  const first = rooms.create("P0"); const room = rooms.get(first.room);
  const pl = [room.players[0]];
  for (let i = 1; i < n; i++) { room.join("P" + i); pl.push(room.players[i]); }
  const res = pl.map(() => null);
  const conn = (i) => { const r = fakeRes(); res[i] = r; room.connect(pl[i], r); return r; };
  for (let i = 0; i < n; i++) conn(i);
  return { clk, rooms, room, pl, res, conn, start: (mins) => { const r = room.start(pl[0], clk.t + (mins || 90) * 60000); assert.ok(r.ok, JSON.stringify(r)); room.game.U.createGame; return r; } };
}
const live = (e, i) => e.pl[i].conns.size > 0;
/* un paso de ronda: los conectados hacen su turno/Consejo/continuar; los desconectados pasan por la aceleración (+11 s y tick) */
function playRound(e) {
  const g = e.room.game, S = g.S(), r0 = S.round;
  const each = (cmds) => e.pl.forEach((p, i) => { if (live(e, i) && !S.players[i].dead) cmds.forEach((c) => g.exec(i, c[0], c[1])); });
  const step = (ph) => { if (S.phase !== ph) return; e.clk.t += 11000; e.room.tick(); };
  if (S.phase === "private") { each([["act", ["meditar", null, null]], ["finishTurn", []]]); step("private"); }
  if (S.phase === "council") { each([["councilReady", []]]); step("council"); }
  if (S.phase === "resolution") { each([["continue", []]]); step("resolution"); }
  e.room.tick();
  return S.round !== r0 || S.phase === "ending";
}
const audit = (e, tag) => { const g = e.room.game, pre = L.prepare(g), pr = []; for (let i = 0; i < g.playerCount(); i++) L.checkView(g, i, g.view(i), pre).forEach((p) => pr.push("[" + tag + "] " + p)); assert.deepStrictEqual(pr, []); };
const untilRound = (e, n) => { for (let k = 0; k < 40 && e.room.game.S().round < n && !e.room.game.ended(); k++) playRound(e); };

test("ausente tras 2 rondas completas desconectado: medita sin esperar, no bloquea, vuelve en la ronda siguiente", () => {
  const e = setup(4); e.start(90); const g = e.room.game, S = g.S();
  e.clk.t += 1000;
  e.res[3].drop();                                   /* cae durante la ronda 1 */
  assert.strictEqual(g.presence.online[3], false);
  untilRound(e, 2); assert.strictEqual(g.isAbsent(3), false, "la ronda 1 fue incompleta");
  untilRound(e, 3); assert.strictEqual(g.isAbsent(3), false, "una ronda completa sola no basta");
  audit(e, "r3");
  untilRound(e, 4);
  assert.strictEqual(g.isAbsent(3), true, "2 rondas completas -> ausente");
  assert.strictEqual(g.errors.length, 0, g.errors.join("|"));
  /* ya en la ronda 4 el ausente está listo desde el principio: nadie espera ni hace falta aceleración */
  assert.strictEqual(S.phase, "private");
  assert.ok(g.ready.has(3) && S.players[3].acted && S.players[3].npc, "un NPC toma su lugar y juega su turno");
  assert.ok(g.npcAuto.has(3));
  const t0 = e.clk.t;
  [0, 1, 2].forEach((i) => { g.exec(i, "act", ["meditar", null, null]); g.exec(i, "finishTurn", []); });
  assert.strictEqual(S.phase, "council", "no espera al ausente (sin avanzar el reloj)");
  [0, 1, 2].forEach((i) => g.exec(i, "councilReady", []));
  assert.strictEqual(S.phase, "resolution");
  [0, 1, 2].forEach((i) => g.exec(i, "continue", []));
  assert.strictEqual(S.round, 5); assert.strictEqual(e.clk.t, t0);
  /* vista pública mínima */
  const v = g.view(0); assert.strictEqual(v.players[3].absent, true); assert.strictEqual(v.players[3].online, false); assert.strictEqual(v.players[0].absent, false);
  assert.strictEqual(v.waitN, 3, "el ausente no cuenta como pendiente"); assert.deepStrictEqual(v.wait, [], "fase privada: no se nombra a nadie");
  audit(e, "absent");
  /* vuelve: sigue ausente lo que queda de la ronda, recupera su vista completa y deja de estarlo en la siguiente */
  const r = e.conn(3);
  assert.ok(/"me"/.test(r.writes.join("")), "vista completa al reconectar");
  assert.strictEqual(g.isAbsent(3), true);
  assert.strictEqual(g.view(3).me.id, 3);
  [0, 1, 2, 3].forEach((i) => { g.exec(i, "act", ["meditar", null, null]); g.exec(i, "finishTurn", []); });
  [0, 1, 2, 3].forEach((i) => g.exec(i, "councilReady", []));
  [0, 1, 2, 3].forEach((i) => g.exec(i, "continue", []));
  assert.strictEqual(S.round, 6);
  assert.strictEqual(g.isAbsent(3), false, "ya no está ausente");
  assert.strictEqual(S.phase, "private"); assert.ok(!g.ready.has(3), "vuelve a decidir por sí mismo");
  assert.strictEqual(g.view(0).players[3].absent, false);
  audit(e, "back");
});

test("gracia de reconexión: una caída corta no cuenta (ni acelera ni suma ronda) y la racha se reinicia al volver", () => {
  const e = setup(4); e.start(90); const g = e.room.game, S = g.S();
  e.clk.t += 1000; e.res[2].drop(); e.clk.t += 4000; e.conn(2);
  assert.strictEqual(g.offlineSince[2], undefined);
  /* con el servidor ocupado en la fase, 4 s offline no aceleran: pending = [2] y fast = false */
  [0, 1, 3].forEach((i) => { g.exec(i, "act", ["meditar", null, null]); g.exec(i, "finishTurn", []); });
  e.clk.t += 4000; e.room.tick(); assert.strictEqual(S.phase, "private");
  /* caída larga de 2 en una ronda sola y vuelta: la racha vuelve a 0 */
  g.exec(2, "act", ["meditar", null, null]); g.exec(2, "finishTurn", []);
  untilRound(e, 2);
  e.res[2].drop(); untilRound(e, 3); e.conn(2); untilRound(e, 4); e.res[2].drop(); untilRound(e, 5);
  assert.strictEqual(g.isAbsent(2), false);
  assert.ok((g.offRounds[2] || 0) <= 1);
});

test("el reemplazo de conexión no duplica: la nueva sustituye a la anterior, que recibe «replaced»", () => {
  const e = setup(3); e.start(90); const g = e.room.game;
  const old = e.res[1]; const nw = e.conn(1);
  assert.strictEqual(e.pl[1].conns.size, 1); assert.ok(old.closed && old.replaced());
  assert.ok(!nw.replaced());
  const nOld = old.writes.length;
  e.room.broadcast();
  assert.strictEqual(old.writes.length, nOld, "la anterior ya no recibe vistas");
  assert.strictEqual(g.presence.online[1], true, "sigue conectado tras cerrarse la vieja");
  assert.strictEqual(g.offlineSince[1], undefined);
  audit(e, "replace");
});

test("anfitrión: pasa al siguiente conectado a los 30 s; no lo recupera al volver; decide el tiempo el nuevo", () => {
  const e = setup(4); e.start(90); const g = e.room.game;
  assert.strictEqual(e.pl[0].host, true);
  e.res[0].drop(); e.room.tick();
  e.clk.t += 29000; e.room.tick(); assert.strictEqual(e.pl[0].host, true, "aún dentro de los 30 s");
  e.clk.t += 2000; e.room.tick();
  assert.strictEqual(e.pl[0].host, false); assert.strictEqual(e.pl[1].host, true);
  assert.deepStrictEqual(g.view(2).hostNote && g.view(2).hostNote.name, "P1");
  assert.strictEqual(g.view(2).players[1].host, true);
  assert.strictEqual(g.decider(), 1);
  const seq = g.view(2).hostNote.seq;
  e.conn(0); e.room.tick();
  assert.strictEqual(e.pl[0].host, false, "no recupera el papel"); assert.strictEqual(g.view(2).hostNote.seq, seq);
  assert.strictEqual(g.exec(0, "addTime", [], {}).ok, false);
  assert.strictEqual(g.exec(1, "addTime", [], {}).ok, true);
  /* si el nuevo anfitrión cae también, pasa al siguiente (P2) */
  e.res[1].drop(); e.clk.t += 31000; e.room.tick(); e.room.tick();
  assert.strictEqual(e.pl.filter((p) => p.host).length, 1); assert.ok(e.pl[2].host || e.pl[0].host);
  audit(e, "host");
});

test("anfitrión que vuelve antes de 30 s lo conserva; también en el lobby; sin nadie conectado no pasa nada", () => {
  const e = setup(3);
  e.res[0].drop(); e.clk.t += 20000; e.room.tick(); e.conn(0); e.clk.t += 20000; e.room.tick();
  assert.strictEqual(e.pl[0].host, true);
  e.res[0].drop(); e.clk.t += 31000; e.room.tick(); e.room.tick();
  assert.strictEqual(e.pl[1].host, true, "traspaso en el lobby");
  const lv = e.room.lobbyView(e.pl[2]); assert.strictEqual(lv.hostNote.name, "P1");
  assert.strictEqual(e.room.start(e.pl[0], e.clk.t + 600000).ok, false, "el antiguo ya no puede empezar");
  assert.ok(e.room.start(e.pl[1], e.clk.t + 600000).ok);
  [1, 2].forEach((i) => e.res[i].drop());
  e.clk.t += 120000; e.room.tick(); assert.strictEqual(e.room.status, "playing"); assert.ok(e.rooms.get(e.room.code), "la sala se conserva");
});

test("todos ausentes: la partida avanza sola hasta el desenlace (no queda colgada) y sin errores", () => {
  const e = setup(3); e.start(30); const g = e.room.game;
  e.clk.t += 1000; e.res.forEach((r) => r.drop());
  for (let k = 0; k < 200 && e.room.status === "playing"; k++) { e.clk.t += 40000; e.room.tick(); }
  assert.strictEqual(e.room.status, "ended", "terminó");
  assert.strictEqual(g.errors.length, 0, g.errors.join("|"));
  assert.ok(g.U.getEnding && g.S().phase === "ending");
  const r = e.conn(0); assert.ok(/"ending"/.test(r.writes.join("")));
});

test("la pregunta de tiempo no se cuelga con ausentes: su voto es abstención; si todos son ausentes se termina", () => {
  const e = setup(4); e.start(90); const g = e.room.game, S = g.S();
  g.absent.add(3); g.votes = { 3: 2 };
  assert.strictEqual(g.voteWinner(), 1, "sin votos válidos: empate = +1 ronda");
  g.votes = { 3: 2, 1: "end", 2: "end" }; assert.strictEqual(g.voteWinner(), "end");
  S.players.forEach((p) => g.absent.add(p.id)); assert.strictEqual(g.voteWinner(), "end");
});
