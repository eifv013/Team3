/*
 * 배경 음악 재생기(0.1.16) — 화면마다 곡 하나를 끊김 없이 되풀이하고, 곡이 바뀔 때는 서서히 넘긴다.
 *
 *   곡 정보는 music.js(tools/make_music.py 가 만든다): { 이름: { file, loopStart, duration, credit } }
 *   파일은 게임 페이지 옆 music/ 폴더에 있고, 처음 필요할 때 한 번만 받아 풀어 둔다(fetch → decodeAudioData).
 *
 *   흐름: want(이름)  — "지금 이 곡이 나와야 한다"고 적어 둔다. 소리를 낼 수 있으면 바로 넘긴다.
 *         wake()      — 화면을 누를 때마다 부른다. 브라우저는 사람이 누르기 전엔 소리를 막으므로,
 *                       막혀 있던 곡을 이때 튼다. 이미 나오고 있으면 아무것도 안 한다.
 *         setMuted(b) — 소리 끔이면 서서히 줄여 멈추고, 켬이면 적어 둔 곡을 다시 튼다.
 *
 *   되풀이: AudioBufferSourceNode 의 loop 를 쓴다. loopStart~끝을 되풀이하므로 앞 인트로는 한 번만 나온다.
 *           (mp3 의 앞뒤 빈 소리는 LAME 머리말을 읽는 브라우저가 잘라 준다 → 이음새에 틈이 없다)
 *   실패: 파일을 못 받거나 못 풀면 그 곡은 조용히 넘어간다(게임은 그대로). 다음 want 때 한 번 더 받아 본다.
 *
 * DOM 을 모른다. 소리 장치(AudioContext)와 fetch 를 밖에서 받아서 node 단위 시험에서 가짜로 바꿀 수 있다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Team3Bgm = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FADE = 1.2;        // 곡을 넘길 때 서서히 줄고 커지는 시간(초)
  var STOP_FADE = 0.35;  // 소리 끔·화면 떠남 때 줄이는 시간(초)
  var DUCK = 0.35;       // 낮추기(duck): 출동 마지막 10초에 시계 초침이 잘 들리게 음악을 이만큼으로 줄인다
  var DUCK_FADE = 0.4;   // 낮추고 되돌리는 데 걸리는 시간(초)
  var DIM = 0.3;         // 흐리게(dim, 0.1.18): 멈춤·설정 창이 떠 있는 동안 음악을 이만큼으로 줄인다

  /**
   * @param {object} o
   *   context  : function() → AudioContext 또는 null(소리 끔·미지원)
   *   music    : 곡 정보(music.js)
   *   fetch    : function(url) → Promise<Response> (기본: 전역 fetch)
   *   gain     : 배경 음악 전체 크기(0~1, 기본 0.6). 효과음보다 뒤에 깔리게 한다
   *   base     : 파일 경로 앞에 붙일 주소(기본 '')
   */
  function createPlayer(o) {
    o = o || {};
    var getCtx = typeof o.context === 'function' ? o.context : function () { return null; };
    var music = o.music || {};
    var doFetch = o.fetch || (typeof fetch === 'function' ? function (u) { return fetch(u); } : null);
    var volume = typeof o.gain === 'number' && o.gain >= 0 ? o.gain : 0.6;
    var base = o.base || '';

    var wanted = null;     // 나와야 하는 곡 이름(null = 조용히)
    var muted = false;
    var bus = null, busCtx = null;   // 배경 음악 전체 크기 노드(효과음 리미터를 거치지 않고 바로 스피커로)
    var current = null;    // { name, src, gain }
    var buffers = {};      // 이름 → AudioBuffer
    var loading = {};      // 이름 → true(받는 중)
    var ducked = false;    // 지금 음악을 낮춰 둔 상태인가(마지막 10초)
    var dimmed = false;    // 멈춤·설정 창 때문에 흐리게 해 둔 상태인가
    // 버스가 가야 할 크기 = 설정 크기 × 낮추기 × 흐리게(둘이 겹치면 곱해진다)
    function target() { return volume * (ducked ? DUCK : 1) * (dimmed ? DIM : 1); }

    function ctx() {
      if (muted) return null;
      var a = null;
      try { a = getCtx(); } catch (e) { a = null; }
      if (!a) return null;
      if (busCtx !== a) {   // 소리 장치가 새로 생겼으면 버스도 새로
        try {
          bus = a.createGain(); bus.gain.value = target(); bus.connect(a.destination); busCtx = a;
          current = null;
        } catch (e) { bus = null; busCtx = null; return null; }
      }
      return a;
    }

    // 곡 하나 받기 → 풀기. 끝나면 아직 그 곡이 나와야 할 때만 튼다.
    function load(name, a) {
      if (buffers[name] || loading[name]) return;
      var m = music[name];
      if (!m || !m.file || !doFetch) return;
      loading[name] = true;
      var done = function () { loading[name] = false; };
      try {
        doFetch(base + m.file).then(function (res) {
          if (!res || !res.ok) throw new Error('받기 실패 ' + (res && res.status));
          return res.arrayBuffer();
        }).then(function (data) {
          // 옛 사파리는 decodeAudioData 가 Promise 를 안 돌려준다 → 콜백 방식
          a.decodeAudioData(data, function (buf) {
            buffers[name] = buf; done();
            if (wanted === name) start(name);
          }, function () { done(); });
        }).catch(function () { done(); });
      } catch (e) { done(); }
    }

    function fadeOutAndStop(t, a, sec) {
      if (!t) return;
      try {
        var now = a.currentTime;
        t.gain.gain.cancelScheduledValues(now);
        t.gain.gain.setValueAtTime(t.gain.gain.value, now);
        t.gain.gain.linearRampToValueAtTime(0, now + sec);
        t.src.stop(now + sec + 0.05);
      } catch (e) { /* 이미 멈춤 */ }
    }

    // 지금 곡을 서서히 줄이고 name 을 서서히 키운다
    function start(name) {
      var a = ctx();
      if (!a || !bus) return;
      if (current && current.name === name) return;
      var buf = buffers[name];
      if (!buf) { load(name, a); return; }
      var m = music[name], old = current;
      try {
        var src = a.createBufferSource(), g = a.createGain(), now = a.currentTime;
        src.buffer = buf;
        src.loop = true;
        var ls = Math.max(0, Math.min(m.loopStart || 0, buf.duration - 0.5));
        src.loopStart = ls;
        src.loopEnd = buf.duration;
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(1, now + (old ? FADE : 0.4));
        src.connect(g); g.connect(bus);
        src.start(now);
        current = { name: name, src: src, gain: g };
      } catch (e) { current = old; return; }
      fadeOutAndStop(old, a, FADE);
    }

    function stopAll(sec) {
      var a = busCtx;
      if (current && a) fadeOutAndStop(current, a, sec);
      current = null;
    }

    // 버스 크기를 목표로 서서히 옮긴다(낮추기·되돌리기)
    function rampBus(level) {
      if (!bus || !busCtx) return;
      try {
        var now = busCtx.currentTime;
        bus.gain.cancelScheduledValues(now);
        bus.gain.setValueAtTime(bus.gain.value, now);
        bus.gain.linearRampToValueAtTime(level, now + DUCK_FADE);
      } catch (e) { /* 무시 */ }
    }

    return {
      /**
       * 음악 낮추기 켬/끔. 같은 값이 계속 와도(매 프레임) 바뀔 때만 움직인다.
       *   출동 마지막 10초에 켜고, 검거로 시간이 늘어 10초를 넘거나 화면이 바뀌면 끈다.
       */
      duck: function (on) {
        on = !!on;
        if (on === ducked) return;
        ducked = on;
        rampBus(target());
      },
      /** 흐리게 켬/끔: 멈춤·설정 창이 떠 있는 동안. 바뀔 때만 움직인다. */
      dim: function (on) {
        on = !!on;
        if (on === dimmed) return;
        dimmed = on;
        rampBus(target());
      },
      /** 설정의 음악 크기(0~1, 곡선을 거친 값). 0 이어도 멈추지는 않는다(끄기는 setMuted). */
      setVolume: function (v) {
        if (!(typeof v === 'number' && isFinite(v))) return;
        volume = Math.max(0, Math.min(1, v));
        rampBus(target());
      },
      want: function (name) {
        wanted = music[name] ? name : null;
        if (!wanted) { stopAll(STOP_FADE); return; }
        start(wanted);
      },
      // ctx() 를 먼저 부른다: 밖의 context 함수가 막혀 있던(suspended) 소리 장치를 이때 깨운다
      wake: function () { if (!ctx()) return; if (wanted && (!current || current.name !== wanted)) start(wanted); },
      setMuted: function (b) {
        muted = !!b;
        if (muted) stopAll(STOP_FADE); else if (wanted) start(wanted);
      },
      // 시험·디버그용: 지금 상태
      state: function () {
        return { wanted: wanted, playing: current ? current.name : null, muted: muted, ducked: ducked, dimmed: dimmed, volume: volume,
                 loaded: Object.keys(buffers), loading: Object.keys(loading).filter(function (k) { return loading[k]; }) };
      }
    };
  }

  /** 출처 목록(패치노트 창 아래 '음악' 칸에 쓴다). 제목이 있는 곡만, 같은 곡은 한 번만. */
  function credits(music) {
    var seen = {}, out = [];
    Object.keys(music || {}).forEach(function (k) {
      var c = music[k] && music[k].credit;
      if (!c || !c.title || seen[c.title]) return;
      seen[c.title] = true;
      out.push(c);
    });
    return out;
  }

  return { createPlayer: createPlayer, credits: credits, FADE: FADE, DUCK: DUCK, DIM: DIM };
});
