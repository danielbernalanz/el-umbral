import random, sys
from playwright.sync_api import sync_playwright
BASE="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/"
WWW=sys.argv[1]; seed=int(sys.argv[2]); n=int(sys.argv[3]); mins=int(sys.argv[4])
random.seed(seed); errors=[]; stats={"steps":0,"enc":0,"ix":0,"item":0,"offer":0,"socorrer":0,"prepvis":0}
with sync_playwright() as pw:
    b=pw.chromium.launch(); page=b.new_context(viewport={"width":390,"height":844}).new_page()
    page.on("pageerror",lambda e:errors.append("PAGEERR "+str(e)[:200]))
    page.on("console",lambda m:errors.append("CONSOLE "+m.text[:200]) if m.type=="error" else None)
    page.on("dialog",lambda d:(errors.append("DIALOGO NATIVO "+d.message[:80]),d.dismiss()))
    page.goto("file://"+WWW+"/index.html")
    page.select_option("#playerCount",str(n))
    for i in range(n): page.fill("#name%d"%i,"J%d"%(i+1))
    page.fill("#gameEnd",page.evaluate("m=>{const d=new Date(Math.round(Date.now()/60000)*60000+Math.min(m,119)*60000);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}",int(str(mins)))); page.click("#btnStart")
    vis=lambda s: page.locator(s).count() and page.locator(s).first.is_visible()
    last=""; same=0
    for step in range(8000):
        stats["steps"]=step
        try:
            if vis("#ending"): break
            if vis("#logOverlay"): page.click("#btnLogClose"); continue
            if vis("#overlay"):
                bt=page.locator("#rollActions button")
                if bt.count():
                    if "ENCUENTRO" in page.locator("#rollTitle").inner_text(): stats["enc"]+=1
                    bt.nth(random.randrange(bt.count()) if random.random()<.5 else 0).click()
                else: page.wait_for_timeout(250)
            elif vis("#actionOverlay"):
                (page.click("#btnActionChoose") if random.random()<.85 else page.click("#btnActionCancel"))
            elif vis("#handoff"): page.click("#btnHandoff")
            elif vis("#privatePanel"):
                if page.locator("[data-pact]").count() and vis("[data-pact]"): page.locator("[data-pact]").nth(random.randrange(page.locator("[data-pact]").count())).click()
                elif vis("#offerYes"): stats["offer"]+=1; page.click("#offerYes" if random.random()<.5 else "#offerNo")
                elif vis("#handYes"): page.click("#handYes" if random.random()<.5 else "#handNo")
                elif vis("#advClose") and random.random()<.3: page.click("#advClose")
                elif random.random()<.3 and page.locator("[data-item]:not([disabled]):visible").count():
                    stats["item"]+=1; l=page.locator("[data-item]:not([disabled]):visible"); l.nth(random.randrange(l.count())).click()
                else:
                    ch=page.locator("#actionChoices button"); k=ch.count()
                    soc=page.locator("#actionChoices button:has-text('Socorrer')")
                    if k and soc.count() and random.random()<.85: stats["socorrer"]+=1; soc.first.click(timeout=3000)
                    elif k: ch.nth(random.randrange(k)).click(timeout=3000)
                    else: page.wait_for_timeout(200)
            elif vis("#prepPanel"):
                cards=page.locator("#prepCards button")
                if cards.count() and random.random()<.7:
                    cards.nth(random.randrange(cards.count())).click()
                    if vis("#prepTarget"):
                        page.select_option("#prepTarget",index=random.randrange(max(1,page.locator("#prepTarget option").count())))
                        if random.random()<.5 and vis("#prepKind"): page.select_option("#prepKind",index=random.randrange(3))
                    elif vis("#btnPrepSave"): errors.append("PREPTARGET oculto con Guardar visible")
                    if vis("#btnPrepSave"):
                        bb=page.locator("#btnPrepSave").bounding_box()
                        if bb and bb["y"]+bb["height"]<=844 and bb["y"]>=0: stats["prepvis"]+=1
                        else: errors.append("GUARDAR fuera de pantalla %s"%bb)
                        page.click("#btnPrepSave"); stats["ix"]+=1
                    else: page.click("#btnPrepSkip")
                else: page.click("#btnPrepSkip")
            elif vis("#councilPanel"): page.click("#btnEndCouncil")
            elif vis("#resolutionPanel"): page.click("#btnNextRound")
            else: page.wait_for_timeout(200)
            txt=page.locator("body").inner_text()[:300]
            same = same+1 if txt==last else 0; last=txt
            if same>60: errors.append("ATASCADO en: "+txt.replace("\n"," / ")[:200]); page.screenshot(path=BASE+"shots/fuzz_stuck.png"); break
        except Exception as ex:
            errors.append("DRIVER "+str(ex)[:160]); page.screenshot(path=BASE+"shots/fuzz_err.png"); break
    fin=page.evaluate("UMBRAL.getState()? UMBRAL.getState().phase : 'none'")
    print("n",n,"min",mins,"seed",seed,stats,"fase final",fin,"|", errors[:3] or "OK")
    b.close()
