"use strict";
/* v1.13.1: arreglos del log real (plazo del moribundo, perfil NPC oculto, pistas distintas, gramática de usos). */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { loadEngine } = require("../server/engine_vm");
const { ENGINE_DIR } = require("./helpers/bot");

test("log y historia exportados no revelan el perfil del NPC", () => {
  const { U } = loadEngine({ dir: ENGINE_DIR, rng: () => 0.5, now: () => 1.8e12 });
  U.createGame(["Ana", "Luis", "Marta", "Brisa"], { minutes: 30, npc: [null, null, null, "curandero"] });
  const S = U.getState();
  assert.ok(S.players[3].npc, "Brisa es NPC");
  for (const t of [U.exportLog(), U.exportStory(true), U.exportStory(false)]) {
    assert.ok(/\[NPC\]|\(NPC\)/.test(t) || t === U.exportStory(false), "marca NPC visible");
    assert.ok(!/NPC curandero|NPC prudente|NPC agresivo|NPC oscuro|NPC mixto|\[NPC [a-z]/i.test(t), "perfil oculto");
  }
  assert.ok(/Brisa \[NPC\]/.test(U.exportLog()));
});

test("usos restantes: singular correcto", () => {
  const { U, D } = loadEngine({ dir: ENGINE_DIR, rng: () => 0.5, now: () => 1.8e12 });
  U.createGame(["Ana", "Luis", "Marta"], { minutes: 30 });
  const S = U.getState(), p = S.players[S.turn];
  p.items = [{ id: "cota" }]; p.usedItem = false;
  const r = U.useItem(p.id, 0, null);
  assert.ok(r.ok, JSON.stringify(r));
  assert.ok(/le queda 1 uso\)/.test(r.msg) && !/quedan 1/.test(r.msg), r.msg);
});

test("plazo del moribundo en cazar y premios de dos pistas (comprobación de fuente)", () => {
  const src = fs.readFileSync(path.join(ENGINE_DIR, "engine.js"), "utf8");
  assert.ok(/t\.dyingFast \? ": cae moribundo, y solo tendrá lo que reste de esta ronda/.test(src));
  assert.ok(/hasta que acabe la próxima ronda para que alguien lo socorra/.test(src));
  assert.ok(/possible\.splice\(rnd\(possible\.length\), 1\)/.test(src), "apostar: sin repetir jugador");
});
