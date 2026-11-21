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
    var eff = P.describe(P.eqEffect(x.id, x.g, st));
    box.innerHTML = '<button class="pet-art" id="h-pet-art" aria-label="' + esc(nm) + ' 쓰다듬기" style="--gc:' + g.color + '">' + A.draw(x.id, { grade: x.g, anim: true }) + '</button>' +
      '<div class="pet-tx"><b><span style="color:' + g.color + '">' + g.name + '</span> ' + ttl(p.eq) + esc(nm) + ' ' + stars(st) + '</b><small>' + esc(eff.join(' · ')) + '</small></div>' +
      '<button class="buy" id="h-pet-open">동물' + dot + '</button>';
  }
  function pat() {
    var b = $('h-pet-art'), x = P.parse(pets().eq);
    if (!b || !x) return;
    b.innerHTML = A.draw(x.id, { grade: x.g, mood: 'happy', anim: true });
    try { ctx.UI.sfx.pick(3); } catch (e) { /* 소리 실패는 무시 */ }
    ctx.UI.buzz(8);
    clearTimeout(pat.t);
    pat.t = setTimeout(function () { var bb = $('h-pet-art'); if (bb) bb.innerHTML = A.draw(x.id, { grade: x.g, anim: true }); }, 1400);
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
    drawDetail();
    if (tab === 'draw') drawDraw(); else drawDex();
  }

  function payLabel(n) {
    var p = pets();
    if (p.tickets >= n) return { pay: 'ticket', text: '뽑기권 ' + n + '장' };
    return { pay: 'gems', text: '◆' + (n === 10 ? P.COST.ten : P.COST.one) };
  }
  function drawDraw() {
    var p = pets(), one = payLabel(1), ten = payLabel(10);
    $('pets-pity').innerHTML = '전설 확정까지 <b>' + (P.PITY - p.pity) + '번</b> · 지금까지 ' + fmt(p.pulls) + '번 뽑음';
    $('pets-one').innerHTML = '1회 뽑기<small>' + one.text + '</small>';
    $('pets-ten').innerHTML = '10회 뽑기<small>' + ten.text + ' · 희귀 이상 1마리 보장</small>';
    $('pets-one').disabled = busy || (one.pay === 'gems' && S().gems < P.COST.one);
    $('pets-ten').disabled = busy || (ten.pay === 'gems' && S().gems < P.COST.ten);
    $('pets-rates').innerHTML = '<table class="pet-rates"><tr><th>등급</th><th>등급 확률</th><th>한 마리</th></tr>' +
      P.rates().map(function (r) { return '<tr><td style="color:' + P.GRADE[r.g].color + '">' + r.name + '</td><td>' + r.pct + '%</td><td>' + r.each + '%</td></tr>'; }).join('') + '</table>' +
      '<p class="muted">등급을 먼저 정하고, 그 등급의 ' + P.SPECIES.length + '종 중 하나가 같은 확률로 나와요.</p>' +
      '<p class="muted">천장: ' + P.PITY + '번째까지 전설이 한 번도 안 나오면 그 번째는 전설 확정(전설이 나오면 다시 0부터).</p>' +
      '<p class="muted">10회 뽑기에서 모두 일반이면 마지막 한 마리는 희귀.</p>' +
      '<p class="muted">같은 동물이 또 나오면 ★가 올라요(★5까지, ★마다 효과 +25%). ★5 뒤에는 간식(일반 1 · 희귀 3 · 영웅 10 · 전설 30)으로 바뀌어요.</p>' +
      '<p class="muted">뽑기권은 처음 선물 · 사건 종결 · 승진 · 메달 · 특별 출동으로 받아요. 동물은 퍼즐 실력을 대신하지 않아요: ⚡ 퍼즐 도움은 영웅·전설의 일부만, 특별 출동에서는 꺼져요.</p>';
  }

  function doPull(n) {
    if (busy) return;
    var c = payLabel(n), r;
    try { r = P.pull(S(), n, c.pay, Math.random); } catch (e) { toast(e.code === 'NOT_ENOUGH' ? (c.pay === 'gems' ? '배지가 모자라요' : '뽑기권이 모자라요') : '뽑을 수 없어요'); return; }
    ctx.persist();
    busy = true;
    var res = $('pets-result'), best = 'c';
    r.results.forEach(function (x) { if (P.GRADES.indexOf(x.g) > P.GRADES.indexOf(best)) best = x.g; });
    res.className = 'pet-result n' + n + ' best-' + best;
    res.innerHTML = r.results.map(function (x, i) {
      var sp = P.BY_ID[x.id], g = P.GRADE[x.g];
      var tag = x.isNew ? '<em class="new">NEW</em>' : x.treats ? '<em>간식 +' + x.treats + '</em>' : '<em>★' + x.star + '</em>';
      return '<div class="pet-got g-' + x.g + '" style="--gc:' + g.color + ';animation-delay:' + (i * (n === 10 ? 0.16 : 0)) + 's">' +
        A.draw(x.id, { grade: x.g, mood: x.g === 'l' || x.g === 'h' ? 'happy' : null }) + '<span><b style="color:' + g.color + '">' + g.name + '</b> ' + esc(P.nameOf(S(), x.key) || sp.name) + '</span>' + tag + '</div>';
    }).join('');
    try { ctx.UI.sfx.coin(); } catch (e) { /* 무시 */ }
    var wait = n === 10 ? 1800 : 400;
    setTimeout(function () {
      try { if (best === 'l' || best === 'h') ctx.UI.sfx.none(); } catch (e) { /* 무시 */ }
      if (best === 'l') ctx.UI.buzz([30, 60, 30, 60, 80]);
      busy = false;
      draw();
      renderPartner();
    }, wait);
    drawDraw();
    $('pets-wallet').innerHTML = '<span>뽑기권 <b>' + fmt(pets().tickets) + '</b></span><span>배지 <b>◆' + fmt(S().gems) + '</b></span><span>간식 <b>' + fmt(pets().treats) + '</b></span>';
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
    var html = '<div class="pet-sum"><span class="label">보유 효과 합계 (모은 동물 모두 · 늘 켜짐)</span><b>' + esc(ownSummary()) + '</b></div>' +
      '<div class="pet-dex-head"><span></span>' + P.GRADES.map(function (g) { return '<span style="color:' + P.GRADE[g].color + '">' + P.GRADE[g].name + '</span>'; }).join('') + '</div>';
    P.SPECIES.forEach(function (sp) {
      html += '<div class="pet-dex-row"><span class="pet-dex-name"><b>' + esc(sp.name) + '</b><small>' + esc(sp.kind) + '</small></span>' +
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
      '<div class="pet-big' + (st ? '' : ' locked') + '">' + A.draw(x.id, { grade: x.g, anim: !!st }) + '</div>' +
      '<div class="pet-info"><span class="label" style="color:' + g.color + '">' + g.name + ' · ' + esc(sp.kind) + '</span><h3>' + (st ? ttl(detailKey) : '') + esc(st ? P.nameOf(S(), detailKey) : sp.name) + ' ' + (st ? stars(st) : '<span class="muted" style="font-size:13px">아직 없음</span>') + '</h3>' +
        '<small class="muted">' + esc(sp.line) + '</small></div>' +
      '<div class="pet-eff"><div><em>보유 효과</em><b class="own">' + esc(own.join(' · ')) + '</b><small>갖고만 있어도 늘 켜짐</small></div>' +
        '<div><em>장착 효과</em><b class="eq">' + esc(eq.join(' · ')) + '</b><small>파트너 1마리만' + (eq.join('').indexOf('⚡') >= 0 ? ' · ⚡는 특별 출동에서 꺼짐' : '') + '</small>' + zapLocked + '</div></div>' +
      (st ? '' : '<p class="muted" style="font-size:12px">아직 없어서 ★1 기준으로 보여 줘요.</p>') +
      (st ? nameRow() : '') +
      (st && root.Team3AchUI ? '<div class="pet-name">' + root.Team3AchUI.titleSelect('pets-ttl', (S().ach && S().ach.pet[detailKey]) || '', '칭호') + '</div>' : '') +
      '<div class="pet-acts">' +
        (st ? (p.eq === detailKey ? '<button class="ghost" disabled>지금 파트너</button>' : '<button class="primary" id="pets-equip">파트너로</button>') : '') +
        (canSwap ? '<button class="ghost" id="pets-swap"' + (p.treats < swapCost ? ' disabled' : '') + '>간식 ' + swapCost + '개로 ' + (st ? '★ 올리기' : '데려오기') + '</button>' : '') +
      '</div>';
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
      if (e.target.id !== 'pets-ttl' || !root.Team3Ach) return;
      try { root.Team3Ach.setPetTitle(S(), detailKey, e.target.value); ctx.persist(); renderPartner(); drawDetail(); } catch (e2) { toast('달 수 없어요'); }
    });
    $('pets-sheet').addEventListener('keydown', function (e) {
      if (e.target.id !== 'pets-name-in') return;
      if (e.key === 'Enter') { e.preventDefault(); saveName(); }
      else if (e.key === 'Escape') { e.stopPropagation(); naming = false; drawDetail(); }
    });
    renderPartner();
  }

  root.Team3PetsUI = { mount: mount, open: open, close: close, isOpen: isOpen, renderPartner: renderPartner, isBusy: function () { return busy; } };
})(typeof self !== 'undefined' ? self : this);
