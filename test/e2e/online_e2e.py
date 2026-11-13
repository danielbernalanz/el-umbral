#!/usr/bin/env python3
"""E2E del cliente en línea (F3) con Playwright: 3 navegadores contra `node server/index.js` local.

Escenarios (todos por defecto; elige con `--only nombre`):
  lobby     crear sala, unirse con código, errores (código inválido, nombre repetido, sala llena, partida empezada, servidor inalcanzable)
  game      partida completa de 3 jugadores hasta el desenlace con bot de interfaz; «esperando…», Consejo, desenlace;
            doble toque, recarga a mitad (reconexión por token), corte de red (offline) y vuelta, escaneo de privacidad continuo
  stun      otro jugador te deja sin turno a mitad de la fase privada (acted sin elegir): la interfaz lo cierra sola
  restart   el servidor se cae a mitad de partida y vuelve (las salas se pierden): aviso claro y «Volver al inicio»
  external  desde file:// el botón «Jugar en línea» abre la URL pública fuera
  desktop   capturas a 1280x800 (lobby y juego)

Uso: python3 -I test/e2e/online_e2e.py [--sync RUTA_WWW] [--only game] [--seed 1] [--shots DIR]
Requiere: node >= 20, playwright (python). No usa la red externa.
"""
import argparse, json, os, random, re, socket, subprocess, sys, time

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ap = argparse.ArgumentParser()
ap.add_argument("--sync"); ap.add_argument("--only"); ap.add_argument("--seed", type=int, default=1)
ap.add_argument("--shots", default=os.path.join(ROOT, "test", "e2e", "shots"))
ap.add_argument("--mins", type=int, default=25)
A = ap.parse_args()
os.makedirs(A.shots, exist_ok=True)
random.seed(A.seed)
RESULTS = []

def check(name, ok, info=""):
    RESULTS.append((name, bool(ok), info))
    print(("PASS " if ok else "FAIL ") + name + ((" :: " + str(info)[:240]) if info and not ok else ""), flush=True)

def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p

