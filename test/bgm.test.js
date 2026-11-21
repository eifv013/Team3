// 배경 음악 재생기(bgm.js): 가짜 소리 장치와 가짜 fetch 로 곡 넘기기·되풀이·실패·소리 끔을 확인한다
const test = require('node:test');
const assert = require('node:assert');
const B = require('../src/bgm.js');
const M = require('../src/music.js');

// ---- 가짜 AudioContext: 만든 노드와 start/stop 기록만 남긴다 ----
function fakeCtx() {
  const ctx = { currentTime: 0, destination: { id: 'dest' }, sources: [], decodeFail: false };
  const param = () => ({ value: 1, set: [], setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime(v) { this.value = v; this.set.push(v); }, cancelScheduledValues() {} });
  ctx.createGain = () => ({ gain: param(), connect(n) { this.to = n; } });
  ctx.createBufferSource = () => {
    const s = { started: false, stopped: false, connect(n) { this.to = n; }, start() { this.started = true; }, stop() { this.stopped = true; } };
    ctx.sources.push(s);
    return s;
  };
  ctx.decodeAudioData = (data, ok, bad) => {
    if (ctx.decodeFail) { bad(new Error('x')); return; }
    ok({ duration: data.byteLength, tag: data.tag });   // 길이(초) = 받은 바이트 수로 흉내
  };
  return ctx;
}
// 가짜 fetch: 이름별로 성공/실패를 고른다. 응답은 손으로 풀어 주어(flush) 순서를 정한다
function fakeFetch(fail = {}) {
  const calls = [], pending = [];
  const f = (url) => {
    calls.push(url);
    return new Promise((res, rej) => pending.push(() => {
      if (fail[url]) return rej(new Error('net'));
      const ab = new ArrayBuffer(200); ab.tag = url;
      res({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(ab) });
    }));
  };
  f.calls = calls;
  f.flush = async () => { while (pending.length) pending.shift()(); for (let i = 0; i < 5; i++) await Promise.resolve(); };
  return f;
}

test('music.js: 세 곡(office·field·boss) 모두 파일·되풀이 시작·길이가 있다', () => {
  for (const k of ['office', 'field', 'boss']) {
    assert.ok(M[k], k + ' 없음');
    assert.match(M[k].file, /^music\/[a-z]+\.[0-9a-f]{8}\.mp3$/);
    assert.ok(M[k].loopStart >= 0 && M[k].loopStart < M[k].duration - 10, k + ' 되풀이 시작 이상');
    assert.ok(M[k].credit && M[k].credit.title, k + ' 출처 제목 없음');
  }
});

test('want → 받아서 풀고 되풀이로 튼다(되풀이 시작은 music.js 값)', async () => {
  const ctx = fakeCtx(), f = fakeFetch();
  const p = B.createPlayer({ context: () => ctx, music: M, fetch: f });
  p.want('field');
  assert.deepStrictEqual(f.calls, [M.field.file]);
  assert.strictEqual(p.state().playing, null, '받기 전엔 아직 안 나옴');
  await f.flush();
  const s = ctx.sources[0];
  assert.strictEqual(p.state().playing, 'field');
  assert.ok(s.started && s.loop, '되풀이로 시작');
  assert.strictEqual(s.loopStart, M.field.loopStart);
  assert.strictEqual(s.loopEnd, 200);
});

test('곡 넘기기: 새 곡을 틀고 앞 곡은 서서히 줄여 멈춘다. 같은 곡을 또 원하면 다시 틀지 않는다', async () => {
  const ctx = fakeCtx(), f = fakeFetch();
  const p = B.createPlayer({ context: () => ctx, music: M, fetch: f });
  p.want('office'); await f.flush();
  p.want('office');
  assert.strictEqual(ctx.sources.length, 1, '같은 곡은 한 번만');
  p.want('boss'); await f.flush();
  assert.strictEqual(p.state().playing, 'boss');
  assert.ok(ctx.sources[0].stopped, '앞 곡 멈춤 예약');
  p.want('office');   // 이미 받아 둔 곡은 다시 받지 않는다
  assert.strictEqual(f.calls.filter((u) => u === M.office.file).length, 1);
  assert.strictEqual(p.state().playing, 'office');
});

test('받는 동안 다른 곡으로 바뀌면, 늦게 도착한 앞 곡은 틀지 않는다', async () => {
  const ctx = fakeCtx(), f = fakeFetch();
  const p = B.createPlayer({ context: () => ctx, music: M, fetch: f });
  p.want('field');
  p.want('office');
  await f.flush();
  assert.strictEqual(p.state().playing, 'office');
  assert.strictEqual(ctx.sources.length, 1);
});

