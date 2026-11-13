import sys
P="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/engine.js"
s=open(P,encoding="utf-8").read()
def rep(old,new,cnt=1):
    global s
    n=s.count(old)
    if n!=cnt:
        print("ABORT: matches=%d for: %s"%(n,old[:100])); sys.exit(1)
    s=s.replace(old,new)

# huntDamage
rep('''function huntDamage() { return maxRounds() <= 4 ? 3 : 2; }''','''function huntDamage() { return maxRounds() <= 4 ? rr(6, 8) : rr(4, 6); }''')

# spells: textos y aspectos
rep('''sangre: { adj: "de sangre", selfWound: 1, power: 1, text: "te cuesta una herida, pero golpea con más fuerza" },''','''sangre: { adj: "de sangre", selfWound: 2, power: 1, text: "te cuesta 2 de vitalidad, pero golpea con más fuerza" },''')
rep('''case "rayo": return "Una descarga que hiere al objetivo (" + (pw > 1 ? "2 heridas" : "1 herida, 2 si es crítico") + ").";''','''case "rayo": return "Una descarga que hiere al objetivo (" + (pw > 1 ? "5-6 de vitalidad" : "3-4 de vitalidad, 5-6 si es crítico") + ").";''')
rep('''case "sanar": return "Cierra " + (pw > 1 ? 2 : 1) + (pw > 1 ? " heridas." : " herida.");''','''case "sanar": return "Recuperas " + (pw > 1 ? 6 : 3) + " de vitalidad.";''')
rep('''case "purga": return "Expulsa " + (10 + 6 * (pw - 1)) + " de oscuridad y limpia sangrado, veneno y maldición.";''','''case "purga": return "Expulsa " + (10 + 6 * (pw - 1)) + " de oscuridad y limpia sangrado, veneno, infección y maldición.";''')
rep('''case "rayo": { const w = pw > 1 || crit ? 2 : 1; addWounds(t, w); t.notes.push("Ronda " + r + ": una descarga te golpeó desde la nada."); return t.name + " recibe " + w + (w > 1 ? " heridas." : " herida."); }''','''case "rayo": { const big = pw > 1 || crit; const res = damage(t, big ? rr(5, 6) : rr(3, 4), { src: "magia" }); t.notes.push("Ronda " + r + ": una descarga te golpeó desde la nada" + hitNote(res) + "."); return t.name + (res.died ? " ya estaba moribundo y la descarga lo remata." : res.dying ? " cae moribundo bajo la descarga." : " recibe la descarga y queda " + (big ? "muy " : "") + "herido."); }''')
rep('''case "sanar": p.wounds = Math.max(0, p.wounds - (pw > 1 ? 2 : 1)); return "Tus heridas se cierran.";''','''case "sanar": { const h = heal(p, pw > 1 ? 6 : 3); return h > 0 ? "Tus heridas se cierran (+" + h + " de vitalidad)." : "No tenías heridas que cerrar: el conjuro se pierde."; }''')
rep('''case "purga": p.corr = clamp(p.corr - (10 + 6 * (pw - 1)), 0, 100); dropStatus(p, "sangrado"); dropStatus(p, "veneno"); dropStatus(p, "maldito");''','''case "purga": p.corr = clamp(p.corr - (10 + 6 * (pw - 1)), 0, 100); dropStatus(p, "sangrado"); dropStatus(p, "veneno"); dropStatus(p, "infeccion"); dropStatus(p, "maldito");''')

# cast
rep('''if (!p || p.dead) return err("Este jugador ya no puede actuar.");
    if (p.acted) return err("Ya has actuado esta ronda.");
    const sp = (p.spells''','''if (!p || p.dead) return err("Este jugador ya no puede actuar.");
    if (p.dying) return err("Estás moribundo: no puedes actuar.");
    if (p.acted) return err("Ya has actuado esta ronda.");
    const sp = (p.spells''')
