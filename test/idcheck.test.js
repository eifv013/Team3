'use strict';
// 사건 4 신분증 검사(0.14.0): 위조는 딱 한 군데 · 수배 조건 · 판정 · 단서 · 장비
const test = require('node:test');
const assert = require('node:assert');
const C = require('../src/core.js');
const I = require('../src/idcheck.js');
function mul(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const T0 = 1e12;
function mism(q) { const v = C.decode(q.id); return q.attrs.filter(a => q.doc[a] !== v[a]); }

test('사람: 위조는 보이는 특징 중 딱 한 군데만 틀리고, 진짜는 하나도 안 틀린다', () => {
  const rng = mul(11);
  let forged = 0, wantedHit = 0, n4 = 0;
  for (let i = 0; i < 4000; i++) {
    const lv = 1 + (i % 4), q = I.makeQuestion(rng, lv);
    assert.deepEqual(q.attrs, I.LV[lv].attrs);
    const m = mism(q);
    if (q.forged) { forged++; assert.deepEqual(m, [q.diff]); assert.ok(q.attrs.includes(q.diff)); }
    else { assert.equal(m.length, 0); assert.equal(q.diff, -1); }
    // 안 보이는 특징은 신분증도 사진과 같다(화면에 없는 줄로 위조가 되면 안 됨)
    const v = C.decode(q.id);
    [0, 1, 2, 3].filter(a => !q.attrs.includes(a)).forEach(a => assert.equal(q.doc[a], v[a]));
    if (lv === 4) {
      n4++;
      assert.ok(q.wanted && q.attrs.includes(q.wanted.a));
      const hit = v[q.wanted.a] === q.wanted.v;
      assert.equal(q.arrest, q.forged || hit);
      assert.equal(q.why, q.forged ? 'forged' : hit ? 'wanted' : 'clean');
      if (!q.forged && hit) wantedHit++;
    } else {
      assert.equal(q.wanted, null); assert.equal(q.arrest, q.forged);
    }
  }
  assert.ok(forged > 1700 && forged < 2300, '위조 비율이 절반쯤: ' + forged);
  assert.ok(wantedHit > n4 * 0.12, '수배에 걸리는 진짜 신분증이 충분히: ' + wantedHit + '/' + n4);
});

test('판정: 맞으면 점수 · 시간 +, 틀리면 −초 · 연속 끊김, 맞든 틀리든 다음 사람', () => {
  const g = I.createGame({ rng: mul(5), now: T0 });
  const end0 = g.endAt, q0 = g.q;
  let r = I.decide(g, q0.arrest, T0 + 10);
  assert.ok(r.ok); assert.equal(r.gain, I.RULES.base); assert.equal(g.hits, 1); assert.equal(g.combo, 1);
  assert.equal(g.endAt, end0 + I.RULES.hitTime * 1000);
  assert.notStrictEqual(g.q, q0);
  const q1 = g.q, end1 = g.endAt;
  r = I.decide(g, !q1.arrest, T0 + 20);
  assert.ok(!r.ok); assert.equal(r.penalty, I.RULES.missPenalty); assert.equal(g.combo, 0); assert.equal(g.misses, 1);
  assert.equal(g.endAt, end1 - I.RULES.missPenalty * 1000);
  assert.notStrictEqual(g.q, q1);
  assert.throws(() => I.decide(g, 'yes', T0 + 30), e => e.code === 'BAD_PICK');
  assert.equal(g.arrests + g.passes, g.hits);
});

test('단계: 맞힌 수로 1 → 4, 4단계부터 수배 조건', () => {
  const g = I.createGame({ rng: mul(9), now: T0, duration: 999 });
  const seen = {};
  for (let i = 0; i < 30; i++) { seen[g.level] = 1; if (g.level === 4) assert.ok(g.q.wanted); I.decide(g, g.q.arrest, T0 + i); }
  assert.deepEqual(Object.keys(seen).map(Number), [1, 2, 3, 4]);
  assert.equal(I.levelForHits(0), 1); assert.equal(I.levelForHits(4), 2); assert.equal(I.levelForHits(10), 3); assert.equal(I.levelForHits(18), 4);
});

test('단서: 맞는 줄 절반에 확인 표시, 위조된 줄은 남는다, 사람마다 한 번', () => {
  const rng = mul(21);
  for (let i = 0; i < 300; i++) {
    const g = I.createGame({ rng, now: T0, freeHints: 1 });
    g.level = 3; g.q = I.makeQuestion(rng, 3);
    const q = g.q, ok = I.okRows(q), end = g.endAt;
    const h = I.hint(g, T0 + 1);
    assert.equal(h.rows.length, Math.ceil(ok.length / 2)); assert.equal(h.penalty, 0, '무료 단서');
    h.rows.forEach(a => assert.ok(ok.includes(a)));
    if (q.forged) assert.ok(!q.checked.includes(q.diff));
    assert.equal(g.endAt, end);
    assert.deepEqual(I.hint(g, T0 + 2), { rows: [], penalty: 0 });
  }
  const g2 = I.createGame({ rng: mul(2), now: T0 });
  const e2 = g2.endAt; I.hint(g2, T0 + 1);
  assert.equal(g2.endAt, e2 - I.RULES.hintPenalty * 1000, '무료가 없으면 −3초');
});

test('장비: 자외선 램프(맞는 줄 하나 미리), 검문 교관(벌점 ↓), 교대 근무조(+초), 변호사(벌점 막기)', () => {
  const g = I.createGame({ rng: mul(4), now: T0, preCheck: 1, missPenalty: 1, hitBonus: 2, mods: { shield: 1 } });
  for (let i = 0; i < 20; i++) { assert.equal(g.q.checked.length, 1); assert.ok(I.okRows(g.q).includes(g.q.checked[0])); I.decide(g, g.q.arrest, T0 + i); }
  const e = g.endAt; I.decide(g, g.q.arrest, T0 + 50); assert.equal(g.endAt, e + (I.RULES.hitTime + 2) * 1000);
  let r = I.decide(g, !g.q.arrest, T0 + 60); assert.ok(r.shielded); assert.equal(r.penalty, 0);
  const e2 = g.endAt; r = I.decide(g, !g.q.arrest, T0 + 70); assert.equal(r.penalty, 1); assert.equal(g.endAt, e2 - 1000);
  assert.throws(() => I.createGame({ rng: mul(1), now: T0, missPenalty: 99 }), e => e.code === 'BAD_OPTION');
});

test('시간: 끝난 판 · 멈춘 판은 판정 안 됨, 이유 글', () => {
  const g = I.createGame({ rng: mul(8), now: T0, duration: 1 });
  assert.throws(() => I.decide(g, true, T0 + 2000), e => e.code === 'GAME_OVER');
  const g2 = I.createGame({ rng: mul(8), now: T0 }); C.pause(g2, T0 + 1);
  assert.throws(() => I.decide(g2, true, T0 + 2), e => e.code === 'PAUSED');
  assert.equal(I.whyText({ why: 'forged', diff: 1 }), '모자가 달라요'); assert.equal(I.whyText({ why: 'forged', diff: 2 }), '얼굴이 달라요');
  assert.equal(I.whyText({ why: 'forged', diff: 0 }), '시간대가 달라요'); assert.equal(I.whyText({ why: 'forged', diff: 3 }), '흔적이 달라요');
  assert.match(I.whyText({ why: 'wanted', wanted: { a: 2, v: 2 } }), /수배 조건\(마스크\)/);
  assert.equal(I.whyText({ why: 'clean' }), '신분증이 맞아요');
});
