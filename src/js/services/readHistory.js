/* =====================================================================
   readHistory.js — 에디터 일화 "읽음 상태(Read)" service 레이어
   =====================================================================
   기획 목표
     - DB 비용 최소화: 카드를 읽을 때마다 서버에 쓰지 않고, 화면 이탈·
       백그라운드 전환 시 모아서 arrayUnion 으로 1회만 write 한다.
     - 압박감 Zero UX: "안 읽음"에는 어떤 표시도 하지 않는다. 이 모듈은
       오직 "읽음" 날짜만 누적하고, 렌더 측이 isDateRead() 로 dimmed 처리한다.

   데이터
     - 저장 위치: profiles/{uid} 문서의 readHistory 필드(날짜 문자열 배열)
     - 키: 날짜 문자열(iso, 예 '2026-06-10') — 휠/캘린더 셀의 data-date 와 일치
     - 게스트(비로그인): localStorage('ds_read_history') 에만 보관하고,
       로그인 시 initReadHistory() 가 서버 값과 머지해 업로드를 예약한다.

   아키텍처 규칙(CLAUDE.md)
     - Firestore 접근은 이 service 레이어로 모은다(페이지에서 직접 호출 금지).
   ===================================================================== */

import { auth, db } from './firebase.js';
import { doc, setDoc, arrayUnion } from 'firebase/firestore';
import { getState, setState } from '../state.js';

const LS_KEY = 'ds_read_history';

/* readSet: 읽은 모든 날짜 / pendingSet: 아직 서버에 반영 못한 날짜 */
let readSet = new Set();
let pendingSet = new Set();

function loadLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveLocal() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...readSet]));
  } catch {
    /* localStorage 쓰기 실패는 치명적이지 않으므로 무시 */
  }
}

/**
 * initReadHistory — 로그인/앱 시작 시 1회 호출. 서버 profile.readHistory 와
 * 로컬 기록을 합쳐 메모리 상태로 만들고, "로컬에만 있고 서버엔 없는" 날짜는
 * 서버 업로드 대상(pending)으로 예약한다(게스트→로그인 머지).
 * @param {object|null} profile - 전역 profile 객체(readHistory 배열 포함 가능)
 */
export function initReadHistory(profile) {
  const serverDates = Array.isArray(profile?.readHistory) ? profile.readHistory : [];
  const localDates = loadLocal();

  readSet = new Set([...serverDates, ...localDates]);

  const serverSet = new Set(serverDates);
  pendingSet = new Set(localDates.filter((d) => !serverSet.has(d)));

  saveLocal();
}

/**
 * isDateRead — 해당 날짜를 읽었는지 동기 판정(렌더에서 사용, 추가 read 0).
 * @param {string} iso - 날짜 문자열('YYYY-MM-DD')
 * @returns {boolean}
 */
export function isDateRead(iso) {
  return !!iso && readSet.has(iso);
}

/**
 * markDateRead — 카드를 뒷면까지 본 순간 호출(낙관적 반영). 메모리/로컬에
 * 즉시 기록하고 서버 업로드를 예약하되, 여기서 서버 write 는 하지 않는다.
 * 이미 읽은 날짜면 중복 작업을 피하기 위해 no-op.
 * 화면 즉시 갱신을 위해 'ds:read-history-changed' 이벤트를 발행한다.
 * @param {string} iso - 날짜 문자열('YYYY-MM-DD')
 */
/**
 * reflectReadInDom — 읽은 직후 현재 화면에 떠 있는 해당 날짜 요소(날짜 휠·캘린더
 * 셀)에 즉시 '.is-read' 와 aria 를 부여한다. 휠/캘린더 토글, 캘린더 셀 팝업,
 * /calendar 페이지 등 renderGrid 재호출이 없는 경로에서도 새로고침 없이 보이게 한다.
 * @param {string} iso
 */
function reflectReadInDom(iso) {
  if (typeof document === 'undefined') return;
  let els;
  try {
    els = document.querySelectorAll(`.wheel-item[data-date="${iso}"], .cal-cell[data-date="${iso}"]`);
  } catch {
    return; /* 잘못된 셀렉터 등은 무시(상태/로컬은 이미 반영됨) */
  }
  els.forEach((el) => {
    if (el.classList.contains('is-read')) return;
    el.classList.add('is-read');
    if (el.classList.contains('wheel-item')) {
      const { month, day } = el.dataset;
      if (month && day) el.setAttribute('aria-label', `${month}월 ${day}일, 이미 읽음`);
    } else {
      /* 캘린더 셀은 renderGrid 가 만든 기존 라벨(날짜+제목) 끝에 ', 이미 읽음' 부착 */
      const prev = el.getAttribute('aria-label') || '';
      if (!prev.endsWith(', 이미 읽음')) {
        el.setAttribute('aria-label', prev ? `${prev}, 이미 읽음` : '이미 읽음');
      }
    }
  });
}

export function markDateRead(iso) {
  if (!iso || readSet.has(iso)) return;

  readSet.add(iso);
  pendingSet.add(iso);
  saveLocal();
  reflectReadInDom(iso);

  try {
    document.dispatchEvent(new CustomEvent('ds:read-history-changed', { detail: { iso } }));
  } catch {
    /* 이벤트 디스패치 실패는 무시(상태/로컬은 이미 반영됨) */
  }
}

/**
 * flushReadHistory — 예약된(pending) 날짜를 arrayUnion 으로 1회 묶어 서버에
 * 반영한다. 게스트(uid 없음)이거나 보낼 게 없으면 no-op. 실패 시 pending 을
 * 보존해 다음 기회에 재전송한다.
 * @returns {Promise<boolean>} 실제 서버 write 수행 여부
 */
export async function flushReadHistory() {
  const uid = auth?.currentUser?.uid;
  if (!uid || !db || pendingSet.size === 0) return false;

  const dates = [...pendingSet];
  try {
    await setDoc(
      doc(db, 'profiles', uid),
      { readHistory: arrayUnion(...dates) },
      { merge: true },
    );
    pendingSet.clear();

    /* 전역 profile.readHistory 를 최신화해 다른 화면이 일관되게 dimmed 를 본다 */
    const profile = getState('profile');
    if (profile) setState('profile', { ...profile, readHistory: [...readSet] });

    return true;
  } catch (err) {
    console.warn('readHistory flush 실패(보류 유지):', err?.message || err);
    return false;
  }
}

/* ── 전역 flush 트리거(모듈 로드 시 1회) ──────────────────────────────
   라우트와 무관하게 앱이 백그라운드로 가거나 종료될 때 모아둔 읽음을
   서버에 best-effort 로 반영한다. SPA 내 페이지 이동 시 flush 는
   cardDeckController 의 cleanup 에서 별도로 호출한다. */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushReadHistory();
  });
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { void flushReadHistory(); });
}
