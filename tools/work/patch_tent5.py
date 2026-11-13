p='engine.js'
s=open(p,encoding='utf-8').read()
def rep(old,new,cnt=1):
    global s
    assert s.count(old)==cnt, (s.count(old), old[:90])
    s=s.replace(old,new)

rep('''  function makeOffer(p) {
    /* Selectivo: solo aparece en momentos clave, con pausa entre tratos. */''','''  /* ---------- Tentación dirigida: el Umbral ofrece convertirse en Asesino a quien se ha ganado el puesto ---------- */
  const TEMPT_T = 5;
  function temptationOffer(p) {
    if (isAssassin(p) || p.dead || p.dying || assassinsOf().length) return null;
    if (state.round < 2 || state.round >= maxRounds()) return null;
    const ag = p.aggr || 0;
    if (ag < TEMPT_T || (p.tempOffers || 0) >= 3) return null;
    if (p.lastTemp && state.round - p.lastTemp < 2) return null;
    if (Math.random() >= clamp(0.45 + 0.07 * (ag - TEMPT_T), 0.45, 0.85)) return null;
    p.tempOffers = (p.tempOffers || 0) + 1; p.lastTemp = state.round;
    const non = state.players.length - 1, goal = assassinGoal(non);
    const gains = [
      "+1 Cuerpo y +1 Sombra (hasta el máximo de 6), y recuperas 4 de vitalidad.",
      "Cazar: un ataque nocturno que hiere 6-8 (+2 si es crítico) y te cura 2; remata sin tirada a quien ya está moribundo, y a quien dejas moribundo solo le queda lo que reste de la ronda para ser socorrido.",
      "Máscara: las pistas que consigan sobre ti son una fuerza más débiles mientras no te desenmascaren.",
      "Dominio de las sombras nivel 1 (Susurrador): Sombras espías ya, guardianas y hostigadoras en las próximas rondas, y Alzar a un caído (nigromancia) después.",
      "Vences si, al amanecer, sigues en pie y han caído o están moribundos al menos " + goal + " de los " + non + " demás (o si eliminas a todos)."
    ];
    const losses = [
      "Tu identidad: dejas de ser superviviente y tu objetivo secreto ya no cuenta. Ganas o pierdes con el Asesino.",
      "Los supervivientes vencen si te derrotan: te acusarán, te emboscarán y, si te desenmascaran con pruebas, no podrás cazar esa noche.",
      "−10 de virtud y +10 de oscuridad ahora mismo, y no hay vuelta atrás: ya no podrás redimirte.",
      "Si no quieres, rechaza: ganas +2 de virtud y el Umbral esperará un par de rondas antes de insistir."
    ];
    const resume = aggrSummary(p);
    return {
      id: "asesino", cost: 0, refuse: 0, done: false, title: "LA TENTACIÓN DEL UMBRAL", gains: gains, losses: losses,
      text: "El Umbral te ha visto trabajar" + (resume ? " (" + resume + ")" : "") + " y te ofrece más poder: convertirte en el Asesino. No hay letra pequeña: esto es lo que ganas y lo que pierdes."
    };
  }
  function makeOffer(p) {
    { const tp = temptationOffer(p); if (tp) return tp; }
    /* Selectivo: solo aparece en momentos clave, con pausa entre tratos. */''')

rep('''    if (p.offer === null || p.offer === undefined) { p.offer = makeOffer(p) || false; if (p.offer) p.lastOffer = state.round; save(); }''','''    if (p.offer === null || p.offer === undefined) { p.offer = makeOffer(p) || false; if (p.offer) { p.lastOffer = state.round; glog("oferta", { a: p.id, o: p.offer.id, x: p.offer.text.slice(0, 150) }); } save(); }''')

rep('''    o.done = true;
    if (accept) {
      p.corr = clamp(p.corr + o.cost, 0, 100);''','''    o.done = true;
    if (accept && o.id === "asesino") {
      if (assassinsOf().length || isAssassin(p)) return err("El Umbral ya tiene un Asesino.");
      becomeAssassin(p, "tentacion");
      ["cuerpo", "sombra"].forEach(function (k) { if (p.stats[k] < MAX_STAT) p.stats[k] += 1; });
      const h = heal(p, 4);
      p.corr = clamp(p.corr + 10, 0, 100); p.virtue = clamp(p.virtue - 10, 0, 100);
      p.dealt = (p.dealt || 0) + 1; p.lastDeal = state.round;
      p.deeds = p.deeds || [];
      p.deeds.push({ round: state.round, kind: "trato", target: null, ok: true });
      p.notes.push("Ronda " + state.round + ": aceptaste la tentación del Umbral y te convertiste en el Asesino (+1 Cuerpo, +1 Sombra" + (h > 0 ? ", +" + h + " de vitalidad" : "") + "; −10 de virtud, +10 de oscuridad).");
      save();
      return { ok: true, accepted: true, msg: "Eres el Asesino. +1 Cuerpo, +1 Sombra" + (h > 0 ? ", +" + h + " de vitalidad" : "") + ", −10 de virtud y +10 de oscuridad. Tu objetivo ahora es cobrar el tributo de la noche sin que te desenmascaren." };
    }
    if (accept) {
      p.corr = clamp(p.corr + o.cost, 0, 100);''')
rep('''    p.pressure = Math.min(3, (p.pressure || 0) + 1); p.refused = (p.refused || 0) + 1;''','''    if (o.id === "asesino") p.aggr = Math.max(0, (p.aggr || 0) - 3);
    p.pressure = Math.min(3, (p.pressure || 0) + 1); p.refused = (p.refused || 0) + 1;''')
rep('''    p.notes.push("Ronda " + state.round + ": rechazaste un trato del Umbral." + (extra''','''    p.notes.push("Ronda " + state.round + ": rechazaste " + (o.id === "asesino" ? "la tentación de convertirte en Asesino." : "un trato del Umbral.") + (extra''')
open(p,'w',encoding='utf-8').write(s)
print("ok")
