"""
효과음 파일 → src/sounds.js (게임 한 파일 안에 data URI 로 넣는다. 오프라인·PWA 에서도 그대로 동작)

시계 초침(clock): 원본(assets/sounds/clock-ticking-source.mp3)은 1초마다 "톡(.14) - 틱(.64) - 틱(.89)"이 되풀이된다.
  3.13초부터 정확히 1초(한 주기)를 잘라, 앞 5ms·뒤 40ms 를 부드럽게 줄이고, 모노 64kbps mp3 로 만든다.
  출동 마지막 10초 동안 초가 바뀔 때마다 이 1초를 한 번 튼다 → 원본의 리듬이 그대로 이어진다.
사이렌(siren): 원본(assets/sounds/bgm-src-siren.mp3, universfield "Siren's Call")은 10~38초가 고른 울림이다.
  10.5초부터 3.5초를 잘라 앞 0.25초에 서서히 들어오고 뒤 1.2초에 걸쳐 멀어지게, 모노 64kbps mp3 로 만든다.
  주범 조 출동 버튼을 누르는 순간(경광등 연출과 함께) 한 번 튼다.
"""
import base64, subprocess, sys, tempfile, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets/sounds/clock-ticking-source.mp3'
SIREN = ROOT / 'assets/sounds/bgm-src-siren.mp3'
SIREN_START, SIREN_LEN = 10.5, 3.5
OUT = ROOT / 'src/sounds.js'
START, LEN = 3.13, 1.0

def clip(src, start, length, fade_in, fade_out, out):
    """원본에서 start 초부터 length 초를 잘라 앞뒤를 부드럽게 줄이고, 모노 64kbps mp3 로 만든 data URI 를 돌려준다."""
    if not src.exists():
        sys.exit('원본 소리가 없다: ' + str(src))
    r = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(start), '-t', str(length), '-i', str(src),
                        '-af', f'afade=t=in:st=0:d={fade_in},afade=t=out:st={length - fade_out}:d={fade_out}',
                        '-ac', '1', '-ar', '44100', '-b:a', '64k', str(out)], capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit('ffmpeg 실패: ' + r.stderr)
    return 'data:audio/mpeg;base64,' + base64.b64encode(out.read_bytes()).decode('ascii')

def main():
    with tempfile.TemporaryDirectory() as d:
        d = pathlib.Path(d)
        clock = clip(SRC, START, LEN, 0.005, 0.04, d / 'clock.mp3')
        siren = clip(SIREN, SIREN_START, SIREN_LEN, 0.25, 1.2, d / 'siren.mp3')
    OUT.write_text(
        '/* 자동 생성(tools/make_sounds.py) — 손으로 고치지 않는다.\n'
        ' * 시계 초침: 원본 3.13초부터 1초(톡-틱-틱 한 주기) · 사이렌: 10.5초부터 3.5초. 모노 64kbps mp3 */\n'
        '(function (root) {\n'
        "  var S = { clock: '" + clock + "', siren: '" + siren + "' };\n"
        "  if (typeof module !== 'undefined') module.exports = S; else root.Team3Sounds = S;\n"
        "})(typeof window !== 'undefined' ? window : this);\n", encoding='utf-8')
    print('효과음: src/sounds.js (%d bytes)' % OUT.stat().st_size)

if __name__ == '__main__':
    main()
