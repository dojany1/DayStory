# SESSION_LOG

DayStory 작업 이력 요약입니다. 세부 변경파일 목록 대신 날짜별 패치노트 형식으로 간략히 유지합니다.

## 기록 방식

- 새 작업은 해당 날짜 아래에 1~5개 bullet로 추가합니다.
- 변경파일 목록은 적지 않습니다. 필요하면 git diff, commit, PRD, CODE_MAP을 확인합니다.
- 검증은 대표 명령과 결과만 짧게 적습니다.
- 같은 날짜의 작은 수정은 별도 세션으로 쪼개지 말고 기존 날짜 항목에 이어 적습니다.
- 2026-08-25 이전 기록은 [docs/SESSION_LOG_ARCHIVE.md](docs/SESSION_LOG_ARCHIVE.md) 를 확인합니다.

---

## 2026-08-25

### 2026-08-25 17:55 — Claude · Google AdMob 연동 기반 구축 (배너 + 전면, UMP/ATT 동의 포함)

- **요구사항**: 앱 내 Google AdMob 광고 도입. 형식은 **배너 + 전면 광고**, 개인정보 동의는 **UMP + iOS ATT 모두** 구현. 광고의 실제 **노출 위치(배치)는 이번 세션에서 결정하지 않고 보류** — 기반 공사만 완료.
- **구현방법**:
  - **플러그인**: `@capacitor-community/admob@8.1.0` 설치(peer `@capacitor/core ^8.0.0` 로 Capacitor 8 호환). 프로젝트에 선재하던 `firebase@10` vs `@capacitor-firebase/authentication@8.2.0`(firebase ^12 요구) peer 충돌 때문에 `--legacy-peer-deps` 로 설치(기존 node_modules 도 동일 방식으로 구성되어 있었음).
  - **`capacitor.config.json`** — 이 프로젝트는 `android.includePlugins` **화이트리스트** 방식이라 여기 등록하지 않으면 설치해도 Android 빌드에서 누락된다. `@capacitor-community/admob` 추가.
  - **`src/js/services/ads.js`** (신규) — 아키텍처 규칙(§3)에 따라 SDK 를 서비스 레이어로 격리. 웹에서는 완전 no-op, 네이티브에서만 동작. 모든 실패를 흡수해 **절대 throw 하지 않고 false 반환**(광고 때문에 앱 흐름이 깨지지 않도록). 초기화는 single-flight. Google 권장 순서 **UMP 동의 → iOS ATT → AdMob.initialize** 준수(IDFA 확정 후 SDK 시작). `canRequestAds === false` 면 광고 요청 자체를 차단하고, 동의가 `OBTAINED`/`NOT_REQUIRED` 가 아니면 `npa: true`(비개인화)로 요청. API: `initAds` / `showAdBanner` / `hideAdBanner` / `resumeAdBanner` / `removeAdBanner` / `onBannerSizeChanged` / `showAdInterstitial` / `isAdsReady` / `canShowAds` / `isPrivacyOptionsRequired` / `openPrivacyOptionsForm` / `setAdsEnabled`. 광고 ID 는 파일 상단 설정 블록(`USE_TEST_ADS`, `LIVE_AD_UNITS`, `TESTING_DEVICES`)에 모아 두어 실 ID 발급 후 한 곳만 고치면 되게 함.
  - **`src/main.js`** — `checkAndStartApp()` 에서 스플래시가 걷힌 뒤 `void initAds()` 호출. 스플래시 위에 UMP/ATT 팝업이 뜨는 것을 피하기 위한 위치이며, **광고를 표시하지는 않는다**(노출은 배치 결정 후 각 화면이 담당).
  - **`android/app/src/main/AndroidManifest.xml`** — `com.google.android.gms.ads.APPLICATION_ID` meta-data(값 없거나 형식 틀리면 실행 즉시 크래시) + targetSdk 33+ 필수인 `com.google.android.gms.permission.AD_ID` 권한 추가.
  - **`ios/App/App/Info.plist`** — `GADApplicationIdentifier`, ATT 팝업 문구 `NSUserTrackingUsageDescription`(없으면 추적 요청 불가 + 심사 리젝), `SKAdNetworkItems` 추가. iOS 는 CocoaPods 가 아닌 **SPM** 구성이라 `CapApp-SPM/Package.swift` 는 `npx cap sync ios` 가 자동 갱신.
- **변경파일**: `package.json`, `package-lock.json`, `capacitor.config.json`, `src/js/services/ads.js`(신규), `tests/ads.spec.js`(신규), `src/main.js`, `android/app/src/main/AndroidManifest.xml`, `ios/App/App/Info.plist`, `android/*`·`ios/*`(cap sync 산출물), `SESSION_LOG.md`.
- **검증(TDD)**: `tests/ads.spec.js` 를 먼저 작성 후 구현 — 27/27 통과(웹 no-op, 초기화 순서/단일실행, 동의 게이트, npa 판정, 배너 위임, 전면 사전로드·자동 재준비, 실패 시 throw 금지, 전역 스위치). 테스트가 실제 버그 1건을 잡음: 전면 광고 `Dismissed` 시 재준비 로직이 **직전 사전 로드가 진행 중이면 "이미 로딩 중" 가드에 걸려 재준비를 통째로 유실** → 진행 중인 로드를 await 한 뒤 다시 채우도록 수정. 전체 588 passed / 6 failed(기존 베이스라인 `ios_gpu_webp_guard`·`inquiry_ui`·`detail_nav.ui`·`editorstory.ui` 와 정확히 동일, **회귀 0건**) / 6 skipped. `npm run build` 성공, `npx cap sync android`·`ios` 성공(11개 플러그인 인식).
- **남은 작업(수동/후속)**: ① AdMob 콘솔에서 Android/iOS 앱 등록 → **앱 ID**(`…~…`) 를 AndroidManifest·Info.plist 의 테스트 값과 교체. ② 배너/전면 **광고 단위 ID**(`…/…`) 발급 → `ads.js` 의 `LIVE_AD_UNITS` 채우고 출시 직전 `USE_TEST_ADS = false`. ③ `Info.plist` 의 `SKAdNetworkItems` 는 현재 Google 자체 ID 1개만 넣은 최소 구성 — 출시 전 Google 공식 전체 목록으로 교체 필요. ④ **광고 노출 위치 결정 후** `showAdBanner()`/`showAdInterstitial()` 호출부 + 배너 높이만큼의 CSS 레이아웃 보정 작업. ⑤ 설정 화면에 `isPrivacyOptionsRequired()` 기반 "광고 개인정보 설정" 메뉴 노출(EEA 사용자 대상, GDPR 요구사항). ⑥ Google Play "데이터 안전" 양식 / App Store "앱 개인정보 보호" 항목에 광고 식별자 수집 신고.

### 2026-08-25 18:20 — Claude · AdMob 실제 앱 ID / 광고 단위 ID 배선 + ID 정적 검증 테스트

