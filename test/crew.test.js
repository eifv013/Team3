'use strict';
// 0.8.0 팀원 직무 · 공용 장비 · 수사 기법
const test = require('node:test');
const assert = require('node:assert');
const Cr = require('../src/crew.js');
const Ev = require('../src/evidence.js');
const I = require('../src/idle.js');
const T0 = 1e12;
function fresh(caseNo) { const s = I.newSave(T0); s.caseNo = caseNo || 1; s.money = 1e9; Ev.clean(s); Cr.clean(s); return s; }

test('목록: 직무 · 장비는 사건마다 2개, 기법은 증거마다 1개(51)', () => {
  [1, 2, 3].forEach(n => { assert.equal(Cr.ROLES.filter(x => x.caseNo === n).length, 2); assert.equal(Cr.KITS.filter(x => x.caseNo === n).length, 2); });
  assert.equal(Cr.techs().length, Ev.CARDS.length);
  assert.equal(new Set(Cr.techs().map(x => x.name)).size, Ev.CARDS.length, '기법 이름이 겹치지 않음');
  Cr.techs().forEach(x => assert.ok(Cr.NAME[x.key], x.id + ' 효과 키'));
});

test('사건에 따라 열리고, 다음 사건 것은 잠겨 있다', () => {
  const s = fresh(1);
  assert.deepEqual(Cr.rolesOpen(s).map(x => x.id), ['mentor', 'stake']);
  assert.deepEqual(Cr.rolesNext(s).map(x => x.id), ['coast', 'canvass']);
  assert.throws(() => Cr.buy(s, 'r', 'coast'), { code: 'LOCKED' });
  s.caseNo = 3;
  assert.equal(Cr.rolesOpen(s).length, 6); assert.equal(Cr.kitsOpen(s).length, 6); assert.equal(Cr.rolesNext(s).length, 0);
});

test('사기: 값 · 단계 · 수사비 · 모자람 · 다 올림', () => {
  const s = fresh(1); s.money = 2500;
  assert.equal(Cr.roleCost(s, 'mentor'), 2500);
  assert.equal(Cr.buy(s, 'r', 'mentor'), 1); assert.equal(s.money, 0);
  assert.equal(Cr.roleCost(s, 'mentor'), 3000);
  assert.throws(() => Cr.buy(s, 'r', 'mentor'), { code: 'NOT_ENOUGH' });
  s.money = 1e9; Cr.buy(s, 'k', 'radio'); Cr.buy(s, 'k', 'radio');
  assert.equal(Cr.kitCost(s, 'radio'), null);
  assert.throws(() => Cr.buy(s, 'k', 'radio'), { code: 'MAXED' });
  assert.equal(Cr.roleCost(s, 'stake', 50), 2000, '장비 할인 50%');
});

test('기법: 증거를 얻어야 열리고, 효과가 bonus 로', () => {
  const s = fresh(1);
  assert.throws(() => Cr.buy(s, 't', 'print'), { code: 'LOCKED' });
  s.evid.own.print = true; s.evid.lv.print = 1;
  assert.equal(Cr.techsOpen(s).length, 1);
  Cr.buy(s, 't', 'print'); Cr.buy(s, 't', 'print');
  Cr.buy(s, 'r', 'mentor'); Cr.buy(s, 'k', 'radio'); Cr.buy(s, 'k', 'notebook');
  assert.deepEqual(Cr.bonus(s), { speed: 2, idle: 3, shield: 1, pay: 5 });
  // 증거를 잃으면(없는 일이지만) 효과도 없다
  delete s.evid.own.print; assert.equal(Cr.bonus(s).speed, undefined);
});

test('재수사: 단계만 처음부터, 본 표시는 남는다 · 저장 왕복', () => {
  const s = fresh(2); s.evid.own.cctv = true;
  Cr.buy(s, 'r', 'coast'); Cr.buy(s, 't', 'cctv');
  assert.equal(Cr.isNew(s, 'r', 'coast'), false); assert.equal(Cr.isNew(s, 'r', 'canvass'), true);
  Cr.reset(s);
  assert.equal(s.crew.r.coast, 0); assert.equal(s.crew.t.cctv, 0); assert.equal(Cr.isNew(s, 'r', 'coast'), false);
  s.crew.r.coast = 3; s.crew.seen['x:bad'] = true; s.crew.r.mentor = 999;
  const back = I.load(JSON.stringify(s), T0).save; Ev.clean(back); Cr.clean(back);
  assert.equal(back.crew.r.coast, 3); assert.equal(back.crew.r.mentor, 20, '최대로 자름'); assert.equal(back.crew.seen['x:bad'], undefined);
});

test('효과 글 · 새 칸 개수', () => {
  const s = fresh(2);
  assert.equal(Cr.effText(Cr.ROLES[1], 2), '자리 비움 한도 +20분');
  assert.equal(Cr.effText(Cr.KITS[3], 1), '오인 벌점 −0.5초');
  assert.equal(Cr.newCount(s, 'r'), 4);
  Cr.markSeen(s, 'r', ['coast']); assert.equal(Cr.newCount(s, 'r'), 3);
});
