'use strict';
// 재화 아이콘(0.4.1): 이름마다 SVG 하나, 모르는 이름은 빈 문자열, 접근성 이름
const test = require('node:test');
const assert = require('node:assert');
const I = require('../src/icons.js');

test('아이콘: 알려진 이름은 svg · aria-label, 모르는 이름은 빈 문자열', () => {
  for (const n of ['gem', 'ticket', 'treat', 'money', 'tag', 'pick', 'xp']) {
    const h = I.icon(n);
    assert.match(h, /^<i class="ic ic-[a-z]+" role="img" aria-label="[^"]+"><svg viewBox="0 0 24 24"[^>]*>[\s\S]+<\/svg><\/i>$/, n);
  }
  assert.equal(I.icon('nope'), '');
  assert.match(I.amount('gem', 1234), /<b class="ic-n">1,234<\/b>/);
});
