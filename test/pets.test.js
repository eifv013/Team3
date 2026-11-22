// Team3Pets(0.3.0): 뽑기 확률·천장·10연속 보장·중복 별/간식·교환·장착·효과 계산·저장 검사
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/pets.js');

function seq(values) { let i = 0; return () => values[i++ % values.length]; }
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function fresh(gems = 0) { const s = { gems }; P.clean(s); return s; }

test('30종 × 4등급, 등급 확률 합은 100%, 전설 3%(한 마리 0.1%) · 천장 80', () => {
  assert.equal(P.SPECIES.length, 30);
  assert.equal(new Set(P.SPECIES.map(x => x.id)).size, 30);
  assert.equal(P.GRADES.reduce((a, g) => a + P.GRADE[g].pct, 0), 100);
  assert.equal(P.GRADE.l.pct, 3); assert.equal(P.PITY, 80);
  const r = P.rates();
  assert.equal(r.find(x => x.g === 'l').each, 0.1);
  assert.equal(r.find(x => x.g === 'c').each, 2.133);
  assert.equal(P.effectiveLegend(), 3.3);
  // 그림 · 말이 30종 모두 있다
  const A = require('../src/petart.js');
  P.SPECIES.forEach(x => { assert.ok(A.ids.includes(x.id), x.id); assert.ok(P.TALK[x.id], x.id); });
  assert.deepEqual([...P.PICKUP_ORDER].sort(), P.SPECIES.map(x => x.id).sort());
});

test('rollGrade: 경계값', () => {
  assert.equal(P.rollGrade(() => 0), 'l');        // 0~3 전설
  assert.equal(P.rollGrade(() => 0.0299), 'l');
  assert.equal(P.rollGrade(() => 0.03), 'h');     // 3~8 영웅
  assert.equal(P.rollGrade(() => 0.08), 'r');     // 8~36 희귀
  assert.equal(P.rollGrade(() => 0.36), 'c');
  assert.equal(P.rollGrade(() => 0.9999), 'c');
});

test('많이 뽑으면 등급 비율이 공개 확률에 가깝다', () => {
  const rng = mulberry(7), n = { c: 0, r: 0, h: 0, l: 0 };
  for (let i = 0; i < 200000; i++) n[P.rollGrade(rng)]++;
  assert.ok(Math.abs(n.c / 2000 - 64) < 0.8);
  assert.ok(Math.abs(n.r / 2000 - 28) < 0.8);
  assert.ok(Math.abs(n.h / 2000 - 5) < 0.4);
  assert.ok(Math.abs(n.l / 2000 - 3) < 0.3);
});

test('결제: 뽑기권·배지가 모자라면 아무것도 안 바뀐다', () => {
  const s = fresh(5);
  assert.throws(() => P.pull(s, 1, 'gems', Math.random), { code: 'NOT_ENOUGH' });
  assert.throws(() => P.pull(s, 1, 'ticket', Math.random), { code: 'NOT_ENOUGH' });
  assert.equal(s.gems, 5);
  assert.equal(s.pets.pulls, 0);
  assert.throws(() => P.pull(s, 3, 'gems', Math.random), { code: 'BAD_COUNT' });
  s.gems = 100;
  P.pull(s, 10, 'gems', Math.random);
  assert.equal(s.gems, 10);
  P.addTickets(s, 1);
  P.pull(s, 1, 'ticket', Math.random);
  assert.equal(s.pets.tickets, 0);
  assert.equal(s.pets.pulls, 11);
});

test('천장: PITY-1번 전설이 없으면 PITY번째는 전설, 그리고 0부터 다시', () => {
  const s = fresh(1e7), rng = seq([0.99]);   // 늘 일반
  for (let i = 0; i < P.PITY - 1; i++) { const r = P.pull(s, 1, 'gems', rng); assert.notEqual(r.results[0].g, 'l'); }
  assert.equal(s.pets.pity, P.PITY - 1);
  const r = P.pull(s, 1, 'gems', rng);
  assert.equal(r.results[0].g, 'l');
  assert.equal(s.pets.pity, 0);
});

