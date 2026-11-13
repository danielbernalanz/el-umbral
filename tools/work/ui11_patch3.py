import re,sys
W="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/ui.js"
s=open(W,encoding="utf-8").read()
def rep(old,new,cnt=1):
    global s
    n=s.count(old)
    if n!=cnt: print("FALLO (%d veces, se esperaba %d):"%(n,cnt),old[:100]); sys.exit(1)
    s=s.replace(old,new)

# ---------- secreto ----------
a=s.index("  function secretHTML(p, full) {"); b=s.index("  function secretOk(p, s) {")
s=s[:a]+r'''  function secretHTML(p, full) {
    const si = U.secretInfo(p.id);
    if (!si) return "";
    const rw = si.reward ? '<div class="rewardline small">' + medal("i_amuleto", "sm", "ember") + '<span><b class="reward">' + (si.paid ? '✦ Premio recibido: ' : 'Premio: ') + esc(si.reward.title) + '</b> — ' + esc(si.reward.text) + (si.paid ? '' : ' Se entrega al cumplirlo, una sola vez.') + '</span></div>' : '';
    const st = si.assassin ? '' : '<div class="stline"><span class="' + (si.ok ? "f-heal" : "f-mist") + '" style="color:var(--ic)">' + ic(si.ok ? "ui_exito" : "ui_fallo") + '</span><span>' + (si.ok ? 'Ahora mismo se cumple.' : 'Ahora mismo no se cumple.') + '</span></div>';
    return '<div class="notice small"><div class="secrethead">' + medal("x_" + si.id, "lg") + '<div><b>Tu objetivo secreto: ' + esc(si.title) + '</b></div></div>' + esc(si.text) +
      (full && si.when ? '<br><span class="muted">' + esc(si.when) + '</span>' : '') + rw + st +
      (si.hint ? '<div class="hintline"><b>Qué hacer ahora:</b> ' + esc(si.hint) + '</div>' : '') + '</div>';
  }
'''+s[b:]

# ---------- entrega ----------
rep('''    $("phaseTag").textContent = mode === "round" ? "NUEVA RONDA" : mode === "start" ? "TURNO PRIVADO" : "TURNO PRIVADO";''','''    $("phaseTag").textContent = mode === "round" ? "NUEVA RONDA" : mode === "start" ? "TURNO PRIVADO" : "TURNO PRIVADO";
    setPhaseIcon(mode === "round" ? "ui_ronda" : "ui_pasar");
    { const sg = $("handoffSigil"), evId = s.event && s.event.id;
      const sk = mode === "round" && evId ? "e_" + evId : mode === "start" ? "t_umbral" : "ph_privado";
      sg.className = "bigmedal f-" + famOf(sk); sg.innerHTML = ic(sk); }''')
rep('''      $("btnHandoff").textContent = "Soy " + cur.name;''','''      setLbl($("btnHandoff"), "Soy " + cur.name);''')
rep('''      $("btnHandoff").textContent = "Comenzar ronda " + s.round;''','''      setLbl($("btnHandoff"), "Comenzar ronda " + s.round);''')
rep('''      $("btnHandoff").textContent = (function () {''','''      setLbl($("btnHandoff"), (function () {''')
rep('''.length === 0; })() ? "Abrir el Consejo" : "Continuar";''','''.length === 0; })() ? "Abrir el Consejo" : "Continuar");''')

# ---------- consejo ----------
rep('''    $("phaseTag").textContent = "FASE SOCIAL";''','''    $("phaseTag").textContent = "FASE SOCIAL"; setPhaseIcon("ph_consejo");''')
rep('''      return '<div class="notice small">' + esc(c.text) + '</div>';
    }).join("") : '<p class="small">Todavía no ha ocurrido nada esta ronda.</p>';''','''      return '<div class="notice small">' + esc(c.text) + '</div>';
    }).join("") : '<p class="small">Todavía no ha ocurrido nada esta ronda.</p>';''')
rep('''$("councilLogBox").querySelector("summary").textContent = "Lo que ha pasado esta ronda (" + entries.length + ")";''','''$("councilLogBox").querySelector("summary").innerHTML = ic("ui_log") + "<span>Lo que ha pasado esta ronda (" + entries.length + ")</span>";''')

# ---------- preparación ----------
rep('''    $("phaseTag").textContent = "TURNO PRIVADO";
    $("screenTitle").textContent = "Para el Consejo, " + p.name;''','''    $("phaseTag").textContent = "TURNO PRIVADO"; setPhaseIcon("ph_prep");
    $("screenTitle").textContent = "Para el Consejo, " + p.name;''')
