/* =====================================================================
   main.js — DayStory 앱의 시작점 (Entry Point)
   =====================================================================
   이 파일은 앱이 처음 실행될 때 가장 먼저 읽히는 파일입니다.
   역할:
     1) CSS 스타일 파일들을 불러옵니다 (import)
     2) 각 페이지를 URL 경로에 연결합니다 (라우터 등록)
     3) 비로그인 사용자는 /login 으로 강제 이동 (v1.4.0 이후 게스트 모드 제거)
     4) 스플래시 화면(로딩 화면)을 보여준 뒤 앱을 시작합니다
   ===================================================================== */


/* ─────────────────────────────────────────────
   섹션 1: CSS 스타일 불러오기
   ─────────────────────────────────────────────
   import로 CSS 파일을 불러오면 Vite(빌드 도구)가
   자동으로 HTML에 <link> 태그를 삽입해줍니다.
   순서가 중요합니다: variables → base → components → pages
*/
import './css/variables.css';   /* 색상, 폰트, 간격 등의 디자인 변수(토큰) */
import './css/base.css';        /* 전체 레이아웃, 하단 내비게이션, 스플래시 화면 */
import './css/components.css';  /* 버튼, 입력창, 카드, 토글 등 재사용 부품 */
import './css/pages.css';       /* 홈, 로그인, 설정 등 각 페이지별 스타일 */


/* ─────────────────────────────────────────────
   섹션 2: 핵심 모듈(기능) 불러오기
   ─────────────────────────────────────────────
   - router.js  : URL 주소에 따라 페이지를 바꿔주는 라우터
   - state.js   : 앱 전체에서 공유하는 데이터 저장소
   - firebase.js: 백엔드(Firebase) 연결 설정
*/
import { registerRoute, initRouter, navigate, setBeforeNavigate, getCurrentPath } from './js/router.js';
import { getState, setState, applyTheme } from './js/state.js';
import { initI18n } from './js/i18n/index.js';
import { auth, db } from './js/firebase.js';
import pkg from '../package.json';

/* 부팅 시 즉시 언어 감지 — 라우트 등록 이전에 실행되어야 모든 페이지가 t()를 안전하게 사용 가능 */
initI18n();

/* 스플래시 화면 하단에 현재 빌드 버전 표시 — 사라지기 전 사용자에게 노출 */
{
  const versionEl = document.getElementById('splash-version');
  if (versionEl) versionEl.textContent = `DayStory v${pkg.version}`;
}

/*
 * Firebase Auth 함수 임포트
 * - onAuthStateChanged : 로그인/로그아웃 상태가 바뀔 때 자동 호출되는 리스너
 */
import { onAuthStateChanged } from 'firebase/auth';

/*
 * Firestore 함수 임포트
 * - doc    : 특정 문서(예: 유저 프로필)를 가리키는 참조
 * - getDoc : 해당 문서의 데이터를 가져옴
 * - setDoc : 문서를 생성하거나 덮어씀
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';

/* Capacitor App 플러그인 (안드로이드 뒤로가기 제어 등 네이티브 통신) */
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';


/* ─────────────────────────────────────────────
   섹션 3: 메인 홈 화면만 사전에 로딩
   ─────────────────────────────────────────────
   빠른 초기 구동을 위해 홈페이지만 먼저 불러오고, 나머지는 클릭 시(지연 로딩) 가져옵니다.
*/
import { renderEditorStory } from './js/pages/editorstory.js';
import { getLocalToday } from './js/utils/date.js';
import { checkForAppUpdate } from './js/services/appUpdate.js';

function registerImageCacheWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('/daystory-image-cache-sw.js').catch((err) => {
    console.warn('Image cache worker registration skipped:', err);
  });
}

registerImageCacheWorker();


