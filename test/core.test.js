// SuspectsCore 단위 테스트: node --test test/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/core.js');

const T0 = 1_000_000; // 고정 시각(ms)

// 판을 원하는 카드로 바꿔 끼운 게임을 만든다
function gameWith(board, seed = 7) {
  const g = C.createGame({ rng: C.makeRng(seed), now: T0, level: 4 });   // 네 속성 다 보는 판
  g.board = board.slice();
  return g;
}

test('decode/encode 는 서로 역함수이고 81장이 모두 다르다', () => {
  const seen = new Set();
  for (let id = 0; id < 81; id++) {
    const v = C.decode(id);
    assert.equal(C.encode(v), id);
    seen.add(v.join(''));
  }
  assert.equal(seen.size, 81);
});

test('잘못된 카드 id 는 BAD_CARD 오류', () => {
  for (const bad of [-1, 81, 1.5, NaN, '3', null]) {
    assert.throws(() => C.decode(bad), { code: 'BAD_CARD' });
  }
  assert.throws(() => C.encode([0, 1, 3, 0]), { code: 'BAD_CARD' });
  assert.throws(() => C.encode([0, 1]), { code: 'BAD_CARD' });
});

test('모두 같음/모두 다름은 검거, 둘만 같으면 실패', () => {
  // 시간대만 다르고 나머지 모두 같음 → 검거
  assert.equal(C.isSet(C.encode([0,1,1,1]), C.encode([1,1,1,1]), C.encode([2,1,1,1])), true);
  // 네 속성 모두 다름 → 검거
  assert.equal(C.isSet(C.encode([0,0,0,0]), C.encode([1,1,1,1]), C.encode([2,2,2,2])), true);
  // 모자만 둘이 같음 → 실패
  assert.equal(C.isSet(C.encode([0,0,0,0]), C.encode([1,0,1,1]), C.encode([2,2,2,2])), false);
  // 같은 카드 셋은 검거가 아니다
  assert.equal(C.isSet(5, 5, 5), false);
});

test('thirdCard 는 어떤 두 장이든 검거를 완성한다', () => {
  for (let a = 0; a < 81; a++) for (let b = 0; b < 81; b++) {
    if (a === b) continue;
    const c = C.thirdCard(a, b);
    assert.ok(c !== a && c !== b);
    assert.equal(C.isSet(a, b, c), true);
  }
  assert.throws(() => C.thirdCard(3, 3), { code: 'SAME_CARD' });
});

test('explain 은 둘만 같은 속성만 짚는다', () => {
  const r = C.explain(C.encode([0,0,0,0]), C.encode([1,0,2,1]), C.encode([2,2,1,1]));
  assert.deepEqual(r.map(x => x.key), ['hat', 'mark']);
  assert.equal(r[0].value, '맨머리');   // 모자: 맨머리가 둘
  assert.equal(r[1].value, '유리 조각'); // 흔적: 값 1(유리 조각)이 둘
  assert.deepEqual(C.explain(C.encode([0,0,0,0]), C.encode([1,1,1,1]), C.encode([2,2,2,2])), []);
});

test('findSets 는 모든 조합을 브루트포스와 같게 찾는다', () => {
  const rng = C.makeRng(42);
  for (let n = 0; n < 200; n++) {
    const board = C.newBoard(rng);
    const sets = C.findSets(board);
    let count = 0;
    for (let i = 0; i < 9; i++) for (let j = i + 1; j < 9; j++) for (let k = j + 1; k < 9; k++) {
      const v = [board[i], board[j], board[k]].map(C.decode);
      if ([0,1,2,3].every(t => new Set(v.map(x => x[t])).size !== 2)) count++;
    }
    assert.equal(sets.length, count);
  }
});

test('newBoard 는 서로 다른 9장, 같은 시드면 같은 판', () => {
  const a = C.newBoard(C.makeRng(1)), b = C.newBoard(C.makeRng(1));
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, 9);
  assert.throws(() => C.newBoard(null), { code: 'BAD_RNG' });
});

test('drawDistinct 는 rng 가 범위를 벗어나도 판을 깨지 않고, 카드가 모자라면 오류', () => {
  const out = C.drawDistinct(() => 1.5, [], 3);
  assert.equal(new Set(out).size, 3);
  const all = Array.from({ length: 80 }, (_, i) => i);
  assert.throws(() => C.drawDistinct(Math.random, all, 2), { code: 'DECK_EMPTY' });
});

