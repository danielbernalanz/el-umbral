import sys
W = "/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/"
def rep(f, old, new, count=1):
    p = W + f
    s = open(p, encoding="utf-8").read()
    n = s.count(old)
    if n != count: sys.exit("FAIL %s count=%d :: %r" % (f, n, old[:90]))
    open(p, "w", encoding="utf-8").write(s.replace(old, new))

# ---- La Sombra: ataca sola y finge ser un Asesino ----
rep("engine.js", "  function beginCouncil() {",
'''  /* La Sombra: mientras no haya Asesino, desde la ronda 3 la oscuridad ataca sola, igual que Cazar,
     para que los jugadores crean que hay uno. Es un secreto: solo se revela en el desenlace. */
  function shadowMimics() { return !!(state.shadow && state.shadow.strikes > 0 && assassinsOf().length === 0); }
  function shadowStrike() {
    if (state.round < 3 || assassinsOf().length) return;
    const sh = state.shadow = state.shadow || { strikes: 0, last: null };
    let pool = state.players.filter(function (p) { return !p.dead; });
    if (pool.length > 1) pool = pool.filter(function (p) { return p.id !== sh.last; });
    if (!pool.length) return;
    const t = pick(pool);
    sh.last = t.id; sh.strikes += 1;
    const dFocus = t.focus > 0 ? t.focus : 0;
    if (dFocus) t.focus = 0;
    const defBonus = t.stats.cuerpo + Math.floor(t.stats.mente / 2) + t.roundDefense + dFocus + statusMod(t) +
      (hasPassive(t, "defenseBonus") ? 2 : 0) + (t.protection !== null ? 2 : 0) - t.wounds;
    const r = rollRaw(3, d6() + defBonus);
    if (r.success) {
      addWounds(t, 2);
      t.notes.push("Ronda " + state.round + ": una sombra te atacó durante la noche y sufriste dos heridas.");
    } else {
      t.notes.push("Ronda " + state.round + ": oíste algo acechando cerca, pero no lograste distinguir quién era.");
    }
  }

  function beginCouncil() {''')
rep("engine.js", '''    state.phase = "council";
    state.turn = 0;
    state.handoff = false;
    state.council = { interactions: [], ambushes: [], used: {} };''',
'''    shadowStrike();
    if (checkTerminal()) return state;
    state.phase = "council";
    state.turn = 0;
    state.handoff = false;
    state.council = { interactions: [], ambushes: [], used: {} };''')
# pistas falsas que parecen de Asesino
rep("engine.js", '''      text = pick(D.ASSASSIN_CLUES).replace(/\\{name\\}/g, target.name);
    } else {
      text = rumorFor(target);''',
'''      text = pick(D.ASSASSIN_CLUES).replace(/\\{name\\}/g, target.name);
    } else if (shadowMimics() && D.ASSASSIN_CLUES && Math.random() < (str >= 2 ? 0.4 : 0.25)) {
      text = pick(D.ASSASSIN_CLUES).replace(/\\{name\\}/g, target.name);
    } else {
      text = rumorFor(target);''')
# cuenta de acusaciones falsas para el desenlace
rep("engine.js", '''    target.notes.push("Ronda " + state.round + ": " + actor.name + " te acusó sin demostrar que fueras el Asesino.");''',
'''    if (!isAss) state.falseAccusations = (state.falseAccusations || 0) + 1;
    target.notes.push("Ronda " + state.round + ": " + actor.name + " te acusó sin demostrar que fueras el Asesino.");''')
# desenlace: revelación
rep("engine.js", '''    } else {
      winner = "supervivientes";
      title = "La llama que no se apaga";''',
'''    } else if (state.shadow && state.shadow.strikes > 0) {
      winner = "supervivientes";
      title = "Nunca hubo un Asesino";
      const fa = state.falseAccusations || 0;
      text = "No había ningún Asesino entre vosotros: era la Sombra, la oscuridad cazando sola mientras os sospechabais." +
        (fa ? " Hubo " + fa + (fa > 1 ? " acusaciones falsas." : " acusación falsa.") : " Nadie llegó a acusar a un inocente.");
    } else {
      winner = "supervivientes";
      title = "La llama que no se apaga";''')
# ---- UI: el texto privado no debe delatar que no hay Asesino ----
rep("ui.js", '(s.assassinId === null ? "Susurro para ti: "', '(s.assassinId === null && !(s.shadow && s.shadow.strikes > 0) ? "Susurro para ti: "')

for f, a, b in [("engine.js","0.7.0","0.7.1"),("ui.js","0.7.0","0.7.1"),("data.js","0.7.0","0.7.1"),("index.html","v0.7.0","v0.7.1"),("sw.js","umbral-v7-0","umbral-v7-1")]:
    rep(f, a, b)
print("OK")
