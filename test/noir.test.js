// 누아르 각성(0.8.4): 열리는 조건(전설 바로 · 다른 등급 ★5) · 켜기/끄기 · 새로 열림 알림 · 저장 검사 · 그림 30종×4등급
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/pets.js');
const N = require('../src/noirart.js');

function fresh() { const s = { gems: 0 }; P.clean(s); return s; }

test('0.13.15 ★5가 되면 살 수 있다(전설도 같은 규칙)', () => {
  const s = fresh();
  s.pets.own['lion:l'] = 1; s.pets.own['corgi:c'] = 4; s.pets.own['deer:h'] = 5;
  assert.equal(P.canNoir(s, 'lion:l'), false, '전설도 ★5부터');
  assert.equal(P.canNoir(s, 'corgi:c'), false);
  assert.equal(P.canNoir(s, 'deer:h'), true);
  assert.equal(P.canNoir(s, 'seal:l'), false, '없는 동물은 안 됨');
});

test('0.13.15 장면마다 사고, 산 장면만 켤 수 있다', () => {
  const s = fresh(); s.gems = 100; s.pets.treats = 500;
  s.pets.own['corgi:c'] = 4;
  assert.throws(() => P.buyLook(s, 'corgi:c', 'a', 'gems'), e => e.code === 'LOCKED');
  s.pets.own['corgi:c'] = 5;
  assert.deepEqual(P.noirNew(s), ['corgi:c'], '★5 가 되면 알림');
  assert.equal(P.setNoir(s, 'corgi:c', true), false, '안 산 장면은 못 켠다');
  P.buyLook(s, 'corgi:c', 'a', 'treats');
  assert.equal(s.pets.treats, 500 - P.LOOK_COST.treats);
  assert.deepEqual(P.noirNew(s), [], '샀으면 알림 끝');
  assert.equal(P.setNoir(s, 'corgi:c', true), true); assert.equal(P.noirOn(s, 'corgi:c'), true);
  assert.equal(P.setNoir(s, 'corgi:c', 'b'), false, '현장은 아직 안 샀다');
  assert.throws(() => P.buyLook(s, 'corgi:c', 'a', 'gems'), e => e.code === 'ALREADY');
  P.buyLook(s, 'corgi:c', 'b', 'gems'); assert.equal(s.gems, 100 - P.LOOK_COST.gems);
  assert.deepEqual(P.looksOf(s, 'corgi:c'), ['a', 'b']);
  assert.equal(P.setNoir(s, 'corgi:c', 'b'), true); assert.equal(P.noirScene(s, 'corgi:c'), 'b');
  P.setNoir(s, 'corgi:c', false); assert.equal(P.noirOn(s, 'corgi:c'), false);
  s.gems = 0; s.pets.own['deer:h'] = 5;
  assert.throws(() => P.buyLook(s, 'deer:h', 'a', 'gems'), e => e.code === 'NOT_ENOUGH');
  assert.throws(() => P.buyLook(s, 'deer:h', 'z', 'gems'), e => e.code === 'BAD_LOOK');
  P.clean(s); assert.deepEqual(P.looksOf(s, 'corgi:c'), ['a', 'b'], '저장해도 남는다'); assert.deepEqual(P.looksOf(s, 'deer:h'), []);
});

test('0.13.15 옛 저장: 예전에 열려 있던 코드네임은 두 장면 모두 그대로', () => {
  const s = { pets: { own: { 'lion:l': 1, 'corgi:c': 2, 'deer:h': 5 }, noir: { 'lion:l': 'b', 'corgi:c': true, 'xx:q': true }, noirSeen: { 'lion:l': true, '<b>': true } } };
  P.clean(s);
  assert.deepEqual(P.looksOf(s, 'lion:l'), ['a', 'b']); assert.deepEqual(P.looksOf(s, 'deer:h'), ['a', 'b']); assert.deepEqual(P.looksOf(s, 'corgi:c'), []);
  assert.deepEqual(s.pets.noir, { 'lion:l': 'b' });
  assert.deepEqual(s.pets.noirSeen, { 'lion:l': true });
  const t = { pets: { own: { 'corgi:c': 5 }, nlook: {} } }; P.clean(t);
  assert.deepEqual(P.looksOf(t, 'corgi:c'), [], '새 저장(nlook 있음)은 공짜로 안 준다');
});

