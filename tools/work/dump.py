import random
from playwright.sync_api import sync_playwright
B="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/"
random.seed(3)
with sync_playwright() as pw:
    b=pw.chromium.launch(); page=b.new_context(viewport={"width":390,"height":844}).new_page()
    page.goto("file://"+B+"apk/assets/www/index.html")
    for i,n in enumerate(["Ana","Luis","Marta"]): page.fill("#name%d"%i,n)
    page.fill("#gameEnd",page.evaluate("m=>{const d=new Date(Math.round(Date.now()/60000)*60000+Math.min(m,119)*60000);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}",int("20"))); page.click("#btnStart")
    seen=set(); vis=lambda s: page.locator(s).count() and page.locator(s).first.is_visible()
    for step in range(120):
        for pn,sel in (("HANDOFF","#handoff"),("PRIVATE","#privatePanel"),("ACTIONSHEET","#actionOverlay"),("ROLL","#overlay"),("COUNCIL","#councilPanel"),("RESOLUTION","#resolutionPanel")):
            if vis(sel) and pn not in seen:
                seen.add(pn); print("=====",pn); print(page.locator("body").inner_text()[:1800] if pn!="ROLL" else page.locator("#overlay").inner_text()); 
        if vis("#overlay"):
            bt=page.locator("#rollActions button")
            if bt.count(): bt.first.click()
            page.wait_for_timeout(300); continue
        if vis("#actionOverlay"): page.click("#btnActionChoose"); continue
        if vis("#handoff"): page.click("#btnHandoff"); continue
        if vis("#privatePanel"):
            if vis("#offerNo"): page.click("#offerNo"); continue
            if vis("#handNo"): page.click("#handNo"); continue
            ch=page.locator("#actionChoices button"); ch.nth(random.randrange(ch.count())).click(); continue
        if vis("#councilPanel"): page.click("#btnEndCouncil"); continue
        if vis("#resolutionPanel"): break
        page.wait_for_timeout(200)
    b.close()
