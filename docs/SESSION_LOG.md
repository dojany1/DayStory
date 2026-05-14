# SESSION_LOG

DayStory 작업 이력 요약입니다. 세부 변경파일 목록 대신 날짜별 패치노트 형식으로 간략히 유지합니다.

## 기록 방식

- 새 작업은 해당 날짜 아래에 1~5개 bullet로 추가합니다.
- 변경파일 목록은 적지 않습니다. 필요하면 git diff, commit, PRD, CODE_MAP을 확인합니다.
- 검증은 대표 명령과 결과만 짧게 적습니다.
- 같은 날짜의 작은 수정은 별도 세션으로 쪼개지 말고 기존 날짜 항목에 이어 적습니다.

---

## 2026-05-04

- `SESSION_LOG`, `CLAUDE.md`, `AGENTS.md`에 AI 작업 기록 규칙을 추가했습니다.
- 모바일 앱 안정화 1차 패치: 위젯 configure 오류, 알림 권한/채널, Firebase 세션 유지, Firestore 오프라인 캐시, 보관함 용어 전환, 튜토리얼 버블 높이, 스와이프 가드를 정리했습니다.
- 관리자 콘텐츠 관리 화면을 월간 캘린더 형태로 바꾸고, 홈/나의 일화 날짜 휠의 월 경계 이동을 개선했습니다.
- 카드 옆 실루엣/ghost card를 실험했으나 최종적으로 제거하고, 콘텐츠 관리 캘린더를 일반 캘린더 스타일에 맞췄습니다.
- Antigravity로 손상된 상태를 진단하고 `recovery` 브랜치, 백업 브랜치, stash를 만들어 복구 기반을 마련했습니다.

## 2026-05-05

- `12.aab`와 기존 로그를 기준으로 손상된 CSS, 하단 내비게이션, Android manifest, 캘린더 관련 상태를 복구했습니다.
- 세션 종료 자동 백업/checkpoint 스크립트를 만들고 Claude/Codex 공통 지침에 연결했습니다.
- `.env`가 없어도 `dokhu-daystory` Firebase 설정으로 초기화되도록 fallback을 복구했습니다.
- 관리자 콘텐츠 캘린더, Android packaging, 위젯 configure 제거, ProGuard 설정을 다시 맞췄습니다.
- 사진 편집 모달, 오늘 카드 날짜 기준, Android 런처 아이콘 생성/적용 문제를 수정했습니다.
- 프로필 화면을 설정 화면으로 정리하고, 설정/라이선스 진입과 라이트 테마 하단 내비게이션 배경 문제를 마무리했습니다.
- 검증: `npm test`, `npm run build`, `npx cap sync android`, `assembleDebug` 계열 확인.

## 2026-05-06

- 설정 화면 깨짐, 설정 아이콘, 위젯 설정 노출, 상세 이미지 출처/라이선스, 튜토리얼 대상 선택, Android 위젯 등록을 복구했습니다.
- 이미지 로딩 흐름을 정리했습니다: eager/lazy/fetchpriority, preload helper, 압축 업로드, WebP thumbnail, `image_thumb_url` 우선 표시, 기존 이미지 thumbnail 백필.
- 튜토리얼을 `data-tour-target` 기반으로 고정하고 spotlight 위치 안정성을 높였습니다.
- 이미지 placeholder와 URL/thumb 필드 동기화 로직을 helper로 분리해 중복과 하드코딩을 줄였습니다.
- 에디터 배지 제거, 관리자 프로필 이미지 우선 표시, 보관함 아이콘 교체, haptics 제거, editor comment bubble 터치 문제를 정리했습니다.
- 검증: focused Vitest, 전체 테스트, build, cap sync, Android debug build, diff check.

## 2026-05-07

- 튜토리얼 관련 UI와 문서를 현재 동작에 맞게 정리하고, 카드 진입 애니메이션을 단순화했습니다.
- 이미지 업로드/thumbnail 흐름을 공통 서비스로 정리하고, Android 위젯 metadata와 preview 표시를 보강했습니다.
- Android 런처 아이콘이 launchable activity에 적용되지 않던 문제를 manifest와 APK badging 기준으로 수정했습니다.
- 이미지 cache service worker, 카드 스와이프 중복 이동, 알림 bottom sheet 중복 애니메이션, 다크모드 버튼 색상 문제를 정리했습니다.
- 나의 일화 액션 버튼과 편집 흐름을 정리하고, 홈 화면의 나의 일화 토글/스와이프/작성 버튼은 제거했습니다.
- 검증: `npm test`, `npm run build`, `npx cap sync android`, `assembleDebug`, `aapt dump badging`.

## 2026-05-09

