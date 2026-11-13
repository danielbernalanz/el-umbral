import sys
p='engine.js'
s=open(p,encoding='utf-8').read()
def rep(old,new,cnt=1):
    global s
    assert s.count(old)==cnt, (s.count(old), old[:90])
    s=s.replace(old,new)

# E1 HOSTILE
rep('"maldecir", "aturdir", "devorar"];','"maldecir", "aturdir", "devorar", "sombra_hostiga"];')

# E13/E15 damage fast + stabilize
rep('''      p.hp = 0; p.dying = true; p.dyingRound = r; p.status = []; p.acted = true; out.dying = true;
      if (state) state.chronicle.push({ round: r, text: "✖ " + p.name + " se desploma, moribundo." });
      p.notes.push("Ronda " + r + ": te desplomas, moribundo. Si nadie te socorre antes de que acabe la próxima ronda, morirás; cualquier golpe más te mataría.");''',
'''      p.hp = 0; p.dying = true; p.dyingRound = r; p.status = []; p.acted = true; out.dying = true;
      p.dyingFast = !!opts.fast; p.socBy = {};
      if (state) state.chronicle.push({ round: r, text: "✖ " + p.name + " se desploma, moribundo." + (opts.fast ? " Quien lo dejó así no le ha dado tiempo: si nadie lo socorre antes de que acabe esta ronda, morirá." : "") });
      p.notes.push("Ronda " + r + ": te desplomas, moribundo. " + (opts.fast ? "El golpe fue de los que no perdonan: si nadie te socorre antes de que acabe ESTA ronda, morirás; cualquier golpe más te mataría." : "Si nadie te socorre antes de que acabe la próxima ronda, morirás; cualquier golpe más te mataría."));''')
rep('''    p.dying = false; p.dyingRound = null;
    p.hp = Math.max(p.hp, 2);''','''    p.dying = false; p.dyingRound = null; p.dyingFast = false;
    p.hp = Math.max(p.hp, 2);''')

# E2 unlock rules
rep('''    socorrer: "Alguien se desangra en el suelo: puedes intentar socorrerlo."
  };''','''    socorrer: "Alguien se desangra en el suelo: puedes intentar socorrerlo.",
    sombra_espia: "Acción nueva: Sombras espías. Tu sombra se alarga sola por el suelo; quizá puedas mandarla a cotillear.",
    sombra_guarda: "Acción nueva: Sombras guardianas. Tus sombras ya te escuchan y pueden hacerte de escolta.",
    sombra_hostiga: "Acción nueva: Sombras hostigadoras. Tus sombras aprenden a acosar a quien tú señales.",
    alzar: "Acción nueva: Alzar a un caído. Los muertos de estas ruinas escuchan, y tu sombra sabe cómo ponerlos a trabajar."
  };''')
rep('''    socorrer: function (p) { return !!state && !p.dying && state.players.some(function (x) { return x.id !== p.id && x.dying && !x.dead; }); }
  };''','''    socorrer: function (p) { return !!state && !p.dying && state.players.some(function (x) { return x.id !== p.id && x.dying && !x.dead; }); },
    sombra_espia: function (p, late) { return isAssassin(p) || late || (state.round >= 2 && (p.stats.sombra >= 3 || p.corr >= 12)); },
    sombra_guarda: function (p, late) { return domLevel(p) >= 1 && (late || state.round >= 3 || assassinAge(p) >= 1); },
    sombra_hostiga: function (p, late) { return domLevel(p) >= 1 && (late || (isAssassin(p) ? assassinAge(p) >= 2 : p.corr >= 25 && state.round >= 3)); },
    alzar: function (p, late) {
      if (!(isAssassin(p) ? (late || assassinAge(p) >= 2) : (domLevel(p) >= 2 && p.corr >= 40))) return false;
      return state.players.some(function (x) { return x.id !== p.id && ((x.dead && !x.risenBy && x.cause !== "devorado") || (x.dying && !x.dead && isAssassin(p))); });
    }
  };
  /* ---------- Dominio de las sombras (progresión por éxitos, como la maestría de magia: 1 / 2 / 4) ---------- */
  const DOM_NAMES = ["Sombra mansa", "Susurrador", "Domador de sombras", "Señor de las sombras"];
  const DOM_NEXT = [
    "Un éxito con las sombras: Susurrador (−1 dificultad en todas las acciones de sombras y abre las guardianas y las hostigadoras).",
    "Otro éxito: Domador (espías más finas, guardianas con +1, hostigadoras de dos rondas, y las guardianas te dicen quién te agrede).",
    "Dos éxitos más: Señor de las sombras (espías y guardianas sin coste de oscuridad, +1 de defensa y hasta dos sombras alzadas).",
    "Dominio máximo."
  ];
  function domLevel(p) { const w = (p && p.dom && p.dom.wins) || 0; return w >= 4 ? 3 : w >= 2 ? 2 : w >= 1 ? 1 : 0; }
  function assassinAge(p) { return isAssassin(p) && p.asesinoRound ? state.round - p.asesinoRound : -1; }
  function riseMax(p) { return domLevel(p) >= 3 ? 2 : 1; }
  function riseCount(p) { return (p.risen || []).filter(function (id) { return state.players[id] && state.players[id].risenBy === p.id; }).length; }
  /* Suma éxitos de dominio; devuelve el texto de subida de nivel (o ""). */
  function domWin(p, n) {
    p.dom = p.dom || { wins: 0 };
    const before = domLevel(p);
    p.dom.wins = (p.dom.wins || 0) + n;
    const after = domLevel(p);
    if (after > before) {
      p.notes.push("Ronda " + state.round + ": tu dominio de las sombras sube: " + DOM_NAMES[after] + ".");
      return " Tu dominio de las sombras sube: " + DOM_NAMES[after] + ". " + (after === 1 ? "Ahora cuestan una dificultad menos." : after === 2 ? "Tus sombras ya saben delatar a quien te agrede." : "Ya no te cuestan oscuridad las espías ni las guardianas.");
    }
    return "";
  }
  function domInfo(p) { const l = domLevel(p); return { level: l, name: DOM_NAMES[l], next: DOM_NEXT[l], wins: (p.dom && p.dom.wins) || 0 }; }
  /* ---------- Agresividad: lo que hace un jugador alimenta la tentación del Umbral ---------- */
  const AGGR_ACT = { apunalar: [2, "stab"], robar: [2, "steal"], envenenar: [2, "dirty"], maldecir: [2, "dirty"], aturdir: [2, "dirty"], hechizar: [2, "dirty"], sombra_hostiga: [1, "dirty"], devorar: [3, "bite"] };
  function noteAggr(p, kind, w) {
    if (!p || !state || isAssassin(p)) return;
    p.aggr = (p.aggr || 0) + w; p.aggrRound = state.round; p.agg = p.agg || {}; p.agg[kind] = (p.agg[kind] || 0) + 1;
  }
  const AGG_LABEL = { stab: "apuñalar", ambush: "emboscar", steal: "robar", dirty: "agredir con artes sucias", npc: "atacar a figuras de las ruinas", spell: "lanzar conjuros ofensivos", left: "dejar morir a un caído", bite: "intentar devorar", dark: "acumular oscuridad" };
  function aggrSummary(p) {
    const a = p.agg || {};
    return Object.keys(AGG_LABEL).filter(function (k) { return a[k]; }).map(function (k) { return AGG_LABEL[k] + " ×" + a[k]; }).join(", ");
  }''')
open(p,'w',encoding='utf-8').write(s)
print("ok")
