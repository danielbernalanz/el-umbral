import re,sys
W="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/ui.js"
s=open(W,encoding="utf-8").read()
def rep(old,new,cnt=1):
    global s
    n=s.count(old)
    if n!=cnt: print("FALLO (%d veces, se esperaba %d):"%(n,cnt),old[:90]); sys.exit(1)
    s=s.replace(old,new)

rep("/* EL UMBRAL — interfaz (v1.0.1) */","/* EL UMBRAL — interfaz (v1.1.0) */")

# ---------- helpers de iconos ----------
rep("  function pad2(n) { return (n < 10 ? \"0\" : \"\") + n; }\n", r'''  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  /* ---------------- iconos (sprites incrustados en index.html; ver img/sprites-map.js) ---------------- */
  function ic(key, cls) { try { return typeof window.icon === "function" && key ? window.icon(key, cls) : ""; } catch (e) { return ""; } }
  const FAMS = {
    a_investigar: "lore", a_proteger: "guard", a_explorar: "ember", a_meditar: "lore", a_robar: "dark", a_hechizar: "dark", a_apostar: "ember", a_ceder: "dark", a_resistir: "guard",
    a_cazar: "danger", a_apunalar: "danger", a_envenenar: "dark", a_maldecir: "dark", a_aturdir: "danger", a_devorar: "danger", a_descansar: "heal", a_conjurar: "lore", a_tender: "heal",
    a_socorrer: "heal", a_sombra_espia: "dark", a_sombra_guarda: "dark", a_sombra_hostiga: "dark", a_alzar: "dark", a_entrenar: "ember", a_acusar: "danger", a_enfrentar: "danger",
    a_romper: "danger", a_pacto: "gold", a_estudiar: "lore", a_aprender: "lore", a_perfeccionar: "lore", a_abstener: "mist",
    sp_rayo: "danger", sp_plaga: "dark", sp_marchitar: "danger", sp_grillete: "dark", sp_maleficio: "dark", sp_drenar: "dark", sp_pesadilla: "dark", sp_egida: "guard", sp_sanar: "heal", sp_velo: "guard", sp_purga: "heal", sp_reflejo: "guard", sp_presagio: "lore",
    as_fuego: "ember", as_hielo: "lore", as_luz: "gold", as_sangre: "danger", as_sombra: "dark", as_vacio: "dark",
    f_combatiente: "danger", f_erudito: "lore", f_sanadora: "heal", f_ladron: "dark", f_vidente: "lore", f_centinela: "guard",
    s_fortalecido: "heal", s_maldito: "dark", s_veneno: "dark", s_aturdido: "mist", s_muerto: "mist",
    st_vitalidad: "danger", st_virtud: "heal", st_sombra: "dark", st_corrupcion: "dark", st_cuerpo: "ember", st_mente: "lore", st_foco: "gold", st_pistas: "lore", st_objetos: "gold", st_conjuros: "dark",
    md_cauto: "guard", md_normal: "gold", md_desatado: "danger", t_asesino: "danger", ui_exito: "heal", ui_fallo: "danger", ui_critico: "ember",
    ph_privado: "mist", ph_consejo: "lore", ph_resolucion: "ember", ph_desenlace: "mist", ph_prep: "gold"
  };
  const ITEM_FAM = { heal: "heal", cleanse: "heal", purify: "heal", elixir: "heal", virtue: "heal", defense: "guard", shield: "guard", ward: "guard", reflect: "guard", fog: "guard", passive: "guard", weapon: "danger", tome: "lore", clue: "lore", lens: "lore", lantern: "lore", rune: "lore", prep: "ember", focus: "gold", corruption: "dark", ritual: "dark", dust: "dark", event: "dark", state: "dark" };
  const EV_FAM = { heal: "heal", virtue: "heal", corruption: "dark", item: "gold", clue: "lore" };
  function famOf(key) {
    if (FAMS[key]) return FAMS[key];
    if (key.indexOf("i_") === 0) { const d = D.ITEMS[key.slice(2)]; return (d && ITEM_FAM[d.kind]) || "gold"; }
    if (key.indexOf("e_") === 0) { const d = D.EVENTS.find(function (x) { return "e_" + x.id === key; }); return (d && EV_FAM[d.fx]) || "mist"; }
    if (key.indexOf("t_") === 0) return "dark";
    if (key.indexOf("z_") === 0) return "mist";
    if (key.indexOf("m_") === 0 || key.indexOf("p_") === 0 || key.indexOf("x_") === 0 || key.indexOf("r_") === 0) return "gold";
    return "gold";
  }
  function medal(key, size, fam, extra) {
    const k = ic(key); if (!k) return "";
    return '<span class="medal ' + (size || "md") + " f-" + (fam || famOf(key)) + (extra ? " " + extra : "") + '" aria-hidden="true">' + k + "</span>";
  }
  function tagH(text, key) { return '<div class="tag">' + ic(key, "ic-tag") + esc(text) + "</div>"; }
  function h3i(text, key, extra) { return '<h3 class="h3i">' + ic(key) + "<span>" + (extra || esc(text)) + "</span></h3>"; }
  function setLbl(el, text) { if (!el) return; const l = el.querySelector(".lbl"); if (l) l.textContent = text; else el.textContent = text; }
  function setIcoBtn(el, key, text) { el.innerHTML = ic(key) + '<span class="lbl">' + esc(text) + "</span>"; }
  /* Iconos estáticos del HTML: <x data-ic="clave" data-ic-cls="clase"> recibe el icono al principio. */
  function decorate(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll("[data-ic]"), function (el) {
      if (el.getAttribute("data-icdone")) return;
      el.setAttribute("data-icdone", "1");
      const key = el.getAttribute("data-ic"), cls = el.getAttribute("data-ic-cls") || (el.classList.contains("tag") ? "ic-tag" : "");
      const h = ic(key, cls); if (!h) return;
      if (el.classList.contains("bigmedal")) el.classList.add("f-" + famOf(key));
      el.insertAdjacentHTML("afterbegin", h);
    });
  }
  function setPhaseIcon(key) { const el = $("phaseIcon"); if (el) el.innerHTML = key ? medal(key, "md", key === "ph_privado" ? "mist" : null).replace('class="medal md', 'class="medal md') : ""; }
  const GROUP_ICON = { recuperacion: "a_descansar", pactos: "p_pacto", sucias: "a_apostar", armas: "a_apunalar", sombras: "t_sombras" };
''')

