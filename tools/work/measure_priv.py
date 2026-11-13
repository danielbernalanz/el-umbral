import random, sys, json
from playwright.sync_api import sync_playwright
BASE="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/"
tag=sys.argv[1]; seed=int(sys.argv[2]) if len(sys.argv)>2 else 3
random.seed(seed); res={}
JS="""()=>{const pp=document.getElementById('privatePanel');
const vis=e=>e.offsetParent!==null&&e.getBoundingClientRect().height>0;
const sel='details,.notice,h3,.itemrow,.clue,.chips,#privateStory,#privateGear,#privatePassives,#privateTemptation';
const all=[...pp.querySelectorAll(sel)].filter(vis);
const det=document.getElementById('playerInteractions');
const sh=det?det.getBoundingClientRect().height:0;
return {h:Math.round(pp.getBoundingClientRect().height),sections:all.length,notices:all.filter(e=>e.classList.contains('notice')).length,h3:all.filter(e=>e.tagName=='H3').length,sheetOpen:det&&det.open,sheetH:Math.round(sh)}}"""
with sync_playwright() as pw:
    b=pw.chromium.launch(); page=b.new_context(viewport={"width":390,"height":844}).new_page()
    page.on("dialog",lambda d:d.dismiss())
    page.goto("file://"+BASE+"apk/assets/www/index.html")
    page.select_option("#playerCount","3")
    for i in range(3): page.fill("#name%d"%i,"J%d"%(i+1))
    page.fill("#gameEnd",page.evaluate("m=>{const d=new Date(Math.round(Date.now()/60000)*60000+Math.min(m,119)*60000);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}",int("12"))); page.click("#btnStart")
    vis=lambda s: page.locator(s).count() and page.locator(s).first.is_visible()
    for step in range(1500):
        if vis("#ending"): break
        if vis("#overlay"):
            bt=page.locator("#rollActions button")
            bt.first.click() if bt.count() else page.wait_for_timeout(250)
        elif vis("#actionOverlay"): page.click("#btnActionChoose")
        elif vis("#handoff"): page.click("#btnHandoff")
        elif vis("#privatePanel"):
            r=page.evaluate("UMBRAL.getState().round"); pid=page.evaluate("UMBRAL.currentPlayer().id")
            if (r in (1,3,6)) and (r,pid) not in [tuple(map(int,k.split(','))) for k in res]:
                page.evaluate("document.getElementById('playerInteractions').open=false")
                page.set_viewport_size({"width":390,"height":3200}); m=page.evaluate(JS); page.locator('#privatePanel').screenshot(path=BASE+"shots/%s_r%d_p%d.png"%(tag,r,pid))
                page.evaluate("document.getElementById('playerInteractions').open=true")
                m2=page.evaluate(JS); page.locator('#privatePanel').screenshot(path=BASE+"shots/%s_r%d_p%d_sheet.png"%(tag,r,pid))
                m["sheet_open_h"]=m2["h"]; m["sheet_sections"]=m2["sections"]; m["sheetH"]=m2["sheetH"]
                res["%d,%d"%(r,pid)]=m
                page.evaluate("document.getElementById('playerInteractions').open=false"); page.set_viewport_size({"width":390,"height":844})
            if vis("[data-pact]"): page.locator("[data-pact]").first.click()
            elif vis("#offerNo"): page.click("#offerNo")
            elif vis("#handNo"): page.click("#handNo")
            else:
                ch=page.locator("#actionChoices .tile"); k=ch.count()
                if k: ch.nth(random.randrange(k)).click(timeout=3000)
                else:
                    c=page.locator("#actionChoices button"); c.nth(random.randrange(c.count())).click()
        elif vis("#prepPanel"): page.click("#btnPrepSkip")
        elif vis("#councilPanel"): page.click("#btnEndCouncil")
        elif vis("#resolutionPanel"): page.click("#btnNextRound")
        else: page.wait_for_timeout(200)
    for k,v in sorted(res.items()): print(k,v)
    b.close()
