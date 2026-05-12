/* =====================================================================
   subscriptionModal.js — DayStory 멤버십 구독 안내 모달
   =====================================================================
   미구독자가 잠긴 카드(지난 날짜)를 눌렀을 때 표시.
   "구독 시작하기" 버튼으로 RevenueCat 결제 시트 호출.
   ===================================================================== */

import { t } from '../i18n/index.js';
import { purchaseMonthly } from '../services/billing.js';
import { showToast } from './toast.js';
import { forceRoute } from '../router.js';

function escapeText(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * showSubscriptionModal — 구독 안내 모달을 띄우고 사용자의 선택을 Promise로 반환합니다.
 * @returns {Promise<{ purchased: boolean, cancelled: boolean }>}
 */
export function showSubscriptionModal() {
  return new Promise((resolve) => {
    document.querySelectorAll('.subscription-modal-overlay').forEach((el) => el.remove());

    const overlay = document.createElement('div');
    overlay.className = 'subscription-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    overlay.innerHTML = `
      <div class="subscription-modal">
        <div class="subscription-modal-icon">✦</div>
        <div class="subscription-modal-title">${escapeText(t('subscription.modal_title'))}</div>
        <div class="subscription-modal-message">${escapeText(t('subscription.modal_message'))}</div>
        <div class="subscription-modal-price">${escapeText(t('subscription.price_monthly'))}</div>
        <div class="subscription-modal-actions">
          <button type="button" class="subscription-modal-btn subscription-modal-close">${escapeText(t('subscription.close_btn'))}</button>
          <button type="button" class="subscription-modal-btn subscription-modal-cta">${escapeText(t('subscription.subscribe_btn'))}</button>
        </div>
      </div>
    `;

    const wrapper = document.querySelector('.mobile-wrapper') || document.body;
    wrapper.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));

    const close = (result) => {
      overlay.classList.remove('visible');
      setTimeout(() => {
        overlay.remove();
        resolve(result);
      }, 180);
    };

    overlay.querySelector('.subscription-modal-close').addEventListener('click', () =>
      close({ purchased: false, cancelled: true })
    );

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close({ purchased: false, cancelled: true });
    });

    const cta = overlay.querySelector('.subscription-modal-cta');
    cta.addEventListener('click', async () => {
      cta.disabled = true;
      cta.textContent = '...';
      const res = await purchaseMonthly();
      if (res.ok) {
        showToast(t('subscription.purchase_success'), 'success');
        close({ purchased: true, cancelled: false });
        /* 결제 성공 → 현재 페이지(주로 캘린더) 재렌더해 잠금 해제 반영 */
        try { forceRoute(); } catch {}
      } else if (res.error === 'cancelled') {
        cta.disabled = false;
        cta.textContent = t('subscription.subscribe_btn');
        /* 취소는 토스트 안 띄움 — 사용자 의도적 선택 */
      } else if (res.error === 'native_only') {
        showToast(t('subscription.native_only'), 'info');
        cta.disabled = false;
        cta.textContent = t('subscription.subscribe_btn');
      } else {
        showToast(t('subscription.purchase_failed'), 'error');
        cta.disabled = false;
        cta.textContent = t('subscription.subscribe_btn');
      }
    });

    const onKey = (e) => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', onKey);
        close({ purchased: false, cancelled: true });
      }
    };
    document.addEventListener('keydown', onKey);
  });
}
