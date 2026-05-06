/* =====================================================================
   settings.js — 레거시 설정 페이지
   =====================================================================
   하단 설정 탭은 /profile 을 사용하지만, 기존 진입점 호환을 위해
   /settings 도 공유 설정 섹션을 렌더링합니다.
   ===================================================================== */

import { renderSettingsSections, bindSettingsSections } from '../components/settingsSections.js';

export function renderSettings() {
  const page = document.createElement('div');
  page.className = 'settings-page page';

  page.innerHTML = `
    <div class="page-header" style="height: 60px; padding: 0 16px; align-items:center; display:flex; justify-content:flex-start; gap:12px;">
      <button class="settings-back-btn" id="settings-back" style="width:32px; height:32px; padding:0; background:none; border:none; display:flex; align-items:center; justify-content:center; color:var(--color-text-primary); cursor:pointer;" aria-label="뒤로가기">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <h1 class="page-header-title" style="margin:0; font-size:1.2rem; line-height:1;">앱 설정</h1>
    </div>

    ${renderSettingsSections()}
  `;

  bindSettingsSections(page);
  page.querySelector('#settings-back')?.addEventListener('click', () => history.back());

  return page;
}
