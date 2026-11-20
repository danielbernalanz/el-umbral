/* EL UMBRAL — vibración y ambiente sonoro (v1.13.0)
   Todo es opcional y a prueba de fallos: sin vibración o sin WebAudio no pasa nada.
   Vibración: 0 = apagada, 1 = solo el toque (idéntico) al empezar el turno, 2 = completa (por defecto).
   Sonido: sintetizado con WebAudio (sin archivos). Apagado por defecto; el AudioContext solo se crea tras un gesto del usuario
   y se cierra del todo al apagarlo (sin osciladores vivos) o se suspende al ocultarse la página. */
(function (w) {
  "use strict";
  var K_V = "umbral_vib", K_S = "umbral_snd";
  function rd(k, def) { try { var v = localStorage.getItem(k); return v === null || v === undefined ? def : v; } catch (e) { return def; } }
  function wr(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { /* sin almacenamiento */ } }
  var vib = Number(rd(K_V, "2")); if (!(vib >= 0 && vib <= 2)) vib = 2;
  var snd = rd(K_S, "0") === "1";
  var inGame = false, ctx = null, master = null, bed = null;

  /* ---------- vibración ---------- */
  var PAT = {
    turno: [18],                               /* toque suave: lo recibe TODO el mundo al empezar su turno privado */
    herida: [45, 60, 45],
    moribundo: [60, 90, 60, 420, 60, 90, 60], /* latido */
    oferta: [30, 70, 30, 70, 120],
    ataque: [25, 45, 25, 45, 25]
  };
  function buzz(name) {
    if (!vib || (vib === 1 && name !== "turno")) return false;
    if (typeof document !== "undefined" && document.hidden) return false;
    try { if (navigator && typeof navigator.vibrate === "function" && PAT[name]) return !!navigator.vibrate(PAT[name]); } catch (e) { /* sin vibración */ }
    return false;
  }

  /* ---------- audio ---------- */
  function AC() { return w.AudioContext || w.webkitAudioContext || null; }
  function now() { return ctx ? ctx.currentTime : 0; }
  function env(g, t0, a, peak, dec) { g.gain.cancelScheduledValues(t0); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dec); }
  function tone(type, f0, f1, t0, a, peak, dec, dest) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + a + dec);
    env(g, t0, a, peak, dec);
    o.connect(g); g.connect(dest || master);
    o.start(t0); o.stop(t0 + a + dec + 0.05);
    o.onended = function () { try { o.disconnect(); g.disconnect(); } catch (e) { /* ya suelto */ } };
  }
  function makeBed() {
    /* Viento: ruido marrón en bucle, filtrado y modulado muy despacio; más un zumbido grave casi inaudible. */
    var sr = ctx.sampleRate, len = Math.floor(sr * 3), buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0), last = 0, i;
    for (i = 0; i < len; i++) { var wn = Math.random() * 2 - 1; last = (last + 0.02 * wn) / 1.02; d[i] = last * 3.2; }
    var fade = Math.floor(sr * 0.15);
    for (i = 0; i < fade; i++) { var k = i / fade; d[len - fade + i] = d[len - fade + i] * (1 - k) + d[i] * k; }
    var src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 380; lp.Q.value = 0.7;
    var g = ctx.createGain(); g.gain.value = 0.55;
    var lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.09; lg.gain.value = 170; lfo.connect(lg); lg.connect(lp.frequency);
    var lfo2 = ctx.createOscillator(), lg2 = ctx.createGain(); lfo2.frequency.value = 0.05; lg2.gain.value = 0.22; lfo2.connect(lg2); lg2.connect(g.gain);
    var hum = ctx.createOscillator(), hg = ctx.createGain(); hum.type = "sine"; hum.frequency.value = 54; hg.gain.value = 0.06;
    src.connect(lp); lp.connect(g); g.connect(master); hum.connect(hg); hg.connect(master);
    var t = ctx.currentTime;
    src.start(t); lfo.start(t); lfo2.start(t); hum.start(t);
    return { stop: function () { [src, lfo, lfo2, hum].forEach(function (n) { try { n.stop(); } catch (e) { /* ya parado */ } }); } };
  }
  function startBed() { if (ctx && !bed && snd && inGame) { try { bed = makeBed(); } catch (e) { bed = null; } } }
  function stopBed() { if (bed) { try { bed.stop(); } catch (e) { /* nada */ } bed = null; } }
  function open() {
    if (ctx) { try { if (ctx.state === "suspended") ctx.resume(); } catch (e) { /* nada */ } return true; }
    var C = AC(); if (!C) return false;
    try {
      ctx = new C();
      master = ctx.createGain(); master.gain.value = 0.32; master.connect(ctx.destination);
      if (ctx.state === "suspended") ctx.resume();
      return true;
    } catch (e) { ctx = null; master = null; return false; }
  }
  function shut() {
    stopBed();
    var c = ctx; ctx = null; master = null;
    if (c) { try { c.close(); } catch (e) { /* nada */ } }
  }
  /* Llamar desde un gesto del usuario (clic/toque): crea o reanuda el contexto y arranca el ambiente si procede. */
  function unlock() { if (!snd) return; if (open()) startBed(); }
  function cue(name) {
    if (!snd || !ctx || !master || ctx.state !== "running" || (typeof document !== "undefined" && document.hidden)) return;
    try {
      var t = now() + 0.02, i;
      if (name === "campana") {
        [[196, 0.5, 3.4], [196 * 2.76, 0.22, 2.2], [196 * 5.4, 0.1, 1.2], [196 * 2, 0.25, 2.8]].forEach(function (p) { tone("sine", p[0], 0, t, 0.01, p[1], p[2]); });
      } else if (name === "latido") {
        for (i = 0; i < 3; i++) { tone("sine", 70, 42, t + i * 0.95, 0.02, 0.9, 0.22); tone("sine", 62, 38, t + i * 0.95 + 0.24, 0.02, 0.6, 0.2); }
      } else if (name === "desenlace") {
        tone("sine", 110, 55, t, 0.15, 0.7, 4.2); tone("triangle", 55, 41, t, 0.3, 0.35, 4.6);
      }
    } catch (e) { /* nunca romper el juego por el sonido */ }
  }

  w.UmbralFX = {
    vibrate: buzz,
    /* Las animaciones de la interfaz (ui.js) solo se encienden si el sistema no pide reducir el movimiento. */
    motion: function () { try { return !(w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return true; } },
    cue: cue,
    unlock: unlock,
    /* Entra/sale de la partida: el viento solo suena durante la partida. */
    game: function (on) { inGame = !!on; if (!inGame) stopBed(); else if (snd && ctx) startBed(); },
    vibMode: function () { return vib; },
    cycleVib: function () { vib = (vib + 2) % 3; wr(K_V, vib); return vib; },   /* 2 → 1 → 0 → 2 */
    soundOn: function () { return snd; },
    setSound: function (on) {
      snd = !!on; wr(K_S, snd ? "1" : "0");
      if (snd) { if (open()) startBed(); else snd = false; } else shut();
      return snd;
    },
    supportsSound: function () { return !!AC(); }
  };

  /* Pausa al ocultarse la página; reanuda al volver. */
  try {
    document.addEventListener("visibilitychange", function () {
      if (!ctx) return;
      try { if (document.hidden) ctx.suspend(); else if (snd) ctx.resume(); } catch (e) { /* nada */ }
    });
    /* Política de autoplay: el primer toque tras abrir la app crea/reanuda el audio si el usuario lo dejó activado. */
    document.addEventListener("pointerdown", function () { if (snd && (!ctx || ctx.state === "suspended")) unlock(); }, true);
  } catch (e) { /* sin DOM */ }
})(window);
