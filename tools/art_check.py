#!/usr/bin/env python3
"""
동물 그림 검수(0.3.1) — 20종 × 4등급 × 의상 8가지(안 입음 포함)를 실제 브라우저로 그려 보고 자동으로 따진다.
publish.sh 가 올리기 전에 돌리고, 하나라도 걸리면 올리지 않는다.

검사
  A 보이는가   : 의상을 입힌 그림과 안 입힌 그림의 차이 픽셀이 MIN_VISIBLE 이상, 그리고
                 같은 의상 · 같은 등급의 다른 동물들 가운데값의 VISIBLE_RATIO 배 이상(혼자 작게 그려진 모자 잡기)
  B 눈을 가리나 : 모자 · 리본 · 마스크 · 등급 경찰모가 눈 자리(Team3PetArt.eyes)를 COVER_MAX 넘게 바꾸면 실패
                  (안경 · 선글라스는 눈에 쓰는 의상이라 B 를 보지 않는다)
  D 얼굴에 내려왔나: 모자 · 리본 · 등급 경찰모가 눈 위~입(얼굴 띠)에 FACE_MAX 넘게 그려지면 실패(이마에 붙은 경찰모 잡기)
  C 넘치는가   : 200×200 그림 칸 밖으로 OVERFLOW_MAX 픽셀 넘게 나간 것이 있으면 실패(도감 칸에서 잘린다)
결과
  tools/out/art_sheet_<등급>.png  — 사람이 한눈에 보는 검수판(줄 = 종류, 칸 = 의상)
  tools/out/art_report.txt        — 걸린 항목
사용: python3 tools/art_check.py   (실패하면 종료 코드 1)
"""
import json, os, subprocess, sys
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tools', 'out')
CELL, PAD = 260, 30            # 칸 크기, 그림(200) 둘레 여백 — 여백에 그려진 것 = 넘친 것
BG = (243, 233, 214)           # 칸 바탕(#F3E9D6)
MIN_VISIBLE = 700              # A: 의상 차이 픽셀 최소
VISIBLE_RATIO = 0.55           # A: 다른 동물 가운데값 대비 최소 비율
COVER_MAX = 0.12               # B: 눈 자리 중 바뀐 비율 상한
OVERFLOW_MAX = 18              # C: 그림 칸 밖으로 나간 거리(px) 상한
FACE_MAX = 0.03                # D: 얼굴 띠 중 모자 · 경찰모가 바꾼 비율 상한
HEADWEAR = {'beanie', 'bow', 'fedora', 'raincoat'}
OUTFITS = ['', 'glasses', 'mask', 'beanie', 'bow', 'sunglasses', 'fedora', 'raincoat']
EYE_WEAR = {'glasses', 'sunglasses'}
GRADES = ['c', 'r', 'h', 'l']