rep('''if (asp.selfWound && p.wounds >= 2) return err("No te queda sangre que ofrecer.");''','''if (asp.selfWound && p.hp <= 4) return err("No te queda sangre que ofrecer.");''')
rep('''    let text;
    if (off && t && t.reflect && !asp.pierce) {''','''    let text, selfTxt = "";
    if (off && t && t.reflect && !asp.pierce) {''')
rep('''      if (statusMod(p)) res.why.push(statusMod(p) > 0 ? "vigor (+" + statusMod(p) + ")" : "maldición (" + statusMod(p) + ")");
      res.die = r.die;''','''      statusWhy(p).forEach(function (x) { res.why.push(x); });
      zoneWhy(p, spellAttr(sp)).forEach(function (x) { res.why.push(x); });
      res.die = r.die;''')
rep('''      if (asp.selfWound) addWounds(p, 1);''','''      if (asp.selfWound) { const sw = damage(p, asp.selfWound, { zone: "brazos" }); selfTxt = " Pagas el hechizo con tu sangre (−" + sw.dealt + " de vitalidad)."; p.notes.push("Ronda " + state.round + ": pagaste un conjuro con tu sangre" + hitNote(sw) + "."); }''')
rep('''      else text = "El conjuro se deshace sin efecto.";
    }
    if (off && t) {''','''      else text = "El conjuro se deshace sin efecto.";
      text += selfTxt;
    }
    if (off && t) {''')

# hands trap
rep('''          addWounds(t, 1);
          state.chronicle.push({ round: state.round, text: t.name + " se debilita sin causa aparente." });''','''          const res = damage(t, 2, { src: "interno" });
          t.notes.push("Ronda " + state.round + ": la debilidad te cuesta vitalidad" + hitNote(res) + ".");
          state.chronicle.push({ round: state.round, text: t.name + " se debilita sin causa aparente." });''')

# tierCheck
rep('''      if (t >= 3 && firstTime && p.restedRound !== state.round - 1) {
        addWounds(p, 1);
        p.notes.push("Ronda " + state.round + ": algo dentro de ti te golpeó al oscurecerte más (+1 herida).");''','''      if (t >= 3 && firstTime && p.restedRound !== state.round - 1 && !p.dying) {
        const res = damage(p, 2, { src: "interno" });
        p.notes.push("Ronda " + state.round + ": algo dentro de ti te golpeó al oscurecerte más" + hitNote(res) + ".");''')
rep('''  function tierCheck(p) {
    if (p.dead) return;''','''  function tierCheck(p) {
    if (p.dead) return;''')

# statusMod / why helpers / tickStatus
rep('''  function statusMod(p) {
    if (!p) return 0;
    return (hasStatus(p, "fortalecido") ? 1 : 0) - (hasStatus(p, "maldito") ? 1 : 0);
  }''','''  function statusMod(p) {
    if (!p) return 0;
    return (hasStatus(p, "fortalecido") ? 1 : 0) - (hasStatus(p, "maldito") ? 1 : 0) - (shockOf(p) ? 1 : 0);
  }
  /* Explicación de los modificadores de estado (vigor, maldición, conmoción por heridas). */
  function statusWhy(p) {
    const out = [];
    if (hasStatus(p, "fortalecido")) out.push("vigor (+1)");
    if (hasStatus(p, "maldito")) out.push("maldición (−1)");
    if (shockOf(p)) out.push("estás tan malherido que apenas te sostienes (−1)");
    return out;
  }
  function zoneWhy(p, attr) {
    if (attr === "cuerpo" && armPen(p)) return ["tus brazos gravemente heridos te estorban (−1)"];
    if (attr === "mente" && zoneLvl(p, "cabeza") >= 2) return ["la conmoción de tu cabeza te nubla (−1)"];
    return [];
  }''')
