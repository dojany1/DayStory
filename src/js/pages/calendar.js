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
import { auth } from '../firebase.js';
import { getState } from '../state.js';
import { escapeHtml } from '../utils/sanitize.js';
import { getDaysInMonth, getLocalToday, toLocalDateFromIso } from '../utils/date.js';
import { navigate } from '../router.js';
import { shareStory } from '../services/sharing.js';
import { localizedStory } from '../utils/storyI18n.js';
import { t } from '../i18n/index.js';
import { lockScroll, unlockScroll } from '../utils/scrollLock.js';
import { showConfirm } from '../components/confirmDialog.js';

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
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
      <button type="button" class="calendar-month-arrow" id="cal-prev-month" aria-label="이전 달">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <div class="calendar-month-label" id="cal-month-label">—</div>
      <button type="button" class="calendar-month-arrow" id="cal-next-month" aria-label="다음 달">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>

    <div class="calendar-weekdays">
      ${WEEKDAYS.map((d, i) => `<div class="calendar-weekday ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}">${d}</div>`).join('')}
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

  monthLabel.textContent = `${state.year}년 ${state.month + 1}월`;

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
  const currentMonthStories = stories.filter((story) => {
    if (!story?.publish_date) return false;
    const [year, month] = story.publish_date.split('-');
    return Number(year) === state.year && Number(month) === state.month + 1;
  });
  const profile = getState('profile') || {};
  if (profile.role === 'editor') {
  }

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
    const cellClasses = [
      'cal-cell',
      isFuture ? 'cal-cell-future' : '',
      isToday ? 'cal-cell-today' : '',
      story ? 'cal-cell-has-story' : 'cal-cell-empty',
      canWriteMyStory ? 'cal-cell-mine-write' : '',
      dayOfWeek === 0 ? 'sun' : (dayOfWeek === 6 ? 'sat' : ''),
    ].filter(Boolean).join(' ');

    const peekHtml = story ? renderCellPeek(story, state.mode) : '';
    const writeHtml = (canWriteMyStory && isToday)
      ? `<div class="cal-cell-write-prompt">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
             <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
           </svg>
         </div>`
      : '';

    html += `
      <button type="button" class="${cellClasses}" data-date="${isoDate}" ${story || canWriteMyStory ? '' : 'disabled aria-disabled="true"'}>
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

  grid.querySelectorAll('.cal-cell-has-story').forEach(cell => {
    cell.addEventListener('click', () => {
      const date = cell.dataset.date;
      const story = storyByDate.get(date);
      if (!story) return;

      openCardPopup(story, state.mode, state.bookmarkedIds);
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
   ───────────────────────────────────────────── */
export function openCardPopup(story, mode, bookmarkedIds = [], options = {}) {
  document.querySelectorAll('.calendar-card-popup').forEach(p => p.remove());

  /* 현재 언어로 펼치기 (역사 카드만 다국어; 내 일기는 사용자 작성이라 그대로) */
  if (mode === 'history') story = localizedStory(story);

  const dateObj = toLocalDateFromIso(story.publish_date || '');
  const validDate = !!dateObj;
  const month = validDate ? dateObj.getMonth() + 1 : '';
  const day = validDate ? dateObj.getDate() : '';
  const year = validDate ? dateObj.getFullYear() : '';

  let collected = mode === 'history' && story.id ? isCollected(story.id) : false;

  /* 지난 카드를 열어보면 영구 수집 처리 */
  if (mode === 'history' && !collected && story.id && story.publish_date && !canCollect(story.publish_date)) {
    const res = collect(story.id, story.publish_date, { bypass: true });
    if (res.ok) collected = true;
  }

  const collectible = mode === 'history' && story.publish_date ? canCollect(story.publish_date) : false;
  const locked = false;

  const overlay = document.createElement('div');
  overlay.className = 'calendar-card-popup';
  overlay.innerHTML = `
    <div class="calendar-card-popup-inner">
      <div class="calendar-card-popup-stage">
        ${mode === 'history'
          ? buildHistoryCardHtml(story, year, month, day, bookmarkedIds, collected, { showDeleteBtn: !!options.onRemove })
          : buildMyCardHtml(story, year, month, day, getMyCardNickname(story))}
      </div>
      ${options.hideHint ? '' : `<div class="calendar-card-popup-hint">${collected ? t('calendar.card_collected_hint') : t('calendar.card_tap_hint')}</div>`}
    </div>
  `;

  document.body.appendChild(overlay);
  lockScroll();
  requestAnimationFrame(() => overlay.classList.add('open'));

  const close = () => {
    unlockScroll();
    overlay.classList.remove('open');
    setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 240);
  };


  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.classList.contains('calendar-card-popup-inner')) close();
  });

  /* 삭제 버튼 (보관함 페이지에서 onRemove 콜백을 넘긴 경우) */
  if (options.onRemove) {
    const deleteBtn = overlay.querySelector('.card-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const ok = await showConfirm({
          title: t('bookmarks.remove_confirm_title'),
          message: t('bookmarks.remove_confirm_message'),
          confirmText: t('bookmarks.remove_btn'),
          cancelText: t('common.cancel'),
          danger: true,
        });
        if (!ok) return;
        await options.onRemove(story);
        close();
      });
    }
  }

  /* 카드 플립 — 수집된 카드 또는 오늘 카드만 뒤집을 수 있음 */
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
      /* 수집 성공 — 토스트로 안내 + 버튼 상태 전환 */
      collectBtn.classList.add('collect-btn--done');
      collectBtn.disabled = true;
      collectBtn.textContent = t('calendar.collected_button');
      showToast(t('calendar.collect_success_text'), 'success');
      /* 팝업 힌트 업데이트 */
      const hint = overlay.querySelector('.calendar-card-popup-hint');
      if (hint) hint.textContent = t('calendar.card_collected_hint');
      /* 플립 허용 */
      overlay._collected = true;
    });
  }

  /* 상세 보기 버튼은 역사 일화에만 있음 */
  const detailBtn = overlay.querySelector('.card-detail-shortcut-btn');
  if (detailBtn && mode === 'history' && story.id) {
    detailBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      close();
      navigate(`/detail/${story.id}`);
    });
  }

  /* 에디터 한마디 버튼 — 클릭 시 말풍선 표시 (역사 모드에만 존재) */
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
      const handleOutside = (event) => {
        if (editorBtn.contains(event.target)) return;
        removeEditorBubble();
      };
      document.addEventListener('click', handleOutside);
      removeOutsideListener = () => document.removeEventListener('click', handleOutside);
    };

    editorBtn.addEventListener('click', showEditorBubble);
  }

  /* 공유 / 수정 버튼 — 나의 일화에만 표시 */
  if (mode !== 'history') {
    const shareBtn = overlay.querySelector('.share-my-story-btn');
    const editBtn = overlay.querySelector('.edit-my-story-btn');

    if (shareBtn) {
      shareBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await shareStory(story, { kind: 'mystory', includeImage: false });
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
    const shareBtn = overlay.querySelector('.card-action-btn[aria-label="공유"]');
    const bookmarkBtn = overlay.querySelector('.card-action-btn[aria-label="보관함"]');

    if (shareBtn) {
      shareBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await shareStory(story, { kind: 'history' });
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

function buildHistoryCardHtml(story, year, month, day, bookmarkedIds = [], collected = false, options = {}) {
  const bodyHtml = (story.body || '').split(/\n|\\n/)
    .map(p => p.trim() ? `<p>${escapeHtml(p)}</p>` : '<p><br></p>').join('');
  const isBookmarked = !!(story.id && bookmarkedIds.includes(story.id));
  const editorComment = story.editor_comment || '';
  const editorPhotoURL = (story.editor && story.editor.photoURL) || '';
  const editorName = (story.editor && story.editor.displayName) || 'DayStory';
  const editorBtnHidden = !editorComment.trim();
  const imageUrl = story.image_url || '';
  const imageAttrs = imageUrl ? `src="${escapeHtml(imageUrl)}"` : '';

  return `
    <div class="flip-container">
      <div class="flipper">
        <div class="front history-card-front">
          <div class="history-card-top">
            <div class="card-top-left">
              <div class="card-year">${escapeHtml(story.historical_year || year)}</div>
              <div class="card-date">${month}. ${day}</div>
            </div>
            <div class="card-top-right">
              <div class="card-actions">
                <button class="card-action-btn" aria-label="공유">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                  </svg>
                </button>
                <button class="card-action-btn bookmark-btn${isBookmarked ? ' active' : ''}" aria-label="보관함">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                  </svg>
                </button>
              </div>
              <div class="card-meta">
                ${escapeHtml(story.country || '')}<br>
                ${year} / ${String(month).padStart(2, '0')} / ${String(day).padStart(2, '0')}
              </div>
            </div>
          </div>
          <div class="history-card-image-wrap">
            <img ${imageAttrs} alt="${escapeHtml(story.figure_name || '')}" loading="eager" decoding="async" width="320" height="400" draggable="false" />
            <div class="card-image-title">${escapeHtml(story.figure_name || '')}</div>
          </div>
        </div>
        <div class="back history-card-back">
          ${options.showDeleteBtn ? `
            <button class="card-delete-btn" type="button" aria-label="${escapeHtml(t('bookmarks.remove_btn'))}" title="${escapeHtml(t('bookmarks.remove_btn'))}">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/>
                <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>` : ''}
          <div class="back-title">${escapeHtml(story.figure_name || '')}</div>
          <hr class="back-divider" />
          <div class="back-body">${bodyHtml}</div>
          <div class="back-footer">
            <button class="back-editor-btn" type="button" title="에디터 한마디" data-comment="${escapeHtml(editorComment)}" data-editor-name="${escapeHtml(editorName)}" style="${editorBtnHidden ? 'visibility: hidden; pointer-events: none;' : ''}">
              ${editorPhotoURL
                ? `<img src="${escapeHtml(editorPhotoURL)}" alt="editor" class="back-editor-avatar" loading="lazy" decoding="async" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><span class="back-editor-avatar-fallback" style="display:none">✍️</span>`
                : '<span class="back-editor-avatar-fallback">✍️</span>'}
            </button>
            <div class="back-date-actions">
              <div class="back-date">${escapeHtml(story.historical_year || year)}년 ${month}월 ${day}일</div>
              <button class="card-detail-shortcut-btn" type="button">${escapeHtml(t('home.detail_button'))}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
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
  return candidates.map(v => typeof v === 'string' ? v.trim() : '').find(Boolean) || '사용자';
}

