"""
배경음(BGM) 만들기: 세 녹음을 한 곡으로 섞고, 끊김 없이 되풀이되는 60초 고리(loop)로 만든다.

  재료(assets/sounds/)
    building  : 98초 낮은 긴장 드론(거의 일정, 24kHz 녹음이라 고역이 없다)  → 바닥(bed)
    ambience  : 앞 13초만 소리가 있는 높은 긴장 앰비언스(낮은 쪽이 셈)      → 질감·맥박(texture)
    siren     : 48초, 10~38초가 고른 사이렌(약 240Hz 울림)               → 멀리 지나가는 사이렌(accent)

  세 재료가 모두 저음이 세서 그냥 겹치면 뭉개진다 → 자리를 나눈다
    building : 저음(30~250Hz)을 맡는다. 250Hz 부근을 살짝 덜어 탁함을 줄인다.
    ambience : 140Hz 아래를 덜어 저음은 building 에 맡기고, 300Hz 탁함을 덜고, 3kHz 를 살짝 살린다.
               13초 조각을 2.5초씩 겹쳐(교차 페이드) 이어 붙여 길게 만든다.
    siren    : 250Hz 아래·6kHz 위를 자르고, 메아리(반사음)를 더해 멀리서 들리게, 좌우로 천천히 흔들리게.
               고리 안에서 18초에 서서히 다가왔다가 45초쯤 멀어진다(작게, 바닥 위에 얹힌 정도).

  마무리: 살짝 눌러(컴프레서) 고르게 → 66초를 만든 뒤 마지막 6초를 처음 6초에 겹쳐(등전력 교차) 60초 고리
          → 효과음보다 뒤에 깔리도록 -20 LUFS, 최고 -2 dBTP 로 맞춘다(2단계 loudnorm).
  결과: assets/sounds/bgm-tension.mp3(160kbps 스테레오, 60초 고리)
"""
import json, pathlib, subprocess, sys, tempfile, wave
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
S = ROOT / 'assets/sounds'
SR = 48000
LOOP, XF = 60.0, 6.0          # 고리 길이, 이음새 교차 길이(초)
TOTAL = LOOP + XF

def ff(args):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-y'] + args, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit('ffmpeg 실패: ' + r.stderr[-800:])
    return r

def stem(src, filt, out):
    ff(['-i', str(src), '-af', filt + f',aresample={SR}', '-ac', '2', '-ar', str(SR), '-c:a', 'pcm_f32le', str(out)])

def read(path):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True)
    x = np.frombuffer(r.stdout, dtype=np.float32).reshape(-1, 2).astype(np.float64)
    n = int(TOTAL * SR)
    if len(x) < n: x = np.vstack([x, np.zeros((n - len(x), 2))])
    return x[:n]

def db(v): return 10 ** (v / 20)

def main():
    for f in ('bgm-src-building.mp3', 'bgm-src-ambience.mp3', 'bgm-src-siren.mp3'):
        if not (S / f).exists(): sys.exit('재료가 없다: ' + f)
    with tempfile.TemporaryDirectory() as d:
        d = pathlib.Path(d)
        # 1) building: 바닥 드론
        stem(S / 'bgm-src-building.mp3',
             f'atrim=2:{2 + TOTAL},asetpts=N/SR/TB,highpass=f=30,lowpass=f=9000,'
             'equalizer=f=250:t=q:w=1.2:g=-3,equalizer=f=60:t=q:w=1:g=1.5', d / 'build.wav')
        # 2) ambience: 13초 조각을 교차 페이드로 6번 이어 붙인다(13 + 5×10.5 = 65.5초 → 66초까지 마지막 조각 끝을 이어 둔다)
        piece = 'atrim=0.4:13.4,asetpts=N/SR/TB'
        inputs, chains = [], []
        for i in range(7):
            inputs += ['-i', str(S / 'bgm-src-ambience.mp3')]
            chains.append(f'[{i}:a]{piece}[p{i}]')
        cur = 'p0'
        for i in range(1, 7):
            chains.append(f'[{cur}][p{i}]acrossfade=d=2.5:c1=qsin:c2=qsin[c{i}]'); cur = f'c{i}'
        chains.append(f'[{cur}]atrim=0:{TOTAL},highpass=f=140,equalizer=f=300:t=q:w=1:g=-4,'
                      f'equalizer=f=3000:t=q:w=1:g=2,lowpass=f=11000,aresample={SR}[out]')
        ff(inputs + ['-filter_complex', ';'.join(chains), '-map', '[out]', '-ac', '2', '-ar', str(SR), '-c:a', 'pcm_f32le', str(d / 'amb.wav')])
        # 3) siren: 고른 구간 27초 → 대역 좁히고 메아리·천천히 좌우 → 18초에 들어와 45초에 끝
        stem(S / 'bgm-src-siren.mp3',
             f'atrim=10.5:37.5,asetpts=N/SR/TB,highpass=f=250,lowpass=f=6000,'
             'aecho=0.8:0.75:140|310|520:0.35|0.25|0.15,apulsator=hz=0.07:amount=0.45,'
             f'afade=t=in:st=0:d=7,afade=t=out:st=17:d=10,adelay=18000|18000,apad=whole_dur={TOTAL}', d / 'siren.wav')
        b, a, s = read(d / 'build.wav'), read(d / 'amb.wav'), read(d / 'siren.wav')
        # 각 재료를 같은 크기 기준(RMS)으로 맞춘 뒤 비율을 준다: 바닥 0dB, 질감 -5dB, 사이렌 -9dB
        def norm(x):
            r = np.sqrt((x ** 2).mean())
            return x / r if r > 0 else x
        mix = norm(b) * db(0) + norm(a) * db(-5) + norm(s[: len(b)]) * db(-9) * (np.sqrt((s ** 2).mean()) > 0)
        # 4) 이음새: 마지막 6초를 처음 6초에 등전력으로 겹쳐 60초 고리
        n, x = int(LOOP * SR), int(XF * SR)
        t = np.linspace(0, np.pi / 2, x)[:, None]
        loop = mix[:n].copy()
        loop[:x] = mix[:x] * np.sin(t) + mix[n:n + x] * np.cos(t)
        loop /= np.abs(loop).max() * 1.05
        raw = d / 'loop.wav'
        with wave.open(str(raw), 'wb') as w:
            w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes((loop * 32767).astype('<i2').tobytes())
        # 5) 살짝 누르고, 두 번에 걸쳐 -20 LUFS 로 맞춘다
        pre = 'acompressor=threshold=-18dB:ratio=2:attack=40:release=400:makeup=1'
        r = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(raw), '-af', pre + ',loudnorm=I=-20:TP=-2:LRA=7:print_format=json', '-f', 'null', '-'],
                           capture_output=True, text=True)
        m = json.loads(r.stderr[r.stderr.rindex('{'):])
        ln = (f"loudnorm=I=-20:TP=-2:LRA=7:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
              f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
        ff(['-i', str(raw), '-af', pre + ',' + ln + f',aresample={SR}', '-ar', str(SR), '-b:a', '160k', str(S / 'bgm-tension.mp3')])
    print('배경음: assets/sounds/bgm-tension.mp3')

if __name__ == '__main__':
    main()
