p='engine.js'
s=open(p,encoding='utf-8').read()
def rep(old,new,cnt=1):
    global s
    assert s.count(old)==cnt, (s.count(old), old[:90])
    s=s.replace(old,new)

# huntDamage
rep('''  function huntDamage() { return maxRounds() <= 4 ? rr(10, 12) : rr(5, 7); }''','''  function huntDamage(crit) { return maxRounds() <= 4 ? rr(10, 12) : rr(6, 8) + (crit ? 2 : 0); }''')

# cazar success
rep('''        if (r.success) {
          const hres = damage(t, huntDamage(), { src: "cazar" });
          t.notes.push("Ronda " + state.round + ": una sombra te atacó durante la noche" + (hres.died ? hitNote(hres) : " y te hirió" + hitNote(hres)) + ".");
          return { text: "La caza alcanza a " + t.name + (hres.died ? ", que ya estaba moribundo: queda eliminada o eliminado." : hres.dying ? ": cae moribundo." : (hres.zone ? " " + ZONE_IN[hres.zone] + ": queda " + visibleHealth(t).split(" · ")[0].toLowerCase() + "." : ".")), log: null };
        }''','''        if (r.success) {
          const hres = damage(t, huntDamage(r.crit), { src: "cazar", fast: true });
          t.notes.push("Ronda " + state.round + ": una sombra te atacó durante la noche" + (hres.died ? hitNote(hres) : " y te hirió" + hitNote(hres)) + ".");
          const fed = heal(p, 2);
          return { text: "La caza alcanza a " + t.name + (hres.died ? (r.rematar ? ", que yacía moribundo: lo rematas sin tirada y queda eliminada o eliminado." : ", que ya estaba moribundo: queda eliminada o eliminado.") : hres.dying ? ": cae moribundo, y solo tendrá lo que reste de esta ronda para que alguien lo socorra." : (hres.zone ? " " + ZONE_IN[hres.zone] + ": queda " + visibleHealth(t).split(" · ")[0].toLowerCase() + "." : ".")) + (fed > 0 ? " Te alimentas de su miedo (+" + fed + " de vitalidad)." : ""), log: null };
        }''')

# ceder: use becomeAssassin
rep('''          state.assassinId = p.id;
          p.alignment = "asesino"; p.asesinoRound = state.round; p.asesinoVia = "ceder";
          transformation''','''          becomeAssassin(p, "ceder");
          transformation''')
rep('''            p.alignment = "asesino"; p.asesinoRound = state.round; p.asesinoVia = "devorar";
            if (state.assassinId === null) state.assassinId = p.id;
            conv = ''','''            becomeAssassin(p, "devorar");
            conv = ''')

# socorrer socBy
rep('''        if (!t.dying) return { text: t.name + " ya no necesita socorro.", log: null };
        if (r.success) {''','''        if (!t.dying) return { text: t.name + " ya no necesita socorro.", log: null };
        t.socBy = t.socBy || {}; t.socBy[p.id] = state.round;
        if (r.success) {''')

