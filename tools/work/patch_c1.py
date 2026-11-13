B="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/"
p=B+"apk/assets/www/engine.js"
s=open(p).read()
def rep(a,b,cnt=1):
    global s
    assert s.count(a)==cnt,(s.count(a),a[:60])
    s=s.replace(a,b)

# ---- useItem
rep('''      case "attack": p.roundAttack += def.value; msg = "+" + def.value + " ataque esta ronda."; break;
      case "heal": {
        if (p.hp >= maxHp(p) && !hasStatus(p, "sangrado")) return err("No tienes heridas que curar.");
        const h = heal(p, 4); const sg = hasStatus(p, "sangrado"); dropStatus(p, "sangrado");
        msg = (h > 0 ? "+" + h + " de vitalidad" : "Vendas la herida") + (sg ? (h > 0 ? " y se corta el sangrado." : ": se corta el sangrado.") : "."); break;
      }''','''      case "attack": p.roundAttack += def.value; msg = "+" + def.value + " ataque esta ronda."; break;
      case "passive": return err(def.name + " actúa solo: no hay que usarlo. " + (def.id === "daga" ? "Te da +2 de ataque si enfrentas a alguien y permite Apuñalar." : "Basta con llevarlo."));
      case "heal": {
        const cures = (def.cures || []).filter(function (c) { return hasStatus(p, c); });
        if (p.dying) return err("Estás moribundo.");
        if (p.hp >= maxHp(p) && !cures.length) return err(def.id === "racion" ? "No tienes hambre ni heridas: guárdala para cuando la necesites." : "No tienes heridas que curar.");
        const h = heal(p, def.value || 4);
        cures.forEach(function (c) { dropStatus(p, c); });
        if (def.id !== "vendas" && def.id !== "botiquin" && def.id !== "hierbas" && def.virtue) p.virtue = clamp(p.virtue + def.virtue, 0, 100);
        else if (def.virtue) p.virtue = clamp(p.virtue + def.virtue, 0, 100);
        const cn = cures.map(function (c) { return D.STATUS[c] ? D.STATUS[c].name.toLowerCase() : c; });
        msg = (h > 0 ? "+" + h + " de vitalidad" : "Tratas la herida") + (cn.length ? " y se va: " + cn.join(", ") : "") + (def.virtue ? " (+" + def.virtue + " virtud)" : "") + "."; break;
      }
      case "prep": {
        p.prep = p.prep || { acts: {}, left: 0 };
        Object.keys(def.acts).forEach(function (k) { p.prep.acts[k] = Math.max(p.prep.acts[k] || 0, def.acts[k]); });
        p.prep.left = Math.max(p.prep.left || 0, def.left || 2);
        const nm = Object.keys(def.acts).map(function (k) { return "−" + def.acts[k] + " a " + (D.ACTIONS.find(function (a) { return a.id === k; }) || { name: k }).name; });
        msg = def.name + " listo: " + nm.join(" y ") + " de dificultad en tu próxima acción de ese tipo (dura " + (def.left || 2) + " rondas)."; break;
      }
      case "lantern": p.guardRound = state.round; p.guardLv = Math.max(p.guardLv || 0, 2); p.lantern = state.round; msg = "La linterna ilumina tu entorno: si alguien te agrede esta ronda, sabrás quién fue."; break;
      case "lens": p.evBonus = (p.evBonus || 0) + 1; msg = "Examinas los detalles: tu próxima acusación tendrá +1 de evidencia."; break;''')
rep('''        { const cl = makeClue(t, def.value); if (cl) p.clues.push(cl); } msg = "Obtienes una pista sobre " + t.name + "."; break;''','''        { const cl = makeClue(t, def.value); if (cl) p.clues.push(cl); } msg = (def.msg ? def.msg + t.name + "." : "Obtienes una pista sobre " + t.name + "."); break;''')
rep('''      case "reveal": {
        const possible = others(p);
        if (!possible.length) return err("No hay otro jugador en pie sobre quien obtener una pista.");
        const t = pick(possible);
        const clue = makeClue(t, 2); if (clue) p.clues.push(clue); msg = "El mapa revela algo sobre " + t.name + "."; break;
      }
''','''      case "reveal": {
        const possible = others(p);
        if (!possible.length) return err("No hay otro jugador en pie sobre quien obtener una pista.");
        const t = pick(possible);
        const clue = makeClue(t, 2); if (clue) p.clues.push(clue); msg = "Obtienes algo sobre " + t.name + "."; break;
      }
''')
rep('''    if (it.id !== "daga") p.items.splice(index, 1);
    p.usedItem = true;
    save();
    return { ok: true, msg: msg };''','''    if (def.uses && def.uses > 1) { it.left = (it.left === undefined ? def.uses : it.left) - 1; msg += " (" + (it.left > 0 ? "le quedan " + it.left + " uso" + (it.left > 1 ? "s" : "") : "ya no sirve") + ")"; if (it.left <= 0) p.items.splice(index, 1); }
    else p.items.splice(index, 1);
    p.usedItem = true;
    glog("objeto", { a: p.id, x: def.name + " → " + msg.slice(0, 90) });
    save();
    return { ok: true, msg: msg };''')
