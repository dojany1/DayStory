// @vitest-environment jsdom
/* =====================================================================
   adPlacement.spec.js — 광고 배치/빈도 정책 (src/js/services/adPlacement.js)
   =====================================================================
   ads.js 가 "SDK 호출"을 담당한다면, adPlacement.js 는 "언제/어디에 띄울지"
   정책을 담당한다. 이 테스트는 그 정책을 계약으로 고정한다.

   배너 정책
     - /profile, /editorstory, /mystory 에서만 노출
     - editorstory/mystory 는 캘린더 뷰일 때만 (카드 뷰는 히어로 콘텐츠라 제외)
     - 하단 내비게이션 바로 위(BOTTOM_CENTER + nav 높이 margin)
     - 배너 높이만큼 레이아웃 하단 여백 예약 (--ad-banner-height + .has-ad-banner)

   전면 광고 정책
     - 앱 시작 후 60초 유예
     - 노출 간 쿨다운 4분
     - 세션당 최대 3회
     - 노출 지점은 "전환"뿐 (탭 이동 / 카드 상세 진입 / 일화 저장)
     - 카드 플립·뷰 토글은 트리거가 아니다 (콘텐츠 소비 중간을 끊지 않는다)
     - 첫 일화 저장은 제외
   ===================================================================== */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  showAdBanner: vi.fn(async () => true),
  removeAdBanner: vi.fn(async () => true),
  hideAdBanner: vi.fn(async () => true),
  resumeAdBanner: vi.fn(async () => true),
  onBannerSizeChanged: vi.fn(async () => ({ remove: vi.fn(async () => undefined) })),
  showAdInterstitial: vi.fn(async () => true),
  isInterstitialReady: vi.fn(() => true),
  canShowAds: vi.fn(() => true),
  initAds: vi.fn(async () => undefined),
}));

vi.mock('../src/js/services/ads.js', () => ({
  USE_TEST_ADS: false,          /* 테스트 중에는 정책 디버그 로그를 끈다 */
  showAdBanner: mocks.showAdBanner,
  removeAdBanner: mocks.removeAdBanner,
  hideAdBanner: mocks.hideAdBanner,
  resumeAdBanner: mocks.resumeAdBanner,
  onBannerSizeChanged: mocks.onBannerSizeChanged,
  showAdInterstitial: mocks.showAdInterstitial,
  isInterstitialReady: mocks.isInterstitialReady,
  canShowAds: mocks.canShowAds,
  initAds: mocks.initAds,
}));

/* document 리스너는 테스트 간에 살아남으므로 마지막 인스턴스를 기억해 두었다가
   afterEach 에서 정리한다. 안 하면 initAdPlacement() 호출이 누적돼 광고가 배수로 발화한다. */
let loaded = null;

async function load() {
  vi.resetModules();
  loaded = await import('../src/js/services/adPlacement.js');
  return loaded;
}

/** 앱 셸 DOM (app-container) 준비 */
function mountShell() {
  document.body.innerHTML = '<div id="app-container"><div id="page-container"></div></div>';
  return document.getElementById('app-container');
}

/** 세션 뷰 상태 설정 (cardDeckController 와 동일한 저장소) */
function setView(view) {
  sessionStorage.setItem('ds_session_view', view);
}

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.showAdBanner.mockResolvedValue(true);
  mocks.removeAdBanner.mockResolvedValue(true);
  mocks.hideAdBanner.mockResolvedValue(true);
  mocks.resumeAdBanner.mockResolvedValue(true);
  mocks.onBannerSizeChanged.mockResolvedValue({ remove: vi.fn(async () => undefined) });
  mocks.showAdInterstitial.mockResolvedValue(true);
  mocks.isInterstitialReady.mockReturnValue(true);
  mocks.canShowAds.mockReturnValue(true);
  mocks.initAds.mockResolvedValue(undefined);

  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = '';
  mountShell();
  vi.useRealTimers();
});

afterEach(() => {
  loaded?.destroyAdPlacement?.();
  loaded = null;
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  document.documentElement.style.removeProperty('--ad-banner-height');
});

/* ─────────────────────────────────────────────
   배너 — 노출 라우트
   ───────────────────────────────────────────── */
