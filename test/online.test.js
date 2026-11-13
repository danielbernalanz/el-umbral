"use strict";
/* F4: simultaneidad, reloj del servidor (autoturno, desconexión acelerada), votación de tiempo, aturdir a ronda siguiente,
   10 s de lectura y no-fuga con el nuevo flujo. Reloj inyectable (now) para no esperar tiempos reales. */
const test = require("node:test");
const assert = require("node:assert");
const { Game } = require("../server/game");
const { seeded } = require("../server/engine_vm");
const { createServer } = require("../server/index");
const { Client } = require("./helpers/netclient");
const { ENGINE_DIR, botStep, mkRng } = require("./helpers/bot");
const L = require("./helpers/leakcheck");

const NAMES = ["Ana", "Luis", "Marta", "Pablo", "Eva", "Iker"];
function mk(n, seed, o) {
  const clk = { t: 1.8e12 };
  const game = new Game(NAMES.slice(0, n), Object.assign({ engineDir: ENGINE_DIR, endAt: clk.t + 40 * 60000, now: () => clk.t, rng: seeded(seed || 1), readMs: 0 }, o || {}));
  return { game, clk, S: game.S() };
}
const ALL = (g) => g.S().players.map((p) => p.id);

test("barrera simultánea: 4 clientes de red actúan a la vez, la fase solo cierra cuando todos terminan", async () => {
  const app = createServer({ engineDir: ENGINE_DIR, publicDir: "/nonexistent-public", readMs: 0 });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const port = app.server.address().port;
  try {
    const cs = NAMES.slice(0, 4).map((n) => new Client(port, n));
    await cs[0].create(); for (let i = 1; i < 4; i++) await cs[i].join(cs[0].room);
    for (const c of cs) await c.connect();
    assert.ok((await cs[0].start(Date.now() + 30 * 60000)).json.ok);
    for (const c of cs) await c.until((v) => v.phase === "private");
    /* los 4 mandan su acción a la vez (en paralelo) */
    const rs = await Promise.all(cs.map((c) => c.cmd("act", ["meditar", null, null])));
    rs.forEach((r) => assert.strictEqual(r.ok, true, JSON.stringify(r)));
    /* tres entregan: el Consejo no se abre y wait lista al que falta */
    await Promise.all(cs.slice(0, 3).map((c) => c.cmd("finishTurn", [])));
    await cs[0].until((v) => v.waitN === 1);
    assert.strictEqual(cs[0].view.phase, "private");
    assert.deepStrictEqual(cs[0].view.wait, [], "fase privada: no se nombra a quien falta");
    assert.strictEqual(cs[0].view.waitN, 1);
    assert.strictEqual(cs[0].view.players[0].ready, true, "el propio «listo» sí");
    assert.strictEqual(cs[0].view.players[1].ready, false, "el «listo» ajeno no se ve en la fase privada");
    assert.strictEqual(cs[3].view.waitN, 1);
    assert.ok(cs[0].view.clock && cs[0].view.clock.kind === "turn" && cs[0].view.clock.deadline > cs[0].view.serverNow, "el reloj de turno lo da el servidor");
    assert.ok(Object.keys(cs[0].view.clock).every((k) => ["kind", "start", "readUntil", "warnAt", "deadline", "autoAt"].indexOf(k) !== -1));
    await cs[3].cmd("finishTurn", []);
    for (const c of cs) await c.until((v) => v.phase === "council");
    /* Consejo y continuar */
    await Promise.all(cs.map((c) => c.cmd("councilReady", [])));
    for (const c of cs) await c.until((v) => v.phase === "resolution");
    await Promise.all(cs.map((c) => c.cmd("continue", [])));
    for (const c of cs) await c.until((v) => v.phase === "private" && v.round === 2);
    cs.forEach((c) => c.close());
  } finally { app.rooms.closeAll(); app.server.closeAllConnections && app.server.closeAllConnections(); await new Promise((r) => app.server.close(r)); }
});

