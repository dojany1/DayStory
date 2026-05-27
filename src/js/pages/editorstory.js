/* =====================================================================
   editorstory.js — 에디터 일화 페이지 (메인 화면)
   =====================================================================
   상단 월/일 휠로 날짜를 선택해 해당 날짜의 카드를 표시합니다.
   - 첫 진입 시 카드가 위에서 슬라이딩하며 등장
   - 오늘 카드를 처음 클릭(=뒤집기) 하면 자동으로 "수집"되며 축하 애니메이션 재생
   - 좌우 스와이프로 날짜 이동 (Swiper.js 11)

     마지막 수정 날짜 : 2026-05-24 (Swiper 도입 리팩토링)
   ===================================================================== */

import { fetchStories, fetchTodayStory } from '../services/stories.js';
import { toggleBookmark, getBookmarkedStoryIds } from '../services/bookmarks.js';
import { showToast } from '../components/toast.js';
import { escapeHtml } from '../utils/sanitize.js';
import { shareStory } from '../services/sharing.js';
import { getState, setState } from '../state.js';
import { navigate, setOnUnmount } from '../router.js';
import { markLetterRead } from '../services/widget.js';
import { localizedStory } from '../utils/storyI18n.js';
import { t } from '../i18n/index.js';
import { collect, isCollected, canCollect, bulkCollect } from '../services/collection.js';
import { renderGrid, isAtCurrentMonth, WEEKDAYS } from './calendar.js';
import { createCardSwiper } from '../utils/cardSwiper.js';
import { getLocalToday } from '../utils/date.js';

const FLIP_DURATION_MS = 400;

/* iOS WKWebView WebP 디코더 crash 의 부분 방어 (완전 차단 불가능).
   legacy historical .webp image_url 도 src 그대로 부여하고, 디코드 실패 시
   onerror 가 fallback PNG 로 swap. iOS WebKit 의 OS-level crash 는 onerror
   발화 이전이라 막을 수 없으나, 잡을 수 있는 케이스는 잡는다.
   onerror=null 로 fallback 이 다시 실패해도 무한 루프 차단. */
const FALLBACK_IMG = '/assets/editor_profile.png';
const IMG_ONERROR = `this.onerror=null;this.src='${FALLBACK_IMG}';this.classList.add('img-fallback');`;

