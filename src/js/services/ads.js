/* =====================================================================
   ads.js — Google AdMob 광고 서비스 (배너 + 전면)
   =====================================================================
   아키텍처 규칙(CLAUDE.md §3): 페이지에서 AdMob SDK 를 직접 호출하지 말고
   반드시 이 서비스를 통과시킨다. 동의(UMP/ATT) 게이트·플랫폼 분기·실패
   흡수 정책이 전부 여기 모여 있다.

   설계 원칙
     - 웹(개발/백오피스)에서는 완전 no-op. 네이티브에서만 동작한다.
     - 광고는 "있으면 좋은 것"이다. 어떤 실패도 절대 throw 하지 않고
       false 를 반환한다. 광고 때문에 앱 흐름이 깨져선 안 된다.
     - 초기화는 단일 실행(single-flight). 어느 진입점에서 불러도 안전하다.

   초기화 순서 (Google 권장)
     1) UMP 동의 정보 조회 → 필요 시 동의 폼 노출  (GDPR/EEA)
     2) iOS ATT 권한 요청                          (App Store 정책)
     3) AdMob.initialize()                          (IDFA 확정 후 SDK 시작)

   제공 API
     - initAds()                    앱 부팅 시 1회
     - showAdBanner(options)        배너 노출  → boolean
     - hideAdBanner() / resumeAdBanner() / removeAdBanner()
     - onBannerSizeChanged(cb)      배너 실제 높이 구독(레이아웃 보정용)
     - showAdInterstitial()         전면 광고 노출 → boolean
     - isAdsReady() / canShowAds()
     - isPrivacyOptionsRequired() / openPrivacyOptionsForm()
     - setAdsEnabled(bool)          전역 스위치(향후 광고제거 IAP 대비)
   ===================================================================== */

import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPosition,
  BannerAdSize,
  BannerAdPluginEvents,
  InterstitialAdPluginEvents,
  MaxAdContentRating,
} from '@capacitor-community/admob';

/* =====================================================================
   ▼▼▼ 설정 블록 — 실제 광고 ID 발급 후 여기만 고치면 된다 ▼▼▼
   =====================================================================
   USE_TEST_ADS 가 true 인 동안에는 Google 공식 테스트 광고 단위만 사용한다.
   실제 ID 로 개발/테스트하면 정책 위반(무효 트래픽)으로 계정이 정지될 수 있으므로
   반드시 스토어 배포 직전에만 false 로 바꾼다.
   ===================================================================== */

/** 실 광고 단위 대신 Google 테스트 광고를 사용할지 여부 */
export const USE_TEST_ADS = false;

/** Google 공식 테스트 광고 단위 (누구나 사용 가능, 수익 없음) */
const TEST_AD_UNITS = {
  android: {
    banner: 'ca-app-pub-3940256099942544/6300978111',
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
  },
  ios: {
    banner: 'ca-app-pub-3940256099942544/2934735716',
    interstitial: 'ca-app-pub-3940256099942544/4411468910',
  },
};

/**
 * 실제 광고 단위 ID (AdMob 콘솔 발급).
 * USE_TEST_ADS = false 로 바꾸는 순간부터 이 ID 들이 실제 광고를 받아온다.
 *
 * 참고: 앱 ID(ca-app-pub-…~…) 는 여기가 아니라 네이티브 설정에 있다.
 *   - Android: android/app/src/main/AndroidManifest.xml
 *   - iOS:     ios/App/App/Info.plist (GADApplicationIdentifier)
 */
const LIVE_AD_UNITS = {
  android: {
    banner: 'ca-app-pub-3250744272484684/1749232294',        /* 베너_01 */
    interstitial: 'ca-app-pub-3250744272484684/6618415596',  /* 전면_01 */
  },
  ios: {
    banner: 'ca-app-pub-3250744272484684/2399968981',        /* iOS_베너_01 */
    interstitial: 'ca-app-pub-3250744272484684/4413984739',  /* iOS_전면_01 */
  },
};