rep('''    { v: "acusacion", t: "Acusar al Asesino",''','''    { v: "acusacion", ik: "a_acusar", t: "Acusar al Asesino",''')
rep('''{ v: "emboscada", t: "Enfrentarte a alguien",''','''{ v: "emboscada", ik: "a_enfrentar", t: "Enfrentarte a alguien",''')
rep('''{ v: "romper", t: "Romper un silencio",''','''{ v: "romper", ik: "a_romper", t: "Romper un silencio",''')
rep('''{ v: "pacto", t: "Proponer un pacto secreto",''','''{ v: "pacto", ik: "a_pacto", t: "Proponer un pacto secreto",''')
rep('''      b.innerHTML = '<b>' + esc(x.t) + '</b><div class="small">' + esc(x.s) + '</div>' + (x.v === prepSel ? '<ul class="small">' + x.fx.map(function (f) { return "<li>" + esc(f) + "</li>"; }).join("") + '</ul>' : "");''','''      b.innerHTML = medal(x.ik, "md") + '<span class="cbody"><b>' + esc(x.t) + '</b><div class="small">' + esc(x.s) + '</div>' + (x.v === prepSel ? '<ul class="small">' + x.fx.map(function (f) { return "<li>" + esc(f) + "</li>"; }).join("") + '</ul>' : "") + '</span>';''')
rep('''    $("prepTargetLabel").firstChild.textContent = ''','''    $("prepTargetLabel").firstChild.nextSibling.textContent = ''') if False else None
rep('''  function prepTerms() {
    $("prepHint").textContent =''','''  function prepTerms() {
    { const kv = $("prepKind").value; $("prepKindIco").innerHTML = medal("p_" + String(kv).replace("pacto_", ""), "sm"); }
    $("prepHint").textContent =''')

# ---------- resolución ----------
rep('''    $("phaseTag").textContent = "RESOLUCIÓN";''','''    $("phaseTag").textContent = "RESOLUCIÓN"; setPhaseIcon("ph_resolucion");''')
rep('''      return '<div class="player"><div class="row between"><b>' + esc(p.name) + '</b><span class="small">' + (p.dead ? 'Eliminado' : p.dying ? 'Necesita socorro' : 'En juego') + '</span></div>' +
        '<div class="small">' + esc(U.visibleHealth(p)) + '</div></div>';
    }).join("");
    $("btnNextRound").textContent = s.round >= U.maxRounds() ? "Ver el desenlace" : "Siguiente ronda";''','''      return '<div class="player' + (p.dead ? " dead" : "") + '"><div class="prow">' + playerMedal(p) + '<div class="grow"><div class="row between"><b>' + esc(p.name) + '</b><span class="small">' + (p.dead ? 'Eliminado' : p.dying ? 'Necesita socorro' : 'En juego') + '</span></div>' +
        '<div class="small">' + esc(U.visibleHealth(p)) + '</div></div></div></div>';
    }).join("");
    setLbl($("btnNextRound"), s.round >= U.maxRounds() ? "Ver el desenlace" : "Siguiente ronda");
    { const nb = $("btnNextRound"); if (!nb.querySelector(".ic")) nb.insertAdjacentHTML("afterbegin", ic(s.round >= U.maxRounds() ? "ph_desenlace" : "ui_continuar")); else nb.querySelector(".ic").outerHTML = ic(s.round >= U.maxRounds() ? "ph_desenlace" : "ui_continuar"); }''')
rep('''    $("resLog").innerHTML = pub.length ? pub.map(function (e) {
      return '<div class="notice">' + esc(e) + '</div>';''','''    $("resLog").innerHTML = pub.length ? pub.map(function (e) {
      return '<div class="notice">' + esc(e) + '</div>';''')

# ---------- desenlace ----------
rep('''    if (!e) return;
    $("endingSub").textContent =''','''    if (!e) return;
    { const sk = e.winner === "asesino" ? "t_asesino" : e.winner === "supervivientes" ? "st_virtud" : "ph_desenlace", sg = $("endingSigil");
      sg.className = "bigmedal f-" + famOf(sk); sg.innerHTML = ic(sk); }
    $("endingSub").textContent =''')
