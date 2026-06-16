/* =====================================================================
   shareChoiceSheet.js — 공유 방법 선택 시트 ("카드 이미지" / "링크")
   =====================================================================
   공유 버튼 탭 시, 카드 이미지를 캡처해 공유할지, 링크(서버 동적 OG
   미리보기)만 공유할지 선택하게 한다. confirmDialog 와 같은 오버레이
   스타일을 공유해 테마(라이트/다크)를 그대로 따른다.
   ===================================================================== */

import { lockScroll, unlockScroll } from '../utils/scrollLock.js';
import { escapeHtml } from '../utils/sanitize.js';
import { t } from '../i18n/index.js';

const IMAGE_ICON = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
const LINK_ICON = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
const SAVE_ICON = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';

/**
 * showShareChoice — "카드 이미지 / 갤러리 저장 / 링크" 선택 시트를 띄우고 결과를 Promise로 반환합니다.
 * @param {Object} [opts]
 * @param {string} [opts.title] - 다이얼로그 제목 (기본: t('share.choice_title'))
 * @param {boolean} [opts.showSave] - "갤러리에 저장" 옵션 노출 여부.
 *   사진 보관함 저장은 네이티브 플러그인 의존이므로 네이티브(iOS/Android)에서만 true 로 전달한다.
 * @param {boolean} [opts.showLink] - "링크" 공유 옵션 노출 여부.
 *   링크 공유를 지원하지 않는 곳(예: 나의 일화)에서는 false 로 전달한다.
 * @returns {Promise<'image'|'save'|'link'|null>} 선택 결과. 취소/배경 탭/Esc → null
 */
export function showShareChoice({ title, showSave = false, showLink = true } = {}) {
  return new Promise((resolve) => {
    document.querySelectorAll('.share-choice-overlay').forEach((el) => el.remove());

    const overlay = document.createElement('div');
    overlay.className = 'confirm-dialog-overlay share-choice-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const saveOption = showSave ? `
          <button type="button" class="share-choice-option" data-choice="save">
            <span class="share-choice-icon" aria-hidden="true">${SAVE_ICON}</span>
            <span class="share-choice-text">
              <span class="share-choice-label">${escapeHtml(t('share.choice_save'))}</span>
              <span class="share-choice-desc">${escapeHtml(t('share.choice_save_desc'))}</span>
            </span>
          </button>` : '';

    const linkOption = showLink ? `
          <button type="button" class="share-choice-option" data-choice="link">
            <span class="share-choice-icon" aria-hidden="true">${LINK_ICON}</span>
            <span class="share-choice-text">
              <span class="share-choice-label">${escapeHtml(t('share.choice_link'))}</span>
              <span class="share-choice-desc">${escapeHtml(t('share.choice_link_desc'))}</span>
            </span>
          </button>` : '';

    overlay.innerHTML = `
      <div class="confirm-dialog share-choice-dialog">
        <div class="confirm-dialog-title">${escapeHtml(title || t('share.choice_title'))}</div>
        <div class="share-choice-options">
          <button type="button" class="share-choice-option" data-choice="image">
            <span class="share-choice-icon" aria-hidden="true">${IMAGE_ICON}</span>
            <span class="share-choice-text">
              <span class="share-choice-label">${escapeHtml(t('share.choice_image'))}</span>
              <span class="share-choice-desc">${escapeHtml(t('share.choice_image_desc'))}</span>
            </span>
          </button>${saveOption}${linkOption}
        </div>
        <button type="button" class="confirm-dialog-btn share-choice-cancel">${escapeHtml(t('common.cancel'))}</button>
      </div>
    `;

    const wrapper = document.querySelector('.mobile-wrapper') || document.body;
    wrapper.appendChild(overlay);
    lockScroll();
    requestAnimationFrame(() => overlay.classList.add('visible'));

    const close = (result) => {
      document.removeEventListener('keydown', onKey);
      unlockScroll();
      overlay.classList.remove('visible');
      setTimeout(() => {
        overlay.remove();
        resolve(result);
      }, 180);
    };

    overlay.querySelectorAll('.share-choice-option').forEach((btn) => {
      btn.addEventListener('click', () => close(btn.dataset.choice));
    });
    overlay.querySelector('.share-choice-cancel')?.addEventListener('click', () => close(null));

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(null);
    });

    const onKey = (e) => {
      if (e.key === 'Escape') close(null);
    };
    document.addEventListener('keydown', onKey);
  });
}
