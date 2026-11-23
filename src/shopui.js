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
  /* 0.9.0 정식 출시 전: 실제 결제 상품을 배지(◆)로 산다(M.PAY_MODE === 'gems'). 출시 뒤엔 Team3Pay(스토어 결제)를 꽂는다 */
  var GemPay = {
    gems: true,
    available: function () { return true; },
    price: function (id) { return M.gemPrice(id); },
    buy: function (id, done) {
      var c = M.gemPrice(id), sv = S();
      if ((sv.gems || 0) < c) { toast('배지가 모자라요 · ◆' + fmt(c) + ' 필요'); done(false, 'NOT_ENOUGH'); return; }
      sv.gems -= c; done(true);
    }
  };
  var Pay = M.PAY_MODE === 'gems' ? GemPay : root.Team3Pay || {
    available: function () { return devMode(); },
    test: true,
    buy: function (id, done) { setTimeout(function () { done(true); }, 300); }
  };
  function priceLabel(id) { return Pay.gems ? ic('gem') + fmt(M.gemPrice(id)) : won(M.BY_ID[id].krw); }
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
    Pay.buy(id, function (ok, why) {
      if (!ok) { if (why !== 'NOT_ENOUGH') toast('결제가 취소됐어요'); return; }
      try { M.applyPurchase(S(), id, now(), ctx.grant); } catch (e) { toast(e.code === 'ALREADY' ? '이미 샀어요' : '받을 수 없어요'); return; }
      if (id === 'sub30') M.claimSub(S(), now(), ctx.day());
      ctx.persist(); ctx.render();
      try { ctx.UI.sfx.none(); } catch (e2) { /* 무시 */ }
      toast(p.name + (Pay.test ? ' (시험 구매)' : '') + ' — 받았어요!');
      if (id === 'pass') { try { root.document.body.classList.add('prem-on'); } catch (e3) { /* 무시 */ } }
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
    var lb = label || priceLabel(id);
    return '<button class="primary shop-buy" data-buy="' + id + '"' + (Pay.available() ? '' : ' aria-disabled="true"') + '><span class="sb-l">' + lb + '</span>' + (Pay.gems ? '' : Pay.available() && Pay.test ? '<small>시험 구매</small>' : !Pay.available() ? '<small>출시 때 열려요</small>' : '') + '</button>';
  }
  function limFx() {
    var P = root.Team3Pets; if (!P) return '';
    var eq = P.describe(P.eqEffect('wolf', 'l', P.STAR_MAX)), own = P.describe(P.ownEffect('wolf', 'l', P.STAR_MAX));
    return '<div class="lim-fx">' + eq.map(function (t) { return '<div><span>장착</span><b>' + esc(t) + '</b></div>'; }).join('') + own.map(function (t) { return '<div><span>보유</span><b>' + esc(t) + '</b></div>'; }).join('') + '</div>';
  }
  function hoursLeft(ms) { var h = Math.floor(ms / 3600e3), m = Math.floor(ms % 3600e3 / 60e3); return h + '시간 ' + m + '분'; }

  function drawShop() {
    var s = S(), day = ctx.day(), t = now(), html = '';
    // 무료(광고)
    // 0.9.0 한정 파트너(정식 출시 전까지 계속)
    if (M.limitedOpen(s, 'wolf', ctx.day())) {
      var limLeft = M.limitedLeft('wolf', ctx.day());
      var pic = root.Team3NoirPics && root.Team3NoirPics.wolf;
      html += '<div class="lim-card"><span class="lim-rib">한정 파트너</span><span class="lim-time' + (limLeft <= 3 ? ' soon' : '') + '">' + (limLeft === Infinity ? '정식 출시 전까지' : limLeft === 1 ? '오늘까지' : limLeft + '일 남음') + '</span>' +
        (pic ? '<div class="lim-pic"><img src="' + pic + '" alt="한정 파트너 늑대"></div>' : '') +
        '<div class="lim-body"><div class="lim-nm">수사3팀 · 늑대 · 한정<b>백랑 · 코드네임 고스트</b></div>' +
        '<div class="lim-tags"><span>전설 등급</span><span>★5로 시작</span><span>코드네임 바로 열림</span><span>뽑기에 안 나와요</span></div>' +
        limFx() +
        payBtn('wolf', '데려오기 ' + priceLabel('wolf')) + '<small class="lim-note">한 사람당 한 번</small></div></div>';
    } else if (s.shop.bought.wolf) html += '<div class="lim-done">🐺 백랑이 3팀에 있어요 · 파트너 탭에서 장착해요</div>';
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
      (on ? '<em>' + (s.shop.subDay === day ? '오늘 ◆' + M.SUB.dailyGems + ' 받았어요' : '오늘 보상은 사무실에 오면 들어와요') + '</em>' : '') + '</div>' + payBtn('sub30', on ? '연장 ' + priceLabel('sub30') : null) + '</div>';
    var af = M.BY_ID.adfree;
    if (!s.shop.adFree) html += '<div class="shop-row"><div class="shop-tx"><b>' + af.name + '</b><small>' + esc(af.desc) + '</small></div>' + payBtn('adfree') + '</div>';
    // 배지
    if (!Pay.gems) html += '<span class="label">배지</span><div class="shop-gems">' + M.PRODUCTS.filter(function (p) { return p.kind === 'gems'; }).map(function (p) {
      return '<div class="shop-gem"><b>' + esc(p.desc) + '</b><small>' + esc(p.name) + '</small>' + payBtn(p.id) + '</div>';
    }).join('') + '</div>';   // 배지 묶음은 실제 결제 상품이라 배지로 사기 단계(정식 출시 전)에는 숨긴다
    html += '<p class="muted" style="font-size:11.5px;line-height:1.5">배지로는 동물 뽑기 · 의상 · 칭호 · 이름 바꾸기 · 출동 준비물을 살 수 있어요. 퍼즐 실력은 팔지 않아요.' +
      (Pay.gems ? ' 정식 출시 전까지는 모든 상품을 배지로 살 수 있어요.' : Pay.available() && Pay.test ? ' 지금은 시험 구매라 실제 돈이 나가지 않아요.' : '') + '</p>';
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
  /* 0.8.3 시즌 패스: 위 메달 띠(단계 큰 숫자 · 남은 날 · 진척 막대) → 받기/프리미엄 → 단계 줄마다 무료 · 프리미엄 보상 칸.
     칸 상태: 잠김(흐림) · 받을 수 있음(금빛 테두리 + 반짝) · 받음(✓ 도장) · 프리미엄 미구매(자물쇠). 지금 단계 줄엔 '지금' 표시 */
  var LOCK = '<svg viewBox="0 0 24 24" width="14" height="14" aria-label="잠김"><rect x="5" y="10.5" width="14" height="10" rx="2" fill="#FFD23F"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="#FFD23F" stroke-width="2.2" fill="none"/></svg>';
  function passCell(track, t, open, got, locked) {
    var r = M.reward(track, t), parts = [];
    if (r.pick) parts.push([ic('pick'), '전설 선택권']);
    if (r.tickets) parts.push([ic('ticket'), '×' + r.tickets]);
    if (r.gems) parts.push([ic('gem'), '×' + r.gems]);
    if (r.treats) parts.push([ic('treat'), '×' + r.treats]);
    var head = parts[0] || ['', ''], rest = parts.slice(1).map(function (x) { return x[0] + x[1]; }).join(' ');
    var st = got ? ' got' : !open ? ' wait' : locked ? ' lock' : ' ready';
    return '<span class="pc ' + track + st + (r.pick ? ' pick' : '') + '" data-t="' + t + '"><i class="pc-ic">' + head[0] + '</i><span class="pc-tx"><b>' + head[1] + '</b>' + (rest ? '<small>' + rest + '</small>' : '') + '</span>' +
      (got ? '<em class="pc-stamp">✓</em>' : locked ? '<em class="pc-lock">' + LOCK + '</em>' : '') + '</span>';
  }
  /* 0.8.3 받기 · 프리미엄 줄(다시 그림): 덩그러니 큰 단추 두 개 대신
     받기 — 받을 게 있으면 금빛 큰 단추, 없으면 "다음 보상" 미리보기 띠(무엇을 · 몇 XP 뒤에)
     프리미엄 — 한 줄 전체를 쓰는 광고 카드(왕관 · 무엇이 더 생기는지 · 값 알약). 샀으면 얇은 "열림" 띠 */
  var CROWN = '<svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><path d="M5 24l-2-13 7.5 6L16 6l5.5 11L29 11l-2 13z" fill="#FFD23F" stroke="#A87A10" stroke-width="1.6" stroke-linejoin="round"/><rect x="5" y="24" width="22" height="3.5" rx="1.5" fill="#E0A81C" stroke="#A87A10" stroke-width="1.2"/><circle cx="16" cy="16" r="2.2" fill="#E8473A"/><circle cx="9.5" cy="19" r="1.4" fill="#7FD3FF"/><circle cx="22.5" cy="19" r="1.4" fill="#7FD3FF"/></svg>';
  function passActs(ps, tier, into, can) {
    var h;
    if (can) h = '<button class="pass-claim glow" id="pass-claim"><span class="pcl-n">' + can + '</span>받을 보상 모두 받기</button>';
    else if (tier >= M.TIERS) h = '<button class="pass-next" id="pass-claim" disabled><span>모든 보상을 받았어요</span></button>';
    else {
      var nt = tier + 1, r = M.reward('free', nt), it = r.pick ? ic('pick') : r.tickets ? ic('ticket') + '×' + r.tickets : r.gems ? ic('gem') + '×' + r.gems : ic('treat') + '×' + r.treats;
      h = '<button class="pass-next" id="pass-claim" disabled><small>다음 보상 · ' + nt + '단계</small><span class="pn-it">' + it + '</span><em>' + (M.TIER_XP - into) + 'XP 남음</em></button>';
    }
    if (ps.premium) return h + '<div class="pass-premon">' + CROWN + '<span><b>프리미엄 열림</b><small>단계마다 보상을 하나 더 받아요</small></span></div>';
    var p = M.BY_ID.pass, live = Pay.available(), se = M.seasonOf(S(), ctx.day()), miss = M.missedPrem(S(), ctx.day()), mk = Object.keys(miss);
    // 연출 1: 지금 사면 바로 받는 프리미엄 보상(이미 지나온 단계 몫)
    var missH = mk.length ? '<div class="pass-miss">지금 사면 바로 받아요 · ' + mk.map(function (k) { return k === 'pick' ? ic('pick') + '<b>전설 선택권</b>' : ic(k === 'tickets' ? 'ticket' : k === 'gems' ? 'gem' : 'treat') + '<b>×' + miss[k] + '</b>'; }).join(' ') + '</div>' : '';
    return h + missH + '<button class="pass-premcard' + (se.left <= 3 ? ' soon' : '') + '" data-buy="pass"' + (live ? '' : ' aria-disabled="true"') + '>' +
      '<i class="ppc-crown">' + CROWN + '</i>' +
      '<span class="ppc-tx"><b>프리미엄 패스</b><small>단계마다 보상 하나 더</small><small>30단계 ' + ic('pick') + ' 전설 선택권</small></span>' +
      '<span class="ppc-price"><b>' + priceLabel('pass') + '</b><small>' + (Pay.gems ? '배지로 사기' : live ? (Pay.test ? '시험 구매' : '사기') : '출시 때 열려요') + '</small></span></button>';
  }
  /* 프리미엄 효과 목록 — 산 사람은 켜짐, 안 산 사람은 자물쇠로 보여 준다 */
  /** 남은 날 글자: 정식 출시 전에는 시즌이 끝나지 않는다(무한) */
  function leftTxt(n) { return n === Infinity ? '정식 출시 전까지' : n + '일 남음'; }
  function premFx(on, left) {
    var P = M.PREM, rows = [['출동 수사비', '+' + P.pay + '%'], ['팀 수사비', '+' + P.idle + '%'], ['패스 경험치', '+' + P.xp + '%'], ['특별 출동', '하루 한 번 무료 재도전'], ['파트너 간식', '매일 +' + P.treats], ['꾸미기', '금빛 검거 도장 · 왕관 팀 이름']];
    return '<div class="pass-fx' + (on ? '' : ' off') + '"><b>👑 프리미엄 효과 · ' + (on ? '켜짐 · ' + leftTxt(left) : left === Infinity ? '사면 정식 출시 전까지 켜져요' : '사면 이번 시즌 동안 켜져요') + '</b>' + rows.map(function (r) { return '<div><span>' + r[0] + '</span><em>' + (on ? '' : '🔒 ') + r[1] + '</em></div>'; }).join('') + '</div>';
  }
  /* 연출 3: 30단계 전설 선택권 — 고를 수 있는 전설 코드네임 미리보기 */
  function pickPreview() {
    var P = root.Team3Pets, N = root.Team3NoirArt; if (!P) return;
    var body = '<p style="margin:0 0 8px;font-size:13px;color:#C9CFDA">30단계 프리미엄 보상으로 아래 전설 중 하나를 데려올 수 있어요. 전설은 코드네임 모습이 바로 열려요.</p><div class="pick-prev">' +
      P.SPECIES.map(function (sp) { return '<div>' + (N ? N.draw(sp.id, { grade: 'l', size: 120 }) : '') + '<b>' + esc(P.codename(sp.id)) + '</b>' + esc(sp.name) + '</div>'; }).join('') + '</div>';
    if (ctx.openInfo) ctx.openInfo({ label: '시즌 패스 · 30단계', title: '전설 선택권 미리보기', body: body });
  }
  function drawPass() {
    var s = S(), day = ctx.day(), ps = M.passOf(s, day), se = M.seasonOf(s, day), tier = M.tierOf(ps.xp), can = M.claimable(s, day).length;
    var into = ps.xp - tier * M.TIER_XP, pct = tier >= M.TIERS ? 100 : Math.round(into / M.TIER_XP * 100);
    var html = '<div class="pass-hero' + (ps.premium ? ' prem' : '') + '">' +
      '<div class="ph-medal"><small>단계</small><b>' + tier + '</b><i>/ ' + M.TIERS + '</i></div>' +
      '<div class="ph-main"><span class="ph-season">시즌 ' + se.no + (ps.premium ? ' · <em>프리미엄</em>' : '') + '</span>' +
      '<span class="ph-left' + (se.left <= 3 ? ' soon' : '') + '">' + leftTxt(se.left) + (se.left <= 3 ? ' · 곧 끝나요' : '') + '</span>' +
      '<div class="ph-bar"><i style="width:' + pct + '%"></i><span>' + (tier >= M.TIERS ? '완료' : into + ' / ' + M.TIER_XP + ' XP') + '</span></div></div></div>' +
      '<p class="ph-how">' + (tier >= M.TIERS ? '모든 단계를 열었어요!' : '출동마다 10~40XP · 특별 출동 메달 +30XP') + '</p>' +
      passActs(ps, tier, into, can) + premFx(ps.premium, se.left) +
      '<div class="pass-grid"><span class="pass-h"></span><span class="pass-h">무료</span><span class="pass-h prem">★ 프리미엄</span>';
    for (var t = 1; t <= M.TIERS; t++) {
      var open = t <= tier, now = t === tier + 1 || (tier >= M.TIERS && t === M.TIERS);
      html += '<span class="pass-t' + (open ? ' open' : '') + (now ? ' now' : '') + '">' + (now && tier < M.TIERS ? '<small>다음</small>' : '') + t + '</span>' +
        passCell('free', t, open, ps.free[t], false) + passCell('prem', t, open, ps.prem[t], !ps.premium);
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
      var pk = e.target.closest('#pass-body .pc.prem.pick');   // 30단계 전설 칸 → 미리보기
      if (pk) { pickPreview(); return; }
      var t = e.target.closest('button');
      if (!t) return;
      if (t.getAttribute('data-tab')) { tab = t.getAttribute('data-tab'); draw(); }
      else if (t.getAttribute('data-buy')) buy(t.getAttribute('data-buy'));
      else if (t.getAttribute('data-ad') === 'ticket') watch('ticket', function () { ctx.grant('tickets', 1); toast('뽑기권 1장을 받았어요'); });
      else if (t.getAttribute('data-ad') === 'party') watch('party', function () { ctx.freeParty(); toast('팀 회식! 30분 동안 팀이 2배로 일해요'); });
      else if (t.id === 'pass-claim') {
        var prem = M.passOf(S(), ctx.day()).premium;
        var got = M.claimPass(S(), ctx.day(), ctx.grant);
        ctx.persist(); ctx.render();
        if (got.length) { try { ctx.UI.sfx.coin(); } catch (e2) { /* 무시 */ } toast('보상 ' + got.length + '개를 받았어요'); }
        draw();
        // 연출 2: 프리미엄이 아니면 방금 받은 단계의 프리미엄 칸이 흔들린다
        if (!prem && got.length) {
          var ts = got.map(function (g) { return g.t; });
          document.querySelectorAll('#pass-body .pc.prem').forEach(function (c) { if (ts.indexOf(+c.getAttribute('data-t')) >= 0) { c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); } });
          setTimeout(function () { toast('👑 프리미엄이면 이 칸도 받을 수 있었어요'); }, 1300);
        }
      }
    });
    var chip = $('h-gems');
    if (chip) chip.addEventListener('click', function () { open('shop'); });
  }

  root.Team3ShopUI = { mount: mount, open: open, close: close, isOpen: isOpen, watch: watch, isTest: function () { return !!Ads.test; } };
})(typeof self !== 'undefined' ? self : this);
