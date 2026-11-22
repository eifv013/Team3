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
      box.innerHTML = '<div class="pet-art pet-empty" aria-hidden="true">?</div>' +
        '<div class="pet-tx"><b>파트너 동물이 없어요</b><small>뽑기로 3팀과 함께할 동물을 데려와요' + (free ? ' · 뽑기권 ' + free + '장' : '') + '</small></div>' +
        '<button class="buy" id="h-pet-open">뽑기' + dot + '</button>';
      return;
    }
    var sp = P.BY_ID[x.id], g = P.GRADE[x.g], st = p.own[p.eq], nm = P.nameOf(S(), p.eq);
    var eff = P.describe(P.eqEffect(x.id, x.g, st)), bd = P.bondOf(S(), p.eq);
    box.innerHTML = '<button class="pet-art" id="h-pet-art" aria-label="' + esc(nm) + ' 쓰다듬기" style="--gc:' + g.color + '">' + A.draw(x.id, { grade: x.g, anim: true, outfit: P.wearing(S(), p.eq) }) + '</button>' +
      '<div class="pet-tx"><b><span style="color:' + g.color + '">' + g.name + '</span> ' + ttl(p.eq) + esc(nm) + ' ' + stars(st) + '</b><small>' + esc(eff.join(' · ')) + '</small>' +
        '<small class="pet-bond">♥ 친밀도 ' + bd.lv + (bd.days ? ' · 함께 ' + bd.days + '일' : ' · 오늘 쓰다듬어 주세요') + (bd.last === today() ? ' · 오늘 ✓' : '') + '</small></div>' +
      '<span class="pet-bubble" id="h-pet-bubble" hidden></span>' +
      '<button class="buy" id="h-pet-open">동물' + dot + '</button>';
  }
  /*
   * 파트너 표정 바꾸기(0.3.1): mood 를 ms 동안 보여 주고 원래대로. move 는 칸이 하는 몸짓(CSS 클래스).
   */
  function act(mood, move, ms) {
    var b = $('h-pet-art'), x = P.parse(pets().eq);
    if (!b || !x) return;
    var o = P.wearing(S(), pets().eq);
    b.innerHTML = A.draw(x.id, { grade: x.g, mood: mood, anim: true, outfit: o });
    b.classList.remove('pa-jump', 'pa-peek', 'pa-wiggle', 'pa-doze');
    void b.offsetWidth;   // 같은 몸짓을 다시 시작하게
    if (move) b.classList.add(move);
    clearTimeout(act.t);
    act.t = setTimeout(function () {
      var bb = $('h-pet-art'), xx = P.parse(pets().eq);
      if (!bb || !xx) return;
      bb.classList.remove('pa-jump', 'pa-peek', 'pa-wiggle', 'pa-doze');
      bb.innerHTML = A.draw(xx.id, { grade: xx.g, anim: true, outfit: P.wearing(S(), pets().eq) });
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
    var r = null;
    try { r = P.pat(S(), k, today()); } catch (e) { /* 없는 동물 */ }
    if (r && r.counted) {
      ctx.persist();
      var gv = r.give ? (r.give.treats ? '간식 +' + r.give.treats : r.give.tickets ? '뽑기권 +' + r.give.tickets : r.give.gems ? '◆' + r.give.gems : '') : '';
      renderPartner();
      say(r.up ? '친밀도 ' + r.lv + '단계! ' + (gv ? gv + ' 고마워요!' : '') : '오늘도 고마워요! ♥ 함께 ' + P.bondOf(S(), k).days + '일', 3400);
    } else say(P.talk(x.id, talkCtx()));
    try { ctx.UI.sfx.pick(3); } catch (e) { /* 소리 실패는 무시 */ }
    ctx.UI.buzz(8);
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
    $('pets-wallet').innerHTML = '<span>뽑기권 <b>' + fmt(p.tickets) + '</b></span><span>배지 <b>◆' + fmt(S().gems) + '</b></span><span>간식 <b>' + fmt(p.treats) + '</b></span>';
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
  function payLabel(n) {
    var p = pets();
    if (n === 1 && P.freeLeft(S(), today(), freeExtra()) > 0) return { pay: 'free', text: '오늘 무료' };
    if (p.tickets >= n) return { pay: 'ticket', text: '뽑기권 ' + n + '장' };
    return { pay: 'gems', text: '◆' + (n === 10 ? P.COST.ten : P.COST.one) };
  }
  function drawDraw() {
    var p = pets(), one = payLabel(1), ten = payLabel(10), pk = P.pickup(today()), sp = P.BY_ID[pk.id];
    // 이번 주 픽업
    $('pets-pickup').innerHTML = '<div class="pet-pk-art">' + A.draw(pk.id, { grade: 'l', anim: true }) + '</div>' +
      '<div class="pet-pk-tx"><span class="label">이번 주 출동 동물 · ' + pk.left + '일 남음</span><b>' + esc(sp.kind) + ' ' + esc(sp.name) + '</b>' +
      '<small>영웅·전설이 나오면 절반은 ' + esc(sp.name) + '! 천장(' + P.PITY + '번째) 전설은 ' + esc(sp.name) + ' 확정</small></div>';
    $('pets-one').classList.toggle('free', one.pay === 'free');
    $('pets-pity').innerHTML = '전설 확정까지 <b>' + (P.PITY - p.pity) + '번</b> · 지금까지 ' + fmt(p.pulls) + '번 뽑음';
    $('pets-one').innerHTML = '1회 뽑기<small>' + one.text + '</small>';
    $('pets-ten').innerHTML = '10회 뽑기<small>' + ten.text + ' · 희귀 이상 1마리 보장</small>';
    $('pets-one').disabled = busy || (one.pay === 'gems' && S().gems < P.COST.one);
    $('pets-ten').disabled = busy || (ten.pay === 'gems' && S().gems < P.COST.ten);
    $('pets-rates').innerHTML = '<table class="pet-rates"><tr><th>등급</th><th>등급 확률</th><th>한 마리</th></tr>' +
      P.rates().map(function (r) { return '<tr><td style="color:' + P.GRADE[r.g].color + '">' + r.name + '</td><td>' + r.pct + '%</td><td>' + r.each + '%</td></tr>'; }).join('') + '</table>' +
      '<p class="muted">등급을 먼저 정하고, 그 등급의 ' + P.SPECIES.length + '종 중 하나가 같은 확률로 나와요. 단 영웅·전설은 ' + (P.PICKUP_RATE * 100) + '% 확률로 이번 주 출동 동물이 나와요(그래서 영웅·전설 안에서 출동 동물은 ' + Math.round((P.PICKUP_RATE + (1 - P.PICKUP_RATE) / P.SPECIES.length) * 1000) / 10 + '%, 나머지는 각 ' + Math.round((1 - P.PICKUP_RATE) / P.SPECIES.length * 1000) / 10 + '%).</p>' +
      '<p class="muted">하루 한 번 무료 뽑기가 있어요(자정에 다시 생겨요).</p>' +
      '<p class="muted">천장: ' + P.PITY + '번째까지 전설이 한 번도 안 나오면 그 번째는 전설 확정(전설이 나오면 다시 0부터). 천장을 포함하면 전설은 실제로 약 ' + P.effectiveLegend() + '%예요.</p>' +
      '<p class="muted">10회 뽑기에서 모두 일반이면 마지막 한 마리는 희귀.</p>' +
      '<p class="muted">같은 동물이 또 나오면 ★가 올라요(★5까지, ★마다 효과 +25%). ★5 뒤에는 간식(일반 1 · 희귀 3 · 영웅 10 · 전설 30)으로 바뀌어요.</p>' +
      '<p class="muted">뽑기권은 처음 선물 · 사건 종결 · 승진 · 메달 · 특별 출동으로 받아요. 동물은 퍼즐 실력을 대신하지 않아요: ⚡ 퍼즐 도움은 영웅·전설의 일부만, 특별 출동에서는 꺼져요.</p>';
  }

  /*
   * 뽑기(0.3.1: 연출을 따로 띄운다).
   *   결과는 먼저 저장해 두고(P.pull → persist) 연출이 끝나면 창의 결과 칸에 요약을 남긴다.
   *   연출 도중 앱을 닫아도 뽑은 동물은 이미 들어가 있다.
   */
  function doPull(n) {
    if (busy) return;
    var c = payLabel(n), r;
    try { r = P.pull(S(), n, c.pay, Math.random, pullOpts()); } catch (e) { toast(e.code === 'NOT_ENOUGH' ? (c.pay === 'gems' ? '배지가 모자라요' : '뽑기권이 모자라요') : '뽑을 수 없어요'); return; }
    ctx.persist();
    busy = true;
    var best = 'c';
    r.results.forEach(function (x) { if (P.GRADES.indexOf(x.g) > P.GRADES.indexOf(best)) best = x.g; });
    drawDraw();
    $('pets-wallet').innerHTML = '<span>뽑기권 <b>' + fmt(pets().tickets) + '</b></span><span>배지 <b>◆' + fmt(S().gems) + '</b></span><span>간식 <b>' + fmt(pets().treats) + '</b></span>';
    gacha(r.results, best, function () {
      var res = $('pets-result');
      res.className = 'pet-result n' + n + ' best-' + best;
      res.innerHTML = r.results.map(function (x) { return cardFace(x, 'pet-got'); }).join('');
      busy = false;
      draw();
      renderPartner();
    });
  }
  function cardFace(x, cls) {
    var sp = P.BY_ID[x.id], g = P.GRADE[x.g];
    var tag = x.isNew ? '<em class="new">NEW</em>' : x.treats ? '<em>간식 +' + x.treats + '</em>' : '<em>★' + x.star + '</em>';
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
    el.className = 'gx best-' + best + (n === 10 ? ' ten' : ' one');
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
      var cs = el.querySelectorAll('.gx-card'), step = n === 10 ? 170 : 0, lead = n === 10 ? 450 : 250;
      cs.forEach(function (cd, i) {
        later(function () {
          cd.classList.add('flip');
          var g = results[i].g;
          snd(function (s) { if (g === 'l' || g === 'h') s.none(); else s.pick(3 + (i % 5)); });
          if (g === 'l') ctx.UI.buzz(40);
        }, reduce ? 0 : lead + i * step + (results[i].g === 'l' ? 250 : 0));
      });
      later(finish, reduce ? 0 : lead + (n - 1) * step + 700);
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
  function drawCloset() {
    var p = pets(), x = P.parse(p.eq) || { id: 'corgi', g: 'c' }, cur = p.eq ? P.wearing(S(), p.eq) : '';
    var html = '<p class="muted" style="font-size:12px;margin:0">한 번 사면 모든 동물이 함께 입어요. 꾸미기 전용이에요(효과 없음). 동물마다 다른 옷은 도감의 자세히에서 골라요.</p><div class="pet-closet-g">';
    P.OUTFITS.forEach(function (o) {
      var have = !!p.closet[o.id], open = P.outfitOpen(S(), o.id);
      var btns = have
        ? (p.eq ? (cur === o.id ? '<button class="ghost" data-wear="">벗기기</button>' : '<button class="primary" data-wear="' + o.id + '">파트너에게</button>') : '<button class="ghost" disabled>보유</button>')
        : !open ? '<button class="ghost" disabled>사건 ' + o.need + '부터</button>'
        : '<button class="ghost" data-outfit="' + o.id + '" data-pay="treats"' + (p.treats < o.treats ? ' disabled' : '') + '>간식 ' + o.treats + '</button>' +
          '<button class="ghost" data-outfit="' + o.id + '" data-pay="gems"' + (S().gems < o.gems ? ' disabled' : '') + '>◆' + o.gems + '</button>';
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
    return lines.length ? lines.join(' · ') : '아직 없어요. 동물을 모으면 하나하나 쌓여요.';
  }
  function drawDex() {
    var p = pets();
    var st = P.sets(S()), gs = P.GRADES.map(function (g) {
      var have = P.SPECIES.filter(function (x) { return p.own[P.key(x.id, g)]; }).length;
      return '<span class="' + (st.grades[g] ? 'on' : '') + '" style="--gc:' + P.GRADE[g].color + '">' + P.GRADE[g].name + ' ' + have + '/' + P.SPECIES.length + '<i>' + esc(P.describe(P.GRADE_SET[g]).join(' · ')) + '</i></span>';
    }).join('');
    var html = '<div class="pet-sum"><span class="label">보유 효과 합계 (모은 동물 모두 · 늘 켜짐)</span><b>' + esc(ownSummary()) + '</b></div>' +
      '<div class="pet-sets"><span class="label">세트 보너스 · 한 종류 네 등급 = 그 종류 보유 효과 두 배 · 한 등급 ' + P.SPECIES.length + '종 = 아래 보너스</span><div>' + gs + '</div></div>' +
      '<div class="pet-dex-head"><span></span>' + P.GRADES.map(function (g) { return '<span style="color:' + P.GRADE[g].color + '">' + P.GRADE[g].name + '</span>'; }).join('') + '</div>';
    P.SPECIES.forEach(function (sp) {
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
    var swapCost = g.swap, canSwap = st < P.STAR_MAX;
    box.style.setProperty('--gc', g.color);
    box.innerHTML = '<button class="pet-x" id="pets-detail-x" aria-label="자세히 닫기">×</button>' +
      '<div class="pet-big' + (st ? '' : ' locked') + '">' + A.draw(x.id, { grade: x.g, anim: !!st, outfit: st ? P.wearing(S(), detailKey) : '' }) + '</div>' +
      '<div class="pet-info"><span class="label" style="color:' + g.color + '">' + g.name + ' · ' + esc(sp.kind) + '</span><h3>' + (st ? ttl(detailKey) : '') + esc(st ? P.nameOf(S(), detailKey) : sp.name) + ' ' + (st ? stars(st) : '<span class="muted" style="font-size:13px">아직 없음</span>') + '</h3>' +
        '<small class="muted">' + esc(sp.line) + '</small></div>' +
      '<div class="pet-eff"><div><em>보유 효과</em><b class="own">' + esc(own.join(' · ')) + '</b><small>갖고만 있어도 늘 켜짐</small></div>' +
        '<div><em>장착 효과</em><b class="eq">' + esc(eq.join(' · ')) + '</b><small>파트너 1마리만' + (eq.join('').indexOf('⚡') >= 0 ? ' · ⚡는 특별 출동에서 꺼짐' : '') + '</small>' + zapLocked + '</div></div>' +
      (st ? '' : '<p class="muted" style="font-size:12px">아직 없어서 ★1 기준으로 보여 줘요.</p>') +
      (st ? nameRow() : '') +
      (st ? outfitSelect() : '') +
      (st && root.Team3AchUI ? '<div class="pet-name">' + root.Team3AchUI.titleSelect('pets-ttl', (S().ach && S().ach.pet[detailKey]) || '', '칭호') + '</div>' : '') +
      '<div class="pet-acts">' +
        (st ? (p.eq === detailKey ? '<button class="ghost" disabled>지금 파트너</button>' : '<button class="primary" id="pets-equip">파트너로</button>') : '') +
        (x.g === 'l' && canSwap && p.picks && p.picks.l > 0 ? '<button class="primary" id="pets-pick">전설 선택권으로 ' + (st ? '★ 올리기' : '데려오기') + ' (' + p.picks.l + '장)</button>' : '') +
        (canSwap ? '<button class="ghost" id="pets-swap"' + (p.treats < swapCost ? ' disabled' : '') + '>간식 ' + swapCost + '개로 ' + (st ? '★ 올리기' : '데려오기') + '</button>' : '') +
      '</div>';
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
    var price = !c ? '첫 한 번 무료' : tags ? '이름표 1장 (' + tags + '장)' : '◆' + c;
    if (!naming) return '<div class="pet-name"><button class="linkish" id="pets-name">이름 짓기 · ' + price + '</button>' +
      (custom ? '<button class="linkish muted" id="pets-name-reset">기본 이름으로</button>' : '') + '</div>' +
      (c && !tags && I && I.NAME_TAGS ? '<div class="pet-name"><button class="linkish muted" id="pets-tags"' + (S().gems < I.NAME_TAGS.gems ? ' disabled' : '') + '>이름표 ' + I.NAME_TAGS.n + '장 · ◆' + I.NAME_TAGS.gems + ' (팀장 이름에도 써요)</button></div>' : '');
    return '<div class="pet-name on"><input id="pets-name-in" maxlength="' + (P.NAME_MAX * 2) + '" autocomplete="off" placeholder="' + P.NAME_MAX + '자까지">' +
      '<button class="primary" id="pets-name-ok">' + (!c ? '무료' : tags ? '이름표' : '◆' + c) + '</button><button class="ghost" id="pets-name-no">취소</button></div>';
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
      if (t.id === 'pets-one') doPull(1);
      else if (t.id === 'pets-ten') doPull(10);
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
        try { var r = P.swap(S(), x.id, x.g); ctx.persist(); toast(r.isNew ? '새 동물이 왔어요!' : '★' + r.star + '로 올랐어요'); } catch (e3) { toast(e3.code === 'NOT_ENOUGH' ? '간식이 모자라요' : '바꿀 수 없어요'); }
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

  root.Team3PetsUI = { mount: mount, open: open, close: close, isOpen: isOpen, renderPartner: renderPartner, isBusy: function () { return busy; } };
})(typeof self !== 'undefined' ? self : this);
