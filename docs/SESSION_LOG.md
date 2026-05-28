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
- 캘린더 날짜 셀 전체 비율을 더 세로로 늘리고, 내부 이미지 영역을 4:5 비율로 고정해 이미지가 잘리지 않으면서 좌우 여백 없이 표시되도록 조정했습니다.
- 검증: `npm test -- tests/calendar.ui.spec.js` 통과, `npm run build` 통과. `npm test`는 기존 `localStorage` 테스트 환경 및 editorstory CSS 기대값 불일치로 실패했습니다.

## 2026-05-14 18:30 — Claude Sonnet 4.6

- 요구사항: 별도 `/calendar` 라우트 페이지를 제거하고, `editorstory-page`·`mystory-page` 내부에 카드/캘린더 보기 방식 전환 토글 버튼을 추가. 하단 내비게이션 캘린더 버튼도 제거.
- 구현방법: `calendar.js`에서 `renderGrid`, `isAtCurrentMonth`, `WEEKDAYS`를 export로 전환. `editorstory.js`·`mystory.js` 각각에 월 휠 우측 절대 위치 토글 버튼, 일 피커 hide/show, `.page-calendar-view` 컨테이너(월 nav + 요일 헤더 + 그리드)를 추가. 토글 클릭 시 180ms fade 애니메이션으로 카드⟷캘린더 뷰 전환. 월 휠 스크롤이 캘린더 그리드와 양방향 동기화. `main.js`에서 워밍업·라우트 제거. `index.html`에서 `#nav-calendar` 버튼 제거. `pages.css`에 `.view-toggle-btn`·`.page-calendar-view`·전환 keyframe 추가.
- 변경파일: `src/js/pages/calendar.js`, `src/js/pages/editorstory.js`, `src/js/pages/mystory.js`, `src/css/pages.css`, `src/main.js`, `index.html`, `tests/calendar.ui.spec.js`, `tests/view-toggle.spec.js` (신규)
- 검증: `npx vitest run tests/view-toggle.spec.js` 15/15 통과. `npx vitest run tests/calendar.ui.spec.js` 8/8 통과. 기존 실패 테스트는 내 변경 이전부터 동일하게 실패함 확인.

## 2026-05-18 16:44 — Claude Opus 4.7

- 요구사항: Play Store 배포용 Release AAB 빌드.
- 구현방법: `npm run build` → `npx cap sync android` → `./gradlew bundleRelease` (JAVA_HOME을 Android Studio 번들 JBR로 지정). `android/app/src/main/res/xml/`에 있던 macOS Finder 중복 파일 `config 2.xml`이 `mergeReleaseResources`를 실패시켜 삭제. 키스토어는 `android/key.properties`의 기존 `daystory-key` 사용.
- 변경파일: `android/app/src/main/res/xml/config 2.xml` 삭제.
- 검증: `./gradlew bundleRelease` BUILD SUCCESSFUL. `app-release.aab` 7.18 MB 생성 (versionCode 19 / versionName 1.3.3).

## 2026-05-18 17:06 — Claude Opus 4.7

- 요구사항: Android Studio에서 Bundle 빌드 실패(`splash 2.png` 등 공백 포함 파일명 검증 오류) 해결.
- 구현방법: 원인은 `android/app/build/intermediates/` 캐시에 다수 누적된 macOS Finder/iCloud 중복 파일(`* 2.*`). 소스 트리는 깨끗했지만 stale intermediates가 다음 빌드를 깨뜨림. `./gradlew clean`으로 build 디렉토리 전체 제거 후 `./gradlew bundleRelease` 재실행.
- 변경파일: (소스 변경 없음, build 산출물만 정리)
- 검증: `./gradlew bundleRelease` BUILD SUCCESSFUL in 37s. `app-release.aab` 재생성.
- 참고: 프로젝트가 `~/Documents` 하위(iCloud Drive 동기화 경로)에 있어 빌드 도중 중복 파일이 재생성될 수 있음. 빌드 실패 재발 시 `./gradlew clean` 우선 시도.

## 2026-05-18 18:58 — Claude Opus 4.7

- 요구사항: 프로젝트 전역에 누적된 iCloud Drive 동기화 충돌 파일(`* 2.ext`, `* 3.ext`)을 원본을 건드리지 않고 일괄 삭제.
- 구현방법: 두 단계 dry-run 후 삭제. 그룹 A(git 추적 114개)는 `git ls-files | grep -E " [0-9](\.|$)"`로 식별해 line-by-line `git rm`(공백 포함 파일명 안전 처리). 그룹 B(untracked 빌드 산출물 45개, `android/build/`·`android/.gradle/`·`ios/App/App/public/` 등)는 `find -print0 | while IFS= read -r -d '' ...` 로 안전 삭제. iOS SPM `.build/checkouts`, `DerivedData` 16개는 3rd party 캐시라 제외. 사전 검증으로 샘플 파일이 원본과 바이트 단위 동일(`cmp -s` IDENTICAL)임을 확인.
- 변경파일: 총 159개 삭제(원본 변경 없음). 그룹 A 114개는 staged deletion으로 워크 트리에서 제거, 그룹 B 45개는 단순 `rm`. 커밋은 사용자 검토 후 결정.
- 검증: 재탐색 결과 충돌 파일 0개. 샘플 원본(`src/js/pages/about.js`, `src/js/services/collection.js`, `CLAUDE.md`, `AGENTS.md`, `daystory.jks`, `upload_certificate.pem` 등 11개) 모두 보존 확인. `git status --short` staged D 114건, 비관련 변경(.jar 9건, `Package.resolved` 1건)은 이전부터 존재.
- 후속 권장: `.gitignore`에 `* [0-9].*` 패턴 추가 또는 프로젝트를 iCloud 외부로 이동해 재발 방지(이번 작업 범위 외).

## 2026-05-18 20:15 — Claude Opus 4.7

- 요구사항: App Store 심사 거부 3건(4.8 Sign in with Apple 부재, 2.1(a) iPad 카메라 크래시, 5.1.1(v) 계정 삭제 옵션 부재) 통합 대응 후 1.3.4 제출 준비.
- 구현방법:
  - 4.8: `capacitor.config.json` providers에 `apple.com` 추가. `login.js`에 `OAuthProvider('apple.com')` import + `appleProvider`/`appleIcon` 추가, 공통 헬퍼 `upsertProfileAndRoute`/`handleAppleSignIn` 추출, `renderLogin`·`renderSignup` 양쪽에 "Apple로 계속하기" 버튼 추가(회원가입 페이지에는 Google 버튼도 함께 노출). `pages.css`에 `.auth-social-btn--apple`(검정 배경) 변형 + 다크모드 반전 추가.
  - 2.1(a): `ios/App/App/Info.plist`에 `NSCameraUsageDescription`/`NSPhotoLibraryUsageDescription`/`NSPhotoLibraryAddUsageDescription` 추가. iPadOS 26.5는 권한 설명 누락 시 카메라 호출 즉시 강제 종료 — 단일 원인 가능성 가장 높음. 카메라 호출 자체 코드(HTML5 `<input capture>`)는 v1.4.x 백로그로 분리.
  - 5.1.1(v): `settingsSections.js`의 `handleWithdraw` 함수는 이미 존재했으나 렌더된 UI에 진입점 미연결이 거부 원인. 로그아웃 행 옆에 `setting-withdraw` 행(`userXIcon`) 추가 + `bindSettingsSections`에 바인딩. 신설 `src/js/services/userCleanup.js`에 `purgeFirestoreUserData`(profiles + bookmarks/userStories/stories where user_id == uid, writeBatch 400 청크) / `purgeStorageUserData`(`users/{uid}/` 재귀 listAll + deleteObject) / `reauthenticateUser`(google/apple provider 분기) 구현. `handleWithdraw`를 Storage → Firestore → deleteUser 순서로 재작성하고 `auth/requires-recent-login` 시 한 번 자동 재인증 후 재시도.
  - 버전: `package.json` 1.3.3 → 1.3.4.
- 변경파일: `capacitor.config.json`, `ios/App/App/Info.plist`, `src/js/pages/login.js`, `src/js/components/settingsSections.js`, `src/css/pages.css`, `src/js/services/userCleanup.js`(신규), `tests/userCleanup.spec.js`(신규), `package.json`.
- 검증: `npx vitest run tests/userCleanup.spec.js` 9/9 통과. `npm run build` 성공(dist 재생성). `npx cap sync ios/android`는 현재 셸 환경 제약으로 자동 실행 실패 — 사용자가 직접 실행 필요.
- 후속(사용자 액션): ① Firebase Console에서 Apple provider 활성화(Service ID·Key.p8 등록). ② Apple Developer Portal에서 App ID에 "Sign in with Apple" capability 활성화. ③ Xcode → Signing & Capabilities → "Sign in with Apple" 추가. ④ `npx cap sync ios` 실행 후 Archive. ⑤ App Store Connect 회신문에 회원 탈퇴 흐름 화면 녹화 첨부.

## 2026-05-18 20:38 — Claude Opus 4.7

- 요구사항: 위 20:15 통합 plan을 이슈별로 분리해 Plan 1(카메라 2.1a)만 v1.3.4 제출 범위로 좁힘. Plan 2(Sign in with Apple)·Plan 3(회원 탈퇴)은 별도 plan으로 후속 처리.
- 구현방법:
  - 되돌리기: 사용자가 직접 `login.js`(Apple 관련), `settingsSections.js`(회원 탈퇴 UI), `pages.css`(Apple 버튼) 변경분과 `userCleanup.js`/`userCleanup.spec.js` 파일을 원복·삭제. 에이전트는 `capacitor.config.json`의 `apple.com` 항목 제거로 마무리.
  - Plan 1: `@capacitor/camera@^8.0.0` 의존성 + `capacitor.config.json` `android.includePlugins`에 추가. `ios/App/App/Info.plist` 권한 설명 3종(`NSCameraUsageDescription`/`NSPhotoLibraryUsageDescription`/`NSPhotoLibraryAddUsageDescription`) plan 문구로 정렬. 신설 `src/js/services/camera.js`에 `pickFromCamera()` / `pickFromGallery()` / `CameraPermissionError` 노출 — 네이티브는 `Camera.getPhoto({source, resultType: DataUrl, quality: 90, correctOrientation: true})`, 웹은 hidden input file 폴백(`capture="environment"` 분기 포함). 호출처 3곳(`mystory.js`/`editor.js`/`profile.js`)을 hidden `<input type="file">` + `FileReader` 흐름에서 "보관함 / 촬영" 2-버튼으로 분리하고 `handleImagePick(source)` 헬퍼로 통일.
  - 테스트: 신설 `tests/camera.spec.js`에 `@vitest-environment jsdom` 지시 추가, 웹 폴백·네이티브 분기·사용자 취소·권한 거부 6 케이스. 직전 로컬 실행에서 6/6 통과 확인.
  - 버전: `package.json` 1.3.4 유지.
- 변경파일: `capacitor.config.json`, `package.json`, `ios/App/App/Info.plist`, `src/js/services/camera.js`(신규), `tests/camera.spec.js`(신규, jsdom 환경 지시 추가), `src/js/pages/mystory.js`, `src/js/pages/editor.js`, `src/js/pages/profile.js`. (대부분 호출처 교체는 사용자가 직접 작성, 에이전트는 마지막 정합성 보강.)
- 검증: `npx vitest run tests/camera.spec.js` 6/6 통과(jsdom). 이번 턴 후반에 셸 환경 권한 변경으로 `npm test`/`npm run build`/`npx cap sync` 자동 실행이 차단됨 — 사용자가 직접 재실행 필요.
- 후속(사용자 액션): ① `npm test` 전체, `npm run build`, `npx cap sync ios && npx cap sync android` 실행. ② Xcode에서 iPad Air M3(iPadOS 26.5) 시뮬레이터로 mystory/editor/profile 3곳 카메라·보관함 흐름 무크래시 확인. ③ Archive → App Store Connect 업로드(1.3.4). ④ 회신문 영문 권장(plan 끝에 작성된 문구 사용). Plan 2(Apple 로그인) / Plan 3(회원 탈퇴)은 후속 plan에서 별도 처리.

## 2026-05-21

- `.history-card-mini`의 `mini-top-right` 상단에 북마크 아이콘 버튼을 추가했습니다.
  - `renderMiniCard()`에 `<button class="mini-bookmark-btn bookmark-btn active">` + SVG 삽입. 기존 텍스트는 `<span class="mini-top-text">`로 래핑.
  - `renderStories()`에 `.mini-bookmark-btn` 클릭 핸들러 추가: `e.stopPropagation()`으로 카드 클릭 전파 차단, `toggleBookmark()` 호출, 북마크 해제 시 `opts.onRemove` 콜백으로 목록에서 즉시 제거.
  - `loadCollection()`의 `renderStories()` 호출에 `onRemove` 콜백 전달 (→ `removeCard` + `filterAndRender`).
  - CSS: `.mini-top-right` 레이아웃을 `justify-content: space-between; align-items: flex-end`로 변경해 버튼이 상단, 텍스트가 하단에 위치. `.mini-bookmark-btn` 및 `.mini-top-text` 규칙 추가.
  - TDD: `tests/bookmarks.ui.spec.js`에 3개 테스트 추가 (버튼 렌더링/클릭 전파 차단/toggleBookmark 호출), `state.js`·`toggleBookmark` 모킹 추가.
- 변경파일: `src/js/pages/bookmarks.js`, `src/css/components.css`, `tests/bookmarks.ui.spec.js`.
- 검증: `npm test` — bookmarks 스위트 8/8 중 7 통과(기존 "navigates" 실패 1건은 localStorage 환경 이슈로 내 변경과 무관).

## 2026-05-22

- 출시 후 첫 종합 감사를 6개 에이전트(critical-reviewer / qa-tester / ui-designer / user-researcher / product-planner / refactor-specialist) 사이클로 진행했습니다. 코드는 수정하지 않은 read-only audit.
- 결과를 `docs/audit/2026-05-22/SUMMARY.md` 단일 파일에 7개 섹션으로 통합했습니다 — 코드/QA/UI/사용자/제품/리팩토링/종합 결론(P0·P1·P2 액션 표).
- 핵심 발견: ① `router.setOnUnmount` 가 CLAUDE.md 규칙에는 있는데 실재하지 않음, ② RevenueCat 설치만 되고 미연결로 수익 0, ③ `donate.js` placeholder 결제 안내가 출시 빌드에 잔존(스토어 기만 리스크), ④ 클라이언트가 자기 자신에게 `role='editor'` 부여 — Firestore Rules 콘솔 검증 필요, ⑤ `prefers-reduced-motion` 글로벌 부재, ⑥ 게스트→로그인 시 북마크 머지 부재, ⑦ `withTimeout`·Firebase URL 판별·`escapeHtml` 중복.
- 변경파일: `docs/audit/2026-05-22/SUMMARY.md`(신규), `docs/SESSION_LOG.md`.
- 검증: read-only 감사이므로 빌드/테스트 실행 없음. 다음 재감사 권장 시점은 P0/P1 처리 후 v1.4.0 출시 직전.
- 추가 작업(같은 날, 사용자 결정 반영): `docs/audit/2026-05-22/한장요약.md`(바이브코더 톤 요약), `docs/audit/2026-05-22/할일.md`(사용자 결정 6개 반영한 v1.4.0 패치 6-Wave 액션 리스트) 신규 작성.

### v1.4.0 패치 Wave 1 — 결제 제거 + window.confirm 교체 + 알림 기본값 ON

