/* =====================================================================
   home.js — 홈 페이지 (메인 화면)
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
   섹션 1: 홈 페이지 렌더링 함수
   ───────────────────────────────────────────── */

/**
 * renderHome — 홈 페이지의 HTML 구조를 생성하고 반환합니다
 * @returns {HTMLElement} 홈 페이지 DOM 요소
 * 
 * 이 함수가 호출되면:
 *   1) 빈 페이지 틀을 만들고 (로딩 스피너 포함)
 *   2) loadHomeData()를 비동기로 실행해 실제 데이터를 채웁니다
 */
export function renderHome() {
  const page = document.createElement('div');
  page.className = 'home-page page';

  page.innerHTML = `
    <!-- 상단 제목 -->
    <div class="home-header">
      <h1 class="home-title"></h1>
    </div>

    <!-- 상단 월 스크롤 -->
    <div class="home-month-scroll" id="home-month-scroll"></div>

    <!-- 주간 캘린더 바 (데이터 로드 후 채워짐) -->
    <div class="home-calendar-scroll" id="home-calendar"></div>

    <!-- 메인 카드 영역 (처음에는 로딩 스피너 표시) -->
    <div class="home-card-area" id="home-card-area">
      <div style="display:flex;justify-content:center;padding:var(--space-8);width:100%;">
        <div class="loading-spinner"></div>
      </div>
    </div>
  `;

  /* 데이터를 비동기로 불러와서 페이지를 채움 */
  loadHomeData(page);

  return page;
}


/* ─────────────────────────────────────────────
   섹션 2: 데이터 로딩 및 캘린더/카드 초기화
   ───────────────────────────────────────────── */

/**
 * loadHomeData — 서버에서 스토리 데이터를 가져와 페이지를 완성합니다
 * @param {HTMLElement} page - renderHome()에서 만든 페이지 요소
 * 
 * 동작 순서:
 *   1) 전체 스토리 목록과 오늘의 스토리를 서버에서 가져옴
 *   2) 주간 캘린더 날짜들을 생성하고 화면에 표시
 *   3) 각 날짜에 클릭 이벤트를 연결 (클릭 → 해당 날짜의 카드로 변경)
 *   4) 오늘의 카드를 화면에 표시
 *   5) 오류 발생 시 에러 메시지와 새로고침 버튼 표시
 */
