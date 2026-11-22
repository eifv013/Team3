/*
 * Team3Diff — 난이도(0.7.0): 단순 사건 · 강력 사건 · 미제 사건. 화면 · 시계와 무관하다(그림은 diffui.js).
 *
 * 무엇이 바뀌나
 *   현장 출동(퍼즐)만 바뀐다. 팀 · 부서가 버는 돈(방치 쪽)은 셋 다 같다.
 *   퍼즐: 출동 시간 ±초 · 벌점 배수(core.missMul) · 단서 한 번 값(core.hintPenalty) · 단계 오르는 속도(core.lvSpeed) · 무료 단서
 *   보상: 출동 수사비 · 출동으로 모은 단서(재수사 몫) · 시즌 경험치 배수, 특별 출동 메달 보상(단순은 참가 보상만, 미제는 배지 +1 · 금이면 뽑기권 +1)
 *
 * 보상은 "그 판을 출동한 난이도"로 매긴다. 출동을 시작할 때 cfg.diff 에 적어 두고 결과 때 그 값을 쓰므로,
 *   출동 중에 설정을 바꿔도(설정 창은 출동 중엔 난이도 칸을 숨긴다) 이득을 볼 구멍이 없다.
 *
 * save.diff = { k: 'easy'|'normal'|'hard', set: 고른 적 있음, hardRuns, hardGold, hardCase: {사건번호: true} }
 *   set 이 false 면 튜토리얼이 끝난 뒤(또는 예전 저장이면 사무실에서 한 번) 고르는 창을 띄운다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Team3Diff = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ORDER = ['easy', 'normal', 'hard'];
  /*
   * time 출동 시간 ±초 · missMul 벌점 배수 · lvSpeed 단계 속도 · hintPenalty 단서 −초(null 이면 모드 기본 3초) · freeHints 무료 단서 +번
   * pay 출동 수사비 · clue 출동으로 모은 단서 · xp 시즌 경험치
   */
  var LIST = {
    easy:   { k: 'easy',   name: '단순 사건', tag: 'CASE · 단순', short: '단순', icon: '📄', color: '#3DDC84', lv: 1, desc: '가볍게 풀고 싶을 때',
              time: 30, missMul: 0.5, lvSpeed: 0.67, hintPenalty: null, freeHints: 1, pay: 0.7, clue: 0.8, xp: 0.8 },
    normal: { k: 'normal', name: '강력 사건', tag: 'CASE · 강력', short: '강력', icon: '🚨', color: '#FFD23F', lv: 2, desc: '처음이라면 여기부터',
              time: 0, missMul: 1, lvSpeed: 1, hintPenalty: null, freeHints: 0, pay: 1, clue: 1, xp: 1 },
    hard:   { k: 'hard',   name: '미제 사건', tag: 'CASE · 미제', short: '미제', icon: '🗄️', color: '#FF6B6B', lv: 3, desc: '아무도 못 푼 사건',
              time: -15, missMul: 1.5, lvSpeed: 1.5, hintPenalty: 5, freeHints: 0, pay: 1.5, clue: 1.25, xp: 1.25 }
  };
  var MIN_SEC = 30;          // 시간이 줄어도 이보다 짧아지지 않는다(특별 출동 60초 속공 → 45초)
  var HARD_CARD_RUNS = 10;   // 미제 사건 출동 이만큼이면 증거판에 미제 전용 카드가 열린다

  function DError(code, message) { var e = new Error(message); e.name = 'DiffError'; e.code = code; return e; }
  function int(v, lo, hi) { v = typeof v === 'number' && isFinite(v) ? Math.floor(v) : 0; return Math.max(lo, Math.min(hi, v)); }

  function clean(save) {
    var d = save.diff && typeof save.diff === 'object' ? save.diff : {}, hc = {};
    var dh = d.hardCase && typeof d.hardCase === 'object' ? d.hardCase : {};
    Object.keys(dh).forEach(function (k) { if (dh[k] === true && /^[0-9]{1,3}$/.test(k)) hc[k] = true; });
    // best: 강력 사건 이상에서 낸 최고 점수(실력 업적용). 처음 정리할 때는 예전 최고 점수를 그대로(난이도가 없던 때 = 강력 사건)
    var best = typeof d.best === 'number' && isFinite(d.best) ? int(d.best, 0, 1e12) : int(save.bestScore, 0, 1e12);
    save.diff = { k: LIST[d.k] ? d.k : 'normal', set: d.set === true, hardRuns: int(d.hardRuns, 0, 1e7), hardGold: int(d.hardGold, 0, 1e6), hardCase: hc,
                  best: best, easyRuns: int(d.easyRuns, 0, 1e7), stepUp: d.stepUp === true };
    return save.diff;
  }
  function D(save) { return save.diff && LIST[save.diff.k] && save.diff.hardCase ? save.diff : clean(save); }
  function get(save) { return D(save).k; }
  function info(k) { return LIST[k] || LIST.normal; }
  function chosen(save) { return D(save).set; }

  /** 난이도를 정한다(고른 적 있음도 표시). 반환 바뀌었는지 */
  function set(save, k) {
    if (!LIST[k]) throw DError('BAD_DIFF', '모르는 난이도: ' + k);
    var d = D(save), changed = d.k !== k;
    d.k = k; d.set = true;
    return changed;
  }

  /**
   * 출동 설정에 난이도를 입힌다(새 객체). 장비 · 준비물 · 동물 효과를 다 반영한 뒤 마지막에 부른다.
   *   cfg.diff 에 난이도를 적어 두고, 결과 정리 때 그 값으로 보상을 매긴다.
   */
  function applyRun(cfg, k) {
    var L = info(k), out = {}, mods = {};
    Object.keys(cfg || {}).forEach(function (x) { out[x] = cfg[x]; });
    Object.keys(out.mods || {}).forEach(function (x) { mods[x] = out.mods[x]; });
    var dur = typeof out.duration === 'number' ? out.duration : 90;
    out.duration = Math.max(Math.min(dur, MIN_SEC), dur + L.time);
    out.freeHints = (out.freeHints || 0) + L.freeHints;
    mods.missMul = L.missMul;
    mods.lvSpeed = L.lvSpeed;
    if (L.hintPenalty != null && !mods.noHints) mods.hintPenalty = L.hintPenalty;
    out.mods = mods;
    out.diff = L.k;
    return out;
  }

  /** 출동 한 판이 끝났을 때 기록(업적 · 미제 카드용) */
  /*
   * 출동 한 판이 끝났을 때 기록. score 를 주면 강력 이상 최고 점수(best)도 갱신한다.
   *   단순 사건으로 한 번이라도 출동한 뒤 강력 이상으로 출동하면 stepUp(업적 "현장 승급")
   */
  function noteRun(save, k, score) {
    var d = D(save);
    if (k === 'hard') d.hardRuns += 1;
    if (k === 'easy') { d.easyRuns += 1; return; }
    if (d.easyRuns > 0) d.stepUp = true;
    if (typeof score === 'number' && score > d.best) d.best = Math.floor(score);
  }
  /** 실력 기록(점수 업적 · 첫 메달 보상)을 세는 난이도인가 — 강력 사건 이상 */
  function countsSkill(k) { return k !== 'easy'; }

  /**
   * 특별 출동 메달을 난이도로 다시 매긴다. medal: '동'|'은'|'금'|null
   *   단순: 메달 보상 없음 → 참가 보상(그날 한 번 ◆1)   미제: 메달을 따면 배지 +1, 금이면 뽑기권 +1
   *   반환 { gems, tickets }(더 줄 것). 단순의 참가 보상 여부는 hub 가 판단한다(그날 처음인지)
   */
  function dailyBonus(save, k, medal) {
    if (k !== 'hard' || !medal) return { gems: 0, tickets: 0 };
    if (medal === '금') D(save).hardGold += 1;
    return { gems: 1, tickets: medal === '금' ? 1 : 0 };
  }

  /** 사건이 닫혔을 때 그 순간 난이도가 미제면 기록(업적) — 여러 번 불러도 한 번만 */
  function noteClose(save, caseNo) { if (get(save) === 'hard' && caseNo > 0) D(save).hardCase[String(caseNo)] = true; }
  function hardCases(save) { return Object.keys(D(save).hardCase).length; }
  function hardCardsOpen(save) { return D(save).hardRuns >= HARD_CARD_RUNS; }

  /** 결과 화면 한 줄: "미제 사건 · 수사비 ×1.5" 같은 것 */
  function resultLine(k) {
    var L = info(k);
    if (L.pay === 1) return L.name;
    return L.name + ' · 수사비 ×' + L.pay;
  }

  return { ORDER: ORDER, LIST: LIST, MIN_SEC: MIN_SEC, HARD_CARD_RUNS: HARD_CARD_RUNS,
           clean: clean, get: get, info: info, chosen: chosen, set: set, applyRun: applyRun,
           noteRun: noteRun, countsSkill: countsSkill, dailyBonus: dailyBonus, noteClose: noteClose, hardCases: hardCases, hardCardsOpen: hardCardsOpen, resultLine: resultLine };
});
