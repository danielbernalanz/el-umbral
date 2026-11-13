"use strict";
/* F4: /__test/hit?room=ABCDE&pid=0&by=1&mode=stun|down hace que el jugador `by` aturda (o deje moribundo) a `pid` con el flujo real del servidor
   (tirada alta forzada en el contexto de la sala). Nunca se usa en producción.
   Servidor de PRUEBAS para online_e2e.py: el servidor normal + /__test/stun?room=ABCDE&pid=0 (marca al jugador como «sin turno»
   a mitad de la fase privada, como hace aturdir/grillete con el motor). Nunca se usa en producción. */
const { createServer } = require("../../server/index");
const app = createServer({ readMs: 0 });
const main = app.server.listeners("request")[0];
app.server.removeAllListeners("request");
app.server.on("request", (req, res) => {
  if (req.url.startsWith("/__test/stun")) {
    const u = new URL(req.url, "http://x");
    const room = app.rooms.get(u.searchParams.get("room")), pid = Number(u.searchParams.get("pid"));
    if (!room || !room.game) { res.writeHead(404); return res.end("no"); }
    const S = room.game.S(); S.players[pid].acted = true;
    S.chronicle.push({ round: S.round, text: "✖ " + S.players[pid].name + " pierde su turno de esta ronda." });
    room.broadcast(); res.writeHead(200); return res.end("ok");
  }
  if (req.url.startsWith("/__test/hit")) {
    const u = new URL(req.url, "http://x");
    const room = app.rooms.get(u.searchParams.get("room")), pid = Number(u.searchParams.get("pid")), by = Number(u.searchParams.get("by") || 1), mode = u.searchParams.get("mode") || "stun";
    if (!room || !room.game) { res.writeHead(404); return res.end("no"); }
    const g = room.game, S = g.S(), vmrun = require("node:vm").runInContext;
    S.players[by].items.push({ id: mode === "down" ? "daga" : "porra" });
    if (mode === "down") S.players[pid].hp = 1;
    vmrun("globalThis.__rs = Math.random; Math.random = function () { return 0.999; };", g.ctx);
    let r; try { r = g.exec(by, "act", [mode === "down" ? "apunalar" : "aturdir", pid, null]); } finally { vmrun("Math.random = globalThis.__rs;", g.ctx); }
    room.broadcast(); res.writeHead(200); return res.end(JSON.stringify({ ok: r.ok, success: r.success, acted: S.players[pid].acted, dying: S.players[pid].dying, msg: r.msg || "" }));
  }
  if (req.url.startsWith("/__test/endat")) {
    const u = new URL(req.url, "http://x"), room = app.rooms.get(u.searchParams.get("room"));
    if (!room || !room.game) { res.writeHead(404); return res.end("no"); }
    const S = room.game.S();
    S.endAt = Date.now() + Number(u.searchParams.get("secs")) * 1000;
    if (u.searchParams.get("reset") === "1") { S.timeAdd = 0; S.warned = false; }
    room.broadcast(); res.writeHead(200); return res.end("ok");
  }
  main(req, res);
});
app.server.listen(Number(process.env.PORT) || 3000);
