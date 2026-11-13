import sys
W = "/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/"
def rep(f, old, new, count=1):
    p = W + f
    s = open(p, encoding="utf-8").read()
    n = s.count(old)
    if n != count: sys.exit("FAIL %s count=%d :: %r" % (f, n, old[:90]))
    open(p, "w", encoding="utf-8").write(s.replace(old, new))

# ================= engine.js =================
rep("engine.js", "  const MAX_STAT = 6;", '''  const MAX_STAT = 6;
  const DEFAULT_MINUTES = 20, MIN_MINUTES = 5, MAX_MINUTES = 120, ROUNDS_CAP = 14;''')

rep("engine.js", "  function hasStatus(p, id) {", '''  /* ---------- duración de la partida ---------- */
  /* Minutos estimados por ronda: ~2,5 con 3 jugadores. Se corrige con el ritmo real. */
  function perRoundMin(n) { return 1 + 0.5 * n; }
  function maxRounds() { return (state && state.maxRounds) || MAX_ROUNDS; }
  /* A partir de esta ronda empieza la "fase tardía" (antes: la ronda 3 de 7). */
  function lateRound() { return Math.max(2, Math.round(maxRounds() * 3 / 7)); }
  function playedMs() { return state ? (state.playedMs !== undefined ? state.playedMs : Date.now() - state.createdAt) : 0; }
  function timeLeftMs() { return state && state.durationMin ? state.durationMin * 60000 - playedMs() : Infinity; }
  /* Solo cuenta el tiempo de juego activo, no el de la partida guardada. */
  function tick(ms) {
    if (!state || state.phase === "ending") return;
    if (state.playedMs === undefined) state.playedMs = Date.now() - state.createdAt;
    state.playedMs += clamp(ms, 0, 5000);
  }
  function roundsLeftInclCurrent() { return Math.max(1, maxRounds() - state.round + 1); }
  /* Reparte el tiempo que queda entre las rondas que caben, según el ritmo medido. */
  function planRounds(fresh) {
    if (!state || !state.durationMin) return;
    const est = perRoundMin(state.players.length);
    if (fresh) { state.maxRounds = clamp(Math.round(state.durationMin / est), 3, ROUNDS_CAP); return; }
    const done = state.round;
    const measured = playedMs() / 60000 / Math.max(1, done);
    const per = (est + measured * done) / (1 + done);
    const left = Math.floor(Math.max(0, timeLeftMs()) / 60000 / per);
    state.maxRounds = clamp(done + left, done, Math.max(done, ROUNDS_CAP));
  }
  function behindSchedule() {
    if (!state || !state.durationMin) return false;
    return Math.max(0, timeLeftMs()) / 60000 / roundsLeftInclCurrent() < perRoundMin(state.players.length) * 0.75;
  }
  function councilSeconds() {
    if (!state || !state.durationMin) return COUNCIL_SECONDS;
    const budget = Math.max(0, timeLeftMs()) / 60000 / roundsLeftInclCurrent();
    return clamp(Math.round(budget * 60 * 0.4), 40, 180);
  }
  function hasStatus(p, id) {''')

rep("engine.js", "  function createGame(names) {", "  function createGame(names, opts) {")
rep("engine.js", "    const roles = shuffle(D.ROLES).slice(0, names.length);",
    "    const minutes = clamp(Math.round((opts && opts.minutes) || DEFAULT_MINUTES), MIN_MINUTES, MAX_MINUTES);\n    const roles = shuffle(D.ROLES).slice(0, names.length);")
rep("engine.js", "      createdAt: Date.now()\n    };", "      createdAt: Date.now(), durationMin: minutes, playedMs: 0\n    };\n    planRounds(true);")

rep("engine.js", "Math.ceil(round * D.EVENTS.length / MAX_ROUNDS)", "Math.ceil(round * D.EVENTS.length / maxRounds())")
rep("engine.js", "(state.round >= 4 ? 4 : 3)", "(state.round > lateRound() ? 4 : 3)")
rep("engine.js", "if (state.round < 3 || assassinsOf().length) return;", "if (state.round < lateRound() || assassinsOf().length) return;")
rep("engine.js", 'state.round >= MAX_ROUNDS) return err("En la última ronda', 'state.round >= maxRounds()) return err("En la última ronda')
rep("engine.js", "const finalRound = state.round >= MAX_ROUNDS;", "const finalRound = state.round >= maxRounds();")
rep("engine.js", "    if (state.round >= 3) {", "    if (state.round >= lateRound()) {")
rep("engine.js", "    state.lastResolution = out;", "    planRounds(false);\n    state.lastResolution = out;")
rep("engine.js", "    if (!state) return null;\n    if (state.phase === \"ending\" || state.round >= MAX_ROUNDS ||", "    if (!state) return null;\n    planRounds(false);\n    if (state.phase === \"ending\" || state.round >= maxRounds() ||")
rep("engine.js", '    if (checkTerminal()) return "ending";',
'''    if (checkTerminal()) return "ending";
    /* Si la partida se pasa un 25 % del tiempo, el amanecer la corta. */
    if (state.durationMin && timeLeftMs() < -0.25 * state.durationMin * 60000) {
      state.phase = "ending"; state.ending = computeEnding(); save(); return "ending";
    }''')
