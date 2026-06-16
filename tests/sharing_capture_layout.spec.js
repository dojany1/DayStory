// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* =====================================================================
   captureAndShareCard — foreignObject(modern-screenshot) 캡처 검증
   ---------------------------------------------------------------------
   캡처 엔진을 html2canvas → modern-screenshot(foreignObject) 로 교체했다.
   실제 브라우저 레이아웃 엔진이 그리므로 flex:1 / align-items:center /
   line-height:0.9 가 라이브와 1:1 일치한다. 따라서 더 이상 onclone 에서
   line-height·transform·overlay 를 보정하지 않는다.

   검증 계약:
     · CORS 백화 방지용 imageToBase64 사전 변환은 그대로 수행한다(§6.2)
     · domToPng 에 scale:2 를 넘긴다
     · onCloneNode 가 상단 아이콘 자리(.card-actions)의 공유/북마크 버튼을
       워터마크로 교체하고, 작은 날짜(.card-meta)는 그 아래에 남긴다
     · 캡처 후 원본 DOM 은 깨끗하게 복구된다(임시 src·capture-id 제거)
     · modern-screenshot 실패 시 html2canvas 로 안전하게 폴백한다
   ===================================================================== */

const { domToPngMock, html2canvasMock, capturedRef } = vi.hoisted(() => ({
  domToPngMock: vi.fn(),
  html2canvasMock: vi.fn(),
  capturedRef: { clone: null, options: null, h2cDoc: null, h2cOptions: null },
}));

/* modern-screenshot.domToPng: 실제 라이브러리처럼 노드를 복제하고
   filter / onCloneNode 훅을 실행시킨 뒤 결과 clone 을 capturedRef 로 노출. */
vi.mock('modern-screenshot', () => ({
  domToPng: domToPngMock,
}));

/* html2canvas: 폴백 경로용. onclone 을 실행해 복제 문서를 capturedRef 로 노출. */
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

/* domToPng 정상 동작 mock — 노드 복제 후 filter/onCloneNode 훅 실행 */
function installDomToPngSuccess() {
  domToPngMock.mockReset();
  domToPngMock.mockImplementation(async (el, options) => {
    capturedRef.options = options;
    const clone = el.cloneNode(true);
    if (typeof options.filter === 'function') {
      Array.from(clone.querySelectorAll('*')).forEach((n) => {
        if (options.filter(n) === false) n.remove();
      });
    }
    if (typeof options.onCloneNode === 'function') await options.onCloneNode(clone);
    capturedRef.clone = clone;
    return 'data:image/png;base64,' + 'A'.repeat(64);
  });
}

describe('captureAndShareCard — foreignObject(modern-screenshot) 캡처', () => {
  beforeEach(() => {
    capturedRef.clone = null;
    capturedRef.options = null;
    capturedRef.h2cDoc = null;
    capturedRef.h2cOptions = null;
    if (typeof navigator !== 'undefined') delete navigator.canShare;

    installDomToPngSuccess();

    html2canvasMock.mockReset();
    html2canvasMock.mockImplementation(async (el, options) => {
      const clonedDoc = document.implementation.createHTMLDocument('clone');
      clonedDoc.body.innerHTML = el.outerHTML;
      if (typeof options.onclone === 'function') options.onclone(clonedDoc);
      capturedRef.h2cDoc = clonedDoc;
      capturedRef.h2cOptions = options;
      return { toDataURL: () => 'data:image/png;base64,' + 'B'.repeat(64) };
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('domToPng 을 scale:2 로 호출한다', async () => {
    const card = buildCard();
    await captureAndShareCard(card, {});
    expect(domToPngMock).toHaveBeenCalledTimes(1);
    expect(capturedRef.options.scale).toBe(2);
  });

  it('상단 아이콘 자리(.card-actions)의 공유/북마크 버튼을 워터마크로 교체한다', async () => {
    const card = buildCard();
    await captureAndShareCard(card, {});

    const actions = capturedRef.clone.querySelector('.card-actions');
    /* .card-actions 슬롯은 유지되되 내부 버튼은 사라지고 워터마크만 남는다 */
    expect(actions).not.toBeNull();
    expect(actions.querySelector('.card-action-btn')).toBeNull();
    expect(actions.querySelector('.card-watermark-tmp')).not.toBeNull();
  });

  it('워터마크는 인라인 배치(static)이고, 작은 날짜(.card-meta)는 그 아래에 남는다', async () => {
    const card = buildCard();
    await captureAndShareCard(card, {});
    const wm = capturedRef.clone.querySelector('.card-watermark-tmp');

    expect(wm).not.toBeNull();
    expect(wm.textContent).toContain('DayStory');
    /* 아이콘 자리에 흐름 배치 → absolute 가 아니다 */
    expect(wm.style.position).not.toBe('absolute');

    /* .card-top-right 컬럼 순서: 워터마크(actions) → 작은 날짜(meta) */
    const right = capturedRef.clone.querySelector('.card-top-right');
    const order = Array.from(right.children).map((c) => c.className);
    expect(order.indexOf('card-actions')).toBeLessThan(order.indexOf('card-meta'));
    expect(right.querySelector('.card-meta')).not.toBeNull();
  });

  it('레이아웃 보정(line-height/transform)을 더 이상 강제하지 않는다 (실엔진 신뢰)', async () => {
    const card = buildCard();
    await captureAndShareCard(card, {});
    const date = capturedRef.clone.querySelector('.card-date');
    /* foreignObject 는 line-height:0.9 를 그대로 정확히 렌더 → 강제 보정 없음 */
    expect(date.style.lineHeight).toBe('');
    expect(date.style.fontSize).toBe('');
  });

  it('CORS 사전 변환 후 원본 DOM 이미지가 깨끗하게 복구된다', async () => {
    vi.useFakeTimers();
    /* 외부 URL — jsdom 에선 로드 실패 → imageToBase64 timeout 후 null.
       fake timer 로 8s timeout 을 즉시 진행. */
    const card = buildCard({ imgSrc: 'https://firebasestorage.googleapis.com/x/img.jpg' });
    const promise = captureAndShareCard(card, {});
    await vi.runAllTimersAsync();
    await promise;

    const img = card.querySelector('img');
    /* 사전 변환용 임시 dataset 이 복구되며 제거된다 */
    expect(img.dataset.originalSrc).toBeUndefined();
    /* 라이브 DOM 에는 crossorigin 을 강제하지 않는다(§6.2: 마크업 오염 금지) */
    expect(img.getAttribute('crossorigin')).toBeNull();
  });

  it('캡처 후 원본 DOM 의 임시 capture-id 가 제거된다', async () => {
    const card = buildCard();
    await captureAndShareCard(card, {});
    expect(card.dataset.captureId).toBeUndefined();
  });

  it('modern-screenshot 실패 시 html2canvas 로 폴백한다', async () => {
    domToPngMock.mockRejectedValueOnce(new Error('foreignObject unsupported'));
    const card = buildCard();
    const result = await captureAndShareCard(card, { _debugPreview: true });

    expect(html2canvasMock).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    /* 폴백 경로에서도 동일하게 아이콘 자리를 워터마크로 교체한다 */
    const cloned = capturedRef.h2cDoc.querySelector('[data-capture-id]');
    const actions = cloned.querySelector('.card-actions');
    expect(actions.querySelector('.card-watermark-tmp')).not.toBeNull();
    expect(actions.querySelector('.card-action-btn')).toBeNull();
  });
});
