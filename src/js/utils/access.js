/* =====================================================================
   access.js — 잠금 우회(풀 액세스) 판정 헬퍼
   =====================================================================
   다음 사용자는 캘린더의 모든 카드를 잠금 없이 열람할 수 있습니다:
     - 관리자: profile.role === 'editor'
     - 활성 구독자: profile.isPaid === true (RevenueCat entitlement 'pro')
   ===================================================================== */

import { getState } from '../state.js';

/**
 * hasFullAccess — 카드 잠금을 우회할 수 있는지 여부
 * @param {object} [profile] 명시적으로 전달하지 않으면 state에서 조회
 * @returns {boolean}
 */
export function hasFullAccess(profile) {
  const p = profile || getState('profile') || {};
  if (p.role === 'editor') return true;
  if (p.isPaid) return true;
  return false;
}

/**
 * isPaidSubscriber — 구독 활성 여부 (어드민과 별개)
 */
export function isPaidSubscriber(profile) {
  const p = profile || getState('profile') || {};
  return !!p.isPaid;
}
