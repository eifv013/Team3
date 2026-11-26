/*
 * Team3AchUI(0.3.0) — 업적 창(트로피 단추)과 칭호 고르기.
 *   규칙·저장은 Team3Ach(H). save 는 사무실(hub.js)이 들고 있어 mount 때 getSave/persist/render 를 받는다.
 *   창: 달성 수 · 팀장 칭호 고르기 · 업적 목록(진행 막대, 보상) · 배지로 사는 칭호.
 *   달성 알림: notify(목록) — 사무실에 있을 때 차례로 토스트.
 */
(function (root) {
  'use strict';
  var H = root.Team3Ach;
  if (!H) return;
  var $ = function (id) { return document.getElementById(id); };
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function fmt(n) { return Math.floor(n).toLocaleString('ko-KR'); }
  var ctx = null;
  function S() { return ctx.getSave(); }
  function toast(t) { try { ctx.UI.toast(t); } catch (e) { /* 없음 */ } }

  var TROPHY = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M10 17h4"/></svg>';

  /** 칭호 고르기 <select> (쓸 수 있는 칭호 + 없음) */
  function titleSelect(id, cur, label) {
    var list = H.owned(S());
    return '<label class="ach-pick"><span>' + label + '</span><select id="' + id + '"' + (list.length ? '' : ' disabled') + '>' +
      '<option value="">' + (list.length ? '칭호 없음' : '아직 칭호가 없어요') + '</option>' +
      list.map(function (t) { return '<option value="' + t.id + '"' + (t.id === cur ? ' selected' : '') + '>' + esc(t.title) + '</option>'; }).join('') + '</select></label>';
  }
  // 0.6.0 재화 아이콘(Team3Icons 가 없으면 글자)
  function ic(name) { var I = root.Team3Icons; return I ? I.icon(name) : (name === 'gem' ? '◆' : name === 'ticket' ? '뽑기권 ' : ''); }
  // plain = 알림(글자만)용
  function reward(a, plain) {
    var r = [];
    if (a.tickets) r.push(plain ? '뽑기권 ' + a.tickets : ic('ticket') + a.tickets);
    if (a.gems) r.push(plain ? '배지 ' + a.gems : ic('gem') + a.gems);
    return r.join(', ');
  }
  /*
   * 0.6.0 창: 탭 둘 — 업적(달성 · 보상 받기, 빨간 점) / 칭호(팀장 칭호 고르기 · 가진 칭호 · 배지로 사는 칭호를 한 줄 칩으로)
   *   보상은 눌러서 받는다(받기 · 모두 받기). 받을 게 남은 업적은 맨 위로.
   */
  var tab = 'ach';
  function draw() {
    var s = S(), pr = H.progress(s), rows = H.status(s), left = H.unclaimed(s);
    var html = '<div class="ach-tabs" role="tablist"><button data-tab="ach" class="' + (tab === 'ach' ? 'on' : '') + '">업적 ' + pr.have + '/' + pr.total + (left ? '<i class="dot"></i>' : '') + '</button>' +
      '<button data-tab="title" class="' + (tab === 'title' ? 'on' : '') + '">칭호 ' + H.owned(s).length + '</button></div>';
    if (tab === 'ach') {
      if (left) {
        var sum = rows.filter(function (r) { return r.claim; }).reduce(function (o, r) { o.t += r.a.tickets || 0; o.g += r.a.gems || 0; return o; }, { t: 0, g: 0 });
        html += '<button class="primary ach-all" data-claim="*">보상 모두 받기, ' + left + '개' + (sum.t ? ' ' + ic('ticket') + sum.t : '') + (sum.g ? ' ' + ic('gem') + sum.g : '') + '</button>';
      }
      var groups = {}, order = [];
      // 받을 게 남은 업적 → 진행 중 → 받은 업적 순
      rows.slice().sort(function (a, b) { var k = function (r) { return r.claim ? 0 : r.done ? 2 : 1; }; return k(a) - k(b); }).forEach(function (r) {
        var g = r.claim ? '받을 보상' : r.a.group; if (!groups[g]) { groups[g] = []; order.push(g); } groups[g].push(r);
      });
      order.forEach(function (g) {
        html += '<span class="label ach-g">' + esc(g) + '</span>';
        groups[g].forEach(function (r) {
          var pct = Math.min(100, Math.round(r.value / r.a.goal * 100));
          html += '<div class="ach-row' + (r.done ? ' done' : '') + (r.claim ? ' claim' : '') + '">' + (r.claim ? '<i class="dot"></i>' : '') +
            '<div class="ach-tx"><b>' + esc(r.a.name) + (r.done && !r.claim ? ' ✓' : '') + '</b>' +
            '<small>' + esc(r.a.desc) + ', 칭호 「' + esc(r.a.title) + '」</small>' +
            (r.done ? '' : '<div class="ach-bar"><i style="width:' + pct + '%"></i></div>') + '</div>' +
            (r.claim ? '<button class="buy ach-get" data-claim="' + r.a.id + '">받기<small>' + reward(r.a) + '</small></button>'
              : '<span class="ach-n">' + (r.done ? reward(r.a) : fmt(r.value) + '/' + fmt(r.a.goal) + '<small>' + reward(r.a) + '</small>') + '</span>') + '</div>';
        });
      });
    } else {
      html += titleSelect('ach-title', s.ach.title, '팀장 칭호') +
        '<p class="muted" style="font-size:12px;margin:4px 0 0">칭호는 사무실 팀장 이름 앞에 붙어요. 동물 칭호는 동물 창의 자세히에서 달아요.</p>' +
        '<span class="label ach-g">배지로 사는 칭호</span><div class="ach-shop">' + H.SHOP.map(function (t) {
          var have = H.has(s, t.id);
          return '<button class="ach-chip' + (have ? ' have' : '') + '" data-buy="' + t.id + '"' + (have || s.gems < t.gems ? ' disabled' : '') + '>「' + esc(t.title) + '」<small>' + (have ? '보유' : ic('gem') + t.gems) + '</small></button>';
        }).join('') + '</div>' +
        '<span class="label ach-g">가진 칭호</span><div class="ach-shop">' + (H.owned(s).map(function (t) { return '<span class="ach-chip have">「' + esc(t.title) + '」</span>'; }).join('') || '<span class="muted" style="font-size:13px">업적을 달성하면 칭호가 생겨요</span>') + '</div>';
    }
    $('ach-body').innerHTML = html;
    dot();
  }
  /** 트로피 빨간 점: 받을 보상이 남아 있으면 늘 */
  function dot() { var d = $('h-ach-dot'); if (d) d.hidden = !(ctx && H.unclaimed(S()) > 0); }
  function isOpen() { return !$('ach-sheet').hidden; }
  function open() { tab = 'ach'; $('ach-sheet').hidden = false;   // 0.13.18 늘 업적 칸부터
    draw(); $('ach-sheet').querySelector('.sheet').scrollTop = 0; }
  function close() { $('ach-sheet').hidden = true; ctx.render(); }

  /** 새로 달성한 업적 알림(사무실) */
  function notify(list) {
    var dot0 = $('h-ach-dot');
    if (dot0 && list.length) dot0.hidden = false;
    if (list.length > 3) {   // 업데이트 직후처럼 한꺼번에 많이 달성하면 한 줄로
      var t = list.reduce(function (n, a) { return n + (a.tickets || 0); }, 0), g = list.reduce(function (n, a) { return n + (a.gems || 0); }, 0);
      toast('업적 ' + list.length + '개 달성! 칭호 ' + list.length + '개, 트로피에서 보상 받기');
      try { ctx.UI.sfx.none(); } catch (e) { /* 무시 */ }
      return;
    }
    list.forEach(function (a, i) {
      setTimeout(function () {
        toast('업적 달성: ' + a.name + ', 칭호 「' + a.title + '」, 트로피에서 보상 받기');
        try { if (i === 0) ctx.UI.sfx.none(); } catch (e) { /* 무시 */ }
      }, i * 2600);
    });
  }

  function mount(c) {
    ctx = c;
    var b = $('h-ach');
    if (b) b.innerHTML = TROPHY + '<span class="ach-dot" id="h-ach-dot" hidden></span>';
    b.addEventListener('click', function () { open(); });
    dot();
    $('ach-x').addEventListener('click', close);
    $('ach-sheet').addEventListener('click', function (e) {
      if (e.target === this) { close(); return; }
      var tb = e.target.closest('.ach-tabs button');
      if (tb) { tab = tb.getAttribute('data-tab'); draw(); return; }
      var cb = e.target.closest('button[data-claim]');
      if (cb) {
        var id = cb.getAttribute('data-claim'), P = root.Team3Pets;
        try {
          var r = H.claim(S(), id === '*' ? null : id, P ? P.addTickets : null);
          ctx.persist(); ctx.render();
          toast('보상 받음' + (r.tickets ? ', 뽑기권 +' + r.tickets : '') + (r.gems ? ', 배지 +' + r.gems : ''));
          try { ctx.UI.sfx.coin(); } catch (e4) { /* 무시 */ }
        } catch (e5) { toast('받을 수 없어요'); }
        draw(); return;
      }
      var t = e.target.closest('button[data-buy]');
      if (!t) return;
      var bid = t.getAttribute('data-buy'), td = (H.SHOP || []).filter(function (z) { return z.id === bid; })[0];
      var doIt = function () {
        try { var tt = H.buy(S(), bid); ctx.persist(); toast('칭호 「' + tt.title + '」를 샀어요'); try { ctx.UI.sfx.coin(); } catch (e2) { /* 무시 */ } }
        catch (e3) { toast(e3.code === 'NOT_ENOUGH' ? '배지가 모자라요' : '살 수 없어요'); }
        draw();
      };
      if (!td || !ctx.UI.confirmBuy) { doIt(); return; }
      if (S().gems < td.gems) { toast('배지가 모자라요, ◆' + td.gems + ' 필요'); return; }
      ctx.UI.confirmBuy({ title: '칭호 「' + td.title + '」를 살까요?', cost: ic('gem') + td.gems, onOk: doIt });
    });
    $('ach-sheet').addEventListener('change', function (e) {
      if (e.target.id !== 'ach-title') return;
      try { H.setTitle(S(), e.target.value); ctx.persist(); ctx.render(); toast(e.target.value ? '칭호 「' + H.titleText(e.target.value) + '」를 달았어요' : '칭호를 뗐어요'); } catch (e2) { toast('달 수 없어요'); }
    });
  }

  root.Team3AchUI = { mount: mount, open: open, close: close, isOpen: isOpen, notify: notify, dot: function () { if (ctx) dot(); }, titleSelect: function (id, cur, label) { return ctx ? titleSelect(id, cur, label) : ''; } };
})(typeof self !== 'undefined' ? self : this);
