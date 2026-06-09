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

import { db } from './firebase.js';
import { getState } from '../state.js';
import {
  collection, doc, query, where, orderBy,
  getDocs, getDoc, addDoc, deleteDoc
} from 'firebase/firestore';
import { withTimeout as withTimeoutBase } from '../utils/timeout.js';
import { fetchStories } from './stories.js';
import { t } from '../i18n/index.js';


/* ─────────────────────────────────────────────
   섹션 1: 타임아웃 헬퍼 (Wave 5: utils/timeout.js 사용)
   ─────────────────────────────────────────────
   bookmarks 는 8초 + 한국어 안내 메시지로 호출 — 호출부 catch 가
   사용자에게 그대로 노출되는 경우가 있어 메시지를 유지. */
function withTimeout(promise, ms = 8000) {
  return withTimeoutBase(promise, ms, t('bookmarks.toast_timeout'));
}

/* Wave 4 — 빠른 더블탭 잠금: 같은 storyId 에 대한 동시 토글을 막아
 * Firestore 에 중복 북마크 문서가 생성되는 것을 방지한다. */
const inFlightToggles = new Set();

/* ─── bookmarkedStoryIds in-memory 캐시 ─── */
const BOOKMARK_IDS_CACHE_TTL_MS = 60_000; // 60초
let bookmarkIdsCache = null; // { userId, promise, cachedAt }

export function invalidateBookmarksCache() {
  bookmarkIdsCache = null;
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
  const user = getState('user');
  if (!user || !user.id) return { bookmarked: false };

  /* Wave 4 — 같은 storyId 에 대한 빠른 더블탭 차단 */
  if (inFlightToggles.has(storyId)) return { bookmarked: false };
  inFlightToggles.add(storyId);

  try {
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
    return { bookmarked: false, error: err.message || t('bookmarks.toast_process_error') };
  } finally {
    inFlightToggles.delete(storyId);
    invalidateBookmarksCache(); // 토글 후 캐시 무효화
  }
}


/* ─────────────────────────────────────────────
   섹션 3: 북마크 조회 함수들
   ───────────────────────────────────────────── */

/**
 * getBookmarkedStoryIds — 북마크된 모든 스토리의 ID만 가져옵니다
 */
export async function getBookmarkedStoryIds() {
  const user = getState('user');
  if (!user || !user.id || !db) return [];

  const now = Date.now();
  if (bookmarkIdsCache?.userId === user.id && now - bookmarkIdsCache.cachedAt < BOOKMARK_IDS_CACHE_TTL_MS) {
    return bookmarkIdsCache.promise;
  }

  const promise = (async () => {
    try {
      const q = query(
        collection(db, 'bookmarks'),
        where('user_id', '==', user.id)
      );
      const snapshot = await withTimeout(getDocs(q));
      return snapshot.docs.map(d => d.data().story_id);
    } catch {
      bookmarkIdsCache = null; // 실패 시 캐시 항목 제거
      return [];
    }
  })();

  bookmarkIdsCache = { userId: user.id, promise, cachedAt: now };
  return promise;
}

/**
 * getBookmarkedStories — 북마크된 스토리의 전체 데이터를 가져옵니다
 *
 * 1단계: 북마크 ID 목록 조회 (60초 캐시)
 * 2단계: fetchStories() 5분 캐시에서 우선 조회 → 없는 ID만 Firestore 개별 조회
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

    /* 2단계: fetchStories() 캐시에서 우선 조회 — Firestore 개별 요청 없이 즉시 반환 */
    const cachedStories = await fetchStories().catch(() => null);
    if (cachedStories && cachedStories.length > 0) {
      const storyMap = new Map(cachedStories.map(s => [s.id, s]));
      return storyIds.map(id => storyMap.get(id)).filter(Boolean);
    }

    /* 캐시 미스 폴백: 각 스토리 문서 개별 조회 */
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
