import sys
W = "/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/"
def rep(f, old, new):
    p = W + f
    s = open(p, encoding="utf-8").read()
    if s.count(old) != 1: sys.exit("FAIL %s count=%d :: %r" % (f, s.count(old), old[:80]))
    open(p, "w", encoding="utf-8").write(s.replace(old, new))
rep("engine.js", '''        if (r.success) {
          giveStatus(t, "aturdido", 1);
          t.notes.push("Ronda " + state.round + ": un golpe seco te deja aturdido.");
          return { text: t.name + " queda aturdido: perderá su próximo turno.", log: null };
        }''', '''        if (r.success) {
          if (!t.acted) {
            /* Aún le toca esta ronda: pierde ese turno. */
            t.acted = true; t.action = "aturdido";
            t.notes.push("Ronda " + state.round + ": un golpe seco te deja sin turno.");
            return { text: t.name + " pierde su turno de esta ronda.", log: null };
          }
          giveStatus(t, "aturdido", 1);
          t.notes.push("Ronda " + state.round + ": un golpe seco te deja aturdido.");
          return { text: t.name + " queda aturdido: perderá su próximo turno.", log: null };
        }''')
rep("engine.js", '''    if (p.wounds >= 3) { p.dead = true; killed(p, "heridas"); }''', '''    if (p.wounds >= 3) { p.dead = true; p.status = []; killed(p, "heridas"); }''')
