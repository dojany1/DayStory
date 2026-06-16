// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* =====================================================================
   captureAndShareCard — saveToGallery: 사진 보관함에 직접 저장
   ---------------------------------------------------------------------
   사용자 보고: 안드로이드 공유 시트에 "갤러리/파일 저장" 타겟이 노출되지
   않는다(OS 한계). 해결: 공유 방법 선택 시트의 "갤러리 저장"을 고르면
   공유 시트 대신 @capacitor-community/media 로 캡처 이미지를 사진 보관함에
   직접 저장한다.

   검증 계약:
     · saveToGallery:true → Share.share 가 호출되지 않는다(공유 시트 미오픈)
     · Android: 'DayStory' 앨범 identifier 로 Media.savePhoto 가 dataURL 을 받는다
     · 앨범이 없으면 createAlbum 후 다시 조회해 identifier 를 확보한다
     · 권한 거부(denied) 시 reason:'save-denied' 로 실패를 구분한다
   ===================================================================== */

const {
  domToPngMock, shareMock,
  getAlbumsMock, createAlbumMock, savePhotoMock,
  platformRef,
} = vi.hoisted(() => ({
  domToPngMock: vi.fn(),
  shareMock: vi.fn().mockResolvedValue(undefined),
  getAlbumsMock: vi.fn(),
  createAlbumMock: vi.fn().mockResolvedValue(undefined),
  savePhotoMock: vi.fn().mockResolvedValue({ filePath: '/x/DayStory/IMG.png' }),
  platformRef: { value: 'android' },
}));

vi.mock('modern-screenshot', () => ({ domToPng: domToPngMock }));
vi.mock('@capacitor/share', () => ({ Share: { share: shareMock } }));
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile: vi.fn().mockResolvedValue({ uri: 'file:///x.png' }) },
  Directory: { Cache: 'CACHE' },
}));
vi.mock('@capacitor-community/media', () => ({
  Media: {
    getAlbums: getAlbumsMock,
    createAlbum: createAlbumMock,
    savePhoto: savePhotoMock,
  },
}));
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => true,
    getPlatform: () => platformRef.value,
  },
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

describe('captureAndShareCard — saveToGallery', () => {
  beforeEach(() => {
    platformRef.value = 'android';
    shareMock.mockClear();
    createAlbumMock.mockClear();
    savePhotoMock.mockClear().mockResolvedValue({ filePath: '/x/DayStory/IMG.png' });
    getAlbumsMock.mockReset();
    domToPngMock.mockReset();
    domToPngMock.mockResolvedValue('data:image/png;base64,' + 'A'.repeat(64));
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('Android: 기존 DayStory 앨범 identifier 로 savePhoto 를 호출하고 공유 시트는 열지 않는다', async () => {
    getAlbumsMock.mockResolvedValue({
      albums: [{ name: 'DayStory', identifier: '/storage/media/DayStory' }],
    });

    const card = buildCard();
    const res = await captureAndShareCard(card, { saveToGallery: true });

    expect(res).toEqual({ ok: true, withImage: true, reason: 'saved' });
    expect(shareMock).not.toHaveBeenCalled();
    expect(createAlbumMock).not.toHaveBeenCalled();
    expect(savePhotoMock).toHaveBeenCalledTimes(1);
    const payload = savePhotoMock.mock.calls[0][0];
    expect(payload.albumIdentifier).toBe('/storage/media/DayStory');
    expect(payload.path.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('Android: 앨범이 없으면 createAlbum 후 재조회한 identifier 로 저장한다', async () => {
    getAlbumsMock
      .mockResolvedValueOnce({ albums: [] })
      .mockResolvedValueOnce({ albums: [{ name: 'DayStory', identifier: '/p/DayStory' }] });

    const card = buildCard();
    const res = await captureAndShareCard(card, { saveToGallery: true });

    expect(createAlbumMock).toHaveBeenCalledWith({ name: 'DayStory' });
    expect(savePhotoMock.mock.calls[0][0].albumIdentifier).toBe('/p/DayStory');
    expect(res.ok).toBe(true);
  });

  it('iOS: albumIdentifier 없이 savePhoto 를 호출한다(카메라 롤)', async () => {
    platformRef.value = 'ios';

    const card = buildCard();
    const res = await captureAndShareCard(card, { saveToGallery: true });

    expect(getAlbumsMock).not.toHaveBeenCalled();
    expect(savePhotoMock).toHaveBeenCalledTimes(1);
    expect(savePhotoMock.mock.calls[0][0].albumIdentifier).toBeUndefined();
    expect(res.ok).toBe(true);
  });

  it('권한 거부 시 reason:"save-denied" 로 실패를 반환하고 공유로 폴백하지 않는다', async () => {
    getAlbumsMock.mockResolvedValue({ albums: [{ name: 'DayStory', identifier: '/p/DayStory' }] });
    savePhotoMock.mockRejectedValue(new Error('user denied permission request'));

    const card = buildCard();
    const res = await captureAndShareCard(card, { saveToGallery: true });

    expect(res).toEqual({ ok: false, withImage: true, reason: 'save-denied' });
    expect(shareMock).not.toHaveBeenCalled();
  });
});
