"use strict";
/* Persistencia entre reinicios: instantánea cifrada + restauración. Reinicio simulado = un Rooms NUEVO (otro contexto vm, otra instancia)
   que solo recibe el blob y el token de un jugador. Reloj inyectado. */
const test = require("node:test");
const assert = require("node:assert");
const { Rooms } = require("../server/room");
const { makeCodec } = require("../server/snapshot");
const { ENGINE_DIR } = require("./helpers/bot");
const L = require("./helpers/leakcheck");

const KEY = "clave-de-pruebas-0123456789abcdef";
const quiet = () => {};
function fakeRes() {
  const r = { writes: [], closed: false, h: {}, writeHead() {}, write(m) { if (r.closed) throw new Error("cerrada"); r.writes.push(String(m)); return true; },
    on(ev, fn) { (r.h[ev] = r.h[ev] || []).push(fn); }, end() { if (!r.closed) { r.closed = true; (r.h.close || []).forEach((f) => f()); } } };
  return r;
}
function mkRooms(clk, o) { return new Rooms(Object.assign({ engineDir: ENGINE_DIR, now: () => clk.t, readMs: 0, snapshotKey: KEY, restoreWindowMs: 0, log: quiet }, o || {})); }
/* sala de n jugadores con tokens; devuelve {rooms, room, tokens[], pl[], res[]} */
function setup(n, clk, o) {
  const rooms = mkRooms(clk, o);
  const first = rooms.create("P0"), room = rooms.get(first.room), tokens = [first.token];
  for (let i = 1; i < n; i++) tokens.push(room.join("P" + i).token);
  const pl = room.players.slice(), res = pl.map((p) => { const r = fakeRes(); room.connect(p, r); return r; });
  return { rooms, room, tokens, pl, res, code: room.code };
}
const lastBlob = (r) => { for (let i = r.writes.length - 1; i >= 0; i--) { const m = /^event: snapshot\ndata: (\S+)\n\n$/.exec(r.writes[i]); if (m) return m[1]; } return null; };
const strip = (v) => { const o = JSON.parse(JSON.stringify(v)); delete o.ver; delete o.serverNow; return o; };
const views = (room) => room.players.map((p) => JSON.stringify(strip(room.viewFor(p))));
/* quita lo que depende de relojes y presencia (se compara aparte) */
const norm = (v) => { const o = strip(v); delete o.clock; delete o.endAt; if (o.q) { delete o.q.timeLeftMs; delete o.q.extEnd; delete o.q.timeWarn; } o.players && o.players.forEach((p) => { delete p.online; }); return o; };
const normViews = (room) => room.players.map((p) => JSON.stringify(norm(room.viewFor(p))));
const dropAll = (e) => e.res.forEach((r) => r.end());
async function restoreVia(rooms2, code, blob, token) { const r = await rooms2.restore(code, blob, token); return r; }
const audit = (room, tag) => { const g = room.game, pre = L.prepare(g), pr = []; for (let i = 0; i < g.playerCount(); i++) L.checkView(g, i, g.view(i), pre).forEach((p) => pr.push("[" + tag + "] " + p)); assert.deepStrictEqual(pr, []); };
function playRound(room, clk) {
  const g = room.game, S = g.S(), r0 = S.round;
  const each = (cmds) => room.players.forEach((p, i) => { if (!S.players[i].dead) cmds.forEach((c) => g.exec(i, c[0], c[1])); });
  if (S.phase === "private") each([["act", ["meditar", null, null]], ["finishTurn", []]]);
  if (S.phase === "council") each([["councilReady", []]]);
  if (S.phase === "resolution" && !S.timeAsk) each([["continue", []]]);
  if (S.timeAsk) g.exec(room.hostPlayer().slot, "vote", ["end"]);
  clk.t += 1000; room.tick();
  return S.round !== r0 || S.phase === "ending";
}

