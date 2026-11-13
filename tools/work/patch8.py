import sys
W = "/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/"
def rep(f, old, new, count=1):
    p = W + f
    s = open(p, encoding="utf-8").read()
    n = s.count(old)
    if n != count: sys.exit("FAIL %s count=%d :: %r" % (f, n, old[:90]))
    open(p, "w", encoding="utf-8").write(s.replace(old, new))

# 1. final al empezar la ronda
rep("engine.js", "    state.round += 1;\n    startRound();\n    return null;", "    state.round += 1;\n    startRound();\n    return state.phase === \"ending\" ? state.ending : null;")

# 4. tope de atributos
rep("engine.js", "  const COUNCIL_SECONDS = 90;", "  const COUNCIL_SECONDS = 90;\n  const MAX_STAT = 6;")
rep("engine.js", '''        const stat = pick(["cuerpo", "mente", "sombra"]);
        p.stats[stat] += 1;''', '''        const openStats = ["cuerpo", "mente", "sombra"].filter(function (k) { return p.stats[k] < MAX_STAT; });
        const stat = openStats.length ? pick(openStats) : null;
        if (stat) p.stats[stat] += 1;''')
rep("engine.js", '"Cedes. Tu " + stat + " aumenta (+1) y recibes "', '"Cedes. " + (stat ? "Tu " + stat + " aumenta (+1) y recibes " : "Tus atributos ya están al máximo; recibes ")')
rep("engine.js", '''          const st = ["cuerpo", "mente", "sombra"][rnd(3)];
          p.stats[st] += 1;''', '''          const openSt = ["cuerpo", "mente", "sombra"].filter(function (k) { return p.stats[k] < MAX_STAT; });
          const st = openSt.length ? pick(openSt) : null;
          if (st) p.stats[st] += 1;''')
rep("engine.js", '", recuperas una herida, +6 corrupción, -6 virtud y +1 " + st + "." + conv', '", recuperas una herida, +6 corrupción, -6 virtud" + (st ? " y +1 " + st : "") + "." + conv')
rep("engine.js", "if (def.stat) p.stats[def.stat] += 1;", "if (def.stat && p.stats[def.stat] < MAX_STAT) p.stats[def.stat] += 1;")
rep("data.js", "+1 a un atributo al azar, y te conviertes", "+1 a un atributo al azar (máximo 6), y te conviertes")

# 3. causa de muerte
rep("engine.js", '    if (p.wounds >= 3) { p.dead = true; p.status = []; killed(p, "heridas"); }', '    if (p.wounds >= 3) { p.dead = true; p.status = []; p.cause = "heridas"; killed(p, "heridas"); }')
rep("engine.js", "t.wounds = 3; t.dead = true; t.status = [];", 't.wounds = 3; t.dead = true; t.status = []; t.cause = "devorado";')
rep("engine.js", 'dead: !!p.dead, alignment: p.alignment || "superviviente",', 'dead: !!p.dead, cause: p.dead ? (p.cause || "heridas") : null, alignment: p.alignment || "superviviente",')
rep("ui.js", """'<p class="small">' + p.wounds + ' heridas · ' + p.clues + ' pistas · ' + items + '</p></div>';""",
    """'<p class="small">' + p.wounds + ' heridas · ' + p.clues + ' pistas · ' + items + '</p>' +
        '<p class="small">' + (p.dead ? (p.cause === "devorado" ? "Devorado" : "Cayó por heridas") : "Sobrevivió") + (p.alignment === "asesino" ? " · Asesino" : "") + '</p></div>';""")

# 2. reglas
rep("index.html", "<li>Cada ronda: una acción secreta por jugador, resuelta con tirada de dado.</li>",
    "<li>Cada ronda: una acción secreta por jugador. Las acciones arriesgadas se resuelven con tirada de dado; Meditar, Ceder, Resistir, Descansar y Entrenar son seguras.</li>")
rep("index.html", "Si ya había uno, ganáis juntos cuando no quede ningún superviviente.</li>",
    "Si ya había uno, ganáis juntos cuando no quede ningún superviviente.</li>\n        <li>Tres heridas eliminan a un jugador. Los atributos tienen un máximo de 6.</li>\n        <li>Estados (solo los ve su dueño): sangrado (+1 herida por ronda), veneno (+3 corrupción por ronda), aturdido (pierde el turno), maldito (−1 a las tiradas) y fortalecido (+1). Descansar quita sangrado y veneno.</li>")

for f, a, b in [("engine.js","0.6.7","0.6.8"),("ui.js","0.6.7","0.6.8"),("data.js","0.6.7","0.6.8"),("index.html","v0.6.7","v0.6.8"),("sw.js","umbral-v6-7","umbral-v6-8")]:
    rep(f, a, b)
print("OK")
