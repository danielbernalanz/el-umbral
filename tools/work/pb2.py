p="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/engine.js"
s=open(p).read()
def rep(a,b):
    global s
    assert s.count(a)==1,a
    s=s.replace(a,b)
rep('p.items.push(mkItem(it)); return " Consigues " + itemName(it) + "."; }','p.items.push(mkItem(it)); glog("regalo", { a: p.id, x: "encuentro: " + itemName(it) }); return " Consigues " + itemName(it) + "."; }')
rep('const it = pick(D.DARK_ITEMS); p.items.push(mkItem(it)); eff = "Recibes " + itemName(it) + ".";','const it = pick(D.DARK_ITEMS); p.items.push(mkItem(it)); glog("regalo", { a: p.id, x: "oferta: " + itemName(it) }); eff = "Recibes " + itemName(it) + ".";')
open(p,"w").write(s)
