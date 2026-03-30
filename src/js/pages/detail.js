/* ============================================
   DayStory — Detail Page (Supabase)
   ============================================ */
import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';
import { fetchStoryById } from '../services/stories.js';
import { toggleBookmark, isBookmarked } from '../services/bookmarks.js';

export function renderDetail(params) {
  const page = document.createElement('div');
  page.className = 'detail-page page';
  page.innerHTML = `<div style="display:flex;justify-content:center;align-items:center;min-height:60vh;"><div class="loading-spinner"></div></div>`;
  loadDetail(page, params.id);
  return page;
}

async function loadDetail(page, storyId) {
  const story = await fetchStoryById(storyId);
  if (!story) {
    page.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-title">일화를 찾을 수 없습니다</div></div>';
    return;
  }

  let bookmarked = await isBookmarked(storyId);

  const pubDate = new Date(story.publish_date);
  const month = pubDate.getMonth() + 1;
  const day = pubDate.getDate();

  const bodyHtml = story.body.split('\n').filter(p => p.trim()).map(p => `<p>${p}</p>`).join('');

  const sources = story.story_sources || story.sources || [];

  page.innerHTML = `
    <div class="detail-header" id="detail-header">
      <button class="page-header-back" id="detail-back">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <div class="detail-header-actions">
        <button class="btn-icon bookmark-btn ${bookmarked ? 'active' : ''}" id="detail-bookmark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
        <button class="btn-icon" id="detail-share">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
        </button>
        <button class="btn-icon" id="detail-more">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="detail-hero">
      <img src="${story.image_url}" alt="${story.figure_name}" />
      <div class="detail-hero-overlay">
        <div class="detail-hero-year">${story.historical_year}</div>
        <div class="detail-hero-monthday">${month}. ${day < 10 ? '0' + day : day}</div>
        <span class="detail-hero-tag">${story.card_count || ''} &nbsp;·&nbsp; ${story.country}</span>
      </div>
    </div>

    <div class="detail-content">
      <h1 class="detail-figure-name">${story.figure_name}</h1>
      <div class="detail-body">${bodyHtml}</div>
      <div class="detail-historical-date">${story.historical_date}</div>

      ${sources.length ? `
        <div class="detail-sources">
          <div class="detail-sources-title">📚 참고 자료</div>
          ${sources.map(s => `
            <a href="${s.url}" target="_blank" rel="noopener" class="detail-source-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              ${s.title}
            </a>
          `).join('')}
        </div>
      ` : ''}

      <div class="detail-actions-bar">
        <button class="detail-action-btn ${bookmarked ? 'active' : ''}" id="action-bookmark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
          <span>북마크</span>
        </button>
        <button class="detail-action-btn" id="action-share">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
          <span>공유</span>
        </button>
        <button class="detail-action-btn" id="action-report">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>오류 신고</span>
        </button>
      </div>
    </div>
  `;

  /* Event listeners */
  document.getElementById('detail-back')?.addEventListener('click', () => window.history.back());

  const handleBookmark = async () => {
    const result = await toggleBookmark(storyId);
    bookmarked = result.bookmarked;
    page.querySelectorAll('#detail-bookmark, #action-bookmark').forEach(b => b.classList.toggle('active', bookmarked));
    showToast(bookmarked ? '북마크에 저장했습니다' : '북마크를 해제했습니다', 'success');
  };
  document.getElementById('detail-bookmark')?.addEventListener('click', handleBookmark);
  document.getElementById('action-bookmark')?.addEventListener('click', handleBookmark);

  const shareAction = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: story.title, text: story.summary, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(story.summary + '\n\n— DayStory');
        showToast('클립보드에 복사했습니다', 'success');
      }
    } catch (e) { /* cancelled */ }
  };
  document.getElementById('detail-share')?.addEventListener('click', shareAction);
  document.getElementById('action-share')?.addEventListener('click', shareAction);

  document.getElementById('action-report')?.addEventListener('click', () => navigate('/report', { storyId: story.id }));
  document.getElementById('detail-more')?.addEventListener('click', () => showToast('더보기 메뉴 (준비중)', 'info'));
}