# new cases before "entrenar" case
rep('''      case "entrenar": {
        giveStatus(p, "fortalecido", 2);''','''      case "sombra_espia": {
        const lv = domLevel(p), cost = lv >= 3 ? 0 : 2;
        p.corr = clamp(p.corr + cost, 0, 100);
        const costTxt = cost ? " (+" + cost + " de oscuridad)" : "";
        if (r.success) {
          const str = 1 + (lv >= 2 ? 1 : 0) + (r.crit ? 1 : 0) + (hasPassive(p, "extraClue") ? 1 : 0);
          const clue = makeClue(t, str); if (clue) p.clues.push(clue);
          return { text: "Tus sombras reptan tras " + t.name + " y vuelven con un cotilleo de primera (pista de fuerza " + str + ")." + costTxt + domWin(p, 1), log: null };
        }
        return { text: "Tus sombras vuelven con las manos vacías y cara de reproche: lo único que traen es una calceta de " + t.name + ". Sin pista" + costTxt + ".", log: null };
      }
      case "sombra_guarda": {
        const lv = domLevel(p), cost = lv >= 3 ? 0 : 2;
        p.corr = clamp(p.corr + cost, 0, 100);
        const costTxt = cost ? " (+" + cost + " de oscuridad)" : "";
        if (r.success) {
          const def = 3 + (lv >= 2 ? 1 : 0) + (lv >= 3 ? 1 : 0);
          p.roundDefense += def; p.guardRound = state.round; p.guardLv = lv;
          return { text: "Tus sombras se te pegan como un abrigo muy serio: +" + def + " de defensa esta ronda" + (lv >= 2 ? " y sabrás quién te agreda" : "") + "." + costTxt + domWin(p, 1), log: null };
        }
        return { text: "Tus sombras se despistan mirando una polilla. Esta noche vas sin escolta" + costTxt + ".", log: null };
      }
      case "sombra_hostiga": {
        const lv = domLevel(p);
        p.corr = clamp(p.corr + 3, 0, 100);
        p.virtue = clamp(p.virtue - 2, 0, 100);
        if (r.success) {
          giveStatus(t, "maldito", lv >= 2 ? 2 : 1);
          t.corr = clamp(t.corr + 3, 0, 100);
          t.notes.push("Ronda " + state.round + ": sombras inquietas te rodearon toda la noche, susurrando. Amaneces maldito (−1 a tus tiradas) y algo más manchado.");
          state.chronicle.push({ round: state.round, text: "✦ Las sombras se agitaron alrededor de " + t.name + " durante la noche." });
          return { text: "Tus sombras acosan a " + t.name + " con un repertorio de susurros que no le dejan dormir. Queda maldito y se mancha (+3). Tú pagas +3 de oscuridad y −2 de virtud." + domWin(p, 1), log: null };
        }
        return { text: "Tus sombras se enredan entre sí y se ponen a discutir quién acosa a quién. " + t.name + " duerme de un tirón. Pagas +3 de oscuridad y −2 de virtud igualmente.", log: null };
      }
      case "alzar": {
        const sw = damage(p, 2, { src: "interno" });
        const swTxt = " Pagas con tu sangre (−" + sw.dealt + " de vitalidad).";
        if (r.success) {
          const wasDying = !!t.dying;
          if (wasDying) finish(t, "alzado", true);
          t.risenBy = p.id; p.risen = p.risen || []; p.risen.push(t.id);
          p.corr = clamp(p.corr + 8, 0, 100);
          p.virtue = clamp(p.virtue - 6, 0, 100);
          t.notes.push("Ronda " + state.round + ": alguien te ha alzado como sombra servidora. Ya no estás en la partida, pero tu sombra trabaja para otro.");
          state.chronicle.push({ round: state.round, text: wasDying ? "✖ " + t.name + " ha sido rematado y se levanta como sombra. Alguien la manda." : "✦ " + t.name + " se ha levantado como sombra y vaga por las ruinas. Alguien la manda." });
          glog("alzado", { a: p.id, t: t.id, x: t.name + " alzado como sombra" + (wasDying ? " (rematado)" : "") });
          return { text: (wasDying ? "Rematas a " + t.name + " y lo levantas. " : "") + t.name + " abre los ojos, protesta un poco y acepta el trabajo: será tu sombra servidora (te susurrará una pista cada ronda y te dará defensa). +8 de oscuridad y −6 de virtud." + swTxt + domWin(p, 2), log: null };
        }
        p.corr = clamp(p.corr + 4, 0, 100);
        p.virtue = clamp(p.virtue - 3, 0, 100);
        return { text: t.name + " se niega a levantarse, con muy mala educación. El ritual te cuesta +4 de oscuridad y −3 de virtud." + swTxt, log: null };
      }
      case "entrenar": {
        giveStatus(p, "fortalecido", 2);''')

# deedClue cases
rep('''      case "devorar": return { text: pre + "solo quedaron restos''','''      case "sombra_hostiga": return { text: pre + "las sombras se arremolinaron alrededor de " + other + "; la sombra de " + n + " se alargaba hacia él o ella.", bonus: 1 };
      case "sombra_espia": return { text: pre + "una sombra siguió a " + other + " sin dueño aparente; la de " + n + " llegó tarde a casa.", bonus: 0 };
      case "alzar": return { text: pre + "un caído se levantó donde no debía; " + n + " tenía las manos manchadas de ceniza.", bonus: 2 };
      case "devorar": return { text: pre + "solo quedaron restos''')

# becomeAssassin helper before applyAction
rep('''  function applyAction(p, a, t, r, stake) {''','''  /* Transformación en Asesino (por ceder, devorar o aceptar la tentación): dominio de sombras nivel 1. */
  function becomeAssassin(p, via) {
    p.alignment = "asesino"; p.asesinoRound = state.round; p.asesinoVia = via;
    if (state.assassinId === null) state.assassinId = p.id;
    p.dom = p.dom || { wins: 0 }; p.dom.wins = Math.max(p.dom.wins || 0, 1);
    glog("asesino_nace", { a: p.id, x: p.name + " se convierte en Asesino (" + via + ")" });
  }
  function applyAction(p, a, t, r, stake) {''')
open(p,'w',encoding='utf-8').write(s)
print("ok")
