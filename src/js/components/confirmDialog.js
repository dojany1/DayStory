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
 * @param {number}  [opts.holdDuration=0]     >0 이면 확인 버튼을 해당 ms 동안 길게 눌러야 확정됨 (실수 방지)
 * @param {(secondsLeft:number)=>string} [opts.holdMessage] 길게 누르는 동안 상단에 표시할 안내문 포매터
 * @returns {Promise<boolean>} 확인=true / 취소=false
 */
export function showConfirm({
  title,
  message = '',
  confirmText = '확인',
  cancelText = '취소',
  danger = false,
  holdDuration = 0,
  holdMessage,
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

    const hold = Number.isFinite(holdDuration) && holdDuration > 0;
    const totalSeconds = hold ? Math.ceil(holdDuration / 1000) : 0;
    const formatMessage = typeof holdMessage === 'function'
      ? holdMessage
      : (secondsLeft) => `${secondsLeft}초간 누르고 계세요...`;
    const initialStatus = hold ? formatMessage(totalSeconds) : '';

    overlay.innerHTML = `
      <div class="confirm-dialog">
        ${hold ? `<div class="confirm-dialog-status" aria-live="polite">${escapeText(initialStatus)}</div>` : ''}
        <div class="confirm-dialog-title">${escapeText(title || '')}</div>
        ${message ? `<div class="confirm-dialog-message">${lines}</div>` : ''}
        <div class="confirm-dialog-actions">
          <button type="button" class="confirm-dialog-btn confirm-dialog-cancel">${escapeText(cancelText)}</button>
          <button type="button" class="confirm-dialog-btn confirm-dialog-confirm${danger ? ' is-danger' : ''}${hold ? ' has-hold' : ''}">
            <span class="confirm-dialog-confirm-fill" aria-hidden="true"></span>
            <span class="confirm-dialog-confirm-label">${escapeText(confirmText)}</span>
          </button>
        </div>
      </div>
    `;

    const wrapper = document.querySelector('.mobile-wrapper') || document.body;
    wrapper.appendChild(overlay);
    lockScroll();
    requestAnimationFrame(() => overlay.classList.add('visible'));

    const confirmBtn = overlay.querySelector('.confirm-dialog-confirm');
    const statusEl = overlay.querySelector('.confirm-dialog-status');
    const fillEl = overlay.querySelector('.confirm-dialog-confirm-fill');

    let holdRaf = 0;
    let holdStart = 0;
    let holdActive = false;
    let holdSettled = false;

    const cancelHold = ({ silent = false } = {}) => {
      if (!hold) return;
      holdActive = false;
      if (holdRaf) {
        cancelAnimationFrame(holdRaf);
        holdRaf = 0;
      }
      if (confirmBtn) confirmBtn.classList.remove('is-holding');
      if (fillEl) fillEl.style.transform = 'scaleX(0)';
      if (!silent && statusEl) statusEl.textContent = initialStatus;
    };

    const tick = () => {
      if (!holdActive) return;
      const elapsed = performance.now() - holdStart;
      const progress = Math.min(1, elapsed / holdDuration);
      if (fillEl) fillEl.style.transform = `scaleX(${progress})`;
      const remaining = Math.max(0, Math.ceil((holdDuration - elapsed) / 1000));
      if (statusEl) statusEl.textContent = formatMessage(remaining);
      if (progress >= 1) {
        holdSettled = true;
        cancelHold({ silent: true });
        close(true);
        return;
      }
      holdRaf = requestAnimationFrame(tick);
    };

    const startHold = (e) => {
      if (!hold || holdSettled || holdActive) return;
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      holdActive = true;
      holdStart = performance.now();
      if (confirmBtn) confirmBtn.classList.add('is-holding');
      if (statusEl) statusEl.textContent = formatMessage(totalSeconds);
      holdRaf = requestAnimationFrame(tick);
    };

    const close = (result) => {
      cancelHold({ silent: true });
      document.removeEventListener('keydown', onKey);
      unlockScroll();
      overlay.classList.remove('visible');
      setTimeout(() => {
        overlay.remove();
        resolve(result);
      }, 180);
    };

    overlay.querySelector('.confirm-dialog-cancel').addEventListener('click', () => close(false));

    if (hold) {
      confirmBtn.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        try { confirmBtn.setPointerCapture(e.pointerId); } catch { /* no-op */ }
        startHold(e);
      });
      const releaseEvents = ['pointerup', 'pointercancel', 'pointerleave', 'lostpointercapture'];
      releaseEvents.forEach((evt) => {
        confirmBtn.addEventListener(evt, () => cancelHold());
      });
      /* 클릭만으로는 확정되지 않도록 막음 */
      confirmBtn.addEventListener('click', (e) => {
        if (!holdSettled) {
          e.preventDefault();
          e.stopPropagation();
        }
      });
    } else {
      confirmBtn.addEventListener('click', () => close(true));
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(false);
    });

    const onKey = (e) => {
      if (e.key === 'Escape') {
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