- Claude가 외부 CLI 없이 pending phase를 직접 처리할 수 있도록 harness 자동화 흐름을 구성했습니다.
- pending phase 감지 hook, harness 실행/commit 스크립트, phase 샘플, package scripts를 추가했습니다.
- harness 지침에 작업 시작 전 `CLAUDE.md`, `SESSION_LOG.md`, `ARCHITECTURE.md`, `CODE_MAP.md`를 먼저 읽도록 명시했습니다.

## 2026-05-10

- 캘린더 카드 수집 기능을 추가했습니다. 오늘 카드 수집, 기간 지난 카드 잠금, 관리자 full access, 잠금 문구 단순화를 포함합니다.
- SNS 공유 흐름을 정리했습니다. OG/Twitter meta, 통합 share helper, App Links, `assetlinks.json`, Cloud Functions 기반 동적 OG 응답을 준비했습니다.
- Hosting 배포와 assetlinks 검증은 성공했고, Functions 배포는 GCP IAM 권한 부족으로 중단되었습니다.
- 홈 화면을 단순화해 오늘 카드 1장만 보여주고, 좌우 스와이프와 휠 picker를 제거했습니다. 진입 애니메이션은 위에서 아래로 내려오는 1회 모션으로 정리했습니다.

## 2026-05-11

- 공유 링크로 들어온 카드를 보관함과 분리해 "받은 카드" 탭에 저장하는 흐름을 추가했습니다.
- 다국어 기반을 추가했습니다. ko/en/ja JSON, `t()` helper, 언어 설정, 카드 필드 localization, 관리자 작성 화면 언어 탭을 도입했습니다.
- 영문/일문 UI 번역을 채우고, 사용자 작성 카드 내용은 자동 번역하지 않고 관리자 입력값만 사용하도록 분리했습니다.
- 홈 카드 흐름을 다시 조정했습니다. 수집 애니메이션은 공용화했다가 이후 토스트 중심으로 단순화했고, 보관함 탭/검색/토글 UI도 정리했습니다.
- RevenueCat 기반 구독 흐름과 mock billing을 추가했습니다. 구독자/관리자 full access, 지난 카드 자동 수집, 멤버십 카드, mock 구독 취소를 포함합니다.
- 소개 페이지, DOKHU 멤버십 편지 데이터, 멤버십 카드 삭제, 보관함 모달 삭제 흐름을 추가했습니다.
- 캘린더와 소개 페이지 스타일을 단순화했습니다. 캘린더는 카드가 있는 날만 미니카드처럼 보이고, 빈 날짜는 숫자만 남도록 정리했습니다.
- Android 테스트 배포용으로 RevenueCat 네이티브 플러그인을 `capacitor.config.json`의 Android `includePlugins` allowlist에서 제외했습니다. `:app:bundleRelease` 성공.
- 이 파일을 날짜별 패치노트 형식으로 압축 정리했습니다.

## 2026-05-12

- 하단 내비게이션의 내 일기 탭 전용 원형 강조 스타일을 제거하고, 다른 탭과 같은 `nav-item` 아이콘 버튼으로 맞췄습니다.
- 내 일기 탭이 별도 FAB 클래스/래퍼를 쓰지 않도록 회귀 테스트를 추가하고, 하단 탭 설명 문서도 현재 UI에 맞게 갱신했습니다.
- 검증: `npm test -- tests/detail_nav.ui.spec.js` 통과. `npm test`와 `npm run build`는 기존 작업 트리의 `matchMedia` 목 누락, editorstory 기대값 불일치, `src/css/components.css:209` CSS 문법 오류로 실패했습니다.

## 2026-05-14