describe('adPlacement — 배너 노출 라우트', () => {
  it('/profile 에서 배너를 하단 내비 위(BOTTOM_CENTER)에 띄운다', async () => {
    const ap = await load();
    await ap.syncBannerForRoute('/profile');

    expect(mocks.showAdBanner).toHaveBeenCalledWith(expect.objectContaining({
      position: 'BOTTOM_CENTER',
      margin: expect.any(Number),
    }));
    /* nav 를 덮지 않도록 margin 은 nav 높이 이상이어야 한다 */
    expect(mocks.showAdBanner.mock.calls[0][0].margin).toBeGreaterThanOrEqual(50);
  });

  it('editorstory 는 캘린더 뷰일 때만 배너를 띄운다', async () => {
    const ap = await load();

    setView('card');
    await ap.syncBannerForRoute('/editorstory');
    expect(mocks.showAdBanner).not.toHaveBeenCalled();

    setView('calendar');
    await ap.syncBannerForRoute('/editorstory');
    expect(mocks.showAdBanner).toHaveBeenCalledTimes(1);
  });

  it('mystory 도 캘린더 뷰일 때만 배너를 띄운다', async () => {
    const ap = await load();

    setView('card');
    await ap.syncBannerForRoute('/mystory');
    expect(mocks.showAdBanner).not.toHaveBeenCalled();

    setView('calendar');
    await ap.syncBannerForRoute('/mystory');
    expect(mocks.showAdBanner).toHaveBeenCalledTimes(1);
  });

  it('그 외 라우트에서는 배너를 띄우지 않는다', async () => {
    const ap = await load();
    for (const path of ['/settings', '/detail/abc', '/login', '/mystory/new', '/bookmarks']) {
      await ap.syncBannerForRoute(path);
    }
    expect(mocks.showAdBanner).not.toHaveBeenCalled();
  });

  it('배너 노출 라우트에서 벗어나면 배너를 제거한다', async () => {
    const ap = await load();
    await ap.syncBannerForRoute('/profile');
    expect(mocks.showAdBanner).toHaveBeenCalledTimes(1);

    await ap.syncBannerForRoute('/settings');
    expect(mocks.removeAdBanner).toHaveBeenCalledTimes(1);
  });

  it('같은 라우트를 다시 sync 해도 배너를 중복 요청하지 않는다', async () => {
    const ap = await load();
    await ap.syncBannerForRoute('/profile');
    await ap.syncBannerForRoute('/profile');

    expect(mocks.showAdBanner).toHaveBeenCalledTimes(1);
  });

  it('canShowAds() 가 false 면(동의 미획득 등) 배너를 띄우지 않는다', async () => {
    mocks.canShowAds.mockReturnValue(false);
    const ap = await load();
    await ap.syncBannerForRoute('/profile');

    expect(mocks.showAdBanner).not.toHaveBeenCalled();
  });
});

/* ─────────────────────────────────────────────
   배너 — 레이아웃 공간 예약
   ───────────────────────────────────────────── */
describe('adPlacement — 배너 레이아웃 예약', () => {
  /* 배너 크기 이벤트는 "지금 화면에 배너가 붙었다" 는 신호라, 배너가 허용되는
     라우트에서만 의미가 있다. 아니면 잘못 도착한 배너로 보고 제거한다. */
  beforeEach(() => { window.location.hash = '#/profile'; });

  it('배너 높이를 --ad-banner-height 로 반영하고 .has-ad-banner 를 켠다', async () => {
    const ap = await load();
    await ap.initAdPlacement();

    /* 플러그인이 실제 렌더링 높이를 알려오는 콜백을 강제 발화 */
    const listener = mocks.onBannerSizeChanged.mock.calls[0][0];
    listener({ width: 360, height: 62 });

    const root = document.documentElement;
    expect(root.style.getPropertyValue('--ad-banner-height')).toBe('62px');
    expect(document.getElementById('app-container').classList.contains('has-ad-banner')).toBe(true);
  });

  it('배너 높이가 0 이면(숨김/실패) 예약 공간을 되돌린다', async () => {
    const ap = await load();
    await ap.initAdPlacement();
    const listener = mocks.onBannerSizeChanged.mock.calls[0][0];

    listener({ width: 360, height: 62 });
    listener({ width: 0, height: 0 });

    expect(document.documentElement.style.getPropertyValue('--ad-banner-height')).toBe('0px');
    expect(document.getElementById('app-container').classList.contains('has-ad-banner')).toBe(false);
  });

  it('배너를 제거하면 예약 공간도 함께 해제된다', async () => {
    const ap = await load();
    await ap.initAdPlacement();
    mocks.onBannerSizeChanged.mock.calls[0][0]({ width: 360, height: 62 });

    await ap.syncBannerForRoute('/profile');
    await ap.syncBannerForRoute('/settings');

    expect(document.getElementById('app-container').classList.contains('has-ad-banner')).toBe(false);
  });
});

