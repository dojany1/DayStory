// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getStateMock, getDocsMock } = vi.hoisted(() => ({
  getStateMock: vi.fn(),
  getDocsMock: vi.fn(),
}));

vi.mock('../src/js/state.js', () => ({
  getState: getStateMock,
  setState: vi.fn(),
}));

vi.mock('../src/js/services/firebase.js', () => ({
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
  addDoc: vi.fn(),
  deleteDoc: vi.fn(),
}));

const {
  isBookmarked,
  toggleBookmark,
  getBookmarkedStoryIds,
  getBookmarkedStories,
  getBookmarkCount,
} = await import('../src/js/services/bookmarks.js');

describe('Wave 2 — 게스트 모드 제거 후 인증 게이트 동작', () => {
  beforeEach(() => {
    localStorage.clear();
    getStateMock.mockReset();
    getDocsMock.mockReset();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('user state가 없을 때 isBookmarked는 Firestore를 호출하지 않고 false 반환', async () => {
    getStateMock.mockReturnValue(null);
    const result = await isBookmarked('story-1');
    expect(result).toBe(false);
    expect(getDocsMock).not.toHaveBeenCalled();
  });

  it('user state가 없을 때 toggleBookmark는 Firestore를 호출하지 않고 bookmarked:false 반환', async () => {
    getStateMock.mockReturnValue(null);
    const result = await toggleBookmark('story-1');
    expect(result.bookmarked).toBe(false);
    expect(getDocsMock).not.toHaveBeenCalled();
  });

  it('user state가 없을 때 getBookmarkedStoryIds는 빈 배열 반환', async () => {
    getStateMock.mockReturnValue(null);
    const result = await getBookmarkedStoryIds();
    expect(result).toEqual([]);
    expect(getDocsMock).not.toHaveBeenCalled();
  });

  it('user state가 없을 때 getBookmarkedStories는 빈 배열 반환', async () => {
    getStateMock.mockReturnValue(null);
    const result = await getBookmarkedStories();
    expect(result).toEqual([]);
    expect(getDocsMock).not.toHaveBeenCalled();
  });

  it('user state가 없을 때 getBookmarkCount는 0 반환', async () => {
    getStateMock.mockReturnValue(null);
    const result = await getBookmarkCount();
    expect(result).toBe(0);
    expect(getDocsMock).not.toHaveBeenCalled();
  });

  it('레거시 guest_bookmarks localStorage 데이터가 있어도 더 이상 읽지 않는다 (Firestore-only)', async () => {
    /* 게스트 모드 제거 후 legacy localStorage 잔존 데이터는 무시되어야 함 */
    localStorage.setItem('guest_bookmarks', JSON.stringify(['legacy-1', 'legacy-2']));
    getStateMock.mockReturnValue(null);
    const ids = await getBookmarkedStoryIds();
    expect(ids).toEqual([]);
  });

  it('로그인 사용자는 Firestore 경로를 거친다', async () => {
    getStateMock.mockReturnValue({ id: 'real-uid-123' });
    getDocsMock.mockResolvedValue({ empty: false, docs: [{ data: () => ({ story_id: 's1', created_at: '2026-05-22' }) }] });
    const ids = await getBookmarkedStoryIds();
    expect(getDocsMock).toHaveBeenCalled();
    expect(ids).toContain('s1');
  });
});