/**
 * 테스트 광고를 강제로 받을 내 개발 기기 ID 목록.
 * 기기에서 앱을 한 번 실행하면 로그캣/Xcode 콘솔에 아래 문구와 함께 출력된다:
 *   "Use RequestConfiguration.Builder.setTestDeviceIds(Arrays.asList("ABC123"))"
 * 실 광고 ID 로 전환한 뒤에도 이 목록의 기기는 테스트 광고를 받는다.
 */
const TESTING_DEVICES = [];

/** 광고 콘텐츠 등급 상한 — 역사 일화 앱이므로 전체 이용가 수준으로 제한 */
const MAX_AD_CONTENT_RATING = MaxAdContentRating.General;

/* =====================================================================
   ▲▲▲ 설정 블록 끝 ▲▲▲
   ===================================================================== */

/* ─── 모듈 내부 상태 ───────────────────────────────────────────── */

let initPromise = null;      /* 단일 실행(single-flight) 가드 */
let ready = false;           /* AdMob.initialize() 성공 여부 */
let consentInfo = null;      /* 마지막으로 조회한 UMP 동의 정보 */
let adsEnabled = true;       /* 전역 스위치 (향후 광고제거 IAP) */
let bannerVisible = false;   /* 배너가 화면에 붙어 있는지 */
let interstitialReady = false;
let interstitialLoading = null;

/* ─── 플랫폼/설정 헬퍼 ─────────────────────────────────────────── */

function isNative() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function platformKey() {
  try {
    return Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
  } catch {
    return 'android';
  }
}

/**
 * 현재 플랫폼의 광고 단위 ID.
 * 실 광고 ID 가 아직 비어 있으면 테스트 ID 로 폴백해 빈 문자열이 SDK 로
 * 넘어가는 사고(크래시)를 막는다.
 */
function adUnitId(kind) {
  const key = platformKey();
  if (!USE_TEST_ADS) {
    const live = LIVE_AD_UNITS[key]?.[kind];
    if (live) return live;
    console.warn(`[ads] ${key}/${kind} 실 광고 단위 ID 가 비어 있어 테스트 ID 로 폴백합니다.`);
  }
  return TEST_AD_UNITS[key][kind];
}

/**
 * 비개인화 광고(npa) 요청 여부.
 * OBTAINED(동의 획득) 또는 NOT_REQUIRED(동의 불필요 지역) 가 아니면
 * 보수적으로 비개인화 광고를 요청한다.
 */
function useNonPersonalized() {
  const status = consentInfo?.status;
  if (status === AdmobConsentStatus.OBTAINED) return false;
  if (status === AdmobConsentStatus.NOT_REQUIRED) return false;
  return true;
}

/** 지금 광고를 요청해도 되는 상태인가 (네이티브 + 스위치 ON + 동의 통과) */
export function canShowAds() {
  if (!adsEnabled || !isNative() || !ready) return false;
  return consentInfo?.canRequestAds !== false;
}

/** AdMob SDK 초기화 완료 여부 */
export function isAdsReady() {
  return ready;
}

/* ─── 동의(UMP) + 추적 권한(ATT) ───────────────────────────────── */

/**
 * UMP 동의 정보를 조회하고, 동의가 필요하면 구글 동의 폼을 띄운다.
 * 실패해도 앱 부팅을 막지 않는다(광고만 비개인화로 떨어진다).
 */
async function resolveConsent() {
  try {
    consentInfo = await AdMob.requestConsentInfo({
      /* 개발 중 EEA 동의 화면을 강제로 보려면:
         debugGeography: AdmobConsentDebugGeography.EEA,
         testDeviceIdentifiers: TESTING_DEVICES, */
      tagForUnderAgeOfConsent: false,
    });

    if (
      consentInfo?.status === AdmobConsentStatus.REQUIRED &&
      consentInfo?.isConsentFormAvailable
    ) {
      consentInfo = await AdMob.showConsentForm();
    }
  } catch (err) {
    console.warn('[ads] UMP 동의 처리 실패:', err);
  }
}

