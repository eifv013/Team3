# 화면 시험: 폰 세로 화면에서 실제로 눌러 본다. 사용: python3 tools/smoke.py
#   로딩 → 첫 안내 → 튜토리얼 4문제 → 사무실(이름 바꾸기·다음 검거 줄) → 출동(셋째 조건 줄·검거·오인·단서·
#   단계 1→4·멈춤) → 결과(수사비·진척) → 형사 영입 → 잠복 보고 → 사건 종결 → 깨진 저장 → 낮은 화면·가로 화면
import json, pathlib, sys, time
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'dist/index.html').as_uri()
SHOT = '/tmp/shots/'
problems = []

# 판 위 카드 id(data-id)와 지금 단계(data-level)를 읽는다
READ = "() => [...document.querySelectorAll('#board .card')].map(b => +b.dataset.id)"
LEVEL = "() => +document.getElementById('board').dataset.level"
SETS = "([b, lv]) => SuspectsCore.findSets(b, SuspectsCore.activeFor(lv))"
BAD = """([b, lv]) => { const C = SuspectsCore, a = C.activeFor(lv);
  for (let i=0;i<9;i++) for (let j=i+1;j<9;j++) for (let k=j+1;k<9;k++) if (!C.isSet(b[i],b[j],b[k],a)) return [i,j,k]; return null; }"""

def card(pg, i): return pg.locator('#board .card').nth(i)

def catch_one(pg):
    """판에서 한 패를 잡는다(없으면 검거 불가). 잡았으면 True"""
    b = pg.evaluate(READ); lv = pg.evaluate(LEVEL)
    st = pg.evaluate(SETS, [b, lv])
    if st:
        for i in st[0]: card(pg, i).click(force=True)   # 단서 카드는 흔들려서 force
        pg.clock.run_for(800); return True
    pg.click('#btn-none'); pg.clock.run_for(400); return False

def tutorial(pg):
    pg.clock.run_for(200)
    if not pg.locator('#s-tutorial').is_visible(): problems.append('튜토리얼이 안 열림'); return
    for step in range(1, 5):
        lab = pg.text_content('#tut-step')
        if f'{step} / 4' not in lab: problems.append(f'튜토리얼 단계 표시 이상: {lab}')
        a, b = pg.evaluate("() => [...document.querySelectorAll('#tut-pair .card')].map(e => +e.dataset.id)")
        opts = pg.evaluate("() => [...document.querySelectorAll('#tut-opts .card')].map(e => +e.dataset.id)")
        act = pg.evaluate("(lv) => SuspectsCore.activeFor(lv)", step)
        right = [i for i, o in enumerate(opts) if pg.evaluate("([a,b,o,act]) => SuspectsCore.isSet(a,b,o,act)", [a, b, o, act])]
        if len(right) != 1: problems.append(f'튜토리얼 {step}: 정답이 {len(right)}개'); return
        wrong = [i for i in range(len(opts)) if i != right[0]][0]
        pg.locator('#tut-opts .card').nth(wrong).click(); pg.clock.run_for(100)
        if '두 명만 같아요' not in pg.text_content('#tut-explain'): problems.append(f'튜토리얼 {step}: 오답 설명 없음')
        if pg.locator('#tut-next').is_visible(): problems.append(f'튜토리얼 {step}: 오답인데 다음으로 넘어감')
        pg.locator('#tut-opts .card').nth(right[0]).click(); pg.clock.run_for(100)
        if '맞아요' not in pg.text_content('#tut-explain'): problems.append(f'튜토리얼 {step}: 정답 해설 없음')
        if step == 2: pg.screenshot(path=SHOT + 'tut.png')
        pg.click('#tut-next'); pg.clock.run_for(150)
    if not pg.locator('#tut-done').is_visible(): problems.append('튜토리얼 끝 화면이 안 뜸')
    pg.screenshot(path=SHOT + 'tut-done.png')

