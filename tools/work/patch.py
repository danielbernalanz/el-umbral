import sys
W = "/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/"

def rep(f, old, new, count=1):
    p = W + f
    s = open(p, encoding="utf-8").read()
    n = s.count(old)
    if n != count:
        sys.exit("FAIL %s: expected %d got %d :: %r" % (f, count, n, old[:80]))
    s = s.replace(old, new)
    open(p, "w", encoding="utf-8").write(s)

def slice_replace(f, start_marker, end_marker, new):
    p = W + f
    s = open(p, encoding="utf-8").read()
    a = s.index(start_marker); b = s.index(end_marker, a)
    s = s[:a] + new + s[b:]
    open(p, "w", encoding="utf-8").write(s)

# ---------------- data.js ----------------
rep("data.js", "(v0.6.3)", "(v0.6.4)")
rep("data.js", 'Si vences, le causa dos heridas." }\n  ];',
'''Si vences, le causa dos heridas." },
    { id: "apunalar", name: "Apuñalar", tag: "AGRESIÓN", attr: "cuerpo", target: true, diff: 5, risk: true, hostile: true, desc: "Un golpe directo: 1 herida (2 si es crítico, y además sangrado). Si fallas, la oscuridad te ensucia (+2 corrupción)." },
    { id: "envenenar", name: "Envenenar", tag: "VENENO", attr: "sombra", target: true, diff: 4, risk: true, hostile: true, desc: "Un veneno lento: la víctima gana +3 corrupción al inicio de cada una de las dos rondas siguientes." },
    { id: "maldecir", name: "Maldecir", tag: "MALDICIÓN", attr: "sombra", target: true, diff: 5, risk: true, hostile: true, desc: "Una maldición: -1 a todas las tiradas de la víctima durante dos rondas. Si fallas, +2 corrupción." },
    { id: "aturdir", name: "Aturdir", tag: "GOLPE SECO", attr: "cuerpo", target: true, diff: 6, risk: true, hostile: true, desc: "Dejas a la víctima aturdida: perderá su próximo turno." },
    { id: "devorar", name: "Devorar", tag: "CANIBALISMO", attr: "cuerpo", target: true, diff: 4, risk: true, hostile: true, canTarget: function (t) { return t.wounds >= 2 || (t.status || []).some(function (s) { return s.id === "aturdido"; }); }, desc: "Solo contra quien tenga 2 heridas o esté aturdido. Si tienes éxito, eliminas a la víctima, heredas sus objetos, recuperas una herida, +6 corrupción, -6 virtud y +1 a un atributo al azar. Si fallas, pierdes una herida." },
    { id: "descansar", name: "Descansar", tag: "RECUPERACIÓN", target: false, diff: 0, risk: false, desc: "Vendas la herida: -1 herida y se van el sangrado y el veneno." },
    { id: "entrenar", name: "Entrenar", tag: "FORTALECIMIENTO", target: false, diff: 0, risk: false, desc: "Te fortaleces durante dos rondas: +1 a todas tus tiradas." }
  ];''')
rep("data.js", "  const D = { ROLES,",
'''  /* Estados: se aplican con acciones y se resuelven al inicio de cada ronda. */
  const STATUS = {
    sangrado: { name: "Sangrado", desc: "+1 herida al inicio de cada ronda (dos rondas). Se corta con Descansar." },
    veneno: { name: "Veneno", desc: "+3 corrupción al inicio de cada ronda (dos rondas). Se corta con Descansar." },
    aturdido: { name: "Aturdido", desc: "Pierde su próximo turno." },
    maldito: { name: "Maldito", desc: "-1 a todas las tiradas (dos rondas)." },
    fortalecido: { name: "Fortalecido", desc: "+1 a todas las tiradas (dos rondas)." }
  };

  const D = { STATUS, ROLES,''')

