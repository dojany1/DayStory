// @vitest-environment jsdom
/* =====================================================================
   notificationCenter.spec.js — 알림 센터 service 단위 테스트
   =====================================================================
   검증 핵심:
     - notices 다국어 필드 매핑 + locale 폴백(없으면 ko → 아무 값)
     - 본인 문의(userId 매칭)만 로드, uid 없으면 Firestore 호출 0
     - limit(20) + startAfter 커서 페이지네이션
     - unread(읽지 않음) 계산: lastSeen 이후 공지/답변 존재 여부
   mock 패턴은 mystories_uid_guard.spec.js(getDocs) 를 차용한다.
   ===================================================================== */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getDocsMock, orderByMock, whereMock, limitMock, startAfterMock, queryMock } = vi.hoisted(() => ({
  getDocsMock: vi.fn(),
  orderByMock: vi.fn((field, dir) => ({ __orderBy: [field, dir] })),
  whereMock: vi.fn((field, op, val) => ({ __where: [field, op, val] })),
  limitMock: vi.fn((n) => ({ __limit: n })),
  startAfterMock: vi.fn((c) => ({ __startAfter: c })),
  queryMock: vi.fn((...args) => ({ __query: args })),
}));

vi.mock('../src/js/services/firebase.js', () => ({
  db: { _mockDb: true },
  storage: null,
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ __col: name })),
  query: queryMock,
  where: whereMock,
  orderBy: orderByMock,
  limit: limitMock,
  startAfter: startAfterMock,
  getDocs: getDocsMock,
}));

/* locale 고정 — router/JSON 로딩 side-effect 회피 */
const { getCurrentLangMock } = vi.hoisted(() => ({ getCurrentLangMock: vi.fn(() => 'en') }));
vi.mock('../src/js/i18n/index.js', () => ({
  getCurrentLang: getCurrentLangMock,
}));

const {
  pickLocale,
  fetchNotices,
  fetchMyInquiries,
  fetchAdminInquiries,
  computeUnreadFromLists,
  getLastSeen,
  markAllRead,
  checkUnread,
} = await import('../src/js/services/notificationCenter.js');

/* getDocs 가 돌려줄 스냅샷 헬퍼 */
function snap(docs) {
  const arr = docs.map((d) => ({ id: d.id, data: () => d.data }));
  return { docs: arr, size: arr.length, empty: arr.length === 0 };
}

beforeEach(() => {
  localStorage.clear();
  getDocsMock.mockReset();
  orderByMock.mockClear();
  whereMock.mockClear();
  limitMock.mockClear();
  startAfterMock.mockClear();
  queryMock.mockClear();
  getCurrentLangMock.mockReturnValue('en');
});

afterEach(() => vi.clearAllMocks());

describe('pickLocale — 다국어 필드 매핑', () => {
  it('맵이면 해당 언어 필드를 반환한다', () => {
    expect(pickLocale({ ko: '한국어', en: 'English' }, 'en')).toBe('English');
    expect(pickLocale({ ko: '한국어', en: 'English' }, 'ko')).toBe('한국어');
  });

  it('해당 언어가 없으면 ko 로 폴백한다', () => {
    expect(pickLocale({ ko: '한국어' }, 'ja')).toBe('한국어');
  });

  it('ko 도 없으면 존재하는 첫 값으로 폴백한다', () => {
    expect(pickLocale({ es: 'Hola' }, 'ja')).toBe('Hola');
  });

  it('평문 문자열은 그대로 반환한다 (legacy 호환)', () => {
    expect(pickLocale('plain', 'en')).toBe('plain');
  });

  it('null/undefined/빈 객체는 빈 문자열', () => {
    expect(pickLocale(null, 'en')).toBe('');
    expect(pickLocale(undefined, 'en')).toBe('');
    expect(pickLocale({}, 'en')).toBe('');
  });
});

