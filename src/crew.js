/*
 * Team3Crew(0.8.0) — 팀 탭 · 출동 탭을 채우는 세 가지. 화면 · 시계와 무관하다(그림은 crewui.js).
 *
 *   팀원 직무(ROLES): 사건마다 2개씩 열린다(그 사건에 오면 열리고, 다음 사건에서도 계속 남는다). 여러 단계 영입 · 값이 점점 오른다.
 *   공용 장비(KITS): 사건마다 2개씩 열리는 출동 장비. 몇 단계까지 장착. 효과는 출동에 바로 붙는 것(시간 · 오인 면제 · 연속 상한 · 오인 벌점 · 출동 수사비).
 *   수사 기법(TECHS): 증거 카드 한 장 = 기법 하나(51개). 그 증거를 얻으면 열리고 수사비로 10단계까지.
 *
 *   효과는 모두 증거판 · 동물과 같은 갈래(bonus 키)로 넘긴다: speed · idle · pay · dept(%) · cap(분) · off(%p) · gear(%) · buff(초) · time(초) · combo · shield(번) · miss(초).
 *   재수사하면: 단계는 처음부터(reset), 열린 칸(사건 · 증거)은 남는다.
 *
 * save.crew = { r: { 직무: 단계 }, k: { 장비: 단계 }, t: { 증거 id: 단계 }, seen: { 'r:id' | 'k:id' | 't:id': true } }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Team3Crew = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // [id, 사건, 이름, 아이콘, 한 줄, 효과 키, 단계마다, 첫 값, 오름, 최대]
  var ROLES = [
    ['mentor', 1, '신참 교육관', '🧑‍🏫', '새 형사를 빨리 키워요', 'idle', 3, 2500, 1.2, 20],
    ['stake', 1, '잠복조', '🔭', '자리를 비워도 계속 지켜봐요', 'cap', 10, 4000, 1.35, 12],
    ['coast', 2, '해경 연락관', '⚓', '항구 쪽 제보를 모아요', 'idle', 3, 12000, 1.2, 20],
    ['canvass', 2, '탐문 전담', '🚪', '집집마다 문을 두드려요', 'speed', 2, 18000, 1.2, 20],
    ['profiler', 3, '프로파일러', '🧠', '범인의 다음 수를 읽어요', 'pay', 4, 90000, 1.22, 20],
    ['night', 3, '야간 추적조', '🌙', '밤에도 쉬지 않아요', 'off', 1, 120000, 1.25, 20]
  ].map(function (a) { return { id: a[0], caseNo: a[1], name: a[2], icon: a[3], desc: a[4], key: a[5], per: a[6], base: a[7], grow: a[8], max: a[9] }; });

  // [id, 사건, 이름, 아이콘, 한 줄, 효과 키, 단계마다, 값들]
  var KITS = [
    ['radio', 1, '무전기 세트', '📻', '오인 체포를 한 번 막아 줘요', 'shield', 1, [5000, 20000]],
    ['notebook', 1, '수사 수첩', '📒', '현장 기록이 수사비가 돼요', 'pay', 5, [3000, 9000, 27000]],
    ['drone', 2, '수중 드론', '🚁', '현장을 더 오래 살펴요', 'time', 3, [25000, 75000, 225000]],
    ['bodycam', 2, '보디캠', '📹', '오인 체포 벌점이 줄어요', 'miss', 0.5, [40000, 120000]],
    ['thermal', 3, '열화상 카메라', '🌡️', '연속 검거를 더 길게 이어요', 'combo', 1, [150000, 600000]],
    ['command', 3, '지휘 차량', '🚐', '현장 지휘로 수사비가 늘어요', 'pay', 8, [200000, 600000, 1800000]]
  ].map(function (a) { return { id: a[0], caseNo: a[1], name: a[2], icon: a[3], desc: a[4], key: a[5], per: a[6], costs: a[7] }; });

  // 수사 기법: 증거 id → [이름, 아이콘]. 효과 키는 그 증거 효과를 따른다(재수사 전용 효과는 팀 쪽으로 바꿈)
  var TECH_NAME = {
    print: ['지문 감식 교육', '🖐️'], witness: ['면담 기법', '🗣️'], glove: ['혈흔 분석', '🧤'], cctv: ['CCTV 판독반', '📷'], tape: ['음성 분석', '📼'],
    log: ['통신 수사', '📞'], receipt: ['영수증 추적', '🧾'], bank: ['계좌 추적', '🏦'], coin: ['현금 흐름 분석', '👛'], key: ['잠복 근무', '🔑'],
    map: ['동선 그리기', '🗺️'], shoe: ['족적 분석', '👣'], hair: ['DNA 대조', '🧬'], alibi: ['알리바이 깨기', '⏰'], sketch: ['몽타주 복원', '🎨'],
    plate: ['차량 조회', '🚗'], email: ['디지털 복구', '💾'], gps: ['위치 추적', '📍'], ledger: ['장부 대조', '📒'], cash: ['돈세탁 추적', '💵'],
    card: ['법인 조사', '💳'], ticket: ['대중교통 추적', '🚌'], badge: ['출입 기록 조회', '🪪'], glass: ['파편 감식', '🔍'], diary: ['심리 분석', '📔'],
    photo3: ['인물 관계도', '🕸️'], voice: ['음성 변조 해제', '🎙️'], drone: ['항공 수색', '🛸'], server: ['서버 압수 수색', '🖥️'], radio: ['무전 감청', '📡'],
    crypto: ['가상 자산 추적', '🪙'], contract: ['위장 회사 조사', '📜'], auction: ['경매 기록 조회', '🔨'], ship: ['해운 조사', '🚢'], warehouse: ['창고 수색', '🏚️'],
    rope: ['매듭 감정', '🪢'], note3: ['필적 감정', '✍️'], scar: ['신체 특징 대조', '🩹'], team: ['옛 동료 탐문', '👥'], satellite: ['위성 분석', '🛰️'],
    cctvall: ['도시 관제', '🏙️'], blackbox: ['블랙박스 수집', '📦'], offshore: ['국제 공조 수사', '🌐'], bribe: ['내부 감찰', '🕵️'], gold: ['귀금속 추적', '🥇'],
    badge3: ['3팀의 전통', '⭐'], blueprint: ['건물 구조 분석', '📐'], frame: ['오래된 사건 복기', '🖼️'], stakeout: ['잠복 촬영', '📸'], roster: ['조직도 그리기', '🗂️'], fieldnote: ['현장 기록법', '📒'], coldbox: ['미제 파일 정리', '🗃️'], coldpost: ['공개 수배', '📰'], coldseal: ['봉인 증거 재감정', '🔏']
  };
  var TECH_KEY = { runHit: 'pay', capUp: 'speed', keep: 'idle', clue: 'idle', startMoney: 'idle', startDet: 'speed', shield: 'miss' };
  // 효과 키마다 단계당 값(10단계면 이것 × 10)
  var TECH_PER = { speed: 1, idle: 2, pay: 2, dept: 2, cap: 3, off: 1, gear: 1, buff: 2, time: 0.5, combo: 0.1, miss: 0.1 };
  var TECH_BASE = [2000, 25000, 300000, 3000000, 3000000], TECH_GROW = 1.55, TECH_MAX = 10;

  function CError(code, message) { var e = new Error(message); e.name = 'CrewError'; e.code = code; return e; }
  function int(v, lo, hi) { v = typeof v === 'number' && isFinite(v) ? Math.floor(v) : 0; return Math.max(lo, Math.min(hi, v)); }

  var EV = null;   // 증거 카드 목록(Team3Evidence) — 기법 목록을 만들 때 쓴다
  function evidence() {
    if (EV) return EV;
    EV = typeof module === 'object' && module.exports ? require('./evidence.js') : (typeof self !== 'undefined' ? self.Team3Evidence : null);
    return EV;
  }
  var TECHS = null;
  function techs() {
    if (TECHS) return TECHS;
    var Ev = evidence(); if (!Ev) return [];
    TECHS = Ev.CARDS.map(function (c) {
      var n = TECH_NAME[c.id] || [c.name + ' 분석', '🔎'], key = TECH_KEY[c.key] || c.key;
      return { id: c.id, card: c.name, color: c.color, tier: c.tier, name: n[0], icon: n[1], key: key, per: TECH_PER[key] || 1, base: TECH_BASE[c.tier] || TECH_BASE[0], grow: TECH_GROW, max: TECH_MAX };
    });
    return TECHS;
  }
  var R_BY = {}, K_BY = {};
  ROLES.forEach(function (x) { R_BY[x.id] = x; });
  KITS.forEach(function (x) { K_BY[x.id] = x; });

  function clean(save) {
    var d = save.crew && typeof save.crew === 'object' ? save.crew : {}, r = {}, k = {}, t = {}, seen = {};
    ROLES.forEach(function (x) { r[x.id] = int(d.r && d.r[x.id], 0, x.max); });
    KITS.forEach(function (x) { k[x.id] = int(d.k && d.k[x.id], 0, x.costs.length); });
    techs().forEach(function (x) { t[x.id] = int(d.t && d.t[x.id], 0, x.max); });
    var ds = d.seen && typeof d.seen === 'object' ? d.seen : {};
    Object.keys(ds).forEach(function (q) { if (ds[q] === true && /^[rkt]:[a-z0-9]{1,16}$/.test(q)) seen[q] = true; });
    save.crew = { r: r, k: k, t: t, seen: seen };
    return save.crew;
  }
  function C(save) { return save.crew && save.crew.r && save.crew.t ? save.crew : clean(save); }
  function caseNo(save) { return save.caseNo >= 1 ? save.caseNo : 1; }

  /* ---------- 무엇이 열렸나 ---------- */
  function rolesOpen(save) { var n = caseNo(save); return ROLES.filter(function (x) { return x.caseNo <= n; }); }
  function kitsOpen(save) { var n = caseNo(save); return KITS.filter(function (x) { return x.caseNo <= n; }); }
  function rolesNext(save) { var n = caseNo(save); return ROLES.filter(function (x) { return x.caseNo === n + 1; }); }
  function kitsNext(save) { var n = caseNo(save); return KITS.filter(function (x) { return x.caseNo === n + 1; }); }
  function techOpen(save, id) { var e = save.evid; return !!(e && e.own && e.own[id]); }
  function techsOpen(save) { return techs().filter(function (x) { return techOpen(save, x.id); }); }
  function techsLocked(save) { return techs().filter(function (x) { return !techOpen(save, x.id); }); }

  /* ---------- 값 ---------- */
  function disc(save, d) { return 1 - Math.min(0.5, Math.max(0, d || 0) / 100); }
  function roleCost(save, id, d) { var x = R_BY[id], l = C(save).r[id]; return !x || l >= x.max ? null : Math.round(x.base * Math.pow(x.grow, l) * disc(save, d)); }
  function kitCost(save, id, d) { var x = K_BY[id], l = C(save).k[id]; return !x || l >= x.costs.length ? null : Math.round(x.costs[l] * disc(save, d)); }
  function techById(id) { var a = techs(); for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i]; return null; }
  function techCost(save, id) { var x = techById(id), l = C(save).t[id]; return !x || l >= x.max ? null : Math.round(x.base * Math.pow(x.grow, l)); }

  /**
   * 사기. kind: 'r' 직무 · 'k' 장비 · 't' 기법. d: 장비 할인 %(직무 · 장비만). 반환 새 단계
   *   열리지 않았거나 다 올렸거나 수사비가 모자라면 오류(save 는 그대로).
   */
  function buy(save, kind, id, d) {
    var c = C(save), cost, open;
    if (kind === 'r') { open = R_BY[id] && R_BY[id].caseNo <= caseNo(save); cost = roleCost(save, id, d); }
    else if (kind === 'k') { open = K_BY[id] && K_BY[id].caseNo <= caseNo(save); cost = kitCost(save, id, d); }
    else if (kind === 't') { open = techById(id) && techOpen(save, id); cost = techCost(save, id); }
    else throw CError('BAD_KIND', '모르는 종류');
    if (!open) throw CError('LOCKED', '아직 안 열렸다');
    if (cost == null) throw CError('MAXED', '다 올렸다');
    if (save.money < cost) throw CError('NOT_ENOUGH', '수사비가 모자란다');
    save.money -= cost;
    c[kind][id] += 1;
    c.seen[kind + ':' + id] = true;
    return c[kind][id];
  }

  /* ---------- 효과 ---------- */
  function bonus(save) {
    var c = C(save), b = {};
    var add = function (k, v) { b[k] = (b[k] || 0) + v; };
    ROLES.forEach(function (x) { if (c.r[x.id]) add(x.key, x.per * c.r[x.id]); });
    KITS.forEach(function (x) { if (c.k[x.id]) add(x.key, x.per * c.k[x.id]); });
    techs().forEach(function (x) { if (c.t[x.id] && techOpen(save, x.id)) add(x.key, x.per * c.t[x.id]); });
    if (b.combo) b.combo = Math.floor(b.combo + 1e-9);
    if (b.time) b.time = Math.round(b.time * 2) / 2;
    if (b.miss) b.miss = Math.round(b.miss * 10) / 10;
    return b;
  }
  var NAME = { speed: '팀 속도', idle: '팀 수사비', pay: '출동 수사비', dept: '부서 수입', cap: '자리 비움 한도', off: '자리 비움 속도', gear: '장비 할인',
               buff: '사기 충전', time: '출동 시간', combo: '연속 배수 상한', shield: '오인 면제', miss: '오인 벌점' };
  var UNIT = { speed: '%', idle: '%', pay: '%', dept: '%', cap: '분', off: '%p', gear: '%', buff: '초', time: '초', combo: '', shield: '번', miss: '초' };
  function fmtV(v) { return String(Math.round(v * 10) / 10); }
  /** "팀 속도 +4%" 같은 한 줄. lv 단계일 때 */
  function effText(x, lv) { return NAME[x.key] + (x.key === 'miss' ? ' −' : ' +') + fmtV(x.per * lv) + UNIT[x.key]; }

  /* ---------- 새 칸 표시 ---------- */
  function isNew(save, kind, id) { return !C(save).seen[kind + ':' + id]; }
  function markSeen(save, kind, ids) { var c = C(save); ids.forEach(function (id) { c.seen[kind + ':' + id] = true; }); }
  function newCount(save, kind) {
    var list = kind === 'r' ? rolesOpen(save).filter(function (x) { return x.caseNo > 1 || save.caseNo > 1; }) : kind === 'k' ? kitsOpen(save) : techsOpen(save);
    return list.filter(function (x) { return isNew(save, kind, x.id); }).length;
  }

  /** 재수사: 단계만 처음부터(열린 칸 · 본 표시는 남는다) */
  function reset(save) {
    var c = C(save);
    Object.keys(c.r).forEach(function (k) { c.r[k] = 0; });
    Object.keys(c.k).forEach(function (k) { c.k[k] = 0; });
    Object.keys(c.t).forEach(function (k) { c.t[k] = 0; });
  }

  return { ROLES: ROLES, KITS: KITS, techs: techs, TECH_MAX: TECH_MAX, clean: clean, rolesOpen: rolesOpen, kitsOpen: kitsOpen, rolesNext: rolesNext, kitsNext: kitsNext,
           techsOpen: techsOpen, techsLocked: techsLocked, techById: techById, roleCost: roleCost, kitCost: kitCost, techCost: techCost, buy: buy, bonus: bonus,
           effText: effText, isNew: isNew, markSeen: markSeen, newCount: newCount, reset: reset, NAME: NAME, UNIT: UNIT };
});
