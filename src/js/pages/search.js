/* =====================================================================
   search.js — 검색 페이지
   =====================================================================
   키워드를 입력하면 인물, 사건, 국가 등으로 역사 일화를 검색합니다.
   
   기능:
     - 초기 로딩 시 전체 일화 목록을 표시
     - 검색어 입력 시 300ms 디바운스 후 자동 검색
     - 검색 결과가 없으면 빈 상태 메시지 표시
     - 결과 항목 클릭 시 상세 페이지로 이동
   
   디바운스(Debounce)란?
     사용자가 빠르게 연속 입력할 때 매 글자마다 서버에 요청하면 낭비됩니다.
     300ms 동안 추가 입력이 없을 때만 검색을 실행하는 기법입니다.
   ===================================================================== */

import { navigate } from '../router.js';
import { searchStoriesDB, fetchStories } from '../services/stories.js';
import { escapeHtml } from '../utils/sanitize.js';


/* ─────────────────────────────────────────────
   섹션 1: 검색 페이지 렌더링
   ───────────────────────────────────────────── */

/**
 * renderSearch — 검색 페이지를 생성합니다
 * @returns {HTMLElement} 검색 페이지 DOM 요소
 */
export function renderSearch() {
  const page = document.createElement('div');
  page.className = 'search-page page';

  page.innerHTML = `
    <!-- 페이지 제목 -->
    <div class="page-header" style="height: 60px; padding: 0 16px; align-items:center; display:flex;">
      <h1 class="page-header-title" style="margin:0; line-height:1;">검색</h1>
    </div>

    <!-- 검색창 -->
    <div class="search-bar" id="search-bar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input type="text" id="search-input" placeholder="인물, 사건, 국가로 검색..." autocomplete="off" />
    </div>

    <!-- 검색 결과 목록 -->
    <div id="search-results" class="search-results">
      <div style="display:flex;justify-content:center;padding:var(--space-6);">
        <div class="loading-spinner"></div>
      </div>
    </div>

    <!-- 검색 결과 없음 상태 -->
    <div id="search-empty" class="empty-state" style="display:none;">
      <div class="empty-state-title">검색 결과가 없습니다</div>
      <div class="empty-state-desc">다른 키워드로 검색해보세요</div>
    </div>
  `;

  /* 초기 로딩: 전체 일화 목록 표시 */
  (async () => {
    const allStories = await fetchStories();
    const resultsEl = document.getElementById('search-results');
    const emptyEl = document.getElementById('search-empty');
    if (!resultsEl) return;
    if (allStories.length === 0) {
      resultsEl.style.display = 'none';
      if (emptyEl) {
        emptyEl.querySelector('.empty-state-title').textContent = '아직 발행된 카드가 없어요';
        emptyEl.querySelector('.empty-state-desc').textContent = '곧 첫 카드가 도착할 거예요';
        emptyEl.style.display = 'flex';
      }
      return;
    }
    resultsEl.innerHTML = allStories.map(story => renderSearchItem(story)).join('');
    bindSearchItemClicks();
  })();

  /* ---- 검색 입력 이벤트 (디바운스 적용) ---- */
  setTimeout(() => {
    const input = document.getElementById('search-input');
    let debounceTimer;  /* 디바운스용 타이머 ID */

    input?.addEventListener('input', () => {
      /* 이전 타이머가 있으면 취소 (연속 입력 시 중복 요청 방지) */
      clearTimeout(debounceTimer);

      /* 300ms 후에 검색 실행 */
      debounceTimer = setTimeout(async () => {
        const query = input.value.trim();
        const resultsEl = document.getElementById('search-results');
        const emptyEl = document.getElementById('search-empty');

        if (!query) {
          /* 검색어가 비어있으면 전체 목록 복원 */
          const allStories = await fetchStories();
          resultsEl.innerHTML = allStories.map(story => renderSearchItem(story)).join('');
          emptyEl.style.display = 'none';
          resultsEl.style.display = 'flex';
          bindSearchItemClicks();
              return;
        }

        /* 서버에서 검색 실행 */
        const results = await searchStoriesDB(query);

        if (results.length) {
          /* 결과 있음: 목록 표시 */
          resultsEl.innerHTML = results.map(story => renderSearchItem(story)).join('');
          emptyEl.style.display = 'none';
          resultsEl.style.display = 'flex';
            } else {
          /* 결과 없음: 빈 상태 메시지 표시 */
          resultsEl.style.display = 'none';
          emptyEl.style.display = 'flex';
        }

        bindSearchItemClicks();
      }, 300);
    });
  }, 0);

  return page;
}


/* ─────────────────────────────────────────────
   섹션 2: 헬퍼 함수들
   ───────────────────────────────────────────── */

/**
 * bindSearchItemClicks — 검색 결과 항목에 클릭 이벤트를 연결합니다
 * 항목을 클릭하면 해당 일화의 상세 페이지로 이동합니다
 */
function bindSearchItemClicks() {
  document.querySelectorAll('.search-result-item').forEach(item => {
    item.addEventListener('click', () => {
      navigate('/detail/' + item.dataset.storyId);
    });
  });
}

/**
 * renderSearchItem — 하나의 검색 결과 항목 HTML을 생성합니다
 * @param {Object} story - 스토리 데이터 객체
 * @returns {string} 검색 결과 항목 HTML 문자열
 */
function renderSearchItem(story) {
  const pubDate = new Date(story.publish_date);
  const dateStr = `${pubDate.getFullYear()}.${pubDate.getMonth() + 1}.${pubDate.getDate()}`;
  const imageUrl = story.image_url || '';
  const imageAttrs = imageUrl ? `src="${escapeHtml(imageUrl)}"` : '';

  return `
    <div class="search-result-item" data-story-id="${escapeHtml(story.id)}">
      <div class="search-result-thumb">
        <img ${imageAttrs} alt="${escapeHtml(story.figure_name)}" loading="lazy" decoding="async" />
      </div>
      <div class="search-result-info">
        <div class="search-result-date">${dateStr} · ${escapeHtml(story.country)}</div>
        <div class="search-result-title">${escapeHtml(story.figure_name)}</div>
        <div class="search-result-summary">${escapeHtml(story.summary)}</div>
      </div>
    </div>
  `;
}
