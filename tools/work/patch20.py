import sys
W = "/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/"
def rep(f, old, new, count=1):
    p = W + f
    s = open(p, encoding="utf-8").read()
    n = s.count(old)
    if n != count: sys.exit("FAIL %s count=%d :: %r" % (f, n, old[:90]))
    open(p, "w", encoding="utf-8").write(s.replace(old, new))
e="engine.js"; u="ui.js"; d="data.js"; h="index.html"

# ================= DATA =================
rep(d,'    coartada: { id: "coartada"','''    espejo: { id: "espejo", name: "Espejo de plata", kind: "reflect", desc: "Refleja la próxima agresión directa que recibas: falla y quien atacó queda maldito dos rondas." },
    ceniza: { id: "ceniza", name: "Ceniza de protección", kind: "ward", desc: "Anula el próximo sangrado, veneno, aturdimiento o maldición que te lancen." },
    antidoto: { id: "antidoto", name: "Antídoto", kind: "cleanse", desc: "Quita sangrado, veneno y maldición, y alivia los males sin nombre." },
    aguabendita: { id: "aguabendita", name: "Agua bendita", kind: "purify", value: 8, desc: "Aparta parte de la oscuridad que llevas contigo y te da algo de paz." },
    polvo: { id: "polvo", name: "Polvo cegador", kind: "dust", desc: "Lo lanzas sobre otro jugador: queda maldito (−1 a sus tiradas) una ronda." },
    elixir: { id: "elixir", name: "Elixir de vigor", kind: "elixir", desc: "Cura una herida y te fortalece durante dos rondas." },
    grimorio: { id: "grimorio", name: "Grimorio incompleto", kind: "tome", desc: "Páginas con conjuros a medio escribir. Al estudiarlo eliges uno entre tres y le das forma." },
    runa: { id: "runa", name: "Runa de poder", kind: "rune", desc: "Grabada en tu conjuro más gastado, le concede un uso más." },
    cota: { id: "cota", name: "Cota de malla", kind: "defense", value: 3, desc: "+3 defensa esta ronda." },
    vela: { id: "vela", name: "Vela de sebo negro", kind: "ritual", desc: "Un pequeño ritual: +1 foco y +3 virtud." },
    capa: { id: "capa", name: "Capa de niebla", kind: "fog", desc: "Las dos próximas pistas que obtengan sobre ti serán más débiles." },
    coartada: { id: "coartada"''')
rep(d,'"frasco", "pergamino", "porra"];','"frasco", "pergamino", "porra", "espejo", "ceniza", "antidoto", "aguabendita", "polvo", "elixir", "grimorio", "grimorio", "runa", "cota", "vela", "capa"];')
rep(d,'"llave", "frasco", "pergamino"];','"llave", "frasco", "pergamino", "grimorio", "runa", "polvo", "espejo"];')
rep(d,'    { id: "tender",','''    { id: "conjurar", name: "Conjurar", tag: "MAGIA", attr: null, target: false, diff: 0, risk: false, desc: "Lanzas uno de tus conjuros. Cada uno tiene su propio efecto, su riesgo y un número limitado de usos. Los verás todos antes de elegir." },
    { id: "tender",''')
rep(d,"cuestan menos oscuridad.","cuestan menos oscuridad y empiezas con un conjuro.")

# ================= ENGINE =================
rep(e,'const HOSTILE = ["robar",','const HOSTILE = ["conjuro_of", "robar",')
rep(e,"      stolen: [], betrayals: 0,","      spells: [], stolen: [], betrayals: 0,")
# ward en giveStatus
rep(e,"    if (!p || p.dead) return;\n    p.status = p.status || [];","    if (!p || p.dead) return;\n    if (p.ward && [\"sangrado\", \"veneno\", \"aturdido\", \"maldito\"].indexOf(id) !== -1) { p.ward = false; p.notes.push(\"Ronda \" + (state ? state.round : \"?\") + \": una ceniza invisible absorbió un mal dirigido a ti.\"); return; }\n    p.status = p.status || [];")
# niebla en makeClue
rep(e,"    let str = strength || 1;\n","    let str = strength || 1;\n    if (target.fog > 0) { target.fog -= 1; str = Math.max(1, str - 1); }\n")
# reflejo en act
rep(e,"    if (a.hostile && a.id !== \"cazar\" && t && t.protection !== null) diff += 1;",'''    if (a.hostile && t && t.reflect) {
      t.reflect = false; giveStatus(p, "maldito", 2);
      t.notes.push("Ronda " + state.round + ": un reflejo plateado devolvió una agresión contra ti.");
      p.notes.push("Ronda " + state.round + ": tu agresión chocó contra un reflejo y rebotó sobre ti. Quedas maldito.");
      if (p.offer && !p.offer.done) resolveOffer(p, false);
      if (handOfferFor(p)) resolveHand(p, false);
      if (a.needs && a.consume !== false) { const jx = p.items.findIndex(function (i) { return i.id === a.needs; }); if (jx >= 0) p.items.splice(jx, 1); }
      p.acted = true; p.action = a.id; p.actionTarget = t.id; state.pendingPush = null;
      save();
      return { ok: true, die: 0, stat: 0, focus: 0, status: 0, total: 0, diff: 0, crit: false, fumble: false, success: false, outcome: "Tu agresión choca contra un reflejo plateado y rebota sobre ti. Quedas maldito.", pushable: false, action: a.name };
    }
    if (a.hostile && a.id !== "cazar" && t && t.protection !== null) diff += 1;''')
