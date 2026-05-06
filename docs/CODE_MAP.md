# CODE_MAP — 폴더별 기능 · 함수 카탈로그 · 데이터 흐름

> 이 문서는 **개발자가 grep 대신 빠르게 훑어보는 함수 카탈로그**다.
> 설계 철학과 레이어링 규칙은 [ARCHITECTURE.md](ARCHITECTURE.md), 의사결정 배경은 [ADR.md](ADR.md), 제품 요구사항은 [PRD.md](PRD.md), UI 토큰은 [UI_GUIDE.md](UI_GUIDE.md)에 있다. 이 파일은 그 위에서 "어디에 무슨 함수가 있고 어떤 데이터가 어디로 흐르는가"만 다룬다.

---

## 1. 진입점

```
index.html
  ↓ <script type="module" src="/src/main.js">
src/main.js
  ↓ initRouter() + registerRoute(path, handler) × 13
  ↓ subscribe('user', ...) — 인증 상태 감지 → 라우트 가드
src/js/router.js   ← 해시 기반 SPA 라우터
  ↓ 현재 hash → handler() → 페이지 모듈
src/js/pages/*     ← 페이지 모듈 (renderXxx 함수 export)
  ↓ services 호출
src/js/services/*  ← Firestore / Storage / Capacitor 추상화
```

핵심 규약(자세한 내용 [CLAUDE.md](../CLAUDE.md)):
- 페이지에서 Firebase SDK를 직접 호출하지 않는다 → `services/*`만 사용
- 사용자 입력은 [`utils/sanitize.js`](../src/js/utils/sanitize.js)의 `escapeHtml()` 통과
- 페이지가 등록한 리스너는 `router.setOnUnmount(fn)`으로 정리
- 확인/삭제 모달은 브라우저 `confirm()`이 아니라 [`components/confirmDialog.js`](../src/js/components/confirmDialog.js)

---

## 2. 폴더 가이드

### 2.1 [src/js/pages/](../src/js/pages/) — 13개 페이지

| 라우트 | 파일 | 한 줄 설명 | 주요 의존성 |
|---|---|---|---|
| `/editorstory` | editorstory.js | 홈: 오늘의 역사 카드 + 주간 휠 캘린더 + 카드 플립 | services/stories, bookmarks, widget |
| `/calendar` | calendar.js | 월 단위 그리드 (역사 ↔ 나의 일화 토글) | services/stories, mystories, bookmarks |
| `/mystory` | mystory.js | 내 일기 카드 보기 (휠 피커 동일 UX) | services/mystories, widget |
| `/mystory/new` | mystory.js | 내 일기 작성/수정 폼 (이미지 4:5 크롭 + 회전 + 자동 업로드) | services/mystories, firebase storage, cropperjs |
| `/detail/:id` | detail.js | 역사 일화 상세 (이미지 · 본문 · 참고자료 · 에디터 한마디) | services/stories, bookmarks |
| `/bookmarks` | bookmarks.js | 북마크 격자 + 검색 필터 | services/bookmarks |
| `/search` | search.js | 키워드 검색 (300ms 디바운스) | services/stories |
| `/profile` | profile.js | 프로필 + 설정 진입점 (닉네임 1:1 크롭) | components/settingsSections |
| `/settings` | settings.js | 설정 페이지 (테마 · 글꼴 · 알림 · 위젯 테마 · 튜토리얼 다시 보기) | components/settingsSections, notifications |
| `/editor` | editor.js | **관리자 전용** 콘텐츠 목록 (필터/편집/삭제) | services/stories |
| `/editor/new` | editor.js | **관리자 전용** 카드 작성/수정 폼 (실시간 미리보기) | services/stories, cropperjs |
| `/license` | license.js | 이미지 라이선스 출처 페이지 | services/stories |
| `/donate` | donate.js | 후원 페이지 (UI placeholder, IAP 미연동) | components/toast |
| `/report` | report.js | 오류 신고 페이지 | components/toast |
| `/login` `/signup` | login.js | 이메일/Google 로그인 + 회원가입 | firebase auth |

