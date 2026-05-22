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

export async function fetchMyStories(uid) {
  if (!db) return [];
  if (!uid) return [];  /* Wave 4 가드: undefined/null/'' 시 전체 컬렉션 스캔 위험 차단 */

  try {
    const q = query(
      collection(db, 'userStories'),
      where('uid', '==', uid),
      orderBy('publish_date', 'desc'),
      orderBy('created_at', 'desc')
    );
    const snap = await withTimeout(getDocs(q), 5000);
    const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return results;
  } catch (err) {
    console.warn('fetchMyStories 에러:', err);
    return [];
  }
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
}

export async function deleteMyStory(id) {
  if (!db) {
    console.log('[DB Mock] deleteMyStory:', id);
    return;
  }
  try {
    const d = await getDoc(doc(db, 'userStories', id));
    if (d.exists()) {
      const data = d.data();
      if (isFirebaseStorageUrl(data.image_url)) {
        const imgRef = ref(storage, data.image_url);
        await deleteObject(imgRef).catch(e => console.warn('Storage delete fail', e));
      }
    }
  } catch(e) {
    console.warn('deleteMyStory image delete skip:', e);
  }
  await deleteDoc(doc(db, 'userStories', id));
}