# ---------------- engine.js ----------------
rep("engine.js", "    p.wounds = clamp((p.wounds || 0) + amount, 0, 3);\n    if (p.wounds >= 3) p.dead = true;\n  }",
'''    p.wounds = clamp((p.wounds || 0) + amount, 0, 3);
    if (p.wounds >= 3) { p.dead = true; killed(p, "heridas"); }
  }
  function killed(p, cause) {
    if (state) state.chronicle.push({ round: state.round, text: "✖ " + p.name + " ha caído (" + cause + ")." });
  }''')

rep("engine.js", "  function mkItem(id) {",
'''  function hasStatus(p, id) { return !!(p && p.status && p.status.some(function (s) { return s.id === id; })); }
  function giveStatus(p, id, dur) {
    if (!p || p.dead) return;
    p.status = p.status || [];
    const s = p.status.find(function (x) { return x.id === id; });
    if (s) s.left = Math.max(s.left, dur); else p.status.push({ id: id, left: dur });
  }
  function dropStatus(p, id) { p.status = (p.status || []).filter(function (s) { return s.id !== id; }); }
  function statusMod(p) {
    if (!p) return 0;
    return (hasStatus(p, "fortalecido") ? 1 : 0) - (hasStatus(p, "maldito") ? 1 : 0);
  }
  /* Se llama al inicio de cada ronda: aplica el efecto y gasta una ronda de duración. */
  function tickStatus(p) {
    p.status = p.status || [];
    p.status.forEach(function (s) {
      if (p.dead) return;
      if (s.id === "sangrado") { addWounds(p, 1); p.notes.push("Ronda " + state.round + ": la herida sigue sangrando (+1 herida)."); }
      if (s.id === "veneno") { p.corr = clamp(p.corr + 3, 0, 100); p.notes.push("Ronda " + state.round + ": el veneno te debilita (+3 corrupción)."); }
      s.left -= 1;
    });
    p.status = p.status.filter(function (s) { return s.left > 0 && !p.dead; });
    if (p.dead) p.status = [];
  }
  function mkItem(id) {''')

rep("engine.js", "      stolen: [], betrayals: 0, keptPacts: 0, successfulAccusations: 0\n    };",
    "      stolen: [], betrayals: 0, keptPacts: 0, successfulAccusations: 0, status: []\n    };")

slice_replace("engine.js", "  function startRound() {", "  /* ---------- tiradas ---------- */",
'''  function startRound() {
    state.phase = "private";
    const nP = state.players.length;
    if (state.firstIdx === undefined) state.firstIdx = rnd(nP);
    state.order = [];
    for (let i = 0; i < nP; i++) state.order.push((state.firstIdx + state.round - 1 + i) % nP);
    state.handoff = false;
    state.pendingPush = null;
    state.council = null;
    state.players.forEach(function (p) {
      p.acted = !!p.dead || hasStatus(p, "aturdido");
      p.usedItem = false; p.protection = null;
      p.roundDefense = 0; p.roundAttack = 0;
      p.action = null; p.actionTarget = null;
    });
    state.players.forEach(function (p) { if (!p.dead) tickStatus(p); });
    state.event = eventForRound(state.round);
    applyEvent(state.event);
    state.chronicle.push({
      round: state.round,
      text: "☾ " + state.event.text + (state.event.effectText ? " " + state.event.effectText : "")
    });
    if (checkTerminal()) return;
    state.players.forEach(function (p) { if (p.dead) p.acted = true; });
    const first = state.order.find(function (id) { return !state.players[id].dead && !state.players[id].acted; });
    if (first === undefined) { beginCouncil(); return; }
    state.turn = first;
    save();
  }

''')

rep("engine.js", "    const stat = attr ? p.stats[attr] : 0;\n    const focus = p.focus > 0 ? p.focus : 0;\n    if (focus) p.focus = 0;\n    const total = die + stat + focus;",
    "    const stat = (attr ? p.stats[attr] : 0) + statusMod(p);\n    const focus = p.focus > 0 ? p.focus : 0;\n    if (focus) p.focus = 0;\n    const total = die + stat + focus;")

