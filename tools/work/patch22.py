import sys
W = "/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/"
def rep(f, old, new, count=1):
    p = W + f
    s = open(p, encoding="utf-8").read()
    n = s.count(old)
    if n != count: sys.exit("FAIL %s count=%d :: %r" % (f, n, old[:90]))
    open(p, "w", encoding="utf-8").write(s.replace(old, new))
e="engine.js"; u="ui.js"
rep(e,"  function roundsLeftInclCurrent()","""  /* Corte duro: al agotarse el tiempo la partida termina, pase lo que pase. */
  function timeUp() { return !!(state && state.phase !== "ending" && state.durationMin && timeLeftMs() <= 0); }
  function forceEnd() {
    if (!state) return null;
    if (state.phase === "ending" && state.ending) return state.ending;
    state.phase = "ending"; state.handoff = false; state.pendingPush = null;
    state.ending = computeEnding(); state.ending.timedOut = true;
    clearSave();
    return state.ending;
  }
  function roundsLeftInclCurrent()""")
# margen de planificación 90 %
rep(e,"state.maxRounds = clamp(Math.round(state.durationMin / est), 3, ROUNDS_CAP); return; }","state.maxRounds = clamp(Math.round(state.durationMin * 0.9 / est), 3, ROUNDS_CAP); return; }")
rep(e,"const left = Math.floor(Math.max(0, timeLeftMs()) / 60000 / per);","const left = Math.floor(Math.max(0, timeLeftMs() * 0.9) / 60000 / per);")
# nextTurn: sustituye el 125 %
rep(e,'''    /* Si la partida se pasa un 25 % del tiempo, el amanecer la corta. */
    if (state.durationMin && timeLeftMs() < -0.25 * state.durationMin * 60000) {
      state.phase = "ending"; state.ending = computeEnding(); save(); return "ending";
    }''','''    if (timeUp()) { forceEnd(); return "ending"; }''')
rep(e,"  function beginCouncil() {\n","  function beginCouncil() {\n    if (timeUp()) { forceEnd(); return state; }\n")
rep(e,"  function endCouncil() {\n    if (!state || state.phase !== \"council\") return [];\n","  function endCouncil() {\n    if (!state || state.phase !== \"council\") return [];\n    if (timeUp()) { forceEnd(); return []; }\n")
rep(e,"  function nextRound() {\n    if (!state) return null;\n","  function nextRound() {\n    if (!state) return null;\n    if (timeUp()) return forceEnd();\n")
rep(e,"function act(actorId, actionId, targetId, stakeId) {\n    if (!state || state.phase !== \"private\") return err(\"Ahora no puedes actuar.\");","function act(actorId, actionId, targetId, stakeId) {\n    if (timeUp()) { forceEnd(); return err(\"El tiempo se ha agotado.\"); }\n    if (!state || state.phase !== \"private\") return err(\"Ahora no puedes actuar.\");")
rep(e,"getHandOffer: getHandOffer,","getHandOffer: getHandOffer, timeUp: timeUp, forceEnd: forceEnd,")
# UI
rep(u,"U.tick(now - lastTick); lastTick = now; updateClock(); }, 1000);","U.tick(now - lastTick); lastTick = now; updateClock(); if (U.getState() && U.timeUp()) timeIsUp(); }, 1000);")
rep(u,"  function updateClock() {",'''  function timeIsUp() {
    const e = U.forceEnd();
    if (!e) return;
    stopTimer();
    Array.prototype.forEach.call(document.querySelectorAll(".overlay"), function (o) { o.classList.add("hidden"); });
    toast("Se acabó el tiempo: llega el amanecer.", false);
    renderEnding(e);
  }

  function updateClock() {''')
rep(u,'''(e.plannedMin ? " (previstos " + e.plannedMin + ")" : "")''','''(e.plannedMin ? " (previstos " + e.plannedMin + ")" : "") + (e.timedOut ? " · tiempo agotado" : "")''')
print("OK")
