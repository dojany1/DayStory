/* =====================================================================
   router.js — 해시(#) 기반 SPA 라우터
   =====================================================================
   SPA(Single Page Application)란?
     페이지를 새로 불러오지 않고, JavaScript로 화면 내용만 바꾸는 방식입니다.
     URL의 # 뒤 부분(해시)을 이용해 "어떤 페이지를 보여줄지" 결정합니다.
   
   예시:
     http://localhost:5173/#/editorstory     → 홈 화면
     http://localhost:5173/#/archive  → 컬렉션 화면
     http://localhost:5173/#/settings → 설정 화면
     http://localhost:5173/#/mystory  → 나의 일화 화면
     http://localhost:5173/#/editor/new → 새 일화 작성 화면
     http://localhost:5173/#/editor/edit/:id → 기존 일화 수정 화면
   ===================================================================== */

/* ─────────────────────────────────────────────
   섹션 1: 변수 선언
   ───────────────────────────────────────────── */

/**
 * routes: URL 경로와 페이지 렌더링 함수를 짝지어 저장하는 Map
 * 예: '/editorstory' → renderEditorStory 함수
 */
const routes = new Map();

/* currentRoute: 현재 표시 중인 페이지 경로 (중복 렌더링 방지용) */
let currentRoute = null;

/* targetRoute: 현재 로딩 중인 페이지 경로 (중복 호출 방지용) */
let targetRoute = null;

/** beforeNavigateHook: 페이지 이동 전에 실행할 함수 (인증 체크 등) */
let beforeNavigateHook = null;

/** onUnmountHook: 현재 페이지를 떠날 때 호출할 cleanup 함수 (리스너 해제 등).
 * 페이지 렌더 함수가 setOnUnmount(fn) 으로 등록하면 다음 라우트로 이동하기 직전에 실행된다.
 * SPA 메모리 누수를 막는 핵심 훅. */
let onUnmountHook = null;

/* Keep-Alive DOM 캐시: 탭 이동 시 DOM을 파괴하지 않고 메모리에 보존해 즉시 복원한다.
 * route -> { node: HTMLElement, savedAt: number, cleanup: Function|null } */
const PAGE_DOM_CACHE = new Map();

const PAGE_CACHE_TTL_MS = 5 * 60 * 1000; // 5분
/* Keep-Alive 비활성 — editorstory/mystory 는 Swiper.js 인스턴스를 유지하는데
   DOM detach → attach 과정에서 Swiper 의 transform 이 reset 되어
   휠/카드가 1월 1일(activeIndex 0) 로 보이는 버그가 발생. 매번 새 마운트로 안정성 확보.
   (fetchStories 는 storiesCachePromise 로 캐싱되어 네트워크 비용 미미.) */
const KEEP_ALIVE_ROUTES = new Set();


/* ─────────────────────────────────────────────
   섹션 2: 라우트 등록 및 네비게이션 함수
   ───────────────────────────────────────────── */

/**
 * registerRoute — 새로운 경로를 등록합니다
 * @param {string} path     - URL 경로 (예: '/editorstory', '/detail/:id')
 * @param {Function} handler - 해당 경로에서 실행할 함수 (페이지를 그리는 함수)
 * 
 * 사용 예시:
 *   registerRoute('/editorstory', () => renderEditorStory());
 */
export function registerRoute(path, handler) {
  routes.set(path, handler);
}

/**
 * setBeforeNavigate — 페이지 이동 전에 실행할 함수를 설정합니다
 * @param {Function} fn - 페이지 경로를 받아서 true/false를 반환하는 함수
 *                        false를 반환하면 페이지 이동이 취소됩니다
 * 
 * 사용 예시:
 *   setBeforeNavigate((path) => {
 *     if (로그인_안됨) return false;  // 이동 차단
 *     return true;                    // 이동 허용
 *   });
 */
export function setBeforeNavigate(fn) {
  beforeNavigateHook = fn;
}

/**
 * setOnUnmount — 현재 페이지가 떠날 때 한 번 실행될 cleanup 함수를 등록합니다.
 * @param {Function|null} fn  cleanup 함수 (또는 null 로 해제)
 *
 * 사용 예시:
 *   export function renderMyPage() {
 *     const onMove = (e) => { ... };
 *     window.addEventListener('mousemove', onMove);
 *     setOnUnmount(() => window.removeEventListener('mousemove', onMove));
 *     return pageElement;
 *   }
 *
 * 동작:
 *   - 다음 라우트로 이동 시 (handleRoute 에서 container 를 비우기 직전)
 *     fn() 이 호출되고 hook 은 null 로 리셋된다.
 *   - 매 페이지 진입마다 새로 등록해야 한다 (자동 누적되지 않음).
 *   - fn 이 throw 해도 라우팅은 계속 진행된다 (try/catch).
 */
