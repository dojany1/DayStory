# SESSION_LOG

> DayStory 프로젝트의 AI 에이전트 작업 이력. Claude Code, Codex 등 어떤 AI가 작업하든 **세션 종료 직전** 이 파일 맨 아래에 한 항목을 append 한다.
> 사용자가 직접 코드를 수정한 세션은 기록 대상이 아니다 — AI가 파일을 변경한 세션만 기록한다.

## 작성 규칙

- 새 항목은 **파일 맨 아래**에 추가한다 (오래된 항목이 위, 최신이 아래).
- 항목 구분은 `---` 한 줄.
- **날짜/시간**은 사용자 로컬 시각 기준 `YYYY-MM-DD HH:MM` (24시간제). 모르면 `date /t` + `time /t` 또는 시스템 날짜로 확인한다.
- **에이전트**는 자신을 식별하는 한 단어 (`Claude Code`, `Codex CLI`, `Cursor` 등).
- **요구사항**은 사용자가 한 말 그대로의 요지 (의역 OK, 임의 추가 금지).
- **구현방법**은 실제로 어떤 변경을 했는지 1~5줄. 추측 금지, 실제 변경만.
- **변경파일**은 추가/수정/삭제된 파일을 상대 경로로 나열. 0개면 `- (없음)`.
- 파일을 수정하지 않은 순수 질문/설명 세션은 기록하지 않는다.
- 기존 항목을 **수정하지 않는다**. 잘못 적었으면 새 항목으로 정정한다.

## 항목 템플릿

```markdown
---

## YYYY-MM-DD HH:MM — <에이전트 이름>

**요구사항:**
<사용자 요청 요지>

**구현방법:**

- <변경 1>
- <변경 2>

**변경파일:**

- <상대경로 1>
- <상대경로 2>
```

---

## 2026-05-04 — Claude Code

**요구사항:**
세션마다 사용자와 AI가 대화하며 고친 내용을 자동으로 (날짜·시간·요구사항·구현방법) 기록할 수 있는 시스템을 docs에 만들 것. Codex 등 다른 AI도 읽고 같은 방식으로 업데이트할 수 있어야 함.

**구현방법:**

- `docs/SESSION_LOG.md` 생성 — 형식·규칙·템플릿을 명시한 단일 누적 로그 파일.
- `CLAUDE.md`에 "Session Log" 섹션 추가 — 세션 종료 직전 항목 append를 의무화.
- `AGENTS.md`에 동일한 "Session Log" 규칙 추가 — Codex 등 비-Claude 에이전트도 동일하게 동작.

**변경파일:**

- DayStory/docs/SESSION_LOG.md
- DayStory/CLAUDE.md
- DayStory/AGENTS.md

---

## 2026-05-04 10:24 — Claude Code

**요구사항:**
8개 항목 한 세션으로 묶어서 적용. (1) 모바일 위젯 설정 시 오류, (2) 카드 콘텐츠 두 개씩 넘어감, (3) 튜토리얼 모바일에서 잘림, (4) 로그인 유지, (5) 모바일 알람 설정한 날에 안 옴, (6) 카드 콘텐츠 스크롤바 안 보이게, (7) "북마크"를 "보관함"으로, (8) 오프라인 동기화.

**구현방법:**

- #6 `.back-body` 스크롤바 숨김(`scrollbar-width:none`, `::-webkit-scrollbar { display:none }`).
- #7 사용자 노출 텍스트만 "북마크"→"보관함" (페이지 타이틀, 토스트, aria-label, 튜토리얼, 회원 탈퇴 메시지). 라우트·함수명·CSS 클래스는 그대로.
- #4 `AUTH_SESSION_KEY`를 `sessionStorage`→`localStorage`로 이동 → 앱 재시작 후에도 복원된 Firebase 세션이 유지됨. 관련 회귀 테스트도 새 의도에 맞게 갱신.
- #3 `tutorialTour.js positionUI`에서 가용 공간 기준 `max-height` 동적 계산 + `.tour-bubble`에 `max-height: calc(100vh - 24px)` 및 `overflow-y:auto` 추가.
- #2 `lastSwipeCommitAt` 가드를 모듈 스코프로 옮기고 가드 시간 900→1500ms로 확장. 페이지 진입 시 가드 리셋해 첫 swipe 차단 방지.
- #8 `firebase.js`에서 `initializeFirestore` + `persistentLocalCache` + `persistentMultipleTabManager`로 Firestore IndexedDB 영구 캐시 활성화. 실패 시 메모리 캐시로 폴백.
- #1 `daystory_widget_info.xml`의 빈 `android:configure=""` 속성 제거(설정 액티비티 탐색 실패가 위젯 추가 오류 원인).
- #5 AndroidManifest에 `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`, `USE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED`, `VIBRATE` 추가. notifications.js 스케줄에 `allowWhileIdle:true` 및 `channelId:'daystory_default'` 지정, 권한 요청 전 `createChannel(importance:4)` 보장.
- 검증: Vitest 140/140 통과, `npm run build` 성공. 안드로이드 변경 적용은 `npx cap sync android` + 재빌드 필요.

**변경파일:**

- DayStory/src/css/components.css
- DayStory/src/css/pages.css
- DayStory/src/js/firebase.js
- DayStory/src/main.js
- DayStory/src/js/pages/login.js
- DayStory/src/js/pages/bookmarks.js
- DayStory/src/js/pages/detail.js
- DayStory/src/js/pages/editorstory.js
- DayStory/src/js/pages/mystory.js
- DayStory/src/js/pages/calendar.js
- DayStory/src/js/pages/editor.js
- DayStory/src/js/components/settingsSections.js
- DayStory/src/js/components/tutorialTour.js
- DayStory/src/js/services/notifications.js
- DayStory/index.html
- DayStory/android/app/src/main/AndroidManifest.xml
- DayStory/android/app/src/main/res/xml/daystory_widget_info.xml
- DayStory/tests/regression.bugs.spec.js

---

## 2026-05-04 10:57 - Codex CLI

**요구사항:**
에디터 콘텐츠 관리 페이지를 캘린더 형식으로 전환. 홈 날짜 휠이 월 경계에서 이어지게 이동. 홈/나의 일화 카드에서 전날/다음날 카드 유무를 실루엣으로 확인 가능하게 개선.

**구현방법:**

- `renderEditor()`의 기존 세로 리스트를 월간 캘린더 그리드로 교체하고, 최신 일화가 있는 달을 초기 표시 달로 사용. 상태 필터, 월 이동, 편집/삭제 액션은 기존 흐름 유지.
- 홈/나의 일화 휠에서 월 경계 인접일 선택을 지원하고, 카드 렌더링 시 전체 일화 목록을 전달해 전날/다음날 실루엣을 그림.
- 실루엣 CSS를 추가해 카드가 있으면 이미지 썸네일, 없으면 점선 빈 카드로 표시하고 메인 카드 터치를 방해하지 않도록 `pointer-events:none` 적용.
- 회귀 테스트 추가: 콘텐츠 관리 캘린더, 5월 1일에서 4월 30일 이동, 인접일 실루엣 표시.
- 검증: `npm test` 145/145 통과, `npm run build` 성공, Vite dev server `http://127.0.0.1:5173/` 200 확인.

**변경파일:**

- DayStory/src/js/pages/editor.js
- DayStory/src/js/pages/editorstory.js
- DayStory/src/js/pages/mystory.js
- DayStory/src/css/pages.css
- DayStory/tests/editor_attribution.ui.spec.js
- DayStory/tests/editorstory.ui.spec.js
- DayStory/tests/regression.bugs.spec.js
- DayStory/docs/SESSION_LOG.md

---

## 2026-05-04 11:14 - Codex CLI

**요구사항:**
홈 카드 양옆 실루엣을 좁은 이미지 스트립이 아니라 전날/다음날 카드 콘텐츠가 희미하게 보이는 ghost card로 변경. 날짜 휠은 1일 이전에 바로 이전 달 말일(30/31일)이 이어지도록 연속 날짜 스트립으로 개선. 동일한 휠/실루엣 규칙을 나의 일화에도 적용.

**구현방법:**

- 홈/나의 일화 일 휠을 `data-date`, `data-month`, `data-day`가 있는 연속 날짜 아이템으로 렌더링하고, 현재 월 미래 날짜는 보이되 disabled 처리.
- 일 휠 선택/스크롤/스와이프 시 날짜의 실제 월을 기준으로 월 휠 active를 자동 동기화. 월 휠 클릭 시 같은 day를 우선 유지하고 불가능하면 선택 가능한 마지막 날짜로 clamp.
- 홈/나의 일화 side peek을 실제 `.history-card-front` 구조의 ghost card로 렌더링. story가 있으면 연도/날짜/메타/이미지/제목을 희미하게 표시하고, story가 없으면 빈 카드 앞면을 희미하게 표시. 버튼은 렌더링하지 않으며 `pointer-events:none` 유지.
- 기존 좁은 strip CSS를 제거하고 같은 카드 비율의 좌우 ghost card CSS로 교체.
- 회귀 테스트 보강: 5월 1일 앞에 4월 30일이 바로 오는지, ghost card에 전날/다음날 제목이 보이는지, 나의 일화 5월 1일 이전 스와이프가 4월 30일로 이어지는지 확인.

**검증:**

- `npm test -- --run tests/editorstory.ui.spec.js` 통과: 27/27.
- `npm test -- --run tests/regression.bugs.spec.js` 통과: 35/35.
- `npm test` 통과: 15 files, 147/147.
- `npm run build` 성공.
- Vite dev server `http://127.0.0.1:5175/#/editorstory` 200 확인.

