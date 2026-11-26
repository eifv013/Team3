# 0.13.12 간판 글씨: 기울어진 간판을 펴서 원본 글자(수·사·팀, INVESTIGATION UNIT)를 옮겨 붙이고 숫자 3만 새로 쓴다.
# 입력: art/noir_orig/lion_a.png(원본), tools/noir_retext_lion.py 결과(머그컵·명찰). 경로는 작업 당시 그대로.
import cv2, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
ROOT='/home/claude/team3'
orig=cv2.imread(ROOT+'/art/noir_orig/lion_a.png'); cur=cv2.imread('/tmp/lk/lion_a_new.png')
X0,Y0,X1,Y1=780,0,1254,300; S=0.135; REF=70; PADY=80
crop=orig[Y0:Y1,X0:X1]
M=np.float32([[1,0,0],[S,1,-S*REF+PADY]])            # 기울어진 간판을 반듯하게 편다
Mi=cv2.invertAffineTransform(M)
w,h=X1-X0,Y1-Y0+PADY*2
flat=cv2.warpAffine(crop,M,(w,h),flags=cv2.INTER_CUBIC,borderMode=cv2.BORDER_REPLICATE)
L=cv2.cvtColor(flat,cv2.COLOR_BGR2GRAY).astype(int); B=flat[:,:,0].astype(int)
txt=(L>120)&(B>120)&(np.abs(flat[:,:,2].astype(int)-B)<70)   # 흰 분홍 글씨(금색 문양 제외)
band=txt[:, 60:345]
rows=band.sum(1); 
import sys
def runs(v,th=0,gap=2):
    out=[];s=None;g=0
    for i,c in enumerate(list(v>th)+[False]*(gap+1)):
        if c:
            if s is None:s=i
            g=0;e=i
        elif s is not None:
            g+=1
            if g>gap: out.append((s,e+1)); s=None
    return out
rr=runs(rows,2,3); print('rows',rr)
main=max(rr,key=lambda r:(r[1]-r[0])*(rows[r[0]:r[1]].sum()))
print('main',main)
for r in rr:
    cols=txt[r[0]:r[1],:].sum(0); print(r,runs(cols,0,3 if r==main else 2))
np.save('flatM.npy',M); cv2.imwrite('flat.png',flat)

# ---- 편 상태에서 고치기 ----
F=flat.copy().astype(np.float32)
R=flat[:,:,2].astype(int)
soft=np.clip((L-60)/120,0,1)*((np.abs(R-B)<70)&(B>90))
# 1) 글씨 지우기
er=np.zeros(L.shape,np.uint8); er[178:292,55:350][(soft[178:292,55:350]>0.12)]=255
er=cv2.dilate(er,np.ones((5,5),np.uint8),iterations=2)
clean=cv2.inpaint(flat,er,9,cv2.INPAINT_TELEA).astype(np.float32)
def paste(sx0,sx1,y0,y1,dx):
    a=soft[y0:y1,sx0:sx1][...,None]; p=F[y0:y1,sx0:sx1]
    d=clean[y0:y1,dx:dx+(sx1-sx0)]; clean[y0:y1,dx:dx+(sx1-sx0)]=d*(1-a)+p*a
SU=(172,223); SA=(225,281); TIM=(284,333); GAP=5; W3=33
tot=(SU[1]-SU[0])+(SA[1]-SA[0])+W3+(TIM[1]-TIM[0])+GAP*3; x=int(round(200-tot/2))
def vb(a,b):
    ys=np.where(txt[176:256,a:b].any(1))[0]; return 176+ys[0],176+ys[-1]
su_bot=vb(*SU)[1]; sa=vb(*SA); ti=vb(*TIM)
top=min(sa[0],ti[0]); bot=max(sa[1],ti[1]); print('sa',sa,'tim',ti,'su',vb(*SU))
paste(SU[0],SU[1],180,252,x); x+=SU[1]-SU[0]+GAP
paste(SA[0],SA[1],180,252,x); x+=SA[1]-SA[0]+GAP
x3=x; x+=W3+GAP
paste(TIM[0],TIM[1],180,252,x)
INV=(144,285); UNIT=(289,337); SP=7
tw=(INV[1]-INV[0])+(UNIT[1]-UNIT[0])+SP; sx=int(round(203-tw/2))
paste(INV[0],INV[1],252,290,sx); paste(UNIT[0],UNIT[1],252,290,sx+(INV[1]-INV[0])+SP)
# 2) 숫자 3: 원본 글씨 색 · 굵기 · 흐림을 맞춘다
img=Image.fromarray(cv2.cvtColor(np.clip(clean,0,255).astype(np.uint8),cv2.COLOR_BGR2RGB)).convert('RGBA')
f=None
for fs in range(40,90):
    ff=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc',fs,index=1); b0=ff.getbbox('3')
    if b0[3]-b0[1]>=round((bot-top+1)*0.86): f=ff; break
lay=Image.new('RGBA',img.size,(0,0,0,0)); d=ImageDraw.Draw(lay); bb=d.textbbox((0,0),'3',font=f)
d.text((x3+(W3-(bb[2]-bb[0]))/2-bb[0], (top+bot)/2-(bb[3]-bb[1])/2-bb[1]),'3',font=f,fill=(214,180,186,255))
img.alpha_composite(lay.filter(ImageFilter.GaussianBlur(1.0)))
editF=cv2.cvtColor(np.array(img.convert('RGB')),cv2.COLOR_RGB2BGR)
print('3 h',bb[3]-bb[1],'su_bot',su_bot)
# ---- 다시 기울이기: 바뀐 곳만 원본에 섞는다 ----
back=cv2.warpAffine(editF,Mi,(X1-X0,Y1-Y0),flags=cv2.INTER_CUBIC,borderMode=cv2.BORDER_REPLICATE)
diffF=(np.abs(editF.astype(int)-flat.astype(int)).sum(2)>6).astype(np.uint8)*255
diffF=cv2.dilate(diffF,np.ones((5,5),np.uint8),iterations=2)
dm=cv2.warpAffine(diffF,Mi,(X1-X0,Y1-Y0),flags=cv2.INTER_LINEAR)
a=cv2.GaussianBlur(dm.astype(np.float32)/255,(7,7),1.5)[...,None]
out=cur.copy(); reg=orig[Y0:Y1,X0:X1].astype(np.float32)
out[Y0:Y1,X0:X1]=(reg*(1-a)+back.astype(np.float32)*a).astype(np.uint8)
cv2.imwrite('/tmp/lk/lion_a_v3.png',out)
o=Image.open('/tmp/lk/lion_a_v3.png'); a0=Image.open(ROOT+'/art/noir_orig/lion_a.png')
c=Image.new('RGB',(948,260)); c.paste(a0.crop((780,0,1254,260)),(0,0)); c.paste(o.crop((780,0,1254,260)),(474,0)); c.resize((1422,390)).save('/tmp/lk/why3.png')
