/*
 * 수사 3팀 — 출동 화면 전환(컷 연출)
 *
 * 화면을 한 번 덮었다가(cover) → 그 사이에 화면을 바꾸고(onSwap) → 다시 연다(reveal).
 *   평소 출동:   A 셔터 / B 폴리스 라인 / C 사건 파일   — 무작위(바로 전과 같은 건 피함)
 *   주범 조 출동: E 긴급 무전 / F 수배서 / G 작전 개시(경광등 + 빨간 셔터) — 무작위(바로 전과 같은 건 피함)
 *
 * 구조
 *   - 연출마다 cover(layer) → hold → reveal(layer) 세 토막. 공통 흐름은 play() 하나가 맡는다.
 *   - onSwap 은 어떤 일이 있어도(연출 오류, 애니메이션 미지원) 정확히 한 번 불린다 → 출동이 막히지 않는다.
 *   - 끝나면 덮개(layer)를 반드시 지운다(화면을 가린 채 남지 않게).
 *   - 움직임 줄이기 설정이면 짧은 암전 컷만.
 *   - 스타일은 이 파일이 한 번만 <style> 로 넣는다(게임과 미리보기 페이지가 같은 코드를 쓴다).
 *   - pick() 은 화면 없이 시험할 수 있는 순수 함수(node 단위 테스트).
 */
