/* =====================================================================
   login.js — 로그인 / 회원가입 페이지
   =====================================================================
   이메일+비밀번호 로그인과 Google 소셜 로그인을 지원합니다.
   현재는 게스트 모드로 동작하므로 이 페이지는 접근되지 않지만,
   나중에 인증을 다시 활성화하면 사용됩니다.
   
   페이지:
     - renderLogin()  : 로그인 페이지
     - renderSignup() : 회원가입 페이지
   ===================================================================== */

import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';
import { setState } from '../state.js';
import { supabase } from '../supabase.js';


/* ─────────────────────────────────────────────
   섹션 1: Google 로그인 아이콘 (SVG)
   ─────────────────────────────────────────────
   Google의 공식 로고 색상을 사용한 SVG 아이콘입니다.
   파란색(#4285F4), 초록색(#34A853), 노란색(#FBBC05), 빨간색(#EA4335)
*/
const googleIcon = `<svg viewBox="0 0 24 24" width="20" height="20"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>`;


/* ─────────────────────────────────────────────
   섹션 2: 로그인 페이지
   ───────────────────────────────────────────── */

/**
 * renderLogin — 로그인 페이지를 생성합니다
 * @returns {HTMLElement} 로그인 페이지 DOM 요소
 * 
 * 구성:
 *   - DayStory 로고
 *   - 이메일/비밀번호 입력 폼
 *   - Google 소셜 로그인 버튼
 *   - 회원가입/비밀번호 찾기 링크
 */
export function renderLogin() {
  const page = document.createElement('div');
  page.className = 'auth-page page';

  page.innerHTML = `
    <!-- 로고 영역 -->
    <div class="auth-logo" style="margin-bottom: var(--space-6);">
      <h1 class="auth-logo-title" style="margin: 0;">DayStory</h1>
      <p class="auth-logo-subtitle" style="margin-top: 5px;">매일의 역사 일화</p>
    </div>

    <!-- 로그인 폼 -->
    <form class="auth-form" id="login-form">
      <div class="input-group">
        <label class="input-label" for="login-email">이메일</label>
        <input class="input-field" type="email" id="login-email"
               placeholder="email@example.com" autocomplete="email" required />
      </div>
      <div class="input-group">
        <label class="input-label" for="login-password">비밀번호</label>
        <input class="input-field" type="password" id="login-password"
               placeholder="비밀번호를 입력하세요" autocomplete="current-password" required />
      </div>
      <button type="submit" class="btn btn-primary btn-full btn-large" id="login-submit">
        <span id="login-btn-text">로그인</span>
      </button>
    </form>

    <!-- 구분선 -->
    <div class="auth-divider">또는</div>

    <!-- Google 소셜 로그인 -->
    <button class="auth-social-btn" id="google-login-btn">
      ${googleIcon}
      <span>Google로 계속하기</span>
    </button>

    <!-- 하단 링크 -->
    <div class="auth-footer">
      <p>계정이 없으신가요? <button id="goto-signup">회원가입</button></p>
      <p style="margin-top:var(--space-2)"><button id="forgot-pw">비밀번호를 잊으셨나요?</button></p>
    </div>
  `;

  /* ---- 이벤트 리스너 연결 ---- */
  setTimeout(() => {
    /* 로그인 폼 제출 처리 */
    const form = document.getElementById('login-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();  /* 기본 폼 제출 동작 방지 (페이지 새로고침 방지) */

      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      if (!email || !password) {
        return showToast('이메일과 비밀번호를 입력하세요', 'warning');
      }

      const btnText = document.getElementById('login-btn-text');
      btnText.textContent = '로그인 중...';

      try {
        /* Supabase 이메일/비밀번호 로그인 */
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        /* 로그인 성공: 유저 정보와 프로필 저장 */
        setState('user', data.user);
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
        setState('profile', profile);

        showToast('로그인 성공!', 'success');
        document.getElementById('bottom-nav').style.display = 'flex';
        navigate('/home');
      } catch (err) {
        showToast(err.message || '로그인 실패', 'error');
        btnText.textContent = '로그인';
      }
    });

    /* Google 로그인 버튼 */
    document.getElementById('google-login-btn')?.addEventListener('click', async () => {
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin }
        });
        if (error) throw error;
      } catch (err) {
        showToast(err.message || 'Google 로그인 실패', 'error');
      }
    });

    /* 회원가입 페이지로 이동 */
    document.getElementById('goto-signup')?.addEventListener('click', () => navigate('/signup'));

    /* 비밀번호 재설정 이메일 발송 */
    document.getElementById('forgot-pw')?.addEventListener('click', async () => {
      const email = document.getElementById('login-email').value.trim();
      if (!email) return showToast('이메일을 먼저 입력하세요', 'warning');

      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        showToast('비밀번호 재설정 이메일이 발송되었습니다', 'success');
      } catch (err) {
        showToast(err.message || '이메일 발송 실패', 'error');
      }
    });
  }, 0);

  return page;
}


