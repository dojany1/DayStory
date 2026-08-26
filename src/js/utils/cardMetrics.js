/* =====================================================================
   cardMetrics.js — 카드 영역을 실측해 CSS 변수로 주입한다
   =====================================================================
   왜 JS 인가:
     카드는 "가용 폭" 과 "가용 높이 × 비율" 중 짧은 쪽에 맞춰야 비율이
     유지된다. 그런데 CSS 로는 `min(부모폭, 부모높이 × 비율)` 을 표현할
     수 없다.
       - `aspect-ratio` + `max-height` 조합은 높이가 제약일 때 높이만
         잘라내고 width:100% 를 유지해 카드를 뭉툭하게 만든다.
       - container query(cqw/cqh)면 순수 CSS 로 가능하지만 Safari 16+ 가
         필요하다. 현 iOS 배포 타깃은 15.0 이라 쓸 수 없다.
       - 미디어쿼리는 AdMob 배너 노출로 가용 높이가 "런타임에" 바뀌는
         것을 볼 수 없다.
     그래서 adPlacement.js 의 --ad-banner-height, main.js 의
     --safe-area-bottom 과 동일한 "실측 후 CSS 변수 주입" 패턴을 쓴다.

   주입 대상:
     --card-w      카드 폭(px)
     --card-h      카드 높이(px) — 항상 --card-w 와 카드 비율을 만족한다
     --card-scale  기준 기기(390pt) 대비 배율 — 카드 내부 타이포/여백용

   주입 위치는 :root 가 아니라 "카드 영역 엘리먼트" 다. 카드덱과 캘린더
   카드 팝업이 동시에 존재해도 서로의 값을 덮어쓰지 않게 하기 위함이다.
   ===================================================================== */

/* variables.css 의 --card-aspect-ratio 와 반드시 같은 값이어야 한다.
   (tests/responsive_layout.spec.js 가 두 값의 드리프트를 감시한다) */
export const DEFAULT_CARD_RATIO_W = 3.1;
export const DEFAULT_CARD_RATIO_H = 4.8;

/* --card-scale 이 1.0 이 되는 기준 카드 폭. iPhone 15 Pro(393pt) 급에서
   기존 디자인이 그대로 재현되도록 잡았다. */
const REF_WIDTH = 390;

/* 극단적인 기기에서 타이포가 무너지지 않도록 배율 상·하한을 둔다 */
const MIN_SCALE = 0.82;
const MAX_SCALE = 1.25;

/* 재기록 임계값 — iOS WebView 가 safe-area 재계산 중 흘리는 소수점
   흔들림에 반응해 write → layout → resize 루프가 도는 것을 막는다. */
const PX_EPSILON = 0.5;
const SCALE_EPSILON = 0.005;

const noop = () => {};

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const roundPx = (n) => Math.round(n * 10) / 10;
const roundScale = (n) => Math.round(n * 1000) / 1000;

const raf = (fn) => (
  typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : setTimeout(fn, 16)
);
const cancelRaf = (id) => {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
  else clearTimeout(id);
};

/**
 * observeCardMetrics — 카드 영역 크기를 추적해 CSS 변수를 주입한다.
 *
 * @param {HTMLElement|null} areaEl  카드를 담는 영역 (.editorstory-card-area 등)
 * @param {object} [options]
 *   - ratioW / ratioH : 카드 비율 (기본 --card-aspect-ratio 와 동일)
 *   - refWidth        : --card-scale 이 1 이 되는 기준 폭
 *   - minScale / maxScale : 배율 상·하한
 * @returns {() => void} dispose — router 의 setOnUnmount 에 반드시 등록할 것
 */
export function observeCardMetrics(areaEl, options = {}) {
  if (!areaEl || !areaEl.style) return noop;

  const {
    ratioW = DEFAULT_CARD_RATIO_W,
    ratioH = DEFAULT_CARD_RATIO_H,
    refWidth = REF_WIDTH,
    minScale = MIN_SCALE,
    maxScale = MAX_SCALE,
  } = options;

  const ratio = ratioW / ratioH;

  let lastW = NaN;
  let lastH = NaN;
  let lastScale = NaN;
  let disposed = false;

  /* 가용 공간(content box)을 받아 카드 박스와 배율을 확정해 기록한다 */
  function write(availW, availH) {
    /* 숨겨진 탭·언마운트 직후 등 0 크기일 때는 기존 값을 유지한다 */
    if (!(availW > 0) || !(availH > 0)) return;

    const w = Math.min(availW, availH * ratio);
    const h = w / ratio;
    const scale = clamp(w / refWidth, minScale, maxScale);

    if (
      Math.abs(w - lastW) < PX_EPSILON &&
      Math.abs(h - lastH) < PX_EPSILON &&
      Math.abs(scale - lastScale) < SCALE_EPSILON
    ) return;

    lastW = w;
    lastH = h;
    lastScale = scale;

    areaEl.style.setProperty('--card-w', `${roundPx(w)}px`);
    areaEl.style.setProperty('--card-h', `${roundPx(h)}px`);
    areaEl.style.setProperty('--card-scale', String(roundScale(scale)));
  }

  /* ResizeObserver 가 없을 때(그리고 최초 1회) 쓰는 직접 측정 */
  function measure() {
    const style = typeof getComputedStyle === 'function' ? getComputedStyle(areaEl) : null;
    const padX = style
      ? (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)
      : 0;
    const padY = style
      ? (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0)
      : 0;
    write((areaEl.clientWidth || 0) - padX, (areaEl.clientHeight || 0) - padY);
  }

  /* 라우터가 페이지를 삽입하기 전이면 0 → write 가 건너뛰고,
     삽입 후 ResizeObserver 의 최초 통지가 실제 값을 채운다. */
  measure();

  const RO = globalThis.ResizeObserver;

  if (typeof RO === 'function') {
    /* contentRect 는 padding 을 제외한 content box 라 그대로 쓸 수 있다.
       콜백 안에서 동기적으로 쓴다 — RO 통지는 layout 직후·paint 직전에
       배치되므로 rAF 로 한 프레임 미루면 오히려 잘못된 크기가 한 번
       그려진다. 루프 방어는 위의 임계값 비교가 담당한다. */
    const observer = new RO((entries) => {
      for (const entry of entries) {
        const rect = entry.contentRect;
        if (rect) write(rect.width, rect.height);
      }
    });
    observer.observe(areaEl);

    return () => {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
    };
  }

  /* ── 폴백: ResizeObserver 미지원 환경 ── */
  if (typeof window === 'undefined') return noop;

  let rafId = 0;
  const onResize = () => {
    if (rafId) return;                       /* 프레임당 1회로 합침 */
    rafId = raf(() => { rafId = 0; measure(); });
  };
  window.addEventListener('resize', onResize);

  return () => {
    if (disposed) return;
    disposed = true;
    if (rafId) cancelRaf(rafId);
    window.removeEventListener('resize', onResize);
  };
}