test("codec: ida y vuelta, manipulado, otra sala, otra clave, motor distinto, sin clave", () => {
  const c = makeCodec({ key: KEY, engineDir: ENGINE_DIR, log: quiet });
  const plain = { schema: c.SCHEMA, engine: c.engine, code: "ABCDE", seq: 3, secreto: "Mi secreto es ser el asesino" };
  const b = c.encode(plain, "ABCDE");
  assert.ok(!b.includes("asesino") && !Buffer.from(b.slice(3), "base64url").toString("latin1").includes("asesino"), "blob opaco");
  assert.deepStrictEqual(c.decode(b, "ABCDE").plain, plain);
  assert.strictEqual(c.decode(b, "ABCDF").ok, false, "otra sala (AAD)");
  const flip = b.slice(0, 40) + (b[40] === "A" ? "B" : "A") + b.slice(41);
  assert.strictEqual(c.decode(flip, "ABCDE").ok, false, "manipulado");
  assert.strictEqual(c.decode(b.slice(0, -4), "ABCDE").ok, false, "truncado");
  assert.strictEqual(c.decode("U9." + b.slice(3), "ABCDE").reason, "schema");
  assert.strictEqual(c.decode("basura", "ABCDE").ok, false);
  const c2 = makeCodec({ key: KEY + "x", engineDir: ENGINE_DIR, log: quiet });
  assert.strictEqual(c2.decode(b, "ABCDE").ok, false, "otra clave");
  const c3 = makeCodec({ key: KEY, engineDir: ENGINE_DIR, log: quiet });
  const bad = c3.encode(Object.assign({}, plain, { engine: "0000" }), "ABCDE");
  assert.strictEqual(c3.decode(bad, "ABCDE").reason, "engine");
  const off = makeCodec({ engineDir: ENGINE_DIR, log: quiet });
  assert.strictEqual(off.enabled, false); assert.strictEqual(off.encode(plain, "ABCDE"), null); assert.strictEqual(off.decode(b, "ABCDE").ok, false);
  const warned = []; makeCodec({ engineDir: ENGINE_DIR, log: (m) => warned.push(m) }); assert.ok(warned.length === 1 && /SNAPSHOT_KEY/.test(warned[0]), "avisa en el log");
});

for (const spot of ["privada", "consejo", "tiempo"]) {
  test("restauración exacta a mitad de fase " + spot + ": vistas idénticas, plazos desplazados, partida continúa hasta el final", async () => {
    const clk = { t: 1.8e12 }, e = setup(4, clk);
    assert.ok(e.room.start(e.pl[0], clk.t + 40 * 60000).ok);
    const g = e.room.game, S = g.S();
    clk.t += 5000;
    if (spot === "privada") { g.exec(0, "act", ["investigar", null, null]); g.exec(1, "act", ["meditar", null, null]); g.exec(1, "finishTurn", []); }
    if (spot === "consejo") { g.forceAdvance(); assert.strictEqual(S.phase, "council"); g.exec(2, "councilReady", []); }
    if (spot === "tiempo") {
      g.forceAdvance(); g.forceAdvance(); assert.strictEqual(S.phase, "resolution");
      clk.t = S.endAt + 1000; S.players.forEach((p) => g.contReady.add(p.id)); g.advance();
      assert.ok(S.timeAsk, "pregunta de tiempo abierta"); g.exec(1, "vote", [2]);
    }
    e.room.broadcast(); clk.t += 3000;
    const blob = e.room.takeSnapshot(true); assert.ok(blob, "hay blob");
    assert.strictEqual(lastBlob(e.res[2]), blob, "el MISMO blob llegó por SSE a cada jugador conectado");
    assert.ok(e.res.every((r) => lastBlob(r) === blob));
    dropAll(e);
    const before = normViews(e.room), ckA = JSON.parse(JSON.stringify(g.clock)), endA = S.endAt, roundA = S.round, phaseA = S.phase;
    /* reinicio: sala NUEVA en un Rooms nuevo, 40 s más tarde, solo con blob + token del jugador 3 */
    const clk2 = { t: clk.t + 40000 }, rooms2 = mkRooms(clk2);
    assert.strictEqual(rooms2.get(e.code), null);
    const r = await restoreVia(rooms2, e.code, blob, e.tokens[3]);
    assert.strictEqual(r.status, 200, JSON.stringify(r.json)); assert.strictEqual(r.json.restored, true);
    const room2 = rooms2.get(e.code), g2 = room2.game, S2 = g2.S();
    assert.deepStrictEqual(normViews(room2), before, "vistas de TODOS idénticas salvo reloj/presencia");
    assert.strictEqual(S2.round, roundA); assert.strictEqual(S2.phase, phaseA);
    assert.strictEqual(S2.endAt, endA + 40000, "endAt desplazado por el tiempo caído");
    assert.ok(room2.players.every((p) => p.conns.size === 0) && room2.viewFor(room2.players[0]).players.every((p) => p.online === false), "todos desconectados hasta que reconecten");
    if (ckA) {
      const ck2 = g2.clock, prim = ckA.kind === "turn" ? "autoAt" : "deadline";
      assert.strictEqual(ck2.kind, ckA.kind);
      assert.ok(ck2[prim] - clk2.t >= (ckA.kind === "turn" ? 90000 : 60000) - 1, "gracia mínima tras restaurar");
      assert.ok(ck2[prim] >= ckA[prim] + 40000, "el plazo nunca se acorta");
    }
    /* tokens conservados: cada jugador entra con el suyo y ve su vista */
    const res2 = room2.players.map((p) => { const rr = fakeRes(); room2.connect(p, rr); return rr; });
    assert.ok(rooms2.byToken(e.tokens[1]).player.slot === 1 && rooms2.byToken(e.tokens[0]).room === room2);
    res2.forEach((rr, i) => assert.ok(rr.writes.some((w) => /event: view/.test(w)), "vista a J" + i));
    /* ver sigue creciendo: ningún cliente descarta vistas nuevas */
    const ver1 = JSON.parse(/data: (.*)\n/.exec(res2[0].writes.find((w) => /event: view/.test(w)))[1]).ver;
    assert.ok(ver1 > 1000000);
    /* la gracia: nadie es completado por el autoturno justo tras reiniciar */
    clk2.t += 20000; room2.tick(); assert.strictEqual(g2.S().round, roundA); assert.strictEqual(g2.S().phase, phaseA);
    audit(room2, "restaurada");
    /* la partida continúa y termina, sin fugas */
    let guard = 0; while (!g2.ended() && guard++ < 80) { playRound(room2, clk2); if (guard % 5 === 0) audit(room2, "r" + guard); }
    assert.ok(g2.ended(), "termina");
    assert.strictEqual(g2.errors.length, 0, g2.errors.join("\n"));
    assert.strictEqual(room2.status, "ended");
    assert.strictEqual(room2.takeSnapshot(true), null, "una sala terminada no se instantanea");
  });
}

