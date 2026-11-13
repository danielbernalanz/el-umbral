p='engine.js'
s=open(p,encoding='utf-8').read()
def rep(old,new,cnt=1):
    global s
    assert s.count(old)==cnt, (s.count(old), old[:90])
    s=s.replace(old,new)

rep('''    { id: "armas", label: "Con arma", ids: ["apunalar", "envenenar", "maldecir", "aturdir"] }
  ];''','''    { id: "armas", label: "Con arma", ids: ["apunalar", "envenenar", "maldecir", "aturdir"] },
    { id: "sombras", label: "Sombras", ids: ["sombra_espia", "sombra_guarda", "sombra_hostiga", "alzar"] }
  ];''')

# actionOdds: dom bonus
rep('''    let diff = a.diff;
    if (["investigar", "proteger", "explorar"].indexOf(a.id) !== -1) {
      if (p.virtue >= 70) { diff -= 1; mods.push("virtud alta (−1 dificultad)"); }''','''    let diff = a.diff;
    if (SOMBRAS.indexOf(a.id) !== -1 && domLevel(p) >= 1) { diff -= 1; mods.push("dominio de las sombras (−1 dificultad)"); }
    if (["investigar", "proteger", "explorar"].indexOf(a.id) !== -1) {
      if (p.virtue >= 70) { diff -= 1; mods.push("virtud alta (−1 dificultad)"); }''')
rep('''  const DOM_NAMES = [''','''  const SOMBRAS = ["sombra_espia", "sombra_guarda", "sombra_hostiga", "alzar"];
  const DOM_NAMES = [''')

# makePlayer
rep('''spells: [], stolen: [], betrayals: 0, keptPacts: 0, successfulAccusations: 0, status: []
    };''','''spells: [], stolen: [], betrayals: 0, keptPacts: 0, successfulAccusations: 0, status: [],
      aggr: 0, agg: {}, dom: { wins: 0 }, risen: []
    };''')

# act(): target validation
rep('''      t = state.players[targetId];
      if (!t || t.id === p.id || t.dead) return err("Debes elegir a otro jugador que siga en la partida.");
      if (a.canTarget && !a.canTarget(t)) return err(a.id === "devorar" ? "Ese jugador no puede ser devorado todavía." : "Ese jugador no puede ser objetivo de esa acción.");
    }''','''      t = state.players[targetId];
      if (!t || t.id === p.id || (a.id === "alzar" ? false : t.dead)) return err(a.id === "alzar" ? "Elige a un jugador caído (o, si eres Asesino, moribundo)." : "Debes elegir a otro jugador que siga en la partida.");
      if (a.canTarget && !a.canTarget(t, p)) return err(a.id === "devorar" ? "Ese jugador no puede ser devorado todavía." : a.id === "alzar" ? "Ese jugador no puede ser alzado." : "Ese jugador no puede ser objetivo de esa acción.");
    }
    if (a.id === "alzar") {
      if (p.hp <= 3) return err("No te queda sangre que ofrecer.");
      if (riseCount(p) >= riseMax(p)) return err("Tus sombras sirvientes ya no dan abasto: ya tienes " + riseCount(p) + " alzada" + (riseCount(p) > 1 ? "s" : "") + ".");
    }''')

# reflect branch aggr
rep('''      p.acted = true; p.action = a.id; p.actionTarget = t.id; state.pendingPush = null;
      save();
      return { ok: true, die: 0, stat: 0, focus: 0, status: 0, total: 0, diff: 0, crit: false, fumble: false, success: false, outcome: "Tu agresión choca''','''      p.acted = true; p.action = a.id; p.actionTarget = t.id; state.pendingPush = null;
      if (AGGR_ACT[a.id]) noteAggr(p, AGGR_ACT[a.id][1], AGGR_ACT[a.id][0]);
      save();
      return { ok: true, die: 0, stat: 0, focus: 0, status: 0, total: 0, diff: 0, crit: false, fumble: false, success: false, outcome: "Tu agresión choca''')

# cazar defense: skip if dying; rematar; risen bonus
rep('''    if (a.id === "cazar" && t) {
      /* La víctima se defiende con una tirada propia (como al enfrentarse). */''','''    if (a.id === "cazar" && t && !t.dying) {
      /* La víctima se defiende con una tirada propia (como al enfrentarse). */''')
rep('''      diff = d6() + defBonus - huntEdge() + p.wounds;
    }
''','''      diff = d6() + defBonus - huntEdge() + p.wounds - (riseCount(p) > 0 ? 1 : 0);
    }
    if (SOMBRAS.indexOf(a.id) !== -1 && domLevel(p) >= 1) diff -= 1;
''')
rep('''    const r = a.risk ? rollCheck(p, a.attr, diff) : { die: 0, stat: 0, focus: 0, total: 0, diff: 0, crit: false, fumble: false, success: true };
    const out = applyAction(p, a, t, r, a.mode ? mode : stake);''','''    const r = a.risk ? rollCheck(p, a.attr, diff) : { die: 0, stat: 0, focus: 0, total: 0, diff: 0, crit: false, fumble: false, success: true };
    if (a.id === "cazar" && t && t.dying && !p.huntBlocked) { r.success = true; r.fumble = false; r.rematar = true; }
    const wasDyingT = !!(t && t.dying);
    const out = applyAction(p, a, t, r, a.mode ? mode : stake);
    if (AGGR_ACT[a.id] && !r.blocked) noteAggr(p, AGGR_ACT[a.id][1], AGGR_ACT[a.id][0] + (wasDyingT && a.hostile ? 1 : 0));
    if (a.hostile && t && !r.blocked && t.guardRound === state.round && (t.guardLv || 0) >= 2 && !t.dead) t.notes.push("Ronda " + state.round + ": tus sombras guardianas vieron quién te agredía: fue " + p.name + ".");''')
rep('''"apunalar", "envenenar", "maldecir", "aturdir", "devorar", "tender", "conjurar"].indexOf(a.id) !== -1) {''','''"apunalar", "envenenar", "maldecir", "aturdir", "devorar", "tender", "conjurar", "sombra_hostiga", "sombra_espia", "alzar"].indexOf(a.id) !== -1) {''')
open(p,'w',encoding='utf-8').write(s)
print("ok")
