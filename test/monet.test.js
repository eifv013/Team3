// Team3Monet(0.4.0): 상품 지급 · 새내기 72시간 · 월정액 · 광고 하루 한도 · 시즌 패스
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/monet.js');
const I = require('../src/idle.js');
const P = require('../src/pets.js');
const T0 = Date.UTC(2026, 10, 22, 3), H = 3600e3, D = 24 * H;
function fresh() { const s = I.newSave(T0); P.clean(s); M.clean(s, T0); return s; }
function grantTo(s) { return (k, v) => { if (k === 'tickets') P.addTickets(s, v); else if (k === 'treats') s.pets.treats += v; else if (k === 'outfit') s.pets.closet[v] = true; else if (k === 'pick') s.pets.picks[v] += 1; }; }

test('새내기 꾸러미: 72시간 동안만, 한 번만, 산 것이 다 들어온다', () => {
  const s = fresh();
  assert.equal(M.visible(s, 'starter', T0 + 71 * H), true);
  assert.equal(M.starterLeft(s, T0 + 70 * H), 2 * H);
  assert.equal(M.visible(s, 'starter', T0 + 73 * H), false);
  M.applyPurchase(s, 'starter', T0 + H, grantTo(s));
  assert.equal(s.gems, 100);
  assert.equal(s.pets.tickets, 10);
  assert.equal(s.pets.closet.sunglasses, true);
  assert.equal(M.visible(s, 'starter', T0 + 2 * H), false);
  assert.throws(() => M.applyPurchase(s, 'starter', T0, grantTo(s)), { code: 'ALREADY' });
  assert.throws(() => M.applyPurchase(s, 'nope', T0), { code: 'BAD_PRODUCT' });
});

test('월정액: 30일, 이어 사면 늘어나고, 하루 보상은 하루 한 번', () => {
  const s = fresh();
  M.applyPurchase(s, 'sub30', T0);
  assert.equal(s.gems, 100);
  assert.equal(M.subDaysLeft(s, T0), 30);
  assert.equal(M.claimSub(s, T0, '2026-11-22'), 20);
  assert.equal(M.claimSub(s, T0, '2026-11-22'), 0);
  assert.equal(M.claimSub(s, T0 + D, '2026-11-23'), 20);
  assert.deepEqual(M.perks(s, T0), { freePulls: 1, capMin: 120, adFree: false });
  M.applyPurchase(s, 'sub30', T0 + 10 * D);
  assert.equal(M.subDaysLeft(s, T0 + 10 * D), 50);
  assert.equal(M.subActive(s, T0 + 61 * D), false);
  assert.equal(M.claimSub(s, T0 + 61 * D, '2027-01-22'), 0);
  assert.deepEqual(M.perks(s, T0 + 61 * D), { freePulls: 0, capMin: 0, adFree: false });
});

test('광고 자리: 하루 한도, 날이 바뀌면 다시, 광고 없이 받기는 +1', () => {
  const s = fresh(), d = '2026-11-22';
  assert.equal(M.adLeft(s, 'ticket', d), 3);
  M.adUse(s, 'ticket', d); M.adUse(s, 'ticket', d); M.adUse(s, 'ticket', d);
  assert.throws(() => M.adUse(s, 'ticket', d), { code: 'NO_LEFT' });
  assert.equal(M.adLeft(s, 'party', d), 2);
  assert.equal(M.adLeft(s, 'ticket', '2026-11-23'), 3);
  M.applyPurchase(s, 'adfree', T0);
  assert.equal(M.adLeft(s, 'ticket', d), 1);
  assert.throws(() => M.adUse(s, 'zzz', d), { code: 'BAD_PLACE' });
});