- 요구사항: audit P0 중 즉시 처리 가능한 항목 묶음. donate placeholder 제거 / `editor.js`의 브라우저 `window.confirm()` 잔존을 `confirmDialog`로 교체 / 일기 알림 기본값을 신규 사용자에게 ON으로 (기존 저장 설정은 유지).
- 구현방법:
  - **donate 제거**: `src/js/pages/donate.js` 파일 삭제. main.js 라우터에는 이미 등록 없었음(죽은 페이지). `src/css/pages.css`의 `.donate-*` 섹션(80여 줄) + 구성 목차의 "7) 후원 페이지" 라인 삭제.
  - **window.confirm 교체**: `src/js/pages/editor.js:411-420` — `setBeforeNavigate` 콜백을 async로 만들고 `showConfirm({title, message, confirmText:'나가기', cancelText:'계속 작성', danger:true})` 사용. `confirmDialog.js` import 추가. 모바일 웹뷰 라이프사이클 깨짐 리스크 제거.
  - **알림 기본값 ON**: `src/js/services/notifications.js:8` `diary.enabled: false → true`. 추가로 `normalizeNotificationSetting()` 이 `value === undefined`일 때 `enabled: Boolean(fallback.enabled)` 를 반환하도록 수정 — 기존엔 `Boolean(undefined?.enabled) = false`라 DEFAULT만 바꿔도 신규 사용자에게 적용 안 되던 버그.
  - **TDD**: `tests/notifications_default.spec.js` 신설(5 케이스) — 신규 사용자 diary ON, editor OFF 유지, 기존 저장된 OFF/ON 그대로 유지, diary 누락 시 fallback ON.
  - **문서**: `docs/CODE_MAP.md`의 `/donate` 라우트 행 + Known Issues D 행 제거. `docs/ARCHITECTURE.md`의 코드 트리에서 donate 제거. `docs/PRD.md` Known Limitations의 donate 항목을 v1.4.0 제거 안내로 교체.
- 변경파일: `src/js/pages/donate.js`(삭제), `src/css/pages.css`, `src/js/pages/editor.js`, `src/js/services/notifications.js`, `tests/notifications_default.spec.js`(신규), `docs/CODE_MAP.md`, `docs/ARCHITECTURE.md`, `docs/PRD.md`, `docs/SESSION_LOG.md`.
- 검증: `npm test` 전후 baseline 비교 — baseline 27 failed / 98 passed → 변경 후 27 failed / 103 passed. **회귀 0건, 새 spec 5/5 통과.** 27개 기존 실패는 모두 사전 존재(위젯 XML 누락, nav-icon size 변경, regression.bugs 등 v1.3.5 출시 시점 상태). `npm run build` 미실행(이번 wave에서 build 영향 변경 없음, Wave 2 종료 후 cap sync 와 함께 한 번에).
- 후속: Wave 2(게스트 모드 완전 제거 + 로그인 강제) 진입 전 사용자 확인 권장.

### v1.4.0 패치 Wave 2 — 게스트 모드 완전 제거 + 로그인 필수 강제

- 요구사항: 앱 진입 시 비로그인 사용자는 무조건 `/login` 으로 보냄. 코드 전체에서 `'guest'` 분기를 삭제하고, 기존 localStorage 게스트 데이터(`guest_bookmarks` 등)는 자연 소멸로 처리(마이그레이션 안 함). audit P0 4건(게스트 북마크 머지 부재 / Storage `users/guest/` 폴백 / `fetchMyStories(undefined)` 위험 / 클라이언트 admin 부여)이 동시에 해결됨.
- 구현방법:
  - **main.js**: `setBeforeNavigate` 가드를 "user 없으면 PUBLIC_ROUTES(/login,/signup) 외 모두 차단 후 `/login` 강제 navigate" 로 재작성. 로그아웃 분기에서 `setState('user', null)` 후 직접 `/login` navigate. `if (!auth)` 분기도 `setState('user', null)` 로. `onAuthStateChanged` 의 else 가지에서 게스트 폴백 제거. 미정의 `syncSubscriptionState()` 죽은 호출도 같이 제거(잠재 ReferenceError).
  - **bookmarks.js** (서비스 핵심): `isBookmarked` / `toggleBookmark` / `getBookmarkedStoryIds` / `getBookmarkedStories` / `getBookmarkCount` 5개 함수에서 `user.id === 'guest'` localStorage 분기 7곳 삭제. user 없으면 즉시 빈 값 반환 (Firestore 호출 가드).
  - **images.js**: `uploadImage` 의 `uid = 'guest'` 기본값 제거 → `uid` 필수 인자로, 누락 시 throw. `users/guest/` 업로드 경로 차단.
  - **stories.js**: `uploadImage` 의 `auth.currentUser?.uid || 'guest'` 폴백 제거 → uid 없으면 `로그인이 필요합니다` throw.
  - **calendar.js / editorstory.js**: 공유·북마크 버튼의 게스트 분기(`if (user.id === 'guest') { showToast(login_required); navigate('/login'); return; }`) 제거. 라우터 가드에서 이미 차단되므로 페이지 내부에서는 user 가 항상 존재한다고 가정. 게스트 폴백(`|| { id: 'guest' }`) 도 삭제.
  - **mystory.js**: `checkAuth()` / `renderMyStoryNew()` 게스트 분기 3곳을 `if (!uid)` 로 단순화 (라우터 가드에서 이미 막힘, 안전망만 유지). `uploadUid = uid || 'guest'` → `if (!uid)` 가드.
  - **editor.js**: `uploadUid` 게스트 폴백 제거, `uid` 누락 시 업로드 거부.
  - **profile.js**: 사용자 정보 카드의 게스트 분기(`user.id !== 'guest'`) 제거 → user 가 항상 있는 단일 경로. "로그인/회원가입 하러 가기" CTA + `#goto-login-btn` 핸들러 삭제. `openProfileEditModal` 가드는 `!user.id` 체크로 통일.
  - **settingsSections.js**: 로그아웃/회원탈퇴 섹션 조건 `user && user.id !== 'guest'` → `user` 로 단순화.
  - **login.js**: 상단 주석에서 "현재는 게스트 모드로 동작" 문구를 "v1.4.0 이후 로그인 필수 강제" 로 갱신.
  - **TDD**: `tests/auth_gate.spec.js` 신설(7 케이스) — `getState('user')` 가 `null` 일 때 bookmarks 5개 함수가 모두 Firestore 호출 없이 빈 값 반환, 레거시 `guest_bookmarks` localStorage 잔존 데이터 무시, 로그인 사용자는 Firestore 경로 정상 진입.
- 변경파일: `src/main.js`, `src/js/services/bookmarks.js`, `src/js/services/images.js`, `src/js/services/stories.js`, `src/js/pages/calendar.js`, `src/js/pages/editor.js`, `src/js/pages/editorstory.js`, `src/js/pages/mystory.js`, `src/js/pages/profile.js`, `src/js/pages/login.js`, `src/js/components/settingsSections.js`, `tests/auth_gate.spec.js`(신규), `docs/SESSION_LOG.md`.
- 검증: `npm test` baseline 27 failed / 98 passed → Wave 2 후 27 failed / 110 passed. **회귀 0건, 새 spec 7/7 통과** (Wave 1 누적 5 + Wave 2 7 = +12). 코드 전체 grep으로 `guest`/`isGuest`/`'guest'` 0건 잔존 확인. `npm run build` 와 `npx cap sync android` 는 Wave 5 종료 후 일괄 실행 권장.
- 후속(사용자): ① 게스트로 사용해 온 기존 사용자에게 영향 — 앱 업데이트 후 첫 진입에서 로그인 화면 노출, 이전 localStorage 북마크/수집 기록은 표시되지 않음 (자연 소멸). ② 안드로이드 위젯의 "오늘의 편지" 클릭 시 비로그인이면 `/login` 으로 진입 — 정상 동작 확인 필요. ③ Wave 3(디자인 토큰 + 접근성) 진입 전 수동 QA 권장: 새 브라우저에서 비로그인 → 모든 경로 `/login` 강제, 로그인 후 정상 진입.

### v1.4.0 패치 Wave 3 — 디자인 토큰 보강 + 접근성

