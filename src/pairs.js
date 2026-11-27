/*
 * Team3Pairs — 특별 출동 "공범 짝 찾기"(0.14.1). 화면·시계·저장소와 무관하다.
 *
 * 규칙(같은 그림 찾기)
 *   카드가 뒤집혀 있다. 두 장씩 뒤집어 보이는 특징이 똑같은 공범 둘을 찾으면 검거(열린 채 남는다).
 *   다르면 다시 덮인다(벌점 없음, 연속은 끊긴다). 짝을 다 찾으면 보너스와 새 판.
 *
 * 단계(찾은 짝 수로 오른다)
 *   1 : 8장(짝 4), 모자 · 얼굴
 *   2 : 12장(짝 6), + 시간대
 *   3 : 16장(짝 8), 네 특징, 짝 둘은 다른 짝과 하나만 다른 "닮은 사람"
 *
 * 점수: 짝마다 base × 연속 배수. 판을 다 치우면 판 보너스(뒤집기를 적게 할수록 크다) + 4초.
 * 단서: 아직 못 찾은 짝 하나를 잠깐 보여 준다(−3초).
 * hits = 찾은 짝 수.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.Team3Pairs = factory(root.SuspectsCore);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';
  var RULES = { duration: 90, base: 40, hitTime: 0, clearTime: 4, clearBase: 120, hintPenalty: 3, levelAt: { 1: 0, 2: 8, 3: 20 } };
  var LEVEL_NAME = { 1: '여덟 장', 2: '열두 장', 3: '열여섯 장' };
  var LV = { 1: { attrs: [1, 2], pairs: 4 }, 2: { attrs: [0, 1, 2], pairs: 6 }, 3: { attrs: [0, 1, 2, 3], pairs: 6, decoy: 2 } };
  function QError(code, message) { var e = new Error(message); e.name = 'PairsError'; e.code = code; return e; }
  function pick(rng, n) { var i = Math.floor(rng() * n); return i >= n ? n - 1 : i; }
  function key(id, act) { return C.project(id, act).join(''); }
  function shuffle(rng, a) { for (var i = a.length - 1; i > 0; i--) { var j = pick(rng, i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  /** 판 하나. 반환 { cards:[id…], attrs, done:[], up:[], flips } */
  function makeBoard(rng, level) {
    var cfg = LV[level];
    if (!cfg) throw QError('BAD_LEVEL', '단계는 1~3: ' + level);
    for (var g = 0; g < 500; g++) {
      var act = cfg.attrs, base = [], seen = {};
      for (var t = 0; base.length < cfg.pairs && t < 400; t++) { var id = pick(rng, 81), k = key(id, act); if (!seen[k]) { seen[k] = 1; base.push(id); } }
      if (base.length < cfg.pairs) continue;
      var all = base.slice(), ok = true;
      for (var d = 0; d < (cfg.decoy || 0) && ok; d++) {   // 닮은 사람: 이미 있는 짝에서 특징 하나만 바꾼 새 짝
        var made = false;
        for (var tt = 0; tt < 60 && !made; tt++) {
          var v = C.decode(base[pick(rng, base.length)]).slice(), a = act[pick(rng, act.length)];
          v[a] = (v[a] + 1 + pick(rng, 2)) % 3;
          var nid = C.encode(v), nk = key(nid, act);
          if (!seen[nk]) { seen[nk] = 1; all.push(nid); made = true; }
        }
        ok = made;
      }
      if (!ok) continue;
      var cards = [];
      all.forEach(function (x) { cards.push(x, x); });
      return { cards: shuffle(rng, cards), attrs: act.slice(), done: [], up: [], flips: 0, clue: null };
    }
    throw QError('GEN_FAILED', '판을 만들지 못했다');
  }
  function levelForHits(hits) { var lv = 1; for (var l = 2; l <= 3; l++) if (hits >= RULES.levelAt[l]) lv = l; return lv; }

  function createGame(opts) {
    opts = opts || {};
    if (typeof opts.rng !== 'function') throw QError('BAD_RNG', 'rng 는 함수');
    if (typeof opts.now !== 'number' || !isFinite(opts.now)) throw QError('BAD_TIME', 'now 는 밀리초');
    var duration = opts.duration == null ? RULES.duration : opts.duration;
    if (!(duration > 0)) throw QError('BAD_DURATION', '시간은 0보다 커야 한다');
    var mods = C.readMods(opts.mods);
    var st = {
      mode: 'pairs', rng: opts.rng, level: 1, startLevel: 1, q: null, hintShown: false, hints: 0, freeHints: opts.freeHints || 0,
      mods: mods, shield: mods.shield, shieldUsed: 0,
      score: 0, combo: 0, bestCombo: 0, hits: 0, misses: 0, noneHits: 0, noneMisses: 0, boards: 0,
      endAt: opts.now + duration * 1000, pausedAt: null, over: false
    };
    st.q = makeBoard(st.rng, 1);
    return st;
  }
  function guard(state, now) {
    if (state.pausedAt != null) throw QError('PAUSED', '멈춘 판');
    if (C.tick(state, now)) throw QError('GAME_OVER', '끝난 판');
  }
  /**
   * 한 장 뒤집기. 앞서 틀린 두 장이 열려 있으면 먼저 덮는다. 반환
   *   첫 장: { open:i }
   *   둘째 장, 짝: { open:i, match:true, pair:[a,b], gain, combo, cleared?, bonus?, levelUp? }
   *   둘째 장, 아님: { open:i, match:false, pair:[a,b], near:bool(특징 하나만 다름) } → 화면이 잠깐 보여 준 뒤 cover() 로 덮는다
   */
  function flip(state, i, now) {
    guard(state, now);
    var q = state.q;
    if (q.up.length === 2) q.up = [];
    if (!(i >= 0 && i < q.cards.length) || i !== Math.floor(i)) throw QError('BAD_PICK', '판에 없는 카드');
    if (q.done.indexOf(i) >= 0 || q.up.indexOf(i) >= 0) throw QError('ALREADY_OPEN', '이미 열린 카드');
    q.up.push(i); q.flips += 1;
    if (q.up.length < 2) return { open: i };
    var a = q.up[0], b = q.up[1], md = state.mods;
    if (key(q.cards[a], q.attrs) === key(q.cards[b], q.attrs)) {
      state.combo += 1;
      if (state.combo > state.bestCombo) state.bestCombo = state.combo;
      var mult = C.multiplierFor(state.combo, md.comboMax), gain = Math.round(RULES.base * mult * md.scoreMult);
      q.done.push(a, b); q.up = []; q.clue = null;
      state.score += gain; state.hits += 1;
      state.endAt += (md.hitTime == null ? RULES.hitTime : md.hitTime) * 1000;
      var r = { open: i, match: true, pair: [a, b], gain: gain, combo: state.combo, mult: mult };
      if (q.done.length === q.cards.length) {
        var extra = Math.max(0, q.flips - q.cards.length);   // 다 맞히기만 했으면 0
        r.bonus = Math.round(Math.max(RULES.clearBase * 0.3, RULES.clearBase * q.cards.length / 8 - extra * 10) * md.scoreMult);
        state.score += r.bonus; state.boards += 1; r.cleared = true;
        state.endAt += RULES.clearTime * 1000;
        var lv = levelForHits(C.lvHits(state));
        if (lv !== state.level) r.levelUp = lv;
        state.level = lv;
        state.q = makeBoard(state.rng, lv);
      }
      state.hintShown = false;
      C.tick(state, now);
      return r;
    }
    state.combo = 0; state.misses += 1;   // 벌점은 없고 빗나감으로만 센다
    var x = C.decode(q.cards[a]), y = C.decode(q.cards[b]), diff = q.attrs.filter(function (k) { return x[k] !== y[k]; }).length;
    return { open: i, match: false, pair: [a, b], near: diff === 1 };
  }
  /** 틀린 두 장 덮기(화면이 보여 준 뒤) */
  function cover(state) { if (state.q && state.q.up.length === 2) state.q.up = []; }
  /** 단서: 아직 못 찾은 짝 하나 [a, b]. 반환 { pair, penalty } */
  function hint(state, now) {
    guard(state, now);
    if (state.mods && state.mods.noHints) throw QError('NO_HINTS', '단서를 쓸 수 없는 출동');
    var q = state.q, left = [];
    for (var i = 0; i < q.cards.length; i++) if (q.done.indexOf(i) < 0) left.push(i);
    var a = left[pick(state.rng, left.length)], b = left.filter(function (j) { return j !== a && key(q.cards[j], q.attrs) === key(q.cards[a], q.attrs); })[0];
    if (state.hintShown) return { pair: q.clue || [a, b], penalty: 0 };
    var p = 0;
    if (state.freeHints > 0) state.freeHints -= 1;
    else { p = C.hintCost(state, RULES.hintPenalty); state.endAt -= p * 1000; }
    q.clue = [a, b]; state.hints += 1; state.hintShown = true;
    C.tick(state, now);
    return { pair: [a, b], penalty: p };
  }
  return { RULES: RULES, LEVEL_NAME: LEVEL_NAME, LV: LV, makeBoard: makeBoard, levelForHits: levelForHits, createGame: createGame, flip: flip, cover: cover, hint: hint };
});
