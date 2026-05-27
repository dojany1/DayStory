/* =====================================================================
   mystory.js — 나의 일화 (일반 사용자 전용)
   =====================================================================
   사용자가 자신의 이야기를 확인하고 추가/수정하는 페이지입니다.
   홈 화면의 일화 카드와 디자인 일관성을 유지하기 위해 원본 카드 뷰를 사용합니다.

   좌우 스와이프는 Swiper.js 11 기반으로 통합되었습니다 (2026-05-24).
   ===================================================================== */

import { navigate, getParams, setOnUnmount } from '../router.js';
import { getState, setState } from '../state.js';
import { showToast } from '../components/toast.js';
import { showConfirm } from '../components/confirmDialog.js';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { fetchMyStories, createMyStory, updateMyStory, fetchMyStoryById, deleteMyStory } from '../services/mystories.js';
import { escapeHtml } from '../utils/sanitize.js';
import { isFirebaseStorageUrl } from '../utils/storage.js';
import { auth, storage } from '../firebase.js';
import { ref as fsRef, getBlob } from 'firebase/storage';
import { shareStory } from '../services/sharing.js';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import { syncDiaryStateFromList } from '../services/widget.js';
import { uploadImage } from '../services/images.js';
import { pickImage, CameraPermissionError } from '../services/camera.js';

import { lockScroll, unlockScroll } from '../utils/scrollLock.js';
import { renderGrid, isAtCurrentMonth, WEEKDAYS } from './calendar.js';
import { renderPageHeader, bindPageHeaderBack } from '../components/pageHeader.js';
import { createCardSwiper } from '../utils/cardSwiper.js';
import { getLocalToday } from '../utils/date.js';

const CARD_IMAGE_CROP_ASPECT_RATIO = 4 / 5;

/* 카드 로딩 스켈레톤 제거 — 페이드 아웃 후 DOM 에서 제거 (밑에 깔린 실제 카드가 드러남) */
function hideCardSkeleton(page) {
  const sk = page.querySelector('#mystory-card-skeleton');
  if (!sk) return;
  sk.classList.add('is-hiding');
  setTimeout(() => sk.remove(), 300);
}

/* iOS WKWebView WebP 디코더 crash 의 부분 방어 (완전 차단 불가능).
   사용자 업로드 이미지(legacy .webp 포함) 도 src 그대로 부여하고, 디코드
   실패 시 onerror 가 fallback PNG 로 swap. iOS WebKit 의 OS-level crash 는
   onerror 발화 이전이라 막을 수 없으나, 잡을 수 있는 케이스는 잡는다. */
const FALLBACK_IMG = '/assets/editor_profile.png';
const IMG_ONERROR = `this.onerror=null;this.src='${FALLBACK_IMG}';this.classList.add('img-fallback');`;

