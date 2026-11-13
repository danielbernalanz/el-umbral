import sys
W = "/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/"
def rep(f, old, new, count=1):
    p = W + f
    s = open(p, encoding="utf-8").read()
    n = s.count(old)
    if n != count: sys.exit("FAIL %s count=%d :: %r" % (f, n, old[:90]))
    open(p, "w", encoding="utf-8").write(s.replace(old, new))
e="engine.js"; u="ui.js"; d="data.js"; h="index.html"

# ---------- data ----------
rep(d,'    { id: "entrenar",','''    { id: "tender", name: "Tender la mano", tag: "PROMESA", attr: null, target: true, diff: 0, risk: false, mode: true, desc: "Ofreces ayuda en secreto a otro jugador. Si confía en ti y calla, se abrirá una ventana a su favor. Solo tú sabes cómo es tu mano." },
    { id: "entrenar",''')

# ---------- engine ----------
rep(e,"createdAt: Date.now(), durationMin: minutes, playedMs: 0","createdAt: Date.now(), durationMin: minutes, playedMs: 0, hands: []")
rep(e,"  /* Tramos de corrupción: efectos","""  /* ---------- La mano tendida: ayuda discreta, sincera o trampa ---------- */
  function hands() { return state.hands || (state.hands = []); }
  function handOfferFor(p) {
    if (!state || state.phase !== "private" || p.dead || p.acted) return null;
    return hands().find(function (x) { return x.status === "offered" && x.to === p.id; }) || null;
  }
  function getHandOffer(id) {
    const p = state && state.players[id];
    const x = p ? handOfferFor(p) : null;
    return x ? { from: state.players[x.from].name } : null;
  }
  function resolveHand(p, accept) {
    const x = handOfferFor(p);
    if (!x) return err("No hay ninguna mano tendida.");
    const a = state.players[x.from];
    if (!accept) {
      x.status = "rejected";
      a.notes.push("Ronda " + state.round + ": " + p.name + " rechazó tu mano.");
      save();
      return { ok: true, accepted: false, msg: "Rechazas la mano. Nada cambia." };
    }
    x.status = "active"; x.since = state.round; x.stacks = 0; x.age = 0;
    giveStatus(p, "fortalecido", 2);
    p.focus = Math.min(2, p.focus + 1);
    if (x.mode === "sincera") a.virtue = clamp(a.virtue + 4, 0, 100);
    p.notes.push("Ronda " + state.round + ": aceptaste la mano de " + a.name + " y prometiste callar. Se abre una ventana a tu favor.");
    a.notes.push("Ronda " + state.round + ": " + p.name + " aceptó tu mano y guardará silencio.");
    save();
    return { ok: true, accepted: true, msg: "Aceptas y callas. Una ventana se abre ante ti: +1 foco y fortalecido." };
  }
  function answerHand(pid, accept) {
    if (!state || state.phase !== "private" || state.handoff || state.turn !== pid) return err("Ahora no puedes responder.");
    const p = state.players[pid];
    if (!p || p.dead || p.acted) return err("Este jugador ya no puede responder.");
    return resolveHand(p, !!accept);
  }
  function easeHands(p, n) {
    let eased = false;
    hands().forEach(function (x) {
      if (x.status === "active" && x.mode === "trampa" && x.to === p.id && x.stacks > 0) { x.stacks = Math.max(0, x.stacks - n); eased = true; }
    });
    if (eased) p.notes.push("Ronda " + state.round + ": sientes que un frío antiguo remite, aunque no sabes por qué.");
  }
  function tickHands() {
    hands().forEach(function (x) {
      const a = state.players[x.from], t = state.players[x.to];
      if (x.status === "offered") { if (state.round - x.round >= 2) x.status = "ignored"; return; }
      if (x.status !== "active") return;
      if (a.dead || t.dead) { x.status = "ended"; return; }
      x.age += 1;
      if (x.mode === "trampa") {
        x.stacks += 1;
        if (x.stacks === 1) t.notes.push("Ronda " + state.round + ": un frío extraño te recorre desde la última promesa.");
        else {
          t.notes.push("Ronda " + state.round + ": algo te consume por dentro, sin causa que puedas señalar.");
          addWounds(t, 1);
          state.chronicle.push({ round: state.round, text: t.name + " se debilita sin causa aparente." });
        }
        if (x.age >= 8 || t.dead) x.status = "ended";
      } else if (x.age >= 3) {
        x.status = "done"; a.keptPacts += 1;
        a.notes.push("Ronda " + state.round + ": tu mano a " + t.name + " fue sincera y la promesa se cumplió.");
      }
    });
  }
  /* Tramos de corrupción: efectos""")
