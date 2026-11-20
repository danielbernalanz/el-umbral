"use strict";
/* v1.13.0: técnicas de Atender (presionar, torniquete, entablillar, cauterizar), silueta (healthInfo.zones) y vista sin fugas. */
const test = require("node:test");
const assert = require("node:assert");
const { loadEngine } = require("../server/engine_vm");
const { ENGINE_DIR } = require("./helpers/bot");

function mk() {
  const { U, D } = loadEngine({ dir: ENGINE_DIR, rng: () => 0.5, now: () => 1.8e12 });
  U.createGame(["Ana", "Luis", "Marta"], { minutes: 30 });
  const S = U.getState();
  S.players.forEach((p) => { p.items = []; p.corr = 0; p.offer = null; });
  S.turn = 0; S.phase = "private"; S.handoff = false;
  return { U, D, S, H: U._health };
}
const item = (D, id) => ({ id, uses: D.ITEMS[id].uses });
const bleed = (p, sev) => { p.status = [{ id: "sangrado", left: 2, sev }]; };

test("presionar: corta un sangrado leve; uno fuerte solo baja a goteo", () => {
  let { U, S } = mk(); bleed(S.players[1], 1);
  assert.ok(U.act(0, "atender", 1).ok);
  assert.ok(!S.players[1].status.some((s) => s.id === "sangrado"));
  ({ U, S } = mk()); bleed(S.players[1], 2);
  assert.ok(U.act(0, "atender", 1, "presionar").ok);
  const st = S.players[1].status.find((s) => s.id === "sangrado");
  assert.ok(st && st.sev === 1);
});

test("torniquete: corta cualquier sangrado, entumece un miembro hoy y mañana, no a la tercera ronda; sin sangrado no cuesta nada", () => {
  const { U, S, H } = mk(); const v = S.players[1]; bleed(v, 2);
  assert.strictEqual(H.armPen(v), 0);
  assert.ok(U.act(0, "atender", 1, "torniquete").ok);
  assert.ok(!v.status.some((s) => s.id === "sangrado"));
  assert.strictEqual(H.armPen(v), 1); assert.strictEqual(H.legPen(v), 1);
  assert.ok(v.notes.some((n) => /torniquete/.test(n) && /entumecido/.test(n)));
  S.round += 1; assert.strictEqual(H.armPen(v), 1, "también la ronda siguiente");
  S.round += 1; assert.strictEqual(H.armPen(v), 0, "a la tercera ronda ya no");
  const m = mk(); assert.ok(m.U.act(0, "atender", 1, "torniquete").ok);
  assert.strictEqual(m.H.armPen(m.S.players[1]), 0, "sin sangrado no hay coste");
});

test("entablillar: exige vendas, las gasta siempre y baja una lesión seria de miembros", () => {
  const { U, D, S, H } = mk(); const v = S.players[1];
  assert.ok(!U.act(0, "atender", 1, "entablillar").ok, "sin vendas no se puede");
  assert.strictEqual(U.treatOptions(0).find((o) => o.id === "entablillar").ok, false);
  S.players[0].items = [item(D, "vendas")];
  H.damage(v, 5, { zone: "piernas", noBleed: true });
  assert.strictEqual(H.legPen(v), 1);
  assert.ok(U.act(0, "atender", 1, "entablillar").ok);
  assert.strictEqual(S.players[0].items.length, 0);
  assert.strictEqual(H.legPen(v), 0, "ya no estorba");
  assert.ok(v.zones.miembros <= 3 && v.inj.miembros.t === "contusion");
  /* sin nada que alinear: las vendas se gastan igualmente (coste de acertar con lo que se ve) */
  const m = mk(); m.S.players[0].items = [item(m.D, "vendas")];
  assert.ok(m.U.act(0, "atender", 1, "entablillar").ok); assert.strictEqual(m.S.players[0].items.length, 0);
});

