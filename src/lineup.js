/*
 * Team3Lineup — 사건 3 "증인의 기억"의 퍼즐 규칙: 면통 라인업(0.5.0). 화면·시계·저장소와 무관하다.
 *
 * 규칙
 *   유리 너머로 용의자 5~6명이 한 줄로 선다(왼쪽부터 1번). 목격자가 진술 2~3개를 한다.
 *   진술 = 범인 자신의 특징, 또는 범인 둘레(바로 왼쪽 · 바로 오른쪽 · 옆 · 양 끝)에 대한 말.
 *   진술 "모두"에 맞는 자리는 늘 딱 하나다(정답). 진술 하나라도 빼면 답이 하나로 안 정해진다(모든 진술이 쓸모 있음).
 *
 * 단계(한 판 안에서 검거 수로 오른다)
 *   1 : 5명 · 모자 · 얼굴만 · 진술 2
 *   2 : 5명 · + 시간대 · "아니었어요" 진술
 *   3 : 6명 · 네 특징 모두 · "옆에" 진술
 *   4 : 6명 · 진술 3(자리 관계 2개 이상)
 *
 * 틀리면: 시간 −초, 연속 끊김, 그 자리에 X(같은 문제를 계속 푼다 — 줄은 그대로라 증인이 다시 본다).
 * 단서: 아닌 자리 절반을 지워 준다(문제마다 한 번).
 * 장비(사건 3): 몽타주 화가(문제마다 아닌 자리 하나를 미리 지움) · 조명 기사(오인 벌점 ↓) · 베테랑 증인(검거하면 +초)
 *
 * 한 판의 시간 필드(endAt · pausedAt · over)는 core 와 같아서 SuspectsCore.timeLeft / tick / pause / resume 을 그대로 쓴다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.Team3Lineup = factory(root.SuspectsCore);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  var RULES = {
    duration: 90,
    base: 100,           // 검거 1건 기본 점수(연속 배수는 core 와 같다)
    hitTime: 2,          // 검거하면 +초
    missPenalty: 5,      // 오인 지목 −초
    hintPenalty: 3,      // 단서 −초
    levelAt: { 1: 0, 2: 3, 3: 7, 4: 12 }
  };
  var LEVEL_NAME = { 1: '두 특징', 2: '세 특징', 3: '여섯 명', 4: '진술 셋' };
  var LV = {
    1: { n: 5, attrs: [1, 2], says: 2, kinds: ['self', 'left', 'right', 'edge'] },
    2: { n: 5, attrs: [0, 1, 2], says: 2, kinds: ['self', 'not', 'left', 'right', 'edge'] },
    3: { n: 6, attrs: [0, 1, 2, 3], says: 2, kinds: ['self', 'not', 'left', 'right', 'edge', 'next'] },
    4: { n: 6, attrs: [0, 1, 2, 3], says: 3, kinds: ['self', 'not', 'left', 'right', 'edge', 'next'], rel: 2 }
  };
  var REL = { left: 1, right: 1, edge: 1, next: 1 };

  function LError(code, message) { var e = new Error(message); e.name = 'LineupError'; e.code = code; return e; }
  function pick(rng, n) { var i = Math.floor(rng() * n); return i >= n ? n - 1 : i; }
  function val(id, a) { return C.decode(id)[a]; }

  /** 자리 j 가 진술 s 에 맞는가 */
  function fits(line, j, s) {
    var n = line.length;
    switch (s.kind) {
      case 'self': return val(line[j], s.a) === s.v;
      case 'not': return val(line[j], s.a) !== s.v;
      case 'left': return j > 0 && val(line[j - 1], s.a) === s.v;
      case 'right': return j < n - 1 && val(line[j + 1], s.a) === s.v;
      case 'edge': return j > 0 && j < n - 1;
      case 'next': return (j > 0 && val(line[j - 1], s.a) === s.v) || (j < n - 1 && val(line[j + 1], s.a) === s.v);
    }
    throw LError('BAD_SAY', '모르는 진술: ' + s.kind);
  }
  /** 진술 목록 모두에 맞는 자리들 */
  function candidates(line, says) {
    var out = [];
    for (var j = 0; j < line.length; j++) if (says.every(function (s) { return fits(line, j, s); })) out.push(j);
    return out;
  }

  /**
   * 문제 하나. 반환 { line:[id…], says:[{kind,a,v}…], ans, attrs, level, out:[] }
   *   out = 지워진(아닌 것으로 밝혀진) 자리. 아주 드물게 조건을 못 맞추면 다시 만든다(4000번 안에 늘 성공 — 시험으로 확인).
   */
  function makeQuestion(rng, level) {
    var cfg = LV[level];
    if (!cfg) throw LError('BAD_LEVEL', '단계는 1~4: ' + level);
    for (var g = 0; g < 4000; g++) {
      // 서로 다른 n명(보는 특징만으로도 서로 달라 보이게)
      var line = [], seen = {};
      for (var guard = 0; line.length < cfg.n && guard < 500; guard++) {
        var id = pick(rng, 81), key = C.project(id, cfg.attrs).join('');
        if (seen[key]) continue;
        seen[key] = 1; line.push(id);
      }
      if (line.length < cfg.n) continue;
      var n = line.length, ans = pick(rng, n), says = [], rel = 0, tries = 0;
      while (says.length < cfg.says && tries++ < 40) {
        var kind = cfg.kinds[pick(rng, cfg.kinds.length)], a = cfg.attrs[pick(rng, cfg.attrs.length)], s = null;
        if (kind === 'self') s = { kind: kind, a: a, v: val(line[ans], a) };
        else if (kind === 'not') s = { kind: kind, a: a, v: (val(line[ans], a) + 1 + pick(rng, 2)) % 3 };
        else if (kind === 'left' && ans > 0) s = { kind: kind, a: a, v: val(line[ans - 1], a) };
        else if (kind === 'right' && ans < n - 1) s = { kind: kind, a: a, v: val(line[ans + 1], a) };
        else if (kind === 'edge' && ans > 0 && ans < n - 1) s = { kind: kind, a: -1, v: -1 };
        else if (kind === 'next') {
          var nb = []; if (ans > 0) nb.push(ans - 1); if (ans < n - 1) nb.push(ans + 1);
          s = { kind: kind, a: a, v: val(line[nb[pick(rng, nb.length)]], a) };
        }
        if (!s || !fits(line, ans, s)) continue;
        if (says.some(function (x) { return x.kind === s.kind && x.a === s.a && x.v === s.v; })) continue;
        if (s.kind === 'edge' && says.some(function (x) { return x.kind === 'edge'; })) continue;
        says.push(s); rel += REL[s.kind] || 0;
      }
      if (says.length !== cfg.says || (cfg.rel && rel < cfg.rel)) continue;
      if (candidates(line, says).length !== 1) continue;
      // 진술 하나만 빼도 답이 하나로 정해지면 그 진술은 쓸모없다 → 다시
      if (says.some(function (x, i) { return candidates(line, says.filter(function (y, k) { return k !== i; })).length === 1; })) continue;
      return { line: line, says: says, ans: ans, attrs: cfg.attrs.slice(), level: level, out: [] };
    }
    throw LError('GEN_FAILED', '문제를 만들지 못했다');
  }

  function levelForHits(hits, start) {
    var lv = 1;
    for (var l = 2; l <= 4; l++) if (hits >= RULES.levelAt[l]) lv = l;
    return Math.min(4, Math.max(lv, start || 1));
  }

  /**
   * 한 판. opts: rng, now(ms) 필수 / duration / freeHints / mods(core.readMods 와 같은 것)
   *   missPenalty(초, 장비 "조명 기사") / hitBonus(초, 장비 "베테랑 증인") / preOut(0|1, 장비 "몽타주 화가")
   */
  function createGame(opts) {
    opts = opts || {};
    if (typeof opts.rng !== 'function') throw LError('BAD_RNG', 'rng 는 함수');
    if (typeof opts.now !== 'number' || !isFinite(opts.now)) throw LError('BAD_TIME', 'now 는 밀리초');
    var duration = opts.duration == null ? RULES.duration : opts.duration;
    if (!(duration > 0)) throw LError('BAD_DURATION', '시간은 0보다 커야 한다');
    var mods = C.readMods(opts.mods);
    var missPenalty = opts.missPenalty == null ? RULES.missPenalty : opts.missPenalty;
    var hitBonus = opts.hitBonus == null ? 0 : opts.hitBonus;
    var preOut = opts.preOut ? 1 : 0;
    if (!(missPenalty >= 0 && missPenalty <= 30) || !(hitBonus >= 0 && hitBonus <= 10)) throw LError('BAD_OPTION', '벌점, 보너스 범위');
    var st = {
      mode: 'lineup', rng: opts.rng, level: 1, startLevel: 1,
      missPenalty: missPenalty, hitBonus: hitBonus, preOut: preOut,
      q: null, hintShown: false, hints: 0, freeHints: opts.freeHints || 0,
      mods: mods, shield: mods.shield, shieldUsed: 0,
      score: 0, combo: 0, bestCombo: 0, hits: 0, misses: 0, noneHits: 0, noneMisses: 0,
      endAt: opts.now + duration * 1000, pausedAt: null, over: false
    };
    st.q = fresh(st, 1);
    return st;
  }
  // 새 문제(장비 "몽타주 화가"면 아닌 자리 하나를 미리 지운다)
  function fresh(state, level) {
    var q = makeQuestion(state.rng, level);
    if (state.preOut) {
      var wrong = []; for (var j = 0; j < q.line.length; j++) if (j !== q.ans) wrong.push(j);
      q.out.push(wrong[pick(state.rng, wrong.length)]);
    }
    return q;
  }
  function guard(state, now) {
    if (state.pausedAt != null) throw LError('PAUSED', '멈춘 판');
    if (C.tick(state, now)) throw LError('GAME_OVER', '끝난 판');
  }

  /**
   * 한 자리 지목. 반환
   *   맞음: { ok:true, gain, combo, mult, ans, levelUp? }  → 다음 문제로
   *   틀림: { ok:false, penalty, shielded, broke:[어긋난 진술 번호…] }  → 같은 문제(그 자리는 X)
   */
  function choose(state, idx, now) {
    guard(state, now);
    var q = state.q, md = state.mods;
    if (typeof idx !== 'number' || Math.floor(idx) !== idx || idx < 0 || idx >= q.line.length) throw LError('BAD_PICK', '줄에 없는 자리: ' + idx);
    if (q.out.indexOf(idx) >= 0) throw LError('ALREADY_OUT', '이미 아닌 것으로 밝혀진 자리: ' + idx);
    if (idx === q.ans) {
      state.combo += 1;
      if (state.combo > state.bestCombo) state.bestCombo = state.combo;
      var mult = C.multiplierFor(state.combo, md.comboMax);
      var gain = Math.round(RULES.base * mult * md.scoreMult);
      state.score += gain; state.hits += 1;
      state.endAt += ((md.hitTime == null ? RULES.hitTime : md.hitTime) + (state.hitBonus || 0)) * 1000;
      var lv = levelForHits(C.lvHits(state), state.startLevel), up = lv !== state.level;
      state.level = lv;
      state.q = fresh(state, lv);
      state.hintShown = false;
      return { ok: true, gain: gain, combo: state.combo, mult: mult, ans: idx, levelUp: up ? lv : undefined };
    }
    var pen = C.missPen(state, md.missPenalty == null ? state.missPenalty : md.missPenalty), shielded = false;   // 특별 출동 규칙이 있으면 그것 · 난이도 배수
    if (state.shield > 0) { state.shield -= 1; state.shieldUsed += 1; pen = 0; shielded = true; }
    state.combo = 0; state.misses += 1;
    state.endAt -= pen * 1000;
    q.out.push(idx);
    var broke = [];
    q.says.forEach(function (s, i) { if (!fits(q.line, idx, s)) broke.push(i); });
    C.tick(state, now);
    return { ok: false, penalty: pen, shielded: shielded, broke: broke };
  }

  /** 단서: 아직 안 지운 "아닌 자리"의 절반(올림)을 지운다. 문제마다 한 번. 반환 { out:[새로 지운 자리], penalty } */
  function hint(state, now) {
    guard(state, now);
    if (state.mods && state.mods.noHints) throw LError('NO_HINTS', '단서를 쓸 수 없는 출동');
    if (state.hintShown) return { out: [], penalty: 0 };
    var q = state.q, left = [];
    for (var j = 0; j < q.line.length; j++) if (j !== q.ans && q.out.indexOf(j) < 0) left.push(j);
    var k = Math.ceil(left.length / 2), got = [];
    while (got.length < k) { var i = pick(state.rng, left.length); got.push(left.splice(i, 1)[0]); }
    var p = 0;
    if (state.freeHints > 0) state.freeHints -= 1;
    else { p = C.hintCost(state, RULES.hintPenalty); state.endAt -= p * 1000; }
    q.out = q.out.concat(got);
    state.hints += 1; state.hintShown = true;
    C.tick(state, now);
    return { out: got, penalty: p };
  }

  // 특징 말(조사까지). em = 강조 표시 여부(화면은 <em>, 읽기용은 그냥 글자)
  function feat(a, v, em) {
    var w = C.ATTRS[a].values[v], o = em ? '<em>' : '', c = em ? '</em>' : '';
    if (a === 0) return o + w + c + '에 찍힌 사람';
    if (a === 1) return v === 0 ? o + '모자를 안 쓴' + c + ' 사람' : o + w + c + '를 쓴 사람';
    if (a === 2) return v === 0 ? o + '얼굴을 안 가린' + c + ' 사람' : o + w + c + (v === 1 ? '을 쓴' : '를 한') + ' 사람';
    return o + w + c + ' 흔적을 남긴 사람';
  }
  /** 진술 문장. html=true 면 핵심 낱말을 <em> 으로 감싼다(문장에 사용자 입력은 없다) */
  function sayText(s, html) {
    var o = html ? '<em>' : '', c = html ? '</em>' : '';
    switch (s.kind) {
      case 'self': return '범인은 ' + feat(s.a, s.v, html) + '이었어요';
      case 'not': return '범인은 ' + feat(s.a, s.v, html) + '이 ' + o + '아니었어요' + c;
      case 'left': return '범인 ' + o + '바로 왼쪽' + c + '은 ' + feat(s.a, s.v, html) + '이었어요';
      case 'right': return '범인 ' + o + '바로 오른쪽' + c + '은 ' + feat(s.a, s.v, html) + '이었어요';
      case 'edge': return '범인은 ' + o + '양 끝' + c + '에 서 있지 않았어요';
      case 'next': return '범인 ' + o + '옆에' + c + ' ' + feat(s.a, s.v, html) + '이 있었어요';
    }
    return '';
  }

  return { RULES: RULES, LEVEL_NAME: LEVEL_NAME, LV: LV, fits: fits, candidates: candidates, makeQuestion: makeQuestion,
           levelForHits: levelForHits, createGame: createGame, choose: choose, hint: hint, sayText: sayText };
});
