import cv2, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
# 0.13.11 킹(사자) 사무실 그림의 '특수수사팀' 글씨를 '수사3팀'으로 바꾼다. 원본은 art/noir_orig/lion_a.png
import os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC=os.path.join(ROOT,'art/noir_orig/lion_a.png')
im=cv2.imread(SRC); H,W=im.shape[:2]
lum=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY)
mask=np.zeros((H,W),np.uint8)
def m(box,cond):
    x0,y0,x1,y1=box; sub=lum[y0:y1,x0:x1]; mask[y0:y1,x0:x1][cond(sub)]=255
# 간판 큰 글씨 · 영문 줄, 머그컵 글씨, 명찰 글씨
m((842,90,1124,146),lambda s:s>85)
m((845,146,1124,200),lambda s:s>85)
m((1040,66,1124,100),lambda s:s>85)
m((292,1078,428,1122),lambda s:s>70)
mask=cv2.dilate(mask,np.ones((5,5),np.uint8),iterations=2)
clean=cv2.inpaint(im,mask,9,cv2.INPAINT_TELEA)
# 명찰: 흰 카드 바탕으로 칠해서 글씨를 지운다(번짐 없이)
x0,y0,x1,y1=754,979,823,1003
box=clean[y0:y1,x0:x1]; g=cv2.cvtColor(box,cv2.COLOR_BGR2GRAY)
col=np.median(box[g>170].reshape(-1,3),axis=0)
pad=clean[y0-3:y1+3,x0-3:x1+3].copy(); fill=np.zeros_like(pad); fill[:]=col
a=np.zeros(pad.shape[:2],np.float32); a[3:-3,3:-3]=1; a=cv2.GaussianBlur(a,(7,7),2.0)[...,None]
clean[y0-3:y1+3,x0-3:x1+3]=(pad*(1-a)+fill*a).astype(np.uint8)
img=Image.fromarray(cv2.cvtColor(clean,cv2.COLOR_BGR2RGB))
KR='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
import os
if not os.path.exists(KR):
    import subprocess; KR=subprocess.check_output(['fc-match','-f','%{file}','Noto Sans CJK KR:bold']).decode()
def put(text,center,size,color,blur,font=KR,idx=1,spacing=0):
    f=ImageFont.truetype(font,size,index=idx) if font.endswith('.ttc') else ImageFont.truetype(font,size)
    layer=Image.new('RGBA',img.size,(0,0,0,0)); d=ImageDraw.Draw(layer)
    if spacing:
        ws=[d.textbbox((0,0),c,font=f)[2] for c in text]; tw=sum(ws)+spacing*(len(text)-1)
        x=center[0]-tw/2; bb=d.textbbox((0,0),text,font=f); y=center[1]-(bb[1]+bb[3])/2
        for c,w in zip(text,ws): d.text((x,y),c,font=f,fill=color); x+=w+spacing
    else:
        bb=d.textbbox((0,0),text,font=f); d.text((center[0]-(bb[0]+bb[2])/2,center[1]-(bb[1]+bb[3])/2),text,font=f,fill=color)
    if blur: layer=layer.filter(ImageFilter.GaussianBlur(blur))
    img.alpha_composite(layer) if img.mode=='RGBA' else None
    return layer
img=img.convert('RGBA')
put('수사3팀',(983,107),72,(232,222,228,255),0.7,spacing=3)
put('INVESTIGATION TEAM 3',(984,173),23,(222,214,220,240),0.5)
put('수사3팀',(358,1100),31,(178,168,176,240),2.0,spacing=1)
put('수사3팀',(788,991),18,(36,30,34,255),0.5)
img.convert('RGB').save(os.path.join(ROOT,'art/noir/lion_a.png'))
