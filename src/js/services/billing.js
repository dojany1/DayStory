/* =====================================================================
   billing.js — 월 구독 결제 (RevenueCat 래퍼)
   =====================================================================
   - Android Google Play Billing 사용
   - Entitlement 식별자: 'pro' (RevenueCat 대시보드에서 등록)
   - 구독 상품 SKU: 'daystory_monthly' (월 ₩2,900)

   외부 의존성 (사용자 작업):
     1) Google Play Console > 인앱 상품 > 구독 'daystory_monthly' 생성
     2) RevenueCat 대시보드에서 Android 앱 등록 + entitlement 'pro' + offering 'default'
     3) .env 의 VITE_REVENUECAT_ANDROID_KEY 에 Public API Key 입력

   웹 환경(데스크톱 브라우저)에서는 Purchases SDK가 동작하지 않으므로
   모든 함수는 ‘웹 폴백’ 분기를 가지며 미구독 상태로 안전하게 처리합니다.
   ===================================================================== */

import { Capacitor } from '@capacitor/core';
import { getState, setState } from '../state.js';
import { auth, db } from '../firebase.js';
import { doc, setDoc } from 'firebase/firestore';
import { addMembershipCard } from './membershipCards.js';

const ENTITLEMENT_ID = 'pro';
const MONTHLY_PRODUCT_ID = 'daystory_monthly';

/* ─────────────────────────────────────────────
   ⚠️ 테스트 모드 — 실 결제 비활성화
   ─────────────────────────────────────────────
   true 동안: RevenueCat SDK 호출 없이 "구독 시작하기" 버튼 누르면 즉시 isPaid=true.
   localStorage 에 mock 상태 저장 → 새로고침 후에도 유지.
   실제 결제 시점에 false 로 바꾸면 RevenueCat 정상 흐름으로 자동 복귀.
*/
const BILLING_MOCK_MODE = true;
const MOCK_STATE_KEY = 'ds_mock_billing_active';

function loadMockState() {
  return localStorage.getItem(MOCK_STATE_KEY) === '1';
}
function saveMockState(active) {
  if (active) localStorage.setItem(MOCK_STATE_KEY, '1');
  else localStorage.removeItem(MOCK_STATE_KEY);
}
function buildMockCustomerInfo(active) {
  if (!active) return { entitlements: { active: {} } };
  const expires = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  return {
    entitlements: {
      active: {
        [ENTITLEMENT_ID]: { expirationDate: expires, expiresDate: expires },
      },
    },
  };
}

let configured = false;
let PurchasesAPI = null; // 동적 import 결과 캐시

function isNative() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function loadPurchases() {
  if (PurchasesAPI) return PurchasesAPI;
  if (!isNative()) return null;
  try {
    const mod = await import('@revenuecat/purchases-capacitor');
    PurchasesAPI = mod;
    return mod;
  } catch (err) {
    console.warn('RevenueCat SDK 로드 실패:', err.message);
    return null;
  }
}

/**
 * configureBilling — 앱 부팅 직후 1회 호출. uid 없으면 익명으로 시작.
 */
export async function configureBilling(uid) {
  if (BILLING_MOCK_MODE) {
    console.info('[billing] MOCK MODE — RevenueCat 비활성, 가상 결제 동작 중');
    return;
  }
  if (configured) return;
  const apiKey = import.meta.env?.VITE_REVENUECAT_ANDROID_KEY;
  if (!apiKey) {
    console.warn('[billing] VITE_REVENUECAT_ANDROID_KEY 미설정 — 결제 비활성');
    return;
  }
  const mod = await loadPurchases();
  if (!mod) return;
  try {
    await mod.Purchases.configure({
      apiKey,
      appUserID: uid && uid !== 'guest' ? uid : null,
    });
    configured = true;
  } catch (err) {
    console.warn('[billing] configure 실패:', err.message);
  }
}

/**
 * loginBilling — 익명 → 식별 사용자로 전환 (로그인 직후).
 */
export async function loginBilling(uid) {
  if (BILLING_MOCK_MODE) return;
  if (!configured || !uid || uid === 'guest') return;
  const mod = await loadPurchases();
  if (!mod) return;
  try {
    await mod.Purchases.logIn({ appUserID: uid });
  } catch (err) {
    console.warn('[billing] logIn 실패:', err.message);
  }
}

/**
 * fetchOfferings — 구독 상품 목록 가져오기. default offering 안의 monthly 패키지를 반환.
 */
export async function fetchMonthlyPackage() {
  if (!configured) return null;
  const mod = await loadPurchases();
  if (!mod) return null;
  try {
    const result = await mod.Purchases.getOfferings();
    const current = result?.current;
    if (!current) return null;
    /* RevenueCat 표준 식별자: '$rc_monthly' 또는 직접 등록한 패키지 */
    return current.monthly || current.availablePackages?.find((p) =>
      p.product?.identifier === MONTHLY_PRODUCT_ID
    ) || null;
  } catch (err) {
    console.warn('[billing] getOfferings 실패:', err.message);
    return null;
  }
}

/**
 * purchaseMonthly — 월 구독 결제 실행.
 * @returns {Promise<{ ok: boolean, error?: string, customerInfo?: object }>}
 */
