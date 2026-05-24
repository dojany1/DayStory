/* =====================================================================
   cardSwiper.js — 카드 좌우 스와이프 공통 유틸 (Swiper.js 11)
   =====================================================================
   editorstory / mystory 두 페이지가 동일한 한-장씩 넘김 + snap + 관성
   인터랙션을 공유한다. iPhone 사진 앱 같은 빠르고 쫀득한 느낌이 목표.

   ⚠️ Virtual 모듈을 사용하지 않는다. Virtual 은 cache 옵션과 결합되어
   슬라이드를 DOM 에서 제거하지 않고 누적시키는 동작이 확인됐다
   (DOM 에 1, 2, 12-33, 57-61, 108-119, 139-142 등 비연속 잔재).
   ~150장 슬라이드는 메모리/렌더 부담이 크지 않으므로 전부 사전 생성하고,
   이미지는 loading="lazy" 로 처리해 가시 슬라이드만 네트워크 로드한다.

   - slidesPerView: 1, slidesPerGroup: 1 → 한 번에 한 장만
   - spaceBetween: 16 → 카드 사이 시각적 간격
   - threshold 5px + longSwipesRatio 0.2 → 짧은 스와이프로도 다음 카드
   - resistance 0.85 → 양 끝에서 부드럽게 늘어났다 돌아옴
   - touchAngle 45 → 수직 스크롤(카드 본문 등)과 충돌 방지
   ===================================================================== */

import Swiper from 'swiper';
import 'swiper/css';

/**
 * createCardSwiper — 카드 좌우 스와이프 인스턴스 생성
 * @param {HTMLElement} container - .swiper 요소
 * @param {Object} options
 * @param {number} options.slideCount - 전체 슬라이드 개수 (이미 .swiper-wrapper 안에 .swiper-slide 들이 모두 들어있다는 전제)
 * @param {(index: number) => void} [options.onSlideActive]
 *        - 활성 슬라이드가 변경됐을 때 호출
 * @param {(index: number) => void} [options.onSlideReady]
 *        - init 직후 활성 슬라이드에 대해 호출 (이벤트 바인딩 지점)
 * @param {number} [options.initialSlide=0]
 * @returns {Swiper}
 */
export function createCardSwiper(container, {
  slideCount,
  onSlideActive,
  onSlideReady,
  initialSlide = 0,
}) {
  const swiper = new Swiper(container, {
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
           wrapper innerHTML 을 동적으로 채운 직후 init 되는 타이밍에 가끔 발생함.
           runCallbacks: false 로 slideChange 무한 루프도 차단. */
        if (initialSlide > 0 && sw.activeIndex !== initialSlide) {
          sw.slideTo(initialSlide, 0, false);
        }
        onSlideActive?.(sw.activeIndex);
        onSlideReady?.(sw.activeIndex);
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
