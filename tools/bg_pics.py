#!/usr/bin/env python3
"""파트너 배경 그림(0.12.0): 받은 그림을 720×480 webp 로 줄여 assets/bg/ 에 두고 src/bgpics.js(Team3BgPics)를 만든다.
사용: python3 tools/bg_pics.py [id=원본경로 ...]   (원본 없이 부르면 assets/bg/*.webp 로 bgpics.js 만 다시 만든다)"""
import sys, os, base64, json, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BG = os.path.join(ROOT, 'assets', 'bg')
IDS = ['office', 'alley', 'harbor', 'room', 'neon', 'snow', 'roof', 'gold']
def main():
    for a in sys.argv[1:]:
        k, path = a.split('=', 1)
        if k not in IDS: sys.exit('모르는 배경: ' + k)
        from PIL import Image
        im = Image.open(path).convert('RGB')
        w, h = im.size; t = 3 / 2
        if w / h > t: nw = int(h * t); im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
        else: nh = int(w / t); im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
        im.resize((720, 480), Image.LANCZOS).save(os.path.join(BG, 'bg_%s.webp' % k), 'WEBP', quality=74, method=6)
    out = {}
    for k in IDS:
        f = os.path.join(BG, 'bg_%s.webp' % k)
        if not os.path.exists(f): sys.exit('배경 그림이 없다: ' + f)
        out[k] = 'data:image/webp;base64,' + base64.b64encode(open(f, 'rb').read()).decode()
    js = """/*
 * Team3BgPics(0.12.0) — 파트너 배경 그림(720×480 webp). tools/bg_pics.py 가 assets/bg/ 에서 만든다(손으로 고치지 않는다).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Team3BgPics = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return %s;
});
""" % json.dumps(out)
    open(os.path.join(ROOT, 'src', 'bgpics.js'), 'w', encoding='utf-8').write(js)
    print('bgpics.js', {k: len(v) // 1024 for k, v in out.items()}, 'KB 합계', sum(len(v) for v in out.values()) // 1024)
main()