rep(e,"    if (!isUnlocked(p, a)) return err(\"Aún no puedes hacer eso.\");","    if (a.id === \"conjurar\") return err(\"Elige un conjuro.\");\n    if (!isUnlocked(p, a)) return err(\"Aún no puedes hacer eso.\");")
# items nuevos en useItem
rep(e,'      case "shield": p.shield = true;','''      case "reflect": p.reflect = true; msg = "Un reflejo plateado te envuelve. La próxima agresión directa rebotará."; break;
      case "ward": p.ward = true; msg = "Una ceniza invisible te envuelve."; break;
      case "cleanse": dropStatus(p, "sangrado"); dropStatus(p, "veneno"); dropStatus(p, "maldito"); easeHands(p, 99); msg = "Te sientes más limpio por dentro."; break;
      case "purify": p.corr = clamp(p.corr - def.value, 0, 100); p.virtue = clamp(p.virtue + 2, 0, 100); msg = "Algo oscuro se aparta de ti."; break;
      case "dust": {
        const dt = state.players[targetId];
        if (!dt || dt.id === p.id || dt.dead) return err("Elige a otro jugador que siga en la partida.");
        if (dt.reflect) { dt.reflect = false; giveStatus(p, "maldito", 1); msg = "El polvo rebota en un reflejo y te nubla la vista a ti."; }
        else { giveStatus(dt, "maldito", 1); dt.notes.push("Ronda " + state.round + ": un polvo cegador te nubló la vista."); msg = dt.name + " queda con la vista nublada."; }
        break;
      }
      case "elixir": if (p.wounds > 0) p.wounds -= 1; giveStatus(p, "fortalecido", 2); msg = "Tu cuerpo se renueva y se llena de vigor."; break;
      case "ritual": p.focus = Math.min(2, p.focus + 1); p.virtue = clamp(p.virtue + 3, 0, 100); msg = "La llama negra te serena: +1 foco."; break;
      case "fog": p.fog = (p.fog || 0) + 2; msg = "La niebla te cubre; costará leerte."; break;
      case "rune": {
        const rs = (p.spells || []).slice().sort(function (x, y) { return x.uses - y.uses; })[0];
        if (!rs) return err("No conoces ningún conjuro.");
        rs.uses += 1; msg = "Tu conjuro «" + rs.name + "» gana un uso."; break;
      }
      case "tome": return err("Estudia el grimorio para aprender un conjuro.");
      case "shield": p.shield = true;''')
# pistas del conjuro
rep(e,'      case "tender": return d.ok ?','      case "conjurar": return { text: pre + "el aire olía a magia cerca de " + other + "; el eco del conjuro se parecía a la voz de " + n + ".", bonus: 1 };\n      case "tender": return d.ok ?')
rep(e,'"aturdir", "devorar", "tender"].indexOf(a.id)','"aturdir", "devorar", "tender", "conjurar"].indexOf(a.id)')

# hints indirectos
rep(e,'''        if (!silent) { out.push(a.name); p.notes.push("Ronda " + state.round + ": se abre ante ti una nueva posibilidad: " + a.name + "."); }''','''        if (!silent) { const hint = UNLOCK_HINT[a.id] || "Algo nuevo se abre ante ti."; out.push(hint); p.notes.push("Ronda " + state.round + ": " + hint); }''')
rep(e,'''      p.notes.push("Ronda " + state.round + ": la práctica te ha hecho más hábil. Sube tu " + attr + ".");
      p.fresh = p.fresh || []; p.fresh.push("mejora tu " + attr);''','''      const ah = ATTR_HINT[attr];
      p.notes.push("Ronda " + state.round + ": " + ah);
      p.fresh = p.fresh || []; p.fresh.push(ah);''')
