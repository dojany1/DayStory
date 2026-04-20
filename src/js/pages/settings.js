/* =====================================================================
   settings.js — 설정 페이지
   =====================================================================
   앱의 각종 설정을 변경할 수 있는 페이지입니다.

   설정 항목:
     - 알림: 푸시 알림 켜기/끄기, 알림 시간 설정
     - 디스플레이: 테마(라이트/다크), 텍스트 크기, 데이터 절약
     - 에디터 도구: 콘텐츠 관리 (에디터 권한 유저만 표시)
     - 후원: 에디터 후원하기
     - 계정: 로그아웃, 회원 탈퇴
   마지막 수정 날짜 : 2026-03-31 20:01
   ===================================================================== */

import { navigate } from '../router.js';
import { getState, setState } from '../state.js';
import { showToast } from '../components/toast.js';
import { auth, db } from '../firebase.js';
import { signOut, deleteUser } from 'firebase/auth';
import { doc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import pkg from '../../../package.json';


/* ─────────────────────────────────────────────
   섹션 1: 설정 페이지 렌더링
   ───────────────────────────────────────────── */

/**
 * renderSettings — 설정 페이지를 생성하고 반환합니다
 * @returns {HTMLElement} 설정 페이지 DOM 요소
 * 
 * 이 함수는 두 단계로 동작합니다:
 *   1) HTML 구조를 만들어 반환 (즉시)
 *   2) setTimeout으로 이벤트 리스너를 연결 (DOM에 삽입된 후)
 */
export function renderSettings() {
  const page = document.createElement('div');
  page.className = 'settings-page page';

  /* 현재 설정값 가져오기 */
  const user = getState('user');
  const currentTheme = getState('theme');
  const currentFontSize = getState('fontSize');
  const profile = getState('profile');

  /* ---- HTML 구조 생성 ---- */
  page.innerHTML = `
    <!-- 페이지 제목 & 뒤로가기 -->
    <div class="page-header" style="height: 60px; padding: 0 16px; align-items:center; display:flex; justify-content:flex-start; gap:12px;">
      <button class="settings-back-btn" onclick="history.back()" style="width:32px; height:32px; padding:0; background:none; border:none; display:flex; align-items:center; justify-content:center; color:var(--color-text-primary); cursor:pointer;">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <h1 class="page-header-title" style="margin:0; font-size:1.2rem; line-height:1;">앱 설정</h1>
    </div>


    <!-- ===== 디스플레이 섹션 ===== -->
    <div class="settings-section">
      <div class="settings-section-title">디스플레이</div>

      <!-- 테마 선택 (UI/UX 개선: 버튼형) -->
      <div class="theme-option-group">
        <div class="theme-option ${currentTheme === 'light' ? 'active' : ''}" data-theme="light">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          <div class="theme-option-label">라이트</div>
        </div>
        <div class="theme-option ${currentTheme === 'dark' ? 'active' : ''}" data-theme="dark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          <div class="theme-option-label">다크</div>
        </div>
        <div class="theme-option ${currentTheme === 'system' ? 'active' : ''}" data-theme="system">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          <div class="theme-option-label">시스템</div>
        </div>
      </div>
    </div>

    <!-- ===== 에디터 도구 섹션 (에디터 권한이 있을 때만 표시) ===== -->
    ${profile && profile.role === 'editor' ? `
    <div class="settings-section">
      <div class="settings-section-title">에디터 도구</div>
      <div class="list-item" id="setting-editor">
        <div class="list-item-content">
          <div class="list-item-title">콘텐츠 관리</div>
          <div class="list-item-subtitle">일화 작성/편집/발행</div>
        </div>
        <div class="list-item-action">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>
    </div>
    ` : ''}


    <!-- ===== 계정 섹션 ===== -->
    ${user && user.id !== 'guest' ? `
    <div class="settings-section">
      <div class="settings-section-title">계정</div>

      <!-- 로그아웃 -->
      <div class="list-item" id="setting-logout">
        <div class="list-item-content">
          <div class="list-item-title" style="color:var(--color-error)">로그아웃</div>
        </div>
      </div>

      <!-- 회원 탈퇴 -->
      <div class="list-item" id="setting-withdraw">
        <div class="list-item-content">
          <div class="list-item-title" style="color:var(--color-text-tertiary)">회원 탈퇴</div>
        </div>
      </div>
    </div>
    ` : ''}

    <!-- ===== 앱 정보 섹션 ===== -->
    <div class="settings-section">
      <div class="settings-section-title">앱 정보</div>
      <div class="list-item" id="setting-tutorial">
        <div class="list-item-content">
          <div class="list-item-title">튜토리얼 다시 보기</div>
        </div>
        <div class="list-item-action">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>
      <div class="list-item" id="setting-license">
        <div class="list-item-content">
          <div class="list-item-title">이미지 출처 및 라이선스</div>
        </div>
        <div class="list-item-action">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>
    </div>

    <!-- 개인정보처리방침 -->
    <div style="text-align:center; margin-top:var(--space-8); margin-bottom:-12px;">
      <a href="https://0729.notion.site/336c0180451480a4b0a8c60dba754daf?source=copy_link" target="_blank" rel="noopener noreferrer" style="color:var(--color-text-tertiary); font-size:var(--text-xs); text-decoration:underline; opacity:0.8;">
        개인정보처리방침
      </a>
    </div>

    <!-- 앱 버전 정보 -->
    <div style="text-align:center;padding:var(--space-6);color:var(--color-text-tertiary);font-size:var(--text-xs);">
      DayStory v${pkg.version}
    </div>
  `;


  /* ─────────────────────────────────────────────
     섹션 2: 이벤트 리스너 연결
     ─────────────────────────────────────────────
     생성된 page 요소 내부(scope)에서만 요소를 찾아 리스너를 연결합니다.
     이 방식은 전역 document를 검색하는 것보다 안전하며 중복 등록을 방지합니다.
  */


  /* ---- 테마 직접 선택 (UI/UX 개선) ---- */
  page.querySelectorAll('.theme-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const selectedTheme = btn.dataset.theme;
      setState('theme', selectedTheme);

      // UI 업데이트: 모든 옵션에서 active 제거 후 선택한 버튼에만 추가
      page.querySelectorAll('.theme-option').forEach(el => el.classList.remove('active'));
      btn.classList.add('active');

      showToast(`테마: ${themeLabel(selectedTheme)}`, 'success');
    });
  });

  /* ---- 에디터 페이지 이동 ---- */
  page.querySelector('#setting-editor')?.addEventListener('click', () => {
    navigate('/editor');
  });

  /* ---- 튜토리얼 다시보기 ---- */
  page.querySelector('#setting-tutorial')?.addEventListener('click', () => {
    localStorage.setItem('swipe_tutorial_step', '0');
    showToast('튜토리얼 초기화', 'success');
    navigate('/editorstory');
  });

  /* ---- 이미지 출처 안내 ---- */
  page.querySelector('#setting-license')?.addEventListener('click', () => {
    navigate('/license');
  });


  /* ---- 로그아웃 ---- */
  page.querySelector('#setting-logout')?.addEventListener('click', async () => {
    try {
      /*
       * Firebase 로그아웃 (2초 타임아웃)
       * Supabase: supabase.auth.signOut()
       * Firebase: signOut(auth)
       */
      if (auth) {
        await Promise.race([
          signOut(auth),
          new Promise(resolve => setTimeout(resolve, 2000))
        ]);
      }
    } catch (err) {
      console.warn('로그아웃 오류 (무시됨):', err);
    }

    /* 상태 초기화 */
    setState('user', null);
    setState('profile', null);

    /* 하단 네비게이션 숨기고 로그인 페이지로 이동 */
    const nav = document.getElementById('bottom-nav');
    if (nav) nav.style.display = 'none';
    window.location.hash = '#/login';
    showToast('로그아웃 되었습니다', 'success');
  });

  /* ---- 회원 탈퇴 ---- */
  page.querySelector('#setting-withdraw')?.addEventListener('click', async () => {
    if (!auth || !auth.currentUser) return;

    // 안전장치: 사용자에게 영구 삭제 경고 및 의사 묻기
    const isConfirmed = confirm('정말로 회원을 탈퇴하시겠습니까?\\n모든 정보(북마크, 설정 등)가 즉시 삭제되며 복구할 수 없습니다.');
    if (!isConfirmed) return;

    try {
      const u = auth.currentUser;
      const uid = u.uid;

      // 1) Firestore 데이터 삭제 (프로필 및 북마크)
      if (db) {
        try {
          await deleteDoc(doc(db, 'profiles', uid));
          const q = query(collection(db, 'bookmarks'), where('user_id', '==', uid));
          const snap = await getDocs(q);
          snap.forEach(d => deleteDoc(d.ref));
        } catch (dbErr) {
          console.warn('DB 데이터 삭제 실패 (일부 무시됨):', dbErr);
        }
      }

      // 2) Auth 계정 영구 삭제
      await deleteUser(u);

      showToast('회원 탈퇴가 완료되었습니다.', 'success');

      // 3) 상태 초기화 및 홈으로 이동
      setState('user', null);
      setState('profile', null);
      const nav = document.getElementById('bottom-nav');
      if (nav) nav.style.display = 'flex'; // 탈퇴 후 홈으로 가므로 네비 보이기
      navigate('/editorstory');

    } catch (err) {
      console.error('회원 탈퇴 실패:', err);
      if (err.code === 'auth/requires-recent-login' || err.code === 'auth/user-token-expired') {
        showToast('보안 정책에 따라 다시 로그인한 뒤 탈퇴하실 수 있습니다.', 'error');
        // 재로그인을 유도하기 위해 설정 상태를 지우고 로그인 창으로 보냄
        setState('user', null);
        const nav = document.getElementById('bottom-nav');
        if (nav) nav.style.display = 'none';
        navigate('/login');
      } else {
        showToast(err.message || '회원 탈퇴 처리 중 오류가 발생했습니다.', 'error');
      }
    }
  });


  return page;
}


/* ─────────────────────────────────────────────
   섹션 3: 라벨 변환 유틸리티 함수
   ───────────────────────────────────────────── */

/**
 * themeLabel — 테마 코드를 한국어 라벨로 변환합니다
 * @param {string} theme - 'system', 'light', 'dark'
 * @returns {string} 한국어 라벨
 */
function themeLabel(theme) {
  return { system: '시스템 설정', light: '라이트', dark: '다크' }[theme];
}

/**
 * fontSizeLabel — 폰트 크기 코드를 한국어 라벨로 변환합니다
 * @param {string} size - 'small', 'medium', 'large'
 * @returns {string} 한국어 라벨
 */
function fontSizeLabel(size) {
  return { small: '작게', medium: '보통', large: '크게' }[size];
}
