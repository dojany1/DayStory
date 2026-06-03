/* =====================================================================
   editorstory.js — 에디터 일화 페이지 (메인 화면)
   =====================================================================
   상단 월/일 휠로 날짜를 선택해 해당 날짜의 역사 카드를 표시합니다.
   휠 + Swiper 카드덱 + 캘린더 토글의 공통 로직은
   components/cardDeck/cardDeckController.js 의 buildCardDeck() 으로 추출됨.
   이 파일은 "역사 카드" 고유의 데이터/마크업/이벤트만 config 로 주입한다.

     마지막 수정 : 2026-06-03 (3단계 — 공통 컨트롤러 추출)
   ===================================================================== */

import { fetchStories, fetchTodayStory } from '../services/stories.js';
import { toggleBookmark, getBookmarkedStoryIds } from '../services/bookmarks.js';
import { showToast } from '../components/toast.js';
import { escapeHtml } from '../utils/sanitize.js';
import { shareStory, captureAndShareCard } from '../services/sharing.js';
import { getState } from '../state.js';
import { navigate, getPreviousRoute } from '../router.js';
import { markLetterRead } from '../services/widget.js';
import { localizedStory } from '../utils/storyI18n.js';
import { t } from '../i18n/index.js';
import { collect, isCollected, canCollect, bulkCollect } from '../services/collection.js';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

import { buildCardDeck } from '../components/cardDeck/cardDeckController.js';
import {
  cardShell, cardFront, cardFrontTop, cardImageWrap, cardBack, emptyCardFace, cardActionButton,
  bindCardBase, parseIsoDate, formatMonthNameDate, bodyToHtml,
  FALLBACK_IMG, SHARE_ICON_SVG,
} from '../components/cardDeck/cardFace.js';

const FLIP_DURATION_MS = 400;

/* ── 에디터 한마디 "읽음" 추적 (localStorage) ── */
const LS_EDITOR_NOTES_KEY = 'readEditorNotes';

function getReadEditorNotes() {
  try { return JSON.parse(localStorage.getItem(LS_EDITOR_NOTES_KEY) || '[]'); } catch { return []; }
}
function isEditorNoteRead(storyId) {
  if (!storyId) return true;
  return getReadEditorNotes().includes(storyId);
}
function markEditorNoteRead(storyId) {
  if (!storyId) return;
  const list = getReadEditorNotes();
  if (!list.includes(storyId)) {
    list.push(storyId);
    try { localStorage.setItem(LS_EDITOR_NOTES_KEY, JSON.stringify(list)); } catch { /* noop */ }
  }
}

/* 보관함(북마크) 아이콘 SVG — 슬라이드 HTML 은 정적 캐시 대상이라 fill="none" 으로 시작,
   바인딩 시 bookmarkedIds 에 따라 갱신된다. */