test('10연속: 전부 일반이면 마지막은 희귀', () => {
  const s = fresh(1000), r = P.pull(s, 10, 'gems', seq([0.99]));
  assert.equal(r.results.filter(x => x.g === 'r').length, 1);
  assert.equal(r.results[9].g, 'r');
  // 희귀가 이미 있으면 그대로
  const s2 = fresh(1000), r2 = P.pull(s2, 10, 'gems', seq([0.1, 0.99]));
  assert.ok(r2.results.every(x => x.g === 'r'));
});

test('중복: ★5까지 별이 오르고 그 뒤엔 간식', () => {
  const s = fresh();
  const a = P.grant(s, 'corgi', 'r');
  assert.equal(a.isNew, true);
  assert.equal(s.pets.eq, 'corgi:r');   // 처음 가진 동물은 바로 파트너
  for (let i = 0; i < 4; i++) P.grant(s, 'corgi', 'r');
  assert.equal(s.pets.own['corgi:r'], 5);
  const t = P.grant(s, 'corgi', 'r');
  assert.equal(t.treats, P.GRADE.r.treat);
  assert.equal(s.pets.treats, 3);
});

test('오리 장착: 중복 간식 +1', () => {
  const s = fresh();
  P.grant(s, 'duck', 'c'); P.equip(s, 'duck:c');
  for (let i = 0; i < 5; i++) P.grant(s, 'tiger', 'l');   // ★5까지
  const t = P.grant(s, 'tiger', 'l');
  assert.equal(t.treats, P.GRADE.l.treat + 1);
});

test('교환: 간식으로 원하는 동물, ★5면 막힘', () => {
  const s = fresh();
  assert.throws(() => P.swap(s, 'panda', 'l'), { code: 'NOT_ENOUGH' });
  s.pets.treats = P.GRADE.l.swap + 100;
  const r = P.swap(s, 'panda', 'l');
  assert.equal(r.isNew, true);
  assert.equal(s.pets.treats, 100);
  assert.throws(() => P.swap(s, 'nope', 'l'), { code: 'BAD_PET' });
  s.pets.own['panda:l'] = 5; s.pets.treats = 999;
  assert.throws(() => P.swap(s, 'panda', 'l'), { code: 'MAXED' });
});

test('효과: 보유는 모두 쌓이고 장착은 1마리만, 등급·별 배수', () => {
  const s = fresh();
  P.grant(s, 'corgi', 'c');          // 보유 pay 0.5, 장착 pay 10
  let b = P.bonus(s);
  assert.equal(b.pay, 10.5);
  P.grant(s, 'corgi', 'l');          // 보유 pay +3
  P.equip(s, 'corgi:l');             // 장착 10 × 3 = 30
  b = P.bonus(s);
  assert.equal(b.pay, 0.5 + 3 + 30);
  s.pets.own['corgi:l'] = 5;         // 별 ×2
  b = P.bonus(s);
  assert.equal(b.pay, 0.5 + 6 + 60);
  assert.throws(() => P.equip(s, 'tiger:l'), { code: 'NOT_OWNED' });
});

test('⚡ 퍼즐 도움은 영웅·전설에서만', () => {
  const s = fresh();
  P.grant(s, 'raccoon', 'r'); P.equip(s, 'raccoon:r');
  assert.equal(P.bonus(s).shield, 0);
  P.grant(s, 'raccoon', 'h'); P.equip(s, 'raccoon:h');
  assert.equal(P.bonus(s).shield, 1);
  P.grant(s, 'panda', 'l'); P.equip(s, 'panda:l');
  assert.equal(P.bonus(s).time, 5);
  P.grant(s, 'panda', 'h'); P.equip(s, 'panda:h');
  assert.equal(P.bonus(s).time, 3);
});

test('조건 효과: 개구리는 사건 2, 부엉이는 밤에만', () => {
  const s = fresh();
  P.grant(s, 'frog', 'c');   // 보유 idle 0.5, 장착 case2 15
  assert.equal(P.bonus(s, { caseNo: 1 }).idle, 0.5);
  assert.equal(P.bonus(s, { caseNo: 2 }).idle, 15.5);
  assert.equal(P.bonus(s, { caseNo: 2 }).pay, 15);
  const o = fresh();
  P.grant(o, 'owl', 'c');
  assert.equal(P.bonus(o, { hour: 12 }).pay, 0);
  assert.equal(P.bonus(o, { hour: 23 }).pay, 25);
  assert.equal(P.bonus(o, { hour: 3 }).pay, 25);
});

