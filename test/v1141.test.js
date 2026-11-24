"use strict";
/* v1.14.1: formas exclusivas del Taumaturgo, Atadura, Maestría (Sanar/Marchitar), Vena arcana, elección de conjuro inicial,
   olvido elegido al tope, Sabotear por categoría y susurros de quien ha caído. */
const test = require("node:test");
const assert = require("node:assert");
const { loadEngine, seeded } = require("../server/engine_vm");
const { ENGINE_DIR } = require("./helpers/bot");

function mk(rv) {
  const R = { v: rv === undefined ? 0.99 : rv };
  const { U, D } = loadEngine({ dir: ENGINE_DIR, rng: () => R.v, now: () => 1.8e12 });
  U.createGame(["Ana", "Luis", "Marta"], { minutes: 30 });
  const S = U.getState();
  S.players.forEach((p) => { p.items = []; p.corr = 0; p.offer = null; p.spells = []; p.startOpts = null; });
  S.order = [0, 1, 2]; S.turn = 0; S.phase = "private"; S.handoff = false;
  return { U, D, S, R };
}
let SEQ = 0;
function spell(form, extra) {
  const off = ["rayo", "plaga", "marchitar", "atadura"].indexOf(form) !== -1;
  return Object.assign({ id: "x" + (++SEQ), form, aspect: "fuego", epithet: "de Vael", uses: 2, tune: null, kind: off ? "off" : "def",
    target: off || form === "mensaje" || form === "revelar", tier: 1, power: 1, stealth: false, name: form, desc: "", wins: 0, mastered: false }, extra || {});
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
const TAU = (p) => { p.role = { id: "taumaturgo", name: "Aprendiz", passive: { id: "spellDiscount", name: "Vena arcana" } }; };

test("formas exclusivas: Mensaje, Atadura y Revelar solo salen en las opciones del Taumaturgo", () => {
  const sd = seeded(7);
  const { U, S } = loadEngine({ dir: ENGINE_DIR, rng: sd, now: () => 1.8e12 }) && (() => { const L = loadEngine({ dir: ENGINE_DIR, rng: sd, now: () => 1.8e12 }); L.U.createGame(["Ana", "Luis", "Marta"], { minutes: 30 }); return { U: L.U, S: L.U.getState() }; })();
  const EXCL = ["Atadura", "Mensaje secreto", "Revelar"];
  const seen = (pl) => {
    const names = new Set();
    for (let k = 0; k < 120; k++) {
      pl.items = [{ id: "grimorio" }]; pl.study = null; pl.acted = false; S.turn = S.players.indexOf(pl); S.phase = "private";
      const so = U.studyOptions(S.players.indexOf(pl), 0);
      if (so && so.ok) so.options.forEach((o) => names.add(o.name));
    }
    return names;
  };
  TAU(S.players[0]);
  const t = seen(S.players[0]);
  const has = (set, name) => [...set].some((o) => o.indexOf(name) === 0);
  assert.ok(EXCL.some((n) => has(t, n)), "el Taumaturgo ve alguna forma exclusiva (" + t.size + " nombres)");
  S.players[1].role = { id: "x", name: "x", passive: null }; S.players[1].affinity = null; S.players[2].role = { id: "x", name: "x", passive: null }; S.players[2].affinity = null;
  const n = seen(S.players[1]);
  assert.ok(!EXCL.some((x) => has(n, x)), "el resto no las ve");
});

test("Revelar: el lanzador ve el nivel de oscuridad de la víctima (solo en su nota)", () => {
  const { U, D, S } = mk();
  const p = S.players[0], v = S.players[1];
  v.corr = 45;
  const sp = spell("revelar"); p.spells = [sp];
  const r = U.cast(0, sp.id, 1, "normal");
  assert.ok(r.ok, r.msg);
  assert.ok(/Ves en Luis: una sombra que manda\./.test(r.outcome), r.outcome);
});

test("Mensaje secreto: la víctima recibe una frase predefinida en sus notas; el lanzador no", () => {
  const { U, S } = mk();
  const p = S.players[0], v = S.players[1];
  const sp = spell("mensaje"); p.spells = [sp];
  assert.ok(U.cast(0, sp.id, 1, "normal").ok);
  assert.ok(v.notes.some((n) => /susurro sin dueño/.test(n)), "la víctima recibe el susurro");
  assert.ok(!p.notes.some((n) => /susurro sin dueño/.test(n)));
});

test("Atadura: la mitad del daño de la víctima le llega también al lanzador, dos rondas", () => {
  const { U, S, D } = mk();
  const p = S.players[0], v = S.players[1];
  const sp = spell("atadura"); p.spells = [sp];
  assert.ok(U.cast(0, sp.id, 1, "normal").ok);
  assert.ok(v.status.some((x) => x.id === "atado") && p.status.some((x) => x.id === "atado"));
  const hpP = p.hp, hpV = v.hp;
  U._health.damage(v, 4, { noZone: true, noBleed: true, src: "test" });
  assert.ok(v.hp < hpV, "la víctima recibe el daño");
  assert.ok(p.hp < hpP, "el lanzador recibe la mitad");
  assert.ok(hpP - p.hp <= 2 && hpP - p.hp >= 1, "mitad de 4 = 2");
});

test("Maestría: Sanar a Maestro cura a otro; Marchitar a Maestro abre sangrado en otro", () => {
  const { U, S } = mk(0.99);
  const p = S.players[0];
  const hpOther = S.players[2].hp; S.players[2].hp = 3;
  const sn = spell("sanar", { wins: 4, aspect: "fuego", kind: "def", target: false }); p.spells = [sn];
  assert.ok(U.cast(0, sn.id, null, "normal").ok);
  assert.ok(S.players[2].hp > 3, "otro jugador se cura");
  S.players[2].hp = hpOther;
  S.turn = 0; S.players.forEach((q) => { q.acted = false; }); S.phase = "private"; S.handoff = false;
  const mw = spell("marchitar", { wins: 4 }); p.spells = [mw];
  assert.ok(U.cast(0, mw.id, 1, "normal").ok);
  assert.ok(S.players[2].status && S.players[2].status.some((x) => x.id === "sangrado"), "el sangrado salta a otro");
});

test("Vena arcana: el Taumaturgo paga menos oscuridad al lanzar (spellInfo y tirada coinciden)", () => {
  const { U, S, D } = mk();
  const p = S.players[0];
  TAU(p);
  const sp = spell("rayo", { tune: "potente" }); p.spells = [sp];
  const info = U.spellInfo(0, sp.id, 1, "normal");
  const corr = info.cost.find((c) => /oscuridad/.test(c));
  const sp2 = spell("rayo", { tune: "potente" }); const q = S.players[1]; q.role = null; q.spells = [sp2];
  const info2 = U.spellInfo(1, sp2.id, 2, "normal");
  const corr2 = info2.cost.find((c) => /oscuridad/.test(c));
  assert.ok(corr && corr2, JSON.stringify([info.cost, info2.cost]));
  assert.ok(parseInt(corr.replace(/[^0-9-]/g, ""), 10) < parseInt(corr2.replace(/[^0-9-]/g, ""), 10), corr + " vs " + corr2);
});

test("Taumaturgo: elige un conjuro inicial entre tres; si no elige, se queda el primero en la ronda 2", () => {
  const { U, S } = mk();
  const p = S.players[0];
  p.startOpts = [spell("rayo"), spell("sanar", { kind: "def" }), spell("velo", { kind: "def" })];
  assert.ok(!U.pickStartSpell(0, 9).ok);
  assert.ok(U.pickStartSpell(0, 1).ok);
  assert.strictEqual(p.spells.length, 1);
  assert.strictEqual(p.startOpts, null);
  const q = S.players[1]; q.startOpts = [spell("rayo"), spell("velo", { kind: "def" }), spell("egida", { kind: "def" })];
  round(U, {});  // ronda 1 (los demás medita)
  q.acted = false;
  round(U, {});  // ronda 2: automático
  assert.ok(q.startOpts === null && q.spells.length >= 1);
});

test("tope: al aprender con el tope lleno, el motor pide qué olvidar y lo aplica", () => {
  const { U, S } = mk();
  const p = S.players[0];
  p.spells = [spell("rayo", { uses: 1 }), spell("sanar", { uses: 3, kind: "def" }), spell("velo", { uses: 3, kind: "def" }), spell("egida", { uses: 3, kind: "def" })];
  p.items = [{ id: "grimorio" }];
  const st = U.studyOptions(0, 0); assert.ok(st.ok);
  const r1 = U.learnSpell(0, 0, "estable");
  assert.ok(!r1.ok && r1.needForget && Array.isArray(r1.options) && r1.options.length === 4, JSON.stringify(r1).slice(0, 200));
  assert.strictEqual(p.spells.length, 4, "sin cambios hasta elegir");
  assert.ok(p.items.some((i) => i.id === "grimorio"), "el grimorio no se consume");
  const r2 = U.learnSpell(0, 0, "estable", null, 0);
  assert.ok(r2.ok, r2.msg);
  assert.ok(!p.spells.some((x) => x.form === "rayo"), "se olvidó la que eligió");
});

test("Sabotear por categoría: solo estropea objetos de la clase elegida, o pierde la noche", () => {
  const { U, D, S } = mk(0.99);
  const a = S.players[0], t = S.players[1];
  t.items = [{ id: "vendas", uses: 1 }];
  a.items = [{ id: "ganzua", uses: 1 }]; a.spells = [];
  const r = U.act(0, "sabotear", 1, "ataque");
  assert.ok(r.ok, r.msg);
  assert.ok(/no lleva nada de ese tipo/.test(r.outcome || r.msg || ""), JSON.stringify(r).slice(0, 200));
});

test("espectadores: quien ha caído susurra una pista a un vivo, una vez por ronda", () => {
  const { U, S } = mk();
  const d = S.players[2]; d.dead = true;
  S.turn = 0; S.players[0].acted = true;
  const v = S.players[0];
  const r1 = U.whisper(2, 0);
  assert.ok(r1.ok, r1.msg);
  assert.ok(v.clues.length >= 1 || v.notes.some((n) => /susurro/.test(n)));
  assert.ok(!U.whisper(2, 1).ok, "una vez por ronda");
  assert.ok(!U.whisper(0, 1).ok, "los vivos no susurran");
});

test("partidas guardadas sin los campos nuevos (startOpts, lastSchool, defKeep, shieldUntil, whisperRound) siguen funcionando", () => {
  const { U, S } = mk();
  S.players.forEach((p) => { delete p.startOpts; delete p.lastSchool; delete p.defKeep; delete p.shieldUntil; delete p.reflectUntil; delete p.whisperRound; delete p.trained; delete p.careLog; });
  const p = S.players[0];
  const sp = spell("rayo", { uses: 2 }); p.spells = [sp];
  round(U, { 0: [sp.id, 1] });
  assert.strictEqual(S.round, 2);
  p.shield = true;                       // velo de una partida antigua: sin plazo guardado
  round(U, {}); round(U, {});
  assert.strictEqual(p.shield, true, "sin plazo guardado no caduca (comportamiento anterior)");
});
