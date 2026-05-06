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
import { markLetterRead, markLetterUnread } from '../services/widget.js';
import { preloadStoryImages } from '../utils/imageLoading.js';

const DETAIL_BUTTON_LABEL = '상세 보기';
const EDITOR_COMMENT_SEEN_PREFIX = 'daystory:editor-comment-seen:';
const DAILY_LETTER_OPENED_PREFIX = 'daystory:daily-letter-opened:';

/* 스와이프 commit 가드 — bindCardEvents가 카드 재렌더로 다시 호출돼도
   직전 swipe 후 짧은 시간 내 두 번째 commit이 발생하지 않도록 모듈 스코프에 둔다 (세션 1 #2). */
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

function getDailyLetterOpenedKey(story) {
  return story?.id ? `${DAILY_LETTER_OPENED_PREFIX}${story.id}` : '';
}

function hasOpenedDailyLetter(story) {
  const key = getDailyLetterOpenedKey(story);
  return key ? localStorage.getItem(key) === 'true' : true;
}

function markDailyLetterOpened(story) {
  const key = getDailyLetterOpenedKey(story);
  if (key) localStorage.setItem(key, 'true');
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
  /* 새 페이지 진입 시 swipe commit 가드 리셋 — 이전 세션 잔여 상태가 첫 swipe를 막지 않도록. */
  lastSwipeCommitAt = 0;
  try {
    /* 서버에서 데이터 가져오기 */
    const [allStories, todayStory, bookmarkedIds] = await Promise.all([
      fetchStories(),
      fetchTodayStory(),
      getBookmarkedStoryIds()
    ]);

    const todayStr = todayStory.publish_date;
    const today = new Date(todayStr + 'T00:00:00');
    let latestPathDate = today;
    preloadStoryImages([todayStory, ...allStories], 5);

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

      function markActiveDateTourTarget(activeDay) {
        calendarElement.querySelectorAll('[data-tour-target="editor-date-active"]').forEach(el => {
          delete el.dataset.tourTarget;
        });
        if (activeDay) activeDay.dataset.tourTarget = 'editor-date-active';
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

        markActiveDateTourTarget(activeDay);

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
          preloadStoryImages([storyForDate], 1);
          const direction = newDate > latestPathDate ? 'next' : 'prev';
          latestPathDate = newDate;

          renderCardToArea(cardArea, storyForDate || null, newDate, direction, bookmarkedIds);
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
          markActiveDateTourTarget(targetDayItem);
        }
      }, 0);
    }

    /* ---- 튜토리얼 (최초 실행 시에만) ---- */
    const tutDone = localStorage.getItem('tutorial_done') === 'true';
    const startTutorial = () => {
      if (tutDone) return;
      setTimeout(() => showTutorial(page), 500);
    };

    /* ---- 오늘의 카드 초기 렌더링 ---- */
    if (!hasOpenedDailyLetter(todayStory)) {
      void markLetterUnread();
      renderDailyLetterGate(cardArea, todayStory, today, bookmarkedIds, startTutorial);
    } else {
      void markLetterRead();
      renderCardToArea(cardArea, todayStory, today, null, bookmarkedIds);
      startTutorial();
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
   섹션 2-1: 새 튜토리얼 패널
   ─────────────────────────────────────────────
   최초 실행 시 하단에서 슬라이드업되는 3단계 안내 패널입니다.
   실제 오늘의 카드 위에서 작동하며, 카드 기능을 막지 않습니다.
*/
function showTutorial(page) {
  /* 이미 패널이 있으면 중복 생성 방지 */
  if (document.getElementById('tutorial-panel')) return;

  const STEPS = [
    {
      title: '카드를 탭해보세요',
      desc: '카드를 탭하면 오늘 날짜의 역사 일화로 뒷면이 펼쳐집니다.',
      target: '#editorstory-card-area .flip-container',
      autoEvent: 'ds:card-flipped',
    },
    {
      title: '상세 보기로 더 깊이',
      desc: '뒷면 우측의 "상세 보기" 버튼을 누르면 카드의 모든 내용을 한 화면에서 자세히 읽을 수 있어요.',
      target: '.card-detail-shortcut-btn',
      requireFlipped: true,
    },
    {
      title: '에디터 한마디',
      desc: '에디터 프로필 배지를 탭하면 오늘의 카드에 담긴 짧은 한마디가 떠올라요. 다시 탭하거나 바깥을 탭하면 닫힙니다.',
      target: '.back-editor-btn',
      requireFlipped: true,
      skipIfHidden: true,
      demo: 'editor-bubble',
    },
    {
      title: '날짜를 바꿔보세요',
      desc: '위의 숫자를 스크롤하거나 탭하면 다른 날의 이야기를 탐색할 수 있습니다.',
      target: '.wheel-pickers-container',
    },
    {
      title: '나의 일화를 남겨보세요',
      desc: '하단의 책 모양 탭을 누르면 오늘의 기억을 직접 기록할 수 있어요.',
      target: '#nav-mystory',
    },
  ];

  let step = 0;
  let autoListener = null;
  let autoAdvanceTimer = null;
  let demoTimer = null;
  let repositionListener = null;

  /* 카드를 강제로 뒷면으로 뒤집어 두는 헬퍼 — 실제로 뒤집은 경우 true 반환 */
  function ensureCardFlipped() {
    const flipper = document.querySelector('#editorstory-card-area .flipper');
    if (!flipper) return false;
    if (flipper.classList.contains('flipped')) return false;
    flipper.classList.add('flipped');
    document.dispatchEvent(new CustomEvent('ds:card-flipped'));
    return true;
  }

  /* 데모용 상호작용을 정리(예: 열린 말풍선 닫기) */
  function clearDemoState() {
    if (demoTimer) {
      clearTimeout(demoTimer);
      demoTimer = null;
    }
    document.querySelectorAll('.editor-comment-bubble').forEach(b => b.remove());
  }

  /* 대상 요소를 뷰포트 중앙으로 부드럽게 스크롤 */
  function focusTarget(selector) {
    if (!selector) return;
    const el = document.querySelector(selector);
    if (!el || typeof el.scrollIntoView !== 'function') return;
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    } catch {
      try { el.scrollIntoView(); } catch { /* noop */ }
    }
  }

  /* 단계별 데모 상호작용 자동 실행 */
  function runDemo(s) {
    if (!s || !s.demo) return;
    if (s.demo === 'editor-bubble') {
      demoTimer = setTimeout(() => {
        const editorBtn = document.querySelector('.back-editor-btn');
        if (!editorBtn) return;
        const style = window.getComputedStyle(editorBtn);
        if (style.visibility === 'hidden') return;
        editorBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }, 650);
    }
  }

  function isStepDisplayable(s) {
    if (!s) return false;
    if (!s.skipIfHidden) return true;
    const el = document.querySelector(s.target);
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    if (el.offsetParent === null && style.position !== 'fixed') return false;
    return true;
  }

  const panel = document.createElement('div');
  panel.id = 'tutorial-panel';
  panel.className = 'tutorial-panel';

  function clearHighlights() {
    document.querySelectorAll('.tut-highlight').forEach(el => el.classList.remove('tut-highlight'));
  }

  function applyHighlight(selector) {
    clearHighlights();
    if (!selector) return;
    const el = document.querySelector(selector);
    if (el) el.classList.add('tut-highlight');
  }

  /* 툴팁(말풍선)을 하이라이트 대상 옆으로 자동 배치 */
  function positionTip() {
    const s = STEPS[step];
    if (!s || !s.target) return;
    const target = document.querySelector(s.target);
    if (!target || typeof target.getBoundingClientRect !== 'function') return;

    const rect = target.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const margin = 12;
    const arrowGap = 16;
    const tipWidth = panel.offsetWidth || 320;
    const tipHeight = panel.offsetHeight || 180;

    /* 1) 세로 배치 — 아래쪽 우선, 공간 부족 시 위쪽 */
    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;
    let placement;
    let top;
    if (spaceBelow >= tipHeight + arrowGap + margin || spaceBelow >= spaceAbove) {
      placement = 'bottom';
      top = rect.bottom + arrowGap;
    } else {
      placement = 'top';
      top = rect.top - tipHeight - arrowGap;
    }
    top = Math.max(margin, Math.min(top, vh - tipHeight - margin));

    /* 2) 가로 배치 — 대상 중심에 정렬, 뷰포트 안으로 클램프 */
    const targetCenterX = rect.left + rect.width / 2;
    let left = targetCenterX - tipWidth / 2;
    left = Math.max(margin, Math.min(left, vw - tipWidth - margin));

    /* 3) 화살표가 대상 중심을 가리키도록 위치 조정 */
    const arrowLeft = Math.max(20, Math.min(tipWidth - 20, targetCenterX - left));

    panel.style.top = top + 'px';
    panel.style.left = left + 'px';
    panel.dataset.placement = placement;
    panel.style.setProperty('--tut-arrow-left', arrowLeft + 'px');
  }

  function render() {
    const s = STEPS[step];
    const isLast = step === STEPS.length - 1;

    /* 이전 단계의 데모 상태 정리 */
    clearDemoState();

    /* 큐에 남아있던 자동 진행 타이머 / 리스너를 먼저 제거 — 그래야 ensureCardFlipped가
       발생시키는 ds:card-flipped 이벤트가 step 0 리스너를 다시 발화시키지 않습니다. */
    if (autoListener) {
      document.removeEventListener('ds:card-flipped', autoListener);
      autoListener = null;
    }
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = null;
    }

    /* 카드 뒷면이 필요한 단계면 자동으로 뒤집기 (실제로 뒤집힌 경우만 settle을 지연) */
    const flipJustHappened = s.requireFlipped ? ensureCardFlipped() : false;

    panel.innerHTML = `
      <div class="tutorial-panel-inner">
        <div class="tutorial-progress">
          ${STEPS.map((_, i) =>
            `<span class="tutorial-dot ${i < step ? 'done' : i === step ? 'active' : ''}"></span>`
          ).join('')}
        </div>
        <div class="tutorial-title">${s.title}</div>
        <div class="tutorial-desc">${s.desc}</div>
        <div class="tutorial-actions">
          <button class="tutorial-skip" id="tut-skip">건너뛰기</button>
          <div class="tutorial-actions-right">
            <button class="tutorial-prev" id="tut-prev" ${step === 0 ? 'disabled aria-hidden="true"' : ''}>이전</button>
            <button class="tutorial-next" id="tut-next">${isLast ? '시작하기' : '다음'}</button>
          </div>
        </div>
      </div>
    `;

    /* 새 패널 콘텐츠가 그려진 직후 한 번 위치 잡기 */
    requestAnimationFrame(positionTip);

    /* 카드 플립이 방금 실행된 경우에만 트랜지션 종료를 기다린 뒤 하이라이트/스크롤 */
    const settle = () => {
      applyHighlight(s.target);
      focusTarget(s.target);
      requestAnimationFrame(positionTip);
      runDemo(s);
    };
    if (flipJustHappened) {
      setTimeout(settle, 420);
    } else {
      settle();
    }

    /* Step 0: 카드 탭 시 자동으로 다음 단계 이동 */
    if (s.autoEvent) {
      const stepWhenRegistered = step;
      autoListener = () => {
        document.removeEventListener('ds:card-flipped', autoListener);
        autoListener = null;
        autoAdvanceTimer = setTimeout(() => {
          autoAdvanceTimer = null;
          /* 사용자가 그 사이 수동으로 다음/이전을 눌러 단계가 바뀌었으면 진행하지 않음 */
          if (step === stepWhenRegistered) advance();
        }, 600);
      };
      document.addEventListener('ds:card-flipped', autoListener, { once: true });
    }

    panel.querySelector('#tut-next').addEventListener('click', advance);
    panel.querySelector('#tut-skip').addEventListener('click', finish);
    const prevBtn = panel.querySelector('#tut-prev');
    if (prevBtn && step > 0) prevBtn.addEventListener('click', goBack);
  }

  function advance() {
    let next = step + 1;
    /* 표시할 수 없는 단계(예: 에디터 한마디가 없는 경우)는 건너뜀 */
    while (next < STEPS.length && !isStepDisplayable(STEPS[next])) next += 1;
    if (next >= STEPS.length) {
      finish();
      return;
    }
    step = next;
    render();
  }

  function goBack() {
    let prev = step - 1;
    while (prev > 0 && !isStepDisplayable(STEPS[prev])) prev -= 1;
    if (prev < 0) prev = 0;
    step = prev;
    render();
  }

  function finish() {
    localStorage.setItem('tutorial_done', 'true');
    clearHighlights();
    clearDemoState();
    if (autoListener) {
      document.removeEventListener('ds:card-flipped', autoListener);
      autoListener = null;
    }
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = null;
    }
    if (repositionListener) {
      window.removeEventListener('scroll', repositionListener, true);
      window.removeEventListener('resize', repositionListener);
      repositionListener = null;
    }
    panel.classList.remove('visible');
    setTimeout(() => panel.remove(), 320);
  }

  /* 패널 마운트 및 페이드+스케일 인 애니메이션. body에 직접 붙여 어떤 컨테이너의
     overflow / transform 영향도 받지 않도록 함. */
  document.body.appendChild(panel);
  render();

  /* 스크롤·리사이즈 시 툴팁이 대상을 따라가도록 추적 */
  repositionListener = () => positionTip();
  window.addEventListener('scroll', repositionListener, { capture: true, passive: true });
  window.addEventListener('resize', repositionListener);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      panel.classList.add('visible');
    });
  });
}