test("seguridad: blob manipulado, de otra sala, antiguo (mayor seq gana), token ajeno, existente, sin clave", async () => {
  const clk = { t: 1.8e12 }, A = setup(3, clk), B = setup(3, clk);
  A.room.start(A.pl[0], clk.t + 30 * 60000); B.room.start(B.pl[0], clk.t + 30 * 60000);
  const a1 = A.room.takeSnapshot(true); A.room.game.exec(0, "act", ["meditar", null, null]); const a2 = A.room.takeSnapshot(true);
  const b1 = B.room.takeSnapshot(true);
  assert.notStrictEqual(a1, a2);
  const mk2 = (o) => mkRooms({ t: clk.t + 1000 }, o);
  let R = mk2();
  assert.strictEqual((await R.restore(A.code, a1.slice(0, 50) + "AAAA" + a1.slice(54), A.tokens[0])).status, 400, "manipulado");
  assert.strictEqual((await R.restore(A.code, b1, A.tokens[0])).status, 400, "blob de otra sala bajo este código");
  assert.strictEqual((await R.restore(B.code, a1, B.tokens[0])).status, 400, "blob de A pedido con el código de B");
  assert.strictEqual((await R.restore(A.code, a1, B.tokens[0])).status, 401, "token de otra sala");
  assert.strictEqual((await R.restore(A.code, a1, "0".repeat(32))).status, 401, "token desconocido");
  assert.strictEqual((await R.restore(A.code, a1, "zz")).status, 401);
  assert.strictEqual((await R.restore("xx", a1, A.tokens[0])).status, 400);
  assert.strictEqual(R.rooms.size, 0, "nada se creó por los intentos fallidos");
  /* ventana: llegan primero el viejo y luego el nuevo -> gana el de mayor seq */
  R = mk2({ restoreWindowMs: 40 });
  const p1 = R.restore(A.code, a1, A.tokens[0]), p2 = R.restore(A.code, a2, A.tokens[1]);
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.strictEqual(r1.status, 200); assert.strictEqual(r2.status, 200);
  assert.strictEqual(R.get(A.code).snapSeq, JSON.parse(JSON.stringify(R.get(A.code).snapSeq)), "sala creada");
  assert.strictEqual(R.get(A.code).game.S().players[0].acted, true, "se restauró el blob de mayor seq (J0 ya había actuado)");
  /* el primero gana: un blob viejo posterior no rebobina; devuelve «existente» solo si el token es de la sala */
  const late = await R.restore(A.code, a1, A.tokens[2]); assert.strictEqual(late.status, 200); assert.strictEqual(late.json.existed, true);
  assert.strictEqual(R.get(A.code).game.S().players[0].acted, true, "no rebobinó");
  assert.strictEqual((await R.restore(A.code, a1, B.tokens[0])).status, 401, "sala existente + token ajeno");
  /* sala cerrada en este proceso: no se resucita con un blob viejo */
  R.get(A.code).status = "ended"; R.get(A.code).endedAt = clk.t - 99 * 60000; R.sweep();
  assert.strictEqual(R.get(A.code), null);
  assert.strictEqual((await R.restore(A.code, a2, A.tokens[0])).status, 410, "retirada");
  /* caducada */
  const old = mkRooms({ t: clk.t + 5 * 3600000 }); assert.strictEqual((await old.restore(A.code, a2, A.tokens[0])).status, 410);
  /* sin clave: desactivado, sin eventos snapshot */
  const off = setup(3, { t: clk.t }, { snapshotKey: undefined, log: quiet });
  off.room.start(off.pl[0], clk.t + 30 * 60000); off.room.broadcast();
  assert.strictEqual(off.room.takeSnapshot(true), null); assert.ok(off.res.every((r) => lastBlob(r) === null));
  assert.strictEqual((await mkRooms({ t: clk.t }, { snapshotKey: undefined }).restore(A.code, a1, A.tokens[0])).status, 404);
});