def svgs():
    """node 로 모든 그림 SVG 와 눈 자리를 만든다"""
    js = r"""
const A = require('./src/petart.js');
const G = ['c','r','h','l'], O = %s;
const out = { ids: A.ids, eyes: {}, svg: {} };
for (const id of A.ids) { out.eyes[id] = A.eyes(id); for (const g of G) for (const o of O) out.svg[id+'|'+g+'|'+o] = A.draw(id, { grade: g, outfit: o || undefined }); }
process.stdout.write(JSON.stringify(out));
""" % json.dumps(OUTFITS)
    r = subprocess.run(['node', '-e', js], cwd=ROOT, capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


def render(data):
    """등급마다 한 장: 줄 = 종류, 칸 = 의상. 칸마다 그림을 (PAD,PAD) 에 200×200 으로, 넘치는 것도 보이게"""
    ids, sheets = data['ids'], {}
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': CELL * len(OUTFITS), 'height': CELL * len(ids)}, device_scale_factor=1)
        for g in GRADES:
            cells = []
            for i, id_ in enumerate(ids):
                for j, o in enumerate(OUTFITS):
                    svg = data['svg'][id_ + '|' + g + '|' + o].replace('<svg ', '<svg width="200" height="200" style="overflow:visible;position:absolute;left:%dpx;top:%dpx" ' % (j * CELL + PAD, i * CELL + PAD), 1)
                    cells.append(svg)
            html = ('<html><body style="margin:0;background:rgb%s;position:relative;width:%dpx;height:%dpx">' % (str(BG), CELL * len(OUTFITS), CELL * len(ids))) + ''.join(cells) + '</body></html>'
            pg.set_content(html)
            pg.wait_for_timeout(150)
            path = os.path.join(OUT, '_raw_%s.png' % g)
            pg.screenshot(path=path, full_page=True)
            sheets[g] = np.asarray(Image.open(path).convert('RGB')).astype(np.int16)
            os.remove(path)
        b.close()
    return sheets


def cell(img, i, j):
    return img[i * CELL:(i + 1) * CELL, j * CELL:(j + 1) * CELL]


def changed(a, b):
    return np.abs(a - b).sum(axis=2) > 40


def check(data, sheets):
    ids, fails = data['ids'], []
    for g in GRADES:
        img = sheets[g]
        # A 기준: 의상마다 동물들 차이 픽셀의 가운데값
        area = {o: [] for o in OUTFITS[1:]}
        for i in range(len(ids)):
            for j, o in enumerate(OUTFITS[1:], 1):
                area[o].append(int(changed(cell(img, i, j), cell(img, i, 0)).sum()))
        med = {o: float(np.median(v)) for o, v in area.items()}
        for i, id_ in enumerate(ids):
            e = data['eyes'][id_]
            base = cell(img, i, 0)
            # 눈 자리 마스크(칸 좌표)
            yy, xx = np.mgrid[0:CELL, 0:CELL]
            eye = np.zeros((CELL, CELL), bool)
            for ex in e['x']:
                eye |= (xx - (ex + PAD)) ** 2 + (yy - (e['y'] + PAD)) ** 2 <= e['r'] ** 2
            # 얼굴 띠: 가로 40~160, 세로 눈 위 끝 ~ 입 (칸 좌표)
            face = (xx >= 40 + PAD) & (xx <= 160 + PAD) & (yy >= e['faceTop'] + PAD) & (yy <= e['mouth'] + PAD)
            # B · D(등급): 경찰모가 눈을 가리나, 얼굴에 내려왔나 — 일반(c)과 비교하되 배지 · 망토 · 후광은 얼굴 띠 밖이라 걸리지 않는다
            if g != 'c':
                c0 = cell(sheets['c'], i, 0)
                dg = changed(base, c0)
                if dg[eye].mean() > COVER_MAX:
                    fails.append('%s %s 등급 모자가 눈을 가림 (%.0f%%)' % (id_, g, dg[eye].mean() * 100))
                if dg[face & ~eye].mean() > FACE_MAX:
                    fails.append('%s %s 등급 모자가 얼굴에 내려옴 (%.0f%%)' % (id_, g, dg[face & ~eye].mean() * 100))
            for j, o in enumerate(OUTFITS):
                c = cell(img, i, j)
                # C: 넘침 — 바탕과 다른 픽셀이 그림 칸(PAD..PAD+200) 밖 OVERFLOW_MAX 너머에 있나
                ink = np.abs(c - np.array(BG)).sum(axis=2) > 30
                lim = PAD - OVERFLOW_MAX
                side = [n for n, v in (('위', ink[:lim]), ('아래', ink[CELL - lim:]), ('왼쪽', ink[:, :lim]), ('오른쪽', ink[:, CELL - lim:])) if v.any()]
                if side:
                    fails.append('%s %s %s 그림이 %s으로 %dpx 넘게 넘침' % (id_, g, o or '안 입음', '·'.join(side), OVERFLOW_MAX))
                if not o:
                    continue
                d = changed(c, base)
                # A: 보이는가
                # 크기는 경찰모가 없는 일반(c)에서만 잰다(희귀 이상은 모자를 쓰면 경찰모가 빠져 차이가 섞인다)
                if g == 'c' and d.sum() < max(MIN_VISIBLE, VISIBLE_RATIO * med[o]):
                    fails.append('%s %s %s 의상이 너무 작음 (%d px, 보통 %d px)' % (id_, g, o, d.sum(), med[o]))
                # B: 눈을 가리나
                if o not in EYE_WEAR:
                    cov = d[eye].mean()
                    if cov > COVER_MAX:
                        fails.append('%s %s %s 이(가) 눈을 가림 (%.0f%%)' % (id_, g, o, cov * 100))
                # D: 모자 · 리본이 얼굴에 내려왔나(등급 경찰모를 벗은 차이는 얼굴 띠 밖이라 상관없다)
                if o in HEADWEAR:
                    fd = d[face & ~eye].mean()
                    if fd > FACE_MAX:
                        fails.append('%s %s %s 이(가) 얼굴에 내려옴 (%.0f%%)' % (id_, g, o, fd * 100))
    return fails


def contact(data, sheets):
    """사람이 보는 검수판(등급마다 한 장, 절반 크기)"""
    for g in GRADES:
        im = Image.fromarray(sheets[g].clip(0, 255).astype('uint8'))
        im = im.resize((im.width // 2, im.height // 2))
        im.save(os.path.join(OUT, 'art_sheet_%s.png' % g))


def main():
    os.makedirs(OUT, exist_ok=True)
    data = svgs()
    sheets = render(data)
    fails = check(data, sheets)
    contact(data, sheets)
    with open(os.path.join(OUT, 'art_report.txt'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(fails) + ('\n' if fails else '통과\n'))
    n = len(data['ids']) * len(GRADES) * len(OUTFITS)
    if fails:
        print('그림 검수: %d개 걸림 (그림 %d장 중)' % (len(fails), n))
        for x in fails[:40]:
            print('  -', x)
        sys.exit(1)
    print('그림 검수: 통과 (그림 %d장)' % n)


if __name__ == '__main__':
    main()
