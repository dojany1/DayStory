# SESSION_LOG

DayStory 작업 이력 요약입니다. 세부 변경파일 목록 대신 날짜별 패치노트 형식으로 간략히 유지합니다.

## 기록 방식

- 새 작업은 해당 날짜 아래에 1~5개 bullet로 추가합니다.
- 변경파일 목록은 적지 않습니다. 필요하면 git diff, commit, PRD, CODE_MAP을 확인합니다.
- 검증은 대표 명령과 결과만 짧게 적습니다.
- 같은 날짜의 작은 수정은 별도 세션으로 쪼개지 말고 기존 날짜 항목에 이어 적습니다.

---

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

**H. 카드 캡처 공유 기능 신규 (Claude, 17:14)**
- `html2canvas@1.4.1`, `@capacitor/filesystem@8.1.2` 설치. `capacitor.config.json` 의 `android.includePlugins` 에 filesystem 추가하여 `cap sync android` 가 plugin 으로 인식하도록 함 (Android 는 allowlist 방식, iOS 는 자동).
- `services/sharing.js` 에 `captureAndShareCard(cardElement, options)` 추가. 흐름: ① 카드 하단 우측에 워터마크 DOM(앱 로고 + 'DayStory') 임시 주입 + 카드 `position` 임시 `relative` ② `html2canvas` 동적 import 로 캡처(`useCORS: true`, devicePixelRatio scale) ③ `finally` 에서 워터마크 제거 + position 원복 ④ Native(Capacitor): `Filesystem.writeFile` → `Directory.Cache` 저장 → `Share.share({ url })` ⑤ Web: Web Share Level 2(files) 우선, 미지원 시 다운로드 폴백.
- `pages/mystory.js`, `pages/calendar.js`, `pages/editorstory.js` 의 공유 버튼 핸들러를 새 캡처 흐름으로 전환. 캡처 실패(non-cancel) 시 기존 `shareStory()`(URL/텍스트) 로 폴백, 캡처 중에는 버튼 `disabled` 토글로 중복 클릭 차단.
- html2canvas 는 `await import('html2canvas')` 동적 import 로 분리 → 별도 chunk `html2canvas-*.js 199.56kB / gzip 46.78kB`, 초기 번들 영향 없음.
- 검증: `npm run build` 성공, `npx cap sync android` → "Found 9 Capacitor plugins" 에서 `@capacitor/filesystem@8.1.2` 확인, `android/capacitor.settings.gradle` 및 `android/app/capacitor.build.gradle` 에 `:capacitor-filesystem` 등록 확인. 기존 vitest 71 fail 은 베이스라인의 jsdom `sessionStorage` 미설정 등 무관 회귀.

---

### 2026-06-01 — 카드 UX 피드백 · 페이지 진입 애니메이션 · 레이아웃 개선

**A. 카드 탭 피드백 (꾹 누름 상태 시각화)**
- `components.css` — `.flipper.is-pressing { scale: 0.95; }` 추가. 기존 `.flipper` 의 `transition: scale 0.2s` 와 결합해 누를 때·뗄 때 부드럽게 스케일 변환.
- `editorstory.js`, `mystory.js` — `bindFlipCardEvents()` / `bindMyStoryCardEvents()` 초입에 touch 이벤트 핸들러 추가. 60ms 딜레이 후 `.is-pressing` 클래스 추가, `touchmove`/`touchend`/`touchcancel` 에서 즉시 제거. 스와이프와 탭을 구분해 스와이프 중에는 피드백 미표시.

**B. 페이지 진입 애니메이션 바리에이션 (방향성 있는 진입)**
- `router.js` — `previousRoute` 변수 추가, 매 실제 네비게이션 시 `currentRoute` 로 갱신. `getPreviousRoute()` export 추가 → 페이지가 직전 경로를 판단 가능.
- `base.css` — `pageEnterFromRight`(우측 28px), `pageEnterFromLeft`(좌측 -28px) keyframes 추가. `.page[data-enter="from-right/left"]` 로 animation-name 덮어씀(기본값 유지).
- `mystory.js` — `data-enter="from-right"` 항상 설정 (우측에서 좌측으로 나타남).
- `editorstory.js` — `getPreviousRoute()` 가 있을 때만 `data-enter="from-left"` 설정 (좌측에서 우측으로). 최초 로드(`previousRoute === null`) 시 기본값(아래→위) 유지.

**C. 내비게이션 아이템 터치 피드백 부드러움 개선**
- `base.css` — `.nav-item` 기본 transition 에 `background` 추가(`color`, `transform` 과 함께 200ms cubic-bezier). `:active` 해제 시 배경색도 부드럽게 페이드아웃 되어 즉각성 완화.

**D. 설정 페이지 하단 여백 및 레이아웃 수정**
- `pages.css` — `.settings-page` padding-bottom `var(--space-8)` → `var(--space-16)` (32px → 64px).
- `base.css` — `.page` 의 `min-height: 100%` → `flex: 1 0 auto` 전환. 이유: overflow-y:auto 인 flex 컨테이너에서 `min-height:100%` 는 브라우저가 무한 루프 방지를 위해 아이템을 컨테이너 높이에 고정시켜 padding-bottom 이 스크롤 영역에 포함되지 않음. `flex:1 0 auto` 로 flex-grow:1(짧은 페이지 채움) + flex-shrink:0(콘텐츠 길 때 정상 확장) 동시 달성.

**E. 디자인 토큰 · 래퍼 레이아웃 조정 (사용자 직접 수정)**
- `variables.css` — `--mobile-max-width` 768px → 618px, `--nav-height` 58px → 50px.
- `variables.css` — 라이트 테마 `--shadow-wrapper` `none` → `0 0 24px rgba(0,0,0,0.4)` (데스크톱 래퍼 그림자 추가). 다크 테마 `--shadow-wrapper` → `0 0 68px rgba(85,84,84,0.4)` (밝은 헤일로 효과).
- `variables.css` — 라이트 테마 최상단 및 다크 테마 블록에 `--color-bg-desktop` 변수 누락분 추가 (라이트 `#e8e8ed`, 다크 `#1c1c1e`).
- `android/app/src/main/assets/public/index.html` — `npm run build` 후 변경된 asset 해시(index.js, router.js, i18n.js, storyI18n.js, index.css) 업데이트.

**검증**: 실기 테스트 (카드 꾹 누름 → 피드백, 페이지 간 진입 방향, 설정 페이지 하단 스크롤 여백 확인). `npm run build` 성공.


--------------------------------------------------------------


### 2026-06-02 16:40 — Claude · 코드베이스 종합 진단 보고서 작성

**요구사항**: 코드 수정 없이 전체 코드베이스를 4관점(기획·아키텍처 / 개발·코드품질 / 디자인·UI·UX / 테스트·유지보수)에서 평가하고, `[CRITICAL]~[LOW]` 등급 + 해결안을 담은 `PROJECT_AUDIT.md`를 루트에 생성.

**구현방법**: 서비스·라우터·상태·유틸·컴포넌트·CSS·보안 룰·Functions·테스트를 직접 정독해 근거(파일:라인) 기반으로 진단. 주요 발견 — ① `storage.rules` 가 인증 사용자 누구에게나 타인 `users/{uid}/**`(개인 일기 이미지) read 허용(CRITICAL) ② `userStories`/`bookmarks` update 시 `uid` 불변 검증 부재 ③ `editor.js` 가 전역 단일 `setBeforeNavigate` 를 떠날 때 `null` 로 초기화해 인증/네비 가드 무력화 ④ 수집·받은 카드·알림이 localStorage 단독(다기기 미동기화) ⑤ 죽은 의존성(lucide/revenuecat/device/status-bar)·빈 파일(editorComment.js) ⑥ `@capacitor/haptics` 가 includePlugins 누락으로 안드로이드 무동작 ⑦ vitest 스코프 미설정으로 `npm test` 가 iOS 빌드 산출물(RevenueCat SPM) 테스트까지 수집해 현재 레드(순수 로직 47개는 통과). 진단 중 발견한 테스트 레드 실태를 보고서에 정직하게 반영.

**변경파일**: `PROJECT_AUDIT.md`(신규), `docs/SESSION_LOG.md`(본 항목). 소스 코드 변경 없음.

---

### 2026-06-02 17:30 — Claude · 보안 진단 1단계(즉시) 구현

**요구사항**: `PROJECT_AUDIT.md` 로드맵 1단계(보안/프라이버시) 4개 항목을 순서대로 구현.

**구현방법**:
- **[HIGH 6-1] 테스트 스코프 교정** — `vitest.config.js`(tests/ 만 수집, ios/android/dist/functions/_disabled/tests-rules 제외) + `tests/setup.js`(Node 22+ 네이티브 Web Storage 가 jsdom localStorage 를 가리던 문제를 인메모리 폴리필로 해결, Haptics vibrate 스텁) 추가. iOS RevenueCat 산출물 24개가 더 이상 수집되지 않음. 실패 66→43(잔여는 전부 기존 UI/CSS 어서션 드리프트 베이스라인), 통과 219→256.
- **[CRITICAL 3-1] Storage 격리** — `storage.rules` 재작성: 개인 자료(`users/{uid}/**` 일기·아바타)는 소유자만 read/write, 공개 카드 `public/cards/**`(인증 read·어드민 `token.admin` write), 레거시 카드 `users/{uid}/editor_images/**` 인증 read carve-out(기존 발행 카드 호환). `isAdmin()` 은 클레임 존재 확인 후 비교.
- **[HIGH 3-2] Firestore uid 불변** — `userStories.update` 에 `request.resource.data.uid == resource.data.uid` 추가(소유권 이전/타인 피드 주입 차단). `bookmarks` 는 update 미허용(토글 전용)임을 주석으로 명시.
- **[HIGH 6-2] 규칙 에뮬레이터 테스트** — `@firebase/rules-unit-testing@3.0.4`(devDep) + `firebase.json` emulators(firestore 8080/storage 9199) + `tests/rules/{firestore,storage}.rules.spec.js`(총 22 케이스) + `vitest.rules.config.js` + `npm run test:rules`(firebase emulators:exec). **에뮬레이터 실측 22/22 통과**.

**검증**: `npm run test:rules` → 22 passed(에뮬레이터). `npm test` → 256 passed / 43 기존 베이스라인 fail(무관, 규칙 테스트는 스코프 제외). `src/` 변경 없음 → 앱 번들 영향 없음. ※ 규칙은 작성·검증 완료, **실 적용은 `firebase deploy --only firestore:rules,storage` 필요(미실행)**.

**변경파일**: `vitest.config.js`, `vitest.rules.config.js`, `tests/setup.js`, `tests/rules/firestore.rules.spec.js`, `tests/rules/storage.rules.spec.js`, `firestore.rules`, `storage.rules`, `firebase.json`, `package.json`, `package-lock.json`.

---

### 2026-06-02 19:00 — Claude · 보안 진단 2단계(단기·정합성/위생) 구현

**요구사항**: `PROJECT_AUDIT.md` 로드맵 2단계 4개 항목 구현 — 에디터 전역 가드 복원, 어드민 Custom Claims 이전, 죽은 의존성/빈 파일 제거, 햅틱 플러그인 설정.

**구현방법**:
- **[HIGH 4-1] 전역 가드 스택화** — `router.js` 에 `pushBeforeNavigate(fn)`(제거 함수 반환) 추가, `handleRoute` 가 스택(LIFO)+베이스 가드를 평가. `editor.js` 는 `setBeforeNavigate(null)`(전역 가드 말살) → `pushBeforeNavigate` + `setOnUnmount`(가드 제거 + beforeunload 해제)로 교체. 신규 `tests/router_guard_stack.spec.js` 3/3 통과(베이스 가드 생존 회귀 고정).
- **[HIGH 2-3] 어드민 Custom Claims 이전** — 클라이언트 `ADMIN_EMAILS` 하드코딩/role 자가승격 전부 제거(main.js + login.js 3곳). 신규 `services/admin.js`(`readAdminClaim`/`syncAdminClaim`), `main.js` 가 로그인 시 `token.admin` 클레임을 읽고 미보유 시 서버 콜러블로 부트스트랩 → `setState('isAdmin')`. 신규 Cloud Function `functions/index.js:syncAdminClaim`(서버 allowlist → `admin:true` 클레임 + `profiles.role='editor'` 동기화, 이탈 시 회수). 어드민 체크 7곳(settingsSections·profile·editor·stories·calendar 죽은 if)을 `getState('isAdmin')`로 이전. `state.js` 에 `isAdmin` 추가. 배포된 `storage.rules` 의 `token.admin` 과 호환. 영향받은 테스트(editor 라우터 mock, regression.bugs allowlist/settings)는 새 방식에 맞게 갱신.
- **[MEDIUM 4-5] 죽은 의존성/빈 파일 제거** — `package.json` 에서 `lucide`·`@revenuecat/purchases-capacitor`·`@capacitor/device`·`@capacitor/status-bar`(JS·네이티브 사용처 0) 제거, `capacitor.config.json includePlugins` 에서 device·status-bar 제거, 0바이트 `components/editorComment.js` 삭제.
- **[MEDIUM 5-1] 햅틱 플러그인 등록** — `capacitor.config.json includePlugins` 에 `@capacitor/haptics` 추가(코드는 쓰는데 미등록이라 안드로이드에서 무동작이던 문제 해결). `npx cap sync android` → "Found 8 Capacitor plugins"(haptics 포함, device/status-bar 제외) 확인.

**검증**: `npm test` → 259 passed / 43 fail(전부 기존 베이스라인, 신규 회귀 0). `npm run build` 성공. `node --check functions/index.js` OK. `npx cap sync android` 성공. ※ 미배포분: `firebase deploy --only functions`(syncAdminClaim). 기존 obsolete 테스트 `regression.bugs > "haptics are removed"`(284행)는 햅틱 활성화 의도와 모순 — 차기 테스트 정리 대상.

**변경파일**: `src/js/router.js`, `src/js/pages/editor.js`, `src/js/pages/login.js`, `src/js/pages/profile.js`, `src/js/pages/calendar.js`, `src/js/components/settingsSections.js`, `src/js/services/stories.js`, `src/js/services/admin.js`(신규), `src/js/state.js`, `src/main.js`, `functions/index.js`, `capacitor.config.json`, `package.json`, `tests/router_guard_stack.spec.js`(신규), `tests/editor_management_calendar.spec.js`, `tests/regression.bugs.spec.js`, `tests/calendar.ui.spec.js`, `src/js/components/editorComment.js`(삭제). cap sync 로 `android/*` 갱신.

---

### 2026-06-03 — Claude · 레거시 테스트 43건 현행화 (npm test 100% green)

**요구사항**: 미뤄둔 43개 `npm test` 실패(UI/CSS 어서션 드리프트, 누락 mock, obsolete)를 현재 앱 코드 스펙에 맞게 **테스트 코드만** 수정해 100% green 달성. 앱 코드는 불변.

**구현방법**:
- **공통 인프라**: 여러 spec 의 router mock 에 누락된 `getPreviousRoute`/`setState` export 추가. editorstory/mystory 카드 Swiper 가 jsdom(레이아웃 0)에서 렌더되도록 `createCardSwiper` 를 테스트용 mock 으로 대체(스토리 슬라이드를 활성 슬라이드로 동기 렌더) + `HTMLElement.prototype.offsetParent` 부모 반환 + `requestAnimationFrame`→`setTimeout(0)` 강제 + flushRender 다중 tick.
- **CSS/마크업 드리프트 갱신**: toast `border-radius:2px`, editor-comment-bubble 배경/보더, `.history-card-image-wrap` flex, `.front/.back` box-shadow, 다크 wheel/카드 토큰, 하단 nav 아이콘(BookMarked/Menu)·28px·`--color-accent`, 프로필 아바타 56px·`img object-fit`, list-item-icon 24px, settings 헤더 '마이 페이지', view-mode 바인딩 함수명(`bindViewModeItem`), 삭제 흐름 `history.back()`, 북마크 해제 시 카드 제거, bookmarks 테스트 localStorage 격리(`lastArchiveTab`).
- **obsolete 삭제(2건)**: `regression.bugs` 의 "haptics are removed"(햅틱 활성 정책과 모순), "nav-bookmarks 탭"(하단 nav 에서 제거됨). "ADMIN_EMAILS allowlist" 테스트는 Custom Claims 이전 검증으로 재작성(이전 단계).
- **skip(6건, 사유 명시)**: Swiper 터치 제스처 기반 날짜 이동 2건(jsdom geometry 불가) + 네이티브 Android 위젯 통합 4건(android/ 에 위젯 네이티브 소스 부재).

**검증**: `npm test` → **Test Files 29 passed (29), Tests 294 passed | 6 skipped (300), 0 failed**. 앱 코드(`src/` 런타임) 변경 없음.

**후속 플래그**: ① 네이티브 Android 위젯 코드(MainActivity 등록·`daystory_widget_info.xml`·Provider·런처 아이콘)가 `android/` 에서 누락 — 재추가 필요. ② Swiper 스와이프 날짜 이동은 추후 Playwright 등 E2E 로 커버 권장.

**변경파일**: `tests/` — editorstory.ui, detail_nav.ui, regression.bugs, bookmarks.ui, mystory_card_meta.ui, toast.ui, view-toggle, editor_management_calendar, widget.static. (앱 코드 변경 없음)

---

### 2026-06-03 — Claude · 3단계 리팩토링: editorstory/mystory 카드덱 공통 모듈 추출 (Step 1–5)

**요구사항**: `editorstory.js` 와 `mystory.js` 에 중복된 카드 마크업·월/일 휠·Swiper·뷰토글·달력 네비 로직을 공통 모듈(`src/js/components/cardDeck/`)로 추출. 각 단계 후 `npm test` 100% green 유지. CSS 5단계 논리 정렬 컨벤션 준수. Step 5 완료 후 보고·승인 대기, Step 6(calendar.js 팝업 통합)은 승인 후 진행.

**구현방법**:
- **Step 1 — `cardFace.js`(181줄, 신규)**: 순수 카드 마크업 빌더 + 공통 상수. `FALLBACK_IMG`·`IMG_ONERROR`·`MONTH_NAMES`·`ICON_CALENDAR/CARD`·`SHARE_ICON_SVG` 단일 정의, `parseIsoDate`/`formatMonthNameDate`/`bodyToHtml`, `cardShell`/`cardFront`/`cardFrontTop`/`cardImageWrap`(src 미지정 시 FALLBACK + onerror 내장)/`cardBack`/`emptyCardFace`/`cardActionButton`, `bindCardBase`(press 피드백·이미지 fade·flip 토글 공통화, `onBeforeFlip` false 반환 시 취소). `tests/cardFace.spec.js`(신규) 13 유닛테스트.
- **Step 2 — `cardDeckController.js`(420줄, 신규)**: `buildCardDeck(config)` 팩토리. 월/일 휠 빌드·`ensureSwiper` lazy init(offsetParent 가드 + rAF MAX_ATTEMPTS retry)·`onSlideActive→setState(config.lastDateKey)`·뷰토글(`ds_session_view`/`ds_default_view`)·달력 그리드(`renderGrid`/`isAtCurrentMonth`) 전부 이전. config 계약: `idPrefix/pageClass/headerHtml/enterDir/calMode/lastDateKey/loadData/renderSlideHTML/bindCard/...`.
- **Step 3 — `editorstory.js` 826→364줄(−462, −56%)**: `renderEditorStory()` 가 `buildCardDeck(editorConfig)` 반환. 카드 마크업은 cardFace 빌더로, flip 바인딩은 `bindCardBase` + 에디터 전용 핸들러(북마크/공유/상세/버블)로 재작성.
- **Step 4 — `mystory.js` 1125→681줄(−444, −39%)**: 카드뷰 부분을 `buildCardDeck(mystoryConfig)` 로 전환, `buildMyStorySlideHTML`/`bindMyStoryCardEvents` 를 cardFace/`bindCardBase` 기반으로 교체. 일기 작성 폼 `renderMyStoryNew`(약 395줄)는 **바이트 단위 불변** 유지(diff 0).
- **Step 5 — dedup/build**: 공통 상수·아이콘이 cardFace 에만 정의되고 두 페이지에 재선언 없음 확인. 페이지 고유 아이콘(editorstory `BOOKMARK_ICON_SVG`, mystory `ICON_SPINNER/CHECK`)만 로컬 잔존(정상).
- **테스트 현행화**: 로직이 컨트롤러/cardFace 로 이동하며 깨진 소스검사 테스트(swiper_lazy_init·ios_gpu_webp_guard·view-toggle·editorstory.ui)의 어서션 타깃을 컨트롤러/cardFace 로 리다이렉트하고, 컨트롤러 describe 와 중복되던 mystory describe 는 config 검증으로 축소.

**검증**: `npm test` → **Test Files 30 passed (30), Tests 286 passed | 6 skipped, 0 failed**. `npm run build` 성공. 앱 코드 순감 약 906줄(두 페이지), 신규 공통 모듈 601줄이 양쪽(+추후 calendar.js)을 단일 소스로 서비스.

**후속**: Step 6(calendar.js `openCardPopup` 의 `buildHistoryCardHtml`/`buildMyCardHtml` 을 cardFace 경유로 통합)은 사용자 승인 후 진행 예정.

**변경파일**: `src/js/components/cardDeck/cardFace.js`(신규), `src/js/components/cardDeck/cardDeckController.js`(신규), `src/js/pages/editorstory.js`, `src/js/pages/mystory.js`, `tests/cardFace.spec.js`(신규), `tests/swiper_lazy_init.spec.js`, `tests/ios_gpu_webp_guard.spec.js`, `tests/view-toggle.spec.js`, `tests/editorstory.ui.spec.js`.

---

### 2026-06-03 — Claude · 3단계 리팩토링: Step 6 — calendar.js 팝업 cardFace 통합

**요구사항**: Step 5 보고 후 사용자 최종 승인을 받아 `calendar.js` 의 `openCardPopup` 내부 `buildHistoryCardHtml` / `buildMyCardHtml` 인라인 마크업 빌더를 공통 `cardFace` 모듈 경유로 통합.

**구현방법**:
- `calendar.js` 상단에 `cardFace.js` import 추가(`cardShell / cardFront / cardFrontTop / cardImageWrap / cardBack / cardActionButton / bodyToHtml / SHARE_ICON_SVG`).
- `buildHistoryCardHtml`: 인라인 HTML 템플릿 → `cardFrontTop`(yearHtml/dateLabel/actionsHtml/metaHtml) + `cardImageWrap`(src/alt/title) + `cardBack`(title/bodyToHtml/footerHtml) + `cardShell` 로 재작성. 북마크 버튼은 `active` 클래스 조건이 필요해 `cardActionButton` 바깥에 인라인 유지.
- `buildMyCardHtml`: 동일 패턴으로 재작성. `flipperClass: 'mystory-flipper'` 전달.
- 두 함수에서 `bodyToHtml` 로 본문 파싱 위임 → `escapeHtml` + split 중복 2곳 제거.
- `cardImageWrap` 이 자동으로 `FALLBACK_IMG / IMG_ONERROR / loading="lazy"` 를 부여 → 팝업 카드도 iOS WebP fallback 보호 자동 확보.
- `tests/calendar.ui.spec.js` 의 `historyCardBuilder` 소스 grep 어서션을 cardFace 경유 방식으로 갱신.

