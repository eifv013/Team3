'use strict';
// 난이도(0.7.0): 단순 · 강력 · 미제 사건
const test = require('node:test');
const assert = require('node:assert');
const Df = require('../src/diff.js');
const C = require('../src/core.js');
const LU = require('../src/lineup.js');
const W = require('../src/witness.js');
const F = require('../src/forgery.js');
const MT = require('../src/montage.js');
const I = require('../src/idle.js');
const Ev = require('../src/evidence.js');
const H = require('../src/ach.js');
const T0 = 1e12;
function rng(seed) { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }

test('저장: 기본은 강력 사건 · 고른 적 없음, 이상한 값은 고친다', () => {
  const s = I.newSave(T0);
  assert.equal(Df.get(s), 'normal'); assert.equal(Df.chosen(s), false);
  s.diff = { k: 'nightmare', set: 'yes', hardRuns: -4, hardCase: { 1: true, x: true, 2: 'y' } };
  Df.clean(s);
  assert.deepEqual(s.diff, { k: 'normal', set: false, hardRuns: 0, hardGold: 0, hardCase: { 1: true }, best: 0, easyRuns: 0, stepUp: false, bests: { easy: 0, normal: 0, hard: 0 } });
  assert.equal(Df.set(s, 'hard'), true); assert.equal(Df.chosen(s), true); assert.equal(Df.set(s, 'hard'), false);
  assert.throws(() => Df.set(s, 'x'), { code: 'BAD_DIFF' });
  // 저장 · 읽기를 지나도 남는다
  const back = I.load(JSON.stringify(s), T0).save; Df.clean(back);
  assert.equal(Df.get(back), 'hard'); assert.equal(back.diff.hardCase['1'], true);
});

test('출동 설정: 시간 · 무료 단서 · 벌점 · 단서 값 · 단계 속도, 원래 설정은 건드리지 않는다', () => {
  const base = { duration: 90, freeHints: 1, mods: { shield: 1 } };
  const e = Df.applyRun(base, 'easy'), n = Df.applyRun(base, 'normal'), h = Df.applyRun(base, 'hard');
  assert.equal(e.duration, 120); assert.equal(e.freeHints, 2); assert.equal(e.mods.missMul, 0.5); assert.equal(e.mods.lvSpeed, 0.67); assert.equal(e.mods.hintPenalty, undefined); assert.equal(e.diff, 'easy');
  assert.equal(n.duration, 90); assert.equal(n.freeHints, 1); assert.equal(n.mods.missMul, 1);
  assert.equal(h.duration, 75); assert.equal(h.mods.hintPenalty, 5); assert.equal(h.mods.missMul, 1.5); assert.equal(h.mods.shield, 1);
  assert.deepEqual(base, { duration: 90, freeHints: 1, mods: { shield: 1 } });
  // 짧은 특별 출동: 30초 밑으로는 줄이지 않는다
  assert.equal(Df.applyRun({ duration: 40 }, 'hard').duration, 30);
  assert.equal(Df.applyRun({ duration: 20 }, 'hard').duration, 20);
  // 단서를 못 쓰는 출동이면 단서 값은 그대로
  assert.equal(Df.applyRun({ duration: 60, mods: { noHints: true } }, 'hard').mods.hintPenalty, undefined);
  // core 가 받아들이는 값
  [e, n, h].forEach(c => C.createGame({ rng: rng(1), now: T0, duration: c.duration, mods: c.mods }));
  assert.throws(() => C.readMods({ missMul: 9 }), { code: 'BAD_OPTION' });
  assert.throws(() => C.readMods({ lvSpeed: 0 }), { code: 'BAD_OPTION' });
});

// 판에서 한 패가 아닌 세 자리를 찾는다(오인 체포 시험용)
function wrongPick(g) {
  const act = C.active(g);
  for (let a = 0; a < 9; a++) for (let b = a + 1; b < 9; b++) for (let c = b + 1; c < 9; c++)
    if (!C.isSet(g.board[a], g.board[b], g.board[c], act)) return [a, b, c];
  return null;
}

