import sys
from playwright.sync_api import sync_playwright
BASE="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/"
errs=[]
with sync_playwright() as pw:
    b=pw.chromium.launch(); page=b.new_context(viewport={"width":390,"height":844}).new_page()
    page.on("pageerror",lambda e:errs.append(str(e)[:200])); page.on("dialog",lambda d:(errs.append("DIALOGO "+d.message),d.dismiss()))
    page.goto("file://"+BASE+"apk/assets/www/index.html")
    ids=page.evaluate("Object.keys(UMBRAL.D.ITEMS)")
    for iid in ids:
        page.goto("file://"+BASE+"apk/assets/www/index.html")
        page.select_option("#playerCount","3")
        for i,n in enumerate(["Ana","Luis","Marta"]): page.fill("#name%d"%i,n)
        page.fill("#gameEnd",page.evaluate("m=>{const d=new Date(Math.round(Date.now()/60000)*60000+Math.min(m,119)*60000);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}",int("20"))); page.click("#btnStart")
        page.evaluate("(id)=>{const s=UMBRAL.getState(); const p=s.players[s.turn]; p.items=[{id}]; p.hp=Math.max(1,UMBRAL.maxHp(p)-4); p.status=[{id:'sangrado',left:2}]; p.corr=30; p.spells=p.spells||[]; }",iid)
        if page.locator("#btnHandoff").is_visible(): page.click("#btnHandoff")
        page.wait_for_timeout(100)
        page.evaluate("document.getElementById('playerInteractions').open=true")
        bt=page.locator("[data-item='0']")
        txt=page.locator("#sheetBody .itemrow").first.inner_text().replace("\n"," | ")[:110]
        if bt.count()==0:
            print(iid.ljust(11),"(sin botón)",txt); continue
        bt.click(); page.wait_for_timeout(100)
        if page.locator("#actionOverlay").is_visible(): page.click("#btnActionChoose")
        page.wait_for_timeout(150)
        # destinos (pista/polvo)
        pend=page.locator("#actionChoices button")
        if page.locator("#actionChoices .tag").count() and "OBJETO" in page.locator("#actionChoices").inner_text().upper()[:80] or (pend.count() and pend.first.inner_text().strip() in ("Luis","Marta")):
            pend.first.click(); page.wait_for_timeout(150)
        toast=page.locator(".toast").first.inner_text() if page.locator(".toast").count() else "(sin aviso)"
        print(iid.ljust(11),"|",toast[:110])
    print("errores:",errs); b.close()
