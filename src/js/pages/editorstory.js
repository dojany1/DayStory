/* =====================================================================
   editorstory.js — 에디터 일화 페이지 (메인 화면)
   =====================================================================
   상단 월/일 휠로 날짜를 선택해 해당 날짜의 카드를 표시합니다.
   - 첫 진입 시 카드가 위에서 슬라이딩하며 등장
   - 오늘 카드를 처음 클릭(=뒤집기) 하면 자동으로 "수집"되며 축하 애니메이션 재생
   - 좌우 스와이프로 날짜 이동 (휠 피커와 연동)

     마지막 수정 날짜 : 2026-05-11 01:30
   ===================================================================== */

import { fetchStories, fetchTodayStory } from '../services/stories.js';
import { toggleBookmark, getBookmarkedStoryIds } from '../services/bookmarks.js';
import { showToast } from '../components/toast.js';
import { escapeHtml } from '../utils/sanitize.js';
import { shareStory } from '../services/sharing.js';
import { getState } from '../state.js';
import { navigate, setOnUnmount } from '../router.js';
import { markLetterRead } from '../services/widget.js';
import { localizedStory } from '../utils/storyI18n.js';
import { t } from '../i18n/index.js';
import { collect, isCollected, canCollect, bulkCollect } from '../services/collection.js';
import { renderGrid, isAtCurrentMonth, WEEKDAYS } from './calendar.js';

const FLIP_DURATION_MS = 400;
const CARD_STACK_SETTLE_MS = 560;

