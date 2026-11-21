/*
 * Team3Economy(0.1.19) — 수사비를 계속 쓰게 하는 소모품, 출동 메달, 하루 한 번 특별 출동, 배지(유료 재화).
 *
 * 구조
 *   SuspectsIdle(방치 층)의 저장(save)을 그대로 받아 바꾼다. 팀 속도·계급 배수 같은 계산은 idle 에 맡긴다.
 *   DOM·시계·저장소를 모른다(now 와 날짜 키는 밖에서 받는다) → node 시험에서 그대로 돈다.
 *
 * 상품(ITEMS)
 *   prep  : 다음 출동 한 번에 챙겨 가는 준비물. 종류마다 한 개씩, 출동을 시작하면 다 쓴다. 출동 전이면 무르기(전액 환불) 가능.
 *   boost : 바로 효과가 나는 지원(팀 회식 · 야간 잠복조).
 *   price : 어떤 돈으로 살 수 있는지와 값. 지금은 money(수사비)와 gems(배지).
 *           나중에 광고(ad)·결제(iap)를 붙일 때도 이 표에 "살 수 있는 방법"만 더하면 된다(게임 구조는 그대로).
 *
 * 값의 기준(baseValue)
 *   출동 한 판이 팀 수백 분치를 벌기 때문에, "팀 N분치"만으로 값을 매기면 너무 싸진다.
 *   기준값 = max(최근 출동 5번 평균 점수, 팀 10분 수입, 최소 300). 실력과 팀이 클수록 값도 커진다.
 *
 * 원칙: 돈(수사비·배지)으로는 시간과 편의를 산다. 퍼즐 실력(메달·특별 출동 기록)은 살 수 없다.
 *   그래서 준비물은 특별 출동에 가져갈 수 없고, 메달은 평소 출동에서만 센다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./idle.js'));
  else root.Team3Economy = factory(root.SuspectsIdle);
})(typeof self !== 'undefined' ? self : this, function (I) {
  'use strict';

  function EcoError(code, message) { var e = new Error(message); e.name = 'EcoError'; e.code = code; return e; }

  /* ---------- 상품 ---------- */
  // money: 기준값 × base 와 팀 teamMin 분치 중 큰 값. gems: 배지 값(정수)
  var ITEMS = [
    { id: 'coffee', kind: 'prep', name: '커피 한 잔', desc: '출동 시간 +15초', price: { base: 0.3, gems: 2 } },
    { id: 'tip', kind: 'prep', name: '제보 전화', desc: '출동을 시작할 때 한 패 하나를 미리 표시', price: { base: 0.5, gems: 3 } },
    { id: 'sketch', kind: 'prep', name: '몽타주 전문가', desc: '무료 단서 +2번', price: { base: 0.5, gems: 3 } },
    { id: 'lawyer', kind: 'prep', name: '변호사 대기', desc: '오인 체포 벌점 2번 면제', price: { base: 0.6, gems: 4 } },
    { id: 'press', kind: 'prep', name: '언론 브리핑', desc: '이번 출동 수사비 1.5배', price: { base: 1.0, gems: 6 } },
    { id: 'party', kind: 'boost', name: '팀 회식', desc: '30분 동안 팀이 2배로 일해요', price: { base: 0.4, teamMin: 20, gems: 8 } },
    { id: 'night', kind: 'boost', name: '야간 잠복조', desc: '다음에 자리를 비울 때 한도 4시간 → 8시간', price: { base: 0.5, teamMin: 30, gems: 6 } }
  ];
  var BY_ID = {};
  ITEMS.forEach(function (it) { BY_ID[it.id] = it; });
  var PREP_IDS = ITEMS.filter(function (it) { return it.kind === 'prep'; }).map(function (it) { return it.id; });

  var MIN_BASE = 300;
  // 0.3.0 동물 효과 한 갈래(없으면 0)
  function bn(save, k) { var v = +((I.bonusOf ? I.bonusOf(save) : {})[k]); return isFinite(v) && v > 0 ? v : 0; }

  function baseValue(save) {
    var r = save.recent || [], avg = 0;
    if (r.length) avg = r.reduce(function (a, b) { return a + b; }, 0) / r.length;
    var team10 = I.teamRate(save) * 600 * I.payPerCatch(save);
    return Math.max(MIN_BASE, Math.round(avg), Math.round(team10));
  }

  // 사람이 읽기 좋은 값으로: 앞 두 자리만 남기고 내린다(1,234 → 1,200 · 56,789 → 56,000)
  function roundNice(n) {
    n = Math.max(1, Math.round(n));
    var p = Math.pow(10, Math.max(0, String(n).length - 2));
    return Math.floor(n / p) * p;
  }

  /** 상품 값. currency = 'money' | 'gems'. 그 돈으로 살 수 없으면 null */
  function price(save, id, currency) {
    var it = BY_ID[id];
    if (!it) throw EcoError('BAD_ITEM', '모르는 상품: ' + id);
    currency = currency || 'money';
    if (currency === 'gems') return typeof it.price.gems === 'number' ? it.price.gems : null;
    if (currency !== 'money') return null;   // 'ad' · 'iap' 는 아직 없다
    var v = baseValue(save) * (it.price.base || 0);
    if (it.price.teamMin) v = Math.max(v, I.teamRate(save) * 60 * it.price.teamMin * I.payPerCatch(save));
    // 0.3.0 샴 등: 준비물 값 할인(수사비만, 최대 50%)
    if (it.kind === 'prep') v *= 1 - Math.min(0.5, bn(save, 'prep') / 100);
    return roundNice(v);
  }

  function owned(save, id, now) {
    var it = BY_ID[id];
    if (!it) return false;
    if (it.kind === 'prep') return !!(save.prep && save.prep[id]);
    if (id === 'party') return (save.partyUntil || 0) > now;
    if (id === 'night') return !!save.nightWatch;
    return false;
  }

  /**
   * 사기. 반환 { id, currency, paid }.
   *   준비물·야간 잠복조는 이미 있으면 ALREADY. 팀 회식은 진행 중이면 30분을 처음부터 다시(남은 시간에 더하지 않는다).
   */
  function buy(save, id, now, currency) {
    if (typeof now !== 'number' || !isFinite(now)) throw EcoError('BAD_TIME', 'now 는 밀리초');
    var it = BY_ID[id];
    if (!it) throw EcoError('BAD_ITEM', '모르는 상품: ' + id);
    currency = currency || 'money';
    var c = price(save, id, currency);
    if (c == null) throw EcoError('NO_CURRENCY', '그 돈으로는 살 수 없다: ' + currency);
    if (it.kind === 'prep' || id === 'night') { if (owned(save, id, now)) throw EcoError('ALREADY', '이미 있다: ' + id); }
    var wallet = currency === 'gems' ? 'gems' : 'money';
    if (save[wallet] < c) throw EcoError('NOT_ENOUGH', currency === 'gems' ? '배지가 모자란다' : '수사비가 모자란다');
    save[wallet] -= c;
    if (it.kind === 'prep') { save.prep[id] = true; savePaid(save, id, wallet, c); }
    else if (id === 'party') save.partyUntil = now + I.TUNE.partySec * (1 + bn(save, 'party') / 100) * 1000;   // 0.3.0 토끼: 회식 시간 +%
    else if (id === 'night') save.nightWatch = true;
    return { id: id, currency: wallet, paid: c };
  }
  // 준비물은 출동 전이면 무를 수 있어야 해서, 낸 값을 따로 적어 둔다(저장 형식은 prep: {id:true} 그대로 두고 옆에 둔다)
  function savePaid(save, id, wallet, c) {
    if (!save.prepPaid || typeof save.prepPaid !== 'object') save.prepPaid = {};
    save.prepPaid[id] = { w: wallet, c: c };
  }
  /** 준비물 무르기(출동 전). 낸 값을 그대로 돌려준다. 반환 { refunded, currency } */
  function unprep(save, id) {
    if (!save.prep || !save.prep[id]) throw EcoError('NOT_OWNED', '챙긴 준비물이 아니다: ' + id);
    var p = save.prepPaid && save.prepPaid[id];
    delete save.prep[id];
    if (save.prepPaid) delete save.prepPaid[id];
    if (p && (p.w === 'money' || p.w === 'gems') && typeof p.c === 'number' && p.c > 0) { save[p.w] += p.c; return { refunded: p.c, currency: p.w }; }
    return { refunded: 0, currency: 'money' };
  }

  /**
   * 출동을 시작할 때 챙긴 준비물을 쓰고, 판에 줄 설정을 돌려준다.
   *   base: I.runOptions(save) 결과에 더해 { duration, freeHints, mods:{shield}, tip, payMult, used:[id] }
   */
  function consumePrep(save, base) {
    var o = {};
    Object.keys(base || {}).forEach(function (k) { o[k] = base[k]; });
    o.mods = o.mods || {};
    o.used = [];
    o.payMult = 1;
    PREP_IDS.forEach(function (id) {
      if (!save.prep || !save.prep[id]) return;
      o.used.push(id);
      if (id === 'coffee') o.duration = (o.duration || 90) + 15;
      else if (id === 'tip') o.tip = true;
      else if (id === 'sketch') o.freeHints = (o.freeHints || 0) + 2;
      else if (id === 'lawyer') o.mods.shield = 2;
      else if (id === 'press') o.payMult = 1.5;
    });
    save.prep = {};
    save.prepPaid = {};
    return o;
  }

  /* ---------- 메달(평소 출동 점수) ---------- */
  var MEDALS = [
    { key: 'b', name: '동', at: 3000, base: 1, gems: 5 },
    { key: 's', name: '은', at: 6000, base: 2, gems: 10 },
    { key: 'g', name: '금', at: 12000, base: 4, gems: 20 }
  ];
  function medalFor(score, table) {
    var got = null;
    (table || MEDALS).forEach(function (m) { if (score >= m.at) got = m; });
    return got;
  }
  /**
   * 평소 출동 점수로 처음 단 메달을 지급한다. 보상 기준값은 이 판을 넣기 전 값(출동 전 save.recent 기준)으로 잰다.
   * 반환: [{ name, money, gems }]
   */
  function claimMedals(save, score, baseBefore) {
    var out = [];
    MEDALS.forEach(function (m) {
      if (score >= m.at && !save.medals[m.key]) {
        save.medals[m.key] = true;
        var money = roundNice(baseBefore * m.base);
        save.money += money; save.gems += m.gems;
        out.push({ name: m.name, money: money, gems: m.gems });
      }
    });
    return out;
  }

  /* ---------- 하루 한 번 특별 출동 ---------- */
  /*
   * 날마다 하나(기기 날짜 기준, 자정에 바뀜). 여덟 가지가 차례로 돈다(같은 날엔 누구나 같은 규칙). 0.2.1: "위조된 한 패" 추가
   *   config: 판 설정(단계·시간) / mods: core 의 판별 규칙 / medals: 이 규칙의 동·은·금 점수
   *   준비물·장비는 쓰지 않는다(실력 겨루기). 보상: 받은 메달 등급 × 기준값 + 배지(하루 한 번).
   */
  var DAILY = [
    { id: 'blitz', name: '60초 속공', desc: '60초 · 처음부터 네 가지를 다 봐요', config: { duration: 60, level: 4 }, mods: {}, medals: [1500, 3000, 5500] },
    { id: 'bare', name: '맨손 수사', desc: '단서를 쓸 수 없어요 · 점수 2배', config: { duration: 90, level: 1 }, mods: { noHints: true, scoreMult: 2 }, medals: [6000, 11000, 20000] },
    { id: 'chain', name: '연쇄 검거', desc: '연속 검거 배수가 5배까지 올라요', config: { duration: 90, level: 1 }, mods: { comboMax: 5 }, medals: [4000, 8000, 16000] },
    { id: 'strict', name: '엄격한 서장', desc: '오인 체포 벌점 −10초 · 점수 1.5배', config: { duration: 90, level: 1 }, mods: { missPenalty: 10, scoreMult: 1.5 }, medals: [4000, 8000, 15000] },
    { id: 'clock', name: '마감 수사', desc: '120초 · 검거해도 시간이 늘지 않아요', config: { duration: 120, level: 1 }, mods: { hitTime: 0 }, medals: [3000, 6000, 11000] },
    { id: 'void', name: '빈 골목', desc: '처음부터 네 가지 · 검거 불가 점수 3배', config: { duration: 90, level: 4 }, mods: { noneMult: 3 }, medals: [3000, 6000, 11000] },
    { id: 'calm', name: '차분한 밤', desc: '150초 · 오인 체포 벌점 없음 · 점수 0.7배', config: { duration: 150, level: 1 }, mods: { missPenalty: 0, scoreMult: 0.7 }, medals: [3000, 6000, 11000] },
    // 0.2.1: 다른 퍼즐(forgery.js) — 세 명씩 지은 줄 중 써드가 위조한 가짜 한 줄 찾기
    { id: 'forge', name: '위조된 한 패', desc: '줄마다 세 명 · 써드가 위조한 가짜 줄을 찾아요', config: { duration: 90, level: 1, mode: 'forgery' }, mods: {}, medals: [3000, 6000, 11000] }
  ];
  var DAILY_GEMS = [1, 2, 3];   // 동·은·금 배지
  var DAILY_BASE = [1, 2, 3];   // 동·은·금 × 기준값
  var RETRY_GEMS = 5;           // 오늘 보상을 받은 뒤 배지로 한 번 더 도전(성공하면 보상도 다시 받는다)

  // 'YYYY-MM-DD' → 그날의 규칙(1970-01-01 부터 센 날 수로 돌린다)
  function dayIndex(day) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day || '');
    if (!m) throw EcoError('BAD_DAY', '날짜 형식은 YYYY-MM-DD');
    return Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000);
  }
  function dailyRule(day) {
    var n = dayIndex(day), i = ((n % DAILY.length) + DAILY.length) % DAILY.length;
    return DAILY[i];
  }
  /** 기기 시계 → 'YYYY-MM-DD'(그 기기의 지역 날짜). tzOffsetMin 은 Date#getTimezoneOffset() 값(한국 = −540) */
  function dayKey(now, tzOffsetMin) {
    var d = new Date(now - (tzOffsetMin || 0) * 60000);
    var p = function (x) { return (x < 10 ? '0' : '') + x; };
    return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
  }
  /** 오늘 상태. 날짜가 바뀌었으면 새날로 맞춘다. 반환 { day, rule, done, best, tries, canPlay, retryGems } */
  function dailyStatus(save, day) {
    if (save.daily.day !== day) save.daily = { day: day, done: false, best: 0, tries: 0 };
    var rule = dailyRule(day);
    return { day: day, rule: rule, done: save.daily.done, best: save.daily.best, tries: save.daily.tries,
             canPlay: !save.daily.done, retryGems: RETRY_GEMS };
  }
  /**
   * 특별 출동을 시작한다. 오늘 이미 보상을 받았으면 배지 RETRY_GEMS 개로 한 번 더(보상도 다시 받는다).
   * 반환: 판 설정 { duration, level, freeHints:0, nonePenalty, mods, daily:true, ruleId }
   */
  function startDaily(save, day, useGems) {
    var st = dailyStatus(save, day);
    if (st.done) {
      if (!useGems) throw EcoError('DAILY_DONE', '오늘 특별 출동은 끝났다');
      if (save.gems < RETRY_GEMS) throw EcoError('NOT_ENOUGH', '배지가 모자란다');
      save.gems -= RETRY_GEMS;
      save.daily.done = false;
    }
    save.daily.tries += 1;
    var r = st.rule;
    var mods = {};
    Object.keys(r.mods).forEach(function (k) { mods[k] = r.mods[k]; });
    return { duration: r.config.duration, level: r.config.level, freeHints: 0, nonePenalty: 10, mods: mods, daily: true, ruleId: r.id, mode: r.config.mode || 'set' };
  }
  /**
   * 특별 출동 결과. 메달이 있으면 보상을 주고 오늘을 끝낸다(동 미만이면 다시 할 수 있다).
   * 반환: { medal: '동'|'은'|'금'|null, money, gems, best }
   */
  function applyDaily(save, day, score, baseBefore) {
    var st = dailyStatus(save, day);
    score = Math.max(0, Math.floor(+score || 0));
    if (score > save.daily.best) save.daily.best = score;
    var tier = -1;
    st.rule.medals.forEach(function (at, i) { if (score >= at) tier = i; });
    if (tier < 0) return { medal: null, money: 0, gems: 0, best: save.daily.best };
    var money = roundNice(baseBefore * DAILY_BASE[tier] * (1 + bn(save, 'daily') / 100)), gems = DAILY_GEMS[tier];   // 0.3.0 펭귄: 특별 출동 수사비 +%
    save.money += money; save.gems += gems;
    save.daily.done = true;
    return { medal: ['동', '은', '금'][tier], money: money, gems: gems, best: save.daily.best };
  }

  return {
    ITEMS: ITEMS, PREP_IDS: PREP_IDS, MEDALS: MEDALS, DAILY: DAILY, RETRY_GEMS: RETRY_GEMS,
    baseValue: baseValue, roundNice: roundNice, price: price, owned: owned, buy: buy, unprep: unprep, consumePrep: consumePrep,
    medalFor: medalFor, claimMedals: claimMedals,
    dayKey: dayKey, dailyRule: dailyRule, dailyStatus: dailyStatus, startDaily: startDaily, applyDaily: applyDaily
  };
});
