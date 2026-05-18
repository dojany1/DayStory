/* =====================================================================
   state.js — 앱 전역 상태 관리자 (Pub/Sub 패턴)
   =====================================================================
   "상태(State)"란?
     앱 전체에서 공유해야 하는 데이터를 말합니다.
     예: 현재 로그인한 유저 정보, 선택한 테마, 글꼴 크기 등

   "Pub/Sub 패턴"이란?
     - setState()로 값이 바뀌면 (Publish, 발행)
     - subscribe()로 등록해둔 함수들이 자동 실행됩니다 (Subscribe, 구독)
     
   사용 예시:
     setState('theme', 'dark');        → 테마를 다크로 변경
     getState('theme');                → 'dark' 반환
     subscribe('theme', (newVal) => {  → 테마가 바뀔 때마다 실행
       console.log('테마 변경:', newVal);
     });
   ===================================================================== */


/* ─────────────────────────────────────────────
   섹션 1: 상태 데이터 초기값 정의
   ─────────────────────────────────────────────
   앱에서 사용하는 모든 공유 데이터의 초기값입니다.
   localStorage에서 이전에 저장한 테마/폰트 설정을 불러옵니다.
*/
const state = {
  user: null,           /* 로그인한 유저 정보 (게스트일 수도 있음) */
  profile: null,        /* 유저의 프로필 정보 (역할, 닉네임 등) */
  todayStory: null,     /* 오늘의 역사 일화 데이터 */
  currentStory: null,   /* 현재 보고 있는 일화 데이터 */
  stories: [],          /* 전체 일화 목록 */
  bookmarks: [],        /* 북마크한 일화 목록 */
  isLoading: false,     /* 로딩 중인지 여부 */
  theme: localStorage.getItem('ds_theme') || 'system',      /* 테마: 'light', 'dark', 'system' */
  fontSize: localStorage.getItem('ds_fontSize') || 'medium', /* 글꼴 크기: 'small', 'medium', 'large' */
  lang: localStorage.getItem('ds_lang') || null,            /* 언어: 'ko' | 'en' | 'ja' (null이면 i18n init이 navigator.language로 추정) */
};

/**
 * listeners: 상태 변경을 감지할 콜백 함수들을 저장하는 Map
 * 구조: { key이름: Set([함수1, 함수2, ...]) }
 */
const listeners = new Map();


/* ─────────────────────────────────────────────
   섹션 2: 상태 읽기/쓰기/구독 함수
   ───────────────────────────────────────────── */

/**
 * getState — 상태 값을 읽어옵니다
 * @param {string} key - 읽을 상태의 이름 (예: 'user', 'theme')
 * @returns {*} 해당 키의 값, 키가 없으면 전체 상태 복사본 반환
 */
export function getState(key) {
  return key ? state[key] : { ...state };
}

/**
 * setState — 상태 값을 변경합니다
 * @param {string} key   - 변경할 상태의 이름
 * @param {*}      value - 새로운 값
 * 
 * 동작 순서:
 *   1) 기존 값을 저장해둠
 *   2) 새 값으로 덮어씀
 *   3) 해당 키를 구독 중인 함수들에게 알림 (Publish)
 *   4) 테마/폰트 크기는 localStorage에도 저장 (새로고침 후에도 유지)
 */
export function setState(key, value) {
  const oldValue = state[key];
  state[key] = value;

  /* 구독자(listener)들에게 변경 사실 알림 */
  if (listeners.has(key)) {
    listeners.get(key).forEach(callbackFn => callbackFn(value, oldValue));
  }

  /* 테마, 폰트 크기, 언어는 브라우저에 영구 저장 */
  if (key === 'theme') localStorage.setItem('ds_theme', value);
  if (key === 'fontSize') localStorage.setItem('ds_fontSize', value);
  if (key === 'lang' && value) localStorage.setItem('ds_lang', value);
}

/**
 * subscribe — 특정 상태가 변경될 때 실행할 함수를 등록합니다
 * @param {string}   key - 감시할 상태의 이름
 * @param {Function} fn  - 값이 바뀔 때 실행할 콜백 함수
 * @returns {Function} 구독 해제 함수 (더 이상 알림 받고 싶지 않을 때 호출)
 * 
 * 사용 예시:
 *   const unsubscribe = subscribe('theme', (newTheme) => {
 *     console.log('테마 변경됨:', newTheme);
 *   });
 *   unsubscribe();  // ← 구독 해제
 */
export function subscribe(key, fn) {
  if (!listeners.has(key)) {
    listeners.set(key, new Set());
  }
  listeners.get(key).add(fn);

  /* 구독 해제 함수 반환 */
  return () => listeners.get(key).delete(fn);
}


/* ─────────────────────────────────────────────
   섹션 3: 테마 적용 함수
   ─────────────────────────────────────────────
   HTML의 <html> 태그에 data-theme 속성을 설정합니다.
   CSS에서 [data-theme="dark"] 선택자로 다크 모드 스타일을 적용합니다.
*/

/**
 * applyTheme — 현재 테마와 폰트 크기를 화면에 적용합니다
 * 
 * - 'system' 테마: 운영체제(OS)의 다크 모드 설정을 따라감
 * - 'light' / 'dark': 직접 지정
 */
export function applyTheme() {
  const currentTheme = state.theme;
  const root = document.documentElement;  /* <html> 태그 */

  if (currentTheme === 'system') {
    /* OS의 다크 모드 설정 확인 */
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', currentTheme);
  }

  /* 폰트 크기도 함께 적용 */
  root.setAttribute('data-font-size', state.fontSize);
}


/* ─────────────────────────────────────────────
   섹션 4: 초기 설정 및 OS 테마 변경 감지
   ─────────────────────────────────────────────
   파일이 로드되는 즉시 테마를 적용하고,
   이후 테마/폰트가 바뀔 때마다 자동으로 다시 적용되게 합니다.
*/
applyTheme();
subscribe('theme', applyTheme);
subscribe('fontSize', applyTheme);

/* OS 시스템 테마(다크모드/라이트모드)가 실시간으로 변경될 때 즉각 반영하기 위한 리스너 */
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (state.theme === 'system') applyTheme();
});
