// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* =====================================================================
   shareChoiceSheet — 공유 버튼 탭 시 "카드 이미지 / 링크" 선택 시트
   ---------------------------------------------------------------------
   사용자 요청: 공유 버튼에 뎁스를 추가해 이미지를 공유할지, 링크(OG 미리보기)를
   공유할지 선택하게 한다. 선택 결과는 captureAndShareCard 의 linkOnly 옵션으로
   전달된다(image → linkOnly:false, link → linkOnly:true, 취소 → null).
   ===================================================================== */

const { lockScrollMock, unlockScrollMock } = vi.hoisted(() => ({
  lockScrollMock: vi.fn(),
  unlockScrollMock: vi.fn(),
}));

vi.mock('../src/js/utils/scrollLock.js', () => ({
  lockScroll: lockScrollMock,
  unlockScroll: unlockScrollMock,
}));

vi.mock('../src/js/i18n/index.js', () => ({
  t: vi.fn((key) => key),
}));

const { showShareChoice } = await import('../src/js/components/shareChoiceSheet.js');

const flush = () => new Promise((resolve) => setTimeout(resolve, 250));

describe('showShareChoice — 공유 방법 선택 시트', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div class="mobile-wrapper"></div>';
    lockScrollMock.mockClear();
    unlockScrollMock.mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('"카드 이미지" / "링크" 두 가지 선택지와 취소 버튼을 렌더한다', async () => {
    const promise = showShareChoice();
    await Promise.resolve();

    expect(lockScrollMock).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.share-choice-option[data-choice="image"]')).not.toBeNull();
    expect(document.querySelector('.share-choice-option[data-choice="link"]')).not.toBeNull();
    expect(document.querySelector('.share-choice-cancel')).not.toBeNull();

    document.querySelector('.share-choice-cancel').click();
    await promise;
  });

  it('"카드 이미지"를 선택하면 "image" 로 resolve 되고 오버레이가 제거된다', async () => {
    const promise = showShareChoice();
    await Promise.resolve();

    document.querySelector('.share-choice-option[data-choice="image"]').click();
    const result = await promise;

    expect(result).toBe('image');
    await flush();
    expect(document.querySelector('.share-choice-overlay')).toBeNull();
    expect(unlockScrollMock).toHaveBeenCalledTimes(1);
  });

  it('"링크"를 선택하면 "link" 로 resolve 된다', async () => {
    const promise = showShareChoice();
    await Promise.resolve();

    document.querySelector('.share-choice-option[data-choice="link"]').click();
    const result = await promise;

    expect(result).toBe('link');
  });

  it('취소 버튼을 누르면 null 로 resolve 된다', async () => {
    const promise = showShareChoice();
    await Promise.resolve();

    document.querySelector('.share-choice-cancel').click();
    const result = await promise;

    expect(result).toBeNull();
  });

  it('오버레이 배경을 탭하면 null 로 resolve 된다', async () => {
    const promise = showShareChoice();
    await Promise.resolve();

    document.querySelector('.share-choice-overlay').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const result = await promise;

    expect(result).toBeNull();
  });

  it('title 옵션을 전달하면 다이얼로그 제목으로 표시한다', async () => {
    const promise = showShareChoice({ title: '커스텀 제목' });
    await Promise.resolve();

    expect(document.querySelector('.confirm-dialog-title').textContent).toBe('커스텀 제목');

    document.querySelector('.share-choice-cancel').click();
    await promise;
  });

  it('기본(showSave 미전달)에서는 "갤러리 저장" 옵션을 렌더하지 않는다', async () => {
    const promise = showShareChoice();
    await Promise.resolve();

    expect(document.querySelector('.share-choice-option[data-choice="save"]')).toBeNull();

    document.querySelector('.share-choice-cancel').click();
    await promise;
  });

  it('showSave:true 면 "갤러리 저장" 옵션을 렌더하고 선택 시 "save" 로 resolve 된다', async () => {
    const promise = showShareChoice({ showSave: true });
    await Promise.resolve();

    const saveBtn = document.querySelector('.share-choice-option[data-choice="save"]');
    expect(saveBtn).not.toBeNull();

    saveBtn.click();
    const result = await promise;
    expect(result).toBe('save');
  });

  it('showLink:false 면 "링크" 옵션을 렌더하지 않는다 (나의 일화 — 카드 이미지만)', async () => {
    const promise = showShareChoice({ showLink: false });
    await Promise.resolve();

    expect(document.querySelector('.share-choice-option[data-choice="link"]')).toBeNull();
    expect(document.querySelector('.share-choice-option[data-choice="image"]')).not.toBeNull();

    document.querySelector('.share-choice-cancel').click();
    await promise;
  });
});
