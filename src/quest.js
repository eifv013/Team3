/*
 * Team3Quest — 일간 · 주간 · 월간 임무(0.10.3). 화면 · 시계와 무관한 규칙만.
 *   일어난 일을 track(save, 종류, 수, 날짜)로 세고, 목표를 채운 임무는 claim 으로 받는다.
 *   일간은 날마다, 주간은 월요일마다, 월간은 1일마다 새로 센다.
 *   일간 임무를 다 받으면 "일간 완료 상자"(뽑기권)를 하나 더 받는다.
 * 종류: run(출동) · daily(특별 출동 참가) · gold(특별 출동 금메달) · caught(현장 검거 수) · pat(쓰다듬기) ·
 *       ad(광고 보기) · hire(형사 영입) · pull(뽑기 횟수) · attend(출석) · evid(증거 열기) · retreat(재수사)
 * 저장: save.quest = { d: {key, n:{}, got:{}}, w: {...}, m: {...} }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Team3Quest = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var LIST = {
    d: [
      { id: 'd_run', kind: 'run', goal: 3, name: '현장 출동 3번', r: { gems: 5 } },
      { id: 'd_daily', kind: 'daily', goal: 1, name: '오늘의 특별 출동', r: { treats: 10 } },
      { id: 'd_pat', kind: 'pat', goal: 1, name: '파트너 쓰다듬기', r: { treats: 5 } },
      { id: 'd_ad', kind: 'ad', goal: 2, name: '광고 보상 2번 받기', r: { gems: 5 } },
      { id: 'd_hire', kind: 'hire', goal: 1, name: '형사 영입하기', r: { gems: 3 } }
    ],
    w: [
      { id: 'w_run', kind: 'run', goal: 20, name: '현장 출동 20번', r: { tickets: 2 } },
      { id: 'w_caught', kind: 'caught', goal: 300, name: '현장에서 300명 검거', r: { gems: 30 } },
      { id: 'w_daily', kind: 'daily', goal: 5, name: '특별 출동 5번', r: { tickets: 2 } },
      { id: 'w_pull', kind: 'pull', goal: 10, name: '파트너 뽑기 10번', r: { treats: 40 } },
      { id: 'w_attend', kind: 'attend', goal: 5, name: '출석 5일', r: { tickets: 1, gems: 20 } }
    ],
    m: [
      { id: 'm_run', kind: 'run', goal: 80, name: '현장 출동 80번', r: { tickets: 5 } },
      { id: 'm_gold', kind: 'gold', goal: 10, name: '특별 출동 금메달 10번', r: { tickets: 5, gems: 50 } },
      { id: 'm_evid', kind: 'evid', goal: 5, name: '증거 5개 열기', r: { gems: 60 } },
      { id: 'm_attend', kind: 'attend', goal: 20, name: '출석 20일', r: { tickets: 5, gems: 100 } },
      { id: 'm_ad', kind: 'ad', goal: 60, name: '광고 보상 60번 받기', r: { tickets: 3, treats: 60 } }
    ]
  };
  var DAILY_BOX = { tickets: 1 };   // 일간 임무를 다 받으면
  // 0.10.9 주간 · 월간에도 완료 상자(다 한 보람이 있게)
  var BOX = { d: DAILY_BOX, w: { tickets: 3, gems: 30 }, m: { tickets: 10, gems: 100 } };
  var NAME = { d: '일간', w: '주간', m: '월간' };
  var DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

  function keyOf(scope, day) {
    var m = DAY_RE.exec(day || ''); if (!m) throw new Error('BAD_DAY');
    if (scope === 'd') return day;
    if (scope === 'm') return m[1] + '-' + m[2];
    // 주간: 그 주 월요일 날짜
    var t = Date.UTC(+m[1], +m[2] - 1, +m[3]), dow = (new Date(t).getUTCDay() + 6) % 7, mon = new Date(t - dow * 864e5);
    return mon.toISOString().slice(0, 10);
  }
  function clean(save) {
    var q = save.quest && typeof save.quest === 'object' ? save.quest : {}, out = {};
    ['d', 'w', 'm'].forEach(function (sc) {
      var x = q[sc] && typeof q[sc] === 'object' ? q[sc] : {}, n = {}, got = {};
      var xn = x.n && typeof x.n === 'object' ? x.n : {}, xg = x.got && typeof x.got === 'object' ? x.got : {};
      Object.keys(xn).forEach(function (k) { var v = Math.floor(+xn[k]); if (isFinite(v) && v > 0) n[k] = Math.min(v, 1e9); });
      Object.keys(xg).forEach(function (k) { if (xg[k] === true) got[k] = true; });
      out[sc] = { key: typeof x.key === 'string' ? x.key : '', n: n, got: got, box: x.box === true };
    });
    save.quest = out;
    return out;
  }
  function scope(save, sc, day) {
    var q = save.quest || clean(save), k = keyOf(sc, day);
    if (q[sc].key !== k) q[sc] = { key: k, n: {}, got: {}, box: false };
    return q[sc];
  }
  /** 일어난 일을 센다 */
  function track(save, kind, n, day) {
    n = n == null ? 1 : n;
    if (!(n > 0)) return;
    ['d', 'w', 'm'].forEach(function (sc) { var s = scope(save, sc, day); s.n[kind] = (s.n[kind] || 0) + n; });
  }
  /** 화면용 목록 */
  function list(save, sc, day) {
    var s = scope(save, sc, day);
    return LIST[sc].map(function (x) {
      var v = Math.min(x.goal, s.n[x.kind] || 0);
      return { id: x.id, name: x.name, goal: x.goal, n: v, r: x.r, done: v >= x.goal, got: !!s.got[x.id] };
    });
  }
  function boxState(save, day, sc) {
    sc = BOX[sc] ? sc : 'd';
    var s = scope(save, sc, day), all = LIST[sc].every(function (x) { return s.got[x.id]; }), n = LIST[sc].filter(function (x) { return s.got[x.id]; }).length;
    return { ready: all && !s.box, got: s.box, r: BOX[sc], n: n, total: LIST[sc].length };
  }
  /** 받을 수 있는 임무 수(상자 포함) */
  function ready(save, day) {
    var c = 0;
    ['d', 'w', 'm'].forEach(function (sc) { list(save, sc, day).forEach(function (x) { if (x.done && !x.got) c++; }); });
    return c + ['d', 'w', 'm'].filter(function (sc) { return boxState(save, day, sc).ready; }).length;
  }
  function give(save, r, grant) {
    if (r.gems) save.gems = (save.gems || 0) + r.gems;
    if (typeof grant === 'function') { if (r.tickets) grant('tickets', r.tickets); if (r.treats) grant('treats', r.treats); }
  }
  /** 임무 하나 받기(id) 또는 'box'(일간 완료 상자). 반환: 보상 */
  function claim(save, id, day, grant) {
    var err = function (c) { var e = new Error(c); e.code = c; return e; };
    if (id === 'box' || /^box:[dwm]$/.test(id)) {   // 'box' = 일간(예전 이름), 'box:w' · 'box:m' = 주간 · 월간
      var bs = id === 'box' ? 'd' : id.slice(4), b = boxState(save, day, bs);
      if (!b.ready) throw err(b.got ? 'ALREADY' : 'NOT_DONE');
      scope(save, bs, day).box = true; give(save, BOX[bs], grant); return BOX[bs];
    }
    var sc = id.charAt(0), x = (LIST[sc] || []).filter(function (q) { return q.id === id; })[0];
    if (!x) throw err('BAD_ID');
    var s = scope(save, sc, day);
    if (s.got[id]) throw err('ALREADY');
    if ((s.n[x.kind] || 0) < x.goal) throw err('NOT_DONE');
    s.got[id] = true; give(save, x.r, grant); return x.r;
  }
  return { LIST: LIST, NAME: NAME, DAILY_BOX: DAILY_BOX, BOX: BOX, keyOf: keyOf, clean: clean, track: track, list: list, boxState: boxState, ready: ready, claim: claim };
});
