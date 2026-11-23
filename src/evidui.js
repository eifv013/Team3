/*
 * Team3EvidUI — 부서 칸 · 재수사 칸 · 증거판 창(0.7.0). 규칙은 dept.js · evidence.js · idle.js.
 *
 *   부서 칸(사무실 "부서"): 줄마다 아이콘(인원) · 이름 · 막대(한 바퀴, 아주 빠르면 줄무늬) · 다음 목표 · 영입 단추(×1 · ×10 · 최대)
 *   재수사 칸(사무실): 받을 단서(크게) · 지난번과 견준 한 줄 · 다음 단서까지 막대와 남은 시간 · [증거판] [재수사]
 *   재수사 확인 창: 남는 것 / 처음으로 돌아가는 것. 사건 중간이면 잃는 진척을 붉게 알린다(사건을 닫을 때 하는 게 가장 좋다).
 *   재수사 연출: 상황실 불이 꺼졌다 켜지고(재부팅), 단서가 증거판으로 날아간다.
 *   증거판 창: 7×6 코르크 보드(열린 칸만) · 붉은 실 · 묶음 배수 · 효과 합 / 아래 카드 목록(가진 것 · 살 수 있는 것 · 잠긴 것)
 *     카드를 누르면 고르기 → 보드 칸을 누르면 꽂기(옮기기 · 자리 바꾸기). 꽂힌 카드를 누르면 강화 · 빼기.
 *
 * hub.js 와의 약속: mount(ctx) · render() · retreatAtClose(then) · open()
 *   ctx = { getSave, persist, render, UI, idle, nowMs, deptMult(save), onRetreat(r) }
 */