# init
rep("  function init() {\n    const sv = U.hasSave();","  function init() {\n    decorate(document);\n    const sv = U.hasSave();")
rep('    $("btnHelp").onclick = function () { $("helpOverlay").classList.remove("hidden"); };',
    '    $("btnHelp").onclick = function () { $("helpOverlay").classList.remove("hidden"); };\n    /* Créditos: solo existen en el menú principal (el botón vive en #start). */\n    if ($("btnCredits")) $("btnCredits").onclick = function () { try { if (typeof window.umbralShowCredits === "function") window.umbralShowCredits(); } catch (e) { toast("No se pudieron abrir los créditos.", true); } };')
rep('$("btnAdviceToggle").textContent = adviceOff() ? "Activar los consejos de la partida" : "Desactivar los consejos de la partida";\n      toast(','setLbl($("btnAdviceToggle"), adviceOff() ? "Activar los consejos de la partida" : "Desactivar los consejos de la partida");\n      toast(')
rep('$("btnHelp").addEventListener("click", function () { $("btnAdviceToggle").textContent = adviceOff() ? "Activar los consejos de la partida" : "Desactivar los consejos de la partida"; });',
    '$("btnHelp").addEventListener("click", function () { setLbl($("btnAdviceToggle"), adviceOff() ? "Activar los consejos de la partida" : "Desactivar los consejos de la partida"); });')