rep(e,"  const BASE_ACTIONS =",'''  const UNLOCK_HINT = {
    descansar: "Tu cuerpo recuerda el dolor y empieza a pedir una tregua.", entrenar: "Tus músculos piden más de lo que les das.",
    apostar: "Notas un cosquilleo: la suerte parece mirarte de reojo.", tender: "Empiezas a entender que una mano abierta puede ser refugio… o cebo.",
    resistir: "Algo en ti aprende a decir que no.", robar: "Tus dedos empiezan a pensar por su cuenta.",
    hechizar: "Las palabras prohibidas cosquillean en tu lengua.", ceder: "Los susurros del Umbral suenan cada vez más razonables.",
    apunalar: "El peso del filo en tu mano te sugiere cosas.", envenenar: "El frasco parece susurrar cosas amables.",
    maldecir: "Las letras del pergamino se retuercen hacia ti.", aturdir: "La porra pesa como una promesa.",
    devorar: "Un hambre antigua se despierta bajo tus costillas.", cazar: "La noche te reconoce como uno de los suyos.",
    conjurar: "Las páginas aprendidas brillan en la oscuridad, esperando tu voz."
  };
  const ATTR_HINT = { cuerpo: "Tus pasos son más firmes de lo que recordabas.", mente: "Las ideas encajan con menos esfuerzo.", sombra: "La oscuridad te resulta más familiar." };
  const BASE_ACTIONS =''')
rep(e,"    cazar: function (p) { return isAssassin(p); }\n  };","    cazar: function (p) { return isAssassin(p); },\n    conjurar: function (p) { return !!(p.spells && p.spells.length); }\n  };")