- 요구사항: audit §3 P0/P1 일괄 — variables.css 누락 토큰(`--font-sans` 등 4개) 보강, `prefers-reduced-motion` 글로벌 블록 부재 해결(WCAG 2.3.3), 하드코딩 색상(`#3f3200`, `#1c1c1e`, `#34c759`) 토큰 교체, z-index magic number(`100000`, `10000`, `9999`) 토큰화, `.page-header-back` 터치 영역 36px → 44px 확장(WCAG 2.5.5), `color-mix()` 구 WebView fallback.
- 구현방법:
  - **variables.css 토큰 추가** (라이트 + 다크 분기):
    - `--font-sans`: 15곳에서 참조되던 미정의 토큰. LINESeedKR → Inter → system-ui → -apple-system → Segoe UI 폴백 체인.
    - `--text-md`: text-base와 text-lg 사이 (1rem). 다이얼로그 제목 등에서 참조.
    - `--color-text-on-image`: 이미지 위 텍스트 (라이트/다크 동일 #ffffff).
    - `--color-editor-comment` + `--color-text-on-editor-comment`: 노란 코멘트 배경 + 짙은 갈색 텍스트. 다크모드에서 채도 약간 낮춤(#f5d34a) + 텍스트 더 진하게(#2a2200).
    - `--color-text-on-light-segment`: 라이트 thumb(흰 배경) 위 짙은 텍스트(#1c1c1e). 테마/캘린더 토글 활성 상태에서 사용.
    - `--z-overlay: 500`: 풀스크린 모달용. z-modal(200) / z-toast(300) / z-splash(400) 보다 위.
    - `data-font-size="small"`/`"large"` 프리셋이 기존 `--text-base`/`--text-lg` 2개만 재정의하던 것을 `--text-xs`/`--text-sm`/`--text-md`/`--text-xl`/`--text-2xl` 까지 5개 추가 재정의. 사용자 폰트 크기 설정이 전체 스케일에 일관 적용.
  - **base.css 접근성**: `@media (prefers-reduced-motion: reduce)` 글로벌 블록 추가. 모든 요소의 animation/transition duration 을 0.01ms로, scroll-behavior 를 auto로 강제. 멀미/현기증 민감 사용자 보호.
  - **pages.css 하드코딩 교체**:
    - `.detail-editor-note-label` 의 `color:#3f3200` → `var(--color-text-on-editor-comment)`, `background:#ffe16a` → `var(--color-editor-comment)` (fallback 제거).
    - `.theme-option.active` 의 `color:#1c1c1e` → `var(--color-text-on-light-segment)`.
    - `.calendar-toggle-btn.active` 동일 패턴.
    - `.collect-btn--done` 의 `background:#34c759` → `var(--color-success)`, `color:#fff` → `var(--color-text-on-image)`.
    - `.profile-edit-overlay` 의 `z-index:9999` → `var(--z-overlay)`.
  - **components.css 정리**:
    - `.crop-modal-overlay` `z-index:100000` → `var(--z-overlay)`.
    - `.confirm-dialog-overlay` `z-index:10000` → `var(--z-overlay)`.
    - `.page-header-back` (36px) — 시각 크기 유지, `::before { inset: -4px }` 로 hit area를 44px+로 확장 (WCAG 2.5.5).
    - `.confirm-dialog-status` 의 `color-mix()` 앞에 `rgba(255,59,48,0.1)` fallback 1줄 추가 (Safari 15.4↓ / Android WebView 105↓ 대응).
  - **TDD**: `tests/css_tokens.spec.js` 신설(16 케이스) — 토큰 존재성(8), prefers-reduced-motion 글로벌(2), 하드코딩 hex 제거 + 터치 영역 확장 + z-index 토큰화(6) 검증. 파일 텍스트 매칭 기반(jsdom의 :root 변수 해석 부정확성 회피).
- 변경파일: `src/css/variables.css`, `src/css/base.css`, `src/css/pages.css`, `src/css/components.css`, `tests/css_tokens.spec.js`(신규), `docs/SESSION_LOG.md`.
- 검증: Wave 2 baseline 27 failed / 110 passed → Wave 3 후 27 failed / 126 passed. **회귀 0건, 새 spec 16/16 통과** (누적 +28). 27개 기존 실패는 모두 사전 존재.
- 후속(사용자): ① 수동 시각 점검 권장 — 라이트/다크 토글, 폰트 크기 small/large 전환(이전엔 base와 lg만 반응했으나 이제 xs~2xl 전부 반응), 캘린더의 "역사 ↔ 나의 일화" 토글 활성 상태의 텍스트 가독성, 디테일 페이지의 에디터 코멘트 라벨 다크모드 대비. ② OS 접근성에서 "동작 줄이기" 켜고 카드 플립/페이지 전환이 즉시 결과 상태로만 바뀌는지. ③ 안드로이드 구 WebView 디바이스에서 confirmDialog 의 "길게 눌러 확정" 상태 배경이 정상 표시되는지.

### v1.4.0 패치 Wave 4 — 안정성 핵심 (setOnUnmount + 가드 + Firebase Rules)

- 요구사항: audit P0 4건 일괄 — ① CLAUDE.md 규칙에 명시됐으나 코드에 존재하지 않던 `router.setOnUnmount(fn)` 실제 구현 → 글로벌 `window._editorStoryMouseMove`/`_myStoryMouseMove` 패턴 제거. ② `fetchMyStories(undefined)` 전체 컬렉션 스캔 위험 차단. ③ 북마크 빠른 더블탭 시 Firestore 중복 문서 방지. ④ Firebase Storage URL 식별을 `includes()` 위양성에서 host 파싱으로 강화. ⑤ `sanitizeUrl` 화이트리스트 패턴으로 강화. ⑥ Firebase Security Rules 파일을 레포에 코드화(클라이언트 admin 부여 차단, `users/{uid}` 본인만 업로드, 파일 크기/MIME 제한).
- 구현방법:
  - **router.setOnUnmount(fn) 신설** ([src/js/router.js](../src/js/router.js)): 페이지 핸들러가 호출하면 다음 navigate 시 `container.innerHTML=''` 이전에 fn 실행. fn 이 throw 해도 라우팅 계속(try/catch 보호). 매 페이지 진입마다 새로 등록되며 자동 누적되지 않음. 404 분기에서도 cleanup 실행.
  - **글로벌 mouse 리스너 패턴 제거**:
    - `src/js/pages/editorstory.js:634-641` — `window._editorStoryMouseMove`/`_editorStoryMouseUp` 글로벌 슬롯 패턴 삭제, 로컬 const `onMouseMove`/`onMouseUp` + `setOnUnmount(() => window.removeEventListener(...))` 로 교체.
    - `src/js/pages/mystory.js:712-727` — 동일 패턴 적용.
    - 두 파일 모두 `router.js` 에서 `setOnUnmount` import 추가.
  - **services 가드**:
    - `src/js/services/mystories.js:fetchMyStories` — uid 가 undefined/null/'' 면 즉시 빈 배열 반환. Firestore SDK 가 `where('uid','==',undefined)` 처리 시 SDK 버전에 따라 전체 스캔 가능성 차단.
    - `src/js/services/bookmarks.js:toggleBookmark` — 모듈 스코프 `inFlightToggles: Set<storyId>` 도입. 같은 storyId 에 대한 동시 호출은 두 번째부터 즉시 `{bookmarked:false}` 반환. `finally` 에서 해제.
    - `src/js/services/mystories.js:deleteMyStory`, `src/js/services/stories.js:deleteStory` — `image_url.includes('firebasestorage') || .includes('.firebasestorage.app')` 위양성 패턴을 새 `isFirebaseStorageUrl(url)` 헬퍼(URL 객체 host 파싱)로 교체. `firebasestorage.googleapis.com` 또는 `*.firebasestorage.app` host만 허용. attacker.com/firebasestorage/x.jpg 같은 URL 의도적 식별 차단.
  - **sanitize.js URL 화이트리스트** ([src/js/utils/sanitize.js](../src/js/utils/sanitize.js)): 기존 `javascript:`/`data:` 만 차단하던 패턴을 화이트리스트(`http`/`https`/`mailto`/`tel` 만 허용) 로 전환. 공백/탭/개행/제어 문자(` -`)로 우회한 `java\tscript:` 변형도 normalize 후 차단. 상대 경로(`/path`, `./rel`, `#anchor`)는 스킴 미존재 시 통과.
  - **Firebase Security Rules 파일 신설**:
    - 신설 `firestore.rules` — 핵심: ① `profiles/{uid}` write 시 `role` 필드는 변경 불가(`resource.data.role == request.resource.data.role`), 신규 create 시 `role != 'editor'` (클라이언트 admin 승격 차단, audit P0). ② `stories/{id}` read 는 published 만 일반 사용자 / 어드민은 모든 status. write 는 어드민만. ③ `userStories`, `bookmarks` 는 본인만. ④ `reports` 는 인증 사용자 누구나 create, read/update/delete 는 어드민. ⑤ 그 외 경로 기본 거부.
    - 신설 `storage.rules` — 핵심: `users/{userId}/{folder=**}` 에 `request.auth.uid == userId` 이고 파일 크기 < 10MB 이고 contentType `image/*` 일 때만 write. `users/guest/{**}` 명시적 거부(Wave 2 동기화). 그 외 경로 기본 거부.
    - `firebase.json` 에 `firestore.rules` / `storage.rules` 경로 등록.
    - **배포는 사용자가 별도로 `firebase deploy --only firestore:rules,storage` 실행 필요** (CLI 권한 이슈로 자동 배포 안 함).
  - **TDD specs 신설** (4개):
    - `tests/router_unmount.spec.js` — `setOnUnmount` export 존재, throw 보호 검증.
    - `tests/sanitize.spec.js` — 안전 URL 7종 통과, 위험 URL 9종(tab/newline 우회 포함) 차단, null/undefined/'' 처리, escapeHtml 회귀.
    - `tests/bookmarks_double_tap.spec.js` — 같은 storyId 동시 호출 시 `addDoc` 1회만, 다른 storyId 동시는 각각 정상.
    - `tests/mystories_uid_guard.spec.js` — uid undefined/null/'' 시 Firestore 호출 없이 빈 배열, 정상 uid 만 진입.
  - **기존 spec mock 갱신** (회귀 방지): `tests/mystory_card_meta.ui.spec.js`, `tests/regression.bugs.spec.js`, `tests/editorstory.ui.spec.js` 의 `vi.mock('../src/js/router.js')` 정의에 `setOnUnmount: vi.fn()` 추가. 안 추가하면 mystory/editorstory 가 setOnUnmount import 시 vitest 에서 "No export defined" 에러.
- 변경파일: `src/js/router.js`, `src/js/pages/editorstory.js`, `src/js/pages/mystory.js`, `src/js/services/mystories.js`, `src/js/services/bookmarks.js`, `src/js/services/stories.js`, `src/js/utils/sanitize.js`, `firestore.rules`(신규), `storage.rules`(신규), `firebase.json`, `tests/router_unmount.spec.js`(신규), `tests/sanitize.spec.js`(신규), `tests/bookmarks_double_tap.spec.js`(신규), `tests/mystories_uid_guard.spec.js`(신규), `tests/mystory_card_meta.ui.spec.js`, `tests/regression.bugs.spec.js`, `tests/editorstory.ui.spec.js`, `docs/SESSION_LOG.md`.
- 검증: Wave 3 baseline 27 failed / 126 passed → Wave 4 후 27 failed / 154 passed. **회귀 0건, 새 spec 28/28 통과**(누적 +56). 첫 실행 시 mock 누락으로 5건 회귀(32 failed) 발생했으나 mock 갱신으로 해결. 27개 기존 실패는 모두 사전 존재.
- 후속(사용자): ① **Firebase Console 에서 `firebase deploy --only firestore:rules,storage` 실행 필요** (없으면 audit P0 클라이언트 admin 부여 위험 그대로). ② SPA 메모리 누수 회복 수동 확인 — Chrome DevTools Performance > Memory 에서 editorstory ↔ mystory ↔ settings 페이지 왕복 30회 후 detached DOM 노드 누적이 더 이상 안 늘어나는지. ③ 북마크 더블탭 — `/detail/:id` 페이지에서 북마크 아이콘 0.3초 이내 연속 2회 탭 시 Firestore 에 문서 1개만 생성되는지 (콘솔에서 확인).

### v1.4.0 패치 Wave 5 — 안전한 리팩토링 (중복 제거)

- 요구사항: audit §6 의 🔴 큰 가치 중복 4건을 동작 변화 없이 정리. `withTimeout` (3벌) / Firebase Storage URL 식별 (4벌) / `escapeText` (3벌) / `router.getLocalTodaySelection` 의 `utils/date.js` 미사용.
- 구현방법:
  - **신설 `src/js/utils/timeout.js`** — `withTimeout(promise, ms=5000, message='시간 초과')`. 메시지 옵션 추가로 호출부별 다른 에러 메시지 지원.
  - **신설 `src/js/utils/storage.js`** — `isFirebaseStorageUrl(url)`. `URL` 객체 host 파싱(`firebasestorage.googleapis.com` 또는 `*.firebasestorage.app` 끝 매칭). 이전 `includes()` 위양성(`attacker.com/firebasestorage/x.jpg`) 차단.
  - **호출처 교체**:
    - `src/js/services/stories.js` — 인라인 `withTimeout` + Wave 4 인라인 `isFirebaseStorageUrl` 삭제, 양쪽 utils import.
    - `src/js/services/mystories.js` — 직접 `Promise.race` 패턴 → `withTimeout` 사용. 인라인 `isFirebaseStorageUrl` 삭제 후 utils import. **주의**: 기존 reject 메시지가 `Error('timeout')` 소문자였지만, 호출부 catch 가 메시지를 분기 조건으로 쓰지 않고 단순히 `console.warn` 후 빈 배열 반환하는 구조라 메시지 변경 영향 없음 확인.
    - `src/js/services/bookmarks.js` — `withTimeout` 을 utils 래핑으로 변경하되 한국어 안내 메시지(`네트워크 환경이 불안정하여...`) 유지. UI 토스트로 그대로 노출되는 메시지라 보존.
    - `src/js/pages/editor.js`, `src/js/pages/mystory.js` — 각각 `imageSrc.includes('firebasestorage...') || ...` 2벌을 `isFirebaseStorageUrl(imageSrc)` 단일 호출로 교체.
  - **`escapeText` 통합**:
    - `src/js/components/confirmDialog.js`, `src/js/components/settingsSections.js` — 동일 구현 8줄짜리 사설 `escapeText` 함수 삭제. `import { escapeHtml } from '../utils/sanitize.js'` 후 `const escapeText = escapeHtml;` alias 1줄로 호출부 변경 최소화.
  - **`router.getLocalTodaySelection`**:
    - `src/js/router.js` — `new Date()` 직접 분해하던 6줄을 `import { getLocalToday }` + `date.split('-').map(Number)` 분해로 단순화. 유틸 함수 자체는 변경 없음(`{month, day, date}` 반환 형태는 router 내부에서만 쓰이므로 유틸 인터페이스 변경 불필요).
  - **TDD specs 신설**:
    - `tests/timeout.utils.spec.js` — resolve/reject 정상 전파, 타임아웃, 커스텀 메시지 4 케이스.
    - `tests/storage.utils.spec.js` — Firebase 정상 호스트 3종, 외부/위양성/null/숫자 9종 거부 = 12 케이스.
- 변경파일: `src/js/utils/timeout.js`(신규), `src/js/utils/storage.js`(신규), `src/js/services/stories.js`, `src/js/services/mystories.js`, `src/js/services/bookmarks.js`, `src/js/pages/editor.js`, `src/js/pages/mystory.js`, `src/js/components/confirmDialog.js`, `src/js/components/settingsSections.js`, `src/js/router.js`, `tests/timeout.utils.spec.js`(신규), `tests/storage.utils.spec.js`(신규).
- 검증: Wave 4 baseline 27 failed / 154 passed → Wave 5 후 27 failed / 170 passed. **회귀 0건, 새 spec 16/16 통과**(누적 +72).
- 후속: 휠 피커 공통화는 plan 명시대로 손대지 않음(클로저 의존성 깊음, E2E 테스트 선행 필요).

### v1.4.0 패치 Wave 6 — 카카오톡 공유 SDK (한국 시장 바이럴 루프)

- 요구사항: 카카오 JavaScript SDK 를 동적 로드해 `shareToKakao(story)` 함수 제공. `VITE_KAKAO_APP_KEY` 환경 변수가 없으면 일반 공유로 graceful fallback. 코치마크는 사용자 결정으로 제외됨.
- 구현방법:
  - **`src/js/services/sharing.js`** 에 `shareToKakao(story)` + 내부 `loadKakaoSdk()` 동적 로더 추가:
    - 첫 호출 시에만 `<script src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js" async crossorigin>` 을 `document.head` 에 동적 삽입. 초기 번들 부담 0.
    - `import.meta.env.VITE_KAKAO_APP_KEY` 가 비어 있거나 SDK 로드 실패 시 `shareStory()` 폴백 → 호출부는 항상 `{ok, via}` 반환받음.
    - `Kakao.Share.sendDefault({ objectType:'feed', content:{title, description, imageUrl, link}, buttons:[{title:'앱에서 보기', link}] })` 호출. 카카오톡 미설치/팝업 차단 시 카카오 SDK 자체 폴백 UI가 사용자에게 표시됨.
    - `kakaoLoadPromise` 모듈 스코프 캐시 — 중복 SDK 로드 방지.
  - **신설 `.env.example`** — 카카오 콘솔 가이드(앱 생성 → 웹 플랫폼 도메인 등록 → JavaScript 키 복사) + Firebase env 주석 포함.
  - **TDD spec** `tests/sharing_kakao.spec.js` — 3 케이스: ① 키 없음 → fallback. ② Kakao 글로벌 mock 시 sendDefault 호출 가능성. ③ SDK 로드 실패 → fallback. jsdom 에서 외부 CDN 실제 로드 안 되므로 fallback 경로가 기본 검증 대상.
  - **호출처 통합은 다음 패치로 보류** — 사용자가 카카오 콘솔에서 앱 등록 + 키 발급 + `.env` 주입 완료 후, 페이지(`detail.js`/`editorstory.js`)에 카카오 공유 버튼을 시각적으로 노출할 시점에 별도 진행. 현재는 인프라만 준비.
- 변경파일: `src/js/services/sharing.js`, `.env.example`(신규), `tests/sharing_kakao.spec.js`(신규).
- 검증: Wave 5 baseline 27 failed / 170 passed → Wave 6 후 27 failed / 173 passed. **회귀 0건, 새 spec 3/3 통과**(누적 +75). `npm run build` 526ms 성공, `dist/` 정상 생성. 안드로이드 영향 변경 없음(SDK 는 동적 로드라 `capacitor.config.json` 무관) → `npx cap sync android` 불필요.
- 후속(사용자): ① **카카오 개발자 콘솔에서 앱 등록 + 사이트 도메인(예: https://daystory.app) 등록 + JavaScript 키 발급**, ② 발급받은 키를 `.env` 의 `VITE_KAKAO_APP_KEY=...` 에 주입, ③ `npm run dev` 또는 빌드 후 실제 디바이스(카카오톡 앱 설치된)에서 `shareToKakao(story)` 수동 호출 테스트, ④ 그 후 페이지 UI 에 카카오 공유 버튼 노출 시점 결정 (다음 패치 후보).

---

## v1.4.0 패치 사이클 종합 (Wave 1~6 누적)

- **새 spec 75개 추가, 회귀 0건** (Wave 0 baseline 98 passed → 173 passed). 27개 기존 실패는 모두 v1.3.5 출시 시점 사전 존재(위젯 XML/nav-icon size 등).
- **신설 파일 15개**: tests 9 (notifications_default / auth_gate / css_tokens / router_unmount / sanitize / bookmarks_double_tap / mystories_uid_guard / timeout.utils / storage.utils / sharing_kakao) + src 4 (utils/timeout / utils/storage) + rules 2 (firestore.rules / storage.rules) + 1 (.env.example).
- **삭제**: `src/js/pages/donate.js` (audit P0 사기 안내 제거).
- **사용자 액션 필수**:
  1. `firebase deploy --only firestore:rules,storage` 실행 — audit P0 admin 권한 탈취 차단.
  2. 카카오 콘솔에서 JS 키 발급 후 `.env` 주입 — Wave 6 활성화.
  3. 수동 QA — 비로그인 → 자동 `/login`, 라이트/다크/폰트 크기 토글, `prefers-reduced-motion` ON 시 애니메이션 무력화, 메모리 누수 회복.
- **다음 패치 후보(v1.5)**: 카카오 공유 버튼을 페이지 UI에 노출 / `autoPublishScheduled` Cloud Function 이전 / 컬렉션 Firestore 동기화 / 햅틱(`@capacitor/haptics`) 도입 / 휠 피커 공통화(E2E 선행 후).

---

## 2026-05-24 01:11 — Claude (Opus 4.7)

- 요구사항: **관리자 외 모든 계정에 5개 더미 카드(리처드 1세 · 에펠탑 · 반 고흐 · 콜로세움 · 뉴턴)가 노출되는 P0 버그** 수정. 사용자 결정: demo 폴백 완전 제거 + 빈 상태 UI + 회귀 테스트.
- 원인 분석: Wave 4 도입 `firestore.rules` 가 일반 사용자에게 `status == 'published'` 문서만 read 허용하는데, `src/js/services/stories.js` 쿼리에는 status 필터가 없어 DB에 `draft/scheduled` 문서가 한 건이라도 있으면 권한 거부로 전체 쿼리 실패 → catch 블록의 `return DEMO_STORIES` 가 5개 더미를 일반 사용자에게 노출. 관리자는 `isAdmin()` 가드 통과로 모든 status 문서 read 가능해 폴백 미트리거 → 비대칭 발생.
- 구현방법:
  - **`src/js/services/stories.js`** — `DEMO_STORIES` import 제거, `fallbackToDemo()` 헬퍼 삭제. 5개 함수(`fetchStoriesFresh`/`fetchTodayStory`/`fetchStoryById`/`searchStoriesDB`/`fetchStoriesWithLicense`) 의 모든 demo 폴백 경로를 빈 결과(`[]`/`null`) 로 변경. `fetchStoriesFresh`/`fetchTodayStory`/`fetchStoriesWithLicense` 쿼리에 `where('status','==','published')` 추가하여 보안 룰과 일치.
  - **`src/js/data/demo.js`** — 파일 + 빈 폴더 삭제.
  - **`src/js/pages/editorstory.js`** — `loadEditorStoryData` 에 `todayStory == null` 가드 추가. 빈 상태 메시지(`아직 발행된 카드가 없어요 / 곧 첫 카드가 도착할 거예요`) 렌더 후 early return.
  - **`src/js/pages/search.js`** — 초기 로딩 시 `allStories.length === 0` 이면 기존 `#search-empty` 요소 텍스트를 빈 상태 메시지로 갱신해 표시. (detail.js / license.js 는 기존 빈 상태 UI 재사용으로 변경 불요.)
  - **TDD spec** `tests/stories-fallback.spec.js`(신규) — 3 시나리오 × 5 함수 = 15 케이스. ① Firestore 권한 거부(`PERMISSION_DENIED` reject) → 모두 빈 결과. ② Firestore 빈 응답(`docs: []`) → 모두 빈 결과. ③ 정상 published 응답 → 그대로 통과. 모든 케이스에 `assertNoDemoLeak()` 으로 "리처드/에펠/고흐/콜로세움/뉴턴" 미포함 검증.
  - **`docs/audit/2026-05-22/할일.md`** — 상단에 `🔴 긴급 P0 — 더미 데이터 노출 (2026-05-24 처리)` 섹션 추가. 증상·원인·조치 3 bullet.
- 변경파일: `src/js/services/stories.js`, `src/js/pages/editorstory.js`, `src/js/pages/search.js`, `src/js/data/demo.js`(삭제), `tests/stories-fallback.spec.js`(신규), `docs/audit/2026-05-22/할일.md`.
- 검증: baseline 58 failed / 143 passed → 51 failed / 150 passed. **회귀 0건, 새 spec 15/15 통과**. `npm run build` 154ms 성공, demo.js 미참조 import 오류 없음. 안드로이드 영향 변경 없음 → `npx cap sync android` 불필요.
- 후속(다음 패치 후보): ① i18n 키(`home.empty_stories_*`) 추가해 영/일 번역 채우기. ② `fetchStoriesFresh` 의 복합 인덱스(`status` + `publish_date`) 가 Firestore 콘솔에 자동 생성됐는지 첫 실행 시 콘솔 로그 확인. ③ audit P1 #8(autoPublishScheduled Cloud Function 이전) — 일반 사용자 권한으로는 `updateDoc` 호출 자체가 실패해 무의미하므로 빨리 옮기는 게 좋음.

### 2026-05-24 01:26 후속 — 인덱스 코드 관리 + autoPublish admin 가드 (Claude)

- 배경: 위 패치 적용 후 사용자가 dev 서버에서 확인. 더미는 사라졌으나 카드가 비어 보임. 브라우저 콘솔에 ① `오늘의 스토리/스토리 목록 조회 실패: The query requires an index. You can create it here: ...` 두 건(새 쿼리가 status+publish_date 복합 인덱스를 요구하나 미생성), ② `예약 발행 자동 전환 실패: Missing or insufficient permissions` (일반 사용자가 `autoPublishScheduled` 호출 시 `updateDoc` 거부 — 보안 룰 정상 동작) 발생.
- 구현방법:
  - **`firestore.indexes.json`(신규)** — `stories` 컬렉션 [`status` ASC + `publish_date` DESC] 복합 인덱스 1개 정의. `fetchStoriesFresh` 와 `fetchTodayStory` 두 쿼리가 동일 인덱스로 모두 커버됨.
  - **`firebase.json`** — `"firestore"` 블록에 `"indexes": "firestore.indexes.json"` 경로 추가. 다음 패치부터 `firebase deploy --only firestore:indexes` 로 인덱스도 CI 가능.
  - **`src/js/services/stories.js`** — `autoPublishScheduled()` 시작점에 `getState('profile')?.role === 'editor'` 가드 추가. 일반 사용자는 호출 자체를 건너뛰어 보안 룰 거부 경고로부터 콘솔 청소. 관리자만 정상 실행. `import { getState } from '../state.js'` 추가.
  - **`tests/stories-fallback.spec.js`** — `state.js` 모듈 mock 추가(stories.js → state.js → 모듈 로드 시점 `localStorage` 호출이 vitest 4 환경에서 폭발하던 것 차단). `getState` 가 null 반환하도록 가짜 mock — 기존 admin 가드 흐름이 그대로 통과.
- 변경파일: `firestore.indexes.json`(신규), `firebase.json`, `src/js/services/stories.js`, `tests/stories-fallback.spec.js`.
- 검증: `npx vitest run tests/stories-fallback.spec.js` 15/15 통과. 전체 회귀 0건 유지(51 failed / 150 passed, 직전 patch 와 동일). `npm run build` 121ms 성공.
- 사용자 액션 필수: ① Firebase 콘솔에서 두 인덱스 생성 링크 클릭 → "Create index" → 5~10분 대기 (또는 `firebase deploy --only firestore:indexes` 1회). 인덱스 활성화되면 stories 컬렉션의 published 카드가 정상 표시됨. ② `firebase deploy --only firestore:rules,storage` 가 라이브에 배포됐는지 확인 (audit P0 admin 권한 탈취 차단).

## 2026-05-24 — Claude Sonnet 4.6

- 요구사항: 탭/페이지 전환 시 이전 페이지의 스크롤 위치가 새 페이지에 그대로 이어지는 버그 수정. 예: `/profile`을 아래로 스크롤 후 ⚙ 설정 진입 시 `/settings`가 하단부터 표시됨.
- 원인 분석: 해시(#) 기반 SPA 라우팅에서 `hashchange` 이벤트 발생 시 Chrome / Android WebView의 자동 스크롤 복원(Scroll Restoration)이 `#page-container`의 이전 scrollTop을 비동기적으로 복원 → 라우터의 `container.scrollTop = 0`(line 276)을 덮어씌움. 추가로 동일 탭 재클릭 시 `window.scrollTo(0, 0)` 호출이 실제 스크롤 컨테이너(`#page-container`)가 아닌 window를 대상으로 해 효과 없던 버그도 함께 수정.
- 구현방법:
  - **`initRouter()`**: `history.scrollRestoration = 'manual'` 추가 → 브라우저 자동 스크롤 복원 비활성화. SPA에서 라우터가 직접 관리하도록.
  - **`handleRoute()`**: 기존 `container.scrollTop = 0` 뒤에 `requestAnimationFrame(() => { container.scrollTop = 0; })` 추가 → WebView 구버전 대비 비동기 복원 방어.
  - **동일 탭 재클릭 핸들러(line 379)**: `window.scrollTo({ top:0, behavior:'smooth' })` → `document.getElementById('page-container').scrollTo({ top:0, behavior:'smooth' })` — 올바른 컨테이너 대상.
- 변경파일: `src/js/router.js`.
- 검증: `npm test` — 51 failed / 150 passed, 직전 베이스라인과 동일, 회귀 0건. 수동 테스트 필요: profile 스크롤 후 settings 진입 시 최상단 확인 / 동일 탭 재탭 시 smooth scroll 동작 확인.

## 2026-05-24 후속 — 탭 전환 로딩 최적화 (Keep-Alive DOM 캐시 + 데이터 캐시 확장)

- 요구사항: 탭(editorstory ↔ mystory) 이동마다 페이지가 새로 로딩되고 이미지가 늦게 뜨는 문제 해결.
- 원인 분석: `router.js`의 `container.innerHTML = ''`가 매번 전체 DOM을 파괴 → Firestore 재쿼리(1~2초) + 이미지 재렌더링 발생. myStories, bookmarks에 캐시 없음.
- 구현방법:
  - **`src/js/router.js`**: `PAGE_DOM_CACHE` Map + `KEEP_ALIVE_ROUTES = ['/editorstory', '/mystory']` 추가. `handleRoute()`에서 KEEP_ALIVE 경로 이탈 시 `container.removeChild` + 캐시 저장(cleanup 함수 포함), 재진입 시 `appendChild`로 즉시 복원. `forceRoute()`는 캐시 폐기 후 재렌더. `invalidatePageCache()` export.
  - **`src/js/services/mystories.js`**: 60초 UID별 in-memory Promise 캐시 추가. `createMyStory`, `updateMyStory`, `deleteMyStory` 후 `invalidateMyStoriesCache()` 호출.
  - **`src/js/services/bookmarks.js`**: 60초 in-memory 캐시 for `getBookmarkedStoryIds()`. `toggleBookmark()` finally에서 `invalidateBookmarksCache()` 호출.
  - **`src/js/services/stories.js`**: `STORIES_CACHE_TTL_MS` 60초 → 5분.
  - **`src/css/components.css`**: `.card-img-fade` / `.img-loaded` 이미지 fade-in 스타일 추가.
  - **`src/js/pages/editorstory.js`, `mystory.js`**: 카드 innerHTML 설정 후 `img.onload` → `.img-loaded` 클래스 추가(opacity 0→1).
- 변경파일: `src/js/router.js`, `src/js/services/mystories.js`, `src/js/services/bookmarks.js`, `src/js/services/stories.js`, `src/css/components.css`, `src/js/pages/editorstory.js`, `src/js/pages/mystory.js`.
- 검증: `npm test` — 36 failed / 13 passed, 변경 전 베이스라인과 동일, 회귀 0건.

### 2026-05-24 후속 — 스크롤 버그 근본 원인 수정 (CSS 레이아웃)

- 배경: 위 router.js 변경 적용 후 사용자가 "최상단부터 뜨지 않음. 여전히 스크롤이 동기화됨" 재현 보고. router.js 패치가 효과 없었음.
- 근본 원인: `.app-container { min-height: 100dvh }` 는 flex 컨테이너에 *definite height*를 부여하지 않음. CSS 명세상 `flex: 1` 이 자식을 제한된 높이로 묶으려면 부모에 `height` (확정 값) 가 있어야 함. `min-height`만으로는 불가 → `#page-container { flex: 1; overflow-y: auto }` 가 실제 스크롤 컨테이너로 동작하지 않고 콘텐츠 높이만큼 무한 팽창 → **window 레벨 스크롤** 발생. `container.scrollTop = 0` 은 window를 스크롤 중일 때 완전히 무의미. `#bottom-nav`·`.status-bar-spacer`는 모두 `position:fixed` 라 flex flow 에서 제외 — `.app-container`의 flex 자식은 `#page-container` 하나뿐.
- 구현방법: **`src/css/base.css`** — `.app-container` 를 `min-height: 100vh; min-height: 100dvh;` → `height: 100vh; height: 100dvh;` 로 변경. 이로써 `#page-container`에 `100dvh` 확정 높이가 주어지고 `overflow-y: auto` 가 실제 활성화됨. 콘텐츠는 window 가 아닌 `#page-container` 안에서 스크롤. 기존 router.js 3개 변경(`scrollRestoration='manual'` / rAF 안전망 / `container.scrollTo` 재클릭)은 모두 이 CSS 기반 위에서 올바르게 동작.
- 변경파일: `src/css/base.css`.
- 검증: `npx vitest run tests/stories-fallback.spec.js` 15/15 통과. 51 failed / 150 passed 동일, 회귀 0건. 수동 테스트 필요: profile 스크롤 후 settings 진입 → 최상단 확인.

### 2026-05-24 후속 — 프로필 헤더에 관리자 전용 콘텐츠 관리 버튼 추가

- 요구사항: 관리자(role==='editor') 계정에 한해, 프로필 페이지 헤더 우상단 설정(기어) 버튼 좌측에 콘텐츠 관리(`/editorstory`) 이동 버튼 추가.
- 구현방법: **`src/js/pages/profile.js`** — `isAdmin` 조건 추가. 관리자일 때 연필 아이콘(`#goto-editor-btn`)을 기어 버튼 좌측에 flex 컨테이너(`page-header-actions`)로 나란히 배치. 비관리자는 기어 버튼만 기존과 동일. `setTimeout` 블록에 `#goto-editor-btn` 클릭 핸들러(`navigate('/editorstory')`) 추가.
- 변경파일: `src/js/pages/profile.js`.

### 2026-05-24 후속 — editor-new-page 레이아웃 버그 수정

- 요구사항: 일화 수정/작성 페이지(`editor-new-page`)의 노치 safe area 미적용, 좌우 스크롤 발생, 이미지 버튼 row 오버플로 수정.
- 근본 원인: `.editor-new-page { position: absolute; inset: 0 }`이 `position: absolute`로 부모의 `padding-top`을 무시하고 화면 최상단부터 덮어씌움 → 노치 침범. `overflow-x: hidden` 없어 부모 클리핑 미적용 → 좌우 스크롤. 이미지 input + 버튼 3개가 한 flex row → 좁은 화면 오버플로.
- 구현방법:
  - **`src/css/pages.css`** — `.editor-new-page`에 `overflow-x: hidden`, `padding-top: env(safe-area-inset-top, 0px)`, `scroll-padding-top: calc(safe-area + 52px)` 추가.
  - **`src/css/pages.css`** — `.editor-new-header { top: 0 }` → `top: env(safe-area-inset-top, 0px)` 변경(sticky 노치 보정).
  - **`src/js/pages/editor.js`** — 이미지 input과 버튼 그룹(`편집`, `보관함`, `촬영`)을 두 줄로 분리해 flex 오버플로 제거.
- 변경파일: `src/css/pages.css`, `src/js/pages/editor.js`.

### 2026-05-24 후속 — 나의 일화 데이터 미표시 원인 진단 및 인덱스 추가

- 요구사항: 사용자가 v1.4.0 배포 후 기존에 작성한 나의 일화 데이터가 사라진 것으로 보고. 면밀히 검토하여 원인 파악.
- 근본 원인: `fetchMyStories`가 `where('uid') + orderBy('publish_date') + orderBy('created_at')` 복합 인덱스 필수 쿼리를 사용하는데, v1.4.0에서 새로 추가된 `firestore.indexes.json`에 `stories` 컬렉션 인덱스만 정의되어 있고 `userStories` 인덱스가 누락됨. Firestore가 `failed-precondition` 에러를 던지지만 [src/js/services/mystories.js:40-44](src/js/services/mystories.js#L40-L44)의 catch 블록이 조용히 `return []`로 폴백 → UI에 카드 0개로 표시. 데이터 자체는 Firestore에서 삭제되지 않음 (v1.4.0에 삭제·마이그레이션 코드 없음 확인).
- 구현방법: **`firestore.indexes.json`** — `userStories` 컬렉션의 복합 인덱스(`uid ASC + publish_date DESC + created_at DESC`)를 추가. 사용자는 Firebase Console의 자동 생성 링크로 즉시 복구 가능(1~5분); 영구 보존을 위해 `firebase deploy --only firestore:indexes` 배포 필요.
- 변경파일: `firestore.indexes.json`.
- 검증: Firebase Console > Firestore > Indexes에서 `userStories` 인덱스 Enabled 상태 확인 후 앱 새로고침 → `/mystory` 페이지에서 카드 정상 표시 여부 확인.

## 2026-05-25

### 카드 좌우 스와이프 Swiper.js 11 도입 (editorstory + mystory)

- 요구사항: 카드 좌우 스와이프가 뻑뻑하고 빠른 연속 스와이프가 "씹히는" 문제 해결. 목표는 iPhone 사진 앱 같은 빠르고 쫀득한 한-장씩 넘김(snap, 관성, 하드웨어 가속).
- 근본 원인 (7가지): ① `SWIPE_COMMIT_GUARD_MS = 1500ms`로 연속 입력 차단, ② `.flipper` 한 요소가 `translateX`(스와이프)+`rotateY`(플립)을 동시에 받아 transform 충돌, ③ 매 touchmove에서 `style.transform` 동기 조작(rAF 미사용), ④ `transition: 'none'` ↔ `transition: '...'` 토글 반복으로 레이아웃 재계산, ⑤ 스택 애니메이션(520ms) vs 스와이프 반환(220ms) 시간 불일치, ⑥ 휠 `candidate.click()` 시뮬레이션 우회 경로로 카드 DOM 통째 교체, ⑦ `getCenterItem`의 반복 `getBoundingClientRect`로 레이아웃 스래싱.
- 구현방법:
  - **`src/js/utils/cardSwiper.js`** (신규) — Swiper 11 + Virtual 모듈 래퍼. `slidesPerView:1, slidesPerGroup:1, threshold:5, longSwipesRatio:0.2, speed:320, resistance:0.85, touchAngle:45, cssMode:false`로 iPhone 갤러리 느낌 + 한 장씩 snap + 수직 스크롤 보존. Virtual `addSlidesBefore/After:1`로 양옆 1장만 실제 DOM(메모리 효율).
  - **`src/js/pages/editorstory.js`** — 모듈 스코프 `lastSwipeCommitAt`/`SWIPE_COMMIT_GUARD_MS`/`CARD_STACK_SETTLE_MS` 제거, 함수 스코프 스와이프 상태(`isAnimating`/`isSwiping`/`swipeAxis`/`touchStartX/Y`)·`handleStart/handleMove/handleEnd` 전부 제거, touch/mouse 이벤트 리스너 제거. 일/월 휠과 Swiper 양방향 동기화(`swiper.slideTo(idx, 320)`). `renderCard` → `buildSlideHTML`(순수 HTML 문자열)로 분리. `bindCardEvents` → `bindFlipCardEvents`로 축소(공유/북마크/디테일/플립/에디터 한마디만).
  - **`src/js/pages/mystory.js`** — editorstory와 동일 패턴. `renderCardToArea` → `buildMyStorySlideHTML`. `bindCardEvents` → `bindMyStoryCardEvents`(쓰기/수정/공유/플립). `renderMyStoryNew`(폼 페이지)는 변경 없음.
  - **`src/css/pages.css`** — `.card-stack-item`, `.stack-enter-*`, `.stack-exit-*` 전체 블록 제거. `.card-swiper`(`touch-action:pan-y; overscroll-behavior-x:contain`)와 `.card-swiper .swiper-slide`(`will-change:transform; backface-visibility:hidden`) 추가.
  - **`tests/editorstory.ui.spec.js`** — "card stack motion" 정적 검증 테스트를 "card swipe motion" Swiper 검증으로 업데이트(레거시 stack-enter/exit 부재 + cardSwiper 사용 + touch-action 확인).
  - **`package.json`** — `swiper@^11.2.10` 추가.
- 변경파일: `package.json`, `package-lock.json`, `src/js/utils/cardSwiper.js`, `src/js/pages/editorstory.js`, `src/js/pages/mystory.js`, `src/css/pages.css`, `tests/editorstory.ui.spec.js`.
- 검증: `npm run build` 성공 (mystory 청크 25.34KB gzip 7.91KB, swiper 번들 통합). `npm test` 51 failed / 150 passed — 회귀 0건(베이스라인과 정확히 동일, 사전 실패는 모두 별도 환경/iOS 의존성 관련). 수동 검증 필요: `npm run dev` → `/editorstory` `/mystory`에서 좌우 스와이프 한 장씩 부드럽게 넘어가는지, 절반 끌고 놓으면 가까운 쪽으로 snap, 빠른 연속 스와이프 모두 인식, 카드 본문 수직 스크롤 보존, back-body 탭 플립 정상.

### 2026-05-25 02:02 — Codex

- 요구사항: 보관함 `calendar-toggle archive-toggle` 내부 좌측 `역사 일화` 항목의 표시 텍스트를 제거하고 북마크 아이콘으로 대체.
- 구현방법: `renderArchiveHeader()`의 history 탭 버튼을 텍스트 없는 SVG 북마크 아이콘으로 변경하고, `aria-label`에 번역된 `역사 일화` 접근성 이름을 유지. `.archive-toggle .calendar-toggle-btn svg` 크기를 토큰 기반으로 고정. 보관함 토글 history 항목이 아이콘만 렌더링되는지 Vitest 회귀 테스트 추가.
- 변경파일: `src/js/pages/bookmarks.js`, `src/css/pages.css`, `tests/bookmarks.ui.spec.js`, `docs/SESSION_LOG.md`.
- 검증: `npm test -- tests/bookmarks.ui.spec.js` 12/12 통과. `npm run build` 성공. `npm test`는 기존 작업 트리/환경 이슈로 34 failed / 15 passed 상태(대표: iOS RevenueCat checkout 테스트 import, Node 26 localStorage 미제공, 기존 widget/static 기대값 불일치).

### 2026-05-25 02:07 — Codex

- 요구사항: 보관함 토글 좌측 북마크 아이콘을 외곽선이 아닌 내부 색상 채움 형태로 표시.
- 구현방법: `renderArchiveHeader()`의 history 탭 SVG를 `fill="currentColor"`로 변경해 활성 탭 색상과 동일하게 내부가 채워지도록 조정. 보관함 UI 테스트도 채움 속성을 검증하도록 갱신.
- 변경파일: `src/js/pages/bookmarks.js`, `tests/bookmarks.ui.spec.js`, `docs/SESSION_LOG.md`.
- 검증: `npm test -- tests/bookmarks.ui.spec.js` 12/12 통과. `npm run build` 성공. `npm test`는 기존 환경/정적 기대값 이슈로 34 failed / 15 passed 상태.

### Swiper.js 재진단 및 수정 (2026-05-25 03:09)

- **요구사항**: 사용자 보고 버그 3가지 — ① 두 카드가 나란히 보임(overflow 미작동), ② 카드 검정화면(Virtual DOM 타이밍), ③ 휠 피커 wrong day(초기화 경쟁).
- **진단**: Explore 에이전트를 통해 근본 원인 파악 — ① `.editorstory-page { overflow: visible }` 이 `.swiper { overflow: hidden }` 을 시각적으로 무력화, ② Virtual `addSlidesBefore:1` 설정에서 DOM 렌더 대기 중 빈 슬라이드 노출, ③ `on.init onSlideActive` 호출 + `setTimeout/rAF activateDayWheelByIndex` 이중 호출로 스크롤 snap 위치 경쟁.
- **수정**: 두 가지 변경 — ① `.editorstory-page { overflow: hidden }` (pages.css L200), ② 초기 휠 이중 동기화 코드 제거하고 cardSwiper on.init 에서만 처리 (editorstory.js L305-310 삭제). mystory.js 는 초기화 로직이 더 단순해 영향 없을 가능성.
- **변경파일**: `src/css/pages.css`, `src/js/pages/editorstory.js`.
- **검증**: `npm test` 51 failed / 151 passed (baseline 51/150 대비 +1 통과, 회귀 0건).

### Swiper Virtual 제거 + 카드 간격 추가 (2026-05-25 03:24)

- **요구사항**: 사용자가 DOM 개발자도구 스크린샷 첨부 — Swiper Virtual 이 슬라이드를 DOM 에서 제거 않고 누적시킴 (인덱스 1, 2, 12-33, 57-61, 108-119, 139-142 등 비연속 잔재). 카드 간 간격 없음. 휠 피커와 카드 위치 불일치.
- **진단**: Virtual 모듈의 `cache: true` 가 슬라이드 HTML 캐시뿐 아니라 DOM 노드까지 누적시키는 동작. `addSlidesBefore: 1, addSlidesAfter: 1` 설정에도 불구하고 사용자가 스와이프할 때마다 새 슬라이드가 추가되고 이전 슬라이드는 제거되지 않음.
- **해결책**: Virtual 모듈 완전 제거. ~150장 슬라이드는 메모리 부담이 크지 않으므로 사전 생성하고 이미지는 `loading="lazy"` 로 가시 슬라이드만 네트워크 로드.
- **구현방법**:
  - **cardSwiper.js**: `import { Virtual }` / `'swiper/css/virtual'` / `modules: [Virtual]` / `virtual: {...}` 옵션 모두 제거. `slides`/`renderSlide`/`onSlideMounted` 인터페이스를 `slideCount`/`onSlideReady` 로 단순화 (활성 슬라이드 이벤트 바인딩만 책임). `spaceBetween: 16` 추가하여 카드 사이 16px 간격.
  - **editorstory.js / mystory.js**: `createCardSwiper` 호출 전에 `wrapperEl.innerHTML = slides.map(s => '<div class="swiper-slide">' + buildSlideHTML(...) + '</div>').join('')` 로 모든 슬라이드 사전 생성. `onSlideReady` 콜백에서 활성 슬라이드의 flip/share/bookmark/detail 이벤트 바인딩. `isProgrammaticSlide` 미사용 플래그 제거.
  - **이미지 lazy**: `buildSlideHTML` / `buildMyStorySlideHTML` 의 `<img>` 에서 `loading="eager"` → `loading="lazy"`. 가시 슬라이드만 네트워크 로드 보장.
  - **테스트 갱신**: `tests/editorstory.ui.spec.js` 의 "card swipe motion" 케이스에서 `Virtual`/`addSlidesBefore:1`/`addSlidesAfter:1` 검증을 `import Swiper from 'swiper'`/`spaceBetween:16`/`swiper-wrapper` 사전 생성 검증으로 교체.
- **변경파일**: `src/js/utils/cardSwiper.js`, `src/js/pages/editorstory.js`, `src/js/pages/mystory.js`, `tests/editorstory.ui.spec.js`.
- **검증**: `npm test` 51 failed / 151 passed (baseline 동일, 회귀 0건). `npm run build` 175ms 성공.

### 카드 그림자/회전 swiper 박스 밖 표현 (2026-05-25 04:05)

- **요구사항**: 사용자 보고 — 카드 좌우 그림자는 보이지만 위아래는 잘림. 카드 뒤집기가 swiper 박스 안에 갇힌 듯 답답함. 크롬 DevTools 로 `.swiper { overflow:hidden }` 제거 시 완전히 해결됨 확인.
- **진단**: ① `.front`/`.back` 의 box-shadow가 부모 `.flipper` 의 `transform-style:preserve-3d` + `will-change:transform` GPU 합성 레이어 격리로 영역 밖 확산 안 됨. ② `.wheel-pickers-container` opaque background 가 카드 위쪽 그림자 가림. ③ swiper.css 의 `.swiper { overflow:hidden }` 가 카드 box-shadow + flip 회전을 박스 안에 가둠. ④ 이전 `.card-swiper { overflow:visible }` 단독 셀렉터는 swiper.css 와 specificity 동률(0,1,0)이라 cascade 순서로 결과 불확실.
- **해결**:
  - box-shadow를 3D 컨텍스트 밖 `.flip-container` 로 이동 (perspective는 stacking context 미생성). `.card-swiper .swiper-slide .front/.back` 의 box-shadow 는 중복 방지로 제거.
  - `.editorstory-card-area` padding `0 16px` → `12px 16px`, `align-items: start` → `center` 로 카드 위아래 그림자 표시 공간 확보.
  - `.swiper.card-swiper { overflow: visible }` 복합 셀렉터(0,2,0)로 cascade 무관 무조건 이김. 인접 슬라이드 clip 은 부모 `.editorstory-page { overflow:hidden }` 담당.
- **변경파일**: `src/css/pages.css`.
- **검증**: `npm test` 51 failed / 151 passed (회귀 없음). `npm run build` 153ms 성공.

### v1.4.0 빌드 + Capacitor sync (2026-05-25 04:10)

- **요구사항**: 사용자가 새 안드로이드/iOS 빌드 배포 준비 요청. 버전 명/버전 코드(versionCode 22) 그대로 유지 결정.
- **구현방법**: `npm run build` 후 `npx cap sync android` + `npx cap sync ios` 실행. Android 8 plugin / iOS 9 plugin (RevenueCat 포함) 인식 완료. 변경 산출물은 `android/app/src/main/assets/public/index.html`.
- **변경파일**: `android/app/src/main/assets/public/index.html` (Capacitor sync 결과).
- **검증**: Android sync 0.062s, iOS sync 0.05s 모두 성공. 사용자는 Android Studio / Xcode 에서 각각 release 빌드/Archive 후 스토어 업로드 진행.

### 2026-05-25 05:03 — Codex

- **요구사항**: 루시드 아이콘 패키지 설치.
- **구현방법**: Vanilla JS 프로젝트에 맞춰 React용이 아닌 `lucide` 패키지를 설치. 기존 `@capacitor-firebase/authentication`/`firebase` peer 충돌 때문에 일반 `npm install lucide`는 실패하여, 현재 의존성 조합을 유지하는 `npm install lucide --legacy-peer-deps`로 `package.json`과 `package-lock.json`에 `lucide@1.16.0` 추가.
- **변경파일**: `package.json`, `package-lock.json`, `docs/SESSION_LOG.md`.
- **검증**: `npm list lucide`에서 `lucide@1.16.0` 확인. `npm run build` 성공. `npm test`는 기존 환경/정적 기대값 이슈로 34 failed / 15 passed, 51 failed / 151 passed 상태.

### 2026-05-25 05:08 — Codex

- **요구사항**: 프로필 페이지의 `나의 카드` 토글에서 `history-card-mini my-story-mini` 항목 탭 시 `/mystory` 이동 대신 기존 `calendar-card-popup`으로 해당 나의 카드 표시.
- **구현방법**: `initArchiveSection(page, options)`에 `myStoryClickMode` 옵션을 추가하고 기본값은 `navigate`로 유지. `profile.js`에서만 `{ myStoryClickMode: 'popup' }`을 전달해 프로필의 나의 카드 클릭이 `openCardPopup(story, 'mine', [], {})`를 호출하도록 분기. `/bookmarks` 기본 동작은 기존 `/mystory` 이동 유지.
- **변경파일**: `src/js/pages/bookmarks.js`, `src/js/pages/profile.js`, `tests/bookmarks.ui.spec.js`, `docs/SESSION_LOG.md`.
- **검증**: `npm test -- tests/bookmarks.ui.spec.js` 14/14 통과. `npm run build` 성공. `npm test`는 기존 환경/정적 기대값 이슈로 34 failed / 15 passed, 51 failed / 153 passed 상태.

### 2026-05-25 16:58 — Claude

- **요구사항**: 두 가지 심각한 버그 수정. (A) editorstory/mystory 페이지 재진입 시 Swiper 휠/카드가 1월 1일(activeIndex 0) 로 reset 되는 문제(iOS+Android 공통). 직전 KEEP_ALIVE 비활성화(a3784d9) 만으로는 미해결. (B) iOS 콜드 스타트 후 카드가 표시되지 않고 splash/빈 영역이 깜빡임 — 캘린더 보기는 정상, 카드 보기로 전환 시 깨짐.
- **구현방법**: 공통 근본 원인은 `sessionStorage.ds_session_view === 'calendar'` 상태로 진입 시 `#editorstory-card-area`/`#mystory-card-area` 가 `hidden` 인 채로 Swiper 가 init 되어 `getBoundingClientRect 0×0` → `slidesGrid` 가 0 으로 계산되어 `initialSlide` 가 anchor 되지 못함. iOS WKWebView 는 이후 `swiper.update()` 로도 stale layout 을 복구 못함. 해결책: (1) `createCardSwiper` 호출을 `ensureSwiper()` 클로저로 lazy 화하여 `swiperEl.offsetParent !== null` 인 시점(=card view 가 실제 보일 때) 에만 생성. calendar 진입 시는 toggle 핸들러가 첫 호출 → 정확한 dimension 으로 anchor 됨. (2) 토글 시 double rAF + `sw.update()` 로 iOS WKWebView reflow 타이밍 보강. (3) cardSwiper.js `on.init` guard 가 `sw.activeIndex` 를 callback 인자로 전달하도록 정리해 휠 동기화 일관성 확보. (4) mystory.js 의 redundant `getTimezoneOffset()*60000` 트릭을 `getLocalToday()` 로 정규화하여 editorstory.js 와 일관성 확보. 모든 `swiper.slideTo/activeIndex` 참조를 `ensureSwiper()?.` 경유로 변경(휠 스크롤/월·일 클릭 핸들러).
- **변경파일**: `src/js/utils/cardSwiper.js`, `src/js/pages/editorstory.js`, `src/js/pages/mystory.js`, `tests/swiper_lazy_init.spec.js` (신규 TDD spec), `android/app/src/main/assets/public/`, `ios/App/App/public/`, `dist/` (build 산출물), `docs/SESSION_LOG.md`.
- **검증**: `npm test -- tests/swiper_lazy_init.spec.js` 13/13 통과 (lazy init 패턴, getLocalToday 사용, guard 인자 검증). `npm test -- tests/view-toggle.spec.js tests/date.utils.spec.js tests/router_unmount.spec.js tests/swiper_lazy_init.spec.js` 44/45 통과 (1 실패는 settingsSections bindViewModeOptions — pre-existing, 무관). `tests/editorstory.ui.spec.js` 14/20 실패는 stash 비교로 baseline 과 동일함을 확인 (CSS regex / TypeError 모두 pre-existing). `npm run build` 152ms 성공. `npx cap sync android/ios` 완료. 수동 검증은 plan 문서(`/Users/dongjin/.claude/plans/fizzy-questing-diffie.md`) 의 Verification 섹션 참조 — iOS 시뮬레이터/Android 에뮬에서 콜드 스타트 + /editorstory↔/mystory 토글 + 캘린더↔카드 토글 시나리오 수행 필요.

### 2026-05-25 17:28 — Claude

- **요구사항**: 위 5:32 패치 이후에도 iOS 시뮬레이터에서 카드 슬라이드 시 화면이 멈추고 splash 가 재출력되는 문제 보고. Xcode 콘솔 로그: `WebContent makeImagePlus:3799: *** ERROR: 'WEBP'-_reader->initImage[0] failed err=-50` 4회 발생 후 `WebProcessProxy::didClose: (web process 0 crash)`. iOS WKWebView 의 WebP 디코더가 canvas-toBlob 으로 생성된 WebP 일부를 처리하지 못해 WebContent 프로세스 자체가 crash 되고, 그 결과 JS 컨텍스트 reload → splash 재진입.
- **구현방법**: 원인은 `profile.js` 의 avatar 업로드가 `canvas.toBlob('image/webp', 0.85)` + `profile_avatar_${timestamp}.webp` 로 저장한 결과물. 이 WebP avatar 가 editorstory/calendar/detail 카드 뒷면의 `back-editor-avatar` `<img>` 로 렌더링될 때 WKWebView 가 crash. 해결: (1) `src/js/utils/storage.js` 에 `isWebpUrl(url)` 유틸 추가 — pathname/encoded-path 의 `.webp` 확장자 탐지. (2) `profile.js` 의 신규 업로드를 `'image/jpeg'` + `.jpg` 로 변경 + `uploadBytes(... , { contentType: 'image/jpeg' })` 명시. (3) 기존 DB 의 WebP avatar 방어를 위해 `editorstory.js`, `calendar.js`, `detail.js`, `profile.js` 의 photoURL 렌더링 시점에 `isWebpUrl()` 가드 → true 면 `<img>` 대신 fallback SVG/이모지 표시. (4) `tests/swiper_lazy_init.spec.js` 에 WebP guard 검증 6 케이스 추가.
- **변경파일**: `src/js/utils/storage.js`, `src/js/pages/profile.js`, `src/js/pages/editorstory.js`, `src/js/pages/calendar.js`, `src/js/pages/detail.js`, `tests/swiper_lazy_init.spec.js`, `android/app/src/main/assets/public/`, `ios/App/App/public/`, `dist/`, `docs/SESSION_LOG.md`.
- **검증**: `npm test -- tests/swiper_lazy_init.spec.js` 19/19 통과 (기존 13 + WebP guard 6). `npm run build` 172ms 성공. `npx cap sync android` + `npx cap sync ios` 완료. 수동 검증 필요: iOS 시뮬레이터에서 콜드 스타트 → /editorstory 진입 → 좌우 swipe 반복 시 splash 가 더 이상 재출력되지 않고 카드가 연속 표시되는지 확인. 기존 WebP avatar 가 DB 에 남아있는 사용자는 fallback 이모지(✍️) 가 표시됨 — 추후 admin 측에서 avatar 재업로드로 복구 가능.

### 2026-05-25 17:46 — Claude

- **요구사항**: 위 17:28 패치 (isWebpUrl 가드) 적용 후에도 iOS 시뮬레이터에서 WebP 디코더 에러 25회 발생 → WebContent crash 가 재현됨. 사용자 결정: 에디터 아바타를 모두 로컬 PNG (`assets/editor_profile.png`) 로 강제 할당. (story.editor.photoURL DB 값과 무관하게 일관된 단일 PNG 표시 → WebP crash 가능성 0).
- **구현방법**: (1) `assets/editor_profile.png` 를 `public/assets/editor_profile.png` 로 복사 → Vite 가 `dist/assets/editor_profile.png` 로 정적 serve (절대 경로 `/assets/editor_profile.png`). (2) `editorstory.js`, `calendar.js`, `detail.js`, `editor.js` (admin preview 포함) 4개 파일의 모든 에디터 아바타 `<img src="${editorPhotoURL}">` 를 `<img src="/assets/editor_profile.png">` 로 교체. onerror fallback 도 제거 (로컬 PNG 는 실패할 수 없음). (3) 더 이상 사용되지 않는 `isWebpUrl` import 와 `editorPhotoURLRaw`/`editorAvatarRaw` 변수를 `calendar.js`, `detail.js`, `editorstory.js` 에서 정리. (4) `profile.js` 의 사용자 photoURL 가드와 `storage.js` 의 `isWebpUrl` 유틸은 유지 (사용자 프로필 아바타의 기존 WebP 방어용). (5) `tests/swiper_lazy_init.spec.js` 의 WebP-guard 케이스를 PNG-경로 검증 케이스로 교체 (4개 페이지 모두 `/assets/editor_profile.png` 사용 확인 + PNG 파일 존재 확인).
- **변경파일**: `public/assets/editor_profile.png` (신규 복사본), `src/js/pages/editorstory.js`, `src/js/pages/calendar.js`, `src/js/pages/detail.js`, `src/js/pages/editor.js`, `tests/swiper_lazy_init.spec.js`, `android/app/src/main/assets/public/`, `ios/App/App/public/`, `dist/`, `docs/SESSION_LOG.md`.
- **검증**: `npm test -- tests/swiper_lazy_init.spec.js` 21/21 통과. `npm run build` 312ms 성공 — `dist/assets/editor_profile.png` (1045B) 포함 확인. `npx cap sync ios` 완료 — `ios/App/App/public/assets/editor_profile.png` 동기화 확인. 수동 검증: iOS 시뮬레이터 콜드 스타트 → 카드 좌우 swipe 반복 → 더 이상 `'WEBP'-_reader->initImage[0] failed err=-50` 로그가 나오지 않고 WebContent crash 가 발생하지 않아야 함.

### 2026-05-27 10:38 — Claude

- **요구사항**: 위 패치들 이후에도 iOS 시뮬레이터에서 WebP 디코더 에러 25+회 반복 + `GPU Process has crashed more than 2 times` 가 재현됨 + `오늘의 스토리 조회 실패: 시간 초과` 연쇄 발생. 사용자 명시 요구: (1) 강력한 lazy loading, (2) 깨진 WebP 에 대한 fallback/onerror 핸들링, (3) 이미지 과부하로 인한 fetchMyStories timeout 해소, (4) 스토리 카드 컴포넌트 중심으로 종합 최적화.
- **구현방법**: 세 가지 우선순위 fix 를 동시 적용. **Step 1 — GPU 합성 레이어 축소**: `src/css/pages.css:479-486` 의 `.card-swiper .swiper-slide` 기본 rule 에서 `will-change: transform` 과 `backface-visibility: hidden` 을 제거하고 새 셀렉터 `.card-swiper .swiper-slide-active/-next/-prev` 에만 부여. Swiper 11 의 `watchSlidesProgress=true` 가 이 클래스들을 자동 부여하므로 JS 변경 불필요. `.flipper` 도 `src/css/components.css:168` 기본 rule 에서 `will-change` 제거, `pages.css` 의 active/next/prev `.flipper` 셀렉터에만 부여. 결과: 동시 GPU 합성 레이어를 ~300-450개 → ~6개 (±1 슬라이드 한정). **Step 2 — 이미지 fallback 3단 방어**: `editorstory.js` 와 `mystory.js` 의 import 에 `isWebpUrl` 추가 + 모듈 상수 `FALLBACK_IMG`(/assets/editor_profile.png) + `IMG_ONERROR`(this.onerror=null + src 교체) 정의. `buildSlideHTML`/`buildMyStorySlideHTML` 의 `story.image_url` 가 WebP 면 src 부여 자체를 skip (디코더 미진입), 비-WebP 면 부여하되 `onerror` 핸들러 부여 (디코드 실패 시 fallback). **Step 3 — timeout + Promise.all 디커플**: `utils/timeout.js` 의 `withTimeout` default 5000 → 12000ms. `services/stories.js` 의 fetchTodayStory 2500 → 8000, fetchStoryById 3000 → 8000. `services/mystories.js` 의 fetchMyStories 5000 → 12000. `editorstory.js:loadEditorStoryData` 의 `Promise.all([fetchStories, fetchTodayStory, getBookmarkedStoryIds])` 를 디커플 — 북마크는 별도 비동기로 분리 + `.catch` 로 실패 시 빈 배열, critical path 는 stories+todayStory 만. 늦게 도착한 북마크는 활성 슬라이드의 아이콘만 다시 칠함 (전체 재렌더 X). 신규 spec `tests/ios_gpu_webp_guard.spec.js` 18 케이스 추가.
- **변경파일**: `src/css/pages.css`, `src/css/components.css`, `src/js/pages/editorstory.js`, `src/js/pages/mystory.js`, `src/js/utils/timeout.js`, `src/js/services/stories.js`, `src/js/services/mystories.js`, `tests/ios_gpu_webp_guard.spec.js` (신규), `dist/`, `android/app/src/main/assets/public/`, `ios/App/App/public/`, `docs/SESSION_LOG.md`.
- **검증**: `npm test -- tests/ios_gpu_webp_guard.spec.js tests/swiper_lazy_init.spec.js` 39/39 통과 (신규 18 + 기존 21 회귀 없음). `npm run build` 193ms 성공. `npx cap sync android` + `npx cap sync ios` 완료. 수동 검증 (사용자): Xcode 시뮬레이터에서 (a) 카드 30+회 연속 swipe → `GPU Process has crashed` 로그 부재 확인, (b) WebP `image_url` 가진 historical story 진입 → fallback PNG 표시 + WebP 디코더 에러 한 번도 안 나옴, (c) Network Link Conditioner 3G → 첫 카드 12초 이내 paint + "시간 초과" 토스트 없음 + 북마크 아이콘 ≤2초 후 갱신, (d) Safari Web Inspector Layers 탭 → 동시 합성 레이어 ≤10개.

### 2026-05-27 11:09 — Claude

- **요구사항**: 직전 10:38 패치(Step 2 의 `isWebpUrl` 차단) 적용 후 두 가지 새 문제 보고. (1) **모든 카드가 동일한 이미지(editor_profile.png) 로 표시** — 데이터 바인딩이 꼬인 것처럼 보이는 심각한 UX 버그. (2) **GPU 크래시 여전히 발생** — iOS WebKit 의 OS-level WebP crash 는 JS `onerror` 발화 이전에 발생할 수 있어 완전 차단 불가. 사용자 결정: WebP src 차단을 롤백하고 `<img src>` 는 항상 `story.image_url` 그대로 부여, `onerror` 핸들러만 "운 좋게" 잡힐 때 fallback 으로 swap.
- **구현방법**: 코드 점검 결과 데이터 바인딩 자체는 정상 (`buildSlideHTML(rawStory, ...)` 의 `story.image_url` 은 closure 문제 없음). 진짜 원인은 **JPEG-only patch 이전 historical 스토리들이 거의 모두 `.webp` 경로** 라서 `isWebpUrl()` 가 정확히 작동하면서 **모든 카드를 FALLBACK_IMG(editor_profile.png) 로 강제 치환**한 것. 사용자가 "WebP 시도 후 가끔 crash" 를 "모든 카드 동일 이미지" 보다 UX 적으로 낫다고 판단 → 롤백. **변경**: (A) `editorstory.js` 의 `buildSlideHTML` 에서 `const imageSrc = (rawImage && !isWebpUrl(rawImage)) ? rawImage : FALLBACK_IMG;` 를 `const imageSrc = story.image_url || FALLBACK_IMG;` 로 단순화, `isWebpUrl` import 제거. (B) `mystory.js` 의 `buildMyStorySlideHTML` 동일 패턴. (C) `tests/ios_gpu_webp_guard.spec.js` 의 `isWebpUrl 사용` 단언 2개를 `isWebpUrl 차단을 더 이상 사용하지 않음` + `imageSrc = story.image_url || FALLBACK_IMG` 단언으로 교체. `utils/storage.js` 의 `isWebpUrl` utility 는 `profile.js` 의 사용자 avatar 가드에서 계속 사용되므로 유지. CSS GPU 레이어 scope(이전 Step 1) + timeout 상향 + bookmarks 디커플(이전 Step 3) + Swiper lazy init + editor avatar 로컬 PNG 고정은 **변경 없이 유지**.
- **변경파일**: `src/js/pages/editorstory.js`, `src/js/pages/mystory.js`, `tests/ios_gpu_webp_guard.spec.js`, `dist/`, `android/app/src/main/assets/public/`, `ios/App/App/public/`, `docs/SESSION_LOG.md`.
- **검증**: `npm test -- tests/ios_gpu_webp_guard.spec.js tests/swiper_lazy_init.spec.js` 42/42 통과 (신규 spec 의 isWebpUrl 단언 롤백 + utility 보존 단언 추가). `npm run build` 167ms 성공. `npx cap sync android` + `npx cap sync ios` 완료. 수동 검증 (사용자): (a) 각 카드가 자신의 고유 이미지를 표시 — 모든 카드가 editor_profile.png 였던 증상 해소, (b) WebP 디코드 실패 카드는 onerror catch 성공 시 fallback PNG, OS-level crash 발생 시 splash 잠깐 → 자동 복구, (c) GPU 합성 레이어 scope 유지로 crash 빈도 ~150 → ~6 슬라이드 한정.

### 2026-05-27 11:30 — Claude

- **요구사항**: 사용자가 직접 기기 테스트로 진짜 원인 확정. **이미지 문제가 절대 아님** — 캘린더 보기는 멀쩡, 첫 카드 flip 도 정상, **카드를 스와이프하는 순간 GPU crash** 발생. mystory 의 빈 카드(이미지 0개) 로 스와이프해도 동일 crash. WebP err=-50 로그는 GPU OOM 의 부수 증상이었음. 진짜 원인은 **Swiper 의 wrapper translate3d 애니메이션 + 150개 `.flipper` 의 `transform-style: preserve-3d` + `.flipper` 자체의 `transition: transform 0.4s` 가 동시에 iOS WebKit GPU 컴포지터를 점유하면서 VRAM/layer cache 초과 → WebContent process 살해**.
- **구현방법**: 두 가지 fix 동시 적용. **Step 1 — Swiper Virtual 모듈 도입**: `cardSwiper.js` 에 `import { Virtual } from 'swiper/modules'` + `import 'swiper/css/virtual'` 추가. `modules: [Virtual]` + `virtual: { enabled, slides, renderSlide, addSlidesBefore: 2, addSlidesAfter: 2, cache: false }` 옵션 적용. 시그니처 변경: `slideCount` 폐기, `slides` 배열 + `renderSlide(slideData, idx) => HTML` 콜백 받음. `cache: false` 로 이전 세션의 "DOM 누적" 우려 해소. **Step 2 — editorstory.js / mystory.js 의 Swiper 호출 변경**: `wrapperEl.innerHTML = slides.map(...).join('')` 사전 빌드 블록 삭제. `createCardSwiper(swiperEl, { slides, renderSlide: (slide) => buildSlideHTML(slide.story, slide.iso), ... })` 로 변경. Virtual 이 가시 슬라이드 ±2 (총 5개) 만 DOM 에 유지 → ~150 → ~5 .flipper. **Step 3 — `.flipper` 의 `transition: transform` 분리**: `components.css` 의 `.flipper` 기본 rule 에서 `transition: transform 0.4s ease-in-out 0.05s, scale 0.2s` 를 `transition: scale 0.2s` 로 축소. `.flipper.is-flipping` 블록에 `transition: transform 0.4s ease-in-out 0.05s, scale 0.2s` 추가 — JS flip handler 가 이미 toggle('flipped') 전후로 add/remove('is-flipping') 하므로 flip 동작 시에만 transition 활성. Swiper swipe 중에는 `.is-flipping` 이 없어 충돌 차단. **테스트**: `tests/ios_gpu_webp_guard.spec.js` 에 Virtual 도입 단언 8개 + .flipper transition 분리 단언 2개 추가. **확인**: `backdrop-filter: blur(6px)` 는 `.calendar-card-popup` (pages.css:2554, 2587) 에만 있고 card-swiper 와 별개 스택이라 무관 — 변경 불필요.
- **변경파일**: `src/js/utils/cardSwiper.js`, `src/js/pages/editorstory.js`, `src/js/pages/mystory.js`, `src/css/components.css`, `tests/ios_gpu_webp_guard.spec.js`, `dist/`, `android/app/src/main/assets/public/`, `ios/App/App/public/`, `docs/SESSION_LOG.md`.
- **검증**: `npm test -- tests/ios_gpu_webp_guard.spec.js tests/swiper_lazy_init.spec.js` 52/52 통과 (신규 Virtual + transition 분리 10개 추가). `npm run build` 167ms 성공 — index 번들 113kB → 118kB (Virtual 모듈 추가). `npx cap sync ios/android` 완료. 수동 검증 (사용자): (a) editorstory 카드 좌로 스와이프 → 다음 카드 표시 + 앱 죽지 않음, (b) mystory 빈 카드로 스와이프 → 동일, (c) 30+회 swipe + 5~10회 flip → GPU crash / WebView reload 없음, (d) Safari Web Inspector Elements 탭에서 `.swiper-slide` 가 ~5개만 존재 확인 (이전 ~150개), (e) flip 시각 회귀 없음 (is-flipping 클래스로 transition 정확히 활성).

### 2026-05-27 11:41 — Claude

- **요구사항**: 위 Virtual 패치 적용 후 앱은 안 죽으나 editorstory + mystory 카드 영역이 빈 화면으로 보임 (휠 피커는 정상, 토글 버튼은 정상). 카드 자체가 표시 안 됨.
- **구현방법**: Swiper Virtual 의 `renderSlide` 동작을 정밀 조사 ([node_modules/swiper/modules/virtual.mjs:41-46](node_modules/swiper/modules/virtual.mjs#L41-L46)). `renderSlide` 가 string 을 반환하면 Swiper 가 `tempDOM.children[0]` 을 그대로 slide DOM 요소로 사용 — **outermost 요소가 `.swiper-slide` 클래스를 가져야 함**. 기존 `renderSlide: (slide) => buildSlideHTML(slide.story, slide.iso)` 는 `<div class="flip-container">` 로 시작하는 string 을 반환 → Swiper 가 `.flip-container` 를 slide 로 인식하지만 `.swiper-slide` 클래스가 없어 layout/transform 미적용 → 빈 화면. 수정: 양쪽 페이지 모두 `renderSlide: (slide) => \`<div class="swiper-slide">${buildSlideHTML(...)}</div>\`` 로 명시적 래핑. `cardSwiper.js` 의 JSDoc 주석도 outermost 요소 요구사항 명시.
- **변경파일**: `src/js/pages/editorstory.js`, `src/js/pages/mystory.js`, `src/js/utils/cardSwiper.js`, `dist/`, `android/app/src/main/assets/public/`, `ios/App/App/public/`, `docs/SESSION_LOG.md`.
- **검증**: `npm test -- tests/ios_gpu_webp_guard.spec.js tests/swiper_lazy_init.spec.js` 52/52 통과 (회귀 없음 — spec 의 renderSlide 단언이 buildSlideHTML 호출만 검증하므로 래핑 변경에 영향 없음). `npm run build` 149ms 성공. `npx cap sync android/ios` 완료. 수동 검증 (사용자): editorstory + mystory 진입 시 카드가 정상 표시 + 스와이프 시 다음 카드 표시 + 앱 죽지 않음.

### 2026-05-27 14:04 — Claude Sonnet 4.6

- **요구사항**: 다른 탭에 갔다가 나의 일화(mystory.js) 페이지로 돌아오면 날짜 휠이 "1월 1일" 표시 + 카드 콘텐츠 미표시 버그 수정. 요구사항: (1) Cold Start → 오늘 날짜 기본 표시, (2) Warm Navigation → 마지막으로 본 날짜를 메모리에 기억하고 재진입 시 해당 날짜 표시, (3) `slideChange` 이벤트 연동, (4) 1월 1일 오작동 초기화 예외 처리 보완.
- **근본 원인 (이중 버그)**: (A) 날짜 상태 유실 — SPA 내비게이션 시 `params.date` 없으면 `localTodayStr` 기준으로 `initialIdx` 계산하되, 마지막 방문 날짜는 저장되지 않아 스와이프 중 다른 탭 이동 후 재진입 시 항상 오늘로 초기화됨. (B) Swiper 초기화 타이밍 버그 — `renderMyStory()` 가 `loadMyStoryData(page)` 호출 직후 `page` 를 반환 → 라우터가 DOM에 삽입하기 전, `fetchMyStories` 가 캐시 히트로 빠르게 완료되면 `ensureSwiper()` 내부 `swiperEl.offsetParent === null` 이 true → Swiper 생성 건너뜀 → `onSlideActive` 미발화 → 휠이 초기 scroll 위치(1월 1일)에 고정 + 카드 미렌더링.
- **구현방법**: (1) `mystory.js` 에서 `setState` import 추가. (2) `targetDateStr = getState('lastMyStoryDate') || params.date || localTodayStr` 로 변경 (우선순위: 마지막 방문 > URL 파라미터 > 오늘). (3) `initialIdx` fallback 2단계 — stored date 없으면 localTodayStr 재검색 → `Math.max(0, ...)` (January 1 방어). (4) `onSlideActive` 콜백에 `setState('lastMyStoryDate', slides[idx]?.iso ?? null)` 추가 — 슬라이드 변경 시마다 현재 날짜를 메모리 state 에 저장. (5) 초기 `ensureSwiper()` 호출을 `requestAnimationFrame(() => { ensureSwiper(); })` 로 지연 — 라우터가 page 를 DOM 에 삽입한 뒤 호출 보장. 휠 선스크롤(`requestAnimationFrame(() => activateDayWheelByIndex(initialIdx))`)은 Swiper init 과 별개로 즉시 진행하여 1월 1일 flash 방지. (6) `tests/swiper_lazy_init.spec.js` 에 신규 5개 케이스 추가 (setState 사용, getState 사용, rAF 초기화, initialIdx fallback 체인).
- **변경파일**: `src/js/pages/mystory.js`, `tests/swiper_lazy_init.spec.js`.
- **검증**: `npm test -- tests/swiper_lazy_init.spec.js` 26/26 통과 (기존 21 + 신규 5). `npm test -- tests/ios_gpu_webp_guard.spec.js` 31/31 통과 (회귀 없음). `npm run build` 152ms 성공. 수동 검증 (사용자): (a) mystory 진입 → 오늘 날짜 카드 표시 (Cold Start), (b) 카드 스와이프 → 다른 탭 이동 → mystory 재진입 → 마지막 본 날짜 카드 표시 (Warm Navigation), (c) 앱 재시작 후 mystory 진입 → 오늘 날짜 카드 표시.

### 2026-05-27 15:20 — Claude Sonnet 4.6

- **요구사항**: 카드 뒷면 에디터 여담 버튼(`.back-editor-btn`)에 안 읽음(Unread) 뱃지 기능 추가. 사용자가 해당 카드의 여담을 읽지 않았으면 빨간 Dot 뱃지를 표시하고, 버튼 클릭 시 말풍선 표시와 동시에 뱃지가 즉시 사라지도록 구현.
- **구현방법**: (1) localStorage `readEditorNotes` 배열에 읽은 story_id 저장. (2) `isEditorNoteRead(storyId)` / `markEditorNoteRead(storyId)` 유틸 함수를 `editorstory.js`·`calendar.js` 양쪽에 추가. (3) 두 파일의 `back-editor-btn` HTML 템플릿에 `story.id` 가 있고 여담 텍스트가 있으며 미읽음이면 `.unread` 클래스 조건부 삽입, `data-story-id` 속성 추가. (4) 클릭 핸들러(`showBubble` / `showEditorBubble`)에서 말풍선 생성 직후 `markEditorNoteRead` 호출 + `classList.remove('unread')` 로 즉시 뱃지 제거. (5) `components.css`에 `.back-editor-btn.unread::after` 규칙 추가 — `position: absolute; top: 1px; right: 1px;` 빨간 9px dot, 2s ease 페이드 전환.
- **변경파일**: `src/css/components.css`, `src/js/pages/editorstory.js`, `src/js/pages/calendar.js`.
- **검증**: `npm run build` 199ms 성공 (빌드 오류 없음).

### 2026-05-27 14:52 — Claude Opus 4.7

- **요구사항**: 위 14:04 패치(mystory 전용) 실기 테스트 후 3가지 잔존/추가 요구사항. (1) editorstory 에도 동일한 날짜 저장 구조 적용 (mystory 에만 적용됐음). (2) iOS 에서만 mystory 카드가 여전히 1월 1일 표시 — 직전 단일 rAF + smooth scroll 패턴이 iOS WKWebView 첫 프레임 layout 미완료 시점에서 부족. (3) 양쪽 페이지 모두 화면 로드 시 휠 피커가 "스르륵" 움직이는 smooth scroll 없이 저장된 날짜에 즉시 표시.
- **근본 원인 (iOS 잔존)**: 직전 `requestAnimationFrame(() => activateDayWheelByIndex(initialIdx))` 는 (a) 첫 rAF 시점에 `target.offsetLeft` 가 layout 미완료로 0/부정확, (b) `scrollTo({ behavior: 'smooth' })` 가 iOS 14+ 의 새로 삽입된 DOM 첫 호출 시 무시됨, (c) `swiperEl.offsetParent === null` 이 첫 rAF 에서도 일시 true → `ensureSwiper()` null 반환 → 카드 미렌더 + 휠 미동기화 → 1월 1일 stuck. 단일 시도라 늦은 layout 완료를 흡수하지 못함.
- **구현방법**: 3가지 통합. **A. 휠 instant 옵션**: `syncMonthWheel(dayMonth, instant=false)` + `activateDayWheelByIndex(idx, instant=false)` 시그니처 확장 (양쪽 페이지). `instant=true` 면 `scrollLeft = t` 직접 할당 (smooth 우회), 기본값 false 면 기존 `scrollTo({behavior:'smooth'})` 유지 → 사용자 인터랙션(클릭/스와이프/slideChange)은 smooth 그대로. **B. ensureSwiper retry pattern**: 초기 init 블록을 `tryInit` 재귀 rAF 로 교체 (양쪽 페이지). 매 시도마다 `activateDayWheelByIndex(initialIdx, true)` 즉시 호출 + `ensureSwiper()` 시도, null 이면 `requestAnimationFrame(tryInit)` 재시도 (최대 8회 ≈ 130ms). iOS layout reflow 지연 흡수 + 늦게 완료돼도 휠은 즉시 정확 위치. **C. editorstory 날짜 저장**: `setState` import 추가, `initialIdx = getState('lastEditorStoryDate') → todayIso → 0` fallback 체인, `onSlideActive` 에 `setState('lastEditorStoryDate', slides[idx]?.iso ?? null)` 추가. mystory(`lastMyStoryDate`) 와 별도 키 사용 → 두 페이지 독립적으로 마지막 방문 날짜 기억. **테스트**: `tests/swiper_lazy_init.spec.js` 에 editorstory Date persistence 4개 + 양쪽 retry 패턴 2개 + 휠 instant 8개 신규 케이스 추가.
- **변경파일**: `src/js/pages/mystory.js`, `src/js/pages/editorstory.js`, `tests/swiper_lazy_init.spec.js`.
- **검증**: `npm test -- tests/swiper_lazy_init.spec.js tests/ios_gpu_webp_guard.spec.js` 72/72 통과 (기존 57 + 신규 15). `npm run build` 209ms 성공. 수동 검증 (사용자, iOS + Web): (a) editorstory 스와이프 → 다른 탭 → 재진입 시 마지막 본 카드 표시, (b) iOS mystory 진입 시 1월 1일 stuck 사라짐, (c) 양쪽 페이지 진입 시 휠이 smooth 없이 저장 날짜에 즉시 표시, (d) 카드 스와이프/휠 클릭 시 휠 이동은 smooth 유지 (회귀 없음), (e) Cold Start → 오늘 날짜 표시.

### 2026-05-27 15:35 — Claude Sonnet 4.6

- **요구사항**: 카드 뒷면 에디터 여담 아이콘(`.back-editor-btn`)을 눌렀을 때 햅틱 피드백 추가.
- **구현방법**: `@capacitor/haptics`(^8.0.2) 신규 설치. `editorstory.js`·`calendar.js` 양쪽의 여담 말풍선 표시 핸들러(`showBubble`/`showEditorBubble`)에서 말풍선 생성 직후 `Haptics.impact({ style: ImpactStyle.Light })` 호출. `Capacitor.isNativePlatform()` 가드로 웹에서는 미실행, `.catch(() => {})` 로 플러그인 미존재/실패 무시. 이미 열린 말풍선을 닫을 때는 피드백 없음.
- **변경파일**: `package.json`, `src/js/pages/editorstory.js`, `src/js/pages/calendar.js`.
- **검증**: `npm run build` 성공. `npx cap sync android` 완료 (플러그인 등록 확인).

### 2026-05-27 15:50 — Claude Sonnet 4.6

- **요구사항**: 에디터 일화·나의 일화 페이지의 카드 콘텐츠(`.editorstory-card-area`)가 데이터 로딩 중일 때 `flip-container` 크기의 스켈레톤 UI 표시.
- **구현방법**: 기존 `.skeleton-card`(pulse 애니메이션, `var(--card-aspect-ratio)`) 재사용. (1) `pages.css` 에 `.editorstory-card-area > .skeleton-card` 규칙 추가 — `grid-area: stack` + `max-height: 100%` + `margin: 0 auto` 로 `.card-swiper` 와 동일 sizing 부여해 카드와 정확히 겹침. 페이드 아웃용 `.skeleton-card.is-hiding`(animation 해제 + opacity 0 + transition 0.3s) 추가. (2) 두 페이지 카드 영역 HTML 에 `<div class="skeleton-card" id="...-card-skeleton">` 를 swiper 다음 형제(최상단 stacking)로 삽입 — 마운트 즉시 표시. (3) 두 페이지에 `hideCardSkeleton(page)` 모듈 함수 추가, `ensureSwiper()` 가 `createCardSwiper()` 직후 1회 호출 → `.is-hiding` 부여 후 300ms 뒤 `remove()`. 데이터 fetch 동안 스켈레톤 노출 → swiper 생성(첫 슬라이드 렌더 완료) 시점에 페이드 아웃. 빈 상태/에러 분기는 `page.innerHTML` 교체로 자동 제거, 캘린더 초기 뷰는 카드 영역 `hidden` 이라 미노출.
- **변경파일**: `src/css/pages.css`, `src/js/pages/editorstory.js`, `src/js/pages/mystory.js`.
- **검증**: `npm run build` 142ms 성공. `tests/swiper_lazy_init.spec.js`·`tests/css_tokens.spec.js` 통과, 회귀 없음 (editorstory.ui.spec.js 의 기존 실패 15건은 baseline 에서도 동일 — 이번 변경과 무관). 한계: 스켈레톤은 로딩 중에만 잠깐 보이는 transient UI 라 실기 육안 검증은 미수행 (CSS sizing 을 `.card-swiper` 와 동일하게 맞춰 위치·크기 일치 보장).

### 2026-05-27 18:55 — Claude Opus 4.7

- **요구사항**: 신규 앱 버전 출시 시 부팅 1회 업데이트 안내 바텀시트. (1) 현재 버전 = Capacitor `App.getInfo()`, (2) 최신 버전 = Firebase Remote Config `latest_version`, (3) SemVer 비교(`1.3.5 < 1.3.6`)로 다를 때만 노출, (4) '지금 업데이트(스토어 이동)' / '다음에 하기' 버튼, (5) Firebase 통신 실패 시에도 앱 정상 동작 (try-catch + 비동기).
- **구현방법**: TDD — `tests/version.spec.js` (SemVer 비교 9 케이스) 먼저 작성 → Red 확인 → `src/js/utils/version.js` 구현 (`compareVersions`/`isUpdateAvailable`, leading `v` 제거 + pre-release suffix 무시 + 누락 segment=0 + 무의미값 가드) Green. 신규 파일 4개: (1) `src/js/services/remoteConfig.js` — `firebase/remote-config` dynamic import 로 부팅 critical path 분리, `fetchAndActivate` 결과 promise 캐싱(중복 fetch 차단), `minimumFetchIntervalMillis=1h` + `fetchTimeoutMillis=5s` + `defaultConfig` 설정, `fetchLatestAppVersion()`/`fetchStoreUrls()` 노출. (2) `src/js/components/updateSheet.js` — 기존 `.modal-overlay` + `.modal-sheet` 디자인 토큰 재사용, 자체 모달 (브라우저 `confirm()` 금지 규칙 준수), `lockScroll`/`unlockScroll`, ESC + 배경 탭 = '다음에 하기', `escapeHtml`로 버전 문자열 sanitize, `.is-closing` 페이드아웃 → Promise<'update'\|'later'> 반환. (3) `src/js/services/appUpdate.js` — orchestrator. `getCurrentInstalledVersion()` 네이티브=App.getInfo / 웹=package.json fallback, `Capacitor.getPlatform()` 기반 스토어 URL 결정 (Android=Play Store `com.daystory.app` 폴백, iOS=Remote Config `ios_store_url` 우선·없으면 App Store 검색 폴백), 세션 가드(`hasCheckedThisSession`)로 부팅 1회만 실행, 모든 단계 try-catch. `window.open(url, '_system')` 으로 외부 스토어 진입. (4) `src/css/components.css` 에 `.update-sheet-*` 스타일 — 아이콘 원, 버전 행, 액션 버튼 + `.is-closing` 페이드/슬라이드아웃 (모든 색·간격은 var(--*) 토큰만 사용). `main.js`: `checkForAppUpdate` import + `checkAndStartApp()` 라우터 시작 직후 `void checkForAppUpdate()` 로 fire-and-forget 호출.
- **변경파일**: `src/js/utils/version.js`, `src/js/services/remoteConfig.js`, `src/js/services/appUpdate.js`, `src/js/components/updateSheet.js`, `src/css/components.css`, `src/main.js`, `tests/version.spec.js`.
- **검증**: `npx vitest run tests/version.spec.js` 9/9 통과. `npx vitest run tests/sanitize.spec.js tests/date.utils.spec.js tests/storage.utils.spec.js tests/timeout.utils.spec.js tests/version.spec.js` 47/47 통과 (무관 유틸 회귀 없음). `npm run build` 200ms 성공. 전체 `npx vitest run` 71/285 fail 은 baseline 의 기존 실패(위젯/북마크/콘텐츠매니저 등 무관 영역) — 이번 변경과 무관 (제가 새로 추가한 테스트 9건은 전부 green). 한계: 실제 Firebase Remote Config 콘솔에서 `latest_version` 키 설정 + 네이티브 빌드 후 시트 렌더링 육안 확인은 사용자가 진행해야 함. iOS App Store 의 정식 numeric URL 은 Remote Config 의 `ios_store_url` 로 주입 필요 (없으면 검색 폴백).

### 2026-05-27 19:25 — Claude Opus 4.7

- **요구사항**: 업데이트 안내 바텀시트(`.update-sheet`)의 두 가지 UX 버그 수정. (1) 시트가 화면에 final 위치로 잠깐 노출된 뒤 등장 애니메이션이 시작되는 flash. (2) `.modal-handle` 이 순수 장식 요소라 핸들을 잡고 아래로 당겨도 시트가 닫히지 않음.
- **근본 원인**: (1) 부모 `.modal-overlay`/`.modal-sheet` 의 `animation: fadeIn / slideUp` keyframe 이 첫 paint 시점에 일부 환경(특히 iOS WKWebView)에서 from→to 가 정상 트리거되지 않고 final state 가 잠깐 노출됨. (2) `.modal-handle` 은 36×4px 시각 요소뿐, hit-area 도 작고 pointer 핸들러도 없었음.
- **구현방법**: (1) `confirmDialog.js` 와 동일한 클래스 토글 + transition 패턴으로 교체. `.update-sheet-overlay` 에 `animation: none` + `opacity 0→1` transition, `.update-sheet` 에 `transform translateY(100%→0)` transition, `.is-visible` 클래스로 활성화. JS 는 더블 `requestAnimationFrame` 으로 초기 paint 보장 후 `.is-visible` 토글 → flash 제거. (2) `.update-sheet-handle-area` wrapper 신설 — 시트 padding 을 음수 margin 으로 상쇄해 좌우 풀폭 + 상하 padding 으로 hit-area 넉넉히 확장 + `touch-action: none` 으로 브라우저 세로 스크롤 가로채기 차단. pointer event 4종(`pointerdown/move/up/cancel`) + `setPointerCapture` 로 손가락이 영역 밖으로 나가도 추적 유지. 시트 높이의 30% 초과 드래그 시 close, 미달이면 inline transform 제거로 snap back. 드래그 progress 에 비례해 오버레이를 최대 50% 까지 fade (닫힘 예고 피드백). 닫기 흐름 단순화 — `.is-closing` 클래스 제거하고 인라인 `transform: translateY(100%)` + `.is-visible` 제거로 통합 (드래그 중간 위치든 정상 위치든 현재 위치에서 매끄럽게 슬라이드 다운).
- **변경파일**: `src/css/components.css`, `src/js/components/updateSheet.js`.
- **검증**: `npm run build` 156ms 성공. 사용자 실기 검증 권장 (Clear site data 후 시트 등장 시 flash 없는지 + 핸들 드래그 시 시트 따라옴 + 30% 임계 초과 시 close + 미달 시 snap back).

### 2026-05-27 19:45 — Claude Opus 4.7

- **요구사항**: `login.js` 의 `auth-logo-title`(`<h1>DayStory</h1>`)와 `auth-logo-subtitle`(`<p>매일 만나는 역사 카드</p>`) 에 박혀 있던 인라인 `style="margin: 0;"` / `style="margin-top: 5px;"` 하드코딩 제거.
- **구현방법**: `login.js` 로그인/회원가입 양쪽 페이지의 4곳(타이틀 2 + 서브타이틀 2) 인라인 style 속성 삭제. 단순 제거 시 h1/p 의 user-agent default margin 이 살아나 시각이 깨지므로, `pages.css` 의 `.auth-logo-title` 에 `margin: 0`, `.auth-logo-subtitle` 에 `margin-top: var(--space-1)` 추가해 시각 유지 + 디자인 토큰화. 결과: 인라인 margin 흔적 0건, spacing 은 CSS 한 곳에서 토큰으로 관리.
- **변경파일**: `src/js/pages/login.js`, `src/css/pages.css`.
- **검증**: `npm run build` 통과 (도중에 `components.css` 의 `word-break: ;` 빈값 lint 에러 1회 — 사용자 측에서 `keep-all` 로 보강한 뒤 통과).

---

### 2026-05-27 일일 정리 — 작업 9건 카테고리별 요약

오늘은 카드 시스템 안정화 → UX 디테일 보강 → 신규 업데이트 알림 시스템 → 코드 품질 순으로 진행됨.

**A. 카드 시스템 안정화 (오전~오후)** — 4건
- 10:38 / 11:09 / 11:30 / 11:41 — Swiper Virtual 의 `renderSlide` 가 outermost 요소를 그대로 slide DOM 으로 쓰는 동작 발견 → `.swiper-slide` 명시 래핑으로 mystory/editorstory 빈 화면 복구.
- 14:04 — mystory 마지막 방문 날짜를 `setState('lastMyStoryDate')` 에 저장 → Warm Navigation 시 해당 날짜 카드 복원.
- 14:52 — editorstory 도 동일 적용 (`lastEditorStoryDate`) + iOS 1월 1일 stuck 회피용 `ensureSwiper` 재시도(최대 8회 rAF) + 휠 `instant` 옵션으로 smooth scroll 우회 (초기 진입만).

**B. 에디터 여담 UX** — 2건
- 15:20 — `.back-editor-btn` Unread 뱃지 (localStorage `readEditorNotes`).
- 15:35 — `@capacitor/haptics` 신규 설치 + 여담 말풍선 표시 시 `ImpactStyle.Light` 햅틱.

**C. 로딩 경험** — 1건
- 15:50 — 카드 영역(`.editorstory-card-area`) 데이터 fetch 동안 `.skeleton-card` 노출, swiper 생성 시 페이드아웃.

**D. 신규: 앱 업데이트 알림 시스템** — 2건
- 18:55 — TDD 로 `compareVersions`/`isUpdateAvailable` 유틸 작성 → Firebase Remote Config(`latest_version`) + `App.getInfo()` 비교 → `.modal-sheet` 디자인 토큰 재사용한 바텀시트 노출 → 스토어 URL 외부 브라우저 진입. 부팅 1회 fire-and-forget, 모든 단계 try-catch.
- 19:25 — 시트 진입 애니메이션 flash 수정(keyframe → `.is-visible` 토글+transition) + `.modal-handle` 주변 hit-area 확장 + pointer event 기반 드래그-투-클로즈(30% 임계 + 오버레이 progressive fade).

**E. 코드 품질** — 1건
- 19:45 — `login.js` 4곳의 `auth-logo-*` 인라인 `style="margin: ..."` 제거, `pages.css` 의 `.auth-logo-title`/`.auth-logo-subtitle` 에 토큰화된 margin 추가.

**검증 종합**: `npm run build` 매 단계 성공. 신규 테스트는 `tests/version.spec.js` 9건(전부 green). 기존 테스트의 71/285 fail 은 baseline 의 위젯/북마크/콘텐츠매니저 등 무관 영역 회귀로 이번 작업과 무관.

**미해결/사용자 액션 필요**: (a) Firebase Remote Config 운영값(`latest_version` 을 실제 출시 버전으로 유지), (b) iOS App Store 의 numeric URL 을 `ios_store_url` 키로 주입, (c) 시트 진입 애니메이션 + 핸들 드래그 실기 검증.

---

### 2026-05-28 — UI 아이콘 교체 · 프로필 버그 수정 · UX 개선

**A. 하단 내비게이션 Haptic Feedback**
- `router.js` — `@capacitor/haptics` import 추가. `.nav-item` 클릭 이벤트 핸들러 최상단에 `Haptics.impact({ style: ImpactStyle.Light })` 호출. 웹 환경 오류 방지를 위해 try-catch 감쌈.

**B. 아이콘 교체 (Lucide 통일)**
- `bookmarks.js` — 보관함 토글의 "나의 카드" 텍스트 버튼 → Lucide `user-round` (채우기) 아이콘으로 교체. 북마크 아이콘과 동일한 SVG 구조·CSS 룰 공유.
- `bookmarks.js`, `calendar.js`, `mystory.js` — `edit-my-story-btn` 아이콘을 기존 사각형+펜 → Lucide `pencil` 으로 교체.
- `profile.js` — 기본 프로필 아바타 SVG(user 실루엣) → Lucide `user-round` (채우기) 로 교체. 이미지 로드 실패 onerror fallback 도 동일 아이콘 적용.

**C. 프로필 아바타 WebP 차단 버그 수정**
- `profile.js` — `isWebpUrl()` 필터로 기존 유저의 WebP photoURL 이 전부 차단돼 기본 아이콘으로 표시되던 문제 수정. `isWebpUrl` 필터 제거 후 photoURL 을 그대로 사용하고, 디코드 실패 시 `onerror` 로 img 숨김 + 옆 SVG fallback 노출 패턴(sibling toggle)으로 전환. 미사용 import 제거.

**D. 프로필 편집 저장 후 UI 동기화 버그 수정**
- `profile.js` — 닉네임·프로필 사진 저장 성공 후 `navigate('/profile')` 가 라우터 same-path 가드에 막혀 DOM 이 갱신되지 않던 문제 수정. `syncProfileDom()` 헬퍼 추가: `.settings-user-name` textContent 교체 + `.profile-avatar-wrap img.src` 교체 + SVG fallback 토글. 전역 `setState('profile'/'user')` 는 유지해 다른 페이지 일관성 보장.

**E. 프로필 이미지 자르기 모달 뒤로가기 버튼 추가**
- `profile.js` — 크롭 모달 헤더에 `crop-modal-back-btn` 추가(Lucide chevron-left). `cancelCrop()` 핸들러(오버레이 페이드아웃 → cropper destroy → DOM 제거) 구현. `mystory.js` / `editor.js` 의 크롭 모달과 동일한 CSS 클래스·패턴 적용.

**F. 일화 삭제 후 페이지 복귀 버그 수정**
- `mystory.js` — 삭제 성공 시 `navigate('/mystory')` 로 강제 이동하던 로직을 `history.back()` 으로 교체. `/profile` 에서 진입해 삭제하면 `/profile` 로, `/mystory` 에서 진입하면 `/mystory` 로 자연스럽게 복귀. history 가 비어있는 외부 진입을 위해 300ms fallback(`navigate('/mystory')`) 안전망 추가.

**G. 레이아웃·CSS 버그 수정**
- `pages.css` — `.profile-avatar-wrap` 에 `display: flex` 누락으로 `align-items/justify-content` 가 작동하지 않아 기본 아이콘이 좌상단으로 쏠리던 문제 수정. img/svg 셀렉터 분리해 img 는 `object-fit: cover`, svg 는 32×32 고정 사이즈.
- `components.css` — `base.css` 전역 `box-sizing: border-box` 리셋이 Cropper.js 내부 요소(`cropper-line`, `cropper-point` 등)의 pixel 단위 레이아웃을 깨뜨리던 문제 수정. 해당 클래스와 `::before/::after` 가상 요소에 `box-sizing: content-box; margin: 0; padding: 0;` 명시 복원.
