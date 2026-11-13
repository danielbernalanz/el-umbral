import re
from playwright.sync_api import sync_playwright
BASE="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/"
BAD=re.compile(r"undefined|NaN|\[object|\bnull\b|Infinity|\{\w+\}")
errs=[]
with sync_playwright() as pw:
    b=pw.chromium.launch(); page=b.new_context(viewport={"width":360,"height":640}).new_page()
    page.on("pageerror",lambda e:errs.append("PAGEERR "+str(e)[:200])); page.on("dialog",lambda d:(errs.append("DIALOGO"),d.dismiss()))
    page.goto("file://"+BASE+"apk/assets/www/index.html")
    page.select_option("#playerCount","4")
    for i,n in enumerate(["Ana","Luis","Marta","Pablo"]): page.fill("#name%d"%i,n)
    page.fill("#gameEnd",page.evaluate("m=>{const d=new Date(Math.round(Date.now()/60000)*60000+Math.min(m,119)*60000);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}",int("30"))); page.click("#btnStart")
    page.evaluate("""()=>{const s=UMBRAL.getState(); s.round=4; s.players.forEach(p=>p.acted=false);
      const a=s.players[s.turn]; a.alignment='asesino'; a.asesinoRound=2; a.asesinoVia='ceder'; s.assassinId=a.id; a.corr=50; a.virtue=30;
      const d=s.players.find(p=>p.id!==a.id); UMBRAL._health.finish(d,'heridas');
      s.players.forEach(p=>{if(p.dead||p.dying)p.acted=true;}); }""")
    page.click("#btnHandoff") if page.locator("#btnHandoff").is_visible() else None
    page.wait_for_timeout(200)
    page.screenshot(path=BASE+"shots/alz_1.png")
    t=page.locator("#privatePanel").inner_text()
    if BAD.search(t): errs.append("texto roto en panel privado: "+BAD.search(t).group(0))
    # secreto
    page.click("#btnSecret"); page.wait_for_timeout(100); st=page.locator("#secretBody").inner_text(); page.screenshot(path=BASE+"shots/alz_secret.png")
    if BAD.search(st): errs.append("secreto roto")
    page.click("#btnSecretClose")
    # abrir mas acciones
    page.evaluate("()=>{document.querySelectorAll('#actionChoices details').forEach(d=>d.open=true)}")
    al=page.locator("#actionChoices button:has-text('Alzar')")
    print("Alzar visible:",al.count())
    if al.count():
        al.first.click(); page.wait_for_timeout(100)
        if page.locator("#actionOverlay").is_visible(): page.screenshot(path=BASE+"shots/alz_sheet.png"); page.click("#btnActionChoose"); page.wait_for_timeout(150)
        page.screenshot(path=BASE+"shots/alz_target.png")
        tb=page.locator("#actionChoices button")
        print("targets:",[tb.nth(i).inner_text() for i in range(tb.count())][:6])
        # elegir un caido
        cand=page.locator("#actionChoices button:has-text('Pablo'), #actionChoices button:has-text('Marta'), #actionChoices button:has-text('Luis')")
        for i in range(cand.count()):
            pass
        if tb.count(): tb.first.click(); page.wait_for_timeout(1500)
        page.screenshot(path=BASE+"shots/alz_roll.png")
        ro=page.locator("#overlay").inner_text() if page.locator("#overlay").is_visible() else ""
        print("roll:",ro.replace("\n"," | ")[:300])
        if BAD.search(ro): errs.append("roll roto")
    print("errores:",errs)
    b.close()