test('상한: 할인·한도가 너무 커지지 않는다', () => {
  const s = fresh();
  ['c', 'r', 'h', 'l'].forEach(g => { s.pets.own['fox:' + g] = 5; });
  s.pets.eq = 'fox:l';
  assert.equal(P.bonus(s).gear, 50);
});

test('clean: 깨진 저장은 버리고, 모르는 동물·범위 밖 값은 고친다', () => {
  const s = { pets: { own: { 'corgi:c': 9, 'cat:c': 1, 'x': 2, 'tiger:l': -3 }, eq: 'cat:c', pity: 99, treats: -5, tickets: 'a', welcome: 1 } };
  const p = P.clean(s);
  assert.deepEqual(p.own, { 'corgi:c': 5, 'tiger:l': 1 });
  assert.equal(p.eq, '');
  assert.equal(p.pity, P.PITY - 1);
  assert.equal(p.treats, 0);
  assert.equal(p.tickets, 0);
  assert.equal(p.welcome, false);
  const s2 = { pets: 'garbage' };
  assert.deepEqual(P.clean(s2).own, {});
  assert.deepEqual(P.bonus({}), P.zero());
});

test('처음 선물은 한 번만', () => {
  const s = fresh();
  assert.equal(P.claimWelcome(s), P.WELCOME);
  assert.equal(P.claimWelcome(s), 0);
  assert.equal(s.pets.tickets, P.WELCOME);
});

test('describe · progress', () => {
  assert.deepEqual(P.describe({ gear: 8 }), ['장비 값 −8%']);
  const s = fresh();
  P.grant(s, 'corgi', 'c'); P.grant(s, 'corgi', 'l');
  assert.deepEqual(P.progress(s), { have: 2, total: 120, byGrade: { c: 1, r: 0, h: 0, l: 1 } });
});

test('idle · economy 연결: setBonus 로 꽂으면 수입·한도·값이 바뀌고, 빼면 예전 그대로', () => {
  const I = require('../src/idle.js'), E = require('../src/economy.js');
  const T0 = 1_700_000_000_000;
  const s = I.newSave(T0); s.money = 1e7; s.gems = 0;
  const pay0 = I.payPerCatch(s), rate0 = I.teamRate(s), gear0 = I.cost(s, 'time'), prep0 = E.price(s, 'coffee', 'money');
  I.setBonus(sv => P.bonus(sv, { caseNo: sv.caseNo }));
  try {
    P.clean(s);
    // 아무것도 없으면 그대로
    assert.equal(I.payPerCatch(s), pay0);
    s.pets.own = { 'bear:l': 1, 'shiba:l': 1, 'fox:l': 1, 'siamese:l': 1, 'koala:l': 1, 'corgi:l': 1, 'hedgehog:l': 1 };
    s.pets.eq = 'bear:l';   // 장착 팀 수입 +30%
    const b = P.bonus(s);
    assert.ok(I.payPerCatch(s) > pay0);
    assert.ok(I.teamRate(s) === rate0);           // 시바 장착이 아니면 속도는 보유 효과(idle)만 — 속도는 그대로
    assert.equal(I.cost(s, 'time'), Math.round(gear0 * (1 - b.gear / 100)));
    assert.ok(E.price(s, 'coffee', 'money') < prep0);
    // 출동 수사비 +% · 사기 충전 +초
    s.pets.eq = 'hedgehog:l';
    const r = I.applyRun(s, { score: 1000, hits: 1 }, T0);
    assert.equal(r.money, Math.round(1000 * (1 + P.bonus(s).pay / 100)));
    assert.equal(s.buffUntil, T0 + (I.TUNE.buffSec + 90) * 1000);
    // 자리 비움 한도 +분
    s.pets.eq = 'koala:l';
    s.lastSeen = T0;
    const away = I.advance(s, T0 + 20 * 3600 * 1000, { offline: true });
    assert.equal(away.cap, I.TUNE.offlineCapSec + P.bonus(s).cap * 60);
  } finally { I.setBonus(null); }
  assert.equal(I.payPerCatch(I.newSave(T0)), pay0);
});

