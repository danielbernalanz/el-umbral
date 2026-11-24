"use strict";
/* v1.9.1: magia de Tier 2 (6 conjuros por escuela), desbloqueo solo por estudio con maestría, tope por peso, afinidad,
   resolución por capas (determinista, independiente del orden de llegada) y no-fuga. */
const test = require("node:test");
const assert = require("node:assert");
const { loadEngine, seeded } = require("../server/engine_vm");
const { Game } = require("../server/game");
const { playGame, ENGINE_DIR } = require("./helpers/bot");
const L = require("./helpers/leakcheck");

function mk(rv) {
  const R = { v: rv === undefined ? 0.99 : rv, fn: null };
  const { U, D } = loadEngine({ dir: ENGINE_DIR, rng: () => (R.fn ? R.fn() : R.v), now: () => 1.8e12 });
  U.createGame(["Ana", "Luis", "Marta"], { minutes: 30 });
  const S = U.getState();
  S.players.forEach((p) => { p.items = []; p.corr = 0; p.offer = null; p.spells = []; });
  return { U, D, S, R };
}
let SEQ = 0;
/* Conjuro hecho a mano con los mismos campos que finalizeSpell */
function spell(U, D, form, extra) {
  const t2 = !!D.SPELL_SCHOOLS.tier[form], off = ["rayo", "plaga", "marchitar", "grillete", "maleficio", "drenar", "pesadilla", "zarza", "mordedura"].indexOf(form) !== -1;
  return Object.assign({ id: "t" + (++SEQ), form, aspect: "hielo", epithet: "de Vael", uses: 2, tune: null, kind: off ? "off" : "def", target: !["egida", "sanar", "velo", "purga", "reflejo"].includes(form), tier: t2 ? 2 : 1, power: 1, stealth: false, name: form + " test", desc: "" }, extra || {});
}
/* ronda privada: acts {pid: [spellId, target]}; el resto medita */
function round(U, acts, order) {
  const S = U.getState(); let guard = 0;
  if (order) { S.order = order.slice(); S.turn = order[0]; }
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
}
const hasSt = (p, id) => (p.status || []).some((s) => s.id === id);

test("datos: T2 en las 5 escuelas existentes, metadatos coherentes con el motor", () => {
  const { D } = mk();
  const S = D.SPELL_SCHOOLS;
  Object.keys(S.tier).forEach((f) => { assert.ok(S.of[f], f + " sin escuela"); assert.ok(S.icon[f], f + " sin icono"); });
  assert.deepStrictEqual(new Set(Object.keys(S.tier).map((f) => S.of[f])), new Set(["luz", "naturaleza", "umbral", "mente", "sombra"]));
  assert.strictEqual(S.cap, 5); assert.strictEqual(S.weight[2], 2);
});

test("balance: defensa de sangre protege sin cobrar vitalidad y las formas débiles ganan utilidad", () => {
  const { U, D, S } = mk();
  const caster = S.players[0];
  S.turn = 0; S.handoff = false;
  const egida = spell(U, D, "egida", { aspect: "sangre", power: 2 });
  caster.spells = [egida];
  const hp = caster.hp;
  const info = U.spellInfo(0, egida.id, null, "normal");
  assert.ok(!info.cost.some((x) => /vitalidad/.test(x)), "una defensa de sangre no debe herirte");
  const r = U.cast(0, egida.id, null, "normal");
  assert.ok(r.ok && r.success, JSON.stringify(r));
  assert.strictEqual(caster.hp, hp, "la barrera sangrienta no paga vitalidad");
  assert.ok(caster.roundDefense >= 7, "la Égida (+4, +3 con potencia) conserva una defensa útil");

  const sanar = spell(U, D, "sanar", { aspect: "hielo", power: 2 });
  caster.hp = Math.max(1, caster.hp - 5); caster.spells = [sanar];
  caster.acted = false;
  const before = caster.hp;
  const heal = U.cast(0, sanar.id, null, "normal");
  assert.ok(heal.ok);
  assert.ok(caster.hp >= before);
  assert.match(heal.outcome, /\+\d+ de vitalidad/, "Sanar aumenta su curación");

  const pesadilla = spell(U, D, "pesadilla", { power: 1 });
  S.players[0].spells = [pesadilla];
  S.players[0].acted = false;
  S.players[1].status = [];
  S.turn = 0; S.handoff = false;
  const corr = S.players[1].corr;
  const nightmare = U.cast(0, pesadilla.id, 1, "normal");
  assert.ok(nightmare.ok);
  assert.ok(S.players[1].corr >= corr);
  assert.ok(hasSt(S.players[1], "maldito"), "Pesadilla añade una maldición breve");
});

