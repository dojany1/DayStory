/* =====================================================================
   editorstory.js — 에디터 일화 페이지 (메인 화면)
   =====================================================================
   앱에서 가장 먼저 보이는 메인 화면입니다.
   
   구성:
     1) 상단 타이틀 "Day Story"
     2) 주간 캘린더 바 (최근 7일 + 오늘)
     3) 오늘의 역사 카드 (앞면: 이미지, 뒷면: 일화 텍스트)
   
   기능:
     - 캘린더의 날짜를 클릭하면 해당 날짜의 카드로 변경됩니다
     - 카드를 클릭하면 앞/뒤가 뒤집히는 3D 플립 애니메이션이 나옵니다
     마지막 수정 날짜 : 2026-03-31 19:47
   ===================================================================== */

import { fetchStories, fetchTodayStory } from '../services/stories.js';
import { toggleBookmark, getBookmarkedStoryIds } from '../services/bookmarks.js';
import { showToast } from '../components/toast.js';
import { escapeHtml } from '../utils/sanitize.js';
import { formatLocalIsoDate, getDaysInMonth, getLocalToday, toLocalDateFromIso } from '../utils/date.js';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { getState } from '../state.js';
import { navigate, setOnUnmount } from '../router.js';

const DETAIL_BUTTON_LABEL = '상세 보기';
const EDITOR_COMMENT_SEEN_PREFIX = 'daystory:editor-comment-seen:';

/* 스와이프 commit 가드 — 카드가 재렌더되어 bindCardEvents가 다시 호출돼도
   직전 swipe 후 짧은 시간 내 두 번째 commit이 발생하지 않도록 모듈 스코프에 둔다. */
let lastSwipeCommitAt = 0;
const SWIPE_COMMIT_GUARD_MS = 1500;

function getEditorCommentSeenKey(editorBtn) {
  const storyId = editorBtn?.dataset?.storyId;
  return storyId ? `${EDITOR_COMMENT_SEEN_PREFIX}${storyId}` : '';
}

function hasSeenEditorComment(editorBtn) {
  const key = getEditorCommentSeenKey(editorBtn);
  if (!key) return editorBtn?.dataset.commentSeen === 'true';

  return localStorage.getItem(key) === 'true';
}

function markEditorCommentSeen(editorBtn) {
  const key = getEditorCommentSeenKey(editorBtn);
  editorBtn.dataset.commentSeen = 'true';
  if (key) localStorage.setItem(key, 'true');
}

function dismissEditorBadge(editorBtn) {
  if (!editorBtn) return;
  markEditorCommentSeen(editorBtn);
  editorBtn.querySelector('.editor-badge')?.remove();
}

function showEditorBadge(flipContainer) {
  const editorBtn = flipContainer.querySelector('.back-editor-btn');
  if (!editorBtn) return;
  if (editorBtn.style.visibility === 'hidden') return;
  if (hasSeenEditorComment(editorBtn)) {
    editorBtn.querySelector('.editor-badge')?.remove();
    return;
  }
  if (editorBtn.querySelector('.editor-badge')) return;

  const badge = document.createElement('span');
  badge.className = 'editor-badge';
  badge.textContent = '!';
  editorBtn.appendChild(badge);
}

/* ─────────────────────────────────────────────
   섹션 1: 에디터 일화 페이지 렌더링 함수
   ───────────────────────────────────────────── */

/**
 * renderEditorStory — 에디터 일화 페이지의 HTML 구조를 생성하고 반환합니다
 * @returns {HTMLElement} 에디터 일화 페이지 DOM 요소
 * 
 * 이 함수가 호출되면:
 *   1) 빈 페이지 틀을 만들고 (로딩 스피너 포함)
 *   2) loadEditorStoryData()를 비동기로 실행해 실제 데이터를 채웁니다
 */
export function renderEditorStory() {
  const page = document.createElement('div');
  page.className = 'editorstory-page page';

  page.innerHTML = `
    <!-- 상단 제목 -->
    <div class="editorstory-header">
      <h1 class="editorstory-title"></h1>
    </div>

    <!-- 휠 피커 스타일 날짜 선택기 -->
    <div class="wheel-pickers-container" style="margin-top: 10px;">
      <!-- 월 피커 -->
      <div class="wheel-picker-wrapper">
        <div class="wheel-selection-box"></div>
        <div class="modern-wheel-scroll" id="editorstory-month-scroll"></div>
      </div>
      <!-- 일 피커 -->
      <div class="wheel-picker-wrapper">
        <div class="wheel-selection-box"></div>
        <div class="modern-wheel-scroll" id="editorstory-calendar"></div>
      </div>
    </div>

    <!-- 메인 카드 영역 (처음에는 로딩 스피너 표시) -->
    <div class="editorstory-card-area" id="editorstory-card-area">
      <div style="display:flex;justify-content:center;padding:var(--space-8);width:100%;">
        <div class="loading-spinner"></div>
      </div>
    </div>
  `;

  /* 데이터를 비동기로 불러와서 페이지를 채움 */
  loadEditorStoryData(page);

  return page;
}


