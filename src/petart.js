/*
 * Team3PetArt(0.3.0) — 말랑 동물 그림(SVG 문자열). 그림만 그린다(규칙·저장은 Team3Pets).
 *   draw(id, { grade:'c'|'r'|'h'|'l', mood:'happy'|'huh', anim:bool, outfit }) → '<svg …>'
 *   틀: 머리와 몸을 한 윤곽(MOCHI, 찹쌀떡)으로 그리고 같은 계열 진한 색 테두리. 눈·코·입은 얼굴 아래쪽에 작게.
 *   등급 꾸밈: 일반 = 동 배지 / 희귀 = 경찰모 · 은 배지 / 영웅 = 경찰모 · 빨간 망토 · 금 배지 / 전설 = 금빛 후광 · 금 경찰모 · 반짝임.
 *   proto/mascot.html 시안에서 옮겨 왔다(시안과 같은 그림).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Team3PetArt = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var SKY = '#9CD3F2', SKY_D = '#4F86A8', INK = '#1B1E24';

  /* ---------- 의상: 머리 위 기준점(cx, top)과 머리 너비(w)에 맞춰 그린다 ---------- */
  function beanie(cx, top, w, c) {
    var h = w * 0.5, s = '<g>';
    s += '<path d="M' + (cx - w / 2) + ' ' + (top + h) + 'c0-' + (h * 1.1) + ' ' + (w * 0.2) + '-' + (h * 1.35) + ' ' + (w / 2) + '-' + (h * 1.35) + 's' + (w / 2) + ' ' + (h * 0.25) + ' ' + (w / 2) + ' ' + (h * 1.35) + 'z" fill="' + c + '"/>';
    s += '<rect x="' + (cx - w / 2 - 3) + '" y="' + (top + h - 8) + '" width="' + (w + 6) + '" height="13" rx="5" fill="' + c + '" stroke="#F4EFE2" stroke-width="2"/>';
    for (var x = cx - w / 2 + 4; x < cx + w / 2; x += 8) s += '<line x1="' + x + '" y1="' + (top + h - 6) + '" x2="' + x + '" y2="' + (top + h + 3) + '" stroke="#F4EFE2" stroke-width="1.3"/>';
    s += '<circle cx="' + cx + '" cy="' + (top - h * 0.38) + '" r="9" fill="#F0525A"/><circle cx="' + (cx - 3) + '" cy="' + (top - h * 0.38 - 3) + '" r="3" fill="#fff" opacity=".5"/></g>';
    return s;
  }
  function fedora(cx, top, w, c) {
    return '<g><path d="M' + (cx - w * 0.36) + ' ' + (top + 2) + 'l6-' + (w * 0.36) + 'q' + (w * 0.15) + '-8 ' + (w * 0.3) + ' 0q' + (w * 0.15) + '-8 ' + (w * 0.3) + ' 0l6 ' + (w * 0.36) + 'z" fill="' + c + '"/>' +
      '<path d="M' + (cx - w * 0.36) + ' ' + (top - 6) + 'h' + (w * 0.72) + '" stroke="#F4EFE2" stroke-width="4"/>' +
      '<path d="M' + (cx - w * 0.75) + ' ' + (top + 4) + 'h' + (w * 1.5) + '" stroke="' + c + '" stroke-width="9" stroke-linecap="round"/></g>';
  }
  function glasses(cx, ey, gap, r) {
    return '<g><circle cx="' + (cx - gap) + '" cy="' + ey + '" r="' + r + '" fill="' + SKY + '" stroke="' + INK + '" stroke-width="3"/>' +
      '<circle cx="' + (cx + gap) + '" cy="' + ey + '" r="' + r + '" fill="' + SKY + '" stroke="' + INK + '" stroke-width="3"/>' +
      '<line x1="' + (cx - gap + r) + '" y1="' + ey + '" x2="' + (cx + gap - r) + '" y2="' + ey + '" stroke="' + INK + '" stroke-width="3"/>' +
      '<circle cx="' + (cx - gap) + '" cy="' + ey + '" r="3" fill="' + INK + '"/><circle cx="' + (cx + gap) + '" cy="' + ey + '" r="3" fill="' + INK + '"/></g>';
  }
  function mask(cx, y, w) {
    return '<g><path d="M' + (cx - w / 2) + ' ' + y + 'h' + w + 'v10c0 10-' + (w * 0.22) + ' 16-' + (w / 2) + ' 16s-' + (w / 2) + '-6-' + (w / 2) + '-16z" fill="' + SKY + '" stroke="' + INK + '" stroke-width="1.6"/>' +
      '<path d="M' + (cx - w * 0.38) + ' ' + (y + 7) + 'h' + (w * 0.76) + 'M' + (cx - w * 0.34) + ' ' + (y + 13) + 'h' + (w * 0.68) + '" stroke="' + SKY_D + '" stroke-width="2" stroke-linecap="round"/></g>';
  }

  /*
   * 0.3 시안: 머리와 몸을 한 덩어리로 잇는다.
   *  - 머리와 몸이 같은 그라디언트(userSpaceOnUse: 그림 전체에 빛 하나)를 써서 겹치는 곳에 이음매가 생기지 않는다.
   *  - 목줄처럼 가로로 끊는 띠는 없앴다. 대신 주둥이 → 가슴으로 이어지는 흰 털(턱받이)이 머리와 몸을 이어 준다.
   *  - 고양이(랙돌)는 목 갈기, 너구리는 밝은 배 털이 같은 역할을 한다.
   */
  function rg(id, a, b, c) {
    return '<radialGradient id="' + id + '" gradientUnits="userSpaceOnUse" cx="82" cy="52" r="165"><stop offset="0" stop-color="' + a + '"/><stop offset=".55" stop-color="' + b + '"/><stop offset="1" stop-color="' + c + '"/></radialGradient>';
  }
  var DEFS = '<defs>' +
    rg('gCorgi', '#F4B66C', '#E0913F', '#B96A26') + rg('gShiba', '#F0A766', '#D27A35', '#A65A22') +
    rg('gCream', '#FFFDF7', '#F6ECDA', '#DCCBAE') + rg('gRag', '#FFFCF5', '#F1E6D4', '#D5C3A6') + rg('gSiam', '#FBF1DF', '#EBD9BB', '#CDB48F') +
    rg('gPoint', '#8C6A52', '#5E4433', '#3E2C22') + rg('gRagPt', '#9C8778', '#76645A', '#54463F') + rg('gRac', '#B5BAC2', '#8E949E', '#6A707A') +
    rg('gRacBelly', '#F3EEE4', '#E1D9CA', '#C5BBA8') + rg('gDark', '#4A4C55', '#2C2E35', '#1C1D22') +
    '<radialGradient id="gBlue" cx="50%" cy="35%" r="65%"><stop offset="0" stop-color="#BFE8FF"/><stop offset=".6" stop-color="#5BB2E8"/><stop offset="1" stop-color="#2F7CC0"/></radialGradient>' +
    '<radialGradient id="gNose" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#4A4F5C"/><stop offset="1" stop-color="#14171D"/></radialGradient>' +
    '<radialGradient id="gShadow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="rgba(0,0,0,.32)"/><stop offset="1" stop-color="rgba(0,0,0,0)"/></radialGradient>' +
    '<linearGradient id="gGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE48A"/><stop offset="1" stop-color="#D9A51E"/></linearGradient>' +
    '<linearGradient id="gCoat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE066"/><stop offset="1" stop-color="#E0B21E"/></linearGradient>' +
    '<radialGradient id="gPtSoft"><stop offset="0" stop-color="#9C8170" stop-opacity=".75"/><stop offset=".7" stop-color="#B39A88" stop-opacity=".45"/><stop offset="1" stop-color="#B39A88" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="gPtSoftD"><stop offset="0" stop-color="#5E4233" stop-opacity=".95"/><stop offset=".65" stop-color="#7A5A46" stop-opacity=".7"/><stop offset="1" stop-color="#7A5A46" stop-opacity="0"/></radialGradient>' +
    '</defs>';
  // 큰 눈: 짙은 눈동자 + 큰 반짝임 + 작은 반짝임
  function eye(x, y, rx, ry) {
    return '<ellipse cx="' + x + '" cy="' + y + '" rx="' + rx + '" ry="' + ry + '" fill="#1B1E24"/>' +
      '<ellipse cx="' + (x - rx * 0.3) + '" cy="' + (y - ry * 0.35) + '" rx="' + (rx * 0.42) + '" ry="' + (ry * 0.36) + '" fill="#fff"/>' +
      '<circle cx="' + (x + rx * 0.35) + '" cy="' + (y + ry * 0.35) + '" r="' + (rx * 0.18) + '" fill="#fff" opacity=".85"/>';
  }
  // 파란 눈(랙돌 · 샴): 홍채 + 세로 동공 + 반짝임
  function blueEye(x, y, rx, ry) {
    return '<ellipse cx="' + x + '" cy="' + y + '" rx="' + rx + '" ry="' + ry + '" fill="url(#gBlue)"/>' +
      '<ellipse cx="' + x + '" cy="' + (y + 1) + '" rx="' + (rx * 0.45) + '" ry="' + (ry * 0.78) + '" fill="#1B1E24"/>' +
      '<ellipse cx="' + (x - rx * 0.32) + '" cy="' + (y - ry * 0.4) + '" rx="' + (rx * 0.36) + '" ry="' + (ry * 0.28) + '" fill="#fff"/>' +
      '<circle cx="' + (x + rx * 0.35) + '" cy="' + (y + ry * 0.38) + '" r="' + (rx * 0.16) + '" fill="#fff" opacity=".85"/>';
  }
  function happyEye(x, y, w, c) { return '<path d="M' + (x - w) + ' ' + y + ' q' + w + '-' + (w * 1.1) + ' ' + (w * 2) + ' 0" stroke="' + (c || '#1B1E24') + '" stroke-width="4" fill="none" stroke-linecap="round"/>'; }
  function blush(x, y) { return '<ellipse cx="' + x + '" cy="' + y + '" rx="9" ry="5.5" fill="#FF8A8A" opacity=".45"/>'; }
  function shadow() { return '<ellipse cx="100" cy="194" rx="58" ry="7" fill="url(#gShadow)"/>'; }
  function wrap(o, inner) {
    return '<svg viewBox="0 0 200 200" aria-hidden="true">' + DEFS + shadow() + '<g class="' + (o.mood === 'happy' ? 'pb-hop' : o.mood === 'huh' ? 'pb-tilt' : '') + '">' + inner + '</g></svg>';
  }
  function huhMark() { return '<g><circle cx="162" cy="40" r="15" fill="#FFD23F"/><text x="162" y="47" font-size="20" font-weight="700" text-anchor="middle" fill="#1B1E24" font-family="IBM Plex Sans KR">?</text></g>'; }
  function sparkle(x, y) { return '<path d="M' + x + ' ' + (y - 9) + ' l2.6 6.4 6.4 2.6-6.4 2.6-2.6 6.4-2.6-6.4-6.4-2.6 6.4-2.6z" fill="#FFE27A"/>'; }
  // 가슴의 3팀 배지(별 모양 경찰 배지). 띠 없이 털에 달려 있어 머리와 몸을 끊지 않는다.
  function badge(x, y) {
    return '<path d="M' + x + ' ' + (y - 11) + ' l3.3 6.6 7.3 1-5.3 5.2 1.3 7.2-6.6-3.5-6.6 3.5 1.3-7.2-5.3-5.2 7.3-1z" fill="url(#gGold)"/>' +
      '<text x="' + x + '" y="' + (y + 4) + '" font-size="8" font-weight="700" text-anchor="middle" fill="#6B4E00" font-family="IBM Plex Sans KR">3</text>';
  }
  function mouth(o, y) {
    if (o.outfit === 'mask') return '';
    if (o.mood === 'happy') return '<path d="M88 ' + y + ' q12 12 24 0" fill="#7A2C34"/><path d="M95 ' + (y + 4) + ' q5 10 10 0z" fill="#FF8C95"/>';
    if (o.mood === 'huh') return '<path d="M94 ' + (y + 3) + ' q6-3 12 0" stroke="#1B1E24" stroke-width="3" fill="none" stroke-linecap="round"/>';
    return '<path d="M100 ' + (y - 6) + ' v4 M100 ' + (y - 2) + ' q-6 6-11 2 M100 ' + (y - 2) + ' q6 6 11 2" stroke="#1B1E24" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
  }
  function extras(o, hat, eyeY, maskY, maskW, glassesOk) {
    var s = '';
    if (o.mood === 'huh') s += huhMark();
    if (o.mood === 'happy') s += sparkle(36, 52) + sparkle(166, 42);
    if (o.outfit === 'raincoat') s += '<path d="M46 72 q54-58 108 0 l4 12 q-58-28-116 0z" fill="url(#gCoat)"/>';
    if (o.outfit === 'beanie') s += beanie(100, hat, 100, '#2F3646');
    if (o.outfit === 'fedora') s += fedora(100, hat + 4, 88, '#3A2A1E');
    if (glassesOk && (o.outfit === 'glasses' || o.outfit === 'fedora')) s += glasses(100, eyeY, 22, 14);
    if (o.outfit === 'mask') s += mask(100, maskY, maskW);
    return s;
  }
  // 공통 몸통: 어깨가 머리 뒤에서 시작해 아래로 넓어진다(머리와 같은 색이라 이음매가 안 보인다).
  var BODY = 'M56 192 q-8-58 44-76 q52 18 44 76z';
  var HEAD = 'M100 30 c38 0 60 22 60 56 c0 32-26 54-60 54 c-34 0-60-22-60-54 c0-34 22-56 60-56z';

  /*
   * 4차 "말랑" 스타일: 캐릭터 상품(스티커 · 인형) 말투.
   *  - 머리와 몸을 처음부터 "한 개의 윤곽선"으로 그린다(찹쌀떡 모양). 이음매가 생길 수 없다.
   *  - 머리가 전체의 2/3, 몸은 아래에 살짝만. 눈 · 코 · 입은 얼굴 아래쪽에 작게 모은다(아기 얼굴 비율).
   *  - 몸 색보다 짙은 같은 계열 색의 테두리 선(3.5px)으로 스티커처럼 또렷하게.
   */
  var MOCHI = 'M100 26 C152 26 174 58 174 98 C174 124 162 140 148 148 C152 162 152 178 146 190 H54 C48 178 48 162 52 148 C38 140 26 124 26 98 C26 58 48 26 100 26 Z';
  function k(fill, line) { return ' fill="' + fill + '" stroke="' + line + '" stroke-width="3.5" stroke-linejoin="round"'; }
  function kEyes(o, y, blue) {
    if (o.mood === 'happy') return happyEye(72, y + 2, 9, '#2A1E1A') + happyEye(128, y + 2, 9, '#2A1E1A');
    var e = function (x) {
      return blue
        ? '<ellipse cx="' + x + '" cy="' + y + '" rx="10" ry="12" fill="url(#gBlue)" stroke="#2A1E1A" stroke-width="2"/><ellipse cx="' + x + '" cy="' + (y + 1) + '" rx="5" ry="8" fill="#1B1E24"/>' +
          '<ellipse cx="' + (x - 3.5) + '" cy="' + (y - 5) + '" rx="4" ry="3.6" fill="#fff"/><circle cx="' + (x + 4) + '" cy="' + (y + 5) + '" r="1.8" fill="#fff"/>'
        : '<ellipse cx="' + x + '" cy="' + y + '" rx="9" ry="11" fill="#2A1E1A"/><ellipse cx="' + (x - 3) + '" cy="' + (y - 4.5) + '" rx="4" ry="3.8" fill="#fff"/><circle cx="' + (x + 3.5) + '" cy="' + (y + 4.5) + '" r="1.8" fill="#fff"/>';
    };
    return '<g class="' + (o.anim ? 'pb-blink' : '') + '">' + e(72) + e(128) + '</g>';
  }
  function kFace(o, y, nose) {
    var s = '<ellipse cx="56" cy="' + (y + 16) + '" rx="12" ry="7" fill="#FF8FA3" opacity=".5"/><ellipse cx="144" cy="' + (y + 16) + '" rx="12" ry="7" fill="#FF8FA3" opacity=".5"/>';
    if (nose) s += '<ellipse cx="100" cy="' + (y + 10) + '" rx="5.5" ry="3.8" fill="' + nose + '"/>';
    if (o.outfit === 'mask') return s;
    if (o.mood === 'happy') s += '<path d="M92 ' + (y + 16) + ' q8 11 16 0z" fill="#B23A4C" stroke="#2A1E1A" stroke-width="2" stroke-linejoin="round"/>';
    else if (o.mood === 'huh') s += '<path d="M95 ' + (y + 19) + ' q5-3 10 0" stroke="#2A1E1A" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
    else s += '<path d="M92 ' + (y + 15) + ' q4 5 8 0 q4 5 8 0" stroke="#2A1E1A" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
    return s;
  }
  function kShine() { return '<ellipse cx="74" cy="46" rx="20" ry="8" fill="#fff" opacity=".35" transform="rotate(-18 74 46)"/>'; }
  // 작은 두 손으로 가슴의 3팀 배지를 들고 있다 + 발
  function kPaws(fill, line, foot) {
    return badge(100, 164) +
      '<ellipse cx="80" cy="166" rx="10" ry="8"' + k(fill, line) + '/><ellipse cx="120" cy="166" rx="10" ry="8"' + k(fill, line) + '/>' +
      '<ellipse cx="74" cy="190" rx="13" ry="7"' + k(foot || fill, line) + '/><ellipse cx="126" cy="190" rx="13" ry="7"' + k(foot || fill, line) + '/>';
  }
  function kWrap(o, inner, eyeY) {
    var s = inner;
    if (o.mood === 'huh') s += huhMark();
    if (o.mood === 'happy') s += sparkle(30, 48) + sparkle(170, 40);
    if (o.outfit === 'raincoat') s += '<path d="M34 84 q66-82 132 0 l6 12 q-72-34-144 0z"' + k('url(#gCoat)', '#B8901C') + '/>';
    if (o.outfit === 'beanie') s += beanie(100, 28, 112, '#2F3646');
    if (o.outfit === 'fedora') s += fedora(100, 34, 94, '#3A2A1E');
    if (o.outfit === 'glasses' || o.outfit === 'fedora') s += glasses(100, eyeY, 28, 15);
    if (o.outfit === 'mask') s += mask(100, eyeY + 8, 66);
    return wrap(o, s);
  }

  function kDog(o, breed) {
    o = o || {};
    var sh = breed === 'shiba', F = sh ? '#F0A25E' : '#F7B46E', L = sh ? '#A85F27' : '#B9722F', C = '#FFF7EA', s = '';
    if (sh) s += '<path class="' + (o.anim ? 'pb-wag' : '') + '" d="M146 172 q30 0 28-26 q-2-16-16-14 q-10 2-6 12 q6 2 4 8 q-4 8-14 8z"' + k(F, L) + '/>';
    else s += '<ellipse class="' + (o.anim ? 'pb-wag' : '') + '" cx="150" cy="176" rx="13" ry="10"' + k(C, L) + '/>';
    // 귀: 코기는 크고 둥근 삼각, 시바는 작은 세모
    var ear = sh ? 'M44 62 Q40 24 56 22 Q70 26 82 42 Z' : 'M40 70 Q26 12 52 12 Q72 18 86 44 Z';
    var inn = sh ? 'M52 54 Q50 32 58 30 Q66 34 72 42 Z' : 'M50 58 Q42 24 56 24 Q66 28 76 44 Z';
    s += '<path d="' + ear + '"' + k(F, L) + '/><path d="' + ear + '" transform="translate(200 0) scale(-1 1)"' + k(F, L) + '/>';
    s += '<path d="' + inn + '" fill="#FFC2C2"/><path d="' + inn + '" transform="translate(200 0) scale(-1 1)" fill="#FFC2C2"/>';
    s += '<path d="' + MOCHI + '"' + k(F, L) + '/>' + kShine();
    // 흰 털: 아랫얼굴 + 배(코기는 이마 줄까지)
    if (!sh) s += '<path d="M100 40 q7 0 8 26 q2 22 4 30 q-12 6-24 0 q2-8 4-30 q1-26 8-26z" fill="' + C + '"/>';
    s += '<path d="M100 96 c30 0 54 12 54 30 c0 14-14 22-26 24 q8 20 6 40 h-68 q-2-20 6-40 c-12-2-26-10-26-24 c0-18 24-30 54-30z" fill="' + C + '"/>';
    if (sh) s += '<ellipse cx="74" cy="84" rx="6" ry="4" fill="' + C + '"/><ellipse cx="126" cy="84" rx="6" ry="4" fill="' + C + '"/>';
    s += kEyes(o, 104) + kFace(o, 106, '#2A1E1A') + kPaws(C, L);
    return kWrap(o, s, 104);
  }

  function kCat(o, breed) {
    o = o || {};
    var rag = breed === 'ragdoll', F = rag ? '#FFFBF4' : '#FBF0DC', L = rag ? '#B8A28A' : '#A3835F', P = rag ? '#A98F7D' : '#6E5040', s = '';
    s += '<path class="' + (o.anim ? 'pb-sway' : '') + '" d="' + (rag ? 'M140 182 q40 2 38-38 q-1-14 10-12 q14 46-44 60z' : 'M142 184 q34-2 32-38 q0-10 7-9 q8 40-36 54z') + '"' + k(P, L) + '/>';
    var ear = rag ? 'M38 72 L36 26 Q40 20 48 24 L84 44 Z' : 'M36 78 L30 16 Q34 10 42 14 L86 46 Z';
    var inn = rag ? 'M46 60 L45 32 L72 46 Z' : 'M44 64 L40 26 L74 48 Z';
    s += '<path d="' + ear + '"' + k(P, L) + '/><path d="' + ear + '" transform="translate(200 0) scale(-1 1)"' + k(P, L) + '/>';
    s += '<path d="' + inn + '" fill="#F2B8BE"/><path d="' + inn + '" transform="translate(200 0) scale(-1 1)" fill="#F2B8BE"/>';
    s += '<path d="' + MOCHI + '"' + k(F, L) + '/>' + kShine();
    // 얼굴 포인트를 가장자리가 흐린 그라디언트로(부드럽게)
    s += rag
      ? '<ellipse cx="72" cy="102" rx="22" ry="18" fill="url(#gPtSoft)"/><ellipse cx="128" cy="102" rx="22" ry="18" fill="url(#gPtSoft)"/><path d="M100 60 q8 20 6 46 q-6 4-12 0 q-2-26 6-46z" fill="' + F + '"/>'
      : '<ellipse cx="100" cy="110" rx="46" ry="34" fill="url(#gPtSoftD)"/>';
    // 랙돌 목 갈기: 둥근 털 뭉치 선
    if (rag) s += '<path d="M60 146 q8 8 16 2 q8 8 16 2 q8 8 16 2 q8 8 16 2 q8 8 16-2" stroke="' + L + '" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".7"/>';
    s += kEyes(o, 104, true) + kFace(o, 104, rag ? '#F29AAA' : '#3A2A22');
    s += '<path d="M44 114 h-16M44 121 l-14 4M156 114 h16M156 121 l14 4" stroke="' + L + '" stroke-width="2" stroke-linecap="round"/>';
    s += kPaws(rag ? F : F, L, rag ? F : P);
    return kWrap(o, s, 104);
  }

  function kRaccoon(o) {
    o = o || {};
    var F = '#C3C8D1', L = '#6B717D', D = '#3A3D46', W = '#FBF8F2', s = '';
    s += '<g class="' + (o.anim ? 'pb-sway' : '') + '"><path d="M140 184 q42 0 40-40 q0-12 10-10 q14 46-46 58z"' + k(F, L) + '/>' +
      '<path d="M172 164 l12-8M176 148 l12-4" stroke="' + D + '" stroke-width="7" stroke-linecap="round"/></g>';
    s += '<circle cx="50" cy="40" r="18"' + k(F, L) + '/><circle cx="150" cy="40" r="18"' + k(F, L) + '/><circle cx="50" cy="42" r="9" fill="' + D + '"/><circle cx="150" cy="42" r="9" fill="' + D + '"/>';
    s += '<path d="' + MOCHI + '"' + k(F, L) + '/>' + kShine();
    s += '<path d="M100 72 c38 0 62 16 62 38 c0 20-24 34-62 34 c-38 0-62-14-62-34 c0-22 24-38 62-38z" fill="' + W + '"/>';
    s += '<path d="M100 150 q26 0 28 40 h-56 q2-40 28-40z" fill="' + W + '"/>';
    // 둥근 눈가리개
    s += '<path d="M40 104 q0-20 30-20 q18 0 30 12 q12-12 30-12 q30 0 30 20 q0 14-28 14 q-20 0-32-10 q-12 10-32 10 q-28 0-28-14z" fill="' + D + '"/>';
    s += '<path d="M100 44 q6 16 0 30 q-6-14 0-30z" fill="' + L + '" opacity=".6"/>';
    if (o.mood === 'happy') s += happyEye(72, 104, 9, '#fff') + happyEye(128, 104, 9, '#fff');
    else s += '<g class="' + (o.anim ? 'pb-blink' : '') + '"><ellipse cx="72" cy="102" rx="9" ry="10.5" fill="#fff"/><ellipse cx="128" cy="102" rx="9" ry="10.5" fill="#fff"/><ellipse cx="73" cy="104" rx="6.5" ry="8" fill="#2A1E1A"/><ellipse cx="127" cy="104" rx="6.5" ry="8" fill="#2A1E1A"/><circle cx="71" cy="100" r="2.6" fill="#fff"/><circle cx="125" cy="100" r="2.6" fill="#fff"/></g>';
    s += kFace(o, 112, '#2A1E1A');
    s += kPaws(F, L, D).replace(/<ellipse cx="(80|120)" cy="166" rx="10" ry="8" fill="#C3C8D1"/g, '<ellipse cx="$1" cy="166" rx="10" ry="8" fill="' + D + '"');
    return kWrap(o, s, 102);
  }

  /* ---------- 뽑기용 추가 동물(같은 말랑 틀: MOCHI 윤곽 + 귀 + 얼굴 무늬) ---------- */
  function mirror(d, attrs) { return '<path d="' + d + '"' + attrs + '/><path d="' + d + '" transform="translate(200 0) scale(-1 1)"' + attrs + '/>'; }
  function beak(y, c) { return '<path d="M92 ' + y + ' q8-4 16 0 q-2 8-8 11 q-6-3-8-11z" fill="' + c + '" stroke="#A8601E" stroke-width="2" stroke-linejoin="round"/>'; }
  function amberEyes(o, y) {
    if (o.mood === 'happy') return happyEye(72, y + 2, 9, '#2A1E1A') + happyEye(128, y + 2, 9, '#2A1E1A');
    var e = function (x) { return '<circle cx="' + x + '" cy="' + y + '" r="14" fill="#FFD66B" stroke="#A8762A" stroke-width="2"/><ellipse cx="' + x + '" cy="' + y + '" rx="8" ry="9" fill="#2A1E1A"/><ellipse cx="' + (x - 3) + '" cy="' + (y - 4) + '" rx="3.6" ry="3.4" fill="#fff"/><circle cx="' + (x + 3.5) + '" cy="' + (y + 4) + '" r="1.6" fill="#fff"/>'; };
    return '<g class="' + (o.anim ? 'pb-blink' : '') + '">' + e(72) + e(128) + '</g>';
  }
  function kOwl(o) {
    o = o || {}; var F = '#B5875F', L = '#6E4A2E', C = '#FFF1DC', s = '';
    s += mirror('M34 66 L30 22 Q34 16 42 22 L70 44 Z', k(F, L));
    s += '<path d="' + MOCHI + '"' + k(F, L) + '/>' + kShine();
    s += '<circle cx="72" cy="102" r="26" fill="' + C + '"/><circle cx="128" cy="102" r="26" fill="' + C + '"/>';
    s += '<path d="M100 140 c26 0 34 18 32 50 h-64 c-2-32 6-50 32-50z" fill="' + C + '"/>';
    for (var yy = 152; yy < 186; yy += 12) s += '<path d="M86 ' + yy + ' q4 5 8 0M106 ' + yy + ' q4 5 8 0" stroke="' + F + '" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
    s += amberEyes(o, 102) + kFace(o, 112, null) + beak(112, '#F2A33A');
    s += mirror('M30 120 q-10 30 18 52 q6-24-4-50z', k('#9B7049', L));
    s += '<ellipse cx="80" cy="191" rx="11" ry="6"' + k('#F2A33A', '#A8601E') + '/><ellipse cx="120" cy="191" rx="11" ry="6"' + k('#F2A33A', '#A8601E') + '/>';
    return kWrap(o, s, 102);
  }
  function kPanda(o) {
    o = o || {}; var F = '#FFFFFF', L = '#4A4C55', D = '#2E3038', s = '';
    s += '<circle cx="48" cy="40" r="19"' + k(D, D) + '/><circle cx="152" cy="40" r="19"' + k(D, D) + '/>';
    s += '<path d="' + MOCHI + '"' + k(F, L) + '/>' + kShine();
    s += '<ellipse cx="70" cy="102" rx="17" ry="21" fill="' + D + '" transform="rotate(28 70 102)"/><ellipse cx="130" cy="102" rx="17" ry="21" fill="' + D + '" transform="rotate(-28 130 102)"/>';
    if (o.mood === 'happy') s += happyEye(72, 104, 8, '#fff') + happyEye(128, 104, 8, '#fff');
    else s += '<g class="' + (o.anim ? 'pb-blink' : '') + '"><ellipse cx="73" cy="103" rx="7" ry="8.5" fill="#fff"/><ellipse cx="127" cy="103" rx="7" ry="8.5" fill="#fff"/><ellipse cx="74" cy="104" rx="5" ry="6.5" fill="#1B1E24"/><ellipse cx="126" cy="104" rx="5" ry="6.5" fill="#1B1E24"/><circle cx="72" cy="101" r="2" fill="#fff"/><circle cx="124" cy="101" r="2" fill="#fff"/></g>';
    s += kFace(o, 108, D);
    s += kPaws(D, D, D);
    return kWrap(o, s, 103);
  }
  function kMonkey(o) {
    o = o || {}; var F = '#B47B4F', L = '#6B4325', C = '#FFD9B8', s = '';
    s += '<path class="' + (o.anim ? 'pb-sway' : '') + '" d="M146 180 q36 4 34-30 q-2-18-18-14 q-10 4-4 12 q8-2 8 6 q-2 14-20 16z"' + k(F, L) + '/>';
    s += '<circle cx="28" cy="98" r="20"' + k(F, L) + '/><circle cx="172" cy="98" r="20"' + k(F, L) + '/><circle cx="30" cy="98" r="11" fill="' + C + '"/><circle cx="170" cy="98" r="11" fill="' + C + '"/>';
    s += '<path d="' + MOCHI + '"' + k(F, L) + '/>' + kShine();
    // 하트 모양 얼굴
    s += '<path d="M100 84 c6-14 22-20 34-12 c14 10 12 26 4 34 c14 4 18 18 10 28 c-10 14-30 16-48 16 c-18 0-38-2-48-16 c-8-10-4-24 10-28 c-8-8-10-24 4-34 c12-8 28-2 34 12z" fill="' + C + '"/>';
    s += '<path d="M100 150 q22 0 24 40 h-48 q2-40 24-40z" fill="' + C + '"/>';
    s += kEyes(o, 102) + kFace(o, 108, '#6B4325') + kPaws(F, L);
    return kWrap(o, s, 102);
  }
  function kHamster(o) {
    o = o || {}; var F = '#F6C58C', L = '#B9803F', C = '#FFF6E6', s = '';
    s += '<circle cx="58" cy="40" r="14"' + k(F, L) + '/><circle cx="142" cy="40" r="14"' + k(F, L) + '/><circle cx="58" cy="41" r="7" fill="#FFB8B8"/><circle cx="142" cy="41" r="7" fill="#FFB8B8"/>';
    s += '<path d="' + MOCHI + '"' + k(F, L) + '/>' + kShine();
    s += '<path d="M100 92 c40 0 68 14 68 34 c0 16-14 22-30 24 q10 18 8 40 h-92 q-2-22 8-40 c-16-2-30-8-30-24 c0-20 28-34 68-34z" fill="' + C + '"/>';
    s += '<ellipse cx="46" cy="122" rx="22" ry="18" fill="' + C + '"/><ellipse cx="154" cy="122" rx="22" ry="18" fill="' + C + '"/>';
    s += kEyes(o, 102) + kFace(o, 104, '#F08A9A') + kPaws(C, L, '#FFC4B0');
    return kWrap(o, s, 102);
  }
  function kRabbit(o) {
    o = o || {}; var F = '#FFFFFF', L = '#C49BA2', s = '';
    s += mirror('M56 56 Q38 -10 58 -14 Q76 -12 76 46 Z', k(F, L)) + mirror('M60 46 Q48 0 60 -4 Q70 -2 70 42 Z', ' fill="#FFC9D2"');
    s += '<path d="' + MOCHI + '"' + k(F, L) + '/>' + kShine();
    s += kEyes(o, 104) + kFace(o, 104, '#F08A9A') + kPaws(F, L);
    s += '<ellipse cx="150" cy="180" rx="12" ry="10"' + k(F, L) + '/>';
    return kWrap(o, s, 104);
  }
  function kFox(o) {
    o = o || {}; var F = '#F49447', L = '#A9521C', C = '#FFF8EE', D = '#4A2E22', s = '';
    s += '<g class="' + (o.anim ? 'pb-sway' : '') + '"><path d="M140 184 q46 2 44-42 q-2-20-14-18 q14 40-30 60z"' + k(F, L) + '/><path d="M170 124 q14 2 14 18 q-8-4-18-4z"' + k(C, L) + '/></g>';
    s += mirror('M36 74 L30 14 Q34 8 42 12 L86 44 Z', k(F, L)) + mirror('M36 30 L34 14 L48 22 Z', ' fill="' + D + '"') + mirror('M44 62 L40 26 L72 46 Z', ' fill="#FFD3C2"');
    s += '<path d="' + MOCHI + '"' + k(F, L) + '/>' + kShine();
    s += '<path d="M28 104 q30 4 58 22 q6 8 14 8 q8 0 14-8 q28-18 58-22 q-4 34-36 44 q-18 6-36 6 q-18 0-36-6 q-32-10-36-44z" fill="' + C + '"/>';
    s += '<path d="M100 150 q22 0 24 40 h-48 q2-40 24-40z" fill="' + C + '"/>';
    s += kEyes(o, 102) + kFace(o, 108, '#2A1E1A') + kPaws(F, L, D);
    return kWrap(o, s, 102);
  }
  function kPenguin(o) {
    o = o || {}; var F = '#3D4A63', L = '#222A3B', C = '#FFFFFF', s = '';
    s += '<path d="' + MOCHI + '"' + k(F, L) + '/>' + kShine();
    s += '<path d="M100 64 c10-14 34-14 46 0 c16 18 14 44 6 60 c-6 14-14 22-14 30 c4 16 4 26 0 36 h-76 c-4-10-4-20 0-36 c0-8-8-16-14-30 c-8-16-10-42 6-60 c12-14 36-14 46 0z" fill="' + C + '"/>';
    s += kEyes(o, 102) + kFace(o, 112, null) + beak(110, '#FFB23F');
    s += kPaws(F, L, '#FFB23F').replace(/stroke="#222A3B" stroke-width="3.5" stroke-linejoin="round"\/><ellipse cx="74" cy="190"/, 'stroke="#222A3B" stroke-width="3.5" stroke-linejoin="round"/><ellipse cx="74" cy="190"');
    return kWrap(o, s, 102);
  }
  function kBear(o) {
    o = o || {}; var F = '#A87650', L = '#62402A', C = '#F1D7B8', s = '';
    s += '<circle cx="48" cy="42" r="18"' + k(F, L) + '/><circle cx="152" cy="42" r="18"' + k(F, L) + '/><circle cx="48" cy="44" r="9" fill="' + C + '"/><circle cx="152" cy="44" r="9" fill="' + C + '"/>';
    s += '<path d="' + MOCHI + '"' + k(F, L) + '/>' + kShine();
    s += '<ellipse cx="100" cy="120" rx="26" ry="19" fill="' + C + '"/><path d="M100 150 q24 0 26 40 h-52 q2-40 26-40z" fill="' + C + '"/>';
    s += kEyes(o, 100) + kFace(o, 106, '#3A2418') + kPaws(F, L);
    return kWrap(o, s, 100);
  }

  /* ---------- 2차 추가: 고슴도치 · 다람쥐 · 수달 · 오리 · 개구리 · 코알라 · 호랑이 ---------- */
  function kHedgehog(o) {
    o = o || {}; var F = '#9C7556', L = '#5E4330', C = '#FFEBD2', s = '';
    // 가시: 머리 뒤로 톱니 테두리
    var sp = '';
    for (var a = -170; a <= -10; a += 16) {
      var r1 = 70, r2 = 92, c = Math.PI / 180;
      sp += (a === -170 ? 'M' : 'L') + (100 + r1 * Math.cos((a - 8) * c)).toFixed(1) + ' ' + (98 + r1 * Math.sin((a - 8) * c)).toFixed(1) +
        'L' + (100 + r2 * Math.cos(a * c)).toFixed(1) + ' ' + (98 + r2 * Math.sin(a * c)).toFixed(1) +
        'L' + (100 + r1 * Math.cos((a + 8) * c)).toFixed(1) + ' ' + (98 + r1 * Math.sin((a + 8) * c)).toFixed(1);
    }
    s += '<path d="' + sp + 'L100 120Z"' + k('#6E4E36', L) + '/>';
    s += '<path d="' + MOCHI + '"' + k(F, L) + '/>' + kShine();
    s += '<path d="M100 74 c40 0 64 20 64 44 c0 18-16 28-34 32 q10 18 6 40 h-72 q-4-22 6-40 c-18-4-34-14-34-32 c0-24 24-44 64-44z" fill="' + C + '"/>';
    s += '<circle cx="52" cy="70" r="9"' + k(C, L) + '/><circle cx="148" cy="70" r="9"' + k(C, L) + '/>';
    s += kEyes(o, 106) + kFace(o, 106, '#2A1E1A') + kPaws(C, L, F);
    return kWrap(o, s, 106);
  }
  function kSquirrel(o) {
    o = o || {}; var F = '#DC8E50', L = '#97541F', C = '#FFF3E2', s = '';
    s += '<path class="' + (o.anim ? 'pb-sway' : '') + '" d="M128 190 q50 4 56-50 q4-40-26-52 q-26-8-30 14 q20-2 24 18 q4 28-24 70z"' + k(F, L) + '/>';
    s += '<path d="M150 100 q14 4 16 18" stroke="' + C + '" stroke-width="6" fill="none" stroke-linecap="round" opacity=".7"/>';
    s += mirror('M44 60 L38 22 Q42 16 50 20 L74 42 Z', k(F, L)) + mirror('M40 24 L34 8 L46 16 Z', k(F, L)) + mirror('M48 52 L45 30 L64 44 Z', ' fill="#FFC9B8"');
    s += '<path d="' + MOCHI + '"' + k(F, L) + '/>' + kShine();
    s += '<path d="M100 38 q6 14 0 28 q-6-14 0-28z" fill="#8E4E1E" opacity=".55"/>';
    s += '<path d="M100 98 c34 0 58 10 58 28 c0 14-14 22-30 24 q8 20 6 40 h-68 q-2-20 6-40 c-16-2-30-10-30-24 c0-18 24-28 58-28z" fill="' + C + '"/>';
    s += kEyes(o, 102) + kFace(o, 106, '#3A2418');
    s += kPaws(F, L).replace(/(<path d="M)/, '$1');
    // 손에 도토리
    s += '<ellipse cx="100" cy="168" rx="9" ry="11" fill="#B06A2E" stroke="' + L + '" stroke-width="2"/><path d="M90 160 q10-8 20 0 q-10 4-20 0z" fill="#6E4325"/>';
    return kWrap(o, s, 102);
  }
  function kOtter(o) {
    o = o || {}; var F = '#9C6B48', L = '#5A3B24', C = '#F4DFC6', s = '';
    s += '<path class="' + (o.anim ? 'pb-sway' : '') + '" d="M140 186 q36 2 40-30 q0-10 8-8 q4 40-48 46z"' + k(F, L) + '/>';
    s += '<circle cx="40" cy="70" r="12"' + k(F, L) + '/><circle cx="160" cy="70" r="12"' + k(F, L) + '/>';
    s += '<path d="' + MOCHI + '"' + k(F, L) + '/>' + kShine();
    s += '<path d="M100 92 c34 0 54 10 54 26 c0 18-26 28-54 28 c-28 0-54-10-54-28 c0-16 20-26 54-26z" fill="' + C + '"/>';
    s += '<path d="M100 148 q24 0 26 42 h-52 q2-42 26-42z" fill="' + C + '"/>';
    s += kEyes(o, 98) + kFace(o, 106, '#2A1E1A');
    s += '<g fill="' + L + '" opacity=".6"><circle cx="82" cy="120" r="1.6"/><circle cx="86" cy="126" r="1.6"/><circle cx="118" cy="120" r="1.6"/><circle cx="114" cy="126" r="1.6"/></g>';
    s += kPaws(F, L);
    return kWrap(o, s, 98);
  }
  function kDuck(o) {
    o = o || {}; var F = '#FFE06E', L = '#C3961C', s = '';
    s += '<path d="M92 28 q6-18 14-8 q4-12 10 2" stroke="' + L + '" stroke-width="3" fill="' + F + '" stroke-linejoin="round"/>';
    s += '<path d="' + MOCHI + '"' + k(F, L) + '/>' + kShine();
    s += kEyes(o, 98) + kFace(o, 116, null);
    s += '<path d="M80 112 q20-10 40 0 q4 10-8 14 q-12 4-24 0 q-12-4-8-14z" fill="#FF9A3C" stroke="#B85E14" stroke-width="2.4" stroke-linejoin="round"/>';
    s += kPaws('#FFD24A', L, '#FF9A3C');
    return kWrap(o, s, 98);
  }
  function kFrog(o) {
    o = o || {}; var F = '#93D26D', L = '#4C8A30', C = '#E9F7D8', s = '';
    s += '<circle cx="66" cy="44" r="24"' + k(F, L) + '/><circle cx="134" cy="44" r="24"' + k(F, L) + '/>';
    s += '<path d="' + MOCHI + '"' + k(F, L) + '/>';
    s += '<circle cx="66" cy="44" r="21" fill="' + F + '"/><circle cx="134" cy="44" r="21" fill="' + F + '"/>';
    if (o.mood === 'happy') s += happyEye(66, 48, 10, '#2A1E1A') + happyEye(134, 48, 10, '#2A1E1A');
    else s += '<g class="' + (o.anim ? 'pb-blink' : '') + '"><circle cx="66" cy="44" r="15" fill="#fff"/><circle cx="134" cy="44" r="15" fill="#fff"/><ellipse cx="67" cy="46" rx="9" ry="10" fill="#2A1E1A"/><ellipse cx="133" cy="46" rx="9" ry="10" fill="#2A1E1A"/><circle cx="64" cy="42" r="3.4" fill="#fff"/><circle cx="130" cy="42" r="3.4" fill="#fff"/></g>';
    s += '<path d="M100 120 c30 0 48 8 48 24 c0 10-8 16-18 18 q6 14 4 28 h-68 q-2-14 4-28 c-10-2-18-8-18-18 c0-16 18-24 48-24z" fill="' + C + '"/>';
    s += '<ellipse cx="52" cy="98" rx="12" ry="7" fill="#FF8FA3" opacity=".5"/><ellipse cx="148" cy="98" rx="12" ry="7" fill="#FF8FA3" opacity=".5"/>';
    if (o.outfit !== 'mask') s += o.mood === 'huh' ? '<path d="M88 104 q12-6 24 0" stroke="#2A1E1A" stroke-width="2.6" fill="none" stroke-linecap="round"/>' : '<path d="M76 96 q24 18 48 0" stroke="#2A1E1A" stroke-width="2.8" fill="' + (o.mood === 'happy' ? '#B23A4C' : 'none') + '" stroke-linecap="round"/>';
    s += '<circle cx="90" cy="80" r="1.8" fill="' + L + '"/><circle cx="110" cy="80" r="1.8" fill="' + L + '"/>';
    s += kPaws(F, L);
    return kWrap(o, s, 44).replace('<g><circle cx="' , '<g><circle cx="');
  }
  function kKoala(o) {
    o = o || {}; var F = '#AEB5BF', L = '#5E6570', C = '#F6F3EE', s = '';
    s += '<circle cx="36" cy="64" r="28"' + k(F, L) + '/><circle cx="164" cy="64" r="28"' + k(F, L) + '/><circle cx="38" cy="66" r="17" fill="' + C + '"/><circle cx="162" cy="66" r="17" fill="' + C + '"/>';
    s += '<path d="' + MOCHI + '"' + k(F, L) + '/>' + kShine();
    s += '<path d="M100 150 q26 0 28 40 h-56 q2-40 28-40z" fill="' + C + '"/>';
    s += kEyes(o, 98) + kFace(o, 112, null);
    s += '<path d="M100 96 c12 0 16 8 16 16 c0 10-6 14-16 14 c-10 0-16-4-16-14 c0-8 4-16 16-16z" fill="url(#gNose)"/><ellipse cx="95" cy="104" rx="4" ry="2.4" fill="#fff" opacity=".5"/>';
    s += kPaws(F, L);
    return kWrap(o, s, 98);
  }
  function kTiger(o) {
    o = o || {}; var F = '#F5A04A', L = '#A85A1C', C = '#FFF7EC', D = '#3B2A22', s = '';
    s += '<path class="' + (o.anim ? 'pb-sway' : '') + '" d="M140 186 q40 0 40-38 q0-12 9-10 q12 44-46 56z"' + k(F, L) + '/><path d="M172 160 l12-6M176 146 l10-6" stroke="' + D + '" stroke-width="5" stroke-linecap="round"/>';
    s += '<circle cx="48" cy="44" r="17"' + k(F, L) + '/><circle cx="152" cy="44" r="17"' + k(F, L) + '/><circle cx="48" cy="46" r="8" fill="' + C + '"/><circle cx="152" cy="46" r="8" fill="' + C + '"/>';
    s += '<path d="' + MOCHI + '"' + k(F, L) + '/>' + kShine();
    s += '<path d="M86 34 q6 10 4 22M100 30 v24M114 34 q-6 10-4 22" stroke="' + D + '" stroke-width="5" fill="none" stroke-linecap="round"/>';
    s += '<path d="M28 96 q12 2 20 8M28 110 q12 0 18 4M172 96 q-12 2-20 8M172 110 q-12 0-18 4" stroke="' + D + '" stroke-width="4.5" fill="none" stroke-linecap="round"/>';
    s += '<path d="M100 104 c26 0 44 8 44 22 c0 16-20 24-44 24 c-24 0-44-8-44-24 c0-14 18-22 44-22z" fill="' + C + '"/>';
    s += '<path d="M100 150 q24 0 26 40 h-52 q2-40 26-40z" fill="' + C + '"/>';
    s += kEyes(o, 100) + kFace(o, 106, '#E46C7C') + kPaws(F, L);
    return kWrap(o, s, 100);
  }


  /* ---------- 등급 꾸밈 ---------- */
  var GDEFS = '<defs>' +
    '<linearGradient id="gBronze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2C08A"/><stop offset="1" stop-color="#B07034"/></linearGradient>' +
    '<linearGradient id="gSilver" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F4F7FB"/><stop offset="1" stop-color="#A8B3C2"/></linearGradient>' +
    '<linearGradient id="gCape" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E5484F"/><stop offset="1" stop-color="#9E1F27"/></linearGradient>' +
    '<radialGradient id="gAura"><stop offset="0" stop-color="#FFE48A" stop-opacity=".95"/><stop offset=".6" stop-color="#FFD23F" stop-opacity=".45"/><stop offset="1" stop-color="#FFD23F" stop-opacity="0"/></radialGradient>' +
    '</defs>';
  // 머리 위에 눈이 달린 개구리는 모자를 이마(눈 사이 아래)로 작게
  var CAP_AT = { frog: 'translate(100 76) scale(.6) translate(-100 -44)' };
  function cap(gold, id) {
    var at = CAP_AT[id] ? '<g transform="' + CAP_AT[id] + '">' : '<g>';
    return at + capInner(gold) + '</g>';
  }
  function capInner(gold) {
    var body = gold ? 'url(#gGold)' : '#26324A', line = gold ? '#A87A10' : '#121826';
    return '<g transform="rotate(-8 100 36)"><path d="M64 44 q36-30 72 0 l-4 10 q-32-9-64 0z" fill="' + body + '" stroke="' + line + '" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M60 54 q40-11 80 0 l-3 8 q-37-9-74 0z" fill="' + (gold ? '#C99A1C' : '#121826') + '"/>' +
      '<path d="M100 30 l3.4 6.6 7.2 1-5.2 5.2 1.2 7.2-6.6-3.4-6.6 3.4 1.2-7.2-5.2-5.2 7.2-1z" fill="' + (gold ? '#FFF6D0' : 'url(#gGold)') + '"/></g>';
  }
  var CAPE = '<path d="M30 108 q-28 52-8 86 h156 q20-34-8-86 q-70 32-140 0z" fill="url(#gCape)" stroke="#7A1219" stroke-width="3" stroke-linejoin="round"/>';
  var AURA = '<circle cx="100" cy="104" r="98" fill="url(#gAura)"/>';
  function decorate(svg, g, id) {
    if (!g) return svg;
    var badgeFill = { c: 'url(#gBronze)', r: 'url(#gSilver)', h: 'url(#gGold)', l: 'url(#gGold)' }[g] || 'url(#gGold)';
    // 배지 색(별 모양 배지의 첫 path 만 gGold 를 쓴다 — 노란 우비 gCoat 등은 그대로)
    svg = svg.replace(/(<path d="M[\d.]+ [\d.]+ l3\.3 6\.6[^"]*" fill=")url\(#gGold\)"/g, '$1' + badgeFill + '"');
    var back = g === 'l' ? AURA : g === 'h' ? CAPE : '';
    var front = g === 'r' || g === 'h' ? cap(false, id) : g === 'l' ? cap(true, id) + sparkle(28, 40) + sparkle(172, 62) + sparkle(160, 150) : '';
    // 뒤: 그림자 다음(첫 <g class=…> 앞), 앞: 마지막 </g> 앞
    var at = svg.indexOf('<g class=');
    svg = svg.slice(0, at) + back + svg.slice(at);
    var end = svg.lastIndexOf('</g></svg>');
    svg = svg.slice(0, end) + front + svg.slice(end);
    return svg.replace('<svg viewBox="0 0 200 200" aria-hidden="true">', '<svg viewBox="0 0 200 200" aria-hidden="true">' + GDEFS);
  }

  var DRAW = {
    corgi: function (o) { return kDog(o, 'corgi'); }, shiba: function (o) { return kDog(o, 'shiba'); },
    ragdoll: function (o) { return kCat(o, 'ragdoll'); }, siamese: function (o) { return kCat(o, 'siamese'); },
    raccoon: kRaccoon, owl: kOwl, panda: kPanda, monkey: kMonkey, hamster: kHamster, rabbit: kRabbit, fox: kFox, penguin: kPenguin, bear: kBear,
    hedgehog: kHedgehog, squirrel: kSquirrel, otter: kOtter, duck: kDuck, frog: kFrog, koala: kKoala, tiger: kTiger
  };
  /** 동물 그림. 모르는 종류면 빈 문자열 */
  function draw(id, o) {
    o = o || {};
    var f = DRAW[id];
    if (!f) return '';
    return decorate(f({ mood: o.mood, anim: o.anim, outfit: o.outfit }), o.grade, id);
  }
  return { draw: draw, ids: Object.keys(DRAW) };
});
