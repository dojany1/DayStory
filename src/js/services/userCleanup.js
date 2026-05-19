/* =====================================================================
   userCleanup.js — 회원 탈퇴 시 사용자 데이터 일괄 정리
   =====================================================================
   App Store 가이드라인 5.1.1(v) 대응. Firebase Auth 사용자를 삭제하기
   전에 Storage/Firestore 데이터를 먼저 청소해야 한다.

   삭제 순서: Storage → Firestore → deleteUser.
   deleteUser 가 먼저 실행되면 uid 권한이 사라져 Storage 규칙
   request.auth.uid == uid 매칭에 실패한다.

   제공 API:
     - purgeStorageUserData(uid)
     - purgeFirestoreUserData(uid)
     - reauthenticateUser(user)
   ===================================================================== */

import { db, storage } from '../firebase.js';
import {
  doc, collection, query, where,
  getDocs, deleteDoc, writeBatch,
} from 'firebase/firestore';
import { ref, listAll, deleteObject } from 'firebase/storage';
import {
  GoogleAuthProvider,
  reauthenticateWithPopup,
  reauthenticateWithCredential,
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

const USER_FILTERED_COLLECTIONS = ['bookmarks', 'userStories'];
const BATCH_CHUNK = 400;

/**
 * purgeStorageUserData — users/{uid}/ 하위 파일을 모두 재귀 삭제.
 * listAll prefixes 를 따라 내려가며 deleteObject (Promise.allSettled).
 */
export async function purgeStorageUserData(uid) {
  if (!storage || !uid) return;
  await _deleteStorageFolder(ref(storage, `users/${uid}`));
}

async function _deleteStorageFolder(folderRef) {
  let result;
  try {
    result = await listAll(folderRef);
  } catch (err) {
    console.warn('[userCleanup] Storage listAll 실패 (무시):', folderRef.fullPath, err);
    return;
  }
  await Promise.allSettled(result.items.map((item) => deleteObject(item)));
  for (const sub of result.prefixes) {
    await _deleteStorageFolder(sub);
  }
}

/**
 * purgeFirestoreUserData — 사용자 소유 Firestore 문서를 모두 삭제.
 *   - profiles/{uid}
 *   - bookmarks / userStories: where('user_id','==',uid) 또는 where('uid','==',uid)
 */
export async function purgeFirestoreUserData(uid) {
  if (!db || !uid) return;

  try {
    await deleteDoc(doc(db, 'profiles', uid));
  } catch (err) {
    console.warn('[userCleanup] profiles 삭제 실패 (무시):', err);
  }

  for (const collName of USER_FILTERED_COLLECTIONS) {
    const field = collName === 'userStories' ? 'uid' : 'user_id';
    try {
      const q = query(collection(db, collName), where(field, '==', uid));
      const snap = await getDocs(q);
      if (snap.empty) continue;
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += BATCH_CHUNK) {
        const batch = writeBatch(db);
        docs.slice(i, i + BATCH_CHUNK).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (err) {
      console.warn(`[userCleanup] ${collName} 삭제 실패 (무시):`, err);
    }
  }
}

/**
 * reauthenticateUser — auth/requires-recent-login 발생 시 재인증.
 * Google: 네이티브 또는 팝업. 그 외 provider(password 등): false 반환.
 * 반환: true(성공) / false(불가 — 로그인 페이지 폴백 권장)
 */
export async function reauthenticateUser(user) {
  if (!user) return false;
  const providerId = user.providerData?.[0]?.providerId || '';
  if (providerId !== 'google.com') return false;

  try {
    if (Capacitor.isNativePlatform()) {
      const result = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
      const idToken = result.credential?.idToken;
      if (!idToken) return false;
      const credential = GoogleAuthProvider.credential(idToken, result.credential?.accessToken);
      await reauthenticateWithCredential(user, credential);
      return true;
    }
    await reauthenticateWithPopup(user, new GoogleAuthProvider());
    return true;
  } catch (err) {
    console.warn('[userCleanup] 재인증 실패:', err);
    return false;
  }
}
