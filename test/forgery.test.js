// Team3Forgery(0.2.1): 특별 출동 "위조된 한 패" — 문제 보장·고르기·위조 없음·단서·단계
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/core.js');
const F = require('../src/forgery.js');

test('문제 보장: 단계마다 1,500문제 — 가짜 줄은 딱 하나(또는 없음), 나머지는 진짜, 사람은 겹치지 않음', () => {
  const rng = C.makeRng(9);
  for (const lv of [1, 2, 3]) {
    let none = 0;
    for (let t = 0; t < 1500; t++) {
      const q = F.makeQuestion(rng, lv);
      assert.equal(q.rows.length, lv === 3 ? 6 : 4);
      assert.equal(new Set(q.rows.flat()).size, q.rows.length * 3);
      const fakes = q.rows.map((r, i) => (F.isRealRow(r, q.active) ? -1 : i)).filter((i) => i >= 0);
      if (q.fake === -1) { none++; assert.deepEqual(fakes, []); }
      else assert.deepEqual(fakes, [q.fake]);
      if (lv === 3 && q.fake >= 0) assert.ok([0, 3].includes(q.fakeK), '여섯 줄 단계의 가짜는 시간대·흔적에서만');
    }
    if (lv < 3) assert.equal(none, 0);
    else assert.ok(none > 250 && none < 500, '여섯 줄 단계는 네 판에 한 판쯤 가짜 없음: ' + none);
  }
});

function game(seed = 3) { return F.createGame({ rng: C.makeRng(seed), now: 0 }); }

test('맞히면 점수·시간·연속, 검거 3명이면 둘째 단계, 8명이면 여섯 줄 단계', () => {
  const g = game(), e0 = g.endAt, ups = [];
  for (let i = 0; i < 8; i++) {
    const r = F.choose(g, g.q.fake, 100 + i);
    assert.ok(r.ok); if (r.levelUp) ups.push(r.levelUp);
  }
  assert.deepEqual(ups, [2, 3]); assert.equal(g.q.rows.length, 6);
  assert.equal(g.endAt, e0 + 8 * F.RULES.hitTime * 1000);
});

test('틀리면 시간이 줄고 연속이 끊기며 다음 문제로. 위조 없음은 여섯 줄 단계에서만', () => {
  const g = game(4); const e0 = g.endAt;
  const wrong = [0, 1, 2, 3].find((i) => i !== g.q.fake);
  const r = F.choose(g, wrong, 100);
  assert.equal(r.ok, false); assert.equal(r.penalty, F.RULES.missPenalty);
  assert.equal(g.endAt, e0 - F.RULES.missPenalty * 1000);
  assert.throws(() => F.choose(g, -1, 200), (e) => e.code === 'BAD_PICK');
  // 여섯 줄 단계로 올린 뒤 가짜 없는 판을 찾아 위조 없음
  for (let i = 0; i < 8; i++) F.choose(g, g.q.fake, 300 + i);
  let guard = 0; while (g.q.fake !== -1 && guard++ < 200) F.choose(g, g.q.fake, 1000 + guard);
  const ok = F.choose(g, -1, 2000);
  assert.ok(ok.ok); assert.equal(g.noneHits, 1);
});

test('단서는 진짜 줄을 하나씩 짚고(값 3초), 짚을 게 없으면 값을 받지 않는다. 단서 금지 판은 NO_HINTS', () => {
  const g = game(6), e0 = g.endAt, seen = new Set();
  for (let i = 0; i < 3; i++) { const h = F.hint(g, 100 + i); assert.notEqual(h.row, g.q.fake); seen.add(h.row); }
  assert.equal(seen.size, 3);
  assert.equal(g.endAt, e0 - 3 * F.RULES.hintPenalty * 1000);
  assert.deepEqual(F.hint(g, 200), { row: -1, penalty: 0 });
  const ng = F.createGame({ rng: C.makeRng(1), now: 0, mods: { noHints: true } });
  assert.throws(() => F.hint(ng, 10), (e) => e.code === 'NO_HINTS');
});
