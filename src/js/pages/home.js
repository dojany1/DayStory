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

    /* ---- 캘린더 날짜 생성 ---- */
    const todayStr = todayStory.publish_date;               /* '2026-03-30' 형식 */
    const today = new Date(todayStr + 'T00:00:00');         /* Date 객체로 변환 */
    const calendarDates = [];

    /* 과거 30일 전부터 오늘까지, 총 31개의 날짜 생성 */
    for (let i = 30; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      calendarDates.push(date);
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

      return `
        <div class="cal-item ${isToday ? 'active' : ''}" data-date="${isoDate}">
          <div class="cal-day">${weekDays[date.getDay()]}</div>
          <div class="cal-date">${date.getDate()}</div>
        </div>
      `;
    }).join('');

    /* ---- DOM 요소 참조 가져오기 ---- */
    const calendarElement = page.querySelector('#home-calendar');
    const cardArea = page.querySelector('#home-card-area');

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

      /* 각 날짜에 클릭 이벤트 추가 */
      calendarElement.querySelectorAll('.cal-item').forEach(item => {
        item.addEventListener('click', () => {
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

          /* 카드 영역 업데이트 (애니메이션 전환) */
          const storyForDate = allStories.find(s => s.publish_date === selectedIsoDate);
          renderCardToArea(cardArea, storyForDate, newDate, direction, bookmarkedIds);
        });
      });
    }

    /* ---- 오늘의 카드 초기 렌더링 (방향 없이 즉시) ---- */
    renderCardToArea(cardArea, todayStory, today, null, bookmarkedIds);

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
function renderCardToArea(cardArea, story, dateObj, direction = null, bookmarkedIds = []) {
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
  }, 700);
}


/**
 * bindCardEvents — 개별 카드 요소에 필기, 클릭, 스와이프 등 모든 이벤트를 연결합니다
 */
function bindCardEvents(flipContainer, story, bookmarkedIds = []) {
  const flipper = flipContainer.querySelector('.flipper');
  if (!flipper) return;

  /* 상단 액션 버튼 이벤트 */
  const shareBtn = flipContainer.querySelector('.card-action-btn[aria-label="공유"]');
  const bookmarkBtn = flipContainer.querySelector('.card-action-btn[aria-label="북마크"]');

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
    if (flipper.classList.contains('flipped')) return; // 이미 뒤집혀 있으면 스와이프 방지 (텍스트 드래그 방해)
    touchStartX = x;
    touchStartY = y;
    isSwiping = false;
    hapticTriggered = false;
    // 터치 시작 시에는 transition을 끄지 않아 CSS의 :active 애니메이션(홀드 축소)이 작동하도록 함
  };

  const handleMove = async (x, y, isTouch = false) => {
    if (flipper.classList.contains('flipped')) return;
    const diffX = x - touchStartX;
    const diffY = y - touchStartY;

    if (Math.abs(diffX) < 5 && Math.abs(diffY) < 5) return; // 미세한 움직임 무시

    if (!isSwiping) {
      // 실제로 드래그가 시작됐을 때만 transition을 끔
      flipper.style.transition = 'none';
    }
    isSwiping = true;

    if (Math.abs(diffY) > Math.abs(diffX)) {
      const moveY = diffY * 0.4;
      flipper.style.transform = `translateY(${moveY}px)`;
      if (Math.abs(diffY) > SWIPE_THRESHOLD && !hapticTriggered) {
        hapticTriggered = true;
        try { await Haptics.impact({ style: ImpactStyle.Light }); } catch (err) { }
      }
    }
    else {
      const moveX = diffX * 0.4;
      flipper.style.transform = `translateX(${moveX}px)`;
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

    if (Math.abs(diffY) > SWIPE_THRESHOLD && Math.abs(diffY) > Math.abs(diffX)) {
      try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch (err) { }

      if (diffY > 0) {
        // 아래로 스와이프: 북마크
        if (!story) {
          flipper.style.transform = '';
          return;
        }
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
        if (!story) {
          flipper.style.transform = '';
          return;
        }
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
    }, 410);
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
  let isFlipping = false;
  flipper.addEventListener('click', (e) => {
    if (e.target.closest('.back-body') || e.target.closest('.card-action-btn')) return;
    if (isSwiping || isFlipping) return;
    
    isFlipping = true;
    flipper.classList.toggle('flipped');
    
    setTimeout(() => {
      isFlipping = false;
    }, 800); // components.css의 transition 시간과 맞춤
  });

  // 스와이프 튜토리얼 (최초 1회)
  if (!localStorage.getItem('swipe_tutorial_seen')) {
    const tutorialHtml = `
      <div class="tutorial-overlay" id="swipe-tutorial">
        <div class="tutorial-cross">
          <div class="t-up">Share</div>
          <div class="t-mid">
            <div class="t-left">Next</div>
            <div class="t-center"></div>
            <div class="t-right">Prev</div>
          </div>
          <div class="t-down">Bookmark</div>
        </div>
      </div>
    `;
    const currentCardArea = document.getElementById('home-card-area');
    if (currentCardArea) {
      currentCardArea.insertAdjacentHTML('beforeend', tutorialHtml);
    }
    const tutEl = document.getElementById('swipe-tutorial');
    tutEl.addEventListener('click', (e) => {
      e.stopPropagation();
      tutEl.style.opacity = '0';
      setTimeout(() => tutEl.remove(), 300);
      localStorage.setItem('swipe_tutorial_seen', 'true');
    });
  }
}
