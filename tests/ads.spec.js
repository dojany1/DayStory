// @vitest-environment jsdom
/* =====================================================================
   ads.spec.js — AdMob 광고 서비스(src/js/services/ads.js) 테스트
   =====================================================================
   검증 범위:
     1) 웹(개발/백오피스)에서는 완전 no-op 여야 한다
     2) 초기화 순서: UMP 동의 → ATT(iOS) → AdMob.initialize
     3) 중복 초기화 방지(단일 실행)
     4) 동의 미획득(canRequestAds=false) 시 광고 요청 차단
     5) 비개인화 광고(npa) 플래그 판정
     6) 배너/전면 광고 래핑 및 전면 자동 재준비
     7) 광고 실패가 앱 흐름을 깨지 않는다(throw 금지)
   ===================================================================== */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getPlatform: vi.fn(() => 'web'),
  isNativePlatform: vi.fn(() => false),
  initialize: vi.fn(async () => undefined),
  requestConsentInfo: vi.fn(async () => ({
    status: 'NOT_REQUIRED',
    isConsentFormAvailable: false,
    canRequestAds: true,
    privacyOptionsRequirementStatus: 'NOT_REQUIRED',
  })),
  showConsentForm: vi.fn(async () => ({
    status: 'OBTAINED',
    isConsentFormAvailable: true,
    canRequestAds: true,
    privacyOptionsRequirementStatus: 'REQUIRED',
  })),
  showPrivacyOptionsForm: vi.fn(async () => undefined),
  resetConsentInfo: vi.fn(async () => undefined),
  trackingAuthorizationStatus: vi.fn(async () => ({ status: 'notDetermined' })),
  requestTrackingAuthorization: vi.fn(async () => undefined),
  showBanner: vi.fn(async () => undefined),
  hideBanner: vi.fn(async () => undefined),
  resumeBanner: vi.fn(async () => undefined),
  removeBanner: vi.fn(async () => undefined),
  prepareInterstitial: vi.fn(async () => ({ adUnitId: 'test-interstitial' })),
  showInterstitial: vi.fn(async () => undefined),
  addListener: vi.fn(async () => ({ remove: vi.fn(async () => undefined) })),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: mocks.getPlatform,
    isNativePlatform: mocks.isNativePlatform,
  },
}));

vi.mock('@capacitor-community/admob', () => ({
  AdMob: {
    initialize: mocks.initialize,
    requestConsentInfo: mocks.requestConsentInfo,
    showConsentForm: mocks.showConsentForm,
    showPrivacyOptionsForm: mocks.showPrivacyOptionsForm,
    resetConsentInfo: mocks.resetConsentInfo,
    trackingAuthorizationStatus: mocks.trackingAuthorizationStatus,
    requestTrackingAuthorization: mocks.requestTrackingAuthorization,
    showBanner: mocks.showBanner,
    hideBanner: mocks.hideBanner,
    resumeBanner: mocks.resumeBanner,
    removeBanner: mocks.removeBanner,
    prepareInterstitial: mocks.prepareInterstitial,
    showInterstitial: mocks.showInterstitial,
    addListener: mocks.addListener,
  },
  BannerAdPosition: { TOP_CENTER: 'TOP_CENTER', CENTER: 'CENTER', BOTTOM_CENTER: 'BOTTOM_CENTER' },
  BannerAdSize: { ADAPTIVE_BANNER: 'ADAPTIVE_BANNER', BANNER: 'BANNER' },
  BannerAdPluginEvents: { SizeChanged: 'bannerAdSizeChanged', Loaded: 'bannerAdLoaded', FailedToLoad: 'bannerAdFailedToLoad' },
  InterstitialAdPluginEvents: { Loaded: 'interstitialAdLoaded', FailedToLoad: 'interstitialAdFailedToLoad', Dismissed: 'interstitialAdDismissed', FailedToShow: 'interstitialAdFailedToShow' },
  AdmobConsentStatus: { NOT_REQUIRED: 'NOT_REQUIRED', OBTAINED: 'OBTAINED', REQUIRED: 'REQUIRED', UNKNOWN: 'UNKNOWN' },
  AdmobConsentDebugGeography: { DISABLED: 0, EEA: 1, US: 3, OTHER: 4 },
  MaxAdContentRating: { General: 'General', ParentalGuidance: 'ParentalGuidance', Teen: 'Teen', MatureAudience: 'MatureAudience' },
}));

