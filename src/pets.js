/*
 * Team3Pets(0.3.0) — 말랑 동물 뽑기 · 도감 · 별 강화 · 보유/장착 효과.
 *
 * 구조
 *   30종 × 4등급(일반 c · 희귀 r · 영웅 h · 전설 l) = 120마리(0.4.0: 20종 → 30종). 한 마리의 열쇠는 'corgi:c' 처럼 "종류:등급".
 *   저장은 save.pets 하나에 모은다(idle.load 는 객체만 넘겨주고, 검사는 여기 clean 이 한다).
 *     own    { 'corgi:c': 별(1~5) }   가진 동물과 별
 *     eq     '' | 'corgi:c'           장착(파트너) 1마리
 *     pity   전설 없이 뽑은 횟수(천장)
 *     treats 간식(★5 뒤 중복으로 받음 → 원하는 동물과 교환)
 *     tickets 뽑기권(무료 보상으로 받음)
 *     names  { 'corgi:c': '지어 준 이름' } · freeName 무료 이름 짓기를 썼는가(게임 전체 한 번)
 *     pulls  지금까지 뽑은 횟수 · welcome 처음 선물 받음 · gifts 한 번만 주는 보상을 받은 표시 { 'case1': true }
 *   DOM·시계·난수를 모른다(rng 는 밖에서 받는다) → node 시험에서 그대로 돈다.
 *
 * 뽑기
 *   등급을 먼저 정하고(GRADE.pct), 그 등급 안의 30종 중 하나를 똑같은 확률로 고른다(영웅 · 전설은 픽업 절반).
 *   천장: PITY 번째까지 전설이 한 번도 안 나오면 그 번째는 전설 확정. 전설이 나오면 0 부터 다시 센다.
 *   10연속: 희귀 이상이 하나도 없으면 마지막 한 마리를 희귀로 올린다(천장이 먼저).
 *   확률·천장은 화면에 그대로 공개한다(게임산업법 · 구글 플레이 정책).
 *
 * 효과
 *   보유 효과: 가진 동물 모두(120마리 각각), 작게, 늘 켜짐. 종류마다 하나의 갈래(OWN)로 쌓인다.
 *   장착 효과: 파트너 1마리만, 크게. 등급 배수 GRADE_MUL × 별 배수(★마다 +25%).
 *   ⚡ 퍼즐 도움: 영웅·전설 등급의 일부 종류만. 일일 특별 출동에서는 쓰지 않는다(밖에서 판단).
 *   원칙: 돈으로 시간·편의를 산다. 퍼즐 도움은 작고, 기록을 겨루는 특별 출동에선 꺼진다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Team3Pets = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function PetError(code, message) { var e = new Error(message); e.name = 'PetError'; e.code = code; return e; }

  /* ---------- 등급 ---------- */
  var GRADES = ['c', 'r', 'h', 'l'];
  var GRADE = {
    c: { name: '일반', pct: 66, color: '#A3ACBA', treat: 1, swap: 20 },
    r: { name: '희귀', pct: 28, color: '#5BB2E8', treat: 3, swap: 60 },
    h: { name: '영웅', pct: 5, color: '#B07CF0', treat: 10, swap: 250 },
    l: { name: '전설', pct: 1, color: '#FFD23F', treat: 40, swap: 600 }   // 0.4.1: 전설 1%(한 마리 약 0.033%), 천장 80 → 천장 포함 약 1.8% (0.4.0 에 3% 로 잘못 올라갔던 것을 바로잡음)
  };
  var GRADE_MUL = { c: 1, r: 1.5, h: 2, l: 3 };   // 장착 효과 배수
  var STAR_MAX = 5, STAR_STEP = 0.25;
  var PITY = 120;   // 0.9.2 천장 80 → 120(선택권 · 확정이 너무 쉬웠다)
  var COST = { one: 10, ten: 90 };   // 배지(◆): 1회 10, 10회 묶음마다 90(10% 덜)
  var MAX_PULL = 50;                 // 0.4.1: 한 번에 뽑을 수 있는 최대(가진 만큼 뽑기 — 화면 · 연출이 감당하는 선)
  /** n회의 배지 값: 10회 묶음마다 COST.ten, 나머지는 회당 COST.one */
  function gemCost(n) { return Math.floor(n / 10) * COST.ten + (n % 10) * COST.one; }
  /** 지금 한 번에 뽑을 수 있는 최대 횟수(pay = 'ticket' | 'gems') */
  function maxPull(save, pay) {
    var p = P(save);
    if (pay === 'ticket') return Math.min(MAX_PULL, p.tickets);
    var n = 0;
    while (n < MAX_PULL && gemCost(n + 1) <= (save.gems || 0)) n++;
    return n;
  }
  var WELCOME = 5;                   // 처음 뽑기 창을 열면 주는 뽑기권
  /*
   * 의상(0.3.1): 한 번 사면 옷장(closet)에 들어가 모든 동물이 함께 입는다. 동물마다 하나씩(wear).
   *   값은 간식 또는 배지 중 고른다. need: 열리는 조건(caseNo 이상) — 사건 한정 의상.
   *   꾸미기 전용: 효과 없음.
   */
  var OUTFITS = [
    { id: 'glasses', name: '동그란 안경', treats: 10, gems: 10 },
    { id: 'mask', name: '마스크', treats: 10, gems: 10 },
    { id: 'beanie', name: '잠복 비니', treats: 15, gems: 15 },
    { id: 'bow', name: '분홍 리본', treats: 15, gems: 15 },
    { id: 'sunglasses', name: '선글라스', treats: 25, gems: 25 },
    { id: 'fedora', name: '탐정 중절모', treats: 30, gems: 30 },
    { id: 'raincoat', name: '해무항 선장 모자', treats: 40, gems: 40, need: 2 },   // 0.10.5 우비 → 선장 모자(저장 id 그대로)
    { id: 'monocle', name: '면통실 외알 안경', treats: 50, gems: 50, need: 3 }      // 0.10.5 사건 3 의상
  ];
  var OUTFIT_BY = {};
  OUTFITS.forEach(function (o) { OUTFIT_BY[o.id] = o; });
  var NAME_MAX = 8, RENAME_GEMS = 5; // 0.3.0 동물 이름: 8자까지, 게임 전체 첫 한 번은 무료 · 그 뒤로 배지 5개

  /*
   * 종류(20). own: 보유 효과 갈래 / eq: 장착 효과(★1 · 일반 기준 값) / zap: 영웅 이상에서 열리는 ⚡ 퍼즐 도움
   *   갈래(효과 키):
   *     pay   출동 수사비 +%        idle  팀 수입 +%          speed 팀 검거 속도 +%
   *     cap   자리 비움 한도 +분     off   자리 비움 속도 +%p   gear  장비 값 −%      prep 준비물 값 −%
   *     party 팀 회식 시간 +%        night 야간 잠복조 한도 +분  daily 특별 출동 수사비 +%
   *     buff  사기 충전 +초          treat 중복 간식 +개        case2 사건 2 수입 +%   owl 밤(22~6시) 수입 +%
   */
  var SPECIES = [
    { id: 'corgi', kind: '웰시코기', name: '단서', own: 'pay', eq: { pay: 10 }, line: '큰 귀로 단서를 듣는 탐지견' },
    { id: 'shiba', kind: '시바견', name: '보리', own: 'idle', eq: { speed: 8 }, line: '무뚝뚝한데 검거하면 꼬리가 바쁨' },
    { id: 'hamster', kind: '햄스터', name: '도토리', own: 'cap', eq: { cap: 60 }, line: '볼주머니에 증거를 숨겨 옴' },
    { id: 'rabbit', kind: '토끼', name: '솜이', own: 'idle', eq: { party: 30 }, line: '긴 귀로 잠복 무전을 엿들음' },
    { id: 'bear', kind: '곰', name: '곰돌 반장', own: 'idle', eq: { idle: 10 }, line: '든든한 현장 반장' },
    { id: 'hedgehog', kind: '고슴도치', name: '가시', own: 'pay', eq: { buff: 30 }, line: '건드리면 따끔한 수비 담당' },
    { id: 'duck', kind: '오리', name: '뒤뚱', own: 'pay', eq: { treat: 1 }, line: '뒤뚱뒤뚱 탐문 수사' },
    { id: 'frog', kind: '개구리', name: '풍덩', own: 'idle', eq: { case2: 15 }, line: '비 오는 해무항 단골' },
    { id: 'ragdoll', kind: '랙돌', name: '알리', own: 'cap', eq: { off: 8 }, line: '파란 눈, 안기면 축 늘어짐' },
    { id: 'siamese', kind: '샴', name: '모카', own: 'prep', eq: { prep: 10 }, line: '얼굴이 원래 변장 가면' },
    { id: 'fox', kind: '여우', name: '노을', own: 'gear', eq: { gear: 8 }, line: '거짓말을 귀신같이 알아챔' },
    { id: 'penguin', kind: '펭귄', name: '펭경', own: 'pay', eq: { daily: 20 }, line: '정복이 원래 몸에 붙어 있음' },
    { id: 'monkey', kind: '원숭이', name: '망고', own: 'cap', eq: { night: 60 }, line: '높은 곳에서 망을 봄' },
    { id: 'squirrel', kind: '다람쥐', name: '도람', own: 'idle', eq: { pay: 6, idle: 6 }, line: '증거를 도토리처럼 모아 둠' },
    { id: 'koala', kind: '코알라', name: '코코', own: 'cap', eq: { cap: 90 }, line: '하루 20시간 잠복(사실은 잠)' },
    { id: 'raccoon', kind: '너구리', name: '몽이', own: 'pay', eq: { pay: 8 }, zap: { shield: 1 }, line: '타고난 검은 복면, 야간 잠복' },
    { id: 'owl', kind: '부엉이', name: '새벽', own: 'idle', eq: { owl: 25 }, line: '새벽 3시 CCTV 담당' },
    { id: 'otter', kind: '수달', name: '달수', own: 'pay', eq: { speed: 5 }, zap: { miss: 2 }, line: '해무항 물속 증거 수색' },
    { id: 'panda', kind: '판다', name: '판돌', own: 'idle', eq: { pay: 10, idle: 10 }, zap: { time: 3 }, line: '3팀의 전설, 보기 드문 손님' },
    { id: 'tiger', kind: '호랑이', name: '범수', own: 'pay', eq: { pay: 12 }, zap: { combo: 1 }, line: '범인 잡는 범' },
    // 0.4.0 추가 10종
    { id: 'sheep', kind: '양', name: '뭉게', own: 'cap', eq: { cap: 75 }, line: '푹신한 털 속에 증거를 숨겨 둠' },
    { id: 'pig', kind: '돼지', name: '복돌', own: 'pay', eq: { daily: 25 }, line: '코로 킁킁, 냄새 추적의 달인' },
    { id: 'redpanda', kind: '레서판다', name: '단풍', own: 'idle', eq: { speed: 7 }, line: '꼬리 줄무늬가 자랑인 정보원' },
    { id: 'alpaca', kind: '알파카', name: '파카', own: 'prep', eq: { prep: 12 }, line: '침착하게 준비물 챙기는 담당' },
    { id: 'seal', kind: '물범', name: '몽실', own: 'idle', eq: { case2: 18 }, line: '해무항 부두를 지키는 순찰대' },
    { id: 'hippo', kind: '하마', name: '하하', own: 'pay', eq: { buff: 40 }, line: '하품 한 번에 팀 사기 충전' },
    { id: 'turtle', kind: '거북이', name: '엉금', own: 'cap', eq: { off: 10 }, line: '느려도 끝까지 잠복하는 끈기' },
    { id: 'mouse', kind: '생쥐', name: '치즈', own: 'gear', eq: { gear: 10 }, line: '좁은 틈으로 장비를 구해 옴' },
    { id: 'lion', kind: '사자', name: '갈기', own: 'pay', eq: { pay: 11 }, line: '갈기 휘날리는 출동 대장' },
    { id: 'deer', kind: '사슴', name: '방울', own: 'idle', eq: { idle: 9 }, line: '뿔에 방울 달고 순찰 중' }
  ];
  /* 0.9.0 한정 파트너: 뽑기 · 도감 세트에는 안 들어간다(SPECIES 밖). 상점 한정 칸에서만 데려온다(★5로) */
  var LIMITED = [
    { id: 'wolf', kind: '늑대', name: '백랑', own: 'pay', eq: { pay: 12, idle: 8 }, line: '특수수사팀에서 온 말 없는 사냥꾼', limited: true }
  ];
  var BY_ID = {};
  SPECIES.concat(LIMITED).forEach(function (s) { BY_ID[s.id] = s; });

  // 보유 효과: 한 마리(★1)가 주는 값. 퍼센트 갈래와 분 갈래
  var OWN_VAL = { c: { pct: 0.5, min: 5 }, r: { pct: 1, min: 10 }, h: { pct: 2, min: 20 }, l: { pct: 3, min: 40 } };
  var OWN_KIND = { pay: '출동 수사비', idle: '팀 수입', cap: '자리 비움 한도', gear: '장비 값 할인', prep: '준비물 값 할인' };
  // 효과가 너무 커지지 않게 묶는 상한
  var CAPS = { gear: 50, prep: 50, cap: 8 * 60, off: 30, night: 8 * 60, buff: 300, treat: 5, party: 300 };

  var LABEL = {
    pay: ['출동 수사비', '+', '%'], idle: ['팀 수입', '+', '%'], speed: ['팀 검거 속도', '+', '%'],
    cap: ['자리 비움 한도', '+', '분'], off: ['자리 비움 중 팀 속도', '+', '%p'], gear: ['장비 값', '−', '%'], prep: ['준비물 값', '−', '%'],
    party: ['팀 회식 시간', '+', '%'], night: ['야간 잠복조 한도', '+', '분'], daily: ['특별 출동 수사비', '+', '%'],
    buff: ['출동 뒤 사기 충전', '+', '초'], treat: ['중복일 때 간식', '+', '개'], case2: ['해무항(사건 2) 수입', '+', '%'],
    owl: ['밤(22~6시) 수입', '+', '%'],
    shield: ['⚡ 오인 체포 벌점 면제', '', '번'], miss: ['⚡ 오인 체포 벌점', '−', '초'], time: ['⚡ 출동 시간', '+', '초'], combo: ['⚡ 연속 배수 상한', '+', '']
  };

  /* ---------- 저장 ---------- */
  function key(id, g) { return id + ':' + g; }
  function parse(k) {
    var m = /^([a-z0-9]+):([crhl])$/.exec(k || '');
    return m && BY_ID[m[1]] ? { id: m[1], g: m[2] } : null;
  }
  function empty() { return { own: {}, eq: '', pity: 0, treats: 0, tickets: 0, pulls: 0, welcome: false, gifts: {}, names: {}, freeName: false, closet: {}, wear: {}, bgs: { office: true }, bg: 'office', free: null, picks: { l: 0 }, bond: {}, noir: {}, noirSeen: {}, fresh: {} }; }   // 0.10.6 fresh: 새로 얻고 아직 도감에서 안 본 파트너
  function int(v, def, min, max) {
    if (typeof v !== 'number' || !isFinite(v)) return def;
    v = Math.floor(v);
    return v < min ? min : v > max ? max : v;
  }
  /** 저장 속 pets 를 검사해 깨끗한 값으로 바꾼다(없거나 깨졌으면 빈 값). save.pets 를 돌려준다 */
  function clean(save) {
    var d = save.pets && typeof save.pets === 'object' ? save.pets : {}, p = empty();
    var own = d.own && typeof d.own === 'object' ? d.own : {};
    Object.keys(own).forEach(function (k) { if (parse(k)) p.own[k] = int(own[k], 1, 1, STAR_MAX); });
    p.eq = typeof d.eq === 'string' && p.own[d.eq] ? d.eq : '';
    p.pity = int(d.pity, 0, 0, PITY - 1);
    p.treats = int(d.treats, 0, 0, 1e7);
    p.tickets = int(d.tickets, 0, 0, 1e5);
    p.pulls = int(d.pulls, 0, 0, 1e8);
    p.welcome = d.welcome === true;
    var gf = d.gifts && typeof d.gifts === 'object' ? d.gifts : {};
    Object.keys(gf).slice(0, 200).forEach(function (k) { if (gf[k] === true && /^[a-z0-9_-]{1,24}$/.test(k)) p.gifts[k] = true; });
    var nm = d.names && typeof d.names === 'object' ? d.names : {};
    Object.keys(nm).forEach(function (k) { var v = cleanText(nm[k]); if (parse(k) && v) p.names[k] = v; });
    p.freeName = d.freeName === true;
    p.picks = { l: int(d.picks && d.picks.l, 0, 0, 999) };
    var bd = d.bond && typeof d.bond === 'object' ? d.bond : {};
    Object.keys(bd).forEach(function (k) {
      var b = bd[k];
      if (!parse(k) || !p.own[k] || !b || typeof b !== 'object') return;
      p.bond[k] = { days: int(b.days, 0, 0, 1e5), last: /^\d{4}-\d{2}-\d{2}$/.test(b.last) ? b.last : '', since: /^\d{4}-\d{2}-\d{2}$/.test(b.since) ? b.since : '' };
    });
    if (d.free && typeof d.free === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(d.free.day)) p.free = { day: d.free.day, n: int(d.free.n, 0, 0, 99) };
    var cl = d.closet && typeof d.closet === 'object' ? d.closet : {};
    Object.keys(cl).forEach(function (k) { if (cl[k] === true && OUTFIT_BY[k]) p.closet[k] = true; });
    var bo = d.bgs && typeof d.bgs === 'object' ? d.bgs : {};   // 0.12.0 파트너 배경
    BGS.forEach(function (b) { if (bo[b.id] === true) p.bgs[b.id] = true; });
    p.bg = typeof d.bg === 'string' && p.bgs[d.bg] ? d.bg : 'office';
    var wr = d.wear && typeof d.wear === 'object' ? d.wear : {};
    Object.keys(wr).forEach(function (k) { if (parse(k) && p.own[k] && p.closet[wr[k]]) p.wear[k] = wr[k]; });
    // 0.8.4 누아르 각성: 켠 동물(noir) · 각성이 열린 걸 이미 알려 준 동물(noirSeen). 조건이 안 되는 키는 버린다
    var nr = d.noir && typeof d.noir === 'object' ? d.noir : {}, ns = d.noirSeen && typeof d.noirSeen === 'object' ? d.noirSeen : {};
    Object.keys(nr).forEach(function (k) { if ((nr[k] === true || nr[k] === 'b') && canNoirP(p, k)) p.noir[k] = nr[k]; });   // 0.12.3 'b' = 현장 장면
    Object.keys(ns).forEach(function (k) { if (ns[k] === true && canNoirP(p, k)) p.noirSeen[k] = true; });
    var fr = d.fresh && typeof d.fresh === 'object' ? d.fresh : {};
    Object.keys(fr).forEach(function (k) { if (fr[k] === true && p.own[k]) p.fresh[k] = true; });
    save.pets = p;
    return p;
  }
  /** 0.10.6 도감에서 봤다(NEW 지우기) */
  function seeFresh(save, k) { var p = P(save); if (p.fresh) delete p.fresh[k]; }
  function freshCount(save) { var p = P(save); return p.fresh ? Object.keys(p.fresh).length : 0; }
  /* ---------- 코드네임(0.8.4, 안에서는 noir) ----------
     전설 등급이면 바로, 그 밖의 등급은 ★5(최고)가 되면 열린다. 켜면 파트너 카드 · 도감 자세히 · 출동 머리 사진이 누아르 그림으로.
     상황실(사무실) 안 파트너는 늘 귀여운 모습 그대로. 효과는 없음(꾸미기). */
  // 코드네임(0.8.4): 종마다 하나. 성격 한 줄(line)에서 따왔다. 켜면 초상이 누아르 그림으로, 이름 옆에 코드네임이 붙는다
  var CODENAME = {"corgi": "에코", "shiba": "스톤페이스", "hamster": "포켓", "rabbit": "안테나", "bear": "그리즐리", "hedgehog": "니들", "duck": "패들", "frog": "재즈", "ragdoll": "블루아이", "siamese": "마스크", "fox": "폴리그래프", "penguin": "턱시도", "monkey": "스카이워치", "squirrel": "컬렉터", "koala": "슬리퍼", "raccoon": "밴딧", "owl": "제로쓰리", "otter": "다이버", "panda": "모노크롬", "tiger": "헌터", "sheep": "클라우드", "pig": "트러플", "redpanda": "메이플", "alpaca": "패커", "seal": "하버", "hippo": "부스터", "turtle": "아이언쉘", "mouse": "크랙", "lion": "킹", "deer": "실버벨", "wolf": "고스트"};
  function codename(id) { return CODENAME[id] || ''; }
  function canNoirP(p, k) { var x = parse(k); return !!(x && p.own[k] && (x.g === 'l' || p.own[k] >= STAR_MAX)); }
  function canNoir(save, k) { return canNoirP(P(save), k); }
  function noirOn(save, k) { var p = P(save); return !!(p.noir[k] && canNoirP(p, k)); }
  /** 코드네임 그림의 장면: 'a' 사무실, 'b' 현장 */
  function noirScene(save, k) { return P(save).noir[k] === 'b' ? 'b' : 'a'; }
  function setNoir(save, k, on) {
    var p = P(save);
    if (!canNoirP(p, k)) return false;
    if (on) p.noir[k] = on === 'b' ? 'b' : true; else delete p.noir[k];
    p.noirSeen[k] = true;
    return true;
  }
  // 각성이 새로 열렸는데 아직 안 알려 준 동물들(처음 알릴 때 한 번 깜짝 보여 주려고)
  function noirNew(save) { var p = P(save); return Object.keys(p.own).filter(function (k) { return canNoirP(p, k) && !p.noirSeen[k]; }); }
  function noirSeen(save, k) { var p = P(save); if (canNoirP(p, k)) p.noirSeen[k] = true; }
  function P(save) { return save.pets && save.pets.own ? save.pets : clean(save); }

  /* ---------- 이름(0.3.0) ---------- */
  // 줄바꿈·제어 문자·꺾쇠를 빼고 NAME_MAX 글자까지(이모지도 한 글자로 센다)
  function cleanText(v) {
    if (typeof v !== 'string') return '';
    return Array.from(v.replace(/\s+/g, ' ').replace(/[\u0000-\u001f\u007f<>]/g, '').trim()).slice(0, NAME_MAX).join('');
  }
  /** 그 동물의 이름(지어 준 이름이 없으면 종류의 기본 이름) */
  function nameOf(save, k) {
    var x = parse(k), p = save && save.pets;
    if (!x) return '';
    return (p && p.names && p.names[k]) || BY_ID[x.id].name;
  }
  /** 다음 이름 바꾸기 값(배지). 게임 전체에서 첫 한 번은 0 */
  function renameCost(save) { return P(save).freeName ? RENAME_GEMS : 0; }
  /** 이름 짓기. 반환 { name, paid } */
  function rename(save, k, name) {
    var p = P(save), x = parse(k);
    if (!x || !p.own[k]) throw PetError('NOT_OWNED', '없는 동물');
    var v = cleanText(name);
    if (!v) throw PetError('EMPTY', '이름이 비었다');
    if (v === nameOf(save, k)) throw PetError('SAME', '같은 이름');
    var c = renameCost(save), tag = false;
    if (c === 0) p.freeName = true;
    else if ((save.nameTags || 0) > 0) { save.nameTags -= 1; tag = true; c = 0; }   // 이름표가 있으면 배지 대신(idle.NAME_TAGS)
    else if (!(save.gems >= c)) throw PetError('NOT_ENOUGH', '배지가 모자란다');
    else save.gems -= c;
    if (v === BY_ID[x.id].name) delete p.names[k]; else p.names[k] = v;
    return { name: v, paid: c, tag: tag };
  }
  /** 기본 이름으로 되돌리기(무료) */
  function resetName(save, k) { var p = P(save); delete p.names[k]; return nameOf(save, k); }

  /* ---------- 의상(0.3.1) ---------- */
  function outfitOpen(save, id) { var o = OUTFIT_BY[id]; return !!o && (!o.need || (save.caseNo || 1) >= o.need); }
  /** 의상 사기. pay = 'treats' | 'gems' */
  function buyOutfit(save, id, pay) {
    var o = OUTFIT_BY[id], p = P(save);
    if (!o) throw PetError('BAD_OUTFIT', '모르는 의상');
    if (p.closet[id]) throw PetError('ALREADY', '이미 있다');
    if (!outfitOpen(save, id)) throw PetError('LOCKED', '아직 열리지 않았다');
    if (pay === 'treats') { if (p.treats < o.treats) throw PetError('NOT_ENOUGH', '간식이 모자란다'); p.treats -= o.treats; }
    else if (pay === 'gems') { if (!(save.gems >= o.gems)) throw PetError('NOT_ENOUGH', '배지가 모자란다'); save.gems -= o.gems; }
    else throw PetError('BAD_PAY', '간식 또는 배지');
    p.closet[id] = true;
    return o;
  }
  /** 입히기('' 이면 벗기기). 가진 동물 · 가진 의상만 */
  function wear(save, k, id) {
    var p = P(save);
    if (!p.own[k]) throw PetError('NOT_OWNED', '없는 동물');
    if (id && !p.closet[id]) throw PetError('NO_OUTFIT', '없는 의상');
    if (id) p.wear[k] = id; else delete p.wear[k];
    return id || '';
  }
  function wearing(save, k) { var p = save && save.pets; return p && p.wear && p.wear[k] || ''; }

  /* ---------- 0.12.0 파트너 배경 ----------
   *   파트너 탭에서 현재 파트너 뒤에 깔리는 그림(그림은 Team3BgPics, 움직임은 화면 쪽 CSS). 효과는 없고 꾸미기만.
   *   사건 배경 3장은 간식이나 배지, 움직이는 배경 3장은 배지, 황금 무대는 전설 파트너와 함께일 때만 보인다. */
  var BGS = [
    { id: 'office', name: '3팀 사무실', desc: '처음부터 있는 배경이에요.' },
    { id: 'alley', name: '비 오는 골목', treats: 300, gems: 30, desc: '사건 1의 골목이에요. 비가 내려요.' },
    { id: 'harbor', name: '해무항 부두', treats: 300, gems: 30, desc: '사건 2의 부두예요. 안개가 흘러요.' },
    { id: 'room', name: '면통실', treats: 300, gems: 30, desc: '사건 3의 면통실이에요. 형광등이 깜빡여요.' },
    { id: 'neon', name: '네온 거리', gems: 60, desc: '비 오는 네온 밤거리예요.' },
    { id: 'snow', name: '눈 오는 밤', gems: 60, desc: '달밤에 눈이 내려요.' },
    { id: 'roof', name: '잠복 옥상', gems: 60, desc: '별이 반짝이는 옥상이에요.' },
    { id: 'gold', name: '황금 무대', gems: 120, legend: true, desc: '전설 파트너와 함께일 때만 보여요.' }
  ];
  var BG_BY = {}; BGS.forEach(function (b) { BG_BY[b.id] = b; });
  function buyBg(save, id, pay) {
    var b = BG_BY[id], p = P(save);
    if (!b) throw PetError('BAD_BG', '모르는 배경');
    if (p.bgs[id]) throw PetError('ALREADY', '이미 있다');
    if (pay === 'treats' && b.treats) { if (p.treats < b.treats) throw PetError('NOT_ENOUGH', '간식이 모자란다'); p.treats -= b.treats; }
    else if (pay === 'gems' && b.gems) { if (!(save.gems >= b.gems)) throw PetError('NOT_ENOUGH', '배지가 모자란다'); save.gems -= b.gems; }
    else throw PetError('BAD_PAY', '이 배경은 그 재화로 살 수 없다');
    p.bgs[id] = true; p.bg = id;
    return b;
  }
  function useBg(save, id) { var p = P(save); if (!p.bgs[id]) throw PetError('NO_BG', '없는 배경'); p.bg = id; return BG_BY[id]; }
  /** 현재 화면에 깔리는 배경 id(황금 무대는 전설 파트너일 때만, 아니면 사무실) */
  function bgNow(save) {
    var p = P(save), b = BG_BY[p.bg] || BG_BY.office, x = parse(p.eq);
    return b.legend && !(x && x.g === 'l') ? 'office' : b.id;
  }

  /* ---------- 확률 ---------- */
  /** 등급 확률(%)과 한 마리 확률(%) — 화면에 공개하는 표 */
  function rates() {
    return GRADES.map(function (g) {
      return { g: g, name: GRADE[g].name, pct: GRADE[g].pct, each: Math.round(GRADE[g].pct / SPECIES.length * 1000) / 1000 };
    });
  }
  /** 천장을 포함한 실제 전설 확률(%) = 1 / 전설 하나에 드는 평균 횟수 */
  function effectiveLegend() {
    var p = GRADE.l.pct / 100, q = 1 - p, mean = (1 - Math.pow(q, PITY)) / p;
    return Math.round(1000 / mean) / 10;
  }
  function rollGrade(rng) {
    var x = rng() * 100, acc = 0;
    for (var i = GRADES.length - 1; i >= 0; i--) {   // 전설부터 깎아 내려간다(경계값이 일반 쪽으로 가게)
      acc += GRADE[GRADES[i]].pct;
      if (x < acc) return GRADES[i];
    }
    return 'c';
  }
  function rollSpecies(rng) {
    var i = Math.floor(rng() * SPECIES.length);
    return SPECIES[Math.min(SPECIES.length - 1, Math.max(0, i))].id;
  }

  /*
   * 픽업(0.4.0): 주마다 바뀌는 "이번 주 출동 동물". 영웅·전설이 나오면 반은 픽업 동물, 천장 전설은 픽업 확정.
   *   주는 월요일에 바뀐다(EPOCH 2026-01-05 월). 순서는 PICKUP_ORDER 를 돈다.
   */
  var PICKUP_ORDER = ['panda', 'tiger', 'raccoon', 'lion', 'owl', 'otter', 'redpanda', 'fox', 'ragdoll', 'penguin', 'seal', 'corgi', 'koala', 'deer', 'siamese', 'monkey', 'alpaca', 'shiba', 'squirrel', 'pig', 'rabbit', 'hamster', 'sheep', 'frog', 'bear', 'hippo', 'duck', 'hedgehog', 'mouse', 'turtle'];
  var PICKUP_RATE = 0.5, EPOCH = Date.UTC(2026, 0, 5);
  function dayNum(day) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day || ''); return m ? Math.floor((Date.UTC(+m[1], +m[2] - 1, +m[3]) - EPOCH) / 864e5) : 0; }
  function dayStr(n) { var d = new Date(EPOCH + n * 864e5), z = function (x) { return (x < 10 ? '0' : '') + x; }; return d.getUTCFullYear() + '-' + z(d.getUTCMonth() + 1) + '-' + z(d.getUTCDate()); }
  /** 그날의 픽업 { id, week, from, to(마지막 날), left(남은 날 수, 오늘 포함) } */
  function pickup(day) {
    var n = dayNum(day), w = Math.floor(n / 7), i = ((w % PICKUP_ORDER.length) + PICKUP_ORDER.length) % PICKUP_ORDER.length;
    return { id: PICKUP_ORDER[i], week: w, from: dayStr(w * 7), to: dayStr(w * 7 + 6), left: w * 7 + 7 - n };
  }

  /* ---------- 받기(중복 → 별 → 간식) ---------- */
  function treatBonus(save) { return Math.round(bonus(save).treat || 0); }
  /** 한 마리를 넣는다. 반환 { key, id, g, isNew, star, treats } */
  function grant(save, id, g) {
    var p = P(save), k = key(id, g), r = { key: k, id: id, g: g, isNew: false, star: 0, treats: 0 };
    if (!p.own[k]) { p.own[k] = 1; r.isNew = true; r.star = 1; if (!p.fresh) p.fresh = {}; p.fresh[k] = true; }
    else if (p.own[k] < STAR_MAX) { p.own[k] += 1; r.star = p.own[k]; }
    else { r.treats = GRADE[g].treat + treatBonus(save); p.treats += r.treats; r.star = STAR_MAX; }
    if (!p.eq) p.eq = k;   // 처음 가진 동물은 바로 파트너로
    return r;
  }

  /**
   * 뽑기. n = 1 | 10. pay = 'ticket' | 'gems'. rng 는 0 이상 1 미만.
   * 반환: { results:[grant 결과], paid:{ w, c } }
   */
  /*
   * opts(0.4.0): { day:'YYYY-MM-DD'(픽업 · 무료 뽑기에 필요), freeExtra: 하루 무료 뽑기 더(월정액 등) }
   *   pay 'free': 하루 FREE_DAILY(+freeExtra) 번, 1회만.
   */
  var FREE_DAILY = 1;
  function freeLeft(save, day, extra) {
    var p = P(save), used = p.free && p.free.day === day ? p.free.n : 0;
    return Math.max(0, FREE_DAILY + (extra || 0) - used);
  }
  function pull(save, n, pay, rng, opts) {
    if (!(n >= 1 && n <= MAX_PULL && n === Math.floor(n))) throw PetError('BAD_COUNT', '1~' + MAX_PULL + '회만');
    if (typeof rng !== 'function') throw PetError('BAD_RNG', 'rng 는 함수');
    opts = opts || {};
    var p = P(save), c, pk = opts.day ? pickup(opts.day).id : '';
    if (pay === 'free') {
      if (n !== 1 || !opts.day) throw PetError('BAD_COUNT', '무료 뽑기는 하루 정해진 만큼 1회씩');
      if (freeLeft(save, opts.day, opts.freeExtra) < 1) throw PetError('NOT_ENOUGH', '오늘 무료 뽑기를 다 썼다');
      p.free = { day: opts.day, n: (p.free && p.free.day === opts.day ? p.free.n : 0) + 1 };
      c = 0;
    } else if (pay === 'ticket') {
      c = n;
      if (p.tickets < c) throw PetError('NOT_ENOUGH', '뽑기권이 모자란다');
      p.tickets -= c;
    } else if (pay === 'gems') {
      c = gemCost(n);
      if (!(save.gems >= c)) throw PetError('NOT_ENOUGH', '배지가 모자란다');
      save.gems -= c;
    } else throw PetError('BAD_PAY', '뽑기권, 배지, 무료');
    var out = [];
    for (var i = 0; i < n; i++) {
      var g, forced = false;
      if (p.pity >= PITY - 1) { g = 'l'; forced = true; }   // 천장
      else g = rollGrade(rng);
      // 10마리마다 희귀 이상 1마리 보장: 묶음(10)의 마지막인데 그 묶음이 모두 일반이면 희귀로
      if ((i + 1) % 10 === 0 && g === 'c' && out.slice(i - 9).every(function (x) { return x.g === 'c'; })) g = 'r';
      p.pity = g === 'l' ? 0 : p.pity + 1;
      p.pulls += 1;
      // 픽업: 천장 전설은 확정, 영웅·전설은 반
      var id = pk && (forced || ((g === 'l' || g === 'h') && rng() < PICKUP_RATE)) ? pk : rollSpecies(rng);
      var r = grant(save, id, g);
      r.pickup = id === pk && (g === 'l' || g === 'h');
      out.push(r);
    }
    return { results: out, paid: { w: pay, c: c } };
  }

  /*
   * 친밀도(0.4.0): 하루 한 번 쓰다듬으면 그 동물과 "함께한 날"이 하루 는다. 날 수에 따라 단계, 단계마다 보상 한 번.
   *   since: 처음 쓰다듬은 날(함께한 지 며칠은 화면이 since 로 센다)
   */
  var BOND = [
    { lv: 1, days: 0 },
    { lv: 2, days: 3, give: { treats: 10 } },
    { lv: 3, days: 7, give: { treats: 20 } },
    { lv: 4, days: 14, give: { tickets: 3 } },
    { lv: 5, days: 30, give: { tickets: 5 } },
    { lv: 6, days: 60, give: { gems: 30 } }
  ];
  function bondOf(save, k) {
    var b = (P(save).bond[k]) || { days: 0, last: '', since: '' }, lv = BOND[0];
    BOND.forEach(function (x) { if (b.days >= x.days) lv = x; });
    var next = BOND[BOND.indexOf(lv) + 1] || null;
    return { days: b.days, last: b.last, since: b.since, lv: lv.lv, next: next ? next.days - b.days : 0 };
  }
  /** 쓰다듬기. 오늘 처음이면 하루 늘고, 단계가 오르면 보상을 준다. 반환 { counted, lv, up, give } */
  function pat(save, k, day) {
    var p = P(save);
    if (!p.own[k]) throw PetError('NOT_OWNED', '없는 동물');
    var b = p.bond[k] || (p.bond[k] = { days: 0, last: '', since: day });
    if (!b.since) b.since = day;
    if (b.last === day) return { counted: false, lv: bondOf(save, k).lv, up: false, give: null };
    var before = bondOf(save, k).lv;
    b.days += 1; b.last = day;
    var now = bondOf(save, k).lv, give = null;
    if (now > before) {
      give = BOND[now - 1].give || null;
      if (give) {
        if (give.treats) p.treats += give.treats;
        if (give.tickets) p.tickets += give.tickets;
        if (give.gems) save.gems = (save.gems || 0) + give.gems;
      }
    }
    return { counted: true, lv: now, up: now > before, give: give };
  }

  /*
   * 말(0.4.0): 종류마다 성격이 있는 말 + 상황 말. ctx { hour, capped, tickets, name }
   */
  var TALK = {
    corgi: ['킁킁! 범인 냄새가 나요!', '팀장님, 오늘도 출동해요?', '꼬리 흔드는 거 아니에요. 수사 중이에요.'],
    shiba: ['…흥. 잘했어요.', '보리는 원래 이렇게 생겼어요.', '피곤하면 쉬어요. 나 말고 팀장님이.'],
    hamster: ['볼에 증거 넣어 왔어요!', '해바라기씨 하나만…', '쪼르르! 다녀왔어요.'],
    rabbit: ['쫑긋! 무전이 들려요.', '회식 언제 해요?', '깡총깡총, 탐문 끝!'],
    bear: ['현장은 내가 지킨다.', '꿀… 아니 단서 찾았다.', '든든하지? 반장이니까.'],
    hedgehog: ['건드리면 따끔해요!', '범인은 제가 콕!', '가시는 부드러워요. 팀장님한테만.'],
    duck: ['꽥! 탐문 다녀왔어요.', '뒤뚱뒤뚱… 그래도 빨라요!', '물웅덩이에 발자국 있었어요!'],
    frog: ['비 오는 날이 좋아요.', '개굴! 해무항 가고 싶다.', '풍덩 하고 증거 건져 왔어요.'],
    ragdoll: ['안아 줘요… 수사는 그다음에.', '알리바이? 제 이름이에요.', '말랑말랑… 졸려요.'],
    siamese: ['이 가면은 원래 얼굴이에요.', '냥. 수상한 사람 봤어요.', '변장은 자신 있어요.'],
    fox: ['거짓말하면 다 보여요.', '여우 눈은 못 속여요.', '흐음, 그 진술 수상한데요?'],
    penguin: ['정복 다림질 끝!', '특별 출동은 제 담당이에요.', '뒤뚱… 아니 씩씩하게 출동!'],
    monkey: ['높은 데서 다 봤어요!', '바나나… 아니 단서!', '끽끽! 망보기 완료.'],
    squirrel: ['증거는 도토리처럼 모아 둬요.', '어디 숨겼더라…', '볼이 꽉 찼어요!'],
    koala: ['…zzz 아, 잠복 중이었어요.', '코코는 잠복 전문이에요.', '나무 위가 제일 잘 보여요.'],
    raccoon: ['복면은 타고났어요.', '밤이 제 시간이에요.', '쓰레기통에서 단서 찾았어요!'],
    owl: ['새벽 3시 CCTV 확인 완료.', '부엉. 오늘도 야근이에요?', '어둠 속에서도 다 보여요.'],
    otter: ['물속 증거 건져 왔어요!', '조개 하나만 깨도 돼요?', '손 꼭 잡고 잠복해요.'],
    panda: ['전설은 바쁘지만 팀장님 곁엔 있어요.', '대나무… 아니 단서 먹고 싶다.', '데굴데굴. 그래도 수사는 확실히.'],
    tiger: ['범인 잡는 범이에요!', '어흥! 출동 준비 완료.', '무섭다고요? 귀여운 거예요.'],
    sheep: ['메에~ 푹신하죠?', '털 속에 단서 숨겨 왔어요.', '세다가 잠들면 안 돼요… 용의자를요.'],
    pig: ['킁킁! 이쪽이에요!', '간식 냄새도 잘 맡아요.', '복돌이 코는 못 속여요.'],
    redpanda: ['꼬리 줄무늬 예쁘죠?', '정보 하나 물어 왔어요!', '판다 아니에요. 레서판다예요!'],
    alpaca: ['준비물은 다 챙겼어요.', '침착하게, 침착하게.', '퉤… 아니 아무것도 아니에요.'],
    seal: ['부두 순찰 끝!', '물속은 제 구역이에요.', '몽실몽실… 졸려요.'],
    hippo: ['하~암. 다들 힘내요!', '하하 웃으면 사기 충전!', '물 밖에서도 잘해요.'],
    turtle: ['천천히, 하지만 확실하게.', '등딱지 안이 제일 안전해요.', '잠복은 끈기예요.'],
    mouse: ['찍! 장비 구해 왔어요.', '좁은 틈도 문제없어요.', '치즈 한 조각만…'],
    lion: ['갈기 휘날리며 출동!', '어흥! 대장은 나야.', '사자도 쓰다듬는 거 좋아해요.'],
    deer: ['딸랑딸랑, 순찰 중!', '뿔에 방울 달았어요.', '숲에서도 다 보여요.']
  };
  function talk(id, ctx, rng) {
    ctx = ctx || {};
    rng = typeof rng === 'function' ? rng : Math.random;
    var pool = (TALK[id] || ['…']).slice();
    if (typeof ctx.hour === 'number') {
      if (ctx.hour >= 6 && ctx.hour < 11) pool.push('좋은 아침이에요, 팀장님!');
      if (ctx.hour >= 22 || ctx.hour < 5) pool.push('졸려요… 그래도 잠복은 해야죠.');
    }
    if (ctx.capped) pool.push('팀장님, 주범 조가 기다려요!', '사무실이 꽉 찼어요! 출동해요!');
    if (ctx.tickets > 0) pool.push('뽑기권 있어요! 친구 데려와요.');
    return pool[Math.floor(rng() * pool.length) % pool.length];
  }

  /** 전설 선택권(0.4.0, 시즌 패스 보상): 전설 동물 하나를 골라 데려오기(이미 있으면 ★). 반환: grant 결과 */
  /** 0.9.0 한정 파트너 데려오기: ★5(최고)로. 이미 있으면 그대로 */
  function grantLimited(save, k) {
    var p = P(save), x = parse(k);
    if (!x || !BY_ID[x.id].limited) return null;
    var isNew = !p.own[k];
    p.own[k] = STAR_MAX;
    if (isNew) { if (!p.fresh) p.fresh = {}; p.fresh[k] = true; }
    p.noirSeen[k] = true;   // 상점 칸에서 코드네임을 이미 보여 줬다 → 각성 알림은 다시 띄우지 않는다
    return { key: k, isNew: isNew };
  }
  function usePick(save, id) {
    var p = P(save);
    if (!BY_ID[id]) throw PetError('BAD_PET', '모르는 동물');
    if (BY_ID[id].limited) throw PetError('LIMITED', '한정 파트너는 상점에서만');
    if (!(p.picks.l > 0)) throw PetError('NOT_ENOUGH', '선택권이 없다');
    if (p.own[key(id, 'l')] >= STAR_MAX) throw PetError('MAXED', '이미 ★5');
    p.picks.l -= 1;
    return grant(save, id, 'l');
  }
  /** 간식으로 원하는 동물 받기. 반환: grant 결과 */
  function swap(save, id, g) {
    if (!BY_ID[id] || !GRADE[g]) throw PetError('BAD_PET', '모르는 동물');
    if (BY_ID[id].limited) throw PetError('LIMITED', '한정 파트너는 상점에서만');   // 0.9.0 간식으로 데려오기 막기
    var p = P(save), c = GRADE[g].swap;
    if (p.own[key(id, g)] >= STAR_MAX) throw PetError('MAXED', '이미 ★5');
    if (p.treats < c) throw PetError('NOT_ENOUGH', '간식이 모자란다');
    p.treats -= c;
    return grant(save, id, g);
  }
  function equip(save, k) {
    var p = P(save);
    if (!p.own[k]) throw PetError('NOT_OWNED', '없는 동물');
    p.eq = k;
    return k;
  }
  /** 무료 뽑기권 주기(보상) */
  function addTickets(save, n) { var p = P(save); p.tickets += Math.max(0, Math.floor(n) || 0); return p.tickets; }
  /** 한 번만 주는 뽑기권 보상(사건 종결 등). 이미 받았으면 0 */
  function giftOnce(save, k, n) {
    var p = P(save);
    if (!/^[a-z0-9_-]{1,24}$/.test(k) || p.gifts[k]) return 0;
    p.gifts[k] = true; p.tickets += n;
    return n;
  }
  /** 처음 뽑기 창을 열 때 선물. 이미 받았으면 0 */
  function claimWelcome(save) {
    var p = P(save);
    if (p.welcome) return 0;
    p.welcome = true; p.tickets += WELCOME;
    return WELCOME;
  }

  /* ---------- 효과 ---------- */
  function starMul(star) { return 1 + STAR_STEP * ((star || 1) - 1); }
  /** 한 마리의 보유 효과 { 갈래: 값 } */
  function ownEffect(id, g, star) {
    var s = BY_ID[id], v = OWN_VAL[g][s.own === 'cap' ? 'min' : 'pct'] * starMul(star), o = {};
    o[s.own] = v;
    return o;
  }
  /** 한 마리의 장착 효과 { 갈래: 값 }(⚡ 포함 — 영웅 이상만) */
  function eqEffect(id, g, star) {
    var s = BY_ID[id], m = GRADE_MUL[g] * starMul(star), o = {};
    Object.keys(s.eq).forEach(function (k) { o[k] = s.eq[k] * m; });
    if (s.zap && (g === 'h' || g === 'l')) Object.keys(s.zap).forEach(function (k) { o[k] = s.zap[k] + (g === 'l' && k === 'time' ? 2 : 0); });
    return o;
  }
  function add(a, b) { Object.keys(b).forEach(function (k) { a[k] = (a[k] || 0) + b[k]; }); return a; }

  /**
   * 지금 켜진 효과의 합. opts.hour(0~23, 기기 시각)이 있으면 부엉이 밤 효과를 센다. opts.caseNo 로 개구리 효과를 센다.
   * 반환(모두 숫자, 없으면 0): pay idle speed cap off gear prep party night daily buff treat shield miss time combo
   *   pay·idle 에는 case2·owl 이 조건에 맞을 때 더해져 있다.
   */
  /*
   * 세트 보너스(0.4.0)
   *   종류 세트: 한 종류의 네 등급을 다 모으면 그 종류의 보유 효과가 두 배.
   *   등급 세트: 한 등급의 모든 종류(30종)를 다 모으면 GRADE_SET 보너스.
   */
  var GRADE_SET = { c: { idle: 5 }, r: { pay: 5 }, h: { cap: 60 }, l: { pay: 10, idle: 10 } };
  function sets(save) {
    var p = P(save), sp = {}, gr = {};
    SPECIES.forEach(function (s) { sp[s.id] = GRADES.every(function (g) { return !!p.own[key(s.id, g)]; }); });
    GRADES.forEach(function (g) { gr[g] = SPECIES.every(function (s) { return !!p.own[key(s.id, g)]; }); });
    return { species: sp, grades: gr };
  }
  function bonus(save, opts) {
    var p = save && save.pets && save.pets.own ? save.pets : null, b = {};
    if (!p) return zero();
    var st = sets(save);
    Object.keys(p.own).forEach(function (k) {
      var x = parse(k);
      if (!x) return;
      var e = ownEffect(x.id, x.g, p.own[k]);
      if (st.species[x.id]) Object.keys(e).forEach(function (q) { e[q] *= 2; });   // 종류 세트: 보유 효과 두 배
      add(b, e);
    });
    GRADES.forEach(function (g) { if (st.grades[g]) add(b, GRADE_SET[g]); });
    var e = parse(p.eq);
    if (e && p.own[p.eq]) add(b, eqEffect(e.id, e.g, p.own[p.eq]));
    opts = opts || {};
    if (b.case2 && opts.caseNo === 2) { b.pay = (b.pay || 0) + b.case2; b.idle = (b.idle || 0) + b.case2; }
    if (b.owl && typeof opts.hour === 'number' && (opts.hour >= 22 || opts.hour < 6)) { b.pay = (b.pay || 0) + b.owl; b.idle = (b.idle || 0) + b.owl; }
    Object.keys(CAPS).forEach(function (k) { if (b[k] > CAPS[k]) b[k] = CAPS[k]; });
    var z = zero();
    Object.keys(z).forEach(function (k) { z[k] = b[k] || 0; });
    return z;
  }
  function zero() { return { pay: 0, idle: 0, speed: 0, cap: 0, off: 0, gear: 0, prep: 0, party: 0, night: 0, daily: 0, buff: 0, treat: 0, case2: 0, owl: 0, shield: 0, miss: 0, time: 0, combo: 0 }; }

  /** 효과 { 갈래: 값 } → 사람이 읽는 줄 목록 */
  function describe(eff) {
    return Object.keys(eff).map(function (k) {
      var L = LABEL[k], v = L && L[2] === '%' || L && L[2] === '%p' ? Math.round(eff[k] * 10) / 10 : Math.round(eff[k]);   // 퍼센트는 소수 한 자리, 분·초·개는 정수
      return L ? L[0] + ' ' + L[1] + v + L[2] : k + ' ' + v;
    });
  }
  /** 도감 수집 현황 { have, total, byGrade:{c:n,...} } */
  function progress(save) {
    var p = P(save), by = { c: 0, r: 0, h: 0, l: 0 }, have = 0;
    Object.keys(p.own).forEach(function (k) { var x = parse(k); if (x) { by[x.g] += 1; have += 1; } });
    return { have: have, total: SPECIES.length * GRADES.length, byGrade: by };
  }

  return {
    codename: codename, CODENAME: CODENAME,
    BGS: BGS, BG_BY: BG_BY, buyBg: buyBg, useBg: useBg, bgNow: bgNow,
    LIMITED: LIMITED, grantLimited: grantLimited,
    canNoir: canNoir, noirOn: noirOn, noirScene: noirScene, setNoir: setNoir, noirNew: noirNew, noirSeen: noirSeen,
    GRADES: GRADES, GRADE: GRADE, GRADE_MUL: GRADE_MUL, SPECIES: SPECIES, BY_ID: BY_ID, OWN_KIND: OWN_KIND,
    STAR_MAX: STAR_MAX, PITY: PITY, COST: COST, MAX_PULL: MAX_PULL, gemCost: gemCost, maxPull: maxPull, WELCOME: WELCOME, CAPS: CAPS,
    key: key, parse: parse, clean: clean, rates: rates, effectiveLegend: effectiveLegend, rollGrade: rollGrade, pull: pull, grant: grant, swap: swap, equip: equip,
    addTickets: addTickets, claimWelcome: claimWelcome, giftOnce: giftOnce,
    usePick: usePick, BOND: BOND, bondOf: bondOf, pat: pat, TALK: TALK, talk: talk, PICKUP_ORDER: PICKUP_ORDER, PICKUP_RATE: PICKUP_RATE, pickup: pickup, FREE_DAILY: FREE_DAILY, freeLeft: freeLeft, GRADE_SET: GRADE_SET, sets: sets,
    seeFresh: seeFresh, freshCount: freshCount,
    OUTFITS: OUTFITS, OUTFIT_BY: OUTFIT_BY, outfitOpen: outfitOpen, buyOutfit: buyOutfit, wear: wear, wearing: wearing,
    NAME_MAX: NAME_MAX, RENAME_GEMS: RENAME_GEMS, cleanText: cleanText, nameOf: nameOf, renameCost: renameCost, rename: rename, resetName: resetName, ownEffect: ownEffect, eqEffect: eqEffect, bonus: bonus, describe: describe,
    starMul: starMul, progress: progress, zero: zero
  };
});
