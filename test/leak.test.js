"use strict";
/* F1: tests de NO-FUGA. Partidas completas de bots que juegan solo con su vista; tras CADA comando se audita la vista de cada jugador. */
const test = require("node:test");
const assert = require("node:assert");
const { Game, GENERIC_BAD_TARGET } = require("../server/game");
const { playGame, ENGINE_DIR } = require("./helpers/bot");
const { seeded } = require("../server/engine_vm");
const L = require("./helpers/leakcheck");

const GAMES = Number(process.env.LEAK_GAMES || 12);
const SIZES = [3, 4, 5, 6, 8, 10];
const NAMES = ["Ana", "Luis", "Marta", "Pablo", "Eva", "Iker", "Noa", "Leo", "Mia", "Rut"];

function newGame(seed, n) {
  return new Game(NAMES.slice(0, n), { engineDir: ENGINE_DIR, endAt: Date.now() + (20 + (seed % 3) * 10) * 60000, rng: seeded(seed * 7919) });
}

test("no hay fugas en la vista de ningún jugador tras cada comando (partidas completas)", () => {
  const stats = { games: 0, commands: 0, viewChecks: 0, held: 0, endings: 0, withAssassin: 0 };
  const problems = [];
  for (let g = 0; g < GAMES; g++) {
    const seed = 1000 + g, n = SIZES[g % SIZES.length], mode = ["mixed", "dark", "good"][g % 3];
    const game = newGame(seed, n);
    let before = null;
    const check = (tag) => {
      const views = new Map(), pre = L.prepare(game);
      for (let pid = 0; pid < n; pid++) { const v = game.view(pid); views.set(pid, v); stats.viewChecks++; L.checkView(game, pid, v, pre).forEach((p) => problems.push("[g" + g + " " + tag + "] " + p)); }
      return views;
    };
    check("inicio");
    playGame(game, seed, mode, {
      beforeCommand() { before = new Map(); for (let pid = 0; pid < n; pid++) before.set(pid, JSON.parse(JSON.stringify(game.view(pid)))); },
      afterCommand(pid, cmd, args, res) {
        stats.commands++;
        L.checkResult(game, pid, res).forEach((p) => problems.push("[g" + g + " resultado " + cmd + "] " + p));
        const after = check(cmd + "@r" + game.S().round);
        L.checkRetention(NAMES[pid], pid, before, new Map(Array.from(after).map(([k, v]) => [k, JSON.parse(JSON.stringify(v))]))).forEach((p) => problems.push("[g" + g + " retención " + cmd + " de " + NAMES[pid] + "] " + p));
        Object.keys(game.held).forEach((k) => { stats.held += game.held[k].size; });
      }
    });
    assert.ok(game.ended(), "la partida " + g + " debe terminar");
    assert.strictEqual(game.errors.length, 0, "errores internos: " + game.errors[0]);
    stats.games++; stats.endings++;
    if (game.S().players.some((p) => p.alignment === "asesino")) stats.withAssassin++;
    /* en el desenlace sí se revela */
    const vend = game.view(0);
    assert.strictEqual(vend.phase, "ending");
    assert.ok(vend.reveal && vend.log && vend.story, "el desenlace debe incluir reveal/log/story");
  }
  console.log("leak:", JSON.stringify(stats));
  const uniq = Array.from(new Set(problems.map((p) => p.replace(/\[g\d+ /, "[g "))));
  assert.strictEqual(problems.length, 0, problems.length + " problemas; distintos:\n" + uniq.slice(0, 25).join("\n"));
});

test("objetivos inválidos: error genérico idéntico para cualquier objetivo (sin sondeo de canTarget)", () => {
  const game = newGame(77, 4);
  let probes = 0;
  for (let round = 0; round < 3 && !game.ended(); round++) {
    for (let pid = 0; pid < 4; pid++) {
      const v = game.view(pid);
      if (v.phase !== "private" || v.me.acted || v.me.dead) continue;
      game.D.ACTIONS.filter((a) => a.target).forEach((a) => {
        for (let t = 0; t < 4; t++) {
          if ((v.q.targets[a.id] || []).indexOf(t) !== -1) continue;
          const r = game.exec(pid, "act", [a.id, t, null], {});
          probes++;
          assert.strictEqual(r.ok, false);
          assert.strictEqual(r.msg, GENERIC_BAD_TARGET, "mensaje no genérico para " + a.id + " -> " + t + ": " + r.msg);
        }
      });
    }
    game.forceAdvance(); game.forceAdvance(); game.forceAdvance();
  }
  assert.ok(probes > 20, "sondas: " + probes);
});

test("la exportación (log/historia) solo existe en el desenlace", () => {
  const game = newGame(5, 3);
  for (let pid = 0; pid < 3; pid++) { const v = game.view(pid); assert.strictEqual(v.log, undefined); assert.strictEqual(v.story, undefined); }
  playGame(game, 5, "mixed");
  assert.ok(game.view(1).log.length > 100);
});

test("control negativo: el detector encuentra secretos, claves y notas ajenas inyectados", () => {
  const game = newGame(21, 4);
  /* avanzar algo para que existan notas */
  try { playGame(game, 21, "mixed", { afterCommand() { if (game.S().round >= 2) throw new Error("stop"); } }); } catch (e) { if (e.message !== "stop") throw e; }
  const S = game.S();
  const pre = L.prepare(game);
  const clean = game.view(0);
  assert.deepStrictEqual(L.checkView(game, 0, clean, pre), []);
  const mk = () => JSON.parse(JSON.stringify(game.view(0)));
  let v = mk(); v.q.leak = S.players[1].secret.text; assert.ok(L.checkView(game, 0, v, pre).length, "texto del secreto ajeno en q");
  v = mk(); v.players[1].role = "x"; assert.ok(L.checkView(game, 0, v, pre).length, "clave extra en jugador ajeno");
  v = mk(); v.assassinId = 2; assert.ok(L.checkView(game, 0, v, pre).length, "clave de nivel superior");
  v = mk(); v.me.risenBy = 1; assert.ok(L.checkView(game, 0, v, pre).length, "campo prohibido en me");
  v = mk(); v.chronicle.push({ round: 1, text: "El rol de " + S.players[1].role.name }); assert.ok(L.checkView(game, 0, v, pre).length, "nombre de rol ajeno (subcadena)");
  v = mk(); v.log = "x"; assert.ok(L.checkView(game, 0, v, pre).length, "log antes del desenlace");
  const r = { ok: true, text: "su afinidad es " + S.players[1].affinity.name };
  assert.ok(L.checkResult(game, 0, r).length, "resultado con núcleo ajeno");
});

test("control negativo: sin retención de notas el detector de retención salta", () => {
  const game = newGame(33, 4);
  /* desactivar la retención */
  const orig = game._runAs.bind(game);
  game._runAs = function (pid, fn) { const r = orig(pid, fn); this.held = {}; this.chronVisible = Infinity; return r; };
  let probs = 0, before = null;
  playGame(game, 33, "dark", {
    beforeCommand() { before = new Map(); for (let p = 0; p < 4; p++) before.set(p, JSON.parse(JSON.stringify(game.view(p)))); },
    afterCommand(pid) { const after = new Map(); for (let p = 0; p < 4; p++) after.set(p, JSON.parse(JSON.stringify(game.view(p)))); probs += L.checkRetention(NAMES[pid], pid, before, after).length; }
  });
  assert.ok(probs > 0, "sin retención debe haber problemas de retención detectados");
});
