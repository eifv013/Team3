# 설치형 확인: dist/pwa 를 GitHub Pages 주소(https://eifv013.github.io/Team3/)에 올린 것처럼 흉내 내서
#   새 버전이면 단추 하나뿐인 업데이트 창이 뜨고(뒤로·Esc 로 안 닫힘) 누르면 다시 열리는지 · 출동 중에는 끼어들지 않는지 ·
#   뒤로 가기(안드로이드)가 화면을 한 단계씩 되돌리는지 · manifest 가 읽히는지 본다.
import json, pathlib, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PWA = ROOT / 'dist/pwa'
BASE = 'https://eifv013.github.io/Team3/'
problems = []
remote = {'version': json.loads((PWA / 'version.json').read_text(encoding='utf-8'))['version']}

def serve(route):
    name = route.request.url.split('?')[0][len(BASE):] or 'index.html'
    if name == 'version.json':
        body = dict(json.loads((PWA / 'version.json').read_text(encoding='utf-8')), version=remote['version'], title='시험용 새 버전')
        return route.fulfill(status=200, content_type='application/json', body=json.dumps(body, ensure_ascii=False))
    f = PWA / name
    if not f.is_file(): return route.fulfill(status=404, body='')
    ct = {'html': 'text/html', 'js': 'text/javascript', 'json': 'application/json', 'png': 'image/png', 'webmanifest': 'application/manifest+json'}.get(f.suffix[1:], 'application/octet-stream')
    route.fulfill(status=200, content_type=ct, body=f.read_bytes())

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, service_workers='block')
    ctx.route(BASE + '**', serve)
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE); pg.wait_for_timeout(4500)
    if not pg.locator('#updating').is_hidden(): problems.append('같은 버전인데 바꾸는 중 화면이 뜸')
    man = pg.evaluate("() => fetch('manifest.webmanifest').then(r => r.json()).then(j => j.name)")
    if man != '수사 3팀': problems.append('manifest 이름이 이상함: ' + str(man))
    if '0.' not in pg.text_content('#h-version'): problems.append('버전 표시가 없음')
    # 새 버전이 올라옴 → 사무실을 덮는 업데이트 창(단추 하나) → 누르면 다시 열림
    remote['version'] = '9.9.9'
    pg.reload(); pg.wait_for_timeout(4500)
    if pg.locator('#updating').is_hidden(): problems.append('새 버전인데 업데이트 창이 안 뜸')
    else:
        if '9.9.9' not in pg.text_content('#up-title'): problems.append('업데이트 창의 버전이 이상함')
        if pg.locator('#updating button').count() != 1: problems.append('업데이트 창 단추가 하나가 아님')
        if pg.evaluate('Team3Back()') != 'stay' or pg.locator('#updating').is_hidden(): problems.append('뒤로 가기로 업데이트 창이 닫힘')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
        if pg.locator('#updating').is_hidden(): problems.append('Esc 로 업데이트 창이 닫힘')
        pg.screenshot(path='/tmp/shots/updating.png')
        with pg.expect_navigation(timeout=15000): pg.click('#up-go')
    remote['version'] = '0.0.1'     # 옛 버전으로 되돌려 다음 확인에 쓰기
    pg.wait_for_timeout(4500)
    if pg.locator('#info-sheet').is_visible(): pg.click('#info-cancel'); pg.wait_for_timeout(200)
    pg.wait_for_timeout(900)   # 0.7.0 튜토리얼을 건너뛰면 난이도 고르기 창(한 번)
    if pg.locator('#diff-sheet').is_visible(): pg.click('#df-go'); pg.wait_for_timeout(300); pg.click('#df-ok'); pg.wait_for_timeout(200)
    else: problems.append('튜토리얼을 건너뛰었는데 난이도 고르기 창이 안 뜸')
    if not pg.locator('#updating').is_hidden(): problems.append('옛 버전인데 업데이트 창이 뜸')
    # 출동 중에 새 버전이 나오면 끼어들지 않고, 사무실로 돌아올 때 창을 띄운다
    pg.click('#h-go'); pg.wait_for_timeout(300)
    remote['version'] = '9.9.10'
    pg.evaluate('Team3CheckUpdate()'); pg.wait_for_timeout(2500)   # 전환 도중에 새 버전 확인 → 끼어들면 안 된다
    if not pg.locator('#updating').is_hidden() or not pg.locator('#s-play').is_visible(): problems.append('출동 중에 업데이트 창이 끼어듦')
    pg.click('#btn-quit'); pg.wait_for_timeout(200); pg.click('#btn-quit-yes'); pg.wait_for_timeout(300)
    if pg.locator('#updating').is_hidden(): problems.append('사무실로 돌아왔는데 업데이트 창이 안 뜸')
    with pg.expect_navigation(timeout=15000): pg.click('#up-go')
    remote['version'] = '0.0.1'
    # 뒤로 가기: 사무실 → exit, 튜토리얼 → 사무실, 출동 → 멈춤 창 → 닫힘
    pg.wait_for_timeout(4500)
    if pg.locator('#info-sheet').is_visible(): pg.click('#info-cancel'); pg.wait_for_timeout(200)
    if pg.evaluate('Team3Save()') != 'ok': problems.append('끄기 직전 저장(Team3Save)이 안 됨')
    if pg.evaluate('Team3Back()') != 'exit': problems.append('사무실에서 뒤로가 exit 가 아님')
    pg.click('#h-sound'); pg.wait_for_timeout(150); pg.click('#set-tut'); pg.wait_for_timeout(200)   # 튜토리얼은 설정 창에서(0.1.18)
    if pg.evaluate('Team3Back()') != 'stay' or not pg.locator('#s-hub').is_visible(): problems.append('튜토리얼에서 뒤로가 사무실로 안 감')
    pg.click('#h-go'); pg.wait_for_timeout(150)
    # 출동 전환 중 뒤로: 앱이 꺼지면(exit) 안 된다
    if pg.evaluate('Team3Back()') != 'stay': problems.append('출동 전환 중 뒤로가 stay 가 아님')
    pg.wait_for_timeout(2500)
    pg.evaluate('Team3Back()'); pg.wait_for_timeout(200)
    if pg.locator('#quit-sheet').is_hidden(): problems.append('출동 중 뒤로가 멈춤 창을 안 띄움')
    pg.evaluate('Team3Back()'); pg.wait_for_timeout(200)
    if not pg.locator('#quit-sheet').is_hidden(): problems.append('멈춤 창에서 뒤로가 창을 안 닫음')
    problems += ['페이지 오류: ' + e for e in errs]
    b.close()
print('설치형 확인: ' + ('\n'.join(problems) if problems else '통과'))
sys.exit(1 if problems else 0)
