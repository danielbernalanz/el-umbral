/* EL UMBRAL — interfaz (v1.12.0) */
(function () {
  "use strict";

  let U = window.UMBRAL;        /* local: EXACTAMENTE window.UMBRAL. En línea se cambia por UmbralNet.backend (net.js) */
  let NET = false;
  const D = window.UMBRAL_DATA;
  const $ = function (id) { return document.getElementById(id); };
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }
  /* Nombre para mostrar: los NPC se ven siempre como tales. */
  function dn(p) { return esc(p.name) + (p && p.npc ? ' <span class="chip mid npcchip">NPC</span>' : ''); }
  function npcAdv() {
    if (NET || !window.UMBRAL_NPC) return 0;
    try { return window.UMBRAL_NPC.localAdvance(U); } catch (e) { try { U.noteError("npc: " + e.message); } catch (e2) { /* nada */ } return 0; }
  }
  /* Primer humano que aún tiene que jugar (tras el turno actual si ya se entregó). */
  function pendingHuman(s) {
    const o = s.order || s.players.map(function (q) { return q.id; });
    for (let i = s.handoff ? o.indexOf(s.turn) + 1 : o.indexOf(s.turn); i < o.length; i++) { const q = s.players[o[i]]; if (q && !q.dead && !q.acted && !q.npc) return q; }
    return null;
  }
  function signed(n) { return (n >= 0 ? "+ " : "- ") + Math.abs(n); }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  /* Mutaciones: en local la respuesta es síncrona y cb corre en el acto (comportamiento idéntico); en línea es una Promise
     (la vista ya está actualizada cuando llega) y un doble toque en vuelo se ignora. */
  function run(res, cb) { if (!res || typeof res.then !== "function") return cb(res); res.then(function (r) { if (!(r && r.dup)) cb(r); }); }
  function mut(res) { run(res, function (r) { toast(r.msg, !r.ok); renderPrivate(); }); }

  /* ---------------- iconos (sprites incrustados en index.html; ver img/sprites-map.js) ---------------- */
  function ic(key, cls) { try { return typeof window.icon === "function" && key ? window.icon(key, cls) : ""; } catch (e) { return ""; } }
  const FAMS = {
    a_investigar: "lore", a_proteger: "guard", a_explorar: "ember", a_meditar: "lore", a_robar: "dark", a_hechizar: "dark", a_apostar: "ember", a_ceder: "dark", a_resistir: "guard",
    a_cazar: "danger", a_trampa: "danger", a_sabotear: "dark", a_apunalar: "danger", a_envenenar: "dark", a_maldecir: "dark", a_aturdir: "danger", a_devorar: "danger", a_descansar: "heal", a_conjurar: "lore", a_tender: "heal",
    a_indagar: "lore", st_indicio: "lore", a_socorrer: "heal", a_atender: "heal", a_bendecir: "heal", a_sombra_espia: "dark", a_sombra_guarda: "dark", a_sombra_hostiga: "dark", a_alzar: "dark", a_entrenar: "ember", a_acusar: "danger", a_enfrentar: "danger",
    a_romper: "danger", a_pacto: "gold", a_estudiar: "lore", a_aprender: "lore", a_perfeccionar: "lore", a_abstener: "mist",
    sp_rayo: "danger", sp_plaga: "dark", sp_marchitar: "danger", sp_grillete: "dark", sp_maleficio: "dark", sp_drenar: "dark", sp_pesadilla: "dark", sp_egida: "guard", sp_sanar: "heal", sp_velo: "guard", sp_purga: "heal", sp_reflejo: "guard", sp_presagio: "lore",
    as_fuego: "ember", as_hielo: "lore", as_luz: "gold", as_sangre: "danger", as_sombra: "dark", as_vacio: "dark",
    f_combatiente: "danger", f_erudito: "lore", f_sanadora: "heal", f_ladron: "dark", f_vidente: "lore", f_centinela: "guard",
    s_fortalecido: "heal", s_maldito: "dark", s_veneno: "dark", s_aturdido: "mist", s_muerto: "mist",
    st_vitalidad: "danger", st_virtud: "heal", st_sombra: "dark", st_corrupcion: "dark", st_cuerpo: "ember", st_mente: "lore", st_foco: "gold", st_pistas: "lore", st_objetos: "gold", st_conjuros: "dark",
    md_cauto: "guard", md_normal: "gold", md_desatado: "danger", t_asesino: "danger", ui_exito: "heal", ui_fallo: "danger", ui_critico: "ember",
    ph_privado: "mist", ph_consejo: "lore", ph_resolucion: "ember", ph_desenlace: "mist", ph_prep: "gold"
  };
  const ITEM_FAM = { heal: "heal", cleanse: "heal", purify: "heal", elixir: "heal", virtue: "heal", defense: "guard", shield: "guard", ward: "guard", reflect: "guard", fog: "guard", passive: "guard", weapon: "danger", tome: "lore", clue: "lore", lens: "lore", lantern: "lore", rune: "lore", prep: "ember", focus: "gold", corruption: "dark", ritual: "dark", dust: "dark", event: "dark", state: "dark" };
  const EV_FAM = { heal: "heal", virtue: "heal", corruption: "dark", item: "gold", clue: "lore" };
  function famOf(key) {
    if (FAMS[key]) return FAMS[key];
    if (key.indexOf("i_") === 0) { const d = D.ITEMS[key.slice(2)]; return (d && ITEM_FAM[d.kind]) || "gold"; }
    if (key.indexOf("e_") === 0) { const d = D.EVENTS.find(function (x) { return "e_" + x.id === key; }); return (d && EV_FAM[d.fx]) || "mist"; }
    if (key.indexOf("t_") === 0) return "dark";
    if (key.indexOf("z_") === 0) return "mist";
    if (key.indexOf("m_") === 0 || key.indexOf("p_") === 0 || key.indexOf("x_") === 0 || key.indexOf("r_") === 0) return "gold";
    return "gold";
  }
  function medal(key, size, fam, extra) {
    const k = ic(key); if (!k) return "";
    return '<span class="medal ' + (size || "md") + " f-" + (fam || famOf(key)) + (extra ? " " + extra : "") + '" aria-hidden="true">' + k + "</span>";
  }
  function tagH(text, key) { return '<div class="tag">' + ic(key, "ic-tag") + esc(text) + "</div>"; }
  function h3i(text, key, extra) { return '<h3 class="h3i">' + ic(key) + "<span>" + (extra || esc(text)) + "</span></h3>"; }
  function setLbl(el, text) { if (!el) return; const l = el.querySelector(".lbl"); if (l) l.textContent = text; else el.textContent = text; }
  function setIcoBtn(el, key, text) { el.innerHTML = ic(key) + '<span class="lbl">' + esc(text) + "</span>"; }
  /* Iconos estáticos del HTML: <x data-ic="clave" data-ic-cls="clase"> recibe el icono al principio. */
  function decorate(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll("[data-ic]"), function (el) {
      if (el.getAttribute("data-icdone")) return;
      el.setAttribute("data-icdone", "1");
      const key = el.getAttribute("data-ic"), cls = el.getAttribute("data-ic-cls") || (el.classList.contains("tag") ? "ic-tag" : "");
      const h = ic(key, cls); if (!h) return;
      if (el.classList.contains("bigmedal")) el.classList.add("f-" + famOf(key));
      el.insertAdjacentHTML("afterbegin", h);
    });
  }
  function setPhaseIcon(key) { const el = $("phaseIcon"); if (!el) return; const k = ic(key); el.className = "phaseico f-" + famOf(key); el.innerHTML = k; }
  function renderEventBanner(ev) {
    const box = $("eventBanner"); if (!box) return;
    if (!ev) { box.classList.add("hidden"); box.innerHTML = ""; return; }
    box.classList.remove("hidden");
    box.innerHTML = medal("e_" + ev.id, "lg") + '<div><span class="evtag">El Umbral esta ronda</span>' + esc(eventLine(ev)) + "</div>";
  }
  /* Vibración y sonido (fx.js): siempre opcionales y a prueba de fallos. */
  function fxv(n) { try { if (window.UmbralFX) window.UmbralFX.vibrate(n); } catch (e) { /* nada */ } }
  function fxc(n) { try { if (window.UmbralFX) window.UmbralFX.cue(n); } catch (e) { /* nada */ } }
  function fxGame(on) { try { if (window.UmbralFX) window.UmbralFX.game(on); } catch (e) { /* nada */ } }
  function fxLabels() {
    const F = window.UmbralFX; if (!F) return;
    const sn = F.soundOn(), vm = F.vibMode();
    ["btnSoundMenu", "btnSoundHelp"].forEach(function (id) { const b = $(id); if (b) setIcoBtn(b, sn ? "ui_sonido" : "ui_silencio", "Sonido: " + (sn ? "activado" : "apagado")); });
    ["btnVibMenu", "btnVibHelp"].forEach(function (id) { const b = $(id); if (b) setIcoBtn(b, "ui_vibrar", "Vibración: " + (vm === 2 ? "completa" : vm === 1 ? "solo turno" : "apagada")); });
  }
  function fxWire() {
    const F = window.UmbralFX; if (!F) return;
    ["btnSoundMenu", "btnSoundHelp"].forEach(function (id) {
      const b = $(id); if (!b) return;
      if (!F.supportsSound()) { b.classList.add("hidden"); return; }
      b.onclick = function () { const on = F.setSound(!F.soundOn()); fxLabels(); toast(on ? "Sonido ambiente activado." : "Sonido apagado."); if (on && U.getState() && U.getState().phase !== "ending") F.game(true); };
    });
    ["btnVibMenu", "btnVibHelp"].forEach(function (id) {
      const b = $(id); if (!b) return;
      b.onclick = function () { const m = F.cycleVib(); fxLabels(); toast(m === 2 ? "Vibración completa." : m === 1 ? "Vibración: solo el toque de turno (igual para todos)." : "Vibración apagada."); fxv("turno"); };
    });
    fxLabels();
  }
  /* Frases de la pantalla de traspaso: la elección depende solo de la ronda y del turno, nunca de lo que haya pendiente. */
  const MOODS = ["Alguien ha dejado algo para ti.", "El Umbral observa.", "Nadie debe mirar.", "Las velas tiemblan sin que haya viento.", "Respira hondo antes de mirar.", "No todos los susurros son para ti.", "Algo se mueve al otro lado de la puerta.", "El Umbral toma nota de todo.", "Aquí el silencio también habla.", "Que nadie vea tu cara.", "Cada cual guarda lo suyo.", "La noche escucha."];
  function moodLine(s, mode) { const m = mode === "round" ? 5 : mode === "start" ? 2 : 0; return MOODS[(s.round * 7 + (typeof s.turn === "number" ? s.turn : 0) * 5 + m) % MOODS.length]; }
  /* Una sola vez por turno privado, ya con el móvil en manos de quien afecta: moribundo > oferta > ataque > herida > toque suave. */
  let fxTurnKey = "";
  const ATK_RE = /te atac|te hiri|te embosc|te agred|golpe seco|te ha robado|te devor|intentó morderte|pasos apresurados|acechando|magia prohibida|polvo cegador|una descarga/i;
  function fxTurn(p, offer) {
    const s = U.getState(); if (!s || !p) return;
    const key = s.round + ":" + p.id; if (key === fxTurnKey) return; fxTurnKey = key;
    const d = p.dead ? null : U.getSince(p.id);
    if (p.dying) fxScreen("hurt", "danger", true, "slow");
    else if (d && d.hpNow < d.hpFrom) fxScreen("hurt", "danger", true);
    if (d && d.notes.some(function (n) { return /rompiste tu pacto/i.test(n); })) fxScreen("crack", "gold", true);
    if (p.dying) { fxv("moribundo"); fxc("latido"); return; }
    if (offer && !offer.done) { fxv("oferta"); return; }
    if (d && d.notes.some(function (n) { return ATK_RE.test(n); })) { fxv("ataque"); return; }
    if (d && d.hpNow < d.hpFrom) { fxv("herida"); return; }
    fxv("turno");
  }
  /* Herida recibida durante el propio turno (el móvil ya está en la mano de quien la sufre). */
  function fxSelf(p, hp0) {
    if (!p) return;
    if (p.dying) { fxv("moribundo"); fxc("latido"); } else if (typeof hp0 === "number" && p.hp < hp0) fxv("herida");
  }
  /* ---- animaciones con sentido (v1.6.2) ----
     Cada efecto comunica algo que acaba de pasar (resultado, herida, curación, sello...). Solo transform/opacidad, siempre finitas.
     Lo secreto solo se anima en la pantalla de quien actúa; en el Consejo, solo lo ya público. Se apagan con prefers-reduced-motion. */
  function motionOn() { try { return !window.UmbralFX || window.UmbralFX.motion(); } catch (e) { return true; } }
  const FX_KIND = {
    apunalar: ["slash", "danger"], trampa: ["impact", "danger"], sabotear: ["snatch", "dark"], cazar: ["claws", "danger"], devorar: ["claws", "danger"], aturdir: ["impact", "danger"], envenenar: ["drip", "dark"], maldecir: ["close", "dark"],
    hechizar: ["flash", "dark"], robar: ["snatch", "dark"], investigar: ["scan", "lore"], explorar: ["scan", "ember"], proteger: ["shield", "guard"], resistir: ["shield", "guard"],
    tender: ["shield", "heal"], atender: ["glow", "heal"], meditar: ["glow", "lore"], descansar: ["glow", "heal"], socorrer: ["glow", "heal"], bendecir: ["glow", "gold"], alzar: ["glow", "dark"],
    entrenar: ["impact", "ember"], apostar: ["coin", "ember"], ceder: ["close", "dark"], sombra_espia: ["scan", "dark"], sombra_guarda: ["shield", "dark"], sombra_hostiga: ["close", "dark"]
  };
  const ASP_FAM = { fuego: "ember", hielo: "lore", luz: "gold", sangre: "danger", sombra: "dark", vacio: "dark" };
  function fxHTML(name) {
    if (name === "claws" || name === "drip") return "<i></i><i></i><i></i>";
    if (name === "flash") return '<i class="core"></i><i class="ring"></i>';
    if (name === "crack") return '<i class="a"></i><i class="b"></i>';
    if (name === "snatch") return "<i>" + ic("a_robar") + "</i>";
    return "<i></i>";
  }
  /* Capa de efecto sobre un contenedor (o sobre toda la pantalla); una sola a la vez por contenedor; se retira sola. */
  function fxPlay(host, name, fam, ok, cls) {
    if (!motionOn()) return;
    const screen = !host;
    host = host || document.body;
    Array.prototype.slice.call(host.children).forEach(function (c) { if (c.classList && c.classList.contains("fxl") && (!screen || c.classList.contains("screen"))) c.remove(); });
    const l = document.createElement("div");
    l.className = "fxl fx-" + name + " f-" + fam + (screen ? " screen" : "") + (ok === false ? " ko" : "") + (cls ? " " + cls : "");
    l.setAttribute("aria-hidden", "true");
    l.innerHTML = fxHTML(name);
    host.appendChild(l);
    setTimeout(function () { if (l.parentNode) l.remove(); }, 1200);
  }
  function fxScreen(name, fam, ok, cls) { fxPlay(null, name, fam, ok, cls); }
  function fxClass(el, cls, ms) {
    if (!el || !motionOn()) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    setTimeout(function () { el.classList.remove(cls); }, ms || 600);
  }
  const fxSeen = {};
  function fxOnce(key) { if (fxSeen[key]) return false; fxSeen[key] = 1; return true; }
  function fxGameKey() { const s = U.getState(); return s ? String(s.createdAt || s.startedAt || 0) : "0"; }
  function fxReset() { [fxSeen, fxHpLast, fxResPrev].forEach(function (o) { Object.keys(o).forEach(function (k) { delete o[k]; }); }); }
  function fxIn(el, key) { if (el && !el.classList.contains("hidden") && fxOnce(fxGameKey() + ":" + key)) fxClass(el, "fxin", 700); }
  /* ¿Falló de verdad? Con tirada, por la tirada; sin ella, solo si el motor cuenta que alguien se interpuso o el conjuro rebotó. */
  function fxFailed(r) { return !!r && r.success === false && (r.die > 0 || /se interpone|rebota|frustra|desv[ií]a|se disipa/i.test(r.outcome || "")); }
  function fxActionOpts(a, res, hp0, p2) {
    const k = FX_KIND[a.id] || null;
    return { fx: k ? { name: k[0], fam: k[1], ok: !fxFailed(res) } : null, hit: !!p2 && typeof hp0 === "number" && p2.hp < hp0, heal: !!p2 && typeof hp0 === "number" && p2.hp > hp0, dying: !!(p2 && p2.dying) };
  }
  /* Vitalidad: temblor al bajar, latido al subir (solo en tu propio panel). */
  const fxHpLast = {};
  function fxHp(p, el) {
    const s = U.getState(), g = fxGameKey(), prev = fxHpLast[p.id];
    fxHpLast[p.id] = { g: g, hp: p.hp };
    if (!el || !prev || prev.g !== g || prev.hp === p.hp) return;
    fxClass(el, p.hp < prev.hp ? "dn" : "up", 600);
  }
  /* Mismo efecto para cualquier herida: no delata de dónde viene. */
  function mutFx(res, name, fam) {
    run(res, function (r) { toast(r.msg, !r.ok); if (r.ok && r.accepted) fxScreen(name, fam, true); renderPrivate(); });
  }

  /* Novedades (news.js): panel del menú principal; «nuevo» hasta que el jugador abre la versión actual. Nunca bloquea nada. */
  function newsSeen() { try { return localStorage.getItem("umbral_news_seen"); } catch (e) { return null; } }
  function newsMark() { try { localStorage.setItem("umbral_news_seen", String(D.VERSION)); } catch (e) { /* sin almacenamiento */ } }
  function newsWire() {
    const b = $("btnNews"); if (!b) return;
    const list = window.UMBRAL_NEWS || [];
    if (!list.length) { b.classList.add("hidden"); return; }
    $("newsNew").classList.toggle("hidden", newsSeen() === String(D.VERSION));
    b.onclick = function () {
      $("newsList").innerHTML = list.map(function (n) {
        return '<div class="newsent' + (n.version === D.VERSION ? " cur" : "") + '"><h3><span class="nv">v' + esc(n.version) + '</span>' + esc(n.titulo || "") + '<span class="nd">' + esc(n.fecha || "") + '</span></h3><ul>' +
          (n.puntos || []).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div>";
      }).join("");
      $("newsOverlay").classList.remove("hidden"); newsMark(); $("newsNew").classList.add("hidden");
    };
    $("btnCloseNews").onclick = function () { $("newsOverlay").classList.add("hidden"); };
    $("newsOverlay").onclick = function (e) { if (e.target === $("newsOverlay")) $("newsOverlay").classList.add("hidden"); };
  }

  const RUMOR_RE = /^Se rumorea/;
  const GROUP_ICON = { recuperacion: "a_descansar", pactos: "p_pacto", sucias: "a_apostar", armas: "a_apunalar", sombras: "t_sombras" };

  let timerId = null;
  let seconds = U.COUNCIL_SECONDS;
  let councilTimerStarted = false;
  let handoffMode = null;
  let pendingAction = null;
  let pendingStake = null;
  let pendingMode = null;
  let pendingSpell = null;
  let showMoreActs = false;
  let pendingStudy = null;
  let pendingItem = null;
  let sheetAction = null;

  /* ---------------- arranque ---------------- */
  function init() {
    decorate(document);
    fxWire();
    const sv = U.hasSave();
    if (sv) {
      $("btnContinue").classList.remove("hidden");
      $("saveInfo").textContent = "Partida guardada: " + sv.names + " · ronda " + sv.round + " · " + ({ private: "turnos privados", council: "consejo", resolution: "resolución", ending: "desenlace" }[sv.phase] || "en curso");
    }
    /* Asientos de la mesa: humano o NPC (los ids name{i}/npc{i} se conservan para las pruebas). */
    let seats = [0, 1, 2].map(function (i) { return { name: "Jugador " + (i + 1), npc: "" }; });
    const stdName = function (n) { return /^Jugador \d+$/.test(n) || (D.NPC_NAMES || []).indexOf(n) !== -1; };
    function freeNpcName() {
      const used = seats.map(function (q) { return q.name.toLowerCase(); }), pool = D.NPC_NAMES || ["NPC"];
      for (let k = 0; k < pool.length; k++) { const c = pool[(seats.length * 3 + k) % pool.length]; if (used.indexOf(c.toLowerCase()) === -1) return c; }
      return "NPC " + (seats.length + 1);
    }
    function renderSeats() {
      $("playerCount").value = String(seats.length);
      $("playerRows").innerHTML = seats.map(function (q, i) {
        const opts = '<option value=""' + (!q.npc ? " selected" : "") + '>Humano</option><option value="azar"' + (q.npc ? " selected" : "") + '>NPC</option>';
        return '<div class="seat' + (q.npc ? " npc" : "") + '" id="nameRow' + i + '"><label class="fl" data-ic="ui_jugador">Nombre del jugador ' + (i + 1) + '<input id="name' + i + '" value="' + esc(q.name) + '" maxlength="16" data-i="' + i + '"></label>' +
          '<select id="npc' + i + '" class="seatsel" data-i="' + i + '" aria-label="Tipo del jugador ' + (i + 1) + '">' + opts + '</select>' +
          (q.npc && seats.length > 2 ? '<button class="ghost smallbtn seatrm" id="rm' + i + '" data-i="' + i + '" aria-label="Quitar a ' + esc(q.name) + '">Quitar</button>' : '') + '</div>';
      }).join("");
      decorate($("playerRows"));
      $("btnAddNpc").disabled = seats.length >= 10;
      const nh = seats.filter(function (q) { return !q.npc; }).length;
      $("npcHint").textContent = nh === 0 ? "Hace falta al menos un jugador humano." : "Un NPC es un jugador más controlado por la app: juega solo en su turno y puede acabar siendo el Asesino. Se ve siempre como «NPC».";
    }
    function resizeSeats(n) {
      n = Math.max(2, Math.min(10, n || 3));
      while (seats.length > n) seats.pop();
      while (seats.length < n) seats.push({ name: "Jugador " + (seats.length + 1), npc: "" });
      renderSeats();
    }
    $("playerCount").onchange = function () { resizeSeats(Number($("playerCount").value)); };
    $("btnAddNpc").onclick = function () {
      if (seats.length >= 10) { toast("La mesa admite 10 jugadores como máximo.", true); return; }
      seats.push({ name: freeNpcName(), npc: "azar" }); renderSeats();
    };
    $("playerRows").addEventListener("input", function (e) { const i = Number(e.target.getAttribute("data-i")); if (seats[i] && e.target.tagName === "INPUT") seats[i].name = e.target.value; });
    $("playerRows").addEventListener("change", function (e) {
      const i = Number(e.target.getAttribute("data-i")); if (!seats[i] || e.target.tagName !== "SELECT") return;
      seats[i].npc = e.target.value;
      if (seats[i].npc && stdName(seats[i].name)) seats[i].name = freeNpcName();
      else if (!seats[i].npc && stdName(seats[i].name)) seats[i].name = "Jugador " + (i + 1);
      renderSeats();
    });
    $("playerRows").addEventListener("click", function (e) {
      const b = e.target.closest ? e.target.closest(".seatrm") : null; if (!b) return;
      seats.splice(Number(b.getAttribute("data-i")), 1); renderSeats();
    });
    try {
      const sn = JSON.parse(localStorage.getItem("umbral_setup") || "null");
      if (sn && sn.count >= 2 && sn.count <= 10) {
        seats = [];
        for (let i = 0; i < sn.count; i++) { const nmv = (sn.names || [])[i], nv = (sn.npc || [])[i]; seats.push({ name: nmv || (nv ? "NPC" : "Jugador " + (i + 1)), npc: nv ? "azar" : "" }); }
      }
    } catch (e) { /* sin datos guardados */ }
    renderSeats();
    /* Hora de fin: por defecto ahora + 15 min redondeado a 5; la vista previa se actualiza sola mientras se mira. */
    {
      const d0 = new Date(Date.now() + 15 * 60000), m5 = Math.round(d0.getMinutes() / 5) * 5;
      d0.setMinutes(m5, 0, 0);
      $("gameEnd").value = pad2(d0.getHours()) + ":" + pad2(d0.getMinutes());
    }
    $("gameEnd").oninput = $("gameEnd").onchange = refreshEnd;
    setInterval(function () { if (!$("start").classList.contains("hidden")) refreshEnd(); }, 15000);
    refreshEnd();
    /* Antirrebote: ignora un segundo toque en menos de 400 ms (evita que un doble toque cuele una elección en la pantalla siguiente). */
    let lastTap = 0;
    document.addEventListener("click", function (e) {
      const now = Date.now();
      if (!navigator.webdriver && now - lastTap < 400) { e.stopPropagation(); e.preventDefault(); return; }
      lastTap = now;
    }, true);
    window.onerror = function (m, src, ln) { try { U.noteError(m + " @" + ln); } catch (e) { /* nada */ } };
    $("btnStart").onclick = function () {
      U.clearSave();
      const count = seats.length;
      const names = seats.map(function (q) { return q.name; });
      if (seats.every(function (q) { return !!q.npc; })) { toast("Hace falta al menos un jugador humano.", true); return; }
      const pe = parseEnd();
      if (!pe.ok) { refreshEnd(); toast(pe.msg, true); return; }
      try { localStorage.setItem("umbral_setup", JSON.stringify({ count: count, names: names, npc: seats.map(function (q) { return q.npc || ""; }) })); } catch (e) { /* sin almacenamiento */ }
      const npc = seats.map(function (q) { return q.npc ? "azar" : null; });
      U.createGame(names, { minutes: pe.mins, endAt: pe.endAt, npc: npc });
      enterGame(true);
      $("roundLabel").textContent = "RONDA 1/" + U.maxRounds();
      renderHandoff("start");
    };
    $("btnContinue").onclick = function () {
      try {
        if (!U.loadGame()) throw new Error("sin partida válida");
        const s0 = U.getState(), c0 = s0 && s0.phase === "private" && !s0.handoff ? U.currentPlayer() : null;
        if (c0 && !c0.acted) { enterGame(true); $("roundLabel").textContent = "RONDA " + s0.round + "/" + U.maxRounds(); renderHandoff("start"); } else enterGame();
      } catch (e) {
        U.clearSave();
        $("game").classList.add("hidden"); $("ending").classList.add("hidden"); $("start").classList.remove("hidden");
        $("btnContinue").classList.add("hidden"); $("saveInfo").textContent = ""; $("btnStatus").classList.add("hidden");
        toast("No se pudo reanudar la partida guardada (datos dañados o de una versión antigua).", true);
      }
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
    $("btnSecret").onclick = function () {
      const p = U.currentPlayer(); if (!p) return;
      $("secretBody").innerHTML = secretHTML(p, true) + umbralHTML(p, true);
      $("secretOverlay").classList.remove("hidden");
    };
    $("btnSecretClose").onclick = function () { $("secretOverlay").classList.add("hidden"); };
    $("secretOverlay").onclick = function (e) { if (e.target === $("secretOverlay")) $("secretOverlay").classList.add("hidden"); };
    $("btnStoryCopy").onclick = function () { copyStory(); };
    $("btnStoryCopy2").onclick = function () { const ta = $("storyText"); copyFrom(ta, "Historia copiada."); };
    $("btnStoryShare").onclick = shareStory;
    $("btnStoryDl").onclick = downloadStory;
    $("btnStoryView").onclick = function () { showStory(""); };
    $("btnStoryClose").onclick = function () { $("storyOverlay").classList.add("hidden"); };
    try { if (typeof navigator !== "undefined" && typeof navigator.share === "function") $("btnStoryShare").classList.remove("hidden"); else $("btnStoryView").parentNode.classList.add("three"); } catch (e) { /* sin compartir */ }
    $("btnHandoff").onclick = onHandoffContinue;
    $("btnEndCouncil").onclick = onEndCouncil;
    $("btnPrepSave").onclick = onPrepSave;
    $("btnPrepSkip").onclick = onPrepSkip;
    $("btnNextRound").onclick = onNextRound;
    $("btnSaveExit").onclick = function () { U.save(); location.reload(); };
    $("allPlayers").addEventListener("click", npcCtlClick);
    $("btnStatus").onclick = function () { updateStatus(); $("statusOverlay").classList.remove("hidden"); };
    $("btnCloseStatus").onclick = function () { $("statusOverlay").classList.add("hidden"); };
    $("statusOverlay").onclick = function (e) { if (e.target === $("statusOverlay")) $("statusOverlay").classList.add("hidden"); };
    /* Botón Atrás: se intercepta con el historial y se pregunta en una hoja propia. */
    try {
      window.addEventListener("popstate", function () {
        const inGame = !$("game").classList.contains("hidden");
        if (inGame) armBack();
        if (timeOverlayOpen()) { if (!(U.getState() && U.getState().timeAsk)) hideTimeOverlay(); return; }
        const open = ["logOverlay", "helpOverlay", "statusOverlay", "actionOverlay", "secretOverlay", "storyOverlay", "newsOverlay"].filter(function (id) { return !$(id).classList.contains("hidden"); });
        if (open.length) { open.forEach(function (id) { $(id).classList.add("hidden"); }); return; }
        if (!inGame) return; /* en inicio/desenlace, Atrás se deja al sistema */
        $("backOverlay").classList.remove("hidden");
      });
    } catch (e) { /* sin historial */ }
    $("btnBackStay").onclick = function () { $("backOverlay").classList.add("hidden"); };
    $("btnBackExit").onclick = function () { try { U.save(); } catch (e) { /* nada */ } location.reload(); };
    $("btnHelp").onclick = function () { $("helpOverlay").classList.remove("hidden"); };
    /* Créditos: solo existen en el menú principal (el botón vive en #start). */
    if ($("verTag") && D.VERSION) $("verTag").textContent = "v" + D.VERSION;
    if ($("btnCredits")) $("btnCredits").onclick = function () { try { if (typeof window.umbralShowCredits === "function") window.umbralShowCredits(); } catch (e) { toast("No se pudieron abrir los créditos.", true); } };
    newsWire();
    skillWire();
    $("btnCloseHelp").onclick = function () { $("helpOverlay").classList.add("hidden"); };
    $("btnAdviceToggle").onclick = function () {
      const off = adviceOff();
      try { localStorage.setItem("umbral_noadvice", off ? "0" : "1"); } catch (e) { /* sin almacenamiento */ }
      setLbl($("btnAdviceToggle"), adviceOff() ? "Activar los consejos de la partida" : "Desactivar los consejos de la partida");
      toast(adviceOff() ? "Consejos desactivados." : "Consejos activados.");
    };
    $("btnHelp").addEventListener("click", function () { setLbl($("btnAdviceToggle"), adviceOff() ? "Activar los consejos de la partida" : "Desactivar los consejos de la partida"); });
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
    setInterval(function () { const now = Date.now(); U.tick(now - lastTick); lastTick = now; updateClock(); checkTimeUi(); if (NET) netCd(); }, 1000);
    /* Al volver a mostrar la página (móvil desbloqueado) el reloj se refresca al instante con la hora real. */
    document.addEventListener("visibilitychange", function () { if (!document.hidden) { const now = Date.now(); U.tick(now - lastTick); lastTick = now; updateClock(); checkTimeUi(); if (!$("start").classList.contains("hidden")) refreshEnd(); } });
  }

  /* ---------- tiempo: aviso común, pregunta a la mesa y temporizador de turno ---------- */
  let turnKey = null, turnDeadline = 0, turnIv = null, turnAuto = false;
  function timeOverlayEl() {
    let o = $("timeOverlay");
    if (!o) {
      o = document.createElement("div"); o.id = "timeOverlay"; o.className = "overlay hidden"; o.style.zIndex = "75";
      o.innerHTML = '<div class="sheet"><div id="timeBody"></div></div>';
      document.body.appendChild(o);
    }
    return o;
  }
  function timeOverlayOpen() { const o = $("timeOverlay"); return !!o && !o.classList.contains("hidden"); }
  function hideTimeOverlay() { const o = $("timeOverlay"); if (o) o.classList.add("hidden"); }
  /* Hora de fin elegida -> minutos y marca de tiempo. Hoy si queda por delante; si ya pasó, mañana (solo vale si queda a <= 120 min, p. ej. cruzar la medianoche). */
  function parseEnd(nowTs, inputId) {
    const now = new Date(nowTs || Date.now());
    const m = /^(\d{1,2}):(\d{2})/.exec(String($(inputId || "gameEnd").value || "").trim());
    if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return { ok: false, now: now, msg: "Elige la hora a la que queréis terminar." };
    const t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(m[1]), Number(m[2]), 0, 0);
    if (t.getTime() <= now.getTime()) t.setDate(t.getDate() + 1);
    const diff = (t.getTime() - now.getTime()) / 60000, mins = Math.round(diff);
    const lo = new Date(now.getTime() + 5 * 60000), hi = new Date(now.getTime() + 120 * 60000);
    const rng = "Elige una hora entre las " + hm(lo) + " y las " + hm(hi) + ".";
    if (mins < 5) return { ok: false, now: now, t: t, mins: mins, msg: "Muy poco tiempo: la partida necesita al menos 5 min. " + rng };
    if (mins > 120) return { ok: false, now: now, t: t, mins: mins, msg: "Esa hora ya pasó o queda a más de 120 min. " + rng };
    return { ok: true, now: now, t: t, mins: mins, endAt: t.getTime() };
  }
  function hm(d) { return pad2(d.getHours()) + ":" + pad2(d.getMinutes()); }
  function refreshEnd() {
    const el = $("endInfo"), pe = parseEnd();
    if (!el) return;
    if (pe.ok) { el.className = "small endinfo"; el.textContent = "Son las " + hm(pe.now) + " · la partida durará unos " + pe.mins + " min · terminará a las " + hm(pe.t); }
    else { el.className = "small endinfo bad"; el.textContent = "Son las " + hm(pe.now) + " · " + pe.msg; }
    $("btnStart").disabled = !pe.ok;
  }

  function checkTimeUi() {
    const s = U.getState();
    if (!s || s.phase === "ending" || $("game").classList.contains("hidden")) return;
    if (s.timeAsk) { if (s.phase === "resolution" && !timeOverlayOpen()) showTimeAsk(); return; }
    if (!timeOverlayOpen() && $("overlay").classList.contains("hidden") && U.timeWarn()) showTimeWarn();
  }
  function showTimeWarn() {
    const o = timeOverlayEl(), b = $("timeBody");
    b.innerHTML = '<div class="tag">' + ic("ui_reloj", "ic-tag") + 'AVISO PARA TODA LA MESA</div><h2>La noche se acaba</h2>' +
      '<p class="small">Quedan unos 2 minutos. La ronda en curso se juega siempre entera; después la mesa decidirá si quiere más rondas o el desenlace.</p>' +
      '<div class="stack"><button class="primary" id="btnTwKeep">' + ic("ui_continuar") + '<span class="lbl">Seguir</span></button>' +
      (NET && !(U.getState().players[U.getState().youId] || {}).host ? '' : '<button class="ghost" id="btnTwAdd">' + ic("ui_reloj") + '<span class="lbl">Añadir tiempo</span></button>') + '</div>' + (NET && !(U.getState().players[U.getState().youId] || {}).host ? '<p class="small">Solo el anfitrión puede añadir tiempo.</p>' : '');
    $("btnTwKeep").onclick = function () { U.dismissWarn(); hideTimeOverlay(); };
    if ($("btnTwAdd")) $("btnTwAdd").onclick = function () { run(U.addTime(), function (r) { const ok = r && typeof r === "object" ? !!r.added : !!r; hideTimeOverlay(); if (NET && r && r.ok === false) { toast(r.msg || "No se pudo añadir tiempo.", true); return; } toast(ok ? "Tiempo añadido: la partida podrá alargarse una ronda." : "Ya se había añadido tiempo.", !ok); updateClock(); }); };
    o.classList.remove("hidden");
  }
  function showTimeAsk() {
    const s = U.getState(); if (!s || !s.timeAsk) return;
    const o = timeOverlayEl(), b = $("timeBody"), ta = s.timeAsk;
    b.innerHTML = '<div class="tag">' + ic("ui_reloj", "ic-tag") + 'SE ACABÓ EL TIEMPO</div><h2>¿Cómo seguís?</h2>' +
      '<p class="small">Habéis jugado ' + s.round + ' ronda' + (s.round === 1 ? "" : "s") + '. Cada ronda añadida es una ronda normal completa. Duraciones estimadas según vuestro ritmo.</p>' + (NET ? netVotesHTML(s) : "") +
      '<div class="stack">' + ta.opts.map(function (x) { return '<button class="primary" data-k="' + x.k + '">' + ic("ui_ronda") + '<span class="lbl">Añadir ' + x.k + ' ronda' + (x.k > 1 ? "s" : "") + ' (≈ ' + x.min + ' min' + (U.extEnd(x.k) ? ' · nueva hora de fin estimada: ' + U.hhmm(U.extEnd(x.k)) : '') + ')</span></button>'; }).join("") +
      '<button class="ghost" data-k="end">' + ic("ph_desenlace") + '<span class="lbl">Terminar ahora (desenlace)</span></button></div>';
    Array.prototype.forEach.call(b.querySelectorAll("button[data-k]"), function (btn) {
      btn.onclick = function () {
        const k = btn.getAttribute("data-k");
        run(U.answerTime(k === "end" ? "end" : Number(k)), function (r) {
          if (!r.ok) { if (NET && r.msg) toast(r.msg, true); return; } /* doble toque */
          if (NET && !r.ended && r.added === undefined) { toast("Voto enviado: decide el anfitrión.", false); showTimeAsk(); return; }
          hideTimeOverlay();
          if (r.ended) { renderEnding(r.ending || U.getEnding()); return; }
          toast("Se añade" + (r.added > 1 ? "n " : " ") + r.added + " ronda" + (r.added > 1 ? "s" : "") + ".", false);
          updateClock(); if (NET) routeNet(); else onNextRound();
        });
      };
    });
    o.classList.remove("hidden");
  }
  function turnPill() {
    let el = $("turnTimer");
    if (!el) { el = document.createElement("div"); el.id = "turnTimer"; el.className = "turntimer hidden"; el.setAttribute("aria-live", "off"); document.body.appendChild(el); }
    return el;
  }
  function armTurnTimer(p) {
    const s = U.getState(); if (!s || !p || p.dead || p.dying) return;
    const key = s.round + ":" + p.id;
    if (NET && U.clockDeadline) { turnKey = key; turnAuto = true; turnDeadline = U.clockDeadline("turn") || (Date.now() + U.turnSeconds() * 1000); } /* en línea el límite es del servidor, que además completa el turno */
    else if (key !== turnKey) { turnKey = key; turnDeadline = Date.now() + U.turnSeconds() * 1000; turnAuto = false; }
    clearInterval(turnIv); turnIv = setInterval(turnTick, 500); turnTick();
  }
  function stopTurnTimer() { clearInterval(turnIv); turnIv = null; const el = $("turnTimer"); if (el) el.classList.add("hidden"); }
  function turnTick() {
    if (NET && U.clockDeadline) { const dl = U.clockDeadline("turn"); if (dl) turnDeadline = dl; }
    const el = turnPill(), left = Math.ceil((turnDeadline - Date.now()) / 1000);
    el.classList.remove("hidden");
    el.classList.toggle("low", left <= 15);
    if (left > 0) { el.textContent = "Turno " + Math.floor(left / 60) + ":" + pad2(left % 60); return; }
    el.textContent = NET ? "Tiempo agotado: el servidor cerrará tu turno" : "Tiempo de turno agotado: decide ya";
    if (-left >= 25 && !turnAuto && $("overlay").classList.contains("hidden") && !timeOverlayOpen()) { turnAuto = true; autoTurn(); }
  }
  /* Pasado el tiempo + 25 s de cortesía: solo se completa lo que falta con la opción más segura; lo ya hecho se conserva. */
  function autoTurn() {
    const st = U.getState(), p = U.currentPlayer();
    if (!st || st.phase !== "private" || !p || p.dead || st.handoff) return;
    if (!$("prepPanel").classList.contains("hidden")) { toast("Se acabó el tiempo de tu turno: se omite la declaración.", false); onPrepSkip(); return; }
    pendingAction = null; pendingStake = null; pendingItem = null; pendingMode = null; pendingSpell = null; pendingStudy = null;
    if (!p.acted) {
      run(U.act(p.id, "meditar", null, null), function (r) {
        if (r.ok) {
          toast("Se acabó el tiempo de tu turno: has meditado (acción segura).", false); endTurn();
          /* Si aún queda un paso del mismo turno (declaración o encuentro), se completa también tras una breve cortesía de 15 s. */
          if (U.getState().phase === "private" && !U.getState().handoff && (!$("prepPanel").classList.contains("hidden") || !$("overlay").classList.contains("hidden"))) { turnAuto = false; turnDeadline = Date.now() - 10000; }
          return;
        }
        toast("Tiempo agotado: elige una acción cuanto antes.", true);
      });
      return;
    }
    endTurn();
  }

  function updateClock() {
    const s = U.getState();
    if (!s || s.phase === "ending") { $("clockPill").textContent = "0 min"; $("clockEnd").textContent = ""; return; }
    const left = U.timeLeftMs(), ea = U.endAtTs();
    $("clockEnd").textContent = ea ? "fin " + U.hhmm(ea) : "";
    if (left === Infinity) { $("clockPill").textContent = U.elapsedMin() + " min"; return; }
    const sec = Math.max(0, Math.ceil(left / 1000));
    $("clockPill").textContent = left <= 0 ? "Tiempo agotado" : pad2(Math.floor(sec / 60)) + ":" + pad2(sec % 60);
  }

  function armBack() { try { history.pushState({ umbral: 1 }, ""); } catch (e) { /* sin historial */ } }
  function enterGame(noRoute) {
    armBack();
    fxGame(true);
    $("start").classList.add("hidden");
    $("ending").classList.add("hidden");
    $("game").classList.remove("hidden");
    $("btnStatus").classList.remove("hidden");
    if (!noRoute) route();
  }

  function setStep(t) { const el = $("stepHint"); if (el) el.textContent = t || ""; }

  function hideAll() {
    ["privatePanel", "prepPanel", "councilPanel", "resolutionPanel", "handoff"].forEach(function (id) {
      $(id).classList.add("hidden");
    });
  }

  function route() {
    const s = U.getState();
    if (!s) return;
    if (NET) { routeNet(); return; }
    npcAdv();
    $("roundLabel").textContent = "RONDA " + s.round + "/" + U.maxRounds();
    updateClock();
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
    const chips = (hi.status || []).map(function (id) { return { k: "s_" + id, t: D.STATUS[id] ? D.STATUS[id].name : id }; });
    if (hi.shock && !chips.some(function (c) { return c.t === "Shock"; })) chips.push({ k: "s_shock", t: "Shock" });
    if (hi.dying) chips.unshift({ k: "s_moribundo", t: "Moribundo" });
    const vcls = hi.pct <= 30 ? "low" : hi.pct <= 60 ? "mid" : "good";
    if (p.focus) status.push({ k: "st_foco", t: "Foco +" + p.focus + " (−" + p.focus + " dificultad en tu próxima tirada)" });
    if (p.shield) status.push({ k: "i_coartada", t: "Coartada" });
    if (p.protection !== null) status.push({ k: "a_proteger", t: "Protegido" });
    if (p.roundDefense) status.push({ k: "a_resistir", t: "Defensa +" + p.roundDefense });
    if (p.roundAttack) status.push({ k: "a_enfrentar", t: "Ataque +" + p.roundAttack });
    const dm = U.domInfo(p);
    if (dm.level >= 1) status.push({ k: "t_sombras", t: "Dominio de las sombras: " + dm.name });
    (p.risen || []).forEach(function (id) { const sh = U.getState().players[id]; if (sh && sh.risenBy === p.id) status.push({ k: "a_alzar", t: "Sombra servidora: " + sh.name }); });
    let hearts = "";
    for (let i = 0; i < hi.max; i++) hearts += ic("st_vitalidad", i < hi.hp ? "" : "off");
    const zones = (hi.zones || []).map(function (z) {
      const lab = z.n ? " · " + z.nivel + (z.tipo ? " (" + z.tipo + ")" : "") : "";
      return '<span class="zone l' + Math.min(2, z.lvl) + '">' + ic("z_" + (z.id === "miembros" ? (z.part || "brazos") : z.id)) + esc(z.name + lab) + "</span>";
    }).join("");
    const attr = function (k, label, val) { return '<div class="attr f-' + famOf(k) + '"><span style="color:var(--ic)">' + ic(k) + "</span><b>" + val + "</b><span>" + label + "</span></div>"; };
    return '<div class="player">' +
      '<div class="srow"><span class="lab f-heal"><span style="color:var(--ic)">' + ic("st_virtud") + '</span>Virtud <b>' + p.virtue + '</b></span><span class="darkline">' + ic("st_sombra") + darkLine(p) + '</span></div>' +
      '<div class="meter"><span class="virtue" style="width:' + p.virtue + '%"></span></div>' +
      '<div class="srow"><span class="lab f-danger"><span style="color:var(--ic)">' + ic("st_vitalidad") + '</span>Vitalidad <b>' + hi.hp + '/' + hi.max + '</b></span></div>' +
      '<div class="hearts' + (hi.pct <= 30 || hi.dying ? " crit" : "") + '" aria-hidden="true">' + hearts + '</div>' +
      '<div class="zones">' + zones + '</div>' +
      (hi.urgentes && hi.urgentes.length && !hi.dying ? '<div class="hurt"><b>' + ic("s_herido") + 'Qué te pasa y qué hacer</b>' + (function () { let last = ""; return hi.urgentes.map(function (u) { const t = u.todo && u.todo !== last ? u.todo : ""; if (u.todo) last = u.todo; return '<div class="small">' + esc(u.text) + (t ? ' <i>→ ' + esc(t) + '</i>' : '') + '</div>'; }).join(""); })() + '</div>' : '') +
      (chips.length ? '<div class="chips">' + chips.map(function (c) { return '<span class="schip ' + (c.k === "s_fortalecido" ? "good" : "bad") + '">' + ic(c.k) + esc(c.t) + '</span>'; }).join("") + '</div>' : '') +
      '<div class="attrs">' + attr("st_cuerpo", "Cuerpo", p.stats.cuerpo) + attr("st_mente", "Mente", p.stats.mente) + attr("st_sombra", "Sombra", p.stats.sombra) + attr("st_objetos", "Objetos", p.items.length) + attr("st_pistas", "Pistas", p.clues.length) + '</div>' +
      practiceLine(p) +
      status.map(function (x) { return '<div class="stline">' + ic(x.k) + '<span>' + esc(x.t) + '</span></div>'; }).join("") +
      '</div>';
  }

  function renderPrivate() {
    stopTimer();
    hideAll();
    { const pt = U.currentPlayer(); armTurnTimer(pt); }
    $("privatePanel").classList.remove("hidden");
    const s = U.getState();
    const p = U.currentPlayer();
    $("phaseTag").textContent = "TURNO PRIVADO"; setPhaseIcon("ph_privado");
    $("screenTitle").textContent = NET ? "Tu turno" : "Turno de " + p.name;
    setStep(NET ? "Tu vista es privada." + (s.round === 1 ? " Elige UNA acción; antes de confirmar verás qué hace." : "")
      : (s.round === 1 ? "Información privada: que nadie mire. Elige UNA acción; antes de confirmar verás qué hace." : "Información privada: que nadie mire.") + (NET && U.readLeft && U.readLeft() > 0 ? " Lee la ronda: unos segundos antes de poder actuar sobre otros." : ""));
    $("privateName").textContent = p.name;
    $("privateAvatar").innerHTML = medal("r_" + p.role.id, "lg");
    $("privateRole").innerHTML = ic("r_" + p.role.id) + esc(p.role.name) + " · " + ic("f_" + p.affinity.id) + esc(p.affinity.name);
    { const sk0 = U.secretInfo(p.id); setIcoBtn($("btnSecret"), sk0 ? "x_" + sk0.id : "x_poder", "Mi secreto"); }
    const passives = [];
    const brief = s.round > 2;
    if (p.role.passive) passives.push("<b>" + esc(p.role.passive.name) + "</b>" + (brief ? "" : ": " + esc(p.role.passive.desc)));
    if (p.affinity.passive) passives.push("<b>" + esc(p.affinity.passive.name) + "</b>" + (brief ? "" : ": " + esc(p.affinity.passive.desc)));
    $("privatePassives").innerHTML = passives.length ? passives.join(" · ") : "";
    const gf = p.gift && p.gift.round === s.round ? p.gift.text : "";
    $("privateGear").className = "gearline" + (gf ? "" : " hidden"); $("privateGear").innerHTML = gf ? ic("st_objetos", "ic-md") + "<span>" + esc(gf) + "</span>" : "";
    $("privateStory").textContent = eventLine(s.event);
    renderEventBanner(s.event);
    const weakest = Object.keys(p.stats).sort(function (a, b) { return p.stats[a] - p.stats[b]; })[0];
    const offers = { cuerpo: "El Umbral te promete fuerza para que nadie vuelva a hacerte daño.", mente: "El Umbral te promete conocer los secretos de todos antes de que puedan ocultarlos.", sombra: "El Umbral te promete moverte sin ser visto y decidir quién merece caer." };
    const ttxt = p.alignment === "asesino" ? (p.exposed ? "Han descubierto tu identidad. Los supervivientes saben que eres el Asesino: tendrás que sobrevivir a su respuesta." : "Tu voluntad ya pertenece al Umbral. Elimina a tus adversarios antes de que te detengan.") : (s.assassinId === null && !(s.shadow && s.shadow.strikes > 0) ? "Susurro para ti: " + offers[weakest] + "" + (U.isUnlocked(p, D.ACTIONS.find(function (x) { return x.id === "ceder"; })) ? " Ceder puede darte poder, pero si te entregas lo suficiente y nadie se ha transformado, el Umbral te reclamará." : "") : "El Umbral ya tiene un Asesino. Decide si ayudas a detenerlo o buscas tu propia supervivencia.");
    $("privateTemptation").innerHTML = '<div class="nrow">' + medal(p.alignment === "asesino" ? "t_asesino" : "t_tentacion", "sm") + "<span>" + esc(ttxt) + "</span></div>";
    const cedeOpen = p.alignment !== "asesino" && s.assassinId === null && U.isUnlocked(p, D.ACTIONS.find(function (x) { return x.id === "ceder"; }));
    $("privateTemptation").classList.toggle("hidden", !!p.dead || !(s.round === 1 || (p.alignment === "asesino" && p.exposed) || (cedeOpen && s.round % 2 === 1)));
    renderSince(p);
    renderPacts(p);
    renderAdvice(p);
    renderOffer(p);
    fxIn($("privateOffer"), "of:" + s.round + ":" + p.id);
    fxIn($("eventBanner"), "ev:" + s.round + ":" + p.id);
    fxIn($("privateGear"), "gf:" + s.round + ":" + p.id);
    renderHand(p);
    renderPactOffers(p);
    const fresh = U.unlockNotices(p);
    if (fresh.length) toast(fresh.length > 2 ? "Se te abren " + fresh.length + " acciones nuevas (mira «Más acciones»; las intuiciones quedan en tu ficha)." : fresh.join(" "), false);
    $("privateStats").innerHTML = statsHTML(p);
    fxHp(p, document.querySelector("#privateStats .hearts"));
    renderSheet(p);
    renderActions(p);
    updateStatus();
    renderedSig = U.sig;
    fxTurn(p, p.dead ? null : U.getOffer(p.id));
  }

  function pactsHTML(list) {
    return list.map(function (x) {
      return '<div class="stline">' + ic("p_" + String(x.type).replace("pacto_", "")) + '<span><b>Pacto de ' + esc(x.label) + '</b> con ' + esc(x.other) + (x.thisRound ? ' · se evalúa al final de esta ronda' : ' · se evalúa al final de la próxima') + '<br>' + esc(x.terms) + '</span></div>';
    }).join("");
  }
  function renderSince(p) {
    const box = $("sinceBox"); if (!box) return;
    const d = p.dead ? null : U.getSince(p.id);
    if (!d) { box.classList.add("hidden"); box.innerHTML = ""; return; }
    const wtxt = d.hpNow === d.hpFrom ? "" : '<div class="small"><b>Vitalidad: ' + d.hpFrom + " → " + d.hpNow + "</b></div>";
    box.classList.remove("hidden");
    box.innerHTML = tagH("DESDE TU ÚLTIMO TURNO", "ui_ronda") + wtxt + d.notes.map(function (n) { return '<div class="small">• ' + esc(n.replace(/^Ronda \d+: /, "")) + "</div>"; }).join("") + (d.more ? '<div class="small muted">…y ' + d.more + " más en tu ficha.</div>" : "");
  }
  function renderPacts(p) {
    const box = $("pactBox"); if (!box) return;
    const l = p.dead ? [] : U.activePacts(p.id);
    if (!l.length) { box.classList.add("hidden"); box.innerHTML = ""; return; }
    box.classList.remove("hidden");
    box.innerHTML = tagH("PACTOS VIGENTES", "p_pacto") + pactsHTML(l) + '<div class="small muted">Cumplirlo: +3 virtud a ambos. Romperlo: −6 virtud, +8 corrupción.</div>';
  }

  /* Consejo para jugadores perdidos: se puede cerrar o silenciar para siempre. */
  const advClosed = {}, advShown = {};
  function adviceOff() { try { return localStorage.getItem("umbral_noadvice") === "1"; } catch (e) { return false; } }
  function adviceFor(p) {
    const s = U.getState(), did = p.did || {};
    const total = Object.keys(did).reduce(function (a, k) { return a + did[k]; }, 0);
    const top = Object.keys(did).sort(function (a, b) { return did[b] - did[a]; })[0];
    const hi = U.healthInfo(p);
    if (!hi.dying && (hi.hp <= hi.max * 0.4 || hi.shock)) return { id: "vitalidad", text: "Tu vitalidad está baja (" + hi.hp + "/" + hi.max + ") y puedes desmayarte. Cúbrete: Proteger, Descansar o un objeto de curación te mantienen en pie." };
    const dyingMate = !hi.dying && s.players.find(function (x) { return x.id !== p.id && x.dying && !x.dead; });
    if (dyingMate) return { id: "socorro" + dyingMate.id, text: dyingMate.name + " está moribundo y " + dyingDeadline(dyingMate) + ". Usa Socorrer en tu turno." };
    if (p.corr >= 40 && !did.meditar) return { id: "corr", text: "Notas que la oscuridad te gana terreno. Meditar la aleja y también devuelve virtud." };
    if (s.round >= 3 && total >= 3 && top && did[top] >= total && total >= 3) return { id: "repite", text: "Llevas toda la partida haciendo lo mismo. Probar otra acción te enseña cosas nuevas y desbloquea más opciones." };
    if (s.round >= 2 && p.items.length >= 3) return { id: "objetos", text: "Tienes varios objetos guardados. Mira tu ficha: algunos protegen, curan o dan ventaja en una acción." };
    if (s.round >= 3 && p.clues.length >= 3) return { id: "pistas", text: "Has reunido varias pistas. Léelas en tu ficha y úsalas en el consejo para acusar o defenderte." };
    if (s.round >= 2 && total === 0) return { id: "nada", text: "Aún no has hecho nada. Si no eliges acción, la ronda pasa sin que avances. Prueba Explorar o Investigar." };
    return null;
  }
  function renderAdvice(p) {
    const box = $("adviceBox"); if (!box) return;
    let a = (p.dead || adviceOff()) ? null : adviceFor(p);
    const crit = a && (a.id === "vitalidad" || a.id.indexOf("socorro") === 0);
    const akey = a ? p.id + a.id + p.name : "";
    if (a && !crit) { const sr = U.getState().round; if (advShown[akey] === undefined) advShown[akey] = sr; else if (advShown[akey] !== sr) a = null; }
    if (!a || advClosed[akey]) { box.classList.add("hidden"); box.innerHTML = ""; return; }
    box.classList.remove("hidden");
    box.innerHTML = tagH("CONSEJO", "ui_pista") + '<p class="small">' + esc(a.text) + '</p>' +
      '<div class="row"><button class="ghost smallbtn" id="advClose">' + ic("ui_cerrar") + 'Cerrar</button></div>';
    $("advClose").onclick = function () { advClosed[p.id + a.id + p.name] = 1; renderAdvice(p); };
  }

  function renderOffer(p) {
    const box = $("privateOffer");
    const o = p.dead ? null : U.getOffer(p.id);
    if (!o || o.done) { box.classList.add("hidden"); box.innerHTML = ""; return; }
    if (o.id === "asesino") {
      box.classList.remove("hidden");
      box.innerHTML = tagH(o.title, "t_asesino") + '<p class="small">' + esc(o.text) + '</p>' +
        '<p class="small"><b>Ganas</b></p>' + o.gains.map(function (g) { return '<div class="stline"><span class="f-heal" style="color:var(--ic)">' + ic("ui_exito") + '</span><span>+ ' + esc(g) + '</span></div>'; }).join("") +
        '<p class="small"><b>Pierdes</b></p>' + o.losses.map(function (g) { return '<div class="stline"><span class="f-danger" style="color:var(--ic)">' + ic("ui_fallo") + '</span><span>− ' + esc(g) + '</span></div>'; }).join("") +
        '<p class="small muted">Sin responder, cuenta como rechazo.</p>' +
        '<div class="row"><button class="danger smallbtn" id="offerYes">' + ic("t_asesino") + 'Convertirme en Asesino</button><button class="primary smallbtn" id="offerNo">' + ic("a_resistir") + 'Rechazar</button></div>';
      $("offerYes").onclick = function () { mutFx(U.answerOffer(p.id, true), "close", "dark"); };
      $("offerNo").onclick = function () { mut(U.answerOffer(p.id, false)); };
      return;
    }
    const pressure = p.pressure || 0;
    const refuse = o.refuse ? "Rechazar: +2 virtud, pero el Umbral no olvida." : "Rechazar: +2 virtud.";
    box.classList.remove("hidden");
    box.innerHTML = tagH("TRATO DEL UMBRAL", "t_umbral") + '<p class="small">' + esc(o.text) + '</p>' +
      '<p class="small muted">Aceptar tiene un precio oculto. ' + refuse +
      ' Sin responder, cuenta como rechazo.</p>' +
      '<div class="row"><button class="primary smallbtn" id="offerYes">' + ic("ui_ok") + 'Aceptar</button><button class="ghost smallbtn" id="offerNo">' + ic("ui_cerrar") + 'Rechazar</button></div>';
    $("offerYes").onclick = function () { mutFx(U.answerOffer(p.id, true), "seal", "dark"); };
    $("offerNo").onclick = function () { mut(U.answerOffer(p.id, false)); };
  }

  let showMagicHelp = false;
  const magicSeen = {};
  function renderSheet(p) {
    const items = p.items.length ? p.items.map(function (it, i) {
      const def = D.ITEMS[it.id];
      const left = def.uses && def.uses > 1 ? ' <span class="small uses">(' + (it.left === undefined ? def.uses : it.left) + ' usos)</span>' : "";
      return '<div class="itemrow">' + medal("i_" + it.id, "md") + '<div class="ibody"><b>' + esc(def.name) + '</b>' + left + '<div class="small">' + esc(def.desc) + '</div></div>' +
        (def.kind === "weapon" ? '<span class="small">Se usa desde una acción</span>' : def.kind === "passive" ? '<span class="small">Pasivo: actúa solo</span>' : '<button class="ghost smallbtn" data-item="' + i + '"' + (p.usedItem ? " disabled" : "") + '>' + ic("ui_ok") + 'Usar</button>') + '</div>';
    }).join("") : "";
    const itemsBlock = items ? (p.items.length >= 4
      ? '<details class="items"><summary>' + ic("st_objetos") + 'Objetos (' + p.items.length + ')</summary>' + items + '</details>'
      : h3i("Objetos", "st_objetos") + items) + (p.usedItem ? '<p class="small muted">Ya has usado un objeto esta ronda.</p>' : '') : '';
    const clues = p.clues.length ? p.clues.map(function (c) {
      return '<div class="clue">' + ic("st_pistas") + '<span><span class="tag">FUERZA ' + c.strength + '</span> ' + esc(c.text) + '</span></div>';
    }).join("") : "";
    const hints = (p.hints || []).slice(-4);
    const hintSet = {}; (p.hints || []).forEach(function (t) { hintSet[t] = 1; });
    const notes = p.notes.filter(function (n) { return !hintSet[n.replace(/^Ronda \d+: /, "")]; }).slice(-4);
    const sts = (p.status || []).length ? p.status.map(function (s) { return '<div class="stline">' + ic("s_" + s.id) + '<span><b>' + esc(D.STATUS[s.id].name) + '</b> (' + s.left + " ronda" + (s.left > 1 ? "s" : "") + "): " + esc(D.STATUS[s.id].desc) + '</span></div>'; }).join("") : "";
    const hasMagic = (p.spells && p.spells.length) || (p.items || []).some(function (i) { return i.id === "grimorio"; });
    if (p.spells && p.spells.length && !magicSeen[p.id]) { magicSeen[p.id] = 1; showMagicHelp = true; }
    $("sheetSum").innerHTML = ic("ui_jugador") + "<span>" + "Tu ficha" + (p.items.length ? " · " + p.items.length + " obj." : "") + (p.clues.length ? " · " + p.clues.length + " pista" + (p.clues.length > 1 ? "s" : "") : "") + ((p.spells || []).length ? " · " + p.spells.length + " conjuro" + (p.spells.length > 1 ? "s" : "") : "") + "</span>";
    $("sheetBody").innerHTML =
      umbralHTML(p, false) + secretHTML(p) +
      (sts ? h3i("Estados", "s_herido") + sts : '') +
      itemsBlock +
      ((p.leads || []).length ? h3i("", "st_indicio", 'Indicios <span class="small muted">· rastros veraces, sin autor</span>') + p.leads.map(function (l) { return '<div class="clue">' + ic("a_" + ({ golpe: "apunalar", marca: "maldecir", sintomas: "envenenar", mecanismo: "trampa", objeto: "sabotear" }[l.sig] || "indagar")) + '<span><span class="tag">RONDA ' + l.round + '</span> ' + esc(l.text) + '</span></div>'; }).join("") : '') +
      (clues ? h3i("", "st_pistas", 'Pistas <span class="small muted">· la fuerza pesa al acusar</span>') + clues : '') +
      spellsHTML(p, hasMagic) +
      (hints.length ? h3i("Intuiciones", "ui_pista") + '<div class="notice small">' + hints.map(function (t) { return esc(t); }).join("<br>") + '</div>' : '') +
      (notes.length ? h3i("Notas", "ui_log") + '<div class="notice small">' + notes.map(function (n) { return esc(n); }).join("<br>") + '</div>' : '');
    Array.prototype.forEach.call($("sheetBody").querySelectorAll("[data-item]"), function (b) {
      b.onclick = function () { onUseItem(Number(b.getAttribute("data-item"))); };
    });
    const mh = $("sheetBody").querySelector("[data-magichelp]");
    if (mh) mh.onclick = function () { showMagicHelp = !showMagicHelp; const wasOpen = $("playerInteractions").open; renderSheet(p); $("playerInteractions").open = wasOpen; };
  }

  const SHORT = { atender: "Cortas su sangrado o infección", investigar: "Pistas sobre alguien", proteger: "Cubres a otro", explorar: "Objetos y pistas", meditar: "Calma la oscuridad y repone un conjuro", robar: "Quitas un objeto", hechizar: "Magia sucia, con pista", apostar: "Riesgo por premio", ceder: "Poder a cambio de alma", resistir: "Rechazas el poder", cazar: "Ataque secreto", apunalar: "Golpe con tu daga", envenenar: "Veneno retardado", trampa: "Salta la ronda siguiente", sabotear: "Su objeto fallará", maldecir: "Estorba sus tiradas", aturdir: "Pierde su turno", devorar: "Canibalismo", descansar: "Recuperas vitalidad", entrenar: "+1 a tus tiradas", tender: "Ayuda secreta", conjurar: "Lanzas un conjuro", socorrer: "Salvas a un moribundo", indagar: "Rastros de heridas y muertes recientes", bendecir: "Limpias oscuridad y te curas", sombra_espia: "Una pista, por la vía de las sombras", sombra_guarda: "Defensa con sombras", sombra_hostiga: "Maldices y manchas a alguien", alzar: "Un caído trabaja para ti" };

  /* Acciones aún cerradas (misma lista y requisitos para todos los jugadores; solo lo que el motor declara consultable). */
  function lockedRows(p) {
    if (!U.lockedList) return [];
    const out = [];
    (U.lockedList(p) || []).forEach(function (x) {
      const a = D.ACTIONS.find(function (q) { return q.id === x.id; }); if (!a) return;
      const row = document.createElement("div"); row.className = "lockrow small";
      const pr = function (r) { return esc(r.req) + " " + r.have + "/" + r.need; };
      let det = x.all && x.alt && x.alt.length > 1 ? x.alt.map(pr).join(" y ") : pr(x);
      if (x.id === "alzar") det += " · y hace falta un caído al que alzar";
      row.style.cssText = "opacity:.6;display:flex;gap:8px;align-items:center;padding:6px 8px;border:1px dashed currentColor;border-radius:8px;margin:4px 0";
      row.innerHTML = medal("a_" + a.id, "sm") + '<span><b>' + esc(a.name) + '</b> — ' + det + '</span>';
      out.push(row);
    });
    return out;
  }

  /* Plazo real de un moribundo: muere al empezar la ronda siguiente a «dyingUntil». */
  function dyingDeadline(x) {
    const s = U.getState();
    const until = x.dyingUntil !== undefined ? x.dyingUntil : (x.dyingRound || s.round) + (x.dyingFast ? 0 : 1);
    return until <= s.round ? "muere si nadie lo socorre antes de que acabe ESTA ronda" : until === s.round + 1 ? "muere si nadie lo socorre antes de que acabe la próxima ronda" : "muere si nadie lo socorre antes de que acabe la ronda " + until;
  }
  function renderActions(p) {
    const box = $("actionChoices");
    if (pendingStudy) { renderStudyPicker(p); return; }
    if (pendingSpell) { renderSpellPicker(p); return; }
    if (pendingMode) { renderModePicker(p); return; }
    if (pendingAction) { renderTargetPicker(p); return; }
    if (pendingStake) { renderStakePicker(p); return; }
    if (pendingItem !== null) { renderItemTargetPicker(p); return; }

    box.className = "actions";
    box.innerHTML = "";
    const va = U.visibleActions(p);
    va.main = (va.main || []).filter(Boolean); va.more = (va.more || []).map(function (g) { return { id: g.id, label: g.label, acts: (g.acts || []).filter(Boolean) }; }).filter(function (g) { return g.acts.length; });
    const na = p.newAct || {}, round = U.getState().round;
    const mkTile = function (a) {
      const od = a.risk && !a.gamble && a.attr ? U.actionOdds(p.id, a.id) : null;
      const prob = od ? od.prob : null;
      const isNew = na[a.id] !== undefined && na[a.id] >= round - 1;
      const chip = isNew ? "NUEVA" : (a.gamble ? "ENVITE" : (prob !== null ? prob + "%" : ""));
      const chipCls = isNew ? "good" : a.gamble ? "risk" : prob === null ? "risk" : prob >= 70 ? "good" : prob >= 45 ? "mid" : "low";
      const btn = document.createElement("button");
      btn.className = "tile" + (a.hostile ? " hostile" : "") + (isNew ? " isnew" : "");
      btn.innerHTML = medal("a_" + a.id, "lg") + '<span class="tileName">' + esc(a.name) + '</span>' + '<span class="small tileShort">' + esc(SHORT[a.id] || "") + '</span>' + (chip ? '<span class="chip ' + chipCls + '">' + chip + '</span>' : '');
      btn.onclick = function () { openActionSheet(a); };
      return btn;
    };
    D.ACTIONS.filter(function (a) { return na[a.id] === round && U.isUnlocked(p, a); }).forEach(function (a) {
      const n = document.createElement("div"); n.className = "notice small";
      n.innerHTML = '<div class="nrow">' + medal("a_" + a.id, "sm") + '<span><b>Acción nueva: ' + esc(a.name) + '.</b> ' + esc(a.desc) + (va.main.indexOf(a) === -1 ? ' (la encuentras en «Más acciones»)' : '') + '</span></div>';
      box.appendChild(n);
    });
    /* Urgencia: alguien moribundo en la mesa. Misma lógica para todos; no oculta nada. */
    const socA = va.main.find(function (x) { return x.id === "socorrer"; });
    const dyers = socA && !p.dying ? U.getState().players.filter(function (x) { return x.id !== p.id && x.dying && !x.dead; }) : [];
    dyers.forEach(function (x) {
      const n = document.createElement("div"); n.className = "notice small urgent";
      n.innerHTML = '<div class="nrow">' + medal("a_socorrer", "sm") + '<span><b>LO MÁS ÚTIL AHORA: socorrer a ' + esc(x.name) + '.</b> Está moribundo y ' + esc(dyingDeadline(x)) + '. <button class="primary smallbtn" data-soc="1">' + ic("a_socorrer") + 'Socorrer a ' + esc(x.name) + '</button></span></div>';
      n.querySelector("[data-soc]").onclick = function () { openActionSheet(socA); };
      box.appendChild(n);
    });
    const grid = document.createElement("div");
    grid.className = "actions grid3";
    va.main.slice().sort(function (x, y) { return (dyers.length && y.id === "socorrer" ? 1 : 0) - (dyers.length && x.id === "socorrer" ? 1 : 0); }).forEach(function (a) { const t = mkTile(a); if (dyers.length && a.id === "socorrer") t.classList.add("urgenttile"); grid.appendChild(t); });
    box.appendChild(grid);
    const locked = lockedRows(p);
    if (va.hidden || locked.length) {
      const tog = document.createElement("button");
      tog.className = "ghost smallbtn";
      tog.innerHTML = va.more.map(function (g) { return ic(GROUP_ICON[g.id]); }).join("") + '<span>' + (showMoreActs ? "Ocultar" : va.hidden ? "Más acciones" : "Por desbloquear") + " (" + (va.hidden || locked.length) + ")</span>";
      tog.onclick = function () { showMoreActs = !showMoreActs; renderPrivate(); };
      box.appendChild(tog);
      if (showMoreActs) {
        va.more.forEach(function (g) {
          const h = document.createElement("div"); h.className = "grouphead"; h.innerHTML = ic(GROUP_ICON[g.id]) + '<div class="tag"></div>'; h.querySelector(".tag").textContent = g.label.toUpperCase(); box.appendChild(h);
          const gg = document.createElement("div"); gg.className = "actions grid3";
          g.acts.forEach(function (a) { gg.appendChild(mkTile(a)); });
          box.appendChild(gg);
        });
        if (locked.length) {
          const h = document.createElement("div"); h.className = "grouphead"; h.innerHTML = '<div class="tag">POR DESBLOQUEAR</div>'; box.appendChild(h);
          locked.forEach(function (r) { box.appendChild(r); });
        }
      }
    }
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
    else if (od) meta = "Probabilidad de ÉXITO: " + od.prob + "% (fallas un " + (100 - od.prob) + "%). Tirada: d6 + " + a.attr + " " + od.bonus + " contra dificultad " + od.diff + ((a.hostile || a.harm) ? " (+1 si la víctima está protegida)" : "") + ". Un 6 siempre sale bien y un 1 siempre falla." + (od.mods.length ? " Influye: " + od.mods.join(", ") + "." : "");
    else if (a.risk) meta = "Tirada con riesgo: puede salir mal.";
    else if (a.harm) meta = "Sin tirada: colocarla no falla, pero a quién alcanza depende de quién se mueva. Riesgo para ti: puedes caer tú.";
    else meta = "Sin tirada. El efecto está garantizado.";
    if (a.target) meta += " Después eliges a quién afecta.";
    if (a.id === "indagar" && U.indagarInfo) { const li = U.indagarInfo(p.id); meta += li.avail ? " Hay " + li.avail + " rastro" + (li.avail > 1 ? "s" : "") + " que examinar" + (li.per > 1 ? " (aquí sacas " + li.per + " pistas de golpe)" : "") + "." : " Ahora mismo no hay rastros que examinar."; }
    $("actionSheetIcon").innerHTML = medal("a_" + a.id, "xl");
    $("actionSheetTag").textContent = a.tag;
    $("actionSheetTitle").textContent = a.name;
    $("actionSheetDesc").textContent = a.desc;
    $("actionSheetLore").textContent = a.lore ? "«" + a.lore + "»" : "";
    $("actionSheetMeta").textContent = meta;
    setLbl($("btnActionChoose"), "Elegir");
    $("actionOverlay").classList.remove("hidden");
  }

  function openInfoSheet(tag, title, desc, meta, label, fn, iconKey) {
    sheetAction = { __confirm: fn };
    $("actionSheetIcon").innerHTML = iconKey ? medal(iconKey, "xl") : "";
    $("actionSheetTag").textContent = tag;
    $("actionSheetTitle").textContent = title;
    $("actionSheetDesc").textContent = desc;
    $("actionSheetLore").textContent = "";
    $("actionSheetMeta").textContent = meta;
    setLbl($("btnActionChoose"), label);
    $("actionOverlay").classList.remove("hidden");
  }

  const MAGIA_VIAS = 'Cómo se aprende magia: (1) Estudiar un grimorio desde tu ficha (se encuentran Explorando, en eventos y en tratos): aprendes un conjuro nuevo o perfeccionas uno que ya sabes, y el saber prohibido te cuesta +3 oscuridad. (2) Meditar: si no sabes ninguno, el silencio te enseña uno defensivo sencillo (una vez). (3) Practicar: cada conjuro sube de nivel con sus éxitos: Aprendiz, Practicante (1 éxito), Dominado (2) y Maestro (4). (4) Nivel 2: si eres Practicante en un conjuro de una escuela, al estudiar un grimorio puede asomar un conjuro intermedio de esa escuela; se resuelve al caer la noche y pesa el doble en tu tope de conjuros (máx. 4 conjuros y 5 de peso).';
  /* Forma + aspecto del conjuro como medallón doble (la maestría va aparte, con su icono). */
  function spIconForm(sp) { const S = D.SPELL_SCHOOLS; return (S && S.icon && S.icon[sp.form]) || sp.form; }
  function spellMedals(sp) { const k = "sp_" + spIconForm(sp); return '<span class="medal md ' + "f-" + famOf(k) + '" aria-hidden="true">' + ic(k) + '</span>'; }
  function tierOf(sp) { const S = D.SPELL_SCHOOLS; return (S && S.tier && S.tier[sp.form]) || 1; }
  function tierChip(sp) { const t = tierOf(sp); return '<span class="chip ' + (t > 1 ? "good" : "mid") + '">' + (t > 1 ? "Nivel 2 · intermedio" : "Nivel 1 · básico") + '</span>'; }
  function spellMinis(sp) {
    const pr = U.spellProgress(sp);
    return '<span class="minis">' + medal("as_" + sp.aspect, "sm") + medal("m_" + pr.level, "sm") + (sp.kind === "off" ? medal("a_enfrentar", "sm", "danger") : medal("a_proteger", "sm", "guard")) + '</span>';
  }
  function spellsHTML(p, hasMagic) {
    if (!hasMagic) return "";
    const grim = (p.items || []).some(function (i) { return i.id === "grimorio"; });
    const list = (p.spells || []).map(function (sp) {
      const pr = U.spellProgress(sp);
      return '<div class="spellrow">' + spellMedals(sp) + '<div class="small"><b>' + esc(sp.name) + '</b> <span class="chip mid">' + ic("m_" + pr.level, "ic-sm") + " " + esc(pr.label) + '</span> <span class="chip mid">' + esc(schoolOf(sp)) + '</span> ' + tierChip(sp) + '<br>' + (sp.kind === "off" ? "Ofensivo" : "Defensivo") + ' · ' + sp.uses + ' uso' + (sp.uses > 1 ? "s" : "") + '</div></div>';
    }).join("");
    return h3i("Conjuros", "a_conjurar") + (list || '<p class="small">Aún no conoces ninguno.</p>') +
      (grim ? '<p class="small">Tienes un grimorio: púlsalo en Objetos para estudiarlo.</p>' : '') +
      '<button class="ghost smallbtn" data-magichelp="1">' + ic("ui_ayuda") + (showMagicHelp ? "Ocultar ayuda" : "¿Cómo funciona la magia?") + '</button>' +
      (showMagicHelp ? '<div class="notice small">' + esc(MAGIA_VIAS) + (p.spells && p.spells.length ? '<br>' + p.spells.map(function (sp) { return '<b>' + esc(sp.name) + '</b>: ' + esc(sp.desc) + ' ' + esc(U.spellProgress(sp).next); }).join('<br>') : '') + '</div>' : '');
  }

  /* ---------- reto de pulso (opcional) ----------
     Mismo reto, misma ventana y misma forma para TODAS las acciones. Local: el bonus se calcula en el móvil (partida entre amigos con
     un solo dispositivo). En línea: el servidor emite la semilla y recalcula la puntuación con la traza de toques; aquí solo se juega. */
  const SK = window.UmbralSkill;
  function skillOff() {
    try { const v = localStorage.getItem("umbral_noskill"); if (v === "1") return true; if (v === "0") return false; } catch (e) { /* sin almacenamiento */ }
    try { const s = !NET && U.getState(); return !!(s && s.players && s.players.length >= 6); } catch (e) { return false; }   /* mesas locales grandes: desactivado por defecto */
  }
  function skillSet(off) { try { localStorage.setItem("umbral_noskill", off ? "1" : "0"); } catch (e) { /* nada */ } }
  let skillBusy = false;
  function withSkill(cb) {
    if (!SK || skillOff() || skillBusy) { cb(undefined); return; }
    if (NET) {
      if (typeof U.challenge !== "function") { cb(undefined); return; }
      skillBusy = true;
      run(U.challenge(), function (r) { skillBusy = false; if (!r || !r.ok || !r.seed) { cb(undefined); return; } playSkill(r.seed, cb); });
    } else playSkill(1 + Math.floor(Math.random() * 2147483646), cb);
  }
  function playSkill(seed, cb) {
    const pl = SK.plan(seed), ov = $("skillOverlay"), W = SK.CFG.windowMs, taps = [];
    let t0 = performance.now(), raf = 0, done = false;
    const zone = $("skillZone"), needle = $("skillNeedle"), st = $("skillStatus");
    $("skillInfo").textContent = "Toca cuando la aguja esté sobre la zona clara (2 toques). Acertar suma hasta +15 puntos a tu probabilidad; fallar del todo resta 6. Al estudiar, un buen pulso reduce la oscuridad que te cuesta y uno torpe la sube. Si omites, queda lo normal.";
    function setZone() { const c = pl.centers[Math.min(taps.length, pl.centers.length - 1)]; zone.style.left = ((c - SK.CFG.width / 2) * 100) + "%"; zone.style.width = (SK.CFG.width * 100) + "%"; st.textContent = "Toque " + (taps.length + 1) + " de " + SK.CFG.taps; }
    function finish(skillArg, msg) {
      if (done) return; done = true; cancelAnimationFrame(raf);
      if (msg) { st.textContent = msg; setTimeout(function () { ov.classList.add("hidden"); cb(skillArg); }, 900); } else { ov.classList.add("hidden"); cb(skillArg); }
    }
    function frame() {
      if (done) return;
      const t = performance.now() - t0;
      needle.style.left = (SK.pos(pl, t) * 100) + "%";
      $("skillTime").style.width = Math.max(0, 100 - (t / W) * 100) + "%";
      if (t >= W) { finish(undefined, "Se acabó el tiempo: probabilidad normal."); return; }
      raf = requestAnimationFrame(frame);
    }
    $("btnSkillTap").onclick = null;
    $("btnSkillTap").onpointerdown = function (e) {
      if (done) return; e.preventDefault();
      taps.push(Math.round(performance.now() - t0));
      if (taps.length < SK.CFG.taps) { setZone(); return; }
      const s = SK.score(seed, taps);
      if (s == null) { finish(undefined, "Toques demasiado rápidos: probabilidad normal."); return; }
      const d = SK.delta(s);
      finish(NET ? taps : d, "Pulso " + (s >= 0.8 ? "muy firme" : s >= 0.5 ? "firme" : s >= 0.25 ? "dudoso" : "torpe") + " (" + (d > 0 ? "+" : "") + d + " puntos).");
    };
    $("btnSkillTap").onkeydown = function (e) { if (e.key === " " || e.key === "Enter") { e.preventDefault(); $("btnSkillTap").onpointerdown(e); } };
    $("btnSkillSkip").onclick = function () { finish(undefined); };
    setZone(); ov.classList.remove("hidden"); t0 = performance.now(); raf = requestAnimationFrame(frame);
  }
  function skillWire() {
    const b = $("btnSkillToggle"); if (!b) return;
    const lbl = function () { setLbl(b, skillOff() ? "Retos de pulso: desactivados" : "Retos de pulso: activados"); };
    b.onclick = function () { skillSet(!skillOff()); lbl(); toast(skillOff() ? "Retos de pulso desactivados: siempre probabilidad normal." : "Retos de pulso activados."); };
    $("btnHelp").addEventListener("click", lbl);
  }

  const MODES = [
    ["cauto", "Con cautela", "Más fácil (−1 dificultad) y, si falla, no gastas el uso. A cambio, sin extras: potencia base."],
    ["normal", "Normal", "Tal cual está escrito."],
    ["desatado", "Desatado", "Más potente (+1) y deja un estallido visible, pero más difícil (+1), te mancha (+3 oscuridad) y si falla te estalla en las manos (2 de daño)."]
  ];
  function doCast(spellId, targetId, mode) {
    withSkill(function (sk) { doCastGo(spellId, targetId, mode, sk); });
  }
  function doCastGo(spellId, targetId, mode, sk) {
    const p = U.currentPlayer(), hp0 = p.hp;
    run(U.cast(p.id, spellId, targetId, mode, sk), function (res) {
      if (!res.ok) { if (NET && U.currentPlayer().acted) { endTurn(); return; } $("actionHint").textContent = onl(res.msg); return; }
      pendingSpell = null;
      const p2 = U.currentPlayer(), sp = (p2.spells || []).find(function (x) { return x.id === spellId; }) || (p.spells || []).find(function (x) { return x.id === spellId; });
      const o = fxActionOpts({ id: "conjurar" }, res, hp0, p2);
      if (sp) {
        const af = ASP_FAM[sp.aspect] || "lore";
        o.fx = sp.kind === "off" ? { name: "flash", fam: af, ok: !fxFailed(res), cls: sp.aspect === "vacio" ? "vac" : "" }
          : (sp.form === "sanar" || sp.form === "purga" || sp.form === "aurora") ? { name: "glow", fam: "heal", ok: !fxFailed(res) } : { name: "shield", fam: af, ok: !fxFailed(res) };
      }
      showRoll({ title: "CONJURO", icon: "a_conjurar", result: res, text: res.outcome, fx: o.fx, hit: o.hit, heal: o.heal, dying: o.dying, buttons: [{ label: "Continuar", cls: "primary", onClick: endTurn }] });
    });
  }
  function schoolOf(sp) { const S = D.SPELL_SCHOOLS; return S ? (S.names[S.of[sp.form]] || "Umbral") : "Umbral"; }
  function spellLine(sp, info) {
    return '<span class="small">' + (sp.kind === "off" ? "Ofensivo" : "Defensivo") + ' · ' + esc(sp.desc) + '</span>' +
      '<span class="small">Escuela de ' + esc(schoolOf(sp)) + ' · ' + (tierOf(sp) > 1 ? "nivel 2 (intermedio): se resuelve al caer la noche" : "nivel 1 (básico): efecto inmediato") + '</span><span class="small">Usa tu ' + esc(info.attr) + ' · ' + sp.uses + ' uso' + (sp.uses > 1 ? "s" : "") + ' · ' + esc(U.spellProgress(sp).label) + '</span>';
  }
  function probChip(prob) {
    return ' <span class="chip ' + (prob >= 70 ? "good" : prob >= 45 ? "mid" : "low") + '">' + prob + '% éxito</span>';
  }

  function renderSpellPicker(p) {
    const box = $("actionChoices");
    box.className = "actions";
    box.innerHTML = "";
    $("actionHint").classList.remove("hidden");
    const ps = pendingSpell;
    const sp0 = ps.id !== null ? (p.spells || []).find(function (x) { return x.id === ps.id; }) : null;
    if (sp0 && sp0.target && ps.tid == null) {
      $("actionHint").textContent = "¿Sobre quién recae el conjuro?";
      U.getState().players.filter(function (x) { return x.id !== p.id && !x.dead; }).forEach(function (t) {
        const info = U.spellInfo(p.id, sp0.id, t.id, "normal");
        const btn = document.createElement("button");
        btn.className = "choice";
        btn.innerHTML = playerMedal(t) + '<span class="cbody"><b>' + dn(t) + (info ? probChip(info.prob) : '') + '</b><span class="small">' + esc(U.visibleHealth(t)) + '</span></span>';
        btn.onclick = function () { pendingSpell = { id: sp0.id, tid: t.id }; renderPrivate(); };
        box.appendChild(btn);
      });
      addCancel(box);
      return;
    }
    if (sp0) {
      $("actionHint").textContent = "¿Cómo lo lanzas, " + p.name + "? Cuanto más empujas, más pagas. Los porcentajes son tuyos y reales.";
      MODES.forEach(function (m) {
        const info = U.spellInfo(p.id, sp0.id, ps.tid, m[0]);
        if (!info) return;
        const btn = document.createElement("button");
        btn.className = "choice";
        btn.innerHTML = medal("md_" + m[0], "md") + '<span class="cbody"><b>' + m[1] + probChip(info.prob) + '</b><span class="small">' + esc(m[2]) + '</span><span class="small">Efecto: ' + esc(info.effect) + '</span>' +
          (info.cost.length ? '<span class="small">Coste: ' + esc(info.cost.join(" · ")) + '</span>' : '') +
          (info.mods.length ? '<span class="small">Influye: ' + esc(info.mods.join("; ")) + '</span>' : '') + '</span>';
        btn.onclick = function () { doCast(sp0.id, ps.tid == null ? null : ps.tid, m[0]); };
        box.appendChild(btn);
      });
      addCancel(box);
      return;
    }
    $("actionHint").textContent = "Elige un conjuro. Cada uno tiene usos limitados (Meditar repone uno) y un porcentaje de éxito propio. Luego decides con cuánto empeño lo lanzas.";
    const sorted = (p.spells || []).slice().sort(function (a, b) { return schoolOf(a) < schoolOf(b) ? -1 : schoolOf(a) > schoolOf(b) ? 1 : tierOf(a) - tierOf(b); });
    const multi = sorted.some(function (x) { return schoolOf(x) !== schoolOf(sorted[0]); });
    let lastSchool = null;
    sorted.forEach(function (sp) {
      if (multi && schoolOf(sp) !== lastSchool) { lastSchool = schoolOf(sp); const hd = document.createElement("div"); hd.className = "small"; hd.style.cssText = "margin:6px 2px 0;opacity:.8"; hd.textContent = "Escuela de " + lastSchool; box.appendChild(hd); }
      const info = U.spellInfo(p.id, sp.id, null, "normal");
      const btn = document.createElement("button");
      btn.className = "choice";
      btn.innerHTML = spellMedals(sp) + '<span class="cbody"><b>' + esc(sp.name) + (info ? probChip(info.prob) : '') + '</b>' + (info ? spellLine(sp, info) : '') + spellMinis(sp) + '</span>';
      btn.onclick = function () { pendingSpell = { id: sp.id, tid: null }; renderPrivate(); };
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
      $("actionHint").textContent = "Tres conjuros asoman entre las páginas: aprende uno nuevo o perfecciona uno que ya sabes. Estudiar te cuesta +3 oscuridad (un buen pulso en el reto lo deja en +2; uno torpe, en +4). Los de nivel 2 solo aparecen si eres Practicante en esa escuela.";
      st.opts.forEach(function (sp, i) {
        const btn = document.createElement("button");
        btn.className = "choice";
        btn.innerHTML = spellMedals(sp) + '<span class="cbody"><b>' + esc(sp.name) + '</b><span class="small">' + tierChip(sp) + ' ' + esc(schoolOf(sp)) + ' · ' + (sp.kind === "off" ? "Ofensivo" : "Defensivo") + ' · ' + esc(sp.desc) + ' · ' + sp.uses + ' uso' + (sp.uses > 1 ? "s" : "") + (tierOf(sp) > 1 ? ' · pesa el doble en tu tope de conjuros' : '') + '</span><span class="minis">' + medal("as_" + sp.aspect, "sm") + '</span></span>';
        btn.onclick = function () { st.pick = i; renderPrivate(); };
        box.appendChild(btn);
      });
      (p.spells || []).forEach(function (sp) {
        const pr = U.spellProgress(sp);
        if (pr.level >= 3) return;
        const btn = document.createElement("button");
        btn.className = "choice";
        btn.innerHTML = medal("a_perfeccionar", "md") + '<span class="cbody"><b>Perfeccionar «' + esc(sp.name) + '»</b><span class="small">En vez de aprender uno nuevo, subes este conjuro de nivel (ahora: ' + esc(pr.label) + '). ' + esc(pr.next) + '</span><span class="minis">' + medal("m_" + pr.level, "sm") + '</span></span>';
        btn.onclick = function () { withSkill(function (sk) { pendingStudy = null; mut(U.improveSpell(p.id, sp.id, sk)); }); };
        box.appendChild(btn);
      });
    } else {
      $("actionHint").textContent = "Dale forma a «" + st.opts[st.pick].name + "».";
      [["potente", "Potente", "Más intensidad, pero te mancha de oscuridad al lanzarlo.", "as_fuego", "danger"], ["estable", "Estable", "Un uso extra.", "a_resistir", "guard"], ["sutil", "Sutil", "No deja rastro público al lanzarlo.", "a_emboscada", "dark"]].forEach(function (o) {
        const btn = document.createElement("button");
        btn.className = "choice";
        btn.innerHTML = medal(o[3], "md", o[4]) + '<span class="cbody"><b>' + o[1] + '</b><span class="small">' + o[2] + '</span></span>';
        btn.onclick = function () { const pk = st.pick; withSkill(function (sk) { pendingStudy = null; mut(U.learnSpell(p.id, pk, o[0], sk)); }); };
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
      btn.innerHTML = medal(o.id === "trampa" ? "a_romper" : "a_tender", "md", o.id === "trampa" ? "dark" : "heal") + '<span class="cbody"><b>' + o.name + '</b><span class="small">' + o.d + '</span></span>';
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
    box.innerHTML = tagH("UNA MANO TENDIDA", "a_tender") + '<p class="small">' + esc(o.from) + ' te ofrece su ayuda en secreto. Si confías en su palabra, se abrirá una ventana a tu favor, pero deberás guardar silencio. Si lo cuentas, la ventana se cerrará.</p>' +
      '<p class="small">Si eliges una acción sin responder, la mano se rechaza.</p>' +
      '<div class="row"><button class="primary smallbtn" id="handYes">' + ic("a_tender") + 'Confiar y callar</button><button class="ghost smallbtn" id="handNo">' + ic("ui_cerrar") + 'Rechazar</button></div>';
    $("handYes").onclick = function () { mut(U.answerHand(p.id, true)); };
    $("handNo").onclick = function () { mut(U.answerHand(p.id, false)); };
  }

  /* Objetivos válidos de una acción. En línea los calcula el servidor (canTarget mira campos ocultos del objetivo). */
  function targetsOf(a, p) {
    const ps = U.getState().players;
    if (NET) return U.targetsFor(a.id).map(function (id) { return ps[id]; });
    return ps.filter(function (x) { return x.id !== p.id && (a.id === "alzar" ? true : !x.dead) && (!a.canTarget || a.canTarget(x, p)); });
  }
  function renderTargetPicker(p) {
    $("actionHint").textContent = "Elige a quién afecta «" + pendingAction.name + "»." + (pendingAction.canTarget && !targetsOf(pendingAction, p).length ? " Ahora mismo no hay nadie a quien se pueda aplicar." : "");
    $("actionHint").classList.remove("hidden");
    const box = $("actionChoices");
    box.className = "actions";
    box.innerHTML = "";
    targetsOf(pendingAction, p).forEach(function (t) {
      const btn = document.createElement("button");
      btn.className = "choice";
      btn.innerHTML = playerMedal(t) + '<span class="cbody"><b>' + dn(t) + '</b><span class="small">' + esc(U.visibleHealth(t)) + '</span></span>';
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
      btn.innerHTML = medal("a_apostar", "md", st.id >= 20 ? "danger" : st.id >= 10 ? "ember" : "gold") + '<span class="cbody"><span class="choiceTop"><b>Envite ' + esc(st.name) + ' · ' + st.id + '</b><span class="chip risk">' + prob + '% éxito</span></span>' +
        '<span class="small">' + esc(st.desc) + ' Dificultad ' + st.diff + '.</span>' +
        '<span class="tagline">Si fallas: el Umbral cobra' + (st.wound ? " y te hiere" : "") + '.</span></span>';
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
      btn.innerHTML = playerMedal(t) + '<span class="cbody"><b>' + dn(t) + '</b><span class="small">' + esc(U.visibleHealth(t)) + '</span></span>';
      btn.onclick = function () { const ix = pendingItem; pendingItem = null; mut(U.useItem(p.id, ix, t.id)); };
      box.appendChild(btn);
    });
    addCancel(box);
  }

  /* Medallón de un jugador: solo estado público (vivo / necesita socorro / eliminado). */
  /* Marcador público de sospecha 0-4 (no es el rol: se calcula con conductas visibles y puede señalar a un inocente). */
  function suspTag(p) {
    const lv = Math.max(0, Math.min(4, Number(p && p.susp) || 0));
    if (p.dead || !lv) return "";
    let dots = ""; for (let k = 1; k <= 4; k++) dots += k <= lv ? "●" : "○";
    return '<div class="small susp s' + lv + '" title="Sospecha pública: se calcula con conductas visibles y puede señalar a un inocente">Sospecha ' + dots + ' ' + esc(U.suspName(lv)) + '</div>';
  }
  function playerMedal(t) { return medal(t.dead ? "s_muerto" : t.dying ? "s_moribundo" : "ui_jugador", "md", t.dead ? "mist" : t.dying ? "danger" : "gold"); }
  function addCancel(box) {
    const b = document.createElement("button");
    b.className = "ghost";
    b.innerHTML = ic("ui_cerrar") + "Cancelar";
    b.onclick = function () { pendingAction = null; pendingStake = null; pendingItem = null; pendingMode = null; pendingSpell = null; pendingStudy = null; renderPrivate(); };
    box.appendChild(b);
  }

  function onChooseAction(a) {
    pendingAction = null; pendingStake = null; pendingItem = null; pendingMode = null; pendingSpell = null; pendingStudy = null;
    if (a.__confirm) { a.__confirm(); return; }
    if (a.id === "conjurar") { pendingSpell = { id: null, tid: null }; renderPrivate(); return; }
    if (a.gamble) { pendingStake = a; renderPrivate(); return; }
    if (a.target) { pendingAction = a; renderPrivate(); return; }
    doAction(a, null, null);
  }

  function doAction(a, targetId, stakeId) {
    if (!a) { toast("No hay acción pendiente.", true); return; }
    if (!U.currentPlayer()) { toast("La partida no está en un turno válido.", true); return; }
    withSkill(function (sk) { doActionGo(a, targetId, stakeId, sk); });
  }
  function doActionGo(a, targetId, stakeId, sk) {
    const p = U.currentPlayer();
    if (!p) { toast("La partida no está en un turno válido.", true); return; }
    const hp0 = p.hp;
    run(U.act(p.id, a.id, targetId, stakeId, sk), function (res) {
      if (!res.ok) { if (NET && U.currentPlayer().acted) { endTurn(); return; } $("actionHint").textContent = onl(res.msg); return; }
      fxSelf(U.currentPlayer(), hp0);
      pendingAction = null; pendingStake = null; pendingItem = null; pendingMode = null; pendingSpell = null; pendingStudy = null;
      const buttons = res.pushable ? [
        { label: "Quedarme con esto", cls: "", onClick: endTurn },
        { label: "Forzar el destino", cls: "danger", onClick: function () { doPush(p.id); } }
      ] : [{ label: "Continuar", cls: "primary", onClick: endTurn }];
      const o = fxActionOpts(a, res, hp0, U.currentPlayer());
      showRoll({ title: a.name.toUpperCase(), icon: "a_" + a.id, result: res, text: res.outcome, fx: o.fx, hit: o.hit, heal: o.heal, dying: o.dying, buttons: buttons });
    });
  }

  function doPush(actorId) {
    const hp0 = U.currentPlayer().hp;
    run(U.pushLuck(actorId), function (r) {
      if (!r.ok) { endTurn(); return; }
      fxSelf(U.currentPlayer(), hp0);
      const p2 = U.currentPlayer();
      showRoll({ title: "FORZAR EL DESTINO", icon: "ui_critico", result: r, text: r.outcome, fx: { name: "flash", fam: "ember", ok: !fxFailed(r) }, hit: p2.hp < hp0, heal: p2.hp > hp0, dying: !!p2.dying, buttons: [{ label: "Continuar", cls: "primary", onClick: endTurn }] });
    });
  }

  function onUseItem(index) {
    const p = U.currentPlayer();
    const def = D.ITEMS[p.items[index].id];
    openInfoSheet("OBJETO", def.name, def.desc, ("Solo puedes usar un objeto por ronda. " + (def.uses && def.uses > 1 ? "Aguanta " + def.uses + " usos." : "Se gasta al usarlo.")), def.kind === "tome" ? "Estudiar" : "Usar", function () { useItemConfirmed(index); }, "i_" + p.items[index].id);
  }

  function useItemConfirmed(index) {
    const p = U.currentPlayer();
    const def = D.ITEMS[p.items[index].id];
    if (def.kind === "tome") {
      run(U.studyOptions(p.id, index), function (so) {
        if (!so.ok) { toast(so.msg, true); return; }
        pendingStudy = { idx: index, opts: so.options, pick: null };
        renderPrivate();
      });
      return;
    }
    if (def.kind === "clue" || def.kind === "dust") {
      pendingItem = index;
      renderPrivate();
      return;
    }
    mut(U.useItem(p.id, index, null));
  }

  function showEncounter(p, e) {
    const buttons = e.options.map(function (o) {
      const hint = o.attr && o.label.indexOf("(" + o.attr) === -1 ? " (" + o.attr + ")" : "";
      return { label: o.label + hint, cls: o.id === "irse" ? "" : "primary", onClick: function () {
        const hp0 = p.hp;
        run(U.encounterAct(p.id, o.id), function (r) {
          if (!r.ok) { toast(r.msg, true); endTurn(); return; }
          fxSelf(U.currentPlayer(), hp0);
          const p2 = U.currentPlayer();
          showRoll({ title: e.name.toUpperCase(), icon: "e_viajero", result: r, text: r.outcome, hit: p2.hp < hp0, heal: p2.hp > hp0, dying: !!p2.dying, buttons: [{ label: "Continuar", cls: "primary", onClick: endTurn }] });
        });
      } };
    });
    showRoll({ title: "ENCUENTRO: " + e.name.toUpperCase(), icon: "e_viajero", result: {}, text: e.intro + " ¿Qué haces? Tu forma de tratarla y tus habilidades decidirán qué pasa.", buttons: buttons });
  }

  function endTurn() {
    showMoreActs = false;
    const cp = U.currentPlayer();
    const enc = cp ? U.encounterStart(cp.id) : null;
    if (enc) { showEncounter(cp, enc); return; }
    if (showPrep(cp)) return;
    leaveTurn();
  }
  function leaveTurn() {
    run(U.finishTurn(), function (r) {
      if (NET && r && !r.ok) { showRoll({ title: "SIN CONEXIÓN", icon: "ui_fallo", result: {}, text: (r.msg || "No se pudo enviar tu turno.") + " Pulsa para reintentarlo.", buttons: [{ label: "Reintentar", cls: "primary", ik: "ui_continuar", onClick: leaveTurn }] }); return; }
      if (U.getState().phase === "ending") { renderEnding(U.getEnding()); return; }
      if (NET) routeNet(); else renderHandoff("turn");
    });
  }

  /* ---------------- entrega ---------------- */
  /* Objetivo secreto: texto, PREMIO, estado y pista dinámica de qué hacer ahora. full = consulta completa (hoja «Mi secreto»). */
  /* Evento de la ronda: lo que se cuenta y lo que de verdad ha pasado (información pública). */
  function eventLine(ev) { return ev ? ev.text + (ev.effectText ? " " + ev.effectText : "") : ""; }
  function secretHTML(p, full) {
    const si = U.secretInfo(p.id);
    if (!si) return "";
    const rw = si.reward ? '<div class="rewardline small">' + medal("i_amuleto", "sm", "ember") + '<span><b class="reward">' + (si.paid ? '✦ Premio recibido: ' : 'Premio: ') + esc(si.reward.title) + '</b> — ' + esc(si.reward.text) + (si.paid ? '' : ' Se entrega al cumplirlo, una sola vez.') + '</span></div>' : '';
    const st = si.assassin ? '' : '<div class="stline"><span class="' + (si.ok ? "f-heal" : "f-mist") + '" style="color:var(--ic)">' + ic(si.ok ? "ui_exito" : "ui_fallo") + '</span><span>' + (si.ok ? 'Ahora mismo se cumple.' : 'Ahora mismo no se cumple.') + '</span></div>';
    return '<div class="notice small"><div class="secrethead">' + medal("x_" + si.id, "lg") + '<div><b>Tu objetivo secreto: ' + esc(si.title) + '</b></div></div>' + esc(si.text) +
      (full && si.when ? '<br><span class="muted">' + esc(si.when) + '</span>' : '') + rw + st +
      (si.hint ? '<div class="hintline"><b>Qué hacer ahora:</b> ' + esc(si.hint) + '</div>' : '') + '</div>';
  }
  /* Hambre del Umbral: nivel de corrupción, qué exige y qué lo baja (solo información privada del propio jugador). */
  function umbralHTML(p, full) {
    const u = U.umbralInfo ? U.umbralInfo(p.id) : null;
    if (!u || (!full && u.level < 1)) return "";
    const cls = u.level >= 2 ? "f-dark" : u.level === 1 ? "f-ember" : "f-mist";
    return '<div class="notice small umbralbox"><div class="secrethead"><span class="' + cls + '" style="color:var(--ic)">' + ic("st_corrupcion") + '</span><div><b>Corrupción: ' + esc(u.name) + '</b> <span class="muted">(oscuridad ' + u.corr + ')</span></div></div>' +
      '<div><b>Qué exige:</b> ' + esc(u.demand) + '</div>' +
      (u.level >= 1 && u.armed ? '<div class="hintline">' + (u.fed ? ic("ui_exito") + ' Esta ronda ya has alimentado al Umbral.' : u.protectedNow ? ic("ui_exito") + ' Esta ronda has frenado su cobro.' : ic("ui_fallo") + ' El Umbral reclama algo esta ronda: haz un acto oscuro o frénalo.') + '</div>' : '') +
      (u.lower ? '<div><b>Qué lo baja o lo frena:</b> ' + esc(u.lower) + '</div>' : '') + '</div>';
  }
  function secretOk(p, s) {
    var d = U.D.SECRETS.find(function (x) { return x.id === p.secret.id; });
    try { return !!(d && d.check(p, s)); } catch (e) { return false; }
  }

  function renderHandoff(mode) {
    const npcN = npcAdv();
    if (!NET && U.getState() && U.getState().phase === "ending") { renderEnding(U.getState().ending || U.getEnding()); return; }
    stopTimer();
    hideAll();
    Array.prototype.forEach.call(document.querySelectorAll(".toast"), function (t) { t.remove(); });
    $("handoff").classList.remove("hidden");
    const s = U.getState();
    $("roundLabel").textContent = "RONDA " + s.round + "/" + U.maxRounds();
    handoffMode = mode;
    $("phaseTag").textContent = mode === "round" ? "NUEVA RONDA" : mode === "start" ? "TURNO PRIVADO" : "TURNO PRIVADO";
    setPhaseIcon(mode === "round" ? "ui_ronda" : "ui_pasar");
    { const sg = $("handoffSigil"), evId = s.event && s.event.id;
      const sk = mode === "round" && evId ? "e_" + evId : mode === "start" ? "t_umbral" : "ph_privado";
      sg.className = "bigmedal f-" + famOf(sk); sg.innerHTML = ic(sk); }
    $("screenTitle").textContent = "Pasa el móvil";
    setStep("");
    $("handoffMood").textContent = moodLine(s, mode);
    const hmn = NET ? null : pendingHuman(s), npcNote = npcN ? " Los NPC ya han jugado su turno." : "";
    if (mode === "start") {
      const cur = hmn || s.players[s.turn];
      $("handoffTitle").textContent = "Entrega el móvil";
      $("handoffText").textContent = "Entrega el móvil a " + cur.name + ". Nadie más debe mirar la pantalla." + npcNote;
      setLbl($("btnHandoff"), "Soy " + cur.name);
    } else if (mode === "round") {
      $("handoffTitle").textContent = "La noche avanza";
      const sk = s.skipped || [];
      const skDy = sk.filter(function (id) { return s.players[id].dying; }).map(function (id) { return s.players[id].name; });
      const skSt = sk.filter(function (id) { return !s.players[id].dying; }).map(function (id) { return s.players[id].name; });
      const skipTxt = (skSt.length ? " Pierde su turno (aturdido): " + skSt.join(", ") + "." : "") + (skDy.length ? " Inconsciente y moribundo, no actúa: " + skDy.join(", ") + "." : "");
      if (s.phase === "council") $("handoffText").textContent = eventLine(s.event) + skipTxt + " Nadie puede actuar: se abre el Consejo.";
      else if (!hmn) $("handoffText").textContent = eventLine(s.event) + skipTxt + " Los NPC ya han jugado su turno: abrid el Consejo.";
      else $("handoffText").textContent = eventLine(s.event) + skipTxt + " Entrega el móvil a " + hmn.name + "." + npcNote;
      setLbl($("btnHandoff"), !hmn && s.phase === "private" ? "Abrir el Consejo" : "Comenzar ronda " + s.round);
    } else {
      $("handoffTitle").textContent = "Decisión sellada";
      $("handoffText").textContent = (function () { var o = s.order || s.players.map(function (q) { return q.id; }); var rest = o.slice(o.indexOf(s.turn) + 1).filter(function (id) { return !s.players[id].dead && !s.players[id].acted; }); return rest.length ? "Entrega el móvil a " + s.players[rest[0]].name + ". No reveles tu elección." + npcNote : "Todos han decidido. Abrid el Consejo."; })();
      setLbl($("btnHandoff"), (function () { var o = s.order || s.players.map(function (q) { return q.id; }); return o.slice(o.indexOf(s.turn) + 1).filter(function (id) { return !s.players[id].dead && !s.players[id].acted; }).length === 0; })() ? "Abrir el Consejo" : "Continuar");
    }
    updateStatus();
  }

  function onHandoffContinue() {
    if (handoffMode === "round" || handoffMode === "start") {
      handoffMode = null;
      if (!NET && U.getState().phase === "private" && U.getState().handoff) U.nextTurn();
      route(); return;
    }
    const advanced = U.nextTurn();
    if (advanced === "blocked") toast("El turno no puede avanzar: falta resolver una acción.", true);
    route();
  }

  /* ---------------- consejo ---------------- */
  function renderCouncil() {
    hideAll();
    $("councilPanel").classList.remove("hidden");
    const s = U.getState();
    $("phaseTag").textContent = "FASE SOCIAL"; setPhaseIcon("ph_consejo");
    $("screenTitle").textContent = "El Consejo";
    setStep("Hablad entre vosotros; la app solo resuelve lo declarado en secreto.");
    { const cpTxt = U.councilPrompt(); $("councilPrompt").textContent = cpTxt; $("councilPrompt").classList.toggle("hidden", !cpTxt); }
    renderCouncilLog(s);
    if (!councilTimerStarted) startCouncilTimer();
    renderTimer();
    updateStatus();
    if (NET) netWait($("btnEndCouncil"), "ph_resolucion", "Estoy listo: cerrar el Consejo");
  }

  function startCouncilTimer() {
    councilTimerStarted = true;
    fxc("campana");
    seconds = NET && U.clockLeft && U.clockLeft("council") !== null ? U.clockLeft("council") : U.councilSeconds();
    clearInterval(timerId);
    timerId = setInterval(function () {
      seconds--;
      renderTimer();
      if (seconds <= 0) {
        clearInterval(timerId);
        timerId = null;
        $("timer").classList.add("timeup");
        if (!NET && U.behindSchedule()) onEndCouncil(); /* en línea el servidor cierra el Consejo */
      }
    }, 1000);
  }

  function stopTimer() {
    stopTurnTimer();
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
    $("councilLogBox").querySelector("summary").innerHTML = ic("ui_log") + "<span>Lo que ha pasado esta ronda (" + entries.length + ")</span>";
    $("councilLog").innerHTML = entries.length ? entries.map(function (c) {
      return '<div class="notice small' + (RUMOR_RE.test(c.text) ? ' rumor' : '') + '">' + esc(c.text) + '</div>';
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

  /* Declaraciones secretas del turno: se resuelven en público al cerrar el Consejo. */
  const IX_INFO = [
    { v: "acusacion", ik: "a_acusar", t: "Acusar ante el Consejo", s: "Dices en público que desconfías de alguien. Nadie sabrá si tus pruebas eran buenas: solo sube su sospecha.", fx: ["La sospecha pública sobre esa persona sube un punto la primera vez que TÚ la acusas; varios acusadores distintos suman.", "Tus pistas deciden en privado si aciertas (solo tú lo sabrás, sin certeza para los demás): +4 virtud. Si fallas: +5 corrupción y −5 virtud.", "Con sospecha 2+ enfrentarte a esa persona ya no es a ciegas; con 3+ sus pistas salen completas."] },
    { v: "pista", ik: "a_indagar", t: "Presentar una pista", s: "Muestras a todos una de tus pistas de Indagar, tal como la viste, sin tu nombre. La mesa decide qué hacer con ella.", fx: ["Se enseña el mismo texto que viste (rastro, sobre quién, rondas aproximadas), marcado como verificado por el juego; no dice quién fue.", "Nada la compara con nadie ni mueve la sospecha. Una por Consejo; la pista se gasta.", "Si el rastro es de alguien, esa persona sabrá en privado que su rastro salió a la luz (sin saber quién lo presentó)."] },
    { v: "emboscada", ik: "a_enfrentar", t: "Enfrentarte a alguien", s: "Atacas a alguien en público. Ambos tiráis dados.", fx: ["Si ganas: le causas daño (más si uno de los dos es Asesino); +8 corrupción y −3 virtud para ti.", "Si pierdes: −8 virtud y +6 corrupción para ti, y todos lo ven.", "Es lo más arriesgado del Consejo."] },
    { v: "romper", ik: "a_romper", t: "Romper un silencio", s: "Cuentas que alguien te tendió la mano en secreto.", fx: ["Solo si recibiste una mano de esa persona y sigue activa.", "Tú pierdes 4 virtud. Si su mano era sincera, ella gana 2.", "Nadie puede comprobar lo que dices."] },
    { v: "pacto", ik: "a_pacto", t: "Proponer un pacto secreto", s: "Se lo propones a alguien; lo verá y aceptará en su próximo turno privado.", fx: ["Solo lo sabéis los dos.", "Cumplido: +3 virtud para ambos. Roto: +8 corrupción y −6 virtud al que rompe; solo lo sabrá el otro.", "Se evalúa al final de la ronda siguiente a su aceptación (si es la última ronda, en esa misma)."] }
  ];
  let prepSel = null;
  function showPrep(p) {
    const o = U.declareOptions(p.id);
    if (!o) return false;
    hideAll();
    prepSel = null;
    $("prepPanel").classList.remove("hidden");
    $("phaseTag").textContent = "TURNO PRIVADO"; setPhaseIcon("ph_prep");
    $("screenTitle").textContent = "Para el Consejo, " + p.name;
    setStep("Opcional y secreto: nadie verá lo que elijas.");
    $("prepTitle").textContent = o.final ? "Última ronda: un pacto que se acepte hoy se comprobará en este mismo Consejo." : "¿Declaras algo?";
    $("prepHint").textContent = "";
    renderPrepCards(p, o);
    return true;
  }
  function renderPrepCards(p, o) {
    const box = $("prepCards");
    box.innerHTML = "";
    IX_INFO.forEach(function (x) {
      if (x.v === "romper" && !o.romper.length) return;
      if (x.v === "pista" && !(o.leads && o.leads.length)) return;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ixcard" + (x.v === prepSel ? " sel" : "");
      b.innerHTML = medal(x.ik, "md") + '<span class="cbody"><b>' + esc(x.t) + '</b><div class="small">' + esc(x.s) + '</div>' + (x.v === prepSel ? '<ul class="small">' + x.fx.map(function (f) { return "<li>" + esc(f) + "</li>"; }).join("") + '</ul>' : "") + '</span>';
      b.onclick = function () { prepSel = prepSel === x.v ? null : x.v; renderPrepCards(p, o); };
      box.appendChild(b);
    });
    $("prepKindLabel").classList.toggle("hidden", prepSel !== "pacto");
    $("prepTargetLabel").classList.toggle("hidden", !prepSel);
    $("btnPrepSave").classList.toggle("hidden", !prepSel);
    $("prepLeadLabel").classList.toggle("hidden", prepSel !== "pista");
    if (prepSel === "pista") fillSelect($("prepLead"), (o.leads || []).map(function (l) { return { v: l.i, t: l.text.replace(/ No dice quién fue\.$/, "") }; }), $("prepLead").value);
    if (prepSel === "pista") {
      $("prepTargetLabel").classList.add("hidden"); $("btnPrepSave").classList.remove("hidden");
    } else if (prepSel) {
      const list = prepSel === "romper" ? o.targets.filter(function (t) { return o.romper.indexOf(t.id) !== -1; }) : prepSel === "pacto" ? o.targets.filter(function (t) { return !t.dying; }) : o.targets;
      $("prepTargetLabel").classList.toggle("hidden", !list.length);
      $("btnPrepSave").classList.toggle("hidden", !list.length);
      const prev = $("prepTarget").value;
      fillSelect($("prepTarget"), list.map(function (t) { return { v: t.id, t: t.name + (prepSel === "acusacion" ? " (" + t.clues + " pista" + (t.clues === 1 ? "" : "s") + ")" : "") + (t.susp ? " · sospecha " + t.susp + "/4" : "") }; }), prev);
      $("prepTargetLabel").firstChild.textContent = prepSel === "pacto" ? "Con quién " : prepSel === "romper" ? "Silencio de " : prepSel === "acusacion" ? "Acusar a " : "Enfrentarte a ";
    }
    $("prepKind").onchange = prepTerms;
    $("prepTarget").onchange = prepTerms;
    prepTerms();
  }
  function prepTerms() {
    { const kv = $("prepKind").value; $("prepKindIco").innerHTML = medal("p_" + String(kv).replace("pacto_", ""), "sm"); }
    $("prepHint").textContent = prepSel === "pacto" && $("prepTarget").value !== "" ? U.pactTerms($("prepKind").value, "tú", $("prepTarget").selectedOptions[0].textContent) : "";
  }
  function onPrepSave() {
    const p = U.currentPlayer();
    if (!prepSel) { onPrepSkip(); return; }
    const type = prepSel === "pacto" ? $("prepKind").value : prepSel;
    if (type !== "pista" && $("prepTarget").value === "") { $("prepHint").textContent = "No hay nadie a quien dirigirlo."; return; }
    run(U.declare(p.id, type, type === "pista" ? null : Number($("prepTarget").value), type === "pista" ? Number($("prepLead").value) : undefined), function (r) {
      if (!r.ok) { $("prepHint").textContent = r.msg; return; }
      leaveTurn();
    });
  }
  function onPrepSkip() { run(U.declare(U.currentPlayer().id, "ninguna", null), leaveTurn); }

  function renderPactOffers(p) {
    const box = $("privatePact");
    const list = p.dead ? [] : U.getPactOffers(p.id);
    if (!list.length) { box.classList.add("hidden"); box.innerHTML = ""; return; }
    box.classList.remove("hidden");
    box.innerHTML = list.map(function (o) {
      return tagH("PACTO PROPUESTO EN SECRETO", "p_" + String(o.type).replace("pacto_", "")) + '<p class="small"><b>' + esc(o.from) + '</b> te propone un pacto de ' + esc(o.label) + '. ' + esc(o.terms) + ' Cumplirlo: +3 virtud a ambos. Romperlo: +8 corrupción y −6 virtud al que rompa; solo lo sabrá el otro.</p>' +
        '<div class="row"><button class="primary smallbtn" data-pact="' + o.idx + '" data-yes="1">' + ic("ui_ok") + 'Aceptar</button><button class="ghost smallbtn" data-pact="' + o.idx + '">' + ic("ui_cerrar") + 'Rechazar</button></div>';
    }).join("") + '<p class="small">Si eliges una acción sin responder, se rechaza.</p>';
    Array.prototype.forEach.call(box.querySelectorAll("[data-pact]"), function (b) {
      b.onclick = function () { mutFx(U.answerPact(p.id, Number(b.getAttribute("data-pact")), !!b.getAttribute("data-yes")), "seal", "gold"); };
    });
  }

  function onEndCouncil() {
    if (U.getState().phase !== "council") return;
    if (NET) { run(U.councilReady(), function (r) { if (r && !r.ok) toast(r.msg, true); routeNet(); }); return; }
    stopTimer();
    const decl = U.resolveCouncil();
    showCouncilResults(decl, 0);
  }

  /* Resoluciones públicas de lo declarado en secreto, una a una; solo salen las que tuvieron efecto. */
  function showCouncilResults(list, i) {
    if (U.getState().phase === "ending") { renderEnding(U.getEnding()); return; }
    if (i >= list.length) {
      const out = U.endCouncil();
      if (U.getState().phase === "ending") renderEnding(U.getEnding());
      else renderResolution(out);
      return;
    }
    const r = list[i].res;
    const next = { label: i + 1 < list.length ? "Continuar" : "Cerrar el Consejo", cls: "primary", onClick: function () { showCouncilResults(list, i + 1); } };
    hideAll(); $("councilPanel").classList.remove("hidden");
    /* Solo lo ya público: acusación = foco; emboscada = tajo (parada si pierde el duelo); romper silencio = sello que se parte. */
    const cok = r.duel ? r.duel.attacker.total > r.duel.defender.total : r.roll ? !!r.roll.success : true;
    const cfx = list[i].type === "acusacion" ? { name: "focus", fam: "danger", ok: true } : list[i].type === "emboscada" ? { name: "slash", fam: "danger", ok: cok } : list[i].type === "romper" ? { name: "crack", fam: "gold", ok: true } : list[i].type === "pista" ? { name: "focus", fam: "lore", ok: true } : null;
    showRoll({ title: "RESOLUCIÓN PÚBLICA", fx: cfx, icon: list[i].type === "acusacion" ? "a_acusar" : list[i].type === "emboscada" ? "a_enfrentar" : list[i].type === "romper" ? "a_romper" : list[i].type === "pista" ? "a_indagar" : "ph_resolucion", result: r.kind === "roll" ? r.roll : {}, duel: r.duel, text: r.text, buttons: [next] });
  }

  /* ---------------- resolución ---------------- */
  const fxResPrev = {};
  function renderResolution(entries) {
    stopTimer();
    hideAll();
    $("resolutionPanel").classList.remove("hidden");
    const s = U.getState();
    $("phaseTag").textContent = "RESOLUCIÓN"; setPhaseIcon("ph_resolucion");
    $("screenTitle").textContent = "La ronda termina";
    setStep("Esto es lo que ha pasado y todos podéis ver. Lo secreto sigue en secreto.");
    $("resTitle").textContent = "Ronda " + s.round + " — consecuencias";
    const pub = s.chronicle.filter(function (c) { return c.round === s.round; }).map(function (c) { return c.text; });
    $("resLog").innerHTML = pub.length ? pub.map(function (e) {
      return '<div class="notice' + (RUMOR_RE.test(e) ? ' rumor' : '') + '">' + esc(e) + '</div>';
    }).join("") : '<p class="small">Ronda tranquila: nada se ha hecho público. Lo que cada uno haya hecho en secreto sigue en secreto.</p>';
    $("resPlayers").innerHTML = s.players.map(function (p) {
      return '<div class="player' + (p.dead ? " dead" : "") + '"><div class="prow">' + playerMedal(p) + '<div class="grow"><div class="row between"><b>' + dn(p) + '</b><span class="small">' + (p.dead ? 'Eliminado' : p.dying ? 'Necesita socorro' : 'En juego') + '</span></div>' +
        '<div class="small">' + esc(U.visibleHealth(p)) + '</div>' + suspTag(p) + '</div></div></div>';
    }).join("");
    { const g = fxGameKey(), rows = $("resPlayers").children;
      s.players.forEach(function (p, i) {
        const st = p.dead ? "dead" : p.dying ? "dying" : "ok", k = "res:" + g + ":" + p.id, prev = fxResPrev[k];
        fxResPrev[k] = st;
        if (prev && prev !== st && st !== "ok") fxClass(rows[i], st === "dead" ? "fx-dead" : "fx-dying", 700);
      }); }
    setLbl($("btnNextRound"), s.round >= U.maxRounds() ? "Ver el desenlace" : "Siguiente ronda");
    { const nb = $("btnNextRound"); if (!nb.querySelector(".ic")) nb.insertAdjacentHTML("afterbegin", ic(s.round >= U.maxRounds() ? "ph_desenlace" : "ui_continuar")); else nb.querySelector(".ic").outerHTML = ic(s.round >= U.maxRounds() ? "ph_desenlace" : "ui_continuar"); }
    updateStatus();
    if (NET) netWait($("btnNextRound"), s.round >= U.maxRounds() ? "ph_desenlace" : "ui_continuar", s.round >= U.maxRounds() ? "Ver el desenlace" : "Siguiente ronda");
  }

  function onNextRound() {
    if (NET) { run(U.nextRound(), function (r) { if (r && !r.ok) toast(r.msg, true); routeNet(); }); return; }
    const e = U.nextRound();
    if (e) { renderEnding(e); return; }
    if (U.getState() && U.getState().timeAsk) { showTimeAsk(); return; } /* la mesa decide; doble toque seguro */
    renderHandoff("round");
  }

  /* ---------------- desenlace ---------------- */
  function renderEnding(e) {
    stopTimer(); updateClock();
    { const was = $("ending").classList.contains("hidden"); fxGame(false); if (was && e) { fxc("desenlace"); fxClass($("endingSigil"), "fx-sigil", 900); fxReset(); } }
    $("game").classList.add("hidden");
    $("start").classList.add("hidden");
    $("ending").classList.remove("hidden");
    $("btnStatus").classList.add("hidden");
    ["statusOverlay", "actionOverlay"].forEach(function (id) {
      $(id).classList.add("hidden");
    });
    if (!e) return;
    { const sk = e.winner === "asesino" ? "t_asesino" : e.winner === "supervivientes" ? "st_virtud" : "ph_desenlace", sg = $("endingSigil");
      sg.className = "bigmedal f-" + famOf(sk); sg.innerHTML = ic(sk); }
    $("endingSub").textContent = "Duración: " + e.durationMin + " min" + (e.startedAt ? " (de " + U.hhmm(e.startedAt) + " a " + U.hhmm(e.endedAt || Date.now()) + ")" : "") + (e.plannedMin ? " (previstos " + e.plannedMin + ")" : "") + (e.timedOut ? " · tiempo agotado" : "") + (e.tableEnded ? " · cierre por la mesa (tiempo)" : "") + " · Corrupción media: " + e.avgCorruption + " · Traiciones: " + e.betrayals;
    $("endingTitle").textContent = e.title;
    $("endingText").textContent = e.text;
    const story = U.buildStory();
    $("endingStory").innerHTML = story.length ? story.map(function (x) { return "<p class=\"small storyp\">" + ic(x.round ? "ui_ronda" : "ui_historia") + "<span>" + (x.round ? "<b>Ronda " + x.round + ".</b> " : "") + esc(x.text) + "</span></p>"; }).join("") : "<p class=\"small\">La partida terminó antes de que ocurriera nada que contar.</p>";
    U.exportLog();
    { const ep = e.epilogue || [];
      $("endingEpilogue").innerHTML = ep.length ? ep.map(function (x) { return '<div class="epirow"><b>' + esc(x.name) + '</b>' + (x.lines || [x.text]).map(function (l) { return '<p class="small">• ' + esc(l) + '</p>'; }).join("") + '</div>'; }).join("") : '<p class="small">Nada más que contar.</p>'; }
    $("endingStats").innerHTML = e.players.map(function (p) {
      const items = p.items.length ? p.items.map(esc).join(", ") : "sin objetos";
      const rd = D.ROLES.find(function (x) { return x.name === p.role; }), af = D.AFFINITIES.find(function (x) { return x.name === p.affinity; });
      return '<div class="player"><div class="prow">' + (rd ? medal("r_" + rd.id, "md") : "") + '<div class="grow"><b>' + dn(p) + '</b><div class="small">' + (rd ? ic("r_" + rd.id, "ic-sm") : "") + esc(p.role) + ' · ' + (af ? ic("f_" + af.id, "ic-sm") : "") + esc(p.affinity) + '</div></div></div>' +
        '<div class="row between small"><span class="lab f-heal">' + ic("st_virtud", "ic-sm") + ' Virtud ' + p.virtue + '</span><span class="lab f-dark">' + ic("st_corrupcion", "ic-sm") + ' Corrupción ' + p.corr + '</span></div>' +
        '<div class="meter"><span class="corrupt" style="width:' + p.corr + '%"></span></div>' +
        '<p class="small">' + 'vitalidad ' + p.hp + '/' + p.maxHp + ' · ' + p.clues + (p.clues === 1 ? ' pista · ' : ' pistas · ') + items + '</p>' +
        '<p class="small">' + (p.dead ? (p.cause === "devorado" ? "Devorado" : /sangr|desangr/i.test(p.cause || "") ? "Murió desangrado" : p.umbral ? "Murió: el Umbral le cobró su hambre" : "Murió de heridas") : p.dying ? "Moribundo al final" : "Sobrevivió") + (p.alignment === "asesino" ? " · Asesino" + (p.via === "tentacion" ? " (aceptó la tentación)" : p.via === "devorar" ? " (devoró)" : p.via === "ceder" ? " (cedió)" : "") : "") + (p.risenBy ? " · alzado como sombra por " + esc(p.risenBy) : "") + '</p></div>';
    }).join("");
    $("endingSecrets").innerHTML = e.players.map(function (p) {
      const sd = D.SECRETS.find(function (x) { return x.title === p.secretTitle; });
      return '<div class="secretrow">' + (sd ? medal("x_" + sd.id, "md") : "") + '<span class="st ' + (p.fulfilled ? "ok" : "no") + '">' + ic(p.fulfilled ? "ui_exito" : "ui_fallo") + '</span><p class="small" style="margin:0">' + (p.fulfilled ? "✦" : "✧") + ' <b>' + dn(p) + '</b>' + (p.secretTitle ? ' (' + esc(p.secretTitle) + ')' : '') + ': ' + esc(p.secret) + ' — <b>' +
        (p.fulfilled ? "CUMPLIDO" : "NO CUMPLIDO") + '</b>' + (p.secretWhy ? '. ' + esc(p.secretWhy) : '') + (p.rewardTitle && p.fulfilled ? ' <span class="reward">' + (p.rewardPaid ? 'Premio recibido: ' : 'Premio: ') + esc(p.rewardTitle) + (p.rewardPaid ? '' : ' (la partida acabó antes de cobrarlo)') + '.</span>' : '') + '</p></div>';
    }).join("");
  }

  /* ---------------- exportar la historia ---------------- */
  /* Todo con cuidado: en un WebView puede faltar el portapapeles, el share o la descarga. Nunca alert/confirm. */
  function storyText() { try { return U.exportStory(true); } catch (e) { return ""; } }
  function copyFrom(ta, okMsg) {
    let ok = false;
    try { ta.focus(); ta.select(); ta.setSelectionRange(0, ta.value.length); ok = document.execCommand("copy"); } catch (e) { ok = false; }
    if (ok) { toast(okMsg); return; }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(ta.value).then(function () { toast(okMsg); }, function () { toast("No se pudo copiar solo: mantén pulsado el texto y elige «Seleccionar todo».", true); }); return; }
    } catch (e) { /* sin portapapeles */ }
    toast("No se pudo copiar solo: mantén pulsado el texto y elige «Seleccionar todo».", true);
  }
  function showStory(msg) {
    $("storyText").value = storyText();
    if (msg) $("storyMsg").textContent = msg;
    $("storyOverlay").classList.remove("hidden");
  }
  function copyStory() {
    const txt = storyText();
    if (!txt) { toast("No hay historia que copiar.", true); return; }
    const ta = document.createElement("textarea");
    ta.value = txt; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0";
    document.body.appendChild(ta);
    let ok = false;
    try { ta.focus(); ta.select(); ta.setSelectionRange(0, txt.length); ok = document.execCommand("copy"); } catch (e) { ok = false; }
    ta.remove();
    if (ok) { toast("Historia copiada."); return; }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(txt).then(function () { toast("Historia copiada."); }, function () { showStory("No se pudo copiar solo. Pulsa «Copiar» o mantén pulsado el texto y elige «Seleccionar todo»."); }); return; }
    } catch (e) { /* sin portapapeles */ }
    showStory("No se pudo copiar solo. Pulsa «Copiar» o mantén pulsado el texto y elige «Seleccionar todo».");
  }
  function shareStory() {
    const txt = storyText();
    if (!txt) { toast("No hay historia que compartir.", true); return; }
    try {
      if (navigator.share) {
        const pr = navigator.share({ title: "El Umbral · La historia de la partida", text: txt });
        if (pr && pr.catch) pr.catch(function (e) { if (!e || e.name !== "AbortError") showStory("No se pudo compartir. Copia el texto desde aquí."); });
        return;
      }
    } catch (e) { /* sin compartir */ }
    showStory("Compartir no está disponible en este móvil. Copia el texto desde aquí.");
  }
  function downloadStory() {
    const txt = storyText();
    if (!txt) { toast("No hay historia que guardar.", true); return; }
    try {
      const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "el-umbral-historia.txt"; a.style.display = "none";
      document.body.appendChild(a); a.click();
      setTimeout(function () { try { document.body.removeChild(a); URL.revokeObjectURL(url); } catch (e) { /* nada */ } }, 1500);
      toast("Descargando el-umbral-historia.txt… si no aparece, usa «Copiar».");
    } catch (e) { showStory("No se pudo descargar el archivo. Copia el texto desde aquí."); }
  }

  /* ---------------- estado público ---------------- */
  /* Botones de la mesa para NPC: sustituir a un jugador (local: cualquiera; en línea: solo el anfitrión) y recuperar el sitio (local). */
  let subArm = null;
  function npcCtl(p, s) {
    if (p.dead || s.phase === "ending") return "";
    const me = NET ? s.players[s.youId] : null;
    if (!p.npc) {
      if (NET && !(me && me.host)) return "";
      return '<div class="npcctl"><button class="ghost smallbtn npcsub" data-id="' + p.id + '" data-op="sub">' + (subArm === "s" + p.id ? "¿Seguro? Pulsa otra vez" : "Sustituir por NPC") + '</button></div>';
    }
    if (!NET && p.npcSwaps) return '<div class="npcctl"><button class="ghost smallbtn npcsub" data-id="' + p.id + '" data-op="back">' + (subArm === "b" + p.id ? "¿Seguro? Pulsa otra vez" : "Recuperar su sitio") + '</button></div>';
    return "";
  }
  function npcCtlClick(e) {
    const b = e.target.closest ? e.target.closest(".npcsub") : null; if (!b) return;
    const id = Number(b.getAttribute("data-id")), op = b.getAttribute("data-op"), key = (op === "sub" ? "s" : "b") + id;
    if (subArm !== key) { subArm = key; updateStatus(); return; }
    subArm = null;
    if (op === "sub") {
      run(U.replaceWithNpc(id), function (r) {
        toast(r && r.ok ? "Ahora un NPC juega por ese jugador." : (r && r.msg) || "No se pudo sustituir.", !(r && r.ok));
        $("statusOverlay").classList.add("hidden"); if (NET) routeNet(); else route();
      });
    } else {
      const r = U.restoreFromNpc(id);
      toast(r && r.ok ? "El jugador recupera su sitio." : (r && r.msg) || "No se pudo recuperar.", !(r && r.ok));
      $("statusOverlay").classList.add("hidden");
      const s2 = U.getState(), c2 = s2.phase === "private" && !s2.handoff ? U.currentPlayer() : null;
      if (c2 && !c2.acted && !c2.npc) renderHandoff("start"); else route();
    }
  }
  function updateStatus() {
    const s = U.getState();
    if (!s || !$("allPlayers")) return;
    $("allPlayers").innerHTML = s.players.map(function (p) {
      const active = s.phase === "private" && s.turn === p.id && !s.handoff;
      return '<div class="player' + (active ? " active" : "") + (p.dead ? " dead" : "") + '"><div class="prow">' + playerMedal(p) + '<div class="grow">' +
        '<div class="row between"><b>' + dn(p) + '</b><span class="small">' + (p.dead ? 'Eliminado' : p.dying ? 'Necesita socorro' : 'En juego') + '</span></div>' +
        '<div class="small">' + esc(U.visibleHealth(p)) + '</div>' + suspTag(p) + npcCtl(p, s) + '</div></div></div>';
    }).join("");
    $("clueCount").textContent = s.publicClues.length;
    $("publicClues").innerHTML = s.publicClues.length ? s.publicClues.slice(-4).map(function (c) {
      return '<div class="clue small">' + ic("st_pistas") + '<span>' + esc(c.text) + '</span></div>';
    }).join("") : '<p class="small">Aún no hay pruebas públicas.</p>';
    const living = s.players.filter(function (p) { return !p.dead; });
    const known = living.filter(function (p) { return typeof p.corr === "number"; }); /* en línea solo se conoce la propia */
    const avg = known.length ? Math.round(known.reduce(function (a, p) { return a + p.corr; }, 0) / known.length) : 100;
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
    $("rollIcon").innerHTML = opts.icon ? medal(opts.icon, "lg") : "";
    $("rollMath").textContent = "";
    $("rollWhy").textContent = "";
    $("rollBanner").textContent = "";
    $("rollBanner").className = "rollbanner";
    $("rollOutcome").textContent = "";
    $("rollActions").innerHTML = "";
    const card = overlay.querySelector(".rollcard");
    Array.prototype.slice.call(card.children).forEach(function (c) { if (c.classList.contains("fxl")) c.remove(); });
    card.classList.remove("shk");
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
    if (iv && motionOn()) { Array.prototype.forEach.call(stage.querySelectorAll(".die"), function (d) { d.classList.add("rolling"); }); }
    setTimeout(function () {
      if (iv) clearInterval(iv);
      const r = opts.result;
      if (duel) {
        $("dieA").textContent = duel.attacker.die;
        $("dieB").textContent = duel.defender.die;
        { const aw = duel.attacker.total > duel.defender.total;
          $("dieA").className = "die " + (aw ? "good land" : "bad fum");
          $("dieB").className = "die " + (!aw ? "good land" : "bad fum"); }
        $("mathA").textContent = "d6 + " + duel.attacker.bonus + " = " + duel.attacker.total;
        $("mathB").textContent = "d6 + " + duel.defender.bonus + " = " + duel.defender.total;
        $("rollMath").textContent = "Duelo de dados";
      } else if (r && r.die) {
        $("rollDie").textContent = r.die;
        $("rollDie").className = "die " + (r.success ? "good" : "bad") + (r.crit ? " crit" : r.fumble ? " fum" : r.success ? " land" : "");
        $("rollBanner").innerHTML = ic(r.success ? "ui_exito" : "ui_fallo") + (r.success ? "ÉXITO" : "FALLO"); $("rollBanner").className = "rollbanner pop " + (r.success ? "good" : "bad");
        $("rollWhy").textContent = (r.why || []).length ? "Influye: " + r.why.join(" · ") : "";
        $("rollMath").textContent = "d6 " + signed(r.stat) + (r.focus ? " + foco " + r.focus : "") + (r.status ? " (incluye " + signed(r.status) + " por estados)" : "") + " = " + r.total + " · dificultad " + r.diff;
        if (r.crit) { $("rollBanner").innerHTML = ic("ui_critico") + "✦ FAVOR DEL UMBRAL"; $("rollBanner").className = "rollbanner pop good"; }
        if (r.fumble) { $("rollBanner").innerHTML = ic("s_muerto") + "☠ PRESAGIO"; $("rollBanner").className = "rollbanner pop bad"; }
      } else {
        $("rollDie").innerHTML = ic(opts.icon || "t_umbral");
        $("rollDie").className = "die";
      }
      $("rollOutcome").textContent = opts.text || "";
      /* Efecto del resultado: la acción (si falló, se nota), después lo que te pasó a ti. */
      if (opts.fx) fxPlay(card, opts.fx.name, opts.fx.fam, opts.fx.ok, opts.fx.cls);
      else if (opts.heal) fxPlay(card, "glow", "heal", true);
      if (opts.dying) fxScreen("hurt", "danger", true, "slow");
      else if (opts.hit) { fxScreen("hurt", "danger", true); fxClass(card, "shk", 450); }
      (opts.buttons || []).forEach(function (b) {
        const el = document.createElement("button");
        el.className = b.cls || "";
        const ik = b.ik || (/^(Continuar|Cerrar el Consejo|Ver el)/.test(b.label) ? "ui_continuar" : b.label === "Quedarme con esto" ? "ui_ok" : b.label === "Forzar el destino" ? "ui_critico" : "");
        el.innerHTML = ic(ik) + esc(b.label);
        el.onclick = function () { overlay.classList.add("hidden"); b.onClick(); };
        $("rollActions").appendChild(el);
      });
    }, duel ? 1100 : (opts.result && opts.result.die ? 850 : 500));
  }

  /* ---------------- avisos ---------------- */
  /* En línea no hay traspaso del móvil: los avisos del motor que lo mencionan se reescriben para dispositivo propio. */
  function onl(m) {
    if (!NET || typeof m !== "string") return m;
    return m.replace(/Primero entrega el móvil\.?/i, "Espera un momento: se está cerrando el paso anterior.").replace(/Debes resolver tu acción antes de entregar el turno\.?/i, "Primero resuelve tu acción.");
  }
  function toast(msg, bad) {
    msg = onl(msg);
    Array.prototype.forEach.call(document.querySelectorAll(".toast"), function (o) { o.remove(); });
    const t = document.createElement("div");
    t.className = "toast" + (bad ? " bad" : "");
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, Math.min(6000, 2600 + Math.max(0, String(msg).length - 60) * 30));
  }

  /* ================= EN LÍNEA (net.js) =================
     Aquí vive todo lo que solo existe con servidor: pantalla de espera, ruta de pantallas según la fase de la vista y el enganche con net.js.
     En local (NET = false) nada de este bloque se ejecuta. */
  let lastKey = "", renderedSig = "";
  function netKey(s) { return s.phase + ":" + s.round + ":" + (s.timeAsk ? "t" : ""); }
  /* Botón «listo» de una fase compartida: se desactiva y lista a quién se espera (F4: el servidor cerrará la fase por tiempo). */
  function netWait(btn, iconKey, label) {
    const s = U.getState(), me = U.currentPlayer();
    const wl = s.players.filter(function (x) { return !x.dead && !x.ready; }).map(function (x) { return x.name; });
    btn.classList.toggle("hidden", !!me.dead);
    btn.disabled = !!me.ready;
    setIcoBtn(btn, iconKey, me.ready ? (s.phase === "private" ? "Faltan " + (s.waitN || 0) : "Esperando a: " + (wl.join(", ") || "…")) : label);
  }
  function netVotesHTML(s) {
    const host = s.players.find(function (p) { return p.host; }), V = { 1: "+1 ronda", 2: "+2 rondas", end: "terminar" };
    const vs = Object.keys(s.votes || {}).filter(function (id) { return s.players[id]; }).map(function (id) { return esc(s.players[id].name) + ": " + (V[s.votes[id]] || "?"); });
    const me = s.players[s.youId] || {}, mine = s.votes && s.votes[s.youId];
    return '<p class="small">' + (me.host ? "Eres el anfitrión: tu voto decide al instante." : "Decide el anfitrión" + (host ? " (" + esc(host.name) + ")" : "") + ". Tu voto cuenta" + (mine ? " (has votado: " + V[mine] + ")" : "") + ".") + '</p>' +
      '<p class="small">' + (vs.length ? "Votos: " + vs.join(" · ") + "." : "Aún no hay votos.") + ' Si el anfitrión no decide, en <b data-cd="vote">' + netCdText("vote") + '</b> gana la mayoría (empate: +1 ronda).</p>';
  }
  /* Cuentas atrás del servidor en pantalla (spans data-cd): turnauto = límite de turno + cortesía, vote = votación de tiempo. */
  function netCdSecs(k) {
    if (!U.clockDeadline) return null;
    if (k === "vote") return U.clockLeft("vote");
    return U.clockAutoLeft();
  }
  function netCdText(k) { const n = netCdSecs(k); return n === null ? "…" : (n >= 60 ? Math.floor(n / 60) + " min " + pad2(n % 60) + " s" : n + " s"); }
  function netCd() { Array.prototype.forEach.call(document.querySelectorAll("[data-cd]"), function (el) { el.textContent = netCdText(el.getAttribute("data-cd")); }); }
  /* Aviso para quien ha sido sustituido por un NPC (en línea): quién juega por él y cómo volver. */
  function npcBanner() {
    let b = $("npcBanner");
    const s = NET ? U.getState() : null, info = s && s.npcInfo;
    if (!info) { if (b) b.classList.add("hidden"); return; }
    if (!b) {
      b = document.createElement("div"); b.id = "npcBanner"; b.className = "notice npcbanner"; b.setAttribute("role", "status");
      b.innerHTML = '<span id="npcBannerTxt"></span><button class="ghost smallbtn" id="npcBannerBtn">Recuperar mi sitio</button>';
      $("game").insertBefore(b, $("game").firstChild);
      $("npcBannerBtn").onclick = function () { run(U.recoverSeat(), function (r) { toast(r && r.ok ? "Volverás a jugar al empezar la próxima ronda." : (r && r.msg) || "No se pudo.", !(r && r.ok)); routeNet(); }); };
    }
    b.classList.remove("hidden");
    $("npcBannerTxt").textContent = info.recover ? "Un NPC juega por ti hasta que empiece la próxima ronda; entonces volverás a tu sitio con todo lo que tenías." : (info.auto ? "Estuviste desconectado y un NPC ha tomado tu lugar. " : "El anfitrión ha puesto un NPC en tu lugar. ") + "Conserva tu personaje, tus objetos y tus secretos.";
    $("npcBannerBtn").classList.toggle("hidden", !!info.recover);
  }
  function renderWaiting() {
    stopTimer(); hideAll();
    $("handoff").classList.remove("hidden");
    const s = U.getState(), me = U.currentPlayer();
    $("phaseTag").textContent = "TURNO PRIVADO"; setPhaseIcon("ph_privado");
    $("screenTitle").textContent = "Esperando a los demás"; setStep("");
    { const sg = $("handoffSigil"); sg.className = "bigmedal f-mist"; sg.innerHTML = ic("ph_privado"); }
    $("handoffTitle").textContent = me.dead ? "Has caído" : (s.skipped || []).indexOf(me.id) !== -1 ? "Esta ronda no actúas" : "Decisión sellada";
    $("handoffText").textContent = s.npcInfo ? "Un NPC juega por ti. Observa la partida; puedes recuperar tu sitio con el botón de arriba."
      : me.dead ? "Observas la partida: ya no puedes actuar, pero seguirás viendo el Consejo."
      : (s.skipped || []).indexOf(me.id) !== -1 ? "Estás aturdido o inconsciente. Espera a que los demás terminen su turno."
      : "Tu decisión queda en secreto. Cuando todos hayan terminado se abrirá el Consejo.";
    $("handoffMood").textContent = "";
    $("btnHandoff").classList.add("hidden");
    const wl = $("waitList"), alive = s.players.filter(function (x) { return !x.dead; });
    wl.classList.remove("hidden");
    /* Privacidad: solo «faltan N»; no se muestra quién ha terminado ni quién decide (nadie puede esperar a ser el último). */
    wl.innerHTML = '<div class="tag">' + ic("ui_jugadores", "ic-tag") + 'Faltan ' + (s.waitN || 0) + ' por terminar (de ' + alive.length + ')</div>' +
      '<p class="small waitcd">El turno se cierra solo en <b data-cd="turnauto">' + netCdText("turnauto") + '</b>: quien no haya decidido medita.</p>' +
      alive.map(function (x) { return '<div class="wrow">' + playerMedal(x) + '<b>' + dn(x) + (x.id === me.id ? " (tú)" : "") + '</b>' + (x.absent ? '<span class="chip mid">ausente</span>' : x.online === false ? '<span class="chip mid">sin conexión</span>' : '') + (x.host ? '<span class="chip good">anfitrión</span>' : '') + '</div>'; }).join("");
    updateStatus();
  }
  /* Textos fijos de index.html que hablan de pasar el móvil: solo en línea se reescriben (en local el HTML queda intacto). */
  function netTexts() {
    $("screenTitle").textContent = "Tu turno";
    setIcoBtn($("btnPrepSave"), "ui_guardar", "Guardar declaración");
    const fix = function (root, pairs) { if (!root) return; Array.prototype.forEach.call(root.querySelectorAll("p,li"), function (el) { pairs.forEach(function (pr) { if (el.innerHTML.indexOf(pr[0]) !== -1) el.innerHTML = el.innerHTML.split(pr[0]).join(pr[1]); }); }); };
    fix($("helpOverlay"), [
      ["elige UNA acción en secreto y pasa el móvil.", "elige UNA acción en secreto en su propio móvil; todos juegan a la vez y el Consejo se abre cuando terminan."],
      ["La vibración solo se dispara cuando el móvil ya está en manos de quien afecta, nunca al pasarlo.", "Tu móvil es solo tuyo: la vibración solo avisa de lo que te afecta a ti."],
      [" úsalo si os preocupa que alguien oiga el zumbido.", " úsalo si no quieres que se note nada."]
    ]);
    fix($("councilPanel"), [["se enseña el móvil si queréis", "se enseña lo que queráis"]]);
  }
  /* Pantalla que toca según la vista. Se llama al cambiar de fase/ronda y tras cada mutación propia. */
  function routeNet() {
    const s = U.getState(), me = U.currentPlayer(), prev = lastKey;
    lastKey = netKey(s);
    if (prev !== lastKey) ["overlay", "actionOverlay", "secretOverlay"].forEach(function (id) { $(id).classList.add("hidden"); });
    $("roundLabel").textContent = "RONDA " + s.round + "/" + U.maxRounds();
    updateClock(); updateStatus(); npcBanner();
    if (s.phase === "ending") { hideTimeOverlay(); renderEnding(s.ending || U.getEnding()); return; }
    if (!s.timeAsk) hideTimeOverlay();
    if (s.phase === "private") { if (me.ready) renderWaiting(); else if (me.acted) endTurn(); else renderPrivate(); return; }
    if (s.phase === "council") { renderCouncil(); return; }
    if (s.timeAsk) { renderResolution(s.lastResolution); showTimeAsk(); return; }   /* F4: voto de tiempo (v.timeAsk, v.votes) */
    if (prev.indexOf("council:" + s.round) === 0 && (s.councilResults || []).length) { showCouncilResults(s.councilResults, 0); return; }
    renderResolution(s.lastResolution);
  }
  /* Vista nueva del servidor: cambio de fase -> ruta; mismo paso -> se refresca lo que no estorbe a quien está jugando. */
  function onNetView() {
    const s = U.getState(); if (!s) return;
    if (netKey(s) !== lastKey) { routeNet(); return; }
    const me = U.currentPlayer(), idle = ["overlay", "actionOverlay", "secretOverlay", "storyOverlay", "logOverlay"].every(function (id) { return $(id).classList.contains("hidden"); }) && !timeOverlayOpen();
    $("roundLabel").textContent = "RONDA " + s.round + "/" + U.maxRounds();
    updateClock(); updateStatus(); npcBanner();
    if (s.phase === "ending") return;
    if (s.timeAsk) { if (timeOverlayOpen()) showTimeAsk(); return; }
    if (s.phase === "private") {
      if (me.ready) { renderWaiting(); return; }
      const pend = pendingAction || pendingStake || pendingMode || pendingSpell || pendingStudy || pendingItem !== null;
      if (U.isBusy()) return; /* hay una orden propia en vuelo: su respuesta decide la pantalla */
      /* Otro jugador te dejó sin turno (aturdir/grillete) o caíste moribundo: el motor te marca «acted» sin que hayas elegido. F4: lo cierra el servidor. */
      if (idle && !pend && me.acted && !me.dead && !$("privatePanel").classList.contains("hidden")) { toast(me.dying ? "Caes inconsciente: esta ronda ya no actúas." : "Pierdes tu turno de esta ronda.", true); endTurn(); return; }
      if (idle && !pend && !$("privatePanel").classList.contains("hidden") && U.sig !== renderedSig) renderPrivate();
    } else if (idle && s.phase === "council") renderCouncil();
    else if (idle && !$("resolutionPanel").classList.contains("hidden")) renderResolution(s.lastResolution);
  }
  window.UmbralUI = {
    toast: toast, parseEnd: parseEnd, hm: hm,
    attach: function (backend) {
      U = backend; NET = true; $("start").classList.add("hidden");
      setIcoBtn($("btnSaveExit"), "ui_salir", "Salir (puedes volver a la sala)"); setIcoBtn($("btnBackExit"), "ui_salir", "Salir (puedes volver a la sala)");
      $("backOverlay").querySelector("p.small").textContent = "Seguirás en la sala: al volver a abrir el juego en este móvil te reconectas solo.";
      netTexts();
      enterGame(true); routeNet();
    },
    onView: onNetView
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
