// Team3Ach(0.3.0): 업적 달성·보상·칭호 달기·칭호 사기·저장 검사
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const I = require('../src/idle.js');
const P = require('../src/pets.js');
const H = require('../src/ach.js');
const T0 = 1_700_000_000_000;
function fresh() { const s = I.newSave(T0); P.clean(s); H.clean(s); return s; }

test('업적 id 는 겹치지 않고, 칭호는 10자 안', () => {
  const ids = new Set(H.LIST.map(a => a.id).concat(H.SHOP.map(t => t.id)));
  assert.equal(ids.size, H.LIST.length + H.SHOP.length);
  H.LIST.concat(H.SHOP).forEach(a => assert.ok(Array.from(a.title).length <= H.TITLE_MAX, a.title));
});

test('달성하면 칭호는 바로, 보상은 눌러 받기(한 번만) · 모두 받기 · 예전 저장은 받은 것으로(0.6.0)', () => {
  const s = fresh();
  assert.deepEqual(H.check(s), []);
  s.runs = 1;
  assert.deepEqual(H.check(s).map(a => a.id), ['run1']);
  assert.ok(H.has(s, 'run1')); assert.equal(s.pets.tickets, 0); assert.equal(H.unclaimed(s), 1);
  assert.deepEqual(H.claim(s, 'run1', P.addTickets), { n: 1, tickets: 1, gems: 0 });
  assert.equal(s.pets.tickets, 1);
  assert.throws(() => H.claim(s, 'run1', P.addTickets), { code: 'ALREADY' });
  assert.throws(() => H.claim(s, 'score3k', P.addTickets), { code: 'NOT_DONE' });
  s.bestScore = 20000;
  assert.deepEqual(H.check(s).map(a => a.id), ['score3k', 'score10k', 'score20k', 'score5k']);
  assert.equal(H.unclaimed(s), 4);
  assert.deepEqual(H.claim(s, null, P.addTickets), { n: 4, tickets: 1 + 3 + 5 + 2, gems: 30 });
  assert.equal(s.gems, 30); assert.equal(H.unclaimed(s), 0);
  const old = { ach: { got: { run1: true } } }; H.clean(old);
  assert.equal(H.unclaimed(old), 0, '예전 저장은 이미 받았다');
  const back = { ach: JSON.parse(JSON.stringify(s.ach)) }; back.ach.claimed = {}; H.clean(back);
  assert.equal(H.unclaimed(back), 5, '받기 전 저장은 그대로 남는다');
});

test('사건 종결 · 동물 · 특별 출동 기록', () => {
  const s = fresh();
  s.past = [{ no: 1, caught: 3000, closedAt: 1 }];
  P.grant(s, 'tiger', 'l');
  H.noteDaily(s, '금'); H.noteDaily(s, '은'); H.noteDaily(s, null);
  const ids = H.check(s, P.addTickets).map(a => a.id);
  assert.ok(ids.includes('case1') && ids.includes('legend1'));
  assert.ok(!ids.includes('case2') && !ids.includes('daily5'));
  assert.equal(s.ach.stat.dailyMedals, 2);
  assert.equal(s.ach.stat.dailyGold, 1);
});

test('칭호: 달성한 것만 달 수 있고, 배지로 산 칭호도 된다', () => {
  const s = fresh(); s.gems = 25;
  assert.throws(() => H.setTitle(s, 'run1'), { code: 'LOCKED' });
  s.runs = 1; H.check(s);
  H.setTitle(s, 'run1');
  assert.equal(H.leaderTitle(s), '새내기');
  assert.throws(() => H.buy(s, 's-detective'), { code: 'NOT_ENOUGH' });
  H.buy(s, 's-cute');
  assert.equal(s.gems, 5);
  assert.throws(() => H.buy(s, 's-cute'), { code: 'ALREADY' });
  assert.throws(() => H.setPetTitle(s, 'corgi:c', 's-cute'), { code: 'NOT_OWNED' });
  P.grant(s, 'corgi', 'c');
  H.setPetTitle(s, 'corgi:c', 's-cute');
  assert.equal(H.petTitle(s, 'corgi:c'), '귀요미');
  H.setPetTitle(s, 'corgi:c', '');
  assert.equal(H.petTitle(s, 'corgi:c'), '');
  H.setTitle(s, '');
  assert.equal(H.leaderTitle(s), '');
  assert.deepEqual(H.owned(s).map(t => t.title), ['새내기', '귀요미']);
});

test('저장: load 로 넘어오고, clean 이 모르는 값 · 없는 칭호를 버린다', () => {
  const s = fresh(); s.runs = 1; H.check(s); H.setTitle(s, 'run1');
  const back = I.load(I.serialize(s), T0).save;
  H.clean(back);
  assert.equal(H.leaderTitle(back), '새내기');
  const bad = { ach: { got: { run1: true, nope: true }, bought: { 's-cute': true, x: true }, title: 'score20k', pet: { 'corgi:c': 'run1', 'BAD': 'run1' }, stat: { dailyGold: -3 } } };
  const a = H.clean(bad);
  assert.deepEqual(a.got, { run1: true });
  assert.deepEqual(a.bought, { 's-cute': true });
  assert.equal(a.title, '');
  assert.deepEqual(a.pet, { 'corgi:c': 'run1' });
  assert.equal(a.stat.dailyGold, 0);
});
