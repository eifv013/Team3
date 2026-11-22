/*
 * Team3Monet(0.4.0) — 상점 · 광고 자리 · 월정액 · 시즌 패스의 "규칙"만. 실제 결제 · 광고는 모른다.
 *
 * 원칙
 *   돈으로 시간 · 편의 · 꾸미기 · 수집을 산다. 퍼즐 실력은 팔지 않는다.
 *   진짜 결제(구글 플레이) · 광고(애드몹)는 출시 직전에 화면 쪽 공급자(Team3Pay · Team3Ads)에 꽂는다.
 *   여기는 "샀다/봤다"가 확인된 뒤 무엇을 주는지, 하루 한도가 얼마인지만 계산한다(node 시험).
 *
 * 저장 save.shop
 *   since   처음 본 시각(ms) — 새내기 꾸러미가 보이는 72시간을 센다
 *   bought  { 상품id: 산 횟수 }
 *   subUntil 월정액 끝나는 시각(ms) · subDay 월정액 하루 보상을 받은 날
 *   adFree  광고 없이 받기를 샀는가
 *   ads     { day, n:{ 자리: 횟수 } } 오늘 광고 보상 받은 횟수
 *   pass    { season, xp, free:{단계:true}, prem:{단계:true}, premium:bool }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Team3Monet = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function MonetError(code, message) { var e = new Error(message); e.name = 'MonetError'; e.code = code; return e; }
  var H = 3600 * 1000, D = 24 * H;

  /*
   * 상품(값은 원화 자리표시 — 실제 가격은 구글 플레이 콘솔에서 정한다).
   *   gives: { gems, tickets, treats, outfit, pick:{ l:1 } } — 사는 순간 한 번
   */
  var PRODUCTS = [
    { id: 'starter', kind: 'pack', name: '새내기 지원 꾸러미', krw: 1200, once: true, hours: 72,
      desc: '처음 3일만 · 뽑기권 10장 · 배지 ◆100 · 선글라스', gives: { tickets: 10, gems: 100, outfit: 'sunglasses' } },
    { id: 'sub30', kind: 'sub', name: '3팀 월정액', krw: 4900, days: 30,
      desc: '바로 ◆100 · 30일 동안 매일 ◆20 · 매일 무료 뽑기 +1 · 자리 비움 한도 +2시간', gives: { gems: 100 } },
    { id: 'adfree', kind: 'perm', name: '광고 없이 받기', krw: 6900, once: true,
      desc: '광고 보상을 광고 없이 바로 받아요 · 광고 보상 하루 한도 +1', gives: {} },
    { id: 'gems60', kind: 'gems', name: '배지 한 줌', krw: 1200, desc: '◆60', gives: { gems: 60 } },
    { id: 'gems330', kind: 'gems', name: '배지 주머니', krw: 5900, desc: '◆330 (10% 더)', gives: { gems: 330 } },
    { id: 'gems700', kind: 'gems', name: '배지 상자', krw: 11000, desc: '◆700 (17% 더)', gives: { gems: 700 } },
    { id: 'gems1500', kind: 'gems', name: '배지 금고', krw: 22000, desc: '◆1,500 (25% 더)', gives: { gems: 1500 } },
    { id: 'pass', kind: 'pass', name: '시즌 패스 프리미엄', krw: 9900, desc: '이번 시즌 프리미엄 보상 줄 열기(이미 지난 단계도 받아요)', gives: {} }
  ];
  var BY_ID = {};
  PRODUCTS.forEach(function (p) { BY_ID[p.id] = p; });
  var SUB = { dailyGems: 20, freePulls: 1, capMin: 120 };

  // 광고 자리: 하루 한도(광고 없이 받기를 사면 +1). 무엇을 주는지는 화면 쪽이 정한다(뽑기권 · 2배 · 회식)
  var ADS = {
    ticket: { name: '뽑기권 1장', daily: 3 },
    double: { name: '출동 수사비 2배', daily: 3 },
    party: { name: '팀 회식 무료', daily: 2 }
  };

  function int(v, def, min, max) {
    if (typeof v !== 'number' || !isFinite(v)) return def;
    v = Math.floor(v);
    return v < min ? min : v > max ? max : v;
  }
  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
  /** 저장 검사. now 는 처음 본 시각을 채울 때만 쓴다 */
  function clean(save, now) {
    var d = save.shop && typeof save.shop === 'object' ? save.shop : {}, s = {};
    s.since = int(d.since, now || 0, 0, 9e15);
    s.bought = {};
    var b = d.bought && typeof d.bought === 'object' ? d.bought : {};
    Object.keys(b).forEach(function (k) { if (BY_ID[k]) s.bought[k] = int(b[k], 0, 0, 1e6); });
    s.subUntil = int(d.subUntil, 0, 0, 9e15);
    s.subDay = typeof d.subDay === 'string' && DAY_RE.test(d.subDay) ? d.subDay : '';
    s.adFree = d.adFree === true;
    var a = d.ads && typeof d.ads === 'object' ? d.ads : {};
    s.ads = { day: typeof a.day === 'string' && DAY_RE.test(a.day) ? a.day : '', n: {} };
    var an = a.n && typeof a.n === 'object' ? a.n : {};
    Object.keys(an).forEach(function (k) { if (ADS[k]) s.ads.n[k] = int(an[k], 0, 0, 99); });
    var ps = d.pass && typeof d.pass === 'object' ? d.pass : {};
    s.pass = { season: int(ps.season, -1, -1, 1e6), xp: int(ps.xp, 0, 0, 1e7), free: {}, prem: {}, premium: ps.premium === true };
    ['free', 'prem'].forEach(function (t) {
      var o = ps[t] && typeof ps[t] === 'object' ? ps[t] : {};
      Object.keys(o).forEach(function (k) { if (o[k] === true && /^\d{1,2}$/.test(k)) s.pass[t][k] = true; });
    });
    save.shop = s;
    return s;
  }
  function S(save) { return save.shop && save.shop.bought ? save.shop : clean(save, 0); }

  /* ---------- 상품 ---------- */
  /** 지금 살 수 있게 보여 줄까(새내기 꾸러미 72시간 · 한 번만) */
  function visible(save, id, now) {
    var p = BY_ID[id], s = S(save);
    if (!p) return false;
    if (p.once && s.bought[id]) return false;
    if (p.hours && now - s.since > p.hours * H) return false;
    return true;
  }
  /** 새내기 꾸러미 남은 시간(ms, 없으면 0) */
  function starterLeft(save, now) { return visible(save, 'starter', now) ? Math.max(0, S(save).since + 72 * H - now) : 0; }

  /**
   * 결제가 확인된 뒤 호출: 상품을 준다. grant(kind, 값) 콜백으로 뽑기권 · 간식 · 의상처럼 다른 모듈 것을 넘긴다.
   * 반환: { id, gave:{…} }
   */
  function applyPurchase(save, id, now, grant) {
    var p = BY_ID[id], s = S(save);
    if (!p) throw MonetError('BAD_PRODUCT', '모르는 상품');
    if (p.once && s.bought[id]) throw MonetError('ALREADY', '이미 샀다');
    s.bought[id] = (s.bought[id] || 0) + 1;
    var g = p.gives || {};
    if (g.gems) save.gems = (save.gems || 0) + g.gems;
    if (typeof grant === 'function') {
      if (g.tickets) grant('tickets', g.tickets);
      if (g.treats) grant('treats', g.treats);
      if (g.outfit) grant('outfit', g.outfit);
    }
    if (p.kind === 'sub') s.subUntil = Math.max(s.subUntil, now) + p.days * D;   // 남은 기간에 이어 붙인다
    if (id === 'adfree') s.adFree = true;
    if (id === 'pass') s.pass.premium = true;
    return { id: id, gave: g };
  }

  /* ---------- 월정액 ---------- */
  function subActive(save, now) { return S(save).subUntil > now; }
  function subDaysLeft(save, now) { return subActive(save, now) ? Math.ceil((S(save).subUntil - now) / D) : 0; }
  /** 월정액 하루 보상(배지). 오늘 이미 받았거나 월정액이 아니면 0 */
  function claimSub(save, now, day) {
    var s = S(save);
    if (!subActive(save, now) || s.subDay === day) return 0;
    s.subDay = day;
    save.gems = (save.gems || 0) + SUB.dailyGems;
    return SUB.dailyGems;
  }
  /** 월정액 혜택(다른 모듈에 넘길 값): 무료 뽑기 추가, 자리 비움 한도 +분 */
  function perks(save, now) {
    var on = subActive(save, now);
    return { freePulls: on ? SUB.freePulls : 0, capMin: on ? SUB.capMin : 0, adFree: S(save).adFree };
  }

  /* ---------- 광고 자리 ---------- */
  function adLimit(save, place) { return ADS[place] ? ADS[place].daily + (S(save).adFree ? 1 : 0) : 0; }
  function adLeft(save, place, day) {
    var s = S(save), used = s.ads.day === day ? (s.ads.n[place] || 0) : 0;
    return Math.max(0, adLimit(save, place) - used);
  }
  /** 광고를 끝까지 봤다(또는 광고 없이 받기) — 한 번 쓴 것으로 센다. 남은 게 없으면 오류 */
  function adUse(save, place, day) {
    if (!ADS[place]) throw MonetError('BAD_PLACE', '모르는 광고 자리');
    if (adLeft(save, place, day) < 1) throw MonetError('NO_LEFT', '오늘 다 썼다');
    var s = S(save);
    if (s.ads.day !== day) s.ads = { day: day, n: {} };
    s.ads.n[place] = (s.ads.n[place] || 0) + 1;
    return adLeft(save, place, day);
  }

  /* ---------- 시즌 패스 ---------- */
  /*
   * 28일 한 시즌. 출동 · 특별 출동으로 경험치(XP)를 모아 TIER_XP 마다 한 단계, 모두 TIERS 단계.
   *   무료 줄은 누구나, 프리미엄 줄은 패스를 산 사람(산 뒤 지난 단계도 받는다).
   *   마지막 프리미엄 단계: 전설 선택권(전설 동물 하나를 골라 데려오기).
   */
  var SEASON_DAYS = 28, TIERS = 30, TIER_XP = 100, EPOCH = Date.UTC(2026, 0, 5);
  function dayNum(day) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day || ''); return m ? Math.floor((Date.UTC(+m[1], +m[2] - 1, +m[3]) - EPOCH) / D) : 0; }
  function season(day) { var n = dayNum(day), s = Math.floor(n / SEASON_DAYS); return { no: s + 1, idx: s, left: (s + 1) * SEASON_DAYS - n }; }
  function reward(track, t) {
    // t: 1..TIERS
    if (track === 'free') return t % 5 === 0 ? { tickets: 2 } : t % 2 === 0 ? { treats: 10 } : { gems: 5 };
    if (t === TIERS) return { pick: 'l', tickets: 5 };
    return t % 10 === 0 ? { tickets: 5, gems: 30 } : t % 5 === 0 ? { tickets: 3 } : t % 2 === 0 ? { gems: 15 } : { tickets: 1, treats: 10 };
  }
  function passOf(save, day) {
    var s = S(save), se = season(day);
    if (s.pass.season !== se.idx) s.pass = { season: se.idx, xp: 0, free: {}, prem: {}, premium: false };   // 새 시즌: 처음부터(프리미엄도 시즌마다)
    return s.pass;
  }
  function tierOf(xp) { return Math.min(TIERS, Math.floor(xp / TIER_XP)); }
  /** 출동 한 번의 경험치: 10 + 점수/500(최대 30 더). 특별 출동 메달은 +30 */
  function runXp(score, medal) { return 10 + Math.min(30, Math.floor((score || 0) / 500)) + (medal ? 30 : 0); }
  function addXp(save, day, xp) {
    var ps = passOf(save, day), before = tierOf(ps.xp);
    ps.xp = Math.min(TIERS * TIER_XP, ps.xp + Math.max(0, Math.floor(xp)));
    return { tier: tierOf(ps.xp), up: tierOf(ps.xp) - before };
  }
  /** 받을 수 있는 보상 목록 [{ track, t, r }] */
  function claimable(save, day) {
    var ps = passOf(save, day), tier = tierOf(ps.xp), out = [];
    for (var t = 1; t <= tier; t++) {
      if (!ps.free[t]) out.push({ track: 'free', t: t, r: reward('free', t) });
      if (ps.premium && !ps.prem[t]) out.push({ track: 'prem', t: t, r: reward('prem', t) });
    }
    return out;
  }
  /** 받을 수 있는 것 모두 받기. grant(kind, 값)으로 뽑기권 · 간식 · 전설 선택권을 넘긴다. 반환: 받은 목록 */
  function claimPass(save, day, grant) {
    var ps = passOf(save, day), got = claimable(save, day);
    got.forEach(function (x) {
      (x.track === 'free' ? ps.free : ps.prem)[x.t] = true;
      if (x.r.gems) save.gems = (save.gems || 0) + x.r.gems;
      if (typeof grant === 'function') Object.keys(x.r).forEach(function (k) { if (k !== 'gems') grant(k, x.r[k]); });
    });
    return got;
  }

  return {
    PRODUCTS: PRODUCTS, BY_ID: BY_ID, SUB: SUB, ADS: ADS, SEASON_DAYS: SEASON_DAYS, TIERS: TIERS, TIER_XP: TIER_XP,
    clean: clean, visible: visible, starterLeft: starterLeft, applyPurchase: applyPurchase,
    subActive: subActive, subDaysLeft: subDaysLeft, claimSub: claimSub, perks: perks,
    adLimit: adLimit, adLeft: adLeft, adUse: adUse,
    season: season, reward: reward, passOf: passOf, tierOf: tierOf, runXp: runXp, addXp: addXp, claimable: claimable, claimPass: claimPass
  };
});
