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

import { openCardPopup } from './calendar.js';
import { escapeHtml } from '../utils/sanitize.js';
import { safeStoryDateParts } from '../utils/date.js';
import { t } from '../i18n/index.js';
import { localizedStory } from '../utils/storyI18n.js';
import { showToast } from '../components/toast.js';


export function renderArchiveSection() {
  return `
    <div class="archive-page">
      <div class="archive-section-header">
        <span class="archive-section-label">${t('bookmarks.section_label')}</span>
        <div class="search-bar archive-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" id="collection-search-input" placeholder="${t('common.search_placeholder')}" autocomplete="off" />
          <button type="button" class="search-clear" id="collection-search-clear" aria-label="${t('common.clear')}" hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/>
            </svg>
          </button>
        </div>
      </div>
      <div id="archive-content" class="archive-content-loading">
        <div class="loading-spinner"></div>
      </div>
    </div>
  `;
}

export function initArchiveSection(page) {
  loadCollection(page);
}

export function renderBookmarks() {
  const page = document.createElement('div');
  page.className = 'archive-page page';

  page.innerHTML = `
    <div class="page-header page-header-centered">
      <h1 class="page-header-title">${t('bookmarks.title')}</h1>
    </div>
    <div class="archive-section-header">
      <span class="archive-section-label">${t('bookmarks.section_label')}</span>
      <div class="search-bar archive-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input type="text" id="collection-search-input" placeholder="${t('common.search_placeholder')}" autocomplete="off" />
        <button type="button" class="search-clear" id="collection-search-clear" aria-label="${t('common.clear')}" hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/>
          </svg>
        </button>
      </div>
    </div>
    <div id="archive-content" class="archive-content-loading">
      <div class="loading-spinner"></div>
    </div>
  `;

  initArchiveSection(page);
  return page;
}


async function loadCollection(page) {
  const contentEl = page.querySelector('#archive-content');

  const bookmarkStoriesRaw = await getBookmarkedStories().catch(() => []);
  const bookmarkStories = (bookmarkStoriesRaw || []).map(localizedStory);
  bookmarkStories.sort((a, b) =>
    String(b.publish_date || '').localeCompare(String(a.publish_date || ''))
  );

  const state = {
    bookmarks: bookmarkStories,
    queryStr: '',
  };

  const filterAndRender = () => {
    const list = state.queryStr
      ? state.bookmarks.filter(story =>
          (story.figure_name || '').toLowerCase().includes(state.queryStr) ||
          (story.country || '').toLowerCase().includes(state.queryStr) ||
          (story.summary || '').toLowerCase().includes(state.queryStr)
        )
      : state.bookmarks;
    renderStories(contentEl, list, 'bookmarks', (story) => onCardClick(state, story), {
      searching: Boolean(state.queryStr),
      onToggle: (story, bookmarked) => {
        if (!story) return;
        if (!bookmarked) {
          state.bookmarks = state.bookmarks.filter(s => s.id !== story.id);
        } else if (!state.bookmarks.some(s => s.id === story.id)) {
          state.bookmarks.push(story);
        }
      },
    });
  };

  filterAndRender();

  /* 검색 */
  const searchInput = page.querySelector('#collection-search-input');
  const searchClearBtn = page.querySelector('#collection-search-clear');
  const syncClearBtn = () => {
    if (!searchClearBtn) return;
    searchClearBtn.hidden = !searchInput.value;
  };
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.queryStr = e.target.value.trim().toLowerCase();
      syncClearBtn();
      filterAndRender();
    });
  }
  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      if (!searchInput) return;
      searchInput.value = '';
      state.queryStr = '';
      syncClearBtn();
      filterAndRender();
      searchInput.focus();
    });
  }

  function onCardClick(stateRef, story) {
    openCardPopup(story, 'history', stateRef.bookmarks.map(s => s.id), {
      hideHint: true,
      onRemove: async (target) => {
        await removeCard(stateRef, target);
        showToast(t('bookmarks.removed'), 'success');
        filterAndRender();
      },
      onBookmarkChange: (storyId, bookmarked) => {
        if (!bookmarked) {
          stateRef.bookmarks = stateRef.bookmarks.filter(s => s.id !== storyId);
        } else if (!stateRef.bookmarks.some(s => s.id === storyId)) {
          stateRef.bookmarks.push(story);
        }
        const miniBtn = document.querySelector(`.mini-bookmark-btn[data-story-id="${storyId}"]`);
        if (miniBtn) miniBtn.classList.toggle('active', bookmarked);
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

  try {
    await toggleBookmark(story.id);
  } catch {
    /* 실패해도 화면에선 빼서 일관성 유지 */
  }
  state.bookmarks = state.bookmarks.filter((s) => s.id !== story.id);
}


function renderStories(contentEl, list, tab, onClick, opts = {}) {
  if (!list.length) {
    contentEl.className = '';
    contentEl.style.display = 'flex';
    contentEl.style.padding = '';
    const title = opts.searching
      ? t('bookmarks.empty_search')
      : (tab === 'received' ? t('bookmarks.empty_received') : t('bookmarks.empty_mine'));
    const desc = !opts.searching && tab === 'received'
      ? `<div class="empty-state-desc">${t('bookmarks.empty_received_desc')}</div>`
      : '';
    contentEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">${title}</div>
        ${desc}
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

  contentEl.querySelectorAll('.mini-bookmark-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const storyId = btn.dataset.storyId;
      const story = list.find((s) => s.id === storyId);
      const res = await toggleBookmark(storyId);
      btn.classList.toggle('active', res.bookmarked);
      if (opts.onToggle) opts.onToggle(story, res.bookmarked);
    });
  });
}


function renderMiniCard(story) {
  const { valid, year, month, day } = safeStoryDateParts(story);

  const monthLabel = valid ? month : '';
  const dayLabel = valid ? (day < 10 ? '0' + day : day) : '';
  const dateMeta = valid
    ? `${year} / ${String(month).padStart(2, '0')} / ${String(day).padStart(2, '0')}`
    : '';
  const imageUrl = story.image_url || '';
  const imageAttrs = imageUrl ? `src="${escapeHtml(imageUrl)}"` : '';

  return `
    <div class="history-card-mini" data-story-id="${escapeHtml(story.id)}">
      <div class="mini-card-top">
        <div class="mini-top-left">
          <div class="mini-year">${escapeHtml(story.historical_year || '')}</div>
          <div class="mini-date">${monthLabel}${monthLabel !== '' && dayLabel !== '' ? '. ' : ''}${dayLabel}</div>
        </div>
        <div class="mini-top-right">
          <button class="mini-bookmark-btn bookmark-btn active" data-story-id="${escapeHtml(story.id)}" aria-label="북마크">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
          <span class="mini-top-text">
            ${escapeHtml(story.card_count || '')} ${escapeHtml(story.country || '')}<br>
            ${dateMeta}
          </span>
        </div>
      </div>
      <div class="mini-card-image-wrap">
        <img ${imageAttrs} alt="${escapeHtml(story.figure_name || '')}" loading="lazy" decoding="async" />
        <div class="mini-card-overlay">
          ${escapeHtml(story.figure_name || '')}
        </div>
      </div>
    </div>
  `;
}
