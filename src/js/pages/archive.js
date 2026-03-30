/* ============================================
   DayStory — Archive / Collection Page (Supabase)
   ============================================ */
import { navigate } from '../router.js';
import { fetchStories } from '../services/stories.js';
import { getBookmarkedStories } from '../services/bookmarks.js';

export function renderArchive() {
  const page = document.createElement('div');
  page.className = 'archive-page page';
  page.innerHTML = `
    <div class="page-header">
      <h1 class="page-header-title">카드 컬렉션</h1>
      <span class="badge badge-accent" id="archive-count">...</span>
    </div>
    <div class="archive-tabs">
      <button class="archive-tab active" data-tab="grid">전체</button>
      <button class="archive-tab" data-tab="bookmarks">북마크</button>
      <button class="archive-tab" data-tab="calendar">캘린더</button>
    </div>
    <div id="archive-content" style="display:flex;justify-content:center;padding:var(--space-8);">
      <div class="loading-spinner"></div>
    </div>
  `;
  loadArchive(page, 'grid');
  return page;
}

async function loadArchive(page, tab) {
  const contentEl = page.querySelector('#archive-content') || document.getElementById('archive-content');

  if (tab === 'bookmarks') {
    const stories = await getBookmarkedStories();
    if (!stories.length) {
      contentEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔖</div><div class="empty-state-title">아직 북마크가 없습니다</div><div class="empty-state-desc">관심 있는 카드를 북마크해보세요</div></div>`;
      contentEl.className = '';
    } else {
      contentEl.className = 'archive-grid';
      contentEl.innerHTML = stories.map(s => renderMiniCard(s)).join('');
    }
  } else {
    const stories = await fetchStories();
    page.querySelector('#archive-count').textContent = `${stories.length}장 수집`;

    const grouped = {};
    stories.forEach(s => {
      const d = new Date(s.publish_date);
      const key = `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(s);
    });

    let html = '';
    Object.entries(grouped).forEach(([month, items]) => {
      html += `<div class="archive-month-header">${month}</div>`;
      items.forEach(s => { html += renderMiniCard(s); });
    });

    /* Future locked cards */
    html += `<div class="archive-month-header" style="opacity:0.4">다가올 카드</div>`;
    for (let i = 0; i < 6; i++) {
      html += `<div class="history-card-mini locked"><div style="width:100%;height:100%;background:var(--color-bg-card-dark);"></div></div>`;
    }

    contentEl.className = 'archive-grid';
    contentEl.innerHTML = html;
  }

  /* Card clicks */
  contentEl.querySelectorAll('.history-card-mini:not(.locked)').forEach(card => {
    card.addEventListener('click', () => navigate('/detail/' + card.dataset.storyId));
  });

  /* Tab switching */
  page.querySelectorAll('.archive-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      page.querySelectorAll('.archive-tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      contentEl.innerHTML = '<div style="display:flex;justify-content:center;padding:var(--space-8);"><div class="loading-spinner"></div></div>';
      contentEl.className = '';
      loadArchive(page, btn.dataset.tab);
    });
  });
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
