/* ============================================
   DayStory — Home Page (Supabase)
   ============================================ */
import { navigate } from '../router.js';
import { formatDateKR } from '../utils/date.js';
import { fetchStories, fetchTodayStory } from '../services/stories.js';
import { getBookmarkCount } from '../services/bookmarks.js';

export function renderHome() {
  const page = document.createElement('div');
  page.className = 'home-page page';

  /* Show loading first */
  page.innerHTML = `
    <div class="home-greeting">
      <p class="home-date">${formatDateKR(new Date())}</p>
      <h1 class="home-title">오늘의 카드</h1>
    </div>
    <div style="display:flex;justify-content:center;padding:var(--space-8);">
      <div class="loading-spinner"></div>
    </div>
  `;

  loadHomeData(page);
  return page;
}

async function loadHomeData(page) {
  try {
    const [todayStory, allStories, bmCount] = await Promise.all([
      fetchTodayStory(),
      fetchStories(),
      getBookmarkCount(),
    ]);

    const today = new Date();
    const recentStories = allStories.filter(s => s.id !== todayStory.id).slice(0, 3);
    const totalCards = allStories.length;

    const pubDate = new Date(todayStory.publish_date);
    const month = pubDate.getMonth() + 1;
    const day = pubDate.getDate();

    page.innerHTML = `
      <div class="home-greeting">
        <p class="home-date">${formatDateKR(today)}</p>
        <h1 class="home-title">오늘의 카드</h1>
      </div>

      <div class="home-card-container">
        <div class="home-card-wrapper" id="today-card">
          <div class="history-card">
            <img class="history-card-image" src="${todayStory.image_url}" alt="${todayStory.figure_name}" loading="eager" />
            <div class="history-card-overlay">
              <div class="history-card-year">${todayStory.historical_year}</div>
              <div class="history-card-date">${month}. ${day < 10 ? '0' + day : day}</div>
            </div>
            <div class="history-card-meta">
              <div class="history-card-meta-count">${todayStory.card_count || ''}</div>
              <div>${todayStory.country}</div>
              <div style="margin-top:var(--space-1);font-size:var(--text-xs);opacity:0.6">${today.getFullYear()} / ${String(month).padStart(2,'0')} / ${String(day).padStart(2,'0')}</div>
            </div>
            <div class="history-card-bottom">
              <span class="history-card-tag">${todayStory.country}</span>
              <div class="history-card-figure">${todayStory.figure_name}</div>
            </div>
          </div>
          <div class="home-card-shadow"></div>
        </div>
      </div>

      <div class="home-stats">
        <div class="home-stat">
          <div class="home-stat-value">${totalCards}</div>
          <div class="home-stat-label">수집한 카드</div>
        </div>
        <div class="home-stat">
          <div class="home-stat-value">7</div>
          <div class="home-stat-label">연속 출석</div>
        </div>
        <div class="home-stat">
          <div class="home-stat-value">${bmCount}</div>
          <div class="home-stat-label">북마크</div>
        </div>
      </div>

      <div class="home-recent-title">
        <span>최근 수집 카드</span>
        <button class="btn btn-ghost" id="see-all-cards" style="font-size:var(--text-sm);">전체보기 →</button>
      </div>
      <div class="home-recent-grid" id="recent-grid">
        ${recentStories.map(s => renderMiniCard(s)).join('')}
      </div>
    `;

    document.getElementById('today-card')?.addEventListener('click', () => {
      navigate('/detail/' + todayStory.id);
    });

    document.querySelectorAll('.history-card-mini').forEach(card => {
      card.addEventListener('click', () => {
        navigate('/detail/' + card.dataset.storyId);
      });
    });

    document.getElementById('see-all-cards')?.addEventListener('click', () => {
      navigate('/archive');
    });
  } catch (err) {
    console.error('Home load error:', err);
    page.innerHTML += `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-title">데이터를 불러오지 못했습니다</div></div>`;
  }
}

function renderMiniCard(story) {
  const pubDate = new Date(story.publish_date);
  const m = pubDate.getMonth() + 1;
  const d = pubDate.getDate();
  return `
    <div class="history-card-mini" data-story-id="${story.id}">
      <img src="${story.image_url}" alt="${story.figure_name}" loading="lazy" />
      <div class="history-card-mini-overlay">
        <div class="history-card-mini-date">${m}.${d}</div>
        <div class="history-card-mini-title">${story.figure_name}</div>
      </div>
    </div>
  `;
}
