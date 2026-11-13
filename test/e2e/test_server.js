"use strict";
/* Servidor de PRUEBAS para online_e2e.py: el servidor normal + /__test/stun?room=ABCDE&pid=0 (marca al jugador como «sin turno»
   a mitad de la fase privada, como hace aturdir/grillete con el motor). Nunca se usa en producción. */
const { createServer } = require("../../server/index");
const app = createServer({});
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
  main(req, res);
});
app.server.listen(Number(process.env.PORT) || 3000);
