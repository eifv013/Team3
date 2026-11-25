/*
 * Team3MenuUI(0.8.0) — 사무실 아래 메뉴: 팀 · 출동 · 상황실(가운데, 메인) · 증거 · 파트너.
 *
 *   탭 옮기기: 아래 메뉴 · 화면 좌우로 밀기 · 바로 가기(오늘 할 일 · 팀/증거 단추)는 그 탭의 그 칸까지 굴려 노랗게 짚는다.
 *   뒤로: 열었던 탭을 하나씩 되돌아가고, 마지막엔 상황실. 상황실에서는 앱이 종료를 맡는다(두 번 눌러 종료).
 *   메뉴 숫자: 팀 · 출동 = 지금 살 수 있는 개수(초록), 파트너 = 뽑기권 · 오늘 안 쓰다듬음(빨강), 증거 = 받을 단서가 지난번보다 많으면 반짝.
 *   팀 탭: 요약 한 줄(팀 속도 · 팀 수사비 · 부서 수입) · 작은 탭(3팀 · 부서 · 지원) · "추천" 띠(1분 수입이 값에 비해 가장 많이 느는 칸).
 *   상황실 탭: 오늘 할 일(접힘 · 누르면 그 칸으로) · 팀/증거 바로 가기.
 *   출동 탭: 출동 기록판(최근 5판 막대 · 난이도마다 최고).
 *   파트너 탭: 파트너 칸(크게) · 뽑기/도감/옷장/매점 · 파트너 효과 목록.
 * 규칙은 다른 모듈에 있다. 여기는 화면 배치와 이동만. hub.js 가 render 할 때 같이 부른다.
 */
