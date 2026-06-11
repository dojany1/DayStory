/* =====================================================================
   notificationCenter.js — 알림 센터 데이터 서비스
   =====================================================================
   공통 공지(notices) + 본인 문의 내역(inquiries) 을 인앱 알림 센터에서
   보여주기 위한 service 레이어. (CLAUDE.md 규칙: Firestore 접근은 service 에서만)

   ⚠️ 기존 services/notifications.js 는 "로컬 푸시 알림 스케줄링" 전용 모듈이며
      본 모듈과 관심사가 다르다. 두 파일을 혼동하지 말 것.

   이번 라운드 범위: 일반 유저 기능(공지 열람 + 본인 문의/답변 열람).
   어드민 pending 전체 조회·답변 작성 UI 는 다음 라운드(보류).

   비용 최적화:
     - limit(20) + startAfter 커서 페이지네이션
     - 배지용 unread 판정은 limit(1) 경량 조회 2건으로 처리(checkUnread)
   ===================================================================== */

import { db } from './firebase.js';
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit as fbLimit,
  startAfter,
  getDocs,
  getDoc,
} from 'firebase/firestore';
import { getCurrentLang } from '../i18n/index.js';

const NOTICES_COL = 'notices';
const INQUIRIES_COL = 'inquiries';
const PAGE_SIZE = 20;
const MY_INQUIRY_LIMIT = 20;

/* 마지막으로 알림 센터를 확인한 시각(ms). 이후 생성/답변은 unread 로 본다. */
const LAST_SEEN_KEY = 'ds_notif_center_lastseen_v1';

/* ── 다국어 필드 매핑 ──────────────────────────────────────────────
   notices 의 title/body 는 { ko, en, ja, es, zh } 맵 형태로 저장한다.
   - 현재 언어 → ko 폴백 → 존재하는 첫 값 순으로 선택.
   - 과거 평문 문자열(legacy)도 그대로 허용한다. */
export function pickLocale(value, lang = getCurrentLang()) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return '';

  if (typeof value[lang] === 'string' && value[lang]) return value[lang];
  if (typeof value.ko === 'string' && value.ko) return value.ko;

  const firstFilled = Object.values(value).find((v) => typeof v === 'string' && v);
  return firstFilled || '';
}

/* Firestore Timestamp / Date / number / ISO 문자열을 ms 로 정규화 */
function toMillis(value) {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  return 0;
}

function normalizeNotice(docSnap, lang) {
  const raw = docSnap.data() || {};
  const createdAtMs = toMillis(raw.createdAt) || (raw.createdAtIso ? Date.parse(raw.createdAtIso) || 0 : 0);
  return {
    id: docSnap.id,
    title: pickLocale(raw.title, lang),
    body: pickLocale(raw.body, lang),
    createdAtMs,
    pinned: Boolean(raw.pinned),
  };
}

function normalizeInquiry(docSnap) {
  const raw = docSnap.data() || {};
  const createdAtMs = toMillis(raw.createdAt) || (raw.createdAtIso ? Date.parse(raw.createdAtIso) || 0 : 0);
  const os = raw.os && typeof raw.os === 'object' ? raw.os : {};
  return {
    id: docSnap.id,
    type: raw.type || 'etc',
    content: raw.content || '',
    status: raw.status === 'answered' ? 'answered' : 'pending',
    answer: raw.answer || '',
    userId: raw.userId || '',
    userEmail: raw.userEmail || '',
    appVersion: raw.appVersion || '',
    entryCardId: raw.entryCardId || '',
    locale: raw.locale || '',
    platform: raw.platform || '',
    os: {
      operatingSystem: os.operatingSystem || '',
      osVersion: os.osVersion || '',
      model: os.model || '',
      manufacturer: os.manufacturer || '',
    },
    createdAtMs,
    answeredAtMs: toMillis(raw.answeredAt),
  };
}

function formatStoryLabel(story, fallbackId) {
  if (!story) return fallbackId || '';
  const title = story.title || story.figure_name || '';
  const date = story.publish_date || '';
  return [date, title].filter(Boolean).join(' · ') || fallbackId || '';
}

async function fetchStoryLabel(storyId) {
  if (!storyId || !db) return '';
  try {
    const snap = await getDoc(doc(db, 'stories', storyId));
    return snap.exists() ? formatStoryLabel(snap.data(), storyId) : storyId;
  } catch (err) {
    console.warn('문의 카드 메타 조회 실패:', err);
    return storyId;
  }
}

async function fetchUserLabel(userId, fallbackEmail = '') {
  if (fallbackEmail) return fallbackEmail;
  if (!userId || !db) return '';
  try {
    const snap = await getDoc(doc(db, 'profiles', userId));
    const data = snap.exists() ? snap.data() : null;
    return data?.email || data?.userEmail || userId;
  } catch (err) {
    console.warn('문의 사용자 메타 조회 실패:', err);
    return userId;
  }
}

async function enrichAdminInquiries(items) {
  return Promise.all(items.map(async (item) => {
    const [entryCardLabel, userLabel] = await Promise.all([
      fetchStoryLabel(item.entryCardId),
      fetchUserLabel(item.userId, item.userEmail),
    ]);
    return {
      ...item,
      entryCardLabel: entryCardLabel || item.entryCardId || '',
      userLabel: userLabel || item.userId || '',
    };
  }));
}

