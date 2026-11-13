import sys
from playwright.sync_api import sync_playwright
BASE="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/"
errors=[]
with sync_playwright() as pw:
    b=pw.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"]); ctx=b.new_context(viewport={"width":390,"height":844}); page=ctx.new_page()
    page.on("pageerror",lambda e:errors.append("PAGEERR "+str(e)))
    page.add_init_script("window.__v=[];navigator.vibrate=function(p){window.__v.push({p:p,vis:(document.getElementById('handoff')&&!document.getElementById('handoff').classList.contains('hidden'))});return true;};")
    page.goto("file://"+BASE+"apk/assets/www/index.html")
    print("sound label:",page.inner_text("#btnSoundMenu"),"| vib:",page.inner_text("#btnVibMenu"))
    page.click("#btnSoundMenu"); page.wait_for_timeout(500)
    print("after click:",page.inner_text("#btnSoundMenu"),"ctx:",page.evaluate("localStorage.getItem('umbral_snd')"))
    page.click("#btnVibMenu"); print("vib2:",page.inner_text("#btnVibMenu")); page.click("#btnVibMenu"); print("vib3:",page.inner_text("#btnVibMenu")); page.click("#btnVibMenu"); print("vib4:",page.inner_text("#btnVibMenu"))
    page.screenshot(path=BASE+"shots/v120_fxrow.png",clip={"x":0,"y":380,"width":390,"height":464}) if False else None
    page.evaluate("window.__v.length=0")
    page.fill("#gameEnd",page.evaluate("m=>{const d=new Date(Math.round(Date.now()/60000)*60000+Math.min(m,119)*60000);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}",int("20"))); page.click("#btnStart"); page.wait_for_timeout(800)
    print("vibr tras empezar (handoff visible):",page.evaluate("JSON.stringify(window.__v)"))
    page.click("#btnHandoff"); page.wait_for_timeout(500)
    print("vibr tras 'Soy X':",page.evaluate("JSON.stringify(window.__v)"))
    page.click("#btnHelp"); page.wait_for_timeout(300); page.locator("#btnSoundHelp").scroll_into_view_if_needed(); page.screenshot(path=BASE+"shots/v120_help.png")
    print("help labels:",page.inner_text("#btnSoundHelp"),page.inner_text("#btnVibHelp"))
    page.click("#btnSoundHelp"); print("off:",page.inner_text("#btnSoundHelp"))
    print("errors:",errors)
