#!/usr/bin/env python3
"""루프앤램프 스튜디오(Loop & Lamp Studio) 로고 세트를 만든다 — art/brand/ 에 SVG · PNG.
  mark   궤도 마크(금빛 구 + 진한 L + 고리)
  logo   가로형: 마크 + LOOP&LAMP(OO 가 ∞) + STUDIO
  icon   정사각 앱 아이콘(마크만)
  badge  둥근 도장: 둘레 글자 + 가운데 마크
글자는 블랙한산스를 윤곽선(path)으로 바꿔 넣는다(폰트가 없는 곳에서도 모양이 같게)."""
import math, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from textpath import textpath
OUT = pathlib.Path(__file__).resolve().parent.parent / 'art/brand'
W, Y, G, C = '#EEF1F6', '#FFD23F', '#8F98A8', '#7FD3FF'
DEF = ('<defs><radialGradient id="orb" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#FFF6D0"/><stop offset=".45" stop-color="#FFD23F"/><stop offset="1" stop-color="#D98A06"/></radialGradient>'
       '<radialGradient id="halo" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FFD23F" stop-opacity=".45"/><stop offset="1" stop-color="#FFD23F" stop-opacity="0"/></radialGradient></defs>')

def mark(cx=100, cy=100, s=1.0, halo=True, moon='#EEF1F6'):
    d, w = textpath('L', 48, 0, 0); x = 100 - w / 2 - 2; y = 106
    return ('<g transform="translate(%g %g) scale(%g) translate(-100 -100)">' % (cx, cy, s) +
            ('<circle cx="100" cy="100" r="92" fill="url(#halo)"/>' if halo else '') +
            '<path d="M28 118 A76 30 -20 0 1 168 70" fill="none" stroke="#4FA8D8" stroke-width="10" stroke-linecap="round" opacity=".55"/>'
            '<circle cx="100" cy="100" r="44" fill="url(#orb)"/>'
            '<path d="%s" fill="#B36F02" opacity=".5" transform="translate(%g %g)"/>' % (d, x + 2.5, y + 2.5) +
            '<path d="%s" fill="#2A1E04" transform="translate(%g %g)"/>' % (d, x, y) +
            '<path d="M168 70 A76 30 -20 0 1 28 118" fill="none" stroke="#7FD3FF" stroke-width="10" stroke-linecap="round"/>'
            '<circle cx="160" cy="118" r="9" fill="%s"/></g>' % moon)

def word(x, y, size=62, sub=True, light=False):
    ink = '#1B1F28' if light else W
    dl, wl = textpath('L', size, x, y); r = size * 0.333; x0 = x + wl + size * 0.09
    cxa = x0 + r + size * 0.07; cxb = cxa + 2 * r - size * 0.06; cy = y - size * 0.35; sw = size * 0.165
    s = '<path d="%s" fill="%s"/>' % (dl, ink)
    if not light: s += '<ellipse cx="%g" cy="%g" rx="%g" ry="%g" fill="url(#halo)"/>' % ((cxa + cxb) / 2, cy, size * 1.1, size * 0.7)
    oc = '#E8A80F' if light else Y
    s += ''.join('<circle cx="%g" cy="%g" r="%g" fill="none" stroke="%s" stroke-width="%g"/>' % (c, cy, r, oc, sw) for c in (cxa, cxb))
    px = cxb + r + size * 0.18; dp, wp = textpath('P', size, px, y); ax = px + wp + size * 0.09
    da, wa = textpath('&', size, ax, y); dm, wm = textpath('LAMP', size, ax + wa + size * 0.09, y)
    s += '<path d="%s" fill="%s"/><path d="%s" fill="%s"/><path d="%s" fill="%s"/>' % (dp, ink, da, oc, dm, ink)
    if sub:
        d4, _ = textpath('STUDIO', size * 0.28, x + 2, y + size * 0.55, spacing=size * 0.17)
        s += '<path d="%s" fill="%s"/>' % (d4, '#5A6272' if light else G)
    return s, ax + wa + size * 0.09 + wm - x

def svg(w, h, body, bg=None):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d">' % (w, h) + DEF +
            ('<rect width="%d" height="%d" fill="%s"/>' % (w, h, bg) if bg else '') + body + '</svg>')

def badge(cx=82, cy=80):
    """둘레 글자: 글자 폭만큼 각도를 나눠 고르게. 단어 사이는 금빛 점(폰트에 · 글자가 없어서 직접 그린다)"""
    R = 64; items = []
    for wd in ['LOOP', '&', 'LAMP', '•', 'STUDIO', '•']:
        if wd == '•': items.append(('dot', 7)); continue
        for ch in wd: items.append((ch, textpath(ch, 15, 0, 0)[1]))
        items.append(('gap', 5))
    tot = sum(w for _, w in items); ang = -90 - (items[0][1] / 2) / tot * 360; parts = ''
    for ch, cw in items:
        a = ang + (cw / 2) / tot * 360; px, py = cx + R * math.cos(math.radians(a)), cy + R * math.sin(math.radians(a))
        if ch == 'dot': parts += '<circle cx="%.1f" cy="%.1f" r="2.6" fill="%s"/>' % (px, py, Y)
        elif ch != 'gap':
            d, _ = textpath(ch, 15, 0, 0)
            parts += '<path d="%s" fill="%s" transform="translate(%.1f %.1f) rotate(%.1f) translate(%.1f 5)"/>' % (d, Y if ch == '&' else W, px, py, a + 90, -cw / 2)
        ang += cw / tot * 360
    return ('<circle cx="%d" cy="%d" r="78" fill="#1F2530" stroke="%s" stroke-width="3"/><circle cx="%d" cy="%d" r="50" fill="#12151C" stroke="%s" stroke-width="2"/>' % (cx, cy, Y, cx, cy, C)
            + parts + mark(cx, cy, 0.42, halo=False))

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    files = {}
    t, w = word(190, 98); files['loopandlamp_logo.svg'] = svg(int(190 + w + 20), 160, mark(90, 80, 0.78) + t)
    t, w = word(190, 98, light=True); files['loopandlamp_logo_light.svg'] = svg(int(190 + w + 20), 160, mark(90, 80, 0.78, halo=False, moon='#2A3550') + t, '#F7F4EC')
    files['loopandlamp_mark.svg'] = svg(200, 200, mark())
    files['loopandlamp_icon.svg'] = svg(200, 200, '<rect width="200" height="200" rx="44" fill="#151A26"/>' + mark(100, 100, 0.9))
    files['loopandlamp_badge.svg'] = svg(164, 160, badge())
    t, w = word(0, 62, size=50); files['loopandlamp_word.svg'] = svg(int(w + 6), 96, t)
    for k, v in files.items(): (OUT / k).write_text(v, encoding='utf-8')
    print('로고 세트:', ', '.join(files))

if __name__ == '__main__':
    main()
