/* =====================================================================
   settings.js — 레거시 설정 페이지
   =====================================================================
   하단 설정 탭은 /profile 을 사용하지만, 기존 진입점 호환을 위해
   /settings 도 공유 설정 섹션을 렌더링합니다.
   ===================================================================== */

import { renderSettingsSections, bindSettingsSections } from '../components/settingsSections.js';
import { renderPageHeader, bindPageHeaderBack } from '../components/pageHeader.js';
import { t } from '../i18n/index.js';

export function renderSettings() {
  const page = document.createElement('div');
  page.className = 'settings-page page';

  page.innerHTML = `
    ${renderPageHeader({ title: t('nav.settings'), backLabel: t('common.back') })}
    <div class="settings-scroll">
      ${renderSettingsSections()}
    </div>
  `;

  bindSettingsSections(page);
  bindPageHeaderBack(page, () => history.back());

  return page;
}