function renderDailyLetterGate(cardArea, story, dateObj, bookmarkedIds, onOpen) {
  if (!cardArea || !story) return;

  const month = dateObj.getMonth() + 1;
  const day = dateObj.getDate();
  const letter = document.createElement('button');
  letter.type = 'button';
  letter.className = 'daily-letter-gate';
  letter.dataset.tourTarget = 'today-letter';
  letter.setAttribute('aria-label', '오늘의 편지 열기');
  letter.innerHTML = `
    <span class="daily-letter-postcard" aria-hidden="true">
      <span class="daily-letter-stamp">DayStory</span>
      <span class="daily-letter-postmark">${month}. ${day}</span>
      <span class="daily-letter-title">오늘의 편지</span>
      <span class="daily-letter-lines">
        <span></span>
        <span></span>
        <span></span>
      </span>
    </span>
  `;

  letter.addEventListener('click', () => {
    markDailyLetterOpened(story);
    void markLetterRead();
    renderCardToArea(cardArea, story, dateObj, null, bookmarkedIds);
    if (typeof onOpen === 'function') onOpen();
  });

  cardArea.innerHTML = '';
  cardArea.appendChild(letter);
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
  preloadStoryImages([story], 1);

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
  newCard.dataset.tourTarget = 'today-card';
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
            <img src="${escapeHtml(story.image_url)}" alt="${escapeHtml(story.figure_name)}" loading="eager" decoding="async" fetchpriority="high" width="1200" height="1500" draggable="false" />
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
  let isBackBodyScroll = false;
  let lastTouchInputAt = 0;
  const SWIPE_THRESHOLD = 80;
  const SYNTHETIC_MOUSE_IGNORE_MS = 650;

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
      if (isBackBodyScroll) {
        flipper.style.transform = '';
        setTimeout(() => { flipper.style.transition = ''; flipper.classList.remove('is-flipping'); isSwiping = false; isAnimating = false; }, 250);
        return;
      }
      /* 세션 1 #2: 카드 재렌더 후 짧은 시간 내 두 번째 commit 차단 (한 번 swipe 로 두 칸 이동 방지) */
      if (Date.now() - lastSwipeCommitAt >= SWIPE_COMMIT_GUARD_MS) {
        lastSwipeCommitAt = Date.now();
        try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch (err) { }

        const offset = diffX < 0 ? 1 : -1;
        const dayWrapper = document.getElementById('editorstory-calendar');
        const monthWrapper = document.getElementById('editorstory-month-scroll');
        if (dayWrapper) {
          const items = Array.from(dayWrapper.querySelectorAll('.wheel-item'));
          const activeIdx = items.findIndex(el => el.classList.contains('active'));
          const candidate = items[activeIdx + offset];

          if (candidate && !candidate.classList.contains('disabled')) {
            candidate.click();
          } else if (monthWrapper) {
            /* Task #2: 같은 달 안에서 인접 날짜가 없거나 disabled → 월을 자동 전환.
               5월 1일에서 뒤로 가면 4월 30일로, 4월 30일에서 앞으로 가면 5월 1일로. */
            const monthItems = Array.from(monthWrapper.querySelectorAll('.wheel-item'));
            const activeMonthIdx = monthItems.findIndex(el => el.classList.contains('active'));
            const targetMonthItem = monthItems[activeMonthIdx + offset];
            if (targetMonthItem && !targetMonthItem.classList.contains('disabled')) {
              targetMonthItem.click();
              /* 월이 바뀌면 day wheel 의 active 가 자동 정규화되지만,
                 마지막 날 / 첫 날을 명시적으로 한 번 더 선택해 카드를 재로드한다. */
              setTimeout(() => {
                const refreshedItems = Array.from(dayWrapper.querySelectorAll('.wheel-item:not(.disabled)'));
                if (!refreshedItems.length) return;
                const target = offset > 0 ? refreshedItems[0] : refreshedItems[refreshedItems.length - 1];
                if (target && !target.classList.contains('active')) target.click();
              }, 30);
            }
          }
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
