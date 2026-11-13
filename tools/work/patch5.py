import sys
W = "/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/"
def rep(f, old, new, count=1):
    p = W + f
    s = open(p, encoding="utf-8").read()
    n = s.count(old)
    if n != count: sys.exit("FAIL %s count=%d :: %r" % (f, n, old[:90]))
    open(p, "w", encoding="utf-8").write(s.replace(old, new))

# --- data.js ---
rep("data.js", 'canTarget: function (t) { return t.wounds >= 2 || (t.status || []).some(function (s) { return s.id === "aturdido"; }); }, desc: "Solo contra quien tenga 2 heridas o esté aturdido. Si tienes éxito, eliminas a la víctima, heredas sus objetos, recuperas una herida, +6 corrupción, -6 virtud y +1 a un atributo al azar. Si fallas, pierdes una herida." }',
    'canTarget: function (t) { return t.wounds >= 2 || ((t.status || []).some(function (s) { return s.id === "aturdido"; }) && t.wounds >= 1); }, desc: "Solo contra quien tenga 2 heridas, o aturdido con al menos 1. Si tienes éxito, eliminas a la víctima, heredas sus objetos, recuperas una herida, +6 corrupción, -6 virtud y +1 a un atributo al azar. Si fallas, pierdes una herida." }')
rep("data.js", '{ id: "devorar", name: "Devorar", tag: "CANIBALISMO", attr: "cuerpo", target: true, diff: 4,',
    '{ id: "devorar", name: "Devorar", tag: "CANIBALISMO", attr: "cuerpo", target: true, diff: 5,')
rep("data.js", 'desc: "Vendas la herida: -1 herida y se van el sangrado y el veneno." }',
    'desc: "Vendas la herida: -1 herida y se van el sangrado y el veneno. El alivio te cuesta +3 corrupción." }')

# --- engine.js ---
rep("engine.js", "  const COUNCIL_SECONDS = 90;",
    "  const COUNCIL_SECONDS = 90;\n  /* Acciones que cuentan como hostiles para pactos y amenazas. */\n  const HOSTILE = [\"robar\", \"hechizar\", \"cazar\", \"apunalar\", \"envenenar\", \"maldecir\", \"aturdir\", \"devorar\"];")
rep("engine.js", '      const hostileA = (a.action === "robar" || a.action === "hechizar" || a.action === "cazar") && a.actionTarget === b.id;',
    '      const hostileA = HOSTILE.indexOf(a.action) !== -1 && a.actionTarget === b.id;')
rep("engine.js", '      const hostileB = (b.action === "robar" || b.action === "hechizar" || b.action === "cazar") && b.actionTarget === a.id;',
    '      const hostileB = HOSTILE.indexOf(b.action) !== -1 && b.actionTarget === a.id;')
rep("engine.js", '      const attacked = ((to.action === "robar" || to.action === "hechizar" || to.action === "cazar") && to.actionTarget === from.id) ||',
    '      const attacked = (HOSTILE.indexOf(to.action) !== -1 && to.actionTarget === from.id) ||')
rep("engine.js", '    if (!r.blocked && ["robar", "hechizar", "cazar", "proteger", "ceder"].indexOf(a.id) !== -1) {',
    '    if (!r.blocked && ["robar", "hechizar", "cazar", "proteger", "ceder", "apunalar", "envenenar", "maldecir", "aturdir", "devorar"].indexOf(a.id) !== -1) {')
rep("engine.js", '''      case "ceder": return { text: pre + "la voz de " + n + " cambió tras la última campanada, como si algo respondiera por ella.", bonus: 1 };''',
'''      case "ceder": return { text: pre + "la voz de " + n + " cambió tras la última campanada, como si algo respondiera por ella.", bonus: 1 };
      case "apunalar": return { text: pre + (d.ok ? other + " apareció herido y " + n + " tenía sangre en la manga." : n + " rondaba a " + other + " con un arma en la mano."), bonus: 1 };
      case "envenenar": return { text: pre + (d.ok ? other + " enfermó de golpe, justo después de cruzarse con " + n + "." : "un frasco de veneno desapareció cerca de " + n + "."), bonus: 1 };
      case "maldecir": return { text: pre + "se oyó un rezo torcido cerca de " + other + "; la voz era la de " + n + ".", bonus: 1 };
      case "aturdir": return { text: pre + (d.ok ? other + " apareció aturdido y " + n + " estaba a su lado." : n + " se acercó a " + other + " con mala intención."), bonus: 1 };
      case "devorar": return { text: pre + "solo quedaron restos cerca de " + other + "; " + n + " tenía la boca manchada.", bonus: 2 };''')
rep("engine.js", "      case \"descansar\": {\n", "      case \"descansar\": {\n        p.corr = clamp(p.corr + 3, 0, 100);\n") if False else None
rep("engine.js", '''        p.wounds = Math.max(0, p.wounds - 1);
        dropStatus(p, "sangrado"); dropStatus(p, "veneno");
        return { text: "Vendas la herida y te recuperas: -1 herida, y se van el sangrado y el veneno.", log: null };''',
'''        p.wounds = Math.max(0, p.wounds - 1);
        p.corr = clamp(p.corr + 3, 0, 100);
        dropStatus(p, "sangrado"); dropStatus(p, "veneno");
        return { text: "Vendas la herida y te recuperas: -1 herida, se van el sangrado y el veneno, y el alivio te cuesta +3 corrupción.", log: null };''')
rep("engine.js", '''            t.acted = true; t.action = "aturdido";''', '''            t.acted = true;''')
rep("engine.js", "const defBonus = t.stats.cuerpo + Math.floor(t.stats.mente / 2) + t.roundDefense + dFocus +",
    "const defBonus = t.stats.cuerpo + Math.floor(t.stats.mente / 2) + t.roundDefense + dFocus + statusMod(t) +")
rep("engine.js", "const defBonus = target.stats.cuerpo + Math.floor(target.stats.mente / 2) + target.roundDefense + defFocus +",
    "const defBonus = target.stats.cuerpo + Math.floor(target.stats.mente / 2) + target.roundDefense + defFocus + statusMod(target) +")

# --- versión 0.6.5 ---
rep("index.html", "v0.6.4", "v0.6.5")
rep("sw.js", "umbral-v6-4", "umbral-v6-5")
print("OK")
