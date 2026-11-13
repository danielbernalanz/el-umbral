from playwright.sync_api import sync_playwright
B="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/"
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=b.new_context(viewport={"width":390,"height":844}); page=ctx.new_page()
    errs=[]; page.on("pageerror",lambda e:errs.append(str(e)))
    page.goto("file://"+B+"apk/assets/www/index.html")
    page.select_option("#playerCount","4")
    for i,n in enumerate(["Zoe","Kai","Lea","Noa"]): page.fill("#name%d"%i,n)
    page.fill("#gameEnd",page.evaluate("m=>{const d=new Date(Math.round(Date.now()/60000)*60000+Math.min(m,119)*60000);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}",int("25"))); page.click("#btnStart"); page.wait_for_timeout(300)
    page.reload(); page.wait_for_timeout(400)
    print("nombres:",[page.input_value("#name%d"%i) for i in range(4)],"count",page.input_value("#playerCount"),"min",page.input_value("#gameEnd"),errs)
    b.close()