/**
 * fetchNotices — 공지사항을 최신순으로 페이지 단위로 로드한다.
 * @param {Object} [opts]
 * @param {number} [opts.pageSize=20]
 * @param {*} [opts.cursor] 이전 페이지 마지막 QueryDocumentSnapshot
 * @returns {Promise<{ items: Array, cursor: *, hasMore: boolean }>}
 */
export async function fetchNotices({ pageSize = PAGE_SIZE, cursor = null } = {}) {
  if (!db) return { items: [], cursor: null, hasMore: false };

  const lang = getCurrentLang();
  const constraints = [orderBy('createdAt', 'desc')];
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(fbLimit(pageSize));

  try {
    const snap = await getDocs(query(collection(db, NOTICES_COL), ...constraints));
    const items = snap.docs.map((d) => normalizeNotice(d, lang));
    const lastDoc = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
    return {
      items,
      cursor: lastDoc,
      hasMore: snap.docs.length === pageSize,
    };
  } catch (err) {
    console.warn('공지 로드 실패:', err);
    return { items: [], cursor: null, hasMore: false };
  }
}

/**
 * fetchMyInquiries — 로그인 사용자 본인의 문의 내역(답변 포함)을 로드한다.
 * uid 가 없으면 Firestore 호출 없이 빈 배열. (게스트/비로그인 가드)
 * @param {string} uid
 * @returns {Promise<Array>}
 */
export async function fetchMyInquiries(uid) {
  if (!uid || !db) return [];

  try {
    const snap = await getDocs(query(
      collection(db, INQUIRIES_COL),
      where('userId', '==', uid),
      orderBy('createdAt', 'desc'),
      fbLimit(MY_INQUIRY_LIMIT),
    ));
    return snap.docs.map(normalizeInquiry);
  } catch (err) {
    console.warn('문의 내역 로드 실패:', err);
    return [];
  }
}

/**
 * fetchAdminInquiries — (어드민 전용) 전체 사용자 문의를 최신순으로 페이지 단위로 로드한다.
 * firestore.rules 상 isAdmin() 만 inquiries 전체를 read 할 수 있다.
 * @param {Object} [opts]
 * @param {number} [opts.pageSize=20]
 * @param {*} [opts.cursor] 이전 페이지 마지막 QueryDocumentSnapshot
 * @returns {Promise<{ items: Array, cursor: *, hasMore: boolean }>}
 */
export async function fetchAdminInquiries({ pageSize = PAGE_SIZE, cursor = null } = {}) {
  if (!db) return { items: [], cursor: null, hasMore: false };

  const constraints = [orderBy('createdAt', 'desc')];
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(fbLimit(pageSize));

  try {
    const snap = await getDocs(query(collection(db, INQUIRIES_COL), ...constraints));
    const items = await enrichAdminInquiries(snap.docs.map(normalizeInquiry));
    const lastDoc = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
    return {
      items,
      cursor: lastDoc,
      hasMore: snap.docs.length === pageSize,
    };
  } catch (err) {
    console.warn('어드민 문의 로드 실패:', err);
    return { items: [], cursor: null, hasMore: false };
  }
}

/* ── unread(읽지 않음) 판정 ──────────────────────────────────────── */

export function getLastSeen() {
  const raw = Number(localStorage.getItem(LAST_SEEN_KEY));
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

export function markAllRead() {
  try {
    localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
  } catch {
    /* 저장 실패는 무시 (best-effort) */
  }
}

/**
 * computeUnreadFromLists — 이미 로드한 목록으로 unread 여부를 계산하는 순수 함수.
 *   - lastSeen 이후 생성된 공지가 있거나
 *   - lastSeen 이후 답변(answered)된 본인 문의가 있으면 true
 */
export function computeUnreadFromLists(notices = [], inquiries = [], lastSeen = getLastSeen()) {
  const hasNewNotice = notices.some((n) => (n?.createdAtMs || 0) > lastSeen);
  const hasNewAnswer = inquiries.some(
    (i) => i?.status === 'answered' && (i?.answeredAtMs || 0) > lastSeen,
  );
  return hasNewNotice || hasNewAnswer;
}

/**
 * checkUnread — 배지 표시용 경량 조회.
 * 최신 공지 1건 + 최신 답변 문의 1건만 읽어 unread 여부를 판정한다(최대 2 read).
 * 인덱스 미구성/네트워크 오류 시 false 로 안전 폴백한다.
 * @param {string} [uid]
 * @returns {Promise<boolean>}
 */
export async function checkUnread(uid) {
  if (!db) return false;
  const lastSeen = getLastSeen();

  try {
    const noticeSnap = await getDocs(query(
      collection(db, NOTICES_COL),
      orderBy('createdAt', 'desc'),
      fbLimit(1),
    ));
    const notices = noticeSnap.docs.map((d) => normalizeNotice(d, getCurrentLang()));
    if (computeUnreadFromLists(notices, [], lastSeen)) return true;

    if (uid) {
      const inquirySnap = await getDocs(query(
        collection(db, INQUIRIES_COL),
        where('userId', '==', uid),
        where('status', '==', 'answered'),
        orderBy('answeredAt', 'desc'),
        fbLimit(1),
      ));
      const inquiries = inquirySnap.docs.map(normalizeInquiry);
      if (computeUnreadFromLists([], inquiries, lastSeen)) return true;
    }
    return false;
  } catch (err) {
    console.warn('unread 조회 실패(무시):', err);
    return false;
  }
}
