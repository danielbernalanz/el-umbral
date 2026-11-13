import sys
W = "/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/"
def rep(f, old, new, count=1):
    p = W + f
    s = open(p, encoding="utf-8").read()
    n = s.count(old)
    if n != count: sys.exit("FAIL %s count=%d :: %r" % (f, n, old[:90]))
    open(p, "w", encoding="utf-8").write(s.replace(old, new))
e="engine.js"; u="ui.js"; h="index.html"

# ---------------- HTML ----------------
rep(h,'    <button class="ghost smallbtn hidden" id="btnStatus">Estado</button>','    <button class="ghost smallbtn" id="btnHelp">?</button>\n    <button class="ghost smallbtn hidden" id="btnStatus">Estado</button>')
rep(h,'        <h2 id="screenTitle">Pasa el móvil</h2>','        <h2 id="screenTitle">Pasa el móvil</h2>\n        <p class="small muted" id="stepHint"></p>')
rep(h,'    <div class="rollmath" id="rollMath"></div>','    <div class="rollmath" id="rollMath"></div>\n    <div class="small muted" id="rollWhy"></div>')
rep(h,"<!-- Estado público -->",'''<!-- Guía -->
<div id="helpOverlay" class="overlay hidden">
  <div class="sheet" style="max-height:88vh;overflow:auto">
    <div class="row between"><h2>Cómo se juega</h2><button class="ghost smallbtn" id="btnCloseHelp">Cerrar</button></div>
    <h3>Una ronda</h3>
    <p class="small">1) <b>Turnos privados</b>: cada jugador, por turno, elige UNA acción en secreto y pasa el móvil. 2) <b>Consejo</b>: hablad en voz alta; pactos, acusaciones y ataques se registran para que cuenten. 3) <b>Resolución</b>: se ve lo que ha pasado en público.</p>
    <h3>Acciones y dados</h3>
    <p class="small">Al tocar una acción ves qué hace, su dificultad y tu probabilidad antes de confirmar. Se tira un d6 y se suma el atributo (Cuerpo, Mente o Sombra). Si llegas a la dificultad, funciona. Un 6 siempre sale; un 1 siempre falla. Tras la tirada, el juego te dice qué ha influido (atributo, estados, virtud, protección).</p>
    <h3>Qué miden tus números</h3>
    <p class="small"><b>Heridas</b>: tres y caes. <b>Virtud</b>: tu lado bueno; si es alta, investigar y proteger son más fáciles. <b>Oscuridad</b>: no se ve el número, se nota: tu sombra se comporta distinto según cuánto te hayas entregado. Da poder, pero cobra su precio.</p>
    <h3>Aprender</h3>
    <p class="small">Empiezas con pocas acciones. Lo que haces te cambia: practicar mejora tus atributos (verás los puntos de práctica en tu ficha) y abre acciones nuevas. Cuando algo se abre, recibes una intuición, que queda guardada en tu ficha. Cada acción tiene una frase que insinúa adónde puede llevarte.</p>
    <h3>Objetos y magia</h3>
    <p class="small">Los objetos se usan desde tu ficha (uno por ronda). Los grimorios enseñan conjuros ofensivos o defensivos: eliges uno entre tres y le das forma. Cada éxito lo afianza y, a los dos, lo dominas. Las armas (daga, frasco, pergamino, porra) permiten el daño directo.</p>
    <h3>Consejo</h3>
    <p class="small">Elige quién actúa, qué hace y sobre quién. Debajo del selector se explica lo que hace cada interacción. Las acusaciones sin pruebas se pagan.</p>
    <h3>Final y tiempo</h3>
    <p class="small">El reloj marca el tiempo que queda; si se agota, llega el amanecer y la partida termina. Puede acabar antes si no quedan supervivientes o cae el Asesino.</p>
  </div>
</div>

<!-- Estado público -->''')

# ---------------- UI ----------------
rep(u,'    $("btnActionCancel").onclick =','    $("btnHelp").onclick = function () { $("helpOverlay").classList.remove("hidden"); };\n    $("btnCloseHelp").onclick = function () { $("helpOverlay").classList.add("hidden"); };\n    $("helpOverlay").onclick = function (e) { if (e.target === $("helpOverlay")) $("helpOverlay").classList.add("hidden"); };\n    $("btnActionCancel").onclick =')
rep(u,"  function hideAll() {","  function setStep(t) { const el = $(\"stepHint\"); if (el) el.textContent = t || \"\"; }\n\n  function hideAll() {")
rep(u,'    $("screenTitle").textContent = "Turno de " + p.name;','    $("screenTitle").textContent = "Turno de " + p.name;\n    setStep("Elige UNA acción: al tocarla verás qué hace antes de confirmar. Luego entrega el móvil.");')
rep(u,'    $("screenTitle").textContent = "El Consejo";','    $("screenTitle").textContent = "El Consejo";\n    setStep("Hablad entre vosotros. Lo que pactéis, acuséis o ataquéis, registradlo aquí para que cuente. Cerrad el Consejo cuando terminéis.");')
rep(u,'    $("screenTitle").textContent = "La ronda termina";','    $("screenTitle").textContent = "La ronda termina";\n    setStep("Esto es lo que ha pasado y todos podéis ver. Lo secreto sigue en secreto.");')
rep(u,'    $("screenTitle").textContent = "Pasa el móvil";','    $("screenTitle").textContent = "Pasa el móvil";\n    setStep("Entrega el móvil sin mirar la pantalla. Quien lo recibe pulsa para continuar.");')
rep(u,'''        $("rollMath").textContent = "d6 " + signed(r.stat)''','''        $("rollWhy").textContent = (r.why || []).length ? "Influye: " + r.why.join(" · ") : "";
        $("rollMath").textContent = "d6 " + signed(r.stat)''')