/* ─────────────────────────────────────────────
   전면 광고 — 빈도 정책
   ───────────────────────────────────────────── */
describe('adPlacement — 전면 광고 빈도 정책', () => {
  it('앱 시작 후 60초 유예 안에는 노출하지 않는다', async () => {
    vi.useFakeTimers();
    const ap = await load();

    await ap.maybeShowInterstitial('tab');
    expect(mocks.showAdInterstitial).not.toHaveBeenCalled();

    vi.advanceTimersByTime(61_000);
    await ap.maybeShowInterstitial('tab');
    expect(mocks.showAdInterstitial).toHaveBeenCalledTimes(1);
  });

  it('노출 후 쿨다운(4분) 안에는 다시 노출하지 않는다', async () => {
    vi.useFakeTimers();
    const ap = await load();
    vi.advanceTimersByTime(61_000);

    await ap.maybeShowInterstitial('tab');
    expect(mocks.showAdInterstitial).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60_000);          /* 1분 경과 — 아직 쿨다운 중 */
    await ap.maybeShowInterstitial('tab');
    expect(mocks.showAdInterstitial).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(4 * 60_000);      /* 쿨다운 경과 */
    await ap.maybeShowInterstitial('tab');
    expect(mocks.showAdInterstitial).toHaveBeenCalledTimes(2);
  });

  it('세션당 최대 3회까지만 노출한다', async () => {
    vi.useFakeTimers();
    const ap = await load();
    vi.advanceTimersByTime(61_000);

    for (let i = 0; i < 6; i += 1) {
      await ap.maybeShowInterstitial('tab');
      vi.advanceTimersByTime(5 * 60_000);   /* 매번 쿨다운은 넉넉히 넘긴다 */
    }

    expect(mocks.showAdInterstitial).toHaveBeenCalledTimes(3);
  });

  it('전면 광고는 로드된 경우에만 띄운다 (onlyIfReady — 화면 멈춤 방지)', async () => {
    vi.useFakeTimers();
    const ap = await load();
    vi.advanceTimersByTime(61_000);

    await ap.maybeShowInterstitial('save');

    expect(mocks.showAdInterstitial).toHaveBeenCalledWith(
      expect.objectContaining({ onlyIfReady: true }),
    );
  });

  it('실제로 노출되지 않았다면(no fill 등) 쿨다운/카운트를 소모하지 않는다', async () => {
    vi.useFakeTimers();
    mocks.showAdInterstitial.mockResolvedValue(false);
    const ap = await load();
    vi.advanceTimersByTime(61_000);

    await ap.maybeShowInterstitial('tab');
    await ap.maybeShowInterstitial('tab');

    expect(mocks.showAdInterstitial).toHaveBeenCalledTimes(2);
  });

  it('canShowAds() 가 false 면 전면 광고를 시도조차 하지 않는다', async () => {
    vi.useFakeTimers();
    mocks.canShowAds.mockReturnValue(false);
    const ap = await load();
    vi.advanceTimersByTime(61_000);

    await ap.maybeShowInterstitial('tab');
    expect(mocks.showAdInterstitial).not.toHaveBeenCalled();
  });
});

/* ─────────────────────────────────────────────
   전면 광고 — 노출 지점
   ───────────────────────────────────────────── */
