import re,sys
W="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/ui.js"
s=open(W,encoding="utf-8").read()
def rep(old,new,cnt=1):
    global s
    n=s.count(old)
    if n!=cnt: print("FALLO (%d veces, se esperaba %d):"%(n,cnt),old[:100]); sys.exit(1)
    s=s.replace(old,new)

# setPhaseIcon simple
rep('''function setPhaseIcon(key) { const el = $("phaseIcon"); if (el) el.innerHTML = key ? medal(key, "md", key === "ph_privado" ? "mist" : null).replace('class="medal md', 'class="medal md') : ""; }''',
'''function setPhaseIcon(key) { const el = $("phaseIcon"); if (!el) return; const k = ic(key); el.className = "phaseico f-" + famOf(key); el.innerHTML = k; }
  function renderEventBanner(ev) {
    const box = $("eventBanner"); if (!box) return;
    if (!ev) { box.classList.add("hidden"); box.innerHTML = ""; return; }
    box.classList.remove("hidden");
    box.innerHTML = medal("e_" + ev.id, "lg") + '<div><span class="evtag">El Umbral esta ronda</span>' + esc(eventLine(ev)) + "</div>";
  }''')

# ---------- ficha ----------
a=s.index("  function renderSheet(p) {"); b=s.index("  const SHORT = {")
s=s[:a]+r'''  function renderSheet(p) {
    const items = p.items.length ? p.items.map(function (it, i) {
      const def = D.ITEMS[it.id];
      const left = def.uses && def.uses > 1 ? ' <span class="small uses">(' + (it.left === undefined ? def.uses : it.left) + ' usos)</span>' : "";
      return '<div class="itemrow">' + medal("i_" + it.id, "md") + '<div class="ibody"><b>' + esc(def.name) + '</b>' + left + '<div class="small">' + esc(def.desc) + '</div></div>' +
        (def.kind === "weapon" ? '<span class="small">Se usa desde una acción</span>' : def.kind === "passive" ? '<span class="small">Pasivo: actúa solo</span>' : '<button class="ghost smallbtn" data-item="' + i + '"' + (p.usedItem ? " disabled" : "") + '>' + ic("ui_ok") + 'Usar</button>') + '</div>';
    }).join("") : "";
    const itemsBlock = items ? (p.items.length >= 4
      ? '<details class="items"><summary>' + ic("st_objetos") + 'Objetos (' + p.items.length + ')</summary>' + items + '</details>'
      : h3i("Objetos", "st_objetos") + items) + (p.usedItem ? '<p class="small muted">Ya has usado un objeto esta ronda.</p>' : '') : '';
    const clues = p.clues.length ? p.clues.map(function (c) {
      return '<div class="clue">' + ic("st_pistas") + '<span><span class="tag">FUERZA ' + c.strength + '</span> ' + esc(c.text) + '</span></div>';
    }).join("") : "";
    const hints = (p.hints || []).slice(-4);
    const hintSet = {}; (p.hints || []).forEach(function (t) { hintSet[t] = 1; });
    const notes = p.notes.filter(function (n) { return !hintSet[n.replace(/^Ronda \d+: /, "")]; }).slice(-4);
    const sts = (p.status || []).length ? p.status.map(function (s) { return '<div class="stline">' + ic("s_" + s.id) + '<span><b>' + esc(D.STATUS[s.id].name) + '</b> (' + s.left + " ronda" + (s.left > 1 ? "s" : "") + "): " + esc(D.STATUS[s.id].desc) + '</span></div>'; }).join("") : "";
    const hasMagic = (p.spells && p.spells.length) || (p.items || []).some(function (i) { return i.id === "grimorio"; });
    if (p.spells && p.spells.length && !magicSeen[p.id]) { magicSeen[p.id] = 1; showMagicHelp = true; }
    $("sheetSum").innerHTML = ic("ui_jugador") + "<span>" + "Tu ficha" + (p.items.length ? " · " + p.items.length + " obj." : "") + (p.clues.length ? " · " + p.clues.length + " pista" + (p.clues.length > 1 ? "s" : "") : "") + ((p.spells || []).length ? " · " + p.spells.length + " conjuro" + (p.spells.length > 1 ? "s" : "") : "") + "</span>";
    $("sheetBody").innerHTML =
      secretHTML(p) +
      (sts ? h3i("Estados", "s_herido") + sts : '') +
      itemsBlock +
      (clues ? h3i("", "st_pistas", 'Pistas <span class="small muted">· la fuerza pesa al acusar</span>') + clues : '') +
      spellsHTML(p, hasMagic) +
      (hints.length ? h3i("Intuiciones", "ui_pista") + '<div class="notice small">' + hints.map(function (t) { return esc(t); }).join("<br>") + '</div>' : '') +
      (notes.length ? h3i("Notas", "ui_log") + '<div class="notice small">' + notes.map(function (n) { return esc(n); }).join("<br>") + '</div>' : '');
    Array.prototype.forEach.call($("sheetBody").querySelectorAll("[data-item]"), function (b) {
      b.onclick = function () { onUseItem(Number(b.getAttribute("data-item"))); };
    });
    const mh = $("sheetBody").querySelector("[data-magichelp]");
    if (mh) mh.onclick = function () { showMagicHelp = !showMagicHelp; const wasOpen = $("playerInteractions").open; renderSheet(p); $("playerInteractions").open = wasOpen; };
  }

'''+s[b:]

