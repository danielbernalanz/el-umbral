import sys
P="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/engine.js"
s=open(P,encoding="utf-8").read()
def rep(old,new,cnt=1):
    global s
    n=s.count(old)
    if n!=cnt:
        print("ABORT: matches=%d for: %s"%(n,old[:100])); sys.exit(1)
    s=s.replace(old,new)

# ---- UNLOCK socorrer + hint
rep('''    conjurar: "Las páginas aprendidas brillan en la oscuridad, esperando tu voz."
  };''','''    conjurar: "Las páginas aprendidas brillan en la oscuridad, esperando tu voz.",
    socorrer: "Alguien se desangra en el suelo: puedes intentar socorrerlo."
  };''')
rep('''    conjurar: function (p) { return !!(p.spells && p.spells.length); }
  };''','''    conjurar: function (p) { return !!(p.spells && p.spells.length); },
    socorrer: function (p) { return !!state && !p.dying && state.players.some(function (x) { return x.id !== p.id && x.dying && !x.dead; }); }
  };''')

# ---- startRound
rep('''    state.handoff = false;
    state.pendingPush = null;
    state.council = null;
    state.players.forEach(function (p) {
      p.acted = !!p.dead || hasStatus(p, "aturdido");''','''    state.handoff = false;
    state.pendingPush = null;
    state.council = null;
    /* Un moribundo tiene una ronda completa para ser socorrido. */
    state.players.forEach(function (p) {
      if (!p.dead && p.dying && state.round >= (p.dyingRound || 0) + 2) {
        p.notes.push("Ronda " + state.round + ": nadie te socorrió a tiempo. Mueres.");
        finish(p, "heridas");
      }
    });
    state.players.forEach(function (p) {
      p.acted = !!p.dead || !!p.dying || hasStatus(p, "aturdido");''')
rep('''    state.skipped = state.players.filter(function (p) { return !p.dead && p.acted; }).map(function (p) { return p.id; });
    state.skipped.forEach(function (id) {
      state.chronicle.push({ round: state.round, text: "✖ " + state.players[id].name + " pierde su turno (aturdido)." });
    });
    state.players.forEach(function (p) { if (!p.dead) tickStatus(p); });
    tickHands();
    state.players.forEach(tierCheck);''','''    state.players.filter(function (p) { return !p.dead && p.acted && !p.dying; }).forEach(function (p) {
      state.chronicle.push({ round: state.round, text: "✖ " + p.name + " pierde su turno (aturdido)." });
    });
    state.players.forEach(function (p) { if (!p.dead) tickStatus(p); });
    tickHands();
    state.players.forEach(tierCheck);
    /* Infección: una zona grave sin curar durante 3 rondas puede infectarse. */
    state.players.forEach(function (p) {
      if (p.dead || p.dying || hasStatus(p, "infeccion")) return;
      if (!ZONES.some(function (z) { return zoneLvl(p, z) >= 2; })) return;
      if (p.healRound !== undefined && p.healRound !== null && state.round - p.healRound < 3) return;
      if (Math.random() < 0.4) { giveStatus(p, "infeccion", 3); if (hasStatus(p, "infeccion")) p.notes.push("Ronda " + state.round + ": una herida grave sin curar se infecta; tienes fiebre."); }
    });
    /* Recuperación natural lenta: +1 en rondas pares si llevas un tiempo sin sufrir daño ni sangrar. */
    if (state.round % 2 === 0) state.players.forEach(function (p) {
      if (p.dead || p.dying || p.hp >= maxHp(p) || hasStatus(p, "sangrado")) return;
      if ((p.hurtRound || 0) >= state.round - 1) return;
      const h = heal(p, 1);
      if (h > 0) p.notes.push("Ronda " + state.round + ": el cuerpo se repone un poco (+" + h + " de vitalidad).");
    });
    state.players.forEach(function (p) { if (p.dying && !p.dead) p.acted = true; });
    state.skipped = state.players.filter(function (p) { return !p.dead && p.acted; }).map(function (p) { return p.id; });''')

