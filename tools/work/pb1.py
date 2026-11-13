p="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/engine.js"
s=open(p).read()
a='text: "Se oyeron palabras antiguas cerca de " + t.name + "." });'
b='text: res.success ? "Se oyeron palabras antiguas cerca de " + t.name + "." : "Se oyeron palabras antiguas entre las ruinas." });'
assert s.count(a)==1
open(p,"w").write(s.replace(a,b))
