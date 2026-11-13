from playwright.sync_api import sync_playwright
W="file:///tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/index.html"
with sync_playwright() as pw:
    b=pw.chromium.launch(); page=b.new_context(viewport={"width":390,"height":844}).new_page()
    errs=[]; page.on("pageerror",lambda e:errs.append(str(e)))
    page.goto(W); page.fill("#gameMinutes","20"); page.click("#btnStart")
    page.evaluate("()=>{const s=UMBRAL.getState(); s.players.forEach(p=>{p.corr=30;p.wasHurt=true;p.did={explorar:3,investigar:3}});}")
    page.click("#btnHandoff")
    t=page.locator("#actionChoices button.ghost")
    print("toggle count",t.count(), t.first.inner_text())
    try:
        t.first.click(timeout=3000); print("click ok")
    except Exception as e: print("FAIL",str(e)[:400])
    page.screenshot(path="/tmp/tog.png")
    print(page.locator("#actionChoices .tag").all_inner_texts(), errs)
