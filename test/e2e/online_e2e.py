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
import argparse, json, os, random, socket, subprocess, sys, time

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
    def __init__(self, port=None, script="server/index.js"):
        self.port = port or free_port(); self.p = None; self.script = script
    def start(self):
        env = dict(os.environ, PORT=str(self.port))
        self.p = subprocess.Popen(["node", self.script], cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        for _ in range(100):
            try:
                socket.create_connection(("127.0.0.1", self.port), 0.2).close(); return self
            except OSError: time.sleep(0.1)
        raise RuntimeError("el servidor no arrancó")
    def stop(self):
        if self.p: self.p.terminate(); self.p.wait(5); self.p = None
    @property
    def url(self): return "http://127.0.0.1:%d/" % self.port

SSE_HOOK = """(()=>{const E=window.EventSource;window.__sse=[];
window.EventSource=function(u,o){const e=new E(u,o);e.addEventListener('view',ev=>{window.__sse.push(ev.data);if(window.__sse.length>80)window.__sse.shift();});return e;};
window.EventSource.prototype=E.prototype;window.EventSource.CLOSED=2;window.EventSource.CONNECTING=0;window.EventSource.OPEN=1;})();"""

class Client:
    def __init__(self, browser, name, vw=390, vh=844):
        self.name = name
        self.ctx = browser.new_context(viewport={"width": vw, "height": vh})
        self.ctx.add_init_script(SSE_HOOK)
        self.pg = self.ctx.new_page()
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

PUBLIC_KEYS = {"id", "name", "dead", "dying", "exposed", "visibleHealth", "ready", "online", "host", "alignment", "risenBy"}

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
                        if "wait" not in shot_done: c.shot("20_esperando"); shot_done.add("wait"); stats["wait_text"] = c.txt("#waitList")[:120]
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

def scenario_stun(pw):
    """Mitad de la fase privada: otro jugador deja a Ana sin turno (acted=true sin haber elegido). F2 aún no lo cierra en el servidor:
    la interfaz debe llevarla sola a la declaración/fin de turno y la partida debe seguir (nadie bloqueado)."""
    srv = Server(script="test/e2e/test_server.js").start(); b = pw.chromium.launch(); rnd = random.Random(A.seed)
    try:
        cs = [Client(b, "s_ana"), Client(b, "s_luis"), Client(b, "s_marta")]
        open_online(cs[0], srv.url); code = create_room(cs[0], "Ana")
        for c, n in zip(cs[1:], ("Luis", "Marta")): open_online(c, srv.url); join_room(c, n, code)
        cs[0].pg.wait_for_function("document.querySelectorAll('#roomPlayers .rplayer').length===3", timeout=10000)
        cs[0].pg.fill("#netEnd", end_time(A.mins)); cs[0].pg.click("#btnOnStart")
        for c in cs: c.pg.wait_for_selector("#privatePanel", state="visible", timeout=15000)
        import urllib.request
        urllib.request.urlopen(srv.url + "__test/stun?room=%s&pid=0" % code).read()
        t0 = time.time(); r2 = False
        while time.time() - t0 < 120:
            for c in cs:
                if c is cs[0] and cs[0].vis("#privatePanel") and time.time() - t0 < 1.5: continue   # deja actuar a la interfaz sola
                try: bot_step(c, rnd)
                except Exception as e: c.errors.append("BOT " + str(e)[:120])
            st = [c.pg.evaluate("(()=>{const s=UmbralNet.backend.getState();return s?s.round:0})()") for c in cs]
            if all(x >= 2 for x in st): r2 = True; break
        check("stun: sin turno por culpa de otro jugador -> la interfaz sigue sola y la ronda 2 empieza para los 3", r2, st)
        cs[0].shot("50_tras_stun")
        errs = [e for c in cs for e in c.errors]
        check("stun: sin errores de JS", not errs, errs[:3])
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

if A.sync:
    subprocess.check_call(["node", "scripts/sync-client.js", A.sync], cwd=ROOT, stdout=subprocess.DEVNULL)
SC = {"lobby": scenario_lobby, "game": scenario_game, "restart": lambda pw: scenario_game(pw, True), "stun": scenario_stun, "external": scenario_external, "desktop": scenario_desktop, "small": lambda pw: scenario_desktop(pw, 360, 640, "360")}
with sync_playwright() as pw:
    for k, f in SC.items():
        if A.only and k != A.only: continue
        print("== escenario", k, flush=True)
        try: f(pw)
        except Exception as e: check(k + ": excepción del escenario", False, repr(e)[:300])
bad = [r for r in RESULTS if not r[1]]
print("\nRESUMEN: %d comprobaciones, %d fallos" % (len(RESULTS), len(bad)))
sys.exit(1 if bad else 0)