test("motor distinto: restauración rechazada limpiamente (la sala no se crea)", async () => {
  const clk = { t: 1.8e12 }, A = setup(3, clk); A.room.start(A.pl[0], clk.t + 30 * 60000);
  const blob = A.room.takeSnapshot(true);
  const R = mkRooms({ t: clk.t + 1000 });
  R.snap.decode = ((orig) => (b, c) => { const d = orig(b, c); return d.ok ? { ok: false, reason: "engine" } : d; })(R.snap.decode);
  const r = await R.restore(A.code, blob, A.tokens[0]);
  assert.strictEqual(r.status, 409); assert.strictEqual(R.rooms.size, 0);
});

test("instantáneas: al cambiar de fase y como mucho cada 10 s dentro de una fase; lobby incluido; al conectar se envía la última", () => {
  const clk = { t: 1.8e12 }, e = setup(3, clk);
  const n = () => e.res[0].writes.filter((w) => /event: snapshot/.test(w)).length;
  assert.ok(n() >= 1, "lobby: instantánea al unirse");
  e.room.start(e.pl[0], clk.t + 30 * 60000); const n0 = n();
  e.room.game.exec(0, "act", ["meditar", null, null]); e.room.broadcast(); assert.strictEqual(n(), n0, "mismo estado de fase: no instantánea inmediata");
  clk.t += 9000; e.room.tick(); assert.strictEqual(n(), n0); clk.t += 2000; e.room.tick(); assert.strictEqual(n(), n0 + 1, "a los 10 s");
  e.room.game.forceAdvance(); e.room.broadcast(); assert.strictEqual(n(), n0 + 2, "cambio de fase: inmediata");
  const nr = fakeRes(); e.pl[1].conns.forEach((c) => c.end()); e.room.connect(e.pl[1], nr);
  assert.ok(lastBlob(nr), "reconectar recibe la última instantánea");
});

test("blob y vistas posteriores: sin fugas (el blob no contiene texto privado; las vistas restauradas pasan el detector)", async () => {
  const clk = { t: 1.8e12 }, e = setup(5, clk); e.room.start(e.pl[0], clk.t + 40 * 60000);
  const g = e.room.game; g.exec(0, "act", ["investigar", null, null]);
  const blob = e.room.takeSnapshot(true), pre = L.prepare(g);
  Object.keys(pre.tokens).forEach((k) => pre.tokens[k].all.concat(pre.tokens[k].core).forEach((t) => assert.ok(!blob.includes(t), "texto privado en el blob: " + t)));
  const raw = Buffer.from(blob.slice(3), "base64url").toString("latin1");
  Object.keys(pre.tokens).forEach((k) => pre.tokens[k].core.forEach((t) => assert.ok(!raw.includes(t))));
  const R = mkRooms({ t: clk.t + 5000 }); assert.strictEqual((await R.restore(e.code, blob, e.tokens[4])).status, 200);
  audit(R.get(e.code), "post-restauración");
});

