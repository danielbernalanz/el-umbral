import sys
from PIL import Image
d=sys.argv[1]; out=sys.argv[2]; names=sys.argv[3:]
ims=[Image.open(d+n+".png") for n in names]
w=sum(i.width for i in ims)+10*(len(ims)-1); h=max(i.height for i in ims)
c=Image.new("RGB",(w,h),(40,40,40)); x=0
for i in ims: c.paste(i,(x,0)); x+=i.width+10
c.save(out)
