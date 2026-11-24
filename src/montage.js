/*
 * Team3Montage — 특별 출동 "몽타주 수배"(0.5.0, 사건 3과 함께 들어온 서브 퍼즐). 화면·시계·저장소와 무관하다.
 *
 * 규칙
 *   몽타주 종이에 범인의 특징이 하나씩 그려진다(처음 하나는 바로, 그 뒤로 몇 초마다 하나씩, 넷까지).
 *   아래 카드 9장(단계 2: 12장) 중 범인을 고른다. 일찍 고를수록 점수 배수가 크다(×4 → ×3 → ×2 → ×1).
 *   특징이 다 드러나기 전에는 맞는 사람이 여럿일 수 있다 — 그게 이 퍼즐의 도박이다. 넷이 다 보이면 답은 하나.
 *   틀리면 −초, 그 카드는 X. 단서 = 다음 특징을 바로 그리기(시간 벌점 없음, 대신 배수가 줄어든다).
 *
 * 그려지는 시각: q.t0(문제를 연 시각) 기준. 판이 멈춘 동안은 흐르지 않게 pause / resume 을 이 모듈 것으로 부른다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.Team3Montage = factory(root.SuspectsCore);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  var RULES = {
    duration: 90,
    base: 100,
    hitTime: 2,
    missPenalty: 5,
    step: { 1: 2400, 2: 2000 },   // 특징 하나가 더 그려지는 간격(ms). 0.8.2: 너무 빨라 고를 틈이 없어서 1.4 · 1.1초 → 2.4 · 2초
    levelAt: { 1: 0, 2: 5 }
  };
  var LEVEL_NAME = { 1: '9장', 2: '12장, 닮은 얼굴' };

  function MError(code, message) { var e = new Error(message); e.name = 'MontageError'; e.code = code; return e; }
  function pick(rng, n) { var i = Math.floor(rng() * n); return i >= n ? n - 1 : i; }
  function shuffle(rng, a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = pick(rng, i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  // 특징 하나만 다른 카드
  function near(rng, id) { var v = C.decode(id), i = pick(rng, 4); v[i] = (v[i] + 1 + pick(rng, 2)) % 3; return C.encode(v); }

  /** 문제 하나. { cards:[id…], ans(카드 id), order:[특징 번호 넷], level, extra(단서로 앞당긴 수), out:[], t0 } */
  function makeQuestion(rng, level, now) {
    if (level !== 1 && level !== 2) throw MError('BAD_LEVEL', '단계는 1~2: ' + level);
    var ans = pick(rng, 81), n = level === 1 ? 9 : 12, cards = [ans], guard = 0;
    while (cards.length < n && guard++ < 5000) {
      var c = level === 1 ? (rng() < 0.5 ? near(rng, ans) : pick(rng, 81)) : (rng() < 0.8 ? near(rng, ans) : near(rng, near(rng, ans)));
      if (cards.indexOf(c) >= 0) continue;
      cards.push(c);
    }
    if (cards.length < n) throw MError('GEN_FAILED', '문제를 만들지 못했다');
    return { cards: shuffle(rng, cards), ans: ans, order: shuffle(rng, [0, 1, 2, 3]), level: level, extra: 0, out: [], t0: now };
  }

  /** 지금 그려진 특징 수(1~4) */
  function shown(state, now) {
    var q = state.q, at = state.pausedAt != null ? state.pausedAt : now;
    return Math.min(4, 1 + Math.max(0, Math.floor((at - q.t0) / RULES.step[q.level])) + q.extra);
  }
  /** 지금 고르면 받는 배수(×4 … ×1) */
  function multNow(state, now) { return 5 - shown(state, now); }
  /** 다음 특징까지 남은 ms(다 그려졌으면 -1) */
  function nextIn(state, now) {
    if (shown(state, now) >= 4) return -1;
    var q = state.q, at = state.pausedAt != null ? state.pausedAt : now, st = RULES.step[q.level];
    return st - ((at - q.t0) % st);
  }
  /** 지금 보이는 특징 번호들 */
  function activeNow(state, now) { return state.q.order.slice(0, shown(state, now)).sort(); }

  function levelForHits(hits) { return hits >= RULES.levelAt[2] ? 2 : 1; }

  function createGame(opts) {
    opts = opts || {};
    if (typeof opts.rng !== 'function') throw MError('BAD_RNG', 'rng 는 함수');
    if (typeof opts.now !== 'number' || !isFinite(opts.now)) throw MError('BAD_TIME', 'now 는 밀리초');
    var duration = opts.duration == null ? RULES.duration : opts.duration;
    if (!(duration > 0)) throw MError('BAD_DURATION', '시간은 0보다 커야 한다');
    var mods = C.readMods(opts.mods);
    return {
      mode: 'montage', rng: opts.rng, level: 1, startLevel: 1,
      q: makeQuestion(opts.rng, 1, opts.now),
      hintShown: false, hints: 0, freeHints: opts.freeHints || 0,
      mods: mods, shield: mods.shield, shieldUsed: 0,
      score: 0, combo: 0, bestCombo: 0, hits: 0, misses: 0, noneHits: 0, noneMisses: 0, early: 0,
      endAt: opts.now + duration * 1000, pausedAt: null, over: false
    };
  }
  function guard(state, now) {
    if (state.pausedAt != null) throw MError('PAUSED', '멈춘 판');
    if (C.tick(state, now)) throw MError('GAME_OVER', '끝난 판');
  }

  /**
   * 카드 고르기. 반환
   *   맞음: { ok:true, gain, mult(배수 ×4~×1), combo, levelUp? } → 다음 문제
   *   틀림: { ok:false, penalty, shielded } → 같은 문제(그 카드는 X, 그림은 계속 그려진다)
   */
  function choose(state, idx, now) {
    guard(state, now);
    var q = state.q, md = state.mods;
    if (typeof idx !== 'number' || Math.floor(idx) !== idx || idx < 0 || idx >= q.cards.length) throw MError('BAD_PICK', '없는 카드: ' + idx);
    if (q.out.indexOf(idx) >= 0) throw MError('ALREADY_OUT', '이미 아닌 카드: ' + idx);
    if (q.cards[idx] === q.ans) {
      var m = multNow(state, now);
      state.combo += 1;
      if (state.combo > state.bestCombo) state.bestCombo = state.combo;
      var gain = Math.round(RULES.base * m * md.scoreMult);
      state.score += gain; state.hits += 1;
      if (m >= 3) state.early += 1;
      state.endAt += (md.hitTime == null ? RULES.hitTime : md.hitTime) * 1000;
      var lv = levelForHits(C.lvHits(state)), up = lv !== state.level;
      state.level = lv;
      state.q = makeQuestion(state.rng, lv, now);
      state.hintShown = false;
      return { ok: true, gain: gain, mult: m, combo: state.combo, levelUp: up ? lv : undefined };
    }
    var pen = C.missPen(state, md.missPenalty == null ? RULES.missPenalty : md.missPenalty), shielded = false;
    if (state.shield > 0) { state.shield -= 1; state.shieldUsed += 1; pen = 0; shielded = true; }
    state.combo = 0; state.misses += 1;
    state.endAt -= pen * 1000;
    q.out.push(idx);
    C.tick(state, now);
    return { ok: false, penalty: pen, shielded: shielded };
  }

  /** 단서: 다음 특징을 바로 그린다(시간 벌점 없음, 배수가 줄어듦). 반환 { shown } */
  function hint(state, now) {
    guard(state, now);
    if (state.mods && state.mods.noHints) throw MError('NO_HINTS', '단서를 쓸 수 없는 출동');
    if (shown(state, now) < 4) { state.q.extra += 1; state.hints += 1; }
    return { shown: shown(state, now), penalty: 0 };
  }

  /** 멈춤 · 재개: 종료 시각과 함께 그림 시각도 민다 */
  function pause(state, now) { C.pause(state, now); }
  function resume(state, now) {
    if (state.pausedAt != null) state.q.t0 += Math.max(0, now - state.pausedAt);
    C.resume(state, now);
  }

  // 몽타주 종이에 적는 말
  function word(a, v) {
    var w = C.ATTRS[a].values[v];
    if (a === 0) return w + '에 봤어요';
    if (a === 1) return v === 0 ? '모자 없음' : w;
    if (a === 2) return v === 0 ? '얼굴 안 가림' : w;
    return w + ' 흔적';
  }

  return { RULES: RULES, LEVEL_NAME: LEVEL_NAME, makeQuestion: makeQuestion, shown: shown, multNow: multNow, nextIn: nextIn, activeNow: activeNow,
           levelForHits: levelForHits, createGame: createGame, choose: choose, hint: hint, pause: pause, resume: resume, word: word };
});