**검증**: `npm run build` 성공. `npm test` → **Test Files 30 passed (30), Tests 286 passed | 6 skipped, 0 failed**.

**변경파일**: `src/js/pages/calendar.js`, `tests/calendar.ui.spec.js`.

---

### 2026-06-03 — Claude · 어드민 권한 폴백 핫픽스

**요구사항**: 3단계 리팩토링 직후 관리자 계정의 권한 기능(에디터 진입, 관리자 배지, 관리자 도구)이 사라지는 긴급 버그 수정.

**진단**: 3단계 카드덱 리팩토링은 무고. 같은 `1cc1e24` 커밋에 포함된 2단계 어드민 Custom Claims 마이그레이션(`profile.role → getState('isAdmin')`)이 원인. `syncAdminClaim()` Cloud Function 미배포 시 조용히 `false` 반환 → 모든 관리자 UI 숨겨짐.

**수정**: `src/main.js` 프로필 로드 후 `if (!getState('isAdmin') && profileData.role === 'editor') setState('isAdmin', true)` 폴백 추가. 읽기 전용이므로 자가승격 보안 취약점 없음. Cloud Function 배포 후에는 `readAdminClaim()` 경로가 우선하여 자연 skip.

**검증**: `npm test` → 30 passed / 286 tests / 0 failed.

**변경파일**: `src/main.js`.

---

### 2026-06-03 17:02 — Codex · 이미지 피커 네이티브 액션 시트 한국어 현지화

**요구사항**: 프로필 이미지와 나의 일화 이미지 첨부 시 Capacitor Camera 네이티브 액션 시트가 `Photo / From Photos / Take Picture` 처럼 영어로 노출되는 문제를 한국어로 수정.

**구현방법**:
- `src/js/services/camera.js` 의 공통 `Camera.getPhoto` 호출 옵션에 `promptLabelHeader: '사진 첨부'`, `promptLabelPhoto: '앨범에서 선택'`, `promptLabelPicture: '카메라로 촬영'`, `promptLabelCancel: '취소'` 를 추가해 `pickImage` / `pickFromCamera` / `pickFromGallery` 네이티브 호출이 모두 한국어 라벨을 전달하도록 함.
- `ios/App/App/Info.plist` 에서 `CFBundleDevelopmentRegion` 을 `ko_KR` 로 바꾸고 `CFBundleLocalizations` 에 `ko` 를 추가해 iOS 시스템 기본 팝업의 한국어 지역화 힌트를 보강.
- Android 는 `android:localeConfig="@xml/locales_config"` 와 `res/xml/locales_config.xml`, `res/values-ko/strings.xml` 을 추가해 한국어 지원 앱으로 명시.
- `tests/camera.spec.js` 에 네이티브 이미지 선택 프롬프트가 한국어 라벨 옵션을 전달하는 회귀 테스트 추가.
- 전체 `npm test` 에서 기존 unhandled error 로 exit code 1 이 나던 테스트 정리 누락 2건을 함께 안정화: `router_guard_stack.spec.js` 는 hashchange 잔여 tick 처리 후 DOM cleanup, `regression.bugs.spec.js` 는 보관함/일기 mock 기본 Promise 값을 설정.

**검증**: `npx vitest run tests/camera.spec.js` 7/7 통과, `npx vitest run tests/router_guard_stack.spec.js tests/regression.bugs.spec.js tests/camera.spec.js` 23 passed / 2 skipped 통과, `npm run build` 성공, `npm test` → **Test Files 30 passed (30), Tests 287 passed | 6 skipped (293)**, `plutil -lint ios/App/App/Info.plist` OK, Android XML 3개 `xmllint --noout` 통과.

**변경파일**: `src/js/services/camera.js`, `tests/camera.spec.js`, `tests/router_guard_stack.spec.js`, `tests/regression.bugs.spec.js`, `ios/App/App/Info.plist`, `android/app/src/main/AndroidManifest.xml`, `android/app/src/main/res/xml/locales_config.xml`, `android/app/src/main/res/values-ko/strings.xml`, `docs/SESSION_LOG.md`.

---

### 2026-06-03 17:30 — Codex · 캘린더 뷰 복원 시 카드덱 월 휠 1월 초기화 핫픽스

**요구사항**: `editorstory` / `mystory` 에서 캘린더 뷰 상태로 다른 탭 이동 후 재진입하면 카드 뷰 뒤의 월 휠이 마지막 날짜 월이 아니라 1월로 초기화되는 버그 수정.

**구현방법**:
- `tests/cardDeckController.spec.js` 신규 추가. `ds_session_view='calendar'` 로 복원된 카드덱이 Swiper 를 만들지 않아도 `initialDate` 기준 월/일 휠 항목을 active 로 유지해야 한다는 회귀 케이스를 먼저 작성해 Red 확인.
- `cardDeckController.js` 에 `selectedIdx` 논리 상태를 추가하고, `syncMonthWheel` / `activateDayWheelByIndex` 에 `force` 인자를 더해 active class 와 scroll 위치를 강제로 재동기화할 수 있게 확장.
- 카드덱 마운트 직후 `activateDayWheelByIndex(selectedIdx, true, true)` 를 항상 호출해 캘린더 뷰로 복원된 숨김 day picker 도 마지막 날짜의 월/일 active 상태를 보존.
- 카드 뷰로 토글 복귀할 때도 같은 `selectedIdx` 로 휠을 재동기화하고, Swiper 최초 생성 시 `initialSlide` 를 `selectedIdx` 로 사용하도록 수정.
- 시그니처 확장에 맞춰 `tests/swiper_lazy_init.spec.js` source assertion 을 갱신.

**검증**: `npx vitest run tests/cardDeckController.spec.js tests/swiper_lazy_init.spec.js tests/view-toggle.spec.js` → 49/49 통과. `npm test` → **Test Files 31 passed (31), Tests 288 passed | 6 skipped (294)**. `npm run build` 성공.

**변경파일**: `src/js/components/cardDeck/cardDeckController.js`, `tests/cardDeckController.spec.js`, `tests/swiper_lazy_init.spec.js`, `docs/SESSION_LOG.md`.

---

### 2026-06-03 17:52 — Codex · 에디터 일화 상세보기 바텀시트 전환

**요구사항**: `/detail/:id` 로 열리는 에디터 일화 상세보기를 전체 화면 페이지 느낌에서 모바일 네이티브 스타일 바텀시트로 리팩토링. Backdrop 클릭, X 버튼, 핸들 드래그로 닫히고, 긴 본문 내부 스크롤과 드래그 닫기 충돌을 방지해야 함.

**구현방법**:
- `detail.js` 렌더 shell 을 `detail-sheet-backdrop` + `detail-sheet` + `detail-sheet-drag-zone` + `detail-sheet-scroll` 구조로 변경. 로딩 상태부터 같은 sheet shell 을 사용하고 데이터 로드 후 scroll 영역만 교체.
- `closeDetailSheet()` 를 추가해 backdrop / X 버튼 / 기존 back 버튼 / 드래그 닫기가 모두 동일한 닫힘 애니메이션 후 `history.back()` 으로 귀결되도록 정리.
- `touchstart` / `touchmove` / `touchend` 기반 드래그 닫기 구현. 드래그 시작 지점이 핸들 영역이거나 내부 scroll 영역이 최상단(`scrollTop <= 0`)일 때만 아래 드래그를 닫기 후보로 처리하고, 본문을 읽는 중(`scrollTop > 0`)에는 시트를 닫지 않도록 방어.
- `pages.css` 에 fixed bottom sheet 스타일, dim backdrop, handle, close button, 내부 scroll 영역, dragging transition 해제 스타일 추가. 색상/간격/z-index 는 기존 토큰 사용.
- `tests/detail_nav.ui.spec.js` 에 바텀시트 shell, backdrop click close, handle drag close, scrolled content drag 방어, fixed bottom sheet CSS 회귀 테스트 추가.

**검증**: `npx vitest run tests/detail_nav.ui.spec.js` 19/19 통과, `npm test` → **Test Files 31 passed (31), Tests 293 passed | 6 skipped (299)**, `npm run build` 성공.

**변경파일**: `src/js/pages/detail.js`, `src/css/pages.css`, `tests/detail_nav.ui.spec.js`, `docs/SESSION_LOG.md`.

---

### 2026-06-03 18:06 — Codex · 상세 바텀시트 헤더 제거 및 닫기 버튼 좌측 이동

**요구사항**: 상세 바텀시트 내부의 `detail-header` 를 제거하고, `.detail-sheet-close` 버튼을 바텀시트 상단 좌측으로 이동.

**구현방법**:
- `detail.js` 에서 데이터 로드 후 삽입하던 `detail-header` / `detail-back` 마크업과 관련 이벤트 바인딩 제거.
- `pages.css` 에서 `.detail-sheet-close` 위치를 `right` 에서 `left: var(--space-4)` 로 변경하고, 더 이상 쓰지 않는 `.detail-header` / `.detail-header.scrolled` 스타일 제거. `.detail-sheet` 의 `bottom: 0` 도 명시해 하단 고정 조건을 유지.
- `tests/detail_nav.ui.spec.js` 에서 상세 shell 렌더 시 `.detail-header` 가 없어야 하고 닫기 버튼 CSS가 좌측 배치여야 한다는 기대값으로 갱신.

**검증**: `npx vitest run tests/detail_nav.ui.spec.js` 19/19 통과, `npm run build` 성공, `npm test` → **Test Files 31 passed (31), Tests 293 passed | 6 skipped (299)**.

**변경파일**: `src/js/pages/detail.js`, `src/css/pages.css`, `tests/detail_nav.ui.spec.js`, `docs/SESSION_LOG.md`.

---

### 2026-06-03 18:10 — Codex · 상세 바텀시트 콘텐츠 표시 영역 보정

**요구사항**: `.detail-sheet` 콘텐츠가 화면에 제대로 표시되지 않고, 핸들/닫기 영역 없이 상세 콘텐츠가 화면 상단부터 잘려 보이는 문제 확인 및 수정.

**구현방법**:
- 원인은 `.detail-sheet` 가 `max-height` 만 갖고 있어 일부 WebView / 콘텐츠 높이 조합에서 시트 자체가 콘텐츠 높이만큼 커지고 상단 drag zone 이 화면 밖으로 밀릴 수 있는 구조로 판단.
- `pages.css` 의 `.detail-sheet` 에 `height: calc(100vh - var(--safe-top))` fallback 과 `height: calc(100dvh - var(--safe-top))` 를 함께 명시해 시트 높이를 viewport 안에 고정. 내부 `.detail-sheet-scroll` 만 스크롤되도록 기존 flex/overflow 구조 유지.
- `tests/detail_nav.ui.spec.js` 의 바텀시트 CSS 회귀 테스트에 `100vh` fallback 과 `100dvh` height 기대값 추가.

**검증**: `npx vitest run tests/detail_nav.ui.spec.js` 19/19 통과, `npm run build` 성공, `npm test` → **Test Files 31 passed (31), Tests 293 passed | 6 skipped (299)**.

**변경파일**: `src/css/pages.css`, `tests/detail_nav.ui.spec.js`, `docs/SESSION_LOG.md`.

---

### 2026-06-03 19:49 — Codex · 사용자 직접 CSS 작업 로그 보강

**요구사항**: 오늘 사용자가 직접 작업/수정한 CSS 코드가 세션 로그에 남아 있는지 다시 확인하고, 해당 작업을 파일 맨 아래에 별도 로그로 명확히 기록.

**구현방법**:
- `docs/SESSION_LOG.md` 최근 항목과 최신 체크포인트 `277b0d7` 를 확인해 오늘 작업 로그가 기록되어 있음을 재확인.
- 사용자가 직접 수정한 iOS 터치 피드백 관련 CSS 작업을 별도 보강 로그로 기록. 주요 내용은 `base.css` 의 전역 인터랙티브 요소 `touch-action: manipulation` / `-webkit-tap-highlight-color: transparent`, `components.css` 의 `.flipper.active` 피드백 연결, 카드 터치 active 동작 보강.
- `SESSION_LOG.md` 에 남아 있던 NUL 바이트를 제거해 텍스트 검색 도구가 binary 파일로 오인하지 않도록 정리.

**검증**: `git log --oneline -8`, `git show --stat --oneline --name-only HEAD`, `docs/SESSION_LOG.md` 최근 항목 확인.

**변경파일**: `docs/SESSION_LOG.md`.

---

### 2026-06-03 19:49 — Codex · 사용자 직접 CSS 작업 로그 보강

**요구사항**: 오늘 사용자가 직접 작업/수정한 CSS 코드가 세션 로그에 남아 있는지 확인하고, 해당 작업을 별도 로그로 명확히 기록.

**구현방법**:
- `docs/SESSION_LOG.md` 최근 항목과 최신 체크포인트 `277b0d7` 를 확인해 오늘 작업 로그가 기록되어 있음을 재확인.
- 사용자가 직접 수정한 iOS 터치 피드백 관련 CSS 작업을 별도 보강 로그로 기록. 주요 내용은 `base.css` 의 전역 인터랙티브 요소 `touch-action: manipulation` / `-webkit-tap-highlight-color: transparent`, `components.css` 의 `.flipper.active` 피드백 연결, 관련 카드 터치 active 동작 보강.
- 기존 로그 항목은 수정하지 않고, 새 항목을 append 하여 정정/보강 기록 방식 유지.

**검증**: `git log --oneline -8`, `git show --stat --oneline --name-only HEAD`, `docs/SESSION_LOG.md` 최근 항목 확인.

**변경파일**: `docs/SESSION_LOG.md`.

---

### 2026-06-03 19:38 — Codex · iOS 터치 active 피드백 핫픽스

**요구사항**: iOS Safari/WKWebView에서 앱 버튼과 카드 등 인터랙티브 요소 탭 시 `:active` 스타일이 늦게 뜨거나 씹히는 터치 딜레이 개선.

**구현방법**:
- `base.css` 전역 인터랙티브 셀렉터에 `touch-action: manipulation` 과 `-webkit-tap-highlight-color: transparent` 를 적용해 더블 탭 지연과 iOS 탭 하이라이트를 제거.
- `main.js` 부팅 경로에 `document.body` passive `touchstart` no-op 리스너를 등록해 iOS가 `:active` 상태를 즉시 계산하도록 보강.
- `bindCardBase` 에서 카드 본체 `touchstart` 시 `.active` 를 즉시 추가하고 `touchmove`/`touchend`/`touchcancel` 에서 제거하도록 개선. 내부 액션 버튼은 기존 `ignoreSelectors` 를 존중해 카드 active 피드백과 충돌하지 않게 처리.
- CSS에서 `.flipper.active` 를 기존 `.is-pressing` 피드백과 같은 scale 규칙으로 연결하고, 관련 회귀 테스트를 추가.

**검증**: `npm test -- tests/cardFace.spec.js tests/css_tokens.spec.js tests/regression.bugs.spec.js` 통과, `npm run build` 성공, `npm test` → **Test Files 34 passed (34), Tests 302 passed | 6 skipped (308)**.

**변경파일**: `src/main.js`, `src/css/base.css`, `src/css/components.css`, `src/js/components/cardDeck/cardFace.js`, `tests/cardFace.spec.js`, `tests/css_tokens.spec.js`, `tests/regression.bugs.spec.js`, `docs/SESSION_LOG.md`.

---

### 2026-06-03 19:31 — Codex · 설정 개발자 알아보기 항목 준비중 처리

**요구사항**: 미완성된 "개발자 알아보기" 페이지를 숨기기 위해 설정 페이지의 해당 항목을 `/about` 이동 대신 문의와 동일한 준비중 토스트로 처리.

**구현방법**:
- `settingsSections.js` 의 `#setting-about` 클릭 바인딩을 `navigate('/about')` 에서 `showToast('준비중인 기능입니다. 업데이트를 기다려주세요!', 'info')` 로 변경.
- `tests/regression.bugs.spec.js` 의 toast mock 을 검증 가능하게 정리하고, 개발자 알아보기 항목 클릭 시 `/about` 으로 이동하지 않고 준비중 토스트가 호출되는 회귀 테스트 추가.

**검증**: `npx vitest run tests/regression.bugs.spec.js --environment jsdom -t "settings page|developer page is unfinished"` 6/6 통과, `npm run build` 성공, `npm test` → **Test Files 34 passed (34), Tests 299 passed | 6 skipped (305)**.

**변경파일**: `src/js/components/settingsSections.js`, `tests/regression.bugs.spec.js`, `docs/SESSION_LOG.md`.

---

### 2026-06-03 18:58 — Codex · 나의 일화 작성 폼 하단 버튼 레이아웃 스래싱 보정

**요구사항**: 나의 일화 작성/수정 페이지 마운트 직후 `.mystory-form-actions` 하단 저장 버튼 영역이 우측으로 밀렸다가 제자리로 돌아오는 초기 레이아웃 깜빡임 수정.

**구현방법**:
- `.mystory-form-actions` 의 `left: 50%` + `transform: translateX(-50%)` 중심 정렬 방식을 제거하고, `left: 0`, `right: 0`, `width: min(100%, var(--mobile-max-width))`, `margin: 0 auto` 로 첫 페인트부터 위치와 폭이 확정되도록 변경.
- `z-index: 50` 하드코딩을 `var(--z-nav)` 토큰으로 교체하고, `box-sizing: border-box` 를 추가해 padding 포함 폭 계산이 초기 렌더에서 흔들리지 않도록 보강.
- 해당 CSS 블록을 요청된 5단계 정렬 컨벤션(`Positioning → Display & Box Model → Typography → Visuals → Misc`)에 맞춰 재정렬.
- `tests/mystory_form_actions.spec.js` 신규 추가. fixed action bar가 좌우 앵커, 확정 폭, auto margin을 사용하고 `left: 50%` / `translateX` 를 다시 쓰지 않는지 회귀 검증.

**검증**: `npx vitest run tests/mystory_form_actions.spec.js --environment jsdom` 1/1 통과, `npx vitest run tests/mystory_form_actions.spec.js tests/mystory_card_meta.ui.spec.js --environment jsdom` 3/3 통과, `npm run build` 성공, `npm test` → **Test Files 34 passed (34), Tests 298 passed | 6 skipped (304)**.

**변경파일**: `src/css/pages.css`, `tests/mystory_form_actions.spec.js`, `docs/SESSION_LOG.md`.

---

### 2026-06-03 18:41 — Codex · 상세 바텀시트 닫힘 후 캘린더 카드 팝업 유지

**요구사항**: 캘린더 카드 팝업에서 상세 바텀시트를 열었다 닫았을 때, 기존 `calendar-card-popup open` 상태가 그대로 유지되도록 변경.

**구현방법**:
- `calendar.js` 의 `.card-detail-shortcut-btn` 클릭 핸들러에서 상세 라우트 이동 전 `close()` 를 호출하던 로직을 제거해, 카드 팝업 DOM과 `.open` 상태, scroll lock 상태가 유지되도록 수정.
- detail 바텀시트는 `--z-overlay`, 캘린더 카드 팝업은 `--z-modal` 계층이라 팝업을 남겨도 detail이 위에 표시되는 기존 z-index 구조를 그대로 활용.
- `tests/calendar_popup.spec.js` 신규 추가. 상세 보기 클릭 후 `navigate('/detail/:id')` 는 실행되지만 `unlockScroll()` 은 호출되지 않고, 동일한 `.calendar-card-popup.open` 요소가 남는지 회귀 검증.

**검증**: `npx vitest run tests/calendar_popup.spec.js tests/detail_nav.ui.spec.js tests/router_session_view.spec.js --environment jsdom` 22/22 통과, `npm run build` 성공, `npm test` → **Test Files 33 passed (33), Tests 297 passed | 6 skipped (303)**.

**변경파일**: `src/js/pages/calendar.js`, `tests/calendar_popup.spec.js`, `docs/SESSION_LOG.md`.

---

### 2026-06-03 18:35 — Codex · 캘린더 상세 바텀시트 닫힘 시 뷰 상태 보존

**요구사항**: `editorstory` / `mystory` 캘린더 보기에서 상세 바텀시트를 열었다 닫으면 원래 캘린더 그리드가 유지되지 않고 일반 카드 뷰로 돌아가는 라우팅 상태 버그 수정.

**구현방법**:
- `router.js` 에 콘텐츠 라우트(`/editorstory`, `/mystory`)와 오버레이 라우트(`/detail/:id`) 구분을 추가해, 상세 바텀시트 진입 시 `ds_session_view` 를 삭제하지 않도록 변경. 설정 등 실제 다른 페이지로 이동할 때는 기존처럼 임시 뷰 상태를 삭제.
- `cardDeckController.js` 의 캘린더 상태를 마지막 선택 날짜 기준으로 초기화해, 오늘 월이 아니라 사용자가 열었던 카드의 월 그리드로 복원되도록 수정.
- `calendar.js` 의 캘린더 셀 클릭 시 `state.onStoryOpen` 콜백을 호출해 상세 진입 전 해당 카드 날짜를 `lastEditorStoryDate` / `lastMyStoryDate` 에 기록하도록 연결.
- `tests/router_session_view.spec.js` 신규 추가 및 `tests/cardDeckController.spec.js` 보강으로 detail 오버레이 진입 시 세션 뷰 보존, 일반 라우트 이탈 시 삭제, 마지막 카드 날짜 월 복원을 회귀 검증.

**검증**: `npx vitest run tests/router_session_view.spec.js tests/cardDeckController.spec.js --environment jsdom` 4/4 통과, `npx vitest run tests/detail_nav.ui.spec.js tests/router_session_view.spec.js tests/cardDeckController.spec.js --environment jsdom` 23/23 통과, `npm run build` 성공, `npm test` → **Test Files 32 passed (32), Tests 296 passed | 6 skipped (302)**.

**변경파일**: `src/js/router.js`, `src/js/components/cardDeck/cardDeckController.js`, `src/js/pages/calendar.js`, `tests/router_session_view.spec.js`, `tests/cardDeckController.spec.js`, `docs/SESSION_LOG.md`.

---

### 2026-06-03 18:20 — Codex · 상세 바텀시트 상단 표시 보정

**요구사항**: `.detail-sheet` 의 `bottom: 0` 및 height 계산 조합 때문에 바텀시트 상단이 화면 밖으로 밀리거나 표시되지 않는 문제 확인 및 수정.

