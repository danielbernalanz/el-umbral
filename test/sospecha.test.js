"use strict";
/* v1.8.2/v1.12.0: sospecha acumulada + presentar pista. Acusar ya no revela el rol; marcador público 0-4; las pistas verificadas mueven una duda sobre el rastro; no-fuga. */
const test = require("node:test");
const assert = require("node:assert");
const { loadEngine } = require("../server/engine_vm");
const { Game } = require("../server/game");
const view = require("../server/view");
const { ENGINE_DIR } = require("./helpers/bot");

function mk(n, rng) {
  const { U, D } = loadEngine({ dir: ENGINE_DIR, rng: rng || (() => 0.99), now: () => 1.8e12 });
  U.createGame(["Ana", "Luis", "Marta", "Pablo", "Eva"].slice(0, n || 3), { minutes: 30 });
  const S = U.getState();
  S.players.forEach((p) => { p.items = []; p.corr = 0; p.offer = null; });
  return { U, D, S };
}
function toCouncil(U, S, acts) {
  let guard = 0;
  while (S.phase === "private" && guard++ < 60) {
    if (S.handoff) { U.nextTurn(); continue; }
    const p = S.players[S.turn];
    if (!p.acted && !p.dead) { const a = (acts || {})[p.id] || ["meditar", null]; const r = U.act(p.id, a[0], a[1]); assert.ok(r.ok, "act: " + (r && r.msg)); }
    U.finishTurn();
  }
  assert.strictEqual(S.phase, "council");
}
function fullRound(U, S) { toCouncil(U, S); U.resolveCouncil(); U.endCouncil(); }
function declareAs(U, S, pid, type, t, lead) { S.turn = pid; S.handoff = false; S.players[pid].acted = true; S.phase = "private"; return U.declare(pid, type, t, lead); }

test("acusar sube la sospecha por acusadores DISTINTOS (no repite) y no revela el rol", () => {
  const { U, S } = mk(4);
  S.assassinId = 1; S.players[1].alignment = "asesino"; S.players[1].asesinoRound = 1;
  S.players[0].clues = [{ about: 1, strength: 5, text: "x" }];
  S.players[2].clues = [{ about: 1, strength: 5, text: "x" }];
  toCouncil(U, S);
  assert.strictEqual(U.suspLevel(S.players[1]), 0);
  const r1 = U.registerInteraction(0, "acusacion", 1);
  assert.ok(r1.ok);
  assert.strictEqual(r1.revealedAssassin, false);
  assert.ok(!/es el Asesino|desenmascar|identificad/i.test(r1.text + " " + r1.log), "texto público neutral");
  assert.strictEqual(S.players[1].suspPts, 2);
  const r2 = U.registerInteraction(2, "acusacion", 1);
  assert.strictEqual(S.players[1].suspPts, 4);
  assert.strictEqual(U.suspLevel(S.players[1]), 2);
  assert.ok(!S.players.some((p) => p.exposed) && !S.assassinExposed, "nadie queda expuesto");
  assert.strictEqual(S.publicClues.length, 0, "ninguna pista pública por acertar");
  /* el resultado público es idéntico acierte o falle */
  const strip = (r) => r.text.replace(/Ana|Marta|Luis/g, "N");
  assert.strictEqual(strip(r1), strip(r2));
  /* el mismo acusador no suma dos veces en consejos distintos */
  U.endCouncil(); U.nextRound();
  toCouncil(U, S);
  const before = S.players[1].suspPts;
  U.registerInteraction(0, "acusacion", 1);
  assert.strictEqual(S.players[1].suspPts, before, "repetir acusador no suma");
});

test("acierto privado: solo el acusador lo sabe (nota privada), el inocente acusado también sube sospecha", () => {
  const { U, S } = mk(3, () => 0.99);
  S.assassinId = 1; S.players[1].alignment = "asesino"; S.players[1].asesinoRound = 1;
  S.players[0].clues = [{ about: 1, strength: 6, text: "x" }, { about: 2, strength: 6, text: "x" }];
  toCouncil(U, S);
  U.registerInteraction(0, "acusacion", 1);
  assert.ok(S.players[0].successfulAccusations >= 1);
  assert.ok(S.players[0].notes.some((n) => /pruebas encajan/.test(n)));
  U.registerInteraction(0, "acusacion", 2) /* segunda acusación del mismo jugador: rechazada */;
  assert.ok(S.players[2].suspPts === 0);
});

