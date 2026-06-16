// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchAdminInquiriesMock, openNotifDetailSheetMock } = vi.hoisted(() => ({
  fetchAdminInquiriesMock: vi.fn(),
  openNotifDetailSheetMock: vi.fn(),
}));

const { markAdminInquiriesReadMock } = vi.hoisted(() => ({
  markAdminInquiriesReadMock: vi.fn(),
}));

vi.mock('../src/js/services/notificationCenter.js', () => ({
  fetchAdminInquiries: fetchAdminInquiriesMock,
  markAdminInquiriesRead: markAdminInquiriesReadMock,
}));

vi.mock('../src/js/components/notificationCenterSheet.js', () => ({
  formatDate: (ms) => (ms ? '2026.06.11' : ''),
  openNotifDetailSheet: openNotifDetailSheetMock,
}));

vi.mock('../src/js/i18n/index.js', () => ({
  t: (key) => ({
    'adminInquiry.title': '사용자 문의',
    'adminInquiry.aria_open': '사용자 문의 목록 열기',
    'adminInquiry.empty': '접수된 문의가 없습니다',
    'adminInquiry.meta_app_version': '앱 버전',
    'adminInquiry.meta_entry_card': '카드',
    'adminInquiry.meta_locale': '언어',
    'adminInquiry.meta_platform': '플랫폼',
    'adminInquiry.meta_os': 'OS',
    'adminInquiry.meta_model': '기기 모델',
    'adminInquiry.meta_manufacturer': '제조사',
    'adminInquiry.meta_user': '사용자',
    'notificationCenter.loading': '불러오는 중...',
    'notificationCenter.load_more': '더 보기',
    'notificationCenter.error': '불러오지 못했어요. 잠시 후 다시 시도해주세요.',
    'notificationCenter.status_answered': '답변 완료',
    'notificationCenter.answer_label': '관리자 답변',
    'notificationCenter.aria_unread': '새 문의',
    'inquiry.type_bug': '버그',
    'inquiry.type_feature': '기능 제안',
    'common.close': '닫기',
  }[key] || key),
}));

const { renderAdminInquiryButton, showAdminInquirySheet } =
  await import('../src/js/components/adminInquirySheet.js');

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('adminInquirySheet — 관리자 문의 알람 탭', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div class="mobile-wrapper"></div>';
    fetchAdminInquiriesMock.mockReset().mockResolvedValue({
      items: [],
      cursor: null,
      hasMore: false,
    });
    openNotifDetailSheetMock.mockReset();
    markAdminInquiriesReadMock.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('헤더 우측에 넣을 관리자 전용 문의 버튼을 렌더한다', () => {
    const wrap = document.createElement('div');
    wrap.innerHTML = renderAdminInquiryButton();

    const btn = wrap.querySelector('#admin-inquiry-btn');
    expect(btn).not.toBeNull();
    expect(btn.getAttribute('aria-label')).toBe('사용자 문의 목록 열기');
    expect(btn.querySelector('.notif-bell-dot')).toBeNull();
  });

  it('unread=true 면 새 문의 빨간 점을 노출한다', () => {
    const wrap = document.createElement('div');
    wrap.innerHTML = renderAdminInquiryButton({ unread: true });

    const dot = wrap.querySelector('#admin-inquiry-btn .notif-bell-dot');
    expect(dot).not.toBeNull();
    expect(dot.getAttribute('aria-label')).toBe('새 문의');
  });

  it('문의함을 열면 읽음 처리(markAdminInquiriesRead)를 호출한다', async () => {
    showAdminInquirySheet();
    await flush();
    expect(markAdminInquiriesReadMock).toHaveBeenCalledTimes(1);
  });

  it('문의 알람 탭을 열면 전체 사용자 문의 목록을 읽기 전용 리스트로 보여준다', async () => {
    fetchAdminInquiriesMock.mockResolvedValue({
      items: [
        { id: 'i1', type: 'feature', content: '위젯이 있으면 좋겠어요', status: 'pending', answer: '', createdAtMs: 1000 },
        { id: 'i2', type: 'bug', content: '화면이 멈춰요', status: 'answered', answer: '확인했습니다', createdAtMs: 900, answeredAtMs: 950 },
      ],
      cursor: null,
      hasMore: false,
    });

    showAdminInquirySheet();
    await flush();

    const overlay = document.querySelector('.mobile-wrapper .admin-inquiry-overlay');
    expect(overlay).not.toBeNull();
    expect(fetchAdminInquiriesMock).toHaveBeenCalledWith({});
    expect(overlay.textContent).toContain('위젯이 있으면 좋겠어요');
    expect(overlay.textContent).toContain('화면이 멈춰요');
    expect(overlay.querySelector('.notif-status-pending')).toBeNull();
    expect(overlay.textContent).not.toContain('답변 대기중');
    expect(overlay.querySelector('.notif-status-answered')?.textContent).toContain('답변 완료');
    expect(overlay.querySelector('textarea')).toBeNull();
    expect(overlay.querySelector('[data-answer-submit]')).toBeNull();
  });

  it('문의 항목 클릭 시 상세 보기만 열고 답변 입력 UI는 열지 않는다', async () => {
    fetchAdminInquiriesMock.mockResolvedValue({
      items: [
        {
          id: 'i1',
          type: 'feature',
          content: '위젯이 있으면 좋겠어요',
          status: 'pending',
          answer: '',
          userId: 'user-1',
          userLabel: 'user@example.com',
          appVersion: '1.5.0',
          entryCardId: 'story-9',
          entryCardLabel: '2026-06-11 · 뉴턴의 하루',
          locale: 'ko',
          platform: 'web',
          os: { operatingSystem: 'android', osVersion: 'Android 15', model: 'Pixel 9', manufacturer: 'Google Inc.' },
          createdAtMs: 1000,
        },
      ],
      cursor: null,
      hasMore: false,
    });

    showAdminInquirySheet();
    await flush();
    document.querySelector('.notif-item[data-id="i1"]').click();

    expect(openNotifDetailSheetMock).toHaveBeenCalledWith({
      title: '기능 제안',
      meta: '2026.06.11',
      body: '위젯이 있으면 좋겠어요',
      answerLabel: '',
      answer: '',
      details: [
        { label: '앱 버전', value: '1.5.0' },
        { label: '카드', value: '2026-06-11 · 뉴턴의 하루' },
        { label: '언어', value: 'ko' },
        { label: '플랫폼', value: 'web' },
        { label: 'OS', value: 'android Android 15' },
        { label: '기기 모델', value: 'Pixel 9' },
        { label: '제조사', value: 'Google Inc.' },
        { label: '사용자', value: 'user@example.com' },
      ],
    });
  });
});
