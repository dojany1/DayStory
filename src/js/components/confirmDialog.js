/* =====================================================================
   confirmDialog.js — 앱 디자인에 맞춘 확인 다이얼로그
   =====================================================================
   브라우저 기본 confirm() 대신 사용해 모바일 라이프사이클을 가로채지 않고
   앱 테마와도 일치하는 확인창을 띄웁니다.
   ===================================================================== */

import { lockScroll, unlockScroll } from '../utils/scrollLock.js';

/**
 * showConfirm — 확인/취소 다이얼로그를 띄우고 사용자의 선택을 Promise로 반환합니다
 * @param {Object} opts
 * @param {string} opts.title       제목
 * @param {string} [opts.message]   본문 (여러 줄은 \n)
 * @param {string} [opts.confirmText='확인']  확인 버튼 라벨
 * @param {string} [opts.cancelText='취소']   취소 버튼 라벨
 * @param {boolean} [opts.danger=false]       확인 버튼을 위험(빨강) 스타일로 표시
 * @returns {Promise<boolean>} 확인=true / 취소=false
 */
export function showConfirm({
  title,
  message = '',
  confirmText = '확인',
  cancelText = '취소',
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    /* 같은 다이얼로그가 이미 떠 있으면 정리하고 새로 띄움 */
    document.querySelectorAll('.confirm-dialog-overlay').forEach((el) => el.remove());

    const overlay = document.createElement('div');
    overlay.className = 'confirm-dialog-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const lines = String(message)
      .split('\n')
      .map((line) => `<p class="confirm-dialog-line">${escapeText(line)}</p>`)
      .join('');

    overlay.innerHTML = `
      <div class="confirm-dialog">
        <div class="confirm-dialog-title">${escapeText(title || '')}</div>
        ${message ? `<div class="confirm-dialog-message">${lines}</div>` : ''}
        <div class="confirm-dialog-actions">
          <button type="button" class="confirm-dialog-btn confirm-dialog-cancel">${escapeText(cancelText)}</button>
          <button type="button" class="confirm-dialog-btn confirm-dialog-confirm${danger ? ' is-danger' : ''}">${escapeText(confirmText)}</button>
        </div>
      </div>
    `;

    const wrapper = document.querySelector('.mobile-wrapper') || document.body;
    wrapper.appendChild(overlay);
    lockScroll();
    requestAnimationFrame(() => overlay.classList.add('visible'));

    const close = (result) => {
      unlockScroll();
      overlay.classList.remove('visible');
      setTimeout(() => {
        overlay.remove();
        resolve(result);
      }, 180);
    };

    overlay.querySelector('.confirm-dialog-cancel').addEventListener('click', () => close(false));
    overlay.querySelector('.confirm-dialog-confirm').addEventListener('click', () => close(true));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(false);
    });

    const onKey = (e) => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', onKey);
        close(false);
      }
    };
    document.addEventListener('keydown', onKey);
  });
}

function escapeText(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
