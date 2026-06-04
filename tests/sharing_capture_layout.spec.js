// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* =====================================================================
   captureAndShareCard — As-Is(WYSIWYG) 캡처 검증
   ---------------------------------------------------------------------
   픽셀 강제 주입 방식을 폐기했으므로 더 이상 고정 치수를 검증하지 않는다.
   대신 As-Is 전략의 핵심 계약만 검증한다:
     · onclone 이 카드의 레이아웃(width/height/flex)을 강제하지 않는다
     · html2canvas 에 width/height 를 넘기지 않는다 (원본 크기 그대로)
     · 백화 방지 CORS 옵션/속성이 적용된다
     · 공유/북마크 버튼이 숨겨지고 워터마크가 주입된다
     · Safari 클리핑 방어용 date line-height:1 보정만 남는다
   ===================================================================== */

const { html2canvasMock, capturedRef } = vi.hoisted(() => ({
  html2canvasMock: vi.fn(),
  capturedRef: { clonedDoc: null, options: null },
}));

/* html2canvas: onclone 을 실제로 실행해 복제 문서에 보정을 적용시킨 뒤
   결과를 capturedRef 로 노출. 그럴듯한 PNG dataURL 을 반환. */
vi.mock('html2canvas', () => ({
  default: html2canvasMock,
}));

vi.mock('@capacitor/share', () => ({
  Share: { share: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile: vi.fn().mockResolvedValue({ uri: 'file:///x.png' }) },
  Directory: { Cache: 'CACHE' },
}));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}));
vi.mock('../src/js/components/toast.js', () => ({
  showToast: vi.fn(),
  dismissToast: vi.fn(),
}));

const { captureAndShareCard } = await import('../src/js/services/sharing.js');

/* 실제 cardFace 마크업과 동일한 구조의 카드 DOM 을 만든다.
   img 는 data: URL 로 두어 Step1 imageToBase64 가 스킵되도록 한다(테스트 고속화). */
function buildCard({ imgSrc = 'data:image/png;base64,iVBORw0KGgo=' } = {}) {
  const card = document.createElement('div');
  card.className = 'front history-card-front';
  card.innerHTML = `
    <div class="history-card-top">
      <div class="card-top-left">
        <div class="card-year">1917</div>
        <div class="card-date">6. 4</div>
      </div>
      <div class="card-top-right">
        <div class="card-actions"><button class="card-action-btn">x</button></div>
        <div class="card-meta">미국</div>
      </div>
    </div>
    <div class="history-card-image-wrap">
      <img src="${imgSrc}" alt="" loading="lazy" decoding="async" />
      <div class="card-image-title">퓰리처 상</div>
    </div>`;
  document.body.appendChild(card);
  return card;
}

