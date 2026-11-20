"use strict";
/* v1.8.0: daño con riesgo (veneno retardado, trampa, sabotaje) y firmas internas (state.harm). Motor puro en un vm, azar fijo. */
const test = require("node:test");
const assert = require("node:assert");
const { loadEngine } = require("../server/engine_vm");
const { ENGINE_DIR } = require("./helpers/bot");

/* Math.random constante: 0.99 -> d6 = 6 (acierto automático) y pick() = último elemento. */
function mk(rv) {
  const R = { v: rv === undefined ? 0.99 : rv };
  const { U, D } = loadEngine({ dir: ENGINE_DIR, rng: () => R.v, now: () => 1.8e12 });
  U.createGame(["Ana", "Luis", "Marta"], { minutes: 30 });
  const S = U.getState();
  S.players.forEach((p) => { p.items = []; p.corr = 0; p.offer = null; });
  return { U, D, S, R };
}
/* Juega una ronda privada + consejo vacío hasta la resolución. acts: {pid: [accion, objetivo]}; el resto medita. */
function playRound(U, acts) {
  const S = U.getState(); let guard = 0;
  while (S.phase === "private" && guard++ < 60) {
    if (S.handoff) { U.nextTurn(); continue; }
    const p = S.players[S.turn];
    if (!p.acted && !p.dead) { const a = (acts || {})[p.id] || ["meditar", null]; const r = U.act(p.id, a[0], a[1]); assert.ok(r.ok, "act " + a[0] + ": " + (r && r.msg)); }
    U.finishTurn();
  }
  assert.strictEqual(S.phase, "council");
  U.resolveCouncil(); U.endCouncil();
}
const next = (U) => { U.nextRound(); };

test("veneno retardado: sin síntomas la ronda siguiente, 2 de daño por ronda después, firma 'sintomas' y curable", () => {
  const { U, S } = mk();
  S.players[0].items = [{ id: "frasco" }];
  const hp0 = S.players[1].hp;
  playRound(U, { 0: ["envenenar", 1] });
  assert.strictEqual(S.players[0].items.length, 0, "el frasco se gasta");
  assert.strictEqual(S.harm.poisons.length, 1);
  next(U); /* ronda 2: latencia */
  assert.strictEqual(S.round, 2);
  assert.strictEqual(S.players[1].hp, hp0, "sin daño en la ronda de latencia");
  assert.ok(!S.players[1].status.some((s) => s.id === "veneno"), "sin estado visible aún");
  assert.ok(!S.players[1].notes.some((n) => /envenen|amargo/.test(n)), "sin aviso aún");
  playRound(U, {}); next(U); /* ronda 3: síntomas */
  assert.strictEqual(S.round, 3);
  assert.strictEqual(S.players[1].hp, hp0 - 2);
  assert.ok(S.players[1].notes.some((n) => /envenenado/.test(n)));
  assert.ok(S.harm.sigs.some((g) => g.sig === "sintomas" && g.victim === 1 && g.author === 0));
  playRound(U, {}); next(U); /* ronda 4: segunda dosis y fin */
  assert.strictEqual(S.players[1].hp, hp0 - 4);
  playRound(U, {}); next(U);
  assert.ok(S.players[1].hp <= hp0 - 4 + 1 && S.players[1].hp >= hp0 - 4, "ya no hay más daño");
});

test("veneno: descansar tras los síntomas lo corta; la ceniza lo anula", () => {
  const a = mk(); a.S.players[0].items = [{ id: "frasco" }]; a.S.players[1].wasHurt = true; a.S.players[1].did = { descansar: 0 };
  playRound(a.U, { 0: ["envenenar", 1] }); next(a.U); playRound(a.U, {}); next(a.U);
  assert.ok(a.S.players[1].status.some((s) => s.id === "veneno"));
  const hpS = a.S.players[1].hp;
  const r = a.U.useItem; /* curar con hierbas */
  a.S.players[1].items = [{ id: "hierbas" }]; a.S.turn = 1; a.S.players[1].acted = false; a.S.players[1].usedItem = false;
  assert.ok(r(1, 0, null).ok);
  assert.ok(!a.S.players[1].status.some((s) => s.id === "veneno"), "hierbas quitan el veneno");
  assert.ok(a.S.players[1].hp >= hpS);
  const b = mk(); b.S.players[0].items = [{ id: "frasco" }]; b.S.players[1].ward = true;
  playRound(b.U, { 0: ["envenenar", 1] }); next(b.U); playRound(b.U, {}); next(b.U);
  assert.strictEqual(b.S.harm.poisons.length, 0); assert.ok(!b.S.players[1].status.some((s) => s.id === "veneno"));
});

test("trampa: salta la ronda siguiente sobre quien se mueve; firma 'mecanismo'; el dueño puede caer; caduca", () => {
  const { U, S } = mk();
  S.players[0].did = { explorar: 2 };
  playRound(U, { 0: ["trampa", 1] });
  assert.strictEqual(S.harm.traps.length, 1);
  const hp1 = S.players[1].hp;
  next(U);
  playRound(U, { 1: ["explorar", null] });
  assert.ok(S.players[1].hp < hp1, "la víctima esperada cae");
  assert.ok(S.players[1].zones.piernas > 0);
  assert.ok(S.harm.sigs.some((g) => g.sig === "mecanismo" && g.victim === 1 && g.author === 0));
  assert.strictEqual(S.harm.traps.length, 0);
  assert.ok(S.players[1].notes.some((n) => /trampa oculta/.test(n)) && !S.players[1].notes.some((n) => /Ana/.test(n.replace(/Ronda \d+:/, "")) && /trampa/.test(n)), "la víctima no sabe quién");
  assert.ok(S.players[0].notes.some((n) => /tu trampa saltó/.test(n)));
});

