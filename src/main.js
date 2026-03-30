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
   다른 JS 파일에서 만들어 둔 함수들을 가져옵니다.
   - router.js  : URL 주소에 따라 페이지를 바꿔주는 라우터
   - state.js   : 앱 전체에서 공유하는 데이터 저장소
   - supabase.js: 백엔드(데이터베이스) 연결 클라이언트
*/
import { registerRoute, initRouter, navigate, setBeforeNavigate } from './js/router.js';
import { getState, setState, applyTheme } from './js/state.js';
import { supabase } from './js/supabase.js';


/* ─────────────────────────────────────────────
   섹션 3: 페이지 렌더링 함수 불러오기
   ─────────────────────────────────────────────
   각 페이지를 화면에 그려주는 함수들입니다.
   예) renderHome() → 홈 화면의 HTML을 만들어 반환
*/
import { renderLogin, renderSignup } from './js/pages/login.js';
import { renderHome } from './js/pages/home.js';
import { renderDetail } from './js/pages/detail.js';
import { renderArchive } from './js/pages/archive.js';
import { renderSearch } from './js/pages/search.js';
import { renderSettings } from './js/pages/settings.js';
import { renderDonate } from './js/pages/donate.js';
import { renderReport } from './js/pages/report.js';
import { renderEditor } from './js/pages/editor.js';


/* ─────────────────────────────────────────────
   섹션 4: 라우트(경로) 등록
   ─────────────────────────────────────────────
   "이 URL이면 → 이 페이지를 보여줘" 라는 규칙을 등록합니다.
   
   예시:
     registerRoute('/home', () => renderHome())
     → 사용자가 #/home 주소로 가면 renderHome() 함수가 실행됨

   :id 는 동적 파라미터입니다.
     /detail/abc123 → params.id 에 'abc123'이 들어옴
*/
registerRoute('/login',       () => renderLogin());
registerRoute('/signup',      () => renderSignup());
registerRoute('/home',        () => renderHome());
registerRoute('/detail/:id',  (params) => renderDetail(params));
registerRoute('/archive',     () => renderArchive());
registerRoute('/search',      () => renderSearch());
registerRoute('/settings',    () => renderSettings());
registerRoute('/donate',      () => renderDonate());
registerRoute('/report',      () => renderReport());
registerRoute('/editor',      () => renderEditor());


/* ─────────────────────────────────────────────
   섹션 5: 페이지 이동 전 실행되는 가드(Guard)
   ─────────────────────────────────────────────
   setBeforeNavigate()에 함수를 넣으면,
   페이지가 바뀔 때마다 "먼저" 이 함수가 실행됩니다.

   현재는 로그인을 비활성화하고 게스트 모드로 동작합니다:
   - 로그인/회원가입 페이지로 가려 하면 → 홈으로 돌려보냄
   - 누구나 게스트 유저로 자동 설정됨
   - 하단 내비게이션 바의 표시/숨김을 제어함
*/
const PUBLIC_ROUTES = ['/login', '/signup'];

setBeforeNavigate((path) => {
  /* 게스트 유저 자동 설정: 로그인한 유저가 없으면 게스트로 만듦 */
  const user = getState('user') || { id: 'guest', role: 'guest' };
  setState('user', user);

  /* 하단 내비게이션 바 표시/숨김 제어 */
  const nav = document.getElementById('bottom-nav');
  if (nav) {
    /* 상세 페이지, 후원, 신고 페이지에서는 하단 바를 숨김 */
    const shouldHideNav = path.startsWith('/detail/')
                       || path === '/donate'
                       || path === '/report';
    nav.style.display = shouldHideNav ? 'none' : 'flex';
  }

  /* 로그인/회원가입 페이지 접근 차단 → 홈으로 리다이렉트 */
  if (path === '/login' || path === '/signup') {
    navigate('/home');
    return false;  /* false를 반환하면 원래 페이지 이동이 취소됨 */
  }

  return true;  /* true를 반환하면 정상적으로 페이지 이동 */
});


