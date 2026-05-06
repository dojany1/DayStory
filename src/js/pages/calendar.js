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
import { showToast } from '../components/toast.js';
import { auth } from '../firebase.js';
import { getState } from '../state.js';
import { escapeHtml } from '../utils/sanitize.js';
import { getDaysInMonth, getLocalToday, toLocalDateFromIso } from '../utils/date.js';
import { getStoryImageUrl, preloadStoryImages } from '../utils/imageLoading.js';
import { backfillStoryThumbnailsForMonth } from '../services/images.js';
import { navigate } from '../router.js';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='400' viewBox='0 0 300 400'%3E%3Crect fill='%23e0e0e0' width='300' height='400'/%3E%3Ctext x='50%25' y='45%25' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='40'%3E%F0%9F%93%B7%3C/text%3E%3C/svg%3E";

export function renderCalendar() {
  const page = document.createElement('div');
  page.className = 'calendar-page page';

  page.innerHTML = `
    <div class="calendar-header">
      <h1 class="calendar-title">캘린더</h1>
      <div class="calendar-toggle" data-mode="history" data-tour-target="calendar-toggle">
        <button type="button" class="calendar-toggle-btn active" data-mode="history">역사 일화</button>
        <button type="button" class="calendar-toggle-btn" data-mode="mine">나의 일화</button>
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

  const user = getState('user') || { id: 'guest' };
  const uid = auth?.currentUser?.uid || user.id;

  try {
    const [historyStories, myStories, bookmarkedIds] = await Promise.all([
      fetchStories().catch(() => []),
      uid && uid !== 'guest' ? fetchMyStories(uid).catch(() => []) : Promise.resolve([]),
      getBookmarkedStoryIds().catch(() => []),
    ]);
    state.historyStories = historyStories || [];
    state.myStories = myStories || [];
    state.bookmarkedIds = bookmarkedIds || [];
  } catch {
    /* 무시: 빈 그리드로 폴백 */
  }

  renderGrid(page, state, today);

  /* 모드 토글 */
  page.querySelectorAll('.calendar-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      if (mode === state.mode) return;
      Haptics.selectionChanged().catch(() => {});
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
    Haptics.selectionChanged().catch(() => {});
    state.month -= 1;
    if (state.month < 0) {
      state.month = 11;
      state.year -= 1;
    }
    renderGrid(page, state, today);
  });

  page.querySelector('#cal-next-month').addEventListener('click', () => {
    if (isAtCurrentMonth(state, today)) return;
    Haptics.selectionChanged().catch(() => {});
    state.month += 1;
    if (state.month > 11) {
      state.month = 0;
      state.year += 1;
    }
    renderGrid(page, state, today);
  });
}

function isAtCurrentMonth(state, today) {
  return state.year === today.getFullYear() && state.month === today.getMonth();
}

function renderGrid(page, state, today) {
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
  preloadStoryImages(currentMonthStories, { variant: 'thumb', limit: 8, fallback: false });

  const profile = getState('profile') || {};
  if (profile.role === 'editor') {
    void backfillStoryThumbnailsForMonth(currentMonthStories, {
      collectionName: state.mode === 'history' ? 'stories' : 'userStories',
      uid: auth?.currentUser?.uid || getState('user')?.id || 'guest',
      year: state.year,
      month: state.month + 1,
    });
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

    html += `
      <button type="button" class="${cellClasses}" data-date="${isoDate}" ${story || canWriteMyStory ? '' : 'disabled aria-disabled="true"'}>
        <span class="cal-cell-day">${d}</span>
        ${peekHtml}
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
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
      openCardPopup(story, state.mode, state.bookmarkedIds);
    });
  });

  grid.querySelectorAll('.cal-cell-mine-write').forEach(cell => {
    cell.addEventListener('click', () => {
      const date = cell.dataset.date;
      if (!date) return;
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
      navigate(`/mystory/new?date=${date}`);
    });
  });
}

function renderCellPeek(story, mode) {
  const img = getStoryImageUrl(story, 'thumb') || PLACEHOLDER_IMG;
  const title = mode === 'history'
    ? (story.figure_name || story.title || '')
    : (story.title || '');
  return `
    <span class="cal-cell-peek" aria-hidden="true">
      <img class="cal-cell-peek-img" src="${escapeHtml(img)}" alt="" loading="lazy" decoding="async" draggable="false" onerror="this.style.visibility='hidden'" />
      <span class="cal-cell-peek-title">${escapeHtml(title)}</span>
    </span>
  `;
}

/* ─────────────────────────────────────────────
   카드 모달 — 선택한 날짜의 카드를 띄워서 보여줍니다
   ───────────────────────────────────────────── */
