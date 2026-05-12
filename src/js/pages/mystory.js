/* =====================================================================
   mystory.js — 나의 일화 (일반 사용자 전용)
   =====================================================================
   사용자가 자신의 이야기를 확인하고 추가/수정하는 페이지입니다.
   홈 화면의 일화 카드와 디자인 일관성을 유지하기 위해 원본 카드 뷰를 사용합니다.
   ===================================================================== */

import { navigate, getParams } from '../router.js';
import { getState } from '../state.js';
import { showToast } from '../components/toast.js';
import { showConfirm } from '../components/confirmDialog.js';
import { fetchMyStories, createMyStory, updateMyStory, fetchMyStoryById, deleteMyStory } from '../services/mystories.js';
import { escapeHtml } from '../utils/sanitize.js';
import { auth } from '../firebase.js';
import { shareStory } from '../services/sharing.js';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import { syncDiaryStateFromList } from '../services/widget.js';
import { CARD_PLACEHOLDER_IMAGE, getStoryImageSources, preloadStoryImages } from '../utils/imageLoading.js';
import { bindImageVariantFields } from '../utils/imageFields.js';
import { uploadCardImageVariants } from '../services/images.js';
import { lockScroll, unlockScroll } from '../utils/scrollLock.js';

const CARD_IMAGE_CROP_ASPECT_RATIO = 4 / 5;

/* 스와이프 commit 가드 — bindCardEvents 가 카드 재렌더로 다시 호출돼도
   짧은 시간 내 두 번째 commit이 발생하지 않도록 모듈 스코프에 둔다 (세션 1 #2). */
let lastSwipeCommitAt = 0;
const SWIPE_COMMIT_GUARD_MS = 1500;
const CARD_STACK_SETTLE_MS = 560;

/* ─────────────────────────────────────────────
   섹션 1: 나의 일화 목록 페이지 (싱글 카드 + 휠 피커)
   ───────────────────────────────────────────── */