test("la sospecha baja con rondas sin incidentes y con actos de bien", () => {
  const { U, S } = mk(3);
  S.players[1].suspPts = 6; S.players[1].susp = 3;
  fullRound(U, S);
  assert.strictEqual(S.players[1].suspPts, 5, "−1 por ronda tranquila");
  assert.strictEqual(S.players[1].susp, 2);
  U.nextRound();
  S.players[1].suspGood = S.round + 0; /* acto de bien visible esta ronda */
  fullRound(U, S);
  assert.strictEqual(S.players[1].suspPts, 3, "tranquila −1 y acto de bien −1");
});

test("emboscada pública = acto hostil visible: sube la sospecha del atacante", () => {
  const { U, S } = mk(3);
  toCouncil(U, S);
  U.registerInteraction(0, "emboscada", 1);
  assert.strictEqual(S.players[0].suspPts, 1);
});

test("efectos cooperativos: con nivel 2+ enfrentarse ya no es a ciegas", () => {
  const a = mk(3); toCouncil(a.U, a.S);
  a.U.registerInteraction(0, "emboscada", 1);
  assert.ok(a.S.players[0].corr >= 4, "a ciegas contra alguien sin sospecha: coste");
  const b = mk(3); b.S.players[1].suspPts = 4; toCouncil(b.U, b.S);
  b.U.registerInteraction(0, "emboscada", 1);
  assert.ok(!b.S.players[0].blunder, "con sospecha 2+ no es a ciegas");
  assert.ok(a.S.players[0].blunder, "sin sospecha sí lo es");
});

function withLead(S, author, victim, who) {
  S.harm.sigs.push({ round: 1, victim: victim, author: author, method: "apunalar", sig: "golpe" });
  S.players[who].leads = [{ round: 1, sig: "golpe", text: "Sobre X: un golpe directo, de cerca, entre las rondas 1 y 2. No dice quién fue.", i: S.harm.sigs.length - 1, k: 1 }];
  S.players[who].leadSeq = 1;
}

test("presentar pista: pública sin autor ni oráculo; mueve la sospecha del rastro; se gasta; el autor del rastro se entera en privado", () => {
  const { U, S } = mk(4);
  withLead(S, 1, 2, 0);
  toCouncil(U, S);
  S.phase = "private"; S.turn = 0; S.handoff = false; S.players[0].acted = true;
  const opts = U.declareOptions(0);
  assert.ok(opts && opts.leads.length === 1 && opts.leads[0].i === 1);
  assert.ok(!U.declare(0, "pista", null, 99).ok, "pista inexistente");
  assert.ok(U.declare(0, "pista", null, 1).ok);
  S.phase = "council";
  const r = U.resolveCouncil();
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].actor, null, "sin autor");
  assert.strictEqual(r[0].target, null);
  assert.ok(/Sobre X: un golpe directo/.test(r[0].res.text), "texto tal como lo viste");
  assert.strictEqual(S.players[1].suspPts, 1, "el rastro presentado hace subir una duda sobre su autor");
  assert.strictEqual(S.players[0].suspPts, 0, "presentar no señala al jugador que la trae");
  assert.strictEqual(S.players[2].suspPts, 0, "presentar no señala a la víctima");
  assert.ok(S.players[0].leads[0].used, "la pista se gasta");
  assert.ok(S.players[0].notes.some((n) => /presentaste una pista/.test(n)));
  assert.ok(S.players[1].notes.some((n) => /rastro tuyo/.test(n)), "el autor se entera en privado");
  assert.ok(!S.players[2].notes.some((n) => /rastro tuyo/.test(n)));
  /* la misma pista ya no se puede reutilizar */
  S.phase = "private"; S.turn = 0; S.handoff = false; S.players[0].acted = true;
  assert.strictEqual(U.declareOptions(0).leads.length, 0);
  assert.ok(!U.declare(0, "pista", null, 1).ok);
});

