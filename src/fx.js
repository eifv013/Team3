/*
 * Team3Fx — 현장 출동 화면 연출(0.2.0). 사건마다 무대가 다르다.
 *   사건 1 "골목길 연쇄 절도" = CCTV 화면: 주사선·녹화 표시·시각, 고른 사람을 잇는 붉은 실, 검거 MATCH, 오인 체포 화면 깨짐,
 *                               단계가 오르면 카메라 채널 전환, 주범 조는 경광등이 화면 가장자리를 물들인다.
 *   사건 2 "안개 속 목격자들" = 해무항 부두: 겹겹이 흐르는 안개, 등대 빛(닿은 카드가 밝아짐), 빗줄기,
 *                               검거하면 안개가 그 자리부터 걷히고 증거 사진이 현상돼 증거 보드로 날아감,
 *                               함정은 셔터·붉은 테두리, 단계가 오르면 안개가 밀려옴, 주범 조는 배 그림자와 뱃고동.
 *   사건 3 "증인의 기억"(0.5.0)  = 중앙서 면통실: 위에서 깜빡이는 형광등, 반투명 유리 반사, 키 눈금 벽(판이 그린다),
 *                               검거하면 카메라 플래시 · "검거" 도장 · 나머지 줄은 어두워짐, 오인 지목은 형광등이 지직 꺼졌다 켜짐,
 *                               단계가 오르면 조명이 한 줄씩 다시 켜짐, 주범 조(써드의 줄)는 붉은 경고등이 천천히 돈다.
 *   0 = 연출 없음(몽타주 수배: 종이가 연출을 맡는다)
 *
 * 규칙: 연출은 게임 진행에 손대지 않는다(판정·시간은 ui.js·core·witness 가 한다). 실패해도 조용히 넘어간다.
 *       prefers-reduced-motion 이면 움직임을 거의 없앤다(CSS). DOM 만 만지고, 소리는 ui.js 가 넘겨 준 함수로만 낸다.
 *
 * ui.js 와의 약속(Team3Fx):
 *   mount(caseNo, { board, screen, boss, beamLie, getLieEl })  출동을 시작할 때. 이전 연출을 모두 치운다.
 *   unmount()                                                    출동이 끝날 때
 *   afterRender()                                                판(카드)을 다시 그린 뒤(겹 레이어를 다시 붙인다)
 *   picks(indexes)                                               사건 1: 고른 카드가 바뀔 때(붉은 실)
 *   hit(cards[], id?)  miss(cards[])  trap(card)  levelUp(level)  각 순간
 *   setSound(fn)                                                 효과음 함수 { horn(), click() }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Team3Fx = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  if (typeof document === 'undefined') return { mount: function () {}, unmount: function () {}, afterRender: function () {}, picks: function () {}, hit: function () {}, miss: function () {}, trap: function () {}, levelUp: function () {}, setSound: function () {} };

  var cur = null;          // { no, board, screen, layers:[], timers:[], ... }
  var snd = {};
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; }
  function later(fn, ms) { var t = setTimeout(function () { try { fn(); } catch (e) { /* 연출 실패 무시 */ } }, ms); if (cur) cur.timers.push(t); return t; }
  function replay(e, cls) { if (!e) return; e.classList.remove(cls); void e.offsetWidth; e.classList.add(cls); }
  function remove(e) { if (e && e.parentNode) e.parentNode.removeChild(e); }
  function rel(a, base) { var r = a.getBoundingClientRect(), b = base.getBoundingClientRect(); return { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height, cx: r.left - b.left + r.width / 2, cy: r.top - b.top + r.height / 2 }; }

  /* ---------- 안개 질감: 한 번만 만드는 부드러운 잡음 그림(캔버스 → data URL) ---------- */
  var fogURL = null;
  function fogTexture() {
    if (fogURL) return fogURL;
    try {
      var c = document.createElement('canvas'); c.width = c.height = 96;
      var g = c.getContext('2d'), img = g.createImageData(96, 96);
      // 낮은 해상도 값 격자를 부드럽게 이어 구름 같은 잡음(값 잡음 2옥타브)
      function grid(n) { var a = []; for (var i = 0; i < n * n; i++) a.push(Math.random()); return a; }
      var g1 = grid(6), g2 = grid(12);
      function sample(gr, n, x, y) {
        var fx = x / 96 * n, fy = y / 96 * n, x0 = Math.floor(fx) % n, y0 = Math.floor(fy) % n, x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
        var tx = fx - Math.floor(fx), ty = fy - Math.floor(fy); tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
        var a = gr[y0 * n + x0] * (1 - tx) + gr[y0 * n + x1] * tx, b = gr[y1 * n + x0] * (1 - tx) + gr[y1 * n + x1] * tx;
        return a * (1 - ty) + b * ty;
      }
      for (var y = 0; y < 96; y++) for (var x = 0; x < 96; x++) {
        var v = sample(g1, 6, x, y) * 0.7 + sample(g2, 12, x, y) * 0.3;
        var a = Math.max(0, Math.min(1, (v - 0.35) * 1.9));
        var k = (y * 96 + x) * 4;
        img.data[k] = 222; img.data[k + 1] = 232; img.data[k + 2] = 234; img.data[k + 3] = Math.round(a * 200);
      }
      g.putImageData(img, 0, 0);
      fogURL = c.toDataURL('image/png');
    } catch (e) { fogURL = ''; }
    return fogURL;
  }

  /* ---------- 공통 ---------- */
  function unmount() {
    if (!cur) return;
    cur.timers.forEach(clearTimeout);
    cur.layers.forEach(remove);
    if (cur.clock) clearInterval(cur.clock);
    if (cur.screen) cur.screen.classList.remove('fx-c1', 'fx-c2', 'fx-c3', 'fx-boss1', 'fx-boss3');
    cur = null;
  }
  function mount(caseNo, o) {
    unmount();
    if (!o || !o.board || !o.screen) return;
    cur = { no: caseNo, board: o.board, screen: o.screen, boss: !!o.boss, beamLie: !!o.beamLie, getLieEl: o.getLieEl || function () { return null; }, layers: [], timers: [], level: 1, cam: 1 };
    if (caseNo === 2) mount2(); else if (caseNo === 3) mount3(); else if (caseNo !== 0) mount1();
  }
  function addLayer(parent, e) { parent.appendChild(e); cur.layers.push(e); return e; }

  /* ================= 사건 1: CCTV ================= */
  function mount1() {
    cur.screen.classList.add('fx-c1');
    var b = cur.board;
    cur.scan = addLayer(b, el('div', 'cctv-scan'));
    cur.noise = addLayer(b, el('div', 'cctv-noise'));
    cur.hud = addLayer(b, el('div', 'cctv-hud', '<span class="rec"><i></i>REC</span><span class="cam">CAM 01</span><span class="ts"></span>'));
    cur.strings = addLayer(b, document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
    cur.strings.setAttribute('class', 'cctv-strings');
    var tick = function () {
      if (!cur || !cur.hud) return;
      var d = new Date(), p = function (x) { return (x < 10 ? '0' : '') + x; };
      cur.hud.querySelector('.ts').textContent = d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    };
    tick(); cur.clock = setInterval(tick, 1000);
    if (cur.boss) cur.screen.classList.add('fx-boss1');
    afterRender();
  }
  // 고른 카드를 붉은 실로 잇는다(사건 보드처럼). 고른 순서대로
  function picks(idx) {
    if (!cur || cur.no !== 1 || !cur.strings) return;
    var cards = cur.board.querySelectorAll('.card'), pts = [];
    (idx || []).forEach(function (i) { if (cards[i]) pts.push(rel(cards[i], cur.board)); });
    var svg = cur.strings, w = cur.board.clientWidth, h = cur.board.clientHeight;
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    var s = '';
    for (var k = 1; k < pts.length; k++) {
      var a = pts[k - 1], c = pts[k], mx = (a.cx + c.cx) / 2, my = (a.cy + c.cy) / 2 + 14;   // 실이 살짝 처진다
      s += '<path d="M' + a.cx + ' ' + (a.y + 10) + ' Q' + mx + ' ' + (my + 6) + ' ' + c.cx + ' ' + (c.y + 10) + '" />';
    }
    s += pts.map(function (p) { return '<circle cx="' + p.cx + '" cy="' + (p.y + 10) + '" r="5" />'; }).join('');
    svg.innerHTML = s;
  }
  function hit1(cards) {
    picks([]);
    cards.forEach(function (c) { if (!c) return; var m = el('span', 'match', '<i></i><i></i><i></i><i></i><b>MATCH</b>'); c.appendChild(m); });
    replay(cur.board, 'cctv-freeze');
  }
  function miss1() { picks([]); replay(cur.board, 'cctv-glitch'); }
  function level1(lv) {
    cur.cam = lv;
    if (cur.hud) cur.hud.querySelector('.cam').textContent = 'CAM 0' + lv;
    replay(cur.noise, 'burst');
  }

  /* ================= 사건 2: 해무항 ================= */
  function mount2() {
    cur.screen.classList.add('fx-c2');
    var b = cur.board, url = fogTexture();
    cur.rain = addLayer(cur.screen, el('div', 'harbor-rain'));
    cur.fogA = addLayer(b, el('div', 'fog2 a'));
    cur.fogB = addLayer(b, el('div', 'fog2 b'));
    if (url) { cur.fogA.style.backgroundImage = 'url(' + url + ')'; cur.fogB.style.backgroundImage = 'url(' + url + ')'; }
    cur.beam = addLayer(b, el('div', 'beam2'));
    cur.evidence = addLayer(cur.screen, el('div', 'evidence', '<b>0</b>'));
    cur.evidenceN = 0;
    setFog(1);
    afterRender();
    sweepLoop();
    if (cur.boss) later(ship, 700);
  }
  function setFog(lv) {
    cur.level = lv;
    var op = { 1: [0.38, 0.28], 2: [0.55, 0.4], 3: [0.7, 0.52] }[lv] || [0.4, 0.3];
    if (cur.fogA) cur.fogA.style.opacity = op[0];
    if (cur.fogB) cur.fogB.style.opacity = op[1];
  }
  // 등대 빛: 오른쪽 위에서 왼쪽으로 쓸고 지나가며, 빛이 닿는 순서대로 카드가 잠깐 밝아진다
  function sweepLoop() {
    if (!cur || cur.no !== 2) return;
    replay(cur.beam, 'go');
    var cards = cur.board.querySelectorAll('.card'), cols = cur.board.classList.contains('w12') ? 4 : 3;
    Array.prototype.forEach.call(cards, function (c, i) {
      var col = i % cols, delay = 300 + (cols - 1 - col) * 330;   // 오른쪽 열부터
      later(function () { replay(c, 'lit'); }, delay);
    });
    // 등대지기(장비): 빛이 진술서를 지날 때 거짓 진술이 잠깐 빛난다
    if (cur.beamLie) later(function () { var e = cur && cur.getLieEl(); if (e) replay(e, 'glint'); }, 900);
    later(sweepLoop, 6000 + Math.random() * 2500);
  }
  function hit2(cards, id, cardHTML) {
    var c = cards[0]; if (!c) return;
    var p = rel(c, cur.board);
    // 안개가 그 자리부터 둥글게 걷힌다(마스크 위치를 카드 가운데로)
    [cur.fogA, cur.fogB].forEach(function (f) {
      if (!f) return;
      f.style.setProperty('--cx', (p.cx / cur.board.clientWidth * 100) + '%');
      f.style.setProperty('--cy', (p.cy / cur.board.clientHeight * 100) + '%');
      replay(f, 'part');
    });
    // 증거 사진: 그 자리에서 찰칵(하얗게) → 현상 → 증거 보드(오른쪽 위)로 날아가 꽂힌다
    var s = rel(c, cur.screen), ev = rel(cur.evidence, cur.screen);
    var pol = el('div', 'pol2', '<span class="card ph" style="background:' + (c.style.background || '#ddd') + '">' + (cardHTML || '') + '</span>');
    pol.style.left = s.x + 'px'; pol.style.top = s.y + 'px'; pol.style.width = Math.max(64, s.w * 0.9) + 'px';
    pol.style.setProperty('--dx', (ev.cx - s.cx) + 'px'); pol.style.setProperty('--dy', (ev.cy - s.cy) + 'px');
    cur.screen.appendChild(pol);
    later(function () { remove(pol); if (!cur) return; cur.evidenceN += 1; cur.evidence.querySelector('b').textContent = cur.evidenceN; replay(cur.evidence, 'bump'); }, 1150);
  }
  function trap2() {
    var sh = el('div', 'shutter', '<i></i><i></i>'); cur.screen.appendChild(sh);
    replay(cur.screen, 'redpulse');
    later(function () { remove(sh); }, 700);
  }
  function miss2() { replay(cur.screen, 'redpulse'); }
  function level2(lv) {
    setFog(lv);
    var bank = addLayer(cur.board, el('div', 'fogbank'));
    if (fogURL) bank.style.backgroundImage = 'url(' + fogURL + ')';
    later(function () { remove(bank); }, 2600);
  }
  // 주범 조: 안개 속으로 배가 지나가고, 뱃고동이 울린다
  function ship() {
    if (!cur) return;
    var s = el('div', 'ship2', '<svg viewBox="0 0 320 120" aria-hidden="true"><g class="hull"><path d="M8 70 L312 70 L284 98 L36 98 Z"/><rect x="96" y="44" width="104" height="26"/><rect x="128" y="24" width="18" height="22"/><rect x="214" y="54" width="40" height="16"/><path d="M60 70 V22 M60 26 L96 44" stroke-width="3" fill="none"/></g><circle class="lamp" cx="232" cy="50" r="3.2"/><circle class="lamp g" cx="70" cy="64" r="2.6"/></svg><svg class="refl" viewBox="0 0 320 120" aria-hidden="true"><g class="hull"><path d="M8 70 L312 70 L284 98 L36 98 Z"/><rect x="96" y="44" width="104" height="26"/></g></svg>');
    cur.screen.appendChild(s); cur.layers.push(s);
    try { if (snd.horn) snd.horn(); } catch (e) { /* 무시 */ }
    later(function () { remove(s); }, 6200);
  }

  /* ================= 사건 3: 면통실 ================= */
  function mount3() {
    cur.screen.classList.add('fx-c3');
    if (cur.boss) cur.screen.classList.add('fx-boss3');
    var b = cur.board;
    cur.lamp = addLayer(b, el('div', 'lu-lamp'));
    cur.glass = addLayer(b, el('div', 'lu-glass'));
    cur.flash = addLayer(b, el('div', 'lu-flash'));
    // 가끔 형광등이 지직(소리는 ui 가 넘겨 준 click 으로 작게)
    var buzzLoop = function () {
      if (!cur || cur.no !== 3) return;
      replay(cur.lamp, 'buzz');
      later(buzzLoop, 6000 + Math.random() * 7000);
    };
    later(buzzLoop, 3500);
  }
  function hit3(cards) {
    replay(cur.flash, 'go');
    cards.forEach(function (c) { if (c) replay(c, 'right'); });
  }
  function miss3() { replay(cur.lamp, 'out'); }
  function level3() {
    replay(cur.lamp, 'relight');
    replay(cur.flash, 'go');
  }

  /* ---------- 판을 다시 그린 뒤: 겹 레이어를 맨 위로 다시 붙인다 ---------- */
  function afterRender() {
    if (!cur) return;
    var b = cur.board;
    var keep = cur.no === 2 ? [cur.fogA, cur.fogB, cur.beam] : cur.no === 3 ? [cur.lamp, cur.glass, cur.flash] : [cur.scan, cur.noise, cur.hud, cur.strings];
    keep.forEach(function (e) { if (e) b.appendChild(e); });
    if (cur.no === 1) picks([]);
  }

  return {
    mount: mount, unmount: unmount, afterRender: afterRender, picks: picks,
    hit: function (cards, id, html) { try { if (!cur) return; if (cur.no === 2) hit2(cards, id, html); else if (cur.no === 3) hit3(cards); else hit1(cards); } catch (e) { /* 무시 */ } },
    miss: function (cards) { try { if (!cur) return; if (cur.no === 2) miss2(); else if (cur.no === 3) miss3(); else miss1(cards); } catch (e) { /* 무시 */ } },
    trap: function () { try { if (cur && cur.no === 2) trap2(); } catch (e) { /* 무시 */ } },
    levelUp: function (lv) { try { if (!cur) return; if (cur.no === 2) level2(lv); else if (cur.no === 3) level3(lv); else level1(lv); } catch (e) { /* 무시 */ } },
    setSound: function (s) { snd = s || {}; }
  };
});