describe('adPlacement — 전면 광고 노출 지점', () => {
  it('카드 ↔ 캘린더 뷰 전환은 전면 광고 트리거가 아니다 (같은 화면의 표시 방식 변경일 뿐)', async () => {
    vi.useFakeTimers();
    const ap = await load();
    await ap.initAdPlacement();
    vi.advanceTimersByTime(61_000);

    document.dispatchEvent(new CustomEvent('ds:view-changed', { detail: { view: 'calendar' } }));
    document.dispatchEvent(new CustomEvent('ds:view-changed', { detail: { view: 'card' } }));
    await Promise.resolve();

    expect(mocks.showAdInterstitial).not.toHaveBeenCalled();
  });

  it('카드 뒷면 상세보기 진입에서 노출을 시도한다', async () => {
    vi.useFakeTimers();
    const ap = await load();
    vi.advanceTimersByTime(61_000);

    await ap.notifyDetailOpened();

    expect(mocks.showAdInterstitial).toHaveBeenCalledTimes(1);
    expect(mocks.showAdInterstitial).toHaveBeenCalledWith(
      expect.objectContaining({ onlyIfReady: true }),
    );
  });

  it('상세보기 진입도 빈도 정책(시작 유예·쿨다운)을 그대로 따른다', async () => {
    vi.useFakeTimers();
    const ap = await load();

    await ap.notifyDetailOpened();          /* 시작 유예 안 — 노출 없음 */
    expect(mocks.showAdInterstitial).not.toHaveBeenCalled();

    vi.advanceTimersByTime(61_000);
    await ap.notifyDetailOpened();
    await ap.notifyDetailOpened();          /* 연타 — 쿨다운에 막힌다 */
    expect(mocks.showAdInterstitial).toHaveBeenCalledTimes(1);
  });

  it('메인 탭 이동에서 노출을 시도한다', async () => {
    vi.useFakeTimers();
    const ap = await load();
    vi.advanceTimersByTime(61_000);

    await ap.notifyRouteChanged('/mystory');
    expect(mocks.showAdInterstitial).toHaveBeenCalledTimes(1);
  });

  it('탭이 아닌 라우트(상세/설정 등) 이동에서는 노출하지 않는다', async () => {
    vi.useFakeTimers();
    const ap = await load();
    vi.advanceTimersByTime(61_000);

    await ap.notifyRouteChanged('/detail/abc');
    await ap.notifyRouteChanged('/settings');
    await ap.notifyRouteChanged('/mystory/new');

    expect(mocks.showAdInterstitial).not.toHaveBeenCalled();
  });

  it('카드 플립은 전면 광고 트리거가 아니다 (핵심 상호작용 보호)', async () => {
    vi.useFakeTimers();
    const ap = await load();
    await ap.initAdPlacement();
    vi.advanceTimersByTime(61_000);

    for (let i = 0; i < 10; i += 1) {
      document.dispatchEvent(new CustomEvent('ds:card-flipped'));
    }
    await Promise.resolve();

    expect(mocks.showAdInterstitial).not.toHaveBeenCalled();
  });

  it('첫 일화 저장에서는 노출하지 않고, 두 번째 저장부터 노출한다', async () => {
    vi.useFakeTimers();
    const ap = await load();
    vi.advanceTimersByTime(61_000);

    await ap.notifyStorySaved();
    expect(mocks.showAdInterstitial).not.toHaveBeenCalled();

    vi.advanceTimersByTime(5 * 60_000);
    await ap.notifyStorySaved();
    expect(mocks.showAdInterstitial).toHaveBeenCalledTimes(1);
  });

  it('첫 저장 여부는 앱을 재시작해도 유지된다 (localStorage)', async () => {
    vi.useFakeTimers();
    let ap = await load();
    vi.advanceTimersByTime(61_000);
    await ap.notifyStorySaved();                 /* 첫 저장 — 광고 없음 */

    ap = await load();                           /* 앱 재시작 시뮬레이션 */
    vi.advanceTimersByTime(61_000);
    await ap.notifyStorySaved();

    expect(mocks.showAdInterstitial).toHaveBeenCalledTimes(1);
  });
});

/* ─────────────────────────────────────────────
   테스트 편의 (기기에서 직접 확인용)
   ───────────────────────────────────────────── */
