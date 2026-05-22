# DayStory v1.3.5 전체 점검 (6-Agent Audit) — 2026-05-22

> 출시 후 첫 종합 감사. **앱은 이미 양 스토어에 배포된 상태(v1.3.5, Android verCode 20)** 라는 전제 위에서 P0(즉시 위험) → P2(분기 단위) 순으로 정리.
>
> 6개 에이전트(critical-reviewer / qa-tester / ui-designer / user-researcher / product-planner / refactor-specialist)가 read-only로 분석한 결과를 한 파일에 통합. 모든 발견은 `상대경로:라인번호` 인용 포함.
>
> **이번 사이클에서는 코드를 수정하지 않았다.** 7. 종합 결론의 P0/P1/P2 표가 차기 작업 진입점.

---

## 1. Critical Review — 코드/아키텍처 비판

### 🔴 P0 — 출시 앱 즉시 위험

- **`setOnUnmount` 미구현 — CLAUDE.md 핵심 규칙이 사문(死文)**: 프로젝트 규칙은 페이지 리스너를 `router.setOnUnmount(fn)`로 정리하라고 명시하지만 [src/js/router.js](../../../src/js/router.js) 전체에 해당 함수가 없다. `handleRoute()`는 [src/js/router.js:211](../../../src/js/router.js#L211)에서 `container.innerHTML = ''`로 이전 페이지를 날릴 뿐, DOM에서 떨어진 노드가 잡고 있던 `document`·`window`·Capacitor 리스너는 그대로 살아남는다.
- **글로벌 `window._editorStoryMouseMove` / `window._myStoryMouseMove` 패턴**: [src/js/pages/editorstory.js:634-641](../../../src/js/pages/editorstory.js#L634-L641), [src/js/pages/mystory.js:712-727](../../../src/js/pages/mystory.js#L712-L727). 같은 페이지 재렌더 시에만 정리되므로 페이지 간 이동에서는 리스너가 계속 살아남는다. 또 글로벌 슬롯 자체가 다른 모듈과 충돌 위험.
- **클라이언트가 자기 자신에게 `role = 'editor'` 부여**: [src/js/pages/login.js:83-86](../../../src/js/pages/login.js#L83-L86), [src/js/pages/login.js:277-282](../../../src/js/pages/login.js#L277-L282), [src/js/pages/login.js:446-450](../../../src/js/pages/login.js#L446-L450)에서 `ADMIN_EMAILS` 매칭 시 `profileData.role = 'editor'`로 직접 setDoc. Firestore Rules가 막아주지 않으면 누구든 클라이언트 코드 수정으로 권한 탈취 가능. **레포에 `firestore.rules` 파일이 없어 Firebase 콘솔 검증 필수.**
- **`window.confirm()` 잔존 — CLAUDE.md 규칙 직접 위반**: [src/js/pages/editor.js:413](../../../src/js/pages/editor.js#L413)에서 "저장되지 않은 정보가 있습니다…"를 브라우저 `confirm()`으로 띄움. 모바일 웹뷰 라이프사이클 깨짐 위험.

### 🟠 P1 — 다음 패치

- **페이지가 Firebase SDK 직접 import**: [src/js/pages/profile.js:14-15](../../../src/js/pages/profile.js#L14-L15)에서 `setDoc`/`uploadBytes`/`getDownloadURL`을 직접 호출하며 타임아웃 가드 없음. 서비스 레이어의 5초 타임아웃·캐싱 정책이 무력화됨.
- **Storage 경로에 `uid='guest'` 폴백**: [src/js/services/images.js:14](../../../src/js/services/images.js#L14), [src/js/pages/editor.js:670](../../../src/js/pages/editor.js#L670). 익명이 `users/guest/` 아래에 무한 업로드 가능. Storage Rules 점검 필요.
- **`searchStoriesDB` 전체 스캔 + 클라이언트 필터**: [src/js/services/stories.js:232-255](../../../src/js/services/stories.js#L232-L255). 발행 글이 수백 건 넘으면 모바일 메모리 폭탄.
- **`autoPublishScheduled`를 모든 클라이언트가 실행**: [src/js/services/stories.js:96-124](../../../src/js/services/stories.js#L96-L124). 동시 사용자 수만큼 같은 updateDoc 시도. Cloud Function/cron으로 옮겨야 함.
- **Storage URL을 문자열 매칭으로 식별**: [src/js/services/stories.js:323](../../../src/js/services/stories.js#L323), [src/js/services/mystories.js:80](../../../src/js/services/mystories.js#L80). `image_url.includes('firebasestorage')` — URL 파싱으로 host 검증 권장.
- **`sanitizeUrl` 화이트리스트 부재**: [src/js/utils/sanitize.js:49-56](../../../src/js/utils/sanitize.js#L49-L56)이 `javascript:`/`data:`만 차단. `vbscript:`, `\t` 우회 가능. http(s)/mailto/tel 화이트리스트 권장.
- **`setBeforeNavigate(null)` 후 race**: [src/js/pages/editor.js:418](../../../src/js/pages/editor.js#L418). 새 editor가 hook 등록 전까지 무방비 구간.

### 🟡 P2

- 토큰 만료 처리 부재, `localStorage` JSON 파싱 try/catch 누락 ([src/js/services/bookmarks.js:49](../../../src/js/services/bookmarks.js#L49) 등), `setTimeout(...,0)` 으로 DOM 바인딩하는 패턴([src/js/pages/editor.js:239](../../../src/js/pages/editor.js#L239) 외), `confirmDialog`의 180ms resolve 지연.

### 강점

- `services` 레이어 전반에 `withTimeout` 패턴이 일관 적용 — 모바일 네트워크 가정이 코드에 박혀있음.
- `confirmDialog`의 hold-to-confirm UX, ESC 처리, scrollLock 연계가 꼼꼼.
- `userCleanup.js`의 Storage→Firestore→deleteUser 순서가 App Store 5.1.1(v) 가이드라인을 정확히 인지한 결과.
- Firestore 영구 캐시 + 실패 시 메모리 폴백([src/js/firebase.js:69-78](../../../src/js/firebase.js#L69-L78)) 단정함.

---

## 2. QA — 부서질 시나리오 (기존 14개 spec 미커버 영역)

### 🔴 P0 — 데이터 손실 또는 보안 사고

- **게스트 북마크 → 로그인 후 소멸**: 게스트 `localStorage.guest_bookmarks` 와 로그인 Firestore 분기가 [src/js/services/bookmarks.js:76-86](../../../src/js/services/bookmarks.js#L76-L86)에서 독립 동작. 로그인 시 머지 로직 없음 → "북마크가 다 날아갔다" 리뷰 위험.
- **일기 저장 중 네트워크 끊김 → 중복 저장**: [src/js/services/mystories.js:48-58](../../../src/js/services/mystories.js#L48-L58) `addDoc`에 idempotency key 없음. 5초 타임아웃 후 재탭 시 중복 문서 생성.
- **회원 탈퇴 중 강제 종료 → 좀비 데이터**: [src/js/services/userCleanup.js:8-10](../../../src/js/services/userCleanup.js#L8-L10) Storage→Firestore→deleteUser 순서지만 중단 지점 추적 불가. Firestore profile은 지워졌는데 Storage 잔존 → 다음 로그인 시 역할 체크 오동작.
- **Apple 로그인 — `nonce` undefined 케이스**: [src/js/pages/login.js:153-155](../../../src/js/pages/login.js#L153-L155) `nonce` null 체크 없이 credential 생성. Firebase가 `auth/invalid-credential` 영문 에러를 사용자에게 노출.
- **검색어 XSS — Firestore 데이터에 `<img onerror>`**: `sanitize.js`가 있어도 [src/js/pages/search.js](../../../src/js/pages/search.js)가 적용했는지 미검증. 어드민이 figure_name에 스크립트 넣으면 모든 검색 사용자에게 실행.

### 🟠 P1

- **`fetchMyStories` uid 미전달**: [src/js/services/mystories.js:11-31](../../../src/js/services/mystories.js#L11-L31)에서 `where('uid','==',undefined)` 가능 — SDK 버전에 따라 다른 유저 데이터 노출 위험.
- **빠른 연속 북마크 탭 → Firestore 중복 문서**: [src/js/services/bookmarks.js:91-110](../../../src/js/services/bookmarks.js#L91-L110) `getDocs` 완료 전 두 번째 호출 진입 → `addDoc` 두 번.
- **`deleteMyStory`가 Storage ref를 full URL로 생성**: [src/js/services/mystories.js:82](../../../src/js/services/mystories.js#L82), [src/js/services/stories.js:323](../../../src/js/services/stories.js#L323). 일기 삭제 시 이미지가 Storage에 영원히 잔류 (요금 누적).
- **UTC-12~14 타임존 사용자 날짜 역전**: [src/js/utils/date.js:55-61](../../../src/js/utils/date.js#L55-L61) 로컬 날짜는 정상이지만 Firestore `publish_date`가 KST 기준이라면 "오늘 카드"가 미래 취급되어 숨겨짐.
- **위젯 콜드 스타트 딥링크 손실**: [src/main.js:151-224](../../../src/main.js#L151-L224) `pendingWidgetDeepLinkUrl` 저장은 하지만 `App.addListener('appUrlOpen')`이 콜드 스타트 URL 잡는지가 Capacitor 버전 의존.
- **이미지 업로드 실패 → image_url 없이 일기 저장**: [src/js/services/images.js:15-19](../../../src/js/services/images.js#L15-L19) reject 처리 분기가 호출부마다 다름.
- **공유 이미지 fetch CORS 실패 → 조용한 폴백**: [src/js/services/sharing.js:76-79](../../../src/js/services/sharing.js#L76-L79) catch가 에러 삼킴 → iOS 공유 시트에서 URL만 보이는데 사용자는 이유 모름.

### 🟡 P2

- KST 자정 직전 작성 일기의 날짜 표시 혼동, OS 글꼴 200% 시 카드 overflow, `localStorage` 쿼터 초과(receivedCards 누적, [src/js/services/receivedCards.js:23](../../../src/js/services/receivedCards.js#L23) try/catch 없음), 시스템 다크모드 자동 전환 미반영.

---

## 3. UI/UX 점검

### 🔴 P0 — 출시 앱에서 거슬림

- **미정의 CSS 토큰 다수**: `var(--font-sans)`가 [src/css/components.css:365](../../../src/css/components.css#L365), [src/css/base.css:314](../../../src/css/base.css#L314), [src/css/pages.css:206](../../../src/css/pages.css#L206) 등 15곳에서 참조되지만 [src/css/variables.css](../../../src/css/variables.css)에 정의 없음. 정의된 건 `--font-display/body/ui`. 같은 패턴으로 `--text-md`([src/css/pages.css:867](../../../src/css/pages.css#L867)), `--color-text-on-image`([src/css/components.css:1373](../../../src/css/components.css#L1373)), `--color-editor-comment`([src/css/pages.css:707](../../../src/css/pages.css#L707)) 도 누락.
- **`prefers-reduced-motion` 미적용**: 프로젝트 전체에 단 한 건도 없음. [src/css/base.css:35](../../../src/css/base.css#L35) `scroll-behavior: smooth`, `pageEnter`, [src/css/components.css:175](../../../src/css/components.css#L175) 3D flip, 스플래시 펄스 등이 멀미 민감 사용자에게 그대로 노출. WCAG 2.1 위반.
- **z-index magic number 난립**: 토큰(`--z-nav:100`, `--z-modal:200`, `--z-toast:300`, `--z-splash:400`) 있지만 [src/css/components.css:1138](../../../src/css/components.css#L1138) `.crop-modal-overlay: 100000`, [src/css/pages.css:2093](../../../src/css/pages.css#L2093) `.profile-edit-overlay: 9999`, [src/css/components.css:1301](../../../src/css/components.css#L1301) `.confirm-dialog-overlay: 10000`.

### 🟠 P1

- **하드코딩 색상**: [src/css/pages.css:708](../../../src/css/pages.css#L708) `color:#3f3200`(다크모드 깨짐 위험), [src/css/pages.css:1228](../../../src/css/pages.css#L1228) `.theme-option.active{color:#1c1c1e}`, [src/css/pages.css:2396](../../../src/css/pages.css#L2396) `.calendar-toggle-btn.active`, [src/css/pages.css:2761](../../../src/css/pages.css#L2761) `.collect-btn--done{background:#34c759}` (`--color-success` 있음에도).
- **터치 영역 44pt 미달**: [src/css/components.css:745-750](../../../src/css/components.css#L745-L750) `.page-header-back`(36×36), [src/css/pages.css:2428](../../../src/css/pages.css#L2428) `.calendar-month-arrow`(36×36), [src/css/pages.css:1698-1699](../../../src/css/pages.css#L1698-L1699) `.editor-item-actions button`(32×32).
- **폰트사이즈 토글 범위 협소**: [src/css/variables.css:185-193](../../../src/css/variables.css#L185-L193) `data-font-size`가 `--text-base`/`--text-lg`만 재정의. [src/css/components.css:266](../../../src/css/components.css#L266) 카드 연도 `1.75rem`, [src/css/components.css:276](../../../src/css/components.css#L276) 날짜 `3.55rem` 같은 직접 rem 값은 사용자 폰트 설정에 반응하지 않음.
- **`color-mix()` 사용 — 구 WebView 미지원**: [src/css/components.css:1380](../../../src/css/components.css#L1380). Safari 15.4↓ / Android WebView 105↓에서 깨짐.
- **`will-change: transform` 무조건 적용**: [src/css/components.css:177](../../../src/css/components.css#L177) `.flipper`, [src/css/pages.css:465](../../../src/css/pages.css#L465) `.card-stack-item`. 저사양 기기 GPU 부담.

### 🟡 P2

- 한국어 본문 `word-break: keep-all` [src/css/components.css:408](../../../src/css/components.css#L408) `.back-body`에 누락, `line-height` 토큰 부재(1.6/1.75/1.8 분산), Capacitor `@capacitor/haptics` 미사용으로 햅틱 피드백 부재, 버튼 `:active` `scale` 값 불균일(0.85/0.97/1.3), 에러/빈 상태 시각 분리 없음.

### 강점

- `variables.css` 토큰 체계 자체는 색/간격/반경/타이밍/z-index 모두 선언되어 있음.
- safe-area는 nav/status-bar-spacer/page-container/모달에 체계적 적용.
- `cal-cell-peek-title` 같은 접근성 클립 패턴([src/css/pages.css:2597-2608](../../../src/css/pages.css#L2597-L2608))이 올바름.

---

## 4. 사용자 관점 / 페르소나 갭

### 핵심 페르소나 3종

- **A. 출근길 30대 직장인 (박지원, 32)** — Job: "오늘 대화 소재 + 어제 감상 한 줄". 이탈: 게스트/로그인 분기에서 데이터 저장 확신 부재.
- **B. 습관 형성 도전 대학생 (이수진, 21)** — Job: "역사 카드가 글감을 던져줘서 일기 시작". 이탈: 알림이 기본 OFF([src/js/services/notifications.js:8-9](../../../src/js/services/notifications.js#L8-L9))라 D1 트리거 없음.
- **C. 한국사 컬렉터 시니어 (최민호, 54)** — Job: "흥미로운 카드를 카톡으로 지인에게". 이탈: 카카오톡 SDK 미연동 → 텍스트+URL만 가는 폴백.

### 🔴 막히는 5대 지점

1. **게스트→로그인 전환 동기 부재** — [src/js/pages/profile.js:70-81](../../../src/js/pages/profile.js#L70-L81) 단순 CTA만, "이 기기를 바꾸면 사라진다" 경고 없음.
2. **알림 기본 OFF + 첫 진입 권유 부재** — [src/js/services/notifications.js:8-9](../../../src/js/services/notifications.js#L8-L9) `enabled:false`, Settings 2-depth로 숨음.
3. **`donate.js` — 결제 기대 충족 실패**: [src/js/pages/donate.js:88-93](../../../src/js/pages/donate.js#L88-L93) 버튼 누르면 "후원 감사합니다 🎉" 토스트만 뜨고 실제 과금 없음. 같은 파일 69줄 "인앱 결제로 안전하게 처리" 안내가 있어 **스토어에서 "사기 앱" 신고 위험**.
4. **공유 → 바이럴 루프 단절** — [src/js/services/sharing.js:67-96](../../../src/js/services/sharing.js#L67-L96) 카카오 SDK 없음. 한국 사용자 1순위 채널 막힘.
5. **"내 일기" 진입점 분산** — 캘린더 "나의 일화" 토글([src/js/pages/calendar.js:33-35](../../../src/js/pages/calendar.js#L33-L35))과 하단 탭 mystory 기능 중복.

### PRD vs 실구현 갭

- PRD가 "로그인 없이 즉시 콘텐츠 보는 게스트"를 핵심 타깃으로 명시했으나 게스트 데이터 소멸 안내 부재.
- "빈 페이지 앞 막막한 사람에게 글감을 던진다"는 핵심 가치가 알림 OFF 기본값 탓에 전달 안 됨.
- PRD `Known Limitations`에서 placeholder로 표시된 donate가 출시 빌드에 그대로 — 스토어 리스크.

---

## 5. 제품 방향 / PRD 갭

### PRD 갭 5선

- **GAP-1. 튜토리얼 완전 삭제 (PRD 명시 — 코드 없음)**: [docs/_archive/CODE_MAP.md:69](../../_archive/CODE_MAP.md#L69) "튜토리얼 투어는 2026-05-07 작업에서 제거됨." 신규 사용자 온보딩 공백.
- **GAP-2. RevenueCat 설치만, 런타임 미연결**: [package.json:36](../../../package.json#L36) `@revenuecat/purchases-capacitor` 의존성 있으나 [src/main.js](../../../src/main.js)·[src/js/services/](../../../src/js/services/) 어디에도 Purchases SDK 초기화 없음. `capacitor.config.json includePlugins` 에서도 테스트 배포용으로 제외됨([docs/SESSION_LOG.md:72](../../SESSION_LOG.md#L72)).
- **GAP-3. collection 시스템이 localStorage만**: [src/js/services/collection.js](../../../src/js/services/collection.js) — 디바이스 교체 시 수집 내역 증발. 구독자/어드민 bypass 분기는 있으나 RevenueCat 미연결로 무력.
- **GAP-4. report.js 신고 데이터 어디에도 저장 안 됨**: [src/js/pages/report.js:85](../../../src/js/pages/report.js#L85) `showToast('신고가 접수되었습니다')` 뒤 Firestore/이메일/Analytics 저장 코드 없음.
- **GAP-5. 다국어(i18n) — PRD "한국어 전용" 선언 위반**: [docs/SESSION_LOG.md:66](../../SESSION_LOG.md#L66) ko/en/ja JSON 추가됐고 14개 페이지 전부 `t()` 사용. [docs/PRD.md:31](../../PRD.md#L31)은 "다국어 — MVP 제외" 명시. 제품 방향 변경이 PRD 미반영.

### 다음 분기 우선순위

- **P0-A. RevenueCat 실제 연결**: 옵션 A — 초기화+entitlement 확인 → `state.isPremium` → collection bypass 호출, donate 페이지를 paywall 모달로 교체. 옵션 B — RevenueCat 제거, Google/Apple IAP 직접 연동(분석 포기, 유지보수 비용 절감).
- **P0-B. report.js 5분 작업**: Firestore `reports` 컬렉션 저장 OR 기능 일시 숨김 중 결정.
- **P1-A. collection Firestore 동기화**: D7 리텐션 핵심 레버.
- **P1-B. 알림 클릭 → 오늘 카드 deep link 회귀 테스트**: D1 가장 기본 장치.
- **P2-A. 첫 진입 1개 코치마크**: 투어 6단계 복구보다 "첫 카드 탭 유도" 1회.
- **P2-B. PRD 다국어 방향 문서 갱신**.

### 버릴 후보 (페이지 통합)

| 페이지 | 현황 | 제안 |
|---|---|---|
| donate.js | toast만 띄우는 placeholder | RevenueCat P0 작업과 통합해 paywall 모달로 교체 또는 삭제 |
| report.js | 저장 없는 UI | Firestore 연결 또는 설정 메뉴에서 제거 (현 상태는 사용자 기만) |
| license.js | 이미지 출처 목록 | 설정 → "이미지 출처" 인라인 섹션으로 통합 |
| about.js | 에디터 소개 | 설정 1개 섹션으로 흡수, 독립 라우트 불필요 |

### 수익화 한 줄 진단

RevenueCat SDK가 설치됐으나 초기화/호출이 없어 **현재 수익 0**. collection.js의 구독자 bypass 분기가 연결되는 순간 "오늘 카드만 vs. 무제한 수집" paywall이 즉시 활성화 가능한 인프라는 갖춰져 있음. **다음 분기 최우선 과제**.

### 차기 메이저(2.0) 후보

- **2.0-A**: iOS 출시 + 양 플랫폼 구독 정식 가동 (Sign in with Apple, 회원 탈퇴 잔여 이슈 해결 전제).
- **2.0-B**: 소셜 피드/카드 교환 — `receivedCards.js` 인프라가 이미 있음. D7 30% 이상 확인 후 투자.

---

## 6. 리팩토링 후보 (audit 식별만, 코드 미변경)

### 🔴 큰 가치

- **`withTimeout` 3벌 중복**: [src/js/services/stories.js:71](../../../src/js/services/stories.js#L71), [src/js/services/bookmarks.js:27](../../../src/js/services/bookmarks.js#L27), [src/js/services/mystories.js:21-24](../../../src/js/services/mystories.js#L21-L24). 새 `src/js/utils/timeout.js` 로 추출. 안전망: resolve/reject promise · 타임아웃 단위 테스트. **주의**: `mystories.js`만 reject 값이 `Error('timeout')` 소문자 — 호출부 catch 분기 확인 후 통일.
- **Firebase Storage URL 판별 4벌 중복**: [src/js/services/stories.js:323](../../../src/js/services/stories.js#L323), [src/js/services/mystories.js:80](../../../src/js/services/mystories.js#L80), [src/js/pages/editor.js:531-532](../../../src/js/pages/editor.js#L531-L532), [src/js/pages/mystory.js:938-939](../../../src/js/pages/mystory.js#L938-L939). `isFirebaseStorageUrl(url)` 한 줄로 추출. 안전망: 도메인별 참/거짓 단위 테스트 2개.
- **`escapeText` / `escapeHtml` 이중 구현**: [src/js/utils/sanitize.js:31](../../../src/js/utils/sanitize.js#L31), [src/js/components/confirmDialog.js:166](../../../src/js/components/confirmDialog.js#L166), [src/js/components/settingsSections.js:115](../../../src/js/components/settingsSections.js#L115). 두 컴포넌트에서 sanitize 미import한 채 복제. 안전망: 기존 sanitize 테스트로 충분.

### 🟠 중간

- **`router.js:249` `getLocalTodaySelection` vs `utils/date.js:55` `getLocalToday` 기능 중복**: [src/js/router.js:249-256](../../../src/js/router.js#L249-L256). router가 유틸 미import.
- **`settingsSections.js` 사용 안 되는 함수 5개**: [src/js/components/settingsSections.js:395](../../../src/js/components/settingsSections.js#L395) `themeLabel`, [src/js/components/settingsSections.js:183](../../../src/js/components/settingsSections.js#L183) `bindLangOptions`, [src/js/components/settingsSections.js:134](../../../src/js/components/settingsSections.js#L134) `renderLangOption`, [src/js/components/settingsSections.js:431](../../../src/js/components/settingsSections.js#L431) `imageIcon`, [src/js/components/settingsSections.js:435](../../../src/js/components/settingsSections.js#L435) `shieldIcon`. 동적 import 가능성 grep 확인 후 삭제 가능.
- **`handleLogout`/`_doWithdraw` bottom-nav 숨김 코드 3회 중복**: [src/js/components/settingsSections.js:332,370,389](../../../src/js/components/settingsSections.js#L332). `hideBottomNav()` 헬퍼로 추출.

### 🟡 자잘함

- `CARD_IMAGE_CROP_ASPECT_RATIO` 상수 2벌 ([src/js/pages/editor.js:34](../../../src/js/pages/editor.js#L34), [src/js/pages/mystory.js:29](../../../src/js/pages/mystory.js#L29)).

### 지금 손대지 말 것

- **`editorstory.js` ↔ `mystory.js` 휠 피커 전체 공통화** ([src/js/pages/editorstory.js:131-291](../../../src/js/pages/editorstory.js#L131-L291), [src/js/pages/mystory.js:158-313](../../../src/js/pages/mystory.js#L158-L313)). 클로저 변수 의존성 깊음. E2E 테스트 갖춰진 뒤에야 안전.

---

## 7. 종합 결론 & 우선순위 액션

### 한 줄 핵심

> **규칙은 잘 적혀 있지만 `router.setOnUnmount`가 실재하지 않고 RevenueCat이 미연결인 것이 v1.3.5의 가장 큰 두 구멍이다.** 그 위에서 클라이언트 admin 부여·`window.confirm` 잔존·게스트 데이터 머지 부재·`prefers-reduced-motion` 부재가 누적되어, **출시는 됐지만 한 번 더 정리하지 않으면 다음 메이저 전환이 무너질 가능성이 높다.**

### P0 — 즉시 (다음 1주 내)

| # | 액션 | 영역 | 근거 |
|---|---|---|---|
| 1 | Firestore `firestore.rules` / Storage `storage.rules` 콘솔 점검 — 일반 유저의 `profiles/{uid}.role` write 차단 여부, `users/guest/` 업로드 차단 여부 확인 | 보안 | §1, [src/js/pages/login.js:83](../../../src/js/pages/login.js#L83), [src/js/services/images.js:14](../../../src/js/services/images.js#L14) |
| 2 | `donate.js` placeholder 결제 안내 문구 제거 또는 페이지 비공개 — 스토어 기만 리스크 | 제품/법무 | §4, [src/js/pages/donate.js:88-93](../../../src/js/pages/donate.js#L88-L93) |
| 3 | `window.confirm()` → `confirmDialog`로 교체 | 코드 규칙 | §1, [src/js/pages/editor.js:413](../../../src/js/pages/editor.js#L413) |
| 4 | 게스트→로그인 시 북마크 머지 OR 데이터 소멸 경고 모달 | 데이터 손실 | §2, [src/js/services/bookmarks.js:76](../../../src/js/services/bookmarks.js#L76) |
| 5 | `fetchMyStories(undefined)` 가드 추가 — uid 비어있으면 빈 배열 | 보안 | §2, [src/js/services/mystories.js:11](../../../src/js/services/mystories.js#L11) |

### P1 — 다음 패치 (1.4.x, 2~4주)

| # | 액션 | 영역 | 근거 |
|---|---|---|---|
| 6 | `router.setOnUnmount(fn)` 실제 구현 → 페이지별 cleanup 등록 → 글로벌 `window._editorStoryMouseMove` 등 제거 | 메모리 누수 | §1, [src/js/router.js:211](../../../src/js/router.js#L211) |
| 7 | RevenueCat 초기화 + entitlement → `state.isPremium` → collection bypass 연결 | 수익화 | §5 GAP-2 |
| 8 | `autoPublishScheduled`를 Cloud Function/cron으로 이전 | 인프라 비용 | §1, [src/js/services/stories.js:96-124](../../../src/js/services/stories.js#L96-L124) |
| 9 | 일기 저장 idempotency key + 버튼 disable 잠금 (네트워크 끊김 시 중복 저장 방지) | 데이터 무결성 | §2, [src/js/services/mystories.js:48](../../../src/js/services/mystories.js#L48) |
| 10 | Storage URL 식별을 host 파싱으로 — 일기 삭제 시 이미지 잔류 해결 | 비용/데이터 | §2, [src/js/services/mystories.js:80](../../../src/js/services/mystories.js#L80) |
| 11 | CSS 미정의 토큰(`--font-sans`/`--text-md`/`--color-text-on-image`/`--color-editor-comment`) `variables.css`에 추가 | 디자인 시스템 | §3 |
| 12 | `@media (prefers-reduced-motion: reduce)` 글로벌 블록 추가 | 접근성/WCAG | §3 |
| 13 | `.page-header-back`·`.calendar-month-arrow` 터치 영역 44pt 확장 | UX | §3 |
| 14 | collection 데이터 Firestore 동기화 (`collections/{uid}/{storyId}`) | 리텐션 | §5 P1-A |
| 15 | report.js Firestore 저장 OR 기능 제거 결정 | 신뢰 | §5 GAP-4 |
| 16 | `searchStoriesDB` 페이지네이션 또는 서버 검색 | 성능 | §1, [src/js/services/stories.js:232](../../../src/js/services/stories.js#L232) |
| 17 | profile.js의 Firebase 직접 호출 → `services/profile.js` 신설 후 이동 | 아키텍처 | §1 |
| 18 | `withTimeout` / `isFirebaseStorageUrl` / `escapeHtml` 중복 제거 | 리팩토링 | §6 |

### P2 — 분기 단위 (1.5+, 2.0)

| # | 액션 | 영역 |
|---|---|---|
| 19 | `donate.js` 페이지 paywall 모달로 교체 후 페이지 삭제, `license.js`/`about.js`를 설정 페이지 섹션으로 흡수 | 정리 |
| 20 | 카카오톡 SDK 연동 (한국 시장 바이럴 루프) | 그로스 |
| 21 | 알림 기본값 ON + 첫 진입 시 1개 코치마크 (D1 트리거 강화) | 리텐션 |
| 22 | `sanitizeUrl` 화이트리스트 패턴으로 강화 | 보안 |
| 23 | PRD를 다국어 정식 지원으로 갱신, 번역 품질 검수 기준 수립 | 문서 |
| 24 | Capacitor `@capacitor/haptics` 도입 후 북마크/플립/삭제 햅틱 | UX |
| 25 | 휠 피커 공통 유틸 추출은 E2E 테스트 선행 후 — 지금은 손대지 말 것 | 리팩토링 |

### 점검하지 않은 영역 (다음 사이클 후보)

- Firestore 실제 보안 룰 (콘솔에만 존재, 레포에 파일 없음)
- 빌드/배포 파이프라인 (`functions/` Cloud Functions IAM 권한 — [docs/SESSION_LOG.md:60](../../SESSION_LOG.md#L60) "Functions 배포는 GCP IAM 권한 부족으로 중단" 미해결)
- Capacitor 안드로이드 위젯 코드 ([android/](../../../android/))
- iOS Xcode 프로젝트 설정·Info.plist
- 실제 사용자 분석(Firebase Analytics·Crashlytics 데이터)

---

## 부록 — 점검 메타

- **점검 일자**: 2026-05-22
- **앱 버전**: v1.3.5 (Android versionCode 20)
- **점검 모드**: 6-Agent read-only audit (코드 미변경)
- **사용 에이전트**: critical-reviewer / qa-tester / ui-designer / user-researcher / product-planner / refactor-specialist
- **인용 파일 수**: 약 30개 (src/js/services 11, src/js/pages 8, src/js/components 4, src/css 4, src/js/utils 2, docs 3)
- **다음 재감사 권장 시점**: P0/P1 액션 처리 후 v1.4.0 출시 직전