/* 모듈 내부 상태(초기화 플래그)가 테스트끼리 새지 않도록 매번 새로 임포트한다. */
async function loadAds() {
  vi.resetModules();
  return import('../src/js/services/ads.js');
}

/** 네이티브 플랫폼으로 위장 */
function asNative(platform = 'android') {
  mocks.getPlatform.mockReturnValue(platform);
  mocks.isNativePlatform.mockReturnValue(true);
}

/* mockClear() 는 호출 기록만 지우고 mockRejectedValue 등 구현은 남긴다.
   실패 시나리오 테스트가 뒤 테스트로 새지 않도록 매번 구현까지 초기화한다. */
beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());

  mocks.getPlatform.mockReturnValue('web');
  mocks.isNativePlatform.mockReturnValue(false);
  mocks.initialize.mockResolvedValue(undefined);
  mocks.requestConsentInfo.mockResolvedValue({
    status: 'NOT_REQUIRED',
    isConsentFormAvailable: false,
    canRequestAds: true,
    privacyOptionsRequirementStatus: 'NOT_REQUIRED',
  });
  mocks.showConsentForm.mockResolvedValue({
    status: 'OBTAINED',
    isConsentFormAvailable: true,
    canRequestAds: true,
    privacyOptionsRequirementStatus: 'REQUIRED',
  });
  mocks.showPrivacyOptionsForm.mockResolvedValue(undefined);
  mocks.resetConsentInfo.mockResolvedValue(undefined);
  mocks.trackingAuthorizationStatus.mockResolvedValue({ status: 'notDetermined' });
  mocks.requestTrackingAuthorization.mockResolvedValue(undefined);
  mocks.showBanner.mockResolvedValue(undefined);
  mocks.hideBanner.mockResolvedValue(undefined);
  mocks.resumeBanner.mockResolvedValue(undefined);
  mocks.removeBanner.mockResolvedValue(undefined);
  mocks.prepareInterstitial.mockResolvedValue({ adUnitId: 'test-interstitial' });
  mocks.showInterstitial.mockResolvedValue(undefined);
  mocks.addListener.mockResolvedValue({ remove: vi.fn(async () => undefined) });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* ─────────────────────────────────────────────
   1) 웹 no-op — CLAUDE.md: 웹은 디버깅/백오피스 전용
   ───────────────────────────────────────────── */
describe('ads service — 웹 환경', () => {
  it('initAds() 는 웹에서 AdMob SDK 를 건드리지 않는다', async () => {
    const ads = await loadAds();
    await ads.initAds();

    expect(mocks.initialize).not.toHaveBeenCalled();
    expect(mocks.requestConsentInfo).not.toHaveBeenCalled();
    expect(ads.isAdsReady()).toBe(false);
  });

  it('웹에서 showAdBanner()/showAdInterstitial() 는 조용히 무시된다', async () => {
    const ads = await loadAds();
    await expect(ads.showAdBanner()).resolves.toBe(false);
    await expect(ads.showAdInterstitial()).resolves.toBe(false);

    expect(mocks.showBanner).not.toHaveBeenCalled();
    expect(mocks.showInterstitial).not.toHaveBeenCalled();
  });
});

/* ─────────────────────────────────────────────
   2~3) 초기화 순서 및 단일 실행
   ───────────────────────────────────────────── */