**Export**:
- 페이지마다 `renderXxx()` 함수 한두 개 export. handler는 `HTMLElement`를 반환.
- 예외: `editor.js`는 `renderEditor()`(목록) + `renderEditorNew()`(폼), `mystory.js`는 `renderMyStory()` + `renderMyStoryNew()`, `login.js`는 `renderLogin()` + `renderSignup()`.

---

### 2.2 [src/js/components/](../src/js/components/) — 6개 재사용 UI

| 파일 | 역할 | Export |
|---|---|---|
| confirmDialog.js | 자체 확인/취소 모달 (브라우저 `confirm()` 대체) | `showConfirm({title, message, confirmText, cancelText, danger}) → Promise<boolean>` |
| toast.js | 하단 토스트 알림 (2.5초 자동 사라짐) | `showToast(message, type='info', duration=2500)` |
| settingsSections.js | 프로필/설정 페이지에서 공유하는 섹션 마크업 + 바인딩 | `renderSettingsSections()` (HTML 문자열), `bindSettingsSections(page)` |
| notificationSettingsSheet.js | 알림 시간 설정 시트 + 위젯 테마 설정 시트 | `renderNotificationSettingsSection()`, `bindNotificationSettingsSection(page)`, `openNotificationSettingsSheet(onChange)`, `openWidgetThemeSettingsSheet(onChange)` |
| widgetThemePreview.js | 위젯 테마 옵션 한 칸의 HTML 생성 | `renderWidgetThemeOption(theme, currentTheme) → string` |
| tutorialTour.js | 첫 진입 가이드 + "튜토리얼 다시 보기" 투어 (각 화면의 주요 영역 포커싱 → 다음 버튼) | `TUTORIAL_TOUR_STEPS`, `startTutorialTour(navigate)`, `renderTutorialTourForRoute(path, navigate)`, `endTutorialTour()` |

> **참고**: 빈 파일이었던 `editorComment.js`는 2026-05 청소 작업에서 삭제됨 (어떤 페이지도 import하지 않았음).

---

### 2.3 [src/js/services/](../src/js/services/) — 6개 외부 시스템 래퍼

페이지가 Firebase SDK·Capacitor 플러그인을 직접 호출하지 않도록 한 곳에 묶어둔 레이어. 게스트 폴백, 타임아웃, 캐싱 정책이 모두 여기 있다.

#### bookmarks.js — 북마크 (별표) 관리
외부: Firestore `bookmarks` 컬렉션, 게스트는 `localStorage('guest_bookmarks')`. 타임아웃 8초.

| 함수 | 역할 |
|---|---|
| `isBookmarked(storyId)` | 북마크 여부 확인 → `boolean` |
| `toggleBookmark(storyId)` | 토글 후 `{ bookmarked, error? }` 반환 |
| `getBookmarkedStoryIds()` | 북마크된 ID 배열 |
| `getBookmarkedStories()` | 2단계 조회: ID 목록 → 각 story 데이터 (최대 30개) |
| `getBookmarkCount()` | 북마크 총 개수 |

#### stories.js — 역사 일화 (읽기 + 관리자 쓰기)
외부: Firestore `stories` 컬렉션, Storage `users/{uid}/editor_images/`, demo.js 폴백. 타임아웃 5초/2.5초/3초(함수별).

