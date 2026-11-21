/*
 * 설정(0.1.18) — 음악 크기 · 효과음 크기(0~100) · 진동 켬/끔, 그리고 저장 백업 코드.
 *
 *   설정은 게임 진행(저장)과 따로 둔다(진행 초기화를 해도 설정은 남게).
 *     키 'guar.suspects3.settings' = {"music":70,"sfx":80,"vibrate":true}
 *   예전 판의 소리 끔(guar.suspects.mute = '1')은 처음 한 번 음악 0 · 효과음 0 으로 옮긴다.
 *
 *   0.1.20: 5 단위 · 기본 50. 크기는 값에 비례(gain = 값/100)하고, 전체를 키우는 배수는 ui.js 에 있다.
 *     (0.1.18~19 는 제곱 곡선 · 기본 70/80 이었다. 50 에서 예전 기본보다 2배 크게 들리도록 ui.js 배수를 맞췄다)
 *     예전 설정 중 기본값(70/80)을 그대로 둔 사람은 새 기본 50/50 으로 옮기고, 직접 바꾼 값은 5 단위로만 맞춘다.
 *
 *   백업 코드: 'T3-' + base64(UTF-8 JSON). 한글 이름이 들어 있어도 깨지지 않는다.
 *     읽을 때는 머리말·base64·JSON·저장 버전(v)을 차례로 확인하고, 하나라도 틀리면 이유를 담아 실패를 돌려준다.
 *     (진행 자체의 값 검사·범위 맞추기는 SuspectsIdle.load 가 한다)
 *
 * DOM 을 모른다. 저장소(get/set)를 밖에서 받아 node 시험에서 가짜로 바꿀 수 있다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Team3Settings = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KEY = 'guar.suspects3.settings';
  var LEGACY_MUTE_KEY = 'guar.suspects.mute';
  var DEFAULTS = { music: 50, sfx: 50, vibrate: true };
  var STEP = 5;
  var SCALE = 2;   // 저장 형식 번호(크기 눈금). 없으면 0.1.18~19 의 눈금
  var CODE_PREFIX = 'T3-';

  // 0~100 의 5 단위로. 숫자가 아니면 기본값
  function level(v, def) {
    var n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
    if (!isFinite(n)) return def;
    return Math.max(0, Math.min(100, Math.round(n / STEP) * STEP));
  }

  /** 아무 값이나 받아 올바른 설정 객체로 만든다(모르는 키는 버린다). */
  function normalize(o) {
    o = o && typeof o === 'object' ? o : {};
    return {
      music: level(o.music, DEFAULTS.music),
      sfx: level(o.sfx, DEFAULTS.sfx),
      vibrate: typeof o.vibrate === 'boolean' ? o.vibrate : DEFAULTS.vibrate
    };
  }

  /**
   * 저장소에서 읽는다. store = { get(k) → 문자열|null, set(k, v) }.
   * 저장된 설정이 없고 예전 소리 끔이 켜져 있으면 음악·효과음을 0 으로 옮겨 적는다.
   */
  function load(store) {
    var raw = null;
    try { raw = store.get(KEY); } catch (e) { raw = null; }
    if (raw) {
      var o;
      try { o = JSON.parse(raw); } catch (e) { return normalize(null); }
      if (o && typeof o === 'object' && o.scale !== SCALE) {
        // 예전 눈금: 손대지 않은 기본값(70/80)이면 새 기본으로, 아니면 값만 5 단위로
        if (o.music === 70) o.music = DEFAULTS.music;
        if (o.sfx === 80) o.sfx = DEFAULTS.sfx;
        var s0 = normalize(o);
        save(store, s0);
        return s0;
      }
      return normalize(o);
    }
    var s = normalize(null), legacy = null;
    try { legacy = store.get(LEGACY_MUTE_KEY); } catch (e) { legacy = null; }
    if (legacy === '1') { s.music = 0; s.sfx = 0; save(store, s); }
    return s;
  }
  function save(store, s) {
    var o = normalize(s); o.scale = SCALE;
    try { store.set(KEY, JSON.stringify(o)); return true; } catch (e) { return false; }
  }

  /** 0~100 → 비율(0~1). 실제 크기는 ui.js 가 이 비율에 배수를 곱한다. */
  function gain(v) { return level(v, 0) / 100; }

  /* ---------- 백업 코드 ---------- */
  // UTF-8 ↔ base64 (브라우저와 node 18+ 모두 btoa/atob 가 있다)
  function toB64(str) {
    var bytes = unescape(encodeURIComponent(str));
    return btoa(bytes);
  }
  function fromB64(b64) {
    return decodeURIComponent(escape(atob(b64)));
  }

  /** 저장 문자열(JSON) → 백업 코드 */
  function exportCode(serialized) {
    if (typeof serialized !== 'string' || !serialized) throw new Error('저장 내용이 비어 있다');
    return CODE_PREFIX + toB64(serialized);
  }

  /**
   * 백업 코드 → { ok: true, json } 또는 { ok: false, reason }.
   *   공백·줄바꿈(메신저로 옮기다 생긴)은 지우고 읽는다. version 은 지금 저장 형식 번호.
   */
  function importCode(code, version) {
    if (typeof code !== 'string') return { ok: false, reason: 'empty' };
    var c = code.replace(/\s+/g, '');
    if (!c) return { ok: false, reason: 'empty' };
    if (c.indexOf(CODE_PREFIX) !== 0) return { ok: false, reason: 'prefix' };
    var json;
    try { json = fromB64(c.slice(CODE_PREFIX.length)); } catch (e) { return { ok: false, reason: 'broken' }; }
    var data;
    try { data = JSON.parse(json); } catch (e) { return { ok: false, reason: 'broken' }; }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, reason: 'broken' };
    if (data.v !== version) return { ok: false, reason: 'version' };
    return { ok: true, json: json };
  }

  // 실패 이유 → 사람이 읽을 말
  var REASONS = {
    empty: '코드를 붙여 넣어 주세요.',
    prefix: 'T3- 로 시작하는 수사 3팀 백업 코드가 아니에요.',
    broken: '코드가 잘렸거나 바뀌었어요. 처음부터 끝까지 다시 복사해 주세요.',
    version: '다른 버전의 백업 코드라 불러올 수 없어요.'
  };

  return {
    KEY: KEY, LEGACY_MUTE_KEY: LEGACY_MUTE_KEY, DEFAULTS: DEFAULTS, STEP: STEP, SCALE: SCALE, CODE_PREFIX: CODE_PREFIX,
    normalize: normalize, load: load, save: save, gain: gain,
    exportCode: exportCode, importCode: importCode, REASONS: REASONS
  };
});
