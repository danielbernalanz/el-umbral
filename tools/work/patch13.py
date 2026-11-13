import sys
W = "/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/"
def rep(f, old, new, count=1):
    p = W + f
    s = open(p, encoding="utf-8").read()
    n = s.count(old)
    if n != count: sys.exit("FAIL %s count=%d :: %r" % (f, n, old[:90]))
    open(p, "w", encoding="utf-8").write(s.replace(old, new))
rep("engine.js", '''    if (ass.length && alive.every(isAssassin)) {
      state.phase = "ending"; state.ending = computeEnding(); save(); return true;
    }''', '''    if (ass.length && alive.every(isAssassin)) {
      state.phase = "ending"; state.ending = computeEnding(); save(); return true;
    }
    if (!ass.length && alive.length === 1) {
      state.phase = "ending"; state.ending = computeEnding(); save(); return true;
    }''')
rep("engine.js", "|| !alive.length || (ass.length && alive.every(isAssassin))) {", "|| !alive.length || (ass.length && alive.every(isAssassin)) || (!ass.length && alive.length === 1)) {")
rep("engine.js", '''    } else {
      winner = "supervivientes";
      title = "La llama que no se apaga";''', '''    } else if (alive.length === 1) {
      winner = "supervivientes";
      title = "El último en pie";
      text = alive[0].name + " es el único que queda. Sin Asesino, la noche se cobró a todos los demás.";
    } else {
      winner = "supervivientes";
      title = "La llama que no se apaga";''')
print("OK")
