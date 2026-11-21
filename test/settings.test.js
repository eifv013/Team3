// 설정(settings.js): 값 바로잡기, 예전 소리 끔 옮기기, 크기 곡선, 백업 코드 만들기·읽기
const test = require('node:test');
const assert = require('node:assert');
const S = require('../src/settings.js');

function memStore(init = {}) {
  const m = Object.assign({}, init);
  return { m, get: (k) => (k in m ? m[k] : null), set: (k, v) => { m[k] = String(v); } };
}

test('normalize: 범위 밖·소수·문자·빈 값을 0~100 정수와 기본값으로', () => {
  assert.deepStrictEqual(S.normalize(null), S.DEFAULTS);
  assert.deepStrictEqual(S.normalize({ music: 150, sfx: -3, vibrate: 'yes' }), { music: 100, sfx: 0, vibrate: true });
  assert.deepStrictEqual(S.normalize({ music: '42.6', sfx: 'abc', vibrate: false, extra: 1 }), { music: 45, sfx: S.DEFAULTS.sfx, vibrate: false });
  assert.strictEqual(S.normalize({ music: 52 }).music, 50, '5 단위로');
  assert.strictEqual(S.DEFAULTS.music, 50); assert.strictEqual(S.DEFAULTS.sfx, 50);
  assert.strictEqual(S.normalize({ music: '' }).music, S.DEFAULTS.music);
  assert.strictEqual(S.normalize({ music: Infinity }).music, S.DEFAULTS.music);
});

test('load/save: 저장한 값을 그대로 읽고, 깨진 값은 기본값', () => {
  const st = memStore();
  assert.deepStrictEqual(S.load(st), S.DEFAULTS);
  assert.ok(S.save(st, { music: 10, sfx: 20, vibrate: false }));
  assert.deepStrictEqual(S.load(st), { music: 10, sfx: 20, vibrate: false });
  assert.strictEqual(JSON.parse(st.m[S.KEY]).scale, S.SCALE);
  assert.deepStrictEqual(S.load(memStore({ [S.KEY]: '{깨짐' })), S.DEFAULTS);
});

test('예전 판의 소리 끔은 음악 0·효과음 0 으로 한 번 옮기고, 설정이 있으면 예전 값은 보지 않는다', () => {
  const st = memStore({ [S.LEGACY_MUTE_KEY]: '1' });
  const s = S.load(st);
  assert.strictEqual(s.music, 0); assert.strictEqual(s.sfx, 0); assert.strictEqual(s.vibrate, true);
  assert.ok(st.m[S.KEY], '옮긴 값을 적어 둔다');
  S.save(st, { music: 50, sfx: 50, vibrate: true });
  assert.strictEqual(S.load(st).music, 50);
  assert.deepStrictEqual(S.load(memStore({ [S.LEGACY_MUTE_KEY]: '0' })), S.DEFAULTS);
});

test('저장소가 던져도(사파리 사생활 보호 등) 기본값으로 동작', () => {
  const bad = { get() { throw new Error('막힘'); }, set() { throw new Error('막힘'); } };
  assert.deepStrictEqual(S.load(bad), S.DEFAULTS);
  assert.strictEqual(S.save(bad, S.DEFAULTS), false);
});

test('크기 비율: 0 → 0, 100 → 1, 50 → 0.5, 범위 밖은 자른다', () => {
  assert.strictEqual(S.gain(0), 0);
  assert.strictEqual(S.gain(100), 1);
  assert.strictEqual(S.gain(50), 0.5);
  assert.strictEqual(S.gain(300), 1);
  assert.strictEqual(S.gain('x'), 0);
});

test('백업 코드: 한글이 든 저장도 그대로 오간다. 공백·줄바꿈이 섞여도 읽는다', () => {
  const json = JSON.stringify({ v: 1, money: 1234, profile: { station: '해운대서', leader: '김형사' } });
  const code = S.exportCode(json);
  assert.match(code, /^T3-[A-Za-z0-9+/=]+$/);
  assert.deepStrictEqual(S.importCode(code, 1), { ok: true, json });
  const messy = ' ' + code.slice(0, 10) + '\n' + code.slice(10, 30) + '  ' + code.slice(30) + '\n';
  assert.deepStrictEqual(S.importCode(messy, 1), { ok: true, json });
});

test('백업 코드 실패: 빈 값·다른 머리말·잘린 코드·JSON 아님·배열·다른 버전', () => {
  const ok = S.exportCode(JSON.stringify({ v: 1 }));
  assert.strictEqual(S.importCode('', 1).reason, 'empty');
  assert.strictEqual(S.importCode(null, 1).reason, 'empty');
  assert.strictEqual(S.importCode('Z7-abc', 1).reason, 'prefix');
  assert.strictEqual(S.importCode(ok.slice(0, ok.length - 5), 1).reason, 'broken');
  assert.strictEqual(S.importCode('T3-' + Buffer.from('not json').toString('base64'), 1).reason, 'broken');
  assert.strictEqual(S.importCode('T3-' + Buffer.from('[1,2]').toString('base64'), 1).reason, 'broken');
  assert.strictEqual(S.importCode('T3-!!!', 1).reason, 'broken');
  assert.strictEqual(S.importCode(ok, 2).reason, 'version');
  for (const r of ['empty', 'prefix', 'broken', 'version']) assert.ok(S.REASONS[r]);
  assert.throws(() => S.exportCode(''));
});

test('예전 눈금(0.1.18~19) 설정: 손대지 않은 기본값 70/80 은 새 기본 50/50, 직접 바꾼 값은 5 단위로 맞추고 다시 적는다', () => {
  const a = memStore({ [S.KEY]: JSON.stringify({ music: 70, sfx: 80, vibrate: false }) });
  assert.deepStrictEqual(S.load(a), { music: 50, sfx: 50, vibrate: false });
  assert.strictEqual(JSON.parse(a.m[S.KEY]).scale, S.SCALE);
  const b = memStore({ [S.KEY]: JSON.stringify({ music: 33, sfx: 0, vibrate: true }) });
  assert.deepStrictEqual(S.load(b), { music: 35, sfx: 0, vibrate: true });
  const c = memStore({ [S.KEY]: JSON.stringify({ music: 70, sfx: 80, vibrate: true, scale: S.SCALE }) });
  assert.deepStrictEqual(S.load(c), { music: 70, sfx: 80, vibrate: true }, '새 눈금으로 저장된 70/80 은 그대로');
});
