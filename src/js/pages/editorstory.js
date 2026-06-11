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
import { markDateRead } from '../services/readHistory.js';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

import { buildCardDeck } from '../components/cardDeck/cardDeckController.js';
import {
  cardShell, cardFront, cardFrontTop, cardImageWrap, cardBack, emptyCardFace, cardActionButton,
  bindCardBase, parseIsoDate, formatMonthNameDate, bodyToHtml,
  FALLBACK_IMG, SHARE_ICON_SVG,
} from '../components/cardDeck/cardFace.js';
import { EDITOR_DISPLAY_NAME } from '../utils/constants.js';
import { afterPageEnter } from '../utils/pageLifecycle.js';
import { showIntroSheet } from '../components/introSheet.js';
import { showCardFlipCoach } from '../components/coachMark.js';
import { hasSeen, ONBOARDING_FLAGS } from '../services/onboarding.js';
import { getCurrentPath } from '../router.js';

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

/* 관리자 전용 "콘텐츠 관리" 아이콘 — 설정 화면 editIcon() 과 동일 (발행 카드 즉시 수정 진입용) */
const ADMIN_EDIT_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14.364 13.634a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506l4.013-4.009a1 1 0 0 0-3.004-3.004z"/>
                    <path d="M14.487 7.858A1 1 0 0 1 14 7V2"/>
                    <path d="M20 19.645V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l2.516 2.516"/>
                    <path d="M8 18h1"/>
                  </svg>`;


/* ─────────────────────────────────────────────
   섹션 1: 페이지 렌더링 (공통 컨트롤러 + 역사 카드 config)
   ───────────────────────────────────────────── */

export function renderEditorStory() {
  /* 북마크 id 는 비동기로 늦게 도착 — 클로저로 공유해 bindCard/onSwiperReady 가 최신값을 본다. */
  let bookmarkedIds = [];
  let bookmarksPromise = null;

  const page = buildCardDeck({
    idPrefix: 'editorstory',
    pageClass: 'editorstory-page',
    headerHtml: '<div class="editorstory-header"><h1 class="editorstory-title"></h1></div>',
    calendarTitle: '에디터 일화',
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
    bindCard: (flip, raw, iso) => bindFlipCardEvents(flip, raw ? localizedStory(raw) : null, bookmarkedIds, iso),
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
        const bookmarkIcon = activeSlideEl?.querySelector(`.card-action-btn[aria-label="${t('detail.bookmark_button')}"] svg`);
        if (bookmarkIcon && ids.includes(slide.story.id)) {
          bookmarkIcon.setAttribute('fill', 'currentColor');
        }
      });
    },

    emptyHtml: () => `
      <div class="editorstory-header"><h1 class="editorstory-title">Day Story</h1></div>
      <div class="empty-state">
        <div class="empty-state-title">${t('search.no_cards_title')}</div>
        <div class="empty-state-desc">${t('search.no_cards_desc')}</div>
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

  /* 진입 애니메이션이 끝난 시점에 온보딩(인트로 모달 → 카드 뒤집기 코치마크)을 실행한다. */
  afterPageEnter(page, () => runEditorOnboarding(page));
  return page;
}


/* ─────────────────────────────────────────────
   섹션 1-1: 신규 사용자 온보딩 (논블로킹 튜토리얼)
   ───────────────────────────────────────────── */

/* 인트로 모달(최초 1회) → 닫으면 카드 뒤집기 Pulse·툴팁. 둘 다 hasSeen 으로 게이트. */
function runEditorOnboarding(page) {
  /* 빠른 탭 왕복 방어: 콜백 시점에 여전히 이 탭인지 확인 (QA Q1) */
  if (getCurrentPath() !== '/editorstory') return;

  if (!hasSeen(ONBOARDING_FLAGS.INTRO_EDITOR)) {
    showIntroSheet({
      flag: ONBOARDING_FLAGS.INTRO_EDITOR,
      icon: '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><polyline points="10 2 10 10 13 7 16 10 16 2"/></svg>',
      title: t('onboarding.editor_title'),
      lines: [t('onboarding.editor_line1'), t('onboarding.editor_line2')],
      onClose: () => maybeShowFlipCoach(page),
    });
  } else {
    maybeShowFlipCoach(page);
  }
}