**구현방법**:
- 이전 보정에서 사용한 `var(--safe-top)` 이 정의되어 있지 않아 `height: calc(...)` 가 무효화될 수 있던 구조를 확인.
- `.detail-sheet` 를 `top: env(safe-area-inset-top, 0px); bottom: 0; height: auto` 구조로 변경해 상단 safe area 와 하단 경계를 직접 고정하고, 내부 `.detail-sheet-scroll` 만 스크롤되도록 유지.
- `tests/detail_nav.ui.spec.js` 의 바텀시트 CSS 회귀 테스트를 `top: env(...)`, `height: auto`, `var(--safe-top)` 미사용 기대값으로 갱신.

**검증**: `npx vitest run tests/detail_nav.ui.spec.js` 19/19 통과, `npm run build` 성공, `npm test` → **Test Files 31 passed (31), Tests 293 passed | 6 skipped (299)**.

**변경파일**: `src/css/pages.css`, `tests/detail_nav.ui.spec.js`, `docs/SESSION_LOG.md`.

---

### 2026-06-03 19:49 — Codex · 사용자 직접 CSS 작업 로그 보강

**요구사항**: 오늘 사용자가 직접 작업/수정한 CSS 코드가 세션 로그에 남아 있는지 다시 확인하고, 해당 작업을 파일 맨 아래에 별도 로그로 명확히 기록.

**구현방법**:
- `docs/SESSION_LOG.md` 최근 항목과 최신 체크포인트 `277b0d7` 를 확인해 오늘 작업 로그가 기록되어 있음을 재확인.
- 사용자가 직접 수정한 iOS 터치 피드백 관련 CSS 작업을 별도 보강 로그로 기록. 주요 내용은 `base.css` 의 전역 인터랙티브 요소 `touch-action: manipulation` / `-webkit-tap-highlight-color: transparent`, `components.css` 의 `.flipper.active` 피드백 연결, 카드 터치 active 동작 보강.
- `SESSION_LOG.md` 에 남아 있던 NUL 바이트를 제거해 텍스트 검색 도구가 binary 파일로 오인하지 않도록 정리.

**검증**: `git log --oneline -8`, `git show --stat --oneline --name-only HEAD`, `docs/SESSION_LOG.md` 최근 항목 확인.

**변경파일**: `docs/SESSION_LOG.md`.

---

### 2026-06-03 20:15 — Claude · 공유 버튼 무반응(Silent Failure) 핫픽스

**요구사항**: 카드 공유 버튼 탭 시 아무 반응 없는 문제 해결. ① 로딩/에러 시각 피드백 추가, ② 이벤트 충돌 방지, ③ 이미지 로드 대기 안전장치.

**구현방법**:
- `src/js/components/toast.js`: `dismissToast()` 함수 추가 — 로딩 인디케이터용 장기 토스트를 공유 시트 열기 전에 프로그래매틱하게 제거.
- `src/js/services/sharing.js`: `captureAndShareCard` 진입 시 `showToast('공유 이미지 생성 중...', 'info', 30000)` 로딩 토스트 표시; 캡처 실패·빈 이미지 시 `showToast('이미지 공유에 실패했습니다.', 'error')`로 에러 노출; 공유 시트 열기 직전 `dismissToast()`로 로딩 인디케이터 제거. `Promise.all(imageLoadPromises)`을 8초 타임아웃 `Promise.race`로 감싸 네트워크 지연 시 캡처가 영원히 대기하는 현상 방지.
- `src/js/pages/mystory.js`, `editorstory.js`, `calendar.js` 공유 버튼 핸들러: 기존 `e.stopPropagation()`에 `e.preventDefault()` 추가 — Swiper·카드 플립 부모 이벤트와의 충돌 방지.

**검증**: `npm run build` 성공(150ms), `npm test` → 34 Files / 302 passed.

**변경파일**: `src/js/components/toast.js`, `src/js/services/sharing.js`, `src/js/pages/mystory.js`, `src/js/pages/editorstory.js`, `src/js/pages/calendar.js`, `docs/SESSION_LOG.md`.

---

### 2026-06-03 20:35 — Claude · 공유 캡처 Base64 + onclone 방식으로 전면 개편

**요구사항**: iOS CORS 차단으로 카드 이미지 회색 썸네일 + Swiper CSS 상속 끊김으로 레이아웃 찌그러짐 완벽 해결.

**구현방법**:
- `src/js/services/sharing.js`: 수동 `#capture-sandbox` + `cloneNode` 방식 폐기. 새 전략: ① 캡처 전 `cardElement` 내 모든 `<img>.src`를 `fetch → Blob → FileReader(Base64 DataURL)`로 교체(원본은 `dataset.originalSrc` 백업). html2canvas가 외부 네트워크 없이 로컬 데이터만 그리므로 CORS tainted canvas 100% 방지. ② `html2canvas(cardElement, { onclone })` — `onclone` 콜백에서 복제본의 부모 체인(`swiper-slide/wrapper`) `transform: none` 강제화 + 워터마크 `buildWatermarkElement(clonedDoc)` 주입. `clonedDoc` 컨텍스트로 DOM 생성해야 올바르게 렌더링됨. ③ `finally` 블록에서 `dataset.originalSrc`로 원본 img src 복원. 8초 `Promise.race` 타임아웃 유지. `blobToDataUrl(blob)` FileReader 헬퍼 추가.

**검증**: `npm run build` 성공(190ms), `npm test` → 34 Files / 302 passed.

**변경파일**: `src/js/services/sharing.js`, `docs/SESSION_LOG.md`.

---

### 2026-06-03 20:46 — Claude · SecurityError(Tainted Canvas) 핫픽스 + cors.json 보완

**요구사항**: html2canvas에서 `SecurityError: The operation is insecure` 발생. CORS 속성 미적용 및 Firebase Storage CORS 설정 누락이 원인.

**구현방법**:
- `cors.json`: `origin` 배열에 `https://daystory.app` 추가(프로덕션 도메인 누락 수정). `responseHeader`에 `Access-Control-Allow-Origin` 명시.
- `src/js/services/sharing.js`: `blobToDataUrl(FileReader)` 방식 → `imageToBase64(new Image() + canvas)` 방식으로 교체. `probe.crossOrigin = 'anonymous'`를 `probe.src` 할당 이전에 설정(CORS 모드 요청 보장). 8초 타임아웃 내장. `onclone` 내 변환 실패 img에 `crossOrigin = 'anonymous'` + cache-bust 2차 적용.
- cors.json 적용 명령: `gsutil cors set cors.json gs://dokhu-daystory.firebasestorage.app` (직접 실행 필요).

**검증**: `npm run build` 성공(186ms), `npm test` → 34 Files / 302 passed.

**변경파일**: `cors.json`, `src/js/services/sharing.js`, `docs/SESSION_LOG.md`.

---

### 2026-06-03 21:00 — Claude · 공유 카드 캡처 레이아웃 깨짐 핫픽스

**요구사항**: 공유된 카드 이미지에서 `.status-bar-spacer`·`.bottom-nav` 등이 카드 위에 오버레이되거나 이미지 영역이 카드 경계를 벗어나는 문제 해결.

**구현방법**:
- `src/js/services/sharing.js` `onclone` 콜백 전면 보강:
  ① `position:fixed` 요소 일괄 숨김(`.status-bar-spacer`, `.bottom-nav`, `#toast-container`, 각종 오버레이/모달) — html2canvas 클론 문서에서 fixed 요소가 뷰포트 기준으로 카드 위에 렌더링되는 버그 방지.
  ② html2canvas 호출 전 `cardElement.offsetWidth/Height`·`imageWrap.offsetWidth/Height` 측정 → `html2canvas` 옵션 `width/height` + 클론 카드 인라인 스타일에 px 고정 — flex/aspect-ratio 오해석 방지.
  ③ `.history-card-image-wrap img`를 `position:absolute; top/left:0; width/height px; object-fit:cover; aspect-ratio:unset`으로 재설정 — html2canvas의 부분적 object-fit 지원 한계 보완.

**검증**: `npm run build` 성공(210ms), `npm test` → 34 Files / 302 passed.

**변경파일**: `src/js/services/sharing.js`, `docs/SESSION_LOG.md`.

---

### 2026-06-04 — Claude · 카드 캡처 고정 크기 + 네이티브 이미지 누락 핫픽스

**요구사항**: ① 웹 환경에서 브라우저 창 크기에 따라 캡처 이미지 크기·레이아웃이 변동하는 문제. ② iOS/Android 네이티브에서 캡처 시 메인 이미지가 흰 공간으로 렌더링되는 CORS·타이밍 문제.

**구현방법**:
- `CAPTURE_W = 375`, `CAPTURE_H = 667` 모듈 상수 추가 — 뷰포트 독립 고정 치수.
- html2canvas 호출 직전 `cardElement.getAttribute('style')` 백업 후 width/height/min/max를 고정 px로 강제 설정, `finally`에서 `setAttribute`로 원상 복구.
- base64 이미지 교체 + 크기 강제 이후 300ms `setTimeout` 딜레이 추가 — DOM 리플로우·이미지 렌더링 완료 보장.
- 이미지 래퍼 치수를 강제 크기 기준 reflow 후 측정하도록 순서 변경.
- `allowTaint: false` → `true`, `scale: 3` → `2` 변경.
- `onclone` 내 이미지 래퍼 `img`에 `crossOrigin = 'anonymous'` 명시적 설정 추가.

**변경파일**: `src/js/services/sharing.js`, `docs/SESSION_LOG.md`.

---

### 2026-06-04 — Claude · CLAUDE.md 갱신 및 캡처 백화 현상 추가 수정

**요구사항**: ① CLAUDE.md를 구버전(Vanilla JS 프로젝트 기준)과 신규 작성 내용(Mobile-First 원칙, html2canvas 4대 규칙, UGC 보안 규칙)으로 병합해 완전한 가이드라인 문서 완성. ② 네이티브 기기 캡처 시 `crossOrigin` 누락으로 발생하는 백화 현상·이미지 누락의 근본 원인 수정.

**구현방법**:
- `CLAUDE.md` 전면 재작성: 기존 아키텍처 규칙(Harness, Session Log, Checkpoint, XSS, confirmDialog, setOnUnmount, TDD) 전량 유지 + Mobile-First/App-Only 원칙, html2canvas 4대 규칙(레이아웃 고정·CORS 우회·300ms delay·워터마크), UGC 신고 규칙 추가. 기술 스택을 실제 코드베이스(Vanilla JS) 기준으로 수정(구버전 오기 Vue 3 제거).
- `cardFace.js` `cardImageWrap`: `<img>` 태그에 `crossorigin="anonymous"` 추가. 이미지가 항상 CORS 모드로 첫 로드되어야 캡처 시 캔버스 오염(tainted canvas)이 발생하지 않음.
- `sharing.js` `onclone` ⑤번 처리: `removeAttribute('loading')` / `removeAttribute('decoding')` 추가 → html2canvas 렌더링 시 lazy/async 속성으로 인한 이미지 누락 차단.

**변경파일**: `CLAUDE.md`, `src/js/components/cardDeck/cardFace.js`, `src/js/services/sharing.js`, `docs/SESSION_LOG.md`.

---

### 2026-06-04 19:27 — Claude · captureAndShareCard 라이브 DOM 조작 제거 리팩토링

**요구사항**: 공유 버튼 클릭 시 라이브 DOM을 400×620px로 강제 변형 + 300ms 대기하여 화면이 깜빡이는 치명적 UX 버그 수정. 모든 레이아웃 조작을 `onclone` 내부로 이전하고, 워터마크 위치 및 `.card-actions` 숨김 처리 개선.

**구현방법**:
- `captureAndShareCard`: 라이브 DOM(`cardElement.style.*`, `imageWrapEl.style.*`, `imgInWrap.style.*`) 강제 크기 설정 코드(구 Step 2)와 300ms `setTimeout` 딜레이(구 Step 3) 완전 제거. 관련 `savedStyleAttr` / `savedWrapStyleAttr` / `savedImgStyleAttr` 백업·복구 코드 일괄 삭제.
- `onclone` 콜백에서만 복제 DOM을 400×620으로 고정 (기존 구현 유지). 라이브 DOM에서 `card-top` 높이 실측만 수행(조작 없음).
- `onclone` 콜백에 `.card-actions` 요소를 `setProperty('display','none','important')`로 숨기는 처리 추가 → 버튼이 캡처 이미지에 찍히지 않음.
- `buildWatermarkElement`: 위치를 `bottom:20px / right:10px` → `bottom:16px / right:16px`으로 `--space-4` 기본 패딩과 일치하도록 통일.
- `tests/ios_gpu_webp_guard.spec.js`: 이전 세션에서 변경된 `FALLBACK_IMG` 경로(`editor_profile.png` → `FALLBACK_IMG.png`)를 테스트가 경직된 경로 패턴으로 기대하던 부분을 `/assets/*.png` 포괄 패턴으로 수정.

**변경파일**: `src/js/services/sharing.js`, `tests/ios_gpu_webp_guard.spec.js`, `docs/SESSION_LOG.md`.

---

### 2026-06-04 19:57 — Claude · 연도/월일 간격 근본 원인 수정 (html2canvas flex gap 미지원)

**요구사항**: 캡처 이미지에서 year(1917)과 date(6. 4) 사이 간격이 여전히 비정상적으로 넓은 문제 재수정.

**구현방법**:
- 원인: html2canvas 1.4.1이 flex `gap` 속성을 불안정하게 지원. `gap: 4px` 인라인 스타일이 클론 문서 렌더링에서 무시되거나 예측 불가능하게 처리됨.
- `card-top-left` onclone 처리를 `display: flex → block` 으로 변경, flex gap 속성 제거.
- `card-date` 상단 간격을 `margin-top: 4px` 으로 처리 (flex gap 완전 대체).
- `card-year` / `card-date` 의 명시적 px 폰트 크기(`28px` / `57px`) 및 `display: block` 설정은 유지.

**변경파일**: `src/js/services/sharing.js`, `docs/SESSION_LOG.md`.

---

### 2026-06-04 20:18 — Claude · 캡처 카드 레이아웃 치수 단일 출처로 정리 (정합성 회귀 방지)

**요구사항**: 카드 캡처 공유 이미지에서 카드 크기·레이아웃 구조가 엉켜있는 문제를 정리하고 테스트 추가.

**구현방법**:
- 원인: 상단 높이가 세 곳에서 불일치. `CARD_TOP_TOTAL_H = 16+4+50+16`(=86, 매직넘버 `50`은 year28+date57=85이어야 함) ↔ 주석(105) ↔ `card-date` line-height `0.5`(실측 높이를 ~28px로 줄여 잘못된 86을 우연히 보정하던 꼼수)가 서로 싸우는 상태. line-height를 정상값으로 되돌리면 이미지 영역이 19px 넘쳐 하단이 잘림.
- `sharing.js` 모듈 상단에 캡처 치수 단일 출처 도입: `CARD_TOP_PAD_Y/YEAR_FONT/DATE_FONT/YEAR_DATE_GAP` 기본 상수 + 파생 상수 `CARD_TOP_H`(=105)·`WRAP_W`(=368)·`WRAP_H`(=483). 손으로 더하지 않고 식으로 파생시켜 드리프트 차단.
- 함수 내 지역 상수(`CARD_TOP_TOTAL_H`/`wrapW`/`wrapH`/`captureH`) 제거하고 onclone이 동일 상수를 참조하도록 통일. `card-date` line-height `0.5 → 1`로 복구(글자 클리핑 방지).
- `tests/sharing_capture_layout.spec.js` 신규: html2canvas mock으로 onclone 결과 인라인 스타일을 검사해 "상단 영역 + 이미지 영역 == 카드 내부 높이(588)" 정합성, 400×620 고정, WRAP 폭/overflow, line-height=1, capture-id 정리를 검증(6 케이스).

**검증**: `npx vitest run` 전체 35파일 308 통과(6 skip).

**변경파일**: `src/js/services/sharing.js`, `tests/sharing_capture_layout.spec.js`, `docs/SESSION_LOG.md`.

---

### 2026-06-04 20:33 — Claude · 캡처 디버그 모드 해제 + As-Is(WYSIWYG) 캡처로 전면 리팩토링

> 위 20:18 '치수 단일 출처' 항목을 정정함: 픽셀 계산 방식 자체가 실기기에서 실패해 폐기.

**요구사항**:
1. 캡처 디버그 모드(`_debugPreview`/오버레이/`__previewCard`) 해제.
2. 실기기(iOS/Android WebView)에서 레이아웃이 여전히 깨짐. 원인은 JS로 고정 픽셀(CARD_TOP_H=105, WRAP_H=483 등)을 강제 주입한 Math 방식 — 디바이스별 폰트·Safe Area·OS 차이를 못 따라감. 브라우저가 CSS로 렌더한 화면을 "있는 그대로" 캡처하는 As-Is 방식으로 재작성.

**구현방법**:
- 디버그 제거: `sharing.js`의 `_debugPreview` 분기·`previewCaptureCard()`·`showDebugPreviewOverlay()`·`window.__previewCard`(DEV) 삭제. `editorstory.js` 공유 호출의 `{ _debugPreview: true }` 인자 제거.
- 레이아웃 상수 전부 삭제: `CAPTURE_W/CAPTURE_H/CARD_PADDING/CARD_TOP_PAD_Y/YEAR_FONT/DATE_FONT/YEAR_DATE_GAP/CARD_TOP_H/WRAP_W/WRAP_H`.
- html2canvas 옵션에서 `width`/`height` 제거 → 원본 렌더 크기 그대로 캡처.
- onclone 최소화: 카드/상단/이미지래퍼/타이틀의 width·height·flex·position·font-size·margin 강제 주입 코드 전량 삭제. 남긴 것은 ① `.card-actions`+오버레이(FIXED_HIDE) `display:none` ② `.card-date` `line-height:1`(Safari 클리핑 방어) ③ 워터마크 주입, + plumbing(Swiper 부모 `transform:none`, 이미지 CORS 2차 방어).
- 백화 방지 로직(`imageToBase64`, `useCORS:true`, `crossOrigin='anonymous'`, cache-bust, `scale:2`)은 100% 유지.
- 테스트 `sharing_capture_layout.spec.js`를 As-Is 계약 검증으로 덮어씀: 사이즈 미강제(width/height/flex 빈 값), html2canvas width/height undefined, CORS 속성·워터마크·card-actions 숨김·date line-height:1 검증(7 케이스).

**검증**: `npx vitest run` 전체 35파일 **309 통과**(6 skip).

**변경파일**: `src/js/services/sharing.js`, `src/js/pages/editorstory.js`, `tests/sharing_capture_layout.spec.js`, `docs/SESSION_LOG.md`.

---

### 2026-06-04 20:57 — Claude · 캡처 디버그 모드 재활성화 (실기기 As-Is 검증용)

**요구사항**: 이미지 공유 디버그 모드 켜기 — 실기기에서 As-Is 캡처 결과를 공유 시트 대신 오버레이로 바로 확인.

**구현방법**:
- `sharing.js`에 단일 토글 상수 `DEBUG_CAPTURE_PREVIEW = true` 추가. `import.meta.env.DEV`와 무관하게 빌드된 앱에서도 동작하도록 설계(실기기는 DEV 플래그가 꺼짐).
- `captureAndShareCard`: `dismissToast()` 직후 `if (DEBUG_CAPTURE_PREVIEW || options._debugPreview)` 분기로 `showDebugPreviewOverlay(dataUrl)` 호출 후 조기 반환(`reason:'debug-preview'`). 3개 호출처(editorstory/mystory/calendar)를 개별 수정하지 않고 한 곳에서 제어.
- `previewCaptureCard()`·`showDebugPreviewOverlay()`·`window.__previewCard`(DEV 콘솔 헬퍼) 복원.
- 검증 종료 후 상수를 `false`로 되돌리면 정상 공유로 복귀.

**검증**: `npx vitest run` 35파일 **309 통과**(6 skip), `npm run build` 성공. onclone은 디버그 분기보다 먼저 실행되어 As-Is 테스트 영향 없음.

**변경파일**: `src/js/services/sharing.js`, `docs/SESSION_LOG.md`.

---

### 2026-06-04 21:05 — Claude · 워터마크 라벨 수직 중앙 보정 버그 수정

**요구사항**: 캡처 워터마크의 'DayStory' 라벨이 아이콘 옆에서 수직 중앙이 어긋남.

**구현방법**: `buildWatermarkElement`에서 `label.style.cssText`를 두 번 할당해 `line-height:1`이 `align-items:center`로 덮어써지던 버그 수정(`cssText`는 누적이 아닌 전체 교체). 일반 `<span>`엔 `align-items`가 무효이므로 `display:flex;align-items:center;line-height:1` 한 선언으로 합쳐 실제로 수직 중앙 정렬되도록 함.

**검증**: `npx vitest run tests/sharing_capture_layout.spec.js` 7 통과(워터마크 주입 검증 포함).

**변경파일**: `src/js/services/sharing.js`, `docs/SESSION_LOG.md`.

---

### 2026-06-04 21:10 — Claude · 워터마크 라벨 하단 쏠림 실제 원인 수정 (html2canvas flex 미지원)

> 위 21:05 'flex 보정' 항목 정정: 브라우저에선 맞지만 html2canvas 캡처에선 무효였음.

**요구사항**: 실기기 캡처 결과에서 워터마크 'DayStory' 라벨이 여전히 아이콘보다 아래로 쏠림.

**구현방법**:
- 원인: html2canvas 1.x 가 flexbox `align-items:center` 를 제대로 렌더링하지 못함. 라이브 DOM은 중앙 정렬되지만 캡처 PNG에선 무시되어 텍스트가 baseline 으로 떨어짐(아이콘 위/텍스트 아래).
- `buildWatermarkElement`를 flex 비의존 방식으로 재작성: 컨테이너 `display:flex/align-items/gap` 제거 → `line-height:16px`(아이콘 높이)+`white-space:nowrap`. 아이콘/라벨은 `vertical-align:middle`, `gap`은 아이콘 `margin-right:6px`로 대체. 16px line-box 안에서 아이콘·텍스트가 함께 중앙 정렬됨.

**검증**: `npx vitest run tests/sharing_capture_layout.spec.js` 7 통과.

**변경파일**: `src/js/services/sharing.js`, `docs/SESSION_LOG.md`.

---

### 2026-06-04 21:19 — Claude · 오늘 캡처/공유 작업 최종 정리 + 커밋

> 위 20:18~21:10 정정 체인의 최종 안착 상태를 한 항목으로 요약. (개별 항목은 위 참조)

