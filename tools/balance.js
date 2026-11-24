/*
 * 전체 균형 시뮬레이터(0.10.6). 실제 규칙 모듈을 그대로 불러 "봇"이 며칠 동안 게임을 하게 한다.
 *
 *   구조(의존): idle(팀 · 사건 · 출동 보상) ← dept(부서 수입) · evidence(재수사 · 증거판) · crew(직무 · 장비 · 기법) · pets(파트너)
 *               economy(특별 출동 · 첫 메달) · monet(시즌 패스 · 광고 한도) · quest(임무) · attend(출석) · ach(업적) · office(이송)
 *   봇 성향(PROFILE): 하루 접속 횟수 × 접속 길이, 접속 한 번의 출동 수, 퍼즐 솜씨(검거 1건에 걸리는 초 · 연속이 끊길 확률), 광고 시청 수.
 *   사는 법: "하루 평균 수입 증가 ÷ 값"이 가장 좋은 것부터(회수 기간 2일 안쪽만). 재수사: 받을 단서 ≥ max(3, 가진 단서 × 0.6) 이고 지난 재수사 뒤 접속 2시간.
 *   무과금 기준(배지는 뽑기 10회 묶음에만 쓴다).
 *
 * 사용: node tools/balance.js [일수=60] [성향=casual|regular|hard|all] [seed=1]
 * 출력: 사건 종결 · 재수사 시점, 날짜별 상태 표, 재화 수급 표. 화면 · 시계와 무관(시각은 봇이 흘려보낸다).
 */
'use strict';
const I = require('../src/idle.js'), D = require('../src/dept.js'), Ev = require('../src/evidence.js'), Cr = require('../src/crew.js'), O = require('../src/office.js');
const P = require('../src/pets.js'), E = require('../src/economy.js'), M = require('../src/monet.js'), Q = require('../src/quest.js'), At = require('../src/attend.js'), H = require('../src/ach.js');

const PROFILES = {
  //            접속/일  분/접속  출동/접속  검거당 초  끊김   광고(뽑기권 · 배지 · 2배 비율)
  casual:  { name: '가볍게', ses: 3, min: 8,  runs: 1, hitSec: 8.0, brk: 0.25, adT: 0, adG: 0, adDouble: 0 },
  regular: { name: '보통',   ses: 4, min: 15, runs: 3, hitSec: 6.0, brk: 0.12, adT: 2, adG: 2, adDouble: 0.3 },
  hard:    { name: '열심히', ses: 6, min: 30, runs: 8, hitSec: 4.6, brk: 0.05, adT: 5, adG: 5, adDouble: 0.8 }
};
if (process.env.DEPT_PAY) D.LIST.forEach(x => { x.pay *= +process.env.DEPT_PAY; });   // 실험: 부서 수입 배수
const DAYS = +process.argv[2] || 60, WHO = process.argv[3] || 'all', SEED = +process.argv[4] || 1;
const SNAP = [1, 2, 3, 5, 7, 10, 14, 21, 30, 45, 60, 90];
const fmt = n => n >= 1e12 ? (n / 1e12).toFixed(1) + '조' : n >= 1e8 ? (n / 1e8).toFixed(1) + '억' : n >= 1e4 ? (n / 1e4).toFixed(1) + '만' : String(Math.round(n));
const dayStr = t => new Date(t).toISOString().slice(0, 10);