# el item 'ward' etc dejan de usar daga excepción: ya cubierto.

# ---- prep en act(): dificultad
rep('''    if (SOMBRAS.indexOf(a.id) !== -1 && domLevel(p) >= 1) diff -= 1;

    if (a.id === "investigar"''','''    if (SOMBRAS.indexOf(a.id) !== -1 && domLevel(p) >= 1) diff -= 1;
    const prepMod = prepFor(p, a.id);
    if (prepMod) diff -= prepMod;

    if (a.id === "investigar"''')
rep('''      if (a.hostile && t && t.protection !== null) why.push("la víctima está protegida (+1 dificultad)");''','''      if (a.hostile && t && t.protection !== null) why.push("la víctima está protegida (+1 dificultad)");
      if (prepMod) why.push("tu equipo ayuda (−" + prepMod + " dificultad)");''')
rep('''    const out = applyAction(p, a, t, r, a.mode ? mode : stake);
    if (AGGR_ACT[a.id] && !r.blocked)''','''    const out = applyAction(p, a, t, r, a.mode ? mode : stake);
    if (prepMod) usePrep(p, a.id);
    if (AGGR_ACT[a.id] && !r.blocked)''')
rep('''    if (SOMBRAS.indexOf(a.id) !== -1 && domLevel(p) >= 1) { diff -= 1; mods.push("dominio de las sombras (−1 dificultad)"); }''','''    if (SOMBRAS.indexOf(a.id) !== -1 && domLevel(p) >= 1) { diff -= 1; mods.push("dominio de las sombras (−1 dificultad)"); }
    { const pm = prepFor(p, a.id); if (pm) { diff -= pm; mods.push("tu equipo (−" + pm + " dificultad)"); } }''')
rep('''  function actionOdds(pid, aid) {''','''  /* Equipo preparado (mapa, antorcha, cuerda…): rebaja la dificultad de la próxima acción de ese tipo. */
  function prepFor(p, actId) { return (p && p.prep && p.prep.left > 0 && p.prep.acts && p.prep.acts[actId]) || 0; }
  function usePrep(p, actId) {
    if (!p.prep || !p.prep.acts) return;
    delete p.prep.acts[actId];
    if (!Object.keys(p.prep.acts).length) p.prep = null;
  }
  function actionOdds(pid, aid) {''')
# decaimiento
rep('''      p.roundDefense = 0; p.roundAttack = 0;
      p.action = null; p.actionTarget = null;
    });''','''      p.roundDefense = 0; p.roundAttack = 0;
      p.action = null; p.actionTarget = null;
      if (p.prep) { p.prep.left -= 1; if (p.prep.left <= 0 || !Object.keys(p.prep.acts || {}).length) p.prep = null; }
    });''')
# daga/manto en emboscada; lupa en acusación
rep('''(actor.corr >= 40 ? 2 : 0) + (hasPassive(actor, "attackBonus") ? 1 : 0)''','''(actor.corr >= 40 ? 2 : 0) + (hasItem(actor, "daga") ? 2 : 0) + (hasPassive(actor, "attackBonus") ? 1 : 0)''')
rep('''    const defBonus = target.stats.cuerpo + Math.floor(target.stats.mente / 2) + target.roundDefense + defFocus + statusMod(target) +
      (hasPassive(target, "defenseBonus") ? 2 : 0) + (target.protection !== null ? 2 : 0) - target.wounds - legPen(target);
    const a = rollRaw(atkBonus, 0);''','''    const defBonus = target.stats.cuerpo + Math.floor(target.stats.mente / 2) + target.roundDefense + defFocus + statusMod(target) + (hasItem(target, "manto") ? 1 : 0) +
      (hasPassive(target, "defenseBonus") ? 2 : 0) + (target.protection !== null ? 2 : 0) - target.wounds - legPen(target);
    const a = rollRaw(atkBonus, 0);''')
rep('''    if (hasPassive(actor, "evidenceBonus")) evidence += 1;
''','''    if (hasPassive(actor, "evidenceBonus")) evidence += 1;
    if (actor.evBonus) { evidence += actor.evBonus; actor.evBonus = 0; }
''')
rep('''  function mkItem(id) { return { id: id }; }''','''  function mkItem(id) { return { id: id }; }
  function hasItem(p, id) { return !!(p && p.items && p.items.some(function (i) { return i.id === id; })); }
  function hasFire(p) { return hasItem(p, "antorcha") || hasItem(p, "linterna"); }''')
open(p,"w").write(s)
