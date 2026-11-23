"use strict";
/* v1.9.0: reto de pulso único. Módulo determinista, corrección de tirada (applySkill) y validación en servidor (anti-trampa). */
const test = require("node:test");
const assert = require("node:assert");
const SK = require("../public/challenge.js");
const { Game } = require("../server/game");
const { loadEngine, seeded } = require("../server/engine_vm");
const { ENGINE_DIR } = require("./helpers/bot");

/* Mejor traza posible: toca cuando la aguja pasa por el centro de la zona clara. */
function bestTaps(seed) {
  const pl = SK.plan(seed), out = []; let t0 = 150;
  for (let i = 0; i < SK.CFG.taps; i++) {
    let best = t0, bd = 9;
    for (let t = t0; t < SK.CFG.windowMs - 100; t += 5) { const d = Math.abs(SK.pos(pl, t) - pl.centers[i]); if (d < bd) { bd = d; best = t; } if (d < 0.004) break; }
    out.push(best); t0 = best + 200;
  }
  return out;
}

test("reto: determinista, bonus -6..+15, trazas inválidas -> null", () => {
  assert.deepStrictEqual(SK.plan(1234), SK.plan(1234));
  const t = bestTaps(77), s = SK.score(77, t);
  assert.ok(s > 0.95, "traza perfecta: " + s);
  assert.strictEqual(SK.delta(1), 15); assert.strictEqual(SK.delta(0), -6); assert.strictEqual(SK.delta(null), 0); assert.strictEqual(SK.delta(NaN), 0);
  assert.strictEqual(SK.score(77, [100]), null, "faltan toques");
  assert.strictEqual(SK.score(77, [500, 520]), null, "intervalo inhumano (<120 ms)");
  assert.strictEqual(SK.score(77, [50, 600]), null, "primer toque demasiado pronto");
  assert.strictEqual(SK.score(77, [500, 9000]), null, "fuera de ventana");
  assert.strictEqual(SK.score(77, [500, "x"]), null);
  /* tocar al azar da una media cercana a 0 de bonus (no regala puntos por no saber) */
  const r = seeded(5); let sum = 0, n = 2000;
  for (let i = 0; i < n; i++) { const sd = 1 + Math.floor(r() * 1e6), a = 150 + r() * 3000, b = a + 200 + r() * 3000; sum += SK.delta(SK.score(sd, [Math.round(a), Math.round(b)])); }
  assert.ok(Math.abs(sum / n) < 3.5, "bonus medio al azar " + sum / n);
});

test("applySkill: desplaza la probabilidad ~delta puntos; crítico y pifia no se tocan; delta 0 idéntico", () => {
  const { U, ctx } = loadEngine({ dir: ENGINE_DIR, rng: seeded(99), now: () => 1.8e12 });
  U.createGame(["Ana", "Luis", "Marta"], { minutes: 30 });
  const p = U.getState().players[0]; p.focus = 0;
  const N = 30000, rate = (d, diff) => { let ok = 0; for (let i = 0; i < N; i++) { const r = U._skill.rollCheck(p, "mente", diff, d); if (r.success) ok++; if (r.crit && !r.success) throw new Error("crítico fallado"); if (r.fumble && r.success) throw new Error("pifia acertada"); } return ok / N * 100; };
  p.stats.mente = 2; const diff = 6; /* acierta con 4,5(?),6: zona media */
  const b = rate(0, diff), hi = rate(15, diff), lo = rate(-6, diff);
  assert.ok(Math.abs(hi - b - 15) < 2.2, "bonus +15: " + (hi - b));
  assert.ok(Math.abs(b - lo - 6) < 2.2, "bonus -6: " + (b - lo));
  /* delta 0 o ausente = misma secuencia de azar que antes */
  const g1 = seeded(5), g2 = seeded(5);
  const A = loadEngine({ dir: ENGINE_DIR, rng: g1, now: () => 1.8e12 }), B = loadEngine({ dir: ENGINE_DIR, rng: g2, now: () => 1.8e12 });
  A.U.createGame(["a", "b", "c"], { minutes: 30 }); B.U.createGame(["a", "b", "c"], { minutes: 30 });
  const pa = A.U.getState().players[0], pb = B.U.getState().players[0];
  for (let i = 0; i < 50; i++) assert.strictEqual(JSON.stringify(A.U._skill.rollCheck(pa, "mente", 5)), JSON.stringify(B.U._skill.rollCheck(pb, "mente", 5, 0)));
  /* fuera de rango se acota: nunca más de +15 */
  const huge = rate(1e6, diff);
  assert.ok(Math.abs(huge - hi) < 2.2, "el bonus se acota a +15: " + huge);
});

function mk(seed) {
  const clk = { t: 1.8e12 };
  const game = new Game(["Ana", "Luis", "Marta"], { readMs: 0, engineDir: ENGINE_DIR, endAt: clk.t + 30 * 60000, now: () => clk.t, rng: seeded(seed || 3) });
  return { game, clk };
}
/* Resultado de una tirada 'investigar' con rng aislado: comparamos el bonus aplicado reutilizando skillFor. */
test("servidor: el bonus lo calcula el servidor desde la traza; un reto vale una sola acción", () => {
  const { game, clk } = mk(); const pid = game.S().turn;
  assert.strictEqual(game.exec(pid, "challenge", [], {}).ok, true);
  const seed = game.chal[pid].seed, taps = bestTaps(seed);
  clk.t += 6000;
  const sk = game.skillFor(pid, taps);
  assert.ok(sk.delta >= 13, "bonus de una traza perfecta: " + sk.delta);
  const r = game.exec(pid, "act", ["meditar", null, null, taps], {});
  assert.strictEqual(r.ok, true);
  assert.strictEqual(game.chal && game.chal[pid], undefined, "el reto se consume al actuar");
  assert.strictEqual(game.skillFor(pid, taps).delta, 0, "sin reto vigente -> base");
});

