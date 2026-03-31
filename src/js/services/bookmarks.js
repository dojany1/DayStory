/* =====================================================================
   bookmarks.js — 북마크(찜) 서비스
   =====================================================================
   사용자가 마음에 드는 역사 카드를 "북마크(찜)"할 수 있는 기능입니다.
   Supabase의 bookmarks 테이블을 사용합니다.
   
   제공하는 기능:
     - isBookmarked()        : 특정 스토리가 북마크되어 있는지 확인
     - toggleBookmark()      : 북마크 추가/제거 토글
     - getBookmarkedStoryIds(): 북마크된 스토리 ID 목록 조회
     - getBookmarkedStories(): 북마크된 스토리 전체 데이터 조회
     - getBookmarkCount()    : 북마크 총 개수 조회
   ===================================================================== */

import { supabase } from '../supabase.js';
import { getState } from '../state.js';


/* ─────────────────────────────────────────────
   섹션 1: 타임아웃 헬퍼 함수
   ───────────────────────────────────────────── */

/**
 * withTimeout — 비동기 작업에 시간 제한을 겁니다
 * @param {Promise} promise - 시간 제한을 걸 비동기 작업
 * @param {number}  ms      - 제한 시간 (밀리초, 기본 5000ms = 5초)
 * @returns {Promise} 원래 작업 또는 타임아웃 중 먼저 끝나는 것
 * 
 * 사용 이유:
 *   서버 응답이 너무 느리면 화면이 "무한 로딩" 상태에 빠집니다.
 *   Promise.race()를 사용하면 제한 시간 내에 응답이 안 오면
 *   타임아웃 에러를 발생시켜 무한 로딩을 방지할 수 있습니다.
 * 
 * 작동 원리:
 *   Promise.race([작업A, 작업B]) → A와 B 중 먼저 끝나는 것의 결과를 반환
 */
async function withTimeout(promise, ms = 5000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('시간 초과')), ms))
  ]);
}


/* ─────────────────────────────────────────────
   섹션 2: 북마크 확인 / 토글
   ───────────────────────────────────────────── */

/**
 * isBookmarked — 특정 스토리가 이미 북마크되어 있는지 확인합니다
 * @param {string} storyId - 확인할 스토리의 ID
 * @returns {boolean} 북마크되어 있으면 true, 아니면 false
 */
export async function isBookmarked(storyId) {
  try {
    const user = getState('user');
    if (!user) return false;

    if (user.id === 'guest') {
      const saved = JSON.parse(localStorage.getItem('guest_bookmarks') || '[]');
      return saved.includes(storyId);
    }

    const { data } = await withTimeout(
      supabase
        .from('bookmarks')
        .select('id')
        .eq('user_id', user.id)
        .eq('story_id', storyId)
        .single()
    );

    return !!data;  /* data가 있으면 true, 없으면 false */
  } catch {
    return false;
  }
}

/**
 * toggleBookmark — 북마크를 추가하거나 제거합니다
 * @param {string} storyId - 토글할 스토리의 ID
 * @returns {Object} { bookmarked: boolean } — 토글 후 상태
 * 
 * 동작:
 *   이미 북마크됨 → 삭제 (bookmarked: false)
 *   아직 안 됨    → 추가 (bookmarked: true)
 */
export async function toggleBookmark(storyId) {
  try {
    const user = getState('user');
    if (!user) return { bookmarked: false };

    if (user.id === 'guest') {
      const saved = JSON.parse(localStorage.getItem('guest_bookmarks') || '[]');
      if (saved.includes(storyId)) {
        localStorage.setItem('guest_bookmarks', JSON.stringify(saved.filter(id => id !== storyId)));
        return { bookmarked: false };
      } else {
        saved.push(storyId);
        localStorage.setItem('guest_bookmarks', JSON.stringify(saved));
        return { bookmarked: true };
      }
    }

    const alreadyBookmarked = await isBookmarked(storyId);

    if (alreadyBookmarked) {
      /* 이미 북마크됨 → 삭제 */
      const { error } = await withTimeout(
        supabase.from('bookmarks').delete().eq('user_id', user.id).eq('story_id', storyId)
      );
      if (error) throw error;
      return { bookmarked: false, error: null };
    } else {
      /* 아직 안 됨 → 추가 */
      const { error } = await withTimeout(
        supabase.from('bookmarks').insert({ user_id: user.id, story_id: storyId })
      );
      if (error) throw error;
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
 * @returns {Array<string>} 스토리 ID 배열
 */
export async function getBookmarkedStoryIds() {
  try {
    const user = getState('user');
    if (!user) return [];

    if (user.id === 'guest') {
      return JSON.parse(localStorage.getItem('guest_bookmarks') || '[]');
    }

    const { data } = await withTimeout(
      supabase.from('bookmarks').select('story_id').eq('user_id', user.id)
    );

    return (data || []).map(bookmark => bookmark.story_id);
  } catch {
    return [];
  }
}

/**
 * getBookmarkedStories — 북마크된 스토리의 전체 데이터를 가져옵니다
 * @returns {Array<Object>} 스토리 데이터 배열
 * 
 * 2단계 안전 조회 방식:
 *   1단계: bookmarks 테이블에서 story_id 목록만 조회
 *   2단계: stories 테이블에서 해당 ID들의 전체 데이터 조회
 *   
 *   이렇게 나누는 이유:
 *   한 번에 JOIN(조인)하면 테이블 관계 설정 문제로 오류가 날 수 있습니다.
 *   2단계로 나누면 각각이 단순한 쿼리라 안정적입니다.
 */
export async function getBookmarkedStories() {
  try {
    const user = getState('user');
    if (!user) return [];

    let storyIds = [];

    if (user.id === 'guest') {
      storyIds = JSON.parse(localStorage.getItem('guest_bookmarks') || '[]');
      if (storyIds.length === 0) return [];
    } else {
      /* 1단계: 북마크 ID 목록 조회 */
      const { data: bookmarkData, error } = await withTimeout(
        supabase
          .from('bookmarks')
          .select('story_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
      );

      if (error || !bookmarkData || bookmarkData.length === 0) {
        return [];
      }
      storyIds = bookmarkData.map(b => b.story_id);
    }

    /* 2단계: 해당 ID들의 스토리 전체 데이터 조회 */
    const { data: storyData } = await withTimeout(
      supabase.from('stories').select('*').in('id', storyIds)
    );

    return storyData || [];
  } catch (err) {
    console.error('북마크 데이터 조회 실패:', err);
    return [];
  }
}

/**
 * getBookmarkCount — 현재 유저의 북마크 총 개수를 가져옵니다
 * @returns {number} 북마크 개수
 */
export async function getBookmarkCount() {
  try {
    const user = getState('user');
    if (!user) return 0;

    if (user.id === 'guest') {
      const saved = JSON.parse(localStorage.getItem('guest_bookmarks') || '[]');
      return saved.length;
    }

    const { count } = await withTimeout(
      supabase
        .from('bookmarks')
        .select('id', { count: 'exact', head: true })  /* head: true → 데이터 없이 개수만 */
        .eq('user_id', user.id)
    );

    return count || 0;
  } catch {
    return 0;
  }
}