test('idle.load: 동물 저장을 넘겨주고, 깨진 값은 버린다', () => {
  const I = require('../src/idle.js'), T0 = 1_700_000_000_000;
  const s = I.newSave(T0); s.pets = { own: { 'tiger:l': 3 }, eq: 'tiger:l', tickets: 2 };
  const back = I.load(I.serialize(s), T0).save;
  P.clean(back);
  assert.equal(back.pets.own['tiger:l'], 3);
  assert.equal(back.pets.tickets, 2);
  const bad = I.newSave(T0); bad.pets = [1, 2];
  assert.equal(I.load(I.serialize(bad), T0).save.pets, null);
});

test('giftOnce: 같은 열쇠로는 한 번만', () => {
  const s = fresh();
  assert.equal(P.giftOnce(s, 'case1', 10), 10);
  assert.equal(P.giftOnce(s, 'case1', 10), 0);
  assert.equal(P.giftOnce(s, 'BAD KEY', 10), 0);
  assert.equal(s.pets.tickets, 10);
  assert.deepEqual(P.clean(s).gifts, { case1: true });
});

test('동물 이름: 기본 이름, 첫 한 번 무료, 그 뒤 배지, 되돌리기 무료', () => {
  const s = fresh(7);
  P.grant(s, 'corgi', 'c'); P.grant(s, 'corgi', 'l');
  assert.equal(P.nameOf(s, 'corgi:c'), '단서');
  assert.throws(() => P.rename(s, 'tiger:l', '범'), { code: 'NOT_OWNED' });
  assert.throws(() => P.rename(s, 'corgi:c', '  '), { code: 'EMPTY' });
  assert.throws(() => P.rename(s, 'corgi:c', '단서'), { code: 'SAME' });
  assert.deepEqual(P.rename(s, 'corgi:c', '  콩<b>이\n'), { name: '콩b이', paid: 0, tag: false });
  assert.equal(s.gems, 7);
  assert.equal(P.nameOf(s, 'corgi:l'), '단서');           // 등급마다 따로
  assert.deepEqual(P.rename(s, 'corgi:l', '황금단서열두글자넘게'), { name: '황금단서열두글자', paid: 5, tag: false });
  assert.equal(s.gems, 2);
  assert.throws(() => P.rename(s, 'corgi:l', '또'), { code: 'NOT_ENOUGH' });
  assert.equal(P.resetName(s, 'corgi:c'), '단서');
  assert.equal(s.gems, 2);
  const c = P.clean({ pets: { own: { 'corgi:c': 1 }, names: { 'corgi:c': '<콩>', 'x:y': 'a', 'tiger:l': '' }, freeName: true } });
  assert.deepEqual(c.names, { 'corgi:c': '콩' });
  assert.equal(c.freeName, true);
});

test('프로필 이름: 첫 변경 무료, 그 뒤 배지 10, 안 바뀌면 그대로', () => {
  const I = require('../src/idle.js');
  const s = I.newSave(1_700_000_000_000); s.gems = 15;
  assert.equal(I.profileCost(s), 0);
  assert.throws(() => I.changeProfile(s, '중앙서', ''), { code: 'SAME' });
  assert.equal(I.changeProfile(s, '해무서', '김형사').paid, 0);
  assert.equal(I.profileCost(s), 10);
  assert.equal(I.changeProfile(s, '해무서', '박형사').paid, 10);
  assert.equal(s.gems, 5);
  assert.throws(() => I.changeProfile(s, '해무서', '최형사'), { code: 'NOT_ENOUGH' });
  assert.equal(s.profile.leader, '박형사');
  const back = I.load(I.serialize(s), 1_700_000_000_000).save;
  assert.equal(back.profileEdits, 2);
});

test('이름표: 배지 12로 3장, 이름 바꾸기에 배지보다 먼저 쓰임(프로필·동물 공용)', () => {
  const I = require('../src/idle.js');
  const s = I.newSave(1_700_000_000_000); s.gems = 13; P.clean(s);
  assert.equal(I.buyNameTags(s), 3);
  assert.equal(s.gems, 1);
  assert.throws(() => I.buyNameTags(s), { code: 'NOT_ENOUGH' });
  I.changeProfile(s, '해무서', '');                 // 첫 번째 무료(이름표 안 씀)
  assert.equal(s.nameTags, 3);
  assert.equal(I.changeProfile(s, '해무서', '김').tag, true);
  assert.equal(s.nameTags, 2);
  P.grant(s, 'corgi', 'c');
  P.rename(s, 'corgi:c', '콩');                     // 동물 첫 무료
  assert.equal(P.rename(s, 'corgi:c', '팥').tag, true);
  assert.equal(s.nameTags, 1);
  assert.equal(s.gems, 1);
  assert.equal(I.load(I.serialize(s), 1_700_000_000_000).save.nameTags, 1);
});

