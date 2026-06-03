/* =====================================================================
   cardDeckController.js — 휠 날짜선택 + Swiper 카드덱 + 캘린더 토글 공통 컨트롤러
   =====================================================================
   editorstory(역사 카드)와 mystory(나의 일화)가 거의 동일하게 갖고 있던
   loadEditorStoryData / loadMyStoryData (~340–390줄)의 공통 로직을 한곳으로 모은다.

   페이지별 차이는 config 로 주입한다:
     - idPrefix     : 엘리먼트 id 접두사 ('editorstory' | 'mystory')
     - pageClass    : 루트 클래스
     - headerHtml   : 휠 위 헤더(에디터만), 없으면 ''
     - enterDir     : 진입 애니메이션 방향(없으면 null)
     - calMode      : 캘린더 그리드 모드 ('history' | 'mine')
     - lastDateKey  : 마지막 방문 날짜 state 키
     - loadData(ctx): { stories, initialDate, calStores, bookmarkedIds, isEmpty } 반환(async)
     - renderSlideHTML(rawStory, iso) : 슬라이드 HTML
     - bindCard(flipContainer, rawStory, iso, ctx) : 카드 이벤트 바인딩
     - onMounted(ctx)?       : 초기화 직후 1회(에디터 markLetterRead 등)
     - onSwiperReady(sw,ctx)?: Swiper 생성 직후(에디터 북마크 지연 갱신 등)
     - emptyHtml()? / errorHtml(err)? : 빈/오류 상태 마크업
   ===================================================================== */

import { setState } from '../../state.js';
import { setOnUnmount } from '../../router.js';
import { getLocalToday } from '../../utils/date.js';
import { createCardSwiper } from '../../utils/cardSwiper.js';
import { renderGrid, isAtCurrentMonth, WEEKDAYS } from '../../pages/calendar.js';
import { ICON_CALENDAR, ICON_CARD } from './cardFace.js';

/* ── 페이지 shell 마크업 (휠 피커 + 카드 영역 + 캘린더 뷰) ── */
function buildShellHtml({ idPrefix: P, headerHtml = '', initialYear, savedView }) {
  return `
    ${headerHtml}
    <div class="wheel-pickers-container">
      <div class="wheel-year-label" id="${P}-year-label">${initialYear}</div>
      <div class="wheel-picker-wrapper">
        <div class="wheel-selection-box"></div>
        <div class="modern-wheel-scroll" id="${P}-month-scroll"></div>
        <button type="button" class="view-toggle-btn" id="${P}-view-toggle" aria-label="보기 방식 변경">${savedView === 'calendar' ? ICON_CARD : ICON_CALENDAR}</button>
      </div>
      <div class="wheel-picker-wrapper" id="${P}-day-picker">
        <div class="wheel-selection-box"></div>
        <div class="modern-wheel-scroll" id="${P}-calendar"></div>
      </div>
    </div>

    <div class="editorstory-card-area" id="${P}-card-area">
      <div class="swiper card-swiper" id="${P}-card-swiper">
        <div class="swiper-wrapper"></div>
      </div>
      <div class="skeleton-card" id="${P}-card-skeleton" aria-hidden="true"></div>
    </div>

    <div class="page-calendar-view" id="${P}-cal-view" hidden>
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
}

/* 카드 로딩 스켈레톤 제거 — 페이드 아웃 후 DOM 에서 제거 */
function hideSkeleton(page, P) {
  const sk = page.querySelector(`#${P}-card-skeleton`);
  if (!sk) return;
  sk.classList.add('is-hiding');
  setTimeout(() => sk.remove(), 300);
}

/**
 * buildCardDeck — config 로 구동되는 카드덱 페이지 element 를 만든다.
 * @returns {HTMLElement}
 */
export function buildCardDeck(config) {
  const P = config.idPrefix;
  const page = document.createElement('div');
  page.className = `${config.pageClass} page`;
  if (config.enterDir) page.dataset.enter = config.enterDir;

  const savedView = sessionStorage.getItem('ds_session_view') ?? (localStorage.getItem('ds_default_view') || 'card');
  const initialYear = new Date().getFullYear();

  page.innerHTML = buildShellHtml({ idPrefix: P, headerHtml: config.headerHtml || '', initialYear, savedView });

  if (savedView === 'calendar') {
    page.querySelector(`#${P}-day-picker`).hidden = true;
    page.querySelector(`#${P}-card-area`).hidden = true;
    page.querySelector(`#${P}-cal-view`).hidden = false;
  }

  mountCardDeck(page, config);
  return page;
}

