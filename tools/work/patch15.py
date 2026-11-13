import sys
W = "/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/"
def rep(f, old, new, count=1):
    p = W + f
    s = open(p, encoding="utf-8").read()
    n = s.count(old)
    if n != count: sys.exit("FAIL %s count=%d :: %r" % (f, n, old[:90]))
    open(p, "w", encoding="utf-8").write(s.replace(old, new))
e="engine.js"
rep(e,'cura: { base: 6, text: "El Umbral cierra tus heridas: -1 herida y se van el sangrado y el veneno." },','cura: { base: 9, text: "El Umbral te arranca del borde de la muerte: -2 heridas y se van el sangrado y el veneno." },')
rep(e,'pista: { base: 6, text: "El Umbral te susurra un secreto sobre otro jugador: una pista fuerte." },','pista: { base: 8, text: "El Umbral te susurra los secretos de dos jugadores: una pista fuerte sobre cada uno." },')
rep(e,'poder: { base: 10, text: "El Umbral te concede +1 a tu atributo más débil, a costa de 3 virtud." }','poder: { base: 12, text: "El Umbral te concede +1 a tus dos atributos más débiles, a costa de 4 virtud." }')
# selective makeOffer
rep(e,'''    const pool = [];
    if (p.wounds > 0 || hasStatus(p, "sangrado") || hasStatus(p, "veneno")) pool.push(["cura", 3]);
    if (p.focus < 2) pool.push(["foco", 2]);
    if (others(p).length) pool.push(["pista", 2]);
    pool.push(["objeto", 1]);
    if (["cuerpo", "mente", "sombra"].some(function (k) { return p.stats[k] < MAX_STAT; })) pool.push(["poder", 1]);
''','''    /* Selectivo: solo aparece en momentos clave, con pausa entre tratos. */
    const danger = p.wounds >= 2 || (p.wounds >= 1 && (hasStatus(p, "sangrado") || hasStatus(p, "veneno")));
    const gap = state.round - (p.lastOffer || -9);
    if (state.round < 2 || gap < (danger ? 2 : 3)) return null;
    if (Math.random() >= (danger ? 0.85 : 0.4)) return null;
    const pool = [];
    if (danger) pool.push(["cura", 5]);
    if (others(p).length) pool.push(["pista", 1]);
    if (!p.items.length) pool.push(["objeto", 1]);
    if (state.round >= lateRound() && ["cuerpo", "mente", "sombra"].filter(function (k) { return p.stats[k] < MAX_STAT; }).length >= 2) pool.push(["poder", 2]);
    if (!pool.length) return null;
''')
rep(e,'''    if (!p.offer) { p.offer = makeOffer(p); save(); }
    return p.offer;''','''    if (p.offer === null || p.offer === undefined) { p.offer = makeOffer(p) || false; if (p.offer) p.lastOffer = state.round; save(); }
    return p.offer || null;''')
rep(e,'p.wounds = Math.max(0, p.wounds - 1); dropStatus(p, "sangrado")','p.wounds = Math.max(0, p.wounds - 2); dropStatus(p, "sangrado")')
rep(e,'''        const t = pick(others(p));
        const c = t ? makeClue(t, 2) : null;
        if (c) { p.clues.push(c); eff = "Recibes una pista fuerte sobre " + t.name + "."; } else eff = "El secreto se pierde en el aire.";''','''        const ts = shuffle(others(p)).slice(0, 2), names = [];
        ts.forEach(function (t) { const c = makeClue(t, 2); if (c) { p.clues.push(c); names.push(t.name); } });
        eff = names.length ? "Recibes una pista fuerte sobre " + names.join(" y ") + "." : "El secreto se pierde en el aire.";''')
rep(e,'''        if (open.length) { p.stats[open[0]] += 1; eff = "Tu " + open[0] + " aumenta (+1)."; }
        p.virtue = clamp(p.virtue - 3, 0, 100);''','''        open.slice(0, 2).forEach(function (k) { p.stats[k] += 1; });
        eff = "Aumentan " + open.slice(0, 2).join(" y ") + " (+1 cada uno).";
        p.virtue = clamp(p.virtue - 4, 0, 100);''')
print("OK")