export function setOnUnmount(fn) {
  onUnmountHook = (typeof fn === 'function') ? fn : null;
}

/* 내부 전용: 라우터가 떠날 때 호출. fn 이 throw 해도 라우팅 중단 안 함. */
function runOnUnmount() {
  if (!onUnmountHook) return;
  const hook = onUnmountHook;
  onUnmountHook = null;
  try {
    hook();
  } catch (err) {
    console.warn('setOnUnmount cleanup 실패:', err);
  }
}

/**
 * navigate — 다른 페이지로 이동합니다
 * @param {string} path   - 이동할 경로 (예: '/editorstory')
 * @param {Object} params - URL에 붙일 추가 정보 (선택사항)
 * 
 * 사용 예시:
 *   navigate('/editorstory');
 *   navigate('/detail/abc123');
 */
export function navigate(path, params = {}) {
  /* params가 있으면 ?key=value 형태로 URL 뒤에 붙임 */
  const url = path + (Object.keys(params).length
    ? '?' + new URLSearchParams(params).toString()
    : '');
  window.location.hash = url;  /* 해시 변경 → hashchange 이벤트 발생 */
}

/**
 * getParams — 현재 URL의 쿼리 파라미터를 가져옵니다
 * @returns {Object} 파라미터 객체
 * 
 * 예시:
 *   URL이 #/search?q=뉴턴 이면 → { q: '뉴턴' } 반환
 */
export function getParams() {
  const hash = window.location.hash.slice(1);  /* '#' 제거 */
  const [, query] = hash.split('?');
  if (!query) return {};
  return Object.fromEntries(new URLSearchParams(query));
}

/**
 * getCurrentPath — 현재 URL의 경로 부분만 가져옵니다
 * @returns {string} 현재 경로
 * 
 * 예시:
 *   URL이 #/editorstory?tab=1 이면 → '/editorstory' 반환
 */
export function getCurrentPath() {
  const hash = window.location.hash.slice(1) || '/editorstory';
  return hash.split('?')[0];
}


/* ─────────────────────────────────────────────
   섹션 3: 경로 매칭 (내부 함수)
   ───────────────────────────────────────────── */

/**
 * matchRoute — 주어진 경로에 맞는 라우트를 찾습니다 (내부 전용)
 * @param {string} path - 매칭할 경로
 * @returns {Object|null} { handler, params } 또는 null
 * 
 * 동적 경로 매칭 설명:
 *   등록된 경로: '/detail/:id'
 *   실제 URL:    '/detail/abc123'
 *   → params = { id: 'abc123' }
 */
function matchRoute(path) {
  /* 1단계: 정확히 일치하는 경로가 있는지 확인 */
  if (routes.has(path)) {
    return { handler: routes.get(path), params: {} };
  }

  /* 2단계: 동적 패턴 매칭 (예: /detail/:id) */
  for (const [pattern, handler] of routes) {
    const patternParts = pattern.split('/');  /* ['', 'detail', ':id'] */
    const pathParts = path.split('/');        /* ['', 'detail', 'abc123'] */

    /* 부분 개수가 다르면 매칭 실패 */
    if (patternParts.length !== pathParts.length) continue;

    const params = {};
    let match = true;

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        /* :로 시작하면 동적 파라미터 → 실제 값을 저장 */
        params[patternParts[i].slice(1)] = pathParts[i];
      } else if (patternParts[i] !== pathParts[i]) {
        /* 고정 부분이 다르면 매칭 실패 */
        match = false;
        break;
      }
    }

    if (match) return { handler, params };
  }

  return null;  /* 일치하는 라우트 없음 */
}


/* ─────────────────────────────────────────────
   섹션 4: 라우트 처리 (내부 함수)
   ───────────────────────────────────────────── */

/**
 * handleRoute — URL이 변경될 때마다 실행되어 화면을 바꿉니다 (내부 전용)
 * 
 * 동작 순서:
 *   1) 현재 URL 경로 확인
 *   2) 이미 같은 페이지면 스킵
 *   3) beforeNavigate 훅 실행 (페이지 이동 허용 여부 확인)
 *   4) 매칭되는 라우트를 찾아 페이지를 렌더링
 *   5) 하단 내비게이션 바의 활성 상태 업데이트
 */
