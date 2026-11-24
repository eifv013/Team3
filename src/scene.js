/*
 * 수사 3팀 — 이야기 장면(0.11.0)
 *
 * 화면 전체를 덮고 글을 한 줄씩 보여 준다. 처음 시작할 때(프롤로그 + 사건 1)와 사건이 넘어갈 때 쓴다.
 *   구조: Team3Scene.play({ tone, kicker, title, sub, lines[], hint, last, onDone })
 *     - 화면을 누르면 다음 줄, 마지막 줄 뒤에는 아래 단추(last, 기본 "수사 시작")로 끝낸다. 오른쪽 위 "건너뛰기"는 언제나.
 *     - onDone 은 어떤 경우에도(건너뛰기, 오류, 시험 환경) 정확히 한 번 불린다 → 뒤 흐름(튜토리얼 권유 등)이 막히지 않는다.
 *     - 시험 도구는 window.__noScene(또는 __noAttendPop)을 켜서 장면 없이 바로 onDone.
 *   sentences(text): 일지 글을 문장 단위로 나누는 순수 함수(node 단위 테스트).
 */
(function (root) {
  'use strict';
  /** 글을 문장으로 나눈다. 따옴표 안의 마침표에서는 끊지 않는다 */
  function sentences(text) {
    var out = [], cur = '', q = false;
    String(text == null ? '' : text).split('').forEach(function (ch, i, a) {
      cur += ch;
      if (ch === '"' || ch === '“' || ch === '”') q = ch === '“' ? true : ch === '”' ? false : !q;
      var end = /[.?!]/.test(ch) && !q, endQ = (ch === '"' || ch === '”') && !q && /[.?!]/.test(a[i - 1] || '');
      if ((end || endQ) && (a[i + 1] === undefined || /\s/.test(a[i + 1]))) { out.push(cur.trim()); cur = ''; }
    });
    if (cur.trim()) out.push(cur.trim());
    return out.filter(Boolean);
  }
  if (typeof document === 'undefined') { if (typeof module !== 'undefined') module.exports = { sentences: sentences }; return; }

  var CSS = [
    '.sc-back{position:absolute;inset:0;z-index:70;display:flex;flex-direction:column;overflow:hidden;color:#F1F3F7;background:#05070C;animation:scin .6s ease-out}',
    '.sc-sky{position:absolute;inset:0;background:linear-gradient(180deg,#04060A 0%,var(--sc-top) 48%,var(--sc-low) 100%)}',
    '.sc-moon{position:absolute;right:14%;top:17%;width:64px;height:64px;border-radius:50%;background:radial-gradient(circle at 38% 36%,#FFF6DC,#E9D9A8 60%,#B9A66E);box-shadow:0 0 50px 14px var(--sc-moon);opacity:.9}',
    '.sc-far,.sc-near{position:absolute;left:-6%;bottom:0;width:112%;animation:scdrift 26s ease-in-out infinite alternate}',
    '.sc-far{height:40%;opacity:.55;filter:blur(1px);animation-duration:38s}.sc-near{height:30%;animation-direction:alternate-reverse}',
    '.sc-glow{position:absolute;left:0;right:0;bottom:0;height:46%;background:radial-gradient(90% 100% at 50% 100%,var(--sc-glow),transparent 70%)}',
    /* 사건 1 · 처음: 경광등(빨강 · 파랑)이 번갈아 번지고 비가 내린다 */
    '.sc-siren{position:absolute;left:0;right:0;bottom:0;height:52%;mix-blend-mode:screen}',
    '.sc-siren i{position:absolute;bottom:-20%;width:90%;height:100%;border-radius:50%;filter:blur(30px);opacity:0;animation:scsiren 1.5s steps(1) infinite}',
    '.sc-siren i:first-child{left:-30%;background:radial-gradient(closest-side,rgba(255,60,70,.75),transparent)}',
    '.sc-siren i:last-child{right:-30%;background:radial-gradient(closest-side,rgba(60,120,255,.75),transparent);animation-delay:.75s}',
    '.sc-rain{position:absolute;inset:-10% 0 0 0;transform:rotate(9deg)}',
    '.sc-rain i{position:absolute;top:-12%;width:1.5px;height:11%;background:linear-gradient(transparent,rgba(190,215,255,.55));animation:scrain linear infinite}',
    /* 사건 2: 등대 불빛이 돌고 안개가 흐른다 */
    '.sc-beam{position:absolute;right:18%;top:30%;width:0;height:0}',
    '.sc-beam::before{content:"";position:absolute;left:-170vmax;top:-170vmax;width:340vmax;height:340vmax;background:conic-gradient(from 0deg,transparent 0 80deg,rgba(220,245,250,.20) 86deg,rgba(220,245,250,.34) 90deg,rgba(220,245,250,.20) 94deg,transparent 100deg 360deg);animation:scspin 9s linear infinite}',
    '.sc-beam::after{content:"";position:absolute;left:-7px;top:-7px;width:14px;height:14px;border-radius:50%;background:#F4FFFF;box-shadow:0 0 26px 10px rgba(200,245,250,.8)}',
    '.sc-fog{position:absolute;left:-60%;width:220%;height:26%;border-radius:50%;background:radial-gradient(closest-side,rgba(205,232,236,.26),transparent);filter:blur(14px);animation:scfog 22s ease-in-out infinite alternate}',
    /* 사건 3: 취조실 등 하나가 흔들리고 블라인드 그림자가 진다 */
    '.sc-lampc{position:absolute;left:50%;top:-4%;width:150%;height:92%;transform-origin:50% 0;transform:translateX(-50%);background:conic-gradient(from 152deg at 50% 0,transparent 0 0deg,rgba(255,214,140,.30) 6deg,rgba(255,224,160,.42) 28deg,rgba(255,214,140,.30) 50deg,transparent 56deg 360deg);animation:scswing 5.5s ease-in-out infinite}',
    '.sc-bulb{position:absolute;left:50%;top:0;width:2px;height:7%;background:#2A2118;transform:translateX(-50%)}.sc-bulb::after{content:"";position:absolute;left:-8px;bottom:-14px;width:18px;height:18px;border-radius:50%;background:#FFF1C9;box-shadow:0 0 34px 14px rgba(255,214,140,.75)}',
    '.sc-blind{position:absolute;inset:0;background:repeating-linear-gradient(176deg,transparent 0 26px,rgba(0,0,0,.34) 26px 40px);opacity:.75}',
    '.sc-dust i{position:absolute;width:3px;height:3px;border-radius:50%;background:rgba(255,236,190,.7);animation:scdust ease-in-out infinite alternate}',
    '.sc-vig{position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 45%,transparent 55%,rgba(0,0,0,.7) 100%);pointer-events:none}',
    '.sc-bar{position:absolute;left:0;right:0;height:7%;background:#000;z-index:1;animation:scbar .7s cubic-bezier(.2,.8,.2,1) both}.sc-bar.t{top:0;transform-origin:50% 0}.sc-bar.b{bottom:0;transform-origin:50% 100%}',
    '.sc-skip{position:absolute;top:calc(10px + env(safe-area-inset-top));right:12px;z-index:3;border:0;border-radius:999px;padding:8px 14px;background:rgba(255,255,255,.12);color:#D5DAE3;font:inherit;font-size:13px;font-weight:700}',
    '.sc-body{position:relative;z-index:2;flex:1;display:flex;flex-direction:column;justify-content:center;gap:12px;padding:16% 26px 4%;text-align:left}',
    '.sc-head{position:relative;display:flex;flex-direction:column;gap:5px;margin-bottom:8px}',
    '.sc-kick{font-size:13px;font-weight:800;letter-spacing:.2em;color:var(--sc-acc);animation:scup .5s .25s both}',
    '.sc-title{font-family:"Black Han Sans",sans-serif;font-weight:400;font-size:40px;line-height:1.12;text-shadow:0 3px 0 rgba(0,0,0,.55),0 0 26px var(--sc-moon);animation:scslam .55s .45s cubic-bezier(.2,1.5,.4,1) both}',
    '.sc-rule{height:3px;width:64px;border-radius:2px;background:var(--sc-acc);transform-origin:0 50%;animation:scrule .5s .8s both}',
    '.sc-sub{font-size:13px;color:#A9B2C2;letter-spacing:.06em;animation:scup .5s .9s both}',
    '.sc-stamp{position:absolute;right:0;top:-6px;padding:4px 10px;border:3px solid #E5484F;border-radius:6px;color:#E5484F;font-family:"Black Han Sans",sans-serif;font-size:17px;letter-spacing:.08em;transform:rotate(-11deg);opacity:.92;animation:scstamp .4s 1.15s cubic-bezier(.2,1.6,.4,1) both}',
    '.sc-line{margin:0;font-size:17px;line-height:1.62;opacity:.42;transition:opacity .5s;text-shadow:0 1px 6px rgba(0,0,0,.8);text-align:left}',
    '.sc-line.now{opacity:1}.sc-line.say{font-weight:800;color:#FFF3C4}.sc-line.hint{font-size:13.5px;color:#FFE58A;margin-top:6px}',
    '.sc-line.typing::after{content:"";display:inline-block;width:2px;height:1em;margin-left:3px;background:var(--sc-acc);vertical-align:-2px;animation:scblink .6s steps(1) infinite}',
    '.sc-foot{position:relative;z-index:2;padding:0 22px calc(9% + 14px + env(safe-area-inset-bottom));min-height:96px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:8px}',
    '.sc-tap{font-size:12.5px;color:#A9B2C2;animation:scblink 1.6s ease-in-out infinite}',
    '.sc-go{width:100%;height:56px;border:0;border-radius:16px;background:linear-gradient(180deg,#FFE066,#F6B91C);box-shadow:0 4px 0 #A87A0B,0 0 30px rgba(255,210,63,.35);color:#1B1500;font-family:"Black Han Sans",sans-serif;font-size:21px;animation:scup .4s both}',
    '.sc-back.out{animation:scout .4s ease-in forwards}',
    '.sc-t-intro,.sc-t-c1{--sc-top:#0B1426;--sc-low:#1B2A4A;--sc-glow:rgba(120,80,160,.35);--sc-moon:rgba(160,190,255,.35);--sc-acc:#FFD23F}',
    '.sc-t-c2{--sc-top:#07181C;--sc-low:#15404A;--sc-glow:rgba(120,200,210,.3);--sc-moon:rgba(170,235,240,.4);--sc-acc:#7FE0E8}',
    '.sc-t-c3{--sc-top:#140D07;--sc-low:#2E1F0D;--sc-glow:rgba(255,190,90,.22);--sc-moon:rgba(255,214,140,.4);--sc-acc:#FFC86B}',
    '.sc-t-cx{--sc-top:#120C1C;--sc-low:#261A3E;--sc-glow:rgba(170,120,255,.3);--sc-moon:rgba(200,170,255,.4);--sc-acc:#C9B8FF}',
    '@keyframes scin{from{opacity:0}}@keyframes scout{to{opacity:0}}@keyframes scup{from{opacity:0;transform:translateY(10px)}}',
    '@keyframes scslam{from{opacity:0;transform:scale(1.5);filter:blur(6px)}}@keyframes scrule{from{transform:scaleX(0)}}',
    '@keyframes scstamp{from{opacity:0;transform:rotate(-11deg) scale(2.4)}}@keyframes scbar{from{transform:scaleY(0)}}',
    '@keyframes scdrift{to{transform:translateX(5%)}}@keyframes scblink{50%{opacity:.25}}',
    '@keyframes scsiren{0%{opacity:.9}50%{opacity:0}}@keyframes scrain{to{transform:translateY(125vh)}}',
    '@keyframes scspin{to{transform:rotate(360deg)}}@keyframes scfog{to{transform:translateX(26%)}}',
    '@keyframes scswing{0%,100%{transform:translateX(-50%) rotate(-4deg)}50%{transform:translateX(-50%) rotate(4deg)}}@keyframes scdust{to{transform:translate(18px,-26px);opacity:.15}}',
    '@media (prefers-reduced-motion:reduce){.sc-back *,.sc-back{animation:none!important}}',
    '@media (max-height:700px){.sc-title{font-size:32px}.sc-line{font-size:15.5px;line-height:1.55}.sc-body{gap:9px}.sc-moon{width:48px;height:48px}}'
  ].join('\n');
  var styled = false;
  function style() { if (styled) return; styled = true; var s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // 도시 윤곽 두 겹(먼 것 · 가까운 것). 높이는 정해진 값 — 볼 때마다 같게
  function city(cls, hs, fill, lit) {
    var x = 0, d = '', win = '';
    hs.forEach(function (h, i) { var w = 20 + (i * 7) % 14; d += 'M' + x + ' 100V' + (100 - h) + 'H' + (x + w * .3) + 'V' + (100 - h - (i % 3 === 0 ? 7 : 0)) + 'H' + (x + w * .5) + 'V' + (100 - h) + 'H' + (x + w) + 'V100Z';
      for (var r = 0; r < Math.floor(h / 11); r++) for (var k = 0; k < 3; k++) if ((i * 5 + r * 3 + k * 7) % 5 < 2) win += '<rect x="' + (x + 3 + k * (w - 8) / 3) + '" y="' + (100 - h + 6 + r * 10) + '" width="' + ((w - 8) / 5) + '" height="4"/>';
      x += w + 1; });
    return '<svg class="' + cls + '" viewBox="0 0 ' + x + ' 100" preserveAspectRatio="none" aria-hidden="true"><path d="' + d + '" fill="' + fill + '"/><g fill="#FFD98A" opacity="' + lit + '">' + win + '</g></svg>';
  }
  var FAR = city('sc-far', [44, 70, 52, 88, 60, 40, 96, 58, 74, 46, 82, 50, 66, 90, 54, 62], '#0B1220', .22),
      NEAR = city('sc-near', [36, 58, 28, 72, 48, 40, 84, 32, 64, 44, 54, 26, 70, 38, 60, 30], '#04060A', .6);
  function many(n, fn) { var h = ''; for (var i = 0; i < n; i++) h += fn(i); return h; }
  // 사건(색)마다 다른 날씨 · 빛
  function fx(tone) {
    if (tone === 'c2') return '<div class="sc-beam"></div>' + many(3, function (i) { return '<div class="sc-fog" style="bottom:' + (8 + i * 15) + '%;animation-duration:' + (18 + i * 7) + 's;animation-delay:-' + (i * 5) + 's"></div>'; });
    if (tone === 'c3') return '<div class="sc-lampc"></div><div class="sc-bulb"></div><div class="sc-blind"></div><div class="sc-dust">' + many(14, function (i) { return '<i style="left:' + ((i * 37) % 90 + 5) + '%;top:' + ((i * 53) % 60 + 12) + '%;animation-duration:' + (4 + i % 5) + 's"></i>'; }) + '</div>';
    return '<div class="sc-siren"><i></i><i></i></div><div class="sc-rain">' + many(34, function (i) { return '<i style="left:' + ((i * 29) % 100) + '%;animation-duration:' + (0.55 + (i % 7) * 0.09) + 's;animation-delay:-' + ((i * 13) % 10) / 10 + 's;opacity:' + (0.35 + (i % 4) * 0.15) + '"></i>'; }) + '</div>';
  }

  var playing = null;
  function play(o) {
    o = o || {};
    var done = false, finish = function () { if (done) return; done = true; playing = null; try { if (typeof o.onDone === 'function') o.onDone(); } catch (e) { /* 뒤 흐름 오류는 장면 탓이 아니다 */ } };
    var host = o.host || (document.getElementById('toast') || {}).parentNode || document.body;
    if (root.__noScene || root.__noAttendPop || !host) { finish(); return; }
    try {
      style();
      if (playing) playing();
      var lines = (o.lines || []).filter(Boolean), i = 0, el = document.createElement('div');
      el.className = 'sc-back sc-t-' + (o.tone || 'intro');
      el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', o.title || '이야기');
      var tone = o.tone || 'intro', slow = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.innerHTML = '<div class="sc-sky"></div>' + (tone === 'c3' ? '' : '<div class="sc-moon"></div>' + FAR) + '<div class="sc-glow"></div>' + (tone === 'c3' ? '' : NEAR) + fx(tone) +
        '<div class="sc-vig"></div><div class="sc-bar t"></div><div class="sc-bar b"></div><button class="sc-skip">건너뛰기</button>' +
        '<div class="sc-body">' + (o.title ? '<div class="sc-head">' + (o.kicker ? '<span class="sc-kick">' + esc(o.kicker) + '</span>' : '') + '<b class="sc-title">' + esc(o.title) + '</b><span class="sc-rule"></span>' +
          (o.sub ? '<span class="sc-sub">' + esc(o.sub) + '</span>' : '') + (o.stamp ? '<span class="sc-stamp">' + esc(o.stamp) + '</span>' : '') + '</div>' : '') +
        '<div class="sc-lines"></div></div><div class="sc-foot"><span class="sc-tap">화면을 누르면 다음</span></div>';
      var box = el.querySelector('.sc-lines'), foot = el.querySelector('.sc-foot'), timer = 0, cur = null, full = '';
      var close = function () { clearInterval(timer); if (!el.parentNode) { finish(); return; } el.classList.add('out'); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); finish(); }, 380); };
      playing = function () { clearInterval(timer); if (el.parentNode) el.parentNode.removeChild(el); finish(); };
      var ended = function () {
        clearInterval(timer); timer = 0; if (cur) { cur.textContent = full; cur.classList.remove('typing'); }
        if (i >= lines.length && !foot.querySelector('.sc-go')) {
          if (o.hint) { var h = document.createElement('p'); h.className = 'sc-line now hint'; h.textContent = o.hint; box.appendChild(h); }
          foot.innerHTML = '<button class="sc-go">' + esc(o.last || '수사 시작') + '</button>';
        }
      };
      // 한 줄씩 타자 치듯. 치는 중에 누르면 그 줄을 바로 다 보여 준다
      var next = function () {
        if (timer) { ended(); return; }
        if (i >= lines.length) return;
        Array.prototype.forEach.call(box.children, function (p) { p.classList.remove('now'); });
        full = lines[i++]; cur = document.createElement('p'); cur.className = 'sc-line now typing' + (/^["“]/.test(full) ? ' say' : ''); box.appendChild(cur);
        if (slow) { ended(); return; }
        var n = 0, chars = Array.from(full);
        timer = setInterval(function () { n += 1; cur.textContent = chars.slice(0, n).join(''); if (n >= chars.length) ended(); }, 28);
      };
      el.addEventListener('click', function (e) {
        if (e.target.closest('.sc-skip') || e.target.closest('.sc-go')) { close(); return; }
        next();
      });
      host.appendChild(el);
      if (lines.length) setTimeout(next, o.title && !slow ? 1300 : 0); else foot.innerHTML = '<button class="sc-go">' + esc(o.last || '수사 시작') + '</button>';
    } catch (e) { finish(); }
  }
  root.Team3Scene = { play: play, sentences: sentences, isPlaying: function () { return !!playing; } };
})(typeof self !== 'undefined' ? self : this);
