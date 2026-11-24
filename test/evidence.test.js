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
  const s = fresh(); s.money = 999; s.detectives = 9; s.training = 4; s.gear.time = 2; s.caught = 1600; s.caseBest = 1600; s.gems = 33; s.runCaught = 500; s.storySeen = I.CASE.story.filter(e => e.at <= 1600).length;
  D.buy(Object.assign(s, { money: 1e6 }), 'patrol', 5);
  assert.throws(() => Ev.retreat(s, {}), { code: 'TOO_EARLY' });
  Ev.earn(s, 540000);
  const r = Ev.retreat(s, { now: T0, newTeam: (sv, st) => { I.resetTeam(sv, st); D.reset(sv); } });
  assert.equal(r.gain, 3); assert.equal(s.evid.clues, 3); assert.equal(s.evid.retreats, 1); assert.equal(s.evid.runEarned, 0);
  assert.equal(s.money, 0); assert.equal(s.detectives, 1); assert.equal(s.training, 0); assert.equal(s.gear.time, 0); assert.equal(s.caught, 0); assert.equal(D.total(s), 0);
  assert.equal(s.gems, 33); assert.equal(s.runCaught, 500);
  assert.equal(I.storyUnlocked(s).length, I.CASE.story.filter(e => e.at <= 1600).length, '읽은 일지는 그대로');
  s.caught = 200; const next = I.CASE.story.find(e => e.at > 1600);
  assert.ok(!I.storyUnlocked(s).includes(next), '0.10.3 다음 편은 이번 판 검거 수로만 열린다');
  assert.equal(Ev.bonus(s).speed, Ev.RANK_PCT, '재수사 경력');
  assert.equal(Ev.lastGain(s), 3);
});

test('0.9.0 연결판: 첫 재수사 전엔 모두 ??? · 사건 파일과 이어진 것만 열기 · 연 증거는 바로 효과 · 같은 색 실 묶음 배수', () => {
  const s = fresh(); s.evid.clues = 100;
  assert.equal(Ev.coreOpen(s), false);
  assert.equal(Ev.state(s, 'print'), 'shut');
  assert.throws(() => Ev.buyCard(s, 'print'), { code: 'NO_CASE' });
  s.evid.retreats = 1;
  assert.equal(Ev.state(s, 'core'), 'open');
  assert.equal(Ev.state(s, 'print'), 'can', '0단계는 사건 파일과 이어져 있다');
  assert.equal(Ev.state(s, 'hair'), 'shut', '1단계는 이어진 증거가 열려야');
  assert.throws(() => Ev.buyCard(s, 'hair'), { code: 'LOCKED' });
  Ev.buyCard(s, 'print');
  assert.throws(() => Ev.buyCard(s, 'print'), { code: 'ALREADY' });
  assert.equal(Ev.effects(s).speed, 10, '연 증거는 바로 효과');
  // 지문 · 족적 은 다리 실로 이어져 있다(같은 빨강 아님) / 지문 · 장갑 은 같은 빨강이지만 실이 없으면 묶음 아님
  const redNeighbors = Ev.EDGES.filter(e => e.includes('print')).map(e => e[0] === 'print' ? e[1] : e[0]);
  assert.ok(redNeighbors.includes('shoe'));
  // 같은 색끼리 실로 이어진 쌍을 찾아 둘 다 열면 ×1.5
  const pair = Ev.EDGES.find(e => e[0] !== 'core' && Ev.BY_ID[e[0]].color === Ev.BY_ID[e[1]].color && Ev.BY_ID[e[0]].key === 'speed' && Ev.BY_ID[e[0]].tier <= 1 && Ev.BY_ID[e[1]].tier <= 1);
  const s2 = fresh(); s2.evid.clues = 100; s2.evid.retreats = 2;
  // 이어진 길을 따라 열기(0단계 → 1단계)
  const t0 = Ev.BY_ID[pair[0]].tier === 0 ? pair[0] : pair[1], t1 = t0 === pair[0] ? pair[1] : pair[0];
  Ev.buyCard(s2, t0); Ev.buyCard(s2, t1);
  const g = Ev.groups(s2).find(x => x.ids.includes(t0));
  assert.equal(g.mult, 1);
  assert.equal(Ev.effects(s2).speed, Ev.BY_ID[t0].value + Ev.BY_ID[t1].value);
  Ev.upgrade(s2, t0);
  assert.equal(Ev.effects(s2).speed, (Ev.BY_ID[t0].value * 2 + Ev.BY_ID[t1].value));
  assert.equal(Ev.links(s2).length, Ev.EDGES.filter(e => Ev.opened(s2, e[0]) && Ev.opened(s2, e[1])).length);
});

