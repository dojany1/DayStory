/* =====================================================================
   calendar.js — 캘린더 페이지
   =====================================================================
   - 상단 토글로 "역사 일화" / "나의 일화" 모드를 전환합니다.
   - 월 단위 그리드에서 각 날짜 칸에 카드의 윗부분이 절반 정도 보이고,
     칸을 누르면 해당 카드가 모달로 떠올라 뒤집어 볼 수 있습니다.
   ===================================================================== */

import { fetchStories } from '../services/stories.js';
import { fetchMyStories } from '../services/mystories.js';
import { toggleBookmark, getBookmarkedStoryIds } from '../services/bookmarks.js';
import { collect, isCollected, canCollect, bulkCollect } from '../services/collection.js';
import { showToast } from '../components/toast.js';
import { auth } from '../services/firebase.js';
import { getState } from '../state.js';
import { escapeHtml } from '../utils/sanitize.js';
import { getDaysInMonth, getLocalToday, toLocalDateFromIso } from '../utils/date.js';
import { navigate } from '../router.js';
import { shareStory, captureAndShareCard } from '../services/sharing.js';
import { localizedStory } from '../utils/storyI18n.js';
import { t, tList } from '../i18n/index.js';
import { lockScroll, unlockScroll } from '../utils/scrollLock.js';
import { showConfirm } from '../components/confirmDialog.js';
import { showShareChoice } from '../components/shareChoiceSheet.js';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import {
  cardShell, cardFront, cardFrontTop, cardImageWrap, cardBack, cardActionButton,
  bodyToHtml, SHARE_ICON_SVG,
} from '../components/cardDeck/cardFace.js';
import { EDITOR_DISPLAY_NAME, EDITOR_PROFILE_SRC } from '../utils/constants.js';
import { isDateRead, markDateRead } from '../services/readHistory.js';
import { observeCardMetrics } from '../utils/cardMetrics.js';

/* 요일 헤더는 t() 기반 — 언어 변경 시 재렌더에서 최신 값 반영 */
export function getWeekdays() {
  return tList('date.weekdays');
}

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
export function renderCalendar() {
  const page = document.createElement('div');
  page.className = 'calendar-page page';

  page.innerHTML = `
    <div class="calendar-header">
      <h1 class="calendar-title">${t('calendar.title')}</h1>
      <div class="calendar-toggle" data-mode="history">
        <button type="button" class="calendar-toggle-btn active" data-mode="history">${t('calendar.tab_history')}</button>
        <button type="button" class="calendar-toggle-btn" data-mode="mine">${t('calendar.tab_mine')}</button>
        <span class="calendar-toggle-thumb"></span>
      </div>
    </div>

    <div class="calendar-month-nav">
      <button type="button" class="calendar-month-arrow" id="cal-prev-month" aria-label="${t('common.prev_month')}">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <div class="calendar-month-label" id="cal-month-label">—</div>
      <button type="button" class="calendar-month-arrow" id="cal-next-month" aria-label="${t('common.next_month')}">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>

    <div class="calendar-weekdays">
      ${getWeekdays().map((d, i) => `<div class="calendar-weekday ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}">${d}</div>`).join('')}
    </div>

    <div class="calendar-grid" id="calendar-grid">
      <div class="calendar-grid-loading">
        <div class="loading-spinner"></div>
      </div>
    </div>
  `;

  loadCalendar(page);
  return page;
}

