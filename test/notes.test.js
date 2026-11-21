// 패치노트 형식: 버전은 숫자와 점, 위로 갈수록 새 버전, 같은 버전이 두 번 없음
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const N = require('../src/notes.js');
const U = require('../src/update.js');

test('패치노트: 형식과 순서', () => {
  assert.ok(N.length >= 1);
  const seen = new Set();
  N.forEach((n, i) => {
    assert.match(n.ver, /^\d+(\.\d+)*$/);
    assert.ok(!seen.has(n.ver), '같은 버전이 두 번: ' + n.ver); seen.add(n.ver);
    assert.equal(typeof n.title, 'string');
    assert.ok(Array.isArray(n.items) && n.items.length > 0);
    if (i > 0) assert.ok(U.isNewer(N[i - 1].ver, n.ver), N[i - 1].ver + ' 이 ' + n.ver + ' 보다 새 버전이어야 한다');
  });
});

test('패치노트: 이야기 스포일러(악당 이름)를 적지 않는다', () => {
  for (const n of N) for (const t of [n.title].concat(n.items))
    for (const w of ['써드', '설계자']) assert.ok(!t.includes(w), n.ver + ' 패치노트에 스포일러: ' + w);
});
