'use strict';
// 살아 있는 사무실(0.6.0): 유치장 · 이송 · 커피 · 창밖 날씨
const test = require('node:test');
const assert = require('node:assert');
const O = require('../src/office.js');
const I = require('../src/idle.js');
const T0 = 1e12;

test('유치장: 20명까지 모이고, 이송하면 모인 수 × 1명 수사비 보너스 후 비움', () => {
  const s = { money: 0, detectives: 3 };
  O.clean(s);
  assert.equal(O.addCatches(s, 7), 7); assert.equal(O.addCatches(s, 30), 13); assert.ok(O.isFull(s));
  const r = O.transfer(s, 15);
  assert.deepEqual(r, { n: 20, bonus: 300 }); assert.equal(s.money, 300); assert.equal(s.office.cell, 0); assert.equal(s.office.sent, 20);
  assert.throws(() => O.transfer(s, 15), { code: 'EMPTY' });
});

test('커피: 책상마다 5분에 한 번, 1명 수사비 + 유치장 1, 없는 책상은 안 됨', () => {
  const s = { money: 0, detectives: 2 }; O.clean(s);
  assert.deepEqual(O.coffee(s, 1, T0, 15), { gain: 15, cell: true });
  assert.throws(() => O.coffee(s, 1, T0 + 1000, 15), { code: 'COOLDOWN' });
  assert.equal(O.coffeeLeft(s, 1, T0 + 100000), 200);
  assert.equal(O.coffee(s, 1, T0 + 300000, 15).gain, 15);
  assert.throws(() => O.coffee(s, 2, T0, 15), { code: 'BAD_DESK' });
  s.detectives = 30; assert.equal(O.deskCount(s), O.DESKS);
});

test('저장: 깨진 값은 바로잡고, idle 저장을 거쳐도 남는다', () => {
  const s = { office: { cell: 99, sent: -3, cups: { 0: T0, 9: T0, x: 1, 2: 'a' } } };
  O.clean(s);
  assert.deepEqual(s.office, { cell: 20, sent: 0, cups: { 0: T0 }, names: {} });
  const a = I.newSave(T0); O.clean(a); O.addCatches(a, 5);
  const b = I.load(I.serialize(a), T0).save; O.clean(b);
  assert.equal(b.office.cell, 5);
});

test('날씨: 계절 = 사건 진척, 20분 칸마다 바뀌고 같은 칸에선 같음, 계절에 맞는 것만, 해무항은 안개', () => {
  assert.deepEqual([0, 0.24, 0.25, 0.5, 0.75, 1].map(O.seasonOf), ['spring', 'spring', 'summer', 'autumn', 'winter', 'winter']);
  const base = new Date(2026, 10, 22, 12, 0).getTime(), slot = O.WEATHER_SLOT;
  const seen = { spring: new Set(), summer: new Set(), autumn: new Set(), winter: new Set() };
  for (let k = 0; k < 300; k++) for (const p of [0.1, 0.4, 0.6, 0.9]) {
    const w = O.weather(new Date(base + k * slot), 1, p);
    seen[w.season].add(w.kind);
    assert.equal(O.weather(new Date(base + k * slot + slot - 1000), 1, p).kind, w.kind, '같은 20분 칸');
  }
  assert.deepEqual([...seen.spring].sort(), ['clear', 'petal', 'rain']);
  assert.deepEqual([...seen.summer].sort(), ['clear', 'rain']);
  assert.deepEqual([...seen.autumn].sort(), ['clear', 'leaf', 'rain']);
  assert.deepEqual([...seen.winter].sort(), ['clear', 'snow']);
  let changes = 0; for (let k = 1; k < 30; k++) if (O.weather(new Date(base + k * slot), 1, 0.6).kind !== O.weather(new Date(base + (k - 1) * slot), 1, 0.6).kind) changes++;
  assert.ok(changes >= 5, '20분마다 자주 바뀐다: ' + changes);
  assert.equal(O.weather(new Date(base), 2, 0.1).fog, true);
  assert.equal(O.weather(new Date(2026, 3, 5, 22), 1, 0).time, 'night'); assert.equal(O.weather(new Date(2026, 3, 5, 18), 1, 0).time, 'dusk');
});

test('0.10.5 형사 이름: 기본 · 바꾸기 · 되돌리기 · 저장 정리', () => {
  const s = {};
  O.clean(s);
  assert.equal(O.copName(s, 0), '김 형사');
  assert.equal(O.renameCop(s, 0, '  <b>번개</b>형사님입니다  '), 'b번개/b형사님');
  assert.equal(O.renameCop(s, 0, ''), '김 형사');
  O.renameCop(s, 3, '독수리');
  s.office.names[99] = '없는자리'; s.office.names[2] = 42;
  O.clean(s);
  assert.deepEqual(s.office.names, { 3: '독수리' });
  assert.throws(() => O.renameCop(s, 9, 'x'), { code: 'BAD_DESK' });
});
