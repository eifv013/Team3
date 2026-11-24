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
  var OF = window.Team3Office, OUI = window.Team3OfficeUI;   // 0.6.0 살아 있는 사무실(유치장 · 커피 · 장면)
  var Dp = window.Team3Dept, Ev = window.Team3Evidence, EUI = window.Team3EvidUI;   // 0.7.0 부서 · 재수사 · 증거판
  var Df = window.Team3Diff, DUI = window.Team3DiffUI, MUI = window.Team3MenuUI;   // MUI: 0.8.0 아래 메뉴
  var Cr = window.Team3Crew, CUI = window.Team3CrewUI;   // 0.8.0 팀원 직무 · 공용 장비 · 수사 기법   // MUI: 0.8.0 아래 메뉴   // 0.7.0 난이도(단순 · 강력 · 미제 사건)
  var H = window.Team3Ach, AUI = window.Team3AchUI;      // 0.3.0 업적 · 칭호(규칙 · 화면)
  var M = window.Team3Monet, SUI = window.Team3ShopUI;   // 0.4.0 상점 · 광고 자리 · 월정액 · 시즌 패스(규칙 · 화면)
  if (!UI || !I) return;
  var $ = function (id) { return document.getElementById(id); };
  var nowMs = function () { return Date.now(); };
  var KEY = 'guar.suspects3.idle.v1';

  var save = null, pendingClose = false, saveTick = 0;
  var duringRun = null;   // 출동하는 동안 팀이 번 것 { catches, money } — 사무실로 돌아올 때 보여 준다

  /* ---------- 0.3.0 동물 효과 ---------- */
  // 지금 켜진 동물 효과(사건 번호 · 기기 시각으로 개구리 · 부엉이 조건을 센다)
  function petBonus(sv) {
    var b = PT ? PT.bonus(sv, { caseNo: sv.caseNo, hour: new Date().getHours() }) : null;
    // 0.4.0 월정액: 자리 비움 한도 +분(동물 효과와 같은 갈래로 넘긴다)
    var pk = M && sv.shop ? M.perks(sv, Date.now()) : null;
    if (pk && pk.capMin) { b = b || (PT ? PT.zero() : { cap: 0 }); b.cap = (b.cap || 0) + pk.capMin; }
    // 0.7.0 증거판 · 재수사 경력도 같은 갈래로 더한다
    // 0.8.0 팀원 직무 · 공용 장비 · 수사 기법도
    if (Cr) { var cb = Cr.bonus(sv); b = b || (PT ? PT.zero() : {}); Object.keys(cb).forEach(function (k) { b[k] = (b[k] || 0) + (cb[k] || 0); }); }
    if (Ev && sv.evid) { var eb = Ev.bonus(sv); b = b || (PT ? PT.zero() : {}); Object.keys(eb).forEach(function (k) { b[k] = (b[k] || 0) + (eb[k] || 0); }); }
    // 0.9.0 시즌 패스 프리미엄: 출동 수사비 +15% · 팀 수사비 +10%
    if (M && sv.shop) { var pb = M.premBonus(sv, dayNow()); if (pb.pay || pb.idle) { b = b || (PT ? PT.zero() : {}); b.pay = (b.pay || 0) + pb.pay; b.idle = (b.idle || 0) + pb.idle; } }
    return b;
  }
  // 0.7.0 부서 수입 배수: 계급 배수 × (부서 효과 %)
  function deptMult(sv) { var b = petBonus(sv) || {}; return I.moneyMult(sv) * (1 + (b.dept || 0) / 100); }
  /*
   * 0.4.0 다른 모듈이 주는 보상을 저장에 넣는 한 곳(상점 · 패스 · 광고): tickets · treats · outfit · pick
   */
  function grant(kind, v) {
    if (!PT) return;
    var p = save.pets;
    if (kind === 'tickets') PT.addTickets(save, v);
    else if (kind === 'treats') p.treats += v;
    else if (kind === 'outfit' && PT.OUTFIT_BY[v]) p.closet[v] = true;
    else if (kind === 'pick') p.picks[v] = (p.picks[v] || 0) + 1;
    else if (kind === 'pet' && PT.grantLimited) PT.grantLimited(save, v);   // 0.9.0 한정 파트너(★5로)
    if (PUI) PUI.renderPartner();
  }
  // 광고 보상 "팀 회식 무료": 상점 회식과 같은 효과(토끼 효과 포함)
  function freeParty() {
    var b = petBonus(save), mul = 1 + (b && b.party ? b.party / 100 : 0);
    save.partyUntil = Math.max(save.partyUntil || 0, nowMs()) + I.TUNE.partySec * mul * 1000;
  }
  if (PT || Ev || Cr) I.setBonus(petBonus);
  // 0.7.0 부서 수입 · 번 수사비(재수사 단서) 훅
  if (Dp) I.setExtraIncome(function (sv) { return sv.dept ? Dp.perSec(sv, deptMult(sv)) : 0; });
  if (Ev) I.setEarn(function (sv, v) { Ev.earn(sv, v); });
  function petsReady() { if (PT) PT.clean(save); if (H) H.clean(save); if (M) M.clean(save, nowMs()); if (OF) OF.clean(save); if (Dp) Dp.clean(save); if (Ev) Ev.clean(save); if (Df) Df.clean(save); if (Cr) Cr.clean(save); if (window.Team3Attend) window.Team3Attend.clean(save); if (window.Team3Quest) window.Team3Quest.clean(save); }
  /*
   * 업적 확인(0.3.0). 사무실을 그릴 때마다(1초) 본다 — 조건이 20개 남짓이라 가볍다.
   *   새로 달성하면 보상(배지 · 뽑기권)을 주고 저장, 사무실에서 차례로 알린다.
   */
  function checkAch() {
    if (!H) return;
    var got = H.check(save);   // 0.6.0: 보상은 트로피에서 눌러 받는다
    if (AUI) AUI.dot();
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
    informant: '<path d="M4 18c2-5 5-7 8-7s6 2 8 7"/><circle cx="12" cy="7" r="3"/><path d="M17 4l2-2M19 7h2"/>',
    painter: '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 7l3 3"/><path d="M4 20l1-4"/>',
    lights: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.6 1 2.5h6c0-.9.2-1.7 1-2.5A6 6 0 0 0 12 3z"/>',
    witness2: '<circle cx="12" cy="12" r="3"/><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/>'
  };

  /* ---------- 팀이 잡을 때 보이는 것(1.4) ----------
   * 수사비가 "언제" 오르는지 보이게: 다음 검거까지 줄이 차오르고, 잡는 순간 +수사비가 떠오른다.
   */
  var feedTimer = 0, gainBuf = null;
  /* 0.10.6 형사가 많아 몇 초마다 잡으면 소식이 쉬지 않고 깜빡였다 → 5초씩 모아 한 번에(“최근 5초 · N명 검거”) */
  function showGain(r, from) {
    if (!r || !r.catches) return;
    if (!from) {
      if (gainBuf) { gainBuf.catches += r.catches; gainBuf.money += r.money; return; }
      gainBuf = { catches: r.catches, money: r.money, t0: Date.now() };
      setTimeout(function () { var b = gainBuf; gainBuf = null; if (b) showGainNow(b, '최근 5초 동안'); }, 5000);
      showGainNow(r, '');   // 첫 검거는 바로(혼자 일할 때처럼)
      gainBuf.catches = 0; gainBuf.money = 0;
      return;
    }
    showGainNow(r, from);
  }
  function showGainNow(r, from) {
    if (!r || !r.catches) return;
    var m = $('h-money');
    m.classList.remove('pop'); void m.offsetWidth; m.classList.add('pop');
    var f = document.createElement('span');
    f.className = 'float';
    f.textContent = '+' + fmt(r.money);
    $('h-float').appendChild(f);
    // 0.9.1 수사비가 길어 오른쪽 칩(난이도·배지)과 겹치면 숫자를 띄우지 않는다(같은 소식이 아래 줄에 뜬다)
    var chips = document.querySelector('.head-chips');
    if (chips && f.getBoundingClientRect().right > chips.getBoundingClientRect().left - 4) f.parentNode.removeChild(f);
    setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 1400);
    // 팀 속도 줄 자리에 4초 동안 소식을 띄웠다가 되돌린다
    $('h-feed').textContent = (from ? from + ' ' : '') + '3팀이 ' + fmt(r.catches) + '명을 검거했어요. 수사비 +' + fmt(r.money);   // 0.10.9 가운뎃점으로 잇지 않고 문장으로
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
      $('h-next').textContent = '1초에 ' + perMin(1 / I.catchInterval(save, t)) + '명, 한 명에 +' + I.payPerCatch(save);   // 단추 옆 좁은 칸이라 짧게
      return;
    }
    var sec = Math.ceil(n.sec);
    $('h-next').textContent = !isFinite(sec) ? '쉬는 중' : '다음 검거까지 ' + (sec >= 60 ? Math.floor(sec / 60) + '분 ' + (sec % 60 ? (sec % 60) + '초' : '') : sec + '초') +
      ', 수사비 +' + I.payPerCatch(save);
  }

  /* ---------- 그리기 ---------- */
  /* 0.6.0 붙는 줄: 큰 수사비가 화면 위로 지나가면 보인다. 내용은 render 마다 */
  function renderMini(incPerMin, petInc) {
    var m = $('h-mini'); if (!m) return;
    var IC = window.Team3Icons;
    $('hm-money').textContent = '수사비 ' + fmtShort(save.money);
    $('hm-gems').innerHTML = (IC ? IC.icon('gem') : '◆') + fmt(save.gems);
    if (Df) { var hmD = Df.info(Df.get(save)), hmE = $('hm-diff'); hmE.textContent = hmD.icon + ' ' + hmD.short; hmE.style.setProperty('--c', hmD.color); }   // 0.7.0 난이도
    $('hm-rate').textContent = '+' + fmtShort(incPerMin) + '/분' + (petInc > 0 ? ' (파트너 +' + fmtShort(petInc) + ')' : '');
    var cs = I.caseOf(save);
    $('hm-case').textContent = '사건 ' + cs.no + ' ' + cs.title + ' ' + fmt(Math.min(save.caught, cs.goal)) + ' / ' + fmt(cs.goal);
    $('hm-fill').style.width = (I.progress(save) * 100).toFixed(1) + '%';
    var x = PT && save.pets && save.pets.eq ? PT.parse(save.pets.eq) : null, pe = $('hm-pet'), key = x ? save.pets.eq : '';
    var nzK = key && PT.noirOn && PT.noirOn(save, key) ? key + '|n' : key;   // 0.8.4 각성이면 머리 사진도 누아르
    if (pe.getAttribute('data-k') !== nzK) { pe.setAttribute('data-k', nzK); pe.innerHTML = !x ? '' : nzK !== key && window.Team3NoirArt ? window.Team3NoirArt.draw(x.id, { grade: x.g }) : window.Team3PetArt ? window.Team3PetArt.draw(x.id, { grade: x.g }) : ''; }
  }
  function miniScroll() {
    var hub = $('s-hub'), m = $('h-mini'), money = $('h-money'); if (!hub || !m || !money) return;
    var show = money.getBoundingClientRect().bottom < hub.getBoundingClientRect().top + 4;
    if (show !== m.classList.contains('show')) { m.classList.toggle('show', show); m.setAttribute('aria-hidden', show ? 'false' : 'true'); }
  }

  function render() {
    var t = nowMs(), buff = I.buffed(save, t);
    if (OUI) OUI.tick();   // 0.6.0 사무실 장면(형사 수 · 날씨 · 사기 충전)
    if (EUI) EUI.tick();   // 0.7.0 부서 · 재수사 칸
    renderRank();   // 0.8.2 계급 카드
    if (CUI) CUI.render();
    if (MUI) MUI.render();   // 0.8.0 메뉴 숫자 · 추천 · 오늘 할 일
    // 내 자리: 사용자가 넣은 이름이라 textContent 로만 넣는다
    $('h-station').textContent = save.profile.station + ' 수사 3팀';
    var ld = $('h-leader');
    // 이름을 안 정했으면 "신임 팀장"(이번에 3팀을 맡은 사람). 사건 1 이야기와 이어진다.
    var rk = I.rankOf(save).name;   // 계급(0.1.19): 팀장은 경위부터
    // 0.3.0 칭호는 팀장 이름 앞에(글은 모두 textContent 라 꺾쇠 걱정 없음)
    var ttl = H ? H.leaderTitle(save) : '';
    ld.textContent = rk + ' ' + (ttl ? '「' + ttl + '」 ' : '') + (save.profile.leader ? '팀장 ' + save.profile.leader : '신임 팀장, 이름 정하기');
    ld.classList.toggle('empty', !save.profile.leader);
    $('h-money').textContent = '수사비 ' + fmtShort(save.money);
    fitMoney();
    checkAch();
    // 0.4.0 월정액 하루 보상: 사무실에 오면 하루 한 번
    if (M) { var sg = M.claimSub(save, nowMs(), dayNow()); if (sg) { persist(); UI.toast('3팀 월정액: 오늘의 배지 ◆' + sg); } }
    // 0.9.0 시즌 패스 프리미엄: 하루 간식 +5
    if (M && PT && save.pets) { var pt = M.claimPremTreats(save, dayNow()); if (pt) { save.pets.treats += pt; persist(); UI.toast('👑 프리미엄: 오늘의 간식 +' + pt); } }
    // 0.4.1 재화 아이콘(Team3Icons 가 없으면 ◆ 글자)
    $('h-gems').innerHTML = (window.Team3Icons ? window.Team3Icons.icon('gem') : '◆ ') + fmt(save.gems);
    // 0.9.0 시즌 패스 프리미엄: 머리에 👑 남은 날(3일 이하면 빨갛게) · 금빛 도장/왕관 팀 이름(body.prem-on)
    if (window.Team3Monet) {
      var MO = window.Team3Monet, pOn = MO.premOn(save, dayNow()), pc = $('h-prem');
      document.body.classList.toggle('prem-on', pOn);
      // 0.10.8 오른쪽 위 시즌 패스 단추: 현재 단계 · 받을 보상 점
      var pb0 = $('h-pass');
      if (pb0) {
        var pt = MO.tierOf(MO.passOf(save, dayNow()).xp), pn = MO.claimable(save, dayNow()).length, ph = pt + '|' + (pn > 0) + '|' + pOn;
        if (pb0._h !== ph) { pb0._h = ph; pb0.className = 'icon-btn pass-btn' + (pOn ? ' prem' : '');
          pb0.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><path d="M12 9.2l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L9.1 11.3l2-.3z" fill="currentColor" stroke="none"/></svg><b>' + pt + '</b>' + (pn > 0 ? '<i></i>' : '');
          pb0.setAttribute('aria-label', '시즌 패스 ' + pt + '단계' + (pn > 0 ? ', 받을 보상 ' + pn + '개' : '')); }
      }
      if (pc) { pc.hidden = !pOn; if (pOn) { var lf = MO.seasonOf(save, dayNow()).left; pc.textContent = lf === Infinity ? '👑 프리미엄' : '👑 ' + lf + '일'; pc.classList.toggle('soon', lf <= 3); } }
      // 연출 5: 시즌 끝 3일 전부터 하루 한 번 알림(받을 보상이 남았으면 그 수도)
      var se5 = MO.seasonOf(save, dayNow());
      if (se5.left <= 3 && save.shop && save.shop.passWarn !== dayNow()) {
        save.shop.passWarn = dayNow(); persist();
        var left5 = MO.claimable ? MO.claimable(save, dayNow()).length : 0;
        setTimeout(function () { UI.toast('⏳ 시즌이 ' + se5.left + '일 남았어요' + (left5 ? ', 받을 보상 ' + left5 + '개' : '') + (pOn ? '' : ', 프리미엄 보상도 함께 사라져요')); }, 1200);
      }
    }
    var rate = I.teamRate(save) * 60 * (buff ? I.TUNE.buffMult : 1);
    // 형사가 늘면 1명당 값이 아니라 잡는 수가 늘어 "1분에 버는 수사비"가 오른다 — 그걸 바로 보여 준다
    // 0.4.0 동물 효과가 보이게: 분당 수사비 중 동물(보유 + 파트너) 몫을 따로
    var inc = I.incomePerMin(save, t), pb = PT ? petBonus(save) : null, petInc = 0;
    if (pb && (pb.idle || pb.speed)) petInc = Math.round(inc - inc / ((1 + pb.idle / 100) * (1 + pb.speed / 100)));
    $('h-rate').innerHTML = '<i>검거 <b>' + perMin(rate) + '명</b>/분</i><i>수사비 <b>+' + fmt(inc) + '</b>/분</i>' + (petInc > 0 ? '<i class="fx">효과 +' + fmt(petInc) + '</i>' : '');   // 0.10.9 항목마다 칸으로
    renderMini(inc, petInc);
    var b = $('h-buff');
    b.hidden = !buff;
    if (buff) {
      var left = Math.ceil((I.boostUntil(save) - t) / 1000);
      b.textContent = ((save.partyUntil || 0) > t && save.partyUntil >= save.buffUntil ? '회식 ×2, ' : '사기 충전 ×2, ') + (left >= 60 ? Math.ceil(left / 60) + '분' : left + '초');
    }

    var goal = CS().goal;
    $('h-case').textContent = '사건 ' + CS().no + ' ' + CS().title + (save.closed ? ' (종결)' : '');
    $('h-city').textContent = CS().city;
    var nx = I.nextCase(save);
    $('h-next-case').hidden = !nx;
    if (nx) $('h-next-case').textContent = '사건 ' + nx.no + ' ' + ro(nx.city) + ' 파견';
    $('h-caught').textContent = fmt(Math.min(save.caught, goal)) + ' / ' + goal;
    $('h-bar').style.width = (I.progress(save) * 100).toFixed(1) + '%';
    // 방치 상한 뒤 구간(800 → 1000)은 빗금 = 현장에서만. 다 차면 빨간 알림 줄과 출동 단추 맥박
    var capPct = (1 - I.capOf(save) / goal) * 100;
    $('h-cap').style.width = save.closed ? '0' : capPct.toFixed(1) + '%';
    var capped = I.idleCapped(save);
    $('h-cap-note').classList.toggle('on', capped);
    if (capped) $('h-cap-text').textContent = '남은 ' + fmt(goal - save.caught) + '명은 현장 출동으로만 잡을 수 있어요';
    $('h-go').classList.toggle('urgent', capped);
    renderStoryButton();

    var o = I.runOptions(save), pc = save.prep || {};
    var zb = PT ? petBonus(save) : null;
    var dur = o.duration + (pc.coffee ? 15 : 0) + (zb && zb.time ? Math.round(zb.time) : 0), fh = o.freeHints + (pc.sketch ? 2 : 0);
    if (Df) { var DLn = Df.info(Df.get(save)); dur = Math.max(Math.min(dur, Df.MIN_SEC), dur + DLn.time); fh += DLn.freeHints; }   // 0.7.0 난이도
    diffGoSub();
    var fl = I.focusLeft(save, nowMs());   // 0.12.1 집중 수사
    $('h-go-sub').innerHTML = '<i>⏱ ' + dur + '초</i>' + (fl > 0 ? '<i class="fc">집중 수사 ' + fl + ' / ' + I.TUNE.focusRuns + '</i>' : '<i class="fc off">오늘 집중 수사 끝</i>') + (fh ? '<i>무료 단서 ' + fh + '</i>' : '') + (pc.press ? '<i>수사비 1.5배</i>' : '');
    if (E) { renderPrep(t); renderDaily(t); renderSupport(t); }

    $('h-det').textContent = save.detectives;
    renderNext(t, false);
    setBuy($('h-hire'), I.cost(save, 'hire'), '영입');
    $('h-train').textContent = save.training;
    setBuy($('h-trainb'), I.cost(save, 'train'), '훈련');

    var gbn = (PT && save.pets && save.pets.eq ? PT.bonus(save, { caseNo: save.caseNo, hour: new Date().getHours() }) : null) || {};
    petOn('h-gear-pet', [['장비 값 −' + Math.min(50, Math.round((gbn.gear || 0) * 10) / 10) + '%', (gbn.gear || 0) > 0]]);
    $('h-gear').innerHTML = I.gearFor(save).map(function (k) {   // 0.2.0: 이 사건에서 쓰는 장비만
      var g = I.GEAR[k], lv = save.gear[k], max = g.costs.length, c = I.cost(save, k);
      return '<div class="item"><div class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + GEAR_ICON[k] + '</svg></div>' +
        '<div class="tx"><b>' + g.name + (max > 1 ? ' ' + lv + '/' + max : '') + '</b><small>' + g.desc + '</small></div>' +
        '<button class="buy' + (c == null ? ' max' : save.money < c ? ' poor' : '') + '" data-gear="' + k + '"' + (c == null || save.money < c ? ' disabled' : '') +
        ' aria-label="' + g.name + (c == null ? ' 배치 완료' : ' 사기, ' + fmt(c)) + '">' + (c == null ? '<em>배치 완료</em><b>MAX</b>' : buyHTML('장착', c)) + '</button></div>';
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
    night: '<path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z"/>',
    joint: '<path d="M3 20h18M5 20V9l7-5 7 5v11M9 20v-6h6v6"/>',
    escort: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>'
  };
  var SHORT = { coffee: '커피', tip: '제보 전화', sketch: '몽타주', lawyer: '변호사', press: '언론 브리핑' };
  function icon(id) { return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (PREP_ICON[id] || '') + '</svg>'; }
  function dayNow() { return E.dayKey(nowMs(), new Date().getTimezoneOffset()); }

  /*
   * 0.6.0 준비물 효과 글: 지금 사건의 퍼즐(set · witness · lineup)에 맞게. "어디에도 설명이 없음" → ? 단추 · 챙긴 것 줄에서 쓴다
   */
  function prepDesc(id) {
    var mode = I.caseOf(save).mode;
    if (id === 'tip') return mode === 'witness' ? '첫 문제의 거짓 진술을 미리 짚어 줘요' : mode === 'lineup' ? '첫 줄에서 아닌 자리 절반을 미리 지워 줘요' : '출동을 시작할 때 한 패 하나를 미리 표시해 줘요';
    if (id === 'lawyer') return mode === 'witness' ? '오인, 함정 체포 벌점을 2번 막아 줘요' : mode === 'lineup' ? '오인 지목 벌점을 2번 막아 줘요' : '오인 체포 벌점을 2번 막아 줘요';
    if (id === 'sketch') return '단서(돋보기)를 2번 무료로 써요';
    if (id === 'coffee') return '출동 시간 +15초';
    if (id === 'press') return '이번 출동으로 버는 수사비 1.5배';
    var it = E.ITEMS.filter(function (x) { return x.id === id; })[0];
    return it ? it.desc : '';
  }
  function showPrepHelp() {
    var t = nowMs();
    openInfo({ label: '다음 현장 출동 한 번에 챙겨 가요', title: '준비물 효과',
      body: '<div class="prep-list">' + E.PREP_IDS.map(function (id) {
        var it = E.ITEMS.filter(function (x) { return x.id === id; })[0], on = E.owned(save, id, t);
        return '<div><b>' + esc(it.name) + (on ? ', 챙김 ✓' : '') + '</b><span>' + esc(prepDesc(id)) + '</span><small>' + (on ? '챙긴 걸 다시 누르면 무르고 돌려받아요' : '수사비 ' + fmt(E.price(save, id, 'money')) + ' (모자라면 배지로)') + '</small></div>';
      }).join('') + '</div>' + p('<span class="muted">출동을 한 번 하면 다 써요. 특별 출동에는 준비물을 쓰지 않아요.</span>'),
      readOnly: true });
  }

  /* 0.10.5 파트너 효과가 붙었는지 그 자리에서 보이게 */
  function petOn(id, rows) {
    var el = $(id); if (!el) return;
    rows = rows.filter(function (r) { return r[1]; });
    el.hidden = !rows.length;
    el.innerHTML = rows.length ? '<em class="pet-on-t">🐾 파트너 효과 적용 중 <small>(장착 + 보유 합계)</small></em>' + rows.map(function (r) { return '<span>' + r[0] + '</span>'; }).join('') : '';
  }
  function renderPrep(t) {
    var pbn = (PT && save.pets && save.pets.eq ? PT.bonus(save, { caseNo: save.caseNo, hour: new Date().getHours() }) : null) || {};   // 파트너 몫만
    var r1 = function (v) { return Math.round(v * 10) / 10; };
    petOn('h-prep-pet', [['준비물 값 −' + Math.min(50, r1(pbn.prep || 0)) + '%', (pbn.prep || 0) > 0], ['출동 수사비 +' + r1(pbn.pay || 0) + '%', (pbn.pay || 0) > 0],
      ['출동 시간 +' + Math.round(pbn.time || 0) + '초', (pbn.time || 0) > 0], ['오인 면제 ' + Math.round(pbn.shield || 0) + '번', (pbn.shield || 0) > 0]]);
    $('h-prep').innerHTML = E.PREP_IDS.map(function (id) {
      var it = E.ITEMS.filter(function (x) { return x.id === id; })[0], on = E.owned(save, id, t), c = E.price(save, id, 'money');
      return '<button class="chip' + (on ? ' on' : '') + (!on && save.money < c ? ' poor' : '') + '" data-prep="' + id + '" aria-pressed="' + on + '" aria-label="' + it.name + ', ' + prepDesc(id) + (on ? ', 챙김(누르면 무르기)' : ', ' + fmt(c)) + '">' +
        icon(id) + '<b>' + SHORT[id] + '</b><small>' + (on ? '챙김 ✓' : fmtShort(c)) + '</small></button>';
    }).join('');
    var packed = E.PREP_IDS.filter(function (id) { return E.owned(save, id, t); });
    // 챙긴 것은 한 줄에 하나씩(이어 붙이면 문장이 길게 꺾인다)
    $('h-prep-now').innerHTML = packed.length ? packed.map(function (id) { return '<span class="pn-row"><b>' + SHORT[id] + '</b> ' + esc(prepDesc(id)) + '</span>'; }).join('')
      : '누르면 다음 출동에 챙겨 가요';
    $('h-medals').innerHTML = E.MEDALS.map(function (m, mi) {
      return '<i class="' + m.key + (save.medals[m.key] ? ' on' : '') + '" title="' + m.name + ' 메달 ' + fmt(m.at) + '점">' + medalIcon(mi, 15) + fmtShort(m.at) + '</i>';
    }).join('');
  }
  function renderDaily() {
    var st = E.dailyStatus(save, dayNow()), r = st.rule, box = $('h-daily');
    $('h-daily-name').innerHTML = esc(r.name) + '<i class="dl-time">⏱ ' + r.config.duration + '초</i>';   // 0.10.9 시간은 이름 옆 칸으로, 설명은 한 문장으로
    $('h-daily-desc').textContent = r.desc;
    // 0.10.5 메달 목표는 칸으로, 오늘 최고는 따로 한 줄(점으로 이어 붙이면 안 읽힌다)
    // 0.10.6 메달은 그림으로, 받은 메달은 밝게 · 기회는 점으로(재화 없음)
    $('h-daily-goal').innerHTML = ['동', '은', '금'].map(function (nm, i) {
      return '<span class="dg-m' + (st.paid >= i ? ' on' : '') + '">' + medalIcon(i, 18) + nm + ' ' + fmt(r.medals[i]) + (st.paid >= i ? ' ✓' : '') + '</span>';
    }).join('') +
      '<span class="dg-best">' + (st.best ? '오늘 최고<b>' + fmt(st.best) + '</b>' : '') + '<span class="dg-try">남은 기회 ' +
        Array.apply(null, Array(st.limit)).map(function (_, i) { return '<i class="' + (i < st.left ? 'on' : '') + '"></i>'; }).join('') + ' <b>' + st.left + '/' + st.limit + '</b></span></span>';
    box.classList.toggle('done', st.done);
    var b = $('h-daily-go');
    b.textContent = st.left <= 0 ? '내일 다시' : st.paid >= 2 ? '연습' : '도전';
    b.disabled = st.left <= 0;
  }
  /* 0.10.6 동 · 은 · 금 메달 그림(리본 + 원판 + 별) */
  function medalIcon(i, sz) {
    var C = [['#E39A5B', '#A35F2C', '#F6C08F'], ['#D9DEE8', '#8C94A6', '#FFFFFF'], ['#F7C934', '#B4850B', '#FFF1A8']][i];
    return '<svg class="medal-ic" width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h4l2 6H9zM13 2h4l-2 6h-4z" fill="' + ['#C0392B', '#3D6FD6', '#2E9E5B'][i] + '"/>' +
      '<circle cx="12" cy="15" r="7.5" fill="' + C[0] + '" stroke="' + C[1] + '" stroke-width="1.6"/><path d="M12 10.6l1.3 2.7 3 .4-2.2 2 .6 3-2.7-1.5-2.7 1.5.6-3-2.2-2 3-.4z" fill="' + C[2] + '" opacity=".9"/></svg>';
  }
  function renderSupport(t) {
    // 0.10.9 지원 넷(회식 · 합동 수사본부 · 호송 지원 · 야간 잠복조). 진행 중이면 이름 옆 초록 딱지, 값은 팀 수입에 따라 정해진다(쓴다고 오르지 않는다)
    var UNTIL = { party: 'partyUntil', joint: 'jointUntil', escort: 'escortUntil' };
    $('h-support').innerHTML = '<p class="sup-note">값은 팀 수입에 따라 정해져요. 쓴다고 오르지 않아요.</p>' + ['party', 'joint', 'escort', 'night'].map(function (id) {
      var it = E.ITEMS.filter(function (x) { return x.id === id; })[0], c = E.price(save, id, 'money'), on = E.owned(save, id, t);
      var state = !on ? '' : '<em class="sup-on">' + (UNTIL[id] ? '진행 중 ' + Math.ceil((save[UNTIL[id]] - t) / 60000) + '분' : '대기 중') + '</em>';
      var lock = id === 'night' && on;
      return '<div class="item"><div class="ic">' + icon(id) + '</div><div class="tx"><b>' + it.name + state + '</b><small>' + it.desc + '</small></div>' +
        '<button class="buy' + (lock ? ' max' : save.money < c ? ' poor' : '') + '" data-support="' + id + '"' + (lock || save.money < c ? ' disabled' : '') + '>' + (lock ? '<em>대기 중</em><b>준비됨</b>' : buyHTML('구입', c)) + '</button></div>';
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
      openInfo({ label: '배지로 사기', title: it.name, body: p(esc(prepDesc(id))) + p('<span class="muted">수사비가 모자라요. 배지 ◆' + g + '개로 살까요? (가진 배지 ◆' + fmt(save.gems) + ')</span>'),
        ok: '◆' + g + '개로 사기', cancel: '취소',
        onOk: function () { try { E.buy(save, id, nowMs(), 'gems'); done(); } catch (e2) { UI.toast('살 수 없어요: ' + e2.message); } } });
    }
    function done() { UI.sfx.coin(); UI.buzz(10); persist(); render(); }
  }
  function unprep(id) {
    try {
      var r = E.unprep(save, id);
      UI.toast(SHORT[id] + ' 무르기, ' + (r.currency === 'gems' ? '◆' + r.refunded : fmt(r.refunded)) + ' 돌려받음');
      persist(); render();
    } catch (e) { UI.toast('무를 수 없어요: ' + e.message); }
  }

  /* 0.8.3 구매 단추: 위 작은 글(영입 · 훈련 · 장착)과 아래 값 두 줄. 모자라면 값이 빨갛게(얼마 모자란지 aria 로) */
  function buyHTML(word, c) { return c == null ? '<em>다 갖췄어요</em><b>MAX</b>' : '<em>' + word + '</em><b class="cn">' + fmtShort(c) + '</b>'; }
  function setBuy(btn, c, word) {
    btn.classList.toggle('max', c == null);
    btn.disabled = c == null || save.money < c;
    btn.classList.toggle('poor', c != null && save.money < c);
    var h = buyHTML(word, c);
    if (btn._bh !== h) { btn._bh = h; btn.innerHTML = h; }
    btn.setAttribute('aria-label', c == null ? word + ' 최고 단계' : word + ' ' + fmt(c) + (save.money < c ? ', ' + fmt(c - save.money) + ' 모자람' : ''));
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
    // 0.6.0: 단추 글자의 ◆ 는 배지 아이콘으로(글자는 내부 문구뿐이라 이스케이프 뒤 바꾼다)
    $('info-ok').innerHTML = esc(o.ok || '확인').replace(/◆/g, window.Team3Icons ? window.Team3Icons.icon('gem') : '◆');
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
    if (Df) Df.noteClose(save, CS().no);   // 0.7.0 미제 사건 난이도로 닫았으면 업적
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
        p('<span class="muted">팀이 잡은 용의자 ' + fmt(save.teamCaught) + '명, 내가 출동해 잡은 용의자 ' + fmt(save.runCaught) + '명, 출동 ' + save.runs + '번, 최고 점수 ' + fmt(save.bestScore) + '</span>'),
      // 0.7.0 사건을 닫을 때가 재수사하기 가장 좋은 때(잃는 진척이 없다): 단서가 있으면 "재수사하고 파견"
      ok: I.nextCase(save) ? (Ev && Ev.gainNow(save) >= 1 ? '재수사로 단서 +' + Ev.gainNow(save) + ' ' + ro(I.nextCase(save).city) + ' 파견' : ro(I.nextCase(save).city) + ' 파견') : (Ev && Ev.gainNow(save) >= 1 ? '재수사하기, 단서 +' + Ev.gainNow(save) : '계속 수사하기 (다음 사건은 준비 중)'),
      cancel: I.nextCase(save) || (Ev && Ev.gainNow(save) >= 1) ? '나중에' : '',
      onOk: function () {
        var go = function () { if (I.nextCase(save)) goNextCase(); };
        if (EUI && Ev && Ev.gainNow(save) >= 1) setTimeout(function () { EUI.retreatAtClose(go); }, 50); else go();
      }
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
      // 0.11.0 사건이 넘어갈 때: 지도 연출 뒤 이야기 장면(사건 색 · 제목 · 시작 편을 한 줄씩)
      caseScene(nx, '이번 사건은 현장 출동 퍼즐이 달라져요. 도움말(?)에서 먼저 볼 수 있어요.');
    };
    var m = $('dispatch-map');
    if (!m) { after(); return; }
    $('dm-label').textContent = nx.city;
    m.hidden = false; m.classList.remove('go'); void m.offsetWidth; m.classList.add('go');
    try { UI.sfx.levelUp ? UI.sfx.levelUp() : UI.sfx.none(); } catch (e) { /* 소리 실패 무시 */ }
    setTimeout(function () { m.hidden = true; m.classList.remove('go'); after(); }, 3000);
  }
  /* 0.11.0 이야기 장면 */
  var SC = window.Team3Scene;
  var PROLOGUE = ['도시의 밤은 조용한 적이 없다.', '신고는 밀려들고, 용의자는 늘 여럿이다.', '그중에서 진짜 범인을 가려내는 일.', '그게 수사 3팀의 일이다.', '오늘부터 당신이 3팀 팀장이다.'];
  function caseScene(cs, hint, onDone, last) {
    if (!SC) { if (onDone) onDone(); return; }
    SC.play({ tone: cs.no <= 3 ? 'c' + cs.no : 'cx', kicker: '사건 ' + cs.no, title: cs.title, sub: cs.city, stamp: '수사 개시', lines: SC.sentences(cs.story[0].text), hint: hint, last: last, onDone: onDone });
  }
  /** 처음 시작: 프롤로그 → 사건 1 장면 → then. 설정의 "처음 이야기 다시 보기"도 이것 */
  function introScene(then) {
    if (!SC) { if (then) then(); return; }
    SC.play({ tone: 'intro', kicker: 'LOOP & LAMP STUDIO', title: '수사 3팀', lines: PROLOGUE, last: '다음',
      onDone: function () { caseScene(I.CASES[0], '', then, then ? '사무실로' : '닫기'); } });
  }
  /* 0.11.1 이야기 다시 보기: 프롤로그와 지금까지 온 사건의 장면을 골라 본다(아직 안 간 사건은 제목을 가린다) */
  function storyMenu() {
    var rows = '<button class="st-row" data-st="p"><small>처음</small><b>수사 3팀</b><i>▶</i></button>' + I.CASES.map(function (c) {
      var ok = c.no <= save.caseNo;
      return '<button class="st-row" data-st="' + c.no + '"' + (ok ? '' : ' disabled') + '><small>사건 ' + c.no + '</small><b>' + (ok ? esc(c.title) : '???') + '</b><i>' + (ok ? '▶' : '🔒') + '</i></button>';
    }).join('');
    openInfo({ label: '설정', title: '이야기 다시 보기', body: '<div class="st-list" id="st-list">' + rows + '</div>', readOnly: true });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#st-list .st-row'); if (!b || b.disabled || !SC) return;
    var k = b.getAttribute('data-st');
    if (k === 'p') SC.play({ tone: 'intro', kicker: 'LOOP & LAMP STUDIO', title: '수사 3팀', lines: PROLOGUE, last: '닫기' });
    else caseScene(I.CASES[+k - 1], '', null, '닫기');
  });
  window.Team3Intro = { play: introScene, menu: storyMenu };
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
    openInfo({ label: '수사 일지', title: '사건 ' + CS().no + ' ' + CS().title, body: body, readOnly: true });
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
    var tagBtn = cost === 0 ? '' : '<button class="linkish" id="pf-tags"' + (save.gems < NT.gems ? ' disabled' : '') + '>이름표 ' + NT.n + '장 사기, ◆' + NT.gems + ' (파트너 이름에도 써요)</button>';
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
        UI.toast(r.profile.station + ' 수사 3팀' + (r.profile.leader ? ', 팀장 ' + r.profile.leader : '') + (r.paid ? ', ◆' + r.paid : r.tag ? ', 이름표 1장' : ''));
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
      if (kind === 'hire') questTrack('hire', 1);
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
    if (Df) opts = Df.applyRun(opts, Df.get(save));   // 0.7.0 난이도는 맨 마지막에(시간 · 벌점 · 단서 · 단계 속도)
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
  // 0.10.6 하루 기회: 기본 5 + 판 수 업적 + 프리미엄 1
  if (E && E.setDailyExtra) E.setDailyExtra(function (sv, day) { return (H && H.dailyExtraTries ? H.dailyExtraTries(sv) : 0) + (M && sv.shop && M.premOn(sv, day) ? 1 : 0); });
  function goDaily() {
    if (dispatching || !E) return;
    var day = dayNow(), st = E.dailyStatus(save, day);
    var begin = function () {
      var cfg;
      try { cfg = E.startDaily(save, day); } catch (e) { UI.toast(e.code === 'DAILY_DONE' ? '오늘 기회를 다 썼어요' : '시작할 수 없어요: ' + e.message); return; }
      if (H && H.noteDailyRun) H.noteDailyRun(save);   // 0.10.6 판 수 업적(하루 기회 +1)
      cfg.ruleName = st.rule.name; cfg.day = day; cfg.boss = false;
      if (Df) cfg = Df.applyRun(cfg, Df.get(save));
      persist();
      dispatching = true;
      var run = function () { I.advance(save, nowMs()); duringRun = { catches: 0, money: 0 }; runCfg = cfg; UI.startRun(cfg); };
      var T = window.Team3Transit;
      if (!T) { dispatching = false; run(); return; }
      T.play('normal', run, { caseNo: CS().no, caseTitle: '특별 출동, ' + st.rule.name })
        .then(function () { dispatching = false; }, function () { dispatching = false; });
    };
    if (st.left > 0) { begin(); return; }
    UI.toast('오늘 기회를 다 썼어요, 내일 새 규칙으로 다시 열려요');
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
  var lastDouble = null;   // 0.4.0 방금 출동의 "2배 받기" 한 번
  function onRunEnd(g) {
    var d = null;
    addRun(I.advance(save, nowMs()));
    var cfg = runCfg || {}, base = E ? E.baseValue(save) : 0, best0 = save.bestScore, extra = '';
    runCfg = null;
    // 0.7.0 난이도: 이 판을 시작할 때 적어 둔 난이도로 보상을 매긴다(cfg.diff)
    var dk = Df && cfg.diff ? cfg.diff : 'normal', DL = Df ? Df.info(dk) : { pay: 1, clue: 1, xp: 1 };
    questTrack('run', 1); questTrack('caught', g.hits || 0); if (cfg.daily) questTrack('daily', 1);   // 0.10.3 임무
    var r = I.applyRun(save, { score: g.score, hits: g.hits, payMult: cfg.payMult || 1, diffMult: DL.pay, clueMult: DL.clue }, nowMs());
    if (window.Team3Evidence && window.Team3Evidence.canRepick(save)) window.Team3Evidence.endRepick(save);   // 0.12.0 갈림길 다시 고르기는 재수사 뒤 첫 출동까지
    if (Df) Df.noteRun(save, dk, g.score);   // 강력 이상이면 실력 기록(최고 점수)도
    if (E && cfg.daily && dk === 'easy') {
      // 단순 사건: 특별 출동 메달 보상 대신 그날 한 번 참가 보상(◆1)
      var dday = cfg.day || dayNow(); E.dailyStatus(save, dday);
      if (g.score > save.daily.best) save.daily.best = g.score;
      if (!save.daily.joined) { save.daily.joined = true; save.gems += 1; extra += '<span class="res-medal">특별 출동 참가 보상, ◆1</span>'; }
      extra += '<span class="muted">단순 사건은 특별 출동 메달 대신 참가 보상을 받아요. 메달은 강력, 미제 사건에서 받을 수 있어요.</span>';
    } else if (E && cfg.daily) {
      d = E.applyDaily(save, cfg.day || dayNow(), g.score, base);
      if (H && d.isNew) H.noteDaily(save, d.medal);   // 0.3.0 업적용 기록(그날 새로 딴 메달만)
      if (d.medal === '금' && d.isNew) questTrack('gold', 1);
      var dleft = E.dailyStatus(save, cfg.day || dayNow()).left;
      var hb = Df ? Df.dailyBonus(save, dk, d.medal) : { gems: 0, tickets: 0 };   // 미제 사건: 배지 +1 · 금이면 뽑기권 +1
      if (hb.gems) save.gems += hb.gems;
      extra += d.medal && d.isNew
        ? '<span class="res-medal">특별 출동 ' + d.medal + ' 메달' + (d.upFrom ? '(' + d.upFrom + ' → ' + d.medal + ', 차액)' : '') + ', 수사비 +' + fmt(d.money) + ', ◆' + (d.gems + hb.gems) + (PT ? ' ' + giveTickets(1 + hb.tickets) : '') + (hb.gems ? ' (미제 사건 보너스 포함)' : '') + '</span>'
        : d.medal ? '<span class="muted">' + d.medal + ' 메달, 오늘 이미 받은 메달이에요. 더 높은 메달을 따면 그만큼 더 받아요.</span>'
        : '<span class="muted">특별 출동: 동 메달(' + fmt(E.dailyRule(cfg.day || dayNow()).medals[0]) + '점)부터 보상이에요.</span>';
      extra += '<span class="muted">오늘 남은 기회 ' + dleft + '번</span>';
    } else if (E) {
      // 0.7.0 첫 메달 보상(실력 기록)은 강력 사건 이상에서만
      if (Df && !Df.countsSkill(dk)) { if (g.score >= E.MEDALS[0].at) extra += '<span class="muted">점수 업적, 첫 메달 보상은 강력 사건부터 기록돼요.</span>'; }
      else E.claimMedals(save, g.score, base).forEach(function (m) {
        extra += '<span class="res-medal">첫 ' + m.name + ' 메달! 수사비 +' + fmt(m.money) + ', ◆' + m.gems + (PT ? ' ' + giveTickets(2) : '') + '</span>';
      });
      if (g.score > best0 && best0 > 0) extra += '<span style="color:var(--acc);font-weight:700">최고 점수 경신! (전 기록 ' + fmt(best0) + ')</span>';
    }
    // 0.4.0 시즌 패스 경험치 · 광고 보고 수사비 2배
    if (M) {
      var rxp = Math.round(M.runXp(g.score, d && d.medal, r.focus) * DL.xp);   // 0.7.0 난이도 경험치 배수
      var xr = M.addXp(save, dayNow(), rxp);
      extra += '<span class="res-pass">시즌 패스 +' + rxp + 'XP' + (xr.up ? ', <b>' + xr.tier + '단계 달성!</b> 매점에서 보상을 받아요' : '') + '</span>';
      lastDouble = null;
      if (r.money > 0 && M.adLeft(save, 'double', dayNow()) > 0) {
        lastDouble = { amt: r.money };
        // 0.10.6 2배 받기는 결과 줄 맨 위에 크게(아래쪽 회색 줄 사이에 묻혀 안 보였다)
        extra = '<button class="res-double" id="res-double"><span class="rd-l">' + (M.perks(save, nowMs()).adFree ? '바로 받기' : '▶ 광고 보고') + '</span><b>수사비 2배</b><em>+' + fmt(r.money) + '</em></button>' + extra;
      }
    }
    persist();
    if (r.closedNow) pendingClose = true;
    var rk = I.rankOf(save);
    // 0.4.0 이번 출동 수사비 중 동물 효과 몫(파트너 이름과 함께)
    var pb2 = PT ? petBonus(save) : null, petPay = pb2 && pb2.pay ? Math.round(r.money - r.money / (1 + pb2.pay / 100)) : 0;
    var partner = PT && save.pets.eq ? PT.nameOf(save, save.pets.eq) : '';
    if (petPay > 0) extra = '<span class="res-pet">파트너 효과 +' + fmt(petPay) + (partner ? ', 파트너 ' + esc(partner) + ' 덕분이에요' : '') + '</span>' + extra;
    var dTag = Df ? '<span class="res-diff" style="--c:' + DL.color + '">' + DL.icon + ' ' + Df.resultLine(dk) + '</span>' : '';
    return dTag + '<span>수사비 <b style="color:var(--acc)">+' + fmt(r.money) + '</b>' + (cfg.payMult > 1 ? ' (언론 브리핑 ×1.5)' : '') + ', 사건 진척 <b style="color:var(--acc)">+' + r.caught + '명</b>' + (r.focus ? ' <em class="res-fc">집중 수사 ×' + I.TUNE.focusMult + '</em>' : ' <em class="res-fc off">집중 수사 끝</em>') + ' (' + fmt(Math.min(save.caught, CS().goal)) + ' / ' + CS().goal + ')</span>' +
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
    if (OF && r.catches) OF.addCatches(save, r.catches);   // 0.6.0 유치장(출동 중에도 모인다)
    if (OUI && r.catches && $('s-hub').classList.contains('on')) OUI.caught(r.catches);
    if ($('s-hub').classList.contains('on')) {
      render();
      if (r.catches) { renderNext(t, true); showGain(r); }
    }
    // 0.8.4 코드네임을 새로 받았으면 파트너 탭을 보고 있을 때(창 · 출동 없음) 한 번 알려 준다.
    //   아무 때나 띄우면 출동 시작과 겹쳐 판을 가린다(화면 시험에서 발견) → 파트너 탭에서만
    if (PUI && PUI.noirAnnounce && MUI && MUI.current && MUI.current() === 'pets' && $('s-hub').classList.contains('on') && !UI.sheetOpen() && !(UI.playing && UI.playing()) && !(PUI.isBusy && PUI.isBusy())) PUI.noirAnnounce(openInfo);
    attendAuto();
    if (r.closedNow) {
      if ($('s-hub').classList.contains('on') && $('info-sheet').hidden) showCaseClosed();
      else pendingClose = true;
    }
    if (++saveTick % 5 === 0) persist();
  }

  /* ---------- 연결 ---------- */
  UI.hooks.home = home;
  UI.hooks.go = go;
  $('h-rank').addEventListener('click', showRanks);
  UI.hooks.goDaily = function () { if (E) goDaily(); else go(); };   // 0.8.2 결과 화면 "다시 출동"이 특별 출동이었으면 특별 출동으로
  UI.hooks.onRunEnd = onRunEnd;
  /* ---------- 0.10.2 출석 체크: 현실 달력 · 특별한 날(7 · 14 · 21 · 마지막 날) 큰 보상 ---------- */
  var AT = window.Team3Attend, attendShown = '';
  function attendHTML() {
    var b = AT.board(save, dayNow()), I2 = window.Team3Icons, ic = function (n) { return I2 ? I2.icon(n) : ''; };
    var head = ['일', '월', '화', '수', '목', '금', '토'].map(function (d, i) { return '<span class="at-dw' + (i === 0 ? ' sun' : i === 6 ? ' sat' : '') + '">' + d + '</span>'; }).join('');
    var pad = ''; for (var i = 0; i < b.dow; i++) pad += '<span class="at-c pad"></span>';
    var cells = b.cells.map(function (c) {
      var r = c.r, rw = r.tickets ? ic('ticket') + r.tickets : r.gems && !r.treats ? ic('gem') + r.gems : ic('treat') + r.treats;
      return '<span data-atd="' + c.d + '" class="at-c' + (r.big ? ' big' : '') + (c.got ? ' got' : '') + (c.today ? ' today' : '') + (c.past && !c.got ? ' miss' : '') + '"><span class="at-d">' + c.d + '</span><b>' + rw + '</b>' + (c.got ? '<em>✓</em>' : '') + '</span>';
    }).join('');
    return '<p class="at-sum">' + b.m + '월 출석 <b>' + b.count + '일</b></p>' +
      '<div class="at-cal">' + head + pad + cells + '</div>' +
      '<p class="at-note" id="at-tip">날짜를 누르면 보상을 자세히 볼 수 있어요</p>';
  }
  function openAttend() {
    if (!AT) return;
    var done = !AT.canCheck(save, dayNow());
    openInfo({ label: '출석 체크', title: (done ? '오늘 출석했어요' : '오늘 출석하기'), body: attendHTML(), ok: done ? '확인' : '출석하기',
      onOk: function () {
        if (!AT.canCheck(save, dayNow())) return;
        var r = AT.check(save, dayNow(), grant); questTrack('attend', 1); persist(); render();
        try { UI.sfx.coin(); } catch (e) { /* 무시 */ }
        UI.toast('출석 보상: ' + (r.tickets ? '뽑기권 ' + r.tickets + '장 ' : '') + (r.gems ? '배지 ◆' + r.gems + ' ' : '') + (r.treats ? '간식 ' + r.treats : ''));
        if (MUI && MUI.render) MUI.render();
      } });
  }
  /* ---------- 0.10.3 일간 · 주간 · 월간 임무 ---------- */
  var QS = window.Team3Quest, questTab = 'd';
  function questTrack(kind, n) { if (QS && save) { QS.track(save, kind, n, dayNow()); } }
  function rwText(r) {
    var I2 = window.Team3Icons, ic = function (n) { return I2 ? I2.icon(n) : ''; }, o = [];
    if (r.tickets) o.push(ic('ticket') + r.tickets); if (r.gems) o.push(ic('gem') + r.gems); if (r.treats) o.push(ic('treat') + r.treats);
    return o.join(' ');
  }
  function questHTML() {
    var day = dayNow(), tabs = ['d', 'w', 'm'].map(function (k) {
      var c = QS.list(save, k, day).filter(function (x) { return x.done && !x.got; }).length + (QS.boxState(save, day, k).ready ? 1 : 0);
      return '<button class="' + (questTab === k ? 'on' : '') + '" data-qt="' + k + '">' + QS.NAME[k] + (c ? '<em>' + c + '</em>' : '') + '</button>';
    }).join('');
    var rows = QS.list(save, questTab, day).map(function (x) {
      return '<div class="qs-row' + (x.got ? ' got' : x.done ? ' done' : '') + '"><div class="qs-tx"><b>' + esc(x.name) + '</b>' +
        '<div class="qs-bar"><i style="width:' + Math.round(x.n / x.goal * 100) + '%"></i></div><small>' + fmt(x.n) + ' / ' + fmt(x.goal) + '</small></div>' +
        '<div class="qs-r">' + rwText(x.r) + '</div>' +
        (x.got ? '<span class="qs-ok">받음 ✓</span>' : '<button class="primary qs-get" data-qc="' + x.id + '"' + (x.done ? '' : ' disabled') + '>받기</button>') + '</div>';
    }).join('');
    var box = '';
    {   // 0.10.9 일간 · 주간 · 월간 모두 완료 상자
      var b = QS.boxState(save, day, questTab);
      box = '<div class="qs-row box' + (b.got ? ' got' : b.ready ? ' done' : '') + '"><div class="qs-tx"><b>🎁 ' + QS.NAME[questTab] + ' 완료 상자</b><small>임무 ' + b.n + ' / ' + b.total + '</small></div><div class="qs-r">' + rwText(b.r) + '</div>' +
        (b.got ? '<span class="qs-ok">받음 ✓</span>' : '<button class="primary qs-get" data-qc="' + (questTab === 'd' ? 'box' : 'box:' + questTab) + '"' + (b.ready ? '' : ' disabled') + '>열기</button>') + '</div>';
    }
    var reset = questTab === 'd' ? '자정에 새로 시작해요' : questTab === 'w' ? '월요일 0시에 새로 시작해요' : '매달 1일 0시에 새로 시작해요';
    return '<div class="qs-tabs">' + tabs + '</div><div class="qs-left" id="qs-left">' + questLeft(questTab) + '</div><div class="qs-list">' + rows + box + '</div>';   // 0.10.9 "언제 새로 시작" 글은 뺐다(위에 남은 시간이 있다)
  }
  /* 0.10.6 일간 · 주간 · 월간 남은 시간(이 기기 시각 기준 0시에 바뀐다) */
  function questLeft(k) {
    var now = new Date(), end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    if (k === 'w') end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (7 - (now.getDay() + 6) % 7));
    if (k === 'm') end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    var m = Math.max(0, Math.ceil((end - now) / 60000)), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60), mm = m % 60;
    return '⏱ ' + QS.NAME[k] + ' 임무 남은 시간 <b>' + (d ? d + '일 ' + h + '시간' : h ? h + '시간 ' + mm + '분' : mm + '분') + '</b>';
  }
  setInterval(function () { var el = document.getElementById('qs-left'); if (el && QS) el.innerHTML = questLeft(questTab); }, 30000);
  function openQuest() {
    if (!QS) return;
    openInfo({ label: '임무', title: '3팀 임무', body: questHTML(), readOnly: true });
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('#info-body [data-qt], #info-body [data-qc]');
    if (!t || !QS) return;
    if (t.getAttribute('data-qt')) questTab = t.getAttribute('data-qt');
    else {
      try { var r = QS.claim(save, t.getAttribute('data-qc'), dayNow(), grant); UI.sfx.coin(); UI.toast('임무 보상: ' + [r.tickets ? '뽑기권 ' + r.tickets + '장' : '', r.gems ? '배지 ◆' + r.gems : '', r.treats ? '간식 ' + r.treats : ''].filter(Boolean).join(', ')); persist(); render(); }
      catch (x) { UI.toast(x.code === 'NOT_DONE' ? '아직 다 못 했어요' : '이미 받았어요'); }
    }
    $('info-body').innerHTML = questHTML();
    if (MUI && MUI.render) MUI.render();
  });
  window.Team3QuestUI = { open: openQuest, track: function (k, n) { questTrack(k, n); }, ready: function () { return QS ? QS.ready(save, dayNow()) : 0; } };
  /* 0.10.3 창 안의 작은 탭(파트너: 뽑기 · 도감 · 의상 / 매점: 상점 · 시즌 패스 / 임무: 일간 · 주간 · 월간)도 옆으로 밀어서 넘긴다 */
  (function () {
    var sx = null, sy = 0, st = 0, bar = null;
    document.addEventListener('touchstart', function (e) {
      var sh = e.target.closest && e.target.closest('.sheet');
      bar = sh ? sh.querySelector('#pets-tabs, #shop-tabs, .qs-tabs') : null;
      if (!bar || e.target.closest('input, textarea, select, .gx-cards, #ev-vp')) { sx = null; return; }
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now();
    }, { passive: true });
    document.addEventListener('touchend', function (e) {
      if (sx == null || !bar) return;
      var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null;
      if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6 || Date.now() - st > 700) return;
      var bs = Array.prototype.slice.call(bar.querySelectorAll('button')), i = bs.findIndex(function (b) { return b.classList.contains('on'); }) + (dx < 0 ? 1 : -1);
      if (i >= 0 && i < bs.length) bs[i].click();
    }, { passive: true });
  })();
  // 0.10.3 출석 날짜를 누르면 그날 보상 설명
  document.addEventListener('click', function (e) {
    var c = e.target.closest && e.target.closest('#info-body [data-atd]'), tip = $('at-tip');
    if (!c || !tip || !AT) return;
    var b = AT.board(save, dayNow()), d = +c.getAttribute('data-atd'), x = b.cells[d - 1], r = x.r;
    var txt = [r.tickets ? '뽑기권 ' + r.tickets + '장' : '', r.gems ? '배지 ◆' + r.gems : '', r.treats ? '간식 ' + r.treats + '개' : ''].filter(Boolean).join(', ');
    tip.innerHTML = '<b>' + b.m + '월 ' + d + '일</b>, ' + txt + (r.big ? ' <span style="color:var(--acc)">· 특별한 날</span>' : '') +
      (x.got ? ', 받았어요' : x.today ? ', 현재 받을 수 있어요' : x.past ? ', 지나간 날' : '');
    document.querySelectorAll('#info-body .at-c.pick').forEach(function (n) { n.classList.remove('pick'); }); c.classList.add('pick');
  });
  // 0.10.4 창 안 작은 탭을 바꾸면 창도 맨 위부터
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#pets-tabs button, #shop-tabs button, .qs-tabs button');
    if (!b) return;
    setTimeout(function () { var sh = b.closest('.sheet'); if (sh) sh.scrollTop = 0; }, 0);
  });
  // 0.10.9 다 올린(MAX) 칸은 한 줄로 접혀 아래로 내려간다. 누르면 펼쳐 본다
  document.addEventListener('click', function (e) {
    var it = e.target.closest && e.target.closest('.shop:not(#h-support) .item');
    if (it && it.querySelector(':scope > .buy.max')) it.classList.toggle('open');
  });
  /* 0.10.11 글 속의 ◆ 는 어디에 나오든 배지 그림으로 바꾼다(창 · 알림 · 단추 모두). 글 넣는 칸은 건드리지 않는다 */
  (function () {
    var IC = window.Team3Icons; if (!IC || !window.MutationObserver) return;
    function fix(node) {
      if (node.nodeType === 3) {
        var v = node.nodeValue; if (v.indexOf('◆') < 0) return;
        var par = node.parentNode; if (!par || /^(SCRIPT|STYLE|TEXTAREA|INPUT|TITLE)$/.test(par.nodeName)) return;
        var parts = v.split(/◆\s?/), frag = document.createDocumentFragment();
        parts.forEach(function (t, i) { if (i) { var sp = document.createElement('span'); sp.className = 'gem-in'; sp.innerHTML = IC.icon('gem'); frag.appendChild(sp); } if (t) frag.appendChild(document.createTextNode(t)); });
        par.replaceChild(frag, node);
      } else if (node.nodeType === 1 && !/^(SCRIPT|STYLE|TEXTAREA|svg)$/.test(node.nodeName)) {
        var w = document.createTreeWalker(node, 4, null), list = [], n;
        while ((n = w.nextNode())) if (n.nodeValue.indexOf('◆') >= 0) list.push(n);
        list.forEach(fix);
      }
    }
    fix(document.body);
    new MutationObserver(function (ms) { ms.forEach(function (m) { if (m.type === 'characterData') fix(m.target); else for (var i = 0; i < m.addedNodes.length; i++) fix(m.addedNodes[i]); }); })
      .observe(document.body, { childList: true, subtree: true, characterData: true });
  })();
  window.Team3AttendUI = { open: openAttend, can: function () { return !!AT && AT.canCheck(save, dayNow()); } };
  // 하루 한 번, 상황실에 있을 때(창 · 출동 없음) 자동으로 띄운다
  function attendAuto() {
    if (!AT || window.__noAttendPop || !save.tutorialDone || attendShown === dayNow() || !AT.canCheck(save, dayNow())) return;
    if (!$('s-hub').classList.contains('on') || UI.sheetOpen() || (UI.playing && UI.playing()) || (MUI && MUI.current && MUI.current() !== 'home')) return;
    attendShown = dayNow(); openAttend();
  }
  UI.hooks.onTutorialDone = function () { save.tutorialDone = true; persist(); askDiffSoon(900); };
  /*
   * 0.7.0 난이도 고르기 창: 튜토리얼이 끝나면(또는 건너뛰면) 한 번. 예전 저장(고른 적 없음)은 사무실에서 한 번.
   *   다른 창이 떠 있으면 닫힐 때까지 기다렸다가 띄운다(최대 1분).
   */
  var askTimer = 0;
  function askDiffSoon(ms) {
    if (!Df || !DUI || Df.chosen(save)) return;
    clearTimeout(askTimer);
    var tries = 0;
    var tryOpen = function () {
      if (Df.chosen(save)) return;
      var upd = $('updating');
      if (UI.sheetOpen() || (UI.playing && UI.playing()) || updating || (upd && !upd.hidden) || !$('s-hub').classList.contains('on')) { if (++tries < 30) askTimer = setTimeout(tryOpen, 2000); return; }
      DUI.open('first');
    };
    askTimer = setTimeout(tryOpen, ms || 0);
  }
  // 0.7.0 수사비가 길어져 옆 칩과 부딪히면 글자를 줄인다(두 줄로 꺾지 않는다). 30px → 최소 18px
  function fitMoney() {
    var m = $('h-money'), w = m && m.parentNode; if (!w || !w.clientWidth) return;
    var room = w.parentNode.clientWidth - w.nextElementSibling.offsetWidth - 12;
    m.style.fontSize = '';
    var full = m.getBoundingClientRect().width;   // 0.8.0: 글자 칸(inline)은 scrollWidth 가 0 이라 실제 너비로 잰다
    if (full > room && room > 0) m.style.fontSize = Math.max(18, Math.floor(30 * room / full)) + 'px';
  }
  /* 0.8.2 계급(승진): 출동 탭 카드 · 머리의 계급 글자를 누르면 계급 표 */
  function renderRank() {
    var el = $('h-rank'); if (!el) return;
    var r = I.rankOf(save), cur = I.RANKS[r.index], nx = r.next;
    var pct = nx ? Math.max(0, Math.min(100, (save.runCaught - cur.at) / (nx.at - cur.at) * 100)) : 100;
    var h = '<span class="rk-badge" aria-hidden="true">🎖️</span><b>계급 <em>' + r.name + '</em><span class="rk-b">수사비 +' + Math.round(r.bonus * 100) + '%</span></b>' +
      '<small>' + (nx ? nx.name + '까지 현장 검거 ' + fmt(r.toNext) + '명' : '최고 계급이에요') + '</small><span class="rk-go">계급표 ›</span>' +
      '<span class="bar"><i style="width:' + pct.toFixed(1) + '%"></i></span>';
    if (el._h !== h) { el._h = h; el.innerHTML = h; }
  }
  function showRanks() {
    var r = I.rankOf(save);
    openInfo({ label: '계급', title: '승진하면 수사비가 늘어요', readOnly: true,
      body: '<p>현장 출동에서 <b>직접 잡은 수</b>로 승진해요(팀이 방치로 잡은 수는 안 세요). 승진할 때마다 모든 수사비 +' + Math.round(I.RANK_BONUS * 100) + '%와 배지를 받아요.</p>' +
        '<p>현재 현장 검거 <b>' + fmt(save.runCaught) + '명</b>' + (r.next ? ' ' + r.next.name + '까지 ' + fmt(r.toNext) + '명' : '') + '</p>' +
        '<div class="rk-list">' + I.RANKS.map(function (x, i) {
          return '<div class="' + (i === r.index ? 'now' : i < r.index ? 'done' : '') + '"><span>' + (i < r.index ? '✓ ' : i === r.index ? '▶ ' : '') + x.name + '</span><em>' + (x.at ? '현장 검거 ' + fmt(x.at) + '명' : '처음') + ', 수사비 +' + Math.round(i * I.RANK_BONUS * 100) + '%' + (x.gems ? ', ◆' + x.gems : '') + '</em></div>';
        }).join('') + '</div>' });
  }
  function diffGoSub() {
    if (!Df) return;
    var L = Df.info(Df.get(save)), el = $('h-go-diff');
    if (el) { el.textContent = L.icon + ' ' + L.short; el.style.setProperty('--c', L.color); el.setAttribute('aria-label', '난이도 ' + L.name + ', 바꾸기'); }
  }
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
    if (save.gems < I.NAME_TAGS.gems) { UI.toast('배지가 모자라요, ◆' + I.NAME_TAGS.gems + ' 필요'); return; }
    UI.confirmBuy({ title: '이름표 ' + I.NAME_TAGS.n + '장을 살까요?', body: '이름표 1장으로 경찰서, 팀장, 파트너 이름을 한 번 바꿔요.',
      cost: (window.Team3Icons ? window.Team3Icons.icon('gem') : '◆') + I.NAME_TAGS.gems, onOk: function () {
        try { I.buyNameTags(save); persist(); render(); UI.sfx.coin(); UI.toast('이름표 ' + I.NAME_TAGS.n + '장을 샀어요'); } catch (err) { UI.toast('배지가 모자라요'); }
        editProfile(keep);
      } });
  });
  $('h-hire').addEventListener('click', function () { tryBuy('hire'); });
  $('h-trainb').addEventListener('click', function () { tryBuy('train'); });
  $('h-gear').addEventListener('click', function (e) {
    var b = e.target.closest('[data-gear]');
    if (b && !b.disabled) tryBuy(b.getAttribute('data-gear'));
  });
  $('h-story-all').addEventListener('click', showStory);
  $('s-hub').addEventListener('scroll', miniScroll, { passive: true });
  $('h-mini').addEventListener('click', function () { $('s-hub').scrollTo({ top: 0, behavior: 'smooth' }); });   // 붙는 줄을 누르면 맨 위로
  $('h-next-case').addEventListener('click', function () { if (I.nextCase(save)) goNextCase(); });
  if (E) {
    $('h-prep-help').addEventListener('click', showPrepHelp);
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
  // 0.9.1 창(.sheet)을 내렸는지 표시 → 닫기(×) 뒤에 띠를 깐다(글이 × 밑으로 지나가게)
  document.addEventListener('scroll', function (e) {
    var t = e.target;
    if (t && t.classList && t.classList.contains('sheet')) t.classList.toggle('scrolled', t.scrollTop > 8);
  }, true);
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!$('info-sheet').hidden) closeInfo('cancel');
    else if (PUI && PUI.isOpen()) PUI.close();
    else if (AUI && AUI.isOpen()) AUI.close();
    else if (SUI && SUI.isOpen()) SUI.close();
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
    var body = '<div class="pn pn-new"><div class="pn-head"><span class="new">NEW</span><b>' + esc(cur.ver) + '</b><span class="pn-title">' + esc(cur.title) + '</span></div>' + lines(cur.items) + '</div>';
    if (N.length > 1) {
      body += '<span class="pn-past">지난 패치노트</span>' + N.slice(1).map(function (n) {
        return '<details class="pn"><summary><b>' + esc(n.ver) + '</b><span class="pn-title">' + esc(n.title) + '</span></summary><div class="pn-body">' + lines(n.items) + '</div></details>';
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
    $('h-version').innerHTML = '수사 3팀 ' + esc(VERSION) + ', 패치노트' + (unseen ? ' <span class="new" style="height:18px;font-size:10px;margin-left:4px">NEW</span>' : '');
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
    if (DUI && DUI.isOpen()) { if (Df.chosen(save)) DUI.close(); return 'stay'; }   // 처음 고르는 창은 뒤로로 닫히지 않는다
    if (PUI && PUI.isOpen()) { PUI.close(); return 'stay'; }
    if (AUI && AUI.isOpen()) { AUI.close(); return 'stay'; }
    if (SUI && SUI.isOpen()) { SUI.close(); return 'stay'; }
    // 0.8.0 사무실이면: 열었던 탭을 하나씩 되돌아가고, 상황실이면 앱에 맡긴다(두 번 눌러 종료)
    if (MUI && $('s-hub').classList.contains('on') && !UI.sheetOpen() && MUI.back()) return 'stay';
    return UI.back();
  };

  /*
   * 0.8.0 누르기 씹힘 고침: 사무실 칸들(장비 · 준비물 · 지원 · 부서)은 1초마다 다시 그린다. 내용이 같아도 innerHTML 을 새로 넣으면
   *   손가락을 누르는 사이 단추가 새 단추로 바뀌어 click 이 사라졌다("부서 하나 살 때 반응이 느려"). 내용이 바뀔 때만 다시 넣는다.
   */
  function guardHTML(id) {
    var el = $(id), d = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if (!el || !d || el._guard) return;
    el._guard = true;
    Object.defineProperty(el, 'innerHTML', { configurable: true,
      get: function () { return d.get.call(el); },
      set: function (v) { if (el._h === v) return; el._h = v; d.set.call(el, v); } });
  }
  ['h-gear', 'h-prep', 'h-prep-now', 'h-medals', 'h-support', 'h-dept', 'h-dept-mode', 'h-retreat'].forEach(guardHTML);   // h-crew · h-kit · h-tech 는 crewui.js 가 스스로 막는다

  /* ---------- 시작 ---------- */
  var loaded = loadSave();
  save = loaded.save;
  petsReady();   // 동물 저장 검사는 자리 비움 계산(한도 효과) 전에
  var away = I.advance(save, nowMs(), { offline: true });   // 앱을 끈 사이 = 자리 비움(절반 속도, 4시간까지)
  if (OF && away.catches) OF.addCatches(save, away.catches);   // 0.6.0 자리를 비운 동안 잡은 사람도 유치장에(돌아와서 이송하는 맛)
  persist();
  // 창 모듈을 먼저 붙인다(첫 render 의 업적 확인이 알림을 띄울 수 있게)
  if (PUI) PUI.mount({ getSave: function () { return save; }, persist: persist, render: render, UI: UI, freeExtra: function () { return M ? M.perks(save, nowMs()).freePulls : 0; } });
  if (AUI) AUI.mount({ getSave: function () { return save; }, persist: persist, render: render, UI: UI });
  if (EUI) EUI.mount({ getSave: function () { return save; }, persist: persist, render: render, UI: UI, idle: I, nowMs: nowMs, deptMult: deptMult, openInfo: openInfo,
    showTab: function (t) { if (MUI) MUI.go(t); },
    incomePerSec: function (sv) { return I.incomePerMin(sv, nowMs()) / 60 + (Dp ? Dp.perSec(sv, deptMult(sv)) : 0); },
    onRetreat: function () { applyTheme(); if (PUI) PUI.renderPartner(); } });
  if (OUI) OUI.mount({ getSave: function () { return save; }, persist: persist, render: render, UI: UI, idle: I, pets: PT, art: window.Team3PetArt, petsUI: PUI, openInfo: openInfo, dayNow: dayNow,
    progress: function () { return I.progress(save); }, capped: function () { return I.idleCapped(save); }, buffed: function (t) { return I.buffed(save, t); } });
  if (DUI) DUI.mount({ getSave: function () { return save; }, persist: persist, render: render, UI: UI });
  // 0.8.0 아래 메뉴(탭 · 뒤로 · 밀기 · 메뉴 숫자 · 오늘 할 일 · 추천 · 출동 기록 · 파트너 탭)
  if (CUI) CUI.mount({ getSave: function () { return save; }, persist: persist, render: render, UI: UI, fmt: fmt, fmtShort: fmtShort, bonus: function () { return petBonus(save); }, showTab: function (t) { if (MUI) MUI.go(t); } });
  if (MUI) MUI.mount({ getSave: function () { return save; }, persist: persist, render: render, UI: UI, I: I, Cr: Cr, CUI: CUI, E: E, PT: PT, PUI: PUI, SUI: SUI, AUI: AUI, EUI: EUI, Ev: Ev, Dp: Dp, Df: Df, H: H, OF: OF, M: M,
    deptMult: deptMult, nowMs: nowMs, dayNow: dayNow, fmt: fmt, fmtShort: fmtShort, freeExtra: function () { return M ? M.perks(save, nowMs()).freePulls : 0; } });
  if ($('h-pass')) $('h-pass').addEventListener('click', function () { if (SUI && SUI.open) SUI.open('pass'); });
  if ($('h-prem')) $('h-prem').addEventListener('click', function () { if (SUI && SUI.open) SUI.open('pass'); });
  if (SUI) SUI.mount({ getSave: function () { return save; }, persist: persist, render: render, UI: UI, grant: grant, freeParty: freeParty, day: dayNow, openInfo: openInfo });
  // 출동 결과의 "수사비 2배 받기"(광고 자리): 한 번만
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#res-double');
    if (!b || !lastDouble || !SUI) return;
    var amt = lastDouble.amt;
    b.disabled = true;
    SUI.watch('double', function () {
      if (!lastDouble) return;
      lastDouble = null;
      save.money += amt;
      b.innerHTML = '<b>수사비 +' + fmt(amt) + ' 더 받았어요 ✓</b>'; b.classList.add('got');
      UI.sfx.coin();
    });
    setTimeout(function () { if (lastDouble) b.disabled = false; }, 3600);   // 광고를 못 끝냈으면 다시 누를 수 있게
  });
  render();
  applyTheme();
  UI.show('s-hub');
  if (loaded.reset) UI.toast('저장을 읽지 못해 처음부터 시작해요');

  if (away.seconds >= 60 && away.catches > 0) {
    // 잠복 보고: 자리를 비운 동안 팀이 한 일
    openInfo({
      label: '잠복 보고', title: fmtDur(away.seconds) + ' 동안',
      body: p('3팀이 용의자 <b style="color:var(--acc)">' + fmt(away.catches) + '명</b>을 잡았어요.') +
        p('수사비 <b style="color:var(--acc)">+' + fmt(away.money) + '</b>' + (away.dept ? ' <span class="muted">(부서 +' + fmt(away.dept) + ')</span>' : '')) +
        (away.night ? p('<span style="color:var(--acc);font-weight:700">야간 잠복조 투입: 이번엔 ' + (I.TUNE.nightCapSec / 3600) + '시간까지 셌어요</span>') : '') +
        p('<span class="muted">자리를 비운 동안 팀은 절반 속도로 일하고, ' + fmtDur(away.cap || I.TUNE.offlineCapSec) + '까지만 세요' + (away.cap > I.TUNE.offlineCapSec && !away.night ? '(파트너 효과로 늘어남)' : '') + '.' +
          (!away.night && away.seconds >= (away.cap || I.TUNE.offlineCapSec) ? ' 이번엔 꽉 찼어요. 지원의 야간 잠복조를 사 두면 다음엔 ' + (I.TUNE.nightCapSec / 3600) + '시간까지 세요.' : '') + '</span>') +
        (away.counted < away.catches ? p('<span class="muted">남은 주범 조는 현장 출동으로만 잡을 수 있어요.</span>') : ''),
      ok: '좋아요',
      onOk: function () { if (pendingClose || away.closedNow) showCaseClosed(); else showPromotions(); },
      // 0.10.3 광고 보고 자리 비움 수사비를 한 번 더(2배)
      cancel: away.money > 0 && SUI && SUI.watch ? '▶ 광고 보고 수사비 2배' : null,
      onCancel: function () {
        SUI.watch('away', function () { save.money += away.money; persist(); render(); UI.toast('잠복 보고 수사비 2배! +' + fmt(away.money)); });
        if (pendingClose || away.closedNow) showCaseClosed(); else showPromotions();
      }
    });
  } else if (!save.tutorialDone && save.runs === 0) {
    // 처음 켬: 사건 소개 + 튜토리얼 권유(시작 편을 보여 주므로 읽음으로 친다)
    I.markStorySeen(save); persist(); renderStoryButton();
    // 0.11.0 시작 장면(프롤로그 + 사건 1)을 먼저 보여 주고, 끝나면 튜토리얼을 권한다
    introScene(function () {
      openInfo({
        label: '사건 ' + CS().no, title: CS().title,
        body: p('현장 출동은 용의자 카드에서 범인 세 명을 찾는 퍼즐이에요.') + p('<span class="muted">이런 퍼즐이 처음이면 1분짜리 튜토리얼부터 해 보세요.</span>'),
        ok: '튜토리얼 하기', cancel: '바로 사무실로',
        onOk: UI.openTutorial,
        onCancel: function () { save.tutorialDone = true; persist(); askDiffSoon(600); }
      });
    });
  } else if (away.closedNow) {
    showCaseClosed();
  } else {
    showPromotions();   // 업데이트로 계급이 생긴 예전 저장: 그동안 잡은 만큼의 승진을 한 번에(0.1.19)
  }

  // 0.7.0 난이도: 예전 저장(튜토리얼을 마쳤거나 출동해 봤는데 고른 적 없음)은 사무실에서 한 번 묻는다
  if (save.tutorialDone || save.runs > 0) askDiffSoon(2500);

  // 버전 표시 · 업데이트 뒤 첫 실행 알림 · 새 버전 확인
  renderVersionButton();
  var seen = lsGet(SEEN_KEY);
  if (seen && seen !== VERSION && installed) setTimeout(function () { UI.toast(VERSION + '으로 업데이트됐어요, 맨 아래 패치노트에서 확인'); }, 3200);
  lsSet(SEEN_KEY, VERSION);
  registerSW();
  setTimeout(function () { checkUpdate(true); }, 3000);
  setInterval(function () { checkUpdate(true); }, 30 * 60 * 1000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) checkUpdate(false); });

  setInterval(tick, 1000);
})();
