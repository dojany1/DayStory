# DayStory — 프로젝트 종합 진단 보고서 (PROJECT_AUDIT)

> 작성일: **2026-06-02** · 진단 버전: `v1.4.2` · 진단자: Claude (Opus 4.8)
> 이전 진단 `docs/audit/2026-05-22/` 의 후속본. 코드 수정 없이 **현 상태 평가 + 리팩토링 제안**만 담는다.

---

## 1. 개요

### 1.1 평가 방법
전체 코드베이스를 직접 정독해 근거 기반으로 진단했다.

- JavaScript: **~10,886 라인** (페이지 13 · 서비스 14 · 컴포넌트 8 · 유틸 8)
- CSS: **~5,449 라인** (variables / base / components / pages)
- 테스트: `tests/` **28개 스펙 · ~4,800 라인** (Vitest + jsdom). ⚠️ vitest 스코프 미설정으로 실제 `npm test`는 iOS 빌드 산출물까지 수집해 **52파일/285테스트**를 돌리며 **현재 레드** — [6장](#6-테스트--유지보수성) 참조.
- 백엔드: Firestore Rules · Storage Rules · Cloud Functions(OG) · firestore.indexes

각 발견 사항은 **`[등급] 제목 → 증거(파일:라인) → 영향 → 해결안(Action)`** 형식으로 기술한다.

### 1.2 등급 정의
| 등급 | 의미 |
|---|---|
| **CRITICAL** | 보안/프라이버시 침해 또는 데이터 손상 위험. 최우선 수정. |
| **HIGH** | 정합성·확장성에 실질적 결함. 빠른 시일 내 수정. |
| **MEDIUM** | 품질/UX/유지보수 저해. 계획적 개선. |
| **LOW** | 사소한 정리·일관성. 여유 시 개선. |

### 1.3 점수 요약 (Scorecard)

| 관점 | CRITICAL | HIGH | MEDIUM | LOW |
|---|:---:|:---:|:---:|:---:|
| 기획 & 아키텍처 | 0 | 3 | 2 | 0 |
| 보안 규칙 & 예외 처리 | **1** | 1 | 3 | 0 |
| 개발 & 코드 품질 | 0 | 2 | 3 | 2 |
| 디자인 & UI/UX | 0 | 0 | 3 | 2 |
| 테스트 & 유지보수 | 0 | 2 | 1 | 1 |
| **합계** | **1** | **8** | **12** | **5** |

### 1.4 한 줄 총평
> **서비스 레이어 추상화 · 캐싱 · 에러 폴백 · 디자인 토큰 · 테스트 규율은 동급 개인 프로젝트 대비 매우 우수하다.**
> 핵심 리스크는 세 가지다 — (1) **Storage 규칙의 사용자 간 격리 미흡**, (2) **전역 단일 네비게이션 가드의 취약한 설계**,
> (3) **수집·받은 카드·알림 등 핵심 상태의 localStorage 단독 의존**(다기기 미동기화). 나머지는 점진 개선 영역.
>
> 추가로 진단 중 **`npm test`가 레드 상태**임을 실측 확인했다 — vitest 스코프 미설정으로 iOS 빌드 산출물(RevenueCat SPM) 테스트가 수집·실패하고, Firebase 연동 스펙은 오프라인 진단 환경에서 실패한다(순수 로직 47개는 통과). 상세·교정안은 [6장](#6-테스트--유지보수성).

---

## 2. 기획 & 아키텍처

### [HIGH] 2-1. 핵심 사용자 상태가 localStorage 전용 → 다기기 미동기화·재설치 시 소실
- **증거**: [src/js/services/collection.js](src/js/services/collection.js) (수집 카드), [src/js/services/receivedCards.js](src/js/services/receivedCards.js) (받은 카드), [src/js/services/notifications.js:5](src/js/services/notifications.js#L5) (알림 설정) 모두 `localStorage` 단독 저장.
- **영향**: "카드 수집"은 앱의 핵심 가치인데 **기기 교체·로그아웃·앱 재설치 시 전량 소실**된다. 로그인 사용자라도 단말이 바뀌면 컬렉션이 초기화돼 리텐션·과금(구독) 명분이 약해진다. 소셜/공유 확장의 기반 데이터도 클라우드에 없다.
- **Action**:
  1. `users/{uid}/collected/{storyId}`·`users/{uid}/received/{storyId}` Firestore 서브컬렉션(또는 profile 내 맵)로 승격.
  2. localStorage는 **오프라인 캐시**로만 유지하고, 로그인 시 머지 동기화.
  3. 알림 설정도 profile에 저장해 기기 간 일관성 확보.

### [HIGH] 2-2. 소셜 피드 확장성 미설계
- **증거**: [src/js/services/mystories.js](src/js/services/mystories.js) — `userStories`는 전적으로 `where('uid','==',uid)` private 모델. 공개 게시물·팔로우·피드 컬렉션 부재. [firestore.rules:57-61](firestore.rules#L57-L61) 도 본인 전용 read만 허용.
- **영향**: 현재 구조에서 "소셜 피드"를 붙이려면 데이터 모델을 사실상 재설계해야 한다(공개 가시성, 타인 글 read, 타임라인 쿼리).
- **Action**:
  1. 향후 피드 도입 시 **`posts`(공개) · `follows`(그래프) · `feeds/{uid}`(팬아웃) 또는 쿼리형 타임라인**으로 분리.
  2. 마이그레이션 비용을 줄이려면 **지금 `userStories` 스키마에 `visibility: 'private'` 필드를 선반영**해 두는 것을 권장.

### [HIGH] 2-3. 클라이언트 어드민 부여가 보안 룰과 모순 (죽은/오해 소지 코드)
- **증거**: [src/main.js:254-267](src/main.js#L254-L267) — `ADMIN_EMAILS` 하드코딩 후 `setDoc(profileRef, { role:'editor' }, ...)` 시도. 그러나 [firestore.rules:34-42](firestore.rules#L34-L42) 는 `role=='editor'` 생성/변경을 명시적으로 차단 → **이 쓰기는 항상 실패**하고 [main.js:276](src/main.js#L276) catch가 삼킨다.
- **영향**: (1) 어드민 권한이 실제로는 클라이언트에서 부여되지 않음(룰이 막음) → **혼란스러운 죽은 코드**. (2) **어드민 이메일 3개가 배포 번들에 평문 노출**(정보 누출). (3) "동작하는 것처럼 보이나 실은 콘솔에서 수동 부여돼 있던 것"에 의존.
- **Action**:
  1. 어드민은 **Firebase Custom Claims**(Admin SDK / Functions)로 부여하고 룰에서 `request.auth.token.admin == true` 검사.
  2. 클라이언트의 `ADMIN_EMAILS` 및 role 자가승격 로직 **제거**.

### [MEDIUM] 2-4. 예약 발행이 클라이언트 의존 (서버 크론 부재)
- **증거**: [src/js/services/stories.js:83-114](src/js/services/stories.js#L83-L114) `autoPublishScheduled()` — 에디터가 앱을 열어 `fetchStories()`를 호출할 때만 `scheduled→published` 전환.
- **영향**: **에디터가 접속하지 않으면 예약 카드가 영영 발행되지 않는다.** 발행 시점이 사람의 앱 사용에 종속.
- **Action**: Cloud Functions + **Cloud Scheduler(매일 자정 KST)** 로 서버 측 자동 발행 이전. 클라이언트 로직은 폴백으로만.

### [MEDIUM] 2-5. 검색/목록이 전체 로드 후 클라이언트 필터
- **증거**: [src/js/services/stories.js:214-228](src/js/services/stories.js#L214-L228) `searchStoriesDB()` 가 published 전체를 받아 JS `includes` 필터. `fetchStories()` 도 페이지네이션 없이 전량 로드.
- **영향**: 수백 건까지는 5분 캐시로 무난하나, **수천 건 규모에서 초기 로드·메모리·검색 지연**.
- **Action**: 데이터 증가 시 `limit`+`startAfter` 페이지네이션, 검색은 키워드 배열 `array-contains` 인덱스 또는 외부 검색(Algolia/Typesense).

---

## 3. 보안 규칙 & 예외 처리 (Edge Cases)

### [CRITICAL] 3-1. Storage 규칙이 사용자 간 격리를 보장하지 못함 (개인 일기 이미지 노출)
- **증거**: [storage.rules:18-25](storage.rules#L18-L25)
  ```
  match /users/{userId}/{folder=**} {
    allow read: if request.auth != null;   // ← 인증된 누구나 read
  ```
  주석은 *"read는 인증 사용자라면 누구나 — Firestore Rules가 데이터 가시성 통제"* 라고 하지만, **Storage 객체 read는 Firestore 룰과 완전히 무관**하다.
- **영향**: **로그인한 임의의 사용자가 타인의 `users/{타인uid}/diary/...` 개인 일기 사진을 읽을 수 있다.** 카드 이미지(공개 의도)와 개인 일기 이미지(비공개여야 함)가 같은 규칙을 공유하는 설계 결함. (실제 악용은 `uid+타임스탬프+random6+파일명` 경로 무작위성 때문에 난이도가 높지만, **규칙의 의도 자체가 격리를 보장하지 못함** — 보안을 무작위성에 의존하는 상태.)
- **Action**:
  1. **경로 분리** — 공개 카드 이미지는 `public/cards/**`(read 공개), 개인 자료는 `users/{uid}/**`.
  2. `users/{uid}/**` 에 대해 **`allow read: if request.auth.uid == userId`** 로 소유자 한정.
  3. 공유 카드(어드민 업로드)는 발행 시 `public/` 로 복사하거나 처음부터 공개 경로에 업로드.
  - 참고 업로드 경로: [src/js/services/images.js:15](src/js/services/images.js#L15) `users/${uid}/${folder}/...`.

### [HIGH] 3-2. `userStories`/`bookmarks` update 시 소유자 필드 불변 검증 부재
- **증거**: [firestore.rules:60](firestore.rules#L60) `allow update, delete: if isSignedIn() && resource.data.uid == request.auth.uid;` — **기존 문서**의 uid만 검증하고 **변경 후** `request.resource.data.uid` 는 보지 않는다. [firestore.rules:64-68](firestore.rules#L64-L68) `bookmarks.user_id` 동일.
- **영향**: 사용자가 자기 문서를 업데이트하며 `uid`를 **타인 uid로 변경** → 그 타인의 `where('uid','==',타인)` 피드에 카드가 주입되거나 소유권이 이전된다(데이터 무결성/스토킹성 악용).
- **Action**: update 룰에 불변식 추가 — `&& request.resource.data.uid == resource.data.uid` (bookmarks는 `user_id`).

### [MEDIUM] 3-3. create 시 스키마/타입/크기 검증 부재
- **증거**: [firestore.rules:59](firestore.rules#L59), [firestore.rules:66](firestore.rules#L66), [firestore.rules:72](firestore.rules#L72) — `userStories`/`bookmarks`/`reports` create가 `uid` 일치만 확인하고 필드 화이트리스트·길이 제한이 없다.
- **영향**: 클라이언트가 임의 필드·**초대형 문서**(본문 수 MB)·잘못된 타입을 작성 가능 → 비용/표시 깨짐/남용.
- **Action**: `request.resource.data.keys().hasOnly([...])` + 주요 필드 `is string`·`.size() < N` 검증.

### [MEDIUM] 3-4. `reports` 무제한 생성 (남용 가능)
- **증거**: [firestore.rules:71-74](firestore.rules#L71-L74) `allow create: if isSignedIn();` — 빈도 제한·필드 검증 없음.
- **영향**: 인증만 되면 신고 문서를 무한 생성 가능(스팸).
- **Action**: 필드 검증 추가 + 가능하면 Functions 경유 또는 사용자당 빈도 제한(예: 문서 ID에 uid+date 포함해 자연 제한).

### [MEDIUM] 3-5. 탈퇴 시 `reports` 미정리 (개인정보 잔존)
- **증거**: [src/js/services/userCleanup.js:31](src/js/services/userCleanup.js#L31) `USER_FILTERED_COLLECTIONS = ['bookmarks', 'userStories']` — `reports`는 정리 대상에서 제외.
- **영향**: 회원 탈퇴 후에도 사용자가 만든 신고에 식별 정보가 남을 수 있음(App Store 5.1.1(v)/개인정보 관점).
- **Action**: reports에 신고자 uid를 저장한다면 탈퇴 정리 컬렉션에 포함.

> **예외 처리 강점**: 서비스 레이어 전반이 try/catch + 안전 폴백([stories.js](src/js/services/stories.js), [bookmarks.js](src/js/services/bookmarks.js)), `withTimeout`([utils/timeout.js](src/js/utils/timeout.js)), 게스트/`!db` 가드, 5초 부팅 강제 시작([main.js:337-343](src/main.js#L337-L343))을 갖춰 **네트워크 실패에 견고**하다.

---

## 4. 개발 & 코드 품질 (DRY · 메모리 누수 · 비동기)

### [HIGH] 4-1. 전역 단일 `setBeforeNavigate` 슬롯을 에디터가 덮어쓰고 떠날 때 `null`로 초기화
- **증거**:
  - [src/js/router.js:83-85](src/js/router.js#L83-L85) — `beforeNavigateHook = fn` **단일 전역 슬롯**.
  - [src/main.js:125](src/main.js#L125) — 앱의 **인증/네비 표시 가드**를 이 슬롯에 등록.
  - [src/js/pages/editor.js:413](src/js/pages/editor.js#L413) — 에디터가 자기 가드로 **덮어씀**.
  - [src/js/pages/editor.js:426](src/js/pages/editor.js#L426) — 떠날 때 `setBeforeNavigate(null)` — **원래 가드를 복원하지 않고 null화**.
- **영향**: **에디터(콘텐츠 관리)를 한 번 방문한 뒤부터, 페이지 리로드 전까지 앱 전역의 인증 리다이렉트·하단 네비 표시/숨김 가드가 비활성**된다. 트리거는 어드민 한정이지만 결과는 전역 정합성 손상.
- **Action**:
  1. (권장) 라우터가 **가드 스택**을 지원하도록 `pushBeforeNavigate/popBeforeNavigate` 도입.
  2. 또는 에디터는 전역 가드를 건드리지 말고 **`setOnUnmount` + 로컬 unsaved 확인**으로 전환.
  3. 최소 조치라도 `null` 대신 **원래(main.js) 가드를 복원**.

### [HIGH] 4-2. God 파일 + 대규모 중복 (DRY)
- **증거**: [mystory.js](src/js/pages/mystory.js) **1,125라인**, [editor.js](src/js/pages/editor.js) **1,087라인**, [editorstory.js](src/js/pages/editorstory.js) **826라인**. 특히 mystory/editorstory가 **월·일 휠 + Swiper(Virtual) + 카드 렌더 + Cropper** 흐름을 광범위하게 중복. (Swiper 생성만 [utils/cardSwiper.js](src/js/utils/cardSwiper.js)로 추출돼 있고 나머지 페이지 로직은 중복.)
- **영향**: 한 곳을 고치면 다른 곳을 빠뜨리는 회귀 위험, 단위 테스트 곤란, 신규 기능 추가 비용 증가.
- **Action**: **"달력 휠 + 카드 스와이퍼 페이지" 공통 컨트롤러**(예: `utils/calendarCardPage.js`)로 추출하고 mystory/editorstory는 데이터·렌더 콜백만 주입.

### [MEDIUM] 4-3. 전역 리스너 정리 누락 (CLAUDE.md 규칙 위반 · 조건부 누수)
- **증거**: CLAUDE.md는 *"페이지가 window/document/Capacitor 리스너를 등록했다면 `setOnUnmount(fn)`으로 정리"* 를 요구하지만:
  - [src/js/pages/calendar.js:433](src/js/pages/calendar.js#L433) 에디터 버블 `document click` — **버블을 연 채 페이지를 이동하면** `removeEditorBubble`이 호출되지 않아 리스너 잔존. calendar는 `setOnUnmount` 미사용.
  - [src/js/pages/editorstory.js](src/js/pages/editorstory.js) 동일 버블 패턴 — `setOnUnmount`는 **Swiper destroy만** 수행([editorstory.js:350-352](src/js/pages/editorstory.js#L350-L352)).
  - [src/js/pages/profile.js:251](src/js/pages/profile.js#L251) 모달 `keydown` — 모달 연 채 이탈 시 잔존(`setOnUnmount` 미사용).
- **영향**: "정상 경로(닫기 버튼)"가 아닌 탭 전환·하드웨어 백으로 이탈 시 **전역 리스너가 누적**돼 메모리 누수·유령 핸들러.
- **Action**: 각 페이지가 `setOnUnmount`로 자신이 등록한 전역 리스너를 **반드시 해제**하는 안전망 등록.

### [MEDIUM] 4-4. `searchStoriesDB` 필드 null 가드 부재
- **증거**: [src/js/services/stories.js:218-223](src/js/services/stories.js#L218-L223) — `s.title.toLowerCase()`, `s.body`, `s.figure_name`, `s.country` 직접 접근.
- **영향**: 네 필드 중 하나라도 누락된 문서가 **단 1건** 있으면 `.toLowerCase()`가 throw → catch로 **검색 전체가 빈 배열** 반환.
- **Action**: `(s.title || '')` 또는 옵셔널 체이닝 `s.title?.toLowerCase()` 적용.

### [MEDIUM] 4-5. 죽은 의존성·빈 파일 (번들·유지보수 부담)
- **증거**: 다음은 `src/` 내 JS 사용처 **0건**:
  - `lucide`, `@revenuecat/purchases-capacitor`, `@capacitor/device`, `@capacitor/status-bar` ([package.json](package.json) dependencies).
  - [src/js/components/editorComment.js](src/js/components/editorComment.js) — **0바이트 빈 파일**.
  - [src/main.js:368](src/main.js#L368) 주석도 RevenueCat 미연결을 명시.
- **영향**: 의존성 설치/감사 비용, 번들 잠재 부피(RevenueCat은 특히 큼), 신규 기여자 혼란.
- **Action**: 위 4개 패키지 제거 + 빈 컴포넌트 삭제. 제거 후 `npm run build`로 회귀 확인.

### [LOW] 4-6. 잔여 DRY / 견고성
- [src/js/services/bookmarks.js:30-32](src/js/services/bookmarks.js#L30-L32) `withTimeout` 재래핑, [bookmarks.js:159-208](src/js/services/bookmarks.js#L159-L208) `getBookmarkedStories`가 `getBookmarkedStoryIds`의 60초 캐시를 재사용하지 않고 별도 쿼리.
- [src/js/services/mystories.js:67-113](src/js/services/mystories.js#L67-L113) 쓰기(create/update/delete)에 `withTimeout` 미적용(읽기엔 적용) → 약전계에서 무한 대기 가능.
- **Action**: 캐시 재사용으로 통합, 쓰기에도 타임아웃 래핑.

### [LOW] 4-7. (강점) 비동기/상태 처리 전반 양호
- 인플라이트 토글 락([bookmarks.js:36](src/js/services/bookmarks.js#L36)), 캐시 실패 시 무효화([stories.js:158-162](src/js/services/stories.js#L158-L162)), Promise 캐시 단일화([remoteConfig.js](src/js/services/remoteConfig.js)), 라우터 비동기 레이스 가드([router.js:253](src/js/router.js#L253)) 등 — **현 수준 유지 권장**.

---

## 5. 디자인 & UI/UX

### [MEDIUM] 5-1. 안드로이드 햅틱이 동작하지 않음
- **증거**: `Haptics.impact`를 [router.js:396](src/js/router.js#L396), [calendar.js](src/js/pages/calendar.js), [editorstory.js](src/js/pages/editorstory.js)에서 사용하지만, [capacitor.config.json](capacitor.config.json)의 `includePlugins`에 **`@capacitor/haptics`가 누락**.
- **영향**: `includePlugins`를 명시하면 나열된 플러그인만 등록되므로, **안드로이드에서 햅틱이 등록되지 않아** 호출이 reject되고 try/catch로 **조용히 무시**된다(주 플랫폼에서 촉각 피드백 부재).
- **Action**: `includePlugins`에 `@capacitor/haptics` 추가 후 **`npx cap sync android`**.

### [MEDIUM] 5-2. `user-scalable=no` (접근성 위반)
- **증거**: [index.html:24](index.html#L24) `<meta name="viewport" content="... user-scalable=no" />`.
- **영향**: **핀치 줌 차단** — WCAG 1.4.4(Resize Text) 위반, 저시력 사용자 불리. iOS는 무시하지만 안드로이드 웹뷰는 적용.
- **Action**: `user-scalable=no` 제거(또는 `maximum-scale=5`). `viewport-fit=cover`는 유지.

### [MEDIUM] 5-3. 폰트 외부 CDN 의존 (성능·가용성·프라이버시)
- **증거**: [index.html:69-71](index.html#L69-L71) Google Fonts(Inter/Noto Serif KR/Playfair), [index.html:78](index.html#L78) 한글 본문 **LINESeedKR를 jsdelivr(noonfonts)** 에서 로드.
- **영향**: 렌더 블로킹 + 외부 CDN 가용성에 한글 본문이 종속. CDN 장애 시 폰트 폴백, 프라이버시(요청 노출). 네이티브 앱이 외부 폰트에 의존하는 것도 부담.
- **Action**: 핵심 폰트(LINESeedKR Rg/Bd) **self-host** + `<link rel="preload">` + `font-display: swap`. 미사용 weight/패밀리(Noto Serif KR 등) 정리.

### [LOW] 5-4. CSS 하드코딩 색상
- **증거**: 컴포넌트/페이지 CSS에 토큰 미사용 hex **43개** + rgba 약 20개([pages.css](src/css/pages.css), [components.css](src/css/components.css)). 다수는 의도적 고대비(`#000`/`#fff` 세그먼트·오버레이). [index.html:28](index.html#L28) `theme-color`는 정적 dark.
- **영향**: 토큰 규칙(CLAUDE.md)과 불일치, 테마 전환 시 일부 값이 고정.
- **Action**: 가능한 값은 `var(--*)` 토큰화, 의도적 고대비는 주석 명시. `theme-color`는 테마별 분기 고려.

### [LOW] 5-5. 문서/주석 드리프트
- **증거**: [index.html:105](index.html#L105) "최대 430px"(실제 토큰 [variables.css:132](src/css/variables.css#L132) `--mobile-max-width: 618px`), [index.html:146](index.html#L146) "홈/컬렉션/설정"(실제 3탭은 에디터일화/나의일화/프로필), [toast.js:17](src/js/components/toast.js#L17) 기본 duration 주석 2500 vs 코드 4000.
- **Action**: 주석을 현행화. 사소하나 신규 기여자 오해 방지.

### [강점] 5-6. 디자인 시스템은 견고
- `var(--*)` **915회** 사용([variables.css](src/css/variables.css) 단일 정의), 다크/라이트 + `data-font-size` 프리셋, `env(safe-area-inset-*)` 토큰([variables.css:137-138](src/css/variables.css#L137-L138)), 자체 [confirmDialog.js](src/js/components/confirmDialog.js)/[toast.js](src/js/components/toast.js)(네이티브 `confirm()` 금지 준수), ref-count [scrollLock.js](src/js/utils/scrollLock.js). **현 수준 유지**.

---

## 6. 테스트 & 유지보수성

> ⚠️ **진단 중 `npm test` 실측 결과: 현재 레드(red).** vitest가 52개 파일/285개 테스트를 수집해 **66개 실패**.
> 단, **순수 로직 스펙은 전부 통과**(sanitize·timeout·date·version·storage = 5파일·47테스트 green)하므로 **테스트 인프라 자체는 정상**이며, 실패는 아래 두 원인에서 비롯된다.

### [HIGH] 6-1. `npm test`가 빌드 산출물을 수집해 실패 (vitest 스코프 미설정)
- **증거**: vitest 설정 파일 부재([package.json](package.json)의 `test`는 `vitest run --environment jsdom`뿐) → **node_modules만 제외하고 전 디렉터리에서 `*.spec.js`/`*.test.ts`를 자동 수집**한다. 그 결과:
  - `ios/DerivedData/*/SourcePackages/checkouts/purchases-hybrid-common/.../tests/*.test.ts` 등 **RevenueCat SPM 체크아웃의 vendored 테스트 24개**가 수집·실패.
  - Firebase/Capacitor를 직접 호출하는 UI/통합 스펙이 **오프라인 진단 환경에서 Firestore `UNAVAILABLE`로 실패**. ※ 이 실패들은 개발자의 정상 네트워크 환경에선 통과할 가능성이 높아 **회귀로 단정하지 않음**(본 진단 환경 한정 현상으로 추정).
- **영향**: 현재 `npm test`는 **그대로는 신뢰 불가**(레드). CI 도입 시 동일하게 깨진다. **빌드 산출물 오염은 환경과 무관한 확정 결함.**
- **Action**:
  1. `vitest.config.js` 추가 — `test.include: ['tests/**/*.spec.js']`, `test.exclude: ['**/ios/**', '**/android/**', '**/_disabled-tests-from-HEAD/**', '**/node_modules/**']`.
  2. Firebase 연동 스펙은 **Firebase Emulator** 또는 `db`/SDK 모킹으로 네트워크 비의존화.
  3. (위생) `ios/DerivedData`·`ios/App/CapApp-SPM/.build` 빌드 산출물이 `.gitignore`로 적절히 제외되는지 확인 — [4-5](#high-4-5-죽은-의존성빈-파일-번들유지보수-부담)(죽은 RevenueCat 의존성)와 연계.

### [HIGH] 6-2. 보안 규칙 자동 테스트 0건
- **증거**: `tests/` 28개 스펙 중 firestore.rules/storage.rules를 검증하는 테스트 없음.
- **영향**: 본 보고서가 지적한 **3-1/3-2 같은 규칙 회귀를 막을 안전망 부재**(보안 민감 앱).
- **Action**: **`@firebase/rules-unit-testing`** 에뮬레이터 테스트 추가 — 소유자/타인/어드민/role 승격 차단/uid 변조 차단/Storage 교차 read 케이스.

### [MEDIUM] 6-3. 순수 로직 미테스트 (단위 테스트 우선순위)
순수·결정적이라 테스트 비용이 낮은데 커버리지가 없는 모듈(우선순위 순):
1. [services/collection.js](src/js/services/collection.js) — `canCollect`/`collect`/`bulkCollect`(날짜 경계 로직).
2. [services/receivedCards.js](src/js/services/receivedCards.js) — 기록/정렬/중복 무시.
3. [utils/scrollLock.js](src/js/utils/scrollLock.js) — ref-count 중첩 잠금.
4. [state.js](src/js/state.js) — pub/sub 구독/해제, theme/lang 영속화.
5. [utils/storyI18n.js](src/js/utils/storyI18n.js) · [i18n/index.js](src/js/i18n/index.js) — 언어 선택 폴백.
6. [components/confirmDialog.js](src/js/components/confirmDialog.js) — hold-to-confirm·ESC·이스케이프.
7. [services/appUpdate.js](src/js/services/appUpdate.js) 오케스트레이션 · [services/sharing.js](src/js/services/sharing.js) `captureAndShareCard` 폴백 분기.

### [LOW] 6-4. E2E 부재
- **증거**: `tests/` 단위/통합 28개 스펙(~4,800라인)의 회귀 자산은 우수(라우터 unmount, swiper lazy init, iOS GPU/WebP 가드, `regression.bugs.spec.js` 574라인 등). 다만 브라우저 E2E 없음.
- **Action**: 핵심 플로우(로그인→홈 카드→공유, 일기 작성→저장) **Playwright 스모크** 차후 도입.

> **테스트 강점**: 인프라·문화 자체는 양호하다 — 순수 유틸 47개 테스트 green, 버그를 스펙으로 고정하는 회귀 규율. **vitest 스코프(6-1)만 바로잡으면 즉시 신뢰 가능한 상태로 회복**된다.

---

## 7. 우선순위 리팩토링 로드맵 (Action Plan)

### 🔴 1단계 — 즉시 (보안/프라이버시)
1. **[CRITICAL 3-1]** Storage 규칙 경로 분리 — 개인 이미지 `users/{uid}/**` 소유자 read 한정, 공개 카드는 `public/cards/**`.
2. **[HIGH 3-2]** `userStories`/`bookmarks` update에 `uid`/`user_id` **불변식** 추가.
3. **[HIGH 6-2]** rules-unit-testing 에뮬레이터 테스트로 위 두 항목 회귀 고정.
   - 선행 필수: **[HIGH 6-1]** `vitest.config.js`로 테스트 스코프 교정(iOS 빌드 산출물 제외) — `npm test` 레드부터 해소해야 이후 모든 테스트가 의미를 가진다.

### 🟠 2단계 — 단기 (정합성/위생)
4. **[HIGH 4-1]** 에디터의 전역 가드 null화 → 가드 복원 또는 스택화.
5. **[HIGH 2-3]** 어드민을 Custom Claims로 이전, 클라이언트 ADMIN_EMAILS 제거.
6. **[MEDIUM 4-5]** 죽은 의존성 4종 + 빈 파일 제거.
7. **[MEDIUM 5-1]** `@capacitor/haptics` includePlugins 추가 + cap sync.

### 🟡 3단계 — 중기 (확장성)
8. **[HIGH 2-1]** 수집/받은 카드·알림 설정 Firestore 동기화.
9. **[MEDIUM 2-4]** 예약 발행 서버 크론(Cloud Scheduler) 이전.
10. **[HIGH 4-2]** mystory/editorstory 공통 컨트롤러 추출.
11. **[HIGH 2-2]** 피드 대비 `visibility` 필드 선반영.

### 🟢 4단계 — 상시 (품질)
12. **[MEDIUM 6-2]** 순수 로직 단위 테스트 보강.
13. **[MEDIUM 5-2/5-3]** 접근성(`user-scalable`)·폰트 self-host.
14. **[MEDIUM 4-4]** 검색 null 가드 · **[LOW 4-6]** 캐시 재사용/쓰기 타임아웃 · **[LOW 5-4/5-5]** 토큰화/주석 현행화.

---

## 8. 잘하고 있는 점 (유지할 강점)
- **서비스 레이어 단일화** — 모든 Firebase 접근이 `services/*` 경유(CLAUDE.md 규칙 준수). 게스트/타임아웃/캐시 정책 집중.
- **XSS 방어 일원화** — [utils/sanitize.js](src/js/utils/sanitize.js) `escapeHtml`/`sanitizeUrl`, 컴포넌트가 일관 사용. Cloud Functions OG도 이스케이프([functions/index.js:27](functions/index.js#L27)).
- **모바일 웹뷰 견고성** — Firestore 영구 캐시 폴백, 5초 부팅 강제, iOS GPU 대비 Swiper Virtual([cardSwiper.js](src/js/utils/cardSwiper.js)), WebP 크래시 가드.
- **테스트 규율** — 회귀 스펙(`regression.bugs.spec.js` 574라인) 등 버그를 테스트로 고정하는 문화.
- **디자인 토큰·테마 시스템** — 일관된 `var(--*)`, 다크/폰트크기/safe-area 대응.

---

*본 보고서는 코드를 변경하지 않았습니다. 수정 착수 시 1단계(보안)부터 진행하고, 각 변경은 TDD(테스트 선작성) 원칙에 따라 적용하길 권장합니다.*