def play_checks(pg, start_level, helper):
    """출동 화면 공통 확인. 시작 직후 불린다."""
    marks = pg.locator('#board .card .m').count()
    if start_level == 4 and marks != 9: problems.append('네 가지인데 흔적 표시가 없음')
    if start_level == 1 and marks != 0: problems.append('모자 단계인데 흔적 표시가 보임')
    if pg.evaluate(LEVEL) != start_level: problems.append(f'시작 단계가 {pg.evaluate(LEVEL)}')
    # 두 명 고르면 셋째 조건 줄
    b = pg.evaluate(READ); st = pg.evaluate(SETS, [b, start_level])
    if st:
        card(pg, st[0][0]).click(); card(pg, st[0][1]).click(); pg.clock.run_for(100)
        vis = pg.locator('#needs').is_visible()
        if helper and not vis: problems.append('두 명 골랐는데 셋째 조건 줄이 없음')
        if not helper and vis: problems.append('노말인데 셋째 조건 줄이 보임')
        pg.screenshot(path=SHOT + 'needs.png')
        card(pg, st[0][2]).click(); pg.clock.run_for(800)
        if pg.text_content('#score') in ('0', None): problems.append('검거했는데 점수가 0')
    # 오인 체포
    b = pg.evaluate(READ); lv = pg.evaluate(LEVEL); bad = pg.evaluate(BAD, [b, lv])
    if bad:
        for i in bad: card(pg, i).click()
        pg.clock.run_for(150)
        if '두 명만 같아요' not in pg.text_content('#hint'): problems.append('오인 체포 이유가 안 보임: ' + pg.text_content('#hint'))
        pg.clock.run_for(600)
    # 단서 두 번
    pg.click('#btn-hint'); pg.clock.run_for(100)
    n1 = pg.locator('#board .card.clue').count(); h1 = pg.text_content('#hint')
    pg.click('#btn-hint'); pg.clock.run_for(100)
    n2 = pg.locator('#board .card.clue').count(); h2 = pg.text_content('#hint')
    if '한 패가 없어요' not in h1 and not (n1 == 1 and n2 == 2 and '셋째는' in h2): problems.append(f'단서가 이상함: {n1} {n2} {h1} / {h2}')
    pg.screenshot(path=SHOT + 'hint.png')

