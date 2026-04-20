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
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { getState } from '../state.js';
import { navigate } from '../router.js';
import { DEMO_STORIES } from '../data/demo.js';


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

/**
 * loadEditorStoryData — 서버에서 스토리 데이터를 가져와 페이지를 완성합니다
 * @param {HTMLElement} page - renderEditorStory()에서 만든 페이지 요소
 * 
 * 동작 순서:
 *   1) 전체 스토리 목록과 오늘의 스토리를 서버에서 가져옴
 *   2) 주간 캘린더 날짜들을 생성하고 화면에 표시
 *   3) 각 날짜에 클릭 이벤트를 연결 (클릭 → 해당 날짜의 카드로 변경)
 *   4) 오늘의 카드를 화면에 표시
 *   5) 오류 발생 시 에러 메시지와 새로고침 버튼 표시
 */
async function loadEditorStoryData(page) {
  try {
    /* 서버에서 데이터 가져오기 (Promise.all을 통한 진정한 병렬 실행으로 로딩 속도 2배 최적화) */
    const [allStories, todayStory, bookmarkedIds] = await Promise.all([
      fetchStories(),
      fetchTodayStory(),
      getBookmarkedStoryIds()
    ]);

    /* 로컬에 저장된 읽은 날짜 목록 가져오기 */
    let readDates = [];
    try {
      readDates = JSON.parse(localStorage.getItem('read_dates')) || [];
    } catch (e) {
      readDates = [];
    }

    /* 날짜를 매끄럽게 '읽음' 처리하는 내부 헬퍼 */
    function markAsRead(isoDate) {
      if (!readDates.includes(isoDate)) {
        readDates.push(isoDate);
        localStorage.setItem('read_dates', JSON.stringify(readDates));
        
        // Wheel Picker에서 해당 날짜의 도트 제거
        const [y, m, d] = isoDate.split('-');
        const currentMonth = parseInt(monthElement.querySelector('.wheel-item.active')?.dataset.month, 10);
        
        // 현재 선택된 월과 일치하는 경우에만 UI에서 즉시 제거
        if (parseInt(m, 10) === currentMonth) {
          const item = calendarElement.querySelector(`.wheel-item[data-day="${parseInt(d, 10)}"]`);
          if (item) {
            const dot = item.querySelector('.unread-dot');
            if (dot) dot.remove();
          }
        }
      }
    }

    const todayStr = todayStory.publish_date;
    const today = new Date(todayStr + 'T00:00:00');
    let latestPathDate = today;

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

    /* ---- 일 캘린더 렌더링 (1~31) ---- */
    if (calendarElement) {
      let dayHtml = '';
      for (let d = 1; d <= 31; d++) {
        dayHtml += `<div class="wheel-item" data-day="${d}">${d}</div>`;
      }
      calendarElement.innerHTML = dayHtml;

      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;
      const currentDate = today.getDate();

      function applyDisabledState() {
        monthElement.querySelectorAll('.wheel-item').forEach(el => {
          const m = parseInt(el.dataset.month, 10);
          if (m > currentMonth) el.classList.add('disabled');
          else el.classList.remove('disabled');
        });

        const activeMonth = monthElement.querySelector('.wheel-item.active') || getActiveItem(monthElement);
        if (!activeMonth) return;
        const selectedMonth = parseInt(activeMonth.dataset.month, 10);

        calendarElement.querySelectorAll('.wheel-item').forEach(el => {
          const d = parseInt(el.dataset.day, 10);
          
          // 기존 도트 제거 후 새로 렌더링 (월 변경 시 대비)
          const existingDot = el.querySelector('.unread-dot');
          if (existingDot) existingDot.remove();

          const isoDate = `${currentYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const hasUnreadStory = allStories.some(s => s.publish_date === isoDate) && !readDates.includes(isoDate);
          
          if (hasUnreadStory) {
            const dot = document.createElement('div');
            dot.className = 'unread-dot';
            el.appendChild(dot);
          }

          if (selectedMonth > currentMonth) {
            el.classList.add('disabled');
          } else if (selectedMonth === currentMonth && d > currentDate) {
            el.classList.add('disabled');
          } else {
            el.classList.remove('disabled');
          }
        });
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

      function updateWheelSelection(forceInstant = false) {
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
          const mNum = String(activeMonth.dataset.month).padStart(2, '0');
          const dNum = String(activeDay.dataset.day).padStart(2, '0');
          const year = today.getFullYear();
          const selectedIsoDate = `${year}-${mNum}-${dNum}`;
          const newDate = new Date(selectedIsoDate + 'T00:00:00');

          /* 이미 렌더링된 동일 날짜면 중복 렌더링 건너뜀 (복귀 시 이상한 애니메이션 발생 방지) */
          if (latestPathDate && latestPathDate.getTime() === newDate.getTime()) {
            return;
          }

          /* 유효하지 않은 날짜 처리 (예: 2월 30일) */
          if (String(newDate.getMonth() + 1).padStart(2, '0') !== mNum) {
            return; // 할당시키지 않고 무시
          }

          let storyForDate = allStories.find(s => s.publish_date === selectedIsoDate);
          
          if (!storyForDate && tutorialStep < 2) {
            storyForDate = DEMO_STORIES[Math.floor(Math.random() * DEMO_STORIES.length)];
          }

          const direction = newDate > latestPathDate ? 'next' : 'prev';
          latestPathDate = newDate;

          // 날짜 선택 시점에는 읽음 처리하지 않음 (뒤집을 때 처리)
          renderCardToArea(cardArea, storyForDate || null, newDate, direction, bookmarkedIds, advanceTutorial, tutorialStep, markAsRead);
        }
      }

      let scrollTimeout;
      const onScrollEnd = () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => updateWheelSelection(false), 150);
      };
      monthElement.addEventListener('scroll', onScrollEnd, { passive: true });
      calendarElement.addEventListener('scroll', onScrollEnd, { passive: true });

      const onClickItem = (container, item) => {
        if (item.classList.contains('disabled')) return;
        container.querySelectorAll('.wheel-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        
        // 딜레이를 없애기 위해 클릭 시 즉시 카드 업데이트 (디바운스 우회)
        updateWheelSelection(true);

        const scrollTarget = item.offsetLeft - container.offsetWidth / 2 + item.offsetWidth / 2;
        container.scrollTo({ left: scrollTarget, behavior: 'smooth' });
      };

      monthElement.querySelectorAll('.wheel-item').forEach(item => {
        item.addEventListener('click', () => onClickItem(monthElement, item));
      });
      calendarElement.querySelectorAll('.wheel-item').forEach(item => {
        item.addEventListener('click', () => onClickItem(calendarElement, item));
      });

      /* 초기 진입 시 오늘 날짜로 포커싱 맞추기 */
      setTimeout(() => {
        const targetMonthItem = monthElement.querySelector(`.wheel-item[data-month="${today.getMonth() + 1}"]`);
        const targetDayItem = calendarElement.querySelector(`.wheel-item[data-day="${today.getDate()}"]`);
        if (targetMonthItem) {
          monthElement.scrollLeft = targetMonthItem.offsetLeft - monthElement.offsetWidth / 2 + targetMonthItem.offsetWidth / 2;
          targetMonthItem.classList.add('active');
        }
        if (targetDayItem) {
          calendarElement.scrollLeft = targetDayItem.offsetLeft - calendarElement.offsetWidth / 2 + targetDayItem.offsetWidth / 2;
          targetDayItem.classList.add('active');
        }
      }, 0);
    }

    /* ---- 튜토리얼 상태 머신 (페이지 레벨) ---- */
    /*
     * swipe_tutorial_step 값에 따른 상태:
     *   null (키 없음) → 미결정: 웰컴 모달을 띄워 참여 여부를 묻는다
     *   0, 1          → 튜토리얼 진행 중 (각 단계별 안내 버블 표시)
     *   2 이상        → 튜토리얼 완료 (일반 모드)
     */
    const tutRaw = localStorage.getItem('swipe_tutorial_step');
    const isUndecided = (tutRaw === null);  // 최초 접속자: 아직 결정 안 함
    let tutorialStep = isUndecided ? 99 : parseInt(tutRaw, 10);
    // 미결정 상태에서는 99(완료 취급)로 설정하여 데모 데이터/버블 없이 실제 카드를 보여준다

    function renderTutorialBubble() {
      const existing = page.querySelector('#tutorial-overlay');
      if (existing) existing.remove();

      if (tutorialStep >= 2) return;

      let message = '';
      if (tutorialStep === 0) message = '카드를 탭해서 내용을 확인하세요 👆';
      else if (tutorialStep === 1) message = '좌우로 밀어 다른 날의 일화를 보세요 ↔️';

      const overlay = document.createElement('div');
      overlay.className = 'tutorial-overlay';
      overlay.id = 'tutorial-overlay';
      overlay.innerHTML = `<div class="tutorial-bubble">${message}</div>`;
      page.appendChild(overlay);
    }

    function advanceTutorial(fromStep) {
      if (tutorialStep === fromStep) {
        tutorialStep++;
        localStorage.setItem('swipe_tutorial_step', tutorialStep.toString());
        renderTutorialBubble();
      }
    }

    /* ---- 오늘의 카드 초기 렌더링 (방향 없이 즉시) ---- */
    let initialStory = todayStory;

    if (!isUndecided && tutorialStep < 2) {
      /* 튜토리얼 진행 중 → 데모 데이터 사용 */
      initialStory = DEMO_STORIES[DEMO_STORIES.length - 1];
    }
    /* 미결정 상태(isUndecided)일 때는 실제 todayStory를 배경으로 보여준다 */

    // 초기 로드 시점에는 읽음 처리하지 않음 (뒤집을 때 처리)
    renderCardToArea(cardArea, initialStory, today, null, bookmarkedIds, advanceTutorial, tutorialStep, markAsRead);
    renderTutorialBubble();

    /* ---- 웰컴 모달 (최초 접속 시에만 표시) ---- */
    if (isUndecided) {
      const welcomeOverlay = document.createElement('div');
      welcomeOverlay.id = 'welcome-modal-overlay';
      welcomeOverlay.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.65);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s ease;
      `;
      welcomeOverlay.innerHTML = `
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 82%;
          max-width: 340px;
          padding: var(--space-6) var(--space-5);
          background: var(--color-bg-primary);
          border-radius: var(--radius-xl);
          box-shadow: 0 12px 32px rgba(0,0,0,0.4);
          text-align: center;
          transform: translateY(20px);
          transition: transform 0.3s ease;
        ">
          <div style="font-size: 3rem; margin-bottom: var(--space-2);"></div>
          <h3 style="margin: 0 0 var(--space-2); font-size: var(--text-xl); color: var(--color-text-primary); font-weight: 700;">
            환영합니다!
          </h3>
          <p style="
            margin: 0 0 var(--space-5);
            color: var(--color-text-secondary);
            font-size: var(--text-md);
            line-height: 1.5;
            word-break: keep-all;
          ">
            간단한 사용법을 안내하는<br>튜토리얼을 진행할까요?
          </p>
          <div style="display: flex; gap: var(--space-3); width: 100%;">
            <button id="welcome-btn-no" class="btn btn-secondary" style="
              flex: 1;
              border-radius: 30px;
              padding: 12px 0;
              font-weight: 600;
              font-size: 1rem;
            ">다음에</button>
            <button id="welcome-btn-yes" class="btn btn-primary" style="
              flex: 1;
              border-radius: 30px;
              padding: 12px 0;
              font-weight: 600;
              font-size: 1rem;
            ">좋아요!</button>
          </div>
        </div>
      `;
      page.appendChild(welcomeOverlay);

      /* 페이드인 애니메이션 */
      requestAnimationFrame(() => {
        welcomeOverlay.style.opacity = '1';
        welcomeOverlay.querySelector('div').style.transform = 'translateY(0)';
      });

      /* ── "네" 버튼: 튜토리얼 시작 ── */
      welcomeOverlay.querySelector('#welcome-btn-yes').addEventListener('click', () => {
        tutorialStep = 0;
        localStorage.setItem('swipe_tutorial_step', '0');

        /* 모달 닫기 애니메이션 */
        welcomeOverlay.style.opacity = '0';
        welcomeOverlay.querySelector('div').style.transform = 'translateY(20px)';
        setTimeout(() => {
          welcomeOverlay.remove();
          /* 데모 카드로 교체 + 튜토리얼 버블 시작 */
          const demoStory = DEMO_STORIES[DEMO_STORIES.length - 1];
          renderCardToArea(cardArea, demoStory, today, null, bookmarkedIds, advanceTutorial, tutorialStep);
          renderTutorialBubble();
        }, 300);
      });

      /* ── "아니요" 버튼: 스킵 ── */
      welcomeOverlay.querySelector('#welcome-btn-no').addEventListener('click', () => {
        tutorialStep = 2;
        localStorage.setItem('swipe_tutorial_step', '2');

        /* 모달 닫기 애니메이션 */
        welcomeOverlay.style.opacity = '0';
        welcomeOverlay.querySelector('div').style.transform = 'translateY(20px)';
        setTimeout(() => {
          welcomeOverlay.remove();
          /* 안내 토스트 표시 */
          showToast('설정 > 튜토리얼 다시 보기 에서 언제든 다시 볼 수 있어요!', 'info');
        }, 300);
      });
    }

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


/* ─────────────────────────────────────────────
   섹션 3: 카드 렌더링 및 전환 함수
   ───────────────────────────────────────────── */

/**
 * renderCardToArea — 주어진 스토리 데이터로 카드를 렌더링하고 애니메이션을 처리합니다
 * @param {HTMLElement} cardArea  - 카드가 위치할 컨테이너
 * @param {Object|null} story    - 카드에 담길 일화 데이터
 * @param {Date}        dateObj  - 표시할 날짜
 * @param {string|null} direction - 'next' (미래로), 'prev' (과거로) 또는 null (초기 로드)
 * @param {Array}       bookmarkedIds - 사용자가 북마크한 스토리 ID 배열
 */
function renderCardToArea(cardArea, story, dateObj, direction = null, bookmarkedIds = [], advanceTutorialFn = null, currentTutorialStep = 3, markAsReadFn = null) {
  if (!cardArea) return;

  /* 버그 수정: 카드 여러 장이 겹쳐서 남는 현상 방지 */
  /* 모든 카드를 찾은 뒤 가장 마지막(최신) 요소만 전환 대상으로 삼고 나머지는 삭제 */
  const allCards = Array.from(cardArea.querySelectorAll('.flip-container'));
  const oldCard = allCards.pop() || null;
  allCards.forEach(c => c.remove());

  /* 새 카드 HTML 생성 */
  const pubDate = story ? new Date(story.publish_date) : dateObj;
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
                <button class="card-action-btn" aria-label="북마크">
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
            <img src="${escapeHtml(story.image_url)}" alt="${escapeHtml(story.figure_name)}" loading="eager" draggable="false" />
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
            <button class="back-editor-btn" type="button" title="에디터 한마디" data-comment="${escapeHtml(story.editor_comment || '')}" data-editor-name="${escapeHtml((story.editor && story.editor.displayName) || 'DayStory')}" style="${story.editor_comment && story.editor_comment.trim() !== '' ? '' : 'visibility: hidden; pointer-events: none;'}">
              ${story.editor && story.editor.photoURL
                ? `<img src="${escapeHtml(story.editor.photoURL)}" alt="editor" class="back-editor-avatar" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><span class="back-editor-avatar-fallback" style="display:none">✍️</span>`
                : '<span class="back-editor-avatar-fallback">✍️</span>'}
            </button>
            <div class="back-date">${escapeHtml(story.historical_year)}년 ${month}월 ${day}일</div>
          </div>
        </div>
      </div>
    `;
  }

  /* 3) 초기 로드 (애니메이션 없음) */
  if (!direction || !oldCard) {
    cardArea.innerHTML = '';
    cardArea.appendChild(newCard);
    bindCardEvents(newCard, story, bookmarkedIds, advanceTutorialFn, currentTutorialStep, markAsReadFn);
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
    bindCardEvents(newCard, story, bookmarkedIds, advanceTutorialFn, currentTutorialStep, markAsReadFn);
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
function bindCardEvents(flipContainer, story, bookmarkedIds, advanceTutorialFn, currentTutorialStep, markAsReadFn) {
  const flipper = flipContainer.querySelector('.flipper');
  if (!flipper) return;

  /* 상단 액션 버튼 이벤트 */
  const shareBtn = flipContainer.querySelector('.card-action-btn[aria-label="공유"]');
  const bookmarkBtn = flipContainer.querySelector('.card-action-btn[aria-label="북마크"]');

  if (shareBtn) {
    shareBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const tutStep = parseInt(localStorage.getItem('swipe_tutorial_step') || '0', 10);
      if (tutStep < 2) return; // 튜토리얼 중에는 기능 제한
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
      const tutStep = parseInt(localStorage.getItem('swipe_tutorial_step') || '0', 10);
      if (tutStep < 2) return; // 튜토리얼 중에는 기능 제한
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
      showToast(res.bookmarked ? '북마크 추가' : '해제', 'success');
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
  let isBackBodyScroll = false;
  const SWIPE_THRESHOLD = 80;

  /* ── back-body 탭 vs 스크롤 구분용 변수 ── */
  let tapStartTime = 0;
  let tapStartX = 0;
  let tapStartY = 0;
  let touchStartTarget = null;  // 터치 시작 시 대상 요소 저장

  const handleStart = (x, y, isBody = false) => {
    if (isAnimating || flipper.classList.contains('is-flipping')) return;
    
    touchStartX = x;
    touchStartY = y;
    isSwiping = false;
    swipeAxis = null;
    hapticTriggered = false;
    isBackBodyScroll = isBody;

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
    const tutStep = parseInt(localStorage.getItem('swipe_tutorial_step') || '0', 10);
    
    if (tutStep === 0) return; // 튜토리얼 0단계(탭 안내)일 때 스와이프 무시
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
      if (!story || isBackBodyScroll) {
        flipper.style.transform = '';
        setTimeout(() => { flipper.style.transition = ''; flipper.classList.remove('is-flipping'); isSwiping = false; isAnimating = false; }, 250);
        return;
      }
      try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch (err) { }
      const tutStep = parseInt(localStorage.getItem('swipe_tutorial_step') || '0', 10);
      const wasInTutorial = tutStep < 2;

      if (typeof advanceTutorialFn === 'function') advanceTutorialFn(1);

      if (wasInTutorial) {
        /* 실제 x축 이동 기능 방어 후 초기 위치 복구 */
        flipper.style.transform = '';
        setTimeout(() => { flipper.style.transition = ''; flipper.classList.remove('is-flipping'); isSwiping = false; isAnimating = false; }, 250);
        
        /* 튜토리얼 종료 안내 센터 팝업 노출 */
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.3s ease;';
        overlay.innerHTML = `
          <div style="background:var(--color-bg-primary);padding:var(--space-6) var(--space-4);border-radius:var(--radius-xl);text-align:center;width:80%;max-width:320px;box-shadow:0 10px 25px rgba(0,0,0,0.5);transform:translateY(20px);transition:transform 0.3s ease;">
            <div style="font-size:3.5rem;margin-bottom:var(--space-2);">🎉</div>
            <h3 style="margin-top:0;margin-bottom:var(--space-2);font-size:var(--text-xl);color:var(--color-text-primary);">튜토리얼 완료!</h3>
            <p style="color:var(--color-text-secondary);font-size:var(--text-md);margin-bottom:var(--space-5);line-height:1.4;word-break:keep-all;">모든 기본 조작법을 익히셨습니다.<br>이제 자유롭게 기록들을 탐색해 보세요!</p>
            <button class="btn btn-primary btn-finish-tut" style="width:100%;border-radius:30px;font-weight:bold;font-size:1.1rem;padding:12px 0;">시작하기</button>
          </div>
        `;
        const wrapper = document.querySelector('.mobile-wrapper') || document.body;
        wrapper.appendChild(overlay);
        
        void overlay.offsetWidth; /* 강제 리플로우 */
        overlay.style.opacity = '1';
        overlay.querySelector('div').style.transform = 'translateY(0)';
        
        overlay.querySelector('.btn-finish-tut').addEventListener('click', () => {
          overlay.style.opacity = '0';
          overlay.querySelector('div').style.transform = 'translateY(20px)';
          setTimeout(() => {
            overlay.remove();
            window.location.reload();
          }, 300);
        });
        
        return; /* 실제 작업 생략 */
      }

      const dayWrapper = document.getElementById('editorstory-calendar');
      if (dayWrapper) {
        const items = Array.from(dayWrapper.querySelectorAll('.wheel-item'));
        const activeIdx = items.findIndex(el => el.classList.contains('active'));
        if (diffX < 0 && activeIdx > -1 && activeIdx < items.length - 1) {
          if (!items[activeIdx + 1].classList.contains('disabled')) {
            items[activeIdx + 1].click();
          }
        } else if (diffX > 0 && activeIdx > 0) {
          items[activeIdx - 1].click();
        }
      }
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
    const isBody = !!e.target.closest('.back-body');
    touchStartTarget = e.target;   // 터치 대상 저장
    handleStart(e.touches[0].clientX, e.touches[0].clientY, isBody);
  }, { passive: true });

  flipper.addEventListener('touchmove', (e) => {
    handleMove(e.touches[0].clientX, e.touches[0].clientY, true);
    if (isSwiping) e.preventDefault();
  }, { passive: false });

  flipper.addEventListener('touchend', async (e) => {
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
        const tutStep = parseInt(localStorage.getItem('swipe_tutorial_step') || '0', 10);
        if (tutStep === 1) return;

        flipper.classList.add('is-flipping');
        
        /* 즉각적인 반응성: 진동을 기다리지 않고 즉시 뒤집기 */
        Haptics.selectionChanged().catch(() => {});
        flipper.classList.toggle('flipped');

        // 뒤집기 완료 시 읽음 처리 수행
        if (typeof markAsReadFn === 'function' && story && story.publish_date) {
          markAsReadFn(story.publish_date);
        }
        
        /* CSS transition 0.4s와 동기화 */
        setTimeout(() => { flipper.classList.remove('is-flipping'); }, 400);
        if (typeof advanceTutorialFn === 'function') advanceTutorialFn(0);
        return; 
      }
    }

    handleEnd(endX, endY);
  });

  // 마우스 이벤트 (데스크톱 드래그 대응, 윈도우 전역 리스너 중첩 방지)
  let isMouseDown = false;
  flipper.addEventListener('mousedown', (e) => {
    if (e.target.closest('.card-action-btn')) return;
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

  // 일반 클릭: 뒤집기
  flipper.addEventListener('click', async (e) => {
    const tutStep = parseInt(localStorage.getItem('swipe_tutorial_step') || '0', 10);
    if (tutStep === 1) return; // 튜토리얼 단계가 1일 때 탭 조작 금지
    if (!story) return; // 기록 없는 카드 탭 무시
    if (e.target.closest('.card-action-btn') || e.target.closest('.back-editor-btn')) return;

    /* back-body 영역: 터치 기반 탭은 touchend에서 이미 처리했으므로, 
       터치 입력(pointerType === 'touch')인 경우만 click 핸들러에서 차단합니다. 
       마우스 클릭은 여기서 정상 처리됩니다. */
    if (e.pointerType === 'touch' && e.target.closest('.back-body')) return;

    if (isSwiping) return; // 스와이프 처리 중이면 탭 무시
    
    // 회전 애니메이션 중 중복 클릭 및 터치 차단
    if (flipper.classList.contains('is-flipping')) return;
    flipper.classList.add('is-flipping');
    
    /* 탭 반응성 최적화 */
    Haptics.selectionChanged().catch(() => {});
    flipper.classList.toggle('flipped');
    
    // 뒤집기 완료 시 읽음 처리 수행
    if (typeof markAsReadFn === 'function' && story && story.publish_date) {
      markAsReadFn(story.publish_date);
    }
    
    // CSS에 정의된 transition 시간 (0.4s) 후 보호 해제
    setTimeout(() => {
      flipper.classList.remove('is-flipping');
    }, 400);
    
    /* 튜토리얼: 탭 완료 처리 */
    if (typeof advanceTutorialFn === 'function') advanceTutorialFn(0);
  });

  /* 에디터 한마디 버튼 클릭 → 코멘트 말풍선 표시 */
  const editorBtn = flipContainer.querySelector('.back-editor-btn');
  if (editorBtn) {
    const showBubble = (e) => {
      if (e) {
        e.stopPropagation();
        if (e.type === 'touchend') e.preventDefault(); /* 터치 이벤트 시 후속 click 방지 */
      }
      
      const comment = editorBtn.dataset.comment;
      const editorName = editorBtn.dataset.editorName || 'DayStory';
      
      /* 이미 열려있으면 닫기 */
      const existing = flipContainer.querySelector('.editor-comment-bubble');
      if (existing) { existing.remove(); return; }
      
      /* 코멘트가 없는 경우 */
      if (!comment) return;
      
      const bubble = document.createElement('div');
      bubble.className = 'editor-comment-bubble';
      bubble.innerHTML = `<span class="editor-comment-name">${editorName}</span>${comment}`;
      editorBtn.parentElement.appendChild(bubble);
      setTimeout(() => { if (bubble.parentNode) bubble.remove(); }, 4000);
    };

    editorBtn.addEventListener('click', showBubble);
    editorBtn.addEventListener('touchend', (e) => {
      /* 카드 플리퍼가 스와이프 움직임 중이면 터치를 무시함 */
      if (isSwiping) return; 
      showBubble(e);
    });
  }
}
