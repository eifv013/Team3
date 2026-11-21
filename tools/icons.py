# 앱 아이콘 만들기: 최종 시안 Y3c(폴리스 라인 뒤의 세 용의자 + 검은 딱지 "수사 3팀")를 크기별 PNG 로 뽑는다.
#   그림은 게임의 실루엣 함수(src/ui.js 의 figure)를 그대로 써서 게임과 같은 화풍을 유지한다.
#   글꼴은 assets/fonts/BlackHanSans-Regular.ttf(OFL) 를 @font-face 로 넣는다.
# 결과(assets/icons/):
#   icon.svg                  원본(글자는 글꼴 의존)
#   icon-512.png, icon-192.png               홈 화면 추가(PWA)·스토어용
#   icon-maskable-512.png, icon-maskable-192.png  안드로이드 원형·물방울 등으로 잘려도 안전한 판(내용 80%)
#   apple-touch-icon.png (180)               아이폰 홈 화면
#   favicon-32.png, favicon-64.png           브라우저 탭
#   android/mipmap-*/ic_launcher.png, ic_launcher_round.png, ic_launcher_foreground.png  APK 용
import base64, pathlib, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets/icons'
ui = (ROOT / 'src/ui.js').read_text(encoding='utf-8')
ART = ui[ui.index('  var BG = ['):ui.index('  var ALL = [0, 1, 2, 3];')]
FONT = base64.b64encode((ROOT / 'assets/fonts/BlackHanSans-Regular.ttf').read_bytes()).decode()

PAGE = '''<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:"BHS";src:url(data:font/ttf;base64,%FONT%) format("truetype")}
html,body{margin:0;background:transparent}</style></head><body><div id="c"></div><script>
%ART%
const INK="#12151C", ACC="#FFD23F", NAVY="#1A2030", LIGHT="#EDE7D9", BACK="#B9B2A3", DEEP="#1E2638";
const fig=(h,f,fg,bg,x,y,s)=>`<g transform="translate(${x},${y}) scale(${s})">${figure(h,f,fg,bg)}</g>`;
const T=(x,y,size,fill,t)=>`<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-family="BHS" font-size="${size}" fill="${fill}">${t}</text>`;
// content: 512 기준 그림. k = 내용 크기 비율(마스커블·적응형은 가장자리가 잘리므로 줄인다)
function art(k, withBg) {
  const y=368, a=-8;
  const inner = `
   ${[90,150,210,270,330].map((yy,i)=>`<line x1="-200" y1="${yy}" x2="712" y2="${yy}" stroke="#34405C" stroke-width="5"/>${T(30,yy-14,22,"#4A5878",String(7-i))}`).join('')}
   ${fig(1,1,BACK,DEEP,-36,128,2.6)}${fig(0,0,BACK,DEEP,294,132,2.6)}${fig(2,2,LIGHT,"#212A40",100,74,3.1)}
   <g transform="rotate(${a} 256 ${y})"><rect x="-260" y="${y-66}" width="1032" height="10" fill="#000" opacity=".25"/>
     <rect x="-260" y="${y-60}" width="1032" height="120" fill="${ACC}"/>
     <rect x="-260" y="${y-60}" width="1032" height="12" fill="${INK}"/><rect x="-260" y="${y+48}" width="1032" height="12" fill="${INK}"/>
     ${[...Array(12)].map((_,i)=>`<path d="M${-240+i*90} ${y-48}l26 0-34 96-26 0z" fill="${INK}" opacity=".12"/>`).join('')}
     <rect x="91" y="${y-38}" width="330" height="78" rx="14" fill="${INK}"/>${T(256,y+3,70,ACC,'수사 3팀')}
     ${[176,346].map(x=>`<ellipse cx="${x}" cy="${y-58}" rx="23" ry="18" fill="${LIGHT}" stroke="${NAVY}" stroke-width="6"/>`).join('')}</g>`;
  const bg = withBg ? `<defs><radialGradient id="g" cx="50%" cy="42%" r="60%"><stop offset="0" stop-color="#26304A"/><stop offset="1" stop-color="${NAVY}"/></radialGradient></defs><rect width="512" height="512" fill="url(#g)"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${bg}<g transform="translate(${256-256*k},${256-256*k}) scale(${k})">${inner}</g></svg>`;
}
window.art = art;
</script></body></html>'''.replace('%FONT%', FONT).replace('%ART%', ART)

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    page_file = OUT / '_render.html'
    page_file.write_text(PAGE, encoding='utf-8')
    jobs = [  # (파일, 크기, 내용 비율, 바탕 포함)
        ('icon-512.png', 512, 1.0, True), ('icon-192.png', 192, 1.0, True),
        ('icon-maskable-512.png', 512, 0.8, True), ('icon-maskable-192.png', 192, 0.8, True),
        ('apple-touch-icon.png', 180, 1.0, True), ('favicon-32.png', 32, 1.0, True), ('favicon-64.png', 64, 1.0, True),
    ]
    # 안드로이드 런처: 밀도별. 적응형 전경은 108dp 중 가운데 72dp 만 안전 → 내용 2/3, 바탕은 색으로 따로
    for name, px in (('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)):
        jobs.append((f'android/mipmap-{name}/ic_launcher.png', px, 1.0, True))
        jobs.append((f'android/mipmap-{name}/ic_launcher_round.png', px, 0.86, True))
        jobs.append((f'android/mipmap-{name}/ic_launcher_foreground.png', round(px * 108 / 48), 0.64, True))
    head = PAGE.split('<body>')[0]
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = b.new_page(viewport={'width': 512, 'height': 512}, device_scale_factor=1)
        pg.goto(page_file.as_uri())
        # @font-face 글꼴은 쓰일 때 불러오므로 먼저 불러 둔다
        pg.evaluate("() => document.fonts.load('70px BHS')")
        svgs = {(k, bg): pg.evaluate("([k, bg]) => art(k, bg)", [k, bg]) for _, _, k, bg in jobs}
        (OUT / 'icon.svg').write_text(pg.evaluate("() => art(1, true)"), encoding='utf-8')
        for rel, size, k, bg in jobs:
            svg = svgs[(k, bg)].replace('width="512" height="512"', f'width="{size}" height="{size}"', 1)
            pg.set_viewport_size({'width': size, 'height': size})
            pg.set_content(head + f'<body>{svg}<script>document.fonts.load("70px BHS")</script></body></html>')
            pg.evaluate("() => document.fonts.load('70px BHS').then(() => document.fonts.ready)")
            out = OUT / rel
            out.parent.mkdir(parents=True, exist_ok=True)
            pg.screenshot(path=str(out), clip={'x': 0, 'y': 0, 'width': size, 'height': size})
        b.close()
    page_file.unlink()
    print('아이콘', len(jobs) + 1, '개 →', OUT)

if __name__ == '__main__':
    main()
