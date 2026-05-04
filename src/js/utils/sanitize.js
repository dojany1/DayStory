/* =====================================================================
   sanitize.js — HTML 이스케이프 유틸리티 (XSS 방지)
   =====================================================================
   XSS(Cross-Site Scripting)란?
     공격자가 웹사이트에 악성 JavaScript 코드를 심어서
     다른 사용자의 브라우저에서 실행되게 하는 공격입니다.

   예시:
     DB에 저장된 인물 이름이 '<script>alert("해킹!")</script>' 이라면,
     innerHTML로 삽입 시 스크립트가 실행되어 쿠키 탈취 등이 가능합니다.

   이 유틸리티는 HTML 특수문자를 안전한 문자로 변환해 이를 방지합니다.
   <  →  &lt;      (태그 시작 차단)
   >  →  &gt;      (태그 끝 차단)
   &  →  &amp;     (엔티티 시작 차단)
   "  →  &quot;    (속성값 탈출 차단)
   '  →  &#x27;   (속성값 탈출 차단)
   ===================================================================== */


/**
 * escapeHtml — 문자열의 HTML 특수문자를 이스케이프합니다
 * @param {string} text - 이스케이프할 원본 문자열
 * @returns {string} 안전하게 이스케이프된 문자열
 *
 * 사용 예시:
 *   escapeHtml('<script>alert("XSS")</script>')
 *   → '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
 *   → 브라우저에서 텍스트로만 표시되고, 스크립트는 실행되지 않음
 */
export function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * sanitizeUrl — URL이 안전한지 검증합니다
 * @param {string} url - 검증할 URL
 * @returns {string} 안전한 URL 또는 빈 문자열
 *
 * javascript: 프로토콜을 차단하여 XSS를 방지합니다.
 * 예: 'javascript:alert(1)' → '' (차단됨)
 */
export function sanitizeUrl(url) {
  if (!url) return '';
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:')) {
    return '';  /* 위험한 URL 차단 */
  }
  return url;
}
