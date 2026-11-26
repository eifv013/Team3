'use strict';
// 0.9.0 한정 파트너 · 배지로 사기 · 시즌 패스 프리미엄 효과
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/monet.js');
const P = require('../src/pets.js');
const E = require('../src/economy.js');

function fresh() { const s = { gems: 0, pets: null, shop: null }; M.clean(s, 0); P.clean(s); return s; }

test('정식 출시 전에는 배지로 산다: 값은 원화/100 올림, 원화 값은 그대로 남는다', () => {
  assert.equal(M.PAY_MODE, 'gems');
  assert.equal(M.gemPrice('wolf'), Math.ceil(M.BY_ID.wolf.krw / 100));
  assert.ok(M.BY_ID.wolf.krw > 0 && M.BY_ID.pass.krw > 0);
});

test('늑대 한정: 정식 출시 전에는 기한 없이 열려 있고, 한 번 사면 닫힌다', () => {
  const s = fresh();
  assert.equal(M.launched(), false);
  assert.equal(M.limitedLeft('wolf', '2027-06-01'), Infinity);
  assert.equal(M.limitedOpen(s, 'wolf', '2027-06-01'), true);
  assert.equal(M.LIMITED_DAYS, 30);   // 출시 뒤에는 출시일부터 30일
  s.shop.bought.wolf = 1;
  assert.equal(M.limitedOpen(s, 'wolf', '2026-11-30'), false);
  assert.equal(M.limitedOpen(s, 'pass', '2026-11-30'), false);   // 한정 상품이 아니다
});

test('늑대는 뽑기 목록에 없고, 간식·선택권으로 못 데려온다. 지급은 ★5', () => {
  assert.ok(!P.SPECIES.some((x) => x.id === 'wolf'));
  const s = fresh();
  s.pets.treats = 99999; s.pets.picks = { l: 3 };
  assert.throws(() => P.swap(s, 'wolf', 'l'), (e) => e.code === 'LIMITED');
  assert.throws(() => P.usePick(s, 'wolf'), (e) => e.code === 'LIMITED');
  P.grantLimited(s, 'wolf:l');
  assert.equal(s.pets.own['wolf:l'], P.STAR_MAX);
  // 0.13.17 코드네임 그림은 함께 오지 않는다(★5라 장면마다 바로 살 수 있다)
  assert.deepEqual(P.looksOf(s, 'wolf:l'), []);
  assert.equal(P.canNoir(s, 'wolf:l'), true);
});

test('프리미엄 효과: 꺼져 있으면 0, 켜면 출동·팀 보너스', () => {
  const s = fresh(), day = '2026-11-23';
  assert.deepEqual(M.premBonus(s, day), { pay: 0, idle: 0 });
  M.passOf(s, day).premium = true;
  assert.deepEqual(M.premBonus(s, day), { pay: M.PREM.pay, idle: M.PREM.idle });
  assert.equal(M.claimPremTreats(s, day), M.PREM.treats);
  assert.equal(M.claimPremTreats(s, day), 0);   // 하루 한 번
});

test('놓친 프리미엄 보상: 안 산 사람만, 지나온 단계 몫', () => {
  const s = fresh(), day = '2026-11-23';
  assert.deepEqual(M.missedPrem(s, day), {});   // 0단계
  M.passOf(s, day).xp = M.TIER_XP * 3;
  assert.ok(Object.keys(M.missedPrem(s, day)).length > 0);
  M.passOf(s, day).premium = true;
  assert.deepEqual(M.missedPrem(s, day), {});
});

test('시즌 끝 알림 날짜는 저장 정리에서 살아남고, 이상한 값은 버린다', () => {
  const s = fresh(); s.shop.passWarn = '2026-11-23'; M.clean(s, 0);
  assert.equal(s.shop.passWarn, '2026-11-23');
  s.shop.passWarn = 'x'; M.clean(s, 0);
  assert.equal(s.shop.passWarn, '');
});

test('정식 출시 전: 시즌 패스가 끝나지 않는다(시즌 1 · 무한). 출시하면 출시일부터 30일', () => {
  const s = fresh();
  assert.deepEqual(M.seasonOf(s, '2026-11-23'), { no: 1, idx: 0, left: Infinity });
  assert.deepEqual(M.seasonOf(s, '2027-08-01'), { no: 1, idx: 0, left: Infinity });
  M.launch('2027-01-10');
  try {
    assert.deepEqual(M.seasonOf(s, '2027-01-10'), { no: 1, idx: 0, left: 30 });   // 출시 전 시작한 사람도 출시일부터
    assert.deepEqual(M.seasonOf(s, '2027-02-09'), { no: 2, idx: 1, left: 30 });
    assert.equal(M.limitedLeft('wolf', '2027-01-10'), 30);
    assert.equal(M.limitedLeft('wolf', '2027-02-08'), 1);
    assert.equal(M.limitedLeft('wolf', '2027-02-09'), 0);
  } finally { M.launch(false); }
});

test('0.9.3 전설 확정 꾸러미: 선택권 1장 · 뽑기권 10 · ◆100, 한 사람당 한 번(배지값 ◆290)', () => {
  const s = fresh(), got = [];
  assert.equal(M.gemPrice('legendpack'), 290);
  M.applyPurchase(s, 'legendpack', 0, (k, v) => got.push(k + ':' + v));
  assert.deepEqual(got.sort(), ['pick:l', 'tickets:10']);
  assert.equal(s.gems, 100);
  assert.equal(M.visible(s, 'legendpack', 0), false);
  assert.throws(() => M.applyPurchase(s, 'legendpack', 0, () => {}), (e) => e.code === 'ALREADY');
});

test('0.10.7 프리미엄은 30단계 뒤 300XP마다 간식 15(시즌 10번까지)', () => {
  const s = fresh(), day = '2026-11-24', ps = M.passOf(s, day);
  M.addXp(s, day, M.TIERS * M.TIER_XP + 650);
  assert.equal(M.claimable(s, day).filter((x) => x.track === 'extra').length, 0);   // 프리미엄 아님
  ps.premium = true;
  assert.equal(M.claimable(s, day).filter((x) => x.track === 'extra').length, 2);
  M.claimPass(s, day, () => {});
  assert.equal(M.claimable(s, day).length, 0);
  M.addXp(s, day, 300);
  const ex = M.claimable(s, day).filter((x) => x.track === 'extra');
  assert.equal(ex.length, 1); assert.deepEqual(ex[0].r, { treats: 15 });
  M.addXp(s, day, 99999); M.claimPass(s, day, () => {});
  assert.equal(M.passOf(s, day).extra, 10, '시즌에 10번까지');
  assert.equal(M.claimable(s, day).length, 0);
});