export async function purchaseMonthly() {
  if (BILLING_MOCK_MODE) {
    /* 가상 결제 — 즉시 활성, mock 상태 영속화, 멤버십 카드 발행 */
    saveMockState(true);
    const info = buildMockCustomerInfo(true);
    await applyCustomerInfo(info);
    try { addMembershipCard(new Date()); } catch (e) { console.warn('[billing/mock] 멤버십 카드 발행 실패:', e?.message); }
    return { ok: true, customerInfo: info };
  }
  if (!isNative()) {
    return { ok: false, error: 'native_only' };
  }
  const mod = await loadPurchases();
  if (!mod) return { ok: false, error: 'sdk_unavailable' };
  if (!configured) return { ok: false, error: 'not_configured' };

  const pkg = await fetchMonthlyPackage();
  if (!pkg) return { ok: false, error: 'no_offering' };

  try {
    const { customerInfo } = await mod.Purchases.purchasePackage({ aPackage: pkg });
    await applyCustomerInfo(customerInfo);
    /* 결제 성공 — 보관함 "받은 카드" 탭에 DOKHU 멤버십 카드 1장 자동 발행 */
    try {
      addMembershipCard(new Date());
    } catch (e) {
      console.warn('[billing] 멤버십 카드 발행 실패:', e?.message || e);
    }
    return { ok: true, customerInfo };
  } catch (err) {
    /* 사용자가 결제 시트를 취소한 경우 err.userCancelled === true */
    if (err && err.userCancelled) return { ok: false, error: 'cancelled' };
    console.warn('[billing] purchase 실패:', err.message || err);
    return { ok: false, error: err.message || 'purchase_failed' };
  }
}

/**
 * restorePurchases — 결제 복원 (앱 재설치 후). 활성 구독이 없으면 isPaid=false로 동기화.
 */
export async function restorePurchases() {
  if (BILLING_MOCK_MODE) {
    await applyCustomerInfo(buildMockCustomerInfo(loadMockState()));
    return { ok: true };
  }
  if (!isNative()) return { ok: false, error: 'native_only' };
  const mod = await loadPurchases();
  if (!mod) return { ok: false, error: 'sdk_unavailable' };
  try {
    const customerInfo = await mod.Purchases.restorePurchases();
    await applyCustomerInfo(customerInfo?.customerInfo || customerInfo);
    return { ok: true };
  } catch (err) {
    console.warn('[billing] restore 실패:', err.message || err);
    return { ok: false, error: err.message || 'restore_failed' };
  }
}

/**
 * syncSubscriptionState — 현재 구독 상태를 조회해 profile.isPaid 갱신.
 * 부팅·resume·결제 후 호출.
 */
export async function syncSubscriptionState() {
  if (BILLING_MOCK_MODE) {
    /* 부팅·resume 시점에 mock 상태를 state.profile에 반영 → 페이지들이 자동 갱신 */
    await applyCustomerInfo(buildMockCustomerInfo(loadMockState()));
    return;
  }
  if (!isNative() || !configured) {
    /* 웹·미설정 환경: profile.isPaid 그대로 두되 false로 정리 */
    return;
  }
  const mod = await loadPurchases();
  if (!mod) return;
  try {
    const customerInfo = await mod.Purchases.getCustomerInfo();
    await applyCustomerInfo(customerInfo?.customerInfo || customerInfo);
  } catch (err) {
    console.warn('[billing] getCustomerInfo 실패:', err.message);
  }
}

/**
 * cancelMockSubscription — 테스트 모드 전용: 가상 구독을 취소해 isPaid=false 로 되돌립니다.
 * 실 결제 모드에선 사용자가 Play Store에서 직접 취소.
 */
export async function cancelMockSubscription() {
  if (!BILLING_MOCK_MODE) return { ok: false, error: 'not_mock' };
  saveMockState(false);
  await applyCustomerInfo(buildMockCustomerInfo(false));
  return { ok: true };
}

/** mock 모드 여부 (UI 분기용) */
export function isMockBilling() {
  return BILLING_MOCK_MODE;
}

/**
 * isProActive — entitlements.active.pro 활성 여부
 */
export function isProActive(customerInfo) {
  return !!customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
}

/**
 * getSubscriptionEnd — 구독 만료일(다음 결제일) ISO 문자열
 */
export function getSubscriptionEnd(customerInfo) {
  const ent = customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
  return ent?.expirationDate || ent?.expiresDate || '';
}

/**
 * applyCustomerInfo — RevenueCat customerInfo를 state.profile + Firestore에 반영.
 */
async function applyCustomerInfo(customerInfo) {
  if (!customerInfo) return;
  const isPaid = isProActive(customerInfo);
  const subEnd = getSubscriptionEnd(customerInfo);

  const profile = getState('profile') || {};
  const next = { ...profile, isPaid, subscription_end: subEnd };
  setState('profile', next);

  /* Firestore도 함께 갱신 (로그인 사용자만) */
  const uid = auth?.currentUser?.uid;
  if (db && uid) {
    try {
      await setDoc(
        doc(db, 'profiles', uid),
        { isPaid, subscription_end: subEnd },
        { merge: true }
      );
    } catch (err) {
      console.warn('[billing] profile sync 실패:', err.message);
    }
  }
}
