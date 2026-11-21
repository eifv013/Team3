/*
 * Team3Witness — 사건 2 "안개 속 목격자들"의 퍼즐 규칙(0.2.0). 화면·시계·저장소와 무관하다.
 *
 * 규칙
 *   목격자 한 명이 범인의 특징 넷(시간대·모자·얼굴·흔적)을 말한다. 그중 딱 하나는 거짓(잘못 본 것).
 *   범인 = 진술 넷 중 딱 셋과 맞는 사람. 판에는 그런 사람이 범인 하나뿐이다(늘 보장).
 *   진술 넷이 다 맞는 사람은 "함정"(목격자 말을 그대로 믿으면 고르게 되는 사람).
 *
 * 단계(검거 수로 오른다, 한 판 안에서)
 *   1 쉬움  : 9명, 범인 아닌 사람은 진술과 0~2개 맞음, 함정은 가끔
 *   2 보통  : 9명, 범인 아닌 사람 대부분이 딱 2개 맞음(잘 안 걸러짐), 함정 늘 하나
 *   3 어려움: 12명, 대부분 2개 맞음, 함정 하나, 진술 하나가 흐림("모자를 썼어요" — 비니인지 중절모인지 모름)
 *
 * 한 판(출동)의 상태는 core 와 같은 모양의 시간 필드(endAt·pausedAt·over)를 써서
 * SuspectsCore.timeLeft / tick / pause / resume 을 그대로 쓸 수 있다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.Team3Witness = factory(root.SuspectsCore);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  var RULES = {
    duration: 90,
    base: 100,          // 검거 1건 기본 점수(연속 배수는 core 와 같다)
    hitTime: 2,         // 검거하면 +초
    missPenalty: 5,     // 오인 체포 −초
    trapPenalty: 8,     // 함정 체포 −초(그대로 믿은 값)
    hintPenalty: 3,     // 단서(거짓 진술 짚기) −초
    levelAt: { 1: 0, 2: 3, 3: 8 }   // 이 단계에 오르는 누적 검거 수
  };
  var LEVEL_NAME = { 1: '쉬움', 2: '보통', 3: '어려움' };

  function WError(code, message) { var e = new Error(message); e.name = 'WitnessError'; e.code = code; return e; }
  function pick(rng, n) { var i = Math.floor(rng() * n); return i >= n ? n - 1 : i; }
  function shuffle(rng, a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = pick(rng, i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  /** 진술과 맞는 개수. says = [{ k, vals:[...] }] (vals 가 둘이면 흐린 진술) */
  function matches(id, says) {
    var v = C.decode(id), n = 0;
    for (var i = 0; i < says.length; i++) if (says[i].vals.indexOf(v[says[i].k]) >= 0) n++;
    return n;
  }

  /**
   * 문제 하나. 반환 { board:[id…], target, trap(없으면 -1), says, lie(거짓 진술의 속성 번호), level }
   * 아주 드물게 조건을 못 맞추면 다시 뽑는다(200번 안에 늘 성공한다 — 시험으로 확인).
   */
  function makeQuestion(rng, level) {
    if (level !== 1 && level !== 2 && level !== 3) throw WError('BAD_LEVEL', '단계는 1~3: ' + level);
    var n = level === 3 ? 12 : 9;
    for (var attempt = 0; attempt < 200; attempt++) {
      var target = pick(rng, 81), tv = C.decode(target), lie = pick(rng, 4);
      var says = [0, 1, 2, 3].map(function (k) { return { k: k, vals: [k === lie ? (tv[k] + 1 + pick(rng, 2)) % 3 : tv[k]] }; });
      if (level === 3) {
        // 흐린 진술: 모자·얼굴 중 "썼다"고 말한 쪽을 "썼다(종류는 모름)"로. 둘 다 "안 썼다"면 이 문제는 흐린 진술 없이
        var cands = [1, 2].filter(function (k) { return says[k].vals[0] !== 0; });
        if (cands.length) says[cands[pick(rng, cands.length)]].vals = [1, 2];
        if (matches(target, says) !== 3) continue;   // 흐리게 해서 거짓이 참이 되면 다시
      }
      var board = [target], used = {}, trap = -1;
      used[target] = 1;
      if (level > 1 || rng() < 0.6) {
        for (var g = 0; g < 400; g++) { var t = pick(rng, 81); if (!used[t] && matches(t, says) === 4) { trap = t; board.push(t); used[t] = 1; break; } }
      }
      var guard = 0;
      while (board.length < n && guard++ < 20000) {
        var id = pick(rng, 81);
        if (used[id]) continue;
        var m = matches(id, says);
        if (m >= 3) continue;                                     // 셋 맞는 건 범인뿐, 넷 맞는 함정은 하나만
        if (level === 1 && m < 1 && rng() < 0.5) continue;        // 쉬움: 너무 쉽지 않게 1~2개 맞는 사람을 많이
        if (level > 1 && m !== 2 && rng() < 0.85) continue;       // 보통·어려움: 대부분 딱 2개
        board.push(id); used[id] = 1;
      }
      if (board.length === n) return { board: shuffle(rng, board), target: target, trap: trap, says: says, lie: lie, level: level };
    }
    throw WError('GEN_FAILED', '문제를 만들지 못했다');
  }

  function levelForHits(hits) { var lv = 1; for (var l = 2; l <= 3; l++) if (hits >= RULES.levelAt[l]) lv = l; return lv; }

  /**
   * 한 판. opts: rng, now(ms) 필수 / duration / freeHints / mods(core.readMods 와 같은 것: scoreMult·shield 등)
 *   trapPenalty(초, 장비 "진술 녹음기") / hitBonus(검거 때 더할 초, 장비 "부두 정보원")
   */
  function createGame(opts) {
    opts = opts || {};
    if (typeof opts.rng !== 'function') throw WError('BAD_RNG', 'rng 는 함수');
    if (typeof opts.now !== 'number' || !isFinite(opts.now)) throw WError('BAD_TIME', 'now 는 밀리초');
    var duration = opts.duration == null ? RULES.duration : opts.duration;
    if (!(duration > 0)) throw WError('BAD_DURATION', '시간은 0보다 커야 한다');
    var mods = C.readMods(opts.mods);
    var trapPenalty = opts.trapPenalty == null ? RULES.trapPenalty : opts.trapPenalty;
    var hitBonus = opts.hitBonus == null ? 0 : opts.hitBonus;
    if (!(trapPenalty >= 0 && trapPenalty <= 30) || !(hitBonus >= 0 && hitBonus <= 10)) throw WError('BAD_OPTION', '함정 벌점·검거 보너스 범위');
    return {
      trapPenalty: trapPenalty, hitBonus: hitBonus,   // 장비: 진술 녹음기 · 부두 정보원
      mode: 'witness', rng: opts.rng, level: 1, startLevel: 1,
      q: makeQuestion(opts.rng, 1),
      hintShown: false, hints: 0, freeHints: opts.freeHints || 0,
      mods: mods, shield: mods.shield, shieldUsed: 0,
      score: 0, combo: 0, bestCombo: 0, hits: 0, misses: 0, traps: 0, noneHits: 0, noneMisses: 0,
      endAt: opts.now + duration * 1000, pausedAt: null, over: false
    };
  }
  function guard(state, now) {
    if (state.pausedAt != null) throw WError('PAUSED', '멈춘 판');
    if (C.tick(state, now)) throw WError('GAME_OVER', '끝난 판');
  }
  function nextQuestion(state) {
    var lv = levelForHits(state.hits), up = lv !== state.level;
    state.level = lv;
    state.q = makeQuestion(state.rng, lv);
    state.hintShown = false;
    return up ? lv : null;
  }

  /**
   * 한 명 고르기. 반환
   *   맞음: { ok:true, gain, combo, mult, lie, levelUp? }
   *   틀림: { ok:false, trap:bool, penalty, shielded, lie, target(판 위 자리), matched(고른 사람이 맞힌 진술 수) }
   * 맞든 틀리든 다음 문제로 넘어간다(틀린 문제를 붙잡고 있지 않게).
   */
  function choose(state, idx, now) {
    guard(state, now);
    var q = state.q;
    if (typeof idx !== 'number' || Math.floor(idx) !== idx || idx < 0 || idx >= q.board.length) throw WError('BAD_PICK', '판에 없는 자리: ' + idx);
    var id = q.board[idx], lie = q.lie, targetAt = q.board.indexOf(q.target), md = state.mods;
    if (id === q.target) {
      state.combo += 1;
      if (state.combo > state.bestCombo) state.bestCombo = state.combo;
      var mult = C.multiplierFor(state.combo, md.comboMax);
      var gain = Math.round(RULES.base * mult * md.scoreMult);
      state.score += gain; state.hits += 1;
      state.endAt += ((md.hitTime == null ? RULES.hitTime : md.hitTime) + (state.hitBonus || 0)) * 1000;
      var up = nextQuestion(state);
      return { ok: true, gain: gain, combo: state.combo, mult: mult, lie: lie, levelUp: up || undefined };
    }
    var trap = id === q.trap, pen = trap ? (state.trapPenalty == null ? RULES.trapPenalty : state.trapPenalty) : (md.missPenalty == null ? RULES.missPenalty : md.missPenalty), shielded = false;
    if (state.shield > 0) { state.shield -= 1; state.shieldUsed += 1; pen = 0; shielded = true; }
    state.combo = 0;
    if (trap) state.traps += 1; else state.misses += 1;
    state.endAt -= pen * 1000;
    var matched = matches(id, q.says);
    C.tick(state, now);
    if (!state.over) nextQuestion(state);
    return { ok: false, trap: trap, penalty: pen, shielded: shielded, lie: lie, target: targetAt, matched: matched };
  }

  /** 단서: 거짓 진술을 짚어 준다(한 문제에 한 번). 반환 { lie, penalty } */
  function hint(state, now) {
    guard(state, now);
    if (state.mods && state.mods.noHints) throw WError('NO_HINTS', '단서를 쓸 수 없는 출동');
    if (state.hintShown) return { lie: state.q.lie, penalty: 0 };
    var p = 0;
    if (state.freeHints > 0) state.freeHints -= 1;
    else { p = RULES.hintPenalty; state.endAt -= p * 1000; }
    state.hints += 1; state.hintShown = true;
    C.tick(state, now);
    return { lie: state.q.lie, penalty: p };
  }

  // 진술 문장(목격자 말투)
  function sayText(s) {
    var k = s.k, v = s.vals;
    if (v.length > 1) return k === 1 ? '모자를 썼어요 (어떤 모자인지는 못 봤어요)' : '얼굴에 뭔가 쓰고 있었어요';
    if (k === 0) return ['낮이었어요', '저녁이었어요', '밤이었어요'][v[0]];
    if (k === 1) return ['모자는 안 썼어요', '비니를 썼어요', '중절모를 썼어요'][v[0]];
    if (k === 2) return ['얼굴을 가리지 않았어요', '안경을 썼어요', '마스크를 썼어요'][v[0]];
    return ['지문이 남았어요', '유리 조각이 떨어져 있었어요', '타이어 자국이 있었어요'][v[0]];
  }

  return { RULES: RULES, LEVEL_NAME: LEVEL_NAME, matches: matches, makeQuestion: makeQuestion, levelForHits: levelForHits,
           createGame: createGame, choose: choose, hint: hint, sayText: sayText };
});