const ICON_CALENDAR = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7v10"/><path d="M6 5v14"/><rect width="12" height="18" x="10" y="3" rx="2"/></svg>`;
const ICON_CARD = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>`;

/* 스와이프 commit 가드 — bindCardEvents 가 카드 재렌더로 다시 호출돼도
   짧은 시간 내 두 번째 commit이 발생하지 않도록 모듈 스코프에 둔다. */
let lastSwipeCommitAt = 0;
const SWIPE_COMMIT_GUARD_MS = 1500;


/* ─────────────────────────────────────────────
   섹션 1: 페이지 렌더링
   ───────────────────────────────────────────── */

export function renderEditorStory() {
  const page = document.createElement('div');
  page.className = 'editorstory-page page';

  const savedView = sessionStorage.getItem('ds_session_view') ?? (localStorage.getItem('ds_default_view') || 'card');
  const initialYear = new Date().getFullYear();

  page.innerHTML = `
    <div class="editorstory-header">
      <h1 class="editorstory-title"></h1>
    </div>

    <div class="wheel-pickers-container">
      <div class="wheel-year-label" id="editorstory-year-label">${initialYear}</div>
      <div class="wheel-picker-wrapper">
        <div class="wheel-selection-box"></div>
        <div class="modern-wheel-scroll" id="editorstory-month-scroll"></div>
        <button type="button" class="view-toggle-btn" id="editorstory-view-toggle" aria-label="보기 방식 변경">${savedView === 'calendar' ? ICON_CARD : ICON_CALENDAR}</button>
      </div>
      <div class="wheel-picker-wrapper" id="editorstory-day-picker">
        <div class="wheel-selection-box"></div>
        <div class="modern-wheel-scroll" id="editorstory-calendar"></div>
      </div>
    </div>

    <div class="editorstory-card-area" id="editorstory-card-area">
      <div style="display:flex;justify-content:center;padding:var(--space-8);width:100%;">
        <div class="loading-spinner"></div>
      </div>
    </div>

    <div class="page-calendar-view" id="editorstory-cal-view" hidden>
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
        <div class="calendar-grid-loading"><div class="loading-spinner"></div></div>
      </div>
    </div>
  `;


  if (savedView === 'calendar') {
    page.querySelector('#editorstory-day-picker').hidden = true;
    page.querySelector('#editorstory-card-area').hidden = true;
    page.querySelector('#editorstory-cal-view').hidden = false;
  }

  loadEditorStoryData(page);
  return page;
}


/* ─────────────────────────────────────────────
   섹션 2: 데이터 로딩 + 휠 초기화
   ───────────────────────────────────────────── */

async function loadEditorStoryData(page) {
  try {
    const [allStories, todayStory, bookmarkedIds] = await Promise.all([
      fetchStories(),
      fetchTodayStory(),
      getBookmarkedStoryIds(),
    ]);

    /* 발행된 카드가 한 장도 없을 때: 빈 상태 메시지로 종료 */
    if (!todayStory) {
      page.innerHTML = `
        <div class="editorstory-header"><h1 class="editorstory-title">Day Story</h1></div>
        <div class="empty-state">
          <div class="empty-state-title">아직 발행된 카드가 없어요</div>
          <div class="empty-state-desc">곧 첫 카드가 도착할 거예요</div>
        </div>
      `;
      return;
    }

    const today = new Date(todayStory.publish_date + 'T00:00:00');
    const historyStories = allStories || [];
    bulkCollect([todayStory, ...historyStories].map((s) => s?.id).filter(Boolean));

    const monthEl = page.querySelector('#editorstory-month-scroll');
    const dayEl = page.querySelector('#editorstory-calendar');
    const cardArea = page.querySelector('#editorstory-card-area');

    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();
    let latestDate = today;
    let isInitial = true;


    /* 월 휠: 1~12, currentMonth 초과는 disabled */
    if (monthEl) {
      monthEl.innerHTML = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const cls = m > currentMonth ? ' disabled' : '';
        return `<div class="wheel-item${cls}" data-month="${m}">${m}</div>`;
      }).join('');
    }

    /* 일 휠: 1월 1일 ~ 오늘까지 평면 리스트 */
    if (dayEl) {
      const items = [];
      for (let m = 1; m <= currentMonth; m++) {
        const lastDay = m === currentMonth ? currentDay : new Date(currentYear, m, 0).getDate();
        for (let d = 1; d <= lastDay; d++) {
          const mm = String(m).padStart(2, '0');
          const dd = String(d).padStart(2, '0');
          items.push(`<div class="wheel-item" data-date="${currentYear}-${mm}-${dd}" data-month="${m}" data-day="${d}">${d}</div>`);
        }
      }
      dayEl.innerHTML = items.join('');
    }

    function getCenterItem(scrollArea) {
      const boxCenter = scrollArea.getBoundingClientRect().left + scrollArea.offsetWidth / 2;
      let closest = null;
      let minDist = Infinity;
      scrollArea.querySelectorAll('.wheel-item:not(.disabled)').forEach((el) => {
        const c = el.getBoundingClientRect().left + el.offsetWidth / 2;
        const d = Math.abs(boxCenter - c);
        if (d < minDist) { minDist = d; closest = el; }
      });
      return closest;
    }

    function syncMonthWheel(dayMonth) {
      const activeMonthEl = monthEl.querySelector('.wheel-item.active');
      if (activeMonthEl && parseInt(activeMonthEl.dataset.month, 10) === dayMonth) return;
      const targetMonthEl = monthEl.querySelector(`.wheel-item[data-month="${dayMonth}"]`);
      if (!targetMonthEl) return;
      monthEl.querySelectorAll('.wheel-item').forEach(el => el.classList.remove('active'));
      targetMonthEl.classList.add('active');
      const t = targetMonthEl.offsetLeft - monthEl.offsetWidth / 2 + targetMonthEl.offsetWidth / 2;
      monthEl.scrollTo({ left: t, behavior: 'smooth' });
    }

    function updateSelection(forceInstant = false) {
      let centerDay;
      if (forceInstant) {
        centerDay = dayEl.querySelector('.wheel-item.active');
      } else {
        centerDay = getCenterItem(dayEl);
        if (centerDay) {
          dayEl.querySelectorAll('.wheel-item').forEach(el => el.classList.remove('active'));
          centerDay.classList.add('active');
        }
      }
      if (!centerDay) return;

      syncMonthWheel(parseInt(centerDay.dataset.month, 10));

      const isoDate = centerDay.dataset.date;
      const newDate = new Date(isoDate + 'T00:00:00');
      if (latestDate && latestDate.getTime() === newDate.getTime() && !isInitial) return;

      const direction = isInitial ? null : (newDate > latestDate ? 'next' : 'prev');
      latestDate = newDate;
      const story = historyStories.find((s) => s.publish_date === isoDate)
        || (todayStory.publish_date === isoDate ? todayStory : null);
      renderCard(cardArea, story, newDate, bookmarkedIds, direction);
      isInitial = false;
    }

    /* 일 휠 스크롤 디바운스 */
    let scrollTimeout;
    const onDayScrollEnd = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        updateSelection(false);
      }, 150);
    };
    dayEl.addEventListener('scroll', onDayScrollEnd, { passive: true });

    /* 월 휠 스크롤 디바운스 — 중앙 월로 일 휠을 점프 */
    let monthScrollTimeout;
    const onMonthScrollEnd = () => {
      if (currentView !== 'card') return;
      clearTimeout(monthScrollTimeout);
      monthScrollTimeout = setTimeout(() => {
        const centerMonth = getCenterItem(monthEl);
        if (!centerMonth || centerMonth.classList.contains('disabled')) return;
        const activeDay = dayEl.querySelector('.wheel-item.active');
        const activeDayMonth = activeDay ? parseInt(activeDay.dataset.month, 10) : -1;
        if (parseInt(centerMonth.dataset.month, 10) !== activeDayMonth) {
          onMonthClick(centerMonth);
        } else {
          monthEl.querySelectorAll('.wheel-item').forEach(el => el.classList.remove('active'));
          centerMonth.classList.add('active');
        }
      }, 150);
    };
    monthEl.addEventListener('scroll', onMonthScrollEnd, { passive: true });

    /* 월 휠 클릭: 해당 월의 첫날(또는 오늘)로 일 휠 점프 */
    const onMonthClick = (item) => {
      if (item.classList.contains('disabled')) return;
      const m = parseInt(item.dataset.month, 10);
      const dd = m === currentMonth ? String(currentDay).padStart(2, '0') : '01';
      const targetDate = `${currentYear}-${String(m).padStart(2, '0')}-${dd}`;
      const targetDayEl = dayEl.querySelector(`.wheel-item[data-date="${targetDate}"]`);
      if (!targetDayEl) return;
      dayEl.querySelectorAll('.wheel-item').forEach(el => el.classList.remove('active'));
      targetDayEl.classList.add('active');
      monthEl.querySelectorAll('.wheel-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      clearTimeout(scrollTimeout);
      const dayScroll = targetDayEl.offsetLeft - dayEl.offsetWidth / 2 + targetDayEl.offsetWidth / 2;
      dayEl.scrollTo({ left: dayScroll, behavior: 'smooth' });
      const monthScroll = item.offsetLeft - monthEl.offsetWidth / 2 + item.offsetWidth / 2;
      monthEl.scrollTo({ left: monthScroll, behavior: 'smooth' });
      updateSelection(true);
    };

    /* 일 휠 클릭 */
    const onDayClick = (item) => {
      dayEl.querySelectorAll('.wheel-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      clearTimeout(scrollTimeout);
      updateSelection(true);
      const t = item.offsetLeft - dayEl.offsetWidth / 2 + item.offsetWidth / 2;
      dayEl.scrollTo({ left: t, behavior: 'smooth' });
    };

    monthEl.querySelectorAll('.wheel-item').forEach(item =>
      item.addEventListener('click', () => onMonthClick(item))
    );
    dayEl.querySelectorAll('.wheel-item').forEach(item =>
      item.addEventListener('click', () => onDayClick(item))
    );

    /* 초기 위치: 저장된 날짜 (없으면 오늘) — rAF로 레이아웃 완료 후 실행 */
    setTimeout(() => {
      requestAnimationFrame(() => {
        const todayStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
        const targetStr = todayStr;
        const targetItem = dayEl.querySelector(`.wheel-item[data-date="${targetStr}"]`);
        const targetMonth = targetItem ? parseInt(targetItem.dataset.month, 10) : currentMonth;
        const targetMonthItem = monthEl.querySelector(`.wheel-item[data-month="${targetMonth}"]`);
        if (targetItem) {
          targetItem.classList.add('active');
          if (!dayPicker.hidden) {
            dayEl.scrollLeft = targetItem.offsetLeft - dayEl.offsetWidth / 2 + targetItem.offsetWidth / 2;
          }
        }
        if (targetMonthItem) {
          targetMonthItem.classList.add('active');
          monthEl.scrollLeft = targetMonthItem.offsetLeft - monthEl.offsetWidth / 2 + targetMonthItem.offsetWidth / 2;
        }
        void markLetterRead();
        if (!dayPicker.hidden) updateSelection(true);
      });
    }, 0);

    /* ── 보기 방식 토글 (카드 ↔ 캘린더) ── */
    const calState = {
      mode: 'history',
      year: currentYear,
      month: today.getMonth(),
      historyStories,
      myStories: [],
      bookmarkedIds,
    };

    const toggleBtn = page.querySelector('#editorstory-view-toggle');
    const dayPicker = page.querySelector('#editorstory-day-picker');
    const calView   = page.querySelector('#editorstory-cal-view');
    let currentView = sessionStorage.getItem('ds_session_view') ?? (localStorage.getItem('ds_default_view') || 'card');

    if (currentView === 'calendar') {
      renderGrid(page, calState, today);
    }

    toggleBtn.addEventListener('click', () => {
      if (currentView === 'card') {
        currentView = 'calendar';
        sessionStorage.setItem('ds_session_view', 'calendar');
        toggleBtn.innerHTML = ICON_CARD;
        dayPicker.hidden = true;
        cardArea.hidden = true;
        calView.hidden = false;
        requestAnimationFrame(() => {
          calView.classList.add('view-enter');
          renderGrid(page, calState, today);
          setTimeout(() => calView.classList.remove('view-enter'), 250);
        });
      } else {
        currentView = 'card';
        sessionStorage.setItem('ds_session_view', 'card');
        toggleBtn.innerHTML = ICON_CALENDAR;
        calView.hidden = true;
        dayPicker.hidden = false;
        cardArea.hidden = false;
        requestAnimationFrame(() => {
          const activeDay = dayEl.querySelector('.wheel-item.active');
          if (activeDay) {
            dayEl.scrollLeft = activeDay.offsetLeft - dayEl.offsetWidth / 2 + activeDay.offsetWidth / 2;
          }
          updateSelection(true);
          cardArea.classList.add('view-enter');
          setTimeout(() => cardArea.classList.remove('view-enter'), 250);
        });
      }
    });

    /* 월 휠 스크롤 → 캘린더 모드일 때 그리드 업데이트 */
    let calMonthScrollTimer;
    monthEl.addEventListener('scroll', () => {
      if (currentView !== 'calendar') return;
      clearTimeout(calMonthScrollTimer);
      calMonthScrollTimer = setTimeout(() => {
        const active = getCenterItem(monthEl);
        if (!active) return;
        const m = parseInt(active.dataset.month, 10) - 1;
        if (m === calState.month && calState.year === currentYear) return;
        calState.month = m;
        calState.year = currentYear;
        renderGrid(page, calState, today);
      }, 150);
    }, { passive: true });

    /* 캘린더 이전/다음 달 버튼 */
    page.querySelector('#cal-prev-month').addEventListener('click', () => {
      calState.month -= 1;
      if (calState.month < 0) { calState.month = 11; calState.year -= 1; }
      const yearLabel = page.querySelector('#editorstory-year-label');
      if (yearLabel) yearLabel.textContent = calState.year;
      renderGrid(page, calState, today);
      syncMonthWheel(calState.month + 1);
    });

    page.querySelector('#cal-next-month').addEventListener('click', () => {
      if (isAtCurrentMonth(calState, today)) return;
      calState.month += 1;
      if (calState.month > 11) { calState.month = 0; calState.year += 1; }
      const yearLabel = page.querySelector('#editorstory-year-label');
      if (yearLabel) yearLabel.textContent = calState.year;
      renderGrid(page, calState, today);
      syncMonthWheel(calState.month + 1);
    });

  } catch (err) {
    console.error('에디터 일화 데이터 로딩 실패:', err);
    page.innerHTML = `
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
    `;
  }
}


/* ─────────────────────────────────────────────
   섹션 3: 카드 렌더링
   ───────────────────────────────────────────── */

function renderCard(cardArea, story, dateObj, bookmarkedIds, direction) {
  if (!cardArea) return;

  /* 현재 언어로 변환 */
  story = story ? localizedStory(story) : null;

  const allCards = Array.from(cardArea.querySelectorAll('.flip-container'));
  const oldCard = allCards.pop() || null;
  allCards.forEach(c => c.remove());

  const pubDate = story ? new Date(story.publish_date + 'T00:00:00') : dateObj;
  const month = pubDate.getMonth() + 1;
  const day = pubDate.getDate();
  const displayYear = dateObj.getFullYear();

  const newCard = document.createElement('div');
  newCard.className = 'flip-container';

  if (!story) {
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const formattedDate = `${monthNames[pubDate.getMonth()]} ${day}, ${displayYear}`;
    newCard.innerHTML = `
      <div class="flipper">
        <div class="front history-card-front empty-story-card">
          <div class="empty-story-day-circle">${day}</div>
          <div class="empty-story-title">${t('home.empty_card_title')}</div>
          <div class="empty-story-date">${formattedDate}</div>
        </div>
      </div>
    `;
  } else {
    const imageUrl = story.image_url || '';
    const imageAttrs = imageUrl ? `src="${escapeHtml(imageUrl)}"` : '';

    newCard.innerHTML = `
      <div class="flipper">
        <div class="front history-card-front">
          <div class="history-card-top">
            <div class="card-top-left">
              <div class="card-year">${escapeHtml(story.historical_year)}</div>
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
                  <svg viewBox="0 0 24 24" fill="${story && bookmarkedIds.includes(story.id) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                  </svg>
                </button>
              </div>
              <div class="card-meta">
                ${escapeHtml(story.card_count || '')} ${escapeHtml(story.country)}<br>
                ${displayYear} / ${String(month).padStart(2, '0')} / ${String(day).padStart(2, '0')}
              </div>
            </div>
          </div>
          <div class="history-card-image-wrap">
            <img ${imageAttrs} alt="${escapeHtml(story.figure_name)}" loading="eager" decoding="async" width="320" height="400" draggable="false" />
            <div class="card-image-title">${escapeHtml(story.figure_name)}</div>
          </div>
        </div>
        <div class="back history-card-back">
          <div class="back-title">${escapeHtml(story.figure_name)}</div>
          <hr class="back-divider" />
          <div class="back-body">
            ${(story.body || '').split(/\n|\\n/).map(p => p.trim() ? `<p>${escapeHtml(p)}</p>` : '<p><br></p>').join('')}
          </div>
          <div class="back-footer">
            <button class="back-editor-btn" type="button" title="에디터 한마디" data-story-id="${escapeHtml(story.id)}" data-comment="${escapeHtml(story.editor_comment || '')}" data-editor-name="${escapeHtml((story.editor && story.editor.displayName) || 'DayStory')}" style="${story.editor_comment && story.editor_comment.trim() !== '' ? '' : 'visibility: hidden; pointer-events: none;'}">
              ${story.editor && story.editor.photoURL
                ? `<img src="${escapeHtml(story.editor.photoURL)}" alt="editor" class="back-editor-avatar" loading="lazy" decoding="async" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><span class="back-editor-avatar-fallback" style="display:none">✍️</span>`
                : '<span class="back-editor-avatar-fallback">✍️</span>'}
            </button>
            <div class="back-date-actions">
              <div class="back-date">${escapeHtml(story.historical_year)}년 ${month}월 ${day}일</div>
              <button class="card-detail-shortcut-btn" type="button" aria-label="${t('home.detail_button')}" title="${t('home.detail_button')}">${t('home.detail_button')}</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  if (!direction || !oldCard) {
    cardArea.innerHTML = '';
    cardArea.appendChild(newCard);
    bindCardEvents(newCard, story, bookmarkedIds);
    return;
  }

  oldCard.classList.add('card-stack-item', `stack-exit-${direction}`);
  newCard.classList.add('card-stack-item', `stack-enter-${direction}`);
  cardArea.appendChild(newCard);
  void newCard.offsetWidth;
  newCard.classList.add('active');

  const onAnimationEnd = () => {
    if (oldCard.parentNode) oldCard.remove();
    newCard.classList.remove('card-stack-item', `stack-enter-${direction}`, 'active');
    bindCardEvents(newCard, story, bookmarkedIds);
  };
  newCard.addEventListener('transitionend', onAnimationEnd, { once: true });
  setTimeout(() => { if (newCard.classList.contains('card-stack-item')) onAnimationEnd(); }, CARD_STACK_SETTLE_MS);
}