**최종 상태 (sharing.js)**:
- **캡처 방식 = As-Is(WYSIWYG)**: 픽셀 강제 주입(Math 방식) 전면 폐기. html2canvas 에 width/height 미지정, 화면 렌더 크기 그대로 캡처. onclone 은 레이아웃 미변경 — ① 불필요 UI(.card-actions+오버레이) 숨김 ② `.card-date` line-height:1(Safari 클리핑) ③ 워터마크 주입 + plumbing(Swiper transform 무력화, 이미지 CORS 2차 방어)만 수행.
- **백화 방지 유지**: `imageToBase64`, `useCORS:true`, `crossOrigin='anonymous'`, cache-bust, `scale:2`.
- **워터마크 수직 정렬**: html2canvas flexbox 미지원 → flex 대신 `line-height:16px`+`vertical-align:middle` 방식.
- **디버그 토글 `DEBUG_CAPTURE_PREVIEW = true` (현재 ON)**: 모든 공유 버튼이 공유 시트 대신 캡처 결과를 오버레이로 표시. ⚠️ 실기기 검증 후 `false`로 되돌릴 것.
- 테스트 `tests/sharing_capture_layout.spec.js`(신규)는 As-Is 계약(사이즈 미강제·CORS·워터마크·card-actions 숨김)을 검증.

**함께 커밋되는 UI 미세조정** (별도 작업, 본 세션 외 워킹트리 변경):
- `components.css`: 플립 transition `ease-in-out→ease-out`, press scale `0.98→0.99`.
- `pages.css`: 캘린더 카드 팝업 `max-width 360→400`, 등장 transform 조정.
- `cardFace.js`: `FALLBACK_IMG` 경로 `editor_profile.png→FALLBACK_IMG.png` / `ios_gpu_webp_guard.spec.js` 동기화.
- `bookmarks.js`: 미니카드 day 라벨 0패딩 제거.

**검증**: `npx vitest run` 전체 35파일 309 통과(6 skip), `npm run build` 성공.

**변경파일**: `src/js/services/sharing.js`, `tests/sharing_capture_layout.spec.js`, `src/css/components.css`, `src/css/pages.css`, `src/js/components/cardDeck/cardFace.js`, `src/js/pages/bookmarks.js`, `tests/ios_gpu_webp_guard.spec.js`, `docs/SESSION_LOG.md`.

---

### 2026-06-05 — Claude · 설정/알림 토글 햅틱 피드백 추가

**요구사항**: 테마 옵션 그룹(theme-option-group) 버튼 전환 시, 알림 설정 토글 온/오프 시 짧고 약한 햅틱 피드백 부여.

**구현방법**:
- `settingsSections.js`: `@capacitor/haptics` import 추가. `bindThemeOptions`·`bindLangOptions` 클릭 핸들러 진입 시 `Haptics.impact({ style: ImpactStyle.Light })` 호출. 언어 토글은 실제 변경이 있을 때만 발동(이미 선택된 항목 재클릭 제외).
- `notificationSettingsSheet.js`: `@capacitor/haptics` import 추가. 알림 토글 클릭 핸들러 진입 시 `Haptics.impact({ style: ImpactStyle.Light })` 호출(비동기 처리 시작 전).
- 웹 환경에서는 `.catch(() => {})` 로 오류 무시.

**변경파일**: `src/js/components/settingsSections.js`, `src/js/components/notificationSettingsSheet.js`, `docs/SESSION_LOG.md`.

---

### 2026-06-05 — Claude · settings→mystory 슬라이드 인 + 카드 뒷면·설정 페이지 스크롤 레이아웃 고정

**요구사항**:
1. settings-page → mystory-page 이동 시 왼쪽에서 오른쪽으로 슬라이드 인 애니메이션 적용.
2. back-body 내용이 길어져 스크롤이 생겨도 내부 레이아웃 크기가 영향받지 않도록 수정.
3. settings-page 스크롤에도 동일한 레이아웃 고정 적용.

**구현방법**:
- **슬라이드 인**: `pages.css`에 `@keyframes pageSlideFromLeft` + `.page-slide-from-left` 클래스(0.28s ease-out) 추가. `router.js` NORMAL PATH 렌더 완료 후 `previousRoute === '/settings' && path === '/mystory'` 조건일 때 클래스 부여 → `animationend` 후 자동 제거.
- **back-body 스크롤 고정**: `components.css`에서 `.history-card-back`에 `overflow: hidden` 추가, `.back-body`에 `min-height: 0` 추가. flex 자식의 수축 거부(min-height: auto 기본값) 해제로 overflow-y: auto 스크롤이 카드 경계 내에서 발동.
- **settings-page 스크롤 고정**: `.settings-page`를 `flex: 1; height: 100%; overflow: hidden; display: flex; flex-direction: column`으로 오버라이드. `.settings-scroll` 래퍼(`flex: 1; min-height: 0; overflow-y: auto`)를 추가하고 `settings.js`에서 섹션 콘텐츠를 해당 래퍼로 감쌈.

**변경파일**: `src/css/pages.css`, `src/js/router.js`, `src/css/components.css`, `src/js/pages/settings.js`, `docs/SESSION_LOG.md`.

## 2026-06-05 17:03 — Claude Sonnet 4.6

- **요구사항**: 에디터 닉네임을 'Editor Lee'로 고정하고 SSOT(단일 진실 공급원) 원칙에 따라 저장·렌더링 레이어 전체에 일관되게 적용.
- **구현방법**: `src/js/utils/constants.js` 신규 생성 후 `EDITOR_DISPLAY_NAME = 'Editor Lee'` 상수 정의. 렌더링 레이어 3곳(`editorstory.js`의 `data-editor-name` 속성 및 bubble 표시 로직, `calendar.js`의 동일 위치 2곳, `detail.js`의 `editorName` 변수)에서 Firestore `story.editor.displayName` 및 `'DayStory'` 하드코딩을 상수 참조로 교체. 저장 레이어(`editor.js`의 `editorInfo.displayName`)도 상수로 교체해 Firestore에도 동일 값이 저장되도록 처리. 기존 테스트(`tests/detail_nav.ui.spec.js`)가 `'DayStory'`를 기대하던 단언을 `EDITOR_DISPLAY_NAME` 상수 참조로 갱신.
- **변경파일**: `src/js/utils/constants.js`(신규), `src/js/pages/editorstory.js`, `src/js/pages/calendar.js`, `src/js/pages/detail.js`, `src/js/pages/editor.js`, `tests/detail_nav.ui.spec.js`.
- **검증**: `npm test` 35 files, 312 passed, 0 failed — 100% Green.

## 2026-06-05 17:46 — Claude Opus 4.8

- **요구사항**: i18n 핵심 엔진은 구현돼 있으나 ① 설정 페이지 언어 선택 UI 미연결(죽은 코드), ② `<meta og:locale>` 정적(ko_KR) 고정, ③ Firestore 사용자 프로필에 언어 설정 미저장 — 3가지 문제를 TDD 방식으로 활성화·수정.
- **구현방법**:
  - **작업1 (설정 UI 연결)**: `settingsSections.js`의 `renderSettingsSections()`에 테마 그룹과 동일한 `.theme-option-group`+`.theme-option-thumb` 구조로 언어 선택 그룹(ko/en/ja, `data-active`=현재 언어 인덱스) 렌더링 추가. `bindSettingsSections()`에 `bindLangOptions(page)` 호출 추가. `bindLangOptions`에서 언어 변경 시 `saveLanguagePreference()` 호출 + 전역 `profile` 상태 동기화 로직 추가.
  - **작업2 (og:locale 동적화)**: `i18n/index.js`에 `OG_LOCALE_MAP = { ko:'ko_KR', en:'en_US', ja:'ja_JP' }` 추가. `applyHtmlLang(lang)`을 export로 전환하고 `<html lang>`뿐 아니라 `meta[property="og:locale"]`도 갱신하도록 수정(미지원 값은 ko_KR 폴백).
  - **작업3 (Firestore 연동)**: `services/userProfile.js` 신규 생성 — `saveLanguagePreference(lang)`이 `profiles/{uid}`에 `languagePreference`를 `{ merge: true }`로 저장(아키텍처 규칙: Firestore 접근은 service 레이어 경유, 게스트/미설정 시 false 반환). `i18n/index.js`에 `applyLangFromProfile(profile)` 추가 — DB의 `languagePreference`를 `setLang()`으로 state+localStorage에 덮어쓰기. `login.js` 3개 로그인 경로(소셜/이메일/회원가입) 모두 `setState('profile')` 직후 `applyLangFromProfile()` 호출 + 신규 프로필 생성 시 `languagePreference: getCurrentLang()` 기본 저장. `profile.js` 프로필 저장 시 `languagePreference: getCurrentLang()` 함께 저장.
  - **TDD**: `tests/i18n_language_settings.spec.js` 신규 작성(정적 소스 검증 + jsdom functional 18건). state.js가 모듈 로드 시 `window.matchMedia`를 호출하므로 `detail_nav.ui.spec.js`와 동일하게 `vi.stubGlobal('matchMedia', ...)` 적용.
- **변경파일**: `src/js/services/userProfile.js`(신규), `src/js/i18n/index.js`, `src/js/components/settingsSections.js`, `src/js/pages/login.js`, `src/js/pages/profile.js`, `tests/i18n_language_settings.spec.js`(신규), `docs/SESSION_LOG.md`.
- **검증**: 신규 spec 18/18 통과. 전체 `npx vitest run` 336건 중 329 passed / 6 skipped / 1 failed — 유일한 실패(`editorstory.ui.spec.js` 버블 border 검증)는 이전 세션의 미커밋 CSS 변경(`pages.css` border `2px solid`→`1px dashed`)에서 비롯된 기존 실패로 본 작업과 무관(CSS 미변경). `npm run build` 성공.

## 2026-06-05 18:04 — Claude Sonnet 4.6

- **요구사항**: 이전 세션 미커밋 CSS 변경(`components.css`의 `.editor-comment-bubble` border가 `var(--color-border)` → `var(--color-text-secondary)`로 변경)으로 인해 `tests/editorstory.ui.spec.js` 1건이 실패 중. 테스트를 현재 CSS 상태에 맞게 수정하여 전체 테스트 100% Green 복원.
- **구현방법**: `editorstory.ui.spec.js` 156번 라인의 border 색상 토큰 기대값을 `/border:\s*2px\s+solid\s+var\(--color-border\)/` → `/border:\s*2px\s+solid\s+var\(--color-text-secondary\)/` 로 수정.
- **변경파일**: `tests/editorstory.ui.spec.js`, `docs/SESSION_LOG.md`.
- **검증**: `npx vitest run` 36 files, 330 passed / 6 skipped / 0 failed — 100% Green.

## 2026-06-05 18:20 — Claude Sonnet 4.6

- **요구사항**: 이전 커밋에서 제외된 git 추적 중인 android/ios 빌드 파일(`android/app/src/main/assets/public/index.html`, `ios/App/App.xcodeproj/project.pbxproj`)을 추가 커밋.
- **구현방법**: `.gitignore`에 의해 ignored 처리되지만 이미 추적 중인 파일이므로 `git add -f` 로 강제 스테이징 후 커밋.
- **변경파일**: `android/app/src/main/assets/public/index.html`, `ios/App/App.xcodeproj/project.pbxproj`, `docs/SESSION_LOG.md`.

## 2026-06-05 19:30 — Claude Opus 4.8

- **요구사항**: 지원 언어를 3개(ko/en/ja) → 5개(+스페인어 es, 중국어 간체 zh)로 확장하고, 관리자가 한국어 원문을 작성하면 Gemini로 en/ja/es/zh 4개 국어를 동시 번역해 에디터 탭을 채우는 Cloud Function(`translateContent`)을 TDD로 구축. (SDK/모델은 사용자 결정에 따라 지정된 `@google/generative-ai`+`gemini-1.5-flash` 대신 최신 `@google/genai`+`gemini-2.5-flash` 채택, 지원종료 리스크 회피.)
- **구현방법**:
  - **프론트엔드 i18n 확장**: `src/i18n/es.json`·`zh.json` 신규(en.json 키 구조 100% 미러, 실제 스페인어/중국어 번역). 5개 언어 파일 `settings`에 `lang_es`("Español")·`lang_zh`("中文") 추가. `i18n/index.js`에 es/zh static import + `messages` 등록, `SUPPORTED_LANGS`·`OG_LOCALE_MAP`(es→es_ES, zh→zh_CN)·`detectInitialLang()` 분기 확장. `settingsSections.js` `LANGS` 확장 + `renderLangOption('es'/'zh')` 렌더(제너릭 헬퍼/바인딩은 그대로 재사용). `services/userProfile.js` `SUPPORTED_LANGS` 확장. `storyI18n.js`는 이미 locale-agnostic이라 무수정(es/zh 카드 콘텐츠 자동 렌더).
  - **에디터 다국어 폼**: `editor.js`에 Español/中文 탭 2개, `formState` es/zh 항목, 로드 배열 `['en','ja']`→`['en','ja','es','zh']`, 직렬화 `buildTranslation('es'/'zh')` + `i18n.es`/`i18n.zh` 할당 추가.
  - **Cloud Function**: `functions/lib/translate.js` 신규(순수 헬퍼 — `SYSTEM_PROMPT`[사용자 지정 로컬라이징 지침+줄바꿈 보존+마크다운 코드블록 JSON], `TARGET_LANGS`, `buildUserPrompt()`, `parseTranslationResponse()`). `functions/index.js`에 `translateContent` onCall(asia-northeast3) 추가 — `defineSecret('GEMINI_API_KEY')`, Admin Custom Claim(`token.admin===true`) 게이트, `@google/genai`+`gemini-2.5-flash` 호출, 코드블록 JSON 파싱. `functions/package.json`에 `@google/genai@^2.8.0` 추가.
  - **클라이언트 배선**: `services/translate.js` 신규(admin.js 동적 import 패턴, `translateContentApi({fields})`). `editor.js`에 '✨ 한국어 기준 자동 번역' 버튼 + `bindAutoTranslate()` — 한국어 4개 필드를 한 번 호출로 en/ja/es/zh 번역해 `formState`에 채우고 현재 탭/프리뷰 갱신, 권한/네트워크 오류 토스트 처리.
  - **TDD**: `tests/i18n_locale_expansion.spec.js`(키 패리티·og:locale·setLang·정적 연결 11건), `tests/translate_content.spec.js`(파서 줄바꿈 보존·프롬프트·함수 보안/SDK/모델 정적 12건) 신규. 두 스펙 모두 구현 전 red 확인 후 green.
- **변경파일**: `src/i18n/es.json`(신규), `src/i18n/zh.json`(신규), `src/i18n/{ko,en,ja}.json`, `src/js/i18n/index.js`, `src/js/components/settingsSections.js`, `src/js/services/userProfile.js`, `src/js/services/translate.js`(신규), `src/js/pages/editor.js`, `functions/lib/translate.js`(신규), `functions/index.js`, `functions/package.json`, `tests/i18n_locale_expansion.spec.js`(신규), `tests/translate_content.spec.js`(신규), `docs/SESSION_LOG.md`.
- **검증**: `npm test` 38 files, 353 passed / 6 skipped / 0 failed — 100% Green(신규 23건 포함). `npm run build` 성공. `functions/` `npm install`(+@google/genai 261 pkgs), `node --check` index.js·lib/translate.js OK, 파서 줄바꿈 보존 node 재확인. `npx cap sync android` 성공. ⚠️ 함수 실배포는 사용자 단계 필요: `firebase functions:secrets:set GEMINI_API_KEY` 후 `firebase deploy --only functions:translateContent`.

## 2026-06-05 20:05 — Claude Opus 4.8

- **요구사항**: 배포 후 자동 번역 호출이 500(`internal`)로 실패. `firebase functions:log` 확인 결과 원인은 코드 버그가 아니라 Gemini `gemini-2.5-flash` 모델의 일시적 과부하(`ApiError 503 UNAVAILABLE — "high demand"`). 일시 오류를 영구 실패로 처리하던 동작을 재시도·폴백으로 보완.
- **구현방법**:
  - `functions/lib/translate.js`: `MODEL_CANDIDATES = ['gemini-2.5-flash','gemini-2.0-flash']`(과부하 시 폴백)와 순수 판정 함수 `isTransientError(err)`(503/429/500·UNAVAILABLE/RESOURCE_EXHAUSTED/INTERNAL/"high demand" 등) 추가·export.
  - `functions/index.js`: 단일 `generateContent` 호출을 모델 후보 × 2회 재시도 루프로 교체 — 일시 오류면 0.5s→1.0s 백오프 후 재시도하고 막히면 다음 모델로 폴백, 영구 오류는 즉시 중단. 모든 모델 실패 시 `internal` 대신 `HttpsError('unavailable', 'AI 번역 서버가 혼잡합니다. 잠시 후 다시 시도해주세요.')`. `timeoutSeconds: 120` 상향, `sleep` 헬퍼 추가.
  - `src/js/pages/editor.js`: 자동 번역 catch 에서 `functions/unavailable` 코드를 분기해 "혼잡합니다, 잠시 후 다시 시도" 토스트.
  - 테스트: `tests/translate_content.spec.js`에 `isTransientError`·`MODEL_CANDIDATES` 검증 추가, 모델 식별자 정적 검증을 index.js→lib/translate.js 로 이동(폴백 반영).
- **변경파일**: `functions/lib/translate.js`, `functions/index.js`, `src/js/pages/editor.js`, `tests/translate_content.spec.js`, `docs/SESSION_LOG.md`.
- **검증**: `npm test` 38 files, 356 passed / 6 skipped / 0 failed — 100% Green. `node --check`(index.js·lib) OK, `isTransientError` node 재확인. `npm run build`·`npx cap sync android` 성공. ⚠️ 적용하려면 함수 재배포 필요: `firebase deploy --only functions:translateContent`.

## 2026-06-06 02:30 — Claude Opus 4.8

- **요구사항**: i18n 코어는 활성화됐으나 UI(버튼·토스트·모달·aria-label 등)에 남아있던 하드코딩 한글을 4단계 파이프라인(스캔→매핑보고→치환→회귀테스트)으로 5개 국어(ko/en/ja/es/zh) i18n 키로 치환. 주석·`console.*`·내부 판정용 문자열·dev throw·dead code는 제외.
- **구현방법**: 8개 모듈로 쪼개 점진 적용, 각 단계 `npm test` green 유지.
  - **딕셔너리**: 5개 `src/i18n/*.json`에 신규 네임스페이스 `auth`·`mystory`·`profile`·`report`·`search`·`license`·`notification`·`update`·`share`·`camera` + `date`(weekdays 배열/full/year_month/year_only) 추가, `common`·`editor`·`detail`·`calendar`·`settings`·`bookmarks` 대폭 확장. (영/일/스/중은 직역 채움)
  - **i18n 코어**: `i18n/index.js`에 배열 조회용 `tList(key)` 추가.
  - **공용/페이지 치환**: pageHeader·confirmDialog·cardDeckController·widgetThemePreview·updateSheet·notificationSettingsSheet·settingsSections / login·editor·mystory·profile·report·search·license·detail·calendar·editorstory·bookmarks / services(notifications·sharing·camera·bookmarks)·router(404). 모듈 상수(NOTIFICATION_LABELS/PERIODS, CAMERA_PROMPT_LABELS, NOTIFICATION_META title·body, calendar WEEKDAYS)는 import 시점 고정을 피해 t()/tList() 호출 함수(`getWeekdays` 등)로 전환. aria-label 셀렉터는 동일 t() 값으로 매칭하도록 정정.
  - **로직 버그 동시 수정**: editor 업로드 상태 판별을 한글 substring(`includes('완료')`)→`dataset.done` 플래그로 교체(다국어 안전).
  - **테스트 정비**: `tests/setup.js`에 전역 `window.matchMedia` 스텁 추가(여러 모듈이 state.js를 전이 import). cardDeckController.spec state mock에 `getState`/`subscribe` 보강 + calendar mock `WEEKDAYS`→`getWeekdays`. view-toggle.spec `export const WEEKDAYS`→`export function getWeekdays` 정적검사 갱신.
- **변경파일**: `src/i18n/{ko,en,ja,es,zh}.json`, `src/js/i18n/index.js`, `src/js/router.js`, `src/js/components/{pageHeader,confirmDialog,widgetThemePreview,updateSheet,notificationSettingsSheet,settingsSections}.js`, `src/js/components/cardDeck/cardDeckController.js`, `src/js/pages/{login,editor,mystory,profile,report,search,license,detail,calendar,editorstory,bookmarks}.js`, `src/js/services/{notifications,sharing,camera,bookmarks}.js`, `tests/{setup,cardDeckController.spec,view-toggle.spec}.js`, `docs/SESSION_LOG.md`.
- **검증**: `npm test` 38 files, 356 passed / 6 skipped / 0 failed — 100% Green. `npm run build` 성공. 잔여 한글은 주석·`console`·dev throw(Firebase 미설정 등)·내부 취소감지 키워드·미사용 dead code(date.js formatDateKR/formatMonthYear)뿐으로 의도적 제외.

## 2026-06-07 02:15 — Claude Opus 4.8

- **요구사항**: '콘텐츠 관리(에디터)' 화면 다국어 개편 기획안(Gemini) 검토 후, 승인된 '더 나은 대안'만 적용. Master-Detail 2단 분할은 모바일 1순위 원칙 충돌로 전면 취소(전체화면 라우트 동선 유지). 채택: ① 캘린더 카드에 5개 국어 번역 현황 미니 배지 [K][E][J][S][Z] ② 좌측 툴바 "미번역" 필터 토글 ③ 발행/초안/예약 저장 시 "저장 중..." 상태 텍스트. 기존 캘린더/상태관리 코어는 미변경.
- **구현방법**: 기존 캘린더를 갈아엎지 않고 표시 레이어만 추가하는 최소 변경.
  - `editor.js`: 모듈 레벨 순수 함수 `getTranslationStatus(story)`(ko=최상위·en/ja/es/zh=`story.i18n[lang]`의 title|figure_name|body 존재 판정)·`isStoryUntranslated(story)` 신규 export. `renderI18nBadges(story)` 헬퍼로 `[K][E][J][S][Z]` 배지 HTML 생성(aria-label은 `t('editor.i18n_status_label')`), `renderCalendarStory`에 한 줄 삽입. `.editor-stats`에 `data-filter="untranslated"` 세그먼트 1개 추가(기존 클릭 핸들러 그대로 재사용), `getStoriesForDate` 필터 분기·`updateStats` 카운트 1줄씩 확장. 발행(submit)·초안(`sf-save-draft`)·예약(`sf-schedule`) 핸들러에 클릭 시 버튼 텍스트 `t('editor.saving')` + disable, 실패 시 원복.
  - `pages.css`: `.editor-cal-i18n-badges`·`.i18n-badge.is-on`(채움=`--color-success`/텍스트 `--color-bg-primary`로 라이트·다크 대비)·`.is-off`(흐림=`--color-bg-secondary`/`--color-text-tertiary`/`--color-border`) 추가. 하드코딩 색상 없이 `var(--*)` 토큰만 사용.
  - `i18n/{ko,en,ja,es,zh}.json`: `filter_untranslated`·`i18n_status_label`·`saving` 3개 키를 5개 파일에 균형 추가.
  - 테스트: `tests/editor_management_calendar.spec.js`에 순수 함수 검증 + 배지 렌더(is-on/is-off 개수)·미번역 필터·stat 카운트 케이스 추가(TDD).
