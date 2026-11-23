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



# ---------- 0.9.5 고급 궤도 · 도장 로고 ----------
DEF2 = ('<defs>'
  '<radialGradient id="p2" cx="36%" cy="30%" r="75%"><stop offset="0" stop-color="#FFF8DC"/><stop offset=".35" stop-color="#FFD84A"/><stop offset=".75" stop-color="#E89A0A"/><stop offset="1" stop-color="#9A5A02"/></radialGradient>'
  '<radialGradient id="p2s" cx="78%" cy="80%" r="70%"><stop offset="0" stop-color="#3A1E00" stop-opacity=".55"/><stop offset=".6" stop-color="#3A1E00" stop-opacity="0"/></radialGradient>'
  '<linearGradient id="r2" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#4FA8D8"/><stop offset=".5" stop-color="#E6F7FF"/><stop offset="1" stop-color="#7FD3FF"/></linearGradient>'
  '<radialGradient id="m2" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#9FB0C8"/></radialGradient>'
  '<radialGradient id="g2" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FFD23F" stop-opacity=".55"/><stop offset="1" stop-color="#FFD23F" stop-opacity="0"/></radialGradient>'
  '<clipPath id="pc2"><circle cx="100" cy="100" r="40"/></clipPath>'
  '</defs>')

def star(x, y, r, c='#FFF3C2'):
    return '<path d="M%g %g Q%g %g %g %g Q%g %g %g %g Q%g %g %g %g Q%g %g %g %gZ" fill="%s"/>' % (
        x, y - r, x, y, x + r, y, x, y, x, y + r, x, y, x - r, y, x, y, x, y - r, c)

def mark2(cx=100, cy=100, s=1.0):
    """행성(음영 · 띠 무늬) + 앞뒤로 나뉜 빛나는 고리 + 달 + 반짝이"""
    d, w = textpath('L', 44, 0, 0); x = 100 - w / 2 - 1; y = 104
    ring_back = '<path d="M30 112 A74 24 -18 0 1 170 74" fill="none" stroke="#2E6E93" stroke-width="7" stroke-linecap="round"/>'
    ring_front = ('<path d="M170 74 A74 24 -18 0 1 30 112" fill="none" stroke="#0E1A28" stroke-width="13" stroke-linecap="round" opacity=".6"/>'
                  '<path d="M170 74 A74 24 -18 0 1 30 112" fill="none" stroke="url(#r2)" stroke-width="8" stroke-linecap="round"/>'
                  )
    planet = ('<circle cx="100" cy="100" r="40" fill="url(#p2)"/>'
              '<g clip-path="url(#pc2)" opacity=".35"><path d="M56 86 Q100 76 144 88" stroke="#B86A00" stroke-width="5" fill="none"/>'
              '<path d="M56 118 Q100 110 144 120" stroke="#B86A00" stroke-width="4" fill="none"/></g>'
              '<circle cx="100" cy="100" r="40" fill="url(#p2s)"/>'
              '<ellipse cx="86" cy="80" rx="12" ry="7" fill="#FFFFFF" opacity=".45" transform="rotate(-25 86 80)"/>'
              '<path d="%s" fill="#7A4300" opacity=".6" transform="translate(%g %g)"/><path d="%s" fill="#2A1A04" transform="translate(%g %g)"/>' % (d, x + 2, y + 2, d, x, y))
    moon = '<circle cx="160" cy="112" r="9" fill="url(#m2)"/><circle cx="163" cy="115" r="2" fill="#8090A8" opacity=".6"/>'
    sparks = star(40, 58, 6) + star(156, 44, 4.5) + star(52, 146, 3.5, '#BFE8FF')
    return ('<g transform="translate(%g %g) scale(%g) translate(-100 -100)">' % (cx, cy, s) +
            '<circle cx="100" cy="100" r="70" fill="url(#g2)"/>' + ring_back + planet + ring_front + moon + sparks + '</g>')