| 함수 | 역할 |
|---|---|
| `autoPublishScheduled()` | 모듈 로드 시 호출. `scheduled` 상태 + `publish_date <= 오늘` 카드를 `published`로 자동 전환 |
| `fetchStories()` | published 카드 전체 (실패 시 demo 폴백) |
| `warmStoriesCache()` | 홈/캘린더 예열용 공유 캐시 promise 반환 |
| `invalidateStoriesCache()` | 관리자 생성/수정/삭제 뒤 읽기 캐시 무효화 |
| `fetchTodayStory()` | 오늘 날짜의 카드 1개 |
| `fetchStoryById(id)` | ID로 단건 |
| `searchStoriesDB(queryStr)` | 키워드 검색 (JS 측 필터링) |
| `fetchAllStoriesEditor()` | 상태 무관 전체 (관리자 목록용) |
| `createStory(story)` | 카드 생성 |
| `updateStory(id, updates)` | 카드 수정 |
| `deleteStory(id)` | 카드 삭제 (Storage 이미지도 함께) |
| `publishStory(id)` | 즉시 발행 |
| `fetchStoriesWithLicense()` | 라이선스 정보 있는 카드만 |
| `uploadImage(file)` | Storage 업로드 후 download URL 반환 |

#### images.js — 카드 이미지 업로드/썸네일
외부: Firebase Storage, Firestore `stories`/`userStories` 문서 병합 업데이트. 표시 이미지는 원본 카드용, 썸네일은 캘린더/보관함/검색 같은 작은 surface용.

| 함수 | 역할 |
|---|---|
| `uploadCardImageVariants(file, {uid, folder})` | 표시 이미지와 4:5 썸네일을 동시에 업로드하고 `{image_url, image_thumb_url}` 반환 |
| `backfillStoryThumbnailsForMonth(stories, options)` | 에디터 권한 캘린더 진입 시 현재 표시 월의 누락 썸네일만 저강도 큐로 생성 |

#### mystories.js — 사용자 일기
외부: Firestore `userStories` 컬렉션. DB 미설정 시 `console.warn('[DB Mock] ...')`로 mock 동작.

| 함수 | 역할 |
|---|---|
| `fetchMyStories(uid)` | 내 일기 전체 (`publish_date` 내림차순) |
| `fetchMyStoryById(id, uid)` | 단건 (5초 타임아웃) |
| `createMyStory(data)` | 생성 (`created_at`/`updated_at` 자동) |
| `updateMyStory(id, data)` | 수정 |
| `deleteMyStory(id)` | 삭제 (Storage 이미지도 함께) |

#### notifications.js — 푸시/로컬 알림 (Android only)
외부: Capacitor `LocalNotifications`, Web `Notification` API, `localStorage` (스케줄 캐시).

| 함수 | 역할 |
|---|---|
| `getNotificationSettings()` | `{diary: {enabled, time}, editor: {enabled, time}}` |
| `updateNotificationSetting(type, patch)` | 설정 patch 후 저장 |
| `syncNotificationSchedules(type=null)` | 네이티브/웹 알림 스케줄 다시 등록 |
| `registerNotificationActionNavigation(navigate)` | 알림 탭 시 라우트 이동 + cleanup 핸들 |

#### widget.js — Android 홈 화면 위젯
외부: Capacitor `DayStoryWidget` 플러그인 (네이티브 측 `SharedPreferences`).

| 함수 | 역할 |
|---|---|
| `todayIsoDate()` | 로컬 오늘 날짜 (`utils/date.getLocalToday()` 위임) |
| `setLetterState(hasNewLetter)` | "오늘의 편지 미열람" 빨간점 표시 |
| `setDiaryState(hasTodayDiary, diaryDate)` | 오늘 일기 작성 여부 |
| `refreshWidget()` | 위젯 강제 새로고침 |
| `setWidgetTheme(theme)` | 라이트/다크 테마 |
| `markLetterRead()` / `markLetterUnread()` | 편지 읽음/미읽음 표시 |
| `syncDiaryStateFromList(stories)` | 일기 목록 → 위젯 상태 일괄 동기화 |

---

### 2.4 [src/js/utils/](../src/js/utils/) — 순수 함수 유틸

#### date.js — 날짜 변환