with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    pg = ctx.new_page()
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.clock.install()
    pg.goto(URL); pg.clock.run_for(300)
    if not pg.locator('#splash').is_visible(): problems.append('로딩 화면이 안 보임')
    if not pg.locator('#sp-lineup .card').count() == 3: problems.append('로딩 화면 라인업이 셋이 아님')
    pg.clock.run_for(1200); pg.screenshot(path=SHOT + 'splash.png')
    if not pg.locator('#splash').is_visible(): problems.append('1.5초 만에 로딩 화면이 걷힘(너무 짧음)')
    pg.clock.run_for(3000)
    if pg.locator('#splash').count(): problems.append('4초가 지나도 로딩 화면이 안 걷힘')

    if True:
        KEY = 'guar.suspects3.idle.v1'
        if not pg.locator('#s-hub').is_visible(): problems.append('사무실이 첫 화면이 아님')
        if '골목길' not in pg.text_content('#info-title'): problems.append('처음 켰는데 사건 소개가 없음')
        pg.screenshot(path=SHOT + 'welcome.png')
        pg.click('#info-ok'); tutorial(pg)                 # 튜토리얼 하기
        pg.click('#tut-home'); pg.clock.run_for(200)
        if not pg.locator('#s-hub').is_visible(): problems.append('튜토리얼 뒤 사무실로가 안 됨')
        pg.screenshot(path=SHOT + 'hub.png', full_page=True)
        # 다음 검거 줄이 차오르고, 잡는 순간 +수사비가 떠오른다
        if '다음 검거까지' not in pg.text_content('#h-next'): problems.append('다음 검거까지 표시가 없음')
        w1 = pg.evaluate("() => parseFloat(document.getElementById('h-next-fill').style.width)")
        pg.clock.run_for(20_000)
        w2 = pg.evaluate("() => parseFloat(document.getElementById('h-next-fill').style.width)")
        if not w2 > w1: problems.append(f'다음 검거 줄이 안 차오름: {w1} → {w2}')
        y_case = pg.locator('.casebox').bounding_box()['y']
        m0 = pg.text_content('#h-money'); feeds = 0
        for _ in range(70):
            pg.clock.run_for(1000)
            if pg.locator('#h-float .float').count(): feeds += 1; break
        if not feeds: problems.append('팀이 잡았는데 +수사비가 안 떠오름')
        if '검거' not in pg.text_content('#h-feed'): problems.append('팀 검거 소식 줄이 없음: ' + pg.text_content('#h-feed'))
        if pg.text_content('#h-money') == m0: problems.append('팀이 잡았는데 수사비가 그대로')
        pg.screenshot(path=SHOT + 'gain.png')
        if abs(pg.locator('.casebox').bounding_box()['y'] - y_case) > 0.5: problems.append('소식이 뜰 때 아래 칸이 움직임')
        pg.clock.run_for(5000)
        if abs(pg.locator('.casebox').bounding_box()['y'] - y_case) > 0.5: problems.append('소식이 질 때 아래 칸이 움직임')
        if pg.evaluate("() => document.querySelector('.rate-line').classList.contains('news')"): problems.append('4초가 지나도 소식이 안 사라짐')
        if not pg.locator('#h-hire').is_disabled(): problems.append('수사비 0 인데 영입 단추가 눌림')
        # 프로필: 경찰서·팀장 이름 바꾸기(HTML 이 섞인 이름도 글자로만 보인다)
        if 'GUAR' in pg.text_content('#s-hub').upper(): problems.append('사무실에 GUAR 가 남아 있음')
        pg.click('#h-profile'); pg.clock.run_for(100)
        pg.fill('#pf-station', '강남서'); pg.fill('#pf-leader', '<i>김형사</i>'); pg.press('#pf-leader', 'Enter'); pg.clock.run_for(100)
        if pg.text_content('#h-station') != '강남서 · 수사 3팀': problems.append('경찰서 이름이 안 바뀜: ' + pg.text_content('#h-station'))
        if pg.text_content('#h-leader') != '팀장 i김형사/i': problems.append('팀장 이름이 이상함: ' + pg.text_content('#h-leader'))
        if pg.locator('#h-leader i').count(): problems.append('이름 속 HTML 이 그대로 그려짐')
        pg.screenshot(path=SHOT + 'profile.png')
        # 출동 → 결과
        pg.click('#h-go'); pg.clock.run_for(400)
        if not pg.locator('#s-play').is_visible(): problems.append('출동이 안 됨')
        play_checks(pg, 1, helper=True)
        # 잡을수록 단계가 오른다: 2명→얼굴, 4명→시간대, 7명→흔적
        seen = {pg.evaluate(LEVEL)}
        for _ in range(25):
            if pg.evaluate(LEVEL) == 4: break
            catch_one(pg); seen.add(pg.evaluate(LEVEL))
        if seen != {1, 2, 3, 4}: problems.append(f'단계가 차례로 안 오름: {sorted(seen)}')
        if pg.locator('#board .card .m').count() != 9: problems.append('4단계인데 흔적 표시가 없음')
        # 감식반이 없으면 네 가지에서는 셋째 조건 줄이 없다
        b4 = pg.evaluate(READ); st4 = pg.evaluate(SETS, [b4, 4])
        if st4:
            card(pg, st4[0][0]).click(force=True); card(pg, st4[0][1]).click(force=True); pg.clock.run_for(100)
            if pg.locator('#needs').is_visible(): problems.append('감식반 없이 네 가지에서 셋째 조건 줄이 보임')
            card(pg, st4[0][0]).click(force=True); card(pg, st4[0][1]).click(force=True); pg.clock.run_for(100)
        pg.screenshot(path=SHOT + 'level4.png')
        # X → 멈춤 → 계속
        pg.click('#btn-quit'); pg.clock.run_for(200)
        t0 = pg.text_content('#time'); pg.clock.run_for(20_000)
        if pg.text_content('#time') != t0: problems.append('확인 창 동안 시간이 흐름')
        pg.click('#btn-quit-no'); pg.clock.run_for(200)
        pg.set_viewport_size({'width': 375, 'height': 667}); pg.clock.run_for(100)
        over = pg.evaluate("() => { const a = document.querySelector('.app'); return a.scrollHeight - a.clientHeight; }")
        if over > 2: problems.append(f'375×667 출동 화면이 {over}px 넘침')
        pg.screenshot(path=SHOT + 'se.png')
        pg.set_viewport_size({'width': 390, 'height': 844}); pg.clock.run_for(100)
        pg.clock.run_for(200_000)
        if not pg.locator('#s-result').is_visible(): problems.append('출동 끝 결과 화면이 안 뜸')
        txt = pg.text_content('#r-idle') or ''
        if '수사비' not in txt or '사건 진척' not in txt: problems.append('출동 결과에 수사비·진척이 없음: ' + txt)
        pg.screenshot(path=SHOT + 'result.png')
        pg.click('#btn-home'); pg.clock.run_for(300)
        if not pg.locator('#s-hub').is_visible(): problems.append('사무실로가 안 됨')
        caught = pg.text_content('#h-caught')
        if caught.startswith('0 '): problems.append('출동했는데 사건 진척이 0: ' + caught)
        if pg.locator('#h-buff').is_hidden(): problems.append('출동 뒤 사기 충전 표시가 없음')
        if pg.locator('#h-hire').is_enabled():
            det0 = pg.text_content('#h-det'); pg.click('#h-hire'); pg.clock.run_for(100)
            if pg.text_content('#h-det') == det0: problems.append('영입했는데 형사 수가 그대로')
        else:
            problems.append('출동 한 번 뒤에도 영입을 못 함(수사비 ' + pg.text_content('#h-money') + ')')
        pg.screenshot(path=SHOT + 'hub2.png', full_page=True)
        # 잠복 보고: 창을 닫고 2시간 뒤 새로 켬(열어 둔 채 시간을 돌리면 1초마다 이미 반영되므로)
        t_close = pg.evaluate('Date.now()')
        pg.close()
        pg = ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.clock.install(time=(t_close + 2 * 3600 * 1000) / 1000)   # 파이썬 쪽은 초 단위
        pg.goto(URL); pg.clock.run_for(4500)
        if pg.text_content('#info-label') != '잠복 보고' or pg.locator('#info-sheet').is_hidden(): problems.append('다시 켰는데 잠복 보고가 없음')
        pg.screenshot(path=SHOT + 'away.png')
        if pg.text_content('#h-station') != '강남서 · 수사 3팀': problems.append('다시 켰더니 경찰서 이름이 사라짐')
        pg.click('#info-ok'); pg.clock.run_for(100)
        # 사건 종결: 창을 닫고, 다음 창이 뜨기 직전에 저장을 299명으로 바꿔 팀이 마지막 한 명을 잡게 한다.
        # (열린 창의 저장을 바꾸면 떠날 때 게임이 덮어쓰므로 창 사이에서 바꾼다)
        reopen_n = [0]
        def reopen(js):
            global pg
            reopen_n[0] += 1
            flag = 'patched' + str(reopen_n[0])   # 앞 창의 바꾸기가 다음 창에서 다시 돌지 않도록 창마다 다른 표시
            t = pg.evaluate('Date.now()')
            pg.close()
            time.sleep(0.5)   # 닫힌 창이 떠나면서 하는 저장이 끝난 뒤에 바꾼다(늦게 끝나면 바꾼 값을 덮어쓴다)
            ctx.add_init_script("if (location.href.indexOf('dist/index.html') >= 0 && !localStorage.getItem('%s')) { localStorage.setItem('%s', '1'); %s }" % (flag, flag, js))
            pg = ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
            pg.clock.set_system_time((t + 1000) / 1000)   # 시계는 이미 깔려 있다(초 단위)
            pg.goto(URL); pg.clock.run_for(4500)
        reopen("const d = JSON.parse(localStorage.getItem('%s')); d.caught = 299; d.frac = 0; localStorage.setItem('%s', JSON.stringify(d));" % (KEY, KEY))
        if '299' not in pg.text_content('#h-caught'): problems.append('저장 바꾸기 실패: ' + pg.text_content('#h-caught'))
        if not pg.locator('#info-sheet').is_hidden(): pg.click('#info-ok'); pg.clock.run_for(100)
        pg.clock.run_for(70_000)
        if '종결' not in (pg.text_content('#info-label') or '') or pg.locator('#info-sheet').is_hidden(): problems.append('목표에 닿았는데 사건 종결 창이 없음')
        if '(종결)' not in pg.text_content('#h-case'): problems.append('사건 제목에 종결 표시가 없음')
        pg.screenshot(path=SHOT + 'closed.png')
        # 깨진 저장
        reopen("localStorage.setItem('%s', '{broken');" % KEY)
        if not pg.locator('#s-hub').is_visible(): problems.append('깨진 저장에서 사무실이 안 뜸')
        if '처음부터' not in (pg.text_content('#toast') or ''): problems.append('깨진 저장 알림이 없음')
        # 낮은 화면(iOS 앱 안)에서도 사무실이 스크롤되고 출동 단추에 닿는다
        pg.set_viewport_size({'width': 375, 'height': 560}); pg.clock.run_for(100)
        pg.locator('#h-go').scroll_into_view_if_needed()
        box = pg.locator('#h-go').bounding_box()
        if not box or box['y'] < 0 or box['y'] + box['height'] > 561: problems.append('낮은 화면에서 출동 단추에 닿지 못함')
        pg.set_viewport_size({'width': 844, 'height': 390}); pg.clock.run_for(100)
        if not pg.locator('.rotate').is_visible(): problems.append('가로 화면 안내가 안 뜸')

    problems += ['페이지 오류: ' + e for e in errors]
    br.close()
print('화면 시험: ' + ('\n'.join(problems) if problems else '화면 시험 통과'))
sys.exit(1 if problems else 0)