/* ─────────────────────────────────────────────
   섹션 3: 회원가입 페이지
   ───────────────────────────────────────────── */

/**
 * renderSignup — 회원가입 페이지를 생성합니다
 * @returns {HTMLElement} 회원가입 페이지 DOM 요소
 * 
 * 구성:
 *   - 이메일/비밀번호/비밀번호확인 입력 폼
 *   - 이용약관 동의 체크박스
 *   - 가입하기 버튼
 *   - 로그인 페이지 링크
 */
export function renderSignup() {
  const page = document.createElement('div');
  page.className = 'auth-page page';

  page.innerHTML = `
    <!-- 로고 영역 -->
    <div class="auth-logo" style="margin-bottom: var(--space-6);">
      <h1 class="auth-logo-title" style="margin: 0;">회원가입</h1>
      <p class="auth-logo-subtitle" style="margin-top: 5px;">매일 새로운 역사 카드를 만나보세요</p>
    </div>

    <!-- 회원가입 폼 -->
    <form class="auth-form" id="signup-form">
      <div class="input-group">
        <label class="input-label" for="signup-email">이메일</label>
        <input class="input-field" type="email" id="signup-email"
               placeholder="email@example.com" autocomplete="email" required />
      </div>
      <div class="input-group">
        <label class="input-label" for="signup-password">비밀번호</label>
        <input class="input-field" type="password" id="signup-password"
               placeholder="8자 이상" autocomplete="new-password" minlength="8" required />
      </div>
      <div class="input-group">
        <label class="input-label" for="signup-password2">비밀번호 확인</label>
        <input class="input-field" type="password" id="signup-password2"
               placeholder="비밀번호를 한번 더 입력하세요" autocomplete="new-password" required />
      </div>

      <!-- 이용약관 동의 -->
      <label style="display:flex;align-items:flex-start;gap:var(--space-2);font-size:var(--text-sm);color:var(--color-text-secondary);cursor:pointer;">
        <input type="checkbox" id="agree-terms" required style="margin-top:3px;" />
        <span>이용약관 및 개인정보 처리방침에 동의합니다</span>
      </label>

      <button type="submit" class="btn btn-primary btn-full btn-large" id="signup-submit">
        <span id="signup-btn-text">가입하기</span>
      </button>
    </form>

    <!-- 하단 링크 -->
    <div class="auth-footer">
      <p>이미 계정이 있으신가요? <button id="goto-login">로그인</button></p>
    </div>
  `;

  /* ---- 이벤트 리스너 연결 ---- */
  setTimeout(() => {
    const form = document.getElementById('signup-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('signup-email').value.trim();
      const pw1 = document.getElementById('signup-password').value;
      const pw2 = document.getElementById('signup-password2').value;

      /* 비밀번호 일치 확인 */
      if (pw1 !== pw2) {
        return showToast('비밀번호가 일치하지 않습니다', 'error');
      }

      const btnText = document.getElementById('signup-btn-text');
      btnText.textContent = '가입 중...';

      try {
        /* Supabase 회원가입 */
        const { data, error } = await supabase.auth.signUp({ email, password: pw1 });
        if (error) throw error;

        if (data.user && !data.session) {
          /* 이메일 인증이 필요한 경우 */
          showToast('이메일 인증 메일을 확인해주세요!', 'success');
          navigate('/login');
        } else if (data.session) {
          /* 바로 로그인된 경우 */
          setState('user', data.user);
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
          setState('profile', profile);
          showToast('회원가입 완료!', 'success');
          document.getElementById('bottom-nav').style.display = 'flex';
          navigate('/home');
        }
      } catch (err) {
        showToast(err.message || '회원가입 실패', 'error');
        btnText.textContent = '가입하기';
      }
    });

    /* 로그인 페이지로 이동 */
    document.getElementById('goto-login')?.addEventListener('click', () => navigate('/login'));
  }, 0);

  return page;
}