async function loadHomeData(page) {
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
        const item = calendarElement ? calendarElement.querySelector(`.cal-item[data-date="${isoDate}"]`) : document.querySelector(`.cal-item[data-date="${isoDate}"]`);
        if (item) {
          const dot = item.querySelector('.unread-dot');
          if (dot) dot.remove();
        }
      }
    }

    /* ---- 캘린더 날짜 생성 ---- */
    const todayStr = todayStory.publish_date;               /* '2026-03-30' 형식 */
    const today = new Date(todayStr + 'T00:00:00');         /* Date 객체로 변환 */
    const calendarDates = [];

    /* 올해 1월 1일부터 12월 31일까지 365개의 날짜 생성 */
    const currentYear = today.getFullYear();
    const startDate = new Date(currentYear, 0, 1);
    const endDate = new Date(currentYear, 11, 31);
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      calendarDates.push(new Date(d));
    }

    /* 요일 이름 배열 (일~토) */
    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

    /* 현재 화면에 표시된 날짜를 추적 (방향 판별용) */
    let latestPathDate = today;

    /* 캘린더 HTML 생성 */
    const calendarHtml = calendarDates.map(date => {
      const isToday = date.getTime() === today.getTime();
      const year = date.getFullYear();
      const monthNum = String(date.getMonth() + 1).padStart(2, '0');
      const dayNum = String(date.getDate()).padStart(2, '0');
      const isoDate = `${year}-${monthNum}-${dayNum}`;

      const hasStory = allStories.some(s => s.publish_date === isoDate);
      const isUnread = hasStory && !readDates.includes(isoDate);

      return `
        <div class="cal-item ${isToday ? 'active' : ''}" data-date="${isoDate}">
          <div class="cal-day">${weekDays[date.getDay()]}</div>
          <div class="cal-date">${date.getDate()}</div>
          ${isUnread ? '<div class="unread-dot"></div>' : ''}
        </div>
      `;
    }).join('');

    /* ---- DOM 요소 참조 가져오기 ---- */
    const monthElement = page.querySelector('#home-month-scroll');
    const calendarElement = page.querySelector('#home-calendar');
    const cardArea = page.querySelector('#home-card-area');

    /* ---- 월 네비게이션 렌더링 ---- */
    if (monthElement) {
      let monthHtml = '';
      for (let m = 1; m <= 12; m++) {
        monthHtml += `<div class="month-item" data-month="${m}">${m}</div>`;
      }
      monthElement.innerHTML = monthHtml;
    }

    /* ---- 캘린더 렌더링 및 이벤트 연결 ---- */
    if (calendarElement) {
      calendarElement.innerHTML = calendarHtml;

      /**
       * scrollActiveCalItemToCenter — 현재 active인 캘린더 아이템을
       * 중앙으로 스크롤
       */
      function scrollActiveCalItemToCenter() {
        const activeItem = calendarElement.querySelector('.cal-item.active');
        if (!activeItem) return;

        const scrollTarget = activeItem.offsetLeft
          - calendarElement.offsetWidth / 2
          + activeItem.offsetWidth / 2;

        calendarElement.scrollTo({ left: scrollTarget, behavior: 'smooth' });
      }

      requestAnimationFrame(() => {
        scrollActiveCalItemToCenter();
      });

      /* 선택되지 않은 월 페이드 처리 및 1일로 점프 */
      function filterByMonth(targetMonth, jumpToFirstDay = true) {
        if (monthElement) {
          monthElement.querySelectorAll('.month-item').forEach(m => m.classList.remove('active'));
          const targetItem = monthElement.querySelector(`.month-item[data-month="${targetMonth}"]`);
          if (targetItem) {
            targetItem.classList.add('active');
            /* 월 스크롤 자체도 중앙 정렬 */
            const scrollTarget = targetItem.offsetLeft - monthElement.offsetWidth / 2 + targetItem.offsetWidth / 2;
            monthElement.scrollTo({ left: scrollTarget, behavior: 'smooth' });
          }
        }

        let firstDayOfTargetMonth = null;
        calendarElement.querySelectorAll('.cal-item').forEach(el => {
          const dt = new Date(el.dataset.date + 'T00:00:00');
          const m = dt.getMonth() + 1;
          if (m === targetMonth) {
            el.classList.remove('faded');
            if (!firstDayOfTargetMonth) firstDayOfTargetMonth = el;
          } else {
            el.classList.add('faded');
          }
        });

        if (jumpToFirstDay && firstDayOfTargetMonth) {
          const scrollTarget = firstDayOfTargetMonth.offsetLeft - calendarElement.offsetWidth / 2 + firstDayOfTargetMonth.offsetWidth / 2;
          calendarElement.scrollTo({ left: scrollTarget, behavior: 'smooth' });
        }
      }

      if (monthElement) {
        monthElement.querySelectorAll('.month-item').forEach(m => {
          m.addEventListener('click', () => {
            const mm = parseInt(m.dataset.month, 10);
            if (!isNaN(mm)) filterByMonth(mm, true);
          });
        });
        
        /* 초기 로드 시 당해 월로 포커싱 (첫째날 점프는 무시하고 오늘 위치 유지) */
        filterByMonth(today.getMonth() + 1, false);
      }

      /* 각 날짜에 클릭 이벤트 추가 */
      calendarElement.querySelectorAll('.cal-item').forEach(item => {
        item.addEventListener('click', (e) => {
          // 튜토리얼 중에는 수동 캘린더 조작 금지 (e.isTrusted를 통해 스와이프로 발생한 프로그램적 강제 클릭은 허용)
          const currentStep = parseInt(localStorage.getItem('swipe_tutorial_step') || '0', 10);
          if (e && e.isTrusted && currentStep < 3) return;

          if (item.classList.contains('active')) return; // 같은 날짜면 무시

          /* 방향 판별 */
          const selectedIsoDate = item.dataset.date;
          const newDate = new Date(selectedIsoDate + 'T00:00:00');
          const direction = newDate > latestPathDate ? 'next' : 'prev';
          latestPathDate = newDate;

          /* UI 업데이트 */
          calendarElement.querySelectorAll('.cal-item').forEach(el => el.classList.remove('active'));
          item.classList.add('active');
          scrollActiveCalItemToCenter();

          // 클릭한 날짜의 소속 월에 맞춰 상단 강조 표시 동기화
          filterByMonth(newDate.getMonth() + 1, false);

          /* 카드 영역 업데이트 (애니메이션 전환) 및 읽음 처리 */
          markAsRead(selectedIsoDate);
          let storyForDate = allStories.find(s => s.publish_date === selectedIsoDate);
          /* 튜토리얼 진행 중 빈 카드 방지: 더미 데이터를 대신 표시 */
          if (tutorialStep < 3 && !storyForDate) {
            storyForDate = DEMO_STORIES[Math.floor(Math.random() * DEMO_STORIES.length)];
          }
          renderCardToArea(cardArea, storyForDate, newDate, direction, bookmarkedIds, advanceTutorial, tutorialStep);
        });
      });
    }

    /* ---- 튜토리얼 상태 머신 (페이지 레벨) ---- */
    let tutorialStep = parseInt(localStorage.getItem('swipe_tutorial_step') || '0', 10);

    function renderTutorialBubble() {
      const existing = page.querySelector('#tutorial-overlay');
      if (existing) existing.remove();

      if (tutorialStep >= 3) return;

      let message = '';
      if (tutorialStep === 0) message = '카드를 탭해서 내용을 확인하세요 👆';
      else if (tutorialStep === 1) message = '좌우로 밀어 다른 날의 일화를 보세요 ↔️';
      else if (tutorialStep === 2) message = '위아래로 밀어 저장하거나 공유하세요 ↕️';

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
    /* 튜토리얼이 아직 끝나지 않았고 오늘 날짜에 스토리가 없으면 더미 데이터 사용 */
    let initialStory = todayStory;
    if (tutorialStep < 3) {
      initialStory = DEMO_STORIES[DEMO_STORIES.length - 1]; // 첫 화면 무조건 더미로!
    }
    markAsRead(todayStr);
    renderCardToArea(cardArea, initialStory, today, null, bookmarkedIds, advanceTutorial, tutorialStep);
    renderTutorialBubble();

  } catch (err) {
    /* 데이터 로딩 실패 시 에러 화면 표시 */
    console.error('홈 데이터 로딩 실패:', err);
    page.innerHTML = `
      <div class="home-header">
        <h1 class="home-title">Day Story</h1>
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
function renderCardToArea(cardArea, story, dateObj, direction = null, bookmarkedIds = [], advanceTutorialFn = null, currentTutorialStep = 3) {
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
          <div class="empty-story-title">이 날의 기록이 없습니다.</div>
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
            <img src="${escapeHtml(story.image_url)}" alt="${escapeHtml(story.figure_name)}" loading="eager" />
            <div class="card-image-title">${escapeHtml(story.figure_name)}</div>
          </div>
        </div>
        <div class="back history-card-back">
          <div class="back-title">${escapeHtml(story.figure_name)}</div>
          <hr class="back-divider" />
          <div class="back-body">
            ${(story.body || '').split('\\n').map(p => p.trim() ? `<p>${escapeHtml(p)}</p>` : '').join('')}
          </div>
          <div class="back-date">${escapeHtml(story.historical_year)}년 ${month}월 ${day}일</div>
        </div>
      </div>
    `;
  }

  /* 3) 초기 로드 (애니메이션 없음) */
  if (!direction || !oldCard) {
    cardArea.innerHTML = '';
    cardArea.appendChild(newCard);
    bindCardEvents(newCard, story, bookmarkedIds, advanceTutorialFn, currentTutorialStep);
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
    bindCardEvents(newCard, story, bookmarkedIds, advanceTutorialFn, currentTutorialStep);
  };

  newCard.addEventListener('transitionend', onAnimationEnd, { once: true });
  /* 혹시 transitionend가 발생하지 않는 네트워크/성능 문제를 대비해 타임아웃 백업 */
  setTimeout(() => {
    if (newCard.classList.contains('card-stack-item')) onAnimationEnd();
  }, 700);
}