# ---------- acciones: tile ----------
rep('''      btn.className = "tile" + (a.hostile ? " hostile" : "");
      btn.innerHTML = '<span class="tileName">' + esc(a.name) + '</span>' + '<span class="small tileShort">' + esc(SHORT[a.id] || "") + '</span>' + (chip ? '<span class="chip ' + chipCls + '">' + chip + '</span>' : '');''',
'''      btn.className = "tile" + (a.hostile ? " hostile" : "") + (isNew ? " isnew" : "");
      btn.innerHTML = medal("a_" + a.id, "lg") + '<span class="tileName">' + esc(a.name) + '</span>' + '<span class="small tileShort">' + esc(SHORT[a.id] || "") + '</span>' + (chip ? '<span class="chip ' + chipCls + '">' + chip + '</span>' : '');''')
rep('''n.innerHTML = '<b>Acción nueva: ' + esc(a.name) + '.</b> ' ''','''n.innerHTML = '<div class="nrow">' + medal("a_" + a.id, "sm") + '<span><b>Acción nueva: ' + esc(a.name) + '.</b> ' ''')
rep('''(va.main.indexOf(a) === -1 ? ' (la encuentras en «Más acciones»)' : '');
      box.appendChild(n);''','''(va.main.indexOf(a) === -1 ? ' (la encuentras en «Más acciones»)' : '') + '</span></div>';
      box.appendChild(n);''')
rep('''      tog.textContent = (showMoreActs ? "Ocultar" : "Más acciones") + " (" + va.hidden + ")";''','''      tog.innerHTML = va.more.map(function (g) { return ic(GROUP_ICON[g.id]); }).join("") + '<span>' + (showMoreActs ? "Ocultar" : "Más acciones") + " (" + va.hidden + ")</span>";''')
rep('''const h = document.createElement("div"); h.className = "tag"; h.textContent = g.label.toUpperCase(); box.appendChild(h);''','''const h = document.createElement("div"); h.className = "grouphead"; h.innerHTML = ic(GROUP_ICON[g.id]) + '<div class="tag"></div>'; h.querySelector(".tag").textContent = g.label.toUpperCase(); box.appendChild(h);''')

# hoja de acción
rep('''    $("actionSheetTag").textContent = a.tag;
    $("actionSheetTitle").textContent = a.name;''','''    $("actionSheetIcon").innerHTML = medal("a_" + a.id, "xl");
    $("actionSheetTag").textContent = a.tag;
    $("actionSheetTitle").textContent = a.name;''')
rep('''    $("btnActionChoose").textContent = "Elegir";
    $("actionOverlay").classList.remove("hidden");
  }

  function openInfoSheet(tag, title, desc, meta, label, fn) {
    sheetAction = { __confirm: fn };''','''    setLbl($("btnActionChoose"), "Elegir");
    $("actionOverlay").classList.remove("hidden");
  }

  function openInfoSheet(tag, title, desc, meta, label, fn, iconKey) {
    sheetAction = { __confirm: fn };
    $("actionSheetIcon").innerHTML = iconKey ? medal(iconKey, "xl") : "";''')