# ---- rollCheck con zoneMod
rep('''    const stat = (attr ? p.stats[attr] + corrMod(p, attr) : 0) + statusMod(p);''','''    const stat = (attr ? p.stats[attr] + corrMod(p, attr) + zoneMod(p, attr) : 0) + statusMod(p);''')
# actionOdds
rep('''    const cm = corrMod(p, a.attr), sm = statusMod(p), fo = p.focus > 0 ? p.focus : 0;
    if (cm > 0) mods.push("tu sombra responde (+" + cm + ")"); else if (cm < 0) mods.push("la oscuridad te entorpece (" + cm + ")");
    if (sm) mods.push((sm > 0 ? "vigor (+" : "estados (") + sm + ")");''','''    const cm = corrMod(p, a.attr), sm = statusMod(p), zm = zoneMod(p, a.attr), fo = p.focus > 0 ? p.focus : 0;
    if (cm > 0) mods.push("tu sombra responde (+" + cm + ")"); else if (cm < 0) mods.push("la oscuridad te entorpece (" + cm + ")");
    statusWhy(p).forEach(function (x) { mods.push(x); });
    zoneWhy(p, a.attr).forEach(function (x) { mods.push(x); });''')
rep('''    const bonus = p.stats[a.attr] + cm + sm + fo;''','''    const bonus = p.stats[a.attr] + cm + zm + sm + fo;''')

# ---- act(): dying + canTarget msg + defensa cazar + why
rep('''    if (!p || p.dead) return err("Este jugador ya no puede actuar.");
    if (p.acted) return err("Ya has actuado esta ronda.");
    const a = D.ACTIONS.find''','''    if (!p || p.dead) return err("Este jugador ya no puede actuar.");
    if (p.dying) return err("Estás moribundo: no puedes actuar.");
    if (p.acted) return err("Ya has actuado esta ronda.");
    const a = D.ACTIONS.find''')
rep('''if (a.canTarget && !a.canTarget(t)) return err("Ese jugador no puede ser devorado todavía.");''','''if (a.canTarget && !a.canTarget(t)) return err(a.id === "devorar" ? "Ese jugador no puede ser devorado todavía." : "Ese jugador no puede ser objetivo de esa acción.");''')
rep('''(hasPassive(t, "defenseBonus") ? 2 : 0) + (t.protection !== null ? 2 : 0) - t.wounds;
      diff = d6() + defBonus - huntEdge() + p.wounds;''','''(hasPassive(t, "defenseBonus") ? 2 : 0) + (t.protection !== null ? 2 : 0) - t.wounds - legPen(t);
      diff = d6() + defBonus - huntEdge() + p.wounds;''')
rep('''      const sm = statusMod(p);
      if (sm) why.push(sm > 0 ? "vigor (+" + sm + ")" : "maldición (" + sm + ")");
      if (a.hostile && t && t.protection !== null) why.push''','''      statusWhy(p).forEach(function (x) { why.push(x); });
      zoneWhy(p, a.attr).forEach(function (x) { why.push(x); });
      if (a.hostile && t && t.protection !== null) why.push''')

# ---- applyAction
# explorar pifia
rep('''        if (r.fumble && p.wounds < 2) { addWounds(p, 1); return { text: "Un suelo podrido cede bajo tus pies. Sufres una herida y algo te observa desde las sombras.", log: "Alguien ha registrado las ruinas sin éxito." }; }''','''        if (r.fumble && p.hp > 3) { const res = damage(p, rr(1, 2), { zone: "piernas" }); return { text: "Un suelo podrido cede bajo tus pies y te lastimas" + hitNote(res).replace(" en las piernas", " las piernas") + ". Algo te observa desde las sombras.", log: "Alguien ha registrado las ruinas sin éxito." }; }''')
# hechizar fallo
rep('''        addWounds(p, 1);
        return { text: "La magia se vuelve contra ti y te hiere.", log: "Alguien ha perdido el control de una magia prohibida." };''','''        const hres = damage(p, 3, { src: "magia" });
        return { text: "La magia se vuelve contra ti y te hiere" + hitNote(hres) + ".", log: "Alguien ha perdido el control de una magia prohibida." };''')
# apostar
rep('''        if (s.wound) addWounds(p, s.wound);
        return { text: "El Umbral cobra su precio" + (s.wound ? " y una herida." : "."), log:''','''        const ares = s.wound ? damage(p, s.wound * 3, { src: "gen" }) : null;
        return { text: "El Umbral cobra su precio" + (ares ? " y te hiere" + hitNote(ares) + "." : "."), log:''')
