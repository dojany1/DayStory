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
    <!-- 페이지 제목 -->
    <div class="page-header">
      <h1 class="page-header-title">설정</h1>
    </div>

    <!-- ===== 로그인 사용자 정보 섹션 ===== -->
    <div class="settings-user-info" style="margin: 0 var(--space-4) var(--space-6) var(--space-4); padding: var(--space-4); background: var(--color-bg-secondary); border-radius: var(--radius-lg);">
      ${user && user.id !== 'guest' ? `
        <div style="display:flex; align-items:center; gap: var(--space-4);">
          <div style="width:50px; height:50px; background:var(--color-border); border-radius:50%; display:flex; justify-content:center; align-items:center; font-size:1.5rem;">
            👤
          </div>
          <div>
            <div style="font-size:var(--text-lg); font-weight:600; color:var(--color-text-primary); display:flex; align-items:center; gap:8px;">
              ${user.displayName || (user.email ? user.email.split('@')[0] : '사용자')}
              ${profile && profile.role === 'editor' ? '<span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: var(--color-accent); color: white; margin-left: var(--space-1);">관리자</span>' : ''}
            </div>
            <div style="font-size:var(--text-sm); color:var(--color-text-tertiary);">
              ${user.email || '이메일 정보 없음'}
            </div>
          </div>
        </div>
      ` : `
        <div style="display:flex; align-items:center; gap: var(--space-4); margin-bottom: var(--space-4);">
          <div style="width:50px; height:50px; background:var(--color-border); border-radius:50%; display:flex; justify-content:center; align-items:center; font-size:1.5rem;">
            👋
          </div>
          <div>
            <div style="font-size:var(--text-lg); font-weight:600; color:var(--color-text-primary);">
              게스트 모드
            </div>
            <div style="font-size:var(--text-sm); color:var(--color-text-tertiary);">
              로그인하고 기록을 저장하세요
            </div>
          </div>
        </div>
        <button id="goto-login-btn" class="btn btn-primary" style="width:100%; padding: 8px 16px; font-size: var(--text-sm);">
          로그인 / 회원가입 하러 가기
        </button>
      `}
    </div>


    <!-- ===== 디스플레이 섹션 ===== -->
    <div class="settings-section">
      <div class="settings-section-title">디스플레이</div>

      <!-- 테마 변경 (클릭할 때마다 시스템→라이트→다크 순환) -->
      <div class="list-item" id="setting-theme">
        <div class="list-item-content">
          <div class="list-item-title">테마</div>
          <div class="list-item-subtitle" id="theme-label">${themeLabel(currentTheme)}</div>
        </div>
        <div class="list-item-action">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
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

    <!-- 앱 버전 정보 -->
    <div style="text-align:center;padding:var(--space-6);color:var(--color-text-tertiary);font-size:var(--text-xs);">
      DayStory v1.0.0
    </div>
  `;


  /* ─────────────────────────────────────────────
     섹션 2: 이벤트 리스너 연결
     ─────────────────────────────────────────────
     생성된 page 요소 내부(scope)에서만 요소를 찾아 리스너를 연결합니다.
     이 방식은 전역 document를 검색하는 것보다 안전하며 중복 등록을 방지합니다.
  */


  /* ---- 상단 로그인 버튼 (게스트용) ---- */
  page.querySelector('#goto-login-btn')?.addEventListener('click', () => {
    navigate('/login');
  });

  /* ---- 테마 순환 (시스템 → 라이트 → 다크 → 시스템 ...) ---- */
  const themes = ['system', 'light', 'dark'];
  page.querySelector('#setting-theme')?.addEventListener('click', () => {
    const current = getState('theme');
    const nextIndex = (themes.indexOf(current) + 1) % themes.length;
    const nextTheme = themes[nextIndex];

    setState('theme', nextTheme);
    const themeLabelEl = page.querySelector('#theme-label');
    if (themeLabelEl) themeLabelEl.textContent = themeLabel(nextTheme);
    showToast(`테마: ${themeLabel(nextTheme)}`, 'success');
  });

  /* ---- 에디터 페이지 이동 ---- */
  page.querySelector('#setting-editor')?.addEventListener('click', () => {
    navigate('/editor');
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
      navigate('/home');

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