/* 카드 뒤집기 코치마크 — 카드 뷰일 때만, 카드 영역이 실재할 때만 (QA Q8) */
function maybeShowFlipCoach(page) {
  if (getCurrentPath() !== '/editorstory') return;
  if (hasSeen(ONBOARDING_FLAGS.TIP_CARD_FLIP)) return;

  const cardArea = page.querySelector('#editorstory-card-area');
  /* isEmpty 면 카드 영역 자체가 없고, 캘린더 뷰면 hidden → 표시하지 않음 */
  if (!cardArea || cardArea.hidden) return;

  showCardFlipCoach({
    container: cardArea,
    flag: ONBOARDING_FLAGS.TIP_CARD_FLIP,
    text: t('onboarding.tip_card_flip'),
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

  const actionsHtml = `${cardActionButton({ ariaLabel: t('detail.share_button'), svg: SHARE_ICON_SVG })}
                ${cardActionButton({ ariaLabel: t('detail.bookmark_button'), svg: BOOKMARK_ICON_SVG })}`;

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
            <button class="back-editor-btn${hasComment && !isEditorNoteRead(story.id) ? ' unread' : ''}" type="button" title="${t('editor.form_editor_comment')}" data-story-id="${escapeHtml(story.id)}" data-comment="${escapeHtml(story.editor_comment || '')}" data-editor-name="${escapeHtml(EDITOR_DISPLAY_NAME)}" style="${hasComment ? '' : 'visibility: hidden; pointer-events: none;'}">
              <img src="/assets/editor_profile.png" alt="editor" class="back-editor-avatar" loading="lazy" decoding="async" />
            </button>
            <div class="back-date-actions">
              <div class="back-date">${t('date.full', { y: escapeHtml(story.historical_year), m: month, d: day })}</div>
              <button class="card-detail-shortcut-btn" type="button" aria-label="${t('home.detail_button')}" title="${t('home.detail_button')}">${t('home.detail_button')}</button>
            </div>`;

  const backHtml = cardBack({
    title: story.figure_name,
    bodyHtml: bodyToHtml(story.body),
    footerHtml,
  });

  /* 관리자(Custom Claim token.admin)면 카드 위쪽 여백에 "콘텐츠 관리" 플로팅 버튼을 띄운다.
     flipper 와 형제(=카드 면과 분리)라 회전·기본 카드 레이아웃에 영향을 주지 않는다. */
  const adminFloatHtml = getState('isAdmin') === true
    ? `<button type="button" class="card-admin-edit-float" data-id="${escapeHtml(story.id)}" aria-label="${escapeHtml(t('editor.content_mgmt'))}" title="${escapeHtml(t('editor.content_mgmt'))}">${ADMIN_EDIT_ICON_SVG}</button>`
    : '';

  return cardShell({ frontHtml, backHtml, extraHtml: adminFloatHtml });
}


/* ─────────────────────────────────────────────
   섹션 3: 카드 이벤트 (공통 flip/press/fade + 역사 카드 전용 액션)
   ───────────────────────────────────────────── */

function bindFlipCardEvents(flipContainer, story, bookmarkedIds, iso) {
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
    onAfterFlip: (e) => {
      document.dispatchEvent(new CustomEvent('ds:card-flipped'));
      /* 뒷면(상세)까지 펼쳐본 경우에만 읽음으로 기록 (앞면 복귀 플립은 제외) */
      if (iso && e?.currentTarget?.classList.contains('flipped')) markDateRead(iso);
    },
  });
  if (!flipper) return;
  flipContainer.dataset.bound = '1';

  /* 북마크 아이콘 초기 상태 (slide HTML 은 정적 캐시라 동적 표시) */
  const bookmarkIcon = flipContainer.querySelector(`.card-action-btn[aria-label="${t('detail.bookmark_button')}"] svg`);
  if (bookmarkIcon && story && bookmarkedIds.includes(story.id)) {
    bookmarkIcon.setAttribute('fill', 'currentColor');
  }

  const detailBtn = flipContainer.querySelector('.card-detail-shortcut-btn');
  const shareBtn = flipContainer.querySelector(`.card-action-btn[aria-label="${t('detail.share_button')}"]`);
  const bookmarkBtn = flipContainer.querySelector(`.card-action-btn[aria-label="${t('detail.bookmark_button')}"]`);

  if (detailBtn && story) {
    detailBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigate(`/detail/${story.id}`);
    });
  }

  /* 관리자 "콘텐츠 관리" 플로팅 버튼 → 해당 카드의 에디터 수정 화면으로 즉시 진입 */
  const adminEditBtn = flipContainer.querySelector('.card-admin-edit-float');
  if (adminEditBtn && story) {
    adminEditBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      navigate(`/editor/new?edit=${encodeURIComponent(story.id)}`);
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
          dialogTitle: t('calendar.share_history'),
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
      const editorName = EDITOR_DISPLAY_NAME;
      if (!comment) return;
      const bubble = document.createElement('div');
      bubble.className = 'editor-comment-bubble';
      const nameEl = document.createElement('span');
      nameEl.className = 'editor-comment-name';
      nameEl.textContent = editorName;
      bubble.appendChild(document.createTextNode(comment));
      bubble.appendChild(nameEl);
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
