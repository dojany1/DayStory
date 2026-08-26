/* =====================================================================
   cardMetrics.spec.js — 카드 영역 실측 → CSS 변수 주입 유틸 검증
   =====================================================================
   CSS 만으로는 `min(부모폭, 부모높이 × 비율)` 을 표현할 수 없고
   (container query 는 Safari 16+ 필요, 현 iOS 배포 타깃은 15.0),
   AdMob 배너 노출로 가용 높이가 런타임에 바뀌므로 미디어쿼리로도 불가능하다.
   그래서 adPlacement.js 의 --ad-banner-height / main.js 의 --safe-area-bottom
   과 동일한 "실측 후 CSS 변수 주입" 패턴을 쓴다.
   ===================================================================== */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_CARD_RATIO_H,
  DEFAULT_CARD_RATIO_W,
  observeCardMetrics,
} from '../src/js/utils/cardMetrics.js';

const RATIO = DEFAULT_CARD_RATIO_W / DEFAULT_CARD_RATIO_H;

/* 콜백을 수동으로 발화시킬 수 있는 ResizeObserver 대역 */
class FakeResizeObserver {
  static instances = [];

  constructor(cb) {
    this.cb = cb;
    this.targets = [];
    this.disconnected = false;
    FakeResizeObserver.instances.push(this);
  }

  observe(el) { this.targets.push(el); }
  unobserve(el) { this.targets = this.targets.filter((t) => t !== el); }
  disconnect() { this.disconnected = true; this.targets = []; }

  /* 실제 브라우저의 contentRect(= content box) 전달을 흉내 낸다 */
  emit(el, width, height) {
    this.cb([{ target: el, contentRect: { width, height } }], this);
  }
}

let area;
let originalRO;

beforeEach(() => {
  originalRO = globalThis.ResizeObserver;
  FakeResizeObserver.instances = [];
  globalThis.ResizeObserver = FakeResizeObserver;

  area = document.createElement('div');
  area.className = 'editorstory-card-area';
  document.body.appendChild(area);
});

afterEach(() => {
  globalThis.ResizeObserver = originalRO;
  area.remove();
  document.documentElement.removeAttribute('style');
});

const ro = () => FakeResizeObserver.instances[0];

describe('원인 3 — 가용 폭/높이 중 짧은 쪽을 기준으로 카드 크기를 정한다', () => {
  it('Given a tall area (Pro Max), when measured, then the card is width-bound', () => {
    observeCardMetrics(area);
    /* 396 × 700 → 700 × 0.6458 = 452 > 396 이므로 폭이 제약 */
    ro().emit(area, 396, 700);

    expect(area.style.getPropertyValue('--card-w')).toBe('396px');
    expect(area.style.getPropertyValue('--card-h')).toBe('613.2px');
  });

  it('Given a short area (SE / ad banner shown), when measured, then the card is height-bound', () => {
    observeCardMetrics(area);
    /* 351 × 474 → 474 × 0.6458 = 306.1 < 351 이므로 높이가 제약.
       종전에는 여기서 width:100% 가 유지돼 카드가 뭉툭해졌다. */
    ro().emit(area, 351, 474);

    expect(area.style.getPropertyValue('--card-w')).toBe('306.1px');
    expect(area.style.getPropertyValue('--card-h')).toBe('474px');
  });

  it('Given any measurement, when the card box is written, then it keeps the card aspect ratio', () => {
    observeCardMetrics(area);
    ro().emit(area, 351, 474);

    const w = parseFloat(area.style.getPropertyValue('--card-w'));
    const h = parseFloat(area.style.getPropertyValue('--card-h'));
    expect(w / h).toBeCloseTo(RATIO, 3);
  });

  it('Given a card area, when metrics are written, then they stay local to that element', () => {
    observeCardMetrics(area);
    ro().emit(area, 396, 700);

    /* :root 를 오염시키면 카드덱과 캘린더 팝업이 서로 간섭한다 */
    expect(document.documentElement.style.getPropertyValue('--card-w')).toBe('');
  });
});

