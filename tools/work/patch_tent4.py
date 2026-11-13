p='engine.js'
s=open(p,encoding='utf-8').read()
def rep(old,new,cnt=1):
    global s
    assert s.count(old)==cnt, (s.count(old), old[:90])
    s=s.replace(old,new)

# applyEvent logging gifts
rep('''      t.gift = { round: state.round, text: "Entre tus cosas encuentras: " + itemName(id) + "." };
      t.notes.push("Ronda " + state.round + ": " + t.gift.text);''','''      t.gift = { round: state.round, text: "Entre tus cosas encuentras: " + itemName(id) + "." };
      t.notes.push("Ronda " + state.round + ": " + t.gift.text);
      glog("regalo", { a: t.id, x: "evento: " + itemName(id) });''')
rep('''    else if (ev.effect === "clue") { if (ps.length > 1) { const t = pick(ps); const clue = makeClue(pick(others(t)), 1); if (clue) t.clues.push(clue); } }''','''    else if (ev.effect === "clue") { if (ps.length > 1) { const t = pick(ps); const clue = makeClue(pick(others(t)), 1); if (clue) { t.clues.push(clue); glog("regalo", { a: t.id, x: "evento: pista sobre " + state.players[clue.about].name }); } } }''')

# startRound: dying window
rep('''      if (!p.dead && p.dying && state.round >= (p.dyingRound || 0) + 2) {
        p.notes.push("Ronda " + state.round + ": nadie te socorrió a tiempo. Mueres.");
        finish(p, "heridas");
      }
    });''','''      if (!p.dead && p.dying && state.round >= (p.dyingRound || 0) + (p.dyingFast ? 1 : 2)) {
        p.notes.push("Ronda " + state.round + ": nadie te socorrió a tiempo. Mueres.");
        finish(p, "heridas");
        /* Con la ventana larga, quien pudo socorrerlo y ni lo intentó carga con ello (alimenta su tentación). */
        if (!p.dyingFast) state.players.forEach(function (q) {
          if (q.dead || q.dying || q.id === p.id || isAssassin(q) || (p.socBy && p.socBy[q.id])) return;
          noteAggr(q, "left", 1);
        });
      }
    });''')
# tickRisen after statuses
rep('''    state.players.forEach(function (p) { if (!p.dead) tickStatus(p); });
    tickHands();''','''    state.players.forEach(function (p) { if (!p.dead) tickStatus(p); });
    tickRisen();
    tickHands();''')
rep('''  function startRound() {''','''  /* Sombras alzadas: cada ronda dan una pista y defensa a quien las manda. */
  function tickRisen() {
    state.players.forEach(function (m) {
      if (m.dead || !(m.risen && m.risen.length)) return;
      const lv = domLevel(m);
      m.risen.forEach(function (id) {
        const sh = state.players[id];
        if (!sh || sh.risenBy !== m.id) return;
        m.roundDefense += 2 + (lv >= 3 ? 1 : 0);
        const os = others(m);
        if (os.length) {
          const c = makeClue(pick(os), 1 + (lv >= 2 ? 1 : 0));
          if (c) { m.clues.push(c); m.notes.push("Ronda " + state.round + ": " + sh.name + ", desde el otro lado, te susurra algo sobre " + state.players[c.about].name + " (y se queja de lo mal que se está de sombra)."); glog("sombra_susurra", { a: m.id, t: sh.id, x: sh.name + " susurra una pista sobre " + state.players[c.about].name }); }
        }
      });
    });
  }
  function startRound() {''')
rep('''    state.event = eventForRound(state.round);
    applyEvent(state.event);''','''    state.event = eventForRound(state.round);
    applyEvent(state.event);
    glog("evento", { x: state.event.text.slice(0, 110) + (state.event.effectText ? " → " + state.event.effectText : "") });''')

# endCouncil: aggr decay + corr, log
rep('''    planRounds(false);
    state.lastResolution = out;''','''    state.players.forEach(function (p) {
      if (p.dead || isAssassin(p)) return;
      if (p.corr >= 40) noteAggr(p, "dark", p.corr >= 60 ? 2 : 1);
      else if (p.aggrRound !== state.round && (p.aggr || 0) > 0) p.aggr = Math.max(0, p.aggr - 1);
      if (p.aggr) glog("agresividad", { a: p.id, x: p.name + ": agresividad " + p.aggr + " (" + aggrSummary(p) + ")" });
    });
    planRounds(false);
    state.lastResolution = out;''')

# ambush
rep('''      (actor.corr >= 40 ? 2 : 0) + (hasPassive(actor, "attackBonus") ? 1 : 0) - actor.wounds - armPen(actor);''','''      (actor.corr >= 40 ? 2 : 0) + (hasPassive(actor, "attackBonus") ? 1 : 0) + (isAssassin(actor) ? 1 : 0) - actor.wounds - armPen(actor);''')
rep('''    const attackerWins = !!target.dying || a.total > d.total || (a.total === d.total && a.die > d.die);
''','''    const attackerWins = !!target.dying || a.total > d.total || (a.total === d.total && a.die > d.die);
    noteAggr(actor, "ambush", attackerWins ? 4 : 3);
''')
rep('''      const ares = damage(target, (isAssassin(actor) || isAssassin(target)) ? rr(5, 6) : rr(3, 4), {});''','''      const ares = damage(target, (isAssassin(actor) || isAssassin(target)) ? rr(5, 6) : rr(3, 4), { fast: isAssassin(actor) });''')

# encounter
rep('''p.did.violencia = (p.did.violencia || 0) + 1; if (Math.random() < 0.5)''','''p.did.violencia = (p.did.violencia || 0) + 1; noteAggr(p, "npc", 2); if (Math.random() < 0.5)''')
rep('''p.enc = { npc: npcWeighted(p), round: state.round }; save(); }''','''p.enc = { npc: npcWeighted(p), round: state.round }; glog("encuentro", { a: p.id, x: NPCS[p.enc.npc].name }); save(); }''')

# cast aggr
rep('''    if (off && t) {
      if (!sp.stealth && mode !== "desatado")''','''    if (off && t) {
      noteAggr(p, "spell", 1);
      if (!sp.stealth && mode !== "desatado")''')

# Mask in makeClue
rep('''    return { about: target.id, strength: str, text: text };
  }''','''    if (isAssassin(target) && !target.exposed) str = Math.max(1, str - 1); /* Máscara: el Asesino oculto deja rastros más flojos */
    return { about: target.id, strength: str, text: text };
  }''')
open(p,'w',encoding='utf-8').write(s)
print("ok")
