#!/usr/bin/env python3
"""art/noir/<id>.png(코드네임 초상, 정사각형) → src/noirpics.js(320×320 webp 를 base64 로 넣은 모듈).
새 그림을 받으면: art/noir/ 에 영어 id 이름으로 넣고 `python3 tools/noir_pics.py` 후 빌드."""
import base64, io, json, os, sys
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'art', 'noir')
out = {}; hot = {}
SNOW = {'koala_b', 'ragdoll_b'}; RAIN = {'wolf'}   # 날씨: 현장(_b)은 비, 눈 그림은 눈, 나머지는 실내
names = sorted(os.listdir(SRC))
for n in names:
    if not n.endswith('.png'):
        continue
    if n[:-4] + '_a.png' in names:   # 0.12.3 새 그림(사무실 _a, 현장 _b)이 있는 동물은 예전 한 장을 넣지 않는다
        continue
    im = Image.open(os.path.join(SRC, n)).convert('RGB')
    w, h = im.size; s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s)).resize((640, 640), Image.LANCZOS)   # 0.12.6 320 → 640: 휴대폰 화면(3배 밀도)에서 뭉개져 보였다
    b = io.BytesIO(); im.save(b, 'WEBP', quality=80, method=6)
    out[n[:-4]] = 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()
    # 0.13.0 연출(따로 파는 움직임)용: 그림에서 불빛 자리(w 등 · r 빨간 경광등 · b 파란 경광등)를 찾아 둔다
    k = n[:-4]; sm = im.resize((64, 64), Image.BOX); px = sm.load(); cand = {'w': [], 'r': [], 'b': []}
    for y in range(64):
        for x in range(64):
            r, g, bl = px[x, y]
            if r > 238 and g > 205 and 110 < bl < 225 and r - bl > 25: cand['w'].append((r + g, x, y))
            if r > 205 and g < 100 and bl < 170 and r - g > 120: cand['r'].append((r - g, x, y))
            if bl > 220 and r < 140 and bl - r > 100: cand['b'].append((bl - r, x, y))
    hs = []
    for t, cnt in (('w', 3), ('r', 2), ('b', 2)):
        got = []
        for sc, x, y in sorted(cand[t], reverse=True):
            if all((x - a) ** 2 + (y - c) ** 2 > 144 for a, c in got):
                got.append((x, y)); hs.append([round((x + .5) / 64, 3), round((y + .5) / 64, 3), t])
                if len(got) >= cnt: break
    hot[k] = {'w': 'snow' if k in SNOW else 'rain' if (k.endswith('_b') or k in RAIN) else 'in', 'h': hs}
js = """/*
 * Team3NoirPics(0.8.6) — 코드네임 초상 그림(그림 도구로 뽑은 그림, 320×320 webp).
 * 없는 종은 Team3NoirArt 가 예전 그림으로 그린다. 새 그림을 받으면 tools/noir_pics.py 로 다시 만든다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Team3NoirPics = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return """ + json.dumps(out) + """;
});
if (typeof window !== 'undefined') window.Team3NoirHot = """ + json.dumps(hot) + """;
"""
open(os.path.join(ROOT, 'src', 'noirpics.js'), 'w').write(js)
print('코드네임 그림', len(out), '종 ·', len(js) // 1024, 'KB')
