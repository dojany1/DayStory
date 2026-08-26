/* =====================================================================
   adPlacement.js — 광고 배치 · 빈도 정책
   =====================================================================
   ads.js 가 "AdMob SDK 를 어떻게 부르는가"를 담당한다면,
   이 파일은 "언제 · 어디에 띄우는가"를 담당한다. 정책이 한 곳에 모여 있어야
   나중에 강도를 조절할 때 여기 상수만 만지면 된다.

   ── 배너 정책 ──────────────────────────────────────────────
   AdMob 배너는 DOM 요소가 아니라 WebView 위에 얹히는 네이티브 뷰다.
   위치는 화면 기준 TOP/CENTER/BOTTOM_CENTER + margin 뿐이고, 페이지와 함께
   스크롤되지 않는다. 그래서 "특정 DOM 요소 아래"에는 붙일 수 없고,
   하단 내비게이션 바로 위에 고정하는 방식만 안전하다.

     - /profile, /editorstory, /mystory 에서만 노출
     - editorstory/mystory 는 캘린더 뷰일 때만
       (카드 뷰는 375×667 히어로 콘텐츠이자 공유 캡처 대상이라 가리면 안 된다)
     - 배너가 콘텐츠를 덮지 않도록 실제 렌더링 높이만큼 레이아웃 하단 여백을 예약

   ── 전면 광고 정책 ─────────────────────────────────────────
   "N장마다"처럼 핵심 상호작용(카드 플립) 중간을 끊는 방식은 쓰지 않는다.
   플립은 콘텐츠 소비 중간이지 전환 지점이 아니고, 이 앱은 iOS WKWebView
   GPU 프로세스 종료 이력이 있어 3D 플립 위에 풀스크린 광고를 얹는 것이 위험하다.

     - 앱 시작 후 STARTUP_GRACE_MS 유예 (콜드 스타트 직후 노출 금지)
     - 노출 간 COOLDOWN_MS 쿨다운
     - 세션당 SESSION_MAX 회 상한
     - 노출 지점은 "전환"뿐: 메인 탭 이동 / 카드 뒷면 상세보기 진입 / 일화 저장
     - 뷰 토글(카드 ↔ 캘린더)은 제외 — 같은 화면의 표시 방식 변경일 뿐이라
       화면을 떠나는 전환이 아니다
     - 첫 일화 저장은 제외 (사용자가 가장 감정적으로 투자한 순간)
   ===================================================================== */

import {
  USE_TEST_ADS,
  canShowAds,
  hideAdBanner,
  isInterstitialReady,
  onBannerSizeChanged,
  removeAdBanner,
  resumeAdBanner,
  showAdBanner,
  showAdInterstitial,
} from './ads.js';

/* =====================================================================
   ▼▼▼ 정책 상수 — 광고 강도는 여기서만 조절한다 ▼▼▼
   ===================================================================== */

/** 앱 시작 후 이 시간이 지나야 첫 전면 광고가 가능하다 */
const STARTUP_GRACE_MS = 60 * 1000;          /* 60초 */

/** 전면 광고 노출 간 최소 간격 */
const COOLDOWN_MS = 2 * 60 * 1000;           /* 2분 */

/** 한 세션(앱 실행)에서 띄울 수 있는 전면 광고 최대 횟수 */
const SESSION_MAX = 3;

/**
 * 배너를 "켜는" 요청은 화면이 이만큼 안정된 뒤에야 실제로 보낸다.
 *
 * AdMob 배너는 요청 즉시 뜨지 않는다. iOS 플러그인은 광고 로드가 끝난 뒤
 * (bannerViewDidReceiveAd) 비로소 배너를 뷰 계층에 붙이고, removeBanner 는
 * "이미 붙은" 배너만 찾아 지운다. 그래서 배너가 뜨기 직전에 화면을 옮기면
 * 이전 화면에서 요청한 배너가 옮겨간 화면에 그대로 붙는다.
 * 연타 중에는 요청 자체를 보내지 않는 것이 가장 확실한 방어다.
 * (끄는 요청은 지연시키지 않는다 — 한 프레임도 남기면 안 되므로.)
 */
const BANNER_SETTLE_MS = 300;

/** 배너를 띄울 라우트. calendarOnly 는 캘린더 뷰에서만 노출한다는 뜻. */
const BANNER_ROUTES = {
  '/profile': { calendarOnly: false },
  '/editorstory': { calendarOnly: true },
  '/mystory': { calendarOnly: true },
};