/* ─────────────────────────────────────────────
   섹션 4: 라우트(경로) 등록 및 Lazy Loading 분할
   ─────────────────────────────────────────────
*/
registerRoute('/login', () => import('./js/pages/login.js').then(m => m.renderLogin()));
registerRoute('/signup', () => import('./js/pages/login.js').then(m => m.renderSignup()));
registerRoute('/editorstory', () => renderEditorStory()); /* 에디터 일화는 최우선 렌더링을 위해 정적 유지 */
registerRoute('/detail/:id', (params) => import('./js/pages/detail.js').then(m => m.renderDetail(params)));
/* SNS 공유 링크(/share/:id) — detail 페이지로 매핑하면서 "받은 카드" 목록에 자동 추가 */
registerRoute('/share/:id', async (params) => {
  const [{ recordReceived }, m] = await Promise.all([
    import('./js/services/receivedCards.js'),
    import('./js/pages/detail.js'),
  ]);
  recordReceived(params.id);
  return m.renderDetail(params);
});
registerRoute('/profile', () => import('./js/pages/profile.js').then(m => m.renderProfile()));
registerRoute('/search', () => import('./js/pages/search.js').then(m => m.renderSearch()));
registerRoute('/settings', () => import('./js/pages/settings.js').then(m => m.renderSettings()));
registerRoute('/report', () => import('./js/pages/report.js').then(m => m.renderReport()));
registerRoute('/editor', () => import('./js/pages/editor.js').then(m => m.renderEditor()));
registerRoute('/editor/new', () => import('./js/pages/editor.js').then(m => m.renderEditorNew()));
registerRoute('/mystory', () => import('./js/pages/mystory.js').then(m => m.renderMyStory()));
registerRoute('/mystory/new', () => import('./js/pages/mystory.js').then(m => m.renderMyStoryNew()));
registerRoute('/bookmarks', () => import('./js/pages/bookmarks.js').then(m => m.renderBookmarks()));
registerRoute('/license', () => import('./js/pages/license.js').then(m => m.renderLicense()));
registerRoute('/about', () => import('./js/pages/about.js').then(m => m.renderAbout()));


/* ─────────────────────────────────────────────
   섹션 5: 페이지 이동 전 실행되는 가드(Guard)
   ─────────────────────────────────────────────
   v1.4.0 이후: 로그인 필수 강제. 비로그인 사용자는 /login 으로 보냄.
   PUBLIC_ROUTES 만 비로그인 상태에서 접근 가능.
*/
const PUBLIC_ROUTES = ['/login', '/signup'];

setBeforeNavigate((path) => {
  const user = getState('user');
  const isAuthed = !!(user && user.id);

  /* 하단 내비게이션 바 표시/숨김 제어 */
  const nav = document.getElementById('bottom-nav');
  if (nav) {
    const shouldHideNav = !isAuthed || path.startsWith('/detail/') || path === '/report' || path === '/login' || path === '/signup' || path === '/license' || path === '/settings' || path === '/about' || path === '/mystory/new';
    nav.style.display = shouldHideNav ? 'none' : 'flex';
  }

  /* 비로그인 사용자가 공개 경로 외 접근 시 → /login 강제 */
  if (!isAuthed && !PUBLIC_ROUTES.includes(path)) {
    navigate('/login');
    return false;
  }

  /* 이미 로그인한 유저가 로그인/회원가입 페이지 접근 시 홈으로 리다이렉트 */
  if (isAuthed && PUBLIC_ROUTES.includes(path)) {
    navigate('/editorstory');
    return false;
  }

  return true;
});


/* ─────────────────────────────────────────────
   섹션 6: Android 홈 화면 위젯 딥링크 처리
   ───────────────────────────────────────────── */
let pendingWidgetDeepLinkUrl = null;