function buildMyCardHtml(story, year, month, day, nickname = '') {
  const bodyHtml = (story.body || '').split(/\n|\\n/)
    .map(p => p.trim() ? `<p>${escapeHtml(p)}</p>` : '<p><br></p>').join('');
  const imageUrl = story.image_url || '';
  const imageAttrs = imageUrl ? `src="${escapeHtml(imageUrl)}"` : '';
  return `
    <div class="flip-container">
      <div class="flipper mystory-flipper">
        <div class="front history-card-front">
          <div class="history-card-top">
            <div class="card-top-left">
              <div class="card-year mystory-card-year">${year}</div>
              <div class="card-date">${month}. ${day}</div>
            </div>
            <div class="card-top-right">
              <div class="card-actions">
                <button class="card-action-btn share-my-story-btn" data-id="${escapeHtml(story.id || '')}" aria-label="공유">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                  </svg>
                </button>
                <button class="card-action-btn edit-my-story-btn" data-id="${escapeHtml(story.id || '')}" aria-label="수정">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
              </div>
              <div class="card-meta">${escapeHtml(nickname)}</div>
            </div>
          </div>
          <div class="history-card-image-wrap">
            <img ${imageAttrs} alt="${escapeHtml(story.title || '')}" loading="eager" decoding="async" width="320" height="400" draggable="false" />
            <div class="card-image-title">${escapeHtml(story.title || '')}</div>
          </div>
        </div>
        <div class="back history-card-back">
          <div class="back-title">${escapeHtml(story.title || '')}</div>
          <hr class="back-divider" />
          <div class="back-body">${bodyHtml}</div>
          <div class="back-footer">
            <div class="back-date">${year}년 ${month}월 ${day}일</div>
          </div>
        </div>
      </div>
    </div>
  `;
}