test("desbloqueo: sin ser Practicante nunca asoma un T2; con Practicante, siempre 3 opciones y la 3.ª es T2 de su escuela", () => {
  const { U, D, S, R } = mk(); R.fn = seeded(7);
  const p = S.players[0], schoolOf = (f) => D.SPELL_SCHOOLS.of[f];
  const base = spell(U, D, "rayo", { wins: 0 });          /* Aprendiz */
  p.spells = [base]; p.items = [{ id: "grimorio" }];
  S.turn = 0; S.handoff = false;
  for (let i = 0; i < 80; i++) { p.study = null; const so = U.studyOptions(0, 0); assert.ok(so.ok); assert.strictEqual(so.options.length, 3); assert.ok(so.options.every((o) => (o.tier || 1) === 1), "T2 sin maestría"); }
  base.wins = 1;                                           /* Practicante en Sombra */
  const seen = new Set();
  for (let i = 0; i < 80; i++) { p.study = null; const so = U.studyOptions(0, 0); assert.strictEqual(so.options.length, 3); const o = so.options[2]; assert.strictEqual(o.tier, 2); assert.strictEqual(schoolOf(o.form), "sombra"); seen.add(o.form); assert.ok(so.options.slice(0, 2).every((x) => (x.tier || 1) === 1)); }
  assert.deepStrictEqual(Array.from(seen), ["mordedura"]);
  /* si ya la conoce, no se vuelve a ofrecer */
  p.spells.push(spell(U, D, "mordedura")); p.study = null;
  assert.ok(U.studyOptions(0, 0).options.every((o) => o.tier === 1));
});

test("afinidad: la primera escuela donde eres Practicante da −1 dificultad en tus T2 de esa escuela (no en otras)", () => {
  const { U, D, S } = mk();
  const p = S.players[0]; S.order = [0, 1, 2]; S.turn = 0; S.handoff = false;
  const t1 = spell(U, D, "rayo", { wins: 0 }); p.spells = [t1];
  /* éxito de práctica: el motor asigna afinidad al subir a Practicante */
  S.players[1].hp = 30; const r = U.cast(0, t1.id, 1, "normal"); assert.ok(r.ok);
  assert.strictEqual(p.arcAff, "sombra");
  assert.match(r.outcome, /afinidad/i);
  const z = spell(U, D, "zarza"), m = spell(U, D, "mordedura"), a = spell(U, D, "aurora");
  p.spells = [z, m, a];
  const inf = (sp) => U.spellInfo(0, sp.id, 1, "normal");
  assert.ok(inf(m).mods.some((x) => /afinidad/.test(x)), "mordedura (Sombra) con afinidad");
  assert.ok(!inf(z).mods.some((x) => /afinidad/.test(x)), "zarza (Naturaleza) sin afinidad");
  assert.ok(!inf(a).mods.some((x) => /afinidad/.test(x)));
  assert.strictEqual(inf(m).tier, 2); assert.strictEqual(inf(m).delayed, true);
  assert.ok(inf(m).cost.some((x) => /\+3 oscuridad/.test(x)), "el coste de la mordedura es visible antes de lanzar");
});

test("tope por peso: nunca más de 4 conjuros ni 5 de peso (T2 pesa 2)", () => {
  const { U, D, S, R } = mk(); R.fn = seeded(21);
  const p = S.players[0]; S.turn = 0; S.handoff = false;
  p.spells = [spell(U, D, "rayo", { wins: 1 }), spell(U, D, "egida", { wins: 1 })];
  for (let k = 0; k < 40; k++) {
    p.items = [{ id: "grimorio" }]; p.study = null; p.usedItem = false; p.acted = false;
    const so = U.studyOptions(0, 0); assert.ok(so.ok);
    const ix = Math.floor(R.fn() * 3);
    const lr = U.learnSpell(0, ix, "estable"); assert.ok(lr.ok, lr.msg);
    const w = p.spells.reduce((n, x) => n + (x.tier === 2 ? 2 : 1), 0);
    assert.ok(p.spells.length <= 4 && w <= 5, "peso " + w + " n " + p.spells.length);
    p.spells.forEach((x) => { if (!x.wins) x.wins = 1; });   /* mantiene Practicante para seguir viendo T2 */
  }
});

