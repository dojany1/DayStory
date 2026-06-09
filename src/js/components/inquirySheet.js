/* =====================================================================
   inquirySheet.js — 문의/건의 작성 바텀시트 (토스 스타일)
   =====================================================================
   설정의 '문의 및 건의하기' 와 카드 상세의 '오류 및 오탈자 제보' 진입점에서
   공통으로 띄우는 폼 시트. introSheet.js 의 표준 바텀시트 골격
   (.modal-overlay + .modal-sheet + 핸들 + 드래그-투-클로즈)을 차용하되,
   온보딩(flag/markSeen) 의존성 없이 폼 전용으로 구성한다.

   - 유형 드롭다운(버그/오탈자/기능 제안/기타) + 내용 textarea + 도배 방지 안내 + 제출
   - 제출 로직/메타 수집/쿨타임은 services/inquiries.js 가 담당 (CLAUDE.md 아키텍처 규칙)
   - 사용자 입력은 Firestore 에 raw 저장하며 DOM 에는 textarea/select 값만 사용 → innerHTML 조립 없음(XSS 안전)
   ===================================================================== */

import { lockScroll, unlockScroll } from '../utils/scrollLock.js';
import { escapeHtml } from '../utils/sanitize.js';
import { t } from '../i18n/index.js';
import { showToast } from './toast.js';
import { submitInquiry, INQUIRY_TYPES } from '../services/inquiries.js';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

/* 유형 코드 → i18n 라벨 키 */
const TYPE_LABEL_KEY = {
  bug: 'inquiry.type_bug',
  typo: 'inquiry.type_typo',
  feature: 'inquiry.type_feature',
  etc: 'inquiry.type_etc',
};

/**
 * showInquirySheet — 문의 작성 바텀시트를 띄운다.
 * @param {Object} [opts]
 * @param {string} [opts.presetType]   미리 선택할 유형 ('typo' 등). 카드 진입 시 사용.
 * @param {string} [opts.entryCardId]  진입한 카드(스토리)의 ID. 카드 진입 시에만.
 * @param {Function} [opts.onSubmitted] 제출 성공 후 콜백.
 * @returns {HTMLElement|null} 생성된 overlay (이미 떠 있으면 null)
 */