# ---------- statsHTML ----------
a=s.index("  function statsHTML(p) {"); b=s.index("  function renderPrivate() {")
s=s[:a]+r'''  function statsHTML(p) {
    const status = [];
    const hi = U.healthInfo(p);
    const chips = (hi.status || []).map(function (id) { return { k: "s_" + id, t: D.STATUS[id] ? D.STATUS[id].name : id }; });
    if (hi.shock && !chips.some(function (c) { return c.t === "Shock"; })) chips.push({ k: "s_shock", t: "Shock" });
    if (hi.dying) chips.unshift({ k: "s_moribundo", t: "Moribundo" });
    const vcls = hi.pct <= 30 ? "low" : hi.pct <= 60 ? "mid" : "good";
    if (p.focus) status.push({ k: "st_foco", t: "Foco +" + p.focus + " (−" + p.focus + " dificultad en tu próxima tirada)" });
    if (p.shield) status.push({ k: "i_coartada", t: "Coartada" });
    if (p.protection !== null) status.push({ k: "a_proteger", t: "Protegido" });
    if (p.roundDefense) status.push({ k: "a_resistir", t: "Defensa +" + p.roundDefense });
    if (p.roundAttack) status.push({ k: "a_enfrentar", t: "Ataque +" + p.roundAttack });
    const dm = U.domInfo(p);
    if (dm.level >= 1) status.push({ k: "t_sombras", t: "Dominio de las sombras: " + dm.name });
    (p.risen || []).forEach(function (id) { const sh = U.getState().players[id]; if (sh && sh.risenBy === p.id) status.push({ k: "a_alzar", t: "Sombra servidora: " + sh.name }); });
    let hearts = "";
    for (let i = 0; i < hi.max; i++) hearts += ic("st_vitalidad", i < hi.hp ? "" : "off");
    const zones = (hi.zones || []).map(function (z) {
      const lab = z.lvl >= 2 ? " grave" : z.lvl >= 1 ? " " + (z.dmg ? "−" + z.dmg : "dañado") : "";
      return '<span class="zone l' + Math.min(2, z.lvl) + '">' + ic("z_" + z.id) + esc(z.name + lab) + "</span>";
    }).join("");
    const attr = function (k, label, val) { return '<div class="attr f-' + famOf(k) + '"><span style="color:var(--ic)">' + ic(k) + "</span><b>" + val + "</b><span>" + label + "</span></div>"; };
    return '<div class="player">' +
      '<div class="srow"><span class="lab f-heal"><span style="color:var(--ic)">' + ic("st_virtud") + '</span>Virtud <b>' + p.virtue + '</b></span><span class="darkline">' + ic("st_sombra") + darkLine(p) + '</span></div>' +
      '<div class="meter"><span class="virtue" style="width:' + p.virtue + '%"></span></div>' +
      '<div class="srow"><span class="lab f-danger"><span style="color:var(--ic)">' + ic("st_vitalidad") + '</span>Vitalidad <b>' + hi.hp + '/' + hi.max + '</b></span></div>' +
      '<div class="hearts' + (hi.pct <= 30 || hi.dying ? " crit" : "") + '" aria-hidden="true">' + hearts + '</div>' +
      '<div class="zones">' + zones + '</div>' +
      (chips.length ? '<div class="chips">' + chips.map(function (c) { return '<span class="schip ' + (c.k === "s_fortalecido" ? "good" : "bad") + '">' + ic(c.k) + esc(c.t) + '</span>'; }).join("") + '</div>' : '') +
      '<div class="attrs">' + attr("st_cuerpo", "Cuerpo", p.stats.cuerpo) + attr("st_mente", "Mente", p.stats.mente) + attr("st_sombra", "Sombra", p.stats.sombra) + attr("st_objetos", "Objetos", p.items.length) + attr("st_pistas", "Pistas", p.clues.length) + '</div>' +
      practiceLine(p) +
      status.map(function (x) { return '<div class="stline">' + ic(x.k) + '<span>' + esc(x.t) + '</span></div>'; }).join("") +
      '</div>';
  }

'''+s[b:]

# privado
rep('    $("phaseTag").textContent = "TURNO PRIVADO";\n    $("screenTitle").textContent = "Turno de " + p.name;','    $("phaseTag").textContent = "TURNO PRIVADO"; setPhaseIcon("ph_privado");\n    $("screenTitle").textContent = "Turno de " + p.name;')
rep('    $("privateName").textContent = p.name;\n    $("privateRole").textContent = p.role.name + " · " + p.affinity.name;',
    '    $("privateName").textContent = p.name;\n    $("privateAvatar").innerHTML = medal("r_" + p.role.id, "lg");\n    $("privateRole").innerHTML = ic("r_" + p.role.id) + esc(p.role.name) + " · " + ic("f_" + p.affinity.id) + esc(p.affinity.name);\n    { const sk0 = U.secretInfo(p.id); setIcoBtn($("btnSecret"), sk0 ? "x_" + sk0.id : "x_poder", "Mi secreto"); }')
rep('    $("privateGear").textContent = gf; $("privateGear").classList.toggle("hidden", !gf);\n    $("privateStory").textContent = eventLine(s.event);',
    '    $("privateGear").className = "gearline" + (gf ? "" : " hidden"); $("privateGear").innerHTML = gf ? ic("st_objetos", "ic-md") + "<span>" + esc(gf) + "</span>" : "";\n    $("privateStory").textContent = eventLine(s.event);\n    renderEventBanner(s.event);')
# tentación
ln_start=s.index('    $("privateTemptation").textContent = p.alignment === "asesino"')
ln_end=s.index("\n",ln_start)
line=s[ln_start:ln_end]
line=line.replace('$("privateTemptation").textContent = ','const ttxt = ',1)
line+='\n    $("privateTemptation").innerHTML = \'<div class="nrow">\' + medal(p.alignment === "asesino" ? "t_asesino" : "t_tentacion", "sm") + "<span>" + esc(ttxt) + "</span></div>";'
s=s[:ln_start]+line+s[ln_end:]