rep("engine.js", '      if (!t || t.id === p.id || t.dead) return err("Debes elegir a otro jugador que siga en la partida.");',
'''      if (!t || t.id === p.id || t.dead) return err("Debes elegir a otro jugador que siga en la partida.");
      if (a.canTarget && !a.canTarget(t)) return err("Ese jugador no puede ser devorado todavía.");''')

rep("engine.js", '    if (a.id === "robar" && t && t.protection !== null) diff += 1;',
    '    if (a.hostile && a.id !== "cazar" && t && t.protection !== null) diff += 1;')

rep("engine.js", '''      default:
        return { text: "No ocurre nada.", log: null };''',
'''      case "apunalar": {
        if (r.success) {
          const dmg = r.crit ? 2 : 1;
          addWounds(t, dmg);
          if (r.crit) giveStatus(t, "sangrado", 2);
          t.notes.push("Ronda " + state.round + ": alguien te hirió con un arma blanca (" + dmg + " herida" + (dmg > 1 ? "s" : "") + ").");
          return { text: "Hieres a " + t.name + " (" + dmg + " herida" + (dmg > 1 ? "s" : "") + ")." + (r.crit ? " La herida sangra." : "") + (t.dead ? " Cae." : ""), log: null };
        }
        p.corr = clamp(p.corr + 2, 0, 100);
        t.notes.push("Ronda " + state.round + ": pasos apresurados en la oscuridad, pero nadie te alcanzó.");
        return { text: "Tu golpe no alcanza a " + t.name + " (+2 corrupción).", log: null };
      }
      case "envenenar": {
        if (r.success) {
          giveStatus(t, "veneno", 2);
          t.notes.push("Ronda " + state.round + ": un sabor amargo y una debilidad creciente.");
          return { text: "Envenenas a " + t.name + ". El veneno le durará dos rondas.", log: null };
        }
        return { text: "El veneno se derrama antes de llegar a " + t.name + ".", log: null };
      }
      case "maldecir": {
        if (r.success) {
          giveStatus(t, "maldito", 2);
          t.notes.push("Ronda " + state.round + ": una maldición pesa sobre tus manos y tu mente.");
          return { text: "Maldices a " + t.name + ". Sufrirá -1 en sus tiradas durante dos rondas.", log: null };
        }
        p.corr = clamp(p.corr + 2, 0, 100);
        return { text: "La maldición se rompe en tus labios (+2 corrupción).", log: null };
      }
      case "aturdir": {
        if (r.success) {
          giveStatus(t, "aturdido", 1);
          t.notes.push("Ronda " + state.round + ": un golpe seco te deja aturdido.");
          return { text: t.name + " queda aturdido: perderá su próximo turno.", log: null };
        }
        return { text: t.name + " esquiva el golpe.", log: null };
      }
      case "devorar": {
        if (r.success) {
          const loot = t.items.slice();
          p.items = p.items.concat(loot);
          t.items = [];
          t.wounds = 3; t.dead = true; t.status = [];
          p.wounds = Math.max(0, p.wounds - 1);
          p.corr = clamp(p.corr + 6, 0, 100);
          p.virtue = clamp(p.virtue - 6, 0, 100);
          const st = ["cuerpo", "mente", "sombra"][rnd(3)];
          p.stats[st] += 1;
          state.chronicle.push({ round: state.round, text: "✖ " + t.name + " ha sido devorado." });
          return { text: "Devoras a " + t.name + ": heredas " + (loot.length ? loot.length + " objeto(s)" : "nada") + ", recuperas una herida, +6 corrupción, -6 virtud y +1 " + st + ".", log: null };
        }
        addWounds(p, 1);
        p.corr = clamp(p.corr + 4, 0, 100);
        return { text: "La carne de " + t.name + " te repugna. Pierdes una herida y +4 corrupción.", log: null };
      }
      case "descansar": {
        p.wounds = Math.max(0, p.wounds - 1);
        dropStatus(p, "sangrado"); dropStatus(p, "veneno");
        return { text: "Vendas la herida y te recuperas: -1 herida, y se van el sangrado y el veneno.", log: null };
      }
      case "entrenar": {
        giveStatus(p, "fortalecido", 2);
        return { text: "Entrenas con rabia contenida. Fortalecido durante dos rondas (+1 a tus tiradas).", log: null };
      }
      default:
        return { text: "No ocurre nada.", log: null };''')

