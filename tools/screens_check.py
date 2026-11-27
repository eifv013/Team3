#!/usr/bin/env python3
"""
수익 · 수집 화면 시험(0.4.0) — 동물 · 매점 · 패스 · 광고 자리 흐름을 실제로 눌러 본다. publish.sh 가 올리기 전에 돌린다.

보는 것
  사무실 파트너 칸(쓰다듬기 → 친밀도 · 말풍선) · 배지 칸 → 매점
  매점: 광고 자리(시험판 3초) → 뽑기권 +1, 하루 한도 줄어듦 · 결제 상품은 정식 출시 전까지 배지로 산다(한정 늑대 사기)
  시즌 패스 탭: 단계 · 받기 단추
  동물 창: 픽업 띠 · 오늘 무료 뽑기 → 뽑기 연출 → 닫힘 · 도감 세트 · 전설 선택권 · 의상 사기/입히기
  출동 결과: 동물 효과 줄 · 시즌 패스 XP · 2배 받기(광고) → 수사비가 실제로 늘어남
  모든 창에서 가로로 넘치는 것(가로 스크롤)이 없는지, 페이지 오류가 없는지
사용: python3 tools/screens_check.py   (실패하면 종료 코드 1, 캡처는 /tmp/shots/s_*.png)
"""
import json, os, pathlib, subprocess, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'dist/index.html').as_uri()
SHOT = '/tmp/shots/'
KEY = 'guar.suspects3.idle.v1'
problems = []


def seed():
    js = """const I=require('./src/idle.js');const s=I.newSave(Date.now());s.gems=599;s.tutorialDone=true;s.runs=3;s.diff={k:'normal',set:true};
s.pets={own:{'corgi:c':1,'corgi:r':1,'corgi:h':1,'corgi:l':2},eq:'corgi:l',welcome:true,tickets:2,treats:40,picks:{l:1},noirSeen:{'corgi:l':true,'wolf:l':true}};
process.stdout.write(I.serialize(s))"""
    return subprocess.run(['node', '-e', js], cwd=ROOT, capture_output=True, text=True, check=True).stdout


def need(cond, msg):
    if not cond:
        problems.append(msg)


def no_hscroll(pg, where):
    w = pg.evaluate('() => [document.documentElement.scrollWidth, window.innerWidth]')
    need(w[0] <= w[1] + 1, f'{where}: 가로로 넘침 ({w[0]} > {w[1]})')


def money(pg):
    return pg.evaluate(f"() => JSON.parse(localStorage.getItem('{KEY}')).money")