test("trampa: puede herir a un inocente o a su dueño; sin movimiento caduca; el fuego la evita; una a la vez", () => {
  /* dueño se mueve y los demás se quedan quietos: cae él mismo */
  let m = mk(); m.S.players[0].did = { explorar: 2 };
  playRound(m.U, { 0: ["trampa", 1] }); next(m.U);
  const hp0 = m.S.players[0].hp;
  playRound(m.U, { 0: ["explorar", null] });
  assert.ok(m.S.players[0].hp < hp0, "cae en su propia trampa");
  assert.ok(m.S.players[0].notes.some((n) => /tu propia trampa/.test(n)));
  /* un inocente (no el objetivo) */
  m = mk(0.01); m.S.players[0].did = { explorar: 2 };
  playRound(m.U, { 0: ["trampa", 1] }); next(m.U);
  /* con rng bajo el primer candidato es quien cae: Marta (2) se mueve, Luis medita */
  const h2 = m.S.players[2].hp;
  playRound(m.U, { 2: ["explorar", null] });
  assert.ok(m.S.players[2].hp < h2, "un inocente puede caer");
  /* nadie se mueve: caduca */
  m = mk(); m.S.players[0].did = { explorar: 2 };
  playRound(m.U, { 0: ["trampa", 1] }); next(m.U);
  playRound(m.U, {});
  assert.strictEqual(m.S.harm.traps.length, 0);
  assert.ok(m.S.players[0].notes.some((n) => /no atrapó a nadie/.test(n)));
  /* quien lleva fuego la evita */
  m = mk(); m.S.players[0].did = { explorar: 2 }; m.S.players[1].items = [{ id: "linterna" }];
  playRound(m.U, { 0: ["trampa", 1] }); next(m.U);
  const h1 = m.S.players[1].hp; playRound(m.U, { 1: ["explorar", null] });
  assert.strictEqual(m.S.players[1].hp, h1, "la linterna la evita");
  /* una trampa a la vez */
  m = mk(); m.S.players[0].did = { explorar: 2 };
  playRound(m.U, { 0: ["trampa", 1] }); next(m.U);
  m.S.turn = 0; m.S.players[0].acted = false;
  assert.strictEqual(m.U.act(0, "trampa", 2).ok, false);
});

test("sabotear: el objeto falla y puede volverse contra su dueño; también el frasco; sin objetos pierdes la noche", () => {
  const { U, S } = mk();
  S.players[0].items = [{ id: "ganzua" }]; S.players[1].items = [{ id: "vendas" }]; S.players[1].hp -= 3;
  playRound(U, { 0: ["sabotear", 1] });
  assert.strictEqual(S.harm.sabs.length, 1);
  assert.ok(S.harm.sigs.some((g) => g.sig === "objeto" && g.author === 0 && g.victim === 1));
  assert.ok(!S.players[1].notes.some((n) => /manipul|estrop/.test(n)), "no se avisa antes de usarlo");
  next(U);
  const hp = S.players[1].hp; S.turn = 1; S.players[1].acted = false;
  const r = U.useItem(1, 0, null);
  assert.ok(r.ok && /manipulado/.test(r.msg), r.msg);
  assert.strictEqual(S.players[1].items.length, 0);
  assert.strictEqual(S.players[1].hp, hp, "rng alto: solo falla");
  assert.strictEqual(S.harm.sabs.length, 0);
  /* backfire (rng bajo) */
  const b = mk(); b.S.players[0].items = [{ id: "ganzua" }]; b.S.players[1].items = [{ id: "vendas" }]; b.S.players[1].hp -= 3;
  playRound(b.U, { 0: ["sabotear", 1] }); next(b.U);
  b.R.v = 0.01; const hb = b.S.players[1].hp; b.S.turn = 1; b.S.players[1].acted = false;
  assert.ok(b.U.useItem(1, 0, null).ok); assert.ok(b.S.players[1].hp < hb, "se vuelve contra él");
  /* frasco estropeado */
  const f = mk(); f.S.players[0].items = [{ id: "ganzua" }]; f.S.players[1].items = [{ id: "frasco" }];
  playRound(f.U, { 0: ["sabotear", 1] }); next(f.U);
  playRound(f.U, { 1: ["envenenar", 2] });
  assert.strictEqual(f.S.harm.poisons.length, 0, "el veneno estropeado no llega");
  assert.ok(f.S.players[1].notes.some((n) => /manipulado/.test(n)));
  /* sin nada que estropear */
  const e = mk(); e.S.players[0].items = [{ id: "ganzua" }]; e.S.players[1].items = [{ id: "daga" }, { id: "manto" }];
  playRound(e.U, { 0: ["sabotear", 1] });
  assert.strictEqual(e.S.harm.sabs.length, 0);
});

test("desbloqueo por acciones: trampa (2 explorar o cuerda) y sabotear (ganzúa o 2 explorar + 1 robar)", () => {
  const { U, D, S } = mk(); const p = S.players[0]; const A = (id) => D.ACTIONS.find((a) => a.id === id);
  assert.ok(!U.isUnlocked(p, A("trampa")) && !U.isUnlocked(p, A("sabotear")));
  p.items = [{ id: "cuerda" }]; assert.ok(U.isUnlocked(p, A("trampa")));
  p.items = [{ id: "ganzua" }]; assert.ok(U.isUnlocked(p, A("sabotear")));
  p.items = []; p.did = { explorar: 2 }; assert.ok(U.isUnlocked(p, A("trampa")) && !U.isUnlocked(p, A("sabotear")));
  p.did = { explorar: 2, robar: 1 }; assert.ok(U.isUnlocked(p, A("sabotear")));
});
