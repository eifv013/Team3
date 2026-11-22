/*
 * Team3Ach(0.3.0) — 업적과 칭호.
 *
 * 구조
 *   업적(LIST)은 저장 값(save)만 보고 달성을 판단한다(DOM·시계를 모른다 → node 시험).
 *   달성하면 칭호 하나와 보상(뽑기권 tickets · 배지 gems)을 바로 준다(따로 "받기" 단추 없음).
 *   칭호는 팀장 이름 앞(save.ach.title)과 동물 이름 앞(save.ach.pet['corgi:c'])에 달 수 있다.
 *   업적 말고 배지로 사는 칭호(SHOP)도 있다 — 꾸미기라 퍼즐 실력과 상관없다.
 *
 * 저장 save.ach
 *   got   { 업적id: true }       달성한 업적(보상을 받았다)
 *   bought{ 칭호id: true }       배지로 산 칭호
 *   title ''|칭호id              팀장 칭호
 *   pet   { 'corgi:c': 칭호id }  동물 칭호
 *   stat  { dailyMedals, dailyGold } 저장에 따로 없는 기록(특별 출동 메달 수)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Team3Ach = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function AchError(code, message) { var e = new Error(message); e.name = 'AchError'; e.code = code; return e; }

  function petCount(save, grade) {
    var own = save.pets && save.pets.own || {}, n = 0;
    Object.keys(own).forEach(function (k) { if (!grade || k.slice(-2) === ':' + grade) n += 1; });
    return n;
  }
  function closed(save, no) {
    if ((save.past || []).some(function (x) { return x.no === no; })) return 1;
    return save.caseNo === no && save.closed ? 1 : 0;
  }
  function st(save, k) { return save.ach && save.ach.stat && save.ach.stat[k] || 0; }

  /*
   * 업적. need(save) → 지금 값, goal → 목표. title: 받는 칭호. tickets/gems: 보상.
   * 묶음(group)은 화면에서 보기 좋게 나누는 데만 쓴다.
   */
  var LIST = [
    { id: 'run1', group: '현장', name: '첫 출동', desc: '현장 출동 1번', need: function (s) { return s.runs; }, goal: 1, title: '새내기', tickets: 1 },
    { id: 'run50', group: '현장', name: '출동이 일상', desc: '현장 출동 50번', need: function (s) { return s.runs; }, goal: 50, title: '출동 반장', tickets: 3 },
    { id: 'run300', group: '현장', name: '현장에서 산다', desc: '현장 출동 300번', need: function (s) { return s.runs; }, goal: 300, title: '현장의 전설', tickets: 5, gems: 20 },
    { id: 'catch100', group: '현장', name: '눈썰미', desc: '현장에서 직접 100명 검거', need: function (s) { return s.runCaught; }, goal: 100, title: '눈썰미', tickets: 2 },
    { id: 'catch1000', group: '현장', name: '매의 눈', desc: '현장에서 직접 1,000명 검거', need: function (s) { return s.runCaught; }, goal: 1000, title: '매의 눈', tickets: 4 },
    { id: 'catch5000', group: '현장', name: '걸어 다니는 CCTV', desc: '현장에서 직접 5,000명 검거', need: function (s) { return s.runCaught; }, goal: 5000, title: '인간 CCTV', tickets: 5, gems: 30 },
    { id: 'score3k', group: '점수', name: '기대주', desc: '출동 점수 3,000', need: function (s) { return s.bestScore; }, goal: 3000, title: '기대주', tickets: 1 },
    { id: 'score10k', group: '점수', name: '에이스', desc: '출동 점수 10,000', need: function (s) { return s.bestScore; }, goal: 10000, title: '에이스', tickets: 3 },
    { id: 'score20k', group: '점수', name: '수사의 신', desc: '출동 점수 20,000', need: function (s) { return s.bestScore; }, goal: 20000, title: '수사의 신', tickets: 5, gems: 30 },
    { id: 'daily5', group: '점수', name: '특별한 하루', desc: '특별 출동 메달 5번', need: function (s) { return st(s, 'dailyMedals'); }, goal: 5, title: '특출난 형사', tickets: 2 },
    { id: 'gold3', group: '점수', name: '금빛 수사', desc: '특별 출동 금메달 3번', need: function (s) { return st(s, 'dailyGold'); }, goal: 3, title: '금메달 형사', tickets: 3, gems: 10 },
    { id: 'det10', group: '사무실', name: '팀 빌더', desc: '형사 10명', need: function (s) { return s.detectives; }, goal: 10, title: '팀 빌더', tickets: 2 },
    { id: 'det30', group: '사무실', name: '대부대', desc: '형사 30명', need: function (s) { return s.detectives; }, goal: 30, title: '대부대장', tickets: 4 },
    { id: 'train10', group: '사무실', name: '지옥 훈련', desc: '합동 훈련 10단계', need: function (s) { return s.training; }, goal: 10, title: '훈련 교관', tickets: 3 },
    { id: 'case1', group: '사건', name: '골목의 평화', desc: '사건 1 종결', need: function (s) { return closed(s, 1); }, goal: 1, title: '골목 해결사', tickets: 3 },
    { id: 'case2', group: '사건', name: '안개가 걷히다', desc: '사건 2 종결', need: function (s) { return closed(s, 2); }, goal: 1, title: '해무항의 등대', tickets: 5 },
    { id: 'pet10', group: '말랑 수사대', name: '동물 친구', desc: '동물 10마리 모으기', need: function (s) { return petCount(s); }, goal: 10, title: '동물 친구', tickets: 2 },
    { id: 'pet40', group: '말랑 수사대', name: '말랑 수집가', desc: '동물 50마리 모으기', need: function (s) { return petCount(s); }, goal: 50, title: '말랑 수집가', tickets: 5 },
    { id: 'pet80', group: '말랑 수사대', name: '도감 완성', desc: '동물 120마리 모두 모으기', need: function (s) { return petCount(s); }, goal: 120, title: '말랑 도감 완성', gems: 150 },   // id 는 저장 호환으로 그대로(0.4.0: 80 → 120)
    { id: 'legend1', group: '말랑 수사대', name: '전설을 만나다', desc: '전설 동물 1마리', need: function (s) { return petCount(s, 'l'); }, goal: 1, title: '전설을 만난 자', tickets: 3 },
    { id: 'pull100', group: '말랑 수사대', name: '운명의 손', desc: '뽑기 100번', need: function (s) { return s.pets && s.pets.pulls || 0; }, goal: 100, title: '운명의 손', tickets: 5 }
  ];
  // 배지로 사는 칭호(꾸미기)
  var SHOP = [
    { id: 's-detective', title: '명탐정', gems: 30 },
    { id: 's-night', title: '밤의 제왕', gems: 30 },
    { id: 's-cute', title: '귀요미', gems: 20 },
    { id: 's-boss', title: '3팀의 자랑', gems: 40 },
    { id: 's-rookie', title: '아직은 신입', gems: 10 }
  ];
  var BY_ID = {}, SHOP_BY = {};
  LIST.forEach(function (a) { BY_ID[a.id] = a; });
  SHOP.forEach(function (t) { SHOP_BY[t.id] = t; });
  var TITLE_MAX = 10;

  function int(v, def, min, max) {
    if (typeof v !== 'number' || !isFinite(v)) return def;
    v = Math.floor(v);
    return v < min ? min : v > max ? max : v;
  }
  function isTitle(id) { return !!(BY_ID[id] || SHOP_BY[id]); }
  /** 저장 속 ach 를 검사해 깨끗하게(없으면 빈 값). save.ach 를 돌려준다 */
  function clean(save) {
    var d = save.ach && typeof save.ach === 'object' ? save.ach : {}, a = { got: {}, bought: {}, title: '', pet: {}, stat: { dailyMedals: 0, dailyGold: 0 } };
    var got = d.got && typeof d.got === 'object' ? d.got : {};
    Object.keys(got).forEach(function (k) { if (got[k] === true && BY_ID[k]) a.got[k] = true; });
    var bo = d.bought && typeof d.bought === 'object' ? d.bought : {};
    Object.keys(bo).forEach(function (k) { if (bo[k] === true && SHOP_BY[k]) a.bought[k] = true; });
    var sd = d.stat && typeof d.stat === 'object' ? d.stat : {};
    a.stat.dailyMedals = int(sd.dailyMedals, 0, 0, 1e6);
    a.stat.dailyGold = int(sd.dailyGold, 0, 0, 1e6);
    save.ach = a;
    a.title = typeof d.title === 'string' && has(save, d.title) ? d.title : '';
    var pt = d.pet && typeof d.pet === 'object' ? d.pet : {};
    Object.keys(pt).slice(0, 200).forEach(function (k) { if (/^[a-z0-9]+:[crhl]$/.test(k) && has(save, pt[k])) a.pet[k] = pt[k]; });
    return a;
  }
  function A(save) { return save.ach && save.ach.got ? save.ach : clean(save); }

  /** 그 칭호를 쓸 수 있는가(업적 달성 또는 구매) */
  function has(save, id) { var a = save.ach || {}; return !!((a.got && a.got[id] && BY_ID[id]) || (a.bought && a.bought[id] && SHOP_BY[id])); }
  /** 칭호 글(없으면 '') */
  function titleText(id) { return BY_ID[id] ? BY_ID[id].title : SHOP_BY[id] ? SHOP_BY[id].title : ''; }
  /** 쓸 수 있는 칭호 [{ id, title }] */
  function owned(save) {
    A(save);
    return LIST.filter(function (a) { return has(save, a.id); }).map(function (a) { return { id: a.id, title: a.title }; })
      .concat(SHOP.filter(function (t) { return has(save, t.id); }).map(function (t) { return { id: t.id, title: t.title }; }));
  }

  /** 지금 값과 달성 여부 */
  function status(save) {
    var a = A(save);
    return LIST.map(function (x) {
      var v = 0;
      try { v = +x.need(save) || 0; } catch (e) { v = 0; }
      return { a: x, value: Math.min(v, x.goal), done: !!a.got[x.id], ready: !a.got[x.id] && v >= x.goal };
    });
  }
  /**
   * 새로 달성한 업적을 처리한다: 표시하고 보상을 준다(뽑기권은 addTickets 로, 동물 모듈이 없으면 건너뛴다).
   * 반환: 새로 달성한 업적 목록
   */
  function check(save, addTickets) {
    var a = A(save), out = [];
    status(save).forEach(function (r) {
      if (!r.ready) return;
      a.got[r.a.id] = true;
      if (r.a.gems) save.gems = (save.gems || 0) + r.a.gems;
      if (r.a.tickets && typeof addTickets === 'function') addTickets(save, r.a.tickets);
      out.push(r.a);
    });
    return out;
  }
  /** 특별 출동 메달 기록 */
  function noteDaily(save, medal) {
    var a = A(save);
    if (!medal) return;
    a.stat.dailyMedals += 1;
    if (medal === '금') a.stat.dailyGold += 1;
  }
  /** 칭호 사기(배지) */
  function buy(save, id) {
    var t = SHOP_BY[id], a = A(save);
    if (!t) throw AchError('BAD_TITLE', '모르는 칭호');
    if (a.bought[id]) throw AchError('ALREADY', '이미 있다');
    if (!(save.gems >= t.gems)) throw AchError('NOT_ENOUGH', '배지가 모자란다');
    save.gems -= t.gems;
    a.bought[id] = true;
    return t;
  }
  /** 팀장 칭호 달기('' 이면 떼기) */
  function setTitle(save, id) {
    var a = A(save);
    if (id && !has(save, id)) throw AchError('LOCKED', '아직 없는 칭호');
    a.title = id || '';
    return a.title;
  }
  /** 동물 칭호 달기('' 이면 떼기). 가진 동물만 */
  function setPetTitle(save, key, id) {
    var a = A(save);
    if (!(save.pets && save.pets.own && save.pets.own[key])) throw AchError('NOT_OWNED', '없는 동물');
    if (id && !has(save, id)) throw AchError('LOCKED', '아직 없는 칭호');
    if (id) a.pet[key] = id; else delete a.pet[key];
    return id || '';
  }
  function leaderTitle(save) { var a = save.ach; return a && a.title ? titleText(a.title) : ''; }
  function petTitle(save, key) { var a = save.ach; return a && a.pet && a.pet[key] ? titleText(a.pet[key]) : ''; }
  function progress(save) { var a = A(save); return { have: Object.keys(a.got).length, total: LIST.length }; }

  return {
    LIST: LIST, SHOP: SHOP, BY_ID: BY_ID, TITLE_MAX: TITLE_MAX,
    clean: clean, status: status, check: check, noteDaily: noteDaily, buy: buy, has: has, owned: owned, titleText: titleText,
    setTitle: setTitle, setPetTitle: setPetTitle, leaderTitle: leaderTitle, petTitle: petTitle, progress: progress
  };
});
