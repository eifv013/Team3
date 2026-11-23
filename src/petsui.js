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
  function isNoir(k) { return !!(noirArt() && k && P.noirOn(S(), k)); }
  function portrait(k, x, o) { return isNoir(k) ? '<span class="noir-pic' + (o && o.anim ? ' noir-anim' : '') + '">' + noirArt().draw(x.id, { grade: x.g }) + '</span>' : A.draw(x.id, o); }
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
      box.innerHTML = '<div class="pet-art pet-empty" aria-hidden="true">?</div>' +
        '<div class="pet-tx"><b>파트너가 없어요</b><small>뽑기로 3팀과 함께할 파트너를 데려와요' + (free ? ' · 뽑기권 ' + free + '장' : '') + '</small></div>' +
        '<button class="buy" id="h-pet-open">뽑기' + dot + '</button>';
      return;
    }
    var sp = P.BY_ID[x.id], g = P.GRADE[x.g], st = p.own[p.eq], nm = P.nameOf(S(), p.eq);
    box.style.setProperty('--gc', g.color);
    var eff = P.describe(P.eqEffect(x.id, x.g, st)), bd = P.bondOf(S(), p.eq);
    // 0.4.1 무대: 등급 빛(영웅 · 전설은 도는 후광) · 바닥 그림자 · 전설 반짝이. 버튼 안에는 그림만(act 가 갈아 끼운다)
    box.innerHTML = '<div class="pet-stage g-' + x.g + '" id="h-pet-stage" style="--gc:' + g.color + '"><i class="ps-aura" aria-hidden="true"></i><i class="ps-floor" aria-hidden="true"></i>' +
      (x.g === 'l' ? '<i class="ps-spark" aria-hidden="true"></i>' : '') +
      '<button class="pet-art' + (isNoir(p.eq) ? ' noir' : '') + '" id="h-pet-art" aria-label="' + esc(nm) + ' 쓰다듬기">' + portrait(p.eq, x, { grade: x.g, anim: true, outfit: P.wearing(S(), p.eq) }) + '</button></div>' +
      '<div class="pet-tx"><b><span style="color:' + g.color + '">' + g.name + '</span> ' + ttl(p.eq) + esc(nm) + ' ' + stars(st) + '</b>' + (isNoir(p.eq) ? '<small class="pet-cn">코드네임 ' + esc(P.codename(x.id)) + '</small>' : '') + '<small>' + esc(eff.join(' · ')) + '</small>' +
        '<small class="pet-bond">♥ ' + bd.lv + '단계 · ' + (bd.last === today() ? '함께 ' + bd.days + '일 ✓' : '쓰다듬어 줘요') + '</small></div>' +
      '<span class="pet-bubble" id="h-pet-bubble" hidden></span>' +
      '<button class="buy" id="h-pet-open">파트너' + dot + '</button>';
  }
  /*
   * 파트너 표정 바꾸기(0.3.1): mood 를 ms 동안 보여 주고 원래대로. move 는 칸이 하는 몸짓(CSS 클래스).
   */
  function act(mood, move, ms) {
    var b = $('h-pet-art'), x = P.parse(pets().eq);
    if (!b || !x) return;
    var o = P.wearing(S(), pets().eq), nz = isNoir(pets().eq);
    if (!nz) b.innerHTML = A.draw(x.id, { grade: x.g, mood: mood, anim: true, outfit: o });
    b.classList.remove('pa-jump', 'pa-peek', 'pa-wiggle', 'pa-doze');
    void b.offsetWidth;   // 같은 몸짓을 다시 시작하게
    if (move) b.classList.add(move);
    clearTimeout(act.t);
    act.t = setTimeout(function () {
      var bb = $('h-pet-art'), xx = P.parse(pets().eq);
      if (!bb || !xx) return;
      bb.classList.remove('pa-jump', 'pa-peek', 'pa-wiggle', 'pa-doze');
      if (!isNoir(pets().eq)) bb.innerHTML = A.draw(xx.id, { grade: xx.g, anim: true, outfit: P.wearing(S(), pets().eq) });
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
    tab = which || tab;
    detailKey = '';
    $('pets-sheet').hidden = false;
    draw();
    $('pets-sheet').querySelector('.sheet').scrollTop = 0;
    if (gift) toast('환영 선물: 뽑기권 ' + gift + '장!');
  }
  function close() {
    if (busy) return;
    $('pets-sheet').hidden = true;
    ctx.render();
  }
  function toast(t) { try { ctx.UI.toast(t); } catch (e) { /* 없음 */ } }

  function draw() {
    var p = pets(), pr = P.progress(S());
    document.querySelectorAll('#pets-tabs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === tab); });
    $('pets-tab-dex').textContent = '도감 ' + pr.have + '/' + pr.total;
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
    else out.one = { ok: false, n: 1, text: '부족 · ' + ic('ticket') + p.tickets + '/1 · ' + ic('gem') + fmt(s.gems) + '/' + P.COST.one };
    var mt = P.maxPull(s, 'ticket'), mg = P.maxPull(s, 'gems');
    if (mt >= 2) out.multi = { ok: true, pay: 'ticket', n: mt, text: ic('ticket') + mt + '장' + (p.tickets > mt ? ' (한 번에 최대 ' + P.MAX_PULL + ')' : '') };
    else if (mg >= 2) out.multi = { ok: true, pay: 'gems', n: mg, text: ic('gem') + fmt(P.gemCost(mg)) + (mg >= 10 ? ' · 10회마다 10% 덜' : '') };
    else out.multi = { ok: false, n: 2, text: '부족 · ' + ic('ticket') + p.tickets + '/2 또는 ' + ic('gem') + fmt(s.gems) + '/' + P.gemCost(2) };
    return out;
  }
  function walletHtml() {
    var p = pets();
    return '<span>' + ic('ticket') + '뽑기권 <b>' + fmt(p.tickets) + '</b></span><span>' + ic('gem') + '배지 <b>' + fmt(S().gems) + '</b></span><span>' + ic('treat') + '간식 <b>' + fmt(p.treats) + '</b></span>';
  }
  function drawDraw() {
    var p = pets(), pl = plan(), one = pl.one, multi = pl.multi, pk = P.pickup(today()), sp = P.BY_ID[pk.id];
    // 이번 주 픽업
    $('pets-pickup').innerHTML = '<div class="pet-pk-art">' + A.draw(pk.id, { grade: 'l', anim: true }) + '</div>' +
      '<div class="pet-pk-tx"><span class="label">이번 주 출동 파트너 · ' + pk.left + '일 남음</span><b>' + esc(sp.kind) + ' ' + esc(sp.name) + '</b>' +
      '<small>영웅·전설이 나오면 절반은 ' + esc(sp.name) + '! 천장(' + P.PITY + '번째) 전설은 ' + esc(sp.name) + ' 확정</small></div>';
    $('pets-one').classList.toggle('free', one.pay === 'free');
    $('pets-pity').innerHTML = '전설 확정까지 <b>' + (P.PITY - p.pity) + '번</b> · 현재까지 ' + fmt(p.pulls) + '번 뽑음';
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
      '<p class="muted">같은 파트너가 또 나오면 ★가 올라요(★5까지, ★마다 효과 +25%). ★5 뒤에는 간식(' + P.GRADES.map(function (g) { return P.GRADE[g].name + ' ' + P.GRADE[g].treat; }).join(' · ') + ')으로 바뀌어요.</p>' +
      '<p class="muted">뽑기권은 처음 선물 · 사건 종결 · 승진 · 메달 · 특별 출동으로 받아요. 파트너는 퍼즐 실력을 대신하지 않아요: ⚡ 퍼즐 도움은 영웅·전설의 일부만, 특별 출동에서는 꺼져요.</p>';
  }

  /*
   * 뽑기(0.3.1: 연출을 따로 띄운다).
   *   결과는 먼저 저장해 두고(P.pull → persist) 연출이 끝나면 창의 결과 칸에 요약을 남긴다.
   *   연출 도중 앱을 닫아도 뽑은 동물은 이미 들어가 있다.
   */
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
    '<text x="100" y="111" font-size="13" font-weight="700" text-anchor="middle" fill="#1B1E24" font-family="IBM Plex Sans KR" letter-spacing="2">증거 · EVIDENCE</text>' +
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
    var can = P.canNoir(S(), p.eq), on = isNoir(p.eq), st = p.own[p.eq] || 1;
    return '<div class="pet-noircard' + (can ? '' : ' locked') + (on ? ' on' : '') + '"><span class="pnc-art' + (can ? ' noir-anim' : '') + '">' + N.draw(x.id, { grade: x.g, size: 84 }) + (can ? '' : '<i>' + LOCK + '</i>') + '</span>' +
      '<span class="pnc-tx"><b>코드네임 <em>' + esc(P.codename(x.id)) + '</em></b><small>' + (can ? '비밀 요원 모습의 반신 초상 · 파트너 카드와 도감에서 보여요' : (x.g === 'l' ? '전설은 데려오면 바로 받아요' : '이 파트너가 ★5가 되면 받아요 · 현재 ★' + st)) + '</small>' +
      (can ? '<button class="' + (on ? 'ghost' : 'primary') + '" data-noircl="' + (on ? 0 : 1) + '">' + (on ? '본명으로' : '코드네임으로') + '</button>' : '') + '</span></div>';
  }
  function drawCloset() {
    var p = pets(), x = P.parse(p.eq) || { id: 'corgi', g: 'c' }, cur = p.eq ? P.wearing(S(), p.eq) : '';
    var html = closetNoir(p, x) + '<p class="muted" style="font-size:12px;margin:0">한 번 사면 모든 파트너가 함께 입어요. 꾸미기 전용이에요(효과 없음). 파트너마다 다른 옷은 도감의 자세히에서 골라요.</p><div class="pet-closet-g">';
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
    return lines.length ? lines.join(' · ') : '아직 없어요. 파트너를 모으면 하나하나 쌓여요.';
  }
  function drawDex() {
    var p = pets();
    var st = P.sets(S()), gs = P.GRADES.map(function (g) {
      var have = P.SPECIES.filter(function (x) { return p.own[P.key(x.id, g)]; }).length;
      return '<span class="' + (st.grades[g] ? 'on' : '') + '" style="--gc:' + P.GRADE[g].color + '">' + P.GRADE[g].name + ' ' + have + '/' + P.SPECIES.length + '<i>' + esc(P.describe(P.GRADE_SET[g]).join(' · ')) + '</i></span>';
    }).join('');
    var html = '<div class="pet-sum"><span class="label">보유 효과 합계 (모은 파트너 모두 · 늘 켜짐)</span><b>' + esc(ownSummary()) + '</b></div>' +
      '<div class="pet-sets"><span class="label">세트 보너스 · 한 종류 네 등급 = 그 종류 보유 효과 두 배 · 한 등급 ' + P.SPECIES.length + '종 = 아래 보너스</span><div>' + gs + '</div></div>' +
      '<div class="pet-dex-head"><span></span>' + P.GRADES.map(function (g) { return '<span style="color:' + P.GRADE[g].color + '">' + P.GRADE[g].name + '</span>'; }).join('') + '</div>';
    // 0.9.2 한정 파트너 줄은 맨 위(전설 칸 하나만 · 나머지 등급 칸은 "없음" 자리)
    (P.LIMITED || []).forEach(function (sp) {
      var k = P.key(sp.id, 'l'), st = p.own[k];
      html += '<div class="pet-dex-row lim"><span class="pet-dex-name"><b>' + esc(sp.name) + '</b><small>' + esc(sp.kind) + ' · 한정</small></span>' +
        '<span class="pet-cell none" aria-hidden="true"></span><span class="pet-cell none" aria-hidden="true"></span><span class="pet-cell none" aria-hidden="true"></span>' +
        '<button class="pet-cell' + (st ? ' have' : '') + (p.eq === k ? ' eq' : '') + '" data-k="' + k + '" style="--gc:' + P.GRADE.l.color + '" aria-label="한정 전설 ' + esc(sp.name) + (st ? ' ★' + st : ' 없음') + '">' +
        A.draw(sp.id, { grade: 'l' }) + (st ? '<i>' + st + '★</i>' : '') + '</button></div>';
    });
    // 0.9.2 새로 들어온 동물(since 가 큰 것)이 한정 줄 바로 아래 맨 위로
    P.SPECIES.map(function (sp, i) { return { sp: sp, i: i }; }).sort(function (a, b) { return (b.sp.since || 0) - (a.sp.since || 0) || a.i - b.i; }).forEach(function (o) {
      var sp = o.sp;
      html += '<div class="pet-dex-row"><span class="pet-dex-name"><b>' + esc(sp.name) + '</b><small>' + esc(sp.kind) + (st.species[sp.id] ? ' · <em class="set">세트×2</em>' : '') + '</small></span>' +
        P.GRADES.map(function (g) {
          var k = P.key(sp.id, g), st = p.own[k];
          return '<button class="pet-cell' + (st ? ' have' : '') + (p.eq === k ? ' eq' : '') + '" data-k="' + k + '" style="--gc:' + P.GRADE[g].color + '" aria-label="' + P.GRADE[g].name + ' ' + esc(sp.name) + (st ? ' ★' + st : ' 없음') + '">' +
            A.draw(sp.id, { grade: g }) + (st ? '<i>' + st + '★</i>' : '') + '</button>';
        }).join('') + '</div>';
    });
    $('pets-dex').innerHTML = html;
  }

  function drawDetail() {
    var box = $('pets-detail'), x = P.parse(detailKey);
    box.hidden = !x;
    if (!x) { box.innerHTML = ''; return; }
    var p = pets(), sp = P.BY_ID[x.id], g = P.GRADE[x.g], st = p.own[detailKey] || 0, shown = st || 1;
    var own = P.describe(P.ownEffect(x.id, x.g, shown)), eq = P.describe(P.eqEffect(x.id, x.g, shown));
    var zapLocked = sp.zap && x.g !== 'h' && x.g !== 'l' ? '<small class="muted">⚡ ' + esc(P.describe(sp.zap).join(' · ').replace(/⚡ /g, '')) + ' — 영웅 · 전설 등급에서 열려요</small>' : '';
    var swapCost = g.swap, canSwap = st < P.STAR_MAX && !sp.limited;   // 한정 파트너는 간식·선택권으로 못 데려와요
    box.style.setProperty('--gc', g.color);
    box.innerHTML = '<button class="pet-x" id="pets-detail-x" aria-label="자세히 닫기">×</button>' +
      '<div class="pet-big' + (st ? '' : ' locked') + (st && isNoir(detailKey) ? ' noir' : '') + '">' + (st ? portrait(detailKey, x, { grade: x.g, anim: true, outfit: P.wearing(S(), detailKey) }) : A.draw(x.id, { grade: x.g })) + '</div>' +
      '<div class="pet-info"><span class="label" style="color:' + g.color + '">' + g.name + ' · ' + esc(sp.kind) + '</span><h3>' + (st ? ttl(detailKey) : '') + esc(st ? P.nameOf(S(), detailKey) : sp.name) + ' ' + (st ? stars(st) : '<span class="muted" style="font-size:13px">아직 없음</span>') + '</h3>' +
        (st && isNoir(detailKey) ? '<small class="pet-cn">코드네임 ' + esc(P.codename(x.id)) + '</small>' : '') +
        '<small class="muted">' + esc(sp.line) + '</small></div>' +
      '<div class="pet-eff"><div><em>보유 효과</em><b class="own">' + esc(own.join(' · ')) + '</b><small>갖고만 있어도 늘 켜짐</small></div>' +
        '<div><em>장착 효과</em><b class="eq">' + esc(eq.join(' · ')) + '</b><small>파트너 1마리만' + (eq.join('').indexOf('⚡') >= 0 ? ' · ⚡는 특별 출동에서 꺼짐' : '') + '</small>' + zapLocked + '</div></div>' +
      (st ? '' : '<p class="muted" style="font-size:12px">아직 없어서 ★1 기준으로 보여 줘요.</p>') +
      (st ? nameRow() : '') +
      (st ? noirRow(x, st) : '') +
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
  function noirRow(x, st) {
    var N = noirArt();
    if (!N) return '';
    if (P.canNoir(S(), detailKey)) {
      var on = isNoir(detailKey);
      return '<div class="pet-noir"><span class="label">코드네임 · ' + esc(P.codename(x.id)) + '</span><div class="pn-seg">' +
        '<button class="' + (on ? '' : 'on') + '" data-noir="0">본명</button><button class="' + (on ? 'on' : '') + '" data-noir="1">코드네임</button></div>' +
        (on ? '<small class="muted">코드네임일 땐 의상이 안 보여요 · 상황실 안에서는 본명 모습 그대로예요</small>' : '') + '</div>';
    }
    return '<div class="pet-noir locked"><span class="pn-thumb">' + N.draw(x.id, { grade: x.g, size: 56 }) + '<i>' + LOCK + '</i></span>' +
      '<span class="pn-tx"><b>코드네임 <em>???</em></b><small>' + (x.g === 'l' ? '데려오면 바로 받아요' : '★5가 되면 받아요 · 현재 ★' + st) + '</small></span></div>';
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
    if (!naming) return '<div class="pet-name"><button class="linkish" id="pets-name">이름 짓기 · ' + price + '</button>' +
      (custom ? '<button class="linkish muted" id="pets-name-reset">기본 이름으로</button>' : '') + '</div>' +
      (c && !tags && I && I.NAME_TAGS ? '<div class="pet-name"><button class="linkish muted" id="pets-tags"' + (S().gems < I.NAME_TAGS.gems ? ' disabled' : '') + '>' + ic('tag') + '이름표 ' + I.NAME_TAGS.n + '장 · ' + ic('gem') + I.NAME_TAGS.gems + ' (팀장 이름에도 써요)</button></div>' : '');
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
    toast('이제 이름은 "' + r.name + '"' + (r.paid ? ' · ◆' + r.paid : r.tag ? ' · 이름표 1장' : ''));
    renderPartner(); draw(); ctx.render();
  }
  function showDetail(k) {
    naming = false;
    detailKey = k;
    drawDetail();
    $('pets-sheet').querySelector('.sheet').scrollTop = 0;
  }

  /* ---------- 연결 ---------- */
  function mount(c) {
    ctx = c;
    $('pets-x').addEventListener('click', close);
    $('pets-sheet').addEventListener('click', function (e) {
      if (e.target === this) { close(); return; }
      var t = e.target.closest('button');
      if (!t) return;
      if (t.id === 'pets-one') doPull('one');
      else if (t.id === 'pets-ten') doPull('multi');
      else if (t.getAttribute('data-tab')) { tab = t.getAttribute('data-tab'); detailKey = ''; draw(); }
      else if (t.classList.contains('pet-cell')) showDetail(t.getAttribute('data-k'));
      else if (t.id === 'pets-detail-x') { detailKey = ''; naming = false; drawDetail(); }
      else if (t.getAttribute('data-outfit')) {
        try { var o = P.buyOutfit(S(), t.getAttribute('data-outfit'), t.getAttribute('data-pay')); ctx.persist(); toast(o.name + '을(를) 옷장에 넣었어요'); try { ctx.UI.sfx.coin(); } catch (e6) { /* 무시 */ } }
        catch (e7) { toast(e7.code === 'NOT_ENOUGH' ? (t.getAttribute('data-pay') === 'gems' ? '배지가 모자라요' : '간식이 모자라요') : '살 수 없어요'); }
        draw(); ctx.render();
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
        if (P.setNoir(S(), pets().eq, onC)) { ctx.persist(); renderPartner(); draw(); ctx.render(); if (onC) toast('코드네임 ' + P.codename(P.parse(pets().eq).id) + ', 임무 시작'); }
      }
      else if (t.hasAttribute('data-noir')) {
        var onN = t.getAttribute('data-noir') === '1';
        if (P.setNoir(S(), detailKey, onN)) { ctx.persist(); renderPartner(); drawDetail(); ctx.render(); if (onN) { toast('코드네임 ' + P.codename(P.parse(detailKey).id) + ', 임무 시작'); try { ctx.UI.sfx.none(); } catch (e11) { /* 무시 */ } } }
      }
      else if (t.id === 'pets-name') startNaming();
      else if (t.id === 'pets-tags') {
        try { root.SuspectsIdle.buyNameTags(S()); ctx.persist(); try { ctx.UI.sfx.coin(); } catch (e4) { /* 무시 */ } toast('이름표 ' + root.SuspectsIdle.NAME_TAGS.n + '장을 샀어요'); } catch (e5) { toast('배지가 모자라요'); }
        draw(); ctx.render();
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
    openInfo({ label: '코드네임', title: P.nameOf(S(), k) + '에게 코드네임이 생겼어요',
      body: '<div class="noir-reveal noir-anim">' + N.draw(x.id, { grade: x.g, size: 220 }) + '</div><p class="cn-big">코드네임 <b>' + esc(P.codename(x.id)) + '</b></p><p style="text-align:center;margin:6px 0 0">' + (x.g === 'l' ? '전설 등급' : '★5') + '에 닿아 비밀 요원 모습이 열렸어요.<br>파트너 카드와 도감에서 이 모습으로 보여 줄 수 있어요.</p>' +
        (ks.length > 1 ? '<p class="muted" style="text-align:center;font-size:12px">그 밖에 ' + (ks.length - 1) + '마리도 받았어요 · 도감 자세히에서 골라요</p>' : ''),
      ok: '코드네임으로', cancel: '나중에',
      onOk: function () { P.setNoir(S(), k, true); ctx.persist(); renderPartner(); ctx.render(); toast('코드네임 ' + P.codename(x.id) + ', 임무 시작'); } });
    return true;
  }
  root.Team3PetsUI = { noirAnnounce: noirAnnounce, mount: mount, open: open, close: close, isOpen: isOpen, renderPartner: renderPartner, pat: pat, isBusy: function () { return busy; } };
})(typeof self !== 'undefined' ? self : this);
