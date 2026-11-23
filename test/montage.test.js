'use strict';
// 특별 출동 몽타주 수배(0.5.0): 그려지는 순서 · 배수 · 멈춤 · 판정 · 단서
const test = require('node:test');
const assert = require('node:assert');
const C = require('../src/core.js');
const M = require('../src/montage.js');
function mul(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const T0 = 1e12;

test('문제: 카드는 서로 다르고 정답 하나, 특징이 다 드러나면 맞는 카드는 정답뿐', () => {
  const rng = mul(9);
  for (let i = 0; i < 2000; i++) {
    const q = M.makeQuestion(rng, 1 + i % 2, T0);
    assert.equal(q.cards.length, q.level === 1 ? 9 : 12);
    assert.equal(new Set(q.cards).size, q.cards.length);
    assert.equal(q.cards.filter(c => c === q.ans).length, 1);
    assert.deepEqual([...q.order].sort(), [0, 1, 2, 3]);
  }
});

test('그려지는 수 · 배수: 1 → 4, 단계 1은 2.4초 간격, 멈춘 동안은 안 흐름', () => {
  const g = M.createGame({ rng: mul(1), now: T0 });
  assert.equal(M.shown(g, T0), 1); assert.equal(M.multNow(g, T0), 4);
  assert.equal(M.shown(g, T0 + 2400), 2); assert.equal(M.shown(g, T0 + 99999), 4); assert.equal(M.multNow(g, T0 + 99999), 1);
  assert.equal(M.nextIn(g, T0 + 400), 2000); assert.equal(M.nextIn(g, T0 + 99999), -1);
  M.pause(g, T0 + 500); assert.equal(M.shown(g, T0 + 5000), 1);
  M.resume(g, T0 + 5000); assert.equal(M.shown(g, T0 + 6800), 1); assert.equal(M.shown(g, T0 + 6900), 2);
  assert.equal(C.timeLeft(g, T0 + 5000), 89.5);
});

test('판정: 빨리 맞히면 ×4, 틀리면 −5초 · X · 같은 문제, 5명 잡으면 12장 단계', () => {
  const g = M.createGame({ rng: mul(2), now: T0, duration: 999 }), q = g.q;
  const wrong = q.cards.findIndex(c => c !== q.ans);
  const r = M.choose(g, wrong, T0);
  assert.equal(r.ok, false); assert.equal(r.penalty, 5); assert.deepEqual(q.out, [wrong]);
  assert.throws(() => M.choose(g, wrong, T0), { code: 'ALREADY_OUT' });
  const ok = M.choose(g, q.cards.indexOf(q.ans), T0 + 100);
  assert.equal(ok.mult, 4); assert.equal(ok.gain, 400); assert.equal(g.early, 1);
  let up = null;
  for (let i = 0; i < 4; i++) { const t = T0 + 10000 * (i + 1), x = M.choose(g, g.q.cards.indexOf(g.q.ans), t); if (x.levelUp) up = [g.hits, x.levelUp]; }
  assert.deepEqual(up, [5, 2]); assert.equal(g.q.cards.length, 12);
});

test('단서: 다음 특징을 바로(벌점 없음), 넷이면 그대로, 단서 금지 출동이면 막힘', () => {
  const g = M.createGame({ rng: mul(3), now: T0 });
  assert.equal(M.hint(g, T0).shown, 2); M.hint(g, T0); M.hint(g, T0);
  assert.equal(M.hint(g, T0).shown, 4); assert.equal(g.hints, 3); assert.equal(C.timeLeft(g, T0), 90);
  assert.equal(M.activeNow(g, T0).length, 4);
  assert.throws(() => M.hint(M.createGame({ rng: mul(3), now: T0, mods: { noHints: true } }), T0), { code: 'NO_HINTS' });
});

test('말: 특징마다 짧은 말', () => {
  assert.equal(M.word(0, 2), '밤에 봤어요'); assert.equal(M.word(1, 0), '모자 없음'); assert.equal(M.word(3, 1), '유리 조각 흔적');
});