test('refill 은 고른 자리만 바꾸고, 잡힌 카드와 판의 카드는 다시 나오지 않는다', () => {
  const rng = C.makeRng(9);
  for (let n = 0; n < 300; n++) {
    const board = C.newBoard(rng);
    const next = C.refill(board, [1, 4, 7], rng);
    assert.equal(new Set(next).size, 9);
    for (const i of [0, 2, 3, 5, 6, 8]) assert.equal(next[i], board[i]);
    for (const i of [1, 4, 7]) assert.ok(!board.includes(next[i]));
  }
});

test('연속 검거 배수는 1, 1.5, 2, … 3 에서 멈춘다', () => {
  assert.deepEqual([0,1,2,3,4,5,6,9].map(C.multiplier), [1, 1, 1.5, 2, 2.5, 3, 3, 3]);
});

test('검거 성공: 점수·연속·시간이 오르고 세 자리가 바뀐다', () => {
  const s = [C.encode([0,0,0,0]), C.encode([1,1,1,1]), C.encode([2,2,2,2])];
  const board = [s[0], 10, s[1], 20, 30, s[2], 40, 50, 60];
  const g = gameWith(board);
  const end0 = g.endAt;
  const r = C.submit(g, [0, 2, 5], T0 + 1000);
  assert.equal(r.ok, true);
  assert.equal(r.gain, 100);
  assert.equal(g.combo, 1);
  assert.equal(g.endAt, end0 + C.RULES.hitTime * 1000);
  assert.deepEqual([1,3,4,6,7,8].map(i => g.board[i]), [10,20,30,40,50,60]);
  assert.ok([0,2,5].every(i => !s.includes(g.board[i])));
});

test('연속 검거 두 번째는 1.5배', () => {
  const g = gameWith(C.newBoard(C.makeRng(3)));
  g.combo = 1;
  const a = g.board[0], b = g.board[1];
  g.board[2] = C.thirdCard(a, b);
  // 판에 같은 카드가 생기지 않도록 확인(시드 고정이라 결정적)
  assert.equal(new Set(g.board).size, 9);
  const r = C.submit(g, [0, 1, 2], T0);
  assert.equal(r.gain, 150);
  assert.equal(g.bestCombo, 2);
});

test('오인 체포: 연속이 끊기고 5초 줄며 이유를 알려 준다', () => {
  const board = [C.encode([0,0,0,0]), C.encode([1,0,1,1]), C.encode([2,2,2,2]), 10, 20, 30, 40, 50, 60];
  const g = gameWith(board);
  g.combo = 4;
  const end0 = g.endAt;
  const r = C.submit(g, [0, 1, 2], T0);
  assert.equal(r.ok, false);
  assert.deepEqual(r.reasons.map(x => x.key), ['hat']);
  assert.equal(g.combo, 0);
  assert.equal(g.misses, 1);
  assert.equal(g.endAt, end0 - 5000);
  assert.deepEqual(g.board, board); // 판은 그대로
});

test('잘못된 고르기는 BAD_PICK 오류', () => {
  const g = gameWith(C.newBoard(C.makeRng(5)));
  for (const bad of [[0, 1], [0, 1, 1], [0, 1, 9], [0, 1, -1], [0, 1, 1.5], 'abc']) {
    assert.throws(() => C.submit(g, bad, T0), { code: 'BAD_PICK' });
  }
});

// 조합이 없는 판과 있는 판을 시드로 찾아 둔다
function findBoard(wantNone) {
  const rng = C.makeRng(11);
  for (;;) {
    const b = C.newBoard(rng);
    if ((C.findSets(b).length === 0) === wantNone) return b;
  }
}

test('검거 불가 적중: 300점과 5초, 판 전체 교체', () => {
  const g = gameWith(findBoard(true));
  const old = g.board.slice(), end0 = g.endAt;
  const r = C.declareNone(g, T0);
  assert.equal(r.ok, true);
  assert.equal(r.gain, 300);
  assert.equal(g.noneHits, 1);
  assert.equal(g.endAt, end0 + 5000);
  assert.notDeepEqual(g.board, old);
  assert.equal(new Set(g.board).size, 9);
});

