import sys
from playwright.sync_api import sync_playwright
W="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/index.html"
with sync_playwright() as pw:
    b=pw.chromium.launch(); pg=b.new_page(viewport={"width":int(sys.argv[1]),"height":int(sys.argv[2])}); pg.goto("file://"+W)
    pg.select_option("#playerCount","3")
    for i in range(3): pg.fill("#name%d"%i,"J%d"%(i+1))
    pg.fill("#gameMinutes","20"); pg.click("#btnStart"); pg.wait_for_timeout(400); pg.evaluate("document.getElementById('clockPill').textContent='29:59'")
    print(pg.evaluate("()=>[...document.querySelectorAll('header, header *')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return e.tagName+'.'+e.className+'#'+e.id+' '+Math.round(r.left)+'-'+Math.round(r.right)+' w'+Math.round(r.width)})"))
    pg.screenshot(path="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/work/out111/hdr_%s.png"%sys.argv[1])
    b.close()