const ICON_CALENDAR = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7v10"/><path d="M6 5v14"/><rect width="12" height="18" x="10" y="3" rx="2"/></svg>`;
const ICON_CARD = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>`;


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
      <div class="swiper card-swiper" id="editorstory-card-swiper">
        <div class="swiper-wrapper"></div>
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
   섹션 2: 데이터 로딩 + 휠 + Swiper 초기화
   ───────────────────────────────────────────── */

async function loadEditorStoryData(page) {
  try {
    /* 북마크는 시각 렌더에 비필수 → critical path 에서 분리.
       실패해도 빈 배열로 시작, 늦게 도착하면 활성 슬라이드 아이콘만 갱신.
       이전에는 셋 중 하나라도 reject 하면 전체 카드가 안 보였음. */
    let bookmarkedIds = [];
    const bookmarksPromise = getBookmarkedStoryIds()
      .then((ids) => { bookmarkedIds = ids; return ids; })
      .catch((e) => {
        console.warn('북마크 조회 실패(렌더는 계속):', e?.message || e);
        return [];
      });

    const [allStories, todayStory] = await Promise.all([
      fetchStories(),
      fetchTodayStory(),
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

    /* today 는 시스템(로컬) 오늘 기준으로 통일.
       mystory 페이지와 일관성 + DB 상태(autoPublish 누락 등)에 영향받지 않음.
       오늘 카드가 없으면 빈 슬라이드로 표시. */
    const localTodayStr = getLocalToday();
    const [tY, tM, tD] = localTodayStr.split('-');
    const today = new Date(parseInt(tY), parseInt(tM) - 1, parseInt(tD));
    const historyStories = allStories || [];
    bulkCollect([todayStory, ...historyStories].map((s) => s?.id).filter(Boolean));

    const monthEl = page.querySelector('#editorstory-month-scroll');
    const dayEl = page.querySelector('#editorstory-calendar');
    const swiperEl = page.querySelector('#editorstory-card-swiper');

    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();

    /* 월 휠: 1~12, currentMonth 초과는 disabled */
    if (monthEl) {
      monthEl.innerHTML = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const cls = m > currentMonth ? ' disabled' : '';
        return `<div class="wheel-item${cls}" data-month="${m}">${m}</div>`;
      }).join('');
    }

    /* 일 휠 + 슬라이드 데이터 배열을 같은 인덱스로 생성. */
    const dateItems = [];   // {iso, month, day} — 휠 아이템 1:1 매핑
    for (let m = 1; m <= currentMonth; m++) {
      const lastDay = m === currentMonth ? currentDay : new Date(currentYear, m, 0).getDate();
      for (let d = 1; d <= lastDay; d++) {
        const mm = String(m).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        dateItems.push({ iso: `${currentYear}-${mm}-${dd}`, month: m, day: d });
      }
    }

    if (dayEl) {
      dayEl.innerHTML = dateItems.map(({ iso, month, day }) =>
        `<div class="wheel-item" data-date="${iso}" data-month="${month}" data-day="${day}">${day}</div>`
      ).join('');
    }

    /* 날짜 → 카드 매핑 (조회 1회). historyStories와 todayStory를 합쳐서 캐시. */
    const dateToStory = new Map();
    for (const s of historyStories) {
      if (s?.publish_date) dateToStory.set(s.publish_date, s);
    }
    if (todayStory?.publish_date) dateToStory.set(todayStory.publish_date, todayStory);

    /* Swiper용 슬라이드 데이터: 각 날짜에 대해 {iso, story} */
    const slides = dateItems.map(({ iso }) => ({ iso, story: dateToStory.get(iso) || null }));

    /* 초기 날짜: 마지막 방문 날짜(메모리) → 오늘 → 0 (January 1 방어) */
    const todayIso = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
    const storedDate = getState('lastEditorStoryDate');
    let initialIdx = storedDate ? dateItems.findIndex(d => d.iso === storedDate) : -1;
    if (initialIdx < 0) initialIdx = dateItems.findIndex(d => d.iso === todayIso);
    initialIdx = Math.max(0, initialIdx);

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

    function syncMonthWheel(dayMonth, instant = false) {
      const activeMonthEl = monthEl.querySelector('.wheel-item.active');
      if (activeMonthEl && parseInt(activeMonthEl.dataset.month, 10) === dayMonth) return;
      const targetMonthEl = monthEl.querySelector(`.wheel-item[data-month="${dayMonth}"]`);
      if (!targetMonthEl) return;
      monthEl.querySelectorAll('.wheel-item').forEach(el => el.classList.remove('active'));
      targetMonthEl.classList.add('active');
      const t = targetMonthEl.offsetLeft - monthEl.offsetWidth / 2 + targetMonthEl.offsetWidth / 2;
      /* instant=true: 초기 진입 시 smooth 우회 (iOS scrollTo 미적용 회피 + "즉시 표시") */
      if (instant) monthEl.scrollLeft = t;
      else monthEl.scrollTo({ left: t, behavior: 'smooth' });
    }

    function activateDayWheelByIndex(idx, instant = false) {
      const items = dayEl.querySelectorAll('.wheel-item');
      items.forEach(el => el.classList.remove('active'));
      const target = items[idx];
      if (!target) return;
      target.classList.add('active');
      const month = parseInt(target.dataset.month, 10);
      syncMonthWheel(month, instant);
      const t = target.offsetLeft - dayEl.offsetWidth / 2 + target.offsetWidth / 2;
      if (instant) dayEl.scrollLeft = t;
      else dayEl.scrollTo({ left: t, behavior: 'smooth' });
    }

    /* ── Swiper Virtual 모드 ──
       150개 사전 빌드 대신 Virtual 이 데이터 배열과 renderSlide 콜백을 받아
       가시 슬라이드 ±2 (총 5개) 만 DOM 에 유지. iOS WKWebView 의 GPU 컴포지터가
       동시에 처리하는 .flipper 3D 컨텍스트 수가 ~150 → ~5 로 감소. */

    /* ── 보기 방식 상태(카드 ↔ 캘린더) — Swiper 생성 전에 결정해야 lazy init 가능 ── */
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
    const cardArea = page.querySelector('#editorstory-card-area');
    const calView   = page.querySelector('#editorstory-cal-view');
    let currentView = sessionStorage.getItem('ds_session_view') ?? (localStorage.getItem('ds_default_view') || 'card');

    /* ── Swiper 인스턴스 lazy 생성 ──
       hidden container(cardArea.hidden=true) 위에서 Swiper 를 init 하면
       getBoundingClientRect 가 0×0 → slidesGrid 가 0 → initialSlide 가 anchor 되지 못해
       activeIndex 0(1월 1일) 에 stuck + iOS 카드 표시 불가가 발생.
       cardArea 가 실제로 보일 때(offsetParent !== null) 만 createCardSwiper 호출.
       calendar view 진입 시에는 toggle 핸들러가 처음 ensureSwiper() 호출. */
    let swiper = null;
    const ensureSwiper = () => {
      if (swiper) return swiper;
      if (swiperEl.offsetParent === null) return null;
      swiper = createCardSwiper(swiperEl, {
        slides,
        /* Swiper Virtual 은 renderSlide 의 outermost 요소를 그대로 slide DOM 으로 사용한다
           (virtual.mjs:45 — tempDOM.children[0]). 따라서 .swiper-slide 래퍼가 outermost 여야
           Swiper 의 layout/transform 이 정상 적용됨. buildSlideHTML 은 .flip-container 부터
           시작하므로 명시적으로 래핑한다. */
        renderSlide: (slide) => `<div class="swiper-slide">${buildSlideHTML(slide.story, slide.iso)}</div>`,
        initialSlide: initialIdx,
        onSlideActive: (idx) => {
          /* 슬라이드 변경 → 마지막 방문 날짜 저장 + 일/월 휠 동기화 */
          setState('lastEditorStoryDate', slides[idx]?.iso ?? null);
          activateDayWheelByIndex(idx);
        },
        onSlideReady: (idx) => {
          /* 활성 슬라이드의 이벤트(플립/공유/북마크/상세) 바인딩 */
          const slideEl = swiperEl.querySelector('.swiper-slide-active');
          if (!slideEl) return;
          const flipContainer = slideEl.querySelector('.flip-container');
          if (!flipContainer) return;
          const slide = slides[idx];
          const story = slide?.story ? localizedStory(slide.story) : null;
          bindFlipCardEvents(flipContainer, story, bookmarkedIds);
        },
      });
      return swiper;
    };

    /* card view 진입 시 DOM 삽입 이후 첫 프레임에 생성.
       iOS WKWebView 는 SPA 전환 직후 첫 rAF 에서도 offsetParent 가 일시 null 일 수 있으므로
       ensureSwiper() 가 null 이면 다음 rAF 에서 재시도 (최대 8회, 약 130ms).
       휠 선스크롤은 instant 모드로 매 시도마다 즉시 정확한 위치에 표시 (1월 1일 flash 방지). */
    if (currentView !== 'calendar') {
      let attempts = 0;
      const MAX_ATTEMPTS = 8;
      const tryInit = () => {
        activateDayWheelByIndex(initialIdx, true);
        const sw = ensureSwiper();
        if (sw) {
          requestAnimationFrame(() => sw.update());
          return;
        }
        if (++attempts < MAX_ATTEMPTS) requestAnimationFrame(tryInit);
      };
      requestAnimationFrame(tryInit);
    }

    setOnUnmount(() => {
      if (swiper && !swiper.destroyed) swiper.destroy(true, true);
    });

    /* 북마크가 critical path 보다 늦게 도착한 경우 — 활성 슬라이드의 아이콘만 다시 칠함.
       전체 슬라이드를 재렌더링하지 않음 (DOM thrash 방지). */
    bookmarksPromise.then((ids) => {
      const sw = swiper;
      if (!sw || sw.destroyed) return;
      const slide = slides[sw.activeIndex];
      const story = slide?.story;
      if (!story?.id) return;
      const activeSlideEl = swiperEl.querySelector('.swiper-slide-active');
      const bookmarkIcon = activeSlideEl?.querySelector('.card-action-btn[aria-label="보관함"] svg');
      if (bookmarkIcon && ids.includes(story.id)) {
        bookmarkIcon.setAttribute('fill', 'currentColor');
      }
    });

    /* 일 휠 스크롤 디바운스 — 사용자가 일 휠을 직접 스크롤하면 active를 중앙 아이템으로 옮기고 Swiper도 이동 */
    let scrollTimeout;
    const onDayScrollEnd = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const centerDay = getCenterItem(dayEl);
        if (!centerDay) return;
        const targetIso = centerDay.dataset.date;
        const targetIdx = slides.findIndex(s => s.iso === targetIso);
        const sw = ensureSwiper();
        if (!sw || targetIdx < 0 || targetIdx === sw.activeIndex) return;
        sw.slideTo(targetIdx, 320);
      }, 150);
    };
    dayEl.addEventListener('scroll', onDayScrollEnd, { passive: true });

    /* 월 휠 스크롤 디바운스 — 중앙 월로 일 휠 점프 */
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

    /* 월 휠 클릭: 해당 월의 첫날(또는 오늘)로 점프 */
    const onMonthClick = (item) => {
      if (item.classList.contains('disabled')) return;
      const m = parseInt(item.dataset.month, 10);
      const dd = m === currentMonth ? String(currentDay).padStart(2, '0') : '01';
      const targetIso = `${currentYear}-${String(m).padStart(2, '0')}-${dd}`;
      const targetIdx = slides.findIndex(s => s.iso === targetIso);
      if (targetIdx < 0) return;
      monthEl.querySelectorAll('.wheel-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      const monthScroll = item.offsetLeft - monthEl.offsetWidth / 2 + item.offsetWidth / 2;
      monthEl.scrollTo({ left: monthScroll, behavior: 'smooth' });
      const sw = ensureSwiper();
      if (sw) sw.slideTo(targetIdx, 320);
    };

    /* 일 휠 클릭: 해당 날짜로 Swiper 이동 */
    const onDayClick = (item) => {
      const targetIso = item.dataset.date;
      const targetIdx = slides.findIndex(s => s.iso === targetIso);
      if (targetIdx < 0) return;
      const sw = ensureSwiper();
      if (sw) sw.slideTo(targetIdx, 320);
    };

    monthEl.querySelectorAll('.wheel-item').forEach(item =>
      item.addEventListener('click', () => onMonthClick(item))
    );
    dayEl.querySelectorAll('.wheel-item').forEach(item =>
      item.addEventListener('click', () => onDayClick(item))
    );

    /* 초기 휠 위치는 createCardSwiper의 on.init → onSlideActive 에서 이미 처리됨.
       추가 동기화는 스크롤 위치 경쟁을 유발하므로 제거. */
    void markLetterRead();

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
          /* 최초 카드 보기 진입이면 여기서 Swiper 생성. 이미 있으면 update() 로 재측정.
             iOS WKWebView 는 hidden=false 직후 reflow 가 한 프레임 늦으므로 double rAF. */
          const sw = ensureSwiper();
          if (sw) {
            requestAnimationFrame(() => sw.update());
          }
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
   섹션 3: 슬라이드 HTML 빌더 (Swiper Virtual용)
   ───────────────────────────────────────────── */

function buildSlideHTML(rawStory, isoDate) {
  const story = rawStory ? localizedStory(rawStory) : null;
  const bookmarkedIds = []; // 북마크 표시는 onSlideMounted에서 갱신 (slideHTML은 정적 캐시 대상)

  const [yStr, mStr, dStr] = isoDate.split('-');
  const dateObj = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, parseInt(dStr, 10));
  const month = dateObj.getMonth() + 1;
  const day = dateObj.getDate();
  const displayYear = dateObj.getFullYear();

  if (!story) {
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const formattedDate = `${monthNames[dateObj.getMonth()]} ${day}, ${displayYear}`;
    return `
      <div class="flip-container">
        <div class="flipper">
          <div class="front history-card-front empty-story-card">
            <div class="empty-story-day-circle">${day}</div>
            <div class="empty-story-title">${t('home.empty_card_title')}</div>
            <div class="empty-story-date">${formattedDate}</div>
          </div>
        </div>
      </div>
    `;
  }

  /* story.image_url 을 항상 그대로 부여 (legacy .webp 포함).
     이전엔 isWebpUrl 차단으로 모든 historical 카드가 fallback 으로 보이는 버그 발생.
     디코드 실패는 onerror 가 fallback 으로 swap — 운 좋게 잡히면 복구. */
  const imageSrc = story.image_url || FALLBACK_IMG;

  return `
    <div class="flip-container">
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
                  <svg viewBox="0 0 24 24" fill="${bookmarkedIds.includes(story.id) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
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
            <img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(story.figure_name)}" loading="lazy" decoding="async" width="320" height="400" draggable="false" onerror="${IMG_ONERROR}" />
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
              <img src="/assets/editor_profile.png" alt="editor" class="back-editor-avatar" loading="lazy" decoding="async" />
            </button>
            <div class="back-date-actions">
              <div class="back-date">${escapeHtml(story.historical_year)}년 ${month}월 ${day}일</div>
              <button class="card-detail-shortcut-btn" type="button" aria-label="${t('home.detail_button')}" title="${t('home.detail_button')}">${t('home.detail_button')}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}


