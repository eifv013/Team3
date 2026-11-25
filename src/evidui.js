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
  function fmtPay(v) { return v < 10 ? String(Math.round(v * 10) / 10) : fmtShort(v); }   // 작은 값은 소수 한 자리(+0 으로 보이지 않게)
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
      if (!s.dept.seen[x.id]) { html += '<div class="dept locked"><div class="d-ico"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></div><div class="d-mid"><b class="d-name">???</b><div class="d-need"><i style="width:' + Math.min(100, s.money / (x.cost / 2) * 100).toFixed(1) + '%"></i></div><small class="d-mile">수사비 <em>' + fmtShort(Math.min(s.money, x.cost / 2)) + '</em> / ' + fmtShort(x.cost / 2) + '</small></div></div>'; return; }   // 0.10.9 설명 글 대신 모은 양 / 필요한 양
      var q = qty(s, x.id), c = D.cost(s, x.id, q, disc()), ok = s.money >= c && (mode !== 'max' || D.maxBuy(s, x.id, s.money, disc()) > 0);
      var nm = D.nextMile(n), cyc = D.cycle(s, x.id), fast = n > 0 && cyc < 0.6;
      html += '<div class="dept" data-dept="' + x.id + '"><div class="d-ico"><svg viewBox="0 0 24 24">' + ICON[x.id] + '</svg><b>' + n + '</b></div>' +
        '<div class="d-mid"><b class="d-name">' + x.name + '</b>' +
        // 0.10.9 인원이 없으면 막대는 멈춘다 · 한 바퀴 시간과 버는 값은 처음부터 보인다 · 속도 ×2 목표는 점(채운 것은 금색)으로
        '<div class="d-bar' + (fast ? ' fast' : '') + (n ? '' : ' idle') + '"><i data-cyc="' + (n ? cyc : 0) + '"></i><span>' + (n ? '<b>+' + fmtPay(x.pay * n * mult) + '</b>' : '<b>1명당 +' + fmtPay(x.pay * mult) + '</b>') + '<em>' + (cyc >= 1 ? cyc.toFixed(1) : cyc.toFixed(2)) + '초마다</em></span></div>' +
        '<div class="d-miles" aria-label="' + (nm ? nm + '명을 채우면 속도 2배' : '목표 모두 달성') + '"><span>' + (nm ? '속도 ×2' : '속도 ×' + D.mileMult(n)) + '</span>' + D.MILES.map(function (m) { return '<i class="' + (n >= m ? 'on' : m === nm ? 'next' : '') + '">' + m + '</i>'; }).join('') +
          '</div></div>' +
        '<button class="buy d-buy' + (ok ? '' : ' poor') + '" data-buy="' + x.id + '"' + (ok ? '' : ' disabled') + '>' + (ok ? '<em>영입 ×' + q + '</em><b class="cn">' + fmtShort(c) + '</b>' : '<em>영입 ×' + q + '</em><b class="cn">' + fmtShort(c) + '</b>') + '</button></div>';
    });
    box.innerHTML = html;
  }
  // 막대: 화면이 보일 때 매 프레임(실제 수입은 연속 — 막대는 보여 주기용)
  // 0.12.9 발열: 부서 줄이 실제로 보일 때만, 초당 약 15번만 움직인다(전에는 어느 탭에서나 매 장 돌았다)
  var t0 = Date.now(), fLast = 0;
  function frame(ms) {
    requestAnimationFrame(frame);
    if (ms - fLast < 66) return; fLast = ms;
    if (document.hidden) return;
    var dp = $('h-dept'); if (!dp || dp.offsetParent === null) return;
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
    // 0.10.8 증거 탭은 판이 화면을 채운다 → 재수사는 위쪽 얇은 막대 한 줄로
    box.innerHTML = '<div class="rt-bar"><div class="rt-b1"><span class="label">재수사 단서</span><b class="rt-gain' + (can ? '' : ' off') + '">' + (can ? '+' + g : '0') + '</b></div>' +
      '<div class="rt-b2"><small>' + (can ? '다음 +1까지' : '첫 단서까지') + ' 수사비 <b>' + fmtShort(need) + '</b>' + (dur(eta) ? ' ' + dur(eta) : '') + '</small><div class="ach-bar"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
      '<button class="rt-help" id="h-career-help">재수사 ' + e.retreats + '번, 경력 +' + Ev.careerPct(s) + '% <i>?</i></button></div>' +
      '<button class="primary" id="h-retreat-go"' + (can ? '' : ' disabled') + '>재수사</button></div>';
  }
  /* 0.10.6 재수사 경력 · 단서 설명(설명이 없어 무슨 숫자인지 몰랐다) */
  function careerHelp() {
    var s = S(), e = s.evid, P = function (t) { return '<p>' + t + '</p>'; };
    ctx.openInfo({ label: '재수사', title: '단서와 재수사 경력', readOnly: true, body:
      P('<b>단서</b>는 시간이 아니라 <b>이번 재수사 뒤로 번 수사비</b>로 정해져요. 팀, 부서, 출동, 이송, 커피로 번 돈이 모두 들어가요. 많이 벌수록 늘지만 갈수록 더 많이 벌어야 해요.') +
      P('단서로 증거판의 증거를 열면 효과가 생겨요. 단서를 더 받는 증거(최대 +100%)와 매점 광고 보상으로도 얻어요.') +
      P('<b>재수사 경력</b>은 재수사할 때마다 <b>+' + Ev.RANK_PCT + '%</b>씩 쌓여 영구로 붙어요. 팀 속도, 팀 수사비, 출동 수사비, 부서 수입에 곱해져요.') +
      P('현재 재수사 ' + e.retreats + '번 → 경력 <b>+' + Ev.careerPct(s) + '%</b>') });
  }
  function cheapest(s) { return Ev.CARDS.some(function (c) { return Ev.state(s, c.id) === 'can' && c.cost <= Ev.left(s); }) || Object.keys(s.evid.own).some(function (id) { var k = Ev.upCost(s, id); return k != null && k <= Ev.left(s); }); }

  /* ---------- 재수사 흐름 ---------- */
  // 목록은 낱말 칩으로(줄이 바뀌어도 '·'로 시작하거나 낱말 중간에서 꺾이지 않게)
  function chips(a) { return a.map(function (x) { return '<i class="rt-chip">' + x + '</i>'; }).join(''); }
  function confirmRetreat(atClose, then) {
    var s = S(), g = Ev.gainNow(s), cs = ctx.idle.caseOf(s), f = Ev.effects(s);
    if (g < 1) { toast('아직 단서를 받을 수 없어요'); return; }
    var lose = !s.closed && s.caught > 0 && !atClose;
    ctx.openInfo({ label: '재수사, 처음부터 다시 파고들어요', title: '단서 +' + g,
      body: '<p class="rt-why">현재 수사를 접고 <b>처음부터 다시 파고들어요.</b> 그동안 모은 자료에서 놓쳤던 단서를 건져 증거판에 써요.</p>' +
        '<div class="rt-list"><div class="keep"><b>남는 것</b><span>' + chips(['사건 번호', '닫은 사건', '연 수사 일지', '계급', '동물', '배지', '업적', '단서', '증거판']) + '</span></div>' +
        '<div class="reset"><b>처음으로</b><span>' + chips(['수사비' + (f.startMoney ? '(→ ' + fmt(f.startMoney) + ')' : ''), '형사(→ ' + (1 + f.startDet) + '명)', '훈련', '출동 장비', '부서', '유치장'].concat(s.closed ? [] : ['사건 ' + cs.no + ' 진척'])) + '</span></div>' +
        (lose ? (function () {   // 0.10.12 잃는 것을 팀 몫 / 출동 몫으로 나눠 보여 준다(출동 몫은 다시 직접 잡아야 하므로 빨갛게)
          var run = Math.min(s.caught, s.caseRun || 0), keep = Math.floor(run * Math.min(0.5, (f.keep || 0) / 100)), team = s.caught - run;
          return '<div class="warn"><b>현재 사건 진척 ' + fmt(s.caught) + '명이 ' + fmt(keep) + '명으로 돌아가요</b>' +
            '<div class="rt-lose"><span>팀이 잡은 ' + fmt(team) + '명<em>다시 알아서 잡아요</em></span>' +
            (run ? '<span class="hot">출동으로 잡은 ' + fmt(run) + '명<em>' + (keep ? fmt(keep) + '명 남고 ' + fmt(run - keep) + '명은 다시 출동' : '다시 출동해서 잡아야 해요') + '</em></span>' : '') + '</div>' +
            '<span>사건을 닫을 때 재수사하면 잃는 진척이 없어요.</span></div>';
        })() : '') +
        '<div class="gain"><b>얻는 것</b><span>' + chips(['단서 +' + g, '재수사 경력 +' + Ev.RANK_PCT + '%']) + '</span><small class="rt-note">재수사 경력은 팀 속도, 수사비, 부서 수입에 계속 붙어요</small></div></div>',
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
    toast('재수사! 놓쳤던 단서 +' + r.gain + ', 팀을 새로 꾸렸어요');
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
      '<div class="ev-vp" id="ev-vp"><div class="ev-world" id="ev-world"><svg class="ev-str2" id="ev-str" viewBox="0 0 2000 2000"></svg></div>' +
        '<div class="ev-hud"><span>🔍 단서 <b id="ev-left"></b></span><span id="ev-count"></span></div>' +
        '<div class="ev-info" id="ev-info"></div>' +
        '<button class="ev-effbtn" id="ev-effbtn">적용 중인 효과</button><button class="ev-effbtn ev-vaultbtn" id="ev-vaultbtn"></button>' +
        '<button class="ev-repick" id="ev-repick" hidden><b>⇄ 다시 고르는 중</b><em>확정</em></button>' +
        '<div class="ev-zoom"><button id="ev-zi" aria-label="확대">+</button><button id="ev-zo" aria-label="축소">−</button><button id="ev-zc" aria-label="가운데로">◎</button></div></div>' +
      '<div class="ev-locks" id="ev-locks" hidden></div>';   // 0.10.8 효과 합계는 가운데 사건 파일을 누르면 나온다   // 0.10.2 아래 묶음 안내 칩은 뺐다(잠긴 칸 자체에 조건이 보인다)
    var w = $('ev-world'), h = '';
    Object.keys(Ev.NODE).forEach(function (k) { var n = Ev.NODE[k]; h += '<button class="' + (k === 'core' ? 'ev-core' : 'ev-n') + '" data-k="' + k + '" style="left:' + n.x + 'px;top:' + n.y + 'px;--r:' + n.rot + 'deg' + (k === 'core' ? '' : ';--c:' + Ev.COLOR[Ev.BY_ID[k].color].hex) + '"></button>'; });
    Ev.MEMOS.forEach(function (m) { h += '<button class="ev-m" data-m="' + m.id + '" style="left:' + m.x + 'px;top:' + m.y + 'px" aria-label="현장 메모"></button>'; });   // 0.13.0 현장 메모
    w.insertAdjacentHTML('beforeend', h);
    bindPan();
    built = true;
    requestAnimationFrame(function () { center(fitS()); });
  }
  function nodeHTML(k, st) {
    var s = S();
    if (k === 'core') return st === 'open' ? '<span class="ev-stamp">미제, 재수사</span><b>' + CASE_TITLE + '</b><small>' + CASE_LINE + '</small>' : '<b class="q">???</b><small>첫 재수사를 하면 열려요</small>';
    // 0.12.0 갈림길: 자리마다 증거가 둘. 연 자리는 고른 증거를, 열 수 있는 자리는 "A 또는 B"를 보여 준다
    var ch = Ev.chosen(s, k), c = Ev.BY_ID[ch || k], alt = Ev.BY_ID[Ev.PAIR[k]], lv = s.evid.lv[c.id] || 1;
    if (st === 'open') return '<b>' + esc(c.name) + '</b><small>' + esc(Ev.shortText(c, lv)) + '</small>' + (lv >= Ev.MAX_LV ? '<em class="ev-max">MAX</em>' : lv > 1 ? '<em class="ev-lv">' + '★'.repeat(lv) + '</em>' : '') + (Ev.canRepick(s) ? '<span class="ev-sw">⇄</span>' : '');
    if (st === 'can') return '<b>' + esc(c.name) + '</b><small class="ev-or">또는 ' + esc(alt.name) + '</small><em class="ev-cost">🔍 ' + c.cost + ' 둘 중 하나</em>';
    if (st === 'lock') return '<b>' + esc(c.name) + '</b><small class="ev-or">또는 ' + esc(alt.name) + '</small><em class="ev-cost lk">🔒 ' + LOCK[c.tier] + '</em>';
    return '<b class="q">???</b>';
  }
  var GM = {}, effSum = '';
  function groupOf(k) { return GM[k] || 1; }
  function draw() {
    if (!built || !$('ev-world')) build();
    var s = S(), e = s.evid;
    GM = {}; Ev.groups(s).forEach(function (g) { g.ids.forEach(function (id) { GM[id] = g.mult; }); });
    // 실
    var h = '';
    Ev.EDGES.forEach(function (ed) {
      var o0 = Ev.opened(s, ed[0]), o1 = Ev.opened(s, ed[1]), d = strPath(ed[0], ed[1]), key = ed.join('-');
      if (o0 && o1) h += '<path class="on' + (fresh[key] ? ' draw' : '') + '" d="' + d + '"/><path class="flow" d="' + d + '"/>';   // 0.10.8 이어진 실 위로 빛이 흐른다
      else if ((o0 && Ev.state(s, ed[1]) !== 'shut') || (o1 && Ev.state(s, ed[0]) !== 'shut')) h += '<path class="hint" d="' + d + '"/>';
    });
    $('ev-str').innerHTML = h; fresh = {};
    // 0.13.0 현장 메모 · 단서 금고 단추
    var mc = Ev.memoCost(s), ms = document.querySelectorAll('#ev-world .ev-m');
    for (var mi = 0; mi < ms.length; mi++) { var mk = ms[mi].getAttribute('data-m'), mst = Ev.memoState(s, mk), mcl = 'ev-m ' + mst + (mst === 'can' && s.money < mc ? ' poor' : '') + (mk === sel ? ' sel' : ''); if (ms[mi].className !== mcl) ms[mi].className = mcl; var mt = mst === 'open' ? '+' + Ev.MEMO.pct + '%' : mst === 'can' ? '메모' : ''; if (ms[mi].textContent !== mt) ms[mi].textContent = mt; }
    var vb = $('ev-vaultbtn'); if (vb) { var vt = '단서 금고 ' + e.vault + ' / ' + Ev.VAULT.max; if (vb.textContent !== vt) vb.textContent = vt; var vc = Ev.vaultCost(s); vb.classList.toggle('can', vc != null && s.money >= vc); }
    // 자리
    var els = $('ev-world').querySelectorAll('[data-k]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i], k = el.getAttribute('data-k'), st = Ev.state(s, k), cls = (k === 'core' ? 'ev-core ' : 'ev-n ') + st + (st === 'can' && k !== 'core' && Ev.left(s) < Ev.BY_ID[k].cost ? ' poor' : '') + (k === sel ? ' sel' : '') + (k === popId ? ' pop' : '');   // 0.12.7 poor: 열 수는 있지만 단서가 모자람(금테 없음)
      var html = nodeHTML(k, st);
      if (el.className !== cls) el.className = cls;
      if (el._h !== html) { el._h = html; el.innerHTML = html; }
    }
    popId = null;
    var nOwn = Object.keys(e.own).length;
    $('ev-left').textContent = Ev.left(s);
    var rpb = $('ev-repick'); if (rpb) rpb.hidden = !(Ev.canRepick(s) && nOwn > 0);
    $('ev-count').textContent = '열린 증거 ' + nOwn + ' / ' + Ev.CARDS.length;
    info();
    var f = Ev.effects(s);
    var eff = Object.keys(Ev.KEY_NAME).filter(function (k) { return f[k]; }).map(function (k) { return '<span class="ev-chip">' + Ev.KEY_NAME[k] + ' <b>' + (k === 'miss' ? '−' : '+') + (k === 'startMoney' ? fmtShort(f[k]) : f[k]) + '</b></span>'; }).join('');
    effSum = '<button class="ev-chip career" data-career>재수사 경력 <b>+' + Ev.careerPct(s) + '%</b> ⓘ</button>' + (eff || '<span class="muted" style="font-size:12px">증거를 열면 효과가 생겨요. 강화하면 효과가 더 커져요.</span>');
    var locked = Ev.CARDS.filter(function (c) { return !Ev.tierOpen(s, c.tier); }), byT = {};
    locked.forEach(function (c) { (byT[c.tier] = byT[c.tier] || []).push(c); });
    $('ev-locks').innerHTML = locked.length ? Object.keys(byT).map(function (t) { return '<span class="ev-lock">' + lockText(+t) + '에 ' + byT[t].length + '장</span>'; }).join('') : '';
  }
  function info() {
    var s = S(), box = $('ev-info'); if (!box) return;
    box.className = 'ev-info' + (sel ? ' evc' : ' evp');   // (card 는 퍼즐 카드 클래스와 겹쳐서 쓰지 않는다)
    if (!sel) {
      box.innerHTML = Ev.coreOpen(s) ? '<span>증거를 누르면 설명이 나와요</span>' : '<span>재수사하면 사건 파일이 열려요</span>';
      return;
      box.innerHTML = '<div class="tx"><b>' + (Ev.coreOpen(s) ? '반짝이는 증거를 눌러 보세요' : '아직 아무것도 몰라요') + '</b><small>' + (Ev.coreOpen(s) ? '열린 증거와 실로 이어진 칸만 단서로 열 수 있어요. 끌어서 움직이고, 두 손가락으로 확대해요.' : '재수사를 하면 놓쳤던 사건 파일이 판 가운데 붙어요.') + '</small></div>';
      return;
    }
    if (sel === 'legend') {
      var gs = Ev.groups(s).filter(function (g) { return g.ids.length > 1; });
      box.innerHTML = '<div class="tx"><b>같은 색 증거를 실로 이으면 효과가 커져요</b>' +
        '<div class="ev-lg-rule"><span>2장 <b>×1.5</b></span><span>3장 <b>×2</b></span><span>5장 <b>×2.5</b></span></div>' +
        '<div class="ev-lg-cols">' + ['r', 'b', 'y', 'g'].map(function (c) { return '<span><i class="dot" style="background:' + Ev.COLOR[c].hex + '"></i>' + Ev.COLOR[c].name + '</span>'; }).join('') + '</div>' +
        '<small>' + (gs.length ? '현재 묶음: ' + gs.map(function (g) { return Ev.COLOR[g.color].name.split(',')[0] + ' ' + g.ids.length + '장 ×' + g.mult; }).join(', ') : '색은 증거의 종류예요. 효과는 증거마다 따로 적혀 있어요.') + '</small></div>';
      return;
    }
    if (sel === 'vault') {   // 0.13.0 단서 금고
      var cp = Ev.cluePct(s), vc0 = Ev.vaultCost(s), chip = function (n, v, mx) { return '<span class="ev-chip">' + n + ' <b>+' + v + '%</b> / ' + mx + '%</span>'; };
      box.innerHTML = '<div class="ev-opt on"><div class="tx"><b>단서 금고 ' + s.evid.vault + ' / ' + Ev.VAULT.max + '</b><small><span class="ln">단계마다 재수사 단서 +' + Ev.VAULT.pct + '%</span><span class="ln">재수사해도 남아요</span></small></div>' +
        '<button class="ev-act up" data-vault="1"' + (vc0 != null && s.money >= vc0 ? '' : ' disabled') + '>' + (vc0 == null ? '<span>최고 단계</span>' : '<span>올리기</span><b>' + ic('money') + fmtShort(vc0) + '</b>') + '</button></div>' +
        '<div class="ev-eff-sum">' + chip('증거', cp.card, 100) + chip('금고', cp.vault, Ev.VAULT.max * Ev.VAULT.pct) + chip('기록 갱신', cp.record, Ev.RECORD.max) + '</div>' +
        '<small class="ev-vnote"><span class="ln">기록 갱신은 이번 수사비가</span><span class="ln">지난 최고 기록의 두 배가 될 때마다 +' + Ev.RECORD.per + '%</span></small>';
      return;
    }
    if (/^m_/.test(sel)) {   // 0.13.0 현장 메모
      var mst2 = Ev.memoState(s, sel), mc2 = Ev.memoCost(s), at = Ev.BY_ID[Ev.chosen(s, Ev.MEMOS.filter(function (m) { return m.id === sel; })[0].at) || Ev.MEMOS.filter(function (m) { return m.id === sel; })[0].at];
      box.innerHTML = '<div class="ev-opt' + (mst2 === 'open' ? ' on' : '') + '"><div class="tx"><b>현장 메모 ' + Ev.memoCount(s) + ' / ' + Ev.MEMOS.length + '</b><small><span class="ln">수사비와 팀 수입 +' + Ev.MEMO.pct + '%</span><span class="ln">재수사하면 사라져요</span>' + (mst2 === 'shut' ? '<span class="ln">' + esc(at.name) + ' 자리를 먼저 열어야 해요</span>' : '') + '</small></div>' +
        (mst2 === 'open' ? '<span class="ev-note">붙였어요</span>' : '<button class="ev-act" data-memo="' + sel + '"' + (mst2 === 'can' && s.money >= mc2 ? '' : ' disabled') + '><span>붙이기</span><b>' + ic('money') + fmtShort(mc2) + '</b></button>') + '</div>';
      return;
    }
    var st = Ev.state(s, sel);
    if (sel === 'core') { box.innerHTML = '<div class="tx"><b>' + (st === 'open' ? '현재 적용 중인 효과' : '???') + '</b>' + (st === 'open' ? '<div class="ev-eff-sum">' + effSum + '</div>' : '<small>첫 재수사를 하면 열려요.</small>') + '</div>'; return; }
    var ch = Ev.chosen(s, sel), c = Ev.BY_ID[ch || sel], other = Ev.BY_ID[Ev.PAIR[c.id]], col = Ev.COLOR[c.color], dot = '<i class="dot" style="background:' + col.hex + '"></i>';
    if (st === 'open') {
      var lv = s.evid.lv[c.id] || 1, up = Ev.upCost(s, c.id), olv = s.evid.lv[other.id] || 1, rp = Ev.canRepick(s);
      box.innerHTML = '<div class="ev-opt on"><div class="tx"><b>' + dot + esc(c.name) + (lv > 1 ? ' <em class="ev-lv">' + '★'.repeat(lv) + '</em>' : '') + '</b><small>' + esc(Ev.describe(c, lv)) + '</small></div>' +
        '<button class="ev-act up" data-up="' + c.id + '"' + (up != null && up <= Ev.left(s) ? '' : ' disabled') + '>' + (up == null ? '<span>최고 단계</span>' : '<span>강화</span><b>🔍 ' + up + '</b>') + '</button></div>' +
        '<div class="ev-opt off"><div class="tx"><b>' + esc(other.name) + (olv > 1 ? ' <em class="ev-lv">' + '★'.repeat(olv) + '</em>' : '') + '</b><small>' + esc(Ev.describe(other, olv)) + '</small></div>' +
        (rp ? '<button class="ev-act sw" data-swap="' + other.id + '"><span>이걸로</span><b>바꾸기</b></button>' : '<span class="ev-note">재수사하면<br>바꿀 수 있어요</span>') + '</div>';
      return;
    }
    if (st === 'can') {
      box.innerHTML = '<p class="ev-pick-t">둘 중 하나만 열 수 있어요</p>' + [c, other].map(function (x) {
        return '<div class="ev-opt"><div class="tx"><b>' + dot + esc(x.name) + '</b><small>' + esc(Ev.describe(x, 1)) + '</small></div>' +
          '<button class="ev-act" data-buyc="' + x.id + '"' + (Ev.left(s) >= x.cost ? '' : ' disabled') + '><span>열기</span><b>🔍 ' + x.cost + '</b></button></div>';
      }).join('');
      return;
    }
    box.innerHTML = st === 'lock' ? '<div class="tx"><b>' + dot + esc(c.name) + ' 또는 ' + esc(other.name) + '</b><small>' + esc(Ev.describe(c, 1)) + ' / ' + esc(Ev.describe(other, 1)) + '<br>' + lockText(c.tier) + '부터 열 수 있어요.</small></div>'
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
  // 0.12.7 움직이는 동안(.moving)은 판 위 애니메이션을 멈춰 버벅임을 줄인다 — 손을 떼고 0.25초 뒤 다시 켠다
  var mvT = 0;
  function apply() { clamp(); var w = $('ev-world'); if (!w) return; w.style.transform = 'translate3d(' + Z.x + 'px,' + Z.y + 'px,0) scale(' + Z.s + ')';
    var vp = w.parentNode; if (vp && !vp._mv) { vp._mv = 1; vp.classList.add('moving'); } clearTimeout(mvT); mvT = setTimeout(function () { if (vp) { vp._mv = 0; vp.classList.remove('moving'); } }, 250); }
  function center(s) { var vp = $('ev-vp'); if (!vp) return; var r = vp.getBoundingClientRect(); if (!r.width) return; Z.s = s || Z.s; Z.x = r.width / 2 - Ev.CX * Z.s; Z.y = r.height / 2 - Ev.CY * Z.s; apply(); zoomed = true; }
  function fitS() { var vp = $('ev-vp'), r = vp ? vp.getBoundingClientRect() : null; return r && r.width ? Math.max(0.5, Math.min(0.95, Math.min(r.width, r.height) / 430)) : 0.95; }   // 0.12.0 작은 화면에서는 첫 줄 증거가 다 보이게 줄여서 시작
  function zoomAt(f, px, py) { var ns = Math.max(0.35, Math.min(2.2, Z.s * f)); Z.x = px - (px - Z.x) * ns / Z.s; Z.y = py - (py - Z.y) * ns / Z.s; Z.s = ns; apply(); }
  function bindPan() {
    var vp = $('ev-vp'), pts = {}, start = null, moved = false;
    function snap() { start = { x: Z.x, y: Z.y, s: Z.s, pts: JSON.parse(JSON.stringify(pts)) }; }
    vp.addEventListener('pointerdown', function (e) { if (e.target.closest('.ev-zoom, .ev-info.evc, .ev-legend, .ev-effbtn, .ev-repick')) return; try { vp.setPointerCapture(e.pointerId); } catch (x) { /* 무시 */ } pts[e.pointerId] = { x: e.clientX, y: e.clientY }; moved = false; snap(); });
    vp.addEventListener('pointermove', function (e) {
      if (!pts[e.pointerId] || !start) return; pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ks = Object.keys(pts), r = vp.getBoundingClientRect();
      if (ks.length === 1 && start.pts[ks[0]]) {
        var p0 = start.pts[ks[0]], dx = e.clientX - p0.x, dy = e.clientY - p0.y; if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
        var want = start.y + dy, wantX = start.x + dx; Z.x = wantX; Z.y = want; apply();
        start.overX = wantX - Z.x;   // 0.10.6 판 좌우 끝에 닿은 뒤 더 민 만큼(손을 떼면 옆 탭으로)
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
      // 0.10.6 판 좌우 끝에서 80px 넘게 더 밀고 떼면 옆 탭으로(다른 탭처럼 넘기기)
      if (pts[e.pointerId] && moved && e.type === 'pointerup' && start && Object.keys(pts).length === 1 && Math.abs(start.overX || 0) > 80 && root.Team3MenuUI && root.Team3MenuUI.step) {
        var ox = start.overX; delete pts[e.pointerId]; snap(); root.Team3MenuUI.step(ox > 0 ? -1 : 1); return;
      }
      if (pts[e.pointerId] && !moved && e.type === 'pointerup') {
        var el = document.elementFromPoint(e.clientX, e.clientY), b = el && el.closest && el.closest('#ev-world [data-k], #ev-world [data-m]');
        if (b) { sel = b.getAttribute('data-k') || b.getAttribute('data-m'); try { ctx.UI.sfx.tap(); } catch (x) { /* 무시 */ } draw(); }
        else if (sel && !(el && el.closest && el.closest('.ev-info, .ev-zoom'))) { sel = null; draw(); }   // 0.10.8 빈 곳을 누르면 아래 카드가 내려간다
      }
      delete pts[e.pointerId]; snap();
    }
    vp.addEventListener('pointerup', up); vp.addEventListener('pointercancel', up);
    vp.addEventListener('wheel', function (e) { e.preventDefault(); var r = vp.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    $('ev-zi').addEventListener('click', function () { var r = vp.getBoundingClientRect(); zoomAt(1.25, r.width / 2, r.height / 2); });
    $('ev-zo').addEventListener('click', function () { var r = vp.getBoundingClientRect(); zoomAt(0.8, r.width / 2, r.height / 2); });
    $('ev-zc').addEventListener('click', function () { center(fitS()); });
    $('ev-vaultbtn').addEventListener('click', function () { sel = 'vault'; draw(); });
    $('ev-effbtn').addEventListener('click', function () { if (!Ev.coreOpen(S())) { toast('재수사하면 열려요'); return; } sel = 'core'; draw(); });
  }
  // 0.8.0 증거판은 아래 메뉴 '증거' 탭 안에 있다(창이 아니다). open = 그 탭으로 옮기고 다시 그리기
  function open() { if (ctx.showTab) ctx.showTab('evid'); draw(); if (!zoomed) requestAnimationFrame(function () { center(fitS()); }); }
  function close() { sel = null; }

  function onBoardClick(e) {
    var s = S(), t;
    if ((t = e.target.closest('[data-buyc]'))) {
      var id = t.getAttribute('data-buyc');
      try { var c = Ev.buyCard(s, id), sl = Ev.slotOf(id); if (root.Team3QuestUI) root.Team3QuestUI.track('evid', 1); ctx.persist(); popId = sl;
        Ev.EDGES.forEach(function (ed) { if ((ed[0] === sl && Ev.opened(s, ed[1])) || (ed[1] === sl && Ev.opened(s, ed[0]))) fresh[ed.join('-')] = 1; });
        toast(c.name + ' — 이어졌어요!'); try { ctx.UI.sfx.coin(); } catch (e2) { /* 무시 */ } ctx.render(); }
      catch (e3) { toast(e3.code === 'NOT_ENOUGH' ? '단서가 모자라요' : e3.code === 'NOT_LINKED' ? '열린 증거와 이어진 칸만 열 수 있어요' : '열 수 없어요'); }
      draw(); return;
    }
    if ((t = e.target.closest('[data-vault]'))) {
      try { Ev.buyVault(s); ctx.persist(); toast('단서 금고 ' + s.evid.vault + '단계'); try { ctx.UI.sfx.coin(); } catch (e8) { /* 무시 */ } ctx.render(); } catch (e9) { toast(e9.code === 'NO_MONEY' ? '수사비가 모자라요' : '올릴 수 없어요'); }
      draw(); return;
    }
    if ((t = e.target.closest('[data-memo]'))) {
      try { Ev.buyMemo(s, t.getAttribute('data-memo')); ctx.persist(); toast('현장 메모를 붙였어요'); try { ctx.UI.sfx.coin(); } catch (e8) { /* 무시 */ } ctx.render(); } catch (e9) { toast(e9.code === 'NO_MONEY' ? '수사비가 모자라요' : '붙일 수 없어요'); }
      draw(); return;
    }
    if ((t = e.target.closest('[data-swap]'))) {   // 0.12.0 다시 고르기(재수사 뒤)
      try { var w = Ev.swap(s, t.getAttribute('data-swap')); ctx.persist(); popId = Ev.slotOf(w.id); toast(w.name + '(으)로 바꿨어요'); try { ctx.UI.sfx.pick(2); } catch (e6) { /* 무시 */ } ctx.render(); }
      catch (e7) { toast('바꿀 수 없어요'); }
      draw(); return;
    }
    if (e.target.closest('#ev-repick')) { Ev.endRepick(s); ctx.persist(); toast('갈림길을 확정했어요'); draw(); return; }
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
          var row = document.querySelector('#h-dept [data-dept="' + id + '"]'); if (row) { row.classList.remove('bought'); void row.offsetWidth; row.classList.add('bought'); setTimeout(function () { row.classList.remove('bought'); }, 600); } }
        catch (e3) { toast(e3.code === 'NOT_ENOUGH' ? '수사비가 모자라요' : '영입할 수 없어요'); }
        return;
      }
      if (e.target.closest('#h-retreat-go')) { confirmRetreat(false); return; }
      if (e.target.closest('#h-career-help')) { careerHelp(); return; }
      if (e.target.closest('[data-career]')) { careerHelp(); return; }
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
