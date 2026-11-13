import re
W = "/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/"
rules = [
 (r"gana (\+?\d+) (de )?corrupci[oó]n", "se mancha de oscuridad"),
 (r"ganas (\+?\d+) (de )?corrupci[oó]n", "te manchas de oscuridad"),
 (r"[−-]\s?\d+ (de )?corrupci[oó]n", "la oscuridad se aleja un poco"),
 (r"\+\s?\d+ (de )?corrupci[oó]n", "la oscuridad te marca"),
]
for f in ["engine.js","data.js","index.html","ui.js"]:
    s = open(W+f, encoding="utf-8").read()
    for a,b in rules:
        s = re.sub(a, b, s)
    open(W+f, "w", encoding="utf-8").write(s)
