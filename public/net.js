/* EL UMBRAL — cliente en línea (F3).
   - OnlineBackend: mismas firmas que window.UMBRAL para ui.js, pero sin motor: las consultas salen de la vista filtrada
     que manda el servidor (q.*) y las mutaciones son comandos POST /cmd que devuelven una Promise.
   - Lobby en la pantalla de inicio (#onlineCard): crear sala, unirse con código, sala de espera, iniciar.
   - Transporte: EventSource (SSE) con reconexión; el token de jugador vive solo en localStorage y nunca se escribe en consola.
   - PRIVACIDAD: nada de lo que guarda este archivo sale de la vista del propio jugador (v.me + datos públicos + q.*).
   Servidor (F4, pendiente): temporizadores del servidor, votación de tiempo, aturdir/grillete a la ronda siguiente, 10 s de lectura.
   Los ganchos de la interfaz ya existen (ver «F4» en ui.js: votos de tiempo y lista de espera salen de v.votes / v.wait). */
(function () {
  "use strict";

  /* Servidor público (Render). Para pruebas: «Servidor (avanzado)» en el menú, o ?server=http://localhost:3000 */
  const ONLINE_URL = "https://el-umbral-h1ki.onrender.com";
  const K_SESSION = "umbral_online_session", K_SERVER = "umbral_server", K_NAME = "umbral_online_name", K_SNAP = "umbral_online_snap_";
  const LOCAL = window.UMBRAL;
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  const ico = function (k, c) { try { return typeof window.icon === "function" ? window.icon(k, c) : ""; } catch (e) { return ""; } };
  const UI = function () { return window.UmbralUI || {}; };
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* idem */ } }

  /* Instantánea cifrada de la sala (blob opaco que manda el servidor): solo la última, por código de sala. Si el servidor se reinicia
     (despliegue), se sube a /api/restore y la partida continúa. No contiene nada legible: está cifrada con una clave que solo tiene el servidor. */
  function snapGet(room) { return room ? lsGet(K_SNAP + room) : null; }
  function snapSet(room, blob) { if (room && typeof blob === "string" && blob.length > 40 && blob.length < 1500000 && /^U\d+\.[A-Za-z0-9_-]+$/.test(blob)) lsSet(K_SNAP + room, blob); }
  function snapDel(room) { if (room) lsDel(K_SNAP + room); }

  /* ---------- servidor ---------- */
  /* "" = mismo origen (página servida por http/https); null = sin servidor directo (file:// o APK): se abre ONLINE_URL fuera. */
  function customServer() { return String(lsGet(K_SERVER) || "").trim().replace(/\/+$/, ""); }
  function serverBase() { const c = customServer(); if (c) return c; return /^https?:$/.test(location.protocol) ? "" : null; }
  function openExternal(url) {
    try { const a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; a.style.display = "none"; document.body.appendChild(a); a.click(); a.remove(); }
    catch (e) { try { window.open(url, "_blank"); } catch (e2) { /* nada */ } }
  }

  /* ---------- HTTP ---------- */
  /* Nunca rechaza: devuelve {ok:false, net:true, msg} si no hay red. */
  function post(path, body, token, timeoutMs) {
    const base = session ? session.server : serverBase();
    if (base === null) return Promise.resolve({ ok: false, net: true, msg: "No hay servidor configurado." });
    let ctl = null, timer = null;
    try { ctl = typeof AbortController === "function" ? new AbortController() : null; } catch (e) { ctl = null; }
    if (ctl) timer = setTimeout(function () { try { ctl.abort(); } catch (e) { /* nada */ } }, timeoutMs || 20000);
    const headers = { "Content-Type": "application/json" };
    if (token) { headers["x-token"] = token; if (session && session.room) headers["x-room"] = session.room; }
    return fetch(base + path, { method: "POST", headers: headers, body: JSON.stringify(body || {}), signal: ctl ? ctl.signal : undefined, cache: "no-store" })
      .then(function (r) { return r.json().catch(function () { return { ok: false, msg: "Respuesta no válida del servidor." }; }).then(function (j) { j.status = r.status; return j; }); })
      .catch(function () { return { ok: false, net: true, msg: "No hay conexión con el servidor. Inténtalo de nuevo." }; })
      .then(function (j) { if (timer) clearTimeout(timer); return j; });
  }

  /* ---------- sesión y transporte ---------- */
  let session = null;           /* { server, room, pid, token } */
  let es = null, reopenT = null, backoff = 2000, pingT = null, connected = true;
  /* Versión distinta a la del servidor: un cliente viejo (caché o APK antiguo) pinta mal el panel. Se intenta actualizar una vez; si no se puede, se avisa. */
  function versionGuard(srv) {
    let tried = false;
    try { tried = sessionStorage.getItem("umbral-upd") === srv; } catch (e) {}
    if (!tried) {
      try { sessionStorage.setItem("umbral-upd", srv); } catch (e) {}
      const go = function () { location.reload(); };
      try { (navigator.serviceWorker && navigator.serviceWorker.getRegistrations ? navigator.serviceWorker.getRegistrations() : Promise.resolve([])).then(function (rs) { return Promise.all(rs.map(function (r) { return r.unregister(); })); }).then(function () { return window.caches ? caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); }) : null; }).then(go, go); } catch (e) { go(); }
      return true;
    }
    if (!document.getElementById("verBanner")) {
      const d = document.createElement("div"); d.id = "verBanner";
      d.style.cssText = "position:fixed;left:0;right:0;top:0;z-index:99999;background:#7a2b2b;color:#fff;padding:8px 12px;font:600 14px/1.3 sans-serif;text-align:center";
      d.textContent = "Tu app es de otra versión que la sala (" + (LOCAL.D.VERSION || "?") + " / " + srv + "). Actualiza o reinstala la app para ver todas las opciones.";
      document.body.appendChild(d);
    }
    return false;
  }
  let lastVer = -1, lobby = null, cur = null, st = null, offset = 0, busy = false, attached = false, lost = false;
  let warnOff = false, taken = false, noteSeq = 0, restoreState = 0, restoreTries = 0, restoreT = null; /* restoreState: 0 no, 1 restaurando, 2 fallida (reintentable) */
  const seenUnlock = {};

  function saveSession() { if (session) lsSet(K_SESSION, JSON.stringify(session)); }
  function clearSession() { if (session) snapDel(session.room); session = null; taken = false; noteSeq = 0; restoreState = 0; restoreTries = 0; clearTimeout(restoreT); restoreT = null; lsDel(K_SESSION); }
  function closeStream() { clearTimeout(reopenT); reopenT = null; if (es) { try { es.close(); } catch (e) { /* nada */ } es = null; } clearInterval(pingT); pingT = null; }

  function banner() {
    let b = $("netBanner");
    if (!b) {
      b = document.createElement("div"); b.id = "netBanner"; b.className = "netbanner hidden"; b.setAttribute("role", "status");
      b.innerHTML = '<span id="netBannerTxt"></span><button class="ghost smallbtn" id="netBannerBtn"></button>';
      document.body.appendChild(b);
      $("netBannerBtn").onclick = function () { if (lost) { location.reload(); } else if (restoreState === 2) { startRestore(); } else if (taken) { taken = false; backoff = 2000; openStream(); } else leaveRoom(true); };
    }
    return b;
  }
  function setConn(ok, text) {
    connected = ok;
    const b = banner();
    if (ok && !lost) { b.classList.add("hidden"); return; }
    if (!session && !lost) { b.classList.add("hidden"); return; }
    $("netBannerTxt").textContent = text || (lost ? "La sala ya no existe (el servidor se reinició o caducó)." : "Sin conexión con el servidor. Reconectando…");
    $("netBannerBtn").textContent = lost ? "Volver al inicio" : restoreState === 2 ? "Reintentar" : taken ? "Usar aquí" : "Abandonar sala";
    b.classList.remove("hidden");
  }
  function sessionLost(msg) {
    closeStream(); clearSession();
    if (attached) { lost = true; setConn(false, msg); }
    else { lost = false; banner().classList.add("hidden"); lobby = null; showHome(msg || "La sala ya no existe (el servidor se reinició o caducó).", true); }
  }
  /* El servidor responde «sala desconocida» (404): se reinició. Si hay instantánea, se restaura la partida; si no, la sala se perdió. */
  function isUnknownRoom(r) { return !!r && r.status === 404 && r.unknownRoom === true; }
  function roomGone(r) {
    if (!session) return;
    if (r && r.status === 401) { sessionLost(); return; }
    if (!snapGet(session.room)) { sessionLost(); return; }
    closeStream(); startRestore();
  }
  function startRestore() {
    if (!session || (restoreState === 1)) return;
    restoreState = 1; restoreTries = 0; clearTimeout(restoreT); restoreT = null;
    setConn(false, "Restaurando la partida… (el servidor se acaba de actualizar)");
    tryRestore();
  }
  function tryRestore() {
    const s = session; if (!s) { restoreState = 0; return; }
    const blob = snapGet(s.room);
    if (!blob) { restoreState = 0; sessionLost(); return; }
    post("/api/restore", { room: s.room, blob: blob }, s.token, 45000).then(function (r) {
      if (session !== s) { return; }
      if (r.ok) { restoreState = 0; restoreTries = 0; backoff = 2000; openStream(); return; }
      /* definitivo: el servidor cambió de versión, la instantánea caducó o no es válida, o la restauración está desactivada */
      if (r.status === 400 || r.status === 401 || r.status === 404 || r.status === 409 || r.status === 410) {
        restoreState = 0; sessionLost(r.status === 409 ? "El servidor se actualizó y no pudo recuperar esta partida." : "No se pudo recuperar la partida (la sala ya no existe).");
        return;
      }
      /* transitorio (sin red, servidor despertando, 429/5xx/503): reintento con espera creciente */
      restoreTries++;
      if (restoreTries >= 8) { restoreState = 2; setConn(false, "No se pudo restaurar la partida. Comprueba la conexión e inténtalo de nuevo."); return; }
      setConn(false, "Restaurando la partida… (reintento " + restoreTries + ")");
      restoreT = setTimeout(function () { restoreT = null; tryRestore(); }, Math.min(15000, Math.round(2000 * Math.pow(1.6, restoreTries))));
    });
  }

  function openStream() {
    if (!session || taken) return;
    closeStream();
    if (restoreState) return;
    lastVer = -1; /* tras reiniciar el servidor `ver` salta: la primera vista de una conexión nueva siempre vale */
    const url = session.server + "/events?t=" + encodeURIComponent(session.token) + "&room=" + encodeURIComponent(session.room);
    try { es = new EventSource(url); } catch (e) { scheduleReopen(); return; }
    es.addEventListener("view", function (ev) { try { onView(JSON.parse(ev.data)); } catch (e) { /* vista dañada: se espera la siguiente */ } });
    /* Otra pestaña/dispositivo abrió la misma sesión: esta deja de reconectar y ofrece volver a usarla aquí. */
    es.addEventListener("snapshot", function (ev) { try { if (session) snapSet(session.room, String(ev.data)); } catch (e) { /* sin almacenamiento */ } });
    es.addEventListener("replaced", function () { taken = true; closeStream(); setConn(false, "Esta sala se abrió en otra pestaña o dispositivo."); });
    es.onopen = function () { backoff = 2000; setConn(true); };
    es.onerror = function () { setConn(false); if (es && es.readyState === 2) scheduleReopen(); };
    clearInterval(pingT); pingT = setInterval(pingTick, 20000);
  }
  /* Un SSE cortado en silencio (red caída sin RST) no avisa: el ping lo detecta, muestra el aviso y reabre el flujo; también mantiene despierto Render. */
  function pingTick() {
    if (!session) return;
    post("/api/ping", {}, session.token, 8000).then(function (r) {
      if (!session) return;
      if (isUnknownRoom(r) || r.status === 401) { roomGone(r); return; }
      if (r.net) { setConn(false); if (es) { try { es.close(); } catch (e) { /* nada */ } es = null; } scheduleReopen(); return; }
      if (!connected || !es || es.readyState === 2) openStream();
    });
  }
  /* EventSource solo se reconecta solo ante cortes de red; si el servidor contestó con error (p. ej. 401) se cierra: se comprueba el token y se reabre. */
  function scheduleReopen() {
    if (reopenT || !session) return;
    reopenT = setTimeout(function () {
      reopenT = null; if (!session) return;
      post("/api/ping", {}, session.token, 8000).then(function (r) {
        if (!session) return;
        if (isUnknownRoom(r) || r.status === 401) { roomGone(r); return; }
        if (r.net) { backoff = Math.min(15000, backoff * 1.6); scheduleReopen(); return; }
        openStream();
      });
    }, backoff);
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden && session && (!es || es.readyState !== 1)) { clearTimeout(reopenT); reopenT = null; openStream(); } });
  window.addEventListener("offline", function () { if (session) setConn(false); });
  window.addEventListener("online", function () { if (session) { clearTimeout(reopenT); reopenT = null; backoff = 2000; openStream(); } });

  /* ---------- vistas ---------- */
  function signature(v) {
    const q = v.q || {};
    return JSON.stringify([v.me, q.offer, q.pactOffers, q.handOffer, v.players.map(function (p) { return [p.dead, p.dying, p.visibleHealth, p.look]; }), v.event, (v.chronicle || []).length, v.skipped]);
  }
  /* Estado que ve ui.js: SOLO datos públicos de los demás + el jugador propio completo. */
  function buildState(v) {
    const players = v.players.map(function (p) {
      return { id: p.id, name: p.name, dead: p.dead, dying: p.dying, exposed: p.exposed, susp: p.susp || 0, visibleHealth: p.visibleHealth, look: p.look, ready: p.ready, online: p.online, absent: p.absent, host: p.host, npc: !!p.npc, alignment: p.exposed ? "asesino" : undefined };
    });
    const pub = players[v.youId], me = v.me || {};
    players[v.youId] = Object.assign({}, me, { dead: pub.dead, dying: pub.dying, exposed: pub.exposed, susp: pub.susp || 0, visibleHealth: pub.visibleHealth, look: pub.look, ready: pub.ready, online: pub.online, absent: pub.absent, host: pub.host, npc: !!pub.npc, protection: me.protected ? -1 : null });
    (me.risen || []).forEach(function (id) { if (players[id] && ((v.q || {}).risen || []).indexOf(players[id].name) !== -1) players[id].risenBy = v.youId; });
    const ex = players.find(function (p) { return p.exposed; });
    return { round: v.round, phase: v.phase, players: players, turn: v.youId, youId: v.youId, handoff: false, event: v.event, chronicle: v.chronicle || [], publicClues: v.publicClues || [],
      timeAsk: v.timeAsk || null, skipped: v.skipped || [], lastResolution: v.lastResolution || [], councilResults: v.councilResults || [], ending: v.ending || null,
      votes: v.votes || {}, wait: v.wait || [], waitN: v.waitN || 0, npcInfo: v.npcInfo || null, assassinId: ex ? ex.id : null, maxRounds: v.maxRounds, endAt: v.endAt || null, order: players.map(function (p) { return p.id; }) };
  }
  function onView(v, silent) {
    if (!v || typeof v !== "object") return;
    if (typeof v.ver === "number") { if (v.ver < lastVer) return; lastVer = v.ver; }
    if (v.hostNote && v.hostNote.seq > noteSeq) { noteSeq = v.hostNote.seq; if (UI().toast) UI().toast(v.hostNote.name === (v.players && v.players[v.youId] && v.players[v.youId].name) ? "Ahora eres el anfitrión." : v.hostNote.name + " es ahora el anfitrión (el anterior perdió la conexión).", false); }
    if (v.phase === "ending" && session) snapDel(session.room); /* partida terminada: la instantánea ya no sirve */
    if (v.phase === "error") { if (UI().toast) UI().toast(v.msg || "Error del servidor.", true); return; }
    if (v.phase === "lobby") { lobby = v; if ($("btnChat")) $("btnChat").classList.add("hidden"); renderRoom(); return; }
    if (!v.me || !v.players || !v.players[v.youId]) return;
    if ($("btnChat")) $("btnChat").classList.remove("hidden");
    renderChat(v);
    if (v.srvVer && LOCAL.D && LOCAL.D.VERSION && v.srvVer !== LOCAL.D.VERSION && versionGuard(v.srvVer)) return;
    cur = v; offset = (v.serverNow || Date.now()) - Date.now(); st = buildState(v); B.sig = signature(v);
    if (!attached) { attached = true; if (UI().attach) UI().attach(B); return; }
    if (!silent && UI().onView) UI().onView();
  }

  /* ---------- OnlineBackend (mismas firmas que window.UMBRAL, lo que usa ui.js) ---------- */
  const qv = function () { return (cur && cur.q) || {}; };
  const gone = function (o, k) { return o && o[k] !== undefined ? o[k] : null; };
  function leftMs() { return cur && cur.endAt ? cur.endAt - (Date.now() + offset) : Infinity; }
  function cmd(name, args) {
    if (!session) return Promise.resolve({ ok: false, msg: "No hay sesión en línea." });
    if (busy) return Promise.resolve({ ok: false, dup: true, msg: "" }); /* doble toque: se ignora (el primero sigue en vuelo) */
    busy = true; document.body.classList.add("netbusy");
    return post("/cmd", { cmd: name, args: args || [] }, session.token).then(function (r) {
      busy = false; document.body.classList.remove("netbusy");
      if (isUnknownRoom(r) || r.status === 401) roomGone(r);
      if (r.view) { onView(r.view, true); delete r.view; }
      return r;
    });
  }
  const nn = function (x) { return x === undefined ? null : x; };
  const B = {
    online: true, sig: "", isBusy: function () { return busy; }, D: LOCAL.D, COUNCIL_SECONDS: LOCAL.COUNCIL_SECONDS, VERSION: LOCAL.VERSION,
    /* --- consultas (de la vista) --- */
    getState: function () { return st; },
    currentPlayer: function () { return st ? st.players[st.youId] : null; },
    maxRounds: function () { return cur ? cur.maxRounds : 0; },
    visibleHealth: function (p) { return p && p.visibleHealth != null ? p.visibleHealth : ""; },
    isUnlocked: function (p, a) { return !!(qv().unlocked || {})[a.id]; },
    visibleActions: function () {
      const a = qv().actions, byId = function (id) { return B.D.ACTIONS.find(function (x) { return x.id === id; }); };
      if (!a) return { main: [], more: [], total: 0, hidden: 0 };
      const ok = function (x) { return !!x; };   /* cliente más antiguo que el servidor: ignora acciones que no conoce en vez de romper el panel */
      return { main: a.main.map(byId).filter(ok), more: a.more.map(function (g) { return { id: g.id, label: g.label, acts: g.acts.map(byId).filter(ok) }; }).filter(function (g) { return g.acts.length; }), total: a.total, hidden: a.hidden };
    },
    lockedList: function () { return qv().locked || []; },
    targetsFor: function (actionId) { return (qv().targets || {})[actionId] || []; },
    actionOdds: function (pid, aid) { return (qv().odds || {})[aid] || null; },
    spellInfo: function (pid, sid, tid, mode) { const e = (qv().spells || {})[sid], m = e && e.info[tid == null ? "-" : tid]; return (m && m[mode]) || null; },
    spellProgress: function (sp) { return LOCAL.spellProgress(sp); },
    healthInfo: function () { return qv().health; }, treatOptions: function () { return qv().treat || []; }, xpInfo: function () { return qv().xp; }, domInfo: function () { return qv().dom; },
    secretInfo: function () { return gone(qv(), "secret"); }, umbralInfo: function () { return gone(qv(), "umbral"); }, indagarInfo: function () { return qv().lead || { avail: 0, per: 1 }; },
    activePacts: function () { return qv().pacts || []; }, getSince: function () { return gone(qv(), "since"); },
    getOffer: function () { return gone(qv(), "offer"); }, getHandOffer: function () { return gone(qv(), "handOffer"); },
    getPactOffers: function () { return qv().pactOffers || []; }, declareOptions: function () { return gone(qv(), "declare"); },
    encounterStart: function () { return gone(qv(), "encounter"); },
    unlockNotices: function () { /* una sola vez por aviso */
      return (qv().unlocks || []).filter(function (t) { const k = (st ? st.round : 0) + ":" + t; if (seenUnlock[k]) return false; seenUnlock[k] = 1; return true; });
    },
    suspName: function (l) { return LOCAL.suspName(l); }, suspLevel: function (p) { return (p && p.susp) || 0; }, pactTerms: function (t, a, b) { return LOCAL.pactTerms(t, a, b); }, pSuccess: function (b, d) { return LOCAL.pSuccess(b, d); }, hhmm: function (ts) { return LOCAL.hhmm(ts); },
    turnSeconds: function () { return qv().turnSeconds || 75; }, councilSeconds: function () { return qv().councilSeconds || 90; },
    councilPrompt: function () { return qv().councilPrompt || ""; }, behindSchedule: function () { return !!qv().behindSchedule; },
    timeLeftMs: leftMs, endAtTs: function () { return cur ? cur.endAt || null : null; }, elapsedMin: function () { return 0; },
    extEnd: function (k) { const e = qv().extEnd; return e ? e[k] || null : null; },
    timeWarn: function () { const l = leftMs(); return !warnOff && !!st && st.phase !== "ending" && !st.timeAsk && !(cur && cur.timeAdd) && l > 0 && l <= 120000; },
    dismissWarn: function () { warnOff = true; }, addTime: function () { return cmd("addTime", []); }, /* lo decide el anfitrión en el servidor */
    /* Relojes del servidor (el cliente solo muestra): fecha límite en hora LOCAL del cliente (corrige el desfase) o segundos que quedan. */
    clockKind: function () { return cur && cur.clock ? cur.clock.kind : null; },
    clockDeadline: function (kind) { const c = cur && cur.clock; return c && (!kind || c.kind === kind) ? c.deadline - offset : null; },
    clockAutoLeft: function () { const c = cur && cur.clock; return c && c.kind === "turn" && c.autoAt ? Math.max(0, Math.ceil((c.autoAt - offset - Date.now()) / 1000)) : null; },
    clockLeft: function (kind) { const d = B.clockDeadline(kind); return d === null ? null : Math.max(0, Math.ceil((d - Date.now()) / 1000)); },
    readLeft: function () { const c = cur && cur.clock; return c && c.kind === "turn" && c.readUntil ? Math.max(0, Math.ceil((c.readUntil - offset - Date.now()) / 1000)) : 0; },
    getEnding: function () { return cur ? cur.ending || null : null; },
    exportLog: function () { return cur && cur.log || ""; }, exportStory: function () { return cur && cur.story || ""; }, buildStory: function () { return cur && cur.storyList || []; },
    endCouncil: function () { return st ? st.lastResolution : []; }, resolveCouncil: function () { return []; }, nextTurn: function () { return "blocked"; },
    tick: function () {}, noteError: function () {}, save: function () {}, hasSave: function () { return null; },
    clearSave: function () { closeStream(); clearSession(); },
    /* --- mutaciones: Promise<{ok,msg,...}> --- */
    act: function (pid, aid, t, stake, sk) { return cmd("act", [aid, nn(t), nn(stake), Array.isArray(sk) ? sk : null]); },
    challenge: function () { return cmd("challenge", []); },
    pushLuck: function () { return cmd("pushLuck", []); },
    cast: function (pid, sid, t, mode, sk) { return cmd("cast", [sid, nn(t), mode, Array.isArray(sk) ? sk : null]); },
    useItem: function (pid, idx, t) { return cmd("useItem", [idx, nn(t)]); },
    studyOptions: function (pid, idx) { return cmd("study", [idx]); },
    learnSpell: function (pid, idx, form, sk) { return cmd("learnSpell", [idx, form, Array.isArray(sk) ? sk : null]); },
    improveSpell: function (pid, sid, sk) { return cmd("improveSpell", [sid, Array.isArray(sk) ? sk : null]); },
    answerOffer: function (pid, yes) { return cmd("answerOffer", [!!yes]); }, answerHand: function (pid, yes) { return cmd("answerHand", [!!yes]); },
    answerPact: function (pid, idx, yes) { return cmd("answerPact", [idx, !!yes]); },
    declare: function (pid, type, t, lead) { return cmd("declare", lead === undefined || lead === null ? [type, nn(t)] : [type, nn(t), lead]); },
    encounterAct: function (pid, oid) { return cmd("encounterAct", [oid]); },
    finishTurn: function () { return cmd("finishTurn", []); },
    replaceWithNpc: function (pid) { return cmd("replaceWithNpc", [pid]); }, recoverSeat: function () { return cmd("recoverSeat", []); },
    councilReady: function () { return cmd("councilReady", []); },
    nextRound: function () { return cmd("continue", []); },
    answerTime: function (k) { return cmd("vote", [k]); },
    sendChat: sendChat
  };

  /* ---------- lobby ---------- */
  function setMsg(t, bad) { const m = $("onMsg"); if (!m) return; m.textContent = t || ""; m.className = "small onmsg" + (bad ? " bad" : ""); }
  function showPanel(which) { ["onHome", "onExternal", "onRoom"].forEach(function (id) { const e = $(id); if (e) e.classList.toggle("hidden", id !== which); }); }
  function showMode(online) {
    $("localCard").classList.toggle("hidden", online); $("onlineCard").classList.toggle("hidden", !online);
    $("btnModeLocal").classList.toggle("on", !online); $("btnModeOnline").classList.toggle("on", online);
    $("btnModeLocal").setAttribute("aria-pressed", String(!online)); $("btnModeOnline").setAttribute("aria-pressed", String(online));
  }
  function showHome(msg, bad) {
    showMode(true);
    if (session) { showPanel("onRoom"); return; }
    showPanel(serverBase() === null ? "onExternal" : "onHome");
    setMsg(msg || "", bad);
  }
  function lockForm(on) { ["btnOnCreate", "btnOnJoin"].forEach(function (id) { if ($(id)) $(id).disabled = !!on; }); }
  function nameVal() { const n = String($("onName").value || "").replace(/\s+/g, " ").trim(); if (n) lsSet(K_NAME, n); return n; }
  const WAKE = "Conectando con el servidor… el servidor gratuito puede tardar ~1 min en despertar.";
  function explain(r, joining) {
    if (r.net) return "No se pudo conectar con el servidor. Si es el gratuito, puede tardar ~1 min en despertar: espera un poco y vuelve a intentarlo.";
    if (r.status === 404) return joining ? "No existe esa sala. Revisa el código (5 letras)." : "El servidor no reconoce esta acción (¿es un servidor de El Umbral?).";
    return r.msg || "No se pudo completar la acción.";
  }
  function enter(r, base) {
    session = { server: base, room: r.room, pid: r.pid, token: r.token }; saveSession();
    lost = false; lastVer = -1; lobby = null; attached = false;
    showPanel("onRoom"); renderRoom(); setMsg(""); lockForm(false);
    openStream();
  }
  /* Render (plan gratuito) duerme el servicio: la primera petición puede tardar ~50 s o recibir 502/503/HTML de arranque. Se reintenta con aviso. */
  function postWake(path, body, tries) {
    const left = tries == null ? 3 : tries;
    return post(path, body, "", 75000).then(function (r) {
      const sleeping = r && !r.ok && (r.net || r.status === 502 || r.status === 503 || r.status === 504 || r.msg === "Respuesta no válida del servidor.");
      if (!sleeping || left <= 1) return r;
      setMsg("Despertando el servidor… (el servidor gratuito puede tardar ~1 min). Reintentando…");
      return new Promise(function (res) { setTimeout(res, 4000); }).then(function () { return postWake(path, body, left - 1); });
    });
  }
  function createRoom() {
    const name = nameVal(), base = serverBase();
    if (!name) { setMsg("Escribe tu nombre.", true); return; }
    lockForm(true); setMsg(WAKE);
    postWake("/api/create", { name: name }).then(function (r) { lockForm(false); if (r.ok && r.token) enter(r, base); else setMsg(explain(r, false), true); });
  }
  function joinRoom() {
    const name = nameVal(), code = String($("onCode").value || "").toUpperCase().replace(/[^A-Z]/g, ""), base = serverBase();
    if (!name) { setMsg("Escribe tu nombre.", true); return; }
    if (code.length !== 5) { setMsg("El código son 5 letras.", true); return; }
    lockForm(true); setMsg(WAKE);
    postWake("/api/join", { room: code, name: name }).then(function (r) { lockForm(false); if (r.ok && r.token) enter(r, base); else setMsg(explain(r, true), true); });
  }
  function leaveRoom(silent) {
    const s = session;
    closeStream(); clearSession(); lobby = null; attached = false;
    if (s) post("/api/leave", {}, s.token, 5000);
    if (silent && $("game") && !$("game").classList.contains("hidden")) { location.reload(); return; }
    setConn(true); showHome("");
  }
  function shareLink() { return (session && session.server ? session.server : location.origin) + "/?sala=" + (lobby ? lobby.code : (session ? session.room : "")); }
  function copyText(t, okMsg) {
    let ok = false;
    try { const ta = document.createElement("textarea"); ta.value = t; ta.style.cssText = "position:fixed;top:0;left:0;opacity:0"; document.body.appendChild(ta); ta.focus(); ta.select(); ok = document.execCommand("copy"); ta.remove(); } catch (e) { ok = false; }
    if (!ok && navigator.clipboard) { navigator.clipboard.writeText(t).then(function () { UI().toast(okMsg); }, function () { UI().toast("No se pudo copiar: " + t, true); }); return; }
    UI().toast(ok ? okMsg : "No se pudo copiar: " + t, !ok);
  }
  function escChat(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function renderChat(v) {
    const msgs = v && Array.isArray(v.chat) ? v.chat : [];
    const render = function (id) {
      const el = $(id); if (!el) return;
      el.innerHTML = msgs.map(function (m) {
        const mine = typeof v.youId === "number" && m.pid === v.youId;
        return '<div class="chatmsg' + (mine ? ' mine' : '') + '"><b>' + escChat(m.name) + '</b><span>' + escChat(m.text) + '</span></div>';
      }).join("");
      el.scrollTop = el.scrollHeight;
    };
    render("roomChat"); render("gameChat");
  }
  function sendChat(text) {
    if (!session) return Promise.resolve({ ok: false, msg: "No hay sesión en línea." });
    text = String(text || "").trim();
    if (!text) return Promise.resolve({ ok: false, msg: "Escribe un mensaje." });
    return post("/api/chat", { text: text }, session.token).then(function (r) {
      if (isUnknownRoom(r) || r.status === 401) roomGone(r);
      return r;
    });
  }
  function setupEmojiPicker(buttonId, inputId, pickerId) {
    const button = $(buttonId), input = $(inputId), picker = $(pickerId);
    if (!button || !input || !picker) return;
    const emojis = ["😀","😂","😍","🥰","😎","🤔","😭","😡","😈","👻","👍","👏","🙌","🙏","👋","🤝","❤️","🔥","✨","⭐","🎉","🎲","🗡️","🛡️","🌙","☠️","🍀","💀","👁️","🕯️","🌑","💛"];
    picker.innerHTML = emojis.map(function (emoji) {
      return '<button type="button" data-emoji="' + esc(emoji) + '" aria-label="Añadir ' + esc(emoji) + '">' + esc(emoji) + '</button>';
    }).join("");
    button.onclick = function () {
      const willOpen = picker.classList.contains("hidden");
      document.querySelectorAll(".emojipicker").forEach(function (el) { el.classList.add("hidden"); });
      picker.classList.toggle("hidden", !willOpen);
      if (willOpen) input.focus();
    };
    picker.onclick = function (e) {
      const el = e.target.closest("button[data-emoji]");
      if (!el) return;
      const emoji = el.getAttribute("data-emoji") || "";
      const start = typeof input.selectionStart === "number" ? input.selectionStart : input.value.length;
      const end = typeof input.selectionEnd === "number" ? input.selectionEnd : start;
      const combined = input.value.slice(0, start) + emoji + input.value.slice(end);
      input.value = Array.from(combined).slice(0, 300).join("");
      const cursor = Math.min(start + Array.from(emoji).length, input.value.length);
      input.focus();
      if (typeof input.setSelectionRange === "function") input.setSelectionRange(cursor, cursor);
      picker.classList.add("hidden");
    };
  }
  function renderRoom() {
    showMode(true); showPanel("onRoom");
    const v = lobby;
    $("roomCode").textContent = v ? v.code : (session ? session.room : "·····");
    const host = !!(v && v.host);
    $("roomHost").classList.toggle("hidden", !host);
    $("roomGuest").classList.toggle("hidden", host || !v);
    $("roomConnecting").classList.toggle("hidden", !!v);
    if (!v) { $("roomPlayers").innerHTML = ""; return; }
    const npcs = v.npcs || [], total = v.players.length + npcs.length;
    $("roomCount").textContent = total + " / " + v.max + " jugadores (mínimo " + v.min + (npcs.length ? "; " + npcs.length + " NPC" : "") + ")";
    $("roomPlayers").innerHTML = v.players.map(function (p) {
      return '<div class="player rplayer"><div class="prow">' + ico("ui_jugador", "ic-md") + '<div class="grow"><b>' + esc(p.name) + '</b></div>' +
        (p.id === v.youId ? '<span class="chip mid">tú</span>' : '') + (p.host ? '<span class="chip good">anfitrión</span>' : '') + (p.online ? '' : '<span class="chip low">sin conexión</span>') + '</div></div>';
    }).join("");
    $("roomNpcs").innerHTML = npcs.map(function (n) {
      return '<div class="player rplayer"><div class="prow">' + ico("ui_jugador", "ic-md") + '<div class="grow"><b>' + esc(n.name) + '</b></div><span class="chip mid">NPC</span>' +
        (host ? '<button class="ghost smallbtn" data-npcrm="' + n.id + '" aria-label="Quitar a ' + esc(n.name) + '">Quitar</button>' : '') + '</div></div>';
    }).join("");
    $("roomNpcCtl").classList.toggle("hidden", !host);
    $("btnOnNpcAdd").disabled = total >= v.max;
    $("btnOnStart").disabled = !v.canStart;
    $("roomNeed").textContent = total < v.min ? "Hacen falta al menos " + v.min + " jugadores (con NPC) para empezar." : "";
    renderChat(v);
    refreshNetEnd();
  }
  function refreshNetEnd() {
    const el = $("netEndInfo"), pe = UI().parseEnd ? UI().parseEnd(null, "netEnd") : { ok: false, msg: "" };
    if (!el) return;
    if (pe.ok) { el.className = "small endinfo"; el.textContent = "Terminará a las " + UI().hm(pe.t) + " (unos " + pe.mins + " min desde ahora)."; }
    else { el.className = "small endinfo bad"; el.textContent = pe.msg; }
    if ($("btnOnStart") && lobby) $("btnOnStart").disabled = !(pe.ok && lobby.canStart);
  }
  function npcOp(body) {
    if (!session) return;
    post("/api/npc", body, session.token).then(function (r) {
      if (isUnknownRoom(r) || r.status === 401) { roomGone(r); return; }
      if (!r.ok) UI().toast(r.msg || "No se pudo cambiar los NPC.", true);
    });
  }
  function startGame() {
    const pe = UI().parseEnd("", "netEnd");
    if (!pe.ok) { refreshNetEnd(); UI().toast(pe.msg, true); return; }
    $("btnOnStart").disabled = true;
    post("/api/start", { endAt: pe.endAt }, session.token).then(function (r) {
      if (isUnknownRoom(r) || r.status === 401) { roomGone(r); return; }
      if (!r.ok) { UI().toast(r.msg || "No se pudo empezar.", true); refreshNetEnd(); }
    });
  }

  function initLobby() {
    const base0 = serverBase();
    setupEmojiPicker("btnRoomEmoji", "roomChatInput", "roomEmojiPicker");
    setupEmojiPicker("btnGameEmoji", "gameChatInput", "gameEmojiPicker");
    /* parámetros de la URL: ?sala=ABCDE y ?server=http://... (para pruebas) */
    let qs = null; try { qs = new URLSearchParams(location.search); } catch (e) { qs = null; }
    if (qs && qs.get("server")) lsSet(K_SERVER, String(qs.get("server")).trim().replace(/\/+$/, ""));
    $("onName").value = lsGet(K_NAME) || "";
    $("onServer").value = customServer();
    $("onServerInfo").textContent = serverBase() === null ? "Sin servidor propio: se abrirá " + ONLINE_URL + " en tu navegador." : "Ahora: " + (customServer() || "el servidor de esta página") + ".";
    $("onExtUrl").textContent = ONLINE_URL;
    $("btnModeLocal").onclick = function () { showMode(false); };
    $("btnModeOnline").onclick = function () {
      showHome("");
      if (serverBase() === null) openExternal(ONLINE_URL); else wake();
    };
    $("btnOnCreate").onclick = createRoom; $("btnOnJoin").onclick = joinRoom;
    $("onCode").oninput = function () { this.value = this.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5); };
    $("onCode").onkeydown = function (e) { if (e.key === "Enter") joinRoom(); };
    $("onName").onkeydown = function (e) { if (e.key === "Enter") ($("onCode").value ? joinRoom() : createRoom()); };
    $("btnOnLeave").onclick = function () { leaveRoom(false); };
    if ($("roomChatForm")) $("roomChatForm").onsubmit = function (e) {
      if (e.preventDefault) e.preventDefault();
      const input = $("roomChatInput"), text = input ? input.value : "";
      sendChat(text).then(function (r) { if (!r.ok) UI().toast(r.msg || "No se pudo enviar.", true); else if (input) { input.value = ""; input.focus(); } });
      return false;
    };
    if ($("gameChatForm")) $("gameChatForm").onsubmit = function (e) {
      if (e.preventDefault) e.preventDefault();
      const input = $("gameChatInput"), text = input ? input.value : "";
      sendChat(text).then(function (r) { if (!r.ok) UI().toast(r.msg || "No se pudo enviar.", true); else if (input) { input.value = ""; input.focus(); } });
      return false;
    };
    if ($("btnChat")) $("btnChat").onclick = function () { if ($("chatOverlay")) $("chatOverlay").classList.remove("hidden"); };
    if ($("btnCloseChat")) $("btnCloseChat").onclick = function () { if ($("chatOverlay")) $("chatOverlay").classList.add("hidden"); };
    $("btnOnStart").onclick = startGame;
    $("btnOnNpcAdd").onclick = function () { npcOp({ op: "add" }); };
    $("roomNpcs").addEventListener("click", function (e) { const b = e.target.closest ? e.target.closest("[data-npcrm]") : null; if (b) npcOp({ op: "remove", index: Number(b.getAttribute("data-npcrm")) }); });
    $("btnOnCopy").onclick = function () { copyText(lobby ? lobby.code : "", "Código copiado."); };
    $("btnOnShare").onclick = function () {
      const link = shareLink();
      try { if (navigator.share) { const pr = navigator.share({ title: "El Umbral", text: "Únete a mi sala de El Umbral: " + (lobby ? lobby.code : ""), url: link }); if (pr && pr.catch) pr.catch(function () {}); return; } } catch (e) { /* sin compartir */ }
      copyText(link, "Enlace copiado.");
    };
    $("btnExtOpen").onclick = function () { openExternal(ONLINE_URL); };
    $("btnExtCopy").onclick = function () { copyText(ONLINE_URL, "Enlace copiado."); };
    $("btnOnServerSave").onclick = function () {
      const v = String($("onServer").value || "").trim().replace(/\/+$/, "");
      if (v && !/^https?:\/\/[^\s]+$/i.test(v)) { setMsg("La dirección debe empezar por http:// o https://", true); return; }
      if (v) lsSet(K_SERVER, v); else lsDel(K_SERVER);
      setMsg("Servidor guardado."); initLobbyInfo(); showHome("Servidor guardado."); if (serverBase() !== null) wake();
    };
    $("btnOnServerReset").onclick = function () { lsDel(K_SERVER); $("onServer").value = ""; initLobbyInfo(); showHome("Servidor restablecido."); };
    /* hora de fin del anfitrión: por defecto ahora + 15 min redondeado a 5 */
    { const d0 = new Date(Date.now() + 15 * 60000); d0.setMinutes(Math.round(d0.getMinutes() / 5) * 5, 0, 0);
      $("netEnd").value = String(100 + d0.getHours()).slice(1) + ":" + String(100 + d0.getMinutes()).slice(1); }
    $("netEnd").oninput = $("netEnd").onchange = refreshNetEnd;
    setInterval(function () { if (lobby && !attached) refreshNetEnd(); }, 15000);
    banner();
    /* ¿sesión guardada? se reconecta (reconexión por token) */
    let s = null; try { s = JSON.parse(lsGet(K_SESSION) || "null"); } catch (e) { s = null; }
    if (s && s.token && s.room && s.server === (base0 === null ? "" : base0) && base0 !== null) {
      session = s; showMode(true); showPanel("onRoom"); renderRoom(); openStream();
    } else if (s) clearSession();
    if (qs && qs.get("sala") && !session && base0 !== null) {
      $("onCode").value = String(qs.get("sala")).toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5);
      showHome("Escribe tu nombre y pulsa «Unirme».");
    }
  }
  function initLobbyInfo() { $("onServerInfo").textContent = serverBase() === null ? "Sin servidor propio: se abrirá " + ONLINE_URL + " en tu navegador." : "Ahora: " + (customServer() || "el servidor de esta página") + "."; }
  /* Despierta el servidor gratuito (Render) nada más abrir el lobby. */
  let wakeT = 0;
  function wake() {
    const base = serverBase(); if (base === null || Date.now() - wakeT < 20000) return; wakeT = Date.now();
    const el = $("onWake"); if (!el) return;
    el.className = "small onwake"; el.textContent = "Despertando el servidor… (el servidor gratuito puede tardar ~1 min)";
    let ctl = null, t = null; try { ctl = new AbortController(); t = setTimeout(function () { ctl.abort(); }, 90000); } catch (e) { ctl = null; }
    fetch(base + "/healthz", { cache: "no-store", signal: ctl ? ctl.signal : undefined }).then(function (r) { return r.ok; }).catch(function () { return false; }).then(function (ok) {
      if (t) clearTimeout(t);
      el.className = "small onwake " + (ok ? "ok" : "bad"); el.textContent = ok ? "Servidor listo." : "No se llega al servidor. Revisa tu conexión o la dirección en «Servidor (avanzado)».";
    });
  }

  window.UmbralNet = { backend: B, serverBase: serverBase, ONLINE_URL: ONLINE_URL, leave: function () { leaveRoom(true); } };
  function boot() { try { initLobby(); } catch (e) { /* sin lobby (p. ej. pruebas sin DOM) */ } }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