/** 전면 광고를 띄울 수 있는 메인 탭 라우트 (index.html 하단 내비와 일치) */
const TAB_ROUTES = ['/editorstory', '/mystory', '/profile'];

/**
 * 배너를 가려야 하는 전체화면 오버레이들 (모두 document.body 직속).
 * 네이티브 배너는 WebView "위"에 얹히는 별도 뷰라 CSS z-index 로는 절대 덮을 수 없다.
 * 오버레이가 열려 있는 동안에는 배너를 네이티브 레벨에서 숨기는 수밖에 없다.
 */
const OVERLAY_SELECTORS = [
  '.calendar-card-popup',            /* 캘린더 날짜 카드 팝업 */
  '.confirm-dialog-overlay',         /* confirmDialog / shareChoiceSheet */
  '.modal-overlay',                  /* inquiry / intro / 알림 상세 시트 */
  '.notification-settings-overlay',  /* 알림 센터 */
  '.crop-modal-overlay',             /* 이미지 크롭 */
].join(', ');

/* =====================================================================
   ▲▲▲ 정책 상수 끝 ▲▲▲
   ===================================================================== */

const BYPASS_KEY = 'ds_ads_bypass';          /* 기기 테스트용 정책 우회 플래그 */
const FIRST_SAVE_KEY = 'ds_ads_first_save_done';

/** nav 높이를 못 읽었을 때 쓰는 기본값 (variables.css --nav-height 와 동일) */
const NAV_HEIGHT_FALLBACK = 50;

/* ─── 모듈 상태 ────────────────────────────────────────────────── */

const startedAt = Date.now();
let interstitialShown = 0;
let lastShownAt = 0;
let bannerVisible = false;
let bannerRoute = null;      /* 현재 배너를 띄운 근거 라우트 (중복 요청 방지) */
let sizeHandle = null;
let boundOffs = [];          /* 등록한 리스너 해제 함수들 (중복 등록/누수 방지) */
let bannerSuspended = false; /* 오버레이 때문에 배너를 임시로 내린 상태 */
let lastBannerHeight = 0;    /* 오버레이 복귀 시 되돌릴 배너 높이 */
let overlayObserver = null;
let bannerChain = Promise.resolve();  /* 배너 네이티브 조작 직렬화 큐 */
let bannerSeq = 0;                    /* 최신 배너 요청 번호 (중간 요청 폐기용) */
let settleTimer = null;               /* 배너 켜기 안정화 대기 타이머 */

/** 대기 중인 안정화 타이머를 취소한다 (기다리던 호출은 그냥 깨운다) */
function clearSettle() {
  if (!settleTimer) return;
  clearTimeout(settleTimer.id);
  settleTimer.wake();
  settleTimer = null;
}

/** 화면이 BANNER_SETTLE_MS 동안 조용하기를 기다린다 */
function settle() {
  return new Promise((wake) => {
    const id = setTimeout(() => { settleTimer = null; wake(); }, BANNER_SETTLE_MS);
    settleTimer = { id, wake };
  });
}

/**
 * 배너 네이티브 조작을 한 줄로 세운다.
 *
 * showBanner / removeBanner / hideBanner 는 모두 비동기 브리지 호출이다.
 * 보기 방식 버튼 연타나 내비 탭 연타로 요청이 겹치면 "늦게 낸 remove 가 먼저
 * 끝나고 먼저 낸 show 가 뒤늦게 적용" 되는 역전이 생겨, 카드 뷰에 배너가
 * 남는다(기기 테스트에서 재현). 큐를 통과시키면 이 역전이 원천적으로 없어진다.
 */
function queueBannerOp(task) {
  const run = bannerChain.then(task, task);
  bannerChain = run.then(() => {}, () => {});
  return run;
}

/* ─── 저장소 헬퍼 (jsdom/사파리 프라이빗 모드에서 throw 할 수 있다) ── */

function readFlag(key) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key, on) {
  try {
    if (on) localStorage.setItem(key, '1');
    else localStorage.removeItem(key);
  } catch { /* 무시 */ }
}

/** cardDeckController 와 동일한 저장소에서 현재 뷰(card|calendar)를 읽는다 */
function currentView() {
  try {
    return sessionStorage.getItem('ds_session_view')
      ?? (localStorage.getItem('ds_default_view') || 'card');
  } catch {
    return 'card';
  }
}

