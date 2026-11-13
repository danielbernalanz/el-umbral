import sys
from playwright.sync_api import sync_playwright
B="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/"
n=int(sys.argv[1]) if len(sys.argv)>1 else 3
with sync_playwright() as pw:
    b=pw.chromium.launch(); page=b.new_context(viewport={"width":390,"height":844}).new_page()
    errs=[]; page.on("pageerror",lambda e:errs.append(str(e)))
    page.on("dialog",lambda d:(errs.append("DIALOGO NATIVO "+d.message),d.dismiss()))
    page.goto("file://"+B+"apk/assets/www/index.html")
    nb=page.locator("#btnNews").is_visible()
    page.click("#btnNews"); page.wait_for_timeout(200)
    nopen=page.locator("#newsOverlay").is_visible() and "Novedades" in page.inner_text("#newsOverlay") and page.locator("#newsList .newsent.cur").count()==1
    page.click("#btnCloseNews"); page.wait_for_timeout(200)
    nclosed=not page.locator("#newsOverlay").is_visible()
    print("NOVEDADES boton",nb,"abre",nopen,"cierra",nclosed, "OK" if (nb and nopen and nclosed) else "FALLO")
    page.select_option("#playerCount",str(n))
    names=["Ana","Luis","Marta","Pablo","Eva","Iker","Noa","Leo","Mia","Rut"][:n]
    for i,nm in enumerate(names): page.fill("#name%d"%i,nm)
    page.fill("#gameEnd",page.evaluate("m=>{const d=new Date(Math.round(Date.now()/60000)*60000+Math.min(m,119)*60000);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}",int("20"))); page.click("#btnStart")
    vis=lambda s: page.locator(s).count() and page.locator(s).first.is_visible()
    shots=set(); proposed=0; accused=0; accepted=0
    for _ in range(400):
        if vis("#overlay"):
            bt=page.locator("#rollActions button")
            if bt.count(): 
                if "RESOLUCIÓN" in page.locator("#rollTitle").inner_text() and "res" not in shots: shots.add("res"); page.wait_for_timeout(2500); page.screenshot(path=B+"shots/council_result.png")
                bt.first.click()
        elif vis("#councilPanel"):
            if "council" not in shots: shots.add("council"); page.screenshot(path=B+"shots/council_new.png")
            page.click("#btnEndCouncil"); page.wait_for_timeout(200)
        elif vis("#actionOverlay"): page.click("#btnActionChoose")
        elif vis("#handoff"): page.click("#btnHandoff")
        elif vis("#prepPanel"):
            who=page.locator("#screenTitle").inner_text()
            cards=page.locator("#prepCards button")
            if "prep" not in shots: shots.add("prep"); page.screenshot(path=B+"shots/prep_a.png")
            if proposed<2 and cards.count():
                cards.last.click(); page.select_option("#prepTarget",index=0); page.screenshot(path=B+"shots/prep_b.png") if "prepb" not in shots and not shots.add("prepb") else None
                page.click("#btnPrepSave"); proposed+=1
            elif accused<1 and cards.count():
                cards.first.click(); page.select_option("#prepTarget",index=0); page.click("#btnPrepSave"); accused+=1
            else: page.click("#btnPrepSkip")
        elif vis("#privatePanel"):
            if vis("[data-pact]"):
                if "po" not in shots: shots.add("po"); page.screenshot(path=B+"shots/pact_offer.png")
                page.locator("[data-pact][data-yes]").first.click(); accepted+=1; continue
            if vis("#offerNo"): page.click("#offerNo"); continue
            if vis("#handNo"): page.click("#handNo"); continue
            if vis("#pactBox") and "pb" not in shots: shots.add("pb"); page.screenshot(path=B+"shots/pactbox.png")
            page.locator("#actionChoices button").first.click()
        elif vis("#resolutionPanel"):
            if proposed>=2 and accepted>=1: break
            page.click("#btnNextRound")
        elif vis("#ending"): break
        page.wait_for_timeout(150)
    st=page.evaluate("JSON.stringify({ph:UMBRAL.getState().phase,pacts:UMBRAL.getState().pacts.length,offers:UMBRAL.getState().pactOffers.length})")
    print("n",n,"propuestos",proposed,"acusaciones",accused,"aceptados",accepted,st,errs or "OK")
    b.close()
