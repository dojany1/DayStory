/* =====================================================================
   cardSwiper.js — 카드 좌우 스와이프 공통 유틸 (Swiper.js 11 기반)
   =====================================================================
   editorstory / mystory 두 페이지가 동일한 한-장씩 넘김 + snap + 관성
   인터랙션을 공유한다. iPhone 사진 앱 같은 빠르고 쫀득한 느낌이 목표.

   - slidesPerView: 1, slidesPerGroup: 1 → 한 번에 한 장만
   - threshold 5px + longSwipesRatio 0.2 → 짧은 스와이프로도 다음 카드
   - resistance 0.85 → 양 끝에서 부드럽게 늘어났다 돌아옴
   - touchAngle 45 → 수직 스크롤(카드 본문 등)과 충돌 방지
   - Virtual 모듈 → 양옆 1장씩만 실제 렌더 (메모리/이미지 비용 절감)
   ===================================================================== */

import Swiper from 'swiper';
import { Virtual } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/virtual';

/**
 * createCardSwiper — 카드 좌우 스와이프 인스턴스 생성
 * @param {HTMLElement} container - .swiper 요소
 * @param {Object} options
 * @param {Array} options.slides - 슬라이드 데이터 배열 (각 요소는 renderSlide에 전달됨)
 * @param {(data: any, index: number) => string} options.renderSlide
 *        - 슬라이드 1장의 내부 HTML 문자열을 반환. .swiper-slide 래퍼는 Swiper가 자동 부여.
 * @param {(index: number, data: any) => void} [options.onSlideActive]
 *        - 활성 슬라이드가 변경됐을 때 호출 (휠 동기화, 이벤트 바인딩 등에 사용)
 * @param {(slideEl: HTMLElement, data: any, index: number) => void} [options.onSlideMounted]
 *        - Virtual이 새 슬라이드 DOM을 만들 때마다 호출 (이벤트 바인딩 지점)
 * @param {number} [options.initialSlide=0]
 * @returns {Swiper}
 */
export function createCardSwiper(container, {
  slides,
  renderSlide,
  onSlideActive,
  onSlideMounted,
  initialSlide = 0,
}) {
  const swiper = new Swiper(container, {
    modules: [Virtual],

    /* ── 한 장씩 ── */
    slidesPerView: 1,
    slidesPerGroup: 1,
    spaceBetween: 0,
    centeredSlides: false,

    /* ── iPhone 사진 앱 느낌 ── */
    speed: 320,
    threshold: 5,
    longSwipesMs: 300,
    longSwipesRatio: 0.2,
    shortSwipes: true,
    resistance: true,
    resistanceRatio: 0.85,

    /* ── 수직 스크롤 보호 ── */
    touchAngle: 45,
    touchEventsTarget: 'wrapper',
    simulateTouch: true,
    grabCursor: false,
    preventClicks: false,
    preventClicksPropagation: false,

    /* ── 하드웨어 가속 (Swiper 11은 translate3d 기본) ── */
    watchSlidesProgress: true,
    cssMode: false,

    /* ── 메모리 효율: 양옆 1장씩만 ── */
    virtual: {
      slides,
      renderSlide,
      addSlidesBefore: 1,
      addSlidesAfter: 1,
      cache: true,
    },

    initialSlide,

    on: {
      init(sw) {
        onSlideActive?.(sw.activeIndex, slides[sw.activeIndex]);
        notifyMountedForActive(sw, slides, onSlideMounted);
      },
      slideChange(sw) {
        /* 드래그 도중 실시간 휠 동기화 */
        onSlideActive?.(sw.activeIndex, slides[sw.activeIndex]);
      },
      slideChangeTransitionEnd(sw) {
        /* Virtual DOM 이 안정된 뒤 이벤트 바인딩 */
        notifyMountedForActive(sw, slides, onSlideMounted);
      },
    },
  });

  return swiper;
}

/* 활성 슬라이드 DOM이 준비되면 mount 콜백 호출.
   Virtual 모드에서 sw.slides 는 렌더된 2–3개 요소만 보유하므로
   sw.slides[activeIndex] 는 항상 undefined. 클래스 셀렉터로 탐색한다. */
function notifyMountedForActive(sw, slides, onSlideMounted) {
  if (!onSlideMounted) return;
  requestAnimationFrame(() => {
    const activeSlideEl = sw.el.querySelector('.swiper-slide-active');
    const idx = sw.activeIndex;
    if (activeSlideEl) onSlideMounted(activeSlideEl, slides[idx], idx);
  });
}