rep('''    $("btnActionChoose").textContent = label;
    $("actionOverlay").classList.remove("hidden");''','''    setLbl($("btnActionChoose"), label);
    $("actionOverlay").classList.remove("hidden");''')
rep('''def.kind === "tome" ? "Estudiar" : "Usar", function () { useItemConfirmed(index); });''','''def.kind === "tome" ? "Estudiar" : "Usar", function () { useItemConfirmed(index); }, "i_" + p.items[index].id);''')

# ---------- conjuros ----------
rep('''      return '<div class="small"><b>' + esc(sp.name) + '</b> <span class="chip mid">' + esc(pr.label) + '</span> ' + (sp.kind === "off" ? "Ofensivo" : "Defensivo") + ' · ' + sp.uses + ' uso' + (sp.uses > 1 ? "s" : "") + '</div>';
    }).join("");
    return '<h3>Conjuros</h3>' + (list || '<p class="small">Aún no conoces ninguno.</p>') +''','''      return '<div class="spellrow">' + spellMedals(sp) + '<div class="small"><b>' + esc(sp.name) + '</b> <span class="chip mid">' + ic("m_" + pr.level, "ic-sm") + " " + esc(pr.label) + '</span><br>' + (sp.kind === "off" ? "Ofensivo" : "Defensivo") + ' · ' + sp.uses + ' uso' + (sp.uses > 1 ? "s" : "") + '</div></div>';
    }).join("");
    return h3i("Conjuros", "a_conjurar") + (list || '<p class="small">Aún no conoces ninguno.</p>') +''')
rep('''      (grim ? '<p class="small">Tienes un grimorio: púlsalo en Objetos para estudiarlo.</p>' : '') +
      '<button class="ghost smallbtn" data-magichelp="1">' + (showMagicHelp ? "Ocultar ayuda" : "¿Cómo funciona la magia?") + '</button>' +''','''      (grim ? '<p class="small">Tienes un grimorio: púlsalo en Objetos para estudiarlo.</p>' : '') +
      '<button class="ghost smallbtn" data-magichelp="1">' + ic("ui_ayuda") + (showMagicHelp ? "Ocultar ayuda" : "¿Cómo funciona la magia?") + '</button>' +''')
rep('''  function spellsHTML(p, hasMagic) {''','''  /* Forma + aspecto del conjuro como medallón doble (la maestría va aparte, con su icono). */
  function spellMedals(sp) { return '<span class="medal md ' + "f-" + famOf("sp_" + sp.form) + '" aria-hidden="true">' + ic("sp_" + sp.form) + '</span>'; }
  function spellMinis(sp) {
    const pr = U.spellProgress(sp);
    return '<span class="minis">' + medal("as_" + sp.aspect, "sm") + medal("m_" + pr.level, "sm") + (sp.kind === "off" ? medal("a_enfrentar", "sm", "danger") : medal("a_proteger", "sm", "guard")) + '</span>';
  }
  function spellsHTML(p, hasMagic) {''')

# modos
rep('''        btn.innerHTML = '<b>' + m[1] + probChip(info.prob) + '</b><span class="small">' + esc(m[2]) + '</span><span class="small">Efecto: ' + esc(info.effect) + '</span>' +
          (info.cost.length ? '<span class="small">Coste: ' + esc(info.cost.join(" · ")) + '</span>' : '') +
          (info.mods.length ? '<span class="small">Influye: ' + esc(info.mods.join("; ")) + '</span>' : '');''','''        btn.innerHTML = medal("md_" + m[0], "md") + '<span class="cbody"><b>' + m[1] + probChip(info.prob) + '</b><span class="small">' + esc(m[2]) + '</span><span class="small">Efecto: ' + esc(info.effect) + '</span>' +
          (info.cost.length ? '<span class="small">Coste: ' + esc(info.cost.join(" · ")) + '</span>' : '') +
          (info.mods.length ? '<span class="small">Influye: ' + esc(info.mods.join("; ")) + '</span>' : '') + '</span>';''')