function routeWidgetDeepLink(url) {
  if (!url) return false;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'daystory:') return false;

  const target = [parsed.hostname, parsed.pathname.replace(/^\/+/, '')]
    .filter(Boolean)
    .join('/');

  if (url === 'daystory://letter' || target === 'letter') {
    navigate('/editorstory');
    return true;
  }

  if (url === 'daystory://diary/new' || target === 'diary/new') {
    const today = getLocalToday();
    navigate(`/mystory/new?date=${today}`);
    return true;
  }

  return false;
}

function queueOrRouteWidgetDeepLink(url) {
  if (!url) return;
  if (!isAppStarted) {
    pendingWidgetDeepLinkUrl = url;
    return;
  }
  routeWidgetDeepLink(url);
}

/* ─────────────────────────────────────────────
   섹션 7: 앱 로딩 및 인증 상태 변화 감지
   ─────────────────────────────────────────────
*/
let isAuthReady = false;
let isDomReady = false;
let isAppStarted = false;

/* DOM 준비와 인증 확인이 끝나면 스플래시 화면을 숨기고 앱을 시작하는 함수 */
function checkAndStartApp() {
  if (isAppStarted) return;
  if (!isAuthReady || !isDomReady) return;
  isAppStarted = true;

  const splash = document.getElementById('splash-screen');
  const appContainer = document.getElementById('app-container');

  if (appContainer) appContainer.style.display = 'flex';

  if (splash) {
    splash.classList.add('hide');  /* CSS 트랜지션으로 페이드아웃 */
    splash.addEventListener('transitionend', () => splash.remove());
    /* 혹시 트랜지션이 안 끝나면 0.5초 후 강제 제거 */
    setTimeout(() => { if (splash.parentNode) splash.remove(); }, 500);
  }

  /* 라우터 시작 → 현재 URL에 맞는 페이지 표시 */
  initRouter();
  if (pendingWidgetDeepLinkUrl) {
    const url = pendingWidgetDeepLinkUrl;
    pendingWidgetDeepLinkUrl = null;
    routeWidgetDeepLink(url);
  }

  /* 부팅 직후 1회 — 신규 버전 출시 안내 (비동기, fire-and-forget).
     내부에서 모든 실패를 흡수하므로 await 불필요 + 부팅을 절대 막지 않는다. */
  void checkForAppUpdate();
}

if (auth) {
  onAuthStateChanged(auth, async (firebaseUser) => {
    try {
      if (firebaseUser) {
        /* 로그인 상태: 유저 정보를 앱 상태에 저장 */
        setState('user', {
          id: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL || null,
        });

        /* 프로필 정보 가져오기 (Firestore의 profiles 컬렉션) */
        if (db) {
          try {
            const profileRef = doc(db, 'profiles', firebaseUser.uid);
            const profileSnap = await getDoc(profileRef);
            let profileData = null;

            const ADMIN_EMAILS = ['daystory@test.com', 'dokhubooks@gmail.com', 'ldj729@gmail.com'];
            const isAdmin = ADMIN_EMAILS.includes(firebaseUser.email);

            if (profileSnap.exists()) {
              profileData = profileSnap.data();
              if (isAdmin && profileData.role !== 'editor') {
                profileData.role = 'editor';
                await setDoc(profileRef, profileData, { merge: true });
              }
            } else if (isAdmin) {
              /* 어드민 특권: 해당 이메일은 자동으로 에디터 권한 부여 (처음 로그인 시 DB에 생성) */
              profileData = { role: 'editor', created_at: new Date().toISOString() };
              await setDoc(profileRef, profileData);
            }

            if (profileData) {
              setState('profile', profileData);
              if (profileData.theme) setState('theme', profileData.theme);
              if (profileData.font_size) setState('fontSize', profileData.font_size);
            }


          } catch (err) {
            console.warn('프로필 로드 (또는 생성) 실패:', err);
          }
        }

        /* 하단 내비게이션 표시 후 홈으로 이동 */
        const nav = document.getElementById('bottom-nav');
        if (nav) nav.style.display = 'flex';

        const currentHash = window.location.hash;
        if (currentHash === '#/login' || currentHash === '#/signup' || !currentHash) {
          navigate('/editorstory');
        }

      } else {
        /* 로그아웃 상태: user/profile 클리어 후 /login 으로 강제 이동.
           가드(setBeforeNavigate)에서도 한 번 더 막지만, 인증 상태 변경 직후
           바로 /login 으로 보내야 빈 화면이 노출되지 않는다. */
        setState('user', null);
        setState('profile', null);

        const nav = document.getElementById('bottom-nav');
        if (nav) nav.style.display = 'none';

        const currentHash = window.location.hash;
        if (currentHash !== '#/login' && currentHash !== '#/signup') {
          navigate('/login');
        }
      }
    } catch (err) {
      console.warn('인증 상태 변경 중 오류:', err);
    } finally {
      /* 인증 상태 확인 (프로필 조회 포함) 완료 처리 */
      isAuthReady = true;
      checkAndStartApp();
    }
  });
}


