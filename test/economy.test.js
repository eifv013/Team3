// Team3Economy(0.1.19): 상품 값·사기·무르기·준비물 쓰기·메달·특별 출동
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const I = require('../src/idle.js');
const E = require('../src/economy.js');
const C = require('../src/core.js');

const T0 = 1_700_000_000_000, MIN = 60_000;
function rich(money = 1e7, gems = 100) { const s = I.newSave(T0); s.money = money; s.gems = gems; return s; }

test('기준값: 최소 300, 최근 출동 평균, 팀 10분 수입 중 가장 큰 값', () => {
  const s = I.newSave(T0);
  assert.equal(E.baseValue(s), 300);
  s.recent = [4000, 6000];
  assert.equal(E.baseValue(s), 5000);
  s.detectives = 200; s.training = 10;   // 팀이 아주 크면 팀 10분 수입이 기준
  assert.ok(E.baseValue(s) > 5000);
});

test('값은 앞 두 자리로 내리고, 팀 회식·야간 잠복조는 팀 N분치보다 싸지 않다', () => {
  assert.equal(E.roundNice(1234), 1200);
  assert.equal(E.roundNice(56789), 56000);
  assert.equal(E.roundNice(7), 7);
  const s = I.newSave(T0); s.recent = [5000];
  assert.equal(E.price(s, 'coffee'), 1500);
  assert.equal(E.price(s, 'press'), 5000);
  assert.equal(E.price(s, 'coffee', 'gems'), 2);
  assert.equal(E.price(s, 'coffee', 'iap'), null);
  s.detectives = 300; s.training = 10;
  const teamMin = I.teamRate(s) * 60 * I.payPerCatch(s);
  assert.ok(E.price(s, 'party') >= E.roundNice(teamMin * 20));
  assert.throws(() => E.price(s, '없음'), (e) => e.code === 'BAD_ITEM');
});

test('준비물: 사면 챙겨지고, 같은 건 두 번 못 사고, 무르면 낸 값을 그대로 돌려받는다', () => {
  const s = rich(100000, 10); s.recent = [5000];
  const r = E.buy(s, 'coffee', T0);
  assert.equal(r.paid, 1500); assert.equal(s.money, 98500);
  assert.ok(E.owned(s, 'coffee', T0));
  assert.throws(() => E.buy(s, 'coffee', T0), (e) => e.code === 'ALREADY');
  E.buy(s, 'tip', T0, 'gems'); assert.equal(s.gems, 7);
  assert.deepEqual(E.unprep(s, 'tip'), { refunded: 3, currency: 'gems' }); assert.equal(s.gems, 10);
  assert.deepEqual(E.unprep(s, 'coffee'), { refunded: 1500, currency: 'money' }); assert.equal(s.money, 100000);
  assert.throws(() => E.unprep(s, 'coffee'), (e) => e.code === 'NOT_OWNED');
});

test('돈이 모자라면 NOT_ENOUGH, 아무것도 바뀌지 않는다', () => {
  const s = rich(10, 0);
  assert.throws(() => E.buy(s, 'press', T0), (e) => e.code === 'NOT_ENOUGH');
  assert.throws(() => E.buy(s, 'press', T0, 'gems'), (e) => e.code === 'NOT_ENOUGH');
  assert.equal(s.money, 10); assert.deepEqual(s.prep, {});
});

test('준비물 쓰기: 판 설정에 효과를 얹고 모두 비운다. core 가 그 설정으로 판을 만든다', () => {
  const s = rich();
  for (const id of E.PREP_IDS) E.buy(s, id, T0);
  const o = E.consumePrep(s, I.runOptions(s));
  assert.equal(o.duration, 90 + 15);
  assert.equal(o.freeHints, 2);
  assert.equal(o.mods.shield, 2);
  assert.equal(o.tip, true);
  assert.equal(o.payMult, 1.5);
  assert.deepEqual(o.used.sort(), E.PREP_IDS.slice().sort());
  assert.deepEqual(s.prep, {}); assert.deepEqual(s.prepPaid, {});
  const g = C.createGame({ rng: C.makeRng(1), now: 0, duration: o.duration, freeHints: o.freeHints, mods: o.mods });
  assert.equal(g.shield, 2);
});

