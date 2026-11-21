// 효과음 묶음(sounds.js): 게임에 넣을 수 있는 크기의 mp3 data URI 인지
const test = require('node:test');
const assert = require('node:assert');
const S = require('../src/sounds.js');

test('시계 초침: mp3 data URI, 너무 크지 않고, mp3 머리말로 시작', () => {
  assert.match(S.clock, /^data:audio\/mpeg;base64,/);
  const buf = Buffer.from(S.clock.split(',')[1], 'base64');
  assert.ok(buf.length > 2000 && buf.length < 30000, '크기 ' + buf.length);
  const id3 = buf.slice(0, 3).toString() === 'ID3', frame = buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0;
  assert.ok(id3 || frame, 'mp3 머리말이 아님');
});

test('사이렌: mp3 data URI, 3~4초 분량(64kbps 기준 20~40KB)', () => {
  assert.match(S.siren, /^data:audio\/mpeg;base64,/);
  const buf = Buffer.from(S.siren.split(',')[1], 'base64');
  assert.ok(buf.length > 20000 && buf.length < 40000, '크기 ' + buf.length);
});
