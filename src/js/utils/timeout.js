/* =====================================================================
   timeout.js — Promise 타임아웃 헬퍼 (Wave 5 추출)
   =====================================================================
   서비스 레이어 3곳(stories/bookmarks/mystories)에서 각각 중복 정의되던
   `Promise.race + setTimeout reject` 패턴을 하나로 모은다.
   ===================================================================== */

/**
 * withTimeout — 주어진 promise 가 ms 안에 끝나지 않으면 reject 한다.
 * @param {Promise} promise   감쌀 Promise
 * @param {number}  ms        밀리초 (기본 5000)
 * @param {string}  [message] 타임아웃 시 reject 할 Error 메시지
 * @returns {Promise} 원본 promise 의 결과 또는 timeout reject
 */
export function withTimeout(promise, ms = 5000, message = '시간 초과') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}
