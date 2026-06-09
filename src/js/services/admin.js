/* =====================================================================
   admin.js — 어드민 권한(Custom Claims) 서비스 (audit 2-3)
   =====================================================================
   어드민 판정은 더 이상 클라이언트의 ADMIN_EMAILS 하드코딩이나
   profiles.role 자가승격에 의존하지 않는다. Firebase Custom Claims
   (ID 토큰의 token.admin == true)를 단일 근거로 사용한다.
   allowlist 는 서버(functions/syncAdminClaim)에만 존재한다.

   - readAdminClaim()  : 현재 토큰의 admin 클레임을 읽는다.
   - syncAdminClaim()  : 서버 콜러블을 호출해 allowlist 기반으로 부여/회수받는다.

   storage.rules 의 `request.auth.token.admin == true` 와 완벽 호환된다.
   ===================================================================== */

import { app, auth } from './firebase.js';

/**
 * readAdminClaim — 현재 사용자 ID 토큰의 admin 클레임을 읽는다.
 * @param {boolean} forceRefresh  true 면 서버에서 토큰을 강제 갱신해 최신 클레임 반영.
 * @returns {Promise<boolean>}
 */
export async function readAdminClaim(forceRefresh = false) {
  const user = auth?.currentUser;
  if (!user) return false;
  try {
    const res = await user.getIdTokenResult(forceRefresh);
    return res?.claims?.admin === true;
  } catch (err) {
    console.warn('[admin] readAdminClaim 실패:', err?.message || err);
    return false;
  }
}

/**
 * syncAdminClaim — 서버 콜러블 syncAdminClaim 을 호출해 allowlist 기반으로
 * 어드민 클레임을 부여/회수받는다. 부여되면 ID 토큰을 갱신해 즉시 반영한다.
 *
 * 함수 미배포 / 네트워크 실패 시 조용히 false 를 반환한다 (앱 흐름 차단 금지).
 * firebase/functions SDK 는 동적 import 로 분리해 초기 번들 부담을 0 으로 둔다.
 *
 * @returns {Promise<boolean>} 동기화 후 어드민 여부
 */
export async function syncAdminClaim() {
  if (!app || !auth?.currentUser) return false;
  try {
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const functions = getFunctions(app, 'asia-northeast3');
    const callable = httpsCallable(functions, 'syncAdminClaim');
    const result = await callable();
    const isAdmin = result?.data?.admin === true;
    if (isAdmin) {
      /* 새로 부여된 클레임을 현재 세션 토큰에 즉시 반영 */
      await readAdminClaim(true);
    }
    return isAdmin;
  } catch (err) {
    console.warn('[admin] syncAdminClaim 실패(무시):', err?.message || err);
    return false;
  }
}
