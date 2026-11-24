"use strict";
/* v1.14.0: acciones flojas (Entrenar, Aturdir, Maldecir, Hechizar, Sombras hostigadoras, Indagar). */
const test = require("node:test");
const assert = require("node:assert");
const { loadEngine } = require("../server/engine_vm");
const { ENGINE_DIR } = require("./helpers/bot");

function mk(rngVal) {
  const { U, D } = loadEngine({ dir: ENGINE_DIR, rng: () => (rngVal === undefined ? 0.5 : rngVal), now: () => 1.8e12 });
  U.createGame(["Ana", "Luis", "Marta"], { minutes: 30 });
  const S = U.getState();
  S.players.forEach((p) => { p.items = []; p.corr = 0; p.offer = null; p.acted = false; p.focus = 0; p.did = {}; });
  S.turn = 0; S.phase = "private"; S.handoff = false; S.round = 1;
  return { U, D, S };
}
const nextRound = (S) => { S.round += 1; S.players.forEach((q) => { q.acted = false; }); S.turn = 0; S.phase = "private"; S.handoff = false; };
const left = (p, id) => ((p.status || []).find((s) => s.id === id) || {}).left;

test("data: Aturdir dificultad 5; Entrenar y Maldecir describen su duración nueva", () => {
  const { D } = mk();
  const ac = (id) => D.ACTIONS.find((a) => a.id === id);
  assert.strictEqual(ac("aturdir").diff, 5);
  assert.match(ac("entrenar").desc, /tres rondas/);
  assert.match(ac("maldecir").desc, /tres rondas/);
});

test("entrenar: fortalecido tres rondas y +1 de foco", () => {
  const { U, S } = mk();
  S.players[0].did = { explorar: 3 };                 // desbloquea Entrenar
  assert.ok(U.act(0, "entrenar").ok);
  assert.strictEqual(left(S.players[0], "fortalecido"), 3);
  assert.strictEqual(S.players[0].focus, 1);
});

test("entrenar: cada tercer entrenamiento sube el atributo más bajo +1", () => {
  const { U, S } = mk();
  const p = S.players[0]; p.did = { explorar: 3 };
  const before = Object.assign({}, p.stats);
  const lowest = ["cuerpo", "mente", "sombra"].sort((a, b) => before[a] - before[b])[0];
  for (let i = 0; i < 2; i++) { assert.ok(U.act(0, "entrenar").ok); nextRound(S); }
  assert.strictEqual(p.stats[lowest], before[lowest], "dos entrenamientos aún no suben nada");
  assert.ok(U.act(0, "entrenar").ok);
  assert.strictEqual(p.stats[lowest], before[lowest] + 1, "el tercero sube el más bajo");
  assert.strictEqual(p.trained, 3);
});

test("entrenar: partidas guardadas sin contador p.trained no fallan", () => {
  const { U, S } = mk();
  S.players[0].did = { explorar: 3 }; delete S.players[0].trained;
  assert.ok(U.act(0, "entrenar").ok);
  assert.strictEqual(S.players[0].trained, 1);
});

test("aturdir: acierto con víctima que aún no ha actuado le hace perder el turno (dificultad 5)", () => {
  const { U, D, S } = mk(0.99);                        // d6 alto: acierto seguro
  S.players[0].items = [{ id: "porra", uses: D.ITEMS.porra.uses }];
  const r = U.act(0, "aturdir", 1);
  assert.ok(r.ok, r.msg);
  assert.strictEqual(S.players[1].acted, true, "pierde su turno de esta ronda");
});

test("maldecir: acierto deja a la víctima maldita tres rondas", () => {
  const { U, D, S } = mk(0.99);
  S.players[0].items = [{ id: "pergamino", uses: D.ITEMS.pergamino.uses }];
  const r = U.act(0, "maldecir", 1);
  assert.ok(r.ok, r.msg);
  assert.strictEqual(left(S.players[1], "maldito"), 3);
});

test("indagar: +1 de virtud", () => {
  const { U, S } = mk();
  const before = S.players[0].virtue;
  assert.ok(U.act(0, "indagar").ok);
  assert.strictEqual(S.players[0].virtue, Math.min(100, before + 1));
});
