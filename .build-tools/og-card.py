from PIL import Image, ImageDraw, ImageFont
import math, random

INK=(10,10,10); GOLD=(201,168,76); GOLD_BRIGHT=(245,192,48); CREAM=(245,239,230)
W,H=1200,630
FD=r'D:\momentum-creation-system-v1\.build-tools\fonts'
BP=r'D:\TEAM-MAG\assets\GLPTHREEE_Bottle_FullLabel_Render_Silo.png'
LP=r'D:\momentum-creation-system-v1\assets\logos\logo_dark_hero.png'
OP=r'D:\momentum-creation-system-v1\apps\com\public\og\all-things-glp-three.png'

c=Image.new('RGB',(W,H),INK)
g=Image.new('RGBA',(W,H),(0,0,0,0))
gd=ImageDraw.Draw(g)
for i in range(40,0,-1):
    r=60+(40-i)*18
    a=int(2.2*(i/40))
    gd.ellipse([120-r,120-r,120+r,120+r],fill=(GOLD[0],GOLD[1],GOLD[2],a))
c=Image.alpha_composite(c.convert('RGBA'),g).convert('RGB')
d=ImageDraw.Draw(c,'RGBA')

random.seed(106)
nodes=[]
for _ in range(34):
    x=random.randint(40,W-40); y=random.randint(40,H-40)
    if (60<x<720 and 170<y<540) or (760<x<W-40 and 40<y<H-80):
        continue
    nodes.append((x,y))
for i,(x1,y1) in enumerate(nodes):
    os=sorted([(j,math.hypot(x2-x1,y2-y1)) for j,(x2,y2) in enumerate(nodes) if j!=i],key=lambda t:t[1])
    for j,_ in os[:2]:
        x2,y2=nodes[j]
        d.line([(x1,y1),(x2,y2)],fill=(GOLD[0],GOLD[1],GOLD[2],18),width=1)
for x,y in nodes:
    d.ellipse([x-2,y-2,x+2,y+2],fill=(GOLD[0],GOLD[1],GOLD[2],90))

d.rectangle([24,24,W-24,H-24],outline=(GOLD[0],GOLD[1],GOLD[2],60),width=1)

b=Image.open(BP).convert('RGBA')
th=510; ratio=th/b.height; tw=int(b.width*ratio)
b=b.resize((tw,th),Image.LANCZOS)
bx=W-80-tw; by=(H-th)//2
halo=Image.new('RGBA',(W,H),(0,0,0,0))
hd=ImageDraw.Draw(halo)
hcx=bx+tw//2; hcy=by+th//2
for i in range(60,0,-2):
    r=220+(60-i)*4; a=int(0.4*(i/60))
    hd.ellipse([hcx-r,hcy-r,hcx+r,hcy+r],fill=(GOLD[0],GOLD[1],GOLD[2],a))
rgba=c.convert('RGBA')
rgba=Image.alpha_composite(rgba,halo)
rgba.paste(b,(bx,by),b)
c=rgba.convert('RGB')
d=ImageDraw.Draw(c,'RGBA')

dm=ImageFont.truetype(FD+'\\DMSans.ttf',18)
bh=ImageFont.truetype(FD+'\\BebasNeue-Regular.ttf',156)
bm=ImageFont.truetype(FD+'\\BebasNeue-Regular.ttf',22)

d.text((80,165),'\u2014  THE PRODUCT  \u00b7  DR. DAN GUBLER',fill=GOLD,font=dm)
hx=76; l1y=210; l2y=340
d.text((hx+2,l1y+2),'ALL THINGS',fill=(0,0,0,180),font=bh)
d.text((hx,l1y),'ALL THINGS',fill=GOLD,font=bh)
d.text((hx+2,l2y+2),'GLP-THREE',fill=(0,0,0,180),font=bh)
d.text((hx,l2y),'GLP-THREE',fill=GOLD_BRIGHT,font=bh)
d.text((hx+4,l2y+158),'DR. DAN EXPLAINS THE SCIENCE.',fill=(CREAM[0],CREAM[1],CREAM[2],200),font=bm)

lg=Image.open(LP).convert('RGBA')
lth=52; ratio=lth/lg.height; ltw=int(lg.width*ratio)
lg=lg.resize((ltw,lth),Image.LANCZOS)
rgba=c.convert('RGBA')
rgba.paste(lg,(76,H-80),lg)
c=rgba.convert('RGB')

c.save(OP,'PNG',optimize=True)
print('OG card written',OP,W,'x',H)
