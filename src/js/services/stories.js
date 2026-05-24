/* =====================================================================
   stories.js — 스토리(역사 일화) 서비스
   =====================================================================
   Firestore의 stories 컬렉션에서 역사 일화 데이터를 가져오는 서비스입니다.
   조회에 실패하면 빈 결과를 반환한다(데모/더미 폴백 없음).

   주요 함수:
     - fetchStories()        : 발행된 전체 스토리 목록 조회
     - fetchTodayStory()     : 오늘 날짜의 스토리 조회
     - fetchStoryById()      : 특정 ID의 스토리 조회
     - searchStoriesDB()     : 키워드로 스토리 검색 (로컬 필터링)
     - (에디터 전용) CRUD 함수들
   ===================================================================== */

import { db, storage, auth } from '../firebase.js';
import { getLocalToday } from '../utils/date.js';
import { withTimeout } from '../utils/timeout.js';
import { isFirebaseStorageUrl } from '../utils/storage.js';
import { getState } from '../state.js';

/*
 * Firestore 함수 임포트
 * - collection : 컬렉션(테이블) 참조를 만듦
 * - doc        : 문서(행) 참조를 만듦
 * - query      : 조건부 쿼리를 만듦
 * - where      : 필터 조건 (예: status == 'published')
 * - orderBy    : 정렬 조건
 * - limit      : 결과 개수 제한
 * - getDocs    : 여러 문서 가져오기
 * - getDoc     : 한 문서 가져오기
 * - addDoc     : 새 문서 추가
 * - updateDoc  : 문서 수정
 * - deleteDoc  : 문서 삭제
 * - serverTimestamp : 서버 시간 자동 입력
 */
import {
  collection, doc, query, where, orderBy, limit,
  getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  serverTimestamp
} from 'firebase/firestore';

import { ref, deleteObject } from 'firebase/storage';
import { uploadImage as uploadImageToStorage } from './images.js';

const STORIES_CACHE_TTL_MS = 60000;
let storiesCachePromise = null;
let storiesCacheAt = 0;

export function invalidateStoriesCache() {
  storiesCachePromise = null;
  storiesCacheAt = 0;
}

export function warmStoriesCache() {
  return fetchStories();
}


/* ─────────────────────────────────────────────
   섹션 1: 헬퍼(도우미) 함수들
   ───────────────────────────────────────────── */

/* withTimeout 은 ../utils/timeout.js 에서 import (Wave 5 추출) */

/**
 * docToData — Firestore 문서를 일반 JS 객체로 변환합니다
 * Firestore 문서에는 .id와 .data()가 따로 있어서 합쳐줘야 합니다.
 */
function docToData(docSnap) {
  return { id: docSnap.id, ...docSnap.data() };
}

/**
 * autoPublishScheduled — 발행 예정일이 오늘이거나 지난 예약 글을 자동 발행합니다
 * 
 * 왜 클라이언트에서 처리하나?
 *   서버 측 크론잡(정기 실행 스크립트)이 없는 구조이므로,
 *   앱에 접속할 때마다 "아직 scheduled인데 날짜가 지난 글"을 찾아서
 *   자동으로 published 상태로 변경합니다.
 * 
 * @param {string} todayStr - 오늘 날짜 'YYYY-MM-DD' (로컬 시간 기준)
 */
async function autoPublishScheduled(todayStr) {
  if (!db) return;
  /* 관리자만 write 가능. 일반 사용자가 호출하면 보안 룰이 거부하므로 미리 컷. */
  const profile = getState('profile');
  if (!profile || profile.role !== 'editor') return;
  try {
    /* scheduled 상태이면서 발행 예정일이 오늘이거나 지난 글을 검색 */
    const q = query(
      collection(db, 'stories'),
      where('status', '==', 'scheduled'),
      where('publish_date', '<=', todayStr)
    );
    const snapshot = await getDocs(q);
    
    /* 발견된 글들을 모두 published로 업데이트 */
    const updates = snapshot.docs.map(docSnap => {
      return updateDoc(doc(db, 'stories', docSnap.id), {
        status: 'published',
        published_at: new Date().toISOString(),
        updated_at: serverTimestamp(),
      });
    });
    
    if (updates.length > 0) {
      await Promise.all(updates);
      console.log(`[DayStory] ${updates.length}개 예약 글 자동 발행 완료`);
    }
  } catch (err) {
    /* 복합 인덱스 오류 발생 시 콘솔에 인덱스 생성 링크가 표시됩니다 */
    console.warn('예약 발행 자동 전환 실패:', err.message);
  }
}


