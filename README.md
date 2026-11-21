# 수사 3팀

방치형 수사 퍼즐 — Guar

용의자 아홉 명 중에서 한 패인 셋을 찾아 잡는 퍼즐에, 자리를 비운 동안에도 3팀이 일하는 방치형을 붙인 게임입니다. 세로 화면 전용.

## 설치

| 기기 | 방법 |
|---|---|
| 안드로이드 | 폰에서 https://github.com/eifv013/Team3/releases/latest/download/team3.apk 를 열어 설치 (처음 한 번 "출처를 알 수 없는 앱" 허용) |
| 아이폰 | Safari 로 https://eifv013.github.io/Team3/ 를 열고 공유 → "홈 화면에 추가" |
| 바로 하기 | https://eifv013.github.io/Team3/ 를 브라우저로 열기 |

진행은 그 기기 안에만 저장됩니다. 앱을 지우거나 브라우저 데이터를 지우면 사라집니다.

## 자동 업데이트

- 게임 본체는 `docs/` 폴더이고 GitHub Pages 가 내보냅니다. 안드로이드 앱은 켤 때 이 주소를 여는 껍데기입니다.
- 새 버전을 올리면 설치된 앱·홈 화면 판이 켤 때, 30분마다, 화면으로 돌아올 때 `version.json` 을 확인해 사무실 위에 "지금 업데이트" 띠를 띄웁니다.
- 게임 내용만 바뀌면 APK 는 다시 받을 필요가 없습니다. `android/` 가 바뀔 때만 GitHub Actions 가 APK 를 다시 만듭니다.

## 새 버전 내기

1. `src/notes.js` 맨 위에 패치노트 항목을 더합니다(`ver` 는 숫자와 점만, 예: `0.1.1`).
2. `tools/publish.sh` — 단위 테스트 → 빌드 → 화면 시험 → 설치형 확인 → `docs/` 갱신 → 커밋. 하나라도 실패하면 멈춥니다.
3. `git push`

## 구조

| 경로 | 하는 일 |
|---|---|
| `src/core.js` | 퍼즐 규칙(한 패 판정, 단계 1→4, 단서, 튜토리얼 문제) |
| `src/idle.js` | 방치 층(형사·수사비·장비·잠복·사건·프로필·저장 검사) |
| `src/ui.js` | 출동·튜토리얼 화면, 그림, 소리, 로딩 화면 |
| `src/hub.js` | 사무실, 저장, 새 버전 확인, 안드로이드 뒤로 가기 |
| `src/notes.js` · `src/update.js` | 패치노트 · 버전 비교 |
| `src/template.html` | 화면 틀과 스타일 |
| `pwa-src/` | 홈 화면 설치용 manifest · 서비스 워커 · 설치방법 |
| `assets/` | 아이콘(`tools/icons.py` 로 다시 뽑음) · 글꼴(Black Han Sans, OFL) |
| `android/` | 안드로이드 껍데기 앱(웹뷰) |
| `test/` | 단위 테스트 (`node --test test/*.test.js`) |
| `tools/` | 빌드, 화면 시험, 설치형 확인, 아이콘, 올리기 |
| `docs/` | 빌드 결과(GitHub Pages) — 직접 고치지 않습니다 |

## 서명 키

`android/app/alpha.keystore` 는 공개 저장소에 든 알파 테스트용 키입니다. 정식 배포 전에 GitHub Secrets 의 키(`KEYSTORE_FILE`, `KEYSTORE_PASSWORD`)로 바꿔야 하고, 그때는 앱을 지우고 다시 깔아야 합니다.