| 함수 | 시그니처 | 비고 |
|---|---|---|
| `formatDateKR(date)` | `Date \| string → "2026년 4월 14일 화요일"` | |
| `formatShortDate(date)` | `→ "4. 14"` | |
| `formatMonthYear(date)` | `→ "2026년 4월"` | |
| `getMonthDay(dateStr)` | `"2026-04-14" → "4. 14"` | |
| `getDaysInMonth(year, month)` | 월 일수 (잘못된 입력 → 0) | |
| `isValidCalendarDate(year, month, day)` | 윤년 포함 검증 | |
| `toLocalDateFromIso(iso)` | `"YYYY-MM-DD" → Date \| null` | UTC 아닌 로컬 |
| `formatLocalIsoDate(date)` | `Date → "YYYY-MM-DD"` | |
| `getLocalToday()` / `getToday()` | `→ "YYYY-MM-DD"` | **로컬 시간 기준** (자정 직후 UTC 차이 보정) |
| `safeStoryDateParts(story)` | `→ {valid, year, month, day}` | bookmarks/search 카드 렌더 공통 헬퍼. invalid면 valid=false + 현재 날짜 폴백 |

#### sanitize.js — XSS 방어

| 함수 | 역할 |
|---|---|
| `escapeHtml(text)` | `& < > " '` 이스케이프 (null/undefined → 빈 문자열) |
| `sanitizeUrl(url)` | `javascript:` / `data:` 프로토콜 차단 |

> 사용자 입력을 `innerHTML`에 넣기 전 반드시 `escapeHtml()`. 새 페이지를 만들 때 `import { escapeHtml } from '../utils/sanitize.js'`를 잊지 말 것.

#### imageLoading.js — 이미지 선택/예열

| 함수/상수 | 역할 |
|---|---|
| `CARD_PLACEHOLDER_IMAGE` | 카드/캘린더/보관함 공통 placeholder data URI |
| `EDITOR_PREVIEW_PLACEHOLDER_IMAGE` | 콘텐츠 관리 미리보기 전용 placeholder data URI |
| `getStoryImageUrl(story, variant, fallback)` | `thumb`/`display` 목적에 맞는 이미지 URL 선택 |
| `preloadImage(url)` | 이미지 decode 예열 |
| `preloadStoryImages(stories, options)` | story 배열의 이미지 variant를 제한 개수만큼 예열 |

#### imageFields.js — 이미지 URL/썸네일 폼 필드 동기화

| 함수 | 역할 |
|---|---|
| `bindImageVariantFields({imageInput, thumbInput})` | 수동 URL 입력 시 stale `image_thumb_url`을 지우고, 업로드 결과 적용 시에는 두 필드를 함께 갱신 |

---

### 2.5 [src/js/router.js](../src/js/router.js), [state.js](../src/js/state.js), [firebase.js](../src/js/firebase.js), [data/demo.js](../src/js/data/demo.js)

#### router.js — 해시 기반 SPA 라우터
| 함수 | 역할 |
|---|---|
| `registerRoute(path, handler)` | 라우트 등록 (handler는 HTMLElement / HTML 문자열 반환) |
| `setBeforeNavigate(fn)` | 다음 navigate 전 한 번 호출되는 가드 |
| `setOnUnmount(fn)` | 다음 navigate 시 호출되는 정리 함수 (메모리 누수 방지) |
| `navigate(path, params={})` | 프로그래매틱 이동 |
| `getParams()` | 쿼리스트링 + 동적 세그먼트 파라미터 |
| `getCurrentPath()` | 현재 라우트 경로 |
| `initRouter()` | hashchange 리스너 등록 + 첫 렌더 |
| `forceRoute()` | 강제 재렌더 |

