import sys
from playwright.sync_api import sync_playwright
BASE="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/"
URL="file://"+BASE+"apk/assets/www/index.html"
SH=BASE+"shots/"
errs=[]; res=[]
def chk(name,ok,info=""):
    res.append(ok); print(("OK   " if ok else "FALLO"),name,info)
def fresh(b,vw,vh,t):
    ctx=b.new_context(viewport={"width":vw,"height":vh},device_scale_factor=1)
    page=ctx.new_page()
    page.on("pageerror",lambda e:errs.append(str(e)))
    page.on("console",lambda m:errs.append(m.text) if m.type=="error" else None)
    page.clock.install(time=t)
    page.goto(URL); page.wait_for_timeout(300)
    return ctx,page
with sync_playwright() as pw:
    b=pw.chromium.launch()
    # (a) valida
    ctx,page=fresh(b,360,640,"2026-11-13T12:00:00")
    chk("defecto ahora+15",page.input_value("#gameEnd")=="12:15",page.input_value("#gameEnd"))
    info=page.inner_text("#endInfo"); chk("texto vivo",("Son las 12:00" in info and "unos 15 min" in info and "12:15" in info),info)
    page.screenshot(path=SH+"E1_create_360.png")
    page.fill("#gameEnd","12:25")
    chk("30->25 min",("unos 25 min" in page.inner_text("#endInfo")))
    page.click("#btnStart"); page.wait_for_timeout(300)
    st=page.evaluate("(()=>{const s=UMBRAL.getState();return [s.durationMin,s.endAt-Date.now(),s.endAt]})()")
    chk("(a) minutos motor=25 y endAt",st[0]==25 and abs(st[1]-25*60000)<2000,str(st))
    chk("pastilla fin",page.inner_text("#clockEnd")=="fin 12:25",page.inner_text("#clockEnd"))
    # (d) recarga conserva
    page.clock.fast_forward(5*60000); page.wait_for_timeout(100)
    page.screenshot(path=SH+"E2_clock_360.png")
    before=page.evaluate("UMBRAL.timeLeftMs()")
    page.reload(); page.wait_for_timeout(300)
    page.click("#btnContinue"); page.wait_for_timeout(600)
    st2=page.evaluate("(()=>{const s=UMBRAL.getState();return [s.endAt,UMBRAL.timeLeftMs()]})()")
    chk("(d) recarga conserva endAt y restante",st2[0]==st[2] and abs(st2[1]-before)<3000,str(st2)+" antes "+str(before))
    # (e) ocultar 60 s
    page.clock.fast_forward(60000); page.wait_for_timeout(100)
    left=page.evaluate("UMBRAL.timeLeftMs()")
    pill=page.inner_text("#clockPill")
    chk("(e) 60 s en segundo plano",abs(left-(before-60000))<4000,"left %d pill %s"%(left,pill))
    mm,ss=pill.split(":"); chk("(e) pastilla coincide",abs(int(mm)*60+int(ss)-left/1000)<3,pill)
    # reloj retrocede 10 min: conserva restante
    page.evaluate("(()=>{window.__l=UMBRAL.timeLeftMs()})()")
    ctx.close()
    # (b) pasada / lejana / corta
    ctx,page=fresh(b,390,844,"2026-11-13T12:00:00")
    for v,exp in [("11:30","ya pasó"),("14:30","más de 120"),("12:02","al menos 5"),("14:00","unos 120 min"),("12:05","unos 5 min")]:
        page.fill("#gameEnd",v); info=page.inner_text("#endInfo"); dis=page.evaluate("document.getElementById('btnStart').disabled")
        valid=exp.startswith("unos")
        chk("(b) %s"%v,(exp in info) and (dis!=valid),info+" dis=%s"%dis)
    page.fill("#gameEnd","11:30"); page.evaluate("document.getElementById('btnStart').disabled=false"); page.click("#btnStart"); page.wait_for_timeout(200)
    chk("(b) no empieza",page.evaluate("!UMBRAL.getState()||UMBRAL.getState().endAt===undefined"))
    page.fill("#gameEnd","14:30"); page.screenshot(path=SH+"E3_create_err_390.png")
    page.fill("#gameEnd","12:30"); page.screenshot(path=SH+"E4_create_390.png")
    ctx.close()
    # (c) medianoche
    ctx,page=fresh(b,390,844,"2026-11-13T23:50:00")
    page.fill("#gameEnd","00:20"); info=page.inner_text("#endInfo"); chk("(c) 23:50->00:20 = 30",("unos 30 min" in info),info)
    page.click("#btnStart"); page.wait_for_timeout(300)
    st=page.evaluate("(()=>{const s=UMBRAL.getState();return [s.durationMin,s.endAt-Date.now(),new Date(s.endAt).getDate()]})()")
    chk("(c) motor 30 min, día siguiente",st[0]==30 and st[2]==14 and abs(st[1]-1800000)<2000,str(st))
    chk("(c) pastilla fin 00:20",page.inner_text("#clockEnd")=="fin 00:20")
    page.screenshot(path=SH+"E5_clock_390.png")
    # reloj retrocede 20 min: se conserva el restante
    l0=page.evaluate("UMBRAL.timeLeftMs()")
    page.clock.set_system_time("2026-11-13T23:30:00"); page.wait_for_timeout(100); page.clock.fast_forward(1000); page.wait_for_timeout(100)
    l1=page.evaluate("UMBRAL.timeLeftMs()")
    chk("salto atrás: restante conservado",abs(l1-l0)<6000,"%d -> %d"%(l0,l1))
    # salto adelante absurdo: no rompe
    page.clock.set_system_time("2026-11-14T10:00:00"); page.clock.fast_forward(1000); page.wait_for_timeout(200)
    chk("salto adelante: sigue viva",page.evaluate("UMBRAL.timeLeftMs()")<0 and page.evaluate("UMBRAL.getState().phase!=='ending'"),page.inner_text("#clockPill"))
    ctx.close()
    b.close()
print("ERRORES JS:",errs); print("RESULTADO",sum(res),"/",len(res))
