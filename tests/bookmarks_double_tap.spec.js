// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getStateMock, getDocsMock, addDocMock, deleteDocMock } = vi.hoisted(() => ({
  getStateMock: vi.fn(),
  getDocsMock: vi.fn(),
  addDocMock: vi.fn(),
  deleteDocMock: vi.fn(),
}));

vi.mock('../src/js/state.js', () => ({
  getState: getStateMock,
}));

vi.mock('../src/js/firebase.js', () => ({
  db: { _mockDb: true },
  auth: null,
  storage: null,
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  getDocs: getDocsMock,
  getDoc: vi.fn(),
  addDoc: addDocMock,
  deleteDoc: deleteDocMock,
}));

const { toggleBookmark } = await import('../src/js/services/bookmarks.js');

describe('Wave 4 — 북마크 빠른 더블탭 잠금', () => {
  beforeEach(() => {
    getStateMock.mockReset();
    getDocsMock.mockReset();
    addDocMock.mockReset();
    deleteDocMock.mockReset();
    getStateMock.mockReturnValue({ id: 'user-1' });
  });

  afterEach(() => {
    /* lock 풀기 위해 시간 진행 */
    vi.useRealTimers();
  });

  it('같은 storyId 에 대한 동시 두 번 호출 시 addDoc 은 한 번만 호출된다', async () => {
    /* 첫 호출이 진행 중인 동안 (getDocs pending) 두 번째 호출이 들어와도
       잠금 때문에 두 번째는 즉시 반환하고 Firestore 작업을 시작하지 않아야 한다. */
    let resolveFirstGetDocs;
    getDocsMock.mockImplementationOnce(() => new Promise(res => { resolveFirstGetDocs = res; }));

    /* 첫 호출 — async 진행 중 (resolve 안 됨) */
    const firstCall = toggleBookmark('story-A');

    /* 두 번째 호출 — 같은 storyId, 즉시 진행 차단되어야 함 */
    const secondCall = toggleBookmark('story-A');
    const secondResult = await secondCall;

    /* 두 번째는 잠금에 걸려서 별도 Firestore 작업 시작 안 함 */
    expect(secondResult).toEqual(expect.objectContaining({ bookmarked: false }));

    /* 첫 호출 진행 — getDocs 비어있음 → addDoc 호출 */
    resolveFirstGetDocs({ empty: true, docs: [] });
    addDocMock.mockResolvedValue({});
    await firstCall;

    /* addDoc 은 정확히 1회만 */
    expect(addDocMock).toHaveBeenCalledTimes(1);
  });

  it('서로 다른 storyId 동시 호출은 각각 정상 진행된다', async () => {
    getDocsMock.mockResolvedValue({ empty: true, docs: [] });
    addDocMock.mockResolvedValue({});

    const [r1, r2] = await Promise.all([
      toggleBookmark('story-A'),
      toggleBookmark('story-B'),
    ]);

    expect(r1.bookmarked).toBe(true);
    expect(r2.bookmarked).toBe(true);
    expect(addDocMock).toHaveBeenCalledTimes(2);
  });
});