/* ── 데이터 로드 + 휠 + Swiper + 토글 (공통 본체) ── */
async function mountCardDeck(page, config) {
  const P = config.idPrefix;
  try {
    /* 로컬(시스템) 오늘 기준 — 두 페이지 일관 + DB autoPublish 누락에 무관 */
    const localTodayStr = getLocalToday();
    const [tY, tM, tD] = localTodayStr.split('-');
    const today = new Date(parseInt(tY, 10), parseInt(tM, 10) - 1, parseInt(tD, 10));
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();
    const todayIso = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;

    /* 페이지별 데이터 로드 */
    const result = await config.loadData({ page, today, todayIso, localTodayStr });
    if (!result || result.isEmpty) {
      page.innerHTML = (config.emptyHtml && config.emptyHtml()) || '<div class="empty-state"><div class="empty-state-title">표시할 카드가 없습니다</div></div>';
      return;
    }

    const { stories = [], initialDate = null, calStores = {}, bookmarkedIds = [] } = result;

    const monthEl = page.querySelector(`#${P}-month-scroll`);
    const dayEl = page.querySelector(`#${P}-calendar`);
    const swiperEl = page.querySelector(`#${P}-card-swiper`);

    /* 월 휠: 1~12, currentMonth 초과는 disabled */
    if (monthEl) {
      monthEl.innerHTML = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const cls = m > currentMonth ? ' disabled' : '';
        return `<div class="wheel-item${cls}" data-month="${m}">${m}</div>`;
      }).join('');
    }

    /* 일 휠 + 슬라이드 데이터를 같은 인덱스로 생성 */
    const dateItems = [];
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

    /* 날짜 → 스토리 매핑 → 슬라이드 */
    const dateToStory = new Map();
    for (const s of stories) {
      if (s?.publish_date) dateToStory.set(s.publish_date, s);
    }
    const slides = dateItems.map(({ iso }) => ({ iso, story: dateToStory.get(iso) || null }));

    /* 초기 인덱스: initialDate → 오늘 → 0 (January 1 방어) */
    let initialIdx = initialDate ? dateItems.findIndex((d) => d.iso === initialDate) : -1;
    if (initialIdx < 0) initialIdx = dateItems.findIndex((d) => d.iso === todayIso);
    initialIdx = Math.max(0, initialIdx);

    /* 캘린더 상태 */
    const calState = {
      mode: config.calMode,
      year: currentYear,
      month: today.getMonth(),
      historyStories: calStores.historyStories || [],
      myStories: calStores.myStories || [],
      bookmarkedIds,
    };

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
      monthEl.querySelectorAll('.wheel-item').forEach((el) => el.classList.remove('active'));
      targetMonthEl.classList.add('active');
      const t = targetMonthEl.offsetLeft - monthEl.offsetWidth / 2 + targetMonthEl.offsetWidth / 2;
      if (instant) monthEl.scrollLeft = t;
      else monthEl.scrollTo({ left: t, behavior: 'smooth' });
    }

    function activateDayWheelByIndex(idx, instant = false) {
      const items = dayEl.querySelectorAll('.wheel-item');
      items.forEach((el) => el.classList.remove('active'));
      const target = items[idx];
      if (!target) return;
      target.classList.add('active');
      const month = parseInt(target.dataset.month, 10);
      syncMonthWheel(month, instant);
      const t = target.offsetLeft - dayEl.offsetWidth / 2 + target.offsetWidth / 2;
      if (instant) dayEl.scrollLeft = t;
      else dayEl.scrollTo({ left: t, behavior: 'smooth' });
    }

    /* ── 뷰 상태 + Swiper lazy 생성 ── */
    const toggleBtn = page.querySelector(`#${P}-view-toggle`);
    const dayPicker = page.querySelector(`#${P}-day-picker`);
    const cardArea = page.querySelector(`#${P}-card-area`);
    const calView = page.querySelector(`#${P}-cal-view`);
    let currentView = sessionStorage.getItem('ds_session_view') ?? (localStorage.getItem('ds_default_view') || 'card');

    /* hidden 컨테이너 위에서 init 하면 geometry 0 → activeIndex 0 stuck. offsetParent 가 보일 때만 생성. */
    let swiper = null;
    const deckCtx = { page, idPrefix: P, swiperEl, slides, calState, today, get swiper() { return swiper; } };

    const ensureSwiper = () => {
      if (swiper) return swiper;
      if (swiperEl.offsetParent === null) return null;
      swiper = createCardSwiper(swiperEl, {
        slides,
        /* Swiper Virtual 은 renderSlide 반환 string 의 outermost 를 slide DOM 으로 사용 → .swiper-slide 래핑 필수 */
        renderSlide: (slide) => `<div class="swiper-slide">${config.renderSlideHTML(slide.story, slide.iso)}</div>`,
        initialSlide: initialIdx,
        onSlideActive: (idx) => {
          setState(config.lastDateKey, slides[idx]?.iso ?? null);
          activateDayWheelByIndex(idx);
        },
        onSlideReady: (idx) => {
          const slideEl = swiperEl.querySelector('.swiper-slide-active');
          if (!slideEl) return;
          const flipContainer = slideEl.querySelector('.flip-container');
          if (!flipContainer) return;
          const slide = slides[idx];
          config.bindCard(flipContainer, slide?.story, slide?.iso, deckCtx);
        },
      });
      hideSkeleton(page, P);
      if (typeof config.onSwiperReady === 'function') config.onSwiperReady(swiper, deckCtx);
      return swiper;
    };

    /* card view 진입 시 DOM 삽입 이후 첫 프레임에 생성 (iOS offsetParent 지연 대비 rAF 최대 8회 재시도) */
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

    /* 일 휠 스크롤 디바운스 */
    let scrollTimeout;
    const onDayScrollEnd = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const centerDay = getCenterItem(dayEl);
        if (!centerDay) return;
        const targetIso = centerDay.dataset.date;
        const targetIdx = slides.findIndex((s) => s.iso === targetIso);
        const sw = ensureSwiper();
        if (!sw || targetIdx < 0 || targetIdx === sw.activeIndex) return;
        sw.slideTo(targetIdx, 320);
      }, 150);
    };
    dayEl.addEventListener('scroll', onDayScrollEnd, { passive: true });

    /* 월 휠 스크롤 디바운스 → 중앙 월로 일 휠 점프 */
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
          monthEl.querySelectorAll('.wheel-item').forEach((el) => el.classList.remove('active'));
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
      const targetIdx = slides.findIndex((s) => s.iso === targetIso);
      if (targetIdx < 0) return;
      monthEl.querySelectorAll('.wheel-item').forEach((el) => el.classList.remove('active'));
      item.classList.add('active');
      const monthScroll = item.offsetLeft - monthEl.offsetWidth / 2 + item.offsetWidth / 2;
      monthEl.scrollTo({ left: monthScroll, behavior: 'smooth' });
      const sw = ensureSwiper();
      if (sw) sw.slideTo(targetIdx, 320);
    };

    /* 일 휠 클릭 */
    const onDayClick = (item) => {
      const targetIso = item.dataset.date;
      const targetIdx = slides.findIndex((s) => s.iso === targetIso);
      if (targetIdx < 0) return;
      const sw = ensureSwiper();
      if (sw) sw.slideTo(targetIdx, 320);
    };

    monthEl.querySelectorAll('.wheel-item').forEach((item) =>
      item.addEventListener('click', () => onMonthClick(item))
    );
    dayEl.querySelectorAll('.wheel-item').forEach((item) =>
      item.addEventListener('click', () => onDayClick(item))
    );

    if (typeof config.onMounted === 'function') config.onMounted(deckCtx);

    if (currentView === 'calendar') {
      renderGrid(page, calState, today);
    }

    /* 뷰 토글 (카드 ↔ 캘린더) */
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
          const sw = ensureSwiper();
          if (sw) requestAnimationFrame(() => sw.update());
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
      const yearLabel = page.querySelector(`#${P}-year-label`);
      if (yearLabel) yearLabel.textContent = calState.year;
      renderGrid(page, calState, today);
      syncMonthWheel(calState.month + 1);
    });

    page.querySelector('#cal-next-month').addEventListener('click', () => {
      if (isAtCurrentMonth(calState, today)) return;
      calState.month += 1;
      if (calState.month > 11) { calState.month = 0; calState.year += 1; }
      const yearLabel = page.querySelector(`#${P}-year-label`);
      if (yearLabel) yearLabel.textContent = calState.year;
      renderGrid(page, calState, today);
      syncMonthWheel(calState.month + 1);
    });
  } catch (err) {
    console.error('카드덱 로딩 실패:', err?.message || err);
    page.innerHTML = (config.errorHtml && config.errorHtml(err)) || '<div class="empty-state"><div class="empty-state-title">오류가 발생했습니다</div></div>';
  }
}