describe('adPlacement — 디버그 우회', () => {
  it('bypass 를 켜면 유예/쿨다운/세션 상한을 모두 무시한다', async () => {
    vi.useFakeTimers();
    const ap = await load();

    ap.setAdsDebugBypass(true);
    for (let i = 0; i < 5; i += 1) {
      await ap.maybeShowInterstitial('tab');    /* 유예 60초도 지나지 않은 시점 */
    }

    expect(mocks.showAdInterstitial).toHaveBeenCalledTimes(5);
  });

  it('bypass 설정은 앱을 재시작해도 유지된다', async () => {
    vi.useFakeTimers();
    let ap = await load();
    ap.setAdsDebugBypass(true);

    ap = await load();
    await ap.maybeShowInterstitial('tab');

    expect(mocks.showAdInterstitial).toHaveBeenCalledTimes(1);
  });

  it('getAdsPlacementState() 가 현재 정책 상태를 보고한다', async () => {
    vi.useFakeTimers();
    const ap = await load();
    vi.advanceTimersByTime(61_000);
    await ap.maybeShowInterstitial('tab');

    const state = ap.getAdsPlacementState();
    expect(state).toMatchObject({
      interstitialShown: 1,
      sessionMax: 3,
      bypass: false,
      bannerVisible: false,
    });
    expect(state.cooldownRemainingMs).toBeGreaterThan(0);
  });

  it('initAdPlacement() 를 두 번 불러도 배너 크기 구독이 중복되지 않는다', async () => {
    const firstHandle = { remove: vi.fn(async () => undefined) };
    const secondHandle = { remove: vi.fn(async () => undefined) };
    mocks.onBannerSizeChanged
      .mockResolvedValueOnce(firstHandle)
      .mockResolvedValueOnce(secondHandle);

    const ap = await load();
    await ap.initAdPlacement();
    await ap.initAdPlacement();          /* 재호출 — 리스너/구독이 겹치면 안 된다 */

    expect(firstHandle.remove).toHaveBeenCalledTimes(1);   /* 이전 구독은 해제된다 */
    expect(mocks.onBannerSizeChanged).toHaveBeenCalledTimes(2);
  });

  it('destroyAdPlacement() 이후에는 뷰 전환 리스너와 디버그 핸들이 정리된다', async () => {
    const ap = await load();
    await ap.initAdPlacement();
    window.location.hash = '#/profile';      /* 배너 노출 라우트 */

    ap.destroyAdPlacement();
    document.dispatchEvent(new CustomEvent('ds:view-changed', { detail: { view: 'calendar' } }));
    await new Promise((r) => setTimeout(r, 400));   /* 배너 안정화(300ms)까지 넘긴다 */

    expect(mocks.showAdBanner).not.toHaveBeenCalled();
    expect(window.__dsAds).toBeUndefined();
  });

  it('initAdPlacement() 는 window.__dsAds 디버그 핸들을 노출한다', async () => {
    const ap = await load();
    await ap.initAdPlacement();

    expect(typeof window.__dsAds).toBe('object');
    ['state', 'bypass', 'banner', 'interstitial', 'reset'].forEach((key) => {
      expect(typeof window.__dsAds[key]).toBe('function');
    });
  });
});

/* =====================================================================
   기기 테스트에서 발견된 회귀 (2026-08-25)
   ===================================================================== */
describe('adPlacement — 전체화면 오버레이와 배너', () => {
  /** body 직속 오버레이를 열고 MutationObserver 가 반응할 틈을 준다 */
  async function openOverlay(cls = 'calendar-card-popup') {
    const el = document.createElement('div');
    el.className = cls;
    document.body.appendChild(el);
    await vi.waitFor(() => expect(document.querySelector(`.${cls.split(' ')[0]}`)).toBeTruthy());
    await new Promise((r) => setTimeout(r, 0));
    return el;
  }

  async function closeOverlay(el) {
    el.remove();
    await new Promise((r) => setTimeout(r, 0));
  }

  /* currentPath() 가 실제 라우트를 읽도록 해시를 맞춘다.
     안 맞추면 오버레이가 닫힐 때 다른 라우트로 판단해 배너가 제거된다. */
  beforeEach(() => { window.location.hash = '#/profile'; });

  it('오버레이가 열리면 배너를 숨긴다 (네이티브 배너는 z-index 로 가릴 수 없다)', async () => {
    const ap = await load();
    await ap.initAdPlacement();
    await ap.syncBannerForRoute('/profile');

    await openOverlay('calendar-card-popup');

    await vi.waitFor(() => {
      expect(mocks.hideAdBanner).toHaveBeenCalledTimes(1);
    });
  });

  it('오버레이가 닫히면 배너를 다시 표시한다', async () => {
    const ap = await load();
    await ap.initAdPlacement();
    await ap.syncBannerForRoute('/profile');

    const el = await openOverlay('calendar-card-popup');
    await vi.waitFor(() => expect(mocks.hideAdBanner).toHaveBeenCalled());

    await closeOverlay(el);
    await vi.waitFor(() => {
      expect(mocks.resumeAdBanner).toHaveBeenCalledTimes(1);
    });
  });

  it('confirm/시트/크롭 등 다른 전체화면 오버레이도 동일하게 처리한다', async () => {
    const ap = await load();
    await ap.initAdPlacement();
    await ap.syncBannerForRoute('/profile');

    for (const cls of ['confirm-dialog-overlay', 'modal-overlay', 'crop-modal-overlay']) {
      mocks.hideAdBanner.mockClear();
      const el = await openOverlay(cls);
      await vi.waitFor(() => expect(mocks.hideAdBanner).toHaveBeenCalled());
      await closeOverlay(el);
    }
  });

  it('오버레이가 열려 있는 동안에는 새 배너를 띄우지 않는다', async () => {
    const ap = await load();
    await ap.initAdPlacement();

    await openOverlay('calendar-card-popup');
    mocks.showAdBanner.mockClear();

    await ap.syncBannerForRoute('/profile');
    expect(mocks.showAdBanner).not.toHaveBeenCalled();
  });

  it('오버레이 중 배너 높이 0 이벤트가 레이아웃을 무너뜨리지 않는다', async () => {
    const ap = await load();
    await ap.initAdPlacement();
    const sizeListener = mocks.onBannerSizeChanged.mock.calls[0][0];

    sizeListener({ width: 360, height: 62 });
    await ap.syncBannerForRoute('/profile');

    await openOverlay('calendar-card-popup');
    sizeListener({ width: 0, height: 0 });        /* hideBanner 가 쏘는 이벤트 */

    /* 오버레이 뒤 레이아웃은 그대로 유지되어야 닫힐 때 튀지 않는다 */
    expect(document.documentElement.style.getPropertyValue('--ad-banner-height')).toBe('62px');
  });
});

