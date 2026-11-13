import sys
W = "/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/"
def rep(f, old, new, count=1):
    p = W + f
    s = open(p, encoding="utf-8").read()
    n = s.count(old)
    if n != count: sys.exit("FAIL %s count=%d :: %r" % (f, n, old[:90]))
    open(p, "w", encoding="utf-8").write(s.replace(old, new))

# ---- engine: 3 a 6 jugadores ----
rep("engine.js", "  const MAX_STAT = 6;", "  const MAX_STAT = 6;\n  const MIN_PLAYERS = 3;\n  const MAX_PLAYERS = Math.min(6, D.ROLES.length, D.AFFINITIES.length, D.SECRETS.length);")
rep("engine.js", '''    if (!Array.isArray(names) || names.length !== 3) throw new Error("La partida necesita exactamente tres jugadores.");
    const roles = shuffle(D.ROLES).slice(0, 3);
    const affs = shuffle(D.AFFINITIES).slice(0, 3);
    const secrets = shuffle(D.SECRETS).slice(0, 3);''',
'''    if (!Array.isArray(names) || names.length < MIN_PLAYERS || names.length > MAX_PLAYERS) throw new Error("La partida admite de " + MIN_PLAYERS + " a " + MAX_PLAYERS + " jugadores.");
    const roles = shuffle(D.ROLES).slice(0, names.length);
    const affs = shuffle(D.AFFINITIES).slice(0, names.length);
    const secrets = shuffle(D.SECRETS).slice(0, names.length);''')
rep("engine.js", "data.players.length !== 3) return null;", "data.players.length < MIN_PLAYERS || data.players.length > MAX_PLAYERS) return null;")
rep("engine.js", "los tres habéis cedido", "todos habéis cedido")
rep("engine.js", "    VERSION: VERSION, MAX_ROUNDS: MAX_ROUNDS,", "    VERSION: VERSION, MIN_PLAYERS: MIN_PLAYERS, MAX_PLAYERS: MAX_PLAYERS, MAX_ROUNDS: MAX_ROUNDS,")
rep("data.js", "a los tres", "a todos")

# ---- ui ----
rep("ui.js", '''      const names = [0, 1, 2].map(function (i) { return $("name" + i).value; });''',
'''      const count = Number($("playerCount").value) || 3;
      const names = [];
      for (let i = 0; i < count; i++) names.push($("name" + i).value);''')
rep("ui.js", '''    $("btnStart").onclick = function () {''',
'''    const syncNames = function () {
      const n = Number($("playerCount").value) || 3;
      [3, 4, 5].forEach(function (i) { $("nameRow" + i).style.display = i < n ? "" : "none"; });
    };
    $("playerCount").onchange = syncNames;
    syncNames();
    $("btnStart").onclick = function () {''')
rep("ui.js", "var o = s.order || [0, 1, 2];", "var o = s.order || s.players.map(function (q) { return q.id; });", count=2)

# ---- html ----
rep("index.html", '<p class="sub">Tres destinos. Tres voluntades. Una oscuridad que aprende de vuestras decisiones.</p>', '<p class="sub">Varios destinos. Una oscuridad que aprende de vuestras decisiones.</p>')
rep("index.html", '<p class="muted">10–20 minutos. Un solo móvil, tres jugadores, tiradas de dado y un Consejo por ronda.</p>',
    '<p class="muted">10–20 minutos con tres jugadores (puedes jugar de 3 a 6, pero está equilibrado para 3). Un solo móvil, tiradas de dado y un Consejo por ronda.</p>\n      <label>Número de jugadores<select id="playerCount"><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option></select></label>')
rep("index.html", '''      <label>Nombre del jugador 3<input id="name2" value="Jugador 3" maxlength="18"></label>''',
'''      <label>Nombre del jugador 3<input id="name2" value="Jugador 3" maxlength="18"></label>
      <label id="nameRow3" style="display:none">Nombre del jugador 4<input id="name3" value="Jugador 4" maxlength="18"></label>
      <label id="nameRow4" style="display:none">Nombre del jugador 5<input id="name4" value="Jugador 5" maxlength="18"></label>
      <label id="nameRow5" style="display:none">Nombre del jugador 6<input id="name5" value="Jugador 6" maxlength="18"></label>''')

for f, a, b in [("engine.js","0.6.9","0.7.0"),("ui.js","0.6.9","0.7.0"),("data.js","0.6.9","0.7.0"),("index.html","v0.6.9","v0.7.0"),("sw.js","umbral-v6-9","umbral-v7-0")]:
    rep(f, a, b)
print("OK")
