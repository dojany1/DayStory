/* =====================================================================
   appUpdate.js — 앱 업데이트 알림 orchestrator
   =====================================================================
   부팅 직후 1회 호출 (main.js → checkAndStartApp 직후).
   1) 현재 버전 = Capacitor App.getInfo() (웹은 package.json fallback)
   2) 최신 버전 = Firebase Remote Config 'latest_version'
   3) SemVer 비교 → 업데이트 필요 시 바텀시트 표시
   4) 사용자가 '지금 업데이트' → 플랫폼별 스토어 URL 로 이동

   모든 단계는 try-catch 로 감싸 부팅을 절대 막지 않는다.
   동일 세션 중복 호출은 가드로 차단.
   ===================================================================== */

import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import pkg from '../../../package.json';
import { fetchLatestAppVersion, fetchStoreUrls } from './remoteConfig.js';
import { isUpdateAvailable } from '../utils/version.js';
import { showUpdateSheet } from '../components/updateSheet.js';

/* 앱 패키지 ID (capacitor.config.json 과 일치) — Android Play Store URL 폴백용 */
const ANDROID_PACKAGE_ID = 'com.daystory.app';
const PLAY_STORE_FALLBACK = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_ID}`;
/* iOS App Store 의 숫자 ID 는 Remote Config 의 ios_store_url 로 주입한다.
   값이 비어 있으면 앱 이름 검색 URL 로 폴백 (사용자 1탭 이동 가능). */
const APP_STORE_SEARCH_FALLBACK = 'https://apps.apple.com/search?term=DayStory';

let hasCheckedThisSession = false;

/**
 * getCurrentInstalledVersion — 네이티브: App.getInfo().version, 웹: package.json.
 * 어떤 경로든 실패하면 null 반환 (호출부가 비교를 건너뜀).
 * @returns {Promise<string|null>}
 */
async function getCurrentInstalledVersion() {
  try {
    if (Capacitor.isNativePlatform()) {
      const info = await App.getInfo();
      return info?.version || null;
    }
    /* 웹: 빌드 시점의 package.json 버전을 사용. 실제 사용자는 모바일이지만
       개발/테스트 시 동작 확인이 가능. */
    return pkg?.version || null;
  } catch (err) {
    console.warn('[appUpdate] getCurrentInstalledVersion 실패:', err?.message || err);
    return null;
  }
}

/**
 * resolveStoreUrl — 플랫폼별로 적절한 스토어 URL 을 결정한다.
 * Remote Config 값 우선, 미설정 시 폴백.
 */
function resolveStoreUrl(platform, remoteUrls) {
  if (platform === 'ios') return remoteUrls?.ios || APP_STORE_SEARCH_FALLBACK;
  if (platform === 'android') return remoteUrls?.android || PLAY_STORE_FALLBACK;
  /* 웹: 어느 스토어로 보낼지 모호하므로 Android 페이지로 보낸다 (다수 사용자가 Android 기준). */
  return remoteUrls?.android || PLAY_STORE_FALLBACK;
}

/**
 * openStoreUrl — 스토어 페이지를 외부 브라우저/스토어 앱에서 연다.
 * Capacitor WKWebView 환경에서도 '_system' 타깃을 인식해 외부로 보낸다.
 */
function openStoreUrl(url) {
  try {
    window.open(url, '_system');
  } catch {
    window.location.href = url;
  }
}

/**
 * checkForAppUpdate — 부팅 직후 1회 호출하는 fire-and-forget 진입점.
 * 어떤 오류든 삼키고 정상 반환한다 (앱 멈춤 방지).
 * @returns {Promise<void>}
 */
export async function checkForAppUpdate() {
  if (hasCheckedThisSession) return;
  hasCheckedThisSession = true;

  try {
    const [currentVersion, latestVersion] = await Promise.all([
      getCurrentInstalledVersion(),
      fetchLatestAppVersion(),
    ]);

    if (!isUpdateAvailable(currentVersion, latestVersion)) return;

    const platform = Capacitor.getPlatform(); /* 'ios' | 'android' | 'web' */
    const remoteUrls = await fetchStoreUrls();
    const storeUrl = resolveStoreUrl(platform, remoteUrls);

    const choice = await showUpdateSheet({ currentVersion, latestVersion });
    if (choice === 'update') openStoreUrl(storeUrl);
  } catch (err) {
    console.warn('[appUpdate] checkForAppUpdate 실패 (무시):', err?.message || err);
  }
}

/* 테스트용 — 세션 가드 리셋. production 호출 없음. */
export function __resetUpdateCheckGuard() {
  hasCheckedThisSession = false;
}
