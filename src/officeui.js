/*
 * Team3OfficeUI — 살아 있는 사무실(0.6.0). 사무실 화면 "3팀" 칸 위에 그리는 장면. 규칙은 office.js · idle.js.
 *
 * 장면
 *   벽: 창 두 개(밖은 계절 · 날씨 · 낮저녁밤 — office.weather), 실제 시각 벽시계, 코르크 보드(사건 진척만큼 사진 · 팀 한계면 붉은 쪽지)
 *   바닥: 책상 최대 8개(형사 수만큼). 형사마다 생김새가 다르고 타자를 친다. 머리 위 동그라미 = 그 형사 차례의 검거까지
 *         (팀 검거는 책상을 돌아가며 맡는다: 실제 다음 검거까지의 몫으로 차례 책상의 동그라미가 찬다 — 화면과 실제 검거가 맞물림)
 *   검거하면: 그 책상에서 용의자가 유치장으로 걸어가고, 수사비가 튄다.
 *   유치장(20명) · 이송 단추: 누르면 호송차가 지나가며 모인 만큼 보너스.
 *   책상을 누르면 커피(5분에 한 번): 수사비 + 유치장 1명.
 *   파트너 동물(마스코트): 걷기 · 뛰기 · 깡충 · 냄새 맡기 · 책상 구경 · 앉기 · 졸기(밤). 동전이 튀면 쫓아가기도. 누르면 쓰다듬기.
 *   말풍선: 동물과 형사가 번갈아 하나씩(상황 대사: 밤 · 날씨 · 유치장 가득 · 사기 충전 · 팀 한계).
 *   사기 충전 · 회식 중이면 책상에 불꽃 테두리, 타자가 빨라진다. 밤이면 책상 스탠드.
 *
 * 규칙: 그림이 실패해도 게임은 그대로(모든 연출은 try 로 감싼다). 움직임 줄이기 설정이면 걷기 · 날씨 입자를 거의 없앤다.
 * hub.js 와의 약속: mount(ctx) · render() · caught(n) · tick(now)   ctx = { getSave, persist, render, UI, idle, pets, art, petsUI, caseNo(), progress(), capped(), buffed(now) }
 */
