import sys
W = "/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/"
def rep(f, old, new, count=1, first=False):
    p = W + f
    s = open(p, encoding="utf-8").read()
    n = s.count(old)
    if first:
        if n < 1: sys.exit("FAIL first %s: %r" % (f, old[:90]))
        s = s.replace(old, new, 1)
    else:
        if n != count: sys.exit("FAIL %s: expected %d got %d :: %r" % (f, count, n, old[:90]))
        s = s.replace(old, new)
    open(p, "w", encoding="utf-8").write(s)

rep("ui.js", 'U.getState().players.filter(function (x) { return x.id !== p.id && !x.dead; }).forEach(function (t) {\n      const btn = document.createElement("button");\n      btn.className = "choice";\n      btn.innerHTML = \'<b>\' + esc(t.name) + \'</b><span class="small">\' + (t.wounds ? t.wounds + \' heridas visibles\' : \'Sin heridas visibles\') + \'</span>\';\n      btn.onclick = function () { doAction(pendingAction',
    'U.getState().players.filter(function (x) { return x.id !== p.id && !x.dead && (!pendingAction.canTarget || pendingAction.canTarget(x)); }).forEach(function (t) {\n      const btn = document.createElement("button");\n      btn.className = "choice";\n      btn.innerHTML = \'<b>\' + esc(t.name) + \'</b><span class="small">\' + (t.wounds ? t.wounds + \' heridas visibles\' : \'Sin heridas visibles\') + \'</span>\';\n      btn.onclick = function () { doAction(pendingAction', first=True)
rep("ui.js", '$("actionHint").textContent = "Elige a quién afecta «" + pendingAction.name + "».";',
'$("actionHint").textContent = "Elige a quién afecta «" + pendingAction.name + "»." + (pendingAction.canTarget && !U.getState().players.some(function (x) { return x.id !== p.id && !x.dead && pendingAction.canTarget(x); }) ? " Ahora mismo nadie puede ser devorado." : "");')
rep("ui.js", "(p.wounds ? \"Heridas visibles: \" + p.wounds : \"Sin heridas visibles\") + '</div></div>';",
    "(p.wounds ? \"Heridas visibles: \" + p.wounds : \"Sin heridas visibles\") + statusText(p) + '</div></div>';")
rep("ui.js", "      '<h3>Objetos</h3>' + items +",
"      '<h3>Estados</h3><p class=\"small\">' + ((p.status || []).length ? p.status.map(function (s) { return D.STATUS[s.id].name + \" (\" + s.left + \" ronda\" + (s.left > 1 ? \"s\" : \"\") + \"): \" + D.STATUS[s.id].desc; }).join(\"<br>\") : \"Ninguno.\") + '</p>' +\n      '<h3>Objetos</h3>' + items +")
rep("ui.js", "filter(function (id) { return !s.players[id].dead; })",
    "filter(function (id) { return !s.players[id].dead && !s.players[id].acted; })", count=2)
rep("ui.js", "  function renderActions(p) {",
"  function statusText(p) {\n    const list = (p.status || []).map(function (s) { return D.STATUS[s.id] ? D.STATUS[s.id].name + \" (\" + s.left + \")\" : s.id; });\n    return list.length ? \" · Estados: \" + list.join(\", \") : \"\";\n  }\n\n  function renderActions(p) {")
rep("index.html", "v0.6.3", "v0.6.4")
rep("sw.js", "umbral-v6-3", "umbral-v6-4")
print("OK")