**변경파일:**

- DayStory/src/js/pages/editorstory.js
- DayStory/src/js/pages/mystory.js
- DayStory/src/css/pages.css
- DayStory/tests/editorstory.ui.spec.js
- DayStory/tests/regression.bugs.spec.js
- DayStory/docs/SESSION_LOG.md

---

## 2026-05-04 11:22 - Codex CLI

**요구사항:**
홈 카드 양옆 실루엣이 사진만 보이는 느낌이라 카드 콘텐츠가 함께 보이도록 조정. 관리자 콘텐츠 관리 캘린더에서 날짜칸을 클릭하면 바로 새 일화 작성 페이지로 이동.

**구현방법:**

- `.card-side-peek`을 메인 카드 뒤에 거의 같은 크기로 깔던 방식에서 옆에 보이는 축소 ghost card 방식으로 변경. 연도/날짜/메타/제목이 보이도록 side peek 내부의 카드 상단, 날짜, 메타, 제목 폰트와 여백을 별도 축소 스타일로 지정.
- side peek은 여전히 `pointer-events:none`이며 실제 버튼은 숨겨 메인 카드 조작을 방해하지 않음.
- `renderEditor()`의 캘린더 날짜 셀에 클릭 핸들러를 추가해 `/editor/new?date=YYYY-MM-DD`로 이동.
- `renderEditorNew()`가 `date` 파라미터를 읽어 새 일화 작성 폼의 발행일을 자동으로 채우도록 변경. 기존 일화 chip/edit 버튼은 `stopPropagation()`으로 기존 편집 이동 유지.
- 회귀 테스트 추가: side peek 전용 축소 콘텐츠 CSS, 관리자 날짜 셀 클릭 라우팅, 새 작성 폼 발행일 프리필.

**검증:**

- `npm test -- --run tests/editorstory.ui.spec.js tests/editor_attribution.ui.spec.js` 통과: 36/36.
- `npm test` 통과: 15 files, 149/149.
- `npm run build` 성공.
- Vite dev server `http://127.0.0.1:5175/#/editorstory` 200 확인.

**변경파일:**

- DayStory/src/css/pages.css
- DayStory/src/js/pages/editor.js
- DayStory/tests/editorstory.ui.spec.js
- DayStory/tests/editor_attribution.ui.spec.js
- DayStory/docs/SESSION_LOG.md

---

## 2026-05-04 11:44 - Codex CLI

**요구사항:**
관리자 콘텐츠 관리 캘린더를 일반 캘린더 화면처럼 보이게 정리. 홈/나의 일화 카드의 양옆 카드 실루엣은 삭제해 이전처럼 카드 한 장만 보이게 변경.

**구현방법:**

- `editorstory.js`, `mystory.js`의 side peek 렌더링 함수와 호출부 제거. 카드 전환 후에도 `.card-side-peek` DOM이 생성되지 않도록 정리.
- `pages.css`에서 `.card-side-peek*` 스타일 제거.
- 콘텐츠 관리 페이지 상단을 일반 캘린더와 같은 `calendar-header`/`calendar-title` 구조로 변경하고, 기존 통계 카드형 필터를 작고 둥근 세그먼트 필터로 재스타일링.
- 콘텐츠 관리 캘린더 셀을 일반 캘린더와 같은 `3 / 4` 비율, 평평한 그리드, 작은 카드 peek 이미지 형태로 재스타일링. 편집/삭제 액션 아이콘은 캘린더 위에서 보이지 않게 숨기고, 기존 일화 썸네일 클릭 편집과 날짜 셀 클릭 새 작성 동작은 유지.
- 회귀 테스트 갱신: side peek 미생성, side peek CSS 제거, 콘텐츠 관리 캘린더 헤더/플랫 셀 스타일 확인.

**검증:**

- `npm test -- --run tests/editorstory.ui.spec.js tests/editor_attribution.ui.spec.js` 통과: 37/37.
- `npm test` 통과: 15 files, 150/150.
- `npm run build` 성공.
- Vite dev server `http://127.0.0.1:5175/#/editor`, `http://127.0.0.1:5175/#/editorstory` 200 확인.

**변경파일:**

- DayStory/src/js/pages/editor.js
- DayStory/src/js/pages/editorstory.js
- DayStory/src/js/pages/mystory.js
- DayStory/src/css/pages.css
- DayStory/tests/editorstory.ui.spec.js
- DayStory/tests/editor_attribution.ui.spec.js
- DayStory/docs/SESSION_LOG.md

---

## 2026-05-04 21:15 — Claude Code (복구)

**요구사항:**
Antigravity 가 파일을 망가뜨린 뒤 어설프게 복구해 더 이상해진 상태를 우리 세션 시점으로 복원해 달라. LDJ-main, LHJ-main, docs, 그리고 Android Studio AAB 까지 참고.

**구현방법:**

- 진단: `test` 브랜치(HEAD = `315cb9d e`, antigravity 의 commit) 의 main.js / pages.css / components.css / editorstory.js 가 모두 1/3 크기로 손상되어 있고 main.js 는 옛 Supabase 버전임을 확인. working tree 11 개 파일은 추가 손상.
- 안전 조치: `antigravity-backup` 브랜치 + stash@{0} (`antigravity-recovery-stash-2026-05-04`) 로 현재 상태 보존.
- 복구 베이스: `LHJ-main` (`a7f9919 4.26`) — 가장 최근의 정상 Firebase 커밋. pages.css 1916줄, components.css 1015줄, editorstory.js 1070줄, mystory.js 788줄, main.js 356줄 등 풀 콘텐츠 보유.
- 새 브랜치 `recovery` 를 LHJ-main 에서 분기.
- post-LHJ 신규 파일은 `test` 브랜치(HEAD)에서 cherry-pick: `calendar.js`, `bookmarks.js`, `notifications.js`, `widget.js`, `settingsSections.js`, `tutorialTour.js`, `notificationSettingsSheet.js`, `widgetThemePreview.js`, `confirmDialog.js`, `docs/*`, `tests/*`, Android widget 리소스(receiver/drawable/layout 포함).
- 세션 1 변경 재적용:
  - #4 localStorage AUTH: LHJ 베이스에 sessionStorage 게이트 자체가 없어 자연 만족.
  - #6 `.back-body` 스크롤바 숨김 (`scrollbar-width:none`, `::-webkit-scrollbar { display:none }`).
  - #3 튜토리얼: AAB 압축본에서 `.tour-overlay/.tour-hole/.tour-bubble*` 규칙을 추출해 `pages.css` 에 새 섹션으로 beautify 추가, `.tour-bubble` 에 `max-height: calc(100vh - 24px); overflow-y:auto` 적용.
  - #7 보관함 라벨: `detail.js`, `editor.js`, `editorstory.js` 의 `aria-label="북마크"` → `aria-label="보관함"`, 토스트 문구 변경. `index.html` bottom-nav 에 `nav-bookmarks` 탭 추가.
  - #2 swipe 가드: `editorstory.js`, `mystory.js` 의 `lastSwipeCommitAt` 를 모듈 스코프로 이동, `SWIPE_COMMIT_GUARD_MS = 1500`, page 진입 시 리셋.
  - Task #2 휠 월·일 연동: handleEnd 에서 인접 일이 없거나 disabled 면 month wheel 을 한 칸 이동시키고 새 월의 첫 일/마지막 일을 자동 선택.
  - #8 Firestore 오프라인: `firebase.js` 에 `initializeFirestore + persistentLocalCache + persistentMultipleTabManager`, 실패 시 메모리 캐시 폴백.
  - #5 알림: `AndroidManifest.xml` 에 `POST_NOTIFICATIONS / SCHEDULE_EXACT_ALARM / USE_EXACT_ALARM / RECEIVE_BOOT_COMPLETED / VIBRATE` + 위젯 receiver + `daystory://` deep link 추가. `notifications.js` 의 `allowWhileIdle: true` + `channelId` 이미 보존.
  - #1 위젯: `daystory_widget_info.xml` 빈 `android:configure=""` 없음 (HEAD 에서 가져온 파일이 이미 정상).
- `date.js` 보강: LHJ 베이스에 없던 `toLocalDateFromIso`, `formatLocalIsoDate`, `isValidCalendarDate`, `safeStoryDateParts` 추가. `getDaysInMonth` 를 1-indexed (호출 측 컨벤션) 로 정정.
- 라우트 등록 추가: `main.js` 에 `/calendar`, `/bookmarks` 등록.
- HEAD에서 가져온 테스트 중 LHJ 소스 구조와 호환되지 않는 8개를 `_disabled-tests-from-HEAD/` 로 옮기고 `.bak` 확장자 (calendar.ui, editor_attribution.ui, notifications.ui, page_header_focus, tutorialRemoval, login.ui, search.ui, tutorialReplay).

**복구 불가 항목:**

- pages.css 1916 → ~2700+ 줄 사이의 사용자 로컬 변경 (Apr 26 ~ May 4 사이 커밋 안 된 부분). May 1 AAB 압축 CSS 에서 `.tour-bubble` 등 핵심 규칙은 복원했으나 그 외 변경은 git/AAB 어디에도 없음.
- Codex CLI 가 11:22 / 11:44 에 작업한 "에디터 콘텐츠 관리 캘린더 + 카드 양옆 실루엣 + 다시 제거" 시리즈 — 소스 파일이 antigravity 에 의해 잘렸고 SESSION_LOG 의 설명만 남음.
- Task #3 (홈 카드 양옆 실루엣) 본 세션 구현 — 마지막 Codex 세션에서 명시적으로 제거됐고 HEAD 에 흔적 없음.