- **요구사항**: AdMob 콘솔에서 발급받은 실제 앱 ID(Android/iOS)와 광고 단위 ID(배너/전면 × 2 플랫폼)를 프로젝트에 반영.
- **구현방법**:
  - **앱 ID 는 실제 값으로 교체, `USE_TEST_ADS = true` 는 유지** — Google 권장 조합(앱 ID 는 실제 값, 테스트 여부는 광고 "단위" 레벨에서 제어). 실 광고 단위로 개발 테스트 시 무효 트래픽 정책 위반으로 계정 정지 위험이 있어 출시 직전에만 스위치를 내린다.
  - `android/app/src/main/AndroidManifest.xml` — `APPLICATION_ID` meta-data → `ca-app-pub-3250744272484684~3073922259`.
  - `ios/App/App/Info.plist` — `GADApplicationIdentifier` → `ca-app-pub-3250744272484684~4191562809`.
  - `src/js/services/ads.js` — `LIVE_AD_UNITS` 4개 채움. Android 배너 `…/1749232294`, Android 전면 `…/6618415596`, iOS 배너 `…/2399968981`, iOS 전면 `…/4413984739`. 앱 ID 는 여기가 아니라 네이티브 설정에 있다는 주석 추가.
  - `tests/ads.spec.js` — ID 배선 정적 검증 4건 추가(기존 spec 컨벤션인 소스 직접 읽기 방식). **앱 ID(`~`)와 광고 단위 ID(`/`) 를 서로 바꿔 넣는 실수**(앱 ID 자리가 틀리면 실행 즉시 크래시), 퍼블리셔 계정 번호 불일치, 실 광고 단위 자리에 Google 테스트 퍼블리셔(`3940256099942544`) 잔존, 4개 ID 중복을 각각 차단.
- **변경파일**: `android/app/src/main/AndroidManifest.xml`, `ios/App/App/Info.plist`, `src/js/services/ads.js`, `tests/ads.spec.js`, `android/*`·`ios/*`(cap sync 산출물), `SESSION_LOG.md`.
- **검증**: `tests/ads.spec.js` 31/31 통과(기존 27 + ID 배선 4). 전체 592 passed / 6 failed(기존 베이스라인 `ios_gpu_webp_guard`·`inquiry_ui`·`detail_nav.ui`·`editorstory.ui` 와 동일, **회귀 0건**) / 6 skipped. `npm run build` 성공, `npx cap sync android`·`ios` 성공.
- **남은 작업**: ① **광고 노출 위치 결정** 후 `showAdBanner()`/`showAdInterstitial()` 호출부 + 배너 높이 CSS 보정(`onBannerSizeChanged()` 준비됨). ② `Info.plist` `SKAdNetworkItems` 를 Google 공식 전체 목록으로 교체. ③ 설정 화면에 `isPrivacyOptionsRequired()` 기반 "광고 개인정보 설정" 메뉴 노출(EEA/GDPR). ④ 출시 직전 `ads.js` 의 `USE_TEST_ADS = false`. ⑤ Play "데이터 안전" / App Store "앱 개인정보 보호" 양식에 광고 식별자 수집 신고.

### 2026-08-25 19:20 — Claude · 광고 배치/빈도 정책 구현 (배너 3화면 + 전면 전환지점, 기기 테스트 핸들 포함)

- **요구사항**: 직전 검토에서 제시한 권장안대로 광고 노출을 구현하고, 사용자가 기기에서 직접 테스트할 수 있게 할 것.
- **원안 대비 변경 근거**: 사용자의 초안(배너를 `settings-user-info` 상단·`calendar-grid` 하단에 인라인 배치, 전면을 카드 5장 플립마다)은 성립 불가/고위험으로 판단해 조정. ① AdMob 배너는 DOM 요소가 아니라 WebView 위 네이티브 뷰(Android `BannerExecutor.java` CoordinatorLayout+Gravity, iOS `BannerExecutor.swift` addSubview+safeAreaLayoutGuide)라 **DOM 인라인 삽입 불가·페이지와 함께 스크롤 안 됨**. `.page-calendar-view` 는 `overflow-y:auto` 이고 grid 행수(5~6주)가 달마다 달라 `calendar-grid` 하단 고정은 불가능. `calendar-page-title` 제거도 인라인 배너가 아니라 무의미하며, mystory 는 `headerHtml:''` 이라 이 타이틀이 캘린더 뷰의 유일한 라벨이라 제거 시 라벨이 사라짐. ② 플립마다 전면은 핵심 상호작용을 끊고, 이 앱은 iOS WKWebView GPU 프로세스 종료 이력이 있어 rotateY 3D 플립 위 풀스크린 광고가 위험.
- **구현방법**:
  - **`src/js/services/adPlacement.js`**(신규) — 배치·빈도 정책 전담(ads.js 는 SDK 호출만 담당하도록 관심사 분리). 배너: `/profile`·`/editorstory`·`/mystory` 에서만, editorstory/mystory 는 **캘린더 뷰일 때만**(카드 뷰는 375×667 히어로 콘텐츠이자 공유 캡처 대상이라 제외), `BOTTOM_CENTER` + `margin = --nav-height` 로 하단 내비 바로 위. 전면: 앱 시작 60초 유예 + 쿨다운 4분 + 세션 3회 상한, 노출 지점은 **뷰 토글/메인 탭 이동/일화 저장**뿐이며 카드 플립은 명시적으로 제외. 첫 일화 저장은 건너뜀(localStorage 영속). 실제 노출되지 않으면(no fill/미로드) 쿨다운·카운트를 소모하지 않음.
  - **레이아웃 예약** — 네이티브 배너는 DOM 자리를 못 만들므로 `onBannerSizeChanged` 로 받은 실제 높이를 `--ad-banner-height` 에 주입하고 `.has-ad-banner` 토글. `src/css/base.css` 의 `.app-container` padding-bottom 계산식에 이 변수를 더해 콘텐츠가 가려지지 않게 함(no-nav 변형 포함). 적응형 배너는 기기마다 높이가 달라 하드코딩 불가.
  - **`src/js/services/ads.js`** — `showAdInterstitial({ onlyIfReady })` 추가. true 면 미로드 시 기다리지 않고 즉시 false 반환 → 저장 직후처럼 화면 전환이 이어지는 지점에서 앱이 수 초간 멈춘 것처럼 보이는 것을 방지. `isInterstitialReady()` 도 추가.
  - **`src/js/components/cardDeck/cardDeckController.js`** — 뷰 토글 양방향에서 `ds:view-changed` 발행(배너 조건 + 전면 전환지점).
  - **`src/js/pages/mystory.js`** — 저장 성공 후 `setTimeout(1200ms)` 로 `notifyStorySaved()` 호출. 즉시 호출하면 "저장되었습니다" 토스트를 광고가 덮어 **사용자가 저장 실패로 오인**한다.
  - **`src/main.js`** — `initAdPlacement()` 는 리스너를 즉시 등록하고, 배너 첫 동기화는 `initAds().then(...)` 뒤로 미룸. `initRouter()` 가 먼저 돌아 첫 라우트의 `setBeforeNavigate` 가 SDK 준비 전에 지나가므로, 이 재동기화가 없으면 콜드 부팅으로 캘린더 뷰 진입한 사용자는 다른 탭에 다녀오기 전까지 배너를 못 본다. `setBeforeNavigate` 의 인증 가드 통과 이후에 `syncBannerForRoute`/`notifyRouteChanged` 배선.
  - **기기 테스트 지원** — `initAdPlacement()` 가 `window.__dsAds`(`state`/`bypass`/`banner`/`interstitial`/`reset`) 노출. `setAdsDebugBypass(true)` 는 유예·쿨다운·세션상한을 모두 무시하며 localStorage 영속. 정책 판정 사유를 `console.info('[ads] …')` 로 출력하되 `USE_TEST_ADS` 로 게이트해 실 광고 전환 시 자동으로 조용해짐.