test('의상(0.3.1): 간식·배지로 사고, 옷장은 모든 동물 공용, 동물마다 하나씩', () => {
  const s = fresh(12); s.caseNo = 1;
  assert.throws(() => P.buyOutfit(s, 'beanie', 'treats'), { code: 'NOT_ENOUGH' });
  s.pets.treats = 20;
  P.buyOutfit(s, 'beanie', 'treats');
  assert.equal(s.pets.treats, 5);
  assert.throws(() => P.buyOutfit(s, 'beanie', 'gems'), { code: 'ALREADY' });
  P.buyOutfit(s, 'glasses', 'gems');
  assert.equal(s.gems, 2);
  assert.throws(() => P.buyOutfit(s, 'raincoat', 'gems'), { code: 'LOCKED' });   // 해무항(사건 2)부터
  s.caseNo = 2; s.gems = 40;
  P.buyOutfit(s, 'raincoat', 'gems');
  assert.throws(() => P.wear(s, 'corgi:c', 'beanie'), { code: 'NOT_OWNED' });
  P.grant(s, 'corgi', 'c'); P.grant(s, 'tiger', 'l');
  P.wear(s, 'corgi:c', 'beanie'); P.wear(s, 'tiger:l', 'beanie');
  assert.throws(() => P.wear(s, 'corgi:c', 'fedora'), { code: 'NO_OUTFIT' });
  assert.equal(P.wearing(s, 'tiger:l'), 'beanie');
  P.wear(s, 'tiger:l', '');
  assert.equal(P.wearing(s, 'tiger:l'), '');
  const c = P.clean({ pets: { own: { 'corgi:c': 1 }, closet: { beanie: true, x: true }, wear: { 'corgi:c': 'beanie', 'tiger:l': 'beanie' } } });
  assert.deepEqual(c.closet, { beanie: true });
  assert.deepEqual(c.wear, { 'corgi:c': 'beanie' });
});

test('의상 그림: 모자를 쓰면 등급 경찰모는 벗는다', () => {
  const A = require('../src/petart.js');
  const capped = A.draw('corgi', { grade: 'r' }), hatted = A.draw('corgi', { grade: 'r', outfit: 'beanie' });
  assert.ok(capped.includes('rotate(-8 100 36)'));
  assert.ok(!hatted.includes('rotate(-8 100 36)'));
  assert.ok(A.draw('corgi', { grade: 'r', outfit: 'sunglasses' }).includes('rotate(-8 100 36)'));
  for (const o of ['glasses', 'mask', 'beanie', 'bow', 'sunglasses', 'fedora', 'raincoat']) assert.ok(A.draw('frog', { grade: 'l', outfit: o }).length > 1000);
});

test('픽업(0.4.0): 주마다 바뀌고 월요일에 시작, 남은 날', () => {
  const a = P.pickup('2026-01-05'), b = P.pickup('2026-01-11'), c = P.pickup('2026-01-12');
  assert.equal(a.id, b.id);
  assert.notEqual(a.id, c.id);
  assert.equal(a.from, '2026-01-05'); assert.equal(a.to, '2026-01-11');
  assert.equal(a.left, 7); assert.equal(b.left, 1);
  assert.equal(P.PICKUP_ORDER.length, 30);
  assert.equal(new Set(P.PICKUP_ORDER).size, 30);
  assert.ok(P.pickup('2026-11-22').id);
});