#### state.js — Pub/Sub 전역 상태
키: `user`, `profile`, `todayStory`, `currentStory`, `stories`, `bookmarks`, `isLoading`, `theme`, `fontSize`, `widgetTheme`. 테마/폰트/위젯 테마는 `localStorage`에 자동 영속화.
| 함수 | 역할 |
|---|---|
| `getState(key)` | 키별 값. 없으면 전체 복사본 |
| `setState(key, value)` | 값 변경 + 구독자 발행 |
| `subscribe(key, fn)` | 구독 등록 → unsubscribe 함수 반환 |
| `applyTheme()` | `data-theme` 속성을 `<html>`에 반영 (system 모드는 OS 따라감) |

#### firebase.js — Firebase 초기화 단일 진입점
Export: `{ app, auth, db, storage }`. 환경변수 미설정 시 모두 `null` → 게스트 모드 폴백.

#### data/demo.js — Firestore 폴백 더미 데이터
| 함수 | 역할 |
|---|---|
| `DEMO_STORIES` | 데모 스토리 배열 (현재 비어있음) |
| `getTodayStory()` | 오늘 날짜의 데모 스토리 |
| `getStoryById(id)` | ID로 데모 스토리 단건 |
| `searchStories(query)` | 데모 스토리 키워드 검색 |

---

### 2.6 [src/css/](../src/css/) — 4개 파일

| 파일 | 역할 |
|---|---|
| variables.css | 디자인 토큰 (색상, 간격, 그림자, z-index, 모바일 폭 430px). `[data-theme="dark"]` 블록으로 다크 토큰. **모든 색상은 여기서만** |
| base.css | 리셋, 모바일 래퍼, 스플래시, 하단 5탭, 토스트 컨테이너 |
| components.css | 재사용 UI: 버튼, 카드, 입력, 뱃지(`.badge-accent` `.badge-draft` `.badge-scheduled` `.badge-archived`), 모달, 휠 피커, 스피너 |
| pages.css | 페이지별 레이아웃 (가장 큼 ~2800줄). 클래스 prefix는 페이지 이름과 일치 (예: `.archive-*`, `.search-*`, `.editor-*`, `.mystory-*`) |

---

### 2.7 [tests/](../tests/), [scripts/](../scripts/), [docs/](../docs/), [android/](../android/)

| 폴더 | 역할 |
|---|---|
| tests/ | Vitest + jsdom UI 스펙. 파일명 패턴: `<page>.ui.spec.js` (페이지별), `regression.bugs.spec.js` (회귀), `*.utils.spec.js` (유틸), `widget.static.spec.js` (위젯 정적 검증) |
| scripts/ | `codex-harness.mjs` (Codex CLI/Claude CLI 자동 스텝 러너), `execute.py` + `test_execute.py` |
| docs/ | ARCHITECTURE / ADR / PRD / UI_GUIDE / **CODE_MAP** (이 파일) |
| android/ | Capacitor Android 래퍼. `DayStoryWidget` 네이티브 플러그인 + `app/src/main/res/...` 위젯 레이아웃 |

---

## 3. 데이터 흐름

### 3.1 인증 + 게스트 폴백

```
사용자가 앱 진입
  ↓
main.js → firebase.auth.onAuthStateChanged
  ↓
[로그인 사용자]                       [비로그인]
  ↓                                    ↓
state.setState('user', user)        state.setState('user', {id:'guest', role:'guest'})
state.setState('profile', ...)       state.setState('profile', null)
  ↓                                    ↓
router의 protected route 통과         services/* 가 'guest' id 감지
                                       → localStorage 폴백 (북마크) / Firestore 차단
```

세션 무효화: `sessionStorage(AUTH_SESSION_KEY)` 키가 명시적 로그인 시에만 set됨. 새 앱 시작 시 키 없으면 `signOut(auth)`로 강제 로그아웃 (regression.bugs.spec.js에서 검증).

### 3.2 역사 카드 읽기

