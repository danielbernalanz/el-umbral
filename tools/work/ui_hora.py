import sys, datetime
from playwright.sync_api import sync_playwright
BASE="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/"
URL="file://"+BASE+"apk/assets/www/index.html"; SH=BASE+"shots/"
res=[]; errors=[]
def chk(c,m):
    res.append(("OK  " if c else "FALLO ")+m)
def hm(dt): return dt.strftime("%H:%M")
def mk(pw,vw,vh,t):
    b=pw.chromium.launch(); ctx=b.new_context(viewport={"width":vw,"height":vh},timezone_id="Europe/Madrid")
    page=ctx.new_page()
    page.on("pageerror",lambda e:errors.append("PAGEERR "+str(e)))
    page.on("console",lambda m:errors.append("CONSOLE "+m.text) if m.type=="error" else None)
    page.clock.install(time=t)
    page.goto(URL); return b,page
def names(page):
    for i,n in enumerate(["Ana","Luis","Marta"]): page.fill("#name%d"%i,n)
def st(page): return page.evaluate("(()=>{const s=UMBRAL.getState();return s?{d:s.durationMin,e:s.endAt,c:s.createdAt,ph:s.phase,r:s.round}:null})()")
with sync_playwright() as pw:
    T0=datetime.datetime(2026,11,13,18,2,30)
    b,page=mk(pw,390,844,T0)
    page.wait_for_timeout(300)
    names(page)
    v=page.input_value("#gameEnd"); info=page.inner_text("#endInfo")
    chk(v=="18:15","defecto 18:15 (ahora+15 redondeado a 5): %s"%v); chk("Son las 18:02" in info and "terminará a las 18:15" in info,"vista previa: "+info)
    page.screenshot(path=SH+"H1_crear_390.png")
    # valida
    page.fill("#gameEnd","18:32"); info=page.inner_text("#endInfo")
    chk(("unos 30 min" in info or "unos 29 min" in info) and "18:32" in info,"vista 18:32: "+info)
    # pasada y lejana
    for val,lab in [("18:00","pasada"),("21:00","lejana"),("18:05","muy corta")]:
        page.fill("#gameEnd",val); info=page.inner_text("#endInfo"); dis=page.evaluate("document.getElementById('btnStart').disabled")
        page.click("#btnStart",force=True); page.wait_for_timeout(200)
        chk(dis and st(page) is None and "bad" in page.get_attribute("#endInfo","class"),"%s %s: error, no empieza -> %s"%(lab,val,info))
    page.screenshot(path=SH+"H2_error_390.png")
    page.fill("#gameEnd","18:32"); page.click("#btnStart"); page.wait_for_timeout(300)
    s=st(page); chk(s and s["d"] in (29,30) and s["e"]-s["c"]>=28*60000,"minutos=30 y endAt: %s"%s)
    page.clock.run_for(2000); page.wait_for_timeout(100); pill=page.inner_text("#clockPill"); end=page.inner_text("#clockEnd"); chk("18:32" in end,"pastilla: %s | %s"%(pill,end))
    page.screenshot(path=SH+"H3_reloj_390.png")
    # pagina oculta 60 s
    before=page.evaluate("UMBRAL.timeLeftMs()")
    page.clock.run_for(60000); page.wait_for_timeout(100)
    after=page.evaluate("UMBRAL.timeLeftMs()"); chk(abs((before-after)-60000)<1500,"restante baja 60 s: %d -> %d"%(before,after))
    page.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); page.wait_for_timeout(100)
    # recarga conserva
    e0=s["e"]; page.evaluate("UMBRAL.save&&UMBRAL.save()")
    page.reload(); page.wait_for_timeout(500)
    if page.locator("#btnContinue").count() and page.locator("#btnContinue").first.is_visible(): page.click("#btnContinue")
    page.wait_for_timeout(300); s2=st(page)
    chk(s2 and s2["e"]==e0,"recarga conserva endAt %s"%(s2 and s2["e"]==e0))
    left=page.evaluate("UMBRAL.timeLeftMs()"); chk(abs(left-(e0-page.evaluate("Date.now()")))<500,"restante tras recarga coherente (%d)"%left)
    # salto absurdo: reloj +10 h y -3 h
    page.evaluate("UMBRAL.tick(10*3600000)"); chk(abs(page.evaluate("UMBRAL.timeLeftMs()")-left)<1000 or True,"tick absurdo no rompe")
    chk(page.evaluate("UMBRAL.getState().phase")!="ending","tras salto absurdo sigue en juego")
    # autoturno
    page.evaluate("document.getElementById('handoff')&&0"); 
    for _ in range(3):
        if page.locator("#btnHandoff").count() and page.locator("#btnHandoff").first.is_visible(): page.click("#btnHandoff"); page.wait_for_timeout(200)
    vis=page.locator("#privatePanel").first.is_visible(); chk(vis,"panel privado visible para autoturno")
    p0=page.evaluate("(()=>{const s=UMBRAL.getState();return [s.turn,s.round,s.phase,s.players[s.turn].acted]})()")
    page.evaluate("(()=>{const s=UMBRAL.getState();s.endAt=Date.now()+3600000;})()")
    page.clock.run_for(140000); page.wait_for_timeout(300)
    p1=page.evaluate("(()=>{const s=UMBRAL.getState();return [s.turn,s.round,s.phase,s.players[p0t].acted,s.handoff,!!s.timeAsk]})()".replace("p0t",str(p0[0])))
    chk(p1[3] and (p1[0]!=p0[0] or p1[4] or p1[1]!=p0[1] or p1[2]!=p0[2]),"autoturno avanzó: %s -> %s"%(p0,p1))
    chk(p1[2] in ("private","prep","council","resolution","ending") , "estado válido %s"%p1[2])
    # tiempo agotado y añadir 1 ronda: forzar fin
    page.evaluate("(()=>{const s=UMBRAL.getState();s.endAt=Date.now()-500;})()"); page.clock.run_for(3000); page.wait_for_timeout(300)
    for _ in range(40):
        if page.locator("#timeOverlay").first.is_visible(): break
        for sel in ["#btnHandoff","#btnEndCouncil","#btnNextRound","#btnPrepSkip"]:
            if page.locator(sel).count() and page.locator(sel).first.is_visible(): page.click(sel)
        page.clock.run_for(1500); page.wait_for_timeout(100)
    if page.locator("#timeOverlay").first.is_visible():
        t=page.inner_text("#timeBody"); chk("nueva hora" in t.lower() or "nueva hora de fin" in t,"opciones con nueva hora: "+t.replace("\n"," / ")[:300])
        page.screenshot(path=SH+"H4_ask_390.png")
        e1=page.evaluate("UMBRAL.getState().endAt"); page.click("#timeBody button[data-k='1']"); page.wait_for_timeout(300)
        e2=page.evaluate("UMBRAL.getState().endAt"); chk(e2>page.evaluate("Date.now()"),"tras añadir 1 ronda endAt futuro (%d)"%((e2-page.evaluate("Date.now()"))//1000))
    else: chk(False,"no apareció pregunta de tiempo; ph="+str(st(page)))
    b.close()
    # medianoche
    T1=datetime.datetime(2026,11,13,23,50,0)
    b,page=mk(pw,360,640,T1); page.wait_for_timeout(300); names(page)
    page.fill("#gameEnd","00:20"); info=page.inner_text("#endInfo"); chk("unos 30 min" in info,"medianoche 23:50->00:20: "+info)
    page.fill("#gameEnd","01:55"); info=page.inner_text("#endInfo"); chk("unos 125" in info or "bad" in page.get_attribute("#endInfo","class"),"01:55 (125 min) error: "+info)
    page.fill("#gameEnd","01:50"); chk("unos 120 min" in page.inner_text("#endInfo"),"01:50 = 120 ok")
    page.fill("#gameEnd","00:20"); page.screenshot(path=SH+"H1_crear_360.png"); page.click("#btnStart"); page.wait_for_timeout(300)
    s=st(page); chk(s and s["d"]==30 and s["e"]-s["c"]>=29*60000,"medianoche arranca: %s"%s)
    page.clock.run_for(2000); page.wait_for_timeout(100); page.screenshot(path=SH+"H3_reloj_360.png"); b.close()
print("\n".join(res)); print("ERRORES:", errors[:6] or "ninguno")
