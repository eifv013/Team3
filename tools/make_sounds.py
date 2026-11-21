"""
효과음 파일 → src/sounds.js (게임 한 파일 안에 data URI 로 넣는다. 오프라인·PWA 에서도 그대로 동작)

시계 초침(clock): 원본(assets/sounds/clock-ticking-source.mp3)은 1초마다 "톡(.14) - 틱(.64) - 틱(.89)"이 되풀이된다.
  3.13초부터 정확히 1초(한 주기)를 잘라, 앞 5ms·뒤 40ms 를 부드럽게 줄이고, 모노 64kbps mp3 로 만든다.
  출동 마지막 10초 동안 초가 바뀔 때마다 이 1초를 한 번 튼다 → 원본의 리듬이 그대로 이어진다.
"""
import base64, subprocess, sys, tempfile, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets/sounds/clock-ticking-source.mp3'
OUT = ROOT / 'src/sounds.js'
START, LEN = 3.13, 1.0

def main():
    if not SRC.exists():
        sys.exit('원본 소리가 없다: ' + str(SRC))
    with tempfile.TemporaryDirectory() as d:
        clip = pathlib.Path(d) / 'clock.mp3'
        r = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(START), '-t', str(LEN), '-i', str(SRC),
                            '-af', f'afade=t=in:st=0:d=0.005,afade=t=out:st={LEN - 0.04}:d=0.04',
                            '-ac', '1', '-ar', '44100', '-b:a', '64k', str(clip)], capture_output=True, text=True)
        if r.returncode != 0:
            sys.exit('ffmpeg 실패: ' + r.stderr)
        b64 = base64.b64encode(clip.read_bytes()).decode('ascii')
    OUT.write_text(
        '/* 자동 생성(tools/make_sounds.py) — 손으로 고치지 않는다.\n'
        ' * 시계 초침: 원본 3.13초부터 1초(톡-틱-틱 한 주기), 모노 64kbps mp3 */\n'
        '(function (root) {\n'
        "  var S = { clock: 'data:audio/mpeg;base64," + b64 + "' };\n"
        "  if (typeof module !== 'undefined') module.exports = S; else root.Team3Sounds = S;\n"
        "})(typeof window !== 'undefined' ? window : this);\n", encoding='utf-8')
    print('효과음: src/sounds.js (%d bytes)' % OUT.stat().st_size)

if __name__ == '__main__':
    main()
