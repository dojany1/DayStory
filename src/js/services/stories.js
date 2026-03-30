/* =====================================================================
   stories.js — 스토리(역사 일화) 서비스
   =====================================================================
   Supabase의 stories 테이블에서 역사 일화 데이터를 가져오는 서비스입니다.
   서버 연결이 안 될 경우 demo.js의 데모 데이터를 사용합니다 (Fallback).
   
   주요 함수:
     - fetchStories()        : 발행된 전체 스토리 목록 조회
     - fetchTodayStory()     : 오늘 날짜의 스토리 조회
     - fetchStoryById()      : 특정 ID의 스토리 조회
     - searchStoriesDB()     : 키워드로 스토리 검색
     - (에디터 전용) CRUD 함수들
   ===================================================================== */

import { supabase } from '../supabase.js';
import { DEMO_STORIES } from '../data/demo.js';


/* ─────────────────────────────────────────────
   섹션 1: 헬퍼(도우미) 함수들
   ───────────────────────────────────────────── */

/**
 * fallbackToDemo — DB 데이터가 비어있으면 데모 데이터를 반환합니다
 * @param {Array|null} dbData - 데이터베이스에서 가져온 데이터
 * @returns {Array} 실제 데이터 또는 데모 데이터
 * 
 * 왜 필요한가?
 *   아직 DB에 데이터를 넣지 않았거나 서버 오류가 나도
 *   앱이 빈 화면 대신 샘플 데이터를 보여줄 수 있습니다.
 */
function fallbackToDemo(dbData) {
  return dbData && dbData.length > 0 ? dbData : DEMO_STORIES;
}

/**
 * withTimeout — 서버 요청에 시간 제한을 겁니다 (무한 로딩 방지)
 * @param {Promise} promise - 서버 요청 Promise
 * @param {number}  ms      - 제한 시간 (밀리초, 기본 5초)
 * @returns {Promise} 먼저 끝나는 것의 결과
 */
function withTimeout(promise, ms = 5000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('시간 초과')), ms))
  ]);
}


/* ─────────────────────────────────────────────
   섹션 2: 스토리 조회 함수 (읽기 전용)
   ───────────────────────────────────────────── */

/**
 * fetchStories — 발행된(published) 전체 스토리를 최신순으로 가져옵니다
 * @returns {Array} 스토리 데이터 배열
 */
export async function fetchStories() {
  try {
    const { data, error } = await withTimeout(
      supabase
        .from('stories')
        .select('*')
        .eq('status', 'published')
        .order('publish_date', { ascending: false })
    );
    if (error) throw error;

    return fallbackToDemo(data);
  } catch (err) {
    console.warn('스토리 목록 조회 실패, 데모 데이터 사용:', err.message);
    return DEMO_STORIES;
  }
}

/**
 * fetchTodayStory — 오늘 날짜에 해당하는 스토리를 가져옵니다
 * @returns {Object} 오늘의 스토리 데이터
 * 
 * 동작 순서:
 *   1) 오늘 날짜(YYYY-MM-DD)와 일치하는 스토리 검색
 *   2) 없으면 → 가장 최근에 발행된 스토리를 가져옴
 *   3) 그마저도 실패하면 → 데모 데이터에서 반환
 */
export async function fetchTodayStory() {
  try {
    /* 오늘 날짜를 'YYYY-MM-DD' 형식으로 만듦 */
    const today = new Date().toISOString().split('T')[0];

    /* 1차 시도: 오늘 날짜와 정확히 일치하는 스토리 */
    const { data } = await withTimeout(
      supabase
        .from('stories')
        .select('*')
        .eq('status', 'published')
        .eq('publish_date', today)
        .single()
    );
    if (data) return data;

    /* 2차 시도: 가장 최근 발행된 스토리 */
    const { data: latest } = await withTimeout(
      supabase
        .from('stories')
        .select('*')
        .eq('status', 'published')
        .order('publish_date', { ascending: false })
        .limit(1)
        .single()
    );
    if (latest) return latest;
  } catch (err) {
    console.warn('오늘의 스토리 조회 실패, 데모 데이터 사용:', err.message);
  }

  /* 최종 폴백: 데모 데이터에서 오늘 날짜에 맞는 것 또는 마지막 항목 */
  const today = new Date().toISOString().split('T')[0];
  const demoToday = DEMO_STORIES.find(s => s.publish_date === today);
  return demoToday || DEMO_STORIES[DEMO_STORIES.length - 1];
}

