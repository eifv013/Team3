/*
 * Team3Office — 살아 있는 사무실(0.6.0)의 규칙. 화면 · 저장소와 무관하다(사무실 그림은 officeui.js).
 *
 * 유치장
 *   팀이 잡은 용의자는 유치장에 모인다(최대 CELL_CAP 명). 팀은 유치장이 차도 계속 일한다 — 벌은 없다.
 *   "이송"을 누르면 모인 수만큼 보너스 수사비(1명당 payPerCatch × TRANSFER_MULT)를 받고 유치장이 빈다.
 *   그래서 자리를 비웠다 돌아오면 가득 찬 유치장을 비우는 맛이 있고, 너무 오래 두면 보너스가 20명에서 멈춘다.
 *
 * 커피
 *   형사 책상을 누르면 그 형사에게 커피: 바로 수사비 payPerCatch × COFFEE_MULT, 유치장 +1.
 *   책상마다 COFFEE_COOL 초에 한 번. 책상 수 = min(형사 수, DESKS). 사건 진척(검거 수)에는 넣지 않는다.
 *
 * save.office = { cell: 0~CELL_CAP, sent: 이송한 누적 명수, cups: { 책상번호: 마지막 커피 ms } }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Team3Office = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CELL_CAP = 20;
  var TRANSFER_MULT = 1;    // 이송 보너스 = 모인 수 × 1명 수사비 × 1 (팀이 이미 번 몫에 한 번 더)
  var DESKS = 8;            // 사무실에 보이는 책상 수
  var COFFEE_COOL = 300;    // 책상마다 커피 간격(초)
  var COFFEE_MULT = 1;

  function OError(code, message) { var e = new Error(message); e.name = 'OfficeError'; e.code = code; return e; }
  function int(v, d, lo, hi) { v = typeof v === 'number' && isFinite(v) ? Math.floor(v) : d; return Math.max(lo, Math.min(hi, v)); }

  /** 저장 값 바로잡기(없거나 깨졌으면 새로) */
  function clean(save) {
    var o = save.office && typeof save.office === 'object' ? save.office : {};
    var cups = {};
    if (o.cups && typeof o.cups === 'object') Object.keys(o.cups).forEach(function (k) {
      var i = parseInt(k, 10), t = o.cups[k];
      if (i >= 0 && i < DESKS && typeof t === 'number' && isFinite(t) && t > 0) cups[i] = t;
    });
    var names = {};   // 0.10.5 자리마다 형사 이름(바꾼 것만)
    if (o.names && typeof o.names === 'object') Object.keys(o.names).forEach(function (k) {
      var i = parseInt(k, 10), v = cleanName(o.names[k]);
      if (i >= 0 && i < DESKS && v) names[i] = v;
    });
    save.office = { cell: int(o.cell, 0, 0, CELL_CAP), sent: int(o.sent, 0, 0, 1e12), cups: cups, names: names };
    return save.office;
  }
  /* 0.10.5 형사 이름: 기본은 자리마다 성 + "형사", 바꾸면 8자까지(무료) */
  var NAME_MAX = 8, DEFAULT_NAMES = ['김 형사', '이 형사', '박 형사', '최 형사', '정 형사', '강 형사', '조 형사', '윤 형사'];
  function cleanName(v) {
    if (typeof v !== 'string') return '';
    v = v.replace(/[\u0000-\u001F\u007F<>]/g, '').replace(/\s+/g, ' ').trim();
    return Array.from(v).slice(0, NAME_MAX).join('');
  }
  function copName(save, i) { var o = O(save); return (o.names && o.names[i]) || DEFAULT_NAMES[i] || (i + 1) + '번 형사'; }
  /** 이름 바꾸기. 빈 값이나 기본 이름이면 기본으로 되돌린다. 반환: 바뀐 이름 */
  function renameCop(save, i, v) {
    if (!(i >= 0 && i < DESKS)) throw OError('BAD_DESK', '없는 자리');
    var o = O(save); if (!o.names) o.names = {};
    v = cleanName(v);
    if (!v || v === DEFAULT_NAMES[i]) delete o.names[i]; else o.names[i] = v;
    return copName(save, i);
  }
  function O(save) { return save.office && typeof save.office.cell === 'number' ? save.office : clean(save); }

  /** 팀이 잡은 n명을 유치장에. 반환: 실제로 들어간 수 */
  function addCatches(save, n) {
    var o = O(save);
    n = int(n, 0, 0, 1e9);
    var room = CELL_CAP - o.cell, put = Math.min(room, n);
    o.cell += put;
    return put;
  }
  function isFull(save) { return O(save).cell >= CELL_CAP; }

  /** 이송: 모인 수만큼 보너스. pay = 1명 수사비(idle.payPerCatch). 반환 { n, bonus } */
  function transfer(save, pay) {
    var o = O(save);
    if (!(pay >= 0)) throw OError('BAD_PAY', '1명 수사비가 이상하다');
    if (o.cell <= 0) throw OError('EMPTY', '유치장이 비었다');
    var n = o.cell, bonus = Math.round(n * pay * TRANSFER_MULT);
    o.cell = 0; o.sent += n;
    save.money = (save.money || 0) + bonus;
    return { n: n, bonus: bonus };
  }

  function deskCount(save) { return Math.max(0, Math.min(DESKS, save.detectives || 0)); }
  /** 책상 i 의 커피까지 남은 초(0 이면 지금 가능) */
  function coffeeLeft(save, i, now) {
    var t = O(save).cups[i];
    return t ? Math.max(0, COFFEE_COOL - (now - t) / 1000) : 0;
  }
  /** 커피: 반환 { gain, cell(유치장에 들어갔나) } */
  function coffee(save, i, now, pay) {
    if (typeof now !== 'number' || !isFinite(now)) throw OError('BAD_TIME', 'now 는 밀리초');
    if (!(i >= 0 && i < deskCount(save) && Math.floor(i) === i)) throw OError('BAD_DESK', '없는 책상: ' + i);
    if (coffeeLeft(save, i, now) > 0) throw OError('COOLDOWN', '아직 커피를 마시는 중');
    if (!(pay >= 0)) throw OError('BAD_PAY', '1명 수사비가 이상하다');
    var gain = Math.round(pay * COFFEE_MULT);
    O(save).cups[i] = now;
    save.money = (save.money || 0) + gain;
    return { gain: gain, cell: addCatches(save, 1) === 1 };
  }

  /*
   * 창밖 날씨(0.6.0). 실제 날짜로 하면 몇 달 동안 한 계절만 보게 되므로:
   *   계절 = 사건 진척(0~25% 봄 · ~50% 여름 · ~75% 가을 · 그 뒤 겨울). 사건 하나에 네 계절, 다음 사건은 다시 봄.
   *   날씨 = 20분 칸마다 바뀐다(같은 20분 안에서는 늘 같음 — 시각으로 정한 난수). 그 계절에 맞는 것만.
   *     봄: 벚꽃 · 봄비 · 맑음   여름: 맑음 · 소나기 · 장맛비   가을: 단풍 · 낙엽 · 가을비   겨울: 눈 · 함박눈 · 맑음
   *   낮 · 저녁 · 밤은 실제 시각. 사건 2(해무항)는 늘 안개, 비가 더 잦다.
   * 반환 { season, kind: 'petal'|'rain'|'leaf'|'snow'|'clear', time: 'day'|'dusk'|'night', amount: 0~1, fog? }
   */
  var WEATHER_SLOT = 20 * 60 * 1000;
  var SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  var KINDS = {   // [종류, 무게]
    spring: [['petal', 5], ['rain', 2], ['clear', 2]],
    summer: [['clear', 4], ['rain', 4]],
    autumn: [['leaf', 6], ['rain', 2], ['clear', 1]],
    winter: [['snow', 6], ['clear', 2]]
  };
  function slotRand(slot, salt) {
    var x = (slot * 2654435761 + (salt || 0) * 40503) >>> 0;
    x = (x ^ (x >>> 13)) >>> 0; x = Math.imul(x, 1274126177) >>> 0; x = (x ^ (x >>> 16)) >>> 0;
    return x / 4294967296;
  }
  function seasonOf(progress) { var p = Math.max(0, Math.min(0.9999, progress || 0)); return SEASONS[Math.floor(p * 4)]; }
  function weather(date, caseNo, progress) {
    var ms = date.getTime(), h = date.getHours(), slot = Math.floor(ms / WEATHER_SLOT) + (caseNo || 1) * 7;
    var time = h >= 7 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'dusk' : 'night';
    var season = seasonOf(progress), list = KINDS[season].slice();
    if (caseNo === 2) list = list.map(function (k) { return k[0] === 'rain' ? [k[0], k[1] * 3] : k; });   // 해무항: 비가 잦다
    var tot = list.reduce(function (a, k) { return a + k[1]; }, 0), r = slotRand(slot, 1) * tot, kind = list[0][0];
    for (var i = 0; i < list.length; i++) { if (r < list[i][1]) { kind = list[i][0]; break; } r -= list[i][1]; }
    var w = { season: season, kind: kind, time: time, amount: Math.round((0.45 + slotRand(slot, 2) * 0.55) * 100) / 100 };
    if (caseNo === 2) w.fog = true;
    return w;
  }

  return { CELL_CAP: CELL_CAP, weather: weather, seasonOf: seasonOf, WEATHER_SLOT: WEATHER_SLOT, TRANSFER_MULT: TRANSFER_MULT, DESKS: DESKS, COFFEE_COOL: COFFEE_COOL,
           clean: clean, copName: copName, renameCop: renameCop, NAME_MAX: NAME_MAX, addCatches: addCatches, isFull: isFull, transfer: transfer, deskCount: deskCount, coffeeLeft: coffeeLeft, coffee: coffee };
});