describe('fetchNotices — 공지 로드 + 페이지네이션', () => {
  it('orderBy createdAt desc + limit(pageSize) 로 쿼리하고 다국어 매핑한다', async () => {
    getDocsMock.mockResolvedValue(snap([
      { id: 'n1', data: { title: { en: 'Hello', ko: '안녕' }, body: { en: 'World', ko: '세상' }, createdAt: { toMillis: () => 2000 }, pinned: true } },
    ]));

    const res = await fetchNotices({ pageSize: 20 });

    expect(orderByMock).toHaveBeenCalledWith('createdAt', 'desc');
    expect(limitMock).toHaveBeenCalledWith(20);
    expect(startAfterMock).not.toHaveBeenCalled();
    expect(res.items).toEqual([
      { id: 'n1', title: 'Hello', body: 'World', createdAtMs: 2000, pinned: true },
    ]);
    expect(res.hasMore).toBe(false);
    expect(res.cursor).not.toBeNull();
  });

  it('가져온 개수가 pageSize 와 같으면 hasMore=true 이고 cursor 는 마지막 문서', async () => {
    const docs = Array.from({ length: 2 }, (_, i) => ({
      id: `n${i}`, data: { title: { en: `t${i}` }, body: { en: `b${i}` }, createdAt: { toMillis: () => i } },
    }));
    getDocsMock.mockResolvedValue(snap(docs));

    const res = await fetchNotices({ pageSize: 2 });
    expect(res.hasMore).toBe(true);
    expect(res.cursor).toEqual({ id: 'n1', data: expect.any(Function) });
  });

  it('cursor 가 주어지면 startAfter 를 적용한다', async () => {
    getDocsMock.mockResolvedValue(snap([]));
    const cursor = { id: 'prev', data: () => ({}) };
    await fetchNotices({ pageSize: 20, cursor });
    expect(startAfterMock).toHaveBeenCalledWith(cursor);
  });

  it('createdAtIso 만 있으면 그 값으로 createdAtMs 를 채운다', async () => {
    getDocsMock.mockResolvedValue(snap([
      { id: 'n1', data: { title: { en: 'x' }, body: { en: 'y' }, createdAtIso: '2026-01-01T00:00:00.000Z' } },
    ]));
    const res = await fetchNotices({});
    expect(res.items[0].createdAtMs).toBe(Date.parse('2026-01-01T00:00:00.000Z'));
  });
});

describe('fetchMyInquiries — 본인 문의만 로드', () => {
  it('uid 가 없으면 Firestore 호출 없이 빈 배열', async () => {
    expect(await fetchMyInquiries(null)).toEqual([]);
    expect(await fetchMyInquiries(undefined)).toEqual([]);
    expect(await fetchMyInquiries('')).toEqual([]);
    expect(getDocsMock).not.toHaveBeenCalled();
  });

  it('where userId == uid 로 쿼리하고 answered 는 answer 를 포함한다', async () => {
    getDocsMock.mockResolvedValue(snap([
      { id: 'i1', data: { type: 'bug', content: '버그요', status: 'answered', answer: '수정했어요', userId: 'u1', createdAt: { toMillis: () => 100 }, answeredAt: { toMillis: () => 200 } } },
      { id: 'i2', data: { type: 'etc', content: '문의요', status: 'pending', userId: 'u1', createdAt: { toMillis: () => 50 } } },
    ]));

    const res = await fetchMyInquiries('u1');

    expect(whereMock).toHaveBeenCalledWith('userId', '==', 'u1');
    expect(res).toHaveLength(2);
    expect(res[0]).toMatchObject({ id: 'i1', type: 'bug', content: '버그요', status: 'answered', answer: '수정했어요', createdAtMs: 100, answeredAtMs: 200 });
    expect(res[1]).toMatchObject({ id: 'i2', status: 'pending', answer: '' });
  });
});