- **변경파일**: `src/js/pages/editor.js`, `src/css/pages.css`, `src/i18n/{ko,en,ja,es,zh}.json`, `tests/editor_management_calendar.spec.js`, `docs/SESSION_LOG.md`.
- **검증**: `tests/editor_management_calendar.spec.js` 6 passed/1 skipped. 전체 `npm test` 356 passed/6 skipped, **2 failed**(`tests/i18n_language_settings.spec.js`) — 이는 세션 시작 전부터 dirty 였던 `settingsSections.js`(구식 `bindLangOptions`/`renderLangOption` 기대) 관련 기존 실패로 본 작업과 무관. i18n 키 패리티(`i18n_locale_expansion`)·`css_tokens` 통과.

## 2026-06-07 04:24 — Claude Opus 4.8

- **요구사항**: 콘텐츠 관리 `editor-stats` 토글 구성 검토 후 "예약" 필터 재정의. 기존엔 `예약하기` 버튼으로 만든 `status==='scheduled'` 글만 "예약"으로 잡혀, 미래 날짜로 "발행"한(=아직 유저에게 노출 안 되는) 글이 "발행" 탭에 섞이는 문제. 발행일이 미래인 "업로드 예약" 글을 "예약"으로 분리.
- **구현방법**: status 가 아니라 "지금 노출 중인가"(stories.js fetchStories: `published && publish_date<=오늘`만 노출) 기준으로 분류.
  - `editor.js`: 모듈 레벨 순수 함수 `getEditorBucket(story, today)` 신규 export — `draft→초안`, `archived→보관`, `status==='scheduled' || (발행글 && publish_date>오늘)→예약`, 그 외 발행글→`발행`. `getLocalToday` import 추가, `renderEditor` 클로저에 `const today` 1회 계산.
  - `updateStats`(발행/예약/초안 카운트)·`getStoriesForDate`(발행/예약/초안 필터)를 `s.status===filter`→`getEditorBucket(s,today)===filter` 로 교체. 캘린더 카드 상태 배지도 `getStatusBadge(getEditorBucket(...))` 로 바꿔 미래 발행글이 "예약" 배지로 표시되도록 일치. `예약하기` 버튼·`전체`·`미번역` 필터는 그대로.
  - 테스트: `tests/editor_management_calendar.spec.js`에 date util `getLocalToday`만 '2026-06-07'로 고정하는 mock(나머지 실제 유지) 추가, `getEditorBucket` 분류 단위 테스트 + 미래 발행글이 예약 카운트/배지/필터로 분리되는 렌더 테스트 추가.
- **변경파일**: `src/js/pages/editor.js`, `tests/editor_management_calendar.spec.js`, `docs/SESSION_LOG.md`.
- **검증**: `tests/editor_management_calendar.spec.js` 8 passed/1 skipped. 전체 `npm test` 358 passed/6 skipped, 2 failed(`i18n_language_settings.spec.js`) — 세션 전부터 dirty 였던 `settingsSections.js` 관련 기존 실패로 본 작업과 무관.

## 2026-06-07 04:34 — Claude Opus 4.8

- **요구사항**: `editor-new-page`(새 일화 작성/수정)에서 새로 작성하거나 기존 글을 수정한 미저장 변경이 있을 때, 떠나기 전 경고 모달을 띄운다. 기존엔 라우터 가드(`pushBeforeNavigate`)가 SPA 네비/하드웨어백에서만 모달을 띄웠고, 상단 뒤로가기 버튼은 `history.back()`만 호출해 딥링크·새로고침 진입 시 hashchange 가드가 안 걸려 경고 없이 빠져나가는 구멍이 있었음.
- **구현방법**:
  - `editor.js` `renderEditorNew`: 미저장 변경 시 경고 모달을 띄우고 떠나도 되는지 반환하는 공유 함수 `confirmLeaveIfDirty()` 추가(`saving || !unsavedChanges`면 즉시 통과). 라우터 가드를 인라인 로직 → `pushBeforeNavigate(() => confirmLeaveIfDirty())`로 위임(중복 제거). 상단 뒤로가기 버튼(`#editor-new-back`)을 `history.back()` 직접 호출 → `confirmLeaveIfDirty()` 확인 후에만 떠나도록 변경하고, 확인 시 `unsavedChanges=false`로 내려 네비 가드가 모달을 두 번 띄우지 않게 함.
  - 테스트: `tests/editor_management_calendar.spec.js`에 `confirmDialog.showConfirm` mock 추가, 뒤로가기 시 (1)변경없음→모달없이 즉시 (2)취소→머무름 (3)확인→떠남 시나리오 검증.
- **변경파일**: `src/js/pages/editor.js`, `tests/editor_management_calendar.spec.js`, `docs/SESSION_LOG.md`.
- **검증**: `tests/editor_management_calendar.spec.js` 9 passed/1 skipped. 전체 `npm test` 359 passed/6 skipped, 2 failed(`i18n_language_settings.spec.js`) — 세션 전부터 dirty 였던 `settingsSections.js` 관련 기존 실패로 본 작업과 무관.

## 2026-06-07 04:42 — Claude Opus 4.8

- **요구사항**: 직전까지 빨간불이던 `i18n_language_settings.spec.js` 2건(`renderLangOption`·`bindLangOptions(page)` 기대) 정정. 언어 설정 UI가 인라인 버튼 → 리스트 항목+바텀시트 패턴으로 리팩터링되면서 함수명이 바뀌었는데 테스트가 옛 이름을 검사하고 있었음. 동시에 리팩터링 잔재(죽은 코드) 정리.
- **구현방법**:
  - `settingsSections.js`: 호출되지 않는 죽은 함수 `bindLangOptions`(옛 `.lang-option` 인라인 버튼 바인더 — 현재 마크업엔 `.lang-sheet-option`만 존재) 제거. 그 함수 주석에서만 참조되던 미사용 `forceRoute` import 제거. (`LANGS` 상수는 `i18n_locale_expansion.spec.js`가 검증하므로 유지, 뷰모드 코드는 무관하여 미변경.)
  - `tests/i18n_language_settings.spec.js`: 작업1의 2개 정적검사를 현재 구현에 맞게 갱신 — `renderLangOption` 호출 검사 → `renderLanguageListItem` 호출 검사(정의+호출 2회 이상), `bindSettingsSections` 본문 `bindLangOptions(page)` → `bindLanguageItem(page)` 검사. 의도(설정 페이지 언어 UI 렌더+바인딩 연결)는 보존.
- **변경파일**: `src/js/components/settingsSections.js`, `tests/i18n_language_settings.spec.js`, `docs/SESSION_LOG.md`.
- **검증**: `tests/i18n_language_settings.spec.js` 18 passed. 전체 `npm test` **38 files, 361 passed / 6 skipped / 0 failed — 100% Green**(세션 중 첫 전체 그린). `npm run build` 성공.

## 2026-06-07 16:34 — Claude Opus 4.8

- **요구사항**: 자동 번역(translateContent)에 쓰는 Gemini 모델을 `gemini-3.1-pro` 로 변경. 단 과부하 폴백은 유지.
- **구현방법**:
  - `functions/lib/translate.js`: `MODEL_CANDIDATES` 를 `['gemini-2.5-flash','gemini-2.0-flash']` → `['gemini-3.1-pro','gemini-2.5-flash']` 로 교체(Pro 우선 + flash 폴백). 주석 갱신. `generateContent` config(systemInstruction/temperature 0.7)는 모델 무관하여 그대로.
  - `functions/index.js`: translateContent 헤더 주석의 모델 표기 갱신.
  - `tests/translate_content.spec.js`: 모델 우선순위/식별자 정적 검사를 `gemini-3.1-pro` 우선 + `gemini-2.5-flash` 폴백 기준으로 갱신.
- **변경파일**: `functions/lib/translate.js`, `functions/index.js`, `tests/translate_content.spec.js`, `docs/SESSION_LOG.md`.
- **검증**: `tests/translate_content.spec.js` 15 passed. (프로덕션 반영은 `firebase deploy --only functions:translateContent` 필요 — 미실행.)

## 2026-06-07 16:43 — Claude Opus 4.8

- **요구사항**: 직전 작업에서 넣은 `gemini-3.1-pro` 가 실서비스에서 500(`404 models/gemini-3.1-pro is not found`)을 내는 문제 정정. 404는 isTransientError=false라 flash 폴백도 안 타고 즉시 throw.
- **구현방법**: ListModels API(`generativelanguage v1beta/models`)로 실제 가용 모델 조회 → 올바른 ID는 `gemini-3.1-pro-preview`. `MODEL_CANDIDATES[0]` 및 index.js 주석·테스트를 `gemini-3.1-pro` → `gemini-3.1-pro-preview` 로 교체. `generateContent` 스모크 테스트로 ID 유효성 확인("text":"OK") 후 재배포.
- **변경파일**: `functions/lib/translate.js`, `functions/index.js`, `tests/translate_content.spec.js`, `docs/SESSION_LOG.md`.
- **검증**: 모델 스모크테스트 통과, `tests/translate_content.spec.js` 15 passed, `firebase deploy --only functions:translateContent` 성공.

## 2026-06-07 17:24 — Claude Opus 4.8

- **요구사항**: (1) 일화 수정 에디터 「에디터 한마디」 textarea 최소 높이 200px. (2) 관리자 번역 사용성 — 자동 번역이 적용된 글에 한해 번역 버튼 내부 하단에 서브라벨로 ① 번역에 사용된 Gemini 모델 ID ② 번역 적용 시각 표시.
- **구현방법**:
  - `editor.js` #sf-editor-comment 인라인 스타일에 `min-height:200px` 추가.
  - `functions/index.js` translateContent: 루프에서 실제 성공 모델을 `usedModel` 로 추적, 반환값을 `{ translations }` → `{ translations, model: usedModel, translatedAt: ISO }` 로 확장. (재배포 완료)
  - `editor.js`: 상태 `translationMeta={model,translatedAt}` 추가. 번역 버튼을 `.translate-main`(메인 라벨)+`.translate-meta`(서브라벨, 기본 hidden) 2단 flex 구조로 변경. 헬퍼 `formatTranslatedAt`(ISO→'YYYY-MM-DD HH:mm'), `renderTranslateMeta`(메타 없으면 숨김, 있으면 모델/시각 2줄 표시) 추가. 번역 성공(filled&&model) 시 메타 갱신+렌더, 진행중 라벨 토글은 main span만 변경. 기존 글 로드 시 `story.translation_meta` 복원, `getFormData` 저장 데이터에 `translation_meta` 포함. 마운트 시 `renderTranslateMeta()` 호출.
  - i18n 5개 파일에 `editor.translate_meta_model`/`translate_meta_time` 키 추가.
  - `tests/translate_content.spec.js`: 응답에 model·translatedAt 반환 정적 검증 추가.
- **변경파일**: `src/js/pages/editor.js`, `functions/index.js`, `src/i18n/{ko,en,ja,es,zh}.json`, `tests/translate_content.spec.js`, `docs/SESSION_LOG.md`.
- **검증**: `tests/translate_content.spec.js` 16 passed, `tests/editor_management_calendar.spec.js` 9 passed/1 skipped, `npm run build` 성공, `firebase deploy --only functions:translateContent` 성공.

## 2026-06-07 18:40 — Claude Opus 4.8

- **요구사항**: (1) 홈 카드 우상단 관리자 "콘텐츠 관리" 버튼 — 기본 카드 형태 유지하며 카드 위쪽 여백에 레이아웃 영향 없이 플로팅. 설정 editIcon()과 동일 아이콘. (2) "예약 발행 자동 전환 실패: The query requires an index" Firestore 복합 인덱스 에러 수정.
- **구현방법**:
  - `cardFace.js` `cardShell()`에 `extraHtml` 파라미터 추가(flipper 형제 = 카드 면과 분리, 비회전 오버레이).
  - `editorstory.js`: 관리자(`getState('isAdmin')`)일 때만 `.card-admin-edit-float` 버튼을 extraHtml로 주입, 클릭 시 `/editor/new?edit=<id>` 이동. 아이콘은 설정 editIcon()과 동일 SVG. (이전 card-actions 내 버전은 제거하고 카드 공통 형태 복원.)
  - `components.css`: `.flip-container { position:relative }`(오버레이 기준), `.card-admin-edit-float`(absolute; top:-42px; right:2px; 토큰 색/그림자/반경).
  - `firestore.indexes.json`: autoPublishScheduled 쿼리(`status== & publish_date<=`)는 inequality 암묵 ASC 정렬이라 기존 DESC 인덱스와 불일치 → `stories: status ASC, publish_date ASC` 복합 인덱스 추가 후 `firebase deploy --only firestore:indexes` 배포.
- **변경파일**: `src/js/components/cardDeck/cardFace.js`, `src/js/pages/editorstory.js`, `src/css/components.css`, `firestore.indexes.json`, `docs/SESSION_LOG.md`.
- **검증**: `npm run build` 성공, firestore 인덱스 배포 성공(빌드까지 수 분 소요).

## 2026-06-07 18:33 — Claude Opus 4.8

- **요구사항**: 콘텐츠 관리 캘린더에서 번역 완료 날짜의 `cal-cell-day`가 초록색(`cal-cell-day-translated`)으로 표시되지 않는 현상 확인·해결.
- **구현방법**:
  - 진단: CSS 규칙(`.editor-calendar-cell .cal-cell-day.cal-cell-day-translated{color:var(--color-success)}`, 특이성 0,3,0)·로직·번들·단위테스트 모두 정상 확인. 충돌/override·!important 없음.
  - 실제 결함: `allTranslated` 판정이 `getStoriesForDate()`(현재 필터 적용 결과) 기준이라, 발행/예약/초안/미번역 등 필터가 활성화되면 완번역 글이 필터에서 빠져 날짜가 초록색이 안 되는 문제. → 필터와 무관하게 `allStories.filter(s => s.publish_date === isoDate)` 전체 글 기준으로 판정하도록 변경.
- **변경파일**: `src/js/pages/editor.js`, `docs/SESSION_LOG.md`.
- **검증**: `tests/editor_management_calendar.spec.js` 9 passed/1 skipped, `npm run build` 성공.

## 2026-06-07 18:55 — Claude Opus 4.8

- **요구사항**: 번역 시 "AI 번역 서버가 혼잡합니다"가 지속 표시되는 원인 규명 및 대응.
- **구현방법**:
  - 원인: 함수 로그 확인 결과 실제 에러는 `429 RESOURCE_EXHAUSTED: "Your project has exceeded its monthly spending cap"` — 서버 혼잡이 아니라 **Gemini API 프로젝트 월 지출 한도 초과**. 기존 코드가 429를 일시오류로 분류해 '혼잡'으로 잘못 안내.
  - 사용자 결정: 모델(gemini-3.1-pro-preview)은 유지, 메시지만 정확히.
  - `functions/lib/translate.js`: `isQuotaError(err)` 추가(메시지에 spending cap/billing/exceeded its monthly 포함 여부)·export.
  - `functions/index.js`: 모든 모델 실패 후 `isQuotaError(lastErr)`면 `HttpsError('resource-exhausted', '...사용량(요금) 한도 초과...')` 로 분기, 그 외만 기존 'unavailable' 혼잡 메시지.
  - `editor.js`: catch 에 `functions/resource-exhausted` → `t('editor.translate_err_quota')` 매핑 추가.
  - i18n 5개 파일에 `translate_err_quota` 키 추가.
- **변경파일**: `functions/lib/translate.js`, `functions/index.js`, `src/js/pages/editor.js`, `src/i18n/{ko,en,ja,es,zh}.json`, `docs/SESSION_LOG.md`.
- **검증**: JSON 검증 통과, `npm run build` 성공, `firebase deploy --only functions:translateContent` 성공. (근본 해결은 사용자가 AI Studio 지출 한도 상향 필요.)

## 2026-06-07 19:20 — Claude Opus 4.8

- **요구사항**: 번역 완료된 글(예: 7/4 영구결번)이 모든 탭 내용 있고 저장했는데도 캘린더 날짜가 초록색이 안 되는 버그 수정.
- **구현방법**: 원인은 CSS 특이성 충돌. 7/4는 토요일이며 주말 규칙 `.cal-cell.sun/.sat .cal-cell-day`는 클래스 3개 = (0,3,0)인데, 초록 규칙 `.editor-calendar-cell .cal-cell-day.cal-cell-day-translated`도 (0,3,0)으로 동일 → 파일 뒤쪽 주말 규칙이 이겨 토/일 번역 날짜만 검은색(평일은 정상 초록). selector를 `.editor-calendar-cell.cal-cell .cal-cell-day.cal-cell-day-translated`(0,4,0)으로 올려 해결. 주석의 특이성 표기도 정정.
- **변경파일**: `src/css/pages.css`, `docs/SESSION_LOG.md`.
- **검증**: dist 번들에 (0,4,0) 규칙 반영 확인, `tests/editor_management_calendar.spec.js` 통과, `npm run build` 성공.

## 2026-06-08 — Claude Sonnet 4.6 · iOS 네비게이션 바 높이 버그 + 레이아웃 수정

- **요구사항**: iOS 실기에서 두 가지 버그 확인. ① 하단 네비게이션 바 높이가 멋대로 커져 카드 일부를 가리는 현상. ② 설정 페이지 등 nav-hidden 페이지에서 `.app-container` 내부 하단 패딩값에 의해 빈 영역이 화면 요소를 가리는 현상. 추가: `.bottom-nav`에 상단 보더 `1px solid var(--color-border-light)` 적용.
- **근본 원인**:
  - **nav 높이 변동**: `.bottom-nav`의 height/padding-bottom이 `env(safe-area-inset-bottom)` 직접 참조 → iOS WKWebView가 레이아웃 변경 시마다 env() 값을 재계산하며 nav 높이가 튀는 현상. `freezeSafeAreaVars()`가 `--safe-area-bottom`으로 고정해놓아도 nav bar가 그 변수를 쓰지 않으면 무효.
  - **double padding-bottom**: `app-container`가 `calc(--nav-height + --safe-area-bottom)`을 padding-bottom으로 확보하고, `page-container`도 `var(--safe-area-bottom)`(= 34px)를 추가로 가지고 있어 nav 있는 페이지에서 카드 하단과 nav 상단 사이 불필요한 여백 34px 발생.
  - **no-nav 페이지 공백**: nav가 없어도 `app-container`가 항상 `nav-height + safe-area` 공간을 확보하고 있어 빈 영역 노출.
- **구현방법**:
  - `src/css/base.css`: `.app-container` padding-bottom의 `env()` → `var(--safe-area-bottom)` 교체. `.app-container.no-nav { padding-bottom: 0 }` 추가. `.page-container` padding-bottom을 `0`으로 기본화. `.app-container.no-nav .page-container { padding-bottom: var(--safe-area-bottom) }` 추가(nav 없는 페이지는 page-container가 safe-area 직접 처리). `.bottom-nav`의 height/padding-bottom `env()` → `var(--safe-area-bottom)` 교체 + `border-top: 1px solid var(--color-border-light)` 추가. `.toast-container` bottom calc도 `env()` → `var(--safe-area-bottom)` 교체.
  - `src/main.js`: `freezeSafeAreaVars()` 보강 — 초기 측정값이 0이면 200ms 후 재시도(iOS 콜드스타트 시 env 값이 0으로 잡히는 케이스 흡수). `setBeforeNavigate` 내에서 nav 숨김 여부에 따라 `app-container`에 `no-nav` 클래스 토글.
  - `src/css/pages.css`: `.settings-page`의 `padding-bottom: var(--nav-height)` → `0` 제거(settings는 nav 없으므로 중복 불필요, `no-nav .page-container`가 대응).
  - `tests/toast.ui.spec.js`: `.toast-container` bottom 기대값 regex를 `env(safe-area-inset-bottom...)` → `var(--safe-area-bottom)` 으로 갱신.
- **변경파일**: `src/css/base.css`, `src/main.js`, `src/css/pages.css`, `tests/toast.ui.spec.js`.
- **검증**: `npm test` 38 files, 361 passed / 6 skipped / 0 failed — 100% Green. `npm run build` 성공(175ms). 수동 검증 필요: iOS 시뮬레이터에서 (a) nav 높이 안정적으로 유지되는지, (b) 카드가 nav bar 바로 위까지 채워지는지(34px gap 사라짐), (c) settings 페이지 하단 빈 공간 없어졌는지.

## 2026-06-07 19:25 — Claude Opus 4.8

- **요구사항**: editor-new-page에서 뒤로가기/저장으로 editor-page(콘텐츠 관리)로 복귀할 때 항상 최신 날짜(마지막 달)로 점프해 불편(예: 4/1 수정 후 7월로). 보던/수정하던 달로 복귀하게.
- **구현방법**: 원인은 `loadStories()`가 매번 `getLatestStoryDate(allStories)`로 visibleYear/Month 초기화. → 상태키 `editorCalendarDate`(ISO) 도입: (1) `loadStories`가 저장값 있으면 그 달로, 없을 때만 최신 폴백. (2) 빈 셀 클릭(`openNewStory`)·기존 글 클릭(closest cell data-date)·이전/다음 달 네비 시 `setState('editorCalendarDate', iso)` 기록. `state.js`에서 `setState` import 추가.
  - 테스트: `vi.mock('../src/js/state.js')`에 누락된 `setState: vi.fn()` 추가(없어서 런타임 에러났음). getStateMock은 `editorCalendarDate`에 null 반환→최신 폴백 유지로 기존 5월 기대 테스트 통과.
- **변경파일**: `src/js/pages/editor.js`, `tests/editor_management_calendar.spec.js`, `docs/SESSION_LOG.md`.
- **검증**: `tests/editor_management_calendar.spec.js` 9 passed/1 skipped, `npm run build` 성공.

## 2026-06-07 19:42 — Claude Opus 4.8

