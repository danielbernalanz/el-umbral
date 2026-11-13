import sys, re
W = "/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/"
def rep(f, old, new, count=1):
    p = W + f
    s = open(p, encoding="utf-8").read()
    n = s.count(old)
    if n != count: sys.exit("FAIL %s count=%d :: %r" % (f, n, old[:90]))
    open(p, "w", encoding="utf-8").write(s.replace(old, new))
e="engine.js"; u="ui.js"; d="data.js"

# ---------- data: objetos que desbloquean daño directo ----------
rep(d,'    coartada: { id: "coartada"','''    frasco: { id: "frasco", name: "Frasco de veneno", kind: "weapon", desc: "Permite Envenenar a alguien. Se gasta al usarlo." },
    pergamino: { id: "pergamino", name: "Pergamino maldito", kind: "weapon", desc: "Permite Maldecir a alguien. Se gasta al usarlo." },
    porra: { id: "porra", name: "Porra de plomo", kind: "weapon", desc: "Permite Aturdir a alguien. Se gasta al usarla." },
    coartada: { id: "coartada"''')
rep(d,'desc: "+2 ataque esta ronda." },','desc: "+2 ataque esta ronda. También permite Apuñalar (no se gasta)." },')
rep(d,'const LOOT_ITEMS = ["talisman", "vendas", "sello", "daga", "amuleto", "mapa", "bendicion", "coartada"];','const LOOT_ITEMS = ["talisman", "vendas", "sello", "daga", "amuleto", "mapa", "bendicion", "coartada", "frasco", "pergamino", "porra"];')
rep(d,'const DARK_ITEMS = ["reliquia", "fragmento", "daga", "coartada", "llave"];','const DARK_ITEMS = ["reliquia", "fragmento", "daga", "coartada", "llave", "frasco", "pergamino"];')
for aid, need, extra in [("apunalar","daga",', consume: false'),("envenenar","frasco",""),("maldecir","pergamino",""),("aturdir","porra","")]:
    rep(d,'{ id: "%s", name:' % aid, '{ id: "%s", needs: "%s"%s, name:' % (aid, need, extra))

# ---------- engine ----------
rep(e,"    p.wounds = clamp((p.wounds || 0) + amount, 0, 3);","    p.wounds = clamp((p.wounds || 0) + amount, 0, 3);\n    p.wasHurt = true;")
rep(e,"      p.pressure = 0;\n","      p.pressure = 0; p.dealt = (p.dealt || 0) + 1;\n")
rep(e,"    p.pressure = Math.min(3, (p.pressure || 0) + 1);","    p.pressure = Math.min(3, (p.pressure || 0) + 1); p.refused = (p.refused || 0) + 1;")
rep(e,"      used.pact += 1;\n","      used.pact += 1;\n      actor.pactsSealed = (actor.pactsSealed || 0) + 1; target.pactsSealed = (target.pactsSealed || 0) + 1;\n")
rep(e,"  /* ---------- La mano tendida","""  /* ---------- Aprendizaje: acciones y atributos se desbloquean con la práctica ---------- */
  /* Cuanto menos tiempo (rondas) queda, más fácil es aprender. */
  function ease() { return state ? clamp(roundsLeftInclCurrent() / 7, 0.3, 1) : 1; }
  function need(n) { return Math.max(1, Math.round(n * ease())); }
  function didN(p, id) { return (p.did && p.did[id]) || 0; }
  function hasItemId(p, id) { return p.items.some(function (i) { return i.id === id; }); }
  const BASE_ACTIONS = ["investigar", "explorar", "proteger", "meditar"];
  const UNLOCK = {
    descansar: function (p) { return !!p.wasHurt; },
    entrenar: function (p, late) { return late || didN(p, "explorar") + didN(p, "investigar") >= need(2); },
    apostar: function (p, late) { return late || didN(p, "explorar") >= need(1); },
    tender: function (p, late) { return late || didN(p, "proteger") >= need(1) || (p.pactsSealed || 0) >= 1 || p.keptPacts >= 1; },
    resistir: function (p, late) { return late || (p.refused || 0) >= 1 || didN(p, "meditar") >= need(2); },
    robar: function (p, late) { return late || hasPassive(p, "stealDiscount") || p.corr >= Math.max(5, Math.round(12 * ease())) || didN(p, "explorar") >= need(2); },
    hechizar: function (p) { return hasPassive(p, "spellDiscount") || p.corr >= Math.max(5, Math.round(12 * ease())) || hasItemId(p, "reliquia") || hasItemId(p, "fragmento"); },
    ceder: function (p) { return p.corr >= Math.max(5, Math.round(12 * ease())) || (p.dealt || 0) >= 1; },
    apunalar: function (p) { return hasItemId(p, "daga"); },
    envenenar: function (p) { return hasItemId(p, "frasco"); },
    maldecir: function (p) { return hasItemId(p, "pergamino"); },
    aturdir: function (p) { return hasItemId(p, "porra"); },
    devorar: function (p) { return isAssassin(p) || p.corr >= 40; },
    cazar: function (p) { return isAssassin(p); }
  };
  function isUnlocked(p, a) {
    if (BASE_ACTIONS.indexOf(a.id) !== -1) return true;
    const f = UNLOCK[a.id];
    return !!(f && f(p, roundsLeftInclCurrent() <= 2));
  }
  /* Devuelve lo recién aprendido (y lo marca como visto). */
  function unlockNotices(p, silent) {
    p.seen = p.seen || {};
    const out = (p.fresh || []).slice();
    p.fresh = [];
    D.ACTIONS.forEach(function (a) {
      if (p.seen[a.id] || BASE_ACTIONS.indexOf(a.id) !== -1) return;
      if (isUnlocked(p, a)) {
        p.seen[a.id] = true;
        if (!silent) { out.push(a.name); p.notes.push("Ronda " + state.round + ": se abre ante ti una nueva posibilidad: " + a.name + "."); }
      }
    });
    return silent ? [] : out;
  }
  function addXp(p, attr, amt) {
    p.xp = p.xp || {}; p.grown = p.grown || {};
    if ((p.grown[attr] || 0) >= 2 || p.stats[attr] >= MAX_STAT) return;
    p.xp[attr] = (p.xp[attr] || 0) + amt;
    const nd = need(3);
    if (p.xp[attr] >= nd) {
      p.xp[attr] -= nd; p.grown[attr] = (p.grown[attr] || 0) + 1; p.stats[attr] += 1;
      p.notes.push("Ronda " + state.round + ": la práctica te ha hecho más hábil. Sube tu " + attr + ".");
      p.fresh = p.fresh || []; p.fresh.push("mejora tu " + attr);
    }
  }

  /* ---------- La mano tendida""")
