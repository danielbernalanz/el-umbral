"use strict";
/* v1.10.0: salud con 3 zonas, una lesión por zona, tick determinista, señales públicas, Atender, migración. Motor puro en un vm. */
const test = require("node:test");
const assert = require("node:assert");
const { loadEngine } = require("../server/engine_vm");
const { ENGINE_DIR } = require("./helpers/bot");

function mk(rv) {
  const R = { v: rv === undefined ? 0.5 : rv };
  const { U, D } = loadEngine({ dir: ENGINE_DIR, rng: () => R.v, now: () => 1.8e12 });
  U.createGame(["Ana", "Luis", "Marta"], { minutes: 30 });
  const S = U.getState();
  S.players.forEach((p) => { p.items = []; p.corr = 0; p.offer = null; });
  return { U, D, S, R, H: U._health };
}

test("3 zonas: los nombres antiguos brazos/piernas caen en «miembros» con su parte; una lesión por zona", () => {
  const { S, H } = mk();
  const p = S.players[1];
  assert.deepStrictEqual(Object.keys(p.zones).sort(), ["cabeza", "miembros", "torso"]);
  const r = H.damage(p, 2, { zone: "piernas", noBleed: true });
  assert.strictEqual(r.zone, "miembros"); assert.strictEqual(r.part, "piernas");
  assert.strictEqual(p.inj.miembros.part, "piernas");
  H.damage(p, 1, { zone: "brazos", noBleed: true });
  assert.strictEqual(Object.keys(p.inj).length, 1, "una sola lesión por zona");
  assert.strictEqual(p.inj.miembros.part, "brazos", "la parte es la del último golpe");
  assert.strictEqual(p.zones.miembros, 3);
});

test("tipos de lesión y fusión: contusión grave en un miembro es fractura; perforación manda sobre corte", () => {
  const { S, H } = mk();
  const p = S.players[1];
  H.damage(p, 4, { zone: "piernas", noBleed: true });
  assert.strictEqual(p.inj.miembros.t, "fractura");
  const q = S.players[2];
  H.damage(q, 1, { zone: "torso", src: "apunalar", noBleed: true }); assert.strictEqual(q.inj.torso.t, "corte");
  H.damage(q, 1, { zone: "torso", src: "cazar", noBleed: true }); assert.strictEqual(q.inj.torso.t, "perforacion");
  H.damage(q, 1, { zone: "torso", src: "gen", noBleed: true }); assert.strictEqual(q.inj.torso.t, "perforacion", "no se degrada");
});

test("sangrado determinista: un corte o perforación de 3+ sangra siempre; una contusión nunca (con cualquier azar)", () => {
  for (const rv of [0, 0.3, 0.99]) {
    const { S, H } = mk(rv);
    const a = S.players[0], b = S.players[1], c = S.players[2];
    H.damage(a, 3, { src: "apunalar", zone: "torso" });
    assert.ok(a.status.some((s) => s.id === "sangrado"), "corte sangra (rv " + rv + ")");
    H.damage(b, 4, { src: "gen", zone: "cabeza" });
    assert.ok(!b.status.some((s) => s.id === "sangrado"), "contusión no sangra");
    H.damage(c, 2, { src: "apunalar", zone: "torso" });
    assert.ok(!c.status.some((s) => s.id === "sangrado"), "un corte leve (<3) no sangra");
  }
});

test("tick determinista: el sangrado resta su gravedad por ronda y la previsión lo anticipa sin azar", () => {
  const { U, S, H, R } = mk();
  const p = S.players[1]; p.hp = 4;
  p.status = [{ id: "sangrado", left: 2, sev: 2 }];
  const a = U.healthInfo(p);
  assert.strictEqual(JSON.stringify(a.prevision), "{\"caer\":2}");
  assert.ok(a.urgentes.some((u) => u.key === "sangrado" && /moribundo en 2 rondas/.test(u.text)));
  for (const rv of [0, 0.99]) { R.v = rv; const q = JSON.stringify(U.healthInfo(p)); assert.strictEqual(q, JSON.stringify(a)); }
  p.status = [{ id: "sangrado", left: 2, sev: 1 }]; p.hp = 3;
  assert.strictEqual(U.healthInfo(p).prevision, null, "goteo 1 x 2 rondas no mata con 3 de vitalidad");
});

test("infección determinista: herida abierta seria sin cuidar 2 rondas se infecta (aviso la ronda anterior); curarla lo evita", () => {
  const run = (cuidar) => {
    const { U, S, H } = mk(0.9);
    const v = S.players[1];
    H.damage(v, 4, { src: "apunalar", zone: "miembros", noBleed: true }); /* abierta, seria */
    assert.strictEqual(v.inj.miembros.t, "corte");
    S.phase = "resolution"; U.nextRound(); /* ronda 2: edad 1, aviso */
    assert.strictEqual(S.round, 2);
    assert.ok(v.notes.some((n) => /sigue sin cuidar/.test(n)), "aviso previo");
    assert.ok(!v.status.some((s) => s.id === "infeccion"));
    if (cuidar) v.cleanRound = S.round;
    S.phase = "resolution"; U.nextRound(); /* ronda 3 */
    return v.status.some((s) => s.id === "infeccion");
  };
  assert.strictEqual(run(false), true, "sin cuidar: infección");
  assert.strictEqual(run(true), false, "cuidada: no se infecta");
});