# ceder
rep('''        if (p.wounds < 2) { addWounds(p, 1); woundTxt = " El poder te hiere (1 herida)."; }''','''        if (p.hp > 4) { const cres = damage(p, 2, { src: "gen" }); woundTxt = " El poder te hiere" + hitNote(cres) + "."; }''')
# cazar
rep('''          const hd = huntDamage();
          addWounds(t, hd);
          t.notes.push("Ronda " + state.round + ": una sombra te atacó durante la noche y sufriste " + (hd === 3 ? "tres" : "dos") + " heridas.");
          return { text: "La caza alcanza a " + t.name + ". Sufre " + (hd === 3 ? "tres" : "dos") + " heridas" + (t.dead ? " y queda eliminada o eliminado." : "."), log: null };''','''          const hres = damage(t, huntDamage(), { src: "cazar" });
          t.notes.push("Ronda " + state.round + ": una sombra te atacó durante la noche" + (hres.died ? hitNote(hres) : " y te hirió" + hitNote(hres)) + ".");
          return { text: "La caza alcanza a " + t.name + (hres.died ? ", que ya estaba moribundo: queda eliminada o eliminado." : hres.dying ? ": cae moribundo." : (hres.zone ? " " + ZONE_IN[hres.zone] + ": queda " + visibleHealth(t).split(" · ")[0].toLowerCase() + "." : ".")), log: null };''')
# apuñalar
rep('''          const dmg = r.crit ? 2 : 1;
          addWounds(t, dmg);
          if (r.crit) giveStatus(t, "sangrado", 2);
          t.notes.push("Ronda " + state.round + ": alguien te hirió con un arma blanca (" + dmg + " herida" + (dmg > 1 ? "s" : "") + ").");
          return { text: "Hieres a " + t.name + " (" + dmg + " herida" + (dmg > 1 ? "s" : "") + ")." + (r.crit ? " La herida sangra." : "") + (t.dead ? " Cae." : ""), log: null };''','''          const ares = damage(t, r.crit ? rr(4, 5) : rr(2, 4), { src: "apunalar" });
          if (r.crit) bleed(t, 2);
          t.notes.push("Ronda " + state.round + ": alguien te hirió con un arma blanca" + hitNote(ares) + ".");
          return { text: "Hieres a " + t.name + (ares.zone ? " " + ZONE_IN[ares.zone] : "") + " (−" + ares.dealt + " de vitalidad)." + (hasStatus(t, "sangrado") ? " La herida sangra." : "") + (t.dead ? " Cae, eliminado." : t.dying ? " Cae moribundo." : ""), log: null };''')
# devorar
rep('''          t.wounds = 3; t.dead = true; t.status = []; t.cause = "devorado";
          p.wounds = Math.max(0, p.wounds - 1);''','''          finish(t, "devorado", true);
          const hh = heal(p, 3);''')
rep('''"Devoras a " + t.name + ": heredas " + (loot.length ? loot.length + " objeto(s)" : "nada") + ", recuperas una herida y pierdes 6 de virtud;''','''"Devoras a " + t.name + ": heredas " + (loot.length ? loot.length + " objeto(s)" : "nada") + (hh > 0 ? ", recuperas " + hh + " de vitalidad" : "") + " y pierdes 6 de virtud;''')
rep('''        addWounds(p, 1);
        p.corr = clamp(p.corr + 4, 0, 100);
        return { text: "La carne de " + t.name + " te repugna y te dan arcadas: sufres una herida y la oscuridad te marca.", log: null };''','''        const dres = damage(p, 3, { src: "gen" });
        p.corr = clamp(p.corr + 4, 0, 100);
        return { text: "La carne de " + t.name + " te repugna y te dan arcadas: sufres daño" + hitNote(dres) + " y la oscuridad te marca.", log: null };''')