# ---- magia procedural ----
rep(e,"  /* ---------- La mano tendida",r'''  /* ---------- Magia procedural: formas + aspectos + ajuste ---------- */
  const SPELL_FORMS = {
    rayo: { name: "Rayo", kind: "off", attr: "sombra", diff: 5, target: true },
    plaga: { name: "Plaga", kind: "off", attr: "sombra", diff: 4, target: true },
    marchitar: { name: "Marchitar", kind: "off", attr: "sombra", diff: 5, target: true },
    grillete: { name: "Grillete", kind: "off", attr: "mente", diff: 6, target: true },
    maleficio: { name: "Maleficio", kind: "off", attr: "mente", diff: 5, target: true },
    drenar: { name: "Drenar", kind: "off", attr: "mente", diff: 4, target: true },
    pesadilla: { name: "Pesadilla", kind: "off", attr: "sombra", diff: 4, target: true },
    egida: { name: "Égida", kind: "def", attr: "mente", diff: 3, target: false },
    sanar: { name: "Sanar", kind: "def", attr: "mente", diff: 4, target: false },
    velo: { name: "Velo", kind: "def", attr: "sombra", diff: 3, target: false },
    purga: { name: "Purga", kind: "def", attr: "mente", diff: 4, target: false },
    reflejo: { name: "Reflejo", kind: "def", attr: "sombra", diff: 4, target: false },
    presagio: { name: "Presagio", kind: "def", attr: "mente", diff: 3, target: true }
  };
  const SPELL_ASPECTS = {
    fuego: { adj: "ígneo", roll: 1, selfCorr: 3, text: "más certero, pero te mancha un poco" },
    hielo: { adj: "gélido", dur: 1, text: "sus efectos duran una ronda más" },
    sangre: { adj: "de sangre", selfWound: 1, power: 1, text: "te cuesta una herida, pero golpea con más fuerza" },
    sombra: { adj: "umbrío", stealth: true, selfCorr: 2, text: "no deja rastro público, pero te mancha" },
    luz: { adj: "luminoso", roll: -1, selfCorr: -3, text: "limpia algo de tu oscuridad, pero es menos fiable (usa Mente)" },
    vacio: { adj: "del vacío", pierce: true, text: "atraviesa protecciones y reflejos" }
  };
  const SPELL_EPITHETS = ["de Vael", "de Orum", "de la Ceniza", "del Cuervo", "de Ithra", "de la Marea Negra", "de Kesh", "del Último Umbral", "de Mor", "de la Aguja"];
  function spellFormText(id, pw, dur) {
    switch (id) {
      case "rayo": return "Una descarga que hiere al objetivo (" + (pw > 1 ? "2 heridas" : "1 herida, 2 si es crítico") + ").";
      case "plaga": return "Envenena al objetivo durante " + (2 + dur + (pw > 1 ? 1 : 0)) + " rondas.";
      case "marchitar": return "Abre un sangrado en el objetivo durante " + (1 + dur + (pw > 1 ? 1 : 0)) + " rondas.";
      case "grillete": return "Inmoviliza al objetivo: pierde su turno.";
      case "maleficio": return "Maldice al objetivo: −1 a sus tiradas durante " + (2 + dur + (pw > 1 ? 1 : 0)) + " rondas.";
      case "drenar": return "Arrebatas " + (pw > 1 ? 12 : 8) + " de virtud al objetivo y recuperas la mitad.";
      case "pesadilla": return "Siembra una pesadilla: el objetivo se mancha de oscuridad sin saber por qué.";
      case "egida": return "Una barrera: +" + (3 + 2 * (pw - 1)) + " de defensa esta ronda.";
      case "sanar": return "Cierra " + (pw > 1 ? 2 : 1) + (pw > 1 ? " heridas." : " herida.");
      case "velo": return "Un velo: anula la próxima acusación contra ti" + (pw > 1 ? " y debilita las dos próximas pistas sobre ti." : ".");
      case "purga": return "Expulsa " + (10 + 6 * (pw - 1)) + " de oscuridad y limpia sangrado, veneno y maldición.";
      case "reflejo": return "Preparas un reflejo: la próxima agresión directa rebota contra su autor.";
      case "presagio": return "Una visión: obtienes una pista " + (pw > 1 ? "muy fuerte " : "fuerte ") + "sobre el objetivo.";
    }
    return "";
  }
  function finalizeSpell(sp) {
    const f = SPELL_FORMS[sp.form], asp = SPELL_ASPECTS[sp.aspect];
    sp.kind = f.kind; sp.target = f.target;
    sp.power = 1 + (asp.power || 0) + (sp.tune === "potente" ? 1 : 0);
    sp.stealth = !!(asp.stealth || sp.tune === "sutil");
    const tn = { potente: "mayor", estable: "perdurable", sutil: "silente" };
    sp.name = f.name + " " + asp.adj + (sp.tune ? " " + tn[sp.tune] : "") + " " + sp.epithet;
    const tuneTxt = sp.tune === "potente" ? " Potenciado: más intensidad, pero te mancha." : sp.tune === "estable" ? " Estable: un uso extra." : sp.tune === "sutil" ? " Sutil: no deja rastro público." : "";
    sp.desc = spellFormText(sp.form, sp.power, asp.dur || 0) + " " + asp.text.charAt(0).toUpperCase() + asp.text.slice(1) + "." + tuneTxt;
    return sp;
  }
  function genSpell(kind, avoidForm) {
    const forms = Object.keys(SPELL_FORMS).filter(function (k) { return (!kind || SPELL_FORMS[k].kind === kind) && k !== avoidForm; });
    const sp = { id: "s" + Date.now().toString(36) + rnd(99999), form: pick(forms), aspect: pick(Object.keys(SPELL_ASPECTS)), epithet: pick(SPELL_EPITHETS), uses: 1 + rnd(2), tune: null };
    return finalizeSpell(sp);
  }
  function genOptions() {
    const a = genSpell("off"), b = genSpell("def");
    const c = genSpell(Math.random() < 0.5 ? "off" : "def", null);
    return [a, b, c.form === a.form || c.form === b.form ? genSpell(c.kind, c.form) : c];
  }
  function spellAttr(sp) { return sp.aspect === "luz" ? "mente" : SPELL_FORMS[sp.form].attr; }
  function applySpell(p, sp, t, crit) {
    const pw = sp.power, dur = SPELL_ASPECTS[sp.aspect].dur || 0, r = state.round;
    switch (sp.form) {
      case "rayo": { const w = pw > 1 || crit ? 2 : 1; addWounds(t, w); t.notes.push("Ronda " + r + ": una descarga te golpeó desde la nada."); return t.name + " recibe " + w + (w > 1 ? " heridas." : " herida."); }
      case "plaga": giveStatus(t, "veneno", 2 + dur + (pw > 1 ? 1 : 0)); t.notes.push("Ronda " + r + ": un sabor amargo te sube por la garganta."); return t.name + " enferma.";
      case "marchitar": giveStatus(t, "sangrado", 1 + dur + (pw > 1 ? 1 : 0)); t.notes.push("Ronda " + r + ": una herida se abre sola."); return "Un sangrado se abre en " + t.name + ".";
      case "grillete":
        if (!t.acted) { t.acted = true; state.chronicle.push({ round: r, text: "✖ " + t.name + " pierde su turno de esta ronda." }); t.notes.push("Ronda " + r + ": tus miembros se quedaron rígidos."); return t.name + " pierde su turno de esta ronda."; }
        giveStatus(t, "aturdido", 1); t.notes.push("Ronda " + r + ": tus miembros se quedaron rígidos."); return t.name + " perderá su próximo turno.";
      case "maleficio": giveStatus(t, "maldito", 2 + dur + (pw > 1 ? 1 : 0)); t.notes.push("Ronda " + r + ": sientes que la suerte te da la espalda."); return t.name + " queda maldito.";
      case "drenar": { const v = pw > 1 ? 12 : 8; t.virtue = clamp(t.virtue - v, 0, 100); p.virtue = clamp(p.virtue + Math.floor(v / 2), 0, 100); t.notes.push("Ronda " + r + ": algo bueno se apagó dentro de ti."); return "Le arrebatas virtud a " + t.name + "."; }
      case "pesadilla": t.corr = clamp(t.corr + 5 + 2 * (pw - 1), 0, 100); t.notes.push("Ronda " + r + ": una pesadilla te dejó un regusto oscuro."); return t.name + " tendrá pesadillas.";
      case "egida": p.roundDefense += 3 + 2 * (pw - 1); return "Una barrera te rodea esta ronda.";
      case "sanar": p.wounds = Math.max(0, p.wounds - (pw > 1 ? 2 : 1)); return "Tus heridas se cierran.";
      case "velo": p.shield = true; if (pw > 1) p.fog = (p.fog || 0) + 2; return "Un velo te cubre.";
      case "purga": p.corr = clamp(p.corr - (10 + 6 * (pw - 1)), 0, 100); dropStatus(p, "sangrado"); dropStatus(p, "veneno"); dropStatus(p, "maldito"); easeHands(p, 99); return "La oscuridad sale de ti.";
      case "reflejo": p.reflect = true; return "Un reflejo te protege de la próxima agresión directa.";
      case "presagio": { const c = makeClue(t, pw > 1 ? 3 : 2); if (c) p.clues.push(c); return c ? "La visión te revela algo sobre " + t.name + "." : "La visión se desvanece."; }
    }
    return "No ocurre nada.";
  }
  function cast(actorId, spellId, targetId) {
    if (!state || state.phase !== "private") return err("Ahora no puedes actuar.");
    if (state.handoff) return err("Primero entrega el móvil.");
    if (state.turn !== actorId) return err("No es tu turno.");
    const p = state.players[actorId];
    if (!p || p.dead) return err("Este jugador ya no puede actuar.");
    if (p.acted) return err("Ya has actuado esta ronda.");
    const sp = (p.spells || []).find(function (s) { return s.id === spellId; });
    if (!sp || sp.uses <= 0) return err("Ese conjuro ya no existe.");
    const f = SPELL_FORMS[sp.form], asp = SPELL_ASPECTS[sp.aspect];
    let t = null;
    if (f.target) { t = state.players[targetId]; if (!t || t.id === p.id || t.dead) return err("Debes elegir a otro jugador que siga en la partida."); }
    if (asp.selfWound && p.wounds >= 2) return err("No te queda sangre que ofrecer.");
    const off = f.kind === "off";
    if (p.offer && !p.offer.done) resolveOffer(p, false);
    if (handOfferFor(p)) resolveHand(p, false);
    p.did = p.did || {}; p.did.conjurar = (p.did.conjurar || 0) + 1;
    sp.uses -= 1;
    if (sp.uses <= 0) p.spells = p.spells.filter(function (s) { return s !== sp; });
    const res = { ok: true, die: 0, stat: 0, focus: 0, status: 0, total: 0, diff: 0, crit: false, fumble: false, success: false, pushable: false, action: "Conjurar" };
    let text;
    if (off && t && t.reflect && !asp.pierce) {
      t.reflect = false; giveStatus(p, "maldito", 2);
      t.notes.push("Ronda " + state.round + ": un reflejo plateado devolvió un conjuro dirigido a ti.");
      p.notes.push("Ronda " + state.round + ": tu conjuro rebotó contra un reflejo.");
      text = "Tu conjuro choca contra un reflejo plateado y rebota. Quedas maldito.";
    } else {
      const diff = Math.max(2, f.diff - (asp.roll || 0) + (off && t && t.protection !== null && !asp.pierce ? 1 : 0));
      const r = rollCheck(p, spellAttr(sp), diff);
      res.die = r.die; res.stat = r.stat; res.focus = r.focus; res.status = r.status || 0; res.total = r.total; res.diff = r.diff; res.crit = r.crit; res.fumble = r.fumble; res.success = r.success;
      p.corr = clamp(p.corr + (asp.selfCorr || 0) + (sp.tune === "potente" ? 3 : 0), 0, 100);
      if (asp.selfWound) addWounds(p, 1);
      if (r.success) { text = applySpell(p, sp, t, r.crit); addXp(p, spellAttr(sp), r.crit ? 2 : 1); }
      else if (r.fumble) { p.corr = clamp(p.corr + 3, 0, 100); text = "El conjuro se retuerce entre tus dedos y te mancha."; }
      else text = "El conjuro se deshace sin efecto.";
    }
    if (off && t) {
      if (!sp.stealth) state.chronicle.push({ round: state.round, text: "Se oyeron palabras antiguas cerca de " + t.name + "." });
      p.deeds = p.deeds || [];
      p.deeds.push({ round: state.round, kind: "conjurar", target: t.id, ok: res.success });
    }
    p.acted = true; p.action = off ? "conjuro_of" : "conjuro_def"; p.actionTarget = t ? t.id : null;
    state.pendingPush = null;
    res.outcome = text;
    save();
    return res;
  }
  function studyChecks(pid) {
    if (!state || state.phase !== "private" || state.handoff || state.turn !== pid) return "Ahora no puedes estudiar.";
    const p = state.players[pid];
    if (!p || p.dead || p.acted) return "Este jugador ya no puede estudiar.";
    if (p.usedItem) return "Ya has usado un objeto esta ronda.";
    return null;
  }
  function studyOptions(pid, idx) {
    const bad = studyChecks(pid); if (bad) return err(bad);
    const p = state.players[pid];
    const it = p.items[idx];
    if (!it || it.id !== "grimorio") return err("Ese objeto no se puede estudiar.");
    if (!p.study || p.study.idx !== idx) p.study = { idx: idx, opts: genOptions() };
    save();
    return { ok: true, options: p.study.opts };
  }
  function learnSpell(pid, optIdx, tune) {
    const bad = studyChecks(pid); if (bad) return err(bad);
    const p = state.players[pid];
    const st = p.study;
    if (!st || !p.items[st.idx] || p.items[st.idx].id !== "grimorio") return err("No estás estudiando nada.");
    const base = st.opts[optIdx];
    if (!base) return err("Elige un conjuro.");
    if (["potente", "estable", "sutil"].indexOf(tune) === -1) return err("Elige un ajuste.");
    const sp = Object.assign({}, base, { tune: tune, id: "s" + Date.now().toString(36) + rnd(99999) });
    if (tune === "estable") sp.uses += 1;
    finalizeSpell(sp);
    p.spells = p.spells || [];
    if (p.spells.length >= 4) { p.spells.sort(function (x, y) { return x.uses - y.uses; }); p.spells.shift(); }
    p.spells.push(sp);
    p.items.splice(st.idx, 1);
    p.usedItem = true; p.study = null;
    p.notes.push("Ronda " + state.round + ": estudiaste un grimorio y aprendiste «" + sp.name + "».");
    save();
    return { ok: true, spell: sp, msg: "Aprendes «" + sp.name + "»." };
  }

  /* ---------- La mano tendida''')
