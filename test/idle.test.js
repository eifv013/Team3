// SuspectsIdle 단위 테스트: node --test test/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const I = require('../src/idle.js');

const T0 = 1_700_000_000_000;
const MIN = 60_000, HOUR = 3_600_000;

test('새 저장: 형사 1명, 수사비 0, 사건 진행 0', () => {
  const s = I.newSave(T0);
  assert.equal(s.detectives, 1);
  assert.equal(s.money, 0);
  assert.equal(I.progress(s), 0);
  assert.equal(I.storyUnlocked(s).length, 1);
});

test('팀은 형사 1명이 2분 30초(catchSec)에 1명 잡고, 1명당 15 수사비', () => {
  assert.equal(I.TUNE.catchSec, 150);
  const s = I.newSave(T0);
  const r = I.advance(s, T0 + 25 * MIN);   // 1500초 / 150초 = 10명
  assert.equal(r.catches, 10);
  assert.equal(r.money, 150);
  assert.equal(s.caught, 10);
  assert.equal(s.teamCaught, 10);
});

test('잡다 만 몫은 다음으로 이어진다(1초씩 나눠 흘러도 합은 같다)', () => {
  const a = I.newSave(T0), b = I.newSave(T0);
  for (let t = 1; t <= 600; t++) I.advance(a, T0 + t * 1000);
  I.advance(b, T0 + 600 * 1000);
  assert.equal(a.caught, b.caught);
  assert.equal(a.money, b.money);
});

test('자리 비움(offline)은 4시간까지만, 절반 속도로 센다 / 시계가 뒤로 가면 아무 일 없다', () => {
  assert.equal(I.TUNE.offlineCapSec, 4 * 3600);
  assert.equal(I.TUNE.offlineRate, 0.5);
  const off = I.newSave(T0);
  const r = I.advance(off, T0 + 30 * HOUR, { offline: true });
  assert.equal(r.seconds, 4 * 3600);
  assert.equal(r.offline, true);
  assert.equal(r.catches, 48);             // 14400초 × 0.5 / 150초
  const back = I.advance(off, T0);         // 기기 시간을 되돌림
  assert.equal(back.catches, 0);
  assert.equal(off.lastSeen, T0);
  // 켜 둔 채(기본값)면 같은 4시간이 100%
  const on = I.newSave(T0);
  assert.equal(I.advance(on, T0 + 4 * HOUR).catches, 96);
  // 짧게 비워도 절반: 10분 = 600초 × 0.5 / 150 = 2명
  const shortAway = I.newSave(T0);
  assert.equal(I.advance(shortAway, T0 + 10 * MIN, { offline: true }).catches, 2);
});

test('출동 뒤 2분 동안 팀이 2배로 일한다(겹친 구간만)', () => {
  const s = I.newSave(T0);
  I.applyRun(s, { score: 0, hits: 0 }, T0);
  // 120초는 2배(240초 몫) + 510초는 보통 = 750초 몫 → 5명
  const r = I.advance(s, T0 + 630_000);
  assert.equal(r.catches, 5);
  assert.equal(I.buffed(s, T0 + 1 * MIN), true);
  assert.equal(I.buffed(s, T0 + 3 * MIN), false);
});

test('형사 영입·훈련 값이 오르고, 돈이 모자라면 NOT_ENOUGH', () => {
  const s = I.newSave(T0);
  assert.equal(I.cost(s, 'hire'), 300);
  assert.throws(() => I.buy(s, 'hire'), { code: 'NOT_ENOUGH' });
  s.money = 10_000;
  I.buy(s, 'hire');
  assert.equal(s.detectives, 2);
  assert.equal(s.money, 9700);
  assert.equal(I.cost(s, 'hire'), 630);    // 300 × 2.1
  assert.equal(I.cost(s, 'train'), 600);
  I.buy(s, 'train');
  assert.equal(I.cost(s, 'train'), 1620);  // 600 × 2.7
  // 훈련하면 빨라지고 더 번다
  assert.equal(I.payPerCatch(s), 23);
  assert.ok(Math.abs(I.teamRate(s) - 2 * 1.25 / 150) < 1e-12);
  // 훈련은 10단계까지
  s.training = 10; s.money = 1e12;
  assert.equal(I.cost(s, 'train'), null);
  assert.throws(() => I.buy(s, 'train'), { code: 'MAXED' });
});

