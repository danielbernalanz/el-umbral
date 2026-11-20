/* EL UMBRAL — reto de habilidad único («Pulso en la zona clara»). Módulo compartido cliente/servidor (UMD, sin dependencias).
   Es DETERMINISTA: a partir de una semilla fija la aguja y la zona objetivo; con la traza de toques (ms desde el inicio) se
   recalcula la puntuación. Así el servidor puede validar el resultado sin fiarse del cliente.
   Mismo reto, misma ventana y misma forma para TODAS las acciones y jugadores. Omitir = bonus 0 (probabilidad base). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.UmbralSkill = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const CFG = { windowMs: 8000, graceMs: 1500, taps: 2, minGapMs: 120, floor: -6, ceil: 15, width: 0.3 };

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /* Plan del reto: periodo y fase de la aguja (triángulo 0..1) y centro de la zona clara de cada toque. */
  function plan(seed) {
    const r = rng(seed), P = [];
    const period = 1300 + Math.floor(r() * 500), phase = r();
    for (let i = 0; i < CFG.taps; i++) P.push(0.2 + r() * 0.6);
    return { period: period, phase: phase, centers: P };
  }
  function pos(pl, t) {
    const x = ((t / pl.period) + pl.phase) % 1;
    return 1 - Math.abs(2 * x - 1);
  }
  /* Puntuación 0..1 de una traza (lista de ms). Devuelve null si la traza no es plausible. */
  function score(seed, taps) {
    if (!Array.isArray(taps) || taps.length !== CFG.taps) return null;
    for (let i = 0; i < taps.length; i++) if (!Number.isFinite(taps[i]) || taps[i] < 0 || taps[i] > CFG.windowMs) return null;
    if (taps[0] < CFG.minGapMs) return null;
    for (let i = 1; i < taps.length; i++) if (taps[i] - taps[i - 1] < CFG.minGapMs) return null;
    const pl = plan(seed >>> 0);
    let s = 0;
    for (let i = 0; i < taps.length; i++) s += Math.max(0, 1 - Math.abs(pos(pl, taps[i]) - pl.centers[i]) / CFG.width);
    return s / taps.length;
  }
  /* Bonus en puntos porcentuales: de floor (fallo total) a ceil (perfecto); entero. */
  function delta(s) {
    if (typeof s !== "number" || !(s >= 0)) return 0;
    return Math.round(CFG.floor + (CFG.ceil - CFG.floor) * Math.min(1, s));
  }
  function clampDelta(d) { d = Math.round(Number(d)); return Number.isFinite(d) ? Math.max(CFG.floor, Math.min(CFG.ceil, d)) : 0; }
  return { CFG: CFG, plan: plan, pos: pos, score: score, delta: delta, clampDelta: clampDelta };
});