- **변경파일**: `src/js/services/adPlacement.js`(신규), `tests/adPlacement.spec.js`(신규), `src/js/services/ads.js`, `src/css/base.css`, `src/js/components/cardDeck/cardDeckController.js`, `src/js/pages/mystory.js`, `src/main.js`, `android/*`·`ios/*`(cap sync 산출물), `SESSION_LOG.md`.
- **검증(TDD)**: `tests/adPlacement.spec.js` 28건 선작성 후 구현 — 배너 라우트/뷰 조건, 레이아웃 예약, 유예·쿨다운·상한, 노출 지점, 플립 비트리거, 첫 저장 제외 영속, 디버그 우회, 멱등성. 테스트가 실제 결함 1건을 잡음: **`initAdPlacement()` 재호출 시 document 리스너가 중복 등록돼 전면 광고가 배수로 발화** → `bind()`/`destroyAdPlacement()` 도입 + init 을 멱등하게 수정. 전체 620 passed / 6 failed(기존 베이스라인 동일, **회귀 0건**) / 6 skipped. `npm run build` 성공, `cap sync android`·`ios` 성공.
- **남은 작업**: ① 기기에서 배너 위치·레이아웃 겹침 실물 확인 후 margin 미세조정. ② `SKAdNetworkItems` Google 공식 전체 목록 교체. ③ 설정 화면에 `isPrivacyOptionsRequired()` 기반 "광고 개인정보 설정" 메뉴(EEA/GDPR). ④ 출시 직전 `USE_TEST_ADS = false`. ⑤ Play "데이터 안전" / App Store "앱 개인정보 보호" 양식 신고. ⑥ AdMob 콘솔에서 전면 광고 단위 빈도 제한도 병행 설정.

### 2026-08-25 19:58 — Claude · 기기 테스트 피드백 3건 수정 (오버레이 가림 / 카드뷰 배너 잔존 / 쿨다운 2분)

- **요구사항**: 실기기 테스트에서 발견된 ① `calendar-card-popup` 하단 텍스트가 배너에 가림, ② `editorstory-card-area`(카드 뷰)에서 배너가 의도치 않게 표시됨, ③ 전면 광고 쿨다운 4분 → 2분.
- **원인 및 구현방법**:
  - **①** 네이티브 배너는 WebView "위"에 얹히는 별도 뷰라 CSS z-index 로는 절대 덮을 수 없다(팝업이 `position:fixed; inset:0` 여도 무의미). `adPlacement.js` 에 `OVERLAY_SELECTORS`(calendar-card-popup / confirm-dialog-overlay / modal-overlay / notification-settings-overlay / crop-modal-overlay — 모두 body 직속)와 `MutationObserver`(childList + class 속성) 를 두어, 오버레이가 열리면 `hideAdBanner()`, 닫히면 현재 라우트로 재동기화 후 `resumeAdBanner()`. 팝업뿐 아니라 confirm/시트/크롭 모달도 같은 문제였으므로 일괄 처리. `hideBanner` 가 쏘는 `{0,0}` SizeChanged 를 그대로 반영하면 오버레이 뒤 레이아웃이 접혔다 펴지며 튀므로, `bannerSuspended` 동안 `applyBannerHeight()` 를 동결(값 갱신도 안 함)하고 복귀 시 `lastBannerHeight` 로 되돌린다. 오버레이 중에는 `syncBannerForRoute()` 도 즉시 반환한다.
  - **②** 근본 원인은 `initAdPlacement()` 가 `await onBannerSizeChanged(...)` **뒤에** `ds:view-changed` 리스너를 등록한 것 — SDK 구독이 지연되면 리스너가 아예 안 걸려 카드 뷰로 되돌려도 배너가 남는다. 리스너/옵저버 등록을 모든 await 앞으로 옮기고 배너 높이 구독을 마지막으로 이동. 추가 안전장치로 뷰 판정을 **DOM 우선**으로 변경 — `ds_session_view` 는 editorstory/mystory 가 공유하는 키라 실제 화면과 어긋날 수 있어, 페이지가 마운트돼 있으면 `.{pageClass} .page-calendar-view` 의 `hidden` 을 신뢰하고 미마운트 시에만 저장소로 판단(`setBeforeNavigate` 는 새 페이지가 붙기 전에 호출되므로 폴백이 필요). 이 변경에 맞춰 `cardDeckController` 의 `ds:view-changed` 발행을 `hidden` 반영 **이후**로 이동(먼저 쏘면 아직 숨겨진 상태로 읽혀 배너가 안 뜬다).
  - **③** `COOLDOWN_MS` 4분 → 2분.
- **변경파일**: `src/js/services/adPlacement.js`, `src/js/components/cardDeck/cardDeckController.js`, `tests/adPlacement.spec.js`, `android/*`·`ios/*`(cap sync 산출물), `SESSION_LOG.md`.
- **검증(TDD)**: 회귀 테스트 12건 선작성 후 수정 — 오버레이 hide/resume, 오버레이 중 신규 배너 차단, 오버레이 중 높이 0 무시, SDK 구독 pending 상태에서도 뷰 리스너 동작, 쿨다운 2분 경계, DOM 우선 뷰 판정 4건, 토글 이벤트 발행 순서 계약. 테스트가 실제 버그 1건을 추가로 잡음: **`resumeAdBanner` 를 import 하지 않고 사용** → unhandled rejection. `adPlacement.spec.js` 40/40 통과. 전체 632 passed / 6 failed(기존 베이스라인 동일, **회귀 0건**) / 6 skipped. `npm run build` 성공, `cap sync android`·`ios` 성공.
- **주의**: ②의 정확한 재현 경로는 기기 로그 없이 확정하지 못해, 리스너 등록 순서(주 원인 추정)와 DOM 우선 판정(2차 안전장치)을 함께 적용했다. 재발 시 `window.__dsAds.state()` 의 `view`/`bannerRoute` 값으로 어느 쪽이 어긋나는지 확인 가능.

---

## 2026-08-25 20:45 — Claude (Opus 5)

### 요구사항
기기 테스트 재검증에서 이슈 ②(카드 뷰에 배너 잔존) 재발. 재현 경로 확인됨 —
상단 보기 방식 변경 버튼을 빠르게 두 번 누르거나, 하단 내비게이션으로 빠르게
화면을 전환할 때 발생.

### 원인
배너 조작 요청이 겹칠 때 순서가 뒤집히는 레이스.
`ads.js`의 `showAdBanner()`가 `AdMob.showBanner()` 브리지 호출이 **끝난 뒤에야**
내부 `bannerVisible` 플래그를 세우는데, `removeAdBanner()`/`hideAdBanner()`는
그 플래그가 `false`면 아무 것도 하지 않고 return 한다. 따라서

  1. 캘린더 전환 → `showBanner()` 진행 중 (플래그 아직 false)
  2. 곧바로 카드 전환 → `removeAdBanner()` → 플래그 false → **조용히 무시**
  3. 1번이 뒤늦게 완료 → 배너 표시 → 카드 뷰에 잔존

이후 `adPlacement`는 자신을 `bannerVisible=false`로 인지하므로 정리 요청을
다시 내보내지 않아 배너가 **영구히 남는다**.