describe('ads service — 초기화', () => {
  it('UMP 동의 요청 → ATT 요청 → initialize 순서로 호출한다 (iOS)', async () => {
    asNative('ios');
    const order = [];
    mocks.requestConsentInfo.mockImplementation(async () => {
      order.push('consent');
      return { status: 'NOT_REQUIRED', isConsentFormAvailable: false, canRequestAds: true, privacyOptionsRequirementStatus: 'NOT_REQUIRED' };
    });
    mocks.requestTrackingAuthorization.mockImplementation(async () => { order.push('att'); });
    mocks.initialize.mockImplementation(async () => { order.push('init'); });

    const ads = await loadAds();
    await ads.initAds();

    expect(order).toEqual(['consent', 'att', 'init']);
    expect(ads.isAdsReady()).toBe(true);
  });

  it('Android 에서는 ATT 를 요청하지 않는다', async () => {
    asNative('android');
    const ads = await loadAds();
    await ads.initAds();

    expect(mocks.requestTrackingAuthorization).not.toHaveBeenCalled();
    expect(mocks.initialize).toHaveBeenCalledTimes(1);
  });

  it('ATT 상태가 notDetermined 가 아니면 다시 요청하지 않는다', async () => {
    asNative('ios');
    mocks.trackingAuthorizationStatus.mockResolvedValue({ status: 'denied' });

    const ads = await loadAds();
    await ads.initAds();

    expect(mocks.requestTrackingAuthorization).not.toHaveBeenCalled();
  });

  it('동의 상태가 REQUIRED 이고 폼이 있으면 동의 폼을 띄운다', async () => {
    asNative('android');
    mocks.requestConsentInfo.mockResolvedValue({
      status: 'REQUIRED',
      isConsentFormAvailable: true,
      canRequestAds: false,
      privacyOptionsRequirementStatus: 'REQUIRED',
    });

    const ads = await loadAds();
    await ads.initAds();

    expect(mocks.showConsentForm).toHaveBeenCalledTimes(1);
  });

  it('동의 상태가 NOT_REQUIRED 면 동의 폼을 띄우지 않는다', async () => {
    asNative('android');
    const ads = await loadAds();
    await ads.initAds();

    expect(mocks.showConsentForm).not.toHaveBeenCalled();
  });

  it('중복 호출해도 initialize 는 1회만 실행된다', async () => {
    asNative('android');
    const ads = await loadAds();
    await Promise.all([ads.initAds(), ads.initAds()]);
    await ads.initAds();

    expect(mocks.initialize).toHaveBeenCalledTimes(1);
  });

  it('initialize 가 실패해도 예외를 던지지 않고 isAdsReady() 는 false 를 유지한다', async () => {
    asNative('android');
    mocks.initialize.mockRejectedValue(new Error('SDK boom'));

    const ads = await loadAds();
    await expect(ads.initAds()).resolves.toBeUndefined();
    expect(ads.isAdsReady()).toBe(false);
  });
});

/* ─────────────────────────────────────────────
   4~5) 동의 게이트 및 비개인화 광고
   ───────────────────────────────────────────── */