test("autoturno del servidor: aviso a -15 s, a 0 s + 25 s completa lo que falta sin perder lo hecho", () => {
  const { game, clk, S } = mk(3, 5);
  const ck = game.clock;
  assert.strictEqual(ck.kind, "turn");
  assert.strictEqual(ck.deadline - ck.start, game.U.turnSeconds() * 1000);
  assert.strictEqual(ck.deadline - ck.warnAt, 15000);
  assert.strictEqual(ck.autoAt - ck.deadline, 25000);
  /* Ana elige «investigar» (con objetivo) y no entrega; Luis entrega; Marta no hace nada */
  assert.strictEqual(game.exec(0, "act", ["investigar", 1, null]).ok, true);
  const aAct = S.players[0].action;
  assert.ok(S.players[0].acted && aAct, "Ana ya había actuado");
  game.exec(1, "act", ["meditar", null, null]); game.exec(1, "finishTurn", []);
  clk.t = ck.deadline - 1000; assert.strictEqual(game.tick(), false);
  clk.t = ck.deadline + 24000; assert.strictEqual(game.tick(), false); assert.strictEqual(S.phase, "private", "dentro de la cortesía no se toca nada");
  clk.t = ck.autoAt + 1; assert.strictEqual(game.tick(), true);
  assert.strictEqual(S.phase, "council", "la barrera se cierra sola");
  assert.strictEqual(S.players[0].action, aAct, "lo ya elegido se conserva");
  assert.strictEqual(S.players[2].action, "meditar", "quien no hizo nada medita");
  assert.ok(S.players[2].notes.some((n) => /se acabó el tiempo/.test(n)));
  assert.strictEqual(game.errors.length, 0);
  assert.ok(game.clock && game.clock.kind === "council" && game.clock.deadline > clk.t);
});

test("Consejo y continuar tienen límite de tiempo (forceAdvance por reloj)", () => {
  const { game, clk, S } = mk(3, 6);
  game.forceAdvance(); assert.strictEqual(S.phase, "council");
  const cl = game.clock; assert.strictEqual(cl.deadline - cl.start, game.U.councilSeconds() * 1000);
  assert.ok(cl.deadline - cl.start <= 180000);
  game.councilReady.add(0);
  clk.t = cl.deadline - 1; assert.strictEqual(game.tick(), false);
  clk.t = cl.deadline; assert.strictEqual(game.tick(), true);
  assert.strictEqual(S.phase, "resolution"); assert.strictEqual(game.clock.kind, "cont");
  assert.strictEqual(game.clock.deadline - game.clock.start, 30000);
  clk.t = game.clock.deadline + 1; game.tick();
  assert.strictEqual(S.phase, "private"); assert.strictEqual(S.round, 2);
  assert.strictEqual(game.clock.kind, "turn", "ronda nueva = reloj de turno nuevo");
});

test("desconexión acelerada: si solo faltan desconectados el autoturno se adelanta a ~10 s", () => {
  const { game, clk, S } = mk(4, 7);
  const ck = game.clock;
  game.setPresence({ 0: true, 1: true, 2: true, 3: false }, 0);
  [0, 1, 2].forEach((i) => { game.exec(i, "act", ["meditar", null, null]); game.exec(i, "finishTurn", []); });
  assert.strictEqual(S.phase, "private");
  clk.t += 9000; assert.strictEqual(game.tick(), false); assert.strictEqual(S.phase, "private");
  clk.t += 2000; assert.strictEqual(game.tick(), true);
  assert.strictEqual(S.phase, "council", "tras 10 s el desconectado se completa (<< límite de turno)");
  assert.ok(clk.t < ck.deadline);
  /* si el que falta está conectado, NO se adelanta */
  const m = mk(4, 8); m.game.setPresence({ 0: true, 1: true, 2: true, 3: true }, 0);
  [0, 1, 2].forEach((i) => { m.game.exec(i, "act", ["meditar", null, null]); m.game.exec(i, "finishTurn", []); });
  m.clk.t += 60000; m.game.tick(); assert.strictEqual(m.game.S().phase, "private");
  /* si no hay nadie conectado tampoco se acelera */
  const z = mk(3, 9); z.game.setPresence({ 0: false, 1: false, 2: false }, 0); z.clk.t += 60000; z.game.tick(); assert.strictEqual(z.game.S().phase, "private");
});

