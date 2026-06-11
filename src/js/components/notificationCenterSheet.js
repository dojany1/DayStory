/* =====================================================================
   notificationCenterSheet.js — 알림 센터 UI
   =====================================================================
   진입: profile.js 헤더의 종(bell) 버튼.
   구성:
     - 풀시트(notification-settings-overlay 패턴, 우측 슬라이드 인)
       · 탭: 공지사항(notices) / 내 문의(inquiries)
       · 공지 limit(20) + '더 보기' 커서 페이지네이션 (+ IntersectionObserver 자동 로드)
     - 항목 클릭 → 토스 스타일 상세 바텀시트(modal-overlay + 드래그-투-클로즈)

   데이터/Firestore 는 services/notificationCenter.js 가 담당(CLAUDE.md 아키텍처 규칙).
   사용자 입력/원격 텍스트는 전부 escapeHtml 통과 — innerHTML 직조립 금지(XSS 방어).
   ===================================================================== */

import { escapeHtml } from '../utils/sanitize.js';
import { t, getCurrentLang } from '../i18n/index.js';
import { getState } from '../state.js';
import { lockScroll, unlockScroll } from '../utils/scrollLock.js';
import { renderPageHeader, bindPageHeaderBack } from './pageHeader.js';
import { fetchNotices, fetchMyInquiries, markAllRead } from '../services/notificationCenter.js';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

const BELL_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/></svg>';

/**
 * renderNotificationBell — profile 헤더 우측에 끼울 종 버튼 HTML.
 * @param {Object} [opts]
 * @param {boolean} [opts.unread] true 면 unread dot 노출
 * @returns {string}
 */
export function renderNotificationBell({ unread = false } = {}) {
  return `<button type="button" id="notif-bell-btn" class="notif-bell-btn page-header-back" aria-label="${escapeHtml(t('notificationCenter.aria_open'))}">`
    + BELL_SVG
    + (unread ? `<span class="notif-bell-dot" aria-label="${escapeHtml(t('notificationCenter.aria_unread'))}"></span>` : '')
    + '</button>';
}