/**
 * fetchStoryById — 특정 ID의 스토리를 가져옵니다 (상세 페이지용)
 * @param {string} id - 스토리 ID
 * @returns {Object|null} 스토리 데이터 또는 null
 */
export async function fetchStoryById(id) {
  try {
    const { data } = await withTimeout(
      supabase
        .from('stories')
        .select('*, story_sources(*)')  /* 출처 정보도 함께 가져옴 */
        .eq('id', id)
        .single()
    );
    if (data) return data;
  } catch (err) {
    console.warn('스토리 상세 조회 실패:', err.message);
  }

  /* 폴백: 데모 데이터에서 찾기 */
  return DEMO_STORIES.find(s => s.id === id) || null;
}

/**
 * searchStoriesDB — 키워드로 스토리를 검색합니다
 * @param {string} query - 검색어
 * @returns {Array} 검색 결과 배열
 * 
 * 검색 대상: 제목, 본문, 인물 이름, 국가
 * ilike: 대소문자 구분 없이 부분 일치 검색
 */
export async function searchStoriesDB(query) {
  try {
    const searchPattern = `%${query}%`;  /* %는 SQL에서 "아무 문자" 의미 */

    const { data } = await withTimeout(
      supabase
        .from('stories')
        .select('*')
        .eq('status', 'published')
        .or(`title.ilike.${searchPattern},body.ilike.${searchPattern},figure_name.ilike.${searchPattern},country.ilike.${searchPattern}`)
        .order('publish_date', { ascending: false })
    );

    if (data && data.length > 0) return data;
  } catch (err) {
    console.warn('검색 실패, 로컬 데이터에서 검색:', err.message);
  }

  /* 폴백: 데모 데이터에서 검색 */
  const lowerQuery = query.toLowerCase();
  return DEMO_STORIES.filter(s =>
    s.title.toLowerCase().includes(lowerQuery) ||
    s.body.toLowerCase().includes(lowerQuery) ||
    s.figure_name.toLowerCase().includes(lowerQuery) ||
    s.country.toLowerCase().includes(lowerQuery)
  );
}


/* ─────────────────────────────────────────────
   섹션 3: 에디터 전용 CRUD 함수들
   ─────────────────────────────────────────────
   CRUD란?
     Create(생성), Read(조회), Update(수정), Delete(삭제)의 약자입니다.
   이 함수들은 에디터(관리자) 권한이 있는 유저만 사용합니다. */

/**
 * fetchAllStoriesEditor — 모든 스토리를 가져옵니다 (상태 무관)
 * 에디터 페이지에서 초안, 발행됨, 예약됨 등 모든 상태의 글을 보여줍니다.
 */
export async function fetchAllStoriesEditor() {
  const { data } = await supabase
    .from('stories')
    .select('*')
    .order('publish_date', { ascending: false });
  return data || [];
}

/**
 * createStory — 새 스토리를 생성합니다
 * @param {Object} story - 스토리 데이터 (title, body, image_url 등)
 * @returns {Object} 생성된 스토리 데이터
 */
export async function createStory(story) {
  const { data, error } = await supabase
    .from('stories')
    .insert(story)    /* 데이터 삽입 */
    .select()         /* 삽입된 데이터 반환 */
    .single();        /* 하나만 반환 */
  if (error) throw error;
  return data;
}

/**
 * updateStory — 기존 스토리를 수정합니다
 * @param {string} id      - 수정할 스토리 ID
 * @param {Object} updates - 변경할 필드들 (예: { title: '새 제목' })
 * @returns {Object} 수정된 스토리 데이터
 */
export async function updateStory(id, updates) {
  const { data, error } = await supabase
    .from('stories')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * deleteStory — 스토리를 삭제합니다
 * @param {string} id - 삭제할 스토리 ID
 */
export async function deleteStory(id) {
  const { error } = await supabase
    .from('stories')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

/**
 * publishStory — 스토리를 "발행" 상태로 변경합니다
 * @param {string} id - 발행할 스토리 ID
 * @returns {Object} 발행된 스토리 데이터
 */
export async function publishStory(id) {
  return updateStory(id, {
    status: 'published',
    published_at: new Date().toISOString()
  });
}