function toTimeAsk(seed, n) {
  const m = mk(n, seed);
  m.game.forceAdvance(); m.game.forceAdvance();                 /* privado -> consejo -> resolución */
  assert.strictEqual(m.game.S().phase, "resolution");
  m.clk.t = m.game.S().endAt + 1000;                             /* el tiempo se agota durante la ronda */
  m.game.S().players.forEach((p) => m.game.contReady.add(p.id)); m.game.advance();
  assert.ok(m.game.S().timeAsk, "se abre la pregunta de tiempo");
  return m;
}
test("votación de tiempo: mayoría a los 30 s, empate = +1 ronda, sin votos = +1", () => {
  let m = toTimeAsk(11, 4);
  assert.strictEqual(m.game.clock.kind, "vote"); assert.strictEqual(m.game.clock.deadline - m.game.clock.start, 30000);
  assert.strictEqual(m.game.exec(1, "vote", ["end"]).ok, true); m.game.exec(2, "vote", ["end"]); m.game.exec(3, "vote", [2]);
  assert.deepStrictEqual(m.game.view(1).votes, { 1: "end", 2: "end", 3: 2 }, "votos visibles");
  assert.ok(m.game.S().timeAsk, "los no anfitriones no deciden");
  m.clk.t += 29000; m.game.tick(); assert.ok(m.game.S().timeAsk);
  m.clk.t += 1500; m.game.tick();
  assert.strictEqual(m.game.S().phase, "ending"); assert.strictEqual(m.game.S().ending.tableEnded, true);
  /* empate 1-1-1 -> +1 ronda */
  m = toTimeAsk(12, 4); const r0 = m.game.S().round;
  m.game.exec(1, "vote", [1]); m.game.exec(2, "vote", [2]); m.game.exec(3, "vote", ["end"]);
  m.clk.t += 31000; m.game.tick();
  assert.strictEqual(m.game.S().phase, "private"); assert.strictEqual(m.game.S().round, r0 + 1); assert.strictEqual(m.game.U.maxRounds(), r0 + 1);
  /* sin votos -> +1; la mayoría 2 -> +2 rondas */
  m = toTimeAsk(13, 3); const r1 = m.game.S().round; m.clk.t += 31000; m.game.tick();
  assert.strictEqual(m.game.U.maxRounds(), r1 + 1);
  m = toTimeAsk(14, 4); const r2 = m.game.S().round; m.game.exec(1, "vote", [2]); m.game.exec(2, "vote", [2]); m.game.exec(3, "vote", [1]);
  m.clk.t += 31000; m.game.tick(); assert.strictEqual(m.game.U.maxRounds(), r2 + 2);
});
test("votación de tiempo: el anfitrión decide al votar; endAt se desplaza como en local; los muertos no votan", () => {
  const m = toTimeAsk(15, 4); const end0 = m.game.S().endAt, r = m.game.S().round;
  const est = m.game.U.extEnd(2);
  assert.strictEqual(m.game.exec(1, "vote", [1]).ok, true);
  const res = m.game.exec(0, "vote", [2]);
  assert.strictEqual(res.ok, true); assert.strictEqual(res.added, 2);
  assert.strictEqual(m.game.U.maxRounds(), r + 2); assert.strictEqual(m.game.S().phase, "private");
  assert.ok(m.game.S().endAt > end0, "el reloj se amplía"); assert.ok(Math.abs(m.game.S().endAt - est) < 2000, "coincide con la hora estimada mostrada");
  /* anfitrión «terminar ahora» */
  const n = toTimeAsk(16, 3); const e = n.game.exec(0, "vote", ["end"]); assert.strictEqual(e.ended, true); assert.strictEqual(n.game.S().phase, "ending");
  /* muerto no vota; si el anfitrión cae decide el primer superviviente */
  const d = toTimeAsk(17, 4); d.game.S().players[0].dead = true;
  assert.strictEqual(d.game.exec(0, "vote", [1]).ok, false);
  assert.strictEqual(d.game.decider(), 1);
});
test("«Añadir tiempo» del aviso: solo anfitrión, endAt cambia y la ronda extra se añade al cerrar", () => {
  const m = mk(3, 21); const S = m.game.S(), end0 = S.endAt;
  assert.strictEqual(m.game.exec(1, "addTime", []).ok, false);
  m.clk.t = end0 - 90000; m.game.tick(); assert.strictEqual(m.game.U.timeWarn(), true, "aviso común a los 2 min");
  assert.strictEqual(m.game.view(2).q.timeWarn, true);
  const r = m.game.exec(0, "addTime", []); assert.strictEqual(r.ok, true); assert.strictEqual(r.added, true);
  assert.ok(S.endAt > end0); assert.strictEqual(m.game.view(1).timeAdd, true);
  assert.strictEqual(m.game.exec(0, "addTime", []).added, false, "una sola vez");
});

