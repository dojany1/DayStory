/* =====================================================================
   remoteConfig.js — Firebase Remote Config 서비스 래퍼
   =====================================================================
   페이지/컴포넌트는 Firebase Remote Config SDK 를 직접 호출하지 않고
   이 모듈을 통해서만 값을 읽는다 (CLAUDE.md: SDK 접근은 service 레이어 단일화).

   현재 다루는 키:
     - latest_version    : 정식 출시된 최신 앱 버전 (예: "1.3.6") — 필수
     - ios_store_url     : iOS App Store deep link (옵션, 미설정 시 fallback)
     - android_store_url : Play Store deep link (옵션, 미설정 시 fallback)

   안전장치: Firebase 초기화 실패 / 네트워크 실패 / SDK 누락 시에도 throw 하지
   않고 null 또는 fallback 을 반환한다. 호출부는 항상 null 가능성을 가정한다.
   ===================================================================== */

import { app } from '../firebase.js';

/* fetch 단일화: 동시 호출 / 재호출 시 같은 promise 재사용 (불필요 네트워크 차단) */
let activatedPromise = null;

/**
 * fetchAndActivateOnce — Remote Config 인스턴스를 lazy 초기화하고 fetch+activate.
 * 실패하면 null 반환. 첫 호출의 promise 를 캐싱해 중복 fetch 를 방지.
 * @returns {Promise<import('firebase/remote-config').RemoteConfig|null>}
 */
async function fetchAndActivateOnce() {
  if (activatedPromise) return activatedPromise;
  if (!app) return null;

  activatedPromise = (async () => {
    try {
      /* dynamic import: Remote Config SDK 를 부팅 critical path 에서 떨어뜨려
         초기 번들 크기를 줄이고, SDK 로드 실패 시에도 앱 부팅을 막지 않는다. */
      const { getRemoteConfig, fetchAndActivate } = await import('firebase/remote-config');
      const rc = getRemoteConfig(app);
      /* 최소 fetch 간격 1시간 — 잦은 호출로 quota 초과 방지.
         fetchTimeoutMillis 5초 — 모바일 약전계 환경에서 무한 대기 차단. */
      rc.settings.minimumFetchIntervalMillis = 60 * 60 * 1000;
      rc.settings.fetchTimeoutMillis = 5_000;
      rc.defaultConfig = {
        latest_version: '',
        ios_store_url: '',
        android_store_url: '',
      };
      await fetchAndActivate(rc);
      return rc;
    } catch (err) {
      console.warn('[remoteConfig] fetchAndActivate 실패 (무시):', err?.message || err);
      activatedPromise = null; /* 다음 호출에서 재시도 가능하게 */
      return null;
    }
  })();

  return activatedPromise;
}

/**
 * getRemoteConfigString — 단일 string 값 조회 헬퍼. 실패 시 '' 반환.
 * @param {string} key
 * @returns {Promise<string>}
 */
async function getRemoteConfigString(key) {
  try {
    const rc = await fetchAndActivateOnce();
    if (!rc) return '';
    const { getValue } = await import('firebase/remote-config');
    const v = getValue(rc, key);
    return typeof v?.asString === 'function' ? v.asString() : '';
  } catch (err) {
    console.warn(`[remoteConfig] ${key} 조회 실패:`, err?.message || err);
    return '';
  }
}

/**
 * fetchLatestAppVersion — Remote Config 의 latest_version 값을 가져온다.
 * 실패하거나 미설정이면 null.
 * @returns {Promise<string|null>}
 */
export async function fetchLatestAppVersion() {
  const v = await getRemoteConfigString('latest_version');
  return v ? v : null;
}

/**
 * fetchStoreUrls — 두 플랫폼의 스토어 URL 을 가져온다. 미설정 항목은 빈 문자열.
 * 호출부에서 platform 별로 적절한 fallback 을 적용한다.
 * @returns {Promise<{ ios: string, android: string }>}
 */
export async function fetchStoreUrls() {
  const [ios, android] = await Promise.all([
    getRemoteConfigString('ios_store_url'),
    getRemoteConfigString('android_store_url'),
  ]);
  return { ios, android };
}