rep(e,"    players.forEach(function (p) { unlockNotices(p, true); });","    players.forEach(function (p) { if (hasPassive(p, \"spellDiscount\")) p.spells.push(genSpell(null)); });\n    players.forEach(function (p) { unlockNotices(p, true); });")
rep(e,"getHandOffer: getHandOffer,","getHandOffer: getHandOffer, cast: cast, studyOptions: studyOptions, learnSpell: learnSpell,")

# ================= UI =================
rep(u,"  let pendingMode = null;","  let pendingMode = null;\n  let pendingSpell = null;\n  let pendingStudy = null;")
rep(u,"pendingItem = null; pendingMode = null;","pendingItem = null; pendingMode = null; pendingSpell = null; pendingStudy = null;",3)
rep(u,"    if (pendingMode) { renderModePicker(p); return; }","    if (pendingStudy) { renderStudyPicker(p); return; }\n    if (pendingSpell) { renderSpellPicker(p); return; }\n    if (pendingMode) { renderModePicker(p); return; }")
rep(u,"    if (a.gamble) { pendingStake = a; renderPrivate(); return; }","    if (a.__confirm) { a.__confirm(); return; }\n    if (a.id === \"conjurar\") { pendingSpell = { id: null }; renderPrivate(); return; }\n    if (a.gamble) { pendingStake = a; renderPrivate(); return; }")
rep(u,'''const chip = a.risk ? (a.gamble ? "ENVITE" : prob + "%") : "SEGURO";''','''const chip = a.id === "conjurar" ? "MAGIA" : a.risk ? (a.gamble ? "ENVITE" : prob + "%") : "SEGURO";''')
rep(u,'''    $("actionSheetMeta").textContent = meta;
    $("actionOverlay").classList.remove("hidden");
  }''','''    $("actionSheetMeta").textContent = meta;
    $("btnActionChoose").textContent = "Elegir";
    $("actionOverlay").classList.remove("hidden");
  }

  function openInfoSheet(tag, title, desc, meta, label, fn) {
    sheetAction = { __confirm: fn };
    $("actionSheetTag").textContent = tag;
    $("actionSheetTitle").textContent = title;
    $("actionSheetDesc").textContent = desc;
    $("actionSheetMeta").textContent = meta;
    $("btnActionChoose").textContent = label;
    $("actionOverlay").classList.remove("hidden");
  }''')
