/* =====================================================================
   avatarCache.js — 프로필 아바타 오프라인 캐시 유틸
   =====================================================================
   Firebase Storage URL 이미지를 localStorage 에 base64 data URL 로
   캐싱하여 인터넷 연결 없이도 프로필 이미지를 표시한다.

   - saveAvatarToCache : 원격 URL 을 fetch → base64 변환 → localStorage 저장
   - loadAvatarFromCache : localStorage 에서 캐싱된 data URL 반환
   - clearAvatarCache : 로그아웃 시 캐시 정리
   ===================================================================== */

const KEY_PREFIX = 'ds_av_';

/**
 * saveAvatarToCache — 원격 이미지 URL 을 base64 로 변환하여 localStorage 캐싱.
 * best-effort: 오프라인이거나 fetch/변환 실패 시 조용히 무시한다.
 * @param {string} uid
 * @param {string} url - Firebase Storage 다운로드 URL
 */
export async function saveAvatarToCache(uid, url) {
  if (!uid || !url || !navigator.onLine) return;
  try {
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) return;
    const blob = await resp.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    localStorage.setItem(KEY_PREFIX + uid, dataUrl);
  } catch {
    /* 캐시 실패는 조용히 무시 — 오프라인 or localStorage 용량 초과 등 */
  }
}

/**
 * loadAvatarFromCache — localStorage 에서 캐싱된 아바타 data URL 반환.
 * @param {string} uid
 * @returns {string|null}
 */
export function loadAvatarFromCache(uid) {
  if (!uid) return null;
  try {
    return localStorage.getItem(KEY_PREFIX + uid) || null;
  } catch {
    return null;
  }
}

/**
 * clearAvatarCache — 로그아웃 시 캐싱된 아바타 삭제.
 * @param {string} uid
 */
export function clearAvatarCache(uid) {
  if (!uid) return;
  try {
    localStorage.removeItem(KEY_PREFIX + uid);
  } catch {
    /* ignore */
  }
}
