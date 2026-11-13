import random, sys
from playwright.sync_api import sync_playwright
BASE="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/"
WWW=BASE+"apk/assets/www"; SH=BASE+"shots/"
random.seed(5); errs=[]
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=b.new_context(viewport={"width":390,"height":844},permissions=["clipboard-read","clipboard-write"]); page=ctx.new_page()
    page.on("pageerror",lambda e:errs.append(str(e)[:200])); page.on("dialog",lambda d:(errs.append("DIALOGO "+d.message),d.dismiss()))
    page.goto("file://"+WWW+"/index.html")
    page.select_option("#playerCount","3")
    for i,n in enumerate(["Ana","Luis","Marta"]): page.fill("#name%d"%i,n)
    page.fill("#gameEnd",page.evaluate("m=>{const d=new Date(Math.round(Date.now()/60000)*60000+Math.min(m,119)*60000);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}",int("8"))); page.click("#btnStart")
    vis=lambda s: page.locator(s).count() and page.locator(s).first.is_visible()
    done_secret=False; done_ev=False
    for step in range(3000):
        if vis("#ending"): break
        if vis("#overlay"):
            bt=page.locator("#rollActions button"); bt.first.click() if bt.count() else page.wait_for_timeout(250)
        elif vis("#actionOverlay"): page.click("#btnActionChoose")
        elif vis("#handoff"): page.click("#btnHandoff")
        elif vis("#privatePanel"):
            r=page.evaluate("UMBRAL.getState().round")
            if not done_secret and r>=2:
                done_secret=True
                page.evaluate("document.getElementById('playerInteractions').open=true")
                page.locator("#privatePanel").scroll_into_view_if_needed()
                page.evaluate("document.getElementById('playerInteractions').scrollIntoView()")
                page.wait_for_timeout(3000); page.screenshot(path=SH+"n_ficha_secreto.png")
                page.click("#btnSecret"); page.wait_for_timeout(300); page.screenshot(path=SH+"n_secreto_hoja.png"); page.click("#btnSecretClose")
                page.evaluate("document.getElementById('playerInteractions').open=false")
            if vis("[data-pact]"): page.locator("[data-pact]").first.click()
            elif vis("#offerNo"): page.click("#offerNo")
            elif vis("#handNo"): page.click("#handNo")
            else:
                ch=page.locator("#actionChoices .tile"); k=ch.count()
                if k: ch.nth(random.randrange(k)).click(timeout=3000)
                else:
                    c=page.locator("#actionChoices button"); c.nth(random.randrange(c.count())).click()
        elif vis("#prepPanel"): page.click("#btnPrepSkip")
        elif vis("#councilPanel"): page.click("#btnEndCouncil")
        elif vis("#resolutionPanel"):
            if not done_ev:
                done_ev=True
                page.evaluate("(()=>{const s=UMBRAL.getState(); s.eventsSeen=UMBRAL.D.EVENTS.filter(e=>e.id!=='cosecha').map(e=>e.id);})()")
            page.click("#btnNextRound")
            if done_ev and not vis("#ending"):
                pass
        else: page.wait_for_timeout(200)
        if done_ev and vis("#handoff") and "cosecha" in str(page.evaluate("(UMBRAL.getState().event||{}).id")) and not page.evaluate("window.__shotEv||false"):
            page.evaluate("window.__shotEv=true"); page.screenshot(path=SH+"n_evento.png")
    page.wait_for_timeout(300)
    page.evaluate("document.getElementById('endingStory').scrollIntoView()")
    page.screenshot(path=SH+"n_final_top.png")
    page.evaluate("document.getElementById('btnStoryCopy').scrollIntoView({block:'center'})"); page.wait_for_timeout(200)
    page.screenshot(path=SH+"n_final_export.png")
    page.click("#btnStoryCopy"); page.wait_for_timeout(300)
    clip=""
    try: clip=page.evaluate("navigator.clipboard.readText()")
    except Exception as e: clip="ERR "+str(e)[:80]
    print("clipboard len",len(clip)); print(clip[:300])
    page.click("#btnStoryView"); page.wait_for_timeout(200); page.screenshot(path=SH+"n_historia_overlay.png"); page.click("#btnStoryClose")
    with page.expect_download(timeout=4000) as dl:
        page.click("#btnStoryDl")
    d=dl.value; d.save_as(SH+"story_dl.txt"); print("descarga:",d.suggested_filename)
    print("errores:",errs); b.close()