/* ─── 배너 ─────────────────────────────────────────────────────── */

/** 하단 내비 높이(dp/pt). 배너가 nav 를 덮지 않도록 margin 으로 쓴다. */
function navHeightPx() {
  try {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue('--nav-height')
      .trim();
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : NAV_HEIGHT_FALLBACK;
  } catch {
    return NAV_HEIGHT_FALLBACK;
  }
}

/**
 * 배너의 실제 렌더링 높이를 레이아웃에 반영한다.
 * 적응형 배너는 기기마다 높이가 달라서 하드코딩할 수 없다.
 * `.app-container` 의 padding-bottom 계산식에 --ad-banner-height 가 더해진다.
 */
function applyBannerHeight(height) {
  const px = Number.isFinite(height) && height > 0 ? Math.round(height) : 0;

  /* 오버레이가 떠 있는 동안에는 무시한다. hideBanner 가 쏘는 {0,0} 이벤트를
     그대로 반영하면 오버레이 뒤에서 레이아웃이 접혔다가 닫는 순간 다시 펴지며 튄다. */
  if (bannerSuspended) return;

  lastBannerHeight = px;
  try {
    document.documentElement.style.setProperty('--ad-banner-height', `${px}px`);
    document.getElementById('app-container')?.classList.toggle('has-ad-banner', px > 0);
  } catch { /* 무시 */ }
}

/**
 * 배너 크기 변화 콜백 — 광고가 "지금 화면에 붙었다" 는 유일한 신호다.
 *
 * iOS 플러그인은 광고 로드가 끝난 뒤에야 배너를 뷰 계층에 추가한다. 로드 중에
 * 화면을 옮겼다면 이 배너는 엉뚱한 화면에 붙은 것이므로, 이 시점에 다시
 * 판정해서 즉시 되돌린다. 이때는 배너가 실제로 뷰에 있으므로 제거가 먹는다.
 */
function handleBannerSize(size) {
  const px = Number(size?.height) > 0 ? Math.round(size.height) : 0;

  if (px > 0) {
    if (bannerSuspended) {
      /* 오버레이 위로 배너가 붙어버린 경우 — 다시 숨긴다 */
      void queueBannerOp(() => hideAdBanner());
      return;
    }
    if (!bannerWanted(currentPath())) {
      void queueBannerOp(() => applyBannerOff());
      return;
    }
  }

  applyBannerHeight(px);
}

/** 현재 라우트 경로 (해시에서 쿼리 제거) */
function currentPath() {
  return (window.location.hash.slice(1) || '/editorstory').split('?')[0];
}

/** 전체화면 오버레이가 하나라도 열려 있는가 */
function isOverlayOpen() {
  try {
    return !!document.querySelector(OVERLAY_SELECTORS);
  } catch {
    return false;
  }
}

/**
 * 오버레이 열림/닫힘에 맞춰 배너를 내리고 올린다.
 * 열림: 네이티브 배너를 hide (제거가 아니라 숨김 — 광고를 다시 로드하지 않아도 된다)
 * 닫힘: 현재 라우트 기준으로 다시 동기화한 뒤 resume
 */
async function syncOverlayState() {
  const open = isOverlayOpen();
  if (open === bannerSuspended) return;

  if (open) {
    /* suspended 를 먼저 세워야 뒤이어 도착하는 {0,0} 이벤트가 무시된다 */
    bannerSuspended = true;
    bannerSeq += 1;                 /* 큐에 남아 있는 배너 요청을 무효화한다 */
    await queueBannerOp(async () => {
      if (!bannerSuspended) return; /* 그 사이 다시 닫혔으면 건드리지 않는다 */
      if (bannerVisible) await hideAdBanner();
    });
    return;
  }

  bannerSuspended = false;
  /* 오버레이가 떠 있는 동안 라우트가 바뀌었을 수 있으므로 다시 판단한다 */
  await syncBannerForRoute(currentPath());
  if (bannerVisible) {
    await queueBannerOp(() => resumeAdBanner());
    applyBannerHeight(lastBannerHeight);
  }
}

/** 라우트 → 페이지 루트 클래스 (DOM 에서 실제 뷰 상태를 확인할 때 쓴다) */
const PAGE_CLASS = {
  '/editorstory': 'editorstory-page',
  '/mystory': 'mystory-page',
};