/* createdAtMs → 표시용 날짜(YYYY.MM.DD). 0/누락은 빈 문자열. */
export function formatDate(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}.${mm}.${dd}`;
}

function renderNoticeItem(n) {
  return `
    <button type="button" class="notif-item" data-kind="notice" data-id="${escapeHtml(n.id)}">
      <div class="notif-item-main">
        <div class="notif-item-title">${escapeHtml(n.title)}</div>
        <div class="notif-item-preview">${escapeHtml(n.body)}</div>
      </div>
      <div class="notif-item-time">${escapeHtml(formatDate(n.createdAtMs))}</div>
    </button>`;
}

function renderInquiryItem(i) {
  const typeLabel = t(`inquiry.type_${i.type}`);
  const statusBadge = i.status === 'answered'
    ? `<span class="notif-status notif-status-answered">${escapeHtml(t('notificationCenter.status_answered'))}</span>`
    : '';
  const answerBlock = i.status === 'answered'
    ? `<div class="notif-item-answer">
         <span class="notif-item-answer-label">${escapeHtml(t('notificationCenter.answer_label'))}</span>
         <span class="notif-item-answer-text">${escapeHtml(i.answer)}</span>
       </div>`
    : '';
  return `
    <button type="button" class="notif-item" data-kind="inquiry" data-id="${escapeHtml(i.id)}">
      <div class="notif-item-main">
        <div class="notif-item-title">
          ${escapeHtml(typeLabel)}
          ${statusBadge}
        </div>
        <div class="notif-item-preview">${escapeHtml(i.content)}</div>
        ${answerBlock}
      </div>
    </button>`;
}

/**
 * showNotificationCenter — 알림 센터 풀시트를 띄운다.
 * @returns {HTMLElement|null} 생성된 overlay (이미 떠 있으면 null)
 */
export function showNotificationCenter() {
  if (document.querySelector('.notif-center-overlay')) return null;

  const overlay = document.createElement('div');
  overlay.className = 'notification-settings-overlay notif-center-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <div class="notification-settings-sheet notif-center-sheet">
      ${renderPageHeader({ title: t('notificationCenter.title'), icon: 'close', backLabel: t('common.close') })}
      <div class="notif-center-tabs" role="tablist">
        <button type="button" class="notif-tab active" data-tab="notices" role="tab" aria-selected="true">${escapeHtml(t('notificationCenter.tab_notices'))}</button>
        <button type="button" class="notif-tab" data-tab="inquiries" role="tab" aria-selected="false">${escapeHtml(t('notificationCenter.tab_inquiries'))}</button>
      </div>
      <div class="notif-center-body">
        <div class="notif-center-list" data-list="notices" role="tabpanel">
          <div class="notif-loading">${escapeHtml(t('notificationCenter.loading'))}</div>
        </div>
        <div class="notif-center-list" data-list="inquiries" role="tabpanel" hidden>
          <div class="notif-loading">${escapeHtml(t('notificationCenter.loading'))}</div>
        </div>
      </div>
    </div>
  `;

  const wrapper = document.querySelector('.mobile-wrapper') || document.body;
  wrapper.appendChild(overlay);
  lockScroll();
  requestAnimationFrame(() => overlay.classList.add('visible'));

  /* 열람 = 읽음 처리 (배지 해제) */
  markAllRead();

  const noticeList = overlay.querySelector('.notif-center-list[data-list="notices"]');
  const inquiryList = overlay.querySelector('.notif-center-list[data-list="inquiries"]');

  /* ── 닫기 ── */
  let isClosing = false;
  const close = () => {
    if (isClosing) return;
    isClosing = true;
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('hashchange', onHashChange);
    if (observer) observer.disconnect();
    unlockScroll();
    overlay.classList.remove('visible');
    const finish = () => { if (overlay.parentNode) overlay.remove(); };
    overlay.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, 700); /* transition(0.6s) 미발생 안전망 */
  };
  bindPageHeaderBack(overlay, close);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  const onHashChange = () => close();
  window.addEventListener('hashchange', onHashChange, { once: true });

  /* ── 항목 클릭 → 상세 시트 ── */
  let noticeItems = [];
  let inquiryItems = [];
  overlay.addEventListener('click', (e) => {
    const itemEl = e.target.closest('.notif-item');
    if (!itemEl) return;
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    const { kind, id } = itemEl.dataset;
    if (kind === 'notice') {
      const n = noticeItems.find((x) => x.id === id);
      if (n) openNotifDetailSheet({ title: n.title, meta: formatDate(n.createdAtMs), body: n.body });
    } else {
      const i = inquiryItems.find((x) => x.id === id);
      if (!i) return;
      const typeLabel = t(`inquiry.type_${i.type}`);
      openNotifDetailSheet({
        title: typeLabel,
        meta: formatDate(i.createdAtMs),
        body: i.content,
        answerLabel: i.status === 'answered' ? t('notificationCenter.answer_label') : '',
        answer: i.status === 'answered' ? i.answer : '',
      });
    }
  });

  /* ── 탭 전환 ── */
  overlay.querySelectorAll('.notif-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      overlay.querySelectorAll('.notif-tab').forEach((b) => {
        const on = b === tab;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      noticeList.hidden = target !== 'notices';
      inquiryList.hidden = target !== 'inquiries';
    });
  });

  /* ── 공지 로드 + 페이지네이션 ── */
  let noticeCursor = null;
  let noticeHasMore = false;
  let loadingMore = false;
  let observer = null;

  function renderNoticeList() {
    if (!noticeItems.length) {
      noticeList.innerHTML = `<div class="notif-empty">${escapeHtml(t('notificationCenter.empty_notices'))}</div>`;
      return;
    }
    const itemsHtml = noticeItems.map(renderNoticeItem).join('');
    const moreHtml = noticeHasMore
      ? `<button type="button" class="notif-load-more">${escapeHtml(t('notificationCenter.load_more'))}</button>`
      : '';
    noticeList.innerHTML = itemsHtml + moreHtml;
    bindLoadMore();
  }

  function bindLoadMore() {
    const btn = noticeList.querySelector('.notif-load-more');
    if (!btn) return;
    btn.addEventListener('click', loadMoreNotices);
    /* jsdom 등 미지원 환경에서는 버튼 폴백만 사용 */
    if (typeof IntersectionObserver === 'function') {
      if (observer) observer.disconnect();
      observer = new IntersectionObserver((entries) => {
        if (entries.some((en) => en.isIntersecting)) loadMoreNotices();
      });
      observer.observe(btn);
    }
  }

  async function loadMoreNotices() {
    if (loadingMore || !noticeHasMore) return;
    loadingMore = true;
    if (observer) observer.disconnect();
    try {
      const res = await fetchNotices({ cursor: noticeCursor });
      noticeItems = noticeItems.concat(res.items || []);
      noticeCursor = res.cursor;
      noticeHasMore = Boolean(res.hasMore);
      renderNoticeList();
    } finally {
      loadingMore = false;
    }
  }

  (async () => {
    try {
      const res = await fetchNotices({});
      noticeItems = res.items || [];
      noticeCursor = res.cursor;
      noticeHasMore = Boolean(res.hasMore);
      if (!isClosing) renderNoticeList();
    } catch (err) {
      console.warn('공지 로드 실패:', err);
      noticeList.innerHTML = `<div class="notif-empty">${escapeHtml(t('notificationCenter.error'))}</div>`;
    }
  })();

  /* ── 내 문의 로드 ── */
  (async () => {
    const uid = getState('user')?.id;
    try {
      inquiryItems = await fetchMyInquiries(uid);
      if (isClosing) return;
      inquiryList.innerHTML = inquiryItems.length
        ? inquiryItems.map(renderInquiryItem).join('')
        : `<div class="notif-empty">${escapeHtml(t('notificationCenter.empty_inquiries'))}</div>`;
    } catch (err) {
      console.warn('문의 로드 실패:', err);
      inquiryList.innerHTML = `<div class="notif-empty">${escapeHtml(t('notificationCenter.error'))}</div>`;
    }
  })();

  return overlay;
}

