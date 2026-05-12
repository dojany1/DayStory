/* =====================================================================
   bookmarks.js — 보관함 페이지
   =====================================================================
   두 개의 탭으로 분리:
     - 내 보관함 : 직접 북마크한 카드 (Firestore bookmarks)
     - 받은 카드 : SNS 공유로 받은 카드 + DOKHU 멤버십 카드 (localStorage)
   카드 클릭 시 캘린더 모달과 동일한 카드 팝업으로 열고, 카드를 뒤집어
   삭제 버튼으로 해당 카드를 보관함에서 제거할 수 있다.
   ===================================================================== */

import { getBookmarkedStories, toggleBookmark } from '../services/bookmarks.js';
import { getReceivedStories, removeReceived } from '../services/receivedCards.js';

import { openCardPopup } from './calendar.js';
import { escapeHtml } from '../utils/sanitize.js';
import { safeStoryDateParts } from '../utils/date.js';
import { CARD_PLACEHOLDER_IMAGE, getStoryImageSources, prepareLazyImages } from '../utils/imageLoading.js';
import { t } from '../i18n/index.js';
import { localizedStory } from '../utils/storyI18n.js';
import { showToast } from '../components/toast.js';


export function renderBookmarks() {
  const page = document.createElement('div');
  page.className = 'archive-page page';

  page.innerHTML = `
    <div class="page-header page-header-centered">
      <h1 class="page-header-title">${t('bookmarks.title')}</h1>
    </div>

    <div class="calendar-toggle archive-toggle" data-mode="bookmarks" role="tablist">
      <button type="button" class="calendar-toggle-btn active" data-tab="bookmarks" role="tab" aria-selected="true">${t('bookmarks.tab_mine')}</button>
      <button type="button" class="calendar-toggle-btn" data-tab="received" role="tab" aria-selected="false">${t('bookmarks.tab_received')}</button>
      <span class="calendar-toggle-thumb"></span>
    </div>

    <div class="search-bar archive-search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input type="text" id="collection-search-input" placeholder="${t('common.search_placeholder')}" autocomplete="off" />
    </div>

    <div id="archive-content" class="archive-content-loading">
      <div class="loading-spinner"></div>
    </div>
  `;

  loadCollection(page);
  return page;
}


async function loadCollection(page) {
  const contentEl = page.querySelector('#archive-content');

  const [bookmarkStoriesRaw, receivedStoriesRaw] = await Promise.all([
    getBookmarkedStories().catch(() => []),
    getReceivedStories().catch(() => []),
  ]);
  const bookmarkStories = (bookmarkStoriesRaw || []).map(localizedStory);
  const receivedStories = (receivedStoriesRaw || []).map(localizedStory);

  const sortByDate = (list) => list.sort((a, b) =>
    String(b.publish_date || '').localeCompare(String(a.publish_date || ''))
  );
  sortByDate(bookmarkStories);
  sortByDate(receivedStories);

  const state = {
    tab: 'bookmarks',
    bookmarks: bookmarkStories,
    received: receivedStories,
    queryStr: '',
  };

  const filterAndRender = () => {
    const source = state.tab === 'bookmarks' ? state.bookmarks : state.received;
    const list = state.queryStr
      ? source.filter(story =>
          (story.figure_name || '').toLowerCase().includes(state.queryStr) ||
          (story.country || '').toLowerCase().includes(state.queryStr) ||
          (story.summary || '').toLowerCase().includes(state.queryStr)
        )
      : source;
    renderStories(contentEl, list, state.tab, (story) => onCardClick(state, story));
  };

  filterAndRender();

  /* 탭 전환 */
  const toggleEl = page.querySelector('.archive-toggle');
  toggleEl.querySelectorAll('.calendar-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab === state.tab) return;
      state.tab = tab;
      toggleEl.dataset.mode = tab;
      toggleEl.querySelectorAll('.calendar-toggle-btn').forEach(b => {
        const active = b.dataset.tab === tab;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      filterAndRender();
    });
  });

  /* 검색 */
  const searchInput = page.querySelector('#collection-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.queryStr = e.target.value.trim().toLowerCase();
      filterAndRender();
    });
  }

  function onCardClick(stateRef, story) {
    openCardPopup(story, 'history', [], {
      onRemove: async (target) => {
        await removeCard(stateRef, target);
        showToast(t('bookmarks.removed'), 'success');
        filterAndRender();
      },
    });
  }
}

