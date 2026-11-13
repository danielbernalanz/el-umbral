import re,os,json,html
R='/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad'
ICONS=R+'/dl/icons'; OUT=R+'/apk/assets/www/img'; os.makedirs(OUT,exist_ok=True)
AUT={'lorc':('Lorc','http://lorcblog.blogspot.com','CC BY 3.0'),'delapouite':('Delapouite','http://delapouite.com','CC BY 3.0'),
'skoll':('Skoll',None,'CC BY 3.0'),'zeromancer':('Zeromancer',None,'CC0 1.0 (dominio público)'),'darkzaitzev':('DarkZaitzev','http://darkzaitzev.deviantart.com','CC BY 3.0'),
'sbed':('Sbed','http://opengameart.org/content/95-game-icons','CC BY 3.0'),'lucasms':('Lucas',None,'CC BY 3.0')}
m={}
for l in open(R+'/work/sp/map.txt'):
    l=l.strip()
    if l and not l[0]=='#':
        k,p=l.split(); m[k]=p
paths=sorted(set(m.values()))
sym=[];used={}
for p in paths:
    a,n=p.split('/')
    s=open(f'{ICONS}/{p}.svg').read()
    inner=re.search(r'<svg[^>]*>(.*)</svg>',s,re.S).group(1)
    inner=inner.replace('<path d="M0 0h512v512H0z"/>','')
    assert '#000' not in inner and 'M0 0h512v512' not in inner,p
    inner=inner.replace(' fill="#fff"','')
    inner=re.sub(r'\s+',' ',inner).strip()
    sid='ic-'+a+'--'+n if False else 'ic-'+n
    assert sid not in used,sid
    used[sid]=p
    sym.append(f'<symbol id="{sid}" viewBox="0 0 512 512">{inner}</symbol>')
svg='<svg xmlns="http://www.w3.org/2000/svg" style="display:none" fill="currentColor">\n'+'\n'.join(sym)+'\n</svg>\n'
open(OUT+'/sprites.svg','w').write(svg)
byp={p:'ic-'+p.split('/')[1] for p in paths}
mp={k:byp[p] for k,p in m.items()}
js='''/* El Umbral - sprites (game-icons.net, CC BY 3.0; ver img/CREDITOS.txt).
   Carga: injectIcons() descarga img/sprites.svg (fetch o XHR) y lo inserta inline en el DOM; icon() usa <use href="#id">.
   Si aun no se ha cargado, icon() devuelve igualmente el marcado: se pinta en cuanto el sprite entra en el DOM.
   Uso: icon("a_explorar","ic-lg") -> <svg class="ic ic-lg" ...><use href="#ic-treasure-map"/></svg>. Color: CSS (currentColor). */
(function (w) {
  "use strict";
  w.UMBRAL_ICONS = '''+json.dumps(mp,indent=1,sort_keys=True)+''';
  w.icon = function (key, cls) {
    var id = w.UMBRAL_ICONS[key];
    if (!id) return "";
    return '<svg class="ic' + (cls ? " " + cls : "") + '" viewBox="0 0 512 512" aria-hidden="true" focusable="false"><use href="#' + id + '"/></svg>';
  };
  w.iconsReady = false;
  function put(txt) {
    if (document.getElementById("umbral-sprites")) return;
    var d = document.createElement("div"); d.id = "umbral-sprites"; d.setAttribute("aria-hidden", "true");
    d.style.cssText = "position:absolute;width:0;height:0;overflow:hidden"; d.innerHTML = txt;
    (document.body || document.documentElement).insertBefore(d, (document.body || document.documentElement).firstChild);
    w.iconsReady = true;
    try { document.dispatchEvent(new Event("umbral-icons")); } catch (e) {}
  }
  w.injectIcons = function (url) {
    url = url || "img/sprites.svg";
    try {
      var x = new XMLHttpRequest(); x.open("GET", url, true);
      x.onload = function () { if (x.responseText) put(x.responseText); };
      x.send();
    } catch (e) {}
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { w.injectIcons(); });
  else w.injectIcons();
})(window);
'''
open(OUT+'/sprites-map.js','w').write(js)
# créditos
by={}
for p in paths:
    a,n=p.split('/'); by.setdefault(a,[]).append(n)