### 구현방법
1. `ads.js` — `bannerVisible = true`를 브리지 호출 **이전**으로 이동.
   실패해도 되돌리지 않는다(네이티브 뷰가 남았을 수 있어 정리 요청을
   통과시키는 편이 안전).
2. `adPlacement.js` — 배너 네이티브 조작 직렬화 큐(`queueBannerOp`) 도입.
   show/remove/hide/resume 이 한 줄로 실행되어 순서 역전이 불가능해진다.
   연타로 큐에 쌓인 중간 요청은 요청 번호(`bannerSeq`) 비교로 폐기하여
   최신 상태만 반영(깜빡임 방지). 오버레이 열림 시 `bannerSeq`를 올려
   대기 중인 배너 요청을 무효화.
3. `adPlacement.js` — 자가 복구: 배너를 띄우면 안 되는 라우트/뷰에서는
   내부 상태와 무관하게 항상 `removeAdBanner()`를 요청한다. 실제로 배너가
   없으면 `ads.js`가 no-op 으로 흘리므로 비용이 없고, 상태가 어긋나도
   배너가 영구히 남지 않는다.
4. TDD — 실패 테스트 7건 선작성 후 구현(레드 5 → 그린).

### 검증
- `tests/adPlacement.spec.js` 45/45, `tests/ads.spec.js` 33/33
- 전체 639 passed / 6 failed(기존 baseline 동일, 회귀 0) / 6 skipped
- `npm run build`, `npx cap sync android`, `npx cap sync ios` 정상

### 변경파일
- `src/js/services/ads.js`
- `src/js/services/adPlacement.js`
- `tests/ads.spec.js`
- `tests/adPlacement.spec.js`
- `SESSION_LOG.md`

---

## 2026-08-25 20:52 — Claude (Opus 5)

### 요구사항
`.calendar-page-title`(카드덱 캘린더 뷰 상단 제목)에 들어가는 텍스트가 한국어로
하드코딩되어 다국어(en/ja/es/zh) 전환 시에도 한국어로 남는 문제 수정.

### 원인
`cardDeckController.buildShellHtml()`은 `config.calendarTitle`을 그대로 렌더한다.
같은 shell 안의 다른 문자열(`common.view_toggle`, `common.prev_month` 등)은 모두
`t()`를 통과하지만, 이 값만 호출부에서 한국어 리터럴로 주입되고 있었다.
- `mystory.js` → `calendarTitle: '나의 일화'`
- `editorstory.js` → `calendarTitle: '에디터 일화'`
언어 변경 시 `forceRoute()`로 페이지가 재렌더되지만 리터럴이라 값이 바뀌지 않는다.

### 구현방법
1. TDD — `tests/calendar_page_title_i18n.spec.js` 신규 작성(레드 9건).
   번역 키 존재(5개 로케일) · ko 외 로케일에 한글 잔존 없음 ·
   호출부가 `t()`만 사용 · `buildCardDeck`의 `.calendar-page-title` 렌더/미렌더 분기.
2. `calendar` 네임스페이스에 `page_title_history` / `page_title_mine` 키를
   ko/en/ja/es/zh 5개 파일에 동일 위치(`tab_mine` 직후)로 추가.
   기존 용어(`calendar.tab_mine`)와 번역을 맞춰 앱 전체 표기를 일관되게 유지.
3. 두 호출부를 `t('calendar.page_title_mine')` / `t('calendar.page_title_history')`로 교체
   (두 페이지 모두 이미 `t`를 import 하고 있어 추가 import 불필요).

### 검증
- `tests/calendar_page_title_i18n.spec.js` 11/11 통과
- `tests/i18n_locale_expansion.spec.js`(키 패리티) · `cardDeckController.spec.js` ·
  `i18n_language_settings.spec.js` 포함 40/40 통과
- 전체 `npm test` 650 passed / 6 failed(기존 baseline 동일, 회귀 0) / 6 skipped
- Capacitor 설정·플러그인·index.html 변경 없음 → `cap sync` 불필요

### 변경파일
- `src/i18n/ko.json`, `src/i18n/en.json`, `src/i18n/ja.json`, `src/i18n/es.json`, `src/i18n/zh.json`
- `src/js/pages/mystory.js`
- `src/js/pages/editorstory.js`
- `tests/calendar_page_title_i18n.spec.js`
- `SESSION_LOG.md`

### 2026-08-26 12:36 — Claude

### 요구사항
빌드 상태 점검 후, 발견된 문제를 수정하고 실기기 테스트가 가능한 상태로 만들 것.

### 원인 분석
1. `.flipper` base rule 의 `transition: transform 0.5s  scale 0.3s cubic-bezier(...)` 에
   쉼표가 빠져 있었다. CSS `transition` 단축 속성의 단일 항목은 속성명 1개 + 시간 최대 2개만
   허용하는데 속성명 2개(`transform`, `scale`)와 시간·easing 3개가 들어가 **선언 전체가 파서에서
   폐기**되던 상태. 그 결과 `.is-pressed` 해제 시 scale 복귀 애니메이션이 사라져 카드가 즉시 튕겼다
   (바로 아래 `.is-pressed` 주석이 "복귀는 base .flipper 의 0.3s cubic-bezier 적용" 이라 명시).
2. 테스트 6건 실패는 모두 구현이 앞서 나가고 기대값이 뒤처진 stale 케이스.
   HEAD(`2c2241e`)를 별도 worktree 로 체크아웃해 동일하게 6건 실패함을 확인 — 회귀 아님.

### 구현방법
1. `src/css/components.css` — `.flipper` transition 을 `scale 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)`
   로 재작성. base 에서 `transform` 을 빼는 것은 iOS GPU 가드(Swiper translate3d 충돌 회피) 의도와
   일치하며, `.is-flipping` / `.flipped` 의 transform transition 은 그대로 유지.
2. `tests/inquiry_ui.spec.js` — 문의 시트가 네이티브 `<select>` → 커스텀 콤보박스로 리팩터링된 것에
   맞춰 `.inquiry-custom-select` 클릭 후 `.inquiry-select-options .inquiry-select-option` 의
   `dataset.value` 를 검증하도록 갱신. 팝업이 `document.body` 에 붙으므로 afterEach 정리도 추가.
3. `tests/detail_nav.ui.spec.js` — nav 아이콘이 `nav-icon-default` / `nav-icon-active` 2종으로
   분리된 것에 맞춰 `class="nav-icon"` 정확 매칭을 클래스 토큰 매칭(`/class="nav-icon(?:\s|")/`)으로 완화.
4. `tests/editorstory.ui.spec.js` — 말풍선 테두리를 `--color-accent-light` 로 변경한 현재 디자인에
   기대값 동기화.

### 검증
- `npm test` — 656 passed / 0 failed / 6 skipped (수정 전 650 passed / 6 failed)
- `npm run build` 성공, 경고 0건
- dist CSS 에 `transition:scale .3s cubic-bezier(.25,.8,.25,1)` 반영 확인, 깨진 선언 잔존 0건
- `npx cap sync android` / `npx cap sync ios` 완료 — 양 플랫폼 모두 플러그인 11개 인식,
  `index-Bod2vFfC.css` 동일 해시로 네이티브 자산까지 반영 확인

