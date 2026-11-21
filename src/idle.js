/*
 * SuspectsIdle — "수사 3팀" 방치 층의 순수 로직(화면·저장소와 무관).
 *
 * 고리: 형사(팀)가 쉬지 않고 용의자를 잡아 수사비를 번다(자리를 비워도 = 잠복)
 *      → 수사비로 형사를 들이고, 훈련시키고, 현장 출동을 돕는 장비를 산다
 *      → 내가 직접 출동(퍼즐)하면 크게 벌고 많이 잡고, 팀 사기가 올라 잠시 2배로 일한다
 *      → 누적 검거가 목표에 닿으면 사건 종결.
 *
 * 저장 형식(save)은 평범한 객체라 JSON 으로 그대로 저장한다. 읽을 때 load() 가 값을 하나하나 검사해
 * 깨진 저장이 들어와도 게임이 멈추지 않는다(모르는 값은 기본값으로).
 * 시각(now)은 모두 밀리초(Date.now()). 테스트는 숫자를 직접 넣는다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SuspectsIdle = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = 1;

  // 수치는 모두 여기. 밸런스를 바꿀 때 이 표만 고친다.
  var TUNE = {
    catchSec: 150,           // 형사 1명이 1명을 잡는 데 걸리는 시간(초), 훈련 전. 0.1.6: 60 → 150(사건 1을 하루~이틀로)
    trainSpeed: 0.25,        // 훈련 1단계당 속도 +25%
    catchPay: 15,            // 팀이 1명 잡을 때 수사비
    trainPay: 0.5,           // 훈련 1단계당 수사비 +50%
    buffSec: 120,            // 출동 뒤 팀 사기 충전 시간(초)
    buffMult: 2,             // 사기 충전 중 팀 속도 배수
    offlineCapSec: 4 * 3600, // 0.1.6: 자리를 비운(앱을 끈) 시간은 4시간까지만 센다(8 → 4)
    offlineRate: 0.5,        // 0.1.6: 자리를 비운 동안 팀은 절반 속도로 일한다(켜 두면 100%)
    hireBase: 300, hireGrowth: 2.1,     // 0.1.6: 1.55 → 2.1(형사가 끝없이 늘어 검거 간격이 0초 가까이 되지 않게)
    trainBase: 600, trainGrowth: 2.7, trainMax: 10   // 0.1.6: 2 → 2.7
  };

  // 출동을 돕는 장비. lvMax 까지 살 수 있고 단계마다 값이 다르다.
  var GEAR = {
    time:    { name: '수사 기간 연장', desc: '현장 출동 시간 +10초', costs: [800, 2400, 7200] },
    veteran: { name: '베테랑 형사',   desc: '출동마다 무료 단서 +1번', costs: [1500, 6000] },
    lab:     { name: '감식반',       desc: '네 가지일 때도 셋째 조건 표시', costs: [3000] },
    vault:   { name: '증거 보관실',   desc: '검거 불가 오판 벌점 10초 → 5초', costs: [4000] }
  };
  var GEAR_KEYS = ['time', 'veteran', 'lab', 'vault'];

  // 사건 1. 이야기는 누적 검거가 at 에 닿을 때마다 하나씩 열린다.
  var CASE = {
    no: 1,
    title: '골목길 연쇄 절도',
    goal: 3000,          // 0.1.3: 300 → 1000, 0.1.8: 1000 → 3000(3팀의 3. 이야기는 6편)
    idleCap: 2500,       // 0.1.6: 팀(방치)이 올릴 수 있는 사건 진척은 여기까지(0.1.8: 800 → 2500). 나머지(주범 조)는 현장 출동으로만 잡는다
    // 0.1.9: 여는 시점마다 뜻이 있다 — 300 = 100번째 조, 1000 = 첫 천 명, 1500 = 절반,
    //        2500 = 팀(방치)이 혼자 잡을 수 있는 한계(idleCap, 그래서 남은 건 현장에서만), 3000 = 1000번째 조·종결.
    // 0.1.8: 일지는 문단으로 쓰고 화면 폭에 맞춰 자연스럽게 줄이 넘어가게 한다(억지 줄바꿈 없음).
    //        앞 편에서 알게 된 것만 다음 편에서 쓴다: 시킨 자 → 짝 짓는 규칙 → "설계자"·쪽지 → 쪽지를 쫓은 사무실·손글씨 → 같은 손글씨의 "써드".
    //        "써드"는 마지막 편(3000명)에서야 나온다. 진짜 이름은 사건 2 이후에 밝힌다. 패치노트에는 이야기 내용(스포일러)을 적지 않는다.
    story: [
      { at: 0, text: '새벽 세 시, 골목 상가 여섯 곳이 한꺼번에 털렸다. 비슷한 사건이 꼬리를 물었고, CCTV에는 늘 세 명이 찍혔다. 매번 다른 얼굴이었다. 서장이 파일을 내 책상에 내려놓았다. "3팀이 맡아."' },
      { at: 300, text: '잡혀 온 놈들은 약속이라도 한 듯 같은 말을 했다. "시키는 대로 했을 뿐이에요." 누가 시켰느냐고 물으면 입을 닫았다. 놈들이 겁내는 건 우리가 아니었다.' },
      { at: 1000, text: '잡힌 놈들을 조별로 늘어놓자 규칙이 보였다. 모자, 얼굴, 시간대, 흔적. 한 조의 세 명은 어느 것이든 모두 같거나 모두 달랐다. 둘만 같은 조는 한 번도 없었다. 누군가 일부러 짝을 짓고 있었다.' },
      { at: 1500, text: '조를 짜고 지시를 내리는 자가 따로 있었다. 놈들은 그를 "설계자"라고 불렀다. 얼굴을 본 놈도, 목소리를 들은 놈도 없었다. 지시는 늘 쪽지로만 왔다고 했다.' },
      { at: 2500, text: '쪽지가 오가던 길을 거슬러 낡은 사무실 하나를 찾아냈다. 문을 열었을 땐 이미 아무도 없었다. 벽에는 우리 3팀 형사들의 사진이 세 장씩 짝지어 붙어 있었고, 사진 아래에는 손글씨로 조 번호가 적혀 있었다. 설계자는 우리를 지켜보고 있었다. 남은 놈들은 설계자 곁을 지키는 자들이다. 책상에서 기다려서는 잡을 수 없다.' },
      { at: 3000, text: '마지막 조를 넘기고 사건을 닫던 날 밤, 내 책상 위에 봉투 하나가 놓여 있었다. 안에는 다른 도시의 지도 한 장과 쪽지 한 장. 글씨는 그때의 낡은 사무실 벽에 적힌 손글씨와 같았다. "다음 판도 내가 짠다. — 써드" 설계자가 처음 남긴 이름이다. 세 번째. 우리 팀 번호와 같다. 진짜 이름인지는 아직 알 수 없다.\n— 사건 2에서 계속' }
    ]


  };

  // 프로필(사무실 위에 보이는 내 자리). 게임 이름인 "수사 3팀"은 바꾸지 않고, 경찰서와 팀장 이름만 바꾼다.
  var PROFILE = { stationMax: 8, leaderMax: 8, defaultStation: '중앙서', defaultLeader: '' };

  /*
   * 이름 다듬기: 앞뒤 공백·줄바꿈·제어 문자와 < > 를 빼고 길이를 자른다(글자 단위, 한글·이모지 안전).
   * 화면은 textContent 로만 넣지만, 저장에 이상한 값이 남지 않게 여기서도 막는다.
   */
  function cleanName(v, max, def) {
    if (typeof v !== 'string') return def;
    // 줄바꿈·탭은 먼저 띄어쓰기로 바꾸고(낱말이 붙지 않게), 남은 제어 문자와 < > 는 뺀다
    var s = v.replace(/\s+/g, ' ').replace(/[\u0000-\u001f\u007f<>]/g, '').trim();
    var chars = Array.from(s).slice(0, max).join('');
    return chars || def;
  }

  function IdleError(code, message) {
    var e = new Error(message);
    e.name = 'IdleError';
    e.code = code;
    return e;
  }

  function assertNow(now) {
    if (typeof now !== 'number' || !isFinite(now)) throw IdleError('BAD_TIME', 'now 는 밀리초 숫자여야 한다');
  }

  function newSave(now) {
    assertNow(now);
    return {
      v: VERSION,
      money: 0,
      caught: 0,           // 사건 1 누적 검거(팀 + 출동)
      frac: 0,             // 팀이 잡다 만 몫(0~1)
      detectives: 1,       // 처음부터 1명(나 말고 동료 한 명)
      training: 0,
      gear: { time: 0, veteran: 0, lab: 0, vault: 0 },
      lastSeen: now,
      buffUntil: 0,
      runs: 0, bestScore: 0, runCaught: 0, teamCaught: 0,
      closed: false, closedAt: 0,
      tutorialDone: false,
      storySeen: 0,        // 수사 일지에서 읽은 편 수(새 편이 열리면 "수사 일지 보기"에 NEW)
      profile: { station: PROFILE.defaultStation, leader: PROFILE.defaultLeader }
    };
  }

  // 저장 값 검사 도우미: 유한한 숫자가 아니면 기본값, 범위 밖이면 잘라 낸다
  function num(v, def, min, max) {
    if (typeof v !== 'number' || !isFinite(v)) return def;
    if (min != null && v < min) return min;
    if (max != null && v > max) return max;
    return v;
  }
  function int(v, def, min, max) { return Math.floor(num(v, def, min, max)); }

  /*
   * 저장 문자열(또는 객체)을 읽는다. 깨졌거나 모르는 형식이면 새 저장으로 시작하고 reset 을 알려 준다.
   * 반환: { save, reset: bool }
   */
  function load(raw, now) {
    assertNow(now);
    var data = raw;
    if (typeof raw === 'string') {
      try { data = JSON.parse(raw); } catch (e) { return { save: newSave(now), reset: true }; }
    }
    if (!data || typeof data !== 'object' || data.v !== VERSION) {
      return { save: newSave(now), reset: raw != null && raw !== '' };
    }
    var s = newSave(now), g = data.gear && typeof data.gear === 'object' ? data.gear : {};
    s.money = num(data.money, 0, 0);
    s.caught = int(data.caught, 0, 0);
    s.frac = num(data.frac, 0, 0, 0.999999);
    s.detectives = int(data.detectives, 1, 1, 999);
    s.training = int(data.training, 0, 0, TUNE.trainMax);
    GEAR_KEYS.forEach(function (k) { s.gear[k] = int(g[k], 0, 0, GEAR[k].costs.length); });
    s.lastSeen = num(data.lastSeen, now, 0);
    s.buffUntil = num(data.buffUntil, 0, 0);
    s.runs = int(data.runs, 0, 0);
    s.bestScore = int(data.bestScore, 0, 0);
    s.runCaught = int(data.runCaught, 0, 0);
    s.teamCaught = int(data.teamCaught, 0, 0);
    // 목표가 늘어난 뒤(0.1.3, 300 → 1000) 예전에 300명으로 종결된 저장은 다시 진행 중으로 돌린다
    s.closed = data.closed === true && s.caught >= CASE.goal;
    s.closedAt = num(data.closedAt, 0, 0);
    s.tutorialDone = data.tutorialDone === true;
    s.storySeen = int(data.storySeen, 0, 0, CASE.story.length);
    var pf = data.profile && typeof data.profile === 'object' ? data.profile : {};
    s.profile = {
      station: cleanName(pf.station, PROFILE.stationMax, PROFILE.defaultStation),
      leader: cleanName(pf.leader, PROFILE.leaderMax, PROFILE.defaultLeader)
    };
    return { save: s, reset: false };
  }

  function serialize(save) { return JSON.stringify(save); }

  /* ---------- 팀 ---------- */
  // 팀 전체가 1초에 잡는 수(사기 충전 제외)
  function teamRate(save) {
    return save.detectives * (1 / TUNE.catchSec) * (1 + TUNE.trainSpeed * save.training);
  }
  function payPerCatch(save) {
    return Math.round(TUNE.catchPay * (1 + TUNE.trainPay * save.training));
  }
  function buffed(save, now) { return save.buffUntil > now; }

  /*
   * 다음 검거까지 남은 초(1.4). 잡다 만 몫(frac)이 1 이 되는 데 걸리는 시간.
   * 사기 충전 중이면 그 속도로 세고, 충전이 중간에 끝나면 남은 몫은 보통 속도로 센다.
   * 화면의 "다음 검거까지" 줄과 남은 초에 쓴다. 반환: { sec, frac }
   */
  function nextCatch(save, now) {
    var need = 1 - save.frac, base = teamRate(save);
    if (!(base > 0)) return { sec: Infinity, frac: save.frac };
    var buffLeft = Math.max(0, (save.buffUntil - now) / 1000), fast = base * TUNE.buffMult;
    var sec = need <= fast * buffLeft ? need / fast : buffLeft + (need - fast * buffLeft) / base;
    return { sec: sec, frac: save.frac };
  }

  function checkClose(save, now) {
    if (!save.closed && save.caught >= CASE.goal) {
      save.closed = true;
      save.closedAt = now;
      return true;
    }
    return false;
  }

  /*
   * 지난 저장 뒤로 흐른 시간만큼 팀이 일한 결과를 반영한다(화면에서는 1초마다, 켤 때 한 번 크게).
   *   흐른 시간은 offlineCapSec 까지만 센다. 시계가 뒤로 갔으면(기기 시간 변경) 아무 일도 없다.
   *   opts.offline = true 면 "자리를 비운 동안"(앱을 끄거나 내려 둔 사이)이라 offlineRate 배로만 센다.
   *     켜 둔 동안(1초마다 tick, 출동 앞뒤)은 기본값 false 로 100% 센다.
   *   사기 충전이 겹친 구간은 buffMult 배로 센다.
   * 반환: { seconds, catches, money, closedNow }
   */
  function advance(save, now, opts) {
    assertNow(now);
    var offline = !!(opts && opts.offline);
    var dt = (now - save.lastSeen) / 1000;
    save.lastSeen = now;
    if (!(dt > 0)) return { seconds: 0, catches: 0, money: 0, closedNow: false };
    dt = Math.min(dt, TUNE.offlineCapSec);
    var start = now - dt * 1000;
    var buffSec = Math.max(0, Math.min(save.buffUntil, now) - start) / 1000;
    buffSec = Math.min(buffSec, dt);
    var effSec = ((dt - buffSec) + buffSec * TUNE.buffMult) * (offline ? TUNE.offlineRate : 1);
    var total = save.frac + teamRate(save) * effSec;
    var whole = Math.floor(total);
    save.frac = total - whole;
    var money = whole * payPerCatch(save);
    save.money += money;                       // 수사비는 상한과 상관없이 잡은 만큼 다 들어온다
    // 사건 진척은 idleCap 까지만(이미 넘었으면 0). 출동으로 넘긴 몫은 깎지 않는다
    var room = Math.max(0, CASE.idleCap - save.caught);
    var counted = Math.min(whole, room);
    save.caught += counted;
    save.teamCaught += whole;
    return { seconds: dt, offline: offline, catches: whole, counted: counted, money: money, closedNow: checkClose(save, now) };
  }

  /* ---------- 사기 ---------- */
  // 값(null = 더 못 산다)
  function cost(save, kind) {
    if (kind === 'hire') return Math.round(TUNE.hireBase * Math.pow(TUNE.hireGrowth, save.detectives - 1));
    if (kind === 'train') return save.training >= TUNE.trainMax ? null : Math.round(TUNE.trainBase * Math.pow(TUNE.trainGrowth, save.training));
    var g = GEAR[kind];
    if (!g) throw IdleError('BAD_KIND', '모르는 항목: ' + kind);
    return save.gear[kind] >= g.costs.length ? null : g.costs[save.gear[kind]];
  }

  function buy(save, kind) {
    var c = cost(save, kind);
    if (c == null) throw IdleError('MAXED', '더 살 수 없다: ' + kind);
    if (save.money < c) throw IdleError('NOT_ENOUGH', '수사비가 모자란다');
    save.money -= c;
    if (kind === 'hire') save.detectives += 1;
    else if (kind === 'train') save.training += 1;
    else save.gear[kind] += 1;
    return c;
  }

  /* ---------- 현장 출동 ---------- */
  // 장비가 출동(퍼즐 한 판)에 주는 효과 → SuspectsCore.createGame 옵션
  function runOptions(save) {
    return {
      duration: 90 + 10 * save.gear.time,
      freeHints: save.gear.veteran,
      nonePenalty: save.gear.vault ? 5 : 10,
      level: 1,
      helperAtFull: save.gear.lab > 0
    };
  }

  /*
   * 출동이 끝났을 때. result = { score, hits } (퍼즐 게임 상태에서 그대로 넘긴다)
   * 점수만큼 수사비, 검거만큼 사건 진척, 그리고 팀 사기 충전.
   */
  function applyRun(save, result, now) {
    assertNow(now);
    if (!result || typeof result !== 'object') throw IdleError('BAD_RESULT', '출동 결과가 없다');
    var score = int(result.score, -1, -1), hits = int(result.hits, -1, -1);
    if (score < 0 || hits < 0) throw IdleError('BAD_RESULT', '점수·검거 수는 0 이상 정수');
    save.money += score;
    save.caught += hits;
    save.runCaught += hits;
    save.runs += 1;
    var best = score > save.bestScore;
    if (best) save.bestScore = score;
    save.buffUntil = now + TUNE.buffSec * 1000;
    return { money: score, caught: hits, best: best, closedNow: checkClose(save, now) };
  }

  /* ---------- 프로필 ---------- */
  // 바꾼 값을 다듬어 넣는다. 경찰서를 비우면 기본값, 팀장은 비워도 된다.
  function setProfile(save, station, leader) {
    save.profile = {
      station: cleanName(station, PROFILE.stationMax, PROFILE.defaultStation),
      leader: cleanName(leader, PROFILE.leaderMax, PROFILE.defaultLeader)
    };
    return save.profile;
  }

  /* ---------- 사건 ---------- */
  function storyUnlocked(save) {
    return CASE.story.filter(function (e) { return save.caught >= e.at; });
  }
  function progress(save) { return Math.min(1, save.caught / CASE.goal); }
  /*
   * 지금 팀이 1분에 버는 수사비(사기 충전 중이면 그 배수까지). 자리 비움 절반은 넣지 않는다(켜 둔 화면에 쓰는 값).
   *   형사가 늘면 1명당 값은 그대로지만 잡는 수가 늘어 이 값이 오른다 — 화면에서 이걸 보여 줘야 덜 헷갈린다.
   */
  function incomePerMin(save, now) {
    return teamRate(save) * 60 * (buffed(save, now) ? TUNE.buffMult : 1) * payPerCatch(save);
  }
  // 검거 간격이 이보다 짧으면 "다음 검거까지" 막대 대신 "1초에 N명"으로 보여 준다(막대가 깜빡이지 않게)
  var FAST_SEC = 1.5;
  // 한 명을 잡는 데 지금 걸리는 시간(초) = 1 / 지금 속도
  function catchInterval(save, now) {
    var r = teamRate(save) * (buffed(save, now) ? TUNE.buffMult : 1);
    return r > 0 ? 1 / r : Infinity;
  }
  function isStreaming(save, now) { return catchInterval(save, now) < FAST_SEC; }

  // 팀(방치)으로는 더 못 올리고 출동으로만 남은 걸 잡을 수 있는 상태인가
  function idleCapped(save) { return !save.closed && save.caught >= CASE.idleCap; }
  // 열렸지만 아직 안 읽은 편이 있는가 / 지금 열린 편까지 읽었다고 적기
  function storyUnread(save) { return storyUnlocked(save).length > save.storySeen; }
  function markStorySeen(save) { save.storySeen = storyUnlocked(save).length; return save.storySeen; }

  return {
    VERSION: VERSION, TUNE: TUNE, GEAR: GEAR, GEAR_KEYS: GEAR_KEYS, CASE: CASE, PROFILE: PROFILE,
    cleanName: cleanName, setProfile: setProfile,
    newSave: newSave, load: load, serialize: serialize,
    teamRate: teamRate, payPerCatch: payPerCatch, buffed: buffed, advance: advance, nextCatch: nextCatch,
    idleCapped: idleCapped, incomePerMin: incomePerMin, catchInterval: catchInterval, isStreaming: isStreaming, cost: cost, buy: buy, runOptions: runOptions, applyRun: applyRun,
    storyUnlocked: storyUnlocked, progress: progress, storyUnread: storyUnread, markStorySeen: markStorySeen
  };
});
