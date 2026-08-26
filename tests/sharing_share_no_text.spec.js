// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* =====================================================================
   captureAndShareCard — 공유 페이로드에 텍스트 본문/링크를 넣지 않는다
   ---------------------------------------------------------------------
   사용자 요청: 카드 공유 시 이미지와 함께 전송되던
   "[DayStory] 우주로 간 원숭이" 같은 텍스트 본문이 포함되지 않아야 한다.
   추가 요청: 이미지(카드 이미지) 공유에는 링크(url)도 포함하지 않는다
   — 안드로이드에서 files 와 함께 url(EXTRA_TEXT)이 실리면 "갤러리/파일에
   저장" 같은 순수 이미지 저장 타겟이 공유 시트에서 빠지는 문제가 있다.

   검증 계약:
     · 네이티브 Share.share 페이로드에 text 가 없다(본문 제거)
     · 페이로드에 url 이 없다(딥링크 유무와 무관하게) — EXTRA_TEXT 없는
       순수 image/png 공유가 되어 갤러리/파일 저장이 가능해진다
     · 이미지(files)는 항상 포함된다
   ===================================================================== */

const { domToPngMock, shareMock } = vi.hoisted(() => ({
  domToPngMock: vi.fn(),
  shareMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('modern-screenshot', () => ({ domToPng: domToPngMock }));
vi.mock('@capacitor/share', () => ({ Share: { share: shareMock } }));
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile: vi.fn().mockResolvedValue({ uri: 'file:///x.png' }) },
  Directory: { Cache: 'CACHE' },
}));
/* 네이티브 경로 검증 — isNativePlatform: true. img 는 data: URL 이라
   imageToBase64(CapacitorHttp) 는 호출되지 않는다. */
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
  CapacitorHttp: { get: vi.fn() },
}));
vi.mock('../src/js/components/toast.js', () => ({
  showToast: vi.fn(),
  dismissToast: vi.fn(),
}));

const { captureAndShareCard } = await import('../src/js/services/sharing.js');

function buildCard() {
  const card = document.createElement('div');
  card.className = 'front history-card-front';
  card.innerHTML =
    '<div class="history-card-image-wrap">' +
    '<img src="data:image/png;base64,iVBORw0KGgo=" alt="" /></div>';
  document.body.appendChild(card);
  return card;
}

describe('captureAndShareCard — 공유 시 텍스트 본문 미포함', () => {
  beforeEach(() => {
    shareMock.mockClear();
    domToPngMock.mockReset();
    domToPngMock.mockResolvedValue('data:image/png;base64,' + 'A'.repeat(64));
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('딥링크가 있어도 text/url 없이 이미지(files)만 전달한다', async () => {
    const card = buildCard();
    await captureAndShareCard(card, {
      title: '우주로 간 원숭이',
      text: '[DayStory] 우주로 간 원숭이',
      url: 'https://dokhu-daystory.web.app/share?date=2026-06-15',
    });

    expect(shareMock).toHaveBeenCalledTimes(1);
    const payload = shareMock.mock.calls[0][0];
    expect(payload.text).toBeUndefined();
    expect(payload.url).toBeUndefined();
    expect(payload.files).toEqual(['file:///x.png']);
  });

  it('딥링크가 없어도 text/url 없이 이미지(files)만 전달한다', async () => {
    const card = buildCard();
    await captureAndShareCard(card, { text: '[DayStory] 무언가' });

    const payload = shareMock.mock.calls[0][0];
    expect(payload.text).toBeUndefined();
    expect(payload.url).toBeUndefined();
    expect(payload.files).toEqual(['file:///x.png']);
  });
});