describe('adPlacement — 뷰 전환 리스너 등록 시점', () => {
  it('SDK 구독이 지연돼도 ds:view-changed 리스너는 즉시 등록된다', async () => {
    /* 회귀: onBannerSizeChanged 를 await 한 뒤에 리스너를 걸면, SDK 구독이
       늦어질 때 리스너가 아예 안 걸려서 카드 뷰로 되돌려도 배너가 남는다. */
    mocks.onBannerSizeChanged.mockReturnValue(new Promise(() => {}));   /* 영원히 pending */

    const ap = await load();
    void ap.initAdPlacement();          /* 완료를 기다리지 않는다 */
    await Promise.resolve();

    sessionStorage.setItem('ds_session_view', 'calendar');
    document.dispatchEvent(new CustomEvent('ds:view-changed', { detail: { view: 'calendar' } }));

    await vi.waitFor(() => {
      expect(mocks.showAdBanner).toHaveBeenCalled();
    });
  });
});

describe('adPlacement — 전면 광고 쿨다운 2분', () => {
  it('쿨다운은 2분이다', async () => {
    vi.useFakeTimers();
    const ap = await load();
    vi.advanceTimersByTime(61_000);

    await ap.maybeShowInterstitial('tab');
    expect(mocks.showAdInterstitial).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(119_000);      /* 1분 59초 — 아직 쿨다운 */
    await ap.maybeShowInterstitial('tab');
    expect(mocks.showAdInterstitial).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2_000);        /* 2분 경과 */
    await ap.maybeShowInterstitial('tab');
    expect(mocks.showAdInterstitial).toHaveBeenCalledTimes(2);
  });
});

describe('adPlacement — 뷰 판정은 DOM 실제 상태를 우선한다', () => {
  /* ds_session_view 는 editorstory/mystory 가 공유하는 키라 실제 화면과 어긋날 수
     있다. 저장소가 'calendar' 라도 화면이 카드 뷰면 배너를 띄우면 안 된다. */
  function mountPage(pageClass, { calendarVisible }) {
    const container = document.getElementById('app-container');
    const page = document.createElement('div');
    page.className = `${pageClass} page`;
    const cal = document.createElement('div');
    cal.className = 'page-calendar-view';
    cal.hidden = !calendarVisible;
    page.appendChild(cal);
    container.appendChild(page);
  }

  it('저장소는 calendar 지만 화면이 카드 뷰면 배너를 띄우지 않는다', async () => {
    const ap = await load();
    sessionStorage.setItem('ds_session_view', 'calendar');
    mountPage('editorstory-page', { calendarVisible: false });

    await ap.syncBannerForRoute('/editorstory');
    expect(mocks.showAdBanner).not.toHaveBeenCalled();
  });

  it('화면이 캘린더 뷰면 배너를 띄운다', async () => {
    const ap = await load();
    sessionStorage.setItem('ds_session_view', 'calendar');
    mountPage('editorstory-page', { calendarVisible: true });

    await ap.syncBannerForRoute('/editorstory');
    expect(mocks.showAdBanner).toHaveBeenCalledTimes(1);
  });

  it('해당 페이지가 아직 마운트되지 않았으면 저장소 값으로 판단한다', async () => {
    const ap = await load();
    sessionStorage.setItem('ds_session_view', 'calendar');
    /* 페이지 미마운트 — setBeforeNavigate 는 새 페이지가 붙기 전에 호출된다 */

    await ap.syncBannerForRoute('/mystory');
    expect(mocks.showAdBanner).toHaveBeenCalledTimes(1);
  });

  it('다른 페이지의 캘린더 뷰 상태에 영향받지 않는다', async () => {
    const ap = await load();
    sessionStorage.setItem('ds_session_view', 'calendar');
    mountPage('mystory-page', { calendarVisible: false });   /* mystory 는 카드 뷰 */

    await ap.syncBannerForRoute('/mystory');
    expect(mocks.showAdBanner).not.toHaveBeenCalled();
  });
});