(function (root) {
  'use strict';

  var NORMAL = ['A', 'B', 'C'];
  var BIG = ['E', 'F', 'G'];

  // 목록에서 하나 고른다. 바로 전에 나온 것(last)은 피한다. rnd 는 0~1 난수 함수(시험용으로 바꿔 끼운다)
  function pick(list, last, rnd) {
    if (!list || !list.length) throw new Error('pick: 빈 목록');
    var pool = list.length > 1 ? list.filter(function (k) { return k !== last; }) : list.slice();
    var r = typeof rnd === 'function' ? rnd() : Math.random();
    if (!(r >= 0 && r < 1)) r = 0;               // 이상한 난수(NaN, 1 이상)는 첫 번째로
    return pool[Math.floor(r * pool.length)];
  }

  if (typeof document === 'undefined') {           // node(단위 테스트): 순수 함수만 내보낸다
    if (typeof module !== 'undefined') module.exports = { pick: pick, NORMAL: NORMAL, BIG: BIG };
    return;
  }

  /* ---------- 스타일(한 번만) ---------- */
  var CSS = [
    '.tr-layer{position:absolute;inset:0;z-index:9;overflow:hidden;pointer-events:none;contain:strict}',
    '.tr-layer *{box-sizing:border-box}',
    '.tr-bh{font-family:"Black Han Sans",sans-serif;font-weight:400}',
    /* A 셔터: 강철판(가로 골) + 맞물리는 가장자리에 노랑·검정 경고 띠 */
    '.tr-plate{position:absolute;left:0;right:0;height:50.5%;display:flex;justify-content:center;',
    '  background:repeating-linear-gradient(180deg,rgba(255,255,255,.035) 0 2px,transparent 2px 9px),linear-gradient(180deg,#262c38,#1a1f29);',
    '  box-shadow:0 0 0 1px rgba(0,0,0,.4),0 12px 30px rgba(0,0,0,.55)}',
    '.tr-plate.top{top:0;align-items:flex-end;padding-bottom:30px}',
    '.tr-plate.bot{bottom:0;align-items:flex-start;padding-top:26px}',
    '.tr-hazard{position:absolute;left:0;right:0;height:10px;background:repeating-linear-gradient(-45deg,#FFD23F 0 10px,#15181f 10px 20px)}',
    '.tr-plate.top .tr-hazard{bottom:0}.tr-plate.bot .tr-hazard{top:0}',
    '.tr-a-main{font-size:44px;letter-spacing:.18em;color:#FFD23F;text-shadow:0 2px 0 rgba(0,0,0,.5)}',
    '.tr-a-sub{font-size:12px;font-weight:600;letter-spacing:.42em;color:#8d97a8}',
    /* B 폴리스 라인: 남색 판 + 노란 테이프 한 줄(검정 글씨) */
    '.tr-b-panel{position:absolute;left:-70%;top:-50%;width:240%;height:200%;display:flex;align-items:center;',
    '  background:linear-gradient(90deg,rgba(0,0,0,.35),transparent 18%,transparent 82%,rgba(0,0,0,.35)),#14284B}',
    '.tr-b-tape{width:100%;height:58px;display:flex;align-items:center;overflow:hidden;white-space:nowrap;background:#FFD23F;',
    '  box-shadow:inset 0 3px 0 rgba(255,255,255,.35),inset 0 -3px 0 rgba(0,0,0,.18),0 6px 18px rgba(0,0,0,.45)}',
    '.tr-b-text{font-size:22px;letter-spacing:.14em;color:#0b0b0b;padding-left:20%}',
    /* C 사건 파일: 마닐라 폴더(탭) + 종이 결 + 빨간 도장 */
    '.tr-c-file{position:absolute;left:6%;right:6%;top:9%;bottom:7%;border-radius:4px 10px 8px 8px;transform-origin:50% 0;',
    '  background:repeating-linear-gradient(0deg,rgba(90,60,20,.05) 0 1px,transparent 1px 4px),linear-gradient(160deg,#dcbf86,#c8a56a 60%,#b99558);',
    '  box-shadow:0 18px 40px rgba(0,0,0,.55);padding:34px 22px;color:#3a2a10}',
    '.tr-c-tab{position:absolute;left:18px;top:-16px;width:42%;height:18px;border-radius:6px 6px 0 0;background:#d4b67c}',
    '.tr-c-k{font-size:11px;font-weight:700;letter-spacing:.32em;opacity:.75}',
    '.tr-c-no{margin-top:12px;font-family:ui-monospace,Menlo,monospace;font-size:13px;letter-spacing:.08em;opacity:.8}',
    '.tr-c-t{margin-top:4px;font-size:30px;line-height:1.15}',
    '.tr-c-line{margin-top:14px;height:1px;background:rgba(58,42,16,.25)}',
    '.tr-c-row{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px dashed rgba(58,42,16,.25);font-size:13px}',
    '.tr-c-row span{opacity:.65}.tr-c-row b{font-weight:600}',
    '.tr-c-file{display:flex;flex-direction:column}',
    '.tr-stamp{position:absolute;padding:6px 16px;border:4px double #b3261e;border-radius:6px;color:#b3261e;font-size:30px;letter-spacing:.2em;',
    '  background:rgba(179,38,30,.06);mix-blend-mode:multiply}',
    /* E 긴급 무전: 빨간 경보 테두리 → 주사선 검은 화면에 무전 글자 */
    '.tr-e-alarm{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 35%,rgba(210,30,30,.75) 100%)}',
    '.tr-e-scr{position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.035) 0 1px,transparent 1px 3px),#07090c;',
    '  display:flex;flex-direction:column;justify-content:center;padding:0 26px;gap:14px}',
    '.tr-e-hd{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;letter-spacing:.3em;color:#ff5c5c}',
    '.tr-e-dot{width:9px;height:9px;border-radius:50%;background:#ff3b3b;box-shadow:0 0 10px #ff3b3b}',
    '.tr-e-txt{font-family:ui-monospace,Menlo,monospace;font-size:19px;line-height:1.6;color:#8ef0a4;white-space:pre-line;min-height:62px;text-shadow:0 0 8px rgba(142,240,164,.35)}',
    '.tr-e-cur{display:inline-block;width:10px;height:19px;margin-left:2px;vertical-align:-3px;background:#8ef0a4}',
    /* F 수배서: 벽에 테이프로 붙는 현상수배 전단. 머리띠 + 키 눈금 앞 머그샷 셋(조 번호판) + 아래 현상 문구 */
    '.tr-f-dim{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(20,22,28,.55),rgba(3,4,6,.92))}',
    '.tr-f-wrap{position:absolute;left:8%;right:8%;top:9%;bottom:9%}',
    '.tr-f-paper{position:absolute;inset:0;display:flex;flex-direction:column;color:#24201b;overflow:hidden;',
    '  background:radial-gradient(ellipse at 50% 40%,transparent 55%,rgba(120,90,40,.22) 100%),repeating-linear-gradient(90deg,rgba(0,0,0,.022) 0 1px,transparent 1px 5px),#efe4c9;',
    '  box-shadow:0 2px 0 rgba(0,0,0,.15),0 24px 46px rgba(0,0,0,.65)}',
    '.tr-f-band{background:#1d1a16;color:#efe4c9;text-align:center;padding:14px 0 12px}',
    '.tr-f-band b{display:block;font-size:40px;letter-spacing:.22em;margin-right:-.22em;line-height:1}',
    '.tr-f-band span{display:block;margin-top:6px;font-size:10px;font-weight:700;letter-spacing:.5em;opacity:.7}',
    '.tr-f-body{flex:1;display:flex;flex-direction:column;justify-content:space-evenly;gap:12px;padding:16px 14px 14px}',
    '.tr-f-row{position:relative;display:grid;grid-template-columns:repeat(3,1fr);gap:7px}',
    '.tr-f-mug{position:relative;aspect-ratio:3/4;border:1.5px solid #24201b;overflow:hidden;',
    '  background:repeating-linear-gradient(0deg,transparent 0 9px,rgba(36,32,27,.28) 9px 10px),#cfc2a2}',
    '.tr-f-mug svg{position:absolute;left:0;right:0;bottom:0;width:100%;height:86%}',
    '.tr-f-tag{position:absolute;left:50%;bottom:6%;transform:translateX(-50%);background:#1d1a16;color:#efe4c9;font-size:9px;font-weight:700;letter-spacing:.12em;padding:2px 5px;white-space:nowrap}',
    '.tr-f-q{position:absolute;right:5px;top:3px;font-size:18px;color:#24201b;opacity:.55}',
    '.tr-f-big{text-align:center;font-size:30px;letter-spacing:.08em;line-height:1.1}',
    '.tr-f-desc{text-align:center;font-size:12px;line-height:1.5;color:#5c5145}',
    '.tr-f-foot{display:flex;justify-content:space-between;align-items:flex-end;padding-top:10px;border-top:2px solid #24201b;font-size:11px;font-weight:700;letter-spacing:.06em}',
    '.tr-f-foot b{font-size:15px}',
    '.tr-f-tape{position:absolute;width:76px;height:22px;background:rgba(236,226,190,.78);box-shadow:0 1px 2px rgba(0,0,0,.25);z-index:2}',
    '.tr-f-rip{position:absolute;top:0;bottom:0;width:6px;background:#f7f0de;filter:drop-shadow(0 0 1px rgba(0,0,0,.4))}',
    /* G 작전 개시: 경광등이 도는 빛 + 빨간 셔터 */
    '.tr-g-light{position:absolute;left:50%;top:50%;width:260%;height:260%;margin:-130% 0 0 -130%;',
    '  background:conic-gradient(from 0deg,rgba(255,50,50,.0) 0deg,rgba(255,50,50,.55) 40deg,rgba(255,50,50,0) 90deg,rgba(40,120,255,0) 180deg,rgba(40,120,255,.55) 220deg,rgba(40,120,255,0) 270deg)}',
    '.tr-plate.red .tr-hazard{background:repeating-linear-gradient(-45deg,#ff4545 0 10px,#15181f 10px 20px)}',
    '.tr-plate.red .tr-a-main{color:#ff5c5c}'
  ].join('\n');

  function ensureStyle() {
    if (document.getElementById('tr-style')) return;
    var s = document.createElement('style');
    s.id = 'tr-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ---------- 작은 도구 ---------- */
  var EASE_IN = 'cubic-bezier(.55,0,.85,.35)';      // 점점 빨라지며 닫힘(쾅)
  var EASE_OUT = 'cubic-bezier(.16,.84,.3,1)';      // 빠르게 시작해 부드럽게 멈춤
  var EASE_IO = 'cubic-bezier(.7,0,.25,1)';

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function h(tag, cls, html, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  }
  // 애니메이션 하나. 지원하지 않거나 실패하면 마지막 모습으로 바로 맞추고 넘어간다.
  //   끝남은 a.finished 가 아니라 타이머로 잰다: 탭이 가려져 애니메이션이 멈춰도 흐름(출동)은 멈추지 않는다.
  function anim(el, frames, ms, easing, delay) {
    try {
      el.animate(frames, { duration: ms, easing: easing || EASE_IO, fill: 'forwards', delay: delay || 0 });
      return wait(ms + (delay || 0) + 16);
    } catch (e) {
      var last = frames[frames.length - 1];
      for (var k in last) if (k !== 'offset') el.style[k] = last[k];
      return Promise.resolve();
    }
  }
  // 화면 전체를 살짝 흔든다(쾅 닫힐 때)
  function shake(el, px) {
    px = px || 4;
    return anim(el, [
      { transform: 'translate(0,0)' }, { transform: 'translate(0,' + px + 'px)' },
      { transform: 'translate(0,-' + (px / 2) + 'px)' }, { transform: 'translate(0,' + (px / 4) + 'px)' }, { transform: 'translate(0,0)' }
    ], 220, 'linear');
  }

  /* ---------- 연출: 각자 cover / reveal ---------- */
  var FX = {};

  // A 셔터: 위아래 강철판이 쾅 닫히고(흔들림), "출동"은 위판, "수사 3팀"은 아래판 — 맞물린 선은 가리지 않는다
  FX.A = function (layer, opt) {
    var red = opt && opt.red;
    var top = h('div', 'tr-plate top' + (red ? ' red' : ''), '<b class="tr-bh tr-a-main">' + (opt && opt.word || '출동') + '</b><i class="tr-hazard"></i>', layer);
    var bot = h('div', 'tr-plate bot' + (red ? ' red' : ''), '<span class="tr-a-sub">' + (opt && opt.sub || '수사 3팀') + '</span><i class="tr-hazard"></i>', layer);
    var word = top.querySelector('.tr-a-main');
    // 처음엔 화면 밖·글자 숨김: cover 를 늦게 부르는 연출(G: 경광등 먼저)에서 셔터가 미리 보이지 않게
    top.style.transform = 'translateY(-101%)';
    bot.style.transform = 'translateY(101%)';
    word.style.opacity = '0';
    return {
      cover: function () {
        word.style.opacity = '0';
        return Promise.all([
          anim(top, [{ transform: 'translateY(-101%)' }, { transform: 'translateY(0)' }], 300, EASE_IN),
          anim(bot, [{ transform: 'translateY(101%)' }, { transform: 'translateY(0)' }], 300, EASE_IN)
        ]).then(function () {
          shake(layer, 5);
          return anim(word, [{ opacity: 0, transform: 'translateY(10px)', letterSpacing: '.4em' }, { opacity: 1, transform: 'translateY(0)', letterSpacing: '.18em' }], 260, EASE_OUT);
        });
      },
      hold: 260,
      reveal: function () {
        return Promise.all([
          anim(top, [{ transform: 'translateY(0)' }, { transform: 'translateY(-101%)' }], 360, EASE_IO),
          anim(bot, [{ transform: 'translateY(0)' }, { transform: 'translateY(101%)' }], 360, EASE_IO)
        ]);
      }
    };
  };

  // B 폴리스 라인: 남색 판이 사선으로 휙 덮고(노란 테이프 한 줄), 머무는 동안 테이프 글씨가 흐르고, 반대편으로 빠진다
  FX.B = function (layer) {
    var unit = 'POLICE LINE · 수사 3팀 · 출입 금지 · ';
    var p = h('div', 'tr-b-panel', '<div class="tr-b-tape"><b class="tr-bh tr-b-text">' + unit + unit + unit + '</b></div>', layer);
    var txt = p.querySelector('.tr-b-text');
    var R = 'rotate(-18deg) ';
    return {
      cover: function () {
        anim(txt, [{ transform: 'translateX(0)' }, { transform: 'translateX(-22%)' }], 1100, 'linear');
        return anim(p, [{ transform: R + 'translateX(-105%)' }, { transform: R + 'translateX(0)' }], 380, EASE_OUT);
      },
      hold: 160,
      reveal: function () { return anim(p, [{ transform: R + 'translateX(0)' }, { transform: R + 'translateX(105%)' }], 360, EASE_IN); }
    };
  };

  // C 사건 파일: 폴더가 올라오고 빨간 "출동" 도장이 쾅, 표지가 위로 넘어가며 열린다
  FX.C = function (layer, opt) {
    var no = String((opt && opt.caseNo) || 1);
    var f = h('div', 'tr-c-file',
      '<i class="tr-c-tab"></i><div class="tr-c-k">CASE FILE · 수사 3팀</div>' +
      '<div class="tr-c-no">No. ' + ('00' + no).slice(-3) + '</div>' +
      '<div class="tr-bh tr-c-t">사건 ' + no + (opt && opt.caseTitle ? '<br>' + opt.caseTitle : '') + '</div><div class="tr-c-line"></div>' +
      '<div class="tr-c-row"><span>담당</span><b>수사 3팀</b></div>' +
      '<div class="tr-c-row"><span>용의자</span><b>3인 1조</b></div>' +
      '<div class="tr-c-row"><span>단서</span><b>모두 같거나, 모두 다르거나</b></div>' +
      '<div class="tr-c-row"><span>상태</span><b>현장 출동</b></div>', layer);
    var st = h('b', 'tr-bh tr-stamp', '출동', f);
    st.style.right = '40px'; st.style.bottom = '12%'; st.style.opacity = '0';
    var dim = h('div', '', null, layer); dim.style.cssText = 'position:absolute;inset:0;background:rgba(5,6,9,.82);opacity:0';
    layer.insertBefore(dim, f);
    return {
      cover: function () {
        anim(dim, [{ opacity: 0 }, { opacity: 1 }], 260, 'linear');
        return anim(f, [{ transform: 'translateY(115%) rotate(4deg)' }, { transform: 'translateY(0) rotate(0)' }], 380, EASE_OUT)
          .then(function () {
            return anim(st, [{ opacity: 0, transform: 'rotate(-14deg) scale(2.4)' }, { opacity: 1, transform: 'rotate(-10deg) scale(.94)', offset: .8 }, { opacity: 1, transform: 'rotate(-10deg) scale(1)' }], 200, 'ease-in');
          }).then(function () { shake(f, 3); });
      },
      hold: 300,
      reveal: function () {
        anim(dim, [{ opacity: 1 }, { opacity: 0 }], 380, 'linear');
        return anim(f, [
          { transform: 'perspective(900px) rotateX(0) translateY(0)', opacity: 1 },
          { transform: 'perspective(900px) rotateX(70deg) translateY(-30%)', opacity: 0 }
        ], 380, EASE_IN);
      }
    };
  };

  // E 긴급 무전: 빨간 경보가 두 번 조여 오고 → 주사선 화면에 무전 글자가 한 자씩 → 지직 끊기며 열린다
  FX.E = function (layer) {
    var al = h('div', 'tr-e-alarm', null, layer); al.style.opacity = '0';
    var scr = h('div', 'tr-e-scr', '<div class="tr-e-hd"><i class="tr-e-dot"></i>긴급 무전 · CH 3</div><div class="tr-e-txt"></div>', layer);
    scr.style.opacity = '0';
    var txt = scr.querySelector('.tr-e-txt'), dot = scr.querySelector('.tr-e-dot');
    var msg = '주범 조 위치 확인.\n3팀 전원 출동.';
    return {
      cover: function () {
        return anim(al, [{ opacity: 0 }, { opacity: 1 }, { opacity: .2 }, { opacity: 1 }], 520, 'ease-in-out')
          .then(function () {
            scr.style.opacity = '1';
            try { dot.animate([{ opacity: 1 }, { opacity: .15 }], { duration: 260, iterations: 6, direction: 'alternate' }); } catch (e) { /* 무시 */ }
            var i = 0, cur = '<i class="tr-e-cur"></i>';
            return new Promise(function (done) {
              (function step() {
                i++;
                txt.innerHTML = msg.slice(0, i).replace(/\n/g, '<br>') + cur;
                if (i < msg.length) setTimeout(step, msg[i - 1] === '\n' ? 90 : 34); else done();
              })();
            });
          });
      },
      hold: 280,
      reveal: function () {
        al.style.opacity = '0';
        return anim(scr, [
          { opacity: 1, transform: 'scaleY(1)', filter: 'brightness(1)' },
          { opacity: 1, transform: 'scaleY(.02)', filter: 'brightness(2.2)', offset: .55 },
          { opacity: 0, transform: 'scaleY(.0) scaleX(.3)', filter: 'brightness(3)' }
        ], 300, 'ease-in');
      }
    };
  };

  // F 수배서: 어두운 벽에 현상수배 전단이 철썩 붙고(테이프 네 귀퉁이), "검거" 도장 쾅 → 가운데가 찢어져 양쪽이 떨어져 나간다
  FX.F = function (layer) {
    var dim = h('div', 'tr-f-dim', null, layer); dim.style.opacity = '0';
    // 머그샷 셋: 게임 속 모자(비니·중절모·모자 없음)처럼 실루엣을 조금씩 다르게
    var heads = [
      '<path d="M18 30c0-9 5-15 12-15s12 6 12 15z" fill="#24201b"/>',                                   // 비니
      '<path d="M14 26h32v3H14z M20 26c1-8 4-11 10-11s9 3 10 11z" fill="#24201b"/>',                       // 중절모
      ''                                                                                                  // 모자 없음
    ];
    var mug = function (i) {
      return '<div class="tr-f-mug"><b class="tr-bh tr-f-q">?</b><svg viewBox="0 0 60 70" preserveAspectRatio="xMidYMax meet" aria-hidden="true">' +
        '<circle cx="30" cy="31" r="11" fill="#24201b"/>' + heads[i] +
        '<path d="M6 70c2-16 11-24 24-24s22 8 24 24z" fill="#24201b"/></svg>' +
        '<span class="tr-f-tag">3팀-0' + (i + 1) + '</span></div>';
    };
    var inner =
      '<div class="tr-f-band"><b class="tr-bh">현상수배</b><span>WANTED</span></div>' +
      '<div class="tr-f-body">' +
        '<div class="tr-f-row">' + mug(0) + mug(1) + mug(2) + '</div>' +
        '<div><b class="tr-bh tr-f-big" style="display:block">주범 조 · 생포</b>' +
        '<div class="tr-f-desc">세 명이 한 조로 움직인다.<br>셋 중 하나도 놓치지 말 것.</div></div>' +
        '<div class="tr-f-foot"><span>사건 1<br>골목길 연쇄 절도</span><span style="text-align:right">제보<br><b class="tr-bh">수사 3팀</b></span></div>' +
      '</div>';
    var wrap = h('div', 'tr-f-wrap', null, layer);
    var paper = h('div', 'tr-f-paper', inner, wrap);
    // 네 귀퉁이 테이프(붙은 뒤에 하나씩 나타난다)
    var tapes = [[-18, -9, -32], [null, -9, 28], [-18, null, 24], [null, null, -26]].map(function (t) {
      var e = h('i', 'tr-f-tape', null, wrap);
      if (t[0] != null) e.style.left = t[0] + 'px'; else e.style.right = '-18px';
      if (t[1] != null) e.style.top = t[1] + 'px'; else e.style.bottom = '-9px';
      e.style.transform = 'rotate(' + t[2] + 'deg)'; e.style.opacity = '0';
      return e;
    });
    var st = h('b', 'tr-bh tr-stamp', '검거', paper.querySelector('.tr-f-row'));
    st.style.right = '6px'; st.style.bottom = '-16px'; st.style.zIndex = '3'; st.style.mixBlendMode = 'normal'; st.style.opacity = '0'; st.style.background = 'rgba(239,228,201,.55)';
    return {
      cover: function () {
        anim(dim, [{ opacity: 0 }, { opacity: 1 }], 260, 'linear');
        return anim(wrap, [
          { transform: 'translateY(-60px) rotate(-9deg) scale(1.22)', opacity: 0 },
          { transform: 'translateY(3px) rotate(-1deg) scale(.985)', opacity: 1, offset: .7 },
          { transform: 'translateY(0) rotate(-1.5deg) scale(1)', opacity: 1 }
        ], 360, EASE_OUT).then(function () {
          shake(layer, 3);
          tapes.forEach(function (t, i) { anim(t, [{ opacity: 0, transform: t.style.transform + ' scale(1.4)' }, { opacity: 1, transform: t.style.transform + ' scale(1)' }], 120, EASE_OUT, i * 45); });
          return wait(200);
        }).then(function () {
          return anim(st, [{ opacity: 0, transform: 'rotate(12deg) scale(2.6)' }, { opacity: 1, transform: 'rotate(9deg) scale(.92)', offset: .8 }, { opacity: 1, transform: 'rotate(9deg) scale(1)' }], 190, 'ease-in');
        }).then(function () {
          // 애니메이션으로만 보이던 모습(도장·테이프)을 글자 그대로 굳힌다 → 찢을 때 복제본에도 남는다
          st.style.opacity = '1'; st.style.transform = 'rotate(9deg)';
          tapes.forEach(function (t) { t.style.opacity = '1'; });
          wrap.style.transform = 'rotate(-1.5deg)';
          shake(layer, 5);
        });
      },
      hold: 300,
      reveal: function () {
        // 같은 전단을 둘로 복제해 들쭉날쭉하게 자르고, 찢긴 가장자리에 흰 종이 결을 붙인다
        var cut = '53% 0,47% 12%,55% 24%,46% 38%,54% 52%,47% 66%,55% 80%,48% 100%';
        var back = cut.split(',').reverse().join(',');
        var L = wrap.cloneNode(true), R = wrap.cloneNode(true);
        L.style.clipPath = 'polygon(0 0,' + cut + ',0 100%)';
        R.style.clipPath = 'polygon(53% 0,100% 0,100% 100%,' + back + ')';
        wrap.remove(); layer.appendChild(L); layer.appendChild(R);
        anim(dim, [{ opacity: 1 }, { opacity: 0 }], 460, 'linear');
        shake(layer, 2);
        // 찢어질 때 살짝 벌어졌다가(버팀) → 무게로 떨어지며 돌아간다
        return Promise.all([
          anim(L, [{ transform: 'rotate(-1.5deg)' }, { transform: 'translate(-10px,4px) rotate(-4deg)', offset: .22 }, { transform: 'translate(-70%,120%) rotate(-28deg)' }], 480, 'cubic-bezier(.5,0,.9,.4)'),
          anim(R, [{ transform: 'rotate(-1.5deg)' }, { transform: 'translate(10px,-2px) rotate(2deg)', offset: .22 }, { transform: 'translate(70%,125%) rotate(24deg)' }], 480, 'cubic-bezier(.5,0,.9,.4)')
        ]);
      }
    };
  };

  // G 작전 개시: 경광등 빛(빨강·파랑)이 화면을 돌고, 그 빛 아래로 빨간 셔터가 쾅 닫혔다가 열린다(3·2·1 카운트는 뺐다)
  FX.G = function (layer) {
    var sh = FX.A(layer, { red: true, word: '주범 조 검거', sub: '수사 3팀 전원' });
    layer.querySelector('.tr-a-main').style.fontSize = '34px';   // 네 글자 넘어 조금 작게
    // 빛은 셔터 위에 겹친다(screen 으로 섞어 셔터가 빛을 받는 느낌). 닫혀 있는 동안에도 계속 돈다
    var light = h('div', 'tr-g-light', null, layer);
    light.style.opacity = '0'; light.style.mixBlendMode = 'screen';
    var spin = null;
    return {
      cover: function () {
        try { spin = light.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }], { duration: 900, iterations: Infinity }); } catch (e) { spin = null; }
        return anim(light, [{ opacity: 0 }, { opacity: 1 }], 220, 'linear')
          .then(function () { return wait(380); })                       // 빛이 한 바퀴 가까이 돈 뒤
          .then(function () { return sh.cover(); });
      },
      hold: 200,
      reveal: function () {
        anim(light, [{ opacity: 1 }, { opacity: 0 }], 300, 'linear').then(function () { if (spin) spin.cancel(); });
        return sh.reveal();
      }
    };
  };

  /* ---------- 재생 ---------- */
  var host = null, last = { normal: null, big: null }, running = false;

  function reduced() {
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  /*
   * play(kind, onSwap, opt) → Promise(끝)
   *   kind: 'A'..'G' 또는 'normal' / 'big'(무작위)
   *   onSwap: 화면이 다 가려졌을 때 한 번 부른다(여기서 출동 화면으로 바꾼다)
   *   opt: { host: 덮을 요소(기본 .app), caseNo, caseTitle }
   */
  function play(kind, onSwap, opt) {
    opt = opt || {};
    var swapped = false;
    function swap() {
      if (swapped) return;
      swapped = true;
      try { if (onSwap) onSwap(); } catch (e) { if (root.console) console.error(e); }
    }
    var k = kind;
    if (k === 'normal') { k = pick(NORMAL, last.normal); last.normal = k; }
    else if (k === 'big') { k = pick(BIG, last.big); last.big = k; }
    var el = opt.host || host || document.querySelector('.app') || document.body;
    // 연출이 겹치면(연타) 바로 바꾸고 끝낸다
    if (running || !FX[k] || typeof Element === 'undefined' || !Element.prototype.animate) { swap(); return Promise.resolve(k); }
    ensureStyle();
    running = true;
    var layer = h('div', 'tr-layer', null, el);
    layer.setAttribute('aria-hidden', 'true');
    layer.dataset.kind = k;

    var done = function () { running = false; layer.remove(); return k; };

    if (reduced()) {   // 움직임 줄이기: 짧은 암전 컷
      layer.style.background = '#000';
      return wait(120).then(swap).then(function () { return anim(layer, [{ opacity: 1 }, { opacity: 0 }], 120, 'linear'); }).then(done, done);
    }
    var fx;
    try { fx = FX[k](layer, opt); } catch (e) { swap(); return Promise.resolve(done()); }
    // 무슨 일이 있어도 4초 안에는 끝낸다(덮개가 남아 화면을 막지 않게)
    var guard = wait(4000).then(function () { swap(); });
    var flow = Promise.resolve()
      .then(function () { return fx.cover(); })
      .then(function () { return wait(fx.hold || 0); })
      .then(swap)
      .then(function () { return fx.reveal(); });
    return Promise.race([flow, guard]).then(function () { swap(); return done(); }, function (e) {
      if (root.console) console.error(e);
      swap(); return done();
    });
  }

  root.Team3Transit = { play: play, pick: pick, NORMAL: NORMAL, BIG: BIG, setHost: function (e) { host = e; }, kinds: Object.keys(FX) };
})(typeof window !== 'undefined' ? window : this);