function simulate(pf, days, seed) {
  // ---- 준비 ----
  let a = seed >>> 0; const rng = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const T0 = Date.UTC(2026, 0, 5); let T = T0;
  const s = I.newSave(T); s.tutorialDone = true;
  D.clean(s); Ev.clean(s); Cr.clean(s); O.clean(s); P.clean(s); M.clean(s); Q.clean(s); At.clean(s); H.clean(s);
  const src = { gems: {}, tickets: {}, treats: {} }, add = (k, w, v) => { if (v) src[k][w] = (src[k][w] || 0) + v; };
  let evB = null, petB = null;                      // 효과 캐시(증거판 · 파트너는 바뀔 때만 다시 센다)
  const bonus = sv => {
    const b = {}, put = o => Object.keys(o).forEach(k => { b[k] = (b[k] || 0) + (o[k] || 0); });
    put(petB || (petB = P.bonus(sv, { caseNo: sv.caseNo, hour: 12 }))); put(Cr.bonus(sv)); put(evB || (evB = Ev.bonus(sv)));
    return b;
  };
  const deptMult = sv => I.moneyMult(sv) * (1 + (bonus(sv).dept || 0) / 100);
  I.setBonus(bonus); I.setExtraIncome(sv => D.perSec(sv, deptMult(sv))); I.setEarn((sv, v) => Ev.earn(sv, v));
  E.setDailyExtra(sv => H.dailyExtraTries(sv));
  const grant = (why) => (kind, v) => { if (kind === 'tickets') { P.addTickets(s, v); add('tickets', why, v); } else if (kind === 'treats') { s.pets.treats += v; add('treats', why, v); } };
  const gemsBy = (why, fn) => { const g0 = s.gems; const r = fn(); add('gems', why, s.gems - g0); return r; };

  // ---- 출동 점수 모델: 검거 1건에 hitSec 초(성공마다 +2초), 연속이 brk 확률로 끊긴다 ----
  const runDur = () => 90 + 10 * s.gear.time + (bonus(s).time || 0);
  function runResult(dur, noisy) {
    const hits = Math.max(1, Math.floor(dur / Math.max(1.5, pf.hitSec - 2)));
    const cmax = 3 + (bonus(s).combo || 0); let combo = 0, score = 0;
    for (let i = 0; i < hits; i++) {
      if (noisy ? rng() < pf.brk : false) combo = 0;
      combo++; score += 100 * Math.min(cmax, 1 + 0.5 * (combo - 1)) * (noisy ? 1 : 1 - pf.brk * 0.6);
    }
    return { score: Math.round(score), hits };
  }
  const runMoney = () => runResult(runDur(), false).score * I.moneyMult(s) * (1 + (bonus(s).pay || 0) / 100);

  // ---- 하루 평균 초당 수입(사는 순서를 정하는 잣대) ----
  const onlineSec = pf.ses * pf.min * 60, gapSec = (16 * 3600 - onlineSec) / pf.ses, nightSec = 8 * 3600;
  function measure() {
    const b = bonus(s), cap = I.TUNE.offlineCapSec + (b.cap || 0) * 60, off = Math.min(1, I.TUNE.offlineRate + (b.off || 0) / 100);
    const offSec = (Math.min(gapSec, cap) * (pf.ses - 1) + Math.min(nightSec + gapSec, cap)) * off;
    const team = I.teamRate(s) * I.payPerCatch(s), dept = D.perSec(s, deptMult(s));
    const prog = s.caught < I.caseOf(s).idleCap ? 1 : 0;      // 사건 진척도 값으로 친다(팀 한계 전까지)
    return (team * (onlineSec * (2.2 + prog) + offSec * (1 + prog)) + dept * (onlineSec + offSec) + pf.ses * pf.runs * runMoney()) / 86400;
  }
  function options() {
    const out = [], b = bonus(s), disc = b.gear || 0;
    const tryOpt = (k, cost, apply, undo) => { if (cost == null) return; const m0 = measure(); apply(); const m1 = measure(); undo(); out.push({ k, c: cost, v: m1 - m0 }); };
    tryOpt('hire', I.cost(s, 'hire'), () => s.detectives++, () => s.detectives--);
    tryOpt('train', I.cost(s, 'train'), () => s.training++, () => s.training--);
    I.gearFor(s).forEach(g => tryOpt('g:' + g, I.cost(s, g), () => s.gear[g]++, () => s.gear[g]--));
    D.reveal(s);
    D.LIST.forEach(x => { if (s.dept.seen[x.id] && s.dept.n[x.id] < D.MAX) tryOpt('d:' + x.id, D.cost(s, x.id, 1), () => s.dept.n[x.id]++, () => s.dept.n[x.id]--); });
    Cr.rolesOpen(s).forEach(x => tryOpt('r:' + x.id, Cr.roleCost(s, x.id, disc), () => s.crew.r[x.id]++, () => s.crew.r[x.id]--));
    Cr.kitsOpen(s).forEach(x => tryOpt('k:' + x.id, Cr.kitCost(s, x.id, disc), () => s.crew.k[x.id]++, () => s.crew.k[x.id]--));
    Cr.techsOpen(s).forEach(x => tryOpt('t:' + x.id, Cr.techCost(s, x.id), () => s.crew.t[x.id]++, () => s.crew.t[x.id]--));
    return out;
  }
  const spent = {};
  function buyLoop(day) {
    for (let g = 0; g < 40; g++) {
      const ok = options().filter(o => o.c <= s.money && (o.v > 0 ? o.c / o.v < 2 * 86400 : o.c <= s.money * 0.02 && /^g:/.test(o.k)));
      if (!ok.length) return;
      ok.sort((x, y) => (y.v / y.c) - (x.v / x.c)); const o = ok[0], kind = o.k[0] === 'h' ? 'hire' : o.k.slice(0, 1);
      const m0 = s.money;
      if (o.k === 'hire' || o.k === 'train') { I.buy(s, o.k); if (o.k === 'hire') Q.track(s, 'hire', 1, day); }
      else if (o.k[0] === 'g') I.buy(s, o.k.slice(2));
      else if (o.k[0] === 'd') D.buy(s, o.k.slice(2), 1);
      else Cr.buy(s, o.k[0], o.k.slice(2), bonus(s).gear || 0);
      const cat = o.k === 'hire' ? '형사' : o.k === 'train' ? '훈련' : { g: '출동 장비', d: '부서', r: '직무', k: '공용 장비', t: '기법' }[kind];
      spent[cat] = (spent[cat] || 0) + (m0 - s.money);
    }
  }
  // ---- 증거판: 열 수 있는 가장 싼 증거부터, 남으면 강화 ----
  function boardBuy(day) {
    for (let g = 0; g < 300; g++) {
      const can = Ev.CARDS.filter(c => Ev.state(s, c.id) === 'can' && c.cost <= Ev.left(s)).sort((x, y) => x.cost - y.cost)[0];
      let up = null; Object.keys(s.evid.own).forEach(id => { const k = Ev.upCost(s, id); if (k != null && k <= Ev.left(s) && (!up || k < up.k)) up = { id, k }; });
      if (can && (!up || can.cost <= up.k)) { Ev.buyCard(s, can.id); Q.track(s, 'evid', 1, day); } else if (up) Ev.upgrade(s, up.id); else break;
    }
    evB = null;
  }
  // ---- 파트너: 뽑기권 · 무료 · 배지(10회 묶음) → 가장 좋은 파트너 장착 ----
  function pulls(day) {
    let n = 0; const one = (cnt, pay) => { const r = P.pull(s, cnt, pay, rng, { day }); n += cnt; return r; };
    if (!s.pets.welcome) add('tickets', '첫 선물', P.claimWelcome(s));
    while (P.freeLeft(s, day, 0) > 0) one(1, 'free');
    while (s.pets.tickets > 0) one(Math.min(P.MAX_PULL, s.pets.tickets), 'ticket');
    while (s.gems >= P.COST.ten) { add('gems', '뽑기에 씀', -P.COST.ten); one(10, 'gems'); }
    if (n) { Q.track(s, 'pull', n, day); petB = null; equipBest(); }
  }
  function equipBest() {
    let best = s.pets.eq, bv = -1;
    Object.keys(s.pets.own).forEach(k => { s.pets.eq = k; petB = null; const v = measure(); if (v > bv) { bv = v; best = k; } });
    s.pets.eq = best; petB = null;
  }

  // ---- 진행 ----
  const events = [], snaps = [], closes = [];
  let online = 0, lastRetreat = 0, done = false, runsTotal = 0;
  const log = t => events.push(`${((T - T0) / 864e5).toFixed(1)}일(접속 ${(online / 3600).toFixed(1)}h) ${t}`);
  function doRetreat(why, day) {
    const g = Ev.gainNow(s);
    Ev.retreat(s, { now: T, newTeam: (sv, st) => { I.resetTeam(sv, st); D.reset(sv); Cr.reset(sv); sv.office.cell = 0; } });
    lastRetreat = online; boardBuy(day);
    log(`재수사 ${s.evid.retreats}번(${why}) 단서 +${g} · 증거 ${Object.keys(s.evid.own).length}장`);
  }
  function oneRun(day, daily) {
    const dur = daily ? 75 : runDur(), r = runResult(dur, true), base = E.baseValue(s);
    T += Math.round(dur + r.hits * 2) * 1000; online += dur + r.hits * 2;
    tick();
    let medal = null;
    if (daily) { E.startDaily(s, day); H.noteDailyRun(s); }
    const pay = I.applyRun(s, { score: r.score, hits: r.hits }, T); runsTotal++;
    if (rng() < pf.adDouble) { s.money += pay.money; Ev.earn(s, pay.money); Q.track(s, 'ad', 1, day); }
    Q.track(s, 'run', 1, day); Q.track(s, 'caught', r.hits, day);
    if (daily) {
      Q.track(s, 'daily', 1, day);
      const d = gemsBy('특별 출동', () => E.applyDaily(s, day, r.score, base));
      if (d.isNew) { medal = d.medal; H.noteDaily(s, d.medal); P.addTickets(s, 1); add('tickets', '특별 출동', 1); if (d.medal === '금') Q.track(s, 'gold', 1, day); }
    } else {
      const ms = gemsBy('첫 메달', () => E.claimMedals(s, r.score, base));
      if (ms.length) { P.addTickets(s, 2 * ms.length); add('tickets', '첫 메달', 2 * ms.length); }
    }
    M.addXp(s, day, M.runXp(r.score, medal));
    const pr = gemsBy('승진', () => I.claimPromotions(s)); if (pr.length) { P.addTickets(s, 3 * pr.length); add('tickets', '승진', 3 * pr.length); }
  }
  function tick() { const r = I.advance(s, T); O.addCatches(s, r.catches); if (O.isFull(s)) { const m = s.money; O.transfer(s, I.payPerCatch(s)); Ev.earn(s, s.money - m); } }
  function chores(day) {
    if (At.canCheck(s, day)) { gemsBy('출석', () => At.check(s, day, grant('출석'))); Q.track(s, 'attend', 1, day); }
    if (s.pets.eq) { const r = P.pat(s, s.pets.eq, day); if (r.counted) Q.track(s, 'pat', 1, day); if (r.give && r.give.treats) add('treats', '친밀도', r.give.treats); }
    for (let i = 0; i < pf.adT; i++) { try { M.adUse(s, 'ticket', day); P.addTickets(s, 1); add('tickets', '광고', 1); Q.track(s, 'ad', 1, day); } catch (e) { break; } }
    for (let i = 0; i < pf.adG; i++) { try { M.adUse(s, 'gems', day); s.gems += 3; add('gems', '광고', 3); Q.track(s, 'ad', 1, day); } catch (e) { break; } }
  }
  function claims(day) {
    ['d', 'w', 'm'].forEach(sc => Q.list(s, sc, day).forEach(q => { if (q.done && !q.got) gemsBy('임무', () => Q.claim(s, q.id, day, grant('임무'))); }));
    ['d', 'w', 'm'].forEach(sc => { if (Q.boxState(s, day, sc).ready) gemsBy('임무', () => Q.claim(s, sc === 'd' ? 'box' : 'box:' + sc, day, grant('임무'))); });
    gemsBy('시즌 패스', () => M.claimPass(s, day, grant('시즌 패스')));
    try { H.check(s); const c = gemsBy('업적', () => H.claim(s, null, (sv, n) => P.addTickets(sv, n))); add('tickets', '업적', c.tickets); } catch (e) { /* 업적은 다른 모듈 값이 없으면 건너뛴다 */ }
    pulls(day);
  }

  for (let d = 0; d < days && !done; d++) {
    let dailyTries = 0;
    for (let ses = 0; ses < pf.ses && !done; ses++) {
      const day = dayStr(T);
      const r0 = I.advance(s, T, { offline: true }); O.addCatches(s, r0.catches);
      if (ses === 0) chores(day);
      const end = T + pf.min * 60000; let runs = 0, sinceBuy = 99;
      while (T < end && !done) {
        if (runs < pf.runs) {
          const st = E.dailyStatus(s, day), daily = st.left > 0 && st.paid < 2 && dailyTries < 2;
          if (daily) dailyTries++;
          oneRun(day, daily); runs++;
        } else { T += 10000; online += 10; tick(); }
        if (++sinceBuy >= 3) { sinceBuy = 0; buyLoop(day); }
        if (s.closed) {
          closes.push({ no: s.caseNo, day: (T - T0) / 864e5, online: online / 3600, runs: runsTotal, retreats: s.evid.retreats });
          log(`★ 사건 ${s.caseNo} 종결 · 형사 ${s.detectives} · 부서 ${D.total(s)} · 출동 ${runsTotal}번`);
          add('tickets', '사건 종결', P.giftOnce(s, 'case' + s.caseNo, 10));
          if (Ev.gainNow(s) >= 1) doRetreat('사건 종결', day);
          if (I.nextCase(s)) { I.moveToNextCase(s, T); petB = null; } else done = true;
        } else if (online - lastRetreat >= 7200 && (process.env.NAIVE === '1' || s.caught < I.caseOf(s).idleCap)) {   // 팀 한계를 넘긴 뒤(출동으로만 잡는 구간)에는 재수사하지 않는다 — 출동으로 잡은 진척이 사라지므로. NAIVE=1 이면 그래도 한다
          const g = Ev.gainNow(s); if (g >= Math.max(3, Math.ceil(s.evid.clues * 0.6))) doRetreat('막힘', day);
        }
      }
      claims(day);
      T += (ses === pf.ses - 1 ? nightSec + gapSec : gapSec) * 1000;
    }
    if (SNAP.includes(d + 1) || done) {
      const team = I.teamRate(s) * I.payPerCatch(s) * 60, dept = D.perSec(s, deptMult(s)) * 60, b = bonus(s), own = Object.keys(s.pets.own);
      snaps.push({ d: d + 1, case: `${s.caseNo}:${s.caught}/${I.caseOf(s).goal}`, det: s.detectives, tr: s.training, dept: D.total(s), team, deptM: dept, run: runMoney(), money: s.money,
        ret: s.evid.retreats, ev: Object.keys(s.evid.own).length, rank: I.rankOf(s).name, pulls: s.pets.pulls, dex: own.length, leg: own.filter(k => /:l$/.test(k)).length,
        pass: M.tierOf(M.passOf(s, dayStr(T)).xp), gems: s.gems, treats: s.pets.treats, pay: Math.round(b.pay || 0), idle: Math.round(b.idle || 0), speed: Math.round(b.speed || 0), deptB: Math.round(b.dept || 0) });
    }
  }
  return { pf, events, snaps, closes, src, spent, days: (T - T0) / 864e5, online: online / 3600, runs: runsTotal, done };
}

