/* =====================================================================
   bookmarks.js — 북마크(찜) 서비스
   =====================================================================
   사용자가 마음에 드는 역사 카드를 "북마크(찜)"할 수 있는 기능입니다.
   Firestore의 bookmarks 컬렉션을 사용합니다.
   
   제공하는 기능:
     - isBookmarked()        : 특정 스토리가 북마크되어 있는지 확인
     - toggleBookmark()      : 북마크 추가/제거 토글
     - getBookmarkedStoryIds(): 북마크된 스토리 ID 목록 조회
     - getBookmarkedStories(): 북마크된 스토리 전체 데이터 조회
     - getBookmarkCount()    : 북마크 총 개수 조회
   ===================================================================== */

import { db } from '../firebase.js';
import { getState } from '../state.js';
import {
  collection, doc, query, where, orderBy,
  getDocs, getDoc, addDoc, deleteDoc
} from 'firebase/firestore';


/* ─────────────────────────────────────────────
   섹션 1: 타임아웃 헬퍼 함수
   ───────────────────────────────────────────── */

async function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('네트워크 환경이 불안정하여 서버 응답이 지연되었습니다.')), ms))
  ]);
}


/* ─────────────────────────────────────────────
   섹션 2: 북마크 확인 / 토글
   ───────────────────────────────────────────── */

/**
 * isBookmarked — 특정 스토리가 이미 북마크되어 있는지 확인합니다
 */
export async function isBookmarked(storyId) {
  try {
    const user = getState('user');
    if (!user || !user.id) return false;

    if (!db) return false;

    const q = query(
      collection(db, 'bookmarks'),
      where('user_id', '==', user.id),
      where('story_id', '==', storyId)
    );
    const snapshot = await withTimeout(getDocs(q));
    return !snapshot.empty;  /* 결과가 있으면 true */
  } catch {
    return false;
  }
}

/**
 * toggleBookmark — 북마크를 추가하거나 제거합니다
 */
export async function toggleBookmark(storyId) {
  try {
    const user = getState('user');
    if (!user || !user.id) return { bookmarked: false };

    if (!db) return { bookmarked: false };

    /* 이미 북마크했는지 확인 */
    const q = query(
      collection(db, 'bookmarks'),
      where('user_id', '==', user.id),
      where('story_id', '==', storyId)
    );
    const snapshot = await withTimeout(getDocs(q));

    if (!snapshot.empty) {
      /* 이미 북마크됨 → 삭제 */
      const bookmarkDoc = snapshot.docs[0];
      await deleteDoc(bookmarkDoc.ref);
      return { bookmarked: false, error: null };
    } else {
      /* 아직 안 됨 → 추가 */
      await addDoc(collection(db, 'bookmarks'), {
        user_id: user.id,
        story_id: storyId,
        created_at: new Date().toISOString(),
      });
      return { bookmarked: true, error: null };
    }
  } catch (err) {
    console.error('Bookmark Error:', err);
    return { bookmarked: false, error: err.message || '북마크 처리 중 오류가 발생했습니다.' };
  }
}


/* ─────────────────────────────────────────────
   섹션 3: 북마크 조회 함수들
   ───────────────────────────────────────────── */

/**
 * getBookmarkedStoryIds — 북마크된 모든 스토리의 ID만 가져옵니다
 */
export async function getBookmarkedStoryIds() {
  try {
    const user = getState('user');
    if (!user || !user.id) return [];

    if (!db) return [];

    const q = query(
      collection(db, 'bookmarks'),
      where('user_id', '==', user.id)
    );
    const snapshot = await withTimeout(getDocs(q));
    return snapshot.docs.map(d => d.data().story_id);
  } catch {
    return [];
  }
}

/**
 * getBookmarkedStories — 북마크된 스토리의 전체 데이터를 가져옵니다
 *
 * 2단계 조회:
 *   1단계: bookmarks 컬렉션에서 story_id 목록 조회
 *   2단계: stories 컬렉션에서 해당 ID들의 전체 데이터 조회
 */
export async function getBookmarkedStories() {
  try {
    const user = getState('user');
    if (!user || !user.id) return [];
    if (!db) return [];

    /* 1단계: 북마크 ID 목록 조회 (복합 인덱스 방지를 위해 JS에서 정렬) */
    const q = query(
      collection(db, 'bookmarks'),
      where('user_id', '==', user.id)
    );
    const snapshot = await withTimeout(getDocs(q));

    if (snapshot.empty) return [];

    /* created_at 기준으로 로컬에서 내림차순 정렬 후 story_id 만 추출 */
    const docsData = snapshot.docs.map(d => d.data());
    docsData.sort((a, b) => {
      const timeA = a.created_at ? (a.created_at.toMillis ? a.created_at.toMillis() : new Date(a.created_at).getTime()) : 0;
      const timeB = b.created_at ? (b.created_at.toMillis ? b.created_at.toMillis() : new Date(b.created_at).getTime()) : 0;
      return timeB - timeA;
    });
    /* 중복 북마크 방지: 동일한 story_id가 중복 저장된 경우를 대비해 Set으로 고유값만 추출 */
    const storyIds = [...new Set(docsData.map(d => d.story_id))];

    /* 2단계: 각 스토리 문서를 개별 조회 (Firestore는 'in' 쿼리로 최대 30개 지원) */
    const storySnapshots = await Promise.allSettled(
      storyIds.map((sid) => withTimeout(getDoc(doc(db, 'stories', sid))))
    );

    return storySnapshots.flatMap((result) => {
      if (result.status !== 'fulfilled') return [];

      const docSnap = result.value;
      if (!docSnap.exists()) return [];

      return [{ id: docSnap.id, ...docSnap.data() }];
    });
  } catch (err) {
    console.error('북마크 데이터 조회 실패:', err);
    return [];
  }
}

/**
 * getBookmarkCount — 현재 유저의 북마크 총 개수를 가져옵니다
 */
export async function getBookmarkCount() {
  try {
    const user = getState('user');
    if (!user || !user.id) return 0;

    if (!db) return 0;

    const q = query(
      collection(db, 'bookmarks'),
      where('user_id', '==', user.id)
    );
    const snapshot = await withTimeout(getDocs(q));
    return snapshot.size;  /* snapshot.size = 문서 개수 */
  } catch {
    return 0;
  }
}