/**
 * iOS 14+ 앱 추적 투명성(ATT) 권한 요청.
 * 아직 결정되지 않은 경우(notDetermined)에만 시스템 팝업을 띄운다.
 * Android/웹에서는 아무 것도 하지 않는다.
 */
async function requestTracking() {
  if (platformKey() !== 'ios') return;
  try {
    const { status } = await AdMob.trackingAuthorizationStatus();
    if (status === 'notDetermined') {
      await AdMob.requestTrackingAuthorization();
    }
  } catch (err) {
    console.warn('[ads] ATT 권한 요청 실패:', err);
  }
}

/** 사용자가 동의 설정을 다시 열 수 있어야 하는지 (설정 화면 메뉴 노출 조건) */
export function isPrivacyOptionsRequired() {
  return consentInfo?.privacyOptionsRequirementStatus === 'REQUIRED';
}

/** 설정 화면에서 "광고 개인정보 설정" 을 다시 여는 진입점 */
export async function openPrivacyOptionsForm() {
  if (!isNative() || !isPrivacyOptionsRequired()) return false;
  try {
    await AdMob.showPrivacyOptionsForm();
    return true;
  } catch (err) {
    console.warn('[ads] 개인정보 옵션 폼 표시 실패:', err);
    return false;
  }
}

/* ─── 초기화 ───────────────────────────────────────────────────── */

/**
 * AdMob 초기화. 앱 부팅 시 1회 호출하면 되고, 중복 호출은 무해하다.
 * 광고 표시 함수들도 필요 시 내부적으로 이 함수를 부른다.
 */
export function initAds() {
  if (!isNative() || !adsEnabled) return Promise.resolve();
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await resolveConsent();
    await requestTracking();

    try {
      await AdMob.initialize({
        initializeForTesting: USE_TEST_ADS,
        testingDevices: TESTING_DEVICES,
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
        maxAdContentRating: MAX_AD_CONTENT_RATING,
      });
      ready = true;
    } catch (err) {
      console.warn('[ads] AdMob 초기화 실패:', err);
      ready = false;
      return;
    }

    registerInterstitialListeners();
    /* 전면 광고는 노출 시점에 즉시 뜨도록 미리 로드해 둔다 (await 하지 않음) */
    prepareInterstitial();
  })();

  return initPromise;
}

/** 광고 표시 진입점 공통 전처리: 아직 초기화 전이면 초기화를 기다린다. */
async function ensureReady() {
  if (!isNative() || !adsEnabled) return false;
  await initAds();
  return canShowAds();
}

/* ─── 배너 ─────────────────────────────────────────────────────── */

/**
 * 배너 광고를 노출한다.
 * @param {object} [options]
 * @param {string} [options.position] BannerAdPosition (기본 BOTTOM_CENTER)
 * @param {number} [options.margin]   dp/pt 단위 여백 (하단 내비게이션 높이만큼 띄울 때 사용)
 * @param {string} [options.adSize]   BannerAdSize (기본 ADAPTIVE_BANNER)
 * @returns {Promise<boolean>} 요청 성공 여부. 실패해도 throw 하지 않는다.
 */
/** 네이티브 브리지가 응답하지 않을 때 포기하는 시간 */
const BRIDGE_TIMEOUT_MS = 5000;

/**
 * 브리지 호출이 영영 끝나지 않는 경우를 대비한 안전장치.
 * 안드로이드 플러그인은 배너가 이미 있을 때 showBanner 의 PluginCall 을
 * resolve 하지 않는다. 그대로 두면 이 프로미스를 기다리는 쪽(배너 조작 큐)이
 * 통째로 잠겨, 이후 어떤 배너 제거 요청도 실행되지 않는다.
 */
const BRIDGE_TIMED_OUT = Symbol('bridge-timeout');

function withBridgeTimeout(promise, label) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((resolve) => {
      timer = setTimeout(() => {
        console.warn(`[ads] ${label} 응답 없음 — 대기를 중단합니다`);
        resolve(BRIDGE_TIMED_OUT);
      }, BRIDGE_TIMEOUT_MS);
    }),
  ]);
}

