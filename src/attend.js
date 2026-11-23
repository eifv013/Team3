/*
 * Team3Attend — 출석 체크(0.10.2). 화면 · 시계와 무관한 규칙만.
 *   현실 달력 날짜로 한 달 판을 쓴다. 그날 들어와서 "출석"을 누르면 그 날짜 칸 보상을 받는다.
 *   지나간 날은 다시 받을 수 없다(달이 바뀌면 판이 새로 시작).
 *   특별한 날(7 · 14 · 21일, 그 달 마지막 날)은 더 좋은 보상: 뽑기권 묶음 · 배지 많이.
 * 저장: save.attend = { month: 'YYYY-MM', got: { '1': true, ... } }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Team3Attend = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

  function parts(day) {
    var m = DAY_RE.exec(day || '');
    if (!m) throw new Error('BAD_DAY');
    return { y: +m[1], m: +m[2], d: +m[3], month: m[1] + '-' + m[2] };
  }
  function daysIn(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  /** 그 달 1일의 요일(0 일요일) */
  function firstDow(y, m) { return new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); }

  /** 날짜 칸 보상. 특별한 날은 big: true */
  function reward(d, last) {
    if (d === last) return { big: true, tickets: 5, gems: 50 };
    if (d % 7 === 0) return { big: true, tickets: 2, gems: 20 };
    if (d % 2 === 1) return { treats: 10 };
    return { gems: 5 };
  }

  function clean(save) {
    var a = save.attend && typeof save.attend === 'object' ? save.attend : {}, out = { month: '', got: {} };
    if (typeof a.month === 'string' && /^\d{4}-\d{2}$/.test(a.month)) out.month = a.month;
    var g = a.got && typeof a.got === 'object' ? a.got : {};
    Object.keys(g).forEach(function (k) { if (/^\d{1,2}$/.test(k) && +k >= 1 && +k <= 31 && g[k] === true) out.got[String(+k)] = true; });
    save.attend = out;
    return out;
  }
  /** 이번 달 판(달이 바뀌었으면 새로) */
  function board(save, day) {
    var p = parts(day), a = save.attend || clean(save);
    if (a.month !== p.month) { a.month = p.month; a.got = {}; }
    var last = daysIn(p.y, p.m), cells = [];
    for (var d = 1; d <= last; d++) {
      cells.push({ d: d, r: reward(d, last), got: !!a.got[d], today: d === p.d, past: d < p.d, future: d > p.d });
    }
    return { month: p.month, y: p.y, m: p.m, today: p.d, last: last, dow: firstDow(p.y, p.m), cells: cells,
             done: !!a.got[p.d], count: Object.keys(a.got).length };
  }
  function canCheck(save, day) { return !board(save, day).done; }
  /** 오늘 출석. grant(kind, 값)으로 뽑기권 · 간식을 넘기고, 배지는 save.gems 에 더한다. 반환: 받은 보상 */
  function check(save, day, grant) {
    var b = board(save, day);
    if (b.done) { var e = new Error('ALREADY'); e.code = 'ALREADY'; throw e; }
    var r = reward(b.today, b.last);
    save.attend.got[b.today] = true;
    if (r.gems) save.gems = (save.gems || 0) + r.gems;
    if (typeof grant === 'function') { if (r.tickets) grant('tickets', r.tickets); if (r.treats) grant('treats', r.treats); }
    return r;
  }
  return { reward: reward, clean: clean, board: board, canCheck: canCheck, check: check, daysIn: daysIn };
});
