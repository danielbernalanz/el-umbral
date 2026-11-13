import sys
from playwright.sync_api import sync_playwright
B="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/"
with sync_playwright() as pw:
    b=pw.chromium.launch()
    for w,h in [(360,640),(390,844)]:
        p=b.new_context(viewport={"width":w,"height":h}).new_page(); p.goto("file://"+B+"apk/assets/www/index.html")
        p.locator("#btnCredits").scroll_into_view_if_needed(); p.wait_for_timeout(600)
        print(w,p.inner_text("#verTag"),p.title()); p.screenshot(path=B+"shots/ver_%d.png"%w)
    b.close()
