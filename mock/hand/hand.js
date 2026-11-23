/*
 * 코드네임 초상(손그림판) — 종마다 콘셉트 · 머리 · 옷 · 배경을 따로 그린다.
 * 원칙: mask · filter 를 쓰지 않는다(일부 휴대폰에서 얼굴이 안 그려짐). 그라데이션 · clipPath 만.
 * 머리 장식은 그 종의 머리 모양에 맞춰 손으로 좌표를 잡는다(자동 맞춤 없음).
 * 200×200, 머리 중심 약 (100,104), 목 y≈146.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Team3HandArt = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var uid = 0, D, N;
  function P(d, a) { return '<path d="' + d + '" ' + (a || '') + '/>'; }
  function E(cx, cy, rx, ry, a) { return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" ' + (a || '') + '/>'; }
  function C(cx, cy, r, a) { return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" ' + (a || '') + '/>'; }
  var OL = '#14100C';
  function st(w) { return 'stroke="' + OL + '" stroke-width="' + (w || 3) + '" stroke-linejoin="round" stroke-linecap="round"'; }
  // 그라데이션 등록 → url
  function rg(stops, cx, cy, r) { var id = N + 'g' + (D.length); D.push('<radialGradient id="' + id + '" cx="' + (cx || '40%') + '" cy="' + (cy || '30%') + '" r="' + (r || '75%') + '">' + stops.map(function (s) { return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : '') + '/>'; }).join('') + '</radialGradient>'); return 'url(#' + id + ')'; }
  function lg(stops, x2, y2) { var id = N + 'g' + (D.length); D.push('<linearGradient id="' + id + '" x1="0" y1="0" x2="' + (x2 == null ? 0 : x2) + '" y2="' + (y2 == null ? 1 : y2) + '">' + stops.map(function (s) { return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : '') + '/>'; }).join('') + '</linearGradient>'); return 'url(#' + id + ')'; }
  function skin(light, mid, dark) { return rg([[0, light], [.55, mid], [1, dark]], '40%', '28%', '78%'); }

  /* ---------- 눈: 반쯤 감은 날카로운 눈(눈꺼풀 · 홍채 · 동공 · 빛) ---------- */
  // o: { iris, lid(눈꺼풀 색), slit(세로 동공), r, tilt(바깥 끝 올림) , open(0~1 덜 감음) }
  // 0.8.5d 눈: 아몬드꼴 날카로운 눈. 바깥 끝이 올라가고 안쪽 끝이 내려간다(노려봄). 흰자는 조금, 홍채가 가득
  /* 0.8.5e 종마다 다른 눈.
     fierce(사자 · 호랑이 · 여우): 크게 뜬 맹수 눈. 큰 금빛 홍채 · 작은 동공(호랑이 · 여우는 세로) · 두꺼운 윗눈꺼풀 선
     cat(기본 아몬드): 샴 · 랙돌 · 부엉이
     bead(그 밖): 동물다운 까만 구슬 눈 + 반사광. 안쪽 위를 깎아 결연한 표정 */
  function fierceEye(cx, cy, o, side) {
    var r = (o.r || 9) * 1.25, w = r * 1.3, h = r * 1.1, t = o.tilt == null ? 6 : o.tilt;
    var ox = cx + side * w, ix = cx - side * w, oy = cy - t, iy = cy + 1;
    var d = 'M' + ix + ' ' + iy + ' Q' + (cx - side * w * .1) + ' ' + (cy - h * 1.15) + ' ' + ox + ' ' + oy + ' Q' + (cx + side * w * .2) + ' ' + (cy + h * 1.15) + ' ' + ix + ' ' + iy + ' Z';
    var cid = N + 'e' + (D.length); D.push('<clipPath id="' + cid + '">' + P(d, '') + '</clipPath>');
    var irG = rg([[0, '#FFF8D0'], [.45, o.iris || '#F5C030'], [.85, '#B86A08'], [1, '#3A1A00']], '50%', '45%', '60%');
    return P(d, 'fill="#FFF6E0"') + '<g clip-path="url(#' + cid + ')">' + C(cx, cy, h * .95, 'fill="' + irG + '"') + C(cx, cy, h * .95, 'fill="none" stroke="#2A1400" stroke-width="1.2"') +
      (o.slit ? E(cx, cy, 1.3, h * .78, 'fill="#050302"') : C(cx, cy, h * .3, 'fill="#050302"')) +
      P('M' + (ix - side * 3) + ' ' + (cy - h * 2) + ' L' + (ox + side * 3) + ' ' + (cy - h * 2) + ' L' + (ox + side * 3) + ' ' + (oy - 1) + ' Q' + cx + ' ' + (cy - h * .9) + ' ' + (ix - side * 3) + ' ' + (iy - 2) + ' Z', 'fill="#000" opacity=".12"') + '</g>' +
      C(cx - side * 2.2, cy - h * .35, h * .2, 'fill="#fff"') + C(cx + side * 2.2, cy + h * .35, h * .1, 'fill="#fff" opacity=".7"') +
      P(d, 'fill="none" ' + st(2)) +
      P('M' + (ix - side * 1) + ' ' + (iy + 1) + ' Q' + (cx - side * w * .1) + ' ' + (cy - h * 1.15) + ' ' + (ox + side * 3) + ' ' + (oy - 2), 'fill="none" ' + st(4.2)) +
      P('M' + (ix + side * 2) + ' ' + (iy + 3) + ' Q' + (cx + side * w * .2) + ' ' + (cy + h * 1.2) + ' ' + (ox - side * 2) + ' ' + (oy + 4), 'fill="none" stroke="#000" stroke-width="1.6" opacity=".45"');
  }
  // 0.8.5f 구슬 눈: 크게, 윤기 있게. 눈 위를 가로지르는 선 없음(예전엔 '줄 그은 구슬'처럼 보였다). 눈매는 위쪽 살짝 덮는 살색 면으로만
  function beadEye(cx, cy, o, side) {
    var r = (o.r || 9) * 1.2, ry = r * 1.08;
    var cid = N + 'e' + (D.length); D.push('<clipPath id="' + cid + '">' + E(cx, cy, r, ry, '') + '</clipPath>');
    var g = E(cx, cy, r, ry, 'fill="' + rg([[0, '#5A4A44'], [.45, o.bead || '#16100C'], [1, '#000']], '42%', '38%', '68%') + '"');
    if (o.iris) g += '<g clip-path="url(#' + cid + ')">' + C(cx, cy + 1, r * .7, 'fill="' + o.iris + '" opacity=".7"') + C(cx, cy + 1, r * .38, 'fill="#000"') + '</g>';
    g += '<g clip-path="url(#' + cid + ')">' + P('M' + (cx - side * (r + 2)) + ' ' + (cy - ry * .4) + ' L' + (cx + side * (r + 2)) + ' ' + (cy - ry * .78) + ' L' + (cx + side * (r + 2)) + ' ' + (cy - ry - 3) + ' L' + (cx - side * (r + 2)) + ' ' + (cy - ry - 3) + ' Z', 'fill="' + o.lid + '"') + '</g>';
    g += E(cx, cy, r, ry, 'fill="none" stroke="' + OL + '" stroke-width="2"');
    g += E(cx - side * r * .28, cy - ry * .12, r * .3, r * .26, 'fill="#fff"') + C(cx + side * r * .38, cy + ry * .42, r * .13, 'fill="#fff" opacity=".8"');
    return g;
  }
  function eye(cx, cy, o, side) {
    if (o.round) return roundEye(cx, cy, o, side);
    if (o.style === 'fierce') return fierceEye(cx, cy, o, side);
    if (o.style === 'bead') return beadEye(cx, cy, o, side);
    var r = o.r || 9, w = r * 1.4, h = r * .9, t = o.tilt == null ? 3 : o.tilt;
    var ox = cx + side * w, ix = cx - side * w, oy = cy - t, iy = cy + 2;
    var d = 'M' + ix + ' ' + iy + ' Q' + (cx - side * w * .2) + ' ' + (cy - h * 1.55) + ' ' + ox + ' ' + oy + ' Q' + (cx + side * w * .35) + ' ' + (cy + h * 1.25) + ' ' + ix + ' ' + iy + ' Z';
    var cid = N + 'e' + (D.length); D.push('<clipPath id="' + cid + '">' + P(d, '') + '</clipPath>');
    var irG = rg([[0, '#FFF6C8'], [.4, o.iris || '#E0A21E'], [1, '#2A1A08']], '45%', '35%', '65%');
    var g = P(d, 'fill="#F2EAD6"');
    g += '<g clip-path="url(#' + cid + ')">' + C(cx + side * 1, cy, h * 1.25, 'fill="' + irG + '"') +
      (o.slit ? E(cx + side * 1, cy, 1.5, h * 1.05, 'fill="#0A0604"') : C(cx + side * 1, cy, h * .55, 'fill="#0A0604"')) +
      P('M' + (ix - side * 2) + ' ' + (cy - h * 2) + ' L' + (ox + side * 2) + ' ' + (cy - h * 2 - t) + ' L' + (ox + side * 2) + ' ' + (oy + 1) + ' Q' + (cx - side * w * .2) + ' ' + (cy - h * 1.2) + ' ' + (ix - side * 2) + ' ' + (iy - 1) + ' Z', 'fill="#000" opacity=".28"') + '</g>';
    g += C(cx - side * 1.5, cy - h * .45, h * .28, 'fill="#fff"');
    g += P(d, 'fill="none" ' + st(2.2));
    g += P('M' + ix + ' ' + iy + ' Q' + (cx - side * w * .2) + ' ' + (cy - h * 1.55) + ' ' + ox + ' ' + oy, 'fill="none" ' + st(3.6));
    return g;
  }
  // 동그란 눈(재즈 개구리처럼 무심하게 반쯤 감은 눈) — o.round 일 때만
  function roundEye(cx, cy, o, side) {

    var r = o.r || 9, ir = o.iris || '#E0A21E', lid = o.lid, open = o.open == null ? .45 : o.open, t = (o.tilt || 3) * side;
    var g = E(cx, cy, r + 1.5, r * .85 + 1.5, 'fill="#F6F0E0" ' + st(2.6));
    var irG = rg([[0, '#FFF6C8'], [.35, ir], [1, '#2A1A08']], '45%', '40%', '62%');
    g += C(cx, cy + 1, r * .72, 'fill="' + irG + '"');
    g += o.slit ? E(cx, cy + 1, 1.6, r * .62, 'fill="#0A0604"') : C(cx, cy + 1, r * .34, 'fill="#0A0604"');
    g += C(cx - r * .3, cy - r * .2, r * .17, 'fill="#fff"');
    // 눈꺼풀: 위쪽을 덮는다(바깥 끝이 살짝 올라간 일자 → 노려봄)
    var ly = cy - r * .85 + open * r * .9;
    var x0 = cx - (r + 3) * side, x1 = cx + (r + 3) * side;
    // 눈꺼풀은 흰자 모양 안에서만(밖으로 삐져나와 네모 조각처럼 보이던 것 방지)
    var cid = N + 'e' + (D.length); D.push('<clipPath id="' + cid + '">' + E(cx, cy, r + 1.5, r * .85 + 1.5, '') + '</clipPath>');
    g += '<g clip-path="url(#' + cid + ')">' + P('M' + (x0 - 4 * side) + ' ' + (cy - r - 6) + ' L' + (x1 + 4 * side) + ' ' + (cy - r - 6 - t) + ' L' + (x1 + 4 * side) + ' ' + (ly - t) + ' Q' + cx + ' ' + (ly + 1.5) + ' ' + (x0 - 4 * side) + ' ' + ly + ' Z', 'fill="' + lid + '"') + '</g>';
    g += E(cx, cy, r + 1.5, r * .85 + 1.5, 'fill="none" ' + st(2.6));
    g += P('M' + (cx - (r + 1) * side) + ' ' + (ly + .5) + ' Q' + cx + ' ' + (ly + 1.5) + ' ' + (cx + (r + 1) * side) + ' ' + (ly - t * .6), 'fill="none" ' + st(2.8));
    return g;
  }
  function eyes(lx, rx, y, o) { return eye(lx, y, o, -1) + eye(rx, y, o, 1); }
  var EX = 'angry';   // 그리는 동안의 표정(종마다 draw 에서 정함)
  function brow(x0, y0, x1, y1, w, col) {
    var right = x0 > 100;
    if (EX === 'angry') { y1 += 3; }
    else if (EX === 'bored') { y0 += 3; y1 = y0; }
    else if (EX === 'calm') { y1 = y0 + 1; }
    else if (EX === 'skeptic' && right) { y0 -= 7; y1 = y0 - 1; }
    else if (EX === 'skeptic') { y1 += 3; }
    y0 -= 5; y1 -= 5;   // 눈과 사이를 띄운다
    return P('M' + x0 + ' ' + y0 + ' L' + x1 + ' ' + y1, 'stroke="' + (col || OL) + '" stroke-width="' + (w || 4.5) + '" stroke-linecap="round"'); }
  function smirk(x0, y0, x1, y1, w) {
    var m = (x0 + x1) / 2, y = Math.max(y0, y1);
    if (EX === 'bored') return P('M' + (x0 + 2) + ' ' + y + ' L' + (x1 - 2) + ' ' + y, 'fill="none" ' + st(w || 2.6));
    if (EX === 'frown' || EX === 'grim') return P('M' + x0 + ' ' + (y + 3) + ' Q' + m + ' ' + (y - 4) + ' ' + x1 + ' ' + (y + 3), 'fill="none" ' + st(w || 2.8));
    // 이빨 드러낸 웃음: 한쪽으로 올라간 입 + 송곳니 하나(입 전체를 이빨로 채우면 우스꽝스러웠다)
    if (EX === 'grin') return P('M' + x0 + ' ' + y0 + ' Q' + m + ' ' + (y + 5) + ' ' + (x1 + 2) + ' ' + (y1 - 4), 'fill="none" ' + st(w || 2.8)) + P('M' + (x1 - 7) + ' ' + (y + 1) + ' L' + (x1 - 4) + ' ' + (y + 7) + ' L' + (x1 - 1) + ' ' + (y - 1) + ' Z', 'fill="#FFFDF4" ' + st(1.4));
    return P('M' + x0 + ' ' + y0 + ' Q' + ((x0 + x1) / 2) + ' ' + (Math.max(y0, y1) + 4) + ' ' + x1 + ' ' + y1, 'fill="none" ' + st(w || 2.6)) + P('M' + (x1 - 2) + ' ' + (y1 - 3) + ' Q' + (x1 + 2) + ' ' + (y1 - 1) + ' ' + (x1 + 1) + ' ' + (y1 + 3), 'fill="none" ' + st(2)); }
  function dogNose(x, y, w) { w = w || 9; return P('M' + (x - w) + ' ' + y + ' Q' + x + ' ' + (y - w * .55) + ' ' + (x + w) + ' ' + y + ' Q' + (x + w * .6) + ' ' + (y + w * .8) + ' ' + x + ' ' + (y + w * .85) + ' Q' + (x - w * .6) + ' ' + (y + w * .8) + ' ' + (x - w) + ' ' + y + ' Z', 'fill="#18110E"') + E(x - w * .35, y - w * .05, w * .28, w * .16, 'fill="#fff" opacity=".45"'); }
  function catMouth(x, y) { return P('M' + x + ' ' + y + ' L' + x + ' ' + (y + 5) + ' M' + (x - 8) + ' ' + (y + 8) + ' Q' + (x - 4) + ' ' + (y + 11) + ' ' + x + ' ' + (y + 5) + ' Q' + (x + 5) + ' ' + (y + 11) + ' ' + (x + 11) + ' ' + (y + 5), 'fill="none" ' + st(2.4)); }
  function whisk(x, y, col) { return P('M' + (x - 18) + ' ' + y + ' L' + (x - 40) + ' ' + (y - 4) + ' M' + (x - 18) + ' ' + (y + 4) + ' L' + (x - 40) + ' ' + (y + 6) + ' M' + (x + 18) + ' ' + y + ' L' + (x + 40) + ' ' + (y - 4) + ' M' + (x + 18) + ' ' + (y + 4) + ' L' + (x + 40) + ' ' + (y + 6), 'stroke="' + (col || '#EDE6D6') + '" stroke-width="1.3" opacity=".75"'); }

  /* ---------- 배경 ---------- */
  function vig() { return '<rect width="200" height="200" fill="' + rg([[.62, '#000', 0], [1, '#000', .6]], '50%', '45%', '72%') + '"/>'; }
  function rain(col, op) { var g = ''; [[14, 10], [36, 70], [58, 20], [150, 40], [172, 96], [190, 14], [126, 8], [30, 130], [178, 150]].forEach(function (q) { g += P('M' + q[0] + ' ' + q[1] + ' l-6 24', 'stroke="' + (col || '#9DB4CC') + '" stroke-width="1" opacity="' + (op || .3) + '"'); }); return '<g class="nz-rain">' + g + '</g>'; }
  var BG = {
    alley: function () { return '<rect width="200" height="200" fill="' + rg([[0, '#22324A'], [.55, '#0E1520'], [1, '#05070C']], '20%', '15%', '95%') + '"/>' + C(22, 22, 44, 'class="nz-lamp" fill="' + rg([[0, '#FFC977', .6], [1, '#FFC977', 0]], '50%', '50%', '50%') + '"') + '<g opacity=".08" transform="rotate(-14 150 40)">' + [0, 1, 2, 3, 4, 5].map(function (q) { return '<rect x="96" y="' + (q * 13 - 10) + '" width="130" height="6" fill="#FFC977"/>'; }).join('') + '</g>' + rain(); },
    city: function (glow) { var w = ''; [[0, 110, 28], [28, 84, 22], [50, 120, 26], [140, 96, 24], [164, 118, 36]].forEach(function (h) { w += '<rect x="' + h[0] + '" y="' + h[1] + '" width="' + h[2] + '" height="' + (200 - h[1]) + '" fill="#0A0E16"/>'; for (var y = h[1] + 6; y < 190; y += 10) for (var x = h[0] + 4; x < h[0] + h[2] - 4; x += 7) if ((x * 7 + y * 3) % 5 < 2) w += '<rect x="' + x + '" y="' + y + '" width="3" height="4" fill="' + (glow || '#FFD36A') + '" opacity=".55"/>'; }); return '<rect width="200" height="200" fill="' + lg([[0, '#1A2448'], [1, '#0A0E18']]) + '"/>' + C(160, 30, 14, 'fill="#F2EED8" opacity=".85"') + w; },
    neon: function (a, b) { return '<rect width="200" height="200" fill="' + rg([[0, '#2A0E30'], [.6, '#120818'], [1, '#05030A']], '50%', '20%', '90%') + '"/><g class="nz-lamp"><rect x="12" y="20" width="50" height="20" rx="4" fill="none" stroke="' + a + '" stroke-width="2.5"/><rect x="146" y="14" width="40" height="46" rx="4" fill="none" stroke="' + b + '" stroke-width="2.5"/></g>' + C(37, 30, 40, 'fill="' + a + '" opacity=".14"') + C(166, 36, 40, 'fill="' + b + '" opacity=".12"') + rain('#C8A8FF', .3); },
    office: function () { var bl = ''; for (var y = 10; y < 120; y += 9) bl += '<rect x="108" y="' + y + '" width="84" height="5" fill="#E8D8A8" opacity=".2"/>'; return '<rect width="200" height="200" fill="' + rg([[0, '#2E2416'], [1, '#0C0A06']], '70%', '20%', '95%') + '"/>' + bl + P('M108 8 L192 8 L200 200 L60 200 Z', 'fill="#E8D8A8" opacity=".06"') + P('M12 118 L22 94 L40 94 L46 118 Z', 'fill="#1E4A2A"') + E(30, 122, 20, 5, 'fill="#B8FF9A" opacity=".22"'); },
    stage: function () { return '<rect width="200" height="200" fill="' + rg([[0, '#4A1C22'], [.5, '#1E0C10'], [1, '#08040A']], '50%', '8%', '95%') + '"/><g opacity=".5">' + P('M0 0 Q8 100 0 200 L22 200 Q30 100 22 0 Z', 'fill="#5A1A20"') + P('M22 0 Q30 100 22 200 L40 200 Q46 100 40 0 Z', 'fill="#3A0E14"') + P('M200 0 Q192 100 200 200 L178 200 Q170 100 178 0 Z', 'fill="#5A1A20"') + P('M178 0 Q170 100 178 200 L160 200 Q154 100 160 0 Z', 'fill="#3A0E14"') + '</g>' + P('M86 0 L114 0 L170 200 L30 200 Z', 'fill="' + lg([[0, '#FFE6B0', .32], [1, '#FFE6B0', 0]]) + '"'); },
    harbor: function () { return '<rect width="200" height="200" fill="' + lg([[0, '#16283A'], [1, '#060C14']]) + '"/>' + P('M150 20 L150 120 M150 26 L196 26 M150 26 L118 64', 'stroke="#1E2E3C" stroke-width="5"') + '<rect y="128" width="200" height="72" fill="#08121A"/>' + C(30, 112, 3, 'class="nz-lamp" fill="#FF5F5F"') + C(30, 112, 12, 'fill="#FF5F5F" opacity=".2"') + '<g class="nz-fog"><rect x="-40" y="96" width="280" height="36" rx="18" fill="#B8C8D4" opacity=".1"/></g>' + rain('#9DB4CC', .25); },
    snow: function () { var f = function (c) { return '<g class="' + c + '" fill="#fff" opacity=".75">' + [[14, 10], [40, 60], [70, 24], [130, 40], [160, 90], [186, 20], [100, 6], [24, 110], [176, 140]].map(function (q, i) { return C(q[0], q[1], 1.2 + (i % 3) * .6, ''); }).join('') + '</g>'; }; return '<rect width="200" height="200" fill="' + lg([[0, '#24304A'], [1, '#0A0E18']]) + '"/>' + P('M0 70 L30 30 L60 70 Z M140 74 L172 26 L200 74 Z', 'fill="#121A28"') + f('nz-snow') + f('nz-snow b'); },
    green: function () { return '<rect width="200" height="200" fill="' + rg([[0, '#1E4A34'], [.6, '#0C2018'], [1, '#040A08']], '50%', '15%', '95%') + '"/>' + E(100, 8, 60, 12, 'class="nz-lamp" fill="#FFF0C0" opacity=".25"') + P('M70 0 L130 0 L180 200 L20 200 Z', 'fill="#FFF0C0" opacity=".05"'); },
    monitor: function (col) { var g = ''; [[8, 20], [8, 66], [150, 20], [150, 66]].forEach(function (q) { g += '<rect x="' + q[0] + '" y="' + q[1] + '" width="42" height="34" rx="3" fill="#0A140E" stroke="#1E2E24" stroke-width="2"/>' + P('M' + (q[0] + 4) + ' ' + (q[1] + 24) + ' L' + (q[0] + 14) + ' ' + (q[1] + 14) + ' L' + (q[0] + 22) + ' ' + (q[1] + 20) + ' L' + (q[0] + 36) + ' ' + (q[1] + 8), 'fill="none" stroke="' + col + '" stroke-width="1.5" opacity=".7"'); }); return '<rect width="200" height="200" fill="' + rg([[0, '#0E2218'], [1, '#030806']], '50%', '40%', '90%') + '"/>' + '<g class="nz-lamp">' + g + '</g>' + C(100, 100, 90, 'fill="' + col + '" opacity=".05"'); },
    library: function () { var g = ''; for (var r = 0; r < 4; r++) for (var i = 0; i < 12; i++) { var x = i * 17 + (r % 2) * 6, h = 22 + (i * 7 % 9); g += '<rect x="' + x + '" y="' + (r * 48 + 46 - h) + '" width="12" height="' + h + '" fill="' + ['#5A2A20', '#2A3A5A', '#3A4A2A', '#5A4A20'][(i + r) % 4] + '" opacity=".55"/>'; } return '<rect width="200" height="200" fill="#120C08"/>' + g + C(100, 60, 80, 'fill="' + rg([[0, '#FFD08A', .22], [1, '#FFD08A', 0]], '50%', '50%', '50%') + '"'); },
    casino: function () { return '<rect width="200" height="200" fill="' + rg([[0, '#3A0E14'], [1, '#0A0204']], '50%', '20%', '90%') + '"/>' + [20, 60, 140, 180].map(function (x, i) { return C(x, 22 + (i % 2) * 14, 4, 'class="nz-lamp" fill="#FFD36A"') + C(x, 22 + (i % 2) * 14, 10, 'fill="#FFD36A" opacity=".2"'); }).join(''); },
    car: function () { return '<rect width="200" height="200" fill="#06080C"/>' + P('M0 30 Q100 6 200 30 L200 110 Q100 96 0 110 Z', 'fill="' + lg([[0, '#1A2A40'], [1, '#0A1220']]) + '"') + rain('#9DB4CC', .45) + C(150, 70, 4, 'fill="#FF5F5F" opacity=".7"') + C(160, 72, 3, 'fill="#FF5F5F" opacity=".5"') + P('M0 30 Q100 6 200 30', 'stroke="#000" stroke-width="10" fill="none"'); },
    vault: function () { return '<rect width="200" height="200" fill="#0E1012"/>' + C(100, 80, 92, 'fill="#1E2226" stroke="#2E3338" stroke-width="6"') + C(100, 80, 70, 'fill="none" stroke="#2A2F34" stroke-width="3"') + [0, 1, 2, 3, 4, 5, 6, 7].map(function (i) { var a = i * Math.PI / 4; return C((100 + Math.cos(a) * 82).toFixed(1), (80 + Math.sin(a) * 82).toFixed(1), 4, 'fill="#3A4046"'); }).join(''); },
    autumn: function () { var g = ''; [[20, 30], [60, 12], [150, 20], [180, 60], [36, 80], [168, 110]].forEach(function (q, i) { g += P('M' + q[0] + ' ' + q[1] + ' l4 6 l6 -2 l-3 6 l5 3 l-7 1 l0 6 l-4 -4 l-4 4 l0 -6 l-7 -1 l5 -3 l-3 -6 l6 2 z', 'fill="' + ['#D9482A', '#E8902A', '#B8321A'][i % 3] + '" opacity=".6"'); }); return '<rect width="200" height="200" fill="' + rg([[0, '#3A2010'], [1, '#0C0604']], '50%', '20%', '90%') + '"/><g class="nz-snow">' + g + '</g>'; },
    warehouse: function () { return '<rect width="200" height="200" fill="#100E0A"/>' + [[6, 60], [6, 100], [150, 70], [150, 110]].map(function (q) { return '<rect x="' + q[0] + '" y="' + q[1] + '" width="44" height="36" fill="#3A2E1E" stroke="#1E1810" stroke-width="2"/>' + P('M' + q[0] + ' ' + q[1] + ' L' + (q[0] + 44) + ' ' + (q[1] + 36) + ' M' + (q[0] + 44) + ' ' + q[1] + ' L' + q[0] + ' ' + (q[1] + 36), 'stroke="#1E1810" stroke-width="2"'); }).join('') + P('M90 0 L110 0 L140 200 L60 200 Z', 'fill="#FFE6A0" opacity=".06"') + C(100, 4, 8, 'class="nz-lamp" fill="#FFE6A0"'); },
    precinct: function () { return '<rect width="200" height="200" fill="' + lg([[0, '#1A2230'], [1, '#080A10']]) + '"/>' + P('M0 120 L200 120', 'stroke="#2A3442" stroke-width="2"') + [10, 30, 50, 70, 90, 110].map(function (y) { return P('M150 ' + y + ' L200 ' + y, 'stroke="#2E3A4A" stroke-width="1.5"'); }).join('') + '<text x="174" y="104" text-anchor="middle" font-size="9" font-weight="900" fill="#5A6A80" font-family="sans-serif">180</text>' + C(26, 26, 40, 'class="nz-lamp" fill="' + rg([[0, '#4A8AFF', .35], [1, '#4A8AFF', 0]], '50%', '50%', '50%') + '"') + C(174, 26, 30, 'class="nz-lamp b" fill="' + rg([[0, '#FF4A4A', .3], [1, '#FF4A4A', 0]], '50%', '50%', '50%') + '"'); }
  };

  /* ---------- 옷(몸) ---------- */
  function sh(c) { return '#' + c.replace('#', '').match(/../g).map(function (h) { return ('0' + Math.round(parseInt(h, 16) * .6).toString(16)).slice(-2); }).join(''); }
  var BODY = 'M6 200 L16 166 Q30 148 74 144 L126 144 Q170 148 184 166 L194 200 Z';
  function cloth(col) { return lg([[0, col], [.55, sh(col)], [1, '#06060A']], 1, 0); }
  var OUT = {
    tux: function (o) { return P(BODY, 'fill="' + cloth(o.c || '#3A3A46') + '" stroke="#050508" stroke-width="2.5"') + P('M84 146 L100 186 L116 146 Z', 'fill="#F4F0E6"') + P('M84 146 L100 186 L74 168 L66 152 Z', 'fill="#3E3E4C" stroke="#050508" stroke-width="2"') + P('M116 146 L100 186 L126 168 L134 152 Z', 'fill="#14141A" stroke="#050508" stroke-width="2"') + P('M100 156 L86 149 Q83 156 86 163 Z M100 156 L114 149 Q117 156 114 163 Z', 'fill="' + (o.tie || '#C42A34') + '" stroke="#2A0608" stroke-width="1.5"') + '<rect x="96.5" y="152.5" width="7" height="7" rx="2" fill="' + (o.tie || '#C42A34') + '" stroke="#2A0608" stroke-width="1.2"/>'; },
    suit: function (o) { return P(BODY, 'fill="' + cloth(o.c || '#2A2C34') + '" stroke="#050508" stroke-width="2.5"') + P('M86 146 L100 182 L114 146 Z', 'fill="' + (o.shirt || '#E8E4DA') + '"') + P('M96 150 L104 150 L106 176 L100 184 L94 176 Z', 'fill="' + (o.tie || '#8E1F24') + '" stroke="#1A0406" stroke-width="1.2"') + P('M86 146 L100 182 L76 166 L68 150 Z', 'fill="' + (o.c || '#2A2C34') + '" stroke="#050508" stroke-width="2"') + P('M114 146 L100 182 L124 166 L132 150 Z', 'fill="' + sh(o.c || '#2A2C34') + '" stroke="#050508" stroke-width="2"') + (o.stripe ? '<g stroke="#fff" stroke-width=".7" opacity=".12">' + [44, 54, 64, 136, 146, 156].map(function (x) { return P('M' + x + ' 160 L' + (x + (x < 100 ? -6 : 6)) + ' 200'); }).join('') + '</g>' : ''); },
    trench: function (o) { var c = o.c || '#8A7050'; return P(BODY, 'fill="' + cloth(c) + '" stroke="#0A0806" stroke-width="2.5"') + P('M86 146 L100 180 L114 146 Z', 'fill="#E8E2D2"') + P('M96 150 L104 150 L106 174 L100 182 L94 174 Z', 'fill="' + (o.tie || '#3A3F4A') + '" stroke="#0A0806" stroke-width="1.2"') + P('M84 146 L100 182 L70 164 L62 148 L76 134 Z', 'fill="' + c + '" stroke="#0A0806" stroke-width="2.2"') + P('M116 146 L100 182 L130 164 L138 148 L124 134 Z', 'fill="' + sh(c) + '" stroke="#0A0806" stroke-width="2.2"') + C(70, 182, 2.6, 'fill="' + sh(sh(c)) + '"') + C(130, 182, 2.6, 'fill="' + sh(sh(c)) + '"'); },
    leather: function (o) { var c = o.c || '#2A2626'; return P(BODY, 'fill="' + cloth(c) + '" stroke="#050505" stroke-width="2.5"') + P('M84 146 Q100 156 116 146 L112 200 L88 200 Z', 'fill="' + (o.shirt || '#3A3E46') + '"') + P('M100 156 L100 200', 'stroke="#9AA0A8" stroke-width="1.8" stroke-dasharray="3 2"') + P('M80 146 L60 132 L70 156 Z M120 146 L140 132 L130 156 Z', 'fill="' + c + '" stroke="#050505" stroke-width="2"') + P('M56 172 Q62 168 68 174', 'stroke="#fff" stroke-width="1.6" fill="none" opacity=".25"'); },
    hoodie: function (o) { var c = o.c || '#2C3040'; return P('M54 158 Q100 118 146 158 L146 166 L54 166 Z', 'fill="' + sh(c) + '" stroke="#050508" stroke-width="2.5"') + P(BODY, 'fill="' + cloth(c) + '" stroke="#050508" stroke-width="2.5"') + P('M82 148 Q100 160 118 148', 'stroke="' + sh(c) + '" stroke-width="3" fill="none"') + P('M92 154 L90 180 M108 154 L110 180', 'stroke="#D8D4CC" stroke-width="2" stroke-linecap="round"') + C(90, 182, 2, 'fill="#D8D4CC"') + C(110, 182, 2, 'fill="#D8D4CC"'); },
    vest: function (o) { var c = o.c || '#3A4A2A'; return P(BODY, 'fill="' + lg([[0, '#EEE8DA'], [1, '#B8B0A0']], 1, 0) + '" stroke="#0A0806" stroke-width="2.5"') + P('M70 150 L84 144 L100 186 L116 144 L130 150 L134 200 L66 200 Z', 'fill="' + c + '" stroke="#0A0806" stroke-width="2"') + P('M86 144 L100 160 L114 144', 'fill="#F4EEE2" stroke="#0A0806" stroke-width="1.5"') + P('M97 154 L103 154 L105 176 L100 184 L95 176 Z', 'fill="' + (o.tie || '#8E1F24') + '" stroke="#1A0406" stroke-width="1"') + C(106, 172, 1.8, 'fill="#C9A24A"') + C(106, 184, 1.8, 'fill="#C9A24A"'); },
    pea: function (o) { var c = o.c || '#22304A'; return P(BODY, 'fill="' + cloth(c) + '" stroke="#050508" stroke-width="2.5"') + P('M86 146 Q100 154 114 146 L112 156 Q100 162 88 156 Z', 'fill="' + (o.neck || '#3A3A42') + '"') + P('M78 146 L68 124 L96 140 Z M122 146 L132 124 L104 140 Z', 'fill="' + c + '" stroke="#050508" stroke-width="2"') + [[84, 168], [116, 168], [84, 186], [116, 186]].map(function (q) { return C(q[0], q[1], 3.2, 'fill="#C9A24A" stroke="#5A4210" stroke-width="1"'); }).join(''); },
    uniform: function (o) { var c = o.c || '#1E3A6A'; return P(BODY, 'fill="' + cloth(c) + '" stroke="#050508" stroke-width="2.5"') + P('M84 146 L100 172 L116 146 Z', 'fill="' + (o.shirt || '#DDE6F0') + '"') + P('M96 150 L104 150 L105 168 L100 174 L95 168 Z', 'fill="#14161A"') + P('M84 146 L100 172 L80 166 L72 150 Z M116 146 L100 172 L120 166 L128 150 Z', 'fill="' + c + '" stroke="#050508" stroke-width="2"') + P('M100 172 L100 200', 'stroke="' + sh(c) + '" stroke-width="2"') + C(106, 182, 2, 'fill="#C9A24A"') + C(106, 194, 2, 'fill="#C9A24A"') + P('M40 164 L62 160 L64 168 L42 172 Z M160 164 L138 160 L136 168 L158 172 Z', 'fill="#C9A24A" opacity=".85"'); },
    wetsuit: function () { return P(BODY, 'fill="' + cloth('#1E2428') + '" stroke="#050505" stroke-width="2.5"') + P('M60 160 Q100 150 140 160 L140 170 Q100 160 60 170 Z', 'fill="#2E7FA8"') + P('M100 150 L100 200', 'stroke="#3A444A" stroke-width="2"'); }
  };
  function badge(grade) { if (grade !== 'h' && grade !== 'l') return ''; var b = grade === 'l' ? ['#FFE48A', '#C9961A'] : ['#E8EDF2', '#8D98A6']; return P('M136 164 l8 -4 l8 4 l-2 10 l-6 4 l-6 -4 z', 'fill="' + b[0] + '" stroke="' + b[1] + '" stroke-width="1.5"') + C(144, 168, 2.2, 'fill="' + b[1] + '"'); }

  /* ---------- 30종 ---------- */
  // 머리는 함수: 반환 SVG. 각 종이 쓰는 차림 · 배경 · 손 소품도 함께
  var SP = {
    corgi: { cn: '에코', line: '무전 너머 작은 소리까지 듣는 귀', bg: 'alley', out: ['trench', {}], head: function () {
      var s = skin('#E8A060', '#B8682E', '#6A3414');
      return P('M60 90 L44 26 Q58 22 92 66 Z', 'fill="' + s + '" ' + st()) + P('M140 90 L156 26 Q142 22 108 66 Z', 'fill="' + s + '" ' + st()) + P('M62 82 L54 40 L84 68 Z M138 82 L146 40 L116 68 Z', 'fill="#5A2A14" opacity=".7"') +
        P('M54 108 Q52 72 80 64 L100 60 L120 64 Q148 72 146 108 Q144 140 100 146 Q56 140 54 108 Z', 'fill="' + s + '" ' + st()) +
        P('M100 66 Q90 86 84 104 Q76 128 100 140 Q124 128 116 104 Q110 86 100 66 Z', 'fill="#F4EAD8"') + E(100, 124, 24, 16, 'fill="#F6EEDE"') +
        eyes(80, 120, 96, { style: 'bead', iris: '#E0A21E', lid: '#A85E28' }) + brow(68, 82, 90, 85) + brow(132, 82, 110, 86) + dogNose(100, 116) + smirk(88, 128, 114, 126) +
        // 헤드셋(머리 모양에 맞춰 손으로)
        P('M52 102 Q50 60 100 54 Q150 60 148 102', 'fill="none" stroke="#1A1C22" stroke-width="5"') + '<rect x="44" y="94" width="13" height="22" rx="5" fill="#22252C" stroke="#000" stroke-width="1.5"/>' + P('M50 114 Q56 132 80 132', 'fill="none" stroke="#1A1C22" stroke-width="2.6"') + C(82, 132, 3.2, 'fill="#2A2E36"');
    }, prop: function () { return C(66, 176, 10, 'fill="#9FD8F0" fill-opacity=".35" stroke="#C9A24A" stroke-width="3.5"') + P('M60 184 L50 198', 'stroke="#3A2A1A" stroke-width="5" stroke-linecap="round"'); } },

    shiba: { cn: '스톤페이스', line: '표정 하나 없는 경호 담당', bg: 'city', out: ['suit', { c: '#1E1E24', shirt: '#2A2C34', tie: '#14141A' }], head: function () {
      var s = skin('#F0A860', '#C8702E', '#743A12');
      return P('M64 84 L58 30 L96 64 Z', 'fill="' + s + '" ' + st()) + P('M136 84 L142 30 L104 64 Z', 'fill="' + s + '" ' + st()) + P('M68 76 L64 44 L88 66 Z M132 76 L136 44 L112 66 Z', 'fill="#F4E8D4"') +
        P('M54 110 Q52 74 80 64 L100 62 L120 64 Q148 74 146 110 Q144 140 100 146 Q56 140 54 110 Z', 'fill="' + s + '" ' + st()) +
        P('M58 112 Q70 106 84 116 Q92 140 100 142 Q108 140 116 116 Q130 106 142 112 Q140 138 100 146 Q60 138 58 112 Z', 'fill="#F6EEE0"') +
        // 선글라스
        P('M64 88 L96 88 L94 104 Q80 110 66 104 Z M104 88 L136 88 L134 104 Q120 110 106 104 Z', 'fill="#0A0C10" stroke="#000" stroke-width="2"') + P('M96 92 L104 92', 'stroke="#000" stroke-width="3"') + P('M70 93 L80 93 M110 93 L120 93', 'stroke="#FF6B5A" stroke-width="1.8" opacity=".75"') +
        dogNose(100, 118, 8) + P('M90 132 L110 132', 'fill="none" ' + st(2.6)) +
        // 이어피스
        C(145, 106, 3.4, 'fill="#D8D4CC"') + P('M145 110 q-3 4 0 8 q3 4 0 8 q-3 4 0 8 L140 150', 'stroke="#D8D4CC" stroke-width="1.4" fill="none"');
    }, prop: function () { return ''; } },

    hamster: { cn: '포켓', line: '볼주머니에 증거를 숨겨 오는 수집가', bg: 'office', out: ['vest', { c: '#3A3A44' }], head: function () {
      var s = skin('#F4C890', '#D8964E', '#8A5420');
      return C(64, 68, 12, 'fill="' + s + '" ' + st()) + C(136, 68, 12, 'fill="' + s + '" ' + st()) + C(64, 68, 6, 'fill="#D88A8A"') + C(136, 68, 6, 'fill="#D88A8A"') +
        P('M50 106 Q48 70 100 64 Q152 70 150 106 Q152 140 100 146 Q48 140 50 106 Z', 'fill="' + s + '" ' + st()) +
        E(66, 118, 16, 14, 'fill="#F8E0C0"') + E(134, 118, 16, 14, 'fill="#F8E0C0"') + E(100, 124, 16, 12, 'fill="#FAF0E0"') +
        eyes(82, 118, 98, { style: 'bead', iris: '#D8862A', lid: '#B87A3A', r: 8, open: .5 }) + brow(72, 84, 92, 87, 4) + brow(128, 84, 108, 87, 4) +
        E(100, 114, 4, 3, 'fill="#D86A7A" stroke="' + OL + '" stroke-width="1.5"') + smirk(92, 124, 110, 122, 2.2) + P('M96 128 L96 134 L100 134 L100 128 M100 128 L100 134 L104 134 L104 128', 'fill="#fff" ' + st(1.2));
    }, prop: function () { return '<rect x="56" y="158" width="20" height="26" rx="2" fill="#E8F0F4" fill-opacity=".8" stroke="#7A8A94" stroke-width="1.5"/><rect x="56" y="158" width="20" height="5" fill="#C8323A"/>' + P('M60 170 L72 170 M60 176 L70 176', 'stroke="#3A4450" stroke-width="1.4"'); } },

    rabbit: { cn: '안테나', line: '긴 귀로 도청 무전을 잡는다', bg: 'neon', bgArgs: ['#9B7BFF', '#4FE0FF'], out: ['trench', { c: '#4A4E58', tie: '#5A2A6A' }], head: function () {
      var s = skin('#F6F2EA', '#D8D0C4', '#8A8070');
      return P('M78 70 Q64 0 80 -2 Q96 2 92 68 Z', 'fill="' + s + '" ' + st()) + P('M122 70 Q136 0 120 -2 Q104 2 108 68 Z', 'fill="' + s + '" ' + st()) + P('M82 64 Q72 12 81 8 Q89 12 88 62 Z M118 64 Q128 12 119 8 Q111 12 112 62 Z', 'fill="#E8A8B4"') +
        P('M56 110 Q54 72 100 66 Q146 72 144 110 Q142 142 100 146 Q58 142 56 110 Z', 'fill="' + s + '" ' + st()) +
        E(100, 126, 18, 13, 'fill="#FFFFFA"') + eyes(80, 120, 98, { style: 'bead', bead: '#9A1424', iris: '#E0405A', lid: '#C8C0B4' }) + brow(68, 84, 90, 87, 4) + brow(132, 84, 110, 88, 4) +
        P('M95 116 L105 116 L100 122 Z', 'fill="#D86A7A" ' + st(1.6)) + catMouth(100, 122) +
        // 목에 건 헤드폰
        P('M66 148 Q100 168 134 148', 'fill="none" stroke="#1A1C22" stroke-width="5"') + E(64, 146, 9, 11, 'fill="#22252C" stroke="#000" stroke-width="1.5"') + E(136, 146, 9, 11, 'fill="#22252C" stroke="#000" stroke-width="1.5"') + C(64, 146, 4, 'fill="#9B7BFF" opacity=".7"') + C(136, 146, 4, 'fill="#9B7BFF" opacity=".7"');
    }, prop: function () { return ''; } },

    bear: { cn: '그리즐리', line: '현장 반장, 어깨로 문을 연다', bg: 'precinct', out: ['leather', { c: '#3A2418', shirt: '#2A2E36' }], head: function () {
      var s = skin('#B8784A', '#8A4E28', '#4A2410');
      return C(62, 66, 16, 'fill="' + s + '" ' + st()) + C(138, 66, 16, 'fill="' + s + '" ' + st()) + C(62, 66, 8, 'fill="#5A2E14"') + C(138, 66, 8, 'fill="#5A2E14"') +
        P('M46 108 Q44 68 100 62 Q156 68 154 108 Q154 146 100 148 Q46 146 46 108 Z', 'fill="' + s + '" ' + st()) +
        E(100, 124, 26, 18, 'fill="#D8B088"') + eyes(78, 122, 96, { style: 'bead', iris: '#E0A21E', lid: '#7A4422' }) + brow(64, 80, 90, 86, 5.5) + brow(136, 80, 110, 86, 5.5) +
        dogNose(100, 116, 10) + smirk(86, 132, 114, 128, 2.8) + P('M120 70 L128 96', 'stroke="#D8B088" stroke-width="2.4" stroke-linecap="round" opacity=".8"');
    }, prop: function () { return '<rect x="58" y="160" width="14" height="22" rx="2.5" fill="#22252B" stroke="#0A0A0C" stroke-width="1.5"/>' + P('M68 160 L68 146', 'stroke="#22252B" stroke-width="3" stroke-linecap="round"') + C(65, 166, 2, 'fill="#7CFF8A"'); } },

    hedgehog: { cn: '니들', line: '건드리면 따끔한 수비수', bg: 'alley', out: ['hoodie', { c: '#2A3A2C' }], head: function () {
      var s = skin('#F2D8B0', '#D0A878', '#7A5430'), sp = '';
      for (var i = 0; i < 11; i++) { var a = Math.PI * (.95 + i * .11), x = 100 + Math.cos(a) * 54, y = 104 + Math.sin(a) * 54; sp += P('M' + (100 + Math.cos(a - .14) * 40).toFixed(1) + ' ' + (104 + Math.sin(a - .14) * 40).toFixed(1) + ' L' + (100 + Math.cos(a) * 72).toFixed(1) + ' ' + (104 + Math.sin(a) * 72).toFixed(1) + ' L' + (100 + Math.cos(a + .14) * 40).toFixed(1) + ' ' + (104 + Math.sin(a + .14) * 40).toFixed(1) + ' Z', 'fill="' + (i % 2 ? '#5A4430' : '#6E5438') + '" ' + st(2.2)); }
      return sp + P('M58 112 Q56 76 100 70 Q144 76 142 112 Q140 144 100 146 Q60 144 58 112 Z', 'fill="' + s + '" ' + st()) + C(74, 74, 9, 'fill="' + s + '" ' + st(2.4)) + C(126, 74, 9, 'fill="' + s + '" ' + st(2.4)) +
        eyes(82, 118, 100, { style: 'bead', iris: '#3AD08A', lid: '#B08A60', r: 8 }) + brow(72, 86, 92, 90, 4) + brow(128, 86, 108, 90, 4) +
        E(100, 120, 6, 4.5, 'fill="#18110E"') + smirk(90, 130, 110, 128, 2.4) + '<rect x="118" y="120" width="16" height="6" rx="2" fill="#F0E0C8" stroke="#8A7458" stroke-width="1" transform="rotate(-20 126 123)"/>';
    }, prop: function () { return ''; } },

    duck: { cn: '패들', line: '항구를 도는 수상 순찰대', bg: 'harbor', out: ['uniform', { c: '#1E3A6A' }], head: function () {
      var s = skin('#FFE680', '#F0C83A', '#A07A10');
      return P('M60 100 Q58 66 100 62 Q142 66 140 100 Q140 136 100 140 Q60 136 60 100 Z', 'fill="' + s + '" ' + st()) +
        P('M98 62 Q100 48 108 54 Q112 44 116 56', 'fill="none" ' + st(2.6)) +
        eyes(82, 118, 94, { style: 'bead', iris: '#4AA8E8', lid: '#D8AE2A', r: 8 }) + brow(70, 82, 92, 85, 4) + brow(130, 82, 108, 86, 4) +
        P('M76 112 Q100 102 124 112 Q126 124 100 128 Q74 124 76 112 Z', 'fill="' + lg([[0, '#FFB24A'], [1, '#D8781A']]) + '" ' + st(2.4)) + P('M80 117 Q100 121 120 115', 'fill="none" ' + st(2)) +
        // 순찰 모자(머리 꼭대기에 손으로)
        P('M66 70 L70 46 Q100 38 130 46 L134 70 Z', 'fill="#F2EEE6" ' + st(2.4)) + P('M64 68 L136 68 L136 76 L64 76 Z', 'fill="#22304A" ' + st(2.2)) + P('M70 74 Q100 70 130 74 L126 84 Q100 78 74 84 Z', 'fill="#14161A" ' + st(2)) + C(100, 56, 6, 'fill="#C9A24A" stroke="#5A4210" stroke-width="1.2"');
    }, prop: function () { return ''; } },

    frog: { cn: '재즈', line: '비 오는 밤, 재즈바 무대의 가수', bg: 'stage', out: ['tux', {}], head: function () {
      var s = rg([[0, '#9BD46A'], [.55, '#5E9C3C'], [1, '#2F5A22']], '42%', '30%', '75%'), b = rg([[0, '#A6DC74'], [1, '#3E7428']], '40%', '30%', '70%');
      return P('M46 112 Q44 84 70 76 Q100 70 130 76 Q156 84 154 112 Q152 140 100 146 Q48 140 46 112 Z', 'fill="' + s + '" stroke="#12200C" stroke-width="3"') +
        E(74, 78, 20, 18, 'fill="' + b + '" stroke="#12200C" stroke-width="3"') + E(126, 78, 20, 18, 'fill="' + b + '" stroke="#12200C" stroke-width="3"') +
        eye(74, 80, { round: true, iris: '#E0A21E', lid: '#4E8A34', r: 11, open: .5, tilt: 1 }, -1) + eye(126, 80, { round: true, iris: '#E0A21E', lid: '#4E8A34', r: 11, open: .5, tilt: 1 }, 1) +
        E(94, 104, 2, 1.4, 'fill="#12200C"') + E(106, 104, 2, 1.4, 'fill="#12200C"') +
        P('M62 116 Q100 132 140 112', 'stroke="#12200C" stroke-width="3" fill="none" stroke-linecap="round"') + P('M136 108 Q141 110 140 115', 'stroke="#12200C" stroke-width="2.4" fill="none" stroke-linecap="round"') +
        P('M70 132 Q100 146 130 132 Q118 146 100 147 Q82 146 70 132 Z', 'fill="#DCDCB0" opacity=".85"') + C(58, 102, 3, 'fill="#2F5A22" opacity=".6"') + C(144, 100, 3, 'fill="#2F5A22" opacity=".6"') +
        E(68, 70, 6, 3, 'fill="#F0FFD8" opacity=".5"') + E(120, 70, 6, 3, 'fill="#F0FFD8" opacity=".5"');
    }, prop: function () { return P('M60 200 L66 170', 'stroke="#2A2A30" stroke-width="4" stroke-linecap="round"') + '<rect x="58" y="146" width="16" height="26" rx="8" fill="' + lg([[0, '#F2F2F2'], [.5, '#9AA0A8'], [1, '#4A5058']], 1, 0) + '" stroke="#202228" stroke-width="1.8"/>' + P('M60 154 L72 154 M60 159 L72 159 M60 164 L72 164', 'stroke="#5A6068" stroke-width="1"') + C(132, 164, 5, 'fill="#C42A34" stroke="#4A0A10" stroke-width="1.2"'); } },

    ragdoll: { cn: '블루아이', line: '서재에서 사건을 푸는 귀족 탐정', bg: 'library', out: ['suit', { c: '#4A1E3A', shirt: '#F0E8DA', tie: '#2E6FD0' }], head: function () {
      var s = skin('#FFFCF4', '#E8DFCE', '#A89A80');
      return P('M60 88 L54 36 L94 66 Z', 'fill="#6A4E3E" ' + st()) + P('M140 88 L146 36 L106 66 Z', 'fill="#6A4E3E" ' + st()) + P('M64 80 L60 46 L86 68 Z M136 80 L140 46 L114 68 Z', 'fill="#E8B8B4" opacity=".7"') +
        P('M50 110 Q48 70 100 64 Q152 70 150 110 Q150 142 100 148 Q50 142 50 110 Z', 'fill="' + s + '" ' + st()) +
        P('M64 92 Q72 76 100 80 Q128 76 136 92 Q130 106 100 104 Q70 106 64 92 Z', 'fill="#8A6A58" opacity=".55"') +
        eyes(80, 120, 96, { iris: '#3A8AE8', lid: '#B8A898' }) + brow(68, 82, 90, 85, 4) + brow(132, 82, 110, 86, 4) + P('M95 114 L105 114 L100 120 Z', 'fill="#D88A9A" ' + st(1.6)) + catMouth(100, 120) + whisk(100, 122) +
        C(120, 96, 14, 'fill="#BFE6FF" fill-opacity=".15" stroke="#E0B23A" stroke-width="2.6"') + P('M133 102 Q140 128 132 150', 'fill="none" stroke="#E0B23A" stroke-width="1.4"');
    }, prop: function () { return ''; } },

    siamese: { cn: '마스크', line: '가면무도회에 숨어든 스파이', bg: 'casino', out: ['tux', { tie: '#8E1F24' }], head: function () {
      var s = skin('#F2E6D2', '#D4C2A6', '#8A7658');
      return P('M60 90 L52 30 L96 66 Z', 'fill="#3A2C24" ' + st()) + P('M140 90 L148 30 L104 66 Z', 'fill="#3A2C24" ' + st()) +
        P('M54 110 Q52 72 100 66 Q148 72 146 110 Q144 142 100 148 Q56 142 54 110 Z', 'fill="' + s + '" ' + st()) + E(100, 118, 30, 26, 'fill="#4A3830" opacity=".85"') +
        eyes(80, 120, 98, { iris: '#7FD0FF', lid: '#5A463A', slit: true }) +
        // 가면
        P('M56 96 Q64 80 100 88 Q136 80 144 96 Q140 114 118 112 Q106 110 100 102 Q94 110 82 112 Q60 114 56 96 Z M68 98 Q80 88 92 96 Q80 106 68 98 Z M132 98 Q120 88 108 96 Q120 106 132 98 Z', 'fill="#2A0E1E" fill-rule="evenodd" stroke="#E0B23A" stroke-width="2.2"') + P('M58 92 L44 84 M142 92 L156 84', 'stroke="#E0B23A" stroke-width="1.6"') +
        P('M95 118 L105 118 L100 124 Z', 'fill="#2A1A14"') + catMouth(100, 124) + whisk(100, 126, '#F2E6D2');
    }, prop: function () { return ''; } },

    fox: { cn: '폴리그래프', line: '거짓말을 귀신같이 잡는 심문관', bg: 'office', out: ['trench', { c: '#6E2A22', tie: '#2A0A0A' }], head: function () {
      var s = skin('#F0905A', '#C8582A', '#6A2410');
      return P('M62 90 L50 22 L96 64 Z', 'fill="' + s + '" ' + st()) + P('M138 90 L150 22 L104 64 Z', 'fill="' + s + '" ' + st()) + P('M64 80 L56 34 L86 64 Z M136 80 L144 34 L114 64 Z', 'fill="#2A1410"') +
        P('M52 100 Q52 70 100 64 Q148 70 148 100 Q146 120 118 132 L100 152 L82 132 Q54 120 52 100 Z', 'fill="' + s + '" ' + st()) +
        P('M54 104 Q70 118 86 120 L100 152 L114 120 Q130 118 146 104 Q146 124 118 134 L100 154 L82 134 Q54 124 54 104 Z', 'fill="#F6EEE2"') +
        eyes(80, 120, 93, { style: 'fierce', iris: '#FFB23E', lid: '#A84A22', slit: true }) + brow(64, 74, 92, 84, 4.5) + brow(136, 74, 108, 84, 4.5) +
        P('M94 146 Q100 142 106 146 Q103 152 100 152 Q97 152 94 146 Z', 'fill="#18110E"') + P('M92 154 Q100 158 110 152', 'fill="none" ' + st(2.2));
    }, prop: function () { return '<rect x="52" y="160" width="18" height="30" fill="#F0EBDD" stroke="#8A8270" stroke-width="1"/>' + P('M54 176 L57 170 L59 180 L61 164 L63 182 L65 172 L68 176', 'stroke="#C8323A" stroke-width="1.4" fill="none"'); } },

    penguin: { cn: '턱시도', line: '카지노 뒷방을 지키는 딜러', bg: 'casino', out: ['tux', { c: '#1A1A20', tie: '#C8323A' }], head: function () {
      return P('M54 108 Q52 66 100 60 Q148 66 146 108 Q146 144 100 150 Q54 144 54 108 Z', 'fill="' + skin('#4A5060', '#22262E', '#08090C') + '" ' + st()) +
        P('M66 104 Q68 80 88 82 Q100 90 112 82 Q132 80 134 104 Q134 136 100 142 Q66 136 66 104 Z', 'fill="' + skin('#FFFFFF', '#E8E8EE', '#A8A8B4') + '"') +
        eyes(84, 116, 100, { style: 'bead', iris: '#7FC8FF', lid: '#2A2E36', r: 8 }) + brow(72, 86, 92, 90, 4.5) + brow(128, 86, 108, 90, 4.5) +
        P('M90 110 L110 110 L100 128 Z', 'fill="' + lg([[0, '#FFC04A'], [1, '#D8801A']]) + '" ' + st(2.2)) + P('M93 116 L107 116', 'stroke="' + OL + '" stroke-width="1.5"');
    }, prop: function () { return '<g transform="rotate(-14 66 172)"><rect x="54" y="158" width="18" height="26" rx="2" fill="#fff" stroke="#3A3A3A" stroke-width="1.2"/><text x="63" y="175" text-anchor="middle" font-size="11" font-weight="900" fill="#C8323A" font-family="serif">A</text></g>'; } },

    monkey: { cn: '스카이워치', line: '옥상에서 망을 보는 감시조', bg: 'city', out: ['vest', { c: '#3A4A2A' }], head: function () {
      var s = skin('#B07848', '#8A5430', '#4A2A12'), f = skin('#F4D8B4', '#E0B888', '#9A7448');
      return C(50, 104, 14, 'fill="' + s + '" ' + st()) + C(150, 104, 14, 'fill="' + s + '" ' + st()) + C(50, 104, 7, 'fill="#E0B888"') + C(150, 104, 7, 'fill="#E0B888"') +
        P('M56 104 Q54 66 100 60 Q146 66 144 104 Q144 144 100 148 Q56 144 56 104 Z', 'fill="' + s + '" ' + st()) +
        P('M66 102 Q66 80 84 80 Q100 88 116 80 Q134 80 134 102 Q138 140 100 142 Q62 140 66 102 Z', 'fill="' + f + '"') +
        eyes(84, 116, 98, { style: 'bead', iris: '#E0A21E', lid: '#C49A6A', r: 8 }) + brow(72, 84, 92, 88, 4.5) + brow(128, 84, 108, 88, 4.5) +
        E(96, 116, 1.8, 2.4, 'fill="' + OL + '"') + E(104, 116, 1.8, 2.4, 'fill="' + OL + '"') + smirk(84, 128, 116, 126, 2.6) +
        P('M76 66 Q100 56 124 66', 'fill="none" stroke="#5A3A1E" stroke-width="3" opacity=".6"');
    }, prop: function () { return P('M64 148 Q72 160 70 164 M124 148 Q116 160 118 164', 'stroke="#2A2A2A" stroke-width="2" fill="none"') + '<rect x="62" y="162" width="30" height="16" rx="4" fill="#22252C" stroke="#000" stroke-width="1.5"/>' + C(70, 170, 5, 'fill="#3A5A7A" stroke="#9AA0A8" stroke-width="1.5"') + C(84, 170, 5, 'fill="#3A5A7A" stroke="#9AA0A8" stroke-width="1.5"'); } },

    squirrel: { cn: '컬렉터', line: '증거를 도토리처럼 모아 두는 증거반', bg: 'warehouse', out: ['trench', { c: '#5C3E26' }], head: function () {
      var s = skin('#D88A4A', '#A85A24', '#5A2A0C');
      return P('M150 200 Q190 150 170 80 Q160 40 130 50 Q160 70 156 120 Q150 160 130 200 Z', 'fill="' + skin('#D88A4A', '#A85A24', '#5A2A0C') + '" ' + st()) +
        P('M66 86 L60 40 L90 68 Z', 'fill="' + s + '" ' + st()) + P('M134 86 L140 40 L110 68 Z', 'fill="' + s + '" ' + st()) + P('M62 42 L58 30 L66 40 M138 42 L142 30 L134 40', 'stroke="#5A2A0C" stroke-width="3"') +
        P('M56 108 Q54 72 100 66 Q146 72 144 108 Q142 142 100 146 Q58 142 56 108 Z', 'fill="' + s + '" ' + st()) +
        P('M70 112 Q78 104 100 108 Q122 104 130 112 Q128 138 100 142 Q72 138 70 112 Z', 'fill="#F6EAD6"') +
        eyes(82, 118, 98, { style: 'bead', iris: '#E0A21E', lid: '#8A4A1E', r: 8.5 }) + brow(70, 84, 92, 87, 4) + brow(130, 84, 108, 87, 4) +
        E(100, 116, 4, 3, 'fill="#18110E"') + smirk(90, 128, 110, 126, 2.2) + P('M96 130 L96 136 L104 136 L104 130', 'fill="#fff" ' + st(1.2)) +
        // 베레모(머리 위에 비스듬히, 손으로)
        P('M60 72 Q56 50 104 46 Q148 46 142 68 Q100 80 60 72 Z', 'fill="' + skin('#B83A2E', '#8A2218', '#4A0A06') + '" ' + st(2.4)) + '<rect x="100" y="38" width="4" height="9" fill="#4A0A06"/>';
    }, prop: function () { return E(66, 176, 10, 12, 'fill="#8A5A2A" stroke="#3A2210" stroke-width="1.5"') + P('M56 170 Q66 160 76 170', 'fill="#5A3A1A" stroke="#3A2210" stroke-width="1.5"'); } },

    koala: { cn: '슬리퍼', line: '잠복 20시간째, 사실은 졸고 있다', bg: 'car', out: ['hoodie', { c: '#3A4456' }], head: function () {
      var s = skin('#C8CCD4', '#9AA0AC', '#5A606C');
      return C(54, 76, 24, 'fill="' + s + '" ' + st()) + C(146, 76, 24, 'fill="' + s + '" ' + st()) + C(54, 78, 13, 'fill="#F0F0F2"') + C(146, 78, 13, 'fill="#F0F0F2"') +
        P('M56 110 Q54 70 100 64 Q146 70 144 110 Q142 144 100 148 Q58 144 56 110 Z', 'fill="' + s + '" ' + st()) +
        eyes(80, 120, 100, { style: 'bead', iris: '#E0A21E', lid: '#8A909C', r: 8, open: .7, tilt: 0 }) + P('M70 88 L90 90 M130 88 L110 90', 'stroke="' + OL + '" stroke-width="4" stroke-linecap="round"') +
        E(100, 118, 11, 14, 'fill="#1A1414"') + E(96, 112, 3, 4, 'fill="#fff" opacity=".35"') + P('M92 136 Q100 138 108 134', 'fill="none" ' + st(2.4)) +
        // 눈 밑 다크서클
        P('M72 108 Q80 112 88 108 M112 108 Q120 112 128 108', 'stroke="#5A4A6A" stroke-width="2" fill="none" opacity=".6"');
    }, prop: function () { return P('M58 160 L60 188 Q66 192 74 188 L76 160 Z', 'fill="#E8E0D0" stroke="#5A4A3A" stroke-width="1.5"') + P('M58 160 L76 160 L74 156 L60 156 Z', 'fill="#3A2A1A"') + P('M62 150 Q66 144 64 138 M70 150 Q74 144 72 138', 'stroke="#fff" stroke-width="1.4" fill="none" opacity=".5"'); } },

    raccoon: { cn: '밴딧', line: '밤도둑 잡는 전직 밤도둑', bg: 'alley', out: ['hoodie', { c: '#1E2026' }], head: function () {
      var s = skin('#B8B8BC', '#8A8A90', '#46464C');
      return P('M62 88 L56 38 L94 66 Z', 'fill="' + s + '" ' + st()) + P('M138 88 L144 38 L106 66 Z', 'fill="' + s + '" ' + st()) + P('M64 80 L60 48 L86 68 Z M136 80 L140 48 L114 68 Z', 'fill="#2A2A2E"') +
        P('M52 112 Q50 72 100 66 Q150 72 148 112 Q146 140 100 146 Q54 140 52 112 Z', 'fill="' + s + '" ' + st()) +
        P('M54 100 Q70 84 100 96 Q130 84 146 100 Q140 116 118 112 L100 104 L82 112 Q60 116 54 100 Z', 'fill="#1A1A1E"') + E(100, 126, 22, 16, 'fill="#F0F0F0"') +
        eyes(80, 120, 100, { style: 'bead', iris: '#FFB23E', lid: '#1A1A1E' }) + brow(66, 84, 90, 88, 4, '#F0F0F0') + brow(134, 84, 110, 88, 4, '#F0F0F0') + dogNose(100, 120, 7) + smirk(90, 132, 112, 130, 2.4) +
        // 털모자(귀 사이, 손으로)
        P('M66 74 Q64 44 100 42 Q136 44 134 74 Z', 'fill="#14161A" ' + st(2.4)) + P('M62 66 L138 66 L138 78 L62 78 Z', 'fill="#22252C" ' + st(2.2)) + P('M74 68 L74 76 M86 68 L86 76 M98 68 L98 76 M110 68 L110 76 M122 68 L122 76', 'stroke="#3A3E46" stroke-width="1.5"');
    }, prop: function () { return ''; } },

    owl: { cn: '제로쓰리', line: '새벽 3시 CCTV 관제실 담당', bg: 'monitor', bgArgs: ['#7CFF8A'], out: ['suit', { c: '#2A2A34' }], head: function () {
      var s = skin('#A88458', '#7A5A34', '#3A2810');
      return P('M60 76 L52 40 L82 64 Z M140 76 L148 40 L118 64 Z', 'fill="' + s + '" ' + st()) +
        P('M50 110 Q48 66 100 60 Q152 66 150 110 Q150 146 100 150 Q50 146 50 110 Z', 'fill="' + s + '" ' + st()) +
        C(80, 102, 22, 'fill="#F2E6CC" ' + st(2.2)) + C(120, 102, 22, 'fill="#F2E6CC" ' + st(2.2)) +
        eyes(80, 120, 102, { iris: '#FFB23E', lid: '#D8C8A8', r: 11, open: .4 }) + brow(60, 80, 92, 86, 5) + brow(140, 80, 108, 86, 5) +
        P('M92 118 L108 118 L100 136 Z', 'fill="' + lg([[0, '#E8B03A'], [1, '#A8700A']]) + '" ' + st(2.2)) +
        P('M70 138 Q100 132 130 138', 'stroke="#5A4224" stroke-width="2" fill="none" opacity=".6"');
    }, prop: function () { return '<rect x="56" y="160" width="40" height="24" rx="2" fill="#0A140E" stroke="#3A5A44" stroke-width="2"/>' + P('M60 178 L68 170 L74 174 L86 164 L92 168', 'stroke="#7CFF8A" stroke-width="1.5" fill="none"'); } },

    otter: { cn: '다이버', line: '항구 바닥까지 증거를 찾는 잠수 수사관', bg: 'harbor', out: ['wetsuit', {}], head: function () {
      var s = skin('#A87A52', '#7A4E2C', '#3A2210');
      return C(60, 80, 10, 'fill="' + s + '" ' + st()) + C(140, 80, 10, 'fill="' + s + '" ' + st()) +
        P('M54 110 Q52 74 100 68 Q148 74 146 110 Q144 144 100 148 Q56 144 54 110 Z', 'fill="' + s + '" ' + st()) +
        E(100, 126, 28, 18, 'fill="#E8D0B0"') + eyes(80, 120, 104, { style: 'bead', iris: '#E0A21E', lid: '#6A4426', r: 8 }) + brow(68, 92, 90, 95, 4) + brow(132, 92, 110, 95, 4) +
        dogNose(100, 120, 8) + smirk(88, 132, 112, 130, 2.4) + whisk(100, 128, '#F2E6D2') +
        // 물안경(이마 위로 올림, 머리 모양에 맞춰 손으로)
        P('M54 80 Q100 70 146 80', 'stroke="#2E7FA8" stroke-width="5" fill="none"') + '<rect x="70" y="66" width="26" height="18" rx="7" fill="#9FE0FF" fill-opacity=".5" stroke="#1E5A7A" stroke-width="3"/><rect x="104" y="66" width="26" height="18" rx="7" fill="#9FE0FF" fill-opacity=".5" stroke="#1E5A7A" stroke-width="3"/>' + P('M74 72 Q78 69 84 70 M108 72 Q112 69 118 70', 'stroke="#fff" stroke-width="1.6" fill="none"');
    }, prop: function () { return ''; } },

    panda: { cn: '모노크롬', line: '흑백 필름으로 현장을 남기는 사진반', bg: 'city', out: ['trench', { c: '#3C3C40' }], head: function () {
      var s = skin('#FFFFFF', '#E8E8EC', '#A0A0A8');
      return C(60, 68, 17, 'fill="#1A1A1E" ' + st()) + C(140, 68, 17, 'fill="#1A1A1E" ' + st()) +
        P('M48 110 Q46 70 100 64 Q154 70 152 110 Q152 146 100 150 Q48 146 48 110 Z', 'fill="' + s + '" ' + st()) +
        P('M64 104 Q60 86 76 86 Q92 88 92 104 Q90 116 78 116 Q64 114 64 104 Z M136 104 Q140 86 124 86 Q108 88 108 104 Q110 116 122 116 Q136 114 136 104 Z', 'fill="#1A1A1E"') +
        eyes(80, 120, 102, { style: 'bead', iris: '#E0A21E', lid: '#1A1A1E', r: 8 }) + brow(66, 82, 90, 86, 4) + brow(134, 82, 110, 86, 4) +
        dogNose(100, 122, 8) + smirk(90, 134, 112, 132, 2.4);
    }, prop: function () { return P('M60 146 L74 168', 'stroke="#1A1A1E" stroke-width="2.5"') + '<rect x="56" y="164" width="32" height="22" rx="3" fill="#1E1F24" stroke="#0A0A0C" stroke-width="1.5"/>' + C(72, 175, 7, 'fill="#2A3440" stroke="#9AA0A8" stroke-width="1.5"') + C(70, 173, 2, 'fill="#fff" opacity=".7"') + '<rect x="78" y="160" width="7" height="4" fill="#9AA0A8"/>'; } },

    tiger: { cn: '헌터', line: '범인 잡는 범, 강력반 출신', bg: 'neon', bgArgs: ['#FF4A3A', '#FFB03A'], out: ['leather', { c: '#1E1C1E' }], head: function () {
      var s = skin('#F8A050', '#D8782A', '#7A3A0E');
      return C(62, 70, 14, 'fill="' + s + '" ' + st()) + C(138, 70, 14, 'fill="' + s + '" ' + st()) + C(62, 70, 7, 'fill="#1A1410"') + C(138, 70, 7, 'fill="#1A1410"') +
        P('M48 110 Q46 70 100 64 Q154 70 152 110 Q152 146 100 150 Q48 146 48 110 Z', 'fill="' + s + '" ' + st()) +
        P('M100 66 L94 80 L100 88 L106 80 Z M80 70 L76 86 M120 70 L124 86 M50 100 L68 102 M50 112 L66 112 M150 100 L132 102 M150 112 L134 112', 'fill="#1A1410" stroke="#1A1410" stroke-width="3.2" stroke-linecap="round"') +
        E(100, 128, 26, 18, 'fill="#FAF0E0"') + eyes(80, 120, 101, { style: 'fierce', iris: '#F5C842', lid: '#B8601E', slit: true }) + brow(62, 80, 92, 92, 6) + brow(138, 80, 108, 92, 6) +
        dogNose(100, 120, 9) + smirk(88, 134, 114, 130, 2.6) + P('M114 80 L126 108', 'stroke="#F6D8C8" stroke-width="3" stroke-linecap="round"') + P('M116 90 L124 86 M119 98 L127 94', 'stroke="#F6D8C8" stroke-width="2" stroke-linecap="round"');
    }, prop: function () { return ''; } },

    sheep: { cn: '클라우드', line: '푹신한 털 속에 증거를 숨기는 잠입조', bg: 'snow', out: ['pea', { c: '#3A4A6A' }], head: function () {
      var w = '', s = skin('#FFFFFF', '#E8E6E0', '#A8A49A');
      [[64, 70], [80, 58], [100, 54], [120, 58], [136, 70], [146, 88], [54, 88]].forEach(function (q) { w += C(q[0], q[1], 17, 'fill="' + s + '" ' + st(2.6)); });
      var f = skin('#8A7A6E', '#6A5C52', '#3A302A');
      return w + P('M52 100 Q38 104 40 124 Q52 122 62 108 Z M148 100 Q162 104 160 124 Q148 122 138 108 Z', 'fill="' + f + '" ' + st()) +
        P('M66 104 Q64 78 100 76 Q136 78 134 104 Q134 142 100 146 Q66 142 66 104 Z', 'fill="' + f + '" ' + st()) +
        E(100, 128, 18, 13, 'fill="#A8988A"') + eyes(84, 116, 104, { style: 'bead', iris: '#F5C842', lid: '#5A4C42', r: 8 }) + brow(74, 92, 92, 95, 4) + brow(126, 92, 108, 95, 4) +
        P('M94 124 L106 124 L100 130 Z', 'fill="#2A201A"') + catMouth(100, 130) +
        C(80, 64, 14, 'fill="' + s + '" opacity=".9"') + C(100, 60, 14, 'fill="' + s + '" opacity=".9"') + C(120, 64, 14, 'fill="' + s + '" opacity=".9"');
    }, prop: function () { return P('M72 146 Q100 160 128 146 L126 156 Q100 168 74 156 Z', 'fill="#C83A3A" stroke="#4A0A0A" stroke-width="1.5"') + P('M118 156 L124 178 L132 176 L124 154 Z', 'fill="#C83A3A" stroke="#4A0A0A" stroke-width="1.5"'); } },

    pig: { cn: '트러플', line: '냄새로 범인을 쫓는 추적 전문', bg: 'alley', out: ['trench', { c: '#6A5A3A' }], head: function () {
      var s = skin('#FFC8C8', '#F0A0A8', '#A05A64');
      return P('M62 84 L52 44 L90 64 Z', 'fill="' + s + '" ' + st()) + P('M138 84 L148 44 L110 64 Z', 'fill="' + s + '" ' + st()) +
        P('M50 110 Q48 70 100 64 Q152 70 150 110 Q150 146 100 150 Q50 146 50 110 Z', 'fill="' + s + '" ' + st()) +
        eyes(80, 120, 98, { style: 'bead', iris: '#E0A21E', lid: '#D08088', r: 8.5 }) + brow(68, 84, 90, 87, 4.5) + brow(132, 84, 110, 87, 4.5) +
        E(100, 122, 16, 11, 'fill="#F8B0B8" ' + st(2.4)) + E(94, 122, 3, 4.5, 'fill="#5A1A24"') + E(106, 122, 3, 4.5, 'fill="#5A1A24"') + smirk(88, 138, 112, 134, 2.4) +
        // 사냥 모자(체크, 손으로)
        P('M64 76 Q64 48 100 46 Q136 48 136 76 Z', 'fill="' + skin('#B89068', '#8A6A44', '#4A3420') + '" ' + st(2.4)) + P('M82 50 L82 76 M100 46 L100 76 M118 50 L118 76 M66 62 L134 62', 'stroke="#5A4228" stroke-width="1.8" opacity=".75"') +
        P('M64 74 Q50 74 44 82 Q58 86 70 80 Z M136 74 Q150 74 156 82 Q142 86 130 80 Z', 'fill="#6E5234" ' + st(2.2)) + C(100, 46, 3, 'fill="#5A4228"');
    }, prop: function () { return C(66, 174, 10, 'fill="#9FD8F0" fill-opacity=".35" stroke="#C9A24A" stroke-width="3.5"') + P('M60 182 L50 196', 'stroke="#3A2A1A" stroke-width="5" stroke-linecap="round"'); } },

    redpanda: { cn: '메이플', line: '공원 벤치의 정보원', bg: 'autumn', out: ['trench', { c: '#7A3A1E' }], head: function () {
      var s = skin('#E8743A', '#C04A1E', '#5A1A08');
      return P('M62 86 L56 40 L94 66 Z', 'fill="' + s + '" ' + st()) + P('M138 86 L144 40 L106 66 Z', 'fill="' + s + '" ' + st()) + P('M64 78 L60 48 L86 68 Z M136 78 L140 48 L114 68 Z', 'fill="#F6EEE2"') +
        P('M50 110 Q48 72 100 66 Q152 72 150 110 Q148 144 100 148 Q52 144 50 110 Z', 'fill="' + s + '" ' + st()) +
        P('M64 116 Q70 100 84 104 Q92 118 100 120 Q108 118 116 104 Q130 100 136 116 Q130 140 100 144 Q70 140 64 116 Z', 'fill="#F6EEE2"') + E(80, 92, 10, 6, 'fill="#F6EEE2"') + E(120, 92, 10, 6, 'fill="#F6EEE2"') +
        P('M78 108 L74 130 M122 108 L126 130', 'stroke="#7A2A10" stroke-width="5" stroke-linecap="round"') +
        eyes(80, 120, 102, { style: 'bead', iris: '#E0A21E', lid: '#A0401A', r: 8 }) + brow(68, 88, 90, 91, 4) + brow(132, 88, 110, 91, 4) + dogNose(100, 122, 7) + smirk(90, 134, 112, 132, 2.2);
    }, prop: function () { return P('M68 158 L71 166 L78 163 L74 170 L80 174 L72 175 L72 182 L68 177 L64 182 L64 175 L56 174 L62 170 L58 163 L65 166 Z', 'fill="#D9482A" stroke="#6A1A0A" stroke-width="1.2"') + P('M68 182 L66 190', 'stroke="#6A3A1A" stroke-width="1.6"'); } },

    alpaca: { cn: '패커', line: '준비물을 빠짐없이 챙기는 보급 담당', bg: 'warehouse', out: ['vest', { c: '#5A4A6A' }], head: function () {
      var s = skin('#FFFAF0', '#EEE4D0', '#A89A80');
      return P('M70 74 L64 36 L86 62 Z M130 74 L136 36 L114 62 Z', 'fill="' + s + '" ' + st()) +
        P('M66 150 L68 100 Q66 64 100 60 Q134 64 132 100 L134 150 Z', 'fill="' + s + '" ' + st()) +
        C(84, 62, 12, 'fill="' + s + '"') + C(100, 56, 13, 'fill="' + s + '"') + C(116, 62, 12, 'fill="' + s + '"') + P('M74 62 Q100 44 126 62', 'fill="none" ' + st(2.6)) +
        E(100, 118, 18, 14, 'fill="#F6EEDE"') + eyes(84, 116, 92, { style: 'bead', iris: '#5A9AE8', lid: '#D8CCB4', r: 8 }) + brow(74, 80, 92, 83, 4) + brow(126, 80, 108, 83, 4) +
        P('M95 112 L105 112 L100 118 Z', 'fill="#5A4030"') + catMouth(100, 118) + C(116, 92, 12, 'fill="#BFE6FF" fill-opacity=".15" stroke="#E0B23A" stroke-width="2.4"');
    }, prop: function () { return '<rect x="52" y="156" width="24" height="32" rx="2" fill="#8A6A44" stroke="#3A2A14" stroke-width="1.5"/><rect x="56" y="162" width="16" height="22" fill="#F0EBDD"/>' + P('M58 168 L70 168 M58 173 L70 173 M58 178 L66 178', 'stroke="#5A6068" stroke-width="1.2"') + '<rect x="60" y="153" width="8" height="5" rx="1" fill="#9AA0A8"/>'; } },

    seal: { cn: '하버', line: '부두를 지키는 해양 순찰대', bg: 'harbor', out: ['pea', { c: '#1E2E4A' }], head: function () {
      var s = skin('#C8D0DA', '#909CA8', '#4A5664');
      return P('M50 110 Q48 70 100 64 Q152 70 150 110 Q150 146 100 150 Q50 146 50 110 Z', 'fill="' + s + '" ' + st()) +
        C(74, 86, 3, 'fill="#4A5460"') + C(128, 82, 2.5, 'fill="#4A5460"') + C(124, 136, 2.5, 'fill="#4A5460"') +
        E(100, 126, 26, 16, 'fill="#DDE4EC"') + eyes(80, 120, 102, { style: 'bead', iris: '#5AA8E8', lid: '#7A8694', r: 9 }) + brow(66, 88, 90, 92, 4) + brow(134, 88, 110, 92, 4) +
        dogNose(100, 120, 8) + smirk(90, 134, 112, 132, 2.4) + whisk(100, 128, '#F2F4F6') +
        // 선원 모자(머리 위, 손으로)
        P('M68 76 L72 50 Q100 42 128 50 L132 76 Z', 'fill="#F2EEE6" ' + st(2.4)) + P('M66 72 L134 72 L134 80 L66 80 Z', 'fill="#22304A" ' + st(2.2)) + P('M72 78 Q100 74 128 78 L124 88 Q100 82 76 88 Z', 'fill="#14161A" ' + st(2)) + C(100, 60, 6, 'fill="#C9A24A" stroke="#5A4210" stroke-width="1.2"');
    }, prop: function () { return ''; } },

    hippo: { cn: '부스터', line: '하품 한 번에 팀 사기를 채우는 분위기 메이커', bg: 'office', out: ['leather', { c: '#3A2A3E' }], head: function () {
      var s = skin('#C8B0CC', '#9A7EA0', '#4A3450');
      return C(70, 68, 10, 'fill="' + s + '" ' + st()) + C(130, 68, 10, 'fill="' + s + '" ' + st()) +
        P('M58 100 Q56 68 100 64 Q144 68 142 100 L144 104 Q160 120 150 140 Q130 154 100 152 Q70 154 50 140 Q40 120 56 104 Z', 'fill="' + s + '" ' + st()) +
        P('M50 120 Q60 106 100 108 Q140 106 150 120 Q150 146 100 150 Q50 146 50 120 Z', 'fill="#D8C4DC"') + E(86, 118, 4, 3, 'fill="#3A2440"') + E(114, 118, 4, 3, 'fill="#3A2440"') +
        eyes(82, 118, 92, { style: 'bead', iris: '#E0A21E', lid: '#8A6E90', r: 8 }) + brow(72, 80, 92, 83, 4) + brow(128, 80, 108, 83, 4) +
        P('M66 136 Q100 148 136 132', 'fill="none" ' + st(2.8)) + P('M80 140 L82 134 L87 138 M114 138 L119 133 L121 139', 'fill="#fff" ' + st(1.4));
    }, prop: function () { return '<rect x="54" y="158" width="18" height="26" rx="3" fill="#C8C8C0" stroke="#5A5A52" stroke-width="1.5"/>' + P('M72 164 Q80 166 72 176', 'fill="none" stroke="#5A5A52" stroke-width="2"') + P('M58 152 Q62 146 60 140 M66 152 Q70 146 68 140', 'stroke="#fff" stroke-width="1.4" fill="none" opacity=".5"'); } },

    turtle: { cn: '아이언쉘', line: '느려도 끝까지 버티는 잠복조', bg: 'car', out: ['pea', { c: '#3A4A2E', neck: '#4A5A3A' }], head: function () {
      var s = skin('#A8C878', '#789A48', '#3A5420');
      return P('M60 110 Q58 72 100 66 Q142 72 140 110 Q140 144 100 148 Q60 144 60 110 Z', 'fill="' + s + '" ' + st()) +
        P('M74 80 Q100 70 126 80', 'stroke="#5A7A34" stroke-width="2.5" fill="none" opacity=".7"') + C(76, 96, 3, 'fill="#5A7A34" opacity=".6"') + C(126, 100, 3, 'fill="#5A7A34" opacity=".6"') +
        eyes(82, 118, 102, { style: 'bead', iris: '#F2D23D', lid: '#6A8A40', r: 8.5, open: .55 }) + brow(72, 90, 92, 93, 4) + brow(128, 90, 108, 93, 4) +
        E(96, 120, 1.8, 1.4, 'fill="' + OL + '"') + E(104, 120, 1.8, 1.4, 'fill="' + OL + '"') + P('M84 132 Q100 140 116 130', 'fill="none" ' + st(2.6)) +
        // 철모(머리에 맞춰 손으로)
        P('M58 86 Q56 48 100 46 Q144 48 142 86 Z', 'fill="' + skin('#6A7A50', '#4A5A3A', '#2A3420') + '" ' + st(2.6)) + P('M50 84 L150 84 L152 92 L48 92 Z', 'fill="#3A4A2A" ' + st(2.4)) + P('M74 62 Q100 52 126 62', 'stroke="#8A9A70" stroke-width="2" fill="none" opacity=".6"');
    }, prop: function () { return '<rect x="58" y="160" width="14" height="22" rx="2.5" fill="#22252B" stroke="#0A0A0C" stroke-width="1.5"/>' + P('M68 160 L68 146', 'stroke="#22252B" stroke-width="3" stroke-linecap="round"') + C(65, 166, 2, 'fill="#7CFF8A"'); } },

    mouse: { cn: '크랙', line: '금고 다이얼 소리를 듣는 해제 전문', bg: 'vault', out: ['hoodie', { c: '#3A2E2E' }], head: function () {
      var s = skin('#D8D0D4', '#ABA0A6', '#5E5258');
      return C(58, 70, 26, 'fill="' + s + '" ' + st()) + C(142, 70, 26, 'fill="' + s + '" ' + st()) + C(58, 70, 15, 'fill="#E8A8B4"') + C(142, 70, 15, 'fill="#E8A8B4"') +
        P('M62 108 Q60 74 100 70 Q140 74 138 108 Q134 140 100 150 Q66 140 62 108 Z', 'fill="' + s + '" ' + st()) +
        eyes(84, 116, 104, { style: 'bead', iris: '#E04A5A', lid: '#8A7E84', r: 8 }) + brow(74, 92, 92, 95, 4) + brow(126, 92, 108, 95, 4) +
        E(100, 132, 4, 3, 'fill="#E07A8A" stroke="' + OL + '" stroke-width="1.4"') + catMouth(100, 134) + whisk(100, 132, '#F2ECEE') +
        // 청진기(목에)
        P('M76 150 Q78 166 90 168 M124 150 Q122 166 110 168', 'fill="none" stroke="#2A2A2E" stroke-width="2.4"');
    }, prop: function () { return P('M90 168 Q100 176 96 184', 'fill="none" stroke="#2A2A2E" stroke-width="2.4"') + C(96, 186, 5, 'fill="#B8BCC4" stroke="#4A4E56" stroke-width="1.5"'); } },

    lion: { cn: '킹', line: '갈기 휘날리는 3팀의 대장', bg: 'city', out: ['suit', { c: '#1E1E24', stripe: true, tie: '#B8902A' }], head: function () {
      var m = '', s = skin('#F2C070', '#D8962E', '#7A4A0E');
      for (var i = 0; i < 16; i++) { var a = i / 16 * Math.PI * 2, x = 100 + Math.cos(a) * 48, y = 104 + Math.sin(a) * 46; m += C(x.toFixed(1), y.toFixed(1), 18, 'fill="' + (i % 2 ? '#7A4218' : '#8A4E1E') + '" ' + st(2.6)); }
      return m + C(100, 104, 48, 'fill="#7A4218"') +
        P('M62 108 Q60 72 100 68 Q140 72 138 108 Q136 140 100 146 Q64 140 62 108 Z', 'fill="' + s + '" ' + st()) +
        E(100, 128, 20, 14, 'fill="#F6E4C0"') + eyes(83, 117, 101, { style: 'fierce', iris: '#F5C842', lid: '#B87A2A', r: 8.5 }) + brow(68, 80, 93, 92, 5.5) + brow(132, 80, 107, 92, 5.5) +
        dogNose(100, 120, 8) + smirk(90, 134, 112, 130, 2.6);
    }, prop: function () { return P('M58 164 l4 -8 l4 5 l4 -7 l4 7 l4 -5 l4 8 z', 'fill="#FFD36A" stroke="#8A6410" stroke-width="1.2"'); } },

    deer: { cn: '실버벨', line: '눈 오는 밤 숲길을 도는 순찰대', bg: 'snow', out: ['pea', { c: '#4A2E2A', neck: '#6A2A2A' }], head: function () {
      var s = skin('#D8A070', '#B47A44', '#5A3414');
      return P('M84 64 L74 20 M78 40 L62 30 M116 64 L126 20 M122 40 L138 30', 'stroke="#6A4A28" stroke-width="6" stroke-linecap="round"') +
        P('M60 86 L42 66 Q50 58 84 72 Z', 'fill="' + s + '" ' + st()) + P('M140 86 L158 66 Q150 58 116 72 Z', 'fill="' + s + '" ' + st()) + P('M58 80 L48 68 L76 74 Z M142 80 L152 68 L124 74 Z', 'fill="#F0D8C0"') +
        P('M62 106 Q60 72 100 68 Q140 72 138 106 Q136 138 100 148 Q64 138 62 106 Z', 'fill="' + s + '" ' + st()) +
        C(78, 84, 3, 'fill="#F4E4D0"') + C(124, 82, 3, 'fill="#F4E4D0"') + C(130, 92, 2.5, 'fill="#F4E4D0"') + E(100, 130, 16, 13, 'fill="#F0E0CC"') +
        eyes(84, 116, 102, { style: 'bead', iris: '#D8962A', lid: '#8A5A30', r: 8.5 }) + brow(74, 90, 92, 93, 4) + brow(126, 90, 108, 93, 4) + dogNose(100, 126, 7) + smirk(92, 138, 110, 136, 2.2);
    }, prop: function () { return P('M100 150 Q92 152 92 162 L90 166 L110 166 L108 162 Q108 152 100 150 Z', 'fill="#E8E8EE" stroke="#8D98A6" stroke-width="1.5"') + C(100, 168, 2.4, 'fill="#8D98A6"'); } }
  };

  // 종마다 표정: angry(노려봄) · skeptic(한쪽 눈썹) · bored(무심) · calm(여유) · grim(굳은 입) · grin(이 드러낸 웃음)
  var EXP = { corgi: 'angry', shiba: 'bored', hamster: 'skeptic', rabbit: 'skeptic', bear: 'grim', hedgehog: 'grin', duck: 'angry', frog: 'calm',
    ragdoll: 'skeptic', siamese: 'calm', fox: 'skeptic', penguin: 'bored', monkey: 'grin', squirrel: 'skeptic', koala: 'bored', raccoon: 'grin',
    owl: 'angry', otter: 'calm', panda: 'grim', tiger: 'grin', sheep: 'calm', pig: 'angry', redpanda: 'skeptic', alpaca: 'skeptic', seal: 'calm',
    hippo: 'calm', turtle: 'bored', mouse: 'angry', lion: 'grim', deer: 'calm' };
  // 머리 기울기(왼쪽 · 오른쪽 번갈아, 정면 고정 느낌을 없앤다)
  var TILT = { corgi: -6, shiba: 0, hamster: 5, rabbit: -5, bear: 4, hedgehog: -7, duck: 5, frog: 0, ragdoll: -4, siamese: 6, fox: -6, penguin: 3, monkey: 6, squirrel: -5,
    koala: 5, raccoon: -6, owl: 0, otter: 5, panda: -4, tiger: 4, sheep: -4, pig: 5, redpanda: -6, alpaca: 0, seal: -5, hippo: 5, turtle: -3, mouse: 6, lion: -3, deer: 4 };
  function draw(id, o) {
    o = o || {}; var s = SP[id]; if (!s) return '';
    var grade = o.grade || 'r'; D = []; N = 'h' + (++uid); EX = EXP[id] || 'angry';
    var bg = BG[s.bg].apply(null, s.bgArgs || []) + '<rect width="200" height="200" fill="#000" opacity=".38"/>';
    var body = OUT[s.out[0]](s.out[1] || {});
    var head = s.head();
    var prop = s.prop ? s.prop() : '';
    var tl = TILT[id] || 0;
    // 머리 · 소품을 86%로 줄여 넓은 어깨 위에(목 100,146 기준), 살짝 기울인다
    var fig = body + '<g transform="translate(100 150) rotate(' + tl + ') scale(.86) translate(-100 -146)">' + head + '</g>' + prop + badge(grade);
    // 갈라진 빛: 왼쪽 위 따뜻한 키 라이트, 오른쪽 반은 그림자(얼굴 반쪽이 어둠 속)
    var key = '<rect width="200" height="200" fill="' + lg([[0, '#FFD9A0', .16], [.45, '#FFD9A0', 0]], 1, .25) + '"/>';
    var dark = '<rect width="200" height="200" fill="' + lg([[0, '#000', 0], [.5, '#000', 0], [.62, '#05040A', .42], [1, '#05040A', .62]], 1, .1) + '"/>';
    var gold = grade === 'l' ? '<rect x="2" y="2" width="196" height="196" rx="17" fill="none" stroke="#E0B23A" stroke-width="3"/>' : '';
    var w = o.size || 200;
    return '<svg viewBox="0 0 200 200" width="' + w + '" height="' + w + '" xmlns="http://www.w3.org/2000/svg"><defs>' + D.join('') + '<clipPath id="' + N + 'cl"><rect width="200" height="200" rx="18"/></clipPath></defs>' +
      '<g clip-path="url(#' + N + 'cl)">' + bg + '<g class="nz-body">' + fig + key + dark + '</g>' + vig() + '</g>' + gold + '</svg>';
  }
  var IDS = Object.keys(SP);
  return { draw: draw, ids: IDS, has: function (id) { return !!SP[id]; }, codename: function (id) { return SP[id] ? SP[id].cn : ''; }, line: function (id) { return SP[id] ? SP[id].line : ''; } };
});