test("aturdir a quien aún no ha actuado cuenta para la ronda SIGUIENTE (nadie pierde una acción a medio elegir)", () => {
  let done = 0;
  for (let seed = 1; seed <= 40 && done < 3; seed++) {
    const { game, S } = mk(4, seed);
    S.players[0].items.push({ id: "porra" });
    if (!(game.view(0).q.targets.aturdir || []).includes(1)) continue;
    const r = game.exec(0, "act", ["aturdir", 1, null]);
    if (!r.ok || !r.success) continue;
    done++;
    const p1 = S.players[1];
    assert.strictEqual(p1.acted, false, "B sigue pudiendo elegir ahora");
    assert.ok(p1.status.some((s) => s.id === "aturdido"));
    assert.strictEqual(game.ready.has(1), false);
    assert.ok(game.view(1).q.actions.main.length > 0 && game.view(1).me.acted === false);
    assert.strictEqual(game.exec(1, "act", ["meditar", null, null]).ok, true, "B actúa normalmente esta ronda");
    [0, 1, 2, 3].forEach((i) => { if (!game.ready.has(i)) { game.exec(i, "act", ["meditar", null, null]); game.exec(i, "finishTurn", []); } });
    game.exec(1, "finishTurn", []);
    game.forceAdvance(); game.forceAdvance();
    S.players.forEach((p) => game.contReady.add(p.id)); game.advance();
    assert.strictEqual(S.round, 2);
    assert.strictEqual(S.players[1].acted, true, "en la ronda siguiente B pierde su turno");
    assert.ok(game.ready.has(1) && (S.skipped || []).indexOf(1) !== -1);
    assert.strictEqual(game.view(1).me.acted, true);
  }
  assert.ok(done >= 1, "al menos un aturdimiento logrado en las semillas probadas");
});

test("caer moribundo a mitad de ronda cierra el turno en el servidor (sin quedarse esperando)", () => {
  let found = 0;
  for (let seed = 1; seed <= 60 && !found; seed++) {
    const { game, S } = mk(3, seed);
    S.players[0].items.push({ id: "daga" });
    S.players[1].hp = 1;
    if (!(game.view(0).q.targets.apunalar || []).includes(1)) continue;
    game.exec(0, "act", ["apunalar", 1, null]);
    if (!S.players[1].dying) continue;
    found++;
    assert.ok(game.ready.has(1), "el moribundo queda listo (acted=true sin elegir lo cierra el servidor)");
    game.exec(0, "finishTurn", []); game.exec(2, "act", ["meditar", null, null]); game.exec(2, "finishTurn", []);
    assert.strictEqual(S.phase, "council", "la barrera no espera al moribundo");
  }
  assert.ok(found, "un moribundo provocado");
});