async function loadCalendar(page) {
  const todayStr = getLocalToday();
  const today = toLocalDateFromIso(todayStr) || new Date();

  const state = {
    mode: 'history',
    year: today.getFullYear(),
    month: today.getMonth(),
    historyStories: [],
    myStories: [],
    bookmarkedIds: [],
  };

  const user = getState('user');
  const uid = auth?.currentUser?.uid || user?.id;

  try {
    const [historyStories, myStories, bookmarkedIds] = await Promise.all([
      fetchStories().catch(() => []),
      uid ? fetchMyStories(uid).catch(() => []) : Promise.resolve([]),
      getBookmarkedStoryIds().catch(() => []),
    ]);
    state.historyStories = historyStories || [];
    state.myStories = myStories || [];
    state.bookmarkedIds = bookmarkedIds || [];
  } catch {
    /* 무시: 빈 그리드로 폴백 */
  }

  bulkCollect((state.historyStories || []).map((s) => s?.id).filter(Boolean));

  renderGrid(page, state, today);

  /* 모드 토글 */
  page.querySelectorAll('.calendar-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      if (mode === state.mode) return;
      state.mode = mode;
      const toggle = page.querySelector('.calendar-toggle');
      toggle.dataset.mode = mode;
      page.querySelectorAll('.calendar-toggle-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === mode);
      });
      renderGrid(page, state, today);
    });
  });

  /* 월 이동 */
  page.querySelector('#cal-prev-month').addEventListener('click', () => {
    state.month -= 1;
    if (state.month < 0) {
      state.month = 11;
      state.year -= 1;
    }
    renderGrid(page, state, today);
  });

  page.querySelector('#cal-next-month').addEventListener('click', () => {
    if (isAtCurrentMonth(state, today)) return;
    state.month += 1;
    if (state.month > 11) {
      state.month = 0;
      state.year += 1;
    }
    renderGrid(page, state, today);
  });
}

export function isAtCurrentMonth(state, today) {
  return state.year === today.getFullYear() && state.month === today.getMonth();
}