# conjuro objetivo
rep('''        btn.innerHTML = '<b>' + esc(t.name) + (info ? probChip(info.prob) : '') + '</b><span class="small">' + esc(U.visibleHealth(t)) + '</span>';
        btn.onclick = function () { pendingSpell = { id: sp0.id, tid: t.id }; renderPrivate(); };''','''        btn.innerHTML = playerMedal(t) + '<span class="cbody"><b>' + esc(t.name) + (info ? probChip(info.prob) : '') + '</b><span class="small">' + esc(U.visibleHealth(t)) + '</span></span>';
        btn.onclick = function () { pendingSpell = { id: sp0.id, tid: t.id }; renderPrivate(); };''')
# lista de conjuros
rep('''      btn.innerHTML = '<b>' + esc(sp.name) + (info ? probChip(info.prob) : '') + '</b>' + (info ? spellLine(sp, info) : '');
      btn.onclick = function () { pendingSpell = { id: sp.id, tid: null }; renderPrivate(); };''','''      btn.innerHTML = spellMedals(sp) + '<span class="cbody"><b>' + esc(sp.name) + (info ? probChip(info.prob) : '') + '</b>' + (info ? spellLine(sp, info) : '') + spellMinis(sp) + '</span>';
      btn.onclick = function () { pendingSpell = { id: sp.id, tid: null }; renderPrivate(); };''')
# estudiar
rep('''        btn.innerHTML = '<b>' + esc(sp.name) + '</b><span class="small">' + (sp.kind === "off" ? "Ofensivo" : "Defensivo") + ' · ' + esc(sp.desc) + ' · ' + sp.uses + ' uso' + (sp.uses > 1 ? "s" : "") + '</span>';''','''        btn.innerHTML = spellMedals(sp) + '<span class="cbody"><b>' + esc(sp.name) + '</b><span class="small">' + (sp.kind === "off" ? "Ofensivo" : "Defensivo") + ' · ' + esc(sp.desc) + ' · ' + sp.uses + ' uso' + (sp.uses > 1 ? "s" : "") + '</span><span class="minis">' + medal("as_" + sp.aspect, "sm") + '</span></span>';''')
rep('''        btn.innerHTML = '<b>Perfeccionar «' + esc(sp.name) + '»</b><span class="small">En vez de aprender uno nuevo, subes este conjuro de nivel (ahora: ' + esc(pr.label) + '). ' + esc(pr.next) + '</span>';''','''        btn.innerHTML = medal("a_perfeccionar", "md") + '<span class="cbody"><b>Perfeccionar «' + esc(sp.name) + '»</b><span class="small">En vez de aprender uno nuevo, subes este conjuro de nivel (ahora: ' + esc(pr.label) + '). ' + esc(pr.next) + '</span><span class="minis">' + medal("m_" + pr.level, "sm") + '</span></span>';''')
rep('''[["potente", "Potente", "Más intensidad, pero te mancha de oscuridad al lanzarlo."], ["estable", "Estable", "Un uso extra."], ["sutil", "Sutil", "No deja rastro público al lanzarlo."]].forEach(function (o) {
        const btn = document.createElement("button");
        btn.className = "choice";
        btn.innerHTML = '<b>' + o[1] + '</b><span class="small">' + o[2] + '</span>';''','''[["potente", "Potente", "Más intensidad, pero te mancha de oscuridad al lanzarlo.", "as_fuego", "danger"], ["estable", "Estable", "Un uso extra.", "a_resistir", "guard"], ["sutil", "Sutil", "No deja rastro público al lanzarlo.", "a_emboscada", "dark"]].forEach(function (o) {
        const btn = document.createElement("button");
        btn.className = "choice";
        btn.innerHTML = medal(o[3], "md", o[4]) + '<span class="cbody"><b>' + o[1] + '</b><span class="small">' + o[2] + '</span></span>';''')
# mano
rep('''      btn.innerHTML = '<b>' + o.name + '</b><span class="small">' + o.d + '</span>';
      btn.onclick = function () { const m = pendingMode; doAction(m.a, m.t, o.id); };''','''      btn.innerHTML = medal(o.id === "trampa" ? "a_romper" : "a_tender", "md", o.id === "trampa" ? "dark" : "heal") + '<span class="cbody"><b>' + o.name + '</b><span class="small">' + o.d + '</span></span>';
      btn.onclick = function () { const m = pendingMode; doAction(m.a, m.t, o.id); };''')
