/*
 * 사무실 — 수사 3팀의 첫 화면(방치형, 사건 1). SuspectsIdle 의 저장을 들고 1초마다 팀의 일을 반영한다.
 *
 * 흐름: 켜면 저장을 읽고(깨졌으면 새로) → 자리를 비운 동안의 일(잠복 보고)을 보여 주고 → 사무실.
 *      출동은 SuspectsUI.startRun(장비 반영 설정), 끝나면 hooks.onRunEnd 로 결과를 받아 수사비·진척을 올린다.
 * 저장은 이 브라우저(localStorage)에만 남는다. 저장이 막힌 환경에서도 그 자리에서는 끝까지 할 수 있다.
 */
(function () {
  'use strict';
  var UI = window.SuspectsUI, I = window.SuspectsIdle, E = window.Team3Economy;   // E: 상품·메달·특별 출동(0.1.19)
  var PT = window.Team3Pets, PUI = window.Team3PetsUI;   // 0.3.0 동물 뽑기(규칙 · 화면)
  var H = window.Team3Ach, AUI = window.Team3AchUI;      // 0.3.0 업적 · 칭호(규칙 · 화면)
  if (!UI || !I) return;
  var $ = function (id) { return document.getElementById(id); };
  var nowMs = function () { return Date.now(); };
  var KEY = 'guar.suspects3.idle.v1';

  var save = null, pendingClose = false, saveTick = 0;
  var duringRun = null;   // 출동하는 동안 팀이 번 것 { catches, money } — 사무실로 돌아올 때 보여 준다

  /* ---------- 0.3.0 동물 효과 ---------- */
  // 지금 켜진 동물 효과(사건 번호 · 기기 시각으로 개구리 · 부엉이 조건을 센다)
  function petBonus(sv) { return PT ? PT.bonus(sv, { caseNo: sv.caseNo, hour: new Date().getHours() }) : null; }
  if (PT) I.setBonus(petBonus);
  function petsReady() { if (PT) PT.clean(save); if (H) H.clean(save); }
  /*
   * 업적 확인(0.3.0). 사무실을 그릴 때마다(1초) 본다 — 조건이 20개 남짓이라 가볍다.
   *   새로 달성하면 보상(배지 · 뽑기권)을 주고 저장, 사무실에서 차례로 알린다.
   */
  function checkAch() {
    if (!H) return;
    var got = H.check(save, PT ? PT.addTickets : null);
    if (!got.length) return;
    persist();
    if (PUI) PUI.renderPartner();
    if (AUI) AUI.notify(got);
  }
  // 뽑기권 보상(사무실 칸 빨간 점도 다시 그린다). 반환: 결과 화면에 붙일 문구
  function giveTickets(n, why) {
    if (!PT || !(n > 0)) return '';
    PT.addTickets(save, n);
    if (PUI) PUI.renderPartner();
    return '뽑기권 +' + n + (why ? ' (' + why + ')' : '');
  }

  /* ---------- 저장 ---------- */
  function persist() {
    try { window.localStorage.setItem(KEY, I.serialize(save)); } catch (e) { /* 저장 불가: 이번 접속에서만 진행 */ }
  }
  function loadSave() {
    var raw = null;
    try { raw = window.localStorage.getItem(KEY); } catch (e) { raw = null; }
    return I.load(raw, nowMs());
  }

  // 글 넣기 전 꺾쇠 바꾸기(패치노트·일지)
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  /* ---------- 표시 도우미 ---------- */
  function fmt(n) { return Math.floor(n).toLocaleString('ko-KR'); }
  // 큰 값은 만·억·조로 줄인다(단추·수사비가 화면을 넘지 않게). 1,000만 아래는 그대로 쉼표
  function fmtShort(n) {
    n = Math.floor(n);
    if (!isFinite(n) || n >= 1e20) return '9,999경+';   // 이 이상은 사실상 닿지 않는 값
    if (n < 1e7) return fmt(n);
    var units = [[1e16, '경'], [1e12, '조'], [1e8, '억'], [1e4, '만']];
    for (var i = 0; i < units.length; i++) {
      if (n >= units[i][0]) {
        var v = n / units[i][0];
        return (v >= 1e4 ? fmt(v) : (Math.floor(v * 10) / 10).toLocaleString('ko-KR')) + units[i][1];
      }
    }
    return fmt(n);
  }
  function fmtDur(sec) {
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return h > 0 ? h + '시간 ' + m + '분' : m > 0 ? m + '분' : Math.floor(sec) + '초';
  }
  function perMin(x) {
    var v = Math.round(x * 10) / 10;
    return (v % 1 === 0 ? String(v) : v.toFixed(1));
  }
  var GEAR_ICON = {
    time: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
    veteran: '<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>',
    lab: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.5 15h9"/>',
    vault: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M10 14h4"/>',
    recorder: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="8.5" cy="12" r="2.5"/><circle cx="15.5" cy="12" r="2.5"/><path d="M8.5 14.5h7"/>',
    keeper: '<path d="M10 21l1-12h2l1 12z"/><path d="M9 9h6l-1-4h-4z"/><path d="M15 6l6-2M15 8l6 2"/>',
    informant: '<path d="M4 18c2-5 5-7 8-7s6 2 8 7"/><circle cx="12" cy="7" r="3"/><path d="M17 4l2-2M19 7h2"/>'
  };

  /* ---------- 팀이 잡을 때 보이는 것(1.4) ----------
   * 수사비가 "언제" 오르는지 보이게: 다음 검거까지 줄이 차오르고, 잡는 순간 +수사비가 떠오른다.
   */
  var feedTimer = 0;
  function showGain(r, from) {
    if (!r || !r.catches) return;
    var m = $('h-money');
    m.classList.remove('pop'); void m.offsetWidth; m.classList.add('pop');
    var f = document.createElement('span');
    f.className = 'float';
    f.textContent = '+' + fmt(r.money);
    $('h-float').appendChild(f);
    setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 1400);
    // 팀 속도 줄 자리에 4초 동안 소식을 띄웠다가 되돌린다
    $('h-feed').textContent = (from || '방금') + ' 3팀이 ' + fmt(r.catches) + '명 검거 · +' + fmt(r.money);
    var line = $('h-feed').parentNode;
    line.classList.add('news');
    clearTimeout(feedTimer);
    feedTimer = setTimeout(function () { line.classList.remove('news'); }, 4000);
  }

  // 다음 검거 줄: 잡는 순간에는 애니메이션 없이 0 으로 돌렸다가 다시 차오른다
  function renderNext(t, justCaught) {
    var n = I.nextCatch(save, t), fill = $('h-next-fill');
    if (justCaught) { fill.classList.add('snap'); fill.style.width = '0%'; void fill.offsetWidth; fill.classList.remove('snap'); }
    fill.style.width = (Math.min(1, n.frac) * 100).toFixed(1) + '%';
    fill.parentNode.classList.toggle('fast', I.buffed(save, t));
    // 아주 빠르면(1.5초 미만에 1명) 막대가 깜빡이기만 하니, 꽉 찬 흐르는 막대 + "1초에 N명"으로 바꾼다
    var stream = I.isStreaming(save, t);
    fill.parentNode.classList.toggle('stream', stream);
    if (stream) {
      fill.style.width = '100%';
      $('h-next').textContent = '1초에 ' + perMin(1 / I.catchInterval(save, t)) + '명 · +' + I.payPerCatch(save) + '씩';   // 단추 옆 좁은 칸이라 짧게
      return;
    }
    var sec = Math.ceil(n.sec);
    $('h-next').textContent = !isFinite(sec) ? '쉬는 중' : '다음 검거까지 ' + (sec >= 60 ? Math.floor(sec / 60) + '분 ' + (sec % 60 ? (sec % 60) + '초' : '') : sec + '초') +
      ' · +' + I.payPerCatch(save);
  }

  /* ---------- 그리기 ---------- */
  function render() {
    var t = nowMs(), buff = I.buffed(save, t);
    // 내 자리: 사용자가 넣은 이름이라 textContent 로만 넣는다
    $('h-station').textContent = save.profile.station + ' · 수사 3팀';
    var ld = $('h-leader');
    // 이름을 안 정했으면 "신임 팀장"(이번에 3팀을 맡은 사람). 사건 1 이야기와 이어진다.
    var rk = I.rankOf(save).name;   // 계급(0.1.19): 팀장은 경위부터
    // 0.3.0 칭호는 팀장 이름 앞에(글은 모두 textContent 라 꺾쇠 걱정 없음)
    var ttl = H ? H.leaderTitle(save) : '';
    ld.textContent = rk + ' · ' + (ttl ? '「' + ttl + '」 ' : '') + (save.profile.leader ? '팀장 ' + save.profile.leader : '신임 팀장 · 이름 정하기');
    ld.classList.toggle('empty', !save.profile.leader);
    $('h-money').textContent = '수사비 ' + fmtShort(save.money);
    checkAch();
    $('h-gems').textContent = '◆ ' + fmt(save.gems);
    var rate = I.teamRate(save) * 60 * (buff ? I.TUNE.buffMult : 1);
    // 형사가 늘면 1명당 값이 아니라 잡는 수가 늘어 "1분에 버는 수사비"가 오른다 — 그걸 바로 보여 준다
    $('h-rate').textContent = '팀이 1분에 ' + perMin(rate) + '명 · 수사비 +' + fmt(I.incomePerMin(save, t)) + '/분';
    var b = $('h-buff');
    b.hidden = !buff;
    if (buff) {
      var left = Math.ceil((I.boostUntil(save) - t) / 1000);
      b.textContent = ((save.partyUntil || 0) > t && save.partyUntil >= save.buffUntil ? '회식 ×2 · ' : '사기 충전 ×2 · ') + (left >= 60 ? Math.ceil(left / 60) + '분' : left + '초');
    }

    var goal = CS().goal;
    $('h-case').textContent = '사건 ' + CS().no + ' · ' + CS().title + (save.closed ? ' (종결)' : '');
    $('h-city').textContent = CS().city;
    var nx = I.nextCase(save);
    $('h-next-case').hidden = !nx;
    if (nx) $('h-next-case').textContent = '사건 ' + nx.no + ' · ' + ro(nx.city) + ' 파견';
    $('h-caught').textContent = fmt(Math.min(save.caught, goal)) + ' / ' + goal;
    $('h-bar').style.width = (I.progress(save) * 100).toFixed(1) + '%';
    // 방치 상한 뒤 구간(800 → 1000)은 빗금 = 현장에서만. 다 차면 빨간 알림 줄과 출동 단추 맥박
    var capPct = (1 - CS().idleCap / goal) * 100;
    $('h-cap').style.width = save.closed ? '0' : capPct.toFixed(1) + '%';
    var capped = I.idleCapped(save);
    $('h-cap-note').classList.toggle('on', capped);
    if (capped) $('h-cap-text').textContent = '남은 ' + fmt(goal - save.caught) + '명은 주범 조 · 현장 출동으로만 잡을 수 있어요';
    $('h-go').classList.toggle('urgent', capped);
    renderStoryButton();

    var o = I.runOptions(save), pc = save.prep || {};
    var zb = PT ? petBonus(save) : null;
    var dur = o.duration + (pc.coffee ? 15 : 0) + (zb && zb.time ? Math.round(zb.time) : 0), fh = o.freeHints + (pc.sketch ? 2 : 0);
    $('h-go-sub').textContent = dur + '초' + (fh ? ' · 무료 단서 ' + fh : '') + (pc.press ? ' · 수사비 1.5배' : ' · 잡은 만큼 수사비');
    if (E) { renderPrep(t); renderDaily(t); renderSupport(t); }

    $('h-det').textContent = save.detectives;
    renderNext(t, false);
    setBuy($('h-hire'), I.cost(save, 'hire'), '영입');
    $('h-train').textContent = save.training;
    setBuy($('h-trainb'), I.cost(save, 'train'), '훈련');

    $('h-gear').innerHTML = I.gearFor(save).map(function (k) {   // 0.2.0: 이 사건에서 쓰는 장비만
      var g = I.GEAR[k], lv = save.gear[k], max = g.costs.length, c = I.cost(save, k);
      return '<div class="item"><div class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + GEAR_ICON[k] + '</svg></div>' +
        '<div class="tx"><b>' + g.name + (max > 1 ? ' ' + lv + '/' + max : '') + '</b><small>' + g.desc + '</small></div>' +
        '<button class="buy' + (c == null ? ' max' : '') + '" data-gear="' + k + '"' + (c == null || save.money < c ? ' disabled' : '') +
        ' aria-label="' + g.name + (c == null ? ' 배치 완료' : ' 사기, ' + fmt(c)) + '">' + (c == null ? '배치 완료' : fmt(c)) + '</button></div>';
    }).join('');
  }

  /* ---------- 0.1.19: 준비물 · 특별 출동 · 지원 · 메달 ---------- */
  var PREP_ICON = {
    coffee: '<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 11h2a2 2 0 0 1 0 4h-2M8 3v3M12 3v3"/>',
    tip: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    sketch: '<circle cx="12" cy="9" r="4"/><path d="M5 21c0-4 3-6 7-6s7 2 7 6"/><path d="M17 3l3 3"/>',
    lawyer: '<path d="M12 3v18M5 7h14M7 7l-3 7a3 3 0 0 0 6 0zM17 7l-3 7a3 3 0 0 0 6 0z"/>',
    press: '<rect x="4" y="9" width="7" height="6" rx="1"/><path d="M11 10l8-5v14l-8-5"/>',
    party: '<path d="M8 3h8l-1 7a3 3 0 0 1-6 0zM12 13v7M8 21h8"/>',
    night: '<path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z"/>'
  };
  var SHORT = { coffee: '커피', tip: '제보 전화', sketch: '몽타주', lawyer: '변호사', press: '언론 브리핑' };
  function icon(id) { return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (PREP_ICON[id] || '') + '</svg>'; }
  function dayNow() { return E.dayKey(nowMs(), new Date().getTimezoneOffset()); }

  function renderPrep(t) {
    $('h-prep').innerHTML = E.PREP_IDS.map(function (id) {
      var it = E.ITEMS.filter(function (x) { return x.id === id; })[0], on = E.owned(save, id, t), c = E.price(save, id, 'money');
      return '<button class="chip' + (on ? ' on' : '') + (!on && save.money < c ? ' poor' : '') + '" data-prep="' + id + '" aria-pressed="' + on + '" aria-label="' + it.name + ', ' + it.desc + (on ? ', 챙김(누르면 무르기)' : ', ' + fmt(c)) + '">' +
        icon(id) + '<b>' + SHORT[id] + '</b><small>' + (on ? '챙김 ✓' : fmtShort(c)) + '</small></button>';
    }).join('');
    $('h-medals').innerHTML = E.MEDALS.map(function (m) {
      return '<i class="' + m.key + (save.medals[m.key] ? ' on' : '') + '" title="' + m.name + ' 메달 ' + fmt(m.at) + '점">' + m.name + ' ' + fmtShort(m.at) + '</i>';
    }).join('');
  }
  function renderDaily() {
    var st = E.dailyStatus(save, dayNow()), r = st.rule, box = $('h-daily');
    $('h-daily-name').textContent = r.name;
    $('h-daily-desc').textContent = r.desc;
    $('h-daily-goal').textContent = '동 ' + fmt(r.medals[0]) + ' · 은 ' + fmt(r.medals[1]) + ' · 금 ' + fmt(r.medals[2]) + (st.best ? ' · 오늘 최고 ' + fmt(st.best) : '');
    box.classList.toggle('done', st.done);
    var b = $('h-daily-go');
    b.textContent = st.done ? '다시 ◆' + E.RETRY_GEMS : '도전';
    b.disabled = st.done && save.gems < E.RETRY_GEMS;
  }
  function renderSupport(t) {
    $('h-support').innerHTML = ['party', 'night'].map(function (id) {
      var it = E.ITEMS.filter(function (x) { return x.id === id; })[0], c = E.price(save, id, 'money'), on = E.owned(save, id, t);
      var state = id === 'party' && on ? ' · 진행 중 ' + Math.ceil((save.partyUntil - t) / 60000) + '분' : id === 'night' && on ? ' · 대기 중' : '';
      var lock = id === 'night' && on;
      return '<div class="item"><div class="ic">' + icon(id) + '</div><div class="tx"><b>' + it.name + state + '</b><small>' + it.desc + '</small></div>' +
        '<button class="buy" data-support="' + id + '"' + (lock || save.money < c ? ' disabled' : '') + '>' + (lock ? '준비됨' : fmtShort(c)) + '</button></div>';
    }).join('');
  }

  /*
   * 사기(0.1.19). 수사비가 있으면 바로 수사비로 산다. 모자라면 배지로 살지 묻는다(배지도 모자라면 알림).
   */
  function buyItem(id) {
    var t = nowMs();
    try {
      E.buy(save, id, t, 'money');
      done();
    } catch (e) {
      if (e.code !== 'NOT_ENOUGH') { UI.toast(e.code === 'ALREADY' ? '이미 챙겼어요' : '살 수 없어요: ' + e.message); return; }
      var g = E.price(save, id, 'gems'), it = E.ITEMS.filter(function (x) { return x.id === id; })[0];
      if (g == null || save.gems < g) { UI.toast('수사비가 모자라요'); return; }
      openInfo({ label: '배지로 사기', title: it.name, body: p(it.desc) + p('<span class="muted">수사비가 모자라요. 배지 ◆' + g + '개로 살까요? (가진 배지 ◆' + fmt(save.gems) + ')</span>'),
        ok: '◆' + g + '개로 사기', cancel: '취소',
        onOk: function () { try { E.buy(save, id, nowMs(), 'gems'); done(); } catch (e2) { UI.toast('살 수 없어요: ' + e2.message); } } });
    }
    function done() { UI.sfx.coin(); UI.buzz(10); persist(); render(); }
  }
  function unprep(id) {
    try {
      var r = E.unprep(save, id);
      UI.toast(SHORT[id] + ' 무르기 · ' + (r.currency === 'gems' ? '◆' + r.refunded : fmt(r.refunded)) + ' 돌려받음');
      persist(); render();
    } catch (e) { UI.toast('무를 수 없어요: ' + e.message); }
  }

  function setBuy(btn, c, word) {
    btn.classList.toggle('max', c == null);
    btn.disabled = c == null || save.money < c;
    btn.textContent = c == null ? '최고 단계' : word + ' ' + fmtShort(c);
  }

  /* ---------- 안내 창 ---------- */
  var infoOk = null, infoCancel = null;
  /*
   * 안내 창. o.readOnly 면 읽기만 하는 창(패치노트·수사 일지·승진): 아래 확인 단추 없이 오른쪽 위 X 로 닫는다(0.1.22).
   *   X 는 늘 있고, 묻는 창에서는 "취소"와 같다.
   */
  function openInfo(o) {
    $('info-label').textContent = o.label || '';
    $('info-title').textContent = o.title || '';
    $('info-body').innerHTML = o.body || '';
    $('info-ok').hidden = !!o.readOnly;
    $('info-ok').textContent = o.ok || '확인';
    var c = $('info-cancel');
    c.hidden = !o.cancel;
    c.textContent = o.cancel || '취소';
    infoOk = o.onOk || null; infoCancel = o.onCancel || null;
    $('info-sheet').hidden = false;
    // 늘 맨 위(최신 패치·첫 줄)부터 보이게(0.1.22). 예전에는 맨 아래 확인 단추에 초점을 주면서
    // 브라우저가 창을 맨 아래로 내려 버렸다 → 초점은 주되 스크롤은 움직이지 않게(preventScroll)
    var focusEl = o.readOnly ? $('info-x') : $('info-ok');
    try { focusEl.focus({ preventScroll: true }); } catch (e) { /* 옛 브라우저 */ }
    $('info-sheet').querySelector('.sheet').scrollTop = 0;
  }
  function closeInfo(which) {
    $('info-sheet').hidden = true;
    var f = which === 'ok' ? infoOk : infoCancel;
    infoOk = infoCancel = null;
    if (f) f();
  }

  function p(text) { return '<p>' + text + '</p>'; }
  // 지금 맡은 사건(0.2.0: 사건이 여러 개). 예전 코드의 I.CASE 자리를 모두 이것으로 바꿨다
  function CS() { return I.caseOf(save); }
  // "…로/…으로": 받침이 없거나 ㄹ 받침이면 "로"(해무항 → 해무항으로, 서울 → 서울로)
  function ro(w) {
    var c = String(w).charCodeAt(String(w).length - 1) - 0xAC00;
    if (c < 0 || c > 11171) return w + '(으)로';
    var jong = c % 28;
    return w + (jong === 0 || jong === 8 ? '로' : '으로');
  }

  function showCaseClosed() {
    pendingClose = false;
    I.markStorySeen(save); persist(); renderStoryButton();   // 마지막 편을 이 창에서 보여 주므로 읽음
    var last = CS().story[CS().story.length - 1];
    var gift = PT ? PT.giftOnce(save, 'case' + CS().no, 10) : 0;   // 0.3.0: 사건마다 한 번, 뽑기권 10장
    if (gift) { persist(); if (PUI) PUI.renderPartner(); }
    UI.sfx.none(); UI.buzz([30, 60, 30, 60, 80]);
    openInfo({
      label: '사건 ' + CS().no + ' 종결',
      title: CS().title,
      body: p(last.text) +
        (gift ? p('<b style="color:var(--acc)">사건 종결 보상: 뽑기권 ' + gift + '장</b>') : '') +
        p('<span class="muted">팀이 잡은 용의자 ' + fmt(save.teamCaught) + '명 · 내가 출동해 잡은 용의자 ' + fmt(save.runCaught) + '명 · 출동 ' + save.runs + '번 · 최고 점수 ' + fmt(save.bestScore) + '</span>'),
      ok: I.nextCase(save) ? ro(I.nextCase(save).city) + ' 파견' : '계속 수사하기 (다음 사건은 준비 중)',
      cancel: I.nextCase(save) ? '나중에' : '',
      onOk: function () { if (I.nextCase(save)) goNextCase(); }
    });
  }

  /*
   * 다음 사건으로 파견(0.2.0): 지도 연출 → 사무실 색이 바뀌고 → 새 사건의 첫 일지.
   *   연출(#dispatch-map)은 3초. 연출이 없거나 실패해도 파견은 된다.
   */
  function goNextCase() {
    var nx;
    try { nx = I.moveToNextCase(save, nowMs()); } catch (e) { UI.toast('파견할 수 없어요: ' + e.message); return; }
    persist();
    var after = function () {
      applyTheme(); render();
      I.markStorySeen(save); persist(); renderStoryButton();
      openInfo({ label: '사건 ' + nx.no + ' · ' + nx.city, title: nx.title,
        body: '<p style="white-space:pre-line;margin:0">' + esc(nx.story[0].text) + '</p>' +
          p('<span class="muted">이번 현장 출동은 목격자 진술로 범인을 찾아요. 처음이면 도움말(?)의 "목격자 진술"을 먼저 보세요.</span>'),
        readOnly: true });
    };
    var m = $('dispatch-map');
    if (!m) { after(); return; }
    $('dm-label').textContent = nx.city;
    m.hidden = false; m.classList.remove('go'); void m.offsetWidth; m.classList.add('go');
    try { UI.sfx.levelUp ? UI.sfx.levelUp() : UI.sfx.none(); } catch (e) { /* 소리 실패 무시 */ }
    setTimeout(function () { m.hidden = true; m.classList.remove('go'); after(); }, 3000);
  }
  // 사건마다 사무실 색(0.2.0): body 에 case-N 을 단다. 사건 2(해무항)는 청록 + 창밖 비
  function applyTheme() {
    for (var i = 1; i <= I.CASES.length; i++) document.body.classList.toggle('case-' + i, save.caseNo === i);
  }

  /*
   * 수사 일지: 편마다 위에 "시작 / 검거 150명" 줄, 아래에 글. 안 열린 편은 점선 칸에 "검거 3000명에 열려요".
   *   새 편과 가장 최근 편만 펼쳐 두고 그 전 편은 접는다(첫 줄만 살짝 보인다).
   * 새로 열려 아직 안 읽은 편에는 NEW 를 달고, 열어 보면 읽음으로 적는다(사무실의 "수사 일지 보기" NEW 도 사라진다).
   */
  function showStory() {
    var unlocked = I.storyUnlocked(save).length, seen = save.storySeen;
    var body = CS().story.map(function (e, i) {
      var at = e.at ? '검거 ' + e.at + '명' : '시작';
      if (i >= unlocked) return '<div class="log locked"><span class="log-at"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>' + at + '에 열려요</span></div>';
      var fresh = i >= seen;
      // 새 편과 가장 최근 편은 펼쳐 두고, 그 전 편들은 접어 둔다(제목줄을 누르거나 펼친 글을 누르면 접고 펼친다)
      if (fresh || i === unlocked - 1) {
        return '<div class="log' + (fresh ? ' fresh' : '') + '"><span class="log-at">' + (fresh ? '<span class="new">NEW</span>' : '') + at + '</span><p>' + esc(e.text) + '</p></div>';
      }
      return '<details class="pn log-d"><summary><b>' + at + '</b><span class="log-peek">' + esc(e.text.split('\n')[0]) + '</span></summary><div class="pn-body"><p>' + esc(e.text) + '</p></div></details>';
    }).join('');
    openInfo({ label: '수사 일지', title: '사건 ' + CS().no + ' · ' + CS().title, body: body, readOnly: true });
    I.markStorySeen(save);
    persist();
    renderStoryButton();
  }

  // "수사 일지 보기" 옆 NEW
  function renderStoryButton() {
    $('h-story-all').innerHTML = '수사 일지 보기' + (I.storyUnread(save) ? ' <span class="new" style="height:18px;font-size:10px;margin-left:6px">NEW</span>' : '');
  }

  /* ---------- 프로필 바꾸기 ---------- */
  /*
   * 프로필(경찰서 · 팀장 이름). 0.3.0: 첫 변경은 무료, 그 뒤로는 배지 I.PROFILE.renameGems 개.
   *   값이 모자라거나 바뀐 게 없으면 창을 다시 열어 고친 글을 그대로 둔다.
   */
  function editProfile(keep) {
    var P = I.PROFILE, cost = I.profileCost(save), tags = save.nameTags || 0, NT = I.NAME_TAGS;
    var costLine = cost === 0
      ? '<b style="color:var(--acc)">첫 이름 바꾸기는 무료예요.</b> 그 뒤로는 한 번에 배지 ◆' + P.renameGems + '개 또는 이름표 1장이에요.'
      : tags ? '이름표 1장을 써요. <span class="muted">(가진 이름표 ' + tags + '장)</span>'
      : '이름 바꾸기는 배지 ◆' + cost + '개예요. <span class="muted">(가진 배지 ◆' + fmt(save.gems) + ')</span>';
    var tagBtn = cost === 0 ? '' : '<button class="linkish" id="pf-tags"' + (save.gems < NT.gems ? ' disabled' : '') + '>이름표 ' + NT.n + '장 사기 · ◆' + NT.gems + ' (동물 이름에도 써요)</button>';
    openInfo({
      label: '내 프로필', title: '경찰서와 팀장 이름',
      body: '<label class="field">경찰서 이름 (최대 ' + P.stationMax + '자)<input id="pf-station" maxlength="' + (P.stationMax * 2) + '" autocomplete="off" placeholder="' + P.defaultStation + '"></label>' +
            '<label class="field">팀장 이름 (최대 ' + P.leaderMax + '자, 비워도 돼요)<input id="pf-leader" maxlength="' + (P.leaderMax * 2) + '" autocomplete="off" placeholder="예: 김형사"></label>' +
            p(costLine) + tagBtn +
            p('<span class="muted">게임 이름인 수사 3팀은 그대로예요.</span>'),
      ok: cost === 0 ? '무료로 저장' : tags ? '이름표로 저장' : '◆' + cost + '로 저장', cancel: '취소',
      onOk: function () {
        var st = $('pf-station').value, ld = $('pf-leader').value, r;
        try { r = I.changeProfile(save, st, ld); }
        catch (e) {
          if (e.code === 'SAME') { UI.toast('바뀐 이름이 없어요'); return; }
          UI.toast(e.code === 'NOT_ENOUGH' ? '배지가 모자라요' : '바꿀 수 없어요');
          editProfile({ station: st, leader: ld });
          return;
        }
        persist(); render();
        if (r.paid || r.tag) UI.sfx.coin();
        UI.toast(r.profile.station + ' 수사 3팀' + (r.profile.leader ? ', 팀장 ' + r.profile.leader : '') + (r.paid ? ' · ◆' + r.paid : r.tag ? ' · 이름표 1장' : ''));
      }
    });
    // 값은 속성이 아니라 .value 로 넣는다(따옴표 등이 HTML 을 깨지 않게)
    $('pf-station').value = keep ? keep.station : save.profile.station;
    $('pf-leader').value = keep ? keep.leader : save.profile.leader;
    $('pf-station').focus();
  }

  /* ---------- 사기 ---------- */
  function tryBuy(kind) {
    try {
      I.buy(save, kind);
      UI.sfx.coin(); UI.buzz(10);
      persist(); render();
    } catch (e) {
      UI.toast(e.code === 'NOT_ENOUGH' ? '수사비가 모자라요' : e.code === 'MAXED' ? '이미 배치를 마쳤어요' : e.code === 'OTHER_CASE' ? '이 사건에서는 쓸 수 없는 장비예요' : '살 수 없어요: ' + e.message);
    }
  }

  /* ---------- 출동 ---------- */
  /*
   * 현장 출동: 화면을 한 번 가렸다가 여는 컷 전환(transit.js) 사이에 출동 화면으로 바꾼다.
   *   평소: A 셔터 / B 폴리스 라인 / C 사건 파일 중 무작위.
   *   주범 조 출동(방치 한계 뒤): 경광등 소리 + 진동, E 긴급 무전 / F 수배서 / G 작전 개시 중 무작위.
   *   전환이 끝날 때까지(dispatching) 다시 눌러도 무시한다. 전환이 없거나 실패해도 출동은 반드시 된다.
   */
  var dispatching = false;
  var runCfg = null;   // 지금 출동의 설정(결과를 정리할 때 언론 브리핑 배수·특별 출동인지 본다)
  function startRunNow() {
    I.advance(save, nowMs());
    duringRun = { catches: 0, money: 0 };
    var opts = I.runOptions(save);
    if (E) {
      opts = E.consumePrep(save, opts);   // 챙긴 준비물을 이번 판에 쓰고 비운다
      opts.used = opts.used.map(function (id) { return SHORT[id] || id; });
      persist();
    }
    applyZap(opts);
    opts.boss = I.idleCapped(save);   // 주범 조 출동이면 배경 음악을 boss 곡으로(ui.js show)
    runCfg = opts;
    UI.startRun(opts);
  }
  /*
   * 0.3.0 파트너의 ⚡ 퍼즐 도움(영웅·전설 일부). 평소 출동에만 — 특별 출동(goDaily)은 이 함수를 거치지 않는다.
   *   shield: 오인 체포 벌점 면제 +번 / miss: 오인 벌점 −초(기본 5초) / combo: 연속 배수 상한 + / time: 출동 시간 +초
   */
  var BASE_MISS = 5, BASE_COMBO = 3;
  function applyZap(opts) {
    var b = PT && petBonus(save);
    if (!b) return opts;
    opts.mods = opts.mods || {};
    if (b.shield) opts.mods.shield = Math.min(10, (opts.mods.shield || 0) + Math.round(b.shield));
    if (b.miss) opts.mods.missPenalty = Math.max(0, BASE_MISS - b.miss);
    if (b.combo) opts.mods.comboMax = BASE_COMBO + Math.round(b.combo);
    if (b.time) opts.duration = (opts.duration || 90) + Math.round(b.time);
    return opts;
  }
  // 하루 한 번 특별 출동: 준비물·장비 없이 그날 규칙으로. 오늘 보상을 받았으면 배지로 한 번 더
  function goDaily() {
    if (dispatching || !E) return;
    var day = dayNow(), st = E.dailyStatus(save, day);
    var begin = function (useGems) {
      var cfg;
      try { cfg = E.startDaily(save, day, useGems); } catch (e) { UI.toast(e.code === 'NOT_ENOUGH' ? '배지가 모자라요' : '시작할 수 없어요: ' + e.message); return; }
      cfg.ruleName = st.rule.name; cfg.day = day; cfg.boss = false;
      persist();
      dispatching = true;
      var run = function () { I.advance(save, nowMs()); duringRun = { catches: 0, money: 0 }; runCfg = cfg; UI.startRun(cfg); };
      var T = window.Team3Transit;
      if (!T) { dispatching = false; run(); return; }
      T.play('normal', run, { caseNo: CS().no, caseTitle: '특별 출동 · ' + st.rule.name })
        .then(function () { dispatching = false; }, function () { dispatching = false; });
    };
    if (!st.done) { begin(false); return; }
    openInfo({ label: '특별 출동', title: '한 번 더 도전할까요?', body: p('오늘 보상은 이미 받았어요. 배지 ◆' + E.RETRY_GEMS + '개로 한 번 더 도전하면, 메달을 따면 보상을 다시 받아요.') + p('<span class="muted">가진 배지 ◆' + fmt(save.gems) + '</span>'),
      ok: '◆' + E.RETRY_GEMS + '개로 도전', cancel: '취소', onOk: function () { begin(true); } });
  }
  function go() {
    if (dispatching) return;
    var T = window.Team3Transit;
    if (!T) { startRunNow(); return; }
    var big = I.idleCapped(save);
    if (big) {
      try { UI.sfx.go(); } catch (e) { /* 소리 실패는 무시 */ }
      UI.buzz([18, 40, 18]);   // 설정에서 진동을 끄면 떨지 않는다
    }
    dispatching = true;
    T.play(big ? 'big' : 'normal', startRunNow, { caseNo: CS().no, caseTitle: CS().title })
      .then(function () { dispatching = false; }, function () { dispatching = false; });
  }

  // 출동이 끝나면 ui.js 가 부른다. 결과 화면에 들어갈 요약 HTML 을 돌려준다.
  /*
   * 출동 결과 정리(0.1.19):
   *   수사비 = 점수 × 계급 배수 × 언론 브리핑. 메달은 평소 출동만(처음 달성 보상). 특별 출동은 그날 메달 보상.
   *   보상의 기준값은 이 판을 넣기 전 값으로 잰다(이번 판 점수로 보상이 부풀지 않게).
   */
  function onRunEnd(g) {
    addRun(I.advance(save, nowMs()));
    var cfg = runCfg || {}, base = E ? E.baseValue(save) : 0, best0 = save.bestScore, extra = '';
    runCfg = null;
    var r = I.applyRun(save, { score: g.score, hits: g.hits, payMult: cfg.payMult || 1 }, nowMs());
    if (E && cfg.daily) {
      var d = E.applyDaily(save, cfg.day || dayNow(), g.score, base);
      if (H) H.noteDaily(save, d.medal);   // 0.3.0 업적용 기록
      extra += d.medal
        ? '<span class="res-medal">특별 출동 ' + d.medal + ' 메달 · 수사비 +' + fmt(d.money) + ' · ◆' + d.gems + (PT ? ' · ' + giveTickets(1) : '') + '</span>'
        : '<span class="muted">특별 출동: 동 메달(' + fmt(E.dailyRule(cfg.day || dayNow()).medals[0]) + '점)부터 보상이에요. 오늘 다시 도전할 수 있어요.</span>';
    } else if (E) {
      E.claimMedals(save, g.score, base).forEach(function (m) {
        extra += '<span class="res-medal">첫 ' + m.name + ' 메달! 수사비 +' + fmt(m.money) + ' · ◆' + m.gems + (PT ? ' · ' + giveTickets(2) : '') + '</span>';
      });
      if (g.score > best0 && best0 > 0) extra += '<span style="color:var(--acc);font-weight:700">최고 점수 경신! (전 기록 ' + fmt(best0) + ')</span>';
    }
    persist();
    if (r.closedNow) pendingClose = true;
    var rk = I.rankOf(save);
    return '<span>수사비 <b style="color:var(--acc)">+' + fmt(r.money) + '</b>' + (cfg.payMult > 1 ? ' (언론 브리핑 ×1.5)' : '') + ' · 사건 진척 <b style="color:var(--acc)">+' + r.caught + '명</b> (' + fmt(Math.min(save.caught, CS().goal)) + ' / ' + CS().goal + ')</span>' +
      extra +
      '<span class="muted">팀 사기 충전: ' + (I.TUNE.buffSec / 60) + '분 동안 팀이 2배로 일해요</span>' +
      (rk.next ? '<span class="muted">' + rk.next.name + ' 승진까지 출동 검거 ' + fmt(rk.toNext) + '명</span>' : '') +
      (r.closedNow ? '<span style="color:var(--acc);font-weight:700">사건 종결! 사무실에서 확인하세요</span>' : '');
  }

  // 승진(0.1.19): 사무실로 돌아올 때 아직 못 보여 준 승진을 한 창에 모아 보여 주고 배지를 준다
  function showPromotions() {
    var got = I.claimPromotions(save);
    if (!got.length) return false;
    persist(); render();
    var last = got[got.length - 1], gems = got.reduce(function (a, x) { return a + x.gems; }, 0);
    var tk = PT ? giveTickets(3 * got.length) : '';   // 0.3.0: 승진 한 계단마다 뽑기권 3장
    UI.sfx.none(); UI.buzz([30, 60, 30]);
    openInfo({ label: '승진', title: ro(last.name) + ' 승진했어요',
      body: p('현장에서 직접 잡은 용의자가 ' + fmt(save.runCaught) + '명이 되었어요.') +
        p('수사비가 <b>+' + Math.round(I.rankOf(save).bonus * 100) + '%</b> 늘어요(팀·출동 모두). 승진 축하 배지 ◆' + gems + '개를 받았어요.' + (tk ? ' ' + tk + '장도 함께!' : '')) +
        (I.rankOf(save).next ? p('<span class="muted">다음 계급 ' + I.rankOf(save).next.name + '까지 ' + fmt(I.rankOf(save).toNext) + '명</span>') : ''),
      readOnly: true });
    return true;
  }

  function home() {
    addRun(I.advance(save, nowMs()));
    render();
    UI.show('s-hub');
    if (duringRun && duringRun.catches) showGain(duringRun, '출동하는 동안');
    duringRun = null;
    applyIfSafe();
    if (pendingClose) showCaseClosed();
    else if ($('info-sheet').hidden) showPromotions();
  }

  /* ---------- 1초마다 ---------- */
  function addRun(r) {
    if (duringRun && r && r.catches) { duringRun.catches += r.catches; duringRun.money += r.money; }
  }

  function tick() {
    var t = nowMs(), r = I.advance(save, t);
    addRun(r);
    if ($('s-hub').classList.contains('on')) {
      render();
      if (r.catches) { renderNext(t, true); showGain(r); }
    }
    if (r.closedNow) {
      if ($('s-hub').classList.contains('on') && $('info-sheet').hidden) showCaseClosed();
      else pendingClose = true;
    }
    if (++saveTick % 5 === 0) persist();
  }

  /* ---------- 연결 ---------- */
  UI.hooks.home = home;
  UI.hooks.go = go;
  UI.hooks.onRunEnd = onRunEnd;
  UI.hooks.onTutorialDone = function () { save.tutorialDone = true; persist(); };
  /*
   * 설정 창의 저장 백업·초기화(0.1.18). 코드 형식 검사는 settings.js, 값 검사·범위 맞추기는 SuspectsIdle.load 가 한다.
   *   불러오기·초기화 뒤에는 ui.js 가 페이지를 다시 연다(모든 화면을 새 저장으로 처음부터 그리게).
   */
  UI.hooks.saveVersion = I.VERSION;
  UI.hooks.exportSave = function () {
    I.advance(save, nowMs());   // 지금까지 팀이 한 일까지 넣어서
    persist();
    return window.Team3Settings.exportCode(I.serialize(save));
  };
  UI.hooks.importSave = function (json) {
    var r = I.load(json, nowMs());
    if (r.reset) return { ok: false, message: '저장 내용이 올바르지 않아요' };
    save = r.save;
    petsReady();
    save.lastSeen = nowMs();   // 코드를 만든 뒤 지난 시간은 '자리 비움'으로 치지 않는다(기기를 옮기는 사이 보상 받기 방지)
    persist();
    return { ok: true };
  };
  UI.hooks.resetSave = function () {
    save = I.newSave(nowMs()); save.tutorialDone = true; petsReady(); persist();
  };

  $('h-go').addEventListener('click', go);
  $('h-profile').addEventListener('click', function () { editProfile(); });
  // 프로필 창 안의 "이름표 사기"(0.3.0): 사고 나면 적던 글을 그대로 둔 채 창을 다시 그린다
  $('info-body').addEventListener('click', function (e) {
    if (!e.target.closest('#pf-tags')) return;
    var keep = { station: $('pf-station').value, leader: $('pf-leader').value };
    try { I.buyNameTags(save); persist(); render(); UI.sfx.coin(); UI.toast('이름표 ' + I.NAME_TAGS.n + '장을 샀어요'); } catch (err) { UI.toast('배지가 모자라요'); }
    editProfile(keep);
  });
  $('h-hire').addEventListener('click', function () { tryBuy('hire'); });
  $('h-trainb').addEventListener('click', function () { tryBuy('train'); });
  $('h-gear').addEventListener('click', function (e) {
    var b = e.target.closest('[data-gear]');
    if (b && !b.disabled) tryBuy(b.getAttribute('data-gear'));
  });
  $('h-story-all').addEventListener('click', showStory);
  $('h-next-case').addEventListener('click', function () { if (I.nextCase(save)) goNextCase(); });
  if (E) {
    $('h-prep').addEventListener('click', function (e) {
      var b = e.target.closest('[data-prep]'); if (!b) return;
      var id = b.getAttribute('data-prep');
      if (E.owned(save, id, nowMs())) unprep(id); else buyItem(id);
    });
    $('h-support').addEventListener('click', function (e) {
      var b = e.target.closest('[data-support]'); if (b && !b.disabled) buyItem(b.getAttribute('data-support'));
    });
    $('h-daily-go').addEventListener('click', goDaily);
  } else {
    ['h-daily'].forEach(function (id) { $(id).hidden = true; });
  }
  $('info-ok').addEventListener('click', function () { closeInfo('ok'); });
  $('info-body').addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); closeInfo('ok'); } });
  $('info-cancel').addEventListener('click', function () { closeInfo('cancel'); });
  $('info-x').addEventListener('click', function () { closeInfo('cancel'); });
  $('info-sheet').addEventListener('click', function (e) { if (e.target === this) closeInfo('cancel'); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!$('info-sheet').hidden) closeInfo('cancel');
    else if (PUI && PUI.isOpen()) PUI.close();
    else if (AUI && AUI.isOpen()) AUI.close();
  });
  // 탭을 떠날 때·돌아올 때 저장과 반영
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { I.advance(save, nowMs()); persist(); }
    else {
      // 돌아옴: 내려 둔 사이는 자리 비움(절반 속도, 4시간까지)으로 센다
      var r = I.advance(save, nowMs(), { offline: true });
      persist();
      if ($('s-hub').classList.contains('on')) { if (r.catches) showGain(r, '자리 비운 동안'); tick(); }
    }
  });
  window.addEventListener('pagehide', persist);

  /* ---------- 새 버전(설치된 판): 강제 업데이트(0.1.1) ----------
   * GitHub Pages 에서 열렸을 때만 한다(Claude 페이지 안에서는 서버가 없고, 페이지는 다시 게시하면 바로 바뀐다).
   *   켤 때, 30분마다, 화면으로 돌아올 때 version.json 을 확인한다.
   *   새 버전이면 사무실을 덮는 업데이트 창을 띄운다. 단추는 "업데이트" 하나뿐(나중에·닫기 없음).
   *   누르면 저장 → 새 파일로 다시 열기. 출동·튜토리얼·결과 중이면 사무실로 돌아올 때 띄운다(판을 날리지 않게).
   *   다시 열린 뒤 버전이 바뀌었으면 한 번 알려 준다.
   */
  var N = window.SuspectsNotes || [], U = window.Updater;
  var VERSION = N.length ? N[0].ver : '0.0.0';
  var SEEN_KEY = 'guar.suspects3.seenVersion';
  var installed = /^https:$/.test(location.protocol) && /\.github\.io$/i.test(location.hostname);
  var lastCheck = 0, pendingUpdate = null, updating = false;

  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* 저장 불가 */ } }

  function checkUpdate(force) {
    if (!installed || !U || updating) return;
    var t = nowMs();
    if (!force && t - lastCheck < 60 * 1000) return;   // 화면을 자주 오가도 1분에 한 번만
    lastCheck = t;
    U.checkRemote(window.fetch.bind(window), './version.json', VERSION).then(function (r) {
      if (!r.available) return;
      pendingUpdate = r.info;
      applyIfSafe();
    });
  }

  // 사무실이 보일 때만 업데이트 창을 띄운다(출동·튜토리얼·결과 중이면 사무실로 돌아올 때).
  // 창에는 "업데이트" 단추 하나뿐이고 닫을 수 없다. 누르면 저장하고 새 파일로 다시 연다.
  function applyIfSafe() {
    // 출동 전환(화면을 덮는 중)에는 띄우지 않는다 — 출동 화면에서 돌아올 때 띄운다
    if (!pendingUpdate || updating || dispatching || !$('s-hub').classList.contains('on')) return;
    updating = true;
    I.advance(save, nowMs());
    persist();
    $('up-title').textContent = '새 버전 ' + pendingUpdate.version + '이 나왔어요';
    var notes = $('up-notes');
    notes.textContent = '';
    (pendingUpdate.items.length ? pendingUpdate.items : [pendingUpdate.title]).slice(0, 4).forEach(function (t) {
      // 서버에서 온 글이라 textContent 로만 넣는다. 패치노트와 같은 내어쓰기 줄
      var line = document.createElement('p'), dot = document.createElement('i'), txt = document.createElement('span');
      line.className = 'li'; dot.textContent = '·'; txt.textContent = t;
      line.appendChild(dot); line.appendChild(txt);
      notes.appendChild(line);
    });
    $('updating').hidden = false;
    $('up-go').focus();
  }

  function doUpdate() {
    I.advance(save, nowMs());
    persist();
    $('up-go').disabled = true;
    $('up-go').textContent = '받는 중…';
    var done = function () { location.reload(); };
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
        navigator.serviceWorker.getRegistration().then(function (reg) { return reg && reg.update(); }).then(done, done);
        return;
      }
    } catch (e) { /* 서비스 워커가 없어도 다시 열면 새 파일을 받는다(네트워크 먼저) */ }
    done();
  }

  function registerSW() {
    if (!installed) return;
    try {
      if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(function () { /* 오프라인 열기만 못 할 뿐 */ });
    } catch (e) { /* 무시 */ }
  }

  /*
   * 패치노트 창: 지금 버전은 NEW 표시와 빛나는 테두리로 펼쳐 두고, 지난 버전은 접어 둔다(누르면 펼침).
   * 사무실 맨 아래 "패치노트"에는 이 버전을 아직 안 열어 봤으면 NEW 를 붙인다.
   * 패치노트 글은 우리가 쓴 notes.js 라 HTML 로 넣지만, 꺾쇠는 미리 바꿔 둔다.
   */
  var NOTES_SEEN_KEY = 'guar.suspects3.notesSeen';
  // 항목 줄: 점(·)과 글을 나눠 두면, 글이 두 줄로 넘어가도 둘째 줄이 첫 글자 아래에 맞춰 선다
  function lines(items) { return items.map(function (t) { return '<p class="li"><i>·</i><span>' + esc(t) + '</span></p>'; }).join(''); }

  function showVersionInfo() {
    if (!N.length) { openInfo({ label: '패치노트', title: '수사 3팀', body: p('기록이 없어요'), readOnly: true }); return; }
    var cur = N[0];
    var body = '<div class="pn pn-new"><div class="pn-head"><span class="new">NEW</span><b>' + esc(cur.ver) + '</b> ' + esc(cur.title) + '</div>' + lines(cur.items) + '</div>';
    if (N.length > 1) {
      body += '<span class="pn-past">지난 패치노트</span>' + N.slice(1).map(function (n) {
        return '<details class="pn"><summary><b>' + esc(n.ver) + '</b> ' + esc(n.title) + '</summary><div class="pn-body">' + lines(n.items) + '</div></details>';
      }).join('');
    }
    // 음악 출처는 0.1.20 부터 설정 → 만든 사람들 로 옮겼다
    openInfo({ label: '패치노트', title: '수사 3팀 ' + VERSION, body: body, readOnly: true });
    lsSet(NOTES_SEEN_KEY, VERSION);
    renderVersionButton();
  }

  // 맨 아래 단추: "수사 3팀 0.1.2 · 패치노트" + 안 읽었으면 NEW
  function renderVersionButton() {
    var unseen = lsGet(NOTES_SEEN_KEY) !== VERSION;
    $('h-version').innerHTML = '수사 3팀 ' + esc(VERSION) + ' · 패치노트' + (unseen ? ' <span class="new" style="height:18px;font-size:10px;margin-left:4px">NEW</span>' : '');
  }

  $('h-version').addEventListener('click', showVersionInfo);
  // 펼친 지난 패치노트는 제목줄뿐 아니라 내용 어디를 눌러도 접힌다
  $('info-body').addEventListener('click', function (e) {
    var body = e.target.closest && e.target.closest('details.pn .pn-body');
    if (body && body.parentNode.open) body.parentNode.open = false;
  });
  $('up-go').addEventListener('click', doUpdate);
  window.Team3CheckUpdate = function () { checkUpdate(true); };   // 화면 시험용
  // 안드로이드 앱이 꺼지기 직전에 부른다(뒤로 단추 두 번): 팀이 일한 몫까지 반영해 저장
  window.Team3Save = function () { I.advance(save, nowMs()); persist(); return 'ok'; };

  // 안드로이드 앱의 뒤로 단추: 바꾸는 중이면 그대로, 안내 창이 떠 있으면 닫고, 아니면 화면 쪽(ui.js)에 맡긴다
  window.Team3Back = function () {
    if (updating) return 'stay';
    if (dispatching) return 'stay';   // 출동 전환 중: 사무실에서 뒤로(=앱 종료)로 오해하지 않게 그냥 둔다
    if (!$('info-sheet').hidden) { closeInfo('cancel'); return 'stay'; }
    if (PUI && PUI.isOpen()) { PUI.close(); return 'stay'; }
    if (AUI && AUI.isOpen()) { AUI.close(); return 'stay'; }
    return UI.back();
  };

  /* ---------- 시작 ---------- */
  var loaded = loadSave();
  save = loaded.save;
  petsReady();   // 동물 저장 검사는 자리 비움 계산(한도 효과) 전에
  var away = I.advance(save, nowMs(), { offline: true });   // 앱을 끈 사이 = 자리 비움(절반 속도, 4시간까지)
  persist();
  // 창 모듈을 먼저 붙인다(첫 render 의 업적 확인이 알림을 띄울 수 있게)
  if (PUI) PUI.mount({ getSave: function () { return save; }, persist: persist, render: render, UI: UI });
  if (AUI) AUI.mount({ getSave: function () { return save; }, persist: persist, render: render, UI: UI });
  render();
  applyTheme();
  UI.show('s-hub');
  if (loaded.reset) UI.toast('저장을 읽지 못해 처음부터 시작해요');

  if (away.seconds >= 60 && away.catches > 0) {
    // 잠복 보고: 자리를 비운 동안 팀이 한 일
    openInfo({
      label: '잠복 보고', title: fmtDur(away.seconds) + ' 동안',
      body: p('3팀이 용의자 <b style="color:var(--acc)">' + fmt(away.catches) + '명</b>을 잡았어요.') +
        p('수사비 <b style="color:var(--acc)">+' + fmt(away.money) + '</b>') +
        (away.night ? p('<span style="color:var(--acc);font-weight:700">야간 잠복조 투입: 이번엔 ' + (I.TUNE.nightCapSec / 3600) + '시간까지 셌어요</span>') : '') +
        p('<span class="muted">자리를 비운 동안 팀은 절반 속도로 일하고, ' + fmtDur(away.cap || I.TUNE.offlineCapSec) + '까지만 세요' + (away.cap > I.TUNE.offlineCapSec && !away.night ? '(동물 효과로 늘어남)' : '') + '.' +
          (!away.night && away.seconds >= (away.cap || I.TUNE.offlineCapSec) ? ' 이번엔 꽉 찼어요. 지원의 야간 잠복조를 사 두면 다음엔 ' + (I.TUNE.nightCapSec / 3600) + '시간까지 세요.' : '') + '</span>') +
        (away.counted < away.catches ? p('<span class="muted">남은 주범 조는 현장 출동으로만 잡을 수 있어요.</span>') : ''),
      ok: '좋아요',
      onOk: function () { if (pendingClose || away.closedNow) showCaseClosed(); else showPromotions(); }
    });
  } else if (!save.tutorialDone && save.runs === 0) {
    // 처음 켬: 사건 소개 + 튜토리얼 권유(시작 편을 보여 주므로 읽음으로 친다)
    I.markStorySeen(save); persist(); renderStoryButton();
    openInfo({
      label: '사건 ' + CS().no, title: CS().title,
      // 일지 줄바꿈 그대로
      body: '<p style="white-space:pre-line;margin:0">' + esc(CS().story[0].text) + '</p>' +
        p('<span class="muted">이런 퍼즐이 처음이면 1분짜리 튜토리얼부터 해 보세요.</span>'),
      ok: '튜토리얼 하기', cancel: '바로 사무실로',
      onOk: UI.openTutorial,
      onCancel: function () { save.tutorialDone = true; persist(); }
    });
  } else if (away.closedNow) {
    showCaseClosed();
  } else {
    showPromotions();   // 업데이트로 계급이 생긴 예전 저장: 그동안 잡은 만큼의 승진을 한 번에(0.1.19)
  }

  // 버전 표시 · 업데이트 뒤 첫 실행 알림 · 새 버전 확인
  renderVersionButton();
  var seen = lsGet(SEEN_KEY);
  if (seen && seen !== VERSION && installed) setTimeout(function () { UI.toast(VERSION + '으로 업데이트됐어요 · 맨 아래 패치노트에서 확인'); }, 3200);
  lsSet(SEEN_KEY, VERSION);
  registerSW();
  setTimeout(function () { checkUpdate(true); }, 3000);
  setInterval(function () { checkUpdate(true); }, 30 * 60 * 1000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) checkUpdate(false); });

  setInterval(tick, 1000);
})();