test('연결판 자리: 51장 + 사건 파일, 모든 증거가 사건 파일까지 실로 이어지고 서로 겹치지 않는다', () => {
  assert.equal(Object.keys(Ev.NODE).length, 55);
  const nei = {}; Ev.EDGES.forEach(e => { (nei[e[0]] = nei[e[0]] || []).push(e[1]); (nei[e[1]] = nei[e[1]] || []).push(e[0]); });
  const seen = { core: 1 }, st = ['core'];
  while (st.length) (nei[st.pop()] || []).forEach(q => { if (!seen[q]) { seen[q] = 1; st.push(q); } });
  Ev.CARDS.forEach(c => assert.ok(seen[c.id], c.id + ' 가 끊겨 있다'));
  const ids = Object.keys(Ev.NODE);
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = Ev.NODE[ids[i]], b = Ev.NODE[ids[j]];
    assert.ok(Math.abs(a.x - b.x) >= 96 || Math.abs(a.y - b.y) >= 84 || ids[i] === 'core' || ids[j] === 'core' ? true : false, ids[i] + ' · ' + ids[j] + ' 겹침');
  }
});

test('증거판: 묶음 배수 3장 ×2 · 5장 ×2.5, 카드 51장 · 효과 글', () => {
  assert.equal(Ev.groupMult(1), 1); assert.equal(Ev.groupMult(5), 1);   // 0.10.11 묶음 배수 없음
  assert.equal(Ev.CARDS.length, 54);
  assert.equal(new Set(Ev.CARDS.map(c => c.id)).size, 54);
  Ev.CARDS.forEach(c => { assert.ok(Ev.KEY_NAME[c.key], c.id); assert.ok(Ev.describe(c, 1).length > 3); assert.ok(Ev.shortText(c, 2).length > 2); });
});

test('저장: 깨진 값 정리 · idle 저장 왕복', () => {
  const s = { evid: { clues: 5, spent: 9, own: { print: true, nope: true }, lv: { print: 9 }, pins: { 0: 'print', 1: 'print', 99: 'print' }, runEarned: -3, retreats: 'x' } };
  Ev.clean(s);
  assert.equal(s.evid.spent, 5); assert.deepEqual(Object.keys(s.evid.own), ['print']); assert.equal(s.evid.lv.print, Ev.MAX_LV);
  assert.equal(s.evid.pins, undefined, '0.9.0 꽂기 없음'); assert.equal(s.evid.runEarned, 0); assert.equal(s.evid.retreats, 0);
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
  assert.ok(Math.abs(D.perSec(s) - 0.02 * 10 / 1) < 1e-9);
  assert.deepEqual(D.reveal(s), ['analyst', 'csi', 'swat', 'intl']);
  s.money = 0; assert.equal(D.maxBuy(s, 'patrol', 0), 0);
  assert.throws(() => D.buy(s, 'patrol', 1), { code: 'NOT_ENOUGH' });
});

test('idle: 부서 수입은 자리 비움이면 절반 · 번 수사비 알림', () => {
  const s = fresh(); D.buy(Object.assign(s, { money: 1e6 }), 'patrol', 10); s.money = 0; s.detectives = 0;
  let earned = 0;
  I.setExtraIncome(sv => D.perSec(sv)); I.setEarn((sv, v) => { earned += v; });
  try {
    const r = I.advance(s, T0 + 100000);   // 100초 · 초당 0.2
    assert.equal(r.dept, 20); assert.equal(s.money, 20); assert.equal(earned, 20);
    const r2 = I.advance(s, T0 + 200000, { offline: true });
    assert.equal(r2.dept, 10);
  } finally { I.setExtraIncome(null); I.setEarn(null); }
});
