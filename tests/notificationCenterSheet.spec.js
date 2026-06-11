// @vitest-environment jsdom
/* =====================================================================
   notificationCenterSheet.spec.js — 알림 센터 시트 UI 테스트
   =====================================================================
   service 는 mock — 시트 UI 와 service 호출 계약·XSS 안전·상세 바텀시트만 검증.
   inquiry_ui.spec.js 의 "실제 컴포넌트 마운트 + 서비스 모킹" 패턴을 차용한다.
   ===================================================================== */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchNoticesMock, fetchMyInquiriesMock, markAllReadMock } = vi.hoisted(() => ({
  fetchNoticesMock: vi.fn(),
  fetchMyInquiriesMock: vi.fn(),
  markAllReadMock: vi.fn(),
}));

vi.mock('../src/js/services/notificationCenter.js', () => ({
  fetchNotices: fetchNoticesMock,
  fetchMyInquiries: fetchMyInquiriesMock,
  markAllRead: markAllReadMock,
}));

const { getStateMock } = vi.hoisted(() => ({ getStateMock: vi.fn() }));
vi.mock('../src/js/state.js', () => ({
  getState: getStateMock,
  setState: vi.fn(),
  subscribe: vi.fn(),
}));

const { renderNotificationBell, showNotificationCenter } =
  await import('../src/js/components/notificationCenterSheet.js');

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  document.body.innerHTML = '<div class="mobile-wrapper"></div><div id="toast-container"></div>';
  getStateMock.mockReset().mockImplementation((k) => (k === 'user' ? { id: 'u1' } : null));
  fetchNoticesMock.mockReset().mockResolvedValue({ items: [], cursor: null, hasMore: false });
  fetchMyInquiriesMock.mockReset().mockResolvedValue([]);
  markAllReadMock.mockReset();
});

