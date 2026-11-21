#!/usr/bin/env bash
# 새 버전 올리기: 테스트 → 빌드 → 화면 시험 → docs/ 갱신 → 커밋. 하나라도 실패하면 멈춘다(깨진 판이 올라가지 않게).
#   그다음 git push 하면 GitHub Pages 가 docs/ 를 내보내고, 설치된 앱에 "지금 업데이트" 띠가 뜬다.
#   android/ 가 바뀐 커밋이면 GitHub Actions 가 APK 를 다시 만든다(게임 내용만 바뀌면 APK 는 그대로).
# 사용: tools/publish.sh        (화면 시험을 건너뛰려면 SKIP_SMOKE=1)
set -euo pipefail
cd "$(dirname "$0")/.."

node --test test/*.test.js >/dev/null || { echo "단위 테스트 실패. 올리지 않는다." >&2; exit 1; }
VERSION="$(python3 tools/build.py | sed -n 's/.*버전 \([0-9.]*\),.*/\1/p')"
[ -n "$VERSION" ] || { echo "빌드 실패." >&2; exit 1; }
if [ "${SKIP_SMOKE:-0}" != "1" ]; then
  python3 tools/smoke.py >/dev/null || { echo "화면 시험 실패. 올리지 않는다." >&2; exit 1; }
  python3 tools/pwa_check.py >/dev/null || { echo "설치형 확인 실패. 올리지 않는다." >&2; exit 1; }
fi

# docs/ 를 비우고 다시 채운다(지운 파일이 남지 않게)
rm -rf docs && mkdir docs && cp -r dist/pwa/. docs/

git add -A
if git diff --cached --quiet; then echo "바뀐 것이 없다."; exit 0; fi
git commit -q -m "수사 3팀 $VERSION" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01LfK2SFJRZzfYa6uvyKrUx6"
echo "커밋: 수사 3팀 $VERSION ($(git rev-parse --short HEAD))"
