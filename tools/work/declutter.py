import re
P="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/"
s=open(P+"ui.js",encoding="utf-8").read()
def rep(a,b,cnt=1):
    global s
    assert s.count(a)==cnt,(a[:60],s.count(a))
    s=s.replace(a,b)

# step hint corto tras la ronda 1
rep('setStep("Información privada: que nadie mire. Elige UNA acción; antes de confirmar verás qué hace.");',
    'setStep(s.round === 1 ? "Información privada: que nadie mire. Elige UNA acción; antes de confirmar verás qué hace." : "Información privada: que nadie mire.");')

# tentación: solo cuando aporta
rep('$("privateTemptation").classList.toggle("hidden", !!p.dead || (s.round % 2 === 0 && p.alignment !== "asesino"));',
    '''const cedeOpen = p.alignment !== "asesino" && s.assassinId === null && U.isUnlocked(p, D.ACTIONS.find(function (x) { return x.id === "ceder"; }));
    $("privateTemptation").classList.toggle("hidden", !!p.dead || !(s.round === 1 || (p.alignment === "asesino" && p.exposed) || (cedeOpen && s.round % 2 === 1)));''')

# pactos: línea corta
rep("'<div class=\"small muted\">Cumplirlo da +3 virtud a ambos. Romperlo: +8 corrupción, −6 virtud. Solo lo sabrá la otra persona.</div>'",
    "'<div class=\"small muted\">Cumplirlo: +3 virtud a ambos. Romperlo: −6 virtud, +8 corrupción.</div>'")

# consejos: los no críticos solo una vez por partida y jugador
rep('''    if (!a || advClosed[p.id + a.id + p.name]) { box.classList.add("hidden"); box.innerHTML = ""; return; }''',
'''    const crit = a && (a.id === "vitalidad" || a.id.indexOf("socorro") === 0);
    const akey = a ? p.id + a.id + p.name : "";
    if (a && !crit) { const sr = U.getState().round; if (advShown[akey] === undefined) advShown[akey] = sr; else if (advShown[akey] !== sr) a = null; }
    if (!a || advClosed[akey]) { box.classList.add("hidden"); box.innerHTML = ""; return; }''')
rep("const a = (p.dead || adviceOff()) ? null : adviceFor(p);","let a = (p.dead || adviceOff()) ? null : adviceFor(p);")
rep("const advClosed = {};","const advClosed = {}, advShown = {};")

# oferta: texto en un solo párrafo
rep('''<p class="small">' + esc(o.text) + '</p>' +
      '<p class="small">Aceptar: tiene un precio que el Umbral no dice en voz alta. ' + refuse +
      ' Si eliges una acción sin responder, cuenta como rechazo.</p>' +''',
'''<p class="small">' + esc(o.text) + '</p>' +
      '<p class="small muted">Aceptar tiene un precio oculto. ' + refuse +
      ' Sin responder, cuenta como rechazo.</p>' +''')

# ficha
i=s.index("  function renderSheet(p) {"); j=s.index("  const SHORT = {")
new_sheet = r'''  let showMagicHelp = false;
  const magicSeen = {};
  function renderSheet(p) {
    const items = p.items.length ? p.items.map(function (it, i) {
      const def = D.ITEMS[it.id];
      return '<div class="itemrow"><div><b>' + esc(def.name) + '</b><div class="small">' + esc(def.desc) + '</div></div>' +
        (def.kind === "weapon" ? '<span class="small">Se usa desde una acción</span>' : '<button class="ghost smallbtn" data-item="' + i + '"' + (p.usedItem ? " disabled" : "") + '>Usar</button>') + '</div>';
    }).join("") : "";
    const clues = p.clues.length ? p.clues.map(function (c) {
      return '<div class="clue"><span class="tag">FUERZA ' + c.strength + '</span> ' + esc(c.text) + '</div>';
    }).join("") : "";
    const hints = (p.hints || []).slice(-4);
    const notes = p.notes.slice(-4);
    const sts = (p.status || []).length ? p.status.map(function (s) { return D.STATUS[s.id].name + " (" + s.left + " ronda" + (s.left > 1 ? "s" : "") + "): " + D.STATUS[s.id].desc; }).join("<br>") : "";
    const hasMagic = (p.spells && p.spells.length) || (p.items || []).some(function (i) { return i.id === "grimorio"; });
    if (p.spells && p.spells.length && !magicSeen[p.id]) { magicSeen[p.id] = 1; showMagicHelp = true; }
    $("sheetSum").textContent = "Tu ficha" + (p.items.length ? " · " + p.items.length + " obj." : "") + (p.clues.length ? " · " + p.clues.length + " pista" + (p.clues.length > 1 ? "s" : "") : "") + ((p.spells || []).length ? " · " + p.spells.length + " conjuro" + (p.spells.length > 1 ? "s" : "") : "") + " · objetivo y notas";
    $("sheetBody").innerHTML =
      secretHTML(p) +
      (sts ? '<h3>Estados</h3><p class="small">' + sts + '</p>' : '') +
      (items ? '<h3>Objetos</h3>' + items + (p.usedItem ? '<p class="small muted">Ya has usado un objeto esta ronda.</p>' : '') : '') +
      (clues ? '<h3>Pistas <span class="small muted">· la fuerza pesa al acusar</span></h3>' + clues : '') +
      spellsHTML(p, hasMagic) +
      (hints.length ? '<h3>Intuiciones</h3><div class="notice small">' + hints.map(function (t) { return esc(t); }).join("<br>") + '</div>' : '') +
      (notes.length ? '<h3>Notas</h3><div class="notice small">' + notes.map(function (n) { return esc(n); }).join("<br>") + '</div>' : '');
    Array.prototype.forEach.call($("sheetBody").querySelectorAll("[data-item]"), function (b) {
      b.onclick = function () { onUseItem(Number(b.getAttribute("data-item"))); };
    });
    const mh = $("sheetBody").querySelector("[data-magichelp]");
    if (mh) mh.onclick = function () { showMagicHelp = !showMagicHelp; const wasOpen = $("playerInteractions").open; renderSheet(p); $("playerInteractions").open = wasOpen; };
  }

'''
s=s[:i]+new_sheet+s[j:]
# remove startGearNote
a=s.index("  function startGearNote(p) {"); b=s.index("  let showMagicHelp")
s=s[:a]+s[b:]