const ICON_CALENDAR_MY = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7v10"/><path d="M6 5v14"/><rect width="12" height="18" x="10" y="3" rx="2"/></svg>`;
const ICON_CARD_MY = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>`;

function getMyStoryAuthorNickname(story = {}) {
  const profile = getState('profile') || {};
  const user = getState('user') || {};
  const emailName = typeof user.email === 'string' ? user.email.split('@')[0] : '';
  const candidates = [
    story.author_nickname,
    story.authorNickname,
    story.author?.nickname,
    story.author?.displayName,
    profile.nickname,
    user.displayName,
    emailName,
  ];
  const nickname = candidates
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find(Boolean);
  return nickname || '사용자';
}

/* ─────────────────────────────────────────────
   섹션 1: 나의 일화 목록 페이지 (싱글 카드 + 휠 피커 + Swiper)
   ───────────────────────────────────────────── */
export function renderMyStory() {
  const page = document.createElement('div');
  page.className = 'mystory-page page';

  const savedView = sessionStorage.getItem('ds_session_view') ?? (localStorage.getItem('ds_default_view') || 'card');
  const initialYear = new Date().getFullYear();

  page.innerHTML = `
    <!-- 휠 피커 스타일 날짜 선택기 -->
    <div class="wheel-pickers-container">
      <div class="wheel-year-label" id="mystory-year-label">${initialYear}</div>
      <!-- 월 피커 -->
      <div class="wheel-picker-wrapper">
        <div class="wheel-selection-box"></div>
        <div class="modern-wheel-scroll" id="mystory-month-scroll"></div>
        <button type="button" class="view-toggle-btn" id="mystory-view-toggle" aria-label="보기 방식 변경">${savedView === 'calendar' ? ICON_CARD_MY : ICON_CALENDAR_MY}</button>
      </div>
      <!-- 일 피커 -->
      <div class="wheel-picker-wrapper" id="mystory-day-picker">
        <div class="wheel-selection-box"></div>
        <div class="modern-wheel-scroll" id="mystory-calendar"></div>
      </div>
    </div>

    <!-- 카드 렌더링 영역 (Swiper) -->
    <div class="editorstory-card-area" id="mystory-card-area">
      <div class="swiper card-swiper" id="mystory-card-swiper">
        <div class="swiper-wrapper"></div>
      </div>
      <div class="skeleton-card" id="mystory-card-skeleton" aria-hidden="true"></div>
    </div>

    <div class="page-calendar-view" id="mystory-cal-view" hidden>
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
    page.querySelector('#mystory-day-picker').hidden = true;
    page.querySelector('#mystory-card-area').hidden = true;
    page.querySelector('#mystory-cal-view').hidden = false;
  }

  loadMyStoryData(page);

  return page;
}

