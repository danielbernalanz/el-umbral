"use strict";
/* F6: partidas completas por red con bots (reloj acelerado, desconexiones, votación de tiempo, no-fuga en cada difusión). La batería grande: node test/bots_online.js */
const test = require("node:test");
const assert = require("node:assert");
const { playOnline } = require("./helpers/netbots");
for (const [n, seed, mins, accel] of [[4, 3, 12, 60], [6, 5, 5, 300], [8, 2, 12, 250]]) {
  test("bots por red: " + n + " jugadores, semilla " + seed + ": desenlace, sin errores ni fugas", async () => {
    const r = await playOnline({ n, seed, mins, accel, churn: 0.02, maxMs: 60000 });
    assert.ok(r.ended && r.hasEnding, "la partida no terminó: " + JSON.stringify(r));
    assert.deepStrictEqual(r.errors, []); assert.deepStrictEqual(r.leaks, []);
  });
}
