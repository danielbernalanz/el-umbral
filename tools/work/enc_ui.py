from playwright.sync_api import sync_playwright
B="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/"
with sync_playwright() as pw:
    b=pw.chromium.launch(); page=b.new_context(viewport={"width":390,"height":844}).new_page()
    errs=[]; page.on("pageerror",lambda e:errs.append(str(e)))
    page.goto("file://"+B+"apk/assets/www/index.html")
    for i,n in enumerate(["Ana","Luis","Marta"]): page.fill("#name%d"%i,n)
    page.fill("#gameEnd",page.evaluate("m=>{const d=new Date(Math.round(Date.now()/60000)*60000+Math.min(m,119)*60000);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}",int("20"))); page.click("#btnStart")
    for _ in range(6):
        if page.locator("#btnHandoff").is_visible(): page.click("#btnHandoff")
        page.wait_for_timeout(200)
    page.evaluate("()=>{Math.random=()=>0.3}")
    page.locator("#actionChoices button", has_text="Explorar").first.click()
    page.click("#btnActionChoose"); page.wait_for_timeout(2500)
    page.locator("#rollActions button").first.click(); page.wait_for_timeout(1500)
    page.screenshot(path=B+"shots/enc.png")
    print(errs, page.locator("#rollActions button").all_inner_texts())
    b.close()
