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
  function reward(a) {
    var r = [];
    if (a.tickets) r.push('뽑기권 ' + a.tickets);
    if (a.gems) r.push('◆' + a.gems);
    return r.join(' · ');
  }
  function draw() {
    var s = S(), pr = H.progress(s), rows = H.status(s), groups = {};
    rows.forEach(function (r) { (groups[r.a.group] = groups[r.a.group] || []).push(r); });
    var html = '<div class="ach-top"><b>' + pr.have + ' / ' + pr.total + '</b><span class="muted">달성한 업적</span></div>' +
      titleSelect('ach-title', s.ach.title, '팀장 칭호') +
      '<p class="muted" style="font-size:12px">칭호는 사무실 팀장 이름 앞에 붙어요. 동물 칭호는 동물 창의 자세히에서 달아요.</p>';
    Object.keys(groups).forEach(function (g) {
      html += '<span class="label ach-g">' + esc(g) + '</span>';
      groups[g].forEach(function (r) {
        var pct = Math.min(100, Math.round(r.value / r.a.goal * 100));
        html += '<div class="ach-row' + (r.done ? ' done' : '') + '"><div class="ach-tx"><b>' + esc(r.a.name) + (r.done ? ' ✓' : '') + '</b>' +
          '<small>' + esc(r.a.desc) + ' · 칭호 「' + esc(r.a.title) + '」 · ' + reward(r.a) + '</small>' +
          '<div class="ach-bar"><i style="width:' + pct + '%"></i></div></div><span class="ach-n">' + fmt(r.value) + '/' + fmt(r.a.goal) + '</span></div>';
      });
    });
    html += '<span class="label ach-g">배지로 사는 칭호</span>' + H.SHOP.map(function (t) {
      var have = H.has(s, t.id);
      return '<div class="ach-row shop"><div class="ach-tx"><b>「' + esc(t.title) + '」</b><small>꾸미기 칭호 · 퍼즐과 상관없어요</small></div>' +
        '<button class="buy" data-buy="' + t.id + '"' + (have || s.gems < t.gems ? ' disabled' : '') + '>' + (have ? '보유' : '◆' + t.gems) + '</button></div>';
    }).join('');
    $('ach-body').innerHTML = html;
  }
  function isOpen() { return !$('ach-sheet').hidden; }
  function open() { $('ach-sheet').hidden = false; draw(); $('ach-sheet').querySelector('.sheet').scrollTop = 0; }
  function close() { $('ach-sheet').hidden = true; ctx.render(); }

  /** 새로 달성한 업적 알림(사무실) */
  function notify(list) {
    var dot0 = $('h-ach-dot');
    if (dot0 && list.length) dot0.hidden = false;
    if (list.length > 3) {   // 업데이트 직후처럼 한꺼번에 많이 달성하면 한 줄로
      var t = list.reduce(function (n, a) { return n + (a.tickets || 0); }, 0), g = list.reduce(function (n, a) { return n + (a.gems || 0); }, 0);
      toast('업적 ' + list.length + '개 달성! 칭호 ' + list.length + '개' + (t ? ' · 뽑기권 ' + t : '') + (g ? ' · ◆' + g : '') + ' · 트로피에서 확인');
      try { ctx.UI.sfx.none(); } catch (e) { /* 무시 */ }
      return;
    }
    list.forEach(function (a, i) {
      setTimeout(function () {
        toast('업적 달성: ' + a.name + ' · 칭호 「' + a.title + '」' + (reward(a) ? ' · ' + reward(a) : ''));
        try { if (i === 0) ctx.UI.sfx.none(); } catch (e) { /* 무시 */ }
      }, i * 2600);
    });
  }

  function mount(c) {
    ctx = c;
    var b = $('h-ach');
    if (b) b.innerHTML = TROPHY + '<span class="ach-dot" id="h-ach-dot" hidden></span>';
    b.addEventListener('click', function () { $('h-ach-dot').hidden = true; open(); });
    $('ach-x').addEventListener('click', close);
    $('ach-sheet').addEventListener('click', function (e) {
      if (e.target === this) { close(); return; }
      var t = e.target.closest('button[data-buy]');
      if (!t) return;
      try { var tt = H.buy(S(), t.getAttribute('data-buy')); ctx.persist(); toast('칭호 「' + tt.title + '」를 샀어요'); try { ctx.UI.sfx.coin(); } catch (e2) { /* 무시 */ } }
      catch (e3) { toast(e3.code === 'NOT_ENOUGH' ? '배지가 모자라요' : '살 수 없어요'); }
      draw();
    });
    $('ach-sheet').addEventListener('change', function (e) {
      if (e.target.id !== 'ach-title') return;
      try { H.setTitle(S(), e.target.value); ctx.persist(); ctx.render(); toast(e.target.value ? '칭호 「' + H.titleText(e.target.value) + '」를 달았어요' : '칭호를 뗐어요'); } catch (e2) { toast('달 수 없어요'); }
    });
  }

  root.Team3AchUI = { mount: mount, open: open, close: close, isOpen: isOpen, notify: notify, titleSelect: function (id, cur, label) { return ctx ? titleSelect(id, cur, label) : ''; } };
})(typeof self !== 'undefined' ? self : this);