test("capas: el efecto del T2 NO ocurre al lanzar, sino al abrir el Consejo; state.arcane se vacía", () => {
  const { U, D, S } = mk();
  const z = spell(U, D, "zarza"); S.players[0].spells = [z];
  S.order = [0, 1, 2]; S.turn = 0; S.handoff = false;
  let seenMid = false;
  /* ronda manual para inspeccionar a mitad */
  const r = U.cast(0, z.id, 2, "normal"); assert.ok(r.ok && r.success, "lanzamiento");
  assert.match(r.outcome, /al caer la noche/);
  assert.ok(!hasSt(S.players[2], "sangrado"), "aún sin efecto");
  assert.strictEqual(S.arcane.length, 1);
  U.finishTurn();
  while (S.phase === "private") { if (S.handoff) { U.nextTurn(); continue; } const p = S.players[S.turn]; if (!p.acted) U.act(p.id, "meditar", null); if (S.arcane.length) seenMid = true; U.finishTurn(); }
  assert.ok(seenMid);
  assert.strictEqual(S.phase, "council");
  assert.ok(hasSt(S.players[2], "sangrado") && hasSt(S.players[2], "maldito"), "efecto al abrir el Consejo");
  assert.strictEqual(S.arcane.length, 0);
  assert.ok(S.players[2].notes.some((n) => /raíces/.test(n)));
  assert.ok(S.harm.sigs.some((g) => g.method === "conjurar" && g.victim === 2 && g.author === 0 && g.sig === "marca"), "firma de marca");
});

test("Eco anula el T2 nombrado y el resultado NO depende del orden de turno", () => {
  const out = [];
  [[0, 1, 2], [1, 0, 2], [2, 1, 0], [2, 0, 1]].forEach((ord) => {
    const { U, D, S } = mk();
    const z = spell(U, D, "zarza"), e = spell(U, D, "eco");
    S.players[0].spells = [z]; S.players[1].spells = [e];
    round(U, { 0: [z.id, 2], 1: [e.id, 0] }, ord);
    out.push(JSON.stringify({ sang: hasSt(S.players[2], "sangrado"), n0: S.players[0].notes.filter((n) => /deshizo/.test(n)).length, n1: S.players[1].notes.filter((n) => /deshizo/.test(n)).length, corr1: S.players[1].corr }));
    assert.ok(!hasSt(S.players[2], "sangrado"), "la zarza fue anulada");
    assert.ok(S.players[1].notes.some((n) => /tu eco deshizo un conjuro de Ana/.test(n)));
    assert.ok(S.players[0].notes.some((n) => /«zarza test» se deshizo/.test(n)));
    assert.ok(!S.players[2].notes.some((n) => /raíces|deshizo/.test(n)), "la víctima no sabe nada");
  });
  assert.strictEqual(new Set(out).size, 1, out.join(" | "));
});

test("Eco al vacío no mancha y revela si lanzó algo esa noche; Eco no puede anular un T1 (inmediato)", () => {
  const { U, D, S } = mk();
  const e = spell(U, D, "eco"); S.players[1].spells = [e];
  round(U, { 1: [e.id, 0] });
  assert.strictEqual(S.players[1].corr, 0, "v1.14.0: el eco vacío ya no mancha");
  assert.ok(S.players[1].notes.some((n) => /no encontró ningún conjuro/.test(n) && /tampoco lanzó/.test(n)));
});

test("Custodia absorbe el primer T2 ofensivo; el aspecto del vacío la atraviesa; sin ataque, se avisa", () => {
  { const { U, D, S } = mk(); const c = spell(U, D, "custodia"), m = spell(U, D, "mordedura");
    S.players[0].spells = [c]; S.players[1].spells = [m]; const hp = S.players[2].hp;
    round(U, { 0: [c.id, 2], 1: [m.id, 2] });
    assert.strictEqual(S.players[2].hp, hp, "sin daño");
    assert.ok(S.players[2].notes.some((n) => /amparo desvió/.test(n)));
    assert.ok(S.players[0].notes.some((n) => /resistió un conjuro/.test(n)));
    assert.ok(S.players[1].notes.some((n) => /chocó contra un amparo/.test(n)));
    assert.ok(!S.players[2].notes.some((n) => /Ana|Luis/.test(n)), "la protegida no sabe quién"); }
  { const { U, D, S } = mk(); const c = spell(U, D, "custodia"), m = spell(U, D, "mordedura", { aspect: "vacio" });
    S.players[0].spells = [c]; S.players[1].spells = [m]; const hp = S.players[2].hp;
    round(U, { 0: [c.id, 2], 1: [m.id, 2] });
    assert.ok(S.players[2].hp < hp, "el vacío atraviesa el amparo"); }
  { const { U, D, S } = mk(); const c = spell(U, D, "custodia"); S.players[0].spells = [c];
    round(U, { 0: [c.id, 2] });
    assert.ok(S.players[0].notes.some((n) => /no llegó a ser puesta a prueba/.test(n))); }
});