(function (root) {
  'use strict';
  var ORDER = ['team', 'run', 'home', 'evid', 'pets'];
  var evSeen = -1;
  var ctx = null, cur = 'home', hist = [], sub = 'team', onShow = {};
  function $(id) { return document.getElementById(id); }
  function S() { return ctx.getSave(); }
  function setHTML(el, h) { if (el && el._mh !== h) { el._mh = h; el.innerHTML = h; } }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // 0.8.0 작은 탭 · 탭을 떠날 때 그 안의 "새" 표시를 지운다(한 번 봤으니까)
  function leaveSub(k) { if (!ctx.CUI || cur !== 'team') return; if (k === 'team') ctx.CUI.seen('r'); if (k === 'tech') ctx.CUI.seen('t'); }
  /* ---------- 탭 ---------- */
  function go(tab, opt) {
    opt = opt || {};
    if (ORDER.indexOf(tab) < 0 || !$('t-' + tab)) return;
    var from = cur;
    if (tab !== from && ctx.CUI) { if (from === 'team') leaveSub(sub); if (from === 'run') ctx.CUI.seen('k'); }
    // 0.8.3 팀 탭은 3팀이 첫 화면: 다른 큰 탭으로 나가면 3팀 칸으로 되돌려 둔다(다시 오면 3팀부터)
    if (tab !== from && from === 'team') { setSub('team'); var tt = $('t-team'); if (tt) tt.scrollTop = 0; }
    if (tab !== from) {
      if (!opt.back) { hist = hist.filter(function (x) { return x !== from; }); hist.push(from); if (hist.length > 8) hist.shift(); }
      var dx = ORDER.indexOf(tab) > ORDER.indexOf(from) ? '14px' : '-14px';
      document.querySelectorAll('#h-tabs .tab').forEach(function (t) { var on = t.id === 't-' + tab; t.classList.toggle('on', on); if (on) t.style.setProperty('--dx', dx); });
      cur = tab;
      var tb0 = $('t-' + tab); if (tb0) tb0.scrollTop = 0;   // 0.10.4 탭을 옮기면 늘 맨 위부터
    }
    document.querySelectorAll('#h-nav button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-go') === tab); });
    if (onShow[tab]) onShow[tab]();
    render();
  }
  /** 뒤로: 처리했으면 true(앱이 종료로 넘기지 않게) */
  function back() {
    if (cur === 'home') return false;
    var prev = hist.pop();
    while (prev && (prev === cur)) prev = hist.pop();
    go(prev || 'home', { back: true });
    if (!prev) hist = [];
    return true;
  }
  function setSub(k) {
    if (sub !== k) { leaveSub(sub); var tt0 = $('t-team'); if (tt0) tt0.scrollTop = 0; }   // 0.10.4 작은 탭도 맨 위부터
    sub = k;
    document.querySelectorAll('#h-seg button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-sub') === k); });
    document.querySelectorAll('#t-team .t-sub').forEach(function (d) { d.classList.toggle('on', d.getAttribute('data-sub') === k); });
  }
  // 그 탭으로 옮기고 그 칸을 탭 가운데로 굴려 노랗게 짚는다(탭 안에서만 굴린다 — 머리가 밀려 잘리지 않게)
  function jump(tab, sel) {
    var el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (el && tab === 'team') { var sb = el.closest('.t-sub'); if (sb) setSub(sb.getAttribute('data-sub')); }
    go(tab);
    if (!el) return;
    setTimeout(function () {
      var pg = el.closest('.tab'); if (!pg) return;
      var r = el.getBoundingClientRect(), pr = pg.getBoundingClientRect();
      pg.scrollTo({ top: pg.scrollTop + r.top - pr.top - Math.max(0, (pr.height - r.height) / 2), behavior: 'smooth' });
      el.classList.remove('spot'); void el.offsetWidth; el.classList.add('spot'); setTimeout(function () { el.classList.remove('spot'); }, 1600);
    }, 60);
  }

  /* ---------- 살 수 있는 것 · 추천 ---------- */
  function can(btns) { var n = 0; btns.forEach(function (b) { if (b && !b.disabled && !b.classList.contains('short') && !b.classList.contains('max')) n += 1; }); return n; }
  function q(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function teamBtns(k) {
    if (k === 'team') return [$('h-hire'), $('h-trainb')].concat(q('#h-crew [data-crbuy]'));
    if (k === 'tech') return q('#h-tech [data-crbuy]');
    if (k === 'dept') return q('#h-dept [data-buy]');
    return q('#h-support [data-support]');
  }
  /*
   * 추천: 지금 살 수 있는 것 중 "1분 수입이 값에 비해 가장 많이 느는" 칸. 형사 · 훈련은 하나 늘린 셈 치고 1분 수입을 다시 재고,
   *   부서는 한 명 늘린 셈 치고 부서 수입을 다시 잰다(저장은 바로 되돌린다).
   */
  function bestBuy() {
    var s = S(), I = ctx.I, t = ctx.nowMs(), best = null, bestV = 0;
    var base = I.incomePerMin(s, t) / 60 + (ctx.Dp ? ctx.Dp.perSec(s, ctx.deptMult(s)) : 0);
    function tryOne(el, cost, bump, undo) {
      if (!el || el.disabled || !(cost > 0) || cost > s.money) return;
      bump(); var v = I.incomePerMin(s, t) / 60 + (ctx.Dp ? ctx.Dp.perSec(s, ctx.deptMult(s)) : 0); undo();
      var gain = (v - base) / cost;
      if (gain > bestV) { bestV = gain; best = el; }
    }
    try {
      tryOne($('h-hire'), I.cost(s, 'hire'), function () { s.detectives += 1; }, function () { s.detectives -= 1; });
      tryOne($('h-trainb'), I.cost(s, 'train'), function () { s.training += 1; }, function () { s.training -= 1; });
      if (ctx.Dp) ctx.Dp.LIST.forEach(function (x) {
        var el = document.querySelector('#h-dept [data-buy="' + x.id + '"]');
        tryOne(el, ctx.Dp.cost(s, x.id, 1, 0), function () { s.dept.n[x.id] += 1; }, function () { s.dept.n[x.id] -= 1; });
      });
    } catch (e) { return null; }
    return best;
  }

  /* ---------- 오늘 할 일 ---------- */
  function todos() {
    var s = S(), out = [], day = ctx.dayNow();
    if (root.Team3QuestUI) { var qn = root.Team3QuestUI.ready(); out.push({ ic: '📋', t: qn ? '임무 보상 ' + qn + '개' : '일간, 주간, 월간 임무', a: qn ? '받기' : '보기', done: false, go: function () { root.Team3QuestUI.open(); } }); }   // 0.10.3
    if (root.Team3AttendUI) out.push({ ic: '📅', t: '출석 체크', a: '출석', done: !root.Team3AttendUI.can(), go: function () { root.Team3AttendUI.open(); } });   // 0.10.2
    if (ctx.E) { var st = ctx.E.dailyStatus(s, day); out.push({ ic: '🏅', t: '오늘의 특별 출동', a: '도전', done: st.done, go: function () { jump('run', '#h-daily'); } }); }
    if (ctx.PT && s.pets && s.pets.eq) { var bd = ctx.PT.bondOf(s, s.pets.eq); out.push({ ic: '🐾', t: '파트너 쓰다듬기', a: '쓰다듬기', done: bd.last === day, go: function () { jump('pets', '#h-pet'); } }); }
    if (ctx.PT && ctx.PT.freeLeft) { var fl = ctx.PT.freeLeft(s, day, ctx.freeExtra ? ctx.freeExtra() : 0); out.push({ ic: '🎟️', t: '오늘 무료 뽑기', a: '뽑기', done: !(fl > 0), go: function () { go('pets'); if (ctx.PUI) ctx.PUI.open('draw'); } }); }
    if (ctx.OF && s.office) { var full = (s.office.cell || 0) >= (ctx.OF.CELL_CAP || 20); out.push({ ic: '🚔', t: '유치장 이송', a: '이송', done: !full, go: function () { jump('home', '#h-office'); } }); }
    if (ctx.H) { var un = ctx.H.unclaimed(s); if (un) out.push({ ic: '🏆', t: '업적 보상 ' + un + '개', a: '받기', done: false, go: function () { if (ctx.AUI) ctx.AUI.open(); } }); }
    return out;
  }
  function renderTodo() {
    var box = $('h-todo'); if (!box) return;
    var list = todos(), left = list.filter(function (x) { return !x.done; }), nx = left[0];
    box._list = list;
    setHTML(box, '<h4 data-fold>오늘 할 일 <small>' + (list.length - left.length) + ' / ' + list.length + '<span class="chev">▾</span></small></h4>' +
      '<div class="next" data-fold>' + (nx ? '다음: ' + nx.ic + ' <b>' + esc(nx.t) + '</b>' : '오늘 할 일을 다 했어요 ✓') + '</div>' +
      list.map(function (x, i) { return '<button class="' + (x.done ? 'done' : '') + '" data-todo="' + i + '"><b aria-hidden="true">' + x.ic + '</b><span>' + esc(x.t) + '</span><em>' + (x.done ? '완료' : x.a + ' ›') + '</em></button>'; }).join(''));
  }

  /* ---------- 출동 기록판 ---------- */
  function renderRec() {
    var box = $('h-rec'); if (!box) return;
    var s = S(), r = (s.recent || []).slice(-5), mx = Math.max.apply(null, r.concat([1]));
    var b = s.diff && s.diff.bests ? s.diff.bests : { easy: 0, normal: s.bestScore || 0, hard: 0 };
    var Df = ctx.Df, L = function (k) { return Df ? Df.info(k) : { icon: '', name: k, color: '#FFD23F' }; };
    setHTML(box, '<h4>출동 기록 <small>최근 ' + (r.length || 0) + '판</small></h4>' +
      (r.length ? '<div class="rec-bars">' + r.map(function (v, i) { var last = i === r.length - 1; return '<div><i class="' + (last ? 'last' : '') + '" style="height:' + Math.max(4, Math.round(v / mx * 70)) + '%"><em>' + ctx.fmtShort(v) + '</em></i><small>' + (last ? '방금' : (r.length - 1 - i) + '판 전') + '</small></div>'; }).join('') + '</div>'
        : '<small style="color:var(--muted)">출동하면 점수가 여기 쌓여요</small>') +
      '<div class="rec-best">' + ['easy', 'normal', 'hard'].map(function (k) { var l = L(k); return '<div style="--c:' + l.color + '"><small>' + l.icon + ' ' + l.name.replace(' 사건', '') + ' 최고</small><b>' + (b[k] ? ctx.fmt(b[k]) : '—') + '</b></div>'; }).join('') + '</div>');
  }

  /* ---------- 파트너 탭 ---------- */
  function renderPets() {
    var s = S(), p = s.pets || {}, PT = ctx.PT; if (!PT) return;
    var day = ctx.dayNow(), fl = PT.freeLeft ? PT.freeLeft(s, day, ctx.freeExtra ? ctx.freeExtra() : 0) : 0, pr = PT.progress ? PT.progress(s) : null;
    var set = function (id, t, hot) { var e = $(id); if (e) { e.textContent = t; e.parentNode.classList.toggle('hot', !!hot); } };
    set('h-pl-draw', fl > 0 ? '무료 ' + fl + '번 가능' : '뽑기권 ' + (p.tickets || 0) + '장', (p.tickets || 0) > 0 || fl > 0);
    var fcn = PT.freshCount ? PT.freshCount(s) : 0;
    set('h-pl-dex', pr ? (fcn ? 'NEW ' + fcn + '마리' : pr.have + ' / ' + pr.total) : '', fcn > 0);   // 0.10.6 새로 얻은 파트너
    set('h-pl-closet', '옷 ' + (p.closet ? Object.keys(p.closet).length : 0) + '벌');
    var x = p.eq && PT.parse(p.eq), lines = [];
    if (x) {
      var eff = PT.describe(PT.eqEffect(x.id, x.g, p.own[p.eq])), bd = PT.bondOf(s, p.eq);
      eff.forEach(function (t) { var m = /^(.*?)\s*([+−-].*)$/.exec(t); lines.push('<div><span>' + esc(m ? m[1] : t) + '</span><b>' + esc(m ? m[2] : '') + '</b></div>'); });
      lines.push('<div><span>친밀도</span><b style="color:#FF8FB0">♥ ' + bd.lv + '단계 (함께 ' + bd.days + '일)</b></div>');
    }
    setHTML($('h-peff'), lines.length ? '<span class="section-t" style="margin:4px 0 0">파트너 효과</span>' + lines.join('') : '');
  }

  /* ---------- 매초 ---------- */
  var seenDot = {};   // 0.10.5 이번 접속에서 확인한 탭 숫자(저장하지 않는다 → 다음 접속에 다시)
  function render() {
    if (!ctx || !$('h-nav')) return;
    var s = S();
    // 팀 · 출동: 살 수 있는 개수
    var nt = can(teamBtns('team')) + can(teamBtns('tech')) + can(teamBtns('dept')) + can(teamBtns('sup'));
    var nr = can(q('#h-gear button')) + can(q('#h-kit [data-crbuy]'));
    var dailyLeft = ctx.E ? !ctx.E.dailyStatus(s, ctx.dayNow()).done : false;
    var ev = ctx.Ev, gain = ev ? ev.gainNow(s) : 0, lg = s.evid && s.evid.log && s.evid.log.length ? s.evid.log[s.evid.log.length - 1].gain : 0;
    var evGlow = gain >= 1 && (lg ? gain > lg : gain >= 3);
    // 0.12.8 증거 탭을 한 번 열면 끈다. 재수사해서 다시 조건이 될 때(재수사 횟수가 바뀜)만 또 켠다
    var evKey = s.evid ? s.evid.retreats : 0;
    if (cur === 'evid' && evGlow) evSeen = evKey;
    if (evSeen === evKey) evGlow = false;
    var p = s.pets || {}, unpat = ctx.PT && p.eq && ctx.PT.bondOf(s, p.eq).last !== ctx.dayNow();
    var fl0 = ctx.PT && ctx.PT.freeLeft ? ctx.PT.freeLeft(s, ctx.dayNow(), ctx.freeExtra ? ctx.freeExtra() : 0) : 0;
    var np = (p.tickets || 0) + (unpat ? 1 : 0) + (fl0 > 0 ? 1 : 0);
    /* 0.10.5 아래 탭 숫자: 그 탭을 한 번 열어 보면 이번 접속 동안은 숨긴다(그 뒤 새로 늘어날 때만 다시) */
    var dot = function (k, n, cls) {
      var b = document.querySelector('#h-nav [data-go="' + k + '"] em'); if (!b) return;
      if (cur === k) seenDot[k] = n;
      else if (seenDot[k] != null && n < seenDot[k]) seenDot[k] = n;   // 줄었으면 기준도 내려 둔다(다시 늘면 보이게)
      var show = n > 0 && !(seenDot[k] != null && n <= seenDot[k]);
      b.hidden = !show; b.textContent = n > 99 ? '99+' : n; b.className = cls || '';
    };
    dot('team', nt, 'can'); dot('run', nr, 'can'); dot('pets', np, '');   // 0.8.2 출동 숫자는 살 수 있는 것만(특별 출동은 오늘 할 일에)
    var eb = document.querySelector('#h-nav [data-go="evid"]'); if (eb) eb.classList.toggle('glow', evGlow);
    // 작은 탭 숫자
    // 작은 탭: 새로 열린 칸이 있으면 파란 "새 N", 아니면 살 수 있는 개수(초록)
    var Cr = ctx.Cr, nNew = { team: Cr ? Cr.newCount(s, 'r') : 0, tech: Cr ? Cr.newCount(s, 't') : 0 };
    q('#h-seg button').forEach(function (b) { var k = b.getAttribute('data-sub'), nn = nNew[k] || 0, n = can(teamBtns(k)), e = b.querySelector('em');
      e.hidden = !(nn || n); e.textContent = nn ? '새 ' + nn : n; e.classList.toggle('new', !!nn); });
    // 팀 요약
    var I = ctx.I, t = ctx.nowMs(), rate = I.teamRate(s) * 60, inc = I.incomePerMin(s, t), dpm = ctx.Dp ? ctx.Dp.perSec(s, ctx.deptMult(s)) * 60 : 0;
    setHTML($('h-tsum'), '<div><small>팀 속도</small><b>' + (rate < 10 ? rate.toFixed(1) : ctx.fmtShort(Math.round(rate))) + '명/분</b></div><div><small>팀 수사비</small><b>+' + ctx.fmtShort(inc) + '/분</b></div><div><small>부서 수입</small><b>+' + ctx.fmtShort(dpm) + '/분</b></div>');
    // 추천 띠
    var best = bestBuy();
    q('.reco-rib').forEach(function (e) { if (!best || !best.closest || e !== best.closest('.item, .dept')) e.classList.remove('reco-rib'); });
    var row = best && best.closest('.item, .dept'); if (row) row.classList.add('reco-rib');
    // 바로 가기 · 상황실 출동 단추 글
    var qt = $('h-q-team'), qe = $('h-q-evid');
    if (qt) { qt.querySelector('small').textContent = nt ? '살 수 있는 것 ' + nt + '개 ›' : '수사비를 모으는 중'; qt.classList.toggle('hot', nt > 0); }
    if (qe) { qe.querySelector('small').textContent = '재수사 단서 ' + gain + (evGlow ? ', 현재 좋아요' : ''); qe.classList.toggle('glow', evGlow); }
    var gs = $('h-go-sub'), hs = $('h-go-home-sub'); if (gs && hs) hs.textContent = gs.textContent;
    var hg = $('h-go'), hh = $('h-go-home'); if (hg && hh) hh.classList.toggle('urgent', hg.classList.contains('urgent'));
    renderTodo();
    if (cur === 'run') renderRec();
    if (cur === 'pets') renderPets();
  }

  /* ---------- 좌우로 밀기 ---------- */
  function swipe() {
    var box = $('h-tabs'), sx = null, sy = 0, st = 0;
    box.addEventListener('touchstart', function (e) {
      // 0.8.1: 끌어 옮기는 파트너 · 글 넣는 칸 위에서만 밀기를 하지 않는다(증거판 · 상황실은 누르기만 해서 밀어도 된다)
      if (e.target.closest('#of-pet, #ev-vp, input, textarea')) { sx = null; return; }
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now();
    }, { passive: true });
    box.addEventListener('touchend', function (e) {
      if (sx == null) return;
      var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null;
      if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6 || Date.now() - st > 700) return;
      // 0.8.2 팀 탭에서는 작은 탭(3팀 · 기법 · 부서 · 지원)을 먼저 넘기고, 끝(지원)에서 더 밀면 출동 탭으로
      if (cur === 'team') {
        var SUBS = ['team', 'tech', 'dept', 'sup'], j = SUBS.indexOf(sub) + (dx < 0 ? 1 : -1);
        if (j >= 0 && j < SUBS.length) { setSub(SUBS[j]); var tb = $('t-team'); if (tb) tb.scrollTop = 0; return; }
      }
      var i = ORDER.indexOf(cur) + (dx < 0 ? 1 : -1);
      if (i >= 0 && i < ORDER.length) go(ORDER[i]);
    }, { passive: true });
  }

  function mount(c) {
    ctx = c;
    if (!$('h-nav')) return;
    $('h-nav').addEventListener('click', function (e) { var b = e.target.closest('[data-go]'); if (b) go(b.getAttribute('data-go')); });
    $('h-seg').addEventListener('click', function (e) { var b = e.target.closest('[data-sub]'); if (b) setSub(b.getAttribute('data-sub')); });
    $('h-go-home').addEventListener('click', function () { $('h-go').click(); });
    $('h-q-team').addEventListener('click', function () { var best = bestBuy(); jump('team', best ? best.closest('.item, .dept') : null); });
    $('h-q-evid').addEventListener('click', function () { go('evid'); });
    $('h-todo').addEventListener('click', function (e) {
      if (e.target.closest('[data-fold]')) { $('h-todo').classList.toggle('fold'); return; }
      var b = e.target.closest('[data-todo]'); if (!b) return;
      var x = ($('h-todo')._list || [])[+b.getAttribute('data-todo')]; if (x) x.go();
    });
    document.querySelector('#t-pets .t-plinks').addEventListener('click', function (e) {
      var b = e.target.closest('[data-pet]'); if (!b) return;
      var k = b.getAttribute('data-pet');
      if (k === 'shop') { if (ctx.SUI) ctx.SUI.open('shop'); } else if (ctx.PUI) ctx.PUI.open(k);
    });
    onShow.run = renderRec;
    onShow.pets = renderPets;
    onShow.evid = function () { if (ctx.EUI && ctx.EUI.draw) ctx.EUI.draw(); };
    swipe();
    go('home', { back: true });
  }

  /** 0.10.6 옆 탭으로(증거판 끝에서 더 밀 때) dir: +1 다음 · −1 이전 */
  function step(dir) { var i = ORDER.indexOf(cur) + (dir > 0 ? 1 : -1); if (i >= 0 && i < ORDER.length) go(ORDER[i]); }
  root.Team3MenuUI = { mount: mount, go: go, step: step, back: back, jump: jump, render: render, current: function () { return cur; } };
})(typeof self !== 'undefined' ? self : this);
