import sys
from playwright.sync_api import sync_playwright
B="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/"
with sync_playwright() as pw:
    b=pw.chromium.launch(); page=b.new_context(viewport={"width":390,"height":844}).new_page()
    errs=[]; page.on("pageerror",lambda e:errs.append(str(e)))
    page.goto("file://"+B+"apk/assets/www/index.html")
    page.select_option("#playerCount","3")
    for i,nm in enumerate(["Ana","Luis","Marta"]): page.fill("#name%d"%i,nm)
    page.fill("#gameMinutes","12"); page.click("#btnStart")
    page.evaluate("()=>{const s=UMBRAL.getState(); s.players.forEach(p=>{p.corr=50;p.hungerOn=s.round;p.notes.push('Ronda 1: El Umbral reclama algo. La próxima ronda, haz un acto oscuro o te herirá.')});}")
    page.click("#btnHandoff"); page.wait_for_timeout(500)
    page.evaluate("()=>{const d=document.querySelector('#playerInteractions, details.sheet, #sheetSum'); }")
    try: page.click("#sheetSum", timeout=2000)
    except Exception as e: errs.append("sheet "+str(e)[:80])
    page.wait_for_timeout(300); page.screenshot(path=B+"shots/umbral_ficha.png",full_page=True)
    txt=page.locator("#sheetBody").inner_text()
    print("FICHA:", txt[:600].replace("\n"," | "))
    try:
        page.click("#btnSecret",timeout=2000); page.wait_for_timeout(300); page.screenshot(path=B+"shots/umbral_secreto.png"); print("SECRETO:", page.locator("#secretBody").inner_text()[:700].replace("\n"," | "))
    except Exception as e: errs.append("secret "+str(e)[:80])
    print("errs",errs)
