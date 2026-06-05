/* =====================================================================
   userProfile.js — 사용자 프로필 service 레이어
   =====================================================================
   페이지/컴포넌트에서 Firestore profiles 컬렉션을 직접 만지지 않도록
   (CLAUDE.md 아키텍처 규칙) 프로필 부분 갱신을 이 레이어로 모은다.
   ===================================================================== */

import { auth, db } from '../firebase.js';
import { doc, setDoc } from 'firebase/firestore';

const SUPPORTED_LANGS = ['ko', 'en', 'ja'];

/**
 * saveLanguagePreference — 현재 로그인 사용자의 언어 설정을 Firestore 에 저장
 * profiles/{uid} 문서에 languagePreference 필드를 merge 로 기록한다.
 * @param {string} lang - 'ko' | 'en' | 'ja'
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