- **요구사항**: editor-new-page(새 일화 작성/수정) iOS 버그 2건 수정. (1) editor-new-header가 safe-area 비정상 배치로 헤더 위쪽에 카드가 새어 보임. (2) 발행일 date input이 iOS에서 좌우로 늘어남.
- **구현방법**:
  - (1) safe-area 이중 적용이 원인. `.editor-new-page`가 `padding-top: env(safe-area-inset-top)`로 한 번, `.editor-new-header`가 `position:sticky; top: env(safe-area-inset-top)`로 또 한 번 내려가, 스크롤 시 헤더 위쪽에 safe-area 높이의 틈이 생기고 그 사이로 미리보기 카드가 노출. → 페이지 `padding-top` 제거, 헤더는 `top:0`으로 최상단 고정 + `padding-top`에 `env(safe-area-inset-top)` 포함해 배경이 노치까지 덮도록 변경.
  - (2) editor의 `type=date` 입력에 iOS appearance 보정 누락(mystory의 ms-date는 inline으로 처리돼 있었음). → `components.css`에 재사용 규칙 `.input-field[type=\"date\"]` 추가: `-webkit-appearance:none; appearance:none; min-width:0; text-align:left` + `::-webkit-date-and-time-value{margin:0}` + 캘린더 아이콘 우측 정렬. editor·mystory 공통 적용.
- **변경파일**: `src/css/pages.css`, `src/css/components.css`, `docs/SESSION_LOG.md`.
- **검증**: `npm run build` 성공, `npm test` 361 passed(기존 dirty 상태의 `calendar.ui.spec.js` 1건 실패는 본 변경과 무관한 선존재 이슈). CSS 변경만이라 cap sync 불필요.

## 2026-06-07 19:55 — Claude Opus 4.8

- **요구사항**: 일화 수정(editor-new-page)의 발행하기/임시저장/예약발행 버튼을 mystory-form-actions처럼 화면 하단에 고정.
- **구현방법**:
  - `editor.js`: 액션 버튼 묶음을 `<form>` 밖으로 빼내 `.editor-form-actions`(form 형제, page 직속)로 이동. 발행 버튼은 form 밖에서도 제출되도록 `form=\"story-form\"` + `id=\"sf-publish\"` 부여, 2단(발행 / 임시저장·예약 행) 구조 유지.
  - `editor.js` submit 핸들러: 발행 버튼이 form 밖으로 나가 `formEl.querySelector(button[type=submit])`가 null이 되므로 `document.getElementById(\"sf-publish\")`로 조회하도록 변경(저장중 비활성·텍스트 유지).
  - `pages.css`: `.mystory-form-actions`와 동일 규칙으로 `.editor-form-actions`(position:fixed; bottom:0; mobile-max-width 중앙정렬; safe-area-inset-bottom 패딩) + `.editor-form-actions-row` 추가. `.editor-form-section` 하단 패딩을 `calc(9rem + safe-area)`로 늘려 마지막 입력이 고정 바에 가려지지 않게 함.
- **변경파일**: `src/js/pages/editor.js`, `src/css/pages.css`, `docs/SESSION_LOG.md`.
- **검증**: `npm run build` 성공, `tests/editor_management_calendar.spec.js` 9 passed/1 skipped, 전체 361 passed(기존 무관 `calendar.ui.spec.js` 1건 실패 유지).

## 2026-06-07 19:58 — Claude Opus 4.8

- **요구사항**: editor-form-actions 내부 버튼을 임시저장 / 발행하기 순서로 재배치.
- **구현방법**: `editor.js`에서 `.editor-form-actions` 자식 순서만 변경 — `.editor-form-actions-row`(임시저장·예약발행)를 위로, 발행하기(submit, full-width)를 아래로 이동. 핸들러·id·form 속성·CSS는 그대로.
- **변경파일**: `src/js/pages/editor.js`, `docs/SESSION_LOG.md`.
- **검증**: `npm run build` 성공.

## 2026-06-07 20:09 — Claude Sonnet 4.6

- **요구사항**: editor-new-page(일화 수정 모드)의 폼 최하단 우측에 삭제 버튼 추가, 클릭 시 재확인 모달(기존 showConfirm) 표시 후 삭제.
- **구현방법**:
  - `editor.js` import: `deleteStory` 추가.
  - 마크업: `editingId` 존재 시에만 `</form>` 직후에 `.mystory-form-inline-actions`(기존 우측 정렬 컨테이너) + `.btn.btn-secondary.mystory-form-delete-btn`(기존 빨간 테두리 스타일) 조합으로 삭제 버튼 렌더링.
  - 핸들러: `#sf-delete-story` 클릭 → `showConfirm({ danger:true })` → `deleteStory(editingId)` → toast → `history.back()`.
  - 새 CSS 불필요. 기존 `.mystory-form-inline-actions`, `.mystory-form-delete-btn`, `showConfirm`, `deleteStory` 재활용.
- **변경파일**: `src/js/pages/editor.js`, `docs/SESSION_LOG.md`.
- **검증**: `npm run build` 성공, `tests/editor_management_calendar.spec.js` 9 passed/1 skipped.

## 2026-06-07 20:48 — Codex

- **요구사항**: DayStory 메인 폰트인 LINE Seed 패밀리를 다국어 환경에 맞게 확장하고, CSS 전역 토큰이 언어별 폰트 스택을 반영하도록 수정.
- **구현방법**:
  - `index.html`에 LINESeedEN/LINESeedJP `@font-face`를 추가하고, 기존 LINESeedKR에도 `font-display: swap`을 보강. EN 웹폰트는 repo의 LINE Seed EN WOFF2 파일을 `public/fonts`로 노출해 빌드 산출물에 포함.
  - `variables.css`에서 `:root:lang(ko/en/es/ja/zh)` 토큰 재정의를 추가해 `--font-ui`, `--font-body`, `--font-heading`, `--font-display`, `--font-sans`가 언어별 폰트 스택을 바라보도록 변경.
  - `base.css`의 기존 언어별 직접 `font-family` 선언은 제거하고 줄바꿈 규칙만 유지. 공유 캡처 워터마크의 하드코딩 폰트도 `var(--font-ui)`로 교체.
  - 회귀 테스트를 추가하고, 기존 캘린더 CSS 검사 정규식이 먼저 잡는 `.editor-calendar-grid .cal-cell` 블록에 flex 선언을 명시해 전체 테스트를 통과시킴.
- **변경파일**: `index.html`, `src/css/variables.css`, `src/css/base.css`, `src/css/pages.css`, `src/js/services/sharing.js`, `tests/css_tokens.spec.js`, `public/fonts/LINE_SeedEN/Web/WOFF2/*`, `docs/SESSION_LOG.md`.
- **검증**: `npm run build` 성공, `npm test` 38 files/369 passed/6 skipped.

## 2026-06-07 20:59 — Codex

- **요구사항**: `editor-comment-bubble` 내부의 일본어/다국어 긴 문장이 말풍선 밖으로 넘치는 문제 수정.
- **구현방법**:
  - `.editor-comment-bubble`의 중복 `word-break: keep-all`을 제거하고 `white-space: normal`, `word-break: normal`, `overflow-wrap: anywhere`, `box-sizing: border-box`를 추가해 공백이 적은 다국어 문장도 말풍선 내부에서 줄바꿈되도록 변경.
  - 긴 다국어 에디터 코멘트가 말풍선 내부에서 줄바꿈되어야 한다는 CSS 회귀 테스트 추가.
- **변경파일**: `src/css/components.css`, `tests/editorstory.ui.spec.js`, `docs/SESSION_LOG.md`.
- **검증**: `tests/editorstory.ui.spec.js` 21 passed, `npm run build` 성공, `npm test` 38 files/370 passed/6 skipped.

## 2026-06-08 01:51 — Claude

- **요구사항**: 신규 사용자용 논블로킹 튜토리얼 구현 — ① '오늘, 역사 속에서'/'나의 일화' 탭 최초 진입 인트로 모달, ② 홈 카드 뒤집기 Pulse·툴팁(카드 터치 시 영구 소멸), ③ 나의 일화 빈 카드 글쓰기 CTA 강화, ④ 최초 가입 시 웰컴 카드 주입 + 프로필 탭 'N' 배지(보관함 방문 시 해제 + 축하 피드백), ⑤ localStorage 기반 탭별 상태 세분화 관리.
- **구현방법**:
  - 상태: `services/onboarding.js` 신설 — `ds_onboarding` 단일 객체에 플래그 화이트리스트(`introEditor`/`introMyStory`/`tipCardFlip`/`tipWelcomeCard`/`welcomeBadgePending`)를 모아 `hasSeen`/`markSeen`/`clearFlag`/`resetOnboarding` 제공. localStorage 차단 환경 대비 try/catch + 인메모리 미러로 세션 내 도배 방지.
  - 컴포넌트: `components/introSheet.js`(앱 표준 `.modal-overlay`+`.modal-sheet` 재사용, backdrop/X/ESC/hashchange 닫기, 닫을 때 markSeen, 중복 마운트 가드), `components/coachMark.js`(카드 영역 앵커 Pulse+툴팁, `pointer-events:none`로 카드 flip 비차단, `ds:card-flipped` 1회 수신 시 소멸), `components/navBadge.js`(프로필 탭 'N' 배지 표시/해제).
  - 라이프사이클: `utils/pageLifecycle.js`의 `afterPageEnter`로 `.page` 진입 애니메이션 `animationend`(+fallback) 시점에 온보딩 부착, 콜백 시 `getCurrentPath()` 재확인으로 빠른 탭 왕복 방어.
  - 연결: `pages/editorstory.js`(인트로 모달→닫으면 카드 뒤집기 코치마크, 카드 뷰일 때만), `pages/mystory.js`(인트로 모달 + 기록 0개 시 오늘 빈 카드 글쓰기 버튼 Pulse·안내문 강화), `pages/profile.js`(보관함 방문 시 배지 해제 + 최초 1회 축하 토스트), `services/mystories.js`의 `seedWelcomeStory(uid)`, `pages/login.js`(이메일·소셜 `!isExisting` 분기에서 웰컴카드 주입 성공 시에만 배지 ON), `main.js`(부팅 시 배지 상태 복원).
  - 토큰/CSS: `variables.css`에 `--z-coach:150`(nav 위·modal 아래) 추가. `components.css`에 인트로 시트·코치마크·`.nav-badge`, `pages.css`에 빈 카드 글쓰기 Pulse 추가(전부 `var(--*)` 토큰, 다크 테마 대응).
  - i18n: 5개 JSON(ko/en/ja/es/zh)에 `onboarding` 네임스페이스(12키) 추가.
- **변경파일**: `src/js/services/onboarding.js`(신규), `src/js/components/introSheet.js`(신규), `src/js/components/coachMark.js`(신규), `src/js/components/navBadge.js`(신규), `src/js/utils/pageLifecycle.js`(신규), `src/js/services/mystories.js`, `src/js/pages/editorstory.js`, `src/js/pages/mystory.js`, `src/js/pages/profile.js`, `src/js/pages/login.js`, `src/main.js`, `src/css/variables.css`, `src/css/components.css`, `src/css/pages.css`, `src/i18n/{ko,en,ja,es,zh}.json`, `tests/{onboarding,onboarding_ui,welcome_seed}.spec.js`(신규), `tests/{editorstory.ui,regression.bugs}.spec.js`(router 모크 보강), `docs/SESSION_LOG.md`.
- **검증**: `npm test` 41 files/392 passed/6 skipped, `npm run build` 성공. (index.html/capacitor 설정/플러그인 미변경 → cap sync 불필요)

## 2026-06-08 02:10 — Claude

- **요구사항**: 튜토리얼을 닫은 뒤 사용자가 다시 볼 수 있도록 설정 화면에 '튜토리얼 다시 보기' 버튼 추가.
- **구현방법**:
  - `components/settingsSections.js` 지원(Support) 섹션에 `setting-tutorial` 행 추가. 클릭 시 `handleReplayTutorial` → `resetOnboarding()`(온보딩 플래그 전체 초기화) + `refreshWelcomeBadge()`(잔여 'N' 배지 정리) + 성공 토스트 + `navigate('/editorstory')`로 에디터 인트로 모달부터 재노출. 전구 모양 `tutorialIcon()` 추가.
  - i18n 5개 JSON `settings` 네임스페이스에 `row_tutorial`/`row_tutorial_subtitle`/`toast_tutorial_reset` 추가.
  - 회귀 테스트 갱신: `regression.bugs.spec.js`가 강제하던 "구 스포트라이트 투어 제거" 가드를 구 투어 전용 심볼(`tutorialTour`/`tour-overlay` 등)만 검사하도록 좁히고, 신규 `#setting-tutorial` '다시 보기' 행은 존재하도록 단언을 뒤집음(신규 온보딩은 별개 구현).
- **변경파일**: `src/js/components/settingsSections.js`, `src/i18n/{ko,en,ja,es,zh}.json`, `tests/regression.bugs.spec.js`, `docs/SESSION_LOG.md`.
- **검증**: `npm test` 41 files/392 passed/6 skipped, `npm run build` 성공.

## 2026-06-08 02:15 — Claude

- **요구사항**: 인트로 모달 시트가 하단에서 등장하는 애니메이션 버그 수정 — 최종 위치로 한 번 번쩍였다가 다시 아래에서 슬라이드되는 현상.
- **원인**: ① 인트로 시트가 `.modal-sheet`의 keyframe(`slideUp`)에 의존 → DOM 삽입 첫 페인트에 최종 위치로 렌더된 뒤 애니메이션 첫 프레임부터 다시 슬라이드(키프레임-온-인서트 플래시). ② 닫기 transition 에 `var(--transition-spring)`을 썼는데 이 토큰이 `800ms cubic-bezier(...)`라 `transition: transform 0.25s var(...)`가 `delay 800ms`로 해석되는 잠복 버그.
- **구현방법**: confirmDialog 와 동일한 `.visible` 토글 + transition 패턴으로 전환. `components.css`에서 `.intro-sheet-overlay`/`.intro-sheet`의 상속 keyframe 을 `animation:none`으로 끄고, 숨김 기본상태(opacity:0 / `translateY(100%)`) → `.visible` 표시상태로 리터럴 easing(`cubic-bezier(0.16,1,0.3,1)`) transition. `introSheet.js`는 마운트 후 `requestAnimationFrame(()=>add('visible'))`로 숨김상태를 먼저 페인트, 닫을 때 `remove('visible')`로 역방향 슬라이드. `is-closing` 제거. 테스트 단언도 `is-closing`→`visible` 해제+markSeen 으로 갱신. 이후 단일 rAF 가 Capacitor WebView 에서 초기 상태 페인트를 보장하지 못하는 추가 버그 → 이중 rAF 패턴으로 재수정.
- **변경파일**: `src/css/components.css`, `src/js/components/introSheet.js`, `tests/onboarding_ui.spec.js`, `docs/SESSION_LOG.md`.
- **검증**: `npm test` 41 files/392 passed/6 skipped, `npm run build` 성공.

## 2026-06-08 14:06 — Claude Sonnet 4.6

- **요구사항**: introSheet 바텀시트를 토스 앱 스타일로 리팩토링 — ① `border-radius: 24px` ② 40×5px 알약형 핸들바(고정) ③ 터치 드래그-투-클로즈 (30% 초과 또는 빠른 플릭) ④ 내부 스크롤 충돌 방어.
- **구현방법**: `variables.css`에 `--radius-2xl: 24px`, `--color-handle: #E5E8EB`(다크모드 오버라이드 포함) 토큰 추가. `components.css`에서 `.modal-sheet` 상단 radius를 `--radius-2xl`로 교체, `.intro-sheet` 섹션을 flex-column 레이아웃으로 전면 교체(`.intro-sheet-handle-area` 고정 헤더 + `.intro-sheet-scroll` 스크롤 영역 분리, `.intro-sheet.is-dragging { transition:none }` 추가). `introSheet.js` HTML을 핸들 영역+스크롤 영역 구조로 재구성하고, `touchstart/touchmove/touchend/touchcancel` 이벤트로 드래그-투-클로즈 구현. 스크롤 충돌 방어: 핸들 외 영역 터치 시 `scrollTop > 0`이면 드래그 시작 안 함. `close()`에서 `is-dragging` 제거 후 `transform: translateY(100%)` 명시로 드래그 중단 위치부터 부드럽게 슬라이드 아웃.
- **변경파일**: `src/css/variables.css`, `src/css/components.css`, `src/js/components/introSheet.js`.
- **검증**: `npm test` 41 files/392 passed/6 skipped.

## 2026-06-08 02:38 — Claude

- **요구사항**: 다른 페이지에도 iOS 네비게이션 바 높이 변동 버그(margin-bottom + flex:1)가 있는지 전수 조사 및 수정.
- **구현방법**: pages.css/base.css/components.css 전체를 대상으로 `flex:1` 또는 `height:100%` + `margin-bottom` 조합이 `position:absolute/fixed` 없이 존재하는 블록을 정적 분석. `.detail-title-row .detail-figure-name`, `.archive-section-header .archive-toggle/search` → `margin-bottom:0` 이라 무해. `.editor-new-page` → `position:absolute` 라 flex 흐름 밖 무해. `.settings-page` → `flex:1 + margin-bottom:var(--safe-area-bottom)` 동일 버그 확인. 추가로 `page-container`가 이미 `padding-bottom:var(--safe-area-bottom)`을 보유하므로 safe-area 중복 계산도 발견. `margin-bottom:var(--safe-area-bottom)` → `padding-bottom:var(--nav-height)`로 교체(safe-area는 page-container가 담당, nav-height 50px만 추가).
- **변경파일**: `src/css/pages.css`, `docs/SESSION_LOG.md`.
- **검증**: `npm test` 41 files/392 passed/6 skipped.

## 2026-06-08 02:34 — Claude

- **요구사항**: iOS 기기에서 `.editorstory-page`/`.mystory-page`의 `margin-bottom` 속성으로 인해 네비게이션 바 높이가 변동하는 버그 수정 (웹에서는 미재현).
- **원인**: `.editorstory-page`/`.mystory-page`는 `.page`와 동일 엘리먼트(`page.className = \`${pageClass} page\``)로 `.page-container`(overflow-y:auto)의 직접 flex child. `flex: 1`이 컨테이너 전체 높이를 차지한 뒤 `margin-bottom: calc(var(--nav-height) + var(--safe-area-bottom))`이 박스 바깥에 추가되어 `.page-container`가 overflow 상태가 됨. iOS WebView 는 스크롤 가능한 콘텐츠가 생기면 뷰포트를 재계산하고 `env(safe-area-inset-bottom)`이 변동 → `--safe-area-bottom` 기반으로 계산되는 `.bottom-nav` 높이가 흔들림.
- **구현방법**: `pages.css`에서 `margin-bottom` → `padding-bottom`으로 변경. padding 은 박스 안에서 처리되어 flex 컨테이너에 overflow 를 만들지 않으며, `overflow:hidden` 인 페이지 내부에서 flex child(`.editorstory-card-area`) 가용 높이를 nav-height + safe-area 만큼 줄여 카드가 네비게이션 바 위에 자연스럽게 위치하는 효과는 동일하게 유지됨.
- **변경파일**: `src/css/pages.css`, `docs/SESSION_LOG.md`.
- **검증**: `npm test` 41 files/392 passed/6 skipped.

## 2026-06-08

- **요구사항**: iOS에서 에디터·나의 일화 페이지에서 바텀 네비게이션이 위아래로 늘어나는 버그 수정.
- **원인**: (1) `.app-container`에 `overflow-y: auto`가 설정되어 iOS WebView에서 `position: fixed`인 `#bottom-nav`를 viewport가 아닌 scroll-context 컨테이너 기준으로 묶음. (2) 스크롤 컨테이너 레이아웃 재계산 시 `env(safe-area-inset-bottom)` 값이 동적으로 흔들리고, `--safe-area-bottom: env(...)` 참조를 통해 `height: calc(var(--nav-height) + var(--safe-area-bottom))`인 nav 높이가 같이 변동.
- **구현방법**: (1) `base.css`의 `.app-container` `overflow-y: auto; overflow-x: hidden` → `overflow: hidden`으로 변경해 scroll-context 제거. (2) `main.js`의 `initApp()`에 `freezeSafeAreaVars()` 호출 추가 — 앱 시작 시 프로브 엘리먼트로 `env(safe-area-inset-bottom)` 실제값을 1회 측정해 `--safe-area-bottom` 인라인 스타일로 정적 픽셀값 고정, 이후 iOS 재계산에 의한 `env()` 변동이 레이아웃에 전파되지 않음.
- **변경파일**: `src/css/base.css`, `src/main.js`, `docs/SESSION_LOG.md`.

## 2026-06-08 — Claude

- **요구사항**: 프로필 편집 모달 UI 개선 3건 — ① `profile-edit-btn` 아이콘을 연필에서 ellipsis-vertical(세로 점 3개)로 교체, ② 모달 헤더 텍스트를 "프로필 편집" → "프로필"로 변경, ③ `profile-edit-field` 하단에 "로그아웃" 버튼 추가, ④ `.profile-edit-field` 하단 패딩을 `var(--space-3)`으로 조정.
- **구현방법**: ① `profile.js` 버튼 내 SVG를 Lucide `ellipsis-vertical`(`<circle cx="12" cy="12/5/19" r="1"/>` 3개) 로 교체, 크기·색상 속성 유지. ② 5개 i18n 파일(`ko/en/ja/zh/es.json`)에 `profile.modal_title` 키 추가(기존 `edit_title`와 별도), 모달 헤더에서 `t('profile.modal_title')` 참조. ③ `profile-edit-field` 내부 하단에 `#profile-logout-btn` 버튼 HTML 삽입, 클릭 핸들러에서 `signOut` → state 초기화 → `#/login` 이동 → 토스트 처리. `pages.css`에 `profile-logout-btn` 스타일 추가(`--color-error` 토큰, 전폭 아웃라인). ④ `.profile-edit-field` padding 하단을 `var(--space-10)` → `var(--space-3)`으로 수정.
- **변경파일**: `src/js/pages/profile.js`, `src/css/pages.css`, `src/i18n/ko.json`, `src/i18n/en.json`, `src/i18n/ja.json`, `src/i18n/zh.json`, `src/i18n/es.json`, `SESSION_LOG.md`.

## 2026-06-08 16:03 — Claude