/* ─────────────────────────────────────────────
   섹션 4: 카드 이벤트 (플립 + 자동 수집 + 액션)
   ───────────────────────────────────────────── */

function bindCardEvents(flipContainer, story, bookmarkedIds) {
  const flipper = flipContainer.querySelector('.flipper');
  if (!flipper) return;

  /* ── 스와이프 상태 변수 ── */
  let touchStartX = 0, touchStartY = 0;
  let isSwiping = false, swipeAxis = null;
  let isAnimating = false, isBackBodyScroll = false, lastTouchInputAt = 0;
  const SWIPE_THRESHOLD = 64;
  const SWIPE_DRAG_RESPONSE = 0.62;
  const SWIPE_RETURN_MS = 220;
  const SYNTHETIC_MOUSE_IGNORE_MS = 650;
  let tapStartTime = 0, tapStartX = 0, tapStartY = 0, touchStartTarget = null;

  const handleStart = (x, y, isBody = false) => {
    if (isAnimating || flipper.classList.contains('is-flipping')) return;
    touchStartX = x;
    touchStartY = y;
    isSwiping = false;
    swipeAxis = null;
    isBackBodyScroll = isBody;
    tapStartTime = Date.now();
    tapStartX = x;
    tapStartY = y;
  };

  const handleMove = (x, y) => {
    if (isAnimating) return;
    const diffX = x - touchStartX;
    const diffY = y - touchStartY;
    if (Math.abs(diffX) > 15 || Math.abs(diffY) > 15) touchStartTarget = null;
    if (!swipeAxis) {
      if (Math.abs(diffX) < 15 && Math.abs(diffY) < 15) return;
      swipeAxis = Math.abs(diffX) > Math.abs(diffY) ? 'x' : 'y';
    }
    if (swipeAxis === 'y') return;
    if (!isSwiping) { flipper.style.transition = 'none'; isSwiping = true; }
    const baseTransform = flipper.classList.contains('flipped') ? 'rotateY(180deg)' : '';
    flipper.style.transform = `translateX(${diffX * SWIPE_DRAG_RESPONSE}px) ${baseTransform}`;
  };

  const handleEnd = (x, y) => {
    if (!isSwiping || isAnimating) return;
    isAnimating = true;
    const diffX = x - touchStartX;
    flipper.style.transition = `transform ${SWIPE_RETURN_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`;
    flipper.classList.add('is-flipping');

    if (swipeAxis === 'x' && Math.abs(diffX) > SWIPE_THRESHOLD) {
      if (isBackBodyScroll) {
        flipper.style.transform = '';
        setTimeout(() => { flipper.style.transition = ''; flipper.classList.remove('is-flipping'); isSwiping = false; isAnimating = false; }, SWIPE_RETURN_MS);
        return;
      }
      if (Date.now() - lastSwipeCommitAt >= SWIPE_COMMIT_GUARD_MS) {
        lastSwipeCommitAt = Date.now();
        const offset = diffX < 0 ? 1 : -1;
        const dayWrapper = document.getElementById('editorstory-calendar');
        if (dayWrapper) {
          const items = Array.from(dayWrapper.querySelectorAll('.wheel-item'));
          const activeIdx = items.findIndex(el => el.classList.contains('active'));
          const candidate = items[activeIdx + offset];
          if (candidate) candidate.click();
        }
      }
    }
    flipper.style.transform = '';
    setTimeout(() => {
      flipper.style.transition = '';
      flipper.classList.remove('is-flipping');
      isSwiping = false;
      isAnimating = false;
    }, SWIPE_RETURN_MS);
  };

  /* ── 터치 이벤트 ── */
  flipper.addEventListener('touchstart', (e) => {
    lastTouchInputAt = Date.now();
    const isBody = !!e.target.closest('.back-body');
    touchStartTarget = e.target;
    handleStart(e.touches[0].clientX, e.touches[0].clientY, isBody);
  }, { passive: true });

  flipper.addEventListener('touchmove', (e) => {
    handleMove(e.touches[0].clientX, e.touches[0].clientY);
    if (isSwiping) e.preventDefault();
  }, { passive: false });

  flipper.addEventListener('touchend', (e) => {
    lastTouchInputAt = Date.now();
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    if (touchStartTarget && touchStartTarget.closest('.back-body') && !isSwiping) {
      const tapDuration = Date.now() - tapStartTime;
      if (tapDuration <= 400 && Math.abs(endX - tapStartX) <= 20 && Math.abs(endY - tapStartY) <= 20) {
        if (!story || flipper.classList.contains('is-flipping')) return;
        flipper.classList.add('is-flipping');
        flipper.classList.toggle('flipped');
        setTimeout(() => flipper.classList.remove('is-flipping'), 400);
        return;
      }
    }
    handleEnd(endX, endY);
  });

  /* ── 마우스 이벤트 (데스크톱) ── */
  let isMouseDown = false;
  flipper.addEventListener('mousedown', (e) => {
    if (Date.now() - lastTouchInputAt < SYNTHETIC_MOUSE_IGNORE_MS) return;
    if (e.target.closest('button')) return;
    if (e.target.closest('.back-body')) return;
    isMouseDown = true;
    handleStart(e.clientX, e.clientY, false);
  });

  /* 데스크톱 마우스 드래그용 — 로컬 변수에 보관하고 setOnUnmount 로 정리 (Wave 4: 글로벌 슬롯 제거) */
  const onMouseMove = (e) => { if (!isMouseDown) return; handleMove(e.clientX, e.clientY); };
  const onMouseUp   = (e) => { if (!isMouseDown) return; isMouseDown = false; handleEnd(e.clientX, e.clientY); };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup',   onMouseUp);

  setOnUnmount(() => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup',   onMouseUp);
  });

  const detailBtn = flipContainer.querySelector('.card-detail-shortcut-btn');
  const shareBtn = flipContainer.querySelector('.card-action-btn[aria-label="공유"]');
  const bookmarkBtn = flipContainer.querySelector('.card-action-btn[aria-label="보관함"]');

  if (detailBtn && story) {
    detailBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigate(`/detail/${story.id}`);
    });
  }

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
      bookmarkBtn.querySelector('svg').style.fill = res.bookmarked ? 'currentColor' : 'none';
      if (res.bookmarked && !bookmarkedIds.includes(story.id)) {
        bookmarkedIds.push(story.id);
      } else if (!res.bookmarked) {
        const idx = bookmarkedIds.indexOf(story.id);
        if (idx > -1) bookmarkedIds.splice(idx, 1);
      }
    });
  }

  /* 카드 클릭 → 자동 수집 (오늘 카드 + 미수집 시) + 플립 */
  flipper.addEventListener('click', (e) => {
    if (!story) return;
    if (e.target.closest('.card-action-btn')) return;
    if (e.target.closest('.back-editor-btn')) return;
    if (e.target.closest('.card-detail-shortcut-btn')) return;
    if (isSwiping) return;
    if (flipper.classList.contains('is-flipping')) return;
    /* 터치 기반 back-body 탭은 touchend에서 이미 처리 */
    if (e.pointerType === 'touch' && e.target.closest('.back-body')) return;

    /* 말풍선이 떠 있으면 그것만 닫음 */
    const openBubble = flipContainer.querySelector('.editor-comment-bubble');
    if (openBubble && !openBubble.contains(e.target)) {
      openBubble.remove();
      return;
    }

    /* 자동 수집:
       - 오늘 카드 + 미수집 → 토스트로 안내
       - 풀액세스(어드민/구독자)가 지난 카드를 클릭 → 무음으로 영구 수집 (해지 후에도 보관) */
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

    flipper.classList.add('is-flipping');
    flipper.classList.toggle('flipped');
    document.dispatchEvent(new CustomEvent('ds:card-flipped'));
    setTimeout(() => flipper.classList.remove('is-flipping'), FLIP_DURATION_MS);
  });

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
    };

    editorBtn.addEventListener('click', showBubble);
  }
}
