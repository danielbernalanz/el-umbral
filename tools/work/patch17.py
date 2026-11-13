import sys
W = "/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/"
def rep(f, old, new, count=1):
    p = W + f
    s = open(p, encoding="utf-8").read()
    n = s.count(old)
    if n != count: sys.exit("FAIL %s count=%d :: %r" % (f, n, old[:90]))
    open(p, "w", encoding="utf-8").write(s.replace(old, new))
e="engine.js"; u="ui.js"
# --- mensajes dinámicos (engine)
rep(e,'(+" + o.cost + " corrupción).");','(algo en ti se oscurece).");')
rep(e,'msg: "Trato cerrado: +" + o.cost + " corrupción. " + eff };','msg: "Trato cerrado. El Umbral sonríe. " + eff };')
rep(e,'(extra ? " Se impacienta (+" + extra + " corrupción)." : ""));','(extra ? " Se impacienta y algo se oscurece en ti." : ""));')
rep(e,'(extra ? " El Umbral se impacienta: +" + extra + " corrupción." : "") };','(extra ? " El Umbral se impacienta." : "") };')
rep(e,'". +" + gain + " corrupción.", log','". La oscuridad te marca.", log')
rep(e,'pista fuerte y +" + gain + " corrupción.", log','pista fuerte. La oscuridad te marca.", log')
rep(e,'"El Umbral cobra: +" + s.failCorr + " corrupción" + (s.wound','"El Umbral cobra su precio" + (s.wound')
rep(e,'msg = "+" + def.value + " corrupción y +1 " + def.stat + "."; break;','msg = "Algo oscuro te recorre: +1 " + def.stat + "."; break;')
rep(e,'"Hay señales de corrupción en la compañía.','"Algo oscuro se ha instalado entre vosotros.')
# --- tramos ocultos
rep(e,"  function hasStatus(p, id) {",'''  /* Tramos de corrupción: efectos que el jugador no ve; solo nota los síntomas. */
  function tierOf(p) { return isAssassin(p) ? 0 : p.corr >= 80 ? 4 : p.corr >= 60 ? 3 : p.corr >= 40 ? 2 : p.corr >= 20 ? 1 : 0; }
  function corrMod(p, attr) {
    const t = tierOf(p);
    if (attr === "sombra") return t >= 3 ? 2 : t >= 1 ? 1 : 0;
    if (attr === "mente") return t >= 3 ? -1 : t === 2 ? -1 : 0;
    if (attr === "cuerpo") return t >= 3 ? -1 : 0;
    return 0;
  }
  const TIER_NOTES = ["", "Tu sombra empieza a moverse por su cuenta.", "Notas la mirada de los demás más pesada; tus pensamientos se enturbian.",
    "Tu cuerpo ya no te responde como antes. Algo se ha roto dentro de ti.", "Ya no recuerdas dónde acaba tu sombra y dónde empiezas tú."];
  function tierCheck(p) {
    if (p.dead) return;
    const t = tierOf(p), seen = p.tierSeen || 0;
    if (t > seen) {
      p.tierSeen = t;
      p.notes.push("Ronda " + state.round + ": " + TIER_NOTES[t]);
      if (t >= 3) {
        addWounds(p, 1);
        state.chronicle.push({ round: state.round, text: p.name + " se desploma un instante, como si algo lo hubiera golpeado desde dentro." });
      }
    } else if (t < seen) { p.tierSeen = t; }
  }
  function hasStatus(p, id) {''')
rep(e,"    const stat = (attr ? p.stats[attr] : 0) + statusMod(p);","    const stat = (attr ? p.stats[attr] + corrMod(p, attr) : 0) + statusMod(p);")
rep(e,"    state.players.forEach(function (p) { if (!p.dead) tickStatus(p); });","    state.players.forEach(function (p) { if (!p.dead) tickStatus(p); });\n    state.players.forEach(tierCheck);")
# --- UI
rep(u,'''<span>Corrupción <b>' + p.corr + '</b></span></div>' +''','''<span class="darkline">' + darkLine(p) + '</span></div>' +''')
rep(u,'''      '<div class="meter"><span class="corrupt" style="width:' + p.corr + '%"></span></div>' +
      '<div class="row between small"><span>Cuerpo''','''      '<div class="row between small"><span>Cuerpo''')
rep(u,"  function statsHTML(p) {",'''  function darkLine(p) {
    const t = p.alignment === "asesino" ? 4 : p.corr >= 80 ? 4 : p.corr >= 60 ? 3 : p.corr >= 40 ? 2 : p.corr >= 20 ? 1 : 0;
    return ["Tu sombra aún te obedece.", "Tu sombra se mueve a veces sola.", "Tu sombra llega antes que tú.", "Tu sombra ya no te sigue: te guía.", "No sabes si la sombra es tuya o tú eres suya."][t];
  }
  function statsHTML(p) {''')
rep(u,'''const refuse = o.refuse ? "Rechazar: +2 virtud, pero el Umbral se impacienta (+" + o.refuse + " corrupción)." : "Rechazar: +2 virtud.";''','''const refuse = o.refuse ? "Rechazar: +2 virtud, pero el Umbral no olvida." : "Rechazar: +2 virtud.";''')
rep(u,"""'<p class="small">Aceptar: +' + o.cost + ' corrupción' + (pressure ? ' (rebajado por su insistencia)' : '') + '. ' + refuse +""","""'<p class="small">Aceptar: tiene un precio que el Umbral no dice en voz alta. ' + refuse +""")
rep(u,"""'<span class="tagline">Si fallas: +' + st.failCorr + ' corrupción' + (st.wound ? " y una herida" : "") + '</span>';""","""'<span class="tagline">Si fallas: el Umbral cobra' + (st.wound ? " y te hiere" : "") + '.</span>';""")
rep(u,"Ceder puede darte poder, pero si alcanzas 14 de corrupción y nadie se ha transformado, serás el Asesino.","Ceder puede darte poder, pero si te entregas lo suficiente y nadie se ha transformado, el Umbral te reclamará.")
rep(u,'''" · Corrupción media: " + e.avgCorruption + "''','''" · Corrupción media: " + e.avgCorruption + "''')
# --- data/html textos
rep("data.js","cuestan 4 corrupción menos.","cuestan menos oscuridad.")
rep("data.js","Robar te cuesta 4 corrupción menos.","Robar te mancha menos.")