```
editorstory/calendar/detail/search 페이지 진입
  ↓
services/stories.fetchStories() (또는 fetchTodayStory/fetchStoryById)
  ↓
Firebase 미설정? 또는 5초 타임아웃?
  ├─ Yes → demo.js의 DEMO_STORIES 폴백
  └─ No  → Firestore stories 컬렉션
  ↓
페이지에서 직접 DOM 렌더 (state.stories는 캐시 용도)
```

### 3.3 내 일기 작성

```
mystory/new 폼 입력
  ↓ (이미지 선택 시)
cropperjs로 4:5 크롭 + 회전
  ↓
browser-image-compression로 압축
  ↓
firebase storage uploadBytes → Storage `users/{uid}/diary/<filename>`
  ↓
getDownloadURL() → image_url
  ↓
services/mystories.createMyStory({title, body, image_url, publish_date, ...})
  ↓
Firestore userStories 컬렉션 (created_at/updated_at serverTimestamp)
  ↓
페이지가 mystories 목록 새로고침
  ↓
services/widget.syncDiaryStateFromList(stories) → 홈 화면 위젯 갱신
```

### 3.4 북마크 토글

```
detail/editorstory에서 별 아이콘 탭
  ↓
services/bookmarks.toggleBookmark(storyId) (8초 타임아웃)
  ├─ 게스트 → localStorage('guest_bookmarks') 배열 토글
  └─ 로그인 → Firestore bookmarks/{uid_storyId} 문서 add/delete
  ↓
{bookmarked, error} 반환
  ↓
페이지가 별 아이콘 채움/비움 토글, 토스트 표시
```

### 3.5 알림 스케줄링

```
설정 페이지에서 알림 시간 변경
  ↓
services/notifications.updateNotificationSetting(type, {time, enabled})
  ↓
localStorage에 저장 + state 동기화
  ↓
services/notifications.syncNotificationSchedules(type)
  ├─ Capacitor 환경 → LocalNotifications.cancel + schedule
  └─ Web 환경       → Web Notification API (실험적)
  ↓
사용자가 알림 탭
  ↓
registerNotificationActionNavigation(navigate)에서 등록한 리스너
  ↓
지정된 라우트로 이동 (/editorstory 또는 /mystory/new?date=오늘)
```

---

## 4. 관리자(에디터) 게이팅

| 위치 | 무엇을 검사하는가 |
|---|---|
| [src/main.js](../src/main.js) | `ADMIN_EMAILS` 하드코딩 목록과 `auth.currentUser.email` 비교 → `state.profile.role = 'editor'` 부여 |
| [src/js/pages/login.js](../src/js/pages/login.js) | `getAdminEmails()` 헬퍼 — 로그인/회원가입/Google 로그인 모든 경로에서 같은 allowlist 사용 (regression.bugs.spec.js에서 일치 검증) |
| [src/js/pages/editor.js](../src/js/pages/editor.js) | 페이지 렌더 시점에 `state.profile.role !== 'editor'`면 "에디터 권한이 필요합니다" 메시지 표시 |
| [src/js/components/settingsSections.js](../src/js/components/settingsSections.js) | 설정 메뉴에서 `role === 'editor'`일 때만 "콘텐츠 관리" 항목 노출 |

---

## 5. Known Issues (감사 결과 — 별도 후속 작업 필요)