function report(r) {
  const L = [];
  L.push(`\n===== ${r.pf.name} (하루 ${r.pf.ses}번 × ${r.pf.min}분 · 접속당 출동 ${r.pf.runs}번 · 검거 1건 ${r.pf.hitSec}초) =====`);
  r.closes.forEach(c => L.push(`사건 ${c.no} 종결: ${c.day.toFixed(1)}일째 · 접속 누적 ${c.online.toFixed(1)}시간 · 출동 ${c.runs}번 · 재수사 ${c.retreats}번`));
  if (!r.done) L.push(`(${Math.round(r.days)}일 안에 사건 3을 못 닫음)`);
  L.push('일 | 사건:진척 | 형사/훈련 | 부서 | 팀/분 | 부서/분 | 출동1번 | 재수사·증거 | 계급 | 뽑기·도감(전설) | 패스 | 효과% 출동/팀/속도/부서');
  r.snaps.forEach(x => L.push(`${String(x.d).padStart(2)} | ${x.case} | ${x.det}/${x.tr} | ${x.dept} | ${fmt(x.team)} | ${fmt(x.deptM)} | ${fmt(x.run)} | ${x.ret}·${x.ev} | ${x.rank} | ${x.pulls}·${x.dex}(${x.leg}) | ${x.pass} | ${x.pay}/${x.idle}/${x.speed}/${x.deptB}`));
  const per = (o) => Object.keys(o).sort((a, b) => o[b] - o[a]).map(k => `${k} ${o[k] > 0 ? '+' : ''}${Math.round(o[k])}`).join(' · ');
  L.push(`배지: ${per(r.src.gems)}`); L.push(`뽑기권: ${per(r.src.tickets)}`); L.push(`간식: ${per(r.src.treats)}`);
  const tot = Object.values(r.spent).reduce((a, b) => a + b, 0) || 1;
  L.push('수사비 쓴 곳: ' + Object.keys(r.spent).sort((a, b) => r.spent[b] - r.spent[a]).map(k => `${k} ${(r.spent[k] / tot * 100).toFixed(0)}%`).join(' · '));
  return L.join('\n');
}

if (require.main === module) {
  const who = WHO === 'all' ? Object.keys(PROFILES) : [WHO];
  who.forEach(k => { const r = simulate(PROFILES[k], DAYS, SEED); console.log(report(r)); if (process.env.EVENTS) console.log(r.events.join('\n')); });
}
module.exports = { simulate, PROFILES, report };
