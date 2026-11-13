from playwright.sync_api import sync_playwright
BASE="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/"
errs=[]
with sync_playwright() as pw:
    b=pw.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"]); page=b.new_context().new_page()
    page.on("pageerror",lambda e:errs.append(str(e))); page.on("console",lambda m:errs.append(m.text) if m.type=="error" and "sprites" not in m.text and "ERR_FAILED" not in m.text else None)
    page.goto("file://"+BASE+"apk/assets/www/index.html")
    r=page.evaluate("""async()=>{const F=UmbralFX;const o=[];o.push(F.setSound(true));F.game(true);await new Promise(r=>setTimeout(r,400));
      F.cue('campana');F.cue('latido');F.cue('desenlace');await new Promise(r=>setTimeout(r,300));
      Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));await new Promise(r=>setTimeout(r,200));
      Object.defineProperty(document,'hidden',{value:false,configurable:true});document.dispatchEvent(new Event('visibilitychange'));await new Promise(r=>setTimeout(r,200));
      F.game(false);o.push(F.setSound(false));return o;}""")
    print(r, "errores:", errs)
