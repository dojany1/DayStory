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
   ===================================================================== */

import { fetchStories, fetchTodayStory } from '../services/stories.js';
import { toggleBookmark } from '../services/bookmarks.js';
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
      <h1 class="home-title">Day Story</h1>
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
    /* 서버에서 데이터 가져오기 (병렬 실행) */
    const allStories = await fetchStories();       /* 전체 일화 목록 */
    const todayStory = await fetchTodayStory();    /* 오늘의 일화 */

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

    /* 캘린더 HTML 생성 */
    const calendarHtml = calendarDates.map(date => {
      const isToday = date.getTime() === today.getTime();
      const isoDate = date.toISOString().split('T')[0];  /* '2026-03-30' 형식 */

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

      /* 캘린더를 오른쪽 끝으로 스크롤 (오늘 날짜가 보이도록) */
      calendarElement.scrollLeft = calendarElement.scrollWidth;

      /* 각 날짜에 클릭 이벤트 추가 */
      calendarElement.querySelectorAll('.cal-item').forEach(item => {
        item.addEventListener('click', () => {
          /* 모든 날짜에서 active 클래스 제거 */
          calendarElement.querySelectorAll('.cal-item').forEach(el => {
            el.classList.remove('active');
          });

          /* 클릭한 날짜만 active로 설정 */
          item.classList.add('active');

          /* 해당 날짜의 스토리 찾기 */
          const selectedDate = item.dataset.date;
          const storyForDate = allStories.find(s => s.publish_date === selectedDate);

          /* 카드 영역 업데이트 */
          renderCardToArea(cardArea, storyForDate, new Date(selectedDate + 'T00:00:00'));
        });
      });
    }

    /* ---- 오늘의 카드 초기 렌더링 ---- */
    renderCardToArea(cardArea, todayStory, today);

  } catch (err) {
    /* 데이터 로딩 실패 시 에러 화면 표시 */
    console.error('홈 데이터 로딩 실패:', err);
    page.innerHTML = `
      <div class="home-header">
        <h1 class="home-title">Day Story</h1>
      </div>
      <div class="empty-state">
        <div class="empty-state-title">데이터를 불러오지 못했습니다</div>
        <div class="empty-state-desc">네트워크를 확인하고 다시 시도해주세요</div>
        <button class="btn btn-primary" onclick="location.reload()" style="margin-top:var(--space-4)">
          새로고침
        </button>
      </div>
    `;
  }
}


/* ─────────────────────────────────────────────
   섹션 3: 카드 렌더링 함수
   ───────────────────────────────────────────── */

/**
 * renderCardToArea — 주어진 스토리 데이터로 3D 플립 카드를 그립니다
 * @param {HTMLElement} cardArea - 카드를 넣을 컨테이너 DOM 요소
 * @param {Object|null} story   - 표시할 스토리 데이터 (없으면 null)
 * @param {Date}        dateObj - 표시할 날짜의 Date 객체
 * 
 * 카드 구조:
 *   ┌─────────────────────┐
 *   │ 앞면 (front)         │  → 연도, 날짜, 인물 이미지
 *   │                     │
 *   │ [이미지]             │
 *   │ 인물 이름            │
 *   └─────────────────────┘
 *         ↕ 클릭하면 뒤집힘
 *   ┌─────────────────────┐
 *   │ 뒷면 (back)          │  → 인물 이름, 일화 본문
 *   │                     │
 *   │ [텍스트 스크롤 가능]  │
 *   │ 날짜                 │
 *   └─────────────────────┘
 */