### 변경파일
- `src/css/components.css`
- `tests/inquiry_ui.spec.js`
- `tests/detail_nav.ui.spec.js`
- `tests/editorstory.ui.spec.js`
- `android/app/src/main/assets/public/*`, `ios/App/App/public/*` (cap sync 산출물)
- `SESSION_LOG.md`

---

## 2026-08-26 12:50 — Claude (Opus 5)

### 요구사항
이슈 ②(카드 뷰·엉뚱한 탭에 배너 잔존) 3차 재발. 사용자 관찰:
"베너가 나오기 직전에 다른 탭으로 이동하면, 이전 탭에 나와야 했던 베너가
이동한 탭에 그냥 출력되는 것 같음."

### 원인 (플러그인 소스에서 확정)
`@capacitor-community/admob` 의 배너 라이프사이클이 원인이었다.

**iOS (`ios/Sources/AdMobPlugin/Banner/BannerExecutor.swift`)**
- `showBanner()` 는 `BannerView` 를 만들고 `load()` 만 건 뒤 즉시 resolve 한다.
  이 시점에 배너는 **아직 뷰 계층에 없다.**
- 실제 `rootViewController.view.addSubview(bannerView)` 는 광고 로드가 끝난 뒤
  delegate 콜백 `bannerViewDidReceiveAd` 에서 일어난다.
- `removeBanner()` → `removeBannerViewToView()` 는 `viewWithTag()` 로 **이미
  붙어 있는** 배너만 찾아 지운다. 로드 중인 배너에는 아무 효과가 없고
  `delegate` 도 해제되지 않는다.
- ⇒ 배너가 뜨기 직전에 화면을 옮기면, 이전 화면에서 요청한 배너가 뒤늦게
  로드되어 **옮겨간 화면에 그대로 붙는다.** 사용자 관찰과 정확히 일치.

**Android (`BannerExecutor.java`)**
- `showBanner()` 는 `mAdView != null` 일 때 `updateExistingAdView()` 만 호출하고
  **`call.resolve()` 없이 return** 한다 ⇒ JS 프로미스가 영영 끝나지 않는다.
  직전 커밋에서 도입한 배너 직렬화 큐가 이 호출에서 통째로 잠길 수 있었다.

앞선 두 차례 수정(JS 프로미스 순서 · 직렬화 큐)은 JS 레이어의 경합만 다뤘기
때문에 이 네이티브 경로를 전혀 막지 못했다.

### 구현방법
1. **배너 켜기 안정화 (`BANNER_SETTLE_MS = 300`)** — 배너를 *켜는* 요청은
   화면이 300ms 안정된 뒤에만 실제로 보낸다. 연타·빠른 탭 전환 중에는 광고
   요청 자체가 나가지 않으므로 "뒤늦게 붙는 배너" 가 생기지 않는다.
   *끄는* 요청은 지연 없이 즉시 처리한다(한 프레임도 남기면 안 되므로).
   사용자 제안(보기 방식 전환 쿨타임)을 UI 대신 광고 요청 레이어에 적용한
   형태 — 화면 전환 자체는 그대로 즉시 반응한다.
2. **뒤늦게 도착한 배너 정리** — `bannerAdSizeChanged(height>0)` 는 "배너가
   지금 화면에 붙었다" 는 유일한 신호다. 이 순간 현재 라우트/뷰로 다시 판정해
   맞지 않으면 즉시 제거한다(이때는 뷰 계층에 있으므로 제거가 실제로 먹는다).
   오버레이가 떠 있으면 대신 hide 한다. 배너 자동 새로고침마다 이 검증이
   반복되므로 상시 자가 교정으로도 동작한다.
3. **이미 떠 있는 배너는 재요청하지 않는다** — 배너는 앱 전체에 1개이고 위치도
   라우트와 무관하게 같다. 라우트만 갱신한다. 안드로이드의 미해결 PluginCall
   경로를 원천 회피.
4. **브리지 타임아웃 가드 (`ads.js`, 5초)** — 응답 없는 브리지 호출이 배너 조작
   큐를 잠그지 못하게 한다. 타임아웃 시 성공으로 보고하지 않는다.
5. **`ads.js` 내부 상태 동기화** — `SizeChanged(height>0)` 를 받으면
   `bannerVisible = true` 로 맞춘다. 로드 중 remove 를 보내 플래그만 false 가
   된 상태에서 뒤늦게 붙은 배너를 다시 제거할 수 있게 하는 핵심.
   (height 0 으로는 false 를 세우지 않는다 — hideBanner 도 {0,0} 을 쏘는데
   그때 배너 뷰 자체는 살아 있다.)
6. TDD — 실패 테스트 8건 선작성 후 구현(레드 8 → 그린).

### 검증
- `tests/adPlacement.spec.js` + `tests/ads.spec.js` 84/84
- 전체 662 passed / 0 failed / 6 skipped
  (기존 baseline 6건 실패는 사용자가 같은 날 `components.css` 및 3개 spec 을
   직접 수정하면서 해소됨 — 광고 작업과 무관)
- `npm run build`, `npx cap sync android`, `npx cap sync ios` 정상

### 변경파일
- `src/js/services/ads.js`
- `src/js/services/adPlacement.js`
- `tests/ads.spec.js`
- `tests/adPlacement.spec.js`
- `SESSION_LOG.md`

---

## 2026-08-26 13:50 — Claude (Opus 5)

### 요구사항
전면 광고 트리거에서 카드 ↔ 캘린더 뷰 토글을 제거하고, 카드 뒷면 "상세 보기"
버튼 클릭을 대신 트리거로 지정.

### 구현방법
- `adPlacement.js` — `ds:view-changed` 리스너에서 `maybeShowInterstitial` 제거.
  뷰 토글은 같은 화면 안의 표시 방식 변경일 뿐 화면을 떠나는 전환이 아니므로
  전면 광고 지점에서 뺀다. 배너는 캘린더 뷰에서만 뜨는 정책이 걸려 있으므로
  같은 리스너의 `syncBannerForRoute()` 는 그대로 유지.
- `adPlacement.js` — `notifyDetailOpened()` 신설. 기존 `notifyRouteChanged()` /
  `notifyStorySaved()` 와 같은 알림 계층이며, 빈도 정책(시작 유예 60초 ·
  쿨다운 2분 · 세션 3회)과 `onlyIfReady` 판단은 `maybeShowInterstitial()` 이
  그대로 담당한다. 노출 지점 식별자는 `'detail'`.
- `editorstory.js` — 카드 뒷면 `.card-detail-shortcut-btn` 핸들러에서
  `navigate('/detail/:id')` 직후 `void notifyDetailOpened()`. 이동을 막지 않도록
  fire-and-forget.
- `cardDeckController.js` — `ds:view-changed` 가 더 이상 전면 광고와 무관하다는
  사실을 반영해 주석만 정정.
- TDD — 스펙 선수정(레드 4 → 그린): 뷰 토글이 전면 광고를 띄우지 않는다는
  회귀 가드, `notifyDetailOpened()` 노출/빈도 정책 준수, 상세보기 버튼 클릭이
  전환 지점을 알린다(플립만으로는 알리지 않는다).
- 뷰 토글 이벤트에 의존하던 기존 init/destroy 테스트 2건은 배너 크기 구독
  해제 · 리스너 정리 기준으로 재작성.

### 검증
- `tests/adPlacement.spec.js` + `tests/editorstory.ui.spec.js` 73/73
- 전체 665 passed / 0 failed / 6 skipped (64 files)
- Capacitor 설정 변경 없음 → `cap sync` 불필요