describe('adPlacement — 뷰 토글 이벤트 계약', () => {
  /* cardDeckController 가 hidden 반영 "후"에 이벤트를 쏴야 DOM 우선 판정이 맞는다.
     순서가 뒤집히면 캘린더로 전환해도 배너가 안 뜬다. */
  it('cardDeckController 는 hidden 갱신 뒤에 ds:view-changed 를 발행한다', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const src = readFileSync(
      resolve(process.cwd(), 'src/js/components/cardDeck/cardDeckController.js'),
      'utf8',
    );

    /* 각 분기의 시작점부터 그 분기의 requestAnimationFrame 까지만 잘라서 본다
       (끝 마커를 파일 전체에서 찾으면 앞쪽 코드에 먼저 걸린다). */
    const branchOf = (marker) => {
      const start = src.indexOf(marker);
      expect(start).toBeGreaterThan(-1);
      return src.slice(start, src.indexOf('requestAnimationFrame', start));
    };

    const calBranch = branchOf("sessionStorage.setItem('ds_session_view', 'calendar')");
    expect(calBranch.indexOf('calView.hidden = false'))
      .toBeLessThan(calBranch.indexOf('ds:view-changed'));

    const cardBranch = branchOf("sessionStorage.setItem('ds_session_view', 'card')");
    expect(cardBranch.indexOf('cardArea.hidden = false'))
      .toBeLessThan(cardBranch.indexOf('ds:view-changed'));
  });
});

describe('adPlacement — 배너 상태 자가 복구', () => {
  /* 한 번이라도 내부 상태가 실제 네이티브 상태와 어긋나면, "배너 없음" 으로
     알고 있어서 정리를 영영 안 내보내 카드 뷰에 배너가 계속 남았다.
     배너를 띄우면 안 되는 라우트/뷰에서는 무조건 정리를 요청해야 한다. */
  it('배너를 인지하지 못한 상태여도 배너 없는 뷰에서는 정리를 요청한다', async () => {
    const ap = await load();

    setView('card');
    await ap.syncBannerForRoute('/editorstory');

    expect(mocks.showAdBanner).not.toHaveBeenCalled();
    expect(mocks.removeAdBanner).toHaveBeenCalled();
  });
});

/* =====================================================================
   기기 테스트 회귀 ②-3 — 뒤늦게 도착한 배너 (2026-08-26)
   =====================================================================
   iOS 플러그인(BannerExecutor.swift)은 showBanner() 시점에 배너를 화면에
   붙이지 않는다. 광고 로드가 끝난 뒤 bannerViewDidReceiveAd 에서 비로소
   addSubview 한다. removeBanner() 는 "이미 붙은" 배너만 찾아 지우므로
   로드 중인 배너에는 아무 효과가 없다. 그래서 배너가 뜨기 직전에 화면을
   옮기면, 이전 화면의 배너가 옮겨간 화면에 그대로 붙는다.
   ===================================================================== */
