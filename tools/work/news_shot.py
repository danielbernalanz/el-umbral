from playwright.sync_api import sync_playwright
B="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/"
with sync_playwright() as pw:
    b=pw.chromium.launch()
    for w,h,t in [(360,740,"360"),(1280,800,"1280")]:
        pg=b.new_context(viewport={"width":w,"height":h}).new_page(); pg.goto("file://"+B+"apk/assets/www/index.html"); pg.wait_for_timeout(300)
        pg.screenshot(path=B+"shots_anim/menu_%s.png"%t,full_page=True)
        pg.click("#btnNews"); pg.wait_for_timeout(300); pg.screenshot(path=B+"shots_anim/news_%s.png"%t)
        print(t,pg.evaluate("document.documentElement.scrollWidth<=window.innerWidth"))