test('팀 회식: 30분 동안 팀 2배(사기 충전과 겹쳐도 2배), 끝나면 원래대로', () => {
  const a = rich(), b = rich();
  E.buy(a, 'party', T0);
  I.advance(a, T0 + 30 * MIN); I.advance(b, T0 + 30 * MIN);
  assert.equal(a.teamCaught, 2 * b.teamCaught);
  a.buffUntil = T0 + 40 * MIN;   // 사기 충전이 겹쳐도 곱하지 않는다
  E.buy(a, 'party', T0 + 30 * MIN);
  const before = a.teamCaught;
  I.advance(a, T0 + 40 * MIN); I.advance(b, T0 + 40 * MIN);
  assert.equal(a.teamCaught - before, 2 * (b.teamCaught - 12));
});

test('야간 잠복조: 다음 자리 비움 한 번만 8시간까지 세고 사라진다. 짧게 비우면 남는다', () => {
  const s = rich(); E.buy(s, 'night', T0);
  assert.throws(() => E.buy(s, 'night', T0), (e) => e.code === 'ALREADY');
  I.advance(s, T0 + 5 * MIN, { offline: true });
  assert.equal(s.nightWatch, true, '10분보다 짧으면 쓰지 않는다');
  const r = I.advance(s, T0 + 5 * MIN + 10 * 3600_000, { offline: true });
  assert.equal(r.night, true); assert.equal(r.seconds, 8 * 3600); assert.equal(s.nightWatch, false);
  const r2 = I.advance(s, T0 + 5 * MIN + 20 * 3600_000, { offline: true });
  assert.equal(r2.seconds, 4 * 3600);
});

test('계급: 출동 검거 수로 오르고, 오를 때 배지를 한 번만, 수사비 +5%씩', () => {
  const s = I.newSave(T0);
  assert.equal(I.rankOf(s).name, '경위');
  s.runCaught = 520;
  assert.equal(I.rankOf(s).name, '경정');
  assert.deepEqual(I.claimPromotions(s).map((p) => p.name), ['경감', '경정']);
  assert.equal(s.gems, 30);
  assert.deepEqual(I.claimPromotions(s), []);
  assert.equal(I.moneyMult(s), 1.1);
  const r = I.applyRun(s, { score: 1000, hits: 0 }, T0);
  assert.equal(r.money, 1100);
  const r2 = I.applyRun(s, { score: 1000, hits: 0, payMult: 1.5 }, T0);
  assert.equal(r2.money, 1650);
  assert.deepEqual(s.recent, [1000, 1000]);
});

test('메달: 처음 넘을 때만, 한 판에 여러 개 동시에, 보상은 출동 전 기준값으로', () => {
  const s = I.newSave(T0);
  const got = E.claimMedals(s, 6500, 2000);
  assert.deepEqual(got.map((m) => m.name), ['동', '은']);
  assert.equal(s.money, 2000 + 4000); assert.equal(s.gems, 15);
  assert.deepEqual(E.claimMedals(s, 7000, 2000), []);
  assert.equal(E.medalFor(12000).name, '금');
  assert.equal(E.medalFor(10), null);
});

