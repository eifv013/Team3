/*
 * Team3IdCheck — 사건 4 "빌린 얼굴"의 퍼즐 규칙: 신분증 검사(0.14.0). 화면·시계·저장소와 무관하다.
 *
 * 규칙
 *   검문소 창구에 한 명씩 온다. 왼쪽은 그 사람(사진 카드), 오른쪽은 그 사람이 내민 신분증(특징 글).
 *   신분증이 사진과 한 군데라도 다르면 위조 → 체포. 모두 같으면 통과.
 *   위조는 늘 "딱 한 군데"만 틀린다(써드의 손버릇. 이야기 1,500명 편에서 밝힌다).
 *   4단계부터는 수배 조건이 붙는다: 신분증이 진짜여도 수배 조건(특징 하나)에 걸리면 체포.
 *
 * 단계(한 판 안에서 맞힌 수로 오른다)
 *   1 : 모자, 얼굴
 *   2 : + 시간대
 *   3 : 네 특징 모두
 *   4 : 네 특징 + 수배 조건
 *
 * 맞히면(통과든 체포든): 점수(연속 배수는 core 와 같다), 시간 +초, 다음 사람.
 * 틀리면: 시간 −초, 연속 끊김, 다음 사람(한 명을 두 번 보지 않는다. 창구는 기다려 주지 않는다).
 * 단서: 신분증에서 사진과 맞는 줄 절반에 확인 표시(사람마다 한 번). 위조면 틀린 줄은 늘 남는다.
 * 장비(사건 4): 자외선 램프(사람마다 맞는 줄 하나를 미리 확인) · 검문 교관(오판 벌점 ↓) · 교대 근무조(맞히면 +초)
 *
 * 한 판의 시간 필드(endAt · pausedAt · over)는 core 와 같아서 SuspectsCore.timeLeft / tick / pause / resume 을 그대로 쓴다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.Team3IdCheck = factory(root.SuspectsCore);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';
  var RULES = {
    duration: 90,
    base: 60,            // 한 명 1건 기본 점수(판단이 빨라 면통 100보다 낮게. 연속 배수는 core 와 같다)
    hitTime: 1,          // 맞히면 +초
    missPenalty: 5,      // 오판 −초
    hintPenalty: 3,      // 단서 −초
    forgedRate: 0.5,     // 위조 비율
    wantedRate: 0.3,     // 4단계: 진짜 신분증인데 수배에 걸리는 사람 비율(위조가 아닐 때)
    levelAt: { 1: 0, 2: 4, 3: 10, 4: 18 }
  };
  var LEVEL_NAME = { 1: '두 특징', 2: '세 특징', 3: '네 특징', 4: '수배 조건' };
  var LV = {
    1: { attrs: [1, 2] },
    2: { attrs: [0, 1, 2] },
    3: { attrs: [0, 1, 2, 3] },
    4: { attrs: [0, 1, 2, 3], wanted: true }
  };
  function IError(code, message) { var e = new Error(message); e.name = 'IdCheckError'; e.code = code; return e; }
  function pick(rng, n) { var i = Math.floor(rng() * n); return i >= n ? n - 1 : i; }

  /**
   * 한 사람. 반환 { id, doc:[값 4개], attrs, forged, diff(틀린 특징 번호, 없으면 -1), wanted:{a,v}|null,
   *                arrest(정답이 체포인가), why:'forged'|'wanted'|'clean', checked:[확인 표시된 특징], level }
   */
  function makeQuestion(rng, level) {
    var cfg = LV[level];
    if (!cfg) throw IError('BAD_LEVEL', '단계는 1~4: ' + level);
    var id = pick(rng, 81), v = C.decode(id), doc = v.slice(), attrs = cfg.attrs.slice();
    var forged = rng() < RULES.forgedRate, diff = -1, wanted = null;
    if (forged) { diff = attrs[pick(rng, attrs.length)]; doc[diff] = (doc[diff] + 1 + pick(rng, 2)) % 3; }
    if (cfg.wanted) {
      wanted = { a: attrs[pick(rng, attrs.length)], v: pick(rng, 3) };
      // 진짜 신분증 중 일부는 일부러 수배에 걸리게(사진과 신분증을 같이 바꾼다 → 신분증은 여전히 진짜)
      if (!forged && rng() < RULES.wantedRate) { var w = v.slice(); w[wanted.a] = wanted.v; id = C.encode(w); v = w; doc = w.slice(); }
    }
    var wantedHit = !!(wanted && v[wanted.a] === wanted.v);
    return { id: id, doc: doc, attrs: attrs, forged: forged, diff: diff, wanted: wanted,
             arrest: forged || wantedHit, why: forged ? 'forged' : wantedHit ? 'wanted' : 'clean', checked: [], level: level };
  }
  /** 신분증에서 사진과 맞는 줄(특징 번호) */
  function okRows(q) { var v = C.decode(q.id); return q.attrs.filter(function (a) { return q.doc[a] === v[a]; }); }

  function levelForHits(hits, start) {
    var lv = 1;
    for (var l = 2; l <= 4; l++) if (hits >= RULES.levelAt[l]) lv = l;
    return Math.min(4, Math.max(lv, start || 1));
  }
  /**
   * 한 판. opts: rng, now(ms) 필수 / duration / freeHints / mods(core.readMods 와 같은 것)
   *   missPenalty(초, 장비 "검문 교관") / hitBonus(초, 장비 "교대 근무조") / preCheck(0|1, 장비 "자외선 램프")
   */
  function createGame(opts) {
    opts = opts || {};
    if (typeof opts.rng !== 'function') throw IError('BAD_RNG', 'rng 는 함수');
    if (typeof opts.now !== 'number' || !isFinite(opts.now)) throw IError('BAD_TIME', 'now 는 밀리초');
    var duration = opts.duration == null ? RULES.duration : opts.duration;
    if (!(duration > 0)) throw IError('BAD_DURATION', '시간은 0보다 커야 한다');
    var mods = C.readMods(opts.mods);
    var missPenalty = opts.missPenalty == null ? RULES.missPenalty : opts.missPenalty;
    var hitBonus = opts.hitBonus == null ? 0 : opts.hitBonus;
    if (!(missPenalty >= 0 && missPenalty <= 30) || !(hitBonus >= 0 && hitBonus <= 10)) throw IError('BAD_OPTION', '벌점, 보너스 범위');
    var st = {
      mode: 'idcheck', rng: opts.rng, level: 1, startLevel: 1,
      missPenalty: missPenalty, hitBonus: hitBonus, preCheck: opts.preCheck ? 1 : 0,
      q: null, hintShown: false, hints: 0, freeHints: opts.freeHints || 0,
      mods: mods, shield: mods.shield, shieldUsed: 0,
      score: 0, combo: 0, bestCombo: 0, hits: 0, misses: 0, noneHits: 0, noneMisses: 0,
      arrests: 0, passes: 0, wantedHits: 0,
      endAt: opts.now + duration * 1000, pausedAt: null, over: false
    };
    st.q = fresh(st, 1);
    return st;
  }
  // 다음 사람(장비 "자외선 램프"면 맞는 줄 하나를 미리 확인)
  function fresh(state, level) {
    var q = makeQuestion(state.rng, level);
    if (state.preCheck) { var ok = okRows(q); if (ok.length) q.checked.push(ok[pick(state.rng, ok.length)]); }
    return q;
  }
  function guard(state, now) {
    if (state.pausedAt != null) throw IError('PAUSED', '멈춘 판');
    if (C.tick(state, now)) throw IError('GAME_OVER', '끝난 판');
  }
  /**
   * 판단 하나. arrest = true(체포) | false(통과). 반환
   *   { ok, arrest(정답), why, diff, wanted, gain, combo, mult, levelUp?, penalty, shielded }
   *   맞든 틀리든 다음 사람으로 넘어간다(반환 값은 방금 사람 기준).
   */
  function decide(state, arrest, now) {
    guard(state, now);
    if (arrest !== true && arrest !== false) throw IError('BAD_PICK', '체포 또는 통과만');
    var q = state.q, md = state.mods, r = { arrest: q.arrest, why: q.why, diff: q.diff, wanted: q.wanted, id: q.id };
    if (arrest === q.arrest) {
      state.combo += 1;
      if (state.combo > state.bestCombo) state.bestCombo = state.combo;
      var mult = C.multiplierFor(state.combo, md.comboMax);
      r.gain = Math.round(RULES.base * mult * md.scoreMult);
      state.score += r.gain; state.hits += 1;
      if (q.arrest) { state.arrests += 1; if (q.why === 'wanted') state.wantedHits += 1; } else state.passes += 1;
      state.endAt += ((md.hitTime == null ? RULES.hitTime : md.hitTime) + (state.hitBonus || 0)) * 1000;
      r.ok = true; r.combo = state.combo; r.mult = mult;
    } else {
      var pen = C.missPen(state, md.missPenalty == null ? state.missPenalty : md.missPenalty), shielded = false;   // 특별 출동 규칙이 있으면 그것 · 난이도 배수
      if (state.shield > 0) { state.shield -= 1; state.shieldUsed += 1; pen = 0; shielded = true; }
      state.combo = 0; state.misses += 1;
      state.endAt -= pen * 1000;
      r.ok = false; r.penalty = pen; r.shielded = shielded;
    }
    var lv = levelForHits(C.lvHits(state), state.startLevel);
    if (lv !== state.level) r.levelUp = lv;
    state.level = lv;
    state.q = fresh(state, lv);
    state.hintShown = false;
    C.tick(state, now);
    return r;
  }
  /** 단서: 아직 확인 안 한 "맞는 줄"의 절반(올림)에 확인 표시. 사람마다 한 번. 반환 { rows:[새로 확인한 특징], penalty } */
  function hint(state, now) {
    guard(state, now);
    if (state.mods && state.mods.noHints) throw IError('NO_HINTS', '단서를 쓸 수 없는 출동');
    if (state.hintShown) return { rows: [], penalty: 0 };
    var q = state.q, left = okRows(q).filter(function (a) { return q.checked.indexOf(a) < 0; });
    var k = Math.ceil(left.length / 2), got = [];
    while (got.length < k) { var i = pick(state.rng, left.length); got.push(left.splice(i, 1)[0]); }
    var p = 0;
    if (state.freeHints > 0) state.freeHints -= 1;
    else { p = C.hintCost(state, RULES.hintPenalty); state.endAt -= p * 1000; }
    q.checked = q.checked.concat(got);
    state.hints += 1; state.hintShown = true;
    C.tick(state, now);
    return { rows: got, penalty: p };
  }
  /** 판정 이유 글(화면용) */
  function iga(w) { var c = w.charCodeAt(w.length - 1) - 0xAC00; return w + (c >= 0 && c < 11172 && c % 28 ? '이' : '가'); }   // 받침에 맞춘 "이/가"
  function whyText(r) {
    if (r.why === 'forged') return iga(C.ATTRS[r.diff].name) + ' 달라요';
    if (r.why === 'wanted') return '수배 조건(' + C.ATTRS[r.wanted.a].values[r.wanted.v] + ')';
    return '신분증이 맞아요';
  }
  return { RULES: RULES, LEVEL_NAME: LEVEL_NAME, LV: LV, makeQuestion: makeQuestion, okRows: okRows,
           levelForHits: levelForHits, createGame: createGame, decide: decide, hint: hint, whyText: whyText };
});
