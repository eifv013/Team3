/*
 * Team3Pang — 특별 출동 "검거팡"(0.14.1). 화면·시계·저장소와 무관하다.
 *
 * 규칙(애니팡 같은 셋 맞추기)
 *   6×6 판에 용의자가 서 있다. 옆(가로·세로) 사람과 자리를 바꿔 같은 사람이 한 줄에 셋 이상 서면 검거(사라진다).
 *   빈자리는 위에서 새 사람이 내려와 채운다. 내려와서 또 셋이 되면 연쇄(점수 배수 ↑).
 *   바꿔도 셋이 안 되면 자리가 되돌아간다(벌점 없음, 연속은 끊긴다).
 *   바꿀 수 있는 곳이 하나도 없으면 판을 새로 섞는다.
 *
 * 단계(맞춘 횟수로 오른다): 사람 종류 1 = 5, 2 = 6, 3 = 7. 단계가 오르면 판을 새로 깐다.
 * 점수: 사라진 사람 × base × 연쇄 번호(1, 2, 3…) × 연속 배수. 맞추면 +1초, 연쇄 3번 이상이면 +1초 더.
 * 단서: 바꿀 수 있는 두 자리를 알려 준다(−3초).
 * hits = 맞춘 횟수(사라진 사람 수가 아니다 — 사건 진척이 지나치게 오르지 않게).
 *
 * 한 판의 시간 필드(endAt · pausedAt · over)는 core 와 같아서 SuspectsCore.timeLeft / tick / pause / resume 을 그대로 쓴다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.Team3Pang = factory(root.SuspectsCore);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';
  var W = 6, N = 36;
  var RULES = { duration: 90, base: 10, hitTime: 1, chainTime: 1, hintPenalty: 3, levelAt: { 1: 0, 2: 8, 3: 18 } };
  var LEVEL_NAME = { 1: '다섯 종류', 2: '여섯 종류', 3: '일곱 종류' };
  var KINDS = { 1: 5, 2: 6, 3: 7 };
  var ACT = [1, 2];   // 보이는 특징: 모자, 얼굴(작은 칸이라 둘만. 종류마다 바탕색이 따로 있다)
  function PError(code, message) { var e = new Error(message); e.name = 'PangError'; e.code = code; return e; }
  function pick(rng, n) { var i = Math.floor(rng() * n); return i >= n ? n - 1 : i; }

  /** 셋 이상 같은 줄에 선 칸 번호들(정렬) */
  function lines(b) {
    var hit = {};
    for (var y = 0; y < W; y++) for (var x = 0; x < W; x++) {
      var i = y * W + x, t = b[i];
      if (t < 0) continue;
      if (x <= W - 3 && b[i + 1] === t && b[i + 2] === t) for (var k = x; k < W && b[y * W + k] === t; k++) hit[y * W + k] = 1;
      if (y <= W - 3 && b[i + W] === t && b[i + 2 * W] === t) for (var m = y; m < W && b[m * W + x] === t; m++) hit[m * W + x] = 1;
    }
    return Object.keys(hit).map(Number).sort(function (a, c) { return a - c; });
  }
  function adjacent(a, c) { var ax = a % W, ay = Math.floor(a / W), cx = c % W, cy = Math.floor(c / W); return Math.abs(ax - cx) + Math.abs(ay - cy) === 1; }
  function swapped(b, a, c) { var x = b.slice(), t = x[a]; x[a] = x[c]; x[c] = t; return x; }
  /** 바꿔서 셋이 되는 자리 하나 [a, c](없으면 null) */
  function findMove(b) {
    for (var i = 0; i < N; i++) {
      if (i % W < W - 1 && b[i] !== b[i + 1] && lines(swapped(b, i, i + 1)).length) return [i, i + 1];
      if (i + W < N && b[i] !== b[i + W] && lines(swapped(b, i, i + W)).length) return [i, i + W];
    }
    return null;
  }
  /** 처음부터 터진 줄이 없고, 바꿀 곳은 있는 판 */
  function makeBoard(rng, kinds) {
    for (var g = 0; g < 200; g++) {
      var b = [];
      for (var i = 0; i < N; i++) {
        var t, tries = 0;
        do { t = pick(rng, kinds); } while (tries++ < 20 && ((i % W >= 2 && b[i - 1] === t && b[i - 2] === t) || (i >= 2 * W && b[i - W] === t && b[i - 2 * W] === t)));
        b.push(t);
      }
      if (!lines(b).length && findMove(b)) return b;
    }
    throw PError('GEN_FAILED', '판을 만들지 못했다');
  }
  /** 종류마다 얼굴(카드 번호): 보이는 특징(모자·얼굴)이 서로 다른 사람 */
  function makeTypes(rng, kinds) {
    var out = [], seen = {};
    for (var g = 0; out.length < kinds && g < 500; g++) {
      var id = pick(rng, 81), k = C.project(id, ACT).join('');
      if (seen[k]) continue;
      seen[k] = 1; out.push(id);
    }
    return out;
  }
  function fresh(state, level) {
    var k = KINDS[level];
    state.q = { kinds: k, types: makeTypes(state.rng, k), b: makeBoard(state.rng, k), act: ACT.slice(), clue: null };
  }
  function levelForHits(hits) { var lv = 1; for (var l = 2; l <= 3; l++) if (hits >= RULES.levelAt[l]) lv = l; return lv; }

  function createGame(opts) {
    opts = opts || {};
    if (typeof opts.rng !== 'function') throw PError('BAD_RNG', 'rng 는 함수');
    if (typeof opts.now !== 'number' || !isFinite(opts.now)) throw PError('BAD_TIME', 'now 는 밀리초');
    var duration = opts.duration == null ? RULES.duration : opts.duration;
    if (!(duration > 0)) throw PError('BAD_DURATION', '시간은 0보다 커야 한다');
    var mods = C.readMods(opts.mods);
    var st = {
      mode: 'pang', rng: opts.rng, level: 1, startLevel: 1, q: null, hintShown: false, hints: 0, freeHints: opts.freeHints || 0,
      mods: mods, shield: mods.shield, shieldUsed: 0,
      score: 0, combo: 0, bestCombo: 0, hits: 0, misses: 0, noneHits: 0, noneMisses: 0, cleared: 0, bestChain: 0,
      endAt: opts.now + duration * 1000, pausedAt: null, over: false
    };
    fresh(st, 1);
    return st;
  }
  function guard(state, now) {
    if (state.pausedAt != null) throw PError('PAUSED', '멈춘 판');
    if (C.tick(state, now)) throw PError('GAME_OVER', '끝난 판');
  }
  /**
   * 두 자리 바꾸기. 반환
   *   안 됨: { ok:false }  (판은 그대로)
   *   됨: { ok:true, before:[바꾼 직후 판], steps:[{ pop:[칸…], board:[떨어진 뒤 판] }…], gain, chain, combo, levelUp?, shuffled? }
   *        steps 는 화면이 차례로 보여 줄 연쇄. 맨 마지막 board 가 지금 판이다(레벨이 오르면 새 판은 state.q.b).
   */
  function swap(state, a, c, now) {
    guard(state, now);
    if (!(a >= 0 && a < N && c >= 0 && c < N) || a !== Math.floor(a) || c !== Math.floor(c)) throw PError('BAD_PICK', '판에 없는 자리');
    if (!adjacent(a, c)) throw PError('NOT_ADJACENT', '옆자리끼리만 바꾼다');
    var q = state.q, md = state.mods, b = swapped(q.b, a, c);
    if (!lines(b).length) { state.combo = 0; state.misses += 1; return { ok: false }; }   // 벌점은 없고 빗나감으로만 센다
    var steps = [], chain = 0, gain = 0, pop, before = b.slice();   // before: 바꾼 직후(터지기 전) 판 — 화면이 먼저 보여 준다
    state.combo += 1;
    if (state.combo > state.bestCombo) state.bestCombo = state.combo;
    var mult = C.multiplierFor(state.combo, md.comboMax);
    while ((pop = lines(b)).length) {
      chain += 1;
      gain += Math.round(pop.length * RULES.base * chain * mult * md.scoreMult);
      pop.forEach(function (i) { b[i] = -1; });
      // 칸마다 위에서 떨어진다. 빈자리는 새 사람
      for (var x = 0; x < W; x++) {
        var col = [];
        for (var y = W - 1; y >= 0; y--) if (b[y * W + x] >= 0) col.push(b[y * W + x]);
        while (col.length < W) col.push(pick(state.rng, q.kinds));
        for (var yy = W - 1, k = 0; yy >= 0; yy--, k++) b[yy * W + x] = col[k];
      }
      steps.push({ pop: pop, board: b.slice() });
      state.cleared += pop.length;
      if (chain > 30) break;   // 이론상 끝없는 연쇄 막기
    }
    q.b = b; q.clue = null;
    state.score += gain; state.hits += 1;
    if (chain > state.bestChain) state.bestChain = chain;
    state.endAt += ((md.hitTime == null ? RULES.hitTime : md.hitTime) + (chain >= 3 ? RULES.chainTime : 0)) * 1000;
    var r = { ok: true, before: before, steps: steps, gain: gain, chain: chain, combo: state.combo, mult: mult };
    var lv = levelForHits(C.lvHits(state));
    if (lv !== state.level) { state.level = lv; fresh(state, lv); r.levelUp = lv; }
    else if (!findMove(q.b)) { fresh(state, lv); r.shuffled = true; }   // 바꿀 곳이 없으면 새로 섞는다(같은 종류)
    state.hintShown = false;
    C.tick(state, now);
    return r;
  }
  /** 단서: 바꿀 수 있는 두 자리. 반환 { move:[a,c], penalty } */
  function hint(state, now) {
    guard(state, now);
    if (state.mods && state.mods.noHints) throw PError('NO_HINTS', '단서를 쓸 수 없는 출동');
    var mv = findMove(state.q.b);
    if (!mv) { fresh(state, state.level); mv = findMove(state.q.b); }
    if (state.hintShown) return { move: mv, penalty: 0 };
    var p = 0;
    if (state.freeHints > 0) state.freeHints -= 1;
    else { p = C.hintCost(state, RULES.hintPenalty); state.endAt -= p * 1000; }
    state.q.clue = mv; state.hints += 1; state.hintShown = true;
    C.tick(state, now);
    return { move: mv, penalty: p };
  }
  return { RULES: RULES, LEVEL_NAME: LEVEL_NAME, KINDS: KINDS, W: W, lines: lines, findMove: findMove, makeBoard: makeBoard, adjacent: adjacent,
           levelForHits: levelForHits, createGame: createGame, swap: swap, hint: hint };
});
