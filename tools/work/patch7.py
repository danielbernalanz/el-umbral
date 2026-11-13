import sys
W = "/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/"
def rep(f, old, new, count=1):
    p = W + f
    s = open(p, encoding="utf-8").read()
    n = s.count(old)
    if n != count: sys.exit("FAIL %s count=%d :: %r" % (f, n, old[:90]))
    open(p, "w", encoding="utf-8").write(s.replace(old, new))
def slice_replace(f, a_m, b_m, new):
    p = W + f; s = open(p, encoding="utf-8").read()
    a = s.index(a_m); b = s.index(b_m, a)
    open(p, "w", encoding="utf-8").write(s[:a] + new + s[b:])

# ---- helpers ----
rep("engine.js", "  function hasStatus(p, id) {",
'''  /* Asesino = alineación. Puede haber más de uno (p. ej. quien devora a otro jugador). */
  function isAssassin(p) { return !!p && p.alignment === "asesino"; }
  function assassinsOf() { return state.players.filter(isAssassin); }
  function hasStatus(p, id) {''')

# ---- fin de partida ----
rep("engine.js", '''    const assassin = state.assassinId === null ? null : state.players[state.assassinId];
    if (assassin && assassin.dead) {
      state.phase = "ending"; state.ending = computeEnding(); save(); return true;
    }
    if (assassin && alive.filter(function (p) { return p.id !== assassin.id; }).length === 0) {
      state.phase = "ending"; state.ending = computeEnding(); save(); return true;
    }''',
'''    const ass = assassinsOf();
    if (ass.length && ass.every(function (p) { return p.dead; })) {
      state.phase = "ending"; state.ending = computeEnding(); save(); return true;
    }
    if (ass.length && alive.every(isAssassin)) {
      state.phase = "ending"; state.ending = computeEnding(); save(); return true;
    }''')
rep("engine.js", '''    const assassin = state.assassinId === null ? null : state.players[state.assassinId];
    if ((assassin && assassin.dead) || !alive.length || (assassin && alive.filter(function (p) { return p.id !== assassin.id; }).length === 0)) {''',
'''    const ass = assassinsOf();
    if ((ass.length && ass.every(function (p) { return p.dead; })) || !alive.length || (ass.length && alive.every(isAssassin))) {''')
slice_replace("engine.js", "    const assassin = state.assassinId === null ? null : ps[state.assassinId];", "    const players = ps.map(function (p) {",
'''    const assassins = ps.filter(isAssassin);
    const names = function (l) { return l.map(function (p) { return p.name; }).join(", "); };
    const alive = ps.filter(function (p) { return !p.dead; });
    let winner = "draw";
    if (!alive.length) {
      title = "Silencio bajo la piedra";
      text = "Nadie ha sobrevivido. El Umbral se cierra sobre todos y la partida termina sin vencedor.";
    } else if (assassins.length && assassins.every(function (p) { return p.dead; })) {
      winner = "supervivientes";
      title = "El Umbral ha sido derrotado";
      text = names(assassins) + (assassins.length > 1 ? " cayeron. Los supervivientes han vencido a los Asesinos" : " cayó. Los supervivientes han vencido al Asesino") + " y han cerrado el paso a la oscuridad.";
    } else if (assassins.length && alive.every(isAssassin)) {
      winner = "asesino";
      title = "La última sombra";
      text = names(alive) + (alive.length > 1 ? " han eliminado a sus adversarios. Los Asesinos dominan el Umbral." : " ha eliminado a sus adversarios. El Asesino domina el Umbral.");
    } else if (assassins.length) {
      const liveAss = alive.filter(isAssassin);
      winner = "supervivientes";
      title = "La noche no pudo devorarlos";
      text = names(liveAss) + (liveAss.length > 1 ? " no consiguieron" : " no consiguió") + " eliminar a todos antes del amanecer. Los supervivientes vencen por resistencia.";
    } else {
      winner = "supervivientes";
      title = "La llama que no se apaga";
      text = "Nadie ha aceptado convertirse en el Asesino. Habéis resistido las tentaciones y sobrevivido juntos.";
    }

''')

# ---- acciones exclusivas, pistas, acusaciones, emboscadas ----
rep("engine.js", 'if (a.assassinOnly && p.id !== state.assassinId) return err(', 'if (a.assassinOnly && !isAssassin(p)) return err(')
rep("engine.js", 'if (p.id !== state.assassinId) return { text: "La caza no responde a tu voluntad.", log: null };',
                 'if (!isAssassin(p)) return { text: "La caza no responde a tu voluntad.", log: null };')