test('검거 불가 오판: 10초 줄고 남은 건수를 알려 준다', () => {
  const board = findBoard(false);
  const g = gameWith(board);
  g.combo = 3;
  const r = C.declareNone(g, T0);
  assert.equal(r.ok, false);
  assert.equal(r.remaining, C.findSets(board).length);
  assert.equal(g.combo, 0);
  assert.equal(g.endAt, T0 + C.RULES.duration * 1000 - 10000);
});

test('시간이 다 되면 끝나고, 끝난 판에서는 GAME_OVER', () => {
  const g = gameWith(C.newBoard(C.makeRng(2)));
  assert.equal(C.tick(g, T0 + 89_000), false);
  assert.equal(C.timeLeft(g, T0 + 30_000), 60);
  assert.equal(C.tick(g, T0 + 90_000), true);
  assert.equal(C.timeLeft(g, T0 + 999_999), 0);
  assert.throws(() => C.submit(g, [0, 1, 2], T0 + 90_000), { code: 'GAME_OVER' });
  assert.throws(() => C.declareNone(g, T0 + 90_000), { code: 'GAME_OVER' });
});

test('벌점으로 시간이 0 아래가 되면 그 자리에서 끝난다', () => {
  const g = gameWith(findBoard(false));
  const r = C.declareNone(g, T0 + 85_000); // 5초 남았는데 10초 벌점
  assert.equal(r.ok, false);
  assert.equal(g.over, true);
});

test('createGame 은 잘못된 인자를 거부한다', () => {
  assert.throws(() => C.createGame({ now: T0 }), { code: 'BAD_RNG' });
  assert.throws(() => C.createGame({ rng: Math.random }), { code: 'BAD_TIME' });
  assert.throws(() => C.createGame({ rng: Math.random, now: T0, duration: 0 }), { code: 'BAD_DURATION' });
});

test('9장 판에 조합이 없는 경우가 "검거 불가"가 의미 있을 만큼 나온다', () => {
  const rng = C.makeRng(2026);
  let none = 0;
  const N = 20000;
  for (let i = 0; i < N; i++) if (C.findSets(C.newBoard(rng)).length === 0) none++;
  const rate = none / N;
  console.log(`  조합 없는 판 비율: ${(rate * 100).toFixed(1)}%`);
  assert.ok(rate > 0.05 && rate < 0.6, String(rate));
});

test('일시정지 동안 시간이 흐르지 않고, 재개하면 멈춘 만큼 뒤로 밀린다', () => {
  const g = gameWith(C.newBoard(C.makeRng(4)));
  C.pause(g, T0 + 10_000);
  assert.equal(C.timeLeft(g, T0 + 60_000), 80);          // 50초가 지나도 그대로
  assert.equal(C.tick(g, T0 + 500_000), false);           // 멈춘 동안에는 끝나지 않는다
  C.pause(g, T0 + 20_000);                                // 두 번 멈춰도 처음 시각 유지
  C.resume(g, T0 + 60_000);
  assert.equal(g.pausedAt, null);
  assert.equal(C.timeLeft(g, T0 + 60_000), 80);
  assert.equal(g.endAt, T0 + 90_000 + 50_000);
  C.resume(g, T0 + 70_000);                               // 멈추지 않은 판의 재개는 아무 일도 없다
  assert.equal(g.endAt, T0 + 140_000);
});

test('멈춘 판에서는 검거·검거 불가가 PAUSED 오류', () => {
  const g = gameWith(C.newBoard(C.makeRng(4)));
  C.pause(g, T0);
  assert.throws(() => C.submit(g, [0, 1, 2], T0), { code: 'PAUSED' });
  assert.throws(() => C.declareNone(g, T0), { code: 'PAUSED' });
});

test('끝난 판은 멈출 수 없다', () => {
  const g = gameWith(C.newBoard(C.makeRng(4)));
  C.tick(g, T0 + 90_000);
  assert.throws(() => C.pause(g, T0 + 90_000), { code: 'GAME_OVER' });
});

test('단서: 한 번에 한 명씩 최대 두 명, 한 번에 3초', () => {
  const g = gameWith(findBoard(false));
  const end0 = g.endAt;
  const a = C.hint(g, T0);
  assert.equal(a.indices.length, 1);
  const b = C.hint(g, T0);
  assert.equal(b.indices.length, 2);
  assert.equal(b.indices[0], a.indices[0]);
  const c = C.hint(g, T0);                 // 세 번째는 공짜, 그대로
  assert.deepEqual(c.indices, b.indices);
  assert.equal(c.penalty, 0);
  assert.equal(g.endAt, end0 - 6000);
  assert.equal(g.hints, 2);
  // 짚어 준 두 명과 셋째가 실제로 한 패다
  const third = C.thirdCard(g.board[b.indices[0]], g.board[b.indices[1]]);
  assert.ok(g.board.includes(third));
});

