/* EL UMBRAL — interfaz (v0.9.3) */
(function () {
  "use strict";

  const U = window.UMBRAL;
  const D = window.UMBRAL_DATA;
  const $ = function (id) { return document.getElementById(id); };
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }
  function signed(n) { return (n >= 0 ? "+ " : "- ") + Math.abs(n); }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  let timerId = null;
  let seconds = U.COUNCIL_SECONDS;
  let councilTimerStarted = false;
  let handoffMode = null;
  let pendingAction = null;
  let pendingStake = null;
  let pendingMode = null;
  let pendingSpell = null;
  let pendingStudy = null;
  let pendingItem = null;
  let sheetAction = null;

  /* ---------------- arranque ---------------- */
  function init() {
    const sv = U.hasSave();
    if (sv) {
      $("btnContinue").classList.remove("hidden");
      $("saveInfo").textContent = "Partida guardada: " + sv.names + " · ronda " + sv.round + " · " + sv.phase;
    }
    const syncNames = function () {
      const n = Number($("playerCount").value) || 3;
      [3, 4, 5].forEach(function (i) { $("nameRow" + i).style.display = i < n ? "" : "none"; });
    };
    $("playerCount").onchange = syncNames;
    try {
      const sn = JSON.parse(localStorage.getItem("umbral_setup") || "null");
      if (sn && sn.count >= 3 && sn.count <= 6) {
        $("playerCount").value = String(sn.count);
        (sn.names || []).forEach(function (nm, i) { if ($("name" + i) && nm) $("name" + i).value = nm; });
        if (sn.minutes >= 5 && sn.minutes <= 120) $("gameMinutes").value = sn.minutes;
      }
    } catch (e) { /* sin datos guardados */ }
    syncNames();
    window.onerror = function (m, src, ln) { try { U.noteError(m + " @" + ln); } catch (e) { /* nada */ } };
    $("btnStart").onclick = function () {
      U.clearSave();
      const count = Number($("playerCount").value) || 3;
      const names = [];
      for (let i = 0; i < count; i++) names.push($("name" + i).value);
      let mins = Math.round(Number($("gameMinutes").value));
      if (!(mins >= 5)) mins = 5; if (mins > 120) mins = 120;
      $("gameMinutes").value = mins;
      try { localStorage.setItem("umbral_setup", JSON.stringify({ count: count, names: names, minutes: mins })); } catch (e) { /* sin almacenamiento */ }
      U.createGame(names, { minutes: mins });
      enterGame(true);
      $("roundLabel").textContent = "RONDA 1/" + U.maxRounds();
      renderHandoff("start");
    };
    $("btnContinue").onclick = function () {
      if (!U.loadGame()) return;
      const s0 = U.getState(), c0 = s0 && s0.phase === "private" && !s0.handoff ? U.currentPlayer() : null;
      if (c0 && !c0.acted) { enterGame(true); $("roundLabel").textContent = "RONDA " + s0.round + "/" + U.maxRounds(); renderHandoff("start"); } else enterGame();
    };
    $("btnNew").onclick = function () { U.clearSave(); location.reload(); };
    $("btnLog").onclick = function () { $("logText").value = U.exportLog(); $("logOverlay").classList.remove("hidden"); };
    $("btnLogClose").onclick = function () { $("logOverlay").classList.add("hidden"); };
    $("btnLogCopy").onclick = function () {
      const ta = $("logText"); ta.focus(); ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      if (!ok && navigator.clipboard) { navigator.clipboard.writeText(ta.value).then(function () { toast("Registro copiado."); }, function () { toast("Mantén pulsado el texto, 'Seleccionar todo' y copia.", true); }); return; }
      toast(ok ? "Registro copiado." : "Mantén pulsado el texto, 'Seleccionar todo' y copia.", !ok);
    };
    $("btnHandoff").onclick = onHandoffContinue;
    $("btnEndCouncil").onclick = onEndCouncil;
    $("btnRegister").onclick = onRegister;
    $("btnNextRound").onclick = onNextRound;
    $("btnSaveExit").onclick = function () { U.save(); location.reload(); };
    $("btnStatus").onclick = function () { updateStatus(); $("statusOverlay").classList.remove("hidden"); };
    $("btnCloseStatus").onclick = function () { $("statusOverlay").classList.add("hidden"); };
    $("statusOverlay").onclick = function (e) { if (e.target === $("statusOverlay")) $("statusOverlay").classList.add("hidden"); };
    $("btnHelp").onclick = function () { $("helpOverlay").classList.remove("hidden"); };
    $("btnCloseHelp").onclick = function () { $("helpOverlay").classList.add("hidden"); };
    $("helpOverlay").onclick = function (e) { if (e.target === $("helpOverlay")) $("helpOverlay").classList.add("hidden"); };
    $("btnActionCancel").onclick = function () { $("actionOverlay").classList.add("hidden"); };
    $("btnActionChoose").onclick = function () {
      const a = sheetAction;
      $("actionOverlay").classList.add("hidden");
      if (a) onChooseAction(a);
    };
    $("actionOverlay").onclick = function (e) { if (e.target === $("actionOverlay")) $("actionOverlay").classList.add("hidden"); };
    if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    }
    updateClock();
    let lastTick = Date.now();
    setInterval(function () { const now = Date.now(); U.tick(now - lastTick); lastTick = now; updateClock(); if (U.getState() && U.timeUp()) timeIsUp(); }, 1000);
  }

  function timeIsUp() {
    const e = U.forceEnd();
    if (!e) return;
    stopTimer();
    Array.prototype.forEach.call(document.querySelectorAll(".overlay"), function (o) { o.classList.add("hidden"); });
    toast("Se acabó el tiempo: llega el amanecer.", false);
    renderEnding(e);
  }

  function updateClock() {
    const s = U.getState();
    if (!s || s.phase === "ending") { $("clockPill").textContent = "0 min"; return; }
    const left = U.timeLeftMs();
    if (left === Infinity) { $("clockPill").textContent = U.elapsedMin() + " min"; return; }
    const sec = Math.max(0, Math.ceil(left / 1000));
    $("clockPill").textContent = left <= 0 ? "Tiempo agotado" : pad2(Math.floor(sec / 60)) + ":" + pad2(sec % 60);
  }

  function enterGame(noRoute) {
    $("start").classList.add("hidden");
    $("ending").classList.add("hidden");
    $("game").classList.remove("hidden");
    $("btnStatus").classList.remove("hidden");
    if (!noRoute) route();
  }

  function setStep(t) { const el = $("stepHint"); if (el) el.textContent = t || ""; }

  function hideAll() {
    ["privatePanel", "councilPanel", "resolutionPanel", "handoff"].forEach(function (id) {
      $(id).classList.add("hidden");
    });
  }

  function route() {
    const s = U.getState();
    if (!s) return;
    $("roundLabel").textContent = "RONDA " + s.round + "/" + U.maxRounds();
    updateStatus();
    if (s.phase === "ending") { renderEnding(s.ending || U.getEnding()); return; }
    if (s.handoff) { renderHandoff("turn"); return; }
    if (s.phase === "private") {
      if (U.currentPlayer().acted) { const cp0 = U.currentPlayer(), en0 = U.encounterStart(cp0.id); if (en0) { renderHandoff("turn"); showEncounter(cp0, en0); return; } renderHandoff("turn"); return; }
      renderPrivate(); return;
    }
    if (s.phase === "council") { renderCouncil(); return; }
    if (s.phase === "resolution") { renderResolution(s.lastResolution || []); return; }
  }

  /* ---------------- turno privado ---------------- */
  function darkLine(p) {
    const t = p.alignment === "asesino" ? 4 : p.corr >= 60 ? 4 : p.corr >= 40 ? 3 : p.corr >= 25 ? 2 : p.corr >= 12 ? 1 : 0;
    return ["Tu sombra aún te obedece.", "Tu sombra se mueve a veces sola.", "Tu sombra llega antes que tú.", "Tu sombra ya no te sigue: te guía.", "No sabes si la sombra es tuya o tú eres suya."][t];
  }
  function practiceLine(p) {
    const xi = U.xpInfo(p);
    const parts = ["cuerpo", "mente", "sombra"].filter(function (k) { return xi[k] && !xi[k].capped; }).map(function (k) {
      let dots = ""; for (let i = 0; i < xi[k].need; i++) dots += i < xi[k].have ? "●" : "○";
      return k.charAt(0).toUpperCase() + k.slice(1) + " " + dots;
    });
    return parts.length ? '<div class="small">Práctica: ' + parts.join(" · ") + '</div>' : "";
  }
  function statsHTML(p) {
    const status = [];
    const hi = U.healthInfo(p);
    const chips = (hi.status || []).map(function (id) { return D.STATUS[id] ? D.STATUS[id].name : id; });
    if (hi.shock && chips.indexOf("Shock") < 0) chips.push("Shock");
    if (hi.dying) chips.unshift("Moribundo");
    const zt = (hi.zones || []).filter(function (z) { return z.lvl >= 1; }).map(function (z) { return z.name + (z.lvl >= 2 ? " grave" : " " + (z.dmg ? "−" + z.dmg : "dañado")); }).join(" · ");
    const vcls = hi.pct <= 30 ? "low" : hi.pct <= 60 ? "mid" : "good";
    if (p.focus) status.push("Foco +" + p.focus);
    if (p.shield) status.push("Coartada");
    if (p.protection !== null) status.push("Protegido");
    if (p.roundDefense) status.push("Defensa +" + p.roundDefense);
    if (p.roundAttack) status.push("Ataque +" + p.roundAttack);
    return '<div class="player">' +
      '<div class="row between small"><span>Virtud <b>' + p.virtue + '</b></span><span class="darkline">' + darkLine(p) + '</span></div>' +
      '<div class="meter"><span class="virtue" style="width:' + p.virtue + '%"></span></div>' +
      '<div class="row between small"><span>Vitalidad <b>' + hi.hp + '/' + hi.max + '</b></span><span class="muted">' + esc(zt) + '</span></div>' +
      '<div class="meter hp"><span class="' + vcls + '" style="width:' + Math.max(0, Math.min(100, hi.pct)) + '%"></span></div>' +
      (chips.length ? '<div class="chips">' + chips.map(function (c) { return '<span class="schip">' + esc(c) + '</span>'; }).join("") + '</div>' : '') +
      '<div class="row between small"><span>Cuerpo ' + p.stats.cuerpo + '</span><span>Mente ' + p.stats.mente + '</span><span>Sombra ' + p.stats.sombra + '</span><span>Obj ' + p.items.length + '</span><span>Pistas ' + p.clues.length + '</span></div>' +
      practiceLine(p) +
      (status.length ? '<div class="small">' + status.join(" · ") + '</div>' : '') +
      '</div>';
  }

  function renderPrivate() {
    stopTimer();
    hideAll();
    $("privatePanel").classList.remove("hidden");
    const s = U.getState();
    const p = U.currentPlayer();
    $("phaseTag").textContent = "TURNO PRIVADO";
    $("screenTitle").textContent = "Turno de " + p.name;
    setStep("Información privada: que nadie mire. Elige UNA acción; antes de confirmar verás qué hace.");
    $("privateName").textContent = p.name;
    $("privateRole").textContent = p.role.name + " · " + p.affinity.name;
    const passives = [];
    const brief = s.round > 2;
    if (p.role.passive) passives.push("<b>" + esc(p.role.passive.name) + "</b>" + (brief ? "" : ": " + esc(p.role.passive.desc)));
    if (p.affinity.passive) passives.push("<b>" + esc(p.affinity.passive.name) + "</b>" + (brief ? "" : ": " + esc(p.affinity.passive.desc)));
    $("privatePassives").innerHTML = passives.length ? passives.join(" · ") : "";
    const gf = p.gift && p.gift.round === s.round ? p.gift.text : "";
    $("privateGear").textContent = gf; $("privateGear").classList.toggle("hidden", !gf);
    $("privateStory").textContent = s.event.text;
    const weakest = Object.keys(p.stats).sort(function (a, b) { return p.stats[a] - p.stats[b]; })[0];
    const offers = { cuerpo: "El Umbral te promete fuerza para que nadie vuelva a hacerte daño.", mente: "El Umbral te promete conocer los secretos de todos antes de que puedan ocultarlos.", sombra: "El Umbral te promete moverte sin ser visto y decidir quién merece caer." };
    $("privateTemptation").textContent = p.alignment === "asesino" ? (p.exposed ? "Han descubierto tu identidad. Los supervivientes saben que eres el Asesino: tendrás que sobrevivir a su respuesta." : "Tu voluntad ya pertenece al Umbral. Elimina a tus adversarios antes de que te detengan.") : (s.assassinId === null && !(s.shadow && s.shadow.strikes > 0) ? "Susurro para ti: " + offers[weakest] + "" + (U.isUnlocked(p, D.ACTIONS.find(function (x) { return x.id === "ceder"; })) ? " Ceder puede darte poder, pero si te entregas lo suficiente y nadie se ha transformado, el Umbral te reclamará." : "") : "El Umbral ya tiene un Asesino. Decide si ayudas a detenerlo o buscas tu propia supervivencia.");
    $("privateTemptation").classList.toggle("hidden", !!p.dead || (s.round % 2 === 0 && p.alignment !== "asesino"));
    renderSince(p);
    renderPacts(p);
    renderAdvice(p);
    renderOffer(p);
    renderHand(p);
    const fresh = U.unlockNotices(p);
    if (fresh.length) toast(fresh.join(" "), false);
    $("privateStats").innerHTML = statsHTML(p);
    renderSheet(p);
    renderActions(p);
    updateStatus();
  }

  function pactsHTML(list) {
    return list.map(function (x) {
      return '<div class="small"><b>Pacto de ' + esc(x.label) + '</b> con ' + esc(x.other) + (x.thisRound ? ' · se evalúa al final de esta ronda' : ' · se evalúa al final de la próxima') + '<br>' + esc(x.terms) + '</div>';
    }).join("");
  }
  function renderSince(p) {
    const box = $("sinceBox"); if (!box) return;
    const d = p.dead ? null : U.getSince(p.id);
    if (!d) { box.classList.add("hidden"); box.innerHTML = ""; return; }
    const wtxt = d.hpNow === d.hpFrom ? "" : '<div class="small"><b>Vitalidad: ' + d.hpFrom + " → " + d.hpNow + "</b></div>";
    box.classList.remove("hidden");
    box.innerHTML = '<div class="tag">DESDE TU ÚLTIMO TURNO</div>' + wtxt + d.notes.map(function (n) { return '<div class="small">• ' + esc(n.replace(/^Ronda \d+: /, "")) + "</div>"; }).join("") + (d.more ? '<div class="small muted">…y ' + d.more + " más en tu ficha.</div>" : "");
  }
  function renderPacts(p) {
    const box = $("pactBox"); if (!box) return;
    const l = p.dead ? [] : U.activePacts(p.id);
    if (!l.length) { box.classList.add("hidden"); box.innerHTML = ""; return; }
    box.classList.remove("hidden");
    box.innerHTML = '<div class="tag">PACTOS VIGENTES</div>' + pactsHTML(l) + '<div class="small muted">Cumplirlo da +3 virtud a ambos. Romperlo: +8 corrupción, −6 virtud y se hace público.</div>';
  }

  /* Consejo para jugadores perdidos: se puede cerrar o silenciar para siempre. */
  const advClosed = {};
  function adviceOff() { try { return localStorage.getItem("umbral_noadvice") === "1"; } catch (e) { return false; } }
  function adviceFor(p) {
    const s = U.getState(), did = p.did || {};
    const total = Object.keys(did).reduce(function (a, k) { return a + did[k]; }, 0);
    const top = Object.keys(did).sort(function (a, b) { return did[b] - did[a]; })[0];
    const hi = U.healthInfo(p);
    if (!hi.dying && (hi.hp <= hi.max * 0.4 || hi.shock)) return { id: "vitalidad", text: "Tu vitalidad está baja (" + hi.hp + "/" + hi.max + ") y puedes desmayarte. Cúbrete: Proteger, Descansar o un objeto de curación te mantienen en pie." };
    const dyingMate = !hi.dying && s.players.find(function (x) { return x.id !== p.id && x.dying && !x.dead; });
    if (dyingMate) return { id: "socorro" + dyingMate.id, text: dyingMate.name + " está moribundo: usa Socorrer en tu turno antes de que acabe la ronda siguiente." };
    if (p.corr >= 40 && !did.meditar) return { id: "corr", text: "Notas que la oscuridad te gana terreno. Meditar la aleja y también devuelve virtud." };
    if (s.round >= 3 && total >= 3 && top && did[top] >= total && total >= 3) return { id: "repite", text: "Llevas toda la partida haciendo lo mismo. Probar otra acción te enseña cosas nuevas y desbloquea más opciones." };
    if (s.round >= 2 && p.items.length >= 3) return { id: "objetos", text: "Tienes varios objetos guardados. Mira tu ficha: algunos protegen, curan o dan ventaja en una acción." };
    if (s.round >= 3 && p.clues.length >= 3) return { id: "pistas", text: "Has reunido varias pistas. Léelas en tu ficha y úsalas en el consejo para acusar o defenderte." };
    if (s.round >= 2 && total === 0) return { id: "nada", text: "Aún no has hecho nada. Si no eliges acción, la ronda pasa sin que avances. Prueba Explorar o Investigar." };
    return null;
  }
  function renderAdvice(p) {
    const box = $("adviceBox"); if (!box) return;
    const a = (p.dead || adviceOff()) ? null : adviceFor(p);
    if (!a || advClosed[p.id + a.id + p.name]) { box.classList.add("hidden"); box.innerHTML = ""; return; }
    box.classList.remove("hidden");
    box.innerHTML = '<div class="tag">CONSEJO</div><p class="small">' + esc(a.text) + '</p>' +
      '<div class="row"><button class="ghost smallbtn" id="advClose">Cerrar</button><button class="ghost smallbtn" id="advNever">No volver a mostrar</button></div>';
    $("advClose").onclick = function () { advClosed[p.id + a.id + p.name] = 1; renderAdvice(p); };
    $("advNever").onclick = function () { try { localStorage.setItem("umbral_noadvice", "1"); } catch (e) { advClosed[p.id + a.id + p.name] = 1; } renderAdvice(p); };
  }

  function renderOffer(p) {
    const box = $("privateOffer");
    const o = p.dead ? null : U.getOffer(p.id);
    if (!o || o.done) { box.classList.add("hidden"); box.innerHTML = ""; return; }
    const pressure = p.pressure || 0;
    const refuse = o.refuse ? "Rechazar: +2 virtud, pero el Umbral no olvida." : "Rechazar: +2 virtud.";
    box.classList.remove("hidden");
    box.innerHTML = '<div class="tag">TRATO DEL UMBRAL</div><p class="small">' + esc(o.text) + '</p>' +
      '<p class="small">Aceptar: tiene un precio que el Umbral no dice en voz alta. ' + refuse +
      ' Si eliges una acción sin responder, cuenta como rechazo.</p>' +
      '<div class="row"><button class="primary smallbtn" id="offerYes">Aceptar</button><button class="ghost smallbtn" id="offerNo">Rechazar</button></div>';
    $("offerYes").onclick = function () { const r = U.answerOffer(p.id, true); toast(r.msg, !r.ok); renderPrivate(); };
    $("offerNo").onclick = function () { const r = U.answerOffer(p.id, false); toast(r.msg, !r.ok); renderPrivate(); };
  }

  function startGearNote(p) {
    const id = p.role.passive && p.role.passive.id;
    if (id === "startVendas") return "Equipo inicial: 2 vendas. Preparaste tu bolsa de remedios antes de partir.";
    if (id === "startItem") return "Equipo inicial: 1 daga. La conservas de tu último encargo.";
    if (id === "startClue") return "Empiezas sin objetos, pero con una pista que recuerdas de tu pasado.";
    return "Empiezas con las manos vacías. Todo lo que consigas esta noche será tuyo.";
  }

  function renderSheet(p) {
    const passives = [];
    if (p.role.passive) passives.push("<b>" + esc(p.role.passive.name) + "</b>: " + esc(p.role.passive.desc));
    if (p.affinity.passive) passives.push("<b>" + esc(p.affinity.passive.name) + "</b>: " + esc(p.affinity.passive.desc));
    const items = p.items.length ? p.items.map(function (it, i) {
      const def = D.ITEMS[it.id];
      return '<div class="itemrow"><div><b>' + esc(def.name) + '</b><div class="small">' + esc(def.desc) + '</div></div>' +
        (def.kind === "weapon" ? '<span class="small">Se usa desde una acción</span>' : '<button class="ghost smallbtn" data-item="' + i + '"' + (p.usedItem ? " disabled" : "") + '>Usar</button>') + '</div>';
    }).join("") : '<p class="small">No llevas nada.</p>';
    const clues = p.clues.length ? p.clues.map(function (c) {
      return '<div class="clue"><span class="tag">FUERZA ' + c.strength + '</span> ' + esc(c.text) + '</div>';
    }).join("") : '<p class="small">No tienes pistas.</p>';
    const notes = p.notes.length ? p.notes.slice(-5).map(function (n) {
      return '<div class="notice small">' + esc(n) + '</div>';
    }).join("") : '<p class="small">Sin notas.</p>';
    $("sheetBody").innerHTML =
      '<div class="notice small">Secreto: «' + esc(p.secret.text) + '» ' + (secretOk(p, U.getState()) ? '✦ Se cumple ahora. En la segunda mitad de la partida, si se cumple al cerrar la ronda ganas +1 foco.' : '✧ Aún no se cumple.') + '</div>' +
      statsHTML(p) +
      ((p.hints || []).length ? '<h3>Intuiciones</h3>' + p.hints.slice(-8).map(function (t) { return '<div class="notice small">' + esc(t) + '</div>'; }).join('') : '') +
      '<h3>Equipo inicial</h3><p class="small">' + esc(startGearNote(p)) + '</p>' +
      '<h3>Estados</h3><p class="small">' + ((p.status || []).length ? p.status.map(function (s) { return D.STATUS[s.id].name + " (" + s.left + " ronda" + (s.left > 1 ? "s" : "") + "): " + D.STATUS[s.id].desc; }).join("<br>") : "Ninguno.") + '</p>' +
      '<h3>Objetos</h3>' + items +
      (p.usedItem ? '<p class="small">Ya has usado un objeto esta ronda.</p>' : '') +
      '<h3>Pistas</h3><p class="small">La fuerza indica cuánto pesa cada pista como prueba al acusar o presentarla.</p>' + clues +
      spellsHTML(p) + '<h3>Notas</h3>' + notes;
    Array.prototype.forEach.call($("sheetBody").querySelectorAll("[data-item]"), function (b) {
      b.onclick = function () { onUseItem(Number(b.getAttribute("data-item"))); };
    });
  }

  const SHORT = { investigar: "Pistas sobre alguien", proteger: "Cubres a otro", explorar: "Objetos y pistas", meditar: "Calma la oscuridad", robar: "Quitas un objeto", hechizar: "Magia sucia, con pista", apostar: "Riesgo por premio", ceder: "Poder a cambio de alma", resistir: "Rechazas el poder", cazar: "Ataque secreto", apunalar: "Golpe con tu daga", envenenar: "Veneno lento", maldecir: "Estorba sus tiradas", aturdir: "Pierde su turno", devorar: "Canibalismo", descansar: "Recuperas vitalidad", entrenar: "+1 a tus tiradas", tender: "Ayuda secreta", conjurar: "Lanzas un conjuro", socorrer: "Salvas a un moribundo" };

  function renderActions(p) {
    const box = $("actionChoices");
    if (pendingStudy) { renderStudyPicker(p); return; }
    if (pendingSpell) { renderSpellPicker(p); return; }
    if (pendingMode) { renderModePicker(p); return; }
    if (pendingAction) { renderTargetPicker(p); return; }
    if (pendingStake) { renderStakePicker(p); return; }
    if (pendingItem !== null) { renderItemTargetPicker(p); return; }

    box.className = "actions grid3";
    box.innerHTML = "";
    D.ACTIONS.filter(function (a) { return U.isUnlocked(p, a); }).forEach(function (a) {
      const od = a.risk && !a.gamble && a.attr ? U.actionOdds(p.id, a.id) : null;
      const prob = od ? od.prob : null;
      const chip = a.id === "conjurar" ? "MAGIA" : a.risk ? (a.gamble ? "ENVITE" : (prob === null ? "RIESGO" : prob + "% éxito")) : "SEGURO";
      const chipCls = a.id === "conjurar" || a.gamble ? "risk" : a.risk ? (prob === null ? "risk" : prob >= 70 ? "good" : prob >= 45 ? "mid" : "low") : "safe";
      const btn = document.createElement("button");
      btn.className = "tile" + (a.hostile ? " hostile" : "");
      btn.innerHTML = '<span class="tileName">' + esc(a.name) + '</span>' + '<span class="small tileShort">' + esc(SHORT[a.id] || "") + '</span>' +
        '<span class="chip ' + chipCls + '">' + chip + '</span>';
      btn.onclick = function () { openActionSheet(a); };
      box.appendChild(btn);
    });
    $("actionHint").textContent = "";
    $("actionHint").classList.add("hidden");
  }

  function openActionSheet(a) {
    const p = U.currentPlayer();
    if (!p) return;
    sheetAction = a;
    const od = a.risk && !a.gamble && a.attr ? U.actionOdds(p.id, a.id) : null;
    let meta;
    if (a.gamble) meta = "Tú eliges el envite: 5, 10 o 20. Cuanto más alto, más riesgo y más premio.";
    else if (od) meta = "Probabilidad de ÉXITO: " + od.prob + "% (fallas un " + (100 - od.prob) + "%). Tirada: d6 + " + a.attr + " " + od.bonus + " contra dificultad " + od.diff + (a.hostile ? " (+1 si la víctima está protegida)" : "") + ". Un 6 siempre sale bien y un 1 siempre falla." + (od.mods.length ? " Influye: " + od.mods.join(", ") + "." : "");
    else if (a.risk) meta = "Tirada con riesgo: puede salir mal.";
    else meta = "Sin tirada. El efecto está garantizado.";
    if (a.target) meta += " Después eliges a quién afecta.";
    $("actionSheetTag").textContent = a.tag;
    $("actionSheetTitle").textContent = a.name;
    $("actionSheetDesc").textContent = a.desc;
    $("actionSheetLore").textContent = a.lore ? "«" + a.lore + "»" : "";
    $("actionSheetMeta").textContent = meta;
    $("btnActionChoose").textContent = "Elegir";
    $("actionOverlay").classList.remove("hidden");
  }

  function openInfoSheet(tag, title, desc, meta, label, fn) {
    sheetAction = { __confirm: fn };
    $("actionSheetTag").textContent = tag;
    $("actionSheetTitle").textContent = title;
    $("actionSheetDesc").textContent = desc;
    $("actionSheetLore").textContent = "";
    $("actionSheetMeta").textContent = meta;
    $("btnActionChoose").textContent = label;
    $("actionOverlay").classList.remove("hidden");
  }

  function spellsHTML(p) {
    if (!p.spells || !p.spells.length) return "";
    return "<h3>Conjuros</h3>" + p.spells.map(function (sp) {
      return '<div class="itemrow"><div><b>' + esc(sp.name) + '</b><div class="small">' + esc(sp.desc) + ' · ' + sp.uses + ' uso' + (sp.uses > 1 ? "s" : "") + (sp.mastered ? ' · Dominado' : sp.wins ? ' · empieza a obedecerte' : '') + '</div></div></div>';
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
        btn.innerHTML = '<b>' + esc(t.name) + '</b><span class="small">' + esc(U.visibleHealth(t)) + '</span>';
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
      btn.innerHTML = '<b>' + esc(sp.name) + '</b><span class="small">' + esc(sp.desc) + ' · ' + sp.uses + ' uso' + (sp.uses > 1 ? "s" : "") + (sp.mastered ? ' · Dominado' : sp.wins ? ' · empieza a obedecerte' : '') + '</span>';
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

  function renderModePicker(p) {
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

  function renderTargetPicker(p) {
    $("actionHint").textContent = "Elige a quién afecta «" + pendingAction.name + "»." + (pendingAction.canTarget && !U.getState().players.some(function (x) { return x.id !== p.id && !x.dead && pendingAction.canTarget(x); }) ? " Ahora mismo no hay nadie a quien se pueda aplicar." : "");
    $("actionHint").classList.remove("hidden");
    const box = $("actionChoices");
    box.className = "actions";
    box.innerHTML = "";
    U.getState().players.filter(function (x) { return x.id !== p.id && !x.dead && (!pendingAction.canTarget || pendingAction.canTarget(x)); }).forEach(function (t) {
      const btn = document.createElement("button");
      btn.className = "choice";
      btn.innerHTML = '<b>' + esc(t.name) + '</b><span class="small">' + esc(U.visibleHealth(t)) + '</span>';
      btn.onclick = function () { if (pendingAction.mode) { pendingMode = { a: pendingAction, t: t.id }; pendingAction = null; renderPrivate(); return; } doAction(pendingAction, t.id, null); };
      box.appendChild(btn);
    });
    addCancel(box);
  }

  function renderStakePicker(p) {
    $("actionHint").textContent = "Elige tu envite. Cuanto más alto, más paga… y más duele.";
    $("actionHint").classList.remove("hidden");
    const box = $("actionChoices");
    box.className = "actions";
    box.innerHTML = "";
    D.STAKES.forEach(function (st) {
      const prob = U.pSuccess(p.stats.sombra + p.focus, st.diff);
      const btn = document.createElement("button");
      btn.className = "choice";
      btn.innerHTML = '<span class="choiceTop"><b>Envite ' + esc(st.name) + ' · ' + st.id + '</b><span class="chip risk">' + prob + '% éxito</span></span>' +
        '<span class="small">' + esc(st.desc) + ' Dificultad ' + st.diff + '.</span>' +
        '<span class="tagline">Si fallas: el Umbral cobra' + (st.wound ? " y te hiere" : "") + '.</span>';
      btn.onclick = function () { doAction(pendingStake, null, st.id); };
      box.appendChild(btn);
    });
    addCancel(box);
  }

  function renderItemTargetPicker(p) {
    $("actionHint").textContent = "Elige sobre quién usar el objeto.";
    $("actionHint").classList.remove("hidden");
    const box = $("actionChoices");
    box.className = "actions";
    box.innerHTML = "";
    U.getState().players.filter(function (x) { return x.id !== p.id && !x.dead; }).forEach(function (t) {
      const btn = document.createElement("button");
      btn.className = "choice";
      btn.innerHTML = '<b>' + esc(t.name) + '</b><span class="small">' + esc(U.visibleHealth(t)) + '</span>';
      btn.onclick = function () {
        const r = U.useItem(p.id, pendingItem, t.id);
        pendingItem = null;
        toast(r.ok ? r.msg : r.msg, !r.ok);
        renderPrivate();
      };
      box.appendChild(btn);
    });
    addCancel(box);
  }

  function addCancel(box) {
    const b = document.createElement("button");
    b.className = "ghost";
    b.textContent = "Cancelar";
    b.onclick = function () { pendingAction = null; pendingStake = null; pendingItem = null; pendingMode = null; pendingSpell = null; pendingStudy = null; renderPrivate(); };
    box.appendChild(b);
  }

  function onChooseAction(a) {
    pendingAction = null; pendingStake = null; pendingItem = null; pendingMode = null; pendingSpell = null; pendingStudy = null;
    if (a.__confirm) { a.__confirm(); return; }
    if (a.id === "conjurar") { pendingSpell = { id: null }; renderPrivate(); return; }
    if (a.gamble) { pendingStake = a; renderPrivate(); return; }
    if (a.target) { pendingAction = a; renderPrivate(); return; }
    doAction(a, null, null);
  }

  function doAction(a, targetId, stakeId) {
    if (!a) { toast("No hay acción pendiente.", true); return; }
    const p = U.currentPlayer();
    if (!p) { toast("La partida no está en un turno válido.", true); return; }
    const res = U.act(p.id, a.id, targetId, stakeId);
    if (!res.ok) { $("actionHint").textContent = res.msg; return; }
    pendingAction = null; pendingStake = null; pendingItem = null; pendingMode = null; pendingSpell = null; pendingStudy = null;
    const buttons = res.pushable ? [
      { label: "Quedarme con esto", cls: "", onClick: endTurn },
      { label: "Forzar el destino", cls: "danger", onClick: function () { doPush(p.id); } }
    ] : [{ label: "Continuar", cls: "primary", onClick: endTurn }];
    showRoll({ title: a.name.toUpperCase(), result: res, text: res.outcome, buttons: buttons });
  }

  function doPush(actorId) {
    const r = U.pushLuck(actorId);
    if (!r.ok) { endTurn(); return; }
    showRoll({ title: "FORZAR EL DESTINO", result: r, text: r.outcome, buttons: [{ label: "Continuar", cls: "primary", onClick: endTurn }] });
  }

  function onUseItem(index) {
    const p = U.currentPlayer();
    const def = D.ITEMS[p.items[index].id];
    openInfoSheet("OBJETO", def.name, def.desc, (def.id === "daga" ? "Solo puedes usar un objeto por ronda. No se gasta." : "Solo puedes usar un objeto por ronda. Se gasta al usarlo."), def.kind === "tome" ? "Estudiar" : "Usar", function () { useItemConfirmed(index); });
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
    if (def.kind === "clue" || def.kind === "dust") {
      pendingItem = index;
      renderPrivate();
      return;
    }
    const r = U.useItem(p.id, index, null);
    toast(r.ok ? r.msg : r.msg, !r.ok);
    renderPrivate();
  }

  function showEncounter(p, e) {
    const buttons = e.options.map(function (o) {
      const hint = o.attr ? " (" + o.attr + ")" : "";
      return { label: o.label + hint, cls: o.id === "irse" ? "" : "primary", onClick: function () {
        const r = U.encounterAct(p.id, o.id);
        if (!r.ok) { toast(r.msg, true); endTurn(); return; }
        showRoll({ title: e.name.toUpperCase(), result: r, text: r.outcome, buttons: [{ label: "Continuar", cls: "primary", onClick: endTurn }] });
      } };
    });
    showRoll({ title: "ENCUENTRO: " + e.name.toUpperCase(), result: {}, text: e.intro + " ¿Qué haces? Tu forma de tratarla y tus habilidades decidirán qué pasa.", buttons: buttons });
  }

  function endTurn() {
    const cp = U.currentPlayer();
    const enc = cp ? U.encounterStart(cp.id) : null;
    if (enc) { showEncounter(cp, enc); return; }
    U.finishTurn();
    if (U.getState().phase === "ending") { renderEnding(U.getEnding()); return; }
    renderHandoff("turn");
  }

  /* ---------------- entrega ---------------- */
  function secretOk(p, s) {
    var d = U.D.SECRETS.find(function (x) { return x.id === p.secret.id; });
    try { return !!(d && d.check(p, s)); } catch (e) { return false; }
  }

  function renderHandoff(mode) {
    stopTimer();
    hideAll();
    $("handoff").classList.remove("hidden");
    const s = U.getState();
    handoffMode = mode;
    $("phaseTag").textContent = mode === "round" ? "NUEVA RONDA" : mode === "start" ? "TURNO PRIVADO" : "TURNO PRIVADO";
    $("screenTitle").textContent = "Pasa el móvil";
    setStep("");
    if (mode === "start") {
      const cur = s.players[s.turn];
      $("handoffTitle").textContent = "Entrega el móvil";
      $("handoffText").textContent = "Entrega el móvil a " + cur.name + ". Nadie más debe mirar la pantalla.";
      $("btnHandoff").textContent = "Soy " + cur.name;
    } else if (mode === "round") {
      $("handoffTitle").textContent = "La noche avanza";
      const sk = s.skipped || [];
      const skDy = sk.filter(function (id) { return s.players[id].dying; }).map(function (id) { return s.players[id].name; });
      const skSt = sk.filter(function (id) { return !s.players[id].dying; }).map(function (id) { return s.players[id].name; });
      const skipTxt = (skSt.length ? " Pierde su turno (aturdido): " + skSt.join(", ") + "." : "") + (skDy.length ? " Inconsciente y moribundo, no actúa: " + skDy.join(", ") + "." : "");
      if (s.phase === "council") $("handoffText").textContent = s.event.text + skipTxt + " Nadie puede actuar: se abre el Consejo.";
      else $("handoffText").textContent = s.event.text + skipTxt + " Entrega el móvil a " + s.players[s.turn].name + ".";
      $("btnHandoff").textContent = "Comenzar ronda " + s.round;
    } else {
      $("handoffTitle").textContent = "Decisión sellada";
      $("handoffText").textContent = (function () { var o = s.order || s.players.map(function (q) { return q.id; }); var rest = o.slice(o.indexOf(s.turn) + 1).filter(function (id) { return !s.players[id].dead && !s.players[id].acted; }); return rest.length ? "Entrega el móvil a " + s.players[rest[0]].name + ". No reveles tu elección." : "Todos han decidido. Abrid el Consejo."; })();
      $("btnHandoff").textContent = (function () { var o = s.order || s.players.map(function (q) { return q.id; }); return o.slice(o.indexOf(s.turn) + 1).filter(function (id) { return !s.players[id].dead && !s.players[id].acted; }).length === 0; })() ? "Abrir el Consejo" : "Continuar";
    }
    updateStatus();
  }

  function onHandoffContinue() {
    if (handoffMode === "round" || handoffMode === "start") { handoffMode = null; route(); return; }
    const advanced = U.nextTurn();
    if (advanced === "blocked") toast("El turno no puede avanzar: falta resolver una acción.", true);
    route();
  }

  /* ---------------- consejo ---------------- */
  function renderCouncil() {
    hideAll();
    $("councilPanel").classList.remove("hidden");
    const s = U.getState();
    $("phaseTag").textContent = "FASE SOCIAL";
    $("screenTitle").textContent = "El Consejo";
    setStep("Hablad, y registrad aquí lo que deba contar.");
    { const cpTxt = U.councilPrompt(); $("councilPrompt").textContent = cpTxt; $("councilPrompt").classList.toggle("hidden", !cpTxt); }
    renderCouncilLog(s);
    renderIxForm(s);
    renderIxList(s);
    if (!councilTimerStarted) startCouncilTimer();
    renderTimer();
    updateStatus();
  }

  function startCouncilTimer() {
    councilTimerStarted = true;
    seconds = U.councilSeconds();
    clearInterval(timerId);
    timerId = setInterval(function () {
      seconds--;
      renderTimer();
      if (seconds <= 0) {
        clearInterval(timerId);
        timerId = null;
        $("timer").classList.add("timeup");
        if (U.behindSchedule()) onEndCouncil();
      }
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerId);
    timerId = null;
    councilTimerStarted = false;
    $("timer").classList.remove("timeup");
  }

  function renderTimer() {
    const s = Math.max(0, seconds);
    $("timer").textContent = pad2(Math.floor(s / 60)) + ":" + pad2(s % 60);
    $("timerNote").textContent = s <= 0
      ? "El tiempo del Consejo ha terminado. Cerradlo cuando queráis."
      : U.behindSchedule() ? "Vamos justos de tiempo: el Consejo se cerrará solo al llegar a cero."
      : "";
  }

  function renderCouncilLog(s) {
    const entries = s.chronicle.filter(function (c) { return c.round === s.round; });
    $("councilLogBox").querySelector("summary").textContent = "Lo que ha pasado esta ronda (" + entries.length + ")";
    $("councilLog").innerHTML = entries.length ? entries.map(function (c) {
      return '<div class="notice small">' + esc(c.text) + '</div>';
    }).join("") : '<p class="small">Todavía no ha ocurrido nada esta ronda.</p>';
  }

  function fillSelect(sel, options, value) {
    sel.innerHTML = options.map(function (o) {
      return '<option value="' + o.v + '">' + esc(o.t) + '</option>';
    }).join("");
    if (value !== null && value !== undefined && value !== "") {
      const has = options.some(function (o) { return String(o.v) === String(value); });
      if (has) sel.value = String(value);
    }
  }

  function renderIxForm(s) {
    const actorSel = $("ixActor");
    const targetSel = $("ixTarget");
    const prevActor = actorSel.value;
    const prevTarget = targetSel.value;
    const activePlayers = s.players.filter(function (p) { return !p.dead; });
    fillSelect(actorSel, activePlayers.map(function (p) { return { v: p.id, t: p.name }; }), prevActor);
    const actorId = Number(actorSel.value);
    const targets = activePlayers.filter(function (p) { return p.id !== actorId; });
    fillSelect(targetSel, targets.map(function (p) { return { v: p.id, t: p.name }; }), prevTarget);
    actorSel.onchange = function () { renderIxForm(s); };
    $("ixType").onchange = function () { $("ixHint").textContent = ixHint(s); renderIxCards(); };
    targetSel.onchange = function () { $("ixHint").textContent = ixHint(s); };
    $("ixHint").textContent = ixHint(s);
    renderIxCards();
  }

  /* Cada interacción explicada: qué es, cuándo usarla y qué pasa exactamente. */
  const IX_INFO = [
    { v: "pacto_no_agresion", t: "Pacto de no agresión", s: "Prometéis no atacaros. Necesita que acepte el otro.", fx: ["Cumplido: +3 virtud para ambos.", "Roto (alguien actúa contra el otro): +8 corrupción y −6 virtud al que rompe, y se hace público.", "Se evalúa al final de la próxima ronda."] },
    { v: "pacto_silencio", t: "Pacto de silencio", s: "Prometéis no investigaros ni acusaros. Necesita que acepte el otro.", fx: ["Cumplido: +3 virtud para ambos.", "Roto (investigar, acusar o presentar pruebas contra el otro): +8 corrupción y −6 virtud al que rompe.", "Se evalúa al final de la próxima ronda."] },
    { v: "pacto_proteccion", t: "Pacto de protección", s: "Quien actúa jura proteger al otro. Necesita que acepte el otro.", fx: ["Quien actúa debe usar Proteger sobre el otro la próxima ronda si le atacan en público.", "Cumplido: +3 virtud para ambos. Roto: +8 corrupción y −6 virtud a quien juró.", "Se evalúa al final de la próxima ronda."] },
    { v: "amenaza", t: "Amenaza pública", s: "Adviertes a alguien delante de todos.", fx: ["Ahora: el amenazado pierde 4 virtud; tú ganas 5 de corrupción y pierdes 3 de virtud.", "Si él te ataca después, él paga (+8 corrupción, −8 virtud) y tú ganas 4 de virtud.", "Si no te ataca, la amenaza queda en nada: otra vez +4 corrupción y −3 virtud para ti."] },
    { v: "revelar", t: "Presentar una prueba", s: "Enseñas a todos tu pista más fuerte sobre alguien.", fx: ["La pista pasa a ser pública y queda a tu nombre.", "+2 virtud para ti.", "Necesitas tener alguna pista sobre esa persona."] },
    { v: "acusacion", t: "Acusación pública", s: "Dices que alguien es el Asesino. Tus pistas deciden la tirada.", fx: ["Aciertas (es el Asesino): queda identificado y no podrá cazar la próxima ronda; +4 virtud para ti.", "Fallas o es inocente: +5 corrupción y −5 virtud para ti; el acusado gana 2 de virtud.", "Cuantas más pistas fuertes tengas sobre él, más probable es acertar."] },
    { v: "emboscada", t: "Enfrentamiento / ataque", s: "Atacas a alguien en público. Ambos tiráis dados.", fx: ["Si ganas: le causas daño en su vitalidad (más si uno de los dos es Asesino); +8 corrupción y −3 virtud para ti.", "Si pierdes: −8 virtud y +6 corrupción para ti, y todos lo ven.", "Es la acción más arriesgada del Consejo."] },
    { v: "romper", t: "Romper un silencio", s: "Cuentas que alguien te tendió la mano en secreto.", fx: ["Solo si recibiste una mano de esa persona y aún sigue activa.", "Tú pierdes 4 virtud. Si su mano era sincera, ella gana 2.", "Nadie puede comprobar lo que dices."] }
  ];
  function renderIxCards() {
    const box = $("ixCards"); if (!box) return;
    const cur = $("ixType").value;
    box.innerHTML = "";
    IX_INFO.forEach(function (x) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ixcard" + (x.v === cur ? " sel" : "");
      b.innerHTML = '<b>' + esc(x.t) + '</b><div class="small">' + esc(x.s) + '</div>' + (x.v === cur ? '<ul class="small">' + x.fx.map(function (f) { return "<li>" + esc(f) + "</li>"; }).join("") + '</ul>' : "");
      b.onclick = function () { $("ixType").value = x.v; $("ixType").onchange(); };
      box.appendChild(b);
    });
    const info = IX_INFO.find(function (x) { return x.v === cur; });
    $("btnRegister").textContent = "Registrar: " + (info ? info.t : "interacción");
    $("ixTargetLabel").firstChild.textContent = cur.indexOf("pacto_") === 0 ? "Pacto con " : (cur === "romper" ? "Silencio de " : "Contra / hacia ");
  }

  const IX_DESC = {
    pacto_no_agresion: "Ambos prometen no agredirse. Se evalúa al final de la siguiente ronda; romperlo deja marca.",
    pacto_silencio: "Ambos prometen callar lo que sepan el uno del otro.",
    pacto_proteccion: "Uno se compromete a proteger al otro. Se evalúa al final de la siguiente ronda.",
    amenaza: "Amenazas en público: el objetivo pierde virtud y tú te manchas.",
    revelar: "Muestras a todos una pista que tienes sobre el objetivo.",
    acusacion: "Acusas al objetivo de ser el Asesino. Si te equivocas, lo pagas.",
    emboscada: "Atacas por sorpresa; el objetivo se defiende con una tirada.",
    romper: "Quien actúa rompe su silencio: cuenta que el objetivo le tendió la mano. Nadie puede comprobarlo."
  };
  function ixHint(s) {
    const actor = s.players[Number($("ixActor").value)];
    const type = $("ixType").value;
    if (!actor) return "";
    const used = s.council.used[actor.id];
    if (type.indexOf("pacto_") === 0 && used.pact >= 1) return actor.name + " ya ha sellado un pacto en este Consejo.";
    if (type === "acusacion" && used.accuse >= 1) return actor.name + " ya ha acusado en este Consejo.";
    if ((type === "amenaza" || type === "emboscada") && used.plot >= 1) return actor.name + " ya ha tramado algo en este Consejo.";
    if (type === "revelar" && used.reveal >= 1) return actor.name + " ya ha presentado una prueba.";

    if (type === "revelar" && !actor.clues.some(function (c) { return c.about === Number($("ixTarget").value); })) return "No tienes pruebas sobre ese jugador.";
    return "";
  }

  function renderIxList(s) {
    const labels = {
      pacto_no_agresion: "pacto de no agresión",
      pacto_silencio: "pacto de silencio",
      pacto_proteccion: "pacto de protección",
      amenaza: "amenaza",
      revelar: "prueba presentada",
      acusacion: "acusación",
      emboscada: "emboscada",
      romper: "rompe su silencio sobre"
    };
    const pl = $("pactList");
    if (pl) {
      const all = s.pacts.filter(function (x) { return !x.done && x.accepted !== false; }).map(function (x) {
        return { label: x.type === "pacto_proteccion" ? "protección" : x.type === "pacto_silencio" ? "silencio" : "no agresión", other: s.players[x.a].name + " y " + s.players[x.b].name, thisRound: x.expires === s.round, terms: U.pactTerms(x.type, s.players[x.a].name, s.players[x.b].name) };
      });
      pl.innerHTML = all.length ? '<div class="tag">PACTOS VIGENTES (públicos)</div>' + pactsHTML(all) : "";
    }
    $("ixListBox").querySelector("summary").textContent = "Interacciones registradas (" + s.council.interactions.length + ")";
    $("ixList").innerHTML = s.council.interactions.length ? s.council.interactions.map(function (i) {
      return '<div class="clue small">' + esc(s.players[i.actor].name) + " → " + labels[i.type] + " → " + esc(s.players[i.target].name) + '</div>';
    }).join("") : '<p class="small">Nadie ha registrado nada todavía.</p>';
  }

  function onRegister() {
    const actor = Number($("ixActor").value);
    const type = $("ixType").value;
    const target = Number($("ixTarget").value);
    const s = U.getState();
    const actorName = s.players[actor] && s.players[actor].name;
    const targetName = s.players[target] && s.players[target].name;
    /* Sin window.confirm: en un WebView de Android puede no mostrarse y devolver siempre "no". */
    openInfoSheet("CONSEJO", actorName, "Entrega el móvil a " + actorName + ". ¿Confirma que quiere registrar esta acción?", "", "Confirmar", function () {
      if (type.indexOf("pacto_") === 0) {
        openInfoSheet("PACTO", targetName, "Entrega ahora el móvil a " + targetName + ". ¿Acepta libremente este pacto?", U.pactTerms(type, actorName, targetName) + " Cumplirlo: +3 virtud a ambos. Romperlo: +8 corrupción y −6 virtud a quien lo rompa. Si no aceptas, no se registra nada.", "Acepto", function () { finishRegister(actor, type, target, true); });
      } else finishRegister(actor, type, target, false);
    });
  }

  function finishRegister(actor, type, target, targetAccepted) {
    const res = U.registerInteraction(actor, type, target, targetAccepted);
    if (!res.ok) { $("ixHint").textContent = res.msg; return; }
    if (res.kind === "roll") {
      showRoll({
        title: "RESOLUCIÓN PÚBLICA",
        result: res.roll,
        duel: res.duel,
        text: res.text,
        buttons: [{ label: "Continuar", cls: "primary", onClick: function () { renderCouncil(); } }]
      });
    } else {
      toast(res.text);
      renderCouncil();
    }
  }

  function onEndCouncil() {
    if (U.getState().phase !== "council") return;
    const out = U.endCouncil();
    stopTimer();
    if (U.getState().phase === "ending") renderEnding(U.getEnding());
    else renderResolution(out);
  }

  /* ---------------- resolución ---------------- */
  function renderResolution(entries) {
    stopTimer();
    hideAll();
    $("resolutionPanel").classList.remove("hidden");
    const s = U.getState();
    $("phaseTag").textContent = "RESOLUCIÓN";
    $("screenTitle").textContent = "La ronda termina";
    setStep("Esto es lo que ha pasado y todos podéis ver. Lo secreto sigue en secreto.");
    $("resTitle").textContent = "Ronda " + s.round + " — consecuencias";
    const pub = s.chronicle.filter(function (c) { return c.round === s.round; }).map(function (c) { return c.text; });
    $("resLog").innerHTML = pub.length ? pub.map(function (e) {
      return '<div class="notice">' + esc(e) + '</div>';
    }).join("") : '<p class="small">Ronda tranquila: nada se ha hecho público. Lo que cada uno haya hecho en secreto sigue en secreto.</p>';
    $("resPlayers").innerHTML = s.players.map(function (p) {
      return '<div class="player"><div class="row between"><b>' + esc(p.name) + '</b><span class="small">' + (p.dead ? 'Eliminado' : p.dying ? 'Moribundo' : 'En juego') + '</span></div>' +
        '<div class="small">' + esc(U.visibleHealth(p)) + '</div></div>';
    }).join("");
    $("btnNextRound").textContent = s.round >= U.maxRounds() ? "Ver el desenlace" : "Siguiente ronda";
    updateStatus();
  }

  function onNextRound() {
    const e = U.nextRound();
    if (e) { renderEnding(e); return; }
    renderHandoff("round");
  }

  /* ---------------- desenlace ---------------- */
  function renderEnding(e) {
    stopTimer();
    $("game").classList.add("hidden");
    $("start").classList.add("hidden");
    $("ending").classList.remove("hidden");
    $("btnStatus").classList.add("hidden");
    ["statusOverlay", "actionOverlay"].forEach(function (id) {
      $(id).classList.add("hidden");
    });
    if (!e) return;
    $("endingSub").textContent = "Duración: " + e.durationMin + " min" + (e.plannedMin ? " (previstos " + e.plannedMin + ")" : "") + (e.timedOut ? " · tiempo agotado" : "") + " · Corrupción media: " + e.avgCorruption + " · Traiciones: " + e.betrayals;
    $("endingTitle").textContent = e.title;
    $("endingText").textContent = e.text;
    const story = U.buildStory();
    $("endingStory").innerHTML = story.length ? story.map(function (x) { return "<p class=\"small\">" + (x.round ? "<b>Ronda " + x.round + ".</b> " : "") + esc(x.text) + "</p>"; }).join("") : "<p class=\"small\">La partida terminó antes de que ocurriera nada que contar.</p>";
    U.exportLog();
    $("endingStats").innerHTML = e.players.map(function (p) {
      const items = p.items.length ? p.items.map(esc).join(", ") : "sin objetos";
      return '<div class="player"><div class="row between"><b>' + esc(p.name) + '</b><span class="small">' + esc(p.role) + ' · ' + esc(p.affinity) + '</span></div>' +
        '<div class="row between small"><span>Virtud ' + p.virtue + '</span><span>Corrupción ' + p.corr + '</span></div>' +
        '<div class="meter"><span class="corrupt" style="width:' + p.corr + '%"></span></div>' +
        '<p class="small">' + 'vitalidad ' + p.hp + '/' + p.maxHp + ' · ' + p.clues + (p.clues === 1 ? ' pista · ' : ' pistas · ') + items + '</p>' +
        '<p class="small">' + (p.dead ? (p.cause === "devorado" ? "Devorado" : /sangr|desangr/i.test(p.cause || "") ? "Murió desangrado" : "Murió de heridas") : p.dying ? "Moribundo al final" : "Sobrevivió") + (p.alignment === "asesino" ? " · Asesino" : "") + '</p></div>';
    }).join("");
    $("endingSecrets").innerHTML = e.players.map(function (p) {
      return '<p class="small">' + (p.fulfilled ? "✦" : "✧") + ' <b>' + esc(p.name) + '</b>: «' + esc(p.secret) + '» — ' +
        (p.fulfilled ? "cumplido" : "no cumplido") + '.</p>';
    }).join("");
  }

  /* ---------------- estado público ---------------- */
  function updateStatus() {
    const s = U.getState();
    if (!s || !$("allPlayers")) return;
    $("allPlayers").innerHTML = s.players.map(function (p) {
      const active = s.phase === "private" && s.turn === p.id && !s.handoff;
      return '<div class="player' + (active ? " active" : "") + '">' +
        '<div class="row between"><b>' + esc(p.name) + '</b><span class="small">' + (p.dead ? 'Eliminado' : p.dying ? 'Moribundo' : 'En juego') + '</span></div>' +
        '<div class="small">' + esc(U.visibleHealth(p)) + '</div></div>';
    }).join("");
    $("clueCount").textContent = s.publicClues.length;
    $("publicClues").innerHTML = s.publicClues.length ? s.publicClues.slice(-4).map(function (c) {
      return '<div class="clue small">' + esc(c.text) + '</div>';
    }).join("") : '<p class="small">Nadie ha presentado pruebas todavía.</p>';
    const living = s.players.filter(function (p) { return !p.dead; });
    const avg = living.length ? Math.round(living.reduce(function (a, p) { return a + p.corr; }, 0) / living.length) : 100;
    const exposedAss = s.players.filter(function (p) { return p.alignment === "asesino" && p.exposed && !p.dead; });
    if (exposedAss.length) { $("worldState").textContent = (exposedAss.length > 1 ? "Asesinos identificados: " : "Asesino identificado: ") + exposedAss.map(function (p) { return p.name; }).join(", ") + "."; return; }
    $("worldState").textContent = avg < 15 ? "El aire aún conserva algo de esperanza."
      : avg < 40 ? "La magia oscura se filtra en los caminos."
      : avg < 65 ? "El Umbral se ha abierto y la realidad empieza a deformarse."
      : "La oscuridad ya no pide permiso.";
  }

  /* ---------------- tiradas ---------------- */
  function showRoll(opts) {
    const overlay = $("overlay");
    overlay.classList.remove("hidden");
    $("rollTitle").textContent = opts.title || "TIRADA";
    $("rollMath").textContent = "";
    $("rollWhy").textContent = "";
    $("rollBanner").textContent = "";
    $("rollBanner").className = "rollbanner";
    $("rollOutcome").textContent = "";
    $("rollActions").innerHTML = "";
    const stage = $("rollStage");
    const duel = opts.duel;
    if (duel) {
      stage.innerHTML = '<div class="duel">' +
        '<div class="duelcol"><div class="small">' + esc(duel.attacker.name) + '</div><div class="die" id="dieA">?</div><div class="small" id="mathA"></div></div>' +
        '<div class="vs">VS</div>' +
        '<div class="duelcol"><div class="small">' + esc(duel.defender.name) + '</div><div class="die" id="dieB">?</div><div class="small" id="mathB"></div></div>' +
        '</div>';
    } else {
      stage.innerHTML = '<div class="die" id="rollDie">?</div>';
    }
    const iv = (duel || (opts.result && opts.result.die)) ? setInterval(function () {
      if (duel) {
        $("dieA").textContent = 1 + Math.floor(Math.random() * 6);
        $("dieB").textContent = 1 + Math.floor(Math.random() * 6);
      } else {
        $("rollDie").textContent = 1 + Math.floor(Math.random() * 6);
      }
    }, 70) : null;
    setTimeout(function () {
      if (iv) clearInterval(iv);
      const r = opts.result;
      if (duel) {
        $("dieA").textContent = duel.attacker.die;
        $("dieB").textContent = duel.defender.die;
        $("dieA").className = "die " + (duel.attacker.total > duel.defender.total ? "good" : "bad");
        $("dieB").className = "die " + (duel.defender.total >= duel.attacker.total ? "good" : "bad");
        $("mathA").textContent = "d6 + " + duel.attacker.bonus + " = " + duel.attacker.total;
        $("mathB").textContent = "d6 + " + duel.defender.bonus + " = " + duel.defender.total;
        $("rollMath").textContent = "Duelo de dados";
      } else if (r && r.die) {
        $("rollDie").textContent = r.die;
        $("rollDie").className = "die " + (r.success ? "good" : "bad");
        $("rollWhy").textContent = (r.why || []).length ? "Influye: " + r.why.join(" · ") : "";
        $("rollMath").textContent = "d6 " + signed(r.stat) + (r.focus ? " + foco " + r.focus : "") + (r.status ? " (incluye " + signed(r.status) + " por estados)" : "") + " = " + r.total + " · dificultad " + r.diff;
        if (r.crit) { $("rollBanner").textContent = "✦ FAVOR DEL UMBRAL"; $("rollBanner").className = "rollbanner good"; }
        if (r.fumble) { $("rollBanner").textContent = "☠ PRESAGIO"; $("rollBanner").className = "rollbanner bad"; }
      } else {
        $("rollDie").textContent = "✦";
        $("rollDie").className = "die";
      }
      $("rollOutcome").textContent = opts.text || "";
      (opts.buttons || []).forEach(function (b) {
        const el = document.createElement("button");
        el.className = b.cls || "";
        el.textContent = b.label;
        el.onclick = function () { overlay.classList.add("hidden"); b.onClick(); };
        $("rollActions").appendChild(el);
      });
    }, duel ? 1100 : (opts.result && opts.result.die ? 850 : 500));
  }

  /* ---------------- avisos ---------------- */
  function toast(msg, bad) {
    const t = document.createElement("div");
    t.className = "toast" + (bad ? " bad" : "");
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
