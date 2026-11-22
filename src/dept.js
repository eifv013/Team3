/*
 * Team3Dept — 수사 부서(0.7.0). 수사비를 버는 갈래를 여럿으로(방치형의 "돈 쓸 곳"). 화면 · 시계와 무관하다.
 *
 *   부서마다: 인원 n, 값(cost × growth^n), 한 바퀴 시간(sec), 한 바퀴에 버는 수사비(pay × n).
 *   인원 목표 10 · 25 · 50 · 100 · 200 을 채우면 그 부서 속도 ×2(바퀴 시간 절반).
 *   사건 진척(검거)은 형사(idle.js)와 출동으로만 오른다 — 부서는 돈을 번다. 그 돈으로 형사 · 훈련 · 장비 · 부서를 산다.
 *   돈은 연속으로 들어온다(초당 = Σ pay·n / 바퀴 시간). 화면의 막대는 보여 주기용(t = 지금 바퀴 진행).
 *   재수사(prestige.js)하면 부서 인원은 0 으로.
 *
 * save.dept = { n: { patrol: 0, … }, seen: { patrol: true, … } }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Team3Dept = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 0.7.0 균형(tools/sim.js): 1명당 초당 수입 ÷ 값 ≈ 순찰조 1/1500 · 분석관 1/2000 · 과학수사대 1/2500 · 특수수사대 1/2900 · 국제 공조 1/3300
  //   (형사 1명은 초당 0.1 정도 ÷ 300 ≈ 1/3000 이지만 사건 진척도 준다)
  var LIST = [
    { id: 'patrol',  name: '순찰조',     what: '골목 순찰 · 제보 수집', cost: 150,      growth: 1.13, sec: 2,   pay: 0.2 },
    { id: 'analyst', name: '분석관',     what: 'CCTV · 통화 기록 분석', cost: 2500,     growth: 1.14, sec: 8,   pay: 10 },
    { id: 'csi',     name: '과학수사대', what: '지문 · 흔적 감식',      cost: 40000,    growth: 1.15, sec: 24,  pay: 384 },
    { id: 'swat',    name: '특수수사대', what: '조직 소탕 작전',        cost: 600000,   growth: 1.15, sec: 60,  pay: 12400 },
    { id: 'intl',    name: '국제 공조',  what: '해외 도피범 수배',      cost: 9000000,  growth: 1.16, sec: 150, pay: 409000 }
  ];
  var BY_ID = {}; LIST.forEach(function (d) { BY_ID[d.id] = d; });
  var MILES = [10, 25, 50, 100, 200];
  var MAX = 999;

  function DError(code, message) { var e = new Error(message); e.name = 'DeptError'; e.code = code; return e; }
  function int(v, d, lo, hi) { v = typeof v === 'number' && isFinite(v) ? Math.floor(v) : d; return Math.max(lo, Math.min(hi, v)); }

  function clean(save) {
    var d = save.dept && typeof save.dept === 'object' ? save.dept : {}, n = {}, seen = {};
    var dn = d.n && typeof d.n === 'object' ? d.n : {}, ds = d.seen && typeof d.seen === 'object' ? d.seen : {};
    LIST.forEach(function (x, i) { n[x.id] = int(dn[x.id], 0, 0, MAX); seen[x.id] = i === 0 || ds[x.id] === true || n[x.id] > 0; });
    save.dept = { n: n, seen: seen };
    return save.dept;
  }
  function D(save) { return save.dept && save.dept.n ? save.dept : clean(save); }

  function mileMult(n) { var m = 1; MILES.forEach(function (x) { if (n >= x) m *= 2; }); return m; }
  function nextMile(n) { for (var i = 0; i < MILES.length; i++) if (n < MILES[i]) return MILES[i]; return null; }
  /** 한 바퀴 시간(초) */
  function cycle(save, id) { return BY_ID[id].sec / mileMult(D(save).n[id]); }
  /** n명에서 q명을 더 들일 때 값(할인 disc 0~0.5) */
  function cost(save, id, q, disc) {
    var x = BY_ID[id]; if (!x) throw DError('BAD_DEPT', '모르는 부서: ' + id);
    var n = D(save).n[id]; q = q || 1;
    var c = x.cost * Math.pow(x.growth, n) * (Math.pow(x.growth, q) - 1) / (x.growth - 1);
    return Math.round(c * (1 - Math.min(0.5, disc || 0)));
  }
  /** 지금 돈으로 들일 수 있는 최대 인원(최대 MAX 까지) */
  function maxBuy(save, id, money, disc) {
    var n = D(save).n[id], q = 0;
    while (n + q < MAX && cost(save, id, q + 1, disc) <= money) q++;
    return q;
  }
  /** 사기: 반환 { q, cost, mile(새로 넘은 목표, 없으면 0) } */
  function buy(save, id, q, disc) {
    var d = D(save), x = BY_ID[id];
    if (!x) throw DError('BAD_DEPT', '모르는 부서: ' + id);
    if (!d.seen[id]) throw DError('LOCKED', '아직 안 보이는 부서');
    if (!(q >= 1 && Math.floor(q) === q)) throw DError('BAD_COUNT', '1명 이상');
    if (d.n[id] + q > MAX) throw DError('MAXED', '더 들일 수 없다');
    var c = cost(save, id, q, disc);
    if (!(save.money >= c)) throw DError('NOT_ENOUGH', '수사비가 모자란다');
    var before = mileMult(d.n[id]);
    save.money -= c; d.n[id] += q;
    return { q: q, cost: c, mile: mileMult(d.n[id]) > before ? d.n[id] : 0 };
  }
  /** 초당 수입(배수 mult: 사건 배수 · 증거판 · 동물 등은 부르는 쪽이 곱해 넘긴다) */
  function perSec(save, mult) {
    var d = D(save), s = 0;
    LIST.forEach(function (x) { var n = d.n[x.id]; if (n) s += x.pay * n / (x.sec / mileMult(n)); });
    return s * (mult == null ? 1 : mult);
  }
  function perSecOf(save, id, mult) { var n = D(save).n[id]; return n ? BY_ID[id].pay * n / cycle(save, id) * (mult == null ? 1 : mult) : 0; }
  /** 수사비가 그 부서 값의 절반에 닿으면 보이게(한 번 보이면 계속). 새로 보인 부서 id 목록 */
  function reveal(save) {
    var d = D(save), out = [];
    LIST.forEach(function (x) { if (!d.seen[x.id] && save.money >= x.cost / 2) { d.seen[x.id] = true; out.push(x.id); } });
    return out;
  }
  /** 재수사: 인원은 0 으로(본 부서 목록은 남긴다) */
  function reset(save) { var d = D(save); LIST.forEach(function (x) { d.n[x.id] = 0; }); }
  function total(save) { var d = D(save), t = 0; LIST.forEach(function (x) { t += d.n[x.id]; }); return t; }

  return { LIST: LIST, BY_ID: BY_ID, MILES: MILES, MAX: MAX, clean: clean, mileMult: mileMult, nextMile: nextMile, cycle: cycle, cost: cost, maxBuy: maxBuy,
           buy: buy, perSec: perSec, perSecOf: perSecOf, reveal: reveal, reset: reset, total: total };
});
