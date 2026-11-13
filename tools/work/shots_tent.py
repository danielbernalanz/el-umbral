import sys
from playwright.sync_api import sync_playwright
BASE="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/"
URL="file://"+BASE+"apk/assets/www/index.html"; SH=BASE+"shots/"
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=b.new_context(viewport={"width":390,"height":844},device_scale_factor=1); page=ctx.new_page()
    errs=[]; page.on("pageerror",lambda e:errs.append(str(e))); page.on("dialog",lambda d:d.accept())
    page.goto(URL)
    page.select_option("#playerCount","4")
    for i,n in enumerate(["Ana","Luis","Marta","Pablo"]): page.fill("#name%d"%i,n)
    page.fill("#gameMinutes","45"); page.click("#btnStart")
    # preparar estado antes de entregar el móvil
    page.evaluate("""()=>{const s=UMBRAL.getState(); s.round=4; const p=s.players[s.turn]; p.aggr=8; p.agg={stab:2,ambush:2,steal:1}; p.tempOffers=0; p.lastTemp=0; p.offer=null; p.stats.sombra=4; p.corr=32; p.dom={wins:2}; p.seen={}; UMBRAL.D.ACTIONS.forEach(a=>{ if(UMBRAL.isUnlocked(p,a) && a.id!=='sombra_espia') p.seen[a.id]=true; }); window.__rnd=Math.random; Math.random=()=>0; }""")
    page.click("#btnHandoff"); page.wait_for_timeout(400)
    page.evaluate("()=>{Math.random=window.__rnd}")
    page.wait_for_timeout(5500)
    page.evaluate("document.getElementById('privateOffer').scrollIntoView()")
    page.screenshot(path=SH+"tent_offer.png")
    print("offer visible:", page.locator("#offerYes").count(), page.locator("#privateOffer").inner_text()[:200].replace("\n"," / "))
    # rechazar y abrir 'Más acciones'
    page.click("#offerNo"); page.wait_for_timeout(300)
    tog=page.locator("#actionChoices button:has-text('Más acciones')")
    if tog.count(): tog.first.click(); page.wait_for_timeout(300)
    page.wait_for_timeout(5500)
    page.evaluate("document.getElementById('actionChoices').scrollIntoView()")
    page.screenshot(path=SH+"tent_sombras.png", full_page=True)
    page.locator("#actionChoices").screenshot(path=SH+"tent_sombras_group.png")
    print("tiles:", page.locator("#actionChoices .tile").count(), [t for t in page.locator("#actionChoices .tileName").all_inner_texts()])
    # abrir hoja de Sombras hostigadoras
    t=page.locator("#actionChoices .tile:has-text('Sombras espías')")
    if t.count(): t.first.click(); page.wait_for_timeout(300); page.screenshot(path=SH+"tent_sombras_sheet.png")
    print("errores:",errs)
    b.close()
