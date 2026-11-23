'use strict';
// 0.10.3 일간 · 주간 · 월간 임무
const test = require('node:test');
const assert = require('node:assert/strict');
const Q = require('../src/quest.js');

test('주 · 달 열쇠: 주간은 월요일부터, 월간은 1일부터', () => {
  assert.equal(Q.keyOf('w', '2026-11-24'), '2026-11-23');   // 화요일 → 그 주 월요일
  assert.equal(Q.keyOf('w', '2026-11-23'), '2026-11-23');
  assert.equal(Q.keyOf('w', '2026-11-22'), '2026-11-16');   // 일요일은 지난 주
  assert.equal(Q.keyOf('m', '2026-11-24'), '2026-11');
});

test('세고 · 채우면 받고 · 두 번은 못 받는다 · 날이 바뀌면 일간만 새로', () => {
  const s = { gems: 0 }, got = []; Q.clean(s);
  const d = '2026-11-24';
  Q.track(s, 'run', 2, d);
  assert.throws(() => Q.claim(s, 'd_run', d), (e) => e.code === 'NOT_DONE');
  Q.track(s, 'run', 1, d);
  assert.equal(Q.ready(s, d), 1);
  Q.claim(s, 'd_run', d, (k, v) => got.push(k + v));
  assert.equal(s.gems, 5);
  assert.throws(() => Q.claim(s, 'd_run', d), (e) => e.code === 'ALREADY');
  assert.equal(Q.list(s, 'w', d).find((x) => x.id === 'w_run').n, 3);
  const d2 = '2026-11-25';
  assert.equal(Q.list(s, 'd', d2).find((x) => x.id === 'd_run').n, 0);
  assert.equal(Q.list(s, 'w', d2).find((x) => x.id === 'w_run').n, 3);
});

test('일간을 다 받으면 완료 상자', () => {
  const s = { gems: 0 }, got = []; Q.clean(s);
  const d = '2026-11-24';
  Q.LIST.d.forEach((x) => Q.track(s, x.kind, x.goal, d));
  assert.equal(Q.boxState(s, d).ready, false);
  Q.LIST.d.forEach((x) => Q.claim(s, x.id, d, (k, v) => got.push(k)));
  assert.equal(Q.boxState(s, d).ready, true);
  Q.claim(s, 'box', d, (k, v) => got.push(k + v));
  assert.ok(got.includes('tickets1'));
  assert.equal(Q.boxState(s, d).got, true);
});
