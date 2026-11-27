'use strict';
// 특별 출동 검거팡(0.14.1): 시작 판은 안 터지고 바꿀 곳이 있다 · 바꾸기 · 연쇄 · 단계 · 단서
const test = require('node:test');
const assert = require('node:assert');
const C = require('../src/core.js');
const P = require('../src/pang.js');
function mul(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const T0 = 1e12;

test('판: 36칸, 처음부터 터진 줄 없음, 바꿀 곳은 늘 있음, 종류 수', () => {
  const rng = mul(3);
  for (let i = 0; i < 400; i++) {
    const k = P.KINDS[1 + (i % 3)], b = P.makeBoard(rng, k);
    assert.equal(b.length, 36); assert.equal(P.lines(b).length, 0); assert.ok(P.findMove(b));
    assert.ok(b.every(t => t >= 0 && t < k));
  }
  assert.deepEqual(P.lines([0, 0, 0, 1, 2, 3].concat(Array(30).fill(0).map((_, i) => 1 + (i % 5) + (Math.floor(i / 6) % 2)))).slice(0, 3), [0, 1, 2]);
});

test('바꾸기: 셋이 되면 사라지고 채워짐 · 점수 · +초, 안 되면 그대로, 옆자리만', () => {
  const g = P.createGame({ rng: mul(7), now: T0, duration: 999 });
  const mv = P.findMove(g.q.b), before = g.q.b.slice(), end = g.endAt;
  const r = P.swap(g, mv[0], mv[1], T0 + 1);
  assert.ok(r.ok); assert.ok(r.steps.length >= 1); assert.ok(r.steps[0].pop.length >= 3);
  assert.ok(r.gain > 0); assert.equal(g.score, r.gain); assert.equal(g.hits, 1);
  assert.ok(g.endAt >= end + 1000);
  const last = r.steps[r.steps.length - 1].board;
  assert.equal(P.lines(last).length, 0, '연쇄가 끝난 판에는 터질 줄이 없다');
  assert.ok(last.every(t => t >= 0 && t < g.q.kinds));
  assert.notDeepEqual(g.q.b, before);
  // 안 되는 바꾸기: 판 그대로, 연속 끊김
  let bad = null;
  for (let i = 0; i < 35 && !bad; i++) if (i % 6 < 5 && g.q.b[i] !== g.q.b[i + 1] && !P.lines((() => { const x = g.q.b.slice(); [x[i], x[i + 1]] = [x[i + 1], x[i]]; return x; })()).length) bad = [i, i + 1];
  const b2 = g.q.b.slice(), s2 = g.score;
  assert.deepEqual(P.swap(g, bad[0], bad[1], T0 + 2), { ok: false });
  assert.deepEqual(g.q.b, b2); assert.equal(g.score, s2); assert.equal(g.combo, 0);
  assert.throws(() => P.swap(g, 0, 7, T0 + 3), e => e.code === 'NOT_ADJACENT');
  assert.throws(() => P.swap(g, 0, 36, T0 + 3), e => e.code === 'BAD_PICK');
});

test('단계: 맞춘 횟수로 종류가 5 → 6 → 7, 오르면 새 판', () => {
  const g = P.createGame({ rng: mul(11), now: T0, duration: 9999 });
  const kinds = new Set();
  for (let i = 0; i < 25; i++) { kinds.add(g.q.kinds); const mv = P.findMove(g.q.b); const r = P.swap(g, mv[0], mv[1], T0 + i); if (r.levelUp) assert.equal(g.q.kinds, P.KINDS[r.levelUp]); assert.ok(P.findMove(g.q.b), '바꿀 곳이 늘 있다'); }
  assert.deepEqual([...kinds].sort(), [5, 6, 7]);
});

test('단서: 바꿀 수 있는 자리, 무료 먼저, 한 번에 한 번만 벌점', () => {
  const g = P.createGame({ rng: mul(5), now: T0, freeHints: 1 });
  const e = g.endAt, h = P.hint(g, T0 + 1);
  assert.equal(h.penalty, 0); assert.ok(P.adjacent(h.move[0], h.move[1]));
  assert.equal(P.swap(g, h.move[0], h.move[1], T0 + 2).ok, true);
  const h2 = P.hint(g, T0 + 3); assert.equal(h2.penalty, P.RULES.hintPenalty); assert.equal(g.endAt, e + (g.endAt - e));
  assert.equal(P.hint(g, T0 + 4).penalty, 0, '같은 판에서 다시 누르면 벌점 없음');
  const g2 = P.createGame({ rng: mul(5), now: T0, mods: { noHints: true } });
  assert.throws(() => P.hint(g2, T0 + 1), e2 => e2.code === 'NO_HINTS');
});