- 하단 내비게이션에서 편지/내 일기 탭을 재탭할 때 같은 일자를 가진 1월 카드로 이동하던 문제를 전체 날짜 기준 선택으로 수정했습니다.
- 편지/내 일기 휠에 같은 일자가 반복되는 상황을 검증하는 라우터 회귀 테스트를 추가했습니다.
- 검증: `npm test -- tests/router_nav.ui.spec.js` 통과, `npm run build` 통과. `npm test`는 기존 `localStorage` 테스트 환경 및 editorstory CSS 기대값 불일치로 실패했습니다.
- 내 일기 카드 앞면의 `card-meta`가 제목 대신 작성자 닉네임을 표시하도록 바꾸고, 새/수정 저장 데이터에 `author_nickname`을 함께 남기도록 했습니다.
- 저장된 닉네임과 기존 데이터의 프로필 닉네임 fallback을 검증하는 내 일기 카드 메타 테스트를 추가했습니다.
- 검증: `npm test -- tests/mystory_card_meta.ui.spec.js` 통과, `npm run build` 통과. `npm test`는 기존 `localStorage` 테스트 환경 및 editorstory CSS 기대값 불일치로 실패했습니다.
- 캘린더 히스토리 카드 앞면에서 `card-collect-bar` 수집 버튼 영역을 제거하고, 앞면에 다시 렌더링되지 않도록 캘린더 UI 테스트를 추가했습니다.
- 검증: `npm test -- tests/calendar.ui.spec.js` 통과, `npm run build` 통과. `npm test`는 기존 `localStorage` 테스트 환경 및 editorstory CSS 기대값 불일치로 실패했습니다.
- 캘린더/보관함 공용 `calendar-toggle`을 `theme-option-group`의 세그먼트 컨트롤 레이아웃에 맞춰 padding, gap, active 버튼 카드, 터치 상태 기준으로 정리했습니다.
- 캘린더 토글 스타일이 설정 테마 선택 컨트롤과 같은 구조를 유지하는지 확인하는 UI 테스트를 추가했습니다.
- 검증: `npm test -- tests/calendar.ui.spec.js` 통과, `npm run build` 통과. `npm test`는 기존 `localStorage` 테스트 환경 및 editorstory CSS 기대값 불일치로 실패했습니다.
- 현재 `calendar-toggle` 디자인에 기존 좌우 이동 선택 thumb 효과를 되살리고, 보관함 토글의 received 위치 이동도 같은 간격 계산으로 맞췄습니다.
- 검증: `npm test -- tests/calendar.ui.spec.js` 통과, `npm run build` 통과. `npm test`는 기존 `localStorage` 테스트 환경 및 editorstory CSS 기대값 불일치로 실패했습니다.
- 캘린더 페이지가 화면 폭을 조금 더 쓰도록 좌우 padding과 그리드 내부 여백/간격을 줄이고, 날짜 셀 비율을 `1 / 1.12`로 조정했습니다.
- 캘린더 그리드 폭/셀 비율이 유지되도록 UI 테스트를 추가했습니다.
- 검증: `npm test -- tests/calendar.ui.spec.js` 통과, `npm run build` 통과. `npm test`는 기존 `localStorage` 테스트 환경 및 editorstory CSS 기대값 불일치로 실패했습니다.
- 캘린더 날짜 셀에서 이미지가 원본 비율을 유지한 채 셀 안에 맞춰지고, 날짜가 이미지 위에 오버레이되도록 레이아웃을 변경했습니다. 셀의 수집 아이콘도 제거하고 회귀 테스트를 추가했습니다.
- 검증: `npm test -- tests/calendar.ui.spec.js` 통과, `npm run build` 통과. `npm test`는 기존 `localStorage`/`matchMedia` 테스트 환경 문제와 editorstory·내비게이션 기존 기대값 불일치로 실패했습니다.
- 캘린더 날짜 셀을 다시 카드형으로 조정했습니다. 날짜를 이미지 오버레이에서 작은 상단 헤더로 옮기고, 이미지 영역은 원본 비율을 유지한 채 아래에 표시되도록 변경했습니다.
- 검증: `npm test -- tests/calendar.ui.spec.js` 통과, `npm run build` 통과. `npm test`는 기존 `localStorage` 테스트 환경 및 editorstory CSS 기대값 불일치로 실패했습니다.
- 하단 내비게이션 active 아이템의 SVG 아이콘 색상이 `--color-text-primary`를 사용하도록 전용 규칙을 추가하고, 해당 상태를 검증하는 UI 테스트를 추가했습니다.
- 검증: `NODE_OPTIONS="--localstorage-file=/tmp/daystory-vitest-localstorage.json" npm test -- tests/detail_nav.ui.spec.js -t "redesigned bottom nav item is active"` 통과, `npm run build` 통과. `npm test`는 기존 `localStorage` 테스트 환경 및 editorstory CSS 기대값 불일치로 실패했습니다.
- 토스트 알림 위치를 화면 상단에서 하단 네비게이션 바 상단으로 옮기고, 아래에서 위로 떠오르는 등장/퇴장 애니메이션으로 조정했습니다. 토스트 위치 회귀 테스트와 UI 가이드 설명도 갱신했습니다.
- 검증: `npm test -- tests/toast.ui.spec.js` 통과, `npm run build` 통과. `npm test`는 기존 `localStorage` 테스트 환경 및 editorstory CSS 기대값 불일치로 실패했습니다.
- 토스트 알림 컴포넌트의 보더 라운드를 제거해 각진 형태로 표시되도록 조정하고, 토스트 UI 테스트에 radius 제거 기대값을 추가했습니다.
- 검증: `npm test -- tests/toast.ui.spec.js` 통과, `npm run build` 통과. `npm test`는 기존 `localStorage` 테스트 환경 및 editorstory CSS 기대값 불일치로 실패했습니다.
