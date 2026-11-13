import sys
W = "/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/"
def rep(f, old, new, count=1):
    p = W + f
    s = open(p, encoding="utf-8").read()
    n = s.count(old)
    if n != count: sys.exit("FAIL %s count=%d :: %r" % (f, n, old[:90]))
    open(p, "w", encoding="utf-8").write(s.replace(old, new))

# ---------- engine.js ----------
rep("engine.js", "  function mkItem(id) {",
'''  /* ---------- tratos del Umbral: ofertas individuales y privadas ---------- */
  const OFFERS = {
    cura: { base: 6, text: "El Umbral cierra tus heridas: -1 herida y se van el sangrado y el veneno." },
    foco: { base: 5, text: "El Umbral te presta claridad: +2 foco para tus próximas tiradas." },
    pista: { base: 6, text: "El Umbral te susurra un secreto sobre otro jugador: una pista fuerte." },
    objeto: { base: 8, text: "El Umbral te entrega un objeto oscuro." },
    poder: { base: 10, text: "El Umbral te concede +1 a tu atributo más débil, a costa de 3 virtud." }
  };
  function makeOffer(p) {
    const pool = [];
    if (p.wounds > 0 || hasStatus(p, "sangrado") || hasStatus(p, "veneno")) pool.push(["cura", 3]);
    pool.push(["foco", 2]);
    if (others(p).length) pool.push(["pista", 2]);
    pool.push(["objeto", 1]);
    if (["cuerpo", "mente", "sombra"].some(function (k) { return p.stats[k] < MAX_STAT; })) pool.push(["poder", 1]);
    let roll = rnd(pool.reduce(function (s, x) { return s + x[1]; }, 0));
    let id = pool[0][0];
    for (let i = 0; i < pool.length; i++) { if (roll < pool[i][1]) { id = pool[i][0]; break; } roll -= pool[i][1]; }
    const pressure = p.pressure || 0;
    return { id: id, cost: Math.max(2, OFFERS[id].base - 2 * pressure), text: OFFERS[id].text, done: false };
  }
  function getOffer(playerId) {
    const p = state && state.players[playerId];
    if (!p || p.dead || p.acted || state.phase !== "private") return null;
    if (!p.offer) { p.offer = makeOffer(p); save(); }
    return p.offer;
  }
  function resolveOffer(p, accept) {
    const o = p.offer;
    if (!o || o.done) return err("No hay ningún trato pendiente.");
    o.done = true;
    if (accept) {
      p.corr = clamp(p.corr + o.cost, 0, 100);
      p.pressure = 0;
      let eff = "";
      if (o.id === "cura") { p.wounds = Math.max(0, p.wounds - 1); dropStatus(p, "sangrado"); dropStatus(p, "veneno"); eff = "Tus heridas se cierran."; }
      else if (o.id === "foco") { p.focus = Math.min(3, p.focus + 2); eff = "Ganas 2 de foco."; }
      else if (o.id === "pista") {
        const t = pick(others(p));
        const c = t ? makeClue(t, 2) : null;
        if (c) { p.clues.push(c); eff = "Recibes una pista fuerte sobre " + t.name + "."; } else eff = "El secreto se pierde en el aire.";
      }
      else if (o.id === "objeto") { const it = pick(D.DARK_ITEMS); p.items.push(mkItem(it)); eff = "Recibes " + itemName(it) + "."; }
      else if (o.id === "poder") {
        const open = ["cuerpo", "mente", "sombra"].filter(function (k) { return p.stats[k] < MAX_STAT; }).sort(function (a, b) { return p.stats[a] - p.stats[b]; });
        if (open.length) { p.stats[open[0]] += 1; eff = "Tu " + open[0] + " aumenta (+1)."; }
        p.virtue = clamp(p.virtue - 3, 0, 100);
      }
      p.deeds = p.deeds || [];
      p.deeds.push({ round: state.round, kind: "trato", target: null, ok: true });
      p.notes.push("Ronda " + state.round + ": aceptaste un trato del Umbral (+" + o.cost + " corrupción).");
      save();
      return { ok: true, accepted: true, msg: "Trato cerrado: +" + o.cost + " corrupción. " + eff };
    }
    const extra = (p.pressure || 0) >= 2 ? 3 : 0;
    p.pressure = Math.min(3, (p.pressure || 0) + 1);
    p.virtue = clamp(p.virtue + 2, 0, 100);
    if (extra) p.corr = clamp(p.corr + extra, 0, 100);
    p.notes.push("Ronda " + state.round + ": rechazaste un trato del Umbral." + (extra ? " Se impacienta (+" + extra + " corrupción)." : ""));
    save();
    return { ok: true, accepted: false, msg: "Rechazas el trato (+2 virtud)." + (extra ? " El Umbral se impacienta: +" + extra + " corrupción." : "") };
  }
  function answerOffer(playerId, accept) {
    if (!state || state.phase !== "private" || state.handoff || state.turn !== playerId) return err("Ahora no puedes responder al trato.");
    const p = state.players[playerId];
    if (!p || p.dead || p.acted) return err("Este jugador ya no puede responder.");
    return resolveOffer(p, !!accept);
  }
  function mkItem(id) {''')
