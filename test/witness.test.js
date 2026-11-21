// Team3Witness(0.2.0): 목격자 진술 퍼즐 — 문제 보장·고르기·단서·단계·시간
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/core.js');
const W = require('../src/witness.js');

test('문제 보장: 단계마다 2,000문제 — 진술과 딱 셋 맞는 사람은 범인 하나, 함정은 넷 다 맞음, 사람은 겹치지 않음', () => {
  const rng = C.makeRng(7);
  for (const lv of [1, 2, 3]) {
    let traps = 0, vague = 0, two = 0, n = 0;
    for (let t = 0; t < 2000; t++) {
      const q = W.makeQuestion(rng, lv);
      assert.equal(q.board.length, lv === 3 ? 12 : 9);
      assert.equal(new Set(q.board).size, q.board.length);
      const three = q.board.filter((id) => W.matches(id, q.says) === 3);
      assert.deepEqual(three, [q.target]);
      assert.equal(q.says.find((s) => s.k === q.lie).vals.includes(C.decode(q.target)[q.lie]), false, '거짓 진술은 범인과 안 맞는다');
      if (q.trap >= 0) { traps++; assert.equal(W.matches(q.trap, q.says), 4); }
      assert.ok(q.board.filter((id) => W.matches(id, q.says) === 4).length <= 1);
      if (q.says.some((s) => s.vals.length > 1)) vague++;
      two += q.board.filter((id) => W.matches(id, q.says) === 2).length; n += q.board.length;
    }
    if (lv > 1) assert.ok(traps > 1900, '보통·어려움은 거의 늘 함정');
    if (lv === 3) assert.ok(vague > 1500, '어려움은 대부분 흐린 진술');
    if (lv === 1) assert.equal(vague, 0);
    if (lv > 1) assert.ok(two / n > 0.5, '보통부터 두 개 맞는 사람이 반 넘게');
  }
  assert.throws(() => W.makeQuestion(rng, 4), (e) => e.code === 'BAD_LEVEL');
});

function game(opts = {}) { return W.createGame(Object.assign({ rng: C.makeRng(3), now: 0 }, opts)); }

test('맞히면 점수·연속·시간이 오르고 다음 문제로, 검거 3명이면 보통·8명이면 어려움', () => {
  const g = game(), end0 = g.endAt;
  let ups = [];
  for (let i = 0; i < 8; i++) {
    const r = W.choose(g, g.q.board.indexOf(g.q.target), 1000 + i);
    assert.ok(r.ok);
    if (r.levelUp) ups.push(r.levelUp);
  }
  assert.deepEqual(ups, [2, 3]);
  assert.equal(g.level, 3); assert.equal(g.q.board.length, 12);
  assert.equal(g.hits, 8); assert.equal(g.combo, 8);
  assert.equal(g.endAt, end0 + 8 * W.RULES.hitTime * 1000);
  assert.ok(g.score > 800);
});

test('오인 체포·함정: 시간이 줄고 연속이 끊기고, 다음 문제로 넘어간다. 함정은 따로 센다', () => {
  const g = game({ rng: C.makeRng(11) });
  // 함정이 있는 문제가 나올 때까지 오인으로 넘긴다
  let r, guard = 0;
  while (g.q.trap < 0 && guard++ < 50) { const wrong = g.q.board.findIndex((id) => id !== g.q.target); W.choose(g, wrong, 100); }
  const end0 = g.endAt, q0 = g.q;
  r = W.choose(g, g.q.board.indexOf(g.q.trap), 200);
  assert.equal(r.ok, false); assert.equal(r.trap, true); assert.equal(r.penalty, W.RULES.trapPenalty);
  assert.equal(r.matched, 4); assert.equal(r.target, q0.board.indexOf(q0.target));
  assert.equal(g.endAt, end0 - W.RULES.trapPenalty * 1000);
  assert.equal(g.traps, 1); assert.equal(g.combo, 0);
  assert.notEqual(g.q, q0, '다음 문제');
});

test('변호사(shield)는 벌점을 면제, 단서는 거짓 진술을 짚고 한 문제에 한 번만 값을 받는다', () => {
  const g = game({ mods: { shield: 1 }, freeHints: 1 });
  const end0 = g.endAt;
  const r = W.choose(g, g.q.board.findIndex((id) => id !== g.q.target && id !== g.q.trap), 100);
  assert.ok(r.shielded); assert.equal(r.penalty, 0); assert.equal(g.endAt, end0);
  const h1 = W.hint(g, 200); assert.equal(h1.penalty, 0, '무료 단서');
  assert.equal(h1.lie, g.q.lie);
  assert.equal(W.hint(g, 300).penalty, 0, '같은 문제는 다시 값을 받지 않는다');
  W.choose(g, g.q.board.indexOf(g.q.target), 400);
  assert.equal(W.hint(g, 500).penalty, W.RULES.hintPenalty);
  const ng = game({ mods: { noHints: true } });
  assert.throws(() => W.hint(ng, 100), (e) => e.code === 'NO_HINTS');
});

test('시간: core 의 timeLeft/pause/resume/tick 을 그대로 쓴다. 끝난 판·멈춘 판에서는 못 고른다', () => {
  const g = game({ duration: 10 });
  C.pause(g, 1000);
  assert.throws(() => W.choose(g, 0, 2000), (e) => e.code === 'PAUSED');
  C.resume(g, 5000);
  assert.equal(C.timeLeft(g, 5000), 9);
  assert.throws(() => W.choose(g, 0, 20000), (e) => e.code === 'GAME_OVER');
  assert.throws(() => W.choose(game(), 99, 0), (e) => e.code === 'BAD_PICK');
  assert.throws(() => W.createGame({ rng: Math.random, now: 'x' }), (e) => e.code === 'BAD_TIME');
});

test('진술 문장: 넷 다 다른 말, 흐린 진술은 종류를 말하지 않는다', () => {
  assert.equal(W.sayText({ k: 1, vals: [2] }), '중절모를 썼어요');
  assert.match(W.sayText({ k: 1, vals: [1, 2] }), /못 봤어요/);
  assert.equal(W.sayText({ k: 2, vals: [1, 2] }), '얼굴에 뭔가 쓰고 있었어요');
});

test('장비 옵션: 함정 벌점(진술 녹음기)과 검거 보너스(부두 정보원)', () => {
  const g = W.createGame({ rng: C.makeRng(5), now: 0, trapPenalty: 2, hitBonus: 3 });
  const e0 = g.endAt;
  W.choose(g, g.q.board.indexOf(g.q.target), 10);
  assert.equal(g.endAt, e0 + (W.RULES.hitTime + 3) * 1000);
  let guard = 0; while (g.q.trap < 0 && guard++ < 50) W.choose(g, g.q.board.indexOf(g.q.target), 20);
  const e1 = g.endAt; const r = W.choose(g, g.q.board.indexOf(g.q.trap), 30);
  assert.equal(r.penalty, 2); assert.equal(g.endAt, e1 - 2000);
  assert.throws(() => W.createGame({ rng: Math.random, now: 0, trapPenalty: 99 }), (e) => e.code === 'BAD_OPTION');
});