rep("engine.js", "    while (next < ord.length && state.players[ord[next]].dead) next++;",
    "    while (next < ord.length && (state.players[ord[next]].dead || state.players[ord[next]].acted)) next++;")

rep("engine.js", "state.players.forEach(function (p) { if (typeof p.dead !== \"boolean\") p.dead = false; if (!Array.isArray(p.notes)) p.notes = []; });",
    "state.players.forEach(function (p) { if (typeof p.dead !== \"boolean\") p.dead = false; if (!Array.isArray(p.notes)) p.notes = []; if (!Array.isArray(p.status)) p.status = []; });")

rep("engine.js", "    pSuccess: pSuccess,", "    pSuccess: pSuccess, statusMod: statusMod, hasStatus: hasStatus,")

# ---------------- ui.js ----------------
rep("ui.js", 'const bonus = a.attr ? p.stats[a.attr] + p.focus : 0;',
    'const bonus = a.attr ? p.stats[a.attr] + p.focus + U.statusMod(p) : 0;', count=2)
rep("ui.js", '''      $("actionHint").textContent = "Elige a quién afecta «" + pendingAction.name + "».";''' if False else
    '''    U.getState().players.filter(function (x) { return x.id !== p.id && !x.dead; }).forEach(function (t) {
      const btn = document.createElement("button");
      btn.className = "choice";''',
'''    U.getState().players.filter(function (x) { return x.id !== p.id && !x.dead && (!pendingAction.canTarget || pendingAction.canTarget(x)); }).forEach(function (t) {
      const btn = document.createElement("button");
      btn.className = "choice";''')
rep("ui.js", '''    $("actionHint").textContent = "Elige a quién afecta «" + pendingAction.name + "».";''',
'''    $("actionHint").textContent = "Elige a quién afecta «" + pendingAction.name + "»." + (pendingAction.canTarget && !U.getState().players.some(function (x) { return x.id !== p.id && !x.dead && pendingAction.canTarget(x); }) ? " Ahora mismo nadie puede ser devorado." : "");''')
rep("ui.js", '''(p.wounds ? "Heridas visibles: " + p.wounds : "Sin heridas visibles") + '</div></div>';''',
'''(p.wounds ? "Heridas visibles: " + p.wounds : "Sin heridas visibles") + statusText(p) + '</div></div>';''')
rep("ui.js", "      '<h3>Objetos</h3>' + items +",
'''      '<h3>Estados</h3><p class="small">' + ((p.status || []).length ? p.status.map(function (s) { return D.STATUS[s.id].name + " (" + s.left + " ronda" + (s.left > 1 ? "s" : "") + "): " + D.STATUS[s.id].desc; }).join("<br>") : "Ninguno.") + '</p>' +
      '<h3>Objetos</h3>' + items +''')
rep("ui.js", "filter(function (id) { return !s.players[id].dead; })",
    "filter(function (id) { return !s.players[id].dead && !s.players[id].acted; })", count=2)
rep("ui.js", "  function renderActions(p) {",
'''  function statusText(p) {
    const list = (p.status || []).map(function (s) { return D.STATUS[s.id] ? D.STATUS[s.id].name + " (" + s.left + ")" : s.id; });
    return list.length ? " · Estados: " + list.join(", ") : "";
  }

  function renderActions(p) {''')

# ---------------- versión ----------------
rep("index.html", "v0.6.3", "v0.6.4")
rep("sw.js", 'umbral-v6-3', 'umbral-v6-4')
print("OK")