export async function showAdBanner(options = {}) {
  if (!(await ensureReady())) return false;

  /* 브리지 호출이 "끝난 뒤"에 플래그를 세우면, 그 사이 들어온 remove/hide 가
     "배너 없음" 으로 판단돼 조용히 무시된다. 그러면 뒤늦게 완료된 show 만 남아
     카드 뷰에 배너가 잔존한다(기기 회귀). 요청하는 시점부터 세운다.
     실패해도 되돌리지 않는다 — 네이티브 뷰가 남았을 수 있어 정리 요청은
     통과시키는 편이 안전하다. */
  bannerVisible = true;

  try {
    const result = await withBridgeTimeout(AdMob.showBanner({
      adId: adUnitId('banner'),
      adSize: options.adSize || BannerAdSize.ADAPTIVE_BANNER,
      position: options.position || BannerAdPosition.BOTTOM_CENTER,
      margin: options.margin ?? 0,
      isTesting: USE_TEST_ADS,
      npa: useNonPersonalized(),
    }), '배너 표시');

    /* 응답이 없었다면 배너가 떴는지 알 수 없다. 성공이라고 보고하지 않는다
       (bannerVisible 은 이미 true 라 정리 요청은 그대로 통한다). */
    if (result === BRIDGE_TIMED_OUT) return false;
    return true;
  } catch (err) {
    console.warn('[ads] 배너 표시 실패:', err);
    return false;
  }
}

/** 배너를 숨긴다 (파괴하지 않음 — resumeAdBanner() 로 복귀 가능) */
export async function hideAdBanner() {
  if (!isNative() || !bannerVisible) return false;
  try {
    await AdMob.hideBanner();
    return true;
  } catch (err) {
    console.warn('[ads] 배너 숨김 실패:', err);
    return false;
  }
}

/** 숨긴 배너를 다시 표시한다 */
export async function resumeAdBanner() {
  if (!isNative() || !bannerVisible) return false;
  try {
    await AdMob.resumeBanner();
    return true;
  } catch (err) {
    console.warn('[ads] 배너 복귀 실패:', err);
    return false;
  }
}

/** 배너를 완전히 제거한다 */
export async function removeAdBanner() {
  if (!isNative() || !bannerVisible) return false;
  try {
    await AdMob.removeBanner();
    bannerVisible = false;
    return true;
  } catch (err) {
    console.warn('[ads] 배너 제거 실패:', err);
    return false;
  }
}

/**
 * 배너의 실제 렌더링 높이 변화를 구독한다.
 * 적응형 배너는 기기마다 높이가 달라, 콘텐츠 하단 여백을 정확히 확보하려면
 * 이 값을 CSS 변수 등으로 반영해야 한다.
 *
 * 반환된 핸들은 페이지가 떠날 때 반드시 remove() 해야 한다
 * (CLAUDE.md §3 — router.setOnUnmount 로 정리).
 *
 * @param {(size: {width:number, height:number}) => void} listener
 * @returns {Promise<{remove: () => Promise<void>}>}
 */
export async function onBannerSizeChanged(listener) {
  if (!isNative()) return { remove: async () => {} };

  /* height > 0 은 "배너 뷰가 지금 화면에 붙어 있다" 는 가장 확실한 신호다.
     iOS 는 광고 로드가 끝난 뒤에야 배너를 뷰 계층에 추가하므로, 로드 중에
     보낸 remove 는 아무 효과가 없고 내부 플래그만 false 로 남는다. 그 상태로
     두면 뒤늦게 붙은 배너를 다시 제거할 방법이 없어진다.
     반대로 height 0 으로는 false 를 세우지 않는다 — hideBanner 도 {0,0} 을
     쏘는데, 그때 배너 뷰 자체는 살아 있어 resume/remove 가 필요하다. */
  const sync = (size) => {
    if (Number(size?.height) > 0) bannerVisible = true;
    listener(size);
  };

  try {
    return await AdMob.addListener(BannerAdPluginEvents.SizeChanged, sync);
  } catch (err) {
    console.warn('[ads] 배너 크기 리스너 등록 실패:', err);
    return { remove: async () => {} };
  }
}

