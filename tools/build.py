# 빌드: template.html 의 자리표시자에 스크립트를 끼워 넣어 한 장짜리 게임을 만들고,
#       설치형 꾸러미(dist/pwa/ → 저장소의 docs/ 로 올라간다)를 함께 만든다.
#   dist/index.html  게임 한 장(Claude 페이지에도 이것을 올린다)
#   dist/pwa/        index.html + manifest + sw.js + 아이콘 + version.json + 설치방법.txt + .nojekyll
# 버전은 src/notes.js 맨 위 항목이다. 형식이 틀리면 빌드를 멈춘다(앱이 새 버전을 알아채지 못하게 되므로).
import json, pathlib, re, shutil, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'
SCRIPTS = (('/*NOTES*/', 'notes.js'), ('/*UPDATE*/', 'update.js'), ('/*CORE*/', 'core.js'),
           ('/*IDLE*/', 'idle.js'), ('/*IDCHECK*/', 'idcheck.js'), ('/*ECONOMY*/', 'economy.js'), ('/*ICONS*/', 'icons.js'), ('/*OFFICE*/', 'office.js'), ('/*DEPT*/', 'dept.js'), ('/*EVIDENCE*/', 'evidence.js'), ('/*DIFF*/', 'diff.js'), ('/*CREW*/', 'crew.js'), ('/*PETS*/', 'pets.js'), ('/*PETART*/', 'petart.js'), ('/*NOIRPICS*/', 'noirpics.js'), ('/*BGPICS*/', 'bgpics.js'), ('/*NOIRART*/', 'noirart.js'), ('/*ACH*/', 'ach.js'), ('/*MONET*/', 'monet.js'), ('/*ATTEND*/', 'attend.js'), ('/*QUEST*/', 'quest.js'), ('/*SCENE*/', 'scene.js'), ('/*TRANSIT*/', 'transit.js'), ('/*WITNESS*/', 'witness.js'), ('/*FORGERY*/', 'forgery.js'), ('/*LINEUP*/', 'lineup.js'), ('/*MONTAGE*/', 'montage.js'), ('/*FX*/', 'fx.js'), ('/*SOUNDS*/', 'sounds.js'), ('/*SETTINGS*/', 'settings.js'), ('/*MUSIC*/', 'music.js'), ('/*BGM*/', 'bgm.js'), ('/*UI*/', 'ui.js'), ('/*ACHUI*/', 'achui.js'), ('/*PETSUI*/', 'petsui.js'), ('/*SHOPUI*/', 'shopui.js'), ('/*OFFICEUI*/', 'officeui.js'), ('/*EVIDUI*/', 'evidui.js'), ('/*DIFFUI*/', 'diffui.js'), ('/*CREWUI*/', 'crewui.js'), ('/*MENUUI*/', 'menuui.js'), ('/*HUB*/', 'hub.js'))
ICONS = ('icon-192.png', 'icon-512.png', 'icon-maskable-192.png', 'icon-maskable-512.png',
         'apple-touch-icon.png', 'favicon-32.png', 'favicon-64.png')

def latest_note():
    # notes.js 를 node 로 읽는다(파일이 곧 자바스크립트라 따로 형식을 만들지 않는다)
    out = subprocess.run(['node', '-e', "process.stdout.write(JSON.stringify(require('./src/notes.js')[0]))"],
                         cwd=ROOT, capture_output=True, text=True)
    if out.returncode != 0:
        sys.exit('notes.js 를 읽지 못했다: ' + out.stderr)
    note = json.loads(out.stdout)
    if not re.fullmatch(r'\d+(\.\d+)*', note.get('ver', '')):
        sys.exit('notes.js 맨 위 ver 형식이 틀렸다(숫자와 점만): ' + repr(note.get('ver')))
    return note

def copy_noir_big(dest):
    """0.13.15 코드네임 큰 그림(assets/noirbig/*.webp, tools/noir_pics.py 결과)을 dest/noir/ 로. 크게 보기에서만 받는다."""
    src = ROOT / 'assets' / 'noirbig'
    d = dest / 'noir'
    if d.exists():
        shutil.rmtree(d)
    d.mkdir(parents=True)
    if src.exists():
        for f in src.iterdir():
            shutil.copy(f, d / f.name)


