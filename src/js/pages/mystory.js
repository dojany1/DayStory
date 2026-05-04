/* =====================================================================
   mystory.js — 나의 일화 (일반 사용자 전용)
   =====================================================================
   사용자가 자신의 이야기를 확인하고 추가/수정하는 페이지입니다.
   홈 화면의 일화 카드와 디자인 일관성을 유지하기 위해 원본 카드 뷰를 사용합니다.
   ===================================================================== */

import { navigate, getParams, setOnUnmount } from '../router.js';
import { getState } from '../state.js';
import { showToast } from '../components/toast.js';
import { showConfirm } from '../components/confirmDialog.js';
import { fetchMyStories, createMyStory, updateMyStory, fetchMyStoryById, deleteMyStory } from '../services/mystories.js';
import { syncDiaryStateFromList } from '../services/widget.js';
import { escapeHtml } from '../utils/sanitize.js';
import { formatLocalIsoDate, getDaysInMonth, getLocalToday, toLocalDateFromIso } from '../utils/date.js';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { auth, storage } from '../firebase.js';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';

const CARD_IMAGE_CROP_ASPECT_RATIO = 4 / 5;

/* 스와이프 commit 가드 — bindCardEvents가 카드 재렌더로 다시 호출되어
   closure 내부 변수가 0으로 초기화될 때 발생하던 "한 번 swipe로 두 칸 이동" 문제 방지. */
let lastSwipeCommitAt = 0;
const SWIPE_COMMIT_GUARD_MS = 1500;

function isEditableStoredImage(imageSrc) {
  return imageSrc.includes('firebasestorage.googleapis.com')
    || imageSrc.includes('.firebasestorage.app')
    || imageSrc.includes('storage.googleapis.com');
}

function getLocalDateInputValue(date = new Date()) {
  return formatLocalIsoDate(date);
}

/* ─────────────────────────────────────────────
   섹션 1: 나의 일화 목록 페이지 (싱글 카드 + 휠 피커)
   ───────────────────────────────────────────── */
export function renderMyStory() {
  const page = document.createElement('div');
  page.className = 'mystory-page page';

  page.innerHTML = `
    <!-- 휠 피커 스타일 날짜 선택기 -->
    <div class="wheel-pickers-container" style="margin-top: 10px;">
      <!-- 월 피커 -->
      <div class="wheel-picker-wrapper">
        <div class="wheel-selection-box"></div>
        <div class="modern-wheel-scroll" id="mystory-month-scroll"></div>
      </div>
      <!-- 일 피커 -->
      <div class="wheel-picker-wrapper">
        <div class="wheel-selection-box"></div>
        <div class="modern-wheel-scroll" id="mystory-calendar"></div>
      </div>
    </div>

    <!-- 카드 렌더링 영역 (editorstory.js와 동일한 구조) -->
    <div class="editorstory-card-area" id="mystory-card-area">
      <div style="display:flex;justify-content:center;padding:var(--space-8);width:100%;">
        <div class="loading-spinner"></div>
      </div>
    </div>
  `;

  loadMyStoryData(page);

  return page;
}

