'use strict';
// 재수사 · 증거판(0.7.0) · 부서
const test = require('node:test');
const assert = require('node:assert');
const Ev = require('../src/evidence.js');
const D = require('../src/dept.js');
const I = require('../src/idle.js');
const T0 = 1e12;
function fresh() { const s = I.newSave(T0); Ev.clean(s); D.clean(s); return s; }

test('단서: ∛(번 수사비 / 2만), 다음 단서까지 남은 수사비', () => {
  const s = fresh();
  assert.equal(Ev.gainNow(s), 0);
  Ev.earn(s, 20000); assert.equal(Ev.gainNow(s), 1);
  Ev.earn(s, 140000); assert.equal(Ev.gainNow(s), 2);   // 16만
  assert.equal(Ev.nextAt(s), 27 * 20000 - 160000);
  Ev.earn(s, -5); Ev.earn(s, NaN); assert.equal(s.evid.runEarned, 160000);
});

test('재수사: 단서 · 경력, 팀은 처음으로(진척 · 장비 · 부서 · 수사비), 남는 것은 그대로, 일지는 계속 열림', () => {
  const s = fresh(); s.money = 999; s.detectives = 9; s.training = 4; s.gear.time = 2; s.caught = 1600; s.caseBest = 1600; s.gems = 33; s.runCaught = 500;
  D.buy(Object.assign(s, { money: 1e6 }), 'patrol', 5);
  assert.throws(() => Ev.retreat(s, {}), { code: 'TOO_EARLY' });
  Ev.earn(s, 540000);
  const r = Ev.retreat(s, { now: T0, newTeam: (sv, st) => { I.resetTeam(sv, st); D.reset(sv); } });
  assert.equal(r.gain, 3); assert.equal(s.evid.clues, 3); assert.equal(s.evid.retreats, 1); assert.equal(s.evid.runEarned, 0);
  assert.equal(s.money, 0); assert.equal(s.detectives, 1); assert.equal(s.training, 0); assert.equal(s.gear.time, 0); assert.equal(s.caught, 0); assert.equal(D.total(s), 0);
  assert.equal(s.gems, 33); assert.equal(s.runCaught, 500);
  assert.equal(I.storyUnlocked(s).length, I.CASE.story.filter(e => e.at <= 1600).length, '열어 본 일지는 그대로');
  assert.equal(Ev.bonus(s).speed, Ev.RANK_PCT, '재수사 경력');
  assert.equal(Ev.lastGain(s), 3);
});

test('증거판: 카드 사기(묶음 잠금) · 강화 · 꽂기(옮기기 · 바꾸기) · 닫힌 칸 · 같은 색 묶음 배수', () => {
  const s = fresh(); s.evid.clues = 100;
  assert.throws(() => Ev.buyCard(s, 'hair'), { code: 'LOCKED' });
  ['print', 'glove', 'shoe', 'cctv'].forEach(id => Ev.buyCard(s, id));
  assert.throws(() => Ev.buyCard(s, 'print'), { code: 'ALREADY' });
  const open = Ev.ORDER.slice(0, Ev.openCount(s));
  assert.equal(open.length, 9);
  const closed = [...Array(Ev.COLS * Ev.ROWS).keys()].find(i => !open.includes(i));
  assert.throws(() => Ev.pin(s, 'print', closed), { code: 'CLOSED_CELL' });
  // 가운데 줄에 지문 · 장갑(같은 빨강) 나란히 → ×1.5
  const mid = Ev.ORDER[0], right = mid + 1;
  assert.ok(open.includes(right));
  Ev.pin(s, 'print', mid); Ev.pin(s, 'glove', right);
  assert.equal(Ev.links(s).length, 1);
  assert.equal(Ev.effects(s).speed, (10 + 10) * 1.5);
  Ev.upgrade(s, 'print');   // ★2
  assert.equal(Ev.effects(s).speed, (20 + 10) * 1.5);
  // 옮기기 · 바꾸기
  Ev.pin(s, 'glove', mid);
  assert.equal(s.evid.pins[mid], 'glove'); assert.equal(s.evid.pins[right], 'print');
  Ev.unpin(s, right); assert.equal(Ev.effects(s).speed, 10);
  assert.ok(Ev.left(s) < 100);
});