/* ─── 전면 광고 ────────────────────────────────────────────────── */

/** 전면 광고를 백그라운드에서 미리 로드한다 (중복 로드 방지) */
function prepareInterstitial() {
  if (!canShowAds() || interstitialReady || interstitialLoading) return interstitialLoading;

  interstitialLoading = AdMob.prepareInterstitial({
    adId: adUnitId('interstitial'),
    isTesting: USE_TEST_ADS,
    npa: useNonPersonalized(),
  })
    .then(() => { interstitialReady = true; })
    .catch((err) => {
      console.warn('[ads] 전면 광고 사전 로드 실패:', err);
      interstitialReady = false;
    })
    .finally(() => { interstitialLoading = null; });

  return interstitialLoading;
}

/** 전면 광고가 닫히거나 실패하면 다음 노출을 위해 다시 채워 넣는다 */
function registerInterstitialListeners() {
  /* 직전 로드가 아직 진행 중이면 그것을 기다린 뒤 새로 채운다.
     기다리지 않고 바로 prepare 를 부르면 "이미 로딩 중" 가드에 걸려
     재준비가 통째로 유실되고, 다음 노출 시점에 광고가 비어 있게 된다. */
  const refill = async () => {
    interstitialReady = false;
    if (interstitialLoading) {
      await interstitialLoading;
      interstitialReady = false;
    }
    await prepareInterstitial();
  };

  AdMob.addListener(InterstitialAdPluginEvents.Dismissed, refill).catch(() => {});
  AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, refill).catch(() => {});
  AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, (err) => {
    console.warn('[ads] 전면 광고 로드 실패:', err);
    interstitialReady = false;
  }).catch(() => {});
}

/** 전면 광고가 지금 즉시 노출 가능한 상태인지 (사전 로드 완료 여부) */
export function isInterstitialReady() {
  return interstitialReady;
}

/**
 * 전면 광고를 노출한다.
 *
 * 노출 "정책"(쿨다운·세션 상한·시작 유예)은 여기가 아니라 adPlacement.js 가
 * 담당한다. 이 함수는 SDK 호출만 책임진다.
 *
 * @param {object} [options]
 * @param {boolean} [options.onlyIfReady=false]
 *   true 면 아직 로드되지 않았을 때 기다리지 않고 즉시 false 를 반환한다.
 *   저장 직후처럼 화면 전환이 바로 이어지는 지점에서 광고 로드를 기다리다
 *   앱이 수 초간 멈춘 것처럼 보이는 것을 막는다.
 * @returns {Promise<boolean>} 실제로 노출했는지 여부
 */
export async function showAdInterstitial({ onlyIfReady = false } = {}) {
  if (!(await ensureReady())) return false;

  if (!interstitialReady) {
    if (onlyIfReady) {
      prepareInterstitial();   /* 다음 기회를 위해 채워만 두고 즉시 반환 */
      return false;
    }
    await prepareInterstitial();
  }
  if (!interstitialReady) return false;

  try {
    await AdMob.showInterstitial();
    interstitialReady = false;   /* 한 번 쓰면 소모된다 — Dismissed 리스너가 다시 채운다 */
    return true;
  } catch (err) {
    console.warn('[ads] 전면 광고 표시 실패:', err);
    interstitialReady = false;
    prepareInterstitial();
    return false;
  }
}

/* ─── 전역 스위치 ──────────────────────────────────────────────── */

/**
 * 광고 전역 ON/OFF. 향후 "광고 제거" 인앱 결제나 관리자 킬 스위치에 사용한다.
 * 끄면 이미 떠 있는 배너도 즉시 제거한다.
 */
export function setAdsEnabled(enabled) {
  adsEnabled = !!enabled;
  if (!adsEnabled && bannerVisible) {
    removeAdBanner();
  }
}

/** 현재 광고 활성화 여부 */
export function getAdsEnabled() {
  return adsEnabled;
}
