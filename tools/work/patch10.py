import sys
W = "/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/"
def rep(f, old, new, count=1):
    p = W + f
    s = open(p, encoding="utf-8").read()
    n = s.count(old)
    if n != count: sys.exit("FAIL %s count=%d :: %r" % (f, n, old[:90]))
    open(p, "w", encoding="utf-8").write(s.replace(old, new))
rep("engine.js", '    pool.push(["foco", 2]);', '    if (p.focus < 2) pool.push(["foco", 2]);')
rep("engine.js", '''    return { id: id, cost: Math.max(2, OFFERS[id].base - 2 * pressure), text: OFFERS[id].text, done: false };''',
'''    /* Suelo del precio: la insistencia lo abarata, pero nunca por debajo del 60 % del base. */
    const cost = Math.max(Math.ceil(OFFERS[id].base * 0.6), OFFERS[id].base - 2 * pressure);
    /* Coste de rechazar: nada las dos primeras veces; luego el Umbral se impacienta. */
    const refuse = pressure >= 3 ? 5 : pressure >= 2 ? 3 : 0;
    return { id: id, cost: cost, refuse: refuse, text: OFFERS[id].text, done: false };''')
rep("engine.js", "p.focus = Math.min(3, p.focus + 2);", "p.focus = Math.min(2, p.focus + 2);")
rep("engine.js", "    const extra = (p.pressure || 0) >= 2 ? 3 : 0;", "    const extra = o.refuse || 0;")
rep("ui.js", '''    const refuse = pressure >= 2 ? "Rechazar: +2 virtud, pero el Umbral se impacienta (+3 corrupción)." : "Rechazar: +2 virtud.";''',
'''    const refuse = o.refuse ? "Rechazar: +2 virtud, pero el Umbral se impacienta (+" + o.refuse + " corrupción)." : "Rechazar: +2 virtud.";''')
rep("index.html", "del tercer rechazo seguido, cada rechazo cuesta +3 corrupción.", "del tercer rechazo seguido, cada rechazo cuesta corrupción (+3, y +5 con la máxima insistencia).")
print("OK")