rep(u,"  function renderModePicker(p) {",r'''  function spellsHTML(p) {
    if (!p.spells || !p.spells.length) return "";
    return "<h3>Conjuros</h3>" + p.spells.map(function (sp) {
      return '<div class="itemrow"><div><b>' + esc(sp.name) + '</b><div class="small">' + esc(sp.desc) + ' · ' + sp.uses + ' uso' + (sp.uses > 1 ? "s" : "") + '</div></div></div>';
    }).join("");
  }

  function doCast(spellId, targetId) {
    const p = U.currentPlayer();
    const res = U.cast(p.id, spellId, targetId);
    if (!res.ok) { $("actionHint").textContent = res.msg; return; }
    pendingSpell = null;
    showRoll({ title: "CONJURO", result: res, text: res.outcome, buttons: [{ label: "Continuar", cls: "primary", onClick: endTurn }] });
  }

  function renderSpellPicker(p) {
    const box = $("actionChoices");
    box.className = "actions";
    box.innerHTML = "";
    $("actionHint").classList.remove("hidden");
    if (pendingSpell.id !== null) {
      $("actionHint").textContent = "¿Sobre quién recae el conjuro?";
      U.getState().players.filter(function (x) { return x.id !== p.id && !x.dead; }).forEach(function (t) {
        const btn = document.createElement("button");
        btn.className = "choice";
        btn.innerHTML = '<b>' + esc(t.name) + '</b><span class="small">' + (t.wounds ? t.wounds + ' heridas visibles' : 'Sin heridas visibles') + '</span>';
        btn.onclick = function () { doCast(pendingSpell.id, t.id); };
        box.appendChild(btn);
      });
      addCancel(box);
      return;
    }
    $("actionHint").textContent = "Elige un conjuro. Cada uno se gasta con el uso.";
    (p.spells || []).forEach(function (sp) {
      const btn = document.createElement("button");
      btn.className = "choice";
      btn.innerHTML = '<b>' + esc(sp.name) + '</b><span class="small">' + esc(sp.desc) + ' · ' + sp.uses + ' uso' + (sp.uses > 1 ? "s" : "") + '</span>';
      btn.onclick = function () { if (sp.target) { pendingSpell = { id: sp.id }; renderPrivate(); } else doCast(sp.id, null); };
      box.appendChild(btn);
    });
    addCancel(box);
  }

  function renderStudyPicker(p) {
    const box = $("actionChoices");
    box.className = "actions";
    box.innerHTML = "";
    $("actionHint").classList.remove("hidden");
    const st = pendingStudy;
    if (st.pick === null) {
      $("actionHint").textContent = "Tres conjuros asoman entre las páginas. Elige uno.";
      st.opts.forEach(function (sp, i) {
        const btn = document.createElement("button");
        btn.className = "choice";
        btn.innerHTML = '<b>' + esc(sp.name) + '</b><span class="small">' + (sp.kind === "off" ? "Ofensivo" : "Defensivo") + ' · ' + esc(sp.desc) + ' · ' + sp.uses + ' uso' + (sp.uses > 1 ? "s" : "") + '</span>';
        btn.onclick = function () { st.pick = i; renderPrivate(); };
        box.appendChild(btn);
      });
    } else {
      $("actionHint").textContent = "Dale forma a «" + st.opts[st.pick].name + "».";
      [["potente", "Potente", "Más intensidad, pero te mancha de oscuridad al lanzarlo."], ["estable", "Estable", "Un uso extra."], ["sutil", "Sutil", "No deja rastro público al lanzarlo."]].forEach(function (o) {
        const btn = document.createElement("button");
        btn.className = "choice";
        btn.innerHTML = '<b>' + o[1] + '</b><span class="small">' + o[2] + '</span>';
        btn.onclick = function () { const r = U.learnSpell(p.id, st.pick, o[0]); toast(r.msg, !r.ok); pendingStudy = null; renderPrivate(); };
        box.appendChild(btn);
      });
    }
    addCancel(box);
  }

  function renderModePicker(p) {''')