describe('ads service — 개인정보 동의(UMP)', () => {
  it('canRequestAds 가 false 면 배너를 요청하지 않는다', async () => {
    asNative('android');
    mocks.requestConsentInfo.mockResolvedValue({
      status: 'REQUIRED',
      isConsentFormAvailable: false,
      canRequestAds: false,
      privacyOptionsRequirementStatus: 'REQUIRED',
    });

    const ads = await loadAds();
    await ads.initAds();

    await expect(ads.showAdBanner()).resolves.toBe(false);
    expect(mocks.showBanner).not.toHaveBeenCalled();
  });

  it('동의 미획득(REQUIRED) 상태에서는 npa: true 로 광고를 요청한다', async () => {
    asNative('android');
    /* 폼 노출 후에도 사용자가 거부해 REQUIRED 로 남았지만 광고 요청은 가능한 경우 */
    mocks.requestConsentInfo.mockResolvedValue({
      status: 'REQUIRED',
      isConsentFormAvailable: true,
      canRequestAds: true,
      privacyOptionsRequirementStatus: 'REQUIRED',
    });
    mocks.showConsentForm.mockResolvedValue({
      status: 'REQUIRED',
      isConsentFormAvailable: true,
      canRequestAds: true,
      privacyOptionsRequirementStatus: 'REQUIRED',
    });

    const ads = await loadAds();
    await ads.initAds();
    await ads.showAdBanner();

    expect(mocks.showBanner).toHaveBeenCalledWith(expect.objectContaining({ npa: true }));
  });

  it('동의 획득(OBTAINED) 상태에서는 npa: false 로 광고를 요청한다', async () => {
    asNative('android');
    mocks.requestConsentInfo.mockResolvedValue({
      status: 'OBTAINED',
      isConsentFormAvailable: true,
      canRequestAds: true,
      privacyOptionsRequirementStatus: 'REQUIRED',
    });

    const ads = await loadAds();
    await ads.initAds();
    await ads.showAdBanner();

    expect(mocks.showBanner).toHaveBeenCalledWith(expect.objectContaining({ npa: false }));
  });

  it('개인정보 옵션이 필요한 사용자에게만 isPrivacyOptionsRequired() 가 true 다', async () => {
    asNative('android');
    mocks.requestConsentInfo.mockResolvedValue({
      status: 'OBTAINED',
      isConsentFormAvailable: true,
      canRequestAds: true,
      privacyOptionsRequirementStatus: 'REQUIRED',
    });

    const ads = await loadAds();
    await ads.initAds();

    expect(ads.isPrivacyOptionsRequired()).toBe(true);
    await ads.openPrivacyOptionsForm();
    expect(mocks.showPrivacyOptionsForm).toHaveBeenCalledTimes(1);
  });

  it('개인정보 옵션이 불필요하면 폼을 열지 않는다', async () => {
    asNative('android');
    const ads = await loadAds();
    await ads.initAds();

    expect(ads.isPrivacyOptionsRequired()).toBe(false);
    await expect(ads.openPrivacyOptionsForm()).resolves.toBe(false);
    expect(mocks.showPrivacyOptionsForm).not.toHaveBeenCalled();
  });
});

/* ─────────────────────────────────────────────
   6) 배너
   ───────────────────────────────────────────── */
