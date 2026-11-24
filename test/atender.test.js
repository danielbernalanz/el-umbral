"use strict";
/* v1.14.0: Atender como curación (descanso de cuidados +3, veneno, virtud del atendedor con límite por paciente). */
const test = require("node:test");
const assert = require("node:assert");
const { loadEngine } = require("../server/engine_vm");
const { ENGINE_DIR } = require("./helpers/bot");

function mk() {
  const { U, D } = loadEngine({ dir: ENGINE_DIR, rng: () => 0.5, now: () => 1.8e12 });
  U.createGame(["Ana", "Luis", "Marta"], { minutes: 30 });
  const S = U.getState();
  S.players.forEach((p) => { p.items = []; p.corr = 0; p.offer = null; p.virtue = 50; });
  S.turn = 0; S.phase = "private"; S.handoff = false; S.round = 1;
  return { U, D, S, H: U._health };
}
const item = (D, id) => ({ id, uses: D.ITEMS[id].uses });
const nextTurn = (S, turn) => { S.players.forEach((q) => { q.acted = false; }); S.turn = turn; S.phase = "private"; S.handoff = false; };
const st = (p, id, extra) => { p.status = (p.status || []).concat([Object.assign({ id, left: 2 }, extra || {})]); };
const has = (p, id) => (p.status || []).some((s) => s.id === id);

test("paciente sano: no hay curación ni nota, y no suma virtud", () => {
  const { U, S } = mk(); const v = S.players[1]; v.hp = v.maxHp || v.hp;
  const before = S.players[0].virtue;
  assert.ok(U.act(0, "atender", 1, "presionar").ok);
  assert.strictEqual(S.players[0].virtue, before, "cuidar a quien no lo necesita no da virtud");
  assert.ok(!v.notes.some((n) => /te atendió/.test(n)));
});

test("sangrado fuerte: presionar lo baja a goteo y cura 3", () => {
  const { U, S } = mk(); const v = S.players[1]; st(v, "sangrado", { sev: 2 }); v.hp = 4;
  assert.ok(U.act(0, "atender", 1, "presionar").ok);
  const s = v.status.find((x) => x.id === "sangrado");
  assert.ok(s && s.sev === 1);
  assert.strictEqual(v.hp, 7);
  assert.ok(v.notes.some((n) => /Recuperas 3/.test(n)));
});

test("infección: presionar la frena", () => {
  const { U, S } = mk(); const v = S.players[1]; st(v, "infeccion"); v.hp = 4;
  assert.ok(U.act(0, "atender", 1, "presionar").ok);
  assert.ok(!has(v, "infeccion"));
});

test("veneno: presionar lo quita", () => {
  const { U, S } = mk(); const v = S.players[1]; st(v, "veneno"); v.hp = 4;
  assert.ok(U.act(0, "atender", 1, "presionar").ok);
  assert.ok(!has(v, "veneno"));
  assert.ok(v.notes.some((n) => /quitó el veneno/.test(n)));
});

test("miembro grave: entablillar con vendas baja la lesión y gasta las vendas", () => {
  const { U, D, S, H } = mk(); const v = S.players[1];
  S.players[0].items = [item(D, "vendas")];
  H.damage(v, 5, { zone: "miembros", noBleed: true }); v.inj.miembros.part = "piernas";
  assert.strictEqual(H.legPen(v), 1);
  assert.ok(U.act(0, "atender", 1, "entablillar").ok);
  assert.strictEqual(S.players[0].items.length, 0);
  assert.strictEqual(H.legPen(v), 0);
});

test("vitalidad llena: no falla y no cura de más", () => {
  const { U, S } = mk(); const v = S.players[1]; const max = v.hp;
  st(v, "infeccion");
  assert.ok(U.act(0, "atender", 1, "presionar").ok);
  assert.strictEqual(v.hp, max);
});

test("virtud: el atendedor gana +4 una vez, no otra hasta dentro de dos rondas por el mismo paciente", () => {
  const { U, S } = mk(); const v = S.players[1]; st(v, "infeccion"); v.hp = 4;
  assert.ok(U.act(0, "atender", 1, "presionar").ok);
  assert.strictEqual(S.players[0].virtue, 54);
  st(v, "infeccion"); S.round = 2; nextTurn(S, 0);
  assert.ok(U.act(0, "atender", 1, "presionar").ok);
  assert.strictEqual(S.players[0].virtue, 54, "a la ronda siguiente no suma");
  st(v, "infeccion"); S.round = 3; nextTurn(S, 0);
  assert.ok(U.act(0, "atender", 1, "presionar").ok);
  assert.strictEqual(S.players[0].virtue, 58, "a las dos rondas sí");
});

test("dos atendedores: cada uno tiene su propio límite de dos rondas por paciente", () => {
  const { U, S } = mk(); const v = S.players[2];
  st(v, "infeccion"); v.hp = 4;
  assert.ok(U.act(0, "atender", 2, "presionar").ok);            // ronda 1, Ana
  assert.strictEqual(S.players[0].virtue, 54);
  nextTurn(S, 1); st(v, "infeccion"); v.hp = 4;
  assert.ok(U.act(1, "atender", 2, "presionar").ok);            // ronda 1, Luis (su propio contador)
  assert.strictEqual(S.players[1].virtue, 54);
  S.round = 2; nextTurn(S, 0); st(v, "infeccion"); v.hp = 4;
  assert.ok(U.act(0, "atender", 2, "presionar").ok);            // ronda 2, Ana: aún no
  assert.strictEqual(S.players[0].virtue, 54);
  S.round = 3; nextTurn(S, 1); st(v, "infeccion"); v.hp = 4;
  assert.ok(U.act(1, "atender", 2, "presionar").ok);            // ronda 3, Luis: sí
  assert.strictEqual(S.players[1].virtue, 58);
});

test("partidas guardadas sin careLog: no fallan al atender", () => {
  const { U, S } = mk(); const v = S.players[1]; st(v, "infeccion"); v.hp = 4;
  delete S.players[0].careLog;
  assert.ok(U.act(0, "atender", 1, "presionar").ok);
  assert.ok(S.players[0].careLog && S.players[0].careLog[v.id] === 1);
});
