// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* =====================================================================
   captureAndShareCard — 안드로이드 "링크만 공유" (카카오톡 OG 미리보기)
   ---------------------------------------------------------------------
   사용자 요청: 안드로이드에서 카드 공유 시 이미지(PNG)를 첨부하면 카카오톡이
   링크를 버리므로, 이미지 대신 "썸네일 포함 링크"만 보낸다. 링크 미리보기는
   서버(Cloud Functions shareOg)의 동적 OG 가 카드 이미지+제목으로 그린다.

   검증 계약 (linkOnly:true + 안드로이드):
     · 캡처 엔진(domToPng)을 호출하지 않는다(이미지 생성 생략)
     · Share.share 페이로드는 url 만, files/text 는 없다
     · 딥링크가 없으면(linkOnly 인데 url 없음) 캡처 경로로 폴백(이미지 첨부)
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
/* 안드로이드 네이티브 경로 검증 */
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' },
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

describe('captureAndShareCard — 안드로이드 링크 전용 공유', () => {
  beforeEach(() => {
    shareMock.mockClear();
    domToPngMock.mockReset();
    domToPngMock.mockResolvedValue('data:image/png;base64,' + 'A'.repeat(64));
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('linkOnly + 딥링크가 있으면 캡처를 생략하고 링크(url)만 공유한다', async () => {
    const card = buildCard();
    const res = await captureAndShareCard(card, {
      title: '우주로 간 원숭이',
      date: '2026-06-15',
      linkOnly: true,
    });

    expect(domToPngMock).not.toHaveBeenCalled();
    expect(shareMock).toHaveBeenCalledTimes(1);
    const payload = shareMock.mock.calls[0][0];
    expect(payload.url).toBe('https://dokhu-daystory.web.app/share?date=2026-06-15');
    expect(payload.title).toBeUndefined();
    expect(payload.files).toBeUndefined();
    expect(payload.text).toBeUndefined();
    expect(res.ok).toBe(true);
    expect(res.withImage).toBe(false);
  });

  it('linkOnly 라도 딥링크가 없으면 캡처 경로(이미지 첨부)로 폴백한다', async () => {
    const card = buildCard();
    await captureAndShareCard(card, { title: '제목', linkOnly: true });

    expect(domToPngMock).toHaveBeenCalledTimes(1);
    const payload = shareMock.mock.calls[0][0];
    expect(payload.url).toBeUndefined();
    expect(payload.files).toEqual(['file:///x.png']);
  });
});