# descansar
rep('''        p.restedRound = state.round;
        p.wounds = Math.max(0, p.wounds - 1);
        p.corr = clamp(p.corr + 3, 0, 100);
        dropStatus(p, "sangrado"); dropStatus(p, "veneno"); easeHands(p, 2);
        return { text: p.wounds === 0 && !hasStatus(p, "sangrado") && !hasStatus(p, "veneno") ? "Te vendas una herida que no tienes. Muy aparatoso y poco útil, pero el alivio deja su marca igualmente." : "Vendas la herida y te recuperas: -1 herida, se van el sangrado y el veneno, y el alivio deja su marca en ti.", log: null };''','''        p.restedRound = state.round;
        const gone = ["sangrado", "veneno", "infeccion"].filter(function (id) { return hasStatus(p, id); });
        const nothing = p.hp >= maxHp(p) && !gone.length;
        const dh = heal(p, 3);
        p.corr = clamp(p.corr + 3, 0, 100);
        gone.forEach(function (id) { dropStatus(p, id); });
        easeHands(p, 2);
        if (!nothing) p.healRound = state.round;
        const goneTxt = gone.length ? " Se va" + (gone.length > 1 ? "n" : "") + " " + gone.map(function (id) { return id === "infeccion" ? "la infección" : id === "sangrado" ? "el sangrado" : "el veneno"; }).join(", ").replace(/, ([^,]*)$/, " y $1") + "." : "";
        return { text: nothing ? "Te vendas una herida que no tienes. Muy aparatoso y poco útil, pero el alivio deja su marca igualmente." : "Vendas las heridas y te recuperas" + (dh > 0 ? " (+" + dh + " de vitalidad)" : "") + "." + goneTxt + " El alivio deja su marca en ti.", log: null };''')
# socorrer (antes de default)
rep('''      case "entrenar": {
        giveStatus(p, "fortalecido", 2);''','''      case "socorrer": {
        if (!t.dying) return { text: t.name + " ya no necesita socorro.", log: null };
        if (r.success) {
          stabilize(t);
          p.virtue = clamp(p.virtue + 5, 0, 100);
          t.notes.push("Ronda " + state.round + ": " + p.name + " te socorrió y te sacó del borde de la muerte. Sigues con vida, muy débil.");
          state.chronicle.push({ round: state.round, text: "Alguien ha socorrido a " + t.name + ": sigue con vida." });
          return { text: "Estabilizas a " + t.name + ": respira de nuevo, aunque muy débil. +5 virtud.", log: null };
        }
        return { text: "No consigues estabilizar a " + t.name + ". Sigue moribundo y aún queda poco tiempo.", log: null };
      }
      case "entrenar": {
        giveStatus(p, "fortalecido", 2);''')
# pushLuck fallo
rep('''      addWounds(p, 1);
      text = "El Umbral cobra su precio y te hiere.";''','''      const pres = damage(p, 3, { src: "gen" });
      text = "El Umbral cobra su precio y te hiere" + hitNote(pres) + ".";''')
rep('''    if (!p || p.dead) return err("Este jugador ya no puede forzar el destino.");''','''    if (!p || p.dead || p.dying) return err("Este jugador ya no puede forzar el destino.");''')

# ---- useItem
rep('''    if (!p || p.dead) return err("Este jugador ya no puede usar objetos.");''','''    if (!p || p.dead) return err("Este jugador ya no puede usar objetos.");
    if (p.dying) return err("Estás moribundo: no puedes usar objetos.");''')
rep('''      case "heal":
        if (p.wounds <= 0) return err("No tienes heridas que curar.");
        p.wounds -= 1; msg = "Una herida curada."; break;''','''      case "heal": {
        if (p.hp >= maxHp(p) && !hasStatus(p, "sangrado")) return err("No tienes heridas que curar.");
        const h = heal(p, 4); const sg = hasStatus(p, "sangrado"); dropStatus(p, "sangrado");
        msg = (h > 0 ? "+" + h + " de vitalidad" : "Vendas la herida") + (sg ? (h > 0 ? " y se corta el sangrado." : ": se corta el sangrado.") : "."); break;
      }''')
rep('''case "cleanse": dropStatus(p, "sangrado"); dropStatus(p, "veneno"); dropStatus(p, "maldito");''','''case "cleanse": dropStatus(p, "sangrado"); dropStatus(p, "veneno"); dropStatus(p, "infeccion"); dropStatus(p, "maldito");''')
rep('''case "elixir": if (p.wounds > 0) p.wounds -= 1; giveStatus(p, "fortalecido", 2); msg = "Tu cuerpo se renueva y se llena de vigor."; break;''','''case "elixir": { const eh = heal(p, 3); giveStatus(p, "fortalecido", 2); msg = "Tu cuerpo se renueva y se llena de vigor" + (eh > 0 ? " (+" + eh + " de vitalidad)." : "."); break; }''')