def copy_music(dest):
    """배경 음악(assets/music/*.mp3, tools/make_music.py 결과)을 dest/music/ 로. music.js 가 가리키는 파일이 다 있어야 한다."""
    out = subprocess.run(['node', '-e', "process.stdout.write(JSON.stringify(require('./src/music.js')))"],
                         cwd=ROOT, capture_output=True, text=True)
    if out.returncode != 0:
        sys.exit('music.js 를 읽지 못했다: ' + out.stderr)
    files = [m['file'] for m in json.loads(out.stdout).values()]
    d = dest / 'music'
    if d.exists():
        shutil.rmtree(d)
    d.mkdir(parents=True)
    for f in files:
        src = ROOT / 'assets' / f
        if not src.exists():
            sys.exit('배경 음악 파일이 없다(tools/make_music.py 를 돌릴 것): ' + f)
        shutil.copy(src, dest / f)
    return files

def build():
    tpl = (ROOT / 'src/template.html').read_text(encoding='utf-8')
    for mark, name in SCRIPTS:
        if tpl.count(mark) != 1:
            sys.exit(f'자리표시자 {mark} 가 정확히 하나가 아니다')
        code = (ROOT / 'src' / name).read_text(encoding='utf-8')
        if '</script' in code.lower():
            sys.exit(f'{name} 안에 </script 가 있어 페이지가 깨진다')
        tpl = tpl.replace(mark, code)
    # 0.9.9 본문 글꼴 프리텐다드(OFL, 한글 2,350자 묶음)를 페이지 안에 넣는다 — 인터넷이 없어도 · 폰마다 같은 모양
    if tpl.count('/*FONTS*/') != 1:
        sys.exit('자리표시자 /*FONTS*/ 가 정확히 하나가 아니다')
    import base64
    faces = ''   # 0.10.2 본문은 예전 IBM Plex Sans KR(구글 글꼴)로 되돌림 — 프리텐다드는 빼고 블랙한산스만 넣는다
    # 0.10.0 제목 · 숫자 글꼴 블랙한산스(OFL)도 넣는다: KS 한글 2,350자 + 게임에 쓰인 글자만(assets/fonts/BlackHanSans.subset.woff)
    b = base64.b64encode((ROOT / 'assets/fonts/BlackHanSans.subset.woff').read_bytes()).decode()
    faces += "@font-face{font-family:'Black Han Sans';font-weight:400;font-style:normal;font-display:block;src:url(data:font/woff;base64,%s) format('woff')}\n" % b
    tpl = tpl.replace('/*FONTS*/', faces)
    DIST.mkdir(exist_ok=True)
    (DIST / 'index.html').write_text(tpl, encoding='utf-8')
    copy_music(DIST)
    copy_noir_big(DIST)
    # 출동 전환 미리보기: 게임과 같은 transit.js 를 넣은 단독 페이지(배포 폴더에는 넣지 않는다)
    prev = (ROOT / 'src/transit-preview.html').read_text(encoding='utf-8')
    if prev.count('/*TRANSIT*/') != 1:
        sys.exit('transit-preview.html 의 /*TRANSIT*/ 자리표시자가 하나가 아니다')
    (DIST / 'transit-preview.html').write_text(prev.replace('/*TRANSIT*/', (ROOT / 'src/transit.js').read_text(encoding='utf-8')), encoding='utf-8')

    note = latest_note()
    pwa = DIST / 'pwa'
    if pwa.exists():
        shutil.rmtree(pwa)
    pwa.mkdir()
    (pwa / 'index.html').write_text(tpl, encoding='utf-8')
    copy_music(pwa)
    copy_noir_big(pwa)
    for f in ('manifest.webmanifest', '설치방법.txt'):
        shutil.copy(ROOT / 'pwa-src' / f, pwa / f)
    sw = (ROOT / 'pwa-src/sw.js').read_text(encoding='utf-8')
    if '__VERSION__' not in sw:
        sys.exit('sw.js 에 __VERSION__ 자리가 없다')
    (pwa / 'sw.js').write_text(sw.replace('__VERSION__', note['ver']), encoding='utf-8')
    for f in ICONS:
        shutil.copy(ROOT / 'assets/icons' / f, pwa / f)
    (pwa / 'version.json').write_text(json.dumps({
        'version': note['ver'], 'name': '수사 3팀 ' + note['ver'], 'title': note.get('title', ''),
        'items': note.get('items', []), 'date': note.get('date', '')}, ensure_ascii=False, indent=1), encoding='utf-8')
    (pwa / '.nojekyll').write_text('', encoding='utf-8')   # GitHub Pages 가 파일을 가공하지 않게
    print(f'빌드: dist/index.html, dist/pwa/ (버전 {note["ver"]}, {len(tpl)} bytes)')
    return note['ver']

if __name__ == '__main__':
    build()