/* ─────────────────────────────────────────────
   섹션 6: Supabase 인증 상태 변화 감지
   ─────────────────────────────────────────────
   Supabase(백엔드)에서 로그인/로그아웃 이벤트가 발생하면
   자동으로 이 콜백 함수가 호출됩니다.

   - SIGNED_IN  : 로그인 성공 시 → 유저 정보 저장, 홈으로 이동
   - SIGNED_OUT : 로그아웃 시 → 게스트로 전환, 홈으로 이동
*/
supabase.auth.onAuthStateChange(async (event, session) => {
  try {
    if (event === 'SIGNED_IN' && session) {
      /* 로그인 성공: 유저 정보를 앱 상태에 저장 */
      setState('user', session.user);

      /* 프로필 정보 가져오기 (테마, 폰트 크기 등) */
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        setState('profile', profile);
        if (profile.theme) setState('theme', profile.theme);
        if (profile.font_size) setState('fontSize', profile.font_size);
      }

      /* 하단 내비게이션 표시 후 홈으로 이동 */
      const nav = document.getElementById('bottom-nav');
      if (nav) nav.style.display = 'flex';

      const currentHash = window.location.hash;
      if (currentHash === '#/login' || currentHash === '#/signup' || !currentHash) {
        navigate('/home');
      }

    } else if (event === 'SIGNED_OUT') {
      /* 로그아웃: 게스트로 전환 */
      setState('user', { id: 'guest', role: 'guest' });
      setState('profile', null);

      const nav = document.getElementById('bottom-nav');
      if (nav) nav.style.display = 'flex';
      navigate('/home');
    }
  } catch (err) {
    console.warn('인증 상태 변경 중 오류:', err);
  }
});


/* ─────────────────────────────────────────────
   섹션 7: 앱 초기화 함수
   ─────────────────────────────────────────────
   initApp()은 앱이 시작될 때 한 번만 실행됩니다.
   
   순서:
     1) 테마(라이트/다크) 적용
     2) 기존 로그인 세션이 있는지 확인 (3초 제한)
     3) 스플래시 화면을 숨기고 실제 앱 화면을 표시
     4) 라우터를 시작해서 현재 URL에 맞는 페이지 표시
*/
async function initApp() {
  /* 1) 저장된 테마 설정 적용 */
  applyTheme();

  /* 2) 기존에 로그인한 세션이 있는지 확인 */
  try {
    /* 3초 안에 응답이 없으면 타임아웃으로 건너뜀 */
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('세션 확인 시간 초과')), 3000)
    );
    const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);

    if (session) {
      /* 기존 세션이 있으면 유저 정보 복원 */
      setState('user', session.user);

      /* 프로필을 백그라운드에서 가져옴 (앱 시작을 막지 않음) */
      supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
        .then(({ data: profile }) => {
          if (profile) {
            setState('profile', profile);
            if (profile.theme) setState('theme', profile.theme);
            if (profile.font_size) setState('fontSize', profile.font_size);
          }
        })
        .catch(() => { /* 프로필 로드 실패해도 앱은 계속 동작 */ });
    }
  } catch (err) {
    console.warn('세션 확인 실패, 게스트로 시작합니다:', err.message);
  }

  /* 3) 스플래시 화면 → 메인 화면 전환 */
  const splash = document.getElementById('splash-screen');
  const appContainer = document.getElementById('app-container');

  /* 1.2초 후에 스플래시를 숨기고 앱을 보여줌 */
  setTimeout(() => {
    if (appContainer) appContainer.style.display = 'flex';

    if (splash) {
      splash.classList.add('hide');  /* CSS 트랜지션으로 페이드아웃 */
      splash.addEventListener('transitionend', () => splash.remove());
      /* 혹시 트랜지션이 안 끝나면 0.5초 후 강제 제거 */
      setTimeout(() => { if (splash.parentNode) splash.remove(); }, 500);
    }

    /* 4) 라우터 시작 → 현재 URL에 맞는 페이지 표시 */
    initRouter();
  }, 1200);
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
