/*
 * Team3ShopUI(0.4.0) — "3팀 매점" 창(상점 · 시즌 패스)과 광고 · 결제 공급자 자리.
 *
 * 구조
 *   규칙은 Team3Monet(M). save 는 사무실(hub.js)이 들고 있어 mount 때 getSave/persist/render/grant/day 를 받는다.
 *   결제 · 광고는 공급자로 나눈다(출시 직전에 앱 껍데기가 진짜를 꽂는다):
 *     Team3Pay  { available():bool, buy(id, done(ok)) }        — 없으면 아래 시험판
 *     Team3Ads  { show(place, done(ok)) }                       — 없으면 아래 시험판(3초 "광고 자리")
 *   시험판 결제: 주소에 ?dev=1 이거나 localStorage 'team3.dev' = '1' 일 때만 "시험 구매"(실제 돈 없음). 아니면 "출시 때 열려요".
 */
(function (root) {
  'use strict';
  var M = root.Team3Monet;
  if (!M) return;
  var $ = function (id) { return document.getElementById(id); };
  function fmt(n) { return Math.floor(n).toLocaleString('ko-KR'); }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  var ctx = null, tab = 'shop';
  function S() { return ctx.getSave(); }
  function now() { return Date.now(); }
  function toast(t) { try { ctx.UI.toast(t); } catch (e) { /* 없음 */ } }

  /* ---------- 공급자(시험판) ---------- */
  function devMode() {
    try { return /[?&]dev=1\b/.test(root.location.search) || root.localStorage.getItem('team3.dev') === '1'; } catch (e) { return false; }
  }
  var Pay = root.Team3Pay || {
    available: function () { return devMode(); },
    test: true,
    buy: function (id, done) { setTimeout(function () { done(true); }, 300); }
  };
  var Ads = root.Team3Ads || {
    test: true,
    // 시험판 광고: 3초 동안 "광고 자리"를 띄우고 끝까지 본 것으로 친다
    show: function (place, done) {
      var el = document.createElement('div'), n = 3;
      el.className = 'ad-stub';
      el.innerHTML = '<div><span class="label">광고 자리 · 시험판</span><b>' + n + '</b><small>출시 때 진짜 광고가 여기에 나와요</small></div>';
      document.body.appendChild(el);
      var t = setInterval(function () {
        n -= 1;
        if (n > 0) { el.querySelector('b').textContent = n; return; }
        clearInterval(t);
        if (el.parentNode) el.parentNode.removeChild(el);
        done(true);
      }, 1000);
    }
  };

  /** 광고 보상: 한도 확인 → (광고 없이 받기면 바로) 광고 → 한 번 쓴 것으로 세고 give() */
  function watch(place, give) {
    var s = S(), day = ctx.day();
    if (M.adLeft(s, place, day) < 1) { toast('오늘은 다 받았어요. 내일 다시 생겨요'); return; }
    var go = function () {
      try { M.adUse(S(), place, ctx.day()); } catch (e) { toast('오늘은 다 받았어요'); return; }
      give();
      ctx.persist(); ctx.render();
      if (isOpen()) draw();
    };
    if (M.perks(s, now()).adFree) go();
    else Ads.show(place, function (ok) { if (ok) go(); else toast('광고를 끝까지 보면 받아요'); });
  }

  /** 상품 사기: 공급자 결제 확인 뒤에만 준다 */
  function buy(id) {
    var p = M.BY_ID[id];
    if (!p) return;
    if (!Pay.available()) { toast('결제는 출시 때 열려요'); return; }
    Pay.buy(id, function (ok) {
      if (!ok) { toast('결제가 취소됐어요'); return; }
      try { M.applyPurchase(S(), id, now(), ctx.grant); } catch (e) { toast(e.code === 'ALREADY' ? '이미 샀어요' : '받을 수 없어요'); return; }
      if (id === 'sub30') M.claimSub(S(), now(), ctx.day());
      ctx.persist(); ctx.render();
      try { ctx.UI.sfx.none(); } catch (e2) { /* 무시 */ }
      toast(p.name + (Pay.test ? ' (시험 구매)' : '') + ' — 받았어요!');
      if (isOpen()) draw();
    });
  }

  /* ---------- 창 ---------- */
  function isOpen() { return !$('shop-sheet').hidden; }
  function open(which) { tab = which || tab; $('shop-sheet').hidden = false; draw(); $('shop-sheet').querySelector('.sheet').scrollTop = 0; }
  function close() { $('shop-sheet').hidden = true; ctx.render(); }
  function won(n) { return '₩' + fmt(n); }
  function payBtn(id, label) {
    var p = M.BY_ID[id];
    return '<button class="primary shop-buy" data-buy="' + id + '"' + (Pay.available() ? '' : ' aria-disabled="true"') + '>' + (label || won(p.krw)) + (Pay.available() && Pay.test ? '<small>시험 구매</small>' : !Pay.available() ? '<small>출시 때 열려요</small>' : '') + '</button>';
  }
  function hoursLeft(ms) { var h = Math.floor(ms / 3600e3), m = Math.floor(ms % 3600e3 / 60e3); return h + '시간 ' + m + '분'; }

  function drawShop() {
    var s = S(), day = ctx.day(), t = now(), html = '';
    // 무료(광고)
    var adf = M.perks(s, t).adFree;
    html += '<span class="label">무료로 받기' + (adf ? ' · 광고 없이 바로' : ' · 짧은 광고를 보면') + '</span>';
    [['ticket', '뽑기권 1장', '동물 뽑기에 써요'], ['party', '팀 회식 무료', '30분 동안 팀이 2배로 일해요']].forEach(function (a) {
      var left = M.adLeft(s, a[0], day);
      html += '<div class="shop-row"><div class="shop-tx"><b>' + a[1] + '</b><small>' + a[2] + ' · 오늘 ' + left + '/' + M.adLimit(s, a[0]) + '번 남음</small></div>' +
        '<button class="ghost" data-ad="' + a[0] + '"' + (left ? '' : ' disabled') + '>' + (adf ? '받기' : '▶ 광고 보고 받기') + '</button></div>';
    });
    // 새내기 꾸러미
    var st = M.starterLeft(s, t);
    if (st > 0) {
      var p0 = M.BY_ID.starter;
      html += '<span class="label">처음 3일만</span><div class="shop-row hot"><div class="shop-tx"><b>' + p0.name + '</b><small>' + esc(p0.desc) + '</small><em>' + hoursLeft(st) + ' 남음</em></div>' + payBtn('starter') + '</div>';
    }
    // 월정액
    var sub = M.BY_ID.sub30, on = M.subActive(s, t);
    html += '<span class="label">꾸준히 하는 팀장님께</span><div class="shop-row' + (on ? ' on' : '') + '"><div class="shop-tx"><b>' + sub.name + (on ? ' · ' + M.subDaysLeft(s, t) + '일 남음' : '') + '</b><small>' + esc(sub.desc) + '</small>' +
      (on ? '<em>' + (s.shop.subDay === day ? '오늘 ◆' + M.SUB.dailyGems + ' 받았어요' : '오늘 보상은 사무실에 오면 들어와요') + '</em>' : '') + '</div>' + payBtn('sub30', on ? '연장 ' + won(sub.krw) : null) + '</div>';
    var af = M.BY_ID.adfree;
    if (!s.shop.adFree) html += '<div class="shop-row"><div class="shop-tx"><b>' + af.name + '</b><small>' + esc(af.desc) + '</small></div>' + payBtn('adfree') + '</div>';
    // 배지
    html += '<span class="label">배지</span><div class="shop-gems">' + M.PRODUCTS.filter(function (p) { return p.kind === 'gems'; }).map(function (p) {
      return '<div class="shop-gem"><b>' + esc(p.desc) + '</b><small>' + esc(p.name) + '</small>' + payBtn(p.id) + '</div>';
    }).join('') + '</div>';
    html += '<p class="muted" style="font-size:11.5px;line-height:1.5">배지로는 동물 뽑기 · 의상 · 칭호 · 이름 바꾸기 · 출동 준비물을 살 수 있어요. 퍼즐 실력은 팔지 않아요.' +
      (Pay.available() && Pay.test ? ' 지금은 시험 구매라 실제 돈이 나가지 않아요.' : '') + '</p>';
    $('shop-body').innerHTML = html;
  }

  // 0.4.1 재화 아이콘: 아이콘 + 숫자(아이콘이 없으면 글자)
  function ic(name) { var I = root.Team3Icons; return I ? I.icon(name) : (name === 'gem' ? '◆' : ''); }
  function rewardText(r) {
    var o = [];
    if (r.pick) o.push(ic('pick') + '전설 선택권');
    if (r.tickets) o.push(ic('ticket') + r.tickets);
    if (r.gems) o.push(ic('gem') + r.gems);
    if (r.treats) o.push(ic('treat') + r.treats);
    return o.join(' ');
  }
  function drawPass() {
    var s = S(), day = ctx.day(), ps = M.passOf(s, day), se = M.seasonOf(s, day), tier = M.tierOf(ps.xp), can = M.claimable(s, day).length;
    var into = ps.xp - tier * M.TIER_XP, pct = tier >= M.TIERS ? 100 : Math.round(into / M.TIER_XP * 100);
    var html = '<div class="pass-top"><div><span class="label">시즌 ' + se.no + ' · ' + se.left + '일 남음</span><b>' + tier + ' / ' + M.TIERS + '단계</b>' +
      '<div class="ach-bar"><i style="width:' + pct + '%"></i></div><small class="muted">' + (tier >= M.TIERS ? '모든 단계를 열었어요!' : '다음 단계까지 ' + (M.TIER_XP - into) + 'XP · 출동마다 10~40XP, 특별 출동 메달 +30') + '</small></div></div>' +
      '<div class="pass-acts"><button class="primary" id="pass-claim"' + (can ? '' : ' disabled') + '>' + (can ? '받을 보상 ' + can + '개 모두 받기' : '받을 보상이 없어요') + '</button>' +
      (ps.premium ? '<span class="pass-prem on">프리미엄 열림</span>' : payBtn('pass', '프리미엄 ' + won(M.BY_ID.pass.krw))) + '</div>' +
      '<div class="pass-grid"><span class="pass-h"></span><span class="pass-h">무료</span><span class="pass-h prem">프리미엄</span>';
    for (var t = 1; t <= M.TIERS; t++) {
      var open = t <= tier;
      var cell = function (track, got, locked) {
        var r = M.reward(track, t);
        return '<span class="pass-c ' + track + (got ? ' got' : open && !locked ? ' ready' : '') + '">' + (got ? '✓ ' : '') + rewardText(r) + '</span>';
      };
      html += '<span class="pass-t' + (open ? ' open' : '') + '">' + t + '</span>' + cell('free', ps.free[t], false) + cell('prem', ps.prem[t], !ps.premium);
    }
    html += '</div><p class="muted" style="font-size:11.5px">프리미엄을 사면 이미 지난 단계의 프리미엄 보상도 모두 받아요. 30단계 프리미엄 보상 "전설 선택권"은 동물 창 도감에서 원하는 전설에 써요.</p>';
    $('pass-body').innerHTML = html;
  }

  function draw() {
    document.querySelectorAll('#shop-tabs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === tab); });
    $('shop-body').hidden = tab !== 'shop';
    $('pass-body').hidden = tab !== 'pass';
    $('shop-wallet').innerHTML = '<span>' + ic('gem') + '배지 <b>' + fmt(S().gems) + '</b></span><span>' + ic('ticket') + '뽑기권 <b>' + fmt(S().pets ? S().pets.tickets : 0) + '</b></span>';
    if (tab === 'shop') drawShop(); else drawPass();
  }

  function mount(c) {
    ctx = c;
    $('shop-x').addEventListener('click', close);
    $('shop-sheet').addEventListener('click', function (e) {
      if (e.target === this) { close(); return; }
      var t = e.target.closest('button');
      if (!t) return;
      if (t.getAttribute('data-tab')) { tab = t.getAttribute('data-tab'); draw(); }
      else if (t.getAttribute('data-buy')) buy(t.getAttribute('data-buy'));
      else if (t.getAttribute('data-ad') === 'ticket') watch('ticket', function () { ctx.grant('tickets', 1); toast('뽑기권 1장을 받았어요'); });
      else if (t.getAttribute('data-ad') === 'party') watch('party', function () { ctx.freeParty(); toast('팀 회식! 30분 동안 팀이 2배로 일해요'); });
      else if (t.id === 'pass-claim') {
        var got = M.claimPass(S(), ctx.day(), ctx.grant);
        ctx.persist(); ctx.render();
        if (got.length) { try { ctx.UI.sfx.coin(); } catch (e2) { /* 무시 */ } toast('보상 ' + got.length + '개를 받았어요'); }
        draw();
      }
    });
    var chip = $('h-gems');
    if (chip) chip.addEventListener('click', function () { open('shop'); });
  }

  root.Team3ShopUI = { mount: mount, open: open, close: close, isOpen: isOpen, watch: watch, isTest: function () { return !!Ads.test; } };
})(typeof self !== 'undefined' ? self : this);
