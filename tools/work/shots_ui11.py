import sys, time
from playwright.sync_api import sync_playwright
BASE="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/"
URL="file://"+BASE+"apk/assets/www/index.html"
VW=int(sys.argv[1]) if len(sys.argv)>1 else 390; VH=int(sys.argv[2]) if len(sys.argv)>2 else 844
OUT=BASE+"shots11_%dx%d/"%(VW,VH) if (VW,VH)!=(390,844) else BASE+"shots11/"; import os; os.makedirs(OUT,exist_ok=True)
errors=[]
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=b.new_context(viewport={"width":VW,"height":VH},device_scale_factor=1); page=ctx.new_page()
    page.on("pageerror",lambda e:errors.append("PAGEERR "+str(e))); page.on("console",lambda m:errors.append("CONSOLE "+m.text) if m.type=="error" else None)
    def snap(n,scroll=None,sel="main>section:not(.hidden)"):
        page.wait_for_timeout(650)
        if scroll is not None: page.evaluate("(a)=>{const e=document.querySelector(a[0]);if(e)e.scrollTop=a[1]}",[sel,scroll]); page.wait_for_timeout(150)
        page.screenshot(path=OUT+n+".png")
    def vis(s): return page.locator(s).count()>0 and page.locator(s).first.is_visible()
    def clk(s,**k): page.locator(s).first.click(timeout=4000,**k); page.wait_for_timeout(120)
    page.goto(URL)
    snap("01_start"); snap("01b_start",420); snap("01c_start",900)
    clk("#btnCredits"); snap("02_credits"); clk("#btnCreditsClose")
    clk("#btnHelp"); snap("03_help"); snap("03b_help",700,".sheet"); clk("#btnCloseHelp")
    page.select_option("#playerCount","4")
    for i,n in enumerate(["Ana","Luis","Marta","Pablo"]): page.fill("#name%d"%i,n)
    page.fill("#gameMinutes","30")
    snap("04_setup",1200)
    clk("#btnStart"); snap("05_handoff_start")
    # estado forzado para enseñar de todo
    page.evaluate("""()=>{const s=UMBRAL.getState(); const p=s.players[s.turn];
      p.items=[{id:'vendas'},{id:'daga'},{id:'grimorio'},{id:'amuleto'},{id:'mapa'},{id:'frasco'}];
      p.hp=Math.max(1,UMBRAL.maxHp(p)-6); p.zones=Object.assign({},p.zones,{brazos:4,torso:2});
      p.status=[{id:'sangrado',left:2},{id:'veneno',left:1}]; p.corr=45; p.focus=1; p.stats.sombra=4; p.virtue=62;
      p.clues=[{text:'Alguien en la sala miente sobre dónde estaba.',strength:2,about:1}]; }""")
    clk("#btnHandoff"); snap("06_private_top")
    snap("06b_private",330); snap("06c_private",700); snap("06d_private",1100)
    page.evaluate("()=>{document.getElementById('playerInteractions').open=true;document.querySelectorAll('details.items').forEach(d=>d.open=true)}")
    snap("07_ficha",430); snap("07b_ficha",900); snap("07c_ficha",1400)
    page.evaluate("()=>{document.getElementById('playerInteractions').open=false}")
    clk("#btnSecret"); snap("08_secret"); clk("#btnSecretClose")
    # abrir más acciones
    page.evaluate("()=>{const e=document.querySelector('main>section:not(.hidden)'); e.scrollTop=0}")
    mb=page.locator("#actionChoices button.ghost.smallbtn").first
    if mb.count(): mb.scroll_into_view_if_needed(); mb.click(); page.wait_for_timeout(200)
    snap("09_more",1500)
    # hoja de acción
    t=page.locator("#actionChoices .tile").first; t.scroll_into_view_if_needed(); t.click(); snap("10_actionsheet")
    clk("#btnActionCancel")
    # estudiar grimorio
    page.evaluate("()=>{document.getElementById('playerInteractions').open=true;document.querySelectorAll('details.items').forEach(d=>d.open=true)}")
    items=page.locator("[data-item]"); n=items.count()
    for i in range(n):
        pass
    gb=page.locator("#sheetBody .itemrow:has-text('Grimorio') [data-item]")
    if gb.count():
        gb.first.scroll_into_view_if_needed(); gb.first.click(); snap("11_iteminfo"); clk("#btnActionChoose"); snap("12_study",0)
        page.evaluate("()=>{const e=document.querySelector('main>section:not(.hidden)'); e.scrollTop=0}")
        sc=page.locator("#actionChoices button.choice").first
        sc.scroll_into_view_if_needed(); snap("12b_study",None)
        sc.click(); page.wait_for_timeout(200); snap("13_shape")
        page.locator("#actionChoices button.choice").first.click(); page.wait_for_timeout(200)
    page.evaluate("()=>{document.getElementById('playerInteractions').open=true;document.querySelectorAll('details.items').forEach(d=>d.open=true)}")
    snap("14_spells",900)
    # elegir acción: conjurar
    cj=page.locator("#actionChoices .tile:has-text('Conjurar')")
    if cj.count():
        cj.first.scroll_into_view_if_needed(); cj.first.click(); clk("#btnActionChoose"); snap("15_spellpick")
        page.locator("#actionChoices button.choice").first.click(); page.wait_for_timeout(200)
        snap("16_spelltarget_or_mode")
        if page.locator("#actionChoices button.choice").count()>1:
            page.locator("#actionChoices button.choice").first.click(); page.wait_for_timeout(200); snap("17_mode")
    # cancelar y actuar: Investigar
    cn=page.locator("#actionChoices button:has-text('Cancelar')")
    if cn.count(): cn.first.click(); page.wait_for_timeout(150)
    inv=page.locator("#actionChoices .tile:has-text('Investigar')"); inv.first.scroll_into_view_if_needed(); inv.first.click(); clk("#btnActionChoose"); snap("18_target")
    page.locator("#actionChoices button.choice").first.click(); snap("19_roll"); page.wait_for_timeout(1300); snap("19b_roll_done")
    clk("#rollActions button")
    page.wait_for_timeout(300)
    if vis("#prepPanel"):
        snap("20_prep"); page.locator("#prepCards button").last.click(); snap("21_prep_pact")
        clk("#btnPrepSkip")
    snap("22_handoff_turn")
    # los demás pasan
    for _ in range(40):
        if vis("#councilPanel"): break
        if vis("#overlay"):
            b2=page.locator("#rollActions button")
            if b2.count(): b2.first.click()
            else: page.wait_for_timeout(200)
            continue
        if vis("#handoff"): clk("#btnHandoff"); continue
        if vis("#prepPanel"): clk("#btnPrepSkip"); continue
        if vis("#actionOverlay"): clk("#btnActionChoose"); continue
        if vis("#privatePanel"):
            for sel in ["#offerNo","#handNo"]:
                if vis(sel): clk(sel); break
            else:
                tl=page.locator("#actionChoices .tile:has-text('Descansar')")
                if tl.count(): tl.first.click(); continue
                tl=page.locator("#actionChoices .tile").first
                if tl.count(): tl.click(); continue
                ch=page.locator("#actionChoices button.choice")
                if ch.count(): ch.first.click(); continue
            continue
        page.wait_for_timeout(150)
    snap("30_council"); snap("30b_council",500)
    clk("#btnEndCouncil"); page.wait_for_timeout(1500)
    for _ in range(10):
        if vis("#overlay") and page.locator("#rollActions button").count():
            snap("31_council_result"); page.locator("#rollActions button").first.click(); page.wait_for_timeout(200)
        else: break
    snap("32_resolution"); snap("32b_resolution",500)
    clk("#btnNextRound"); snap("33_handoff_round")
    clk("#btnStatus"); snap("34_status"); clk("#btnCloseStatus")
    # desenlace forzado
    page.evaluate("()=>{UMBRAL.getState().playedMs=1e10}"); page.wait_for_timeout(1500)
    page.wait_for_timeout(300)
    for _ in range(3):
        if vis("#overlay"): break
    snap("40_ending"); snap("40b_ending",600); snap("40c_ending",1200); snap("40d_ending",1900); snap("40e_ending",2600)
    clk("#btnStoryView") if vis("#btnStoryView") else None
    snap("41_story")
    print("ERRORES:",errors or "ninguno")