afterEach(() => {
  document.querySelectorAll('.notif-center-overlay, .notif-detail-overlay').forEach((el) => el.remove());
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('renderNotificationBell — 종 아이콘 + unread dot', () => {
  it('unread 면 dot 을 포함한다', () => {
    const html = renderNotificationBell({ unread: true });
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    expect(wrap.querySelector('#notif-bell-btn')).not.toBeNull();
    expect(wrap.querySelector('.notif-bell-dot')).not.toBeNull();
  });

  it('unread 가 아니면 dot 이 없다', () => {
    const wrap = document.createElement('div');
    wrap.innerHTML = renderNotificationBell({ unread: false });
    expect(wrap.querySelector('.notif-bell-dot')).toBeNull();
  });
});

describe('showNotificationCenter — 마운트 & 데이터 로드', () => {
  it('.mobile-wrapper 에 오버레이를 마운트하고 두 탭과 헤더를 렌더한다', async () => {
    showNotificationCenter();
    await flush();
    const overlay = document.querySelector('.mobile-wrapper .notif-center-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay.querySelector('[data-tab="notices"]')).not.toBeNull();
    expect(overlay.querySelector('[data-tab="inquiries"]')).not.toBeNull();
  });

  it('열 때 markAllRead, fetchNotices, 본인 uid 로 fetchMyInquiries 를 호출한다', async () => {
    showNotificationCenter();
    await flush();
    expect(markAllReadMock).toHaveBeenCalledTimes(1);
    expect(fetchNoticesMock).toHaveBeenCalledTimes(1);
    expect(fetchMyInquiriesMock).toHaveBeenCalledWith('u1');
  });

  it('이미 떠 있으면 중복 마운트하지 않는다', async () => {
    showNotificationCenter();
    const second = showNotificationCenter();
    await flush();
    expect(second).toBeNull();
    expect(document.querySelectorAll('.notif-center-overlay').length).toBe(1);
  });

  it('공지 항목을 리스트에 렌더한다', async () => {
    fetchNoticesMock.mockResolvedValue({
      items: [{ id: 'n1', title: 'Hello', body: 'World', createdAtMs: 2000, pinned: false }],
      cursor: null, hasMore: false,
    });
    showNotificationCenter();
    await flush();
    const item = document.querySelector('.notif-item[data-id="n1"]');
    expect(item).not.toBeNull();
    expect(item.textContent).toContain('Hello');
  });

  it('공지 제목의 HTML 은 이스케이프되어 삽입된다 (XSS 방어)', async () => {
    fetchNoticesMock.mockResolvedValue({
      items: [{ id: 'n1', title: '<img src=x onerror=alert(1)>', body: '<b>x</b>', createdAtMs: 1, pinned: false }],
      cursor: null, hasMore: false,
    });
    showNotificationCenter();
    await flush();
    const list = document.querySelector('.notif-center-list[data-list="notices"]');
    expect(list.querySelector('img')).toBeNull();
    expect(list.innerHTML).toContain('&lt;img');
  });

  it('답변 완료 문의는 답변 내용을 노출하고, 대기중 문의는 노출하지 않는다', async () => {
    fetchMyInquiriesMock.mockResolvedValue([
      { id: 'i1', type: 'bug', content: '버그요', status: 'answered', answer: '고쳤어요', createdAtMs: 100, answeredAtMs: 200 },
      { id: 'i2', type: 'etc', content: '문의요', status: 'pending', answer: '', createdAtMs: 50, answeredAtMs: 0 },
    ]);
    showNotificationCenter();
    await flush();
    const answered = document.querySelector('.notif-item[data-id="i1"]');
    const pending = document.querySelector('.notif-item[data-id="i2"]');
    expect(answered.querySelector('.notif-item-answer')).not.toBeNull();
    expect(answered.querySelector('.notif-status-answered')).not.toBeNull();
    expect(answered.textContent).toContain('고쳤어요');
    expect(pending.querySelector('.notif-item-answer')).toBeNull();
    expect(pending.querySelector('.notif-status-pending')).toBeNull();
  });
});

describe('상세 바텀시트', () => {
  it('공지 항목 클릭 시 토스 스타일 상세 시트를 열고 본문을 노출한다', async () => {
    fetchNoticesMock.mockResolvedValue({
      items: [{ id: 'n1', title: '제목', body: '상세 본문입니다', createdAtMs: 1, pinned: false }],
      cursor: null, hasMore: false,
    });
    showNotificationCenter();
    await flush();
    document.querySelector('.notif-item[data-id="n1"]').click();
    await flush();
    const detail = document.querySelector('.notif-detail-overlay');
    expect(detail).not.toBeNull();
    expect(detail.querySelector('.modal-sheet')).not.toBeNull();
    expect(detail.textContent).toContain('상세 본문입니다');
  });

  it('상세 본문도 이스케이프된다 (XSS 방어)', async () => {
    fetchNoticesMock.mockResolvedValue({
      items: [{ id: 'n1', title: '제목', body: '<script>bad()</script>', createdAtMs: 1, pinned: false }],
      cursor: null, hasMore: false,
    });
    showNotificationCenter();
    await flush();
    document.querySelector('.notif-item[data-id="n1"]').click();
    await flush();
    const detail = document.querySelector('.notif-detail-overlay');
    expect(detail.querySelector('script')).toBeNull();
    expect(detail.innerHTML).toContain('&lt;script&gt;');
  });
});

describe('더 보기(페이지네이션)', () => {
  it('hasMore 면 더보기 버튼을 노출하고, 클릭 시 cursor 로 다음 페이지를 요청한다', async () => {
    fetchNoticesMock
      .mockResolvedValueOnce({
        items: [{ id: 'n1', title: 'A', body: 'a', createdAtMs: 2, pinned: false }],
        cursor: { __cursor: 1 }, hasMore: true,
      })
      .mockResolvedValueOnce({
        items: [{ id: 'n2', title: 'B', body: 'b', createdAtMs: 1, pinned: false }],
        cursor: null, hasMore: false,
      });

    showNotificationCenter();
    await flush();
    const moreBtn = document.querySelector('.notif-load-more');
    expect(moreBtn).not.toBeNull();

    moreBtn.click();
    await flush();
    expect(fetchNoticesMock).toHaveBeenLastCalledWith({ cursor: { __cursor: 1 } });
    expect(document.querySelector('.notif-item[data-id="n2"]')).not.toBeNull();
    /* 더 이상 없으면 버튼 사라짐 */
    expect(document.querySelector('.notif-load-more')).toBeNull();
  });
});
