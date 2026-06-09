/* =====================================================================
   onboarding.js — 신규 사용자 논블로킹 튜토리얼 상태 매니저
   =====================================================================
   탭별 인트로 모달 확인 여부 / 코치마크 툴팁 확인 여부 / 웰컴 배지 등을
   localStorage 단일 객체(ds_onboarding)로 모아 관리한다.

   설계 원칙:
   - 페이지/컴포넌트는 localStorage 에 직접 접근하지 말고 이 service 만 통과한다
     (Firebase·sanitize 일원화 철학과 동일 — 상태 정책을 한곳에 모은다).
   - localStorage 차단(시크릿 모드 / 일부 WebView)에서도 throw 하지 않도록 전부 try/catch.
   - 차단 환경에서 매 진입마다 모달이 재노출되는 "도배"를 막기 위해
     인메모리 미러(memoryState)를 병행해 한 세션 내 일관성을 보장한다.
   ===================================================================== */

const LS_KEY = 'ds_onboarding';

/* 허용 플래그 화이트리스트 — 오타/문자열 난립 방지. 호출부는 이 상수만 사용한다. */
export const ONBOARDING_FLAGS = {
  INTRO_EDITOR: 'introEditor',          /* '오늘, 역사 속에서' 탭 인트로 모달 확인 */
  INTRO_MYSTORY: 'introMyStory',        /* '나의 일화' 탭 인트로 모달 확인 */
  TIP_CARD_FLIP: 'tipCardFlip',         /* 홈 카드 뒤집기 Pulse·툴팁 확인 */
  TIP_WELCOME_CARD: 'tipWelcomeCard',   /* 보관함 웰컴 카드 축하 툴팁 확인 */
  WELCOME_BADGE: 'welcomeBadgePending', /* 웰컴 카드 'N' 배지 대기 상태 (true=아직 보관함 미방문) */
};

/* 인메모리 미러 — null 이면 아직 localStorage 에서 하이드레이트 전.
   읽기/쓰기 실패 시에도 세션 내 일관성을 유지하는 권위 캐시. */
let memoryState = null;

function readState() {
  if (memoryState) return memoryState;
  try {
    const raw = localStorage.getItem(LS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    memoryState = (parsed && typeof parsed === 'object') ? parsed : {};
  } catch {
    memoryState = {};
  }
  return memoryState;
}

function writeState(next) {
  memoryState = next;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {
    /* 차단 환경 — 인메모리 미러만으로 세션 유지 (도배 방지) */
  }
}

/**
 * hasSeen — 플래그가 기록(=확인)되었는지 여부.
 * @param {string} flag  ONBOARDING_FLAGS 상수 값
 * @returns {boolean}
 */
export function hasSeen(flag) {
  return readState()[flag] === true;
}

/**
 * markSeen — 플래그를 1회 기록(멱등). 이미 true 면 재기록(불필요한 쓰기)하지 않는다.
 * @param {string} flag
 */
export function markSeen(flag) {
  if (!flag) return;
  const state = readState();
  if (state[flag] === true) return;
  writeState({ ...state, [flag]: true });
}

/**
 * clearFlag — 특정 플래그를 제거한다 (예: 보관함 방문 시 배지 대기 해제).
 * @param {string} flag
 */
export function clearFlag(flag) {
  if (!flag) return;
  const state = readState();
  if (!(flag in state)) return;
  const next = { ...state };
  delete next[flag];
  writeState(next);
}

/**
 * resetOnboarding — 전체 초기화 (QA/디버그/로그아웃용).
 */
export function resetOnboarding() {
  memoryState = {};
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* noop */
  }
}

/**
 * _resetMemoryCache — 테스트 전용. 인메모리 미러를 비워
 * 다음 read 가 localStorage 에서 다시 하이드레이트하도록 강제한다.
 */
export function _resetMemoryCache() {
  memoryState = null;
}
