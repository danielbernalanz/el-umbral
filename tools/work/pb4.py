p="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/styles.css"
s=open(p).read()
a="@media(max-width:360px){\n"
assert s.count(a)==1
s=s.replace(a,a+"  header{padding-left:10px;padding-right:10px}\n  .brand{letter-spacing:.08em;font-size:14px;gap:6px;min-width:0}\n  .headright{gap:4px}\n  .headright .smallbtn{padding-left:9px;padding-right:9px}\n")
open(p,"w").write(s)
