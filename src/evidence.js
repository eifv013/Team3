/*
 * Team3Evidence — 재수사 · 단서 · 증거판(0.7.0). 화면 · 시계와 무관하다(그림은 evidui.js).
 *
 * 재수사(7구역식 재시작)
 *   이번 판에 번 수사비(runEarned)가 쌓이면 재수사할 수 있다. 받는 단서 = floor(∛(runEarned / CLUE_UNIT)) × (1 + 단서 효과).
 *   처음으로: 수사비 · 형사(1명) · 훈련 · 장비 · 부서 · 지금 사건의 진척(검거 수) · 유치장.
 *   남는 것: 사건 번호 · 닫은 사건 · 열어 본 일지(caseBest 로 계속 열려 있다) · 동물 · 배지 · 업적 · 계급 · 상점 · 프로필 · 단서 · 증거판.
 *
 * 증거판(코르크 보드)
 *   단서로 증거 카드를 산다(한 장씩, 다시 살 필요 없음). 산 카드는 단서로 강화(1 → 5단계): 효과 × 단계, 다음 단계 값 = 카드 값 × 다음 단계. 산 카드는 보드 칸에 핀으로 꽂아야 효과가 난다(옮기기는 공짜).
 *   같은 색 카드가 가로 · 세로로 이어지면 붉은 실로 묶여 그 묶음의 효과가 커진다: 2장 ×1.5 · 3~4장 ×2 · 5장 이상 ×2.5.
 *   보드는 5×8 칸(40). 처음엔 가운데 9칸, 재수사할수록 · 사건을 닫을수록 바깥으로 열린다.
 *   카드는 51장. 처음 12장, 재수사 2번 · 사건 1 종결 · 재수사 6번(또는 사건 2 종결)마다 12장씩 더 나온다.
 *   0.7.0: 미제 사건(난이도) 전용 3장 — 미제 사건으로 출동 10번이면 나온다.
 *
 * 효과 열쇠(동물 효과와 같은 갈래로 hub 가 합친다): speed 팀 속도 % · idle 팀 수사비 % · pay 출동 수사비 % · dept 부서 수입 % ·
 *   cap 자리 비움 한도 +분 · off 자리 비움 속도 +%p · gear 장비 할인 % · buff 사기 충전 +초 · time 출동 시간 +초 · combo 연속 배수 상한 + ·
 *   shield 오인 면제 +번 · miss 오인 벌점 −초 · startDet 재수사 뒤 형사 +명 · startMoney 재수사 뒤 수사비 + · clue 단서 +%
 *
 * save.evid = { clues, spent, own: {카드: true}, pins: {칸: 카드}, runEarned, retreats, log: [{at, gain, earned}], caseBest }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Team3Evidence = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CLUE_UNIT = 20000;
  var COLS = 5, ROWS = 8;   // 폰 세로 화면에서 칸이 읽히는 크기(한 칸 ≈ 55px)
  var COLOR = { r: { name: '사람 · 증언', hex: '#E5484F' }, b: { name: '기록 · 영상', hex: '#2F6FD6' }, y: { name: '돈 · 거래', hex: '#E0A100' }, g: { name: '장소 · 물건', hex: '#2E9E5B' } };
  var KEY_NAME = { speed: '팀 속도', idle: '팀 수사비', pay: '출동 수사비', dept: '부서 수입', cap: '자리 비움 한도', off: '자리 비움 속도', gear: '장비 할인',
                   buff: '사기 충전', time: '출동 시간', combo: '연속 배수 상한', shield: '오인 면제', miss: '오인 벌점', startDet: '재수사 뒤 형사', startMoney: '재수사 뒤 수사비', clue: '단서' };
  var UNIT = { speed: '%', idle: '%', pay: '%', dept: '%', cap: '분', off: '%p', gear: '%', buff: '초', time: '초', combo: '', shield: '번', miss: '초', startDet: '명', startMoney: '', clue: '%' };
  /* 카드: [id, 이름, 색, 효과, 값, 단서 값, 묶음(0 처음 · 1 재수사 2번 · 2 사건 1 종결 · 3 재수사 6번 또는 사건 2 종결)] */
  var RAW = [
    // 묶음 0 — 골목 사건의 흔한 증거
    ['print', '지문', 'r', 'speed', 10, 1, 0], ['witness', '목격자 진술', 'r', 'idle', 10, 1, 0], ['glove', '피 묻은 장갑', 'r', 'speed', 10, 2, 0],
    ['cctv', 'CCTV 사진', 'b', 'pay', 15, 1, 0], ['tape', '녹음 테이프', 'b', 'time', 5, 2, 0], ['log', '통화 기록', 'b', 'dept', 15, 1, 0],
    ['receipt', '영수증', 'y', 'idle', 10, 1, 0], ['bank', '계좌 내역', 'y', 'dept', 15, 2, 0], ['coin', '동전 지갑', 'y', 'startMoney', 300, 1, 0],
    ['key', '열쇠 꾸러미', 'g', 'cap', 30, 1, 0], ['map', '동네 지도', 'g', 'off', 5, 2, 0], ['shoe', '족적', 'g', 'speed', 8, 1, 0],
    // 묶음 1 — 재수사 2번
    ['hair', '머리카락', 'r', 'speed', 15, 3, 1], ['alibi', '깨진 알리바이', 'r', 'pay', 20, 2, 1], ['sketch', '몽타주', 'r', 'shield', 1, 4, 1],
    ['plate', '번호판 사진', 'b', 'dept', 20, 3, 1], ['email', '지운 메일', 'b', 'clue', 10, 4, 1], ['gps', 'GPS 기록', 'b', 'time', 5, 3, 1],
    ['ledger', '장부', 'y', 'idle', 20, 3, 1], ['cash', '현금 다발', 'y', 'startMoney', 2000, 2, 1], ['card', '법인 카드', 'y', 'gear', 10, 3, 1],
    ['ticket', '버스 승차권', 'g', 'cap', 45, 2, 1], ['badge', '낡은 출입증', 'g', 'buff', 30, 3, 1], ['glass', '유리 조각', 'g', 'speed', 12, 2, 1],
    // 묶음 2 — 사건 1 종결
    ['diary', '피의자 일기', 'r', 'idle', 25, 4, 2], ['photo3', '세 명의 사진', 'r', 'startDet', 2, 5, 2], ['voice', '변조 음성', 'r', 'miss', 1, 4, 2],
    ['drone', '드론 영상', 'b', 'pay', 25, 4, 2], ['server', '서버 로그', 'b', 'dept', 30, 5, 2], ['radio', '무전 기록', 'b', 'combo', 1, 6, 2],
    ['crypto', '코인 지갑', 'y', 'dept', 30, 5, 2], ['contract', '위장 계약서', 'y', 'idle', 25, 4, 2], ['auction', '경매 낙찰서', 'y', 'clue', 10, 6, 2],
    ['ship', '선적 목록', 'g', 'off', 10, 4, 2], ['warehouse', '창고 열쇠', 'g', 'cap', 60, 5, 2], ['rope', '밧줄 매듭', 'g', 'speed', 20, 4, 2],
    // 묶음 3 — 재수사 6번 또는 사건 2 종결
    ['note3', '써드의 쪽지', 'r', 'clue', 15, 8, 3], ['scar', '흉터 사진', 'r', 'speed', 30, 7, 3], ['team', '옛 3팀 명단', 'r', 'startDet', 3, 8, 3],
    ['satellite', '위성 사진', 'b', 'dept', 50, 8, 3], ['cctvall', '도시 CCTV 전체', 'b', 'pay', 40, 7, 3], ['blackbox', '블랙박스', 'b', 'time', 10, 8, 3],
    ['offshore', '해외 계좌', 'y', 'idle', 40, 8, 3], ['bribe', '뇌물 장부', 'y', 'gear', 15, 7, 3], ['gold', '금괴', 'y', 'startMoney', 30000, 6, 3],
    ['badge3', '3팀 배지', 'g', 'buff', 60, 7, 3], ['blueprint', '설계도', 'g', 'cap', 90, 8, 3], ['frame', '긁힌 액자', 'g', 'shield', 1, 10, 3],
    // 묶음 4(0.7.0) — 미제 사건 전용: 미제 사건으로 출동 10번
    ['coldbox', '미제 파일 상자', 'b', 'pay', 35, 6, 4], ['coldpost', '빛바랜 수배지', 'r', 'speed', 25, 6, 4], ['coldseal', '봉인된 증거 봉투', 'g', 'clue', 10, 7, 4]
  ];
  var CARDS = RAW.map(function (r) { return { id: r[0], name: r[1], color: r[2], key: r[3], value: r[4], cost: r[5], tier: r[6] }; });
  var BY_ID = {}; CARDS.forEach(function (c) { BY_ID[c.id] = c; });
  var MAX_LV = 5;

  function EError(code, message) { var e = new Error(message); e.name = 'EvidenceError'; e.code = code; return e; }
  function int(v, d, lo, hi) { v = typeof v === 'number' && isFinite(v) ? Math.floor(v) : d; return Math.max(lo, Math.min(hi, v)); }
  function closedCount(save) { return (save.past || []).length; }

  // 칸 여는 순서: 가운데(3,2)에서 가까운 칸부터(같은 거리면 위 → 왼쪽). 처음 9칸, 재수사마다 +2, 사건 종결마다 +4, 최대 42
  var ORDER = (function () {
    var cells = [];
    var cc = (COLS - 1) / 2, cr = (ROWS - 1) / 2;
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) cells.push({ i: r * COLS + c, d: Math.abs(c - cc) * 1.1 + Math.abs(r - cr) + (r < cr ? 0 : 0.01) });
    return cells.sort(function (a, b) { return a.d - b.d || a.i - b.i; }).map(function (x) { return x.i; });
  })();
  function openCount(save) { var e = E(save); return Math.min(COLS * ROWS, 9 + e.retreats * 2 + closedCount(save) * 4); }
  function isOpen(save, cell) { return ORDER.indexOf(cell) >= 0 && ORDER.indexOf(cell) < openCount(save); }
  function tierOpen(save, t) {
    var e = E(save);
    if (t === 0) return true;
    if (t === 1) return e.retreats >= 2;
    if (t === 2) return closedCount(save) >= 1;
    if (t === 3) return e.retreats >= 6 || closedCount(save) >= 2;
    return !!(save.diff && save.diff.hardRuns >= HARD_RUNS);   // 4: 미제 사건 전용(Team3Diff.HARD_CARD_RUNS 와 같은 값)
  }
  var HARD_RUNS = 10;

  function clean(save) {
    var d = save.evid && typeof save.evid === 'object' ? save.evid : {}, own = {}, pins = {}, lv = {};
    var dO = d.own && typeof d.own === 'object' ? d.own : {}, dP = d.pins && typeof d.pins === 'object' ? d.pins : {}, dL = d.lv && typeof d.lv === 'object' ? d.lv : {};
    Object.keys(dO).forEach(function (k) { if (dO[k] === true && BY_ID[k]) { own[k] = true; lv[k] = int(dL[k], 1, 1, MAX_LV); } });
    var used = {};
    Object.keys(dP).forEach(function (k) { var i = parseInt(k, 10), c = dP[k]; if (i >= 0 && i < COLS * ROWS && own[c] && !used[c]) { pins[i] = c; used[c] = 1; } });
    var log = Array.isArray(d.log) ? d.log.filter(function (x) { return x && typeof x === 'object'; }).slice(-20).map(function (x) { return { at: int(x.at, 0, 0, 9e15), gain: int(x.gain, 0, 0, 1e9), earned: int(x.earned, 0, 0, 1e18) }; }) : [];
    save.evid = { clues: int(d.clues, 0, 0, 1e9), spent: int(d.spent, 0, 0, 1e9), own: own, lv: lv, pins: pins, runEarned: Math.max(0, +d.runEarned || 0), retreats: int(d.retreats, 0, 0, 1e6), log: log,
                  caseBest: int(d.caseBest, 0, 0, 1e9) };
    if (save.evid.spent > save.evid.clues) save.evid.spent = save.evid.clues;
    return save.evid;
  }
  function E(save) { return save.evid && save.evid.own ? save.evid : clean(save); }
  function left(save) { var e = E(save); return e.clues - e.spent; }

  /** 번 수사비 기록(이번 판). 수사비가 들어오는 곳(팀 · 부서 · 출동 · 이송 · 커피)에서 부른다 */
  function earn(save, amount) { if (amount > 0 && isFinite(amount)) E(save).runEarned += amount; }

  /** 지금 재수사하면 받는 단서(효과 포함) */
  // 단서 = ∛(번 수사비 / CLUE_UNIT) — 수사비는 갈수록 크게 불어나므로 세제곱근으로(2만 → 1 · 16만 → 2 · 54만 → 3 · 2천만 → 10 · 20억 → 46)
  function baseGain(earned) { return Math.floor(Math.cbrt(earned / CLUE_UNIT) + 1e-9); }
  function gainNow(save) { var e = E(save), base = baseGain(e.runEarned); return base > 0 ? Math.floor(base * (1 + Math.min(100, effects(save).clue) / 100)) : 0; }   // 단서 효과는 +100% 까지
  /** 다음 단서 +1 까지 더 벌어야 하는 수사비(효과 전 기준) */
  function nextAt(save) { var e = E(save), b = baseGain(e.runEarned); return Math.pow(b + 1, 3) * CLUE_UNIT - e.runEarned; }

  /* ---------- 보드 · 묶음 ---------- */
  function groups(save) {
    var e = E(save), seen = {}, out = [];
    Object.keys(e.pins).forEach(function (k) {
      var i0 = +k; if (seen[i0]) return;
      var col = BY_ID[e.pins[i0]].color, st = [i0], mem = []; seen[i0] = 1;
      while (st.length) {
        var i = st.pop(), r = Math.floor(i / COLS), c = i % COLS; mem.push(i);
        [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].forEach(function (p) {
          if (p[0] < 0 || p[0] >= ROWS || p[1] < 0 || p[1] >= COLS) return;
          var j = p[0] * COLS + p[1];
          if (!seen[j] && e.pins[j] && BY_ID[e.pins[j]].color === col) { seen[j] = 1; st.push(j); }
        });
      }
      out.push({ color: col, cells: mem.sort(function (a, b) { return a - b; }), mult: groupMult(mem.length) });
    });
    return out;
  }
  function groupMult(n) { return n >= 5 ? 2.5 : n >= 3 ? 2 : n === 2 ? 1.5 : 1; }
  /** 이웃한 같은 색 쌍(붉은 실) [[칸, 칸]…] */
  function links(save) {
    var e = E(save), out = [];
    Object.keys(e.pins).forEach(function (k) {
      var i = +k, r = Math.floor(i / COLS), c = i % COLS, col = BY_ID[e.pins[i]].color;
      [[r, c + 1], [r + 1, c]].forEach(function (p) {
        if (p[0] >= ROWS || p[1] >= COLS) return;
        var j = p[0] * COLS + p[1];
        if (e.pins[j] && BY_ID[e.pins[j]].color === col) out.push([i, j]);
      });
    });
    return out;
  }
  /** 꽂힌 카드 효과 합(묶음 배수 반영). 반환 { speed: …, … } */
  function effects(save) {
    var e = E(save), out = {};
    Object.keys(KEY_NAME).forEach(function (k) { out[k] = 0; });
    groups(save).forEach(function (g) {
      g.cells.forEach(function (i) { var c = BY_ID[e.pins[i]]; out[c.key] += c.value * (e.lv[c.id] || 1) * g.mult; });
    });
    Object.keys(out).forEach(function (k) { out[k] = Math.round(out[k] * 10) / 10; });
    out.startDet = Math.floor(out.startDet); out.shield = Math.floor(out.shield); out.combo = Math.floor(out.combo); out.miss = Math.floor(out.miss);
    return out;
  }
  /** hub 의 동물 효과와 같은 모양(pay · idle · speed · cap · off · gear · buff · time · combo · shield · miss)으로 */
  // 재수사 경력: 재수사할 때마다 팀 속도 · 팀 수사비 · 출동 수사비 · 부서 수입 +RANK_PCT%(영구) — 카드가 없어도 다시 오를 때 조금씩 빨라진다
  var RANK_PCT = 10;
  function careerPct(save) { return E(save).retreats * RANK_PCT; }
  function bonus(save) {
    var f = effects(save), k = careerPct(save);
    return { pay: f.pay + k, idle: f.idle + k, speed: f.speed + k, cap: f.cap, off: f.off, gear: f.gear, buff: f.buff, time: f.time, combo: f.combo, shield: f.shield, miss: f.miss, dept: f.dept + k };
  }

  /* ---------- 카드 사기 · 꽂기 ---------- */
  function buyCard(save, id) {
    var e = E(save), c = BY_ID[id];
    if (!c) throw EError('BAD_CARD', '모르는 증거');
    if (!tierOpen(save, c.tier)) throw EError('LOCKED', '아직 안 나온 증거');
    if (e.own[id]) throw EError('ALREADY', '이미 가진 증거');
    if (left(save) < c.cost) throw EError('NOT_ENOUGH', '단서가 모자란다');
    e.own[id] = true; e.lv[id] = 1; e.spent += c.cost;
    return c;
  }
  /** 강화 값(다음 단계). 다 올렸으면 null */
  function upCost(save, id) { var e = E(save), c = BY_ID[id], l = e.lv[id] || 0; return !c || !e.own[id] || l >= MAX_LV ? null : c.cost * (l + 1); }
  function upgrade(save, id) {
    var e = E(save), c = BY_ID[id], k = upCost(save, id);
    if (!c || !e.own[id]) throw EError('NOT_OWNED', '가진 증거가 아니다');
    if (k == null) throw EError('MAXED', '다 올렸다');
    if (left(save) < k) throw EError('NOT_ENOUGH', '단서가 모자란다');
    e.lv[id] += 1; e.spent += k;
    return e.lv[id];
  }
  /** 꽂기: 같은 카드가 다른 칸에 있으면 옮긴다. 칸에 다른 카드가 있으면 자리를 바꾼다(옮겨 온 칸으로) */
  function pin(save, id, cell) {
    var e = E(save);
    if (!e.own[id]) throw EError('NOT_OWNED', '가진 증거가 아니다');
    if (!isOpen(save, cell)) throw EError('CLOSED_CELL', '아직 닫힌 칸');
    var from = null;
    Object.keys(e.pins).forEach(function (k) { if (e.pins[k] === id) from = +k; });
    var there = e.pins[cell];
    if (from != null) delete e.pins[from];
    if (there && from != null) e.pins[from] = there;
    e.pins[cell] = id;
    return { moved: from, swapped: there && from != null ? there : null, bumped: there && from == null ? there : null };
  }
  function unpin(save, cell) { var e = E(save); if (!e.pins[cell]) throw EError('EMPTY', '빈 칸'); var id = e.pins[cell]; delete e.pins[cell]; return id; }

  /* ---------- 재수사 ---------- */
  /**
   * 재수사: 단서를 받고 처음으로. idle 은 몰라서 부르는 쪽이 넘긴다: opts = { now, newTeam(save) — 형사 · 훈련 · 장비 · 수사비 · 진척을 처음으로 }
   * 반환 { gain, earned, startDet, startMoney }
   */
  function retreat(save, opts) {
    var e = E(save), g = gainNow(save);
    if (g < 1) throw EError('TOO_EARLY', '아직 단서를 받을 수 없다');
    var f = effects(save), earned = Math.round(e.runEarned);
    e.clues += g; e.retreats += 1;
    e.log = e.log.concat([{ at: opts && opts.now || 0, gain: g, earned: earned }]).slice(-20);
    e.runEarned = 0;
    if (opts && typeof opts.newTeam === 'function') opts.newTeam(save, { startDet: f.startDet, startMoney: f.startMoney });
    return { gain: g, earned: earned, startDet: f.startDet, startMoney: f.startMoney };
  }
  function lastGain(save) { var e = E(save); return e.log.length ? e.log[e.log.length - 1].gain : 0; }

  var SHORT = { speed: '속도', idle: '팀 수사비', pay: '출동 수사비', dept: '부서', cap: '비움 한도', off: '비움 속도', gear: '장비 할인', buff: '사기', time: '출동 시간', combo: '연속', shield: '면제', miss: '벌점', startDet: '시작 형사', startMoney: '시작 수사비', clue: '단서' };
  /** 보드 칸에 쓰는 짧은 효과 글 */
  function shortText(c, lv) { var v = c.value * (lv || 1); return SHORT[c.key] + (c.key === 'miss' ? ' −' : ' +') + (c.key === 'startMoney' ? (v >= 10000 ? (v / 10000) + '만' : v) : v) + (UNIT[c.key] === '%' || UNIT[c.key] === '%p' ? '%' : ''); }
  function describe(c, lv) {
    var v = c.value * (lv || 1), u = UNIT[c.key];
    var num = c.key === 'startMoney' ? v.toLocaleString('ko-KR') : String(v);
    return KEY_NAME[c.key] + (c.key === 'miss' ? ' −' : ' +') + num + u;
  }

  return { CLUE_UNIT: CLUE_UNIT, MAX_LV: MAX_LV, RANK_PCT: RANK_PCT, careerPct: careerPct, upCost: upCost, upgrade: upgrade, COLS: COLS, ROWS: ROWS, COLOR: COLOR, KEY_NAME: KEY_NAME, CARDS: CARDS, BY_ID: BY_ID, ORDER: ORDER,
           clean: clean, left: left, earn: earn, gainNow: gainNow, nextAt: nextAt, openCount: openCount, isOpen: isOpen, tierOpen: tierOpen,
           groups: groups, groupMult: groupMult, links: links, effects: effects, bonus: bonus, buyCard: buyCard, pin: pin, unpin: unpin,
           retreat: retreat, lastGain: lastGain, describe: describe, shortText: shortText };
});