test('소리 장치가 없으면(사람이 아직 안 누름) 조용히 있다가 wake 때 튼다', async () => {
  let ctx = null; const f = fakeFetch();
  const p = B.createPlayer({ context: () => ctx, music: M, fetch: f });
  p.want('office');
  assert.strictEqual(f.calls.length, 0);
  ctx = fakeCtx();
  p.wake(); await f.flush();
  assert.strictEqual(p.state().playing, 'office');
  p.wake();
  assert.strictEqual(ctx.sources.length, 1, '나오는 중이면 wake 는 아무것도 안 한다');
});

test('소리 끔: 멈추고, 켜면 적어 둔 곡을 다시 튼다', async () => {
  const ctx = fakeCtx(), f = fakeFetch();
  const p = B.createPlayer({ context: () => ctx, music: M, fetch: f });
  p.want('field'); await f.flush();
  p.setMuted(true);
  assert.strictEqual(p.state().playing, null);
  assert.ok(ctx.sources[0].stopped);
  p.want('boss');                 // 끈 동안 화면이 바뀌어도 곡 이름만 적어 둔다
  assert.strictEqual(f.calls.length, 1);
  p.setMuted(false); await f.flush();
  assert.strictEqual(p.state().playing, 'boss');
});

test('받기 실패·풀기 실패·없는 곡: 게임을 멈추지 않고 조용히 넘어가며, 다음 want 때 다시 받아 본다', async () => {
  const ctx = fakeCtx(), f = fakeFetch({ [M.boss.file]: true });
  const p = B.createPlayer({ context: () => ctx, music: M, fetch: f });
  p.want('boss'); await f.flush();
  assert.strictEqual(p.state().playing, null);
  assert.deepStrictEqual(p.state().loading, []);
  p.want('office'); p.want('boss');
  assert.strictEqual(f.calls.filter((u) => u === M.boss.file).length, 2, '실패한 곡은 다시 받아 본다');
  ctx.decodeFail = true;
  p.want('field'); await f.flush();
  assert.strictEqual(p.state().playing, null);
  assert.doesNotThrow(() => p.want('없는곡'));
  assert.strictEqual(p.state().wanted, null);
  // fetch 자체가 없는 환경(아주 오래된 브라우저)
  const q = B.createPlayer({ context: () => ctx, music: M, fetch: null });
  assert.doesNotThrow(() => q.want('office'));
});

test('소리 장치를 만들다 예외가 나도 던지지 않는다', () => {
  const p = B.createPlayer({ context: () => { throw new Error('막힘'); }, music: M, fetch: fakeFetch() });
  assert.doesNotThrow(() => { p.want('office'); p.wake(); p.setMuted(false); });
});

test('출처 목록: 제목 있는 곡만, 같은 곡은 한 번만', () => {
  const c = B.credits({ a: { credit: { title: 'X' } }, b: { credit: { title: 'X' } }, c: { credit: { title: '' } }, d: {} });
  assert.deepStrictEqual(c.map((x) => x.title), ['X']);
  assert.ok(B.credits(M).length >= 2);
});

test('wake 는 곡이 이미 나오고 있어도 소리 장치를 깨운다(context 함수를 부른다)', async () => {
  const ctx = fakeCtx(), f = fakeFetch(); let asked = 0;
  const p = B.createPlayer({ context: () => { asked++; return ctx; }, music: M, fetch: f });
  p.want('office'); await f.flush();
  const before = asked; p.wake();
  assert.ok(asked > before);
});

test('낮추기(duck): 켜면 버스 크기가 DUCK 배로, 끄면 원래대로. 같은 값이 계속 와도 한 번만 움직인다', async () => {
  const ctx = fakeCtx(), f = fakeFetch();
  const p = B.createPlayer({ context: () => ctx, music: M, fetch: f, gain: 0.5 });
  p.want('field'); await f.flush();
  const bus = ctx.sources[0].to.to;   // 소스 → 곡 크기 → 버스
  p.duck(true); p.duck(true); p.duck(true);
  assert.strictEqual(bus.gain.set.length, 1, '바뀔 때만 움직인다');
  assert.ok(Math.abs(bus.gain.value - 0.5 * B.DUCK) < 1e-9);
  assert.strictEqual(p.state().ducked, true);
  p.duck(false);
  assert.ok(Math.abs(bus.gain.value - 0.5) < 1e-9);
  assert.strictEqual(p.state().ducked, false);
});

test('소리 장치가 없을 때 낮추기를 불러도 던지지 않고, 나중에 만든 버스는 낮춘 크기로 시작한다', async () => {
  let ctx = null; const f = fakeFetch();
  const p = B.createPlayer({ context: () => ctx, music: M, fetch: f, gain: 0.5 });
  assert.doesNotThrow(() => p.duck(true));
  ctx = fakeCtx(); p.want('field'); await f.flush();
  const bus = ctx.sources[0].to.to;
  assert.ok(Math.abs(bus.gain.value - 0.5 * B.DUCK) < 1e-9);
});
