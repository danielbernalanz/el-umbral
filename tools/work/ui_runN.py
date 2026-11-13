import random, sys, time
from playwright.sync_api import sync_playwright
BASE="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/"
URL="file://"+BASE+"apk/assets/www/index.html"
import os
NP=int(os.environ.get("NP","3"))
SH=BASE+"shots/np%d_"%NP
seed=int(sys.argv[1]) if len(sys.argv)>1 else 1
random.seed(seed)
errors=[]; seen=set(); log=[]
def shot(page,name):
    if name in seen: return
    seen.add(name); page.screenshot(path=SH+name+".png")
with sync_playwright() as pw:
    b=pw.chromium.launch()
    ctx=b.new_context(viewport={"width":390,"height":844},device_scale_factor=1)
    page=ctx.new_page()
    page.on("pageerror",lambda e:errors.append("PAGEERR "+str(e)))
    page.on("console",lambda m:errors.append("CONSOLE "+m.text) if m.type=="error" else None)
    page.on("dialog",lambda d:d.accept())
    page.goto(URL)
    shot(page,"00_start")
    page.select_option("#playerCount",str(NP))
    for i,n in enumerate(["Ana","Luis","Marta","Pablo","Eva","Iker","Noa","Leo","Mia","Rut"][:NP]): page.fill("#name%d"%i,n)
    page.fill("#gameEnd",page.evaluate("m=>{const d=new Date(Math.round(Date.now()/60000)*60000+m*60000);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}",12))
    page.click("#btnStart")
    steps=0
    def vis(sel):
        return page.locator(sel).first.is_visible() if page.locator(sel).count() else False
    while steps<900:
        steps+=1
        if vis("#ending"):
            shot(page,"90_ending"); page.click("#btnLog"); page.wait_for_timeout(300); page.screenshot(path=SH+"91_log.png"); print("LOG chars",len(page.input_value("#logText"))); break
        try:
            if vis("#overlay"):
                shot(page,"20_roll")
                btns=page.locator("#rollActions button")
                if btns.count(): btns.first.click()
                else: page.wait_for_timeout(300)
                continue
            if vis("#actionOverlay"):
                shot(page,"15_sheet"); page.click("#btnActionChoose"); continue
            if vis("#handoff"):
                shot(page,"10_handoff"); page.click("#btnHandoff"); continue
            if vis("#privatePanel"):
                shot(page,"11_private")
                if vis("#offerYes"):
                    shot(page,"12_offer"); page.click("#offerYes" if random.random()<0.4 else "#offerNo"); continue
                if vis("#handYes"):
                    shot(page,"13_hand"); page.click("#handYes" if random.random()<0.6 else "#handNo"); continue
                if random.random()<0.35 and page.locator("[data-item]:not([disabled]):visible").count():
                    page.locator("[data-item]:not([disabled]):visible").nth(random.randrange(page.locator("[data-item]:not([disabled]):visible").count())).click(); shot(page,"14_itemsheet"); continue
                ch=page.locator("#actionChoices button")
                n=ch.count()
                if n==0: page.wait_for_timeout(200); continue
                idx=random.randrange(n)
                # evita cancelar
                for _ in range(5):
                    t=ch.nth(idx).inner_text()
                    if t.strip()!="Cancelar": break
                    idx=random.randrange(n)
                ch.nth(idx).click(timeout=3000); shot(page,"16_pick"); continue
            if vis("#councilPanel"):
                shot(page,"30_council"); page.click("#btnEndCouncil"); continue
            if vis("#resolutionPanel"):
                shot(page,"40_resolution"); page.click("#btnNextRound"); continue
            page.wait_for_timeout(200)
        except Exception as ex:
            errors.append("DRIVER "+str(ex)[:200]); page.screenshot(path=SH+"err_%d.png"%steps); break
    if steps>=900:
        page.screenshot(path=SH+"stuck.png")
        log.append("STUCK btns=" + "|".join(page.locator("button:visible").all_inner_texts())[:600])
        log.append("TXT=" + page.locator("#game").inner_text()[:700].replace("\n"," / "))
    log.append("steps=%d"%steps)
    st=page.evaluate("UMBRAL.getState() ? UMBRAL.getState().phase : 'none'")
    log.append("phase="+str(st))
    b.close()
print(" ".join(log)); print("\n".join(errors[:12]) or "SIN ERRORES")
