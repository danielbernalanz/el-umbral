import sys
W = "/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/"
def rep(f, old, new, count=1):
    p = W + f
    s = open(p, encoding="utf-8").read()
    n = s.count(old)
    if n != count: sys.exit("FAIL %s count=%d :: %r" % (f, n, old[:90]))
    open(p, "w", encoding="utf-8").write(s.replace(old, new))

# ---------- engine.js ----------
# 5. bug: el atacante en emboscada no suma su estado
rep("engine.js", "const atkBonus = actor.stats.cuerpo + Math.floor(actor.stats.sombra / 2) + actor.roundAttack + atkFocus +",
    "const atkBonus = actor.stats.cuerpo + Math.floor(actor.stats.sombra / 2) + actor.roundAttack + atkFocus + statusMod(actor) +")
# 4. desglose del modificador en la tirada
rep("engine.js", "    return { die: die, stat: stat, focus: focus, total: total, diff: diff, crit: crit, fumble: fumble, success: success };",
    "    return { die: die, stat: stat, focus: focus, status: statusMod(p), total: total, diff: diff, crit: crit, fumble: fumble, success: success };")
rep("engine.js", "      ok: true, die: r.die, stat: r.stat, focus: r.focus, total: r.total, diff: r.diff,",
    "      ok: true, die: r.die, stat: r.stat, focus: r.focus, status: r.status || 0, total: r.total, diff: r.diff,")
# 2. aturdidos: registro público al inicio de ronda
rep("engine.js", "    state.players.forEach(function (p) { if (!p.dead) tickStatus(p); });",
'''    state.skipped = state.players.filter(function (p) { return !p.dead && p.acted; }).map(function (p) { return p.id; });
    state.skipped.forEach(function (id) {
      state.chronicle.push({ round: state.round, text: "✖ " + state.players[id].name + " pierde su turno (aturdido)." });
    });
    state.players.forEach(function (p) { if (!p.dead) tickStatus(p); });''')
# 6. sangrado público
rep("engine.js", '''      if (s.id === "sangrado") { addWounds(p, 1);''',
'''      if (s.id === "sangrado") { state.chronicle.push({ round: state.round, text: "✖ " + p.name + " sigue sangrando." }); addWounds(p, 1);''')
# aturdir inmediato: registro público
rep("engine.js", '''            t.acted = true;
            t.notes.push("Ronda " + state.round + ": un golpe seco te deja sin turno.");''',
'''            t.acted = true;
            state.chronicle.push({ round: state.round, text: "✖ " + t.name + " pierde su turno de esta ronda." });
            t.notes.push("Ronda " + state.round + ": un golpe seco te deja sin turno.");''')

# ---------- ui.js ----------
# 1. estados privados: fuera del tablero público
rep("ui.js", "(p.wounds ? \"Heridas visibles: \" + p.wounds : \"Sin heridas visibles\") + statusText(p) + '</div></div>';",
    "(p.wounds ? \"Heridas visibles: \" + p.wounds : \"Sin heridas visibles\") + '</div></div>';")
rep("ui.js", "  function statusText(p) {\n    const list = (p.status || []).map(function (s) { return D.STATUS[s.id] ? D.STATUS[s.id].name + \" (\" + s.left + \")\" : s.id; });\n    return list.length ? \" · Estados: \" + list.join(\", \") : \"\";\n  }\n\n", "")
# 3. inicio de ronda: mostrar quién pierde turno y no decir "entrega a X" si se abre el Consejo
rep("ui.js", '''      $("handoffText").textContent = s.event.text + " Entrega el móvil a " + s.players[s.turn].name + ".";''',
'''      const skipped = (s.skipped || []).map(function (id) { return s.players[id].name; });
      const skipTxt = skipped.length ? " Pierde su turno (aturdido): " + skipped.join(", ") + "." : "";
      if (s.phase === "council") $("handoffText").textContent = s.event.text + skipTxt + " Nadie puede actuar: se abre el Consejo.";
      else $("handoffText").textContent = s.event.text + skipTxt + " Entrega el móvil a " + s.players[s.turn].name + ".";''')
# 4. desglose en la tirada y en la hoja de acción
rep("ui.js", '''        $("rollMath").textContent = "d6 " + signed(r.stat) + (r.focus ? " + foco " + r.focus : "") + " = " + r.total + " · dificultad " + r.diff;''',
'''        $("rollMath").textContent = "d6 " + signed(r.stat) + (r.focus ? " + foco " + r.focus : "") + (r.status ? " (incluye " + signed(r.status) + " por estados)" : "") + " = " + r.total + " · dificultad " + r.diff;''')
rep("ui.js", '''    if (a.target) meta += " Después eliges a quién afecta.";''',
'''    if (a.target) meta += " Después eliges a quién afecta.";
    const sm = U.statusMod(p);
    if (sm && a.risk) meta += " Incluye " + (sm > 0 ? "+" : "") + sm + " por estados.";''')
rep("ui.js", "filter(function (id) { return !s.players[id].dead; })", "filter(function (id) { return !s.players[id].dead; })", count=0) if False else None

# versión 0.6.6
for f, a, b in [("engine.js","0.6.5","0.6.6"),("ui.js","0.6.5","0.6.6"),("data.js","0.6.5","0.6.6"),("index.html","v0.6.5","v0.6.6"),("sw.js","umbral-v6-5","umbral-v6-6")]:
    rep(f, a, b)
print("OK")
