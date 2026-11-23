/*
 * 화면 — 현장 출동(퍼즐 한 판)과 튜토리얼. SuspectsCore 의 결과를 그리고 손맛(소리·진동·연출)을 붙인다.
 *
 * 게임은 하나(1.7): 방치형 사건 1. 첫 화면은 사무실(hub.js), 처음 하는 사람은 튜토리얼로 들어온다.
 *   (시제품이던 "쉬운 시작"·"노말" 판은 튜토리얼이 들어오면서 없앴다.)
 *   출동은 모자 하나로 시작해 잡을수록 특징이 늘고(1→4), 출동 설정은 사무실 장비가 정한다.
 *   셋째 조건 줄은 셋째 단계까지 보이다가 네 가지가 되면 "감식반" 장비가 있어야 보인다.
 *
 * hub.js 와는 window.SuspectsUI 로만 이야기한다(startRun / show / hooks).
 * 규칙 계산은 전부 core 가 하고, core 가 던지는 GameError 는 여기서 모두 잡아 판이 멈추지 않게 한다.
 */
(function () {
  'use strict';
  var C = window.SuspectsCore;
  var $ = function (id) { return document.getElementById(id); };
  var now = function () { return performance.now(); };

  /* ---------- 저장(없어도 동작) ---------- */
  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* 저장 불가 환경: 무시 */ } }
  };
  /*
   * 설정(0.1.18, settings.js): 음악 크기 · 효과음 크기(0~100) · 진동. 예전 소리 끔 단추는 설정 창으로 바뀌었다.
   *   음악·효과음이 둘 다 0 이면 소리 장치를 아예 만들지 않는다.
   */
  var ST = window.Team3Settings;
  var settings = ST ? ST.load(store) : { music: 50, sfx: 50, vibrate: true };
  function curve(v) { return ST ? ST.gain(v) : v / 100; }
  function silent() { return settings.music === 0 && settings.sfx === 0; }

  /* ---------- 소리: 파일 없이 WebAudio 로 합성 ---------- */
  /*
   * 모든 소리는 master 를 거쳐 나간다(0.1.2): 전체 크기 2배(MASTER_GAIN) → 리미터(컴프레서) → 스피커.
   *   소리가 작다는 의견으로 전체를 두 배로 키웠다. 여러 소리가 겹쳐도 찢어지지 않게 리미터로 위를 눌러 둔다.
   */
  // 0.1.20: 효과음 크기 50 에서 예전 기본(배수 2 × 0.8²≈1.28)의 2배 ≈ 2.5 가 되도록 5 × 0.5. 리미터가 찢어짐을 막는다
  // 0.1.21: 더 키워 달라는 의견으로 한 번 더 2배(5 → 10)
  var MASTER_GAIN = 15;   // 0.8.0: 효과음 전체 1.5배(10 → 15). 넘치는 건 뒤의 리미터가 누른다
  var ac = null, master = null;
  function audio() {
    if (silent()) return null;
    try {
      if (!ac) {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        var g = ac.createGain(), lim = ac.createDynamicsCompressor();
        g.gain.value = MASTER_GAIN * curve(settings.sfx);   // 효과음 크기는 master 에서 한 번에
        // 0.2.1: 효과음이 작다는 의견 — 리미터가 -6dB 에서 눌러 버려 배수를 올려도 커지지 않았다.
        //   누르는 선을 -1dB 로 올려 최대 크기를 약 1.8배(+5dB) 키운다(찢어지는 것은 여전히 리미터가 막는다)
        lim.threshold.value = -1; lim.knee.value = 2; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.12;
        g.connect(lim); lim.connect(ac.destination);
        master = g;
      }
      if (ac.state === 'suspended') ac.resume();
      loadSamples();
    } catch (e) { ac = null; master = null; }
    return ac;
  }
  function tone(freq, dur, type, vol, delay, slideTo, attack) {
    if (settings.sfx === 0) return;
    var a = audio(); if (!a) return;
    try {
      var t = a.currentTime + (delay || 0);
      var o = a.createOscillator(), g = a.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.2, t + (attack || 0.008));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master || a.destination);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* 소리 실패는 게임에 영향 없음 */ }
  }
  /*
   * 배경 음악(0.1.16, bgm.js). 효과음 리미터를 거치지 않고 따로 스피커로 간다(음악이 효과음을 눌러 출렁이지 않게).
   *   BGM_GAIN: 효과음 아래에 깔리는 크기. 곡 크기는 tools/make_music.py 에서 LUFS 로 맞춰 두었다.
   *   사람이 화면을 누를 때마다 wake → 막혀 있던 첫 곡이 이때 나온다(브라우저 자동 재생 정책).
   */
  // 0.1.20: 음악 크기 50 에서 예전 기본(0.55 × 0.7²≈0.27)의 2배 ≈ 0.55 가 되도록 1.1 × 0.5
  // 0.1.21: 한 번 더 2배(1.1 → 2.2). 큰 소리는 bgm.js 의 리미터가 누른다
  var BGM_GAIN = 3.3;   // 0.8.0: 배경음 1.5배(2.2 → 3.3)
  var music = window.Team3Bgm
    ? window.Team3Bgm.createPlayer({ context: function () { return audio(); }, music: window.Team3Music || {}, gain: BGM_GAIN * curve(settings.music) })
    : { want: function () {}, wake: function () {}, duck: function () {}, dim: function () {}, setVolume: function () {}, setMuted: function () {}, state: function () { return {}; } };
  music.setMuted(settings.music === 0);
  document.addEventListener('pointerdown', function () { try { music.wake(); } catch (e) { /* 무시 */ } }, true);
  // 앱을 내리거나 다른 탭을 보는 동안은 소리 장치를 쉬게 한다(배경에서 음악이 계속 나오지 않게)
  document.addEventListener('visibilitychange', function () {
    try {
      if (!ac) return;
      if (document.hidden) ac.suspend(); else if (!silent()) ac.resume();
    } catch (e) { /* 무시 */ }
  });

  /*
   * 녹음된 효과음(sounds.js 의 data URI). 처음 소리를 깨울 때 한 번만 풀어 둔다.
   *   못 풀면(오래된 기기·형식 미지원) buffers 가 비어 있고, 쓰는 쪽은 합성음으로 대신한다.
   */
  var buffers = {}, samplesAsked = false;
  function loadSamples() {
    if (samplesAsked || !ac || !window.Team3Sounds) return;
    samplesAsked = true;
    Object.keys(window.Team3Sounds).forEach(function (name) {
      try {
        var b64 = window.Team3Sounds[name].split(',')[1], bin = atob(b64), arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        // 옛 사파리는 decodeAudioData 가 Promise 를 안 돌려준다 → 콜백 방식으로 쓴다
        ac.decodeAudioData(arr.buffer, function (buf) { buffers[name] = buf; }, function () { /* 못 풀면 합성음 */ });
      } catch (e) { /* 무시: 합성음으로 대신 */ }
    });
  }
  // 녹음 효과음 한 번 재생. 성공하면 true(없거나 실패하면 false → 합성음으로 대신)
  function sample(name, vol) {
    if (settings.sfx === 0) return true;   // 효과음 0: 합성음으로 대신하지도 않는다
    var a = audio(); if (!a || !buffers[name]) return false;
    try {
      var s = a.createBufferSource(), g = a.createGain();
      s.buffer = buffers[name]; g.gain.value = vol;
      s.connect(g); g.connect(master || a.destination);
      s.start();
      return true;
    } catch (e) { return false; }
  }

  // 마림바 한 음: 사인파 + 아주 짧은 4배음(나무 막대로 친 느낌). 날카로운 파형(사각·톱니)을 쓰지 않는다.
  function mallet(f, vol, delay) {
    tone(f, 0.5, 'sine', vol, delay, null, 0.004);
    tone(f * 4, 0.08, 'sine', vol * 0.25, delay, null, 0.002);
  }
  var C4 = 262;
  function semi(n) { return Math.pow(2, n / 12); }

  /*
   * 소리(1.5, 후보 B "마림바"로 정함). 예전 소리는 높은 삼각파 "삑"과 고역 잡음이라 날카롭다는 의견이 있었다.
   *   고르기 : 부드러운 사인 한 음, 첫째·둘째·셋째가 솔 → 라 → 시로 올라간다. 크기 0.4(처음의 두 배).
   *   검거   : 마림바 두 음(도 → 미), 연속 검거가 쌓이면 반음씩 올라간다.
   *   단계 상승·검거 불가 적중·사기 : 마림바 세 음.
 *   틀림(오인 체포·검거 불가 오판) : 마림바 두 음이 내려간다.
 *   출동 끝 : 마림바 도-미-솔-도로 올라간다.
   */
  var sfx = {
    // 0.2.0: 진술서 타자 소리(아주 작게) · 뱃고동(주범 조, 사건 2)
    type: function () { tone(1900 + Math.random() * 300, 0.02, 'square', 0.025); },
    horn: function () { tone(98, 1.6, 'sawtooth', 0.16, 0, 92, 0.25); tone(147, 1.6, 'sine', 0.12, 0, 140, 0.25); },
    pick: function (n) { tone(392 * semi(Math.max(0, n - 1) * 2), 0.12, 'sine', 0.4, 0, null, 0.006); },   // 크기 0.2 → 0.4(두 배)
    // 고르기 취소(0.1.15): 방금 뺀 자리의 음에서 단3도 아래로 살짝 미끄러져 내려간다. 고르기보다 조금 작게
    unpick: function (n) { var f = 392 * semi(Math.max(0, n - 1) * 2); tone(f, 0.13, 'sine', 0.3, 0, f * semi(-3), 0.006); },
    /*
     * 검거: 둔한 "탁-칵" 두 번 + 둥근 두 음(으뜸음 → 5도 위).
     * 예전 소리(고역 통과 잡음 2.2~3.2kHz + 사각파)는 날카롭다는 의견이 있어 대역·파형·크기를 낮췄다.
     * 연속 검거가 쌓이면 음이 조금씩(반음 단위) 올라간다.
     */
    hit: function (combo) {
      var base = C4 * semi(Math.min(Math.max(combo, 1) - 1, 7));
      mallet(base, 0.22, 0);
      mallet(base * semi(4), 0.2, 0.09);
    },
    // 틀림(0.1.3): 마림바 두 음이 내려간다(솔 → 미♭). 맞힘(도 → 미, 올라감)과 반대라 귀로도 구분된다.
    //   예전 소리(톱니파 170→90Hz 미끄러짐)는 혼자만 거친 파형이라 이상하게 들렸다.
    miss: function () { mallet(C4 * semi(-5), 0.22, 0); mallet(C4 * semi(-9), 0.22, 0.12); },
    none: function () { [0, 4, 7, 12].forEach(function (n, i) { mallet(C4 * semi(n), 0.2, i * 0.08); }); },
    // 출동 끝: 마림바로 도-미-솔-도 올라가며 끝맺는다(보상 화면과 어울리게). 예전 삼각파 솔-미-도를 바꿨다.
    end: function () { [0, 4, 7, 12].forEach(function (n, i) { tone(C4 * semi(n), i === 3 ? 0.9 : 0.35, 'sine', 0.2, i * 0.1, null, 0.004); tone(C4 * semi(n) * 4, 0.08, 'sine', 0.05, i * 0.1, null, 0.002); }); },
    // 현장 출동: 마림바 경광등(높은 솔-도를 두 번 번갈아) — 출동 단추를 누르는 순간
    // 주범 조 출동(0.1.16): 녹음 사이렌(3.5초, 서서히 들어와 멀어짐). 못 풀었으면 예전 마림바 경보로 대신
    go: function () {
      if (sample('siren', 0.5)) return;
      [12, 7, 12, 7].forEach(function (n, i) { mallet(C4 * semi(n + 7), 0.26, i * 0.11); }); mallet(C4 * semi(-5), 0.3, 0);
    },
    coin: function () { mallet(C4 * semi(7), 0.18, 0); mallet(C4 * semi(12), 0.16, 0.07); },
    tickLow: function () { tone(880, 0.05, 'sine', 0.07); },
    // 시계 초침(0.1.14): 녹음된 "톡-틱-틱" 1초. 마지막 3초는 조금 크게. 녹음을 못 쓰면 예전 짧은 "삑"(5초 안쪽에서만)
    clock: function (left) {
      // 0.2.1: 초침이 다른 소리보다 커서 줄였다(0.7/1.0 → 0.3/0.45)
      // 0.8.0: 초침은 절반으로. 전체(master)가 1.5배가 됐으니 여기서 ÷3 → 들리는 크기는 예전의 절반(0.3/0.45 → 0.1/0.15)
      if (sample('clock', left <= 3 ? 0.15 : 0.1)) return;
      if (left <= 5) tone(880, 0.05, 'sine', 0.07 / 3);
    }
  };
  // 진동: 설정에서 끄면 아무것도 안 한다(0.1.18). 진동 없는 기기도 조용히 넘어간다
  function buzz(ms) { if (!settings.vibrate) return; try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* 무시 */ } }

  /* ---------- 용의자 그림 ----------
   * 네 속성이 각각 다른 자리에 있어 따로 눈에 들어온다.
   *   시간대 = 카드 바탕 + 왼쪽 위 칩 / 모자 = 머리 / 얼굴 = 얼굴 소품(하늘색) / 흔적 = 오른쪽 아래 원
   * 아직 안 보는 속성(active 에 없음)은 그리지 않는다: 시간대는 무늬 없는 회색 바탕, 흔적 원은 없음,
   * 모자·얼굴은 맨머리·맨얼굴. 색만으로 구분하지 않도록 모든 속성은 모양이 다르다.
   */
  var BG = ['#F4EFE2', '#E4A97C', '#2F3646'], FG = ['#1B1E24', '#1B1E24', '#EDE7D9'];
  var PLAIN_BG = '#D9D6CE';
  var TIME_CHIP = ['rgba(255,255,255,.7)', 'rgba(255,255,255,.45)', 'rgba(255,255,255,.1)'];
  var TIME_INK = ['#C46A00', '#9A2E12', '#F3E2A0'];
  var SKY = '#9CD3F2', SKY_DARK = '#4F86A8';

  function timeIcon(t) {
    if (t === 0) {
      var rays = '';
      for (var a = 0; a < 360; a += 45) rays += '<line x1="12" y1="1.8" x2="12" y2="4.6" transform="rotate(' + a + ' 12 12)"/>';
      return '<circle cx="12" cy="12" r="4.4" fill="currentColor"/>' + rays;
    }
    if (t === 1) {
      return '<path d="M5.5 16a6.5 6.5 0 0 1 13 0z" fill="currentColor"/><line x1="2" y1="16" x2="22" y2="16"/>' +
        '<line x1="12" y1="5" x2="12" y2="7.2"/><line x1="4.6" y1="8.6" x2="6.2" y2="10.2"/><line x1="19.4" y1="8.6" x2="17.8" y2="10.2"/>' +
        '<line x1="6" y1="19.5" x2="18" y2="19.5" opacity=".55"/>';
    }
    return '<path d="M16.5 15.5A7 7 0 1 1 10 4.5a5.5 5.5 0 0 0 6.5 11z" fill="currentColor"/>' +
      '<path d="M18.5 4.5l.7 1.5 1.5.7-1.5.7-.7 1.5-.7-1.5-1.5-.7 1.5-.7z" fill="currentColor" stroke="none"/>';
  }
  function markIcon(m) {
    if (m === 0) return '<path d="M7 17c-1-1.6-1.5-3.3-1.5-5a6.5 6.5 0 0 1 13 0c0 1.3-.2 2.6-.6 3.8"/><path d="M9.5 18.5c-.9-1.9-1.4-3.8-1.4-6a3.9 3.9 0 0 1 7.8 0c0 2.6-.5 4.6-1.4 6.6"/><path d="M12 12.3v1.2c0 2.2.5 4 1.3 5.5"/>';
    if (m === 1) return '<path d="M5 19L9.5 4l3 7.5-2.5 1z" fill="currentColor"/><path d="M13.5 20l2-8 4 3.5z" fill="currentColor"/>';
    return '<path d="M5 8l3.5-3 3.5 3 3.5-3L19 8"/><path d="M5 13.5l3.5-3 3.5 3 3.5-3 3.5 3"/><path d="M5 19l3.5-3 3.5 3 3.5-3 3.5 3"/>';
  }
  // 사람 실루엣(100×100). fg = 실루엣 색, bg = 카드 바탕(파낸 부분)
  function figure(h, f, fg, bg) {
    var s = '<path d="M14 100c0-21 15-31 36-31s36 10 36 31z" fill="' + fg + '"/>' +
            '<circle cx="50" cy="48" r="19" fill="' + fg + '"/>';
    if (f !== 1) s += '<circle cx="43" cy="46.5" r="2.8" fill="' + bg + '"/><circle cx="57" cy="46.5" r="2.8" fill="' + bg + '"/>';
    if (f === 0) s += '<path d="M44.5 56q5.5 3.5 11 0" fill="none" stroke="' + bg + '" stroke-width="2.4" stroke-linecap="round"/>';
    if (f === 1) {
      s += '<circle cx="42" cy="47" r="7" fill="' + SKY + '" stroke="' + bg + '" stroke-width="3"/>' +
           '<circle cx="58" cy="47" r="7" fill="' + SKY + '" stroke="' + bg + '" stroke-width="3"/>' +
           '<line x1="49" y1="47" x2="51" y2="47" stroke="' + bg + '" stroke-width="3"/>' +
           '<path d="M45 57q5 2.5 10 0" fill="none" stroke="' + bg + '" stroke-width="2.4" stroke-linecap="round"/>';
    }
    if (f === 2) {
      s += '<path d="M34 52.5l-4.5-5.5M66 52.5l4.5-5.5" stroke="' + SKY + '" stroke-width="2.4" stroke-linecap="round"/>' +
           '<path d="M33.5 51h33v6.5c0 6.5-7.5 10-16.5 10s-16.5-3.5-16.5-10z" fill="' + SKY + '" stroke="#1B1E24" stroke-width="1.4"/>' +
           '<path d="M37 56h26M38 60.5h24" stroke="' + SKY_DARK + '" stroke-width="1.6" stroke-linecap="round"/>';
    }
    // 모자: 아래끝이 y≈40 을 넘지 않게 해서 안경(위끝 y=40)을 가리지 않는다
    if (h === 1) {
      // 비니(1.6, 예전 캡 모자): 둥근 몸통 + 골지 단 + 방울. 맨머리·중절모와 윤곽이 확실히 다르다
      s += '<path d="M31 38c0-13 8.5-21 19-21s19 8 19 21z" fill="' + fg + '" stroke="' + bg + '" stroke-width="2.4"/>' +
           '<rect x="29.5" y="33" width="41" height="7.5" rx="3" fill="' + fg + '" stroke="' + bg + '" stroke-width="2.4"/>';
      for (var r = 35; r <= 65; r += 6) s += '<line x1="' + r + '" y1="34.6" x2="' + r + '" y2="38.9" stroke="' + bg + '" stroke-width="1.4"/>';
      s += '<circle cx="50" cy="15" r="5" fill="' + fg + '" stroke="' + bg + '" stroke-width="2.4"/>';
    }
    if (h === 2) {
      s += '<path d="M33.5 36l3.5-17.5q6.5-3 13 0q6.5-3 13 0L66.5 36z" fill="' + fg + '" stroke="' + bg + '" stroke-width="2.5"/>' +
           '<path d="M35 31.5h30" stroke="' + bg + '" stroke-width="3"/>' +
           '<path d="M16 37h68" stroke="' + fg + '" stroke-width="6.5" stroke-linecap="round"/>';
    }
    return s;
  }

  var ALL = [0, 1, 2, 3];
  // 그릴 때 필요한 것: 보는 속성만 남긴 값과 바탕·글자 색
  function look(id, active) {
    var act = active || ALL, v = C.project(id, act);
    var showTime = act.indexOf(0) >= 0, showMark = act.indexOf(3) >= 0;
    return { v: v, showTime: showTime, showMark: showMark, bg: showTime ? BG[v[0]] : PLAIN_BG, fg: showTime ? FG[v[0]] : FG[0] };
  }
  function describe(id, active) {
    var act = active || ALL, v = C.decode(id);
    return act.map(function (i) { return C.ATTRS[i].values[v[i]]; }).join(', ');
  }
  // 카드 한 장의 속 내용(번호는 판 위에서만)
  function cardInner(id, no, active) {
    var L = look(id, active), v = L.v;
    var stroke = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
    return (L.showTime ? '<span class="t" style="background:' + TIME_CHIP[v[0]] + ';color:' + TIME_INK[v[0]] + '"><svg width="20" height="20" viewBox="0 0 24 24" ' + stroke + '>' + timeIcon(v[0]) + '</svg></span>' : '') +
      (no ? '<span class="no" style="color:' + L.fg + '">' + no + '</span>' : '') +
      '<svg class="fig" viewBox="0 0 100 100" aria-hidden="true">' + figure(v[1], v[2], L.fg, L.bg) + '</svg>' +
      (L.showMark ? '<span class="m" style="background:' + L.fg + ';color:' + L.bg + ';box-shadow:0 0 0 2px ' + L.bg + '"><svg width="19" height="19" viewBox="0 0 24 24" ' + stroke + '>' + markIcon(v[3]) + '</svg></span>' : '') +
      '<span class="pick"></span>';
  }
  // 버튼으로 쓰는 카드 한 장(판·튜토리얼 공용)
  function cardButton(id, cls, attrs, no, active) {
    return '<button class="card ' + (cls || '') + '" ' + (attrs || '') + ' data-id="' + id + '" style="background:' + look(id, active).bg + '">' + cardInner(id, no, active) + '</button>';
  }

  var LEVEL_NAME = { 1: '모자만', 2: '모자·얼굴', 3: '3가지 대조', 4: '4가지 대조' };
  var LEVEL_UP = {
    2: ['새 단서: 얼굴', '안경·마스크도 맞춰요', '이제 얼굴(맨얼굴·안경·마스크)도 봐요. 모자와 따로따로 봐요'],
    3: ['새 단서: 시간대', '카드 색도 맞춰요', '이제 시간대(낮·저녁·밤, 카드 색과 왼쪽 위)도 봐요'],
    4: ['새 단서: 흔적', '오른쪽 아래 표시도', '이제 흔적(지문·유리 조각·타이어 자국)까지 네 가지예요']
  };

  /* ---------- 화면 전환 ---------- */
  var SCREENS = ['s-hub', 's-tutorial', 's-play', 's-result'];
  function show(id) {
    // 화면마다 배경 음악: 출동 = 평소 field / 주범 조 boss, 그 밖(사무실·튜토리얼·결과) = office
    try { music.duck(false); music.want(id === 's-play' ? (cfg && cfg.boss ? 'boss' : 'field') : 'office'); } catch (e) { /* 음악 실패는 무시 */ }
    SCREENS.forEach(function (s) {
      var el = $(s), on = s === id;
      el.classList.toggle('on', on);
      if (on) { el.classList.remove('in'); void el.offsetWidth; el.classList.add('in'); }   // 들어오는 효과를 매번 다시 재생
    });
    var el = $(id);
    if (el && el.scrollTo) el.scrollTo(0, 0);
  }

  var hooks = {};   // hub.js 가 채운다: home(), go(), onRunEnd(game) → html, onTutorialDone()

  // 처음 화면 = 사무실
  function goHome() {
    if (hooks.home) hooks.home(); else show('s-hub');
  }

  /* ---------- 현장 출동(퍼즐 한 판) ---------- */
  var game = null, cfg = null, sel = [], lock = false, raf = 0, lastSec = -1, hintTimer = 0;
  /*
   * 목격자 진술 모드(0.2.0, 사건 2). game.mode === 'witness' 이면 witness.js 의 판.
   *   시간(timeLeft·tick·pause·resume)은 core 함수를 그대로 쓴다(같은 모양의 필드).
   *   판 = game.q.board(9명, 어려움 12명), 한 명을 누르면 바로 판정. 단서 = 거짓 진술 짚기. 검거 불가 단추는 숨긴다.
   */
  var W = window.Team3Witness, FX = window.Team3Fx, F = window.Team3Forgery;
  function WM() { return !!(game && game.mode === 'witness'); }
  // 위조된 한 패(0.2.1, 특별 출동): game.mode === 'forgery'. 판 = 세 명씩 지은 줄, 줄을 누르면 판정
  function FM() { return !!(game && game.mode === 'forgery'); }
  /*
   * 0.5.0 사건 3: 면통 라인업(game.mode === 'lineup', lineup.js) — 판 = 한 줄로 선 5~6명, 한 자리를 누르면 판정.
   *        특별 출동 몽타주 수배(game.mode === 'montage', montage.js) — 진술서 자리에 몽타주 종이, 판 = 카드 9~12장.
   */
  var LU = window.Team3Lineup, MT = window.Team3Montage;
  function LM() { return !!(game && game.mode === 'lineup'); }
  function MM() { return !!(game && game.mode === 'montage'); }
  function boardIds() { return WM() ? game.q.board : LM() ? game.q.line : MM() ? game.q.cards : FM() ? [].concat.apply([], game.q.rows) : game.board; }
  function actNow() { return WM() || MM() ? [0, 1, 2, 3] : LM() ? game.q.attrs : C.active(game); }
  // 멈춤 · 재개: 몽타주는 그림 시각도 함께 민다
  function gPause(g, t) { if (g.mode === 'montage') MT.pause(g, t); else C.pause(g, t); }
  function gResume(g, t) { if (g.mode === 'montage') MT.resume(g, t); else C.resume(g, t); }

  // 설정을 안 받았을 때의 기본값(사무실은 늘 장비를 반영한 설정을 넘긴다)
  function defaultConfig() {
    return { level: 1, duration: C.RULES.duration, freeHints: 0, nonePenalty: C.RULES.wrongNonePenalty, helperAtFull: false };
  }

  // 셋째 조건 줄: 네 가지 전까지는 늘, 네 가지가 되면 감식반이 있을 때만
  function helperOn() {
    if (!game) return false;
    return game.level < 4 || !!cfg.helperAtFull;
  }

  function renderBoard(entering) {
    var board = $('board'), stamp = $('stamp'), act = actNow();
    /*
     * 0.8.2 "검거!"가 엉뚱할 때 뜨던 버그: 판을 다시 그리면 도장 칸을 떼었다가 다시 붙이는데, 그때 'go'가 남아 있으면
     *   브라우저가 도장 애니메이션을 처음부터 또 튼다 → 틀렸을 때(판을 다시 그림) · 새 판이 시작될 때 지난 "검거!"가 다시 떴다.
     *   다 끝난 도장은 끄고, 아직 보이는 중인 도장(방금 검거)은 지난 만큼 앞당겨(음수 지연) 이어서 보여 준다.
     */
    keepStamp(stamp);
    board.classList.toggle('luboard', LM());
    board.classList.toggle('mtg', MM());
    if (LM()) { renderLineup(entering, act); return; }
    board.classList.toggle('forge', FM());
    if (FM()) {
      var fa = game.q.active;
      board.classList.remove('wit', 'w12');
      board.innerHTML = game.q.rows.map(function (row, r) {
        var real = game.cleared.indexOf(r) >= 0;
        return '<button class="rowbtn' + (real ? ' real' : '') + '" data-r="' + r + '" aria-label="' + (r + 1) + '번 줄' + (real ? ' (진짜로 확인됨)' : '') + '"><span class="rn">' + (r + 1) + '</span>' +
          row.map(function (id) { return '<span class="card mini" data-id="' + id + '" style="background:' + look(id, fa).bg + '">' + cardInner(id, 0, fa) + '</span>'; }).join('') +
          (real ? '<b class="real-tag">진짜</b>' : '') + '</button>';
      }).join('');
      board.appendChild(stamp);
      if (FX) FX.afterRender();
      board.setAttribute('data-level', String(game.level));
      $('btn-none').hidden = game.level !== 3;   // "위조 없음"은 여섯 줄 단계에서만
      return;
    }
    board.classList.toggle('wit', WM() || MM());
    board.classList.toggle('w12', (WM() || MM()) && boardIds().length > 9);
    var outs = MM() ? game.q.out : [];
    board.innerHTML = boardIds().map(function (id, i) {
      var cls = (entering && entering.indexOf(i) >= 0 ? 'enter' : '') + (outs.indexOf(i) >= 0 ? ' out' : '');
      return cardButton(id, cls, 'data-i="' + i + '" aria-pressed="false" aria-label="용의자 ' + (i + 1) + ': ' + describe(id, act) + '"', i + 1, act);
    }).join('');
    board.appendChild(stamp);
    if (FX) FX.afterRender();   // 안개·CCTV 겹 레이어를 카드 위로 다시
    board.setAttribute('data-level', String(game.level));   // 화면 시험이 지금 단계를 읽는 데 쓴다
    if (WM()) renderSays(false);
    if (MM()) renderPaper(!!entering);
    markPicks();
  }

  /* ---------- 사건 3 면통 라인업(0.5.0) ---------- */
  // 유리 너머 한 줄: 키 눈금 벽 · 번호판 · 지워진 자리(X). entering 이면 왼쪽부터 걸어 들어오고 진술을 새로 친다
  function renderLineup(entering, act) {
    // 줄만 감싼 칸(lu-wrap)만 다시 그린다: 도장 · 연출 레이어는 그대로 둬야 진행 중인 도장 애니메이션이 다시 재생되지 않는다
    var board = $('board'), q = game.q, n = q.line.length, wrap = board.querySelector('.lu-wrap');
    board.classList.remove('wit', 'w12', 'forge', 'dim');
    if (!wrap) {
      var stamp = $('stamp');
      keepStamp(stamp);
      board.innerHTML = '<div class="lu-wrap"></div>';
      board.appendChild(stamp);
      wrap = board.querySelector('.lu-wrap');
      if (FX) FX.afterRender();
    }
    wrap.innerHTML = '<div class="lu-marks" aria-hidden="true"><span>190</span><span>170</span><span>150</span><span>130</span></div>' +
      '<div class="lu-line n' + n + '" style="grid-template-columns:repeat(' + n + ',minmax(0,1fr))">' + q.line.map(function (id, i) {
        var out = q.out.indexOf(i) >= 0;
        return '<div class="lu-sp' + (out ? ' out' : '') + (entering ? ' enter' : '') + '" style="--d:' + (i * 70) + 'ms">' +
          cardButton(id, '', 'data-i="' + i + '" aria-label="' + (i + 1) + '번: ' + describe(id, act) + (out ? ' (아님)' : '') + '"' + (out ? ' disabled' : ''), null, act) +
          '<span class="plate">' + (i + 1) + '</span><b class="x" aria-hidden="true">✕</b><span class="lu-stamp" aria-hidden="true">검거</span></div>';
      }).join('') + '</div><div class="lu-floor" aria-hidden="true"></div>';
    board.setAttribute('data-level', String(game.level));
    renderLineupSays(!!entering);
  }
  // 목격자 말풍선. typing = 새 줄이면 한 줄씩 떠오른다. broke = 방금 지목한 자리와 어긋난 진술(빨갛게)
  function renderLineupSays(typing, broke) {
    var box = $('says'), q = game.q;
    box.classList.add('lu');
    box.classList.toggle('typing', !!typing);
    box.innerHTML = '<div class="lu-who" aria-hidden="true"><svg viewBox="0 0 100 100"><circle cx="50" cy="40" r="20" fill="#E8C7A8"/><path d="M14 100c0-22 16-34 36-34s36 12 36 34z" fill="#6C7A96"/><path d="M30 34q20-22 40 0" fill="#5A3A26"/><circle cx="43" cy="42" r="2.5" fill="#1B1E24"/><circle cx="57" cy="42" r="2.5" fill="#1B1E24"/></svg><small>목격자</small></div>' +
      '<div class="lu-list">' + q.says.map(function (x, i) {
        return '<div class="lu-say' + (broke && broke.indexOf(i) >= 0 ? ' broke' : '') + '" style="--d:' + (i * 420) + 'ms"><i>' + (i + 1) + '</i><span>' + LU.sayText(x, true) + '</span></div>';
      }).join('') + '</div>';
    if (typing) try { sfx.type(); } catch (e) { /* 무시 */ }
  }
  function judgeLineup(i) {
    var q0 = game.q, sps = $('board').querySelectorAll('.lu-sp'), r;
    try { r = LU.choose(game, i, now()); }
    catch (e) { if (e.code === 'GAME_OVER') finish(); else if (e.code !== 'ALREADY_OUT') setHint('판정 오류: ' + e.message, 'bad', 2000); return; }
    lock = true;
    var sp = sps[i];
    if (r.ok) {
      if (sp) sp.classList.add('right');
      $('board').classList.add('dim');
      sfx.hit(r.combo); buzz([12, 40, 20]);
      if (FX) FX.hit(sp ? [sp] : [], q0.line[i]);
      popStamp('검거!', '+' + r.gain + (r.combo > 1 ? '  ·  연속 ' + r.combo : ''));
      var ht = (game.mods && game.mods.hitTime != null ? game.mods.hitTime : LU.RULES.hitTime) + (game.hitBonus || 0);
      setHint(['맞아요, 저 사람이에요!', '틀림없어요!', '바로 저 사람!'][Math.floor(Math.random() * 3)] + (ht ? '  +' + ht + '초' : ''), 'good', 1100);
    } else {
      if (sp) { sp.classList.add('wrong'); }
      sfx.miss(); buzz(120);
      shakeFx();
      if (FX) FX.miss(sp ? [sp] : []);
      renderLineupSays(false, r.broke);
      var pen = r.shielded ? ' (변호사가 막았어요 · 벌점 없음)' : ' (−' + r.penalty + '초)';
      setHint('아니에요, ' + (i + 1) + '번은 진술 ' + r.broke.map(function (k) { return k + 1; }).join(' · ') + '번과 안 맞아요' + pen, 'bad', 2600);
      flashTimer();
    }
    updateHud(); bumpCombo();
    setTimeout(function () {
      lock = false;
      if (!game || game.over) { if (game) finish(); return; }
      if (!r.ok) {   // 그 자리만 X(줄 전체를 다시 그리지 않는다)
        if (sp) { sp.classList.remove('wrong'); sp.classList.add('out'); var cb = sp.querySelector('.card'); if (cb) { cb.disabled = true; cb.setAttribute('aria-label', cb.getAttribute('aria-label') + ' (아님)'); } }
        updateHud(); return;
      }
      renderBoard(game.q.line.map(function (_, k) { return k; }));
      if (r.levelUp) {
        var names = { 2: ['세 특징', '시간대도 봐요 · "아니었어요" 진술'], 3: ['여섯 명', '흔적까지 네 특징 · "옆에" 진술'], 4: ['진술 셋', '자리 관계가 둘 이상 섞여요'] }[r.levelUp];
        sfx.none(); buzz([30, 60, 30]);
        if (FX) FX.levelUp(r.levelUp);
        popStamp(names[0], names[1]);
        setHint(r.levelUp === 4 ? '진술 셋을 모두 만족하는 자리는 하나뿐이에요' : '진술을 하나씩 대 보며 아닌 자리를 지워 가세요', 'good', 3500);
      }
      updateHud();
    }, r.ok ? 760 : 650);
  }

  /* ---------- 특별 출동 몽타주 수배(0.5.0) ---------- */
  var paperShown = 0;
  // 몽타주 종이: 드러난 특징만 그린 범인(연필 그림) · 아직 안 그린 자리는 ? · 특징 목록 · 지금 배수 · 다음 특징까지 막대
  function renderPaper(fresh) {
    var box = $('says'), q = game.q, t = now(), act = MT.activeNow(game, t), sh = MT.shown(game, t), m = MT.multNow(game, t), nx = MT.nextIn(game, t);
    var newOne = sh > paperShown && !fresh;
    paperShown = sh;
    box.classList.add('mtg');
    var POS = ['t', 'h', 'f', 'm'], v = C.decode(q.ans);
    var qs = [0, 1, 2, 3].filter(function (a) { return act.indexOf(a) < 0; }).map(function (a) { return '<span class="mq ' + POS[a] + '">?</span>'; }).join('');
    var list = q.order.map(function (a, i) {
      return i < sh ? '<li class="' + (i === sh - 1 && (newOne || fresh) ? 'new' : '') + '">' + MT.word(a, v[a]) + '</li>' : '<li class="no">? ? ?</li>';
    }).join('');
    box.innerHTML = '<div class="mtg-paper' + (fresh ? ' in' : '') + '"><div class="mtg-pic"><span class="card" style="background:' + look(q.ans, act).bg + '">' + cardInner(q.ans, null, act) + '</span>' + qs + '<span class="mtg-stamp">검거</span></div>' +
      '<div class="mtg-side"><b class="mtg-mult' + (newOne ? ' drop' : '') + '">×' + m + '</b><ul>' + list + '</ul>' +
      (nx > 0 ? '<div class="mtg-next"><i style="animation-duration:' + nx + 'ms"></i></div>' : '<small class="mtg-all">다 그렸어요</small>') + '</div>' +
      (newOne || fresh ? '<span class="mtg-pencil" aria-hidden="true"></span>' : '') + '</div>';
    box.setAttribute('aria-label', '몽타주: ' + q.order.slice(0, sh).map(function (a) { return MT.word(a, v[a]); }).join(', ') + ' · 지금 고르면 ×' + m);
    if (newOne || fresh) try { sfx.type(); } catch (e) { /* 무시 */ }
  }
  function judgeMontage(i) {
    var cards = $('board').querySelectorAll('.card'), r;
    try { r = MT.choose(game, i, now()); }
    catch (e) { if (e.code === 'GAME_OVER') finish(); else if (e.code !== 'ALREADY_OUT') setHint('판정 오류: ' + e.message, 'bad', 2000); return; }
    lock = true;
    if (r.ok) {
      cards[i].classList.add('right');
      var pp = $('says').querySelector('.mtg-paper'); if (pp) pp.classList.add('caught');
      sfx.hit(r.combo); buzz([12, 40, 20]);
      popStamp(r.mult >= 3 ? '×' + r.mult + ' 빠른 검거!' : '검거!', '+' + r.gain);
      setHint(r.mult >= 3 ? '거의 보지도 않고 찾았어요!' : r.mult === 2 ? '빨랐어요!' : '다음엔 더 일찍 노려 보세요', 'good', 1100);
    } else {
      cards[i].classList.add('wrong');
      sfx.miss(); buzz(120); shakeFx();
      setHint('다른 사람이에요' + (r.shielded ? ' (변호사가 막았어요)' : ' (−' + r.penalty + '초)'), 'bad', 1800);
      flashTimer();
    }
    updateHud(); bumpCombo();
    setTimeout(function () {
      lock = false;
      if (!game || game.over) { if (game) finish(); return; }
      if (!r.ok) { renderBoard(); return; }
      paperShown = 0;
      renderBoard(game.q.cards.map(function (_, k) { return k; }));
      if (r.levelUp) { sfx.none(); buzz([30, 60, 30]); popStamp('12장', '닮은 얼굴이 많아져요'); setHint('특징 하나만 다른 사람이 섞여요. 서두르면 틀려요', 'good', 3000); }
      updateHud();
    }, r.ok ? 700 : 420);
  }

  // 고른 순서·단서 표시, 그리고 두 명을 골랐으면 셋째 조건 줄
  function markPicks() {
    var cards = $('board').querySelectorAll('.card');
    var clue = game && game.clue ? game.clue.set.slice(0, game.clue.shown) : [];
    for (var i = 0; i < cards.length; i++) {
      var k = sel.indexOf(i);
      cards[i].classList.toggle('sel', k >= 0);
      cards[i].classList.toggle('clue', clue.indexOf(i) >= 0 && k < 0);
      cards[i].setAttribute('aria-pressed', String(k >= 0));
      cards[i].querySelector('.pick').textContent = k >= 0 ? String(k + 1) : '';
    }
    if (FX && !WM() && !LM() && !MM()) FX.picks(sel);
    renderNeeds();
  }

  function renderNeeds() {
    var box = $('needs');
    if (!game || sel.length !== 2 || !helperOn()) {
      if (!box.hidden) { box.hidden = true; $('hint').hidden = false; }
      return;
    }
    var n = C.needs(game.board[sel[0]], game.board[sel[1]], C.active(game));
    box.innerHTML = n.map(function (x) {
      return '<div class="need"><b>' + x.value + '</b><small>' + x.name + ' · ' + (x.same ? '같게' : '남은 하나') + '</small></div>';
    }).join('');
    box.setAttribute('aria-label', '셋째 조건: ' + n.map(function (x) { return x.name + ' ' + x.value; }).join(', '));
    box.hidden = false;
    $('hint').hidden = true;
  }

  function setHint(text, kind, ms) {
    var h = $('hint');
    $('needs').hidden = true;
    h.hidden = false;
    h.textContent = text;
    h.className = 'hint' + (kind ? ' ' + kind : '');
    clearTimeout(hintTimer);
    if (ms) hintTimer = setTimeout(function () {
      h.textContent = LM() ? '진술에 모두 맞는 자리를 지목하세요' : MM() ? '몽타주와 같은 사람을 고르세요 · 일찍 고를수록 배수 ↑' : FM() ? '가짜 줄을 찾으세요' : WM() ? '진술 넷 중 딱 셋과 맞는 사람이 범인' : '한 패인 세 명을 고르세요'; h.className = 'hint';
      renderNeeds();
    }, ms);
  }

  var STAMP_MS = 900;   // .stamp.go 애니메이션 길이(template.html)
  function stopStamp(s) { s = s || $('stamp'); if (!s) return; s.classList.remove('go', 'bad'); s.innerHTML = ''; s.style.animationDelay = ''; clearTimeout(s._t); }
  function keepStamp(s) {
    if (!s) return;
    var el = Date.now() - (s._at || 0);
    if (s.classList.contains('go') && el < STAMP_MS) s.style.animationDelay = '-' + el + 'ms';
    else stopStamp(s);
  }
  function popStamp(main, small, bad) {
    var s = $('stamp');
    clearTimeout(s._t);
    s._at = Date.now(); s.style.animationDelay = '';
    s._t = setTimeout(function () { s.classList.remove('go'); }, STAMP_MS + 50);   // 다 보이고 나면 꺼 둔다(다시 붙여도 재생되지 않게)
    s.innerHTML = main + (small ? '<small>' + small + '</small>' : '');
    s.classList.toggle('bad', !!bad);
    s.classList.remove('go');
    void s.offsetWidth;
    s.classList.add('go');
  }

  function updateHud() {
    $('score').textContent = game.score.toLocaleString('ko-KR');
    var combo = $('combo');
    combo.textContent = game.combo > 1 ? '연속 ' + game.combo + ' · ×' + C.multiplierFor(game.combo, game.mods && game.mods.comboMax) : '연속 ' + game.combo;
    combo.classList.toggle('live', game.combo > 1);
    var lv = $('level');
    if (LM()) {
      var ln = LU.RULES.levelAt[game.level + 1];
      lv.textContent = '면통 ' + game.level + '단계 · ' + LU.LEVEL_NAME[game.level] + (ln != null ? ' · 다음까지 ' + Math.max(0, C.hitsFor(game, ln) - game.hits) + '명' : '');
      lv.classList.toggle('up', game.level === 4);
    } else if (MM()) {
      var mn = MT.RULES.levelAt[game.level + 1];
      lv.textContent = '몽타주 · ' + MT.LEVEL_NAME[game.level] + (mn != null ? ' · 다음까지 ' + Math.max(0, C.hitsFor(game, mn) - game.hits) + '명' : '');
      lv.classList.toggle('up', game.level === 2);
    } else if (FM()) {
      var fn = F.RULES.levelAt[game.level + 1];
      lv.textContent = '위조 감별 · ' + F.LEVEL_NAME[game.level] + (fn != null ? ' · 다음까지 ' + Math.max(0, C.hitsFor(game, fn) - game.hits) + '명' : '');
      lv.classList.toggle('up', game.level === 3);
    } else if (WM()) {
      var wn = W.RULES.levelAt[game.level + 1];
      lv.textContent = '목격자 ' + W.LEVEL_NAME[game.level] + (wn != null ? ' · 다음까지 ' + Math.max(0, C.hitsFor(game, wn) - game.hits) + '명' : '');
      lv.classList.toggle('up', game.level === 3);
    } else {
      var next = C.RULES.levelAt[game.level + 1];
      lv.textContent = LEVEL_NAME[game.level] + (game.level < 4 && next != null ? ' · 다음까지 ' + Math.max(0, C.hitsFor(game, next) - game.hits) + '명' : '');
      lv.classList.toggle('up', game.level === 4);
    }
    var f = $('free-n');
    f.hidden = !(game.freeHints > 0);
    f.textContent = String(game.freeHints);
    $('btn-hint').setAttribute('aria-label', game.freeHints > 0 ? '단서 보기 (무료 ' + game.freeHints + '번)' : '단서 보기 (' + (game.mods && game.mods.hintPenalty != null ? game.mods.hintPenalty : 3) + '초 줄어듦)');
    $('stat-line').textContent = LM() ? '지목 ' + game.hits + ' · 오인 ' + game.misses
      : MM() ? '검거 ' + game.hits + ' · 빠른 검거(×3 이상) ' + game.early + ' · 틀림 ' + game.misses
      : FM()
      ? '찾음 ' + game.hits + ' · 위조 없음 적중 ' + game.noneHits + ' · 틀림 ' + (game.misses + game.noneMisses)
      : WM()
      ? '검거 ' + game.hits + ' · 함정 ' + game.traps + ' · 오인 ' + game.misses
      : '검거 ' + game.hits + ' · 불가 적중 ' + game.noneHits + ' · 실수 ' + (game.misses + game.noneMisses);
  }

  var quietUntil = 0;   // 판정 소리가 나는 동안은 초침을 쉰다
  function bumpCombo() {
    quietUntil = performance.now() + 350;
    var c = $('combo');
    c.classList.add('pop');
    setTimeout(function () { c.classList.remove('pop'); }, 150);
  }
  function flashTimer() {
    quietUntil = performance.now() + 350;
    var t = $('timer');
    t.classList.add('flash');
    setTimeout(function () { t.classList.remove('flash'); }, 600);
  }

  function loop() {
    if (!game) return;
    var left = C.timeLeft(game, now());
    var sec = Math.ceil(left);
    $('time').textContent = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
    var fill = $('fill');
    fill.style.transform = 'scaleX(' + Math.min(1, left / cfg.duration) + ')';
    fill.classList.toggle('low', left <= 10);
    // 마지막 10초: 1초씩 줄어들 때만 시계 초침(0.6.0). 예전엔 "초가 바뀌면" 울려서, 검거(+초) · 오판(−초)으로
    // 초가 튀는 순간 판정 소리와 초침이 겹쳤다. 판정 직후 0.35초도 울리지 않는다.
    if (left <= 10 && sec > 0 && sec === lastSec - 1 && performance.now() > quietUntil) sfx.clock(left);
    music.duck(left <= 10);   // 마지막 10초엔 음악을 낮춰 초침이 묻히지 않게(시간이 늘어 10초를 넘으면 되돌린다)
    lastSec = sec;
    if (MM() && !lock && MT.shown(game, now()) !== paperShown) renderPaper(false);   // 특징이 하나 더 그려질 때
    if (C.tick(game, now())) { finish(); return; }
    raf = requestAnimationFrame(loop);
  }

  /* 출동 시작. config 를 안 주면 모드 기본값. */
  function startRun(config) {
    audio();   // 첫 탭에서 소리를 깨운다(브라우저 정책)
    cfg = config || defaultConfig();
    try {
      // mods(0.1.19): 특별 출동 규칙 · 준비물 "변호사 대기"(shield)
      if (cfg.mode === 'lineup' && LU) game = LU.createGame({ rng: Math.random, now: now(), duration: cfg.duration, freeHints: cfg.freeHints, mods: cfg.mods, missPenalty: cfg.missPenalty, hitBonus: cfg.lineupHitBonus, preOut: cfg.preOut });
      else if (cfg.mode === 'montage' && MT) game = MT.createGame({ rng: Math.random, now: now(), duration: cfg.duration, freeHints: cfg.freeHints, mods: cfg.mods });
      else if (cfg.mode === 'forgery' && F) game = F.createGame({ rng: Math.random, now: now(), duration: cfg.duration, freeHints: cfg.freeHints, mods: cfg.mods });
      else if (cfg.mode === 'witness' && W) game = W.createGame({ rng: Math.random, now: now(), duration: cfg.duration, freeHints: cfg.freeHints, mods: cfg.mods, trapPenalty: cfg.trapPenalty, hitBonus: cfg.hitBonus });
      else game = C.createGame({ rng: Math.random, now: now(), duration: cfg.duration, level: cfg.level, freeHints: cfg.freeHints, nonePenalty: cfg.nonePenalty, mods: cfg.mods });
    } catch (e) {
      toast('판을 만들지 못했어요: ' + e.message);
      return;
    }
    sel = []; lock = false; lastSec = -1;
    // 지난 출동의 마지막 도장(예: "검거!")이 남아 있으면 화면이 다시 보일 때 애니메이션이 또 재생된다 → 먼저 지운다
    var st = $('stamp');
    st.classList.remove('go', 'bad');
    st.innerHTML = '';
    show('s-play');
    paperShown = 0;
    if (LM()) setHint('목격자 진술에 모두 맞는 자리를 지목하세요', 'good', 4000);
    else if (MM()) setHint('특징이 하나씩 그려져요. 일찍 찾을수록 점수 ×4', 'good', 4000);
    else if (FM()) setHint('세 명씩 지은 줄 중 하나는 가짜예요. 한 특징만 둘이 같은 줄을 찾으세요', 'good', 4500);
    else if (WM()) setHint('진술 넷 중 딱 셋과 맞는 사람이 범인 · 넷 다 맞으면 함정', 'good', 4000);
    else setHint(game.level < 4 ? '먼저 모자만 보세요. 셋 다 같거나, 셋 다 다르면 한 패' : '한 패인 세 명을 고르세요', game.level < 4 ? 'good' : '', game.level < 4 ? 4000 : 0);
    // 목격자 모드 화면: 진술서 보이기, 검거 불가 숨기기, 안개·등대 빛(사건 2 연출) 붙이기
    var wm = WM();
    $('says').className = 'says';
    $('says').hidden = !(wm || LM() || MM());
    $('btn-none').hidden = wm || FM() || LM() || MM();
    $('btn-none').textContent = FM() ? '위조 없음' : '검거 불가';
    $('needs').hidden = true;
    // 사건별 화면 연출(fx.js): 목격자 모드 = 사건 2 해무항, 한 패 모드 = 사건 1 CCTV
    if (FX) FX.mount(wm ? 2 : LM() ? 3 : MM() ? 0 : 1, { board: $('board'), screen: $('s-play'), boss: !!cfg.boss, beamLie: !!cfg.beamLie,
      getLieEl: function () { return WM() ? $('says').querySelector('div[data-k="' + game.q.lie + '"]') : null; } });
    // 준비물 "제보 전화"(0.1.19): 첫 판의 한 패 하나를 단서처럼 미리 표시한다(판이 바뀌면 사라진다)
    //   목격자 모드에서는 첫 문제의 거짓 진술을 미리 짚어 준다
    if (cfg.tip && wm) game.hintShown = true;
    else if (cfg.tip && LM()) { try { LU.hint(Object.assign(game, { freeHints: game.freeHints + 1 }), now()); } catch (e) { /* 무시 */ } }
    else if (cfg.tip && MM()) { /* 몽타주: 제보 전화는 쓰지 않는다 */ }
    else if (cfg.tip && !FM() && !LM() && !MM()) {
      try {
        var first = C.findSets(game.board, C.active(game));
        if (first.length) game.clue = { set: first[0], shown: 3 };
      } catch (e) { /* 표시 못 해도 출동은 그대로 */ }
    }
    // 단서를 못 쓰는 특별 출동이면 돋보기 단추를 잠근다
    var noHints = !!(game.mods && game.mods.noHints);
    $('btn-hint').disabled = noHints;
    $('btn-hint').style.opacity = noHints ? '.35' : '';
    renderBoard(boardIds().map(function (_, i) { return i; }));
    markPicks();
    updateHud();
    // 0.7.0 난이도: 단순 · 미제 사건이면 도장 아래 글 앞에 붙인다(강력 사건은 기본이라 생략)
    var DfI = window.Team3Diff && cfg.diff && cfg.diff !== 'normal' ? window.Team3Diff.info(cfg.diff).name + ' · ' : '';
    popStamp(cfg.daily ? '특별 출동!' : '출동!', DfI + (cfg.daily && cfg.ruleName ? cfg.ruleName + ' · ' + cfg.duration + '초' : cfg.duration + '초 · ' + (LM() ? '범인을 지목하라' : '한 패를 찾아라')));
    if (cfg.used && cfg.used.length) setHint('준비물: ' + cfg.used.join(' · '), 'good', 3000);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function sheetOpen() { return !$('quit-sheet').hidden || !$('info-sheet').hidden || !$('settings-sheet').hidden || !$('help-sheet').hidden || ($('pets-sheet') && !$('pets-sheet').hidden) || ($('ach-sheet') && !$('ach-sheet').hidden) || ($('shop-sheet') && !$('shop-sheet').hidden) || ($('evid-sheet') && !$('evid-sheet').hidden) || ($('diff-sheet') && !$('diff-sheet').hidden); }

  function onCard(i) {
    if (!game || game.over || lock || sheetOpen()) return;
    if (WM()) { judgeWitness(i); return; }
    if (LM()) { judgeLineup(i); return; }
    if (MM()) { judgeMontage(i); return; }
    var k = sel.indexOf(i);
    if (k >= 0) {   // 다시 누르면 선택 해제: 뺀 자리(몇 번째였는지)의 음으로 내려가는 소리
      var was = sel.length;
      sel.splice(k, 1);
      sfx.unpick(was);
      buzz(5);
      markPicks();
      return;
    }
    sel.push(i);
    sfx.pick(sel.length);
    buzz(8);
    markPicks();
    if (sel.length === 3) judge();
  }

  /* ---------- 목격자 진술(0.2.0) ---------- */
  // 진술서 그리기. reveal = 이번 문제의 거짓 진술에 도장(답을 고른 뒤·단서)
  var typeTimer = 0;
  function renderSays(reveal) {
    var q = game.q, box = $('says');
    var showLie = reveal || game.hintShown;
    clearTimeout(typeTimer);
    box.innerHTML = q.says.map(function (s, i) {
      var lie = showLie && s.k === q.lie;
      return '<div data-k="' + s.k + '" class="' + (s.vals.length > 1 ? 'vague' : '') + (lie ? ' lie' : '') + '" style="--tilt:' + ((i * 37 % 5) - 2) * 0.35 + 'deg"><i>' + (i + 1) + '</i><span>' + (reveal || game.hintShown ? W.sayText(s) : '') + '</span>' + (lie ? '<b class="lie-stamp">거짓</b>' : '') + '</div>';
    }).join('');
    if (reveal || game.hintShown) return;
    // 타자기: 한 줄씩, 한 글자씩(전체 0.6초 남짓). 치는 동안에도 누를 수 있다(판정은 막지 않는다)
    var spans = box.querySelectorAll('span'), texts = q.says.map(function (s) { return W.sayText(s); }), line = 0, ch = 0;
    (function step() {
      if (line >= spans.length) return;
      ch += 2;
      spans[line].textContent = texts[line].slice(0, ch);
      if (ch >= texts[line].length) { spans[line].textContent = texts[line]; line++; ch = 0; try { sfx.type(); } catch (e) { /* 무시 */ } }
      typeTimer = setTimeout(step, ch === 0 ? 40 : 14);
    })();
  }
  function flashFx() { var f = document.createElement('div'); f.className = 'flashfx'; $('s-play').appendChild(f); setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 600); }
  function shakeFx() { var s = $('s-play'); s.classList.remove('shake'); void s.offsetWidth; s.classList.add('shake'); setTimeout(function () { s.classList.remove('shake'); }, 500); }
  /* ---------- 위조된 한 패(0.2.1) ---------- */
  function onRow(r) {
    if (!game || game.over || lock || sheetOpen()) return;
    var q0 = game.q, res;
    try { res = F.choose(game, r, now()); }
    catch (e) { if (e.code === 'GAME_OVER') finish(); else setHint('판정 오류: ' + e.message, 'bad', 2000); return; }
    lock = true;
    var rows = $('board').querySelectorAll('.rowbtn'), fakeName = q0.fake >= 0 ? C.ATTRS[q0.fakeK].name : '';
    if (q0.fake >= 0 && rows[q0.fake]) rows[q0.fake].classList.add('right');
    if (r >= 0 && r !== q0.fake && rows[r]) rows[r].classList.add('wrong');
    if (res.ok) {
      sfx.hit(res.combo); buzz([12, 40, 20]);
      if (FX) FX.hit(q0.fake >= 0 ? [rows[q0.fake]] : []);
      popStamp(q0.fake >= 0 ? '위조 적발!' : '위조 없음!', '+' + res.gain + (res.combo > 1 ? '  ·  연속 ' + res.combo : ''));
      setHint(q0.fake >= 0 ? (q0.fake + 1) + '번 줄 · ' + fakeName + '이(가) 둘만 같아요' : '이 판엔 가짜가 없었어요', 'good', 1400);
    } else {
      sfx.miss(); buzz(120);
      if (FX) FX.miss([]);
      shakeFx();
      var pen = res.shielded ? ' (변호사가 막았어요)' : ' (−' + res.penalty + '초)';
      popStamp('틀렸어요', q0.fake >= 0 ? (q0.fake + 1) + '번 줄이 가짜' : '가짜가 없는 판이었어요', true);
      setHint((q0.fake >= 0 ? fakeName + '이(가) 둘만 같은 줄이 가짜예요' : '모든 줄이 진짜였어요') + pen, 'bad', 2400);
      flashTimer();
    }
    updateHud(); bumpCombo();
    setTimeout(function () {
      lock = false;
      if (!game || game.over) { if (game) finish(); return; }
      renderBoard();
      if (res.levelUp) {
        var nm = { 2: ['네 가지 다 봐요', '시간대·흔적도 맞아야 진짜'], 3: ['여섯 줄', '가짜는 시간대·흔적에서만 · 없을 수도 있어요'] }[res.levelUp];
        sfx.none(); buzz([30, 60, 30]); if (FX) FX.levelUp(res.levelUp);
        popStamp(nm[0], nm[1]);
        setHint(res.levelUp === 3 ? '가짜가 없으면 "위조 없음"을 누르세요' : '이제 네 가지 특징을 다 봐요', 'good', 4000);
      }
      updateHud();
    }, res.ok ? 650 : 1200);
  }

  function judgeWitness(i) {
    var q0 = game.q, cards = $('board').querySelectorAll('.card'), r;
    try { r = W.choose(game, i, now()); }
    catch (e) { if (e.code === 'GAME_OVER') finish(); else setHint('판정 오류: ' + e.message, 'bad', 2000); return; }
    lock = true;
    // 지금 보이는 판(q0) 위에 결과를 보여 준 뒤 다음 문제로
    var keep = game.q; game.q = q0; renderSays(true); game.q = keep;
    if (r.ok) {
      cards[i].classList.add('right');
      sfx.hit(r.combo); buzz([12, 40, 20]);
      if (FX) FX.hit([cards[i]], q0.board[i], cardInner(q0.board[i]));
      popStamp('검거!', '+' + r.gain + (r.combo > 1 ? '  ·  연속 ' + r.combo : ''));
      var ht = (game.mods && game.mods.hitTime != null ? game.mods.hitTime : W.RULES.hitTime) + (game.hitBonus || 0);
      setHint(ht ? '+' + ht + '초' : '시간은 그대로', 'good', 900);
    } else {
      cards[i].classList.add('wrong');
      if (r.target >= 0 && cards[r.target]) cards[r.target].classList.add('right');
      sfx.miss(); buzz(r.trap ? [40, 60, 120] : 120);
      var pen = r.shielded ? ' (변호사가 막았어요 · 벌점 없음)' : ' (−' + r.penalty + '초)';
      if (r.trap) { flashFx(); shakeFx(); if (FX) FX.trap(); popStamp('함정!', '진술 넷이 다 맞으면 범인이 아니에요', true); setHint('하나는 거짓 진술 · 넷 다 맞는 사람은 함정' + pen, 'bad', 2600); }
      else { shakeFx(); if (FX) FX.miss([cards[i]]); popStamp('오인 체포', '진술과 ' + r.matched + '개만 맞아요', true); setHint('범인은 진술 넷 중 딱 셋과 맞아요' + pen, 'bad', 2600); }
      flashTimer();
    }
    updateHud();
    if (!r.ok) bumpCombo(); else bumpCombo();
    setTimeout(function () {
      lock = false;
      if (!game || game.over) { if (game) finish(); return; }
      renderBoard(game.q.board.map(function (_, k) { return k; }));
      if (r.levelUp) {
        var names = { 2: ['목격자 보통', '함정이 늘 하나, 걸러 내기 어려워요'], 3: ['목격자 어려움', '12명 · 흐린 진술이 섞여요'] }[r.levelUp];
        sfx.none(); buzz([30, 60, 30]);
        if (FX) FX.levelUp(r.levelUp);
        popStamp(names[0], names[1]);
        setHint(r.levelUp === 3 ? '"모자를 썼어요"처럼 종류를 못 본 진술은 비니·중절모 둘 다 맞아요' : '진술과 두 개씩 맞는 사람이 많아져요. 딱 셋을 찾으세요', 'good', 4500);
      }
      updateHud();
    }, r.ok ? 520 : 1100);
  }

  function judge() {
    var picked = sel.slice(), r;
    try {
      r = C.submit(game, picked, now());
    } catch (e) {
      sel = []; markPicks();
      if (e.code === 'GAME_OVER') finish(); else setHint('판정 오류: ' + e.message, 'bad', 2000);
      return;
    }
    var cards = $('board').querySelectorAll('.card');
    lock = true;
    if (r.ok) {
      picked.forEach(function (i) { cards[i].classList.add('hit'); });
      if (FX) FX.hit(picked.map(function (i) { return cards[i]; }));
      sfx.hit(r.combo); buzz([12, 40, 20]);
      popStamp('검거!', '+' + r.gain + (r.combo > 1 ? '  ·  연속 ' + r.combo : ''));
      var ht = game.mods && game.mods.hitTime != null ? game.mods.hitTime : C.RULES.hitTime;
      setHint(ht ? '+' + ht + '초' : '시간은 그대로', 'good', 900);
      updateHud(); bumpCombo();
      setTimeout(function () {
        sel = []; lock = false;
        if (!game || game.over) return;
        renderBoard(r.replaced);
        if (r.levelUp) {        // 새 속성이 열리는 순간
          var m = LEVEL_UP[r.levelUp];
          if (FX) FX.levelUp(r.levelUp);
          sfx.none(); buzz([30, 60, 30]);
          popStamp(m[0], m[1]);
          setHint(m[2], 'good', 4500);
          updateHud();
        }
      }, r.levelUp ? 650 : 380);
    } else {
      picked.forEach(function (i) { cards[i].classList.add('miss'); });
      if (FX) FX.miss(picked.map(function (i) { return cards[i]; }));
      sfx.miss(); buzz(120);
      var why = r.reasons.map(function (x) { return x.name + ': ' + x.value + ' 두 명만 같아요'; }).join(' · ');
      setHint(r.shielded ? why + '  (변호사가 막았어요 · 벌점 없음, 남은 면제 ' + game.shield + '번)' : why + '  (−' + r.penalty + '초)', 'bad', 2600);
      flashTimer(); updateHud();
      setTimeout(function () {
        sel = []; lock = false;
        picked.forEach(function (i) { if (cards[i]) cards[i].classList.remove('miss'); });
        markPicks();
      }, 420);
    }
  }

  function onNone() {
    if (!game || game.over || lock || sheetOpen()) return;
    if (FM()) { onRow(-1); return; }
    var r;
    try {
      r = C.declareNone(game, now());
    } catch (e) {
      if (e.code === 'GAME_OVER') finish(); else setHint('판정 오류: ' + e.message, 'bad', 2000);
      return;
    }
    sel = [];
    if (r.ok) {
      sfx.none(); buzz([20, 50, 20, 50, 40]);
      popStamp('검거 불가 적중', '+' + r.gain + '  ·  +' + C.RULES.noneTime + '초');
      updateHud(); bumpCombo();
      renderBoard(game.board.map(function (_, i) { return i; }));
    } else {
      sfx.miss(); buzz(160);
      popStamp('오판', '아직 ' + r.remaining + '패가 숨어 있어요', true);
      setHint('−' + r.penalty + '초, 연속 끊김', 'bad', 2200);
      flashTimer(); updateHud(); markPicks();
    }
  }

  /*
   * 단서: 한 패의 한 명 → 두 명. 두 명이 보이면 셋째의 인상착의를 말로 알려 준다.
   * "같은 건 같게, 다른 건 남은 하나로"라는 요령을 직접 보게 하려는 것.
   */
  function onHint() {
    if (!game || game.over || lock || sheetOpen()) return;
    if (LM() || MM()) {
      var lr;
      try { lr = LM() ? LU.hint(game, now()) : MT.hint(game, now()); }
      catch (e) { if (e.code === 'GAME_OVER') finish(); else if (e.code === 'NO_HINTS') setHint('이번 출동은 단서를 쓸 수 없어요', 'bad', 2000); else setHint('단서 오류: ' + e.message, 'bad', 2000); return; }
      if (lr.penalty) flashTimer();
      sfx.pick(0); updateHud();
      if (LM()) {
        if (!lr.out.length) { setHint('목격자가 이미 다시 봤어요', '', 1600); return; }
        renderBoard();
        setHint('목격자가 다시 봤어요: ' + lr.out.map(function (k) { return k + 1; }).join(' · ') + '번은 아니에요' + (lr.penalty ? ' (−' + lr.penalty + '초)' : ''), 'good', 3000);
      } else {
        renderPaper(false);
        setHint(lr.shown >= 4 ? '특징을 다 그렸어요' : '특징 하나를 먼저 그렸어요 · 지금 ×' + MT.multNow(game, now()), 'good', 2000);
      }
      return;
    }
    if (FM()) {
      var fr;
      try { fr = F.hint(game, now()); }
      catch (e) { if (e.code === 'GAME_OVER') finish(); else if (e.code === 'NO_HINTS') setHint('이번 출동은 단서를 쓸 수 없어요', 'bad', 2000); else setHint('단서 오류: ' + e.message, 'bad', 2000); return; }
      if (fr.row < 0) { setHint('더 짚을 진짜 줄이 없어요', '', 1800); return; }
      if (fr.penalty) flashTimer();
      sfx.pick(0); updateHud(); renderBoard();
      setHint((fr.row + 1) + '번 줄은 진짜예요' + (fr.penalty ? ' (−' + fr.penalty + '초)' : ''), 'good', 2500);
      return;
    }
    if (WM()) {
      var hr;
      try { hr = W.hint(game, now()); }
      catch (e) {
        if (e.code === 'GAME_OVER') finish();
        else if (e.code === 'NO_HINTS') setHint('이번 출동은 단서를 쓸 수 없어요', 'bad', 2000);
        else setHint('단서 오류: ' + e.message, 'bad', 2000);
        return;
      }
      if (hr.penalty) flashTimer();
      sfx.pick(0); updateHud(); renderSays(false);
      setHint('빨간 도장이 거짓 진술이에요. 나머지 셋과 다 맞는 사람을 찾으세요' + (hr.penalty ? ' (−' + hr.penalty + '초)' : ''), 'good', 3500);
      return;
    }
    var r;
    try { r = C.hint(game, now()); }
    catch (e) {
      if (e.code === 'GAME_OVER') finish();
      else if (e.code === 'NO_HINTS') setHint('이번 출동은 단서를 쓸 수 없어요', 'bad', 2000);
      else setHint('단서 오류: ' + e.message, 'bad', 2000);
      return;
    }
    var cost = r.penalty ? ' (−' + r.penalty + '초)' : ' (무료)';
    if (r.penalty) flashTimer();
    sfx.pick(0);
    updateHud();
    if (r.none) {
      setHint('이 판엔 한 패가 없어요. 검거 불가를 눌러 보세요' + cost, 'good', 3500);
      return;
    }
    sel = [];
    markPicks();
    if (r.indices.length === 1) {
      setHint((r.indices[0] + 1) + '번은 한 패예요. 한 번 더 누르면 한 명 더' + cost, 'good', 3500);
    } else {
      var b = game.board, third = C.thirdCard(b[r.indices[0]], b[r.indices[1]]);
      setHint('셋째는 ' + describe(third, C.active(game)) + '인 사람' + (r.penalty ? cost : ''), 'good', 6000);
    }
  }

  function finish() {
    if (!game) return;
    var g = game;
    cancelAnimationFrame(raf);
    clearTimeout(hintTimer);
    game = null;
    sfx.end();
    $('r-score').textContent = g.score.toLocaleString('ko-KR');
    $('r-hits').textContent = g.hits;
    $('r-combo').textContent = g.bestCombo;
    $('r-none').textContent = g.noneHits;
    $('r-miss').textContent = g.misses + ' · ' + g.noneMisses;
    if (FX) FX.unmount();
    // 결과 칸 이름: 목격자 모드는 "함정 체포 · 오인 체포"
    var wmode = g.mode === 'witness', fmode = g.mode === 'forgery', lmode = g.mode === 'lineup', mmode = g.mode === 'montage';
    $('r-none').parentNode.querySelector('.label').textContent = wmode ? '함정 체포' : fmode ? '위조 없음 적중' : '검거 불가 적중';
    $('r-miss').parentNode.querySelector('.label').textContent = wmode ? '오인 체포' : fmode ? '틀림' : '오인 체포·오판';
    if (wmode) { $('r-none').textContent = g.traps; $('r-miss').textContent = String(g.misses); }
    if (fmode) { $('r-none').textContent = g.noneHits; $('r-miss').textContent = String(g.misses + g.noneMisses); }
    if (lmode || mmode) {
      $('r-none').parentNode.querySelector('.label').textContent = lmode ? '최고 단계' : '빠른 검거(×3↑)';
      $('r-none').textContent = lmode ? g.level : g.early;
      $('r-miss').parentNode.querySelector('.label').textContent = '오인 지목';
      $('r-miss').textContent = String(g.misses);
    }
    var tip = lmode ? (g.misses > g.hits ? '진술 하나씩 대 보며 아닌 자리를 먼저 지우세요. "바로 왼쪽"은 그 자리의 왼쪽 사람을 보는 거예요.' : '면통 4단계는 진술이 셋이에요. 자리 관계 진술부터 보면 빨라요.')
      : mmode ? (g.misses > g.hits ? '특징이 둘만 보일 땐 맞는 사람이 여럿일 수 있어요. 셋째가 그려질 때까지 기다려도 ×2예요.' : '처음 두 특징에 맞는 사람이 하나뿐이면 바로 고르세요. ×3 · ×4 가 크게 남아요.')
      : fmode ? '진짜 줄은 특징마다 셋 다 같거나 셋 다 달라요. 한 특징씩 줄을 훑어 "둘만 같은" 곳을 찾으세요.'
      : g.mode === 'witness'
      ? (g.traps > 1 ? '진술 넷이 다 맞는 사람은 함정이에요. 하나는 늘 거짓이니까, 딱 셋 맞는 사람을 찾으세요.'
        : g.misses > g.hits ? '먼저 진술 하나를 거짓이라 가정하고, 나머지 셋과 다 맞는 사람이 하나뿐인지 보세요.'
        : '연속 검거를 이어 가면 점수가 3배까지 올라요.')
      : g.hints > 3
      ? '단서로 두 명이 보이면, 셋째는 "같은 건 같게, 다른 건 남은 하나로" 정해져요. 다음엔 그걸 먼저 떠올려 보세요.'
      : g.noneHits === 0 && g.noneMisses === 0 && g.level === 4
        ? '네 가지 판의 셋 중 하나쯤은 한 패가 없어요. 오래 못 찾겠으면 검거 불가를 노려 보세요.'
        : g.misses > g.hits
          ? '두 명을 먼저 정하면 셋째는 하나로 정해져요. 그 한 명이 판에 있는지만 찾아보세요.'
          : '연속 검거를 이어 가면 점수가 3배까지 올라요.';
    $('r-tip').textContent = tip;

    if (hooks.onRunEnd) {
      // 방치형: 수사비·사건 진척은 사무실이 정리해 돌려준다
      $('r-label').textContent = '출동 종료';
      var box = $('r-idle');
      try { box.innerHTML = hooks.onRunEnd(g); box.hidden = false; }
      catch (e) { box.textContent = '결과를 반영하지 못했어요: ' + e.message; box.hidden = false; }
      $('r-best').innerHTML = '';
    }
    show('s-result');
  }

  function again() {
    // 0.8.2: 특별 출동을 마치고 "다시 출동"이면 특별 출동으로 다시(오늘 기록 갱신에 도전). 평소 출동은 평소대로
    if (cfg && cfg.daily && hooks.goDaily) { hooks.goDaily(); return; }
    if (hooks.go) hooks.go(); else startRun();
  }

  /* ---------- 처음으로(판 버리기) ---------- */
  function openQuit() {
    if (!game || game.over) { goHome(); return; }
    try { gPause(game, now()); } catch (e) { goHome(); return; }
    cancelAnimationFrame(raf);
    music.dim(true);   // 멈춘 동안 음악을 작게(0.1.18)
    $('quit-sheet').hidden = false;
    $('btn-quit-no').focus();
  }
  function closeQuit() {
    $('quit-sheet').hidden = true;
    music.dim(false);
    if (!game) return;
    gResume(game, now());
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
    $('btn-quit').focus();
  }
  function quitToHome() {
    music.duck(false); music.dim(false);
    if (FX) FX.unmount();
    $('quit-sheet').hidden = true;
    cancelAnimationFrame(raf);
    clearTimeout(hintTimer);
    game = null; sel = []; lock = false;
    goHome();
  }

  /* ---------- 튜토리얼: 두 명을 주고 셋째 고르기 ---------- */
  var LESSON_INTRO = {
    1: '처음엔 <b>모자</b>만 봐요. 한 패는 셋 다 같은 모자이거나, 셋 다 다른 모자예요. <b>두 명만 같으면 안 돼요.</b>',
    2: '이번엔 <b>얼굴</b>도 봐요. 모자 따로, 얼굴 따로. 둘 다 같은 규칙이에요.',
    3: '<b>시간대</b>(카드 색과 왼쪽 위)가 더해져요. 하나씩 따로 보면 어렵지 않아요.',
    4: '마지막으로 <b>흔적</b>(오른쪽 아래)까지. 실제 출동은 이 네 가지를 다 봐요.'
  };
  var tut = null;   // { step: 1~4, lesson, solved }

  function openTutorial() {
    tut = { step: 1, lesson: null, solved: false };
    $('tut-body').hidden = false;
    $('tut-done').hidden = true;
    renderLesson();
    show('s-tutorial');
  }

  function renderLesson() {
    var L = tut.lesson = C.makeLesson(Math.random, tut.step);
    tut.solved = false;
    $('tut-step').textContent = '튜토리얼 ' + tut.step + ' / 4';
    var dots = $('tut-dots').children;
    for (var i = 0; i < dots.length; i++) dots[i].classList.toggle('on', i < tut.step);
    $('tut-intro').innerHTML = LESSON_INTRO[tut.step];
    var tile = function (id, cap) {
      return '<div><div class="card" role="img" data-id="' + id + '" aria-label="' + cap + ': ' + describe(id, L.active) + '" style="background:' + look(id, L.active).bg + '">' + cardInner(id, null, L.active) + '</div><div class="cap">' + cap + '</div></div>';
    };
    $('tut-pair').innerHTML = tile(L.a, '용의자 A') + tile(L.b, '용의자 B') + '<div><div class="qmark" aria-hidden="true">?</div><div class="cap">셋째</div></div>';
    var opts = $('tut-opts');
    opts.className = 'opts' + (L.options.length === 3 ? ' three' : '');
    opts.innerHTML = L.options.map(function (id, i) {
      return cardButton(id, '', 'data-o="' + i + '" aria-label="후보 ' + (i + 1) + ': ' + describe(id, L.active) + '"', null, L.active);
    }).join('');
    $('tut-explain').hidden = true;
    $('tut-next-wrap').hidden = true;
  }

  function onOption(i) {
    if (!tut || tut.solved) return;
    var L = tut.lesson, id = L.options[i], btn = $('tut-opts').children[i], box = $('tut-explain');
    if (id === L.answer) {
      tut.solved = true;
      btn.classList.add('right');
      sfx.hit(1); buzz([12, 40, 20]);
      // 정답 해설: 특징마다 "같으니 같게 / 다르니 남은 하나로"
      box.innerHTML = '<span class="ok">맞아요, 한 패예요!</span>' + C.needs(L.a, L.b, L.active).map(function (x) {
        return '<span>' + x.name + ': 두 명이 ' + (x.same ? '같으니 → 셋째도 <b>' + x.value + '</b>' : '다르니 → 남은 <b>' + x.value + '</b>') + '</span>';
      }).join('');
      box.hidden = false;
      $('tut-next').textContent = tut.step < 4 ? '다음' : '마치기';
      $('tut-next-wrap').hidden = false;
    } else {
      btn.classList.remove('miss'); void btn.offsetWidth; btn.classList.add('miss');
      sfx.miss(); buzz(100);
      var why = C.explain(L.a, L.b, id, L.active)[0];
      box.innerHTML = '<span class="no">아깝다!</span><span>이 사람이면 ' + why.name + '이(가) <b>' + why.value + '</b>로 두 명만 같아요. 다시 골라 보세요.</span>';
      box.hidden = false;
    }
  }

  function nextLesson() {
    if (!tut) return;
    if (tut.step < 4) { tut.step += 1; renderLesson(); $('s-tutorial').scrollTo && $('s-tutorial').scrollTo(0, 0); return; }
    $('tut-body').hidden = true;
    $('tut-done').hidden = false;
    store.set('guar.suspects.tutorial', '1');
    if (hooks.onTutorialDone) hooks.onTutorialDone();
    sfx.none();
  }

  /* ---------- 작은 알림 ---------- */
  var toastTimer = 0;
  function toast(text) {
    var t = $('toast');
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2200);
  }

  // 톱니바퀴(설정) 그림. 예전 스피커 단추 자리(사무실 오른쪽 위, 출동 화면 오른쪽 아래)에 들어간다
  function gearIcon() {
    return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
  }
  // 이름은 예전 그대로(hub.js 가 부른다): 단추 그림을 다시 그린다
  function renderSound() {
    ['btn-sound', 'h-sound'].forEach(function (id) {
      var b = $(id); if (!b) return;
      b.setAttribute('aria-label', '설정');
      b.innerHTML = gearIcon();
    });
    ['btn-help', 'h-help'].forEach(function (id) { var b = $(id); if (b) b.innerHTML = helpIcon(); });
  }

  /* ---------- 설정 창(0.1.18) ----------
   * 사무실·출동 어디서든 톱니바퀴로 연다. 출동 중이면 멈춤 창처럼 시간을 멈추고(닫으면 이어서), 음악을 작게 한다.
   * 막대를 움직이는 동안 바로 반영하고, 손을 떼면 저장한다. 효과음 막대는 손을 뗄 때 고르기 소리로 크기를 들려준다.
   * 튜토리얼·백업·초기화는 사무실에서만 보인다(출동 중에 하면 판이 꼬이므로). 백업·초기화는 hub.js 의 hooks 가 한다.
   */
  var setPaused = false;   // 설정·도움말 창 때문에 출동을 멈췄는가
  function playing() { return !!(game && !game.over && $('s-play').classList.contains('on')); }
  // 출동 중이면 멈추고 음악을 작게(설정·도움말 공용). 멈췄으면 true
  function pauseForSheet() {
    setPaused = false;
    if (playing()) {
      try { gPause(game, now()); setPaused = true; } catch (e) { setPaused = false; }
      cancelAnimationFrame(raf);
      music.dim(true);
    }
    return setPaused;
  }
  function resumeFromSheet() {
    if (setPaused && game) {
      setPaused = false;
      music.dim(false);
      try { gResume(game, now()); } catch (e) { /* 무시 */ }
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    }
  }
  function renderSettings() {
    $('set-music').value = settings.music; $('set-music-v').textContent = settings.music;
    $('set-sfx').value = settings.sfx; $('set-sfx-v').textContent = settings.sfx;
    $('set-vib').setAttribute('aria-pressed', settings.vibrate ? 'true' : 'false');
  }
  function saveSettings() { if (ST) ST.save(store, settings); }
  function applyVolumes() {
    if (master) { try { master.gain.value = MASTER_GAIN * curve(settings.sfx); } catch (e) { /* 무시 */ } }
    music.setVolume(BGM_GAIN * curve(settings.music));
    music.setMuted(settings.music === 0);
    if (!silent()) audio();   // 0 에서 올렸으면 소리 장치를 깨운다(막대를 만지는 것도 사람의 손길이다)
  }
  function openSettings() {
    if (sheetOpen()) return;
    var inRun = playing();
    $('set-paused').hidden = !pauseForSheet();
    $('set-hub').hidden = inRun || !hooks.exportSave;   // 출동 중이거나 사무실이 없으면 아래 묶음 숨김
    resetHubControls();
    renderSettings();
    $('settings-sheet').hidden = false;
    try { $('set-x').focus({ preventScroll: true }); } catch (e) { /* 옛 브라우저 */ }
    $('settings-sheet').querySelector('.sheet').scrollTop = 0;
  }
  function closeSettings() {
    if ($('settings-sheet').hidden) return;
    $('settings-sheet').hidden = true;
    saveSettings();
    resetHubControls();
    resumeFromSheet();
  }

  /* ---------- 도움말(0.1.18) ----------
   * 다섯 항목을 눌러 펼친다. 수치(시간·벌점·한도)는 core·idle 의 규칙 표에서 읽어 와서, 밸런스를 바꿔도 글이 틀리지 않게 한다.
   * 처음 한 패 예시는 네 가지가 다 보이는 카드 세 장(늘 한 패). 열 때마다 새로 뽑는다.
   */
  function helpHtml() {
    var R = C.RULES, I = window.SuspectsIdle, T = I && I.TUNE, CS = I && I.CASE;
    var a = Math.floor(Math.random() * 81), b;
    do { b = Math.floor(Math.random() * 81); } while (b === a);
    var cards = [a, b, C.thirdCard(a, b)].map(function (id) {
      return '<div class="card" style="background:' + look(id).bg + '">' + cardInner(id) + '</div>';
    }).join('');
    function sec(n) { return n + '초'; }
    function item(title, body, open) {
      return '<details class="help-d"' + (open ? ' open' : '') + '><summary>' + title + '</summary><div class="help-b">' + body + '</div></details>';
    }
    var lv = R.levelAt;
    var out = item('한 패 찾기',
      '<p>용의자에게는 <b>모자 · 얼굴 · 시간대 · 흔적</b> 네 가지 특징이 있어요.</p>' +
      '<p>세 명을 골랐을 때 특징마다 <b>셋 다 같거나, 셋 다 다르면</b> 한 패예요. 둘만 같은 특징이 하나라도 있으면 한 패가 아니에요.</p>' +
      '<div class="help-cards">' + cards + '</div>' +
      '<p class="muted">두 명을 고르면 셋째는 하나로 정해져요. 그 한 명이 판에 있는지만 찾으면 돼요.</p>', true);
    if (W) {
      out += item('목격자 진술 (사건 2)',
        '<p>사건 2부터는 목격자가 범인의 특징 넷을 말해요. <b>그중 하나는 거짓</b>이에요.</p>' +
        '<p>진술 넷 중 <b>딱 셋</b>과 맞는 사람이 범인이에요. 넷 다 맞는 사람은 <b>함정</b>이에요(하나는 늘 거짓이니까).</p>' +
        '<p>한 명을 누르면 바로 판정해요. 검거 +' + W.RULES.hitTime + '초, 오인 체포 −' + W.RULES.missPenalty + '초, 함정 체포 −' + W.RULES.trapPenalty + '초.</p>' +
        '<p>검거 ' + W.RULES.levelAt[2] + '명이면 보통(함정이 늘 하나), ' + W.RULES.levelAt[3] + '명이면 어려움(12명, "모자를 썼어요"처럼 종류를 못 본 흐린 진술)이에요.</p>' +
        '<p>돋보기(<b>단서</b>)는 거짓 진술에 빨간 도장을 찍어 줘요. 한 문제에 한 번, 시간 −' + W.RULES.hintPenalty + '초.</p>');
    }
    out += item('현장 출동',
      '<p>처음엔 <b>모자</b>만 봐요. 검거 ' + lv[2] + '명이면 얼굴, ' + lv[3] + '명이면 시간대, ' + lv[4] + '명이면 흔적까지 봐요.</p>' +
      '<p>검거하면 시간 <b>+' + sec(R.hitTime) + '</b>, 오인 체포는 <b>−' + sec(R.missPenalty) + '</b>.</p>' +
      '<p>판에 한 패가 없으면 <b>검거 불가</b>를 누르세요. 맞으면 큰 점수와 +' + sec(R.noneTime) + ', 틀리면 시간이 줄어요.</p>' +
      '<p>돋보기(<b>단서</b>)는 한 번 누르면 한 패 중 한 명, 한 번 더 누르면 한 명 더와 셋째의 모습을 알려 줘요. 판에 한 패가 없으면 그것도 알려 줘요. 한 번에 시간 −' + sec(R.hintPenalty) + '.</p>' +
      '<p>연속으로 잡으면 점수가 최대 <b>' + R.comboMax + '배</b>까지 올라요.</p>');
    if (T) {
      out += item('사무실',
        '<p>형사들은 내가 없어도 용의자를 잡고 <b>수사비</b>를 벌어요.</p>' +
        '<p><b>형사 영입</b>은 팀을 키우고, <b>합동 훈련</b>은 팀을 빠르게 하고 수사비를 늘려요. <b>출동 장비</b>는 현장 출동을 돕는 장비예요.</p>' +
        '<p>현장 출동을 다녀오면 점수만큼 수사비를 받고, ' + Math.round(T.buffSec / 60) + '분 동안 팀이 <b>' + T.buffMult + '배</b>로 일해요(사기 충전).</p>');
      out += item('자리를 비우면',
        '<p>앱을 꺼 두는 동안에도 팀은 일해요. 대신 <b>절반 속도</b>로, <b>' + (T.offlineCapSec / 3600) + '시간</b>까지만 세요.</p>' +
        (CS ? '<p>팀이 혼자 잡을 수 있는 건 사건마다 정해져 있어요(사건 ' + CS.no + '은 ' + CS.idleCap.toLocaleString('ko-KR') + '명). 남은 <b>주범 조</b>는 현장 출동으로만 잡아요.</p>' : ''));
    }
    var EC = window.Team3Economy;
    if (EC && I) {
      out += item('준비물 · 특별 출동 · 계급',
        '<p><b>출동 준비물</b>은 다음 출동 한 번에 챙겨 가는 소모품이에요. 출동 전이면 다시 눌러 무를 수 있어요. 값은 최근 출동 점수와 팀 수입에 맞춰 바뀌어요.</p>' +
        '<p><b>지원</b>: 팀 회식은 30분 동안 팀이 2배로 일하고, 야간 잠복조는 다음 자리 비움을 8시간까지 세요.</p>' +
        '<p><b>메달</b>: 출동 점수 ' + EC.MEDALS.map(function (m) { return m.name + ' ' + m.at.toLocaleString('ko-KR'); }).join(' · ') + '을 처음 넘으면 보상을 받아요.</p>' +
        '<p><b>오늘의 특별 출동</b>은 날마다 규칙이 바뀌어요. 준비물·장비 없이 실력으로 해요. 메달을 따면 하루 한 번 보상, 배지로 한 번 더 도전할 수 있어요.</p>' +
        '<p><b>계급</b>은 현장에서 직접 잡은 수로 올라요(' + I.RANKS.map(function (r) { return r.name; }).join(' → ') + '). 한 계급마다 수사비 +' + Math.round(I.RANK_BONUS * 100) + '%.</p>' +
        '<p><b>배지 ◆</b>는 승진·메달·특별 출동으로 모아요. 수사비가 모자랄 때 상품을 사거나 특별 출동에 다시 도전할 때 써요.</p>');
    }
    var PT = window.Team3Pets;   // 0.3.0 동물 뽑기
    if (PT) {
      out += item('말랑 수사대 (동물 뽑기)',
        '<p>사무실 위쪽 <b>동물</b> 단추에서 뽑기와 도감을 봐요. 동물은 ' + PT.SPECIES.length + '종, 종류마다 <b>일반 · 희귀 · 영웅 · 전설</b> 네 등급이 있어요(모두 ' + (PT.SPECIES.length * 4) + '마리).</p>' +
        '<p><b>보유 효과</b>: 모은 동물 모두가 늘 조금씩(수사비 · 팀 수입 · 자리 비움 한도 · 할인). <b>장착 효과</b>: 파트너로 고른 한 마리만 크게.</p>' +
        '<p>같은 동물이 또 나오면 ★가 올라 효과가 세져요(★5까지). 그 뒤로는 <b>간식</b>이 되고, 간식으로 원하는 동물을 데려와요.</p>' +
        '<p>확률은 뽑기 창에 늘 공개돼요. ' + PT.PITY + '번 안에 전설이 안 나오면 전설 확정. ⚡ 퍼즐 도움은 영웅·전설의 일부만, 특별 출동에서는 꺼져요.</p>' +
        '<p>뽑기권은 처음 선물 ' + PT.WELCOME + '장 · 사건 종결 10장 · 승진 3장 · 첫 메달 2장 · 특별 출동 메달 1장. 배지로도 뽑을 수 있어요(1회 ◆' + PT.COST.one + ' · 10회 ◆' + PT.COST.ten + ').</p>');
    }
    if (window.Team3Monet) {
      out += item('3팀 매점 · 시즌 패스',
        '<p>사무실의 <b>배지(◆) 칸</b>을 누르면 매점이 열려요. 짧은 광고를 보면 뽑기권 · 팀 회식을 받을 수 있어요(하루 한도). 출동 결과에서는 수사비 2배도 받아요.</p>' +
        '<p><b>시즌 패스</b>는 정식 출시 전까지 끝나지 않고, 출시 뒤에는 30일마다 새로 시작해요. 출동할 때마다 경험치가 쌓여 단계가 열리고, 무료 줄 보상은 누구나 받아요.</p>' +
        '<p>새내기 꾸러미 · 월정액 · 배지 묶음 · 패스 프리미엄은 출시 때 결제가 열려요. 돈으로 퍼즐 실력은 팔지 않아요.</p>');
    }
    if (window.Team3Ach) {
      out += item('업적 · 칭호 · 이름',
        '<p>사무실 오른쪽 위 <b>트로피</b>에서 업적을 봐요. 달성하면 바로 칭호와 보상(뽑기권 · 배지)을 받아요.</p>' +
        '<p>칭호는 <b>팀장 이름 앞</b>(트로피 창)과 <b>동물 이름 앞</b>(동물 창 자세히)에 달 수 있어요. 배지로 사는 칭호도 있어요.</p>' +
        '<p>경찰서·팀장 이름과 동물 이름 바꾸기는 <b>첫 한 번 무료</b>, 그 뒤로는 배지(팀장 ◆' + I.PROFILE.renameGems + ' · 동물 ◆' + (window.Team3Pets ? window.Team3Pets.RENAME_GEMS : 5) + ') 또는 <b>이름표</b> 1장이에요.</p>');
    }
    out += item('수사 일지 · 설정 · 백업',
      '<p>사건이 고비를 넘을 때마다 <b>수사 일지</b>가 열려요. 사무실의 수사 일지 보기에서 다시 읽을 수 있어요.</p>' +
      '<p>톱니바퀴(<b>설정</b>)에서 음악·효과음 크기와 진동을 바꿔요. 사무실에서 열면 튜토리얼 다시 하기, 백업, 초기화도 있어요.</p>' +
      '<p>진행은 이 기기에만 저장돼요. 앱을 지우거나 기기를 바꾸기 전에 <b>백업 코드</b>를 복사해 두세요.</p>');
    return out;
  }
  /* ---------- 만든 사람들(0.1.20) ----------
   * 음악 출처는 music.js(곡마다 credit)에서 읽는다. 곡을 바꾸면 make_music.py 의 credit 만 고치면 된다.
   * 효과음·글꼴은 여기 표(OTHER_CREDITS). 링크는 새 창(안드로이드 앱에서는 바깥 브라우저)으로 연다.
   */
  var MUSIC_PLACE = { office: '사무실', field: '현장 출동', boss: '주범 조 출동' };
  var OTHER_CREDITS = [
    { group: '효과음', title: '시계 초침', who: 'Dragon Studio', license: 'Pixabay Content License', url: 'https://pixabay.com/' },
    { group: '효과음', title: '사이렌', who: 'Universfield', license: 'Pixabay Content License', url: 'https://pixabay.com/' },
    { group: '글꼴', title: 'Black Han Sans', who: 'Zess Type', license: 'SIL Open Font License 1.1', url: 'https://fonts.google.com/specimen/Black+Han+Sans' }
  ];
  function escHtml(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function crLink(u) {
    if (!u) return '';
    var href = /^https?:\/\//.test(u) ? u : 'https://' + u;
    return '<a href="' + escHtml(href) + '" target="_blank" rel="noopener noreferrer">' + escHtml(u.replace(/^https?:\/\//, '')) + '</a>';
  }
  function creditsHtml() {
    var out = '<div><h3>제작</h3><div class="cr"><b>Guar</b><span>기획 · 개발</span></div></div>';
    var M = window.Team3Music || {}, rows = [];
    Object.keys(M).forEach(function (k) {
      var c = M[k] && M[k].credit; if (!c || !c.title) return;
      // url 칸에 "주소 · 주소" 로 여러 개를 적어 둘 수 있다
      var links = String(c.url || '').split(' · ').filter(Boolean).map(crLink).join(' ');
      rows.push('<div class="cr"><b>"' + escHtml(c.title) + '"</b><span>' + escHtml((MUSIC_PLACE[k] ? MUSIC_PLACE[k] + ' · ' : '') + [c.artist, c.license].filter(Boolean).join(' · ')) + '</span>' + links + '</div>');
    });
    if (rows.length) out += '<div><h3>음악</h3><div style="display:flex;flex-direction:column;gap:8px">' + rows.join('') + '</div></div>';
    ['효과음', '글꼴'].forEach(function (g) {
      var list = OTHER_CREDITS.filter(function (c) { return c.group === g; });
      out += '<div><h3>' + g + '</h3><div style="display:flex;flex-direction:column;gap:8px">' + list.map(function (c) {
        return '<div class="cr"><b>' + escHtml(c.title) + '</b><span>' + escHtml(c.who + ' · ' + c.license) + '</span>' + crLink(c.url) + '</div>';
      }).join('') + '</div></div>';
    });
    return out;
  }
  // 설정 창 위에 겹쳐 연다(설정 창은 그대로 둔다. 닫으면 설정 창으로 돌아간다)
  function openCredits() {
    $('credits-body').innerHTML = creditsHtml();
    $('credits-sheet').hidden = false;
    try { $('credits-x').focus({ preventScroll: true }); } catch (e) { /* 옛 브라우저 */ }
    $('credits-sheet').querySelector('.sheet').scrollTop = 0;
  }
  function closeCredits() { $('credits-sheet').hidden = true; }

  function openHelp() {
    if (sheetOpen()) return;
    $('help-paused').hidden = !pauseForSheet();
    $('help-body').innerHTML = helpHtml();
    $('help-sheet').hidden = false;
    try { $('help-x').focus({ preventScroll: true }); } catch (e) { /* 옛 브라우저 */ }
    $('help-sheet').querySelector('.sheet').scrollTop = 0;
  }
  function closeHelp() {
    if ($('help-sheet').hidden) return;
    $('help-sheet').hidden = true;
    resumeFromSheet();
  }
  function helpIcon() {
    return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M9.3 9.2a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.4-2.7 4"/><path d="M12 17.3h.01"/></svg>';
  }

  /*
   * 두 번 눌러 확인하는 단추(초기화·불러오기). 처음 누르면 빨갛게 바뀌고 글이 경고로 바뀐다.
   * 4초 안에 한 번 더 누르면 실행, 지나면 원래대로 돌아간다.
   */
  var armTimers = {};
  function armOrRun(id, label, warn, run) {
    var b = $(id);
    if (b.classList.contains('armed')) {
      clearTimeout(armTimers[id]); b.classList.remove('armed'); b.textContent = label;
      run();
      return;
    }
    b.classList.add('armed'); b.textContent = warn;
    buzz(15);
    clearTimeout(armTimers[id]);
    armTimers[id] = setTimeout(function () { b.classList.remove('armed'); b.textContent = label; }, 4000);
  }
  var RESET_LABEL = '진행 초기화', IMPORT_LABEL = '이 코드로 불러오기';
  function resetHubControls() {
    Object.keys(armTimers).forEach(function (k) { clearTimeout(armTimers[k]); });
    $('set-reset').classList.remove('armed'); $('set-reset').textContent = RESET_LABEL;
    $('set-import-go').classList.remove('armed'); $('set-import-go').textContent = IMPORT_LABEL;
    $('set-code').hidden = true; $('set-code').value = ''; $('set-code').readOnly = false;
    $('set-import-go').hidden = true;
  }

  // 백업 코드 복사: 코드를 칸에 보여 주고(직접 길게 눌러 복사할 수도 있게) 클립보드에 넣어 본다
  function exportSave() {
    var code;
    try { code = hooks.exportSave(); } catch (e) { toast('백업 코드를 만들지 못했어요: ' + e.message); return; }
    var box = $('set-code');
    box.hidden = false; box.readOnly = true; box.value = code;
    $('set-import-go').hidden = true;
    var fallback = function () {
      try { box.focus(); box.select(); } catch (e) { /* 무시 */ }
      toast('아래 코드를 길게 눌러 전부 복사해 주세요');
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(function () { toast('백업 코드를 복사했어요 · 메모장 등에 붙여 넣어 두세요'); }, fallback);
      } else fallback();
    } catch (e) { fallback(); }
  }
  function showImport() {
    var box = $('set-code');
    box.hidden = false; box.readOnly = false; box.value = '';
    box.placeholder = 'T3- 로 시작하는 백업 코드를 붙여 넣으세요';
    $('set-import-go').hidden = false;
    box.focus();
  }
  function importSave() {
    var code = $('set-code').value;
    var check = ST ? ST.importCode(code, hooks.saveVersion) : { ok: false, reason: 'broken' };
    if (!check.ok) { toast(ST ? ST.REASONS[check.reason] : '불러오지 못했어요'); return; }
    armOrRun('set-import-go', IMPORT_LABEL, '지금 진행이 이 코드로 바뀌어요 · 한 번 더 누르기', function () {
      var r;
      try { r = hooks.importSave(check.json); } catch (e) { r = { ok: false, message: e.message }; }
      if (!r || !r.ok) { toast('불러오지 못했어요' + (r && r.message ? ': ' + r.message : '')); return; }
      toast('불러왔어요 · 다시 여는 중');
      setTimeout(function () { try { location.reload(); } catch (e) { /* 무시 */ } }, 700);
    });
  }
  function resetSave() {
    armOrRun('set-reset', RESET_LABEL, '모든 진행이 지워져요 · 한 번 더 누르기', function () {
      try { hooks.resetSave(); } catch (e) { toast('초기화하지 못했어요: ' + e.message); return; }
      toast('처음부터 다시 시작해요');
      setTimeout(function () { try { location.reload(); } catch (e) { /* 무시 */ } }, 700);
    });
  }

  /* ---------- 연결 ---------- */
  $('board').addEventListener('click', function (e) {
    if (FM()) { var rb = e.target.closest('.rowbtn'); if (rb) onRow(parseInt(rb.getAttribute('data-r'), 10)); return; }
    var card = e.target.closest('.card');
    if (card && card.hasAttribute('data-i')) onCard(parseInt(card.getAttribute('data-i'), 10));
  });
  $('tut-opts').addEventListener('click', function (e) {
    var card = e.target.closest('.card');
    if (card) onOption(parseInt(card.getAttribute('data-o'), 10));
  });
  $('btn-again').addEventListener('click', again);
  $('btn-home').addEventListener('click', goHome);
  $('btn-none').addEventListener('click', onNone);
  $('btn-hint').addEventListener('click', onHint);
  $('btn-sound').addEventListener('click', openSettings);
  $('h-sound').addEventListener('click', openSettings);
  $('set-close').addEventListener('click', closeSettings);
  $('btn-help').addEventListener('click', openHelp);
  $('set-credits').addEventListener('click', openCredits);
  $('set-x').addEventListener('click', closeSettings);
  $('help-x').addEventListener('click', closeHelp);
  $('credits-x').addEventListener('click', closeCredits);
  $('credits-close').addEventListener('click', closeCredits);
  $('credits-sheet').addEventListener('click', function (e) { if (e.target === this) closeCredits(); });
  $('h-help').addEventListener('click', openHelp);
  $('help-close').addEventListener('click', closeHelp);
  $('help-sheet').addEventListener('click', function (e) { if (e.target === this) closeHelp(); });
  $('settings-sheet').addEventListener('click', function (e) { if (e.target === this) closeSettings(); });
  // 막대: 움직이는 동안 바로 반영(input), 손을 떼면 저장(change)
  ['music', 'sfx'].forEach(function (k) {
    var el = $('set-' + k);
    el.addEventListener('input', function () {
      settings[k] = Math.max(0, Math.min(100, Math.round((+el.value || 0) / 5) * 5));
      $('set-' + k + '-v').textContent = settings[k];
      applyVolumes();
    });
    el.addEventListener('change', function () { saveSettings(); if (k === 'sfx') sfx.pick(1); });
  });
  $('set-vib').addEventListener('click', function () {
    settings.vibrate = !settings.vibrate;
    renderSettings(); saveSettings();
    buzz(30);   // 켰을 때만 실제로 떤다
  });
  $('set-tut').addEventListener('click', function () { closeSettings(); openTutorial(); });
  $('set-export').addEventListener('click', exportSave);
  $('set-import').addEventListener('click', showImport);
  $('set-import-go').addEventListener('click', importSave);
  $('set-reset').addEventListener('click', resetSave);
  $('btn-quit').addEventListener('click', openQuit);
  $('btn-quit-no').addEventListener('click', closeQuit);
  $('btn-quit-yes').addEventListener('click', quitToHome);
  $('quit-sheet').addEventListener('click', function (e) { if (e.target === this) closeQuit(); });
  $('tut-next').addEventListener('click', nextLesson);
  $('tut-close').addEventListener('click', goHome);
  $('tut-home').addEventListener('click', goHome);
  $('tut-start').addEventListener('click', again);
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!$('credits-sheet').hidden) closeCredits(); else if (!$('help-sheet').hidden) closeHelp(); else if (!$('settings-sheet').hidden) closeSettings(); else if (!$('quit-sheet').hidden) closeQuit();
  });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && game && !sheetOpen()) { cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); }
  });

  /* ---------- 로딩 화면 ----------
   * 연출(약 2.6초)과 글꼴 불러오기가 둘 다 끝나면 걷는다. 글꼴이 늦어도 4초면 걷는다(오프라인 등).
   *   (1.6초는 라인업을 볼 틈이 없어서 1초 늘렸다. 로딩 문구 셋이 하나씩 읽힐 만큼.)
   * 제작자 Guar 는 따로 한 장면을 쓰지 않고 아래에 작게 표시한다.
   * 화면을 누르면 0.4초 뒤부터 바로 건너뛴다. 걷은 뒤에는 DOM 에서 뺀다.
   */
  function runSplash() {
    var el = $('splash');
    if (!el) return;
    // 라인업: 네 특징이 다 보이는 용의자 셋(늘 한 패 — 첫 화면부터 규칙을 슬쩍 보여 준다)
    var a = Math.floor(Math.random() * 81), b;
    do { b = Math.floor(Math.random() * 81); } while (b === a);
    $('sp-lineup').innerHTML = [a, b, C.thirdCard(a, b)].map(function (id) {
      return '<div class="card" style="background:' + look(id).bg + '">' + cardInner(id) + '</div>';
    }).join('');

    var MSGS = ['사건 파일 펼치는 중', '용의자 몽타주 맞추는 중', '3팀 출근하는 중'];
    var t0 = now(), MIN = 2600, MAX = 4000, fontsReady = false, closed = false, step = 0;
    try {
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fontsReady = true; }, function () { fontsReady = true; });
      else fontsReady = true;
    } catch (e) { fontsReady = true; }

    function close() {
      if (closed) return;
      closed = true;
      clearInterval(timer);
      $('sp-fill').style.width = '100%';
      el.classList.add('out');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 380);
    }
    var timer = setInterval(function () {
      var t = now() - t0;
      // 로딩 줄은 연출 시간에 맞춰 차오르되, 글꼴을 기다리는 동안 90% 에서 멈춘다
      $('sp-fill').style.width = Math.min(fontsReady ? 100 : 90, Math.max(0, t / MIN * 100)) + '%';
      var s = Math.min(MSGS.length - 1, Math.floor(t / 900));
      if (s !== step) { step = s; $('sp-msg').textContent = MSGS[s]; }
      if ((t >= MIN && fontsReady) || t >= MAX) close();
    }, 100);
    el.addEventListener('click', function () { if (now() - t0 > 400) close(); });
  }

  /*
   * 뒤로 가기(안드로이드 앱의 뒤로 단추가 부른다). 'stay' = 게임이 처리함, 'exit' = 더 물러날 곳 없음.
   *   멈춤 창 → 닫고 계속 / 출동 중 → 멈춤 창 / 튜토리얼·결과 → 사무실 / 사무실 → exit
   */
  function back() {
    if (!$('credits-sheet').hidden) { closeCredits(); return 'stay'; }
    if (!$('help-sheet').hidden) { closeHelp(); return 'stay'; }
    if (!$('settings-sheet').hidden) { closeSettings(); return 'stay'; }
    if (!$('quit-sheet').hidden) { closeQuit(); return 'stay'; }
    if ($('s-play').classList.contains('on')) { openQuit(); return 'stay'; }
    if ($('s-tutorial').classList.contains('on') || $('s-result').classList.contains('on')) { goHome(); return 'stay'; }
    return 'exit';
  }

  if (FX) FX.setSound({ horn: function () { sfx.horn(); } });
  window.SuspectsUI = {
    hooks: hooks, show: show, back: back, startRun: startRun, goHome: goHome,
    openTutorial: openTutorial, toast: toast, sfx: sfx, buzz: buzz, store: store, renderSound: renderSound, music: music,
    openSettings: openSettings, closeSettings: closeSettings, openHelp: openHelp, closeHelp: closeHelp, settings: function () { return settings; },
    sheetOpen: sheetOpen, playing: playing,
    _peek: function () { return game; }   // 화면 시험용(지금 판 읽기). 게임 진행에는 쓰지 않는다
  };

  renderSound();
  runSplash();
  // 첫 화면(사무실)은 hub.js 가 띄운다
})();
