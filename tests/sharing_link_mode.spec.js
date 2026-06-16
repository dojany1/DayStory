// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* =====================================================================
   captureAndShareCard — linkOnly 를 모든 플랫폼(iOS/Android/Web)에서 지원
   ---------------------------------------------------------------------
   사용자 요청: 공유 버튼에 "카드 이미지 / 링크" 선택지를 추가한다. "링크"를
   선택하면 플랫폼과 무관하게 캡처를 생략하고 링크만 공유한다(서버 동적 OG
   미리보기로 카드 이미지+제목 노출).

   검증 계약:
     · iOS 네이티브: Share.share({title, url, dialogTitle}) 만 호출, 캡처 생략
     · 웹 + Web Share API 지원: Share.share 호출(navigator.share 경유), 캡처 생략
     · 웹 + Web Share API 미지원: Share.share 가 던지면 클립보드 복사로 폴백
     · 클립보드도 없으면 ok:false + 'share-failed'
   ===================================================================== */

const { domToPngMock, shareMock, showToastMock, writeTextMock } = vi.hoisted(() => ({
  domToPngMock: vi.fn(),
  shareMock: vi.fn(),
  showToastMock: vi.fn(),
  writeTextMock: vi.fn(),
}));

vi.mock('modern-screenshot', () => ({ domToPng: domToPngMock }));
vi.mock('@capacitor/share', () => ({ Share: { share: shareMock } }));
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile: vi.fn().mockResolvedValue({ uri: 'file:///x.png' }) },
  Directory: { Cache: 'CACHE' },
}));
vi.mock('../src/js/components/toast.js', () => ({
  showToast: showToastMock,
  dismissToast: vi.fn(),
}));
vi.mock('../src/js/i18n/index.js', () => ({
  t: (key) => key,
}));

function buildCard() {
  const card = document.createElement('div');
  card.className = 'front history-card-front';
  card.innerHTML =
    '<div class="history-card-image-wrap">' +
    '<img src="data:image/png;base64,iVBORw0KGgo=" alt="" /></div>';
  document.body.appendChild(card);
  return card;
}

describe('captureAndShareCard — linkOnly (iOS 네이티브)', () => {
  let captureAndShareCard;

  beforeEach(async () => {
    vi.resetModules();
    domToPngMock.mockReset();
    shareMock.mockReset().mockResolvedValue(undefined);
    showToastMock.mockClear();
    vi.doMock('@capacitor/core', () => ({
      Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' },
      CapacitorHttp: { get: vi.fn() },
    }));
    ({ captureAndShareCard } = await import('../src/js/services/sharing.js'));
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.doUnmock('@capacitor/core');
  });

  it('linkOnly + 딥링크가 있으면 캡처 없이 링크만 공유한다', async () => {
    const card = buildCard();
    const res = await captureAndShareCard(card, {
      title: '우주로 간 원숭이',
      date: '2026-06-15',
      dialogTitle: '공유',
      linkOnly: true,
    });

    expect(domToPngMock).not.toHaveBeenCalled();
    expect(shareMock).toHaveBeenCalledTimes(1);
    expect(shareMock).toHaveBeenCalledWith({
      url: 'https://dokhu-daystory.web.app/share?date=2026-06-15',
      dialogTitle: '공유',
    });
    expect(res).toEqual({ ok: true, withImage: false, reason: 'link-only' });
  });
});

describe('captureAndShareCard — linkOnly (Web)', () => {
  let captureAndShareCard;

  beforeEach(async () => {
    vi.resetModules();
    domToPngMock.mockReset();
    shareMock.mockReset();
    showToastMock.mockClear();
    writeTextMock.mockReset();
    vi.doMock('@capacitor/core', () => ({
      Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' },
      CapacitorHttp: { get: vi.fn() },
    }));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    });
    ({ captureAndShareCard } = await import('../src/js/services/sharing.js'));
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.doUnmock('@capacitor/core');
    delete navigator.clipboard;
  });

  it('Web Share API 가 동작하면 Share.share 로 링크만 공유한다(캡처 생략)', async () => {
    shareMock.mockResolvedValue(undefined);
    const card = buildCard();
    const res = await captureAndShareCard(card, {
      title: '우주로 간 원숭이',
      date: '2026-06-15',
      linkOnly: true,
    });

    expect(domToPngMock).not.toHaveBeenCalled();
    expect(shareMock).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://dokhu-daystory.web.app/share?date=2026-06-15',
    }));
    expect(res).toEqual({ ok: true, withImage: false, reason: 'link-only' });
  });

  it('Web Share API 미지원이면 클립보드 복사로 폴백한다', async () => {
    shareMock.mockRejectedValue(new Error('Share API not available in this browser.'));
    writeTextMock.mockResolvedValue(undefined);
    const card = buildCard();
    const res = await captureAndShareCard(card, {
      title: '우주로 간 원숭이',
      date: '2026-06-15',
      linkOnly: true,
    });

    expect(domToPngMock).not.toHaveBeenCalled();
    expect(writeTextMock).toHaveBeenCalledWith('https://dokhu-daystory.web.app/share?date=2026-06-15');
    expect(showToastMock).toHaveBeenCalledWith('share.link_copied', 'success');
    expect(res).toEqual({ ok: true, withImage: false, reason: 'link-copied' });
  });

  it('클립보드도 없으면 실패를 반환한다', async () => {
    shareMock.mockRejectedValue(new Error('Share API not available in this browser.'));
    delete navigator.clipboard;
    const card = buildCard();
    const res = await captureAndShareCard(card, {
      title: '우주로 간 원숭이',
      date: '2026-06-15',
      linkOnly: true,
    });

    expect(showToastMock).toHaveBeenCalledWith('share.link_failed', 'error');
    expect(res).toEqual({ ok: false, withImage: false, reason: 'share-failed' });
  });
});