test('픽업: 천장 전설은 픽업 동물 확정, 영웅·전설은 반쯤 픽업', () => {
  const day = '2026-11-22', pk = P.pickup(day).id;
  const s = fresh(1e6); s.pets.pity = P.PITY - 1;
  const r = P.pull(s, 1, 'gems', Math.random, { day });
  assert.equal(r.results[0].g, 'l');
  assert.equal(r.results[0].id, pk);
  assert.equal(r.results[0].pickup, true);
  // 많이 뽑으면 영웅·전설 중 픽업 비율은 반 + 나머지 중 1/20
  // 많이 뽑으면: 영웅 중 픽업 = 0.5 + 0.5/20 = 0.525, 전설은 천장 몫(늘 픽업)이 더해져 더 높다
  const t = fresh(1e9), rng = mulberry(11), c = { h: [0, 0], l: [0, 0] };
  for (let i = 0; i < 5000; i++) for (const x of P.pull(t, 10, 'gems', rng, { day }).results) if (x.g === 'h' || x.g === 'l') { c[x.g][0]++; if (x.id === pk) c[x.g][1]++; }
  const rh = c.h[1] / c.h[0], rl = c.l[1] / c.l[0];
  assert.ok(rh > 0.49 && rh < 0.56, 'hero ' + rh);
  assert.ok(rl >= rh - 0.03 && rl < 0.66, 'legend ' + rl);   // 전설은 천장 몫(늘 픽업)만큼 조금 더
});

test('하루 무료 뽑기: 1번(월정액 등으로 더), 날이 바뀌면 다시', () => {
  const s = fresh(0), d1 = '2026-11-22', d2 = '2026-11-23';
  assert.equal(P.freeLeft(s, d1), 1);
  P.pull(s, 1, 'free', Math.random, { day: d1 });
  assert.equal(P.freeLeft(s, d1), 0);
  assert.throws(() => P.pull(s, 1, 'free', Math.random, { day: d1 }), { code: 'NOT_ENOUGH' });
  assert.equal(P.freeLeft(s, d1, 1), 1);
  P.pull(s, 1, 'free', Math.random, { day: d1, freeExtra: 1 });
  assert.equal(P.freeLeft(s, d2), 1);
  assert.throws(() => P.pull(s, 10, 'free', Math.random, { day: d1 }), { code: 'BAD_COUNT' });
  assert.equal(P.clean(s).free.day, d1);
});

test('세트 보너스: 종류 네 등급이면 보유 효과 두 배, 등급 20종이면 등급 보너스', () => {
  const s = fresh();
  ['c', 'r', 'h', 'l'].forEach(g => P.grant(s, 'corgi', g));
  s.pets.eq = '';
  assert.equal(P.bonus(s).pay, (0.5 + 1 + 2 + 3) * 2);
  assert.equal(P.sets(s).species.corgi, true);
  const t = fresh();
  P.SPECIES.forEach(sp => P.grant(t, sp.id, 'c'));
  t.pets.eq = '';
  const b = P.bonus(t);
  assert.equal(P.sets(t).grades.c, true);
  // 일반 20종 보유(idle 갈래 0.5 × idle 종류 수) + 등급 세트 idle 5
  const idleKinds = P.SPECIES.filter(x => x.own === 'idle').length;
  assert.equal(b.idle, idleKinds * 0.5 + 5);
});

test('친밀도(0.4.0): 하루 한 번만 늘고, 단계가 오르면 보상 한 번', () => {
  const s = fresh(0);
  P.grant(s, 'corgi', 'c');
  assert.throws(() => P.pat(s, 'tiger:l', '2026-11-22'), { code: 'NOT_OWNED' });
  let r = P.pat(s, 'corgi:c', '2026-11-22');
  assert.equal(r.counted, true); assert.equal(r.lv, 1);
  assert.equal(P.pat(s, 'corgi:c', '2026-11-22').counted, false);
  P.pat(s, 'corgi:c', '2026-11-23');
  r = P.pat(s, 'corgi:c', '2026-11-24');
  assert.equal(r.up, true); assert.equal(r.lv, 2);
  assert.equal(s.pets.treats, 10);
  const b = P.bondOf(s, 'corgi:c');
  assert.equal(b.days, 3); assert.equal(b.since, '2026-11-22'); assert.equal(b.next, 4);
  assert.deepEqual(P.clean(s).bond['corgi:c'].days, 3);
});

test('말: 종류마다 3마디 이상, 상황 말이 섞인다', () => {
  P.SPECIES.forEach(sp => assert.ok(P.TALK[sp.id] && P.TALK[sp.id].length >= 3, sp.id));
  const lines = new Set();
  for (let i = 0; i < 200; i++) lines.add(P.talk('corgi', { hour: 8, capped: true, tickets: 2 }));
  assert.ok(lines.has('좋은 아침이에요, 팀장님!'));
  assert.ok(lines.has('팀장님, 주범 조가 기다려요!'));
  assert.ok(lines.has('뽑기권 있어요! 친구 데려와요.'));
});