rep("engine.js", "durationMin: Math.max(1, Math.round((Date.now() - state.createdAt) / 60000)),",
    "durationMin: Math.max(1, Math.round(playedMs() / 60000)), plannedMin: state.durationMin || null,")
rep("engine.js", "elapsedMin: function () { return state ? Math.floor((Date.now() - state.createdAt) / 60000) : 0; }",
    "elapsedMin: function () { return state ? Math.floor(playedMs() / 60000) : 0; },\n    maxRounds: maxRounds, tick: tick, timeLeftMs: timeLeftMs, councilSeconds: councilSeconds, behindSchedule: behindSchedule")

# ================= ui.js =================
rep("ui.js", "      U.createGame(names);", '      U.createGame(names, { minutes: Number($("gameMinutes").value) || 20 });')
rep("ui.js", "    setInterval(updateClock, 15000);",
    "    let lastTick = Date.now();\n    setInterval(function () { const now = Date.now(); U.tick(now - lastTick); lastTick = now; updateClock(); }, 1000);")
rep("ui.js", '''    $("clockPill").textContent = (s && s.phase !== "ending") ? (U.elapsedMin() + " min") : "0 min";''',
'''    if (!s || s.phase === "ending") { $("clockPill").textContent = "0 min"; return; }
    const left = U.timeLeftMs();
    if (left === Infinity) { $("clockPill").textContent = U.elapsedMin() + " min"; return; }
    const sec = Math.max(0, Math.ceil(left / 1000));
    $("clockPill").textContent = left <= 0 ? "Tiempo agotado" : pad2(Math.floor(sec / 60)) + ":" + pad2(sec % 60);''')
rep("ui.js", '"RONDA " + s.round + "/" + U.MAX_ROUNDS', '"RONDA " + s.round + "/" + U.maxRounds()')
rep("ui.js", 's.round >= U.MAX_ROUNDS ? "Ver el desenlace" : "Siguiente ronda"', 's.round >= U.maxRounds() ? "Ver el desenlace" : "Siguiente ronda"')
rep("ui.js", "    seconds = U.COUNCIL_SECONDS;\n    clearInterval(timerId);", "    seconds = U.councilSeconds();\n    clearInterval(timerId);")
rep("ui.js", '        $("timer").classList.add("timeup");\n      }\n    }, 1000);', '        $("timer").classList.add("timeup");\n        if (U.behindSchedule()) onEndCouncil();\n      }\n    }, 1000);')
rep("ui.js", '''      ? "El tiempo del Consejo ha terminado. Cerradlo cuando queráis."''',
    '''      ? "El tiempo del Consejo ha terminado. Cerradlo cuando queráis."
      : U.behindSchedule() ? "Vamos justos de tiempo: el Consejo se cerrará solo al llegar a cero."''')
rep("ui.js", '"Duración: " + e.durationMin + " min · Corrupción media: "', '"Duración: " + e.durationMin + " min" + (e.plannedMin ? " (previstos " + e.plannedMin + ")" : "") + " · Corrupción media: "')

# ================= index.html =================
rep("index.html", '<p class="muted">10–20 minutos con tres jugadores (puedes jugar de 3 a 6, pero está equilibrado para 3). Un solo móvil, tiradas de dado y un Consejo por ronda.</p>',
    '<p class="muted">Elige la duración y el juego ajustará las rondas para terminar a tiempo. Puedes jugar de 3 a 6 personas, pero está equilibrado para 3. Un solo móvil, tiradas de dado y un Consejo por ronda.</p>\n      <label>Duración de la partida<select id="gameMinutes"><option value="10">10 minutos</option><option value="15">15 minutos</option><option value="20" selected>20 minutos</option><option value="30">30 minutos</option><option value="45">45 minutos</option><option value="60">60 minutos</option></select></label>')
rep("index.html", "<li>Son 7 rondas. El Asesino vence si elimina a los demás;",
    "<li>La duración la eliges al empezar: el número de rondas se ajusta a vuestro ritmo y, si vais lentos, el Consejo se acorta y la partida termina al agotarse el tiempo. El Asesino vence si elimina a los demás;")

for f, a, b in [("engine.js","0.7.1","0.7.2"),("ui.js","0.7.1","0.7.2"),("data.js","0.7.1","0.7.2"),("index.html","v0.7.1","v0.7.2"),("sw.js","umbral-v7-1","umbral-v7-2")]:
    rep(f, a, b)
print("OK")
