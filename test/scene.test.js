const test = require('node:test');
const assert = require('node:assert');
const S = require('../src/scene.js');
const I = require('../src/idle.js');

test('장면: 일지 글을 문장으로 나눈다(따옴표 안에서는 끊지 않는다)', () => {
  assert.deepEqual(S.sentences('하나다. 둘이다! 서장이 말했다. "3팀이 맡아. 지금."'), ['하나다.', '둘이다!', '서장이 말했다.', '"3팀이 맡아. 지금."']);
  assert.deepEqual(S.sentences(''), []); assert.deepEqual(S.sentences(null), []);
  I.CASES.forEach((c) => { const s = S.sentences(c.story[0].text); assert.ok(s.length >= 3 && s.length <= 9, '사건 ' + c.no + ' 시작 편 문장 수 ' + s.length); assert.equal(s.join(' ').replace(/\s+/g, ' '), c.story[0].text.replace(/\s+/g, ' ').trim()); });
});
