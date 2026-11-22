/*
 * 균형 시뮬레이터(0.7.0): 부서 · 재수사 · 증거판을 넣고 사건 1~3 을 얼마나 걸려 닫는지 본다.
 *   봇: 하루 4번 접속(15분씩), 나머지는 자리 비움(절반 속도 · 4시간 한도).
 *       접속 중에는 2분마다 현장 출동 1번(점수 SCORE, 검거 HITS), 5초마다 가장 효율 좋은 것 사기.
 *       재수사: 이번에 받을 단서 ≥ max(2, 지금까지 받은 단서 × RATIO) 이고 지난 재수사 뒤 접속 1시간이 지났으면.
 *       증거판: 재수사할 때마다 살 수 있는 가장 싼 카드부터 사서 같은 색끼리 붙여 꽂는다.
 * 사용: node tools/sim.js [일수=10] [RATIO=0.6] [재수사=1]
 */
'use strict';
const I = require('../src/idle.js'), D = require('../src/dept.js'), Ev = require('../src/evidence.js'), O = require('../src/office.js');
const DAYS = +process.argv[2] || 10, RATIO = process.argv[3] ? +process.argv[3] : 0.6, RETREAT = process.argv[4] !== '0';
const SCORE = 2500, HITS = 22, STEP = 5;
let T = Date.UTC(2026, 0, 1);
const s = I.newSave(T); s.tutorialDone = true; D.clean(s); Ev.clean(s); O.clean(s);
I.setBonus(sv => Ev.bonus(sv));
const NODEPT = process.env.NODEPT === '1';
I.setExtraIncome(sv => NODEPT ? 0 : D.perSec(sv, I.moneyMult(sv) * (1 + (Ev.bonus(sv).dept || 0) / 100)));
I.setEarn((sv, v) => Ev.earn(sv, v));
let online = 0, lastRetreatOnline = 0, events = [], sinceRun = 0;
function log(t) { events.push(`${(online / 3600).toFixed(2)}h 접속 · ${((T - Date.UTC(2026, 0, 1)) / 86400000).toFixed(1)}일 · ${t}`); }
function bestBuy() {
  // 효율 = 늘어나는 초당 수사비 / 값 (형사는 1명 수사비 × 속도 증가, 진척도 있으니 2배 가중)
  const opts = [];
  const pay = I.payPerCatch(s), rate = I.teamRate(s);
  const hc = I.cost(s, 'hire'); opts.push({ k: 'hire', c: hc, v: (rate / s.detectives) * pay * 2 });
  const tc = I.cost(s, 'train'); if (tc != null) opts.push({ k: 'train', c: tc, v: rate * pay * 0.6 });
  const mult = I.moneyMult(s) * (1 + (Ev.bonus(s).dept || 0) / 100);
  D.reveal(s);
  if (!NODEPT) D.LIST.forEach(x => { if (!s.dept.seen[x.id]) return; const before = D.perSec(s, mult); s.dept.n[x.id]++; const after = D.perSec(s, mult); s.dept.n[x.id]--; opts.push({ k: 'd:' + x.id, c: D.cost(s, x.id, 1), v: after - before }); });
  opts.sort((a, b) => b.v / b.c - a.v / a.c);
  return opts.find(o => o.c <= s.money);
}
function buyLoop() { for (let g = 0; g < 200; g++) { const o = bestBuy(); if (!o) return; if (o.k === 'hire' || o.k === 'train') I.buy(s, o.k); else D.buy(s, o.k.slice(2), 1); } }
function boardBuy() {
  const cards = Ev.CARDS.filter(c => Ev.tierOpen(s, c.tier) && !s.evid.own[c.id]).sort((a, b) => a.cost - b.cost);
  for (const c of cards) { if (Ev.left(s) < c.cost) break; Ev.buyCard(s, c.id); }
  // 남은 단서로 강화(싼 것부터)
  for (let g = 0; g < 500; g++) { let best = null; Object.keys(s.evid.own).forEach(id => { const k = Ev.upCost(s, id); if (k != null && k <= Ev.left(s) && (!best || k < best.k)) best = { id, k }; }); if (!best) break; Ev.upgrade(s, best.id); }
  // 다시 꽂기: 색별로 모아 열린 칸 순서대로(같은 색이 이웃하게)
  s.evid.pins = {};
  const open = Ev.ORDER.slice(0, Ev.openCount(s)), own = Object.keys(s.evid.own).map(id => Ev.BY_ID[id]).sort((a, b) => a.color < b.color ? -1 : a.color > b.color ? 1 : b.value - a.value);
  own.slice(0, open.length).forEach((c, i) => { s.evid.pins[open[i]] = c.id; });
}
let closed = 0, lastCase = 1;
for (let day = 0; day < DAYS; day++) {
  for (let ses = 0; ses < 4; ses++) {
    // 자리 비움(다음 접속까지 6시간 − 15분)
    const r = I.advance(s, T + 0, { offline: true }); O.addCatches(s, r.catches);
    for (let t = 0; t < 900; t += STEP) {
      T += STEP * 1000; online += STEP; sinceRun += STEP;
      const rr = I.advance(s, T); O.addCatches(s, rr.catches);
      if (sinceRun >= 120) { sinceRun = 0; I.applyRun(s, { score: SCORE, hits: HITS }, T); }
      if (O.isFull(s)) O.transfer(s, I.payPerCatch(s));
      buyLoop();
      const doRetreat = (why) => {
        const g = Ev.gainNow(s);
        Ev.retreat(s, { now: T, newTeam: (sv, st) => { I.resetTeam(sv, st); D.reset(sv); sv.office.cell = 0; } });
        lastRetreatOnline = online; boardBuy();
        log(`재수사 ${s.evid.retreats}번(${why}) · 단서 +${g} (모두 ${s.evid.clues}) · 카드 ${Object.keys(s.evid.own).length}장 · 효과 ${JSON.stringify(Ev.effects(s)).replace(/"[a-zA-Z]+":0,?/g, '')}`);
      };
      if (s.closed) {
        log(`사건 ${s.caseNo} 종결 (재수사 ${s.evid.retreats}번, 형사 ${s.detectives}, 부서 ${D.total(s)})`);
        if (RETREAT && Ev.gainNow(s) >= 1) doRetreat('사건 종결');
        if (I.nextCase(s)) { I.moveToNextCase(s, T); } else { day = DAYS; break; }
      } else if (RETREAT && online - lastRetreatOnline >= 7200) {
        const g = Ev.gainNow(s), have = s.evid.clues;
        if (g >= Math.max(3, Math.ceil(have * RATIO))) doRetreat('막힘');
      }
    }
    T += (6 * 3600 - 900) * 1000;
  }
  log(`하루 끝: 사건 ${s.caseNo} ${s.caught}/${I.caseOf(s).goal} · 형사 ${s.detectives} · 훈련 ${s.training} · 부서 ${D.total(s)} · 초당 부서 ${Math.round(D.perSec(s, I.caseOf(s).pay))} · 수사비 ${Math.round(s.money)} · 받을 단서 ${Ev.gainNow(s)}`);
}
console.log(events.join('\n'));
