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

/**
 * isWebpUrl — URL 이 WebP 이미지를 가리키는지 추정.
 * iOS WKWebView 의 WebP 디코더가 일부 canvas-toBlob WebP 를 처리하지 못해
 * WebContent process 가 crash 하는 사례 발견 (avatar 등).
 * 이 함수는 path 의 확장자 또는 query 의 mime 힌트로 .webp 를 식별한다.
 * @param {string} url
 * @returns {boolean}
 */
export function isWebpUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    /* Firebase Storage download URL 의 경우 pathname 은
       /v0/b/{bucket}/o/{encoded-path} 형태. encoded-path 에 .webp 가
       포함되는지 확인. */
    if (/\.webp(\?|$|%3F)/i.test(u.pathname)) return true;
    /* alt=media 등 query string 안의 hint 도 확인 */
    if (/\.webp/i.test(u.search)) return true;
    return false;
  } catch {
    /* URL 파싱 실패해도 단순 문자열 매칭은 시도 */
    return /\.webp(\?|$)/i.test(url);
  }
}
