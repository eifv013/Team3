// 누아르 각성(0.8.4): 열리는 조건(전설 바로 · 다른 등급 ★5) · 켜기/끄기 · 새로 열림 알림 · 저장 검사 · 그림 30종×4등급
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/pets.js');
const N = require('../src/noirart.js');

function fresh() { const s = { gems: 0 }; P.clean(s); return s; }

test('전설은 ★1 부터, 다른 등급은 ★5 가 돼야 각성이 열린다', () => {
  const s = fresh();
  s.pets.own['lion:l'] = 1; s.pets.own['corgi:c'] = 4; s.pets.own['deer:h'] = 5;
  assert.equal(P.canNoir(s, 'lion:l'), true);
  assert.equal(P.canNoir(s, 'corgi:c'), false);
  assert.equal(P.canNoir(s, 'deer:h'), true);
  assert.equal(P.canNoir(s, 'seal:l'), false, '없는 동물은 안 됨');
});

test('켜고 끄기: 조건이 안 되면 켜지지 않고, 켜면 알림도 본 것으로', () => {
  const s = fresh();
  s.pets.own['corgi:c'] = 4;
  assert.equal(P.setNoir(s, 'corgi:c', true), false);
  assert.equal(P.noirOn(s, 'corgi:c'), false);
  s.pets.own['corgi:c'] = 5;
  assert.deepEqual(P.noirNew(s), ['corgi:c']);
  assert.equal(P.setNoir(s, 'corgi:c', true), true);
  assert.equal(P.noirOn(s, 'corgi:c'), true);
  assert.deepEqual(P.noirNew(s), []);
  P.setNoir(s, 'corgi:c', false);
  assert.equal(P.noirOn(s, 'corgi:c'), false);
});

test('저장 검사: 엉뚱한 키 · 조건 안 되는 키 · true 아닌 값은 버린다', () => {
  const s = { pets: { own: { 'lion:l': 1, 'corgi:c': 2 }, noir: { 'lion:l': true, 'corgi:c': true, 'xx:q': true, 'deer:l': 1 }, noirSeen: { 'lion:l': true, '<b>': true } } };
  P.clean(s);
  assert.deepEqual(s.pets.noir, { 'lion:l': true });
  assert.deepEqual(s.pets.noirSeen, { 'lion:l': true });
  const t = { pets: { own: { 'lion:l': 1 } } }; P.clean(t);
  assert.deepEqual(t.pets.noir, {}, '옛 저장은 빈 칸으로');
});

test('누아르 그림: 파트너 30종 모두 · 4등급 모두 SVG 가 나오고, 그림마다 id 가 겹치지 않는다', () => {
  assert.equal(N.ids.length, 30);
  P.SPECIES.forEach(sp => assert.ok(N.has(sp.id), sp.id));
  const a = N.draw('corgi', { grade: 'c' }), b = N.draw('corgi', { grade: 'c' });
  ['c', 'r', 'h', 'l'].forEach(g => P.SPECIES.forEach(sp => {
    const v = N.draw(sp.id, { grade: g });
    assert.match(v, /^<svg[^>]*viewBox="0 0 200 200"/); assert.ok(v.endsWith('</svg>'));
    assert.doesNotMatch(v, /NaN|undefined/, sp.id + ' ' + g);
  }));
  assert.notEqual(a.match(/id="(nz\d+)bg"/)[1], b.match(/id="(nz\d+)bg"/)[1]);
});