rep("engine.js", "} else if (state.assassinId === target.id && D.ASSASSIN_CLUES", "} else if (isAssassin(target) && D.ASSASSIN_CLUES")
rep("engine.js", "    const isAssassin = target.id === state.assassinId;\n    if (r.success && isAssassin) {", "    const isAss = isAssassin(target);\n    if (r.success && isAss) {")
rep("engine.js", "    if (r.success && !isAssassin) {", "    if (r.success && !isAss) {")
rep("engine.js", "      state.assassinExposed = true;\n      target.huntBlocked = true;", "      state.assassinExposed = true;\n      target.exposed = true;\n      target.huntBlocked = true;")
rep("engine.js", "addWounds(target, actor.id === state.assassinId ? 2 : (target.id === state.assassinId ? 2 : 1));",
                 "addWounds(target, (isAssassin(actor) || isAssassin(target)) ? 2 : 1);")
rep("engine.js", '(actor.id === state.assassinId || target.id === state.assassinId ? "dos heridas" : "una herida")',
                 '(isAssassin(actor) || isAssassin(target) ? "dos heridas" : "una herida")')
rep("engine.js", '''    if (state.assassinExposed && state.assassinId !== null) return "El Asesino ha sido identificado: " + state.players[state.assassinId].name + ". Los supervivientes pueden unirse para detenerlo; ya no hay secretos que proteger.";''',
'''    const exposed = assassinsOf().filter(function (p) { return p.exposed && !p.dead; });
    if (exposed.length) return (exposed.length > 1 ? "Los Asesinos han sido identificados: " : "El Asesino ha sido identificado: ") + exposed.map(function (p) { return p.name; }).join(", ") + ". Los supervivientes pueden unirse para detenerle; ya no hay secretos que proteger.";''')
rep("engine.js", "      if (typeof state.assassinExposed !== \"boolean\") state.assassinExposed = false;",
    "      if (typeof state.assassinExposed !== \"boolean\") state.assassinExposed = false;\n      if (state.assassinExposed && state.assassinId !== null && state.players[state.assassinId]) state.players[state.assassinId].exposed = true;")

# ---- devorar: el caníbal se convierte en Asesino ----
rep("engine.js", '''          p.stats[st] += 1;
          state.chronicle.push({ round: state.round, text: "✖ " + t.name + " ha sido devorado." });
          return { text: "Devoras a " + t.name + ": heredas " + (loot.length ? loot.length + " objeto(s)" : "nada") + ", recuperas una herida, +6 corrupción, -6 virtud y +1 " + st + ".", log: null };''',
'''          p.stats[st] += 1;
          let conv = "";
          if (!isAssassin(p)) {
            p.alignment = "asesino";
            if (state.assassinId === null) state.assassinId = p.id;
            conv = " Has cruzado la línea: ahora eres un Asesino.";
          }
          state.chronicle.push({ round: state.round, text: "✖ " + t.name + " ha sido devorado." });
          return { text: "Devoras a " + t.name + ": heredas " + (loot.length ? loot.length + " objeto(s)" : "nada") + ", recuperas una herida, +6 corrupción, -6 virtud y +1 " + st + "." + conv, log: null };''')

# ---- data.js ----
rep("data.js", "Si tienes éxito, eliminas a la víctima, heredas sus objetos, recuperas una herida, +6 corrupción, -6 virtud y +1 a un atributo al azar. Si fallas, pierdes una herida.",
    "Si tienes éxito, eliminas a la víctima, heredas sus objetos, recuperas una herida, +6 corrupción, -6 virtud y +1 a un atributo al azar, y te conviertes en Asesino. Si fallas, pierdes una herida y ganas +4 corrupción.")

# ---- ui.js ----
rep("ui.js", 'p.id === s.assassinId ? (s.assassinExposed ?', 'p.alignment === "asesino" ? (p.exposed ?')
rep("ui.js", "return !a.assassinOnly || p.id === U.getState().assassinId;", 'return !a.assassinOnly || p.alignment === "asesino";')
rep("ui.js", '''    if (s.assassinExposed && s.assassinId !== null) { $("worldState").textContent = "Asesino identificado: " + s.players[s.assassinId].name + "."; return; }''',
'''    const exposedAss = s.players.filter(function (p) { return p.alignment === "asesino" && p.exposed && !p.dead; });
    if (exposedAss.length) { $("worldState").textContent = (exposedAss.length > 1 ? "Asesinos identificados: " : "Asesino identificado: ") + exposedAss.map(function (p) { return p.name; }).join(", ") + "."; return; }''')

# ---- reglas ----
rep("index.html", "los supervivientes vencen si lo derrotan o resisten hasta el amanecer.</li>",
    "los supervivientes vencen si lo derrotan o resisten hasta el amanecer.</li>\n        <li>Devorar a otro jugador te convierte en Asesino. Si ya había uno, ganáis juntos cuando no quede ningún superviviente.</li>")

for f, a, b in [("engine.js","0.6.6","0.6.7"),("ui.js","0.6.6","0.6.7"),("data.js","0.6.6","0.6.7"),("index.html","v0.6.6","v0.6.7"),("sw.js","umbral-v6-6","umbral-v6-7")]:
    rep(f, a, b)
print("OK")
