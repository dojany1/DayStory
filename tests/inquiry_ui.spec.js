// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* 서비스는 mock — 시트 UI 와 service 호출 계약만 검증한다. */
const { submitMock } = vi.hoisted(() => ({ submitMock: vi.fn() }));
vi.mock('../src/js/services/inquiries.js', () => ({
  submitInquiry: submitMock,
  INQUIRY_TYPES: ['bug', 'typo', 'feature', 'etc'],
}));

const { showInquirySheet } = await import('../src/js/components/inquirySheet.js');

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('inquirySheet — 토스 스타일 문의 바텀시트', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div class="mobile-wrapper"></div><div id="toast-container"></div>';
    submitMock.mockReset();
    submitMock.mockResolvedValue({ ok: true, error: null });
  });
  afterEach(() => {
    document.querySelectorAll('.inquiry-sheet-overlay').forEach((el) => el.remove());
    document.body.innerHTML = '';
  });

  it('유형 드롭다운(4종)·내용 입력·안내문구·제출 버튼을 렌더하고 .mobile-wrapper 에 마운트한다', () => {
    showInquirySheet();
    const overlay = document.querySelector('.mobile-wrapper .inquiry-sheet-overlay');
    expect(overlay).not.toBeNull();

    const options = overlay.querySelectorAll('.inquiry-select option');
    expect([...options].map((o) => o.value)).toEqual(['bug', 'typo', 'feature', 'etc']);

    expect(overlay.querySelector('#inquiry-content')).not.toBeNull();
    expect(overlay.querySelector('.inquiry-notice')).not.toBeNull();
    expect(overlay.querySelector('.inquiry-submit')).not.toBeNull();
  });

  it('이미 떠 있으면 중복 마운트하지 않는다', () => {
    showInquirySheet();
    const second = showInquirySheet();
    expect(second).toBeNull();
    expect(document.querySelectorAll('.inquiry-sheet-overlay').length).toBe(1);
  });

  it('카드에서 진입하면(presetType=typo) 유형이 오탈자로 미리 선택된다', () => {
    showInquirySheet({ presetType: 'typo', entryCardId: 'story-7' });
    const select = document.querySelector('.inquiry-select');
    expect(select.value).toBe('typo');
  });

  it('내용이 비어 있으면 submitInquiry 를 호출하지 않는다', async () => {
    showInquirySheet();
    document.querySelector('.inquiry-submit').click();
    await flush();
    expect(submitMock).not.toHaveBeenCalled();
  });

  it('내용 입력 후 제출하면 type/content/entryCardId 로 submitInquiry 를 호출한다', async () => {
    const onSubmitted = vi.fn();
    showInquirySheet({ presetType: 'typo', entryCardId: 'story-7', onSubmitted });
    const overlay = document.querySelector('.inquiry-sheet-overlay');
    overlay.querySelector('#inquiry-content').value = '3번째 줄 오타';
    overlay.querySelector('.inquiry-submit').click();
    await flush();

    expect(submitMock).toHaveBeenCalledTimes(1);
    expect(submitMock).toHaveBeenCalledWith({
      type: 'typo',
      content: '3번째 줄 오타',
      entryCardId: 'story-7',
    });
    expect(onSubmitted).toHaveBeenCalled();
  });

  it('제출 성공 시 시트가 닫힌다(visible 해제)', async () => {
    showInquirySheet();
    const overlay = document.querySelector('.inquiry-sheet-overlay');
    overlay.querySelector('#inquiry-content').value = '의견 있어요';
    overlay.querySelector('.inquiry-submit').click();
    await flush();
    expect(overlay.classList.contains('visible')).toBe(false);
  });
});