/**
 * removeCard — 카드 종류를 판별해 적절한 저장소에서 삭제하고
 * 화면 상태(state.bookmarks/received) 에서도 즉시 제거한다.
 */
async function removeCard(state, story) {
  if (!story || !story.id) return;

  if (story.isMembershipCard) {
    removeMembershipCardById(story.id);
    state.received = state.received.filter((s) => s.id !== story.id);
    return;
  }

  /* 받은 카드 (SNS 공유) — receivedCards localStorage */
  if (state.received.some((s) => s.id === story.id) && !state.bookmarks.some((s) => s.id === story.id)) {
    removeReceived(story.id);
    state.received = state.received.filter((s) => s.id !== story.id);
    return;
  }

  /* 내 보관함 — toggleBookmark 로 해제 */
  try {
    await toggleBookmark(story.id);
  } catch {
    /* 실패해도 화면에선 빼서 일관성 유지 */
  }
  state.bookmarks = state.bookmarks.filter((s) => s.id !== story.id);
}


function renderStories(contentEl, list, tab, onClick) {
  if (!list.length) {
    contentEl.className = '';
    contentEl.style.display = 'flex';
    contentEl.style.padding = '';
    contentEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">${
          tab === 'received' ? t('bookmarks.empty_received') : t('bookmarks.empty_mine')
        }</div>
        ${tab === 'received'
          ? `<div class="empty-state-desc">${t('bookmarks.empty_received_desc')}</div>`
          : ''}
      </div>
    `;
    return;
  }

  contentEl.className = 'archive-grid';
  contentEl.style.display = '';
  contentEl.style.padding = '';
  contentEl.innerHTML = list.map(story => renderMiniCard(story)).join('');

  contentEl.querySelectorAll('.history-card-mini').forEach((card, idx) => {
    const story = list[idx];
    card.addEventListener('click', () => onClick(story));
  });
  prepareLazyImages(contentEl);
}


function renderMiniCard(story) {
  const { valid, year, month, day } = safeStoryDateParts(story);

  const monthLabel = valid ? month : '';
  const dayLabel = valid ? (day < 10 ? '0' + day : day) : '';
  const dateMeta = valid
    ? `${year} / ${String(month).padStart(2, '0')} / ${String(day).padStart(2, '0')}`
    : '';
  const imageSources = getStoryImageSources(story, 'thumb');
  const imageUrl = imageSources.primary;
  const fallbackAttr = imageSources.fallback
    ? ` data-fallback-src="${escapeHtml(imageSources.fallback)}"`
    : '';
  const imageAttrs = imageUrl
    ? `src="${CARD_PLACEHOLDER_IMAGE}" data-src="${escapeHtml(imageUrl)}"${fallbackAttr}`
    : `src="${CARD_PLACEHOLDER_IMAGE}"`;

  return `
    <div class="history-card-mini" data-story-id="${escapeHtml(story.id)}">
      <div class="mini-card-top">
        <div class="mini-top-left">
          <div class="mini-year">${escapeHtml(story.historical_year || '')}</div>
          <div class="mini-date">${monthLabel}${monthLabel !== '' && dayLabel !== '' ? '. ' : ''}${dayLabel}</div>
        </div>
        <div class="mini-top-right">
          ${escapeHtml(story.card_count || '')} ${escapeHtml(story.country || '')}<br>
          ${dateMeta}
        </div>
      </div>
      <div class="mini-card-image-wrap">
        <img ${imageAttrs} alt="${escapeHtml(story.figure_name || '')}" loading="lazy" decoding="async" onerror="if(this.dataset.fallbackSrc){this.src=this.dataset.fallbackSrc;delete this.dataset.fallbackSrc}else{this.src='${CARD_PLACEHOLDER_IMAGE}'}" />
        <div class="mini-card-overlay">
          ${escapeHtml(story.figure_name || '')}
        </div>
      </div>
    </div>
  `;
}
