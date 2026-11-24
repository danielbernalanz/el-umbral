"use strict";
/* v1.14.0: magia 3B (recarga lenta, cadenas de escuela, pifias, Maestro, aviso al olvidar, Magia sucia). */
const test = require("node:test");
const assert = require("node:assert");
const { loadEngine } = require("../server/engine_vm");
const { ENGINE_DIR } = require("./helpers/bot");

function mk(rv) {
  const R = { v: rv === undefined ? 0.99 : rv };
  const { U, D } = loadEngine({ dir: ENGINE_DIR, rng: () => R.v, now: () => 1.8e12 });
  U.createGame(["Ana", "Luis", "Marta"], { minutes: 30 });
  const S = U.getState();
  S.players.forEach((p) => { p.items = []; p.corr = 0; p.offer = null; p.spells = []; });
  S.order = [0, 1, 2]; S.turn = 0; S.phase = "private"; S.handoff = false;
  return { U, D, S, R };
}
let SEQ = 0;
function spell(D, form, extra) {
  const off = ["rayo", "plaga", "marchitar", "grillete", "maleficio", "drenar", "pesadilla"].indexOf(form) !== -1;
  return Object.assign({ id: "w" + (++SEQ), form, aspect: "fuego", epithet: "de Vael", uses: 2, tune: null, kind: off ? "off" : "def",
    target: off, tier: 1, power: 1, stealth: false, name: form, desc: "", wins: 0, mastered: false }, extra || {});
}
function round(U, acts) {
  const S = U.getState(); let guard = 0;
  while (S.phase === "private" && guard++ < 60) {
    if (S.handoff) { U.nextTurn(); continue; }
    const p = S.players[S.turn];
    if (!p.acted && !p.dead) {
      const a = (acts || {})[p.id];
      const r = typeof a === "string" ? U.act(p.id, a, null) : a ? U.cast(p.id, a[0], a[1] == null ? null : a[1], a[2] || "normal") : U.act(p.id, "meditar", null);
      assert.ok(r.ok, "acción de " + p.name + ": " + (r && r.msg));
    }
    U.finishTurn();
  }
  for (let i = 0; i < 20 && S.phase !== "private"; i++) {
    if (S.phase === "council") { U.resolveCouncil(); U.endCouncil(); }
    else if (S.phase === "resolution") { U.nextRound(); }
    else break;
  }
}

test("recarga lenta: cada 3 rondas un conjuro de menos de 3 usos recupera 1", () => {
  const { U, D, S } = mk();
  const p = S.players[0];
  const sp = spell(D, "sanar", { uses: 1 }); p.spells = [sp];
  round(U, { 0: "indagar" }); round(U, { 0: "indagar" });   // así Meditar no recarga por otra vía
  assert.strictEqual(S.round, 3);
  assert.strictEqual(sp.uses, 2, "al empezar la ronda 3 recupera un uso");
});

test("Meditar recarga cualquier conjuro de menos de 3 usos (no solo los de menos de 2)", () => {
  const { U, D, S } = mk();
  const p = S.players[0];
  const sp = spell(D, "sanar", { uses: 2 }); p.spells = [sp];
  assert.ok(U.act(0, "meditar", null).ok);
  assert.strictEqual(sp.uses, 3);
});

test("cadena de escuela: el segundo conjuro de la misma escuela tiene +1 de potencia", () => {
  const { U, D, S } = mk();
  const p = S.players[0];
  /* Rayo y Pesadilla son ambos de la escuela de la Sombra */
  const a = spell(D, "rayo", { uses: 3 }), b = spell(D, "pesadilla", { uses: 3 }); p.spells = [a, b];
  round(U, { 0: [a.id, 1] });
  const info = U.spellInfo(0, b.id, 1, "normal");
  assert.strictEqual(info.power, 2, "encadenado: potencia 2");
  const c = spell(D, "grillete", { uses: 2 }); p.spells = [c];
  assert.strictEqual(U.spellInfo(0, c.id, 1, "normal").power, 1, "otra escuela (umbral) no encadena");
});

test("cambio de escuela da +1 de foco", () => {
  const { U, D, S } = mk();
  const p = S.players[0];
  const a = spell(D, "rayo", { uses: 3 }), b = spell(D, "sanar", { uses: 2, kind: "def", target: false }); p.spells = [a];
  round(U, { 0: [a.id, 1] });
  assert.strictEqual(p.lastSchool != null, true);
  p.focus = 0; p.spells = [b];
  round(U, { 0: [b.id, null] });
  assert.ok(p.focus >= 1, "al cambiar de escuela gana foco");
});

test("Rayo de Maestro salta a un tercero", () => {
  const { U, D, S } = mk(0.99);
  const p = S.players[0];
  const sp = spell(D, "rayo", { wins: 4, uses: 2 }); p.spells = [sp];
  const hpThird = S.players[2].hp;
  assert.ok(U.cast(0, sp.id, 1, "normal").ok);
  assert.ok(S.players[2].hp < hpThird, "el tercero recibe el salto");
});

test("Plaga de Maestro se contagia a un tercero", () => {
  const { U, D, S } = mk(0.99);
  const p = S.players[0];
  const sp = spell(D, "plaga", { wins: 4, uses: 2 }); p.spells = [sp];
  assert.ok(U.cast(0, sp.id, 1, "normal").ok);
  assert.ok((S.players[2].status || []).some((x) => x.id === "veneno"), "el tercero se contagia");
});
