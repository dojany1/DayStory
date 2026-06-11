// @vitest-environment jsdom
/* =====================================================================
   readHistory.spec.js — 에디터 일화 "읽음 상태" service 단위 테스트
   =====================================================================
   비용 최적화 핵심(배치 flush)과 게스트 폴백/머지 동작을 검증한다.
   - 게스트(uid 없음): localStorage 에만 기록, 서버 write 0
   - 로그인: pending 을 arrayUnion 1회로 flush 후 pending 비움
   - init: 서버 ∪ 로컬 머지, 로컬 전용 날짜만 서버 업로드 예약
   ===================================================================== */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { setDocMock, arrayUnionMock, fakeAuth } = vi.hoisted(() => ({
  setDocMock: vi.fn(),
  arrayUnionMock: vi.fn((...args) => ({ __arrayUnion: args })),
  fakeAuth: { currentUser: null },
}));

vi.mock('../src/js/services/firebase.js', () => ({
  app: {}, storage: {},
  db: { __type: 'fake-db' },
  auth: fakeAuth,
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_, col, id) => ({ __col: col, __id: id })),
  setDoc: setDocMock,
  arrayUnion: arrayUnionMock,
}));

/* flush 후 전역 profile 갱신은 부수효과라 모킹으로 차단(검증 대상 아님) */
vi.mock('../src/js/state.js', () => ({
  getState: vi.fn(() => null),
  setState: vi.fn(),
}));

const { initReadHistory, isDateRead, markDateRead, flushReadHistory } =
  await import('../src/js/services/readHistory.js');

const LS_KEY = 'ds_read_history';

beforeEach(() => {
  localStorage.clear();
  setDocMock.mockReset().mockResolvedValue(undefined);
  arrayUnionMock.mockClear();
  fakeAuth.currentUser = null;
  initReadHistory(null); /* 모듈 전역 Set 초기화 */
});

afterEach(() => vi.clearAllMocks());

describe('markDateRead / isDateRead', () => {
  it('읽은 날짜는 isDateRead 가 true, 빈 값은 false', () => {
    expect(isDateRead('2026-06-10')).toBe(false);
    markDateRead('2026-06-10');
    expect(isDateRead('2026-06-10')).toBe(true);
    expect(isDateRead('')).toBe(false);
    expect(isDateRead(null)).toBe(false);
  });

  it('읽음 직후 ds:read-history-changed 이벤트를 dispatch 한다', () => {
    const handler = vi.fn();
    document.addEventListener('ds:read-history-changed', handler);
    markDateRead('2026-06-10');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({ iso: '2026-06-10' });
    document.removeEventListener('ds:read-history-changed', handler);
  });

  it('읽음 직후 현재 화면의 날짜 휠·캘린더 셀에 is-read 를 즉시 부여한다(새로고침 불필요)', () => {
    document.body.innerHTML = `
      <div class="wheel-item" data-date="2026-06-10" data-month="6" data-day="10">10</div>
      <button class="cal-cell cal-cell-has-story" data-date="2026-06-10" aria-label="6월 10일, 이순신"><span>10</span></button>
    `;
    markDateRead('2026-06-10');

    const wheel = document.querySelector('.wheel-item[data-date="2026-06-10"]');
    const cell = document.querySelector('.cal-cell[data-date="2026-06-10"]');
    expect(wheel.classList.contains('is-read')).toBe(true);
    expect(wheel.getAttribute('aria-label')).toBe('6월 10일, 이미 읽음');
    expect(cell.classList.contains('is-read')).toBe(true);
    expect(cell.getAttribute('aria-label')).toBe('6월 10일, 이순신, 이미 읽음');

    document.body.innerHTML = '';
  });
});

describe('게스트 폴백 (uid 없음)', () => {
  it('localStorage 에만 기록하고 서버 write 를 하지 않는다', async () => {
    markDateRead('2026-06-10');
    expect(JSON.parse(localStorage.getItem(LS_KEY))).toContain('2026-06-10');

    const flushed = await flushReadHistory();
    expect(flushed).toBe(false);
    expect(setDocMock).not.toHaveBeenCalled();
  });
});

describe('배치 flush (로그인)', () => {
  beforeEach(() => { fakeAuth.currentUser = { uid: 'u1' }; });

  it('pending 을 arrayUnion 1회로 flush 하고 pending 을 비운다', async () => {
    markDateRead('2026-06-10');
    markDateRead('2026-06-11');

    const flushed = await flushReadHistory();
    expect(flushed).toBe(true);
    expect(setDocMock).toHaveBeenCalledTimes(1);
    expect(arrayUnionMock).toHaveBeenCalledWith('2026-06-10', '2026-06-11');
    expect(setDocMock).toHaveBeenCalledWith(
      expect.objectContaining({ __col: 'profiles', __id: 'u1' }),
      expect.objectContaining({ readHistory: expect.anything() }),
      { merge: true },
    );

    /* 두 번째 flush 는 보낼 게 없어 no-op */
    setDocMock.mockClear();
    expect(await flushReadHistory()).toBe(false);
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('카드 N장을 읽어도 flush 1회로 묶는다 (비용 최적화)', async () => {
    for (const d of ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04']) markDateRead(d);
    await flushReadHistory();
    expect(setDocMock).toHaveBeenCalledTimes(1);
    expect(arrayUnionMock.mock.calls[0]).toHaveLength(4);
  });

  it('같은 날짜를 여러 번 읽어도 pending 은 1건', async () => {
    markDateRead('2026-06-10');
    markDateRead('2026-06-10');
    await flushReadHistory();
    expect(arrayUnionMock).toHaveBeenCalledWith('2026-06-10');
    expect(arrayUnionMock.mock.calls[0]).toHaveLength(1);
  });

  it('flush 실패 시 pending 을 보존해 다음에 재전송한다', async () => {
    markDateRead('2026-06-10');
    setDocMock.mockRejectedValueOnce(new Error('offline'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(await flushReadHistory()).toBe(false);

    setDocMock.mockResolvedValueOnce(undefined);
    expect(await flushReadHistory()).toBe(true);
    expect(arrayUnionMock).toHaveBeenLastCalledWith('2026-06-10');
    warnSpy.mockRestore();
  });
});

describe('initReadHistory (서버 ∪ 로컬 머지)', () => {
  it('서버와 로컬을 합쳐 모두 읽음으로 보고, 로컬 전용 날짜만 서버 업로드 예약', async () => {
    fakeAuth.currentUser = { uid: 'u1' };
    localStorage.setItem(LS_KEY, JSON.stringify(['2026-02-02']));

    initReadHistory({ readHistory: ['2026-01-01'] });
    expect(isDateRead('2026-01-01')).toBe(true);
    expect(isDateRead('2026-02-02')).toBe(true);

    await flushReadHistory();
    /* 서버에 이미 있던 2026-01-01 은 제외, 로컬 전용만 업로드 */
    expect(arrayUnionMock).toHaveBeenCalledWith('2026-02-02');
    expect(arrayUnionMock.mock.calls[0]).toHaveLength(1);
  });

  it('profile 이 없으면(게스트) 로컬 값만 읽음으로 복원한다', () => {
    localStorage.setItem(LS_KEY, JSON.stringify(['2026-03-03']));
    initReadHistory(null);
    expect(isDateRead('2026-03-03')).toBe(true);
  });
});
