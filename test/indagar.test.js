"use strict";
/* v1.8.1: Indagar. Pistas veraces y parciales, sin autor, solo rondas anteriores, privadas (vista filtrada). */
const test = require("node:test");
const assert = require("node:assert");
const { loadEngine } = require("../server/engine_vm");
const { Game } = require("../server/game");
const view = require("../server/view");
const { ENGINE_DIR } = require("./helpers/bot");

function mk(n) {
  const { U, D } = loadEngine({ dir: ENGINE_DIR, rng: () => 0.99, now: () => 1.8e12 });
  U.createGame(["Ana", "Luis", "Marta", "Pablo", "Eva"].slice(0, n || 3), { minutes: 30 });
  const S = U.getState();
  S.players.forEach((p) => { p.items = []; p.corr = 0; p.offer = null; });
  return { U, D, S };
}
function playRound(U, acts) {
  const S = U.getState(); let guard = 0;
  while (S.phase === "private" && guard++ < 60) {
    if (S.handoff) { U.nextTurn(); continue; }
    const p = S.players[S.turn];
    if (!p.acted && !p.dead) { const a = (acts || {})[p.id] || ["meditar", null]; const r = U.act(p.id, a[0], a[1]); assert.ok(r.ok, "act " + a[0] + ": " + (r && r.msg)); }
    U.finishTurn();
  }
  U.resolveCouncil(); U.endCouncil();
}
/* Se coloca a mano en el turno de pid para llamar a act. */
function indagar(U, S, pid) { S.turn = pid; S.handoff = false; S.players[pid].acted = false; return U.act(pid, "indagar", null); }

test("indagar existe para todos, sin desbloqueo, y no avisa como acción nueva", () => {
  const { U, D, S } = mk(3);
  const a = D.ACTIONS.find((x) => x.id === "indagar");
  assert.ok(a && !a.target && !a.risk);
  S.players.forEach((p) => { assert.ok(U.isUnlocked(p, a)); assert.ok(U.visibleActions(p).main.some((x) => x.id === "indagar")); assert.ok(!U.unlockNotices(p).some((t) => /indag/i.test(t))); });
});

test("sin nada que investigar: 'no encuentras nada' y no se guarda pista", () => {
  const { U, S } = mk(3);
  assert.strictEqual(U.indagarInfo(0).avail, 0);
  const r = indagar(U, S, 0);
  assert.ok(r.ok && /no encuentras nada/.test(r.outcome));
  assert.ok(!(S.players[0].leads || []).length);
});

test("pista veraz y parcial: tipo de firma real, rango de rondas que contiene la real, sin autor ni rol", () => {
  const { U, S } = mk(3);
  S.players[0].items = [{ id: "daga" }];
  playRound(U, { 0: ["apunalar", 1] });
  const sg = S.harm.sigs.find((s) => s.method === "apunalar");
  assert.ok(sg && sg.sig === "golpe");
  assert.strictEqual(U.indagarInfo(2).avail, 0, "en la misma ronda no se ve (el orden no debe filtrar)");
  U.nextRound();
  assert.ok(U.indagarInfo(2).avail >= 1);
  const r = indagar(U, S, 2);
  assert.ok(r.ok);
  const l = S.players[2].leads;
  assert.strictEqual(l.length, 1);
  assert.strictEqual(l[0].sig, "golpe");
  const m = /entre las rondas (\d+) y (\d+)/.exec(l[0].text);
  assert.ok(m && Number(m[1]) <= sg.round && sg.round <= Number(m[2]));
  assert.ok(/Sobre Luis/.test(l[0].text) && /golpe/.test(l[0].text));
  assert.ok(!/Ana|asesin|corrup|oscuridad|sombra/i.test(l[0].text.replace("marca oscura", "")), "no delata autor ni rol");
  assert.ok(/No dice quién fue/.test(l[0].text));
  /* no repite la misma firma */
  assert.strictEqual(U.indagarInfo(2).avail, 0);
  assert.ok(/no encuentras nada/.test(indagar(U, S, 2).outcome));
});

test("solo firmas de daño público o que te afectaron a ti", () => {
  const { U, S } = mk(3);
  /* firma sobre Luis, sano: daño NO público */
  S.harm.sigs.push({ round: 1, victim: 1, author: 0, method: "sabotear", sig: "objeto" });
  S.round = 2;
  assert.strictEqual(U.indagarInfo(2).avail, 0, "Marta no puede saber de un daño que no se ve");
  assert.strictEqual(U.indagarInfo(1).avail, 1, "Luis sí: le afectó a él");
  S.players[1].hp = 1; /* ahora se ve malherido */
  assert.strictEqual(U.indagarInfo(2).avail, 1);
  /* firmas viejas (más de 2 rondas) se desvanecen */
  S.round = 5; assert.strictEqual(U.indagarInfo(1).avail, 0);
});

test("límite: 1 pista; 2 si hubo muerte reciente y la mesa es de 4 o menos", () => {
  const a = mk(3);
  a.S.harm.sigs.push({ round: 1, victim: 1, author: 0, method: "apunalar", sig: "golpe" }, { round: 1, victim: 0, author: 1, method: "enfrentar", sig: "golpe" });
  a.S.round = 2; a.S.players[1].hp = 1; a.S.players[0].hp = 1;
  assert.strictEqual(a.U.indagarInfo(2).per, 1);
  a.S.players[1].dead = true; a.S.players[1].deadRound = 1;
  assert.strictEqual(a.U.indagarInfo(2).per, 2);
  indagar(a.U, a.S, 2);
  assert.strictEqual(a.S.players[2].leads.length, 2);
  const b = mk(5);
  b.S.players[1].dead = true; b.S.players[1].deadRound = 1; b.S.round = 2;
  assert.strictEqual(b.U.indagarInfo(2).per, 1, "mesas de 5+: una sola");
});

test("privacidad: los indicios solo salen en la vista de su dueño", () => {
  const game = new Game(["Ana", "Luis", "Marta"], { readMs: 0, engineDir: ENGINE_DIR, endAt: Date.now() + 30 * 60000, rng: (() => { let x = 7; return () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; })() });
  const S = game.S();
  S.harm.sigs.push({ round: 1, victim: 1, author: 0, method: "apunalar", sig: "golpe" });
  S.players[1].hp = 1; S.round = 2; S.phase = "private";
  S.turn = 2; S.handoff = false;
  const r = game.exec(2, "act", ["indagar", null, null]);
  assert.ok(r && r.ok !== false, JSON.stringify(r));
  const own = JSON.stringify(view.buildView(game, 2));
  assert.ok(/Sobre Luis/.test(own), "su dueño lo ve");
  const txt = S.players[2].leads[0].text;
  [0, 1].forEach((pid) => assert.ok(JSON.stringify(view.buildView(game, pid)).indexOf(txt) === -1, "fuga a " + pid));
  assert.ok(view.buildView(game, 2).q.lead && typeof view.buildView(game, 2).q.lead.avail === "number");
});