txt='ICONOS: game-icons.net\nLos iconos de El Umbral provienen de https://game-icons.net, usados con la licencia Creative Commons Attribution 3.0 (CC BY 3.0): https://creativecommons.org/licenses/by/3.0/\nLos iconos de Zeromancer son CC0 (dominio público). Se han recolorado (color por CSS) y recortado el fondo; por lo demás no se han modificado.\n\n'
for a,(nm,url,lic) in AUT.items():
    if a in by:
        txt+=f'Icons made by {nm}'+(f' ({url})' if url else '')+f' from https://game-icons.net — {lic}\n  ({len(by[a])}): '+', '.join(sorted(by[a]))+'\n\n'
open(OUT+'/CREDITOS.txt','w').write(txt)
# creditos.js pieza independiente
blocks=''
for a,(nm,url,lic) in AUT.items():
    if a in by:
        blocks+=f'<h3>{html.escape(nm)} <small>{html.escape(lic)}</small></h3><p>Icons made by {html.escape(nm)}'+(f' (<a href="{url}">{url}</a>)' if url else '')+f' from game-icons.net.</p><p class="cr-list">{html.escape(", ".join(sorted(by[a])))}</p>'
creditsjs='''/* El Umbral - pieza de creditos independiente (NO esta enganchada a ninguna pantalla).
   Pensada para abrirse desde un boton pequeno del MENU PRINCIPAL. Uso:
     window.umbralCreditsHTML()  -> cadena HTML (titulo + atribuciones) para meter en un overlay;
     window.umbralShowCredits()  -> crea/abre un overlay propio (#creditsOverlay); clase .hidden/.show gestionada aqui.
   Estilos minimos incluidos (se inyectan una vez), usan variables CSS del juego si existen. */
(function (w) {
  "use strict";
  var BODY = '''+json.dumps(blocks,ensure_ascii=False)+''';
  w.umbralCreditsHTML = function () {
    return '<h2>Créditos</h2><p><b>El Umbral</b> usa iconos de <a href="https://game-icons.net">game-icons.net</a>, con licencia '
      + '<a href="https://creativecommons.org/licenses/by/3.0/">Creative Commons Attribution 3.0 (CC BY 3.0)</a>. '
      + 'Los iconos de Zeromancer son CC0. Se ha cambiado su color y se ha quitado el fondo; no hay otras modificaciones.</p>' + BODY;
  };
  w.umbralShowCredits = function () {
    var o = document.getElementById("creditsOverlay");
    if (!o) {
      var st = document.createElement("style");
      st.textContent = "#creditsOverlay{position:fixed;inset:0;z-index:99;background:rgba(0,0,0,.85);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:16px}"
        + "#creditsOverlay .cr-card{max-width:560px;width:100%;background:var(--panel,#1b1722);color:var(--ink,#e8e2d6);border-radius:12px;padding:16px;font-size:14px;line-height:1.4}"
        + "#creditsOverlay h3{margin:14px 0 2px;font-size:15px}#creditsOverlay small{opacity:.7;font-weight:normal}"
        + "#creditsOverlay .cr-list{opacity:.65;font-size:12px;margin:2px 0}#creditsOverlay a{color:inherit;text-decoration:underline;word-break:break-all}"
        + "#creditsOverlay button{margin-top:14px;width:100%;padding:12px;font-size:15px}#creditsOverlay.hidden{display:none}";
      document.head.appendChild(st);
      o = document.createElement("div"); o.id = "creditsOverlay";
      o.innerHTML = '<div class="cr-card">' + w.umbralCreditsHTML() + '<button type="button" id="btnCreditsClose">Cerrar</button></div>';
      document.body.appendChild(o);
      o.querySelector("#btnCreditsClose").onclick = function () { o.classList.add("hidden"); };
    }
    o.classList.remove("hidden");
  };
})(window);
'''
open(OUT+'/creditos.js','w').write(creditsjs)
print(len(m),'claves',len(paths),'iconos',os.path.getsize(OUT+'/sprites.svg'),{a:len(v) for a,v in by.items()})