const BOOKMARK_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                  </svg>`;


/* ─────────────────────────────────────────────
   섹션 1: 페이지 렌더링 (공통 컨트롤러 + 역사 카드 config)
   ───────────────────────────────────────────── */

export function renderEditorStory() {
  /* 북마크 id 는 비동기로 늦게 도착 — 클로저로 공유해 bindCard/onSwiperReady 가 최신값을 본다. */
  let bookmarkedIds = [];
  let bookmarksPromise = null;

  return buildCardDeck({
    idPrefix: 'editorstory',
    pageClass: 'editorstory-page',
    headerHtml: '<div class="editorstory-header"><h1 class="editorstory-title"></h1></div>',
    /* 다른 페이지에서 진입 시에만 좌→우, 최초 로드는 기본값(아래→위) */
    enterDir: getPreviousRoute() ? 'from-left' : null,
    calMode: 'history',
    lastDateKey: 'lastEditorStoryDate',

    loadData: async () => {
      /* 북마크는 시각 렌더에 비필수 → critical path 에서 분리(실패해도 빈 배열로 계속) */
      bookmarksPromise = getBookmarkedStoryIds()
        .then((ids) => { bookmarkedIds = ids; return ids; })
        .catch((e) => { console.warn('북마크 조회 실패(렌더는 계속):', e?.message || e); return []; });

      const [allStories, todayStory] = await Promise.all([fetchStories(), fetchTodayStory()]);
      if (!todayStory) return { isEmpty: true };

      const historyStories = allStories || [];
      bulkCollect([todayStory, ...historyStories].map((s) => s?.id).filter(Boolean));

      /* history 먼저, todayStory 를 뒤에 두어 같은 날짜면 today 가 우선 매핑되게 한다 */
      return {
        stories: [...historyStories, todayStory],
        initialDate: getState('lastEditorStoryDate'),
        calStores: { historyStories, myStories: [] },
        bookmarkedIds,
      };
    },

    renderSlideHTML: (raw, iso) => buildSlideHTML(raw, iso),
    bindCard: (flip, raw) => bindFlipCardEvents(flip, raw ? localizedStory(raw) : null, bookmarkedIds),
    onMounted: () => { void markLetterRead(); },

    /* 북마크가 critical path 보다 늦게 도착 → 활성 슬라이드 아이콘만 갱신(DOM thrash 방지) */
    onSwiperReady: (sw, ctx) => {
      if (!bookmarksPromise) return;
      bookmarksPromise.then((ids) => {
        const s = ctx.swiper;
        if (!s || s.destroyed) return;
        const slide = ctx.slides[s.activeIndex];
        if (!slide?.story?.id) return;
        const activeSlideEl = ctx.swiperEl.querySelector('.swiper-slide-active');
        const bookmarkIcon = activeSlideEl?.querySelector('.card-action-btn[aria-label="보관함"] svg');
        if (bookmarkIcon && ids.includes(slide.story.id)) {
          bookmarkIcon.setAttribute('fill', 'currentColor');
        }
      });
    },

    emptyHtml: () => `
      <div class="editorstory-header"><h1 class="editorstory-title">Day Story</h1></div>
      <div class="empty-state">
        <div class="empty-state-title">아직 발행된 카드가 없어요</div>
        <div class="empty-state-desc">곧 첫 카드가 도착할 거예요</div>
      </div>
    `,
    errorHtml: (err) => `
      <div class="editorstory-header"><h1 class="editorstory-title">Day Story</h1></div>
      <div class="empty-state">
        <div class="empty-state-title">${t('common.load_failed_title')}</div>
        <div class="empty-state-desc" style="color:var(--danger-color);margin-bottom:var(--space-2)">
          ${escapeHtml(err.message || t('common.unknown_error'))}
        </div>
        <div class="empty-state-desc">${t('common.load_failed_desc')}</div>
        <button class="btn btn-primary" onclick="location.reload()" style="margin-top:var(--space-4)">
          ${t('common.refresh')}
        </button>
      </div>
    `,
  });
}


/* ─────────────────────────────────────────────
   섹션 2: 슬라이드 HTML 빌더 (역사 카드 — cardFace 공통 빌더 사용)
   ───────────────────────────────────────────── */

function buildSlideHTML(rawStory, isoDate) {
  const story = rawStory ? localizedStory(rawStory) : null;
  const { month, day, year: displayYear } = parseIsoDate(isoDate);

  if (!story) {
    return emptyCardFace({
      day,
      title: t('home.empty_card_title'),
      dateStr: formatMonthNameDate(isoDate),
    });
  }

  /* story.image_url 을 항상 그대로 부여 (legacy .webp 포함). 디코드 실패는 onerror 가 fallback 으로 swap. */
  const imageSrc = story.image_url || FALLBACK_IMG;

  const actionsHtml = `${cardActionButton({ ariaLabel: '공유', svg: SHARE_ICON_SVG })}
                ${cardActionButton({ ariaLabel: '보관함', svg: BOOKMARK_ICON_SVG })}`;

  const metaHtml = `${escapeHtml(story.card_count || '')} ${escapeHtml(story.country)}<br>
                ${displayYear} / ${String(month).padStart(2, '0')} / ${String(day).padStart(2, '0')}`;

  const frontHtml = cardFront({
    topHtml: cardFrontTop({
      yearHtml: escapeHtml(story.historical_year),
      dateLabel: `${month}. ${day}`,
      actionsHtml,
      metaHtml,
    }),
    imageHtml: cardImageWrap({ src: imageSrc, alt: story.figure_name, title: story.figure_name }),
  });

  const hasComment = story.editor_comment && story.editor_comment.trim() !== '';
  const footerHtml = `
            <button class="back-editor-btn${hasComment && !isEditorNoteRead(story.id) ? ' unread' : ''}" type="button" title="에디터 한마디" data-story-id="${escapeHtml(story.id)}" data-comment="${escapeHtml(story.editor_comment || '')}" data-editor-name="${escapeHtml((story.editor && story.editor.displayName) || 'DayStory')}" style="${hasComment ? '' : 'visibility: hidden; pointer-events: none;'}">
              <img src="/assets/editor_profile.png" alt="editor" class="back-editor-avatar" loading="lazy" decoding="async" />
            </button>
            <div class="back-date-actions">
              <div class="back-date">${escapeHtml(story.historical_year)}년 ${month}월 ${day}일</div>
              <button class="card-detail-shortcut-btn" type="button" aria-label="${t('home.detail_button')}" title="${t('home.detail_button')}">${t('home.detail_button')}</button>
            </div>`;

  const backHtml = cardBack({
    title: story.figure_name,
    bodyHtml: bodyToHtml(story.body),
    footerHtml,
  });

  return cardShell({ frontHtml, backHtml });
}


/* ─────────────────────────────────────────────
   섹션 3: 카드 이벤트 (공통 flip/press/fade + 역사 카드 전용 액션)
   ───────────────────────────────────────────── */

function bindFlipCardEvents(flipContainer, story, bookmarkedIds) {
  if (flipContainer.dataset.bound === '1') return;

  const flipper = bindCardBase(flipContainer, {
    story,
    ignoreSelectors: ['.card-action-btn', '.back-editor-btn', '.card-detail-shortcut-btn'],
    flipDurationMs: FLIP_DURATION_MS,
    onBeforeFlip: (e) => {
      /* 말풍선이 떠 있으면 그것만 닫음 (flip 취소) */
      const openBubble = flipContainer.querySelector('.editor-comment-bubble');
      if (openBubble && !openBubble.contains(e.target)) {
        openBubble.remove();
        return false;
      }
      /* 자동 수집: 오늘 카드 미수집 → 토스트, 풀액세스의 지난 카드 → 무음 영구 수집 */
      if (story.id && story.publish_date && !isCollected(story.id)) {
        if (canCollect(story.publish_date)) {
          const result = collect(story.id, story.publish_date);
          if (result.ok && !result.alreadyCollected) {
            showToast(t('calendar.collect_success_text'), 'success');
          }
        } else {
          collect(story.id, story.publish_date, { bypass: true });
        }
      }
      return true;
    },
    onAfterFlip: () => document.dispatchEvent(new CustomEvent('ds:card-flipped')),
  });
  if (!flipper) return;
  flipContainer.dataset.bound = '1';

  /* 북마크 아이콘 초기 상태 (slide HTML 은 정적 캐시라 동적 표시) */
  const bookmarkIcon = flipContainer.querySelector('.card-action-btn[aria-label="보관함"] svg');
  if (bookmarkIcon && story && bookmarkedIds.includes(story.id)) {
    bookmarkIcon.setAttribute('fill', 'currentColor');
  }

  const detailBtn = flipContainer.querySelector('.card-detail-shortcut-btn');
  const shareBtn = flipContainer.querySelector('.card-action-btn[aria-label="공유"]');
  const bookmarkBtn = flipContainer.querySelector('.card-action-btn[aria-label="보관함"]');

  if (detailBtn && story) {
    detailBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigate(`/detail/${story.id}`);
    });
  }

  if (shareBtn && story) {
    shareBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const cardEl = flipContainer.querySelector('.history-card-front');
      if (!cardEl) {
        await shareStory(story, { kind: 'history' });
        return;
      }
      shareBtn.disabled = true;
      try {
        const res = await captureAndShareCard(cardEl, {
          title: story.figure_name || story.title || 'DayStory',
          text: `[DayStory] ${story.figure_name || story.title || ''}`.trim(),
          dialogTitle: '역사 일화 공유',
        });
        if (!res.ok && res.reason !== 'cancelled') {
          await shareStory(story, { kind: 'history' });
        }
      } finally {
        shareBtn.disabled = false;
      }
    });
  }

  if (bookmarkBtn && story) {
    bookmarkBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const res = await toggleBookmark(story.id);
      if (res.error) {
        showToast(res.error, 'error');
        return;
      }
      showToast(res.bookmarked ? t('toast.bookmark_added') : t('toast.bookmark_removed'), 'success');
      bookmarkBtn.querySelector('svg').setAttribute('fill', res.bookmarked ? 'currentColor' : 'none');
      if (res.bookmarked && !bookmarkedIds.includes(story.id)) {
        bookmarkedIds.push(story.id);
      } else if (!res.bookmarked) {
        const idx = bookmarkedIds.indexOf(story.id);
        if (idx > -1) bookmarkedIds.splice(idx, 1);
      }
    });
  }

  /* 에디터 한마디 말풍선 */
  const editorBtn = flipContainer.querySelector('.back-editor-btn');
  if (editorBtn) {
    let removeOutsideBubbleListeners = null;

    const removeEditorBubble = () => {
      const bubble = flipContainer.querySelector('.editor-comment-bubble');
      if (bubble) bubble.remove();
      if (removeOutsideBubbleListeners) {
        removeOutsideBubbleListeners();
        removeOutsideBubbleListeners = null;
      }
    };

    const bindOutsideBubbleDismiss = () => {
      if (removeOutsideBubbleListeners) removeOutsideBubbleListeners();
      const handleOutsideBubbleInput = (event) => {
        const bubble = flipContainer.querySelector('.editor-comment-bubble');
        if (!bubble) {
          if (removeOutsideBubbleListeners) {
            removeOutsideBubbleListeners();
            removeOutsideBubbleListeners = null;
          }
          return;
        }
        const target = event.target;
        if (editorBtn.contains(target) || bubble.contains(target)) return;
        removeEditorBubble();
      };
      document.addEventListener('click', handleOutsideBubbleInput);
      removeOutsideBubbleListeners = () => {
        document.removeEventListener('click', handleOutsideBubbleInput);
      };
    };

    const showBubble = (e) => {
      if (e) e.stopPropagation();
      const existing = flipContainer.querySelector('.editor-comment-bubble');
      if (existing) {
        if (existing.contains(e.target)) return;
        removeEditorBubble();
        return;
      }
      const comment = editorBtn.dataset.comment;
      const editorName = editorBtn.dataset.editorName || 'DayStory';
      if (!comment) return;
      const bubble = document.createElement('div');
      bubble.className = 'editor-comment-bubble';
      const nameEl = document.createElement('span');
      nameEl.className = 'editor-comment-name';
      nameEl.textContent = editorName;
      bubble.appendChild(nameEl);
      bubble.appendChild(document.createTextNode(comment));
      editorBtn.appendChild(bubble);
      bindOutsideBubbleDismiss();

      if (Capacitor.isNativePlatform()) {
        Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
      }

      const storyId = editorBtn.dataset.storyId;
      if (storyId) {
        markEditorNoteRead(storyId);
        editorBtn.classList.remove('unread');
      }
    };

    editorBtn.addEventListener('click', showBubble);
  }
}