/* =====================================================================
   상세 바텀시트 — introSheet/inquirySheet 의 토스 스타일 드래그-투-클로즈 재사용
   ===================================================================== */
export function openNotifDetailSheet({ title, meta = '', body = '', answerLabel = '', answer = '', details = [] }) {
  if (document.querySelector('.notif-detail-overlay')) return null;

  const detailRows = Array.isArray(details)
    ? details.filter((row) => row?.label && row?.value != null && String(row.value).trim() !== '')
    : [];
  const detailsHtml = detailRows.length
    ? `<dl class="notif-detail-info">
        ${detailRows.map((row) => `
          <div class="notif-detail-info-row">
            <dt class="notif-detail-info-label">${escapeHtml(row.label)}</dt>
            <dd class="notif-detail-info-value">${escapeHtml(String(row.value))}</dd>
          </div>`).join('')}
      </dl>`
    : '';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay notif-detail-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <div class="modal-sheet notif-detail-sheet" role="document">
      <div class="notif-detail-handle-area" aria-hidden="true">
        <div class="notif-detail-handle"></div>
      </div>
      <button type="button" class="notif-detail-close" aria-label="${escapeHtml(t('common.close'))}">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <div class="notif-detail-scroll">
        <h2 class="notif-detail-title">${escapeHtml(title)}</h2>
        ${meta ? `<div class="notif-detail-meta">${escapeHtml(meta)}</div>` : ''}
        <div class="notif-detail-body">${escapeHtml(body)}</div>
        ${detailsHtml}
        ${answer ? `
          <div class="notif-detail-answer">
            <div class="notif-detail-answer-label">${escapeHtml(answerLabel)}</div>
            <div class="notif-detail-answer-text">${escapeHtml(answer)}</div>
          </div>` : ''}
      </div>
    </div>
  `;

  const wrapper = document.querySelector('.mobile-wrapper') || document.body;
  wrapper.appendChild(overlay);
  lockScroll();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => overlay.classList.add('visible'));
  });

  const sheet = overlay.querySelector('.notif-detail-sheet');
  const handleArea = overlay.querySelector('.notif-detail-handle-area');
  const scrollEl = overlay.querySelector('.notif-detail-scroll');

  let isClosing = false;
  let isDragging = false;
  let touchStartY = 0;
  let touchStartTime = 0;
  let currentOffset = 0;

  const close = () => {
    if (isClosing) return;
    isClosing = true;
    isDragging = false;
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('hashchange', onHashChange);
    unlockScroll();
    sheet.classList.remove('is-dragging');
    sheet.style.transform = 'translateY(100%)';
    overlay.classList.remove('visible');
    const finish = () => { if (overlay.parentNode) overlay.remove(); };
    overlay.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, 360);
  };

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('.notif-detail-close')?.addEventListener('click', close);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  const onHashChange = () => close();
  window.addEventListener('hashchange', onHashChange, { once: true });

  /* ── 드래그-투-클로즈 (inquirySheet 패턴 동일) ── */
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
