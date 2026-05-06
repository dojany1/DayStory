/* =====================================================================
   bookmarks.js — 북마크 페이지
   =====================================================================
   사용자가 북마크(찜)한 역사 카드들을 모아보는 페이지입니다.
   기존 프로필 페이지에서 분리된 검색창 + 카드 그리드를 담당합니다.
   ===================================================================== */

import { navigate } from '../router.js';
import { getBookmarkedStories } from '../services/bookmarks.js';
import { escapeHtml } from '../utils/sanitize.js';
import { safeStoryDateParts } from '../utils/date.js';

const PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='400' viewBox='0 0 300 400'%3E%3Crect fill='%23e0e0e0' width='300' height='400'/%3E%3Ctext x='50%25' y='45%25' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='40'%3E%F0%9F%93%B7%3C/text%3E%3C/svg%3E";


export function renderBookmarks() {
  const page = document.createElement('div');
  page.className = 'archive-page page';

  page.innerHTML = `
    <div class="page-header page-header-centered">
      <h1 class="page-header-title">보관함</h1>
    </div>

    <div class="profile-collection-toolbar">
      <div class="search-bar profile-collection-search" id="collection-search-bar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input type="text" id="collection-search-input" placeholder="검색..." autocomplete="off" />
      </div>
    </div>

    <div id="archive-content" class="archive-content-loading">
      <div class="loading-spinner"></div>
    </div>
  `;

  loadCollection(page);
  return page;
}


/* ─────────────────────────────────────────────
   북마크 데이터 로딩
   ───────────────────────────────────────────── */
async function loadCollection(page) {
  const contentEl = page.querySelector('#archive-content');

  try {
    const stories = await getBookmarkedStories();
    const allBookmarks = stories || [];

    /* 발행 날짜 기준 최신순 정렬 */
    allBookmarks.sort((a, b) => {
      return String(b.publish_date || '').localeCompare(String(a.publish_date || ''));
    });

    const renderStories = (list) => {
      if (!list.length) {
        contentEl.className = '';
        contentEl.style.display = 'flex';
        contentEl.style.padding = '';
        contentEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-title">보관된 카드가 없습니다.</div>
          </div>
        `;
        return;
      }

      contentEl.className = 'archive-grid';
      contentEl.style.display = '';
      contentEl.style.padding = '';
      contentEl.innerHTML = list.map(story => renderMiniCard(story)).join('');

      contentEl.querySelectorAll('.history-card-mini').forEach(card => {
        card.addEventListener('click', () => {
          navigate('/detail/' + card.dataset.storyId);
        });
      });
    };

    renderStories(allBookmarks);

    /* 검색 (로컬 필터링) */
    const searchInput = page.querySelector('#collection-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const queryStr = e.target.value.trim().toLowerCase();
        if (!queryStr) {
          renderStories(allBookmarks);
        } else {
          const filtered = allBookmarks.filter(story =>
            (story.figure_name || '').toLowerCase().includes(queryStr) ||
            (story.country || '').toLowerCase().includes(queryStr) ||
            (story.summary || '').toLowerCase().includes(queryStr)
          );
          renderStories(filtered);
        }
      });
    }

  } catch (err) {
    console.error('북마크 로딩 실패:', err);
    contentEl.className = '';
    contentEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">데이터를 불러오지 못했습니다</div>
        <div class="empty-state-desc">네트워크 상태를 확인해주세요</div>
        <button class="btn btn-primary" onclick="location.reload()" style="margin-top:var(--space-4)">
          다시 시도
        </button>
      </div>
    `;
  }
}


/* ─────────────────────────────────────────────
   미니 카드 HTML 생성 — 날짜/이미지가 누락되어도 NaN/깨진 이미지 없이 안전하게 표시
   ───────────────────────────────────────────── */
function renderMiniCard(story) {
  const { valid, year, month, day } = safeStoryDateParts(story);

  const monthLabel = valid ? month : '';
  const dayLabel = valid ? (day < 10 ? '0' + day : day) : '';
  const dateMeta = valid
    ? `${year} / ${String(month).padStart(2, '0')} / ${String(day).padStart(2, '0')}`
    : '';
  const imageUrl = story.image_url || PLACEHOLDER_IMG;

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
        <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(story.figure_name || '')}" loading="lazy" decoding="async" onerror="this.src='${PLACEHOLDER_IMG}'" />
        <div class="mini-card-overlay">
          ${escapeHtml(story.figure_name || '')}
        </div>
      </div>
    </div>
  `;
}
