/*
 * Team3Forgery — 특별 출동 "위조된 한 패"(0.2.1). 화면·시계·저장소와 무관하다.
 *
 * 규칙
 *   세 명씩 줄을 지어 보여 준다. 대부분은 진짜 한 패(사건 1 규칙: 특징마다 셋 다 같거나 셋 다 다름).
 *   써드가 위조한 가짜 줄은 딱 한 특징만 "둘만 같다". 가짜 줄을 찾아 누른다.
 *
 * 단계(한 판 안에서 검거 수로 오른다)
 *   1: 네 줄, 모자·얼굴만 봄
 *   2: 네 줄, 네 가지 다
 *   3: 여섯 줄, 네 가지 다, 가짜는 뒤쪽 특징(시간대·흔적)에서만 틀림, 네 판에 한 판쯤은 가짜가 없음("위조 없음")
 *
 * 한 판의 시간 필드(endAt·pausedAt·over)는 core 와 같은 모양이라 SuspectsCore.timeLeft / tick / pause / resume 을 그대로 쓴다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.Team3Forgery = factory(root.SuspectsCore);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  var RULES = { duration: 90, base: 100, noneBonus: 200, hitTime: 2, missPenalty: 5, hintPenalty: 3, levelAt: { 1: 0, 2: 3, 3: 8 }, noFakeRate: 0.25 };
  var LEVEL_NAME = { 1: '모자·얼굴', 2: '네 가지', 3: '여섯 줄' };
  function FError(code, message) { var e = new Error(message); e.name = 'ForgeryError'; e.code = code; return e; }
  function pick(rng, n) { var i = Math.floor(rng() * n); return i >= n ? n - 1 : i; }
  function shuffle(rng, a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = pick(rng, i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function activeFor(level) { return level === 1 ? [1, 2] : [0, 1, 2, 3]; }

  /** 문제: { rows:[[a,b,c]…], fake(-1 = 가짜 없음), fakeK, level, active } */
  function makeQuestion(rng, level) {
    if (level !== 1 && level !== 2 && level !== 3) throw FError('BAD_LEVEL', '단계는 1~3: ' + level);
    var act = activeFor(level), nRows = level === 3 ? 6 : 4;
    var noFake = level === 3 && rng() < RULES.noFakeRate;
    var fake = noFake ? -1 : pick(rng, nRows);
    var kinds = level === 3 ? [0, 3] : act, fakeK = kinds[pick(rng, kinds.length)];
    for (var attempt = 0; attempt < 50; attempt++) {
      var rows = [], used = {}, ok = true;
      for (var r = 0; r < nRows && ok; r++) {
        var made = null;
        for (var g = 0; g < 300 && !made; g++) {
          var a = pick(rng, 81), b = pick(rng, 81);
          if (a === b || used[a] || used[b]) continue;
          var va = C.decode(a), vb = C.decode(b), vc = C.decode(C.thirdCard(a, b));
          [0, 1, 2, 3].forEach(function (k) { if (act.indexOf(k) < 0) vc[k] = pick(rng, 3); });   // 보지 않는 특징은 아무 값
          if (r === fake) vc[fakeK] = va[fakeK] !== vb[fakeK] ? va[fakeK] : (va[fakeK] + 1 + pick(rng, 2)) % 3;
          var c = C.encode(vc);
          if (c === a || c === b || used[c]) continue;
          made = [a, b, c];
        }
        if (!made) { ok = false; break; }
        used[made[0]] = used[made[1]] = used[made[2]] = 1;
        rows.push(shuffle(rng, made));
      }
      if (ok) return { rows: rows, fake: fake, fakeK: fakeK, level: level, active: act };
    }
    throw FError('GEN_FAILED', '문제를 만들지 못했다');
  }
  function isRealRow(row, act) { return C.isSet(row[0], row[1], row[2], act); }
  function levelForHits(hits) { var lv = 1; for (var l = 2; l <= 3; l++) if (hits >= RULES.levelAt[l]) lv = l; return lv; }

  function createGame(opts) {
    opts = opts || {};
    if (typeof opts.rng !== 'function') throw FError('BAD_RNG', 'rng 는 함수');
    if (typeof opts.now !== 'number' || !isFinite(opts.now)) throw FError('BAD_TIME', 'now 는 밀리초');
    var duration = opts.duration == null ? RULES.duration : opts.duration;
    if (!(duration > 0)) throw FError('BAD_DURATION', '시간은 0보다 커야 한다');
    var mods = C.readMods(opts.mods);
    return {
      mode: 'forgery', rng: opts.rng, level: 1, startLevel: 1, q: makeQuestion(opts.rng, 1),
      cleared: [], hints: 0, freeHints: opts.freeHints || 0, mods: mods, shield: mods.shield, shieldUsed: 0,
      score: 0, combo: 0, bestCombo: 0, hits: 0, misses: 0, traps: 0, noneHits: 0, noneMisses: 0,
      endAt: opts.now + duration * 1000, pausedAt: null, over: false
    };
  }
  function guard(state, now) {
    if (state.pausedAt != null) throw FError('PAUSED', '멈춘 판');
    if (C.tick(state, now)) throw FError('GAME_OVER', '끝난 판');
  }
  function nextQuestion(state) {
    var lv = levelForHits(C.lvHits(state)), up = lv !== state.level;
    state.level = lv; state.q = makeQuestion(state.rng, lv); state.cleared = [];
    return up ? lv : null;
  }
  function win(state, base) {
    state.combo += 1;
    if (state.combo > state.bestCombo) state.bestCombo = state.combo;
    var md = state.mods, mult = C.multiplierFor(state.combo, md.comboMax), gain = Math.round(base * mult * md.scoreMult);
    state.score += gain; state.hits += 1;
    state.endAt += (md.hitTime == null ? RULES.hitTime : md.hitTime) * 1000;
    return { gain: gain, mult: mult };
  }
  function lose(state, now) {
    var md = state.mods, pen = C.missPen(state, md.missPenalty == null ? RULES.missPenalty : md.missPenalty), shielded = false;
    if (state.shield > 0) { state.shield -= 1; state.shieldUsed += 1; pen = 0; shielded = true; }
    state.combo = 0; state.endAt -= pen * 1000;
    C.tick(state, now);
    return { penalty: pen, shielded: shielded };
  }

  /**
   * 줄 고르기(row = 0…) 또는 "위조 없음"(row = -1, 셋째 단계에서만).
   * 반환: { ok, gain?, combo, fake(정답 줄, -1 = 없음), fakeK, penalty?, shielded?, levelUp? } — 맞든 틀리든 다음 문제로.
   */
  function choose(state, row, now) {
    guard(state, now);
    var q = state.q;
    if (row === -1 && q.level !== 3) throw FError('BAD_PICK', '위조 없음은 여섯 줄 단계에서만');
    if (row !== -1 && (typeof row !== 'number' || Math.floor(row) !== row || row < 0 || row >= q.rows.length)) throw FError('BAD_PICK', '없는 줄: ' + row);
    var fake = q.fake, fakeK = q.fakeK, res;
    if (row === fake) {
      var w = win(state, fake === -1 ? RULES.noneBonus : RULES.base);
      if (fake === -1) state.noneHits += 1;
      res = { ok: true, gain: w.gain, mult: w.mult, combo: state.combo, fake: fake, fakeK: fakeK };
    } else {
      if (row === -1) state.noneMisses += 1; else state.misses += 1;
      var l = lose(state, now);
      res = { ok: false, combo: 0, fake: fake, fakeK: fakeK, penalty: l.penalty, shielded: l.shielded };
    }
    if (!state.over) { var up = nextQuestion(state); if (up) res.levelUp = up; }
    return res;
  }

  /** 단서: 진짜 줄 하나를 "진짜"로 짚어 준다(후보를 줄인다). 반환 { row, penalty } (더 짚을 게 없으면 row = -1, 값 없음) */
  function hint(state, now) {
    guard(state, now);
    if (state.mods && state.mods.noHints) throw FError('NO_HINTS', '단서를 쓸 수 없는 출동');
    var q = state.q, cand = [];
    for (var i = 0; i < q.rows.length; i++) if (i !== q.fake && state.cleared.indexOf(i) < 0) cand.push(i);
    if (cand.length === 0) return { row: -1, penalty: 0 };   // 남은 진짜 줄이 없으면 더 짚을 게 없다
    var row = cand[pick(state.rng, cand.length)], p = 0;
    if (state.freeHints > 0) state.freeHints -= 1; else { p = C.hintCost(state, RULES.hintPenalty); state.endAt -= p * 1000; }
    state.hints += 1; state.cleared.push(row);
    C.tick(state, now);
    return { row: row, penalty: p };
  }

  return { RULES: RULES, LEVEL_NAME: LEVEL_NAME, activeFor: activeFor, makeQuestion: makeQuestion, isRealRow: isRealRow,
           levelForHits: levelForHits, createGame: createGame, choose: choose, hint: hint };
});
