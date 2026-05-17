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
import { auth, db } from '../firebase.js';

/*
 * Firebase 인증 함수 임포트
 * - signInWithEmailAndPassword : 이메일+비밀번호 로그인
 * - createUserWithEmailAndPassword : 이메일+비밀번호 회원가입
 * - signInWithPopup : 팝업으로 소셜 로그인 (Google 등)
 * - GoogleAuthProvider : Google 로그인 제공자
 * - sendPasswordResetEmail : 비밀번호 재설정 이메일 발송
 */
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithCredential,
} from 'firebase/auth';

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

/* Google 로그인 제공자 인스턴스 (앱 전체에서 하나만 있으면 됨) */
const googleProvider = new GoogleAuthProvider();


/* ─────────────────────────────────────────────
   섹션 1: Google 로그인 아이콘 (SVG)
   ───────────────────────────────────────────── */
const googleIcon = `<svg viewBox="0 0 24 24" width="20" height="20"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>`;


/* ─────────────────────────────────────────────
   섹션 2: 로그인 페이지
   ───────────────────────────────────────────── */

export function renderLogin() {
  const page = document.createElement('div');
  page.className = 'auth-page page';

  page.innerHTML = `
    <!-- 닫기 버튼 -->
    <button id="close-login-btn" class="close-auth-btn" aria-label="닫기">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    </button>

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
    /* 닫기 버튼 */
    document.getElementById('close-login-btn')?.addEventListener('click', () => {
      document.getElementById('bottom-nav').style.display = 'flex';
      navigate('/editorstory');
    });

    /* 로그인 폼 제출 처리 */
    const form = document.getElementById('login-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      if (!email || !password) {
        return showToast('이메일과 비밀번호를 입력하세요', 'warning');
      }

      if (!auth) {
        return showToast('Firebase가 설정되지 않았습니다', 'error');
      }

      const btnText = document.getElementById('login-btn-text');
      btnText.textContent = '로그인 중...';

      try {
        /*
         * Firebase 이메일/비밀번호 로그인
         * Supabase: supabase.auth.signInWithPassword({ email, password })
         * Firebase: signInWithEmailAndPassword(auth, email, password)
         */
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;

        /* 로그인 성공: 유저 정보와 프로필 저장 */
        setState('user', { id: firebaseUser.uid, email: firebaseUser.email });

        const ADMIN_EMAILS = ['daystory@test.com', 'dokhubooks@gmail.com', 'ldj729@gmail.com'];
        const isAdmin = ADMIN_EMAILS.includes(firebaseUser.email);
        
        if (db) {
          const profileRef = doc(db, 'profiles', firebaseUser.uid);
          const profileSnap = await getDoc(profileRef);
          let profileData = profileSnap.exists() ? profileSnap.data() : { created_at: new Date().toISOString() };
          
          if (isAdmin && profileData.role !== 'editor') {
            profileData.role = 'editor';
            await setDoc(profileRef, profileData, { merge: true });
          } else if (!profileSnap.exists()) {
            await setDoc(profileRef, profileData);
          }
          
          setState('profile', profileData);
        }

        showToast('로그인 성공!', 'success');
        document.getElementById('bottom-nav').style.display = 'flex';
        navigate('/editorstory');
      } catch (err) {
        showToast(err.message || '로그인 실패', 'error');
        btnText.textContent = '로그인';
      }
    });

    /* Google 로그인 버튼 */
    document.getElementById('google-login-btn')?.addEventListener('click', async () => {
      if (!auth) {
        return showToast('Firebase가 설정되지 않았습니다', 'error');
      }

      try {
        let firebaseUser = null;

        if (Capacitor.isNativePlatform()) {
          /* 네이티브: skipNativeAuth로 Google credential만 받아 Web SDK로 로그인 */
          const result = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
          const idToken = result.credential?.idToken;
          if (!idToken) throw new Error('Google 인증 토큰을 받지 못했습니다.');
          const credential = GoogleAuthProvider.credential(idToken, result.credential?.accessToken);
          const userCredential = await signInWithCredential(auth, credential);
          firebaseUser = userCredential.user;
        } else {
          /* 웹 환경: 기존 가상 팝업 방식 사용 */
          const userCredential = await signInWithPopup(auth, googleProvider);
          firebaseUser = userCredential.user;
        }

        if (!firebaseUser) throw new Error('사용자 정보를 가져올 수 없습니다.');

        setState('user', { id: firebaseUser.uid, email: firebaseUser.email });

        if (db) {
          try {
            const profileRef = doc(db, 'profiles', firebaseUser.uid);
            const profileSnap = await getDoc(profileRef);
            let profileData = profileSnap.exists() ? profileSnap.data() : { created_at: new Date().toISOString() };
            
            const ADMIN_EMAILS = ['daystory@test.com', 'dokhubooks@gmail.com', 'ldj729@gmail.com'];
            const isAdmin = ADMIN_EMAILS.includes(firebaseUser.email);
            
            if (isAdmin && profileData.role !== 'editor') {
              profileData.role = 'editor';
              await setDoc(profileRef, profileData, { merge: true });
            } else if (!profileSnap.exists()) {
              await setDoc(profileRef, profileData);
            }
            
            setState('profile', profileData);
          } catch (err) {
            console.warn('구글 로그인 - 프로필 로드 실패', err);
          }
        }

        showToast('구글 로그인 성공!', 'success');
        document.getElementById('bottom-nav').style.display = 'flex';
        navigate('/editorstory');
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
      if (!auth) return showToast('Firebase가 설정되지 않았습니다', 'error');

      try {
        await sendPasswordResetEmail(auth, email);
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

export function renderSignup() {
  const page = document.createElement('div');
  page.className = 'auth-page page';

  page.innerHTML = `
    <!-- 닫기 버튼 -->
    <button id="close-signup-btn" class="close-auth-btn" aria-label="닫기">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    </button>

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
    /* 닫기 버튼 */
    document.getElementById('close-signup-btn')?.addEventListener('click', () => {
      document.getElementById('bottom-nav').style.display = 'flex';
      navigate('/editorstory');
    });

    const form = document.getElementById('signup-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('signup-email').value.trim();
      const pw1 = document.getElementById('signup-password').value;
      const pw2 = document.getElementById('signup-password2').value;

      if (pw1 !== pw2) {
        return showToast('비밀번호가 일치하지 않습니다', 'error');
      }

      if (!auth) {
        return showToast('Firebase가 설정되지 않았습니다', 'error');
      }

      const btnText = document.getElementById('signup-btn-text');
      btnText.textContent = '가입 중...';

      try {
        /*
         * Firebase 회원가입
         * Supabase: supabase.auth.signUp({ email, password })
         * Firebase: createUserWithEmailAndPassword(auth, email, password)
         *
         * Firebase는 가입 즉시 로그인까지 됩니다.
         * (Supabase는 이메일 인증 후 로그인되는 옵션이 있었음)
         */
        const userCredential = await createUserWithEmailAndPassword(auth, email, pw1);
        const firebaseUser = userCredential.user;

        setState('user', { id: firebaseUser.uid, email: firebaseUser.email });

        const ADMIN_EMAILS = ['daystory@test.com', 'dokhubooks@gmail.com', 'ldj729@gmail.com'];
        const isAdmin = ADMIN_EMAILS.includes(firebaseUser.email);

        if (db) {
          const profileRef = doc(db, 'profiles', firebaseUser.uid);
          const profileSnap = await getDoc(profileRef);
          let profileData = profileSnap.exists() ? profileSnap.data() : { created_at: new Date().toISOString() };
          
          if (isAdmin && profileData.role !== 'editor') {
            profileData.role = 'editor';
            await setDoc(profileRef, profileData, { merge: true });
          } else if (!profileSnap.exists()) {
            await setDoc(profileRef, profileData);
          }
          
          setState('profile', profileData);
        }

        showToast('회원가입 완료!', 'success');
        document.getElementById('bottom-nav').style.display = 'flex';
        navigate('/editorstory');
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