def main():
    os.makedirs(SHOT, exist_ok=True)
    save = seed()
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1)
        ctx.add_init_script("window.__noAttendPop=true;if(!sessionStorage.getItem('seeded')){localStorage.setItem('%s',%s);sessionStorage.setItem('seeded','1');}" % (KEY, json.dumps(save)))
        pg = ctx.new_page()
        pg.set_default_timeout(5000)
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.clock.install()
        pg.goto(URL)
        pg.clock.run_for(3500)
        if pg.locator('#info-sheet').is_visible():
            pg.click('#info-x')
        pg.clock.run_for(3000)

        # 사무실 파트너
        pg.evaluate("Team3MenuUI.go('pets')"); pg.clock.run_for(300)   # 0.8.0 파트너는 파트너 탭
        need(pg.locator('#h-pet-art').count() == 1, '사무실: 파트너 그림이 없음')
        pg.click('#h-pet-art'); pg.clock.run_for(300)
        need(pg.locator('#h-pet-bubble').is_visible(), '사무실: 쓰다듬어도 말풍선이 안 뜸')
        need('단계' in pg.text_content('#h-pet .pet-bond'), '사무실: 친밀도 줄이 없음')   # 0.6.0 "♥ N단계 · …" 로 짧게
        no_hscroll(pg, '사무실')
        pg.screenshot(path=SHOT + 's_hub.png')

        # 매점
        pg.click('#h-gems'); pg.clock.run_for(300)
        need(pg.locator('#shop-sheet').is_visible(), '매점: 배지 칸을 눌러도 안 열림')
        t0 = pg.text_content('#shop-wallet')
        pg.click('[data-ad=ticket]'); pg.clock.run_for(500)
        need(pg.locator('.ad-stub').count() == 1, '매점: 광고 자리(시험판)가 안 뜸')
        pg.clock.run_for(3500)
        need(pg.locator('.ad-stub').count() == 0, '매점: 광고 자리가 안 닫힘')
        need('1 / 5' in pg.text_content('#shop-body'), '매점: 광고 받은 횟수가 안 보임')
        need(t0 != pg.text_content('#shop-wallet'), '매점: 뽑기권이 늘지 않음')
        # 0.13.19 한정 파트너는 매점에서 바로 사지 않고 한정 뽑기로: 매점 카드 → 파트너 창의 한정 뽑기
        need(pg.locator('.lim-card [data-limgo]').count() == 1 and pg.locator('[data-buy=wolf]').count() == 0, '매점: 한정 뽑기로 가는 카드가 없음(또는 바로 사기가 남음)')
        pg.click('.lim-card [data-limgo]'); pg.clock.run_for(500)
        need(not pg.locator('#pets-sheet').is_hidden() and pg.locator('#pets-mode .lim.on').count() == 1 and '확정까지' in pg.text_content('#pets-pity'), '매점: 한정 뽑기 화면이 안 열림')
        pg.evaluate("() => { Team3PetsUI.close(); Team3ShopUI.open('shop'); }"); pg.clock.run_for(300)
        no_hscroll(pg, '매점')
        pg.screenshot(path=SHOT + 's_shop.png')
        pg.click('#shop-tabs [data-tab=pass]'); pg.clock.run_for(200)
        need('단계' in pg.text_content('#pass-body') and pg.locator('#pass-claim').count() == 1, '패스: 단계 · 받기 단추가 없음')
        pg.screenshot(path=SHOT + 's_pass.png')
        pg.click('#shop-x'); pg.clock.run_for(200)

        # 동물 창
        pg.click('#t-pets [data-pet="draw"]'); pg.clock.run_for(300)
        pg.click('#pets-tabs [data-tab=draw]'); pg.clock.run_for(200)
        need('이번 주 출동 파트너' in pg.text_content('#pets-pickup'), '뽑기: 픽업 띠가 없음')
        need('무료' in pg.text_content('#pets-one'), '뽑기: 오늘 무료 뽑기가 없음')
        pg.click('#pets-one'); pg.clock.run_for(400)
        need(pg.locator('.gx').count() == 1, '뽑기: 연출이 안 뜸')
        for _ in range(4):
            if pg.locator('.gx').count():
                pg.click('.gx'); pg.clock.run_for(400)
        pg.clock.run_for(400)
        need(pg.locator('.gx').count() == 0, '뽑기: 연출이 안 닫힘')
        need('무료' not in pg.text_content('#pets-one'), '뽑기: 무료를 쓴 뒤에도 무료로 보임')
        # 0.4.1 가진 만큼 뽑기: 단추에 적힌 횟수만큼 카드가 나오는지, 뽑기권 → 배지 순으로 다 쓸 때까지. 11장 이상은 한 번 캡처
        import re as _re
        shot_many = False
        for _ in range(6):
            if pg.locator('#pets-ten.short').count():
                break
            t = pg.text_content('#pets-ten')
            m = _re.match(r'(\d+)회 뽑기', t)
            need(m is not None, f'뽑기: 여러 번 단추에 횟수가 없음 ({t})')
            if not m:
                break
            n = int(m.group(1))
            need(2 <= n <= 50, f'뽑기: 여러 번 횟수가 범위 밖 ({n})')
            pg.click('#pets-ten'); pg.clock.run_for(300)
            if pg.locator('.cf-back').count(): pg.click('.cf-back [data-cf=ok]'); pg.clock.run_for(600)
            need(pg.locator('.gx-card').count() == n, f'뽑기: {n}회 연출 카드 수가 다름 ({pg.locator(".gx-card").count()})')
            if n > 10 and not shot_many:
                shot_many = True
                pg.click('.gx'); pg.clock.run_for(4000); pg.wait_for_timeout(1500)   # CSS 애니메이션은 실제 시간으로 돈다
                no_hscroll(pg, f'{n}회 연출')
                pg.screenshot(path=SHOT + 's_gacha_many.png')
            for _ in range(6):
                if pg.locator('.gx').count():
                    pg.click('.gx'); pg.clock.run_for(3500)
            need(pg.locator('.gx').count() == 0, f'뽑기: {n}회 연출이 안 닫힘')
        need(shot_many, '뽑기: 11회 이상 뽑기를 한 번도 못 봄(배지 500 이면 나와야 함)')
        need(pg.locator('#pets-one.short').count() == 1 and pg.locator('#pets-ten.short').count() == 1, '뽑기: 다 쓴 뒤 "부족" 표시가 없음')
        need('부족' in pg.text_content('#pets-one') and '부족' in pg.text_content('#pets-ten'), '뽑기: 부족 문구가 없음')
        pg.locator('#pets-draw, #pets-one').first.scroll_into_view_if_needed()
        pg.screenshot(path=SHOT + 's_pets_short.png')
        pg.click('#pets-tabs [data-tab=dex]'); pg.clock.run_for(200)
        need('세트×2' in pg.text_content('#pets-dex'), '도감: 네 등급 모은 종류에 세트 표시가 없음')
        pg.click('.pet-cell[data-k="panda:l"]'); pg.clock.run_for(200)
        need(pg.locator('#pets-pick').count() == 1, '도감: 전설 선택권 단추가 없음')
        pg.click('#pets-pick'); pg.clock.run_for(300)
        need(pg.locator('.pet-cell.have[data-k="panda:l"]').count() == 1, '도감: 전설 선택권으로 데려오지 못함')
        no_hscroll(pg, '도감')
        need(pg.locator('#pets-detail').is_visible(), '도감: 자세히 팝업이 안 뜸')
        pg.click('#pets-pop-back', position={'x': 10, 'y': 10}); pg.clock.run_for(200)   # 0.10.5 팝업 바깥을 누르면 닫힘
        need(not pg.locator('#pets-detail').is_visible(), '도감: 팝업 바깥을 눌러도 안 닫힘')
        pg.click('#pets-tabs [data-tab=closet]'); pg.clock.run_for(200)
        pg.click('[data-outfit=beanie][data-pay=treats]'); pg.clock.run_for(200); pg.click('.cf-back [data-cf=ok]'); pg.clock.run_for(200)
        pg.click('[data-wear=beanie]'); pg.clock.run_for(200)
        need(pg.evaluate(f"() => JSON.parse(localStorage.getItem('{KEY}')).pets.wear['corgi:l']") == 'beanie', '의상: 사서 입히기가 저장되지 않음')
        pg.screenshot(path=SHOT + 's_closet.png')
        pg.click('#pets-x'); pg.clock.run_for(300)

        # 출동 → 결과(시간을 빨리 감는다)
        if pg.locator('#info-sheet').is_visible():   # 전설 선택권으로 데려온 전설 → 코드네임 알림이 뜬다
            need('코드네임' in (pg.text_content('#info-sheet') or ''), '코드네임 알림이 아닌 창이 떠 있음')
            pg.click('#info-x'); pg.clock.run_for(300)
        pg.evaluate("Team3MenuUI.go('home')"); pg.click('#h-go-home'); pg.clock.run_for(6000)
        # 판에서 맞는 한 패를 몇 번 잡는다(smoke.py 와 같은 방법)
        for _ in range(4):
            bd = pg.evaluate("() => [...document.querySelectorAll('#board .card')].map(b => +b.dataset.id)")
            lv = pg.evaluate("() => +document.getElementById('board').dataset.level")
            st = pg.evaluate("([b, lv]) => SuspectsCore.findSets(b, SuspectsCore.activeFor(lv))", [bd, lv]) if bd else []
            if st:
                for i in st[0]:
                    pg.locator('#board .card').nth(i).click(force=True)
                pg.clock.run_for(900)
            else:
                pg.click('#btn-none'); pg.clock.run_for(500)
        pg.clock.run_for(120000)
        need(pg.locator('#res-double').count() == 1, '결과: 2배 받기 단추가 없음')
        txt = pg.text_content('body')
        need('시즌 패스 +' in txt, '결과: 시즌 패스 경험치 줄이 없음')
        m0 = money(pg)
        if pg.locator('#res-double').count():
            pg.click('#res-double'); pg.clock.run_for(3600)
            need(money(pg) > m0, '결과: 2배 받기 뒤 수사비가 늘지 않음')
        pg.screenshot(path=SHOT + 's_result.png')

        # 0.6.0 살아 있는 사무실: 책상 수 = 형사 수(최대 8), 유치장 · 이송 단추, 커피를 누르면 수사비
        pg.evaluate("() => SuspectsUI.goHome()"); pg.clock.run_for(800)
        det = pg.evaluate(f"() => JSON.parse(localStorage.getItem('{KEY}')).detectives")
        need(pg.locator('#h-office .of-desk:not(.empty)').count() == min(det, 8), '사무실: 책상 수가 형사 수와 다름')
        need(pg.locator('#of-cell').count() == 1 and pg.locator('#of-send').count() == 1, '사무실: 유치장 · 이송이 없음')
        m1 = money(pg)
        pg.locator('#h-office .of-desk[data-i="0"]').dispatch_event('click'); pg.clock.run_for(300)
        pg.clock.run_for(900)   # 0.10.9 누르면 바로 커피(모두에게)
        pg.evaluate("() => Team3Save()")
        need(money(pg) > m1, '사무실: 커피를 눌러도 수사비가 안 늘어남')
        no_hscroll(pg, '사무실')
        pg.locator('#h-office').screenshot(path=SHOT + 's_office.png')

        # 0.5.0 사건 3 면통 라인업: 틀리면 그 자리 X · 같은 줄, 맞히면 다음 줄, 단서는 아닌 자리를 지움
        pg.evaluate("() => SuspectsUI.startRun({ duration: 300, freeHints: 0, mode: 'lineup', missPenalty: 5, lineupHitBonus: 0, preOut: 0 })")
        pg.clock.run_for(1500)
        need(pg.locator('#board.luboard .lu-sp').count() in (5, 6), '라인업: 줄이 안 그려짐')
        need(pg.locator('#says.lu .lu-say').count() >= 2, '라인업: 목격자 진술이 없음')
        no_hscroll(pg, '라인업')
        g = pg.evaluate("() => { const g = SuspectsUI._peek(); return { ans: g.q.ans, n: g.q.line.length, line: g.q.line.join() }; }")
        wrong = [i for i in range(g['n']) if i != g['ans']][0]
        pg.locator(f'#board .card[data-i="{wrong}"]').click(force=True); pg.clock.run_for(900)
        need(pg.locator(f'#board .lu-sp.out .card[data-i="{wrong}"]').count() == 1, '라인업: 틀린 자리에 X 가 없음')
        need(pg.evaluate("() => SuspectsUI._peek().q.line.join()") == g['line'], '라인업: 틀렸는데 줄이 바뀜')
        pg.locator(f'#board .card[data-i="{g["ans"]}"]').click(force=True); pg.clock.run_for(1200)
        need(pg.evaluate("() => SuspectsUI._peek().hits") == 1, '라인업: 맞혔는데 검거가 안 늘어남')
        pg.click('#btn-hint'); pg.clock.run_for(300)
        need(pg.locator('#board .lu-sp.out').count() >= 2, '라인업: 단서가 아닌 자리를 안 지움')
        pg.screenshot(path=SHOT + 's_lineup.png')
        pg.clock.run_for(400000)

        # 0.14.0 사건 4 신분증 검사: 창구 하나, 맞히면 다음 사람 · 점수, 틀리면 −초, 단서는 맞는 줄에 초록 표시
        pg.evaluate("() => { SuspectsUI.goHome(); SuspectsUI.startRun({ duration: 300, freeHints: 0, mode: 'idcheck', idMissPenalty: 5, idHitBonus: 0, preCheck: 0 }); }")
        pg.clock.run_for(1500)
        need(pg.locator('#board.idboard .id-photo').count() == 1, '신분증: 사진이 안 그려짐')
        need(pg.locator('#board.idboard .id-row').count() == 2, '신분증: 1단계 신분증 줄이 둘이 아님')
        need(pg.locator('#board .id-btns button').count() == 2, '신분증: 통과 · 체포 단추가 없음')
        need(pg.locator('#says').is_hidden() and pg.locator('#btn-none').is_hidden(), '신분증: 진술서 · 검거 불가가 보임')
        no_hscroll(pg, '신분증')
        g = pg.evaluate("() => SuspectsUI._peek().q.arrest")
        pg.locator('#board [data-dec="%s"]' % ('arrest' if g else 'pass')).click(); pg.clock.run_for(900)
        need(pg.evaluate("() => SuspectsUI._peek().hits") == 1, '신분증: 맞혔는데 맞힌 수가 안 늘어남')
        g = pg.evaluate("() => SuspectsUI._peek().q.arrest")
        pg.locator('#board [data-dec="%s"]' % ('pass' if g else 'arrest')).click(); pg.clock.run_for(1400)
        need(pg.evaluate("() => SuspectsUI._peek().misses") == 1, '신분증: 틀렸는데 오판이 안 늘어남')
        pg.click('#btn-hint'); pg.clock.run_for(300)
        need(pg.locator('#board .id-row.ok').count() >= 1, '신분증: 단서가 맞는 줄을 표시하지 않음')
        pg.screenshot(path=SHOT + 's_idcheck.png')
        pg.clock.run_for(400000)

        # 0.14.1 특별 출동 검거팡: 6×6, 맞으면 점수 · 맞춘 수, 안 맞으면 그대로 / 공범 짝 찾기: 짝이면 남고, 판을 다 치우면 새 판
        pg.evaluate("() => { SuspectsUI.goHome(); SuspectsUI.startRun({ duration: 300, freeHints: 0, mode: 'pang', mods: {} }); }")
        pg.clock.run_for(800)
        need(pg.locator('#board.pgboard .pg-c').count() == 36, '검거팡: 6×6 판이 아님')
        mv = pg.evaluate("() => Team3Pang.findMove(SuspectsUI._peek().q.b)")
        pg.locator('.pg-c[data-p="%d"]' % mv[0]).click(); pg.locator('.pg-c[data-p="%d"]' % mv[1]).click(); pg.clock.run_for(3000)
        need(pg.evaluate("() => SuspectsUI._peek().hits") == 1 and pg.evaluate("() => SuspectsUI._peek().score") > 0, '검거팡: 맞췄는데 점수 · 맞춘 수가 안 늘어남')
        need(pg.locator('#board .pg-c').count() == 36, '검거팡: 연쇄 뒤 판이 36칸이 아님')
        no_hscroll(pg, '검거팡')
        pg.screenshot(path=SHOT + 's_pang.png')
        pg.evaluate("() => { SuspectsUI.goHome(); SuspectsUI.startRun({ duration: 300, freeHints: 0, mode: 'pairs', mods: {} }); }")
        pg.clock.run_for(800)
        need(pg.locator('#board.prboard .pr-back').count() == 8, '짝 찾기: 처음 판이 8장이 아님')
        groups = pg.evaluate("() => { const q = SuspectsUI._peek().q, g = {}; q.cards.forEach((x, j) => { const k = SuspectsCore.project(x, q.attrs).join(''); (g[k] = g[k] || []).push(j); }); return Object.values(g); }")
        for a, c in groups:
            pg.locator('.pr-back[data-i="%d"]' % a).click(); pg.locator('.pr-back[data-i="%d"]' % c).click(); pg.clock.run_for(200)
        pg.clock.run_for(1000)
        need(pg.evaluate("() => SuspectsUI._peek().boards") == 1, '짝 찾기: 판을 다 치웠는데 새 판이 안 됨')
        need(pg.locator('#board .pr-back').count() == 8, '짝 찾기: 새 판이 안 그려짐')
        no_hscroll(pg, '짝 찾기')
        pg.screenshot(path=SHOT + 's_pairs.png')
        pg.clock.run_for(400000)

        # 0.5.0 특별 출동 몽타주 수배: 특징이 시간에 따라 하나씩 그려지고, 맞히면 그때 배수
        pg.evaluate("() => { SuspectsUI.goHome(); SuspectsUI.startRun({ duration: 90, freeHints: 0, mode: 'montage' }); }")
        pg.clock.run_for(300)
        need(pg.locator('#says.mtg .mtg-paper').count() == 1, '몽타주: 종이가 없음')
        n1 = pg.locator('#says.mtg li:not(.no)').count()
        pg.clock.run_for(2500)
        n2 = pg.locator('#says.mtg li:not(.no)').count()
        need(n1 == 1 and n2 == 2, f'몽타주: 특징이 하나씩 안 그려짐 ({n1} → {n2})')
        need('×3' in pg.text_content('.mtg-mult'), '몽타주: 둘째 특징 뒤 배수가 ×3 이 아님')
        a = pg.evaluate("() => { const g = SuspectsUI._peek(); return g.q.cards.indexOf(g.q.ans); }")
        pg.locator(f'#board .card[data-i="{a}"]').click(force=True); pg.clock.run_for(900)
        need(pg.evaluate("() => SuspectsUI._peek().score") == 300, '몽타주: ×3 에 맞혔는데 점수가 300 이 아님')
        no_hscroll(pg, '몽타주')
        pg.screenshot(path=SHOT + 's_montage.png')
        pg.clock.run_for(200000)
        need(not errs, '페이지 오류: ' + ' / '.join(errs[:3]))
        b.close()
    if problems:
        print('수익 · 수집 화면 시험: %d개 걸림' % len(problems))
        for x in problems:
            print('  -', x)
        sys.exit(1)
    print('수익 · 수집 화면 시험: 통과')


if __name__ == '__main__':
    main()