/* ─────────────────────────────────────────────
   섹션 7: 앱 초기화 함수
   ─────────────────────────────────────────────
*/
async function initApp() {
  /* 1) 저장된 테마 설정 적용 */
  applyTheme();

  /* 2) DOM 트리가 모두 로드되었음을 표시 */
  isDomReady = true;

  /* 3) Firebase가 설정되지 않은 경우 — 로그인 자체 불가. user는 null 유지, /login 가드가 처리 */
  if (!auth) {
    setState('user', null);
    isAuthReady = true;
  }
  
  /* 두 가지(DOM, Auth)가 다 준비되었는지 체크하고 앱 실행 */
  checkAndStartApp();

  /* 네트워크 지연 등으로 인증 응답이 너무 늦어질 경우를 대비해 5초 후 강제 실행 */
  setTimeout(() => {
    if (!isAppStarted) {
      console.warn('인증 응답 지연으로 강제 시작합니다.');
      isAuthReady = true;
      checkAndStartApp();
    }
  }, 5000);
}


/* ─────────────────────────────────────────────
   섹션 8: 앱 실행
   ─────────────────────────────────────────────
   HTML이 아직 로딩 중이면 → DOMContentLoaded 이벤트를 기다림
   이미 로딩 완료되었으면 → 즉시 initApp() 실행
*/
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

if (Capacitor.isNativePlatform()) {
  App.addListener('appUrlOpen', ({ url }) => {
    queueOrRouteWidgetDeepLink(url);
  });

  App.getLaunchUrl()
    .then((launch) => queueOrRouteWidgetDeepLink(launch?.url))
    .catch((err) => console.warn('위젯 딥링크 확인 실패:', err));

  /* (v1.4.0 정리) RevenueCat 미연결로 syncSubscriptionState 호출 제거 — ReferenceError 잔존 방지 */
}

