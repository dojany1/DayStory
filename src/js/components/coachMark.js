/* =====================================================================
   coachMark.js — 맥락형 코치마크 (Pulse 점 + 툴팁)
   =====================================================================
   홈 카드 위에 "탭해서 뒤집어보세요" 같은 은은한 힌트를 띄운다.

   핵심 안전 규칙:
   - 코치마크는 pointer-events:none 이라 카드 탭을 가로채지 않는다.
     (가로채면 flip 이 안 돼 ds:card-flipped 가 안 떠서 영원히 안 사라지는 데드락 — QA Q2)
   - 컨테이너(슬라이드 아님)에 앵커한다. Swiper 가상 슬라이드는 재활용되므로
     특정 슬라이드에 붙이면 스와이프 시 위치가 어긋난다 (QA Q7).
   - 카드 flip(ds:card-flipped) 또는 탭 이탈(hashchange) 시 1회 정리하고 markSeen.
   ===================================================================== */

import { escapeHtml } from '../utils/sanitize.js';
import { markSeen } from '../services/onboarding.js';

/**
 * showCardFlipCoach — 카드 영역에 Pulse + 툴팁 코치마크를 띄운다.
 * @param {Object} opts
 * @param {HTMLElement} opts.container  코치마크를 붙일 카드 영역 (position 컨텍스트)
 * @param {string} opts.flag            ONBOARDING_FLAGS 값 (소멸 시 markSeen)
 * @param {string} opts.text            툴팁 문구
 * @returns {{ dismiss: Function }|null}
 */
export function showCardFlipCoach({ container, flag, text = '' } = {}) {
  if (!container) return null;
  /* 중복 마운트 가드 */
  if (container.querySelector('.coach-mark')) return null;

  const mark = document.createElement('div');
  mark.className = 'coach-mark';
  mark.setAttribute('aria-hidden', 'true'); /* 장식 — 카드 자체가 접근 가능한 인터랙션 */
  mark.innerHTML = `
    <span class="coach-pulse"></span>
    <div class="coach-tooltip">${escapeHtml(String(text))}</div>
  `;
  container.appendChild(mark);
  /* 등장 애니메이션 트리거 */
  requestAnimationFrame(() => mark.classList.add('is-visible'));

  let dismissed = false;
  const dismiss = ({ persist = true } = {}) => {
    if (dismissed) return;
    dismissed = true;
    document.removeEventListener('ds:card-flipped', onFlip);
    window.removeEventListener('hashchange', onLeave);
    if (persist && flag) markSeen(flag); /* 카드를 만졌으면 영구 소멸 */
    mark.classList.remove('is-visible');
    const finish = () => { if (mark.parentNode) mark.remove(); };
    mark.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, 300);
  };

  /* 카드 뒤집기 = 학습 완료 → 영구 소멸 */
  const onFlip = () => dismiss({ persist: true });
  /* 탭 이탈 시에는 아직 안 만졌으므로 기록 없이 정리만 (다음 진입 때 다시 안내) */
  const onLeave = () => dismiss({ persist: false });

  document.addEventListener('ds:card-flipped', onFlip, { once: true });
  window.addEventListener('hashchange', onLeave, { once: true });

  return { dismiss };
}
