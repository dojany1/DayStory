/* =====================================================================
   navBadge.js — 하단 네비 'N' 배지 (웰컴 카드 알림)
   =====================================================================
   최초 가입 시 보관함에 주입된 웰컴 카드를 알리기 위해 프로필 탭에 'N' 배지를
   띄운다. 사용자가 보관함(프로필)을 방문하면 배지를 해제한다.

   배지 상태(welcomeBadgePending)는 services/onboarding.js 가 보관한다.
   ===================================================================== */

import { hasSeen, clearFlag, ONBOARDING_FLAGS } from '../services/onboarding.js';

/**
 * refreshWelcomeBadge — onboarding 상태에 맞춰 프로필 탭 'N' 배지를 동기화한다.
 * 가입 직후·앱 부팅·보관함 방문 후 호출하면 멱등하게 표시/제거된다.
 */
export function refreshWelcomeBadge() {
  const navProfile = document.getElementById('nav-profile');
  if (!navProfile) return;

  const existing = navProfile.querySelector('.nav-badge');
  const shouldShow = hasSeen(ONBOARDING_FLAGS.WELCOME_BADGE);

  if (shouldShow && !existing) {
    const badge = document.createElement('span');
    badge.className = 'nav-badge';
    badge.textContent = 'N';
    badge.setAttribute('aria-hidden', 'true');
    navProfile.appendChild(badge);
  } else if (!shouldShow && existing) {
    existing.remove();
  }
}

/**
 * dismissWelcomeBadge — 보관함 방문 시 호출. 배지 대기 상태를 해제하고 DOM 에서 제거한다.
 */
export function dismissWelcomeBadge() {
  clearFlag(ONBOARDING_FLAGS.WELCOME_BADGE);
  refreshWelcomeBadge();
}
