// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getDocsMock, getDocMock } = vi.hoisted(() => ({
  getDocsMock: vi.fn(),
  getDocMock: vi.fn(),
}));

vi.mock('../src/js/firebase.js', () => ({
  db: { _mockDb: true },
  storage: null,
  auth: null,
}));

vi.mock('../src/js/state.js', () => ({
  getState: vi.fn(() => null),
  setState: vi.fn(),
  subscribe: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getDocs: getDocsMock,
  getDoc: getDocMock,
  addDoc: vi.fn(),
  updateDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(),
  serverTimestamp: vi.fn(() => new Date()),
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  deleteObject: vi.fn(),
}));

const stories = await import('../src/js/services/stories.js');
const {
  fetchStories,
  fetchTodayStory,
  fetchStoryById,
  searchStoriesDB,
  fetchStoriesWithLicense,
  invalidateStoriesCache,
} = stories;

const DEMO_FINGERPRINTS = ['리처드', '에펠', '고흐', '콜로세움', '뉴턴'];

function assertNoDemoLeak(payload) {
  const json = JSON.stringify(payload || '');
  for (const word of DEMO_FINGERPRINTS) {
    expect(json.includes(word), `더미 데이터 단어 "${word}" 가 결과에 포함됨`).toBe(false);
  }
}

describe('P0 — DEMO_STORIES 폴백 완전 제거 (2026-05-24)', () => {
  beforeEach(() => {
    getDocsMock.mockReset();
    getDocMock.mockReset();
    invalidateStoriesCache();
  });

  describe('Firestore 권한 거부(catch 경로)', () => {
    beforeEach(() => {
      getDocsMock.mockRejectedValue(Object.assign(new Error('PERMISSION_DENIED'), { code: 'permission-denied' }));
      getDocMock.mockRejectedValue(Object.assign(new Error('PERMISSION_DENIED'), { code: 'permission-denied' }));
    });

    it('fetchStories 는 빈 배열 (더미 없음)', async () => {
      const result = await fetchStories();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
      assertNoDemoLeak(result);
    });

    it('fetchTodayStory 는 null (더미 없음)', async () => {
      const result = await fetchTodayStory();
      expect(result).toBeNull();
      assertNoDemoLeak(result);
    });

    it('fetchStoryById 는 null (더미 없음)', async () => {
      const result = await fetchStoryById('1');
      expect(result).toBeNull();
      assertNoDemoLeak(result);
    });

    it('searchStoriesDB 는 빈 배열 (더미 없음)', async () => {
      const result = await searchStoriesDB('리처드');
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
      assertNoDemoLeak(result);
    });

    it('fetchStoriesWithLicense 는 빈 배열 (더미 없음)', async () => {
      const result = await fetchStoriesWithLicense();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
      assertNoDemoLeak(result);
    });
  });

  describe('Firestore 빈 응답 (관리자가 아직 카드를 발행하지 않은 초기 상태)', () => {
    beforeEach(() => {
      getDocsMock.mockResolvedValue({ docs: [] });
      getDocMock.mockResolvedValue({ exists: () => false, id: 'x', data: () => ({}) });
    });

    it('fetchStories 는 빈 배열', async () => {
      const result = await fetchStories();
      expect(result).toEqual([]);
      assertNoDemoLeak(result);
    });

    it('fetchTodayStory 는 null', async () => {
      const result = await fetchTodayStory();
      expect(result).toBeNull();
    });

    it('fetchStoryById (존재하지 않는 id) 는 null', async () => {
      const result = await fetchStoryById('does-not-exist');
      expect(result).toBeNull();
    });

    it('searchStoriesDB 는 빈 배열', async () => {
      const result = await searchStoriesDB('리처드');
      expect(result).toEqual([]);
      assertNoDemoLeak(result);
    });

    it('fetchStoriesWithLicense 는 빈 배열', async () => {
      const result = await fetchStoriesWithLicense();
      expect(result).toEqual([]);
    });
  });

  describe('정상 응답 — DB 데이터를 그대로 통과', () => {
    const realPublished = [
      { id: 'real-1', title: '실제 카드 1', body: '본문 1', figure_name: 'Real', country: '한국',
        publish_date: '2026-05-24', status: 'published' },
      { id: 'real-2', title: '실제 카드 2', body: '본문 2', figure_name: 'Real2', country: '미국',
        publish_date: '2026-05-23', status: 'published', image_license: 'CC-BY' },
    ];

    beforeEach(() => {
      getDocsMock.mockResolvedValue({
        docs: realPublished.map((d) => ({ id: d.id, data: () => d })),
      });
      getDocMock.mockResolvedValue({
        exists: () => true,
        id: 'real-1',
        data: () => realPublished[0],
      });
    });

    it('fetchStories 는 실제 데이터를 반환', async () => {
      const result = await fetchStories();
      expect(result.length).toBe(2);
      expect(result[0].id).toBe('real-1');
      assertNoDemoLeak(result);
    });

    it('fetchTodayStory 는 첫 published 문서를 반환', async () => {
      const result = await fetchTodayStory();
      expect(result).not.toBeNull();
      expect(result.id).toBe('real-1');
    });

    it('fetchStoryById 는 단일 문서를 반환', async () => {
      const result = await fetchStoryById('real-1');
      expect(result).not.toBeNull();
      expect(result.id).toBe('real-1');
    });

    it('searchStoriesDB 는 매칭 결과를 반환', async () => {
      const result = await searchStoriesDB('실제');
      expect(result.length).toBe(2);
    });

    it('fetchStoriesWithLicense 는 image_license 가 있는 문서만 반환', async () => {
      const result = await fetchStoriesWithLicense();
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('real-2');
    });
  });
});