# ---- shadowStrike
rep('''    if (pool.length > 1) pool = pool.filter(function (p) { return p.id !== sh.last; });
    if (!pool.length) return;''','''    if (pool.length > 1) pool = pool.filter(function (p) { return p.id !== sh.last; });
    if (pool.some(function (p) { return !p.dying; })) pool = pool.filter(function (p) { return !p.dying; });
    if (!pool.length) return;''')
rep('''(hasPassive(t, "defenseBonus") ? 2 : 0) + (t.protection !== null ? 2 : 0) - t.wounds;
    const r = rollRaw(3, d6() + defBonus);
    if (r.success) {
      addWounds(t, 2);
      t.notes.push("Ronda " + state.round + ": una sombra te atacó durante la noche y sufriste dos heridas.");''','''(hasPassive(t, "defenseBonus") ? 2 : 0) + (t.protection !== null ? 2 : 0) - t.wounds - legPen(t);
    const r = rollRaw(3, d6() + defBonus);
    if (r.success) {
      const sres = damage(t, rr(4, 6), { src: "cazar" });
      t.notes.push("Ronda " + state.round + ": una sombra te atacó durante la noche" + (sres.died ? hitNote(sres) : " y te hirió" + hitNote(sres)) + ".");''')

# ---- registerInteraction
rep('''    if (!actor || !target || actor.id === target.id || actor.dead || target.dead) return err("Elige a dos jugadores que sigan en juego.");''','''    if (!actor || !target || actor.id === target.id || actor.dead || target.dead) return err("Elige a dos jugadores que sigan en juego.");
    if (actor.dying) return err(actor.name + " está moribundo y no puede intervenir en el Consejo.");''')
rep('''    const isPact = type.indexOf("pacto_") === 0;
    if (isPact && targetAccepted''','''    const isPact = type.indexOf("pacto_") === 0;
    if (isPact && target.dying) return err(target.name + " está moribundo y no puede aceptar un pacto.");
    if (isPact && targetAccepted''')

# ---- resolveAmbush
rep('''(actor.corr >= 40 ? 2 : 0) + (hasPassive(actor, "attackBonus") ? 1 : 0) - actor.wounds;''','''(actor.corr >= 40 ? 2 : 0) + (hasPassive(actor, "attackBonus") ? 1 : 0) - actor.wounds - armPen(actor);''')
rep('''(hasPassive(target, "defenseBonus") ? 2 : 0) + (target.protection !== null ? 2 : 0) - target.wounds;
    const a = rollRaw(atkBonus, 0);
    const d = rollRaw(defBonus, 0);
    const attackerWins = a.total > d.total || (a.total === d.total && a.die > d.die);''','''(hasPassive(target, "defenseBonus") ? 2 : 0) + (target.protection !== null ? 2 : 0) - target.wounds - legPen(target);
    const a = rollRaw(atkBonus, 0);
    const d = rollRaw(defBonus, 0);
    const attackerWins = !!target.dying || a.total > d.total || (a.total === d.total && a.die > d.die);''')
rep('''      addWounds(target, (isAssassin(actor) || isAssassin(target)) ? 2 : 1);
      if (target.dead) {
        target.notes.push("Ronda " + state.round + ": has caído y quedas fuera de la partida.");
      }''','''      const wasDying = !!target.dying;
      const ares = damage(target, (isAssassin(actor) || isAssassin(target)) ? rr(5, 6) : rr(3, 4), {});
      if (target.dead) {
        target.notes.push("Ronda " + state.round + ": has caído y quedas fuera de la partida.");
      }''')
rep('''      target.notes.push("Ronda " + state.round + ": " + actor.name + " te emboscó en el Consejo y te hirió.");''','''      target.notes.push("Ronda " + state.round + ": " + actor.name + " te emboscó en el Consejo y te hirió" + hitNote(ares) + ".");''')
rep('''" " + target.name + (target.dead ? " ha sido eliminado." : " sufre " + (isAssassin(actor) || isAssassin(target) ? "dos heridas" : "una herida") + "."),''','''" " + target.name + (target.dead ? " ha sido eliminado." : target.dying ? " cae moribundo." : " queda " + visibleHealth(target).split(" · ")[0].toLowerCase() + "."),''')
open(P,"w",encoding="utf-8").write(s)
print("ok3")
