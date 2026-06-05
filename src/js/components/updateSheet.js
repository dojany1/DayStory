/* =====================================================================
   updateSheet.js — 신규 버전 출시 안내 바텀시트
   =====================================================================
   기존 .modal-overlay + .modal-sheet 디자인 토큰을 재사용한다.
   사용자가 '지금 업데이트' 를 누르면 스토어로 이동, '다음에 하기' / 핸들 드래그 /
   배경 탭 / ESC 면 단순 닫기. 브라우저 기본 confirm() 금지 규칙(CLAUDE.md) 준수.

   진입 애니메이션:
     부모 .modal-overlay/.modal-sheet 의 keyframe (fadeIn / slideUp) 은 첫 paint
     에 final state 가 잠깐 노출되는 flash 가 있어, .is-visible 클래스 토글 +
     CSS transition 패턴으로 교체. 더블 rAF 로 초기 paint 보장 후 transition 트리거.

   핸들 드래그-투-클로즈:
     pointer event 로 핸들 영역에서 아래 방향 드래그를 추적. 시트 높이의 30% 초과
     시 close, 미달이면 snap back. setPointerCapture 로 손가락이 영역 밖으로
     벗어나도 추적 유지.
   ===================================================================== */

import { lockScroll, unlockScroll } from '../utils/scrollLock.js';
import { escapeHtml } from '../utils/sanitize.js';
import { t } from '../i18n/index.js';

const CLOSE_DURATION_MS = 320;
const DRAG_CLOSE_THRESHOLD_RATIO = 0.3; /* 시트 높이의 30% 초과 드래그 → 닫기 */

/**
 * showUpdateSheet — 업데이트 안내 바텀시트를 띄운다. Promise 는 사용자의 선택을 반환.
 * @param {Object} opts
 * @param {string} opts.currentVersion  현재 설치된 버전 (예: "1.4.1")
 * @param {string} opts.latestVersion   최신 버전 (예: "1.4.2")
 * @returns {Promise<'update'|'later'>}
 */
export function showUpdateSheet({ currentVersion, latestVersion } = {}) {
  return new Promise((resolve) => {
    /* 같은 시트가 이미 떠 있으면 정리하고 새로 띄움 */
    document.querySelectorAll('.update-sheet-overlay').forEach((el) => el.remove());

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay update-sheet-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'update-sheet-title');

    overlay.innerHTML = `
      <div class="modal-sheet update-sheet" role="document">
        <div class="update-sheet-handle-area" aria-hidden="true">
          <div class="modal-handle"></div>
        </div>
        <div class="update-sheet-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a9 9 0 1 1-3-6.7"/>
            <polyline points="21 4 21 10 15 10"/>
          </svg>
        </div>
        <h2 id="update-sheet-title" class="update-sheet-title">${t('update.title')}</h2>
        <p class="update-sheet-message">${t('update.message')}</p>
        <div class="update-sheet-versions">
          <div class="update-sheet-version-row">
            <span class="update-sheet-version-label">${t('update.current_version')}</span>
            <span class="update-sheet-version-value">${escapeHtml(currentVersion || '-')}</span>
          </div>
          <div class="update-sheet-version-row is-latest">
            <span class="update-sheet-version-label">${t('update.latest_version')}</span>
            <span class="update-sheet-version-value">${escapeHtml(latestVersion || '-')}</span>
          </div>
        </div>
        <div class="update-sheet-actions">
          <button type="button" class="btn btn-secondary update-sheet-later">${t('update.later')}</button>
          <button type="button" class="btn btn-primary update-sheet-update">${t('update.now')}</button>
        </div>
      </div>
    `;

    const wrapper = document.querySelector('.mobile-wrapper') || document.body;
    wrapper.appendChild(overlay);
    lockScroll();

    const sheet = overlay.querySelector('.update-sheet');
    const handleArea = overlay.querySelector('.update-sheet-handle-area');

    /* 더블 rAF — 1차는 초기 paint(transform: translateY(100%), opacity: 0) 보장,
       2차에서 .is-visible 토글 → CSS transition 정상 트리거. 단일 rAF 만 쓰면
       iOS WKWebView 등 일부 환경에서 transition 이 생략되고 즉시 jump 한다. */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlay.classList.add('is-visible');
      });
    });

    let settled = false;
    let isDragging = false;
    let dragStartY = 0;
    let dragOffset = 0;

    const close = (result) => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKey);
      unlockScroll();
      /* 드래그로 닫는 경우 인라인 transform 이 남아 있으니, transform 을 100% 로 명시
         설정해 현재 위치에서 화면 밖까지 매끄럽게 transition. */
      sheet.classList.remove('is-dragging');
      sheet.style.transform = 'translateY(100%)';
      overlay.classList.remove('is-visible');
      setTimeout(() => {
        overlay.remove();
        resolve(result);
      }, CLOSE_DURATION_MS);
    };

    /* ── 핸들 드래그-투-클로즈 ── */
    const onDragStart = (e) => {
      if (settled) return;
      if (e.button !== undefined && e.button !== 0) return;
      isDragging = true;
      dragStartY = e.clientY;
      dragOffset = 0;
      sheet.classList.add('is-dragging');
      try { handleArea.setPointerCapture(e.pointerId); } catch { /* noop */ }
    };

    const onDragMove = (e) => {
      if (!isDragging) return;
      dragOffset = Math.max(0, e.clientY - dragStartY);
      sheet.style.transform = `translateY(${dragOffset}px)`;
      /* 드래그 progress 에 비례해 오버레이를 50% 까지 fade — 닫힘 예고 시각 피드백. */
      const sheetH = sheet.offsetHeight || 1;
      const progress = Math.min(1, dragOffset / sheetH);
      overlay.style.opacity = String(1 - progress * 0.5);
    };

    const onDragEnd = (e) => {
      if (!isDragging) return;
      isDragging = false;
      sheet.classList.remove('is-dragging');
      try { handleArea.releasePointerCapture(e.pointerId); } catch { /* noop */ }
      const sheetH = sheet.offsetHeight || 1;
      if (dragOffset > sheetH * DRAG_CLOSE_THRESHOLD_RATIO) {
        close('later');
      } else {
        /* snap back — 인라인 transform/opacity 제거 → CSS transition 으로 0 / 1 복귀 */
        sheet.style.transform = '';
        overlay.style.opacity = '';
      }
    };

    handleArea.addEventListener('pointerdown', onDragStart);
    handleArea.addEventListener('pointermove', onDragMove);
    handleArea.addEventListener('pointerup', onDragEnd);
    handleArea.addEventListener('pointercancel', onDragEnd);

    overlay.querySelector('.update-sheet-update').addEventListener('click', () => close('update'));
    overlay.querySelector('.update-sheet-later').addEventListener('click', () => close('later'));

    /* 배경 탭 → '다음에 하기' 와 동일 처리 */
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close('later');
    });

    const onKey = (e) => {
      if (e.key === 'Escape') close('later');
    };
    document.addEventListener('keydown', onKey);
  });
}