test('특별 출동: 날짜로 규칙이 돌고, 메달이면 보상 후 끝, 못 받으면 다시, 배지로 한 번 더', () => {
  assert.equal(E.dayKey(Date.UTC(2026, 10, 21, 15, 30), -540), '2026-11-22');   // 한국 자정 넘음
  assert.equal(E.dayKey(Date.UTC(2026, 10, 21, 14, 30), -540), '2026-11-21');
  const seen = new Set(); for (let d = 1; d <= E.DAILY.length; d++) seen.add(E.dailyRule('2026-12-' + String(d).padStart(2, '0')).id);
  assert.equal(seen.size, E.DAILY.length, '규칙 수만큼의 날에 규칙이 다 한 번씩 나온다');
  assert.ok(E.DAILY.some((r) => r.config.mode === 'forgery'));
  assert.ok(E.DAILY.some((r) => r.config.mode === 'montage'));   // 0.5.0
  const s = rich(0, 6), day = '2026-11-22', rule = E.dailyRule(day);
  const cfg = E.startDaily(s, day);
  assert.equal(cfg.daily, true); assert.equal(cfg.freeHints, 0);
  assert.doesNotThrow(() => C.createGame({ rng: C.makeRng(1), now: 0, duration: cfg.duration, level: cfg.level, mods: cfg.mods }));
  assert.equal(E.applyDaily(s, day, 0, 1000).medal, null);
  assert.equal(E.dailyStatus(s, day).left, 4);
  const r = E.applyDaily(s, day, rule.medals[1], 1000);
  assert.equal(r.medal, '은'); assert.equal(r.money, 2000); assert.equal(r.gems, 2); assert.equal(r.isNew, true);
  // 0.10.6 같은 메달은 다시 안 주고, 더 높은 메달은 차액
  assert.equal(E.applyDaily(s, day, rule.medals[1], 1000).money, 0);
  E.startDaily(s, day);
  const up = E.applyDaily(s, day, rule.medals[2], 1000);
  assert.equal(up.medal, '금'); assert.equal(up.upFrom, '은'); assert.equal(up.money, 1000); assert.equal(up.gems, 1);
  assert.equal(E.dailyStatus(s, day).done, true, '금까지 받으면 오늘 할 일 끝');
  for (let i = 0; i < 3; i++) E.startDaily(s, day);
  assert.equal(E.dailyStatus(s, day).left, 0);
  assert.throws(() => E.startDaily(s, day), (e) => e.code === 'DAILY_DONE');
  E.setDailyExtra(() => 2);
  assert.equal(E.dailyStatus(s, day).left, 2, '업적 · 프리미엄 기회');
  E.setDailyExtra(null);
  assert.equal(s.gems, 6 + 3, '배지는 쓰지 않는다');
  assert.equal(E.dailyStatus(s, '2026-11-23').done, false, '다음 날이면 새로');
  assert.throws(() => E.dailyRule('2026/11/22'), (e) => e.code === 'BAD_DAY');
});

test('저장 되읽기: 0.1.19 값이 그대로 오가고, 예전 저장은 기본값, 이상한 값은 걸러진다', () => {
  const s = rich(); s.recent = [1, 2]; E.buy(s, 'coffee', T0); s.daily = { day: '2026-11-22', best: 9, tries: 2, paid: 1, joined: false };
  const back = I.load(I.serialize(s), T0).save;
  assert.deepEqual(back.prep, { coffee: true });
  assert.equal(back.prepPaid.coffee.w, 'money');
  assert.deepEqual(back.daily, s.daily);
  const old = I.load(JSON.stringify({ v: 1, money: 5, runCaught: 600 }), T0).save;
  assert.equal(old.gems, 0); assert.equal(old.rankSeen, 0); assert.deepEqual(old.medals, { b: false, s: false, g: false });
  const bad = I.load(JSON.stringify({ v: 1, gems: -5, recent: ['x', 5, Infinity], prep: { coffee: 'yes', '<b>': true }, daily: { day: 'nope' } }), T0).save;
  assert.equal(bad.gems, 0); assert.deepEqual(bad.recent, [5]); assert.deepEqual(bad.prep, {}); assert.equal(bad.daily.day, '');
});

test('0.10.9 지원: 합동 수사본부(부서 2배) · 호송 지원은 30분 동안', () => {
  const s = rich();
  E.buy(s, 'joint', T0); E.buy(s, 'escort', T0);
  assert.equal(E.owned(s, 'joint', T0 + 29 * 60000), true);
  assert.equal(E.owned(s, 'joint', T0 + 31 * 60000), false);
  assert.equal(E.owned(s, 'escort', T0 + 1000), true);
  // 부서 수입: 겹친 구간만 2배
  const s2 = rich(); s2.detectives = 0; s2.money = 0; s2.lastSeen = T0; s2.jointUntil = T0 + 50000;
  I.setExtraIncome(() => 1);
  try { assert.equal(I.advance(s2, T0 + 100000).dept, 150); } finally { I.setExtraIncome(null); }
});