rep(e,"    state.players.forEach(tierCheck);","    tickHands();\n    state.players.forEach(tierCheck);")
rep(e,'dropStatus(p, "sangrado"); dropStatus(p, "veneno"); eff = "Tus heridas se cierran.";','dropStatus(p, "sangrado"); dropStatus(p, "veneno"); easeHands(p, 99); eff = "Tus heridas se cierran.";')
rep(e,'''        dropStatus(p, "sangrado"); dropStatus(p, "veneno");
        return { text: "Vendas la herida''','''        dropStatus(p, "sangrado"); dropStatus(p, "veneno"); easeHands(p, 2);
        return { text: "Vendas la herida''')
# act: mode validation
rep(e,'''    let stake = null;
    let diff = a.diff || 0;''','''    let mode = null;
    if (a.mode) {
      mode = stakeId === "trampa" ? "trampa" : stakeId === "sincera" ? "sincera" : null;
      if (!mode) return err("Elige si tu mano es sincera o una trampa.");
      if (mode === "trampa" && !(isAssassin(p) || p.corr >= 12)) return err("Aún no hay oscuridad suficiente en ti para esa trampa.");
      if (hands().some(function (x) { return x.from === p.id && x.to === t.id && (x.status === "offered" || x.status === "active"); })) return err("Ya le has tendido la mano a " + t.name + ".");
    }
    let stake = null;
    let diff = a.diff || 0;''')
rep(e,"    if (p.offer && !p.offer.done) resolveOffer(p, false);\n    const r =","    if (p.offer && !p.offer.done) resolveOffer(p, false);\n    if (handOfferFor(p)) resolveHand(p, false);\n    const r =")
rep(e,"const out = applyAction(p, a, t, r, stake);","const out = applyAction(p, a, t, r, a.mode ? mode : stake);")
rep(e,'''"apunalar", "envenenar", "maldecir", "aturdir", "devorar"].indexOf(a.id) !== -1) {
      p.deeds = p.deeds || [];
      p.deeds.push({ round: state.round, kind: a.id, target: t ? t.id : null, ok: !!r.success });''','''"apunalar", "envenenar", "maldecir", "aturdir", "devorar", "tender"].indexOf(a.id) !== -1) {
      p.deeds = p.deeds || [];
      p.deeds.push({ round: state.round, kind: a.id, target: t ? t.id : null, ok: a.id === "tender" ? mode === "trampa" : !!r.success });''')
rep(e,'      case "entrenar": {','''      case "tender": {
        hands().push({ from: p.id, to: t.id, mode: stake, status: "offered", round: state.round });
        if (stake === "trampa") p.corr = clamp(p.corr + 5, 0, 100);
        return { text: "Tiendes la mano a " + t.name + " en secreto. Solo " + t.name + " lo sabrá. " + (stake === "trampa" ? "Tu sonrisa esconde algo." : "Tu gesto es sincero."), log: null };
      }
      case "entrenar": {''')
rep(e,'      case "devorar": return { text: pre','''      case "tender": return d.ok ? { text: pre + n + " sonreía a " + other + " con una amabilidad que no le cuadraba.", bonus: 1 } : { text: pre + n + " le tendió la mano a " + other + " con un gesto franco.", bonus: -1 };
      case "devorar": return { text: pre''')
# council: romper
rep(e,'''"revelar", "acusacion", "emboscada"];
    if (allowed''','''"revelar", "acusacion", "emboscada", "romper"];
    if (allowed''')
rep(e,'''    if (type === "emboscada" && actor.dead) return err("Un jugador eliminado no puede actuar.");''','''    if (type === "emboscada" && actor.dead) return err("Un jugador eliminado no puede actuar.");
    let brokenHand = null;
    if (type === "romper") {
      brokenHand = hands().find(function (x) { return x.status === "active" && x.from === target.id && x.to === actor.id; });
      if (!brokenHand) return err(actor.name + " no ha recibido ninguna mano de " + target.name + " que pueda romper.");
      if ((used.brk || 0) >= 1) return err(actor.name + " ya ha roto un silencio en este consejo.");
    }''')
rep(e,'''    } else {
      return err("Interacción desconocida.");''','''    } else if (type === "romper") {
      used.brk = (used.brk || 0) + 1;
      brokenHand.status = "broken";
      brokenHand.stacks = 0;
      dropStatus(actor, "fortalecido");
      actor.virtue = clamp(actor.virtue - 4, 0, 100);
      if (brokenHand.mode === "sincera") target.virtue = clamp(target.virtue + 2, 0, 100);
      target.notes.push("Ronda " + state.round + ": " + actor.name + " rompió su silencio ante todos.");
      actor.notes.push("Ronda " + state.round + ": rompiste tu promesa. La ventana se cerró.");
      result.kind = "text";
      result.text = actor.name + " rompe su silencio y afirma que " + target.name + " le tendió la mano. Nadie puede comprobarlo.";
      result.log = actor.name + " rompe su silencio: dice que " + target.name + " le tendió la mano.";
      entry.resolved = true;
    } else {
      return err("Interacción desconocida.");''')
