// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { setDocMock } = vi.hoisted(() => ({
  setDocMock: vi.fn(),
}));

vi.mock('../src/js/services/firebase.js', () => ({
  db: { __type: 'fake-db' },
  auth: { currentUser: { uid: 'uid1' } },
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_, col, id) => ({ __col: col, __id: id })),
  setDoc: setDocMock,
  deleteField: vi.fn(() => ({ __op: 'deleteField' })),
}));

const {
  scheduleAccountDeletion,
  cancelAccountDeletion,
  getDeletionState,
  ACCOUNT_DELETION_GRACE_DAYS,
} = await import('../src/js/services/userProfile.js');

beforeEach(() => {
  setDocMock.mockReset().mockResolvedValue();
});

afterEach(() => vi.clearAllMocks());

describe('scheduleAccountDeletion', () => {
  it('profiles/{uid} 에 pending_deletion 상태와 예정 시각을 merge 로 기록한다', async () => {
    const before = Date.now();
    const scheduled = await scheduleAccountDeletion('uid1');
    const after = Date.now();

    expect(setDocMock).toHaveBeenCalledTimes(1);
    const [ref, data, opts] = setDocMock.mock.calls[0];
    expect(ref).toEqual({ __col: 'profiles', __id: 'uid1' });
    expect(data.status).toBe('pending_deletion');
    expect(opts).toEqual({ merge: true });

    /* 기본 유예 7일 뒤로 예약된다 */
    const scheduledMs = Date.parse(scheduled);
    const graceMs = ACCOUNT_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000;
    expect(scheduledMs).toBeGreaterThanOrEqual(before + graceMs);
    expect(scheduledMs).toBeLessThanOrEqual(after + graceMs);
    expect(data.deletionScheduledAt).toBe(scheduled);
  });

  it('graceDays 인자로 유예기간을 조정할 수 있다', async () => {
    const scheduled = await scheduleAccountDeletion('uid1', 14);
    const scheduledMs = Date.parse(scheduled);
    expect(scheduledMs).toBeGreaterThan(Date.now() + 13 * 24 * 60 * 60 * 1000);
  });

  it('uid 없으면 아무것도 하지 않고 null 을 반환한다', async () => {
    expect(await scheduleAccountDeletion('')).toBeNull();
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('쓰기 실패 시 null 을 반환한다', async () => {
    setDocMock.mockRejectedValueOnce(new Error('permission-denied'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await scheduleAccountDeletion('uid1')).toBeNull();
    warnSpy.mockRestore();
  });
});

describe('cancelAccountDeletion', () => {
  it('예약 관련 필드를 deleteField 로 제거한다', async () => {
    const ok = await cancelAccountDeletion('uid1');
    expect(ok).toBe(true);
    const [, data] = setDocMock.mock.calls[0];
    expect(data.status).toEqual({ __op: 'deleteField' });
    expect(data.deletionRequestedAt).toEqual({ __op: 'deleteField' });
    expect(data.deletionScheduledAt).toEqual({ __op: 'deleteField' });
  });

  it('uid 없으면 false 를 반환한다', async () => {
    expect(await cancelAccountDeletion('')).toBe(false);
    expect(setDocMock).not.toHaveBeenCalled();
  });
});

describe('getDeletionState', () => {
  const now = Date.parse('2026-07-12T00:00:00.000Z');

  it('예약 없는 프로필은 active', () => {
    expect(getDeletionState(null, now)).toBe('active');
    expect(getDeletionState({}, now)).toBe('active');
    expect(getDeletionState({ status: 'active' }, now)).toBe('active');
  });

  it('유예기간 내이면 pending', () => {
    const profile = {
      status: 'pending_deletion',
      deletionScheduledAt: new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString(),
    };
    expect(getDeletionState(profile, now)).toBe('pending');
  });

  it('유예기간이 지났으면 expired', () => {
    const profile = {
      status: 'pending_deletion',
      deletionScheduledAt: new Date(now - 1000).toISOString(),
    };
    expect(getDeletionState(profile, now)).toBe('expired');
  });

  it('예정 시각이 없거나 파싱 불가면 안전하게 pending', () => {
    expect(getDeletionState({ status: 'pending_deletion' }, now)).toBe('pending');
    expect(getDeletionState({ status: 'pending_deletion', deletionScheduledAt: 'bad' }, now)).toBe('pending');
  });
});