/* ─────────────────────────────────────────────
   섹션 2: 스토리 조회 함수 (읽기 전용)
   ───────────────────────────────────────────── */

/**
 * fetchStories — 발행된(published) 전체 스토리를 최신순으로 가져옵니다
 *
 * 일반 사용자의 보안 룰은 status == 'published' 문서만 read 허용.
 * 쿼리에 status 필터를 명시해야 비-published 문서로 인한 권한 거부를 피할 수 있다.
 */
async function fetchStoriesFresh() {
  if (!db) return [];

  try {
    /* 사용자 기기의 로컬 시간 기준으로 오늘 날짜를 가져옴 (UTC가 아님!) */
    const today = getLocalToday();

    /* ★ 핵심: 예약 발행 자동 전환 — scheduled → published */
    await autoPublishScheduled(today);

    const q = query(
      collection(db, 'stories'),
      where('status', '==', 'published'),
      where('publish_date', '<=', today),
      orderBy('publish_date', 'desc')
    );
    const snapshot = await withTimeout(getDocs(q));
    return snapshot.docs.map(docToData);
  } catch (err) {
    console.warn('스토리 목록 조회 실패:', err.message);
    return [];
  }
}

export async function fetchStories() {
  const now = Date.now();
  if (storiesCachePromise && now - storiesCacheAt < STORIES_CACHE_TTL_MS) {
    return storiesCachePromise;
  }

  storiesCacheAt = now;
  storiesCachePromise = fetchStoriesFresh().catch((err) => {
    invalidateStoriesCache();
    throw err;
  });
  return storiesCachePromise;
}

/**
 * fetchTodayStory — '오늘' 날짜에 해당하는 스토리를 가져옵니다
 * 결과가 없거나 조회 실패면 null. 페이지에서 빈 상태 UI를 표시한다.
 */
export async function fetchTodayStory() {
  if (!db) return null;

  try {
    const todayStr = getLocalToday();
    const q = query(
      collection(db, 'stories'),
      where('status', '==', 'published'),
      where('publish_date', '<=', todayStr),
      orderBy('publish_date', 'desc'),
      limit(1)
    );
    const snapshot = await withTimeout(getDocs(q), 2500);
    const docs = snapshot.docs.map(docToData);
    return docs[0] || null;
  } catch (err) {
    console.warn('오늘의 스토리 조회 실패:', err.message);
    return null;
  }
}

/**
 * fetchStoryById — 특정 ID의 스토리를 가져옵니다 (상세 페이지용)
 */
export async function fetchStoryById(id) {
  if (!db) return null;

  try {
    const docSnap = await withTimeout(getDoc(doc(db, 'stories', id)), 3000);
    if (docSnap.exists()) return docToData(docSnap);
  } catch (err) {
    console.warn('스토리 상세 조회 실패:', err.message);
  }
  return null;
}

/**
 * searchStoriesDB — 키워드로 스토리를 검색합니다
 * 
 * Firestore는 SQL의 LIKE(부분 문자열) 검색을 지원하지 않으므로,
 * 전체 발행 스토리를 가져와 JS에서 직접 필터링합니다.
 * 데이터가 수백 건 이하일 때 적합한 방식입니다.
 */
