/*
 * Team3Pets(0.3.0) — 말랑 동물 뽑기 · 도감 · 별 강화 · 보유/장착 효과.
 *
 * 구조
 *   20종 × 4등급(일반 c · 희귀 r · 영웅 h · 전설 l) = 80마리. 한 마리의 열쇠는 'corgi:c' 처럼 "종류:등급".
 *   저장은 save.pets 하나에 모은다(idle.load 는 객체만 넘겨주고, 검사는 여기 clean 이 한다).
 *     own    { 'corgi:c': 별(1~5) }   가진 동물과 별
 *     eq     '' | 'corgi:c'           장착(파트너) 1마리
 *     pity   전설 없이 뽑은 횟수(천장)
 *     treats 간식(★5 뒤 중복으로 받음 → 원하는 동물과 교환)
 *     tickets 뽑기권(무료 보상으로 받음)
 *     names  { 'corgi:c': '지어 준 이름' } · freeName 무료 이름 짓기를 썼는가(게임 전체 한 번)
 *     pulls  지금까지 뽑은 횟수 · welcome 처음 선물 받음 · gifts 한 번만 주는 보상을 받은 표시 { 'case1': true }
 *   DOM·시계·난수를 모른다(rng 는 밖에서 받는다) → node 시험에서 그대로 돈다.
 *
 * 뽑기
 *   등급을 먼저 정하고(RATES), 그 등급 안의 20종 중 하나를 똑같은 확률로 고른다.
 *   천장: PITY 번째까지 전설이 한 번도 안 나오면 그 번째는 전설 확정. 전설이 나오면 0 부터 다시 센다.
 *   10연속: 희귀 이상이 하나도 없으면 마지막 한 마리를 희귀로 올린다(천장이 먼저).
 *   확률·천장은 화면에 그대로 공개한다(게임산업법 · 구글 플레이 정책).
 *
 * 효과
 *   보유 효과: 가진 동물 모두(80마리 각각), 작게, 늘 켜짐. 종류마다 하나의 갈래(OWN)로 쌓인다.
 *   장착 효과: 파트너 1마리만, 크게. 등급 배수 GRADE_MUL × 별 배수(★마다 +25%).
 *   ⚡ 퍼즐 도움: 영웅·전설 등급의 일부 종류만. 일일 특별 출동에서는 쓰지 않는다(밖에서 판단).
 *   원칙: 돈으로 시간·편의를 산다. 퍼즐 도움은 작고, 기록을 겨루는 특별 출동에선 꺼진다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Team3Pets = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function PetError(code, message) { var e = new Error(message); e.name = 'PetError'; e.code = code; return e; }

  /* ---------- 등급 ---------- */
  var GRADES = ['c', 'r', 'h', 'l'];
  var GRADE = {
    c: { name: '일반', pct: 64, color: '#A3ACBA', treat: 1, swap: 20 },
    r: { name: '희귀', pct: 28, color: '#5BB2E8', treat: 3, swap: 60 },
    h: { name: '영웅', pct: 6, color: '#B07CF0', treat: 10, swap: 200 },
    l: { name: '전설', pct: 2, color: '#FFD23F', treat: 30, swap: 600 }
  };
  var GRADE_MUL = { c: 1, r: 1.5, h: 2, l: 3 };   // 장착 효과 배수
  var STAR_MAX = 5, STAR_STEP = 0.25;
  var PITY = 50;
  var COST = { one: 10, ten: 90 };   // 배지(◆)
  var WELCOME = 5;                   // 처음 뽑기 창을 열면 주는 뽑기권
  var NAME_MAX = 8, RENAME_GEMS = 5; // 0.3.0 동물 이름: 8자까지, 게임 전체 첫 한 번은 무료 · 그 뒤로 배지 5개

  /*
   * 종류(20). own: 보유 효과 갈래 / eq: 장착 효과(★1 · 일반 기준 값) / zap: 영웅 이상에서 열리는 ⚡ 퍼즐 도움
   *   갈래(효과 키):
   *     pay   출동 수사비 +%        idle  팀 수입 +%          speed 팀 검거 속도 +%
   *     cap   자리 비움 한도 +분     off   자리 비움 속도 +%p   gear  장비 값 −%      prep 준비물 값 −%
   *     party 팀 회식 시간 +%        night 야간 잠복조 한도 +분  daily 특별 출동 수사비 +%
   *     buff  사기 충전 +초          treat 중복 간식 +개        case2 사건 2 수입 +%   owl 밤(22~6시) 수입 +%
   */
  var SPECIES = [
    { id: 'corgi', kind: '웰시코기', name: '단서', own: 'pay', eq: { pay: 10 }, line: '큰 귀로 단서를 듣는 탐지견' },
    { id: 'shiba', kind: '시바견', name: '보리', own: 'idle', eq: { speed: 8 }, line: '무뚝뚝한데 검거하면 꼬리가 바쁨' },
    { id: 'hamster', kind: '햄스터', name: '도토리', own: 'cap', eq: { cap: 60 }, line: '볼주머니에 증거를 숨겨 옴' },
    { id: 'rabbit', kind: '토끼', name: '솜이', own: 'idle', eq: { party: 30 }, line: '긴 귀로 잠복 무전을 엿들음' },
    { id: 'bear', kind: '곰', name: '곰돌 반장', own: 'idle', eq: { idle: 10 }, line: '든든한 현장 반장' },
    { id: 'hedgehog', kind: '고슴도치', name: '가시', own: 'pay', eq: { buff: 30 }, line: '건드리면 따끔한 수비 담당' },
    { id: 'duck', kind: '오리', name: '뒤뚱', own: 'pay', eq: { treat: 1 }, line: '뒤뚱뒤뚱 탐문 수사' },
    { id: 'frog', kind: '개구리', name: '풍덩', own: 'idle', eq: { case2: 15 }, line: '비 오는 해무항 단골' },
    { id: 'ragdoll', kind: '랙돌', name: '알리', own: 'cap', eq: { off: 8 }, line: '파란 눈, 안기면 축 늘어짐' },
    { id: 'siamese', kind: '샴', name: '모카', own: 'prep', eq: { prep: 10 }, line: '얼굴이 원래 변장 가면' },
    { id: 'fox', kind: '여우', name: '노을', own: 'gear', eq: { gear: 8 }, line: '거짓말을 귀신같이 알아챔' },
    { id: 'penguin', kind: '펭귄', name: '펭경', own: 'pay', eq: { daily: 20 }, line: '정복이 원래 몸에 붙어 있음' },
    { id: 'monkey', kind: '원숭이', name: '망고', own: 'cap', eq: { night: 60 }, line: '높은 곳에서 망을 봄' },
    { id: 'squirrel', kind: '다람쥐', name: '도람', own: 'idle', eq: { pay: 6, idle: 6 }, line: '증거를 도토리처럼 모아 둠' },
    { id: 'koala', kind: '코알라', name: '코코', own: 'cap', eq: { cap: 90 }, line: '하루 20시간 잠복(사실은 잠)' },
    { id: 'raccoon', kind: '너구리', name: '몽이', own: 'pay', eq: { pay: 8 }, zap: { shield: 1 }, line: '타고난 검은 복면, 야간 잠복' },
    { id: 'owl', kind: '부엉이', name: '새벽', own: 'idle', eq: { owl: 25 }, line: '새벽 3시 CCTV 담당' },
    { id: 'otter', kind: '수달', name: '달수', own: 'pay', eq: { speed: 5 }, zap: { miss: 2 }, line: '해무항 물속 증거 수색' },
    { id: 'panda', kind: '판다', name: '판돌', own: 'idle', eq: { pay: 10, idle: 10 }, zap: { time: 3 }, line: '3팀의 전설, 보기 드문 손님' },
    { id: 'tiger', kind: '호랑이', name: '범수', own: 'pay', eq: { pay: 12 }, zap: { combo: 1 }, line: '범인 잡는 범' }
  ];
  var BY_ID = {};
  SPECIES.forEach(function (s) { BY_ID[s.id] = s; });

  // 보유 효과: 한 마리(★1)가 주는 값. 퍼센트 갈래와 분 갈래
  var OWN_VAL = { c: { pct: 0.5, min: 5 }, r: { pct: 1, min: 10 }, h: { pct: 2, min: 20 }, l: { pct: 3, min: 40 } };
  var OWN_KIND = { pay: '출동 수사비', idle: '팀 수입', cap: '자리 비움 한도', gear: '장비 값 할인', prep: '준비물 값 할인' };
  // 효과가 너무 커지지 않게 묶는 상한
  var CAPS = { gear: 50, prep: 50, cap: 8 * 60, off: 30, night: 8 * 60, buff: 300, treat: 5, party: 300 };

  var LABEL = {
    pay: ['출동 수사비', '+', '%'], idle: ['팀 수입', '+', '%'], speed: ['팀 검거 속도', '+', '%'],
    cap: ['자리 비움 한도', '+', '분'], off: ['자리 비움 중 팀 속도', '+', '%p'], gear: ['장비 값', '−', '%'], prep: ['준비물 값', '−', '%'],
    party: ['팀 회식 시간', '+', '%'], night: ['야간 잠복조 한도', '+', '분'], daily: ['특별 출동 수사비', '+', '%'],
    buff: ['출동 뒤 사기 충전', '+', '초'], treat: ['중복일 때 간식', '+', '개'], case2: ['해무항(사건 2) 수입', '+', '%'],
    owl: ['밤(22~6시) 수입', '+', '%'],
    shield: ['⚡ 오인 체포 벌점 면제', '', '번'], miss: ['⚡ 오인 체포 벌점', '−', '초'], time: ['⚡ 출동 시간', '+', '초'], combo: ['⚡ 연속 배수 상한', '+', '']
  };

  /* ---------- 저장 ---------- */
  function key(id, g) { return id + ':' + g; }
  function parse(k) {
    var m = /^([a-z0-9]+):([crhl])$/.exec(k || '');
    return m && BY_ID[m[1]] ? { id: m[1], g: m[2] } : null;
  }
  function empty() { return { own: {}, eq: '', pity: 0, treats: 0, tickets: 0, pulls: 0, welcome: false, gifts: {}, names: {}, freeName: false }; }
  function int(v, def, min, max) {
    if (typeof v !== 'number' || !isFinite(v)) return def;
    v = Math.floor(v);
    return v < min ? min : v > max ? max : v;
  }
  /** 저장 속 pets 를 검사해 깨끗한 값으로 바꾼다(없거나 깨졌으면 빈 값). save.pets 를 돌려준다 */
  function clean(save) {
    var d = save.pets && typeof save.pets === 'object' ? save.pets : {}, p = empty();
    var own = d.own && typeof d.own === 'object' ? d.own : {};
    Object.keys(own).forEach(function (k) { if (parse(k)) p.own[k] = int(own[k], 1, 1, STAR_MAX); });
    p.eq = typeof d.eq === 'string' && p.own[d.eq] ? d.eq : '';
    p.pity = int(d.pity, 0, 0, PITY - 1);
    p.treats = int(d.treats, 0, 0, 1e7);
    p.tickets = int(d.tickets, 0, 0, 1e5);
    p.pulls = int(d.pulls, 0, 0, 1e8);
    p.welcome = d.welcome === true;
    var gf = d.gifts && typeof d.gifts === 'object' ? d.gifts : {};
    Object.keys(gf).slice(0, 200).forEach(function (k) { if (gf[k] === true && /^[a-z0-9_-]{1,24}$/.test(k)) p.gifts[k] = true; });
    var nm = d.names && typeof d.names === 'object' ? d.names : {};
    Object.keys(nm).forEach(function (k) { var v = cleanText(nm[k]); if (parse(k) && v) p.names[k] = v; });
    p.freeName = d.freeName === true;
    save.pets = p;
    return p;
  }
  function P(save) { return save.pets && save.pets.own ? save.pets : clean(save); }

  /* ---------- 이름(0.3.0) ---------- */
  // 줄바꿈·제어 문자·꺾쇠를 빼고 NAME_MAX 글자까지(이모지도 한 글자로 센다)
  function cleanText(v) {
    if (typeof v !== 'string') return '';
    return Array.from(v.replace(/\s+/g, ' ').replace(/[\u0000-\u001f\u007f<>]/g, '').trim()).slice(0, NAME_MAX).join('');
  }
  /** 그 동물의 이름(지어 준 이름이 없으면 종류의 기본 이름) */
  function nameOf(save, k) {
    var x = parse(k), p = save && save.pets;
    if (!x) return '';
    return (p && p.names && p.names[k]) || BY_ID[x.id].name;
  }
  /** 다음 이름 바꾸기 값(배지). 게임 전체에서 첫 한 번은 0 */
  function renameCost(save) { return P(save).freeName ? RENAME_GEMS : 0; }
  /** 이름 짓기. 반환 { name, paid } */
  function rename(save, k, name) {
    var p = P(save), x = parse(k);
    if (!x || !p.own[k]) throw PetError('NOT_OWNED', '없는 동물');
    var v = cleanText(name);
    if (!v) throw PetError('EMPTY', '이름이 비었다');
    if (v === nameOf(save, k)) throw PetError('SAME', '같은 이름');
    var c = renameCost(save), tag = false;
    if (c === 0) p.freeName = true;
    else if ((save.nameTags || 0) > 0) { save.nameTags -= 1; tag = true; c = 0; }   // 이름표가 있으면 배지 대신(idle.NAME_TAGS)
    else if (!(save.gems >= c)) throw PetError('NOT_ENOUGH', '배지가 모자란다');
    else save.gems -= c;
    if (v === BY_ID[x.id].name) delete p.names[k]; else p.names[k] = v;
    return { name: v, paid: c, tag: tag };
  }
  /** 기본 이름으로 되돌리기(무료) */
  function resetName(save, k) { var p = P(save); delete p.names[k]; return nameOf(save, k); }

  /* ---------- 확률 ---------- */
  /** 등급 확률(%)과 한 마리 확률(%) — 화면에 공개하는 표 */
  function rates() {
    return GRADES.map(function (g) {
      return { g: g, name: GRADE[g].name, pct: GRADE[g].pct, each: Math.round(GRADE[g].pct / SPECIES.length * 1000) / 1000 };
    });
  }
  function rollGrade(rng) {
    var x = rng() * 100, acc = 0;
    for (var i = GRADES.length - 1; i >= 0; i--) {   // 전설부터 깎아 내려간다(경계값이 일반 쪽으로 가게)
      acc += GRADE[GRADES[i]].pct;
      if (x < acc) return GRADES[i];
    }
    return 'c';
  }
  function rollSpecies(rng) {
    var i = Math.floor(rng() * SPECIES.length);
    return SPECIES[Math.min(SPECIES.length - 1, Math.max(0, i))].id;
  }

  /* ---------- 받기(중복 → 별 → 간식) ---------- */
  function treatBonus(save) { return Math.round(bonus(save).treat || 0); }
  /** 한 마리를 넣는다. 반환 { key, id, g, isNew, star, treats } */
  function grant(save, id, g) {
    var p = P(save), k = key(id, g), r = { key: k, id: id, g: g, isNew: false, star: 0, treats: 0 };
    if (!p.own[k]) { p.own[k] = 1; r.isNew = true; r.star = 1; }
    else if (p.own[k] < STAR_MAX) { p.own[k] += 1; r.star = p.own[k]; }
    else { r.treats = GRADE[g].treat + treatBonus(save); p.treats += r.treats; r.star = STAR_MAX; }
    if (!p.eq) p.eq = k;   // 처음 가진 동물은 바로 파트너로
    return r;
  }

  /**
   * 뽑기. n = 1 | 10. pay = 'ticket' | 'gems'. rng 는 0 이상 1 미만.
   * 반환: { results:[grant 결과], paid:{ w, c } }
   */
  function pull(save, n, pay, rng) {
    if (n !== 1 && n !== 10) throw PetError('BAD_COUNT', '1회 또는 10회만');
    if (typeof rng !== 'function') throw PetError('BAD_RNG', 'rng 는 함수');
    var p = P(save), c;
    if (pay === 'ticket') {
      c = n;
      if (p.tickets < c) throw PetError('NOT_ENOUGH', '뽑기권이 모자란다');
      p.tickets -= c;
    } else if (pay === 'gems') {
      c = n === 10 ? COST.ten : COST.one;
      if (!(save.gems >= c)) throw PetError('NOT_ENOUGH', '배지가 모자란다');
      save.gems -= c;
    } else throw PetError('BAD_PAY', '뽑기권 또는 배지');
    var out = [];
    for (var i = 0; i < n; i++) {
      var g;
      if (p.pity >= PITY - 1) g = 'l';            // 천장
      else g = rollGrade(rng);
      if (n === 10 && i === n - 1 && g === 'c' && out.every(function (x) { return x.g === 'c'; })) g = 'r';   // 10연속 희귀 보장
      p.pity = g === 'l' ? 0 : p.pity + 1;
      p.pulls += 1;
      out.push(grant(save, rollSpecies(rng), g));
    }
    return { results: out, paid: { w: pay, c: c } };
  }

  /** 간식으로 원하는 동물 받기. 반환: grant 결과 */
  function swap(save, id, g) {
    if (!BY_ID[id] || !GRADE[g]) throw PetError('BAD_PET', '모르는 동물');
    var p = P(save), c = GRADE[g].swap;
    if (p.own[key(id, g)] >= STAR_MAX) throw PetError('MAXED', '이미 ★5');
    if (p.treats < c) throw PetError('NOT_ENOUGH', '간식이 모자란다');
    p.treats -= c;
    return grant(save, id, g);
  }
  function equip(save, k) {
    var p = P(save);
    if (!p.own[k]) throw PetError('NOT_OWNED', '없는 동물');
    p.eq = k;
    return k;
  }
  /** 무료 뽑기권 주기(보상) */
  function addTickets(save, n) { var p = P(save); p.tickets += Math.max(0, Math.floor(n) || 0); return p.tickets; }
  /** 한 번만 주는 뽑기권 보상(사건 종결 등). 이미 받았으면 0 */
  function giftOnce(save, k, n) {
    var p = P(save);
    if (!/^[a-z0-9_-]{1,24}$/.test(k) || p.gifts[k]) return 0;
    p.gifts[k] = true; p.tickets += n;
    return n;
  }
  /** 처음 뽑기 창을 열 때 선물. 이미 받았으면 0 */
  function claimWelcome(save) {
    var p = P(save);
    if (p.welcome) return 0;
    p.welcome = true; p.tickets += WELCOME;
    return WELCOME;
  }

  /* ---------- 효과 ---------- */
  function starMul(star) { return 1 + STAR_STEP * ((star || 1) - 1); }
  /** 한 마리의 보유 효과 { 갈래: 값 } */
  function ownEffect(id, g, star) {
    var s = BY_ID[id], v = OWN_VAL[g][s.own === 'cap' ? 'min' : 'pct'] * starMul(star), o = {};
    o[s.own] = v;
    return o;
  }
  /** 한 마리의 장착 효과 { 갈래: 값 }(⚡ 포함 — 영웅 이상만) */
  function eqEffect(id, g, star) {
    var s = BY_ID[id], m = GRADE_MUL[g] * starMul(star), o = {};
    Object.keys(s.eq).forEach(function (k) { o[k] = s.eq[k] * m; });
    if (s.zap && (g === 'h' || g === 'l')) Object.keys(s.zap).forEach(function (k) { o[k] = s.zap[k] + (g === 'l' && k === 'time' ? 2 : 0); });
    return o;
  }
  function add(a, b) { Object.keys(b).forEach(function (k) { a[k] = (a[k] || 0) + b[k]; }); return a; }

  /**
   * 지금 켜진 효과의 합. opts.hour(0~23, 기기 시각)이 있으면 부엉이 밤 효과를 센다. opts.caseNo 로 개구리 효과를 센다.
   * 반환(모두 숫자, 없으면 0): pay idle speed cap off gear prep party night daily buff treat shield miss time combo
   *   pay·idle 에는 case2·owl 이 조건에 맞을 때 더해져 있다.
   */
  function bonus(save, opts) {
    var p = save && save.pets && save.pets.own ? save.pets : null, b = {};
    if (!p) return zero();
    Object.keys(p.own).forEach(function (k) { var x = parse(k); if (x) add(b, ownEffect(x.id, x.g, p.own[k])); });
    var e = parse(p.eq);
    if (e && p.own[p.eq]) add(b, eqEffect(e.id, e.g, p.own[p.eq]));
    opts = opts || {};
    if (b.case2 && opts.caseNo === 2) { b.pay = (b.pay || 0) + b.case2; b.idle = (b.idle || 0) + b.case2; }
    if (b.owl && typeof opts.hour === 'number' && (opts.hour >= 22 || opts.hour < 6)) { b.pay = (b.pay || 0) + b.owl; b.idle = (b.idle || 0) + b.owl; }
    Object.keys(CAPS).forEach(function (k) { if (b[k] > CAPS[k]) b[k] = CAPS[k]; });
    var z = zero();
    Object.keys(z).forEach(function (k) { z[k] = b[k] || 0; });
    return z;
  }
  function zero() { return { pay: 0, idle: 0, speed: 0, cap: 0, off: 0, gear: 0, prep: 0, party: 0, night: 0, daily: 0, buff: 0, treat: 0, case2: 0, owl: 0, shield: 0, miss: 0, time: 0, combo: 0 }; }

  /** 효과 { 갈래: 값 } → 사람이 읽는 줄 목록 */
  function describe(eff) {
    return Object.keys(eff).map(function (k) {
      var L = LABEL[k], v = L && L[2] === '%' || L && L[2] === '%p' ? Math.round(eff[k] * 10) / 10 : Math.round(eff[k]);   // 퍼센트는 소수 한 자리, 분·초·개는 정수
      return L ? L[0] + ' ' + L[1] + v + L[2] : k + ' ' + v;
    });
  }
  /** 도감 수집 현황 { have, total, byGrade:{c:n,...} } */
  function progress(save) {
    var p = P(save), by = { c: 0, r: 0, h: 0, l: 0 }, have = 0;
    Object.keys(p.own).forEach(function (k) { var x = parse(k); if (x) { by[x.g] += 1; have += 1; } });
    return { have: have, total: SPECIES.length * GRADES.length, byGrade: by };
  }

  return {
    GRADES: GRADES, GRADE: GRADE, GRADE_MUL: GRADE_MUL, SPECIES: SPECIES, BY_ID: BY_ID, OWN_KIND: OWN_KIND,
    STAR_MAX: STAR_MAX, PITY: PITY, COST: COST, WELCOME: WELCOME, CAPS: CAPS,
    key: key, parse: parse, clean: clean, rates: rates, rollGrade: rollGrade, pull: pull, grant: grant, swap: swap, equip: equip,
    addTickets: addTickets, claimWelcome: claimWelcome, giftOnce: giftOnce,
    NAME_MAX: NAME_MAX, RENAME_GEMS: RENAME_GEMS, cleanText: cleanText, nameOf: nameOf, renameCost: renameCost, rename: rename, resetName: resetName, ownEffect: ownEffect, eqEffect: eqEffect, bonus: bonus, describe: describe,
    starMul: starMul, progress: progress, zero: zero
  };
});