test("presentar pista: máximo una por consejo y la víctima no se delata («Sobre ti» se nombra)", () => {
  const { U, S } = mk(4);
  withLead(S, 1, 0, 0);
  S.players[0].leads[0].text = "Sobre ti: un golpe directo, entre las rondas 1 y 2. No dice quién fue.";
  S.players[0].leads.push({ round: 1, sig: "golpe", text: "Sobre Pablo: algo. No dice quién fue.", i: 0, k: 2 }); S.players[0].leadSeq = 2;
  toCouncil(U, S);
  S.phase = "council";
  const r1 = U.registerInteraction(0, "pista", null, 1);
  assert.ok(r1.ok && !/Sobre ti/.test(r1.text) && new RegExp("Sobre " + S.players[0].name).test(r1.text), r1.text);
  assert.ok(!U.registerInteraction(0, "pista", null, 2).ok, "una por consejo");
});

test("presentar pista sin pistas no se ofrece; no se puede declarar", () => {
  const { U, S } = mk(3);
  toCouncil(U, S); S.phase = "private"; S.turn = 0; S.handoff = false; S.players[0].acted = true;
  assert.strictEqual(U.declareOptions(0).leads.length, 0);
  assert.ok(!U.declare(0, "pista", null, 1).ok);
});

test("vista filtrada: susp público de todos, suspBy/suspPts ajenos nunca; local y online coinciden", () => {
  const game = new Game(["Ana", "Luis", "Marta"], { readMs: 0, engineDir: ENGINE_DIR, endAt: Date.now() + 30 * 60000, rng: (() => { let x = 11; return () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; })() });
  const S = game.S(), U = game.U;
  S.players[1].suspPts = 4; S.players[1].susp = 2; S.players[1].suspBy = [0, 2];
  S.harm.sigs.push({ round: 1, victim: 1, author: 0, method: "apunalar", sig: "golpe" });
  S.players[2].leads = [{ round: 1, sig: "golpe", text: "pista secreta de Marta", i: 0, k: 1 }];
  const v0 = game.view(0), v2 = game.view(2), v1 = game.view(1);
  assert.strictEqual(v0.players[1].susp, 2);
  const j0 = JSON.stringify(v0.players.filter((p) => p.id !== 0)) + JSON.stringify(v0.q);
  assert.ok(!/suspBy|suspPts|pista secreta de Marta/.test(j0), "nada privado ajeno en la vista de Ana");
  assert.ok(!/suspBy/.test(JSON.stringify(v1.me)), "ni siquiera el propio suspBy (identidades ajenas)");
  assert.strictEqual(U.suspLevel(S.players[1]), 2);
  assert.ok(v1.players[1].susp === 2);
});

test("online: presentar pista por comando valida la pista, sin objetivo", () => {
  const game = new Game(["Ana", "Luis", "Marta"], { readMs: 0, engineDir: ENGINE_DIR, endAt: Date.now() + 30 * 60000 });
  const S = game.S();
  S.harm.sigs.push({ round: 1, victim: 2, author: 1, method: "apunalar", sig: "golpe" });
  S.players[0].leads = [{ round: 1, sig: "golpe", text: "t", i: 0, k: 1 }]; S.players[0].leadSeq = 1;
  game.exec(0, "act", ["meditar", null, null]);
  const bad = game.exec(0, "declare", ["pista", null, 77]);
  assert.ok(!bad || bad.ok === false);
  const ok = game.exec(0, "declare", ["pista", null, 1]);
  assert.ok(ok && ok.ok !== false, JSON.stringify(ok));
  assert.strictEqual(S.players[0].intent.lead, 1);
});

test("mesa grande (>4 jugadores): tentación garantizada de mitad de partida al más oscuro", () => {
  const { loadEngine } = require("../server/engine_vm");
  for (const n of [8, 6]) {
    const { U } = loadEngine({ dir: ENGINE_DIR, rng: () => 0.5, now: () => 1.8e12 });
    U.createGame(["Ana", "Luis", "Marta", "Pablo", "Eva", "Iker", "Noa", "Leo", "Mia", "Rut"].slice(0, n), { minutes: 20 });
    const S = U.getState();
    S.players.forEach((p) => { p.items = []; p.offer = null; });
    S.round = Math.max(1, Math.ceil(S.maxRounds / 2)); S.players[2].aggr = 1; S.players[2].corr = 12;
    const o = U.getOffer(2);
    assert.ok(o && o.id === "asesino", n + " jugadores: oferta final de mitad de partida");
  }
});