export function renderMyStory() {
  const page = document.createElement('div');
  page.className = 'mystory-page page';

  page.innerHTML = `
    <!-- 휠 피커 스타일 날짜 선택기 -->
    <div class="wheel-pickers-container">
      <div class="wheel-year-label" id="mystory-year-label"></div>
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
  /* 새 페이지 진입 시 swipe commit 가드 리셋 (세션 1 #2). */
  lastSwipeCommitAt = 0;
  try {
    const user = getState('user') || { id: 'guest' };
    // Firebase Auth의 실제 UID를 우선 사용 (Firestore 보안 규칙의 request.auth.uid와 일치해야 함)
    const uid = auth?.currentUser?.uid || user.id;
    const allStories = await fetchMyStories(uid);
    void syncDiaryStateFromList(allStories);
    preloadStoryImages(allStories, { limit: 5, variant: 'thumb', fallback: false });
    
    // 로컬 시간 기준 실제 오늘 날짜 (휠 피커의 미래 날짜 제한용)
    const params = getParams();
    const now = new Date();
    const localTodayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    
    const [rtY, rtM, rtD] = localTodayStr.split('-');
    const realToday = new Date(parseInt(rtY), parseInt(rtM)-1, parseInt(rtD));
    
    // URL 파라미터가 있으면 해당 날짜를 초기 렌더링 날짜로 사용
    const targetDateStr = params.date || localTodayStr;
    const [tY, tM, tD] = targetDateStr.split('-');
    const targetDate = new Date(parseInt(tY), parseInt(tM)-1, parseInt(tD));
    
    let latestPathDate = targetDate;

    const monthElement = page.querySelector('#mystory-month-scroll');
    const calendarElement = page.querySelector('#mystory-calendar');
    const cardArea = page.querySelector('#mystory-card-area');

    const currentYear = realToday.getFullYear();
    const currentMonth = realToday.getMonth() + 1;
    const currentDate = realToday.getDate();

    /* 연도 라벨 */
    const yearLabel = page.querySelector('#mystory-year-label');
    if (yearLabel) yearLabel.textContent = currentYear;

    /* 월 휠: 1~12, currentMonth 초과는 disabled */
    if (monthElement) {
      monthElement.innerHTML = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const cls = m > currentMonth ? ' disabled' : '';
        return `<div class="wheel-item${cls}" data-month="${m}">${m}</div>`;
      }).join('');
    }

    /* 일 휠: 1월 1일 ~ 오늘까지 평면 리스트 */
    if (calendarElement) {
      const items = [];
      for (let m = 1; m <= currentMonth; m++) {
        const lastDay = m === currentMonth ? currentDate : new Date(currentYear, m, 0).getDate();
        for (let d = 1; d <= lastDay; d++) {
          const mm = String(m).padStart(2, '0');
          const dd = String(d).padStart(2, '0');
          items.push(`<div class="wheel-item" data-date="${currentYear}-${mm}-${dd}" data-month="${m}" data-day="${d}">${d}</div>`);
        }
      }
      calendarElement.innerHTML = items.join('');
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

    function syncMonthWheel(dayMonth) {
      const activeMonthEl = monthElement.querySelector('.wheel-item.active');
      if (activeMonthEl && parseInt(activeMonthEl.dataset.month, 10) === dayMonth) return;
      const targetMonthEl = monthElement.querySelector(`.wheel-item[data-month="${dayMonth}"]`);
      if (!targetMonthEl) return;
      monthElement.querySelectorAll('.wheel-item').forEach(el => el.classList.remove('active'));
      targetMonthEl.classList.add('active');
      const t = targetMonthEl.offsetLeft - monthElement.offsetWidth / 2 + targetMonthEl.offsetWidth / 2;
      monthElement.scrollTo({ left: t, behavior: 'smooth' });
    }

    function updateWheelSelection(forceInstant = false) {
      let centerDay;
      if (forceInstant) {
        centerDay = calendarElement.querySelector('.wheel-item.active');
      } else {
        centerDay = getActiveItem(calendarElement);
        if (centerDay) {
          calendarElement.querySelectorAll('.wheel-item').forEach(el => el.classList.remove('active'));
          centerDay.classList.add('active');
        }
      }
      if (!centerDay) return;

      syncMonthWheel(parseInt(centerDay.dataset.month, 10));

      const isoDate = centerDay.dataset.date;
      const newDate = new Date(currentYear, parseInt(centerDay.dataset.month, 10) - 1, parseInt(centerDay.dataset.day, 10));
      if (latestPathDate && latestPathDate.getTime() === newDate.getTime()) return;

      const storyForDate = allStories.find(s => s.publish_date === isoDate);
      const direction = newDate > latestPathDate ? 'next' : 'prev';
      latestPathDate = newDate;
      renderCardToArea(cardArea, storyForDate || null, newDate, isoDate, direction, allStories);
    }

    /* 일 휠 스크롤 디바운스 */
    let scrollTimeout;
    const onDayScrollEnd = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => updateWheelSelection(false), 150);
    };
    calendarElement.addEventListener('scroll', onDayScrollEnd, { passive: true });

    /* 월 휠 스크롤 디바운스 — 중앙 월로 일 휠을 점프 */
    let monthScrollTimeout;
    const onMonthScrollEnd = () => {
      clearTimeout(monthScrollTimeout);
      monthScrollTimeout = setTimeout(() => {
        const centerMonth = getActiveItem(monthElement);
        if (!centerMonth || centerMonth.classList.contains('disabled')) return;
        const activeDay = calendarElement.querySelector('.wheel-item.active');
        const activeDayMonth = activeDay ? parseInt(activeDay.dataset.month, 10) : -1;
        if (parseInt(centerMonth.dataset.month, 10) !== activeDayMonth) {
          onMonthClick(centerMonth);
        } else {
          monthElement.querySelectorAll('.wheel-item').forEach(el => el.classList.remove('active'));
          centerMonth.classList.add('active');
        }
      }, 150);
    };
    monthElement.addEventListener('scroll', onMonthScrollEnd, { passive: true });

    /* 월 휠 클릭: 해당 월의 첫날(또는 오늘)로 일 휠 점프 */
    const onMonthClick = (item) => {
      if (item.classList.contains('disabled')) return;
      const m = parseInt(item.dataset.month, 10);
      const dd = m === currentMonth ? String(currentDate).padStart(2, '0') : '01';
      const targetDateStr2 = `${currentYear}-${String(m).padStart(2, '0')}-${dd}`;
      const targetDayEl = calendarElement.querySelector(`.wheel-item[data-date="${targetDateStr2}"]`);
      if (!targetDayEl) return;
      calendarElement.querySelectorAll('.wheel-item').forEach(el => el.classList.remove('active'));
      targetDayEl.classList.add('active');
      monthElement.querySelectorAll('.wheel-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      clearTimeout(scrollTimeout);
      const dayScroll = targetDayEl.offsetLeft - calendarElement.offsetWidth / 2 + targetDayEl.offsetWidth / 2;
      calendarElement.scrollTo({ left: dayScroll, behavior: 'smooth' });
      const monthScroll = item.offsetLeft - monthElement.offsetWidth / 2 + item.offsetWidth / 2;
      monthElement.scrollTo({ left: monthScroll, behavior: 'smooth' });
      updateWheelSelection(true);
    };

    /* 일 휠 클릭 */
    const onDayClick = (item) => {
      calendarElement.querySelectorAll('.wheel-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      clearTimeout(scrollTimeout);
      updateWheelSelection(true);
      const t = item.offsetLeft - calendarElement.offsetWidth / 2 + item.offsetWidth / 2;
      calendarElement.scrollTo({ left: t, behavior: 'smooth' });
    };

    monthElement.querySelectorAll('.wheel-item').forEach(item =>
      item.addEventListener('click', () => onMonthClick(item))
    );
    calendarElement.querySelectorAll('.wheel-item').forEach(item =>
      item.addEventListener('click', () => onDayClick(item))
    );

    /* 초기 위치: targetDate (URL 파라미터 또는 오늘) */
    setTimeout(() => {
      const initStr = targetDateStr;
      const initDayEl = calendarElement.querySelector(`.wheel-item[data-date="${initStr}"]`);
      const initMonth = targetDate.getMonth() + 1;
      const initMonthEl = monthElement.querySelector(`.wheel-item[data-month="${initMonth}"]`);
      if (initDayEl) {
        calendarElement.scrollLeft = initDayEl.offsetLeft - calendarElement.offsetWidth / 2 + initDayEl.offsetWidth / 2;
        initDayEl.classList.add('active');
      }
      if (initMonthEl) {
        monthElement.scrollLeft = initMonthEl.offsetLeft - monthElement.offsetWidth / 2 + initMonthEl.offsetWidth / 2;
        initMonthEl.classList.add('active');
      }
    }, 0);

    const initialStory = allStories.find(s => s.publish_date === targetDateStr);
    renderCardToArea(cardArea, initialStory || null, targetDate, targetDateStr, null, allStories);

  } catch (err) {
    console.error(err);
    page.innerHTML = `<div class="empty-state"><div class="empty-state-title">오류가 발생했습니다</div></div>`;
  }
}

function renderCardToArea(cardArea, story, dateObj, isoDateStr, direction = null, allStories) {
  if (!cardArea) return;
  preloadStoryImages([story], { limit: 1, variant: 'thumb', fallback: false });

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
          <div class="empty-story-day-circle">${day}</div>
          <div class="empty-story-title">이 날의 기록이 없습니다.</div>
          <div class="empty-story-date">${formattedDate}</div>
          
          <button class="btn btn-primary mystory-write-btn" data-date="${isoDateStr}">
            + 나의 일화 쓰기
          </button>
        </div>
      </div>
    `;
  } else {
    const [storyYearRaw, storyMonthRaw, storyDayRaw] = String(story.publish_date || isoDateStr).split('-');
    const storyYear = parseInt(storyYearRaw, 10) || displayYear;
    const storyMonth = parseInt(storyMonthRaw, 10) || month;
    const storyDay = parseInt(storyDayRaw, 10) || day;
    const imageSources = getStoryImageSources(story, 'thumb');
    const imageUrl = imageSources.primary;
    const fallbackAttr = imageSources.fallback
      ? ` data-fallback-src="${escapeHtml(imageSources.fallback)}"`
      : '';
    const imageAttrs = imageUrl
      ? `src="${escapeHtml(imageUrl)}"${fallbackAttr}`
      : `src="${escapeHtml(CARD_PLACEHOLDER_IMAGE)}"`;
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
                <button class="card-action-btn share-my-story-btn" data-id="${escapeHtml(story.id)}" aria-label="공유">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                  </svg>
                </button>
                <button class="card-action-btn edit-my-story-btn" data-id="${escapeHtml(story.id)}" aria-label="수정">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
              </div>
              <div class="card-meta">${escapeHtml(story.title)}</div>
            </div>
          </div>
          <div class="history-card-image-wrap">
            <img ${imageAttrs} alt="${escapeHtml(story.title)}" loading="eager" decoding="async" width="320" height="400" onerror="if(this.dataset.fallbackSrc){this.src=this.dataset.fallbackSrc;delete this.dataset.fallbackSrc}else{this.src='${CARD_PLACEHOLDER_IMAGE}'}" draggable="false" />
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
  setTimeout(() => { if (newCard.classList.contains('card-stack-item')) onAnimationEnd(); }, CARD_STACK_SETTLE_MS);
}