(function (root) {
  'use strict';
  var OF = root.Team3Office;
  var ctx = null, box = null, built = '', raf = 0, petT = 0, talkT = 0, lastFrac = 0;
  var $ = function (id) { return document.getElementById(id); };
  function S() { return ctx.getSave(); }
  function reduce() { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function fmt(n) { return Math.floor(n).toLocaleString('ko-KR'); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function rel(a) { var r = a.getBoundingClientRect(), b = box.getBoundingClientRect(); return { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height }; }
  function later(fn, ms) { return setTimeout(function () { try { fn(); } catch (e) { /* 연출 실패는 무시 */ } }, ms); }

  /* ---------- 형사 그림(0.6.0, 모찌 그림체: 동물 그림과 같은 둥근 실루엣 · 외곽선 · 큰 눈 · 볼터치) ----------
   * 책상 번호마다 생김새가 다르다: 피부 3 · 머리 모양 5 · 머리색 4 · 코트 4 · 넥타이 3, 가끔 중절모 · 안경.
   * 그림 칸 0 0 100 100(책상 위로 허리까지 보인다). 손은 책상 그림 쪽(키보드 위)에서 따로 그린다.
   */
  var INK = '#2B211C';
  var SKIN = [['#FFE6D2', '#F3C7A6'], ['#F7D2B0', '#E2A982'], ['#E2AE85', '#C1835A']];
  var HAIR = ['#3A2A22', '#1F1B1A', '#6B4429', '#8A5A33'];
  var COAT = [['#D9BC8C', '#B8955F'], ['#4A5E85', '#33425F'], ['#7C8494', '#5A6170'], ['#8E5A43', '#6A3F2D']];
  var TIE = ['#E5484F', '#2F6FD6', '#2E9E5B'];
  var gradDone = {};
  function copGrad(i) {
    var k = i % 3, c = (i * 5 + 2) % 4;
    return '<defs><radialGradient id="ofSk' + i + '" cx="38%" cy="30%" r="75%"><stop offset="0" stop-color="' + SKIN[k][0] + '"/><stop offset="1" stop-color="' + SKIN[k][1] + '"/></radialGradient>' +
      '<linearGradient id="ofCt' + i + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + COAT[c][0] + '"/><stop offset="1" stop-color="' + COAT[c][1] + '"/></linearGradient></defs>';
  }
  function hairBack(st, hr) {
    if (st === 3) return '<path d="M20 44c-4 18 0 30 8 36h44c8-6 12-18 8-36z" fill="' + hr + '" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>';   // 긴 머리
    if (st === 4) return '<circle cx="50" cy="13" r="9" fill="' + hr + '" stroke="' + INK + '" stroke-width="2.5"/>';   // 똥머리
    return '';
  }
  function hairFront(st, hr) {
    switch (st) {
      case 0: return '<path d="M22 44c-1-17 12-27 28-27s29 10 28 27c-6-7-14-10-22-10-2 4-6 6-10 6 2-2 2-4 1-6-9 1-17 5-25 10z" fill="' + hr + '" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>';   // 가르마
      case 1: return '<path d="M22 42c0-15 12-25 28-25s28 10 28 25l-5-4-4 5-5-6-5 6-5-6-5 6-5-6-4 5z" fill="' + hr + '" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>';   // 앞머리
      case 2: return '<path d="M23 40c-2-13 10-24 27-24 17 0 29 11 27 24l-4-3-3-9-6 7-4-9-5 8-5-8-4 9-6-7-3 9z" fill="' + hr + '" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>';   // 뻗친 머리
      case 3: return '<path d="M22 46c-1-18 12-29 28-29s29 11 28 29c-7-9-17-13-28-13s-21 4-28 13z" fill="' + hr + '" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>';
      default: return '<path d="M22 44c-1-17 12-27 28-27s29 10 28 27c-8-6-18-9-28-9s-20 3-28 9z" fill="' + hr + '" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>';
    }
  }
  function cop(i) {
    var st = (i * 7 + 3) % 5, hr = HAIR[(i * 3 + 1) % 4], tie = TIE[i % 3], hat = i % 4 === 1, gl = i % 3 === 2;
    var sk = 'url(#ofSk' + i + ')', ct = 'url(#ofCt' + i + ')';
    return '<svg viewBox="0 0 100 100" aria-hidden="true">' + copGrad(i) +
      // 몸(트렌치코트) · 셔츠 · 넥타이 · 깃
      '<path d="M14 100c0-20 14-32 36-32s36 12 36 32z" fill="' + ct + '" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<path d="M41 69l9 14 9-14z" fill="#FBF7EE" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M50 76l-3.5 5 3.5 13 3.5-13z" fill="' + tie + '" stroke="' + INK + '" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="M36 70l7 16-9 2zM64 70l-7 16 9 2z" fill="' + ct + '" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round" opacity=".95"/>' +
      '<path d="M28 88h8M64 88h8" stroke="rgba(0,0,0,.25)" stroke-width="2" stroke-linecap="round"/>' +
      // 머리(모찌: 살짝 납작한 큰 원)
      hairBack(st, hr) +
      '<ellipse cx="50" cy="45" rx="28" ry="26" fill="' + sk + '" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<ellipse cx="22.5" cy="48" rx="4" ry="5.5" fill="' + sk + '" stroke="' + INK + '" stroke-width="2"/><ellipse cx="77.5" cy="48" rx="4" ry="5.5" fill="' + sk + '" stroke="' + INK + '" stroke-width="2"/>' +
      hairFront(st, hr) +
      // 눈(반짝임 두 개) · 깜빡임
      '<g class="blink"><ellipse cx="40" cy="50" rx="4.3" ry="5.2" fill="' + INK + '"/><ellipse cx="60" cy="50" rx="4.3" ry="5.2" fill="' + INK + '"/>' +
      '<circle cx="38.6" cy="48" r="1.7" fill="#fff"/><circle cx="58.6" cy="48" r="1.7" fill="#fff"/><circle cx="41.4" cy="52.4" r=".8" fill="#fff"/><circle cx="61.4" cy="52.4" r=".8" fill="#fff"/></g>' +
      (gl ? '<g fill="rgba(200,230,255,.25)" stroke="' + INK + '" stroke-width="1.8"><circle cx="40" cy="50" r="8"/><circle cx="60" cy="50" r="8"/></g><path d="M48 50h4" stroke="' + INK + '" stroke-width="1.8"/>' : '') +
      '<ellipse cx="31" cy="58" rx="5" ry="3" fill="#FF9BA8" opacity=".55"/><ellipse cx="69" cy="58" rx="5" ry="3" fill="#FF9BA8" opacity=".55"/>' +
      '<path d="M46 59q2 2.4 4 0q2 2.4 4 0" stroke="' + INK + '" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
      // 중절모
      (hat ? '<path d="M30 27c0-11 9-17 20-17s20 6 20 17z" fill="#4A3F36" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/><path d="M31 23h38" stroke="#C9A97A" stroke-width="4"/><path d="M16 29q34 -8 68 0" stroke="' + INK + '" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M16 29q34 -8 68 0" stroke="#4A3F36" stroke-width="3.6" stroke-linecap="round" fill="none"/>' : '') +
      '</svg>';
  }
  // 용의자(게임 카드 그림의 실루엣) — ui.js 와 같은 figure 를 못 쓰므로 단순화한 작은 그림
  function suspect(k) {
    var hat = k % 3, face = Math.floor(k / 3) % 3;
    // 죄수복(주황) · 밝은 피부 — 어두운 유치장에서도 보이게. 모자 · 얼굴은 게임 카드의 세 가지와 같은 계열
    return '<svg viewBox="0 0 30 34" aria-hidden="true"><path d="M4 34c0-8 5-12 11-12s11 4 11 12z" fill="#F08A3C"/><path d="M7 27h16M6 31h18" stroke="#C9692A" stroke-width="1.3"/><circle cx="15" cy="14" r="7.5" fill="#F2D3B6"/>' +
      (hat === 1 ? '<path d="M8 12c0-5 3-8 7-8s7 3 7 8z" fill="#3D4E6E"/><circle cx="15" cy="4" r="2" fill="#3D4E6E"/>' : hat === 2 ? '<path d="M9.5 10l1.5-6h8l1.5 6z" fill="#3A332C"/><path d="M5 10.5h20" stroke="#3A332C" stroke-width="2.4" stroke-linecap="round"/>' : '<path d="M8 13c0-5 3-7.5 7-7.5s7 2.5 7 7.5c-2-2-4.5-3-7-3s-5 1-7 3z" fill="#2B2420"/>') +
      (face === 1 ? '<circle cx="12" cy="15" r="2.4" fill="none" stroke="#1B1E24" stroke-width="1.2"/><circle cx="18" cy="15" r="2.4" fill="none" stroke="#1B1E24" stroke-width="1.2"/>' : face === 2 ? '<rect x="9.5" y="15.5" width="11" height="5" rx="2" fill="#9FD8FF" stroke="#1B1E24" stroke-width=".8"/>' : '') +
      '<circle cx="12.3" cy="14.6" r="1" fill="#1B1E24"/><circle cx="17.7" cy="14.6" r="1" fill="#1B1E24"/></svg>';
  }
  /* ---------- 관제실(0.6.0 v2): 뒤에서 내려다보는 3/4 원근 ----------
   * 정면 곡면 상황판(사건 지도 · CCTV · 검거 현황 · 유치장 · 날씨 시계) / 계단식 곡선 책상 3줄(뒷줄 3 · 가운데 3 · 앞줄 2)
   * 형사는 상황판을 보고 앉아 뒷모습. 앞줄이 크고 뒤로 갈수록 작다. 모니터 불빛이 형사를 비춘다.
   * 자리 순서: 앞줄부터 채운다(가장 잘 보이는 곳). 좌표는 장면 폭 · 높이의 % (화면 폭이 달라도 같은 구도)
   */
  var SEATS = [   // { x 가운데 %, y 의자 아래 %, s 크기 }
    { x: 33, y: 92, s: 1 }, { x: 67, y: 92, s: 1 },
    { x: 19, y: 74, s: 0.8 }, { x: 50, y: 76, s: 0.8 }, { x: 81, y: 74, s: 0.8 },
    { x: 25, y: 59, s: 0.64 }, { x: 50, y: 60, s: 0.64 }, { x: 75, y: 59, s: 0.64 }
  ];
  // 형사 뒷모습(그림 칸 0 0 100 100): 의자 등받이 · 어깨 · 뒤통수(머리 모양 · 색) · 가끔 헤드셋 · 중절모
  function opBack(i) {
    var hr = HAIR[(i * 3 + 1) % 4], st = (i * 7 + 3) % 5, c = COAT[(i * 5 + 2) % 4], hat = i % 4 === 1, set = i % 3 === 0, sk = SKIN[i % 3][1];
    return '<svg viewBox="0 0 100 100" aria-hidden="true">' +
      '<path d="M18 100c0-22 14-34 32-34s32 12 32 34z" fill="' + c[1] + '" stroke="#0B0E14" stroke-width="2.5"/>' +
      '<path d="M50 70v30" stroke="rgba(0,0,0,.35)" stroke-width="2"/><path d="M38 68q12 6 24 0" stroke="' + c[0] + '" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="25" cy="50" rx="4" ry="5.5" fill="' + sk + '" stroke="#0B0E14" stroke-width="2"/><ellipse cx="75" cy="50" rx="4" ry="5.5" fill="' + sk + '" stroke="#0B0E14" stroke-width="2"/>' +
      '<ellipse cx="50" cy="44" rx="26" ry="25" fill="' + hr + '" stroke="#0B0E14" stroke-width="2.5"/>' +
      '<path d="M32 30q18-12 36 0" stroke="rgba(255,255,255,.18)" stroke-width="4" fill="none" stroke-linecap="round"/>' +
      (st === 3 ? '<path d="M26 52c-2 14 2 20 8 24h32c6-4 10-10 8-24" fill="' + hr + '" stroke="#0B0E14" stroke-width="2.5"/>' : '') +
      (st === 4 ? '<circle cx="50" cy="20" r="9" fill="' + hr + '" stroke="#0B0E14" stroke-width="2.5"/>' : '') +
      (set ? '<path d="M24 46q26-34 52 0" stroke="#1B1E24" stroke-width="4" fill="none"/><rect x="18" y="42" width="9" height="14" rx="4" fill="#1B1E24"/><rect x="73" y="42" width="9" height="14" rx="4" fill="#1B1E24"/>' : '') +
      (hat ? '<path d="M30 30c0-11 9-17 20-17s20 6 20 17z" fill="#4A3F36" stroke="#0B0E14" stroke-width="2.5"/><path d="M31 26h38" stroke="#C9A97A" stroke-width="4"/><ellipse cx="50" cy="32" rx="34" ry="6" fill="#4A3F36" stroke="#0B0E14" stroke-width="2.5"/>' : '') +
      // 모니터 쪽에서 오는 푸른 테두리 빛(머리 윗선)
      '<path d="' + (hat ? 'M18 31q32 -10 64 0' : 'M27 30q23 -20 46 0') + '" stroke="#9FE0FF" stroke-width="2" fill="none" opacity=".7" stroke-linecap="round"/>' +
      // 메시 의자: 등받이(몸 아래쪽을 가린다) · 팔걸이
      '<path d="M22 100V80q0-9 9-10h38q9 1 9 10v20z" fill="#141B27" stroke="#0B0E14" stroke-width="2.5"/>' +
      '<path d="M26 78h48M26 85h48M26 92h48" stroke="#22304A" stroke-width="1.4"/><path d="M34 72v28M50 71v29M66 72v28" stroke="#22304A" stroke-width="1.2"/>' +
      '<path d="M29 72q21-4 42 0" stroke="#3FA8D8" stroke-width="1.2" fill="none" opacity=".5"/>' +
      '<rect x="10" y="84" width="10" height="16" rx="3" fill="#1B2433" stroke="#0B0E14" stroke-width="2"/><rect x="80" y="84" width="10" height="16" rx="3" fill="#1B2433" stroke="#0B0E14" stroke-width="2"/>' +
      '</svg>';
  }
  // 모니터 세 대(가운데 큰 것) — 화면 무늬는 자리마다 다르게(지도 · 그래프 · 글줄)
  function monitors(i) {
    var kinds = ['map', 'graph', 'text'], a = kinds[i % 3], b = kinds[(i + 1) % 3], c = kinds[(i + 2) % 3];
    return '<span class="mo l ' + a + '"></span><span class="mo c ' + b + '"></span><span class="mo r ' + c + '"></span>';
  }

  /* ---------- 만들기 ---------- */
  function deskN() { return OF.deskCount(S()); }
  function key() { var s = S(); return deskN() + '|' + s.caseNo + '|' + (s.pets && s.pets.eq || ''); }
  var MAPS = {   // 사건마다 상황판 지도(그림 칸 0 0 200 90)
    1: '<path d="M0 30h200M0 62h200M40 0v90M96 0v90M150 0v90M0 12l60 78M120 0l80 70" stroke="#2A6F9E" stroke-width="2.5" fill="none" opacity=".8"/><path d="M10 40h22v14H10zM104 70h38v14h-38zM160 8h30v16h-30z" fill="#1C4A6E"/>',
    2: '<path d="M0 54q40-10 70 6t70 0 60 10V90H0z" fill="#123D5C"/><path d="M0 54q40-10 70 6t70 0 60 10" stroke="#3FA8D8" stroke-width="2" fill="none"/><path d="M30 20h40M90 30h60M60 8v40M120 10v40" stroke="#2A6F9E" stroke-width="2.5"/><path d="M150 62l14 10M168 58l10 14" stroke="#7FD3FF" stroke-width="2"/>',
    3: '<path d="M0 20h200M0 46h200M0 72h200M28 0v90M72 0v90M120 0v90M168 0v90" stroke="#2A6F9E" stroke-width="2" fill="none" opacity=".8"/><circle cx="96" cy="46" r="20" fill="none" stroke="#3FA8D8" stroke-width="2" stroke-dasharray="4 4"/><path d="M84 34h24v24H84z" fill="#1C4A6E"/>'
  };
  function build() {
    var n = deskN(), s = S(), no = s.caseNo, html = '';
    html += '<svg class="cr-room" viewBox="0 0 360 420" preserveAspectRatio="none" aria-hidden="true">' +
      '<defs><linearGradient id="crBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0B1424"/><stop offset=".45" stop-color="#0E1A2E"/><stop offset="1" stop-color="#070B13"/></linearGradient>' +
      '<linearGradient id="crBeam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#BFE6FF" stop-opacity=".16"/><stop offset="1" stop-color="#BFE6FF" stop-opacity="0"/></linearGradient>' +
      '<linearGradient id="crRefl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3FA8D8" stop-opacity=".35"/><stop offset="1" stop-color="#3FA8D8" stop-opacity="0"/></linearGradient>' +
      '<filter id="crBlur" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter>' +
      '<radialGradient id="crGlow" cx="50%" cy="22%" r="60%"><stop offset="0" stop-color="#3FA8D8" stop-opacity=".35"/><stop offset="1" stop-color="#3FA8D8" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="crFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0E1828"/><stop offset="1" stop-color="#05080E"/></linearGradient></defs>' +
      '<rect width="360" height="420" fill="url(#crBg)"/>' +
      // 천장 조명 레일(가운데로 모이는 선)
      '<g stroke="#1E3654" stroke-width="2">' + [-140, -70, 0, 70, 140].map(function (d) { return '<line x1="' + (180 + d * 1.8) + '" y1="0" x2="' + (180 + d * 0.5) + '" y2="22"/>'; }).join('') + '</g>' +
      '<path d="M0 22h360" stroke="#1E3654" stroke-width="2"/><g fill="#7FD3FF" opacity=".8"><rect x="60" y="20" width="40" height="2"/><rect x="160" y="20" width="40" height="2"/><rect x="260" y="20" width="40" height="2"/></g>' +
      '<rect width="360" height="420" fill="url(#crGlow)"/>' +
      // 천장 빛줄기(아주 옅게)
      '<g fill="url(#crBeam)">' + [80, 180, 280].map(function (x) { return '<path d="M' + (x - 14) + ' 22L' + (x + 14) + ' 22L' + (x + 58) + ' 420L' + (x - 58) + ' 420z"/>'; }).join('') + '</g>' +
      // 옆벽 작은 모니터 격자(원근으로 기울게): 왼쪽 · 오른쪽 3단
      [0, 1, 2].map(function (r) {
        var y = 64 + r * 44, out = '';
        for (var c = 0; c < 2; c++) {
          var x0 = 2 + c * 18, x1 = x0 + 15, skew = 4 + c * 2;
          var lit = (r + c) % 3 === 0 ? '#1E5A85' : '#123D5C';
          out += '<path d="M' + x0 + ' ' + (y + c * 3) + 'L' + x1 + ' ' + (y + c * 3 + skew / 2) + 'L' + x1 + ' ' + (y + 36 - c * 3 - skew / 2) + 'L' + x0 + ' ' + (y + 36 - c * 3) + 'z" fill="' + lit + '" stroke="#3FA8D8" stroke-width=".8" stroke-opacity=".7"/>';
          out += '<path d="M' + (360 - x0) + ' ' + (y + c * 3) + 'L' + (360 - x1) + ' ' + (y + c * 3 + skew / 2) + 'L' + (360 - x1) + ' ' + (y + 36 - c * 3 - skew / 2) + 'L' + (360 - x0) + ' ' + (y + 36 - c * 3) + 'z" fill="' + lit + '" stroke="#3FA8D8" stroke-width=".8" stroke-opacity=".7"/>';
        }
        return out;
      }).join('') +
      // 바닥(광택 · 앞으로 갈수록 어둡게) · 바닥 띠 조명
      '<path d="M0 205L360 205L360 420L0 420z" fill="url(#crFloor)"/>' +
      '<path d="M0 205h360" stroke="#1E3654" stroke-width="1.5"/>' +
      // 바닥에 비친 상황판 빛
      '<path d="M30 206L330 206L360 268L0 268z" fill="url(#crRefl)"/>' +
      '<path d="M-20 300q200 -40 400 0" stroke="#3FA8D8" stroke-width="1.5" fill="none" opacity=".35"/><path d="M-20 370q200 -44 400 0" stroke="#3FA8D8" stroke-width="1.5" fill="none" opacity=".25"/>' +
      // 옆벽 작은 화면들(원근으로 기울게)
      '<g opacity=".9"><path d="M4 70L40 78L40 128L4 136z" fill="#123D5C" stroke="#3FA8D8" stroke-width="1"/><path d="M356 70L320 78L320 128L356 136z" fill="#123D5C" stroke="#3FA8D8" stroke-width="1"/>' +
      '<path d="M4 146L40 148L40 188L4 194z" fill="#0F2E47" stroke="#2A6F9E" stroke-width="1"/><path d="M356 146L320 148L320 188L356 194z" fill="#0F2E47" stroke="#2A6F9E" stroke-width="1"/></g>' +
      // 책상줄(곡선): 뒷줄 · 가운데 · 앞줄 — 위 판 · 앞면
      // 책상줄은 모니터 받침 높이에 맞춘다(자리 높이 96 × 크기 중 모니터 아래 = 의자 아래 − 56×크기): 뒷줄 212 · 가운데 274 · 앞줄 330
      [[212, 7, 18], [276, 9, 22], [332, 12, 26]].map(function (r, k) {
        var y = r[0], t = r[1], c = r[2];
        return '<path d="M-10 ' + (y + c / 2) + 'Q180 ' + (y - c) + ' 370 ' + (y + c / 2) + 'L370 ' + (y + c / 2 + t) + 'Q180 ' + (y - c + t) + ' -10 ' + (y + c / 2 + t) + 'Z" fill="' + ['#22385A', '#284268', '#2E4C78'][k] + '"/>' +
          '<path d="M-10 ' + (y + c / 2 + t) + 'Q180 ' + (y - c + t) + ' 370 ' + (y + c / 2 + t) + 'L370 ' + (y + c / 2 + t + t * 1.6) + 'Q180 ' + (y - c + t + t * 1.6) + ' -10 ' + (y + c / 2 + t + t * 1.6) + 'Z" fill="' + ['#111B2C', '#14203A', '#172644'][k] + '"/>' +
          '<path d="M-10 ' + (y + c / 2) + 'Q180 ' + (y - c) + ' 370 ' + (y + c / 2) + '" stroke="#3FA8D8" stroke-width="1.2" fill="none" opacity=".55"/>' +
          // 줄 앞 유리 난간 아래 LED 띠(번짐)
          '<path d="M-10 ' + (y + c / 2 + t * 2.6) + 'Q180 ' + (y - c + t * 2.6) + ' 370 ' + (y + c / 2 + t * 2.6) + '" stroke="#5FC4F0" stroke-width="3" fill="none" filter="url(#crBlur)" opacity=".85"/>' +
          '<path d="M-10 ' + (y + c / 2 + t * 2.6) + 'Q180 ' + (y - c + t * 2.6) + ' 370 ' + (y + c / 2 + t * 2.6) + '" stroke="#BFE6FF" stroke-width="1" fill="none" opacity=".9"/>';
      }).join('') +
      '</svg>';
    // 정면 곡면 상황판: 왼쪽(CCTV · 날씨 시계) / 가운데(사건 지도) / 오른쪽(검거 현황 · 유치장 + 이송) / 아래 글줄
    html += '<div class="cr-wall" id="of-wall"><span class="cr-title">3팀 종합 상황실 ' + esc(ctx.idle.caseOf(s).city) + '</span><div class="cr-scr">' +
      '<div class="cr-col"><div class="cr-cctv" aria-hidden="true"><b>CCTV</b><i class="rec"></i><span class="f"></span><span class="f"></span><span class="f"></span><span class="f"></span></div>' +
        '<div class="cr-wx" id="of-wx"><span class="cr-wxwin"><i class="of-sky"></i><i class="of-fx" id="of-fx"></i></span><span class="cr-wxtx"><b id="of-clock">--:--</b><small id="of-season"></small></span></div></div>' +
      '<div class="cr-map"><svg viewBox="0 0 200 90" preserveAspectRatio="none" aria-hidden="true">' + (MAPS[no] || MAPS[1]) + '</svg><span class="cr-sweep"></span><span class="cr-dots" id="of-dots"></span>' +
        '<b class="cr-case" id="of-case"></b><span class="cr-van" id="of-van" aria-hidden="true"><svg viewBox="0 0 30 16"><rect x="1" y="2" width="20" height="10" rx="2" fill="#F4EFE2"/><path d="M21 5h5l3 4v3h-8z" fill="#F4EFE2"/><rect x="1" y="6" width="20" height="2" fill="#2F6FD6"/><rect x="8" y="0" width="6" height="2" fill="#E5484F"/><circle cx="7" cy="13" r="2.4" fill="#0B0E14"/><circle cx="23" cy="13" r="2.4" fill="#0B0E14"/></svg></span></div>' +
      '<div class="cr-col"><div class="cr-stat"><small>검거 현황</small><b id="of-pct">0%</b><i class="bar"><i id="of-pbar"></i></i><span class="cr-spark" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span></div>' +
        '<div class="of-cell" id="of-cell"><span class="of-tag" id="of-tag">유치장</span><div class="of-in" id="of-in"></div>' +
        '<button class="of-send" id="of-send"><b id="of-send-t">이송</b><small id="of-send-s"></small></button></div></div>' +
      '<div class="cr-tick"><span id="of-tick">3팀 상황판, 대기 중</span></div></div></div>';
    // 자리(의자 · 형사 뒷모습 · 모니터): 뒷줄부터 그려야 앞줄이 위에 겹친다
    var order = [5, 6, 7, 2, 3, 4, 0, 1];
    html += '<div class="of-desks" id="of-desks">';
    order.forEach(function (i) {
      var p = SEATS[i], on = i < n;
      html += '<button class="of-desk' + (on ? '' : ' empty') + (p.s < 0.7 ? ' far' : p.s < 0.9 ? ' mid' : '') + '" data-i="' + i + '" style="left:' + p.x + '%;top:' + p.y + '%;--s:' + p.s + '" ' + (on ? 'aria-label="' + esc(OF.copName(s, i)) + ', 이름과 커피"' : 'tabindex="-1" aria-hidden="true"') + '>' +
        '<span class="of-pool" aria-hidden="true"></span><span class="of-mons">' + monitors(i) + '</span>' +
        (on ? '<span class="of-cop">' + opBack(i) + '</span><svg class="of-ring" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle class="f" cx="12" cy="12" r="9" id="of-r' + i + '"/></svg><span class="of-cup" id="of-cup' + i + '" aria-hidden="true"></span>' : '<span class="of-chair"></span>') +
        '</button>';
    });
    html += '</div>' + (s.detectives > 8 ? '<span class="of-more">형사 ' + s.detectives + '명, 화면엔 8자리</span>' : '') +
      '<div class="of-pet" id="of-pet" role="button" tabindex="0" aria-label="파트너 동물 쓰다듬기" hidden><span class="of-pet-in" id="of-pet-in"></span><i class="of-shadow"></i></div>' +
      '<div class="of-bubble" id="of-bubble" hidden></div>';
    box.innerHTML = html;
    built = key();
    drawPet();
    sky(true); cell(); cork();
  }

  /* ---------- 상황판 날씨 · 시계(계절 = 사건 진척, 날씨 20분마다, 낮저녁밤 = 실제 시각) ---------- */
  var lastWeather = '';
  var SEASON_NAME = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' }, KIND_NAME = { petal: '벚꽃', rain: '비', leaf: '낙엽', snow: '눈', clear: '맑음' };
  function sky(force) {
    var s = S(), now = new Date(), w = OF.weather(now, s.caseNo, ctx.progress());
    var k = w.season + w.kind + w.time + (w.fog ? 'f' : '');
    var c = $('of-clock'); if (c) c.textContent = (now.getHours() < 10 ? '0' : '') + now.getHours() + ':' + (now.getMinutes() < 10 ? '0' : '') + now.getMinutes();
    if (!force && k === lastWeather) return;
    lastWeather = k;
    box.setAttribute('data-time', w.time); box.setAttribute('data-season', w.season); box.setAttribute('data-kind', w.kind);
    box.classList.toggle('fog', !!w.fog);
    $('of-season').textContent = SEASON_NAME[w.season] + ' ' + KIND_NAME[w.kind];
    var fx = $('of-fx'), n = reduce() || w.kind === 'clear' ? 0 : Math.round((w.kind === 'rain' ? 12 : 7) * w.amount), html = '';
    for (var i = 0; i < n; i++) {
      var x = Math.round((i * 37) % 100), d = (i * 0.37) % 3, dur = w.kind === 'rain' ? 0.5 + (i % 3) * 0.12 : w.kind === 'snow' ? 3 + (i % 4) * 0.6 : 2.4 + (i % 4) * 0.5;
      html += '<i class="p ' + w.kind + (i % 3 === 0 ? ' b' : '') + (w.kind === 'leaf' && i % 2 ? ' red' : '') + '" style="left:' + x + '%;animation-duration:' + dur + 's;animation-delay:-' + d.toFixed(2) + 's"></i>';
    }
    fx.innerHTML = html;
  }

  /* ---------- 상황판 검거 현황: 사건 진척 %, 지도 위 점(남은 용의자), 팀 한계면 붉은 경고 ---------- */
  function cork() {
    var p = Math.max(0, Math.min(1, ctx.progress())), cs = ctx.idle.caseOf(S());
    var pe = $('of-pct'); if (!pe) return;
    pe.textContent = Math.floor(p * 100) + '%';
    $('of-pbar').style.width = (p * 100).toFixed(1) + '%';
    $('of-case').textContent = '사건 ' + cs.no + ' ' + cs.title;
    var left = Math.max(1, Math.round((1 - p) * 9)), dots = '';
    for (var i = 0; i < left; i++) dots += '<i style="left:' + ((i * 37 + 11) % 88 + 4) + '%;top:' + ((i * 53 + 17) % 70 + 10) + '%;animation-delay:-' + (i * 0.4).toFixed(1) + 's"></i>';
    $('of-dots').innerHTML = dots;
    $('of-wall').classList.toggle('alert', ctx.capped());
    if (ctx.capped()) $('of-tick').textContent = '경고, 주범 조는 현장 출동으로만 검거 가능';
  }

  /* ---------- 유치장(상황판 오른쪽 아래) · 이송 ---------- */
  function cell() {
    var o = S().office || { cell: 0, sent: 0 }, inn = $('of-in'); if (!inn) return;
    var html = '';
    for (var i = 0; i < OF.CELL_CAP; i++) html += '<i class="' + (i < o.cell ? 'on' : '') + '"></i>';
    inn.innerHTML = html;
    $('of-tag').textContent = '유치장 ' + o.cell + '/' + OF.CELL_CAP;
    var full = o.cell >= OF.CELL_CAP;
    $('of-cell').classList.toggle('full', full);
    var b = $('of-send'), pay = ctx.idle.payPerCatch(S());
    b.disabled = o.cell <= 0;
    b.classList.toggle('ready', full);
    $('of-send-t').textContent = full ? '이송!' : '이송';
    $('of-send-s').textContent = o.cell ? '+' + fmt(o.cell * pay * OF.TRANSFER_MULT) : '비었어요';
    // 0.10.5 프리미엄 패스: 유치장이 꽉 차면 호송차가 알아서 온다
    var MO = root.Team3Monet;
    if (full && !autoSending && ((MO && ctx.dayNow && S().shop && MO.premOn(S(), ctx.dayNow())) || (S().escortUntil || 0) > Date.now())) { autoSending = true; later(function () { autoSending = false; send(true); }, 600); }   // 0.10.9 지원 '호송 지원' 중에도 }, 600); }
  }
  var autoSending = false;
  function send(auto) {
    var s = S(), r;
    try { r = OF.transfer(s, ctx.idle.payPerCatch(s)); } catch (e) { return; }
    if (root.Team3Evidence) root.Team3Evidence.earn(s, r.bonus);   // 0.7.0 번 수사비(재수사 단서)
    ctx.persist();
    var v = $('of-van'); v.classList.remove('go'); void v.offsetWidth; v.classList.add('go');
    $('of-tick').textContent = (auto ? '자동 이송, ' : '호송차 출발, ') + r.n + '명 이송';
    try { ctx.UI.sfx.coin(); } catch (e) { /* 무시 */ }
    ctx.UI.buzz([10, 30, 10]);
    later(function () { cell(); burst(rel($('of-send')), '+' + fmt(r.bonus), true); ctx.render(); }, 700);
    later(function () { say(pickCop(), ['이송 완료!', '호송차 출발합니다!', '유치장 정리 끝!'][Math.floor(Math.random() * 3)]); }, 1300);
  }
  function burst(at, text, big) {
    var c = document.createElement('span'); c.className = 'of-coin' + (big ? ' big' : ''); c.textContent = text;
    c.style.left = (at.x + at.w / 2) + 'px'; c.style.top = (at.y + 6) + 'px';
    box.appendChild(c); later(function () { c.remove(); }, big ? 1400 : 1000);
  }

  /* ---------- 검거 연출: 그 자리 모니터가 번쩍, 머그샷이 상황판 유치장으로 날아간다 ---------- */
  function deskEl(i) { return box && box.querySelector('.of-desk[data-i="' + i + '"]'); }
  function walk(fromDesk, k) {
    var d = deskEl(fromDesk), c = $('of-cell'); if (!d || !c) return;
    var a = rel(d), b = rel(c);
    var w = document.createElement('span'); w.className = 'of-walker'; w.innerHTML = suspect(k);
    w.style.left = (a.x + a.w / 2 - 12) + 'px'; w.style.top = (a.y - 10) + 'px';
    box.appendChild(w);
    $('of-tick').textContent = '검거, ' + (fromDesk + 1) + '번 자리, ' + new Date().toTimeString().slice(0, 5);
    if (reduce()) { w.remove(); cell(); return; }
    requestAnimationFrame(function () { requestAnimationFrame(function () { w.classList.add('go'); w.style.left = (b.x + b.w / 2 - 12) + 'px'; w.style.top = (b.y + 4) + 'px'; }); });
    later(function () { w.remove(); cell(); var cc = $('of-cell'); cc.classList.remove('ping'); void cc.offsetWidth; cc.classList.add('ping'); }, 950);
    petChase(a.x + a.w / 2);
  }
  /** 팀이 n명을 잡았을 때(hub tick). 유치장 반영은 hub 가 office.addCatches 로 이미 했다 */
  function caught(n) {
    if (!box || !n) return;
    var D = deskN(); if (!D) return;
    var s = S(), pay = ctx.idle.payPerCatch(s), shown = Math.min(3, n);
    for (var j = 0; j < shown; j++) (function (j) {
      later(function () {
        var desk = ((s.teamCaught - n + j) % D + D) % D, d = deskEl(desk);
        if (d) { d.classList.remove('done'); void d.offsetWidth; d.classList.add('done'); burst(rel(d), '+' + fmt(pay * (j === shown - 1 ? n - shown + 1 : 1))); }
        walk(desk, (s.teamCaught + j * 5) % 27);
      }, j * 260);
    })(j);
    if (n === 1 && Math.random() < 0.18) later(function () { say(pickCop(), ['한 명 더!', '잡았다!', '이 사람 맞죠?', '알리바이 깨졌어요!'][Math.floor(Math.random() * 4)]); }, 500);
  }

  /* ---------- 커피 ---------- */
  /* 0.10.5 형사를 누르면: 이름 · 이름 바꾸기(무료) · 커피 주기 */
  function copPop(i) {
    var s = S(), left = Math.ceil(OF.coffeeLeft(s, i, Date.now()));
    if (!ctx.openInfo) { coffee(i); return; }
    var nm = OF.copName(s, i);
    ctx.openInfo({ label: (i + 1) + '번 자리, 3팀 형사', title: nm,
      body: '<div class="of-pop"><label class="of-pop-l">이름 바꾸기 <small>(무료, ' + OF.NAME_MAX + '자까지)</small></label>' +
        '<div class="of-pop-r"><input id="of-nm" maxlength="' + (OF.NAME_MAX * 2) + '" autocomplete="off"><button class="ghost" id="of-nm-ok" data-i="' + i + '">저장</button></div>' +
        '<p class="muted" style="font-size:13px">' + (left > 0 ? '☕ 커피는 ' + (left >= 60 ? Math.ceil(left / 60) + '분' : left + '초') + ' 뒤에 줄 수 있어요' : '☕ 커피를 주면 바로 1명을 더 잡아 유치장에 넣어요') + '</p></div>',
      ok: left > 0 ? '확인' : '☕ 커피 주기', cancel: left > 0 ? null : '닫기',
      onOk: function () { if (left <= 0) coffee(i); } });
    var inp = $('of-nm'); if (inp) inp.value = nm;
  }
  function saveCopName(i) {
    var inp = $('of-nm'); if (!inp) return;
    var v = OF.renameCop(S(), i, inp.value);
    ctx.persist();
    var tt = $('info-title'); if (tt) tt.textContent = v;
    inp.value = v;
    try { ctx.UI.toast('이름을 "' + v + '"(으)로 바꿨어요'); } catch (e) { /* 무시 */ }
  }
  /* 0.10.9 커피 돌리기: 누른 자리부터, 커피를 마실 수 있는 자리 모두에게 한 번에. 아무도 못 마시면 누른 형사가 한마디 */
  function coffeeAll(i) {
    var s = S(), now = Date.now(), n = OF.deskCount ? OF.deskCount(s) : OF.DESKS, ready = [];
    for (var k = 0; k < n; k++) if (OF.coffeeLeft(s, k, now) <= 0) ready.push(k);
    if (!ready.length) { coffee(i); return; }
    ready.sort(function (a, b) { return (a === i ? -1 : 0) - (b === i ? -1 : 0); });
    ready.forEach(function (k, j) { later(function () { coffee(k); }, j * 90); });
  }
  function coffee(i) {
    var s = S(), r, now = Date.now();
    try { r = OF.coffee(s, i, now, ctx.idle.payPerCatch(s)); if (root.Team3Evidence) root.Team3Evidence.earn(s, r.gain); }
    catch (e) {
      if (e.code === 'COOLDOWN') { var left = Math.ceil(OF.coffeeLeft(s, i, now) / 60); say({ el: deskEl(i), name: 'cop' }, ['아직 마시는 중이에요', '커피는 ' + left + '분 뒤에요', '배불러요…'][Math.floor(Math.random() * 3)]); }
      return;
    }
    ctx.persist();
    var d = deskEl(i); d.classList.remove('sip'); void d.offsetWidth; d.classList.add('sip');
    burst(rel(d), '커피! +' + fmt(r.gain));
    walk(i, (now >> 3) % 27);
    try { ctx.UI.sfx.pick(2); } catch (e) { /* 무시 */ }
    ctx.UI.buzz(8);
    ctx.render();
  }

  /* ---------- 마스코트(파트너 동물): 상태를 골라 움직인다 ---------- */
  // y: 바닥에서 띄운 높이(px). 끌어서 책상 위 · 상황판 앞에 올려 둘 수 있다. 다음에 걸어갈 때 톡 내려온다
  var pet = { x: 30, y: 2, state: 'idle', face: 1, drawn: '' };
  function drawPet() {
    var p = $('of-pet'), s = S(), eq = s.pets && s.pets.eq, x = ctx.pets && eq ? ctx.pets.parse(eq) : null;
    if (!p) return;
    if (!x || !ctx.art) { p.hidden = true; return; }
    p.hidden = false;
    // 조는 중이면 눈을 감은 그림(mood:'sleep'). 같은 그림이면 다시 그리지 않는다(깜빡임 애니메이션이 끊기지 않게)
    var sleep = pet.state === 'sleep', key = x.id + x.g + (ctx.pets.wearing ? ctx.pets.wearing(s, eq) : '') + (sleep ? 'z' : '');
    if (pet.drawn !== key) { pet.drawn = key; $('of-pet-in').innerHTML = ctx.art.draw(x.id, { grade: x.g, anim: !sleep, mood: sleep ? 'sleep' : null, outfit: ctx.pets.wearing ? ctx.pets.wearing(s, eq) : null }); }
    if (!drag) { p.style.left = pet.x + 'px'; p.style.bottom = pet.y + 'px'; }
  }
  function setPet(state, ms) {
    var p = $('of-pet'); if (!p || p.hidden) return;
    var wasSleep = pet.state === 'sleep';
    p.className = 'of-pet ' + state + (pet.face < 0 ? ' flip' : '') + (pet.y > 4 ? ' air' : '');
    pet.state = state;
    if (wasSleep !== (state === 'sleep')) drawPet();   // 잠들 때 눈 감기 · 깰 때 뜨기
    if (ms) { clearTimeout(petT); petT = later(petAct, ms); }
  }
  function moveTo(x, speed, state) {
    var p = $('of-pet'); if (!p) return 0;
    var W = box.clientWidth - 64; x = Math.max(4, Math.min(W, x));
    var dist = Math.abs(x - pet.x), ms = Math.max(300, dist / speed * 1000);
    pet.face = x < pet.x ? -1 : 1;
    p.style.transitionDuration = ms + 'ms';
    pet.x = x; p.style.left = x + 'px';
    setPet(state);
    return ms;
  }
  function petAct() {
    if (!box || $('of-pet').hidden || drag) return;
    // 높은 곳에 올려 둔 채면: 잠깐 둘러보다가 톡 뛰어내린다
    if (pet.y > 4) { var pp = $('of-pet'); pp.classList.add('drop'); pet.y = 2; pp.style.bottom = '2px'; later(function () { pp.classList.remove('drop'); setPet('hop', 700); }, 380); return; }
    if (reduce()) { setPet('sit', 8000); return; }
    var night = box.getAttribute('data-time') === 'night', r = Math.random(), W = box.clientWidth - 64;
    if (night && r < 0.35) { setPet('sleep', 9000); return; }
    if (r < 0.28) { var ms = moveTo(Math.random() * W, 55, 'walk'); petT = later(function () { setPet('idle', 900 + Math.random() * 1500); }, ms); return; }
    if (r < 0.43) { var ms2 = moveTo(Math.random() * W, 150, 'run'); petT = later(function () { setPet('hop', 700); }, ms2); return; }
    if (r < 0.55) { setPet('hop', 1300); return; }
    if (r < 0.67) { setPet('sniff', 2200); return; }
    if (r < 0.79) {   // 책상 구경: 형사 책상 하나 앞까지 가서 올려다본다
      var D = deskN(); if (D) { var d = deskEl(Math.floor(Math.random() * D)), a = rel(d), ms3 = moveTo(a.x - 6, 70, 'walk'); petT = later(function () { setPet('look', 1800); }, ms3); return; }
    }
    if (r < 0.9) { setPet('sit', 2600); return; }
    setPet('spin', 1100);
  }
  function petChase(x) {
    if (!box || reduce() || $('of-pet').hidden || pet.state === 'sleep' || drag || pet.y > 4 || Math.random() > 0.3) return;
    clearTimeout(petT);
    var ms = moveTo(x - 30, 170, 'run');
    petT = later(function () { setPet('hop', 800); }, ms);
  }
  /* 0.8.0 끌어서 옮기기: 누른 채 6px 넘게 움직이면 집어 든다(그보다 적으면 쓰다듬기). 상황실 안에서만 */
  var drag = null, justDragged = 0;
  function petDown(e) {
    var p = $('of-pet'); if (!p || p.hidden || e.button > 0) return;
    var b = box.getBoundingClientRect(), r = p.getBoundingClientRect();
    drag = { sx: e.clientX, sy: e.clientY, ox: e.clientX - r.left, oy: e.clientY - r.top, b: b, on: false, id: e.pointerId };
  }
  function petMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var p = $('of-pet');
    if (!drag.on) {
      if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) < 6) return;
      drag.on = true; clearTimeout(petT); try { p.setPointerCapture(drag.id); } catch (er) { /* 무시 */ }
      p.className = 'of-pet held'; pet.state = 'held'; pet.drawn = ''; drawPetFace();
    }
    e.preventDefault();
    var b = drag.b, W = b.width - 58, H = b.height - 58;
    var x = Math.max(0, Math.min(W, e.clientX - b.left - drag.ox)), top = Math.max(0, Math.min(H, e.clientY - b.top - drag.oy));
    pet.x = x; pet.y = Math.max(2, H - top);
    p.style.left = x + 'px'; p.style.bottom = pet.y + 'px';
  }
  function petUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var was = drag.on; drag = null;
    if (!was) return;   // 거의 안 움직였으면 click(쓰다듬기)이 이어서 온다
    justDragged = Date.now();
    var s = S(), x = ctx.pets.parse(s.pets.eq);
    setPet(pet.y > 4 ? 'sit' : 'hop', 2600 + Math.random() * 2000);
    if (x && Math.random() < 0.6) say({ el: $('of-pet'), name: 'pet' }, ['여기 좋은데요?', '높은 데서 잘 보여요!', '어지러워요…', '내려 줘요~', '여기서 잠복할게요'][Math.floor(Math.random() * 5)]);
  }
  function drawPetFace() { drawPet(); }
  function patPet() {
    if (Date.now() - justDragged < 350) return;   // 끌고 놓은 손이 쓰다듬기로 세지지 않게
    clearTimeout(petT); setPet('happy', 1400);
    var p = $('of-pet'), a = rel(p);
    for (var i = 0; i < 4; i++) {
      var h = document.createElement('i'); h.className = 'of-heart'; h.textContent = '♥';
      h.style.left = (a.x + 12 + i * 10) + 'px'; h.style.top = (a.y + 4) + 'px'; h.style.animationDelay = (i * 90) + 'ms';
      box.appendChild(h); later(function (e) { return function () { e.remove(); }; }(h), 1300);
    }
    try { if (ctx.petsUI && ctx.petsUI.pat) ctx.petsUI.pat(); } catch (e) { /* 무시 */ }
    var s = S(), x = ctx.pets.parse(s.pets.eq);
    if (x) say({ el: p, name: 'pet' }, ctx.pets.talk(x.id, talkCtx()));
  }

  /* ---------- 말풍선: 하나씩, 번갈아 ---------- */
  function talkCtx() { return { hour: new Date().getHours(), capped: ctx.capped(), tickets: S().pets ? S().pets.tickets : 0 }; }
  function pickCop() { var D = deskN(); if (!D) return null; var i = Math.floor(Math.random() * D); return { el: deskEl(i), name: 'cop' }; }
  function copLine() {
    var s = S(), kind = box.getAttribute('data-kind'), time = box.getAttribute('data-time'), pool = [
      '이 사람 알리바이가 이상한데요…', 'CCTV 한 번만 더 돌려 볼게요', '팀장님, 보고서 올렸어요', '오늘 안에 한 명 더!', '탐문 다녀왔습니다', '지문 감식 결과 나왔어요'];
    if (time === 'night') pool.push('야근이네요…', '눈이 감겨요…', '야식 시킬까요?');
    if (time === 'day') pool.push('점심은 짜장면이죠');
    if (kind === 'rain') pool.push('비 오면 흔적이 다 씻겨요…', '우산 챙기셨어요?');
    if (kind === 'snow') pool.push('눈길에 발자국이 남았어요!', '눈 오는 날엔 도주가 느려요');
    if (kind === 'petal') pool.push('벚꽃 구경은 사건 닫고 가요');
    if (kind === 'leaf') pool.push('낙엽 밟는 소리가 좋네요', '가을엔 잠복하기 좋아요');
    if (OF.isFull(s)) pool.push('유치장 꽉 찼어요! 이송 좀…', '팀장님, 호송차 불러 주세요!');
    if (ctx.buffed(Date.now())) pool.push('힘이 나요!', '오늘 컨디션 최고!');
    if (ctx.capped()) pool.push('주범 조는 현장에서 잡아야 해요', '팀장님이 직접 나가셔야 해요!');
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function say(who, text) {
    var b = $('of-bubble'); if (!b || !who || !who.el || !text) return;
    var a = rel(who.el), W = box.clientWidth;
    b.textContent = text;
    b.className = 'of-bubble ' + who.name;
    b.hidden = false;
    var bw = b.offsetWidth, left = Math.max(4, Math.min(W - bw - 4, a.x + a.w / 2 - bw / 2));
    b.style.left = left + 'px'; b.style.top = Math.max(2, a.y - b.offsetHeight - 6) + 'px';
    b.style.setProperty('--tail', Math.max(10, Math.min(bw - 10, a.x + a.w / 2 - left)) + 'px');
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    clearTimeout(say.t); say.t = later(function () { b.hidden = true; }, 3200);
  }
  var turn = 0;
  function chatter() {
    clearTimeout(talkT);
    talkT = later(chatter, 8000 + Math.random() * 6000);
    if (!visible() || document.hidden) return;
    var s = S(), x = s.pets && s.pets.eq ? ctx.pets.parse(s.pets.eq) : null;
    turn++;
    if (x && !$('of-pet').hidden && turn % 2 === 0 && pet.state !== 'sleep') say({ el: $('of-pet'), name: 'pet' }, ctx.pets.talk(x.id, talkCtx()));
    else say(pickCop(), copLine());
  }

  /* ---------- 매 프레임: 동그라미(차례 책상) ---------- */
  // 사무실이 보이는가: 사무실 화면이고, 위에 창(시트)이 떠 있지 않을 때
  function visible() {
    var h = $('s-hub'); if (!(box && h && h.classList.contains('on'))) return false;
    var open = document.querySelector('.sheet-back:not([hidden])');
    return !open;
  }
  // 0.12.9 발열: 상황실이 실제로 보일 때만, 초당 약 15번만 고친다
  var fLast = 0;
  function frame(ms) {
    raf = requestAnimationFrame(frame);
    if (ms - fLast < 66) return; fLast = ms;
    if (document.hidden || !box || box.offsetParent === null) return;
    if (!visible()) return;
    var s = S(), D = deskN(); if (!D) return;
    var now = Date.now(), n = ctx.idle.nextCatch(s, now), frac = Math.max(0, Math.min(1, n.frac)), k = ((s.teamCaught % D) + D) % D;
    var stream = ctx.idle.isStreaming(s, now);
    for (var i = 0; i < D; i++) {
      var c = $('of-r' + i); if (!c) continue;
      var order = (i - k + D) % D, p = stream ? 1 : (frac + (D - 1 - order)) / D;
      if (D === 1) p = frac;
      var off = (56.55 * (1 - p)).toFixed(1); if (c._o !== off) { c._o = off; c.style.strokeDashoffset = off; }   // 값이 바뀔 때만 쓴다
      var cup = $('of-cup' + i), cool = OF.coffeeLeft(s, i, now) > 0; if (cup && cup._c !== cool) { cup._c = cool; cup.classList.toggle('cool', cool); }
    }
    lastFrac = frac;
  }
  /** 1초마다(hub tick) */
  function tick() {
    if (!box) return;
    if (key() !== built) { build(); return; }
    var now = Date.now();
    box.classList.toggle('buff', ctx.buffed(now));
    box.classList.toggle('stream', ctx.idle.isStreaming(S(), now));
    sky(false);
  }
  function render() { if (!box) return; if (key() !== built) build(); else { cell(); cork(); drawPet(); } tick(); }

  function mount(c) {
    ctx = c; box = $('h-office');
    if (!box || !OF) return;
    OF.clean(S());
    build();
    box.addEventListener('click', function (e) {
      var d = e.target.closest('.of-desk'); if (d && !d.classList.contains('empty')) { coffeeAll(+d.getAttribute('data-i')); return; }   // 0.10.9 형사 한 명을 누르면 마실 수 있는 모두에게 커피(이름 창은 뺐다)
      if (e.target.closest('#of-send')) { send(); return; }
      if (e.target.closest('#of-pet')) { patPet(); return; }
    });
    box.addEventListener('pointerdown', function (e) { if (e.target.closest('#of-pet')) petDown(e); });
    var ib = $('info-body');
    if (ib) {
      ib.addEventListener('click', function (e) { var b = e.target.closest('#of-nm-ok'); if (b) saveCopName(+b.getAttribute('data-i')); });
      ib.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.id === 'of-nm') { var b = $('of-nm-ok'); if (b) saveCopName(+b.getAttribute('data-i')); } });
    }
    box.addEventListener('pointermove', petMove);
    box.addEventListener('pointerup', petUp);
    box.addEventListener('pointercancel', petUp);
    box.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.id === 'of-pet') { e.preventDefault(); patPet(); } });
    cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
    petT = later(petAct, 1200);
    talkT = later(chatter, 3500);
  }

  root.Team3OfficeUI = { mount: mount, render: render, caught: caught, tick: tick,
    _petState: function (st, ms) { clearTimeout(petT); setPet(st, ms || 9000); return pet.state; } };   // 화면 시험용(조는 모습 확인)
})(typeof self !== 'undefined' ? self : this);