describe('ads service — 배너', () => {
  it('showAdBanner() 는 모듈의 USE_TEST_ADS 값을 isTesting 으로 넘겨 적응형 배너를 요청한다', async () => {
    asNative('android');
    const ads = await loadAds();
    await ads.initAds();
    await ads.showAdBanner();

    expect(mocks.showBanner).toHaveBeenCalledWith(expect.objectContaining({
      adId: expect.stringMatching(/^ca-app-pub-/),
      adSize: 'ADAPTIVE_BANNER',
      position: 'BOTTOM_CENTER',
      isTesting: ads.USE_TEST_ADS,
    }));
  });

  it('호출자가 position / margin 을 덮어쓸 수 있다', async () => {
    asNative('android');
    const ads = await loadAds();
    await ads.initAds();
    await ads.showAdBanner({ position: 'TOP_CENTER', margin: 56 });

    expect(mocks.showBanner).toHaveBeenCalledWith(expect.objectContaining({
      position: 'TOP_CENTER',
      margin: 56,
    }));
  });

  it('initAds() 없이 showAdBanner() 를 부르면 내부적으로 초기화한다', async () => {
    asNative('android');
    const ads = await loadAds();
    await ads.showAdBanner();

    expect(mocks.initialize).toHaveBeenCalledTimes(1);
    expect(mocks.showBanner).toHaveBeenCalledTimes(1);
  });

  it('hide/resume/remove 배너를 그대로 위임한다', async () => {
    asNative('android');
    const ads = await loadAds();
    await ads.initAds();
    await ads.showAdBanner();

    await ads.hideAdBanner();
    await ads.resumeAdBanner();
    await ads.removeAdBanner();

    expect(mocks.hideBanner).toHaveBeenCalledTimes(1);
    expect(mocks.resumeBanner).toHaveBeenCalledTimes(1);
    expect(mocks.removeBanner).toHaveBeenCalledTimes(1);
  });

  it('배너 로드 실패는 throw 하지 않고 false 를 반환한다', async () => {
    asNative('android');
    mocks.showBanner.mockRejectedValue(new Error('no fill'));

    const ads = await loadAds();
    await ads.initAds();

    await expect(ads.showAdBanner()).resolves.toBe(false);
  });

  it('onBannerSizeChanged() 는 해제 가능한 핸들을 반환한다 (라우터 언마운트 정리용)', async () => {
    asNative('android');
    const remove = vi.fn(async () => undefined);
    mocks.addListener.mockResolvedValue({ remove });

    const ads = await loadAds();
    const handle = await ads.onBannerSizeChanged(() => {});

    expect(mocks.addListener).toHaveBeenCalledWith('bannerAdSizeChanged', expect.any(Function));
    await handle.remove();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

/* ─────────────────────────────────────────────
   7) 전면 광고
   ───────────────────────────────────────────── */
describe('ads service — 전면 광고', () => {
  it('showAdInterstitial() 은 준비되지 않았으면 prepare 후 show 한다', async () => {
    asNative('android');
    const order = [];
    mocks.prepareInterstitial.mockImplementation(async () => { order.push('prepare'); return { adUnitId: 'x' }; });
    mocks.showInterstitial.mockImplementation(async () => { order.push('show'); });

    const ads = await loadAds();
    await ads.initAds();
    order.length = 0;               /* init 단계의 사전 로드는 계산에서 제외 */

    await ads.showAdInterstitial();

    expect(order[order.length - 1]).toBe('show');
    expect(mocks.showInterstitial).toHaveBeenCalledTimes(1);
  });

  it('initAds() 는 전면 광고를 미리 로드해 둔다', async () => {
    asNative('android');
    const ads = await loadAds();
    await ads.initAds();

    expect(mocks.prepareInterstitial).toHaveBeenCalledWith(expect.objectContaining({
      adId: expect.stringMatching(/^ca-app-pub-/),
      isTesting: ads.USE_TEST_ADS,
    }));
  });

  it('전면 광고가 닫히면 다음 노출을 위해 자동으로 다시 준비한다', async () => {
    asNative('android');
    const ads = await loadAds();
    await ads.initAds();

    /* Dismissed 리스너를 찾아 강제 발화 */
    const call = mocks.addListener.mock.calls.find(([evt]) => evt === 'interstitialAdDismissed');
    expect(call).toBeDefined();

    const before = mocks.prepareInterstitial.mock.calls.length;
    await call[1]();
    await vi.waitFor(() => {
      expect(mocks.prepareInterstitial.mock.calls.length).toBeGreaterThan(before);
    });
  });

  it('전면 광고 실패는 throw 하지 않고 false 를 반환한다', async () => {
    asNative('android');
    mocks.prepareInterstitial.mockRejectedValue(new Error('no fill'));
    mocks.showInterstitial.mockRejectedValue(new Error('not ready'));

    const ads = await loadAds();
    await ads.initAds();

    await expect(ads.showAdInterstitial()).resolves.toBe(false);
  });

  it('canRequestAds 가 false 면 전면 광고를 띄우지 않는다', async () => {
    asNative('android');
    mocks.requestConsentInfo.mockResolvedValue({
      status: 'REQUIRED',
      isConsentFormAvailable: false,
      canRequestAds: false,
      privacyOptionsRequirementStatus: 'REQUIRED',
    });

    const ads = await loadAds();
    await ads.initAds();

    await expect(ads.showAdInterstitial()).resolves.toBe(false);
    expect(mocks.showInterstitial).not.toHaveBeenCalled();
  });
});

/* ─────────────────────────────────────────────
   광고 전역 스위치 (향후 광고 제거 IAP 대비)
   ───────────────────────────────────────────── */
describe('ads service — 전역 스위치', () => {
  it('setAdsEnabled(false) 이후에는 어떤 광고도 요청하지 않는다', async () => {
    asNative('android');
    const ads = await loadAds();
    await ads.initAds();

    ads.setAdsEnabled(false);
    await expect(ads.showAdBanner()).resolves.toBe(false);
    await expect(ads.showAdInterstitial()).resolves.toBe(false);

    expect(mocks.showBanner).not.toHaveBeenCalled();
    expect(mocks.showInterstitial).not.toHaveBeenCalled();
  });

  it('setAdsEnabled(false) 는 이미 떠 있는 배너를 제거한다', async () => {
    asNative('android');
    const ads = await loadAds();
    await ads.initAds();
    await ads.showAdBanner();

    ads.setAdsEnabled(false);
    await vi.waitFor(() => {
      expect(mocks.removeBanner).toHaveBeenCalledTimes(1);
    });
  });
});

/* =====================================================================
   AdMob ID 배선 정적 검증
   =====================================================================
   실수하기 쉬운 지점을 계약으로 고정한다:
     - 앱 ID(…~…)와 광고 단위 ID(…/…)를 서로 바꿔 넣는 실수
       (앱 ID 자리에 잘못된 값이 들어가면 앱이 실행 즉시 크래시한다)
     - Android/iOS 앱 ID 와 광고 단위 ID 의 퍼블리셔 계정 번호 불일치
     - 실 광고 단위 ID 자리에 Google 테스트 퍼블리셔가 남아 있는 상태로 출시
   ===================================================================== */
describe('AdMob ID 배선', () => {
  const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');

  /** Google 공식 테스트 퍼블리셔 — 실 광고 단위 자리에 남아 있으면 안 된다 */
  const TEST_PUBLISHER = '3940256099942544';
  /** 이 앱의 AdMob 퍼블리셔 계정 번호 */
  const PUBLISHER = '3250744272484684';

  it('Android 앱 ID 는 앱 ID 형식(~)이고 우리 퍼블리셔 계정이다', () => {
    const manifest = read('android/app/src/main/AndroidManifest.xml');
    const value = manifest
      .match(/android:name="com\.google\.android\.gms\.ads\.APPLICATION_ID"\s*\n?\s*android:value="([^"]+)"/)?.[1];

    expect(value).toBe(`ca-app-pub-${PUBLISHER}~3073922259`);
    expect(value).toContain('~');       /* 광고 단위 ID(/) 를 잘못 넣지 않았는지 */
    expect(value).not.toContain('/');
  });

  it('iOS 앱 ID 는 앱 ID 형식(~)이고 우리 퍼블리셔 계정이다', () => {
    const plist = read('ios/App/App/Info.plist');
    const value = plist
      .match(/<key>GADApplicationIdentifier<\/key>\s*\n?\s*<string>([^<]+)<\/string>/)?.[1];

    expect(value).toBe(`ca-app-pub-${PUBLISHER}~4191562809`);
    expect(value).toContain('~');
    expect(value).not.toContain('/');
  });

  it('실 광고 단위 ID 4개가 모두 채워져 있고 광고 단위 형식(/)이다', () => {
    const src = read('src/js/services/ads.js');
    const block = src.match(/const LIVE_AD_UNITS = \{[\s\S]*?\n\};/)?.[0] ?? '';
    const ids = block.match(/ca-app-pub-[\d]+\/[\d]+/g) ?? [];

    expect(ids).toHaveLength(4);
    ids.forEach((id) => {
      expect(id).toContain(`ca-app-pub-${PUBLISHER}/`);
      expect(id).not.toContain(TEST_PUBLISHER);   /* 테스트 퍼블리셔 잔존 금지 */
    });
    expect(new Set(ids).size).toBe(4);            /* 4개가 서로 달라야 한다 */
  });

  it('앱 ID 와 실 광고 단위 ID 의 퍼블리셔 계정이 일치한다', () => {
    const manifest = read('android/app/src/main/AndroidManifest.xml');
    const plist = read('ios/App/App/Info.plist');
    const src = read('src/js/services/ads.js');

    const publisherOf = (id) => id.match(/ca-app-pub-(\d+)[~/]/)?.[1];
    const androidApp = manifest.match(/android:value="(ca-app-pub-[^"]+~[^"]+)"/)?.[1];
    const iosApp = plist.match(/<string>(ca-app-pub-[^<]+~[^<]+)<\/string>/)?.[1];
    const block = src.match(/const LIVE_AD_UNITS = \{[\s\S]*?\n\};/)?.[0] ?? '';
    const unitPublishers = (block.match(/ca-app-pub-[\d]+\/[\d]+/g) ?? []).map(publisherOf);

    expect(publisherOf(androidApp)).toBe(PUBLISHER);
    expect(publisherOf(iosApp)).toBe(PUBLISHER);
    expect(new Set(unitPublishers)).toEqual(new Set([PUBLISHER]));
  });
});

/* =====================================================================
   배너 정리 요청이 무시되는 레이스 (기기 회귀 2026-08-25)
   =====================================================================
   showBanner 브리지 호출이 끝난 "뒤에" 내부 플래그를 세우면, 그 사이 들어온
   remove/hide 가 "배너 없음" 으로 판단돼 조용히 무시된다. 그 결과 뒤늦게
   완료된 show 만 남아 카드 뷰에 배너가 잔존한다.
   ===================================================================== */
describe('ads service — 배너 정리 요청 레이스', () => {
  it('show 가 진행 중일 때 들어온 removeAdBanner() 를 무시하지 않는다', async () => {
    asNative('android');
    let releaseShow;
    mocks.showBanner.mockReturnValue(new Promise((r) => { releaseShow = r; }));

    const ads = await loadAds();
    await ads.initAds();

    const showing = ads.showAdBanner();          /* 아직 완료되지 않은 show */
    await new Promise((r) => { setTimeout(r, 0); });
    await ads.removeAdBanner();                  /* 그 사이 도착한 정리 요청 */

    expect(mocks.removeBanner).toHaveBeenCalledTimes(1);

    releaseShow(undefined);
    await showing;
  });

  it('show 가 진행 중일 때 들어온 hideAdBanner() 도 무시하지 않는다', async () => {
    asNative('android');
    let releaseShow;
    mocks.showBanner.mockReturnValue(new Promise((r) => { releaseShow = r; }));

    const ads = await loadAds();
    await ads.initAds();

    const showing = ads.showAdBanner();
    await new Promise((r) => { setTimeout(r, 0); });
    await ads.hideAdBanner();

    expect(mocks.hideBanner).toHaveBeenCalledTimes(1);

    releaseShow(undefined);
    await showing;
  });
});

describe('ads service — 배너 내부 상태 동기화', () => {
  it('SizeChanged(height>0) 는 배너가 화면에 붙었다는 신호로 내부 상태를 맞춘다', async () => {
    /* iOS 는 광고 로드가 끝난 뒤에야 배너를 뷰에 붙인다. 그 사이 remove 를
       보냈다면 내부 플래그는 false 인데 화면에는 배너가 있는 상태가 된다.
       이때 다시 remove 를 보내도 무시되면 배너를 영영 못 지운다. */
    asNative('android');
    const ads = await loadAds();
    await ads.initAds();

    await ads.onBannerSizeChanged(() => {});
    const emit = mocks.addListener.mock.calls.at(-1)[1];

    emit({ width: 360, height: 62 });        /* 배너가 실제로 붙었다 */
    await ads.removeAdBanner();

    expect(mocks.removeBanner).toHaveBeenCalledTimes(1);
  });

  it('브리지가 응답하지 않아도 showAdBanner() 가 영영 멈추지 않는다', async () => {
    /* 안드로이드 플러그인은 배너가 이미 있을 때 showBanner 의 PluginCall 을
       resolve 하지 않는다. 그대로 두면 배너 조작 큐 전체가 잠긴다. */
    vi.useFakeTimers();
    asNative('android');
    mocks.showBanner.mockReturnValue(new Promise(() => {}));   /* 영원히 pending */

    const ads = await loadAds();
    await ads.initAds();

    const pending = ads.showAdBanner();
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(pending).resolves.toBe(false);
    vi.useRealTimers();
  });
});