rep(u,'''    $("rollMath").textContent = "";
    $("rollBanner").textContent = "";''','''    $("rollMath").textContent = "";
    $("rollWhy").textContent = "";
    $("rollBanner").textContent = "";''')
rep(u,"Desde la ronda 3, si se cumple al cerrar la ronda ganas +1 foco.","En la segunda mitad de la partida, si se cumple al cerrar la ronda ganas +1 foco.")
rep(u,"      '<h3>Equipo inicial</h3>","      ((p.hints || []).length ? '<h3>Intuiciones</h3>' + p.hints.slice(-8).map(function (t) { return '<div class=\"notice small\">' + esc(t) + '</div>'; }).join('') : '') +\n      '<h3>Equipo inicial</h3>")
rep(u,"  function statsHTML(p) {","""  function practiceLine(p) {
    const xi = U.xpInfo(p);
    const parts = ["cuerpo", "mente", "sombra"].filter(function (k) { return xi[k] && !xi[k].capped; }).map(function (k) {
      let dots = ""; for (let i = 0; i < xi[k].need; i++) dots += i < xi[k].have ? "●" : "○";
      return k.charAt(0).toUpperCase() + k.slice(1) + " " + dots;
    });
    return parts.length ? '<div class="small">Práctica: ' + parts.join(" · ") + '</div>' : "";
  }
  function statsHTML(p) {""")
rep(u,"      (status.length ? '<div class=\"small\">' + status.join(\" · \") + '</div>' : '') +","      practiceLine(p) +\n      (status.length ? '<div class=\"small\">' + status.join(\" · \") + '</div>' : '') +")

# ---------------- ENGINE ----------------
rep(e,'out.push(hint); p.notes.push("Ronda " + state.round + ": " + hint); }','out.push(hint); p.hints = p.hints || []; p.hints.push(hint); p.notes.push("Ronda " + state.round + ": " + hint); }')
rep(e,"      p.fresh = p.fresh || []; p.fresh.push(ah);","      p.fresh = p.fresh || []; p.fresh.push(ah); p.hints = p.hints || []; p.hints.push(ah);")
rep(e,"  function addXp(p, attr, amt) {","""  function xpInfo(p) {
    const out = {};
    ["cuerpo", "mente", "sombra"].forEach(function (k) {
      out[k] = { have: Math.min((p.xp && p.xp[k]) || 0, need(3)), need: need(3), grown: (p.grown && p.grown[k]) || 0, capped: ((p.grown && p.grown[k]) || 0) >= 2 || p.stats[k] >= MAX_STAT };
    });
    return out;
  }
  function addXp(p, attr, amt) {""")
rep(e,"    const r = a.risk ? rollCheck(p, a.attr, diff) :","""    const why = [];
    if (a.attr) {
      why.push("tu " + a.attr + " (" + p.stats[a.attr] + ")");
      const cmod = corrMod(p, a.attr);
      if (cmod > 0) why.push("tu sombra responde con más fuerza (+" + cmod + ")");
      else if (cmod < 0) why.push("algo turbio entorpece tus " + (a.attr === "mente" ? "pensamientos" : "movimientos") + " (" + cmod + ")");
      const sm = statusMod(p);
      if (sm) why.push(sm > 0 ? "vigor (+" + sm + ")" : "maldición (" + sm + ")");
      if (a.hostile && t && t.protection !== null) why.push("la víctima está protegida (+1 dificultad)");
      if (["investigar", "proteger", "explorar"].indexOf(a.id) !== -1) {
        if (p.virtue >= 70) why.push("tu virtud lo facilita (−1 dificultad)"); else if (p.virtue <= 30) why.push("tu virtud baja lo complica (+1 dificultad)");
      }
    }
    const r = a.risk ? rollCheck(p, a.attr, diff) :""")
rep(e,"      crit: r.crit, fumble: r.fumble, success: r.success,\n      outcome: out.text, pushable: !!(a.pushable && r.success), action: a.name","      crit: r.crit, fumble: r.fumble, success: r.success, why: why,\n      outcome: out.text, pushable: !!(a.pushable && r.success), action: a.name")
rep(e,"      res.die = r.die; res.stat = r.stat;","""      res.why = ["tu " + spellAttr(sp) + " (" + p.stats[spellAttr(sp)] + ")"];
      if (asp.roll > 0) res.why.push("el aspecto " + asp.adj + " lo hace más certero");
      if (asp.roll < 0) res.why.push("el aspecto " + asp.adj + " lo hace menos fiable");
      if (off && t && t.protection !== null && !asp.pierce) res.why.push("la víctima está protegida (+1 dificultad)");
      if (statusMod(p)) res.why.push(statusMod(p) > 0 ? "vigor (+" + statusMod(p) + ")" : "maldición (" + statusMod(p) + ")");
      res.die = r.die; res.stat = r.stat;""")
rep(e,"getHandOffer: getHandOffer,","getHandOffer: getHandOffer, xpInfo: xpInfo,")
print("OK")