function openCardPopup(story, mode, bookmarkedIds = []) {
  document.querySelectorAll('.calendar-card-popup').forEach(p => p.remove());

  const dateObj = toLocalDateFromIso(story.publish_date || '');
  const validDate = !!dateObj;
  const month = validDate ? dateObj.getMonth() + 1 : '';
  const day = validDate ? dateObj.getDate() : '';
  const year = validDate ? dateObj.getFullYear() : '';

  const overlay = document.createElement('div');
  overlay.className = 'calendar-card-popup';
  overlay.innerHTML = `
    <div class="calendar-card-popup-inner">
      <button type="button" class="calendar-card-popup-close" aria-label="닫기">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      <div class="calendar-card-popup-stage">
        ${mode === 'history'
          ? buildHistoryCardHtml(story, year, month, day, bookmarkedIds)
          : buildMyCardHtml(story, year, month, day)}
      </div>
      <div class="calendar-card-popup-hint">카드를 탭하면 뒤집힙니다</div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));

  const close = () => {
    overlay.classList.remove('open');
    setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 240);
  };

  overlay.querySelector('.calendar-card-popup-close').addEventListener('click', (e) => {
    e.stopPropagation();
    close();
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.classList.contains('calendar-card-popup-inner')) close();
  });

  /* 카드 플립 — 클릭 시 앞/뒷면 전환 */
  const flipper = overlay.querySelector('.flipper');
  if (flipper) {
    flipper.addEventListener('click', (e) => {
      if (e.target.closest('.card-action-btn')) return;
      if (e.target.closest('.card-detail-shortcut-btn')) return;
      if (e.target.closest('.back-editor-btn')) return;
      if (e.target.closest('.editor-comment-bubble')) return;
      if (flipper.classList.contains('is-flipping')) return;
      flipper.classList.add('is-flipping');
      Haptics.selectionChanged().catch(() => {});
      flipper.classList.toggle('flipped');
      setTimeout(() => flipper.classList.remove('is-flipping'), 400);
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
    let bubbleTimer = null;
    const showEditorBubble = (e) => {
      e.stopPropagation();
      const comment = editorBtn.dataset.comment;
      const editorName = editorBtn.dataset.editorName || 'DayStory';
      if (!comment) return;
      const existing = overlay.querySelector('.editor-comment-bubble');
      if (existing) {
        existing.remove();
        if (bubbleTimer) clearTimeout(bubbleTimer);
        return;
      }
      const bubble = document.createElement('div');
      bubble.className = 'editor-comment-bubble';
      const nameEl = document.createElement('span');
      nameEl.className = 'editor-comment-name';
      nameEl.textContent = editorName;
      bubble.appendChild(nameEl);
      bubble.appendChild(document.createTextNode(comment));
      editorBtn.parentElement.appendChild(bubble);
      if (bubbleTimer) clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(() => bubble.remove(), 4000);
    };
    editorBtn.addEventListener('click', showEditorBubble);
  }

  /* 공유 / 북마크 버튼 — 역사 일화에만 표시 */
  if (mode === 'history') {
    const shareBtn = overlay.querySelector('.card-action-btn[aria-label="공유"]');
    const bookmarkBtn = overlay.querySelector('.card-action-btn[aria-label="보관함"]');

    if (shareBtn) {
      shareBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const user = getState('user');
        if (user && user.id === 'guest') {
          showToast('로그인이 필요한 기능입니다.', 'info');
          close();
          navigate('/login');
          return;
        }
        try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
        try {
          const shareUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? `https://daystory.app/detail/${story.id}`
            : window.location.href;
          await Share.share({
            title: story.figure_name || '',
            text: `[DayStory] ${story.figure_name || ''}\n\n${story.summary || ''}`,
            url: shareUrl,
          });
        } catch {
          /* 사용자가 공유 시트를 닫은 경우는 무시 */
        }
      });
    }

    if (bookmarkBtn) {
      bookmarkBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const user = getState('user');
        if (user && user.id === 'guest') {
          showToast('로그인이 필요한 기능입니다.', 'info');
          close();
          navigate('/login');
          return;
        }
        try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
        const res = await toggleBookmark(story.id);
        if (res.error) {
          showToast(res.error, 'error');
          return;
        }
        showToast(res.bookmarked ? '보관함에 추가했습니다' : '보관함에서 해제했습니다', 'success');
        const svg = bookmarkBtn.querySelector('svg');
        if (svg) svg.style.fill = res.bookmarked ? 'currentColor' : 'none';

        if (res.bookmarked && !bookmarkedIds.includes(story.id)) {
          bookmarkedIds.push(story.id);
        } else if (!res.bookmarked) {
          const idx = bookmarkedIds.indexOf(story.id);
          if (idx > -1) bookmarkedIds.splice(idx, 1);
        }
      });
    }
  }
}

function buildHistoryCardHtml(story, year, month, day, bookmarkedIds = []) {
  const bodyHtml = (story.body || '').split(/\n|\\n/)
    .map(p => p.trim() ? `<p>${escapeHtml(p)}</p>` : '<p><br></p>').join('');
  const isBookmarked = !!(story.id && bookmarkedIds.includes(story.id));
  const editorComment = story.editor_comment || '';
  const editorPhotoURL = (story.editor && story.editor.photoURL) || '';
  const editorName = (story.editor && story.editor.displayName) || 'DayStory';
  const editorBtnHidden = !editorComment.trim();

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
                <button class="card-action-btn" aria-label="보관함">
                  <svg viewBox="0 0 24 24" fill="${isBookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
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
            <img src="${escapeHtml(story.image_url || PLACEHOLDER_IMG)}" alt="${escapeHtml(story.figure_name || '')}" loading="eager" decoding="async" fetchpriority="high" width="1200" height="1500" draggable="false" />
            <div class="card-image-title">${escapeHtml(story.figure_name || '')}</div>
          </div>
        </div>
        <div class="back history-card-back">
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
              <button class="card-detail-shortcut-btn" type="button">상세 보기</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildMyCardHtml(story, year, month, day) {
  const bodyHtml = (story.body || '').split(/\n|\\n/)
    .map(p => p.trim() ? `<p>${escapeHtml(p)}</p>` : '<p><br></p>').join('');
  const imageUrl = story.image_url || PLACEHOLDER_IMG;
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
              <div class="card-meta">${escapeHtml(story.title || '')}</div>
            </div>
          </div>
          <div class="history-card-image-wrap">
            <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(story.title || '')}" loading="eager" decoding="async" fetchpriority="high" width="1200" height="1500" onerror="this.style.display='none'" draggable="false" />
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