describe('원인 5 — --card-scale 이 기준 기기 대비 배율을 준다', () => {
  it('Given the reference device width, when measured, then scale is 1', () => {
    observeCardMetrics(area, { refWidth: 390 });
    ro().emit(area, 390, 900);
    expect(area.style.getPropertyValue('--card-scale')).toBe('1');
  });

  it('Given a wider card, when measured, then scale grows proportionally', () => {
    observeCardMetrics(area, { refWidth: 390 });
    ro().emit(area, 396, 700);
    expect(area.style.getPropertyValue('--card-scale')).toBe('1.015');
  });

  it('Given an extremely narrow card, when measured, then scale is clamped at the floor', () => {
    observeCardMetrics(area, { refWidth: 390, minScale: 0.82 });
    ro().emit(area, 200, 900);
    expect(area.style.getPropertyValue('--card-scale')).toBe('0.82');
  });

  it('Given a tablet-sized card, when measured, then scale is clamped at the ceiling', () => {
    observeCardMetrics(area, { refWidth: 390, maxScale: 1.25 });
    ro().emit(area, 700, 2000);
    expect(area.style.getPropertyValue('--card-scale')).toBe('1.25');
  });
});

describe('쓰기 루프 방어 — 변화가 없으면 다시 쓰지 않는다', () => {
  it('Given an identical measurement, when it repeats, then no further style writes happen', () => {
    observeCardMetrics(area);
    const spy = vi.spyOn(area.style, 'setProperty');

    ro().emit(area, 396, 700);
    const afterFirst = spy.mock.calls.length;
    expect(afterFirst).toBeGreaterThan(0);

    ro().emit(area, 396, 700);
    expect(spy.mock.calls.length).toBe(afterFirst);
  });

  it('Given a sub-pixel jitter, when it arrives, then it is ignored', () => {
    observeCardMetrics(area);
    ro().emit(area, 396, 700);
    const spy = vi.spyOn(area.style, 'setProperty');

    /* iOS WebView 가 safe-area 재계산 중 흘리는 소수점 흔들림 */
    ro().emit(area, 396.2, 700);
    expect(spy).not.toHaveBeenCalled();
  });

  it('Given a real resize, when it arrives, then the metrics are updated', () => {
    observeCardMetrics(area);
    ro().emit(area, 396, 700);
    ro().emit(area, 351, 474);

    expect(area.style.getPropertyValue('--card-w')).toBe('306.1px');
  });

  it('Given a collapsed area (hidden tab), when measured, then nothing is written', () => {
    observeCardMetrics(area);
    ro().emit(area, 0, 0);

    expect(area.style.getPropertyValue('--card-w')).toBe('');
  });
});

describe('정리(cleanup) — router.setOnUnmount 계약', () => {
  it('Given a page unmount, when dispose runs, then the observer is disconnected', () => {
    const dispose = observeCardMetrics(area);
    expect(ro().disconnected).toBe(false);

    dispose();
    expect(ro().disconnected).toBe(true);
  });

  it('Given a double unmount, when dispose runs twice, then it does not throw', () => {
    const dispose = observeCardMetrics(area);
    dispose();
    expect(() => dispose()).not.toThrow();
  });
});

describe('방어적 처리 — 지원되지 않는 환경', () => {
  it('Given no ResizeObserver, when observing, then it falls back without throwing', () => {
    delete globalThis.ResizeObserver;
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    let dispose;
    expect(() => { dispose = observeCardMetrics(area); }).not.toThrow();
    expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function));

    expect(() => dispose()).not.toThrow();
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('Given a null element, when observing, then it returns a no-op disposer', () => {
    let dispose;
    expect(() => { dispose = observeCardMetrics(null); }).not.toThrow();
    expect(() => dispose()).not.toThrow();
  });
});