/**
 * 해당 페이지가 지금 캘린더 뷰인지 DOM 에서 직접 확인한다.
 * ds_session_view 는 editorstory/mystory 가 공유하는 키라 실제 화면과 어긋날 수
 * 있으므로, 페이지가 이미 마운트돼 있으면 DOM 을 우선 신뢰한다.
 * @returns {boolean|null} 판단 불가(미마운트)면 null
 */
function calendarVisibleInDom(path) {
  const cls = PAGE_CLASS[path];
  if (!cls) return null;
  try {
    const el = document.querySelector(`.${cls} .page-calendar-view`);
    return el ? !el.hidden : null;
  } catch {
    return null;
  }
}

/** 이 라우트/뷰 조합에서 배너를 띄워야 하는가 */
function shouldShowBanner(path) {
  const rule = BANNER_ROUTES[path];
  if (!rule) return false;
  if (!rule.calendarOnly) return true;

  /* DOM 이 답을 알면 그것을 쓰고, 아직 마운트 전이면 저장소로 판단한다
     (setBeforeNavigate 는 새 페이지가 붙기 전에 호출된다). */
  const fromDom = calendarVisibleInDom(path);
  if (fromDom !== null) return fromDom;
  return currentView() === 'calendar';
}

/**
 * 라우트(또는 뷰) 변화에 맞춰 배너를 켜고 끈다.
 * 배너 인스턴스는 앱 전체에 1개뿐이라 라우트마다 show/remove 로 전환한다.
 * @param {string} path 목적지 경로
 */
export async function syncBannerForRoute(path) {
  /* 오버레이가 떠 있는 동안에는 건드리지 않는다.
     오버레이가 닫힐 때 syncOverlayState() 가 현재 라우트로 다시 동기화한다. */
  if (bannerSuspended) return false;

  const seq = ++bannerSeq;
  const run = () => queueBannerOp(async () => {
    /* 줄 서 있는 사이 더 최신 요청이 들어왔으면 이 요청은 버린다.
       연타 중간 상태를 그대로 실행하면 배너가 껐다 켜지며 깜빡인다. */
    if (seq !== bannerSeq) return bannerVisible;
    if (bannerSuspended) return false;
    return bannerWanted(path) ? applyBannerOn(path) : applyBannerOff();
  });

  /* 끄기 · 이미 떠 있는 배너의 라우트 갱신은 지연 없이 즉시 처리한다.
     끄기를 지연시키면 이전 화면의 배너가 새 화면에 그대로 남는다. */
  if (!bannerWanted(path) || bannerVisible) {
    clearSettle();
    return run();
  }

  /* 켜기는 화면이 안정된 뒤에만 — BANNER_SETTLE_MS 주석 참조 */
  clearSettle();
  await settle();
  if (seq !== bannerSeq || bannerSuspended) return false;
  return run();
}

/** 지금 이 라우트/뷰에 배너를 띄워야 하는가 */
function bannerWanted(path) {
  return shouldShowBanner(path) && canShowAds();
}

/** 배너를 내린다. 반드시 queueBannerOp() 안에서만 호출한다. */
async function applyBannerOff() {
  /* bannerVisible 이 실제 네이티브 상태와 어긋나도(로드 중 제거 등) 배너가
     영구히 남지 않도록, 조건 없이 정리를 요청한다. 배너가 실제로 없으면
     ads.js 가 자체 플래그로 판단해 no-op 으로 흘린다. */
  bannerVisible = false;
  bannerRoute = null;
  applyBannerHeight(0);
  await removeAdBanner();
  return false;
}

/** 배너를 띄운다. 반드시 queueBannerOp() 안에서만 호출한다. */
async function applyBannerOn(path) {
  bannerRoute = path;

  /* 배너 인스턴스는 앱 전체에 1개뿐이고 위치(BOTTOM_CENTER + nav 높이)도
     라우트와 무관하게 같다. 이미 떠 있으면 다시 요청할 이유가 없다.
     (안드로이드 플러그인은 배너가 있는 상태에서 showBanner 를 부르면
     PluginCall 을 resolve 하지 않아 JS 프로미스가 영영 끝나지 않는다.) */
  if (bannerVisible) return true;

  bannerVisible = true;
  return showAdBanner({
    position: 'BOTTOM_CENTER',
    margin: navHeightPx(),
  });
}

/** 배너를 잠시 숨긴다 (모달/캡처 등에서 필요할 때) */
export async function suspendBanner() {
  if (!bannerVisible) return false;
  applyBannerHeight(0);
  return hideAdBanner();
}