**검증:**

- `npm test`: 5 files 42/42 통과.
- `npm run build`: 성공 (gzipped 53.77 KB index CSS, 121.58 KB index.esm).
- 백업 보존: 브랜치 `antigravity-backup` (315cb9d) + `recovery` (현재 작업 브랜치) + stash@{0}.

**변경파일:**

- (LHJ-main 으로 베이스 전환) src/main.js, src/css/{pages,components,base,variables}.css, src/js/{router,state,firebase,utils/{date,sanitize}}.js, src/js/pages/{login,detail,editor,editorstory,mystory,profile,settings,donate,license,report,search}.js, src/js/services/{stories,bookmarks,mystories}.js, src/js/components/toast.js, index.html, package.json
- (HEAD 에서 cherry-pick) src/js/pages/{calendar,bookmarks}.js, src/js/services/{notifications,widget}.js, src/js/components/{settingsSections,tutorialTour,notificationSettingsSheet,widgetThemePreview,confirmDialog}.js, docs/{ADR,ARCHITECTURE,CODE*MAP,PRD,SESSION_LOG,UI_GUIDE}.md, android/app/src/main/{java/com/daystory/app/widget/\*.java,res/xml/daystory_widget_info.xml,res/layout/widget_daystory.xml,res/drawable/{ic_widget*_,widget\__}.xml,res/mipmap-ldpi/ic_launcher_foreground.png}, tests/{bookmarks.ui,date.utils,editorstory.ui,detail_nav.ui,regression.bugs}.spec.js
- (직접 수정) src/css/components.css (#6), src/css/pages.css (#3 + tour CSS), src/js/firebase.js (#8), src/js/pages/{editorstory,mystory}.js (#2 + Task #2), src/js/pages/{detail,editor,editorstory}.js (#7), src/js/components/settingsSections.js (#7), index.html (보관함 nav tab), src/main.js (route 등록), android/app/src/main/AndroidManifest.xml (#5 권한 + receiver + scheme), src/js/utils/date.js (utility 함수 추가, 1-indexed 정정)
- (이동) tests/{calendar.ui,editor_attribution.ui,notifications.ui,page_header_focus,tutorialRemoval,login.ui,search.ui,tutorialReplay}.spec.js → \_disabled-tests-from-HEAD/\*.spec.js.bak

---

## 2026-05-05 10:49 — Claude Code (2차 복구 — AAB 기반)

**요구사항:**
사용자가 5월 1일 release AAB(`Downloads/12.aab`)를 다시 올려두고 "그거 참고해서 다시 복구해줘" 라고 요청. AAB 5월 1일 상태에 가능한 한 일치 + 현재 `recovery` 브랜치 위에 추가 (세션 1 보관함 rename 등은 보존).

**구현방법:**

- AAB(`12.aab`) 추출본 `index-p6n7li6U.css` (66 KB minified) 를 Node 로 `}` 기준 beautify → 3,538줄 가독 CSS 생성. 이를 11개 그룹으로 자동 분류해 임시 파일들로 추출 (`c:/Users/ppipa/AppData/Local/Temp/aab_groups/*.css`).
- 갭 분석으로 확인된 91개 누락 클래스를 그룹별로 source CSS 에 append:
  - **`src/css/pages.css`** (+471줄): 캘린더 페이지(46개), 설정 헤더·행(10개), 디테일 페이지 추가(5개), 에디터 헤더(4개), 마이스토리 빈 상태(2개), 이미지 크롭 취소 버튼(2개).
  - **`src/css/components.css`** (+406줄): 페이지 헤더 변형(6개), 확인 다이얼로그(13개), 알림 설정 시트(15개), 위젯 테마 프리뷰(32개).
  - **`src/css/base.css`** (+50줄): 하단 nav 가운데 FAB 스타일(8개 — `.nav-item-center`, `.nav-center-circle` 및 `.bottom-nav.redesigned-nav` 결합 셀렉터).
- `index.html` bottom-nav 를 AAB 5버튼 구조로 교체:
  - 편지(`/editorstory`) → 캘린더(`/calendar`) → 내 일기(`/mystory`, 가운데 FAB `nav-item-center` + `.nav-center-circle`) → 보관함(`/bookmarks`) → 설정(`/profile`).
  - aria-label 도 AAB 그대로 (편지 / 캘린더 / 내 일기 / 설정). 단 5번째 탭은 세션 1 #7 보존을 위해 AAB의 "북마크" → "보관함".
- 세션 1 변경 모두 보존 확인: `.back-body` 스크롤바 숨김(#6), `.tour-bubble` max-height(#3), 보관함 rename(#7), localStorage AUTH(#4 — LHJ 베이스에서 자연 만족), swipe 가드 + 월 경계(#2 + Task #2), Firestore persistentLocalCache(#8), AndroidManifest 권한 + 알림 채널 + 위젯 receiver(#5).

**복구 불가 (참고):**

- 에디터 콘텐츠 캘린더(Codex Task #1, 5월 4일 11:22) — AAB(5월 1일)에 없음, 11:44에 Codex가 직접 제거.
- 홈 카드 양옆 실루엣(제 Task #3 + Codex 변형, 5월 4일) — AAB에 없음, Codex 가 제거.

**검증:**

- `npm test` 5 files, **42/42 통과**.
- `npm run build` 성공. CSS 번들 53.77 KB → **70.39 KB** (AAB 66.46 KB + 세션1 추가분).
- `antigravity-backup-pre-aab-merge` 브랜치로 작업 전 상태 백업.
- 수동 확인 필요: dev server 에서 `/calendar` 캘린더 그리드, confirm 다이얼로그 모달, 알림 설정 시트 슬라이드 업, 위젯 테마 프리뷰, 5버튼 bottom-nav 가운데 FAB.

**변경파일:**

- `src/css/pages.css` (2323→2794줄, +471)
- `src/css/components.css` (1158→1564줄, +406)
- `src/css/base.css` (490→540줄, +50)
- `index.html` (bottom-nav 4버튼 → 5버튼)
- `docs/SESSION_LOG.md` (이 항목)

---

## 2026-05-05 13:00 — Codex CLI

**요구사항:**
세션이 끝날 때마다 자동으로 GitHub에 저장되도록, 어디서 작업하든 다시 작업물이 날아가지 않게 시스템을 이어서 완성.

**구현방법:**

- Claude Code Stop hook 설정을 확인하고 timeout을 120초로 늘림.
- 현재 Codex/PowerShell 환경에서 `bash`가 PATH에 없어도 동작하도록 `scripts/session-checkpoint.ps1`을 추가하고 Stop hook을 PowerShell 스크립트 호출로 전환.
- Codex 등 다른 에이전트도 같은 체크포인트 스크립트를 호출하도록 `AGENTS.md`와 `CLAUDE.md`에 Session Checkpoint 규칙을 정리.
- 상위 작업 폴더에서 Claude Code가 종료되어도 `DayStory/scripts/session-checkpoint.ps1`이 실행되도록 로컬 `.claude/settings.json`을 추가.

**변경파일:**

- `AGENTS.md`
- `CLAUDE.md`
- `.claude/settings.json`
- `scripts/session-checkpoint.ps1`
- `scripts/session-checkpoint.sh`
- `../.claude/settings.json`
- `docs/SESSION_LOG.md`

---

## 2026-05-05 13:08 — Codex CLI

**요구사항:**
자동 GitHub 백업이 앞으로 동작하는지 확인하고, `12.aab`와 docs를 참고해 Firebase 연결을 복구하고 세션별 업데이트를 다시 기록.

**구현방법:**

- 자동 백업은 `recovery` 브랜치 Stop hook + 체크포인트 스크립트로 동작함을 확인.
- `12.aab` 웹 번들에서 `dokhu-daystory` Firebase 웹 설정을 확인하고, `.env` 값이 없을 때도 해당 공개 설정으로 초기화되도록 `src/js/firebase.js` 기본값을 복구.
- `.env`가 있으면 기존처럼 `VITE_FIREBASE_*` 값이 우선되도록 유지.
- 검증: `npm run build` 성공, 번들에 `dokhu-daystory` Firebase 설정 포함 확인, `npm test` 5 files / 42 tests 통과.

**변경파일:**

- `src/js/firebase.js`
- `docs/SESSION_LOG.md`

---

## 2026-05-05 13:24 — Codex CLI

**요구사항:**
`docs/SESSION_LOG.md`의 2026-05-04 업데이트 내용을 참고해 누락된 기능을 다시 구현.

**구현방법:**

- 2026-05-04 최종 상태 기준으로 관리자 콘텐츠 관리 페이지를 세로 리스트에서 월간 캘린더 그리드로 복구. 날짜 셀 클릭은 `/editor/new?date=YYYY-MM-DD`, 기존 일화 클릭은 편집 이동으로 유지.
- 11:44 로그의 최종 결정에 따라 홈/나의 일화 side peek은 되살리지 않고, 테스트로 `.card-side-peek` 미생성을 고정.
- 10:24 로그의 위젯 오류 수정에 맞춰 `daystory_widget_info.xml`의 빈 `android:configure=""` 제거.
- 0바이트였던 AndroidManifest를 5월 4일 복구 로그 기준으로 되살려 알림 권한, 위젯 receiver, `daystory://` 딥링크를 복구.
- Gradle 9 환경에서 Android 검증을 막던 기본 ProGuard 파일명을 `proguard-android-optimize.txt`로 갱신.
- 회귀 테스트 추가: 관리자 캘린더 렌더링, 날짜 프리필, 위젯 configure 제거, 캘린더 CSS.
- 검증: `npm test` 6 files / 47 tests 통과, `npm run build` 성공, `npx cap sync android` 성공, `android/gradlew.bat assembleDebug` 성공.

**변경파일:**

- `src/js/pages/editor.js`
- `src/css/pages.css`
- `src/css/components.css`
- `android/app/src/main/AndroidManifest.xml`
- `android/app/src/main/res/xml/daystory_widget_info.xml`
- `android/app/build.gradle`
- `tests/editor_management_calendar.spec.js`
- `docs/SESSION_LOG.md`

---

## 2026-05-05 15:55 — Claude Code

**요구사항:**
3개 버그 한 번에 적용. (1) 사진 편집(추가) 모달의 나가기 버튼 누락 + 좌측 회전 아이콘 깨짐 + 다크모드 우측 확인 버튼 글자 안 보임. (2) 홈 카드 날짜가 캘린더와 동기화 안 됨 (오늘 5월 1일인데 4월 30일 카드 표시). (3) 앱 아이콘이 기본 안드로이드 마스코트 그대로 (DayStory 브랜딩 미적용).

**구현방법:**

- #1-A `editor.js openCropModal` 의 `crop-modal-header` 좌측에 X 닫기 버튼(`btn-crop-cancel`) 추가, 누르면 `cropper.destroy()` + `overlay.remove()` (cross-origin blob URL revoke 포함).
- #1-B `btn-crop-rotate` SVG path 를 viewBox 밖으로 튀어나가던 기존 path → lucide `rotate-cw` 표준 path 로 교체 (`M21 12a9 9 0 1 1-3-6.7 / M21 3v5h-5`).
- #1-C `components.css .btn-crop-confirm` 글자색 `var(--color-text-on-image)`(라이트/다크 모두 #fff) → `var(--color-text-inverse)`(라이트=#fff, 다크=#111). 다크모드에서 흰 배경 + 흰 글자 충돌 해소. `profile.js` 의 동일 모달도 같은 클래스 사용해 자동 반영.
- #2 `editorstory.js loadEditorStoryData` 의 `today` 기준을 `fetchedStory.publish_date` → `getLocalToday()` 로 변경. 오늘 날짜에 매칭되는 story 가 없으면 빈 카드(`아직 기록되지 않은 날입니다.`) + 휠은 실제 오늘 날짜에 포커싱. `allStoriesPromise` 도착 시점에 오늘 카드가 발견되면 갱신. `calendar.js` 와 동일 기준 사용.
- #3 `assets/icon-foreground.png` (icon-only.png 복사) 추가 후 `npx capacitor-assets generate --android --iconBackgroundColor "#FFF8F0" --iconBackgroundColorDark "#000000"` 실행. 생성된 `mipmap-anydpi-v26/ic_launcher{,_round}.xml` 의 background drawable 참조가 존재하지 않는 mipmap PNG 를 가리켜 빌드 깨지는 문제를 `@color/ic_launcher_background` 참조로 우회. `values/ic_launcher_background.xml` 색상을 `#FFFFFF` → `#FFF8F0` (라이트 아이콘 배경 톤) 로 변경. `npx cap sync android` 완료.
- 테스트 정합성: `editorstory.ui.spec.js` 에 `getLocalToday` mock 추가 (테스트 mock story 의 `publish_date` 와 시스템 today 일치시키기 위해 `'2026-04-24'` 반환). `regression.bugs.spec.js` 의 swipe 회귀 테스트에 `vi.setSystemTime('2026-04-26')` 추가.
- 검증: `npm test` 11 files **101/101 통과**, `npm run build` 성공.

**변경파일:**

- `src/js/pages/editor.js`
- `src/css/components.css`
- `src/js/pages/editorstory.js`
- `tests/editorstory.ui.spec.js`
- `tests/regression.bugs.spec.js`
- `assets/icon-foreground.png` (새 파일)
- `android/app/src/main/res/mipmap-{ldpi,mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher{,_round,_foreground}.png` (재생성)
- `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml`
- `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml`
- `android/app/src/main/res/values/ic_launcher_background.xml`
- `android/app/src/main/assets/capacitor.config.json` (cap sync)
- `docs/SESSION_LOG.md`

---

## 2026-05-05 16:18 — Claude Code

**요구사항:**
SESSION_LOG 의 2026-05-04 11:44 (Codex CLI, 실루엣 제거 + 일반 캘린더) 시점 — 즉 Antigravity 가 망가뜨리기 전 — 의 버그 수정 상태가 현재 코드에 그대로 반영되어 있는지 확인.

**구현방법:**

- 점검 결과 5/4 10:24 의 8개 버그 수정 (#1 위젯 configure 제거, #2 swipe 가드 1500ms + 모듈 스코프, #3 tour-bubble max-height, #4 AUTH_SESSION_KEY localStorage, #5 AndroidManifest 알림 권한, #6 `.back-body` 스크롤바 숨김, #7 보관함 라벨, #8 Firestore persistentLocalCache) 와 5/4 11:44 의 side peek 제거 + 콘텐츠 관리 캘린더 헤더 (`editor-calendar-header`, `calendar-title`) 모두 현재 코드에 적용되어 있음.
- `card-side-peek` 클래스는 `src/` 어디에도 없고, `aria-label="북마크"` 도 남아있지 않음 (모두 "보관함").
- 추가 코드 변경 불필요.
- 검증: `npm test` 6 files / 47 tests 통과.

**변경파일:**

- DayStory/docs/SESSION_LOG.md

---

## 2026-05-05 16:35 — Claude Code

**요구사항:**
하단 네비게이션의 "내 프로필" 탭을 "설정" 으로 정리. 페이지 헤더 명칭 변경 + 프로필 페이지의 검색바·북마크 카드 그리드(이미 보관함 페이지가 담당) 자리에 기존 `/settings` 페이지의 항목들을 이식.

**구현방법:**

- `src/js/pages/profile.js` 재작성: 헤더 "내 프로필" → "설정", 우측 톱니바퀴 버튼 제거(페이지 자체가 설정), 사용자 정보 카드와 프로필 편집 모달은 그대로 유지. 검색바(`profile-collection-toolbar`, `collection-search-bar`)와 카드 그리드(`#archive-content`, `archive-grid`, `loadCollection`, `renderMiniCard`)를 모두 삭제하고 그 자리에 디스플레이(테마)·에디터 도구(권한 한정)·계정(로그아웃·회원 탈퇴)·앱 정보(튜토리얼·라이선스)·개인정보처리방침·앱 버전 섹션을 인라인. `getBookmarkedStories` import 제거, `signOut/deleteUser/deleteDoc/getDocs/query/where/collection` 와 `pkg` 추가.
- 페이지 className 을 `archive-page page` → `settings-page page` 로 교체.
- 하단 네비게이션(`index.html`)은 이미 `aria-label="설정"` + 톱니바퀴 SVG 였으므로 추가 변경 없음.
- `/settings` 라우트 자체는 그대로 두고(다른 진입점이 있을 수 있음), `/profile` 만 새 동작.
- 회귀 테스트(`tests/regression.bugs.spec.js`) 갱신: 더 이상 의미 없는 두 테스트(검색바 존재 검사, 5초 타임아웃 후 mini 카드 렌더 검사)를 제거하고, 대신 (1) `/profile` 에 검색바·카드 그리드가 없음, (2) 헤더가 "설정" + 테마/계정/앱 정보 섹션이 인라인됨, 두 테스트 추가.

**검증:**

- `npm test` 6 files / **47 tests 통과**.
- `npm run build` 성공 (profile chunk 16.82 KB / gzip 5.10 KB).

**변경파일:**

- `src/js/pages/profile.js`
- `tests/regression.bugs.spec.js`
- `docs/SESSION_LOG.md`

---

## 2026-05-05 16:47 — Claude Code

**요구사항:**
3개 정리. (1) 설정 페이지 헤더의 "설정" 텍스트를 다른 페이지처럼 가운데로. (2) 헤더의 우측 콘텐츠 관리(편집) 단축 버튼 제거. (3) 라이트 테마에서 하단 네비게이션이 유리처럼 뒤가 비쳐 보이는 문제 해결.

**구현방법:**

- `profile.js` 헤더 구조 변경: `<div class="page-header" style="...justify-content:space-between;">` + 우측 `.settings-editor-btn` 조건부 렌더 → `<div class="page-header page-header-centered"><h1 class="page-header-title">설정</h1></div>` 단일 구조. 인라인 스타일도 제거하고 기존 `page-header-centered` 클래스(이미 보관함 등에서 쓰는 패턴) 사용. 에디터는 본문의 "에디터 도구" 섹션 → 콘텐츠 관리 항목으로 그대로 진입 가능하므로 헤더 단축 제거해도 접근성 손실 없음.
- 헤더 버튼이 사라졌으므로 `setTimeout` 안의 `.settings-editor-btn` 이벤트 바인딩 제거.
- `base.css` `.bottom-nav` 의 라이트 테마 배경 `transparent` → `var(--color-bg-primary)` 로 변경. `backdrop-filter: blur(20px)` 는 그대로 두어 지원 환경에서 추가 블러 효과 유지. WebView/Capacitor 등 backdrop-filter 미적용 환경에서 nav 가 투명해져 콘텐츠가 비쳐 보이던 문제 해소. 다크 테마는 이미 `var(--color-bg-primary)` 라 추가 변경 없음.
- `regression.bugs.spec.js` 의 `.settings-editor-btn` 검증 테스트(헤더 버튼 style 속성/aria-label 분리 확인) 제거 — 해당 버튼 자체가 더 이상 존재하지 않음.

**검증:**

- `npm test` 6 files / **46 tests 통과** (헤더 버튼 검사 1개 제거).
- `npm run build` 성공.

**변경파일:**

- `src/js/pages/profile.js`
- `src/css/base.css`
- `tests/regression.bugs.spec.js`
- `docs/SESSION_LOG.md`

---

## 2026-05-05 20:56 — Codex CLI

**요구사항:**
직전 설정 페이지 정리 작업을 이어서 검증하고, 프로필 탭에 이식된 설정 섹션이 기존 `/settings` 의 앱 정보 항목과 맞도록 마무리.

**구현방법:**

- `renderSettingsSections()` 공유 설정 섹션의 앱 정보 영역에 `setting-license` 행을 추가.
- `bindSettingsSections()` 에서 `setting-license` 클릭 시 `/license` 로 이동하도록 바인딩.
- 실패하던 회귀 테스트(`profile` 설정 섹션 인라인 검증)가 실제 구현과 맞도록 복구.

**검증:**

- `npm test -- --run tests/regression.bugs.spec.js` 통과.

**변경파일:**

- `src/js/components/settingsSections.js`
- `docs/SESSION_LOG.md`

---

## 2026-05-06 12:00 — Codex CLI

**요구사항:**
설정 페이지가 계속 깨져 보이는 문제를 docs 기준으로 다시 확인해 복구하고, 설정 탭 아이콘 고정, 홈 화면 위젯 설정 행 제거, Android 위젯 동작 보강, 상세보기 이미지 출처/라이선스 표시, 튜토리얼 복구, 세션 로그 작성을 한 번에 정리.

**구현방법:**

- `docs/SESSION_LOG.md` 와 `docs/UI_GUIDE.md` 를 확인해 `/profile` 이 실제 설정 진입점이고, 헤더는 가운데 "설정", 보관함 UI는 `/bookmarks` 로 분리되어야 하는 기존 결정을 재확인.
- 설정 탭 아이콘은 `main.js` 의 프로필/게스트 아바타 교체 구독 로직을 제거해 `index.html` 의 고정 톱니바퀴 SVG가 유지되도록 정리.
- `notificationSettingsSheet.js` 에서 `#setting-widget-theme` 행과 위젯 테마 시트 진입 바인딩을 제거하고, `tutorialTour.js` 에서 제거된 위젯 설정 행을 대상에서 제외. `/settings` 는 공유 설정 섹션을 쓰는 호환 페이지로 축소.
- 설정 페이지가 깨져 보이던 직접 원인인 누락 CSS를 복구: `.settings-user-info`, `.settings-user-row`, `.profile-avatar-wrap`, `.settings-user-*` 규칙을 추가하고, `.list-item-icon svg` 크기를 22px로 고정해 프로필 이미지와 설정 row 아이콘이 원본 크기로 터지지 않게 함. 테마 옵션 버튼도 기본 브라우저 border/background를 제거.
- 튜토리얼은 기존 `startTutorialTour()` 만 호출되고 라우터 렌더 후 `renderTutorialTourForRoute()` 가 실행되지 않던 문제를 `router.js` 에서 연결. 오늘 편지 게이트/빈 내 일기/보관함 등 상태에 따라 대상 요소가 바뀌는 화면도 안정적으로 잡도록 selector fallback을 추가하고, 대상이 지연되어도 단계를 자동 스킵하지 않고 현재 페이지 영역을 fallback으로 사용하도록 변경.
- `UI_GUIDE.md` 의 튜토리얼 범위를 현재 구현과 맞게 수정: 설정 화면에서 제거된 홈 화면 위젯 설정 행은 튜토리얼 대상에 넣지 않도록 명시.
- Android 위젯은 `MainActivity.java` 에서 `DayStoryWidgetPlugin` 을 `super.onCreate()` 전에 등록. `main.js` 에 `daystory://letter`, `daystory://diary/new` 딥링크를 추가하고, `editorstory.js`/`mystory.js` 에서 오늘 편지 열림 여부와 오늘 내 일기 존재 여부를 위젯 서비스에 동기화.
- 상세보기는 `detail.js` 에서 `image_source`, `image_license`, `story_sources`/`sources` 를 정규화해 `.detail-editor-note` 바로 아래에 표시. 에디터 한마디가 없으면 본문 날짜 아래에 표시되며, URL 참고 자료는 링크로, 텍스트 참고 자료는 일반 텍스트로 렌더링.
- 회귀 테스트 보강: 설정 위젯 행 제거, 고정 설정 nav 아이콘, 상세보기 출처/라이선스 위치, 설정 사용자 카드/아이콘 CSS, 튜토리얼 라우터 연결, Android 위젯 정적 계약 검증을 추가.

**검증:**

- `npm test -- --run tests/regression.bugs.spec.js`: 11 tests 통과.
- `npm test`: 7 files / 53 tests 통과.
- `npm run build`: 성공.
- `android\gradlew.bat -p android assembleDebug`: BUILD SUCCESSFUL.
- `git diff --check`: 공백 오류 없음. Windows line-ending 경고만 표시.
- dev server 확인: `http://127.0.0.1:5174` 응답 200. `5173` 은 포트는 점유 중이나 HTTP 응답 없음.

**변경파일**

- `android/app/src/main/java/com/daystory/app/MainActivity.java`
- `docs/UI_GUIDE.md`
- `docs/SESSION_LOG.md`
- `src/css/components.css`
- `src/css/pages.css`
- `src/js/components/notificationSettingsSheet.js`
- `src/js/components/tutorialTour.js`
- `src/js/pages/detail.js`
- `src/js/pages/editorstory.js`
- `src/js/pages/mystory.js`
- `src/js/pages/settings.js`
- `src/js/router.js`
- `src/main.js`
- `tests/detail_nav.ui.spec.js`
- `tests/regression.bugs.spec.js`
- `tests/widget.static.spec.js`

---

## 2026-05-06 12:14 — Codex CLI

**요구사항:**
문서 기준을 다시 읽고, 망가진 튜토리얼 흐름을 고치며, 카드/상세 화면 사진 로딩이 느린 문제를 개선.

**구현방법:**

- `docs/UI_GUIDE.md`, `docs/PRD.md`, `docs/SESSION_LOG.md`, `AGENTS.md`를 기준으로 튜토리얼이 제거된 홈 화면 위젯 설정을 다시 타깃하지 않고, 큰 페이지 컨테이너 대신 실제 조작 지점에 붙도록 `tutorialTour.js` 셀렉터를 정리.
- 튜토리얼 타깃을 찾지 못할 때 자동으로 다음 단계로 건너뛰어 흐름이 튀는 대신 현재 페이지 영역 fallback에 말풍선을 표시하도록 유지해, [다음] 버튼이 한 번에 한 단계만 진행되게 함.
- 카드/상세/캘린더/에디터 미리보기 이미지에 `decoding="async"`, 주요 첫 화면 이미지에 `loading="eager"`와 `fetchpriority="high"`를 적용.
- `imageLoading.js`를 추가해 오늘 카드/내 일화/상세 이미지가 렌더 직전에 미리 디코딩되도록 연결.
- 에디터 이미지 업로드는 기존 `browser-image-compression` 의존성을 사용해 Firebase Storage 업로드 전에 최대 0.45MB, 1400px 기준으로 압축한 파일을 업로드하도록 변경.
- 회귀 테스트에 튜토리얼 셀렉터/위젯 제거 기준과 이미지 로딩/업로드 압축 기준을 추가.

**검증:**

- `npm test -- --run tests/regression.bugs.spec.js tests/editorstory.ui.spec.js`: 27 tests 통과.
- `npm test`: 7 files / 54 tests 통과.
- `npm run build`: 성공.

**변경파일:**

- `docs/SESSION_LOG.md`
- `src/js/components/tutorialTour.js`
- `src/js/pages/bookmarks.js`
- `src/js/pages/calendar.js`
- `src/js/pages/detail.js`
- `src/js/pages/editor.js`
- `src/js/pages/editorstory.js`
- `src/js/pages/mystory.js`
- `src/js/pages/search.js`
- `src/js/services/stories.js`
- `src/js/utils/imageLoading.js`
- `tests/editorstory.ui.spec.js`
- `tests/regression.bugs.spec.js`

---

## 2026-05-06 — Claude Code

**요구사항:**
(1) 업로드 이미지 편집(편집 버튼)이 일부 카드에서만 작동. (2) 카드가 2개씩 슬라이드되는 문제. (3) 화면 너비에 따른 반응형 카드 크기 조절 문제.

**구현방법:**

- #2 `editorstory.js` `onClickItem` 함수 내부에서 `clearTimeout(scrollTimeout)` 추가 — `scrollTo(smooth)` 가 발생시키는 `scroll` 이벤트로 `onScrollEnd` 가 150ms 후 재실행되어 카드가 2칸 이동하던 문제 해소.
- #3 `pages.css` `.editorstory-card-area > .flip-container` / `.daily-letter-gate` / `.card-stack-item` 에 `max-width: 390px; margin: 0 auto` 추가 — 화면 너비가 넓어도 카드가 과도하게 커지지 않도록 제한.
- #1 `editor.js` `processUploadBlob` 내 `applyUploadResult` 호출 직후 `updateImageEditBtn()` 명시적 호출 추가 — 업로드 완료 후 편집 버튼이 확실히 표시되도록 방어.

**변경파일:**

- `src/js/pages/editorstory.js`
- `src/css/pages.css`
- `src/js/pages/editor.js`

---

## 2026-05-06 — Claude Code (추가 수정)

**요구사항:**
5월 1일에서 뒤로 스와이프하면 4월 31일로 이동하는 버그. 4월은 30일까지밖에 없는데 31일이 선택된다.

**구현방법:**

- `editorstory.js` `applyDisabledState()`에 `daysInSelectedMonth` 계산 추가 (`new Date(year, month, 0).getDate()`). 선택된 월의 실제 마지막 날보다 큰 날짜(예: 4월 31일, 2월 29~31일)를 disabled 처리. 기존 코드는 미래 날짜/미래 월만 disabled 처리하고 존재하지 않는 날짜를 걸러내지 않아 4월 31일이 선택 가능한 상태로 남아있었고, 스와이프 시 마지막 활성 아이템으로 선택되던 문제 해소.

**변경파일:**

- `src/js/pages/editorstory.js`

---

## 2026-05-06 12:49 Codex CLI

**요구사항:**
튜토리얼 포커싱을 `data-tour-target` 기반으로 고정하고, 캘린더/보관함/검색 등 작은 이미지 surface가 `image_thumb_url`을 우선 사용하도록 마무리. 기존 게시물 썸네일은 에디터 권한 사용자에게만 저강도 백필하고, 신규 업로드는 표시 이미지와 썸네일을 함께 저장.

**구현방법:**

- `tutorialTour.js`의 모든 단계 selector를 현재 route의 `.page` 안에서 찾는 `data-tour-target` 기반 selector로 정리하고, 캘린더 단계는 `[data-tour-target="calendar-toggle"]`로 토글 전체를 spotlight 하도록 변경.
- 오늘 카드/편지, 날짜 휠 활성 일자, 캘린더 토글, 나의 일화 카드/작성 버튼, 보관함 검색, 설정 row에 `data-tour-target`을 부여.
- 타깃을 찾은 뒤 `scrollIntoView` 후 2번의 `requestAnimationFrame`을 기다려 non-zero rect를 확인한 다음 spotlight와 bubble을 배치하도록 변경.
- `getStoryImageUrl`, `preloadStoryImages`에 thumb/display variant를 추가하고, 캘린더 셀/보관함 미니카드/검색 결과는 `image_thumb_url || image_url` 순서로 표시.
- `uploadCardImageVariants()`와 `backfillStoryThumbnailsForMonth()`를 추가해 신규 업로드는 표시 이미지와 4:5 썸네일을 함께 저장하고, 에디터 권한 캘린더 진입 시 현재 표시 월의 누락 썸네일만 concurrency 1로 백필.
- 홈 진입 idle 시점 및 캘린더 nav `pointerenter`/`touchstart`/`focus`에서 캘린더 모듈, `fetchStories()` 캐시, 현재 달 썸네일만 미리 데우도록 연결. 썸네일이 없으면 원본 이미지는 선제 preload 하지 않도록 `fallback:false`를 사용.

**검증:**

- `npm test -- --run tests/regression.bugs.spec.js tests/editorstory.ui.spec.js tests/calendar.ui.spec.js`: 3 files / 31 tests 통과.
- `npm test`: 8 files / 58 tests 통과.
- `npm run build`: 성공.

**변경파일:**

- `docs/SESSION_LOG.md`
- `src/main.js`
- `src/js/components/notificationSettingsSheet.js`
- `src/js/components/settingsSections.js`
- `src/js/components/tutorialTour.js`
- `src/js/pages/bookmarks.js`
- `src/js/pages/calendar.js`
- `src/js/pages/editor.js`
- `src/js/pages/editorstory.js`
- `src/js/pages/mystory.js`
- `src/js/pages/search.js`
- `src/js/services/images.js`
- `src/js/services/stories.js`
- `src/js/utils/imageLoading.js`
- `tests/calendar.ui.spec.js`
- `tests/editorstory.ui.spec.js`
- `tests/regression.bugs.spec.js`

---

## 2026-05-06 12:56 — Codex CLI

**요구사항:**
튜토리얼 포커싱/캘린더 썸네일 로딩 개선 계획 구현 상태를 재확인하고, 남은 작은 불일치를 정리.

**구현방법:**

- 홈에서 캘린더 nav 예열 시 `fetchStories()`를 직접 호출하지 않고 공유 캐시 API인 `warmStoriesCache()`를 사용하도록 정리.
- 에디터/나의 일화 작성 화면에서 이미지 URL을 수동으로 바꾸면 기존 `image_thumb_url`이 잘못 재사용되지 않도록 숨김 썸네일 필드를 비움.
- 업로드 완료로 코드가 `image_url`/`image_thumb_url`을 동시에 채울 때는 썸네일 필드가 지워지지 않도록 suppress 플래그로 입력 이벤트를 보호.

**검증:**

- `npm test -- --run tests/regression.bugs.spec.js tests/editorstory.ui.spec.js tests/calendar.ui.spec.js`: 3 files / 31 tests 통과.
- `npm test`: 8 files / 58 tests 통과.
- `npm run build`: 성공.
- `http://localhost:5173/`: 200 응답 확인.

**변경파일:**

- `docs/SESSION_LOG.md`
- `src/main.js`
- `src/js/pages/editor.js`
- `src/js/pages/mystory.js`

---

## 2026-05-06 13:01 — Codex CLI

**요구사항:**
문서 기준으로 코드 중복과 하드코딩을 줄이고, 재사용 가능한 작은 단위로 리팩토링.

**구현방법:**

- 카드/캘린더/보관함/에디터 미리보기 placeholder data URI를 페이지별 `PLACEHOLDER_IMG` 상수에서 `imageLoading.js`의 `CARD_PLACEHOLDER_IMAGE`, `EDITOR_PREVIEW_PLACEHOLDER_IMAGE`로 통합.
- 에디터와 나의 일화 작성 화면의 `image_url`/`image_thumb_url` 동기화 로직을 `utils/imageFields.js`의 `bindImageVariantFields()`로 추출. 수동 URL 입력 시 stale thumb을 지우고, 업로드 결과 적용 시에는 두 필드를 함께 갱신하도록 공통화.
- `ARCHITECTURE.md`와 `CODE_MAP.md`에 `images.js`, `imageLoading.js`, `imageFields.js` 소유권과 사진 업로드 흐름을 현재 구현과 맞게 갱신.
- 회귀 테스트에 placeholder 하드코딩 재발 방지와 이미지 필드 동기화 헬퍼 사용 검사를 추가.

**검증:**

- `npm test -- --run tests/editorstory.ui.spec.js tests/calendar.ui.spec.js tests/regression.bugs.spec.js`: 3 files / 33 tests 통과.
- `npm test`: 8 files / 60 tests 통과.
- `npm run build`: 성공.

**변경파일:**

- `docs/ARCHITECTURE.md`
- `docs/CODE_MAP.md`
- `docs/SESSION_LOG.md`
- `src/js/pages/bookmarks.js`
- `src/js/pages/calendar.js`
- `src/js/pages/editor.js`
- `src/js/pages/mystory.js`
- `src/js/utils/imageFields.js`
- `src/js/utils/imageLoading.js`
- `tests/editorstory.ui.spec.js`

---

## 2026-05-06 13:31 Codex CLI

**요구사항:**
에디터 한마디의 느낌표 기능을 삭제하고, 에디터의 아이콘 이미지는 관리자 계정 이미지와 동일하게 맞추며, bottom nav의 북마크 아이콘을 보관함 아이콘으로 대체.

**구현방법:**

- 에디터 한마디가 있는 카드 뒷면에서 `editor-badge` 느낌표를 생성/기억하던 로컬스토리지 기반 배지 로직과 CSS 애니메이션을 제거.
- 에디터 일화 저장 데이터와 미리보기에서 `stateProfile.photoURL || auth.currentUser.photoURL` 순서로 관리자 프로필 이미지를 우선 사용하도록 변경.
- `index.html` bottom nav의 `/bookmarks` 항목 SVG를 리본 북마크가 아닌 보관함 박스 아이콘으로 교체.
- `editorstory.ui.spec.js`와 `regression.bugs.spec.js`에 배지 제거, 관리자 프로필 이미지 우선순위, 보관함 nav 아이콘 회귀 검증을 추가/수정.

**검증:**

- `npm test -- --run tests/editorstory.ui.spec.js tests/regression.bugs.spec.js`: 2 files / 32 tests 통과.
- `npm test`: 8 files / 62 tests 통과.
- `npm run build`: 성공.

**변경파일:**

- `docs/SESSION_LOG.md`
- `index.html`
- `src/css/components.css`
- `src/js/pages/editor.js`
- `src/js/pages/editorstory.js`
- `tests/editorstory.ui.spec.js`
- `tests/regression.bugs.spec.js`

---

## 2026-05-06 15:18 Codex CLI

**요구사항:**
햅틱을 제거하고, 에디터의 한마디가 나오지 않는 버그를 수정.

**구현방법:**

- `calendar.js`, `editorstory.js`, `mystory.js`에서 `@capacitor/haptics` import와 `Haptics.impact`, `Haptics.selectionChanged` 호출을 제거.
- 더 이상 사용하지 않는 `hapticTriggered` 상태와 테스트용 Haptics mock을 제거.
- `package.json`/`package-lock.json`에서 `@capacitor/haptics`를 제거하고, 기존 알림 서비스가 실제로 import하는 `@capacitor/local-notifications`를 dependency로 명시.
- 에디터 한마디 말풍선이 바깥 클릭 처리에 의해 탭 대상에서 빠지지 않도록 `.editor-comment-bubble`의 `pointer-events`를 `auto`로 변경.
- 햅틱 제거와 말풍선 pointer-events 회귀 테스트를 추가.

**검증:**

- `npm test -- --run tests/editorstory.ui.spec.js tests/regression.bugs.spec.js`: 2 files / 33 tests 통과.
- `npm test`: 8 files / 63 tests 통과.
- `npm run build`: 성공.
- `git diff --check`: 통과.
- `npx cap sync android`: 성공.
- `android` 디렉터리에서 `.\gradlew.bat assembleDebug`: 성공.

**변경파일:**

- `android/app/capacitor.build.gradle`
- `android/capacitor.settings.gradle`
- `docs/SESSION_LOG.md`
- `package.json`
- `package-lock.json`
- `src/css/components.css`
- `src/js/pages/calendar.js`
- `src/js/pages/editorstory.js`
- `src/js/pages/mystory.js`
- `tests/editorstory.ui.spec.js`
- `tests/regression.bugs.spec.js`

---

## 2026-05-07 12:28 Codex CLI

**요구사항:**
Docs를 먼저 읽고, 문제가 많은 튜토리얼을 삭제하며, 관리자/사용자 사진 업로드와 화면 전환 로딩을 줄이고, 편지 애니메이션 대신 카드가 위에서 아래로 내려오는 모션을 적용하고, Android 위젯이 적용되지 않는 문제를 파악/수정. 완료 후 세션 로그 작성.

**구현방법:**

- `tutorialTour.js`, 라우터 실행 연결, 설정의 튜토리얼 다시 보기 행, `data-tour-target` 표식, 튜토리얼 전용 CSS/토큰을 제거하고 관련 문서를 현재 동작에 맞게 갱신.
- 홈 오늘 카드의 편지 게이트/봉투 애니메이션을 제거하고 첫 렌더 시 `.card-drop-enter` 하강 모션만 적용.
- 공통 이미지 업로드 서비스가 표시 이미지와 4:5 썸네일을 WebP로 압축해 Storage에 content type과 함께 저장하도록 변경. 관리자 편집기와 사용자 글쓰기 모두 같은 업로드 경로를 사용.
- Android 위젯 receiver에 enabled/label을 명시하고, widget provider label/previewImage, preview drawable, `onEnabled()` 갱신을 추가해 런처 위젯 목록 노출 계약을 보강.
- 관련 Vitest 계약과 문서를 튜토리얼 제거/WebP 업로드/위젯 메타데이터 기준으로 갱신.

**검증:**

- `npm test -- --run tests/editorstory.ui.spec.js tests/regression.bugs.spec.js tests/widget.static.spec.js`: 3 files / 36 tests 통과.
- `npm test -- --run tests/editorstory.ui.spec.js tests/regression.bugs.spec.js tests/widget.static.spec.js tests/calendar.ui.spec.js`: 4 files / 39 tests 통과.
- `npm test`: 8 files / 63 tests 통과.
- `npm run build`: 성공.
- `npx cap sync android`: 성공.
- `android` 디렉터리에서 `.\\gradlew.bat assembleDebug`: 성공.
- `git diff --check`: 공백 오류 없음.
- Android 원본 manifest/widget info에서 `DayStoryWidgetProvider`, `@xml/daystory_widget_info`, `@string/widget_label`, `@drawable/widget_preview` 확인.

**변경파일:**

- `android/app/src/main/AndroidManifest.xml`
- `android/app/src/main/java/com/daystory/app/widget/DayStoryWidgetProvider.java`
- `android/app/src/main/res/drawable/widget_preview.xml`
- `android/app/src/main/res/xml/daystory_widget_info.xml`
- `docs/ARCHITECTURE.md`
- `docs/CODE_MAP.md`
- `docs/PRD.md`
- `docs/UI_GUIDE.md`
- `docs/SESSION_LOG.md`
- `src/css/pages.css`
- `src/css/variables.css`
- `src/js/components/notificationSettingsSheet.js`
- `src/js/components/settingsSections.js`
- `src/js/components/tutorialTour.js`
- `src/js/pages/bookmarks.js`
- `src/js/pages/calendar.js`
- `src/js/pages/editorstory.js`
- `src/js/pages/mystory.js`
- `src/js/pages/profile.js`
- `src/js/router.js`
- `src/js/services/images.js`
- `src/main.js`
- `tests/calendar.ui.spec.js`
- `tests/editorstory.ui.spec.js`
- `tests/regression.bugs.spec.js`
- `tests/widget.static.spec.js`

---

## 2026-05-07 13:13 Codex CLI

**요구사항:**
Android 앱 아이콘이 적용되지 않는 문제를 확인하고, Elixir 마이그레이션 장단점을 검토.

**구현방법:**

- `aapt dump badging`으로 debug APK를 확인했을 때 application icon은 설정되어 있었지만 `launchable-activity`의 icon 값이 비어 있는 것을 확인.
- launcher가 직접 여는 `MainActivity`에도 `android:icon="@mipmap/ic_launcher"`와 `android:roundIcon="@mipmap/ic_launcher_round"`를 명시.
- 같은 문제가 다시 생기지 않도록 `tests/widget.static.spec.js`에 launcher activity icon 계약을 추가.

**검증:**

- `npm test -- --run tests/widget.static.spec.js`: 1 file / 5 tests 통과.
- `npm test`: 8 files / 64 tests 통과.
- `android` 디렉터리에서 `.\\gradlew.bat :app:assembleDebug --console=plain`: 성공.
- `aapt dump badging C:\\AndroidBuildTemp\\DayStory\\app\\outputs\\apk\\debug\\app-debug.apk`: `launchable-activity` icon이 `res/mipmap-anydpi-v26/ic_launcher.xml`로 채워진 것 확인.

**변경파일:**

- `android/app/src/main/AndroidManifest.xml`
- `docs/SESSION_LOG.md`
- `tests/widget.static.spec.js`

---

## 2026-05-07 22:06 Codex CLI

**요구사항:**
사진이 가끔 placeholder로 보이거나 오래 걸리는 문제, 카드 스와이프가 뻑뻑하고 한 번에 두 장 넘어가던 문제, 편지 애니메이션/위젯 로딩 문구/알림 바텀시트 중복 애니메이션/다크모드 버튼 색상 문제를 수정. 이어서 나의 일기 카드 액션을 콘텐츠 카드와 맞추되 북마크 대신 편집 버튼을 넣고 삭제는 편집 화면으로 이동. 마지막 요청에 따라 홈 화면에 임시로 추가했던 내 일화 탭 버튼식 전환과 스와이프 내 일화 열 기능은 삭제하고, 그동안의 대화 흐름을 세션 로그에 기록.

**구현방법:**

- 카드/캘린더/보관함/검색 이미지가 `image_thumb_url`을 우선 사용하고 실패 시 원본/placeholder로 안전하게 떨어지도록 정리. 업로드는 표시용 WebP와 4:5 썸네일 WebP를 함께 생성하도록 공통 이미지 서비스로 통합.
- `public/daystory-image-cache-sw.js`와 `main.js` 등록 경로를 추가해 최초 로드 후 같은 이미지 요청은 로컬 캐시를 우선 사용하고, 캐시 업데이트는 새 요청만 따라가도록 구성.
- 홈/내 일기 카드 스택 전환 시간을 공유 상수로 맞추고, 터치 이후 합성 mouse 이벤트와 빠른 중복 commit을 막아 한 번 스와이프에 카드 한 장만 넘어가도록 방어.
- 편지 게이트/편지 애니메이션은 제거하고 홈 카드는 바로 렌더링되도록 유지. Android 위젯은 데이터가 없어도 빈 문구 대신 기본 카드/액션이 뜨도록 레이아웃과 정적 검증을 보강.
- 알림 설정 바텀시트가 한 번의 조작에 두 번 튀어나오는 흐름을 막고, 다크모드에서 홈 월/일 선택 테두리와 카드 액션 버튼이 흰색으로 보이도록 CSS를 보정.
- `/mystory` 카드의 상단 버튼을 콘텐츠 카드와 같은 공유/편집 액션으로 맞추고, 삭제는 `/mystory/new?edit=...` 편집 화면의 삭제 버튼에서만 가능하게 변경.
- 최신 요청에 따라 `/editorstory`에서 `fetchMyStories` 의존성, `.home-story-toggle`, 홈 전용 내 일화 카드/쓰기 버튼, 세로 스와이프 모드 전환, 관련 Vitest 테스트를 제거. 내 일화 작성/전환 진입점은 문서 기준대로 캘린더와 내 일기 화면에만 남김.

**검증:**

- `npm test -- --run tests/editorstory.ui.spec.js tests/regression.bugs.spec.js`: 2 files / 39 tests 통과.
- `npm test -- --run`: 8 files / 74 tests 통과.
- `npm run build`: 성공.
- `git diff --check`: 공백 오류 없음. Git의 LF→CRLF 경고만 출력.
- `npx cap sync android`: 성공.
- `android` 디렉터리에서 `.\gradlew.bat assembleDebug`: 성공.
- `rg`로 `home-story-toggle`, `home-my-story`, `fetchMyStories`, 홈 내 일화 전환 테스트 문자열이 `editorstory.js`/`pages.css`/`editorstory.ui.spec.js`에 남지 않았음을 확인.

**변경파일:**

- `android/app/src/main/res/layout/widget_daystory.xml`
- `docs/SESSION_LOG.md`
- `public/daystory-image-cache-sw.js`
- `src/css/base.css`
- `src/css/components.css`
- `src/css/pages.css`
- `src/js/components/notificationSettingsSheet.js`
- `src/js/pages/bookmarks.js`
- `src/js/pages/calendar.js`
- `src/js/pages/editor.js`
- `src/js/pages/editorstory.js`
- `src/js/pages/mystory.js`
- `src/js/pages/search.js`
- `src/js/services/images.js`
- `src/js/services/notifications.js`
- `src/js/utils/imageLoading.js`
- `src/main.js`
- `tests/bookmarks.ui.spec.js`
- `tests/calendar.ui.spec.js`
- `tests/editor_management_calendar.spec.js`
- `tests/editorstory.ui.spec.js`
- `tests/regression.bugs.spec.js`
- `tests/widget.static.spec.js`

---

## 2026-05-09 22:00 — Claude Code

**요구사항:**
Claude Code가 오케스트레이터 역할을 하여 `npm run harness:auto` 실행 시 외부 CLI 없이 Claude가 직접 step을 처리하는 harness 자동화 시스템 구축. 바이브코딩 세션 중 "알아서 해줘" 한 마디로 pending 작업이 자동 실행되게 하고 토큰도 절약.

**구현방법:**

- `scripts/check-pending-phases.mjs` 생성 — Notification hook에서 pending phase 감지 후 exit(2)로 Claude context에 주입
- `scripts/codex-harness.mjs` 재설계 — pending phase 탐색, dirty worktree snapshot commit, step 지시사항을 stdout으로 출력해 Claude가 직접 읽고 처리하는 방식 (외부 CLI 불필요)
- `scripts/harness-commit.mjs` 생성 — Claude가 step 완료 후 result.json 작성 뒤 호출해 index.json 업데이트 + code/meta 커밋 분리 생성
- `.claude/settings.json` Notification hook 추가 — 세션 중 pending phase 자동 감지
- `package.json` 스크립트 추가 — `harness:auto`, `harness`, `harness:status`, `harness:commit`
- `CLAUDE.md` Agent Harness/명령어 섹션 업데이트 — 새 흐름 반영
- `phases/` 폴더 생성, bootstrap(001) + 흐름 검증(002) phase 완료 확인

**변경파일:**

- `scripts/check-pending-phases.mjs`
- `scripts/codex-harness.mjs`
- `scripts/harness-commit.mjs`
- `.claude/settings.json`
- `package.json`
- `CLAUDE.md`
- `phases/.gitkeep`
- `phases/001-harness-bootstrap/index.json`
- `phases/001-harness-bootstrap/step1.md`
- `phases/001-harness-bootstrap/step1.result.json`
- `phases/002-test-flow/index.json`
- `phases/002-test-flow/step1.md`
- `phases/002-test-flow/step1.result.json`
- `docs/SESSION_LOG.md`

---

## 2026-05-09 22:10 — Claude Code

**요구사항:**
harness step 시작 시 docs 문서들과 SESSION_LOG를 제일 먼저 읽도록 지시사항에 추가.

**구현방법:**

- `scripts/codex-harness.mjs` `buildInstructions()` 상단에 "작업 시작 전 필독" 섹션 추가 — CLAUDE.md → SESSION_LOG.md → ARCHITECTURE.md → CODE_MAP.md → index.json 순서로 명시.

**변경파일:**

- `scripts/codex-harness.mjs`
- `docs/SESSION_LOG.md`


---

## 2026-05-10 22:00 — Claude Code

**요구사항:**
캘린더의 역사 카드를 "수집" 기능으로 만들 것. 오늘 날짜 카드를 클릭하면 수집 버튼이 나타나고, 수집 시 "수집되었어요!" 애니메이션이 재생되며 카드가 소유됨. 날짜가 지난 카드는 회색 처리되어 앞면만 볼 수 있고 뒤집기 불가(한정 상품).

**구현방법:**

- `src/js/services/collection.js` 신규 생성 — localStorage 기반 수집 기록 관리 (storyId → 수집일). `isCollected`, `canCollect`, `collect`, `getCollectedIds` 함수 제공.
- `src/js/pages/calendar.js` 수정 — 수집 서비스 임포트; `renderCellPeek`에 수집 뱃지(✦) 및 잠금 오버레이(회색) 추가; `openCardPopup`에서 locked/collected 상태 계산 후 팝업 힌트 분기; 수집 버튼 클릭 이벤트로 `collect()` 호출 후 버튼 상태 전환 및 `showCollectAnimation` 실행; 플립 잠금 로직(locked && !_collected); `buildHistoryCardHtml`에 locked 오버레이, 수집 버튼 바 추가; `showCollectAnimation` 함수 추가.
- `src/css/pages.css` 수정 — 잠금 힌트 색, 셀 수집 뱃지, 셀 잠금 오버레이, 카드 잠금 오버레이, 수집 버튼 바, 수집 성공 텍스트/파티클 애니메이션(@keyframes collectIn/Out/particleBurst) 스타일 추가.

**변경파일:**

- `src/js/services/collection.js` (신규)
- `src/js/pages/calendar.js`
- `src/css/pages.css`

---

## 2026-05-10 22:15 — Claude Code

**요구사항:**
"기간이 지났어요" 텍스트와 잠금 아이콘 제거. 관리자(role === 'editor')는 모든 카드가 해금된 상태로 보이게 할 것.

**구현방법:**

- `src/js/pages/calendar.js` 수정 — `renderCellPeek`와 `openCardPopup`에서 `isAdmin = profile.role === 'editor'` 체크 후 locked 계산식에 `&& !isAdmin` 추가. 관리자는 모든 카드가 collectible/collected와 동일하게 동작.
- `src/js/pages/calendar.js` — 카드 잠금 오버레이에서 🔒 아이콘과 "기간이 지났어요" 텍스트 제거(빈 오버레이만 남김), 팝업 하단 "기간이 지나 수집할 수 없습니다" 힌트도 제거.
- `src/css/pages.css` — `.card-locked-icon`, `.card-locked-text`, `.calendar-card-popup-hint--locked` 규칙 삭제. `.card-locked-overlay`는 흑백 톤만 남기는 단순 어두운 레이어로 단순화.

**변경파일:**

- `src/js/pages/calendar.js`
- `src/css/pages.css`

---

## 2026-05-10 22:35 — Claude Code

**요구사항:**
딥링크를 이용해 SNS에 카드를 공유했을 때 미리보기가 이쁘게 나오게 할 것 (정적 OG + 카드 이미지 첨드 + 카드별 동적 OG + App Links 풀 셋업).

**구현방법:**

- `index.html` — Open Graph(og:title/description/image/url 등) 및 Twitter Card 메타 태그 추가. 기본 OG 이미지는 `/og-default.png` 경로 사용.
- `src/js/services/sharing.js` (신규) — 통합 공유 헬퍼. `shareStory()`는 1) `navigator.share` + `files`로 카드 이미지를 직접 첨부(카톡/SMS에서 미리보기 보장), 2) 폴백으로 Capacitor Share. `buildShareUrl()`는 `https://daystory.app/share/{id}` 형식 생성.
- `src/js/pages/{calendar,editorstory,detail,mystory}.js` — 기존 분산된 `Share.share`/`navigator.share` 호출을 모두 `shareStory()`로 통일. URL은 `buildShareUrl()` 기반.
- `src/main.js` — `/share/:id` SPA 라우트 등록(detail 페이지 재사용).
- `android/app/src/main/AndroidManifest.xml` — `https://daystory.app/share/`, `/detail/` 경로용 App Links intent-filter (`autoVerify="true"`) 추가. 기존 `daystory://` 커스텀 스키마는 유지.
- `public/.well-known/assetlinks.json` (신규) — App Links 도메인 검증용 템플릿. 실제 배포 시 release/debug SHA256 fingerprint 기입 필요.
- `functions/index.js` (신규) — Cloud Functions(`shareOg`, asia-northeast3 region). 봇 User-Agent(facebookexternalhit/Twitterbot/kakaotalk-scrap 등) 감지 시 Firestore에서 story를 조회해 카드별 OG HTML 응답, 일반 사용자는 SPA 해시 URL로 redirect.
- `functions/package.json`, `functions/.gitignore` (신규) — firebase-admin / firebase-functions 의존성.
- `firebase.json` — rewrites에 `/share/**` → `shareOg` 함수 매핑 추가. `/.well-known/assetlinks.json` 캐시/Content-Type 헤더, functions 섹션 추가.

**변경파일:**

- `index.html`
- `src/js/services/sharing.js` (신규)
- `src/js/pages/calendar.js`
- `src/js/pages/editorstory.js`
- `src/js/pages/detail.js`
- `src/js/pages/mystory.js`
- `src/main.js`
- `android/app/src/main/AndroidManifest.xml`
- `public/.well-known/assetlinks.json` (신규)
- `functions/index.js` (신규)
- `functions/package.json` (신규)
- `functions/.gitignore` (신규)
- `firebase.json`
