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
    '.sc-back{position:absolute;inset:0;z-index:70;display:flex;flex-direction:column;overflow:hidden;color:#F1F3F7;background:#080B12;animation:scin .5s ease-out}',
    '.sc-sky{position:absolute;inset:0;background:radial-gradient(120% 70% at 50% 100%,var(--sc-glow) 0%,transparent 60%),linear-gradient(180deg,#05070C 0%,var(--sc-top) 55%,var(--sc-low) 100%)}',
    '.sc-city{position:absolute;left:0;right:0;bottom:0;width:100%;height:34%;opacity:.9}',
    '.sc-lamp{position:absolute;left:50%;bottom:26%;width:150%;height:40%;transform:translateX(-50%);background:radial-gradient(closest-side,var(--sc-lamp),transparent);animation:scpulse 3.2s ease-in-out infinite}',
    '.sc-skip{position:absolute;top:calc(12px + env(safe-area-inset-top));right:12px;z-index:2;border:0;border-radius:999px;padding:8px 14px;background:rgba(255,255,255,.1);color:#C9CFDA;font:inherit;font-size:13px;font-weight:700}',
    '.sc-body{position:relative;flex:1;display:flex;flex-direction:column;justify-content:center;gap:14px;padding:64px 26px 20px}',
    '.sc-head{display:flex;flex-direction:column;gap:4px;margin-bottom:6px}',
    '.sc-kick{font-size:13px;font-weight:800;letter-spacing:.14em;color:var(--sc-acc)}',
    '.sc-title{font-family:"Black Han Sans",sans-serif;font-weight:400;font-size:34px;line-height:1.15}',
    '.sc-sub{font-size:13px;color:#98A1B2}',
    '.sc-line{margin:0;font-size:17px;line-height:1.6;opacity:.45;transition:opacity .4s;animation:scup .5s ease-out}',
    '.sc-line.now{opacity:1}.sc-line.hint{font-size:13.5px;color:#FFE58A;text-align:left;margin-top:6px}','.sc-body,.sc-line{text-align:left}',
    '.sc-foot{position:relative;padding:0 22px calc(22px + env(safe-area-inset-bottom));min-height:86px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:8px}',
    '.sc-tap{font-size:12.5px;color:#98A1B2;animation:scblink 1.6s ease-in-out infinite}',
    '.sc-go{width:100%;height:56px;border:0;border-radius:16px;background:linear-gradient(180deg,#FFE066,#F6B91C);box-shadow:0 4px 0 #A87A0B;color:#1B1500;font-family:"Black Han Sans",sans-serif;font-size:21px}',
    '.sc-back.out{animation:scout .35s ease-in forwards}',
    '.sc-t-intro,.sc-t-c1{--sc-top:#0C1424;--sc-low:#16233C;--sc-glow:rgba(229,72,79,.28);--sc-lamp:rgba(79,140,255,.16);--sc-acc:#FFD23F}',
    '.sc-t-c2{--sc-top:#08171B;--sc-low:#12333A;--sc-glow:rgba(120,200,210,.26);--sc-lamp:rgba(200,235,240,.14);--sc-acc:#7FE0E8}',
    '.sc-t-c3{--sc-top:#17100A;--sc-low:#33230F;--sc-glow:rgba(255,190,90,.26);--sc-lamp:rgba(255,220,150,.14);--sc-acc:#FFC86B}',
    '.sc-t-cx{--sc-top:#120C1C;--sc-low:#231838;--sc-glow:rgba(170,120,255,.26);--sc-lamp:rgba(200,170,255,.14);--sc-acc:#C9B8FF}',
    '@keyframes scin{from{opacity:0}}@keyframes scout{to{opacity:0}}@keyframes scup{from{opacity:0;transform:translateY(10px)}}',
    '@keyframes scpulse{50%{opacity:.45}}@keyframes scblink{50%{opacity:.35}}',
    '@media (prefers-reduced-motion:reduce){.sc-back,.sc-line,.sc-lamp,.sc-tap{animation:none}}',
    '@media (max-height:700px){.sc-title{font-size:28px}.sc-line{font-size:15.5px}.sc-body{gap:10px;padding-top:54px}}'
  ].join('\n');
  var styled = false;
  function style() { if (styled) return; styled = true; var s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // 도시 윤곽(건물 높이는 정해진 값 — 볼 때마다 같게)
  var CITY = (function () {
    var hs = [38, 62, 30, 80, 52, 44, 92, 36, 70, 48, 58, 28, 76, 40, 66, 34], x = 0, d = '', win = '';
    hs.forEach(function (h, i) { var w = 22 + (i * 7) % 12; d += 'M' + x + ' 100V' + (100 - h) + 'H' + (x + w) + 'V100Z';
      for (var k = 0; k < 3; k++) if ((i + k) % 3 === 0) win += '<rect x="' + (x + 5 + (k * 5) % (w - 9)) + '" y="' + (100 - h + 8 + k * 11) + '" width="3" height="4"/>';
      x += w + 2; });
    return '<svg class="sc-city" viewBox="0 0 ' + x + ' 100" preserveAspectRatio="none" aria-hidden="true"><path d="' + d + '" fill="#05070C"/><g fill="#FFD98A" opacity=".55">' + win + '</g></svg>';
  })();

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
      el.innerHTML = '<div class="sc-sky"></div><div class="sc-lamp"></div>' + CITY + '<button class="sc-skip">건너뛰기</button>' +
        '<div class="sc-body">' + (o.title ? '<div class="sc-head">' + (o.kicker ? '<span class="sc-kick">' + esc(o.kicker) + '</span>' : '') + '<b class="sc-title">' + esc(o.title) + '</b>' + (o.sub ? '<span class="sc-sub">' + esc(o.sub) + '</span>' : '') + '</div>' : '') +
        '<div class="sc-lines"></div></div><div class="sc-foot"><span class="sc-tap">화면을 누르면 다음</span></div>';
      var box = el.querySelector('.sc-lines'), foot = el.querySelector('.sc-foot');
      var close = function () { if (!el.parentNode) { finish(); return; } el.classList.add('out'); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); finish(); }, 340); };
      playing = function () { if (el.parentNode) el.parentNode.removeChild(el); finish(); };
      var next = function () {
        if (i >= lines.length) return;
        Array.prototype.forEach.call(box.children, function (p) { p.classList.remove('now'); });
        var p = document.createElement('p'); p.className = 'sc-line now'; p.textContent = lines[i++]; box.appendChild(p);
        if (i >= lines.length) {
          if (o.hint) { var h = document.createElement('p'); h.className = 'sc-line now hint'; h.textContent = o.hint; box.appendChild(h); }
          foot.innerHTML = '<button class="sc-go">' + esc(o.last || '수사 시작') + '</button>';
        }
      };
      el.addEventListener('click', function (e) {
        if (e.target.closest('.sc-skip') || e.target.closest('.sc-go')) { close(); return; }
        next();
      });
      host.appendChild(el);
      if (lines.length) next(); else foot.innerHTML = '<button class="sc-go">' + esc(o.last || '수사 시작') + '</button>';
    } catch (e) { finish(); }
  }
  root.Team3Scene = { play: play, sentences: sentences, isPlaying: function () { return !!playing; } };
})(typeof self !== 'undefined' ? self : this);