rep('''    p.status.forEach(function (s) {
      if (p.dead) return;
      if (s.id === "sangrado") { state.chronicle.push({ round: state.round, text: "✖ " + p.name + " sigue sangrando." }); addWounds(p, 1); p.notes.push("Ronda " + state.round + ": la herida sigue sangrando (+1 herida)."); }
      if (s.id === "veneno") { p.corr = clamp(p.corr + 3, 0, 100); p.notes.push("Ronda " + state.round + ": el veneno te debilita y te oscurece."); }
      s.left -= 1;
    });''','''    p.status.forEach(function (s) {
      if (p.dead || p.dying) return;
      if (s.id === "sangrado") {
        const n = zoneLvl(p, "torso") >= 2 ? 3 : 2;
        state.chronicle.push({ round: state.round, text: "✖ " + p.name + " sigue sangrando." });
        const res = damage(p, n, { noZone: true, noBleed: true });
        p.notes.push("Ronda " + state.round + ": la herida sigue sangrando (−" + res.dealt + " de vitalidad)" + (res.dying ? " y caes moribundo." : "."));
      }
      if (s.id === "infeccion") {
        const res = damage(p, 1, { noZone: true, noBleed: true });
        p.corr = clamp(p.corr + 2, 0, 100);
        p.notes.push("Ronda " + state.round + ": la infección te consume (−" + res.dealt + " de vitalidad, +corrupción)" + (res.dying ? " y caes moribundo." : "."));
      }
      if (s.id === "veneno") { p.corr = clamp(p.corr + 3, 0, 100); p.notes.push("Ronda " + state.round + ": el veneno te debilita y te oscurece."); }
      s.left -= 1;
    });''')

# ofertas
rep('''cura: { base: 12, text: "El Umbral te arranca del borde de la muerte: -2 heridas y se van el sangrado y el veneno." },''','''cura: { base: 12, text: "El Umbral te arranca del borde de la muerte: +6 de vitalidad y se van el sangrado y el veneno." },''')
rep('''const danger = p.wounds >= 2 || (p.wounds >= 1 && (hasStatus(p, "sangrado") || hasStatus(p, "veneno")));''','''const danger = p.hp <= 0.45 * maxHp(p) || (p.hp < maxHp(p) && (hasStatus(p, "sangrado") || hasStatus(p, "veneno")));''')
rep('''if (o.id === "cura") { p.curas = (p.curas || 0) + 1; p.wounds = Math.max(0, p.wounds - 2); dropStatus(p, "sangrado"); dropStatus(p, "veneno"); easeHands(p, 99); eff = "Tus heridas se cierran."; }''','''if (o.id === "cura") { p.curas = (p.curas || 0) + 1; const h = heal(p, 6); dropStatus(p, "sangrado"); dropStatus(p, "veneno"); easeHands(p, 99); eff = h > 0 ? "Tus heridas se cierran (+" + h + " de vitalidad)." : "Se van el sangrado y el veneno."; }''')

# makePlayer
rep('''      wounds: 0, dead: false, focus: 0,''','''      dead: false, focus: 0,''')
rep('''    if (hasPassive(p, "startItem")) p.items.push(mkItem("daga"));
    if (hasPassive(p, "startVendas"))''','''    p.hp = maxHp(p); p.zones = { cabeza: 0, torso: 0, brazos: 0, piernas: 0 }; p.dying = false;
    initHealth(p);
    if (hasPassive(p, "startItem")) p.items.push(mkItem("daga"));
    if (hasPassive(p, "startVendas"))''')

# evento heal
rep('''else if (ev.effect === "heal") ps.forEach(function (p) { p.wounds = Math.max(0, p.wounds - 1); });''','''else if (ev.effect === "heal") ps.forEach(function (p) { if (!p.dying && p.hp < maxHp(p)) { const h = heal(p, 3); if (h > 0) p.notes.push("Ronda " + state.round + ": la fuente te alivia (+" + h + " de vitalidad)."); } });''')
open(P,"w",encoding="utf-8").write(s)
print("ok2")
