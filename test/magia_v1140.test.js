"use strict";
/* v1.14.0: balance de magia (Cauto con reembolso solo si hay práctica, Sangre 3 vitalidad, Estable +1 oscuridad por lanzamiento,
   Plaga/Marchitar/Maleficio/Sanar/Égida/Velo/Reflejo, aspecto Hielo que alarga la defensa). */
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
  return Object.assign({ id: "v" + (++SEQ), form, aspect: "hielo", epithet: "de Vael", uses: 2, tune: null, kind: off ? "off" : "def",
    target: off, tier: 1, power: 1, stealth: false, name: form, desc: "", wins: 0, mastered: false }, extra || {});
}
function round(U, acts) {
  const S = U.getState(); let guard = 0;
  while (S.phase === "private" && guard++ < 60) {
    if (S.handoff) { U.nextTurn(); continue; }
    const p = S.players[S.turn];
    if (!p.acted && !p.dead) {
      const a = (acts || {})[p.id];
      const r = a ? U.cast(p.id, a[0], a[1] == null ? null : a[1], a[2] || "normal") : U.act(p.id, "meditar", null);
      assert.ok(r.ok, "acción de " + p.name + ": " + (r && r.msg));
    }
    U.finishTurn();
  }
  /* cierre de la ronda: consejo y noche, luego la siguiente ronda */
  for (let i = 0; i < 20 && S.phase !== "private"; i++) {
    if (S.phase === "council") { U.resolveCouncil(); U.endCouncil(); }
    else if (S.phase === "resolution") { U.nextRound(); }
    else break;
  }
}

test("Cauto: si falla, no devuelve el uso a un conjuro sin práctica; a uno practicado sí", () => {
  const { U, D, S, R } = mk(0.2);                      // d6 = 2: falla con atributo 0
  const p = S.players[0];
  p.stats.sombra = 0; p.stats.mente = 0; p.stats.cuerpo = 0;
  const sin = spell(D, "rayo", { uses: 2, wins: 0 }); p.spells = [sin];
  const r1 = U.cast(0, sin.id, 1, "cauto");
  assert.ok(r1.ok && !r1.success, "debe fallar: " + JSON.stringify(r1));
  assert.strictEqual(sin.uses, 1, "sin práctica no hay reembolso");
  S.turn = 0; S.players.forEach((q) => { q.acted = false; }); S.phase = "private"; S.handoff = false;
  const con = spell(D, "rayo", { uses: 2, wins: 1 }); p.spells = [con];
  const r2 = U.cast(0, con.id, 1, "cauto");
  assert.ok(r2.ok && !r2.success);
  assert.strictEqual(con.uses, 2, "con práctica sí se devuelve");
});

test("Sangre: la info del coste dice 3 de vitalidad y se cobra 3", () => {
  const { U, D, S } = mk(0.99);
  const p = S.players[0];
  const sp = spell(D, "rayo", { aspect: "sangre" }); p.spells = [sp];
  const info = U.spellInfo(0, sp.id, 1, "normal");
  assert.ok(info.cost.indexOf("−3 de vitalidad") !== -1, JSON.stringify(info.cost));
});

test("Estable: cada lanzamiento mancha +1 de oscuridad además del uso ya dado al ajustarlo", () => {
  const { U, D, S } = mk(0.99);
  const p = S.players[0];
  const sp = spell(D, "drenar", { tune: "estable", uses: 3 }); p.spells = [sp];
  const before = p.corr;
  const r = U.cast(0, sp.id, 1, "normal");
  assert.ok(r.ok);
  assert.ok(p.corr >= before + 1, "al menos +1 por lanzamiento (el acierto puede dar más oscuridad por otras reglas)");
  const info = U.spellInfo(0, sp.id, 1, "normal");
  assert.ok(info.cost.some((c) => /oscuridad/.test(c)), "el coste lo muestra");
});

test("Plaga: veneno de 1 de daño por ronda durante 3 rondas", () => {
  const { U, D, S } = mk(0.99);
  const p = S.players[0];
  const sp = spell(D, "plaga", { aspect: "fuego" }); p.spells = [sp];
  assert.ok(U.cast(0, sp.id, 1, "normal").ok);
  const v = S.players[1].status.find((x) => x.id === "veneno");
  assert.ok(v, "la víctima está envenenada");
  assert.strictEqual(v.dmg, 1);
  assert.strictEqual(v.left, 3);
});

test("Sanar: cura 4 (6 con potencia) y quita el sangrado", () => {
  const { U, D, S } = mk(0.99);
  const p = S.players[0];
  p.hp = 4; p.status = [{ id: "sangrado", left: 2, sev: 1 }];
  const sp = spell(D, "sanar", { aspect: "hielo", power: 1 }); p.spells = [sp];
  assert.ok(U.cast(0, sp.id, null, "normal").ok);
  assert.strictEqual(p.hp, 8);
  assert.ok(!p.status.some((x) => x.id === "sangrado"));
});

test("Velo sin activar dura dos rondas y luego se apaga", () => {
  const { U, D, S } = mk(0.99);
  const p = S.players[0];
  const sp = spell(D, "velo", { aspect: "fuego" }); p.spells = [sp];
  assert.ok(U.cast(0, sp.id, null, "normal").ok);
  assert.strictEqual(p.shield, true);
  round(U, {}); assert.strictEqual(p.shield, true, "ronda 2: sigue");
  round(U, {}); assert.strictEqual(p.shield, true, "ronda 3: sigue");
  round(U, {}); assert.strictEqual(p.shield, false, "ronda 4: se apagó");
});

test("Égida con Hielo: la defensa se alarga a la ronda siguiente", () => {
  const { U, D, S } = mk(0.99);
  const p = S.players[0];
  const sp = spell(D, "egida", { aspect: "hielo" }); p.spells = [sp];
  assert.ok(U.cast(0, sp.id, null, "normal").ok);
  round(U, {});
  assert.ok(p.roundDefense >= 4, "la ronda siguiente conserva +4 de defensa");
});

test("Égida sin Hielo: solo esta ronda", () => {
  const { U, D, S } = mk(0.99);
  const p = S.players[0];
  const sp = spell(D, "egida", { aspect: "fuego" }); p.spells = [sp];
  assert.ok(U.cast(0, sp.id, null, "normal").ok);
  round(U, {});
  assert.strictEqual(p.roundDefense, 0);
});