# spellsHTML
a=s.index("  function spellsHTML(p) {"); b=s.index("  const MODES = [")
newsp = r'''  function spellsHTML(p, hasMagic) {
    if (!hasMagic) return "";
    const grim = (p.items || []).some(function (i) { return i.id === "grimorio"; });
    const list = (p.spells || []).map(function (sp) {
      const pr = U.spellProgress(sp);
      return '<div class="small"><b>' + esc(sp.name) + '</b> <span class="chip mid">' + esc(pr.label) + '</span> ' + (sp.kind === "off" ? "Ofensivo" : "Defensivo") + ' · ' + sp.uses + ' uso' + (sp.uses > 1 ? "s" : "") + '</div>';
    }).join("");
    return '<h3>Conjuros</h3>' + (list || '<p class="small">Aún no conoces ninguno.</p>') +
      (grim ? '<p class="small">Tienes un grimorio: púlsalo en Objetos para estudiarlo.</p>' : '') +
      '<button class="ghost smallbtn" data-magichelp="1">' + (showMagicHelp ? "Ocultar ayuda" : "¿Cómo funciona la magia?") + '</button>' +
      (showMagicHelp ? '<div class="notice small">' + esc(MAGIA_VIAS) + (p.spells && p.spells.length ? '<br>' + p.spells.map(function (sp) { return '<b>' + esc(sp.name) + '</b>: ' + esc(sp.desc) + ' ' + esc(U.spellProgress(sp).next); }).join('<br>') : '') + '</div>' : '');
  }

'''
s=s[:a]+newsp+s[b:]

# secretHTML compacto
a=s.index("  function secretHTML(p) {"); b=s.index("  function secretOk(p, s) {")
newsec = r'''  function secretHTML(p) {
    const d = U.D.SECRETS.find(function (x) { return x.id === p.secret.id; });
    const ok = secretOk(p, U.getState());
    return '<div class="notice small"><b>Tu objetivo secreto' + (d && d.title ? ': ' + esc(d.title) : '') + '</b><br>' + esc(d ? d.text : p.secret.text) +
      (d && d.when ? '<br>' + esc(d.when) : '') +
      '<br>' + (ok ? '✦ Ahora mismo se cumple.' : '✧ Ahora mismo no se cumple.') + '</div>';
  }
'''
s=s[:a]+newsec+s[b:]
s=re.sub(r"  const FOCO_TXT = .*\n","",s)
open(P+"ui.js","w",encoding="utf-8").write(s)

h=open(P+"index.html",encoding="utf-8").read()
h=h.replace('<summary>Tu ficha: objetos, pistas, conjuros y notas</summary>','<summary id="sheetSum">Tu ficha</summary>')
h=h.replace('<b>Oscuridad</b>: no se ve el número','<b>Foco</b>: un empujón de concentración (máx. +2) que se gasta solo en tu próxima tirada: +1 foco equivale a −1 dificultad (el % que ves ya lo incluye). Se gana con Resistir, el Amuleto, la Vela, algunos eventos y, desde la segunda mitad de la partida, cada ronda que cumples tu objetivo secreto. <b>Oscuridad</b>: no se ve el número')
open(P+"index.html","w",encoding="utf-8").write(h)