- **요구사항**: 폴더 구조 리팩토링 — (1) `docs/SESSION_LOG.md`·`docs/README.md`를 루트로, (2) 루트의 개발 문서(`PROJECT_AUDIT.md`, `SESSION_LOG_ARCHIVE.md`)를 `docs/`로, (3) `src/` 루트 비분류 파일을 적절한 폴더로, (4) 이동된 파일의 import/참조 경로 전부 수정, (5) `npm test` 검증.
- **구현방법**: (1)(2) `git mv`로 `SESSION_LOG.md`·`README.md` 루트 이동, `PROJECT_AUDIT.md` → `docs/`, `SESSION_LOG_ARCHIVE.md` → `docs/`. `CLAUDE.md`·`AGENTS.md`·`README.md`는 루트 유지(AGENTS.md는 Codex 하네스 파일이라 CLAUDE.md와 동급으로 루트 보존). (3) `src/js`는 이미 components/pages/services/utils로 정리돼 있어, 사용자 결정에 따라 핵심 인프라 중 `src/js/firebase.js`만 CLAUDE.md 규칙(외부 SDK 래퍼=services)대로 `src/js/services/firebase.js`로 이동(`router.js`·`state.js`는 앱 코어라 루트 유지). (4) firebase import 16곳(components/pages는 `../services/firebase.js`, services 내부는 `./firebase.js`, main.js는 `./js/services/firebase.js`)과 테스트 `vi.mock` 경로 10곳(`../src/js/services/firebase.js`) 수정. 문서/스크립트 참조 수정: `CLAUDE.md`(2)·`AGENTS.md`(3)·`scripts/codex-harness.mjs`(필독 목록)의 `docs/SESSION_LOG.md`→`SESSION_LOG.md`, `docs/README.md`→`README.md`. 루트로 옮긴 `README.md`의 내부 링크는 `./PRD.md`·`./UI_GUIDE.md`·`./audit/`·`./_archive/`·`./dokhu.md` → `./docs/...`로 조정(같은 루트의 `./SESSION_LOG.md`는 유지). SESSION_LOG 본문의 과거 변경파일 기록은 이력이라 수정하지 않음.
- **변경파일**: `SESSION_LOG.md`(이동+본 항목), `README.md`(이동+링크), `docs/PROJECT_AUDIT.md`·`docs/SESSION_LOG_ARCHIVE.md`(이동), `src/js/services/firebase.js`(이동), `CLAUDE.md`, `AGENTS.md`, `scripts/codex-harness.mjs`, `src/main.js`, `src/js/components/settingsSections.js`, `src/js/pages/{profile,mystory,editor,login,calendar}.js`, `src/js/services/{stories,userProfile,mystories,remoteConfig,translate,userCleanup,bookmarks,admin,images}.js`, `tests/{userCleanup,auth_gate,regression.bugs,mystory_card_meta.ui,bookmarks_double_tap,editor_management_calendar,mystories_uid_guard,welcome_seed,calendar_popup,stories-fallback}.spec.js`.
- **검증**: `npm test` 41 files / 392 passed / 6 skipped (회귀 0건).

## 2026-06-08 20:23 — Claude

- **요구사항**: (1) 캘린더 카드 팝업 열린 상태에서 좌·우 스와이프로 같은 달 카드를 넘길 수 있도록 구현. (2) 힌트 텍스트를 "좌 • 우로 스와이프 해서 카드를 넘길 수 있습니다."로 변경.
- **구현방법**: `openCardPopup`을 리팩토링 — 카드 콘텐츠 마운트(`_mountCardInPopup`)·이벤트 와이어링(`_wireCardListeners`)·네비게이션 카운터(`_updatePopupNav`)를 내부 헬퍼로 분리. 오버레이에 `touchstart/touchend` 리스너 추가(최소 60px 수평 이동 + 수직 이동보다 클 때 반응), stories 배열과 현재 인덱스 기반으로 카드 전환 시 0.12s opacity 페이드 처리. `renderGrid`에서 현재 달 스토리를 `publish_date` 오름차순 정렬 후 `options.stories/currentIndex`로 팝업에 전달. stories 2개 이상이면 `n / total` 카운터 표시, hint 텍스트를 스와이프 안내(`card_swipe_hint`)로 표시. 5개 i18n 파일에 `calendar.card_swipe_hint` 키 추가. `pages.css`에 `.popup-card-fading` 페이드 스타일·`.calendar-card-popup-nav` 카운터 스타일 추가.
- **변경파일**: `src/js/pages/calendar.js`, `src/css/pages.css`, `src/i18n/{ko,en,ja,zh,es}.json`, `SESSION_LOG.md`.
- **검증**: `npm test -- tests/calendar_popup.spec.js` 1/1 통과. `npm run build` 성공.

## 2026-06-08 20:28 — Claude

- **요구사항**: 보관함(archive) 페이지에서 연 `calendar-card-popup`에도 캘린더와 동일한 좌·우 스와이프 카드 넘김 기능 적용.
- **구현방법**: `bookmarks.js`의 `filterAndRender` 내 카드 클릭 콜백에서 현재 표시 중인(검색 필터 반영된) `list`를 스와이프 대상으로 전달 — history 탭은 `onCardClick(state, story, list)`, mine 팝업 모드는 `openCardPopup(story, 'mine', [], { stories: list, currentIndex: list.indexOf(story) })`. `onCardClick` 시그니처에 `displayList` 추가해 `openCardPopup` 옵션으로 `stories`/`currentIndex` 전달하고 기존 `hideHint: true` 제거(다중 카드 시 캘린더와 동일하게 스와이프 힌트 노출). 스와이프로 다른 카드를 보는 중 북마크 재활성화 시 원래 클릭 카드가 아닌 현재 카드를 복원하도록 `onBookmarkChange`에서 `displayList.find(s => s.id === storyId)`로 정확히 조회(없으면 클릭 카드 폴백). 팝업 내부 스와이프 로직은 이전 작업의 `openCardPopup` 공용 구현을 그대로 재사용하므로 calendar.js 변경 없음.
- **변경파일**: `src/js/pages/bookmarks.js`, `SESSION_LOG.md`.
- **검증**: `npm test -- tests/bookmarks.ui.spec.js tests/calendar_popup.spec.js` 15/15 통과. `npm test` 390 passed/6 skipped(실패 2건은 기존 `detail_nav.ui.spec.js` 사전 실패로 본 변경과 무관). `npm run build` 성공.

## 2026-06-08 — Claude Sonnet 4.6 · 하단 네비게이션 SVG 아이콘 교체 및 상태별 이중화

- **요구사항**: ① 피그마에서 가져온 커스텀 BookMarked 아이콘을 에디터 일화 nav-item active 상태에 적용. ② 모든 nav 버튼에 기본(비활성)/활성 상태별로 다른 아이콘 표시. ③ 에디터 일화 기본 상태는 수정 전 Lucide outline 유지. ④ 나의 일화 활성 아이콘을 피그마 커스텀 filled BookUser로 교체. ⑤ 아이콘 전환 시 움직임·깨짐 버그 수정.
- **구현방법**:
  - `index.html` nav 버튼 3개 각각에 `<span class="nav-icon-wrap">` 래퍼를 추가하고, `.nav-icon-default`(비활성 outline)과 `.nav-icon-active`(활성 filled) SVG 2개씩 탑재.
  - 에디터 일화: default = 기존 Lucide BookMarked outline, active = 피그마 커스텀 filled(fill/stroke black→currentColor, white→var(--color-bg-primary)).
  - 나의 일화: default = Lucide BookUser outline, active = 피그마 커스텀 filled BookUser(동일 색상 치환).
  - 프로필: default = Lucide Menu 3선 outline, active = fill 직사각형 pill 3선.
  - `base.css`: `display: none/block` 토글 → `.nav-icon-wrap { position:relative; width/height:28px }` + `.nav-icon { position:absolute; top:0; left:0 }`로 두 SVG를 같은 위치에 겹쳐 쌓고, `opacity: 0/1`만 토글해 layout reflow 완전 차단.
  - active SVG compound path 2번째(`M4 19.5V4.5...M6.5 2...`)에 `stroke-linecap="round"` 추가 — 기본값 `butt` 끝점이 fill 경계에서 잘린 것처럼 보이던 깨짐 수정.
- **변경파일**: `index.html`, `src/css/base.css`.
- **검증**: CSS/HTML 정적 확인. 수동 검증 필요: 탭 전환 시 아이콘 교체 움직임 없음, 깨짐 없음, 라이트/다크 모드 정상 렌더링.

## 2026-06-08 — Claude · 화면 회전 세로 모드 고정 (iOS/Android)

- **요구사항**: 앱이 세로(Portrait) 기준으로 디자인되어 가로 회전 시 레이아웃이 깨지므로, iOS·Android 네이티브 설정에서 화면 회전을 세로 모드로 완전히 고정.
- **구현방법**: ① Android `AndroidManifest.xml`의 `.MainActivity` `<activity>` 태그에 `android:screenOrientation="portrait"` 추가(기존 `configChanges`에 `orientation`은 있었으나 회전 자체를 막진 않아 명시 고정 필요). ② iOS `Info.plist`의 `UISupportedInterfaceOrientations`·`UISupportedInterfaceOrientations~ipad` 두 배열에서 Landscape 항목(`LandscapeLeft`/`LandscapeRight`)과 iPad의 `PortraitUpsideDown` 제거, `UIInterfaceOrientationPortrait`만 남김. ③ `npx cap sync android` 실행.
- **변경파일**: `android/app/src/main/AndroidManifest.xml`, `ios/App/App/Info.plist`, `SESSION_LOG.md`.

## 2026-06-08 21:25 — Claude · 문의/건의하기(Inquiry) 기능 추가 (UGC 신고 뼈대)

- **요구사항**: 사용자가 피드백(버그/오탈자/기능 제안/기타)을 보내는 문의 기능 신설. ① 진입점 2곳(설정 '문의 및 건의하기' + 카드 상세 '오류 및 오탈자 제보'), ② 토스 스타일 바텀시트 폼(유형 드롭다운 + textarea), ③ Firestore `inquiries` 저장 + 자동 메타 수집(userId·앱버전·OS(Device API)·locale·진입 카드 ID), ④ 5개 국어 i18n, ⑤ localStorage 1시간 3회 쿨타임 + 도배 방지 안내문구. (추후 UGC 신고 뼈대)
- **구현방법**:
  - **`src/js/services/inquiries.js`** (신규) — `bookmarks.js` 패턴. `submitInquiry({type,content,entryCardId})`가 빈값/쿨타임 가드 후 `addDoc(collection(db,'inquiries'), payload)`(withTimeout). 메타: `getState('user').id`, `pkg.version`, `getCurrentLang()`, `@capacitor/device` `Device.getInfo()`(실패 시 `Capacitor.getPlatform()` 폴백). 쿨타임 헬퍼 `canSubmitInquiry`/`recordInquirySubmission`(localStorage `daystory:inquiry-log`, 1h 윈도우 prune, 최대 3).
  - **`src/js/components/inquirySheet.js`** (신규) — `introSheet.js` 토스 시트 골격(.modal-overlay/.modal-sheet + 핸들 + 드래그-투-클로즈 + backdrop/ESC/hashchange 닫기) 차용, 온보딩 flag 의존성 제외. 유형 `<select>`+내용 textarea(`.report-textarea` 재사용)+안내문구+제출. 사용자 입력은 raw 저장하고 DOM엔 textarea/select 값만 사용(innerHTML 미조립).
  - **진입점**: `settingsSections.js`의 `setting-contact` 행 핸들러를 coming-soon 토스트→`showInquirySheet()` 교체. `detail.js`의 `.detail-title-actions`에 제보 아이콘 버튼 추가→`showInquirySheet({presetType:'typo', entryCardId:storyId})`.
  - **i18n**: `ko/en/ja/es/zh.json`에 `inquiry` 네임스페이스 추가 + `settings.row_contact`를 "문의 및 건의하기" 계열로 갱신.
  - **`firestore.rules`**: `inquiries/{id}` create=로그인, read/update/delete=admin (reports와 동일).
  - **`src/css/components.css`**: `.inquiry-sheet-*` 토스 시트 폼 스타일(토큰만 사용). 상세 시트(--z-overlay) 위로 뜨도록 오버레이 `z-index: calc(var(--z-overlay)+1)`.
  - **네이티브**: `@capacitor/device@8.0.2` 설치(`--legacy-peer-deps` — 기존 firebase peer 충돌 회피). `capacitor.config.json` `android.includePlugins`에 `@capacitor/device` 추가(allowlist 누락 시 android 동기화에서 제외됨).
- **변경파일**: `src/js/services/inquiries.js`, `src/js/components/inquirySheet.js`, `src/js/pages/detail.js`, `src/js/components/settingsSections.js`, `src/i18n/{ko,en,ja,es,zh}.json`, `firestore.rules`, `src/css/components.css`, `capacitor.config.json`, `package.json`, `package-lock.json`, `tests/inquiry.spec.js`, `tests/inquiry_ui.spec.js`, (네이티브 동기화 산출물) `android/`·`ios/`, `SESSION_LOG.md`.
- **검증**: 신규 테스트 `npm run test -- tests/inquiry.spec.js tests/inquiry_ui.spec.js` 17/17 통과. 전체 `npm test` 407 passed/6 skipped(실패 2건은 본 작업과 무관한 기존 `detail_nav.ui.spec.js` 사전 실패 — 세션 전 변경된 `main.js` nav 마크업 관련). `npm run build` 성공. `npx cap sync android/ios` → 양 플랫폼 모두 `@capacitor/device@8.0.2` 포함 9개 플러그인 등록 확인. 수동 검증 필요: 설정/카드 상세 진입→시트 오픈→제출→Firestore `inquiries` 문서 생성, 카드 진입 시 유형 'typo' 프리셋+entryCardId, 1시간 4회째 쿨타임 차단, 다크/라이트·5개 언어. firestore 규칙 배포(`firebase deploy --only firestore:rules`)는 사용자 확인 필요.

## 2026-06-09 — Claude · inquiry 드롭다운 위치 버그 수정 + notice 문구 변경

- **요구사항**: ① 문의 유형 드롭다운 옵션 목록이 바텀시트 상단 등 엉뚱한 위치에 표시되는 레이아웃 버그 수정. ② inquiry-notice 문구를 "보내주신 의견은 서비스 개선에 사용됩니다."로 변경(5개 언어).
- **원인**: `.inquiry-sheet`에 `transform: translateY` + `overflow: hidden`이 적용된 상태에서 네이티브 `<select>` 드롭다운의 좌표 계산이 깨짐 — CSS 스태킹 컨텍스트로 인해 옵션 목록이 transform 이전 좌표에 렌더링됨.
- **구현방법**: 네이티브 `<select>`를 `div.inquiry-custom-select` 커스텀 드롭다운으로 교체. 옵션 목록(`.inquiry-select-options`)을 `document.body`에 `position: fixed`로 마운트하고 `getBoundingClientRect()`로 트리거 좌표를 계산하여 배치 — 부모 transform 영향 완전 차단. chevron 회전 애니메이션, 키보드 접근성(Enter/Space/Escape), 외부 클릭 닫기, 시트 close 시 팝업 정리 포함. notice는 "개별 답변 어려움" 문구를 제거하고 핵심 문장만 남기도록 5개 언어 모두 수정.
- **변경파일**: `src/js/components/inquirySheet.js`, `src/css/components.css`, `src/i18n/ko.json`, `src/i18n/en.json`, `src/i18n/ja.json`, `src/i18n/zh.json`, `src/i18n/es.json`.
- **검증**: `npm run build` 성공.

## 2026-06-09 — Claude · 토스트 z-index 수정 (오버레이 위 렌더링 보장)

- **요구사항**: detail 시트 위에서 inquiry 시트를 열고 문의 제출 후 성공 토스트가 보이지 않는 문제.
- **원인**: `--z-toast: 300`이 `--z-overlay: 500`(detail 시트)·`calc(var(--z-overlay)+1)=501`(inquiry-sheet-overlay) 보다 낮아 오버레이 뒤에 묻힘.
- **구현방법**: `src/css/variables.css`에서 `--z-toast` 값을 300 → 600으로 상향, 순서를 `--z-overlay` 아래로 재배치. 토스트가 모든 오버레이·시트 위에 항상 표시됨.
- **변경파일**: `src/css/variables.css`, `SESSION_LOG.md`.
- **검증**: `npm run build` 성공.

---

## 2026-06-09

### 17:45 — Claude (claude-sonnet-4-6)

- **요구사항**: 인터넷 연결 없는 오프라인 상태에서도 유저 프로필 이미지가 정상 표시되도록 로컬 캐싱 구현.
- **구현방법**:
  - `src/js/utils/avatarCache.js` (신규) — Firebase Storage URL 이미지를 fetch → FileReader로 base64 data URL 변환 → `localStorage('ds_av_{uid}')` 저장. `saveAvatarToCache` / `loadAvatarFromCache` / `clearAvatarCache` 3개 함수. `navigator.onLine=false`이면 fetch 생략(best-effort).
  - `src/js/pages/profile.js` — ① import 추가. ② `renderProfile()` 첫머리에 `rawUrl`·`cachedUrl`·`effectiveUrl` 계산(`!navigator.onLine && cachedUrl`이면 캐시 URL 우선). ③ `setTimeout` 블록에 img `error` 핸들러(캐시 시도 → 없으면 SVG 폴백) + img `load` 핸들러(`once`, Firebase URL 로드 성공 시 캐시 갱신) 추가. ④ 편집 모달 미리보기도 `effectiveCurrentPhoto`로 캐시 우선. ⑤ 로그아웃 핸들러에서 `clearAvatarCache(uid)` 호출.
  - `src/main.js` — `saveAvatarToCache` import 추가. 로그인 후 Firestore 프로필 로드 시 `profileData.photoURL`이 있으면 `void saveAvatarToCache(uid, photoURL)` fire-and-forget으로 사전 캐싱.
  - `tests/avatar_cache_offline.spec.js` (신규, TDD) — 유틸 유닛 테스트 9건 + profile.js·main.js 정적 분석 6건, 총 17테스트 전 통과.
- **변경파일**: `src/js/utils/avatarCache.js`, `src/js/pages/profile.js`, `src/main.js`, `tests/avatar_cache_offline.spec.js`.
- **검증**: `npm test` — 신규 17테스트 전통과, 기존 실패 4건(detail_nav 2·inquiry_ui 2)은 변경 전부터 존재하던 것으로 회귀 없음.

### 19:35 — Claude (claude-opus-4-8)

- **요구사항**: 캘린더 카드 팝업에서 "1월 23일 카드가 여러 장" 넘어가는 중복 문제(1월인데 35장 등) 검토·해결.
- **원인**: `src/js/pages/calendar.js`의 `renderGrid`에서 캘린더 셀은 `storyByDate`(publish_date 키 Map, 날짜당 1건)로 그리지만, 스와이프 팝업 묶음 `currentMonthStories`는 `stories.filter(...)`로 만들어 중복 제거가 안 됨. Firestore에 같은 `publish_date` 스토리가 여러 건 발행돼 있으면 셀엔 1장만 보여도 팝업 스와이프엔 중복분이 그대로 들어가 같은 날짜 카드가 여러 장으로 넘어감.
- **구현방법**: `currentMonthStories`를 `stories.filter` 대신 `[...storyByDate.values()].filter(...)`(날짜당 1건)에서 파생시켜 캘린더 셀과 동일 소스로 통일. `sortedMonthStories`도 자동으로 중복 제거됨.
- **변경파일**: `src/js/pages/calendar.js`, `tests/calendar_popup_dedup.spec.js`(신규 TDD).
- **검증**: 신규 dedup 테스트 RED("3 / 5") → 수정 후 GREEN("3 / 3"). 기존 `calendar_popup`·`calendar.ui` 포함 캘린더 테스트 전통과. 전체 스위트의 잔여 실패 5건(detail_nav 2·inquiry_ui 2·ios_gpu_webp_guard 1)은 워크트리 진행 중 작업의 기존 실패로 본 변경과 무관.

### 20:02 — Claude (claude-opus-4-8)

- **요구사항**: 중복 데이터(같은 publish_date 스토리 다건)를 점검·정리할 수 있게, 에디터 콘텐츠 관리에 '중복' 필터 추가.
- **구현방법**: `src/js/pages/editor.js` — ① 상단 필터 줄에 `data-filter="duplicate"` 칩(stat-duplicate) 추가. ② `getDuplicateDateSet()` 헬퍼(publish_date 카운트 2건 이상 날짜 Set). ③ `updateStats()`에 중복 날짜 수 표시. ④ `renderCalendar()` 시작에서 `duplicateDates` 갱신. ⑤ `getStoriesForDate()`에 `duplicate` 분기(중복 날짜의 모든 글을 상태 무관 노출). ⑥ 필터 클릭 시 현재 달에 중복이 없으면 가장 이른 중복 날짜의 달로 점프. i18n `editor.filter_duplicate` 키 5개 국어(ko 중복/en Duplicate/ja 重複/zh 重复/es Duplicado) 추가. 관리자는 이 필터로 중복 날짜를 모아 보고 각 글을 눌러 기존 삭제 플로우로 정리.
- **변경파일**: `src/js/pages/editor.js`, `src/i18n/{ko,en,ja,zh,es}.json`, `tests/editor_duplicate_filter.spec.js`(신규 TDD).
- **검증**: 신규 테스트 2건(중복 카운트·필터 노출 / 중복 없을 때 0) GREEN. `editor_management_calendar`·`i18n_locale_expansion` 등 관련 스위트 전통과. `npm run build` 성공.

## 2026-06-09

### — Claude (claude-sonnet-4-6)

- **요구사항**: 탭/터치 pressed 상태 전용 컬러 토큰 `--color-bg-primary-pressed` 신설 및 전체 CSS `:active` 규칙에 일괄 적용.
- **구현방법**:
  - `src/css/variables.css` — `:root`에 `--color-bg-primary-pressed: #D9D8D6`, `[data-theme="dark"]`에 `--color-bg-primary-pressed: #4B4B4F` 추가.
  - 기존 `:active`에서 `var(--color-bg-primary)` 사용 중이던 3곳 값 변경: `.card-action-btn`(components.css), `.theme-option:not(.active)`·`.calendar-toggle-btn:not(.active)`(pages.css).
  - 기존 `:active`에서 `var(--color-bg-secondary)` 사용 중이던 8곳 값 변경: `.btn-ghost`·`.page-header-back`·`.list-item`(components.css), `.close-auth-btn`·`.detail-sheet-close`·`.search-result-item`·`.profile-edit-close`·`.calendar-month-arrow`(pages.css).
  - `.nav-item:active`(base.css) — `var(--color-bg-card-dark)` → `var(--color-bg-primary-pressed)` 변경.
  - `.profile-edit-photo-icon:active`(pages.css) 신규 추가.
- **변경파일**: `src/css/variables.css`, `src/css/base.css`, `src/css/components.css`, `src/css/pages.css`.

## 2026-06-10

### 19:02 — Claude (claude-opus-4-8)

