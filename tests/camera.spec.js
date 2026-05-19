// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { isNativePlatformMock, getPhotoMock } = vi.hoisted(() => ({
  isNativePlatformMock: vi.fn(() => false),
  getPhotoMock: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: isNativePlatformMock },
}));

vi.mock('@capacitor/camera', () => ({
  Camera: { getPhoto: getPhotoMock },
  CameraResultType: { DataUrl: 'dataUrl' },
  CameraSource: { Camera: 'CAMERA', Photos: 'PHOTOS', Prompt: 'PROMPT' },
}));

const { pickFromCamera, pickFromGallery, CameraPermissionError } = await import(
  '../src/js/services/camera.js'
);

/* jsdom 의 FileReader 는 readAsDataURL 시 'data:<mime>;base64,' 만 반환 → 그대로 사용 가능.
 * input.click() 호출 후, 우리는 change 이벤트를 강제로 발화시켜 흐름을 시뮬레이션한다. */
function patchInputClick(file) {
  const origCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag) => {
    const el = origCreate(tag);
    if (tag === 'input') {
      const origClick = el.click.bind(el);
      el.click = () => {
        if (file) {
          Object.defineProperty(el, 'files', { value: [file], configurable: true });
        }
        const ev = new Event('change');
        setTimeout(() => el.dispatchEvent(ev), 0);
        return origClick;
      };
    }
    return el;
  });
}

beforeEach(() => {
  isNativePlatformMock.mockReturnValue(false);
  getPhotoMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('camera service — 웹 폴백', () => {
  it('pickFromCamera 는 capture="environment" 속성을 가진 input 을 사용한다', async () => {
    const created = [];
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = origCreate(tag);
      if (tag === 'input') {
        created.push(el);
        el.click = () => {
          const png = new File(['x'], 't.png', { type: 'image/png' });
          Object.defineProperty(el, 'files', { value: [png], configurable: true });
          setTimeout(() => el.dispatchEvent(new Event('change')), 0);
        };
      }
      return el;
    });

    const result = await pickFromCamera();
    expect(result?.dataUrl).toMatch(/^data:image\/png/);
    expect(result?.mimeType).toBe('image/png');
    expect(created.at(-1).getAttribute('capture')).toBe('environment');
  });

  it('pickFromGallery 는 capture 속성 없이 input 을 만든다', async () => {
    const created = [];
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = origCreate(tag);
      if (tag === 'input') {
        created.push(el);
        el.click = () => {
          const jpg = new File(['x'], 't.jpg', { type: 'image/jpeg' });
          Object.defineProperty(el, 'files', { value: [jpg], configurable: true });
          setTimeout(() => el.dispatchEvent(new Event('change')), 0);
        };
      }
      return el;
    });

    const result = await pickFromGallery();
    expect(result?.mimeType).toBe('image/jpeg');
    expect(created.at(-1).hasAttribute('capture')).toBe(false);
  });

  it('파일 미선택 시 null 을 반환한다 (취소)', async () => {
    patchInputClick(null);
    const result = await pickFromCamera();
    expect(result).toBeNull();
  });
});

describe('camera service — 네이티브', () => {
  it('네이티브 환경에서는 Camera.getPhoto 를 호출한다', async () => {
    isNativePlatformMock.mockReturnValue(true);
    getPhotoMock.mockResolvedValueOnce({
      dataUrl: 'data:image/jpeg;base64,AAAA',
      format: 'jpeg',
    });
    const result = await pickFromCamera();
    expect(getPhotoMock).toHaveBeenCalledWith(expect.objectContaining({
      source: 'CAMERA',
      resultType: 'dataUrl',
    }));
    expect(result?.dataUrl).toContain('base64');
    expect(result?.mimeType).toBe('image/jpeg');
  });

  it('네이티브 권한 거부 시 CameraPermissionError 를 던진다', async () => {
    isNativePlatformMock.mockReturnValue(true);
    getPhotoMock.mockRejectedValueOnce(new Error('User denied permission'));
    await expect(pickFromCamera()).rejects.toThrow(CameraPermissionError);
  });

  it('네이티브 사용자 취소 시 null 을 반환한다', async () => {
    isNativePlatformMock.mockReturnValue(true);
    getPhotoMock.mockRejectedValueOnce(new Error('User cancelled photos app'));
    await expect(pickFromCamera()).resolves.toBeNull();
  });
});
