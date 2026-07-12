/* =====================================================================
   functions/lib/accountPurge.js — 탈퇴 유예 만료 계정 완전 삭제(Admin SDK)
   =====================================================================
   클라이언트(src/js/services/userCleanup.js)의 하드 삭제와 동일한 대상을
   서버(Admin SDK)에서 정리한다. 스케줄러(purgePendingDeletions)에서 호출.

   삭제 순서: Storage → Firestore → Auth (deleteUser).
   의존성(db/auth/bucket)을 주입받아 순수 로직을 계약 테스트할 수 있게 한다.
   계약 테스트: tests/accountPurge.spec.js
   ===================================================================== */

/* uid 로 필터되는 사용자 소유 컬렉션 (userCleanup.js 와 동일 계약) */
const USER_FILTERED_COLLECTIONS = [
  { name: 'userStories', field: 'uid' },
  { name: 'bookmarks', field: 'user_id' },
];
const BATCH_CHUNK = 400;

/** purgeStorage — users/{uid}/ 하위 파일을 모두 삭제 */
async function purgeStorage(bucket, uid) {
  if (!bucket || !uid) return;
  await bucket.deleteFiles({ prefix: `users/${uid}/`, force: true });
}

/** purgeFirestore — profiles/{uid} + uid 소유 컬렉션 문서를 배치 삭제 */
async function purgeFirestore(db, uid) {
  if (!db || !uid) return;
  await db.doc(`profiles/${uid}`).delete();
  for (const { name, field } of USER_FILTERED_COLLECTIONS) {
    const snap = await db.collection(name).where(field, '==', uid).get();
    const docs = snap.docs || [];
    for (let i = 0; i < docs.length; i += BATCH_CHUNK) {
      const batch = db.batch();
      docs.slice(i, i + BATCH_CHUNK).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
}

/**
 * purgeAndDeleteAccount — 한 사용자의 Storage/Firestore/Auth 를 모두 정리.
 * 각 단계는 실패해도 다음 단계를 계속한다(부분 실패 시 다음 스케줄에서 재시도).
 * @param {{db:any, auth:any, bucket:any, uid:string}} deps
 */
async function purgeAndDeleteAccount({ db, auth, bucket, uid }) {
  try { await purgeStorage(bucket, uid); }
  catch (e) { console.warn('storage purge 실패', uid, e && e.message); }
  try { await purgeFirestore(db, uid); }
  catch (e) { console.warn('firestore purge 실패', uid, e && e.message); }
  try { await auth.deleteUser(uid); }
  catch (e) { console.warn('auth deleteUser 실패', uid, e && e.message); }
}

module.exports = {
  USER_FILTERED_COLLECTIONS,
  BATCH_CHUNK,
  purgeStorage,
  purgeFirestore,
  purgeAndDeleteAccount,
};