# objetivo de acción
rep('''      btn.innerHTML = '<b>' + esc(t.name) + '</b><span class="small">' + esc(U.visibleHealth(t)) + '</span>';
      btn.onclick = function () { if (pendingAction.mode)''','''      btn.innerHTML = playerMedal(t) + '<span class="cbody"><b>' + esc(t.name) + '</b><span class="small">' + esc(U.visibleHealth(t)) + '</span></span>';
      btn.onclick = function () { if (pendingAction.mode)''')
# envites
rep('''      btn.innerHTML = '<span class="choiceTop"><b>Envite ' + esc(st.name) + ' · ' + st.id + '</b><span class="chip risk">' + prob + '% éxito</span></span>' +
        '<span class="small">' + esc(st.desc) + ' Dificultad ' + st.diff + '.</span>' +
        '<span class="tagline">Si fallas: el Umbral cobra' + (st.wound ? " y te hiere" : "") + '.</span>';''','''      btn.innerHTML = medal("a_apostar", "md", st.id >= 20 ? "danger" : st.id >= 10 ? "ember" : "gold") + '<span class="cbody"><span class="choiceTop"><b>Envite ' + esc(st.name) + ' · ' + st.id + '</b><span class="chip risk">' + prob + '% éxito</span></span>' +
        '<span class="small">' + esc(st.desc) + ' Dificultad ' + st.diff + '.</span>' +
        '<span class="tagline">Si fallas: el Umbral cobra' + (st.wound ? " y te hiere" : "") + '.</span></span>';''')
# objeto sobre jugador
rep('''      btn.innerHTML = '<b>' + esc(t.name) + '</b><span class="small">' + esc(U.visibleHealth(t)) + '</span>';
      btn.onclick = function () {
        const r = U.useItem(p.id, pendingItem, t.id);''','''      btn.innerHTML = playerMedal(t) + '<span class="cbody"><b>' + esc(t.name) + '</b><span class="small">' + esc(U.visibleHealth(t)) + '</span></span>';
      btn.onclick = function () {
        const r = U.useItem(p.id, pendingItem, t.id);''')
# cancelar
rep('''    b.className = "ghost";
    b.textContent = "Cancelar";''','''    b.className = "ghost";
    b.innerHTML = ic("ui_cerrar") + "Cancelar";''')
# helper playerMedal (público: solo muestra lo visible)
rep('''  function addCancel(box) {''','''  /* Medallón de un jugador: solo estado público (vivo / necesita socorro / eliminado). */
  function playerMedal(t) { return medal(t.dead ? "s_muerto" : t.dying ? "s_moribundo" : "ui_jugador", "md", t.dead ? "mist" : t.dying ? "danger" : "gold"); }
  function addCancel(box) {''')

# showRoll icono: doAction / push / cast / encuentro / resolución
rep('''    showRoll({ title: a.name.toUpperCase(), result: res, text: res.outcome, buttons: buttons });''','''    showRoll({ title: a.name.toUpperCase(), icon: "a_" + a.id, result: res, text: res.outcome, buttons: buttons });''')
rep('''showRoll({ title: "FORZAR EL DESTINO", result: r,''','''showRoll({ title: "FORZAR EL DESTINO", icon: "ui_critico", result: r,''')
rep('''showRoll({ title: "CONJURO", result: res,''','''showRoll({ title: "CONJURO", icon: "a_conjurar", result: res,''')
rep('''showRoll({ title: e.name.toUpperCase(), result: r, text: r.outcome,''','''showRoll({ title: e.name.toUpperCase(), icon: "e_viajero", result: r, text: r.outcome,''')
rep('''showRoll({ title: "ENCUENTRO: " + e.name.toUpperCase(), result: {},''','''showRoll({ title: "ENCUENTRO: " + e.name.toUpperCase(), icon: "e_viajero", result: {},''')
rep('''showRoll({ title: "RESOLUCIÓN PÚBLICA", result:''','''showRoll({ title: "RESOLUCIÓN PÚBLICA", icon: list[i].type === "acusacion" ? "a_acusar" : list[i].type === "emboscada" ? "a_enfrentar" : list[i].type === "romper" ? "a_romper" : "ph_resolucion", result:''')

open(W,"w",encoding="utf-8").write(s)
print("parche 2 ok")