async function handleRoute() {
  const path = getCurrentPath();

  /* 1) 같은 페이지면 다시 그리지 않음, 현재 로딩 중인 페이지와 같아도 다시 불러오지 않음 */
  if (path === currentRoute || path === targetRoute) return;

  /* 콘텐츠 페이지(editorstory/mystory)에서 다른 페이지로 이동하면 임시 보기 상태 초기화 */
  const CONTENT_ROUTES = new Set(['/editorstory', '/mystory']);
  if (currentRoute && CONTENT_ROUTES.has(currentRoute) && !CONTENT_ROUTES.has(path)) {
    sessionStorage.removeItem('ds_session_view');
  }

  targetRoute = path;

  /* 2) beforeNavigate 훅 실행 (페이지 이동 허용 여부 확인) */
  if (beforeNavigateHook) {
    const canNavigate = await beforeNavigateHook(path);
    /* 비동기 훅 도중 URL이 바뀌었을 가능성 체크 */
    if (path !== getCurrentPath() || path !== targetRoute) return;
    if (canNavigate === false) {
      targetRoute = null;
      return;
    }
  }

  const match = matchRoute(path);
  const container = document.getElementById('page-container');

  /* Keep-Alive 캐시 확인 */
  const isTargetKeepAlive = KEEP_ALIVE_ROUTES.has(path);
  const isCurrentKeepAlive = KEEP_ALIVE_ROUTES.has(currentRoute);
  const targetCached = isTargetKeepAlive ? PAGE_DOM_CACHE.get(path) : null;
  const isCacheValid = targetCached && (Date.now() - targetCached.savedAt < PAGE_CACHE_TTL_MS);

  /* 만료된 캐시가 있으면 cleanup 실행 후 제거 */
  if (isTargetKeepAlive && targetCached && !isCacheValid) {
    try { targetCached.cleanup?.(); } catch(e) {}
    PAGE_DOM_CACHE.delete(path);
  }

  if (isCacheValid) {
    /* ── FAST PATH: 캐시된 DOM 즉시 재연결 ── */
    /* 현재 페이지 처리 */
    if (isCurrentKeepAlive) {
      const currentNode = container.firstElementChild;
      if (currentNode) {
        container.removeChild(currentNode);
        PAGE_DOM_CACHE.set(currentRoute, { node: currentNode, savedAt: Date.now(), cleanup: onUnmountHook });
        onUnmountHook = null;
      }
    } else {
      runOnUnmount();
      container.innerHTML = '';
    }

    container.appendChild(targetCached.node);
    onUnmountHook = targetCached.cleanup ?? null; // cleanup 복원
    currentRoute = path;
    targetRoute = null;

  } else if (match) {
    /* ── NORMAL PATH: 새 페이지 렌더링 ── */

    /* 3) 새 페이지 렌더링 호출 (컨테이너를 비우기 전에 미리 실행하여 Flicker 방지) */
    const pageElement = await match.handler(match.params);

    /* 4) 렌더링 대기 도중 사용자가 다른 페이지를 눌렀을 가능성 체크 */
    if (path !== getCurrentPath() || path !== targetRoute) return;

    /* 5) 현재 페이지 처리: Keep-Alive면 캐시 저장, 아니면 cleanup 실행 */
    if (isCurrentKeepAlive) {
      const currentNode = container.firstElementChild;
      if (currentNode) {
        container.removeChild(currentNode);
        PAGE_DOM_CACHE.set(currentRoute, { node: currentNode, savedAt: Date.now(), cleanup: onUnmountHook });
        onUnmountHook = null;
      }
    } else {
      runOnUnmount();
      container.innerHTML = '';
    }

    currentRoute = path;
    targetRoute = null;

    if (typeof pageElement === 'string') {
      container.innerHTML = pageElement;
    } else if (pageElement instanceof HTMLElement) {
      container.appendChild(pageElement);
    }
  } else {
    /* 일치하는 페이지가 없으면 unmount 후 404 표시 */
    runOnUnmount();
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-title">페이지를 찾을 수 없습니다</div>
      </div>`;
    currentRoute = path;
    targetRoute = null;
  }

  /* 6) 하단 내비게이션 바의 활성 항목 업데이트 및 스크롤 최상단 */
  updateNav(path);
  container.scrollTop = 0;
  requestAnimationFrame(() => { container.scrollTop = 0; }); // WebView 구버전 비동기 복원 방어
}


/**
 * updateNav — 하단 내비게이션 바에서 현재 페이지에 해당하는 버튼을 활성화합니다
 * @param {string} path - 현재 페이지 경로
 */
function updateNav(path) {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    const route = item.dataset.route;  /* HTML의 data-route 속성 */
    item.classList.toggle('active', path.startsWith(route));
  });
}

/* Wave 5: utils/date.js 의 getLocalToday() 로 날짜 문자열은 위임하고
 * month/day 만 router 내부에서 분해해 사용. */
import { getLocalToday } from './utils/date.js';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

function getLocalTodaySelection() {
  const date = getLocalToday();                       /* 'YYYY-MM-DD' */
  const [year, mm, dd] = date.split('-').map(Number);
  return { month: mm, day: dd, date };
}


/* ─────────────────────────────────────────────
   섹션 5: 라우터 초기화 및 유틸리티
   ───────────────────────────────────────────── */

/**
 * initRouter — 라우터를 시작합니다 (앱 시작 시 한 번만 호출)
 * 
 * 동작:
 *   1) 해시 변경 이벤트 리스너 등록
 *   2) 하단 내비게이션 버튼에 클릭 이벤트 연결
 *   3) 현재 URL에 맞는 초기 페이지 표시
 */
export function initRouter() {
  /* SPA가 직접 스크롤을 관리하므로 브라우저 자동 복원을 끔.
     끄지 않으면 hashchange 시 WebView가 #page-container의 이전 scrollTop을
     비동기로 복원해 라우터의 동기 reset을 덮어씌운다. */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* URL 해시가 바뀔 때마다 handleRoute 실행 */
  window.addEventListener('hashchange', handleRoute);

  /* 하단 내비게이션 버튼 클릭 → 해당 경로로 이동 (이벤트 위임 사용) */
  const bottomNav = document.getElementById('bottom-nav');
  if (bottomNav) {
    bottomNav.addEventListener('click', (e) => {
      const item = e.target.closest('.nav-item');
      if (!item) return;

      try { Haptics.impact({ style: ImpactStyle.Light }); } catch (_) { /* 웹 환경 무시 */ }

      const route = item.dataset.route;
      const currentPath = getCurrentPath();

      /* 에디터 일화 탭 재클릭 → 휠을 오늘 날짜로 되돌리기 */
      if (route === '/editorstory' && currentPath === '/editorstory') {
        const today = getLocalTodaySelection();

        const monthItem = document.querySelector(`#editorstory-month-scroll .wheel-item[data-month="${today.month}"]`);
        const dayItem = document.querySelector(`#editorstory-calendar .wheel-item[data-date="${today.date}"]`);

        if (monthItem && !monthItem.classList.contains('active')) {
          monthItem.click();
        } else if (monthItem) {
          monthItem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
        if (dayItem && !dayItem.classList.contains('active')) {
          dayItem.click();
        } else if (dayItem) {
          dayItem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
        return;
      }

      /* 만약 나의 일화 탭인데 이미 나의 일화에 있다면 -> 오늘 날짜로 이동 */
      if (route === '/mystory' && currentPath === '/mystory') {
        const today = getLocalTodaySelection();
        
        const monthItem = document.querySelector(`#mystory-month-scroll .wheel-item[data-month="${today.month}"]`);
        const dayItem = document.querySelector(`#mystory-calendar .wheel-item[data-date="${today.date}"]`);
        
        if (monthItem && !monthItem.classList.contains('active')) {
          monthItem.click();
        } else if (monthItem) {
          monthItem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }

        if (dayItem && !dayItem.classList.contains('active')) {
          dayItem.click();
        } else if (dayItem) {
          dayItem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
        return; // 라우팅 중단
      }

      // 이미 같은 경로: 페이지 최상단으로 스크롤
      if (route === currentPath) {
        const cont = document.getElementById('page-container');
        if (cont) cont.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      navigate(route);
    });
  }

  /* 초기 URL이 없으면 홈으로 설정 */
  if (!window.location.hash) {
    window.location.hash = '/editorstory';
  } else {
    handleRoute();
  }
}

/**
 * forceRoute — 현재 경로를 강제로 다시 렌더링합니다
 * 같은 페이지에서 새로고침 효과가 필요할 때 사용합니다
 */
export function forceRoute() {
  /* 강제 새로고침 시 현재 경로의 DOM 캐시 폐기 */
  if (PAGE_DOM_CACHE.has(currentRoute)) {
    const evicted = PAGE_DOM_CACHE.get(currentRoute);
    try { evicted.cleanup?.(); } catch(e) {}
    PAGE_DOM_CACHE.delete(currentRoute);
  }
  currentRoute = null;
  handleRoute();
}

/**
 * invalidatePageCache — 특정 경로(또는 전체)의 Keep-Alive DOM 캐시를 무효화합니다.
 * CRUD 작업 후 해당 탭을 강제 새로고침해야 할 때 호출합니다.
 * @param {string} [route] - 무효화할 경로. 생략 시 전체 캐시 삭제.
 */
export function invalidatePageCache(route) {
  if (!route) {
    PAGE_DOM_CACHE.forEach(entry => { try { entry.cleanup?.(); } catch(e) {} });
    PAGE_DOM_CACHE.clear();
    return;
  }
  const entry = PAGE_DOM_CACHE.get(route);
  if (entry) {
    try { entry.cleanup?.(); } catch(e) {}
    PAGE_DOM_CACHE.delete(route);
  }
}
