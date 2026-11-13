#!/usr/bin/env python3
"""Incrusta img/sprites.svg en index.html entre <!--SPRITES--> y <!--/SPRITES-->. Uso: python3 -I inline_sprites.py [www]"""
import re, sys, os
W = sys.argv[1] if len(sys.argv) > 1 else "/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www"
svg = open(os.path.join(W, "img/sprites.svg"), encoding="utf-8").read().strip()
svg = re.sub(r"^<\?xml[^>]*\?>\s*", "", svg)
svg = re.sub(r">\s*\n\s*<", "><", svg)  # compacta saltos entre symbols
block = '<!--SPRITES--><div id="umbral-sprites" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">' + svg + '</div><!--/SPRITES-->'
p = os.path.join(W, "index.html")
h = open(p, encoding="utf-8").read()
if "<!--SPRITES-->" not in h:
    raise SystemExit("faltan los marcadores <!--SPRITES--><!--/SPRITES--> en index.html")
h2 = re.sub(r"<!--SPRITES-->.*?<!--/SPRITES-->", lambda m: block, h, flags=re.S)
open(p, "w", encoding="utf-8").write(h2)
print("sprites incrustados:", len(svg), "bytes; index.html:", len(h2.encode("utf-8")))