rep(u,"      '<h3>Notas</h3>' + notes;","      spellsHTML(p) + '<h3>Notas</h3>' + notes;")
rep(u,'''  function onUseItem(index) {
    const p = U.currentPlayer();
    const def = D.ITEMS[p.items[index].id];
    if (def.kind === "clue") {''','''  function onUseItem(index) {
    const p = U.currentPlayer();
    const def = D.ITEMS[p.items[index].id];
    openInfoSheet("OBJETO", def.name, def.desc, "Solo puedes usar un objeto por ronda. Se gasta al usarlo.", def.kind === "tome" ? "Estudiar" : "Usar", function () { useItemConfirmed(index); });
  }

  function useItemConfirmed(index) {
    const p = U.currentPlayer();
    const def = D.ITEMS[p.items[index].id];
    if (def.kind === "tome") {
      const so = U.studyOptions(p.id, index);
      if (!so.ok) { toast(so.msg, true); return; }
      pendingStudy = { idx: index, opts: so.options, pick: null };
      renderPrivate();
      return;
    }
    if (def.kind === "clue" || def.kind === "dust") {''')
rep(u,'''if (fresh.length) toast("Algo se abre ante ti: " + fresh.join(", ") + ".", false);''','''if (fresh.length) toast(fresh.join(" "), false);''')
# descripciones del Consejo
rep(u,'''    if (type === "revelar" && !actor.clues.some(function (c) { return c.about === Number($("ixTarget").value); })) return "No tienes pruebas sobre ese jugador.";
    return "";''','''    if (type === "revelar" && !actor.clues.some(function (c) { return c.about === Number($("ixTarget").value); })) return "No tienes pruebas sobre ese jugador.";
    return IX_DESC[type] || "";''')