class Server:
    def __init__(self, port=None, script="server/index.js", scale=None, read_ms="0", extra=None):
        self.port = port or free_port(); self.p = None; self.script = script; self.scale = scale; self.read_ms = read_ms; self.extra = extra or {}
    def start(self):
        env = dict(os.environ, PORT=str(self.port), UMBRAL_READ_MS=str(self.read_ms))   # la lectura de 10 s estorba a los bots de interfaz: solo se prueba en `time`
        if self.scale: env["UMBRAL_TIME_SCALE"] = str(self.scale)
        env.update(self.extra)
        self.p = subprocess.Popen(["node", self.script], cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        for _ in range(100):
            try:
                socket.create_connection(("127.0.0.1", self.port), 0.2).close(); return self
            except OSError: time.sleep(0.1)
        raise RuntimeError("el servidor no arrancó")
    def stop(self):
        if self.p: self.p.terminate(); self.p.wait(5); self.p = None
    def kill(self):   # kill -9: sin SIGTERM, el servidor no puede mandar la instantánea final
        if self.p: self.p.kill(); self.p.wait(5); self.p = None
    @property
    def url(self): return "http://127.0.0.1:%d/" % self.port

SSE_HOOK = """(()=>{const E=window.EventSource;window.__sse=[];
window.__csp=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective+' '+e.blockedURI));
window.EventSource=function(u,o){const e=new E(u,o);e.addEventListener('view',ev=>{window.__sse.push(ev.data);if(window.__sse.length>80)window.__sse.shift();});return e;};
window.EventSource.prototype=E.prototype;window.EventSource.CLOSED=2;window.EventSource.CONNECTING=0;window.EventSource.OPEN=1;})();"""

# Textos de «pasar el móvil» que NO deben verse nunca en línea (cada jugador tiene su dispositivo).
HAND_RE = r"pas(a|ar|ad)\s+(el|tu|este)\s+m[óo]vil|entreg(a|ar|ad)\s+(el|tu|este)\s+(m[óo]vil|dispositivo|turno)|traspaso|que nadie mire|nadie\s+(m[aá]s\s+)?(debe|puede)\s+mirar|al pasarlo|ense\u00f1a el m[óo]vil|oiga el zumbido|Soy [A-ZÁÉÍÓÚ]\w+$"
HAND_HITS = []
HAND_JS = "(()=>{const re=new RegExp(%s,'i'),seen={};setInterval(()=>{try{const t=[document.body.innerText||''].concat([].map.call(document.querySelectorAll('.toast'),e=>e.textContent)).join('\\n');t.split('\\n').forEach(l=>{if(re.test(l)&&!seen[l]){seen[l]=1;window.__handhit(l.slice(0,160))}})}catch(e){}},250)})();" % json.dumps(HAND_RE)

class Client:
    def __init__(self, browser, name, vw=390, vh=844, csp=False):
        self.name = name
        # bypass_csp: wait_for_function de Playwright usa eval; la CSP real se comprueba en el escenario «csp» (csp=True)
        self.ctx = browser.new_context(viewport={"width": vw, "height": vh}, bypass_csp=not csp)
        self.ctx.add_init_script(SSE_HOOK)
        self.ctx.add_init_script(HAND_JS)
        self.pg = self.ctx.new_page()
        self.pg.expose_function("__handhit", lambda t, n=name: HAND_HITS.append((n, t)))
        self.errors = []; self.cmds = []; self.resp = []
        self.pg.on("pageerror", lambda e: self.errors.append("PAGEERR " + str(e)[:200]))
        self.pg.on("console", lambda m: self.errors.append("CONSOLE " + m.text[:200]) if m.type == "error" and "Failed to load resource" not in m.text and "ERR_" not in m.text and "navigator.vibrate" not in m.text else None)
        self.pg.on("dialog", lambda d: (self.errors.append("DIALOGO " + d.message[:80]), d.dismiss()))
        self.pg.on("request", lambda r: self.cmds.append(r.post_data) if r.method == "POST" and r.url.endswith("/cmd") else None)
        self.pg.on("response", self._resp)
    def _resp(self, r):
        try:
            if r.url.endswith("/cmd"): self.resp.append(r.text())
        except Exception: pass
    def vis(self, sel):
        l = self.pg.locator(sel)
        try: return l.count() > 0 and l.first.is_visible()
        except Exception: return False
    def txt(self, sel):
        try: return self.pg.locator(sel).first.inner_text()
        except Exception: return ""
    def shot(self, tag): self.pg.screenshot(path=os.path.join(A.shots, "%s_%s.png" % (self.name, tag)))

def end_time(minutes):
    t = time.time() + minutes * 60
    lt = time.localtime(t)
    return "%02d:%02d" % (lt.tm_hour, lt.tm_min)

# ------------------------------------------------------------------ lobby
def open_online(c, url):
    c.pg.goto(url); c.pg.click("#btnModeOnline")
    c.pg.wait_for_selector("#onHome", state="visible")

def create_room(c, name):
    c.pg.fill("#onName", name); c.pg.click("#btnOnCreate")
    c.pg.wait_for_function("document.getElementById('roomCode').textContent.trim().length===5 && !/·/.test(document.getElementById('roomCode').textContent)", timeout=15000)
    return c.txt("#roomCode").strip()

def join_room(c, name, code):
    c.pg.fill("#onName", name); c.pg.fill("#onCode", code); c.pg.click("#btnOnJoin")

def room_names(c): return [x.strip() for x in c.pg.locator("#roomPlayers .rplayer b").all_inner_texts()]

def scenario_lobby(pw):
    srv = Server().start(); b = pw.chromium.launch()
    try:
        host, g2, g3 = Client(b, "lobby_host"), Client(b, "lobby_g2"), Client(b, "lobby_g3")
        open_online(host, srv.url)
        host.pg.click("#btnNews"); host.pg.wait_for_timeout(200)
        news_open = host.vis("#newsOverlay") and host.pg.locator("#newsList .newsent").count() >= 3
        host.pg.click("#btnCloseNews"); host.pg.wait_for_timeout(200)
        check("lobby: botón Novedades abre y cierra el panel", news_open and not host.vis("#newsOverlay"))
        check("lobby: botones Jugar local / Jugar en línea y formulario", host.vis("#btnModeLocal") and host.vis("#onHome") and not host.vis("#localCard"))
        host.shot("00_home")
        code = create_room(host, "Ana")
        check("lobby: código de 5 letras", len(code) == 5 and code.isalpha() and code.isupper(), code)
        check("lobby: anfitrión ve selector de hora e Iniciar desactivado con 1 jugador", host.vis("#netEnd") and host.pg.locator("#btnOnStart").is_disabled())
        host.shot("01_room_host")
        # errores de unión
        open_online(g2, srv.url); join_room(g2, "Luis", "ZZZZZ")
        g2.pg.wait_for_function("document.getElementById('onMsg').textContent.length>3 && !/^Conectando/.test(document.getElementById('onMsg').textContent)")
        check("lobby: código inexistente da mensaje claro", "No existe" in g2.txt("#onMsg"), g2.txt("#onMsg"))
        g2.pg.fill("#onCode", "AB"); g2.pg.click("#btnOnJoin")
        check("lobby: código corto rechazado en el cliente", "5 letras" in g2.txt("#onMsg"), g2.txt("#onMsg"))
        join_room(g2, "ana", code)
        g2.pg.wait_for_function("document.getElementById('onMsg').textContent.indexOf('nombre')>=0", timeout=8000)
        check("lobby: nombre repetido", "nombre" in g2.txt("#onMsg"), g2.txt("#onMsg"))
        join_room(g2, "Luis", code.lower())
        g2.pg.wait_for_function("document.getElementById('roomCode').textContent.trim()==='%s'" % code, timeout=8000)
        open_online(g3, srv.url); join_room(g3, "Marta", code)
        g3.pg.wait_for_function("document.getElementById('roomCode').textContent.trim()==='%s'" % code, timeout=8000)
        host.pg.wait_for_function("document.querySelectorAll('#roomPlayers .rplayer').length===3", timeout=8000)
        check("lobby: lista de jugadores en vivo en los 3 móviles", all(sorted(room_names(c)) == ["Ana", "Luis", "Marta"] for c in (host, g2, g3)), [room_names(c) for c in (host, g2, g3)])
        check("lobby: solo el anfitrión ve Iniciar; invitado ve «esperando»", host.vis("#btnOnStart") and not g2.vis("#btnOnStart") and g2.vis("#roomGuest"))
        check("lobby: Iniciar activo con 3 jugadores", host.pg.locator("#btnOnStart").is_enabled())
        g2.shot("02_room_guest")
        # un invitado sale y vuelve
        g3.pg.click("#btnOnLeave"); g3.pg.wait_for_selector("#onHome", state="visible")
        host.pg.wait_for_function("document.querySelectorAll('#roomPlayers .rplayer').length===2", timeout=8000)
        check("lobby: salir quita al jugador de la lista", sorted(room_names(host)) == ["Ana", "Luis"], room_names(host))
        join_room(g3, "Marta", code); g3.pg.wait_for_function("document.getElementById('roomCode').textContent.trim()==='%s'" % code, timeout=8000)
        # empezar
        host.pg.fill("#netEnd", end_time(A.mins)); host.pg.click("#btnOnStart")
        for c in (host, g2, g3): c.pg.wait_for_selector("#game", state="visible", timeout=15000)
        check("lobby: Iniciar lleva a los 3 a la pantalla de juego (sin 'pasa el móvil')", all(c.vis("#privatePanel") for c in (host, g2, g3)) and not any("Pasa el móvil" in c.txt("#screenTitle") for c in (host, g2, g3)), [c.txt("#screenTitle") for c in (host, g2, g3)])
        # sala empezada
        g4 = Client(b, "lobby_g4"); open_online(g4, srv.url); join_room(g4, "Pepe", code)
        g4.pg.wait_for_function("document.getElementById('onMsg').textContent.length>3 && !/^Conectando/.test(document.getElementById('onMsg').textContent)", timeout=8000)
        check("lobby: no se entra en partida empezada", "empezado" in g4.txt("#onMsg"), g4.txt("#onMsg"))
        # servidor inalcanzable
        g5 = Client(b, "lobby_g5"); g5.pg.goto(srv.url)
        g5.pg.evaluate("localStorage.setItem('umbral_server','http://127.0.0.1:9')"); g5.pg.reload(); g5.pg.click("#btnModeOnline")
        g5.pg.fill("#onName", "Zoe"); g5.pg.click("#btnOnCreate")
        g5.pg.wait_for_function("/conectar|servidor/i.test(document.getElementById('onMsg').textContent) && !/Conectando/.test(document.getElementById('onMsg').textContent)", timeout=20000)
        check("lobby: servidor inalcanzable -> aviso con ~1 min de despertar", "1 min" in g5.txt("#onMsg"), g5.txt("#onMsg"))
        g5.shot("03_unreachable")
        # sala llena (10) por API
        import urllib.request
        def api(path, body):
            rq = urllib.request.Request(srv.url.rstrip("/") + path, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
            try: return json.loads(urllib.request.urlopen(rq).read())
            except urllib.error.HTTPError as e: return json.loads(e.read())
        r0 = api("/api/create", {"name": "H0"})
        for i in range(1, 10): api("/api/join", {"room": r0["room"], "name": "P%d" % i})
        g6 = Client(b, "lobby_g6"); open_online(g6, srv.url); join_room(g6, "Extra", r0["room"])
        g6.pg.wait_for_function("document.getElementById('onMsg').textContent.length>3 && !/^Conectando/.test(document.getElementById('onMsg').textContent)", timeout=8000)
        check("lobby: sala llena", "llena" in g6.txt("#onMsg"), g6.txt("#onMsg"))
        errs = [e for c in (host, g2, g3, g4, g5, g6) for e in c.errors]
        check("lobby: sin errores de JS", not errs, errs[:3])
    finally:
        b.close(); srv.stop()

# ------------------------------------------------------------------ bot de interfaz
def bot_step(c, rnd):
    """Un paso de bot. Devuelve 'end' | 'wait' | 'act'."""
    if c.vis("#ending"): return "end"
    if c.vis("#timeOverlay"):
        btn = c.pg.locator("#timeOverlay button")
        if c.vis("#btnTwKeep"): c.pg.click("#btnTwKeep")
        elif btn.count(): btn.nth(rnd.randrange(btn.count())).click(timeout=3000)
        return "act"
    if c.vis("#overlay"):
        bt = c.pg.locator("#rollActions button")
        if bt.count(): bt.nth(rnd.randrange(bt.count()) if rnd.random() < .4 else 0).click(timeout=3000); return "act"
        c.pg.wait_for_timeout(150); return "wait"
    if c.vis("#actionOverlay"):
        c.pg.click("#btnActionChoose" if rnd.random() < .85 else "#btnActionCancel"); return "act"
    if c.vis("#privatePanel"):
        if c.pg.locator("[data-pact]").count() and c.vis("[data-pact]"):
            c.pg.locator("[data-pact]").nth(rnd.randrange(c.pg.locator("[data-pact]").count())).click(); return "act"
        if c.vis("#offerYes"): c.pg.click("#offerYes" if rnd.random() < .4 else "#offerNo"); return "act"
        if c.vis("#handYes"): c.pg.click("#handYes" if rnd.random() < .6 else "#handNo"); return "act"
        if rnd.random() < .25:
            l = c.pg.locator("[data-item]:not([disabled]):visible")
            if l.count(): l.nth(rnd.randrange(l.count())).click(); return "act"
        ch = c.pg.locator("#actionChoices button"); k = ch.count()
        if not k: c.pg.wait_for_timeout(150); return "wait"
        for _ in range(6):
            i = rnd.randrange(k)
            if ch.nth(i).inner_text().strip() != "Cancelar": break
        ch.nth(i).click(timeout=3000); return "act"
    if c.vis("#prepPanel"):
        cards = c.pg.locator("#prepCards button")
        if cards.count() and rnd.random() < .6:
            cards.nth(rnd.randrange(cards.count())).click()
            if c.vis("#prepTarget") and c.pg.locator("#prepTarget option").count():
                c.pg.select_option("#prepTarget", index=rnd.randrange(c.pg.locator("#prepTarget option").count()))
                if c.vis("#btnPrepSave"): c.pg.click("#btnPrepSave"); return "act"
        c.pg.click("#btnPrepSkip"); return "act"
    if c.vis("#councilPanel"):
        if c.pg.locator("#btnEndCouncil").is_enabled(): c.pg.click("#btnEndCouncil"); return "act"
        return "wait"
    if c.vis("#resolutionPanel"):
        if c.pg.locator("#btnNextRound").is_enabled(): c.pg.click("#btnNextRound"); return "act"
        return "wait"
    return "wait"

PUBLIC_KEYS = {"npc", "id", "name", "dead", "dying", "exposed", "visibleHealth", "ready", "online", "absent", "host", "alignment", "risenBy"}

TOKENS_JS = """()=>{const B=UmbralNet.backend,s=B.getState();if(!s)return null;const me=s.players[s.youId];
  const sec=B.secretInfo()||{};const pub=(s.chronicle||[]).map(x=>x.text).concat((s.publicClues||[]).map(x=>x.text));
  const strip=n=>n.replace(/^Ronda \\d+: /,'');
  return {allNotes:(me.notes||[]).map(strip), secret:sec.text||'', role:(me.role&&me.role.name)||'', aff:(me.affinity&&me.affinity.name)||'',
          notes:(me.notes||[]).filter(n=>n.length>28&&!pub.some(p=>n.indexOf(p)>=0||p.indexOf(strip(n))>=0)),
          pubClues:pub, clues:(me.clues||[]).map(x=>x.text).filter(t=>t&&t.length>20), pacts:(B.activePacts()||[]).map(x=>x.terms).filter(Boolean)}}"""

def private_tokens(c):
    """Cadenas que SOLO deben existir en la pantalla de este jugador."""
    return c.pg.evaluate(TOKENS_JS)

def surface(c):
    """Todo lo que contiene este cliente en un solo instante: DOM + estado de ui + vistas SSE crudas + respuestas /cmd (+ sus propios datos, para descartar coincidencias legítimas)."""
    d = c.pg.evaluate("(()=>{const own=(%s)();return {own:own,dom:document.documentElement.innerHTML.replace(/<symbol[\\s\\S]*?<\\/symbol>/g,''),stt:JSON.stringify(UmbralNet.backend.getState()),sse:JSON.stringify(window.__sse||[])}})()" % TOKENS_JS.replace("\n", " "))
    return d["dom"], d["stt"], d["sse"], "".join(c.resp), d["own"]

def privacy_scan(cs, leaks, structural, ctl):
    live = [c for c in cs if not c.vis("#ending")]
    if len(live) < 2: return
    toks = {}
    for c in live:
        try: toks[c.name] = private_tokens(c)
        except Exception: toks[c.name] = None
    for b in live:
        try: dom, stt, sse, resp, mine = surface(b)
        except Exception: continue
        # estructura: los demás jugadores solo con claves públicas
        bad = b.pg.evaluate("""(pk)=>{const s=UmbralNet.backend.getState();return s.players.filter(p=>p.id!==s.youId).map(p=>Object.keys(p).filter(k=>pk.indexOf(k)<0)).flat()}""", sorted(PUBLIC_KEYS))
        if bad: structural.append((b.name, bad))
        tb = mine
        if tb and tb["secret"]:  # control positivo: el escáner SÍ encuentra el secreto propio en la propia pantalla/estado
            ctl.append(tb["secret"] in dom or tb["secret"] in stt or json.dumps(tb["secret"], ensure_ascii=False)[1:-1] in stt)
        for a in live:
            if a is b or not toks.get(a.name): continue
            t = toks[a.name]
            probe = []
            if t["secret"] and t["secret"] != (mine.get("secret") or ""): probe.append(("secreto", t["secret"]))
            for k in ("role", "aff"):
                if t[k] and t[k] != mine.get(k): probe.append((k, t[k]))
            mine_notes = [x for x in (mine.get("allNotes") or [])]
            for n in t["notes"]:
                if n.split(": ", 1)[-1] in mine_notes or any(n.split(": ", 1)[-1] in m for m in mine_notes) or any(n in x for x in (mine.get("pubClues") or [])): continue  # nota genérica que también recibió este jugador
                probe.append(("nota", n[:60]))
            for n in t["clues"]:
                if n in (mine.get("clues") or []) or any(n in x for x in (mine.get("pubClues") or [])): continue  # rumor/testimonio público o pista idéntica que también tiene este jugador
                probe.append(("pista", n[:60]))
            for n in t["pacts"]:
                if n not in (mine.get("pacts") or []): probe.append(("pacto", n[:60]))
            for kind, s in probe:
                for where, blob in (("dom", dom), ("estado", stt), ("sse", sse), ("cmd", resp)):
                    esc_json = json.dumps(s, ensure_ascii=False)[1:-1]
                    if s in blob or esc_json in blob:
                        i = blob.find(s if s in blob else esc_json)
                        leaks.append((b.name, a.name, kind, where, s[:50], "...%s..." % blob[max(0, i - 90):i + 40].replace("\n", " ")))

def scenario_game(pw, restart_test=False):
    srv = Server().start(); b = pw.chromium.launch()
    rnd = random.Random(A.seed)
    try:
        cs = [Client(b, "g_ana"), Client(b, "g_luis"), Client(b, "g_marta")]
        open_online(cs[0], srv.url); code = create_room(cs[0], "Ana")
        for c, n in zip(cs[1:], ("Luis", "Marta")): open_online(c, srv.url); join_room(c, n, code)
        cs[0].pg.wait_for_function("document.querySelectorAll('#roomPlayers .rplayer').length===3", timeout=10000)
        cs[0].pg.fill("#netEnd", end_time(A.mins)); cs[0].pg.click("#btnOnStart")
        for c in cs: c.pg.wait_for_selector("#privatePanel", state="visible", timeout=15000)
        cs[1].shot("00_private_390x844")
        # textos fijos (ayuda, Consejo, botones) aunque estén ocultos: tampoco deben hablar de pasar el móvil
        static = cs[1].pg.evaluate("[document.getElementById('helpOverlay').textContent,document.getElementById('councilPanel').textContent,document.getElementById('prepPanel').textContent,document.getElementById('screenTitle').textContent].join('\\n')")
        hs = [l[:80] for l in static.split("\n") if re.search(HAND_RE, l, re.I)]
        check("game: ayuda/Consejo/preparación sin textos de pasar el móvil", not hs, "; ".join(hs[:3]))
        # token guardado y no expuesto en la URL ni en consola
        check("game: token en localStorage y no en la URL visible", all("token" in (c.pg.evaluate("localStorage.getItem('umbral_online_session')") or "") and "t=" not in c.pg.url for c in cs))
        if restart_test:
            # el servidor cae a mitad de partida y vuelve (sin salas)
            port = srv.port; srv.stop()
            cs[0].pg.wait_for_selector("#netBanner:not(.hidden)", timeout=15000)
            check("restart: aviso de sin conexión con servidor caído", "Sin conexión" in cs[0].txt("#netBannerTxt"), cs[0].txt("#netBannerTxt"))
            cs[0].shot("10_sin_conexion")
            srv2 = Server(port).start()
            cs[0].pg.wait_for_function("document.getElementById('netBannerBtn').textContent.indexOf('Volver')>=0", timeout=40000)
            check("restart: tras volver el servidor (sala perdida) se avisa y se ofrece volver al inicio", "ya no existe" in cs[0].txt("#netBannerTxt"), cs[0].txt("#netBannerTxt"))
            cs[0].shot("11_sala_perdida")
            cs[0].pg.click("#netBannerBtn"); cs[0].pg.wait_for_selector("#start", state="visible", timeout=8000)
            check("restart: «Volver al inicio» muestra el menú y limpia la sesión", cs[0].vis("#localCard") and not cs[0].pg.evaluate("localStorage.getItem('umbral_online_session')"))
            srv2.stop(); return
        leaks, structural, ctl = [], [], []
        stats = {"steps": 0, "waiting_seen": 0, "council_seen": 0, "resol_seen": 0}
        tests = {"reload": False, "offline": False, "dbl": False}
        t0 = time.time(); ended = False; shot_done = set(); same = 0; last_sg = None
        while time.time() - t0 < 420:
            stats["steps"] += 1
            res = []
            for i, c in enumerate(cs):
                try:
                    if c.vis("#handoff") and c.vis("#waitList"):
                        stats["waiting_seen"] += 1
                        if "wait" not in shot_done:
                            c.shot("20_esperando"); shot_done.add("wait"); stats["wait_text"] = c.txt("#waitList")[:120]
                            wt = c.txt("#waitList"); check("game: la espera solo dice «Faltan N» (sin quién está listo ni decidiendo)", re.search("faltan", wt, re.I) and not re.search(r"listo|decidiendo|terminado", wt, re.I), wt[:160])
                            check("game: la espera no usa chips de estado por jugador", c.pg.locator("#waitList .chip.good:not(:has-text('anfitri'))").count() == 0)
                    if c.vis("#councilPanel"):
                        stats["council_seen"] += 1
                        if "council" not in shot_done: c.shot("21_consejo"); shot_done.add("council")
                    if c.vis("#resolutionPanel"):
                        stats["resol_seen"] += 1
                        if "res" not in shot_done: c.shot("22_resolucion"); shot_done.add("res")
                    # doble toque en «Estoy listo» del Consejo (1 sola orden al servidor)
                    if not tests["dbl"] and i == 2 and c.vis("#councilPanel") and c.pg.locator("#btnEndCouncil").is_enabled():
                        n0 = sum(1 for x in c.cmds if x and '"councilReady"' in x)
                        c.pg.dblclick("#btnEndCouncil"); c.pg.wait_for_timeout(600)
                        n1 = sum(1 for x in c.cmds if x and '"councilReady"' in x)
                        check("game: doble toque en «Estoy listo» envía una sola orden", n1 - n0 == 1, (n0, n1)); tests["dbl"] = True; res.append("act"); continue
                    res.append(bot_step(c, rnd))
                except Exception as e:
                    c.errors.append("BOT " + str(e)[:160]); res.append("wait")
            if all(r == "end" for r in res): ended = True; break
            try: sg = tuple(c.pg.locator("body").inner_text()[:240] for c in cs)
            except Exception: sg = None
            same = same + 1 if sg == last_sg else 0; last_sg = sg
            if same > 90:
                stuck = [(c.name, c.txt("body")[:300].replace("\n", " / ")) for c in cs]
                for c in cs: c.shot("99_stuck")
                check("game: sin bloqueos (la interfaz avanza)", False, stuck); break
            if stats["steps"] % 6 == 0: privacy_scan(cs, leaks, structural, ctl)
            # recarga a mitad de partida (reconexión por token) cuando hay ronda >=2 y el cliente 1 está en turno privado
            st = cs[1].pg.evaluate("(()=>{const s=UmbralNet.backend.getState();return s?[s.round,s.phase]:null})()") if cs[1].vis("#game") else None
            if not tests["reload"] and st and st[0] >= 2 and st[1] == "private" and cs[1].vis("#privatePanel"):
                name0 = cs[1].pg.evaluate("UmbralNet.backend.currentPlayer().name")
                cs[1].pg.reload(); cs[1].pg.wait_for_selector("#game", state="visible", timeout=20000)
                cs[1].pg.wait_for_function("window.UmbralNet && UmbralNet.backend.getState() && UmbralNet.backend.getState().phase", timeout=20000)
                same = cs[1].pg.evaluate("UmbralNet.backend.currentPlayer().name") == name0
                check("game: recarga a mitad de partida reconecta por token como el mismo jugador", same and cs[1].vis("#game") and not cs[1].vis("#start"), name0)
                tests["reload"] = True; cs[1].shot("30_tras_recarga")
            # corte de red del cliente 2 y vuelta
            if not tests["offline"] and st and st[0] >= 3 and stats["steps"] > 40:
                cs[2].ctx.set_offline(True)
                try: cs[2].pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
                except Exception: pass
                try: cs[2].pg.wait_for_selector("#netBanner:not(.hidden)", timeout=40000); shown = True
                except Exception: shown = False
                check("game: corte de red -> aviso «Sin conexión»", shown, cs[2].txt("#netBannerTxt")); cs[2].shot("31_offline")
                cs[2].ctx.set_offline(False)
                try: cs[2].pg.wait_for_selector("#netBanner", state="hidden", timeout=45000); back = True
                except Exception: back = False
                check("game: vuelve la red -> el aviso desaparece y se reanuda", back, cs[2].txt("#netBannerTxt"))
                tests["offline"] = True
        check("game: partida completa llega al desenlace en los 3 móviles", ended, [c.txt("#screenTitle")[:40] for c in cs])
        check("game: se vio la pantalla «esperando…» con lista, el Consejo y la resolución", stats["waiting_seen"] > 0 and stats["council_seen"] > 0 and stats["resol_seen"] > 0, stats)
        check("game: recarga, corte y doble toque probados", all(tests.values()), tests)
        check("game: privacidad: 0 datos ajenos en DOM/estado/SSE/respuestas antes del desenlace", not leaks, leaks[:4])
        check("game: privacidad: de los demás solo claves públicas", not structural, structural[:3])
        check("game: control del escáner (encuentra el secreto propio en su propia pantalla)", len(ctl) >= 3 and all(ctl), (len(ctl), sum(1 for x in ctl if x)))
        if ended:
            cs[0].shot("40_desenlace")
            ok_log = all(c.pg.evaluate("UmbralNet.backend.exportLog().length>50 && UmbralNet.backend.exportStory().length>50") for c in cs)
            check("game: log e historia exportables tras el desenlace (los manda el servidor)", ok_log)
            # antes del desenlace no hubo log en ninguna vista
        errs = [e for c in cs for e in c.errors]
        check("game: sin errores de JS ni diálogos nativos", not errs, errs[:4])
        # el token no se escribió en la consola
        leaked_tok = [e for c in cs for e in c.errors if "token" in e.lower()]
        check("game: el token no aparece en la consola", not leaked_tok)
        print("stats", json.dumps(stats, ensure_ascii=False))
    finally:
        b.close(); srv.stop()

def hit(srv, code, pid, by, mode):
    import urllib.request
    return json.loads(urllib.request.urlopen(srv.url + "__test/hit?room=%s&pid=%d&by=%d&mode=%s" % (code, pid, by, mode)).read())

def new_room3(pw_b, srv, prefix, mins=None):
    cs = [Client(pw_b, prefix + "_ana"), Client(pw_b, prefix + "_luis"), Client(pw_b, prefix + "_marta")]
    open_online(cs[0], srv.url); code = create_room(cs[0], "Ana")
    for c, n in zip(cs[1:], ("Luis", "Marta")): open_online(c, srv.url); join_room(c, n, code)
    cs[0].pg.wait_for_function("document.querySelectorAll('#roomPlayers .rplayer').length===3", timeout=10000)
    cs[0].pg.fill("#netEnd", end_time(mins or A.mins)); cs[0].pg.click("#btnOnStart")
    for c in cs: c.pg.wait_for_selector("#privatePanel", state="visible", timeout=15000)
    return cs, code

def jsq(c, expr): return c.pg.evaluate("(()=>{const B=UmbralNet.backend,s=B.getState();return " + expr + "})()")

def play_until(cs, rnd, cond, secs=120, skip=()):
    t0 = time.time()
    while time.time() - t0 < secs:
        if cond(): return True
        for c in cs:
            if c in skip: continue
            try: bot_step(c, rnd)
            except Exception as e: c.errors.append("BOT " + str(e)[:120])
    return cond()

def scenario_stun(pw):
    """F4: aturdir/grillete y caer moribundo sobre quien aún no ha actuado, con el flujo REAL del servidor (tirada alta forzada)."""
    srv = Server(script="test/e2e/test_server.js").start(); b = pw.chromium.launch(); rnd = random.Random(A.seed)
    try:
        cs, code = new_room3(b, srv, "s")
        r = hit(srv, code, 0, 1, "stun")
        check("stun: el servidor aplica el aturdimiento (acted sigue en false: cuenta para la ronda siguiente)", r["ok"] and r["success"] and not r["acted"], r)
        cs[0].pg.wait_for_timeout(700)
        check("stun: Ana sigue pudiendo elegir en esta ronda (panel privado intacto)", cs[0].vis("#privatePanel") and jsq(cs[0], "!s.players[s.youId].acted"))
        ok = play_until(cs, rnd, lambda: all((jsq(c, "s.round") or 0) >= 2 for c in cs))
        check("stun: la ronda 2 empieza para los 3 sin bloqueos", ok, [jsq(c, "s.round") for c in cs])
        cs[0].pg.wait_for_timeout(500)
        check("stun: en la ronda 2 Ana pierde su turno (pantalla «esperando» con aviso)", jsq(cs[0], "s.skipped.indexOf(s.youId)>=0") and "no actúas" in cs[0].txt("#handoffTitle"), cs[0].txt("#handoffTitle"))
        cs[0].shot("50_ronda2_sin_turno")
        # moribundo a mitad de ronda: queda listo en el servidor y no bloquea
        ok = play_until(cs, rnd, lambda: jsq(cs[2], "s.phase")=="private" and jsq(cs[2], "!s.players[s.youId].acted") and not jsq(cs[2], "s.players[s.youId].dead"), 90)
        if ok:
            r = hit(srv, code, 2, 1, "down")
            check("stun: dejar moribundo a quien aún no ha actuado cierra su turno en el servidor", r["ok"] and r["dying"], r)
            cs[2].pg.wait_for_timeout(700); cs[2].shot("51_moribundo")
            r3 = play_until(cs, rnd, lambda: all((jsq(c, "s.round") or 0) >= 4 or jsq(c, "s.phase")=="ending" for c in cs), 150)
            check("stun: sin bloqueos tras caer moribundo (la partida avanza)", r3, [jsq(c, "s.round") for c in cs])
        errs = [e for c in cs for e in c.errors if not e.startswith("BOT")]   # fallos del bot de interfaz (clics sobre elementos que cambian) no son del juego
        check("stun: sin errores de JS", not errs, errs[:3])
    finally: b.close(); srv.stop()

def scenario_timers(pw):
    """F4: autoturno del servidor (reloj acelerado x0.08): Marta no hace nada y la ronda se cierra sola; se ve «esperando…» con cuenta atrás."""
    srv = Server(script="test/e2e/test_server.js", scale=0.08).start(); b = pw.chromium.launch(); rnd = random.Random(A.seed)
    try:
        cs, code = new_room3(b, srv, "t")
        idle = cs[2]
        t0 = time.time(); shot = False; closed = False
        while time.time() - t0 < 60:
            for c in cs[:2]:
                try: bot_step(c, rnd)
                except Exception as e: c.errors.append("BOT " + str(e)[:120])
            if not shot and cs[0].vis("#waitList") and cs[0].vis("[data-cd]"):
                check("timers: «esperando…» muestra cuenta atrás del servidor", re.search(r"\d", cs[0].txt("[data-cd=turnauto]")) is not None, cs[0].txt("#waitList")); cs[0].shot("60_esperando"); shot = True
            if jsq(cs[0], "s.phase") != "private": closed = True; break
        check("timers: el servidor cierra la ronda aunque un jugador no haga nada", closed, jsq(cs[0], "s.phase"))
        cs[2].pg.wait_for_timeout(800)
        check("timers: el jugador pasivo recibe la nota de autoturno y su interfaz sigue al Consejo", jsq(idle, "s.phase")!="private" and jsq(idle, "(s.players[s.youId].notes||[]).some(n=>/se acabó el tiempo/.test(n))"), jsq(idle, "s.phase"))
        idle.shot("61_pasivo_consejo")
        errs = [e for c in cs for e in c.errors if not e.startswith("BOT")]   # fallos del bot de interfaz (clics sobre elementos que cambian) no son del juego
        check("timers: sin errores de JS", not errs, errs[:3])
    finally: b.close(); srv.stop()

def scenario_presence(pw):
    """F5: un jugador cierra la pestaña, pasa a «ausente» tras 2 rondas sin frenar la partida y vuelve; el anfitrión cae y el papel pasa al siguiente."""
    srv = Server(script="test/e2e/test_server.js", scale=0.08).start(); b = pw.chromium.launch(); rnd = random.Random(A.seed)
    try:
        cs, code = new_room3(b, srv, "p")
        marta = cs[2]; marta.pg.goto("about:blank")
        ok = play_until(cs, rnd, lambda: bool(jsq(cs[0], "s.players[2].absent")), 150, skip=(marta,))
        check("presence: tras 2 rondas desconectada, Marta figura «ausente» para los demás", ok, [jsq(cs[0], "s.round"), jsq(cs[0], "s.players[2].online")])
        check("presence: la partida no se frena (Ana y Luis siguen jugando, no hay bloqueo)", (jsq(cs[0], "s.round") or 0) >= 3 or jsq(cs[0], "s.phase") == "ending", jsq(cs[0], "s.round"))
        cs[0].shot("80_marta_ausente")
        marta.pg.goto(srv.url); marta.pg.wait_for_function("window.UmbralNet && UmbralNet.backend.getState && UmbralNet.backend.getState()", timeout=20000)
        check("presence: al volver Marta recupera su vista completa (misma sesión, sin duplicar)", jsq(marta, "s.youId") == 2 and jsq(marta, "!!s.players[s.youId].role"), jsq(marta, "s.youId"))
        ok = play_until(cs, rnd, lambda: jsq(cs[0], "s.phase") == "ending" or (not jsq(cs[0], "s.players[2].absent") and jsq(cs[0], "s.players[2].online")), 150)
        check("presence: Marta deja de estar ausente al empezar la ronda siguiente", ok, jsq(cs[0], "s.players[2].absent"))
        errs = [e for c in cs for e in c.errors if not e.startswith("BOT")]
        check("presence: sin errores de JS (jugador)", not errs, errs[:3])
    finally: b.close(); srv.stop()
    srv = Server(script="test/e2e/test_server.js", scale=0.08).start(); b = pw.chromium.launch(); rnd = random.Random(A.seed)
    try:
        cs, code = new_room3(b, srv, "h")
        ana = cs[0]; ana.pg.goto("about:blank")
        ok = play_until(cs, rnd, lambda: bool(jsq(cs[1], "s.players[1].host")) and bool(jsq(cs[2], "s.players[1].host")), 40, skip=(ana,))
        check("host: caída del anfitrión: pasa a Luis (siguiente conectado) y lo ven todos", ok and jsq(cs[2], "s.players[1].host") and not jsq(cs[2], "s.players[0].host"), [jsq(cs[1], "s.players.map(p=>p.host)")])
        cs[1].shot("81_nuevo_anfitrion")
        ana.pg.goto(srv.url); ana.pg.wait_for_function("window.UmbralNet && UmbralNet.backend.getState && UmbralNet.backend.getState()", timeout=20000)
        ana.pg.wait_for_timeout(1500)
        check("host: Ana vuelve y NO recupera el papel", not jsq(ana, "s.players[0].host") and jsq(ana, "s.players[1].host"), jsq(ana, "s.players.map(p=>p.host)"))
        errs = [e for c in cs for e in c.errors if not e.startswith("BOT")]
        check("host: sin errores de JS", not errs, errs[:3])
    finally: b.close(); srv.stop()

def endat(srv, code, secs, reset=False):
    import urllib.request
    urllib.request.urlopen(srv.url + "__test/endat?room=%s&secs=%s&reset=%d" % (code, secs, 1 if reset else 0)).read()

def scenario_time(pw):
    """F4: aviso «La noche se acaba» a los 2 min (común), «Añadir tiempo» solo anfitrión, pregunta de tiempo con votos visibles y regla de mayoría/empate."""
    srv = Server(script="test/e2e/test_server.js", scale=0.4).start(); b = pw.chromium.launch(); rnd = random.Random(A.seed)
    try:
        cs, code = new_room3(b, srv, "w")
        endat(srv, code, 100)
        for c in cs: c.pg.wait_for_selector("#timeOverlay:not(.hidden)", timeout=8000)
        check("time: aviso común «La noche se acaba» en los 3 móviles", all("La noche se acaba" in c.txt("#timeBody") for c in cs))
        check("time: «Añadir tiempo» solo lo ve el anfitrión", cs[0].vis("#btnTwAdd") and not cs[1].vis("#btnTwAdd") and not cs[2].vis("#btnTwAdd") and "anfitrión" in cs[1].txt("#timeBody"))
        cs[0].shot("70_aviso_host"); cs[1].shot("71_aviso_invitado")
        e0 = jsq(cs[0], "B.endAtTs()")
        cs[0].pg.click("#btnTwAdd"); cs[0].pg.wait_for_timeout(900)
        e1 = jsq(cs[1], "B.endAtTs()")
        check("time: «Añadir tiempo» desplaza la hora de fin (endAt del servidor) para todos", e1 > e0, [e0, e1])
        for c in cs[1:]:
            if c.vis("#btnTwKeep"): c.pg.click("#btnTwKeep")
        # pregunta de tiempo: se acaba el reloj durante la ronda
        endat(srv, code, 100, reset=True); endat(srv, code, -1)
        shot = False; got = False
        t0 = time.time()
        while time.time() - t0 < 120:
            for c in cs:
                if c.vis("#timeOverlay") and c.vis("[data-k]"): continue
                try: bot_step(c, rnd)
                except Exception as e: c.errors.append("BOT " + str(e)[:120])
            if all(c.vis("#timeOverlay") and c.vis("[data-k]") for c in cs): got = True; break
        check("time: al agotarse el tiempo la mesa recibe la pregunta (3 móviles)", got)
        if got:
            cs[1].pg.click("[data-k='1']"); cs[2].pg.click("[data-k='end']"); cs[1].pg.wait_for_timeout(1200)
            t = cs[0].txt("#timeBody")
            check("time: votos visibles para todos y regla explicada", "Luis: +1 ronda" in t and "Marta: terminar" in t and "empate" in t, t[:300])
            check("time: el anfitrión ve que su voto decide; los demás, que decide el anfitrión", "tu voto decide" in cs[0].txt("#timeBody") and "Decide el anfitrión" in cs[1].txt("#timeBody"))
            cs[0].shot("72_votacion_host"); cs[1].shot("73_votacion_invitado")
            r0 = jsq(cs[0], "s.round")
            cs[0].pg.wait_for_function("UmbralNet.backend.getState().phase==='private' && UmbralNet.backend.getState().round>%d" % r0, timeout=30000)
            check("time: empate (+1 / terminar / sin voto del anfitrión) = +1 ronda a los 30 s (reloj x0,4)", all(jsq(c, "s.round") == r0 + 1 for c in cs), [jsq(c, "s.round") for c in cs])
            # segunda pregunta: el anfitrión decide al votar «terminar ahora»
            endat(srv, code, -1)
            got2 = False; t0 = time.time()
            while time.time() - t0 < 120:
                for c in cs:
                    if c.vis("#timeOverlay") and c.vis("[data-k]"): continue
                    try: bot_step(c, rnd)
                    except Exception as e: c.errors.append("BOT " + str(e)[:120])
                if all(c.vis("#timeOverlay") and c.vis("[data-k]") for c in cs): got2 = True; break
            if got2:
                cs[0].pg.click("[data-k='end']")
                for c in cs: c.pg.wait_for_selector("#ending", state="visible", timeout=15000)
                check("time: el voto del anfitrión «Terminar ahora» da el desenlace a todos al instante", True)
                cs[1].shot("74_desenlace")
            else: check("time: segunda pregunta", False)
        errs = [e for c in cs for e in c.errors if not e.startswith("BOT")]   # fallos del bot de interfaz (clics sobre elementos que cambian) no son del juego
        check("time: sin errores de JS", not errs, errs[:3])
    finally: b.close(); srv.stop()

def scenario_dual(pw):
    """F6: dos pestañas del mismo jugador: la nueva toma la conexión, la vieja muestra «Usar aquí» y puede recuperarla; una sola sesión (sin duplicar jugador)."""
    srv = Server(script="test/e2e/test_server.js").start(); b = pw.chromium.launch()
    try:
        cs, code = new_room3(b, srv, "x")
        a1 = cs[0]; a2pg = a1.ctx.new_page(); errs2 = []
        a2pg.on("pageerror", lambda e: errs2.append(str(e)[:200]))
        a2pg.goto(srv.url)
        a2pg.wait_for_function("window.UmbralNet && UmbralNet.backend.getState && UmbralNet.backend.getState() && UmbralNet.backend.getState().youId===0", timeout=20000)
        a1.pg.wait_for_selector("#netBanner:not(.hidden)", timeout=10000)
        check("dual: la pestaña antigua muestra el aviso de otra pestaña y «Usar aquí»", "otra pestaña" in a1.txt("#netBannerTxt") and "Usar aquí" in a1.txt("#netBannerBtn"), a1.txt("#netBanner"))
        a1.shot("90_usar_aqui")
        n = jsq(cs[1], "s.players.length")
        check("dual: sigue habiendo 3 jugadores (sin duplicar)", n == 3, n)
        a1.pg.click("#netBannerBtn"); a1.pg.wait_for_function("document.getElementById('netBanner').classList.contains('hidden')", timeout=10000)
        a2pg.wait_for_selector("#netBanner:not(.hidden)", timeout=10000)
        check("dual: «Usar aquí» recupera la conexión y la otra pestaña pasa a mostrar el aviso", "Usar aquí" in a2pg.inner_text("#netBannerBtn"))
        check("dual: la pestaña recuperada sigue con su vista completa del mismo jugador", jsq(a1, "s.youId") == 0 and jsq(a1, "!!s.players[0].role"))
        check("dual: sin errores de JS", not a1.errors and not errs2, (a1.errors + errs2)[:3])
    finally: b.close(); srv.stop()

def scenario_absvote(pw):
    """F6: con una jugadora ausente (cerró la pestaña) la pregunta de tiempo no se bloquea: votan los presentes y a los 30 s decide la mayoría."""
    srv = Server(script="test/e2e/test_server.js", scale=0.08).start(); b = pw.chromium.launch(); rnd = random.Random(A.seed)
    try:
        cs, code = new_room3(b, srv, "v", mins=60)
        marta = cs[2]; marta.pg.goto("about:blank")
        ok = play_until(cs, rnd, lambda: bool(jsq(cs[0], "s.players[2].absent")), 150, skip=(marta,))
        check("absvote: Marta pasa a ausente", ok)
        endat(srv, code, -1)
        got = False; t0 = time.time()
        while time.time() - t0 < 120:
            for c in cs[:2]:
                if c.vis("#timeOverlay") and c.vis("[data-k]"): continue
                try: bot_step(c, rnd)
                except Exception as e: c.errors.append("BOT " + str(e)[:120])
            if all(c.vis("#timeOverlay") and c.vis("[data-k]") for c in cs[:2]): got = True; break
        check("absvote: la pregunta de tiempo llega a los presentes aunque haya una ausente", got)
        if got:
            cs[1].pg.click("[data-k='end']")      # el anfitrión no vota: gana la mayoría (Luis: terminar; la ausente se abstiene)
            for c in cs[:2]: c.pg.wait_for_selector("#ending", state="visible", timeout=30000)
            check("absvote: a los 30 s (x0,08) la mayoría de presentes cierra la partida con desenlace", True)
            cs[0].shot("91_absvote_fin")
        errs = [e for c in cs[:2] for e in c.errors if not e.startswith("BOT")]
        check("absvote: sin errores de JS", not errs, errs[:3])
    finally: b.close(); srv.stop()

def scenario_csp(pw):
    """F7: con la CSP real del servidor (sin bypass) el lobby, la partida y el SSE funcionan sin ninguna violación (script-src 'self', sprites inline, estilos)."""
    srv = Server(script="test/e2e/test_server.js").start(); b = pw.chromium.launch(); rnd = random.Random(A.seed)
    try:
        cs = [Client(b, "c_" + n, csp=True) for n in ("ana", "luis", "marta")]
        cs[0].pg.goto(srv.url); cs[0].pg.click("#btnModeOnline"); cs[0].pg.wait_for_selector("#onHome", state="visible")
        check("csp: la página carga con la cabecera CSP", "frame-ancestors" in (cs[0].pg.evaluate("fetch('/').then(r=>r.headers.get('content-security-policy')||'')") or ""))
        cs[0].pg.fill("#onName", "Ana"); cs[0].pg.click("#btnOnCreate")
        t0 = time.time(); code = ""
        while time.time() - t0 < 15 and not re.fullmatch(r"[A-Z]{5}", code): cs[0].pg.wait_for_timeout(200); code = cs[0].txt("#roomCode").strip()
        check("csp: sala creada (fetch POST permitido)", len(code) == 5, code)
        for c, n in zip(cs[1:], ("Luis", "Marta")):
            c.pg.goto(srv.url); c.pg.click("#btnModeOnline"); c.pg.wait_for_selector("#onHome", state="visible"); c.pg.fill("#onName", n); c.pg.fill("#onCode", code); c.pg.click("#btnOnJoin")
        t0 = time.time()
        while time.time() - t0 < 15 and cs[0].pg.locator("#roomPlayers .rplayer").count() != 3: cs[0].pg.wait_for_timeout(200)
        cs[0].pg.fill("#netEnd", end_time(A.mins)); cs[0].pg.click("#btnOnStart")
        for c in cs: c.pg.wait_for_selector("#privatePanel", state="visible", timeout=15000)
        check("csp: SSE y arranque de partida (EventSource permitido)", True)
        for _ in range(30):
            for c in cs:
                try: bot_step(c, rnd)
                except Exception as e: c.errors.append("BOT " + str(e)[:120])
        viol = [v for c in cs for v in c.pg.evaluate("window.__csp")]
        errs = [e for c in cs for e in c.errors if not e.startswith("BOT")]
        check("csp: cero violaciones de CSP en el navegador", not viol and not [e for e in errs if "Content Security" in e], (viol + errs)[:3])
        check("csp: sin errores de JS", not errs, errs[:3])
    finally: b.close(); srv.stop()

def scenario_external(pw):
    b = pw.chromium.launch(); c = Client(b, "ext")
    try:
        c.pg.goto("file://" + os.environ.get("WWW", "/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www") + "/index.html")
        check("external: por defecto el menú local sigue visible", c.vis("#localCard") and c.vis("#btnStart"))
        urls = []
        c.ctx.on("request", lambda r: urls.append(r.url))
        try:
            with c.pg.expect_popup(timeout=6000): c.pg.click("#btnModeOnline")
            c.pg.wait_for_timeout(800)
        except Exception as e: urls.append("ERR " + str(e)[:80])
        url = next((u for u in urls if "onrender.com" in u), str(urls[-1:]))
        check("external: desde file:// «Jugar en línea» abre la URL pública fuera", url.startswith("https://el-umbral-h1ki.onrender.com"), url)
        check("external: queda el enlace para copiar", c.vis("#onExternal") and "onrender" in c.txt("#onExtUrl"))
        c.shot("00_external")
    finally: b.close()

def scenario_desktop(pw, vw=1280, vh=800, tag="pc"):
    srv = Server().start(); b = pw.chromium.launch()
    try:
        cs = [Client(b, "d_ana", vw, vh), Client(b, "d_luis", vw, vh), Client(b, "d_marta", vw, vh)]
        open_online(cs[0], srv.url); cs[0].shot("00_home_" + tag); code = create_room(cs[0], "Ana")
        for c, n in zip(cs[1:], ("Luis", "Marta")): open_online(c, srv.url); join_room(c, n, code)
        cs[0].pg.wait_for_function("document.querySelectorAll('#roomPlayers .rplayer').length===3", timeout=10000)
        cs[0].shot("01_room_" + tag)
        cs[0].pg.fill("#netEnd", end_time(A.mins)); cs[0].pg.click("#btnOnStart")
        for c in cs: c.pg.wait_for_selector("#privatePanel", state="visible", timeout=15000)
        cs[0].pg.wait_for_timeout(900); cs[0].shot("02_private_" + tag)
        cs[0].pg.locator("#actionChoices button").first.click(); cs[0].pg.wait_for_timeout(500); cs[0].shot("03_sheet_" + tag)
        cs[0].pg.click("#btnActionChoose"); cs[0].pg.wait_for_timeout(2500); cs[0].shot("04_roll_" + tag)
        w = cs[0].pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        check("desktop: sin scroll horizontal a %dx%d" % (vw, vh), w)
    finally: b.close(); srv.stop()


def scenario_persist(pw, hard=False):
    """Persistencia: el servidor se reinicia (SIGTERM o kill -9) a mitad de partida y la partida continúa y termina con la instantánea cifrada."""
    tag = "hard" if hard else "term"
    env = {"SNAPSHOT_KEY": "e2e-clave-secreta-0123456789abcdef"}
    srv = Server(extra=env).start(); b = pw.chromium.launch(); rnd = random.Random(A.seed + (7 if hard else 0))
    try:
        cs, code = new_room3(b, srv, "p" + tag, mins=8)
        ok = play_until(cs, rnd, lambda: all((jsq(c, "s.round") or 0) >= 2 for c in cs), 300)
        check("persist-%s: llegan a la ronda 2" % tag, ok, [jsq(c, "s.round") for c in cs])
        for c in cs: c.pg.wait_for_timeout(300)
        snaps = [c.pg.evaluate("Object.keys(localStorage).filter(k=>k.indexOf('umbral_online_snap_')===0).length") for c in cs]
        check("persist-%s: los 3 móviles guardaron la instantánea" % tag, all(n == 1 for n in snaps), snaps)
        blobs = [c.pg.evaluate("localStorage.getItem('umbral_online_snap_%s')" % code) for c in cs]
        check("persist-%s: el blob es opaco (sin texto del juego) y mismo formato" % tag, all(x and re.match(r"^U1\.[A-Za-z0-9_-]+$", x) and "secreto" not in x.lower() for x in blobs))
        pre = [jsq(c, "[s.round,s.phase]") for c in cs]
        port = srv.port
        if hard: srv.kill()
        else: srv.stop()
        if hard: cs[2].ctx.close()      # un móvil se cierra durante el reinicio: la mesa sigue con la mayoría
        act = cs[:2] if hard else cs
        for c in act:
            try: c.pg.wait_for_selector("#netBanner:not(.hidden)", timeout=20000)
            except Exception: pass
        cs[0].shot("60_%s_caido" % tag)
        time.sleep(2)
        srv2 = Server(port, extra=env).start()
        seen = False
        try: cs[0].pg.wait_for_function("document.getElementById('netBannerTxt').textContent.indexOf('Restaurando')>=0 || document.getElementById('netBanner').classList.contains('hidden')", timeout=30000); seen = "Restaurando" in cs[0].txt("#netBannerTxt")
        except Exception: pass
        cs[0].shot("61_%s_restaurando" % tag)
        for c in act:
            c.pg.wait_for_function("document.getElementById('netBanner').classList.contains('hidden') && window.UmbralNet && UmbralNet.backend.getState() && UmbralNet.backend.getState().phase", timeout=90000)
        post_ = [jsq(c, "[s.round,s.phase]") for c in act]
        check("persist-%s: tras reiniciar, la sala sigue en la misma ronda (o más) y mismo código" % tag, all(p[0] >= pre[i][0] for i, p in enumerate(post_)) and all(c.pg.evaluate("UmbralNet.backend.getState()!==null") for c in act), (pre, post_))
        check("persist-%s: se mostró «Restaurando la partida…»" % tag, seen, cs[0].txt("#netBannerTxt"))
        leaks, structural, ctl = [], [], []
        t0 = time.time(); ended = False; n = 0
        while time.time() - t0 < 480:
            n += 1; res = []
            for c in act:
                try: res.append(bot_step(c, rnd))
                except Exception as e: c.errors.append("BOT " + str(e)[:160]); res.append("wait")
            if all(r == "end" for r in res): ended = True; break
            if n % 8 == 0: privacy_scan(act, leaks, structural, ctl)
        check("persist-%s: la partida continúa y llega al desenlace tras el reinicio" % tag, ended, [c.txt("#screenTitle")[:40] for c in act])
        check("persist-%s: privacidad: 0 datos ajenos tras restaurar" % tag, not leaks and not structural, (leaks[:3], structural[:3]))
        left = [c.pg.evaluate("Object.keys(localStorage).filter(k=>k.indexOf('umbral_online_snap_')===0).length") for c in act]
        check("persist-%s: al terminar se borra la instantánea" % tag, all(n == 0 for n in left), left)
        errs = [e for c in act for e in c.errors]
        check("persist-%s: sin errores de JS" % tag, not errs, errs[:4])
        srv2.stop()
    finally:
        b.close(); srv.stop()

# ------------------------------------------------------------------ NPC y 2 jugadores
def run_to_end(cs, rnd, secs=240, skip=(), scan=None):
    t0 = time.time(); n = 0
    while time.time() - t0 < secs:
        n += 1; res = []
        for c in cs:
            if c in skip: continue
            try: res.append(bot_step(c, rnd))
            except Exception as e: c.errors.append("BOT " + str(e)[:160]); res.append("wait")
        if res and all(r == "end" for r in res): return True
        if scan and n % 8 == 0: scan()
    return False

def scenario_npc2(pw):
    """2 jugadores humanos (mínimo 2) y sala con NPC: añadir/quitar (solo anfitrión), empezar con 1 humano + NPC, partida completa, sin fugas."""
    srv = Server().start(); b = pw.chromium.launch(); rnd = random.Random(A.seed)
    try:
        host, g2 = Client(b, "n2_ana", 360, 640), Client(b, "n2_luis", 360, 640)
        open_online(host, srv.url); code = create_room(host, "Ana")
        check("npc2: con 1 jugador no se puede empezar", host.pg.locator("#btnOnStart").is_disabled())
        host.pg.click("#btnOnNpcAdd"); host.pg.wait_for_function("document.querySelectorAll('#roomNpcs .rplayer').length===1", timeout=8000)
        check("npc2: 1 humano + 1 NPC ya permite empezar (mínimo 2 contando NPC)", host.pg.locator("#btnOnStart").is_enabled() and "2 /" in host.txt("#roomCount"), host.txt("#roomCount"))
        host.shot("90_lobby_npc_360")
        check("npc2: el NPC se ve como «NPC» con botón Quitar (solo anfitrión)", "NPC" in host.txt("#roomNpcs") and host.pg.locator("#roomNpcs [data-npcrm]").count() == 1)
        open_online(g2, srv.url); join_room(g2, "Luis", code)
        g2.pg.wait_for_function("document.getElementById('roomCode').textContent.trim()==='%s'" % code, timeout=8000)
        g2.pg.wait_for_function("document.querySelectorAll('#roomNpcs .rplayer').length===1", timeout=8000)
        check("npc2: el invitado ve al NPC pero sin controles", g2.pg.locator("#roomNpcs [data-npcrm]").count() == 0 and not g2.vis("#roomNpcCtl"))
        g2.shot("91_lobby_invitado_360")
        host.pg.click("#roomNpcs [data-npcrm]"); host.pg.wait_for_function("document.querySelectorAll('#roomNpcs .rplayer').length===0", timeout=8000)
        check("npc2: quitar NPC", g2.pg.locator("#roomNpcs .rplayer").count() == 0)
        host.pg.click("#btnOnStart"); 
        for c in (host, g2): c.pg.wait_for_selector("#privatePanel", state="visible", timeout=15000)
        check("npc2: 2 jugadores humanos: la partida empieza", jsq(host, "s.players.length") == 2 and not any(jsq(host, "s.players.map(p=>p.npc)")))
        host.shot("92_2j_privado_360")
        leaks, structural, ctl = [], [], []
        ended = run_to_end([host, g2], rnd, 300, scan=lambda: privacy_scan([host, g2], leaks, structural, ctl))
        check("npc2: partida de 2 llega al desenlace", ended, [c.txt("#screenTitle")[:40] for c in (host, g2)])
        check("npc2: privacidad (2 jugadores): 0 fugas", not leaks and not structural, (leaks[:2], structural[:2]))
        errs = [e for c in (host, g2) for e in c.errors if not e.startswith("BOT")]
        check("npc2: sin errores de JS", not errs, errs[:3])
    finally: b.close(); srv.stop()

def scenario_npcroom(pw):
    """Sala con 2 humanos + 2 NPC: la mesa los muestra como NPC, juegan solos (la barrera no los espera), «Faltan N» solo cuenta humanos, 0 fugas, desenlace."""
    srv = Server().start(); b = pw.chromium.launch(); rnd = random.Random(A.seed)
    try:
        host, g2 = Client(b, "nr_ana", 360, 640), Client(b, "nr_luis", 360, 640)
        open_online(host, srv.url); code = create_room(host, "Ana")
        open_online(g2, srv.url); join_room(g2, "Luis", code)
        host.pg.wait_for_function("document.querySelectorAll('#roomPlayers .rplayer').length===2", timeout=8000)
        for prof in ("agresivo", "curandero"):
            host.pg.select_option("#npcProfSel", prof); host.pg.click("#btnOnNpcAdd")
        host.pg.wait_for_function("document.querySelectorAll('#roomNpcs .rplayer').length===2", timeout=8000)
        host.shot("93_lobby_2npc_360")
        host.pg.fill("#netEnd", end_time(A.mins)); host.pg.click("#btnOnStart")
        for c in (host, g2): c.pg.wait_for_selector("#privatePanel", state="visible", timeout=15000)
        npcs = jsq(host, "s.players.map(p=>!!p.npc)")
        check("npcroom: NPC marcados en la mesa (público)", npcs == [False, False, True, True], npcs)
        check("npcroom: el perfil NO está en las vistas de los demás", not jsq(host, "JSON.stringify(s.players.filter(p=>p.id!==s.youId)).match(/agresivo|curandero|prudente|oscuro/)") )
        host.pg.click("#btnStatus"); host.pg.wait_for_selector("#statusOverlay:not(.hidden)")
        check("npcroom: «NPC» visible en el Estado de la compañía", host.pg.locator("#allPlayers .npcchip").count() == 2)
        host.shot("94_mesa_npc_360"); host.pg.click("#btnCloseStatus")
        # turno: tras jugar los dos humanos, la barrera cierra sin esperar a nadie más
        leaks, structural, ctl = [], [], []
        ended = run_to_end([host, g2], rnd, 300, scan=lambda: privacy_scan([host, g2], leaks, structural, ctl))
        check("npcroom: llega al desenlace con 2 humanos + 2 NPC", ended)
        check("npcroom: desenlace marca NPC", host.pg.locator("#endingStats .npcchip").count() >= 2 or host.pg.locator("#ending .npcchip").count() >= 2, host.pg.locator(".npcchip").count())
        host.shot("95_desenlace_npc_360")
        check("npcroom: privacidad: 0 fugas ni claves extra", not leaks and not structural, (leaks[:2], structural[:2]))
        errs = [e for c in (host, g2) for e in c.errors if not e.startswith("BOT")]
        check("npcroom: sin errores de JS", not errs, errs[:3])
    finally: b.close(); srv.stop()

def scenario_npcsub(pw):
    """Sustitución: el anfitrión pone un NPC en lugar de Marta (se avisa, no puede actuar, recupera su sitio en la ronda siguiente); y una desconexión de 2 rondas la sustituye sola y vuelve al reconectar."""
    srv = Server(script="test/e2e/test_server.js", scale=0.08).start(); b = pw.chromium.launch(); rnd = random.Random(A.seed)
    try:
        cs, code = new_room3(b, srv, "u")
        ana, luis, marta = cs
        ana.pg.click("#btnStatus"); ana.pg.wait_for_selector("#statusOverlay:not(.hidden)")
        check("npcsub: el anfitrión ve «Sustituir por NPC»; Luis no", ana.pg.locator(".npcsub").count() >= 2 and (luis.pg.click("#btnStatus") or True) and luis.pg.locator(".npcsub").count() == 0)
        luis.pg.click("#btnCloseStatus")
        btn = ana.pg.locator('.npcsub[data-id="2"]'); btn.click(); ana.pg.locator('.npcsub[data-id="2"]').click()
        marta.pg.wait_for_function("UmbralNet.backend.getState().npcInfo", timeout=8000)
        check("npcsub: Marta recibe el aviso de que un NPC juega por ella", marta.vis("#npcBanner") and "NPC" in marta.txt("#npcBanner"), marta.txt("#npcBanner"))
        marta.shot("96_sustituida_360") if False else None
        check("npcsub: todos ven a Marta como NPC (marca pública)", jsq(luis, "s.players[2].npc") is True)
        ok = play_until(cs, rnd, lambda: (jsq(ana, "s.round") or 0) >= 2, 100, skip=(marta,))
        check("npcsub: la partida avanza sin Marta (NPC juega por ella)", ok, jsq(ana, "s.round"))
        marta.pg.click("#npcBannerBtn"); marta.pg.wait_for_function("/pr.xima ronda|empiece la pr/.test(document.getElementById('npcBannerTxt').textContent)", timeout=8000)
        r0 = jsq(ana, "s.round")
        ok = play_until(cs, rnd, lambda: (jsq(ana, "s.round") or 0) > r0 and not jsq(marta, "s.npcInfo"), 100, skip=(marta,))
        check("npcsub: Marta recupera su sitio al empezar la ronda siguiente", ok and jsq(luis, "s.players[2].npc") is False, [jsq(luis, "s.players[2].npc"), jsq(marta, "!!s.npcInfo")])
        ok = play_until(cs, rnd, lambda: marta.vis("#privatePanel") or jsq(ana, "s.phase") == "ending", 60)
        check("npcsub: Marta puede jugar de nuevo", ok)
        # desconexión: 2 rondas fuera -> NPC; al volver, recupera
        marta.pg.goto("about:blank")
        ok = play_until(cs, rnd, lambda: bool(jsq(ana, "s.players[2].npc")) or jsq(ana, "s.phase") == "ending", 160, skip=(marta,))
        check("npcsub: tras 2 rondas desconectada, un NPC toma el lugar de Marta", ok and jsq(ana, "s.players[2].npc") is True, jsq(ana, "s.players[2].npc"))
        marta.pg.goto(srv.url); marta.pg.wait_for_function("window.UmbralNet && UmbralNet.backend.getState && UmbralNet.backend.getState()", timeout=20000)
        marta.pg.wait_for_function("UmbralNet.backend.getState().npcInfo || UmbralNet.backend.getState().phase==='ending'", timeout=10000)
        info = jsq(marta, "s.npcInfo")
        check("npcsub: al reconectar se programa su regreso automáticamente", bool(info) and info.get("recover"), info)
        marta.shot("97_vuelve_360") if False else None
        ok = play_until(cs, rnd, lambda: jsq(ana, "s.phase") == "ending" or not jsq(ana, "s.players[2].npc"), 120)
        check("npcsub: Marta vuelve a su sitio al empezar la ronda siguiente", ok and (jsq(ana, "s.phase") == "ending" or jsq(ana, "s.players[2].npc") is False), jsq(ana, "s.players[2].npc"))
        errs = [e for c in cs for e in c.errors if not e.startswith("BOT")]
        check("npcsub: sin errores de JS", not errs, errs[:3])
    finally: b.close(); srv.stop()

if A.sync:
    subprocess.check_call(["node", "scripts/sync-client.js", A.sync], cwd=ROOT, stdout=subprocess.DEVNULL)
SC = {"lobby": scenario_lobby, "game": scenario_game, "restart": lambda pw: scenario_game(pw, True), "persist": scenario_persist, "persisthard": lambda pw: scenario_persist(pw, True), "stun": scenario_stun, "timers": scenario_timers, "time": scenario_time, "presence": scenario_presence, "dual": scenario_dual, "csp": scenario_csp, "absvote": scenario_absvote, "external": scenario_external, "desktop": scenario_desktop, "small": lambda pw: scenario_desktop(pw, 360, 640, "360"), "npc2": scenario_npc2, "npcroom": scenario_npcroom, "npcsub": scenario_npcsub}
with sync_playwright() as pw:
    for k, f in SC.items():
        if A.only and k != A.only: continue
        print("== escenario", k, flush=True)
        try: f(pw)
        except Exception as e: check(k + ": excepción del escenario", False, repr(e)[:300])
check("sin textos de «pasar el móvil» en ninguna pantalla en línea", not HAND_HITS, "; ".join("%s: %s" % h for h in HAND_HITS[:5]))
bad = [r for r in RESULTS if not r[1]]
print("\nRESUMEN: %d comprobaciones, %d fallos" % (len(RESULTS), len(bad)))
sys.exit(1 if bad else 0)