/* ─────────────────────────────────────────────
   섹션 2: 데이터 로딩 및 캘린더/카드 초기화
   ───────────────────────────────────────────── */
async function loadEditorStoryData(page) {
  /* 새 페이지 진입 시 swipe commit 가드 리셋 — 이전 세션/테스트의 잔여 상태가 첫 swipe를 막지 않도록. */
  lastSwipeCommitAt = 0;
  try {
    /* 빠른 첫 페인트를 위해 ① 오늘 카드 → ② 북마크 → ③ 전체 목록 순으로 먼저 도착하는 응답을 즉시 반영합니다. */
    const todayStoryPromise = fetchTodayStory();        /* limit(5), 가장 빠름 */
    const bookmarkedIdsPromise = getBookmarkedStoryIds();
    const allStoriesPromise = fetchStories();           /* 전체 목록, 가장 무거움 */

    const fetchedStory = await todayStoryPromise;
    /* "today"는 사용자 기기의 로컬 날짜를 기준으로 하며, fetchedStory의 publish_date에 의존하지 않는다.
       이유: 캘린더(/calendar)도 getLocalToday()를 쓰므로 휠 포커스/disabled 계산이 어긋나면 안 된다. */
    const todayStr = getLocalToday();
    const today = toLocalDateFromIso(todayStr) || new Date();
    /* fetchedStory가 정확히 오늘 날짜이면 오늘 카드, 아니면 빈 카드로 시작 */
    let todayStory = (fetchedStory && fetchedStory.publish_date === todayStr) ? fetchedStory : null;
    let latestPathDate = today;
    let bookmarkedIds = [];
    let allStories = fetchedStory ? [fetchedStory] : [];

    /* 북마크가 도착하면 현재 카드의 북마크 아이콘을 갱신 */
    bookmarkedIdsPromise.then((ids) => {
      bookmarkedIds = ids || [];
      const cardArea = page.querySelector('#editorstory-card-area');
      const bookmarkIcon = cardArea?.querySelector('.card-action-btn[aria-label="보관함"] svg');
      if (bookmarkIcon && todayStory && bookmarkedIds.includes(todayStory.id)) {
        bookmarkIcon.setAttribute('fill', 'currentColor');
      }
    }).catch(() => {});

    /* 전체 스토리가 도착하면 휠로 다른 날짜를 누를 때 사용 */
    allStoriesPromise.then((list) => {
      allStories = list || (fetchedStory ? [fetchedStory] : []);
      /* fetchTodayStory 응답에 오늘 카드가 없었지만 전체 목록에서 발견되면 카드 갱신 */
      if (!todayStory) {
        const todayInList = allStories.find(s => s.publish_date === todayStr);
        if (todayInList && latestPathDate.getTime() === today.getTime()) {
          todayStory = todayInList;
          renderCardToArea(cardArea, todayStory, today, null, bookmarkedIds, allStories);
        }
      }
    }).catch(() => {});

    /* ---- DOM 요소 참조 가져오기 ---- */
    const monthElement = page.querySelector('#editorstory-month-scroll');
    const calendarElement = page.querySelector('#editorstory-calendar');
    const cardArea = page.querySelector('#editorstory-card-area');

    /* ---- 월 네비게이션 렌더링 (1~12) ---- */
    if (monthElement) {
      let monthHtml = '';
      for (let m = 1; m <= 12; m++) {
        monthHtml += `<div class="wheel-item" data-month="${m}">${m}</div>`;
      }
      monthElement.innerHTML = monthHtml;
    }

    /* ---- 일 캘린더 렌더링 (연속 날짜 스트립) ---- */
    if (calendarElement) {
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;
      const currentDate = today.getDate();
      const todayStr = formatLocalIsoDate(today);

      let dayHtml = '';
      const wheelEndDate = new Date(currentYear, currentMonth, 0);
      for (let date = new Date(currentYear, 0, 1); date <= wheelEndDate; date.setDate(date.getDate() + 1)) {
        const isoDate = formatLocalIsoDate(date);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const disabledClass = isoDate > todayStr ? ' disabled' : '';
        dayHtml += `<div class="wheel-item${disabledClass}" data-date="${isoDate}" data-month="${month}" data-day="${day}">${day}</div>`;
      }
      calendarElement.innerHTML = dayHtml;

      function getSelectableDayLimit(selectedMonth) {
        const lastDay = getDaysInMonth(currentYear, selectedMonth);
        if (selectedMonth > currentMonth) return 0;
        if (selectedMonth === currentMonth) return Math.min(lastDay, currentDate);
        return lastDay;
      }

      function applyDisabledState() {
        monthElement.querySelectorAll('.wheel-item').forEach(el => {
          const m = parseInt(el.dataset.month, 10);
          if (m > currentMonth) el.classList.add('disabled');
          else el.classList.remove('disabled');
        });

        calendarElement.querySelectorAll('.wheel-item').forEach(el => {
          const isoDate = el.dataset.date || '';
          const isDisabled = isoDate > todayStr;
          el.classList.toggle('disabled', isDisabled);
        });
      }

      function normalizeActiveDayForMonth(selectedMonth) {
        const selectableDayLimit = getSelectableDayLimit(selectedMonth);
        if (selectableDayLimit < 1) return null;

        const activeDay = calendarElement.querySelector('.wheel-item.active');
        const activeDayNumber = parseInt(activeDay?.dataset.day || '', 10);
        const fallbackDay = Number.isInteger(activeDayNumber) ? activeDayNumber : currentDate;
        const nextDay = Math.min(Math.max(fallbackDay, 1), selectableDayLimit);
        const targetDate = `${currentYear}-${String(selectedMonth).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
        const nextDayItem = calendarElement.querySelector(`.wheel-item[data-date="${targetDate}"]`);

        if (!activeDay || activeDay.classList.contains('disabled') || activeDay.dataset.month !== String(selectedMonth) || activeDay !== nextDayItem) {
          calendarElement.querySelectorAll('.wheel-item').forEach(el => el.classList.remove('active'));
          nextDayItem?.classList.add('active');
          return nextDayItem || null;
        }

        return activeDay;
      }

      /* 휠 중앙 선택 및 동기화 로직 */
      function getActiveItem(scrollArea) {
        const boxCenter = scrollArea.getBoundingClientRect().left + scrollArea.offsetWidth / 2;
        let closest = null;
        let minDistance = Infinity;
        scrollArea.querySelectorAll('.wheel-item:not(.disabled)').forEach(el => {
          const elCenter = el.getBoundingClientRect().left + el.offsetWidth / 2;
          // scrollLeft가 완전히 반영되지 않은 상태일 수 있으므로 getBoundingClientRect 사용
          const distance = Math.abs(boxCenter - elCenter);
          if (distance < minDistance) {
            minDistance = distance;
            closest = el;
          }
        });
        return closest;
      }

      let programmaticWheelSelectionKey = null;
      let programmaticWheelSelectionAt = 0;
      const PROGRAMMATIC_WHEEL_GUARD_MS = 1400;

      function setActiveMonth(month) {
        const targetMonthItem = monthElement.querySelector(`.wheel-item[data-month="${month}"]`);
        if (!targetMonthItem || targetMonthItem.classList.contains('disabled')) return null;
        monthElement.querySelectorAll('.wheel-item').forEach(el => el.classList.remove('active'));
        targetMonthItem.classList.add('active');
        return targetMonthItem;
      }

      function scrollItemToCenter(container, item) {
        if (!container || !item) return;
        const scrollTarget = item.offsetLeft - container.offsetWidth / 2 + item.offsetWidth / 2;
        container.scrollTo({ left: scrollTarget, behavior: 'smooth' });
      }

      function getWheelSelectionKey() {
        const activeDay = calendarElement.querySelector('.wheel-item.active');
        return activeDay?.dataset.date || null;
      }

      function rememberProgrammaticWheelSelection() {
        programmaticWheelSelectionKey = getWheelSelectionKey();
        programmaticWheelSelectionAt = Date.now();
      }

      function shouldSkipProgrammaticWheelScrollEnd() {
        if (!programmaticWheelSelectionKey) return false;
        const isFresh = Date.now() - programmaticWheelSelectionAt <= PROGRAMMATIC_WHEEL_GUARD_MS;
        if (!isFresh) programmaticWheelSelectionKey = null;
        return isFresh && getWheelSelectionKey() === programmaticWheelSelectionKey;
      }

      function updateWheelSelection(forceInstant = false, source = 'day') {
        applyDisabledState();
        let activeMonth, activeDay;

        if (forceInstant) {
          // 클릭이나 스와이프로 명시적으로 누른 경우에는 이미 부여된 active 가져옴
          activeMonth = monthElement.querySelector('.wheel-item.active');
          activeDay = calendarElement.querySelector('.wheel-item.active');
        } else {
          // 순수 스크롤 작동 시에는 중앙에 있는 아이템을 찾아서 부여함
          activeMonth = getActiveItem(monthElement);
          activeDay = getActiveItem(calendarElement);

          if (activeMonth) {
            monthElement.querySelectorAll('.wheel-item').forEach(el => el.classList.remove('active'));
            activeMonth.classList.add('active');
          }
          if (activeDay) {
            calendarElement.querySelectorAll('.wheel-item').forEach(el => el.classList.remove('active'));
            activeDay.classList.add('active');
          }
        }

        if (activeMonth && activeDay) {
          let selectedMonth = parseInt(activeMonth.dataset.month, 10);
          if (source === 'day' && activeDay.dataset.month) {
            selectedMonth = parseInt(activeDay.dataset.month, 10);
            activeMonth = setActiveMonth(selectedMonth) || activeMonth;
          }

          activeDay = source === 'month' ? normalizeActiveDayForMonth(selectedMonth) : activeDay;
          if (!activeDay) return;

          const newDate = toLocalDateFromIso(activeDay.dataset.date || '');
          if (!newDate || activeDay.classList.contains('disabled')) return;
          const selectedIsoDate = formatLocalIsoDate(newDate);

          /* 이미 렌더링된 동일 날짜면 중복 렌더링 건너뜀 (복귀 시 이상한 애니메이션 발생 방지) */
          if (latestPathDate && latestPathDate.getTime() === newDate.getTime()) {
            return;
          }

          let storyForDate = allStories.find(s => s.publish_date === selectedIsoDate);
          const direction = newDate > latestPathDate ? 'next' : 'prev';
          latestPathDate = newDate;

          renderCardToArea(cardArea, storyForDate || null, newDate, direction, bookmarkedIds, allStories);
        }
      }

      let scrollTimeout;
      const onScrollEnd = (event) => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          if (shouldSkipProgrammaticWheelScrollEnd()) {
            return;
          }
          programmaticWheelSelectionKey = null;
          updateWheelSelection(false, event.currentTarget === monthElement ? 'month' : 'day');
        }, 150);
      };
      monthElement.addEventListener('scroll', onScrollEnd, { passive: true });
      calendarElement.addEventListener('scroll', onScrollEnd, { passive: true });

      const selectWheelItem = (container, item) => {
        if (item.classList.contains('disabled')) return;
        container.querySelectorAll('.wheel-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');

        const source = container === monthElement ? 'month' : 'day';
        if (source === 'month') {
          normalizeActiveDayForMonth(parseInt(item.dataset.month, 10));
        } else {
          setActiveMonth(parseInt(item.dataset.month, 10));
        }

        // 딜레이를 없애기 위해 클릭 시 즉시 카드 업데이트 (디바운스 우회)
        updateWheelSelection(true, source);
        rememberProgrammaticWheelSelection();

        scrollItemToCenter(container, item);
        if (source === 'day') {
          const activeMonth = monthElement.querySelector('.wheel-item.active');
          scrollItemToCenter(monthElement, activeMonth);
        } else {
          const activeDay = calendarElement.querySelector('.wheel-item.active');
          scrollItemToCenter(calendarElement, activeDay);
        }
      };

      const selectAdjacentDay = (offset) => {
        const dayItems = Array.from(calendarElement.querySelectorAll('.wheel-item'));
        const activeDayIdx = dayItems.findIndex(el => el.classList.contains('active'));
        const candidateDay = dayItems[activeDayIdx + offset];

        if (candidateDay && !candidateDay.classList.contains('disabled')) {
          selectWheelItem(calendarElement, candidateDay);
        }
      };

      calendarElement.addEventListener('daystory:select-adjacent-day', (event) => {
        selectAdjacentDay(event.detail?.offset || 0);
      });

      monthElement.querySelectorAll('.wheel-item').forEach(item => {
        item.addEventListener('click', () => selectWheelItem(monthElement, item));
      });
      calendarElement.querySelectorAll('.wheel-item').forEach(item => {
        item.addEventListener('click', () => selectWheelItem(calendarElement, item));
      });

      /* 초기 진입 시 오늘 날짜로 포커싱 맞추기 */
      setTimeout(() => {
        const targetMonthItem = monthElement.querySelector(`.wheel-item[data-month="${today.getMonth() + 1}"]`);
        const targetDayItem = calendarElement.querySelector(`.wheel-item[data-date="${todayStr}"]`);
        if (targetMonthItem) {
          monthElement.scrollLeft = targetMonthItem.offsetLeft - monthElement.offsetWidth / 2 + targetMonthItem.offsetWidth / 2;
          targetMonthItem.classList.add('active');
        }
        if (targetDayItem) {
          calendarElement.scrollLeft = targetDayItem.offsetLeft - calendarElement.offsetWidth / 2 + targetDayItem.offsetWidth / 2;
          targetDayItem.classList.add('active');
        }
        applyDisabledState();
      }, 0);
    }

    /* ---- 오늘의 카드 초기 렌더링 ---- */
    renderCardToArea(cardArea, todayStory, today, null, bookmarkedIds, allStories);

  } catch (err) {
    /* 데이터 로딩 실패 시 에러 화면 표시 */
    console.error('에디터 일화 데이터 로딩 실패:', err);
    page.innerHTML = `
      <div class="editorstory-header">
        <h1 class="editorstory-title">Day Story</h1>
      </div>
      <div class="empty-state">
        <div class="empty-state-title">데이터를 불러오지 못했습니다.</div>
        <div class="empty-state-desc" style="color:var(--danger-color);margin-bottom:var(--space-2)">
          ${escapeHtml(err.message || '알 수 없는 오류')}
        </div>
        <div class="empty-state-desc">네트워크를 확인하고 다시 시도해주세요</div>
        <button class="btn btn-primary" onclick="location.reload()" style="margin-top:var(--space-4)">
          새로고침
        </button>
      </div>
    `;
  }
}

/**
 * renderCardToArea — 주어진 스토리 데이터로 카드를 렌더링하고 애니메이션을 처리합니다
 * @param {HTMLElement} cardArea  - 카드가 위치할 컨테이너
 * @param {Object|null} story    - 카드에 담길 일화 데이터
 * @param {Date}        dateObj  - 표시할 날짜
 * @param {string|null} direction - 'next' (미래로), 'prev' (과거로) 또는 null (초기 로드)
 * @param {Array}       bookmarkedIds - 사용자가 북마크한 스토리 ID 배열
 */
function renderCardToArea(cardArea, story, dateObj, direction = null, bookmarkedIds = [], allStories = []) {
  if (!cardArea) return;

  /* 버그 수정: 카드 여러 장이 겹쳐서 남는 현상 방지 */
  /* 모든 카드를 찾은 뒤 가장 마지막(최신) 요소만 전환 대상으로 삼고 나머지는 삭제 */
  const allCards = Array.from(cardArea.querySelectorAll('.flip-container'));
  const oldCard = allCards.pop() || null;
  allCards.forEach(c => c.remove());

  /* 새 카드 HTML 생성 */
  const pubDate = story ? (toLocalDateFromIso(story.publish_date) || dateObj) : dateObj;
  const month = pubDate.getMonth() + 1;
  const day = pubDate.getDate();
  const displayYear = dateObj.getFullYear();

  const newCard = document.createElement('div');
  newCard.className = 'flip-container';
  newCard.id = `card-${Date.now()}`;

  if (!story) {
    /* 스토리가 없는 경우의 HTML 구조 (UI 고도화) */
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const formattedDate = `${monthNames[pubDate.getMonth()]} ${day}, ${displayYear}`;

    newCard.innerHTML = `
      <div class="flipper">
        <div class="front history-card-front empty-story-card">
          <div class="empty-story-day-circle">${day}</div>
          <div class="empty-story-title">아직 기록되지 않은 날입니다.</div>
          <div class="empty-story-date">${formattedDate}</div>
        </div>
      </div>
    `;
  } else {
    /* 기존 카드 HTML 구조 */
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
                <!-- 공유 버튼 -->
                <button class="card-action-btn" aria-label="공유">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                  </svg>
                </button>
                <!-- 북마크 버튼 -->
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
            <img src="${escapeHtml(story.image_url)}" alt="${escapeHtml(story.figure_name)}" loading="eager" fetchpriority="high" decoding="async" draggable="false" />
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
                ? `<img src="${escapeHtml(story.editor.photoURL)}" alt="editor" class="back-editor-avatar" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><span class="back-editor-avatar-fallback" style="display:none">✍️</span>`
                : '<span class="back-editor-avatar-fallback">✍️</span>'}
            </button>
            <div class="back-date-actions">
              <div class="back-date">${escapeHtml(story.historical_year)}년 ${month}월 ${day}일</div>
              <button class="card-detail-shortcut-btn" type="button" aria-label="${DETAIL_BUTTON_LABEL}" title="${DETAIL_BUTTON_LABEL}">${DETAIL_BUTTON_LABEL}</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* 3) 초기 로드 (애니메이션 없음) */
  if (!direction || !oldCard) {
    cardArea.innerHTML = '';
    cardArea.appendChild(newCard);
    bindCardEvents(newCard, story, bookmarkedIds);
    return;
  }

  /* 4) 카드 스택 전환 애니메이션 (Natural Stack) */

  /* 4-1. 기존 카드에 '나가는' 클래스 부여 */
  oldCard.classList.add('card-stack-item');
  oldCard.classList.add(`stack-exit-${direction}`);

  /* 4-2. 새 카드에 '들어오는' 클래스 부여 */
  newCard.classList.add('card-stack-item');
  newCard.classList.add(`stack-enter-${direction}`);

  cardArea.appendChild(newCard);

  /* 강제 리플로우 (브라우저가 애니메이션을 인지하게 함) */
  void newCard.offsetWidth;

  /* 4-3. 애니메이션 실행 */
  newCard.classList.add('active');

  /* 4-4. 애니메이션 종료 후 정리 */
  const onAnimationEnd = () => {
    if (oldCard.parentNode) oldCard.remove();
    newCard.classList.remove('card-stack-item', `stack-enter-${direction}`, 'active');

    /* 상호작용 활성화 */
    bindCardEvents(newCard, story, bookmarkedIds);
  };

  newCard.addEventListener('transitionend', onAnimationEnd, { once: true });
  /* 혹시 transitionend가 발생하지 않는 네트워크/성능 문제를 대비해 타임아웃 백업 */
  setTimeout(() => {
    if (newCard.classList.contains('card-stack-item')) onAnimationEnd();
  }, 400);
}


/**
 * bindCardEvents — 개별 카드 요소에 필기, 클릭, 스와이프 등 모든 이벤트를 연결합니다
 */
function bindCardEvents(flipContainer, story, bookmarkedIds) {
  const flipper = flipContainer.querySelector('.flipper');
  if (!flipper) return;

  const detailBtn = flipContainer.querySelector('.card-detail-shortcut-btn');

  /* 상단 액션 버튼 이벤트 */
  const shareBtn = flipContainer.querySelector('.card-action-btn[aria-label="공유"]');
  const bookmarkBtn = flipContainer.querySelector('.card-action-btn[aria-label="보관함"]');

  if (detailBtn && story) {
    detailBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
      navigate(`/detail/${story.id}`);
    });
  }

  if (shareBtn) {
    shareBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const user = getState('user');
      if (user && user.id === 'guest') {
        showToast('로그인이 필요한 기능입니다.', 'info');
        navigate('/login');
        return;
      }
      try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch (err) { }
      try {
        const shareUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
          ? `https://daystory.app/detail/${story.id}`
          : window.location.href;
        await Share.share({ title: story.figure_name, text: `[DayStory] ${story.figure_name}\n\n${story.summary || ''}`, url: shareUrl });
      } catch (err) { }
    });
  }

  if (bookmarkBtn) {
    bookmarkBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const user = getState('user');
      if (user && user.id === 'guest') {
        showToast('로그인이 필요한 기능입니다.', 'info');
        navigate('/login');
        return;
      }
      try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch (err) { }
      const res = await toggleBookmark(story.id);
      if (res.error) {
        showToast(res.error, 'error');
        return;
      }
      showToast(res.bookmarked ? '보관함에 추가했습니다' : '보관함에서 해제했습니다', 'success');
      bookmarkBtn.querySelector('svg').style.fill = res.bookmarked ? 'currentColor' : 'none';
      if (res.bookmarked && !bookmarkedIds.includes(story.id)) {
        bookmarkedIds.push(story.id);
      } else if (!res.bookmarked) {
        const idx = bookmarkedIds.indexOf(story.id);
        if (idx > -1) bookmarkedIds.splice(idx, 1);
      }
    });
  }

  let touchStartX = 0;
  let touchStartY = 0;
  let isSwiping = false;
  let swipeAxis = null;
  let isAnimating = false;
  let hapticTriggered = false;
  let lastTouchInputAt = 0;
  const SWIPE_THRESHOLD = 80;
  const SYNTHETIC_MOUSE_IGNORE_MS = 650;

  const commitAdjacentDay = (offset) => {
    if (Date.now() - lastSwipeCommitAt < SWIPE_COMMIT_GUARD_MS) return;
    lastSwipeCommitAt = Date.now();
    document.getElementById('editorstory-calendar')?.dispatchEvent(new CustomEvent('daystory:select-adjacent-day', {
      detail: { offset },
    }));
  };

  /* ── back-body 탭 vs 스크롤 구분용 변수 ── */
  let tapStartTime = 0;
  let tapStartX = 0;
  let tapStartY = 0;
  let isInteractiveTouch = false;
  let touchStartTarget = null;  // 터치 시작 시 대상 요소 저장

  const handleStart = (x, y, isBody = false) => {
    if (isAnimating || flipper.classList.contains('is-flipping')) return;
    
    touchStartX = x;
    touchStartY = y;
    isSwiping = false;
    swipeAxis = null;
    hapticTriggered = false;

    /* 탭 판별용 시작 시간·좌표 저장 */
    tapStartTime = Date.now();
    tapStartX = x;
    tapStartY = y;
  };

  const handleMove = async (x, y, isTouch = false) => {
    if (isAnimating) return;
    
    const diffX = x - touchStartX;
    const diffY = y - touchStartY;

    /* 이동 거리가 일정 수준 이상이면 탭이 아닌 스와이프로 간주하여 타겟 초기화 */
    if (Math.abs(diffX) > 15 || Math.abs(diffY) > 15) {
      touchStartTarget = null;
    }

    if (!swipeAxis) {
      if (Math.abs(diffX) < 15 && Math.abs(diffY) < 15) return; // 미세한 마우스/터치 떨림 무시
      swipeAxis = Math.abs(diffX) > Math.abs(diffY) ? 'x' : 'y';
    }

    const isFlipped = flipper.classList.contains('flipped');
    if (swipeAxis === 'y') return; // 위아래 스와이프 폐기

    if (!isSwiping) {
      flipper.style.transition = 'none';
      isSwiping = true;
    }

    const baseTransform = isFlipped ? 'rotateY(180deg)' : '';

    if (swipeAxis === 'x') {
      const moveX = diffX * 0.4;
      flipper.style.transform = `translateX(${moveX}px) ${baseTransform}`;
      if (Math.abs(diffX) > SWIPE_THRESHOLD && !hapticTriggered) {
        hapticTriggered = true;
        try { await Haptics.impact({ style: ImpactStyle.Light }); } catch (err) { }
      }
    }
  };

  const handleEnd = async (x, y) => {
    if (!isSwiping || isAnimating) return;
    
    isAnimating = true;

    const diffX = x - touchStartX;
    const diffY = y - touchStartY;

    flipper.style.transition = 'transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)'; // 빠른 튕김 복귀 애니메이션
    flipper.classList.add('is-flipping'); // 스와이프 복귀 중 터치 차단

    if (swipeAxis === 'y') {
      // 위아래 스와이프 폐기: 카드 복귀 처리
      flipper.style.transform = '';
      setTimeout(() => { flipper.style.transition = ''; flipper.classList.remove('is-flipping'); isSwiping = false; isAnimating = false; }, 250);
      return;
    }
    
    if (swipeAxis === 'x' && Math.abs(diffX) > SWIPE_THRESHOLD) {
      try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch (err) { }

      commitAdjacentDay(diffX < 0 ? 1 : -1);
    }
    // 제자리로 복귀
    flipper.style.transform = '';

    setTimeout(() => {
      flipper.style.transition = '';
      flipper.classList.remove('is-flipping');
      isSwiping = false;
      isAnimating = false;
    }, 250);
  };

  // 터치 이벤트
  flipper.addEventListener('touchstart', (e) => {
    lastTouchInputAt = Date.now();
    if (e.target.closest('.card-action-btn') || e.target.closest('.back-editor-btn') || e.target.closest('.card-detail-shortcut-btn')) {
      isInteractiveTouch = true;
      touchStartTarget = null;
      isSwiping = false;
      swipeAxis = null;
      return;
    }
    isInteractiveTouch = false;
    const isBody = !!e.target.closest('.back-body');
    touchStartTarget = e.target;   // 터치 대상 저장
    handleStart(e.touches[0].clientX, e.touches[0].clientY, isBody);
  }, { passive: true });

  flipper.addEventListener('touchmove', (e) => {
    if (isInteractiveTouch) return;
    handleMove(e.touches[0].clientX, e.touches[0].clientY, true);
    if (isSwiping) e.preventDefault();
  }, { passive: false });

  flipper.addEventListener('touchend', async (e) => {
    lastTouchInputAt = Date.now();
    if (isInteractiveTouch) {
      isInteractiveTouch = false;
      return;
    }
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;

    /* ── back-body 탭 감지: touchend에서 직접 뒤집기 실행 ──
       모바일에서 overflow-y:auto 요소는 click 이벤트가 발생하지 않는
       경우가 많으므로, touchend에서 짧은 탭을 직접 판별합니다. */
    if (touchStartTarget && touchStartTarget.closest('.back-body') && !isSwiping) {
      const tapDuration = Date.now() - tapStartTime;
      const tapDiffX = Math.abs(endX - tapStartX);
      const tapDiffY = Math.abs(endY - tapStartY);

      /* 임계값 완화: 400ms 이내 + 이동 20px 이하 → 탭으로 판정 */
      if (tapDuration <= 400 && tapDiffX <= 20 && tapDiffY <= 20) {
        if (!story) return;
        if (flipper.classList.contains('is-flipping')) return;

        /* 말풍선이 떠 있는 상태에서 바깥 탭은 말풍선만 닫고 플립은 건너뜀 */
        const openBubble = flipContainer.querySelector('.editor-comment-bubble');
        if (openBubble && !openBubble.contains(touchStartTarget)) {
          openBubble.remove();
          return;
        }

        flipper.classList.add('is-flipping');
        Haptics.selectionChanged().catch(() => {});
        flipper.classList.toggle('flipped');
        document.dispatchEvent(new CustomEvent('ds:card-flipped'));

        /* 뒤집기 후 에디터 한마디 넛지 */
        if (flipper.classList.contains('flipped')) {
          showEditorBadge(flipContainer);
        }

        /* CSS transition 0.4s와 동기화 */
        setTimeout(() => { flipper.classList.remove('is-flipping'); }, 400);

        return; 
      }
    }

    handleEnd(endX, endY);
  });

  // 마우스 이벤트 (데스크톱 드래그 대응, 윈도우 전역 리스너 중첩 방지)
  let isMouseDown = false;
  flipper.addEventListener('mousedown', (e) => {
    if (Date.now() - lastTouchInputAt < SYNTHETIC_MOUSE_IGNORE_MS) return;
    if (e.target.closest('.card-action-btn') || e.target.closest('.back-editor-btn') || e.target.closest('.card-detail-shortcut-btn')) return;
    const isBody = !!e.target.closest('.back-body');
    if (isBody) return; // 마우스는 본문에서 드래그 스와이프 불가
    isMouseDown = true;
    handleStart(e.clientX, e.clientY, isBody);
  });

  if (window._editorStoryMouseMove) window.removeEventListener('mousemove', window._editorStoryMouseMove);
  if (window._editorStoryMouseUp) window.removeEventListener('mouseup', window._editorStoryMouseUp);

  window._editorStoryMouseMove = (e) => {
    if (!isMouseDown) return;
    handleMove(e.clientX, e.clientY);
  };

  window._editorStoryMouseUp = (e) => {
    if (!isMouseDown) return;
    isMouseDown = false;
    handleEnd(e.clientX, e.clientY);
  };

  window.addEventListener('mousemove', window._editorStoryMouseMove);
  window.addEventListener('mouseup', window._editorStoryMouseUp);

  /* 다른 페이지로 이동하면 window 리스너를 정리해 메모리 누수 방지 */
  setOnUnmount(() => {
    if (window._editorStoryMouseMove) {
      window.removeEventListener('mousemove', window._editorStoryMouseMove);
      window._editorStoryMouseMove = null;
    }
    if (window._editorStoryMouseUp) {
      window.removeEventListener('mouseup', window._editorStoryMouseUp);
      window._editorStoryMouseUp = null;
    }
  });

  // 일반 클릭: 뒤집기
  flipper.addEventListener('click', async (e) => {
    if (!story) return;
    if (e.target.closest('.card-action-btn') || e.target.closest('.back-editor-btn') || e.target.closest('.card-detail-shortcut-btn')) return;
    if (e.pointerType === 'touch' && e.target.closest('.back-body')) return;
    if (isSwiping) return;
    if (flipper.classList.contains('is-flipping')) return;

    /* 말풍선이 떠 있는 상태에서 바깥 클릭은 말풍선만 닫고 플립은 건너뜀 */
    const openBubble = flipContainer.querySelector('.editor-comment-bubble');
    if (openBubble && !openBubble.contains(e.target)) {
      openBubble.remove();
      return;
    }

    flipper.classList.add('is-flipping');
    Haptics.selectionChanged().catch(() => {});
    flipper.classList.toggle('flipped');
    document.dispatchEvent(new CustomEvent('ds:card-flipped'));

    /* 뒤집기 후 에디터 한마디 넛지: 뒷면이 보일 때 버튼 강조 */
    if (flipper.classList.contains('flipped')) {
      showEditorBadge(flipContainer);
    }

    setTimeout(() => { flipper.classList.remove('is-flipping'); }, 400);
  });

  /* 에디터 한마디 버튼 클릭 → 코멘트 말풍선 표시 */
  const editorBtn = flipContainer.querySelector('.back-editor-btn');
  if (editorBtn) {
    let lastEditorTouchAt = 0;
    let editorBubbleTimer = null;
    let removeOutsideBubbleListeners = null;
    const removeEditorBubble = () => {
      const bubble = flipContainer.querySelector('.editor-comment-bubble');
      if (bubble) bubble.remove();
      if (editorBubbleTimer) clearTimeout(editorBubbleTimer);
      editorBubbleTimer = null;
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
      document.addEventListener('touchstart', handleOutsideBubbleInput, { passive: true });
      removeOutsideBubbleListeners = () => {
        document.removeEventListener('click', handleOutsideBubbleInput);
        document.removeEventListener('touchstart', handleOutsideBubbleInput);
      };
    };
    const showBubble = (e) => {
      if (e) {
        e.stopPropagation();
        if (e.type === 'touchend') {
          lastEditorTouchAt = Date.now();
          e.preventDefault();
        }
        if (e.type === 'click' && Date.now() - lastEditorTouchAt < 650) return;
      }
      
      dismissEditorBadge(editorBtn);
      const comment = editorBtn.dataset.comment;
      const editorName = editorBtn.dataset.editorName || 'DayStory';

      /* 이미 말풍선이 떠 있으면 다시 누른 것은 닫기 동작 (바깥 클릭과 동일) */
      const existing = flipContainer.querySelector('.editor-comment-bubble');
      if (existing) {
        removeEditorBubble();
        return;
      }
      
      /* 코멘트가 없는 경우 */
      if (!comment) return;
      
      const bubble = document.createElement('div');
      bubble.className = 'editor-comment-bubble';
      const nameEl = document.createElement('span');
      nameEl.className = 'editor-comment-name';
      nameEl.textContent = editorName;
      bubble.appendChild(nameEl);
      bubble.appendChild(document.createTextNode(comment));
      editorBtn.parentElement.appendChild(bubble);
      bindOutsideBubbleDismiss();
      editorBubbleTimer = setTimeout(() => {
        removeEditorBubble();
      }, 4000);
    };

    editorBtn.addEventListener('click', showBubble);
    editorBtn.addEventListener('touchend', (e) => {
      /* 카드 플리퍼가 스와이프 움직임 중이면 터치를 무시함 */
      if (isSwiping) return; 
      showBubble(e);
    });
  }
}
