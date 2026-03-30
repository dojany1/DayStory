/* ============================================
   DayStory — Search Page (Supabase)
   ============================================ */
import { navigate } from '../router.js';
import { searchStoriesDB, fetchStories } from '../services/stories.js';

export function renderSearch() {
  const page = document.createElement('div');
  page.className = 'search-page page';

  page.innerHTML = `
    <div class="page-header" style="padding-left:0;padding-right:0;">
      <h1 class="page-header-title">검색</h1>
    </div>
    <div class="search-bar" id="search-bar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input type="text" id="search-input" placeholder="인물, 사건, 국가로 검색..." autocomplete="off" />
    </div>
    <div id="search-results" class="search-results">
      <div style="display:flex;justify-content:center;padding:var(--space-6);"><div class="loading-spinner"></div></div>
    </div>
    <div id="search-empty" class="empty-state" style="display:none;">
      <div class="empty-state-icon">🔍</div>
      <div class="empty-state-title">검색 결과가 없습니다</div>
      <div class="empty-state-desc">다른 키워드로 검색해보세요</div>
    </div>
  `;

  /* Load all stories initially */
  (async () => {
    const all = await fetchStories();
    const resultsEl = document.getElementById('search-results');
    if (resultsEl) {
      resultsEl.innerHTML = all.map(s => renderSearchItem(s)).join('');
      bindClicks();
    }
  })();

  setTimeout(() => {
    const input = document.getElementById('search-input');
    let debounceTimer;

    input?.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const q = input.value.trim();
        const resultsEl = document.getElementById('search-results');
        const emptyEl = document.getElementById('search-empty');

        if (!q) {
          const all = await fetchStories();
          resultsEl.innerHTML = all.map(s => renderSearchItem(s)).join('');
          emptyEl.style.display = 'none';
          resultsEl.style.display = 'flex';
          bindClicks();
          return;
        }

        const results = await searchStoriesDB(q);
        if (results.length) {
          resultsEl.innerHTML = results.map(s => renderSearchItem(s)).join('');
          emptyEl.style.display = 'none';
          resultsEl.style.display = 'flex';
        } else {
          resultsEl.style.display = 'none';
          emptyEl.style.display = 'flex';
        }
        bindClicks();
      }, 300);
    });
  }, 0);

  return page;
}

function bindClicks() {
  document.querySelectorAll('.search-result-item').forEach(item => {
    item.addEventListener('click', () => navigate('/detail/' + item.dataset.storyId));
  });
}

function renderSearchItem(story) {
  const pubDate = new Date(story.publish_date);
  const dateStr = `${pubDate.getFullYear()}.${pubDate.getMonth()+1}.${pubDate.getDate()}`;
  return `
    <div class="search-result-item" data-story-id="${story.id}">
      <div class="search-result-thumb">
        <img src="${story.image_url}" alt="${story.figure_name}" loading="lazy" />
      </div>
      <div class="search-result-info">
        <div class="search-result-date">${dateStr} · ${story.country}</div>
        <div class="search-result-title">${story.figure_name}</div>
        <div class="search-result-summary">${story.summary}</div>
      </div>
    </div>
  `;
}