# pactos
rep('''      return '<div class="small"><b>Pacto de ' + esc(x.label)''','''      return '<div class="stline">' + ic("p_" + String(x.type).replace("pacto_", "")) + '<span><b>Pacto de ' + esc(x.label)''')
rep("esc(x.terms) + '</div>';\n    }).join(\"\");","esc(x.terms) + '</span></div>';\n    }).join(\"\");")
rep('''box.innerHTML = '<div class="tag">DESDE TU ÚLTIMO TURNO</div>' + wtxt''','''box.innerHTML = tagH("DESDE TU ÚLTIMO TURNO", "ui_ronda") + wtxt''')
rep('''box.innerHTML = '<div class="tag">PACTOS VIGENTES</div>' + pactsHTML(l)''','''box.innerHTML = tagH("PACTOS VIGENTES", "p_pacto") + pactsHTML(l)''')
rep('''box.innerHTML = '<div class="tag">CONSEJO</div><p class="small">' + esc(a.text) + '</p>' +
      '<div class="row"><button class="ghost smallbtn" id="advClose">Cerrar</button></div>';''','''box.innerHTML = tagH("CONSEJO", "ui_pista") + '<p class="small">' + esc(a.text) + '</p>' +
      '<div class="row"><button class="ghost smallbtn" id="advClose">' + ic("ui_cerrar") + 'Cerrar</button></div>';''')

# ofertas
rep('''box.innerHTML = '<div class="tag">' + esc(o.title) + '</div><p class="small">' + esc(o.text) + '</p>' +
        '<p class="small"><b>Ganas</b></p>' + o.gains.map(function (g) { return '<div class="small">+ ' + esc(g) + '</div>'; }).join("") +
        '<p class="small"><b>Pierdes</b></p>' + o.losses.map(function (g) { return '<div class="small">− ' + esc(g) + '</div>'; }).join("") +''','''box.innerHTML = tagH(o.title, "t_asesino") + '<p class="small">' + esc(o.text) + '</p>' +
        '<p class="small"><b>Ganas</b></p>' + o.gains.map(function (g) { return '<div class="stline"><span class="f-heal" style="color:var(--ic)">' + ic("ui_exito") + '</span><span>+ ' + esc(g) + '</span></div>'; }).join("") +
        '<p class="small"><b>Pierdes</b></p>' + o.losses.map(function (g) { return '<div class="stline"><span class="f-danger" style="color:var(--ic)">' + ic("ui_fallo") + '</span><span>− ' + esc(g) + '</span></div>'; }).join("") +''')
rep('''<div class="row"><button class="danger smallbtn" id="offerYes">Convertirme en Asesino</button><button class="primary smallbtn" id="offerNo">Rechazar</button></div>';''','''<div class="row"><button class="danger smallbtn" id="offerYes">' + ic("t_asesino") + 'Convertirme en Asesino</button><button class="primary smallbtn" id="offerNo">' + ic("a_resistir") + 'Rechazar</button></div>';''')
rep('''box.innerHTML = '<div class="tag">TRATO DEL UMBRAL</div><p class="small">' + esc(o.text) + '</p>' +''','''box.innerHTML = tagH("TRATO DEL UMBRAL", "t_umbral") + '<p class="small">' + esc(o.text) + '</p>' +''')
rep('''<div class="row"><button class="primary smallbtn" id="offerYes">Aceptar</button><button class="ghost smallbtn" id="offerNo">Rechazar</button></div>';''','''<div class="row"><button class="primary smallbtn" id="offerYes">' + ic("ui_ok") + 'Aceptar</button><button class="ghost smallbtn" id="offerNo">' + ic("ui_cerrar") + 'Rechazar</button></div>';''')
rep('''box.innerHTML = '<div class="tag">UNA MANO TENDIDA</div><p class="small">' ''','''box.innerHTML = tagH("UNA MANO TENDIDA", "a_tender") + '<p class="small">' ''')
rep('''<div class="row"><button class="primary smallbtn" id="handYes">Confiar y callar</button><button class="ghost smallbtn" id="handNo">Rechazar</button></div>';''','''<div class="row"><button class="primary smallbtn" id="handYes">' + ic("a_tender") + 'Confiar y callar</button><button class="ghost smallbtn" id="handNo">' + ic("ui_cerrar") + 'Rechazar</button></div>';''')
rep('''return '<div class="tag">PACTO PROPUESTO EN SECRETO</div><p class="small"><b>' ''','''return tagH("PACTO PROPUESTO EN SECRETO", "p_" + String(o.type).replace("pacto_", "")) + '<p class="small"><b>' ''')
rep('''<div class="row"><button class="primary smallbtn" data-pact="' + o.idx + '" data-yes="1">Aceptar</button><button class="ghost smallbtn" data-pact="' + o.idx + '">Rechazar</button></div>';''','''<div class="row"><button class="primary smallbtn" data-pact="' + o.idx + '" data-yes="1">' + ic("ui_ok") + 'Aceptar</button><button class="ghost smallbtn" data-pact="' + o.idx + '">' + ic("ui_cerrar") + 'Rechazar</button></div>';''')

open(W,"w",encoding="utf-8").write(s)
print("parche 1 ok")
