'use strict';
// 사건 3 면통 라인업(0.5.0): 답이 늘 하나 · 진술이 모두 쓸모 있음 · 판정 · 단서 · 장비
const test = require('node:test');
const assert = require('node:assert');
const C = require('../src/core.js');
const L = require('../src/lineup.js');
function mul(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const T0 = 1e12;

test('문제: 단계마다 인원 · 진술 수, 답은 늘 하나, 진술 하나만 빼도 답이 안 정해짐', () => {
  const rng = mul(7);
  for (let i = 0; i < 1200; i++) {
    const lv = 1 + (i % 4), q = L.makeQuestion(rng, lv), cfg = L.LV[lv];
    assert.equal(q.line.length, cfg.n); assert.equal(q.says.length, cfg.says);
    assert.deepEqual(L.candidates(q.line, q.says), [q.ans]);
    q.says.forEach((_, k) => assert.ok(L.candidates(q.line, q.says.filter((__, j) => j !== k)).length > 1, '쓸모없는 진술'));
    q.says.forEach(s => { if (s.a >= 0) assert.ok(cfg.attrs.includes(s.a), '단계에 없는 특징') });
    const keys = q.line.map(id => C.project(id, cfg.attrs).join(''));
    assert.equal(new Set(keys).size, keys.length, '보이는 특징이 같은 두 사람');
    if (lv === 4) assert.ok(q.says.filter(s => s.kind !== 'self' && s.kind !== 'not').length >= 2);
    if (lv === 1) assert.ok(q.says.every(s => s.kind !== 'not' && s.kind !== 'next'));
  }
});

test('진술 문장: 모든 종류가 읽히는 문장, html 은 <em> 만', () => {
  const kinds = { self: 0, not: 0, left: 0, right: 0, edge: 0, next: 0 }, rng = mul(3);
  for (let i = 0; i < 600; i++) L.makeQuestion(rng, 3 + (i % 2)).says.forEach(s => {
    kinds[s.kind]++;
    const t = L.sayText(s), h = L.sayText(s, true);
    assert.match(t, /^범인/); assert.match(t, /요$/); assert.ok(!/</.test(t));
    assert.equal(h.replace(/<\/?em>/g, ''), t);
  });
  Object.keys(kinds).forEach(k => assert.ok(kinds[k] > 0, k + ' 진술이 안 나옴'));
});

test('판: 맞으면 점수 · 시간 · 다음 문제, 틀리면 벌점 · X · 같은 문제 · 어긋난 진술', () => {
  const g = L.createGame({ rng: mul(1), now: T0 });
  const q = g.q, wrong = [...q.line.keys()].find(j => j !== q.ans);
  const r = L.choose(g, wrong, T0);
  assert.equal(r.ok, false); assert.equal(r.penalty, 5); assert.ok(r.broke.length >= 1);
  assert.equal(g.q, q); assert.deepEqual(q.out, [wrong]);
  assert.throws(() => L.choose(g, wrong, T0), { code: 'ALREADY_OUT' });
  assert.equal(C.timeLeft(g, T0), 85);
  const ok = L.choose(g, q.ans, T0);
  assert.equal(ok.ok, true); assert.equal(g.score, 100); assert.notEqual(g.q, q);
  assert.equal(C.timeLeft(g, T0), 87);
});

test('단계: 3 · 7 · 12 검거에서 오르고 문제도 그 단계', () => {
  const g = L.createGame({ rng: mul(2), now: T0, duration: 999 }), ups = [];
  for (let i = 0; i < 13; i++) { const r = L.choose(g, g.q.ans, T0); if (r.levelUp) ups.push([g.hits, r.levelUp]); assert.equal(g.q.level, g.level); }
  assert.deepEqual(ups, [[3, 2], [7, 3], [12, 4]]);
});

test('단서: 아닌 자리 절반을 지우고(답은 안 지움) 문제마다 한 번, 무료 먼저', () => {
  const g = L.createGame({ rng: mul(4), now: T0, freeHints: 1 });
  const h = L.hint(g, T0);
  assert.equal(h.penalty, 0); assert.equal(h.out.length, Math.ceil((g.q.line.length - 1) / 2)); assert.ok(!h.out.includes(g.q.ans));
  assert.deepEqual(L.hint(g, T0).out, []);
  L.choose(g, g.q.ans, T0);
  assert.equal(L.hint(g, T0).penalty, 3);
  const n = L.createGame({ rng: mul(4), now: T0, mods: { noHints: true } });
  assert.throws(() => L.hint(n, T0), { code: 'NO_HINTS' });
});

test('장비: 화가는 아닌 자리 하나를 미리 지우고, 조명 기사 벌점 · 베테랑 증인 +초, 변호사 면제', () => {
  const g = L.createGame({ rng: mul(5), now: T0, preOut: 1, missPenalty: 3, hitBonus: 2, mods: { shield: 1 } });
  for (let i = 0; i < 20; i++) { assert.equal(g.q.out.length, 1); assert.ok(!g.q.out.includes(g.q.ans)); L.choose(g, g.q.ans, T0); }
  assert.equal(C.timeLeft(g, T0), 90 + 20 * 4);
  const w = () => [...g.q.line.keys()].find(j => j !== g.q.ans && !g.q.out.includes(j));
  assert.equal(L.choose(g, w(), T0).shielded, true);
  assert.equal(L.choose(g, w(), T0).penalty, 3);
  assert.throws(() => L.createGame({ rng: mul(1), now: T0, missPenalty: 99 }), { code: 'BAD_OPTION' });
});

test('시간: 멈춘 판 · 끝난 판은 고를 수 없다', () => {
  const g = L.createGame({ rng: mul(6), now: T0, duration: 3 });
  C.pause(g, T0); assert.throws(() => L.choose(g, 0, T0), { code: 'PAUSED' }); C.resume(g, T0 + 5000);
  assert.throws(() => L.choose(g, g.q.ans, T0 + 9000), { code: 'GAME_OVER' });
});