/* ─── 전면 광고 ────────────────────────────────────────────────── */

/** 기기 테스트용: 유예/쿨다운/세션 상한을 모두 무시한다 */
export function setAdsDebugBypass(on) {
  writeFlag(BYPASS_KEY, !!on);
}

/**
 * 지금 전면 광고를 띄워도 되는지 판단한다.
 * @returns {null|string} 통과하면 null, 막히면 사유 문자열
 */
function gateBlockReason() {
  if (readFlag(BYPASS_KEY)) return null;

  const now = Date.now();
  const sinceStart = now - startedAt;
  if (sinceStart < STARTUP_GRACE_MS) {
    return `앱 시작 유예 (${Math.ceil((STARTUP_GRACE_MS - sinceStart) / 1000)}초 남음)`;
  }
  if (interstitialShown >= SESSION_MAX) {
    return `세션 상한 도달 (${interstitialShown}/${SESSION_MAX})`;
  }
  if (lastShownAt && now - lastShownAt < COOLDOWN_MS) {
    return `쿨다운 중 (${Math.ceil((COOLDOWN_MS - (now - lastShownAt)) / 1000)}초 남음)`;
  }
  return null;
}

/* 테스트 광고 모드에서만 정책 판정을 콘솔에 남긴다.
   실 광고로 전환(USE_TEST_ADS=false)하면 자동으로 조용해진다. */
function debugLog(...args) {
  if (USE_TEST_ADS) console.info('[ads]', ...args);
}

/**
 * 정책을 통과하면 전면 광고를 띄운다.
 * 실제로 노출되지 않았다면(no fill, 미로드 등) 쿨다운/카운트를 소모하지 않는다.
 *
 * @param {string} reason 노출 지점 식별자 (디버그/로그용)
 * @returns {Promise<boolean>} 실제 노출 여부
 */
export async function maybeShowInterstitial(reason = 'unknown') {
  if (!canShowAds()) {
    debugLog(`전면 건너뜀 [${reason}] — 광고 불가 (미초기화/동의 미획득/웹)`);
    return false;
  }

  const blocked = gateBlockReason();
  if (blocked) {
    debugLog(`전면 건너뜀 [${reason}] — ${blocked}`);
    return false;
  }

  /* onlyIfReady: 로드를 기다리지 않는다. 저장 직후처럼 화면 전환이 바로
     이어지는 지점에서 앱이 멈춘 것처럼 보이는 것을 막는다. */
  const shown = await showAdInterstitial({ onlyIfReady: true });
  if (!shown) {
    debugLog(`전면 건너뜀 [${reason}] — 아직 로드 안 됨(onlyIfReady)`);
    return false;
  }

  interstitialShown += 1;
  lastShownAt = Date.now();
  debugLog(`전면 노출 [${reason}] — ${interstitialShown}/${SESSION_MAX}`);
  return true;
}

/**
 * 메인 탭 이동 알림. 탭 라우트일 때만 전환 지점으로 취급한다.
 * @param {string} path 목적지 경로
 */
export async function notifyRouteChanged(path) {
  if (!TAB_ROUTES.includes(path)) return false;
  return maybeShowInterstitial('tab');
}

/**
 * 카드 뒷면 "상세 보기" 진입 알림.
 * 카드덱을 떠나 상세 화면으로 넘어가는 지점이라 콘텐츠 소비를 끊지 않는다.
 * 정책(시작 유예·쿨다운·세션 상한) 판단은 maybeShowInterstitial 이 맡는다.
 */
export async function notifyDetailOpened() {
  return maybeShowInterstitial('detail');
}

/**
 * 나의 일화 저장 완료 알림.
 * 첫 저장은 건너뛴다 — 사용자가 가장 감정적으로 투자한 순간이고,
 * 하루 1회 수준이라 수익 기여 대비 이탈 위험이 크다.
 */
export async function notifyStorySaved() {
  if (!readFlag(FIRST_SAVE_KEY)) {
    writeFlag(FIRST_SAVE_KEY, true);
    return false;
  }
  return maybeShowInterstitial('save');
}

/* ─── 초기화 ───────────────────────────────────────────────────── */

/** 리스너를 등록하면서 해제 함수를 같이 보관한다 */
function bind(target, type, fn) {
  target.addEventListener(type, fn);
  boundOffs.push(() => target.removeEventListener(type, fn));
}