rep(e,"getOffer: getOffer, answerOffer: answerOffer,","getOffer: getOffer, answerOffer: answerOffer, getHandOffer: getHandOffer, answerHand: answerHand,")

# ---------- UI ----------
rep(u,"  let pendingStake = null;","  let pendingStake = null;\n  let pendingMode = null;")
rep(u,"b.onclick = function () { pendingAction = null; pendingStake = null; pendingItem = null; renderPrivate(); };","b.onclick = function () { pendingAction = null; pendingStake = null; pendingItem = null; pendingMode = null; renderPrivate(); };")
rep(u,"    pendingAction = null; pendingStake = null; pendingItem = null;\n    if (a.gamble)","    pendingAction = null; pendingStake = null; pendingItem = null; pendingMode = null;\n    if (a.gamble)")
rep(u,"    pendingAction = null; pendingStake = null; pendingItem = null;\n    const buttons","    pendingAction = null; pendingStake = null; pendingItem = null; pendingMode = null;\n    const buttons")
rep(u,"    if (pendingAction) { renderTargetPicker(p); return; }","    if (pendingMode) { renderModePicker(p); return; }\n    if (pendingAction) { renderTargetPicker(p); return; }")
rep(u,"      btn.onclick = function () { doAction(pendingAction, t.id, null); };","      btn.onclick = function () { if (pendingAction.mode) { pendingMode = { a: pendingAction, t: t.id }; pendingAction = null; renderPrivate(); return; } doAction(pendingAction, t.id, null); };")
rep(u,"  function renderTargetPicker(p) {",'''  function renderModePicker(p) {
    $("actionHint").textContent = "¿Cómo es tu mano? Solo tú lo sabrás.";
    $("actionHint").classList.remove("hidden");
    const box = $("actionChoices");
    box.className = "actions";
    box.innerHTML = "";
    const opts = [{ id: "sincera", name: "Mano sincera", d: "Quieres ayudar de verdad. Si confía y calla, ambos salís ganando." }];
    if (p.alignment === "asesino" || p.corr >= 12) opts.push({ id: "trampa", name: "Mano trampa", d: "Parece ayuda, pero se pudre por dentro. Si confía y calla, sufrirá sin saber por qué." });
    opts.forEach(function (o) {
      const btn = document.createElement("button");
      btn.className = "choice";
      btn.innerHTML = '<b>' + o.name + '</b><span class="small">' + o.d + '</span>';
      btn.onclick = function () { const m = pendingMode; doAction(m.a, m.t, o.id); };
      box.appendChild(btn);
    });
    addCancel(box);
  }

  function renderHand(p) {
    const box = $("privateHand");
    const o = p.dead ? null : U.getHandOffer(p.id);
    if (!o) { box.classList.add("hidden"); box.innerHTML = ""; return; }
    box.classList.remove("hidden");
    box.innerHTML = '<div class="tag">UNA MANO TENDIDA</div><p class="small">' + esc(o.from) + ' te ofrece su ayuda en secreto. Si confías en su palabra, se abrirá una ventana a tu favor, pero deberás guardar silencio. Si lo cuentas, la ventana se cerrará.</p>' +
      '<p class="small">Si eliges una acción sin responder, la mano se rechaza.</p>' +
      '<div class="row"><button class="primary smallbtn" id="handYes">Confiar y callar</button><button class="ghost smallbtn" id="handNo">Rechazar</button></div>';
    $("handYes").onclick = function () { const r = U.answerHand(p.id, true); toast(r.msg, !r.ok); renderPrivate(); };
    $("handNo").onclick = function () { const r = U.answerHand(p.id, false); toast(r.msg, !r.ok); renderPrivate(); };
  }

  function renderTargetPicker(p) {''')
rep(u,"    renderOffer(p);","    renderOffer(p);\n    renderHand(p);")
rep(u,'      emboscada: "emboscada"\n','      emboscada: "emboscada",\n      romper: "rompe su silencio sobre"\n')
# ---------- html ----------
rep(h,'<div id="privateOffer" class="notice hidden"></div>','<div id="privateOffer" class="notice hidden"></div>\n      <div id="privateHand" class="notice hidden"></div>')
rep(h,'<option value="emboscada">Enfrentamiento / ataque</option>','<option value="emboscada">Enfrentamiento / ataque</option>\n          <option value="romper">Romper un silencio (a quién te tendió la mano)</option>')
rep(h,"        <li>Tres heridas eliminan","        <li><b>Tender la mano</b>: ofreces ayuda en secreto. Solo tú sabes si es sincera o una trampa. Quien confía y calla recibe una ventana a su favor; hablar en el Consejo la cierra, y nadie puede comprobar lo que dices.</li>\n        <li>Tres heridas eliminan")
print("OK")
