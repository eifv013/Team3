/*
 * Team3CrewUI(0.8.0) — 팀 탭의 팀원 직무(3팀 작은 탭 아래) · 수사 기법(기법 작은 탭) · 출동 탭의 공용 장비. 규칙은 crew.js.
 *   칸 모양은 지금 사무실 칸(.item)과 같다. 새로 열린 칸은 파란 "새" 표시, 다음 사건에서 열릴 칸은 잠긴 채 미리 보인다.
 *   1초마다 다시 그리되 내용이 같으면 그대로 둔다(누르는 도중 단추가 바뀌지 않게).
 */
(function (root) {
  'use strict';
  var Cr = root.Team3Crew;
  if (!Cr) return;
  var ctx = null;
  function $(id) { return document.getElementById(id); }
  function S() { return ctx.getSave(); }
  function setHTML(el, h) { if (el && el._ch !== h) { el._ch = h; el.innerHTML = h; } }
  function disc() { var b = ctx.bonus ? ctx.bonus() : null; return b && b.gear ? b.gear : 0; }
  var COLOR = { r: '#E5484F', b: '#2F6FD6', y: '#E0A100', g: '#2E9E5B' };

  function pips(l, max) { if (max > 12) return ''; var h = ''; for (var i = 0; i < max; i++) h += '<i class="' + (i < l ? 'f' : '') + '"></i>'; return '<span class="cr-pips">' + h + '</span>'; }
  function row(o) {
    var s = S(), c = o.cost, max = c == null, ok = !max && s.money >= c;
    return '<div class="item cr-row' + (o.isNew ? ' cr-new' : '') + '" data-cr="' + o.kind + ':' + o.id + '"' + (o.tag ? ' data-tag="' + o.tag + '"' : '') + '>' +
      '<div class="ic cr-ic' + (o.card ? ' cr-card' : '') + '"' + (o.card ? ' style="--c:' + o.card + '"' : '') + '><span aria-hidden="true">' + o.icon + '</span></div>' +
      '<div class="tx"><b>' + o.name + (o.lvText ? ' ' + o.lvText : '') + '</b><small>' + o.sub + '</small>' + o.extra + '</div>' +
      '<button class="buy' + (max ? ' max' : ok ? '' : ' poor') + '" data-crbuy="' + o.kind + ':' + o.id + '"' + (max || !ok ? ' disabled' : '') + ' aria-label="' + o.name + (max ? ' 다 올림' : ' ' + o.verb + ', ' + ctx.fmt(c)) + '">' +
        (max ? '<em>다 올렸어요</em><b>MAX</b>' : '<em>' + o.verb + '</em><b class="cn">' + ctx.fmtShort(c) + '</b>') + '</button>' +
      '<span class="cr-eff">' + o.eff + '</span></div>';
  }
  function lockRow(o) {
    return '<div class="item cr-row cr-lock"><div class="ic cr-ic' + (o.card ? ' cr-card' : '') + '"' + (o.card ? ' style="--c:' + o.card + '"' : '') + '><span aria-hidden="true">' + o.icon + '</span></div>' +
      '<div class="tx"><b>' + o.name + '</b><small>' + o.sub + '</small></div><span class="cr-lockb">🔒 ' + o.lock + '</span><span class="cr-eff">' + o.eff + '</span></div>';
  }
  // 0단계면 "+0%" 대신 첫 단계 효과만, 그 뒤로는 지금 → 다음
  function effLine(x, l, max) { return l <= 0 ? '첫 단계 <em>' + Cr.effText(x, 1) + '</em>' : '<em>' + Cr.effText(x, l) + '</em>' + (l < max ? ' → ' + Cr.effText(x, l + 1) : ' · 최고 단계'); }

  function renderCrew() {
    var s = S(), c = s.crew, d = disc();
    var open = Cr.rolesOpen(s), next = Cr.rolesNext(s);
    setHTML($('h-crew'), open.map(function (x) {
      var l = c.r[x.id];
      return row({ kind: 'r', id: x.id, icon: x.icon, name: x.name, lvText: l + '명', sub: x.desc, extra: '', cost: Cr.roleCost(s, x.id, d), verb: '영입',
        eff: effLine(x, l, x.max), isNew: Cr.isNew(s, 'r', x.id), tag: '사건 ' + x.caseNo + '에서 새로' });
    }).join('') + (next.length ? '<span class="section-t cr-next">다음 사건에서 열려요</span>' + next.map(function (x) {
      return lockRow({ icon: x.icon, name: x.name, sub: x.desc, lock: '사건 ' + x.caseNo, eff: Cr.NAME[x.key] + ' 단계마다 +' + x.per + Cr.UNIT[x.key] });
    }).join('') : ''));
  }
  function renderKit() {
    var s = S(), c = s.crew, d = disc();
    var open = Cr.kitsOpen(s), next = Cr.kitsNext(s);
    setHTML($('h-kit'), open.map(function (x) {
      var l = c.k[x.id], max = x.costs.length;
      return row({ kind: 'k', id: x.id, icon: x.icon, name: x.name, lvText: l + '/' + max, sub: x.desc, extra: pips(l, max), cost: Cr.kitCost(s, x.id, d), verb: '장착',
        eff: effLine(x, l, max), isNew: Cr.isNew(s, 'k', x.id), tag: '사건 ' + x.caseNo + '에서 새로' });
    }).join('') + (next.length ? '<span class="section-t cr-next">다음 사건에서 열려요</span>' + next.map(function (x) {
      return lockRow({ icon: x.icon, name: x.name, sub: x.desc, lock: '사건 ' + x.caseNo, eff: Cr.NAME[x.key] + ' 단계마다 +' + x.per + Cr.UNIT[x.key] });
    }).join('') : ''));
  }
  function renderTech() {
    var s = S(), c = s.crew, open = Cr.techsOpen(s), locked = Cr.techsLocked(s);
    var tot = Cr.techs().length;
    var head = '<div class="cr-head"><b>열린 기법 ' + open.length + ' / ' + tot + '</b><small>증거 1장 = 기법 1개</small></div>';
    var body = open.length ? open.map(function (x) {
      var l = c.t[x.id];
      return row({ kind: 't', id: x.id, icon: x.icon, card: COLOR[x.color], name: x.name, lvText: l + '단계', sub: '증거 「' + x.card + '」', extra: pips(l, x.max),
        cost: Cr.techCost(s, x.id), verb: l ? '올리기' : '익히기', eff: effLine(x, l, x.max), isNew: Cr.isNew(s, 't', x.id), tag: '새 기법' });
    }).join('') : '<p class="cr-empty">증거판에서 증거 카드를 얻으면 그 증거의 수사 기법이 여기 열려요.</p>';
    var peek = locked.slice(0, 3).map(function (x) {
      return lockRow({ icon: x.icon, card: COLOR[x.color], name: x.name, sub: '증거 「' + x.card + '」 필요', lock: '증거', eff: Cr.NAME[x.key] + ' 단계마다 +' + x.per + Cr.UNIT[x.key] });
    }).join('');
    setHTML($('h-tech'), head + body + (locked.length ? '<span class="section-t cr-next">아직 못 연 기법 · ' + locked.length + '개</span>' + peek +
      '<button class="ghost cr-go-evid" id="h-tech-evid">증거판에서 증거 얻기 ›</button>' : ''));
  }

  function render() {
    if (!ctx || !$('h-crew')) return;
    renderCrew(); renderKit(); renderTech();
  }
  function onBuy(e) {
    var b = e.target.closest('[data-crbuy]');
    if (e.target.closest('#h-tech-evid')) { if (ctx.showTab) ctx.showTab('evid'); return; }
    if (!b || b.disabled) return;
    var p = b.getAttribute('data-crbuy').split(':'), s = S(), x, lv;
    try { lv = Cr.buy(s, p[0], p[1], p[0] === 't' ? 0 : disc()); }
    catch (er) { if (er.code === 'NOT_ENOUGH') ctx.UI.toast('수사비가 모자라요'); return; }
    x = p[0] === 'r' ? Cr.ROLES.filter(function (q) { return q.id === p[1]; })[0] : p[0] === 'k' ? Cr.KITS.filter(function (q) { return q.id === p[1]; })[0] : Cr.techById(p[1]);
    try { ctx.UI.sfx.coin(); } catch (er2) { /* 무시 */ }
    ctx.UI.buzz(10);
    ctx.persist(); ctx.render(); render();
    var r = document.querySelector('[data-cr="' + p[0] + ':' + p[1] + '"]');
    if (r) { r.classList.remove('bought'); void r.offsetWidth; r.classList.add('bought'); }
    if (x && (lv === 1 || p[0] === 'k')) ctx.UI.toast(x.name + (p[0] === 'k' ? ' 장착' : p[0] === 't' ? ' ' + lv + '단계' : ' 영입') + ' · ' + Cr.effText(x, lv));
  }
  // 그 칸을 한 번 보면 "새" 표시를 지운다(탭을 떠날 때)
  function seen(kind) {
    var s = S(), ids = kind === 'r' ? Cr.rolesOpen(s).map(function (x) { return x.id; }) : kind === 'k' ? Cr.kitsOpen(s).map(function (x) { return x.id; }) : Cr.techsOpen(s).map(function (x) { return x.id; });
    Cr.markSeen(s, kind, ids); ctx.persist();
  }
  function mount(c) {
    ctx = c;
    ['h-crew', 'h-kit', 'h-tech'].forEach(function (id) { if ($(id)) $(id).addEventListener('click', onBuy); });
    render();
  }
  root.Team3CrewUI = { mount: mount, render: render, seen: seen };
})(typeof self !== 'undefined' ? self : this);