/**
 * 등록한 리스너/구독을 모두 해제한다.
 * initAdPlacement() 가 재호출될 때 자동으로 먼저 실행된다.
 */
export function destroyAdPlacement() {
  boundOffs.forEach((off) => { try { off(); } catch { /* 무시 */ } });
  boundOffs = [];
  clearSettle();
  if (overlayObserver) {
    try { overlayObserver.disconnect(); } catch { /* 무시 */ }
    overlayObserver = null;
  }
  bannerSuspended = false;
  if (sizeHandle) {
    try { void sizeHandle.remove(); } catch { /* 무시 */ }
    sizeHandle = null;
  }
  try { delete window.__dsAds; } catch { /* 무시 */ }
}

/** 현재 정책 상태 덤프 (기기에서 눈으로 확인하기 위한 용도) */
export function getAdsPlacementState() {
  const now = Date.now();
  return {
    interstitialShown,
    sessionMax: SESSION_MAX,
    cooldownRemainingMs: lastShownAt ? Math.max(0, COOLDOWN_MS - (now - lastShownAt)) : 0,
    startupRemainingMs: Math.max(0, STARTUP_GRACE_MS - (now - startedAt)),
    bypass: readFlag(BYPASS_KEY),
    firstSaveDone: readFlag(FIRST_SAVE_KEY),
    bannerVisible,
    bannerRoute,
    interstitialLoaded: isInterstitialReady(),
    view: currentView(),
  };
}

/** 세션 카운터 초기화 (테스트 중 반복 확인용) */
export function resetAdsPlacementSession() {
  interstitialShown = 0;
  lastShownAt = 0;
  writeFlag(FIRST_SAVE_KEY, false);
}

/**
 * 앱 부팅 시 1회 호출.
 * 배너 높이 구독 + 뷰 전환 트리거 등록 + 기기 테스트용 디버그 핸들 노출.
 */
export async function initAdPlacement() {
  /* 멱등: 재호출해도 리스너가 겹쳐 광고가 배수로 뜨지 않게 먼저 정리한다. */
  destroyAdPlacement();

  /* ── 아래 등록들은 반드시 await 앞에 둔다 ──────────────────────────
     이전엔 onBannerSizeChanged() 를 await 한 뒤에 리스너를 걸었는데,
     SDK 구독이 지연되면 리스너가 아예 등록되지 않아 카드 뷰로 되돌려도
     배너가 남아 있었다(기기 테스트에서 발견). 구독은 마지막에 한다. */

  /* 카드 ↔ 캘린더 뷰 전환 — 배너 노출 조건(캘린더 뷰에서만)이 바뀌므로 동기화한다.
     전면 광고 트리거는 아니다. 뷰 토글은 같은 화면 안에서 표시 방식만 바꾸는
     것이라 화면을 떠나는 전환이 아니고, 카드 플립(ds:card-flipped)과 마찬가지로
     콘텐츠 소비 중간을 끊게 된다. */
  bind(document, 'ds:view-changed', () => {
    void syncBannerForRoute(currentPath());
  });

  /* 전체화면 오버레이 감시 — 모두 document.body 직속으로 append/remove 된다.
     클래스 토글(.open)만으로 여닫는 경우까지 잡으려면 attributes 도 봐야 한다. */
  if (typeof MutationObserver === 'function') {
    overlayObserver = new MutationObserver(() => { void syncOverlayState(); });
    overlayObserver.observe(document.body, {
      childList: true,
      subtree: false,
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  /* 기기에서 직접 확인하기 위한 디버그 핸들 (Safari/Chrome 원격 인스펙터) */
  window.__dsAds = {
    state: () => getAdsPlacementState(),
    bypass: (on = true) => { setAdsDebugBypass(on); return getAdsPlacementState(); },
    banner: (show = true) => (show
      ? showAdBanner({ position: 'BOTTOM_CENTER', margin: navHeightPx() })
      : syncBannerForRoute('__off__')),
    interstitial: () => showAdInterstitial({ onlyIfReady: false }),
    reset: () => { resetAdsPlacementSession(); return getAdsPlacementState(); },
  };

  /* 배너 실제 높이 → 레이아웃 예약. 위 등록들이 끝난 뒤 마지막에 구독한다
     (이 await 가 지연돼도 뷰 전환/오버레이 처리는 이미 살아 있다). */
  sizeHandle = await onBannerSizeChanged(handleBannerSize);
  return sizeHandle;
}
