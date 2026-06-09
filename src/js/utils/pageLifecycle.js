/* =====================================================================
   pageLifecycle.js — 페이지 진입 애니메이션 완료 시점 동기화 헬퍼
   =====================================================================
   라우터에는 "전환 완료" 이벤트가 없다. .page 엘리먼트는 DOM 삽입 시
   CSS keyframe(pageEnter/from-left/from-right)으로 진입 애니메이션을 재생한다.
   온보딩 모달·코치마크를 "전환이 끝난 정확한 시점"에 부착하기 위해
   해당 엘리먼트의 animationend 를 1회 수신한다.

   - 자식 요소(스켈레톤/카드 이미지)의 animationend 버블링은 e.target 검사로 무시.
   - 애니메이션이 아예 없거나(reduced-motion 등) 이벤트 누락 시 fallback 타이머로 보장.
   ===================================================================== */

/**
 * afterPageEnter — page 진입 애니메이션이 끝나면 cb 를 1회 호출한다.
 * @param {HTMLElement} page          .page 루트 엘리먼트
 * @param {Function} cb               완료 콜백
 * @param {number} [fallbackMs=400]   animationend 미발생 대비 안전망(ms)
 */
export function afterPageEnter(page, cb, fallbackMs = 400) {
  if (!page || typeof cb !== 'function') return;

  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    page.removeEventListener('animationend', onEnd);
    clearTimeout(timer);
    cb();
  };
  /* page 자신의 진입 애니메이션만 신호로 삼는다 (자식 버블링 무시) */
  const onEnd = (e) => {
    if (e.target === page) run();
  };
  page.addEventListener('animationend', onEnd);
  const timer = setTimeout(run, fallbackMs);
}
