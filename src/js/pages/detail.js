/* =====================================================================
   detail.js — 일화 상세 페이지
   =====================================================================
   홈이나 컬렉션에서 카드를 클릭하면 이동하는 상세 페이지입니다.
   
   구성:
     - 뒤로가기 버튼 + 북마크/공유/더보기 버튼
     - 히어로 이미지 (인물 이미지 + 연도/날짜 오버레이)
     - 본문 텍스트
     - 참고 자료 링크
     - 하단 액션 바 (북마크, 공유, 오류 신고)
   ===================================================================== */

import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';
import { fetchStoryById } from '../services/stories.js';
import { toggleBookmark, isBookmarked } from '../services/bookmarks.js';
import { escapeHtml, sanitizeUrl } from '../utils/sanitize.js';


/* ─────────────────────────────────────────────
   섹션 1: 상세 페이지 렌더링
   ───────────────────────────────────────────── */

/**
 * renderDetail — 상세 페이지를 생성합니다
 * @param {Object} params - URL 파라미터 ({ id: '스토리ID' })
 * @returns {HTMLElement} 상세 페이지 DOM 요소
 */
export function renderDetail(params) {
  const page = document.createElement('div');
  page.className = 'detail-page page';

  /* 로딩 스피너를 먼저 보여주고, 데이터를 비동기로 불러옴 */
  page.innerHTML = `
    <div style="display:flex;justify-content:center;align-items:center;min-height:60vh;">
      <div class="loading-spinner"></div>
    </div>
  `;

  loadDetail(page, params.id);
  return page;
}


/* ─────────────────────────────────────────────
   섹션 2: 상세 데이터 로딩 및 화면 구성
   ───────────────────────────────────────────── */

/**
 * loadDetail — 스토리 데이터를 불러와 상세 페이지를 완성합니다
 * @param {HTMLElement} page    - 페이지 DOM 요소
 * @param {string}      storyId - 표시할 스토리의 ID
 */
async function loadDetail(page, storyId) {
  /* 서버에서 스토리 데이터 가져오기 */
  const story = await fetchStoryById(storyId);

  if (!story) {
    page.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">일화를 찾을 수 없습니다</div>
      </div>
    `;
    return;
  }

  /* 북마크 여부 확인 */
  let bookmarked = await isBookmarked(storyId);

  /* 날짜 정보 추출 */
  const pubDate = new Date(story.publish_date);
  const month = pubDate.getMonth() + 1;
  const day = pubDate.getDate();

  /* 본문을 줄바꿈 기준으로 <p> 태그로 감싸기 */
  const bodyHtml = story.body
    .split('\n')
    .filter(paragraph => paragraph.trim())
    .map(paragraph => `<p>${escapeHtml(paragraph)}</p>`)
    .join('');

  /* 참고 자료 목록 */
  const sources = story.story_sources || story.sources || [];

  /* ---- 페이지 HTML 생성 ---- */
  page.innerHTML = `
    <!-- 상단 헤더: 뒤로가기 + 액션 버튼들 -->
    <div class="detail-header" id="detail-header">
      <button class="page-header-back" id="detail-back">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <div class="detail-header-actions">
        <!-- 북마크 버튼 -->
        <button class="btn-icon bookmark-btn ${bookmarked ? 'active' : ''}" id="detail-bookmark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
        <!-- 공유 버튼 -->
        <button class="btn-icon" id="detail-share">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
        </button>
        <!-- 더보기 버튼 -->
        <button class="btn-icon" id="detail-more">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 히어로 이미지 영역 -->
    <div class="detail-hero">
      <img src="${escapeHtml(story.image_url)}" alt="${escapeHtml(story.figure_name)}" />
      <div class="detail-hero-overlay">
        <div class="detail-hero-year">${escapeHtml(story.historical_year)}</div>
        <div class="detail-hero-monthday">${month}. ${day < 10 ? '0' + day : day}</div>
        <span class="detail-hero-tag">${escapeHtml(story.card_count || '')} &nbsp;·&nbsp; ${escapeHtml(story.country)}</span>
      </div>
    </div>

    <!-- 본문 영역 -->
    <div class="detail-content">
      <h1 class="detail-figure-name">${escapeHtml(story.figure_name)}</h1>
      <div class="detail-body">${bodyHtml}</div>
      <div class="detail-historical-date">${escapeHtml(story.historical_date)}</div>

      <!-- 참고 자료 (있을 때만 표시) -->
      ${sources.length ? `
        <div class="detail-sources">
          <div class="detail-sources-title">참고 자료</div>
          ${sources.map(s => `
            <a href="${sanitizeUrl(s.url)}" target="_blank" rel="noopener" class="detail-source-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              ${escapeHtml(s.title)}
            </a>
          `).join('')}
        </div>
      ` : ''}

      <!-- 하단 액션 바 -->
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


  /* ─────────────────────────────────────────────
     섹션 3: 이벤트 리스너 연결
     ───────────────────────────────────────────── */

  /* 뒤로가기 버튼 */
  document.getElementById('detail-back')?.addEventListener('click', () => window.history.back());

  /**
   * handleBookmark — 북마크 토글 처리 함수
   * 북마크 버튼을 클릭하면 추가/해제를 토글하고 UI를 업데이트합니다
   */
  const handleBookmark = async () => {
    const result = await toggleBookmark(storyId);
    bookmarked = result.bookmarked;

    /* 상단 + 하단의 북마크 버튼 모두 업데이트 */
    page.querySelectorAll('#detail-bookmark, #action-bookmark').forEach(btn => {
      btn.classList.toggle('active', bookmarked);
    });

    showToast(bookmarked ? '북마크에 저장했습니다' : '북마크를 해제했습니다', 'success');
  };
  document.getElementById('detail-bookmark')?.addEventListener('click', handleBookmark);
  document.getElementById('action-bookmark')?.addEventListener('click', handleBookmark);

  /**
   * shareAction — 공유 기능
   * 모바일: 기기 기본 공유 시트 사용
   * PC: 클립보드에 복사
   */
  const shareAction = async () => {
    try {
      if (navigator.share) {
        /* 모바일 기기의 공유 기능 사용 */
        await navigator.share({
          title: story.title,
          text: story.summary,
          url: window.location.href
        });
      } else {
        /* PC: 클립보드에 복사 */
        await navigator.clipboard.writeText(story.summary + '\n\n— DayStory');
        showToast('클립보드에 복사했습니다', 'success');
      }
    } catch { /* 사용자가 공유를 취소한 경우 무시 */ }
  };
  document.getElementById('detail-share')?.addEventListener('click', shareAction);
  document.getElementById('action-share')?.addEventListener('click', shareAction);

  /* 오류 신고 페이지로 이동 */
  document.getElementById('action-report')?.addEventListener('click', () => {
    navigate('/report', { storyId: story.id });
  });

  /* 더보기 메뉴 (준비중) */
  document.getElementById('detail-more')?.addEventListener('click', () => {
    showToast('더보기 메뉴 (준비중)', 'info');
  });
}
