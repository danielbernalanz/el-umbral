import sys
W = "/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/"
def edit(f, pairs):
    p=W+f; s=open(p,encoding="utf-8").read()
    for a,b in pairs:
        if a not in s: sys.exit("FAIL %s :: %r"%(f,a[:80]))
        s=s.replace(a,b)
    open(p,"w",encoding="utf-8").write(s)
edit("engine.js",[
 (" (la oscuridad te marca)",""),
 ("el veneno te debilita.","el veneno te debilita y te oscurece."),
 ("La magia se vuelve contra ti: la oscuridad te marca y una herida.","La magia se vuelve contra ti y te hiere."),
 (". la oscuridad te marca.\" + woundTxt",". El poder deja su marca.\" + woundTxt"),
 ("recuperas una herida, la oscuridad te marca, -6 virtud","recuperas una herida y pierdes 6 de virtud; la oscuridad te marca"),
 ("y el alivio te cuesta la oscuridad te marca.","y el alivio deja su marca en ti."),
 ("El Umbral cobra su precio: la oscuridad te marca y una herida.","El Umbral cobra su precio y te hiere."),
])
edit("data.js",[
 ('desc: "la oscuridad te marca y +1 Sombra." }','desc: "Te mancha de oscuridad y da +1 Sombra." }'),
 ("Arrebatas un objeto. la oscuridad te marca y -4 virtud.","Arrebatas un objeto. Te mancha de oscuridad y -4 virtud."),
 ("Marcas a otro con magia. la oscuridad te marca, pero","Marcas a otro con magia. Te mancha de oscuridad, pero"),
 ("+1 objeto oscuro, la oscuridad te marca y 1 herida.","+1 objeto oscuro, mucha oscuridad y 1 herida."),
 ("El alivio te cuesta la oscuridad te marca.","El alivio te mancha un poco de oscuridad."),
 ("(la oscuridad te marca)",""),
 ("la oscuridad te marca al inicio de cada ronda (dos rondas).","Te mancha de oscuridad al inicio de cada ronda (dos rondas)."),
])
edit("index.html",[
 ("más premio o la oscuridad te marca y una herida.","más premio, o una herida y más oscuridad."),
 ("veneno (la oscuridad te marca por ronda)","veneno (te mancha de oscuridad cada ronda)"),
])