test('누아르 그림: 파트너 30종 모두 · 4등급 모두 SVG 가 나오고, 그림마다 id 가 겹치지 않는다', () => {
  assert.equal(N.ids.length, 30);
  P.SPECIES.forEach(sp => assert.ok(N.has(sp.id), sp.id));
  const a = N.draw('corgi', { grade: 'c' }), b = N.draw('corgi', { grade: 'c' });   // 그림 있는 종도 id 가 겹치면 안 된다
  ['c', 'r', 'h', 'l'].forEach(g => P.SPECIES.forEach(sp => {
    const v = N.draw(sp.id, { grade: g });
    assert.match(v, /^<svg[^>]*viewBox="0 0 200 200"/); assert.ok(v.endsWith('</svg>'));
    assert.doesNotMatch(v.replace(/data:image\/webp;base64,[A-Za-z0-9+\/=]+/g, ''), /NaN|undefined/, sp.id + ' ' + g);   // 그림 데이터 속 글자는 빼고
  }));
  assert.notEqual(a.match(/id="(n[pz]\d+)/)[1], b.match(/id="(n[pz]\d+)/)[1]);
});

test('0.8.6 그림 도구 초상: 받은 26종은 그림으로, 나머지는 예전 그림으로', () => {
  const Pics = require('../src/noirpics.js');
  assert.ok(Object.keys(Pics).length >= 26);
  // 0.12.3 그림 이름은 동물 id, 또는 id_a(사무실) · id_b(현장)
  Object.keys(Pics).forEach(k => { const id = k.replace(/_[ab]$/, ''); assert.ok(N.has(id), k); assert.match(Pics[k], /^data:image\/webp;base64,/); });
  P.SPECIES.forEach(sp => {
    const has = !!(Pics[sp.id] || Pics[sp.id + '_a']);
    assert.equal(N.draw(sp.id, { grade: 'l' }).includes('<image href="data:image/webp'), has, sp.id);
    if (Pics[sp.id + '_a']) {
      assert.ok(Pics[sp.id + '_b'], sp.id + ' 현장 그림'); assert.ok(!Pics[sp.id], sp.id + ' 예전 그림은 빠져야');
      assert.ok(N.has(sp.id, 'b')); assert.ok(N.draw(sp.id, { scene: 'b' }).includes(Pics[sp.id + '_b'])); assert.ok(N.draw(sp.id, {}).includes(Pics[sp.id + '_a']));
    } else assert.ok(!N.has(sp.id, 'b'));
  });
  const s = {}; P.clean(s); s.pets.own['tiger:l'] = 5; s.pets.nlook['tiger:l'] = { a: true, b: true };
  assert.equal(P.setNoir(s, 'tiger:l', 'b'), true); assert.equal(P.noirScene(s, 'tiger:l'), 'b'); P.clean(s); assert.equal(P.noirScene(s, 'tiger:l'), 'b');
  P.setNoir(s, 'tiger:l', true); assert.equal(P.noirScene(s, 'tiger:l'), 'a'); assert.equal(P.noirOn(s, 'tiger:l'), true);
});

// 0.13.14 매점 한정 카드가 쓰는 그림(늑대 현장 · 사무실)이 실제로 있어야 한다
test('한정 파트너 그림이 있다', function () {
  var pics = require('../src/noirpics.js');
  assert.ok(pics.wolf_b || pics.wolf_a, '늑대 코드네임 그림이 없다');
});
