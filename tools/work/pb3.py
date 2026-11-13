p="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/styles.css"
s=open(p).read()
n=s.count("infinite"); print("infinite antes",n)
for a,b in [("animation:pulse 1.6s ease-in-out infinite}\n@keyframes pulse","animation:pulse 1.6s ease-in-out 5}\n@keyframes pulse"),
 ("animation:glowflick 4.5s ease-in-out infinite","animation:glowflick 4.5s ease-in-out 6"),
 ("animation:emberup 4.2s linear infinite","animation:emberup 4.2s linear 6"),
 ("animation:pulse 1.1s ease-in-out infinite","animation:pulse 1.1s ease-in-out 6"),
 ("background:#34202a;animation:pulse 1.6s ease-in-out infinite","background:#34202a;animation:pulse 1.6s ease-in-out 6"),
 (".tile.isnew .medal{animation:glowpulse 2s ease-in-out infinite","\n.tile.isnew .medal{animation:glowpulse 2s ease-in-out 4"),
 ("animation:pulse 1.2s ease-in-out infinite","animation:pulse 1.2s ease-in-out 6"),
 ("animation:glowpulse 3s ease-in-out infinite","animation:glowpulse 3s ease-in-out 4")]:
    if s.count(a)!=1: print("NO 1:",a,s.count(a)); continue
    s=s.replace(a,b)
open(p,"w").write(s); print("infinite despues",s.count("infinite"))
