/* =====================================================================
   userProfile.js — 사용자 프로필 service 레이어
   =====================================================================
   페이지/컴포넌트에서 Firestore profiles 컬렉션을 직접 만지지 않도록
   (CLAUDE.md 아키텍처 규칙) 프로필 부분 갱신을 이 레이어로 모은다.
   ===================================================================== */

import { auth, db } from './firebase.js';
import { doc, setDoc, deleteField } from 'firebase/firestore';

const SUPPORTED_LANGS = ['ko', 'en', 'ja', 'es', 'zh'];

/* 탈퇴 유예기간(일) — 이 기간 안에 재로그인하면 복구 가능. 만료 후 Cloud Function 이 완전 삭제. */
export const ACCOUNT_DELETION_GRACE_DAYS = 7;

/**
 * saveLanguagePreference — 현재 로그인 사용자의 언어 설정을 Firestore 에 저장
 * profiles/{uid} 문서에 languagePreference 필드를 merge 로 기록한다.
 * @param {string} lang - 'ko' | 'en' | 'ja' | 'es' | 'zh'
 * @returns {Promise<boolean>} 저장 성공 여부 (게스트/미설정/오류 시 false)
 */
export async function saveLanguagePreference(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) return false;

  const uid = auth?.currentUser?.uid;
  if (!uid || !db) return false; /* 게스트이거나 Firebase 미설정 → 로컬에만 보관 */

  try {
    await setDoc(doc(db, 'profiles', uid), { languagePreference: lang }, { merge: true });
    return true;
  } catch (err) {
    console.warn('languagePreference 저장 실패:', err);
    return false;
  }
}

/**
 * scheduleAccountDeletion — 회원 탈퇴 예약(소프트 삭제).
 * profiles/{uid} 에 status/deletionRequestedAt/deletionScheduledAt 를 merge 로 기록한다.
 * 실제 데이터·계정 삭제는 유예기간(기본 7일) 만료 후 Cloud Function(purgePendingDeletions)이 수행한다.
 * @param {string} uid
 * @param {number} [graceDays=7]
 * @returns {Promise<string|null>} 삭제 예정 시각(ISO) / 실패 시 null
 */
export async function scheduleAccountDeletion(uid, graceDays = ACCOUNT_DELETION_GRACE_DAYS) {
  if (!uid || !db) return null;
  const now = Date.now();
  const scheduledAt = new Date(now + graceDays * 24 * 60 * 60 * 1000).toISOString();
  try {
    await setDoc(doc(db, 'profiles', uid), {
      status: 'pending_deletion',
      deletionRequestedAt: new Date(now).toISOString(),
      deletionScheduledAt: scheduledAt,
    }, { merge: true });
    return scheduledAt;
  } catch (err) {
    console.warn('탈퇴 예약 실패:', err);
    return null;
  }
}

/**
 * cancelAccountDeletion — 탈퇴 예약 취소(계정 복구). 예약 관련 필드를 모두 제거한다.
 * @param {string} uid
 * @returns {Promise<boolean>}
 */
export async function cancelAccountDeletion(uid) {
  if (!uid || !db) return false;
  try {
    await setDoc(doc(db, 'profiles', uid), {
      status: deleteField(),
      deletionRequestedAt: deleteField(),
      deletionScheduledAt: deleteField(),
    }, { merge: true });
    return true;
  } catch (err) {
    console.warn('탈퇴 예약 취소 실패:', err);
    return false;
  }
}

/**
 * getDeletionState — 프로필의 탈퇴 예약 상태 판정(순수 함수).
 *   'active'  — 정상(탈퇴 예약 없음)
 *   'pending' — 탈퇴 예약됨 & 유예기간 내(재로그인 시 복구 가능)
 *   'expired' — 탈퇴 예약됨 & 유예기간 만료(곧/이미 완전 삭제)
 * @param {{status?:string, deletionScheduledAt?:string}|null|undefined} profile
 * @param {number} [nowMs=Date.now()]
 * @returns {'active'|'pending'|'expired'}
 */
export function getDeletionState(profile, nowMs = Date.now()) {
  if (!profile || profile.status !== 'pending_deletion') return 'active';
  const scheduled = Date.parse(profile.deletionScheduledAt);
  if (!Number.isFinite(scheduled)) return 'pending'; /* 예정 시각 불명 → 안전하게 유예 취급 */
  return nowMs >= scheduled ? 'expired' : 'pending';
}
