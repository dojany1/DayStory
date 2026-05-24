/* =====================================================================
   mystories.js — 일반 사용자용 나의 일화 서비스
   =====================================================================
   Firestore의 userStories 컬렉션에서 사용자 일화 데이터를 관리합니다.
   ===================================================================== */

import { db, storage } from '../firebase.js';
import { collection, doc, query, where, orderBy, getDocs, getDoc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { withTimeout } from '../utils/timeout.js';
import { isFirebaseStorageUrl } from '../utils/storage.js';

/* ─── myStories in-memory 캐시 ─── */
const MYSTORIES_CACHE_TTL_MS = 60_000; // 60초
const myStoriesCache = new Map(); // uid -> { promise, cachedAt }

export function invalidateMyStoriesCache(uid) {
  if (uid) myStoriesCache.delete(uid);
  else myStoriesCache.clear();
}

export async function fetchMyStories(uid) {
  if (!db) return [];
  if (!uid) return [];  /* Wave 4 가드: undefined/null/'' 시 전체 컬렉션 스캔 위험 차단 */

  const now = Date.now();
  const cached = myStoriesCache.get(uid);
  if (cached && now - cached.cachedAt < MYSTORIES_CACHE_TTL_MS) return cached.promise;

  const promise = (async () => {
    try {
      const q = query(
        collection(db, 'userStories'),
        where('uid', '==', uid),
        orderBy('publish_date', 'desc'),
        orderBy('created_at', 'desc')
      );
      const snap = await withTimeout(getDocs(q), 5000);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      myStoriesCache.delete(uid); // 실패 시 캐시 항목 제거
      console.warn('fetchMyStories 에러:', err);
      return [];
    }
  })();

  myStoriesCache.set(uid, { promise, cachedAt: now });
  return promise;
}

export async function fetchMyStoryById(id, uid) {
  if (!db) return null;

  try {
    const d = await getDoc(doc(db, 'userStories', id));
    if (d.exists() && d.data().uid === uid) {
      return { id: d.id, ...d.data() };
    }
    return null;
  } catch (err) {
    console.warn('fetchMyStoryById 에러:', err);
    return null;
  }
}

export async function createMyStory(data) {
  if (!db) {
    console.log('[DB Mock] createMyStory:', data);
    return;
  }
  await addDoc(collection(db, 'userStories'), {
    ...data,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp()
  });
  invalidateMyStoriesCache(data.uid);
}

export async function updateMyStory(id, data) {
  if (!db) {
    console.log('[DB Mock] updateMyStory:', id, data);
    return;
  }
  await updateDoc(doc(db, 'userStories', id), {
    ...data,
    updated_at: serverTimestamp()
  });
  invalidateMyStoriesCache(data.uid);
}

export async function deleteMyStory(id) {
  if (!db) {
    console.log('[DB Mock] deleteMyStory:', id);
    return;
  }
  let uid;
  try {
    const d = await getDoc(doc(db, 'userStories', id));
    if (d.exists()) {
      const data = d.data();
      uid = data.uid;
      if (isFirebaseStorageUrl(data.image_url)) {
        const imgRef = ref(storage, data.image_url);
        await deleteObject(imgRef).catch(e => console.warn('Storage delete fail', e));
      }
    }
  } catch(e) {
    console.warn('deleteMyStory image delete skip:', e);
  }
  await deleteDoc(doc(db, 'userStories', id));
  invalidateMyStoriesCache(uid);
}

