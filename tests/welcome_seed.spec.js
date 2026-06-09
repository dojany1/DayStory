// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { addDocMock } = vi.hoisted(() => ({
  addDocMock: vi.fn(),
}));

vi.mock('../src/js/services/firebase.js', () => ({
  db: { _mockDb: true },
  storage: null,
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ _col: name })),
  doc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  addDoc: addDocMock,
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  serverTimestamp: vi.fn(() => new Date()),
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  deleteObject: vi.fn(),
}));

const { seedWelcomeStory } = await import('../src/js/services/mystories.js');

describe('seedWelcomeStory — 최초 가입 웰컴 카드 주입', () => {
  beforeEach(() => {
    addDocMock.mockReset();
    addDocMock.mockResolvedValue({ id: 'welcome-doc' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('uid 가 없으면 Firestore 쓰기를 하지 않는다', async () => {
    await seedWelcomeStory('');
    await seedWelcomeStory(undefined);
    expect(addDocMock).not.toHaveBeenCalled();
  });

  it('정상 uid 면 userStories 에 웰컴 카드를 1건 생성한다', async () => {
    await seedWelcomeStory('user-123');
    expect(addDocMock).toHaveBeenCalledTimes(1);

    const [, payload] = addDocMock.mock.calls[0];
    expect(payload.uid).toBe('user-123');
    expect(payload.is_welcome).toBe(true);
    expect(typeof payload.title).toBe('string');
    expect(payload.title.length).toBeGreaterThan(0);
    expect(typeof payload.body).toBe('string');
    expect(payload.body.length).toBeGreaterThan(0);
    /* 오늘 날짜(YYYY-MM-DD) 로 발행되어 '나의 일화' 오늘 카드에 노출 */
    expect(payload.publish_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    /* 이미지 없음 → cardImageWrap 이 FALLBACK_IMG 로 렌더 */
    expect(payload.image_url).toBe('');
    /* created_at/updated_at 타임스탬프가 주입된다 */
    expect(payload.created_at).toBeDefined();
  });

  it('addDoc 실패 시 에러를 전파한다 (호출부가 배지 설정을 건너뛰도록 — QA Q5)', async () => {
    addDocMock.mockRejectedValueOnce(new Error('permission-denied'));
    await expect(seedWelcomeStory('user-err')).rejects.toThrow('permission-denied');
  });
});