export function renderGrid(page, state, today) {
  const grid = page.querySelector('#calendar-grid');
  const monthLabel = page.querySelector('#cal-month-label');
  if (!grid || !monthLabel) return;

  monthLabel.textContent = t('date.year_month', { y: state.year, m: state.month + 1 });

  const nextBtn = page.querySelector('#cal-next-month');
  if (nextBtn) {
    const atCurrent = isAtCurrentMonth(state, today);
    nextBtn.disabled = atCurrent;
    nextBtn.classList.toggle('disabled', atCurrent);
  }

  /* 표시할 일화 모음 */
  const stories = state.mode === 'history' ? state.historyStories : state.myStories;
  const storyByDate = new Map();
  stories.forEach(s => {
    if (s && s.publish_date) storyByDate.set(s.publish_date, s);
  });
  /* 스와이프 묶음은 캘린더 셀과 동일하게 storyByDate(날짜당 1건)에서 파생시킨다.
     stories.filter 를 직접 쓰면 publish_date 가 같은 중복 발행분이 그대로 새어
     같은 날짜 카드가 여러 장으로 넘어가는 버그가 발생한다. */
  const currentMonthStories = [...storyByDate.values()].filter((story) => {
    const [year, month] = story.publish_date.split('-');
    return Number(year) === state.year && Number(month) === state.month + 1;
  });
  const firstDay = toLocalDateFromIso(`${state.year}-${String(state.month + 1).padStart(2, '0')}-01`);
  const startWeekday = firstDay.getDay();
  const daysInMonth = getDaysInMonth(state.year, state.month + 1);

  let html = '';

  for (let i = 0; i < startWeekday; i++) {
    html += `<div class="cal-cell cal-cell-blank"></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const mNum = String(state.month + 1).padStart(2, '0');
    const dNum = String(d).padStart(2, '0');
    const isoDate = `${state.year}-${mNum}-${dNum}`;
    const story = storyByDate.get(isoDate);

    const dateObj = toLocalDateFromIso(isoDate);
    if (!dateObj) continue;

    const isFuture = dateObj > today;
    const isToday = dateObj.getTime() === today.getTime();
    const dayOfWeek = dateObj.getDay();

    const canWriteMyStory = state.mode === 'mine' && !story && !isFuture;
    /* 에디터 일화(history)에서만 읽은 날짜를 흐리게. '내 일기'는 읽음 개념 없음 */
    const isRead = state.mode === 'history' && isDateRead(isoDate);
    const cellClasses = [
      'cal-cell',
      isFuture ? 'cal-cell-future' : '',
      isToday ? 'cal-cell-today' : '',
      story ? 'cal-cell-has-story' : 'cal-cell-empty',
      canWriteMyStory ? 'cal-cell-mine-write' : '',
      isRead ? 'is-read' : '',
      dayOfWeek === 0 ? 'sun' : (dayOfWeek === 6 ? 'sat' : ''),
    ].filter(Boolean).join(' ');

    /* a11y: 날짜(+제목) 라벨, 읽은 날짜는 끝에 ', 이미 읽음' 부착 */
    const titleForAria = story
      ? (state.mode === 'history' ? (story.figure_name || story.title || '') : (story.title || ''))
      : '';
    const ariaLabel = `${state.month + 1}월 ${d}일${titleForAria ? `, ${titleForAria}` : ''}${isRead ? ', 이미 읽음' : ''}`;

    const peekHtml = story ? renderCellPeek(story, state.mode) : '';
    const writeHtml = (canWriteMyStory && isToday)
      ? `<div class="cal-cell-write-prompt">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
             <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
           </svg>
         </div>`
      : '';

    html += `
      <button type="button" class="${cellClasses}" data-date="${isoDate}" aria-label="${escapeHtml(ariaLabel)}" ${story || canWriteMyStory ? '' : 'disabled aria-disabled="true"'}>
        <span class="cal-cell-day">${d}</span>
        ${peekHtml}
        ${writeHtml}
      </button>
    `;
  }

  /* 마지막 주를 7칸으로 채우기 위한 빈 칸 */
  const totalCells = startWeekday + daysInMonth;
  const trailing = (7 - (totalCells % 7)) % 7;
  for (let i = 0; i < trailing; i++) {
    html += `<div class="cal-cell cal-cell-blank"></div>`;
  }

  grid.innerHTML = html;

  const sortedMonthStories = [...currentMonthStories].sort((a, b) =>
    (a.publish_date || '').localeCompare(b.publish_date || ''));

  grid.querySelectorAll('.cal-cell-has-story').forEach(cell => {
    cell.addEventListener('click', () => {
      const date = cell.dataset.date;
      const story = storyByDate.get(date);
      if (!story) return;

      if (typeof state.onStoryOpen === 'function') {
        state.onStoryOpen(story, date);
      }
      const idx = sortedMonthStories.findIndex(s => s.publish_date === date);
      openCardPopup(story, state.mode, state.bookmarkedIds, {
        stories: sortedMonthStories,
        currentIndex: Math.max(0, idx),
      });
    });
  });

  grid.querySelectorAll('.cal-cell-mine-write').forEach(cell => {
    cell.addEventListener('click', () => {
      const date = cell.dataset.date;
      if (!date) return;
      navigate(`/mystory/new?date=${date}`);
    });
  });
}

function renderCellPeek(story, mode) {
  const img = story.image_url || '';
  const imageAttrs = img ? `src="${escapeHtml(img)}"` : '';
  const title = mode === 'history'
    ? (story.figure_name || story.title || '')
    : (story.title || '');

  return `
    <span class="cal-cell-peek" aria-hidden="true">
      <img class="cal-cell-peek-img" ${imageAttrs} alt="" loading="lazy" decoding="async" draggable="false" />
      <span class="cal-cell-peek-title">${escapeHtml(title)}</span>
    </span>
  `;
}

/* ─────────────────────────────────────────────
   카드 모달 — 선택한 날짜의 카드를 띄워서 보여줍니다
   options.stories / options.currentIndex 를 전달하면 팝업 내에서 좌우 스와이프로 카드를 넘길 수 있음
   ───────────────────────────────────────────── */
export function openCardPopup(story, mode, bookmarkedIds = [], options = {}) {
  document.querySelectorAll('.calendar-card-popup').forEach(p => p.remove());

  const overlay = document.createElement('div');
  overlay.className = 'calendar-card-popup';
  overlay.innerHTML = `
    <div class="calendar-card-popup-inner">
      <div class="calendar-card-popup-stage"></div>
      ${options.hideHint ? '' : `<div class="calendar-card-popup-hint"></div>`}
      <div class="calendar-card-popup-nav"></div>
    </div>
  `;

  document.body.appendChild(overlay);
  lockScroll();
  requestAnimationFrame(() => overlay.classList.add('open'));

  /* 카드 스테이지 실측 → --card-w/--card-h 주입.
     종전에는 폭 기준 aspect-ratio 만 있고 높이 상한이 전혀 없었다. 세로
     아이폰에서는 카드 폭이 뷰포트로 먼저 제한돼 드러나지 않았지만,
     세로가 짧은 뷰포트(예: 400x520)에서는 팝업이 화면 밖으로 넘쳤다. */
  const disposeCardMetrics = observeCardMetrics(overlay.querySelector('.calendar-card-popup-stage'));

  const close = () => {
    unlockScroll();
    disposeCardMetrics();
    overlay.classList.remove('open');
    setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 240);
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.classList.contains('calendar-card-popup-inner')) close();
  });

  const stories = options.stories || [];
  const navState = { idx: Math.max(0, options.currentIndex ?? 0) };

  const showCard = (targetStory, animate) => {
    _mountCardInPopup(overlay, targetStory, mode, bookmarkedIds, options, close, animate);
    _updatePopupNav(overlay, stories, navState.idx);
  };

  showCard(story, false);

  /* 스와이프 감지 — stories 가 2개 이상일 때만 활성화 */
  if (stories.length > 1) {
    let startX = 0, startY = 0;
    overlay.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });

    overlay.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      /* 수평 스와이프만 반응 (최소 60px, 수직 이동보다 커야 함) */
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy)) return;
      const newIdx = navState.idx + (dx < 0 ? 1 : -1);
      if (newIdx < 0 || newIdx >= stories.length) return;
      navState.idx = newIdx;
      showCard(stories[newIdx], true);
    }, { passive: true });
  }
}

function _mountCardInPopup(overlay, story, mode, bookmarkedIds, options, close, animate) {
  if (mode === 'history') story = localizedStory(story);

  const dateObj = toLocalDateFromIso(story.publish_date || '');
  const validDate = !!dateObj;
  const month = validDate ? dateObj.getMonth() + 1 : '';
  const day = validDate ? dateObj.getDate() : '';
  const year = validDate ? dateObj.getFullYear() : '';

  let collected = mode === 'history' && story.id ? isCollected(story.id) : false;
  if (mode === 'history' && !collected && story.id && story.publish_date && !canCollect(story.publish_date)) {
    const res = collect(story.id, story.publish_date, { bypass: true });
    if (res.ok) collected = true;
  }

  const cardHtml = mode === 'history'
    ? buildHistoryCardHtml(story, year, month, day, bookmarkedIds, collected)
    : buildMyCardHtml(story, year, month, day, getMyCardNickname(story));

  const stage = overlay.querySelector('.calendar-card-popup-stage');
  const hint = overlay.querySelector('.calendar-card-popup-hint');

  const applyContent = () => {
    stage.innerHTML = cardHtml;
    if (hint && !options.hideHint) {
      const hasMultiple = (options.stories || []).length > 1;
      hint.textContent = hasMultiple
        ? t('calendar.card_swipe_hint')
        : (collected ? t('calendar.card_collected_hint') : t('calendar.card_tap_hint'));
    }
    _wireCardListeners(overlay, story, mode, bookmarkedIds, options, close);
  };

  if (animate) {
    stage.classList.add('popup-card-fading');
    setTimeout(() => {
      applyContent();
      stage.classList.remove('popup-card-fading');
    }, 120);
  } else {
    applyContent();
  }
}

function _wireCardListeners(overlay, story, mode, bookmarkedIds, options, close) {
  /* 카드 플립 */
  const flipper = overlay.querySelector('.flipper');
  if (flipper) {
    flipper.addEventListener('click', (e) => {
      if (e.target.closest('.card-action-btn')) return;
      if (e.target.closest('.card-detail-shortcut-btn')) return;
      if (e.target.closest('.back-editor-btn')) return;
      if (e.target.closest('.editor-comment-bubble')) return;
      if (e.target.closest('.collect-btn')) return;
      if (flipper.classList.contains('is-flipping')) return;
      flipper.classList.add('is-flipping');
      flipper.classList.toggle('flipped');
      /* 에디터 일화를 뒷면(상세)까지 펼쳐본 경우에만 읽음 처리 */
      if (mode === 'history' && flipper.classList.contains('flipped') && story?.publish_date) {
        markDateRead(story.publish_date);
      }
      setTimeout(() => flipper.classList.remove('is-flipping'), 400);
    });
  }

  /* 수집 버튼 */
  const collectBtn = overlay.querySelector('.collect-btn');
  if (collectBtn && mode === 'history' && story.id) {
    collectBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isCollected(story.id)) return;
      const result = collect(story.id, story.publish_date || '');
      if (!result.ok) {
        showToast(t('calendar.collect_locked_toast'), 'info');
        return;
      }
      collectBtn.classList.add('collect-btn--done');
      collectBtn.disabled = true;
      collectBtn.textContent = t('calendar.collected_button');
      showToast(t('calendar.collect_success_text'), 'success');
      const hint = overlay.querySelector('.calendar-card-popup-hint');
      if (hint) hint.textContent = t('calendar.card_collected_hint');
      overlay._collected = true;
    });
  }

  /* 상세 보기 버튼 */
  const detailBtn = overlay.querySelector('.card-detail-shortcut-btn');
  if (detailBtn && mode === 'history' && story.id) {
    detailBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigate(`/detail/${story.id}`);
    });
  }

  /* 에디터 한마디 버튼 */
  const editorBtn = overlay.querySelector('.back-editor-btn');
  if (editorBtn) {
    let removeOutsideListener = null;

    const removeEditorBubble = () => {
      const bubble = overlay.querySelector('.editor-comment-bubble');
      if (bubble) bubble.remove();
      if (removeOutsideListener) { removeOutsideListener(); removeOutsideListener = null; }
    };

    const showEditorBubble = (e) => {
      e.stopPropagation();
      const existing = overlay.querySelector('.editor-comment-bubble');
      if (existing) {
        if (existing.contains(e.target)) return;
        removeEditorBubble();
        return;
      }
      const comment = editorBtn.dataset.comment;
      if (!comment) return;
      const bubble = document.createElement('div');
      bubble.className = 'editor-comment-bubble';
      const nameEl = document.createElement('span');
      nameEl.className = 'editor-comment-name';
      nameEl.textContent = EDITOR_DISPLAY_NAME;
      bubble.appendChild(document.createTextNode(comment));
      bubble.appendChild(nameEl);
      editorBtn.appendChild(bubble);

      if (Capacitor.isNativePlatform()) {
        Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
      }

      const storyId = editorBtn.dataset.storyId;
      if (storyId) {
        markEditorNoteRead(storyId);
        editorBtn.classList.remove('unread');
      }

      const handleOutside = (event) => {
        if (editorBtn.contains(event.target)) return;
        removeEditorBubble();
      };
      document.addEventListener('click', handleOutside);
      removeOutsideListener = () => document.removeEventListener('click', handleOutside);
    };

    editorBtn.addEventListener('click', showEditorBubble);
  }

  /* 캡처 공유 헬퍼 — "카드 이미지 / 링크" 선택 시트로 공유 방법을 고른다. */
  const shareCardCapture = async (kind) => {
    const cardEl = overlay.querySelector('.history-card-front');
    if (!cardEl) {
      await shareStory(story, { kind, includeImage: kind === 'history' });
      return;
    }
    const choice = await showShareChoice({ showSave: Capacitor.isNativePlatform() });
    if (!choice) return; /* 취소 */

    const dialogTitle = kind === 'history' ? t('calendar.share_history') : t('mystory.share');
    /* 공유 본문 텍스트는 넣지 않는다 — 이미지/링크만 공유(사용자 요청).
       "링크" 선택 시 캡처를 생략하고 링크만 공유 → SNS 미리보기로 카드
       이미지+제목 노출(서버 shareOg). "갤러리 저장" 선택 시 공유 대신 저장. */
    const res = await captureAndShareCard(cardEl, {
      title: story.title || story.figure_name || 'DayStory',
      date: story.publish_date,
      dialogTitle,
      linkOnly: choice === 'link',
      saveToGallery: choice === 'save',
    });
    /* 갤러리 저장은 실패해도 공유 시트로 폴백하지 않는다(사용자 의도가 "저장"). */
    if (choice !== 'save' && !res.ok && res.reason !== 'cancelled') {
      await shareStory(story, { kind, includeImage: kind === 'history' });
    }
  };

  /* 공유 / 수정 버튼 — 나의 일화에만 표시 */
  if (mode !== 'history') {
    const shareBtn = overlay.querySelector('.share-my-story-btn');
    const editBtn = overlay.querySelector('.edit-my-story-btn');

    if (shareBtn) {
      shareBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        shareBtn.disabled = true;
        try { await shareCardCapture('mystory'); }
        finally { shareBtn.disabled = false; }
      });
    }

    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        close();
        navigate('/mystory/new?edit=' + editBtn.dataset.id);
      });
    }
  }

  /* 공유 / 북마크 버튼 — 역사 일화에만 표시 */
  if (mode === 'history') {
    const shareBtn = overlay.querySelector(`.card-action-btn[aria-label="${t('detail.share_button')}"]`);
    const bookmarkBtn = overlay.querySelector(`.card-action-btn[aria-label="${t('detail.bookmark_button')}"]`);

    if (shareBtn) {
      shareBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        shareBtn.disabled = true;
        try { await shareCardCapture('history'); }
        finally { shareBtn.disabled = false; }
      });
    }

    if (bookmarkBtn) {
      bookmarkBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const res = await toggleBookmark(story.id);
        if (res.error) {
          showToast(res.error, 'error');
          return;
        }
        showToast(res.bookmarked ? t('toast.bookmark_added') : t('toast.bookmark_removed'), 'success');
        bookmarkBtn.classList.toggle('active', res.bookmarked);

        if (res.bookmarked && !bookmarkedIds.includes(story.id)) {
          bookmarkedIds.push(story.id);
        } else if (!res.bookmarked) {
          const idx = bookmarkedIds.indexOf(story.id);
          if (idx > -1) bookmarkedIds.splice(idx, 1);
        }
        if (options.onBookmarkChange) options.onBookmarkChange(story.id, res.bookmarked);
      });
    }
  }
}

function _updatePopupNav(overlay, stories, currentIdx) {
  const nav = overlay.querySelector('.calendar-card-popup-nav');
  if (!nav) return;
  if (stories.length <= 1) { nav.textContent = ''; return; }
  nav.textContent = `${currentIdx + 1} / ${stories.length}`;
}

function buildHistoryCardHtml(story, year, month, day, bookmarkedIds = [], collected = false) {
  const isBookmarked = !!(story.id && bookmarkedIds.includes(story.id));
  const editorComment = story.editor_comment || '';
  /* 에디터 아바타는 항상 로컬 PNG 사용 (iOS WKWebView 의 WebP 디코더 crash 회피). */
  const editorName = EDITOR_DISPLAY_NAME;
  const editorBtnHidden = !editorComment.trim();

  const bookmarkSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                  </svg>`;
  const actionsHtml = `${cardActionButton({ ariaLabel: t('detail.share_button'), svg: SHARE_ICON_SVG })}
                <button class="card-action-btn bookmark-btn${isBookmarked ? ' active' : ''}" aria-label="${t('detail.bookmark_button')}">${bookmarkSvg}</button>`;

  const metaHtml = `${escapeHtml(story.country || '')}<br>
                ${year} / ${String(month).padStart(2, '0')} / ${String(day).padStart(2, '0')}`;

  const footerHtml = `
            <button class="back-editor-btn${!editorBtnHidden && story.id && !isEditorNoteRead(story.id) ? ' unread' : ''}" type="button" title="${t('editor.form_editor_comment')}" data-story-id="${escapeHtml(story.id || '')}" data-comment="${escapeHtml(editorComment)}" data-editor-name="${escapeHtml(editorName)}" style="${editorBtnHidden ? 'visibility: hidden; pointer-events: none;' : ''}">
              <img src="${EDITOR_PROFILE_SRC}" alt="editor" class="back-editor-avatar" loading="lazy" decoding="async" />
            </button>
            <div class="back-date-actions">
              <div class="back-date">${t('date.full', { y: escapeHtml(story.historical_year || year), m: month, d: day })}</div>
              <button class="card-detail-shortcut-btn" type="button">${escapeHtml(t('home.detail_button'))}</button>
            </div>`;

  const frontHtml = cardFront({
    topHtml: cardFrontTop({
      yearHtml: escapeHtml(story.historical_year || year),
      dateLabel: `${month}. ${day}`,
      actionsHtml,
      metaHtml,
    }),
    imageHtml: cardImageWrap({ src: story.image_url, alt: story.figure_name || '', title: story.figure_name || '' }),
  });

  const backHtml = cardBack({
    title: story.figure_name || '',
    bodyHtml: bodyToHtml(story.body),
    footerHtml,
  });

  return cardShell({ frontHtml, backHtml });
}

function getMyCardNickname(story) {
  const profile = getState('profile') || {};
  const user = getState('user') || {};
  const emailName = typeof user.email === 'string' ? user.email.split('@')[0] : '';
  const candidates = [
    story.author_nickname, story.authorNickname,
    story.author?.nickname, story.author?.displayName,
    profile.nickname, user.displayName, emailName,
  ];
  return candidates.map(v => typeof v === 'string' ? v.trim() : '').find(Boolean) || t('common.default_user');
}

function buildMyCardHtml(story, year, month, day, nickname = '') {
  const editSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false">
                    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>
                    <path d="m15 5 4 4"/>
                  </svg>`;
  const actionsHtml = `${cardActionButton({ ariaLabel: t('detail.share_button'), svg: SHARE_ICON_SVG, extraClass: 'share-my-story-btn', dataId: story.id || '' })}
                ${cardActionButton({ ariaLabel: t('common.modify'), svg: editSvg, extraClass: 'edit-my-story-btn', dataId: story.id || '' })}`;

  const frontHtml = cardFront({
    topHtml: cardFrontTop({
      yearHtml: String(year),
      yearClass: 'mystory-card-year',
      dateLabel: `${month}. ${day}`,
      actionsHtml,
      metaHtml: escapeHtml(nickname),
    }),
    imageHtml: cardImageWrap({ src: story.image_url, alt: story.title || '', title: story.title || '' }),
  });

  const backHtml = cardBack({
    title: story.title || '',
    bodyHtml: bodyToHtml(story.body),
    footerHtml: `<div class="back-date">${t('date.full', { y: year, m: month, d: day })}</div>`,
  });

  return cardShell({ frontHtml, backHtml, flipperClass: 'mystory-flipper' });
}