/* ─────────────────────────────────────────────
   섹션 4: 카드 이벤트 (플립 + 자동 수집 + 액션)
   ───────────────────────────────────────────── */

function bindFlipCardEvents(flipContainer, story, bookmarkedIds) {
  const flipper = flipContainer.querySelector('.flipper');
  if (!flipper) return;

  /* 이미 바인딩됐다면 중복 방지 (Virtual cache로 같은 슬라이드 DOM이 재사용될 때) */
  if (flipContainer.dataset.bound === '1') return;
  flipContainer.dataset.bound = '1';

  /* 이미지 fade-in */
  flipContainer.querySelectorAll('.history-card-image-wrap img').forEach(img => {
    img.classList.add('card-img-fade');
    if (img.complete && img.naturalWidth > 0) {
      img.classList.add('img-loaded');
    } else {
      img.addEventListener('load',  () => img.classList.add('img-loaded'), { once: true });
      img.addEventListener('error', () => img.classList.add('img-loaded'), { once: true });
    }
  });

  /* 북마크 아이콘 초기 상태 갱신 (buildSlideHTML은 정적 캐시 대상이라 동적 표시) */
  const bookmarkIcon = flipContainer.querySelector('.card-action-btn[aria-label="보관함"] svg');
  if (bookmarkIcon && story && bookmarkedIds.includes(story.id)) {
    bookmarkIcon.setAttribute('fill', 'currentColor');
  }

  const detailBtn = flipContainer.querySelector('.card-detail-shortcut-btn');
  const shareBtn = flipContainer.querySelector('.card-action-btn[aria-label="공유"]');
  const bookmarkBtn = flipContainer.querySelector('.card-action-btn[aria-label="보관함"]');

  if (detailBtn && story) {
    detailBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigate(`/detail/${story.id}`);
    });
  }

  if (shareBtn && story) {
    shareBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await shareStory(story, { kind: 'history' });
    });
  }

  if (bookmarkBtn && story) {
    bookmarkBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const res = await toggleBookmark(story.id);
      if (res.error) {
        showToast(res.error, 'error');
        return;
      }
      showToast(res.bookmarked ? t('toast.bookmark_added') : t('toast.bookmark_removed'), 'success');
      bookmarkBtn.querySelector('svg').setAttribute('fill', res.bookmarked ? 'currentColor' : 'none');
      if (res.bookmarked && !bookmarkedIds.includes(story.id)) {
        bookmarkedIds.push(story.id);
      } else if (!res.bookmarked) {
        const idx = bookmarkedIds.indexOf(story.id);
        if (idx > -1) bookmarkedIds.splice(idx, 1);
      }
    });
  }

  /* 카드 클릭 → 자동 수집 (오늘 카드 + 미수집 시) + 플립.
     Swiper의 preventClicks: false 설정 덕에 스와이프 직후 발생한 click 은
     Swiper가 자동 차단해 준다. 별도 isSwiping 가드 불필요. */
  flipper.addEventListener('click', (e) => {
    if (!story) return;
    if (e.target.closest('.card-action-btn')) return;
    if (e.target.closest('.back-editor-btn')) return;
    if (e.target.closest('.card-detail-shortcut-btn')) return;
    if (flipper.classList.contains('is-flipping')) return;

    /* 말풍선이 떠 있으면 그것만 닫음 */
    const openBubble = flipContainer.querySelector('.editor-comment-bubble');
    if (openBubble && !openBubble.contains(e.target)) {
      openBubble.remove();
      return;
    }

    /* 자동 수집:
       - 오늘 카드 + 미수집 → 토스트로 안내
       - 풀액세스(어드민/구독자)가 지난 카드를 클릭 → 무음으로 영구 수집 */
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