describe('adPlacement — 배너 요청 안정화(연타)', () => {
  const flush = (ms = 0) => new Promise((r) => { setTimeout(r, ms); });

  /** 안정화 대기(SETTLE)를 확실히 넘긴다 */
  const settled = () => flush(600);

  it('보기 방식 연타 중에는 배너 요청을 아예 보내지 않는다', async () => {
    const ap = await load();

    setView('calendar');
    const p1 = ap.syncBannerForRoute('/editorstory');
    await flush(30);
    setView('card');
    const p2 = ap.syncBannerForRoute('/editorstory');

    await Promise.all([p1, p2]);
    await settled();

    /* 요청조차 나가지 않아야 한다 — 나가면 로드 완료 후 카드 뷰에 붙는다 */
    expect(mocks.showAdBanner).not.toHaveBeenCalled();
    expect(ap.getAdsPlacementState().bannerVisible).toBe(false);
  });

  it('연타가 끝나고 화면이 안정되면 그때 배너를 띄운다', async () => {
    const ap = await load();

    setView('calendar');
    const p1 = ap.syncBannerForRoute('/editorstory');
    await flush(30);
    setView('card');
    const p2 = ap.syncBannerForRoute('/editorstory');
    await flush(30);
    setView('calendar');
    const p3 = ap.syncBannerForRoute('/editorstory');

    await Promise.all([p1, p2, p3]);

    expect(mocks.showAdBanner).toHaveBeenCalledTimes(1);
    expect(ap.getAdsPlacementState().bannerVisible).toBe(true);
  });

  it('내비 탭 연타로 배너 라우트를 스쳐 지나가도 요청하지 않는다', async () => {
    const ap = await load();
    setView('card');

    const p1 = ap.syncBannerForRoute('/profile');       /* 배너 라우트 */
    await flush(30);
    const p2 = ap.syncBannerForRoute('/editorstory');   /* 카드 뷰 — 배너 없음 */

    await Promise.all([p1, p2]);
    await settled();

    expect(mocks.showAdBanner).not.toHaveBeenCalled();
  });

  it('배너를 끄는 요청은 지연 없이 즉시 처리한다', async () => {
    const ap = await load();
    await ap.syncBannerForRoute('/profile');
    expect(mocks.showAdBanner).toHaveBeenCalledTimes(1);

    setView('card');
    await ap.syncBannerForRoute('/editorstory');

    /* 지연 없이 바로 제거되어야 이전 화면 배너가 남지 않는다 */
    expect(mocks.removeAdBanner).toHaveBeenCalledTimes(1);
  });

  it('이미 떠 있는 배너는 다른 배너 라우트로 옮겨도 재요청하지 않는다', async () => {
    /* 안드로이드 플러그인은 배너가 이미 있을 때 showBanner 를 부르면
       PluginCall 을 resolve 하지 않아 JS 프로미스가 영영 끝나지 않는다. */
    const ap = await load();
    setView('calendar');

    await ap.syncBannerForRoute('/profile');
    await ap.syncBannerForRoute('/mystory');

    expect(mocks.showAdBanner).toHaveBeenCalledTimes(1);
    expect(ap.getAdsPlacementState().bannerRoute).toBe('/mystory');
  });
});

describe('adPlacement — 뒤늦게 도착한 배너 정리', () => {
  /** 광고 로드 완료 = 배너가 화면에 붙은 순간 (SizeChanged height > 0) */
  function adArrives(height = 62) {
    mocks.onBannerSizeChanged.mock.calls[0][0]({ width: 360, height });
  }

  it('로드가 끝난 배너가 지금 화면에 맞지 않으면 즉시 제거한다', async () => {
    const ap = await load();
    await ap.initAdPlacement();

    window.location.hash = '#/editorstory';
    setView('card');                       /* 배너가 있으면 안 되는 화면 */

    adArrives();                           /* 이전 화면에서 요청한 광고가 도착 */

    await vi.waitFor(() => {
      expect(mocks.removeAdBanner).toHaveBeenCalled();
    });
    /* 잘못 도착한 배너의 높이를 레이아웃에 예약해서도 안 된다 */
    expect(document.getElementById('app-container').classList.contains('has-ad-banner'))
      .toBe(false);
  });

  it('로드가 끝난 배너가 지금 화면에 맞으면 높이를 예약한다', async () => {
    const ap = await load();
    await ap.initAdPlacement();

    window.location.hash = '#/profile';
    adArrives();

    expect(document.documentElement.style.getPropertyValue('--ad-banner-height')).toBe('62px');
    expect(mocks.removeAdBanner).not.toHaveBeenCalled();
  });

  it('오버레이가 떠 있는 동안 도착한 배너는 즉시 숨긴다', async () => {
    const ap = await load();
    await ap.initAdPlacement();
    window.location.hash = '#/profile';
    await ap.syncBannerForRoute('/profile');

    const overlay = document.createElement('div');
    overlay.className = 'calendar-card-popup';
    document.body.appendChild(overlay);
    await vi.waitFor(() => expect(mocks.hideAdBanner).toHaveBeenCalled());

    mocks.hideAdBanner.mockClear();
    adArrives();                           /* 오버레이 위로 배너가 붙어버린 상황 */

    await vi.waitFor(() => {
      expect(mocks.hideAdBanner).toHaveBeenCalled();
    });
  });
});