async function loadMyStoryData(page) {
  /* 새 페이지 진입 시 swipe commit 가드 리셋 — 이전 세션/테스트의 잔여 상태가 첫 swipe를 막지 않도록. */
  lastSwipeCommitAt = 0;
  try {
    const user = getState('user') || { id: 'guest' };
    // Firebase Auth의 실제 UID를 우선 사용 (Firestore 보안 규칙의 request.auth.uid와 일치해야 함)
    const uid = auth?.currentUser?.uid || user.id;
    const allStories = await fetchMyStories(uid);
    
    // 로컬 시간 기준 실제 오늘 날짜 (휠 피커의 미래 날짜 제한용)
    const params = getParams();
    const localTodayStr = getLocalToday();
    
    const realToday = toLocalDateFromIso(localTodayStr) || new Date();
    
    // URL 파라미터가 있으면 해당 날짜를 초기 렌더링 날짜로 사용
    const targetDateStr = params.date || localTodayStr;
    const targetDate = toLocalDateFromIso(targetDateStr) || realToday;
    
    let latestPathDate = targetDate;

    const monthElement = page.querySelector('#mystory-month-scroll');
    const calendarElement = page.querySelector('#mystory-calendar');
    const cardArea = page.querySelector('#mystory-card-area');

    if (monthElement) {
      let monthHtml = '';
      for (let m = 1; m <= 12; m++) monthHtml += `<div class="wheel-item" data-month="${m}">${m}</div>`;
      monthElement.innerHTML = monthHtml;
    }

    if (calendarElement) {
      const currentYear = realToday.getFullYear();
      const currentMonth = realToday.getMonth() + 1;
      const currentDate = realToday.getDate();
      const todayStr = formatLocalIsoDate(realToday);

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

      function getActiveItem(scrollArea) {
        const boxCenter = scrollArea.getBoundingClientRect().left + scrollArea.offsetWidth / 2;
        let closest = null;
        let minDistance = Infinity;
        scrollArea.querySelectorAll('.wheel-item:not(.disabled)').forEach(el => {
          const elCenter = el.getBoundingClientRect().left + el.offsetWidth / 2;
          const distance = Math.abs(boxCenter - elCenter);
          if (distance < minDistance) { minDistance = distance; closest = el; }
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
          activeMonth = monthElement.querySelector('.wheel-item.active');
          activeDay = calendarElement.querySelector('.wheel-item.active');
        } else {
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
          if (activeDay.classList.contains('disabled')) return;

          const selectedIsoDate = activeDay.dataset.date || '';
          const newDate = toLocalDateFromIso(selectedIsoDate);
          if (!newDate) return;

          if (latestPathDate && latestPathDate.getTime() === newDate.getTime()) return;

          const storyForDate = allStories.find(s => s.publish_date === selectedIsoDate);
          const direction = newDate > latestPathDate ? 'next' : 'prev';
          latestPathDate = newDate;

          renderCardToArea(cardArea, storyForDate || null, newDate, selectedIsoDate, direction, allStories);
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

      monthElement.querySelectorAll('.wheel-item').forEach(item => item.addEventListener('click', () => selectWheelItem(monthElement, item)));
      calendarElement.querySelectorAll('.wheel-item').forEach(item => item.addEventListener('click', () => selectWheelItem(calendarElement, item)));

      setTimeout(() => {
        const targetMonthItem = monthElement.querySelector(`.wheel-item[data-month="${targetDate.getMonth() + 1}"]`);
        const targetDayItem = calendarElement.querySelector(`.wheel-item[data-date="${formatLocalIsoDate(targetDate)}"]`);
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

    const initialStory = allStories.find(s => s.publish_date === targetDateStr);
    renderCardToArea(cardArea, initialStory || null, targetDate, targetDateStr, null, allStories);

  } catch (err) {
    console.error(err);
    page.innerHTML = `<div class="empty-state"><div class="empty-state-title">오류가 발생했습니다</div></div>`;
  }
}

function renderCardToArea(cardArea, story, dateObj, isoDateStr, direction = null, allStories) {
  if (!cardArea) return;

  const allCards = Array.from(cardArea.querySelectorAll('.flip-container'));
  const oldCard = allCards.pop() || null;
  allCards.forEach(c => c.remove());

  const month = dateObj.getMonth() + 1;
  const day = dateObj.getDate();
  const displayYear = dateObj.getFullYear();

  const newCard = document.createElement('div');
  newCard.className = 'flip-container';
  newCard.id = `card-${Date.now()}`;

  if (!story) {
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const formattedDate = `${monthNames[dateObj.getMonth()]} ${day}, ${displayYear}`;

    newCard.innerHTML = `
      <div class="flipper mystory-flipper">
        <div class="front history-card-front empty-story-card">
          <div class="empty-story-content">
            <div class="empty-story-day-circle">${day}</div>
            <div class="empty-story-title">이 날의 기록이 없습니다.</div>
            <div class="empty-story-date">${formattedDate}</div>
          </div>
          <button class="btn btn-secondary mystory-write-btn" data-date="${isoDateStr}">
            <svg class="mystory-write-icon" aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 20l5-1.5L19 8.5 15.5 5 5.5 15 4 20Z"></path>
              <path d="M14 6.5 17.5 10"></path>
              <path d="M5 18.5h4"></path>
            </svg>
            <span>나의 일화 쓰기</span>
          </button>
        </div>
      </div>
    `;
  } else {
    const [storyYearRaw, storyMonthRaw, storyDayRaw] = String(story.publish_date || isoDateStr).split('-');
    const storyYear = parseInt(storyYearRaw, 10) || displayYear;
    const storyMonth = parseInt(storyMonthRaw, 10) || month;
    const storyDay = parseInt(storyDayRaw, 10) || day;
    const PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='400' viewBox='0 0 300 400'%3E%3Crect fill='%23e0e0e0' width='300' height='400'/%3E%3Ctext x='50%25' y='45%25' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='40'%3E%F0%9F%93%B7%3C/text%3E%3C/svg%3E";
    const imageUrl = story.image_url || PLACEHOLDER_IMG;
    const bodyHtml = (story.body || '').split(/\n|\\n/).map(p => p.trim() ? `<p>${escapeHtml(p)}</p>` : '<p><br></p>').join('');

    newCard.innerHTML = `
      <div class="flipper mystory-flipper">
        <!-- 앞면 -->
        <div class="front history-card-front">
          <div class="history-card-top">
            <div class="card-top-left">
              <div class="card-year mystory-card-year">${storyYear}</div>
              <div class="card-date">${storyMonth}. ${storyDay}</div>
            </div>
            <div class="card-top-right">
              <div class="card-actions">
                <button class="card-action-btn edit-my-story-btn" data-id="${escapeHtml(story.id)}" aria-label="수정">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
                <button class="card-action-btn delete-my-story-btn" data-id="${escapeHtml(story.id)}" aria-label="삭제">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                </button>
              </div>
              <div class="card-meta">${escapeHtml(story.title)}</div>
            </div>
          </div>
          <div class="history-card-image-wrap">
            <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(story.title)}" onerror="this.style.display='none'" draggable="false" />
            <div class="card-image-title">${escapeHtml(story.title)}</div>
          </div>
        </div>
        <!-- 뒷면 -->
        <div class="back history-card-back">
          <div class="back-title">${escapeHtml(story.title)}</div>
          <hr class="back-divider" />
          <div class="back-body">${bodyHtml}</div>
          <div class="back-footer">
            <div class="back-date">${storyYear}년 ${storyMonth}월 ${storyDay}일</div>
          </div>
        </div>
      </div>
    `;
  }

  if (!direction || !oldCard) {
    cardArea.innerHTML = '';
    cardArea.appendChild(newCard);
    bindCardEvents(newCard, story, dateObj, allStories);
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
    bindCardEvents(newCard, story, dateObj, allStories);
  };
  newCard.addEventListener('transitionend', onAnimationEnd, { once: true });
  setTimeout(() => { if (newCard.classList.contains('card-stack-item')) onAnimationEnd(); }, 400);
}

function bindCardEvents(flipContainer, story, dateObj, allStories) {
  const flipper = flipContainer.querySelector('.flipper');
  if (!flipper) return;

  /* 상단 액션 버튼 이벤트 (mystory 전용) */
  const writeBtn = flipContainer.querySelector('.mystory-write-btn');
  const editBtn = flipContainer.querySelector('.edit-my-story-btn');
  const delBtn = flipContainer.querySelector('.delete-my-story-btn');

  const checkAuth = () => {
    const userObj = getState('user') || {};
    const uid = auth?.currentUser?.uid || userObj.id;
    if (!uid || uid === 'guest') {
      showToast('로그인이 필요한 서비스입니다.', 'error');
      location.hash = '#/login'; // 로그인 페이지로 이동
      return false;
    }
    return true;
  };

  if (writeBtn) {
    writeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!checkAuth()) return;
      navigate('/mystory/new?date=' + writeBtn.dataset.date);
    });
  }

  if (editBtn) {
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!checkAuth()) return;
      navigate('/mystory/new?edit=' + editBtn.dataset.id);
    });
  }

  if (delBtn) {
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!checkAuth()) return;
      const ok = await showConfirm({
        title: '일화 삭제',
        message: '정말 이 일화를 삭제하시겠습니까?\n삭제된 일화는 복구할 수 없습니다.',
        confirmText: '삭제',
        cancelText: '취소',
        danger: true,
      });
      if (!ok) return;
      await deleteMyStory(delBtn.dataset.id);
      showToast('일화가 삭제되었습니다.', 'success');
      const uid = auth?.currentUser?.uid || getState('user')?.id || 'guest';
      const freshStories = await fetchMyStories(uid);
      syncDiaryStateFromList(freshStories).catch(() => {});
      const isoDateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(dateObj.getDate()).padStart(2,'0')}`;
      renderCardToArea(document.querySelector('#mystory-card-area'), null, dateObj, isoDateStr, null, freshStories);
    });
  }

  /* ─────────────────────────────────────────────
     카드 뒤집기 및 스와이프 로직 (editorstory.js와 상동)
     ───────────────────────────────────────────── */
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
    document.getElementById('mystory-calendar')?.dispatchEvent(new CustomEvent('daystory:select-adjacent-day', {
      detail: { offset },
    }));
  };

  /* ── back-body 탭 vs 스크롤 구분용 변수 ── */
  let tapStartTime = 0;
  let tapStartX = 0;
  let tapStartY = 0;
  let touchStartTarget = null;

  const handleStart = (x, y, isBody = false) => {
    if (isAnimating || flipper.classList.contains('is-flipping')) return;
    
    touchStartX = x;
    touchStartY = y;
    isSwiping = false;
    swipeAxis = null;
    hapticTriggered = false;

    tapStartTime = Date.now();
    tapStartX = x;
    tapStartY = y;
  };

  const handleMove = async (x, y, isTouch = false) => {
    if (isAnimating) return;
    
    const diffX = x - touchStartX;
    const diffY = y - touchStartY;

    if (Math.abs(diffX) > 15 || Math.abs(diffY) > 15) {
      touchStartTarget = null;
    }

    if (!swipeAxis) {
      if (Math.abs(diffX) < 15 && Math.abs(diffY) < 15) return;
      swipeAxis = Math.abs(diffX) > Math.abs(diffY) ? 'x' : 'y';
    }

    if (swipeAxis === 'y') return;

    if (!isSwiping) {
      flipper.style.transition = 'none';
      isSwiping = true;
    }

    const isFlipped = flipper.classList.contains('flipped');
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
    flipper.style.transition = 'transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    flipper.classList.add('is-flipping');

    if (swipeAxis === 'x' && Math.abs(diffX) > SWIPE_THRESHOLD) {
      try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch (err) { }

      commitAdjacentDay(diffX < 0 ? 1 : -1);
    }
    flipper.style.transform = '';

    setTimeout(() => {
      flipper.style.transition = '';
      flipper.classList.remove('is-flipping');
      isSwiping = false;
      isAnimating = false;
    }, 250);
  };

  flipper.addEventListener('touchstart', (e) => {
    lastTouchInputAt = Date.now();
    const isBody = !!e.target.closest('.back-body');
    touchStartTarget = e.target;
    handleStart(e.touches[0].clientX, e.touches[0].clientY, isBody);
  }, { passive: true });

  flipper.addEventListener('touchmove', (e) => {
    handleMove(e.touches[0].clientX, e.touches[0].clientY, true);
    if (isSwiping) e.preventDefault();
  }, { passive: false });

  flipper.addEventListener('touchend', async (e) => {
    lastTouchInputAt = Date.now();
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;

    if (touchStartTarget && touchStartTarget.closest('.back-body') && !isSwiping) {
      const tapDuration = Date.now() - tapStartTime;
      const tapDiffX = Math.abs(endX - tapStartX);
      const tapDiffY = Math.abs(endY - tapStartY);

      if (tapDuration <= 400 && tapDiffX <= 20 && tapDiffY <= 20) {
        if (!story) return;
        if (flipper.classList.contains('is-flipping')) return;

        flipper.classList.add('is-flipping');
        Haptics.selectionChanged().catch(() => {});
        flipper.classList.toggle('flipped');
        setTimeout(() => { flipper.classList.remove('is-flipping'); }, 400);
        return; 
      }
    }
    handleEnd(endX, endY);
  });

  let isMouseDown = false;
  flipper.addEventListener('mousedown', (e) => {
    if (Date.now() - lastTouchInputAt < SYNTHETIC_MOUSE_IGNORE_MS) return;
    if (e.target.closest('button')) return;
    const isBody = !!e.target.closest('.back-body');
    if (isBody) return;
    isMouseDown = true;
    handleStart(e.clientX, e.clientY, isBody);
  });

  if (window._myStoryMouseMove) window.removeEventListener('mousemove', window._myStoryMouseMove);
  if (window._myStoryMouseUp) window.removeEventListener('mouseup', window._myStoryMouseUp);

  window._myStoryMouseMove = (e) => {
    if (!isMouseDown) return;
    handleMove(e.clientX, e.clientY);
  };

  window._myStoryMouseUp = (e) => {
    if (!isMouseDown) return;
    isMouseDown = false;
    handleEnd(e.clientX, e.clientY);
  };

  window.addEventListener('mousemove', window._myStoryMouseMove);
  window.addEventListener('mouseup', window._myStoryMouseUp);

  /* 다른 페이지로 이동하면 window 리스너를 정리해 메모리 누수 방지 */
  setOnUnmount(() => {
    if (window._myStoryMouseMove) {
      window.removeEventListener('mousemove', window._myStoryMouseMove);
      window._myStoryMouseMove = null;
    }
    if (window._myStoryMouseUp) {
      window.removeEventListener('mouseup', window._myStoryMouseUp);
      window._myStoryMouseUp = null;
    }
  });

  flipper.addEventListener('click', async (e) => {
    /* 기본 체크: 일화가 없거나, 버튼을 클릭했거나, 스와이프 중이면 무시 */
    if (!story) return;
    if (e.target.closest('button')) return;
    if (isSwiping) return;

    /* back-body 영역: 터치 기반 탭은 touchend에서 이미 처리했으므로, 
       터치 입력(pointerType === 'touch')인 경우만 click 핸들러에서 차단합니다. 
       마우스 클릭은 여기서 정상 처리됩니다. */
    if (e.pointerType === 'touch' && e.target.closest('.back-body')) return;
    
    if (flipper.classList.contains('is-flipping')) return;
    flipper.classList.add('is-flipping');
    
    Haptics.selectionChanged().catch(() => {});
    flipper.classList.toggle('flipped');
    
    setTimeout(() => {
      flipper.classList.remove('is-flipping');
    }, 400);
  });
}

/* ─────────────────────────────────────────────
   섹션 2: 나의 일화 폼 (렌더링 & 제출)
   ───────────────────────────────────────────── */
export function renderMyStoryNew() {
  const page = document.createElement('div');
  page.className = 'mystory-new-page page';

  /* ---- 로그인/비회원 체크 ---- */
  const userObj = getState('user') || {};
  const uid = auth?.currentUser?.uid || userObj.id;
  if (!uid || uid === 'guest') {
    page.innerHTML = `
      <div class="page-header page-header-centered">
        <h1 class="page-header-title">권한 없음</h1>
      </div>
      <div class="empty-state" style="padding-top: 100px;">
        <div class="empty-state-title">로그인이 필요합니다</div>
        <div class="empty-state-desc">나의 일화를 작성하려면 로그인해주세요.</div>
        <button class="btn btn-primary" style="margin-top: 16px;" id="ms-no-auth-back">뒤로 가기</button>
      </div>
    `;
    setTimeout(() => {
      document.getElementById('ms-no-auth-back')?.addEventListener('click', () => history.back());
    }, 0);
    return page;
  }

  const user = userObj;
  const params = getParams();
  let editingId = params.edit || null;
  let defaultDate = params.date || getLocalDateInputValue();

  page.innerHTML = `
    <div class="page-header page-header-with-back">
      <button class="page-header-back" id="mystory-form-back">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <h1 class="page-header-title">${editingId ? '나의 일화 수정' : '나의 일화 쓰기'}</h1>
      <span class="page-header-spacer" aria-hidden="true"></span>
    </div>

    <div class="editor-form-section section" style="padding-bottom: 6rem;">
      <form id="mystory-form" class="story-form">
        <!-- 1. 이미지 -->
        <div class="input-group">
          <label class="input-label">이미지</label>
          <input type="hidden" id="ms-image" />
          <div id="ms-image-preview" style="display:none; margin-bottom:var(--space-2); border-radius:var(--radius-md); overflow:hidden; position:relative; background:var(--color-bg-secondary);">
            <img id="ms-image-thumb" style="width:100%; max-height:200px; object-fit:cover; display:block;" alt="미리보기" />
            <button type="button" id="ms-image-remove-btn" style="position:absolute; top:6px; right:6px; width:28px; height:28px; border-radius:50%; background:rgba(0,0,0,0.55); color:#fff; border:none; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:14px;" aria-label="이미지 제거">✕</button>
          </div>
          <div style="display:flex; gap:var(--space-2); align-items:center;">
            <button type="button" id="ms-image-edit-btn" class="btn btn-secondary" style="margin:0; padding:var(--space-2) var(--space-3); font-size:var(--text-sm); white-space:nowrap;">사진 추가</button>
            <input type="file" id="ms-image-file" accept="image/*" style="display:none;" />
          </div>
          <div id="ms-image-status" style="font-size:var(--text-xs); color:var(--color-primary); margin-top:var(--space-1); display:none;">사진을 업로드하는 중입니다... ⏳</div>
        </div>
        <!-- 2. 단일 제목 -->
        <div class="input-group">
          <label class="input-label">제목 *</label>
          <input class="input-field" id="ms-title" placeholder="일화 제목을 입력하세요" required />
        </div>
        <!-- 3. 날짜 -->
        <div class="input-group">
          <label class="input-label">날짜 *</label>
          <input class="input-field" type="date" id="ms-date" required />
        </div>
        <!-- 4. 본문 -->
        <div class="input-group">
          <label class="input-label">본문 *</label>
          <textarea class="input-field" id="ms-body" placeholder="본문을 입력하세요..." style="min-height:250px; resize:vertical; line-height:1.6; font-family:var(--font-body);" required></textarea>
        </div>
        <div style="margin-top:var(--space-6);">
          <button type="submit" class="btn btn-primary btn-full" style="font-size:var(--text-md); padding:var(--space-4);">저장하기</button>
        </div>
      </form>
    </div>
  `;

  setTimeout(async () => {
    document.getElementById('mystory-form-back')?.addEventListener('click', () => history.back());
    let dateInput = document.getElementById('ms-date');
    if (dateInput) dateInput.value = defaultDate;

    let allStories = [];
    try {
      allStories = await fetchMyStories(uid);
    } catch(e) {}

    dateInput?.addEventListener('change', (e) => {
      const selected = e.target.value;
      if (selected) {
        const conflict = allStories.find(s => s.publish_date === selected && String(s.id) !== String(editingId));
        if (conflict) {
          showToast('이미 등록된 일화가 있는 날짜입니다.', 'error');
          e.target.value = '';
        }
      }
    });

    /* 이미지 미리보기 및 편집 버튼 상태 관리 */
    let lastUploadedBlobUrl = null; /* 편집 시 재사용할 blob URL */

    function updateImageUI() {
      const url = document.getElementById('ms-image')?.value.trim();
      const preview = document.getElementById('ms-image-preview');
      const thumb = document.getElementById('ms-image-thumb');
      const editBtn = document.getElementById('ms-image-edit-btn');
      if (url) {
        if (preview) { preview.style.display = 'block'; }
        if (thumb) { thumb.src = url; }
        if (editBtn) {
          editBtn.style.display = 'inline-block';
          editBtn.textContent = '사진 편집';
        }
      } else {
        if (preview) { preview.style.display = 'none'; }
        if (editBtn) {
          editBtn.style.display = 'inline-block';
          editBtn.textContent = '사진 추가';
        }
      }
    }

    /* 이미지 제거 버튼 */
    document.getElementById('ms-image-remove-btn')?.addEventListener('click', () => {
      const imgField = document.getElementById('ms-image');
      if (imgField) imgField.value = '';
      if (lastUploadedBlobUrl) { URL.revokeObjectURL(lastUploadedBlobUrl); lastUploadedBlobUrl = null; }
      updateImageUI();
    });

    if (editingId) {
      const story = await fetchMyStoryById(editingId, user.id);
      if (story) {
        document.getElementById('ms-title').value = story.title || '';
        document.getElementById('ms-date').value = story.publish_date || defaultDate;
        document.getElementById('ms-body').value = story.body || '';
        document.getElementById('ms-image').value = story.image_url || '';
      }
    }
    updateImageUI();

    async function openCropModal(imageSrc, isCrossOrigin = false, callbackBlobFile) {
      let localSrc = imageSrc;
      if (isCrossOrigin) {
        if (!isEditableStoredImage(imageSrc)) {
          showToast('외부 이미지는 편집할 수 없습니다.\n[사진 추가]로 새 이미지를 업로드해주세요.', 'error');
          return;
        }
        try {
          const res = await fetch(imageSrc);
          if (!res.ok) throw new Error('이미지 다운로드 실패');
          const blob = await res.blob();
          localSrc = URL.createObjectURL(blob);
        } catch (err) {
          console.error('이미지 fetch 실패:', err);
          showToast('이미지를 불러올 수 없습니다. 다시 시도해주세요.', 'error');
          return;
        }
      }

      const overlay = document.createElement('div');
      overlay.className = 'crop-modal-overlay';
      
      overlay.innerHTML = `
        <div class="crop-modal-header">
          <button type="button" class="btn-crop-cancel" id="btn-crop-cancel" aria-label="취소">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <span class="crop-modal-title">자르기 및 회전</span>
        </div>
        <div class="crop-modal-body">
          <img id="cropper-image" src="${localSrc}" style="max-width: 100%; display: block;" />
        </div>
        <div class="crop-modal-footer">
          <button type="button" class="btn-rotate" id="btn-crop-rotate">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12a9 9 0 1 1-3-6.7"/>
              <path d="M21 3v5h-5"/>
            </svg>
            회전
          </button>
          <button type="button" class="btn-crop-confirm" id="btn-crop-confirm">다음</button>
        </div>
      `;
      const wrapper = document.querySelector('.mobile-wrapper') || document.body;
      wrapper.appendChild(overlay);

      setTimeout(() => overlay.style.opacity = '1', 10);

      const image = overlay.querySelector('#cropper-image');
      let cropper;

      image.onload = () => {
        cropper = new Cropper(image, {
          aspectRatio: CARD_IMAGE_CROP_ASPECT_RATIO, 
          viewMode: 1,
          dragMode: 'move',
          autoCropArea: 0.9,
          restore: false,
          guides: true,
          center: true,
          highlight: false,
          cropBoxMovable: true,
          cropBoxResizable: true,
          toggleDragModeOnDblclick: false,
        });
      };

      image.onerror = () => {
        showToast('이미지를 불러올 수 없어 편집이 제한됩니다.', 'error');
        if (isCrossOrigin && localSrc.startsWith('blob:')) URL.revokeObjectURL(localSrc);
        overlay.remove();
      };

      overlay.querySelector('#btn-crop-cancel').addEventListener('click', () => {
        overlay.style.opacity = '0';
        setTimeout(() => {
          if (cropper) cropper.destroy();
          if (isCrossOrigin && localSrc.startsWith('blob:')) URL.revokeObjectURL(localSrc);
          overlay.remove();
        }, 300);
      });

      overlay.querySelector('#btn-crop-rotate').addEventListener('click', () => {
        if(cropper) cropper.rotate(90);
      });

      overlay.querySelector('#btn-crop-confirm').addEventListener('click', () => {
        const btn = overlay.querySelector('#btn-crop-confirm');
        btn.textContent = '처리 중...';
        btn.disabled = true;

        if(!cropper) return;

        cropper.getCroppedCanvas({
          maxWidth: 1200,
          maxHeight: 1500,
          imageSmoothingEnabled: true,
          imageSmoothingQuality: 'high',
        }).toBlob(async (blob) => {
          if (!blob) {
            showToast('크롭 오류가 발생했습니다.', 'error');
            btn.textContent = '다음';
            btn.disabled = false;
            return;
          }
          
          overlay.style.opacity = '0';
          setTimeout(() => {
            cropper.destroy();
            if (isCrossOrigin && localSrc.startsWith('blob:')) URL.revokeObjectURL(localSrc);
            overlay.remove();
          }, 300);

          callbackBlobFile(blob);
        }, 'image/jpeg', 0.85);
      });
    }

    async function processUploadBlob(blob, fallbackName) {
      const STATUS_EL = document.getElementById('ms-image-status');
      const IMAGE_FIELD = document.getElementById('ms-image');
      try {
        STATUS_EL.style.display = 'block';
        STATUS_EL.style.color = 'var(--color-primary)';
        STATUS_EL.textContent = '사진을 업로드하는 중입니다... ⏳';

        const options = {
          maxSizeMB: 0.3,
          maxWidthOrHeight: 1080,
          useWebWorker: true,
          initialQuality: 0.85
        };
        const compressedFile = await imageCompression(new File([blob], fallbackName, { type: 'image/jpeg' }), options);

        const uploadUid = uid || 'guest';
        const fileRef = ref(storage, `users/${uploadUid}/diary/${Date.now()}.jpg`);
        await uploadBytes(fileRef, compressedFile);
        const downloadUrl = await getDownloadURL(fileRef);

        IMAGE_FIELD.value = downloadUrl;
        /* 편집 재사용을 위해 blob URL 저장 */
        if (lastUploadedBlobUrl) URL.revokeObjectURL(lastUploadedBlobUrl);
        lastUploadedBlobUrl = URL.createObjectURL(blob);
        STATUS_EL.textContent = '업로드 완료! ✅';
        STATUS_EL.style.color = 'var(--color-info)';
        updateImageUI();
      } catch (error) {
        console.error('이미지 업로드 오류:', error);
        STATUS_EL.style.color = 'var(--color-error)';
        STATUS_EL.textContent = '이미지 저장에 실패했습니다.';
        showToast('이미지 저장에 실패했습니다.', 'error');
      } finally {
        const fileInput = document.getElementById('ms-image-file');
        if(fileInput) fileInput.value = '';
        setTimeout(() => {
          if (STATUS_EL && STATUS_EL.textContent.includes('완료')) {
            STATUS_EL.style.display = 'none';
          }
        }, 3000);
      }
    }

    // 사진 추가 버튼 로직 (크롭)
    document.getElementById('ms-image-file')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      /* 사전 검증: 이미지 파일이 아니거나 너무 큰 파일은 업로드 자체를 차단 */
      const MAX_SIZE_MB = 10;
      const fileInputEl = document.getElementById('ms-image-file');
      if (!file.type || !file.type.startsWith('image/')) {
        showToast('이미지 파일만 업로드할 수 있습니다.', 'error');
        if (fileInputEl) fileInputEl.value = '';
        return;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        showToast(`사진은 ${MAX_SIZE_MB}MB 이하만 업로드할 수 있습니다.`, 'error');
        if (fileInputEl) fileInputEl.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        openCropModal(event.target.result, false, (blob) => {
          processUploadBlob(blob, file.name || 'cropped_image.jpeg');
        });
      };
      reader.readAsDataURL(file);
    });

    document.getElementById('ms-image-edit-btn')?.addEventListener('click', async () => {
      const url = document.getElementById('ms-image')?.value.trim();
      if (!url) {
        document.getElementById('ms-image-file')?.click();
        return;
      }
      /* 방금 업로드한 blob URL이 있으면 cross-origin 없이 바로 사용 */
      if (lastUploadedBlobUrl) {
        openCropModal(lastUploadedBlobUrl, false, (blob) => {
          processUploadBlob(blob, 'edited_image.jpeg');
        });
      } else {
        openCropModal(url, true, (blob) => {
          processUploadBlob(blob, 'edited_image.jpeg');
        });
      }
    });

    document.getElementById('mystory-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();

      /* 이미지 업로드 중이면 저장 차단 */
      const statusEl = document.getElementById('ms-image-status');
      if (statusEl && statusEl.style.display !== 'none' && statusEl.textContent.includes('업로드')) {
        showToast('사진 업로드가 완료될 때까지 기다려주세요', 'warning');
        return;
      }

      const data = {
        uid: uid,
        title: document.getElementById('ms-title').value.trim(),
        publish_date: document.getElementById('ms-date').value,
        body: document.getElementById('ms-body').value.trim(),
        image_url: document.getElementById('ms-image').value.trim()
      };

      if (!data.title || !data.body || !data.publish_date) return showToast('필수 항목을 모두 입력해주세요', 'warning');

      try {
        if (editingId) {
          await updateMyStory(editingId, data);
          showToast('일화가 수정되었습니다', 'success');
        } else {
          await createMyStory(data);
          showToast('새 일화가 작성되었습니다', 'success');
        }
        try {
          const fresh = await fetchMyStories(uid);
          syncDiaryStateFromList(fresh).catch(() => {});
        } catch (_) { /* 위젯 동기화 실패는 사용자 흐름을 막지 않음 */ }
        navigate('/mystory', { date: data.publish_date });
      } catch (err) {
        showToast('저장 중 오류 발생', 'error');
      }
    });

  }, 0);

  return page;
}
