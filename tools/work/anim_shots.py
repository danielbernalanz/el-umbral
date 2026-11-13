import sys
from playwright.sync_api import sync_playwright
from PIL import Image
BASE="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/"
URL="file://"+BASE+"apk/assets/www/index.html"
OUT=BASE+"shots_anim/"
FX=[("slash","danger",1,""),("slash","danger",0,""),("claws","danger",1,""),("impact","danger",1,""),("drip","dark",1,""),("close","dark",1,""),("glow","heal",1,""),("shield","guard",1,""),("shield","guard",0,""),("scan","lore",1,""),("flash","ember",1,""),("flash","dark",1,"vac"),("snatch","dark",1,""),("coin","ember",1,""),("seal","gold",1,""),("crack","gold",1,""),("focus","danger",1,"")]
JS="""([name,fam,ok,cls,T])=>{
 const ov=document.getElementById('overlay');ov.classList.remove('hidden');
 document.getElementById('rollTitle').textContent=name.toUpperCase()+' '+(ok?'ok':'ko');
 document.getElementById('rollStage').innerHTML='<div class="die good">5</div>';
 document.getElementById('rollOutcome').textContent='Texto del resultado de ejemplo.';
 const card=ov.querySelector('.rollcard');card.querySelectorAll('.fxl').forEach(e=>e.remove());
 const h={claws:'<i></i><i></i><i></i>',drip:'<i></i><i></i><i></i>',flash:'<i class="core"></i><i class="ring"></i>',crack:'<i class="a"></i><i class="b"></i>',snatch:'<i>'+window.icon('a_robar')+'</i>'}[name]||'<i></i>';
 const l=document.createElement('div');l.className='fxl fx-'+name+' f-'+fam+(ok?'':' ko')+(cls?' '+cls:'');l.innerHTML=h;card.appendChild(l);
 document.getAnimations().forEach(a=>{try{if(a.effect&&a.effect.target&&a.effect.target.closest&&a.effect.target.closest('.fxl')){a.pause();a.currentTime=T;}}catch(e){}});
}"""
with sync_playwright() as pw:
    b=pw.chromium.launch()
    for (w,h,tag) in [(360,740,"360"),(390,844,"390")]:
        ctx=b.new_context(viewport={"width":w,"height":h}); page=ctx.new_page(); errs=[]
        page.on("pageerror",lambda e:errs.append(str(e)))
        page.goto(URL); page.wait_for_timeout(400)
        page.evaluate("document.querySelectorAll('*').forEach(e=>{})")
        for T in (120,300):
            tiles=[]
            for i,(n,f,ok,c) in enumerate(FX):
                page.evaluate(JS,[n,f,ok,c,T]); page.wait_for_timeout(60)
                p=OUT+"t_%s_%d_%d.png"%(tag,T,i)
                page.locator("#overlay .rollcard").screenshot(path=p); tiles.append(p)
            ims=[Image.open(p) for p in tiles]; tw=max(i.width for i in ims); th=max(i.height for i in ims)
            cols=6; rows=(len(ims)+cols-1)//cols
            sheet=Image.new("RGB",(cols*tw,rows*th),(0,0,0))
            for k,im in enumerate(ims): sheet.paste(im,((k%cols)*tw,(k//cols)*th))
            sheet.save(OUT+"sheet_%s_%d.png"%(tag,T))
        print(tag,"errs",errs)
    b.close()