rep("engine.js", "    state.players.forEach(function (p) { if (!p.dead) tickStatus(p); });",
    "    state.players.forEach(function (p) { if (!p.dead) tickStatus(p); });\n    state.players.forEach(function (p) { p.offer = null; });")
rep("engine.js", "    const r = a.risk ? rollCheck(p, a.attr, diff) :", "    if (p.offer && !p.offer.done) resolveOffer(p, false);\n    const r = a.risk ? rollCheck(p, a.attr, diff) :")
rep("engine.js", '''    if (livingPlayers.length && livingPlayers.every(function (p) { return p.corr < 25; })) {
      livingPlayers.forEach(function (p) { p.corr = clamp(p.corr + 2, 0, 100); });
      push("☾ La entidad redobla sus ofertas: nadie ha cedido, y eso la intriga (+2 corrupción a todos).");
    }
''', "")
rep("engine.js", '''      case "ceder": return { text: pre + "la voz de " + n''', '''      case "trato": return { text: pre + "el aire se enrareció alrededor de " + n + ", como si alguien hubiera cerrado un trato en voz baja.", bonus: 1 };
      case "ceder": return { text: pre + "la voz de " + n''')
rep("engine.js", "    pSuccess: pSuccess, statusMod: statusMod, hasStatus: hasStatus,", "    pSuccess: pSuccess, statusMod: statusMod, hasStatus: hasStatus, getOffer: getOffer, answerOffer: answerOffer,")

# ---------- index.html ----------
rep("index.html", '      <p id="privateTemptation" class="notice small"></p>', '      <p id="privateTemptation" class="notice small"></p>\n      <div id="privateOffer" class="notice hidden"></div>')
rep("index.html", "<li>Tres heridas eliminan a un jugador.", "<li>Cada turno el Umbral te ofrece un trato privado: aceptar cuesta corrupción; rechazar da +2 virtud, pero su insistencia crece y, del tercer rechazo seguido, cada rechazo cuesta +3 corrupción.</li>\n        <li>Tres heridas eliminan a un jugador.")

# ---------- ui.js ----------
rep("ui.js", "    $(\"privateStats\").innerHTML = statsHTML(p);\n    renderSheet(p);", "    renderOffer(p);\n    $(\"privateStats\").innerHTML = statsHTML(p);\n    renderSheet(p);")
rep("ui.js", "  function startGearNote(p) {",
'''  function renderOffer(p) {
    const box = $("privateOffer");
    const o = p.dead ? null : U.getOffer(p.id);
    if (!o || o.done) { box.classList.add("hidden"); box.innerHTML = ""; return; }
    const pressure = p.pressure || 0;
    const refuse = pressure >= 2 ? "Rechazar: +2 virtud, pero el Umbral se impacienta (+3 corrupción)." : "Rechazar: +2 virtud.";
    box.classList.remove("hidden");
    box.innerHTML = '<div class="tag">TRATO DEL UMBRAL</div><p class="small">' + esc(o.text) + '</p>' +
      '<p class="small">Aceptar: +' + o.cost + ' corrupción' + (pressure ? ' (rebajado por su insistencia)' : '') + '. ' + refuse +
      ' Si eliges una acción sin responder, cuenta como rechazo.</p>' +
      '<div class="row"><button class="primary smallbtn" id="offerYes">Aceptar</button><button class="ghost smallbtn" id="offerNo">Rechazar</button></div>';
    $("offerYes").onclick = function () { const r = U.answerOffer(p.id, true); toast(r.msg, !r.ok); renderPrivate(); };
    $("offerNo").onclick = function () { const r = U.answerOffer(p.id, false); toast(r.msg, !r.ok); renderPrivate(); };
  }

  function startGearNote(p) {''')

for f, a, b in [("engine.js","0.6.8","0.6.9"),("ui.js","0.6.8","0.6.9"),("data.js","0.6.8","0.6.9"),("index.html","v0.6.8","v0.6.9"),("sw.js","umbral-v6-8","umbral-v6-9")]:
    rep(f, a, b)
print("OK")
