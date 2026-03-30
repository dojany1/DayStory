/* =====================================================================
   archive.js — 컬렉션 (북마크) 페이지
   =====================================================================
   사용자가 북마크(찜)한 역사 카드들을 모아보는 페이지입니다.
   
   기능:
     1) 북마크한 카드들을 3열 그리드로 표시
     2) 검색창에 검색어를 입력하면 실시간으로 필터링
     3) 카드를 클릭하면 상세 페이지로 이동
     4) 데이터 로딩 실패 시 에러 화면과 재시도 버튼 표시
   ===================================================================== */

import { navigate } from '../router.js';
import { getBookmarkedStories } from '../services/bookmarks.js';


/* ─────────────────────────────────────────────
   섹션 1: 컬렉션 페이지 렌더링
   ───────────────────────────────────────────── */

/**
 * renderArchive — 컬렉션 페이지를 생성하고 반환합니다
 * @returns {HTMLElement} 컬렉션 페이지 DOM 요소
 */
export function renderArchive() {
  const page = document.createElement('div');
  page.className = 'archive-page page';

  page.innerHTML = `
    <!-- 페이지 헤더: 제목 + 카드 수 배지 -->
    <div class="page-header" style="padding-left:0;padding-right:0;">
      <h1 class="page-header-title">카드 컬렉션</h1>
      <span class="badge badge-accent" id="archive-count">...</span>
    </div>
    
    <!-- 검색창: 북마크한 카드를 실시간 검색 -->
    <div class="search-bar" id="collection-search-bar" style="margin-top:var(--space-2);">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input type="text" id="collection-search-input" placeholder="북마크한 카드 검색..." autocomplete="off" />
    </div>

    <!-- 카드 그리드 영역 (로딩 중에는 스피너 표시) -->
    <div id="archive-content" style="display:flex;justify-content:center;padding:var(--space-8);">
      <div class="loading-spinner"></div>
    </div>
  `;

  /* 데이터 로딩 시작 */
  loadCollection(page);

  return page;
}


/* ─────────────────────────────────────────────
   섹션 2: 북마크 데이터 로딩
   ───────────────────────────────────────────── */

/**
 * loadCollection — 서버에서 북마크 데이터를 가져와 화면에 표시합니다
 * @param {HTMLElement} page - renderArchive()에서 만든 페이지 요소
 * 
 * 동작 순서:
 *   1) 북마크된 스토리 목록을 서버에서 가져옴 (5초 타임아웃)
 *   2) 카드 수를 배지에 표시
 *   3) 카드 그리드를 렌더링
 *   4) 검색 기능 연결 (로컬 필터링)
 */
async function loadCollection(page) {
  const contentEl = page.querySelector('#archive-content') || document.getElementById('archive-content');
  const countEl = page.querySelector('#archive-count');

  try {
    /*
     * Promise.race()를 사용한 타임아웃 처리:
     * - 5초 안에 데이터가 오면 정상 처리
     * - 5초가 지나면 타임아웃 에러 발생 → catch 블록으로 이동
     * 이렇게 하면 서버가 느려도 무한 로딩을 방지할 수 있습니다.
     */
    const stories = await Promise.race([
      getBookmarkedStories(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('시간 초과')), 5000))
    ]);

    const allBookmarks = stories || [];

    /* 카드 수 표시 */
    if (countEl) {
      countEl.textContent = `${allBookmarks.length}장 보관됨`;
    }

    /**
     * renderStories — 스토리 배열을 받아 카드 그리드를 그립니다 (내부 함수)
     * @param {Array} list - 표시할 스토리 배열
     */
    const renderStories = (list) => {
      /* 표시할 카드가 없는 경우 */
      if (!list.length) {
        contentEl.className = '';
        contentEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">🔖</div>
            <div class="empty-state-title">보관된 카드가 없습니다</div>
          </div>
        `;
        return;
      }

      /* 3열 그리드로 미니 카드들을 표시 */
      contentEl.className = 'archive-grid';
      contentEl.innerHTML = list.map(story => renderMiniCard(story)).join('');

      /* 각 카드에 클릭 → 상세 페이지 이동 이벤트 연결 */
      contentEl.querySelectorAll('.history-card-mini').forEach(card => {
        card.addEventListener('click', () => {
          navigate('/detail/' + card.dataset.storyId);
        });
      });
    };

    /* 전체 북마크 표시 */
    renderStories(allBookmarks);

    /* ---- 검색 기능 (로컬 필터링) ---- */
    const searchInput = page.querySelector('#collection-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();

        if (!query) {
          /* 검색어가 비어있으면 전체 표시 */
          renderStories(allBookmarks);
        } else {
          /* 인물 이름, 국가, 요약에서 검색어 포함 여부 확인 */
          const filtered = allBookmarks.filter(story =>
            (story.figure_name || '').toLowerCase().includes(query) ||
            (story.country || '').toLowerCase().includes(query) ||
            (story.summary || '').toLowerCase().includes(query)
          );
          renderStories(filtered);
        }
      });
    }

  } catch (err) {
    /* 데이터 로딩 실패 또는 타임아웃 */
    console.error('컬렉션 로딩 실패:', err);
    if (countEl) countEl.textContent = '오류 발생';

    contentEl.className = '';
    contentEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
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
   섹션 3: 미니 카드 HTML 생성
   ───────────────────────────────────────────── */

/**
 * renderMiniCard — 하나의 스토리 데이터로 미니 카드 HTML을 생성합니다
 * @param {Object} story - 스토리 데이터 객체
 * @returns {string} 미니 카드 HTML 문자열
 * 
 * 미니 카드 구조:
 *   ┌───────────┐
 *   │  [이미지]  │
 *   │           │
 *   │ 3.30      │
 *   │ 뉴턴      │
 *   └───────────┘
 */
function renderMiniCard(story) {
  const pubDate = new Date(story.publish_date);
  const month = pubDate.getMonth() + 1;
  const day = pubDate.getDate();

  return `
    <div class="history-card-mini" data-story-id="${story.id}">
      <img src="${story.image_url}" alt="${story.figure_name}" loading="lazy" />
      <div class="history-card-mini-overlay">
        <div class="history-card-mini-date">${month}.${day}</div>
        <div class="history-card-mini-title">${story.figure_name}</div>
      </div>
    </div>
  `;
}