test("Aurora cura y limpia estados; Olvido borra la pista más reciente del objetivo sobre ti; caster caído = magia apagada", () => {
  { const { U, D, S } = mk(); const a = spell(U, D, "aurora", { power: 2 }); S.players[0].spells = [a];
    const v = S.players[2]; v.hp = Math.max(3, v.hp - 5); const hp = v.hp; v.status.push({ id: "veneno", left: 3 }, { id: "sangrado", left: 2, sev: 1 });
    round(U, { 0: [a.id, 2] });
    assert.ok(v.hp > hp, "cura"); assert.ok(!hasSt(v, "veneno"), "limpia veneno"); assert.ok(!hasSt(v, "sangrado"), "limpia hasta dos estados"); }
  { const { U, D, S } = mk(); const o = spell(U, D, "olvido"); S.players[0].spells = [o];
    S.players[1].clues = [{ about: 0, text: "a" }, { about: 2, text: "b" }, { about: 0, text: "c" }];
    round(U, { 0: [o.id, 1] });
    assert.deepStrictEqual(S.players[1].clues.map((c) => c.text), ["a", "b"]); }
  { const { U, D, S } = mk(); const m = spell(U, D, "mordedura"); S.players[0].spells = [m]; const hp = S.players[1].hp;
    S.order = [0, 1, 2]; S.turn = 0; S.handoff = false; assert.ok(U.cast(0, m.id, 1, "normal").ok);
    S.players[0].dying = true; S.players[0].hp = 0;          /* cae antes del amanecer */
    U.finishTurn();
    while (S.phase === "private") { if (S.handoff) { U.nextTurn(); continue; } const p = S.players[S.turn]; if (!p.acted && !p.dying) U.act(p.id, "meditar", null); U.finishTurn(); }
    assert.strictEqual(S.players[1].hp, hp); assert.ok(S.players[0].notes.some((n) => /se apagó/.test(n))); }
});

test("crónica pública: el T2 ofensivo nunca nombra objetivo ni autor, salga bien o mal", () => {
  const { U, D, S } = mk();
  const m = spell(U, D, "mordedura"); S.players[0].spells = [m];
  round(U, { 0: [m.id, 1] });
  const txt = S.chronicle.map((c) => c.text).join("\n");
  assert.match(txt, /palabras antiguas entre las ruinas/);
  assert.ok(!/palabras antiguas cerca de/.test(txt));
});

test("estudiar con reto de pulso: página limpia −1, sin reto 0, pulso torpe +1 de oscuridad", () => {
  const cost = {};
  [[undefined, "base"], [15, "limpia"], [-6, "torpe"], [2, "medio"]].forEach(([sk, k]) => {
    const { U, D, S, R } = mk(); R.fn = seeded(3);
    const p = S.players[0]; S.turn = 0; S.handoff = false; p.items = [{ id: "grimorio" }];
    assert.ok(U.studyOptions(0, 0).ok);
    assert.ok(U.learnSpell(0, 0, "estable", sk).ok);
    cost[k] = p.corr;
  });
  assert.deepStrictEqual(cost, { base: 3, limpia: 2, torpe: 4, medio: 3 });
});

test("no-fuga online: con T2 en juego, ninguna vista ajena contiene state.arcane ni nombres en la crónica pública", () => {
  const NAMES = ["Ana", "Luis", "Marta", "Pablo", "Eva"];
  const problems = []; let casts = 0;
  for (let g = 0; g < 4; g++) {
    const seed = 4200 + g, n = 3 + (g % 2) + (g > 1 ? 1 : 0);
    const game = new Game(NAMES.slice(0, n), { readMs: 0, engineDir: ENGINE_DIR, endAt: Date.now() + 25 * 60000, rng: seeded(seed * 31) });
    const S = game.S();
    const forms = ["custodia", "aurora", "zarza", "eco", "olvido", "mordedura"];
    S.players.forEach((p, i) => { p.spells = [spell(game.U, game.D, forms[(i + g) % 6], { uses: 3, wins: 1 }), spell(game.U, game.D, forms[(i + g + 2) % 6], { uses: 3, wins: 1 })]; });
    const check = (tag) => {
      const pre = L.prepare(game);
      for (let pid = 0; pid < n; pid++) {
        const v = game.view(pid), raw = JSON.stringify(v);
        L.checkView(game, pid, v, pre).forEach((x) => problems.push("[g" + g + " " + tag + "] " + x));
        if (/"arcane"/.test(raw) || /arcaneSeq/.test(raw)) problems.push("[g" + g + "] la vista de " + pid + " contiene la cola arcana");
        (v.chronicle || []).forEach((c) => { if (/palabras antiguas/.test(c.text) && /cerca de/.test(c.text) === false && NAMES.some((nm) => c.text.indexOf(nm) !== -1)) problems.push("crónica nombra: " + c.text); });
      }
    };
    check("inicio");
    playGame(game, seed, "mixed", { afterCommand(pid, cmd, args, res) { if (cmd === "cast" && res.ok) casts++; check(cmd); } });
    assert.ok(game.ended());
    assert.strictEqual(game.errors.length, 0, "errores internos: " + game.errors[0]);
  }
  assert.ok(casts > 5, "los bots lanzaron conjuros T2 (" + casts + ")");
  assert.strictEqual(problems.length, 0, problems.slice(0, 10).join("\n"));
});
