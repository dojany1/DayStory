/* =====================================================================
   main.js — DayStory 앱의 시작점 (Entry Point)
   =====================================================================
   이 파일은 앱이 처음 실행될 때 가장 먼저 읽히는 파일입니다.
   역할:
     1) CSS 스타일 파일들을 불러옵니다 (import)
     2) 각 페이지를 URL 경로에 연결합니다 (라우터 등록)
     3) 로그인 없이 게스트로 바로 접속할 수 있게 설정합니다
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
import { auth, db } from './js/firebase.js';

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
import { renderHome } from './js/pages/home.js';

/* ─────────────────────────────────────────────
   섹션 4: 라우트(경로) 등록 및 Lazy Loading 분할
   ─────────────────────────────────────────────
*/
registerRoute('/login', () => import('./js/pages/login.js').then(m => m.renderLogin()));
registerRoute('/signup', () => import('./js/pages/login.js').then(m => m.renderSignup()));
registerRoute('/home', () => renderHome()); /* 홈은 최우선 렌더링을 위해 정적 유지 */
registerRoute('/detail/:id', (params) => import('./js/pages/detail.js').then(m => m.renderDetail(params)));
registerRoute('/archive', () => import('./js/pages/archive.js').then(m => m.renderArchive()));
registerRoute('/search', () => import('./js/pages/search.js').then(m => m.renderSearch()));
registerRoute('/settings', () => import('./js/pages/settings.js').then(m => m.renderSettings()));
registerRoute('/report', () => import('./js/pages/report.js').then(m => m.renderReport()));
registerRoute('/editor', () => import('./js/pages/editor.js').then(m => m.renderEditor()));


/* ─────────────────────────────────────────────
   섹션 5: 페이지 이동 전 실행되는 가드(Guard)
   ─────────────────────────────────────────────
   현재는 로그인을 비활성화하고 게스트 모드로 동작합니다.
*/
const PUBLIC_ROUTES = ['/login', '/signup'];

setBeforeNavigate((path) => {
  /* 게스트 유저 자동 설정: 로그인한 유저가 없으면 게스트로 만듦 */
  let user = getState('user');
  if (!user) {
    user = { id: 'guest', role: 'guest' };
    setState('user', user);
  }

  /* 하단 내비게이션 바 표시/숨김 제어 */
  const nav = document.getElementById('bottom-nav');
  if (nav) {
    const shouldHideNav = path.startsWith('/detail/') || path === '/report' || path === '/login' || path === '/signup';
    nav.style.display = shouldHideNav ? 'none' : 'flex';
  }

  /* 이미 로그인한 유저가 로그인/회원가입 페이지 접근 시 홈으로 리다이렉트 */
  if ((path === '/login' || path === '/signup') && user && user.id !== 'guest') {
    navigate('/home');
    return false;
  }

  return true;
});


/* ─────────────────────────────────────────────
   섹션 6: 앱 로딩 및 인증 상태 변화 감지
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
        });

        /* 프로필 정보 가져오기 (Firestore의 profiles 컬렉션) */
        if (db) {
          try {
            const profileRef = doc(db, 'profiles', firebaseUser.uid);
            const profileSnap = await getDoc(profileRef);
            let profileData = null;

            const ADMIN_EMAILS = ['daystory@test.com', 'dokhubooks@gmail.com'];
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
          navigate('/home');
        }

      } else {
        /* 로그아웃 상태: 게스트로 전환 */
        setState('user', { id: 'guest', role: 'guest' });
        setState('profile', null);

        /* 
         * 로그인 페이지 접근을 방해하지 않도록
         * 이전처럼 무조건 navigate('/home')을 하지 않습니다.
         */
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

  /* 3) Firebase가 설정되지 않은 경우 게스트 모드 적용 및 즉시 준비 완료 표시 */
  if (!auth) {
    setState('user', { id: 'guest', role: 'guest' });
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

/* ─────────────────────────────────────────────
   섹션 9: 네이티브 하드웨어 뒤로가기 버튼 제어 (안드로이드)
   ─────────────────────────────────────────────
*/
if (Capacitor.isNativePlatform()) {
  let lastBackPressTime = 0;

  function showExitToast() {
    const toast = document.createElement('div');
    toast.innerText = '한 번 더 누르시면 종료됩니다.';
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

  App.addListener('backButton', ({ canGoBack }) => {
    const currentPath = getCurrentPath();
    const isRootRoute = currentPath === '/home' || currentPath === '/archive' || currentPath === '/settings' || currentPath === '/search' || currentPath === '/login';

    if (isRootRoute) {
      /* 루트 경로에서는 2번 누르면 종료 */
      const now = new Date().getTime();
      if (now - lastBackPressTime < 2000) {
        App.exitApp();
      } else {
        lastBackPressTime = now;
        showExitToast();
      }
    } else {
      /* 하위 단계에서는 브라우저 뒤로가기 이벤트 발동 */
      window.history.back();
    }
  });
}