describe('captureAndShareCard — As-Is(WYSIWYG) 캡처', () => {
  beforeEach(() => {
    capturedRef.clonedDoc = null;
    capturedRef.options = null;
    if (typeof navigator !== 'undefined') delete navigator.canShare;

    html2canvasMock.mockReset();
    html2canvasMock.mockImplementation(async (el, options) => {
      /* 별도 문서로 복제 — data-capture-id 가 outerHTML 에 포함된다 */
      const clonedDoc = document.implementation.createHTMLDocument('clone');
      clonedDoc.body.innerHTML = el.outerHTML;
      options.onclone(clonedDoc);
      capturedRef.clonedDoc = clonedDoc;
      capturedRef.options = options;
      return { toDataURL: () => 'data:image/png;base64,' + 'A'.repeat(64) };
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('onclone 은 카드 레이아웃(width/height/flex)을 강제하지 않는다 (As-Is)', async () => {
    const card = buildCard();
    await captureAndShareCard(card, {});
    const cloned = capturedRef.clonedDoc.querySelector('[data-capture-id]');

    /* 외곽 카드에 인라인 사이즈 주입이 없어야 한다 */
    expect(cloned.style.width).toBe('');
    expect(cloned.style.height).toBe('');
    expect(cloned.style.padding).toBe('');

    /* 이미지 래퍼·이미지에도 사이즈 강제가 없어야 한다 */
    const wrap = cloned.querySelector('.history-card-image-wrap');
    expect(wrap.style.width).toBe('');
    expect(wrap.style.height).toBe('');
    expect(wrap.style.flex).toBe('');

    const img = wrap.querySelector('img');
    expect(img.style.width).toBe('');
    expect(img.style.height).toBe('');
    expect(img.style.position).toBe('');
  });

  it('html2canvas 에 width/height 를 넘기지 않고 CORS 옵션을 켠다', async () => {
    const card = buildCard();
    await captureAndShareCard(card, {});

    expect(capturedRef.options.width).toBeUndefined();
    expect(capturedRef.options.height).toBeUndefined();
    expect(capturedRef.options.useCORS).toBe(true);
    expect(capturedRef.options.allowTaint).toBe(true);
    expect(capturedRef.options.scale).toBe(2);
  });

  it('공유/북마크 버튼(.card-actions)이 숨겨진다', async () => {
    const card = buildCard();
    await captureAndShareCard(card, {});
    const cloned = capturedRef.clonedDoc.querySelector('[data-capture-id]');
    const actions = cloned.querySelector('.card-actions');
    expect(actions.style.display).toBe('none');
  });

  it('워터마크가 카드 우측 하단에 주입된다', async () => {
    const card = buildCard();
    await captureAndShareCard(card, {});
    const cloned = capturedRef.clonedDoc.querySelector('[data-capture-id]');
    const wm = cloned.querySelector('.card-watermark-tmp');

    expect(wm).not.toBeNull();
    expect(wm.textContent).toContain('DayStory');
    expect(wm.style.position).toBe('absolute');
    /* 아이콘 이미지도 함께 들어간다 */
    expect(wm.querySelector('img')).not.toBeNull();
  });

  it('Safari 클리핑 방어용 date line-height:1 보정만 남는다', async () => {
    const card = buildCard();
    await captureAndShareCard(card, {});
    const cloned = capturedRef.clonedDoc.querySelector('[data-capture-id]');

    const date = cloned.querySelector('.card-date');
    expect(date.style.lineHeight).toBe('1');
    /* font-size 는 강제 주입하지 않는다 (브라우저 렌더 신뢰) */
    expect(date.style.fontSize).toBe('');

    /* year 에는 어떤 인라인 보정도 없어야 한다 */
    const year = cloned.querySelector('.card-year');
    expect(year.style.fontSize).toBe('');
    expect(year.style.lineHeight).toBe('');
  });

  it('외부 이미지에 백화 방지 CORS 속성(crossOrigin + cache-bust)이 적용된다', async () => {
    vi.useFakeTimers();
    /* 외부 URL 이미지 — jsdom 에선 로드되지 않아 Step1 imageToBase64 가 timeout 후 null.
       fake timer 로 8s timeout 을 즉시 진행시켜 테스트를 고속화한다. */
    const card = buildCard({ imgSrc: 'https://firebasestorage.googleapis.com/x/img.jpg' });
    const promise = captureAndShareCard(card, {});
    await vi.runAllTimersAsync();
    await promise;

    const cloned = capturedRef.clonedDoc.querySelector('[data-capture-id]');
    const img = cloned.querySelector('img');
    expect(img.getAttribute('crossorigin')).toBe('anonymous');
    expect(img.getAttribute('src')).toMatch(/_cors=\d+/);
    /* lazy/async 속성은 제거되어 즉시 렌더 보장 */
    expect(img.hasAttribute('loading')).toBe(false);
    expect(img.hasAttribute('decoding')).toBe(false);
  });

  it('캡처 후 원본 DOM 의 임시 capture-id 가 제거된다', async () => {
    const card = buildCard();
    await captureAndShareCard(card, {});
    expect(card.dataset.captureId).toBeUndefined();
  });
});
