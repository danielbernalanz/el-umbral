import sys
from playwright.sync_api import sync_playwright
W="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www"
with sync_playwright() as pw:
    b=pw.chromium.launch(); err=[]
    for vp in [(360,640),(390,844)]:
        page=b.new_context(viewport={"width":vp[0],"height":vp[1]},has_touch=True).new_page()
        page.on("pageerror",lambda e:err.append(str(e)))
        page.goto("file://"+W+"/index.html"); page.fill("#gameEnd",page.evaluate("m=>{const d=new Date(Math.round(Date.now()/60000)*60000+Math.min(m,119)*60000);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}",int("20"))); page.click("#btnStart")
        vis=lambda s: page.locator(s).count() and page.locator(s).first.is_visible()
        # ráfaga doble toque en handoff
        page.dblclick("#btnHandoff")
        # Atrás en partida
        page.go_back(); page.wait_for_timeout(200)
        print(vp,"back overlay visible:",vis("#backOverlay"))
        page.click("#btnBackStay"); print(" tras seguir:",vis("#backOverlay"), "game", vis("#game"))
        # avanzar hasta prepPanel
        for i in range(200):
            if vis("#prepPanel"): break
            if vis("#overlay"):
                bt=page.locator("#rollActions button")
                if bt.count(): bt.first.click()
                else: page.wait_for_timeout(200)
            elif vis("#handoff"): page.click("#btnHandoff")
            elif vis("#actionOverlay"): page.click("#btnActionChoose")
            elif vis("#privatePanel"):
                if vis("[data-pact]"): page.locator("[data-pact]").first.click()
                elif vis("#offerNo"): page.click("#offerNo")
                elif vis("#handNo"): page.click("#handNo")
                else:
                    ch=page.locator("#actionChoices button"); ch.first.click()
            else: page.wait_for_timeout(150)
        print(" prepPanel",vis("#prepPanel"))
        if vis("#prepPanel"):
            for k in range(page.locator("#prepCards button").count()):
                page.locator("#prepCards button").nth(k).click()
                t=page.locator("#prepTarget"); 
                for sel in ["#btnPrepSave","#btnPrepSkip"]:
                    bb=page.locator(sel).bounding_box(); print("  tipo",k,sel,"visible",vis(sel),"y+h",bb and round(bb["y"]+bb["height"]),"h",bb and round(bb["height"]), "target vis",vis("#prepTarget"), "opts",t.locator("option").count())
            page.reload(); page.wait_for_timeout(300); print(" tras recarga: continuar visible",vis("#btnContinue"))
            page.click("#btnContinue"); page.wait_for_timeout(300); print(" continuar -> handoff",vis("#handoff"),"errores",err)
    b.close()
