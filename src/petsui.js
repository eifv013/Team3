/*
 * Team3PetsUI(0.3.0) — 사무실의 파트너 칸과 "동물 · 뽑기" 창.
 *
 * 구조
 *   규칙·저장은 Team3Pets(P), 그림은 Team3PetArt(A). 이 파일은 화면만 그린다.
 *   save 는 사무실(hub.js)이 들고 있어서 mount 때 getSave/persist/render 를 받아 쓴다.
 *
 * 창(#pets-sheet)
 *   뽑기 탭: 뽑기권·배지·간식, 천장까지 남은 횟수, 1회/10회 뽑기, 결과 카드(차례로 뒤집힘), 확률표(늘 공개)
 *   도감 탭: 보유 효과 합계, 20종 × 4등급 칸. 칸을 누르면 위에 자세히(효과 · 파트너로 · 간식 교환)
 *   사무실 칸(#h-pet): 파트너 그림을 누르면 기뻐하고, "동물" 단추로 창을 연다.
 */
(function (root) {
  'use strict';
  var P = root.Team3Pets, A = root.Team3PetArt;
  /* 0.8.4 누아르 각성 그림. 켜진 동물이면 초상(파트너 카드 · 도감 자세히)을 누아르로. 표정·의상은 귀여운 그림에만 있다 */
  function noirArt() { return root.Team3NoirArt; }
  /* 0.13.15 도감 칸의 강화 단계: '3★' 작은 글씨 대신 별 다섯 칸(채운 별 금색, 빈 별 흐리게) */
  function starRow(st) { var m = P.STAR_MAX, n = Math.max(0, Math.min(m, st)); return '<i class="pet-cstars" aria-label="★' + n + '">' + new Array(n + 1).join('★') + '<s>' + new Array(m - n + 1).join('★') + '</s></i>'; }
  function isNoir(k) { return !!(noirArt() && k && P.noirOn(S(), k)); }
  // 0.13.0 코드네임 그림은 기본이 멈춘 그림. 연출을 산 동물만 큰 그림(anim)에서 움직인다(data-fx + 그림판)
  function portrait(k, x, o) {
    if (!isNoir(k)) return A.draw(x.id, o);
    var sc = P.noirScene(S(), k), N = noirArt(), fk = N.has(x.id, sc) ? x.id + '_' + sc : N.has(x.id, 'a') ? x.id + '_a' : x.id, fx = !!(o && o.anim && P.fxOn(S(), x.id));
    if (fx) setTimeout(fxStart, 0);
    return '<span class="noir-pic' + (fx ? ' fxon' : '') + '"' + (fx ? ' data-fx="' + fk + '"' : '') + '>' + N.draw(x.id, { grade: x.g, scene: sc }) + (fx ? '<canvas></canvas>' : '') + '</span>';
  }
  if (!P || !A) return;
  var $ = function (id) { return document.getElementById(id); };
  function fmt(n) { return Math.floor(n).toLocaleString('ko-KR'); }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  // 동물 칭호(0.3.0, Team3Ach) — 이름 앞에 작게
  function ttl(k) { var H = root.Team3Ach, t = H ? H.petTitle(S(), k) : ''; return t ? '<i class="ttl">' + esc(t) + '</i>' : ''; }
  function stars(n) { return '<span class="pet-stars">' + '★'.repeat(n) + '<i>' + '★'.repeat(P.STAR_MAX - n) + '</i></span>'; }

  var ctx = null, tab = 'draw', detailKey = '', busy = false;

  function S() { return ctx.getSave(); }
  function pets() { return S().pets; }

  /* ---------- 사무실 칸 ---------- */
  function renderPartner() {
    var box = $('h-pet');
    if (!box) return;
    var p = pets(), x = P.parse(p.eq), free = p.tickets;
    var dot = free > 0 ? '<span class="pet-dot">' + (free > 99 ? '99+' : free) + '</span>' : '';
    if (!x) {
      box.style.removeProperty('--gc');
      setCard(box, '<div class="pet-art pet-empty" aria-hidden="true">?</div>' +
        '<div class="pet-tx"><b>파트너가 없어요</b><small>뽑기로 3팀과 함께할 파트너를 데려와요' + (free ? ', 뽑기권 ' + free + '장' : '') + '</small></div>' +
        '<button class="buy" id="h-pet-open">뽑기' + dot + '</button>', '');
      return;
    }
    var sp = P.BY_ID[x.id], g = P.GRADE[x.g], st = p.own[p.eq], nm = P.nameOf(S(), p.eq);
    box.style.setProperty('--gc', g.color);
    var eff = P.describe(P.eqEffect(x.id, x.g, st)), bd = P.bondOf(S(), p.eq);
    // 0.4.1 무대: 등급 빛(영웅 · 전설은 도는 후광) · 바닥 그림자 · 전설 반짝이. 버튼 안에는 그림만(act 가 갈아 끼운다)
    setCard(box, '<button class="pet-bgbtn" id="h-pet-bgbtn"><i class="em">🖼️</i>배경<em>' + Object.keys(pets().bgs || {}).length + ' / ' + P.BGS.length + '</em></button>' +   // 0.12.0 파트너 배경
      '<div class="pet-stage g-' + x.g + '" id="h-pet-stage" style="--gc:' + g.color + '"><i class="ps-aura" aria-hidden="true"></i><i class="ps-floor" aria-hidden="true"></i>' +
      (x.g === 'l' ? '<i class="ps-spark" aria-hidden="true"></i>' : '') +
      '<button class="pet-art' + (isNoir(p.eq) ? ' noir' : '') + '" id="h-pet-art" aria-label="' + esc(nm) + ' 쓰다듬기">' + portrait(p.eq, x, { grade: x.g, anim: true, outfit: P.wearing(S(), p.eq) }) + '</button></div>' +
      '<div class="pet-tx"><b><span style="color:' + g.color + '">' + g.name + '</span> ' + ttl(p.eq) + esc(nm) + ' ' + stars(st) + '</b>' + (isNoir(p.eq) ? '<small class="pet-cn">코드네임 ' + esc(P.codename(x.id)) + '</small>' : '') + '<small>' + esc(eff.join(', ')) + '</small>' +
        '<small class="pet-bond' + (bd.last === today() ? '' : ' need') + '">♥ ' + bd.lv + '단계' + (bd.last === today() ? ' (함께 ' + bd.days + '일 ✓)' : ', 그림을 눌러 쓰다듬어 줘요') + '</small></div>' +
      '<span class="pet-bubble" id="h-pet-bubble" hidden></span>' +
      '<button class="buy" id="h-pet-open">파트너' + dot + '</button>', P.bgNow(S()));
  }
  /*
   * 0.12.1 카드 채우기. 배경(.pet-bg, 움직이는 그림판)은 한 번 만들어 그대로 두고 안쪽(.pet-in)만 갈아 끼운다
   *   — 카드를 다시 그릴 때마다 배경 움직임이 처음으로 돌아가 멈춘 그림처럼 보이던 것을 막는다.
   */
  function setCard(box, html, bg) {
    var b = box.querySelector(':scope > .pet-bg'), inn = box.querySelector(':scope > .pet-in');
    if (!b || !inn) { box.innerHTML = '<div class="pet-bg" aria-hidden="true" hidden><canvas></canvas></div><div class="pet-in"></div>'; b = box.firstChild; inn = box.lastChild; }
    var cls = 'pet-bg' + (bg ? ' bg-' + bg : '');
    if (b.className !== cls) { b.className = cls; b.firstChild.setAttribute('data-k', bg || ''); b.firstChild._p = null; }
    b.hidden = !bg;
    if (inn._h !== html || inn._dirty) { inn._h = html; inn._dirty = false; inn.innerHTML = html; }   // 0.13.3 발열: 내용이 같으면 다시 넣지 않는다(1초마다 큰 그림을 다시 풀어 그리던 것). 표정을 직접 바꾼 뒤에는 _dirty
    if (bg) fxStart();
  }
  /*
   * 0.12.1 배경 움직임(그림판 canvas). 0.12.0 은 CSS 로 옅게 얹어서 휴대폰에서 거의 안 보였다 → 입자를 직접 그린다.
   *   종류: 비(골목 · 네온) · 안개와 등대 빛(부두) · 형광등 깜빡임(면통실) · 눈 · 별과 별똥별(옥상) · 빛줄기와 금가루(황금 무대) · 지나가는 차 불빛과 먼지(사무실)
   *   화면에 보이는 .pet-bg canvas 만 그리고, 하나도 없으면 멈춘다. "움직임 줄이기"면 한 장만 그린다.
   */
  /* 0.13.0 코드네임 연출: 그림마다 찾아 둔 불빛 자리(Team3NoirHot)에서 등 · 경광등이 번지고, 날씨(비 · 눈 · 실내 먼지)가 앞에 내린다.
   *   카드는 1초마다 다시 그려져 그림판이 새로 생기므로 입자는 그림 이름별로 따로 들고 있는다(NP). */
  var NP = {};
  function nfxDraw(cv, t, dt) {
    var key = cv.parentNode.getAttribute('data-fx'), H = (root.Team3NoirHot || {})[key] || { w: 'in', h: [] }, w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(2, root.devicePixelRatio || 1), i, o;
    if (!w || !h) return false;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    var st = NP[key]; if (!st) { st = NP[key] = { a: [], d: [], flash: 0, next: 5 }; for (i = 0; i < 46; i++) st.a.push({ x: rnd(-0.2, 1.2), y: rnd(0, 1), z: Math.random() }); for (i = 0; i < 34; i++) st.d.push({ x: rnd(0, 1), y: rnd(0, 1), z: Math.random(), p: rnd(0, 6.3) }); }
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h); c.globalCompositeOperation = 'lighter';
    for (i = 0; i < H.h.length; i++) { o = H.h[i]; var x = o[0] * w, y = o[1] * h;
      if (o[2] === 'w') glow(c, x, y, w * 0.3, 'rgba(255,200,130,A)', (Math.sin(t * 37 + i * 9) > 0.985 ? 0.12 : 0.4) * (0.75 + 0.25 * Math.sin(t * 1.7 + i * 2.1)));
      else if (o[2] === 'r') glow(c, x, y, w * 0.34, 'rgba(255,40,70,A)', 0.55 * Math.max(0, Math.sin(t * 6)));
      else glow(c, x, y, w * 0.34, 'rgba(70,110,255,A)', 0.55 * Math.max(0, Math.sin(t * 6 + 3.14))); }
    if (H.w === 'rain') {
      st.next -= dt; if (st.next < 0) { st.flash = 1; st.next = rnd(6, 12); }
      if (st.flash > 0) { c.fillStyle = 'rgba(215,205,255,' + (0.3 * st.flash) + ')'; c.fillRect(0, 0, w, h); st.flash -= dt * 2.4; }
      c.lineCap = 'round';
      for (i = 0; i < st.a.length; i++) { o = st.a[i]; var sp = 0.9 + o.z * 1.5; o.y += sp * dt; o.x -= sp * dt * 0.16; if (o.y > 1.1) { o.y = -0.15; o.x = rnd(-0.1, 1.3); }
        var L = (0.05 + o.z * 0.1) * h; c.strokeStyle = 'rgba(210,222,255,' + (0.14 + o.z * 0.26) + ')'; c.lineWidth = 0.5 + o.z; c.beginPath(); c.moveTo(o.x * w, o.y * h); c.lineTo(o.x * w - L * 0.16, o.y * h + L); c.stroke(); }
    } else if (H.w === 'snow') {
      for (i = 0; i < st.d.length; i++) { o = st.d[i]; o.y += (0.03 + o.z * 0.12) * dt; if (o.y > 1.05) { o.y = -0.05; o.x = rnd(0, 1); } c.fillStyle = 'rgba(255,255,255,' + (0.4 + o.z * 0.5) + ')'; c.beginPath(); c.arc((o.x + Math.sin(t * 0.8 + o.p) * 0.02) * w, o.y * h, 0.6 + o.z * 2.2, 0, 6.3); c.fill(); }
    } else {
      for (i = 0; i < st.d.length; i++) { o = st.d[i]; o.y -= (0.006 + o.z * 0.012) * dt; if (o.y < 0) o.y = 1; c.fillStyle = 'rgba(255,228,185,' + (0.2 + 0.25 * Math.sin(t * 1.3 + o.p)) + ')'; c.beginPath(); c.arc((o.x + Math.sin(t * 0.4 + o.p) * 0.015) * w, o.y * h, 0.5 + o.z * 1.1, 0, 6.3); c.fill(); }
    }
    return true;
  }
  var fxOn = false, fxT0 = 0;
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function fxInit(k, w, h) {
    var p = [], i;
    if (k === 'alley' || k === 'neon') for (i = 0; i < 90; i++) p.push({ x: rnd(-0.2, 1.1), y: rnd(0, 1), v: rnd(1.3, 2.1), l: rnd(0.05, 0.11), a: rnd(0.35, 0.8) });
    else if (k === 'snow') for (i = 0; i < 80; i++) p.push({ x: rnd(0, 1), y: rnd(0, 1), v: rnd(0.05, 0.16), r: rnd(1.2, 3.6), ph: rnd(0, 6.3), a: rnd(0.6, 1) });
    else if (k === 'harbor') for (i = 0; i < 7; i++) p.push({ x: rnd(0, 1), y: rnd(0.35, 0.9), v: rnd(0.04, 0.09), r: rnd(0.22, 0.42), a: rnd(0.16, 0.3) });
    else if (k === 'roof') for (i = 0; i < 60; i++) p.push({ x: rnd(0.02, 0.98), y: rnd(0.02, 0.4), r: rnd(1, 2.4), ph: rnd(0, 6.3), sp: rnd(2, 5) });
    else if (k === 'gold') for (i = 0; i < 46; i++) p.push({ x: rnd(0, 1), y: rnd(0, 1), v: rnd(0.06, 0.16), r: rnd(2, 5), ph: rnd(0, 6.3), sp: rnd(2, 6) });
    else for (i = 0; i < 26; i++) p.push({ x: rnd(0, 1), y: rnd(0.1, 0.95), v: rnd(0.004, 0.014), r: rnd(0.8, 1.8), ph: rnd(0, 6.3) });
    return p;
  }
  function glow(c, x, y, r, col, a) { var g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col.replace('A', a)); g.addColorStop(1, col.replace('A', 0)); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
  function fxDraw(cv, t, dt) {
    var k = cv.getAttribute('data-k') || 'office', w = cv.clientWidth, h = cv.clientHeight, dpr = 1;   // 0.13.3 발열: 배경 그림판은 1배로만
    if (!w || !h) return false;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    if (!cv._p) cv._p = fxInit(k, w, h);
    var c = cv.getContext('2d'), p = cv._p, i, o, a;
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h); c.globalCompositeOperation = 'lighter';
    if (k === 'alley' || k === 'neon') {
      c.lineCap = 'round';
      for (i = 0; i < p.length; i++) {
        o = p[i]; o.y += o.v * dt; o.x += o.v * dt * 0.16; if (o.y > 1.1) { o.y = -0.12; o.x = rnd(-0.2, 1.1); }
        c.strokeStyle = k === 'neon' ? (i % 3 ? 'rgba(255,170,240,' + o.a * 0.8 + ')' : 'rgba(150,235,255,' + o.a * 0.8 + ')') : 'rgba(205,225,255,' + o.a * 0.75 + ')';
        c.lineWidth = o.a > 0.6 ? 1.6 : 1; c.beginPath(); c.moveTo(o.x * w, o.y * h); c.lineTo((o.x + o.l * 0.16) * w, (o.y + o.l) * h); c.stroke();
      }
      // 바닥에 튀는 빗방울 고리
      for (i = 0; i < 9; i++) { a = (t * 1.6 + i * 0.37) % 1; c.strokeStyle = 'rgba(220,235,255,' + (0.5 * (1 - a)) + ')'; c.lineWidth = 1; c.beginPath(); c.ellipse(((i * 0.618 + Math.floor(t * 1.6 + i * 0.37) * 0.271) % 1) * w, (0.72 + (i % 4) * 0.07) * h, 3 + a * 11, 1 + a * 3.2, 0, 0, 6.3); c.stroke(); }
      if (k === 'alley') glow(c, 0.72 * w, 0.07 * h, 0.3 * w, 'rgba(255,190,100,A)', 0.2 + 0.1 * Math.sin(t * 7) * Math.sin(t * 2.3));
      else glow(c, 0.22 * w, 0.2 * h, 0.42 * w, 'rgba(255,60,190,A)', (Math.sin(t * 31) > 0.86 || (t % 4.2) < 0.12 ? 0.06 : 0.3) );
    } else if (k === 'snow') {
      for (i = 0; i < p.length; i++) { o = p[i]; o.y += o.v * dt; if (o.y > 1.05) { o.y = -0.05; o.x = rnd(0, 1); } c.fillStyle = 'rgba(255,255,255,' + o.a + ')'; c.beginPath(); c.arc((o.x + Math.sin(t * 0.9 + o.ph) * 0.02) * w, o.y * h, o.r, 0, 6.3); c.fill(); }
      glow(c, 0.265 * w, 0.2 * h, 0.2 * w, 'rgba(255,200,120,A)', 0.2 + 0.07 * Math.sin(t * 2.1));
    } else if (k === 'harbor') {
      a = Math.sin(t * 1.1) * 0.3 + 3.32;   // 등대 빛이 좌우로 쓴다
      var lx = 0.928 * w, ly = 0.185 * h, L = 1.1 * w, g = c.createLinearGradient(lx, ly, lx + Math.cos(a) * L, ly + Math.sin(a) * L);
      g.addColorStop(0, 'rgba(210,255,248,.55)'); g.addColorStop(1, 'rgba(210,255,248,0)'); c.fillStyle = g;
      c.beginPath(); c.moveTo(lx, ly); c.lineTo(lx + Math.cos(a - 0.085) * L, ly + Math.sin(a - 0.085) * L); c.lineTo(lx + Math.cos(a + 0.085) * L, ly + Math.sin(a + 0.085) * L); c.closePath(); c.fill();
      glow(c, lx, ly, 0.07 * w, 'rgba(230,255,250,A)', 0.55 + 0.3 * Math.sin(t * 1.1));
      for (i = 0; i < p.length; i++) { o = p[i]; o.x += o.v * dt; if (o.x > 1.5) o.x = -0.5; glow(c, o.x * w, o.y * h, o.r * w, 'rgba(170,225,220,A)', o.a); }
    } else if (k === 'room') {
      a = (t % 3.4) < 0.45 ? (Math.sin(t * 60) > 0 ? 0.02 : 0.34) : ((t + 1.3) % 5.1) < 0.1 ? 0.03 : 0.24 + 0.06 * Math.sin(t * 11);
      var gr = c.createLinearGradient(0, 0, 0, h * 0.8); gr.addColorStop(0, 'rgba(190,240,255,' + a + ')'); gr.addColorStop(1, 'rgba(190,240,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
      glow(c, 0.52 * w, 0.045 * h, 0.3 * w, 'rgba(220,250,255,A)', a * 1.6);
      glow(c, 0.06 * w, 0.62 * h, 0.2 * w, 'rgba(255,180,90,A)', 0.2 + 0.05 * Math.sin(t * 1.7));
      for (i = 0; i < p.length; i++) { o = p[i]; o.y -= o.v * dt; o.x += Math.sin(t * 0.5 + o.ph) * 0.0006; if (o.y < 0.05) o.y = 0.95; c.fillStyle = 'rgba(220,245,255,' + (0.3 + 0.3 * Math.sin(t * 1.3 + o.ph)) + ')'; c.beginPath(); c.arc(o.x * w, o.y * h, o.r, 0, 6.3); c.fill(); }
    } else if (k === 'roof') {
      for (i = 0; i < p.length; i++) { o = p[i]; a = 0.5 + 0.5 * Math.sin(t * o.sp + o.ph); c.fillStyle = 'rgba(235,244,255,' + (0.05 + 0.95 * a) + ')'; c.beginPath(); c.arc(o.x * w, o.y * h, o.r * (0.5 + 0.7 * a), 0, 6.3); c.fill(); if (i % 6 === 0) glow(c, o.x * w, o.y * h, o.r * 5, 'rgba(200,225,255,A)', 0.5 * a); }
      a = (t % 4.5) / 1.1; if (a < 1) { var sx = (0.15 + 0.5 * ((Math.floor(t / 4.5) * 0.37) % 1) + a * 0.3) * w, sy = (0.04 + a * 0.16) * h, sg = c.createLinearGradient(sx, sy, sx - 0.12 * w, sy - 0.064 * h); sg.addColorStop(0, 'rgba(255,255,255,' + (1 - a) + ')'); sg.addColorStop(1, 'rgba(255,255,255,0)'); c.strokeStyle = sg; c.lineWidth = 1.8; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx - 0.12 * w, sy - 0.064 * h); c.stroke(); }
      glow(c, 0.774 * w, 0.275 * h, 0.03 * w, 'rgba(255,70,70,A)', (t % 1.6) < 0.8 ? 0.9 : 0.1);
      glow(c, 0.955 * w, 0.52 * h, 0.14 * w, 'rgba(255,180,90,A)', 0.25 + 0.12 * Math.sin(t * 5) * Math.sin(t * 1.7));
    } else if (k === 'gold') {
      for (i = 0; i < 9; i++) { a = (i - 4) * 0.2 + Math.sin(t * 0.5 + i) * 0.07; var gg = c.createLinearGradient(w / 2, -0.1 * h, w / 2 + Math.sin(a) * h, h); gg.addColorStop(0, 'rgba(255,225,130,' + (0.2 + 0.1 * Math.sin(t * 1.3 + i * 2)) + ')'); gg.addColorStop(1, 'rgba(255,225,130,0)'); c.fillStyle = gg; c.beginPath(); c.moveTo(w / 2, -0.1 * h); c.lineTo(w / 2 + Math.sin(a - 0.045) * h * 1.2, h * 1.1); c.lineTo(w / 2 + Math.sin(a + 0.045) * h * 1.2, h * 1.1); c.closePath(); c.fill(); }
      for (i = 0; i < p.length; i++) { o = p[i]; o.y += o.v * dt; if (o.y > 1.05) { o.y = -0.05; o.x = rnd(0, 1); } a = Math.abs(Math.sin(t * o.sp + o.ph)); c.fillStyle = 'rgba(255,' + (200 + Math.round(40 * a)) + ',90,' + (0.5 + 0.5 * a) + ')'; c.save(); c.translate((o.x + Math.sin(t + o.ph) * 0.02) * w, o.y * h); c.rotate(t * o.sp * 0.5 + o.ph); c.fillRect(-o.r, -o.r * 0.35 * (0.3 + a), o.r * 2, o.r * 0.7 * (0.3 + a)); c.restore(); }
    } else {
      // 사무실: 책상 등은 숨 쉬듯, 천장 등은 가끔 깜빡, 먼지가 뜬다(0.12.2 지나가는 차 불빛 줄무늬는 그림이 깨진 것처럼 보여서 뺐다)
      glow(c, 0.69 * w, 0.375 * h, 0.17 * w, 'rgba(120,255,150,A)', 0.26 + 0.1 * Math.sin(t * 1.4));
      glow(c, 0.47 * w, 0.07 * h, 0.3 * w, 'rgba(255,210,150,A)', (t % 11) < 0.15 ? 0.04 : 0.2 + 0.03 * Math.sin(t * 9));
      for (i = 0; i < p.length; i++) { o = p[i]; o.y -= o.v * dt; if (o.y < 0.05) o.y = 0.95; c.fillStyle = 'rgba(255,225,170,' + (0.25 + 0.3 * Math.sin(t * 1.1 + o.ph)) + ')'; c.beginPath(); c.arc((o.x + Math.sin(t * 0.4 + o.ph) * 0.015) * w, o.y * h, o.r, 0, 6.3); c.fill(); }
    }
    return true;
  }
  function fxStart() {
    if (fxOn || typeof requestAnimationFrame !== 'function') return;
    fxOn = true; var last = 0, skip = 0, calm = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    (function loop(ms) {
      if ((skip = (skip + 1) % 3)) { requestAnimationFrame(loop); return; }   // 0.13.3 초당 20장   // 0.12.7 초당 30장만 그린다(발열)
      var cvs = document.querySelectorAll('.pet-bg > canvas'), any = false, t = (ms || 0) / 1000, dt = last ? Math.min(0.08, t - last) : 0.033; last = t;
      for (var i = 0; i < cvs.length; i++) if (cvs[i].offsetParent !== null && !cvs[i].parentNode.hidden) { if (calm && cvs[i]._still) { any = true; continue; } if (fxDraw(cvs[i], calm ? 3 : t, calm ? 0 : dt)) { any = true; cvs[i]._still = true; } }
      var ncv = calm ? [] : document.querySelectorAll('.noir-pic[data-fx] > canvas');   // 0.13.0 코드네임 연출
      for (i = 0; i < ncv.length; i++) if (ncv[i].offsetParent !== null && nfxDraw(ncv[i], t, dt)) any = true;
      if (any) requestAnimationFrame(loop); else fxOn = false;   // 0.12.7 보이는 판이 없으면 완전히 멈춘다(전에는 다른 탭에서도 매 장 돌았다)   // 판이 하나도 없으면 멈춘다(다시 그릴 때 fxStart 가 켠다)
    })(0);
  }
  /*
   * 파트너 표정 바꾸기(0.3.1): mood 를 ms 동안 보여 주고 원래대로. move 는 칸이 하는 몸짓(CSS 클래스).
   */
  function act(mood, move, ms) {
    var b = $('h-pet-art'), x = P.parse(pets().eq);
    if (!b || !x) return;
    var o = P.wearing(S(), pets().eq), nz = isNoir(pets().eq);
    if (!nz) { b.innerHTML = A.draw(x.id, { grade: x.g, mood: mood, anim: true, outfit: o }); var pin = b.closest('.pet-in'); if (pin) pin._dirty = true; }
    b.classList.remove('pa-jump', 'pa-peek', 'pa-wiggle', 'pa-doze');
    void b.offsetWidth;   // 같은 몸짓을 다시 시작하게
    if (move) b.classList.add(move);
    clearTimeout(act.t);
    act.t = setTimeout(function () {
      var bb = $('h-pet-art'), xx = P.parse(pets().eq);
      if (!bb || !xx) return;
      bb.classList.remove('pa-jump', 'pa-peek', 'pa-wiggle', 'pa-doze');
      if (!isNoir(pets().eq)) bb.innerHTML = A.draw(xx.id, { grade: xx.g, anim: true, outfit: P.wearing(S(), pets().eq) });
      var pin2 = bb.closest('.pet-in'); if (pin2) pin2._dirty = true;
    }, ms || 1400);
  }
  // 말풍선(0.4.0)
  function say(text, ms) {
    var b = $('h-pet-bubble');
    if (!b) return;
    b.textContent = text;
    b.hidden = false;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    clearTimeout(say.t);
    say.t = setTimeout(function () { var bb = $('h-pet-bubble'); if (bb) bb.hidden = true; }, ms || 3200);
  }
  function talkCtx() { var I = root.SuspectsIdle; return { hour: new Date().getHours(), capped: I && I.idleCapped ? I.idleCapped(S()) : false, tickets: pets().tickets }; }
  function pat() {
    var k = pets().eq, x = P.parse(k);
    if (!x) return;
    act('happy', 'pa-jump', 1400);
    if (root.Team3QuestUI) root.Team3QuestUI.track('pat', 1);   // 0.10.3 임무(쓰다듬은 횟수)
    var r = null;
    try { r = P.pat(S(), k, today()); } catch (e) { /* 없는 동물 */ }
    if (r && r.counted) {
      ctx.persist();
      var gv = r.give ? (r.give.treats ? '간식 +' + r.give.treats : r.give.tickets ? '뽑기권 +' + r.give.tickets : r.give.gems ? '◆' + r.give.gems : '') : '';
      renderPartner();
      say(r.up ? '친밀도 ' + r.lv + '단계! ' + (gv ? gv + ' 고마워요!' : '') : '오늘도 고마워요! ♥ 함께 ' + P.bondOf(S(), k).days + '일', 3400);
    } else say(P.talk(x.id, talkCtx()));
    hearts();
    try { ctx.UI.sfx.pick(3); } catch (e) { /* 소리 실패는 무시 */ }
    ctx.UI.buzz(8);
  }
  // 쓰다듬으면 하트가 몇 개 떠오른다(움직임 줄이기면 생략)
  function hearts() {
    var st = $('h-pet-stage');
    if (!st || (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    for (var i = 0; i < 4; i++) {
      var h = document.createElement('i');
      h.className = 'ps-heart'; h.textContent = '♥';
      h.style.left = (22 + Math.random() * 56) + '%';
      h.style.animationDelay = (i * 110) + 'ms';
      st.appendChild(h);
      setTimeout(function (el) { return function () { if (el.parentNode) el.parentNode.removeChild(el); }; }(h), 1400 + i * 110);
    }
  }
  /*
   * 혼자 움직이기(0.3.1): 사무실이 보이는 동안 9~16초마다 몸짓 하나. 밤(23~6시)에는 가끔 꾸벅꾸벅.
   *   움직임 줄이기 설정이면 하지 않는다. 창이 열려 있으면 쉰다.
   */
  var IDLE = [['happy', 'pa-jump', 1300], [null, 'pa-peek', 1800], ['huh', 'pa-wiggle', 1600], [null, 'pa-wiggle', 1200]];
  function idleLoop() {
    clearTimeout(idleLoop.t);
    idleLoop.t = setTimeout(function () {
      var hub = $('s-hub'), reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!reduce && hub && !hub.hidden && document.visibilityState === 'visible' && $('pets-sheet').hidden) {
        var h = new Date().getHours();
        if ((h >= 23 || h < 6) && Math.random() < 0.5) act(null, 'pa-doze', 3200);
        else { var m = IDLE[Math.floor(Math.random() * IDLE.length)]; act(m[0], m[1], m[2]); }
        // 세 번에 한 번쯤 혼잣말
        var xx = P.parse(pets().eq);
        if (xx && Math.random() < 0.35) say(P.talk(xx.id, talkCtx()));
      }
      idleLoop();
    }, 9000 + Math.random() * 7000);
  }

  /* ---------- 창 ---------- */
  function isOpen() { return !$('pets-sheet').hidden; }
  function open(which) {
    var gift = P.claimWelcome(S());
    if (gift) ctx.persist();
    tab = which || 'draw';   // 0.13.18 늘 첫 칸(뽑기)부터
    detailKey = '';
    $('pets-sheet').hidden = false;
    draw();
    $('pets-sheet').querySelector('.sheet').scrollTop = 0;
    if (gift) toast('환영 선물: 뽑기권 ' + gift + '장!');
  }
  // 0.13.2 도감을 한 번 보고 나가면(창 닫기 · 다른 탭으로) NEW 를 모두 끈다 — 하나하나 눌러 끄지 않아도 되게
  var dexSeen = false;
  function leaveDex() { if (dexSeen) { dexSeen = false; if (P.seeAllFresh(S())) ctx.persist(); } }
  function close() {
    if (busy) return;
    if (detailKey && !$('pets-detail').hidden) { detailKey = ''; naming = false; drawDetail(); return; }   // 0.10.5 뒤로가기: 팝업 먼저 닫기
    leaveDex();
    $('pets-sheet').hidden = true;
    ctx.render();
  }
  function toast(t) { try { ctx.UI.toast(t); } catch (e) { /* 없음 */ } }

  function draw() {
    var p = pets(), pr = P.progress(S());
    document.querySelectorAll('#pets-tabs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === tab); });
    var fc = P.freshCount ? P.freshCount(S()) : 0;
    $('pets-tab-dex').innerHTML = '도감 ' + pr.have + '/' + pr.total + (fc ? ' <em class="tab-new">NEW ' + fc + '</em>' : '');   // 0.10.6
    $('pets-wallet').innerHTML = walletHtml();
    $('pets-draw').hidden = tab !== 'draw';
    $('pets-dex').hidden = tab !== 'dex';
    $('pets-closet').hidden = tab !== 'closet';
    drawDetail();
    if (tab === 'draw') drawDraw(); else if (tab === 'dex') drawDex(); else drawCloset();
  }

  // 오늘(기기 날짜) · 무료 뽑기 추가분(월정액 등, 사무실이 알려 준다)
  function today() { var E = root.Team3Economy; return E ? E.dayKey(Date.now(), new Date().getTimezoneOffset()) : new Date().toISOString().slice(0, 10); }
  function freeExtra() { return ctx && typeof ctx.freeExtra === 'function' ? ctx.freeExtra() : 0; }
  function pullOpts() { return { day: today(), freeExtra: freeExtra() }; }
  /*
   * 뽑기 단추 계획(0.4.1)
   *   one  : 1회 — 오늘 무료 → 뽑기권 → 배지 순. 모두 안 되면 부족(무엇이 얼마나 모자란지)
   *   multi: 가진 만큼 — 뽑기권이 2장 이상이면 그 장수(최대 MAX_PULL), 아니면 배지로 살 수 있는 만큼(2회 이상일 때)
   *   아이콘: Team3Icons(없으면 글자)
   */
  function ic(name) { var I = root.Team3Icons; return I ? I.icon(name) : (name === 'gem' ? '◆' : ''); }
  function plan() {
    var p = pets(), s = S(), out = {};
    if (P.freeLeft(s, today(), freeExtra()) > 0) out.one = { ok: true, pay: 'free', n: 1, text: '오늘 무료' };
    else if (p.tickets >= 1) out.one = { ok: true, pay: 'ticket', n: 1, text: ic('ticket') + '1장' };
    else if (s.gems >= P.COST.one) out.one = { ok: true, pay: 'gems', n: 1, text: ic('gem') + P.COST.one };
    else out.one = { ok: false, n: 1, text: '부족, ' + ic('ticket') + p.tickets + '/1, ' + ic('gem') + fmt(s.gems) + '/' + P.COST.one };
    var mt = P.maxPull(s, 'ticket'), mg = P.maxPull(s, 'gems');
    if (mt >= 2) out.multi = { ok: true, pay: 'ticket', n: mt, text: ic('ticket') + mt + '장' + (p.tickets > mt ? ' (한 번에 최대 ' + P.MAX_PULL + ')' : '') };
    else if (mg >= 2) out.multi = { ok: true, pay: 'gems', n: mg, text: ic('gem') + fmt(P.gemCost(mg)) + (mg >= 10 ? ', 10회마다 10% 덜' : '') };
    else out.multi = { ok: false, n: 2, text: '부족, ' + ic('ticket') + p.tickets + '/2 또는 ' + ic('gem') + fmt(s.gems) + '/' + P.gemCost(2) };
    return out;
  }
  function walletHtml() {
    var p = pets();
    return '<button data-cur="ticket">' + ic('ticket') + '뽑기권 <b>' + fmt(p.tickets) + '</b></button><button data-cur="gem">' + ic('gem') + '배지 <b>' + fmt(S().gems) + '</b></button><button data-cur="treat">' + ic('treat') + '간식 <b>' + fmt(p.treats) + '</b></button>';
  }
  function drawDraw() {
    var p = pets(), pl = plan(), one = pl.one, multi = pl.multi, pk = P.pickup(today()), sp = P.BY_ID[pk.id];
    // 이번 주 픽업
    $('pets-pickup').innerHTML = '<div class="pet-pk-art">' + A.draw(pk.id, { grade: 'l', anim: true }) + '</div>' +
      '<div class="pet-pk-tx"><span class="label">이번 주 출동 파트너, ' + pk.left + '일 남음</span><b>' + esc(sp.kind) + ' ' + esc(sp.name) + '</b>' +
      '<small>영웅·전설이 나오면 절반은 ' + esc(sp.name) + '! 천장(' + P.PITY + '번째) 전설은 ' + esc(sp.name) + ' 확정</small></div>';
    $('pets-one').classList.toggle('free', one.pay === 'free');
    $('pets-pity').innerHTML = '전설 확정까지 <b>' + (P.PITY - p.pity) + '번</b>, 현재까지 ' + fmt(p.pulls) + '번 뽑음';
    // 0.10.3 오늘 무료 뽑기를 썼으면 다음 무료(자정)까지 남은 시간을 함께
    var nd = new Date(); nd.setHours(24, 0, 0, 0); var ms = nd - Date.now(), hh = Math.floor(ms / 36e5), mm = Math.floor(ms % 36e5 / 6e4);
    var freeTxt = one.pay === 'free' ? '' : '<em class="pet-free-t">무료 뽑기까지 ' + (hh ? hh + '시간 ' : '') + mm + '분</em>';
    $('pets-one').innerHTML = '1회 뽑기<small>' + one.text + '</small>';
    $('pets-pity').innerHTML += freeTxt;
    $('pets-ten').innerHTML = (multi.ok ? multi.n + '회 뽑기' : '여러 번 뽑기') + '<small>' + multi.text + '</small>';
    $('pets-one').classList.toggle('short', !one.ok);
    $('pets-ten').classList.toggle('short', !multi.ok);
    $('pets-one').disabled = busy || !one.ok;
    $('pets-ten').disabled = busy || !multi.ok;
    $('pets-rates').innerHTML = '<table class="pet-rates"><tr><th>등급</th><th>등급 확률</th><th>한 마리</th></tr>' +
      P.rates().map(function (r) { return '<tr><td style="color:' + P.GRADE[r.g].color + '">' + r.name + '</td><td>' + r.pct + '%</td><td>' + r.each + '%</td></tr>'; }).join('') + '</table>' +
      '<p class="muted">등급을 먼저 정하고, 그 등급의 ' + P.SPECIES.length + '종 중 하나가 같은 확률로 나와요. 단 영웅·전설은 ' + (P.PICKUP_RATE * 100) + '% 확률로 이번 주 출동 파트너가 나와요(그래서 영웅·전설 안에서 출동 파트너는 ' + Math.round((P.PICKUP_RATE + (1 - P.PICKUP_RATE) / P.SPECIES.length) * 1000) / 10 + '%, 나머지는 각 ' + Math.round((1 - P.PICKUP_RATE) / P.SPECIES.length * 1000) / 10 + '%).</p>' +
      '<p class="muted">하루 한 번 무료 뽑기가 있어요(자정에 다시 생겨요).</p>' +
      '<p class="muted">천장: ' + P.PITY + '번째까지 전설이 한 번도 안 나오면 그 번째는 전설 확정(전설이 나오면 다시 0부터). 천장을 포함하면 전설은 실제로 약 ' + P.effectiveLegend() + '%예요.</p>' +
      '<p class="muted">여러 번 뽑기: 2번 이상 뽑을 수 있으면 가진 만큼 한 번에(최대 ' + P.MAX_PULL + '번). 10마리마다 희귀 이상 1마리 보장. 배지는 1번 ◆' + P.COST.one + ', 10번 묶음마다 ◆' + P.COST.ten + '.</p>' +
      '<p class="muted">같은 파트너가 또 나오면 ★가 올라요(★5까지, ★마다 효과 +25%). ★5 뒤에는 간식(' + P.GRADES.map(function (g) { return P.GRADE[g].name + ' ' + P.GRADE[g].treat; }).join(', ') + ')으로 바뀌어요.</p>' +
      '<p class="muted">뽑기권은 처음 선물, 사건 종결, 승진, 메달, 특별 출동으로 받아요. 파트너는 퍼즐 실력을 대신하지 않아요: ⚡ 퍼즐 도움은 영웅·전설의 일부만, 특별 출동에서는 꺼져요.</p>';
  }

  /*
   * 뽑기(0.3.1: 연출을 따로 띄운다).
   *   결과는 먼저 저장해 두고(P.pull → persist) 연출이 끝나면 창의 결과 칸에 요약을 남긴다.
   *   연출 도중 앱을 닫아도 뽑은 동물은 이미 들어가 있다.
   */
  // 0.10.5 배지로 뽑을 때만 한 번 묻는다(무료 · 뽑기권은 바로)
  function askPull(kind) {
    var c = plan()[kind];
    if (busy) return;
    if (!c.ok || c.pay !== 'gems') { doPull(kind); return; }
    var g = kind === 'one' ? P.COST.one : P.gemCost(c.n);
    ctx.UI.confirmBuy({ title: '배지로 ' + c.n + '번 뽑을까요?', body: '뽑기권이 없어서 배지를 써요.', cost: ic('gem') + fmt(g), ok: '뽑기', onOk: function () { doPull(kind); } });
  }
  function doPull(kind) {
    if (busy) return;
    var c = plan()[kind], r, n = c.n;
    if (!c.ok) { toast('모자라요: ' + (kind === 'one' ? '뽑기권 1장 또는 배지 ' + P.COST.one : '뽑기권 2장 또는 배지 ' + P.gemCost(2))); return; }
    try { r = P.pull(S(), n, c.pay, Math.random, pullOpts()); } catch (e) { toast(e.code === 'NOT_ENOUGH' ? (c.pay === 'gems' ? '배지가 모자라요' : '뽑기권이 모자라요') : '뽑을 수 없어요'); return; }
    if (root.Team3QuestUI) root.Team3QuestUI.track('pull', r.length || n);
    ctx.persist();
    busy = true;
    var best = 'c';
    r.results.forEach(function (x) { if (P.GRADES.indexOf(x.g) > P.GRADES.indexOf(best)) best = x.g; });
    drawDraw();
    $('pets-wallet').innerHTML = walletHtml();
    gacha(r.results, best, function () {
      var res = $('pets-result');
      res.className = 'pet-result ' + (n === 1 ? 'n1' : n <= 10 ? 'n10' : 'nmany') + ' best-' + best;
      res.innerHTML = r.results.map(function (x) { return cardFace(x, 'pet-got'); }).join('');
      busy = false;
      draw();
      renderPartner();
    });
  }
  function cardFace(x, cls) {
    var sp = P.BY_ID[x.id], g = P.GRADE[x.g];
    var tag = x.isNew ? '<em class="isnew">NEW</em>' : x.treats ? '<em>' + ic('treat') + '+' + x.treats + '</em>' : '<em>★' + x.star + '</em>';
    return '<div class="' + cls + ' g-' + x.g + '" style="--gc:' + g.color + '">' +
      A.draw(x.id, { grade: x.g, mood: x.g === 'l' || x.g === 'h' ? 'happy' : null }) +
      '<span><b style="color:' + g.color + '">' + g.name + '</b> ' + esc(P.nameOf(S(), x.key) || sp.name) + '</span>' + tag + '</div>';
  }

  /*
   * 뽑기 연출(0.3.1) — 화면 전체.
   *   1 증거 상자가 떨어지고 흔들린다. 틈새 빛 색 = 가장 높은 등급(영웅·전설은 파랑으로 시작해 바뀌는 "승급").
   *   2 뚜껑이 날아가고 빛줄기(등급 색)가 터진다. 전설은 금빛 번쩍 + 화면 흔들림 + 반짝이.
   *   3 카드: 1회는 가운데 한 장이 크게 뒤집힌다. 10회는 뒷면 10장이 펼쳐지고 차례로 뒤집힌다(높은 등급 카드는 뒷면도 빛난다).
   *   화면을 누르면 다음 단계로 건너뛴다. 움직임 줄이기 설정이면 바로 카드만.
   */
  var GX_COLOR = { c: '#E8EDF5', r: '#5BB2E8', h: '#B07CF0', l: '#FFD23F' };
  var BOX = '<svg viewBox="0 0 200 170" aria-hidden="true">' +
    '<defs><linearGradient id="gxBox" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C9945C"/><stop offset="1" stop-color="#8F5E2E"/></linearGradient>' +
    '<linearGradient id="gxLid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DDA96E"/><stop offset="1" stop-color="#A9743E"/></linearGradient></defs>' +
    '<g class="gx-body"><rect x="22" y="62" width="156" height="100" rx="8" fill="url(#gxBox)" stroke="#5E3C1C" stroke-width="4"/>' +
    '<rect x="22" y="96" width="156" height="20" fill="#FFD23F" stroke="#5E3C1C" stroke-width="3"/>' +
    '<text x="100" y="111" font-size="13" font-weight="700" text-anchor="middle" fill="#1B1E24" font-family="IBM Plex Sans KR" letter-spacing="2">증거, EVIDENCE</text>' +
    '<g transform="rotate(-10 140 140)"><rect x="112" y="124" width="54" height="26" rx="5" fill="none" stroke="#C0392B" stroke-width="3"/><text x="139" y="143" font-size="15" font-weight="700" text-anchor="middle" fill="#C0392B" font-family="IBM Plex Sans KR">3팀</text></g></g>' +
    '<rect class="gx-seam" x="26" y="58" width="148" height="8" rx="4"/>' +
    '<g class="gx-lid"><rect x="14" y="40" width="172" height="26" rx="7" fill="url(#gxLid)" stroke="#5E3C1C" stroke-width="4"/><rect x="88" y="40" width="24" height="26" fill="#FFD23F" stroke="#5E3C1C" stroke-width="3"/></g></svg>';

  function gacha(results, best, done) {
    var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var n = results.length, el = document.createElement('div'), timers = [], phase = 'box';
    var startCol = best === 'h' || best === 'l' ? GX_COLOR.r : GX_COLOR[best];
    // 0.4.1 가진 만큼 뽑기: 1장 · 2~10장 · 11장 이상(작은 카드, 열 수를 늘린다)
    el.className = 'gx best-' + best + (n === 1 ? ' one' : n <= 10 ? ' ten' : ' many');
    el.style.setProperty('--cols', n <= 10 ? 5 : n <= 24 ? 6 : n <= 35 ? 7 : 8);
    el.style.setProperty('--gx', startCol);
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', '뽑기 결과');
    el.innerHTML = '<div class="gx-rays"></div><div class="gx-box">' + BOX + '</div><div class="gx-cards"></div><div class="gx-flash"></div>' +
      '<div class="gx-spark"></div><div class="gx-foot"><span class="gx-hint">화면을 누르면 넘어가요</span><button class="primary gx-ok" hidden>확인</button></div>';
    document.body.appendChild(el);
    var cards = el.querySelector('.gx-cards');
    cards.innerHTML = results.map(function (x, i) {
      return '<div class="gx-card g-' + x.g + '" style="--gc:' + P.GRADE[x.g].color + ';--i:' + i + '"><div class="gx-in">' +
        '<div class="gx-back"><span>3</span></div>' + cardFace(x, 'gx-face') + '</div></div>';
    }).join('');
    function later(f, ms) { timers.push(setTimeout(f, ms)); }
    function snd(f) { try { f(ctx.UI.sfx); } catch (e) { /* 소리 실패는 무시 */ } }
    function clear() { timers.forEach(clearTimeout); timers = []; }

    function openBox() {
      clear(); phase = 'open';
      el.style.setProperty('--gx', GX_COLOR[best]);
      el.classList.add('opened');
      snd(function (s) { s.coin(); });
      if (best === 'h' || best === 'l') snd(function (s) { s.none(); });
      if (best === 'l') { el.classList.add('legend'); ctx.UI.buzz([30, 60, 30, 60, 90]); }
      else ctx.UI.buzz(20);
      later(showCards, reduce ? 0 : best === 'l' ? 1100 : 650);
    }
    function showCards() {
      clear(); phase = 'cards';
      el.classList.add('cards');
      // 장수가 많아도 다 뒤집히는 데 2.6초 안쪽
      var cs = el.querySelectorAll('.gx-card'), step = n === 1 ? 0 : Math.min(170, Math.floor(2600 / n)), lead = n === 1 ? 250 : 450;
      var at = [], tt = lead;
      results.forEach(function (x, i) { if (i) tt += step; if (x.g === 'l') tt += n > 1 ? 450 : 250; at.push(tt); if (n > 1 && x.g === 'l') tt += 500; else if (n > 1 && x.g === 'h') tt += 220; });
      cs.forEach(function (cd, i) {
        later(function () {
          cd.classList.add('flip');
          var g = results[i].g;
          snd(function (s) { if (g === 'l' || g === 'h') s.none(); else s.pick(3 + (i % 5)); });
          if (g === 'l') ctx.UI.buzz([40, 40, 80]); else if (g === 'h') ctx.UI.buzz(25);
          // 0.9.2 여러 번 뽑기: 영웅 · 전설 카드가 뒤집힐 때 화면도 번쩍(한 번 뽑기는 상자 연출로 이미 보여 준다)
          if (n > 1 && (g === 'l' || g === 'h')) { el.classList.remove('hit-l', 'hit-h'); void el.offsetWidth; el.classList.add('hit-' + g); }
        }, reduce ? 0 : at[i]);
      });
      later(finish, reduce ? 0 : at[n - 1] + 700);
    }
    function finish() {
      clear(); phase = 'done';
      el.querySelectorAll('.gx-card').forEach(function (cd) { cd.classList.add('flip'); });
      el.querySelector('.gx-hint').hidden = true;
      var ok = el.querySelector('.gx-ok');
      ok.hidden = false;
      try { ok.focus({ preventScroll: true }); } catch (e) { /* 옛 브라우저 */ }
    }
    function close() {
      clear();
      el.classList.add('out');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
      done();
    }
    el.addEventListener('click', function (e) {
      if (phase === 'box') openBox();
      else if (phase === 'open') showCards();
      else if (phase === 'cards') finish();
      else close();   // 다 보여 준 뒤에는 어디를 눌러도 닫힌다
    });

    if (reduce) { openBox(); showCards(); finish(); return; }
    // 상자 흔들기: 틱 소리가 점점 높게. 영웅·전설은 마지막에 색이 바뀐다(승급)
    later(function () { el.classList.add('shake'); }, 520);
    [0, 1, 2, 3].forEach(function (k) { later(function () { snd(function (s) { s.pick(1 + k * 2); }); }, 560 + k * 230); });
    if (best === 'h' || best === 'l') later(function () { el.style.setProperty('--gx', GX_COLOR[best]); el.classList.add('upgrade'); snd(function (s) { s.pick(9); }); }, 1250);
    later(openBox, best === 'l' ? 1800 : 1550);
  }

  /* 의상 탭(0.3.1): 파트너(없으면 일반 코기)에게 입혀 본 모습 · 간식/배지로 사기 · 파트너에게 입히기 */
  /* 0.8.4 옷장 맨 위 "누아르 각성" 카드: 파트너가 열렸으면 켜기/끄기, 아니면 잠긴 맛보기와 조건 */
  function closetNoir(p, x) {
    var N = noirArt();
    if (!N || !p.eq) return '';
    var own = P.looksOf(S(), p.eq), buyable = P.canNoir(S(), p.eq), can = own.length > 0, on = isNoir(p.eq), st = p.own[p.eq] || 1;
    return '<div class="pet-noircard' + (can ? '' : ' locked') + (on ? ' on' : '') + '"><span class="pnc-art' + (can ? ' noir-anim' : '') + '">' + N.draw(x.id, { grade: x.g, size: 84 }) + (can ? '' : '<i>' + LOCK + '</i>') + '</span>' +
      '<span class="pnc-tx"><b>코드네임 <em>' + esc(P.codename(x.id)) + '</em></b><small>' + (can ? '비밀 요원 모습의 반신 초상, 파트너 카드와 도감에서 보여요' : buyable ? '★5가 돼서 코드네임 그림을 살 수 있어요' : '이 파트너가 ★5가 되면 살 수 있어요, 현재 ★' + st) + '</small>' +
      (can ? '<button class="' + (on ? 'ghost' : 'primary') + '" data-noircl="' + (on ? 0 : 1) + '">' + (on ? '본명으로' : '코드네임으로') + '</button>' : buyable ? '<button class="primary" data-noirgo="1">그림 고르러 가기</button>' : '<button class="primary" data-noirprev="' + x.id + '">미리 보기</button>') + '</span></div>';
  }
  function drawCloset() {
    var p = pets(), x = P.parse(p.eq) || { id: 'corgi', g: 'c' }, cur = p.eq ? P.wearing(S(), p.eq) : '';
    var html = closetNoir(p, x) + '<p class="muted" style="font-size:12px;margin:0">모든 파트너가 함께 입어요. 파트너마다 다른 옷은 도감의 자세히에서 골라요.</p><div class="pet-closet-g">';
    P.OUTFITS.forEach(function (o) {
      var have = !!p.closet[o.id], open = P.outfitOpen(S(), o.id);
      var btns = have
        ? (p.eq ? (cur === o.id ? '<button class="ghost" data-wear="">벗기기</button>' : '<button class="primary" data-wear="' + o.id + '">파트너에게</button>') : '<button class="ghost" disabled>보유</button>')
        : !open ? '<button class="ghost" disabled>사건 ' + o.need + '부터</button>'
        : '<button class="ghost" data-outfit="' + o.id + '" data-pay="treats"' + (p.treats < o.treats ? ' disabled' : '') + '>' + ic('treat') + o.treats + '</button>' +
          '<button class="ghost" data-outfit="' + o.id + '" data-pay="gems"' + (S().gems < o.gems ? ' disabled' : '') + '>' + ic('gem') + o.gems + '</button>';
      html += '<div class="pet-cloth' + (have ? ' have' : '') + (cur === o.id ? ' on' : '') + '"><div class="pet-cloth-art">' + A.draw(x.id, { grade: x.g, outfit: o.id }) + '</div>' +
        '<b>' + esc(o.name) + '</b><div class="pet-cloth-btns">' + btns + '</div></div>';
    });
    $('pets-closet').innerHTML = html + '</div>';
  }

  function ownSummary() {
    var p = pets(), sum = {};
    Object.keys(p.own).forEach(function (k) { var x = P.parse(k); if (!x) return; var e = P.ownEffect(x.id, x.g, p.own[k]); Object.keys(e).forEach(function (q) { sum[q] = (sum[q] || 0) + e[q]; }); });
    Object.keys(sum).forEach(function (q) { if (P.CAPS[q] && sum[q] > P.CAPS[q]) sum[q] = P.CAPS[q]; });
    var lines = P.describe(sum);
    return lines.length ? lines.map(function (t) { return '<i>' + esc(t) + '</i>'; }).join('') : '아직 없어요. 파트너를 모으면 하나하나 쌓여요.';
  }
  function drawDex() {
    var p = pets(); if (tab === 'dex' && !$('pets-sheet').hidden) dexSeen = true;
    var st = P.sets(S()), gs = P.GRADES.map(function (g) {
      var have = P.SPECIES.filter(function (x) { return p.own[P.key(x.id, g)]; }).length;
      return '<span class="' + (st.grades[g] ? 'on' : '') + '" style="--gc:' + P.GRADE[g].color + '">' + P.GRADE[g].name + ' ' + have + '/' + P.SPECIES.length + '<i>' + esc(P.describe(P.GRADE_SET[g]).join(', ')) + '</i></span>';
    }).join('');
    var html = '<div class="pet-sum"><span class="label">보유 효과 합계<small>모은 파트너 모두, 항상 적용돼요</small></span><b>' + ownSummary() + '</b></div>' +
      '<div class="pet-sets"><span class="label">세트 보너스, 한 종류 네 등급 = 그 종류 보유 효과 두 배, 한 등급 ' + P.SPECIES.length + '종 = 아래 보너스</span><div>' + gs + '</div></div>' +
      '<div class="pet-dex-head"><span></span>' + P.GRADES.map(function (g) { return '<span style="color:' + P.GRADE[g].color + '">' + P.GRADE[g].name + '</span>'; }).join('') + '</div>';
    // 0.9.2 한정 파트너 줄은 맨 위(전설 칸 하나만 · 나머지 등급 칸은 "없음" 자리)
    (P.LIMITED || []).forEach(function (sp) {
      var k = P.key(sp.id, 'l'), st = p.own[k];
      html += '<div class="pet-dex-row lim"><span class="pet-dex-name"><b>' + esc(sp.name) + '</b><small>' + esc(sp.kind) + ', 한정</small><i class="siu">특수수사팀</i></span>' +
        '<span class="pet-cell none" aria-hidden="true"></span><span class="pet-cell none" aria-hidden="true"></span><span class="pet-cell none" aria-hidden="true"></span>' +
        '<button class="pet-cell' + (st ? ' have' : '') + (p.eq === k ? ' eq' : '') + '" data-k="' + k + '" style="--gc:' + P.GRADE.l.color + '" aria-label="한정 전설 ' + esc(sp.name) + (st ? ' ★' + st : ' 없음') + '">' +
        (st && isNoir(k) ? portrait(k, { id: sp.id, g: 'l' }, {}) : A.draw(sp.id, { grade: 'l' })) + (st ? starRow(st) : '') + (p.fresh && p.fresh[k] ? '<b class="pet-new">NEW</b>' : '') + '</button></div>';
    });
    // 0.9.2 새로 들어온 동물(since 가 큰 것)이 한정 줄 바로 아래 맨 위로
    P.SPECIES.map(function (sp, i) { return { sp: sp, i: i }; }).sort(function (a, b) { return (b.sp.since || 0) - (a.sp.since || 0) || a.i - b.i; }).forEach(function (o) {
      var sp = o.sp;
      html += '<div class="pet-dex-row"><span class="pet-dex-name"><b>' + esc(sp.name) + '</b><small>' + esc(sp.kind) + (st.species[sp.id] ? ', <em class="set">세트×2</em>' : '') + '</small></span>' +
        P.GRADES.map(function (g) {
          var k = P.key(sp.id, g), st = p.own[k];
          return '<button class="pet-cell' + (st ? ' have' : '') + (p.eq === k ? ' eq' : '') + '" data-k="' + k + '" style="--gc:' + P.GRADE[g].color + '" aria-label="' + P.GRADE[g].name + ' ' + esc(sp.name) + (st ? ' ★' + st : ' 없음') + '">' +
            (st && isNoir(k) ? portrait(k, { id: sp.id, g: g }, {}) : A.draw(sp.id, { grade: g })) + (st ? starRow(st) : '') + (p.fresh && p.fresh[k] ? '<b class="pet-new">NEW</b>' : '') + '</button>';
        }).join('') + '</div>';
    });
    // 0.12.4 나올 예정인 파트너: 이름도 그림도 "???" (눌러도 아무 일 없음)
    var soon = function (lim) {
      var n = (P.UPCOMING || []).filter(function (u) { return !!u.limited === lim; }).length, Q = '<span class="pet-cell soon" aria-hidden="true">?</span>', X = '<span class="pet-cell none" aria-hidden="true"></span>', out = '';
      if (!n) return '';
      out += '<div class="pet-dex-soon">' + (lim ? '한정 파트너 예정' : '다음 파트너 예정') + ' <b>' + n + '</b></div>';
      for (var q = 0; q < n; q++) out += '<div class="pet-dex-row soon" aria-label="준비 중인 파트너"><span class="pet-dex-name"><b>???</b><small>' + (lim ? '한정, 준비 중' : '준비 중') + '</small>' + (lim ? '<i class="siu">특수수사팀</i>' : '') + '</span>' + (lim ? X + X + X + Q : Q + Q + Q + Q) + '</div>';
      return out;
    };
    html += soon(false) + soon(true);
    $('pets-dex').innerHTML = html;
  }

  function drawDetail() {
    var box = $('pets-detail'), x = P.parse(detailKey);
    box.hidden = !x;
    var pb = $('pets-pop-back'); if (pb) pb.hidden = !x;   // 0.10.5 팝업 뒤 어둡게
    if (!x) { box.innerHTML = ''; return; }
    var p = pets(), sp = P.BY_ID[x.id], g = P.GRADE[x.g], st = p.own[detailKey] || 0, shown = st || 1;
    var own = P.describe(P.ownEffect(x.id, x.g, shown)), eq = P.describe(P.eqEffect(x.id, x.g, shown));
    var zapLocked = sp.zap && x.g !== 'h' && x.g !== 'l' ? '<small class="muted">⚡ ' + esc(P.describe(sp.zap).join(', ').replace(/⚡ /g, '')) + ' — 영웅, 전설 등급에서 열려요</small>' : '';
    var swapCost = g.swap, canSwap = st < P.STAR_MAX && !sp.limited;   // 한정 파트너는 간식·선택권으로 못 데려와요
    box.style.setProperty('--gc', g.color);
    box.classList.toggle('nz', !!(st && isNoir(detailKey)));   // 0.13.15 코드네임이면 그림을 창 너비로 크게
    box.innerHTML = '<button class="pet-x" id="pets-detail-x" aria-label="자세히 닫기">×</button>' +
      '<div class="pet-big' + (st ? '' : ' locked') + (st && isNoir(detailKey) ? ' noir" data-zoom="' + noirKey(detailKey, x) : '') + '">' + (st ? portrait(detailKey, x, { grade: x.g, anim: true, outfit: P.wearing(S(), detailKey) }) : A.draw(x.id, { grade: x.g })) + (st && isNoir(detailKey) ? ZOOM_I : '') + '</div>' +
      '<div class="pet-info"><span class="label" style="color:' + g.color + '">' + g.name + ' ' + esc(sp.kind) + (sp.limited ? '<i class="siu">특수수사팀</i>' : '') + '</span><h3>' + (st ? ttl(detailKey) : '') + esc(st ? P.nameOf(S(), detailKey) : sp.name) + ' ' + (st ? stars(st) : '<span class="muted" style="font-size:13px">아직 없음</span>') + '</h3>' +
        (st && isNoir(detailKey) ? '<small class="pet-cn">코드네임 ' + esc(P.codename(x.id)) + '</small>' : '') +
        '<small class="muted">' + esc(sp.line) + '</small></div>' +
      '<div class="pet-eff"><div><em>보유 효과</em><b class="own">' + esc(own.join(', ')) + '</b><small>갖고만 있어도 항상 적용</small></div>' +
        '<div><em>장착 효과</em><b class="eq">' + esc(eq.join(', ')) + '</b><small>파트너 1마리만' + (eq.join('').indexOf('⚡') >= 0 ? ', ⚡는 특별 출동에서 꺼짐' : '') + '</small>' + zapLocked + '</div></div>' +
      (st ? '' : '<p class="muted" style="font-size:12px">아직 없어서 ★1 기준으로 보여 줘요.</p>') +
      (st ? nameRow() : '') +
      noirRow(x, st) +
      (st && !isNoir(detailKey) ? outfitSelect() : '') +
      (st && root.Team3AchUI ? '<div class="pet-name">' + root.Team3AchUI.titleSelect('pets-ttl', (S().ach && S().ach.pet[detailKey]) || '', '칭호') + '</div>' : '') +
      '<div class="pet-acts">' +
        (st ? (p.eq === detailKey ? '<span class="pet-cur">✓ 현재 파트너</span>' : '<button class="primary" id="pets-equip">파트너로</button>') : '') +
        (x.g === 'l' && canSwap && p.picks && p.picks.l > 0 ? '<button class="primary" id="pets-pick">' + (st ? '★ 올리기' : '데려오기') + '<small>전설 선택권 ' + p.picks.l + '장</small></button>' : '') +
        (canSwap ? '<button class="ghost" id="pets-swap"' + (p.treats < swapCost ? ' disabled' : '') + '>' + (st ? '★ 올리기' : '데려오기') + '<small>' + ic('treat') + '간식 ' + swapCost + '개</small></button>' : '') +
      '</div>';
  }
  /* 0.8.4 각성 줄(자세히): 열렸으면 "귀여운 모습 / 누아르 각성" 고르기, 아직이면 어두운 맛보기 그림 + 여는 조건 */
  var LOCK = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2" fill="#FFD23F"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="#FFD23F" stroke-width="2.2" fill="none"/></svg>';
  /* 0.13.15 코드네임 그림은 ★5가 되면 장면(사무실 · 현장)마다 산다. 잠긴 장면을 누르면(lookSel) 아래에 그림과 값이 나온다 */
  var lookSel = '';
  var ZOOM_I = '<i class="nz-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16"><circle cx="10.5" cy="10.5" r="6" stroke="#fff" stroke-width="2.4" fill="none"/><path d="M15 15l5 5M10.5 7.5v6M7.5 10.5h6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg></i>';
  var LOCK_S = '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" class="lk"><rect x="5" y="10.5" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" stroke-width="2.4" fill="none"/></svg>';
  function lookScenes(id) { var N = noirArt(), l = P.LOOKS.filter(function (q) { return N && N.has(id, q.id); }); return l.length ? l : [P.LOOKS[0]]; }
  function noirRow(x, st) {
    var N = noirArt();
    if (!N) return '';
    var k = detailKey, can = P.canNoir(S(), k), own = P.looksOf(S(), k), on = isNoir(k), sc = on ? P.noirScene(S(), k) : '';
    if (!can && !own.length) {
      return '<div class="pet-noir locked"><span class="pn-thumb">' + N.draw(x.id, { grade: x.g, scene: 'a', size: 64 }) + '</span>' + (N.has(x.id, 'b') ? '<span class="pn-thumb">' + N.draw(x.id, { grade: x.g, scene: 'b', size: 64 }) + '</span>' : '') +
        '<span class="pn-tx"><b>코드네임 <em>' + esc(P.codename(x.id)) + '</em></b><small>' + (st ? '★5가 되면 살 수 있어요' : '데려와서 ★5가 되면 살 수 있어요') + '</small>' + (st ? '<span class="pn-prog">현재 ★' + st + ' / ' + P.STAR_MAX + '</span>' : '') + '</span>' +
        '<button class="primary pn-prev" data-noirprev="' + x.id + '">미리 보기</button></div>';
    }
    var scenes = lookScenes(x.id), C = P.LOOK_COST, p = pets();
    var seg = '<button class="' + (on ? '' : 'on') + '" data-noir="0">본명</button>' + scenes.map(function (l) {
      var have = own.indexOf(l.id) >= 0;
      return have ? '<button class="' + (sc === l.id ? 'on' : '') + '" data-noir="' + (l.id === 'b' ? 'b' : '1') + '">' + esc(l.name) + '</button>'
        : '<button class="lkb' + (lookSel === l.id ? ' sel' : '') + '" data-lookpick="' + l.id + '">' + LOCK_S + esc(l.name) + '</button>';
    }).join('');
    var buy = '';
    if (lookSel && own.indexOf(lookSel) < 0) {
      var ln = (P.LOOKS.filter(function (l) { return l.id === lookSel; })[0] || {}).name || '';
      buy = '<div class="pn-buy"><span class="pn-buy-pic">' + N.draw(x.id, { grade: x.g, scene: lookSel, size: 96 }) + '</span><span class="pn-buy-tx"><b>' + esc(ln) + ' 그림</b></span><span class="pn-buy-btns">' +
        '<button class="ghost" data-lookbuy="' + lookSel + '" data-pay="treats"' + (p.treats < C.treats ? ' disabled' : '') + '>' + ic('treat') + C.treats + '</button>' +
        '<button class="primary" data-lookbuy="' + lookSel + '" data-pay="gems"' + (S().gems < C.gems ? ' disabled' : '') + '>' + ic('gem') + C.gems + '</button></span></div>';
    }
    return '<div class="pet-noir"><span class="label">코드네임, ' + esc(P.codename(x.id)) + '</span><div class="pn-seg">' + seg + '</div>' + buy +
      (on ? '<small class="muted"><span class="ln">코드네임일 땐 의상이 안 보여요</span><span class="ln">상황실 안에서는 본명 모습 그대로예요</span></small>' : '') +
      (!own.length ? '' : P.fxOn(S(), x.id) ? '<div class="pn-fx own"><b>움직이는 연출</b><span>보유</span></div>' : '<div class="pn-fx"><b>움직이는 연출</b><small>비, 불빛, 카메라가 움직여요</small><button class="primary" data-fxbuy="' + x.id + '">' + ic('gem') + P.FX_GEMS + '</button></div>') + '</div>';
  }
  function outfitSelect() {
    var p = pets(), have = P.OUTFITS.filter(function (o) { return p.closet[o.id]; }), cur = P.wearing(S(), detailKey);
    return '<div class="pet-name"><label class="ach-pick"><span>의상</span><select id="pets-wear"' + (have.length ? '' : ' disabled') + '>' +
      '<option value="">' + (have.length ? '안 입음' : '의상 탭에서 사요') + '</option>' +
      have.map(function (o) { return '<option value="' + o.id + '"' + (o.id === cur ? ' selected' : '') + '>' + esc(o.name) + '</option>'; }).join('') + '</select></label></div>';
  }
  /* 이름 짓기(0.3.0): 게임 전체 첫 한 번은 무료, 그 뒤로 배지. 기본 이름으로 되돌리기는 무료 */
  var naming = false;
  function nameRow() {
    var c = P.renameCost(S()), custom = !!(pets().names[detailKey]), tags = S().nameTags || 0, I = root.SuspectsIdle;
    var price = !c ? '첫 한 번 무료' : tags ? ic('tag') + '이름표 1장 (' + tags + '장)' : ic('gem') + c;
    if (!naming) return '<div class="pet-name"><button class="linkish" id="pets-name">이름 짓기, ' + price + '</button>' +
      (custom ? '<button class="linkish muted" id="pets-name-reset">기본 이름으로</button>' : '') + '</div>' +
      (c && !tags && I && I.NAME_TAGS ? '<div class="pet-name"><button class="linkish muted" id="pets-tags"' + (S().gems < I.NAME_TAGS.gems ? ' disabled' : '') + '>' + ic('tag') + '이름표 ' + I.NAME_TAGS.n + '장, ' + ic('gem') + I.NAME_TAGS.gems + ' (팀장 이름에도 써요)</button></div>' : '');
    return '<div class="pet-name on"><input id="pets-name-in" maxlength="' + (P.NAME_MAX * 2) + '" autocomplete="off" placeholder="' + P.NAME_MAX + '자까지">' +
      '<button class="primary" id="pets-name-ok">' + (!c ? '무료' : tags ? ic('tag') + '이름표' : ic('gem') + c) + '</button><button class="ghost" id="pets-name-no">취소</button></div>';
  }
  function startNaming() {
    naming = true; drawDetail();
    var inp = $('pets-name-in');
    if (inp) { inp.value = P.nameOf(S(), detailKey); try { inp.focus(); inp.select(); } catch (e) { /* 무시 */ } }
  }
  function saveName() {
    var inp = $('pets-name-in'), r;
    if (!inp) return;
    try { r = P.rename(S(), detailKey, inp.value); }
    catch (e) { toast({ EMPTY: '이름을 적어 주세요', SAME: '같은 이름이에요', NOT_ENOUGH: '배지가 모자라요' }[e.code] || '바꿀 수 없어요'); return; }
    ctx.persist(); naming = false;
    try { ctx.UI.sfx.coin(); } catch (e2) { /* 무시 */ }
    toast('이제 이름은 "' + r.name + '"' + (r.paid ? ', 배지 ' + r.paid + '개' : r.tag ? ', 이름표 1장' : ''));
    renderPartner(); draw(); ctx.render();
  }
  function showDetail(k) {
    naming = false; lookSel = '';
    detailKey = k;
    if (P.seeFresh && pets().fresh && pets().fresh[k]) { P.seeFresh(S(), k); ctx.persist(); draw(); return; }   // 0.10.6 본 파트너는 NEW 끔(draw 가 자세히도 그린다)
    drawDetail();
    var bx = $('pets-detail'); if (bx) bx.scrollTop = 0;   // 0.10.5 창은 그대로 두고 팝업만 띄운다
  }

  /* ---------- 연결 ---------- */
  /* ---------- 0.12.0 파트너 배경 고르기 ----------
   *   그림은 Team3BgPics(없으면 색만). 그림 주소가 길어서 한 번만 <style> 로 넣고, 칸에는 클래스(bg-id)만 단다(1초마다 다시 그려도 깜빡이지 않게). */
  var bgSel = '', bgEl = null;
  function bgStyle() {
    var pics = root.Team3BgPics; if (!pics || document.getElementById('bg-pics-css')) return;
    var st = document.createElement('style'); st.id = 'bg-pics-css';
    st.textContent = Object.keys(pics).map(function (k) { return '.bg-' + k + '{background-image:url(' + pics[k] + ')}'; }).join('\n');
    document.head.appendChild(st);
  }
  /* ---------- 0.13.6 작은 안내 창: 재화 안내 · 코드네임 미리 보기 ---------- */
  var gdEl = null, gdDraw = null;
  function closeGd() { var was = !!gdEl; if (gdEl && gdEl.parentNode) gdEl.parentNode.removeChild(gdEl); gdEl = null; gdDraw = null; return was; }
  function openGd(drawFn, onTap) {
    closeGd(); gdEl = document.createElement('div'); gdEl.className = 'bgp-back gd-back'; gdDraw = drawFn;
    gdEl.addEventListener('click', function (e) {
      e.stopPropagation();
      if (e.target === gdEl || e.target.closest('[data-gdx]')) { closeGd(); return; }
      if (onTap) onTap(e);
    });
    gdEl.innerHTML = '<div class="bgp-box gd-box" role="dialog" aria-modal="true">' + drawFn() + '</div>';
    $('toast').parentNode.appendChild(gdEl);
  }
  function gdRedraw() { if (gdEl && gdDraw) gdEl.firstChild.innerHTML = gdDraw(); }
  /* 재화마다: 얻는 곳 · 사는 곳 · 쓰는 곳. 실제로 들어오고 나가는 길만 적는다(코드와 어긋나면 여기부터 고친다) */
  function curInfo(k) {
    var live = root.Team3Monet && root.Team3Monet.PAY_MODE !== 'gems';
    if (k === 'gem') return { name: '배지', have: S().gems,
      get: ['계급 승진', '사건 종결', '특별 출동 메달', '임무', '출석', '업적', '시즌 패스', '매점 광고 보기'],
      buy: [live ? '매점의 배지 상품' : '정식 출시 때 매점에서 팔아요'],
      use: ['파트너 뽑기', '파트너 배경', '의상', '움직이는 연출', '칭호', '매점 상품', '이름 바꾸기', '수사비가 모자랄 때 준비물'] };
    if (k === 'ticket') return { name: '뽑기권', have: pets().tickets,
      get: ['처음 선물', '사건 종결', '계급 승진', '특별 출동 메달', '임무 상자', '출석', '업적', '시즌 패스', '매점 광고 보기'],
      buy: ['매점 묶음 상품', '뽑기권이 없으면 배지로 바로 뽑아요'],
      use: ['파트너 뽑기'] };
    return { name: '간식', have: pets().treats,
      get: ['★5인 파트너를 또 뽑았을 때', '파트너와 친해질 때', '시즌 패스', '매점 광고 보기'],
      buy: ['따로 팔지 않아요'],
      use: ['원하는 파트너 데려오기', '의상', '파트너 배경'] };
  }
  function openCur(k) {
    if (k !== 'gem' && k !== 'ticket' && k !== 'treat') return;
    openGd(function () {
      var c = curInfo(k), row = function (label, cls, list) { return '<div class="gd-sec"><span class="label">' + label + '</span><div class="gd-chips ' + cls + '">' + list.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div></div>'; };
      return '<div class="bgp-head"><b class="gd-ttl">' + ic(k) + esc(c.name) + '</b><span class="bgp-w">가진 수 ' + fmt(c.have) + '</span><button class="bgp-x" data-gdx aria-label="닫기">×</button></div>' +
        row('얻는 곳', 'g-get', c.get) + row('사는 곳', 'g-buy', c.buy) + row('쓰는 곳', 'g-use', c.use);
    });
  }
  /* 코드네임 미리 보기: 아직 못 받은 파트너도 사무실 · 현장 그림을 크게 보고, 어떻게 받는지 한눈에 */
  function openNoirPrev(id, g, st) {
    var N = noirArt(); if (!N) return;
    var sc = 'a', two = N.has(id, 'a') && N.has(id, 'b');
    openGd(function () {
      var k = id + ':' + g, own = P.looksOf(S(), k), can = P.canNoir(S(), k), C = P.LOOK_COST;
      return '<div class="bgp-head"><b>코드네임 ' + esc(P.codename(id)) + '</b><button class="bgp-x" data-gdx aria-label="닫기">×</button></div>' +
        '<div class="gd-pic" data-zoom="' + (N.has(id, sc) ? id + '_' + sc : id) + '">' + N.draw(id, { grade: g, scene: sc, size: 300 }) + ZOOM_I + '</div>' +
        (two ? '<div class="pn-seg"><button class="' + (sc === 'a' ? 'on' : '') + '" data-gdsc="a">사무실</button><button class="' + (sc === 'b' ? 'on' : '') + '" data-gdsc="b">현장</button></div>' : '') +
        '<div class="gd-sec"><span class="label">사는 법</span><div class="gd-chips g-get">' +
          (own.length ? '<span>가진 장면 ' + own.length + ' / ' + lookScenes(id).length + '</span>' : can ? '<span>★5 달성, 바로 살 수 있어요</span>' : '<span>이 파트너 ★5</span><span>현재 ★' + st + ' / ' + P.STAR_MAX + '</span>') + '</div></div>' +
        '<div class="gd-sec"><span class="label">장면 하나 값</span><div class="gd-chips g-buy"><span>' + ic('treat') + C.treats + '</span><span>' + ic('gem') + C.gems + '</span></div></div>' +
        '<div class="gd-sec"><span class="label">바꾸는 곳</span><div class="gd-chips g-use"><span>도감에서 파트너 누르기</span><span>사무실, 현장 중 사서 고르기</span></div></div>' +
        '<div class="gd-sec"><span class="label">움직이는 연출</span><div class="gd-chips g-buy"><span>코드네임 그림을 산 뒤 ' + ic('gem') + P.FX_GEMS + '</span></div></div>';
    }, function (e) { var zb = e.target.closest('[data-zoom]'); if (zb) { openZoom(zb.getAttribute('data-zoom')); return; } var b = e.target.closest('[data-gdsc]'); if (b) { sc = b.getAttribute('data-gdsc'); gdRedraw(); } });
  }
  /* ---------- 0.13.15 크게 보기(확대 컷): 코드네임 그림을 화면 가득, 누르면 2.5배로 확대해 손가락으로 훑어 본다 ---------- */
  var zEl = null;
  function noirKey(k, x) { var N = noirArt(), sc = P.noirScene(S(), k); return N && N.has(x.id, sc) ? x.id + '_' + sc : N && N.has(x.id, 'a') ? x.id + '_a' : x.id; }
  function closeZoom() { var was = !!zEl; if (zEl && zEl.parentNode) zEl.parentNode.removeChild(zEl); zEl = null; return was; }
  function openZoom(fk) {
    var NP = root.Team3NoirPics || {}, NB = root.Team3NoirBig || {}, small = NP[fk];
    if (!small) return;
    closeZoom(); zEl = document.createElement('div'); zEl.className = 'nz-view';
    zEl.innerHTML = '<div class="nz-sc"><img alt="" src="' + small + '"></div><button class="nz-x" aria-label="닫기">×</button>';
    $('toast').parentNode.appendChild(zEl);
    var el = zEl, img = el.querySelector('img'), sc = el.querySelector('.nz-sc'), zoomed = false;
    // 큰 그림은 볼 때만 받는다. 다 받으면 바꿔 끼우고, 못 받으면(오프라인) 작은 그림 그대로
    if (NB[fk]) { var hi = new Image(); hi.onload = function () { if (zEl === el) img.src = NB[fk]; }; hi.src = NB[fk]; }
    el.addEventListener('click', function (e) {
      e.stopPropagation();
      if (e.target.closest('.nz-x')) { closeZoom(); return; }
      if (e.target === img) {
        var r = img.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
        zoomed = !zoomed; el.classList.toggle('on', zoomed);
        if (zoomed) { sc.scrollLeft = fx * img.offsetWidth - sc.clientWidth / 2; sc.scrollTop = fy * img.offsetHeight - sc.clientHeight / 2; }
        return;
      }
      if (!zoomed) closeZoom();
    });
  }
  function openBg() {
    if (bgEl) return;
    bgSel = pets().bg; bgEl = document.createElement('div'); bgEl.className = 'bgp-back';
    bgEl.addEventListener('click', function (e) {
      e.stopPropagation();
      var t = e.target.closest('[data-bg],[data-bgact]'), s = S(), b = P.BG_BY[bgSel];
      if (!t) { var cu = e.target.closest('[data-cur]'); if (cu) openCur(cu.getAttribute('data-cur')); else if (e.target === bgEl) closeBg(); return; }
      if (t.hasAttribute('data-bg')) { bgSel = t.getAttribute('data-bg'); drawBg(); return; }
      var act = t.getAttribute('data-bgact');
      if (act === 'x') { closeBg(); return; }
      if (act === 'use') { try { P.useBg(s, bgSel); ctx.persist(); toast(b.name + ' 배경으로 바꿨어요'); } catch (e2) { toast('바꿀 수 없어요'); } renderPartner(); drawBg(); return; }
      var need = act === 'gems' ? b.gems : b.treats, have = act === 'gems' ? s.gems : pets().treats;
      if (have < need) { toast((act === 'gems' ? '배지가' : '간식이') + ' 모자라요'); return; }
      ctx.UI.confirmBuy({ title: b.name + ' 배경을 살까요?', body: '', cost: ic(act === 'gems' ? 'gem' : 'treat') + need, onOk: function () {
        try { P.buyBg(S(), b.id, act); ctx.persist(); toast(b.name + ' 배경을 샀어요'); try { ctx.UI.sfx.coin(); } catch (e4) { /* 무시 */ } } catch (e3) { toast(e3.code === 'NOT_ENOUGH' ? '재화가 모자라요' : '살 수 없어요'); }
        if (ctx.render) ctx.render(); renderPartner(); drawBg();
      } });
    });
    $('toast').parentNode.appendChild(bgEl); drawBg(); fxStart();
  }
  function closeBg() { var was = !!bgEl; if (bgEl && bgEl.parentNode) bgEl.parentNode.removeChild(bgEl); bgEl = null; return was; }
  function drawBg() {
    if (!bgEl) return;
    var s = S(), p = pets(), b = P.BG_BY[bgSel] || P.BG_BY.office, own = !!p.bgs[b.id], x = P.parse(p.eq), isL = !!(x && x.g === 'l'), btn;
    if (own) btn = p.bg === b.id ? '<button class="ghost" disabled>사용 중</button>' : '<button class="primary" data-bgact="use">이 배경 쓰기</button>';
    else btn = (b.treats ? '<button class="ghost" data-bgact="treats">' + ic('treat') + b.treats + '</button>' : '') + '<button class="primary" data-bgact="gems">' + ic('gem') + b.gems + '</button>';
    bgEl.innerHTML = '<div class="bgp-box" role="dialog" aria-modal="true" aria-label="파트너 배경">' +
      '<div class="bgp-head"><b style="white-space:nowrap">배경 <em class="bgp-n">' + Object.keys(p.bgs || {}).length + ' / ' + P.BGS.length + '</em></b><button class="bgp-w" data-cur="treat">' + ic('treat') + fmt(p.treats) + '</button><button class="bgp-w" data-cur="gem">' + ic('gem') + fmt(s.gems) + '</button><button class="bgp-x" data-bgact="x" aria-label="닫기">×</button></div>' +
      '<div class="bgp-view pet-bg bg-' + b.id + '"><canvas data-k="' + b.id + '"></canvas>' + (x ? '<div class="bgp-pet">' + portrait(p.eq, x, { grade: x.g, outfit: P.wearing(s, p.eq) }) + '</div>' : '') + '</div>' +
      '<div class="bgp-info"><b>' + esc(b.name) + '</b><small>' + esc(b.desc) + '</small>' + (b.legend && own && !isL ? '<small class="warn">현재 파트너가 전설이 아니라서 사무실이 보여요.</small>' : '') + '</div>' +
      '<div class="bgp-grid">' + P.BGS.map(function (o) {
        return '<button class="bgp-cell bg-' + o.id + (o.id === b.id ? ' on' : '') + (p.bgs[o.id] ? '' : ' lock') + '" data-bg="' + o.id + '" aria-label="' + esc(o.name) + '">' +
          (p.bg === o.id ? '<i class="use">사용 중</i>' : !p.bgs[o.id] ? '<i class="lk">' + ic('gem') + o.gems + '</i>' : '') + (o.legend ? '<i class="lg">전설</i>' : '') + '</button>';
      }).join('') + '</div>' +
      '<div class="bgp-acts">' + btn + '</div></div>';
  }

  function mount(c) {
    ctx = c; bgStyle();
    $('pets-x').addEventListener('click', close);
    // 0.10.5 자세히 팝업은 창(.sheet) 밖, 어두운 바탕 위에 띄운다
    $('pets-sheet').appendChild($('pets-pop-back')); $('pets-sheet').appendChild($('pets-detail'));
    $('pets-pop-back').addEventListener('click', function (e) { e.stopPropagation(); detailKey = ''; naming = false; drawDetail(); });
    $('pets-sheet').addEventListener('click', function (e) {
      if (e.target === this) { close(); return; }
      var zb = e.target.closest('[data-zoom]'); if (zb) { openZoom(zb.getAttribute('data-zoom')); return; }   // 0.13.15 크게 보기
      var t = e.target.closest('button');
      if (!t) return;
      if (t.hasAttribute('data-cur')) { openCur(t.getAttribute('data-cur')); return; }
      if (t.hasAttribute('data-noirprev')) { var nid = t.getAttribute('data-noirprev'), kk = detailKey && (P.parse(detailKey) || {}).id === nid ? detailKey : pets().eq, px = P.parse(kk) || { g: 'r' }; openNoirPrev(nid, px.g, pets().own[kk] || 0); return; }
      if (t.id === 'pets-one') askPull('one');
      else if (t.id === 'pets-ten') askPull('multi');
      else if (t.getAttribute('data-tab')) { if (tab === 'dex' && t.getAttribute('data-tab') !== 'dex') leaveDex(); tab = t.getAttribute('data-tab'); detailKey = ''; draw(); }
      else if (t.classList.contains('pet-cell')) showDetail(t.getAttribute('data-k'));
      else if (t.id === 'pets-detail-x') { detailKey = ''; naming = false; drawDetail(); }
      else if (t.getAttribute('data-outfit')) {
        // 0.10.5 의상도 사기 전에 묻는다
        var oid = t.getAttribute('data-outfit'), opay = t.getAttribute('data-pay'), od = P.OUTFIT_BY ? P.OUTFIT_BY[oid] : P.OUTFITS.filter(function (z) { return z.id === oid; })[0];
        var have = opay === 'gems' ? S().gems : pets().treats, need = od ? od[opay === 'gems' ? 'gems' : 'treats'] : 0;
        if (have < need) { toast((opay === 'gems' ? '배지' : '간식') + '가 모자라요, ' + need + '개 필요'); return; }
        ctx.UI.confirmBuy({ title: (od ? od.name : '의상') + '을(를) 살까요?', body: '한 번 사면 모든 파트너가 함께 입을 수 있어요.', cost: ic(opay === 'gems' ? 'gem' : 'treat') + need, onOk: function () {
          try { var o = P.buyOutfit(S(), oid, opay); ctx.persist(); toast(o.name + '을(를) 옷장에 넣었어요'); try { ctx.UI.sfx.coin(); } catch (e6) { /* 무시 */ } }
          catch (e7) { toast(e7.code === 'NOT_ENOUGH' ? (opay === 'gems' ? '배지가 모자라요' : '간식이 모자라요') : '살 수 없어요'); }
          draw(); ctx.render();
        } });
      }
      else if (t.hasAttribute('data-wear')) {
        try { P.wear(S(), pets().eq, t.getAttribute('data-wear')); ctx.persist(); renderPartner(); } catch (e8) { toast('입힐 수 없어요'); }
        draw();
      }
      else if (t.id === 'pets-pick') {
        try { var rp = P.usePick(S(), P.parse(detailKey).id); ctx.persist(); try { ctx.UI.sfx.none(); } catch (e9) { /* 무시 */ } toast(rp.isNew ? '전설 ' + P.nameOf(S(), detailKey) + '(이)가 왔어요!' : '★' + rp.star + '로 올랐어요'); }
        catch (e10) { toast('쓸 수 없어요'); }
        renderPartner(); draw();
      }
      else if (t.hasAttribute('data-noircl')) {
        var onC = t.getAttribute('data-noircl') === '1';
        var ownC = P.looksOf(S(), pets().eq);
        if (P.setNoir(S(), pets().eq, onC ? (ownC.indexOf('a') >= 0 ? true : 'b') : false)) { ctx.persist(); renderPartner(); draw(); ctx.render(); if (onC) toast('코드네임 ' + P.codename(P.parse(pets().eq).id) + ', 임무 시작'); }
      }
      else if (t.hasAttribute('data-noirgo')) { tab = 'dex'; draw(); showDetail(pets().eq); }
      else if (t.hasAttribute('data-lookpick')) { lookSel = t.getAttribute('data-lookpick'); drawDetail(); }
      else if (t.hasAttribute('data-lookbuy')) {   // 0.13.15 코드네임 장면 사기(확인 창)
        var lsc = t.getAttribute('data-lookbuy'), lpay = t.getAttribute('data-pay') === 'gems' ? 'gems' : 'treats', lk = detailKey, LC = P.LOOK_COST;
        var lnm = (P.LOOKS.filter(function (l) { return l.id === lsc; })[0] || {}).name || '';
        ctx.UI.confirmBuy({ title: lnm + ' 그림을 살까요?', body: '',
          cost: ic(lpay === 'gems' ? 'gem' : 'treat') + (lpay === 'gems' ? LC.gems : LC.treats), onOk: function () {
            try { P.buyLook(S(), lk, lsc, lpay); P.setNoir(S(), lk, lsc === 'b' ? 'b' : true); lookSel = ''; ctx.persist(); toast(lnm + ' 그림을 샀어요'); try { ctx.UI.sfx.coin(); } catch (e4) { /* 무시 */ } }
            catch (e3) { toast(e3.code === 'NOT_ENOUGH' ? (lpay === 'gems' ? '배지가 모자라요' : '간식이 모자라요') : '살 수 없어요'); }
            renderPartner(); drawDetail(); drawDex(); ctx.render();
          } });
      }
      else if (t.hasAttribute('data-fxbuy')) {   // 0.13.0 연출 사기(확인 창)
        var fid = t.getAttribute('data-fxbuy');
        if (!(S().gems >= P.FX_GEMS)) { toast('배지가 모자라요'); return; }
        ctx.UI.confirmBuy({ title: '움직이는 연출을 살까요?', body: '이 파트너의 코드네임 그림이 움직여요.', cost: ic('gem') + P.FX_GEMS, onOk: function () {
          try { P.buyFx(S(), fid); ctx.persist(); toast('연출을 샀어요'); try { ctx.UI.sfx.coin(); } catch (e4) { /* 무시 */ } } catch (e3) { toast(e3.code === 'NOT_ENOUGH' ? '배지가 모자라요' : '살 수 없어요'); }
          renderPartner(); drawDetail(); ctx.render();
        } });
      }
      else if (t.hasAttribute('data-noir')) {
        var onN = t.getAttribute('data-noir') === 'b' ? 'b' : t.getAttribute('data-noir') === '1';
        if (P.setNoir(S(), detailKey, onN)) { ctx.persist(); renderPartner(); drawDetail(); drawDex(); ctx.render(); if (onN) { toast('코드네임 ' + P.codename(P.parse(detailKey).id) + ', 임무 시작'); try { ctx.UI.sfx.none(); } catch (e11) { /* 무시 */ } } }
      }
      else if (t.id === 'pets-name') startNaming();
      else if (t.id === 'pets-tags') {
        var NT = root.SuspectsIdle.NAME_TAGS;
        ctx.UI.confirmBuy({ title: '이름표 ' + NT.n + '장을 살까요?', body: '이름표 1장으로 파트너, 경찰서, 팀장 이름을 한 번 바꿔요.', cost: ic('gem') + NT.gems, onOk: function () {
          try { root.SuspectsIdle.buyNameTags(S()); ctx.persist(); try { ctx.UI.sfx.coin(); } catch (e4) { /* 무시 */ } toast('이름표 ' + NT.n + '장을 샀어요'); } catch (e5) { toast('배지가 모자라요'); }
          draw(); ctx.render();
        } });
      }
      else if (t.id === 'pets-name-ok') saveName();
      else if (t.id === 'pets-name-no') { naming = false; drawDetail(); }
      else if (t.id === 'pets-name-reset') { P.resetName(S(), detailKey); ctx.persist(); renderPartner(); draw(); toast('기본 이름 "' + P.nameOf(S(), detailKey) + '"(으)로 돌렸어요'); }
      else if (t.id === 'pets-equip') {
        P.equip(S(), detailKey); ctx.persist(); renderPartner(); draw();
        try { ctx.UI.sfx.coin(); } catch (e2) { /* 무시 */ }
        toast(P.nameOf(S(), detailKey) + '(이)가 파트너가 됐어요');
      } else if (t.id === 'pets-swap') {
        var x = P.parse(detailKey);
        try { var r = P.swap(S(), x.id, x.g); ctx.persist(); toast(r.isNew ? '새 파트너가 왔어요!' : '★' + r.star + '로 올랐어요'); } catch (e3) { toast(e3.code === 'NOT_ENOUGH' ? '간식이 모자라요' : '바꿀 수 없어요'); }
        renderPartner(); draw();
      }
    });
    $('s-hub').addEventListener('click', function (e) {
      var t = e.target.closest('button');
      if (!t) return;
      if (t.id === 'h-pet-open') open(pets().tickets > 0 || !Object.keys(pets().own).length ? 'draw' : 'dex');
      else if (t.id === 'h-pet-art') pat();
      else if (t.id === 'h-pet-bgbtn') openBg();
    });
    $('pets-sheet').addEventListener('change', function (e) {
      if (e.target.id === 'pets-wear') {
        try { P.wear(S(), detailKey, e.target.value); ctx.persist(); renderPartner(); drawDetail(); } catch (e2) { toast('입힐 수 없어요'); }
        return;
      }
      if (e.target.id !== 'pets-ttl' || !root.Team3Ach) return;
      try { root.Team3Ach.setPetTitle(S(), detailKey, e.target.value); ctx.persist(); renderPartner(); drawDetail(); } catch (e2) { toast('달 수 없어요'); }
    });
    $('pets-sheet').addEventListener('keydown', function (e) {
      if (e.target.id !== 'pets-name-in') return;
      if (e.key === 'Enter') { e.preventDefault(); saveName(); }
      else if (e.key === 'Escape') { e.stopPropagation(); naming = false; drawDetail(); }
    });
    renderPartner();
    idleLoop();
  }

  /* 0.8.4 각성이 새로 열린 동물을 한 번 알려 주기(허브가 한가할 때 부른다). 알려 준 뒤엔 다시 안 뜬다 */
  function noirAnnounce(openInfo) {
    var N = noirArt(), ks = N ? P.noirNew(S()) : [];
    if (!ks.length) return false;
    var k = ks.indexOf(pets().eq) >= 0 ? pets().eq : ks[0], x = P.parse(k);   // 지금 파트너가 열렸으면 그 동물부터
    ks.forEach(function (q) { P.noirSeen(S(), q); });
    ctx.persist();
    openInfo({ label: '코드네임', title: P.nameOf(S(), k) + '의 코드네임 그림을 살 수 있어요',
      body: '<div class="noir-reveal noir-anim">' + N.draw(x.id, { grade: x.g, size: 220 }) + '</div><p class="cn-big">코드네임 <b>' + esc(P.codename(x.id)) + '</b></p>' +
        '<p style="text-align:center;margin:6px 0 0"><span class="ln">★5에 닿았어요.</span><span class="ln">사무실, 현장 그림을 장면마다 살 수 있어요.</span></p>' +
        (ks.length > 1 ? '<p class="muted" style="text-align:center;font-size:12px">그 밖에 ' + (ks.length - 1) + '마리도 살 수 있어요, 도감 자세히에서 골라요</p>' : ''),
      ok: '보러 가기', cancel: '나중에',
      onOk: function () { open('dex'); showDetail(k); } });
    return true;
  }
  root.Team3PetsUI = { closeZoom: closeZoom, closeGd: closeGd, openCur: openCur, closeBg: closeBg, noirAnnounce: noirAnnounce, mount: mount, open: open, close: close, isOpen: isOpen, renderPartner: renderPartner, pat: pat, isBusy: function () { return busy; } };
})(typeof self !== 'undefined' ? self : this);