def arc_text(cx, cy, R, parts, size, top=True, spacing=1.5):
    """윗호는 시계 방향으로, 아랫호는 반대로 — 둘 다 똑바로 읽히게. parts=[(글자, 색)]"""
    chars = [(ch, col, textpath(ch, size, 0, 0)[1] if ch != ' ' else size * 0.35) for wd, col in parts for ch in wd]
    total = sum(c[2] for c in chars) + spacing * (len(chars) - 1)
    span = total / R  # 라디안
    a = (-math.pi / 2 - span / 2) if top else (math.pi / 2 + span / 2)
    out = ''
    for ch, col, cw in chars:
        step = (cw / 2) / R
        a += step if top else -step
        px, py = cx + R * math.cos(a), cy + R * math.sin(a)
        if ch != ' ':
            d, _ = textpath(ch, size, 0, 0)
            rot = math.degrees(a) + (90 if top else -90)
            out += '<path d="%s" fill="%s" transform="translate(%.1f %.1f) rotate(%.1f) translate(%.1f %.1f)"/>' % (d, col, px, py, rot, -cw / 2, size * 0.36)
        st = (cw / 2 + spacing) / R
        a += st if top else -st
    return out

def ring_text(cx, cy, R, size=14):
    """도장 둘레: 위 LOOP & LAMP(흰 · & 금) · 아래 STUDIO(회색) · 양옆 금빛 점 — 가운데 글자와 같은 문구 · 같은 색"""
    out = arc_text(cx, cy, R, [('LOOP', W), (' ', W), ('&', Y), (' ', W), ('LAMP', W)], size, True, 2)
    out += arc_text(cx, cy, R, [('STUDIO', '#AEB6C4')], size, False, 5)
    for ang in (180, 0):
        out += '<circle cx="%.1f" cy="%.1f" r="2.6" fill="%s"/>' % (cx + R * math.cos(math.radians(ang)), cy + R * math.sin(math.radians(ang)), Y)
    return out

def badge2(cx=80, cy=80):
    return ('<circle cx="%d" cy="%d" r="78" fill="#1A1F2B"/>' % (cx, cy) +
            '<circle cx="%d" cy="%d" r="76" fill="none" stroke="%s" stroke-width="3"/>' % (cx, cy, Y) +
            '<circle cx="%d" cy="%d" r="71" fill="none" stroke="%s" stroke-width="1" opacity=".5"/>' % (cx, cy, Y) +
            '<circle cx="%d" cy="%d" r="50" fill="#0F131C" stroke="%s" stroke-width="2"/>' % (cx, cy, C) +
            ring_text(cx, cy, 61) + mark2(cx, cy, 0.5))

def main2():
    t, w = word(190, 92, sub=False)
    d4, w4 = textpath('STUDIO', 19, 0, 0, spacing=10); sx = 190 + (w - w4) / 2
    d4, _ = textpath('STUDIO', 19, sx, 128, spacing=10)
    lines = '<path d="M%g 121 H%g M%g 121 H%g" stroke="#4A5262" stroke-width="2"/>' % (190, sx - 14, sx + w4 + 14, 190 + w)
    body = badge2(84, 80) + t + lines + '<path d="%s" fill="%s"/>' % (d4, G)
    files = {
        'loopandlamp_logo.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d 160">' % int(190 + w + 20) + DEF + DEF2 + body + '</svg>',
        'loopandlamp_badge.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">' + DEF + DEF2 + badge2() + '</svg>',
        'loopandlamp_mark.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">' + DEF2 + mark2() + '</svg>',
        'loopandlamp_icon.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">' + DEF + DEF2 + '<rect width="200" height="200" rx="44" fill="#151A26"/>' + mark2(100, 100, 0.95) + '</svg>',
    }
    for k, v in files.items(): (OUT / k).write_text(v, encoding='utf-8')
    print('로고 세트(0.9.5):', ', '.join(files))

if __name__ == '__main__':
    main(); main2()
