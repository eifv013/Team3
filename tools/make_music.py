"""
배경 음악 만들기: 원곡(assets/music/src/) → 게임용 고리(loop) 음악 3곡(assets/music/*.mp3) + src/music.js(곡 정보)

  곡             쓰는 곳                 원곡                                   처리
  office  사무실·튜토리얼·결과   Trouble Makers (Matthew Pablo, CC BY 3.0) 원곡 묶음의 고리판(40.4초)이라 자르지 않고 크기만 맞춘다
  field   현장 출동(평소)         Cinematic Suspense Series Ep. 009       소리가 나기 시작하는 곳부터. 앞 인트로는 한 번만,
                                  (Sascha Ende, CC BY 4.0, 120 BPM)       그 뒤 구간을 마디 단위로 되풀이한다
  boss    주범 조 출동            More Trigger Fish Attack                 뒤쪽 액션 부분은 너무 정신없어서 앞 40초 정도(잠입 부분)만 쓴다.
                                  (Sascha Ende, CC BY 4.0, 100 BPM)       1.7~38.54초, 19.25초~끝을 8마디로 되풀이(0.1.17, 후보 A로 정함).
                                                                          처음 고른 9초는 크게 치는 박자라 조용한 끝에서 넘어갈 때 어색했다
                                                                          → 크기·음색이 끝과 닮은 19.25초로 옮기고 교차를 1.5초로 늘렸다

  고리 만드는 법(되풀이 구간 [S, E)):
    E 에서 S 로 돌아갈 때 끊기지 않게, 파일의 [E-XF, E] 를 "원래 소리(줄어듦) + S 바로 앞 소리(커짐)"로 바꾼다.
    그러면 E 에 닿는 순간 소리는 이미 S 바로 앞과 같고, S 로 뛰어도 그대로 이어진다. 첫 재생은 끝부분 말고는 원곡 그대로다.
    E 는 "S + 마디 수 × 마디 길이" 근처(±0.25초)에서 S 뒤 4초와 소리 모양(어택 흐름)이 가장 닮은 곳으로 정한다.
  크기: 효과음 아래에 깔리도록 곡마다 LUFS 를 맞춘다(2단계 loudnorm). 마지막 크기는 게임 안 볼륨(BGM_GAIN)으로 한 번 더 정한다.
  파일 이름에 내용 해시를 붙인다 → 서비스 워커가 한 번 받은 곡을 버전이 바뀌어도 다시 받지 않는다(곡이 바뀌면 이름이 바뀜).
"""
import hashlib, json, pathlib, subprocess, sys, tempfile, wave
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets/music/src'
OUT = ROOT / 'assets/music'
META = ROOT / 'src/music.js'
SR = 44100

TRACKS = [
    # name, 원곡, 시작(초), 되풀이 시작 S(초, 원곡 기준), 마디 수, BPM(한 마디 4박), 목표 LUFS, 교차(초), 출처 표기
    dict(name='office', src='trouble-makers-loopable.flac', start=0.0, whole=True, lufs=-21,
         # OpenGameArt 에 CC-BY 3.0 으로 올라온 곡. 작곡가가 게임에 요청하는 표기: "Music by Matthew Pablo www.matthewpablo.com"
         credit={'title': 'Trouble Makers (Cool/Riff-Jazz)', 'artist': 'Music by Matthew Pablo', 'license': 'CC BY 3.0',
                 'url': 'www.matthewpablo.com · https://opengameart.org/content/trouble-makers-coolriff-jazz'}),
    dict(name='field', src='cinematic-suspense-009.mp3', start=None, loop_at=14.0, bars=44, bpm=120.0, lufs=-20, xf=1.5,
         credit={'title': 'Cinematic Suspense Series Episode 009', 'artist': 'Sascha Ende', 'license': 'CC BY 4.0',
                 'url': 'https://ende.app/en/song/8224-cinematic-suspense-series-episode-009'}),
    dict(name='boss', src='more-trigger-fish-attack.mp3', start=None, loop_at=19.25, loop_end=38.54, bars=8, bpm=99.75, lufs=-19, xf=1.5,
         credit={'title': 'More Trigger Fish Attack', 'artist': 'Sascha Ende', 'license': 'CC BY 4.0',
                 'url': 'https://ende.app/en/song/13674-more-trigger-fish-attack'}),
]

def run(args, **kw):
    r = subprocess.run(args, capture_output=True, **kw)
    if r.returncode != 0:
        sys.exit('실패: ' + ' '.join(map(str, args[:6])) + '\n' + r.stderr.decode('utf-8', 'replace')[-800:])
    return r

def decode(path):
    """원곡 전체를 44.1kHz 스테레오 float 로 읽는다."""
    raw = run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-']).stdout
    x = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)
    if len(x) < SR:
        sys.exit('원곡이 너무 짧거나 읽지 못했다: ' + str(path))
    return x

def first_sound(x, thresh_db=-45):
    """소리가 처음 -45dBFS 를 넘는 곳(초). 앞 무음을 버리는 데 쓴다. 10ms 앞에서 자른다."""
    th = 10 ** (thresh_db / 20)
    idx = np.argmax(np.abs(x).max(axis=1) > th)
    return max(0.0, idx / SR - 0.01)

def onset_env(x, a, b):
    """[a, b) 초 구간의 어택 흐름(짧은 창 에너지의 로그 증가분). 박자 맞추기용"""
    m = x[int(a * SR):int(b * SR)].mean(axis=1)
    h = 512
    n = len(m) // h
    e = np.log1p((m[:n * h].reshape(n, h) ** 2).sum(axis=1) * 1000)
    o = np.maximum(0, np.diff(e))
    return (o - o.mean()) / (o.std() + 1e-9)