test('단서: 판에 한 패가 없으면 그렇게 알려 준다', () => {
  const g = gameWith(findBoard(true));
  const r = C.hint(g, T0);
  assert.equal(r.none, true);
  assert.equal(g.endAt, T0 + 90_000 - 3000);
});

test('단서는 검거하면 사라지고, 오인 체포로는 남는다', () => {
  const g = gameWith(findBoard(false));
  C.hint(g, T0);
  const set = g.clue.set;
  // 오인 체포
  let bad = null;
  for (let i = 0; i < 9 && !bad; i++) for (let j = i + 1; j < 9 && !bad; j++) for (let k = j + 1; k < 9 && !bad; k++)
    if (!C.isSet(g.board[i], g.board[j], g.board[k])) bad = [i, j, k];
  C.submit(g, bad, T0);
  assert.deepEqual(g.clue.set, set);
  C.submit(g, set, T0);
  assert.equal(g.clue, null);
});

test('단서도 멈춘 판·끝난 판에서는 막힌다', () => {
  const g = gameWith(C.newBoard(C.makeRng(4)));
  C.pause(g, T0);
  assert.throws(() => C.hint(g, T0), { code: 'PAUSED' });
  C.resume(g, T0);
  C.tick(g, T0 + 999_999);
  assert.throws(() => C.hint(g, T0 + 999_999), { code: 'GAME_OVER' });
});

// 판에서 한 패를 찾아 검거한다(테스트 도우미). 없으면 검거 불가.
function catchOne(g, now = T0) {
  const set = C.findSets(g.board, C.active(g))[0];
  if (set) return C.submit(g, set, now);
  C.declareNone(g, now);
  return null;
}

test('단계별 보는 속성: 모자 → 얼굴 → 시간대 → 흔적', () => {
  assert.deepEqual(C.activeFor(1), [1]);
  assert.deepEqual(C.activeFor(2), [1, 2]);
  assert.deepEqual(C.activeFor(3), [0, 1, 2]);
  assert.deepEqual(C.activeFor(4), [0, 1, 2, 3]);
  assert.throws(() => C.activeFor(0), { code: 'BAD_LEVEL' });
  assert.throws(() => C.createGame({ rng: Math.random, now: T0, level: 5 }), { code: 'BAD_LEVEL' });
});

test('안 보는 속성은 판정에서 빠진다', () => {
  // 모자만 보면: 비니 셋은 시간대·얼굴·흔적이 제각각이어도 한 패
  const a = C.encode([0, 1, 0, 0]), b = C.encode([1, 1, 2, 0]), c = C.encode([1, 1, 1, 2]);
  assert.equal(C.isSet(a, b, c, [1]), true);
  assert.equal(C.isSet(a, b, c), false);
  assert.deepEqual(C.explain(a, b, c, [1]), []);
  assert.deepEqual(C.project(b, [1]), [0, 1, 0, 0]);
});

test('단계 판은 보이는 모양이 겹치지 않게 깔린다(모양이 모자란 1단계만 예외)', () => {
  const rng = C.makeRng(77);
  for (const lv of [2, 3, 4]) {
    for (let n = 0; n < 200; n++) {
      const b = C.dealBoard(rng, lv), act = C.activeFor(lv);
      assert.equal(new Set(b).size, 9);
      assert.equal(new Set(b.map(id => C.project(id, act).join(''))).size, 9, '단계 ' + lv);
    }
  }
  // 1단계는 모자 3가지뿐이라 겹치지만, 9장에 한 패가 반드시 있다
  for (let n = 0; n < 200; n++) assert.ok(C.findSets(C.dealBoard(rng, 1), [1]).length > 0);
});

test('refillBoard 도 남은 카드와 모양이 겹치지 않는다', () => {
  const rng = C.makeRng(5);
  for (let n = 0; n < 300; n++) {
    const b = C.dealBoard(rng, 3), act = C.activeFor(3);
    const next = C.refillBoard(b, [0, 4, 8], rng, 3);
    assert.equal(new Set(next).size, 9);
    assert.equal(new Set(next.map(id => C.project(id, act).join(''))).size, 9);
    for (const i of [1, 2, 3, 5, 6, 7]) assert.equal(next[i], b[i]);
  }
});

