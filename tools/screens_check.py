#!/usr/bin/env python3
"""
수익 · 수집 화면 시험(0.4.0) — 동물 · 매점 · 패스 · 광고 자리 흐름을 실제로 눌러 본다. publish.sh 가 올리기 전에 돌린다.

보는 것
  사무실 파트너 칸(쓰다듬기 → 친밀도 · 말풍선) · 배지 칸 → 매점
  매점: 광고 자리(시험판 3초) → 뽑기권 +1, 하루 한도 줄어듦 · 결제는 "출시 때 열려요"(시험판 결제 꺼짐)
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
    js = """const I=require('./src/idle.js');const s=I.newSave(Date.now());s.gems=500;s.tutorialDone=true;s.runs=3;
s.pets={own:{'corgi:c':1,'corgi:r':1,'corgi:h':1,'corgi:l':2},eq:'corgi:l',welcome:true,tickets:2,treats:40,picks:{l:1}};
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
        ctx.add_init_script("if(!sessionStorage.getItem('seeded')){localStorage.setItem('%s',%s);sessionStorage.setItem('seeded','1');}" % (KEY, json.dumps(save)))
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
        need(pg.locator('#h-pet-art').count() == 1, '사무실: 파트너 그림이 없음')
        pg.click('#h-pet-art'); pg.clock.run_for(300)
        need(pg.locator('#h-pet-bubble').is_visible(), '사무실: 쓰다듬어도 말풍선이 안 뜸')
        need('친밀도' in pg.text_content('#h-pet'), '사무실: 친밀도 줄이 없음')
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
        need('2/3' in pg.text_content('#shop-body'), '매점: 광고 한도가 줄지 않음')
        need(t0 != pg.text_content('#shop-wallet'), '매점: 뽑기권이 늘지 않음')
        pg.click('[data-buy=gems60]', force=True); pg.clock.run_for(300)   # aria-disabled(출시 전)이어도 누르면 안내가 떠야 한다
        need('출시 때' in (pg.text_content('#toast') or ''), '매점: 시험판 결제가 꺼져 있지 않음')
        no_hscroll(pg, '매점')
        pg.screenshot(path=SHOT + 's_shop.png')
        pg.click('#shop-tabs [data-tab=pass]'); pg.clock.run_for(200)
        need('단계' in pg.text_content('#pass-body') and pg.locator('#pass-claim').count() == 1, '패스: 단계 · 받기 단추가 없음')
        pg.screenshot(path=SHOT + 's_pass.png')
        pg.click('#shop-x'); pg.clock.run_for(200)

        # 동물 창
        pg.click('#h-pet-open'); pg.clock.run_for(300)
        pg.click('#pets-tabs [data-tab=draw]'); pg.clock.run_for(200)
        need('이번 주 출동 동물' in pg.text_content('#pets-pickup'), '뽑기: 픽업 띠가 없음')
        need('무료' in pg.text_content('#pets-one'), '뽑기: 오늘 무료 뽑기가 없음')
        pg.click('#pets-one'); pg.clock.run_for(400)
        need(pg.locator('.gx').count() == 1, '뽑기: 연출이 안 뜸')
        for _ in range(4):
            if pg.locator('.gx').count():
                pg.click('.gx'); pg.clock.run_for(400)
        pg.clock.run_for(400)
        need(pg.locator('.gx').count() == 0, '뽑기: 연출이 안 닫힘')
        need('무료' not in pg.text_content('#pets-one'), '뽑기: 무료를 쓴 뒤에도 무료로 보임')
        pg.click('#pets-tabs [data-tab=dex]'); pg.clock.run_for(200)
        need('세트×2' in pg.text_content('#pets-dex'), '도감: 네 등급 모은 종류에 세트 표시가 없음')
        pg.click('.pet-cell[data-k="panda:l"]'); pg.clock.run_for(200)
        need(pg.locator('#pets-pick').count() == 1, '도감: 전설 선택권 단추가 없음')
        pg.click('#pets-pick'); pg.clock.run_for(300)
        need(pg.locator('.pet-cell.have[data-k="panda:l"]').count() == 1, '도감: 전설 선택권으로 데려오지 못함')
        no_hscroll(pg, '도감')
        pg.click('#pets-tabs [data-tab=closet]'); pg.clock.run_for(200)
        pg.click('[data-outfit=beanie][data-pay=treats]'); pg.clock.run_for(200)
        pg.click('[data-wear=beanie]'); pg.clock.run_for(200)
        need(pg.evaluate(f"() => JSON.parse(localStorage.getItem('{KEY}')).pets.wear['corgi:l']") == 'beanie', '의상: 사서 입히기가 저장되지 않음')
        pg.screenshot(path=SHOT + 's_closet.png')
        pg.click('#pets-x'); pg.clock.run_for(300)

        # 출동 → 결과(시간을 빨리 감는다)
        pg.click('#h-go'); pg.clock.run_for(6000)
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