export function showInquirySheet({ presetType, entryCardId, onSubmitted } = {}) {
  /* 중복 마운트 가드 — 연타 시 오버레이 겹침 방지 */
  if (document.querySelector('.inquiry-sheet-overlay')) return null;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay inquiry-sheet-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const initialType = presetType || INQUIRY_TYPES[0];

  overlay.innerHTML = `
    <div class="modal-sheet inquiry-sheet" role="document">
      <div class="inquiry-sheet-handle-area" aria-hidden="true">
        <div class="inquiry-sheet-handle"></div>
      </div>
      <button type="button" class="inquiry-sheet-close" aria-label="${escapeHtml(t('common.close'))}">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <div class="inquiry-sheet-scroll">
        <h2 class="inquiry-sheet-title">${escapeHtml(t('inquiry.title'))}</h2>

        <div class="inquiry-field">
          <label class="inquiry-label">${escapeHtml(t('inquiry.type_label'))}</label>
          <div class="inquiry-select-wrap">
            <div class="inquiry-custom-select" role="combobox" aria-expanded="false" aria-haspopup="listbox" tabindex="0" data-value="${escapeHtml(initialType)}">
              <span class="inquiry-custom-select-label">${escapeHtml(t(TYPE_LABEL_KEY[initialType]))}</span>
              <svg class="inquiry-select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>
        </div>

        <div class="inquiry-field">
          <label class="inquiry-label" for="inquiry-content">${escapeHtml(t('inquiry.content_label'))}</label>
          <textarea class="report-textarea inquiry-textarea" id="inquiry-content" rows="5" placeholder="${escapeHtml(t('inquiry.placeholder'))}"></textarea>
        </div>

        <p class="inquiry-notice">${escapeHtml(t('inquiry.notice'))}</p>

        <button type="button" class="btn btn-primary btn-full inquiry-submit">${escapeHtml(t('inquiry.submit'))}</button>
      </div>
    </div>
  `;

  const wrapper = document.querySelector('.mobile-wrapper') || document.body;
  wrapper.appendChild(overlay);
  lockScroll();
  /* 이중 rAF: 초기 상태(opacity:0 / translateY(100%)) 페인트 후 .visible 로 전환 (introSheet 동일 패턴) */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => overlay.classList.add('visible'));
  });

  const sheet = overlay.querySelector('.inquiry-sheet');
  const handleArea = overlay.querySelector('.inquiry-sheet-handle-area');
  const scrollEl = overlay.querySelector('.inquiry-sheet-scroll');
  const submitBtn = overlay.querySelector('.inquiry-submit');
  const customSelect = overlay.querySelector('.inquiry-custom-select');
  const contentEl = overlay.querySelector('#inquiry-content');

  /* ── 커스텀 드롭다운 ── */
  let optionsPopup = null;

  const getSelectedType = () => customSelect.dataset.value || INQUIRY_TYPES[0];

  const closeOptions = () => {
    if (!optionsPopup) return;
    optionsPopup.remove();
    optionsPopup = null;
    customSelect.classList.remove('open');
    customSelect.setAttribute('aria-expanded', 'false');
  };

  const openOptions = () => {
    if (optionsPopup) { closeOptions(); return; }

    const rect = customSelect.getBoundingClientRect();
    const popup = document.createElement('div');
    popup.className = 'inquiry-select-options';
    popup.setAttribute('role', 'listbox');

    const currentVal = getSelectedType();
    INQUIRY_TYPES.forEach((type) => {
      const opt = document.createElement('div');
      opt.className = 'inquiry-select-option' + (type === currentVal ? ' selected' : '');
      opt.setAttribute('role', 'option');
      opt.setAttribute('aria-selected', type === currentVal ? 'true' : 'false');
      opt.dataset.value = type;
      opt.textContent = t(TYPE_LABEL_KEY[type]);
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        customSelect.dataset.value = type;
        customSelect.querySelector('.inquiry-custom-select-label').textContent = t(TYPE_LABEL_KEY[type]);
        closeOptions();
      });
      popup.appendChild(opt);
    });

    /* position:fixed 로 뷰포트 기준 배치 — transform 부모 영향 없음 */
    const popupWidth = rect.width;
    popup.style.width = `${popupWidth}px`;
    popup.style.left = `${rect.left}px`;

    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const estimatedHeight = INQUIRY_TYPES.length * 44;
    if (spaceBelow >= estimatedHeight) {
      popup.style.top = `${rect.bottom + 4}px`;
    } else {
      popup.style.bottom = `${window.innerHeight - rect.top + 4}px`;
    }

    document.body.appendChild(popup);
    optionsPopup = popup;
    customSelect.classList.add('open');
    customSelect.setAttribute('aria-expanded', 'true');
  };

  customSelect.addEventListener('click', (e) => { e.stopPropagation(); openOptions(); });
  customSelect.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openOptions(); }
    if (e.key === 'Escape') closeOptions();
  });

  /* 팝업 외부 클릭 시 닫기 */
  document.addEventListener('click', closeOptions);

  let isDragging = false;
  let touchStartY = 0;
  let touchStartTime = 0;
  let currentOffset = 0;

  let isClosing = false;
  const close = () => {
    if (isClosing) return;
    isClosing = true;
    isDragging = false;

    closeOptions();
    document.removeEventListener('click', closeOptions);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('hashchange', onHashChange);

    unlockScroll();
    sheet.classList.remove('is-dragging');
    sheet.style.transform = 'translateY(100%)';
    overlay.classList.remove('visible');
    const finish = () => { if (overlay.parentNode) overlay.remove(); };
    overlay.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, 360); /* transition 미발생 안전망 */
  };

  /* ── 닫기 인터랙션 ── */
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector('.inquiry-sheet-close')?.addEventListener('click', close);

  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);

  /* 페이지 이동(뒤로가기/딥링크)으로 라우트가 바뀌면 자동 정리 */
  const onHashChange = () => close();
  window.addEventListener('hashchange', onHashChange, { once: true });

  /* ── 제출 ── */
  const handleSubmit = async () => {
    if (isClosing) return;
    const content = (contentEl.value || '').trim();
    if (!content) {
      showToast(t('inquiry.toast_need_content'), 'warning');
      contentEl.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.setAttribute('aria-busy', 'true');

    const res = await submitInquiry({
      type: getSelectedType(),
      content,
      entryCardId,
    });

    if (res.ok) {
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
      showToast(t('inquiry.toast_done'), 'success');
      close();
      if (typeof onSubmitted === 'function') {
        try { onSubmitted(); } catch (e) { console.warn('inquiry onSubmitted 실패:', e); }
      }
      return;
    }

    /* 실패 — 버튼 복구 + 사유별 안내 */
    submitBtn.disabled = false;
    submitBtn.removeAttribute('aria-busy');
    const msgKey = res.error === 'cooldown'
      ? 'inquiry.toast_cooldown'
      : res.error === 'empty'
        ? 'inquiry.toast_need_content'
        : 'inquiry.toast_error';
    showToast(t(msgKey), res.error === 'cooldown' ? 'warning' : 'error');
  };
  submitBtn.addEventListener('click', handleSubmit);

  /* ── 드래그-투-클로즈 (introSheet 패턴) ── */
  const onTouchStart = (e) => {
    if (!handleArea.contains(e.target) && scrollEl.scrollTop > 0) return;
    isDragging = true;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
    currentOffset = 0;
    sheet.classList.add('is-dragging');
  };
  const onTouchMove = (e) => {
    if (!isDragging) return;
    const dy = e.touches[0].clientY - touchStartY;
    if (dy <= 0) return;
    e.preventDefault();
    currentOffset = dy;
    sheet.style.transform = `translateY(${dy}px)`;
  };
  const onTouchEnd = () => {
    if (!isDragging) return;
    isDragging = false;
    sheet.classList.remove('is-dragging');
    const velocity = currentOffset / Math.max(1, Date.now() - touchStartTime);
    if (currentOffset > sheet.offsetHeight * 0.3 || velocity > 0.5) {
      close();
    } else {
      sheet.style.transform = '';
    }
  };
  sheet.addEventListener('touchstart', onTouchStart, { passive: true });
  sheet.addEventListener('touchmove', onTouchMove, { passive: false });
  sheet.addEventListener('touchend', onTouchEnd, { passive: true });
  sheet.addEventListener('touchcancel', onTouchEnd, { passive: true });

  return overlay;
}