test("servidor anti-trampa: trazas ajenas, tardías, adelantadas o con forma inválida dan base (0) o se rechazan", () => {
  const { game, clk } = mk(4); const pid = game.S().turn;
  game.exec(pid, "challenge", [], {});
  const seed = game.chal[pid].seed, good = bestTaps(seed);
  /* traza buena para OTRA semilla: puntuación baja (no 0 forzado, pero muy lejos del máximo) */
  clk.t += 7000;
  assert.ok(game.skillFor(pid, bestTaps(seed + 1)).delta < 12, "traza de otra semilla no da el máximo");
  /* terminar «antes de lo que dura la traza» (reloj servidor < último toque) */
  game.exec(pid, "challenge", [], {}); const s2 = game.chal[pid].seed, t2 = bestTaps(s2);
  clk.t += 100;
  if (t2[1] > 400) assert.strictEqual(game.skillFor(pid, t2).delta, 0, "no se puede enviar el resultado antes de jugarlo");
  /* tardío: pasada la ventana + gracia */
  clk.t += 12000; assert.strictEqual(game.skillFor(pid, t2).delta, 0, "caducado");
  /* forma inválida: rechazada por el comando */
  const bad = game.exec(pid, "act", ["meditar", null, null, [1, 2, 3]], {});
  assert.strictEqual(bad.ok, false);
  assert.strictEqual(game.exec(pid, "act", ["meditar", null, null, { delta: 15 }], {}).ok, false, "el cliente no puede mandar un bonus");
  /* traza fuera de ventana: la acción se ejecuta pero con bonus base (nunca penaliza ni falla la orden) */
  assert.strictEqual(game.exec(pid, "act", ["meditar", null, null, [100, 5e9]], {}).ok, true);
});

test("no-fuga: la semilla del reto no aparece en ninguna vista", () => {
  const { game } = mk(6); const pid = game.S().turn;
  const r = game.exec(pid, "challenge", [], {});
  for (let i = 0; i < 3; i++) assert.ok(!JSON.stringify(game.view(i)).includes('"seed"'), "vista " + i + " sin semilla");
  assert.ok(r.seed > 0);
});

test("pulso tematico: cada sello arcano tiene un ritmo distinto y conserva sus limites", () => {
  const pruebas = [
    ["El grimorio de Vael", 29],
    ["Aurora sobre las ruinas", 97],
    ["Eco entre los muertos", 144],
    ["Zarza bajo la luna", 311],
    ["Olvido del Umbral", 512],
    ["Mordedura de sombra", 777]
  ];

  const planes = new Set();
  pruebas.forEach(([nombre, seed]) => {
    const plan = SK.plan(seed);
    planes.add(JSON.stringify(plan));
    assert.ok(plan.period >= 1300 && plan.period < 1800, nombre + ": periodo fuera de alcance");
    assert.ok(plan.phase >= 0 && plan.phase < 1, nombre + ": fase fuera de alcance");
    assert.strictEqual(plan.centers.length, SK.CFG.taps);
    plan.centers.forEach((center) => assert.ok(center >= 0.2 && center <= 0.8, nombre + ": zona fuera del umbral"));

    const perfect = bestTaps(seed);
    assert.ok(SK.delta(SK.score(seed, perfect)) >= 13, nombre + ": pulso firme sin recompensa");
  });
  assert.strictEqual(planes.size, pruebas.length, "los sellos tematicos deben producir ritmos variados");
});

test("pulso tematico: estudio, curacion y conjuro reciben solo el efecto permitido por la calidad", () => {
  const casos = [
    ["Estudiar el grimorio", 15, 15],
    ["Sellar una herida", 2, 2],
    ["Invocar la Aurora", 0, 0],
    ["Desatar la Mordedura", -6, -6]
  ];
  casos.forEach(([nombre, delta, esperado]) => {
    assert.strictEqual(SK.clampDelta(delta), esperado, nombre);
  });

  const clock = { t: 1.8e12 };
  const seeds = [29, 97, 144, 311, 512, 777];
  seeds.forEach((seed) => {
    const game = new Game(["Ana", "Luis", "Marta"], {
      readMs: 0,
      engineDir: ENGINE_DIR,
      endAt: clock.t + 30 * 60000,
      now: () => clock.t,
      rng: seeded(seed)
    });
    const pid = game.S().turn;
    assert.strictEqual(game.exec(pid, "challenge", [], {}).ok, true);
    const trace = bestTaps(game.chal[pid].seed);
    clock.t += 6000;
    const result = game.skillFor(pid, trace);
    assert.ok(result.delta >= 13, "sello " + seed + ": el pulso tematico no debio quedar sin recompensa");
  });
});
