/* =====================================================================
   storage.js — Firebase Storage URL 헬퍼 (Wave 5 추출)
   =====================================================================
   services/stories, services/mystories, pages/editor, pages/mystory 에서
   각각 중복으로 `image_url.includes('firebasestorage') || ...` 패턴을
   쓰던 것을 host 파싱 기반의 한 함수로 모은다.
   ===================================================================== */

/**
 * isFirebaseStorageUrl — URL 의 host 가 Firebase Storage 호스트인지 검증.
 * @param {string} url
 * @returns {boolean}
 *
 * 허용 host:
 *   - firebasestorage.googleapis.com  (download URL)
 *   - *.firebasestorage.app           (신규 호스트 형식)
 *
 * 위양성 차단:
 *   - attacker.com/firebasestorage/...  → false  (이전 includes() 는 true 였음)
 *   - http://my.firebasestorage.app.evil.com → false (도메인 끝 매칭이라 안전)
 */
export function isFirebaseStorageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    return (
      u.hostname === 'firebasestorage.googleapis.com' ||
      u.hostname.endsWith('.firebasestorage.app')
    );
  } catch {
    return false;
  }
}
