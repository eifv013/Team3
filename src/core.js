/*
 * SuspectsCore — "수사 3팀" 퍼즐(현장 출동 한 판)의 규칙 계산. 화면과 무관한 순수 로직.
 *
 * 구조
 *   카드(용의자) = 0~80 정수 id. 3진수 네 자리가 곧 네 속성(시간대·모자·얼굴·흔적)의 값이다.
 *   검거 규칙   = 보는 속성마다 "두 명만 같으면 안 된다" ⇔ 세 값의 합이 3의 배수(모두 같음 또는 모두 다름).
 *   단계(level) = 보는 속성의 수(1~4). 처음 하는 사람을 위해 모자 → 얼굴 → 시간대 → 흔적 순으로 하나씩 늘린다.
 *                 안 보는 속성은 화면에 그리지 않고 판정에서도 뺀다(active 목록).
 *   판(board)   = 서로 다른 카드 9장. 검거하면 그 세 자리만 새 카드로 채운다.
 *   게임 상태   = 점수·연속·남은 시간(종료 시각)·단계·단서. submit / declareNone / hint 가 바꾼다.
 *   튜토리얼    = makeLesson: 두 명을 주고 "셋째는 누구?"를 고르는 문제를 만든다.
 *
 * 화면(ui.js)은 이 모듈의 결과만 읽는다. 무작위는 rng 인자로 받아 테스트가 결과를 고정할 수 있다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SuspectsCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ATTRS = [
    { key: 'time', name: '시간대', values: ['낮', '저녁', '밤'] },
    { key: 'hat',  name: '모자',   values: ['맨머리', '비니', '중절모'] },   // 1.6: 캡 모자 → 비니(작게 보면 헬멧 같아서, 아이콘과 통일)
    { key: 'face', name: '얼굴',   values: ['맨얼굴', '안경', '마스크'] },
    { key: 'mark', name: '흔적',   values: ['지문', '유리 조각', '타이어 자국'] }
  ];
  var ALL = [0, 1, 2, 3];
  // 단계마다 하나씩 늘어나는 속성 순서: 모자 → 얼굴 → 시간대 → 흔적 (눈에 잘 띄는 것부터)
  var ORDER = [1, 2, 0, 3];
  var DECK_SIZE = 81;   // 3^4
  var BOARD_SIZE = 9;

  // 한 판의 수치. 밸런스는 여기만 고치면 된다.
  var RULES = {
    duration: 90,          // 시작 시간(초)
    base: 100,             // 검거 1건 기본 점수
    noneBonus: 300,        // "검거 불가" 적중 기본 점수
    hitTime: 2,            // 검거 성공 시 늘어나는 시간(초)
    noneTime: 5,           // 검거 불가 적중 시 늘어나는 시간(초)
    missPenalty: 5,        // 오인 체포 시 줄어드는 시간(초)
    wrongNonePenalty: 10,  // 검거 불가 오판 시 줄어드는 시간(초)
    comboStep: 0.5,        // 연속 검거 1회당 배수 증가
    comboMax: 3,           // 배수 상한
    hintPenalty: 3,        // 단서 한 번에 줄어드는 시간(초)
    // 이 단계에 오르는 데 필요한 누적 검거 수(단계 1은 0). 2명→얼굴, 4명→시간대, 7명→흔적
    levelAt: { 1: 0, 2: 2, 3: 4, 4: 7 }
  };

  /* ---------- 오류 ---------- */
  // 화면이 code 로 분기할 수 있게 오류에 종류를 붙인다.
  function GameError(code, message) {
    var e = new Error(message);
    e.name = 'GameError';
    e.code = code;
    return e;
  }

  /* ---------- 단계 ---------- */
  function assertLevel(level) {
    if (level !== 1 && level !== 2 && level !== 3 && level !== 4) throw GameError('BAD_LEVEL', '단계는 1~4: ' + level);
  }
  // 단계 → 보는 속성 번호 목록(ATTRS 순서로 정렬해서 화면 표시 순서가 늘 같게)
  function activeFor(level) {
    assertLevel(level);
    return ORDER.slice(0, level).sort(function (a, b) { return a - b; });
  }

  /* ---------- 카드 ---------- */
  function assertId(id) {
    if (typeof id !== 'number' || !isFinite(id) || Math.floor(id) !== id || id < 0 || id >= DECK_SIZE) {
      throw GameError('BAD_CARD', '카드 id 는 0~80 정수여야 한다: ' + id);
    }
  }

  // id → [시간대, 모자, 얼굴, 흔적] 각 0~2
  function decode(id) {
    assertId(id);
    return [id % 3, Math.floor(id / 3) % 3, Math.floor(id / 9) % 3, Math.floor(id / 27) % 3];
  }

  function encode(v) {
    if (!Array.isArray(v) || v.length !== ATTRS.length) throw GameError('BAD_CARD', '속성은 4개여야 한다');
    for (var i = 0; i < v.length; i++) {
      if (v[i] !== 0 && v[i] !== 1 && v[i] !== 2) throw GameError('BAD_CARD', '속성 값은 0~2: ' + v[i]);
    }
    return v[0] + v[1] * 3 + v[2] * 9 + v[3] * 27;
  }

  // 보는 속성만 남긴 모양(안 보는 속성은 0). 화면은 이 값으로 그린다.
  function project(id, active) {
    var v = decode(id), a = active || ALL, out = [0, 0, 0, 0];
    for (var i = 0; i < a.length; i++) out[a[i]] = v[a[i]];
    return out;
  }
  function projKey(id, active) { return project(id, active).join(''); }

  /*
   * 세 장이 한 패인가(보는 속성만 따진다).
   * 속성마다 (x+y+z) % 3 === 0 이면 "모두 같음" 또는 "모두 다름"이다(둘만 같으면 합이 3의 배수가 될 수 없다).
   * 같은 카드를 두 번 고른 경우는 판 위 자리가 다르면 생기지 않지만, 방어적으로 막는다.
   */
  function isSet(a, b, c, active) {
    if (a === b || b === c || a === c) return false;
    var x = decode(a), y = decode(b), z = decode(c), act = active || ALL;
    for (var n = 0; n < act.length; n++) {
      var i = act[n];
      if ((x[i] + y[i] + z[i]) % 3 !== 0) return false;
    }
    return true;
  }

  /*
   * 왜 틀렸는지: 규칙을 어긴 속성(= 둘만 같은 속성)과 그 값.
   * 오인 체포 때 "모자: 비니 둘만 같아요"처럼 보여 줘서 규칙을 몸으로 익히게 한다.
   */
  function explain(a, b, c, active) {
    var x = decode(a), y = decode(b), z = decode(c), out = [], act = active || ALL;
    for (var n = 0; n < act.length; n++) {
      var i = act[n];
      if ((x[i] + y[i] + z[i]) % 3 !== 0) {
        var same = x[i] === y[i] ? x[i] : (y[i] === z[i] ? y[i] : x[i]);
        out.push({ index: i, key: ATTRS[i].key, name: ATTRS[i].name, value: ATTRS[i].values[same] });
      }
    }
    return out;
  }

  // 두 장이 정해지면 셋째 장은 하나로 정해진다(속성마다 (3 - (x+y)%3) % 3).
  function thirdCard(a, b) {
    if (a === b) throw GameError('SAME_CARD', '서로 다른 두 장이어야 한다');
    var x = decode(a), y = decode(b), v = [];
    for (var i = 0; i < ATTRS.length; i++) v.push((3 - (x[i] + y[i]) % 3) % 3);
    return encode(v);
  }

  /*
   * 두 장을 골랐을 때 셋째가 갖춰야 할 조건(보조 줄·튜토리얼 해설에 쓴다).
   * 반환: [{ index, name, same, value }] — same=true 면 "둘이 같으니 셋째도 같게", false 면 "둘이 다르니 남은 하나로"
   */
  function needs(a, b, active) {
    var x = decode(a), y = decode(b), out = [], act = active || ALL;
    for (var n = 0; n < act.length; n++) {
      var i = act[n], same = x[i] === y[i];
      var v = same ? x[i] : (3 - (x[i] + y[i]) % 3) % 3;
      out.push({ index: i, key: ATTRS[i].key, name: ATTRS[i].name, same: same, value: ATTRS[i].values[v] });
    }
    return out;
  }

  // 판 위의 한 패를 모두 찾는다(9장 → 84개 조합, 충분히 가볍다).
  function findSets(board, active) {
    var out = [];
    for (var i = 0; i < board.length; i++)
      for (var j = i + 1; j < board.length; j++)
        for (var k = j + 1; k < board.length; k++)
          if (isSet(board[i], board[j], board[k], active)) out.push([i, j, k]);
    return out;
  }

  /* ---------- 무작위 ---------- */
  // 시드 고정 난수(mulberry32). 테스트와 공통 판에 쓴다.
  function makeRng(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function assertRng(rng) {
    if (typeof rng !== 'function') throw GameError('BAD_RNG', 'rng 는 0 이상 1 미만을 돌려주는 함수여야 한다');
  }
  // rng 가 범위를 벗어나도 판이 깨지지 않게 0~n-1 로 맞춘다
  function pickIndex(rng, n) {
    var r = rng();
    if (!(r >= 0 && r < 1)) r = 0;
    return Math.floor(r * n);
  }

  // exclude 에 없는 카드를 0 ~ limit-1 에서 count 장 뽑는다(서로 겹치지 않게). limit 기본 81.
  function drawDistinct(rng, exclude, count, limit) {
    assertRng(rng);
    limit = limit == null ? DECK_SIZE : limit;
    var used = {}, pool = [];
    for (var i = 0; i < exclude.length; i++) used[exclude[i]] = true;
    for (var id = 0; id < limit; id++) if (!used[id]) pool.push(id);
    if (pool.length < count) throw GameError('DECK_EMPTY', '뽑을 카드가 모자란다');
    var out = [];
    for (var n = 0; n < count; n++) {
      var pick = pickIndex(rng, pool.length);
      out.push(pool[pick]);
      pool.splice(pick, 1);
    }
    return out;
  }

  function newBoard(rng, limit) {
    return drawDistinct(rng, [], BOARD_SIZE, limit);
  }

  // 검거한 세 자리만 새 카드로 바꾼 판(원본은 그대로). 판 전체를 제외해 방금 잡힌 카드가 바로 다시 나오지 않게 한다.
  function refill(board, idxs, rng, limit) {
    var fresh = drawDistinct(rng, board, idxs.length, limit);
    var next = board.slice();
    for (var i = 0; i < idxs.length; i++) next[idxs[i]] = fresh[i];
    return next;
  }

  /*
   * 단계에 맞춰 카드를 뽑는다: 화면에 보이는 모양(project)이 판 위에서 겹치지 않는 카드를 먼저 고른다.
   * 모양 가짓수가 모자라면(1단계는 3가지뿐) 겹침을 허용한다. 1단계는 "같은 모자 셋"이 곧 한 패라 괜찮다.
   */
  function drawForLevel(rng, excludeIds, keepProj, count, level) {
    assertRng(rng);
    var active = activeFor(level), used = {}, seen = {}, out = [];
    for (var i = 0; i < excludeIds.length; i++) used[excludeIds[i]] = true;
    for (var j = 0; j < keepProj.length; j++) seen[keepProj[j]] = true;
    var pool = [];
    for (var id = 0; id < DECK_SIZE; id++) if (!used[id]) pool.push(id);
    for (var n = 0; n < count; n++) {
      var fresh = pool.filter(function (c) { return !seen[projKey(c, active)]; });
      var from = fresh.length ? fresh : pool;
      if (!from.length) throw GameError('DECK_EMPTY', '뽑을 카드가 모자란다');
      var pick = from[pickIndex(rng, from.length)];
      out.push(pick);
      seen[projKey(pick, active)] = true;
      pool.splice(pool.indexOf(pick), 1);
    }
    return out;
  }

  function dealBoard(rng, level) {
    return drawForLevel(rng, [], [], BOARD_SIZE, level);
  }

  function refillBoard(board, idxs, rng, level) {
    var active = activeFor(level), keep = [];
    for (var i = 0; i < board.length; i++) if (idxs.indexOf(i) < 0) keep.push(projKey(board[i], active));
    var fresh = drawForLevel(rng, board, keep, idxs.length, level);
    var next = board.slice();
    for (var k = 0; k < idxs.length; k++) next[idxs[k]] = fresh[k];
    return next;
  }

  /* ---------- 게임 ---------- */
  // 연속 검거 n 번째의 점수 배수: 1, 1.5, 2, 2.5, 3, 3, ...
  // 연속 검거 배수(평소 규칙). 판의 상한이 다르면 multiplierFor 를 쓴다
  //   (인자를 하나만 받는다: [..].map(multiplier) 처럼 써도 두 번째 인자가 끼어들지 않게)
  function multiplier(combo) { return multiplierFor(combo, RULES.comboMax); }
  function multiplierFor(combo, max) {
    if (combo < 1) return 1;
    return Math.min(max == null ? RULES.comboMax : max, 1 + RULES.comboStep * (combo - 1));
  }

  /*
   * 판마다 바꿀 수 있는 규칙(0.1.19: 하루 한 번 특별 출동 · 출동 준비물).
   *   scoreMult  점수 배수(기본 1)          comboMax  연속 배수 상한(기본 RULES.comboMax)
   *   hitTime    검거 때 늘어나는 초          missPenalty 오인 체포 때 줄어드는 초
   *   noneMult   검거 불가 적중 점수 배수      noHints   단서 못 씀
   *   shield     오인 체포 벌점을 면제하는 횟수(준비물 "변호사 대기")
   * 모르는 키는 버리고, 값이 이상하면 BAD_OPTION 을 던진다(판을 만들 때 한 번만 검사).
   */
  /*   0.7.0 난이도(단순·강력·미제 사건):
   *   missMul    벌점(오인·함정·검거 불가 오판) 배수(단순 0.5 · 미제 1.5)
   *   hintPenalty 단서 한 번에 줄어드는 초(미제 5). null 이면 모드 기본
   *   lvSpeed    단계가 오르는 속도. 단계 계산에 쓰는 검거 수 = floor(검거 수 × lvSpeed)(단순 0.67 · 미제 1.5)
   */
  var MOD_DEFAULTS = { scoreMult: 1, comboMax: null, hitTime: null, missPenalty: null, noneMult: 1, noHints: false, shield: 0, missMul: 1, hintPenalty: null, lvSpeed: 1 };
  function readMods(m) {
    m = m && typeof m === 'object' ? m : {};
    var out = {};
    Object.keys(MOD_DEFAULTS).forEach(function (k) { out[k] = m[k] == null ? MOD_DEFAULTS[k] : m[k]; });
    var num = function (v, min, max) { return typeof v === 'number' && isFinite(v) && v >= min && v <= max; };
    if (!num(out.scoreMult, 0.1, 10) || !num(out.noneMult, 0.1, 10)) throw GameError('BAD_OPTION', '점수 배수는 0.1~10');
    if (out.comboMax != null && !num(out.comboMax, 1, 20)) throw GameError('BAD_OPTION', '연속 배수 상한은 1~20');
    if (out.hitTime != null && !num(out.hitTime, 0, 30)) throw GameError('BAD_OPTION', '검거 시간은 0~30초');
    if (out.missPenalty != null && !num(out.missPenalty, 0, 60)) throw GameError('BAD_OPTION', '오인 벌점은 0~60초');
    if (!num(out.shield, 0, 10) || Math.floor(out.shield) !== out.shield) throw GameError('BAD_OPTION', '면제 횟수는 0~10 정수');
    if (!num(out.missMul, 0, 5)) throw GameError('BAD_OPTION', '벌점 배수는 0~5');
    if (out.hintPenalty != null && !num(out.hintPenalty, 0, 30)) throw GameError('BAD_OPTION', '단서 벌점은 0~30초');
    if (!num(out.lvSpeed, 0.2, 5)) throw GameError('BAD_OPTION', '단계 속도는 0.2~5');
    out.noHints = out.noHints === true;
    return out;
  }

  /* ---------- 난이도 도우미(0.7.0) — 다섯 모드가 같이 쓴다 ---------- */
  // 벌점 초에 난이도 배수를 곱한다(0.5초 단위 반올림, 0 이상)
  function missPen(state, pen) {
    var m = state && state.mods && state.mods.missMul != null ? state.mods.missMul : 1;
    return Math.max(0, Math.round(pen * m * 2) / 2);
  }
  // 단서 한 번 값(초): 난이도가 정해 두었으면 그것, 아니면 모드 기본
  function hintCost(state, base) {
    var h = state && state.mods ? state.mods.hintPenalty : null;
    return h == null ? base : h;
  }
  // 단계 계산에 쓰는 검거 수
  function lvHits(state) {
    var s = state && state.mods && state.mods.lvSpeed != null ? state.mods.lvSpeed : 1;
    return Math.floor((state.hits || 0) * s + 1e-9);
  }
  // 단계 문턱(need, 평소 검거 수)에 닿으려면 실제로 몇 명을 잡아야 하나(화면의 "다음까지 N명")
  function hitsFor(state, need) {
    var s = state && state.mods && state.mods.lvSpeed != null ? state.mods.lvSpeed : 1;
    return Math.ceil(need / s - 1e-9);
  }

  function assertNow(now) {
    if (typeof now !== 'number' || !isFinite(now)) throw GameError('BAD_TIME', 'now 는 밀리초 숫자여야 한다');
  }

  /*
   * 새 게임. opts:
   *   rng, now(ms)        — 필수
   *   duration(초)        — 기본 90 (사무실 장비 "수사 기간 연장"이 늘린다)
   *   level               — 시작 단계 1~4, 기본 1. 노말은 4.
   *   freeHints           — 시간이 줄지 않는 단서 횟수(장비 "베테랑 형사")
   *   nonePenalty(초)     — 검거 불가 오판 벌점(장비 "증거 보관실"이 줄인다)
   *   mods                — 판마다 바꾸는 규칙(readMods 참고). 없으면 평소 규칙
   * 남은 시간은 "종료 시각(endAt)"으로 들고 있다. 매 프레임 깎지 않아도 되고, 탭을 떠나도 정확하다.
   */
  function createGame(opts) {
    opts = opts || {};
    assertRng(opts.rng);
    assertNow(opts.now);
    var duration = opts.duration == null ? RULES.duration : opts.duration;
    if (!(duration > 0)) throw GameError('BAD_DURATION', '시간은 0보다 커야 한다');
    var level = opts.level == null ? 1 : opts.level;
    assertLevel(level);
    var freeHints = opts.freeHints == null ? 0 : opts.freeHints;
    var nonePenalty = opts.nonePenalty == null ? RULES.wrongNonePenalty : opts.nonePenalty;
    if (!(freeHints >= 0) || !(nonePenalty >= 0)) throw GameError('BAD_OPTION', '단서·벌점 값은 0 이상');
    var mods = readMods(opts.mods);
    return {
      mods: mods, shield: mods.shield, shieldUsed: 0,
      rng: opts.rng,
      level: level,
      startLevel: level,
      board: dealBoard(opts.rng, level),
      clue: null,       // 단서: { set:[i,j,k], shown:n } — 판이 바뀌면 null
      hints: 0, freeHints: freeHints, nonePenalty: nonePenalty,
      score: 0, combo: 0, bestCombo: 0,
      hits: 0, misses: 0, noneHits: 0, noneMisses: 0,
      endAt: opts.now + duration * 1000,
      pausedAt: null,   // 일시정지 중이면 멈춘 시각(ms), 아니면 null
      over: false
    };
  }

  function active(state) { return activeFor(state.level); }

  // 일시정지 중에는 멈춘 시각 기준으로 남은 시간을 센다(시간이 흐르지 않는다)
  function timeLeft(state, now) {
    assertNow(now);
    var at = state.pausedAt != null ? state.pausedAt : now;
    return Math.max(0, (state.endAt - at) / 1000);
  }

  // "처음으로" 확인 창이 떠 있는 동안 시간을 멈춘다. 재개하면 멈춘 만큼 종료 시각을 뒤로 민다.
  function pause(state, now) {
    assertNow(now);
    if (state.over) throw GameError('GAME_OVER', '이미 끝난 판이다');
    if (state.pausedAt == null) state.pausedAt = now;
  }

  function resume(state, now) {
    assertNow(now);
    if (state.pausedAt == null) return;
    state.endAt += Math.max(0, now - state.pausedAt);
    state.pausedAt = null;
  }

  // 시간이 다 됐으면 끝낸다. 끝났는지 돌려준다.
  function tick(state, now) {
    if (state.pausedAt != null) return state.over;
    if (!state.over && timeLeft(state, now) <= 0) state.over = true;
    return state.over;
  }

  function guard(state, now, what) {
    if (state.pausedAt != null) throw GameError('PAUSED', '멈춘 판에서는 ' + what + ' 수 없다');
    if (tick(state, now)) throw GameError('GAME_OVER', '이미 끝난 판이다');
  }

  function addCombo(state) {
    state.combo += 1;
    if (state.combo > state.bestCombo) state.bestCombo = state.combo;
    return multiplierFor(state.combo, state.mods ? state.mods.comboMax : null);
  }

  // 누적 검거 수로 다음 단계를 정한다(올라가기만 한다)
  function levelForHits(startLevel, hits) {
    var lv = startLevel;
    for (var l = startLevel + 1; l <= 4; l++) if (hits >= RULES.levelAt[l]) lv = l;
    return lv;
  }

  /*
   * 검거 시도. idxs = 판 위의 자리 세 개(0~8, 서로 다름). state 를 직접 바꾼다.
   * 반환: 성공 { ok:true, gain, combo, mult, replaced, levelUp? }, 실패 { ok:false, reasons, penalty }
   */
  function submit(state, idxs, now) {
    guard(state, now, '고를');
    if (!Array.isArray(idxs) || idxs.length !== 3) throw GameError('BAD_PICK', '세 명을 골라야 한다');
    for (var i = 0; i < 3; i++) {
      var v = idxs[i];
      if (typeof v !== 'number' || Math.floor(v) !== v || v < 0 || v >= state.board.length) {
        throw GameError('BAD_PICK', '판에 없는 자리: ' + v);
      }
    }
    if (idxs[0] === idxs[1] || idxs[1] === idxs[2] || idxs[0] === idxs[2]) throw GameError('BAD_PICK', '같은 자리를 두 번 골랐다');

    var act = active(state);
    var a = state.board[idxs[0]], b = state.board[idxs[1]], c = state.board[idxs[2]];
    if (isSet(a, b, c, act)) {
      var mult = addCombo(state);
      var md = state.mods || MOD_DEFAULTS;
      var gain = Math.round(RULES.base * mult * md.scoreMult);
      state.score += gain;
      state.hits += 1;
      state.endAt += (md.hitTime == null ? RULES.hitTime : md.hitTime) * 1000;
      state.clue = null;
      var next = levelForHits(state.startLevel, lvHits(state));
      if (next !== state.level) {
        // 새 속성이 열리는 순간: 판 전체를 새 단계에 맞춰 깐다
        state.level = next;
        state.board = dealBoard(state.rng, next);
        return { ok: true, gain: gain, combo: state.combo, mult: mult, levelUp: next, replaced: [0, 1, 2, 3, 4, 5, 6, 7, 8] };
      }
      state.board = refillBoard(state.board, idxs, state.rng, state.level);
      return { ok: true, gain: gain, combo: state.combo, mult: mult, replaced: idxs.slice() };
    }
    state.combo = 0;
    state.misses += 1;
    // 변호사 대기(준비물): 남은 면제 횟수가 있으면 시간을 깎지 않는다(연속은 끊긴다)
    var md2 = state.mods || MOD_DEFAULTS, pen = md2.missPenalty == null ? RULES.missPenalty : md2.missPenalty, shielded = false;
    pen = missPen(state, pen);
    if (state.shield > 0) { state.shield -= 1; state.shieldUsed += 1; pen = 0; shielded = true; }
    state.endAt -= pen * 1000;
    tick(state, now);
    return { ok: false, reasons: explain(a, b, c, act), penalty: pen, shielded: shielded };
  }

  /*
   * "검거 불가" 선언. 판에 한 패가 없으면 적중: 큰 점수 + 판 전체를 새로 깐다.
   * 하나라도 있으면 오판: 시간이 크게 줄고 연속이 끊긴다(몇 패 남았는지만 알려 준다).
   */
  function declareNone(state, now) {
    guard(state, now, '선언할');
    var sets = findSets(state.board, active(state));
    if (sets.length === 0) {
      var mult = addCombo(state);
      var mdn = state.mods || MOD_DEFAULTS;
      var gain = Math.round(RULES.noneBonus * mult * mdn.scoreMult * mdn.noneMult);
      state.score += gain;
      state.noneHits += 1;
      state.endAt += RULES.noneTime * 1000;
      state.board = dealBoard(state.rng, state.level);
      state.clue = null;
      return { ok: true, gain: gain, combo: state.combo, mult: mult };
    }
    state.combo = 0;
    state.noneMisses += 1;
    var np = missPen(state, state.nonePenalty);
    state.endAt -= np * 1000;
    tick(state, now);
    return { ok: false, remaining: sets.length, penalty: np };
  }

  // 단서 한 번의 값: 무료 단서가 남았으면 0초, 아니면 hintPenalty 초
  function chargeHint(state, now) {
    var p = 0;
    if (state.freeHints > 0) state.freeHints -= 1;
    else { p = hintCost(state, RULES.hintPenalty); state.endAt -= p * 1000; }
    state.hints += 1;
    tick(state, now);
    return p;
  }

  /*
   * 단서: 누를 때마다 한 패의 한 명씩, 최대 두 명까지 짚어 준다.
   *   두 명이 보이면 셋째는 하나로 정해지므로 직접 찾게 둔다(규칙을 익히는 연습).
   *   판에 한 패가 없으면 그 사실을 알려 준다(검거 불가를 누르라는 뜻).
   *   이미 두 명을 보여 줬으면 다시 눌러도 깎지 않고 같은 두 명을 돌려준다.
   * 반환: { none:true, penalty } 또는 { indices:[...], penalty }
   */
  function hint(state, now) {
    guard(state, now, '단서를 볼');
    if (state.mods && state.mods.noHints) throw GameError('NO_HINTS', '이 출동은 단서를 쓸 수 없다');
    if (!state.clue) {
      var sets = findSets(state.board, active(state));
      if (sets.length === 0) return { none: true, penalty: chargeHint(state, now) };
      state.clue = { set: sets[pickIndex(state.rng, sets.length)], shown: 0 };
    }
    var penalty = 0;
    if (state.clue.shown < 2) {
      state.clue.shown += 1;
      penalty = chargeHint(state, now);
    }
    return { indices: state.clue.set.slice(0, state.clue.shown), penalty: penalty };
  }

  /* ---------- 튜토리얼 ---------- */
  function shuffle(rng, arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = pickIndex(rng, i + 1), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /*
   * "두 명의 한 패, 셋째는 누구?" 문제 하나.
   *   a, b       : 주어진 두 명(안 보는 속성은 0 으로 맞춰 그림이 단순하다)
   *   answer     : 정답(셋째)
   *   options    : 정답 + 오답들을 섞은 것. 오답은 정답에서 속성 하나만 바꾼 "아깝게 틀린" 사람이라
   *                고르면 explain() 으로 정확히 한 가지 이유가 나온다.
   *   2단계 이상은 "같은 속성"과 "다른 속성"이 적어도 하나씩 섞이게 만들어 두 요령을 다 보게 한다.
   */
  function makeLesson(rng, level) {
    assertRng(rng);
    var act = activeFor(level);
    var a, b, x, y, sameN, diffN;
    for (var guardN = 0; guardN < 500; guardN++) {
      x = [0, 0, 0, 0]; y = [0, 0, 0, 0];
      for (var n = 0; n < act.length; n++) { x[act[n]] = pickIndex(rng, 3); y[act[n]] = pickIndex(rng, 3); }
      sameN = 0; diffN = 0;
      for (var m = 0; m < act.length; m++) { if (x[act[m]] === y[act[m]]) sameN++; else diffN++; }
      if (diffN === 0) continue;                    // 두 명이 똑같으면 문제가 아니다
      if (act.length >= 2 && sameN === 0) continue;  // 같은 것도 하나는 있게
      break;
    }
    a = encode(x); b = encode(y);
    var answer = thirdCard(a, b);
    var ans = decode(answer), wrong = [];
    for (var k = 0; k < act.length; k++) {
      var i = act[k];
      for (var v = 0; v < 3; v++) {
        if (v === ans[i]) continue;
        var d = ans.slice(); d[i] = v;
        var id = encode(d);
        // 1단계는 모자 3가지뿐이라 오답이 주어진 두 명과 똑같은 카드가 된다.
        // 안 보는 흔적 자리만 바꿔 다른 id 로 만든다(그림은 같고 "둘만 같다"는 이유로 틀린다).
        if (id === a || id === b) {
          if (act.indexOf(3) >= 0) continue;
          d[3] = id === a ? 1 : 2;
          id = encode(d);
        }
        wrong.push(id);
      }
    }
    wrong = shuffle(rng, wrong).slice(0, act.length === 1 ? 2 : 3);
    return { level: level, active: act, a: a, b: b, answer: answer, options: shuffle(rng, [answer].concat(wrong)) };
  }

  return {
    ATTRS: ATTRS, ORDER: ORDER, DECK_SIZE: DECK_SIZE, BOARD_SIZE: BOARD_SIZE, RULES: RULES,
    activeFor: activeFor, decode: decode, encode: encode, project: project,
    isSet: isSet, explain: explain, thirdCard: thirdCard, needs: needs, findSets: findSets,
    makeRng: makeRng, drawDistinct: drawDistinct, newBoard: newBoard, refill: refill,
    dealBoard: dealBoard, refillBoard: refillBoard,
    multiplier: multiplier, multiplierFor: multiplierFor, readMods: readMods, MOD_DEFAULTS: MOD_DEFAULTS, createGame: createGame, active: active, timeLeft: timeLeft, tick: tick,
    missPen: missPen, hintCost: hintCost, lvHits: lvHits, hitsFor: hitsFor,
    pause: pause, resume: resume, submit: submit, declareNone: declareNone, hint: hint,
    makeLesson: makeLesson
  };
});
