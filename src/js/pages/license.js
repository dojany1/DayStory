/* =====================================================================
   license.js — 이미지 출처 안내 페이지
   =====================================================================
   발행된 카드 일화들 중 이미지 출처(라이선스)가 입력된 데이터들의
   목록을 최신 날짜순으로 표시합니다.
   ===================================================================== */

import { navigate } from '../router.js';
import { fetchStoriesWithLicense } from '../services/stories.js';

export async function renderLicense() {
  const page = document.createElement('div');
  page.className = 'license-page page';

  page.innerHTML = `
    <!-- 페이지 헤더: 뒤로가기 + 제목 -->
    <div class="page-header page-header-with-back">
      <button class="page-header-back" id="license-back">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <h1 class="page-header-title">이미지 출처 안내</h1>
      <span class="page-header-spacer" aria-hidden="true"></span>
    </div>

    <!-- 로딩 스피너 -->
    <div id="license-loading" style="display:flex; justify-content:center; padding:var(--space-8);">
      <div class="loading-spinner"></div>
    </div>

    <!-- 라이선스 목록 영역 -->
    <ul id="license-list" class="license-list" style="display:none;"></ul>
  `;

  setTimeout(async () => {
    // 뒤로가기
    const backBtn = document.getElementById('license-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => window.history.back());
    }

    const listEl = document.getElementById('license-list');
    const loadingEl = document.getElementById('license-loading');
    
    if (!listEl || !loadingEl) return;

    try {
      const stories = await fetchStoriesWithLicense();
      
      loadingEl.style.display = 'none';
      listEl.style.display = 'flex';
      
      if (stories.length === 0) {
        listEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-title">등록된 라이선스가 없습니다</div>
            <div class="empty-state-desc">이미지 출처 정보가 포함된 발행글이 없습니다.</div>
          </div>
        `;
        return;
      }

      listEl.innerHTML = stories.map(story => {
        const dateStr = (story.publish_date || '').replace(/-/g, '.');
        /* 보안상 escapeHTML을 쓴다면 좋겠지만 DOMPurify 등의 외부 모듈이 없으므로 단순 이스케이프 처리 */
        const safeLicense = String(story.image_license || story.image_source || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
        
        return `
          <li class="license-item">
            <span class="license-date">[${dateStr}]</span>
            <span class="license-text">${safeLicense}</span>
          </li>
        `;
      }).join('');
    } catch (err) {
      console.error(err);
      loadingEl.style.display = 'none';
      listEl.style.display = 'flex';
      listEl.innerHTML = `<div class="empty-state"><div class="empty-state-title">오류 발생</div></div>`;
    }
  }, 0);

  return page;
}
