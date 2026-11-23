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
  function cheapest(s) { return Ev.CARDS.some(function (c) { return Ev.state(s, c.id) === 'can' && c.cost <= Ev.left(s); }) || Object.keys(s.evid.own).some(function (id) { var k = Ev.upCost(s, id); return k != null && k <= Ev.left(s); }); }

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

  /* ---------- 0.9.0 증거판(연결판) ----------
     판(2000×2000) 위에 51장 + 가운데 사건 파일. 끌어서 움직이고, 두 손가락 · 휠 · +/− 로 확대.
     ??? 를 누르면 아래 정보 칸에 "단서 N 열기", 열린 증거를 누르면 효과 · 강화. 열면 붉은 실이 그려지며 이어진다.
     판은 한 번만 만들고(옮긴 자리 · 확대를 지키려고) 자리 상태만 다시 그린다. */
  var Z = { s: 0.95, x: 0, y: 0 }, built = false, fresh = {}, popId = null, zoomed = false;
  var CASE_TITLE = '3팀 수사 파일', CASE_LINE = '흩어진 사건 사이,<br>놓친 연결을 다시 잇는다.';   // 0.9.2 특정 사건(해무항) 이름을 빼고 모든 사건을 잇는 파일로
  var LOCK = ['', '재수사 2번', '사건 1 종결', '재수사 6번', '미제 출동 10번'];
  function lockText(t) { return ['', '재수사 2번', '사건 1 종결', '재수사 6번 또는 사건 2 종결', '미제 사건으로 출동 10번'][t]; }
  function strPath(a, b) { var A = Ev.NODE[a], B = Ev.NODE[b], mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2 + Math.min(40, Math.hypot(A.x - B.x, A.y - B.y) * 0.12); return 'M' + A.x + ' ' + (A.y - 30) + ' Q' + mx + ' ' + my + ' ' + B.x + ' ' + (B.y - 30); }
  function build() {
    var s = S(), e = s.evid;
    $('evid-body').innerHTML =
      '<div class="ev-head"><span>단서 <b id="ev-left"></b></span><span id="ev-count"></span></div>' +
      '<div class="ev-vp" id="ev-vp"><div class="ev-world" id="ev-world"><svg class="ev-str2" id="ev-str" viewBox="0 0 2000 2000"></svg></div>' +
        '<div class="ev-legend">' + ['r', 'b', 'y', 'g'].map(function (c) { return '<span><i style="background:' + Ev.COLOR[c].hex + '"></i>' + Ev.COLOR[c].name + '</span>'; }).join('') + '</div>' +
        '<div class="ev-zoom"><button id="ev-zi" aria-label="확대">+</button><button id="ev-zo" aria-label="축소">−</button><button id="ev-zc" aria-label="가운데로">◎</button></div></div>' +
      '<div class="ev-info" id="ev-info"></div>' +
      '<div class="ev-eff-sum" id="ev-sum"></div>' +
      '<div class="ev-locks" id="ev-locks"></div>';
    var w = $('ev-world'), h = '';
    Object.keys(Ev.NODE).forEach(function (k) { var n = Ev.NODE[k]; h += '<button class="' + (k === 'core' ? 'ev-core' : 'ev-n') + '" data-k="' + k + '" style="left:' + n.x + 'px;top:' + n.y + 'px;--r:' + n.rot + 'deg' + (k === 'core' ? '' : ';--c:' + Ev.COLOR[Ev.BY_ID[k].color].hex) + '"></button>'; });
    w.insertAdjacentHTML('beforeend', h);
    bindPan();
    built = true;
    requestAnimationFrame(function () { center(); });
  }
  function nodeHTML(k, st) {
    var s = S();
    if (k === 'core') return st === 'open' ? '<span class="ev-stamp">미제 · 재수사</span><b>' + CASE_TITLE + '</b><small>' + CASE_LINE + '</small>' : '<b class="q">???</b><small>첫 재수사를 하면 열려요</small>';
    var c = Ev.BY_ID[k], lv = s.evid.lv[k] || 1;
    if (st === 'open') return '<b>' + esc(c.name) + '</b><small>' + esc(Ev.shortText(c, lv)) + '</small>' + (lv > 1 ? '<em class="ev-lv">' + '★'.repeat(lv) + '</em>' : '') + (groupOf(k) > 1 ? '<span class="ev-x">×' + groupOf(k) + '</span>' : '');
    // 0.9.2 실로 이어진(열 수 있거나 묶음 대기) 증거는 이름 · 효과를 보여 준다 — 무엇을 열지 보고 고르게. 안 이어진 것만 ???
    if (st === 'can') return '<b>' + esc(c.name) + '</b><small>' + esc(Ev.shortText(c, 1)) + '</small><em class="ev-cost">🔍 ' + c.cost + '로 열기</em>';
    if (st === 'lock') return '<b>' + esc(c.name) + '</b><small>' + esc(Ev.shortText(c, 1)) + '</small><em class="ev-cost lk">🔒 ' + LOCK[c.tier] + '</em>';
    return '<b class="q">???</b>';
  }
  var GM = {};
  function groupOf(k) { return GM[k] || 1; }
  function draw() {
    if (!built || !$('ev-world')) build();
    var s = S(), e = s.evid;
    GM = {}; Ev.groups(s).forEach(function (g) { g.ids.forEach(function (id) { GM[id] = g.mult; }); });
    // 실
    var h = '';
    Ev.EDGES.forEach(function (ed) {
      var o0 = Ev.opened(s, ed[0]), o1 = Ev.opened(s, ed[1]), d = strPath(ed[0], ed[1]), key = ed.join('-');
      if (o0 && o1) h += '<path class="on' + (fresh[key] ? ' draw' : '') + '" d="' + d + '"/>';
      else if ((o0 && Ev.state(s, ed[1]) !== 'shut') || (o1 && Ev.state(s, ed[0]) !== 'shut')) h += '<path class="hint" d="' + d + '"/>';
    });
    $('ev-str').innerHTML = h; fresh = {};
    // 자리
    var els = $('ev-world').querySelectorAll('[data-k]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i], k = el.getAttribute('data-k'), st = Ev.state(s, k), cls = (k === 'core' ? 'ev-core ' : 'ev-n ') + st + (k === sel ? ' sel' : '') + (k === popId ? ' pop' : '');
      var html = nodeHTML(k, st);
      if (el.className !== cls) el.className = cls;
      if (el._h !== html) { el._h = html; el.innerHTML = html; }
    }
    popId = null;
    var nOwn = Object.keys(e.own).length;
    $('ev-left').textContent = Ev.left(s);
    $('ev-count').textContent = '재수사 ' + e.retreats + '번 · 증거 ' + nOwn + ' / ' + Ev.CARDS.length;
    info();
    var f = Ev.effects(s);
    var eff = Object.keys(Ev.KEY_NAME).filter(function (k) { return f[k]; }).map(function (k) { return '<span class="ev-chip">' + Ev.KEY_NAME[k] + ' <b>' + (k === 'miss' ? '−' : '+') + (k === 'startMoney' ? fmtShort(f[k]) : f[k]) + '</b></span>'; }).join('');
    $('ev-sum').innerHTML = '<span class="ev-chip career">재수사 경력 <b>+' + Ev.careerPct(s) + '%</b></span>' + (eff || '<span class="muted" style="font-size:12px">증거를 열면 효과가 생겨요. 같은 색 증거가 실로 이어지면 효과가 커져요(2장 ×1.5 · 3장 ×2 · 5장 ×2.5).</span>');
    var locked = Ev.CARDS.filter(function (c) { return !Ev.tierOpen(s, c.tier); }), byT = {};
    locked.forEach(function (c) { (byT[c.tier] = byT[c.tier] || []).push(c); });
    $('ev-locks').innerHTML = locked.length ? Object.keys(byT).map(function (t) { return '<span class="ev-lock">' + lockText(+t) + '에 ' + byT[t].length + '장</span>'; }).join('') : '';
  }
  function info() {
    var s = S(), box = $('ev-info'); if (!box) return;
    if (!sel) {
      box.innerHTML = '<div class="tx"><b>' + (Ev.coreOpen(s) ? '반짝이는 증거를 눌러 보세요' : '아직 아무것도 몰라요') + '</b><small>' + (Ev.coreOpen(s) ? '열린 증거와 실로 이어진 칸만 단서로 열 수 있어요. 끌어서 움직이고, 두 손가락으로 확대해요.' : '재수사를 하면 놓쳤던 사건 파일이 판 가운데 붙어요.') + '</small></div>';
      return;
    }
    var st = Ev.state(s, sel);
    if (sel === 'core') { box.innerHTML = '<div class="tx"><b>' + (st === 'open' ? '사건 파일 · ' + CASE_TITLE : '???') + '</b><small>' + (st === 'open' ? '모든 증거는 여기서 뻗어 나가요.' : '첫 재수사를 하면 열려요.') + '</small></div>'; return; }
    var c = Ev.BY_ID[sel], col = Ev.COLOR[c.color];
    if (st === 'open') {
      var lv = s.evid.lv[sel] || 1, up = Ev.upCost(s, sel);
      box.innerHTML = '<div class="tx"><b><i class="dot" style="background:' + col.hex + '"></i>' + esc(c.name) + (lv > 1 ? ' <em class="ev-lv">' + '★'.repeat(lv) + '</em>' : '') + '</b><small>' + esc(Ev.describe(c, lv)) + (groupOf(sel) > 1 ? ' · 묶음 ×' + groupOf(sel) : '') + ' · ' + col.name + '</small></div>' +
        '<button class="ev-act up" data-up="' + sel + '"' + (up != null && up <= Ev.left(s) ? '' : ' disabled') + '>' + (up == null ? '<span>최고 단계</span>' : '<span>강화</span><b>🔍 ' + up + '</b>') + '</button>';
      return;
    }
    if (st === 'can') {
      box.innerHTML = '<div class="tx"><b><i class="dot" style="background:' + col.hex + '"></i>' + esc(c.name) + ' · 이어진 증거</b><small>' + esc(Ev.describe(c, 1)) + ' · 단서로 열면 붉은 실로 이어지고 바로 효과가 나요.</small></div>' +
        '<button class="ev-act" data-buyc="' + sel + '"' + (Ev.left(s) >= c.cost ? '' : ' disabled') + '><span>열기</span><b>🔍 ' + c.cost + '</b></button>';
      return;
    }
    box.innerHTML = st === 'lock' ? '<div class="tx"><b><i class="dot" style="background:' + col.hex + '"></i>' + esc(c.name) + '</b><small>' + esc(Ev.describe(c, 1)) + ' · ' + lockText(c.tier) + '부터 열 수 있어요.</small></div>'
      : '<div class="tx"><b>???</b><small>아직 이어진 증거가 없어요. 실로 이어진 옆 증거를 먼저 열어요.</small></div>';
  }
  /* 끌기 · 확대 */
  /* 0.9.2 판 밖으로 끝없이 끌려가지 않게 증거가 있는 범위(여유 90px) 안으로 묶는다 */
  var BOX = null;
  function box() {
    if (BOX) return BOX;
    var v = Object.keys(Ev.NODE).map(function (k) { return Ev.NODE[k]; });
    BOX = { x0: Math.min.apply(null, v.map(function (a) { return a.x; })) - 90, x1: Math.max.apply(null, v.map(function (a) { return a.x; })) + 90,
            y0: Math.min.apply(null, v.map(function (a) { return a.y; })) - 90, y1: Math.max.apply(null, v.map(function (a) { return a.y; })) + 90 };
    return BOX;
  }
  function lim(v, size, a, b) {   // 한 축: 내용 [a,b]×s 가 화면 size 를 덮으면 끝이 화면 안쪽으로 못 들어오게, 작으면 가운데
    var lo = size - b * Z.s, hi = -a * Z.s;
    return lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v));
  }
  function clamp() {
    var vp = $('ev-vp'); if (!vp) return; var r = vp.getBoundingClientRect(); if (!r.width) return; var B = box();
    Z.x = lim(Z.x, r.width, B.x0, B.x1); Z.y = lim(Z.y, r.height, B.y0, B.y1);
  }
  function apply() { clamp(); var w = $('ev-world'); if (w) w.style.transform = 'translate(' + Z.x + 'px,' + Z.y + 'px) scale(' + Z.s + ')'; }
  function center(s) { var vp = $('ev-vp'); if (!vp) return; var r = vp.getBoundingClientRect(); if (!r.width) return; Z.s = s || Z.s; Z.x = r.width / 2 - Ev.CX * Z.s; Z.y = r.height / 2 - Ev.CY * Z.s; apply(); zoomed = true; }
  function zoomAt(f, px, py) { var ns = Math.max(0.35, Math.min(2.2, Z.s * f)); Z.x = px - (px - Z.x) * ns / Z.s; Z.y = py - (py - Z.y) * ns / Z.s; Z.s = ns; apply(); }
  function bindPan() {
    var vp = $('ev-vp'), pts = {}, start = null, moved = false;
    function snap() { start = { x: Z.x, y: Z.y, s: Z.s, pts: JSON.parse(JSON.stringify(pts)) }; }
    vp.addEventListener('pointerdown', function (e) { if (e.target.closest('.ev-zoom')) return; try { vp.setPointerCapture(e.pointerId); } catch (x) { /* 무시 */ } pts[e.pointerId] = { x: e.clientX, y: e.clientY }; moved = false; snap(); });
    vp.addEventListener('pointermove', function (e) {
      if (!pts[e.pointerId] || !start) return; pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ks = Object.keys(pts), r = vp.getBoundingClientRect();
      if (ks.length === 1 && start.pts[ks[0]]) {
        var p0 = start.pts[ks[0]], dx = e.clientX - p0.x, dy = e.clientY - p0.y; if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
        var want = start.y + dy; Z.x = start.x + dx; Z.y = want; apply();
        // 0.9.2 판 위아래 끝에 닿은 뒤 더 끌면 그만큼 증거 탭을 스크롤(판 때문에 아래로 못 내려가던 것)
        var over = want - Z.y, tab = $('t-evid');
        if (tab) { tab.scrollTop -= (over - (start.over || 0)); start.over = over; }
      }
      else if (ks.length >= 2 && start.pts[ks[0]] && start.pts[ks[1]]) {
        var a = pts[ks[0]], b = pts[ks[1]], a0 = start.pts[ks[0]], b0 = start.pts[ks[1]]; moved = true;
        var d0 = Math.hypot(a0.x - b0.x, a0.y - b0.y) || 1, d1 = Math.hypot(a.x - b.x, a.y - b.y), mx = (a0.x + b0.x) / 2 - r.left, my = (a0.y + b0.y) / 2 - r.top;
        var ns = Math.max(0.35, Math.min(2.2, start.s * d1 / d0)); Z.s = ns;
        Z.x = mx - (mx - start.x) * ns / start.s + ((a.x + b.x) / 2 - (a0.x + b0.x) / 2); Z.y = my - (my - start.y) * ns / start.s + ((a.y + b.y) / 2 - (a0.y + b0.y) / 2); apply();
      }
    });
    function up(e) {
      if (pts[e.pointerId] && !moved && e.type === 'pointerup') {
        var el = document.elementFromPoint(e.clientX, e.clientY), b = el && el.closest && el.closest('#ev-world [data-k]');
        if (b) { sel = b.getAttribute('data-k'); try { ctx.UI.sfx.tap(); } catch (x) { /* 무시 */ } draw(); }
      }
      delete pts[e.pointerId]; snap();
    }
    vp.addEventListener('pointerup', up); vp.addEventListener('pointercancel', up);
    vp.addEventListener('wheel', function (e) { e.preventDefault(); var r = vp.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    $('ev-zi').addEventListener('click', function () { var r = vp.getBoundingClientRect(); zoomAt(1.25, r.width / 2, r.height / 2); });
    $('ev-zo').addEventListener('click', function () { var r = vp.getBoundingClientRect(); zoomAt(0.8, r.width / 2, r.height / 2); });
    $('ev-zc').addEventListener('click', function () { center(0.95); });
  }
  // 0.8.0 증거판은 아래 메뉴 '증거' 탭 안에 있다(창이 아니다). open = 그 탭으로 옮기고 다시 그리기
  function open() { if (ctx.showTab) ctx.showTab('evid'); draw(); if (!zoomed) requestAnimationFrame(function () { center(0.95); }); }
  function close() { sel = null; }

  function onBoardClick(e) {
    var s = S(), t;
    if ((t = e.target.closest('[data-buyc]'))) {
      var id = t.getAttribute('data-buyc');
      try { var c = Ev.buyCard(s, id); ctx.persist(); popId = id;
        Ev.EDGES.forEach(function (ed) { if ((ed[0] === id && Ev.opened(s, ed[1])) || (ed[1] === id && Ev.opened(s, ed[0]))) fresh[ed.join('-')] = 1; });
        toast(c.name + ' — 이어졌어요!'); try { ctx.UI.sfx.coin(); } catch (e2) { /* 무시 */ } ctx.render(); }
      catch (e3) { toast(e3.code === 'NOT_ENOUGH' ? '단서가 모자라요' : e3.code === 'NOT_LINKED' ? '열린 증거와 이어진 칸만 열 수 있어요' : '열 수 없어요'); }
      draw(); return;
    }
    if ((t = e.target.closest('[data-up]'))) {
      try { var lv = Ev.upgrade(s, t.getAttribute('data-up')); ctx.persist(); toast('강화! ★' + lv); try { ctx.UI.sfx.pick(3); } catch (e4) { /* 무시 */ } ctx.render(); }
      catch (e5) { toast(e5.code === 'NOT_ENOUGH' ? '단서가 모자라요' : '더 강화할 수 없어요'); }
      draw(); return;
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
    $('evid-body').addEventListener('click', onBoardClick);
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