test("shutdown: instantánea final enviada ANTES de cerrar los SSE", () => {
  const { createServer } = require("../server/index");
  const app = createServer({ readMs: 0, engineDir: ENGINE_DIR, publicDir: "/nonexistent-public", snapshotKey: KEY, log: quiet });
  const first = app.rooms.create("Ana"), room = app.rooms.get(first.room); room.join("Bea"); room.join("Cai");
  const r0 = fakeRes(); room.connect(room.players[0], r0);
  app.rooms.snapshotAll(); app.rooms.closeAll(); app.server.close();
  assert.ok(lastBlob(r0), "blob recibido");
  assert.ok(r0.writes.findIndex((w) => /event: snapshot/.test(w)) >= 0 && r0.closed, "y después se cerró");
});

/* Fidelidad con estados ricos: bots juegan partidas enteras; cada ~20 comandos se instantanea y restaura (misma hora) y se compara
   el estado completo del motor y la vista de TODOS los jugadores. */
test("fidelidad: estado del motor y vistas idénticos tras instantánea+restauración en muchos puntos de partidas de bots", () => {
  const { Game } = require("../server/game");
  const { seeded } = require("../server/engine_vm");
  const { botStep, mkRng } = require("./helpers/bot");
  let checks = 0;
  [[3, 21, "dark"], [4, 22, "mixed"], [5, 23, "dark"], [6, 24, "mixed"]].forEach(([n, seed, mode]) => {
    const clk = { t: 1.8e12 }, names = ["Ana", "Luis", "Marta", "Pablo", "Eva", "Iker"].slice(0, n);
    const g = new Game(names, { engineDir: ENGINE_DIR, endAt: clk.t + 60 * 60000, now: () => clk.t, rng: seeded(seed), readMs: 0 });
    const rnd = mkRng(seed); let cmds = 0, guard = 0;
    const stateJson = (x) => JSON.stringify(x.S());
    const cmp = () => {
      const snap = JSON.parse(JSON.stringify(g.snapshot()));
      const g2 = Game.restore(snap, { engineDir: ENGINE_DIR, now: () => clk.t, readMs: 0, shift: 0, rng: seeded(99) });
      assert.strictEqual(stateJson(g2), stateJson(g), "estado del motor idéntico (ronda " + g.S().round + " fase " + g.S().phase + ")");
      for (let i = 0; i < n; i++) {
        const a = JSON.parse(JSON.stringify(g.view(i))), b = JSON.parse(JSON.stringify(g2.view(i)));
        [a, b].forEach((v) => { delete v.clock; delete v.serverNow; });
        assert.deepStrictEqual(b, a, "vista de J" + i + " idéntica");
      }
      ["ready", "councilReady", "contReady"].forEach((k) => assert.deepStrictEqual(Array.from(g2[k]).sort(), Array.from(g[k]).sort(), k));
      checks++;
    };
    while (!g.ended() && guard++ < 6000) {
      let did = false;
      for (let pid = 0; pid < n && !g.ended(); pid++) {
        if (botStep(g, pid, rnd, mode, (c, a) => { cmds++; if (cmds % 20 === 0) cmp(); return g.exec(pid, c, a, { isHost: pid === 0 }); })) did = true;
      }
      if (!did) { clk.t += 1000; g.forceAdvance(); }
    }
    assert.ok(g.ended());
  });
  assert.ok(checks > 40, "comprobaciones: " + checks);
});

test("v1.14.1: el identificador del motor no depende del contenido de los archivos (un despliegue de reglas no corta partidas)", () => {
  const fs2 = require("node:fs"), os2 = require("node:os"), path2 = require("node:path");
  const d = fs2.mkdtempSync(path2.join(os2.tmpdir(), "umbral-eng-"));
  ["data.js", "engine.js", "npc.js"].forEach((f) => fs2.writeFileSync(path2.join(d, f), "// " + f + " distinto " + Math.random()));
  const a = makeCodec({ key: KEY, engineDir: ENGINE_DIR, log: quiet }), b = makeCodec({ key: KEY, engineDir: d, log: quiet });
  assert.strictEqual(a.engine, b.engine, "mismo identificador con archivos de motor distintos");
  const blob = a.encode({ schema: a.SCHEMA, engine: a.engine, code: "ABCDE", seq: 1 }, "ABCDE");
  assert.strictEqual(b.decode(blob, "ABCDE").ok, true, "la partida guardada con un motor se restaura con otro compatible");
});
