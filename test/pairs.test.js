'use strict';
// 특별 출동 공범 짝 찾기(0.14.1): 판마다 카드는 꼭 둘씩 · 닮은 사람 · 뒤집기 · 판 다 치우기 · 단서
const test = require('node:test');
const assert = require('node:assert');
const C = require('../src/core.js');
const Q = require('../src/pairs.js');
function mul(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const T0 = 1e12;
const key = (id, act) => C.project(id, act).join('');

test('판: 보이는 모습마다 꼭 두 장, 단계별 장수, 3단계엔 하나만 다른 닮은 짝', () => {
  const rng = mul(9);
  for (let i = 0; i < 600; i++) {
    const lv = 1 + (i % 3), q = Q.makeBoard(rng, lv), cfg = Q.LV[lv], cnt = {};
    q.cards.forEach(x => { const k = key(x, q.attrs); cnt[k] = (cnt[k] || 0) + 1; });
    assert.ok(Object.values(cnt).every(n => n === 2), '모습마다 두 장');
    assert.equal(q.cards.length, 2 * (cfg.pairs + (cfg.decoy || 0)));
    if (lv === 3) {
      const ks = Object.keys(cnt);
      const near = ks.filter(a => ks.some(b => b !== a && [...a].filter((c, j) => c !== b[j]).length === 1));
      assert.ok(near.length >= 2, '닮은 짝이 있다');
    }
  }
});

test('뒤집기: 짝이면 남고 점수, 아니면 덮임 · 연속 끊김, 열린 카드는 다시 못 뒤집음', () => {
  const g = Q.createGame({ rng: mul(4), now: T0 });
  const q = g.q, a = 0, b = q.cards.findIndex((x, j) => j !== 0 && key(x, q.attrs) === key(q.cards[0], q.attrs));
  const c = q.cards.findIndex((x, j) => j !== 0 && key(x, q.attrs) !== key(q.cards[0], q.attrs));
  assert.deepEqual(Q.flip(g, a, T0 + 1), { open: a });
  assert.throws(() => Q.flip(g, a, T0 + 2), e => e.code === 'ALREADY_OPEN');
  let r = Q.flip(g, c, T0 + 3);
  assert.equal(r.match, false); assert.equal(g.combo, 0); assert.deepEqual(r.pair, [a, c]);
  Q.cover(g); assert.equal(g.q.up.length, 0);
  Q.flip(g, a, T0 + 4); r = Q.flip(g, b, T0 + 5);
  assert.ok(r.match); assert.equal(r.gain, Q.RULES.base); assert.equal(g.hits, 1); assert.deepEqual(g.q.done.sort(), [a, b].sort());
  assert.throws(() => Q.flip(g, b, T0 + 6), e => e.code === 'ALREADY_OPEN');
});

test('판 다 치우기: 보너스 + 4초 + 새 판, 짝 수로 단계가 올라 장수가 늘어남', () => {
  const g = Q.createGame({ rng: mul(8), now: T0, duration: 9999 });
  const sizes = new Set();
  for (let round = 0; round < 6; round++) {
    const q = g.q; sizes.add(q.cards.length);
    const groups = {};
    q.cards.forEach((x, j) => { const k = key(x, q.attrs); (groups[k] = groups[k] || []).push(j); });
    const pairs = Object.values(groups);
    let r;
    for (const [x, y] of pairs) { Q.flip(g, x, T0 + 1); r = Q.flip(g, y, T0 + 2); assert.ok(r.match); }
    assert.ok(r.cleared); assert.ok(r.bonus > 0); assert.notStrictEqual(g.q, q);
  }
  assert.deepEqual([...sizes].sort((a, b) => a - b), [8, 12, 16]);
});

test('단서: 못 찾은 짝 하나, 벌점은 한 번', () => {
  const g = Q.createGame({ rng: mul(2), now: T0 });
  const e = g.endAt, h = Q.hint(g, T0 + 1);
  assert.equal(key(g.q.cards[h.pair[0]], g.q.attrs), key(g.q.cards[h.pair[1]], g.q.attrs));
  assert.notEqual(h.pair[0], h.pair[1]);
  assert.equal(g.endAt, e - Q.RULES.hintPenalty * 1000);
  assert.equal(Q.hint(g, T0 + 2).penalty, 0);
});
