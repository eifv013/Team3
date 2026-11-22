/*
 * Team3Icons(0.4.1) — 재화 아이콘(인라인 SVG 문자열). 글자(◆ 등) 대신 화면 곳곳에 같은 모양으로 쓴다.
 *   gem    배지(◆)       : 파란 방패 + 금별 — 이름 그대로 "경찰 배지"
 *   ticket 뽑기권         : 주황 표 + 발바닥 — 동물 뽑기
 *   treat  간식           : 뼈다귀 쿠키
 *   money  수사비         : ₩ 금화
 *   tag    이름표         : 끈 달린 이름표
 *   pick   전설 선택권    : 금빛 표 + 별
 *   xp     시즌 패스 경험치: 번개
 * 모양이 서로 달라 색을 못 봐도 구분된다. 크기는 글자 크기를 따른다(1.15em).
 *   icon(name)        → '<i class="ic ic-gem">…svg…</i>'
 *   amount(name, n)   → 아이콘 + 숫자(천 단위 쉼표)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Team3Icons = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var SVG = {
    gem: '<path d="M12 2.2l8 3v6.2c0 5-3.4 8.6-8 10.4C7.4 20 4 16.4 4 11.4V5.2z" fill="#3E8EDE" stroke="#1D4F86" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="M12 7.2l1.5 3.1 3.4.5-2.5 2.4.6 3.4-3-1.6-3 1.6.6-3.4-2.5-2.4 3.4-.5z" fill="#FFD23F" stroke="#B8860B" stroke-width=".8" stroke-linejoin="round"/>',
    ticket: '<path d="M3 7.5a1.5 1.5 0 0 1 1.5-1.5h15A1.5 1.5 0 0 1 21 7.5v2a2.5 2.5 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5v-2a2.5 2.5 0 0 0 0-5z" fill="#FF9A3C" stroke="#B85E14" stroke-width="1.5" stroke-linejoin="round"/>' +
      '<path d="M15.5 6.5v11" stroke="#B85E14" stroke-width="1.2" stroke-dasharray="1.6 1.6"/>' +
      '<g fill="#FFF3E0"><ellipse cx="9.5" cy="13.4" rx="2.2" ry="1.8"/><circle cx="7.3" cy="10.6" r=".95"/><circle cx="9" cy="9.6" r=".95"/><circle cx="10.9" cy="9.7" r=".95"/><circle cx="12.4" cy="10.9" r=".95"/></g>',
    treat: '<path d="M6.2 9.2a2.4 2.4 0 1 1 2.6-3.4l6.4 6.4a2.4 2.4 0 1 1 3.4 2.6 2.4 2.4 0 1 1-2.6 3.4l-6.4-6.4a2.4 2.4 0 1 1-3.4-2.6z" fill="#E8B47A" stroke="#8E5A26" stroke-width="1.5" stroke-linejoin="round"/>' +
      '<circle cx="11" cy="11.6" r=".8" fill="#8E5A26"/><circle cx="13.2" cy="13.2" r=".8" fill="#8E5A26"/>',
    money: '<circle cx="12" cy="12" r="9" fill="#FFCF3F" stroke="#B8860B" stroke-width="1.6"/><circle cx="12" cy="12" r="6.6" fill="none" stroke="#E0A800" stroke-width="1"/>' +
      '<path d="M8 8.6l1.6 6.6 2.4-5 2.4 5L16 8.6M7.4 11.4h9.2" stroke="#8A6200" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    tag: '<path d="M3.5 8.5A1.5 1.5 0 0 1 5 7h12.5l3.5 5-3.5 5H5a1.5 1.5 0 0 1-1.5-1.5z" fill="#F4E9D2" stroke="#8E7B5A" stroke-width="1.5" stroke-linejoin="round"/>' +
      '<circle cx="17.3" cy="12" r="1.3" fill="#8E7B5A"/><path d="M6.5 10.5h7M6.5 13.5h5" stroke="#C0392B" stroke-width="1.5" stroke-linecap="round"/>',
    pick: '<path d="M3 7.5a1.5 1.5 0 0 1 1.5-1.5h15A1.5 1.5 0 0 1 21 7.5v2a2.5 2.5 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5v-2a2.5 2.5 0 0 0 0-5z" fill="#FFD23F" stroke="#A87A10" stroke-width="1.5" stroke-linejoin="round"/>' +
      '<path d="M12 7.4l1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4z" fill="#fff" stroke="#A87A10" stroke-width=".9" stroke-linejoin="round"/>',
    xp: '<path d="M13.5 2.5L5 13.2h6l-1.5 8.3L19 10.4h-6z" fill="#9CD3F2" stroke="#2F6E95" stroke-width="1.5" stroke-linejoin="round"/>'
  };
  var NAME = { gem: '배지', ticket: '뽑기권', treat: '간식', money: '수사비', tag: '이름표', pick: '전설 선택권', xp: '경험치' };
  function icon(name, title) {
    var s = SVG[name];
    if (!s) return '';
    return '<i class="ic ic-' + name + '" role="img" aria-label="' + (title || NAME[name]) + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + s + '</svg></i>';
  }
  function amount(name, n) { return icon(name) + '<b class="ic-n">' + Math.floor(n || 0).toLocaleString('ko-KR') + '</b>'; }
  return { icon: icon, amount: amount, names: Object.keys(SVG), NAME: NAME };
});