/* ─────────────────────────────────────────────
   섹션 9: 네이티브 하드웨어 뒤로가기 버튼 제어 (안드로이드)
   ─────────────────────────────────────────────
   라우팅 뎁스(Depth) 구조:
     Depth 0 : /editorstory   (에디터 일화 — 최상위, 2회 터치 시 앱 종료)
     Depth 1 : /login         (로그인 → 홈으로)
     Depth 1 : /bookmarks     (북마크 탭 → 홈으로)
     Depth 1 : /search        (검색 탭 → 홈으로)
     Depth 1 : /settings      (설정 탭 → 홈으로)
     Depth 2 : /detail/:id    (카드 정보 → history.back, 진입 경로 다양)
     Depth 2 : /report        (신고 → 카드 정보로, history.back 사용)
     Depth 2 : /editor        (콘텐츠 관리 → 설정으로)
     Depth 3 : (에디터 내 새 일화 작성 등은 에디터 내부에서 처리)

   특수 케이스:
     - Depth 0(홈) → 2초 내 연속 2회 터치 시 앱 종료
*/
if (Capacitor.isNativePlatform()) {

  /**
   * ROUTE_DEPTH_MAP — 각 라우트의 뎁스와 부모 경로를 정의합니다.
   * 
   * depth  : 해당 화면이 몇 번째 깊이인지 (0이 가장 바깥)
   * parent : 뒤로가기 시 이동할 부모 경로
   *          null이면 최상위(홈)이므로 더 이상 뒤로 갈 곳이 없음
   */
  const ROUTE_DEPTH_MAP = {
    '/editorstory': { depth: 0, parent: null },
    '/login':       { depth: 1, parent: '/editorstory' },
    '/mystory':     { depth: 1, parent: '/editorstory' },
    '/bookmarks':   { depth: 1, parent: '/editorstory' },
    '/search':      { depth: 1, parent: '/editorstory' },
    '/settings':    { depth: 1, parent: '/editorstory' },
    '/detail':   { depth: 2, parent: null },          /* history.back()으로 처리 (홈/검색/북마크 등 다양한 진입 경로) */
    '/report':   { depth: 2, parent: null },       /* history.back()으로 처리 (직전 detail 페이지) */
    '/editor':   { depth: 2, parent: '/settings' },
    '/editor/new': { depth: 3, parent: '/editor' },
  };

  /**
   * getRouteInfo — 현재 경로에서 뎁스 정보를 가져옵니다.
   * 동적 경로(예: /detail/abc123)도 처리합니다.
   * 
   * @param {string} path - 현재 라우트 경로
   * @returns {{ depth: number, parent: string|null }}
   */
  function getRouteInfo(path) {
    /* 1) 정확히 일치하는 경로 검색 */
    if (ROUTE_DEPTH_MAP[path]) {
      return ROUTE_DEPTH_MAP[path];
    }

    /* 2) 동적 경로 처리: /detail/abc123 → /detail 로 매칭 */
    const basePath = '/' + path.split('/').filter(Boolean)[0];
    if (ROUTE_DEPTH_MAP[basePath]) {
      return ROUTE_DEPTH_MAP[basePath];
    }

    /* 3) 맵에 없는 경로는 Depth 1로 간주 (에디터 일화으로 이동) */
    return { depth: 1, parent: '/editorstory' };
  }

  /* 마지막으로 뒤로가기를 누른 시각 (앱 종료용 더블 탭 판별) */
  let lastBackPressTime = 0;

  /**
   * showExitToast — "한 번 더 누르면 종료됩니다" 토스트 메시지를 표시합니다.
   * 2초 후 자동으로 사라집니다.
   */
  function showExitToast() {
    const toast = document.createElement('div');
    toast.innerText = '한 번 더 눌러 종료';
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '100px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'rgba(0,0,0,0.7)',
      color: 'white',
      padding: '12px 24px',
      borderRadius: '24px',
      zIndex: '10000',
      fontSize: 'var(--text-sm)',
      fontFamily: 'var(--font-sans)',
      pointerEvents: 'none',
      transition: 'opacity 0.3s ease'
    });
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  /* ── 메인 리스너: 안드로이드 하드웨어 뒤로가기 버튼 ── */
  App.addListener('backButton', () => {
    const currentPath = getCurrentPath();
    const routeInfo = getRouteInfo(currentPath);

    /* ② Depth 0 (홈) → 2초 내 2회 터치로 앱 종료 */
    if (routeInfo.depth === 0) {
      const now = Date.now();
      if (now - lastBackPressTime < 2000) {
        App.exitApp();
      } else {
        lastBackPressTime = now;
        showExitToast();
      }
      return;
    }

    /* ③ Depth 1 이상 → 부모 경로로 이동 */
    if (routeInfo.parent) {
      navigate(routeInfo.parent);
    } else {
      /* parent가 null인 경우(예: /report) → 브라우저 히스토리 뒤로가기 */
      window.history.back();
    }
  });
}