test('장비: 단계마다 값, 끝까지 사면 MAXED, 모르는 항목은 BAD_KIND', () => {
  const s = I.newSave(T0);
  s.money = 1e9;
  for (const c of [800, 2400, 7200]) assert.equal(I.buy(s, 'time'), c);
  assert.equal(I.cost(s, 'time'), null);
  assert.throws(() => I.buy(s, 'time'), { code: 'MAXED' });
  assert.throws(() => I.cost(s, 'laser'), { code: 'BAD_KIND' });
  s.training = I.TUNE.trainMax;
  assert.throws(() => I.buy(s, 'train'), { code: 'MAXED' });
});

test('장비가 출동 옵션을 바꾼다', () => {
  const s = I.newSave(T0);
  assert.deepEqual(I.runOptions(s), { duration: 90, freeHints: 0, nonePenalty: 10, level: 1, helperAtFull: false, mode: 'set', trapPenalty: 8, hitBonus: 0, beamLie: false, missPenalty: 5, lineupHitBonus: 0, preOut: 0 });
  s.gear = { time: 2, veteran: 1, lab: 1, vault: 1, recorder: 0, keeper: 0, informant: 0 };
  assert.deepEqual(I.runOptions(s), { duration: 110, freeHints: 1, nonePenalty: 5, level: 1, helperAtFull: true, mode: 'set', trapPenalty: 8, hitBonus: 0, beamLie: false, missPenalty: 5, lineupHitBonus: 0, preOut: 0 });
});

test('출동 결과: 점수만큼 수사비, 검거만큼 진척, 최고 기록', () => {
  const s = I.newSave(T0);
  const r = I.applyRun(s, { score: 1850, hits: 14 }, T0);
  assert.equal(s.money, 1850);
  assert.equal(s.caught, 14);
  assert.equal(s.runs, 1);
  assert.equal(r.best, true);
  assert.equal(I.applyRun(s, { score: 900, hits: 5 }, T0).best, false);
  for (const bad of [null, { score: -1, hits: 2 }, { score: 'x', hits: 1 }, { score: 10 }]) {
    assert.throws(() => I.applyRun(s, bad, T0), { code: 'BAD_RESULT' });
  }
});

test('목표(3000명)에 닿으면 사건 종결(한 번만), 이야기는 단계마다 열린다', () => {
  assert.equal(I.CASE.goal, 3000);
  assert.deepEqual(I.CASE.story.map(e => e.at), [0, 300, 1000, 1500, 2500, 3000]);
  const s = I.newSave(T0);
  I.applyRun(s, { score: 0, hits: 300 }, T0);
  assert.equal(I.storyUnlocked(s).length, 2);
  const r1 = I.applyRun(s, { score: 0, hits: 2699 }, T0);
  assert.equal(r1.closedNow, false);
  assert.equal(I.storyUnlocked(s).length, 5);
  // 2500명을 넘긴 뒤로 팀(방치)은 사건 진척을 못 올린다 — 수사비만 번다
  const r2 = I.advance(s, T0 + 10 * MIN);
  assert.ok(r2.catches > 0 && r2.counted === 0 && r2.money > 0);
  assert.equal(s.caught, 2999);
  assert.equal(I.idleCapped(s), true);
  const r3 = I.applyRun(s, { score: 0, hits: 1 }, T0 + 10 * MIN);   // 마지막 한 명은 출동으로
  assert.equal(r3.closedNow, true);
  assert.equal(s.closed, true);
  assert.equal(I.idleCapped(s), false);
  assert.equal(I.storyUnlocked(s).length, 6);
  assert.equal(I.applyRun(s, { score: 0, hits: 3 }, T0 + 11 * MIN).closedNow, false);
  assert.equal(I.progress(s), 1);
});

