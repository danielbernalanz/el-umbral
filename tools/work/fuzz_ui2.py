import random, sys, re, json
from playwright.sync_api import sync_playwright
BASE="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/"
WWW=sys.argv[1]; seed=int(sys.argv[2]); n=int(sys.argv[3]); mins=int(sys.argv[4]); VW=int(sys.argv[5]) if len(sys.argv)>5 else 390; VH=int(sys.argv[6]) if len(sys.argv)>6 else 844
random.seed(seed); errors=[]; stats={"steps":0,"enc":0,"ix":0,"item":0,"offer":0,"socorrer":0,"alzar":0,"ceder":0,"reload":0,"back":0,"dbl":0,"secret":0,"status":0,"story":0,"overflow":0}
BAD=re.compile(r"undefined|NaN|\[object|\bnull\b|Infinity|\{\w+\}")
def note(m):
    if m not in errors and len(errors)<12: errors.append(m)
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=b.new_context(viewport={"width":VW,"height":VH},permissions=["clipboard-read","clipboard-write"]); page=ctx.new_page()
    def hook(pg):
        pg.on("pageerror",lambda e:note("PAGEERR "+str(e)[:200]))
        pg.on("console",lambda m:note("CONSOLE "+m.text[:200]) if m.type=="error" else None)
        pg.on("dialog",lambda d:(note("DIALOGO NATIVO "+d.message[:80]),d.dismiss()))
    hook(page)
    page.goto("file://"+WWW+"/index.html")
    page.select_option("#playerCount",str(n))
    for i in range(n): page.fill("#name%d"%i,"J%d"%(i+1))
    page.fill("#gameEnd",page.evaluate("m=>{const d=new Date(Math.round(Date.now()/60000)*60000+Math.min(m,119)*60000);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}",int(str(mins)))); page.click("#btnStart")
    vis=lambda s: page.locator(s).count() and page.locator(s).first.is_visible()
    def scan(tag):
        try:
            t=page.locator("body").inner_text()
            m=BAD.search(t)
            if m: note("TEXTO ROTO (%s): ...%s..."%(tag,t[max(0,m.start()-50):m.end()+30].replace("\n"," / ")))
            ov=page.evaluate("()=>{const d=document.documentElement;let w=0;document.querySelectorAll('body *').forEach(e=>{if(e.offsetParent===null)return;const r=e.getBoundingClientRect();if(r.width>0&&r.right>d.clientWidth+2&&getComputedStyle(e).position!=='fixed'&&!e.closest('textarea,pre,[style*=overflow]'))w++});return [d.scrollWidth-d.clientWidth,w]}")
            if ov[0]>2: stats["overflow"]+=1; note("DESBORDE horizontal %s (%s) %dpx"%(tag,page.locator('body').inner_text()[:40].replace("\n"," "),ov[0]))
        except Exception as ex: pass
    def maybe_reload():
        stats["reload"]+=1
        page.reload(); page.wait_for_timeout(150)
        if vis("#btnContinue") and page.locator("#btnContinue").is_enabled(): page.click("#btnContinue")
        else:
            ph=page.evaluate("UMBRAL.getState()?UMBRAL.getState().phase:'none'")
            if ph not in ("ending","none"): note("RECARGA sin Continuar en fase %s"%ph)
    def click(sel,dbl=False):
        loc=page.locator(sel).first
        if dbl and random.random()<.25:
            stats["dbl"]+=1; loc.click(click_count=2,delay=10,timeout=3000)
        else: loc.click(timeout=3000)
    last=""; same=0; lastphase=None
    for step in range(9000):
        stats["steps"]=step
        try:
            if vis("#ending"): break
            ph=page.evaluate("(()=>{const s=UMBRAL.getState();return s?s.phase+':'+s.round+':'+s.turn+':'+s.handoff:'none'})()")
            if ph!=lastphase:
                lastphase=ph; r=random.random()
                if r<.06: maybe_reload(); continue
                if r<.10:
                    stats["back"]+=1; page.evaluate("history.back()"); page.wait_for_timeout(80)
                    if vis("#backOverlay"):
                        if random.random()<.5: page.click("#btnBackStay")
                        else: page.click("#btnBackExit"); page.wait_for_timeout(200); 
                        if vis("#btnContinue") and page.locator("#btnContinue").is_enabled(): page.click("#btnContinue")
                    continue
                if r<.16 and vis("#btnSecret") and not vis("#handoff"):
                    stats["secret"]+=1; page.click("#btnSecret"); page.wait_for_timeout(60); scan("secreto"); page.click("#btnSecretClose")
                if r<.2:
                    stats["status"]+=1; page.click("#btnStatus"); page.wait_for_timeout(60); scan("estado"); page.click("#btnCloseStatus")
            scan(ph)
            if vis("#logOverlay"): page.click("#btnLogClose"); continue
            if vis("#overlay"):
                bt=page.locator("#rollActions button")
                if bt.count():
                    if "ENCUENTRO" in page.locator("#rollTitle").inner_text(): stats["enc"]+=1
                    bt.nth(random.randrange(bt.count()) if random.random()<.5 else 0).click()
                else: page.wait_for_timeout(250)
            elif vis("#actionOverlay"):
                (page.click("#btnActionChoose") if random.random()<.85 else page.click("#btnActionCancel"))
            elif vis("#backOverlay"): page.click("#btnBackStay")
            elif vis("#handoff"): click("#btnHandoff",True)
            elif vis("#privatePanel"):
                if page.locator("[data-pact]").count() and vis("[data-pact]"): page.locator("[data-pact]").nth(random.randrange(page.locator("[data-pact]").count())).click()
                elif vis("#offerYes"): stats["offer"]+=1; page.click("#offerYes" if random.random()<.5 else "#offerNo")
                elif vis("#handYes"): page.click("#handYes" if random.random()<.5 else "#handNo")
                elif vis("#advClose") and random.random()<.3: page.click("#advClose")
                elif random.random()<.35:
                    page.evaluate("()=>{const d=document.getElementById('playerInteractions'); if(d) d.open=true}")
                    l=page.locator("[data-item]:not([disabled]):visible")
                    if l.count(): stats["item"]+=1; l.nth(random.randrange(l.count())).click(timeout=3000)
                    else: page.wait_for_timeout(50)
                else:
                    ch=page.locator("#actionChoices button"); k=ch.count()
                    soc=page.locator("#actionChoices button:has-text('Socorrer')")
                    alz=page.locator("#actionChoices button:has-text('Alzar')")
                    ced=page.locator("#actionChoices button:has-text('Ceder')")
                    if k and soc.count() and random.random()<.8: stats["socorrer"]+=1; soc.first.click(timeout=3000)
                    elif k and alz.count() and random.random()<.7: stats["alzar"]+=1; alz.first.click(timeout=3000)
                    elif k and ced.count() and random.random()<.6: stats["ceder"]+=1; ced.first.click(timeout=3000)
                    elif k: ch.nth(random.randrange(k)).click(timeout=3000)
                    else: page.wait_for_timeout(200)
            elif vis("#prepPanel"):
                cards=page.locator("#prepCards button")
                if cards.count() and random.random()<.7:
                    cards.nth(random.randrange(cards.count())).click()
                    if vis("#prepTarget"):
                        page.select_option("#prepTarget",index=random.randrange(max(1,page.locator("#prepTarget option").count())))
                        if random.random()<.5 and vis("#prepKind"): page.select_option("#prepKind",index=random.randrange(3))
                    elif vis("#btnPrepSave"): note("PREPTARGET oculto con Guardar visible")
                    if vis("#btnPrepSave"):
                        bb=page.locator("#btnPrepSave").bounding_box()
                        if not(bb and bb["y"]+bb["height"]<=VH+1 and bb["y"]>=0): note("GUARDAR fuera de pantalla %s"%bb)
                        click("#btnPrepSave",True); stats["ix"]+=1
                    else: click("#btnPrepSkip",True)
                else: click("#btnPrepSkip",True)
            elif vis("#councilPanel"): click("#btnEndCouncil",True)
            elif vis("#resolutionPanel"): click("#btnNextRound",True)
            else: page.wait_for_timeout(200)
            txt=page.locator("body").inner_text()[:300]
            same = same+1 if txt==last else 0; last=txt
            if same>60: note("ATASCADO en: "+txt.replace("\n"," / ")[:200]); page.screenshot(path=BASE+"shots/fuzz_stuck.png"); break
        except Exception as ex:
            note("DRIVER "+str(ex)[:160]); page.screenshot(path=BASE+"shots/fuzz_err.png"); break
    fin=page.evaluate("UMBRAL.getState()? UMBRAL.getState().phase : 'none'")
    if fin=="ending" or vis("#ending"):
        scan("ending"); page.screenshot(path=BASE+"shots/fz2_end_%d_%d.png"%(n,VW))
        try:
            page.click("#btnStoryCopy"); page.wait_for_timeout(120)
            page.click("#btnStoryView"); page.wait_for_timeout(80); t=page.locator("#storyText").input_value()
            if BAD.search(t) or len(t)<200: note("HISTORIA rota/corta: "+t[:80]+" len%d"%len(t))
            scan("story"); page.screenshot(path=BASE+"shots/fz2_story_%d_%d.png"%(n,VW)); page.click("#btnStoryClose")
            with page.expect_download(timeout=3000) as dl: page.click("#btnStoryDl")
            stats["story"]+=1
            page.click("#btnLog"); page.wait_for_timeout(80); lt=page.locator("#logText").input_value() if page.locator("#logText").evaluate("e=>e.tagName")=="TEXTAREA" else page.locator("#logText").inner_text()
            if re.search(r"undefined|NaN|\[object",re.sub(r"RECHAZADO.*","",lt)): note("LOG roto")
            if "ANOMALÍAS: ninguna" not in lt: note("LOG anomalías: "+re.search(r"ANOMALÍAS: .*",lt).group(0)[:200])
        except Exception as ex: note("EXPORT "+str(ex)[:150])
    print("n",n,"min",mins,"seed",seed,"vp",VW,VH,stats,"fase final",fin,"|", errors or "OK")
    b.close()