function bindCardEvents(flipContainer, story, dateObj, allStories) {
  const flipper = flipContainer.querySelector('.flipper');
  if (!flipper) return;

  /* 상단 액션 버튼 이벤트 (mystory 전용) */
  const writeBtn = flipContainer.querySelector('.mystory-write-btn');
  const shareBtn = flipContainer.querySelector('.share-my-story-btn');
  const editBtn = flipContainer.querySelector('.edit-my-story-btn');

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

  if (shareBtn && story) {
    shareBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!checkAuth()) return;
      await shareStory(story, { kind: 'mystory', includeImage: false });
    });
  }

  if (editBtn) {
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!checkAuth()) return;
      navigate('/mystory/new?edit=' + editBtn.dataset.id);
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
  let isBackBodyScroll = false;
  let lastTouchInputAt = 0;
  const SWIPE_THRESHOLD = 64;
  const SWIPE_DRAG_RESPONSE = 0.62;
  const SWIPE_RETURN_MS = 220;
  const SYNTHETIC_MOUSE_IGNORE_MS = 650;

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
    isBackBodyScroll = isBody;

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
      const moveX = diffX * SWIPE_DRAG_RESPONSE;
      flipper.style.transform = `translateX(${moveX}px) ${baseTransform}`;
    }
  };

  const handleEnd = async (x, y) => {
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
      /* 세션 1 #2: 짧은 시간 내 두 번째 commit 차단 */
      if (Date.now() - lastSwipeCommitAt >= SWIPE_COMMIT_GUARD_MS) {
        lastSwipeCommitAt = Date.now();

        const offset = diffX < 0 ? 1 : -1;
        const dayWrapper = document.getElementById('mystory-calendar');
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
      <div class="page-header" style="height: 60px; padding: 0 16px; align-items:center; display:flex; justify-content:center;">
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
  let defaultDate = params.date || new Date().toISOString().split('T')[0];

  page.innerHTML = `
    <div class="page-header" style="height: 60px; padding: 0 16px; align-items:center; display:flex; justify-content:flex-start; gap:8px;">
      <button class="page-header-back" id="mystory-form-back" style="width:32px; height:32px; padding:0; display:flex; align-items:center; justify-content:center;">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <h1 class="page-header-title" style="margin:0; font-size:1.2rem; transform: translateY(1px);">${editingId ? '나의 일화 수정' : '나의 일화 쓰기'}</h1>
    </div>

    <div class="editor-form-section section" style="padding-bottom: 6rem;">
      <form id="mystory-form" class="story-form">
        <!-- 1. 이미지 -->
        <div class="input-group">
          <label class="input-label">이미지 업로드 및 URL</label>
          <div style="display:flex; gap:var(--space-2); align-items:center;">
          <input class="input-field" id="ms-image" placeholder="URL 직접 입력 또는 사진 선택" style="flex:1;" />
          <input type="hidden" id="ms-image-thumb" />
            <button type="button" id="ms-image-edit-btn" class="btn btn-secondary" style="display:none; margin:0; padding:var(--space-2) var(--space-3); font-size:var(--text-sm); white-space:nowrap;">편집</button>
            <label for="ms-image-file" class="btn btn-secondary" style="cursor:pointer; margin:0; padding:var(--space-2) var(--space-3); font-size:var(--text-sm); white-space:nowrap;">
              사진 추가
            </label>
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
        ${editingId ? `
        <div style="margin-top:var(--space-3);">
          <button type="button" class="btn btn-secondary btn-full mystory-form-delete-btn" id="delete-my-story-edit">삭제</button>
        </div>
        ` : ''}
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

    if (editingId) {
      const story = await fetchMyStoryById(editingId, user.id);
      if (story) {
        document.getElementById('ms-title').value = story.title || '';
        document.getElementById('ms-date').value = story.publish_date || defaultDate;
        document.getElementById('ms-body').value = story.body || '';
        document.getElementById('ms-image').value = story.image_url || '';
        document.getElementById('ms-image-thumb').value = story.image_thumb_url || '';
      }
    }

    document.getElementById('delete-my-story-edit')?.addEventListener('click', async () => {
      if (!editingId) return;
      const confirmed = await showConfirm({
        title: '일화 삭제',
        message: '이 일화를 삭제하시겠습니까?\n삭제한 일화는 복구할 수 없습니다.',
        confirmText: '삭제',
        cancelText: '취소',
        danger: true,
      });
      if (!confirmed) return;

      try {
        await deleteMyStory(editingId);
        const deletedDate = document.getElementById('ms-date')?.value || defaultDate;
        void syncDiaryStateFromList(allStories.filter((story) => String(story.id) !== String(editingId)));
        showToast('일화가 삭제되었습니다.', 'success');
        navigate('/mystory', { date: deletedDate });
      } catch (err) {
        showToast('삭제 중 오류가 발생했습니다.', 'error');
      }
    });

    function updateImageEditBtn() {
      const url = document.getElementById('ms-image')?.value.trim();
      const btn = document.getElementById('ms-image-edit-btn');
      if (btn) btn.style.display = url ? 'inline-block' : 'none';
    }

    const imageVariantFields = bindImageVariantFields({
      imageInput: document.getElementById('ms-image'),
      thumbInput: document.getElementById('ms-image-thumb'),
    });

    const formEl = document.getElementById('mystory-form');
    if (formEl) {
      formEl.addEventListener('input', () => {
        updateImageEditBtn();
      });
    }
    updateImageEditBtn();

    async function openCropModal(imageSrc, isCrossOrigin = false, callbackBlobFile) {
      let localSrc = imageSrc;
      if (isCrossOrigin) {
        const isFirebaseUrl = imageSrc.includes('firebasestorage.googleapis.com')
                           || imageSrc.includes('.firebasestorage.app');
        if (!isFirebaseUrl) {
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
        <div class="crop-modal-header">자르기 및 회전</div>
        <div class="crop-modal-body">
          <img id="cropper-image" src="${localSrc}" style="max-width: 100%; display: block;" />
        </div>
        <div class="crop-modal-footer">
          <button type="button" class="btn-rotate" id="btn-crop-rotate">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.53-11.23l5.67 5.66" />
            </svg>
            회전
          </button>
          <button type="button" class="btn-crop-confirm" id="btn-crop-confirm">다음</button>
        </div>
      `;
      const wrapper = document.querySelector('.mobile-wrapper') || document.body;
      wrapper.appendChild(overlay);
      lockScroll();

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
        unlockScroll();
        overlay.remove();
      };

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
          unlockScroll();
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
      if (!STATUS_EL || !IMAGE_FIELD) return;

      try {
        STATUS_EL.style.display = 'block';
        STATUS_EL.style.color = 'var(--color-primary)';
        STATUS_EL.textContent = '사진을 업로드하는 중입니다... ⏳';

        const uploadUid = uid || 'guest';
        blob.name = fallbackName;
        const { image_url, image_thumb_url } = await uploadCardImageVariants(blob, { uid: uploadUid, folder: 'diary' });

        imageVariantFields.applyUploadResult({ image_url, image_thumb_url });
        STATUS_EL.textContent = '업로드 완료! ✅';
        STATUS_EL.style.color = 'var(--color-info)';
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
      if (!url) return;
      openCropModal(url, true, (blob) => {
        processUploadBlob(blob, 'edited_image.jpeg');
      });
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
        image_url: document.getElementById('ms-image').value.trim(),
        image_thumb_url: document.getElementById('ms-image-thumb')?.value.trim() || ''
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
        const nextStories = editingId
          ? [...allStories.filter((story) => String(story.id) !== String(editingId)), { ...data, id: editingId }]
          : [...allStories, data];
        void syncDiaryStateFromList(nextStories);
        navigate('/mystory', { date: data.publish_date });
      } catch (err) {
        showToast('저장 중 오류 발생', 'error');
      }
    });

  }, 0);

  return page;
}