test("10 s de lectura: no se puede actuar sobre otros al empezar la ronda, sí sobre uno mismo", () => {
  const { game, clk, S } = mk(3, 31, { readMs: 10000 });
  S.players[0].items.push({ id: "porra" });
  assert.strictEqual(game.clock.readUntil - game.clock.start, 10000);
  const r = game.exec(0, "act", ["aturdir", 1, null]);
  assert.strictEqual(r.ok, false); assert.ok(/leyendo/.test(r.msg));
  assert.strictEqual(S.players[0].acted, false);
  clk.t += 10001;
  assert.strictEqual(game.exec(0, "act", ["aturdir", 1, null]).ok, true);
  const b = mk(3, 31, { readMs: 10000 });
  assert.strictEqual(b.game.exec(1, "act", ["meditar", null, null]).ok, true, "acciones sin objetivo no esperan");
});

test("orden de llegada: el que llega antes se resuelve antes (defensa llegada tarde no cubre un ataque anterior)", () => {
  /* Ana ataca a Luis y luego Luis se protege: la protección de Luis ya no evita el golpe anterior; el estado final lo refleja */
  const { game, S } = mk(3, 41);
  S.players[0].items.push({ id: "daga" });
  const hp0 = S.players[1].hp;
  game.exec(0, "act", ["apunalar", 1, null]);
  const afterHit = S.players[1].hp;
  game.exec(1, "act", ["proteger", 2, null]);
  assert.ok(S.players[1].hp === afterHit && afterHit <= hp0, "la protección posterior no deshace el golpe");
});

test("NO-FUGA con el flujo nuevo: autoturno, desconexión, votación y vistas auditadas en cada tick", () => {
  const problems = [];
  let games = 0, autos = 0, votes = 0;
  for (let g = 0; g < 6; g++) {
    const n = [3, 4, 5][g % 3], seed = 900 + g;
    const clk = { t: 1.9e12 };
    const game = new Game(NAMES.slice(0, n), { engineDir: ENGINE_DIR, endAt: clk.t + (g < 3 ? 6 : 25) * 60000, now: () => clk.t, rng: seeded(seed * 31), readMs: 10000 });
    const rnd = mkRng(seed), slow = new Set([g % n]);
    const audit = (tag) => { const pre = L.prepare(game); for (let pid = 0; pid < n; pid++) L.checkView(game, pid, game.view(pid), pre).forEach((p) => problems.push("[g" + g + " " + tag + "] " + p)); };
    let guard = 0;
    while (!game.ended() && guard++ < 4000) {
      /* los lentos no juegan; los demás actúan en orden aleatorio; el reloj avanza 3 s por paso */
      const order = Array.from({ length: n }, (_, i) => i).sort(() => rnd() - 0.5);
      for (const pid of order) {
        if (game.ended()) break;
        if (slow.has(pid) && game.S().phase === "private") continue;
        botStep(game, pid, rnd, "mixed", (cmd, args) => { const r = game.exec(pid, cmd, args, {}); (game.ended() ? [] : L.checkResult(game, pid, r)).forEach((p) => problems.push("[g" + g + " res] " + p)); if (cmd === "vote") votes++; return r; });
      }
      audit("paso");
      clk.t += g < 3 ? 100000 : 3000;
      if (g % 2) game.setPresence(Object.assign({}, ...Array.from({ length: n }, (_, i) => ({ [i]: !(slow.has(i) && guard % 7 < 5) }))), 0);
      const before = game.S().round + game.S().phase;
      if (game.tick() && game.S().phase !== "ending") autos++;
      audit("tick:" + before);
    }
    assert.ok(game.ended(), "la partida " + g + " termina");
    assert.strictEqual(game.errors.length, 0, game.errors[0]);
    games++;
  }
  assert.ok(autos > 0, "el reloj del servidor intervino");
  console.log("leak F4:", JSON.stringify({ games, autos, votes }));
  const uniq = Array.from(new Set(problems.map((p) => p.replace(/\[g\d+ /, "[g "))));
  assert.strictEqual(problems.length, 0, problems.length + " problemas:\n" + uniq.slice(0, 20).join("\n"));
});
