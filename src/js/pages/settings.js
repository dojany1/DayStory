/* ============================================
   DayStory — Settings Page
   ============================================ */
import { navigate } from '../router.js';
import { getState, setState } from '../state.js';
import { showToast } from '../components/toast.js';
import { supabase } from '../supabase.js';

export function renderSettings() {
  const page = document.createElement('div');
  page.className = 'settings-page page';

  const currentTheme = getState('theme');
  const currentFontSize = getState('fontSize');
  const profile = getState('profile');

  page.innerHTML = `
    <div class="page-header">
      <h1 class="page-header-title">설정</h1>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">알림</div>
      <div class="list-item" id="setting-notification">
        <div class="list-item-icon">🔔</div>
        <div class="list-item-content">
          <div class="list-item-title">푸시 알림</div>
          <div class="list-item-subtitle">매일 새로운 카드 알림</div>
        </div>
        <div class="toggle active" id="toggle-notification"></div>
      </div>
      <div class="list-item" id="setting-noti-time">
        <div class="list-item-icon">⏰</div>
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

    <div class="settings-section">
      <div class="settings-section-title">디스플레이</div>
      <div class="list-item" id="setting-theme">
        <div class="list-item-icon">🎨</div>
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
      <div class="list-item" id="setting-fontsize">
        <div class="list-item-icon">🔤</div>
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
      <div class="list-item" id="setting-datasaver">
        <div class="list-item-icon">📶</div>
        <div class="list-item-content">
          <div class="list-item-title">데이터 절약</div>
          <div class="list-item-subtitle">이미지 저화질 로딩</div>
        </div>
        <div class="toggle" id="toggle-datasaver"></div>
      </div>
    </div>

    ${profile && profile.role === 'editor' ? `
    <div class="settings-section">
      <div class="settings-section-title">에디터 도구</div>
      <div class="list-item" id="setting-editor">
        <div class="list-item-icon">✍️</div>
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

    <div class="settings-section">
      <div class="settings-section-title">후원</div>
      <div class="list-item" id="setting-donate">
        <div class="list-item-icon">☕</div>
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

    <div class="settings-section">
      <div class="settings-section-title">계정</div>
      <div class="list-item" id="setting-logout">
        <div class="list-item-icon">🚪</div>
        <div class="list-item-content">
          <div class="list-item-title" style="color:var(--color-error)">로그아웃</div>
        </div>
      </div>
      <div class="list-item" id="setting-withdraw">
        <div class="list-item-icon">⚠️</div>
        <div class="list-item-content">
          <div class="list-item-title" style="color:var(--color-text-tertiary)">회원 탈퇴</div>
        </div>
      </div>
    </div>

    <div style="text-align:center;padding:var(--space-6);color:var(--color-text-tertiary);font-size:var(--text-xs);">
      DayStory v1.0.0
    </div>
  `;

  setTimeout(() => {
    /* Toggle notification */
    document.getElementById('toggle-notification')?.addEventListener('click', function() {
      this.classList.toggle('active');
      showToast(this.classList.contains('active') ? '알림 켜짐' : '알림 꺼짐', 'success');
    });

    /* Toggle data saver */
    document.getElementById('toggle-datasaver')?.addEventListener('click', function() {
      this.classList.toggle('active');
      showToast(this.classList.contains('active') ? '데이터 절약 모드 켜짐' : '데이터 절약 모드 꺼짐', 'success');
    });

    /* Theme cycling */
    const themes = ['system', 'light', 'dark'];
    document.getElementById('setting-theme')?.addEventListener('click', () => {
      const current = getState('theme');
      const nextIdx = (themes.indexOf(current) + 1) % themes.length;
      setState('theme', themes[nextIdx]);
      document.getElementById('theme-label').textContent = themeLabel(themes[nextIdx]);
      showToast(`테마: ${themeLabel(themes[nextIdx])}`, 'success');
    });

    /* Font size cycling */
    const sizes = ['small', 'medium', 'large'];
    document.getElementById('setting-fontsize')?.addEventListener('click', () => {
      const current = getState('fontSize');
      const nextIdx = (sizes.indexOf(current) + 1) % sizes.length;
      setState('fontSize', sizes[nextIdx]);
      document.getElementById('fontsize-label').textContent = fontSizeLabel(sizes[nextIdx]);
      showToast(`텍스트 크기: ${fontSizeLabel(sizes[nextIdx])}`, 'success');
    });

    /* Editor */
    document.getElementById('setting-editor')?.addEventListener('click', () => {
      navigate('/editor');
    });

    /* Donate */
    document.getElementById('setting-donate')?.addEventListener('click', () => {
      navigate('/donate');
    });

    /* Logout */
    document.getElementById('setting-logout')?.addEventListener('click', async () => {
      await supabase.auth.signOut();
      setState('user', null);
      setState('profile', null);
      document.getElementById('bottom-nav').style.display = 'none';
      navigate('/login');
      showToast('로그아웃 되었습니다', 'success');
    });

    /* Withdraw */
    document.getElementById('setting-withdraw')?.addEventListener('click', () => {
      showToast('회원 탈퇴 기능 (준비중)', 'info');
    });

    /* Notification time */
    document.getElementById('setting-noti-time')?.addEventListener('click', () => {
      showToast('알림 시간 설정 (준비중)', 'info');
    });
  }, 0);

  return page;
}

function themeLabel(theme) {
  return { system: '시스템 설정', light: '라이트', dark: '다크' }[theme];
}

function fontSizeLabel(size) {
  return { small: '작게', medium: '보통', large: '크게' }[size];
}
