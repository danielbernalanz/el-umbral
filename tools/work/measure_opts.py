import random, sys, json
from playwright.sync_api import sync_playwright
WWW=sys.argv[1]; mins=int(sys.argv[2]); n=int(sys.argv[3]); seed=int(sys.argv[4]) if len(sys.argv)>4 else 1
random.seed(seed)
JS="""()=>{const pp=document.getElementById('privatePanel');
const vis=e=>e.offsetParent!==null&&e.getBoundingClientRect().height>0;
const c=[...pp.querySelectorAll('button,summary,select,input')].filter(vis);
return {opts:c.length,h:Math.round(pp.getBoundingClientRect().height)}}"""
res=[]; errs=[]
with sync_playwright() as pw:
    b=pw.chromium.launch(); page=b.new_context(viewport={"width":390,"height":844}).new_page()
    page.on("pageerror",lambda e:errs.append(str(e)[:150]))
    page.on("dialog",lambda d:d.dismiss())
    page.goto("file://"+WWW+"/index.html")
    page.select_option("#playerCount",str(n))
    for i in range(n): page.fill("#name%d"%i,"J%d"%(i+1))
    page.fill("#gameMinutes",str(mins)); page.click("#btnStart")
    vis=lambda s: page.locator(s).count() and page.locator(s).first.is_visible()
    seen=set()
    for step in range(6000):
        if vis("#ending"): break
        if vis("#overlay"):
            bt=page.locator("#rollActions button")
            bt.first.click() if bt.count() else page.wait_for_timeout(250)
        elif vis("#actionOverlay"): page.click("#btnActionChoose")
        elif vis("#handoff"): page.click("#btnHandoff")
        elif vis("#privatePanel"):
            r=page.evaluate("UMBRAL.getState().round"); pid=page.evaluate("UMBRAL.currentPlayer().id")
            if (r,pid) not in seen and page.locator("#actionChoices .tile").count():
                seen.add((r,pid)); res.append(page.evaluate(JS)["opts"])
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
    b.close()
print("www",WWW.split('/')[-1],"min",mins,"n",n,"turnos",len(res),"max",max(res or [0]),"media",round(sum(res)/max(1,len(res)),1),"err",errs[:2])
