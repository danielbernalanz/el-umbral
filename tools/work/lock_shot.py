import sys
from playwright.sync_api import sync_playwright
B="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/"
with sync_playwright() as pw:
    b=pw.chromium.launch(); page=b.new_context(viewport={"width":360,"height":740}).new_page()
    errs=[]; page.on("pageerror",lambda e:errs.append(str(e)[:200]))
    page.goto("file://"+B+"apk/assets/www/index.html")
    page.select_option("#playerCount","3")
    for i,n in enumerate(["Ana","Luis","Marta"]): page.fill("#name%d"%i,n)
    page.fill("#gameEnd",page.evaluate("m=>{const d=new Date(Math.round(Date.now()/60000)*60000+m*60000);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}",30)); page.click("#btnStart")
    page.wait_for_timeout(300)
    if page.locator("#btnHandoff").is_visible():
        page.screenshot(path=B+"shots/lock_handoff.png"); page.click("#btnHandoff")
    page.wait_for_timeout(300)
    page.click("#actionChoices button.ghost"); page.wait_for_timeout(200)
    print(page.evaluate("[...document.querySelectorAll('.lockrow')].map(e=>e.innerText)"))
    page.locator(".lockrow").first.scroll_into_view_if_needed()
    page.screenshot(path=B+"shots/lock_more.png")
    print(errs)
