#!/usr/bin/env python3
"""
시안 빌드: proto/case3/*.src.html 의 자리표시를 게임 진짜 코드로 채워 proto/case3-*.html 을 만든다.
  /*CORE*/    ← src/core.js (용의자 81장 · 특징 · 판 계산)
  /*CARDART*/ ← src/ui.js 의 "용의자 그림" 부분(var BG … cardInner 끝) — 게임과 똑같은 카드 그림
시안이 게임과 같은 그림 · 같은 규칙을 쓰게 해서, 시안에서 고른 것이 그대로 게임에 들어갈 수 있게 한다.
"""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
core = (ROOT / 'src/core.js').read_text(encoding='utf-8')
ui = (ROOT / 'src/ui.js').read_text(encoding='utf-8')
a = ui.index('  var BG = [')
b = ui.index('  // 버튼으로 쓰는 카드 한 장')
cardart = ui[a:b]
# cardInner 등은 바깥의 ALL 을 쓴다(ui.js 에서 바로 위에 있음) — 그림 부분 안에 이미 들어 있다
if 'function cardInner' not in cardart or 'function figure' not in cardart:
    sys.exit('ui.js 에서 카드 그림 부분을 못 찾았다')
out = []
for src in sorted((ROOT / 'proto/case3').glob('*.src.html')):
    s = src.read_text(encoding='utf-8')
    s = s.replace('/*CORE*/', core).replace('/*CARDART*/', cardart)
    dst = ROOT / 'proto' / ('case3-' + src.name.replace('.src.html', '.html'))
    dst.write_text(s, encoding='utf-8')
    out.append(dst.name)
print('시안 빌드:', ', '.join(out))
