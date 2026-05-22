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