### 변경파일
- `src/js/services/adPlacement.js`
- `src/js/pages/editorstory.js`
- `src/js/components/cardDeck/cardDeckController.js`
- `tests/adPlacement.spec.js`
- `tests/editorstory.ui.spec.js`
- `SESSION_LOG.md`

---

## 2026-08-26 15:05 — Claude (Opus 5)

### 요구사항
Xcode 실기 테스트에서 상세보기 전면 광고 트리거가 동작하지 않는다는 보고 — 원인 확인.

### 원인
소스는 정상 반영돼 있었으나 웹 번들이 재생성되지 않았다.
`dist/` 는 12:58 빌드본이고 소스 변경은 13:47 이라, 14:56 의 `cap sync ios` 가
변경 이전 번들을 그대로 `ios/App/App/public/` 에 복사했다.
`grep notifyDetailOpened` 가 `dist/`·iOS public 양쪽 모두 0건으로 확인됨.
(직전 항목의 "Capacitor 설정 변경 없음 → cap sync 불필요" 는 플러그인/네이티브
설정 기준의 판단이었고, JS 변경도 `npm run build` + `cap sync` 가 있어야
네이티브 웹뷰에 반영된다는 점을 빠뜨린 것이다. 정정한다.)

### 구현방법
코드 변경 없음. `npm run build` → `npx cap sync ios` → `npx cap sync android`.

### 검증
난독화된 iOS 번들(`index-CW9sZbX0.js`)에서 직접 확인:
- 상세보기 핸들러 = `e.stopPropagation(),g(\`/detail/${t.id}\`),jn()`,
  `jn()` → `kn(\`detail\`)` (= `maybeShowInterstitial('detail')`)
- `ds:view-changed` 리스너 = `()=>{Sn(gn())}` (배너 동기화만, 전면 광고 없음)

### 변경파일
- `dist/` (재빌드)
- `ios/App/App/public/`, `android/app/src/main/assets/public/` (sync)

---

### 2026-08-26 — Claude (Sonnet 5) · SESSION_LOG 아카이브 정리

- **요구사항**: `SESSION_LOG.md` 기록이 너무 방대해져(2104줄) 8월 25일 이전 기록을 `docs/SESSION_LOG_ARCHIVE.md`로 이동 정리.
- **구현방법**: `SESSION_LOG.md`의 2026-05-25 ~ 2026-07-13 구간(1,766줄)을 잘라 기존 `docs/SESSION_LOG_ARCHIVE.md`(2026-05-04~05-24 보관분) 끝에 그대로 이어붙임. 항목 내용은 수정 없이 위치만 이동. `SESSION_LOG.md`에는 헤더/기록 규칙과 2026-08-25 이후 최신 기록만 남기고, 기록 방식 섹션에 아카이브 링크(`docs/SESSION_LOG_ARCHIVE.md`) 안내를 추가. `docs/SESSION_LOG_ARCHIVE.md` 상단 안내 문구도 보관 범위(`2026-05-04 ~ 2026-08-24`)와 최신 로그 상대경로 링크(`../SESSION_LOG.md`)로 갱신.
- **변경파일**: `SESSION_LOG.md`(2104줄 → 339줄), `docs/SESSION_LOG_ARCHIVE.md`(406줄 → 2175줄).
- **검증**: 이동 전후 줄 수 및 경계(2026-05-25 시작 / 2026-07-13 마지막 항목) 확인. 내용 변형 없음.
- `SESSION_LOG.md`

### 2026-08-26 16:20 — Claude (Opus 5) · 기기 크기별 레이아웃 붕괴 수정 (Pro Max 레터박스 / 작은 화면 카드 비율 붕괴)

- **요구사항**: 화면이 큰 기기(iPhone Pro Max)와 작은 기기(iPhone mini/SE)에서 레이아웃이 흐트러지는 문제의 원인을 특정하고 해결. 사용자 결정: ① 실기기는 전체 폭 사용 ② JS ResizeObserver + CSS 변수 방식 ③ 카드 화면 + 전역 공통 레이어까지.
- **원인**: `components.css`(73KB)·`pages.css`(76KB)에 `@media` 쿼리가 **0개** — 화면 크기 적응 로직 자체가 부재했다. 구체적으로 ① `--mobile-max-width: 420px` 가 데스크톱용인데 실기기에도 적용돼 430·440pt 기기에서 앱 좌우에 `--color-bg-desktop` 띠 노출(`mobile-wrapper`/`status-bar-spacer`/`bottom-nav`/`toast-container`/`modal-sheet` 등 7곳이 이 토큰을 공유). ② `.card-swiper` 의 `width:100% + aspect-ratio + max-height:100%` 조합은 **높이가 제약일 때 높이만 잘라내고 폭은 100% 로 유지**해 카드가 뭉툭해진다. ③ 카드 비율이 4곳(`3.1/4.8`, `3/5`, `3/4.8`)에서 서로 달라 스켈레톤↔실카드 크기 점프. ④ `.card-date`(3.55rem)·`.card-image-title`(2.8rem) 등 카드 내부 타이포가 절대값 고정이라 카드 크기와 무관.
- **구현방법**:
  - **`variables.css`** — `--mobile-max-width` 기본값을 `100%` 로 바꾸고 px 상한은 `@media (min-width: 600px)` 안으로 이동. 한 곳 수정으로 위 7개 소비처가 동시에 해결된다(현행 아이폰은 전부 600px 미만). 카드 메트릭 폴백 토큰 `--card-scale: 1` / `--card-w` / `--card-h` 추가 — `.history-card-front` 는 카드덱 밖(관리자 프리뷰, 캡처 클론)에서도 렌더되므로 `calc()` 가 무효화되지 않도록.
  - **`base.css`** — body 기본 배경을 `--color-bg-primary` 로(실기기 러버밴드 오버스크롤 시 회색 노출 방지), 데스크톱 배경·래퍼 그림자는 같은 미디어쿼리로 이동.
  - **`src/js/utils/cardMetrics.js`** (신규) — CSS 로는 `min(부모폭, 부모높이 × 비율)` 을 표현할 수 없고(container query 는 Safari 16+ 필요, 현 iOS 배포 타깃 15.0), AdMob 배너로 가용 높이가 런타임에 바뀌어 미디어쿼리로도 불가능하다. `adPlacement.js` 의 `--ad-banner-height` / `main.js` 의 `--safe-area-bottom` 과 동일한 "실측 후 CSS 변수 주입" 패턴 채택. ResizeObserver 로 카드 영역 content box 를 관찰해 `--card-w`/`--card-h`/`--card-scale` 을 **:root 가 아닌 해당 영역 엘리먼트에** 주입(카드덱과 캘린더 팝업 상호 간섭 방지). 재기록 임계값(0.5px / 0.005)으로 iOS WebView 의 소수점 흔들림 → write → layout 루프를 차단.
  - **`components.css`** — `.flipper` 의 `min-height:500px`·`aspect-ratio:3/5`·`min-width:280px` 제거하고 `height:100%` 로 부모에 위임(비율은 `--card-aspect-ratio` 한 곳에서만 관리). `.history-card-mini` 도 토큰으로 통일. 카드 내부 타이포/여백 8개 규칙을 `clamp(하한, calc(기존값 * var(--card-scale)), 상한)` 으로 유동화.
  - **`pages.css`** — `.card-swiper` / `.editorstory-card-area > .skeleton-card` / 캘린더 팝업 카드가 모두 `--card-w`/`--card-h` 를 쓰도록 변경. 관리자 프리뷰(`.preview-scale-wrapper .flip-container`)는 `.flipper` 가 높이를 잃었으므로 `aspect-ratio` 를 부모에 부여(덤으로 프리뷰 비율이 실물과 일치하게 됨). 팝업은 `inner{max-height:100%}` + `stage{flex:1 1 auto; min-height:0}` 로 짧은 화면에서 스테이지만 줄어들게 함.
  - **`cardDeckController.js` / `calendar.js`** — 관찰자 부착 + 해제. 라우터의 `onUnmountHook` 은 **단일 슬롯(덮어쓰기)** 이라 `setOnUnmount` 를 새로 부르지 않고 기존 콜백에 `dispose()` 를 합류시켰다. isEmpty·에러 조기 반환 경로에서도 해제.
  - **`CLAUDE.md` §6** — "캡처 직전 375×667 고정 픽셀 강제", "300ms sleep", "워터마크를 하단 우측에 주입" 서술이 현재 구현(modern-screenshot 1차 + WYSIWYG 캡처, 워터마크는 복제본 상단 액션 슬롯)과 불일치해 정정. AGENTS.md 에는 대응 섹션이 없어 동기화 불필요.