test('방치 상한: 팀은 2500명까지만 올리고, 넘친 몫은 버리되 수사비는 다 준다', () => {
  assert.equal(I.CASE.idleCap, 2500);
  const s = I.newSave(T0);
  s.detectives = 20; s.caught = 2490;
  const r = I.advance(s, T0 + 10 * MIN);   // 20명 × 600초 / 150초 = 80명
  assert.equal(r.catches, 80);
  assert.equal(r.counted, 10);
  assert.equal(s.caught, 2500);
  assert.equal(s.teamCaught, 80);
  assert.equal(r.money, 80 * 15);
  assert.equal(I.idleCapped(s), true);
  assert.equal(I.advance(s, T0 + 20 * MIN).counted, 0);
  assert.equal(s.caught, 2500);
});

test('저장 왕복, 깨진 저장은 새로 시작, 이상한 값은 잘라 낸다', () => {
  const s = I.newSave(T0);
  s.money = 1234.5; s.detectives = 4; s.gear.lab = 1; s.tutorialDone = true;
  const back = I.load(I.serialize(s), T0 + 1000);
  assert.equal(back.reset, false);
  assert.deepEqual(back.save, s);

  for (const raw of ['{not json', '[]', '{"v":99}', 'null']) {
    const r = I.load(raw, T0);
    assert.equal(r.save.money, 0);
    assert.equal(r.save.detectives, 1);
  }
  assert.equal(I.load('{not json', T0).reset, true);
  assert.equal(I.load(null, T0).reset, false);     // 처음 켬

  const weird = I.load(JSON.stringify({ v: 1, money: -50, detectives: 0, training: 99, gear: { time: 9, lab: 'x' }, caught: 'abc', closed: 'yes' }), T0).save;
  assert.equal(weird.money, 0);
  assert.equal(weird.detectives, 1);
  assert.equal(weird.training, I.TUNE.trainMax);
  assert.equal(weird.gear.time, 3);
  assert.equal(weird.gear.lab, 0);
  assert.equal(weird.caught, 0);
  assert.equal(weird.closed, false);
});

test('300명으로 종결됐던 예전 저장은 목표가 늘면 다시 진행 중', () => {
  const old = I.load(JSON.stringify({ v: 1, caught: 320, closed: true, closedAt: T0 }), T0).save;
  assert.equal(old.closed, false);
  assert.equal(old.caught, 320);
});

// 수사비가 되는 대로, 들인 값에 비해 수입이 가장 많이 느는 쪽(영입/훈련)을 산다
function greedyBuy(s) {
  const inc = (n, T) => n * (1 + I.TUNE.trainSpeed * T) * Math.round(I.TUNE.catchPay * (1 + I.TUNE.trainPay * T));
  for (;;) {
    const h = I.cost(s, 'hire'), tr = I.cost(s, 'train');
    const gh = (inc(s.detectives + 1, s.training) - inc(s.detectives, s.training)) / h;
    const gt = tr == null ? 0 : (inc(s.detectives, s.training + 1) - inc(s.detectives, s.training)) / tr;
    const k = gh >= gt ? 'hire' : 'train';
    if (s.money < I.cost(s, k)) return;
    I.buy(s, k);
  }
}

