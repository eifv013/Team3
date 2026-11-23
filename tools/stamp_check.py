#!/usr/bin/env python3
"""
도장 검사(0.8.2): "검거!" 도장이 검거하지 않았을 때 뜨면 안 된다.
  예전 버그: 판을 다시 그릴 때 도장 칸을 떼었다 붙이면 지난 "검거!" 애니메이션이 다시 재생됐다
  → 틀렸을 때 · 새 판이 시작될 때 "검거!"가 또 보였다. 두 번이나 나와서 따로 검사를 둔다.

  모드마다(몽타주 · 라인업 · 한 패): 맞히기 → 틀리기 → 틀리기를 하면서 50ms 마다 도장을 살핀다.
    · 틀린 뒤 1초 동안 "검거"가 보이면(go + 글자) 실패
    · 맞힌 도장이 끝난 뒤(1초 지나서) 다시 "검거"가 보이면 실패
"""
import json, subprocess, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
KEY = 'guar.suspects3.idle.v1'
JS = "const I=require('./src/idle.js');const s=I.newSave(Date.now());s.tutorialDone=true;s.runs=3;s.diff={k:'normal',set:true};process.stdout.write(I.serialize(s))"

WATCH = """() => { window._sv = []; const s = document.getElementById('stamp');
  setInterval(() => { const vis = s.classList.contains('go') && /검거/.test(s.textContent) && parseFloat(getComputedStyle(s).opacity) > 0.15;
    window._sv.push([performance.now(), vis]); }, 30); }"""

def seen(pg, t0, t1):
    return pg.evaluate(f"() => window._sv.some(([t, v]) => v && t >= {t0} && t <= {t1})")

def now(pg):
    return pg.evaluate("performance.now()")

def main():
    save = subprocess.run(['node', '-e', JS], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    problems = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={'width': 390, 'height': 844})
        ctx.add_init_script(f"localStorage.setItem('{KEY}', {json.dumps(save)});")
        pg = ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto((ROOT / 'dist' / 'index.html').as_uri())
        pg.wait_for_timeout(4000)
        if pg.locator('#info-sheet').is_visible():
            pg.click('#info-x')
        pg.evaluate(WATCH)

        def right_wrong(name, start, right_sel, wrong_sel):
            pg.evaluate("() => SuspectsUI.goHome()"); pg.wait_for_timeout(300)
            pg.evaluate(start); pg.wait_for_timeout(1800)
            # 출동 도장이 지나간 뒤부터 본다
            t = now(pg)
            if seen(pg, t - 1500, t):
                problems.append(name + ': 시작하자마자 "검거!" 도장이 보임')
            # 맞히기
            sel = pg.evaluate(right_sel)
            pg.locator(sel).first.click(force=True); pg.wait_for_timeout(1600)
            t1 = now(pg)
            # 맞힌 도장이 끝난 뒤 새 판에서 다시 뜨면 안 된다
            pg.wait_for_timeout(600)
            if seen(pg, t1, now(pg)):
                problems.append(name + ': 맞힌 다음 새 판에서 "검거!"가 다시 뜸')
            for k in range(2):
                sel = pg.evaluate(wrong_sel)
                if not sel:
                    problems.append(name + ': 틀린 자리를 못 찾음'); break
                t2 = now(pg)
                pg.locator(sel).first.click(force=True); pg.wait_for_timeout(1300)
                if seen(pg, t2, now(pg)):
                    problems.append(name + ': 틀렸는데 "검거!"가 뜸(' + str(k + 1) + '번째)')

        # 몽타주(특별 출동)
        right_wrong('몽타주', "() => SuspectsUI.startRun({ duration: 300, freeHints: 0, mode: 'montage' })",
                    "() => { const g = SuspectsUI._peek(); return '#board .card[data-i=\"' + g.q.cards.indexOf(g.q.ans) + '\"]'; }",
                    "() => { const g = SuspectsUI._peek(); const i = g.q.cards.findIndex((c, k) => c !== g.q.ans && g.q.out.indexOf(k) < 0); return i < 0 ? '' : '#board .card[data-i=\"' + i + '\"]'; }")
        # 라인업(사건 3)
        right_wrong('라인업', "() => SuspectsUI.startRun({ duration: 300, freeHints: 0, mode: 'lineup', missPenalty: 5, lineupHitBonus: 0, preOut: 0 })",
                    "() => '#board .card[data-i=\"' + SuspectsUI._peek().q.ans + '\"]'",
                    "() => { const g = SuspectsUI._peek(); const i = g.q.line.findIndex((c, k) => k !== g.q.ans && g.q.out.indexOf(k) < 0); return i < 0 ? '' : '#board .card[data-i=\"' + i + '\"]'; }")
        pg.evaluate("() => SuspectsUI.goHome()")
        if errs:
            problems.append('페이지 오류: ' + errs[0])
        b.close()
    if problems:
        print('도장 검사: 실패')
        for x in problems:
            print('  - ' + x)
        sys.exit(1)
    print('도장 검사: 통과')

if __name__ == '__main__':
    main()
