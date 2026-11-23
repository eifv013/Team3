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
  function starCount(save, star) {
    var own = save.pets && save.pets.own || {}, n = 0;
    Object.keys(own).forEach(function (k) { if (own[k] >= star) n += 1; });
    return n;
  }
  function closed(save, no) {
    if ((save.past || []).some(function (x) { return x.no === no; })) return 1;
    return save.caseNo === no && save.closed ? 1 : 0;
  }
  // 0.7.0 실력 업적(점수)은 강력 사건 이상에서 낸 최고 점수로. 난이도가 없던 예전 기록은 강력 사건으로 친다
  function skillBest(s) { return s.diff && typeof s.diff.best === 'number' ? s.diff.best : s.bestScore || 0; }
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
    { id: 'score3k', group: '점수', name: '기대주', desc: '강력 사건 이상 · 출동 점수 3,000', need: function (s) { return skillBest(s); }, goal: 3000, title: '기대주', tickets: 1 },
    { id: 'score10k', group: '점수', name: '에이스', desc: '강력 사건 이상 · 출동 점수 10,000', need: function (s) { return skillBest(s); }, goal: 10000, title: '에이스', tickets: 3 },
    { id: 'score20k', group: '점수', name: '수사의 신', desc: '강력 사건 이상 · 출동 점수 20,000', need: function (s) { return skillBest(s); }, goal: 20000, title: '수사의 신', tickets: 5, gems: 30 },
    { id: 'daily5', group: '점수', name: '특별한 하루', desc: '특별 출동 메달 5번', need: function (s) { return st(s, 'dailyMedals'); }, goal: 5, title: '특출난 형사', tickets: 2 },
    { id: 'gold3', group: '점수', name: '금빛 수사', desc: '특별 출동 금메달 3번', need: function (s) { return st(s, 'dailyGold'); }, goal: 3, title: '금메달 형사', tickets: 3, gems: 10 },
    { id: 'det10', group: '사무실', name: '팀 빌더', desc: '형사 10명', need: function (s) { return s.detectives; }, goal: 10, title: '팀 빌더', tickets: 2 },
    { id: 'det30', group: '사무실', name: '대부대', desc: '형사 30명', need: function (s) { return s.detectives; }, goal: 30, title: '대부대장', tickets: 4 },
    { id: 'train10', group: '사무실', name: '지옥 훈련', desc: '합동 훈련 10단계', need: function (s) { return s.training; }, goal: 10, title: '훈련 교관', tickets: 3 },
    { id: 'case1', group: '사건', name: '골목의 평화', desc: '사건 1 종결', need: function (s) { return closed(s, 1); }, goal: 1, title: '골목 해결사', tickets: 3 },
    { id: 'case2', group: '사건', name: '안개가 걷히다', desc: '사건 2 종결', need: function (s) { return closed(s, 2); }, goal: 1, title: '해무항의 등대', tickets: 5 },
    { id: 'pet10', group: '파트너', name: '파트너 친구', desc: '파트너 10마리 모으기', need: function (s) { return petCount(s); }, goal: 10, title: '파트너 친구', tickets: 2 },
    { id: 'pet40', group: '파트너', name: '말랑 수집가', desc: '파트너 50마리 모으기', need: function (s) { return petCount(s); }, goal: 50, title: '말랑 수집가', tickets: 5 },
    { id: 'pet80', group: '파트너', name: '도감 완성', desc: '파트너 120마리 모두 모으기', need: function (s) { return petCount(s); }, goal: 120, title: '말랑 도감 완성', gems: 150 },   // id 는 저장 호환으로 그대로(0.4.0: 80 → 120)
    { id: 'legend1', group: '파트너', name: '전설을 만나다', desc: '전설 파트너 1마리', need: function (s) { return petCount(s, 'l'); }, goal: 1, title: '전설을 만난 자', tickets: 3 },
    { id: 'pull100', group: '파트너', name: '운명의 손', desc: '뽑기 100번', need: function (s) { return s.pets && s.pets.pulls || 0; }, goal: 100, title: '운명의 손', tickets: 5 },
    // 0.6.0 업적 늘리기(31개 → 50개). 받기는 눌러서(claim) — 달성하면 빨간 점
    { id: 'run10', group: '현장', name: '몸이 풀렸다', desc: '현장 출동 10번', need: function (s) { return s.runs; }, goal: 10, title: '현장 체질', tickets: 1 },
    { id: 'run1000', group: '현장', name: '천 번의 출동', desc: '현장 출동 1,000번', need: function (s) { return s.runs; }, goal: 1000, title: '살아 있는 기록', tickets: 10, gems: 50 },
    { id: 'catch20k', group: '현장', name: '검거 기계', desc: '현장에서 직접 20,000명 검거', need: function (s) { return s.runCaught; }, goal: 20000, title: '검거 기계', tickets: 8, gems: 40 },
    { id: 'score5k', group: '점수', name: '감이 왔다', desc: '강력 사건 이상 · 출동 점수 5,000', need: function (s) { return skillBest(s); }, goal: 5000, title: '감 좋은 형사', tickets: 2 },
    { id: 'score40k', group: '점수', name: '전설의 한 판', desc: '강력 사건 이상 · 출동 점수 40,000', need: function (s) { return skillBest(s); }, goal: 40000, title: '전설의 한 판', tickets: 8, gems: 50 },
    { id: 'daily20', group: '점수', name: '특별 출동 단골', desc: '특별 출동 메달 20번', need: function (s) { return st(s, 'dailyMedals'); }, goal: 20, title: '특별 출동 단골', tickets: 4, gems: 10 },
    { id: 'gold10', group: '점수', name: '금메달 수집가', desc: '특별 출동 금메달 10번', need: function (s) { return st(s, 'dailyGold'); }, goal: 10, title: '금빛 수집가', tickets: 5, gems: 30 },
    { id: 'det5', group: '사무실', name: '한 팀이 되다', desc: '형사 5명', need: function (s) { return s.detectives; }, goal: 5, title: '팀장다운 팀장', tickets: 1 },
    { id: 'det60', group: '사무실', name: '한 개 서', desc: '형사 60명', need: function (s) { return s.detectives; }, goal: 60, title: '서장급 팀장', tickets: 6, gems: 30 },
    { id: 'train5', group: '사무실', name: '땀의 결실', desc: '합동 훈련 5단계', need: function (s) { return s.training; }, goal: 5, title: '훈련광', tickets: 2 },
    { id: 'team1k', group: '사무실', name: '팀이 잡은 천 명', desc: '팀(방치)이 잡은 1,000명', need: function (s) { return s.teamCaught || 0; }, goal: 1000, title: '든든한 팀', tickets: 2 },
    { id: 'team10k', group: '사무실', name: '팀이 잡은 만 명', desc: '팀(방치)이 잡은 10,000명', need: function (s) { return s.teamCaught || 0; }, goal: 10000, title: '만 명의 팀', tickets: 5, gems: 20 },
    { id: 'send100', group: '사무실', name: '호송 반장', desc: '유치장에서 100명 이송', need: function (s) { return s.office && s.office.sent || 0; }, goal: 100, title: '호송 반장', tickets: 2 },
    { id: 'send1000', group: '사무실', name: '호송 대장', desc: '유치장에서 1,000명 이송', need: function (s) { return s.office && s.office.sent || 0; }, goal: 1000, title: '호송 대장', tickets: 5, gems: 20 },
    { id: 'case3', group: '사건', name: '기억의 끝', desc: '사건 3 종결', need: function (s) { return closed(s, 3); }, goal: 1, title: '면통실의 눈', tickets: 8, gems: 30 },
    { id: 'star5', group: '파트너', name: '★5 단짝', desc: '★5 파트너 1마리', need: function (s) { return starCount(s, 5); }, goal: 1, title: '단짝 조련사', tickets: 3 },
    { id: 'legend5', group: '파트너', name: '전설의 무리', desc: '전설 파트너 5마리', need: function (s) { return petCount(s, 'l'); }, goal: 5, title: '전설 사냥꾼', tickets: 6, gems: 30 },
    { id: 'closet3', group: '파트너', name: '옷장 정리', desc: '파트너 옷 3벌 모으기', need: function (s) { return s.pets && s.pets.closet ? Object.keys(s.pets.closet).length : 0; }, goal: 3, title: '패셔니스타', tickets: 2 },
    { id: 'pull500', group: '파트너', name: '뽑기의 달인', desc: '뽑기 500번', need: function (s) { return s.pets && s.pets.pulls || 0; }, goal: 500, title: '뽑기의 달인', tickets: 10, gems: 30 },
    // 0.7.0 난이도 미제 사건 전용(칭호도 미제 전용)
    { id: 'stepup', group: '난이도', name: '현장 승급', desc: '단순 사건으로 출동해 본 뒤 강력 사건 이상으로 출동', need: function (s) { return s.diff && s.diff.stepUp ? 1 : 0; }, goal: 1, title: '현장 승급', tickets: 2 },
    { id: 'hard1', group: '난이도', name: '미제 전담반', desc: '미제 사건으로 출동 1번', need: function (s) { return s.diff && s.diff.hardRuns || 0; }, goal: 1, title: '미제 전담', tickets: 2 },
    { id: 'hard50', group: '난이도', name: '식지 않는 사건', desc: '미제 사건으로 출동 50번', need: function (s) { return s.diff && s.diff.hardRuns || 0; }, goal: 50, title: '콜드 케이스 헌터', tickets: 5, gems: 20 },
    { id: 'hardgold', group: '난이도', name: '미제의 금빛', desc: '미제 사건으로 특별 출동 금메달 3번', need: function (s) { return s.diff && s.diff.hardGold || 0; }, goal: 3, title: '미제의 금빛', tickets: 5, gems: 20 },
    { id: 'hardcase', group: '난이도', name: '미제를 풀다', desc: '미제 사건 난이도로 사건 종결', need: function (s) { return s.diff && s.diff.hardCase ? Object.keys(s.diff.hardCase).length : 0; }, goal: 1, title: '미제 해결사', tickets: 8, gems: 30 }
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
    var d = save.ach && typeof save.ach === 'object' ? save.ach : {}, a = { got: {}, claimed: {}, bought: {}, title: '', pet: {}, stat: { dailyMedals: 0, dailyGold: 0 } };
    var got = d.got && typeof d.got === 'object' ? d.got : {};
    Object.keys(got).forEach(function (k) { if (got[k] === true && BY_ID[k]) a.got[k] = true; });
    // 0.6.0 보상은 눌러서 받는다(claimed). 예전 저장(claimed 없음)은 달성 때 이미 받았으므로 모두 받은 것으로
    var cl = d.claimed && typeof d.claimed === 'object' ? d.claimed : null;
    Object.keys(a.got).forEach(function (k) { if (!cl || cl[k] === true) a.claimed[k] = true; });
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
      return { a: x, value: Math.min(v, x.goal), done: !!a.got[x.id], ready: !a.got[x.id] && v >= x.goal, claim: !!a.got[x.id] && !a.claimed[x.id] };
    });
  }
  /**
   * 새로 달성한 업적을 표시한다(칭호는 바로 쓸 수 있다). 0.6.0: 보상은 바로 주지 않고 claim 으로 받는다(빨간 점).
   * 반환: 새로 달성한 업적 목록
   */
  function check(save) {
    var a = A(save), out = [];
    status(save).forEach(function (r) {
      if (!r.ready) return;
      a.got[r.a.id] = true;
      out.push(r.a);
    });
    return out;
  }
  /** 받을 보상이 남은 업적 수 */
  function unclaimed(save) { var a = A(save); return Object.keys(a.got).filter(function (k) { return !a.claimed[k]; }).length; }
  /** 보상 받기. id 없으면 모두. 반환 { n, tickets, gems } */
  function claim(save, id, addTickets) {
    var a = A(save), ids = id ? [id] : Object.keys(a.got).filter(function (k) { return !a.claimed[k]; }), out = { n: 0, tickets: 0, gems: 0 };
    if (id && !a.got[id]) throw AchError('NOT_DONE', '아직 달성 안 한 업적');
    if (id && a.claimed[id]) throw AchError('ALREADY', '이미 받은 보상');
    ids.forEach(function (k) {
      var x = BY_ID[k]; if (!x || a.claimed[k]) return;
      a.claimed[k] = true; out.n += 1;
      if (x.gems) { save.gems = (save.gems || 0) + x.gems; out.gems += x.gems; }
      if (x.tickets) { out.tickets += x.tickets; if (typeof addTickets === 'function') addTickets(save, x.tickets); }
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
    if (!(save.pets && save.pets.own && save.pets.own[key])) throw AchError('NOT_OWNED', '없는 파트너');
    if (id && !has(save, id)) throw AchError('LOCKED', '아직 없는 칭호');
    if (id) a.pet[key] = id; else delete a.pet[key];
    return id || '';
  }
  function leaderTitle(save) { var a = save.ach; return a && a.title ? titleText(a.title) : ''; }
  function petTitle(save, key) { var a = save.ach; return a && a.pet && a.pet[key] ? titleText(a.pet[key]) : ''; }
  function progress(save) { var a = A(save); return { have: Object.keys(a.got).length, total: LIST.length }; }

  return {
    LIST: LIST, SHOP: SHOP, BY_ID: BY_ID, TITLE_MAX: TITLE_MAX,
    clean: clean, status: status, check: check, claim: claim, unclaimed: unclaimed, noteDaily: noteDaily, buy: buy, has: has, owned: owned, titleText: titleText,
    setTitle: setTitle, setPetTitle: setPetTitle, leaderTitle: leaderTitle, petTitle: petTitle, progress: progress
  };
});