test('시즌 패스: 경험치 · 단계 · 무료/프리미엄 · 산 뒤 지난 단계도 · 새 시즌에 처음부터', () => {
  const s = fresh(), d = '2026-11-22';
  // 0.6.0: 시즌은 처음 연 날부터 — 시즌 1, 28일 남음. 27일 뒤 1일 남음, 28일 뒤 시즌 2
  const se = M.seasonOf(s, d);
  assert.deepEqual(se, { no: 1, idx: 0, left: 28 });
  assert.deepEqual(M.season('2026-12-19', d), { no: 1, idx: 0, left: 1 });
  assert.deepEqual(M.season('2026-12-20', d), { no: 2, idx: 1, left: 28 });
  assert.equal(M.runXp(0), 10); assert.equal(M.runXp(20000), 40); assert.equal(M.runXp(3000, '금'), 46);
  const r = M.addXp(s, d, 350);
  assert.deepEqual(r, { tier: 3, up: 3 });
  let got = M.claimPass(s, d, grantTo(s));
  assert.deepEqual(got.map(x => x.track + x.t), ['free1', 'free2', 'free3']);
  assert.equal(s.gems, 10); assert.equal(s.pets.treats, 10);
  M.applyPurchase(s, 'pass', T0);
  got = M.claimPass(s, d, grantTo(s));
  assert.deepEqual(got.map(x => x.track + x.t), ['prem1', 'prem2', 'prem3']);
  M.addXp(s, d, 99999);
  got = M.claimPass(s, d, grantTo(s));
  assert.ok(got.some(x => x.track === 'prem' && x.t === 30 && x.r.pick === 'l'));
  assert.equal(s.pets.picks.l, 1);
  // 다음 시즌
  const next = '2026-12-' + String(22 + se.left - 1 + 1 > 31 ? 31 : 22 + se.left).padStart(2, '0');
  const later = new Date(Date.UTC(2026, 10, 22) + se.left * D).toISOString().slice(0, 10);
  assert.equal(M.passOf(s, later).xp, 0);
  assert.equal(M.passOf(s, later).premium, false);
  void next;
});

test('전설 선택권: 고른 전설을 데려온다', () => {
  const s = fresh();
  assert.throws(() => P.usePick(s, 'panda'), { code: 'NOT_ENOUGH' });
  s.pets.picks.l = 1;
  const r = P.usePick(s, 'panda');
  assert.equal(r.key, 'panda:l');
  assert.equal(s.pets.picks.l, 0);
});

test('저장: load 로 넘어오고 clean 이 깨진 값을 고친다', () => {
  const s = fresh(); M.applyPurchase(s, 'adfree', T0); M.adUse(s, 'ticket', '2026-11-22');
  const back = I.load(I.serialize(s), T0).save;
  M.clean(back, T0);
  assert.equal(back.shop.adFree, true);
  assert.equal(back.shop.ads.n.ticket, 1);
  const bad = { shop: { since: 'x', bought: { nope: 3, gems60: 2 }, ads: { day: 'zz', n: { a: 1 } }, pass: { free: { 1: true, x: true } } } };
  const c = M.clean(bad, 5);
  assert.equal(c.since, 5);
  assert.deepEqual(c.bought, { gems60: 2 });
  assert.equal(c.ads.day, '');
  assert.deepEqual(c.pass.free, { 1: true });
});

test('시즌 패스(0.6.0): 예전 저장(전체 기준 시즌 12)은 경험치 · 받은 보상을 그대로 시즌 1로', () => {
  const s = { gems: 0, pets: { tickets: 0, treats: 0 }, shop: { pass: { season: 11, xp: 550, free: { 1: true, 2: true }, prem: {}, premium: true } } };
  M.clean(s, T0);
  const ps = M.passOf(s, '2026-11-22');
  assert.equal(ps.xp, 550); assert.equal(ps.premium, true); assert.deepEqual(ps.free, { 1: true, 2: true });
  assert.deepEqual(M.seasonOf(s, '2026-11-22'), { no: 1, idx: 0, left: 28 });
  assert.equal(s.shop.passStart, '2026-11-22');
});