/**
 * bindCardEvents — 개별 카드 요소에 필기, 클릭, 스와이프 등 모든 이벤트를 연결합니다
 */
function bindCardEvents(flipContainer, story, bookmarkedIds = [], advanceTutorialFn = null, currentTutorialStep = 3) {
  const flipper = flipContainer.querySelector('.flipper');
  if (!flipper) return;

  /* 상단 액션 버튼 이벤트 */
  const shareBtn = flipContainer.querySelector('.card-action-btn[aria-label="공유"]');
  const bookmarkBtn = flipContainer.querySelector('.card-action-btn[aria-label="북마크"]');

  if (shareBtn) {
    shareBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const tutStep = parseInt(localStorage.getItem('swipe_tutorial_step') || '0', 10);
      if (tutStep < 3) return; // 튜토리얼 중에는 기능 제한
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
      if (tutStep < 3) return; // 튜토리얼 중에는 기능 제한
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

  // 상태 변수 (스와이프 핸들러)
  let touchStartX = 0;
  let touchStartY = 0;
  let isSwiping = false;
  let hapticTriggered = false;
  const SWIPE_THRESHOLD = 80;

  const handleStart = (x, y) => {
    touchStartX = x;
    touchStartY = y;
    isSwiping = false;
    hapticTriggered = false;
    // 터치 시작 시에는 transition을 끄지 않아 CSS의 :active 애니메이션(홀드 축소)이 작동하도록 함
  };

  const handleMove = async (x, y, isTouch = false) => {
    const diffX = x - touchStartX;
    const diffY = y - touchStartY;

    if (Math.abs(diffX) < 5 && Math.abs(diffY) < 5) return; // 미세한 움직임 무시

    const isFlipped = flipper.classList.contains('flipped');
    
    const tutStep = parseInt(localStorage.getItem('swipe_tutorial_step') || '0', 10);
    // 튜토리얼 제한: 지시된 방향 외의 상호작용 차단
    if (tutStep === 0) return;
    if (tutStep === 1 && Math.abs(diffY) > Math.abs(diffX)) return;
    if (tutStep === 2 && Math.abs(diffX) > Math.abs(diffY)) return;

    // 수직 스와이프(상하) 제한: 빈 카드이거나, 뒤집힌 상태면 무시하고 내용 스크롤을 방해하지 않음
    if (Math.abs(diffY) > Math.abs(diffX)) {
      if (!story || isFlipped) return;
    }

    if (!isSwiping) {
      // 실제로 드래그가 시작됐을 때만 transition을 끔
      flipper.style.transition = 'none';
    }
    isSwiping = true;

    // 뒤집혀 있을 때 CSS transform의 rotateY와 자바스크립트 translateY/X 가 충돌하지 않게 병합
    const baseTransform = isFlipped ? 'rotateY(180deg)' : '';

    if (Math.abs(diffY) > Math.abs(diffX)) {
      const moveY = diffY * 0.4;
      flipper.style.transform = `translateY(${moveY}px) ${baseTransform}`;
      if (Math.abs(diffY) > SWIPE_THRESHOLD && !hapticTriggered) {
        hapticTriggered = true;
        try { await Haptics.impact({ style: ImpactStyle.Light }); } catch (err) { }
      }
    }
    else {
      const moveX = diffX * 0.4;
      flipper.style.transform = `translateX(${moveX}px) ${baseTransform}`;
      if (Math.abs(diffX) > SWIPE_THRESHOLD && !hapticTriggered) {
        hapticTriggered = true;
        try { await Haptics.impact({ style: ImpactStyle.Light }); } catch (err) { }
      }
    }
  };

  const handleEnd = async (x, y) => {
    if (!isSwiping) return;

    const diffX = x - touchStartX;
    const diffY = y - touchStartY;

    flipper.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'; // 애니메이션 효과

    const isFlipped = flipper.classList.contains('flipped');

    if (Math.abs(diffY) > SWIPE_THRESHOLD && Math.abs(diffY) > Math.abs(diffX)) {
      if (!story || isFlipped) {
        flipper.style.transform = '';
        setTimeout(() => { flipper.style.transition = ''; isSwiping = false; }, 300);
        return;
      }
      try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch (err) { }
      const tutStep = parseInt(localStorage.getItem('swipe_tutorial_step') || '0', 10);
      const wasInTutorial = tutStep < 3;
      if (typeof advanceTutorialFn === 'function') advanceTutorialFn(2);

      if (wasInTutorial) {
        /* 실제 공유/북마크 기능 방어 후 초기 위치 복구 */
        flipper.style.transform = '';
        setTimeout(() => { flipper.style.transition = ''; isSwiping = false; }, 300);
        
        /* 튜토리얼 종료 안내 센터 팝업 노출 */
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.3s ease;';
        overlay.innerHTML = `
          <div style="background:var(--color-bg-primary);padding:var(--space-6) var(--space-4);border-radius:var(--radius-xl);text-align:center;width:80%;max-width:320px;box-shadow:0 10px 25px rgba(0,0,0,0.5);transform:translateY(20px);transition:transform 0.3s ease;">
            <div style="font-size:3.5rem;margin-bottom:var(--space-2);">🎉</div>
            <h3 style="margin-top:0;margin-bottom:var(--space-2);font-size:var(--text-xl);">튜토리얼 완료!</h3>
            <p style="color:var(--color-text-secondary);font-size:var(--text-md);margin-bottom:var(--space-5);line-height:1.4;word-break:keep-all;">모든 기본 조작법을 익히셨습니다.<br>이제 자유롭게 기록들을 탐색해 보세요!</p>
            <button class="btn btn-primary btn-finish-tut" style="width:100%;border-radius:30px;font-weight:bold;font-size:1.1rem;padding:12px 0;">시작하기</button>
          </div>
        `;
        document.body.appendChild(overlay);
        
        void overlay.offsetWidth; /* 강제 리플로우 */
        overlay.style.opacity = '1';
        overlay.querySelector('div').style.transform = 'translateY(0)';
        
        overlay.querySelector('.btn-finish-tut').addEventListener('click', () => {
          overlay.style.opacity = '0';
          overlay.querySelector('div').style.transform = 'translateY(20px)';
          setTimeout(() => {
            overlay.remove();
            /* 튜토리얼 더미에서 진짜(원래) 데이터로 돌아가기 위해 홈 페이지 새로고침 */
            window.location.reload();
          }, 300);
        });
        
        return; /* 실제 작업(공유/저장) 생략 */
      }

      if (diffY > 0) {
        // 아래로 스와이프: 북마크
        const user = getState('user');
        if (user && user.id === 'guest') {
          showToast('로그인이 필요한 기능입니다.', 'info');
          navigate('/login');
          flipper.style.transform = '';
          return;
        }
        const res = await toggleBookmark(story.id);
        if (res.error) {
          showToast(res.error, 'error');
        } else {
          showToast(res.bookmarked ? '북마크 추가!' : '북마크 해제!', 'success');
          if (bookmarkBtn) {
            bookmarkBtn.querySelector('svg').style.fill = res.bookmarked ? 'currentColor' : 'none';
          }
          if (res.bookmarked && !bookmarkedIds.includes(story.id)) {
            bookmarkedIds.push(story.id);
          } else if (!res.bookmarked) {
            const idx = bookmarkedIds.indexOf(story.id);
            if (idx > -1) bookmarkedIds.splice(idx, 1);
          }
        }
      } else {
        // 위로 스와이프: 공유
        const user = getState('user');
        if (user && user.id === 'guest') {
          showToast('로그인이 필요한 기능입니다.', 'info');
          navigate('/login');
          flipper.style.transform = '';
          return;
        }
        try {
          const shareUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? `https://daystory.app/detail/${story.id}`
            : window.location.href;
          await Share.share({ title: story.figure_name, text: `[DayStory] ${story.figure_name}\n\n${story.summary || ''}`, url: shareUrl });
        } catch (err) { }
      }
    } else if (Math.abs(diffX) > SWIPE_THRESHOLD && Math.abs(diffX) > Math.abs(diffY)) {
      try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch (err) { }
      if (typeof advanceTutorialFn === 'function') advanceTutorialFn(1);

      const calItems = document.querySelectorAll('.cal-item');
      let currentIndex = -1;
      calItems.forEach((item, index) => {
        if (item.classList.contains('active')) currentIndex = index;
      });

      if (diffX < 0 && currentIndex < calItems.length - 1) {
        calItems[currentIndex + 1].click();
      } else if (diffX > 0 && currentIndex > 0) {
        calItems[currentIndex - 1].click();
      }
    }
    // 제자리로 복귀 (인라인 스타일을 지움으로써 CSS 클래스에 맡김)
    flipper.style.transform = '';

    /* 스와이프(카드 날아가기/원복) 애니메이션이 끝날 즈음 transition 초기화 */
    setTimeout(() => {
      flipper.style.transition = '';
      isSwiping = false;
    }, 250);
  };

  // 터치 이벤트
  flipper.addEventListener('touchstart', (e) => {
    handleStart(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  flipper.addEventListener('touchmove', (e) => {
    handleMove(e.touches[0].clientX, e.touches[0].clientY, true);
    if (isSwiping) e.preventDefault();
  }, { passive: false });

  flipper.addEventListener('touchend', (e) => {
    handleEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  });

  // 마우스 이벤트 (데스크톱 드래그 대응)
  let isMouseDown = false;
  flipper.addEventListener('mousedown', (e) => {
    if (e.target.closest('.back-body') || e.target.closest('.card-action-btn')) return;
    isMouseDown = true;
    handleStart(e.clientX, e.clientY);
  });

  window.addEventListener('mousemove', (e) => {
    if (!isMouseDown) return;
    handleMove(e.clientX, e.clientY);
  });

  window.addEventListener('mouseup', (e) => {
    if (!isMouseDown) return;
    isMouseDown = false;
    handleEnd(e.clientX, e.clientY);
  });

  // 일반 클릭: 뒤집기
  flipper.addEventListener('click', (e) => {
    const tutStep = parseInt(localStorage.getItem('swipe_tutorial_step') || '0', 10);
    if (tutStep > 0 && tutStep < 3) return; // 튜토리얼 단계가 1, 2일 때 탭 조작 금지
    if (!story) return; // 기록 없는 카드 탭 무시
    if (e.target.closest('.back-body') || e.target.closest('.card-action-btn')) return;
    if (isSwiping) return; // 스와이프 처리 중이면 탭 무시
    
    flipper.classList.toggle('flipped');
    
    /* 튜토리얼: 탭 완료 처리 */
    if (typeof advanceTutorialFn === 'function') advanceTutorialFn(0);
  });
}