test('한 패(core): 오인 벌점 · 검거 불가 오판 · 단서 값이 난이도대로', () => {
  for (const [k, miss, none, hint] of [['easy', 2.5, 5, 3], ['normal', 5, 10, 3], ['hard', 7.5, 15, 5]]) {
    const cfg = Df.applyRun({ duration: 90 }, k);
    let g, pick;
    for (let sd = 1; !pick; sd++) { g = C.createGame({ rng: rng(sd), now: T0, duration: cfg.duration, mods: cfg.mods }); pick = wrongPick(g); }
    assert.equal(C.submit(g, pick, T0).penalty, miss, k + ' 오인');
    // 검거 불가 오판(한 패가 남아 있는 판)
    let g2;
    for (let sd = 1; ; sd++) { g2 = C.createGame({ rng: rng(sd), now: T0, duration: cfg.duration, mods: cfg.mods }); if (C.findSets(g2.board, C.active(g2)).length) break; }
    assert.equal(C.declareNone(g2, T0).penalty, none, k + ' 오판');
    const g3 = C.createGame({ rng: rng(3), now: T0, duration: cfg.duration, mods: cfg.mods, freeHints: 0 });
    const left = C.timeLeft(g3, T0); C.hint(g3, T0);
    assert.equal(left - C.timeLeft(g3, T0), hint, k + ' 단서');
  }
});

test('단계 속도: 단순은 늦게, 미제는 빨리(검거 수 × 속도)', () => {
  const st = k => ({ hits: 0, mods: C.readMods(Df.applyRun({}, k).mods) });
  const need = (k, lv) => { const s = st(k); while (C.lvHits(s) < C.RULES.levelAt[lv]) s.hits += 1; return s.hits; };
  assert.equal(need('normal', 4), 7);
  assert.equal(need('easy', 4), 11);
  assert.equal(need('hard', 4), 5);
  assert.ok(need('easy', 2) > need('normal', 2) && need('hard', 2) <= need('normal', 2));
});

test('다른 퍼즐 모드도 벌점 · 단서에 난이도를 따른다', () => {
  const m = Df.applyRun({ duration: 90 }, 'hard').mods;
  // 라인업: 틀린 자리 지목
  const lg = LU.createGame({ rng: rng(5), now: T0, duration: 90, mods: m });
  const wrong = lg.q.line.findIndex((_, i) => i !== lg.q.ans);
  assert.equal(LU.choose(lg, wrong, T0).penalty, 7.5);
  const lg2 = LU.createGame({ rng: rng(6), now: T0, duration: 90, mods: m });
  assert.equal(LU.hint(lg2, T0).penalty, 5);
  // 목격자: 단서 값
  const wg = W.createGame({ rng: rng(7), now: T0, duration: 90, mods: m });
  assert.equal(W.hint(wg, T0).penalty, 5);
  // 위조: 단서 값
  const fg = F.createGame({ rng: rng(8), now: T0, duration: 90, mods: m });
  assert.equal(F.hint(fg, T0).penalty, 5);
  // 몽타주: 단서는 시간 벌점이 없는 방식이라 그대로 0
  const mg = MT.createGame({ rng: rng(9), now: T0, duration: 90, mods: m });
  assert.equal(MT.hint(mg, T0).penalty, 0);
});

test('출동 수사비 · 재수사 몫: 단순 ×0.7 · ×0.8, 미제 ×1.5 · ×1.25', () => {
  const pays = {}, earns = {};
  for (const k of Df.ORDER) {
    const s = I.newSave(T0), L = Df.info(k); let got = 0;
    I.setEarn((sv, v) => { got += v; });
    pays[k] = I.applyRun(s, { score: 1000, hits: 3, diffMult: L.pay, clueMult: L.clue }, T0).money;
    earns[k] = got;
  }
  I.setEarn(null);
  assert.equal(pays.easy, Math.round(pays.normal * 0.7)); assert.equal(pays.hard, Math.round(pays.normal * 1.5));
  assert.equal(earns.easy, Math.round(earns.normal * 0.8)); assert.equal(earns.hard, Math.round(earns.normal * 1.25));
  // 이상한 배수는 1로
  const s = I.newSave(T0);
  assert.equal(I.applyRun(s, { score: 1000, hits: 1, diffMult: 99 }, T0).money, pays.normal);
});