- **변경파일**: `src/css/variables.css`, `src/css/base.css`, `src/css/components.css`, `src/css/pages.css`, `src/js/utils/cardMetrics.js`(신규), `src/js/components/cardDeck/cardDeckController.js`, `src/js/pages/calendar.js`, `tests/responsive_layout.spec.js`(신규), `tests/cardMetrics.spec.js`(신규), `CLAUDE.md`, `dist/`·`android/*`·`ios/*`(빌드/sync 산출물), `SESSION_LOG.md`.
- **검증(TDD)**: 신규 spec 2개(34건)를 먼저 작성해 red 확인 후 구현. 전체 **66 파일 / 699 passed / 6 skipped / 0 failed** (베이스라인 665 + 신규 34, **회귀 0건**). `npm run build`·`npx cap sync android`·`ios` 성공. 추가로 **헤드리스 Chrome(151) 렌더 하네스**를 만들어 실제 CSS/JS 로 수정 전·후를 대조 측정(정확한 뷰포트를 위해 기기 크기 iframe 으로 에뮬레이션): 수정 전 iPhone SE 카드 **351×474(비율 0.74)** → 수정 후 **306.1×474(0.6458)**, SE+배너 0.83 → 0.6457, 16 Pro Max 는 wrapper/nav/status-bar 폭이 420 → **440(화면 전체)**. 다크 테마·글꼴 small/large·iPad·데스크톱 1440(래퍼 420px 유지 = 기존 동작 보존)까지 전부 통과.
- **참고(측정으로 확인되지 않은 것)**: `.flipper { min-height: 500px }` 가 작은 화면에서 카드를 잘라낼 것으로 예상했으나, Chrome 151 에서는 `max-height` 가 이겨 실제 잘림은 재현되지 않았다(WebKit 거동은 이 환경에서 확인 불가). 제거는 잠재 위험 제거 목적이며, 실제로 관측된 결함은 **비율 붕괴**다. 캘린더 팝업 넘침도 세로 아이폰에서는 재현되지 않았고(카드 폭이 뷰포트로 먼저 제한됨), 400×520 같은 **세로가 짧은 화면**에서만 재현·수정 확인됐다.
- **남은 작업**: 실기기(iOS 시뮬레이터 SE / 16 Pro Max) 육안 확인, 카드 공유 캡처 결과를 두 기기에서 실측(WYSIWYG 캡처라 화면 레이아웃이 그대로 이미지가 됨).

### 2026-08-26 16:27 — Claude (Opus 5) · v1.6.0 버전 업 + 스토어 릴리스 빌드 준비 (실 광고 전환 포함)

- **요구사항**: 버전을 1.6.0으로 올리고 빌드 출시 준비.
- **점검 결과**: pending harness phase 없음(001/002 모두 완료) → 일반 작업으로 진행. 버전 문자열은 `package.json`·`android/app/build.gradle`·`ios/.../project.pbxproj`(Debug/Release 2곳)에만 존재하며, 앱 내 표시 버전은 네이티브에서 런타임 조회하므로 JS 하드코딩 없음(`src/js/utils/version.js`는 비교 유틸일 뿐). 릴리스 점검 중 **`src/js/services/ads.js`의 `USE_TEST_ADS`가 `true`로 남아 있어** 스토어 빌드가 Google 테스트 광고만 노출할 상태였음(실 광고 단위 ID와 네이티브 앱 ID는 이미 채워져 있었음). 사용자 결정: 실 광고로 전환.
- **구현방법**:
  - **버전 업** — `package.json` 1.5.2 → 1.6.0, `package-lock.json` 상단 2곳 동기화, `android/app/build.gradle` versionName 1.5.2 → 1.6.0 / versionCode 27 → 28, `project.pbxproj` MARKETING_VERSION 2곳 1.5.2 → 1.6.0. `CURRENT_PROJECT_VERSION`은 관례대로 1 유지(마케팅 버전이 올라가므로 빌드 번호 리셋 가능; 동일 버전 재업로드 시에만 증가 필요).
  - **실 광고 전환** — `ads.js`의 `USE_TEST_ADS = true` → `false`. 이 시점부터 `LIVE_AD_UNITS`(Android 배너 `…/1749232294`·전면 `…/6618415596`, iOS 배너 `…/2399968981`·전면 `…/4413984739`)가 실제 광고를 받아온다.
  - **테스트 수정** — `tests/ads.spec.js`가 `isTesting: true`를 **하드코딩**하고 있어 플래그를 내리자 2건 실패. 단언을 `ads.USE_TEST_ADS` 참조로 바꿔 플래그 값과 무관하게 "모듈 상수가 SDK로 그대로 전달되는지"를 검증하도록 정정(테스트 의도 보존, 향후 플래그 토글 시 재발 방지). 배너 테스트 제목의 "테스트 모드에서"도 실제 검증 내용에 맞게 수정.
  - **빌드/동기화** — `npm run build` → `npx cap sync android` → `npx cap sync ios`. 광고 플래그 변경 후 재빌드·재sync까지 완료.
- **변경파일**: `package.json`, `package-lock.json`, `android/app/build.gradle`, `ios/App/App.xcodeproj/project.pbxproj`, `src/js/services/ads.js`, `tests/ads.spec.js`, `dist/`·`android/app/src/main/assets/*`·`ios/App/App/public/*`(빌드/sync 산출물), `SESSION_LOG.md`.
- **검증**: 버전 업 전 베이스라인 **66 파일 / 699 passed / 6 skipped**. 광고 플래그 전환 직후 2 failed → spec 정정 후 다시 **699 passed / 0 failed**. `npm run build` 성공, `cap sync` android/ios 모두 plugin 11개 인식하며 성공. 최종 산출물 `dist/assets/index-*.js`에 실 광고 퍼블리셔 ID(`ca-app-pub-3250744272484684`)가 포함된 것을 grep으로 확인. Android/iOS `public/index.html` 동일 크기(16898B)로 sync 확인.
- **남은 작업(수동)**: ① Android Studio에서 릴리스 AAB 빌드·서명 후 Play Console 업로드(versionCode 28). ② Xcode에서 Archive → App Store Connect 업로드(1.6.0). ③ 출시 승인 후 Firebase Remote Config `latest_version`을 `1.6.0`으로 갱신(미갱신 시 구버전 사용자에게 업데이트 시트가 뜨지 않음). ④ **실 광고 전환 상태이므로 본인/테스터 기기에서 광고를 반복 클릭하지 말 것**(무효 트래픽 정책 위반 시 계정 정지 위험). 개발 중 광고를 다시 테스트하려면 `USE_TEST_ADS`를 임시로 `true`로 되돌린다.

