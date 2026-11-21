/*
 * 사무실 — 수사 3팀의 첫 화면(방치형, 사건 1). SuspectsIdle 의 저장을 들고 1초마다 팀의 일을 반영한다.
 *
 * 흐름: 켜면 저장을 읽고(깨졌으면 새로) → 자리를 비운 동안의 일(잠복 보고)을 보여 주고 → 사무실.
 *      출동은 SuspectsUI.startRun(장비 반영 설정), 끝나면 hooks.onRunEnd 로 결과를 받아 수사비·진척을 올린다.
 * 저장은 이 브라우저(localStorage)에만 남는다. 저장이 막힌 환경에서도 그 자리에서는 끝까지 할 수 있다.
 */
(function () {
  'use strict';
  var UI = window.SuspectsUI, I = window.SuspectsIdle;
  if (!UI || !I) return;
  var $ = function (id) { return document.getElementById(id); };
  var nowMs = function () { return Date.now(); };
  var KEY = 'guar.suspects3.idle.v1';

  var save = null, pendingClose = false, saveTick = 0;
  var duringRun = null;   // 출동하는 동안 팀이 번 것 { catches, money } — 사무실로 돌아올 때 보여 준다

  /* ---------- 저장 ---------- */
  function persist() {
    try { window.localStorage.setItem(KEY, I.serialize(save)); } catch (e) { /* 저장 불가: 이번 접속에서만 진행 */ }
  }
  function loadSave() {
    var raw = null;
    try { raw = window.localStorage.getItem(KEY); } catch (e) { raw = null; }
    return I.load(raw, nowMs());
  }

  /* ---------- 표시 도우미 ---------- */
  function fmt(n) { return Math.floor(n).toLocaleString('ko-KR'); }
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
    vault: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M10 14h4"/>'
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
    ld.textContent = save.profile.leader ? '팀장 ' + save.profile.leader : '신임 팀장 · 이름 정하기';
    ld.classList.toggle('empty', !save.profile.leader);
    $('h-money').textContent = '수사비 ' + fmt(save.money);
    var rate = I.teamRate(save) * 60 * (buff ? I.TUNE.buffMult : 1);
    $('h-rate').textContent = '팀이 1분에 ' + perMin(rate) + '명 · 1명당 ' + I.payPerCatch(save);
    var b = $('h-buff');
    b.hidden = !buff;
    if (buff) b.textContent = '사기 충전 ×2 · ' + Math.ceil((save.buffUntil - t) / 1000) + '초';

    var goal = I.CASE.goal;
    $('h-case').textContent = '사건 ' + I.CASE.no + ' · ' + I.CASE.title + (save.closed ? ' (종결)' : '');
    $('h-caught').textContent = fmt(Math.min(save.caught, goal)) + ' / ' + goal;
    $('h-bar').style.width = (I.progress(save) * 100).toFixed(1) + '%';
    var st = I.storyUnlocked(save);
    $('h-story').textContent = st[st.length - 1].text;

    var o = I.runOptions(save);
    $('h-go-sub').textContent = o.duration + '초' + (o.freeHints ? ' · 공짜 단서 ' + o.freeHints : '') + ' · 잡은 만큼 수사비';

    $('h-det').textContent = save.detectives;
    renderNext(t, false);
    setBuy($('h-hire'), I.cost(save, 'hire'), '영입');
    $('h-train').textContent = save.training;
    setBuy($('h-trainb'), I.cost(save, 'train'), '훈련');

    $('h-gear').innerHTML = I.GEAR_KEYS.map(function (k) {
      var g = I.GEAR[k], lv = save.gear[k], max = g.costs.length, c = I.cost(save, k);
      return '<div class="item"><div class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + GEAR_ICON[k] + '</svg></div>' +
        '<div class="tx"><b>' + g.name + (max > 1 ? ' ' + lv + '/' + max : '') + '</b><small>' + g.desc + '</small></div>' +
        '<button class="buy' + (c == null ? ' max' : '') + '" data-gear="' + k + '"' + (c == null || save.money < c ? ' disabled' : '') +
        ' aria-label="' + g.name + (c == null ? ' 다 갖춤' : ' 사기, ' + fmt(c)) + '">' + (c == null ? '갖춤' : fmt(c)) + '</button></div>';
    }).join('');
  }

  function setBuy(btn, c, word) {
    btn.classList.toggle('max', c == null);
    btn.disabled = c == null || save.money < c;
    btn.textContent = c == null ? '최고' : word + ' ' + fmt(c);
  }

  /* ---------- 안내 창 ---------- */
  var infoOk = null, infoCancel = null;
  function openInfo(o) {
    $('info-label').textContent = o.label || '';
    $('info-title').textContent = o.title || '';
    $('info-body').innerHTML = o.body || '';
    $('info-ok').textContent = o.ok || '확인';
    var c = $('info-cancel');
    c.hidden = !o.cancel;
    c.textContent = o.cancel || '취소';
    infoOk = o.onOk || null; infoCancel = o.onCancel || null;
    $('info-sheet').hidden = false;
    $('info-ok').focus();
  }
  function closeInfo(which) {
    $('info-sheet').hidden = true;
    var f = which === 'ok' ? infoOk : infoCancel;
    infoOk = infoCancel = null;
    if (f) f();
  }

  function p(text) { return '<p>' + text + '</p>'; }

  function showCaseClosed() {
    pendingClose = false;
    var last = I.CASE.story[I.CASE.story.length - 1];
    UI.sfx.none(); UI.buzz([30, 60, 30, 60, 80]);
    openInfo({
      label: '사건 ' + I.CASE.no + ' 종결',
      title: I.CASE.title,
      body: p(last.text) +
        p('<span class="muted">팀이 잡은 용의자 ' + fmt(save.teamCaught) + '명 · 내가 출동해 잡은 용의자 ' + fmt(save.runCaught) + '명 · 출동 ' + save.runs + '번 · 최고 점수 ' + fmt(save.bestScore) + '</span>'),
      ok: '계속 수사하기 (사건 2는 준비 중)'
    });
  }

  function showStory() {
    var body = I.CASE.story.map(function (e) {
      return save.caught >= e.at
        ? p((e.at ? '<b style="color:var(--acc)">검거 ' + e.at + '명</b> · ' : '<b style="color:var(--acc)">시작</b> · ') + e.text)
        : p('<span class="muted">검거 ' + e.at + '명에 열려요</span>');
    }).join('');
    openInfo({ label: '사건 일지', title: '사건 ' + I.CASE.no + ' · ' + I.CASE.title, body: body });
  }

  /* ---------- 프로필 바꾸기 ---------- */
  function editProfile() {
    var P = I.PROFILE;
    openInfo({
      label: '내 프로필', title: '경찰서와 팀장 이름',
      body: '<label class="field">경찰서 이름 (최대 ' + P.stationMax + '자)<input id="pf-station" maxlength="' + (P.stationMax * 2) + '" autocomplete="off" placeholder="' + P.defaultStation + '"></label>' +
            '<label class="field">팀장 이름 (최대 ' + P.leaderMax + '자, 비워도 돼요)<input id="pf-leader" maxlength="' + (P.leaderMax * 2) + '" autocomplete="off" placeholder="예: 김형사"></label>' +
            p('<span class="muted">게임 이름인 수사 3팀은 그대로예요.</span>'),
      ok: '저장', cancel: '취소',
      onOk: function () {
        var pf = I.setProfile(save, $('pf-station').value, $('pf-leader').value);
        persist(); render();
        UI.toast(pf.station + ' 수사 3팀' + (pf.leader ? ', 팀장 ' + pf.leader : ''));
      }
    });
    // 값은 속성이 아니라 .value 로 넣는다(따옴표 등이 HTML 을 깨지 않게)
    $('pf-station').value = save.profile.station;
    $('pf-leader').value = save.profile.leader;
    $('pf-station').focus();
  }

  /* ---------- 사기 ---------- */
  function tryBuy(kind) {
    try {
      I.buy(save, kind);
      UI.sfx.coin(); UI.buzz(10);
      persist(); render();
    } catch (e) {
      UI.toast(e.code === 'NOT_ENOUGH' ? '수사비가 모자라요' : e.code === 'MAXED' ? '이미 다 갖췄어요' : '살 수 없어요: ' + e.message);
    }
  }

  /* ---------- 출동 ---------- */
  function go() {
    I.advance(save, nowMs());
    duringRun = { catches: 0, money: 0 };
    UI.startRun(I.runOptions(save));
  }

  // 출동이 끝나면 ui.js 가 부른다. 결과 화면에 들어갈 요약 HTML 을 돌려준다.
  function onRunEnd(g) {
    addRun(I.advance(save, nowMs()));
    var r = I.applyRun(save, { score: g.score, hits: g.hits }, nowMs());
    persist();
    if (r.closedNow) pendingClose = true;
    return '<span>수사비 <b style="color:var(--acc)">+' + fmt(r.money) + '</b> · 사건 진척 <b style="color:var(--acc)">+' + r.caught + '명</b> (' + fmt(Math.min(save.caught, I.CASE.goal)) + ' / ' + I.CASE.goal + ')</span>' +
      '<span class="muted">팀 사기 충전: ' + (I.TUNE.buffSec / 60) + '분 동안 팀이 2배로 일해요</span>' +
      (r.closedNow ? '<span style="color:var(--acc);font-weight:700">사건 종결! 사무실에서 확인하세요</span>' : '');
  }

  function home() {
    addRun(I.advance(save, nowMs()));
    render();
    UI.show('s-hub');
    if (duringRun && duringRun.catches) showGain(duringRun, '출동하는 동안');
    duringRun = null;
    applyIfSafe();
    if (pendingClose) showCaseClosed();
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

  $('h-go').addEventListener('click', go);
  $('h-profile').addEventListener('click', editProfile);
  $('h-hire').addEventListener('click', function () { tryBuy('hire'); });
  $('h-trainb').addEventListener('click', function () { tryBuy('train'); });
  $('h-gear').addEventListener('click', function (e) {
    var b = e.target.closest('[data-gear]');
    if (b && !b.disabled) tryBuy(b.getAttribute('data-gear'));
  });
  $('h-tutorial').addEventListener('click', UI.openTutorial);
  $('h-story-all').addEventListener('click', showStory);
  $('h-reset-ask').addEventListener('click', function () {
    openInfo({
      label: '처음부터', title: '사건 1을 처음부터 할까요?',
      body: p('수사비, 형사, 장비, 사건 진척이 모두 사라져요. 되돌릴 수 없어요.'),
      ok: '처음부터 하기', cancel: '취소',
      onOk: function () { save = I.newSave(nowMs()); save.tutorialDone = true; persist(); render(); UI.toast('사건 1을 처음부터 시작해요'); }
    });
  });
  $('info-ok').addEventListener('click', function () { closeInfo('ok'); });
  $('info-body').addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); closeInfo('ok'); } });
  $('info-cancel').addEventListener('click', function () { closeInfo('cancel'); });
  $('info-sheet').addEventListener('click', function (e) { if (e.target === this) closeInfo('cancel'); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('info-sheet').hidden) closeInfo('cancel'); });
  // 탭을 떠날 때·돌아올 때 저장과 반영
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { I.advance(save, nowMs()); persist(); }
    else if ($('s-hub').classList.contains('on')) tick();
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
    if (!pendingUpdate || updating || !$('s-hub').classList.contains('on')) return;
    updating = true;
    I.advance(save, nowMs());
    persist();
    $('up-title').textContent = '새 버전 ' + pendingUpdate.version + '이 나왔어요';
    var notes = $('up-notes');
    notes.textContent = '';
    (pendingUpdate.items.length ? pendingUpdate.items : [pendingUpdate.title]).slice(0, 4).forEach(function (t) {
      var line = document.createElement('span');
      line.textContent = '· ' + t;          // 서버에서 온 글이라 textContent 로만 넣는다
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

  function showVersionInfo() {
    var body = N.map(function (n, i) {
      return '<p><b style="color:var(--acc)">' + n.ver + '</b> · ' + n.title + (i === 0 ? ' <span class="muted">(지금)</span>' : '') + '</p>' +
        n.items.map(function (t) { return '<p class="muted" style="font-size:13px">· ' + t + '</p>'; }).join('');
    }).join('');
    openInfo({ label: '패치노트', title: '수사 3팀 ' + VERSION, body: body || p('기록이 없어요') });
  }

  $('h-version').addEventListener('click', showVersionInfo);
  $('up-go').addEventListener('click', doUpdate);
  window.Team3CheckUpdate = function () { checkUpdate(true); };   // 화면 시험용
  // 안드로이드 앱이 꺼지기 직전에 부른다(뒤로 단추 두 번): 팀이 일한 몫까지 반영해 저장
  window.Team3Save = function () { I.advance(save, nowMs()); persist(); return 'ok'; };

  // 안드로이드 앱의 뒤로 단추: 바꾸는 중이면 그대로, 안내 창이 떠 있으면 닫고, 아니면 화면 쪽(ui.js)에 맡긴다
  window.Team3Back = function () {
    if (updating) return 'stay';
    if (!$('info-sheet').hidden) { closeInfo('cancel'); return 'stay'; }
    return UI.back();
  };

  /* ---------- 시작 ---------- */
  var loaded = loadSave();
  save = loaded.save;
  var away = I.advance(save, nowMs());
  persist();
  render();
  UI.show('s-hub');
  if (loaded.reset) UI.toast('저장을 읽지 못해 처음부터 시작해요');

  if (away.seconds >= 60 && away.catches > 0) {
    // 잠복 보고: 자리를 비운 동안 팀이 한 일
    openInfo({
      label: '잠복 보고', title: fmtDur(away.seconds) + ' 동안',
      body: p('3팀이 용의자 <b style="color:var(--acc)">' + fmt(away.catches) + '명</b>을 잡았어요.') +
        p('수사비 <b style="color:var(--acc)">+' + fmt(away.money) + '</b>') +
        (away.seconds >= I.TUNE.offlineCapSec ? p('<span class="muted">자리를 비운 시간은 8시간까지만 세요.</span>') : ''),
      ok: '좋아요',
      onOk: function () { if (pendingClose || away.closedNow) showCaseClosed(); }
    });
  } else if (!save.tutorialDone && save.runs === 0) {
    // 처음 켬: 사건 소개 + 튜토리얼 권유
    openInfo({
      label: '사건 ' + I.CASE.no, title: I.CASE.title,
      body: p(I.CASE.story[0].text) + p('<span class="muted">이런 퍼즐이 처음이면 1분짜리 튜토리얼부터 해 보세요.</span>'),
      ok: '튜토리얼 하기', cancel: '바로 사무실로',
      onOk: UI.openTutorial,
      onCancel: function () { save.tutorialDone = true; persist(); }
    });
  } else if (away.closedNow) {
    showCaseClosed();
  }

  // 버전 표시 · 업데이트 뒤 첫 실행 알림 · 새 버전 확인
  $('h-version').textContent = '수사 3팀 ' + VERSION + ' · 패치노트';
  var seen = lsGet(SEEN_KEY);
  if (seen && seen !== VERSION && installed) setTimeout(function () { UI.toast(VERSION + '으로 업데이트됐어요 · 맨 아래 패치노트에서 확인'); }, 3200);
  lsSet(SEEN_KEY, VERSION);
  registerSW();
  setTimeout(function () { checkUpdate(true); }, 3000);
  setInterval(function () { checkUpdate(true); }, 30 * 60 * 1000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) checkUpdate(false); });

  setInterval(tick, 1000);
})();