test('밸런스 감: 방치만으로는 2500명에서 멈추고(하루~사흘), 끝은 출동으로만', () => {
  const CAP = I.CASE.idleCap;
  // 하루 2시간마다 들러 사기만 하는 사람(출동 없음, 밤 8시간은 비움)
  const lazy = I.newSave(T0); let t = T0, hoursCap = null;
  for (let h = 0; h < 24 * 14; ) {
    t = T0 + h * HOUR; I.advance(lazy, t, { offline: true }); greedyBuy(lazy);
    if (hoursCap == null && lazy.caught >= CAP) hoursCap = h;
    h += (h % 24) < 16 ? 2 : 8;
  }
  console.log(`  방치만: ${CAP}명까지 약 ${hoursCap}시간, 2주 뒤 검거 ${lazy.caught}/${I.CASE.goal}, 형사 ${lazy.detectives}명`);
  assert.equal(lazy.caught, CAP);
  assert.equal(lazy.closed, false, '방치만으로는 사건이 안 끝난다');
  assert.ok(hoursCap >= 12 && hoursCap <= 72, CAP + '명까지 하루~사흘: ' + hoursCap);
  // 검거 간격이 0초 가까이로 무너지지 않는다(2주 꽉 키워도 1초 이상)
  assert.ok(1 / I.teamRate(lazy) >= 1, '검거 간격 ' + (1 / I.teamRate(lazy)).toFixed(2));

  // 남은 500명은 출동(한 번에 약 12명)으로: 42번이면 끝
  let n = 0;
  while (!lazy.closed && n < 60) { t += 3 * MIN; I.advance(lazy, t); I.applyRun(lazy, { score: 1500, hits: 12 }, t); n++; }
  console.log(`  그 뒤 출동 ${n}번에 종결`);
  assert.ok(lazy.closed && n === Math.ceil((I.CASE.goal - CAP) / 12));
});

test('프로필: 기본은 중앙서·팀장 없음, 바꾸면 다듬어서 저장', () => {
  const s = I.newSave(T0);
  assert.deepEqual(s.profile, { station: '중앙서', leader: '' });
  I.setProfile(s, '  강남서  ', ' 김\n형사 ');
  assert.deepEqual(s.profile, { station: '강남서', leader: '김 형사' });
  I.setProfile(s, '', '');
  assert.deepEqual(s.profile, { station: '중앙서', leader: '' });     // 경찰서를 비우면 기본값
  I.setProfile(s, '<b>아주아주아주긴경찰서이름</b>', '😀😀😀😀😀😀😀😀😀😀');
  assert.equal(s.profile.station, 'b아주아주아주긴');                 // < > 제거, 8자
  assert.equal(Array.from(s.profile.leader).length, 8);               // 이모지도 글자 단위로 자른다
  I.setProfile(s, 123, null);
  assert.deepEqual(s.profile, { station: '중앙서', leader: '' });
});

test('프로필은 저장 왕복되고, 옛 저장(프로필 없음)도 기본값으로 읽힌다', () => {
  const s = I.newSave(T0);
  I.setProfile(s, '해운대서', '박반장');
  assert.deepEqual(I.load(I.serialize(s), T0).save.profile, { station: '해운대서', leader: '박반장' });
  const old = JSON.parse(I.serialize(I.newSave(T0))); delete old.profile;
  assert.deepEqual(I.load(JSON.stringify(old), T0).save.profile, { station: '중앙서', leader: '' });
  const bad = JSON.parse(I.serialize(I.newSave(T0))); bad.profile = { station: '\u0007', leader: 42 };
  assert.deepEqual(I.load(JSON.stringify(bad), T0).save.profile, { station: '중앙서', leader: '' });
});

test('다음 검거까지: 보통·사기 충전·충전이 중간에 끝나는 경우', () => {
  const s = I.newSave(T0);
  assert.equal(I.nextCatch(s, T0).sec, 150);
  s.frac = 0.5;
  assert.equal(I.nextCatch(s, T0).sec, 75);
  s.buffUntil = T0 + 120_000;                 // 2배: 남은 0.5 는 37.5초
  assert.equal(I.nextCatch(s, T0).sec, 37.5);
  s.buffUntil = T0 + 10_000;                  // 10초 동안 2배로 20/150, 나머지(0.5 - 2/15)는 보통 속도로 55초
  assert.ok(Math.abs(I.nextCatch(s, T0).sec - 65) < 1e-9);
  // 실제로 그 시간이 지나면 한 명을 잡는다
  const r = I.advance(s, T0 + 65_000);
  assert.equal(r.catches, 1);
  s.detectives = 0;
  assert.equal(I.nextCatch(s, T0).sec, Infinity);
});