### 2026-08-26 18:52 — Claude (Opus 5) · AdMob app-ads.txt 배포 + 공유 링크 죽은 도메인 회귀 수정

- **요구사항**: AdMob 콘솔에 Android/iOS 앱이 "광고 게재가 제한됨 — Verify app to lift limit" 상태. app-ads.txt 누락으로 판단되어 상황 파악 및 조치.
- **원인 분석**: ① 리포 어디에도 `app-ads.txt`가 없었음(확인). ② 더 중요한 문제 — 스토어 리스팅의 웹사이트 URL이 Play는 **미입력**, App Store는 **스레드 SNS 링크**(`threads.com`, 제어 불가 도메인)여서 어떤 파일을 올려도 검증 불가 구조였음. 사용자가 두 스토어를 `https://daystory.app`으로 수정한 뒤 배포·검증했으나 **404** — `daystory.app`은 DNS가 **Vercel**(216.198.79.1 / 64.29.17.65)을 가리키는데 배포가 없는 죽은 도메인(`x-vercel-error: DEPLOYMENT_NOT_FOUND`)이었고, Firebase Hosting에는 커스텀 도메인이 연결돼 있지 않았음(`firebase hosting:sites:list` → 기본 `.web.app`만 존재).
- **연쇄 발견(별개 운영 버그)**: 도메인 추적 중 `sharing.js`가 `deepLink.js`와 **별도로 도메인을 하드코딩**(`const SHARE_DOMAIN = 'https://daystory.app'`)한 것을 발견. `deepLink.js`(`SHARE_APP_DOMAIN`)와 `functions/lib/og.js`(`ORIGIN`)는 `dokhu-daystory.web.app`로 올바른데 `buildShareUrl()`만 죽은 도메인을 생성 → **사용자가 공유한 카드 링크가 운영에서 전부 404**, OG 미리보기도 미동작. 더 나쁜 것은 `tests/sharing_kakao.spec.js`가 그 깨진 주소를 정답으로 단언해 **버그를 테스트로 고정**시키고 있었음.
- **사용자 결정**: 도메인 정책은 `dokhu-daystory.web.app`으로 통일(DNS 작업 없이 즉시 복구). `daystory.app` Firebase 연결은 보류.
- **구현방법**:
  - **`public/app-ads.txt`**(신규) — IAB 형식 `google.com, pub-3250744272484684, DIRECT, f08c47fec0942fa0`. 게시자 번호는 AndroidManifest/Info.plist의 앱 ID와 동일. `vite.config` 부재로 Vite 기본 `publicDir`가 적용되어 `public/` → `dist/` 루트로 복사됨(기존 `.well-known/*` 배포와 동일 경로).
  - **`src/js/services/sharing.js`** — 문자열만 교체하지 않고 **단일 출처로 통합**. `SHARE_DOMAIN` 상수를 제거하고 `deepLink.js`의 `SHARE_APP_ORIGIN`을 import(이미 같은 파일에서 `buildShareDeepLink`를 import 중이었음). `deepLink.js` 주석의 "도메인 변경 시 이 한 곳만 수정"이 실제로 참이 되도록 함.
  - **`tests/sharing_kakao.spec.js`** — 리터럴 단언 `toMatch(/daystory\.app\/share\/story-1/)`를 `toBe(\`${SHARE_APP_ORIGIN}/share/story-1\`)`로 변경. 도메인이 바뀌어도 단언이 자동으로 따라가 같은 회귀를 다시 고정시키지 않게 함.
  - **`tests/sharing_share_no_text.spec.js`** — 입력 픽스처의 죽은 도메인 문자열 정리(단언 아님, 오해 방지 목적).
- **변경파일**: `public/app-ads.txt`(신규), `tests/share_domain_consistency.spec.js`(신규), `src/js/services/sharing.js`, `tests/sharing_kakao.spec.js`, `tests/sharing_share_no_text.spec.js`, `dist/`·`android/app/src/main/assets/public/*`·`ios/App/App/public/*`(빌드/sync 산출물), `SESSION_LOG.md`.
- **검증(TDD)**: `tests/share_domain_consistency.spec.js`(7건)를 먼저 작성해 red 확인(4 failed / 3 passed) 후 구현. 작성 중 **테스트 자체의 오류 2건**을 red 단계에서 잡음 — ⓐ `@vitest-environment node`로는 `sharing.js`가 `state.js` 경유로 `document`를 요구해 터짐 → `jsdom`으로 변경, ⓑ `\bdaystory\.app\b` 정규식이 정상 Android 패키지명 `com.daystory.app`(`functions/lib/og.js`의 `ANDROID_PACKAGE`/`PLAY_STORE`)을 오탐 → URL 호스트 형태 `https?://(www\.)?daystory\.app`만 잡도록 정밀화. 최종 **67 파일 / 706 passed / 6 skipped / 0 failed**(베이스라인 699 + 신규 7, **회귀 0건**). `npm run build` 성공, `npx cap sync android`·`ios` 성공, 번들·네이티브 자산 모두에서 죽은 도메인 소거 확인(grep). `firebase deploy --only hosting` 후 운영 검증: `app-ads.txt` 200(`text/plain`), `/share?date=…` 200, `.well-known/assetlinks.json`·`apple-app-site-association` 200.
- **배포 안전성 확인**: 배포 전 `ldj-SUB`와 `main`이 양방향 diff 0(완전 동일, HEAD `cbfa62b 1.6.0 Release`)임을 확인 — hosting 전체 배포지만 운영에 반영되는 실질 변경은 app-ads.txt 추가와 공유 도메인 수정뿐임을 보장.
- **남은 작업(수동)**: ① **스토어 리스팅 URL을 `https://dokhu-daystory.web.app`으로 재수정**(현재 `https://daystory.app`로 되어 있어 404 — Play 웹사이트 필드, App Store 마케팅 URL 둘 다). ② 그 후 AdMob 콘솔에서 "Verify app" 클릭(재크롤링에 수 시간~수일 소요). ③ **공유 링크 수정은 웹 배포만으로는 기존 설치 사용자에게 적용되지 않음** — 네이티브 앱에 JS가 번들되므로 다음 스토어 릴리스(버전 업 + AAB/Archive 업로드)가 나가야 실제 사용자 공유 링크가 복구된다. ④ `cors.json`의 `https://daystory.app` 항목은 무해해 유지했으나, 도메인을 영구 폐기하면 함께 정리. ⑤ `daystory.app`을 살릴 경우 DNS를 Vercel → Firebase Hosting으로 옮기고 `deepLink.js`의 `SHARE_APP_DOMAIN` 한 곳만 수정하면 전체가 따라옴(단일 출처화 완료).