function renderCardToArea(cardArea, story, dateObj) {
  if (!cardArea) return;

  /* 해당 날짜에 스토리가 없는 경우 */
  if (!story) {
    cardArea.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">해당 날짜의 일화가 없습니다</div>
      </div>
    `;
    return;
  }

  /* 날짜 정보 추출 */
  const pubDate = new Date(story.publish_date);
  const month = pubDate.getMonth() + 1;     /* 월 (1~12) */
  const day = pubDate.getDate();             /* 일 (1~31) */
  const displayYear = dateObj.getFullYear(); /* 표시용 연도 */

  /* 카드 HTML 생성 */
  const cardHtml = `
    <div class="flip-container" id="main-flip-card">
      <div class="flipper">
        
        <!-- ===== 앞면: 이미지 카드 (리디자인) ===== -->
        <div class="front history-card-front">
          <div class="history-card-top">
            <div class="card-top-left">
              <div class="card-year">${escapeHtml(story.historical_year)}</div>
              <div class="card-date">${month}. ${day}</div>
            </div>
            <div class="card-top-right">
              <div class="card-actions">
                <button class="card-action-btn" aria-label="공유">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="18" cy="5" r="3"></circle>
                    <circle cx="6" cy="12" r="3"></circle>
                    <circle cx="18" cy="19" r="3"></circle>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                  </svg>
                </button>
                <button class="card-action-btn" aria-label="북마크">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
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
          </div>
        </div>
        
        <!-- ===== 뒷면: 텍스트 카드 ===== -->
        <div class="back history-card-back">
          <div class="back-title">${escapeHtml(story.figure_name)}</div>
          <hr class="back-divider" />
          <div class="back-body">
            ${(story.body || '').split('\\n').map(p => p.trim() ? `<p>${escapeHtml(p)}</p>` : '').join('')}
          </div>
          <div class="back-date">${escapeHtml(story.historical_year)}년 ${month}월 ${day}일</div>
        </div>
        
      </div>
    </div>
  `;

  /* 카드를 화면에 삽입 */
  cardArea.innerHTML = cardHtml;

  /* 스와이프 제스처 및 클릭 이벤트 등록 */
  const flipper = cardArea.querySelector('.flipper');
  const flipContainer = cardArea.querySelector('.flip-container');

  /* 상단 액션 버튼 (공유 / 북마크) 이벤트 등록 */
  const shareBtn = cardArea.querySelector('.card-action-btn[aria-label="공유"]');
  const bookmarkBtn = cardArea.querySelector('.card-action-btn[aria-label="북마크"]');

  if (shareBtn) {
    shareBtn.addEventListener('click', async (e) => {
      e.stopPropagation(); // 카드 뒤집기 방지
      try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch(err) {}
      try {
        await Share.share({ title: story.figure_name, text: story.summary, url: window.location.href });
      } catch(err) {}
    });
  }

  if (bookmarkBtn) {
    bookmarkBtn.addEventListener('click', async (e) => {
      e.stopPropagation(); // 카드 뒤집기 방지

      const user = getState('user');
      if (user && user.id === 'guest') {
        showToast('로그인이 필요한 기능입니다.', 'info');
        navigate('/login');
        return;
      }

      try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch(err) {}
      const res = await toggleBookmark(story.id);
      if (res.error) {
        showToast(res.error, 'error');
        return;
      }
      showToast(res.bookmarked ? '북마크에 추가되었습니다.' : '북마크가 해제되었습니다.', 'success');
      
      // 디자인 피드백: 북마크 상태에 따라 아이콘 꽉 찬 색상으로 변경
      if (res.bookmarked) {
        bookmarkBtn.querySelector('svg').style.fill = 'currentColor';
      } else {
        bookmarkBtn.querySelector('svg').style.fill = 'none';
      }
    });
  }
  
  // 상태 변수
  let touchStartX = 0;
  let touchStartY = 0;
  let isSwiping = false;
  let hapticTriggered = false;
  const SWIPE_THRESHOLD = 80;

  flipper.addEventListener('touchstart', (e) => {
    // 뒷면 전체에서 스와이프 차단 (텍스트 스크롤 시 오작동 방지)
    if (e.target.closest('.back')) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isSwiping = false;
    hapticTriggered = false;
    flipper.style.transition = 'none'; // 당길 때 즉각 반응하도록
  }, { passive: true });

  flipper.addEventListener('touchmove', async (e) => {
    if (e.target.closest('.back')) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - touchStartX;
    const diffY = currentY - touchStartY;
    
    // Y축 이동이 더 클 경우 위/아래 (공유/북마크)
    if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 10) {
      isSwiping = true;
      e.preventDefault(); // 기본 스크롤 방지
      // 탄성 효과 (움직임을 조금 줄임)
      const moveY = diffY * 0.4;
      flipper.style.transform = `translateY(${moveY}px) ${flipper.classList.contains('flipped') ? 'rotateY(180deg)' : ''}`;
      
      // 임계점 돌파 시 가벼운 진동 (한 번만)
      if (Math.abs(diffY) > SWIPE_THRESHOLD && !hapticTriggered) {
        hapticTriggered = true;
        try { await Haptics.impact({ style: ImpactStyle.Light }); } catch(err) {}
      } else if (Math.abs(diffY) <= SWIPE_THRESHOLD && hapticTriggered) {
        hapticTriggered = false; // 되돌아오면 진동 리셋
      }
    } 
    // X축 이동 (좌우 카드 넘기기)
    else if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 10) {
      isSwiping = true;
      e.preventDefault();
      const moveX = diffX * 0.4;
      flipper.style.transform = `translateX(${moveX}px) ${flipper.classList.contains('flipped') ? 'rotateY(180deg)' : ''}`;
      
      if (Math.abs(diffX) > SWIPE_THRESHOLD && !hapticTriggered) {
        hapticTriggered = true;
        try { await Haptics.impact({ style: ImpactStyle.Light }); } catch(err) {}
      } else if (Math.abs(diffX) <= SWIPE_THRESHOLD && hapticTriggered) {
        hapticTriggered = false;
      }
    }
  }, { passive: false });

  flipper.addEventListener('touchend', async (e) => {
    if (e.target.closest('.back')) return;
    const currentX = e.changedTouches[0].clientX;
    const currentY = e.changedTouches[0].clientY;
    const diffX = currentX - touchStartX;
    const diffY = currentY - touchStartY;

    flipper.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    
    if (isSwiping) {
      if (Math.abs(diffY) > SWIPE_THRESHOLD && Math.abs(diffY) > Math.abs(diffX)) {
        // 성공 진동
        try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch(err) {}
        
        if (diffY > 0) {
          // 아래로 스와이프: 북마크
          const user = getState('user');
          if (user && user.id === 'guest') {
            showToast('로그인이 필요한 기능입니다.', 'info');
            navigate('/login');
            // 제자리 복귀
            flipper.style.transform = flipper.classList.contains('flipped') ? 'rotateY(180deg)' : '';
            return;
          }

          const res = await toggleBookmark(story.id);
          if (res.error) {
            showToast(res.error, 'error');
            return;
          }
          showToast(res.bookmarked ? '북마크에 추가되었습니다.' : '북마크가 해제되었습니다.', 'success');
        } else {
          // 위로 스와이프: 공유
          try {
            await Share.share({ title: story.figure_name, text: story.summary, url: window.location.href });
          } catch(err) {}
        }
      } else if (Math.abs(diffX) > SWIPE_THRESHOLD && Math.abs(diffX) > Math.abs(diffY)) {
        try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch(err) {}
        
        // 좌우 스와이프: 날짜 전환
        const calItems = document.querySelectorAll('.cal-item');
        let currentIndex = -1;
        calItems.forEach((item, index) => {
          if (item.classList.contains('active')) currentIndex = index;
        });

        if (diffX < 0 && currentIndex < calItems.length - 1) {
          // 외쪽 이동 (다음 날짜)
          calItems[currentIndex + 1].click();
        } else if (diffX > 0 && currentIndex > 0) {
          // 오른쪽 이동 (이전 날짜)
          calItems[currentIndex - 1].click();
        }
      }
      // 제자리로 복귀
      flipper.style.transform = flipper.classList.contains('flipped') ? 'rotateY(180deg)' : '';
    } else {
      // 일반 클릭: 뒤집기
      if (Math.abs(diffX) < 10 && Math.abs(diffY) < 10) {
        flipper.classList.toggle('flipped');
        flipper.style.transform = flipper.classList.contains('flipped') ? 'rotateY(180deg)' : '';
      }
    }
  });

  // 데스크톱용 일반 클릭 지원 (touch가 안 먹는 경우)
  flipper.addEventListener('click', (e) => {
    if (e.target.closest('.back-body')) return;
    // 터치 이벤트로 발생한 클릭은 무시
    if (isSwiping) return;
    flipper.classList.toggle('flipped');
    flipper.style.transform = flipper.classList.contains('flipped') ? 'rotateY(180deg)' : '';
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
    cardArea.insertAdjacentHTML('beforeend', tutorialHtml);
    const tutEl = document.getElementById('swipe-tutorial');
    tutEl.addEventListener('click', (e) => {
      e.stopPropagation();
      tutEl.style.opacity = '0';
      setTimeout(() => tutEl.remove(), 300);
      localStorage.setItem('swipe_tutorial_seen', 'true');
    });
  }
}