rep(u,"  function ixHint(s) {",'''  const IX_DESC = {
    pacto_no_agresion: "Ambos prometen no agredirse. Se evalúa al final de la siguiente ronda; romperlo deja marca.",
    pacto_silencio: "Ambos prometen callar lo que sepan el uno del otro.",
    pacto_proteccion: "Uno se compromete a proteger al otro. Se evalúa al final de la siguiente ronda.",
    amenaza: "Amenazas en público: el objetivo pierde virtud y tú te manchas.",
    revelar: "Muestras a todos una pista que tienes sobre el objetivo.",
    acusacion: "Acusas al objetivo de ser el Asesino. Si te equivocas, lo pagas.",
    emboscada: "Atacas por sorpresa; el objetivo se defiende con una tirada.",
    romper: "Quien actúa rompe su silencio: cuenta que el objetivo le tendió la mano. Nadie puede comprobarlo."
  };
  function ixHint(s) {''')
# ================= HTML reglas =================
rep(h,"        <li><b>Tender la mano</b>",'''        <li><b>Magia</b>: los conjuros se aprenden de grimorios que encuentres (y el taumaturgo empieza con uno). Cada conjuro se compone de una forma, un aspecto y un ajuste que eliges al estudiarlo; los hay ofensivos y defensivos, con usos limitados. También hay muchos objetos: espejos, cenizas, antídotos, polvos, runas…</li>
        <li><b>Tender la mano</b>''')
print("OK")