describe('fetchAdminInquiries — 관리자 문의 알람 탭 목록', () => {
  it('전체 inquiries 를 최신순으로 페이지 조회한다', async () => {
    getDocsMock.mockResolvedValue(snap([
      { id: 'i1', data: { type: 'feature', content: '기능 제안', status: 'pending', userId: 'u1', createdAt: { toMillis: () => 300 } } },
      { id: 'i2', data: { type: 'bug', content: '버그', status: 'answered', answer: '확인 완료', userId: 'u2', createdAt: { toMillis: () => 200 }, answeredAt: { toMillis: () => 250 } } },
    ]));

    const res = await fetchAdminInquiries({ pageSize: 20 });

    expect(whereMock).not.toHaveBeenCalled();
    expect(orderByMock).toHaveBeenCalledWith('createdAt', 'desc');
    expect(limitMock).toHaveBeenCalledWith(20);
    expect(res.items).toHaveLength(2);
    expect(res.items[0]).toMatchObject({ id: 'i1', type: 'feature', content: '기능 제안', status: 'pending', userId: 'u1', createdAtMs: 300 });
    expect(res.items[1]).toMatchObject({ id: 'i2', status: 'answered', answer: '확인 완료', answeredAtMs: 250 });
  });

  it('cursor 가 있으면 startAfter 로 다음 페이지를 요청한다', async () => {
    getDocsMock.mockResolvedValue(snap([]));
    const cursor = { id: 'prev-inquiry', data: () => ({}) };

    await fetchAdminInquiries({ cursor });

    expect(startAfterMock).toHaveBeenCalledWith(cursor);
  });
});

describe('unread 계산', () => {
  it('lastSeen 기본값은 0, markAllRead 후 갱신된다', () => {
    expect(getLastSeen()).toBe(0);
    const before = Date.now();
    markAllRead();
    expect(getLastSeen()).toBeGreaterThanOrEqual(before);
  });

  it('lastSeen 이후 생성된 공지가 있으면 unread=true', () => {
    const notices = [{ createdAtMs: 5000 }];
    expect(computeUnreadFromLists(notices, [], 4000)).toBe(true);
    expect(computeUnreadFromLists(notices, [], 6000)).toBe(false);
  });

  it('lastSeen 이후 답변된 문의가 있으면 unread=true (pending 은 영향 없음)', () => {
    const answered = [{ status: 'answered', answeredAtMs: 5000 }];
    const pending = [{ status: 'pending', answeredAtMs: 0 }];
    expect(computeUnreadFromLists([], answered, 4000)).toBe(true);
    expect(computeUnreadFromLists([], answered, 6000)).toBe(false);
    expect(computeUnreadFromLists([], pending, 0)).toBe(false);
  });
});

describe('checkUnread — 배지용 경량 조회', () => {
  it('최신 공지가 lastSeen 이후면 true', async () => {
    /* notice 조회 1건 */
    getDocsMock.mockResolvedValueOnce(snap([
      { id: 'n1', data: { title: { en: 'x' }, body: { en: 'y' }, createdAt: { toMillis: () => 9999 } } },
    ]));
    /* answered inquiry 조회 — 없음 */
    getDocsMock.mockResolvedValueOnce(snap([]));

    expect(await checkUnread('u1')).toBe(true);
  });

  it('모두 lastSeen 이전이면 false', async () => {
    markAllRead(); /* lastSeen = now */
    getDocsMock.mockResolvedValueOnce(snap([
      { id: 'n1', data: { title: { en: 'x' }, body: { en: 'y' }, createdAt: { toMillis: () => 1 } } },
    ]));
    getDocsMock.mockResolvedValueOnce(snap([]));
    expect(await checkUnread('u1')).toBe(false);
  });

  it('Firestore 오류가 나도 false 로 안전하게 폴백한다', async () => {
    getDocsMock.mockRejectedValue(new Error('network'));
    expect(await checkUnread('u1')).toBe(false);
  });
});
