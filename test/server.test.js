"use strict";
/* F2: servidor real en un puerto libre con clientes Node (http + SSE). */
const test = require("node:test");
const assert = require("node:assert");
const { createServer } = require("../server/index");
const { Client, request } = require("./helpers/netclient");
const { ENGINE_DIR, botStep, mkRng } = require("./helpers/bot");
const L = require("./helpers/leakcheck");

function boot(opts) {
  const app = createServer(Object.assign({ engineDir: ENGINE_DIR, publicDir: "/nonexistent-public" }, opts || {}));
  return new Promise((resolve) => app.server.listen(0, "127.0.0.1", () => resolve(Object.assign(app, { port: app.server.address().port }))));
}
const shut = (app) => new Promise((r) => { app.rooms.closeAll(); app.server.closeAllConnections && app.server.closeAllConnections(); app.server.close(() => r()); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NAMES = ["Ana", "Luis", "Marta", "Pablo", "Eva"];

test("healthz y rutas desconocidas", async () => {
  const app = await boot();
  try {
    const h = await request(app.port, "GET", "/healthz");
    assert.strictEqual(h.status, 200); assert.strictEqual(h.json.ok, true);
    assert.strictEqual(h.headers["access-control-allow-origin"], "*");
    assert.strictEqual((await request(app.port, "GET", "/nada")).status, 404);
    assert.strictEqual((await request(app.port, "OPTIONS", "/cmd")).status, 204);
  } finally { await shut(app); }
});

test("lobby: crear, unirse, nombres, límites y rechazos", async () => {
  const app = await boot();
  try {
    const a = new Client(app.port, "Ana"), b = new Client(app.port, "Luis");
    const r = await a.create();
    assert.ok(/^[A-HJ-NP-Z]{5}$/.test(r.json.room), "código de 5 letras sin I/O: " + r.json.room);
    assert.strictEqual(r.json.token.length, 32);
    assert.ok((await b.join("ZZZZZ")).status === 404);
    assert.strictEqual((await new Client(app.port, "ana").join(a.room)).json.ok, false, "nombre repetido (sin distinguir mayúsculas)");
    assert.strictEqual((await new Client(app.port, "   ").join(a.room)).json.ok, false, "nombre vacío");
    assert.ok((await b.join(a.room.toLowerCase())).json.ok, "el código admite minúsculas");
    await a.connect(); await b.connect();
    await a.until((v) => v.phase === "lobby" && v.players.length === 2);
    await b.until((v) => v.phase === "lobby" && v.players.length === 2);
    assert.strictEqual(a.view.host, true); assert.strictEqual(b.view.host, false);
    assert.strictEqual(a.view.canStart, false);
    /* iniciar: no anfitrión, pocos jugadores, hora inválida */
    assert.strictEqual((await b.start(Date.now() + 30 * 60000)).json.ok, false);
    assert.strictEqual((await a.start(Date.now() + 30 * 60000)).json.msg.includes("al menos 3"), true);
    /* JSON roto, cuerpo enorme, token inválido */
    assert.strictEqual((await request(app.port, "POST", "/api/join", "{no json", null, true)).status, 400);
    assert.strictEqual((await request(app.port, "POST", "/api/join", JSON.stringify({ room: a.room, name: "x".repeat(20000) }), null, true)).status, 413);
    assert.strictEqual((await request(app.port, "POST", "/cmd", { cmd: "act", args: [] }, "0".repeat(32))).status, 401);
    assert.strictEqual((await request(app.port, "POST", "/cmd", { cmd: "act", args: [] })).status, 401);
    assert.strictEqual((await request(app.port, "GET", "/events", undefined, "zz")).status, 401);
    /* nombre largo se recorta a 16; salir del lobby y traspaso de anfitrión */
    const c = new Client(app.port, "NombreMuyLargoDeVerdadSeguro");
    assert.ok((await c.join(a.room)).json.ok);
    await a.until((v) => v.players.length === 3);
    assert.strictEqual(a.view.players[2].name.length, 16);
    await a.leave();
    await b.until((v) => v.players.length === 2 && v.host === true);
    assert.strictEqual(b.view.players[0].name, "Luis");
    assert.strictEqual((await a.cmd("act", [])).ok, false, "el token de quien salió ya no vale");
    [a, b, c].forEach((x) => x.close());
  } finally { await shut(app); }
});

test("partida: inicio, vistas distintas y filtradas, comandos y rechazos", async () => {
  const app = await boot({ cmdPerSec: 100 });
  try {
    const cl = NAMES.slice(0, 4).map((n) => new Client(app.port, n));
    await cl[0].create();
    for (let i = 1; i < 4; i++) assert.ok((await cl[i].join(cl[0].room)).json.ok);
    for (const c of cl) await c.connect();
    await cl[0].until((v) => v.players.length === 4);
    assert.strictEqual((await cl[0].start(Date.now() + 1000)).json.ok, false, "hora de fin demasiado cercana");
    assert.strictEqual((await cl[0].start(Date.now() + 500 * 60000)).json.ok, false, "hora de fin demasiado lejana");
    const st = await cl[0].start(Date.now() + 30 * 60000);
    assert.strictEqual(st.json.ok, true);
    for (const c of cl) await c.until((v) => v.phase === "private");
    assert.strictEqual((await new Client(app.port, "Tarde").join(cl[0].room)).json.ok, false, "no se entra en partida empezada");

    const room = app.rooms.get(cl[0].room), S = room.game.S();
    /* cada cliente ve su propio jugador; vistas distintas */
    cl.forEach((c, i) => { assert.strictEqual(c.view.youId, i); assert.strictEqual(c.view.me.name, NAMES[i]); });
    assert.strictEqual(new Set(cl.map((c) => c.view.me.secret.text + "|" + c.view.me.role.id)).size >= 2, true);
    /* ningún cliente recibe tokens ajenos ni datos sensibles: auditoría con el detector de F1 sobre TODO lo recibido */
    const tokens = cl.map((c) => c.token);
    function audit() {
      cl.forEach((c, i) => {
        c.raw.forEach((r) => { tokens.forEach((t, j) => { if (j !== i) assert.ok(r.indexOf(t) === -1, "token ajeno en la vista de " + c.name); }); assert.ok(r.indexOf(c.token) === -1, "ni el propio token viaja en las vistas"); });
        const probs = L.checkView(room.game, i, c.view); assert.deepStrictEqual(probs, [], c.name + ": " + probs.join(" | "));
      });
    }
    audit();

    /* rechazos: comando desconocido, fuera de fase, argumentos malos, objetivo no válido */
    assert.strictEqual((await cl[1].cmd("hackear", [])).ok, false);
    assert.strictEqual((await cl[1].cmd("councilReady", [])).msg, "Ahora no puedes hacer eso.");
    assert.strictEqual((await cl[1].cmd("continue", [])).msg, "Ahora no puedes hacer eso.");
    assert.strictEqual((await cl[1].cmd("act", [42, "x"])).msg, "Argumentos no válidos.");
    assert.strictEqual((await cl[1].cmd("act", "no-array")).ok, false);
    assert.strictEqual((await cl[1].cmd("finishTurn", [])).ok, false, "no puede entregar sin actuar");
    const r1 = await cl[1].cmd("act", ["robar", 1, null]); /* contra sí mismo */
    assert.strictEqual(r1.ok, false);
    /* un jugador no puede actuar como otro: el token fija el jugador (no hay campo pid en la API) */
    const before = JSON.stringify(S.players[0].acted);
    await cl[1].cmd("act", ["meditar", null, null]);
    assert.strictEqual(JSON.stringify(S.players[0].acted), before);
    assert.strictEqual(S.players[1].acted, true);

    /* ronda completa: todos meditan y entregan -> Consejo -> Continuar -> ronda 2 */
    for (let i = 0; i < 4; i++) { if (i !== 1) assert.ok((await cl[i].cmd("act", ["meditar", null, null])).ok); }
    for (let i = 0; i < 4; i++) { const r = await cl[i].cmd("finishTurn", []); assert.strictEqual(r.ok, true, JSON.stringify(r)); if (i < 3) { await cl[0].until((v) => v.wait.length === 3 - i); } }
    for (const c of cl) await c.until((v) => v.phase === "council");
    for (let i = 0; i < 4; i++) assert.ok((await cl[i].cmd("councilReady", [])).ok);
    for (const c of cl) await c.until((v) => v.phase === "resolution");
    for (let i = 0; i < 4; i++) { const r = await cl[i].cmd("continue", []); assert.ok(r.ok, "continue " + i + ": " + JSON.stringify(r) + " fase " + room.game.phase); }
    for (const c of cl) await c.until((v) => v.phase === "private" && v.round === 2);
    audit();
    /* tras acabar la fase privada ya se ven las notas/crónica retenidas */
    cl.forEach((c) => c.close());
  } finally { await shut(app); }
});

test("partida completa por red con 4 bots hasta el desenlace (vistas auditadas)", async () => {
  const app = await boot({ cmdPerSec: 100 });
  try {
    const n = 4, cl = NAMES.slice(0, n).map((x) => new Client(app.port, x));
    await cl[0].create();
    for (let i = 1; i < n; i++) await cl[i].join(cl[0].room);
    for (const c of cl) await c.connect();
    await cl[0].start(Date.now() + 25 * 60000);
    for (const c of cl) await c.until((v) => v.phase !== "lobby");
    const room = app.rooms.get(cl[0].room), rnd = mkRng(4242);
    let cmds = 0, errs = {}, audits = 0;
    const t0 = Date.now();
    while (cl[0].view.phase !== "ending" && Date.now() - t0 < 90000) {
      let did = false;
      for (let i = 0; i < n; i++) {
        const c = cl[i], queue = [];
        const fake = { view: () => c.view, D: room.game.D, pctx: { [i]: true } };
        const acted = botStep(fake, i, rnd, i === 0 ? "dark" : "good", (cmd, args) => { queue.push([cmd, args]); return { ok: true }; });
        if (!acted) continue;
        for (const [cmd, args] of queue) {
          const r = await c.cmd(cmd, args); cmds++; did = true;
          if (!r.ok) errs[r.msg] = (errs[r.msg] || 0) + 1;
          await sleep(2);
          if (cmds % 9 === 0) { audits++; cl.forEach((cc, j) => { const p = L.checkView(room.game, j, cc.view); assert.deepStrictEqual(p, [], cc.name + ": " + p.join(" | ")); }); }
        }
      }
      if (!did) { await sleep(20); if (Date.now() - t0 > 60000) room.game.forceAdvance(), room.broadcast(); }
    }
    for (const c of cl) await c.until((v) => v.phase === "ending");
    assert.strictEqual(room.status, "ended");
    cl.forEach((c) => { assert.ok(c.view.reveal && c.view.log && c.view.ending); });
    assert.strictEqual(room.game.errors.length, 0, room.game.errors[0]);
    console.log("red: comandos", cmds, "auditorías", audits, "errores de comando (tipos)", Object.keys(errs).length, "rondas", room.game.S().round);
    cl.forEach((c) => c.close());
  } finally { await shut(app); }
});

test("límites: salas máximas, frecuencia, limpieza y aislamiento entre salas", async () => {
  let t = 1e12;
  const app = await boot({ maxRooms: 2, joinPerMin: 100, cmdPerSec: 3, now: () => t, idleMs: 60000, endedMs: 60000 });
  try {
    const a = new Client(app.port, "Ana"), b = new Client(app.port, "Bea"), c = new Client(app.port, "Cai");
    assert.ok((await a.create()).json.ok); assert.ok((await b.create()).json.ok);
    assert.strictEqual((await c.create()).json.ok, false, "máximo de salas");
    assert.notStrictEqual(a.room, b.room);
    /* una sala no ve la otra: el token de A no sirve con el código de B */
    assert.strictEqual(app.rooms.byToken(a.token).room.code, a.room);
    /* frecuencia: 3 por segundo por token */
    let limited = 0; for (let i = 0; i < 8; i++) { const r = await request(app.port, "POST", "/api/ping", {}, a.token); if (r.status === 429) limited++; }
    assert.ok(limited >= 4, "rate limit de comandos: " + limited);
    /* limpieza: sin conexiones y pasado el tiempo */
    t += 61000; assert.strictEqual(app.rooms.sweep(), 2);
    assert.strictEqual(app.rooms.rooms.size, 0);
    assert.strictEqual((await request(app.port, "POST", "/cmd", { cmd: "x" }, a.token)).status, 401, "tokens de salas borradas dejan de valer");
  } finally { await shut(app); }
  /* límite de creaciones por IP */
  const app2 = await boot({ joinPerMin: 3 });
  try { let blocked = 0; for (let i = 0; i < 6; i++) { const r = await new Client(app2.port, "N" + i).create(); if (r.status === 429) blocked++; } assert.strictEqual(blocked, 3); }
  finally { await shut(app2); }
});

test("latido SSE y estáticos sin salir de public/", async () => {
  const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "umb-pub-"));
  fs.writeFileSync(path.join(dir, "index.html"), "<h1>hola</h1>");
  const app = await boot({ publicDir: dir });
  try {
    const r = await request(app.port, "GET", "/"); assert.strictEqual(r.status, 200); assert.ok(r.text.includes("hola"));
    assert.strictEqual((await request(app.port, "GET", "/%2e%2e/%2e%2e/etc/passwd")).status === 200, false);
    assert.strictEqual((await request(app.port, "GET", "/..%2f..%2fetc%2fpasswd")).status === 200, false);
    const a = new Client(app.port, "Ana"); await a.create(); await a.connect();
    app.rooms.heartbeat(); await sleep(30);
    assert.ok(a.hb >= 1, "latido recibido");
    a.close();
  } finally { await shut(app); fs.rmSync(dir, { recursive: true, force: true }); }
});

test("reconexión por token (esqueleto F5): el SSE reabierto recibe la vista completa del mismo jugador", async () => {
  const app = await boot();
  try {
    const cl = NAMES.slice(0, 3).map((n) => new Client(app.port, n));
    await cl[0].create(); await cl[1].join(cl[0].room); await cl[2].join(cl[0].room);
    for (const c of cl) await c.connect();
    await cl[0].start(Date.now() + 20 * 60000);
    for (const c of cl) await c.until((v) => v.phase === "private");
    await cl[1].cmd("act", ["meditar", null, null]);
    await cl[1].until((v) => v.me.acted === true);
    const antes = JSON.stringify(cl[1].view.me.notes) + cl[1].view.round;
    cl[1].close(); await sleep(30);
    await cl[0].until((v) => v.players[1].online === false);
    await cl[1].connect();
    assert.strictEqual(cl[1].view.youId, 1); assert.strictEqual(cl[1].view.me.acted, true);
    assert.strictEqual(JSON.stringify(cl[1].view.me.notes) + cl[1].view.round, antes);
    await cl[0].until((v) => v.players[1].online === true);
    cl.forEach((c) => c.close());
  } finally { await shut(app); }
});
