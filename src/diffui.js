/*
 * Team3DiffUI — 난이도 고르기 창(0.7.0). 규칙 · 수치는 diff.js(Team3Diff), 여기는 그림과 단추만.
 *
 *   open('first')  튜토리얼 뒤 한 번: 닫기(X) 없이 고르고 "○○으로 시작하기" → 배정 안내(설정 › 난이도에서 언제든 바꿀 수 있어요)
 *   open('change') 설정 · 출동 단추 아래에서: X 로 닫을 수 있고, 지금 난이도에 "지금" 표시 · "○○으로 바꾸기"
 *
 *   카드 = 사건 파일(꼬리표 · 색 줄 · 단계 막대 · 보상 배수 도장 · 퍼즐/보상 칩). 고르면 "배정" 도장이 쾅.
 *   글은 diff.js 의 수치에서 만든다(배수를 바꿔도 글이 틀리지 않게).
 */
(function () {
  'use strict';
  var Df = window.Team3Diff;
  if (!Df) return;
  var ctx = null, mode = 'first', sel = 'normal', lastTap = { k: null, t: 0 };
  function $(id) { return document.getElementById(id); }
  function S() { return ctx.getSave(); }

  // 받침에 따라 '로/으로' · '이/가'
  function jong(w) { var c = w.charCodeAt(w.length - 1) - 0xAC00; return c >= 0 && c <= 11171 ? c % 28 : 0; }
  function ro(w) { var j = jong(w); return w + (j === 0 || j === 8 ? '로' : '으로'); }
  function ga(w) { return w + (jong(w) === 0 ? '가' : '이'); }
  function sign(n) { return (n > 0 ? '+' : '−') + Math.abs(n); }

  // 퍼즐 · 보상 칩: [좋음 up | 나쁨 dn | 그대로 eq, 이름, 값]
  function puzzleChips(L) {
    if (L.k === 'normal') return [['eq', '🧩 퍼즐', '기본 규칙']];
    var good = L.k === 'easy' ? 'up' : 'dn';
    return [
      [good, '⏱ 시간', sign(L.time) + '초'],
      [good, '❌ 벌점', L.missMul < 1 ? '절반' : '×' + L.missMul],
      [good, '📈 단계', L.lvSpeed < 1 ? '천천히' : '빨리'],
      [good, '🔍 단서', L.freeHints ? '+' + L.freeHints : L.hintPenalty ? '쓰면 −' + L.hintPenalty + '초' : '기본']
    ];
  }
  function rewardChips(L) {
    if (L.k === 'normal') return [['eq', '💰 모든 보상', '기본 100%'], ['eq', '🏅 특별 출동', '메달 · 배지']];
    var good = L.pay > 1 ? 'up' : 'dn';
    var out = [[good, '💰 수사비', '×' + L.pay], [good, '🧩 재수사 단서', '×' + L.clue], [good, '⭐ 경험치', '×' + L.xp]];
    if (L.k === 'easy') out.push(['dn', '🏅 특별 출동', '참가 보상만']);
    else out.push(['up', '🏅 메달 배지', '+1'], ['up', '🎟️ 금메달', '뽑기권 +1']);
    return out;
  }
  function chips(a) { return a.map(function (r) { return '<span class="df-chip ' + r[0] + '">' + r[1] + ' <em>' + r[2] + '</em></span>'; }).join(''); }

  function card(k, cur) {
    var L = Df.info(k), lv = '';
    for (var i = 1; i <= 3; i++) lv += '<span class="' + (i <= L.lv ? 'f' : '') + '"></span>';
    // 오른쪽 위 배지: 처음 고를 때는 강력 사건에 "추천", 바꿀 때는 지금 난이도에 "지금"
    var badge = mode === 'first' ? (k === 'normal' ? '<span class="df-badge">추천</span>' : '') : (k === cur ? '<span class="df-badge now">현재</span>' : '');
    var gold = k === 'hard' ? '<div class="df-row"><h4>미제 사건 전용</h4><div class="df-chips">' +
      ['🏷️ 미제 전담 칭호', '🏆 전용 업적', '📌 전용 증거 카드'].map(function (g) { return '<span class="df-chip gold">' + g + '</span>'; }).join('') + '</div></div>' : '';
    return '<button class="df-file' + (k === sel ? ' on' : '') + (badge ? ' reco' : '') + '" data-df="' + k + '" style="--c:' + L.color + '" aria-pressed="' + (k === sel) + '">' +
      '<span class="df-tab">' + L.tag + '</span>' + badge +
      '<div class="df-body"><div class="df-top"><span class="df-ico" aria-hidden="true">' + L.icon + '</span>' +
        '<div class="df-nm"><b>' + L.name + '</b><small>' + L.desc + '</small><div class="df-lv">' + lv + '</div></div>' +
        '<div class="df-stamp"><div>×' + L.pay + '<small>출동 보상</small></div></div></div>' +
      '<div class="df-rows"><div class="df-row"><h4>퍼즐</h4><div class="df-chips">' + chips(puzzleChips(L)) + '</div></div>' +
        '<div class="df-row"><h4>보상</h4><div class="df-chips">' + chips(rewardChips(L)) + '</div></div>' + gold + '</div></div>' +
      '<span class="df-assign">배정</span></button>';
  }

  function draw() {
    var cur = Df.get(S()), L = Df.info(sel);
    var x = mode === 'first' ? '' : '<button class="x-btn" id="df-x" aria-label="닫기"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
    var btn = mode === 'first' ? ro(L.name) + ' 시작하기 →' : sel === cur ? '현재 난이도예요' : ro(L.name) + ' 바꾸기';
    $('df-sheet-in').innerHTML = x +
      '<span class="df-kick"><i></i>' + (mode === 'first' ? '사건 배정' : '난이도') + '</span>' +
      '<h2 id="df-title">어떤 사건을 맡을까요?</h2>' +
      '<p class="df-sub">현장 출동(퍼즐)만 달라져요. <b>팀 · 부서 수입은 똑같아요.</b><br>설정에서 언제든지 바꿀 수 있어요.</p>' +
      Df.ORDER.map(function (k) { return card(k, cur); }).join('') +
      '<button class="df-go" id="df-go"' + (mode !== 'first' && sel === cur ? ' disabled' : '') + '>' + btn + '</button>' +
      '<div class="df-note"><span>💡</span><span>카드를 두 번 톡톡 눌러도 바로 정해져요. 보상은 그 판을 출동한 난이도로 매기고, 출동 결과에 함께 표시돼요.</span></div>';
  }

  // 처음 고른 뒤: 배정 안내(어디서 바꾸는지)
  function drawDone() {
    var L = Df.info(Df.get(S()));
    $('df-sheet-in').innerHTML = '<div class="df-done" style="--c:' + L.color + '">' +
      '<span class="big" aria-hidden="true">' + L.icon + '</span>' +
      '<h3 id="df-title">' + ga(L.name) + ' 배정됐어요</h3>' +
      '<p>난이도는 언제든지 바꿀 수 있어요.<br>바꾼 다음 출동부터 적용돼요.</p>' +
      '<span class="df-path">⚙️ 설정 <i>›</i> 난이도</span>' +
      '</div><button class="df-go" id="df-ok">수사 시작</button>';
    try { $('df-ok').focus({ preventScroll: true }); } catch (e) { /* 옛 브라우저 */ }
  }

  function open(m) {
    if (!ctx) return;
    mode = m === 'change' ? 'change' : 'first';
    sel = Df.get(S());
    draw();
    $('diff-sheet').hidden = false;
    $('df-sheet-in').scrollTop = 0;
  }
  function close() {
    $('diff-sheet').hidden = true;
    if (ctx) ctx.render();
  }
  function isOpen() { return !$('diff-sheet').hidden; }

  function onClick(e) {
    var t = e.target;
    var f = t.closest('[data-df]');
    if (f) {
      // 0.8.0 두 번 톡톡: 같은 카드를 0.45초 안에 다시 누르면 고르고 바로 확인(아래 확인 단추도 그대로)
      var k = f.getAttribute('data-df'), now = Date.now();
      if (lastTap.k === k && now - lastTap.t < 450) { lastTap = { k: null, t: 0 }; var gb = $('df-go'); if (gb && !gb.disabled) gb.click(); return; }
      lastTap = { k: k, t: now };
      if (sel === k) return;
      sel = k;
      try { ctx.UI.sfx.tap && ctx.UI.sfx.tap(); } catch (er) { /* 소리 실패는 무시 */ }
      ctx.UI.buzz(8);
      var sc = $('df-sheet-in').scrollTop;
      draw();
      $('df-sheet-in').scrollTop = sc;
      return;
    }
    if (t.closest('#df-x')) { close(); return; }
    if (t.closest('#df-ok')) { close(); return; }
    if (t.closest('#df-go')) {
      var s = S(), was = Df.get(s);
      Df.set(s, sel);
      ctx.persist();
      try { ctx.UI.sfx.coin(); } catch (er) { /* 무시 */ }
      ctx.UI.buzz([12, 30, 12]);
      if (mode === 'first') { drawDone(); return; }
      close();
      if (was !== sel) ctx.UI.toast(ga(Df.info(sel).name) + ' 배정됐어요 · 다음 출동부터 적용돼요');
    }
  }

  // 설정 창 · 출동 단추 아래의 "지금 난이도" 표시
  function renderSet() {
    var b = $('set-diff'); if (!b || !ctx) return;
    var L = Df.info(Df.get(S()));
    b.style.setProperty('--c', L.color);
    b.innerHTML = '<i aria-hidden="true">' + L.icon + '</i><span><b>' + L.name + '</b><small>출동 보상 ×' + L.pay + ' · ' + L.desc + '</small></span><em>바꾸기 ›</em>';
  }

  function mount(c) {
    ctx = c;
    $('diff-sheet').addEventListener('click', onClick);
    var sb = $('set-diff');
    if (sb) sb.addEventListener('click', function () { ctx.UI.closeSettings(); setTimeout(function () { open('change'); }, 30); });
    var gb = $('h-go-diff');
    if (gb) gb.addEventListener('click', function () { if (!ctx.UI.sheetOpen()) open('change'); });
    // 설정 창이 열릴 때마다 지금 난이도를 다시 적는다
    var st = $('settings-sheet');
    if (st && window.MutationObserver) new MutationObserver(function () { if (!st.hidden) renderSet(); }).observe(st, { attributes: true, attributeFilter: ['hidden'] });
    renderSet();
  }

  window.Team3DiffUI = { mount: mount, open: open, close: close, isOpen: isOpen, renderSet: renderSet };
})();