test('쉬운 시작: 2명→얼굴, 4명→시간대, 7명→흔적이 열리고 그때마다 판 전체가 바뀐다', () => {
  const g = C.createGame({ rng: C.makeRng(21), now: T0 });
  assert.equal(g.level, 1);
  const ups = [];
  for (let n = 0; n < 100 && g.level < 4; n++) {
    const r = catchOne(g);
    if (r && r.levelUp) { ups.push([g.hits, r.levelUp]); assert.equal(r.replaced.length, 9); }
  }
  assert.deepEqual(ups, [[2, 2], [4, 3], [7, 4]]);
});

test('노말: 4단계로 시작하면 단계가 오르지 않는다', () => {
  const g = C.createGame({ rng: C.makeRng(3), now: T0, level: 4 });
  for (let n = 0; n < 15; n++) { const r = catchOne(g); if (r) assert.equal(r.levelUp, undefined); }
  assert.equal(g.level, 4);
});

test('needs: 같은 속성은 같게, 다른 속성은 남은 하나로', () => {
  const a = C.encode([0, 1, 2, 0]), b = C.encode([1, 1, 0, 0]);
  const n = C.needs(a, b);
  assert.deepEqual(n.map(x => [x.key, x.same, x.value]), [
    ['time', false, '밤'], ['hat', true, '비니'], ['face', false, '안경'], ['mark', true, '지문']
  ]);
  // needs 가 말하는 사람 = thirdCard
  const t = C.decode(C.thirdCard(a, b));
  n.forEach(x => assert.equal(C.ATTRS[x.index].values[t[x.index]], x.value));
  assert.deepEqual(C.needs(a, b, [1, 2]).map(x => x.key), ['hat', 'face']);
});

test('makeLesson: 정답은 한 패, 오답은 정확히 한 가지 이유로 틀린다', () => {
  const rng = C.makeRng(99);
  for (const lv of [1, 2, 3, 4]) {
    for (let n = 0; n < 200; n++) {
      const L = C.makeLesson(rng, lv);
      assert.equal(C.isSet(L.a, L.b, L.answer, L.active), true);
      assert.equal(L.options.length, lv === 1 ? 3 : 4);
      assert.equal(new Set(L.options).size, L.options.length);
      assert.ok(L.options.includes(L.answer));
      for (const o of L.options) if (o !== L.answer) {
        assert.equal(C.explain(L.a, L.b, o, L.active).length, 1);
      }
      const ns = C.needs(L.a, L.b, L.active);
      assert.ok(ns.some(x => !x.same), '다른 속성이 하나는 있다');
      if (lv >= 2) assert.ok(ns.some(x => x.same), '같은 속성도 하나는 있다');
      // 안 보는 속성은 0 으로 맞춰져 그림이 단순하다
      for (const id of [L.a, L.b, L.answer]) {
        const v = C.decode(id);
        for (let i = 0; i < 4; i++) if (!L.active.includes(i)) assert.equal(v[i], 0);
      }
    }
  }
});

test('무료 단서는 시간을 깎지 않는다, 증거 보관실은 오판 벌점을 줄인다', () => {
  const g = C.createGame({ rng: C.makeRng(9), now: T0, level: 4, freeHints: 1, nonePenalty: 5 });
  g.board = findBoard(false);
  const end0 = g.endAt;
  const a = C.hint(g, T0);
  assert.equal(a.penalty, 0);
  const b = C.hint(g, T0);
  assert.equal(b.penalty, 3);
  assert.equal(g.endAt, end0 - 3000);
  g.clue = null;
  const r = C.declareNone(g, T0);
  assert.equal(r.penalty, 5);
  assert.throws(() => C.createGame({ rng: Math.random, now: T0, freeHints: -1 }), { code: 'BAD_OPTION' });
});

test('3가지 단계 판에서 한 패가 없는 경우는 드물다', () => {
  const rng = C.makeRng(33); let none = 0;
  for (let i = 0; i < 5000; i++) if (C.findSets(C.dealBoard(rng, 3), C.activeFor(3)).length === 0) none++;
  console.log(`  3단계 조합 없는 판 비율: ${(none / 50).toFixed(2)}%`);
  assert.ok(none / 5000 < 0.05);
});