def find_loop_end(x, S, bars, bpm):
    """E 를 S + 마디 × 마디 길이 근처(±0.25초, 5ms 간격)에서 S 뒤 4초와 어택 흐름이 가장 닮은 곳으로."""
    target = S + bars * 4 * 60.0 / bpm
    ref = onset_env(x, S, S + 4)
    best, bestE = -1e9, target
    for E in np.arange(target - 0.25, target + 0.25, 0.005):
        if E + 4 > len(x) / SR:
            break
        c = onset_env(x, E, E + 4)
        n = min(len(c), len(ref))
        score = float(np.dot(ref[:n], c[:n]) / n)
        if score > best:
            best, bestE = score, E
    if bestE + 0.01 > len(x) / SR:
        sys.exit('되풀이 끝이 원곡 길이를 넘는다')
    return bestE, best

def make_loop(x, start, S, E, xf):
    """[start, E) 를 잘라 끝 xf 초를 S 바로 앞 소리로 교차시킨 배열과, 파일 기준 되풀이 시작(초)을 돌려준다."""
    if not (start <= S - xf and S < E):
        sys.exit(f'되풀이 구간이 이상하다: start={start} S={S} E={E} xf={xf}')
    a, s, e, n = int(start * SR), int(S * SR), int(E * SR), int(xf * SR)
    y = x[a:e].copy()
    t = np.linspace(0, np.pi / 2, n)[:, None]
    # 등전력 교차: 끝은 줄고(cos), S 바로 앞 소리는 커진다(sin)
    y[-n:] = x[e - n:e] * np.cos(t) + x[s - n:s] * np.sin(t)
    if start > 0:   # 중간에서 시작하는 곡은 첫 0.25초를 살짝 열어 '툭' 하고 끊기는 소리를 없앤다
        f = int(0.25 * SR)
        y[:f] *= np.linspace(0, 1, f)[:, None]
    return y, (s - a) / SR

def write_wav(path, y):
    peak = np.abs(y).max()
    if peak > 0.999:
        y = y / peak * 0.999
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(y, -1, 1) * 32767).astype('<i2').tobytes())

def loudnorm_mp3(wav, mp3, lufs):
    """2단계 loudnorm 으로 목표 LUFS(최고 -1.5 dBTP)에 맞춰 mp3(128kbps)로. LAME 헤더가 붙어 앞뒤 빈 소리가 잘려 재생된다."""
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(wav), '-af', f'loudnorm=I={lufs}:TP=-1.5:LRA=11:print_format=json',
                        '-f', 'null', '-'], capture_output=True, text=True)
    try:
        m = json.loads(r.stderr[r.stderr.rindex('{'):])
    except ValueError:
        sys.exit('loudnorm 측정 실패: ' + r.stderr[-400:])
    ln = (f"loudnorm=I={lufs}:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
          f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    run(['ffmpeg', '-v', 'error', '-y', '-i', str(wav), '-af', ln + f',aresample={SR}', '-ar', str(SR),
         '-c:a', 'libmp3lame', '-b:a', '128k', str(mp3)])

def main():
    for old in OUT.glob('*.mp3'):
        old.unlink()   # 해시 이름이 바뀌므로 예전 결과는 지운다
    meta = {}
    with tempfile.TemporaryDirectory() as d:
        d = pathlib.Path(d)
        for t in TRACKS:
            src = SRC / t['src']
            if not src.exists():
                sys.exit('원곡이 없다: ' + str(src))
            x = decode(src)
            if t.get('whole'):
                y, loop_start, info = x, 0.0, '원곡 그대로 되풀이'
            else:
                start = first_sound(x) if t['start'] is None else t['start']
                if t.get('loop_end'):   # 귀로 들어 보고 고른 끝 지점은 그대로 쓴다
                    E, score = t['loop_end'], float('nan')
                else:
                    E, score = find_loop_end(x, t['loop_at'], t['bars'], t['bpm'])
                y, loop_start = make_loop(x, start, t['loop_at'], E, t['xf'])
                how = '귀로 고름' if t.get('loop_end') else f'닮음 {score:.2f}'
                info = f'원곡 {start:.2f}~{E:.3f}초, 되풀이 {t["loop_at"]:.2f}~{E:.3f}초({t["bars"]}마디, {how})'
            wav = d / (t['name'] + '.wav')
            write_wav(wav, y)
            tmp = d / (t['name'] + '.mp3')
            loudnorm_mp3(wav, tmp, t['lufs'])
            data = tmp.read_bytes()
            fname = f"{t['name']}.{hashlib.sha1(data).hexdigest()[:8]}.mp3"
            (OUT / fname).write_bytes(data)
            meta[t['name']] = {'file': 'music/' + fname, 'loopStart': round(loop_start, 4),
                               'duration': round(len(y) / SR, 4), 'credit': t['credit']}
            print(f"{t['name']:6s} {fname}  {len(data) // 1024}KB  {len(y) / SR:.1f}초  {info}")
    META.write_text(
        '/* 자동 생성(tools/make_music.py) — 손으로 고치지 않는다.\n'
        ' * 배경 음악 곡 정보: 파일(배포 폴더 기준 상대 경로), 되풀이 시작(초), 길이(초), 출처 */\n'
        '(function (root) {\n'
        '  var M = ' + json.dumps(meta, ensure_ascii=False, indent=2).replace('\n', '\n  ') + ';\n'
        "  if (typeof module !== 'undefined') module.exports = M; else root.Team3Music = M;\n"
        "})(typeof window !== 'undefined' ? window : this);\n", encoding='utf-8')
    print('곡 정보: src/music.js')

if __name__ == '__main__':
    main()
