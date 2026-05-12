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
   마지막 수정 날짜 : 2026-03-31 20:20
   ===================================================================== */

import { showToast } from '../components/toast.js';
import { fetchStoryById } from '../services/stories.js';
import { toggleBookmark, isBookmarked } from '../services/bookmarks.js';
import { shareStory, buildShareUrl } from '../services/sharing.js';
import { isMembershipCardId, getMembershipCardById } from '../services/membershipCards.js';
import { escapeHtml, sanitizeUrl } from '../utils/sanitize.js';
import { preloadImage } from '../utils/imageLoading.js';
import { localizedStory } from '../utils/storyI18n.js';
import { t } from '../i18n/index.js';

function normalizeSourceItem(source) {
  if (!source) return null;

  if (typeof source === 'string') {
    const [rawTitle, ...urlParts] = source.split('|');
    const title = rawTitle.trim();
    const url = urlParts.join('|').trim();
    if (!title && !url) return null;
    return {
      title: title || url,
      url,
    };
  }

  if (typeof source === 'object') {
    const title = String(source.title || source.name || source.label || source.text || '').trim();
    const url = String(source.url || source.href || '').trim();
    if (!title && !url) return null;
    return {
      title: title || url,
      url,
    };
  }

  return null;
}

function normalizeSources(rawSources) {
  const sourceList = Array.isArray(rawSources)
    ? rawSources
    : String(rawSources || '').split('\n');

  return sourceList
    .map(normalizeSourceItem)
    .filter(Boolean);
}

function renderAttribution(story, sources) {
  const imageSource = String(story.image_source || '').trim();
  const imageLicense = String(story.image_license || '').trim();
  const hasImageAttribution = imageSource || imageLicense;

  if (!hasImageAttribution && !sources.length) return '';

  return `
    <section class="detail-attribution" aria-label="이미지 출처 및 참고 자료">
      ${hasImageAttribution ? `
        <div class="detail-license">
          <div class="detail-sources-title">이미지 출처</div>
          <div class="detail-license-text">
            ${imageSource ? `<div>출처: ${escapeHtml(imageSource)}</div>` : ''}
            ${imageLicense ? `<div>라이선스: ${escapeHtml(imageLicense)}</div>` : ''}
          </div>
        </div>
      ` : ''}
      ${sources.length ? `
        <div class="detail-sources">
          <div class="detail-sources-title">참고 자료</div>
          ${sources.map((source) => {
            const safeTitle = escapeHtml(source.title);
            const safeUrl = sanitizeUrl(source.url);
            if (!safeUrl) {
              return `<div class="detail-source-item detail-source-text">${safeTitle}</div>`;
            }

            return `
              <a href="${safeUrl}" target="_blank" rel="noopener" class="detail-source-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                ${safeTitle}
              </a>
            `;
          }).join('')}
        </div>
      ` : ''}
    </section>
  `;
}


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
  /* 멤버십 카드는 Firestore에 없으므로 localStorage에서 직접 조회 */
  const rawStory = isMembershipCardId(storyId)
    ? getMembershipCardById(storyId)
    : await fetchStoryById(storyId);

  if (!rawStory) {
    page.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">${t('common.load_failed_title')}</div>
      </div>
    `;
    return;
  }

  /* 현재 언어로 변환 (ko/en/ja) */
  const story = localizedStory(rawStory);

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
  const editorComment = (story.editor_comment || (story.editor && story.editor.comment) || '').trim();
  const editorName = ((story.editor && story.editor.displayName) || 'DayStory').trim() || 'DayStory';
  const editorAvatar = (story.editor && story.editor.photoURL) || '';
  preloadImage(story.image_url);
  preloadImage(editorAvatar);
  const editorCommentHtml = escapeHtml(editorComment).replace(/\n/g, '<br />');
  const historicalMetaHtml = [story.historical_date, story.country]
    .map(value => String(value ?? '').trim())
    .filter(Boolean)
    .map(value => escapeHtml(value))
    .join(' · ');

  /* 이미지 출처/라이선스 및 참고 자료 */
  const sources = normalizeSources(story.story_sources || story.sources || []);
  const attributionHtml = renderAttribution(story, sources);

  /* ---- 페이지 HTML 생성 ---- */
  page.innerHTML = `
    <!-- 상단 헤더: 뒤로가기 -->
    <div class="detail-header" id="detail-header">
      <button class="page-header-back" id="detail-back">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
    </div>

    <!-- 히어로 이미지 영역 -->
    <div class="detail-hero">
      <img src="${escapeHtml(story.image_url)}" alt="${escapeHtml(story.figure_name)}" loading="eager" decoding="async" fetchpriority="high" width="1200" height="1500" />
      <div class="detail-hero-overlay">
        <div class="detail-hero-year">${escapeHtml(story.historical_year)}</div>
        <div class="detail-hero-monthday">${month}. ${day < 10 ? '0' + day : day}</div>
      </div>
    </div>

    <!-- 본문 영역 -->
    <div class="detail-content">
      <div class="detail-title-row">
        <h1 class="detail-figure-name">${escapeHtml(story.figure_name)}</h1>
        <div class="detail-title-actions">
          <button class="btn-icon bookmark-btn ${bookmarked ? 'active' : ''}" id="detail-bookmark" aria-label="보관함">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
          <button class="btn-icon" id="detail-share" aria-label="공유">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="detail-body">${bodyHtml}</div>
      <div class="detail-historical-date">${historicalMetaHtml}</div>
      ${editorComment ? `
        <section class="detail-editor-note" aria-label="에디터의 말">
          <div class="detail-editor-note-header">
            <div class="detail-editor-avatar-wrap">
              ${editorAvatar
                ? `<img class="detail-editor-avatar" src="${escapeHtml(editorAvatar)}" alt="${escapeHtml(editorName)}" loading="lazy" decoding="async" />`
                : `<span class="detail-editor-avatar-fallback" aria-hidden="true">D</span>`}
            </div>
            <div class="detail-editor-name">${escapeHtml(editorName)}</div>
          </div>
          <p class="detail-editor-note-text">${editorCommentHtml}</p>
        </section>
      ` : ''}
      ${attributionHtml}
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
    if (result.error) {
      showToast(result.error, 'error');
      return;
    }
    bookmarked = result.bookmarked;

    /* 상단 + 하단의 북마크 버튼 모두 업데이트 */
    page.querySelectorAll('#detail-bookmark').forEach(btn => {
      btn.classList.toggle('active', bookmarked);
    });

    showToast(bookmarked ? '보관함에 저장했습니다' : '보관함에서 해제했습니다', 'success');
  };
  document.getElementById('detail-bookmark')?.addEventListener('click', handleBookmark);

  /**
   * shareAction — 공유 기능
   * 모바일: 기기 기본 공유 시트 사용
   * PC: 클립보드에 복사
   */
  const shareAction = async () => {
    /* 모바일: 카드 이미지 첨부 + 공유 시트 → 카톡/SMS에서 미리보기 ★ */
    if (navigator.share) {
      await shareStory(story, { kind: 'history' });
      return;
    }
    /* PC 폴백: 클립보드에 복사 */
    try {
      const url = buildShareUrl(story.id);
      await navigator.clipboard.writeText(`[DayStory] ${story.figure_name}\n\n${story.summary || ''}\n${url}`);
      showToast('클립보드에 복사했습니다', 'success');
    } catch { /* 사용자가 공유를 취소한 경우 무시 */ }
  };
  document.getElementById('detail-share')?.addEventListener('click', shareAction);

}