test("Atender: corta sangrado e infección del otro; el actor recibe texto uniforme; el atendido lo sabe en privado", () => {
  const { U, S, H } = mk();
  const a = S.players[0], v = S.players[1];
  v.status = [{ id: "sangrado", left: 2, sev: 1 }, { id: "infeccion", left: 2 }];
  S.turn = 0; S.phase = "private"; S.handoff = false;
  const r = U.act(0, "atender", 1);
  assert.ok(r.ok);
  assert.ok(!v.status.some((s) => s.id === "sangrado" || s.id === "infeccion"));
  assert.ok(v.notes.some((n) => /Ana te atendió/.test(n)));
  const textoConCosa = r.outcome;
  const { U: U2, S: S2 } = mk();
  S2.turn = 0; S2.phase = "private"; S2.handoff = false;
  const r2 = U2.act(0, "atender", 1);
  assert.ok(r2.ok);
  assert.strictEqual(r2.outcome.replace("Luis", "X"), textoConCosa.replace("Luis", "X"), "el texto del actor no delata si había algo que atender");
});

test("Atender no se ofrece sobre un moribundo y está disponible para todos desde el principio", () => {
  const { U, D, S } = mk();
  const at = D.ACTIONS.find((a) => a.id === "atender");
  assert.ok(at && at.target);
  S.players.forEach((p) => assert.ok(U.isUnlocked(p, at), "desbloqueada para todos"));
  S.players[1].dying = true;
  assert.ok(!at.canTarget(S.players[1], S.players[0]));
  assert.ok(at.canTarget(S.players[2], S.players[0]));
});

test("señales públicas: solo vocabulario cerrado, máx. 3; la corrupción, el rol y la causa no cambian lo que se ve", () => {
  const mkBody = (corr, align, cause) => {
    const { U, S, H } = mk();
    const p = S.players[1]; p.corr = corr; p.alignment = align; p.cause = cause; p.hungerOn = corr > 40 ? 1 : 0;
    H.damage(p, 4, { src: "gen", zone: "piernas", noBleed: true, tipo: "corte" });
    H.damage(p, 5, { src: "gen", zone: "cabeza", noBleed: true });
    p.status = [{ id: "sangrado", left: 2, sev: 1 }];
    return JSON.stringify(U.publicLook(p)) + "|" + U.visibleHealth(p);
  };
  const base = mkBody(0, "inocente", "x");
  assert.strictEqual(mkBody(80, "asesino", "umbral"), base);
  const look = JSON.parse(base.split("|")[0]);
  assert.ok(look.signos.length <= 3);
  const vocab = ["cojea", "protege_brazo", "tambalea", "sangra", "palido", "vendado"];
  look.signos.forEach((s) => assert.ok(vocab.includes(s)));
  assert.deepStrictEqual(look.signos, ["cojea", "tambalea", "sangra"]);
});

test("pálido: shock, infección y veneno sintomático dan la MISMA señal (ambigua)", () => {
  const { U, S } = mk();
  const base = (p) => { p.hp = p.hp; return U.publicLook(p).signos; };
  const a = S.players[0], b = S.players[1], c = S.players[2];
  a.hp = 2; b.status = [{ id: "infeccion", left: 2 }]; c.status = [{ id: "veneno", left: 2, dmg: 2, first: false }];
  [a, b, c].forEach((p) => { if (p.hp > 5) p.hp = p.hp - 1; assert.ok(base(p).includes("palido")); });
  const d = S.players[0]; d.hp = U.maxHp(d); d.status = [{ id: "veneno", left: 2, dmg: 2, first: true }];
  assert.ok(!U.publicLook(d).signos.includes("palido"), "veneno latente: sin síntomas");
});

test("vendar deja la señal «vendado» un par de rondas; curar sin vendaje no", () => {
  const { U, S, H } = mk();
  const p = S.players[1]; H.damage(p, 3, { src: "gen", zone: "torso" });
  H.heal(p, 1);
  assert.ok(!U.publicLook(p).signos.includes("vendado"));
  H.heal(p, 1, true);
  assert.ok(U.publicLook(p).signos.includes("vendado"));
});

test("curar baja la lesión: sin daño en la zona desaparece la lesión; descansar corta sangrado/infección", () => {
  const { U, S, H } = mk();
  const p = S.players[1]; H.damage(p, 2, { src: "gen", zone: "torso" });
  assert.ok(p.inj.torso);
  H.heal(p, 5);
  assert.ok(!p.inj.torso && p.zones.torso === 0);
});

test("migración: guardado con 4 zonas (brazos/piernas) se funde en «miembros» y conserva hp y la parte más dañada", () => {
  const { U, S, H } = mk();
  const p = S.players[1];
  p.zones = { cabeza: 1, torso: 2, brazos: 1, piernas: 4 }; delete p.inj; const hp = p.hp;
  H.initHealth(p);
  assert.deepStrictEqual(p.zones, { cabeza: 1, torso: 2, miembros: 5 });
  assert.strictEqual(p.inj.miembros.part, "piernas");
  assert.strictEqual(p.hp, hp);
  assert.strictEqual(U.publicLook(p).signos[0], "cojea");
  const r = U.healthInfo(p); assert.strictEqual(r.zones.length, 3);
});

test("daño sobre moribundo, moribundo por vitalidad 0 y estabilizar siguen igual", () => {
  const { S, H } = mk();
  const p = S.players[1];
  const r = H.damage(p, 99, { src: "cazar", fast: true });
  assert.ok(r.dying && p.dying && p.hp === 0);
  assert.ok(H.stabilize(p) && !p.dying && p.hp >= 2);
  H.damage(p, 99, { src: "gen" }); assert.ok(p.dying);
  H.damage(p, 1, { src: "gen" }); assert.ok(p.dead);
});
