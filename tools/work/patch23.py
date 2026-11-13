import sys
W = "/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/"
def rep(f, old, new, count=1):
    p = W + f
    s = open(p, encoding="utf-8").read()
    n = s.count(old)
    if n != count: sys.exit("FAIL %s count=%d :: %r" % (f, n, old[:90]))
    open(p, "w", encoding="utf-8").write(s.replace(old, new))
LORE = {
 "investigar":"Quien sigue rastros acaba viendo lo que otros callan; la práctica afina la mente.",
 "proteger":"Jurar protección a otros abre la puerta a promesas más delicadas.",
 "explorar":"Entre las ruinas hay más que objetos: algunos libros guardan lo que no debería leerse.",
 "meditar":"Aprender a callar los susurros enseña también a escuchar solo lo que quieres.",
 "robar":"Las manos ágiles recuerdan todo lo que han tomado.",
 "hechizar":"Las palabras prohibidas se pegan a la lengua y piden más.",
 "apostar":"Quien juega contra el Umbral aprende cuánto vale su suerte.",
 "ceder":"Cada concesión hace más persuasivo al siguiente susurro.",
 "resistir":"Negarse deja una cicatriz de claridad.",
 "cazar":"Solo quien ya pertenece a la noche conoce este camino.",
 "apunalar":"El filo termina enseñando a su dueño.",
 "envenenar":"Los frascos guardan pacientes.",
 "maldecir":"Un pergamino bien leído no se olvida.",
 "aturdir":"La fuerza bruta también tiene sus maneras.",
 "devorar":"Hay hambres que no se confiesan.",
 "descansar":"Quien sana aprende a esperar.",
 "entrenar":"El esfuerzo repetido deja huella en el cuerpo.",
 "tender":"Una mano abierta puede ser refugio o cebo; solo quien la tiende lo sabe.",
 "conjurar":"Cada conjuro bien lanzado se asienta un poco más en tu memoria.",
}
s = open(W+"data.js", encoding="utf-8").read()
for k,v in LORE.items():
    a = '{ id: "%s",' % k
    if s.count(a) != 1: sys.exit("data " + k + " " + str(s.count(a)))
    s = s.replace(a, '{ id: "%s", lore: "%s",' % (k, v))
open(W+"data.js","w",encoding="utf-8").write(s)

e="engine.js"; u="ui.js"
rep(e,"    sp.power = 1 + (asp.power || 0) + (sp.tune === \"potente\" ? 1 : 0);","    sp.power = 1 + (asp.power || 0) + (sp.tune === \"potente\" ? 1 : 0) + (sp.mastered ? 1 : 0);")
rep(e,'''" Sutil: no deja rastro público." : "";''','''" Sutil: no deja rastro público." : "";
    const mastTxt = sp.mastered ? " Dominado: más intensidad." : "";''')
rep(e,'+ "." + tuneTxt;','+ "." + tuneTxt + mastTxt;')
rep(e,"    sp.uses -= 1;\n    if (sp.uses <= 0) p.spells = p.spells.filter(function (s) { return s !== sp; });\n","    sp.uses -= 1;\n")
rep(e,"    p.acted = true; p.action = off ? \"conjuro_of\" : \"conjuro_def\";",'''    if (res.success) {
      sp.wins = (sp.wins || 0) + 1;
      if (sp.wins >= 2 && !sp.mastered) {
        sp.mastered = true; sp.uses += 1;
        const oldName = sp.name;
        finalizeSpell(sp);
        text += " Las palabras de «" + oldName + "» ya no se te resisten: lo has dominado.";
        p.notes.push("Ronda " + state.round + ": dominaste «" + oldName + "».");
      }
    }
    if (sp.uses <= 0) p.spells = p.spells.filter(function (s) { return s !== sp; });
    p.acted = true; p.action = off ? "conjuro_of" : "conjuro_def";''')
rep(e,"          const it = pick(D.LOOT_ITEMS);\n          p.items.push(mkItem(it));\n          const possible = others(p);","          const it = Math.random() < 0.2 ? \"grimorio\" : pick(D.LOOT_ITEMS);\n          p.items.push(mkItem(it));\n          const possible = others(p);")
# UI
rep(u,'''    $("actionSheetDesc").textContent = a.desc;
    $("actionSheetMeta").textContent = meta;''','''    $("actionSheetDesc").textContent = a.desc;
    $("actionSheetLore").textContent = a.lore ? "«" + a.lore + "»" : "";
    $("actionSheetMeta").textContent = meta;''')
rep(u,'''    $("actionSheetDesc").textContent = desc;
    $("actionSheetMeta").textContent = meta;''','''    $("actionSheetDesc").textContent = desc;
    $("actionSheetLore").textContent = "";
    $("actionSheetMeta").textContent = meta;''')
rep(u,"+ ' · ' + sp.uses + ' uso' + (sp.uses > 1 ? \"s\" : \"\") + '</div></div></div>';","+ ' · ' + sp.uses + ' uso' + (sp.uses > 1 ? \"s\" : \"\") + (sp.mastered ? ' · Dominado' : sp.wins ? ' · empieza a obedecerte' : '') + '</div></div></div>';")
rep(u,"""btn.innerHTML = '<b>' + esc(sp.name) + '</b><span class="small">' + esc(sp.desc) + ' · ' + sp.uses + ' uso' + (sp.uses > 1 ? "s" : "") + '</span>';
      btn.onclick = function () { if (sp.target)""","""btn.innerHTML = '<b>' + esc(sp.name) + '</b><span class="small">' + esc(sp.desc) + ' · ' + sp.uses + ' uso' + (sp.uses > 1 ? "s" : "") + (sp.mastered ? ' · Dominado' : sp.wins ? ' · empieza a obedecerte' : '') + '</span>';
      btn.onclick = function () { if (sp.target)""")
rep("index.html",'    <p id="actionSheetDesc"></p>','    <p id="actionSheetDesc"></p>\n    <p id="actionSheetLore" class="small muted" style="font-style:italic"></p>')
rep("index.html","Cada conjuro se compone de una forma, un aspecto y un ajuste que eliges al estudiarlo; los hay ofensivos y defensivos, con usos limitados.","Los grimorios aparecen al explorar, en eventos y en tratos. Cada conjuro se compone de una forma, un aspecto y un ajuste que eliges al estudiarlo; los hay ofensivos y defensivos, con usos limitados. Cada éxito lo afianza: tras dos aciertos lo dominas (más intensidad y un uso extra). Las runas añaden usos.")
print("OK")
