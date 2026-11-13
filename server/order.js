"use strict";
/* Orden de llegada (F4). En el motor, aturdir/grillete sobre quien AÚN NO ha actuado le quitan el turno de esta ronda
   (t.acted = true). En línea todos eligen a la vez, así que eso le quitaría una acción a medio elegir a alguien por ir lento.
   Regla en línea: mientras se ejecuta un comando de `pid`, los demás vivos que aún no han actuado figuran como «ya actuaron»
   (el motor aplica entonces su rama «perderá su próximo turno»: estado aturdido que empieza la ronda SIGUIENTE) y al terminar
   se les devuelve acted=false. Quien cae moribundo sí queda con acted=true (no puede actuar de ningún modo).
   Sin tocar el motor: opera sobre el objeto state. Lo usan server/game.js y las simulaciones --online. */
function shielded(S, pid, fn) {
  const sh = [];
  S.players.forEach((q) => { if (q.id !== pid && !q.dead && !q.dying && !q.acted) { q.acted = true; sh.push(q); } });
  try { return fn(); }
  finally { sh.forEach((q) => { if (!q.dead && !q.dying) q.acted = false; }); }
}
module.exports = { shielded };
