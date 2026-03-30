/* ============================================
   DayStory — Auth (Login / Signup) Page
   ============================================ */
import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';
import { setState } from '../state.js';
import { supabase } from '../supabase.js';

/* Google SVG icon */
const googleIcon = `<svg viewBox="0 0 24 24" width="20" height="20"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>`;

export function renderLogin() {
  const page = document.createElement('div');
  page.className = 'auth-page page';
  page.innerHTML = `
    <div class="auth-logo">
      <div class="auth-logo-icon">📜</div>
      <h1 class="auth-logo-title">DayStory</h1>
      <p class="auth-logo-subtitle">매일의 역사 일화</p>
    </div>

    <form class="auth-form" id="login-form">
      <div class="input-group">
        <label class="input-label" for="login-email">이메일</label>
        <input class="input-field" type="email" id="login-email" placeholder="email@example.com" autocomplete="email" required />
      </div>
      <div class="input-group">
        <label class="input-label" for="login-password">비밀번호</label>
        <input class="input-field" type="password" id="login-password" placeholder="비밀번호를 입력하세요" autocomplete="current-password" required />
      </div>
      <button type="submit" class="btn btn-primary btn-full btn-large" id="login-submit">
        <span id="login-btn-text">로그인</span>
      </button>
    </form>

    <div class="auth-divider">또는</div>

    <button class="auth-social-btn" id="google-login-btn">
      ${googleIcon}
      <span>Google로 계속하기</span>
    </button>

    <div class="auth-footer">
      <p>계정이 없으신가요? <button id="goto-signup">회원가입</button></p>
      <p style="margin-top:var(--space-2)"><button id="forgot-pw">비밀번호를 잊으셨나요?</button></p>
    </div>
  `;

  setTimeout(() => {
    const form = document.getElementById('login-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      if (!email || !password) return showToast('이메일과 비밀번호를 입력하세요', 'warning');

      const btnText = document.getElementById('login-btn-text');
      btnText.textContent = '로그인 중...';

      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        setState('user', data.user);
        /* Fetch profile */
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

    document.getElementById('google-login-btn')?.addEventListener('click', async () => {
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin,
          }
        });
        if (error) throw error;
      } catch (err) {
        showToast(err.message || 'Google 로그인 실패', 'error');
      }
    });

    document.getElementById('goto-signup')?.addEventListener('click', () => navigate('/signup'));
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

export function renderSignup() {
  const page = document.createElement('div');
  page.className = 'auth-page page';
  page.innerHTML = `
    <div class="auth-logo">
      <div class="auth-logo-icon">📜</div>
      <h1 class="auth-logo-title">회원가입</h1>
      <p class="auth-logo-subtitle">매일 새로운 역사 카드를 만나보세요</p>
    </div>

    <form class="auth-form" id="signup-form">
      <div class="input-group">
        <label class="input-label" for="signup-email">이메일</label>
        <input class="input-field" type="email" id="signup-email" placeholder="email@example.com" autocomplete="email" required />
      </div>
      <div class="input-group">
        <label class="input-label" for="signup-password">비밀번호</label>
        <input class="input-field" type="password" id="signup-password" placeholder="8자 이상" autocomplete="new-password" minlength="8" required />
      </div>
      <div class="input-group">
        <label class="input-label" for="signup-password2">비밀번호 확인</label>
        <input class="input-field" type="password" id="signup-password2" placeholder="비밀번호를 한번 더 입력하세요" autocomplete="new-password" required />
      </div>
      <label style="display:flex;align-items:flex-start;gap:var(--space-2);font-size:var(--text-sm);color:var(--color-text-secondary);cursor:pointer;">
        <input type="checkbox" id="agree-terms" required style="margin-top:3px;" />
        <span>이용약관 및 개인정보 처리방침에 동의합니다</span>
      </label>
      <button type="submit" class="btn btn-primary btn-full btn-large" id="signup-submit">
        <span id="signup-btn-text">가입하기</span>
      </button>
    </form>

    <div class="auth-footer">
      <p>이미 계정이 있으신가요? <button id="goto-login">로그인</button></p>
    </div>
  `;

  setTimeout(() => {
    const form = document.getElementById('signup-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('signup-email').value.trim();
      const pw1 = document.getElementById('signup-password').value;
      const pw2 = document.getElementById('signup-password2').value;
      if (pw1 !== pw2) return showToast('비밀번호가 일치하지 않습니다', 'error');

      const btnText = document.getElementById('signup-btn-text');
      btnText.textContent = '가입 중...';

      try {
        const { data, error } = await supabase.auth.signUp({ email, password: pw1 });
        if (error) throw error;

        if (data.user && !data.session) {
          showToast('이메일 인증 메일을 확인해주세요!', 'success');
          navigate('/login');
        } else if (data.session) {
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

    document.getElementById('goto-login')?.addEventListener('click', () => navigate('/login'));
  }, 0);

  return page;
}