rep('''return "<p class=\\"small\\">" + (x.round ? "<b>Ronda " + x.round + ".</b> " : "") + esc(x.text) + "</p>"; }).join("")''','''return "<p class=\\"small storyp\\">" + ic(x.round ? "ui_ronda" : "ui_historia") + "<span>" + (x.round ? "<b>Ronda " + x.round + ".</b> " : "") + esc(x.text) + "</span></p>"; }).join("")''')
rep('''      return '<div class="player"><div class="row between"><b>' + esc(p.name) + '</b><span class="small">' + esc(p.role) + ' · ' + esc(p.affinity) + '</span></div>' +
        '<div class="row between small"><span>Virtud ' + p.virtue + '</span><span>Corrupción ' + p.corr + '</span></div>' +''','''      const rd = D.ROLES.find(function (x) { return x.name === p.role; }), af = D.AFFINITIES.find(function (x) { return x.name === p.affinity; });
      return '<div class="player"><div class="prow">' + (rd ? medal("r_" + rd.id, "md") : "") + '<div class="grow"><b>' + esc(p.name) + '</b><div class="small">' + (rd ? ic("r_" + rd.id, "ic-sm") : "") + esc(p.role) + ' · ' + (af ? ic("f_" + af.id, "ic-sm") : "") + esc(p.affinity) + '</div></div></div>' +
        '<div class="row between small"><span class="lab f-heal">' + ic("st_virtud", "ic-sm") + ' Virtud ' + p.virtue + '</span><span class="lab f-dark">' + ic("st_corrupcion", "ic-sm") + ' Corrupción ' + p.corr + '</span></div>' +''')
rep('''      return '<p class="small">' + (p.fulfilled ? "✦" : "✧") + ' <b>' + esc(p.name) + '</b>' + (p.secretTitle ? ' (' + esc(p.secretTitle) + ')' : '') + ': ' + esc(p.secret) + ' — <b>' +''','''      const sd = D.SECRETS.find(function (x) { return x.title === p.secretTitle; });
      return '<div class="secretrow">' + (sd ? medal("x_" + sd.id, "md") : "") + '<span class="st ' + (p.fulfilled ? "ok" : "no") + '">' + ic(p.fulfilled ? "ui_exito" : "ui_fallo") + '</span><p class="small" style="margin:0">' + (p.fulfilled ? "✦" : "✧") + ' <b>' + esc(p.name) + '</b>' + (p.secretTitle ? ' (' + esc(p.secretTitle) + ')' : '') + ': ' + esc(p.secret) + ' — <b>' +''')
rep('''(p.rewardPaid ? '' : ' (la partida acabó antes de cobrarlo)') + '.</span>' : '') + '</p>';''','''(p.rewardPaid ? '' : ' (la partida acabó antes de cobrarlo)') + '.</span>' : '') + '</p></div>';''')

# ---------- estado público ----------
rep('''      return '<div class="player' + (active ? " active" : "") + '">' +
        '<div class="row between"><b>' + esc(p.name) + '</b><span class="small">' + (p.dead ? 'Eliminado' : p.dying ? 'Necesita socorro' : 'En juego') + '</span></div>' +
        '<div class="small">' + esc(U.visibleHealth(p)) + '</div></div>';''','''      return '<div class="player' + (active ? " active" : "") + (p.dead ? " dead" : "") + '"><div class="prow">' + playerMedal(p) + '<div class="grow">' +
        '<div class="row between"><b>' + esc(p.name) + '</b><span class="small">' + (p.dead ? 'Eliminado' : p.dying ? 'Necesita socorro' : 'En juego') + '</span></div>' +
        '<div class="small">' + esc(U.visibleHealth(p)) + '</div></div></div></div>';''')
rep('''      return '<div class="clue small">' + esc(c.text) + '</div>';''','''      return '<div class="clue small">' + ic("st_pistas") + '<span>' + esc(c.text) + '</span></div>';''')

# ---------- tiradas ----------
rep('''    $("rollTitle").textContent = opts.title || "TIRADA";''','''    $("rollTitle").textContent = opts.title || "TIRADA";
    $("rollIcon").innerHTML = opts.icon ? medal(opts.icon, "lg") : "";''')
rep('''        $("rollDie").textContent = r.die;
        $("rollDie").className = "die " + (r.success ? "good" : "bad");''','''        $("rollDie").textContent = r.die;
        $("rollDie").className = "die " + (r.success ? "good" : "bad");
        $("rollBanner").innerHTML = ic(r.success ? "ui_exito" : "ui_fallo") + (r.success ? "ÉXITO" : "FALLO"); $("rollBanner").className = "rollbanner " + (r.success ? "good" : "bad");''')
rep('''if (r.crit) { $("rollBanner").textContent = "✦ FAVOR DEL UMBRAL";''','''if (r.crit) { $("rollBanner").innerHTML = ic("ui_critico") + "✦ FAVOR DEL UMBRAL";''')
rep('''if (r.fumble) { $("rollBanner").textContent = "☠ PRESAGIO";''','''if (r.fumble) { $("rollBanner").innerHTML = ic("s_muerto") + "☠ PRESAGIO";''')
rep('''        $("rollDie").textContent = "✦";
        $("rollDie").className = "die";''','''        $("rollDie").innerHTML = ic(opts.icon || "t_umbral");
        $("rollDie").className = "die";''')
open(W,"w",encoding="utf-8").write(s)
print("parche 3 ok")
