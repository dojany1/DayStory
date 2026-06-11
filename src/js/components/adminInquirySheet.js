/* =====================================================================
   adminInquirySheet.js — 어드민 전용 "사용자 문의" 알림 탭
   =====================================================================
   진입: editor(관리자) 페이지 헤더 우측의 문의함 버튼.
   전체 사용자가 보낸 inquiries 를 최신순으로 페이지네이션 조회해 보여준다.
   현재 범위는 읽기 전용 목록/상세 확인이며, 답변 작성 기능은 아직 예정에 없다.
   notificationCenterSheet.js 의
   상세 바텀시트(openNotifDetailSheet)와 레이아웃(.notif-center-*)을 재사용한다.

   데이터/Firestore 는 services/notificationCenter.js 가 담당(CLAUDE.md 아키텍처 규칙).
   ===================================================================== */

import { escapeHtml } from '../utils/sanitize.js';
import { t } from '../i18n/index.js';
import { lockScroll, unlockScroll } from '../utils/scrollLock.js';
import { renderPageHeader, bindPageHeaderBack } from './pageHeader.js';
import { fetchAdminInquiries } from '../services/notificationCenter.js';
import { formatDate, openNotifDetailSheet } from './notificationCenterSheet.js';

const INBOX_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>';

/**
 * renderAdminInquiryButton — 관리자 페이지 헤더 우측에 끼울 문의함 버튼 HTML.
 * @returns {string}
 */
export function renderAdminInquiryButton() {
  return `<button type="button" id="admin-inquiry-btn" class="notif-bell-btn page-header-back" aria-label="${escapeHtml(t('adminInquiry.aria_open'))}">${INBOX_SVG}</button>`;
}

function renderInquiryItem(i) {
  const typeLabel = t(`inquiry.type_${i.type}`);
  const statusBadge = i.status === 'answered'
    ? `<span class="notif-status notif-status-answered">${escapeHtml(t('notificationCenter.status_answered'))}</span>`
    : '';
  return `
    <button type="button" class="notif-item" data-id="${escapeHtml(i.id)}">
      <div class="notif-item-main">
        <div class="notif-item-title">
          ${escapeHtml(typeLabel)}
          ${statusBadge}
        </div>
        <div class="notif-item-preview">${escapeHtml(i.content)}</div>
      </div>
      <div class="notif-item-time">${escapeHtml(formatDate(i.createdAtMs))}</div>
    </button>`;
}

function buildAdminInquiryDetails(i) {
  const os = i?.os || {};
  const osText = [os.operatingSystem, os.osVersion].filter(Boolean).join(' ');
  return [
    { label: t('adminInquiry.meta_app_version'), value: i.appVersion },
    { label: t('adminInquiry.meta_entry_card_id'), value: i.entryCardId },
    { label: t('adminInquiry.meta_locale'), value: i.locale },
    { label: t('adminInquiry.meta_platform'), value: i.platform },
    { label: t('adminInquiry.meta_os'), value: osText },
    { label: t('adminInquiry.meta_model'), value: os.model },
    { label: t('adminInquiry.meta_manufacturer'), value: os.manufacturer },
    { label: t('adminInquiry.meta_user_id'), value: i.userId },
  ].filter((row) => row.value != null && String(row.value).trim() !== '')
    .map((row) => ({ label: row.label, value: String(row.value) }));
}

/**
 * showAdminInquirySheet — 어드민 전용 사용자 문의 목록 풀시트를 띄운다.
 * @returns {HTMLElement|null} 생성된 overlay (이미 떠 있으면 null)
 */
export function showAdminInquirySheet() {
  if (document.querySelector('.admin-inquiry-overlay')) return null;

  const overlay = document.createElement('div');
  overlay.className = 'notification-settings-overlay admin-inquiry-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <div class="notification-settings-sheet notif-center-sheet">
      ${renderPageHeader({ title: t('adminInquiry.title'), icon: 'close', backLabel: t('common.close') })}
      <div class="notif-center-body">
        <div class="notif-center-list" data-list="inquiries">
          <div class="notif-loading">${escapeHtml(t('notificationCenter.loading'))}</div>
        </div>
      </div>
    </div>
  `;

  const wrapper = document.querySelector('.mobile-wrapper') || document.body;
  wrapper.appendChild(overlay);
  lockScroll();
  requestAnimationFrame(() => overlay.classList.add('visible'));

  const list = overlay.querySelector('.notif-center-list[data-list="inquiries"]');

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
    setTimeout(finish, 700);
  };
  bindPageHeaderBack(overlay, close);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  const onHashChange = () => close();
  window.addEventListener('hashchange', onHashChange, { once: true });

  /* ── 항목 클릭 → 상세 시트 ── */
  let items = [];
  overlay.addEventListener('click', (e) => {
    const itemEl = e.target.closest('.notif-item');
    if (!itemEl) return;
    const i = items.find((x) => x.id === itemEl.dataset.id);
    if (!i) return;
    openNotifDetailSheet({
      title: t(`inquiry.type_${i.type}`),
      meta: formatDate(i.createdAtMs),
      body: i.content,
      answerLabel: i.status === 'answered' ? t('notificationCenter.answer_label') : '',
      answer: i.status === 'answered' ? i.answer : '',
      details: buildAdminInquiryDetails(i),
    });
  });

  /* ── 목록 로드 + 페이지네이션 ── */
  let cursor = null;
  let hasMore = false;
  let loadingMore = false;
  let observer = null;

  function renderList() {
    if (!items.length) {
      list.innerHTML = `<div class="notif-empty">${escapeHtml(t('adminInquiry.empty'))}</div>`;
      return;
    }
    const itemsHtml = items.map(renderInquiryItem).join('');
    const moreHtml = hasMore
      ? `<button type="button" class="notif-load-more">${escapeHtml(t('notificationCenter.load_more'))}</button>`
      : '';
    list.innerHTML = itemsHtml + moreHtml;
    bindLoadMore();
  }

  function bindLoadMore() {
    const btn = list.querySelector('.notif-load-more');
    if (!btn) return;
    btn.addEventListener('click', loadMore);
    if (typeof IntersectionObserver === 'function') {
      if (observer) observer.disconnect();
      observer = new IntersectionObserver((entries) => {
        if (entries.some((en) => en.isIntersecting)) loadMore();
      });
      observer.observe(btn);
    }
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    loadingMore = true;
    if (observer) observer.disconnect();
    try {
      const res = await fetchAdminInquiries({ cursor });
      items = items.concat(res.items || []);
      cursor = res.cursor;
      hasMore = Boolean(res.hasMore);
      renderList();
    } finally {
      loadingMore = false;
    }
  }

  (async () => {
    try {
      const res = await fetchAdminInquiries({});
      items = res.items || [];
      cursor = res.cursor;
      hasMore = Boolean(res.hasMore);
      if (!isClosing) renderList();
    } catch (err) {
      console.warn('어드민 문의 로드 실패:', err);
      list.innerHTML = `<div class="notif-empty">${escapeHtml(t('notificationCenter.error'))}</div>`;
    }
  })();

  return overlay;
}