async function loadMyStoryData(page) {
  try {
    const user = getState('user');
    // Firebase Auth의 실제 UID를 우선 사용 (Firestore 보안 규칙의 request.auth.uid와 일치해야 함)
    const uid = auth?.currentUser?.uid || user?.id;
    const allStories = await fetchMyStories(uid);
    void syncDiaryStateFromList(allStories);

    // 로컬 시간 기준 실제 오늘 날짜 (휠 피커의 미래 날짜 제한용)
    const params = getParams();
    const localTodayStr = getLocalToday();

    const [rtY, rtM, rtD] = localTodayStr.split('-');
    const realToday = new Date(parseInt(rtY), parseInt(rtM) - 1, parseInt(rtD));

    // 마지막 방문 날짜(메모리) > URL 파라미터 > 오늘 순서로 초기 날짜 결정
    const targetDateStr = getState('lastMyStoryDate') || params.date || localTodayStr;

    const monthElement = page.querySelector('#mystory-month-scroll');
    const calendarElement = page.querySelector('#mystory-calendar');
    const swiperEl = page.querySelector('#mystory-card-swiper');

    const currentYear = realToday.getFullYear();
    const currentMonth = realToday.getMonth() + 1;
    const currentDate = realToday.getDate();


    /* 월 휠: 1~12, currentMonth 초과는 disabled */
    if (monthElement) {
      monthElement.innerHTML = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const cls = m > currentMonth ? ' disabled' : '';
        return `<div class="wheel-item${cls}" data-month="${m}">${m}</div>`;
      }).join('');
    }

    /* 일 휠 + Swiper 슬라이드 데이터를 같은 인덱스로 생성 */
    const dateItems = [];
    for (let m = 1; m <= currentMonth; m++) {
      const lastDay = m === currentMonth ? currentDate : new Date(currentYear, m, 0).getDate();
      for (let d = 1; d <= lastDay; d++) {
        const mm = String(m).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        dateItems.push({ iso: `${currentYear}-${mm}-${dd}`, month: m, day: d });
      }
    }

    if (calendarElement) {
      calendarElement.innerHTML = dateItems.map(({ iso, month, day }) =>
        `<div class="wheel-item" data-date="${iso}" data-month="${month}" data-day="${day}">${day}</div>`
      ).join('');
    }

    /* 날짜 → 일화 매핑 */
    const dateToStory = new Map();
    for (const s of allStories) {
      if (s?.publish_date) dateToStory.set(s.publish_date, s);
    }

    /* Swiper 슬라이드 데이터 */
    const slides = dateItems.map(({ iso }) => ({ iso, story: dateToStory.get(iso) || null }));

    /* 초기 인덱스: targetDateStr → 없으면 오늘 → 없으면 0 (January 1 방어) */
    let initialIdx = dateItems.findIndex(d => d.iso === targetDateStr);
    if (initialIdx < 0) initialIdx = dateItems.findIndex(d => d.iso === localTodayStr);
    initialIdx = Math.max(0, initialIdx);

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

    function syncMonthWheel(dayMonth, instant = false) {
      const activeMonthEl = monthElement.querySelector('.wheel-item.active');
      if (activeMonthEl && parseInt(activeMonthEl.dataset.month, 10) === dayMonth) return;
      const targetMonthEl = monthElement.querySelector(`.wheel-item[data-month="${dayMonth}"]`);
      if (!targetMonthEl) return;
      monthElement.querySelectorAll('.wheel-item').forEach(el => el.classList.remove('active'));
      targetMonthEl.classList.add('active');
      const t = targetMonthEl.offsetLeft - monthElement.offsetWidth / 2 + targetMonthEl.offsetWidth / 2;
      /* instant=true: 초기 진입 시 smooth 우회 (iOS scrollTo 미적용 회피 + "즉시 표시") */
      if (instant) monthElement.scrollLeft = t;
      else monthElement.scrollTo({ left: t, behavior: 'smooth' });
    }

    function activateDayWheelByIndex(idx, instant = false) {
      const items = calendarElement.querySelectorAll('.wheel-item');
      items.forEach(el => el.classList.remove('active'));
      const target = items[idx];
      if (!target) return;
      target.classList.add('active');
      const month = parseInt(target.dataset.month, 10);
      syncMonthWheel(month, instant);
      const t = target.offsetLeft - calendarElement.offsetWidth / 2 + target.offsetWidth / 2;
      if (instant) calendarElement.scrollLeft = t;
      else calendarElement.scrollTo({ left: t, behavior: 'smooth' });
    }

    /* ── Swiper Virtual 모드 ──
       이전엔 모든 슬라이드를 사전에 DOM 에 넣고 이미지만 lazy 로딩했음. 그러나
       각 슬라이드의 .flipper 가 transform-style:preserve-3d 로 3D 컨텍스트를
       만들어 iOS WKWebView GPU 컴포지터가 swipe transition 중 살해됨.
       Virtual 로 가시 슬라이드 ±2 (총 5개) 만 DOM 유지. */

    /* ── 보기 방식 상태(카드 ↔ 캘린더) — Swiper 생성 전에 결정해야 lazy init 가능 ── */
    const calState = {
      mode: 'mine',
      year: currentYear,
      month: realToday.getMonth(),
      historyStories: [],
      myStories: allStories,
      bookmarkedIds: [],
    };

    const toggleBtn = page.querySelector('#mystory-view-toggle');
    const dayPicker = page.querySelector('#mystory-day-picker');
    const cardArea = page.querySelector('#mystory-card-area');
    const calView   = page.querySelector('#mystory-cal-view');
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
        /* Swiper Virtual 의 renderSlide 는 반환 string 의 outermost 요소를 slide DOM 으로 사용.
           .swiper-slide 래퍼가 outermost 여야 Swiper 의 layout/transform 이 정상 적용됨. */
        renderSlide: (slide) => `<div class="swiper-slide">${buildMyStorySlideHTML(slide.story, slide.iso)}</div>`,
        initialSlide: initialIdx,
        onSlideActive: (idx) => {
          setState('lastMyStoryDate', slides[idx]?.iso ?? null);
          activateDayWheelByIndex(idx);
        },
        onSlideReady: (idx) => {
          const slideEl = swiperEl.querySelector('.swiper-slide-active');
          if (!slideEl) return;
          const flipContainer = slideEl.querySelector('.flip-container');
          if (!flipContainer) return;
          const slide = slides[idx];
          bindMyStoryCardEvents(flipContainer, slide?.story, slide?.iso);
        },
      });
      hideCardSkeleton(page);
      return swiper;
    };

    /* card view 진입 시 DOM 삽입 이후 첫 프레임에 생성.
       renderMyStory() → loadMyStoryData() 순서에서 page 가 아직 DOM 밖에 있을 때
       ensureSwiper() 를 호출하면 offsetParent === null → 생성 건너뜀 → 1월 1일 표시.
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

    /* 일 휠 스크롤 디바운스 — 사용자가 일 휠을 직접 스크롤하면 Swiper도 이동 */
    let scrollTimeout;
    const onDayScrollEnd = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const centerDay = getActiveItem(calendarElement);
        if (!centerDay) return;
        const targetIso = centerDay.dataset.date;
        const targetIdx = slides.findIndex(s => s.iso === targetIso);
        const sw = ensureSwiper();
        if (!sw || targetIdx < 0 || targetIdx === sw.activeIndex) return;
        sw.slideTo(targetIdx, 320);
      }, 150);
    };
    calendarElement.addEventListener('scroll', onDayScrollEnd, { passive: true });

    /* 월 휠 스크롤 디바운스 */
    let monthScrollTimeout;
    const onMonthScrollEnd = () => {
      if (currentView !== 'card') return;
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

    /* 월 휠 클릭 */
    const onMonthClick = (item) => {
      if (item.classList.contains('disabled')) return;
      const m = parseInt(item.dataset.month, 10);
      const dd = m === currentMonth ? String(currentDate).padStart(2, '0') : '01';
      const targetIso = `${currentYear}-${String(m).padStart(2, '0')}-${dd}`;
      const targetIdx = slides.findIndex(s => s.iso === targetIso);
      if (targetIdx < 0) return;
      monthElement.querySelectorAll('.wheel-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      const monthScroll = item.offsetLeft - monthElement.offsetWidth / 2 + item.offsetWidth / 2;
      monthElement.scrollTo({ left: monthScroll, behavior: 'smooth' });
      const sw = ensureSwiper();
      if (sw) sw.slideTo(targetIdx, 320);
    };

    /* 일 휠 클릭 */
    const onDayClick = (item) => {
      const targetIso = item.dataset.date;
      const targetIdx = slides.findIndex(s => s.iso === targetIso);
      if (targetIdx < 0) return;
      const sw = ensureSwiper();
      if (sw) sw.slideTo(targetIdx, 320);
    };

    monthElement.querySelectorAll('.wheel-item').forEach(item =>
      item.addEventListener('click', () => onMonthClick(item))
    );
    calendarElement.querySelectorAll('.wheel-item').forEach(item =>
      item.addEventListener('click', () => onDayClick(item))
    );

    /* 초기 휠 위치는 createCardSwiper 의 on.init → onSlideActive 에서 이미 처리됨. */

    if (currentView === 'calendar') {
      renderGrid(page, calState, realToday);
    }

    toggleBtn.addEventListener('click', () => {
      if (currentView === 'card') {
        currentView = 'calendar';
        sessionStorage.setItem('ds_session_view', 'calendar');
        toggleBtn.innerHTML = ICON_CARD_MY;
        dayPicker.hidden = true;
        cardArea.hidden = true;
        calView.hidden = false;
        requestAnimationFrame(() => {
          calView.classList.add('view-enter');
          renderGrid(page, calState, realToday);
          setTimeout(() => calView.classList.remove('view-enter'), 250);
        });
      } else {
        currentView = 'card';
        sessionStorage.setItem('ds_session_view', 'card');
        toggleBtn.innerHTML = ICON_CALENDAR_MY;
        calView.hidden = true;
        dayPicker.hidden = false;
        cardArea.hidden = false;
        requestAnimationFrame(() => {
          const activeDay = calendarElement.querySelector('.wheel-item.active');
          if (activeDay) {
            calendarElement.scrollLeft = activeDay.offsetLeft - calendarElement.offsetWidth / 2 + activeDay.offsetWidth / 2;
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
    monthElement.addEventListener('scroll', () => {
      if (currentView !== 'calendar') return;
      clearTimeout(calMonthScrollTimer);
      calMonthScrollTimer = setTimeout(() => {
        const active = getActiveItem(monthElement);
        if (!active) return;
        const m = parseInt(active.dataset.month, 10) - 1;
        if (m === calState.month && calState.year === currentYear) return;
        calState.month = m;
        calState.year = currentYear;
        renderGrid(page, calState, realToday);
      }, 150);
    }, { passive: true });

    /* 캘린더 이전/다음 달 버튼 */
    page.querySelector('#cal-prev-month').addEventListener('click', () => {
      calState.month -= 1;
      if (calState.month < 0) { calState.month = 11; calState.year -= 1; }
      const yearLabel = page.querySelector('#mystory-year-label');
      if (yearLabel) yearLabel.textContent = calState.year;
      renderGrid(page, calState, realToday);
      syncMonthWheel(calState.month + 1);
    });

    page.querySelector('#cal-next-month').addEventListener('click', () => {
      if (isAtCurrentMonth(calState, realToday)) return;
      calState.month += 1;
      if (calState.month > 11) { calState.month = 0; calState.year += 1; }
      const yearLabel = page.querySelector('#mystory-year-label');
      if (yearLabel) yearLabel.textContent = calState.year;
      renderGrid(page, calState, realToday);
      syncMonthWheel(calState.month + 1);
    });

  } catch (err) {
    console.error('loadMyStoryData 오류:', err?.message || err?.code || JSON.stringify(err));
    page.innerHTML = `<div class="empty-state"><div class="empty-state-title">오류가 발생했습니다</div></div>`;
  }
}


/* ─────────────────────────────────────────────
   섹션 1-2: 슬라이드 HTML 빌더 (Swiper Virtual용)
   ───────────────────────────────────────────── */

function buildMyStorySlideHTML(story, isoDateStr) {
  const [yStr, mStr, dStr] = isoDateStr.split('-');
  const dateObj = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, parseInt(dStr, 10));
  const month = dateObj.getMonth() + 1;
  const day = dateObj.getDate();
  const displayYear = dateObj.getFullYear();

  if (!story) {
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const formattedDate = `${monthNames[dateObj.getMonth()]} ${day}, ${displayYear}`;
    return `
      <div class="flip-container">
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
      </div>
    `;
  }

  const [storyYearRaw, storyMonthRaw, storyDayRaw] = String(story.publish_date || isoDateStr).split('-');
  const storyYear = parseInt(storyYearRaw, 10) || displayYear;
  const storyMonth = parseInt(storyMonthRaw, 10) || month;
  const storyDay = parseInt(storyDayRaw, 10) || day;
  /* story.image_url 을 항상 그대로 부여 (legacy .webp 포함).
     디코드 실패 시 onerror 가 fallback 으로 swap — "운 좋게" 잡힐 때만 복구. */
  const imageSrc = story.image_url || FALLBACK_IMG;
  const bodyHtml = (story.body || '').split(/\n|\\n/).map(p => p.trim() ? `<p>${escapeHtml(p)}</p>` : '<p><br></p>').join('');
  const authorNickname = getMyStoryAuthorNickname(story);

  return `
    <div class="flip-container">
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
              <div class="card-meta">${escapeHtml(authorNickname)}</div>
            </div>
          </div>
          <div class="history-card-image-wrap">
            <img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(story.title)}" loading="lazy" decoding="async" width="320" height="400" draggable="false" onerror="${IMG_ONERROR}" />
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
    </div>
  `;
}


/* ─────────────────────────────────────────────
   섹션 1-3: 카드 이벤트 (플립 + 액션 버튼)
   ───────────────────────────────────────────── */

function bindMyStoryCardEvents(flipContainer, story, isoDateStr) {
  const flipper = flipContainer.querySelector('.flipper');
  if (!flipper) return;

  /* 중복 바인딩 방지 */
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

  /* 상단 액션 버튼 (mystory 전용) */
  const writeBtn = flipContainer.querySelector('.mystory-write-btn');
  const shareBtn = flipContainer.querySelector('.share-my-story-btn');
  const editBtn = flipContainer.querySelector('.edit-my-story-btn');

  const checkAuth = () => {
    const userObj = getState('user') || {};
    const uid = auth?.currentUser?.uid || userObj.id;
    if (!uid) {
      showToast('로그인이 필요한 서비스입니다.', 'error');
      location.hash = '#/login';
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

  /* 카드 클릭 → 플립 (Swiper의 preventClicks 동작이 스와이프 직후 click을 자동 차단) */
  flipper.addEventListener('click', (e) => {
    if (!story) return;
    if (e.target.closest('button')) return;
    if (flipper.classList.contains('is-flipping')) return;

    flipper.classList.add('is-flipping');
    flipper.classList.toggle('flipped');
    setTimeout(() => flipper.classList.remove('is-flipping'), 400);
  });
}


/* ─────────────────────────────────────────────
   섹션 2: 나의 일화 폼 (렌더링 & 제출)
   ───────────────────────────────────────────── */
export function renderMyStoryNew() {
  const page = document.createElement('div');
  page.className = 'mystory-new-page page';

  /* ---- 로그인/비회원 체크 (라우터 가드에서 이미 막혀야 하지만 안전망) ---- */
  const userObj = getState('user') || {};
  const uid = auth?.currentUser?.uid || userObj.id;
  if (!uid) {
    page.innerHTML = `
      ${renderPageHeader({ title: '권한 없음', backLabel: '뒤로' })}
      <div class="empty-state" style="padding-top: 100px;">
        <div class="empty-state-title">로그인이 필요합니다</div>
        <div class="empty-state-desc">나의 일화를 작성하려면 로그인해주세요.</div>
        <button class="btn btn-primary" style="margin-top: 16px;" id="ms-no-auth-back">뒤로 가기</button>
      </div>
    `;
    setTimeout(() => {
      bindPageHeaderBack(page, () => history.back());
      document.getElementById('ms-no-auth-back')?.addEventListener('click', () => history.back());
    }, 0);
    return page;
  }

  const user = userObj;
  const params = getParams();
  let editingId = params.edit || null;
  let defaultDate = params.date || new Date().toISOString().split('T')[0];
  let originalSnapshot = null;

  page.innerHTML = `
    ${renderPageHeader({ title: editingId ? '나의 일화 수정' : '나의 일화 쓰기', backLabel: '뒤로' })}

    <div class="editor-form-section section mystory-form-section">
      <form id="mystory-form" class="story-form">
        <!-- 1. 날짜 -->
        <div class="input-group">
          <label class="input-label">날짜 *</label>
          <input class="input-field" type="date" id="ms-date" required style="text-align:left; -webkit-appearance:none; appearance:none;" />
        </div>
        <!-- 2. 카드 이미지 -->
        <div class="input-group">
          <input type="hidden" id="ms-image" />
          <input type="hidden" id="ms-image-thumb" />
          <div id="ms-image-upload-area" class="ms-image-upload-area" role="button" tabindex="0" aria-label="카드 이미지 업로드">
            <div id="ms-image-placeholder" class="ms-image-upload-placeholder">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/>
                <line x1="16" x2="22" y1="5" y2="5"/>
                <line x1="19" x2="19" y1="2" y2="8"/>
                <circle cx="9" cy="9" r="2"/>
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
              </svg>
              <span>카드 이미지 업로드</span>
            </div>
            <img id="ms-image-preview" class="ms-image-upload-preview" style="display:none;" alt="카드 이미지 미리보기" />
          </div>
        </div>
        <!-- 3. 단일 제목 -->
        <div class="input-group">
          <label class="input-label">제목</label>
          <input class="input-field" id="ms-title" />
        </div>
        <!-- 4. 본문 -->
        <div class="input-group">
          <label class="input-label">본문</label>
          <textarea class="input-field" id="ms-body" style="min-height:250px; resize:vertical; line-height:1.6; font-family:var(--font-body);"></textarea>
        </div>
        ${editingId ? `
          <!-- 편집 모드: 폼 하단 우측에 삭제 버튼 배치 -->
          <div class="mystory-form-inline-actions">
            <button type="button" class="btn btn-secondary mystory-form-delete-btn" id="delete-my-story-edit">삭제</button>
          </div>
        ` : ''}
      </form>
    </div>

    <!-- 화면 하단 floating 액션 영역 (저장 버튼) -->
    <div class="mystory-form-actions">
      <button type="submit" form="mystory-form" id="ms-save-btn" class="btn btn-primary btn-full">저장하기</button>
    </div>
  `;

  setTimeout(async () => {
    function hasUnsavedChanges() {
      if (editingId) {
        if (!originalSnapshot) return false;
        return (
          (document.getElementById('ms-title')?.value ?? '') !== originalSnapshot.title ||
          (document.getElementById('ms-body')?.value ?? '') !== originalSnapshot.body ||
          (document.getElementById('ms-date')?.value ?? '') !== originalSnapshot.date ||
          (document.getElementById('ms-image')?.value ?? '') !== originalSnapshot.image_url
        );
      }
      return !!(
        document.getElementById('ms-title')?.value.trim() ||
        document.getElementById('ms-body')?.value.trim() ||
        document.getElementById('ms-image')?.value
      );
    }

    async function handleBack() {
      if (hasUnsavedChanges()) {
        const confirmed = await showConfirm({
          title: '저장하지 않고 나가기',
          message: '작성 중인 내용이 저장되지 않습니다.\n나가시겠습니까?',
          confirmText: '나가기',
          cancelText: '취소',
        });
        if (!confirmed) return;
      }
      history.back();
    }

    bindPageHeaderBack(page, handleBack);

    if (Capacitor.isNativePlatform()) {
      const backListener = await CapApp.addListener('backButton', handleBack);
      window.addEventListener('hashchange', () => backListener.remove(), { once: true });
    }
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
        updateImagePreview(story.image_url || '');
        originalSnapshot = {
          title: story.title || '',
          body: story.body || '',
          date: story.publish_date || defaultDate,
          image_url: story.image_url || '',
        };
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

    const formEl = document.getElementById('mystory-form');

    async function openCropModal(imageSrc, isCrossOrigin = false, callbackBlobFile) {
      let localSrc = imageSrc;
      if (isCrossOrigin) {
        if (!isFirebaseStorageUrl(imageSrc)) {
          showToast('외부 이미지는 편집할 수 없습니다.\n[사진 추가]로 새 이미지를 업로드해주세요.', 'error');
          return;
        }
        try {
          /* fetch() 대신 Firebase Storage SDK 사용 — CORS 없이 SDK가 직접 다운로드 */
          const url = new URL(imageSrc);
          const encodedPath = url.pathname.split('/o/')[1] || '';
          const storagePath = decodeURIComponent(encodedPath.split('?')[0]);
          const blob = await getBlob(fsRef(storage, storagePath));
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
          <button type="button" class="crop-modal-back-btn" id="btn-crop-back" aria-label="닫기">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          카드 이미지 편집
        </div>
        <div class="crop-modal-body">
          <img id="cropper-image" src="${localSrc}" style="max-width: 100%; display: block;" />
        </div>
        <div class="crop-modal-footer">
          <button type="button" class="btn-rotate" id="btn-crop-rotate">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 2v6h-6"/>
              <path d="M21 13a9 9 0 1 1-2.63-6.36L21 9"/>
            </svg>
            회전
          </button>
          <button type="button" class="btn-crop-confirm" id="btn-crop-confirm">완료</button>
        </div>
      `;
      const wrapper = document.querySelector('.mobile-wrapper') || document.body;
      wrapper.appendChild(overlay);
      lockScroll();

      const cancelCrop = () => {
        overlay.style.opacity = '0';
        unlockScroll();
        setTimeout(() => {
          if (cropper) cropper.destroy();
          if (isCrossOrigin && localSrc.startsWith('blob:')) URL.revokeObjectURL(localSrc);
          overlay.remove();
        }, 300);
      };
      overlay.querySelector('#btn-crop-back').addEventListener('click', cancelCrop);

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

    const ICON_SPINNER = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:ms-spin 1s linear infinite;flex-shrink:0;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;
    const ICON_CHECK = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M20 6 9 17l-5-5"/></svg>`;

    function setSaveBtnUploading() {
      const btn = document.getElementById('ms-save-btn');
      if (!btn) return;
      btn.disabled = true;
      btn.style.opacity = '0.5';
      btn.innerHTML = `${ICON_SPINNER}업로드 중...`;
    }

    function setSaveBtnDone() {
      const btn = document.getElementById('ms-save-btn');
      if (!btn) return;
      btn.disabled = false;
      btn.style.opacity = '';
      btn.innerHTML = `${ICON_CHECK}업로드 완료!`;
      setTimeout(() => {
        if (btn) btn.innerHTML = '저장하기';
      }, 2000);
    }

    function setSaveBtnReady() {
      const btn = document.getElementById('ms-save-btn');
      if (!btn) return;
      btn.disabled = false;
      btn.style.opacity = '';
      btn.innerHTML = '저장하기';
    }

    async function processUploadBlob(blob, fallbackName) {
      const IMAGE_FIELD = document.getElementById('ms-image');
      if (!IMAGE_FIELD) return;

      try {
        setSaveBtnUploading();
        if (!uid) {
          showToast('로그인이 필요합니다.', 'error');
          return;
        }
        blob.name = fallbackName;
        const { image_url } = await uploadImage(blob, { uid, folder: 'diary' });

        const imageInput = document.getElementById('ms-image');
        const thumbInput = document.getElementById('ms-image-thumb');
        if (imageInput) imageInput.value = image_url;
        if (thumbInput) thumbInput.value = '';
        setSaveBtnDone();
        updateImagePreview(image_url);
      } catch (error) {
        console.error('이미지 업로드 오류:', error);
        setSaveBtnReady();
        showToast('이미지 저장에 실패했습니다.', 'error');
      }
    }

    function updateImagePreview(url) {
      const placeholder = document.getElementById('ms-image-placeholder');
      const preview = document.getElementById('ms-image-preview');
      if (!placeholder || !preview) return;
      if (url) {
        placeholder.style.display = 'none';
        preview.src = url;
        preview.style.display = 'block';
      } else {
        placeholder.style.display = '';
        preview.src = '';
        preview.style.display = 'none';
      }
    }

    /* 사진 추가 — 단일 업로드 영역 클릭 → Prompt (네이티브: 카메라/갤러리 선택, 웹: 갤러리) */
    async function handleImagePick() {
      try {
        const result = await pickImage();
        if (!result) return;
        openCropModal(result.dataUrl, false, (blob) => {
          processUploadBlob(blob, 'image.jpeg');
        });
      } catch (err) {
        if (err instanceof CameraPermissionError) {
          showToast(err.message, 'warning');
          return;
        }
        showToast(err?.message || '사진을 불러올 수 없습니다.', 'error');
      }
    }
    const uploadArea = document.getElementById('ms-image-upload-area');
    uploadArea?.addEventListener('click', handleImagePick);
    uploadArea?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleImagePick(); }
    });

    document.getElementById('mystory-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();

      /* 이미지 업로드 중이면 저장 차단 (버튼 disabled 상태로 판단) */
      const saveBtnEl = document.getElementById('ms-save-btn');
      if (saveBtnEl?.disabled) {
        showToast('사진 업로드가 완료될 때까지 기다려주세요', 'warning');
        return;
      }

      const data = {
        uid: uid,
        title: document.getElementById('ms-title').value.trim(),
        publish_date: document.getElementById('ms-date').value,
        body: document.getElementById('ms-body').value.trim(),
        image_url: document.getElementById('ms-image').value.trim(),
        image_thumb_url: document.getElementById('ms-image-thumb')?.value.trim() || '',
        author_nickname: getMyStoryAuthorNickname()
      };

      if (!data.publish_date) return showToast('날짜를 입력해주세요', 'warning');
      if (!data.image_url) return showToast('카드 이미지를 추가해주세요', 'warning');

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
