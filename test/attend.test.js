'use strict';
// 0.10.2 출석 체크: 현실 날짜 · 특별한 날 · 하루 한 번 · 달이 바뀌면 새 판
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../src/attend.js');

test('특별한 날: 7 · 14 · 21일과 그 달 마지막 날은 큰 보상', () => {
  assert.deepEqual(A.reward(7, 30), { big: true, tickets: 2, gems: 20 });
  assert.deepEqual(A.reward(30, 30), { big: true, tickets: 5, gems: 50 });
  assert.deepEqual(A.reward(28, 28), { big: true, tickets: 5, gems: 50 });   // 2월은 28일이 마지막 날
  assert.ok(!A.reward(1, 30).big && !A.reward(2, 30).big);
});

test('하루 한 번, 받은 칸은 표시, 다음 날 또 받는다', () => {
  const s = { gems: 0 }, got = [];
  A.clean(s);
  const r = A.check(s, '2026-11-07', (k, v) => got.push(k + v));
  assert.equal(r.tickets, 2); assert.equal(s.gems, 20); assert.deepEqual(got, ['tickets2']);
  assert.throws(() => A.check(s, '2026-11-07'), (e) => e.code === 'ALREADY');
  const b = A.board(s, '2026-11-08');
  assert.equal(b.cells[6].got, true); assert.equal(b.done, false); assert.equal(b.last, 30); assert.equal(b.dow, 0);   // 2026-11-01 은 일요일
  A.check(s, '2026-11-08'); assert.equal(s.gems, 25);
});

test('달이 바뀌면 새 판, 이상한 저장은 버린다', () => {
  const s = { attend: { month: '2026-11', got: { 3: true, 40: true, x: true, 5: 'y' } } };
  A.clean(s);
  assert.deepEqual(s.attend.got, { 3: true });
  assert.equal(A.board(s, '2026-12-01').count, 0);
  assert.equal(s.attend.month, '2026-12');
});