rep(e,"    if (a.assassinOnly && !isAssassin(p)) return err(\"Esta acción pertenece exclusivamente al Asesino.\");","    if (a.assassinOnly && !isAssassin(p)) return err(\"Esta acción pertenece exclusivamente al Asesino.\");\n    if (!isUnlocked(p, a)) return err(\"Aún no puedes hacer eso.\");")
rep(e,"const out = applyAction(p, a, t, r, a.mode ? mode : stake);","""const out = applyAction(p, a, t, r, a.mode ? mode : stake);
    p.did = p.did || {}; p.did[a.id] = (p.did[a.id] || 0) + 1;
    if (a.needs && a.consume !== false) { const ix = p.items.findIndex(function (i) { return i.id === a.needs; }); if (ix >= 0) p.items.splice(ix, 1); }
    if (a.attr && r.success) addXp(p, a.attr, r.crit ? 2 : 1);""")
rep(e,"    planRounds(true);\n    players.forEach(function (p) {","    planRounds(true);\n    players.forEach(function (p) { unlockNotices(p, true); });\n    players.forEach(function (p) {")
rep(e,"getHandOffer: getHandOffer,","getHandOffer: getHandOffer, isUnlocked: isUnlocked, unlockNotices: unlockNotices,")

# ---------- UI ----------
rep(u,"D.ACTIONS.filter(function (a) { return !a.assassinOnly || p.alignment === \"asesino\"; }).forEach(function (a) {","D.ACTIONS.filter(function (a) { return U.isUnlocked(p, a); }).forEach(function (a) {")
rep(u,"    renderOffer(p);\n    renderHand(p);","    renderOffer(p);\n    renderHand(p);\n    const fresh = U.unlockNotices(p);\n    if (fresh.length) toast(\"Algo se abre ante ti: \" + fresh.join(\", \") + \".\", false);")
rep(u,"""'<button class="ghost smallbtn" data-item="' + i + '"' + (p.usedItem ? " disabled" : "") + '>Usar</button></div>';""","""(def.kind === "weapon" ? '<span class="small">Se usa desde una acción</span>' : '<button class="ghost smallbtn" data-item="' + i + '"' + (p.usedItem ? " disabled" : "") + '>Usar</button>') + '</div>';""")
print("OK")
