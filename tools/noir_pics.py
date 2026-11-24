#!/usr/bin/env python3
"""art/noir/<id>.png(코드네임 초상, 정사각형) → src/noirpics.js(320×320 webp 를 base64 로 넣은 모듈).
새 그림을 받으면: art/noir/ 에 영어 id 이름으로 넣고 `python3 tools/noir_pics.py` 후 빌드."""
import base64, io, json, os, sys
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'art', 'noir')
out = {}
names = sorted(os.listdir(SRC))
for n in names:
    if not n.endswith('.png'):
        continue
    if n[:-4] + '_a.png' in names:   # 0.12.3 새 그림(사무실 _a, 현장 _b)이 있는 동물은 예전 한 장을 넣지 않는다
        continue
    im = Image.open(os.path.join(SRC, n)).convert('RGB')
    w, h = im.size; s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s)).resize((320, 320), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'WEBP', quality=75, method=6)
    out[n[:-4]] = 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()
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
"""
open(os.path.join(ROOT, 'src', 'noirpics.js'), 'w').write(js)
print('코드네임 그림', len(out), '종 ·', len(js) // 1024, 'KB')