| ID | 이슈 | 영향 | 권장 후속 |
|---|---|---|---|
| **A** | `/editor` 라우터 가드가 `setBeforeNavigate`에 등록되어 있지 않다. 비관리자가 직접 hash로 `/editor`를 입력하면 페이지가 렌더되며 메시지로만 차단된다. | 보안: 클라이언트 우회 가능. 단, Firestore 쓰기는 별도 보안 규칙으로 막아야 함. 현재 Firestore rules 미검증. | (1) router의 `setBeforeNavigate`에 admin 검사 추가 (2) Firestore `stories` 컬렉션 write rule을 `request.auth.token.role == 'editor'`로 잠그기 |
| **B** | 13개 페이지 중 일부(특히 `editorstory.js` 정도만 일관되게)만 `setOnUnmount`로 리스너를 정리한다. SPA 특성상 떠난 페이지의 `window`/`document` 이벤트 리스너가 누적된다. | 메모리 누수, 잘못된 핸들러 호출 (모바일 웹뷰에서 두드러짐) | 각 페이지 검토 → `window.addEventListener` / `Capacitor` 리스너 등록한 곳 전부 `setOnUnmount` 추가 |
| **C** | Firestore 타임아웃이 service별로 제각각. `stories`는 5000/2500/3000ms, `bookmarks`는 8000ms, `mystories`는 5000ms, `notifications`는 없음. | 사용자 경험 일관성 부족. 느린 네트워크에서 어떤 service는 빨리 폴백, 어떤 service는 영원히 대기. | 공통 타임아웃 헬퍼 (`utils/withTimeout.js`) 도입 후 표준화 (5000ms 권장). |
| **D** | `donate.js`는 UI placeholder. 토스트만 띄우고 IAP 연동 없음. PRD.md "Known Limitations"에 기록됨. | 후원 기능 비활성. | Google Play Billing / 외부 결제 SDK 연동 필요 |
| **E** | `editor.js` (~860줄), `mystory.js` (~940줄), `editorstory.js` (~820줄), `pages.css` (~2800줄) 큰 파일. | 가독성/병합 충돌. 사용자가 "구조 변경 금지"를 명시해서 분리는 미실행. | 후일 페이지 단위로 list/form/detail 분리 검토 |
| **F** | `editorstory.js`와 `mystory.js`에 휠 피커 초기화 로직이 거의 동일하게 중복. | DRY 위반. | `utils/wheelPicker.js`로 추출 (단, 새 utility 파일 추가는 큰 구조 변경에 해당하므로 별도 합의 필요) |

---

## 6. 새 페이지 추가 체크리스트

새 라우트를 만들 때 다음을 빠뜨리지 말 것:

- [ ] [`src/js/pages/<name>.js`](../src/js/pages/) 생성, `export function render<Name>()` 작성 (HTMLElement 반환)
- [ ] [`src/main.js`](../src/main.js)에 `registerRoute('/<path>', render<Name>)` 추가
- [ ] 사용자 입력을 `innerHTML`에 넣는다면 `import { escapeHtml } from '../utils/sanitize.js'`
- [ ] `window` / `document` / Capacitor 이벤트 리스너를 등록한다면 `import { setOnUnmount } from '../router.js'`로 정리 등록
- [ ] Firestore/Storage 직접 호출 금지 — `services/*` 경유 또는 새 service 추가
- [ ] 색상/간격은 `var(--*)` (variables.css 토큰)만. 인라인 색상 금지
- [ ] 확인/삭제 모달은 `import { showConfirm } from '../components/confirmDialog.js'`
- [ ] [`tests/<name>.ui.spec.js`](../tests/) 또는 `regression.bugs.spec.js`에 케이스 추가 (Vitest + jsdom + hoisted mocks 패턴)
- [ ] 안드로이드에 영향 (capacitor 설정/플러그인/메타) → `npx cap sync android` 한 번 실행

---

## 7. 빠른 참조 — 한 곳만 바꿔도 영향이 큰 파일

| 파일 | 바꾸면 어디에 영향 |
|---|---|
| [src/js/state.js](../src/js/state.js) | 모든 페이지 (theme/profile/user 구독) |
| [src/js/firebase.js](../src/js/firebase.js) | services/* 전부 |
| [src/js/router.js](../src/js/router.js) | 모든 페이지의 mount/unmount, navigate |
| [src/css/variables.css](../src/css/variables.css) | 모든 색상/간격 |
| [src/main.js](../src/main.js) | 라우트 등록 + ADMIN_EMAILS allowlist + 인증 초기화 |
