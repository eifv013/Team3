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

test('팀은 형사 1명이 1분에 1명 잡고, 1명당 15 수사비', () => {
  const s = I.newSave(T0);
  const r = I.advance(s, T0 + 10 * MIN);
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

test('자리를 비운 시간은 8시간까지만 센다, 시계가 뒤로 가면 아무 일 없다', () => {
  const s = I.newSave(T0);
  const r = I.advance(s, T0 + 30 * HOUR);
  assert.equal(r.seconds, 8 * 3600);
  assert.equal(r.catches, 480);
  const back = I.advance(s, T0);          // 기기 시간을 되돌림
  assert.equal(back.catches, 0);
  assert.equal(s.lastSeen, T0);
});

test('출동 뒤 2분 동안 팀이 2배로 일한다(겹친 구간만)', () => {
  const s = I.newSave(T0);
  I.applyRun(s, { score: 0, hits: 0 }, T0);
  const r = I.advance(s, T0 + 4 * MIN);   // 2분은 2배, 2분은 1배 → 6명
  assert.equal(r.catches, 6);
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
  assert.equal(I.cost(s, 'hire'), 465);
  assert.equal(I.cost(s, 'train'), 600);
  I.buy(s, 'train');
  assert.equal(I.cost(s, 'train'), 1200);
  // 훈련하면 빨라지고 더 번다
  assert.equal(I.payPerCatch(s), 23);
  assert.ok(Math.abs(I.teamRate(s) - 2 * 1.25 / 60) < 1e-12);
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
  assert.deepEqual(I.runOptions(s), { duration: 90, freeHints: 0, nonePenalty: 10, level: 1, helperAtFull: false });
  s.gear = { time: 2, veteran: 1, lab: 1, vault: 1 };
  assert.deepEqual(I.runOptions(s), { duration: 110, freeHints: 1, nonePenalty: 5, level: 1, helperAtFull: true });
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

test('목표(1000명)에 닿으면 사건 종결(한 번만), 이야기는 단계마다 열린다', () => {
  assert.equal(I.CASE.goal, 1000);
  assert.deepEqual(I.CASE.story.map(e => e.at), [0, 150, 300, 500, 750, 1000]);
  const s = I.newSave(T0);
  I.applyRun(s, { score: 0, hits: 150 }, T0);
  assert.equal(I.storyUnlocked(s).length, 2);
  const r1 = I.applyRun(s, { score: 0, hits: 849 }, T0);
  assert.equal(r1.closedNow, false);
  assert.equal(I.storyUnlocked(s).length, 5);
  const r2 = I.advance(s, T0 + MIN);       // 팀이 마지막 한 명
  assert.equal(r2.closedNow, true);
  assert.equal(s.closed, true);
  assert.equal(I.storyUnlocked(s).length, 6);
  assert.equal(I.advance(s, T0 + 2 * MIN).closedNow, false);
  assert.equal(I.progress(s), 1);
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

test('밸런스 감: 출동 없이 형사 1명이면 사건 1에 17시간쯤(8시간씩 세 번), 키우면 훨씬 빠르다', () => {
  const lazy = I.newSave(T0);
  I.advance(lazy, T0 + 8 * HOUR); I.advance(lazy, T0 + 16 * HOUR);
  assert.equal(lazy.closed, false);
  I.advance(lazy, T0 + 17 * HOUR);
  assert.ok(lazy.closed);

  // 출동 10번(한 번에 약 12명·1500점)을 하며 수사비가 되는 대로 형사를 들이면
  const s = I.newSave(T0); let t = T0;
  for (let n = 0; n < 10 && !s.closed; n++) {
    t += 2 * MIN; I.advance(s, t);
    I.applyRun(s, { score: 1500, hits: 12 }, t);
    while (I.cost(s, 'hire') <= s.money) I.buy(s, 'hire');
  }
  t += 20 * MIN; I.advance(s, t);
  console.log(`  출동 10번 + 20분 뒤: 형사 ${s.detectives}명, 검거 ${s.caught}/1000`);
  assert.ok(s.caught >= 200 && s.detectives >= 5);
  t += 2 * HOUR; I.advance(s, t);
  console.log(`  그 뒤 2시간 비움: 검거 ${s.caught}/1000`);
  assert.ok(s.closed, '키운 팀이면 두어 시간 비우면 끝난다');
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
  assert.equal(I.nextCatch(s, T0).sec, 60);
  s.frac = 0.5;
  assert.equal(I.nextCatch(s, T0).sec, 30);
  s.buffUntil = T0 + 120_000;                 // 2배: 남은 0.5 는 15초
  assert.equal(I.nextCatch(s, T0).sec, 15);
  s.buffUntil = T0 + 10_000;                  // 10초 동안 2배로 1/3, 나머지 1/6 은 보통 속도로 10초
  assert.ok(Math.abs(I.nextCatch(s, T0).sec - 20) < 1e-9);
  // 실제로 그 시간이 지나면 한 명을 잡는다
  const r = I.advance(s, T0 + 20_000);
  assert.equal(r.catches, 1);
  s.detectives = 0;
  assert.equal(I.nextCatch(s, T0).sec, Infinity);
});

test('수사 일지: 새 편이 열리면 안 읽음, 읽으면 사라짐, 저장 왕복', () => {
  const s = I.newSave(T0);
  assert.equal(I.storyUnread(s), true);           // 시작 편
  I.markStorySeen(s);
  assert.equal(I.storyUnread(s), false);
  I.applyRun(s, { score: 0, hits: 150 }, T0);
  assert.equal(I.storyUnread(s), true);           // 150명 편
  assert.equal(I.markStorySeen(s), 2);
  assert.equal(I.load(I.serialize(s), T0).save.storySeen, 2);
  assert.equal(I.load(JSON.stringify(Object.assign(JSON.parse(I.serialize(s)), { storySeen: 99 })), T0).save.storySeen, 6);
  assert.equal(I.load(JSON.stringify(Object.assign(JSON.parse(I.serialize(s)), { storySeen: 'x' })), T0).save.storySeen, 0);
});

test('수사 일지: 편마다 3줄 이상, 빈 줄 없고 한 줄이 폰 세로 화면 한 줄에 들어간다', () => {
  for (const e of I.CASE.story) {
    const lines = e.text.split('\n');
    assert.ok(lines.length >= 3, e.at + '명 편이 3줄 미만');
    for (const l of lines) {
      assert.ok(l.trim().length > 0, e.at + '명 편에 빈 줄');
      assert.ok(l.length <= 22, e.at + '명 편 줄이 김: ' + l);
    }
  }
});

test('수사 일지: "써드"는 마지막 편에서야 처음 나온다', () => {
  const st = I.CASE.story, last = st[st.length - 1];
  st.slice(0, -1).forEach(e => assert.ok(!e.text.includes('써드'), e.at + '명 편에 써드가 먼저 나옴'));
  assert.ok(last.text.includes('써드'));
});