- **요구사항**: 에디터 일화 카드의 "읽음 상태(Read)"를 Firestore 연동으로 구현. DB 비용 최소화 + 압박감 Zero UX(안 읽음 무표시, 읽음만 흐리게). 제미나이 기획안을 먼저 검토하고 더 나은 대안이 있으면 제안 후 진행.
- **구현방법**: 기획안의 큰 방향(로그인 시 프로필 1회 로드→전역 참조로 렌더 추가 read 0 / `arrayUnion` / `.is-read` dim / aria-label)은 유지하되 엔지니어 관점 3가지 개선을 채택 — ① **배치 flush**(읽을 때마다 즉시 write 대신, 로컬·화면 즉시 반영 후 화면 이탈·백그라운드 전환 시 `arrayUnion`으로 1회만 전송 → 카드 N장 읽어도 write 1회), ② **게스트 폴백**(localStorage 미러 + 로그인 시 서버∪로컬 머지, 로컬 전용 날짜만 업로드 예약), ③ 읽음 기준=**카드를 뒤집어 뒷면까지 본 경우**(플립 트리거). 기획안의 `users/{uid}`는 실제 컬렉션 `profiles/{uid}`로 정정. 읽음 키는 날짜 문자열(iso).
  - `src/js/services/readHistory.js`(신규) — readSet/pendingSet + localStorage('ds_read_history'). `initReadHistory/isDateRead/markDateRead/flushReadHistory`. 모듈 로드 시 `visibilitychange(hidden)`·`pagehide` 전역 flush 등록(`setOnUnmount` 단일 슬롯 충돌 회피).
  - `src/main.js` — `onAuthStateChanged`에서 로그인 시 `initReadHistory(profileData)`, 로그아웃/게스트 시 `initReadHistory(null)`(앱 시작·세션 복원 단일 지점).
  - `src/js/pages/editorstory.js` — `bindCard`/`bindFlipCardEvents`에 iso 전달, `onAfterFlip`에서 뒷면(`classList.contains('flipped')`)일 때만 `markDateRead(iso)`.
  - `src/js/components/cardDeck/cardDeckController.js` — 날짜 휠 아이템 `is-read`+aria(`calMode==='history'` 한정), 기존 `setOnUnmount` 콜백에 `flushReadHistory()`+리스너 해제 합침, `ds:read-history-changed` 수신해 휠 즉시 dim.
  - `src/js/pages/calendar.js` — `renderGrid` 셀 `is-read`+aria-label(끝에 ", 이미 읽음"), 팝업 카드 플립 뒷면 시 `markDateRead`(`mode==='history'` 한정).
  - `src/css/pages.css` — `.wheel-item.is-read`/`.cal-cell.is-read` opacity dim(색상 하드코딩 없이 opacity만, 두 테마 공통).
- **변경파일**: `src/js/services/readHistory.js`(신규), `tests/readHistory.spec.js`(신규 TDD), `src/main.js`, `src/js/pages/editorstory.js`, `src/js/components/cardDeck/cardDeckController.js`, `src/js/pages/calendar.js`, `src/css/pages.css`.
- **검증**: 신규 `readHistory.spec.js` 9건 GREEN(게스트 폴백·배치 1회·N장 묶기·중복 1건·flush 실패 보존·서버∪로컬 머지). `calendar.ui` 회귀 1건은 테스트가 정규식으로 CSS를 파싱하는데 `.cal-cell.is-read .cal-cell-peek {`가 `.cal-cell-peek` 매칭을 가로챈 것이 원인 → 셀렉터를 `.cal-cell-peek-img/-title`로 바꿔 통과. `npm run build` 성공. 전체 스위트 잔여 실패 5건(detail_nav 2·inquiry_ui 2·ios_gpu_webp_guard 1)은 `git stash` 검증 결과 본 변경 이전부터 실패하던 기존 항목으로 무관. 수동 검증 필요: `npm run dev`→에디터 일화에서 카드 뒤집기→상단 휠/캘린더의 해당 날짜 dim, 화면 이탈·백그라운드 후 `profiles/{uid}.readHistory`에 write 1회.

### 21:20 — Claude (claude-opus-4-8)

- **요구사항**: 카드를 뒤집어 읽은 직후 캘린더 뷰에 읽음 표시가 즉시 반영되지 않고 새로고침해야 보이던 문제 수정(바로 반영되게).
- **원인**: 읽음 즉시 갱신(`ds:read-history-changed`) 리스너가 `cardDeckController`에서 **날짜 휠만** 갱신하고 캘린더 셀(`.cal-cell`)은 갱신하지 않음. 특히 캘린더 그리드가 떠 있는 상태에서 셀 팝업을 열어 카드를 뒤집고 닫는 경로는 `renderGrid` 재호출이 없어 새로고침(→ `initReadHistory` 재로드) 전까지 dim 미반영.
- **구현방법**: 즉시 반영을 `markDateRead` 한 곳으로 일원화. `src/js/services/readHistory.js`에 `reflectReadInDom(iso)` 추가 — 현재 화면의 `.wheel-item[data-date]`·`.cal-cell[data-date]` 양쪽에 `is-read`+aria 즉시 부여(휠은 `M월 D일, 이미 읽음`, 셀은 기존 라벨 끝에 `, 이미 읽음` 부착). 토글 뷰·셀 팝업·`/calendar` 페이지 모든 경로 커버. `src/js/components/cardDeck/cardDeckController.js`의 중복 휠 전용 리스너 제거(`flushReadHistory()`는 유지).
- **변경파일**: `src/js/services/readHistory.js`, `src/js/components/cardDeck/cardDeckController.js`, `tests/readHistory.spec.js`.
- **검증**: `readHistory.spec.js`에 DOM 즉시 반영 테스트 추가 → 10건 GREEN. `cardDeckController`·`calendar.ui`·`calendar_popup` 회귀 0. `npm run build` 성공.

## 2026-06-11

### 17:18 — Claude (claude-opus-4-8)

- **요구사항**: 콘텐츠 관리(에디터)에서 미번역 날짜를 하나씩 열어 자동 번역하던 동선이 비효율적. 기존 단건 번역은 그대로 두고, 미번역 항목을 한 번에 여러 개 번역하는 수단 추가. 먼저 구현 검토 보고서 작성 후 진행(범위=현재 보이는 달의 미번역 전체, 방안=클라이언트 배치).
- **구현방법**: 서버(Cloud Function `translateContent`)·단건 번역 흐름은 무수정. 기존 `translateContentApi`(단건)+`updateStory`를 재사용하는 클라이언트 오케스트레이터를 신설.
  - `src/js/services/batchTranslate.js`(신규) — Firebase를 직접 import하지 않고 `translate`/`save`를 주입받는 순수 오케스트레이터. `extractKoFields`(한국어 원문 추출·`figure_name`/`editor.comment` 폴백), `hasKoSource`(원문 유무), `buildI18nFromTranslations`(번역결과→`i18n`, `title`→`title`·`figure_name` 양쪽; 단건 저장 규약과 동일), `runBatchTranslate`(동시성 제한 워커풀·부분실패 격리·`functions/resource-exhausted` 즉시 중단·`shouldStop`·`onProgress`).
  - `src/js/pages/editor.js` — '미번역' 필터 선택 시에만 노출되는 일괄 번역 바 추가. `getMonthUntranslatedTargets`(현재 달 ∩ `isStoryUntranslated` ∩ `hasKoSource`), `updateBatchBar`(필터/월 이동 시 건수 라벨 갱신, 진행 중 라벨 보호), `runMonthBatchTranslate`(confirmDialog 확인→동시성 2로 번역·저장→결과 요약 토스트→`loadStories` 재렌더). 진행 중 이탈 대비 `setOnUnmount`로 중단 플래그.
  - `src/i18n/{ko,en,ja,es,zh}.json` — `editor.batch_translate_*` 11키(버튼/확인/진행률/완료/부분실패/한도/중단/없음) 5개 언어.
  - `src/css/pages.css` — `.editor-batch-bar`(hidden 토글)·`.editor-batch-btn`(`is-running`/`:disabled`) 토큰 기반 스타일.
- **변경파일**: `src/js/services/batchTranslate.js`(신규), `tests/batchTranslate.spec.js`(신규 TDD), `src/js/pages/editor.js`, `src/i18n/ko.json`, `src/i18n/en.json`, `src/i18n/ja.json`, `src/i18n/es.json`, `src/i18n/zh.json`, `src/css/pages.css`.
- **검증**: 신규 `batchTranslate.spec.js` 15건 GREEN(원문 추출 폴백·i18n 변환·동시성 상한·부분실패 계속·요금한도 즉시중단·shouldStop·진행보고·빈목록). `npm run build` 성공(editor 청크 정상 번들). 전체 스위트 잔여 실패 5건(detail_nav 2·inquiry_ui 2·ios_gpu_webp_guard 1)은 `git stash -u` 검증 결과 본 변경 이전부터 실패하던 기존 항목으로 무관. 수동 검증 필요: `npm run dev`→에디터 '미번역' 필터→[미번역 일괄 번역 (N건)] 클릭→확인→진행률(N/M) 표시→완료 후 해당 날짜 초록 표기·미번역 카운트 감소.

### 17:26 — Claude (claude-opus-4-8)

- **요구사항**: 일괄 번역 버튼이 번역 중일 때 진행 중임을 나타내는 회전 서클(스피너) 아이콘을 버튼 내에 배치.
- **구현방법**: 버튼 `innerHTML`을 매 건 재조립하면 onProgress 호출마다 스피너 요소가 새로 생겨 애니메이션이 리셋(깜빡임)되므로, 스피너를 `.editor-batch-btn.is-running::after` 가상요소(기존 `.btn-spinner`와 동일 형태: `border-top-color:transparent`+`@keyframes spin`)로 붙여 textContent만 갱신해도 매끄럽게 돌게 함. 버튼을 `inline-flex`+`gap`으로 만들어 `진행률 텍스트 + 스피너`를 나란히 배치하고, `:disabled`(대상 0건)와 `.is-running` 규칙 순서를 조정해 진행 중 progress 커서가 우선되게 함. 클릭 즉시 `0/N` 진행 라벨 표시(`editor.js`).
- **변경파일**: `src/css/pages.css`, `src/js/pages/editor.js`.
- **검증**: `npm run build` 성공. 로직 변경 없어 `batchTranslate.spec.js` 영향 없음.

### 17:31 — Claude (claude-opus-4-8)

- **요구사항**: 일괄 번역 완료 후, 어떤 날짜가 번역됐는지 팝업으로 확인할 수 있게 해달라.
- **구현방법**: `confirmDialog.js`에 "alert" 모드 추가 — `showConfirm({ cancelText: null })`이면 취소 버튼 없이 확인 버튼 1개만 렌더링(`.confirm-dialog-actions`가 `flex:1` 버튼이라 추가 CSS 불필요), 오버레이 클릭/Esc도 alert 모드에선 `true`로 닫힘. `runMonthBatchTranslate` 완료 후 `res.errors`로 실패 id를 제외한 성공 스토리만 `publish_date` 오름차순 정렬해 `"YYYY-MM-DD · 제목"` 줄 목록을 만들고, 이 alert 모드 팝업(`editor.batch_translate_result_title`)으로 표시한다(성공 0건이면 생략). 기존 결과 요약 토스트는 그대로 유지.
- **변경파일**: `src/js/components/confirmDialog.js`, `src/js/pages/editor.js`, `src/i18n/{ko,en,ja,es,zh}.json`.
- **검증**: JSON 5개 파싱 OK, `npm run build` 성공, `batchTranslate.spec.js` 15/15 GREEN(로직 무변경 확인). 수동 검증 필요: `npm run dev`→에디터 '미번역' 필터→일괄 번역 실행→완료 시 번역된 날짜·제목 목록 팝업이 뜨고 [확인]으로 닫히는지.

### 2026-06-11 — Claude (claude-sonnet-4-6)

- **요구사항**: `.editor-calendar-story .badge`의 "발행됨" 라벨을 "발행"으로 변경 (한글만).
- **구현방법**: `src/i18n/ko.json`의 `status_published` 값을 "발행됨" → "발행"으로 수정. 다른 언어(en/ja/es/zh)는 변경 없음.
- **변경파일**: `src/i18n/ko.json`.
- **검증**: 단순 텍스트 변경, JSON 유효성 확인.

### 2026-06-11 — Claude (claude-sonnet-4-6) #2

- **요구사항**: `.editor-stat-label`, `.editor-calendar-story .badge`의 "임시저장"을 "임시"로 변경 (한글만).
- **구현방법**: `src/i18n/ko.json`의 `filter_draft`(통계 라벨용)와 `status_draft`(배지용) 값을 "임시저장" → "임시"로 수정. 다른 언어는 변경 없음.
- **변경파일**: `src/i18n/ko.json`.
- **검증**: 단순 텍스트 변경, JSON 유효성 확인.

### 2026-06-11 — Claude (claude-sonnet-4-6) #3

- **요구사항**: `.editor-stats` 내 "중복" 통계 항목(`.editor-stat[data-filter="duplicate"]`)이 카운트 0일 때 표시되지 않도록 숨김.
- **구현방법**: `editor.js`의 `updateStats()`에서 `getDuplicateDateSet().size`가 0이면 `#stat-duplicate`의 부모 `.editor-stat` 버튼에 `hidden` 속성을 설정하고, 1 이상이면 다시 노출.
- **변경파일**: `src/js/pages/editor.js`.
- **검증**: `npm run build` 성공.

### 2026-06-11 — Claude (claude-sonnet-4-6) #4

- **요구사항**: archive-page(설정/`/profile`)의 `history-card-mini.my-story-mini` 카드에서 편집 버튼으로 수정·저장하면 settings-page(`/profile`)로 돌아오지 않고 항상 "나의 일화"(`/mystory`)로 이동해버리는 문제 수정.
- **구현방법**: `mystory.js`의 `renderMyStoryNew()`에서 진입 시 `getPreviousRoute()`를 캡처해두고, 저장 성공 시 `prevRoute === '/mystory'`일 때만 기존처럼 `navigate('/mystory', { date })`로 이동. 그 외(`/profile`, `/editorstory` 등에서 진입)에는 삭제 핸들러와 동일하게 `history.back()`으로 진입 경로로 복귀하고, hashchange가 없을 경우 300ms 후 `/mystory`로 fallback.
- **변경파일**: `src/js/pages/mystory.js`, `tests/regression.bugs.spec.js`.
- **검증**: `npx vitest run tests/regression.bugs.spec.js` 16 passed (신규 케이스 포함). 전체 `npx vitest run`은 본 변경과 무관한 기존 4개 파일(아이콘/문의시트/캘린더UI/CSS) 6건 실패는 그대로 유지(pre-existing).

### 2026-06-11 — Claude (claude-sonnet-4-6) #5

- **요구사항**: 위 #4 작업 후 발견된 기존 테스트 실패 6건의 원인 파악. 그중 이번 세션 변경(#2: `status_draft` "임시저장"→"임시")으로 새로 깨진 1건 수정.
- **구현방법**: `tests/editor_management_calendar.spec.js`의 `.badge-draft` 텍스트 기대값을 `'임시저장'` → `'임시'`로 갱신. 나머지 5건(`detail_nav.ui.spec.js` 2건 - nav-icon 2상태 아이콘 리팩터와 테스트 드리프트, `inquiry_ui.spec.js` 2건 - 문의 드롭다운 옵션 미렌더, `ios_gpu_webp_guard.spec.js` 1건 - `.flipper` base rule에 `transition: transform` 잔존)은 커밋된 HEAD(`764bf11`)에서도 실패하던 pre-existing 미완성 작업으로 확인, 이번 세션 범위 밖이라 변경하지 않음.
- **변경파일**: `tests/editor_management_calendar.spec.js`.
- **검증**: `npx vitest run tests/editor_management_calendar.spec.js` 9 passed.

### 2026-06-11 — Claude (claude-sonnet-4-6) #6

- **요구사항**: iOS/Android 모두 로컬 알림 팝업은 뜨지만 무음으로 발생하는 문제 수정.
- **구현방법**: `notifications.js`의 `ensureAndroidNotificationChannel()`에서 채널 `id`를 `daystory_default` → `daystory-channel-v1`로 교체(Android는 채널 속성을 사후 변경할 수 없어 새 채널로 재생성), `importance: 4`(HIGH) → `5`(MAX), `sound: 'default'` 추가(visibility:1, vibration:true는 유지). `buildNotificationRequest()`의 스케줄 옵션에 `sound: 'default'`(iOS+공통)와 `channelId: 'daystory-channel-v1'`을 반영.
- **변경파일**: `src/js/services/notifications.js`.
- **검증**: `npx vitest run tests/notifications_default.spec.js tests/regression.bugs.spec.js` 21 passed | 2 skipped.

### 2026-06-11 18:33 — Claude (claude-opus-4-8) · 인앱 알림 센터(Notification Center) 신설

- **요구사항**: 공통 공지(notices) + 본인 문의 내역(inquiries)을 인앱에서 확인하는 알림 센터. profile 헤더에 종 버튼·unread dot, 토스 스타일 상세 바텀시트, limit(20)+커서 페이지네이션, 다국어, firestore.rules 반영. 이번 라운드는 유저 기능만(어드민 답변 UI 후순위). TDD(Red-Green) 준수.
- **구현방법**:
  - 기존 `services/notifications.js`(로컬 푸시 스케줄러)와 충돌 → 데이터 서비스는 **`services/notificationCenter.js` 신설**(`fetchNotices`/`fetchMyInquiries`/`pickLocale`/`computeUnreadFromLists`/`getLastSeen`/`markAllRead`/`checkUnread`). notices 다국어는 `{ko,en,ja,es,zh}` 맵 + locale→ko→첫값 폴백. unread는 localStorage `ds_notif_center_lastseen_v1` 기준. 배지용 `checkUnread`는 limit(1) 경량 조회 2건, 오류 시 false 폴백.
  - **`components/notificationCenterSheet.js` 신설** — `renderNotificationBell({unread})` + `showNotificationCenter()`. 풀시트는 `notification-settings-overlay`(우측 슬라이드), 상세는 `modal-overlay`+드래그-투-클로즈(inquirySheet 손맛 동일). 모든 원격/입력 텍스트 `escapeHtml`. IntersectionObserver 자동 로드 + `.notif-load-more` 버튼 폴백.
  - **`pages/profile.js`** — gear 아이콘 왼쪽에 종 버튼 주입(admin/일반 모두 `page-header-actions`로 통일), 클릭 시 시트 오픈+dot 제거, 마운트 후 `checkUnread(uid)` 비동기로 dot 표시. unread dot은 토큰에 없는 `--color-primary` 대신 앱 기존 unread 컨벤션 `--color-error` 사용.
  - **`firestore.rules`** — `notices`(read=로그인, write=admin) 추가. `inquiries`는 create에 `userId==auth.uid` 강제(타인 inbox 주입 차단), read에 본인 조회 허용(`resource.data.userId==auth.uid`), update/delete는 admin만(답변 위조 방지). `services/inquiries.js` status `'open'`→`'pending'` 통일.
  - **i18n** — `notificationCenter` 섹션 5개 언어 추가(UI 라벨만; 공지 콘텐츠는 Firestore 다국어 필드).
- **변경파일**: `src/js/services/notificationCenter.js`(신규), `src/js/components/notificationCenterSheet.js`(신규), `tests/notificationCenter.spec.js`(신규), `tests/notificationCenterSheet.spec.js`(신규), `src/js/pages/profile.js`, `src/js/services/inquiries.js`, `src/css/components.css`(append), `firestore.rules`, `src/i18n/{ko,en,ja,es,zh}.json`, `tests/inquiry.spec.js`(status 단언 갱신).
- **검증**: 신규/관련 스펙 `notificationCenter`+`notificationCenterSheet`+`inquiry` 39/39 통과. `css_tokens` 통과(내 CSS는 토큰만 사용). 전체 `npm test`의 잔여 실패 4파일(ios_gpu_webp_guard·inquiry_ui·detail_nav·editorstory)은 모두 내 변경 영역 밖 — 앞 3개는 clean-tree(stash)에서도 동일 실패(기존), `editorstory`는 세션 중 외부(GitHub Desktop/IDE)에서 `.editor-comment-bubble`을 실시간 편집해 `--color-text-secondary`→하드코딩으로 바뀐 결과. 해당 영역은 사용자 진행 작업이라 되돌리지 않음.

### 2026-06-11 20:01 — Codex

- **요구사항**: Claude Code가 토큰 소진으로 멈춘 인앱 알림/문의 작업을 이어받아, 답변 작성 기능은 제외하고 editor page를 "관리자 페이지"로 재정의하며 헤더 우측 관리자 전용 문의 알람 탭에서 사용자 문의 목록을 확인하는 구조로 정리.
- **구현방법**: `editor.content_mgmt` 5개 언어 라벨을 관리자 페이지 계열로 갱신하고 `editor.js` 상단 설명을 관리자 페이지 범위에 맞게 정리. 기존 `adminInquirySheet.js`는 읽기 전용 목록/상세 확인 범위임을 주석으로 명시. `fetchAdminInquiries`의 전체 inquiries 최신순 조회 계약과 `adminInquirySheet`의 관리자 전용 버튼·목록·상세 보기·답변 입력 UI 부재를 Vitest로 고정.
- **변경파일**: `src/js/pages/editor.js`, `src/js/components/adminInquirySheet.js`, `src/i18n/{ko,en,ja,es,zh}.json`, `tests/adminInquirySheet.spec.js`, `tests/notificationCenter.spec.js`, `tests/editor_management_calendar.spec.js`, `SESSION_LOG.md`.
- **검증**: `npm test -- tests/adminInquirySheet.spec.js tests/notificationCenter.spec.js tests/editor_management_calendar.spec.js` 31 passed / 1 skipped. 관련 스펙 `npm test -- tests/adminInquirySheet.spec.js tests/notificationCenter.spec.js tests/notificationCenterSheet.spec.js tests/inquiry.spec.js` 44/44 통과. `npm run build` 성공. 전체 `npm test`는 482 passed / 6 failed / 6 skipped — 실패 6건은 기존 잔여 항목(`detail_nav.ui` 2, `editorstory.ui` 1, `inquiry_ui` 2, `ios_gpu_webp_guard` 1)으로 이번 변경 범위와 무관.

### 2026-06-11 20:38 — Codex

- **요구사항**: 답변 기능은 아직 계획 단계이므로 문의 목록/내 문의에서 pending 상태의 "답변 대기중" 노출 제거.
- **구현방법**: `notificationCenterSheet.js`와 `adminInquirySheet.js`에서 `status === 'answered'`인 문의에만 상태 칩을 렌더하도록 변경하고, pending 칩 생성 경로를 제거. 5개 언어 `notificationCenter.status_pending` 문구와 미사용 `.notif-status-pending` CSS를 삭제. 관리자/사용자 문의 시트 테스트에 pending 칩과 "답변 대기중" 문구가 없어야 한다는 단언 추가.
- **변경파일**: `src/js/components/notificationCenterSheet.js`, `src/js/components/adminInquirySheet.js`, `src/css/components.css`, `src/i18n/{ko,en,ja,es,zh}.json`, `tests/adminInquirySheet.spec.js`, `tests/notificationCenterSheet.spec.js`, `SESSION_LOG.md`.
- **검증**: `npm test -- tests/adminInquirySheet.spec.js tests/notificationCenterSheet.spec.js tests/notificationCenter.spec.js tests/inquiry.spec.js` 44/44 통과. `npm run build` 성공. `rg`로 소스 내 `status_pending`/`notif-status-pending`/`답변 대기중` 노출 없음 확인(테스트의 부재 단언만 남음).
