// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getDocsMock } = vi.hoisted(() => ({
  getDocsMock: vi.fn(),
}));

vi.mock('../src/js/firebase.js', () => ({
  db: { _mockDb: true },
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
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  serverTimestamp: vi.fn(() => new Date()),
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  deleteObject: vi.fn(),
}));

const { fetchMyStories } = await import('../src/js/services/mystories.js');

describe('Wave 4 — fetchMyStories uid 가드', () => {
  beforeEach(() => {
    getDocsMock.mockReset();
  });

  it('uid가 undefined 면 Firestore 호출 없이 빈 배열 반환', async () => {
    const result = await fetchMyStories(undefined);
    expect(result).toEqual([]);
    expect(getDocsMock).not.toHaveBeenCalled();
  });

  it('uid가 null 이면 Firestore 호출 없이 빈 배열 반환', async () => {
    const result = await fetchMyStories(null);
    expect(result).toEqual([]);
    expect(getDocsMock).not.toHaveBeenCalled();
  });

  it('uid가 빈 문자열이면 Firestore 호출 없이 빈 배열 반환', async () => {
    const result = await fetchMyStories('');
    expect(result).toEqual([]);
    expect(getDocsMock).not.toHaveBeenCalled();
  });

  it('정상 uid 는 Firestore 경로 진입', async () => {
    getDocsMock.mockResolvedValue({ docs: [{ id: 'doc-1', data: () => ({ uid: 'user-1', title: 'test' }) }] });
    const result = await fetchMyStories('user-1');
    expect(getDocsMock).toHaveBeenCalled();
    expect(result.length).toBe(1);
  });
});
