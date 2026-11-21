// 출동 전환 고르기(pick): 화면 없이 시험한다
const test = require('node:test');
const assert = require('node:assert');
const T = require('../src/transit.js');

test('평소 A·B·C, 주범 조 E·F·G', () => {
  assert.deepEqual(T.NORMAL, ['A', 'B', 'C']);
  assert.deepEqual(T.BIG, ['E', 'F', 'G']);
});

test('pick: 바로 전에 나온 건 다시 안 나온다', () => {
  for (let i = 0; i < 200; i++) {
    const r = Math.random();
    for (const last of ['A', 'B', 'C']) assert.notEqual(T.pick(T.NORMAL, last, () => r), last);
  }
});

test('pick: 처음(last 없음)엔 셋 다 나올 수 있다', () => {
  const seen = new Set([0, 0.34, 0.67, 0.99].map(r => T.pick(T.NORMAL, null, () => r)));
  assert.deepEqual([...seen].sort(), ['A', 'B', 'C']);
});

test('pick: 이상한 난수와 빈 목록', () => {
  assert.equal(T.pick(T.NORMAL, null, () => NaN), 'A');
  assert.equal(T.pick(T.NORMAL, null, () => 1), 'A');
  assert.equal(T.pick(['A'], 'A', () => 0.5), 'A');      // 하나뿐이면 같은 것이라도 낸다
  assert.throws(() => T.pick([], null));
});
