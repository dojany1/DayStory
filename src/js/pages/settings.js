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
   ===================================================================== */

import { navigate } from '../router.js';
import { getState, setState } from '../state.js';
import { showToast } from '../components/toast.js';
import { supabase } from '../supabase.js';


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
  const currentTheme = getState('theme');
  const currentFontSize = getState('fontSize');
  const profile = getState('profile');

  /* ---- HTML 구조 생성 ---- */
  page.innerHTML = `
    <!-- 페이지 제목 -->
    <div class="page-header">
      <h1 class="page-header-title">설정</h1>
    </div>

    <!-- ===== 알림 섹션 ===== -->
    <div class="settings-section">
      <div class="settings-section-title">알림</div>

      <!-- 푸시 알림 토글 -->
      <div class="list-item" id="setting-notification">
        <div class="list-item-content">
          <div class="list-item-title">푸시 알림</div>
          <div class="list-item-subtitle">매일 새로운 카드 알림</div>
        </div>
        <div class="toggle active" id="toggle-notification"></div>
      </div>

      <!-- 알림 시간 설정 -->
      <div class="list-item" id="setting-noti-time">
        <div class="list-item-content">
          <div class="list-item-title">알림 시간</div>
          <div class="list-item-subtitle">오전 9:00</div>
        </div>
        <div class="list-item-action">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>
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

      <!-- 텍스트 크기 변경 -->
      <div class="list-item" id="setting-fontsize">
        <div class="list-item-content">
          <div class="list-item-title">텍스트 크기</div>
          <div class="list-item-subtitle" id="fontsize-label">${fontSizeLabel(currentFontSize)}</div>
        </div>
        <div class="list-item-action">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>

      <!-- 데이터 절약 토글 -->
      <div class="list-item" id="setting-datasaver">
        <div class="list-item-content">
          <div class="list-item-title">데이터 절약</div>
          <div class="list-item-subtitle">이미지 저화질 로딩</div>
        </div>
        <div class="toggle" id="toggle-datasaver"></div>
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

    <!-- ===== 후원 섹션 ===== -->
    <div class="settings-section">
      <div class="settings-section-title">후원</div>
      <div class="list-item" id="setting-donate">
        <div class="list-item-content">
          <div class="list-item-title">에디터 후원하기</div>
          <div class="list-item-subtitle">커피 한 잔의 응원을 보내세요</div>
        </div>
        <div class="list-item-action">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>
    </div>

    <!-- ===== 계정 섹션 ===== -->
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

    <!-- 앱 버전 정보 -->
    <div style="text-align:center;padding:var(--space-6);color:var(--color-text-tertiary);font-size:var(--text-xs);">
      DayStory v1.0.0
    </div>
  `;


  /* ─────────────────────────────────────────────
     섹션 2: 이벤트 리스너 연결
     ─────────────────────────────────────────────
     setTimeout(fn, 0)을 사용하는 이유:
       renderSettings()가 반환한 DOM이 실제 페이지에 삽입된 "후"에
       이벤트 리스너를 연결해야 합니다. setTimeout(fn, 0)은
       현재 실행 중인 코드가 끝난 뒤에 fn을 실행하므로,
       DOM 삽입이 완료된 시점에 리스너를 연결할 수 있습니다.
  */
  setTimeout(() => {

    /* ---- 푸시 알림 토글 ---- */
    document.getElementById('toggle-notification')?.addEventListener('click', function () {
      this.classList.toggle('active');
      showToast(this.classList.contains('active') ? '알림 켜짐' : '알림 꺼짐', 'success');
    });

    /* ---- 데이터 절약 토글 ---- */
    document.getElementById('toggle-datasaver')?.addEventListener('click', function () {
      this.classList.toggle('active');
      showToast(this.classList.contains('active') ? '데이터 절약 모드 켜짐' : '데이터 절약 모드 꺼짐', 'success');
    });

    /* ---- 테마 순환 (시스템 → 라이트 → 다크 → 시스템 ...) ---- */
    const themes = ['system', 'light', 'dark'];
    document.getElementById('setting-theme')?.addEventListener('click', () => {
      const current = getState('theme');
      const nextIndex = (themes.indexOf(current) + 1) % themes.length;
      const nextTheme = themes[nextIndex];

      setState('theme', nextTheme);
      document.getElementById('theme-label').textContent = themeLabel(nextTheme);
      showToast(`테마: ${themeLabel(nextTheme)}`, 'success');
    });

    /* ---- 글꼴 크기 순환 (작게 → 보통 → 크게 → 작게 ...) ---- */
    const sizes = ['small', 'medium', 'large'];
    document.getElementById('setting-fontsize')?.addEventListener('click', () => {
      const current = getState('fontSize');
      const nextIndex = (sizes.indexOf(current) + 1) % sizes.length;
      const nextSize = sizes[nextIndex];

      setState('fontSize', nextSize);
      document.getElementById('fontsize-label').textContent = fontSizeLabel(nextSize);
      showToast(`텍스트 크기: ${fontSizeLabel(nextSize)}`, 'success');
    });

    /* ---- 에디터 페이지 이동 ---- */
    document.getElementById('setting-editor')?.addEventListener('click', () => {
      navigate('/editor');
    });

    /* ---- 후원 페이지 이동 ---- */
    document.getElementById('setting-donate')?.addEventListener('click', () => {
      navigate('/donate');
    });

    /* ---- 로그아웃 ---- */
    document.getElementById('setting-logout')?.addEventListener('click', async () => {
      try {
        /* 로그아웃 요청 (2초 타임아웃) */
        await Promise.race([
          supabase.auth.signOut(),
          new Promise(resolve => setTimeout(resolve, 2000))
        ]);
      } catch (err) {
        console.warn('로그아웃 오류 (무시됨):', err);
      }

      /* 상태 초기화 */
      setState('user', null);
      setState('profile', null);

      /* 인증 토큰 삭제 */
      try {
        localStorage.removeItem('sb-zfbbljswxwjevpnzbysw-auth-token');
      } catch { /* 무시 */ }

      /* 하단 네비게이션 숨기고 로그인 페이지로 이동 */
      const nav = document.getElementById('bottom-nav');
      if (nav) nav.style.display = 'none';
      window.location.hash = '#/login';
      showToast('로그아웃 되었습니다', 'success');
    });

    /* ---- 회원 탈퇴 (준비중) ---- */
    document.getElementById('setting-withdraw')?.addEventListener('click', () => {
      showToast('회원 탈퇴 기능 (준비중)', 'info');
    });

    /* ---- 알림 시간 설정 (준비중) ---- */
    document.getElementById('setting-noti-time')?.addEventListener('click', () => {
      showToast('알림 시간 설정 (준비중)', 'info');
    });

  }, 0);

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
