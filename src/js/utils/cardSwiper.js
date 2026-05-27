/* =====================================================================
   cardSwiper.js — 카드 좌우 스와이프 공통 유틸 (Swiper.js 11, Virtual 모드)
   =====================================================================
   editorstory / mystory 두 페이지가 동일한 한-장씩 넘김 + snap + 관성
   인터랙션을 공유한다. iPhone 사진 앱 같은 빠르고 쫀득한 느낌이 목표.

   Virtual 모듈 사용 (2026-05-27 도입):
   - 이유: 150개 슬라이드 사전 빌드 + 각 슬라이드의 .flipper 가 가진
     transform-style: preserve-3d → iOS WKWebView 의 GPU 컴포지터가
     스와이프 transition 중 150개 3D 컨텍스트를 동시 합성하다 살해됨.
   - 해결: Virtual 로 DOM 슬라이드 수를 ±2 (총 5개) 로 한정. 3D 컨텍스트
     수가 ~150 → ~5 로 감소 → GPU 메모리 한계 내로 들어옴.
   - 이전 우려(누적 버그): `cache: false` 로 회피. 매 slideChange 마다
     fresh 렌더하므로 DOM 잔재 없음.

   호출 측은 사전 빌드한 .swiper-slide DOM 을 넘기지 않고, `slides` 배열 +
   `renderSlide(slideData, idx) => HTML` 콜백을 넘긴다. Swiper Virtual 이
   필요한 시점에 호출해 슬라이드를 DOM 에 삽입한다.

   - slidesPerView: 1, slidesPerGroup: 1 → 한 번에 한 장만
   - spaceBetween: 16 → 카드 사이 시각적 간격
   - threshold 5px + longSwipesRatio 0.2 → 짧은 스와이프로도 다음 카드
   - resistance 0.85 → 양 끝에서 부드럽게 늘어났다 돌아옴
   - touchAngle 45 → 수직 스크롤(카드 본문 등)과 충돌 방지
   ===================================================================== */

import Swiper from 'swiper';
import { Virtual } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/virtual';

/**
 * createCardSwiper — 카드 좌우 스와이프 인스턴스 생성 (Virtual 모드)
 * @param {HTMLElement} container - .swiper 요소
 * @param {Object} options
 * @param {Array}  options.slides - 슬라이드 데이터 배열 [{iso, story}, ...]
 * @param {(slideData: any, index: number) => string} options.renderSlide
 *        - 슬라이드 데이터를 HTML 문자열로 변환. 반환값의 outermost 가 .swiper-slide 여야 한다
 *          (Swiper Virtual 은 string → tempDOM.children[0] 을 slide DOM 으로 그대로 사용).
 * @param {(index: number) => void} [options.onSlideActive]
 *        - 활성 슬라이드가 변경됐을 때 호출
 * @param {(index: number) => void} [options.onSlideReady]
 *        - init 직후 + slideChangeTransitionEnd 시 활성 슬라이드 인덱스로 호출
 * @param {number} [options.initialSlide=0]
 * @returns {Swiper}
 */
export function createCardSwiper(container, {
  slides,
  renderSlide,
  onSlideActive,
  onSlideReady,
  initialSlide = 0,
}) {
  const swiper = new Swiper(container, {
    modules: [Virtual],

    /* ── Virtual 슬라이드 ── */
    virtual: {
      enabled: true,
      slides,
      renderSlide: (slideData, index) => renderSlide(slideData, index),
      addSlidesBefore: 2,
      addSlidesAfter: 2,
      cache: false,   /* DOM 누적 회피 — 매번 fresh 렌더 */
    },

    /* ── 한 장씩 ── */
    slidesPerView: 1,
    slidesPerGroup: 1,
    spaceBetween: 16,
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

    /* ── 하드웨어 가속 ── */
    watchSlidesProgress: true,
    cssMode: false,

    initialSlide,

    on: {
      init(sw) {
        /* Swiper 가 SPA 페이지 전환 직후 initialSlide 를 0 으로 무시하는 사례 방어.
           Virtual 도입 후에도 동적 렌더 타이밍 edge case 의 방어선으로 유지.
           runCallbacks: false 로 slideChange 무한 루프 차단. */
        if (initialSlide > 0 && sw.activeIndex !== initialSlide) {
          sw.slideTo(initialSlide, 0, false);
        }
        /* slideTo(runCallbacks=false) 는 slideChange 를 skip 하므로
           UI(휠) 동기화는 여기서 직접 호출. sw.activeIndex 는 보정 후 값. */
        const idx = sw.activeIndex;
        onSlideActive?.(idx);
        onSlideReady?.(idx);
      },
      slideChange(sw) {
        onSlideActive?.(sw.activeIndex);
      },
      slideChangeTransitionEnd(sw) {
        onSlideReady?.(sw.activeIndex);
      },
    },
  });

  return swiper;
}