test('수사 일지: 새 편이 열리면 안 읽음, 읽으면 사라짐, 저장 왕복', () => {
  const s = I.newSave(T0);
  assert.equal(I.storyUnread(s), true);           // 시작 편
  I.markStorySeen(s);
  assert.equal(I.storyUnread(s), false);
  I.applyRun(s, { score: 0, hits: 300 }, T0);
  assert.equal(I.storyUnread(s), true);           // 300명 편
  assert.equal(I.markStorySeen(s), 2);
  assert.equal(I.load(I.serialize(s), T0).save.storySeen, 2);
  assert.equal(I.load(JSON.stringify(Object.assign(JSON.parse(I.serialize(s)), { storySeen: 99 })), T0).save.storySeen, 6);
  assert.equal(I.load(JSON.stringify(Object.assign(JSON.parse(I.serialize(s)), { storySeen: 'x' })), T0).save.storySeen, 0);
});

test('수사 일지: 편마다 문단 하나(억지 줄바꿈 없음), 너무 짧지 않고, 문장으로 끝난다', () => {
  const st = I.CASE.story;
  st.forEach((e, i) => {
    const parts = e.text.split('\n');
    // 줄바꿈은 마지막 편의 "— 사건 2에서 계속" 앞에만 허용
    if (i === st.length - 1) { assert.equal(parts.length, 2); assert.ok(parts[1].startsWith('— 사건 2')); }
    else assert.equal(parts.length, 1, e.at + '명 편에 억지 줄바꿈');
    assert.ok(parts[0].length >= 60, e.at + '명 편이 너무 짧음(폰에서 3줄 이상): ' + parts[0].length);
    assert.ok(/[.?!"”]$/.test(parts[0]), e.at + '명 편이 문장 중간에서 끝남');
  });
});

test('수사 일지: "써드"는 마지막 편에서야 처음 나온다', () => {
  const st = I.CASE.story, last = st[st.length - 1];
  st.slice(0, -1).forEach(e => assert.ok(!e.text.includes('써드'), e.at + '명 편에 써드가 먼저 나옴'));
  assert.ok(last.text.includes('써드'));
});

test('1분 수사비: 형사가 늘면 1명당 값은 그대로, 1분 수사비는 오른다 / 사기 충전이면 2배', () => {
  const s = I.newSave(T0);
  assert.equal(I.incomePerMin(s, T0), 60 / 150 * 15);        // 1명: 0.4명 × 15 = 6
  s.detectives = 7; s.training = 3;
  const per = I.payPerCatch(s);
  assert.ok(Math.abs(I.incomePerMin(s, T0) - 7 * 1.75 * 60 / 150 * per) < 1e-9);
  s.detectives = 8;
  assert.equal(I.payPerCatch(s), per);
  assert.ok(I.incomePerMin(s, T0) > 7 * 1.75 * 60 / 150 * per);
  s.buffUntil = T0 + 60_000;
  assert.ok(Math.abs(I.incomePerMin(s, T0) - 2 * 8 * 1.75 * 60 / 150 * per) < 1e-9);
  s.detectives = 0;
  assert.equal(I.incomePerMin(s, T0), 0);
});

test('검거 간격 1.5초 미만이면 "1초에 N명" 표시로 바뀐다(0초·무한대로 가지 않는다)', () => {
  const s = I.newSave(T0);
  assert.equal(I.catchInterval(s, T0), 150);
  assert.equal(I.isStreaming(s, T0), false);
  s.detectives = 100; s.training = 10;                       // 100 × 3.5 / 150 = 1초에 약 2.3명
  assert.ok(I.catchInterval(s, T0) > 0 && I.catchInterval(s, T0) < 1.5);
  assert.equal(I.isStreaming(s, T0), true);
  s.detectives = 0;
  assert.equal(I.catchInterval(s, T0), Infinity);
  assert.equal(I.isStreaming(s, T0), false);
});

test('수사 일지: 사무실 편은 방치 한계(idleCap)에서 열린다 — 팀이 멈추는 이유를 이야기로 알려 준다', () => {
  const e = I.CASE.story.find(x => x.at === I.CASE.idleCap);
  assert.ok(e, 'idleCap 에 열리는 편이 없음');
  assert.ok(e.text.includes('책상에서 기다려서는 잡을 수 없다'));
});

/* ---------- 0.2.0: 사건 2 ---------- */
test('사건 2 파견: 사건 1을 끝내야 하고, 진척만 새로 시작하고 나머지는 이어 간다', () => {
  const s = I.newSave(T0);
  assert.throws(() => I.moveToNextCase(s, T0), (e) => e.code === 'NOT_CLOSED');
  s.money = 777; s.detectives = 5; s.gems = 9; s.runCaught = 600;
  s.caught = 3000; I.advance(s, T0 + 1000);   // 종결 처리
  s.closed = true; s.closedAt = T0 + 1000; s.storySeen = 6;
  assert.equal(I.nextCase(s).title, '안개 속 목격자들');
  const nx = I.moveToNextCase(s, T0 + 2000);
  assert.equal(nx.no, 2); assert.equal(s.caseNo, 2);
  assert.equal(s.caught, 0); assert.equal(s.closed, false); assert.equal(s.storySeen, 0);
  assert.deepEqual(s.past, [{ no: 1, caught: 3000, closedAt: T0 + 1000 }]);
  assert.equal(s.money, 777); assert.equal(s.detectives, 5); assert.equal(s.gems, 9); assert.equal(s.runCaught, 600);
  assert.equal(I.caseOf(s).city, '해무항');
  assert.equal(I.runOptions(s).mode, 'witness');
  assert.equal(I.storyUnlocked(s).length, 1);
  // 0.5.0: 사건 2 다음은 사건 3(면통 라인업), 사건 3 다음은 아직 없다
  s.caught = 5000; s.closed = true; s.closedAt = T0 + 3000;
  assert.equal(I.moveToNextCase(s, T0 + 4000).no, 3);
  assert.equal(I.runOptions(s).mode, 'lineup'); assert.equal(I.caseOf(s).city, '중앙서 면통실');
  s.caught = 8000; s.closed = true;
  assert.throws(() => I.moveToNextCase(s, T0), (e) => e.code === 'NO_NEXT');
});

test('사건 3: 팀 수사비 6배, 팀은 6500명까지, 사건 3 장비는 사건 3에서만 · 라인업 설정을 바꾼다', () => {
  const a = I.newSave(T0), s = I.newSave(T0);
  s.caseNo = 3;
  assert.equal(I.payPerCatch(s), I.payPerCatch(a) * 6);
  s.caught = 6499; s.detectives = 500; I.advance(s, T0 + 3600_000);
  assert.equal(s.caught, 6500); assert.ok(I.idleCapped(s));
  assert.deepEqual(I.gearFor(s), ['time', 'veteran', 'painter', 'lights', 'witness2']);
  s.money = 1e9;
  I.buy(s, 'painter'); I.buy(s, 'lights'); I.buy(s, 'lights'); I.buy(s, 'witness2');
  const o = I.runOptions(s);
  assert.equal(o.preOut, 1); assert.equal(o.missPenalty, 1); assert.equal(o.lineupHitBonus, 1);
  a.money = 1e9;
  assert.throws(() => I.buy(a, 'painter'), (e) => e.code === 'OTHER_CASE');
  assert.equal(I.load(I.serialize(s), T0).save.gear.lights, 2);
});

test('사건 3 일지: 편마다 한 문단, 마지막 편만 써드가 직접 · "다음 사건에서 계속"', () => {
  const st = I.CASES[2].story;
  assert.equal(st[st.length - 1].at, I.CASES[2].goal);
  st.forEach((e, i) => {
    const parts = e.text.split('\n');
    if (i === st.length - 1) { assert.equal(parts.length, 2); assert.ok(parts[1].startsWith('— 다음 사건')); }
    else assert.equal(parts.length, 1);
    assert.ok(parts[0].length >= 60); assert.ok(/[.?!"”]$/.test(parts[0]));
  });
  assert.ok(st.some(e => e.at === I.CASES[2].idleCap));
});

test('사건 2: 팀 수사비 3배, 팀은 4000명까지만 진척, 저장을 되읽어도 사건 2', () => {
  const a = I.newSave(T0), b = I.newSave(T0);
  b.caseNo = 2;
  assert.equal(I.payPerCatch(b), I.payPerCatch(a) * 3);
  b.caught = 3999; b.detectives = 500;
  I.advance(b, T0 + 3600_000);
  assert.equal(b.caught, 4000); assert.ok(I.idleCapped(b));
  const back = I.load(I.serialize(b), T0).save;
  assert.equal(back.caseNo, 2); assert.equal(back.caught, 4000);
  assert.equal(I.load(JSON.stringify({ v: 1, caseNo: 9 }), T0).save.caseNo, I.CASES.length, '없는 사건 번호는 범위 안으로');
  assert.equal(I.load(JSON.stringify({ v: 1 }), T0).save.caseNo, 1, '예전 저장은 사건 1');
});

test('사건 2 장비: 사건 2에서만 보이고 살 수 있고, 목격자 출동 설정을 바꾼다', () => {
  const s = I.newSave(T0); s.money = 1e9;
  assert.deepEqual(I.gearFor(s), ['time', 'veteran', 'lab', 'vault']);
  assert.throws(() => I.buy(s, 'recorder'), (e) => e.code === 'OTHER_CASE');
  s.caseNo = 2;
  assert.deepEqual(I.gearFor(s), ['time', 'veteran', 'recorder', 'keeper', 'informant']);
  assert.throws(() => I.buy(s, 'lab'), (e) => e.code === 'OTHER_CASE');
  I.buy(s, 'recorder'); I.buy(s, 'recorder'); I.buy(s, 'keeper'); I.buy(s, 'informant'); I.buy(s, 'informant');
  assert.throws(() => I.buy(s, 'recorder'), (e) => e.code === 'MAXED');
  const o = I.runOptions(s);
  assert.equal(o.trapPenalty, 2); assert.equal(o.hitBonus, 2); assert.equal(o.beamLie, true);
  const back = I.load(I.serialize(s), T0).save;
  assert.equal(back.gear.informant, 2); assert.equal(back.gear.keeper, 1);
});

test('0.10.12 출동 구간 증거: 출동 검거 +% · 팀 한계 +% · 재수사 때 출동 몫 남김', () => {
  const s = I.newSave(T0), cs = I.caseOf(s);
  I.setBonus(() => ({ runHit: 10, capUp: 10, keep: 20 }));
  try {
    assert.equal(I.capOf(s), cs.idleCap + Math.floor((cs.goal - cs.idleCap) * 0.1));
    const r = I.applyRun(s, { score: 100, hits: 20 }, T0);
    assert.equal(r.caught, 22); assert.equal(s.caught, 22); assert.equal(s.caseRun, 22); assert.equal(s.runCaught, 20);
    I.resetTeam(s, {});
    assert.equal(s.caught, 4); assert.equal(s.keepBank, 4);
    assert.equal(I.capOf(s), cs.idleCap + Math.floor((cs.goal - cs.idleCap) * 0.1) + 4);
  } finally { I.setBonus(null); }
  const s2 = I.newSave(T0); I.applyRun(s2, { score: 100, hits: 20 }, T0); I.resetTeam(s2, {});
  assert.equal(s2.caught, 0, '증거가 없으면 예전처럼 0');
});
