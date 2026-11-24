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
    trainBase: 600, trainGrowth: 2.7, trainMax: 10,  // 0.1.6: 2 → 2.7
    // 0.1.19 지원 상품
    partySec: 30 * 60,       // 팀 회식: 30분 동안 팀이 buffMult 배(사기 충전과 겹쳐도 2배 — 곱하지 않는다)
    nightCapSec: 8 * 3600,   // 야간 잠복조: 다음 자리 비움 한 번의 한도 4 → 8시간
    nightMinSec: 10 * 60     // 이보다 짧게 비운 건 '자리 비움'으로 치지 않아 야간 잠복조를 쓰지 않는다
  };

  /*
   * 계급(0.1.19). 플레이어는 처음부터 3팀 팀장이라 경위에서 시작한다.
   *   직접 출동해서 잡은 수(runCaught)로 오르고, 한 계단마다 수사비(팀·출동 모두) +5%.
   *   gems: 처음 그 계급에 오를 때 받는 배지(유료 재화와 같은 것을 무료로 조금씩 준다)
   */
  var RANKS = [
    { name: '경위', at: 0, gems: 0 },
    { name: '경감', at: 150, gems: 10 },
    { name: '경정', at: 500, gems: 20 },
    { name: '총경', at: 1500, gems: 30 },
    { name: '경무관', at: 4000, gems: 50 }
  ];
  var RANK_BONUS = 0.05;

  // 출동을 돕는 장비. lvMax 까지 살 수 있고 단계마다 값이 다르다.
  /*
   * case: 그 사건의 퍼즐에서만 쓰는 장비(사무실에서도 그 사건일 때만 보인다). 없으면 모든 사건 공용.
   *   0.2.0: 사건 2(목격자 진술) 장비 셋 — 녹음기·등대지기·부두 정보원.
   */
  var GEAR = {
    time:    { name: '수사 기간 연장', desc: '현장 출동 시간 +10초', costs: [800, 2400, 7200] },
    veteran: { name: '베테랑 형사',   desc: '출동마다 무료 단서 +1번', costs: [1500, 6000] },
    lab:     { name: '감식반',       desc: '네 가지일 때도 셋째 조건 표시', costs: [3000], case: 1 },
    vault:   { name: '증거 보관실',   desc: '검거 불가 오판 벌점 10초 → 5초', costs: [4000], case: 1 },
    recorder:  { name: '진술 녹음기',  desc: '함정 체포 벌점 8초 → 5초 → 2초', costs: [6000, 18000], case: 2 },
    keeper:    { name: '등대지기',     desc: '등대 빛이 지나갈 때 거짓 진술이 잠깐 빛나요', costs: [25000], case: 2 },
    informant: { name: '부두 정보원',  desc: '검거하면 시간 +1초씩 더(최대 +3초)', costs: [9000, 27000, 81000], case: 2 },
    // 0.5.0: 사건 3(면통 라인업) 장비 셋
    painter:   { name: '몽타주 화가',  desc: '줄마다 아닌 사람 하나를 미리 지워 줘요', costs: [40000], case: 3 },
    lights:    { name: '조명 기사',    desc: '오인 지목 벌점 5초 → 3초 → 1초', costs: [15000, 45000], case: 3 },
    witness2:  { name: '베테랑 증인',  desc: '검거하면 시간 +1초씩 더(최대 +3초)', costs: [16000, 48000, 144000], case: 3 }
  };
  var GEAR_KEYS = ['time', 'veteran', 'lab', 'vault', 'recorder', 'keeper', 'informant', 'painter', 'lights', 'witness2'];
  // 이 사건에서 보이는(쓸 수 있는) 장비
  function gearFor(save) { var n = caseOf(save).no; return GEAR_KEYS.filter(function (k) { return !GEAR[k].case || GEAR[k].case === n; }); }

  // 사건 1. 이야기는 누적 검거가 at 에 닿을 때마다 하나씩 열린다.
  var CASE = {
    no: 1,
    title: '골목길 연쇄 절도',
    city: '중앙서',      // 0.2.0: 사건마다 무대(사무실 머리말·파견 연출)
    mode: 'set',         // 0.2.0: 현장 출동 퍼즐 — set = 한 패 찾기(core.js)
    pay: 1,              // 0.2.0: 팀 수사비 배수(사건이 바뀌면 커져 영입·훈련에 다시 쓸 곳이 생긴다)
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

  /*
   * 사건 2 "안개 속 목격자들"(0.2.0) — 무대는 해무항. 현장 출동 퍼즐은 목격자 진술(witness.js).
   *   여는 시점: 0 = 파견, 500 = 고른 실수, 1500 = 쪽지, 2500 = 밀수 상자, 4000 = 팀 한계(남은 건 배 위 주범 조), 5000 = 종결.
   *   써드의 진짜 이름은 아직 밝히지 않는다(3팀과 관련된 사람이라는 단서만). 패치노트에 이야기를 적지 않는다.
   */
  var CASE2 = {
    no: 2,
    title: '안개 속 목격자들',
    city: '해무항',
    mode: 'witness',
    pay: 3,
    goal: 5000,
    idleCap: 4000,
    story: [
      { at: 0, text: '써드가 남긴 지도의 붉은 점은 해무항 부두를 가리키고 있었다. 1년의 절반이 바다 안개에 잠기는 도시. 우리가 도착한 날에도 창고 여섯 동이 털렸고, 목격자는 넘쳐났다. 문제는 그들의 말이 하나같이 조금씩 어긋난다는 것이었다. 해무항 경찰서장이 우리를 맞으며 말했다. "안개 속에서 본 건 다 반쯤 거짓말이오. 그걸 가려내는 게 당신들 일이지."' },
      { at: 500, text: '목격자들은 모두 넷 중 한 가지만 틀렸다. 모자를 맞히면 얼굴을 틀리고, 얼굴을 맞히면 시간을 틀렸다. 두 가지를 틀린 사람도, 다 맞힌 사람도 없었다. 안개 탓이라기엔 지나치게 고른 실수였다. 누군가 실수의 개수까지 정해 두고 있었다.' },
      { at: 1500, text: '부두 노동자 하나가 결국 털어놓았다. 진술하기 전날 밤, 문틈으로 쪽지가 들어왔다고 했다. "본 대로 말하되, 한 가지만 다르게." 쪽지에는 돈이 끼워져 있었다. 손글씨를 보는 순간 등이 서늘해졌다. 골목길 사건의 낡은 사무실 벽에서 본 그 글씨였다. 써드는 범인들만이 아니라 목격자까지 판에 올려놓고 있었다.' },
      { at: 2500, text: '압수한 밀수 상자를 처음으로 열었다. 안에 든 것은 마약도 무기도 아니었다. 빈 신분증 수백 장, 그리고 몽타주처럼 그려진 얼굴 사진들. 맨 위의 사진 세 장은 우리 3팀 형사들의 얼굴이었다. 모자와 안경과 마스크가 하나씩 다르게 덧그려져 있었다. 써드는 우리를 한 패로 묶어 보고 있었다.' },
      { at: 4000, text: '창고 쪽 조직은 거의 무너졌다. 남은 자들은 배 위에 있다. 밤마다 안개를 타고 들어왔다 나가는 운반선, 등대가 꺼지는 십 분 동안만 부두에 닿는 배. 책상에서 기다리는 팀으로는 닿을 수 없는 곳이다. 이제부터는 현장에서, 등대 빛이 지나가는 그 짧은 순간에 잡아야 한다.' },
      { at: 5000, text: '마지막 운반선의 선실은 비어 있었다. 탁자 위에 쪽지 한 장과, 오래된 경찰 배지 하나. 배지 번호의 앞자리는 우리 서의 것이었고, 소속 칸에는 "수사 3팀"이라고 새겨져 있었다. 쪽지에는 늘 그렇듯 짧게 적혀 있었다. "목격자는 늘 하나를 틀린다. 너희 팀도 그렇다. — 써드" 3팀에 있었던 사람. 아니면 3팀을 아주 잘 아는 사람. 안개가 걷힌 부두에서, 우리는 처음으로 서로의 얼굴을 오래 보았다.\n— 사건 3에서 계속' }
    ]
  };
  /*
   * 사건 3 "증인의 기억"(0.5.0) — 무대는 다시 중앙서, 면통실. 현장 출동 퍼즐은 면통 라인업(lineup.js).
   *   여는 시점: 0 = 얼굴 없는 강도, 1000 = 옆 사람만 기억하는 증인, 2500 = 해무항의 빈 신분증, 4000 = 유리에 비친 액자,
   *              6500 = 팀 한계(남은 건 써드의 줄), 8000 = 종결. 써드의 정체는 아직 다 밝히지 않는다(3팀의 옛 사진 속 지워진 얼굴까지).
   */
  var CASE3 = {
    no: 3,
    title: '증인의 기억',
    city: '중앙서 면통실',
    mode: 'lineup',
    pay: 6,
    goal: 8000,
    idleCap: 6500,
    story: [
      { at: 0, text: '해무항에서 돌아온 지 사흘 만에 우리 서 면통실에 다시 불이 켜졌다. 도시 곳곳에 얼굴 없는 강도가 나타났다. 목격자는 많았지만 범인의 얼굴을 또렷이 기억하는 사람은 없었다. 대신 다들 이상할 만큼 정확하게 기억하는 것이 있었다. 범인이 누구 옆에 서 있었는지, 그 옆 사람이 무엇을 쓰고 있었는지.' },
      { at: 1000, text: '증인들은 범인을 보지 못한 게 아니었다. 범인이 늘 다른 사람들 사이에 섞여 서도록 짜여 있었던 것이다. 버스 정류장의 줄, 은행 창구 앞의 줄, 횡단보도 앞의 줄. 범행은 언제나 사람들이 한 줄로 늘어선 곳에서 일어났다. 누군가 줄 세우는 법을 알고 있었다.' },
      { at: 2500, text: '면통실에 세운 용의자들의 소지품에서 같은 신분증이 여러 장 나왔다. 이름도 주소도 비어 있고 사진만 붙은 신분증. 해무항 밀수 상자에서 나온 바로 그 빈 신분증이었다. 사진 속 얼굴들은 모자와 안경과 마스크를 바꿔 가며 같은 사람을 여러 사람으로 보이게 만들고 있었다.' },
      { at: 4000, text: '한 증인이 유리 너머가 아니라 우리 쪽 벽을 한참 보고 있었다. 면통실에 걸린 낡은 액자, 십 년 전 수사 3팀의 단체 사진이었다. 맨 끝에 선 한 사람의 얼굴만 누군가 칼로 긁어 지워 놓았다. "얼굴은 못 봤어요. 그런데 그날 줄에 선 사람도 왼손 등에 저런 흉터가 길게 나 있었어요." 긁힌 얼굴 아래, 사진 속 그 사람의 왼손 등에는 정말로 흉터가 비스듬히 지나가고 있었다. 아무도 그 자리에 누가 서 있었는지 말하지 않았다.' },
      { at: 6500, text: '팀이 책상에서 잡을 수 있는 놈들은 다 잡았다. 남은 건 써드가 직접 세운 줄이다. 진술은 짧아지고, 줄은 길어지고, 범인 옆에는 늘 범인을 닮은 사람이 선다. 이제부터는 면통실 유리 앞에서 직접 지목해야 한다. 한 번 틀리면 증인은 다시 그 줄을 보려 하지 않는다.' },
      { at: 8000, text: '마지막 줄의 마지막 사람을 지목하던 날, 증인이 유리 앞에서 오래 머뭇거렸다. 그리고 범인이 아니라 액자 속 지워진 얼굴 쪽으로 고개를 돌렸다. 그날 밤 내 책상 위에는 긁힌 자리를 오려 낸 사진 조각과 쪽지 한 장이 있었다. "줄 맨 끝 자리는 원래 내 자리였다. — 써드" 3팀의 네 번째 사람. 우리가 아무도 기억하지 않던 사람.\n— 다음 사건에서 계속' }
    ]
  };
  var CASES = [CASE, CASE2, CASE3];
  /** 지금 맡은 사건(save.caseNo, 1부터) */
  function caseOf(save) { var n = save && save.caseNo; return CASES[(n >= 1 && n <= CASES.length ? n : 1) - 1]; }

  // 프로필(사무실 위에 보이는 내 자리). 게임 이름인 "수사 3팀"은 바꾸지 않고, 경찰서와 팀장 이름만 바꾼다.
  /*
   * 0.3.0 동물 효과(Team3Pets) 끌어오기. idle 은 pets 를 모른다: 화면 쪽에서 setBonus(fn) 로 꽂아 준다.
   *   fn(save) → { pay, idle, speed, cap, off, gear, night, buff, ... }(퍼센트·분·초 숫자). 안 꽂으면 모두 0.
   *   시험에서는 그냥 두면 예전과 똑같이 계산된다.
   */
  var NO_BONUS = { pay: 0, idle: 0, speed: 0, cap: 0, off: 0, gear: 0, night: 0, buff: 0 };
  var bonusFn = null;
  function setBonus(fn) { bonusFn = typeof fn === 'function' ? fn : null; }
  /*
   * 0.7.0 바깥 모듈 훅(idle 은 부서 · 증거판을 모른다)
   *   setExtraIncome(fn(save) → 초당 수사비): 부서 수입. 팀과 같은 시간 규칙(자리 비움 절반 · 한도 · 사기 충전은 안 받음)
   *   setEarn(fn(save, 수사비)): 번 수사비를 알려 준다(재수사 단서 계산 — 이번 판에 번 수사비)
   */
  var extraFn = null, earnFn = null;
  function setExtraIncome(fn) { extraFn = typeof fn === 'function' ? fn : null; }
  function setEarn(fn) { earnFn = typeof fn === 'function' ? fn : null; }
  function extraPerSec(save) { if (!extraFn) return 0; try { var v = +extraFn(save); return isFinite(v) && v > 0 ? v : 0; } catch (e) { return 0; } }
  function mulOf(v, lo, hi, d) { return typeof v === 'number' && isFinite(v) && v >= lo && v <= hi ? v : d; }
  function earned(save, v) { if (earnFn && v > 0) { try { earnFn(save, v); } catch (e) { /* 무시 */ } } }
  function bonusOf(save) {
    if (!bonusFn) return NO_BONUS;
    try { var b = bonusFn(save); return b && typeof b === 'object' ? b : NO_BONUS; } catch (e) { return NO_BONUS; }   // 효과 계산이 깨져도 게임은 돈다
  }
  function pctOf(b, k) { var v = +b[k]; return isFinite(v) && v > 0 ? v / 100 : 0; }
  function amtOf(b, k) { var v = +b[k]; return isFinite(v) && v > 0 ? v : 0; }

  var PROFILE = { stationMax: 8, leaderMax: 8, defaultStation: '중앙서', defaultLeader: '', renameGems: 10 };   // 0.3.0: 첫 변경은 무료, 그 뒤로 배지 renameGems

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
      caseNo: 1,           // 0.2.0: 지금 맡은 사건. caught·closed·storySeen 은 이 사건의 값
      past: [],            // 0.2.0: 끝낸 사건 기록 [{ no, caught, closedAt }]
      money: 0,
      caught: 0,           // 사건 1 누적 검거(팀 + 출동)
      frac: 0,             // 팀이 잡다 만 몫(0~1)
      detectives: 1,       // 처음부터 1명(나 말고 동료 한 명)
      training: 0,
      gear: { time: 0, veteran: 0, lab: 0, vault: 0, recorder: 0, keeper: 0, informant: 0, painter: 0, lights: 0, witness2: 0 },
      lastSeen: now,
      buffUntil: 0,
      runs: 0, bestScore: 0, runCaught: 0, teamCaught: 0,
      closed: false, closedAt: 0,
      tutorialDone: false,
      storySeen: 0,        // 수사 일지에서 읽은 편 수(새 편이 열리면 "수사 일지 보기"에 NEW)
      profile: { station: PROFILE.defaultStation, leader: PROFILE.defaultLeader },
      // ---- 0.1.19 ----
      gems: 0,             // 배지: 유료 재화. 지금은 계급·메달·특별 출동으로만 조금씩 얻는다
      rankSeen: 0,         // 승진 연출을 보여 준 계급(이보다 높아지면 사무실에서 승진 창)
      partyUntil: 0,       // 팀 회식이 끝나는 시각
      jointUntil: 0, escortUntil: 0,   // 0.10.9 합동 수사본부(부서 2배) · 호송 지원(자동 이송)이 끝나는 시각
      nightWatch: false,   // 야간 잠복조를 사 뒀는가(다음 자리 비움에 한 번 쓰임)
      medals: { b: false, s: false, g: false },   // 출동 점수 메달(처음 달성 보상은 한 번만)
      recent: [],          // 최근 출동 점수(최대 5개) — 상품 값의 기준
      prep: {},            // 다음 출동에 챙겨 갈 준비물 { id: true }
      prepPaid: {},        // 준비물에 낸 값 { id: { w: 'money'|'gems', c } } — 출동 전에 무르면 돌려준다
      daily: { day: '', best: 0, tries: 0, paid: -1, joined: false },  // 오늘의 특별 출동(0.10.6 기회 · 받은 메달)
      pets: null, office: null, dept: null, evid: null, diff: null, crew: null, caseBest: 0, dfrac: 0,          // 0.3.0 동물(검사·기본값은 Team3Pets.clean 이 맡는다)
      profileEdits: 0,     // 0.3.0 프로필 이름을 바꾼 횟수(0 이면 다음 한 번은 무료)
      ach: null,           // 0.3.0 업적 · 칭호(Team3Ach.clean)
      shop: null,          // 0.4.0 상점 · 광고 자리 · 월정액 · 시즌 패스(Team3Monet.clean)
      nameTags: 0          // 0.3.0 이름표: 프로필·동물 이름 바꾸기 1번(배지 대신). 묶음으로 산다
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
    s.caseNo = int(data.caseNo, 1, 1, CASES.length);
    s.past = Array.isArray(data.past) ? data.past.filter(function (x) { return x && typeof x === 'object'; }).slice(0, 20).map(function (x) {
      return { no: int(x.no, 1, 1, 99), caught: int(x.caught, 0, 0), closedAt: num(x.closedAt, 0, 0) };
    }) : [];
    s.closed = data.closed === true && s.caught >= caseOf(s).goal;
    s.closedAt = num(data.closedAt, 0, 0);
    s.tutorialDone = data.tutorialDone === true;
    s.storySeen = int(data.storySeen, 0, 0, caseOf(s).story.length);
    var pf = data.profile && typeof data.profile === 'object' ? data.profile : {};
    s.profile = {
      station: cleanName(pf.station, PROFILE.stationMax, PROFILE.defaultStation),
      leader: cleanName(pf.leader, PROFILE.leaderMax, PROFILE.defaultLeader)
    };
    // ---- 0.1.19 (예전 저장에는 없으므로 기본값으로 채운다) ----
    s.gems = int(data.gems, 0, 0, 1e9);
    // 예전 저장(0.1.18 까지)은 0 부터: 이미 잡아 둔 만큼의 승진을 업데이트 뒤 사무실에서 한꺼번에 받는다
    s.rankSeen = int(data.rankSeen, 0, 0, RANKS.length - 1);
    s.partyUntil = num(data.partyUntil, 0, 0);
    s.jointUntil = num(data.jointUntil, 0, 0); s.escortUntil = num(data.escortUntil, 0, 0);
    s.nightWatch = data.nightWatch === true;
    var md = data.medals && typeof data.medals === 'object' ? data.medals : {};
    s.medals = { b: md.b === true, s: md.s === true, g: md.g === true };
    s.recent = Array.isArray(data.recent) ? data.recent.filter(function (x) { return typeof x === 'number' && isFinite(x) && x >= 0; }).map(Math.floor).slice(-5) : [];
    var pr = data.prep && typeof data.prep === 'object' ? data.prep : {};
    s.prep = {};
    Object.keys(pr).forEach(function (k) { if (pr[k] === true && /^[a-z]{2,12}$/.test(k)) s.prep[k] = true; });
    // 준비물에 낸 값(무를 때 돌려줄 값). 챙긴 준비물 것만, 돈 종류와 양수만 남긴다
    var pp = data.prepPaid && typeof data.prepPaid === 'object' ? data.prepPaid : {};
    s.prepPaid = {};
    Object.keys(s.prep).forEach(function (k) {
      var v = pp[k];
      if (v && (v.w === 'money' || v.w === 'gems') && typeof v.c === 'number' && isFinite(v.c) && v.c > 0) s.prepPaid[k] = { w: v.w, c: Math.floor(v.c) };
    });
    var dl = data.daily && typeof data.daily === 'object' ? data.daily : {};
    s.daily = {
      day: typeof dl.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dl.day) ? dl.day : '',
      best: int(dl.best, 0, 0), tries: int(dl.tries, 0, 0, 99),
      // 0.10.6 그날 받은 가장 높은 메달(−1 없음 · 0 동 · 1 은 · 2 금). 예전 저장의 done(메달 받음)은 동으로 본다
      paid: typeof dl.paid === 'number' ? int(dl.paid, -1, -1, 2) : dl.done === true ? 0 : -1, joined: dl.joined === true
    };
    s.profileEdits = int(data.profileEdits, 0, 0, 1e6);
    s.nameTags = int(data.nameTags, 0, 0, 9999);
    // 0.3.0: 동물 저장은 객체만 그대로 넘긴다(안쪽 검사는 Team3Pets.clean)
    s.pets = data.pets && typeof data.pets === 'object' && !Array.isArray(data.pets) ? data.pets : null;
    s.ach = data.ach && typeof data.ach === 'object' && !Array.isArray(data.ach) ? data.ach : null;
    s.shop = data.shop && typeof data.shop === 'object' && !Array.isArray(data.shop) ? data.shop : null;
    if (data.attend && typeof data.attend === 'object' && !Array.isArray(data.attend)) s.attend = data.attend;
    if (data.quest && typeof data.quest === 'object' && !Array.isArray(data.quest)) s.quest = data.quest;   // 0.10.3 임무(안쪽 검사는 Team3Quest.clean)   // 0.10.2 출석(안쪽 검사는 Team3Attend.clean)
    s.office = data.office && typeof data.office === 'object' && !Array.isArray(data.office) ? data.office : null;
    s.dept = data.dept && typeof data.dept === 'object' && !Array.isArray(data.dept) ? data.dept : null;   // 0.7.0 부서(검사는 Team3Dept.clean)
    s.evid = data.evid && typeof data.evid === 'object' && !Array.isArray(data.evid) ? data.evid : null;   // 0.7.0 재수사 · 증거판(검사는 Team3Evidence.clean)
    s.diff = data.diff && typeof data.diff === 'object' && !Array.isArray(data.diff) ? data.diff : null;
    s.crew = data.crew && typeof data.crew === 'object' && !Array.isArray(data.crew) ? data.crew : null;   // 0.8.0 팀원 직무 · 공용 장비 · 수사 기법(검사는 Team3Crew.clean)   // 0.7.0 난이도(검사는 Team3Diff.clean)
    s.caseBest = int(data.caseBest, 0, 0, 1e9); s.caseBest = Math.max(s.caseBest, s.caught);
    s.dfrac = typeof data.dfrac === 'number' && data.dfrac >= 0 && data.dfrac < 1 ? data.dfrac : 0;   // 0.6.0 살아 있는 사무실(검사는 Team3Office.clean)   // 0.4.0 상점 · 패스(검사는 Team3Monet.clean)   // 0.3.0 업적(검사는 Team3Ach.clean)
    return { save: s, reset: false };
  }

  /* ---------- 계급(0.1.19) ---------- */
  function rankIndex(save) {
    var i = 0;
    for (var k = 1; k < RANKS.length; k++) if (save.runCaught >= RANKS[k].at) i = k;
    return i;
  }
  function rankOf(save) {
    var i = rankIndex(save), next = RANKS[i + 1] || null;
    return { index: i, name: RANKS[i].name, bonus: i * RANK_BONUS, next: next, toNext: next ? next.at - save.runCaught : 0 };
  }
  /*
   * 아직 보여 주지 않은 승진이 있으면 그 계급들을 돌려주고 배지를 지급한다(한 번만).
   * 반환: [{ name, gems }] (없으면 빈 배열)
   */
  function claimPromotions(save) {
    var i = rankIndex(save), out = [];
    while (save.rankSeen < i) {
      save.rankSeen += 1;
      var r = RANKS[save.rankSeen];
      save.gems += r.gems;
      out.push({ name: r.name, gems: r.gems });
    }
    return out;
  }
  function moneyMult(save) { return 1 + rankIndex(save) * RANK_BONUS; }

  function serialize(save) { return JSON.stringify(save); }

  /* ---------- 팀 ---------- */
  // 팀 전체가 1초에 잡는 수(사기 충전 제외)
  function teamRate(save) {
    return save.detectives * (1 / TUNE.catchSec) * (1 + TUNE.trainSpeed * save.training) * (1 + pctOf(bonusOf(save), 'speed'));
  }
  function payPerCatch(save) {
    return Math.round(TUNE.catchPay * (1 + TUNE.trainPay * save.training) * moneyMult(save) * caseOf(save).pay * (1 + pctOf(bonusOf(save), 'idle')));
  }
  // 팀이 2배로 일하는 끝 시각: 출동 뒤 사기 충전과 팀 회식 중 늦은 쪽(둘이 겹쳐도 곱하지 않는다)
  function boostUntil(save) { return Math.max(save.buffUntil || 0, save.partyUntil || 0); }
  function buffed(save, now) { return boostUntil(save) > now; }

  /*
   * 다음 검거까지 남은 초(1.4). 잡다 만 몫(frac)이 1 이 되는 데 걸리는 시간.
   * 사기 충전 중이면 그 속도로 세고, 충전이 중간에 끝나면 남은 몫은 보통 속도로 센다.
   * 화면의 "다음 검거까지" 줄과 남은 초에 쓴다. 반환: { sec, frac }
   */
  function nextCatch(save, now) {
    var need = 1 - save.frac, base = teamRate(save);
    if (!(base > 0)) return { sec: Infinity, frac: save.frac };
    var buffLeft = Math.max(0, (boostUntil(save) - now) / 1000), fast = base * TUNE.buffMult;
    var sec = need <= fast * buffLeft ? need / fast : buffLeft + (need - fast * buffLeft) / base;
    return { sec: sec, frac: save.frac };
  }

  function checkClose(save, now) {
    if (!save.closed && save.caught >= caseOf(save).goal) {
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
    // 야간 잠복조(0.1.19): 자리 비움이 nightMinSec 보다 길면 이번 한 번 한도를 늘리고 다 쓴 것으로 친다
    // 0.3.0: 동물 효과로 한도(+분)·야간 잠복조 한도(+분)·자리 비움 속도(+%p)가 늘 수 있다
    var bn = bonusOf(save);
    var cap = TUNE.offlineCapSec + amtOf(bn, 'cap') * 60, night = false;
    if (offline && save.nightWatch && dt >= TUNE.nightMinSec) { cap = TUNE.nightCapSec + amtOf(bn, 'night') * 60; save.nightWatch = false; night = true; }
    dt = Math.min(dt, cap);
    var start = now - dt * 1000;
    var buffSec = Math.max(0, Math.min(boostUntil(save), now) - start) / 1000;
    buffSec = Math.min(buffSec, dt);
    var effSec = ((dt - buffSec) + buffSec * TUNE.buffMult) * (offline ? Math.min(1, TUNE.offlineRate + pctOf(bn, 'off')) : 1);
    var total = save.frac + teamRate(save) * effSec;
    var whole = Math.floor(total);
    save.frac = total - whole;
    var money = whole * payPerCatch(save);
    // 0.7.0 부서 수입: 팀과 같은 시간(자리 비움이면 절반 · 한도까지). 사기 충전 배수는 팀에만
    // 0.10.9 합동 수사본부: 겹친 구간만큼 부서 수입 한 번 더(2배)
    var jointSec = Math.min(dt, Math.max(0, Math.min(save.jointUntil || 0, now) - start) / 1000);
    var deptSec = (dt + jointSec) * (offline ? Math.min(1, TUNE.offlineRate + pctOf(bn, 'off')) : 1), dept = Math.floor(extraPerSec(save) * deptSec + (save.dfrac || 0));
    save.dfrac = Math.max(0, Math.min(1, extraPerSec(save) * deptSec + (save.dfrac || 0) - dept));
    money += dept;
    save.money += money;                       // 수사비는 상한과 상관없이 잡은 만큼 다 들어온다
    earned(save, money);
    // 사건 진척은 idleCap 까지만(이미 넘었으면 0). 출동으로 넘긴 몫은 깎지 않는다
    var room = Math.max(0, caseOf(save).idleCap - save.caught);
    var counted = Math.min(whole, room);
    save.caught += counted;
    save.caseBest = Math.max(save.caseBest || 0, save.caught);   // 0.7.0 재수사해도 열어 본 일지는 계속 열려 있게
    save.teamCaught += whole;
    return { seconds: dt, cap: cap, offline: offline, night: night, catches: whole, counted: counted, money: money, dept: dept, closedNow: checkClose(save, now) };
  }

  /* ---------- 사기 ---------- */
  // 값(null = 더 못 산다)
  function cost(save, kind) {
    if (kind === 'hire') return Math.round(TUNE.hireBase * Math.pow(TUNE.hireGrowth, save.detectives - 1));
    if (kind === 'train') return save.training >= TUNE.trainMax ? null : Math.round(TUNE.trainBase * Math.pow(TUNE.trainGrowth, save.training));
    var g = GEAR[kind];
    if (!g) throw IdleError('BAD_KIND', '모르는 항목: ' + kind);
    if (save.gear[kind] >= g.costs.length) return null;
    return Math.round(g.costs[save.gear[kind]] * (1 - Math.min(0.5, pctOf(bonusOf(save), 'gear'))));   // 0.3.0 여우 등: 장비 값 할인(최대 50%)
  }

  function buy(save, kind) {
    var c = cost(save, kind);
    if (GEAR[kind] && GEAR[kind].case && GEAR[kind].case !== caseOf(save).no) throw IdleError('OTHER_CASE', '이 사건에서는 쓸 수 없는 장비: ' + kind);
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
      helperAtFull: save.gear.lab > 0,
      mode: caseOf(save).mode,  // 0.2.0: set(사건 1) | witness(사건 2) | 0.5.0: lineup(사건 3)
      // 사건 2 장비(목격자 출동에서만 쓰인다)
      trapPenalty: [8, 5, 2][save.gear.recorder] != null ? [8, 5, 2][save.gear.recorder] : 8,
      hitBonus: save.gear.informant,
      beamLie: save.gear.keeper > 0,
      // 0.5.0 사건 3 장비(면통 라인업 출동에서만 쓰인다)
      missPenalty: [5, 3, 1][save.gear.lights] != null ? [5, 3, 1][save.gear.lights] : 5,
      lineupHitBonus: save.gear.witness2 || 0,
      preOut: save.gear.painter > 0 ? 1 : 0
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
    // 0.1.19: 수사비 = 점수 × 계급 배수 × (준비물 "언론 브리핑"이면 payMult). 점수 기록(최고·최근)은 점수 그대로
    var payMult = typeof result.payMult === 'number' && result.payMult >= 1 && result.payMult <= 3 ? result.payMult : 1;
    var bn = bonusOf(save);
    var base = score * moneyMult(save) * payMult * (1 + pctOf(bn, 'pay'));   // 0.3.0: 동물 효과 출동 수사비 +%
    // 0.7.0 난이도: 수사비 ×diffMult(단순 0.7 · 미제 1.5), 재수사 몫(번 수사비 기록)은 ×clueMult(0.8 · 1.25)
    var dm = mulOf(result.diffMult, 0.3, 3, 1), cm = mulOf(result.clueMult, 0.3, 3, 1);
    var pay = Math.round(base * dm);
    save.money += pay;
    earned(save, Math.round(base * cm));
    save.recent = save.recent.concat([score]).slice(-5);
    save.caught += hits;
    save.runCaught += hits;
    save.runs += 1;
    var best = score > save.bestScore;
    if (best) save.bestScore = score;
    save.buffUntil = now + (TUNE.buffSec + amtOf(bn, 'buff')) * 1000;   // 0.3.0 고슴도치: 사기 충전 +초
    return { money: pay, caught: hits, best: best, closedNow: checkClose(save, now) };
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

  /*
   * 0.3.0 프로필 이름 바꾸기: 첫 한 번은 무료, 그 뒤로는 배지 PROFILE.renameGems 개.
   *   바뀐 게 없으면 돈을 받지 않는다(SAME). 반환 { profile, paid }
   */
  function profileCost(save) { return (save.profileEdits || 0) > 0 ? PROFILE.renameGems : 0; }
  /*
   * 이름표(0.3.0): 이름 바꾸기 1번 = 이름표 1장(있으면 배지보다 먼저 쓴다). 묶음 NAME_TAGS.n 장에 배지 NAME_TAGS.gems 개.
   *   payName(save, gems): 무료(0)면 그대로, 이름표가 있으면 1장, 없으면 배지. 반환 { w:'free'|'tag'|'gems', c }
   */
  var NAME_TAGS = { n: 3, gems: 12 };
  function payName(save, gems) {
    if (!(gems > 0)) return { w: 'free', c: 0 };
    if ((save.nameTags || 0) > 0) { save.nameTags -= 1; return { w: 'tag', c: 1 }; }
    if (save.gems < gems) throw IdleError('NOT_ENOUGH', '배지가 모자란다');
    save.gems -= gems;
    return { w: 'gems', c: gems };
  }
  function buyNameTags(save) {
    if (save.gems < NAME_TAGS.gems) throw IdleError('NOT_ENOUGH', '배지가 모자란다');
    save.gems -= NAME_TAGS.gems;
    save.nameTags = (save.nameTags || 0) + NAME_TAGS.n;
    return save.nameTags;
  }
  function changeProfile(save, station, leader) {
    var st = cleanName(station, PROFILE.stationMax, PROFILE.defaultStation), ld = cleanName(leader, PROFILE.leaderMax, PROFILE.defaultLeader);
    if (st === save.profile.station && ld === save.profile.leader) throw IdleError('SAME', '바뀐 이름이 없다');
    var pay = payName(save, profileCost(save));
    save.profile = { station: st, leader: ld };
    save.profileEdits = (save.profileEdits || 0) + 1;
    return { profile: save.profile, paid: pay.w === 'gems' ? pay.c : 0, tag: pay.w === 'tag' };
  }

  /* ---------- 사건 ---------- */
  function storyUnlocked(save) {
    // 0.10.3 새 편은 "지금 판" 검거 수로만 열린다(재수사 전 기록으로 열리면 2,300명에서 재수사하고 200명만 잡아도 2,500명 편이 나왔다).
    //   이미 읽은 편(storySeen)은 재수사 뒤에도 그대로 읽을 수 있다.
    var seen = save.storySeen || 0;
    return caseOf(save).story.filter(function (e, i) { return save.caught >= e.at || i < seen; });
  }
  function progress(save) { return Math.min(1, save.caught / caseOf(save).goal); }
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
  function idleCapped(save) { return !save.closed && save.caught >= caseOf(save).idleCap; }
  /** 다음 사건이 있는가(지금 사건을 끝냈고, 다음이 준비돼 있을 때만 파견할 수 있다) */
  function nextCase(save) { return save.closed ? (CASES[save.caseNo] || null) : null; }
  /**
   * 다음 사건으로 파견(0.2.0). 지금 사건을 past 에 적고 사건 진척(caught·frac·closed·storySeen)만 새로 시작한다.
   *   형사·훈련·장비·수사비·계급·배지·메달은 그대로 이어 간다.
   */
  function moveToNextCase(save, now) {
    assertNow(now);
    var nx = nextCase(save);
    if (!nx) throw IdleError(save.closed ? 'NO_NEXT' : 'NOT_CLOSED', save.closed ? '다음 사건이 아직 없다' : '현재 사건을 먼저 끝내야 한다');
    save.past = save.past.concat([{ no: save.caseNo, caught: save.caught, closedAt: save.closedAt }]).slice(-20);
    save.caseNo = nx.no;
    save.caught = 0; save.frac = 0; save.closed = false; save.closedAt = 0; save.storySeen = 0; save.caseBest = 0;
    save.lastSeen = now;
    return nx;
  }
  // 열렸지만 아직 안 읽은 편이 있는가 / 지금 열린 편까지 읽었다고 적기
  /**
   * 0.7.0 재수사: 팀을 처음으로(evidence.retreat 이 부른다). 수사비 · 형사 · 훈련 · 장비 · 지금 사건 진척.
   *   남는 것: 사건 번호 · 닫은 사건 · 일지(caseBest) · 계급(runCaught) · 최고 점수 · 프로필 · 동물 · 배지 등 다른 모듈 것.
   *   start = { startDet, startMoney } — 증거판 효과
   */
  function resetTeam(save, start) {
    start = start || {};
    save.money = Math.max(0, Math.floor(start.startMoney || 0));
    save.detectives = 1 + Math.max(0, Math.floor(start.startDet || 0));
    save.training = 0;
    GEAR_KEYS.forEach(function (k) { save.gear[k] = 0; });
    if (!save.closed) { save.caught = 0; }
    save.frac = 0; save.dfrac = 0;   // 준비물은 남긴다(배지로 산 것을 잃지 않게)
  }
  function storyUnread(save) { return storyUnlocked(save).length > save.storySeen; }
  function markStorySeen(save) { save.storySeen = storyUnlocked(save).length; return save.storySeen; }

  return {
    VERSION: VERSION, TUNE: TUNE, GEAR: GEAR, GEAR_KEYS: GEAR_KEYS, gearFor: gearFor, CASE: CASE, CASES: CASES, caseOf: caseOf, nextCase: nextCase, moveToNextCase: moveToNextCase, PROFILE: PROFILE,
    RANKS: RANKS, RANK_BONUS: RANK_BONUS, rankIndex: rankIndex, rankOf: rankOf, claimPromotions: claimPromotions, moneyMult: moneyMult, boostUntil: boostUntil,
    cleanName: cleanName, setProfile: setProfile, profileCost: profileCost, changeProfile: changeProfile, NAME_TAGS: NAME_TAGS, payName: payName, buyNameTags: buyNameTags,
    newSave: newSave, load: load, serialize: serialize, setBonus: setBonus, bonusOf: bonusOf, setExtraIncome: setExtraIncome, setEarn: setEarn, resetTeam: resetTeam,
    teamRate: teamRate, payPerCatch: payPerCatch, buffed: buffed, advance: advance, nextCatch: nextCatch,
    idleCapped: idleCapped, incomePerMin: incomePerMin, catchInterval: catchInterval, isStreaming: isStreaming, cost: cost, buy: buy, runOptions: runOptions, applyRun: applyRun,
    storyUnlocked: storyUnlocked, progress: progress, storyUnread: storyUnread, markStorySeen: markStorySeen
  };
});