test("cauterizar: exige fuego; sella sangrado e infección fuertes; cuesta 1 de vitalidad al paciente; la linterna no se gasta", () => {
  const { U, D, S } = mk(); const v = S.players[1];
  assert.ok(!U.act(0, "atender", 1, "cauterizar").ok);
  S.players[0].items = [item(D, "antorcha"), item(D, "linterna")];
  bleed(v, 2); v.status.push({ id: "infeccion", left: 2 }); v.hp = 6;
  assert.ok(U.act(0, "atender", 1, "cauterizar").ok);
  assert.ok(!v.status.some((s) => s.id === "sangrado" || s.id === "infeccion"));
  assert.strictEqual(v.hp, 5);
  assert.strictEqual(S.players[0].items.map((i) => i.id).join(), "linterna");
  const m = mk(); m.S.players[0].items = [item(m.D, "linterna")]; m.S.players[1].hp = 2; bleed(m.S.players[1], 1);
  assert.ok(m.U.act(0, "atender", 1, "cauterizar").ok); assert.strictEqual(m.S.players[1].hp, 2, "con 2 o menos no quema");
  assert.strictEqual(m.S.players[0].items.length, 1);
});

test("técnica desconocida rechazada; el texto del actor no depende de si había algo que tratar", () => {
  const a = mk(); assert.ok(!a.U.act(0, "atender", 1, "cirugia").ok);
  const x = mk(); bleed(x.S.players[1], 1); const r1 = x.U.act(0, "atender", 1, "torniquete");
  const y = mk(); const r2 = y.U.act(0, "atender", 1, "torniquete");
  assert.strictEqual(r1.outcome, r2.outcome);
});

test("silueta: healthInfo.zones lleva 3 zonas con nivel y tipo; treatOptions solo depende de la mochila propia", () => {
  const { U, D, S, H } = mk(); const v = S.players[1];
  H.damage(v, 5, { zone: "cabeza", noBleed: true });
  const hi = U.healthInfo(v);
  assert.strictEqual(hi.zones.map((z) => z.id).join(), "cabeza,torso,miembros");
  assert.strictEqual(hi.zones[0].n, 2);
  const o1 = JSON.stringify(U.treatOptions(1));
  v.hp = 3; v.zones.torso = 5;
  assert.strictEqual(JSON.stringify(U.treatOptions(1)), o1, "no cambia con el cuerpo");
  v.items = [item(D, "vendas")];
  assert.strictEqual(U.treatOptions(1).find((o) => o.id === "entablillar").ok, true);
});

test("online: act con técnica por el servidor; q.treat solo en la vista propia; técnica inválida rechazada", () => {
  const { Game } = require("../server/game");
  const { seeded } = require("../server/engine_vm");
  const view = require("../server/view");
  const clk = { t: 1.8e12 };
  const g = new Game(["Ana", "Luis", "Marta"], { engineDir: ENGINE_DIR, endAt: clk.t + 40 * 60000, now: () => clk.t, rng: seeded(5), readMs: 0 });
  const S = g.S();
  S.players.forEach((p) => { p.items = []; p.offer = null; });
  S.players[0].items = [{ id: "vendas" }];
  S.players[1].status = [{ id: "sangrado", left: 2, sev: 1 }];
  const v0 = view.buildView(g, 0), v1 = view.buildView(g, 1);
  assert.ok(v0.q.treat.find((o) => o.id === "entablillar").ok);
  assert.ok(!v1.q.treat.find((o) => o.id === "entablillar").ok, "cada uno ve la disponibilidad de su mochila");
  assert.ok(g.exec(0, "act", ["atender", 1, "cirugia"]).ok === false);
  const r = g.exec(0, "act", ["atender", 1, "torniquete"]);
  assert.ok(r && r.ok, JSON.stringify(r));
  assert.ok(!S.players[1].status.some((s) => s.id === "sangrado"));
});
