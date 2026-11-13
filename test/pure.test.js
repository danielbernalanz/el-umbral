"use strict";
/* F1: auditoría de PUREZA de las consultas del motor que usa ui.js, y garantía de que buildView no muta el estado ni gasta azar. */
const test = require("node:test");
const assert = require("node:assert");
const { Game } = require("../server/game");
const { playGame, ENGINE_DIR } = require("./helpers/bot");
const { seeded } = require("../server/engine_vm");
const view = require("../server/view");

const NAMES = ["Ana", "Luis", "Marta", "Pablo", "Eva", "Iker"];
function counting(seed) { const r = seeded(seed), f = () => { f.calls++; return r(); }; f.calls = 0; return f; }

/* Consultas del motor (U.*) que ui.js llama, con constructor de argumentos. */
const QUERIES = {
  getOffer: (U, S, p) => [p.id], unlockNotices: (U, S, p) => [p], studyOptions: (U, S, p) => [p.id, Math.max(0, p.items.findIndex((i) => i.id === "grimorio"))],
  encounterStart: (U, S, p) => [p.id],
  getHandOffer: (U, S, p) => [p.id], getPactOffers: (U, S, p) => [p.id], declareOptions: (U, S, p) => [p.id], secretInfo: (U, S, p) => [p.id],
  umbralInfo: (U, S, p) => [p.id], healthInfo: (U, S, p) => [p], xpInfo: (U, S, p) => [p], domInfo: (U, S, p) => [p], activePacts: (U, S, p) => [p.id],
  actionOdds: (U, S, p) => [p.id, "investigar"], spellInfo: (U, S, p) => [p.id, (p.spells[0] || {}).id, null, "normal"],
  spellProgress: (U, S, p) => [p.spells[0] || { wins: 0 }], visibleActions: (U, S, p) => [p], isUnlocked: (U, S, p) => [p, { id: "robar" }],
  getSince: (U, S, p) => [p.id], councilPrompt: () => [], councilSeconds: () => [], turnSeconds: () => [], behindSchedule: () => [], timeWarn: () => [],
  timeLeftMs: () => [], extEnd: () => [1], visibleHealth: (U, S, p) => [p], maxRounds: () => [], pSuccess: () => [2, 4], exportLog: () => [], exportStory: () => [true],
  getEnding: () => [], elapsedMin: () => [], currentPlayer: () => [], getState: () => [], riseCount: (U, S, p) => [p], aggrSummary: (U, S, p) => [p], endAtTs: () => [], hhmm: () => [1e12],
  getSinceX: undefined
};
delete QUERIES.getSinceX;

function audit(game, rngc, impure) {
  const U = game.U, S = game.S();
  S.players.forEach((p) => {
    Object.keys(QUERIES).forEach((name) => {
      const args = QUERIES[name](U, S, p);
      const before = JSON.stringify(S), c0 = rngc.calls;
      try { U[name].apply(null, args); } catch (e) { /* algunas necesitan fase concreta */ }
      if (JSON.stringify(S) !== before || rngc.calls !== c0) impure[name] = (impure[name] || 0) + 1;
    });
  });
}

test("auditoría: solo las consultas perezosas conocidas mutan el estado", () => {
  const impure = {};
  for (let g = 0; g < 4; g++) {
    const rngc = counting(500 + g);
    const game = new Game(NAMES.slice(0, 3 + g), { engineDir: ENGINE_DIR, endAt: Date.now() + 30 * 60000, rng: rngc });
    let k = 0;
    playGame(game, 500 + g, "mixed", { afterCommand() { if (k++ % 6 === 0 && !game.ended()) { game.S().turn = 0; audit(game, rngc, impure); } } });
  }
  console.log("consultas IMPURAS detectadas (nº de veces):", JSON.stringify(impure));
  /* Resultado esperado de la auditoría (ver README): se materializan en Game.refresh. */
  const expected = ["getOffer", "unlockNotices", "studyOptions", "encounterStart"];
  Object.keys(impure).forEach((k) => assert.ok(expected.indexOf(k) !== -1, "consulta impura inesperada: " + k));
  ["unlockNotices", "studyOptions", "encounterStart"].forEach((k) => assert.ok(impure[k] > 0, "se esperaba que " + k + " fuese impura (cambió la auditoría)"));
});

test("getOffer es impura en un motor crudo (genera la oferta de forma perezosa); Game.refresh la materializa", () => {
  const { loadEngine } = require("../server/engine_vm");
  const { U } = loadEngine({ dir: ENGINE_DIR, rng: seeded(1) });
  U.createGame(["A", "B", "C"], { minutes: 20 });
  const before = JSON.stringify(U.getState());
  U.getOffer(0);
  assert.notStrictEqual(JSON.stringify(U.getState()), before, "getOffer debería mutar (p.offer null -> false/obj)");
  const again = JSON.stringify(U.getState()); U.getOffer(0);
  assert.strictEqual(JSON.stringify(U.getState()), again, "la 2ª llamada es idempotente");
});

test("buildView no muta el estado ni consume azar (tras materializar)", () => {
  for (let g = 0; g < 4; g++) {
    const rngc = counting(900 + g), n = 3 + g;
    const game = new Game(NAMES.slice(0, n), { engineDir: ENGINE_DIR, endAt: Date.now() + 30 * 60000, rng: rngc });
    let checks = 0;
    playGame(game, 900 + g, "mixed", {
      afterCommand() {
        const before = JSON.stringify(game.S()), c0 = rngc.calls;
        for (let rep = 0; rep < 2; rep++) for (let pid = 0; pid < n; pid++) game.view(pid);
        assert.strictEqual(JSON.stringify(game.S()), before, "buildView mutó el estado");
        assert.strictEqual(rngc.calls, c0, "buildView consumió azar");
        checks++;
      }
    });
    assert.ok(checks > 20);
  }
});

test("q.since equivale a U.getSince cuando no hay notas retenidas", () => {
  const game = new Game(NAMES.slice(0, 3), { engineDir: ENGINE_DIR, endAt: Date.now() + 30 * 60000, rng: seeded(3) });
  let compared = 0;
  playGame(game, 3, "mixed", {
    afterCommand() {
      if (game.ended()) return;
      game.S().players.forEach((p) => {
        if (game.held[p.id] && game.held[p.id].size) return;
        const a = JSON.stringify(game.U.getSince(p.id)), b = JSON.stringify(view.sinceFor(game, p));
        assert.strictEqual(b, a); compared++;
      });
    }
  });
  assert.ok(compared > 10);
});

test("q.targets coincide con canTarget del motor (misma lógica que el cliente local)", () => {
  const game = new Game(NAMES.slice(0, 5), { engineDir: ENGINE_DIR, endAt: Date.now() + 30 * 60000, rng: seeded(11) });
  let n = 0;
  playGame(game, 11, "dark", {
    afterCommand() {
      if (game.ended()) return;
      game.S().players.forEach((p) => {
        const T = view.targetsFor(game, p.id);
        Object.keys(T).forEach((aid) => {
          const a = game.D.ACTIONS.find((x) => x.id === aid);
          const exp = game.S().players.filter((x) => x.id !== p.id && (aid === "alzar" ? true : !x.dead) && (!a.canTarget || a.canTarget(x, p))).map((x) => x.id);
          assert.deepStrictEqual(T[aid], exp); n++;
        });
      });
    }
  });
  assert.ok(n > 20);
});
