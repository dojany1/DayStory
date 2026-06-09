/* =====================================================================
   introSheet.js — 탭 진입 인트로 모달 (논블로킹 튜토리얼)
   =====================================================================
   '오늘, 역사 속에서' / '나의 일화' 탭 최초 진입 시 화면의 목적을 가볍게
   설명하는 바텀시트. 배경 터치 · X 버튼 · ESC 로 즉시 닫을 수 있다.

   디자인 일관성:
   - 앱 표준 바텀시트(.modal-overlay + .modal-sheet) 마크업/애니메이션을 재사용.
   - 닫기 인터랙션(backdrop/ESC/lockScroll/transition 제거)은 confirmDialog 규약을 차용.

   상태:
   - flag 는 services/onboarding.js 의 ONBOARDING_FLAGS 값.
   - 닫힐 때(=사용자 확인) markSeen(flag) 으로 1회만 노출되도록 기록한다.
   ===================================================================== */

import { lockScroll, unlockScroll } from '../utils/scrollLock.js';
import { escapeHtml } from '../utils/sanitize.js';
import { markSeen } from '../services/onboarding.js';
import { t } from '../i18n/index.js';

/**
 * showIntroSheet — 인트로 바텀시트를 띄운다.
 * @param {Object} opts
 * @param {string} opts.flag        ONBOARDING_FLAGS 값 (닫힐 때 markSeen)
 * @param {string} [opts.icon='📜'] 상단 이모지 아이콘
 * @param {string} opts.title       제목 (i18n 문자열)
 * @param {string[]} [opts.lines=[]] 본문 줄 배열 (i18n 문자열)
 * @param {string} [opts.ctaText]   확인 버튼 라벨 (기본 '시작하기')
 * @param {Function} [opts.onClose] 닫힌 뒤 콜백
 * @returns {HTMLElement|null} 생성된 overlay (이미 떠 있으면 null)
 */
export function showIntroSheet({
  flag,
  icon = '📜',
  title = '',
  lines = [],
  ctaText,
  onClose,
} = {}) {
  /* 중복 마운트 가드 — 탭 연타 시 오버레이가 겹치지 않도록 (QA Q3) */
  if (document.querySelector('.intro-sheet-overlay')) return null;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay intro-sheet-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const bodyHtml = (Array.isArray(lines) ? lines : [lines])
    .filter(Boolean)
    .map((line) => `<p class="intro-sheet-line">${escapeHtml(String(line))}</p>`)
    .join('');

  overlay.innerHTML = `
    <div class="modal-sheet intro-sheet" role="document">
      <div class="intro-sheet-handle-area" aria-hidden="true">
        <div class="intro-sheet-handle"></div>
      </div>
      <button type="button" class="intro-sheet-close" aria-label="${escapeHtml(t('common.close'))}">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <div class="intro-sheet-scroll">
        <div class="intro-sheet-icon" aria-hidden="true">${icon.trimStart().startsWith('<') ? icon : escapeHtml(icon)}</div>
        <h2 class="intro-sheet-title">${escapeHtml(String(title))}</h2>
        <div class="intro-sheet-body">${bodyHtml}</div>
        <button type="button" class="btn btn-primary btn-full intro-sheet-cta">${escapeHtml(ctaText || t('onboarding.cta_start'))}</button>
      </div>
    </div>
  `;

  const wrapper = document.querySelector('.mobile-wrapper') || document.body;
  wrapper.appendChild(overlay);
  lockScroll();
  /* 숨김 상태(opacity:0 / translateY(100%))를 먼저 페인트한 뒤 .visible 로 전환해야
     '최종 위치로 번쩍였다가 다시 슬라이드'되는 현상이 사라진다 (confirmDialog 와 동일 패턴). */
  /* 이중 rAF: 첫 프레임에서 초기 상태(opacity:0/translateY(100%))를 페인트한 뒤,
     두 번째 프레임에서 .visible 을 추가해야 transition 이 발동된다.
     단일 rAF 만으로는 WebView 에서 초기·최종 상태를 같은 프레임으로 묶어 버린다. */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => overlay.classList.add('visible'));
  });

  /* ── 드래그-투-클로즈 상태 변수 (close() 클로저가 참조하므로 먼저 선언) ── */
  const sheet = overlay.querySelector('.intro-sheet');
  const handleArea = overlay.querySelector('.intro-sheet-handle-area');
  const scrollEl = overlay.querySelector('.intro-sheet-scroll');
  let isDragging = false;
  let touchStartY = 0;
  let touchStartTime = 0;
  let currentOffset = 0;

  let isClosing = false;
  const close = () => {
    if (isClosing) return;
    isClosing = true;
    isDragging = false;

    document.removeEventListener('keydown', onKey);
    window.removeEventListener('hashchange', onHashChange);

    /* 사용자 확인으로 간주 — 다시 노출되지 않도록 기록 */
    if (flag) markSeen(flag);

    unlockScroll();
    /* 드래그 도중 닫힐 때: is-dragging 제거로 transition 복구 후 translateY(100%)로
       현재 위치에서 화면 밖까지 매끄럽게 슬라이드 아웃. */
    sheet.classList.remove('is-dragging');
    sheet.style.transform = 'translateY(100%)';
    overlay.classList.remove('visible');
    const finish = () => {
      if (overlay.parentNode) overlay.remove();
      if (typeof onClose === 'function') {
        try { onClose(); } catch (e) { console.warn('introSheet onClose 실패:', e); }
      }
    };
    overlay.addEventListener('transitionend', finish, { once: true });
    /* 안전망: transition 미발생 시 강제 제거 */
    setTimeout(finish, 360);
  };

  /* 배경(backdrop) 터치로 닫기 — 시트 내부 클릭은 무시 */
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector('.intro-sheet-close')?.addEventListener('click', close);
  overlay.querySelector('.intro-sheet-cta')?.addEventListener('click', close);

  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);

  /* 탭 이동(뒤로가기/딥링크)으로 페이지가 바뀌면 떠 있는 시트를 자동 정리 (QA Q1) */
  const onHashChange = () => close();
  window.addEventListener('hashchange', onHashChange, { once: true });

  /* ── 드래그-투-클로즈 (터치 이벤트) ── */
  const onTouchStart = (e) => {
    /* 핸들 영역이 아닌 콘텐츠를 터치했고 스크롤이 내려가 있으면 드래그 시작 안 함 */
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
    if (dy <= 0) return; /* 위 방향 드래그는 차단 (시트 더 올리기 금지) */
    e.preventDefault();  /* 네이티브 스크롤 차단 (passive:false 필수) */
    currentOffset = dy;
    sheet.style.transform = `translateY(${dy}px)`;
  };

  const onTouchEnd = () => {
    if (!isDragging) return;
    isDragging = false;
    sheet.classList.remove('is-dragging'); /* transition 다시 활성화 */
    const velocity = currentOffset / Math.max(1, Date.now() - touchStartTime); /* px/ms */
    if (currentOffset > sheet.offsetHeight * 0.3 || velocity > 0.5) {
      close(); /* 임계점 초과 → 닫기 */
    } else {
      sheet.style.transform = ''; /* snap back — CSS transition 으로 translateY(0) 복귀 */
    }
  };

  sheet.addEventListener('touchstart', onTouchStart, { passive: true });
  sheet.addEventListener('touchmove', onTouchMove, { passive: false });
  sheet.addEventListener('touchend', onTouchEnd, { passive: true });
  sheet.addEventListener('touchcancel', onTouchEnd, { passive: true });

  return overlay;
}
