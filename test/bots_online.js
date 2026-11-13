"use strict";
/* CLI F6: node test/bots_online.js [jugadores=4,6,8,10] [semillas=3] [mins=12] [churn=0.01] */
const { playOnline } = require("./helpers/netbots");
(async () => {
  const ns = (process.argv[2] || "4,6,8,10").split(",").map(Number), seeds = Number(process.argv[3] || 3), mins = Number(process.argv[4] || 12), churn = Number(process.argv[5] || 0.01);
  const accels = (process.argv[6] || "60,250,800,250").split(",").map(Number);
  let bad = 0;
  for (const n of ns) for (let s = 1; s <= seeds; s++) {
    const r = await playOnline({ n, seed: s, mins, churn, accel: accels[(s - 1) % accels.length] });
    const ok = r.ended && r.hasEnding && !r.errors.length && !r.leaks.length;
    if (!ok) bad++;
    console.log((ok ? "OK  " : "FAIL") + " n=" + n + " seed=" + s + " accel=" + accels[(s - 1) % accels.length] + " rondas=" + r.rounds + " ms=" + r.ms + " preguntaTiempo=" + r.timeAsks + " desc/recon=" + r.disc + "/" + r.recon + (r.errors.length ? " ERR=" + JSON.stringify(r.errors.slice(0, 3)) : "") + (r.leaks.length ? " LEAKS=" + JSON.stringify(r.leaks.slice(0, 3)) : ""));
  }
  console.log(bad ? bad + " FALLOS" : "TODO OK"); process.exit(bad ? 1 : 0);
})();