test('증거판: 묶음 배수 3장 ×2 · 5장 ×2.5, 카드 51장 · 효과 글', () => {
  assert.equal(Ev.groupMult(1), 1); assert.equal(Ev.groupMult(3), 2); assert.equal(Ev.groupMult(5), 2.5);
  assert.equal(Ev.CARDS.length, 51);
  assert.equal(new Set(Ev.CARDS.map(c => c.id)).size, 51);
  Ev.CARDS.forEach(c => { assert.ok(Ev.KEY_NAME[c.key], c.id); assert.ok(Ev.describe(c, 1).length > 3); assert.ok(Ev.shortText(c, 2).length > 2); });
  const s = fresh(); s.evid.retreats = 100; s.past = [{ no: 1 }, { no: 2 }, { no: 3 }];
  assert.equal(Ev.openCount(s), Ev.COLS * Ev.ROWS);
});

test('저장: 깨진 값 정리 · idle 저장 왕복', () => {
  const s = { evid: { clues: 5, spent: 9, own: { print: true, nope: true }, lv: { print: 9 }, pins: { 0: 'print', 1: 'print', 99: 'print' }, runEarned: -3, retreats: 'x' } };
  Ev.clean(s);
  assert.equal(s.evid.spent, 5); assert.deepEqual(Object.keys(s.evid.own), ['print']); assert.equal(s.evid.lv.print, Ev.MAX_LV);
  assert.deepEqual(s.evid.pins, { 0: 'print' }); assert.equal(s.evid.runEarned, 0); assert.equal(s.evid.retreats, 0);
  const a = fresh(); a.evid.clues = 7; D.buy(Object.assign(a, { money: 1e6 }), 'patrol', 3);
  const b = I.load(I.serialize(a), T0).save; Ev.clean(b); D.clean(b);
  assert.equal(b.evid.clues, 7); assert.equal(b.dept.n.patrol, 3);
});

test('부서: 값 · 목표 ×2 · 최대 · 보이기 · 수입', () => {
  const s = fresh(); s.money = 1e9;
  assert.equal(D.cost(s, 'patrol', 1), 150);
  assert.throws(() => D.buy(s, 'swat', 1), { code: 'LOCKED' });
  const r = D.buy(s, 'patrol', 10); assert.equal(r.mile, 10);
  assert.equal(D.cycle(s, 'patrol'), 1);
  assert.ok(Math.abs(D.perSec(s) - 0.2 * 10 / 1) < 1e-9);
  assert.deepEqual(D.reveal(s), ['analyst', 'csi', 'swat', 'intl']);
  s.money = 0; assert.equal(D.maxBuy(s, 'patrol', 0), 0);
  assert.throws(() => D.buy(s, 'patrol', 1), { code: 'NOT_ENOUGH' });
});

test('idle: 부서 수입은 자리 비움이면 절반 · 번 수사비 알림', () => {
  const s = fresh(); D.buy(Object.assign(s, { money: 1e6 }), 'patrol', 10); s.money = 0; s.detectives = 0;
  let earned = 0;
  I.setExtraIncome(sv => D.perSec(sv)); I.setEarn((sv, v) => { earned += v; });
  try {
    const r = I.advance(s, T0 + 100000);   // 100초 · 초당 2
    assert.equal(r.dept, 200); assert.equal(s.money, 200); assert.equal(earned, 200);
    const r2 = I.advance(s, T0 + 200000, { offline: true });
    assert.equal(r2.dept, 100);
  } finally { I.setExtraIncome(null); I.setEarn(null); }
});