(function (root) {
  'use strict';
  var D = root.Team3Dept, Ev = root.Team3Evidence;
  if (!D || !Ev) return;
  var ctx = null, mode = '1', sel = null, lastDraw = 0;
  var $ = function (id) { return document.getElementById(id); };
  function S() { return ctx.getSave(); }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function fmt(n) { return Math.floor(n).toLocaleString('ko-KR'); }
  function fmtShort(n) {
    n = Math.floor(n);
    if (n < 10000) return n.toLocaleString('ko-KR');
    var u = [['조', 1e12], ['억', 1e8], ['만', 1e4]];
    for (var i = 0; i < u.length; i++) if (n >= u[i][1]) { var v = n / u[i][1]; return (v >= 100 ? Math.floor(v) : Math.floor(v * 10) / 10).toLocaleString('ko-KR') + u[i][0]; }
    return String(n);
  }
  function dur(sec) { return !isFinite(sec) ? '' : sec < 60 ? '1분 안쪽' : sec < 3600 ? '약 ' + Math.ceil(sec / 60) + '분' : sec < 86400 ? '약 ' + Math.ceil(sec / 3600) + '시간' : '하루 넘게'; }
  function toast(t) { try { ctx.UI.toast(t); } catch (e) { /* 없음 */ } }
  function ic(name) { var I = root.Team3Icons; return I ? I.icon(name) : ''; }

  /* ---------- 부서 칸 ---------- */
  var ICON = {
    patrol: '<path d="M5 17h14l-2-6H7z"/><circle cx="8" cy="18" r="2"/><circle cx="16" cy="18" r="2"/><path d="M10 8h4l1 3H9z"/>',
    analyst: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M7 13l3-3 3 2 4-5M8 20h8M12 16v4"/>',
    csi: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M7 15h10"/>',
    swat: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    intl: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>'
  };
  function disc() { return 0; }
  function qty(s, id) { return mode === 'max' ? Math.max(1, D.maxBuy(s, id, s.money, disc())) : +mode; }
  function renderDept() {
    var box = $('h-dept'); if (!box) return;
    var s = S(), mult = ctx.deptMult(s);
    D.reveal(s);
    $('h-dept-mode').innerHTML = ['1', '10', 'max'].map(function (m) { return '<button class="chip2' + (mode === m ? ' on' : '') + '" data-dmode="' + m + '">' + (m === 'max' ? '최대' : '×' + m) + '</button>'; }).join('') +
      '<span class="dept-sum">부서 수입 <b>' + fmtShort(D.perSec(s, mult) * 60) + '</b>/분</span>';
    var html = '';
    D.LIST.forEach(function (x) {
      var n = s.dept.n[x.id];
      if (!s.dept.seen[x.id]) { html += '<div class="dept locked"><div class="d-ico"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></div><div class="d-mid"><b class="d-name">???</b><small class="d-mile">수사비 ' + fmtShort(x.cost / 2) + '을 모으면 보여요</small></div></div>'; return; }
      var q = qty(s, x.id), c = D.cost(s, x.id, q, disc()), ok = s.money >= c && (mode !== 'max' || D.maxBuy(s, x.id, s.money, disc()) > 0);
      var nm = D.nextMile(n), cyc = D.cycle(s, x.id), fast = n > 0 && cyc < 0.6;
      html += '<div class="dept" data-dept="' + x.id + '"><div class="d-ico"><svg viewBox="0 0 24 24">' + ICON[x.id] + '</svg><b>' + n + '</b></div>' +
        '<div class="d-mid"><b class="d-name">' + x.name + '</b>' +
        '<div class="d-bar' + (fast ? ' fast' : '') + '"><i data-cyc="' + cyc + '"></i><span>' + (n ? '+' + fmtShort(x.pay * n * mult) + ' · ' + (cyc >= 1 ? cyc.toFixed(1) : cyc.toFixed(2)) + '초' : x.what) + '</span></div>' +
        '<small class="d-mile">' + (nm ? nm + '명까지 <em>' + (nm - n) + '명</em> · 채우면 속도 ×2' : '목표 모두 달성 · 속도 ×' + D.mileMult(n)) + '</small></div>' +
        '<button class="buy d-buy' + (ok ? '' : ' poor') + '" data-buy="' + x.id + '"' + (ok ? '' : ' disabled') + '>' + (ok ? '<em>영입 ×' + q + '</em><b class="cn">' + fmtShort(c) + '</b>' : '<em>영입 ×' + q + '</em><b class="cn">' + fmtShort(c) + '</b>') + '</button></div>';
    });
    box.innerHTML = html;
  }
  // 막대: 화면이 보일 때 매 프레임(실제 수입은 연속 — 막대는 보여 주기용)
  var t0 = Date.now();
  function frame() {
    requestAnimationFrame(frame);
    var hub = $('s-hub'); if (!hub || !hub.classList.contains('on')) return;
    var t = (Date.now() - t0) / 1000;
    var bars = document.querySelectorAll('#h-dept .d-bar:not(.fast) i');
    for (var i = 0; i < bars.length; i++) { var c = +bars[i].getAttribute('data-cyc'); if (c > 0) bars[i].style.transform = 'scaleX(' + ((t % c) / c).toFixed(3) + ')'; }
  }

  /* ---------- 재수사 칸 ---------- */
  function renderRetreat() {
    var box = $('h-retreat'); if (!box) return;
    var s = S(), e = s.evid, g = Ev.gainNow(s), last = Ev.lastGain(s), can = g >= 1;
    var rate = ctx.incomePerSec(s), need = Ev.nextAt(s), eta = rate > 0 ? need / rate : Infinity;
    var b0 = Math.floor(Math.cbrt(e.runEarned / Ev.CLUE_UNIT) + 1e-9), lo = Math.pow(b0, 3) * Ev.CLUE_UNIT, hi = Math.pow(b0 + 1, 3) * Ev.CLUE_UNIT, pct = Math.max(0, Math.min(100, (e.runEarned - lo) / (hi - lo) * 100));
    var cmp = can && last ? (g > last ? '지난번 재수사보다 ' + (g - last) + '개 많아요' : g < last ? '지난번(+' + last + ')보다 ' + (last - g) + '개 적어요' : '지난번 재수사와 같아요') : '';
    box.innerHTML = '<div class="rt-top"><div class="rt-tx"><span class="label">재수사 · 단서</span>' +
      (can ? '<b class="rt-gain">+' + g + '</b><small>' + (cmp || '재수사하면 건지는 단서') + '</small>' : '<b class="rt-gain off">0</b><small>수사비를 더 벌면 단서를 받아요</small>') + '</div>' +
      '<div class="rt-side"><small>가진 단서 <b>' + Ev.left(s) + '</b></small><small>재수사 ' + e.retreats + '번 · 경력 +' + Ev.careerPct(s) + '%</small></div></div>' +
      '<div class="rt-next"><span>' + (can ? '다음 단서 +1까지' : '첫 단서까지') + '</span><span>' + dur(eta) + '</span></div><div class="ach-bar"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
      '<div class="rt-acts"><button class="ghost" id="h-board">증거판' + (Ev.left(s) > 0 && cheapest(s) ? '<i class="dot"></i>' : '') + '</button><button class="primary" id="h-retreat-go"' + (can ? '' : ' disabled') + '>재수사</button></div>';
  }
  function cheapest(s) { return Ev.CARDS.some(function (c) { return Ev.tierOpen(s, c.tier) && !s.evid.own[c.id] && c.cost <= Ev.left(s); }) || Object.keys(s.evid.own).some(function (id) { var k = Ev.upCost(s, id); return k != null && k <= Ev.left(s); }); }

  /* ---------- 재수사 흐름 ---------- */
  // 목록은 낱말 칩으로(줄이 바뀌어도 '·'로 시작하거나 낱말 중간에서 꺾이지 않게)
  function chips(a) { return a.map(function (x) { return '<i class="rt-chip">' + x + '</i>'; }).join(''); }
  function confirmRetreat(atClose, then) {
    var s = S(), g = Ev.gainNow(s), cs = ctx.idle.caseOf(s), f = Ev.effects(s);
    if (g < 1) { toast('아직 단서를 받을 수 없어요'); return; }
    var lose = !s.closed && s.caught > 0 && !atClose;
    ctx.openInfo({ label: '재수사 · 처음부터 다시 파고들어요', title: '단서 +' + g,
      body: '<p class="rt-why">지금 수사를 접고 <b>처음부터 다시 파고들어요.</b> 그동안 모은 자료에서 놓쳤던 단서를 건져 증거판에 써요.</p>' +
        '<div class="rt-list"><div class="keep"><b>남는 것</b><span>' + chips(['사건 번호', '닫은 사건', '연 수사 일지', '계급', '동물', '배지', '업적', '단서', '증거판']) + '</span></div>' +
        '<div class="reset"><b>처음으로</b><span>' + chips(['수사비' + (f.startMoney ? '(→ ' + fmt(f.startMoney) + ')' : ''), '형사(→ ' + (1 + f.startDet) + '명)', '훈련', '출동 장비', '부서', '유치장'].concat(s.closed ? [] : ['사건 ' + cs.no + ' 진척'])) + '</span></div>' +
        (lose ? '<div class="warn"><b>지금 사건 진척 ' + fmt(s.caught) + '명이 0으로 돌아가요</b><span>사건을 닫을 때 재수사하면 잃는 진척이 없어요.</span></div>' : '') +
        '<div class="gain"><b>얻는 것</b><span>' + chips(['단서 +' + g, '재수사 경력 +' + Ev.RANK_PCT + '%']) + '</span><small class="rt-note">재수사 경력은 팀 속도 · 수사비 · 부서 수입에 계속 붙어요</small></div></div>',
      ok: '재수사하고 단서 +' + g, cancel: '그만두기',
      onOk: function () { doRetreat(then); } });
  }
  function doRetreat(then) {
    var s = S(), r;
    try { r = Ev.retreat(s, { now: ctx.nowMs(), newTeam: function (sv, st) { ctx.idle.resetTeam(sv, st); D.reset(sv); if (root.Team3Crew) root.Team3Crew.reset(sv); if (sv.office) sv.office.cell = 0; } }); }
    catch (e) { toast('재수사할 수 없어요'); return; }
    ctx.persist();
    // 연출: 상황실 불이 꺼졌다 켜진다
    var off = $('h-office');
    if (off) { off.classList.remove('reboot'); void off.offsetWidth; off.classList.add('reboot'); setTimeout(function () { off.classList.remove('reboot'); }, 2200); }
    try { ctx.UI.sfx.none(); } catch (e) { /* 무시 */ }
    ctx.UI.buzz([30, 60, 30, 60, 80]);
    ctx.render();
    toast('재수사! 놓쳤던 단서 +' + r.gain + ' · 팀을 새로 꾸렸어요');
    if (ctx.onRetreat) ctx.onRetreat(r);
    setTimeout(function () { open(); if (typeof then === 'function') then(); }, 900);
  }
  /** 사건 종결 창에서: 재수사하고 다음 사건으로(단서가 없으면 그냥 넘어간다) */
  function retreatAtClose(then) {
    if (Ev.gainNow(S()) < 1) { if (then) then(); return; }
    confirmRetreat(true, then);
  }

  /* ---------- 증거판 창 ---------- */
  function cardFace(c, lv, onBoard) {
    return '<b class="ev-dot" style="background:' + Ev.COLOR[c.color].hex + '"></b><b class="ev-name">' + esc(c.name) + '</b>' +
      '<small class="ev-eff">' + esc(onBoard ? Ev.shortText(c, lv) : Ev.describe(c, lv)) + '</small>' + (lv ? '<em class="ev-lv">' + '★'.repeat(lv) + '</em>' : '');
  }
  function lockText(t) { return ['', '재수사 2번', '사건 1 종결', '재수사 6번 또는 사건 2 종결', '미제 사건으로 출동 10번'][t]; }
  function draw() {
    var s = S(), e = s.evid, f = Ev.effects(s), groups = Ev.groups(s), html = '';
    var inGroup = {}; groups.forEach(function (g) { g.cells.forEach(function (i) { inGroup[i] = g.mult; }); });
    html += '<div class="ev-head"><span>단서 <b>' + Ev.left(s) + '</b> / 모두 ' + e.clues + '</span><span>열린 칸 ' + Ev.openCount(s) + ' / ' + Ev.COLS * Ev.ROWS + '</span></div>';
    html += '<div class="ev-board" id="ev-board" style="--cols:' + Ev.COLS + '"><svg class="ev-str" id="ev-str" aria-hidden="true"></svg>';
    for (var i = 0; i < Ev.COLS * Ev.ROWS; i++) {
      var open = Ev.isOpen(s, i), id = e.pins[i], c = id ? Ev.BY_ID[id] : null;
      html += '<button class="ev-cell' + (open ? '' : ' shut') + (c ? ' has' : '') + (sel && !c && open ? ' target' : '') + '" data-cell="' + i + '"' + (open ? '' : ' disabled aria-hidden="true"') +
        ' style="--r:' + ((i * 7 % 7) - 3) + 'deg' + (c ? ';--c:' + Ev.COLOR[c.color].hex : '') + '">' +
        (c ? cardFace(c, e.lv[id], true) + (inGroup[i] > 1 ? '<span class="ev-x">×' + inGroup[i] + '</span>' : '') : open ? '<span class="ev-plus">+</span>' : '') + '</button>';
    }
    html += '</div>';
    var eff = Object.keys(Ev.KEY_NAME).filter(function (k) { return f[k]; }).map(function (k) { return '<span class="ev-chip">' + Ev.KEY_NAME[k] + ' <b>' + (k === 'miss' ? '−' : '+') + (k === 'startMoney' ? fmtShort(f[k]) : f[k]) + '</b></span>'; }).join('');
    html += '<div class="ev-eff-sum"><span class="ev-chip career">재수사 경력 <b>+' + Ev.careerPct(s) + '%</b></span>' + (eff || '<span class="muted" style="font-size:12px">카드를 꽂으면 효과가 생겨요. 같은 색을 이웃하게 꽂으면 붉은 실로 이어져 효과가 커져요(2장 ×1.5 · 3장 ×2 · 5장 ×2.5).</span>') + '</div>';
    // 카드 목록: 가진 것(안 꽂은 것 먼저) · 살 수 있는 것 · 잠긴 것
    var pinned = {}; Object.keys(e.pins).forEach(function (k) { pinned[e.pins[k]] = +k; });
    var own = Ev.CARDS.filter(function (c) { return e.own[c.id]; }).sort(function (a, b) { return (pinned[a.id] != null) - (pinned[b.id] != null); });
    var shop = Ev.CARDS.filter(function (c) { return !e.own[c.id] && Ev.tierOpen(s, c.tier); }).sort(function (a, b) { return a.cost - b.cost; });
    var locked = Ev.CARDS.filter(function (c) { return !e.own[c.id] && !Ev.tierOpen(s, c.tier); });
    html += '<span class="label ev-sec">' + (sel ? '꽂을 칸을 누르세요 · <button class="linkish" id="ev-cancel">그만두기</button>' : '가진 증거 · 누르고 보드 칸을 누르면 꽂혀요') + '</span><div class="ev-list">' +
      (own.length ? own.map(function (c) {
        var up = Ev.upCost(s, c.id);
        return '<div class="ev-card' + (sel === c.id ? ' sel' : '') + (pinned[c.id] != null ? ' on' : '') + '" style="--c:' + Ev.COLOR[c.color].hex + '"><button class="ev-pick" data-pick="' + c.id + '">' + cardFace(c, e.lv[c.id]) + (pinned[c.id] != null ? '<i class="ev-pinned">꽂음</i>' : '') + '</button>' +
          '<button class="ev-up" data-up="' + c.id + '"' + (up != null && up <= Ev.left(s) ? '' : ' disabled') + '>' + (up == null ? '최고' : '강화 ' + up) + '</button></div>';
      }).join('') : '<p class="muted" style="font-size:13px;margin:0">아직 가진 증거가 없어요. 아래에서 단서로 사요.</p>') + '</div>';
    html += '<span class="label ev-sec">단서로 사기</span><div class="ev-list">' + (shop.length ? shop.map(function (c) {
      var ok = Ev.left(s) >= c.cost;
      return '<div class="ev-card shop" style="--c:' + Ev.COLOR[c.color].hex + '"><span class="ev-pick">' + cardFace(c, 0) + '</span><button class="ev-up buyc' + (ok ? '' : ' short') + '" data-buyc="' + c.id + '"' + (ok ? '' : ' disabled') + '>단서 ' + c.cost + '</button></div>';
    }).join('') : '<p class="muted" style="font-size:13px;margin:0">지금 살 수 있는 증거를 다 모았어요.</p>') + '</div>';
    if (locked.length) {
      var byT = {}; locked.forEach(function (c) { (byT[c.tier] = byT[c.tier] || []).push(c); });
      html += '<span class="label ev-sec">아직 안 나온 증거</span><div class="ev-locks">' + Object.keys(byT).map(function (t) { return '<span class="ev-lock">' + lockText(+t) + '에 ' + byT[t].length + '장</span>'; }).join('') + '</div>';
    }
    $('evid-body').innerHTML = html;
    strings();
  }
  // 붉은 실(이웃한 같은 색 쌍)
  function strings() {
    var svg = $('ev-str'), board = $('ev-board'); if (!svg || !board) return;
    requestAnimationFrame(function () {
      var b = board.getBoundingClientRect(), s = S();
      svg.setAttribute('viewBox', '0 0 ' + b.width + ' ' + b.height);
      svg.innerHTML = Ev.links(s).map(function (l) {
        var A = board.querySelector('[data-cell="' + l[0] + '"]').getBoundingClientRect(), B = board.querySelector('[data-cell="' + l[1] + '"]').getBoundingClientRect();
        var x1 = A.left - b.left + A.width / 2, y1 = A.top - b.top + 6, x2 = B.left - b.left + B.width / 2, y2 = B.top - b.top + 6;
        return '<path d="M' + x1 + ' ' + y1 + ' Q' + ((x1 + x2) / 2) + ' ' + ((y1 + y2) / 2 + 10) + ' ' + x2 + ' ' + y2 + '"/>';
      }).join('');
    });
  }
  // 0.8.0 증거판은 아래 메뉴 '증거' 탭 안에 있다(창이 아니다). open = 그 탭으로 옮기고 다시 그리기
  function open() { sel = null; if (ctx.showTab) ctx.showTab('evid'); draw(); }
  function close() { sel = null; }

  function onBoardClick(e) {
    var s = S(), t;
    if (e.target === $('evid-sheet')) { close(); return; }
    if ((t = e.target.closest('#ev-cancel'))) { sel = null; draw(); return; }
    if ((t = e.target.closest('[data-buyc]'))) {
      try { var c = Ev.buyCard(s, t.getAttribute('data-buyc')); ctx.persist(); sel = c.id; toast(c.name + ' 획득 · 꽂을 칸을 누르세요'); try { ctx.UI.sfx.coin(); } catch (e2) { /* 무시 */ } }
      catch (e3) { toast(e3.code === 'NOT_ENOUGH' ? '단서가 모자라요' : '살 수 없어요'); }
      draw(); return;
    }
    if ((t = e.target.closest('[data-up]'))) {
      try { var lv = Ev.upgrade(s, t.getAttribute('data-up')); ctx.persist(); toast('강화! ★' + lv); try { ctx.UI.sfx.pick(3); } catch (e4) { /* 무시 */ } ctx.render(); }
      catch (e5) { toast(e5.code === 'NOT_ENOUGH' ? '단서가 모자라요' : '더 강화할 수 없어요'); }
      draw(); return;
    }
    if ((t = e.target.closest('[data-pick]'))) { var id = t.getAttribute('data-pick'); sel = sel === id ? null : id; draw(); return; }
    if ((t = e.target.closest('[data-cell]'))) {
      var cell = +t.getAttribute('data-cell');
      if (sel) {
        try {
          var before = Ev.links(s).length; Ev.pin(s, sel, cell); ctx.persist();
          var after = Ev.links(s).length;
          try { ctx.UI.sfx.pick(2); } catch (e6) { /* 무시 */ }
          if (after > before) toast('붉은 실 연결! 효과가 커져요');
          sel = null; ctx.render();
        } catch (e7) { toast('여기엔 꽂을 수 없어요'); }
        draw(); return;
      }
      if (s.evid.pins[cell]) { var pid = s.evid.pins[cell]; sel = pid; toast(Ev.BY_ID[pid].name + ' · 옮길 칸을 누르세요(빼려면 같은 칸을 한 번 더)'); draw(); var me = $('ev-board').querySelector('[data-cell="' + cell + '"]'); if (me) me.classList.add('lift'); return; }
    }
  }

  function mount(c) {
    ctx = c;
    D.clean(S()); Ev.clean(S());
    var hub = $('s-hub');
    hub.addEventListener('click', function (e) {
      var t;
      if ((t = e.target.closest('[data-dmode]'))) { mode = t.getAttribute('data-dmode'); lastDraw = 0; render(); return; }
      if ((t = e.target.closest('#h-dept [data-buy]'))) {
        var s = S(), id = t.getAttribute('data-buy'), q = qty(s, id);
        try { var r = D.buy(s, id, q, disc()); ctx.persist(); try { ctx.UI.sfx.coin(); } catch (e2) { /* 무시 */ } if (r.mile) toast(D.BY_ID[id].name + ' ' + r.mile + '명! 속도 ×2');
          // 0.8.0 바로 보이게: 1초 묶음(render 의 900ms 제한)을 기다리지 않고 지금 다시 그리고, 산 칸을 반짝인다
          lastDraw = 0; ctx.render();
          var row = document.querySelector('#h-dept [data-dept="' + id + '"]'); if (row) { row.classList.remove('bought'); void row.offsetWidth; row.classList.add('bought'); } }
        catch (e3) { toast(e3.code === 'NOT_ENOUGH' ? '수사비가 모자라요' : '영입할 수 없어요'); }
        return;
      }
      if (e.target.closest('#h-board')) { open(); return; }
      if (e.target.closest('#h-retreat-go')) { confirmRetreat(false); return; }
    });
    $('evid-body').addEventListener('click', function (e) {
      // 같은 칸을 두 번 누르면 빼기
      var t = e.target.closest('[data-cell]');
      if (t && sel && S().evid.pins[+t.getAttribute('data-cell')] === sel) { Ev.unpin(S(), +t.getAttribute('data-cell')); ctx.persist(); sel = null; ctx.render(); draw(); toast('증거를 뺐어요'); return; }
      onBoardClick(e);
    });
    requestAnimationFrame(frame);
  }
  function render() {
    if (!ctx) return;
    var now = Date.now();
    if (now - lastDraw < 900) return;   // 1초에 한 번이면 충분(단추 · 숫자)
    lastDraw = now;
    renderDept(); renderRetreat();
  }

  root.Team3EvidUI = { mount: mount, render: function () { lastDraw = 0; render(); }, tick: render, open: open, close: close, retreatAtClose: retreatAtClose, isOpen: function () { return false; }, draw: function () { if (ctx) draw(); } };
})(typeof self !== 'undefined' ? self : this);