test('특별 출동 보너스 · 미제 기록 · 결과 줄', () => {
  const s = I.newSave(T0); Df.clean(s);
  assert.deepEqual(Df.dailyBonus(s, 'normal', '금'), { gems: 0, tickets: 0 });
  assert.deepEqual(Df.dailyBonus(s, 'hard', null), { gems: 0, tickets: 0 });
  assert.deepEqual(Df.dailyBonus(s, 'hard', '은'), { gems: 1, tickets: 0 });
  assert.deepEqual(Df.dailyBonus(s, 'hard', '금'), { gems: 1, tickets: 1 });
  assert.equal(s.diff.hardGold, 1);
  Df.noteClose(s, 1); assert.equal(Df.hardCases(s), 0, '강력 사건으로 닫으면 기록 안 함');
  Df.set(s, 'hard'); Df.noteClose(s, 1); Df.noteClose(s, 1); assert.equal(Df.hardCases(s), 1);
  assert.equal(Df.resultLine('hard'), '미제 사건 · 수사비 ×1.5');
  assert.equal(Df.resultLine('normal'), '강력 사건');
});

test('미제 전용: 증거 카드 3장은 미제 출동 10번에, 업적 4개 + 승급', () => {
  const s = I.newSave(T0); Ev.clean(s); Df.clean(s);
  const cold = Ev.CARDS.filter(c => c.tier === 4);
  assert.equal(cold.length, 3);
  assert.equal(Ev.tierOpen(s, 4), false);
  for (let i = 0; i < Df.HARD_CARD_RUNS; i++) Df.noteRun(s, 'hard');
  Df.noteRun(s, 'easy');
  assert.equal(s.diff.hardRuns, 10); assert.equal(Ev.tierOpen(s, 4), true); assert.equal(Df.hardCardsOpen(s), true);
  const hard = H.LIST.filter(a => a.group === '난이도');
  assert.deepEqual(hard.map(a => a.id), ['stepup', 'hard1', 'hard50', 'hardgold', 'hardcase']);
  H.clean(s); H.check(s);
  assert.ok(s.ach.got.hard1); assert.ok(!s.ach.got.hard50);
});

test('화면의 "다음까지 N명"은 단계 속도를 반영한다', () => {
  const g = k => ({ hits: 0, mods: C.readMods(Df.applyRun({}, k).mods) });
  assert.equal(C.hitsFor(g('normal'), 2), 2);
  assert.equal(C.hitsFor(g('easy'), 2), 3);
  assert.equal(C.hitsFor(g('hard'), 7), 5);
  // hitsFor 만큼 잡으면 정말로 그 단계 문턱에 닿는다
  for (const k of Df.ORDER) for (const need of [2, 3, 4, 5, 7, 8, 12]) {
    const s = g(k); s.hits = C.hitsFor(s, need); assert.ok(C.lvHits(s) >= need, k + need);
    s.hits -= 1; assert.ok(C.lvHits(s) < need, k + need + ' 하나 적으면 못 닿음');
  }
});

test('실력 업적: 단순 사건 점수는 안 세고, 예전 최고 점수는 강력 사건으로 인정 · 승급 업적', () => {
  const s = I.newSave(T0); s.bestScore = 12000; Df.clean(s);
  assert.equal(s.diff.best, 12000, '예전 기록은 그대로');
  H.clean(s); H.check(s);
  assert.ok(s.ach.got.score10k); assert.ok(!s.ach.got.score20k);
  Df.noteRun(s, 'easy', 50000); s.bestScore = 50000; H.check(s);
  assert.ok(!s.ach.got.score20k, '단순 사건 점수로는 점수 업적 안 됨');
  assert.equal(s.diff.stepUp, false);
  Df.noteRun(s, 'normal', 21000); H.check(s);
  assert.ok(s.ach.got.score20k); assert.equal(s.diff.best, 21000);
  assert.equal(s.diff.stepUp, true); assert.ok(s.ach.got.stepup);
  assert.equal(Df.countsSkill('easy'), false); assert.equal(Df.countsSkill('hard'), true);
  assert.ok(H.LIST.find(a => a.id === 'score3k').desc.startsWith('강력 사건 이상'));
});

test('출동 기록판: 난이도마다 최고 점수, 예전 최고 점수는 강력 사건', () => {
  const s = I.newSave(T0); s.bestScore = 9000; Df.clean(s);
  assert.deepEqual(s.diff.bests, { easy: 0, normal: 9000, hard: 0 });
  Df.noteRun(s, 'easy', 12000); Df.noteRun(s, 'hard', 3000); Df.noteRun(s, 'hard', 2000); Df.noteRun(s, 'normal', 8000);
  assert.deepEqual(s.diff.bests, { easy: 12000, normal: 9000, hard: 3000 });
  const back = I.load(JSON.stringify(s), T0).save; Df.clean(back);
  assert.deepEqual(back.diff.bests, { easy: 12000, normal: 9000, hard: 3000 });
});