export async function searchStoriesDB(queryStr) {
  try {
    const stories = await fetchStories();
    const lowerQuery = queryStr.toLowerCase();
    return stories.filter(s =>
      s.title.toLowerCase().includes(lowerQuery) ||
      s.body.toLowerCase().includes(lowerQuery) ||
      s.figure_name.toLowerCase().includes(lowerQuery) ||
      s.country.toLowerCase().includes(lowerQuery)
    );
  } catch (err) {
    console.warn('검색 실패:', err.message);
    return [];
  }
}


/* ─────────────────────────────────────────────
   섹션 3: 에디터 전용 CRUD 함수들
   ─────────────────────────────────────────────
   Create(생성), Read(조회), Update(수정), Delete(삭제) */

/**
 * fetchAllStoriesEditor — 모든 스토리를 가져옵니다 (상태 무관)
 */
export async function fetchAllStoriesEditor() {
  if (!db) return [];

  const q = query(
    collection(db, 'stories'),
    orderBy('publish_date', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToData);
}

/**
 * createStory — 새 스토리를 생성합니다
 * addDoc()은 Firestore가 자동으로 고유 ID를 만들어줍니다.
 */
export async function createStory(story) {
  if (!db) throw new Error('Firebase 미설정');

  const docRef = await addDoc(collection(db, 'stories'), {
    ...story,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  invalidateStoriesCache();

  /* 생성된 문서를 다시 읽어서 반환 */
  const docSnap = await getDoc(docRef);
  return docToData(docSnap);
}

/**
 * updateStory — 기존 스토리를 수정합니다
 */
export async function updateStory(id, updates) {
  if (!db) throw new Error('Firebase 미설정');

  const docRef = doc(db, 'stories', id);
  await updateDoc(docRef, {
    ...updates,
    updated_at: serverTimestamp(),
  });
  invalidateStoriesCache();

  /* 수정된 문서를 다시 읽어서 반환 */
  const docSnap = await getDoc(docRef);
  return docToData(docSnap);
}

/**
 * deleteStory — 스토리를 삭제합니다
 */
export async function deleteStory(id) {
  if (!db) throw new Error('Firebase 미설정');
  try {
    const d = await getDoc(doc(db, 'stories', id));
    if (d.exists()) {
      const data = d.data();
      if (isFirebaseStorageUrl(data.image_url)) {
        const imgRef = ref(storage, data.image_url);
        await deleteObject(imgRef).catch(e => console.warn('Storage delete fail', e));
      }
    }
  } catch(e) {
    console.warn('deleteStory image delete skip:', e);
  }
  await deleteDoc(doc(db, 'stories', id));
  invalidateStoriesCache();
}

/**
 * publishStory — 스토리를 "발행" 상태로 변경합니다
 */
export async function publishStory(id) {
  return updateStory(id, {
    status: 'published',
    published_at: new Date().toISOString()
  });
}

/**
 * fetchStoriesWithLicense — 이미지 출처(image_license)가 있는 발행된 스토리만 가져옵니다.
 * 날짜 기준 최신순(내림차순)으로 정렬합니다.
 * 라이선스 페이지 전용 함수입니다.
 */
export async function fetchStoriesWithLicense() {
  if (!db) return [];

  try {
    const today = getLocalToday();
    const q = query(
      collection(db, 'stories'),
      where('status', '==', 'published'),
      where('publish_date', '<=', today),
      orderBy('publish_date', 'desc')
    );
    const snapshot = await withTimeout(getDocs(q));
    return snapshot.docs
      .map(docToData)
      .filter(s => s.image_license && s.image_license.trim() !== '');
  } catch (err) {
    console.warn('라이선스 스토리 조회 실패:', err.message);
    return [];
  }
}

/**
 * uploadImage — 이미지를 Firebase Storage에 업로드하고 URL을 반환합니다
 */
export async function uploadImage(file) {
  if (!storage) throw new Error('Firebase Storage is not configured');

  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error('로그인이 필요합니다');
  const { image_url } = await uploadImageToStorage(file, { uid, folder: 'editor_images' });
  return image_url;
}
