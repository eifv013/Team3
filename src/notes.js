/*
 * 패치노트 — 버전 기록. 맨 위가 지금 버전이다.
 *   빌드는 맨 위 항목으로 docs/version.json 을 만들고, 설치된 앱은 그 파일을 보고 "새 버전" 띠를 띄운다.
 *   새 버전을 낼 때는 맨 위에 항목을 하나 더하면 된다(ver 는 숫자와 점만: 0.1.1, 0.2.0 …).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SuspectsNotes = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return [
    { ver: '0.1.0', date: '2026-11-21', title: '첫 공개',
      items: [
        '사건 1 · 골목길 연쇄 절도를 처음부터 종결까지 할 수 있어요.',
        '튜토리얼 4문제로 규칙(두 명만 같으면 안 돼요)을 익혀요.',
        '형사를 들이면 자리를 비운 동안에도 3팀이 용의자를 잡아요(최대 8시간).',
        '새 버전이 나오면 사무실 위에 "지금 업데이트" 띠가 떠요.'
      ] }
  ];
});
